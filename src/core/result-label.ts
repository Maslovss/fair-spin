import type { TableId } from '../state/types'

interface ScopedResult {
  presetId: string
  tableId: TableId
  item: string
}

export class CurrentTableResult {
  private current: ScopedResult | null = null

  enter(presetId: string, tableId: TableId): void {
    if (
      this.current &&
      (this.current.presetId !== presetId || this.current.tableId !== tableId)
    ) {
      this.current = null
    }
  }

  record(presetId: string, tableId: TableId, item: string): void {
    this.current = { presetId, tableId, item }
  }

  clear(): void {
    this.current = null
  }

  read(presetId: string, tableId: TableId): string | null {
    return this.current?.presetId === presetId && this.current.tableId === tableId
      ? this.current.item
      : null
  }
}
