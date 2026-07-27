import type { Translate } from '../io/i18n'

export const openQuestionPrompt = (
  host: HTMLElement,
  t: Translate,
  confirm: (completion: string) => boolean,
  cancel: () => void
): void => {
  const dialog = document.createElement('dialog')
  dialog.className = 'dialog question-dialog'
  const form = document.createElement('form')
  form.method = 'dialog'
  const title = document.createElement('h2')
  title.textContent = t('question.poseTitle')
  const label = document.createElement('label')
  label.textContent = t('question.completion')
  const input = document.createElement('input')
  input.name = 'question'
  input.maxLength = 120
  input.placeholder = t('question.completionPlaceholder')
  label.append(input)
  const help = document.createElement('small')
  help.textContent = t('question.emptyHelp')
  const actions = document.createElement('div')
  actions.className = 'dialog-actions'
  const cancelButton = document.createElement('button')
  cancelButton.type = 'button'
  cancelButton.className = 'button button-quiet'
  cancelButton.textContent = t('editor.cancel')
  cancelButton.addEventListener('click', () => {
    dialog.close()
    cancel()
  })
  const submit = document.createElement('button')
  submit.type = 'submit'
  submit.className = 'button button-primary'
  submit.textContent = t('question.confirm')
  actions.append(cancelButton, submit)
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    if (confirm(input.value.trim())) dialog.close()
  })
  dialog.addEventListener('close', () => dialog.remove())
  form.append(title, label, help, actions)
  dialog.append(form)
  host.append(dialog)
  dialog.showModal()
  input.focus()
}
