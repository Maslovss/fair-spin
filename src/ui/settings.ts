import type { Translate } from '../io/i18n'
import type { Settings } from '../state/types'

export const openSettings = (
  host: HTMLElement,
  settings: Settings,
  t: Translate,
  update: (settings: Settings, redraw: boolean) => void,
  addStarterQuestions: () => number
): void => {
  let current = { ...settings }
  const dialog = document.createElement('dialog')
  dialog.className = 'dialog settings-dialog'
  const form = document.createElement('form')
  form.method = 'dialog'
  const title = document.createElement('h2')
  title.textContent = t('settings.title')

  const toggle = (label: string, checked: boolean, onChange: (value: boolean) => void) => {
    const row = document.createElement('label')
    row.className = 'settings-row'
    row.append(document.createTextNode(label))
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.role = 'switch'
    input.checked = checked
    input.addEventListener('change', () => onChange(input.checked))
    row.append(input)
    return row
  }
  form.append(
    title,
    toggle(t('settings.sound'), current.sound, (sound) => {
      current = { ...current, sound }
      update(current, false)
    }),
    toggle(t('settings.haptics'), current.haptics, (haptics) => {
      current = { ...current, haptics }
      update(current, false)
    })
  )
  const languageLabel = document.createElement('label')
  languageLabel.className = 'settings-language'
  languageLabel.textContent = t('settings.language')
  const language = document.createElement('select')
  language.append(new Option(t('settings.uk'), 'uk'), new Option(t('settings.en'), 'en'))
  language.value = settings.lang
  language.addEventListener('change', () => {
    current = { ...current, lang: language.value === 'uk' ? 'uk' : 'en' }
    update(current, true)
    dialog.close()
  })
  languageLabel.append(language)
  const starterStatus = document.createElement('p')
  starterStatus.className = 'settings-status'
  starterStatus.setAttribute('role', 'status')
  const addStarters = document.createElement('button')
  addStarters.type = 'button'
  addStarters.className = 'button button-quiet settings-starters'
  addStarters.textContent = t('settings.addStarters')
  addStarters.addEventListener('click', () => {
    const added = addStarterQuestions()
    starterStatus.textContent = t(
      added > 0 ? 'settings.startersAdded' : 'settings.startersComplete',
      { count: added }
    )
  })
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'button button-primary settings-close'
  close.textContent = t('settings.close')
  close.addEventListener('click', () => dialog.close())
  form.append(languageLabel, addStarters, starterStatus, close)
  dialog.append(form)
  dialog.addEventListener('close', () => {
    dialog.remove()
    update(current, true)
  })
  host.append(dialog)
  dialog.showModal()
}
