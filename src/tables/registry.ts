import type { TableId } from '../state/types'
import { CardsTable } from './cards'
import { ReelTable } from './reel'
import { isTableAvailable, type Table } from './table'
import { WheelTable } from './wheel'

export interface TableRegistration {
  id: TableId
  create(): Table
}

export const TABLE_REGISTRY: readonly TableRegistration[] = [
  { id: 'wheel', create: () => new WheelTable() },
  { id: 'slot', create: () => new ReelTable('slot') },
  { id: 'strip', create: () => new ReelTable('strip') },
  { id: 'cards', create: () => new CardsTable() }
]

export const availableTableRegistrations = (itemCount: number): TableRegistration[] =>
  TABLE_REGISTRY.filter(({ id }) => isTableAvailable(id, itemCount))

export const createRegisteredTable = (id: TableId): Table => {
  const registration = TABLE_REGISTRY.find((candidate) => candidate.id === id)
  if (!registration) throw new RangeError(`Table is not registered: ${id}`)
  return registration.create()
}
