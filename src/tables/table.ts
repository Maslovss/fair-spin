import type { ReelLayout, TableId, WheelLayout } from '../state/types'

export const TABLE_LIMITS: Record<TableId, { min: number; max: number }> = {
  wheel: { min: 2, max: 30 },
  slot: { min: 2, max: Number.POSITIVE_INFINITY },
  strip: { min: 2, max: Number.POSITIVE_INFINITY },
  cards: { min: 2, max: 16 }
}

export const isTableAvailable = (table: TableId, itemCount: number): boolean => {
  const limits = TABLE_LIMITS[table]
  return itemCount >= limits.min && itemCount <= limits.max
}

export const availableTableIds = (itemCount: number): TableId[] =>
  (Object.keys(TABLE_LIMITS) as TableId[]).filter((table) => isTableAvailable(table, itemCount))

export const resolveTableId = (remembered: TableId, itemCount: number): TableId => {
  if (isTableAvailable(remembered, itemCount)) return remembered
  if (isTableAvailable('slot', itemCount)) return 'slot'
  return availableTableIds(itemCount)[0] ?? 'slot'
}

export interface TableContext {
  items: string[]
  layout: WheelLayout | ReelLayout
  sound: boolean
  haptics: boolean
  reducedMotion: boolean
  ariaLabel: string
  interactive?: boolean
  onResult(index: number): void
  onLayout(layout: WheelLayout | ReelLayout): void
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
