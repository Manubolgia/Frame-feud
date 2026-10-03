/**
 * Fighter renderer.
 *
 * A fighter is a 2D rig (pelvis, two-bone spine, neck, head, two-bone arms
 * and legs, hands and feet) posed by forward kinematics, then drawn as clean
 * vector silhouettes: every part of a depth layer is inked as one shape (so
 * joints never show seams), filled, and finished with a key-light highlight
 * and costume details. Each kit gives a fighter its own body plan and outfit.
 *
 * Cosmetic only: floats and trig are fine here, nothing feeds the sim.
 */

import type { Pose } from '../content/poses';
import type { BuildDef } from '../sim/types';
import { darken, INK, lighten, mix } from './color';
import type { Pen } from './pen';

export type P2 = [number, number];
type Kit = BuildDef['kit'];

const D2R = Math.PI / 180;

// ------------------------------------------------------------------ rigs --

/** Body plan: lengths are fractions of the fighter's height, widths are px
 *  at a 1:1 scale (full widths, front-to-back depth for the torso). */
export interface Rig {
  head: number;
  neck: number;
  spine: number;
  /** Where the spine bends, as a fraction of its length from the pelvis. */
  chestAt: number;
  thigh: number;
  shin: number;
  /** Ankle height above the sole. */
  ankle: number;
  foot: number;
  upperArm: number;
  forearm: number;
  hand: number;
  thighW: number;
  kneeW: number;
  calfW: number;
  ankleW: number;
  upperArmW: number;
  bicepW: number;
  elbowW: number;
  forearmW: number;
  wristW: number;
  handW: number;
  neckW: number;
  hipD: number;
  waistD: number;
  chestD: number;
  shoulderD: number;
  /** Share of the chest depth in front of the spine. */
  chestFwd: number;
}

export const RIGS: Record<Kit, Rig> = {
  razor: {
    head: 0.072, neck: 0.04, spine: 0.29, chestAt: 0.5,
    thigh: 0.25, shin: 0.245, ankle: 0.035, foot: 0.115,
    upperArm: 0.185, forearm: 0.17, hand: 0.06,
    thighW: 12.5, kneeW: 8, calfW: 9, ankleW: 5.2,
    upperArmW: 7.2, bicepW: 7.8, elbowW: 5.6, forearmW: 6.8, wristW: 4.8, handW: 7,
    neckW: 6.2,
    hipD: 19, waistD: 13.5, chestD: 21, shoulderD: 18.5, chestFwd: 0.52,
  },
  titan: {
    head: 0.064, neck: 0.05, spine: 0.335, chestAt: 0.48,
    thigh: 0.22, shin: 0.215, ankle: 0.05, foot: 0.13,
    upperArm: 0.19, forearm: 0.2, hand: 0.075,
    thighW: 22, kneeW: 17, calfW: 19, ankleW: 13,
    upperArmW: 15, bicepW: 17, elbowW: 14, forearmW: 22, wristW: 17, handW: 17,
    neckW: 15,
    hipD: 34, waistD: 30, chestD: 50, shoulderD: 46, chestFwd: 0.56,
  },
  arc: {
    head: 0.07, neck: 0.04, spine: 0.3, chestAt: 0.5,
    thigh: 0.245, shin: 0.24, ankle: 0.035, foot: 0.105,
    upperArm: 0.18, forearm: 0.17, hand: 0.06,
    thighW: 12, kneeW: 8, calfW: 8.5, ankleW: 5.4,
    upperArmW: 7.2, bicepW: 7.4, elbowW: 6, forearmW: 6.4, wristW: 4.6, handW: 6.4,
    neckW: 6,
    hipD: 18, waistD: 13.5, chestD: 20, shoulderD: 18, chestFwd: 0.5,
  },
  grip: {
    head: 0.068, neck: 0.035, spine: 0.33, chestAt: 0.5,
    thigh: 0.235, shin: 0.225, ankle: 0.04, foot: 0.12,
    upperArm: 0.2, forearm: 0.185, hand: 0.068,
    thighW: 20, kneeW: 14, calfW: 16, ankleW: 10,
    upperArmW: 14.5, bicepW: 17.5, elbowW: 12, forearmW: 15, wristW: 10, handW: 13,
    neckW: 15,
    hipD: 29, waistD: 24, chestD: 44, shoulderD: 34, chestFwd: 0.58,
  },
};

// ---------------------------------------------------------------- joints --

export interface Joints {
  pelvis: P2;
  /** Alias of pelvis (older callers). */
  hip: P2;
  chest: P2;
  neck: P2;
  shoulder: P2;
  head: P2;
  headR: number;
  /** Unit vector out of the top of the head. */
  headUp: P2;
  /** Unit vector pelvis → neck. */
  up: P2;
  fElbow: P2;
  fHand: P2;
  bElbow: P2;
  bHand: P2;
  fKnee: P2;
  /** Ankles. */
  fFoot: P2;
  bFoot: P2;
  fToe: P2;
  bToe: P2;
  /** Unit vectors along each foot, heel → toe. */
  fFootDir: P2;
  bFootDir: P2;
  bKnee: P2;
  /** Hand directions (wrist bend applied), unit. */
  fHandDir: P2;
  bHandDir: P2;
  facing: 1 | -1;
  scale: number;
  rot: number;
  rig: Rig;
  /** Scaled height. */
  H: number;
  /** Floor line used when planting (world y). */
  floor: number;
}

const dirOf = (deg: number): P2 => [Math.sin(deg * D2R), Math.cos(deg * D2R)];
const add = (a: P2, b: P2, k = 1): P2 => [a[0] + b[0] * k, a[1] + b[1] * k];
const sub = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]];
const lerp2 = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const len = (a: P2) => Math.hypot(a[0], a[1]);
const norm = (a: P2): P2 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
const rotv = (v: P2, a: number): P2 => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
/** Perpendicular of a unit vector, turned 90° clockwise on screen. */
const perp = (v: P2): P2 => [-v[1], v[0]];

/**
 * Pose the rig. `x, y` are the fighter's feet in world px (floor = 0, y down).
 * Grounded fighters are planted so their lowest point rests on `y`.
 * `aim` (screen-space) points the front arm.
 */
export function solve(
  b: BuildDef,
  pose: Pose,
  x: number,
  y: number,
  facing: 1 | -1,
  grounded: boolean,
  spin = 0,
  aim: P2 | null = null,
  scale = 1,
): Joints {
  const R = RIGS[b.kit];
  const H = b.height * scale;
  const k = scale;
  const spine = R.spine * H;
  const headR = R.head * H;
  const thigh = R.thigh * H;
  const shin = R.shin * H;
  const ankleH = R.ankle * H;
  const footL = R.foot * H;
  const upper = R.upperArm * H;
  const fore = R.forearm * H;

  const chestBend = pose.chest ?? 0;
  const tor = pose.torso;
  const top = tor + chestBend;
  const u1: P2 = [Math.sin(tor * D2R), -Math.cos(tor * D2R)];
  const u2: P2 = [Math.sin(top * D2R), -Math.cos(top * D2R)];
  const pelvis: P2 = [0, 0];
  const chest: P2 = add(pelvis, u1, spine * R.chestAt);
  const neck: P2 = add(chest, u2, spine * (1 - R.chestAt));
  const shoulder: P2 = add(neck, u2, -spine * 0.13);
  const ha = top + pose.head;
  const headUp: P2 = [Math.sin(ha * D2R), -Math.cos(ha * D2R)];
  const head: P2 = add(neck, headUp, R.neck * H + headR * 0.92);

  const arm = (s: number, e: number): [P2, P2] => {
    const el = add(shoulder, dirOf(s + top), upper);
    return [el, add(el, dirOf(s + top + e), fore)];
  };
  let [fElbow, fHand] = arm(pose.fs, pose.fe);
  const [bElbow, bHand] = arm(pose.bs, pose.be);
  const leg = (h: number, kn: number): [P2, P2] => {
    const knee = add(pelvis, dirOf(h), thigh);
    return [knee, add(knee, dirOf(h - kn), shin)];
  };
  const [fKnee, fFoot] = leg(pose.fh, pose.fk);
  const [bKnee, bFoot] = leg(pose.bh, pose.bk);
  // feet: perpendicular to the shin, then the ankle angle (+ points toes down)
  const footDir = (knee: P2, ank: P2, a: number): P2 => {
    const s = norm(sub(ank, knee));
    return rotv([s[1], -s[0]], a * D2R);
  };
  let fFootDir = footDir(fKnee, fFoot, pose.fa ?? 0);
  let bFootDir = footDir(bKnee, bFoot, pose.ba ?? 0);
  const handDir = (el: P2, h: P2, w: number): P2 => rotv(norm(sub(h, el)), w * D2R);
  let fHandDir = handDir(fElbow, fHand, pose.fw ?? 0);
  const bHandDir = handDir(bElbow, bHand, pose.bw ?? 0);

  // Whole-body pitch about the pelvis (flips, lying down).
  const rot = (pose.rot + spin) * D2R;
  const pts: P2[] = [chest, neck, shoulder, head, fElbow, fHand, bElbow, bHand, fKnee, fFoot, bKnee, bFoot];
  const vecs: P2[] = [u1, headUp, fFootDir, bFootDir, fHandDir, bHandDir];
  if (rot !== 0) {
    for (const p of pts) {
      const r = rotv(p, rot);
      p[0] = r[0];
      p[1] = r[1];
    }
    for (const v of vecs) {
      const r = rotv(v, rot);
      v[0] = r[0];
      v[1] = r[1];
    }
  }

  // Aimed arm: straight along the aim, from the shoulder.
  if (aim) {
    const a = norm([aim[0] * facing, aim[1]]);
    fElbow = add(shoulder, a, upper);
    fHand = add(fElbow, a, fore);
    fHandDir = a;
  }

  // Plant: the lowest point of the body rests on the floor.
  let oy: number;
  const plantF = { f: false, b: false };
  if (grounded) {
    const soleF = fFoot[1] + ankleH;
    const soleB = bFoot[1] + ankleH;
    let low = Math.max(soleF, soleB);
    low = Math.max(low, fKnee[1] + R.kneeW * k * 0.5, bKnee[1] + R.kneeW * k * 0.5);
    low = Math.max(low, pelvis[1] + R.hipD * k * 0.42, chest[1] + R.chestD * k * 0.42, head[1] + headR);
    low = Math.max(low, fHand[1] + R.handW * k * 0.4, bHand[1] + R.handW * k * 0.4);
    oy = y - low;
    plantF.f = low - soleF < ankleH * 1.4;
    plantF.b = low - soleB < ankleH * 1.4;
  } else {
    oy = y - (thigh + shin + ankleH) * 0.97;
  }
  if (plantF.f) fFootDir = [1, 0];
  if (plantF.b) bFootDir = [1, 0];

  // Mirror to the facing and move into the world. Squash/stretch scales
  // about the floor (grounded) or the pelvis (airborne).
  const sq = pose.sq ?? 0;
  const sx = 1 - sq * 0.5;
  const sy = 1 + sq;
  const ox = x + pose.dx * H * facing;
  const anchor = grounded ? y : oy;
  const place = (p: P2): P2 => [ox + p[0] * facing * sx, anchor + (p[1] + oy - anchor) * sy];
  const mirror = (v: P2): P2 => norm([v[0] * facing * sx, v[1] * sy]);
  const W = (p: P2) => place(p);
  const toe = (ank: P2, d: P2): P2 => add(ank, d, footL * 0.78);

  const fd = mirror(fFootDir);
  const bd = mirror(bFootDir);
  return {
    pelvis: W(pelvis),
    hip: W(pelvis),
    chest: W(chest),
    neck: W(neck),
    shoulder: W(shoulder),
    head: W(head),
    headR,
    headUp: mirror(headUp),
    up: mirror(u1),
    fElbow: W(fElbow),
    fHand: W(fHand),
    bElbow: W(bElbow),
    bHand: W(bHand),
    fKnee: W(fKnee),
    fFoot: W(fFoot),
    bKnee: W(bKnee),
    bFoot: W(bFoot),
    fToe: toe(W(fFoot), fd),
    bToe: toe(W(bFoot), bd),
    fFootDir: fd,
    bFootDir: bd,
    fHandDir: mirror(fHandDir),
    bHandDir: mirror(bHandDir),
    facing,
    scale,
    rot,
    rig: R,
    H,
    floor: y,
  };
}

export type Bone = 'fHand' | 'bHand' | 'fFoot' | 'bFoot' | 'tip' | 'blade' | 'head' | 'fKnee' | 'bKnee' | 'chest' | 'fElbow' | 'pelvis';

/** The striking point of a bone (world px): fist centres, the middle of the
 *  foot, the blade tip. Hitboxes name the bone they ride on. */
export function boneAt(j: Joints, bone: Bone): P2 {
  const k = j.scale;
  const R = j.rig;
  switch (bone) {
    case 'fHand':
      return add(j.fHand, j.fHandDir, R.handW * k * 0.4);
    case 'bHand':
      return add(j.bHand, j.bHandDir, R.handW * k * 0.4);
    case 'fFoot':
      return lerp2(j.fFoot, j.fToe, 0.55);
    case 'bFoot':
      return lerp2(j.bFoot, j.bToe, 0.55);
    case 'tip':
      return add(j.fHand, j.fHandDir, 56 * k);
    case 'blade':
      return add(j.fHand, j.fHandDir, 34 * k);
    case 'head':
      return j.head;
    case 'fKnee':
      return j.fKnee;
    case 'bKnee':
      return j.bKnee;
    case 'chest':
      return j.chest;
    case 'fElbow':
      return j.fElbow;
    default:
      return j.pelvis;
  }
}

// ----------------------------------------------------------------- cloth --

export interface Cloth {
  pts: { x: number; y: number; px: number; py: number }[];
  seg: number;
}

export function makeCloth(n: number, seg: number, x = 0, y = 0): Cloth {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push({ x, y: y + i * seg, px: x, py: y + i * seg });
  return { pts, seg };
}

/** Verlet step with the root pinned at (ax, ay). */
export function stepCloth(c: Cloth, ax: number, ay: number, dt: number, wind: number, gravity = 900, floor = Infinity) {
  const p = c.pts;
  if (!p.length) return;
  // Reset if it got flung absurdly far (teleports, round resets).
  if (Math.hypot(p[0].x - ax, p[0].y - ay) > 200) {
    for (let i = 0; i < p.length; i++) {
      p[i].x = p[i].px = ax;
      p[i].y = p[i].py = ay + i * c.seg;
    }
  }
  p[0].x = p[0].px = ax;
  p[0].y = p[0].py = ay;
  const dt2 = Math.min(dt, 1 / 30) ** 2;
  for (let i = 1; i < p.length; i++) {
    const q = p[i];
    const vx = (q.x - q.px) * 0.94;
    const vy = (q.y - q.py) * 0.94;
    q.px = q.x;
    q.py = q.y;
    q.x += vx + wind * dt2;
    q.y += vy + gravity * dt2;
  }
  for (let it = 0; it < 6; it++) {
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1];
      const b = p[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const diff = (d - c.seg) / d;
      if (i === 1) {
        b.x -= dx * diff;
        b.y -= dy * diff;
      } else {
        a.x += dx * diff * 0.5;
        a.y += dy * diff * 0.5;
        b.x -= dx * diff * 0.5;
        b.y -= dy * diff * 0.5;
      }
    }
    p[0].x = ax;
    p[0].y = ay;
  }
  // Follow-the-leader pass: segments can never stretch.
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1];
    const b = p[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    if (d > c.seg) {
      b.x = a.x + (dx / d) * c.seg;
      b.y = a.y + (dy / d) * c.seg;
    }
    if (b.y > floor) b.y = floor;
  }
}

/** Cloth chains per kit: [points, segment length px] for a and b. */
export function clothSpec(kit: Kit): { a?: [number, number]; b?: [number, number] } {
  switch (kit) {
    case 'razor':
      return { a: [9, 8], b: [4, 6] };
    case 'arc':
      return { a: [6, 8] };
    default:
      return {};
  }
}

/** Where cloth attaches for each kit (world px). */
export function clothAnchors(j: Joints, b: BuildDef): { a?: P2; b?: P2 } {
  const R = j.rig;
  const k = j.scale;
  const back: P2 = [-j.facing, 0];
  switch (b.kit) {
    case 'razor': {
      // scarf knot at the back of the neck, headband knot at the back of the head
      const n = add(lerp2(j.neck, j.shoulder, 0.3), perp(j.up), -j.facing * R.neckW * k * 0.4);
      const h = add(j.head, rotv(j.headUp, -j.facing * 1.9), j.headR * 0.95);
      return { a: n, b: h };
    }
    case 'arc': {
      // coat tail from the back of the waist, hood tip
      const w = add(lerp2(j.pelvis, j.chest, 0.25), back, R.waistD * k * 0.45);
      return { a: w };
    }
    default:
      return {};
  }
}

// ------------------------------------------------------------- drawing --

export interface Look {
  main: number;
  trim: number;
  glow: number;
  /** Replace every colour (ghosts, silhouettes). */
  solid?: number;
  alpha?: number;
  /** 0..1 white hit flash. */
  flash?: number;
  /** Halo behind the body: colour + alpha (rim light / armour / invuln). */
  halo?: { c: number; a: number; w: number };
  /** Emissive accents brighter (charging, supers). */
  charge?: number;
  /** Prop held in the front hand. */
  prop?: 'blade' | 'orb' | 'gun' | 'none';
  /** Thrusters / casting effects on. */
  power?: boolean;
  /** Front hand open (grabs, palms, casting). */
  open?: boolean;
  time: number;
  outline?: boolean;
}

export interface FigureCloth {
  a?: Cloth;
  b?: Cloth;
}

/** Light comes from the upper left of the screen. */
const TO_LIGHT: P2 = norm([-0.45, -0.9]);

type Shape = { pts: number[]; c: number };
type Detail =
  | { k: 'poly'; pts: number[]; c: number; a?: number; line?: number }
  | { k: 'line'; pts: number[]; w: number; c: number; a?: number };

class Layer {
  shapes: Shape[] = [];
  details: Detail[] = [];
  add(pts: number[], c: number) {
    this.shapes.push({ pts, c });
  }
  poly(pts: number[], c: number, a = 1, line = 0) {
    this.details.push({ k: 'poly', pts, c, a, line });
  }
  line(pts: number[], w: number, c: number, a = 1) {
    this.details.push({ k: 'line', pts, w, c, a });
  }
}

// ----- shape builders (world px) -----

/** A limb segment from a to b with widths w0 (at a), wm (bulge, 40%) and
 *  w1 (at b), round at both ends. */
function limb(a: P2, b: P2, w0: number, wm: number, w1: number): number[] {
  const d = sub(b, a);
  const L = len(d) || 0.001;
  const u: P2 = [d[0] / L, d[1] / L];
  const n = perp(u);
  const width = (t: number) => {
    // quadratic through (0,w0) (0.4,wm) (1,w1)
    if (t < 0.4) {
      const s = t / 0.4;
      return w0 + (wm - w0) * (1 - (1 - s) * (1 - s));
    }
    const s = (t - 0.4) / 0.6;
    return wm + (w1 - wm) * s * s;
  };
  const out: number[] = [];
  const N = 6;
  // side A (+n), from a to b
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = add(a, u, L * t);
    const w = width(t) / 2;
    out.push(p[0] + n[0] * w, p[1] + n[1] * w);
  }
  // cap at b
  const r1 = w1 / 2;
  for (let i = 1; i < 6; i++) {
    const ang = (i / 6) * Math.PI;
    const v = add(rotv(n, -ang), [0, 0]);
    out.push(b[0] + v[0] * r1, b[1] + v[1] * r1);
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    const p = add(a, u, L * t);
    const w = width(t) / 2;
    out.push(p[0] - n[0] * w, p[1] - n[1] * w);
  }
  const r0 = w0 / 2;
  for (let i = 1; i < 6; i++) {
    const ang = (i / 6) * Math.PI;
    const v = rotv(n, Math.PI - ang);
    out.push(a[0] + v[0] * r0, a[1] + v[1] * r0);
  }
  return out;
}

/** Angular plate from a to b: widths w0 / w1, corners cut by `ch`. */
function boxLimb(a: P2, b: P2, w0: number, w1: number, ch: number, over = 0): number[] {
  const d = norm(sub(b, a));
  const n = perp(d);
  const A = add(a, d, -over);
  const B = add(b, d, over);
  const h0 = w0 / 2;
  const h1 = w1 / 2;
  return [
    ...add(add(A, n, h0), d, ch),
    ...add(add(B, n, h1), d, -ch),
    ...add(add(B, n, h1 - ch), d, 0),
    ...add(add(B, n, -h1 + ch), d, 0),
    ...add(add(B, n, -h1), d, -ch),
    ...add(add(A, n, -h0), d, ch),
    ...add(add(A, n, -h0 + ch), d, 0),
    ...add(add(A, n, h0 - ch), d, 0),
  ];
}

function circle(c: P2, r: number, n = 14): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r);
  }
  return out;
}

/** Ellipse with its y axis along `up`. */
function oval(c: P2, rx: number, ry: number, up: P2, n = 16): number[] {
  const out: number[] = [];
  const side = perp(up);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    out.push(c[0] + side[0] * x - up[0] * y, c[1] + side[1] * x - up[1] * y);
  }
  return out;
}

/** Points in a frame: origin `o`, x along `ax`, y along `ay`. */
function frame(o: P2, ax: P2, ay: P2, pts: [number, number][]): number[] {
  const out: number[] = [];
  for (const [x, y] of pts) out.push(o[0] + ax[0] * x + ay[0] * y, o[1] + ax[1] * x + ay[1] * y);
  return out;
}

/** The spine as a quadratic curve pelvis → chest → neck, sampled. */
function spinePoint(j: Joints, t: number): { p: P2; tan: P2 } {
  const P0 = j.pelvis;
  const P2_ = j.neck;
  const C = j.chest;
  // control so the curve passes through the chest point at t = 0.5
  const Q: P2 = [2 * C[0] - (P0[0] + P2_[0]) / 2, 2 * C[1] - (P0[1] + P2_[1]) / 2];
  if (t < 0) {
    const tan0 = norm(sub(Q, P0));
    return { p: add(P0, tan0, t * len(sub(P2_, P0))), tan: tan0 };
  }
  const a = (1 - t) * (1 - t);
  const bq = 2 * (1 - t) * t;
  const c = t * t;
  const p: P2 = [a * P0[0] + bq * Q[0] + c * P2_[0], a * P0[1] + bq * Q[1] + c * P2_[1]];
  const tan = norm([2 * (1 - t) * (Q[0] - P0[0]) + 2 * t * (P2_[0] - Q[0]), 2 * (1 - t) * (Q[1] - P0[1]) + 2 * t * (P2_[1] - Q[1])]);
  return { p, tan };
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Piecewise smooth interpolation through (t, v) control points. */
function profile(ctrl: [number, number][], t: number): number {
  if (t <= ctrl[0][0]) return ctrl[0][1];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const [t0, v0] = ctrl[i];
    const [t1, v1] = ctrl[i + 1];
    if (t <= t1) return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
  }
  return ctrl[ctrl.length - 1][1];
}

/** Torso outline from the crotch to the base of the neck. `front` and
 *  `back` are depth profiles (px) on each side of the spine. */
function torso(j: Joints, front: [number, number][], back_: [number, number][], t0 = -0.16, t1 = 1): number[] {
  const fr: number[] = [];
  const bk: number[] = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const t = t0 + ((t1 - t0) * i) / N;
    const { p, fwd } = spineFrame(j, t);
    const df = profile(front, t) * j.scale;
    const db = profile(back_, t) * j.scale;
    fr.push(p[0] + fwd[0] * df, p[1] + fwd[1] * df);
    bk.push(p[0] - fwd[0] * db, p[1] - fwd[1] * db);
  }
  const out: number[] = [...fr];
  for (let i = bk.length - 2; i >= 0; i -= 2) out.push(bk[i], bk[i + 1]);
  return out;
}

/** Spine frame at t: point, unit tangent (up the spine) and the unit
 *  normal toward the front. */
function spineFrame(j: Joints, t: number): { p: P2; up: P2; fwd: P2 } {
  const { p, tan } = spinePoint(j, t);
  const nn: P2 = [-tan[1], tan[0]];
  const fwd: P2 = nn[0] * j.facing > 0 ? nn : [-nn[0], -nn[1]];
  return { p, up: tan, fwd };
}

/** Shoe from the ankle: heel → toe along `d`, the sole on the side away
 *  from the knee. `chunk` thickens boots. */
function shoe(j: Joints, ank: P2, knee: P2, d: P2, chunk = 1): number[] {
  const L = j.rig.foot * j.H;
  const A = j.rig.ankle * j.H;
  const toKnee = sub(knee, ank);
  const along = toKnee[0] * d[0] + toKnee[1] * d[1];
  const up = norm([toKnee[0] - d[0] * along, toKnee[1] - d[1] * along]);
  const c = chunk;
  return frame(ank, d, up, [
    [-0.26 * L, -0.35 * A],
    [-0.2 * L, -A],
    [0.66 * L, -A],
    [0.9 * L, -0.72 * A],
    [0.86 * L, -0.22 * A],
    [0.44 * L, 0.32 * A * c],
    [0.16 * L, 0.95 * A * c],
    [-0.16 * L, 0.9 * A * c],
    [-0.3 * L, 0.12 * A],
  ]);
}

/** Fist (or open hand) at the wrist, along the hand direction. */
function hand(w: P2, d: P2, size: number, open: boolean): number[] {
  const n = perp(d);
  if (open) {
    return frame(w, d, n, [
      [-0.1 * size, -0.36 * size],
      [0.55 * size, -0.42 * size],
      [1.05 * size, -0.22 * size],
      [1.12 * size, 0.06 * size],
      [0.7 * size, 0.24 * size],
      [0.5 * size, 0.58 * size],
      [0.25 * size, 0.62 * size],
      [0.08 * size, 0.36 * size],
      [-0.12 * size, 0.3 * size],
    ]);
  }
  return frame(w, d, n, [
    [-0.12 * size, -0.42 * size],
    [0.52 * size, -0.5 * size],
    [0.78 * size, -0.36 * size],
    [0.84 * size, 0.1 * size],
    [0.66 * size, 0.46 * size],
    [0.2 * size, 0.52 * size],
    [-0.12 * size, 0.36 * size],
  ]);
}

/** Thin highlight strip along a segment on the side facing the light. */
function highlight(L: Layer, a: P2, b: P2, w: number, c: number, amt = 0.22, alpha = 0.8) {
  const u = norm(sub(b, a));
  let n = perp(u);
  if (n[0] * TO_LIGHT[0] + n[1] * TO_LIGHT[1] < 0) n = [-n[0], -n[1]];
  const off = w * 0.24;
  const p0 = add(lerp2(a, b, 0.12), n, off);
  const p1 = add(lerp2(a, b, 0.86), n, off);
  L.line([p0[0], p0[1], p1[0], p1[1]], Math.max(1, w * 0.28), lighten(c, amt), alpha);
}

// ----- palettes -----

interface Pal {
  ink: number;
  a: number;
  main: number;
  mainB: number;
  trim: number;
  glow: number;
  solid: boolean;
  fl: (c: number) => number;
}

function pal(look: Look): Pal {
  const a = look.alpha ?? 1;
  if (look.solid !== undefined) {
    const c = look.solid;
    return { ink: darken(c, 0.55), a, main: c, mainB: c, trim: c, glow: c, solid: true, fl: () => c };
  }
  const f = look.flash ?? 0;
  const fl = (c: number) => (f > 0 ? mix(c, 0xffffff, f) : c);
  return {
    ink: fl(INK),
    a,
    main: fl(look.main),
    mainB: fl(darken(look.main, 0.32)),
    trim: fl(look.trim),
    glow: fl(lighten(look.glow, (look.charge ?? 0) * 0.5)),
    solid: false,
    fl,
  };
}

// ----- the generic body -----

interface BodyCols {
  torso: number;
  armU: number;
  armF: number;
  hand: number;
  thigh: number;
  shin: number;
  shoe: number;
  neck: number;
  head: number;
}

/** Back-limb colours are a step darker so the near side reads in front. */
const back = (c: number, P: Pal) => darken(c, P.solid ? 0.22 : 0.3);

function armShapes(L: Layer, j: Joints, front: boolean, C: BodyCols, P: Pal, open: boolean, gauntlet = 1) {
  const R = j.rig;
  const k = j.scale;
  const sh = j.shoulder;
  const el = front ? j.fElbow : j.bElbow;
  const wr = front ? j.fHand : j.bHand;
  const hd = front ? j.fHandDir : j.bHandDir;
  const col = (c: number) => (front ? c : back(c, P));
  L.add(limb(sh, el, R.upperArmW * k, R.bicepW * k, R.elbowW * k), col(C.armU));
  L.add(limb(el, wr, R.elbowW * k, R.forearmW * k * gauntlet, R.wristW * k), col(C.armF));
  L.add(hand(wr, hd, R.handW * k, open), col(C.hand));
  if (front && !P.solid) {
    highlight(L, sh, el, R.bicepW * k, C.armU);
    highlight(L, el, wr, R.forearmW * k, C.armF);
  }
}

function legShapes(L: Layer, j: Joints, front: boolean, C: BodyCols, P: Pal, chunk = 1, shine = true) {
  const R = j.rig;
  const k = j.scale;
  const kn = front ? j.fKnee : j.bKnee;
  const an = front ? j.fFoot : j.bFoot;
  const fd = front ? j.fFootDir : j.bFootDir;
  const col = (c: number) => (front ? c : back(c, P));
  L.add(limb(j.pelvis, kn, R.thighW * k, R.thighW * k * 0.98, R.kneeW * k), col(C.thigh));
  L.add(limb(kn, an, R.kneeW * k, R.calfW * k, R.ankleW * k), col(C.shin));
  L.add(shoe(j, an, kn, fd, chunk), col(C.shoe));
  if (front && !P.solid && shine) {
    highlight(L, j.pelvis, kn, R.thighW * k, C.thigh);
    highlight(L, kn, an, R.calfW * k, C.shin);
  }
}

function torsoShape(j: Joints): number[] {
  const R = j.rig;
  const front: [number, number][] = [
    [-0.16, R.hipD * 0.3],
    [0, R.hipD * 0.44],
    [0.3, R.waistD * 0.5],
    [0.62, R.chestD * R.chestFwd],
    [0.86, R.shoulderD * 0.46],
    [1, R.neckW * 0.5],
  ];
  const backP: [number, number][] = [
    [-0.16, R.hipD * 0.36],
    [0, R.hipD * 0.56],
    [0.3, R.waistD * 0.5],
    [0.62, R.chestD * (1 - R.chestFwd)],
    [0.86, R.shoulderD * 0.54],
    [1, R.neckW * 0.5],
  ];
  return torso(j, front, backP);
}

function neckShape(j: Joints): number[] {
  const R = j.rig;
  const k = j.scale;
  const base = lerp2(j.shoulder, j.neck, 0.4);
  const top = add(j.head, j.headUp, -j.headR * 0.55);
  return limb(base, top, R.neckW * k * 1.05, R.neckW * k, R.neckW * k * 0.92);
}

/** Head: an egg with a jaw toward the front. */
function headShape(j: Joints, jaw = 0.14, w = 0.92, h = 1.05): number[] {
  const r = j.headR;
  const up = j.headUp;
  const side = perp(up);
  // side points toward the face?
  const fwd: P2 = side[0] * j.facing > 0 || (Math.abs(side[0]) < 1e-6 && side[1] < 0) ? side : [-side[0], -side[1]];
  const out: number[] = [];
  const N = 18;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    let x = Math.cos(a) * r * w;
    let y = Math.sin(a) * r * h;
    // jaw: push the lower front outward
    if (x > 0 && y < 0) {
      const t = Math.sin(-a);
      x += r * jaw * Math.max(0, Math.cos(a)) * t;
      y -= r * jaw * 0.6 * t * Math.max(0, Math.cos(a));
    }
    out.push(j.head[0] + fwd[0] * x + up[0] * y, j.head[1] + fwd[1] * x + up[1] * y);
  }
  return out;
}

/** Face frame: origin at the head centre, x toward the face, y up. */
function faceFrame(j: Joints): { o: P2; fwd: P2; up: P2 } {
  const up = j.headUp;
  const side = perp(up);
  const fwd: P2 = side[0] * j.facing > 0 || (Math.abs(side[0]) < 1e-6 && side[1] < 0) ? side : [-side[0], -side[1]];
  return { o: j.head, fwd, up };
}

function fp(j: Joints, pts: [number, number][]): number[] {
  const f = faceFrame(j);
  const r = j.headR;
  return frame(f.o, f.fwd, f.up, pts.map(([x, y]) => [x * r, y * r] as [number, number]));
}

// ----- painter -----

function paint(pen: Pen, layers: Layer[], P: Pal, ol: number, halo?: Look['halo']) {
  const a = P.a;
  if (halo && !P.solid) {
    for (const L of layers) for (const s of L.shapes) pen.poly(s.pts, null, 1, { w: halo.w * 2 + ol * 2, c: halo.c, a: halo.a * a });
  }
  for (const L of layers) {
    if (ol > 0) for (const s of L.shapes) pen.poly(s.pts, P.ink, a, { w: ol * 2, c: P.ink, a });
    for (const s of L.shapes) pen.poly(s.pts, s.c, a);
    for (const d of L.details) {
      if (d.k === 'poly') pen.poly(d.pts, d.c, (d.a ?? 1) * a, d.line ? { w: d.line, c: P.ink, a } : undefined);
      else pen.line(d.pts, d.w, d.c, (d.a ?? 1) * a);
    }
  }
}

function drawCloth(L: Layer, c: Cloth, w0: number, w1: number, col: number) {
  const p = c.pts;
  if (p.length < 2) return;
  const left: number[] = [];
  const right: number[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[Math.max(0, i - 1)];
    const b = p[Math.min(p.length - 1, i + 1)];
    const d = norm([b.x - a.x, b.y - a.y]);
    const n = perp(d);
    const t = i / (p.length - 1);
    const w = (w0 + (w1 - w0) * t) / 2;
    left.push(p[i].x + n[0] * w, p[i].y + n[1] * w);
    right.push(p[i].x - n[0] * w, p[i].y - n[1] * w);
  }
  const out = [...left];
  for (let i = right.length - 2; i >= 0; i -= 2) out.push(right[i], right[i + 1]);
  L.add(out, col);
}

// ----------------------------------------------------------------- kits --

export function drawFigure(pen: Pen, j: Joints, b: BuildDef, look: Look, cloth: FigureCloth = {}) {
  const P = pal(look);
  const ol = look.outline === false ? 0 : Math.max(1, (P.solid ? 1.1 : 1.5) * j.scale);
  let layers: Layer[];
  switch (b.kit) {
    case 'razor':
      layers = razor(j, look, P, cloth);
      break;
    case 'titan':
      layers = titan(j, look, P);
      break;
    case 'arc':
      layers = arc(j, look, P, cloth);
      break;
    default:
      layers = grip(j, look, P);
  }
  paint(pen, layers, P, ol, look.halo);
}

// --- RAZOR: a ninja. Dark suit, long scarf, wrapped forearms and shins,
//     a katana on her back.

function razor(j: Joints, look: Look, P: Pal, cloth: FigureCloth): Layer[] {
  const k = j.scale;
  const R = j.rig;
  const suit = P.solid ? P.main : P.fl(mix(P.trim, 0x0e0f16, 0.55));
  const wrap = P.solid ? P.main : P.fl(0xd9d2c2);
  const C: BodyCols = { torso: suit, armU: suit, armF: wrap, hand: suit, thigh: suit, shin: suit, shoe: P.solid ? P.main : darken(suit, 0.25), neck: suit, head: suit };
  const L0 = new Layer();
  const L1 = new Layer();
  const L2 = new Layer();
  const L3 = new Layer();
  const L4 = new Layer();

  // scarf + headband tails behind everything
  if (cloth.a) drawCloth(L0, cloth.a, 7.5 * k, 3 * k, P.solid ? P.main : P.mainB);
  if (cloth.b) drawCloth(L0, cloth.b, 3.4 * k, 1.6 * k, P.main);
  // katana sheath across the back
  const sf = spineFrame(j, 0.55);
  const sheathA = add(add(sf.p, sf.fwd, -R.chestD * k * 0.55), sf.up, -R.spine * j.H * 0.45);
  const sheathB = add(add(sf.p, sf.fwd, -R.chestD * k * 0.3), sf.up, R.spine * j.H * 0.62);
  L0.add(limb(sheathA, sheathB, 4.6 * k, 4.6 * k, 4 * k), P.solid ? P.main : 0x1a1418);
  if (look.prop !== 'blade') {
    // hilt over the shoulder
    const hd = norm(sub(sheathB, sheathA));
    const hiltEnd = add(sheathB, hd, 15 * k);
    L0.add(limb(sheathB, hiltEnd, 3.8 * k, 3.8 * k, 3.6 * k), P.solid ? P.main : wrap);
    L0.poly(oval(add(sheathB, hd, 1.5 * k), 5.5 * k, 1.8 * k, hd), P.main, 1, 0);
  }

  armShapes(L1, j, false, C, P, false);
  legShapes(L1, j, false, C, P);
  if (!P.solid) shinWrap(L1, j, false, back(wrap, P));

  L2.add(torsoShape(j), C.torso);
  L2.add(neckShape(j), C.neck);
  L2.add(headShape(j, 0.1), C.head);
  if (!P.solid) {
    // sash knotted at the hip
    const w0 = spineFrame(j, 0.06);
    const w1 = spineFrame(j, 0.2);
    const sashF0 = add(w0.p, w0.fwd, R.hipD * k * 0.5);
    const sashB0 = add(w0.p, w0.fwd, -R.hipD * k * 0.6);
    const sashF1 = add(w1.p, w1.fwd, R.waistD * k * 0.55);
    const sashB1 = add(w1.p, w1.fwd, -R.waistD * k * 0.55);
    L2.poly([...sashB0, ...sashF0, ...sashF1, ...sashB1], P.main, 1);
    const knot = add(w0.p, w0.fwd, -R.hipD * k * 0.5);
    L2.line([knot[0], knot[1], knot[0] - j.facing * 5 * k, knot[1] + 9 * k], 3 * k, P.mainB);
    // chest crossing strap (the sheath belt)
    const s0 = spineFrame(j, 0.3);
    const s1 = spineFrame(j, 0.9);
    const a0 = add(s0.p, s0.fwd, R.waistD * k * 0.5);
    const a1 = add(s1.p, s1.fwd, -R.shoulderD * k * 0.45);
    L2.line([a0[0], a0[1], a1[0], a1[1]], 2.2 * k, darken(suit, 0.5), 0.9);
    // highlight down the back/chest
    const h0 = spineFrame(j, 0.15);
    const h1 = spineFrame(j, 0.85);
    highlight(L2, h0.p, h1.p, R.chestD * k * 0.8, suit, 0.12, 0.6);
    // hood: face opening with a glowing eye slit
    L2.poly(fp(j, [[0.18, 0.28], [0.98, 0.3], [1.06, -0.04], [0.92, -0.2], [0.2, -0.16]]), mix(suit, 0x000000, 0.4), 1);
    L2.line(fp(j, [[0.38, 0.1], [1.0, 0.13]]), 2.1 * k, P.glow, 1);
    // headband
    L2.line(fp(j, [[-0.95, 0.52], [0.0, 0.62], [0.92, 0.45]]), 3 * k, P.main, 1);
    // scarf wrap at the neck
    const nk = lerp2(j.shoulder, j.neck, 0.5);
    L2.poly(oval(nk, R.neckW * k * 1.2, 4 * k, j.up), P.main, 1, 0);
  }

  legShapes(L3, j, true, C, P);
  if (!P.solid) shinWrap(L3, j, true, wrap);

  if (look.prop === 'blade') blade(L4, j, P, wrap);
  armShapes(L4, j, true, C, P, !!look.open);
  if (!P.solid) {
    // wrap seams on the forearm
    for (const t of [0.35, 0.62, 0.86]) {
      const p = lerp2(j.fElbow, j.fHand, t);
      const n = perp(norm(sub(j.fHand, j.fElbow)));
      const w = R.forearmW * k * 0.5;
      L4.line([p[0] + n[0] * w, p[1] + n[1] * w, p[0] - n[0] * w, p[1] - n[1] * w], 0.9 * k, darken(wrap, 0.35), 0.8);
    }
  }
  return [L0, L1, L2, L3, L4];
}

function shinWrap(L: Layer, j: Joints, front: boolean, c: number) {
  const k = j.scale;
  const R = j.rig;
  const kn = front ? j.fKnee : j.bKnee;
  const an = front ? j.fFoot : j.bFoot;
  const a = lerp2(kn, an, 0.45);
  L.poly(limb(a, an, R.calfW * k * 0.95, R.calfW * k * 0.85, R.ankleW * k * 1.05), c, 1, 0);
  for (const t of [0.6, 0.78]) {
    const p = lerp2(kn, an, t);
    const n = perp(norm(sub(an, kn)));
    const w = R.calfW * k * 0.45;
    L.line([p[0] + n[0] * w, p[1] + n[1] * w, p[0] - n[0] * w, p[1] - n[1] * w], 0.9 * k, darken(c, 0.35), 0.8);
  }
}

function blade(L: Layer, j: Joints, P: Pal, wrap: number) {
  const k = j.scale;
  const d = j.fHandDir;
  const n = perp(d);
  const grip0 = add(j.fHand, d, -4 * k);
  const guard = add(j.fHand, d, 8 * k);
  const tip = add(guard, d, 50 * k);
  // slight curve: bend the blade's middle off the line
  const curve = j.facing * 2.2 * k;
  const mid = add(lerp2(guard, tip, 0.55), n, curve * (n[1] < 0 ? 1 : -1));
  L.add(limb(grip0, guard, 3.6 * k, 3.6 * k, 3.4 * k), P.solid ? P.main : wrap);
  const edge = P.solid ? P.main : 0xe8f2ff;
  const back_ = P.solid ? P.main : 0x9fb0c8;
  L.add(
    [
      ...add(guard, n, 1.9 * k),
      ...add(mid, n, 1.7 * k),
      ...tip,
      ...add(mid, n, -1.5 * k),
      ...add(guard, n, -1.9 * k),
    ],
    back_,
  );
  if (!P.solid) {
    L.line([...add(guard, n, 0.6 * k), ...mid, ...tip], 1.2 * k, edge, 1);
    L.poly(oval(guard, 1.8 * k, 5.2 * k, d), P.main, 1, 0.8 * k);
  }
}

// --- TITAN: an armoured siege mech. Angular orange plates over a dark
//     servo frame, a reactor core, shield pauldrons, heavy gauntlets.

function titan(j: Joints, look: Look, P: Pal): Layer[] {
  const k = j.scale;
  const R = j.rig;
  const under = P.solid ? P.main : P.fl(mix(P.trim, 0x15151d, 0.5));
  const plate = P.main;
  const plateB = P.solid ? P.main : P.mainB;
  const L0 = new Layer();
  const L1 = new Layer();
  const L2 = new Layer();
  const L3 = new Layer();
  const L4 = new Layer();

  // reactor pack on the back
  const pk = spineFrame(j, 0.7);
  const pc = add(pk.p, pk.fwd, -R.chestD * k * (1 - R.chestFwd) * 0.95);
  L0.add(frame(pc, pk.fwd, pk.up, [[-8 * k, 13 * k], [4 * k, 15 * k], [6 * k, -12 * k], [-3 * k, -15 * k], [-9 * k, -9 * k]]), P.solid ? P.main : darken(under, 0.1));
  const noz = add(add(pc, pk.up, -15 * k), pk.fwd, -2 * k);
  L0.add(boxLimb(noz, add(noz, pk.up, -6 * k), 7 * k, 10 * k, 1.5 * k), P.solid ? P.main : darken(plate, 0.45));
  if (look.power && !P.solid) {
    const fl = 0.7 + 0.3 * Math.sin(look.time * 55);
    const tip = add(noz, pk.up, -28 * k * fl);
    L0.poly(limb(add(noz, pk.up, -6 * k), tip, 9 * k, 7 * k, 2 * k), P.glow, 0.85);
    L0.poly(limb(add(noz, pk.up, -6 * k), add(noz, pk.up, -16 * k * fl), 4 * k, 3 * k, 1 * k), 0xffffff, 0.9);
  }

  mechArm(L1, j, false, under, back(plate, P), P);
  mechLeg(L1, j, false, under, back(plate, P), P);

  // body: dark frame, chest plate, core, hip plates
  L2.add(torsoShape(j), under);
  L2.add(neckShape(j), darken(under, 0.15));
  if (!P.solid) {
    for (const t of [0.12, 0.24, 0.36]) {
      const s = spineFrame(j, t);
      const a = add(s.p, s.fwd, R.waistD * k * 0.5);
      const b = add(s.p, s.fwd, -R.waistD * k * 0.35);
      L2.line([a[0], a[1], b[0], b[1]], 2 * k, darken(under, 0.5), 0.9);
    }
    const c0 = spineFrame(j, 0.4);
    const c1 = spineFrame(j, 0.97);
    const cm = spineFrame(j, 0.7);
    L2.poly(
      [
        ...add(c0.p, c0.fwd, R.waistD * k * 0.56),
        ...add(cm.p, cm.fwd, R.chestD * k * R.chestFwd * 1.05),
        ...add(c1.p, c1.fwd, R.shoulderD * k * 0.46),
        ...add(c1.p, c1.fwd, -R.shoulderD * k * 0.2),
        ...add(cm.p, cm.fwd, -R.chestD * k * 0.1),
        ...add(c0.p, c0.fwd, -R.waistD * k * 0.05),
      ],
      plate,
      1,
      1.3 * k,
    );
    highlight(L2, add(c0.p, c0.fwd, R.waistD * k * 0.35), add(c1.p, c1.fwd, R.shoulderD * k * 0.25), 12 * k, plate, 0.3, 0.6);
    const core = add(cm.p, cm.fwd, R.chestD * k * 0.3);
    L2.poly(frame(core, cm.fwd, cm.up, [[-6 * k, 0], [-3 * k, 5.5 * k], [3 * k, 5.5 * k], [6 * k, 0], [3 * k, -5.5 * k], [-3 * k, -5.5 * k]]), darken(plate, 0.6), 1, 1 * k);
    L2.poly(circle(core, 3.6 * k, 10), P.glow, 1);
    L2.poly(circle(core, 1.8 * k, 8), 0xffffff, 0.9);
    const h0 = spineFrame(j, -0.12);
    const h1 = spineFrame(j, 0.1);
    L2.poly(
      [
        ...add(h1.p, h1.fwd, R.hipD * k * 0.52),
        ...add(h0.p, h0.fwd, R.hipD * k * 0.58),
        ...add(h0.p, h0.fwd, R.hipD * k * 0.05),
        ...add(h1.p, h1.fwd, R.hipD * k * 0.0),
      ],
      plateB,
      1,
      1 * k,
    );
  }
  // helmet: angular, visor slit, a fin on top
  L2.add(fp(j, [[-0.95, -0.75], [-1.05, 0.55], [-0.55, 1.12], [0.55, 1.15], [1.05, 0.7], [1.15, -0.2], [0.95, -0.9], [-0.2, -1.0]]), plate);
  if (!P.solid) {
    L2.poly(fp(j, [[0.25, 0.32], [1.2, 0.28], [1.22, -0.18], [0.3, -0.12]]), darken(under, 0.35), 1);
    L2.line(fp(j, [[0.42, 0.08], [1.12, 0.06]]), 2.6 * k, P.glow, 1);
    L2.poly(fp(j, [[-0.7, 1.0], [-0.1, 1.6], [0.25, 1.1]]), plateB, 1, 0.9 * k);
    highlight(L2, fp(j, [[-0.6, 0.9]]) as unknown as P2, fp(j, [[0.6, 0.95]]) as unknown as P2, 5 * k, plate, 0.35, 0.6);
  }

  mechLeg(L3, j, true, under, plate, P);
  mechArm(L4, j, true, under, plate, P, !!look.open);
  return [L0, L1, L2, L3, L4];
}

/** Servo upper arm, angular gauntlet + fist, shield pauldron. */
function mechArm(L: Layer, j: Joints, front: boolean, under: number, plate: number, P: Pal, open = false) {
  const k = j.scale;
  const R = j.rig;
  const el = front ? j.fElbow : j.bElbow;
  const wr = front ? j.fHand : j.bHand;
  const hd = front ? j.fHandDir : j.bHandDir;
  const u = front ? under : back(under, P);
  L.add(limb(j.shoulder, el, R.upperArmW * k, R.upperArmW * k, R.elbowW * k), u);
  L.add(circle(el, R.elbowW * k * 0.55, 10), darken(u, 0.2));
  L.add(boxLimb(lerp2(el, wr, 0.06), wr, R.forearmW * k, R.wristW * k, 4 * k, 2 * k), plate);
  L.add(hand(wr, hd, R.handW * k, open), P.solid ? plate : darken(plate, 0.35));
  // pauldron: a shield plate over the shoulder
  const d = norm(sub(el, j.shoulder));
  const n = perp(d);
  const out: P2 = n[0] * j.facing < 0 ? n : [-n[0], -n[1]];
  void out;
  const pts = frame(add(j.shoulder, d, 3 * k), d, n, [
    [-8 * k, -10 * k],
    [3 * k, -12.5 * k],
    [15 * k, -11 * k],
    [18 * k, 0],
    [15 * k, 11 * k],
    [3 * k, 12.5 * k],
    [-8 * k, 10 * k],
    [-10 * k, 0],
  ]);
  if (front) {
    L.poly(pts, plate, 1, 1.3 * k);
    if (!P.solid) {
      L.line([...add(add(j.shoulder, d, 17 * k), n, 10 * k), ...add(add(j.shoulder, d, 17 * k), n, -10 * k)], 1.8 * k, darken(plate, 0.4), 1);
      L.poly(oval(add(j.shoulder, TO_LIGHT, 6 * k), 5 * k, 3 * k, d), lighten(plate, 0.35), 0.5);
      // gauntlet seam
      const g = lerp2(el, wr, 0.55);
      const gn = perp(norm(sub(wr, el)));
      const w = R.forearmW * k * 0.48;
      L.line([g[0] + gn[0] * w, g[1] + gn[1] * w, g[0] - gn[0] * w, g[1] - gn[1] * w], 1.6 * k, darken(plate, 0.4), 1);
      highlight(L, el, wr, R.forearmW * k, plate, 0.3, 0.6);
    }
  } else L.add(pts, plate);
}

/** Servo thigh with a front plate, knee joint, angular shin, block boot. */
function mechLeg(L: Layer, j: Joints, front: boolean, under: number, plate: number, P: Pal) {
  const k = j.scale;
  const R = j.rig;
  const kn = front ? j.fKnee : j.bKnee;
  const an = front ? j.fFoot : j.bFoot;
  const fd = front ? j.fFootDir : j.bFootDir;
  const u = front ? under : back(under, P);
  L.add(limb(j.pelvis, kn, R.thighW * k * 0.9, R.thighW * k * 0.85, R.kneeW * k), u);
  // thigh plate
  const td = norm(sub(kn, j.pelvis));
  const tf: P2 = perp(td)[0] * j.facing > 0 ? perp(td) : [-perp(td)[0], -perp(td)[1]];
  L.add(boxLimb(add(lerp2(j.pelvis, kn, 0.12), tf, R.thighW * k * 0.12), add(lerp2(j.pelvis, kn, 0.86), tf, R.thighW * k * 0.1), R.thighW * k * 0.8, R.kneeW * k * 0.85, 3 * k), plate);
  L.add(circle(kn, R.kneeW * k * 0.52, 10), darken(u, 0.2));
  L.add(boxLimb(lerp2(kn, an, 0.04), an, R.calfW * k, R.ankleW * k, 4 * k, 1 * k), plate);
  L.add(shoe(j, an, kn, fd, 1.35), P.solid ? plate : darken(plate, 0.4));
  if (front && !P.solid) {
    const kd = norm(sub(an, kn));
    const kf: P2 = perp(kd)[0] * j.facing > 0 ? perp(kd) : [-perp(kd)[0], -perp(kd)[1]];
    L.poly(frame(add(kn, kf, R.kneeW * k * 0.3), kd, kf, [[-6 * k, -2 * k], [-2 * k, 4 * k], [6 * k, 3 * k], [7 * k, -3 * k], [0, -6 * k]]), lighten(plate, 0.1), 1, 1.1 * k);
    highlight(L, kn, an, R.calfW * k, plate, 0.3, 0.6);
    const sn = lerp2(kn, an, 0.6);
    const n = perp(kd);
    const w = R.calfW * k * 0.42;
    L.line([sn[0] + n[0] * w, sn[1] + n[1] * w, sn[0] - n[0] * w, sn[1] - n[1] * w], 1.6 * k, darken(plate, 0.4), 1);
  }
}

function kneePad(L: Layer, j: Joints, front: boolean, c: number, P: Pal) {
  const k = j.scale;
  const kn = front ? j.fKnee : j.bKnee;
  const an = front ? j.fFoot : j.bFoot;
  const d = norm(sub(an, kn));
  const fwd: P2 = perp(d)[0] * j.facing > 0 ? perp(d) : [-perp(d)[0], -perp(d)[1]];
  const pc = add(kn, fwd, j.rig.kneeW * k * 0.22);
  const rx = j.rig.kneeW * k * 0.46;
  const ry = j.rig.kneeW * k * 0.56;
  if (front) L.poly(oval(pc, rx, ry, d), c, 1, 1.1 * k);
  else L.add(oval(pc, rx, ry, d), c);
  void P;
}

function thighPlate(L: Layer, j: Joints, c: number) {
  const k = j.scale;
  const R = j.rig;
  const a = lerp2(j.pelvis, j.fKnee, 0.18);
  const b = lerp2(j.pelvis, j.fKnee, 0.8);
  const d = norm(sub(b, a));
  const fwd: P2 = perp(d)[0] * j.facing > 0 ? perp(d) : [-perp(d)[0], -perp(d)[1]];
  L.poly(limb(add(a, fwd, R.thighW * k * 0.12), add(b, fwd, R.thighW * k * 0.1), R.thighW * k * 0.78, R.thighW * k * 0.8, R.kneeW * k * 0.7), c, 1, 1.1 * k);
}

// --- ARC: a storm wizard. Wide-brimmed pointed hat with eyes glowing in
//     its shadow, a long coat that flares open at the hem, bell sleeves,
//     glowing hands.

function arc(j: Joints, look: Look, P: Pal, cloth: FigureCloth): Layer[] {
  const k = j.scale;
  const R = j.rig;
  const coat = P.main;
  const coatB = P.solid ? P.main : P.mainB;
  const dark = P.solid ? P.main : P.fl(mix(P.trim, 0x0d0c14, 0.5));
  const gold = P.solid ? P.main : P.fl(0xe9c46a);
  const skin = P.solid ? P.main : P.fl(mix(P.glow, 0xf2e6da, 0.55));
  const C: BodyCols = { torso: coat, armU: coat, armF: coat, hand: skin, thigh: dark, shin: dark, shoe: P.solid ? P.main : darken(dark, 0.35), neck: dark, head: darken(dark, 0.3) };
  const L0 = new Layer();
  const L1 = new Layer();
  const L2 = new Layer();
  const L3 = new Layer();
  const L4 = new Layer();

  if (cloth.a) drawCloth(L0, cloth.a, 12 * k, 8 * k, coatB);
  L0.add(coatPanel(j, false), coatB);

  armShapes(L1, j, false, C, P, false);
  sleeve(L1, j, false, coatB, gold, P);
  legShapes(L1, j, false, C, P);

  L2.add(torsoShape(j), coat);
  L2.add(neckShape(j), dark);
  L2.add(headShape(j, 0.08, 0.9, 1.0), C.head);
  // hat: brim + a cone that bends back
  L2.add(hatCone(j), coat);
  L2.add(fp(j, [[-1.7, 0.58], [-0.2, 0.86], [1.75, 0.66], [1.8, 0.48], [0.1, 0.34], [-1.65, 0.36]]), coat);
  if (!P.solid) {
    L2.line(fp(j, [[-0.75, 0.82], [0.0, 0.98], [0.78, 0.86]]), 2.4 * k, gold, 1);
    const glowEye = (x: number, y: number) => L2.poly(fp(j, [[x - 0.12, y], [x + 0.08, y + 0.08], [x + 0.13, y - 0.04], [x - 0.06, y - 0.1]]), P.glow, 1);
    glowEye(0.48, 0.02);
    glowEye(0.78, 0.0);
    // collar
    const s = spineFrame(j, 0.95);
    L2.poly(frame(s.p, s.fwd, s.up, [[-R.shoulderD * k * 0.58, -3 * k], [R.shoulderD * k * 0.52, -3 * k], [R.shoulderD * k * 0.6, 6 * k], [-R.shoulderD * k * 0.72, 9 * k]]), coatB, 1, 1 * k);
    // gold trim down the front
    const t0 = spineFrame(j, 0.1);
    const t1 = spineFrame(j, 0.9);
    const ta = add(t0.p, t0.fwd, R.waistD * k * 0.46);
    const tb = add(t1.p, t1.fwd, R.shoulderD * k * 0.4);
    L2.line([ta[0], ta[1], tb[0], tb[1]], 1.5 * k, gold, 0.95);
    // sash with a glowing charm
    const w = spineFrame(j, 0.18);
    const bA = add(w.p, w.fwd, R.waistD * k * 0.56);
    const bB = add(w.p, w.fwd, -R.waistD * k * 0.56);
    L2.line([bA[0], bA[1], bB[0], bB[1]], 3.2 * k, darken(dark, 0.1), 1);
    L2.poly(circle(add(w.p, w.fwd, R.waistD * k * 0.42), 2.6 * k, 8), P.glow, 1);
    highlight(L2, spineFrame(j, 0.2).p, spineFrame(j, 0.85).p, R.chestD * k * 0.7, coat, 0.14, 0.6);
  }

  legShapes(L3, j, true, C, P, 1, false);
  L3.add(coatPanel(j, true), coat);
  if (!P.solid) L3.line(coatHem(j, true), 1.6 * k, gold, 0.9);

  armShapes(L4, j, true, C, P, look.open !== false);
  sleeve(L4, j, true, coat, gold, P);
  if (look.power && !P.solid) {
    const f = 0.8 + 0.2 * Math.sin(look.time * 40);
    L4.poly(circle(j.fHand, R.handW * k * 1.9 * f, 14), P.glow, 0.28);
    L4.poly(circle(j.fHand, R.handW * k * 0.95, 12), lighten(P.glow, 0.5), 0.85);
  }
  return [L0, L1, L2, L3, L4];
}

/** Coat skirt panel from the waist down past the knee of one leg: flares
 *  toward a curved hem and follows its thigh, so kicks split the coat. */
function coatPanel(j: Joints, front: boolean): number[] {
  const k = j.scale;
  const R = j.rig;
  const kn = front ? j.fKnee : j.bKnee;
  const w = spineFrame(j, 0.14);
  const td = norm(sub(kn, j.pelvis));
  const hemC = add(kn, td, R.shin * j.H * 0.3);
  const side = perp(td);
  const sideF: P2 = side[0] * j.facing > 0 ? side : [-side[0], -side[1]];
  const hemW = R.hipD * k * (front ? 0.78 : 0.9);
  const wF = add(w.p, w.fwd, R.waistD * k * 0.56);
  const wB = add(w.p, w.fwd, -R.waistD * k * 0.62);
  const hF = add(hemC, sideF, hemW * 0.55);
  const hB = add(hemC, sideF, -hemW * 0.55);
  const midF = add(lerp2(wF, hF, 0.5), sideF, 2.5 * k);
  const midB = add(lerp2(wB, hB, 0.5), sideF, -2.5 * k);
  const hemMid = add(hemC, td, 2.5 * k);
  return [...wB, ...wF, ...midF, ...hF, ...hemMid, ...hB, ...midB];
}

function coatHem(j: Joints, front: boolean): number[] {
  const p = coatPanel(j, front);
  return [p[6], p[7], p[8], p[9], p[10], p[11]];
}

/** Pointed hat cone rising from the brim and bending back. */
function hatCone(j: Joints): number[] {
  return fp(j, [
    [-0.95, 0.6],
    [-0.55, 1.75],
    [-0.9, 2.55],
    [-1.75, 2.9],
    [-1.25, 2.45],
    [-0.3, 2.2],
    [0.1, 1.4],
    [0.85, 0.62],
  ]);
}

function sleeve(L: Layer, j: Joints, front: boolean, c: number, gold: number, P: Pal) {
  const k = j.scale;
  const R = j.rig;
  const el = front ? j.fElbow : j.bElbow;
  const wr = front ? j.fHand : j.bHand;
  const d = norm(sub(wr, el));
  const n = perp(d);
  const cuff = add(wr, d, -R.forearm * j.H * 0.1);
  const flare = R.forearmW * k * 0.95;
  const e = R.elbowW * k * 0.62;
  const pts = [
    ...add(el, n, e),
    ...add(lerp2(el, cuff, 0.55), n, e * 1.15),
    ...add(cuff, n, flare),
    ...add(add(cuff, d, 1.5 * k), n, 0),
    ...add(cuff, n, -flare),
    ...add(lerp2(el, cuff, 0.55), n, -e * 1.15),
    ...add(el, n, -e),
  ];
  if (front) {
    L.poly(pts, c, 1, 1.2 * k);
    if (!P.solid) L.line([...add(cuff, n, flare * 0.92), ...add(cuff, n, -flare * 0.92)], 1.8 * k, gold, 0.95);
  } else L.add(pts, c);
}

// --- GRIP: a pro wrestler. Huge V-shaped torso, mask, singlet, title belt,
//     knee pads and boots, taped wrists.

function grip(j: Joints, look: Look, P: Pal): Layer[] {
  const k = j.scale;
  const R = j.rig;
  const skin = P.solid ? P.main : P.fl(0xc98a62);
  const kit = P.main;
  const kitB = P.solid ? P.main : P.mainB;
  const boot = P.solid ? P.main : P.fl(mix(P.trim, 0x111118, 0.4));
  const tape = P.solid ? P.main : P.fl(0xf1ece2);
  const C: BodyCols = { torso: skin, armU: skin, armF: skin, hand: skin, thigh: skin, shin: skin, shoe: P.solid ? P.main : darken(boot, 0.2), neck: skin, head: kit };
  const L1 = new Layer();
  const L2 = new Layer();
  const L3 = new Layer();
  const L4 = new Layer();

  armShapes(L1, j, false, C, P, false);
  if (!P.solid) wristTape(L1, j, false, back(tape, P));
  legShapes(L1, j, false, C, P, 1.15);
  bootShaft(L1, j, false, back(boot, P), P);
  trunkLeg(L1, j, false, kitB);
  kneePad(L1, j, false, back(boot, P), P);

  L2.add(torsoShape(j), skin);
  L2.add(neckShape(j), skin);
  if (!P.solid) {
    // singlet: lower torso + straps
    const s0 = spineFrame(j, -0.16);
    const s1 = spineFrame(j, 0.6);
    const sm = spineFrame(j, 0.28);
    L2.poly(
      [
        ...add(s0.p, s0.fwd, R.hipD * k * 0.3),
        ...add(sm.p, sm.fwd, R.waistD * k * 0.52),
        ...add(s1.p, s1.fwd, R.chestD * k * R.chestFwd * 0.96),
        ...add(s1.p, s1.fwd, -R.chestD * k * (1 - R.chestFwd) * 1.02),
        ...add(sm.p, sm.fwd, -R.waistD * k * 0.52),
        ...add(s0.p, s0.fwd, -R.hipD * k * 0.36),
      ],
      kit,
      1,
    );
    const st0 = spineFrame(j, 0.46);
    const st1 = spineFrame(j, 0.95);
    L2.line([...add(st0.p, st0.fwd, R.chestD * k * 0.2), ...add(st1.p, st1.fwd, R.shoulderD * k * 0.05)], 4 * k, kit, 1);
    // pec line
    const pc = spineFrame(j, 0.66);
    const pA = add(pc.p, pc.fwd, R.chestD * k * R.chestFwd * 0.95);
    const pB = add(spineFrame(j, 0.58).p, pc.fwd, R.chestD * k * 0.25);
    L2.line([pA[0], pA[1], pB[0], pB[1]], 1.3 * k, darken(skin, 0.3), 0.8);
    highlight(L2, spineFrame(j, 0.55).p, spineFrame(j, 0.9).p, R.chestD * k * 0.8, skin, 0.16, 0.7);
    // shoulder cap (deltoid) line
    const dl = spineFrame(j, 0.86);
    const dA = add(dl.p, dl.fwd, R.shoulderD * k * 0.3);
    const dB = add(spineFrame(j, 0.7).p, dl.fwd, R.chestD * k * 0.05);
    L2.line([dA[0], dA[1], dB[0], dB[1]], 1.1 * k, darken(skin, 0.28), 0.6);
    // title belt
    const w = spineFrame(j, 0.08);
    const bA = add(w.p, w.fwd, R.hipD * k * 0.5);
    const bB = add(w.p, w.fwd, -R.hipD * k * 0.58);
    L2.line([bA[0], bA[1], bB[0], bB[1]], 6 * k, darken(kit, 0.5), 1);
    const plateC = add(w.p, w.fwd, R.hipD * k * 0.38);
    L2.poly(oval(plateC, 7.5 * k, 6 * k, w.up), 0xe8b53a, 1, 1 * k);
    L2.poly(oval(plateC, 3.5 * k, 3 * k, w.up), 0xfff0b0, 0.9);
  }
  // masked head
  L2.add(headShape(j, 0.12, 0.98, 1.0), kit);
  if (!P.solid) {
    // eye holes with a lightning trim
    L2.poly(fp(j, [[0.3, 0.32], [0.98, 0.3], [1.02, 0.02], [0.62, -0.06], [0.32, 0.06]]), P.glow, 1, 0.8 * k);
    L2.poly(fp(j, [[0.5, 0.2], [0.92, 0.18], [0.9, 0.06], [0.55, 0.06]]), 0xffffff, 1);
    L2.poly(fp(j, [[0.6, -0.42], [1.04, -0.38], [1.02, -0.6], [0.66, -0.66]]), skin, 1);
    L2.line(fp(j, [[-0.2, 0.95], [0.1, 0.4], [-0.05, 0.1], [0.2, -0.5]]), 1.6 * k, P.glow, 0.9);
  }

  legShapes(L3, j, true, C, P, 1.15);
  bootShaft(L3, j, true, boot, P);
  trunkLeg(L3, j, true, kit);
  kneePad(L3, j, true, boot, P);
  if (!P.solid) bootStripe(L3, j, kit);

  armShapes(L4, j, true, C, P, !!look.open);
  if (!P.solid) wristTape(L4, j, true, tape);
  return [L1, L2, L3, L4];
}

function wristTape(L: Layer, j: Joints, front: boolean, c: number) {
  const k = j.scale;
  const R = j.rig;
  const el = front ? j.fElbow : j.bElbow;
  const wr = front ? j.fHand : j.bHand;
  const d = norm(sub(wr, el));
  L.poly(boxLimb(lerp2(el, wr, 0.66), add(wr, d, -1.5 * k), R.forearmW * k * 0.86, R.wristW * k * 1.04, 1.5 * k), c, 1, 0);
}

function trunkLeg(L: Layer, j: Joints, front: boolean, c: number) {
  const k = j.scale;
  const R = j.rig;
  const kn = front ? j.fKnee : j.bKnee;
  const d = norm(sub(kn, j.pelvis));
  L.poly(boxLimb(add(j.pelvis, d, -R.thighW * k * 0.2), add(j.pelvis, d, R.thigh * j.H * 0.32), R.thighW * k * 1.06, R.thighW * k * 1.04, 2 * k), c, 1, 0);
}

function bootShaft(L: Layer, j: Joints, front: boolean, c: number, P: Pal) {
  const k = j.scale;
  const R = j.rig;
  const kn = front ? j.fKnee : j.bKnee;
  const an = front ? j.fFoot : j.bFoot;
  const a = lerp2(kn, an, 0.4);
  L.add(limb(a, an, R.calfW * k * 1.04, R.calfW * k * 0.98, R.ankleW * k * 1.12), c);
  void P;
}

function bootStripe(L: Layer, j: Joints, c: number) {
  const k = j.scale;
  const R = j.rig;
  const a = lerp2(j.fKnee, j.fFoot, 0.5);
  const n = perp(norm(sub(j.fFoot, j.fKnee)));
  const w = R.calfW * k * 0.5;
  L.line([a[0] + n[0] * w, a[1] + n[1] * w, a[0] - n[0] * w, a[1] - n[1] * w], 2.4 * k, c, 1);
}
