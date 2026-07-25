import type { Translate } from '../io/i18n'
import {
  PresetValidationError,
  createPreset,
  parseBulkItems,
  updatePreset
} from '../state/presets'
import type { Preset } from '../state/types'

export const openPresetEditor = (
  host: HTMLElement,
  t: Translate,
  preset: Preset | undefined,
  save: (next: Preset, previous?: Preset) => void
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
  name.maxLength = 80
  name.required = true
  name.placeholder = t('editor.namePlaceholder')
  name.value = preset?.name ?? ''
  nameLabel.append(name)

  const itemsLabel = document.createElement('label')
  itemsLabel.textContent = t('editor.items')
  const items = document.createElement('textarea')
  items.name = 'items'
  items.rows = 10
  items.placeholder = t('editor.itemsPlaceholder')
  items.value = preset?.items.join('\n') ?? ''
  const help = document.createElement('small')
  help.textContent = t('editor.itemsHelp')
  itemsLabel.append(items, help)

  const eliminationLabel = document.createElement('label')
  eliminationLabel.className = 'toggle-row'
  const elimination = document.createElement('input')
  elimination.type = 'checkbox'
  elimination.checked = preset?.elimination ?? false
  eliminationLabel.append(elimination, document.createTextNode(t('editor.elimination')))

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
        items: parseBulkItems(items.value),
        elimination: elimination.checked
      }
      const next = preset ? updatePreset(preset, input) : createPreset(input)
      save(next, preset)
      dialog.close()
    } catch (caught) {
      if (caught instanceof PresetValidationError) {
        error.textContent = t(caught.code === 'name-required' ? 'editor.error.name' : 'editor.error.items')
      } else {
        throw caught
      }
    }
  })
  dialog.addEventListener('close', () => dialog.remove())
  form.append(title, nameLabel, itemsLabel, eliminationLabel, error, actions)
  dialog.append(form)
  host.append(dialog)
  dialog.showModal()
  name.focus()
}
