export const TAU = Math.PI * 2
export const FIXED_STEP = 1 / 120
export const MIN_ROTATIONS = 2.5
export const MAX_ROTATIONS = 12
export const MIN_THROW_VELOCITY = 10.75
export const MAX_THROW_VELOCITY = 23

export interface PhysicsConfig {
  mu: number
  drag: number
  fixedStep: number
  restVelocity: number
}

export const WHEEL_PHYSICS: PhysicsConfig = {
  mu: 3.5,
  drag: 0.001,
  fixedStep: FIXED_STEP,
  restVelocity: 0.01
}

export interface MotionState {
  angle: number
  velocity: number
  accumulator: number
  stopped: boolean
}

export const createMotion = (angle: number, velocity: number): MotionState => ({
  angle,
  velocity: clampThrowVelocity(velocity),
  accumulator: 0,
  stopped: false
})

export const normalizeAngle = (angle: number): number => {
  const normalized = angle % TAU
  return normalized < 0 ? normalized + TAU : normalized
}

export const isAcceptedThrow = (velocity: number): boolean =>
  Number.isFinite(velocity) && Math.abs(velocity) >= MIN_THROW_VELOCITY

export const clampThrowVelocity = (velocity: number): number => {
  if (!Number.isFinite(velocity)) return 0
  return Math.sign(velocity || 1) * Math.min(Math.abs(velocity), MAX_THROW_VELOCITY)
}

export const stepMotion = (
  state: MotionState,
  step = FIXED_STEP,
  config = WHEEL_PHYSICS
): MotionState => {
  if (state.stopped) return state
  const direction = Math.sign(state.velocity)
  const speed = Math.abs(state.velocity)
  const deceleration = config.mu + config.drag * speed * speed
  const nextSpeed = Math.max(0, speed - deceleration * step)
  const nextVelocity = direction * nextSpeed
  const averageVelocity = (state.velocity + nextVelocity) / 2
  const angle = state.angle + averageVelocity * step
  const stopped = nextSpeed <= config.restVelocity
  return {
    angle,
    velocity: stopped ? 0 : nextVelocity,
    accumulator: state.accumulator,
    stopped
  }
}

export const advanceMotion = (
  state: MotionState,
  elapsedSeconds: number,
  config = WHEEL_PHYSICS
): MotionState => {
  if (state.stopped || elapsedSeconds <= 0) return state
  let next = { ...state, accumulator: state.accumulator + Math.min(elapsedSeconds, 0.25) }
  while (next.accumulator + Number.EPSILON >= config.fixedStep && !next.stopped) {
    next = stepMotion(next, config.fixedStep, config)
    next.accumulator -= config.fixedStep
  }
  return next
}

export const resultIndexFromAngle = (angle: number, itemCount: number, offset = 0): number => {
  if (!Number.isSafeInteger(itemCount) || itemCount < 1) {
    throw new RangeError('itemCount must be positive')
  }
  const sectorAngle = TAU / itemCount
  return Math.min(itemCount - 1, Math.floor(normalizeAngle(-angle + offset) / sectorAngle))
}

export const runUntilStopped = (
  initial: MotionState,
  renderStep: number,
  config = WHEEL_PHYSICS
): MotionState => {
  let state = initial
  let guard = 0
  while (!state.stopped && guard < 10_000) {
    state = advanceMotion(state, renderStep, config)
    guard += 1
  }
  if (!state.stopped) throw new Error('Simulation did not stop')
  return state
}

export const travelRotations = (velocity: number, config = WHEEL_PHYSICS): number => {
  const final = runUntilStopped(createMotion(0, velocity), FIXED_STEP, config)
  return Math.abs(final.angle) / TAU
}
