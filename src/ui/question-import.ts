import type { Translate } from '../io/i18n'
import {
  compareImportedQuestion,
  type SharedQuestion
} from '../io/question-share'
import type { Preset } from '../state/types'

interface ImportActions {
  add(question: SharedQuestion): void
  replace(existing: Preset, question: SharedQuestion): void
  cancel(): void
}

const button = (
  text: string,
  className: string,
  action: () => void
): HTMLButtonElement => {
  const element = document.createElement('button')
  element.type = 'button'
  element.className = className
  element.textContent = text
  element.addEventListener('click', action)
  return element
}

const questionPreview = (
  question: SharedQuestion,
  t: Translate
): HTMLElement => {
  const preview = document.createElement('p')
  preview.className = 'import-preview'
  preview.textContent = t('share.importPreview', {
    name: question.name,
    count: question.items.length
  })
  return preview
}

export const openQuestionImport = (
  host: HTMLElement,
  t: Translate,
  question: SharedQuestion,
  presets: readonly Preset[],
  actions: ImportActions
): void => {
  const conflict = compareImportedQuestion(presets, question)
  const dialog = document.createElement('dialog')
  dialog.className = 'dialog import-dialog'
  const form = document.createElement('form')
  form.method = 'dialog'
  let decided = false
  const decide = (action: () => void) => {
    if (decided) return
    decided = true
    dialog.close()
    action()
  }
  const title = document.createElement('h2')
  const controls = document.createElement('div')
  controls.className = 'dialog-actions'

  if (conflict.kind === 'new') {
    title.textContent = t('share.importTitle')
    const cancel = button(t('editor.cancel'), 'button button-quiet', () => decide(actions.cancel))
    const add = button(t('share.importAdd'), 'button button-primary', () => {
      decide(() => actions.add(question))
    })
    controls.append(cancel, add)
    form.append(title, questionPreview(question, t), controls)
  } else if (conflict.kind === 'identical') {
    title.textContent = t('share.importExistsTitle')
    const message = document.createElement('p')
    message.textContent = t('share.importExists', { name: question.name })
    const done = button(t('settings.close'), 'button button-primary', () => decide(actions.cancel))
    controls.append(done)
    form.append(title, message, controls)
  } else {
    title.textContent = t('share.importConflictTitle')
    const summary = document.createElement('p')
    summary.textContent = t('share.importDifference', {
      added: conflict.difference.added.length,
      removed: conflict.difference.removed.length
    })
    const difference = document.createElement('div')
    difference.className = 'import-difference'
    const list = (label: string, items: readonly string[]) => {
      const section = document.createElement('section')
      const heading = document.createElement('h3')
      heading.textContent = label
      const values = document.createElement('ul')
      items.forEach((item) => {
        const entry = document.createElement('li')
        entry.textContent = item
        values.append(entry)
      })
      section.append(heading, values)
      return section
    }
    if (conflict.difference.added.length) {
      difference.append(list(t('share.importAdded'), conflict.difference.added))
    }
    if (conflict.difference.removed.length) {
      difference.append(list(t('share.importRemoved'), conflict.difference.removed))
    }
    const warning = document.createElement('p')
    warning.className = 'import-warning'
    warning.textContent = t('share.importRenameHelp')
    const replace = button(t('share.importReplace'), 'button button-quiet danger', () => {
      if (!window.confirm(t('share.importReplaceConfirm'))) return
      decide(() => actions.replace(conflict.existing, question))
    })
    const cancel = button(t('editor.cancel'), 'button button-primary', () => decide(actions.cancel))
    controls.append(replace, cancel)
    form.append(title, questionPreview(question, t), summary, difference, warning, controls)
  }

  dialog.addEventListener('close', () => {
    if (!decided) actions.cancel()
    dialog.remove()
  }, { once: true })
  dialog.append(form)
  host.append(dialog)
  dialog.showModal()
  controls.querySelector<HTMLButtonElement>('.button-primary')?.focus()
}

export const openQuestionImportError = (
  host: HTMLElement,
  t: Translate,
  newer: boolean,
  done: () => void
): void => {
  const dialog = document.createElement('dialog')
  dialog.className = 'dialog import-dialog'
  const form = document.createElement('form')
  form.method = 'dialog'
  let decided = false
  const finish = () => {
    if (decided) return
    decided = true
    dialog.close()
    done()
  }
  const title = document.createElement('h2')
  title.textContent = t('share.importErrorTitle')
  const message = document.createElement('p')
  message.textContent = t(newer ? 'share.importNewer' : 'share.importInvalid')
  const close = button(t('settings.close'), 'button button-primary', finish)
  form.append(title, message, close)
  dialog.append(form)
  dialog.addEventListener('close', () => {
    if (!decided) done()
    dialog.remove()
  }, { once: true })
  host.append(dialog)
  dialog.showModal()
}
