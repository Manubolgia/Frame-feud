/**
 * Skeletal poses for the articulated fighters.
 *
 * A pose is a handful of joint angles in degrees, authored for a fighter
 * facing right (the renderer mirrors it). Moves key poses to frames; the
 * renderer interpolates between keys, plants the feet on the floor and adds
 * secondary motion. Nothing here touches the simulation.
 *
 * Angles
 *  torso   lean from upright, + leans toward the facing direction
 *  head    tilt relative to the torso, + nods forward / down
 *  fs, bs  front / back shoulder, relative to the torso:
 *          0 hangs down, 90 points forward, 180 points up, -60 swings back
 *  fe, be  elbow flex, + folds the forearm forward / up
 *  fh, bh  front / back hip, from straight down, + swings the thigh forward
 *  fk, bk  knee bend, + folds the shin backward
 *  dx      hip shift along the facing, as a fraction of height
 *  rot     whole-body pitch around the hips, + tips forward
 *  The "front" limbs are the ones nearer the camera (drawn on top).
 */

export interface Pose {
  torso: number;
  head: number;
  fs: number;
  fe: number;
  bs: number;
  be: number;
  fh: number;
  fk: number;
  bh: number;
  bk: number;
  dx: number;
  rot: number;
}

export type Ease = 'lin' | 'in' | 'out' | 'io' | 'snap' | 'back';

/** [frame, pose, easing into the NEXT key]. */
export type AnimKey = [number, Pose, Ease?];

export interface AnimDef {
  keys: AnimKey[];
  /** Limb whose path is drawn as a motion smear while the move is active. */
  trail?: { limb: 'fa' | 'ba' | 'fl' | 'bl' | 'head'; f0: number; f1: number };
  /** Spin the body by this many degrees over [f0, f1] (flips, lariats). */
  spin?: { f0: number; f1: number; deg: number };
  /** Draw a held weapon / effect on the front hand. */
  prop?: 'blade' | 'orb' | 'gun' | 'none';
  /** Point the front arm along the move's direction parameter. */
  aim?: { f0: number; f1: number };
}

export const NEUTRAL: Pose = {
  torso: 4,
  head: 0,
  fs: 12,
  fe: 24,
  bs: -8,
  be: 18,
  fh: 8,
  fk: 6,
  bh: -8,
  bk: 6,
  dx: 0,
  rot: 0,
};

/** Build a pose from a base and overrides. */
export function P(base: Pose, o: Partial<Pose> = {}): Pose {
  return { ...base, ...o };
}

const stance: Pose = P(NEUTRAL, {
  torso: 10, head: -4,
  fs: 62, fe: 104, bs: 34, be: 118,
  fh: 26, fk: 34, bh: -18, bk: 22,
});

/** Shared pose library. Characters layer their own variants on top. */
export const L = {
  neutral: NEUTRAL,
  stance,
  crouch: P(stance, { torso: 24, fh: 64, fk: 104, bh: 18, bk: 96, dx: 0.02, fs: 70, fe: 110, bs: 46, be: 120 }),
  guard: P(stance, { torso: 2, head: 6, fs: 96, fe: 140, bs: 84, be: 146, fh: 20, fk: 36, bh: -22, bk: 30, dx: -0.02 }),
  guardHit: P(stance, { torso: -10, head: 2, fs: 104, fe: 146, bs: 90, be: 150, fh: 30, fk: 40, bh: -30, bk: 34, dx: -0.04 }),
  parryReady: P(stance, { torso: 6, fs: 70, fe: 70, bs: 50, be: 100, fh: 30, fk: 30, bh: -24, bk: 20 }),
  parryHit: P(stance, { torso: 14, fs: 128, fe: 20, bs: -30, be: 30, fh: 34, fk: 26, bh: -30, bk: 24, dx: 0.03 }),
  walkA: P(stance, { fh: 36, fk: 14, bh: -26, bk: 36, fs: 56, bs: 40 }),
  walkB: P(stance, { fh: -14, fk: 30, bh: 22, bk: 12, fs: 66, bs: 28 }),
  dash: P(stance, { torso: 34, head: -10, fs: -20, fe: 30, bs: -46, be: 24, fh: 64, fk: 50, bh: -40, bk: 64, dx: 0.05 }),
  skid: P(stance, { torso: -6, fs: 40, fe: 80, bs: 20, be: 90, fh: 46, fk: 10, bh: -6, bk: 64, dx: -0.04 }),
  backdash: P(stance, { torso: -16, head: 8, fs: 80, fe: 120, bs: 60, be: 130, fh: 10, fk: 40, bh: -44, bk: 20, dx: -0.05 }),
  prejump: P(stance, { torso: 20, fh: 70, fk: 110, bh: 30, bk: 104, fs: -30, fe: 30, bs: -40, be: 30, dx: 0.02 }),
  rise: P(NEUTRAL, { torso: 0, head: -10, fs: 150, fe: 20, bs: 120, be: 30, fh: 30, fk: 70, bh: -10, bk: 40 }),
  apex: P(NEUTRAL, { torso: 8, fs: 80, fe: 90, bs: 50, be: 100, fh: 60, fk: 100, bh: 20, bk: 90 }),
  fall: P(NEUTRAL, { torso: 4, head: 6, fs: 110, fe: 40, bs: 70, be: 40, fh: 30, fk: 30, bh: -16, bk: 50 }),
  airdash: P(NEUTRAL, { torso: 40, head: -14, fs: -30, fe: 20, bs: -50, be: 20, fh: 20, fk: 70, bh: -30, bk: 90 }),
  land: P(stance, { torso: 22, fh: 58, fk: 96, bh: 18, bk: 92, fs: 30, fe: 70, bs: 10, be: 80 }),
  hurtHigh: P(stance, { torso: -24, head: -26, fs: -50, fe: 30, bs: -70, be: 20, fh: 30, fk: 20, bh: -26, bk: 26, dx: -0.06 }),
  hurtLow: P(stance, { torso: 34, head: 20, fs: 30, fe: 40, bs: 10, be: 40, fh: 40, fk: 60, bh: -10, bk: 50, dx: -0.03 }),
  hurtAir: P(NEUTRAL, { torso: -40, head: -30, fs: -100, fe: 40, bs: -130, be: 30, fh: 50, fk: 50, bh: 20, bk: 70, rot: -20 }),
  tumble: P(NEUTRAL, { torso: -10, head: -20, fs: 160, fe: 30, bs: 120, be: 40, fh: 80, fk: 90, bh: 40, bk: 100 }),
  lying: P(NEUTRAL, { torso: 0, head: -10, fs: 20, fe: 30, bs: -14, be: 20, fh: 6, fk: 14, bh: -4, bk: 30, rot: -90 }),
  getup: P(stance, { torso: 40, head: -10, fs: 20, fe: 60, bs: 0, be: 60, fh: 90, fk: 130, bh: 10, bk: 110 }),
  sit: P(NEUTRAL, { torso: -50, head: 10, fs: -30, fe: 20, bs: -60, be: 10, fh: 84, fk: 40, bh: 70, bk: 70, rot: 0 }),
  grabbed: P(NEUTRAL, { torso: -14, head: -20, fs: 120, fe: 40, bs: 140, be: 30, fh: 20, fk: 30, bh: -10, bk: 40 }),
  stagger: P(stance, { torso: -30, head: -30, fs: 140, fe: 10, bs: -60, be: 10, fh: 34, fk: 20, bh: -40, bk: 10, dx: -0.05 }),
  victory: P(NEUTRAL, { torso: 2, head: -12, fs: 170, fe: 10, bs: 10, be: 60, fh: 14, fk: 4, bh: -12, bk: 4 }),
  taunt: P(stance, { torso: -4, head: -10, fs: 40, fe: 130, bs: 60, be: 140 }),
};

/** Common grab / throw shapes shared by every character. */
export const G = {
  reach: P(stance, { torso: 24, fs: 88, fe: 10, bs: 76, be: 16, fh: 50, fk: 40, bh: -30, bk: 30, dx: 0.05 }),
  hold: P(stance, { torso: 10, fs: 70, fe: 60, bs: 60, be: 70, fh: 30, fk: 30, bh: -20, bk: 20 }),
  heave: P(stance, { torso: -30, head: -14, fs: 170, fe: 30, bs: 160, be: 40, fh: 30, fk: 20, bh: -36, bk: 16, dx: -0.03 }),
  toss: P(stance, { torso: 30, fs: 110, fe: 0, bs: 80, be: 10, fh: 50, fk: 30, bh: -40, bk: 20, dx: 0.06 }),
};

/** Make a standard strike animation: ready → windup → strike (held) →
 *  recover. `s` is the first active frame, `a` the active length. */
export function strike(
  s: number,
  a: number,
  total: number,
  windup: Pose,
  hit: Pose,
  opts: { ready?: Pose; recover?: Pose; trail?: AnimDef['trail']; prop?: AnimDef['prop']; aim?: AnimDef['aim'] } = {},
): AnimDef {
  const ready = opts.ready ?? stance;
  const recover = opts.recover ?? hit;
  const keys: AnimKey[] = [
    [0, ready, 'out'],
    [Math.max(1, s - 1), windup, 'snap'],
    [s, hit, 'lin'],
    [s + a, P(hit, {}), 'out'],
    [Math.min(total, s + a + Math.max(2, Math.round((total - s - a) * 0.45))), recover, 'io'],
    [total, ready, 'lin'],
  ];
  return {
    keys: dedupe(keys),
    trail: opts.trail ?? undefined,
    prop: opts.prop,
    aim: opts.aim,
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
    o[key] = a[key] + (b[key] - a[key]) * t;
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
