import { clampThrowVelocity, isAcceptedThrow } from '../core/physics'
import {
  LEVER_RELEASE_THRESHOLD,
  advanceReelMotion,
  createReelMotion,
  leverVelocityFromDepth,
  leverVisualProgress,
  easedSettlingOffset,
  reelOffsetAfterDrag,
  reelVelocityToWheel,
  resultIndexFromOffset,
  settledOffsetForIndex,
  virtualReelCells,
  wheelVelocityToReel,
  type ReelMotionState
} from '../core/reel'
import { LinearGesture, randomThrowVelocity } from '../core/gesture'
import { TickAudio } from '../io/audio'
import { vibrateTick, vibrateWeak } from '../io/haptics'
import type { ReelLayout } from '../state/types'
import type { Table, TableContext } from './table'

const SLOT_CELL_PX = 64
const STRIP_CELL_PX = 144
const STRIP_PIXELS_PER_RADIAN = 44
const LEVER_TRAVEL_PX = 136

export type ReelView = 'slot' | 'strip'

export class ReelTable implements Table {
  readonly min = 2
  readonly max = Number.POSITIVE_INFINITY
  readonly id
  private container: HTMLElement | null = null
  private context: TableContext | null = null
  private readonly cells: HTMLElement[] = []
  private gesture: LinearGesture | null = null
  private frame: number | null = null
  private motion: ReelMotionState | null = null
  private settling = false
  private currentOffset = 0
  private dragBase = 0
  private previousTick = 0
  private delivered = false
  private lever: HTMLElement | null = null
  private leverPointer: number | null = null
  private leverStartY = 0
  private leverDepth = 0
  private readonly audio = new TickAudio()

  constructor(private readonly view: ReelView) {
    this.id = view
  }

  private get cellPixels(): number {
    return this.view === 'slot' ? SLOT_CELL_PX : STRIP_CELL_PX
  }

  mount(el: HTMLElement, context: TableContext): void {
    this.unmount()
    if (!('offset' in context.layout)) throw new TypeError('ReelTable requires a reel layout')
    this.container = el
    this.context = context
    this.currentOffset = context.layout.offset
    this.render()
    if (context.interactive === false) return
    if (this.view === 'slot') this.mountLever()
    else this.mountStripGesture()
  }

  unmount(): void {
    this.gesture?.destroy()
    this.gesture = null
    if (this.frame !== null) cancelAnimationFrame(this.frame)
    this.frame = null
    this.motion = null
    this.settling = false
    this.leverPointer = null
    if (this.container) this.container.replaceChildren()
    this.container = null
    this.context = null
    this.lever = null
    this.cells.length = 0
  }

  tryLuck(): void {
    const context = this.context
    if (!context || context.interactive === false || this.motion || this.settling) return
    if (!context.onStart()) return
    this.audio.unlock()
    context.onInteraction?.()
    this.spin(wheelVelocityToReel(randomThrowVelocity(), context.items.length))
  }

  highlightResult(index: number): void {
    this.clearHighlight()
    const matches = this.cells.filter((cell) => Number(cell.dataset.itemIndex) === index)
    const selected = matches.reduce<HTMLElement | null>((closest, cell) => {
      if (!closest) return cell
      return Math.abs(Number(cell.dataset.positionCells)) <
        Math.abs(Number(closest.dataset.positionCells))
        ? cell
        : closest
    }, null)
    selected?.classList.add('table-result-highlight')
    this.container?.classList.add('table-is-revealing')
  }

  clearHighlight(): void {
    this.cells.forEach((cell) => cell.classList.remove('table-result-highlight'))
    this.container?.classList.remove('table-is-revealing')
  }

  private render(): void {
    const container = this.container
    const context = this.context
    if (!container || !context) return
    const machine = document.createElement('div')
    machine.className = `reel-machine reel-${this.view}`
    machine.setAttribute('role', context.interactive === false ? 'img' : 'application')
    machine.setAttribute('aria-label', context.ariaLabel)

    const surface = document.createElement('div')
    surface.className = `reel-surface reel-surface-${this.view}`
    surface.dataset.reelSurface = ''
    const viewport = document.createElement('div')
    viewport.className = 'reel-viewport'
    for (const virtual of virtualReelCells(this.currentOffset, context.items.length)) {
      const cell = document.createElement('div')
      cell.className = 'reel-cell'
      cell.dataset.poolIndex = String(virtual.poolIndex)
      viewport.append(cell)
      this.cells.push(cell)
    }
    const sight = document.createElement('div')
    sight.className = 'reel-sight'
    sight.setAttribute('aria-hidden', 'true')
    surface.append(viewport, sight)
    machine.append(surface)

    if (this.view === 'slot') {
      const leverTrack = document.createElement('div')
      leverTrack.className = 'slot-lever-track'
      const lever = document.createElement('button')
      lever.type = 'button'
      lever.className = 'slot-lever'
      lever.setAttribute('aria-label', context.ariaLabel)
      leverTrack.append(lever)
      machine.append(leverTrack)
      this.lever = lever
    }
    container.append(machine)
    this.renderCells()
  }

  private renderCells(): void {
    const context = this.context
    if (!context) return
    const virtual = virtualReelCells(this.currentOffset, context.items.length)
    virtual.forEach((entry, index) => {
      const cell = this.cells[index]
      if (!cell) return
      cell.textContent = context.items[entry.itemIndex] ?? ''
      cell.dataset.itemIndex = String(entry.itemIndex)
      cell.dataset.positionCells = String(entry.positionCells)
      const pixels = entry.positionCells * this.cellPixels
      cell.style.transform = this.view === 'slot'
        ? `translate3d(0, ${pixels}px, 0)`
        : `translate3d(${pixels}px, 0, 0)`
    })
  }

  private mountStripGesture(): void {
    const surface = this.container?.querySelector<HTMLElement>('[data-reel-surface]')
    if (!surface) throw new Error('Strip surface was not rendered')
    this.gesture = new LinearGesture(surface, 'x', {
      onStart: () => {
        const context = this.context
        if (this.motion || this.settling || !context?.onStart()) return false
        this.audio.unlock()
        context.onInteraction?.()
        this.dragBase = this.currentOffset
        return true
      },
      onDrag: (delta) => {
        const next = reelOffsetAfterDrag(
          this.dragBase,
          -delta / this.cellPixels,
          this.motion !== null
        )
        this.setOffset(next, true)
      },
      onRelease: (pixelVelocity) => {
        if (this.motion || this.settling || !this.context) return
        const wheelVelocity = -pixelVelocity / STRIP_PIXELS_PER_RADIAN
        if (!isAcceptedThrow(wheelVelocity)) {
          this.rejectWeakGesture()
          return
        }
        this.spin(wheelVelocityToReel(
          clampThrowVelocity(wheelVelocity),
          this.context.items.length
        ))
      },
      onCancel: () => this.rejectWeakGesture()
    })
  }

  private mountLever(): void {
    const lever = this.lever
    if (!lever) throw new Error('Slot lever was not rendered')
    lever.addEventListener('pointerdown', this.onLeverDown)
    lever.addEventListener('pointermove', this.onLeverMove)
    lever.addEventListener('pointerup', this.onLeverUp)
    lever.addEventListener('pointercancel', this.onLeverCancel)
  }

  private readonly onLeverDown = (event: PointerEvent): void => {
    if (
      this.motion ||
      this.settling ||
      this.leverPointer !== null ||
      event.button !== 0 ||
      !this.lever
    ) return
    const context = this.context
    if (!context?.onStart()) return
    this.audio.unlock()
    context.onInteraction?.()
    this.leverPointer = event.pointerId
    this.leverStartY = event.clientY
    this.leverDepth = 0
    this.lever.setPointerCapture(event.pointerId)
  }

  private readonly onLeverMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.leverPointer) return
    this.leverDepth = Math.max(0, Math.min(1, (event.clientY - this.leverStartY) / LEVER_TRAVEL_PX))
    this.updateLever()
  }

  private readonly onLeverUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.leverPointer) return
    this.releaseLeverCapture(event.pointerId)
    const depth = this.leverDepth
    this.leverDepth = 0
    this.updateLever(true)
    const context = this.context
    if (!context || this.motion || this.settling) return
    if (depth < LEVER_RELEASE_THRESHOLD) {
      this.rejectWeakGesture(false)
      return
    }
    this.audio.leverRelease(context.sound)
    this.spin(leverVelocityFromDepth(depth, context.items.length))
  }

  private readonly onLeverCancel = (event: PointerEvent): void => {
    if (event.pointerId !== this.leverPointer) return
    this.releaseLeverCapture(event.pointerId)
    this.leverDepth = 0
    this.updateLever(true)
    this.rejectWeakGesture(false)
  }

  private releaseLeverCapture(pointerId: number): void {
    if (this.lever?.hasPointerCapture(pointerId)) this.lever.releasePointerCapture(pointerId)
    this.leverPointer = null
  }

  private updateLever(returning = false): void {
    if (!this.lever) return
    this.lever.classList.toggle('slot-lever-returning', returning)
    this.lever.style.setProperty('--lever-progress', String(leverVisualProgress(this.leverDepth)))
    if (returning) {
      setTimeout(() => this.lever?.classList.remove('slot-lever-returning'), 220)
    }
  }

  private spin(velocity: number): void {
    const context = this.context
    if (!context || this.motion || this.settling) return
    this.motion = createReelMotion(this.currentOffset, velocity, context.items.length)
    this.previousTick = Math.floor(this.currentOffset)
    this.delivered = false
    let previousTime: number | null = null
    const animate = (time: number): void => {
      const active = this.context
      const motion = this.motion
      if (!active || !motion) return
      if (previousTime === null) previousTime = time
      const elapsed = Math.max(0, (time - previousTime) / 1_000)
      previousTime = time
      const speedFactor = active.reducedMotion ? 4 : 1
      this.motion = advanceReelMotion(motion, elapsed * speedFactor, active.items.length)
      this.setOffset(this.motion.offset, true)
      this.emitTicks(this.motion.velocity)
      if (this.motion.stopped) {
        const finalOffset = this.motion.offset
        this.motion = null
        this.setOffset(finalOffset, true)
        const winner = resultIndexFromOffset(finalOffset, active.items.length)
        active.onResolved(winner)
        this.settleAndDeliver(finalOffset, winner)
        return
      }
      this.frame = requestAnimationFrame(animate)
    }
    this.frame = requestAnimationFrame(animate)
  }

  private settleAndDeliver(finalOffset: number, winner: number): void {
    const context = this.context
    if (!context || this.delivered) return
    const targetOffset = settledOffsetForIndex(
      finalOffset,
      winner,
      context.items.length
    )
    const duration = context.reducedMotion ? 35 : 170
    this.settling = true
    let started: number | null = null
    const settle = (time: number): void => {
      const active = this.context
      if (!active) return
      if (started === null) started = time
      const progress = Math.min(1, (time - started) / duration)
      this.setOffset(easedSettlingOffset(finalOffset, targetOffset, progress), false)
      if (progress < 1) {
        this.frame = requestAnimationFrame(settle)
        return
      }
      this.settling = false
      this.frame = null
      this.setOffset(targetOffset, true)
      if (this.delivered) return
      this.delivered = true
      active.onSettled()
    }
    this.frame = requestAnimationFrame(settle)
  }

  private emitTicks(speed: number): void {
    const context = this.context
    if (!context) return
    const tick = Math.floor(this.currentOffset)
    const crossings = Math.min(4, Math.abs(tick - this.previousTick))
    for (let index = 0; index < crossings; index += 1) {
      this.audio.reelTick(
        reelVelocityToWheel(speed, context.items.length),
        context.sound,
        this.view
      )
      vibrateTick(context.haptics)
    }
    this.previousTick = tick
  }

  private rejectWeakGesture(restoreOffset = true): void {
    const context = this.context
    const container = this.container
    if (!context || !container || this.motion || this.settling) return
    if (restoreOffset) this.setOffset(this.dragBase, true)
    this.audio.sigh(context.sound)
    vibrateWeak(context.haptics)
    container.classList.remove('weak-gesture')
    void container.offsetWidth
    container.classList.add('weak-gesture')
    context.onCancel()
    context.onWeakGesture()
  }

  private setOffset(offset: number, persist: boolean): void {
    this.currentOffset = offset
    this.renderCells()
    if (!persist || !this.context) return
    const layout = this.context.layout
    if (!('offset' in layout)) return
    const next: ReelLayout = { ...layout, offset }
    this.context.onLayout(next)
  }
}
