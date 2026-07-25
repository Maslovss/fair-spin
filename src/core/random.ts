export interface CryptoSource {
  getRandomValues<T extends ArrayBufferView>(array: T): T
}

const defaultCrypto = (): CryptoSource => {
  if (!globalThis.crypto) throw new Error('Secure random source is unavailable')
  return globalThis.crypto
}

export const secureRandomInt = (maxExclusive: number, source = defaultCrypto()): number => {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > 0x1_0000_0000) {
    throw new RangeError('maxExclusive must be an integer from 1 through 2^32')
  }
  const range = 0x1_0000_0000
  const limit = range - (range % maxExclusive)
  const buffer = new Uint32Array(1)
  let value: number
  do {
    source.getRandomValues(buffer)
    value = buffer[0] ?? 0
  } while (value >= limit)
  return value % maxExclusive
}

export const shuffle = <T>(items: readonly T[], source = defaultCrypto()): T[] => {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomInt(index + 1, source)
    const current = result[index]
    result[index] = result[swapIndex] as T
    result[swapIndex] = current as T
  }
  return result
}
