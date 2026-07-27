const QUESTION_SLOT = /…|\.\.\./u

export const QUESTION_PLACEHOLDERS = [
  '‹задумане›',
  '‹що я загадав›',
  '‹what I have in mind›'
] as const

export const isQuestionTemplate = (name: string): boolean => QUESTION_SLOT.test(name)

export const questionTemplateParts = (
  name: string
): { before: string; after: string } | null => {
  const match = QUESTION_SLOT.exec(name)
  if (!match || match.index === undefined) return null
  return {
    before: name.slice(0, match.index),
    after: name.slice(match.index + match[0].length)
  }
}

export const poseQuestion = (name: string, completion: string): string => {
  const parts = questionTemplateParts(name)
  if (!parts) return name
  const { before, after } = parts
  const separator = completion && before && !/\s$/u.test(before) ? ' ' : ''
  return `${before}${separator}${completion}${after}`
}

export const templatePreview = (
  name: string,
  placeholder: string
): string | null =>
  isQuestionTemplate(name) ? poseQuestion(name, placeholder) : null

export const insertTemplateSlot = (
  name: string,
  cursor: number | null
): { name: string; cursor: number } => {
  if (isQuestionTemplate(name)) {
    return { name, cursor: cursor ?? name.length }
  }
  const position = cursor === null
    ? name.endsWith('?')
      ? name.length - 1
      : name.length
    : Math.max(0, Math.min(name.length, cursor))
  return {
    name: `${name.slice(0, position)}…${name.slice(position)}`,
    cursor: position + 1
  }
}

export const isPlaceholderCompletion = (completion: string | undefined): boolean =>
  completion !== undefined &&
  QUESTION_PLACEHOLDERS.some((placeholder) => placeholder === completion)
