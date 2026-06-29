/**
 * Articulated fighter renderer — posed, animated stick/limb figures (in the
 * spirit of *Your Only Move Is Hustle*, but fleshed out with tapered limbs and
 * per-archetype builds). Fully cosmetic: poses are derived from the sim's
 * render snapshot (move kind + phase, velocity, grounded, hitstun) and never
 * feed back into authoritative state, so we use floats/trig freely here.
 */

import { Graphics } from 'pixi.js';
import { darken, lighten, mix } from '../theme';
import type { CharacterDef } from '../sim/types';

export interface FigureState {
  grounded: boolean;
  vx: number; // fixed velocity
  vy: number;
  hitstun: number;
  shielding: boolean;
  facing: 1 | -1;
  aimAngle: number;
  moveKind?: string;
  moveAimable?: boolean;
  movePhase?: 'startup' | 'active' | 'recovery';
  moveTotalT?: number; // elapsed / total in [0,1]
  worldX: number; // for run-cycle phase
}

interface Build {
  torso: number; // length factor
  limb: number; // arm/leg length factor
  head: number; // head radius factor
  girth: number; // limb thickness factor
  stance: number; // leg spread factor
}

const BUILDS: Record<CharacterDef['shape'], Build> = {
  heavy: { torso: 0.78, limb: 0.74, head: 0.34, girth: 1.7, stance: 1.25 },
  rush: { torso: 0.92, limb: 0.92, head: 0.28, girth: 0.95, stance: 0.85 },
  zoner: { torso: 0.86, limb: 0.86, head: 0.32, girth: 1.1, stance: 1.0 },
  grappler: { torso: 0.74, limb: 0.78, head: 0.33, girth: 1.55, stance: 1.2 },
};

interface P {
  x: number;
  y: number;
}
const pt = (x: number, y: number): P => ({ x, y });

function limb(g: Graphics, a: P, b: P, c: P, w1: number, w2: number, color: number) {
  // two tapered segments with a joint
  g.moveTo(a.x, a.y);
  g.lineTo(b.x, b.y);
  g.stroke({ width: w1, color, cap: 'round', join: 'round' });
  g.moveTo(b.x, b.y);
  g.lineTo(c.x, c.y);
  g.stroke({ width: w2, color, cap: 'round', join: 'round' });
  g.circle(b.x, b.y, w2 * 0.45);
  g.fill({ color });
}

/** Forward-kinematics for a 2-segment limb. Angles in radians from +x axis. */
function fk(origin: P, len1: number, a1: number, len2: number, a2: number): [P, P] {
  const joint = pt(origin.x + Math.cos(a1) * len1, origin.y + Math.sin(a1) * len1);
  const end = pt(joint.x + Math.cos(a2) * len2, joint.y + Math.sin(a2) * len2);
  return [joint, end];
}

export function drawFigure(
  g: Graphics,
  x: number,
  yFeet: number,
  S: number,
  def: CharacterDef,
  bodyColor: number,
  outline: number,
  st: FigureState,
  time: number,
) {
  const b = BUILDS[def.shape];
  const f = st.facing;
  const legLen = S * b.limb * 1.05;
  const torsoLen = S * b.torso;
  const armLen = S * b.limb * 0.95;
  const headR = S * b.head;
  const speed = Math.abs(st.vx) / 1000;
  const moving = st.grounded && speed > 0.05;

  // --- crouch / lean from state ---
  let crouch = 0;
  let lean = 0; // torso lean (radians, + = forward)
  if (st.shielding) crouch = S * 0.18;
  if (st.hitstun > 0) lean = -0.5 * f;

  // attack lean: shift weight into the swing during active frames
  const phase = st.movePhase;
  const isStrike = !!st.moveKind && ['attack', 'special', 'grab'].includes(st.moveKind);
  if (isStrike) {
    if (phase === 'startup') lean = -0.18 * f;
    else if (phase === 'active') lean = 0.32 * f;
    else lean = 0.1 * f;
  }

  // --- hip / shoulder / head anchors ---
  const hip = pt(x, yFeet - legLen + crouch);
  const shoulder = pt(hip.x + Math.sin(lean) * torsoLen * 0.4, hip.y - torsoLen + Math.cos(0) * 0 - Math.abs(Math.sin(lean)) * 2);
  shoulder.x = hip.x + Math.sin(lean) * torsoLen;
  shoulder.y = hip.y - Math.cos(lean) * torsoLen;
  const headC = pt(shoulder.x + Math.sin(lean) * headR * 1.4, shoulder.y - Math.cos(lean) * (headR * 1.5));

  const gw = S * 0.16 * b.girth; // base limb width
  const legColor = darken(bodyColor, 0.12);
  const armColor = bodyColor;

  // ===== LEGS =====
  let legPhaseA = 0,
    legPhaseB = 0;
  if (!st.grounded) {
    // airborne: tuck, more if rising
    const tuck = st.vy < 0 ? 0.5 : 0.2;
    legPhaseA = 0.4 + tuck;
    legPhaseB = -0.2;
  } else if (moving) {
    const rp = time * 11 + st.worldX * 0.01;
    legPhaseA = Math.sin(rp) * 0.7;
    legPhaseB = Math.sin(rp + Math.PI) * 0.7;
  } else {
    legPhaseA = 0.12 * b.stance;
    legPhaseB = -0.12 * b.stance;
  }
  // down = +y (PI/2). hip angle around vertical-down.
  const down = Math.PI / 2;
  const legA = fk(hip, legLen * 0.55, down + legPhaseA * f + (st.grounded ? 0 : 0.1), legLen * 0.55, down + legPhaseA * 0.4 * f + 0.15);
  const legB = fk(hip, legLen * 0.55, down + legPhaseB * f, legLen * 0.55, down + legPhaseB * 0.4 * f + 0.15);
  limb(g, hip, legB[0], legB[1], gw * 1.05, gw * 0.85, darken(legColor, 0.18));
  limb(g, hip, legA[0], legA[1], gw * 1.1, gw * 0.9, legColor);

  // ===== BACK ARM =====
  const up = -Math.PI / 2;
  let backShoulderA = up + 2.4 * f;
  let backElbowA = backShoulderA + 0.5 * f;
  if (moving) {
    const rp = time * 11 + st.worldX * 0.01;
    backShoulderA = down + Math.sin(rp) * 0.6 * f + 0.2 * f;
    backElbowA = backShoulderA + 0.6 * f;
  }
  const backArm = fk(shoulder, armLen * 0.5, backShoulderA, armLen * 0.55, backElbowA);
  limb(g, shoulder, backArm[0], backArm[1], gw * 0.9, gw * 0.72, darken(armColor, 0.2));

  // ===== TORSO =====
  const tw = S * 0.34 * b.girth;
  g.moveTo(hip.x, hip.y);
  g.lineTo(shoulder.x, shoulder.y);
  g.stroke({ width: tw, color: bodyColor, cap: 'round' });
  // chest accent
  g.moveTo(mix2(hip, shoulder, 0.45).x, mix2(hip, shoulder, 0.45).y);
  g.lineTo(shoulder.x, shoulder.y);
  g.stroke({ width: tw * 0.6, color: lighten(bodyColor, 0.12), cap: 'round' });

  // ===== HEAD =====
  g.circle(headC.x, headC.y, headR);
  g.fill({ color: lighten(bodyColor, 0.08) });
  g.circle(headC.x, headC.y, headR);
  g.stroke({ width: S * 0.05, color: outline, alpha: 0.6 });
  // visor / eye band (faces direction)
  g.moveTo(headC.x - f * headR * 0.1, headC.y - headR * 0.15);
  g.lineTo(headC.x + f * headR * 0.85, headC.y - headR * 0.15);
  g.stroke({ width: headR * 0.5, color: def.color, cap: 'round' });
  g.circle(headC.x + f * headR * 0.55, headC.y - headR * 0.15, headR * 0.16);
  g.fill({ color: 0xffffff });

  // ===== FRONT ARM (the "weapon" arm) =====
  let frShoulderA: number;
  let frElbowA: number;
  const aimR = (st.aimAngle * Math.PI) / 180;
  if (isStrike) {
    // strike pose by phase
    let reach = 0;
    if (phase === 'startup') reach = -0.6; // wind back
    else if (phase === 'active') reach = 1.0; // full extend
    else reach = 0.3; // recover
    if (st.moveAimable) {
      // point toward aim
      frShoulderA = -aimR * f; // note screen y is down; aim uses -sin
      // convert aim (0=right,90=up) to screen radians: x=cos, y=-sin
      const ax = Math.cos(aimR) * f;
      const ay = -Math.sin(aimR);
      frShoulderA = Math.atan2(ay, ax);
      frElbowA = frShoulderA;
      const sh = fk(shoulder, armLen * 0.55, frShoulderA - 0.3 * (1 - reach), armLen * 0.6, frElbowA);
      limb(g, shoulder, sh[0], sh[1], gw * 1.0, gw * 0.8, lighten(armColor, 0.05));
      // muzzle glow at hand during active
      if (phase === 'active') {
        g.circle(sh[1].x, sh[1].y, S * 0.22);
        g.fill({ color: lighten(def.color, 0.3), alpha: 0.9 });
        g.circle(sh[1].x, sh[1].y, S * 0.13);
        g.fill({ color: 0xffffff, alpha: 0.95 });
      }
      return drawAttackFx(g, sh[1], st, def, S, f, phase);
    } else {
      // melee: swing forward
      frShoulderA = down - (0.2 + reach * 1.4) * 1 - 0; // raise toward horizontal as reach grows
      frShoulderA = up + (1.1 - reach * 0.9) * f;
      frElbowA = frShoulderA + (0.2 + reach * 0.2) * f;
      const sh = fk(shoulder, armLen * 0.5, frShoulderA, armLen * 0.6, frElbowA);
      limb(g, shoulder, sh[0], sh[1], gw * 1.05, gw * 0.85, lighten(armColor, 0.05));
      drawAttackFx(g, sh[1], st, def, S, f, phase);
      return;
    }
  }

  // non-attacking front arm
  if (!st.grounded) {
    frShoulderA = up + 1.0 * f;
  } else if (st.shielding) {
    frShoulderA = up + 0.5 * f;
  } else if (moving) {
    const rp = time * 11 + st.worldX * 0.01;
    frShoulderA = down + Math.sin(rp + Math.PI) * 0.6 * f + 0.2 * f;
  } else {
    frShoulderA = down + 0.25 * f + Math.sin(time * 2) * 0.04;
  }
  frElbowA = frShoulderA + 0.5 * f;
  const sh = fk(shoulder, armLen * 0.5, frShoulderA, armLen * 0.55, frElbowA);
  limb(g, shoulder, sh[0], sh[1], gw * 0.95, gw * 0.78, armColor);
}

function drawAttackFx(
  g: Graphics,
  hand: P,
  st: FigureState,
  def: CharacterDef,
  S: number,
  f: number,
  phase?: string,
) {
  if (phase !== 'active') return;
  const kind = st.moveKind;
  if (kind === 'grab') {
    g.circle(hand.x, hand.y, S * 0.28);
    g.stroke({ width: S * 0.08, color: 0xffffff, alpha: 0.8 });
    return;
  }
  // slash arc swept in front of the hand
  const base = f === 1 ? -0.9 : Math.PI + 0.9;
  g.arc(hand.x - f * S * 0.1, hand.y, S * 0.7, base, base + 1.8 * f, f === -1);
  g.stroke({ width: S * 0.22, color: 0xffffff, alpha: 0.85 });
  g.arc(hand.x - f * S * 0.1, hand.y, S * 0.55, base, base + 1.8 * f, f === -1);
  g.stroke({ width: S * 0.1, color: lighten(def.color, 0.3), alpha: 0.9 });
}

function mix2(a: P, b: P, t: number): P {
  return pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
}

export { mix };
