import type { Translate } from '../io/i18n'

export const renderCemetery = (
  items: readonly string[],
  t: Translate,
  onCopy: () => void
): HTMLElement => {
  const section = document.createElement('aside')
  section.className = 'cemetery'
  const header = document.createElement('div')
  header.className = 'cemetery-header'
  const title = document.createElement('h2')
  title.textContent = t('round.cemetery')
  const copy = document.createElement('button')
  copy.type = 'button'
  copy.className = 'text-button'
  copy.textContent = t('round.copy')
  copy.disabled = items.length === 0
  copy.addEventListener('click', onCopy)
  header.append(title, copy)
  section.append(header)
  if (items.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'cemetery-empty'
    empty.textContent = t('round.cemeteryEmpty')
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
