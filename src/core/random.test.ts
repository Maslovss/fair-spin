import { describe, expect, it } from 'vitest'
import { secureRandomInt, shuffle, type CryptoSource } from './random'

class XorShiftCrypto implements CryptoSource {
  private state = 0x12345678

  getRandomValues<T extends ArrayBufferView>(array: T): T {
    if (!(array instanceof Uint32Array)) throw new TypeError('Uint32Array required')
    this.state ^= this.state << 13
    this.state ^= this.state >>> 17
    this.state ^= this.state << 5
    array[0] = this.state >>> 0
    return array
  }
}

describe('secure random helpers', () => {
  it('produces values within the requested range', () => {
    const source = new XorShiftCrypto()
    for (let sample = 0; sample < 1_000; sample += 1) {
      expect(secureRandomInt(7, source)).toBeGreaterThanOrEqual(0)
      expect(secureRandomInt(7, source)).toBeLessThan(7)
    }
  })

  it('does not mutate the source array', () => {
    const source = [1, 2, 3, 4]
    const result = shuffle(source, new XorShiftCrypto())
    expect(source).toEqual([1, 2, 3, 4])
    expect(result.toSorted()).toEqual(source)
  })

  it('is positionally uniform over a large deterministic sample', () => {
    const source = new XorShiftCrypto()
    const counts = Array.from({ length: 4 }, () => Array<number>(4).fill(0))
    const samples = 80_000
    for (let sample = 0; sample < samples; sample += 1) {
      shuffle([0, 1, 2, 3], source).forEach((value, position) => {
        const row = counts[value]
        if (row) row[position] = (row[position] ?? 0) + 1
      })
    }
    const expected = samples / 4
    for (const row of counts) {
      for (const count of row) {
        expect(Math.abs(count - expected) / expected).toBeLessThan(0.025)
      }
    }
  })
})
