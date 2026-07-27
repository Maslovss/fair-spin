import { describe, expect, it } from 'vitest'
import {
  advanceReelMotion,
  createReelMotion,
  maxReelVelocity,
  minReelVelocity,
  reelOffsetAfterDrag,
  reelTravelCells,
  resultIndexFromOffset,
  runReelUntilStopped,
  easedSettlingOffset,
  leverVelocityFromDepth,
  LEVER_RELEASE_THRESHOLD,
  settledOffset,
  virtualReelCells
} from './reel'

describe('reel engine', () => {
  it.each([2, 40, 500])('maps wheel travel thresholds to cells for %i items', (count) => {
    expect(reelTravelCells(minReelVelocity(count), count)).toBeGreaterThanOrEqual(2.5 * count)
    expect(reelTravelCells(maxReelVelocity(count) * 10, count)).toBeLessThanOrEqual(12 * count)
  })

  it('derives the result from the cell under the frame centre', () => {
    expect(resultIndexFromOffset(0, 4, 10)).toBe(0)
    expect(resultIndexFromOffset(3, 4, 10)).toBe(0)
    expect(resultIndexFromOffset(7, 4, 10)).toBe(1)
    expect(resultIndexFromOffset(10, 4, 10)).toBe(1)
    expect(resultIndexFromOffset(-3, 4, 10)).toBe(0)
    expect(resultIndexFromOffset(-7, 4, 10)).toBe(3)
    expect(resultIndexFromOffset(-10, 4, 10)).toBe(3)
  })

  it('settles the chosen cell into the frame without changing the result', () => {
    for (const offset of [-47.2, -7, -3, 0, 3, 7, 46.8]) {
      const before = resultIndexFromOffset(offset, 4, 10)
      const afterOffset = settledOffset(offset, 4, 10)
      expect(resultIndexFromOffset(afterOffset, 4, 10)).toBe(before)
      expect(Math.abs(afterOffset - offset)).toBeLessThanOrEqual(5)
      expect(Math.abs(afterOffset % 10)).toBe(0)
    }
    expect(easedSettlingOffset(3, 0, 0)).toBe(3)
    expect(easedSettlingOffset(3, 0, 1)).toBe(0)
    expect(easedSettlingOffset(3, 0, 0.5)).toBeLessThan(1.5)
  })

  it('is deterministic and independent of render cadence', () => {
    const initial = createReelMotion(12.345, minReelVelocity(40) * 1.4, 40)
    const at60 = runReelUntilStopped(initial, 1 / 60, 40)
    const at120 = runReelUntilStopped(initial, 1 / 120, 40)
    const repeated = runReelUntilStopped(initial, 1 / 60, 40)
    expect(at60.offset).toBe(repeated.offset)
    expect(at60.offset).toBeCloseTo(at120.offset, 10)
  })

  it('ignores drag input while motion is active', () => {
    const initial = createReelMotion(3, minReelVelocity(20), 20)
    const untouched = advanceReelMotion(initial, 1 / 60, 20)
    const afterTouch = {
      ...initial,
      offset: reelOffsetAfterDrag(initial.offset, 100, true)
    }
    expect(runReelUntilStopped(afterTouch, 1 / 60, 20).offset)
      .toBe(runReelUntilStopped(initial, 1 / 60, 20).offset)
    expect(afterTouch.offset).toBe(initial.offset)
    expect(untouched.offset).not.toBe(initial.offset)
  })

  it('maps lever depth, not release speed, to an accepted strength', () => {
    const shallow = leverVelocityFromDepth(LEVER_RELEASE_THRESHOLD, 40)
    const deep = leverVelocityFromDepth(1, 40)
    expect(shallow).toBe(minReelVelocity(40))
    expect(deep).toBe(maxReelVelocity(40))
  })

  it('keeps a constant virtualized window for a 500-item list', () => {
    const cells = virtualReelCells(501.25, 500)
    expect(cells).toHaveLength(11)
    expect(cells.every(({ itemIndex }) => itemIndex >= 0 && itemIndex < 500)).toBe(true)
    expect(virtualReelCells(-0.25, 500)).toHaveLength(11)
  })
})
