import {
  formatSharedAnswer,
  type AnswerPair
} from '../core/answer-presentation'

export interface ShareTarget {
  share?(data: ShareData): Promise<void>
  clipboard: Pick<Clipboard, 'writeText'>
}

export const shareText = async (
  text: string,
  target: ShareTarget = navigator
): Promise<'shared' | 'copied'> => {
  if (typeof target.share === 'function') {
    await target.share({ text })
    return 'shared'
  }
  await target.clipboard.writeText(text)
  return 'copied'
}

export interface OrderLabels {
  order: string
  all: string
  of: string
  andMore: string
}

const displayUrl = (url: string): string =>
  url.replace(/^https?:\/\//u, '').replace(/\/$/u, '')

export const formatSingleAnswer = (
  pair: AnswerPair,
  table: string,
  appUrl: string
): string => formatSharedAnswer(pair, table, displayUrl(appUrl))

const orderHeader = (
  labels: OrderLabels,
  count: number,
  total: number,
  complete: boolean
): string => complete
  ? `${labels.order} (${labels.all} ${count}):`
  : `${labels.order} (${count} ${labels.of} ${total}):`

export const formatSharedOrder = (
  question: string,
  items: readonly string[],
  total: number,
  complete: boolean,
  labels: OrderLabels,
  appUrl: string,
  maxChars = 1800
): string => {
  const header = `🎲 ${question}\n${orderHeader(labels, items.length, total, complete)}`
  const footer = `Fair Spin — ${displayUrl(appUrl)}`
  const numbered = items.map((item, index) => `${index + 1}. ${item}`)
  const full = `${header}\n${numbered.join('\n')}\n\n${footer}`
  if (full.length <= maxChars) return full

  for (let shown = numbered.length - 1; shown >= 0; shown -= 1) {
    const rest = numbered.length - shown
    const tail = `…${labels.andMore} ${rest}`
    const candidate = `${header}\n${numbered.slice(0, shown).join('\n')}${
      shown ? '\n' : ''
    }${tail}\n\n${footer}`
    if (candidate.length <= maxChars) return candidate
  }
  return `${header}\n…${labels.andMore} ${items.length}\n\n${footer}`
}

export const fullOrderText = (items: readonly string[]): string =>
  items.map((item, index) => `${index + 1}. ${item}`).join('\n')
