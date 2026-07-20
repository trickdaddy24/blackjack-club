// Synthesized casino sound effects — Web Audio API, no assets.
// All triggers come from user gestures (clicks), so the AudioContext can be
// created/resumed lazily without tripping autoplay policies.

const MUTE_KEY = "bj-muted";

class Sounds {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private _muted = false;

  constructor() {
    if (typeof window !== "undefined") {
      this._muted = localStorage.getItem(MUTE_KEY) === "1";
    }
  }

  get muted() {
    return this._muted;
  }

  setMuted(m: boolean) {
    this._muted = m;
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  }

  private ensure(): AudioContext | null {
    if (typeof window === "undefined" || this._muted) return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Single oscillator blip with exponential decay. */
  private tone(
    freq: number,
    {
      type = "sine",
      delay = 0,
      dur = 0.15,
      vol = 0.5,
      glideTo,
    }: {
      type?: OscillatorType;
      delay?: number;
      dur?: number;
      vol?: number;
      glideTo?: number;
    } = {}
  ) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Band-passed noise burst — the basis of card swishes. */
  private swish(
    { delay = 0, dur = 0.09, freq = 1800, vol = 0.35 } = {}
  ) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + delay;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len); // built-in decay
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
  }

  /** Ceramic chip clink — two detuned high blips. */
  chip(delay = 0) {
    this.tone(2100, { type: "triangle", delay, dur: 0.06, vol: 0.3 });
    this.tone(2740, { type: "sine", delay: delay + 0.02, dur: 0.08, vol: 0.18 });
  }

  /** Card leaving the shoe. */
  deal(delay = 0) {
    this.swish({ delay, dur: 0.09, freq: 1800, vol: 0.32 });
  }

  /** Hole-card flip — swish plus a snap. */
  flip(delay = 0) {
    this.swish({ delay, dur: 0.07, freq: 2400, vol: 0.3 });
    this.tone(1300, { type: "triangle", delay: delay + 0.04, dur: 0.05, vol: 0.15 });
  }

  /** Winning hand — ascending major arpeggio. */
  win(delay = 0) {
    const notes = [523.25, 659.25, 783.99]; // C5 E5 G5
    notes.forEach((f, i) =>
      this.tone(f, { type: "triangle", delay: delay + i * 0.09, dur: 0.28, vol: 0.35 })
    );
  }

  /** Natural blackjack — longer fanfare up to C6 with shimmer. */
  blackjack(delay = 0) {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((f, i) => {
      this.tone(f, { type: "triangle", delay: delay + i * 0.11, dur: 0.34, vol: 0.35 });
      this.tone(f * 2, { type: "sine", delay: delay + i * 0.11 + 0.03, dur: 0.2, vol: 0.1 });
    });
  }

  /** House wins — arcade "death" warble: a wobbling square-wave sweep
   *  diving down the register, capped with two little blips. */
  lose(delay = 0) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + delay;
    const dur = 1.0;

    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(780, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + dur);

    // Pitch wobble — the siren-like warble as it falls
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(13, t);
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.setValueAtTime(70, t);
    lfoDepth.gain.linearRampToValueAtTime(20, t + dur);
    lfo.connect(lfoDepth).connect(osc.frequency);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.setValueAtTime(0.12, t + dur - 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    lfo.start(t);
    lfo.stop(t + dur);

    // Final "bwip bwip"
    this.tone(160, { type: "square", delay: delay + dur + 0.06, dur: 0.1, vol: 0.12, glideTo: 420 });
    this.tone(160, { type: "square", delay: delay + dur + 0.24, dur: 0.1, vol: 0.12, glideTo: 420 });
  }

  /** Push — single neutral mid blip. */
  push(delay = 0) {
    this.tone(440, { type: "triangle", delay, dur: 0.14, vol: 0.22 });
    this.tone(440, { type: "triangle", delay: delay + 0.16, dur: 0.14, vol: 0.16 });
  }

  /** Side bet hits — bright sparkling run + shimmer, distinct from a hand win. */
  sideBet(delay = 0) {
    const run = [659.25, 783.99, 987.77, 1318.5, 1567.98]; // E5 G5 B5 E6 G6
    run.forEach((f, i) => {
      this.tone(f, { type: "triangle", delay: delay + i * 0.07, dur: 0.22, vol: 0.32 });
      this.tone(f * 2, { type: "sine", delay: delay + i * 0.07 + 0.02, dur: 0.12, vol: 0.1 });
    });
    // Coin shimmer on top
    for (let i = 0; i < 5; i++) {
      this.tone(2400 + Math.random() * 1200, {
        type: "sine",
        delay: delay + 0.3 + i * 0.05,
        dur: 0.08,
        vol: 0.12,
      });
    }
  }

  /** Fresh shoe — riffle of rapid card swishes capped by a square-up tap. */
  shuffle(delay = 0) {
    for (let i = 0; i < 10; i++) {
      const jitter = Math.random() * 0.03;
      this.swish({
        delay: delay + i * 0.09 + jitter,
        dur: 0.07,
        freq: 1400 + i * 120, // rising as the riffle tightens
        vol: 0.22,
      });
    }
    this.tone(900, { type: "triangle", delay: delay + 1.05, dur: 0.06, vol: 0.2 });
  }

  /** Pit Boss console — neutral confirm ding for a routine successful
   *  mutation (chip adjust, unban, trophy grant/revoke). Deliberately not
   *  a casino sound — clean two-note UI tone, not a chip clink or arpeggio. */
  adminConfirm(delay = 0) {
    this.tone(880, { type: "sine", delay, dur: 0.08, vol: 0.22 });
    this.tone(1174.66, { type: "sine", delay: delay + 0.07, dur: 0.12, vol: 0.18 });
  }

  /** Pit Boss console — stern low buzz for a serious/punitive action
   *  (ban, purge) or a failed mutation. Short and blunt, not the dramatic
   *  one-second `lose()` warble used at the game table. */
  adminWarn(delay = 0) {
    this.tone(220, { type: "square", delay, dur: 0.16, vol: 0.16, glideTo: 150 });
  }

  /** Pit Boss console — two quick mechanical ticks, for a credential
   *  change (Set PW). Evokes a lock turning, not a chip or card sound. */
  adminLock(delay = 0) {
    this.tone(1800, { type: "square", delay, dur: 0.02, vol: 0.18 });
    this.tone(1400, { type: "square", delay: delay + 0.09, dur: 0.03, vol: 0.16 });
  }

  /** Bonus chips — little coin cascade. */
  coins(delay = 0) {
    for (let i = 0; i < 6; i++) {
      const f = 1900 + Math.random() * 900;
      this.tone(f, { type: "sine", delay: delay + i * 0.06, dur: 0.09, vol: 0.2 });
    }
    this.win(delay + 0.4);
  }
}

export const sounds = new Sounds();
