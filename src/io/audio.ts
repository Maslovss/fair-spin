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

  reelTick(speed: number, enabled: boolean, view: 'slot' | 'strip'): void {
    if (!enabled || !this.context) return
    const now = this.context.currentTime
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    const normalized = Math.min(1, Math.abs(speed) / 23)
    oscillator.type = view === 'slot' ? 'square' : 'triangle'
    oscillator.frequency.setValueAtTime(
      (view === 'slot' ? 125 : 185) + normalized * (view === 'slot' ? 180 : 240),
      now
    )
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(view === 'slot' ? 0.045 : 0.025, now + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025)
    oscillator.connect(gain)
    gain.connect(this.context.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.03)
  }

  leverRelease(enabled: boolean): void {
    if (!enabled || !this.context) return
    const now = this.context.currentTime
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = 'square'
    oscillator.frequency.setValueAtTime(95, now)
    oscillator.frequency.exponentialRampToValueAtTime(55, now + 0.055)
    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065)
    oscillator.connect(gain)
    gain.connect(this.context.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.07)
  }

  cardShuffle(enabled: boolean): void {
    if (!enabled || !this.context) return
    const now = this.context.currentTime
    const buffer = this.context.createBuffer(1, Math.ceil(this.context.sampleRate * 0.16), this.context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let index = 0; index < data.length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / data.length)
    }
    const source = this.context.createBufferSource()
    const gain = this.context.createGain()
    source.buffer = buffer
    gain.gain.setValueAtTime(0.055, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)
    source.connect(gain)
    gain.connect(this.context.destination)
    source.start(now)
  }

  cardCut(enabled: boolean): void {
    if (!enabled || !this.context) return
    const now = this.context.currentTime
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = 'square'
    oscillator.frequency.setValueAtTime(145, now)
    oscillator.frequency.exponentialRampToValueAtTime(85, now + 0.035)
    gain.gain.setValueAtTime(0.06, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045)
    oscillator.connect(gain)
    gain.connect(this.context.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.05)
  }

  cardFlip(enabled: boolean): void {
    if (!enabled || !this.context) return
    const now = this.context.currentTime
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = 'triangle'
    oscillator.frequency.setValueAtTime(210, now)
    oscillator.frequency.exponentialRampToValueAtTime(115, now + 0.09)
    gain.gain.setValueAtTime(0.05, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)
    oscillator.connect(gain)
    gain.connect(this.context.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.11)
  }
}
