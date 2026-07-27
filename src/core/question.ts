const QUESTION_SLOT = /…|\.\.\./u

export const QUESTION_PLACEHOLDERS = [
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
    before: name.slice(0, match.index).trimEnd(),
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

export const isPlaceholderCompletion = (completion: string | undefined): boolean =>
  completion !== undefined &&
  QUESTION_PLACEHOLDERS.some((placeholder) => placeholder === completion)
