import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  REVEAL_HOLD_MS,
  RevealLifecycle,
  type TableLifecycleState
} from './reveal'

afterEach(() => {
  vi.useRealTimers()
})

describe('result reveal lifecycle', () => {
  it.each([false, true])(
    'uses the same state sequence when elimination is %s',
    (elimination) => {
      vi.useFakeTimers()
      const states: TableLifecycleState[] = []
      const applied: number[] = []
      let lifecycle: RevealLifecycle<number>
      lifecycle = new RevealLifecycle({
        onStateChange: (state) => states.push(state),
        onReveal: () => undefined,
        onApply: (result) => {
          applied.push(result)
          if (!elimination) lifecycle.completeApplying()
        }
      })

      expect(lifecycle.tryStart()).toBe(true)
      expect(lifecycle.resolve(2)).toBe(true)
      expect(lifecycle.settle()).toBe(true)
      vi.advanceTimersByTime(REVEAL_HOLD_MS)

      expect(applied).toEqual([2])
      expect(states.slice(0, 4)).toEqual([
        'resolving',
        'settling',
        'revealing',
        'applying'
      ])
      if (elimination) {
        expect(lifecycle.state).toBe('applying')
        lifecycle.completeApplying()
      }
      expect(lifecycle.state).toBe('idle')
    }
  )

  it('holds for the full reveal time even when motion is reduced', () => {
    vi.useFakeTimers()
    const applied: number[] = []
    const lifecycle = new RevealLifecycle<number>({
      onReveal: () => undefined,
      onApply: (result) => applied.push(result)
    })

    lifecycle.tryStart()
    lifecycle.resolve(1)
    lifecycle.settle()
    vi.advanceTimersByTime(REVEAL_HOLD_MS - 1)
    expect(applied).toEqual([])
    vi.advanceTimersByTime(1)
    expect(applied).toEqual([1])
  })

  it('skips only the reveal and preserves the resolved result', () => {
    vi.useFakeTimers()
    const revealed: number[] = []
    const applied: number[] = []
    const lifecycle = new RevealLifecycle<number>({
      onReveal: (result) => revealed.push(result),
      onApply: (result) => applied.push(result)
    })

    lifecycle.tryStart()
    lifecycle.resolve(3)
    expect(lifecycle.resolve(0)).toBe(false)
    lifecycle.settle()
    expect(lifecycle.skipReveal()).toBe(true)
    vi.runAllTimers()

    expect(revealed).toEqual([3])
    expect(applied).toEqual([3])
  })

  it.each(['gesture', 'lever', 'flick', 'try luck'])(
    'rejects a new %s start outside idle',
    () => {
      vi.useFakeTimers()
      const lifecycle = new RevealLifecycle<number>({
        onReveal: () => undefined,
        onApply: () => undefined
      })

      lifecycle.tryStart()
      expect(lifecycle.tryStart()).toBe(false)
      lifecycle.resolve(0)
      expect(lifecycle.tryStart()).toBe(false)
      lifecycle.settle()
      expect(lifecycle.tryStart()).toBe(false)
      lifecycle.skipReveal()
      expect(lifecycle.tryStart()).toBe(false)
      lifecycle.completeApplying()
      expect(lifecycle.tryStart()).toBe(true)
    }
  )

  it('returns to idle when a gesture is too weak to resolve', () => {
    const lifecycle = new RevealLifecycle<number>({
      onReveal: () => undefined,
      onApply: () => undefined
    })

    lifecycle.tryStart()
    expect(lifecycle.cancelStart()).toBe(true)
    expect(lifecycle.state).toBe('idle')
  })
})
