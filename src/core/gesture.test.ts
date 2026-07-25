import { describe, expect, it } from 'vitest'
import { AngleHistory } from './gesture'

describe('gesture history', () => {
  it('estimates velocity from roughly the last 100 ms, not only the final event', () => {
    const history = new AngleHistory()
    history.reset(0, 0)
    history.push(0.6, 50)
    history.push(1, 80)
    history.push(1, 95)
    expect(history.velocity(95)).toBeCloseTo(1 / 0.095)
  })

  it('unwraps angles across the minus-pi boundary', () => {
    const history = new AngleHistory()
    history.reset(Math.PI - 0.1, 0)
    history.push(-Math.PI + 0.1, 20)
    expect(history.velocity()).toBeCloseTo(10)
  })

  it('returns zero when the useful movement has aged out', () => {
    const history = new AngleHistory()
    history.reset(0, 0)
    history.push(1, 20)
    history.push(1, 200)
    expect(history.velocity(200)).toBe(0)
  })
})
