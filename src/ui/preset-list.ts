import type { Translate } from '../io/i18n'
import type { Preset } from '../state/types'

export interface PresetListActions {
  open(preset: Preset): void
  edit(preset: Preset): void
  duplicate(preset: Preset): void
  delete(preset: Preset): void
  create(): void
  settings(): void
}

const button = (label: string, className: string, action: () => void): HTMLButtonElement => {
  const element = document.createElement('button')
  element.type = 'button'
  element.className = className
  element.textContent = label
  element.addEventListener('click', action)
  return element
}

export const renderPresetList = (
  root: HTMLElement,
  presets: readonly Preset[],
  t: Translate,
  actions: PresetListActions
): void => {
  const header = document.createElement('header')
  header.className = 'app-header'
  const identity = document.createElement('div')
  const eyebrow = document.createElement('span')
  eyebrow.className = 'eyebrow'
  eyebrow.textContent = t('brand')
  const title = document.createElement('h1')
  title.textContent = t('presets.title')
  const tagline = document.createElement('p')
  tagline.textContent = t('tagline')
  identity.append(eyebrow, title, tagline)
  header.append(identity, button(t('presets.settings'), 'button button-quiet', actions.settings))

  const grid = document.createElement('section')
  grid.className = 'preset-grid'
  presets.forEach((preset, index) => {
    const card = document.createElement('article')
    card.className = 'preset-card'
    card.style.setProperty('--card-index', String(index))
    const cardMain = document.createElement('button')
    cardMain.type = 'button'
    cardMain.className = 'preset-card-main'
    cardMain.addEventListener('click', () => actions.open(preset))
    const cardTitle = document.createElement('h2')
    cardTitle.textContent = preset.name
    const meta = document.createElement('p')
    meta.textContent = t('presets.count', { count: preset.items.length })
    const preview = document.createElement('p')
    preview.className = 'preset-preview'
    preview.textContent = preset.items.slice(0, 4).join(' · ')
    cardMain.append(cardTitle, meta, preview)
    const actionsRow = document.createElement('div')
    actionsRow.className = 'card-actions'
    actionsRow.append(
      button(t('presets.edit'), 'text-button', () => actions.edit(preset)),
      button(t('presets.duplicate'), 'text-button', () => actions.duplicate(preset)),
      button(t('presets.delete'), 'text-button danger', () => actions.delete(preset))
    )
    card.append(cardMain, actionsRow)
    grid.append(card)
  })

  root.append(header, grid, button(t('presets.new'), 'button button-primary floating-create', actions.create))
}
