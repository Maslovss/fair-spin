import { describe, expect, it } from 'vitest'
import {
  MAX_ROTATIONS,
  MAX_THROW_VELOCITY,
  MIN_ROTATIONS,
  MIN_THROW_VELOCITY,
  createMotion,
  isAcceptedThrow,
  resultIndexFromAngle,
  runUntilStopped,
  travelRotations
} from './physics'

describe('fixed-step wheel physics', () => {
  it('rejects weak throws and guarantees the minimum travel', () => {
    expect(isAcceptedThrow(MIN_THROW_VELOCITY - 0.01)).toBe(false)
    expect(isAcceptedThrow(MIN_THROW_VELOCITY)).toBe(true)
    expect(travelRotations(MIN_THROW_VELOCITY)).toBeGreaterThanOrEqual(MIN_ROTATIONS)
  })

  it('caps strong throws near twelve rotations', () => {
    expect(createMotion(0, 999).velocity).toBe(MAX_THROW_VELOCITY)
    expect(travelRotations(999)).toBeLessThanOrEqual(MAX_ROTATIONS)
  })

  it('is deterministic and independent of render cadence', () => {
    const initial = createMotion(1.234, 17.25)
    const at60 = runUntilStopped(initial, 1 / 60)
    const at120 = runUntilStopped(initial, 1 / 120)
    const repeated = runUntilStopped(initial, 1 / 60)
    expect(at60.angle).toBe(repeated.angle)
    expect(at60.angle).toBeCloseTo(at120.angle, 10)
  })

  it('derives a result only from the final angle', () => {
    expect(resultIndexFromAngle(0, 4)).toBe(0)
    expect(resultIndexFromAngle(-Math.PI / 2, 4)).toBe(1)
    expect(resultIndexFromAngle(Math.PI / 2, 4)).toBe(3)
  })
})
