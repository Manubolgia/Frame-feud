/** Procedural WebAudio SFX + music bed. No asset files — fully synthesized so
 *  the build stays tiny and offline-installable. */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicGain: GainNode | null = null;
let enabled = true;
let musicTimer: number | null = null;

function ac(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.18;
    musicGain.connect(master);
  }
  return ctx;
}

export function unlockAudio() {
  const c = ac();
  if (c.state === 'suspended') c.resume();
}

export function setMuted(m: boolean) {
  enabled = !m;
  if (master) master.gain.value = m ? 0 : 0.6;
}

export function isMuted() {
  return !enabled;
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  vol: number,
  whenOffset = 0,
  slideTo?: number,
  dest?: AudioNode,
) {
  if (!enabled) return;
  const c = ac();
  const t0 = c.currentTime + whenOffset;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(dest ?? master!);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur: number, vol: number, hp = 800, whenOffset = 0) {
  if (!enabled) return;
  const c = ac();
  const t0 = c.currentTime + whenOffset;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'highpass';
  filt.frequency.value = hp;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(filt);
  filt.connect(g);
  g.connect(master!);
  src.start(t0);
}

export const sfx = {
  uiTap() {
    tone(520, 0.06, 'triangle', 0.18);
  },
  uiSelect() {
    tone(660, 0.08, 'square', 0.12);
    tone(990, 0.1, 'triangle', 0.1, 0.03);
  },
  uiBack() {
    tone(320, 0.09, 'sine', 0.14, 0, 220);
  },
  place() {
    tone(440, 0.05, 'square', 0.1);
    tone(880, 0.06, 'triangle', 0.08, 0.02);
  },
  lock() {
    tone(330, 0.1, 'sawtooth', 0.14, 0, 660);
    tone(660, 0.12, 'square', 0.1, 0.05);
  },
  countdown() {
    tone(700, 0.08, 'square', 0.16);
  },
  go() {
    tone(520, 0.18, 'sawtooth', 0.2, 0, 1040);
  },
  hit(power: number) {
    const p = Math.min(1, power);
    tone(180 - p * 60, 0.12 + p * 0.08, 'sawtooth', 0.18 + p * 0.12, 0, 60);
    noise(0.08 + p * 0.05, 0.12 + p * 0.1, 600);
  },
  shieldHit() {
    tone(900, 0.08, 'sine', 0.12, 0, 1300);
    noise(0.05, 0.06, 2000);
  },
  ko() {
    noise(0.4, 0.25, 300);
    tone(120, 0.5, 'sawtooth', 0.22, 0, 40);
    tone(800, 0.5, 'sine', 0.12, 0.02, 100);
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.18, i * 0.12));
  },
};

/** A simple evolving synth music bed (arpeggios over a pad). */
const SCALE = [0, 3, 5, 7, 10]; // minor pentatonic
let step = 0;
const root = 220;

export function startMusic() {
  if (musicTimer != null) return;
  ac();
  const beat = 0.26;
  const loop = () => {
    if (!enabled) return;
    const c = ac();
    const note = SCALE[step % SCALE.length];
    const oct = step % 8 < 4 ? 1 : 2;
    const freq = root * Math.pow(2, note / 12) * oct;
    // pluck
    tone(freq, beat * 1.6, 'triangle', 0.06, 0, undefined, musicGain!);
    if (step % 4 === 0) {
      // bass
      tone(root / 2, beat * 3, 'sine', 0.08, 0, undefined, musicGain!);
    }
    if (step % 8 === 0) {
      // pad shimmer
      tone(freq * 2, beat * 6, 'sine', 0.025, 0, undefined, musicGain!);
    }
    step++;
  };
  loop();
  musicTimer = window.setInterval(loop, beat * 1000);
}

export function stopMusic() {
  if (musicTimer != null) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}
