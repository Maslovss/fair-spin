import {
  MAX_ITEM_LENGTH,
  MAX_ITEMS,
  MAX_NAME_LENGTH,
  MIN_ITEMS
} from '../state/presets'
import type { Preset } from '../state/types'

export const MAX_LINK_CHARS = 2000
const HASH_PREFIX = '#q='
const RAW_VERSION = '0'
const DEFLATE_VERSION = '1'
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u

export interface SharedQuestion {
  name: string
  items: string[]
}

interface WireQuestion {
  n: string
  i: string[]
}

export class QuestionShareError extends Error {
  constructor(readonly code: 'new-version' | 'invalid' | 'unsupported') {
    super(code)
  }
}

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '')
}

const base64UrlToBytes = (value: string): Uint8Array => {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new QuestionShareError('invalid')
  const padded = value.replaceAll('-', '+').replaceAll('_', '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

const transformBytes = async (
  bytes: Uint8Array,
  stream: TransformStream<Uint8Array, Uint8Array>
): Promise<Uint8Array> => {
  const writer = stream.writable.getWriter()
  const output = new Response(stream.readable).arrayBuffer()
  await writer.write(bytes)
  await writer.close()
  return new Uint8Array(await output)
}

const deflate = async (bytes: Uint8Array): Promise<Uint8Array | null> => {
  if (typeof CompressionStream === 'undefined') return null
  try {
    return await transformBytes(
      bytes,
      new CompressionStream('deflate-raw' as CompressionFormat) as TransformStream<
        Uint8Array,
        Uint8Array
      >
    )
  } catch {
    return null
  }
}

const inflate = async (bytes: Uint8Array): Promise<Uint8Array> => {
  if (typeof DecompressionStream === 'undefined') throw new QuestionShareError('unsupported')
  try {
    return await transformBytes(
      bytes,
      new DecompressionStream('deflate-raw' as CompressionFormat) as TransformStream<
        Uint8Array,
        Uint8Array
      >
    )
  } catch {
    throw new QuestionShareError('invalid')
  }
}

export const encodeQuestionHash = async (
  question: SharedQuestion,
  compression: 'auto' | 'raw' = 'auto'
): Promise<string> => {
  const bytes = new TextEncoder().encode(JSON.stringify({
    n: question.name,
    i: question.items
  } satisfies WireQuestion))
  const compressed = compression === 'auto' ? await deflate(bytes) : null
  return `${HASH_PREFIX}${compressed ? DEFLATE_VERSION : RAW_VERSION}.${
    bytesToBase64Url(compressed ?? bytes)
  }`
}

export const decodeQuestionHash = async (hash: string): Promise<SharedQuestion> => {
  if (!hash.startsWith(HASH_PREFIX)) throw new QuestionShareError('invalid')
  const encoded = hash.slice(HASH_PREFIX.length)
  const separator = encoded.indexOf('.')
  if (separator <= 0) throw new QuestionShareError('invalid')
  const version = encoded.slice(0, separator)
  if (version !== RAW_VERSION && version !== DEFLATE_VERSION) {
    throw new QuestionShareError('new-version')
  }
  try {
    const payload = base64UrlToBytes(encoded.slice(separator + 1))
    const bytes = version === DEFLATE_VERSION ? await inflate(payload) : payload
    const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown
    return validateImportedQuestion(parsed)
  } catch (error) {
    if (error instanceof QuestionShareError) throw error
    throw new QuestionShareError('invalid')
  }
}

export const validateImportedQuestion = (value: unknown): SharedQuestion => {
  if (!value || typeof value !== 'object') throw new QuestionShareError('invalid')
  const wire = value as Partial<WireQuestion>
  if (
    typeof wire.n !== 'string' ||
    !Array.isArray(wire.i) ||
    wire.i.some((item) => typeof item !== 'string')
  ) throw new QuestionShareError('invalid')
  const name = wire.n.trim()
  const items = wire.i.map((item) => item.trim())
  if (
    !name ||
    [...name].length > MAX_NAME_LENGTH ||
    CONTROL_CHARACTERS.test(name) ||
    items.length < MIN_ITEMS ||
    items.length > MAX_ITEMS ||
    items.some((item) =>
      !item ||
      [...item].length > MAX_ITEM_LENGTH ||
      CONTROL_CHARACTERS.test(item)
    )
  ) throw new QuestionShareError('invalid')
  return { name, items }
}

export type PreparedQuestionShare =
  | { kind: 'link'; text: string }
  | { kind: 'text'; text: string }

export const prepareQuestionShare = async (
  preset: Pick<Preset, 'name' | 'items'>,
  baseUrl: string
): Promise<PreparedQuestionShare> => {
  const hash = await encodeQuestionHash({ name: preset.name, items: [...preset.items] })
  const cleanBase = baseUrl.split('#', 1)[0] as string
  const link = `${cleanBase}${hash}`
  return link.length <= MAX_LINK_CHARS
    ? { kind: 'link', text: link }
    : { kind: 'text', text: preset.items.join('\n') }
}

const subtractOccurrences = (
  source: readonly string[],
  removed: readonly string[]
): string[] => {
  const remaining = [...source]
  for (const item of removed) {
    const index = remaining.indexOf(item)
    if (index >= 0) remaining.splice(index, 1)
  }
  return remaining
}

export interface QuestionDifference {
  added: string[]
  removed: string[]
}

export type ImportConflict =
  | { kind: 'new' }
  | { kind: 'identical'; existing: Preset }
  | { kind: 'conflict'; existing: Preset; difference: QuestionDifference }

export const compareImportedQuestion = (
  presets: readonly Preset[],
  imported: SharedQuestion
): ImportConflict => {
  const existing = presets.find(({ name }) => name.trim() === imported.name.trim())
  if (!existing) return { kind: 'new' }
  const difference = {
    added: subtractOccurrences(imported.items, existing.items),
    removed: subtractOccurrences(existing.items, imported.items)
  }
  return difference.added.length === 0 && difference.removed.length === 0
    ? { kind: 'identical', existing }
    : { kind: 'conflict', existing, difference }
}

export const clearQuestionHashUrl = (
  location: Pick<Location, 'pathname' | 'search'>
): string => `${location.pathname}${location.search}`
