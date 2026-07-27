import {
  FIXED_STEP,
  MAX_THROW_VELOCITY,
  MIN_THROW_VELOCITY,
  TAU,
  WHEEL_PHYSICS,
  advanceMotion,
  clampThrowVelocity,
  type MotionState,
  type PhysicsConfig
} from './physics'

export interface ReelMotionState {
  offset: number
  velocity: number
  accumulator: number
  stopped: boolean
}

const assertItemCount = (itemCount: number): void => {
  if (!Number.isSafeInteger(itemCount) || itemCount < 1) {
    throw new RangeError('itemCount must be positive')
  }
}

export const reelPhysics = (itemCount: number): PhysicsConfig => {
  assertItemCount(itemCount)
  const scale = itemCount / TAU
  return {
    mu: WHEEL_PHYSICS.mu * scale,
    drag: WHEEL_PHYSICS.drag / scale,
    fixedStep: WHEEL_PHYSICS.fixedStep,
    restVelocity: WHEEL_PHYSICS.restVelocity * scale
  }
}

export const wheelVelocityToReel = (velocity: number, itemCount: number): number => {
  assertItemCount(itemCount)
  return velocity * itemCount / TAU
}

export const reelVelocityToWheel = (velocity: number, itemCount: number): number => {
  assertItemCount(itemCount)
  return velocity * TAU / itemCount
}

export const minReelVelocity = (itemCount: number): number =>
  wheelVelocityToReel(MIN_THROW_VELOCITY, itemCount)

export const maxReelVelocity = (itemCount: number): number =>
  wheelVelocityToReel(MAX_THROW_VELOCITY, itemCount)

export const isAcceptedReelThrow = (velocity: number, itemCount: number): boolean =>
  Number.isFinite(velocity) &&
  Math.abs(reelVelocityToWheel(velocity, itemCount)) >= MIN_THROW_VELOCITY

export const clampReelVelocity = (velocity: number, itemCount: number): number =>
  wheelVelocityToReel(
    clampThrowVelocity(reelVelocityToWheel(velocity, itemCount)),
    itemCount
  )

export const createReelMotion = (
  offset: number,
  velocity: number,
  itemCount: number
): ReelMotionState => ({
  offset,
  velocity: clampReelVelocity(velocity, itemCount),
  accumulator: 0,
  stopped: false
})

const toMotion = (state: ReelMotionState): MotionState => ({
  angle: state.offset,
  velocity: state.velocity,
  accumulator: state.accumulator,
  stopped: state.stopped
})

const fromMotion = (state: MotionState): ReelMotionState => ({
  offset: state.angle,
  velocity: state.velocity,
  accumulator: state.accumulator,
  stopped: state.stopped
})

export const advanceReelMotion = (
  state: ReelMotionState,
  elapsedSeconds: number,
  itemCount: number
): ReelMotionState =>
  fromMotion(advanceMotion(toMotion(state), elapsedSeconds, reelPhysics(itemCount)))

export const runReelUntilStopped = (
  initial: ReelMotionState,
  renderStep: number,
  itemCount: number
): ReelMotionState => {
  let state = initial
  let guard = 0
  while (!state.stopped && guard < 10_000) {
    state = advanceReelMotion(state, renderStep, itemCount)
    guard += 1
  }
  if (!state.stopped) throw new Error('Reel simulation did not stop')
  return state
}

export const reelTravelCells = (velocity: number, itemCount: number): number => {
  const final = runReelUntilStopped(createReelMotion(0, velocity, itemCount), FIXED_STEP, itemCount)
  return Math.abs(final.offset)
}

export const normalizeOffset = (offset: number, itemCount: number, cellSize = 1): number => {
  assertItemCount(itemCount)
  if (!Number.isFinite(cellSize) || cellSize <= 0) {
    throw new RangeError('cellSize must be positive')
  }
  const total = itemCount * cellSize
  return ((offset % total) + total) % total
}

export const resultIndexFromOffset = (
  offset: number,
  itemCount: number,
  cellSize = 1
): number => {
  const centeredPosition = normalizeOffset(offset, itemCount, cellSize) / cellSize
  return Math.floor(centeredPosition + 0.5) % itemCount
}

export const settledOffsetForIndex = (
  offset: number,
  index: number,
  itemCount: number,
  cellSize = 1
): number => {
  assertItemCount(itemCount)
  if (!Number.isSafeInteger(index) || index < 0 || index >= itemCount) {
    throw new RangeError('index must identify an item')
  }
  if (!Number.isFinite(cellSize) || cellSize <= 0) {
    throw new RangeError('cellSize must be positive')
  }
  const positionCells = offset / cellSize
  const cycle = Math.round((positionCells - index) / itemCount)
  return (cycle * itemCount + index) * cellSize
}

export const settledOffset = (
  offset: number,
  itemCount: number,
  cellSize = 1
): number =>
  settledOffsetForIndex(
    offset,
    resultIndexFromOffset(offset, itemCount, cellSize),
    itemCount,
    cellSize
  )

export const easedSettlingOffset = (
  from: number,
  to: number,
  progress: number
): number => {
  const clamped = Math.max(0, Math.min(1, progress))
  const eased = 1 - Math.pow(1 - clamped, 3)
  return from + (to - from) * eased
}

export const reelOffsetAfterDrag = (
  offset: number,
  deltaCells: number,
  moving: boolean
): number => moving ? offset : offset + deltaCells

export const LEVER_RELEASE_THRESHOLD = 0.68

export const leverVisualProgress = (depth: number): number => {
  const clamped = Math.max(0, Math.min(1, depth))
  return 1 - Math.pow(1 - clamped, 1.6)
}

export const leverVelocityFromDepth = (depth: number, itemCount: number): number => {
  const normalized = Math.max(
    0,
    Math.min(1, (depth - LEVER_RELEASE_THRESHOLD) / (1 - LEVER_RELEASE_THRESHOLD))
  )
  const wheelVelocity = MIN_THROW_VELOCITY +
    (MAX_THROW_VELOCITY - MIN_THROW_VELOCITY) * Math.pow(normalized, 1.35)
  return wheelVelocityToReel(wheelVelocity, itemCount)
}

export interface VirtualReelCell {
  poolIndex: number
  itemIndex: number
  positionCells: number
}

export const virtualReelCells = (
  offset: number,
  itemCount: number,
  visibleCount = 7,
  overscan = 2
): VirtualReelCell[] => {
  assertItemCount(itemCount)
  const poolSize = Math.max(1, Math.ceil(visibleCount) + Math.max(0, Math.ceil(overscan)) * 2)
  const firstRelative = -Math.floor(poolSize / 2)
  const center = Math.floor(offset)
  const fraction = offset - center
  return Array.from({ length: poolSize }, (_, poolIndex) => {
    const relative = firstRelative + poolIndex
    const absoluteIndex = center + relative
    return {
      poolIndex,
      itemIndex: ((absoluteIndex % itemCount) + itemCount) % itemCount,
      positionCells: relative - fraction
    }
  })
}
