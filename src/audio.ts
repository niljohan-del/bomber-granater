/** Small self-contained synth: no external audio assets needed. */
export class AudioEngine {
  private ctx: AudioContext;
  private master: GainNode;

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
  }

  resume(): void {
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  private noiseBuffer(duration: number): AudioBuffer {
    const n = Math.floor(this.ctx.sampleRate * duration);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  shoot(): void {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, t0);
    osc.frequency.exponentialRampToValueAtTime(90, t0 + 0.18);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);

    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + 0.22);
  }

  explosion(scale = 1): void {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(0.6);
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(2200 * scale, t0);
    noiseFilter.frequency.exponentialRampToValueAtTime(120, t0 + 0.5);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5 * scale, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
    noise.connect(noiseFilter).connect(noiseGain).connect(this.master);

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110 * scale, t0);
    sub.frequency.exponentialRampToValueAtTime(30, t0 + 0.4);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.7, t0);
    subGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
    sub.connect(subGain).connect(this.master);

    noise.start(t0);
    sub.start(t0);
    noise.stop(t0 + 0.6);
    sub.stop(t0 + 0.5);
  }

  close(): void {
    void this.ctx.close();
  }
}
