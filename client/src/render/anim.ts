/**
 * Picks the pose a fighter should be in from a sim snapshot: move
 * animations keyed by move frame, plus state animations (idle breathing,
 * walk cycles, airborne rise/fall, hit reactions, knockdown, KO tumble),
 * all from the fighter's own pose set.
 */

import { blendPose, P, sampleAnim, type Pose, type PoseSet } from '../content/poses';
import type { CharacterDef, FighterSnap, MoveDef } from '../sim/types';
import type { P2 } from './figure';

export type TrailLimb = 'fa' | 'ba' | 'fl' | 'bl' | 'head' | 'tip';

export interface PoseOut {
  pose: Pose;
  spin: number;
  aim: P2 | null;
  prop: 'blade' | 'orb' | 'gun' | 'none' | undefined;
  /** Limb to smear this frame, if any. */
  trail: TrailLimb | null;
  /** Thrusters / casting glow. */
  power: boolean;
  /** Front hand open. */
  open: boolean;
  grounded: boolean;
}

function airLegs(ps: PoseSet) {
  return { fh: ps.apex.fh, fk: ps.apex.fk, bh: ps.apex.bh, bk: ps.apex.bk, fa: ps.apex.fa, ba: ps.apex.ba };
}

function airPose(ps: PoseSet, vy: number): Pose {
  // vy in sub-px/frame; negative = rising
  const v = vy / 100;
  if (v < -4) return ps.rise;
  if (v < 3) return blendPose(ps.rise, ps.apex, Math.min(1, (v + 4) / 7));
  return blendPose(ps.apex, ps.fall, Math.min(1, (v - 3) / 6));
}

export function choosePose(def: CharacterDef, s: FighterSnap, mf: number, time: number, walkPhase: number): PoseOut {
  const ps = def.poses;
  const out: PoseOut = { pose: ps.stance, spin: 0, aim: null, prop: undefined, trail: null, power: false, open: false, grounded: s.grounded };
  const b = Math.sin(time * 2.4);
  const st = ps.stance;
  const idle = P(st, { torso: st.torso + b * 1.2, chest: st.chest + b * 1.5, fs: st.fs + b * 2.5, bs: st.bs + b * 2, head: st.head - b * 1.2, sq: b * 0.008 });

  switch (s.mode) {
    case 'idle':
      out.pose = s.grounded ? idle : airPose(ps, s.vy);
      return out;
    case 'hitstun': {
      if (s.grounded) {
        // alternate reactions through a combo; big shoves snap the head back
        const hard = Math.abs(s.vx) > 450;
        const pick = hard ? ps.hurtHigh : s.combo % 3 === 1 ? ps.hurtHigh : s.combo % 3 === 2 ? ps.hurtGut : ps.hurtLow;
        // recoil: strongest right after the hit, easing as the stun wears off
        const k = Math.min(1, s.stun / 10);
        out.pose = blendPose(blendPose(st, pick, 0.6), pick, k);
      } else {
        out.pose = blendPose(ps.hurtAir, ps.tumble, Math.min(1, Math.max(0, s.vy / 900 + 0.3)));
        out.spin = s.hitlag > 0 ? 0 : Math.max(-40, Math.min(40, -s.vy / 40));
      }
      return out;
    }
    case 'blockstun':
      out.pose = s.grounded ? ps.guardHit : P(ps.guardHit, airLegs(ps));
      return out;
    case 'parried':
      out.pose = ps.stagger;
      return out;
    case 'grabbed':
      out.pose = ps.grabbed;
      out.grounded = false;
      return out;
    case 'kd':
    case 'down':
      out.pose = ps.lying;
      return out;
    case 'ko':
      if (s.grounded && Math.abs(s.vy) < 100) out.pose = ps.lying;
      else {
        out.pose = ps.tumble;
        out.spin = (time * 720) % 360;
      }
      return out;
  }

  // In a move.
  const m: MoveDef | undefined = s.move ? def.moves[s.move] : undefined;
  if (!m) return out;
  const a = m.anim;
  out.prop = a.prop;
  out.open = !!a.open && mf >= a.open[0] && mf <= a.open[1];
  out.power = (!!a.power && mf >= a.power[0] && mf <= a.power[1]) || m.cat === 'super';

  switch (m.id) {
    case 'wait':
      out.pose = s.grounded ? idle : airPose(ps, s.vy);
      return out;
    case 'walk': {
      const back = Math.sign(s.vx) !== 0 && Math.sign(s.vx) !== s.facing;
      const ph = (walkPhase * (back ? -1 : 1)) % 1;
      const t = (Math.sin(ph * Math.PI * 2) + 1) / 2;
      const w = blendPose(ps.walkA, ps.walkB, t);
      const bob = Math.abs(Math.sin(ph * Math.PI * 2)) * 0.02;
      out.pose = P(w, { torso: w.torso + (back ? -6 : 3), sq: -bob });
      return out;
    }
    case 'parry': {
      const t = s.mf;
      const amt = parryAmt(s);
      if (t < amt) out.pose = blendPose(st, ps.parryReady, Math.min(1, t / Math.max(1, Math.min(amt, 6))));
      else if (t < amt + 3) out.pose = ps.parryHit;
      else out.pose = blendPose(ps.parryHit, st, Math.min(1, (t - amt - 3) / 12));
      if (!s.grounded) out.pose = P(out.pose, airLegs(ps));
      out.open = true;
      return out;
    }
    case 'block':
      out.pose = s.grounded ? sampleAnim(a, mf) : P(ps.guard, airLegs(ps));
      return out;
  }

  out.pose = sampleAnim(a, mf);
  if (!s.grounded && m.where === 'any') out.pose = P(out.pose, airLegs(ps));
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
