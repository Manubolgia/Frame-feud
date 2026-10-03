/**
 * Skeletal poses for the fighters.
 *
 * A pose is a handful of joint angles in degrees, authored for a fighter
 * facing right (the renderer mirrors it). Moves key poses to frames; the
 * renderer interpolates between keys, plants the feet on the floor and adds
 * secondary motion. Nothing here touches the simulation (hitbox positions
 * are baked from these animations ahead of time, see scripts/bake.ts).
 *
 * Angles
 *  torso   lower-spine lean from upright, + leans toward the facing
 *  chest   extra upper-spine bend on top of torso, + hunches forward
 *  head    tilt on top of the upper spine, + nods forward / down
 *  fs, bs  front / back shoulder, relative to the upper spine:
 *          0 hangs down, 90 points forward, 180 points up, -60 swings back
 *  fe, be  elbow flex, + folds the forearm further round (up when forward)
 *  fw, bw  wrist bend
 *  fh, bh  front / back hip, absolute: 0 straight down, + swings forward
 *  fk, bk  knee bend, + folds the shin backward
 *  fa, ba  ankle (only when the foot is off the floor), + points the toes
 *  dx      hip shift along the facing, as a fraction of height
 *  rot     whole-body pitch around the hips, + tips forward
 *  sq      squash (-) / stretch (+)
 *  The "front" limbs are the ones nearer the camera (drawn on top).
 */

export interface Pose {
  torso: number;
  chest: number;
  head: number;
  fs: number;
  fe: number;
  fw: number;
  bs: number;
  be: number;
  bw: number;
  fh: number;
  fk: number;
  fa: number;
  bh: number;
  bk: number;
  ba: number;
  dx: number;
  rot: number;
  sq: number;
}

export type Ease = 'lin' | 'in' | 'out' | 'io' | 'snap' | 'back';

/** [frame, pose, easing into the NEXT key]. */
export type AnimKey = [number, Pose, Ease?];

export interface AnimDef {
  keys: AnimKey[];
  /** Limb whose path is drawn as a motion smear while the move is active. */
  trail?: { limb: 'fa' | 'ba' | 'fl' | 'bl' | 'head' | 'tip'; f0: number; f1: number };
  /** Spin the body by this many degrees over [f0, f1] (flips, lariats). */
  spin?: { f0: number; f1: number; deg: number };
  /** Draw a held weapon / effect on the front hand. */
  prop?: 'blade' | 'orb' | 'gun' | 'none';
  /** Point the front arm along the move's direction parameter. */
  aim?: { f0: number; f1: number };
  /** Front hand open (palms, grabs, casting) over these frames. */
  open?: [number, number];
  /** Thrusters / casting glow over these frames. */
  power?: [number, number];
}

export const NEUTRAL: Pose = {
  torso: 4,
  chest: 0,
  head: 0,
  fs: 12,
  fe: 24,
  fw: 0,
  bs: -8,
  be: 18,
  bw: 0,
  fh: 8,
  fk: 6,
  fa: 0,
  bh: -8,
  bk: 6,
  ba: 0,
  dx: 0,
  rot: 0,
  sq: 0,
};

/** Build a pose from a base and overrides. */
export function P(base: Pose, o: Partial<Pose> = {}): Pose {
  return { ...base, ...o };
}

/** Every named pose a fighter needs outside its own moves. */
export interface PoseSet {
  stance: Pose;
  crouch: Pose;
  guard: Pose;
  guardHit: Pose;
  parryReady: Pose;
  parryHit: Pose;
  walkA: Pose;
  walkB: Pose;
  dash: Pose;
  skid: Pose;
  backdash: Pose;
  prejump: Pose;
  rise: Pose;
  apex: Pose;
  fall: Pose;
  airdash: Pose;
  land: Pose;
  hurtHigh: Pose;
  hurtGut: Pose;
  hurtLow: Pose;
  hurtAir: Pose;
  tumble: Pose;
  lying: Pose;
  getup: Pose;
  grabbed: Pose;
  stagger: Pose;
  victory: Pose;
  ball: Pose;
  burstWind: Pose;
  burstOut: Pose;
}

/** The default pose set, derived from a stance. Characters override what
 *  needs their own body language. */
export function poseSet(stance: Pose, over: Partial<PoseSet> = {}): PoseSet {
  const s = stance;
  const air = P(NEUTRAL, { torso: 6, chest: 4, head: -4 });
  const base: PoseSet = {
    stance: s,
    crouch: P(s, { torso: s.torso + 18, chest: 6, head: -10, fh: 78, fk: 118, bh: 14, bk: 112, dx: 0.01 }),
    guard: P(s, { torso: 4, chest: 10, head: 10, fs: 84, fe: 132, bs: 74, be: 140, fh: 22, fk: 30, bh: -22, bk: 26, dx: -0.02 }),
    guardHit: P(s, { torso: -8, chest: 8, head: 14, fs: 90, fe: 138, bs: 80, be: 142, fh: 30, fk: 36, bh: -30, bk: 30, dx: -0.04 }),
    parryReady: P(s, { torso: 2, chest: 4, head: 2, fs: 64, fe: 70, fw: -20, bs: 44, be: 96, fh: 26, fk: 26, bh: -24, bk: 20 }),
    parryHit: P(s, { torso: 14, chest: 6, head: -4, fs: 124, fe: 18, fw: -30, bs: -36, be: 30, fh: 36, fk: 28, bh: -32, bk: 20, dx: 0.03 }),
    walkA: P(s, { fh: s.fh + 14, fk: 10, bh: s.bh - 10, bk: s.bk + 14 }),
    walkB: P(s, { fh: s.fh - 30, fk: s.fk + 18, bh: s.bh + 30, bk: 8 }),
    dash: P(s, { torso: 34, chest: 6, head: -24, fs: -28, fe: 40, bs: -56, be: 30, fh: 66, fk: 64, bh: -42, bk: 72, dx: 0.05 }),
    skid: P(s, { torso: -4, chest: 6, head: 0, fs: 46, fe: 80, bs: 20, be: 90, fh: 50, fk: 8, bh: -8, bk: 66, dx: -0.04 }),
    backdash: P(s, { torso: -14, chest: 8, head: 10, fs: 70, fe: 120, bs: 54, be: 128, fh: 14, fk: 46, bh: -40, bk: 30, dx: -0.05 }),
    prejump: P(s, { torso: s.torso + 22, chest: 6, head: -14, fs: -26, fe: 30, bs: -44, be: 30, fh: 72, fk: 112, bh: 26, bk: 104, sq: -0.08 }),
    rise: P(air, { torso: -2, chest: 0, head: -14, fs: 156, fe: 16, bs: 124, be: 24, fh: 26, fk: 64, bh: -12, bk: 34, fa: 30, ba: 40, sq: 0.06 }),
    apex: P(air, { torso: 10, chest: 8, fs: 78, fe: 84, bs: 50, be: 100, fh: 66, fk: 104, bh: 24, bk: 96, fa: 20, ba: 20 }),
    fall: P(air, { torso: 2, chest: 4, head: 4, fs: 112, fe: 40, bs: 74, be: 40, fh: 30, fk: 34, bh: -16, bk: 56, fa: 10, ba: 20 }),
    airdash: P(air, { torso: 42, chest: 4, head: -26, fs: -36, fe: 22, bs: -56, be: 20, fh: 22, fk: 74, bh: -34, bk: 96, fa: 40, ba: 50 }),
    land: P(s, { torso: s.torso + 20, chest: 8, head: -8, fs: 34, fe: 70, bs: 12, be: 80, fh: 62, fk: 100, bh: 18, bk: 96, sq: -0.1 }),
    hurtHigh: P(s, { torso: -22, chest: -14, head: -30, fs: -46, fe: 40, bs: -70, be: 30, fh: 30, fk: 22, bh: -28, bk: 26, dx: -0.06 }),
    hurtGut: P(s, { torso: 40, chest: 20, head: 18, fs: 30, fe: 60, bs: 14, be: 70, fh: 34, fk: 40, bh: -16, bk: 36, dx: -0.05 }),
    hurtLow: P(s, { torso: 30, chest: 10, head: 10, fs: 40, fe: 50, bs: 10, be: 50, fh: 50, fk: 70, bh: -6, bk: 60, dx: -0.03 }),
    hurtAir: P(air, { torso: -36, chest: -14, head: -30, fs: -110, fe: 40, bs: -140, be: 30, fh: 54, fk: 50, bh: 22, bk: 74, fa: 40, ba: 40, rot: -16 }),
    tumble: P(air, { torso: -8, chest: -6, head: -24, fs: 164, fe: 30, bs: 124, be: 40, fh: 84, fk: 92, bh: 40, bk: 104, fa: 30, ba: 30 }),
    lying: P(NEUTRAL, { torso: 0, chest: 0, head: -16, fs: 30, fe: 40, bs: -20, be: 20, fh: 10, fk: 24, bh: -4, bk: 40, rot: -90 }),
    getup: P(s, { torso: 46, chest: 10, head: -14, fs: 24, fe: 50, bs: 4, be: 60, fh: 92, fk: 134, bh: 12, bk: 116 }),
    grabbed: P(NEUTRAL, { torso: -16, chest: -8, head: -22, fs: 124, fe: 40, bs: 144, be: 30, fh: 24, fk: 30, bh: -10, bk: 44, fa: 30, ba: 30 }),
    stagger: P(s, { torso: -28, chest: -10, head: -26, fs: 142, fe: 12, bs: -62, be: 12, fh: 36, fk: 18, bh: -42, bk: 14, dx: -0.05 }),
    victory: P(NEUTRAL, { torso: 2, chest: -4, head: -12, fs: 160, fe: 30, bs: 14, be: 60, fh: 14, fk: 4, bh: -14, bk: 4 }),
    ball: P(s, { torso: 80, chest: 30, head: 40, fs: 120, fe: 140, bs: 110, be: 140, fh: 124, fk: 150, bh: 104, bk: 150 }),
    burstWind: P(s, { torso: 30, chest: 20, head: 30, fs: 150, fe: 150, bs: 150, be: 150, fh: 70, fk: 110, bh: 18, bk: 100, sq: -0.12 }),
    burstOut: P(NEUTRAL, { torso: -10, chest: -10, head: -20, fs: 150, fe: 0, bs: 200, be: 0, fh: 30, fk: 0, bh: -30, bk: 0, fa: 30, ba: 30, sq: 0.08 }),
  };
  return { ...base, ...over };
}

/** The generic stance and pose set (dev tools, fallbacks). */
const STANCE: Pose = P(NEUTRAL, {
  torso: 10, chest: 4, head: 2,
  fs: 60, fe: 104, bs: 34, be: 116,
  fh: 24, fk: 22, bh: -22, bk: 16,
});
export const L: PoseSet = poseSet(STANCE);

/** Common grab / throw shapes. */
export const G = {
  reach: P(STANCE, { torso: 26, chest: 6, fs: 88, fe: 10, fw: -20, bs: 74, be: 18, fh: 50, fk: 40, bh: -32, bk: 30, dx: 0.05 }),
  hold: P(STANCE, { torso: 10, chest: 6, fs: 70, fe: 60, bs: 60, be: 70, fh: 30, fk: 30, bh: -20, bk: 20 }),
  heave: P(STANCE, { torso: -30, chest: -10, head: -14, fs: 170, fe: 30, bs: 160, be: 40, fh: 30, fk: 20, bh: -36, bk: 16, dx: -0.03 }),
  toss: P(STANCE, { torso: 32, chest: 8, fs: 110, fe: 0, bs: 80, be: 10, fh: 50, fk: 30, bh: -40, bk: 20, dx: 0.06 }),
};

/**
 * A strike animation with weight: settle from the stance into an
 * anticipation pose (held), snap through to the strike on the first active
 * frame, overshoot into a follow-through during the active frames, then ease
 * back to the stance over the recovery.
 *  s: first active frame   a: active frames   total: move length
 */
export function strike(
  s: number,
  a: number,
  total: number,
  wind: Pose,
  hit: Pose,
  opts: {
    ready: Pose;
    follow?: Pose;
    recover?: Pose;
    /** Frame the anticipation pose is reached (default 60% of startup). */
    windAt?: number;
    trail?: AnimDef['trail'];
    prop?: AnimDef['prop'];
    aim?: AnimDef['aim'];
    open?: AnimDef['open'];
    power?: AnimDef['power'];
  },
): AnimDef {
  const ready = opts.ready;
  const follow = opts.follow ?? hit;
  const recover = opts.recover ?? blendPose(follow, ready, 0.35);
  const windAt = Math.min(s - 1, opts.windAt ?? Math.max(1, Math.round(s * 0.6)));
  const end = s + a;
  const settle = Math.min(total - 1, end + Math.max(2, Math.round((total - end) * 0.45)));
  const keys: AnimKey[] = [
    [0, ready, 'out'],
    [Math.max(1, windAt), wind, 'lin'],
    [Math.max(1, s - 1), wind, 'in'],
    [s, hit, 'out'],
    [Math.max(s + 1, end - 1), follow, 'out'],
    [settle, recover, 'io'],
    [total, ready, 'lin'],
  ];
  return {
    keys: dedupe(keys),
    trail: opts.trail,
    prop: opts.prop,
    aim: opts.aim,
    open: opts.open,
    power: opts.power,
  };
}

function dedupe(keys: AnimKey[]): AnimKey[] {
  const out: AnimKey[] = [];
  for (const k of keys) {
    const prev = out[out.length - 1];
    if (prev && k[0] <= prev[0]) {
      out[out.length - 1] = k;
      continue;
    }
    out.push(k);
  }
  return out;
}

/** Static single-pose animation. */
export const still = (p: Pose): AnimDef => ({ keys: [[0, p, 'lin']] });

const EASE: Record<Ease, (t: number) => number> = {
  lin: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  io: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  snap: (t) => (t < 1 ? 0 : 1),
  back: (t) => {
    const c = 1.7;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
};

export function blendPose(a: Pose, b: Pose, t: number): Pose {
  const o = {} as Pose;
  for (const k in a) {
    const key = k as keyof Pose;
    o[key] = a[key] + ((b[key] ?? a[key]) - a[key]) * t;
  }
  return o;
}

/** Sample an animation at a (fractional) frame. */
export function sampleAnim(anim: AnimDef, frame: number): Pose {
  const keys = anim.keys;
  if (keys.length === 1 || frame <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [f0, p0, ease] = keys[i];
    const [f1, p1] = keys[i + 1];
    if (frame < f1) {
      const t = (frame - f0) / Math.max(1e-6, f1 - f0);
      return blendPose(p0, p1, EASE[ease ?? 'lin'](Math.max(0, Math.min(1, t))));
    }
  }
  return keys[keys.length - 1][1];
}
