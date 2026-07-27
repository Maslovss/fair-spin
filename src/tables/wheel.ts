import {
  TAU,
  advanceMotion,
  createMotion,
  normalizeAngle,
  resultIndexFromAngle,
  type MotionState
} from '../core/physics'
import { randomThrowVelocity, WheelGesture } from '../core/gesture'
import { TickAudio } from '../io/audio'
import { vibrateTick, vibrateWeak } from '../io/haptics'
import type { Table, TableContext } from './table'

const SVG_NS = 'http://www.w3.org/2000/svg'
const COLORS = ['#d95d39', '#efbd4e', '#589d8b', '#475c7a', '#9c5a7d', '#e28f55']

const polar = (radius: number, angle: number): [number, number] => [
  160 + radius * Math.cos(angle),
  160 + radius * Math.sin(angle)
]

const sectorPath = (index: number, count: number): string => {
  if (count === 1) {
    return 'M160 16 A144 144 0 1 1 160 304 A144 144 0 1 1 160 16 Z'
  }
  const start = -Math.PI / 2 + (index * TAU) / count
  const end = start + TAU / count
  const [x1, y1] = polar(144, start)
  const [x2, y2] = polar(144, end)
  const largeArc = count === 1 ? 1 : TAU / count > Math.PI ? 1 : 0
  return `M160 160 L${x1} ${y1} A144 144 0 ${largeArc} 1 ${x2} ${y2} Z`
}

const svgElement = <K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] =>
  document.createElementNS(SVG_NS, name)

export class WheelTable implements Table {
  readonly id = 'wheel' as const
  readonly min = 2
  readonly max = 30
  private container: HTMLElement | null = null
  private context: TableContext | null = null
  private rotor: SVGGElement | null = null
  private gesture: WheelGesture | null = null
  private frame: number | null = null
  private motion: MotionState | null = null
  private dragBase = 0
  private currentAngle = 0
  private previousTick = 0
  private delivered = false
  private spinDirection = 1
  private hintTimer: ReturnType<typeof setTimeout> | null = null
  private readonly audio = new TickAudio()

  mount(el: HTMLElement, context: TableContext): void {
    this.unmount()
    if (!('angle' in context.layout)) throw new TypeError('WheelTable requires a wheel layout')
    this.container = el
    this.context = context
    this.currentAngle = context.layout.angle
    this.render()
    if (context.interactive === false) return
    const wheel = el.querySelector<HTMLElement>('[data-wheel]')
    if (!wheel) throw new Error('Wheel surface was not rendered')
    this.gesture = new WheelGesture(wheel, {
      onStart: () => {
        if (this.motion) return
        this.audio.unlock()
        this.context?.onInteraction?.()
        this.clearHint()
        this.dragBase = this.currentAngle
      },
      onDrag: (delta) => {
        if (this.motion) return
        this.setAngle(this.dragBase + delta, true)
      },
      onRelease: (velocity) => {
        if (!this.motion) this.spin(velocity)
      },
      onWeak: () => this.rejectWeakGesture()
    })
    this.hintTimer = setTimeout(() => el.classList.add('show-gesture-hint'), 3_000)
  }

  unmount(): void {
    this.gesture?.destroy()
    this.gesture = null
    if (this.frame !== null) cancelAnimationFrame(this.frame)
    this.frame = null
    this.motion = null
    this.clearHint()
    if (this.container) this.container.replaceChildren()
    this.container = null
    this.context = null
    this.rotor = null
  }

  tryLuck(): void {
    if (!this.context || this.context.interactive === false || this.motion) return
    this.audio.unlock()
    this.context.onInteraction?.()
    this.spin(randomThrowVelocity())
  }

  private render(): void {
    const context = this.context
    const container = this.container
    if (!context || !container) return
    const wrapper = document.createElement('div')
    wrapper.className = context.interactive === false ? 'wheel-wrap wheel-static' : 'wheel-wrap'
    wrapper.dataset.wheel = ''
    wrapper.setAttribute('role', context.interactive === false ? 'img' : 'application')
    wrapper.setAttribute('aria-label', context.ariaLabel)

    const pointer = document.createElement('div')
    pointer.className = 'wheel-pointer'
    pointer.setAttribute('aria-hidden', 'true')

    const svg = svgElement('svg')
    svg.setAttribute('viewBox', '0 0 320 320')
    svg.classList.add('wheel-svg')
    const rotor = svgElement('g')
    rotor.classList.add('wheel-rotor')
    this.rotor = rotor

    context.items.forEach((item, index) => {
      const path = svgElement('path')
      path.setAttribute('d', sectorPath(index, context.items.length))
      path.setAttribute('fill', COLORS[index % COLORS.length] ?? '#d95d39')
      path.setAttribute('stroke', '#17130f')
      path.setAttribute('stroke-width', '2')
      rotor.append(path)

      const mid = -Math.PI / 2 + ((index + 0.5) * TAU) / context.items.length
      const [x, y] = polar(context.items.length <= 16 ? 74 : 96, mid)
      const label = svgElement('text')
      label.setAttribute('x', String(x))
      label.setAttribute('y', String(y))
      label.setAttribute('text-anchor', 'middle')
      label.setAttribute('dominant-baseline', 'middle')
      label.setAttribute('transform', `rotate(${(mid * 180) / Math.PI} ${x} ${y})`)
      label.setAttribute('class', context.items.length <= 16 ? 'wheel-label' : 'wheel-number')
      label.textContent = context.items.length <= 16 ? item : String(index + 1)
      rotor.append(label)
    })

    const hub = svgElement('circle')
    hub.setAttribute('cx', '160')
    hub.setAttribute('cy', '160')
    hub.setAttribute('r', '24')
    hub.setAttribute('class', 'wheel-hub')
    rotor.append(hub)
    svg.append(rotor)
    wrapper.append(pointer, svg)

    const hint = document.createElement('div')
    hint.className = 'gesture-hint'
    hint.setAttribute('aria-hidden', 'true')
    hint.textContent = '↻'
    wrapper.append(hint)
    container.append(wrapper)
    if (context.items.length > 16) this.renderLegend(container, context.items)
    this.setAngle(this.currentAngle, false)
  }

  private renderLegend(container: HTMLElement, items: readonly string[]): void {
    const list = document.createElement('ol')
    list.className = 'wheel-legend'
    items.forEach((item) => {
      const entry = document.createElement('li')
      entry.textContent = item
      list.append(entry)
    })
    container.append(list)
  }

  private spin(velocity: number): void {
    const context = this.context
    if (!context) return
    this.motion = createMotion(this.currentAngle, velocity)
    this.spinDirection = Math.sign(velocity) || 1
    this.previousTick = Math.floor(this.currentAngle / (TAU / context.items.length))
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
      this.motion = advanceMotion(motion, elapsed * speedFactor)
      this.setAngle(this.motion.angle, true)
      this.emitTicks(this.motion.velocity)
      if (this.motion.stopped) {
        const finalAngle = this.motion.angle
        this.motion = null
        this.setAngle(finalAngle, true)
        this.settleAndDeliver(finalAngle)
        return
      }
      this.frame = requestAnimationFrame(animate)
    }
    this.frame = requestAnimationFrame(animate)
  }

  private settleAndDeliver(finalAngle: number): void {
    const context = this.context
    if (!context) return
    const duration = context.reducedMotion ? 35 : 170
    const recoil = 0.035 * this.spinDirection
    let started: number | null = null
    const settle = (time: number): void => {
      if (!this.context) return
      if (started === null) started = time
      const progress = Math.min(1, (time - started) / duration)
      const recoilPhase = progress < 0.35
        ? progress / 0.35
        : 1 - (progress - 0.35) / 0.65
      this.setAngle(finalAngle - Math.sin((recoilPhase * Math.PI) / 2) * recoil, false)
      if (progress < 1) {
        this.frame = requestAnimationFrame(settle)
        return
      }
      this.setAngle(finalAngle, false)
      if (!this.delivered) {
        this.delivered = true
        this.context.onResult(resultIndexFromAngle(finalAngle, this.context.items.length))
      }
    }
    this.frame = requestAnimationFrame(settle)
  }

  private emitTicks(speed: number): void {
    const context = this.context
    if (!context) return
    const tick = Math.floor(this.currentAngle / (TAU / context.items.length))
    const crossings = Math.min(4, Math.abs(tick - this.previousTick))
    for (let index = 0; index < crossings; index += 1) {
      this.audio.tick(speed, context.sound)
      vibrateTick(context.haptics)
    }
    this.previousTick = tick
  }

  private rejectWeakGesture(): void {
    const context = this.context
    const container = this.container
    if (!context || !container || this.motion) return
    this.audio.sigh(context.sound)
    vibrateWeak(context.haptics)
    container.classList.remove('weak-gesture')
    void container.offsetWidth
    container.classList.add('weak-gesture')
    this.setAngle(this.dragBase, true)
    context.onWeakGesture()
  }

  private setAngle(angle: number, persist: boolean): void {
    this.currentAngle = angle
    this.rotor?.setAttribute('transform', `rotate(${(normalizeAngle(angle) * 180) / Math.PI} 160 160)`)
    if (persist && this.context) {
      const layout = this.context.layout
      if (!('angle' in layout)) return
      this.context.onLayout({ ...layout, angle })
    }
  }

  private clearHint(): void {
    if (this.hintTimer !== null) clearTimeout(this.hintTimer)
    this.hintTimer = null
    this.container?.classList.remove('show-gesture-hint')
  }
}
