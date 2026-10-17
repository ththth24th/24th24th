export interface AudioState {
  speed: number;
  throttle: number;
  rain: number;
  wind: number;
  spraying: boolean;
  playing: boolean;
  daylight: number;
}

type Cue = 'click' | 'success' | 'scan' | 'error';
type NoiseLayer = { source: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode };

const clamp = (value: number, min = 0, max = 1): number =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;

/** Entirely synthesized, deliberately quiet farm ambience. Call start from a user gesture. */
export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: GainNode | null = null;
  private motorGain: GainNode | null = null;
  private motorFilter: BiquadFilterNode | null = null;
  private readonly motors: OscillatorNode[] = [];
  private readonly noiseLayers: NoiseLayer[] = [];
  private readonly voices = new Map<OscillatorNode, GainNode>();
  private windLayer: NoiseLayer | null = null;
  private leavesLayer: NoiseLayer | null = null;
  private rainLayer: NoiseLayer | null = null;
  private sprayLayer: NoiseLayer | null = null;
  private thunderLayer: NoiseLayer | null = null;
  private volume = 0.35;
  private phase = 0;
  private birdTimer = 7;
  private thunderTimer = 27;
  private lastCueAt = -1;
  private disposed = false;

  /** Unsupported or blocked audio leaves the game fully usable without sound. */
  async start(): Promise<void> {
    if (this.disposed) return;
    if (!this.context) {
      if (typeof window === 'undefined') return;
      const Constructor = window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) return;
      try {
        this.context = new Constructor({ latencyHint: 'interactive' });
        this.build(this.context);
      } catch {
        this.disposeGraph();
        return;
      }
    }
    try {
      if (this.context.state === 'suspended') await this.context.resume();
    } catch {
      // A later explicit user gesture can retry resume without creating a second graph.
    }
  }

  setVolume(value: number): void {
    this.volume = clamp(value);
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(this.volume * 0.55, this.context.currentTime, 0.06);
    }
  }

  update(dt: number, state: AudioState): void {
    const context = this.context;
    if (!context || context.state !== 'running' || !this.ambience) return;
    const elapsed = clamp(dt, 0, 0.1);
    const now = context.currentTime;
    const throttle = clamp(Math.abs(state.throttle));
    const speed = clamp(Math.abs(state.speed) / 18);
    const rain = clamp(state.rain);
    const wind = clamp(state.wind);
    const daylight = clamp(state.daylight);
    this.phase = (this.phase + elapsed) % 1000;
    const breeze = 0.78 + Math.sin(this.phase * 0.23) * 0.13 + Math.sin(this.phase * 0.61) * 0.09;

    this.ambience.gain.setTargetAtTime(state.playing ? 1 : 0, now, 0.35);
    const rpm = 86 + throttle * 92 + speed * 24;
    for (let i = 0; i < this.motors.length; i++) {
      this.motors[i].frequency.setTargetAtTime(rpm * (i === 2 ? 2 : 1), now, 0.13);
    }
    this.motorGain?.gain.setTargetAtTime(0.047 + throttle * 0.045 + speed * 0.017, now, 0.15);
    this.motorFilter?.frequency.setTargetAtTime(370 + throttle * 600 + speed * 130, now, 0.2);
    this.windLayer?.gain.gain.setTargetAtTime((0.009 + wind * 0.044 + speed * 0.015) * breeze, now, 0.6);
    this.windLayer?.filter.frequency.setTargetAtTime(230 + wind * 440 + speed * 100, now, 0.6);
    this.leavesLayer?.gain.gain.setTargetAtTime(wind * 0.014 * breeze, now, 0.8);
    this.rainLayer?.gain.gain.setTargetAtTime(rain * rain * 0.065, now, 0.7);
    this.rainLayer?.filter.frequency.setTargetAtTime(2400 + rain * 1400, now, 0.8);
    this.sprayLayer?.gain.gain.setTargetAtTime(state.spraying ? 0.034 : 0, now, 0.12);

    if (!state.playing) return;
    this.birdTimer -= elapsed;
    this.thunderTimer -= elapsed;
    if (this.birdTimer <= 0) {
      this.birdTimer = 13 + Math.random() * 23;
      if (daylight > 0.38 && rain < 0.55) this.bird(now);
    }
    if (this.thunderTimer <= 0) {
      this.thunderTimer = 32 + Math.random() * 45;
      if (rain > 0.8 && this.thunderLayer) {
        const gain = this.thunderLayer.gain.gain;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(0, now);
        gain.linearRampToValueAtTime(0.055, now + 0.65);
        gain.linearRampToValueAtTime(0.028, now + 1.7);
        gain.linearRampToValueAtTime(0, now + 5.5);
      }
    }
  }

  cue(kind: Cue): void {
    const context = this.context;
    if (!context || context.state !== 'running' || !this.master) return;
    const now = context.currentTime;
    // Avoid stacking a burst of UI events into an unexpectedly loud click.
    if (now - this.lastCueAt < 0.035) return;
    this.lastCueAt = now;
    if (kind === 'success') {
      this.tone(523.25, now, 0.58, 0.07);
      this.tone(659.25, now + 0.12, 0.6, 0.055);
      this.tone(783.99, now + 0.26, 0.8, 0.045);
    } else if (kind === 'scan') {
      this.tone(420, now, 0.26, 0.04, 950);
      this.tone(1260, now + 0.2, 0.2, 0.025);
    } else if (kind === 'error') {
      this.tone(220, now, 0.18, 0.045, 174);
      this.tone(174, now + 0.16, 0.25, 0.035);
    } else {
      this.tone(680, now, 0.045, 0.035, 510);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.disposeGraph();
  }

  private build(context: AudioContext): void {
    const master = context.createGain();
    master.gain.value = this.volume * 0.55;
    this.master = master;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -15;
    limiter.knee.value = 12;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.008;
    limiter.release.value = 0.22;
    master.connect(limiter);
    limiter.connect(context.destination);

    this.ambience = context.createGain();
    this.ambience.gain.value = 0;
    this.ambience.connect(master);
    this.motorGain = context.createGain();
    this.motorGain.gain.value = 0;
    this.motorFilter = context.createBiquadFilter();
    this.motorFilter.type = 'lowpass';
    this.motorFilter.frequency.value = 300;
    this.motorFilter.Q.value = 0.55;
    this.motorFilter.connect(this.motorGain);
    this.motorGain.connect(this.ambience);

    // Slightly detuned harmonic rotors give the quadcopter a soft mechanical hum.
    const real = new Float32Array(9);
    const imaginary = new Float32Array([0, 1, 0.36, 0.19, 0.09, 0.045, 0.022, 0.01, 0.005]);
    const motorWave = context.createPeriodicWave(real, imaginary);
    for (let i = 0; i < 3; i++) {
      const oscillator = context.createOscillator();
      if (i === 2) oscillator.type = 'sine';
      else oscillator.setPeriodicWave(motorWave);
      oscillator.frequency.value = i === 2 ? 172 : 86;
      oscillator.detune.value = i === 0 ? -5 : i === 1 ? 5 : 0;
      const gain = context.createGain();
      gain.gain.value = i === 0 ? 0.55 : i === 1 ? 0.25 : 0.2;
      oscillator.connect(gain);
      gain.connect(this.motorFilter);
      oscillator.start();
      this.motors.push(oscillator);
    }

    // Generate one seamless reusable noise buffer; every ambience layer loops it.
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 4), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    this.windLayer = this.noise(buffer, 'lowpass', 420, 0.6, 0);
    this.leavesLayer = this.noise(buffer, 'bandpass', 1900, 0.5, 0.71);
    this.rainLayer = this.noise(buffer, 'lowpass', 3200, 0.5, 1.38);
    this.sprayLayer = this.noise(buffer, 'bandpass', 2600, 0.75, 2.11);
    this.thunderLayer = this.noise(buffer, 'lowpass', 105, 0.65, 3.04);
  }

  private noise(buffer: AudioBuffer, type: BiquadFilterType, frequency: number, q: number, offset: number): NoiseLayer {
    const context = this.context!;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const gain = context.createGain();
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambience!);
    source.start(0, offset);
    const layer = { source, filter, gain };
    this.noiseLayers.push(layer);
    return layer;
  }

  private tone(frequency: number, when: number, duration: number, level: number, endFrequency?: number): void {
    const context = this.context;
    if (!context || !this.master || this.voices.size + this.motors.length >= 10) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, when);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, when + duration * 0.85);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(level, when + Math.min(0.012, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    this.voices.set(oscillator, gain);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      this.voices.delete(oscillator);
    };
    oscillator.start(when);
    oscillator.stop(when + duration + 0.02);
  }

  private bird(when: number): void {
    const context = this.context;
    if (!context || !this.ambience || this.voices.size + this.motors.length >= 10) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const base = 1850 + Math.random() * 650;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(base, when);
    oscillator.frequency.exponentialRampToValueAtTime(base * 1.43, when + 0.075);
    oscillator.frequency.exponentialRampToValueAtTime(base * 0.93, when + 0.16);
    oscillator.frequency.setValueAtTime(base * 1.08, when + 0.29);
    oscillator.frequency.exponentialRampToValueAtTime(base * 1.47, when + 0.36);
    oscillator.frequency.exponentialRampToValueAtTime(base, when + 0.47);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(0.014, when + 0.025);
    gain.gain.linearRampToValueAtTime(0, when + 0.18);
    gain.gain.setValueAtTime(0, when + 0.28);
    gain.gain.linearRampToValueAtTime(0.011, when + 0.31);
    gain.gain.linearRampToValueAtTime(0, when + 0.49);
    oscillator.connect(gain);
    gain.connect(this.ambience);
    this.voices.set(oscillator, gain);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      this.voices.delete(oscillator);
    };
    oscillator.start(when);
    oscillator.stop(when + 0.52);
  }

  private disposeGraph(): void {
    const context = this.context;
    this.context = null;
    for (const oscillator of this.motors) {
      try { oscillator.stop(); } catch { /* Already stopped. */ }
      oscillator.disconnect();
    }
    this.motors.length = 0;
    for (const [oscillator, gain] of this.voices) {
      oscillator.onended = null;
      try { oscillator.stop(); } catch { /* Already stopped. */ }
      oscillator.disconnect();
      gain.disconnect();
    }
    this.voices.clear();
    for (const layer of this.noiseLayers) {
      try { layer.source.stop(); } catch { /* Already stopped. */ }
      layer.source.disconnect();
      layer.filter.disconnect();
      layer.gain.disconnect();
    }
    this.noiseLayers.length = 0;
    this.master?.disconnect();
    this.master = this.ambience = this.motorGain = null;
    this.motorFilter = null;
    this.windLayer = this.leavesLayer = this.rainLayer = this.sprayLayer = this.thunderLayer = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }
}
