export class TickAudio {
  private context: AudioContext | null = null

  unlock(): void {
    if (this.context) {
      void this.context.resume()
      return
    }
    const AudioContextClass = window.AudioContext
    this.context = new AudioContextClass()
    void this.context.resume()
  }

  tick(speed: number, enabled: boolean): void {
    if (!enabled || !this.context) return
    const now = this.context.currentTime
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    const normalized = Math.min(1, Math.abs(speed) / 23)
    oscillator.type = 'triangle'
    oscillator.frequency.setValueAtTime(230 + normalized * 620, now)
    oscillator.frequency.exponentialRampToValueAtTime(180 + normalized * 360, now + 0.035)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.003)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04)
    oscillator.connect(gain)
    gain.connect(this.context.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.045)
  }

  sigh(enabled: boolean): void {
    if (!enabled || !this.context) return
    const now = this.context.currentTime
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(180, now)
    oscillator.frequency.exponentialRampToValueAtTime(95, now + 0.18)
    gain.gain.setValueAtTime(0.04, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
    oscillator.connect(gain)
    gain.connect(this.context.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.21)
  }
}
