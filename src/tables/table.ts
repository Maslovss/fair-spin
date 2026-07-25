import type { TableId, WheelLayout } from '../state/types'

export const TABLE_LIMITS: Record<TableId, { min: number; max: number }> = {
  wheel: { min: 2, max: 30 },
  reel: { min: 2, max: Number.POSITIVE_INFINITY },
  cards: { min: 2, max: 16 }
}

export const isTableAvailable = (table: TableId, itemCount: number): boolean => {
  const limits = TABLE_LIMITS[table]
  return itemCount >= limits.min && itemCount <= limits.max
}

export interface TableContext {
  items: string[]
  layout: WheelLayout
  sound: boolean
  haptics: boolean
  reducedMotion: boolean
  ariaLabel: string
  interactive?: boolean
  onResult(index: number): void
  onLayout(layout: WheelLayout): void
  onWeakGesture(): void
  onInteraction?(): void
}

export interface Table {
  id: TableId
  min: number
  max: number
  mount(el: HTMLElement, context: TableContext): void
  unmount(): void
  tryLuck(): void
}
