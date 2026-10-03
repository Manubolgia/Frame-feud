/**
 * Procedural audio: every sound is synthesised with WebAudio, so the game
 * ships no audio files and works offline. Music is a small step sequencer
 * whose filter closes while players plan and opens when a turn resolves.
 */

import { onSettings, settings } from '../game/settings';

let ctx: AudioContext | null = null;
let master: GainNode;
let sfxBus: GainNode;
let musicBus: GainNode;
let musicFilter: BiquadFilterNode;
let noiseBuf: AudioBuffer;
let comp: DynamicsCompressorNode;
let unlocked = false;

function ac(): AudioContext | null {
  if (ctx) return ctx;
  if (!unlocked) return null;
  const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  ctx = new C();
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  comp.connect(ctx.destination);
  master = ctx.createGain();
  master.connect(comp);
  sfxBus = ctx.createGain();
  sfxBus.connect(master);
  musicFilter = ctx.createBiquadFilter();
  musicFilter.type = 'lowpass';
  musicFilter.frequency.value = 1200;
  musicFilter.Q.value = 0.7;
  musicBus = ctx.createGain();
  musicBus.connect(musicFilter);
  musicFilter.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes();
  return ctx;
}

function applyVolumes() {
  if (!ctx) return;
  master.gain.value = settings.master;
  sfxBus.gain.value = settings.sfx * 0.9;
  musicBus.gain.value = settings.music * 0.32;
}

onSettings(applyVolumes);

export function unlockAudio() {
  unlocked = true;
  const c = ac();
  if (c && c.state === 'suspended') void c.resume();
}

// ------------------------------------------------------------ voices --

interface ToneOpts {
  type?: OscillatorType;
  f: number;
  f2?: number;
  dur: number;
  vol: number;
  at?: number;
  attack?: number;
  dest?: AudioNode;
  detune?: number;
}

function tone(o: ToneOpts) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + (o.at ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f, t0);
  if (o.detune) osc.detune.value = o.detune;
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + o.dur);
  const atk = o.attack ?? 0.004;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.vol, t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g);
  g.connect(o.dest ?? sfxBus);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.05);
}

interface NoiseOpts {
  dur: number;
  vol: number;
  type?: BiquadFilterType;
  f: number;
  f2?: number;
  q?: number;
  at?: number;
  attack?: number;
  dest?: AudioNode;
}

function noise(o: NoiseOpts) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + (o.at ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const filt = c.createBiquadFilter();
  filt.type = o.type ?? 'bandpass';
  filt.frequency.setValueAtTime(o.f, t0);
  if (o.f2) filt.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + o.dur);
  filt.Q.value = o.q ?? 1;
  const g = c.createGain();
  const atk = o.attack ?? 0.003;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.vol, t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  src.connect(filt);
  filt.connect(g);
  g.connect(o.dest ?? sfxBus);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + o.dur + 0.05);
}

// ------------------------------------------------------------ sfx --

let lastHit = 0;

export const sfx = {
  hit(power: number, kind: string, counter = false) {
    const c = ac();
    if (!c) return;
    // avoid stacking dozens of identical hits in one frame
    if (c.currentTime - lastHit < 0.012) return;
    lastHit = c.currentTime;
    const p = Math.max(0.1, Math.min(1, power / 100));
    tone({ type: 'sine', f: 150 - p * 50, f2: 42, dur: 0.12 + p * 0.18, vol: 0.5 + p * 0.4 });
    tone({ type: 'triangle', f: 320 - p * 120, f2: 90, dur: 0.06 + p * 0.06, vol: 0.25 + p * 0.2 });
    if (kind === 'slash') {
      noise({ type: 'highpass', f: 3000, f2: 6000, dur: 0.12, vol: 0.35 });
      tone({ type: 'sawtooth', f: 1800, f2: 900, dur: 0.07, vol: 0.06 });
    } else if (kind === 'zap') {
      tone({ type: 'square', f: 880, f2: 220, dur: 0.12, vol: 0.09 });
      noise({ type: 'bandpass', f: 4000, dur: 0.1, vol: 0.25, q: 2 });
    } else {
      noise({ type: 'bandpass', f: 1600 + p * 600, f2: 400, dur: 0.07 + p * 0.1, vol: 0.45 + p * 0.3, q: 0.8 });
    }
    if (p > 0.65) noise({ type: 'lowpass', f: 600, f2: 80, dur: 0.35, vol: 0.4 });
    if (counter) tone({ type: 'square', f: 1320, f2: 1980, dur: 0.12, vol: 0.08, at: 0.02 });
  },
  block(power: number) {
    const p = Math.max(0.2, Math.min(1, power / 100));
    tone({ type: 'sine', f: 1250, dur: 0.18, vol: 0.12 });
    tone({ type: 'sine', f: 1870, dur: 0.12, vol: 0.08 });
    noise({ type: 'highpass', f: 2500, dur: 0.05, vol: 0.2 + p * 0.1 });
    tone({ type: 'triangle', f: 220, f2: 120, dur: 0.08, vol: 0.18 });
  },
  parry() {
    tone({ type: 'sine', f: 1760, dur: 0.6, vol: 0.2 });
    tone({ type: 'sine', f: 2637, dur: 0.45, vol: 0.12, at: 0.01 });
    tone({ type: 'triangle', f: 880, f2: 1760, dur: 0.12, vol: 0.12 });
    noise({ type: 'highpass', f: 5000, dur: 0.25, vol: 0.18 });
  },
  armor() {
    tone({ type: 'triangle', f: 300, f2: 180, dur: 0.25, vol: 0.3 });
    tone({ type: 'square', f: 455, dur: 0.12, vol: 0.06 });
    noise({ type: 'bandpass', f: 900, dur: 0.12, vol: 0.3 });
  },
  whiff(heavy = false) {
    noise({ type: 'bandpass', f: heavy ? 300 : 500, f2: heavy ? 900 : 1800, dur: heavy ? 0.22 : 0.13, vol: heavy ? 0.22 : 0.16, q: 1.4, attack: 0.03 });
  },
  jump() {
    noise({ type: 'bandpass', f: 400, f2: 1200, dur: 0.12, vol: 0.12, attack: 0.02 });
    tone({ type: 'sine', f: 220, f2: 440, dur: 0.08, vol: 0.06 });
  },
  land(hard: boolean) {
    tone({ type: 'sine', f: hard ? 110 : 140, f2: 50, dur: hard ? 0.22 : 0.1, vol: hard ? 0.45 : 0.18 });
    noise({ type: 'lowpass', f: hard ? 700 : 500, dur: hard ? 0.18 : 0.07, vol: hard ? 0.3 : 0.12 });
  },
  step() {
    noise({ type: 'lowpass', f: 400, dur: 0.04, vol: 0.05 });
  },
  dash() {
    noise({ type: 'bandpass', f: 700, f2: 2400, dur: 0.16, vol: 0.14, attack: 0.02, q: 1.2 });
  },
  grab() {
    noise({ type: 'lowpass', f: 900, dur: 0.06, vol: 0.3 });
    tone({ type: 'triangle', f: 180, f2: 120, dur: 0.08, vol: 0.2 });
  },
  tech() {
    tone({ type: 'square', f: 660, f2: 990, dur: 0.1, vol: 0.08 });
    noise({ type: 'bandpass', f: 1500, dur: 0.08, vol: 0.2 });
  },
  wall() {
    tone({ type: 'sine', f: 90, f2: 40, dur: 0.3, vol: 0.5 });
    noise({ type: 'lowpass', f: 1200, f2: 200, dur: 0.25, vol: 0.4 });
  },
  spawn(kind: string) {
    switch (kind) {
      case 'kunai':
        tone({ type: 'sine', f: 2200, f2: 900, dur: 0.18, vol: 0.06 });
        noise({ type: 'highpass', f: 4000, dur: 0.08, vol: 0.12 });
        break;
      case 'bolt':
        tone({ type: 'square', f: 440, f2: 1320, dur: 0.12, vol: 0.06 });
        noise({ type: 'bandpass', f: 3000, dur: 0.1, vol: 0.12, q: 3 });
        break;
      case 'orb':
        tone({ type: 'sine', f: 220, f2: 330, dur: 0.5, vol: 0.12, attack: 0.08 });
        tone({ type: 'sine', f: 331, f2: 495, dur: 0.5, vol: 0.06, attack: 0.08 });
        break;
      case 'missile':
        noise({ type: 'bandpass', f: 600, f2: 1600, dur: 0.4, vol: 0.2, attack: 0.04 });
        tone({ type: 'sawtooth', f: 90, f2: 160, dur: 0.3, vol: 0.06 });
        break;
      case 'singularity':
        tone({ type: 'sine', f: 60, f2: 30, dur: 1.4, vol: 0.4, attack: 0.2 });
        tone({ type: 'sawtooth', f: 120, f2: 80, dur: 1.2, vol: 0.05, attack: 0.3 });
        break;
      case 'blast':
      case 'orbblast':
      case 'singblast':
        sfx.explosion(kind === 'singblast' ? 1 : 0.6);
        break;
      case 'quake':
      case 'tectonic':
        sfx.explosion(kind === 'tectonic' ? 1 : 0.5);
        tone({ type: 'sine', f: 55, f2: 30, dur: 0.6, vol: 0.5 });
        break;
    }
  },
  explosion(p = 0.7) {
    noise({ type: 'lowpass', f: 1800, f2: 120, dur: 0.4 + p * 0.5, vol: 0.5 + p * 0.3 });
    tone({ type: 'sine', f: 80, f2: 30, dur: 0.4 + p * 0.4, vol: 0.6 });
  },
  vanish() {
    noise({ type: 'bandpass', f: 2400, f2: 600, dur: 0.18, vol: 0.12, q: 2 });
    tone({ type: 'sine', f: 1200, f2: 300, dur: 0.15, vol: 0.05 });
  },
  super() {
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'sawtooth', f, dur: 0.6, vol: 0.05, at: i * 0.04, attack: 0.05 }));
    noise({ type: 'highpass', f: 2000, f2: 8000, dur: 0.5, vol: 0.2, attack: 0.1 });
    tone({ type: 'sine', f: 110, f2: 55, dur: 0.6, vol: 0.3 });
  },
  burst() {
    noise({ type: 'bandpass', f: 300, f2: 3000, dur: 0.35, vol: 0.4 });
    tone({ type: 'sine', f: 200, f2: 60, dur: 0.4, vol: 0.4 });
  },
  ko() {
    noise({ type: 'lowpass', f: 2500, f2: 60, dur: 1.2, vol: 0.7 });
    tone({ type: 'sine', f: 70, f2: 28, dur: 1.4, vol: 0.8 });
    tone({ type: 'sawtooth', f: 220, f2: 55, dur: 1.0, vol: 0.08 });
    [440, 554, 659].forEach((f, i) => tone({ type: 'sine', f, dur: 1.6, vol: 0.08, at: 0.25 + i * 0.02, attack: 0.05 }));
  },
  feint() {
    tone({ type: 'triangle', f: 600, f2: 300, dur: 0.12, vol: 0.08 });
  },
  // ---------------------------------------------------------- ui
  tap() {
    tone({ type: 'triangle', f: 900, dur: 0.035, vol: 0.06 });
  },
  hover() {
    tone({ type: 'sine', f: 1400, dur: 0.025, vol: 0.025 });
  },
  select() {
    tone({ type: 'square', f: 660, dur: 0.05, vol: 0.05 });
    tone({ type: 'square', f: 990, dur: 0.07, vol: 0.05, at: 0.045 });
  },
  back() {
    tone({ type: 'triangle', f: 500, f2: 300, dur: 0.09, vol: 0.08 });
  },
  error() {
    tone({ type: 'square', f: 180, dur: 0.08, vol: 0.06 });
    tone({ type: 'square', f: 150, dur: 0.1, vol: 0.06, at: 0.08 });
  },
  lock() {
    tone({ type: 'square', f: 392, dur: 0.06, vol: 0.07 });
    tone({ type: 'square', f: 784, dur: 0.12, vol: 0.07, at: 0.05 });
    noise({ type: 'highpass', f: 3000, dur: 0.05, vol: 0.1 });
  },
  tick() {
    tone({ type: 'sine', f: 1200, dur: 0.03, vol: 0.05 });
  },
  round() {
    tone({ type: 'sine', f: 110, f2: 105, dur: 1.6, vol: 0.4, attack: 0.005 });
    tone({ type: 'sine', f: 220, dur: 1.2, vol: 0.15 });
    tone({ type: 'sine', f: 331, dur: 0.9, vol: 0.08 });
    noise({ type: 'bandpass', f: 1200, dur: 0.4, vol: 0.1 });
  },
  fight() {
    tone({ type: 'sawtooth', f: 220, f2: 440, dur: 0.25, vol: 0.12 });
    noise({ type: 'highpass', f: 1500, dur: 0.3, vol: 0.18 });
  },
  win() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ type: 'triangle', f, dur: 0.5, vol: 0.1, at: i * 0.1 }));
  },
};

// ------------------------------------------------------------ music --

const BPM = 108;
const STEP = 60 / BPM / 4; // 16th notes
// A minor: i – VI – III – VII
const CHORDS = [
  [57, 60, 64],
  [53, 57, 60],
  [48, 52, 55],
  [55, 59, 62],
];
const BASS = [0, 0, 12, 0, 0, 7, 0, 12];
const ARP = [0, 2, 1, 2, 0, 1, 2, 1];

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

let seqTimer: number | null = null;
let nextT = 0;
let step = 0;
let intensity = 0; // 0 calm (menus/planning), 1 full (resolving)
let musicOn = false;

function kick(t: number) {
  if (!ctx) return;
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
  o.connect(g);
  g.connect(musicBus);
  o.start(t);
  o.stop(t + 0.3);
}

function snare(t: number) {
  const c = ctx!;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1800;
  const g = c.createGain();
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  s.connect(f);
  f.connect(g);
  g.connect(musicBus);
  s.start(t, Math.random() * 0.5);
  s.stop(t + 0.2);
}

function hat(t: number, v: number) {
  const c = ctx!;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 7000;
  const g = c.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  s.connect(f);
  f.connect(g);
  g.connect(musicBus);
  s.start(t, Math.random() * 0.5);
  s.stop(t + 0.06);
}

function note(t: number, m: number, dur: number, type: OscillatorType, vol: number, attack = 0.01) {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = mtof(m);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(musicBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function schedule() {
  const c = ctx;
  if (!c) return;
  while (nextT < c.currentTime + 0.12) {
    const s = step % 64;
    const bar = Math.floor(s / 16);
    const sixteenth = s % 16;
    const chord = CHORDS[bar];
    // pad: once per bar
    if (sixteenth === 0) for (const n of chord) note(nextT, n, STEP * 16, 'sawtooth', 0.018, 0.4);
    // bass
    if (sixteenth % 2 === 0) note(nextT, chord[0] - 12 + BASS[(sixteenth >> 1) % 8], STEP * 1.8, 'triangle', 0.16);
    // arp
    if (intensity > 0.3 || sixteenth % 4 === 0) {
      const n = chord[ARP[sixteenth % 8] % 3] + 12 + (sixteenth >= 8 ? 12 : 0);
      note(nextT, n, STEP * 1.2, 'square', 0.025 + intensity * 0.012);
    }
    // drums
    if (intensity > 0.2) {
      if (sixteenth === 0 || sixteenth === 8 || (sixteenth === 10 && bar % 2)) kick(nextT);
      if (sixteenth === 4 || sixteenth === 12) snare(nextT);
      if (sixteenth % 2 === 0) hat(nextT, 0.06 + (sixteenth % 4 === 2 ? 0.04 : 0));
    } else if (sixteenth === 0) {
      kick(nextT);
    }
    nextT += STEP;
    step++;
  }
}

export function startMusic() {
  const c = ac();
  if (!c || musicOn) return;
  musicOn = true;
  nextT = c.currentTime + 0.05;
  seqTimer = window.setInterval(schedule, 30);
}

export function stopMusic() {
  musicOn = false;
  if (seqTimer !== null) clearInterval(seqTimer);
  seqTimer = null;
}

/** 0 = calm (menus, planning), 1 = full energy (a turn resolving). */
export function setIntensity(v: number) {
  intensity = v;
  if (!ctx) return;
  const f = 700 + v * 9000;
  musicFilter.frequency.cancelScheduledValues(ctx.currentTime);
  musicFilter.frequency.setTargetAtTime(f, ctx.currentTime, 0.25);
}

document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) void ctx.suspend();
  else void ctx.resume();
});
