export type PresetId = string
export type TableId = 'wheel' | 'reel' | 'cards'
export type Language = 'uk' | 'en'

export interface Preset {
  id: PresetId
  name: string
  items: string[]
  elimination: boolean
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
  dealt: boolean
  cut: boolean
}

export interface TableLayouts {
  wheel?: WheelLayout
  reel?: ReelLayout
  cards?: CardsLayout
}

export interface PresetState {
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
  version: 1
  presets: Preset[]
  states: Record<PresetId, PresetState>
  settings: Settings
}

export const createPresetState = (now = Date.now()): PresetState => ({
  lastTable: 'wheel',
  drawn: [],
  tables: {},
  updatedAt: now
})
