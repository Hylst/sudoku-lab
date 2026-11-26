export class SoundEngine {
  private audio: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicStarted = false;
  private _muted = false;
  private musicInterval: number | null = null;
  private activeOscillators: OscillatorNode[] = [];
  private chordIndex = 0;

  init() {
    if (this.audio) return;
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audio = new Ctor();
      this.masterGain = this.audio.createGain();
      this.masterGain.gain.value = 0.6;
      this.masterGain.connect(this.audio.destination);

      this.musicGain = this.audio.createGain();
      this.musicGain.gain.value = 0.14;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.audio.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.masterGain);
    } catch {
      this.audio = null;
    }
  }

  resume() {
    if (this.audio && this.audio.state === "suspended") {
      void this.audio.resume();
    }
  }

  get muted() {
    return this._muted;
  }

  setMuted(muted: boolean) {
    this._muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.6, this.audio!.currentTime, 0.1);
    }
  }

  startAmbient() {
    if (!this.audio || !this.musicGain || this.musicStarted) return;
    this.musicStarted = true;
    const ctx = this.audio;

    // Deep pad drone : 3 layers with slow LFO modulation
    const padFreqs = [82.41, 123.47, 164.81]; // E2, B2, E3
    padFreqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.value = 0.04;

      // Slow LFO
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.06 + idx * 0.02;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.015;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);

      // Sub harmonics
      const sub = ctx.createOscillator();
      sub.type = "triangle";
      sub.frequency.value = freq * 2.003;
      const subGain = ctx.createGain();
      subGain.gain.value = 0.015;
      sub.connect(subGain);
      subGain.connect(this.musicGain!);

      osc.connect(gain);
      gain.connect(this.musicGain!);
      osc.start();
      lfo.start();
      sub.start();
      this.activeOscillators.push(osc, lfo, sub);
    });

    // Evolving arpeggios with chord progressions
    const chordProgressions = [
      [329.63, 392.0, 493.88, 587.33], // Em7
      [293.66, 369.99, 440.0, 554.37],  // Dm9
      [261.63, 329.63, 392.0, 493.88],  // Cmaj7
      [349.23, 440.0, 523.25, 659.25],  // Fmaj7
      [293.66, 349.23, 440.0, 523.25],  // Dm7
      [246.94, 311.13, 369.99, 466.16], // Bm7
    ];

    const playArpNote = () => {
      if (!this.audio || !this.musicGain || this._muted) return;
      const chord = chordProgressions[this.chordIndex % chordProgressions.length];
      const freq = chord[Math.floor(Math.random() * chord.length)];
      const octaveShift = Math.random() > 0.7 ? 2 : 1;
      const finalFreq = freq * octaveShift;

      const osc = this.audio.createOscillator();
      osc.type = Math.random() > 0.5 ? "triangle" : "sine";
      osc.frequency.value = finalFreq;

      const gain = this.audio.createGain();
      const vol = 0.02 + Math.random() * 0.025;
      const dur = 2.5 + Math.random() * 2.5;
      gain.gain.setValueAtTime(0, this.audio.currentTime);
      gain.gain.linearRampToValueAtTime(vol, this.audio.currentTime + 0.5);
      gain.gain.setValueAtTime(vol, this.audio.currentTime + dur * 0.6);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audio.currentTime + dur);

      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start();
      osc.stop(this.audio.currentTime + dur + 0.1);
    };

    // Change chord every ~12 seconds
    window.setInterval(() => {
      this.chordIndex += 1;
    }, 12000);

    this.musicInterval = window.setInterval(playArpNote, 1600 + Math.random() * 600);
    // Also start immediately
    playArpNote();
  }

  stopAmbient() {
    this.musicStarted = false;
    if (this.musicInterval) {
      window.clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    this.activeOscillators.forEach((o) => {
      try { o.stop(); } catch { /* noop */ }
    });
    this.activeOscillators = [];
  }

  private blip(opts: {
    frequency: number;
    duration?: number;
    type?: OscillatorType;
    volume?: number;
    attack?: number;
    detune?: number;
  }) {
    if (!this.audio || !this.sfxGain || this._muted) return;
    const ctx = this.audio;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type ?? "sine";
    osc.frequency.value = opts.frequency;
    if (opts.detune) osc.detune.value = opts.detune;
    const dur = opts.duration ?? 0.18;
    const vol = opts.volume ?? 0.3;
    const attack = opts.attack ?? 0.005;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.05);
  }

  select() {
    this.blip({ frequency: 784, duration: 0.06, volume: 0.09, type: "sine" });
  }

  place(value: number) {
    // Pitch varies by number for fun
    const base = 440 + value * 60;
    this.blip({ frequency: base, duration: 0.1, volume: 0.14, type: "triangle" });
    window.setTimeout(
      () => this.blip({ frequency: base * 1.5, duration: 0.07, volume: 0.08, type: "triangle" }),
      50,
    );
  }

  erase() {
    this.blip({ frequency: 260, duration: 0.14, volume: 0.12, type: "sawtooth" });
  }

  conflict() {
    this.blip({ frequency: 160, duration: 0.25, volume: 0.2, type: "sawtooth" });
    window.setTimeout(
      () => this.blip({ frequency: 120, duration: 0.2, volume: 0.15, type: "sawtooth", detune: -20 }),
      70,
    );
  }

  hint() {
    [587, 740, 880].forEach((freq, idx) => {
      window.setTimeout(
        () => this.blip({ frequency: freq, duration: 0.2, volume: 0.18, type: "sine" }),
        idx * 80,
      );
    });
  }

  undo() {
    this.blip({ frequency: 440, duration: 0.08, volume: 0.1, type: "square" });
    window.setTimeout(
      () => this.blip({ frequency: 330, duration: 0.06, volume: 0.08, type: "square" }),
      40,
    );
  }

  victory() {
    const notes = [523, 659, 784, 880, 1046, 1318];
    notes.forEach((freq, idx) => {
      window.setTimeout(() => {
        this.blip({ frequency: freq, duration: 0.5, volume: 0.28, type: "triangle" });
        this.blip({ frequency: freq * 1.002, duration: 0.5, volume: 0.18, type: "sine", detune: 5 });
      }, idx * 120);
    });
  }

  levelUp() {
    [440, 554, 659, 880, 1046].forEach((freq, idx) => {
      window.setTimeout(
        () => this.blip({ frequency: freq, duration: 0.2, volume: 0.2, type: "sine" }),
        idx * 70,
      );
    });
  }

  navigate() {
    this.blip({ frequency: 1200, duration: 0.03, volume: 0.04, type: "sine" });
  }

  onboardClick() {
    this.blip({ frequency: 920, duration: 0.08, volume: 0.12, type: "triangle" });
    window.setTimeout(
      () => this.blip({ frequency: 1100, duration: 0.06, volume: 0.08, type: "sine" }),
      40,
    );
  }
}
