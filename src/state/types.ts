export type PresetId = string
export type TableId = 'wheel' | 'slot' | 'strip' | 'cards'
export type Language = 'uk' | 'en'

export interface Preset {
  id: PresetId
  name: string
  items: string[]
  createdAt: number
  updatedAt: number
}

export interface WheelLayout {
  order: string[]
  angle: number
}

export interface ReelLayout {
  order: string[]
  offset: number
}

export interface CardsLayout {
  order: string[]
  cutOffset: number
  dealt: boolean
  cut: boolean
  positions: number[]
  columns?: number
}

export interface TableLayouts {
  wheel?: WheelLayout
  reel?: ReelLayout
  cards?: CardsLayout
}

export interface PresetState {
  elimination: boolean
  lastTable: TableId
  drawn: string[]
  tables: TableLayouts
  updatedAt: number
}

export interface Settings {
  sound: boolean
  haptics: boolean
  lang: Language
}

export interface Stored {
  version: 2
  presets: Preset[]
  states: Record<PresetId, PresetState>
  settings: Settings
}

export const createPresetState = (now = Date.now(), elimination = false): PresetState => ({
  elimination,
  lastTable: 'wheel',
  drawn: [],
  tables: {},
  updatedAt: now
})
