import en from '../locales/en.json'
import uk from '../locales/uk.json'
import type { Language } from '../state/types'

export type TranslationKey = keyof typeof en
type Variables = Record<string, string | number>

const dictionaries: Record<Language, Record<TranslationKey, string>> = { en, uk }

export const detectLanguage = (languages: readonly string[] = navigator.languages): Language =>
  languages.some((language) => language.toLowerCase().startsWith('uk')) ? 'uk' : 'en'

export const translator = (language: Language) =>
  (key: TranslationKey, variables: Variables = {}): string => {
    const template = dictionaries[language][key] ?? dictionaries.en[key]
    return Object.entries(variables).reduce(
      (value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)),
      template
    )
  }

export type Translate = ReturnType<typeof translator>

export const relativeTime = (timestamp: number, language: Language, now = Date.now()): string => {
  const seconds = Math.round((timestamp - now) / 1_000)
  if (Math.abs(seconds) < 45) return translator(language)('time.now')
  const formatter = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })
  if (Math.abs(seconds) < 3_600) return formatter.format(Math.round(seconds / 60), 'minute')
  if (Math.abs(seconds) < 86_400) return formatter.format(Math.round(seconds / 3_600), 'hour')
  return formatter.format(Math.round(seconds / 86_400), 'day')
}
