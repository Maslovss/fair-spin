import { MAX_THROW_VELOCITY, MIN_THROW_VELOCITY, clampThrowVelocity, isAcceptedThrow } from './physics'
import { secureRandomInt, type CryptoSource } from './random'

interface GestureSample {
  angle: number
  time: number
}

export class AngleHistory {
  private readonly samples: GestureSample[] = []
  private unwrappedAngle = 0
  private previousRaw: number | null = null

  constructor(
    private readonly windowMs = 100,
    private readonly capacity = 32
  ) {}

  reset(angle: number, time: number): void {
    this.samples.length = 0
    this.unwrappedAngle = angle
    this.previousRaw = angle
    this.samples.push({ angle, time })
  }

  push(angle: number, time: number): number {
    if (this.previousRaw === null) {
      this.reset(angle, time)
      return angle
    }
    let delta = angle - this.previousRaw
    if (delta > Math.PI) delta -= Math.PI * 2
    if (delta < -Math.PI) delta += Math.PI * 2
    this.unwrappedAngle += delta
    this.previousRaw = angle
    this.samples.push({ angle: this.unwrappedAngle, time })
    while (this.samples.length > this.capacity) this.samples.shift()
    return this.unwrappedAngle
  }

  velocity(atTime?: number): number {
    const latest = this.samples.at(-1)
    if (!latest || this.samples.length < 2) return 0
    const endTime = atTime ?? latest.time
    const cutoff = endTime - this.windowMs
    const inWindow = this.samples.filter((sample) => sample.time >= cutoff && sample.time <= endTime)
    if (inWindow.length < 2) return 0
    const first = inWindow[0]
    const last = inWindow.at(-1)
    if (!first || !last || last.time <= first.time) return 0
    return (last.angle - first.angle) / ((last.time - first.time) / 1_000)
  }
}

export const pointAngle = (event: PointerEvent, element: HTMLElement): number => {
  const rect = element.getBoundingClientRect()
  return Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2))
}

export interface GestureCallbacks {
  onStart?(): void
  onDrag(delta: number): void
  onRelease(velocity: number): void
  onWeak(): void
}

export class WheelGesture {
  private activePointer: number | null = null
  private startAngle = 0
  private readonly history = new AngleHistory()

  constructor(
    private readonly element: HTMLElement,
    private readonly callbacks: GestureCallbacks
  ) {
    element.style.touchAction = 'none'
    element.addEventListener('pointerdown', this.onPointerDown)
    element.addEventListener('pointermove', this.onPointerMove)
    element.addEventListener('pointerup', this.onPointerUp)
    element.addEventListener('pointercancel', this.onPointerCancel)
  }

  destroy(): void {
    this.element.removeEventListener('pointerdown', this.onPointerDown)
    this.element.removeEventListener('pointermove', this.onPointerMove)
    this.element.removeEventListener('pointerup', this.onPointerUp)
    this.element.removeEventListener('pointercancel', this.onPointerCancel)
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.activePointer !== null || event.button !== 0) return
    this.activePointer = event.pointerId
    this.element.setPointerCapture(event.pointerId)
    this.startAngle = pointAngle(event, this.element)
    this.history.reset(this.startAngle, event.timeStamp)
    this.callbacks.onStart?.()
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointer) return
    const angle = pointAngle(event, this.element)
    const unwrapped = this.history.push(angle, event.timeStamp)
    this.callbacks.onDrag(unwrapped - this.startAngle)
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointer) return
    this.history.push(pointAngle(event, this.element), event.timeStamp)
    const velocity = this.history.velocity(event.timeStamp)
    this.releaseCapture(event.pointerId)
    if (isAcceptedThrow(velocity)) this.callbacks.onRelease(clampThrowVelocity(velocity))
    else this.callbacks.onWeak()
  }

  private readonly onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointer) return
    this.releaseCapture(event.pointerId)
    this.callbacks.onWeak()
  }

  private releaseCapture(pointerId: number): void {
    if (this.element.hasPointerCapture(pointerId)) this.element.releasePointerCapture(pointerId)
    this.activePointer = null
  }
}

export const randomThrowVelocity = (source: CryptoSource = globalThis.crypto): number => {
  const steps = Math.floor((MAX_THROW_VELOCITY - MIN_THROW_VELOCITY) * 100)
  return MIN_THROW_VELOCITY + secureRandomInt(steps + 1, source) / 100
}
