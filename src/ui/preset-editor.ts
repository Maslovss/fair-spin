import type { Translate } from '../io/i18n'
import { insertTemplateSlot, templatePreview } from '../core/question'
import {
  MAX_NAME_LENGTH,
  PresetValidationError,
  assertUniquePresetName,
  createPreset,
  parseBulkItems,
  updatePreset
} from '../state/presets'
import type { Preset } from '../state/types'

export const openPresetEditor = (
  host: HTMLElement,
  t: Translate,
  preset: Preset | undefined,
  presets: readonly Preset[],
  save: (next: Preset, previous?: Preset) => void,
  initial?: { name: string; items: string[] }
): void => {
  const dialog = document.createElement('dialog')
  dialog.className = 'dialog editor-dialog'
  const form = document.createElement('form')
  form.method = 'dialog'
  const title = document.createElement('h2')
  title.textContent = t(preset ? 'editor.editTitle' : 'editor.createTitle')

  const nameLabel = document.createElement('label')
  nameLabel.textContent = t('editor.name')
  const name = document.createElement('input')
  name.name = 'name'
  name.maxLength = MAX_NAME_LENGTH
  name.required = true
  name.placeholder = t('editor.namePlaceholder')
  name.value = preset?.name ?? initial?.name ?? ''
  nameLabel.append(name)
  const namePreview = document.createElement('p')
  namePreview.className = 'editor-name-preview'
  namePreview.setAttribute('aria-live', 'polite')
  const makeTemplate = document.createElement('button')
  makeTemplate.type = 'button'
  makeTemplate.className = 'text-button editor-make-template'
  makeTemplate.textContent = t('editor.makeTemplate')
  let insertionCursor: number | null = null
  const renderNameAffordance = () => {
    const preview = templatePreview(name.value, t('question.placeholder'))
    namePreview.textContent = preview === null
      ? t('editor.readyPreview')
      : t('editor.templatePreview', { preview })
    makeTemplate.hidden = preview !== null
  }
  name.addEventListener('input', renderNameAffordance)
  makeTemplate.addEventListener('pointerdown', () => {
    insertionCursor = document.activeElement === name ? name.selectionStart : null
  })
  makeTemplate.addEventListener('click', () => {
    const inserted = insertTemplateSlot(name.value, insertionCursor)
    insertionCursor = null
    name.value = inserted.name
    renderNameAffordance()
    name.focus()
    name.setSelectionRange(inserted.cursor, inserted.cursor)
  })
  renderNameAffordance()

  const itemsLabel = document.createElement('label')
  itemsLabel.textContent = t('editor.items')
  const items = document.createElement('textarea')
  items.name = 'items'
  items.rows = 10
  items.placeholder = t('editor.itemsPlaceholder')
  items.value = preset?.items.join('\n') ?? initial?.items.join('\n') ?? ''
  const help = document.createElement('small')
  help.textContent = t('editor.itemsHelp')
  itemsLabel.append(items, help)

  const error = document.createElement('p')
  error.className = 'form-error'
  error.setAttribute('role', 'alert')
  const actions = document.createElement('div')
  actions.className = 'dialog-actions'
  const cancel = document.createElement('button')
  cancel.type = 'button'
  cancel.className = 'button button-quiet'
  cancel.textContent = t('editor.cancel')
  cancel.addEventListener('click', () => dialog.close())
  const submit = document.createElement('button')
  submit.type = 'submit'
  submit.className = 'button button-primary'
  submit.textContent = t('editor.save')
  actions.append(cancel, submit)

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    try {
      const input = {
        name: name.value,
        items: parseBulkItems(items.value)
      }
      const next = preset ? updatePreset(preset, input) : createPreset(input)
      assertUniquePresetName(presets, next.name, preset?.id)
      save(next, preset)
      dialog.close()
    } catch (caught) {
      if (caught instanceof PresetValidationError) {
        error.textContent = t(
          caught.code === 'name-required'
            ? 'editor.error.name'
            : caught.code === 'duplicate-name'
              ? 'editor.error.duplicate'
              : 'editor.error.items'
        )
      } else {
        throw caught
      }
    }
  })
  dialog.addEventListener('close', () => dialog.remove())
  form.append(title, nameLabel, namePreview, makeTemplate, itemsLabel, error, actions)
  dialog.append(form)
  host.append(dialog)
  dialog.showModal()
  name.focus()
}
