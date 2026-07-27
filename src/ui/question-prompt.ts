import type { Translate } from '../io/i18n'
import { questionTemplateParts } from '../core/question'

const MAX_COMPLETION_LENGTH = 120

const placeCaretAtEnd = (element: HTMLElement): void => {
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.selectNodeContents(element)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}

const insertPlainTextAtSelection = (element: HTMLElement, text: string): void => {
  const selection = window.getSelection()
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null
  if (!selection || !range || !element.contains(range.commonAncestorContainer)) {
    element.append(document.createTextNode(text))
    placeCaretAtEnd(element)
    return
  }
  range.deleteContents()
  const node = document.createTextNode(text)
  range.insertNode(node)
  range.setStartAfter(node)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

export const openQuestionPrompt = (
  host: HTMLElement,
  t: Translate,
  template: string,
  confirm: (completion: string) => boolean,
  cancel: () => void
): void => {
  const parts = questionTemplateParts(template)
  if (!parts) throw new TypeError('Question prompt requires a template name')
  const dialog = document.createElement('dialog')
  dialog.className = 'dialog question-dialog'
  const form = document.createElement('form')
  form.method = 'dialog'
  const question = document.createElement('h2')
  question.className = 'question-compose'
  question.id = `question-compose-${crypto.randomUUID()}`
  const before = parts.before && !/\s$/u.test(parts.before)
    ? `${parts.before} `
    : parts.before
  question.append(document.createTextNode(before))
  const input = document.createElement('span')
  input.className = 'question-inline-input'
  input.contentEditable = 'plaintext-only'
  input.role = 'textbox'
  input.setAttribute('aria-label', t('question.inputLabel'))
  input.setAttribute('aria-multiline', 'false')
  input.dataset.placeholder = t('question.placeholder')
  input.dataset.empty = 'true'
  input.spellcheck = true
  question.append(input, document.createTextNode(parts.after))
  dialog.setAttribute('aria-labelledby', question.id)
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
  input.addEventListener('input', () => {
    const value = [...(input.textContent ?? '')].slice(0, MAX_COMPLETION_LENGTH).join('')
    if (input.textContent !== value) {
      input.textContent = value
      placeCaretAtEnd(input)
    }
    input.dataset.empty = String(value.length === 0)
  })
  input.addEventListener('paste', (event) => {
    event.preventDefault()
    const plain = event.clipboardData?.getData('text/plain') ?? ''
    insertPlainTextAtSelection(input, plain)
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }))
  })
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing) return
    event.preventDefault()
    form.requestSubmit()
  })
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    if (confirm((input.textContent ?? '').trim())) dialog.close()
  })
  dialog.addEventListener('close', () => dialog.remove())
  form.append(question, help, actions)
  dialog.append(form)
  host.append(dialog)
  dialog.showModal()
  input.focus()
  placeCaretAtEnd(input)
}
