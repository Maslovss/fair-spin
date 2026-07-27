export const REVEAL_HOLD_MS = 1_000

export type TableLifecycleState =
  | 'idle'
  | 'resolving'
  | 'settling'
  | 'revealing'
  | 'applying'

export interface RevealLifecycleCallbacks<T> {
  onStateChange?(state: TableLifecycleState, result: T | null): void
  onReveal(result: T): void
  onApply(result: T): void
}

export class RevealLifecycle<T> {
  private currentState: TableLifecycleState = 'idle'
  private result: T | null = null
  private hasResult = false
  private revealTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly callbacks: RevealLifecycleCallbacks<T>) {}

  get state(): TableLifecycleState {
    return this.currentState
  }

  tryStart(): boolean {
    if (this.currentState !== 'idle') return false
    this.transition('resolving')
    return true
  }

  cancelStart(): boolean {
    if (this.currentState !== 'resolving' || this.hasResult) return false
    this.transition('idle')
    return true
  }

  resolve(result: T): boolean {
    if (this.currentState !== 'resolving' || this.hasResult) return false
    this.result = result
    this.hasResult = true
    this.transition('settling')
    return true
  }

  settle(): boolean {
    if (this.currentState !== 'settling' || !this.hasResult) return false
    const result = this.result as T
    this.transition('revealing')
    this.callbacks.onReveal(result)
    this.revealTimer = setTimeout(() => this.finishReveal(), REVEAL_HOLD_MS)
    return true
  }

  skipReveal(): boolean {
    if (this.currentState !== 'revealing') return false
    this.finishReveal()
    return true
  }

  completeApplying(): boolean {
    if (this.currentState !== 'applying') return false
    this.result = null
    this.hasResult = false
    this.transition('idle')
    return true
  }

  destroy(): void {
    this.clearRevealTimer()
  }

  private finishReveal(): void {
    if (this.currentState !== 'revealing' || !this.hasResult) return
    this.clearRevealTimer()
    const result = this.result as T
    this.transition('applying')
    this.callbacks.onApply(result)
  }

  private clearRevealTimer(): void {
    if (this.revealTimer !== null) clearTimeout(this.revealTimer)
    this.revealTimer = null
  }

  private transition(state: TableLifecycleState): void {
    this.currentState = state
    this.callbacks.onStateChange?.(state, this.hasResult ? this.result : null)
  }
}
