export const vibrateTick = (enabled: boolean): void => {
  if (!enabled || typeof navigator.vibrate !== 'function') return
  navigator.vibrate(8)
}

export const vibrateWeak = (enabled: boolean): void => {
  if (!enabled || typeof navigator.vibrate !== 'function') return
  navigator.vibrate([18, 40, 12])
}
