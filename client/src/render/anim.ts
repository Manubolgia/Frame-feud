/**
 * Picks the pose a fighter should be in from a sim snapshot: move
 * animations keyed by move frame, plus state animations (idle breathing,
 * walk cycles, airborne rise/fall, hurt, knockdown, KO tumble).
 */

import { blendPose, L, P, sampleAnim, type Pose } from '../content/poses';
import type { CharacterDef, FighterSnap, MoveDef } from '../sim/types';
import type { P2 } from './figure';

export interface PoseOut {
  pose: Pose;
  spin: number;
  aim: P2 | null;
  prop: 'blade' | 'orb' | 'gun' | 'none' | undefined;
  /** Limb to smear this frame, if any. */
  trail: 'fa' | 'ba' | 'fl' | 'bl' | 'head' | null;
  /** Thrusters / casting glow. */
  power: boolean;
  grounded: boolean;
}

const AIR_LEGS = { fh: L.apex.fh, fk: L.apex.fk, bh: L.apex.bh, bk: L.apex.bk };

function airPose(vy: number): Pose {
  // vy in sub-px/frame; negative = rising
  const v = vy / 100;
  if (v < -4) return L.rise;
  if (v < 3) return blendPose(L.rise, L.apex, Math.min(1, (v + 4) / 7));
  return blendPose(L.apex, L.fall, Math.min(1, (v - 3) / 6));
}

export function choosePose(def: CharacterDef, s: FighterSnap, mf: number, time: number, walkPhase: number): PoseOut {
  const out: PoseOut = { pose: def.stance, spin: 0, aim: null, prop: undefined, trail: null, power: false, grounded: s.grounded };
  const breathe = Math.sin(time * 2.4) * 2;
  const idle = P(def.stance, { torso: def.stance.torso + breathe * 0.6, fs: def.stance.fs + breathe, bs: def.stance.bs + breathe * 0.7, head: def.stance.head - breathe * 0.4 });

  switch (s.mode) {
    case 'idle':
      out.pose = s.grounded ? idle : airPose(s.vy);
      return out;
    case 'hitstun': {
      if (s.grounded) out.pose = Math.abs(s.vx) > 300 ? L.hurtHigh : L.hurtLow;
      else {
        out.pose = blendPose(L.hurtAir, L.tumble, Math.min(1, Math.max(0, s.vy / 900 + 0.3)));
        out.spin = s.hitlag > 0 ? 0 : Math.max(-40, Math.min(40, -s.vy / 40));
      }
      return out;
    }
    case 'blockstun':
      out.pose = s.grounded ? L.guardHit : P(L.guardHit, AIR_LEGS);
      return out;
    case 'parried':
      out.pose = L.stagger;
      return out;
    case 'grabbed':
      out.pose = L.grabbed;
      out.grounded = false;
      return out;
    case 'kd':
    case 'down':
      out.pose = L.lying;
      return out;
    case 'ko':
      if (s.grounded && Math.abs(s.vy) < 100) out.pose = L.lying;
      else {
        out.pose = L.tumble;
        out.spin = (time * 720) % 360;
      }
      return out;
  }

  // In a move.
  const m: MoveDef | undefined = s.move ? def.moves[s.move] : undefined;
  if (!m) return out;
  const a = m.anim;
  out.prop = a.prop;
  out.power = m.cat === 'super' || m.id === 'rocket' || m.id === 'dropslam' || (def.build.kit === 'arc' && m.cat === 'special' && mf >= 6) || m.id === 'airdash';

  switch (m.id) {
    case 'wait':
    case 'land':
      if (m.id === 'land') out.pose = sampleAnim(a, mf);
      else out.pose = s.grounded ? idle : airPose(s.vy);
      return out;
    case 'walk': {
      const back = Math.sign(s.vx) !== 0 && Math.sign(s.vx) !== s.facing;
      const ph = (walkPhase * (back ? -1 : 1)) % 1;
      const t = (Math.sin(ph * Math.PI * 2) + 1) / 2;
      out.pose = blendPose(L.walkA, L.walkB, t);
      out.pose = P(out.pose, { torso: def.stance.torso + (back ? -6 : 4), fs: def.stance.fs, fe: def.stance.fe, bs: def.stance.bs, be: def.stance.be });
      return out;
    }
    case 'parry': {
      const t = s.mf;
      const amt = parryAmt(s);
      if (t < amt) out.pose = blendPose(def.stance, L.parryReady, Math.min(1, t / Math.max(1, Math.min(amt, 6))));
      else if (t < amt + 3) out.pose = L.parryHit;
      else out.pose = blendPose(L.parryHit, def.stance, Math.min(1, (t - amt - 3) / 12));
      if (!s.grounded) out.pose = P(out.pose, AIR_LEGS);
      return out;
    }
    case 'block':
      out.pose = s.grounded ? sampleAnim(a, mf) : P(L.guard, AIR_LEGS);
      return out;
  }

  out.pose = sampleAnim(a, mf);
  if (!s.grounded && m.where === 'any') out.pose = P(out.pose, AIR_LEGS);
  if (a.spin && mf >= a.spin.f0 && mf <= a.spin.f1) {
    out.spin = ((mf - a.spin.f0) / Math.max(1, a.spin.f1 - a.spin.f0)) * a.spin.deg;
  }
  if (a.aim && mf >= a.aim.f0 && mf <= a.aim.f1 && (s.dir[0] || s.dir[1])) {
    out.aim = [s.dir[0], s.dir[1]];
  }
  if (a.trail && mf >= a.trail.f0 - 1 && mf <= a.trail.f1 + 1) out.trail = a.trail.limb;
  return out;
}

/** The sim stores the parry frame in the move's amount; snapshots carry the
 *  move length instead, so recover it: total = amt + 3 + 14. */
function parryAmt(s: FighterSnap): number {
  return Math.max(1, s.mt - 17);
}
