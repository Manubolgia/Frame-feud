/**
 * Articulated fighter renderer: forward kinematics from a Pose, foot
 * planting, per-character kits (armour, scarves, hoods, masks), cloth and
 * props. Cosmetic only; floats and trig are fine here.
 */

import type { Pose } from '../content/poses';
import type { BuildDef } from '../sim/types';
import { darken, INK, lighten, mix } from './color';
import type { Pen } from './pen';

export type P2 = [number, number];

export interface Joints {
  hip: P2;
  neck: P2;
  shoulder: P2;
  head: P2;
  headR: number;
  fElbow: P2;
  fHand: P2;
  bElbow: P2;
  bHand: P2;
  fKnee: P2;
  fFoot: P2;
  bKnee: P2;
  bFoot: P2;
  /** Unit vector from hip to neck. */
  up: P2;
  facing: 1 | -1;
  scale: number;
  /** Whole-body rotation, radians (feet orientation). */
  rot: number;
}

const D2R = Math.PI / 180;
const dir = (deg: number): P2 => [Math.sin(deg * D2R), Math.cos(deg * D2R)];

/** Solve joint positions in world px. `y` is the feet line (floor = 0).
 *  `aim` (screen-space unit vector) overrides the front arm direction. */
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
  const H = b.height * scale;
  const leg = H * b.leg;
  const thigh = leg * 0.52;
  const shin = leg * 0.52;
  const torso = H * b.torso;
  const arm = H * b.arm;
  const upper = arm * 0.5;
  const fore = arm * 0.52;
  const headR = H * b.head;

  // Local space: facing right, hip at origin, y down.
  const up: P2 = [Math.sin(pose.torso * D2R), -Math.cos(pose.torso * D2R)];
  const neck: P2 = [up[0] * torso, up[1] * torso];
  const shoulder: P2 = [neck[0] - up[0] * torso * 0.16, neck[1] - up[1] * torso * 0.16];
  const ht = (pose.torso + pose.head) * D2R;
  const head: P2 = [neck[0] + Math.sin(ht) * headR * 1.3, neck[1] - Math.cos(ht) * headR * 1.3];

  const armJ = (s: number, e: number): [P2, P2] => {
    const a1 = dir(s + pose.torso);
    const el: P2 = [shoulder[0] + a1[0] * upper, shoulder[1] + a1[1] * upper];
    const a2 = dir(s + pose.torso + e);
    return [el, [el[0] + a2[0] * fore, el[1] + a2[1] * fore]];
  };
  const legJ = (h: number, k: number): [P2, P2] => {
    const t1 = dir(h);
    const kn: P2 = [t1[0] * thigh, t1[1] * thigh];
    const t2 = dir(h - k);
    return [kn, [kn[0] + t2[0] * shin, kn[1] + t2[1] * shin]];
  };
  let [fElbow, fHand] = armJ(pose.fs, pose.fe);
  const [bElbow, bHand] = armJ(pose.bs, pose.be);
  const [fKnee, fFoot] = legJ(pose.fh, pose.fk);
  const [bKnee, bFoot] = legJ(pose.bh, pose.bk);

  const pts: P2[] = [neck, shoulder, head, fElbow, fHand, bElbow, bHand, fKnee, fFoot, bKnee, bFoot];
  const rot = (pose.rot + spin) * D2R;
  if (rot !== 0) {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    for (const p of pts) {
      const px = p[0];
      const py = p[1];
      p[0] = px * c - py * s;
      p[1] = px * s + py * c;
    }
    const ux = up[0];
    const uy = up[1];
    up[0] = ux * c - uy * s;
    up[1] = ux * s + uy * c;
  }

  // Aimed arm: point the front arm along the aim, keeping its shoulder.
  if (aim) {
    const ax = aim[0] * facing; // to local (facing-right) space
    const ay = aim[1];
    const l = Math.hypot(ax, ay) || 1;
    const ux = ax / l;
    const uy = ay / l;
    fElbow[0] = shoulder[0] + ux * upper;
    fElbow[1] = shoulder[1] + uy * upper;
    fHand[0] = fElbow[0] + ux * fore;
    fHand[1] = fElbow[1] + uy * fore;
  }

  // Mirror and place.
  const hip: P2 = [0, 0];
  const all: P2[] = [hip, ...pts];
  for (const p of all) p[0] *= facing;
  up[0] *= facing;
  let ox = x + pose.dx * H * facing;
  let oy: number;
  if (grounded) {
    let low = -Infinity;
    for (const p of [hip, neck, fKnee, fFoot, bKnee, bFoot]) low = Math.max(low, p[1]);
    low = Math.max(low, head[1] + headR);
    oy = y - low - b.limbW * scale * 0.45;
  } else {
    oy = y - leg * 0.94;
  }
  for (const p of all) {
    p[0] += ox;
    p[1] += oy;
  }
  return { hip, neck, shoulder, head, headR, fElbow, fHand, bElbow, bHand, fKnee, fFoot, bKnee, bFoot, up, facing, scale, rot };
}

// ------------------------------------------------------------ cloth --

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

// ------------------------------------------------------------ drawing --

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
  time: number;
  outline?: boolean;
}

export interface FigureCloth {
  a?: Cloth;
  b?: Cloth;
}

interface Palette {
  ink: number;
  body: number;
  bodyB: number;
  limb: number;
  limbB: number;
  accent: number;
  accentB: number;
  glow: number;
  a: number;
}

function palette(look: Look): Palette {
  const a = look.alpha ?? 1;
  if (look.solid !== undefined) {
    const c = look.solid;
    return { ink: c, body: c, bodyB: c, limb: c, limbB: c, accent: c, accentB: c, glow: c, a };
  }
  const f = look.flash ?? 0;
  const fl = (c: number) => (f > 0 ? mix(c, 0xffffff, f) : c);
  const base = mix(look.trim, look.main, 0.3);
  return {
    ink: fl(INK),
    body: fl(base),
    bodyB: fl(darken(base, 0.35)),
    limb: fl(lighten(base, 0.06)),
    limbB: fl(darken(base, 0.42)),
    accent: fl(look.main),
    accentB: fl(darken(look.main, 0.38)),
    glow: fl(lighten(look.glow, (look.charge ?? 0) * 0.5)),
    a,
  };
}

function seg(pen: Pen, a: P2, b: P2, w: number, c: number, ink: number, alpha: number, outline: number) {
  if (outline > 0) pen.line([a[0], a[1], b[0], b[1]], w + outline * 2, ink, alpha);
  pen.line([a[0], a[1], b[0], b[1]], w, c, alpha);
}

const lerp2 = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export function drawFigure(pen: Pen, j: Joints, b: BuildDef, look: Look, cloth: FigureCloth = {}) {
  const k = j.scale;
  const P = palette(look);
  const al = P.a;
  const ol = look.outline === false || look.solid !== undefined ? 0 : Math.max(1, 1.6 * k);
  const W = b.limbW * k;
  const TW = b.torsoW * k;
  const f = j.facing;
  const kit = b.kit;
  const L = (a: P2, c: P2, w: number, col: number) => seg(pen, a, c, w, col, P.ink, al, ol);

  // Halo / rim light behind everything.
  if (look.halo && look.solid === undefined) {
    const h = look.halo;
    const hw = h.w * k;
    for (const [a, c, w] of [
      [j.shoulder, j.bElbow, W], [j.bElbow, j.bHand, W], [j.hip, j.bKnee, W], [j.bKnee, j.bFoot, W],
      [j.hip, j.neck, TW], [j.hip, j.fKnee, W], [j.fKnee, j.fFoot, W], [j.shoulder, j.fElbow, W], [j.fElbow, j.fHand, W],
    ] as [P2, P2, number][]) pen.line([a[0], a[1], c[0], c[1]], w + hw, h.c, h.a * al);
    pen.circle(j.head[0], j.head[1], j.headR + hw / 2, h.c, h.a * al);
  }

  // --- behind the body: cloth, back limbs ---
  if (kit === 'arc' && cloth.a && cloth.b) {
    drawCloth(pen, cloth.b, 11 * k, 6 * k, P.accentB, P.ink, al, ol);
  }
  if (kit === 'razor' && cloth.a) drawCloth(pen, cloth.a, 6.5 * k, 2.5 * k, P.accent, P.ink, al, ol);

  // back arm
  L(j.shoulder, j.bElbow, W * 0.95, P.limbB);
  L(j.bElbow, j.bHand, W * 0.85, kit === 'titan' ? P.accentB : P.limbB);
  hand(pen, j.bHand, W * (kit === 'grip' || kit === 'titan' ? 0.78 : 0.62), kit === 'razor' ? P.accentB : P.limbB, P, ol);
  // back leg
  L(j.hip, j.bKnee, W * 1.15, P.limbB);
  L(j.bKnee, j.bFoot, W * 0.98, P.limbB);
  foot(pen, j.bKnee, j.bFoot, W, P.accentB, P, ol, f, j.rot);

  if (kit === 'titan') {
    // thrusters on the back
    const t0 = lerp2(j.hip, j.neck, 0.72);
    const bx = t0[0] - f * TW * 0.55;
    const by = t0[1];
    pen.roundRect(bx - TW * 0.22, by - TW * 0.4, TW * 0.44, TW * 0.8, 4 * k, P.bodyB, al, ol ? { w: ol, c: P.ink, a: al } : undefined);
    if (look.power) {
      const fl = 0.6 + 0.4 * Math.sin(look.time * 60);
      pen.ellipse(bx, by + TW * 0.6, TW * 0.16, TW * 0.5 * fl, P.glow, 0.85 * al);
      pen.ellipse(bx, by + TW * 0.55, TW * 0.08, TW * 0.3 * fl, 0xffffff, 0.9 * al);
    }
  }

  // --- torso ---
  if (kit === 'arc' && cloth.a) drawCloth(pen, cloth.a, 12 * k, 7 * k, P.accent, P.ink, al, ol);
  torsoShape(pen, j, TW, kit, P, ol);
  // chest / armour plate
  const chest0 = lerp2(j.hip, j.neck, 0.45);
  const chest1 = lerp2(j.hip, j.neck, 0.92);
  switch (kit) {
    case 'titan':
      seg(pen, chest0, chest1, TW * 0.92, P.accent, P.ink, al, ol);
      pen.circle(...lerp2(j.hip, j.neck, 0.66), TW * 0.17, P.glow, al);
      pen.circle(...lerp2(j.hip, j.neck, 0.66), TW * 0.09, 0xffffff, 0.9 * al);
      break;
    case 'grip': {
      seg(pen, chest0, chest1, TW * 0.7, lighten(P.body, 0.08), P.ink, 0, 0);
      // belt
      const b0 = lerp2(j.hip, j.neck, 0.1);
      const nx = -j.up[1];
      const ny = j.up[0];
      pen.line([b0[0] - nx * TW * 0.5, b0[1] - ny * TW * 0.5, b0[0] + nx * TW * 0.5, b0[1] + ny * TW * 0.5], TW * 0.28, P.accent, al);
      pen.circle(b0[0] + f * TW * 0.05, b0[1], TW * 0.16, 0xffd25a, al, ol ? { w: ol, c: P.ink, a: al } : undefined);
      break;
    }
    case 'razor': {
      // sash across the chest
      const s0 = lerp2(j.hip, j.neck, 0.25);
      const s1 = lerp2(j.hip, j.neck, 0.85);
      pen.line([s0[0] - f * TW * 0.3, s0[1], s1[0] + f * TW * 0.3, s1[1]], TW * 0.25, P.accent, al);
      break;
    }
    case 'arc': {
      seg(pen, lerp2(j.hip, j.neck, 0.12), lerp2(j.hip, j.neck, 0.2), TW * 1.05, P.accent, P.ink, al, 0);
      pen.circle(...lerp2(j.hip, j.neck, 0.16), TW * 0.14, P.glow, al);
      break;
    }
  }

  // back pauldron for titan (behind the head, above torso)
  if (kit === 'titan') {
    const bp: P2 = [j.shoulder[0] - f * TW * 0.28 - j.up[0] * TW * 0.2, j.shoulder[1] - j.up[1] * TW * 0.2];
    pen.circle(bp[0], bp[1], TW * 0.3, P.accentB, al, ol ? { w: ol, c: P.ink, a: al } : undefined);
  }

  // --- front leg ---
  L(j.hip, j.fKnee, W * 1.18, P.limb);
  L(j.fKnee, j.fFoot, W, P.limb);
  foot(pen, j.fKnee, j.fFoot, W, P.accent, P, ol, f, j.rot);

  // --- head ---
  drawHead(pen, j, b, P, look, ol);

  // --- front arm ---
  L(j.shoulder, j.fElbow, W, P.limb);
  if (kit === 'titan') L(j.fElbow, j.fHand, W * 1.05, P.accent);
  else L(j.fElbow, j.fHand, W * 0.88, P.limb);
  if (kit === 'grip') {
    const wb = lerp2(j.fElbow, j.fHand, 0.72);
    seg(pen, wb, lerp2(j.fElbow, j.fHand, 0.95), W * 1.08, P.accent, P.ink, al, ol);
  }
  // prop
  if (look.prop === 'blade') drawBlade(pen, j, k, P);
  hand(pen, j.fHand, W * (kit === 'grip' || kit === 'titan' ? 0.82 : 0.62), kit === 'razor' || kit === 'grip' ? P.accent : P.limb, P, ol);
  if (kit === 'arc' && look.power) {
    pen.circle(j.fHand[0], j.fHand[1], W * 1.6, P.glow, 0.35 * al);
    pen.circle(j.fHand[0], j.fHand[1], W * 0.8, 0xffffff, 0.8 * al);
  }
  if (kit === 'titan') {
    // pauldron sits on the upper arm, below the helmet
    const ua = lerp2(j.shoulder, j.fElbow, 0.22);
    const fp: P2 = [ua[0] - j.up[0] * TW * 0.06, ua[1] - j.up[1] * TW * 0.06];
    pen.circle(fp[0], fp[1], TW * 0.32, P.accent, al, ol ? { w: ol, c: P.ink, a: al } : undefined);
    pen.circle(fp[0] - f * TW * 0.08, fp[1] - TW * 0.1, TW * 0.1, lighten(P.accent, 0.35), 0.6 * al);
  }
  if (kit === 'razor' && look.prop !== 'blade') {
    // sheathed blade across the back
    const s0 = lerp2(j.hip, j.neck, 0.2);
    pen.line([s0[0] - f * TW * 0.9, s0[1] + TW * 0.2, j.neck[0] - f * TW * 0.1 + f * 0, j.neck[1] - TW * 0.9], 3 * k, P.ink, 0.85 * al);
  }
}

/** Tapered torso: pelvis, waist, chest and shoulders. */
function torsoShape(pen: Pen, j: Joints, TW: number, kit: BuildDef['kit'], P: Palette, ol: number) {
  const nx = -j.up[1];
  const ny = j.up[0];
  const prof: [number, number][] =
    kit === 'titan'
      ? [[-0.02, 0.5], [0.3, 0.5], [0.72, 0.74], [1.0, 0.6]]
      : kit === 'grip'
        ? [[-0.02, 0.56], [0.32, 0.64], [0.66, 0.66], [1.0, 0.5]]
        : kit === 'arc'
          ? [[-0.02, 0.6], [0.35, 0.46], [0.75, 0.62], [1.0, 0.5]]
          : [[-0.02, 0.56], [0.38, 0.42], [0.78, 0.6], [1.0, 0.48]];
  const left: number[] = [];
  const right: number[] = [];
  for (const [t, w] of prof) {
    const c = lerp2(j.hip, j.neck, t);
    left.push(c[0] + nx * w * TW, c[1] + ny * w * TW);
    right.unshift(c[0] - nx * w * TW, c[1] - ny * w * TW);
  }
  const pts = [...left, ...right];
  pen.poly(pts, P.body, P.a, ol ? { w: ol * 1.4, c: P.ink, a: P.a } : undefined);
  // neck
  const nk = lerp2(j.neck, j.head, 0.55);
  pen.line([j.neck[0], j.neck[1], nk[0], nk[1]], TW * 0.32, P.bodyB, P.a);
}

function hand(pen: Pen, p: P2, r: number, c: number, P: Palette, ol: number) {
  pen.circle(p[0], p[1], r, c, P.a, ol ? { w: ol, c: P.ink, a: P.a } : undefined);
}

function foot(pen: Pen, knee: P2, ft: P2, W: number, c: number, P: Palette, ol: number, f: number, rot: number) {
  // A boot pointing along the facing, turned with the whole body. A little
  // of the shin's angle bleeds in so pointed toes read on kicks.
  const dx = ft[0] - knee[0];
  const dy = ft[1] - knee[1];
  const l = Math.hypot(dx, dy) || 1;
  let ax = Math.cos(rot) * f;
  let ay = Math.sin(rot);
  const along = (dx / l) * ax + (dy / l) * ay;
  if (along > 0.35) {
    // shin already points forward (a kick): extend the toe along the shin
    ax = ax * 0.4 + (dx / l) * 0.6;
    ay = ay * 0.4 + (dy / l) * 0.6;
  }
  const al = Math.hypot(ax, ay) || 1;
  const toe: P2 = [ft[0] + (ax / al) * W * 0.95, ft[1] + (ay / al) * W * 0.95];
  seg(pen, [ft[0] - (ax / al) * W * 0.2, ft[1] - (ay / al) * W * 0.2], toe, W * 0.95, c, P.ink, P.a, ol);
}

function drawHead(pen: Pen, j: Joints, b: BuildDef, P: Palette, look: Look, ol: number) {
  const [hx, hy] = j.head;
  const r = j.headR;
  const f = j.facing;
  const al = P.a;
  const stroke = ol ? { w: ol, c: P.ink, a: al } : undefined;
  const ux = j.up[0];
  const uy = j.up[1];
  // forward unit (perpendicular to up, pointing along facing)
  let gx = -uy;
  let gy = ux;
  if (gx * f < 0) {
    gx = -gx;
    gy = -gy;
  }
  switch (b.kit) {
    case 'titan': {
      pen.circle(hx, hy, r * 1.08, P.body, al, stroke);
      // crest
      pen.line([hx - ux * r * 0.2 - gx * r * 0.6, hy - uy * r * 0.2 - gy * r * 0.6, hx + ux * r * 1.05, hy + uy * r * 1.05], r * 0.45, P.accent, al);
      // visor
      const vx = hx + gx * r * 0.35;
      const vy = hy + gy * r * 0.35;
      pen.line([vx - gx * r * 0.25, vy - gy * r * 0.25, vx + gx * r * 0.55, vy + gy * r * 0.55], r * 0.42, P.ink, al);
      pen.line([vx - gx * r * 0.1, vy - gy * r * 0.1, vx + gx * r * 0.5, vy + gy * r * 0.5], r * 0.22, P.glow, al);
      break;
    }
    case 'razor': {
      pen.circle(hx, hy, r, P.body, al, stroke);
      // mask over the lower face
      pen.circle(hx + gx * r * 0.25 - ux * r * 0.35, hy + gy * r * 0.25 - uy * r * 0.35, r * 0.7, P.bodyB, al);
      // headband + tails
      const bx = hx + ux * r * 0.25;
      const by = hy + uy * r * 0.25;
      pen.line([bx - gx * r, by - gy * r, bx + gx * r * 0.95, by + gy * r * 0.95], r * 0.32, P.accent, al);
      const tw = Math.sin(look.time * 9) * r * 0.25;
      pen.line([bx - gx * r, by - gy * r, bx - gx * r * 1.9, by - gy * r * 1.9 + r * 0.4 + tw, bx - gx * r * 2.5, by - gy * r * 2.5 + r * 0.9 + tw * 1.6], r * 0.2, P.accent, al);
      // eye
      pen.line([hx + gx * r * 0.2 + ux * r * 0.02, hy + gy * r * 0.2 + uy * r * 0.02, hx + gx * r * 0.75, hy + gy * r * 0.75], r * 0.18, P.glow, al);
      break;
    }
    case 'arc': {
      // hood with a pointed back
      const back: P2 = [hx - gx * r * 1.25 + ux * r * 0.6, hy - gy * r * 1.25 + uy * r * 0.6];
      pen.poly([hx + ux * r * 1.05, hy + uy * r * 1.05, back[0], back[1], hx - gx * r * 0.2 - ux * r * 0.9, hy - gy * r * 0.2 - uy * r * 0.9], P.accentB, al, stroke);
      pen.circle(hx, hy, r * 1.05, P.accent, al, stroke);
      // shadowed face opening
      pen.circle(hx + gx * r * 0.35, hy + gy * r * 0.35, r * 0.68, P.ink, al);
      pen.circle(hx + gx * r * 0.52, hy + gy * r * 0.42 - uy * 0, r * 0.13, P.glow, al);
      pen.circle(hx + gx * r * 0.2, hy + gy * r * 0.42, r * 0.11, P.glow, al * 0.8);
      break;
    }
    case 'grip': {
      pen.circle(hx, hy, r * 1.06, P.accent, al, stroke);
      // centre stripe
      pen.line([hx + ux * r * 1.0, hy + uy * r * 1.0, hx - ux * r * 0.2 + gx * r * 0.9, hy - uy * r * 0.2 + gy * r * 0.9], r * 0.28, lighten(P.accent, 0.4), al);
      // eye holes
      const ex = hx + gx * r * 0.45 + ux * r * 0.1;
      const ey = hy + gy * r * 0.45 + uy * r * 0.1;
      pen.ellipse(ex, ey, r * 0.24, r * 0.17, 0xffffff, al);
      pen.circle(ex + gx * r * 0.08, ey + gy * r * 0.08, r * 0.09, P.ink, al);
      break;
    }
  }
}

function drawBlade(pen: Pen, j: Joints, k: number, P: Palette) {
  const dx = j.fHand[0] - j.fElbow[0];
  const dy = j.fHand[1] - j.fElbow[1];
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const len = 46 * k;
  const tip: P2 = [j.fHand[0] + ux * len, j.fHand[1] + uy * len];
  const base: P2 = [j.fHand[0] - ux * 6 * k, j.fHand[1] - uy * 6 * k];
  pen.line([base[0], base[1], tip[0], tip[1]], 4.2 * k, P.ink, P.a);
  pen.line([j.fHand[0], j.fHand[1], tip[0], tip[1]], 2.4 * k, 0xe8f4ff, P.a);
  pen.line([j.fHand[0] + ux * len * 0.3, j.fHand[1] + uy * len * 0.3, tip[0], tip[1]], 1.1 * k, P.glow, P.a * 0.9);
  // guard
  pen.line([j.fHand[0] - uy * 5 * k, j.fHand[1] + ux * 5 * k, j.fHand[0] + uy * 5 * k, j.fHand[1] - ux * 5 * k], 2.4 * k, P.accent, P.a);
}

function drawCloth(pen: Pen, c: Cloth, w0: number, w1: number, col: number, ink: number, a: number, ol: number) {
  const p = c.pts;
  for (let i = 1; i < p.length; i++) {
    const t = i / (p.length - 1);
    const w = w0 + (w1 - w0) * t;
    if (ol) pen.line([p[i - 1].x, p[i - 1].y, p[i].x, p[i].y], w + ol * 2, ink, a);
  }
  for (let i = 1; i < p.length; i++) {
    const t = i / (p.length - 1);
    const w = w0 + (w1 - w0) * t;
    pen.line([p[i - 1].x, p[i - 1].y, p[i].x, p[i].y], w, col, a);
  }
}

/** Where cloth attaches for each kit. */
export function clothAnchors(j: Joints, b: BuildDef): { a?: P2; b?: P2 } {
  const f = j.facing;
  switch (b.kit) {
    case 'razor':
      return { a: [j.neck[0] - f * b.torsoW * 0.2 * j.scale, j.neck[1] + 2 * j.scale] };
    case 'arc': {
      const w = lerp2(j.hip, j.neck, 0.15);
      return { a: [w[0] - f * b.torsoW * 0.25 * j.scale, w[1]], b: [w[0] - f * b.torsoW * 0.45 * j.scale, w[1] - 2] };
    }
    default:
      return {};
  }
}
