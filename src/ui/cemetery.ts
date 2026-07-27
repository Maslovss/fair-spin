import type { Translate } from '../io/i18n'

export const renderCemetery = (
  items: readonly string[],
  t: Translate,
  onCopy: () => void,
  onReset: () => void
): HTMLElement => {
  const section = document.createElement('aside')
  section.className = 'cemetery'
  const header = document.createElement('div')
  header.className = 'cemetery-header'
  const title = document.createElement('h2')
  title.textContent = t('round.order')
  const copy = document.createElement('button')
  copy.type = 'button'
  copy.className = 'text-button'
  copy.textContent = t('round.copy')
  copy.disabled = items.length === 0
  copy.addEventListener('click', onCopy)
  const actions = document.createElement('div')
  actions.className = 'cemetery-actions'
  if (items.length > 0) {
    const reset = document.createElement('button')
    reset.type = 'button'
    reset.className = 'text-button danger'
    reset.textContent = t('round.reset')
    reset.addEventListener('click', onReset)
    actions.append(reset)
  }
  actions.append(copy)
  header.append(title, actions)
  section.append(header)
  if (items.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'cemetery-empty'
    empty.textContent = t('round.orderEmpty')
    section.append(empty)
  } else {
    const list = document.createElement('ol')
    items.forEach((item) => {
      const entry = document.createElement('li')
      entry.textContent = item
      list.append(entry)
    })
    section.append(list)
  }
  return section
}
