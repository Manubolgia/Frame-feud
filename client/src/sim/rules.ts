/**
 * Who gets to decide at a pause, what they may pick, and turning any
 * incoming decision (local UI, CPU, or an untrusted network peer) into a
 * legal one. Every client runs the same checks, so an illegal decision is
 * corrected identically everywhere.
 */

import { clamp, len2 } from './fixed';
import { BURST_MAX } from './state';
import { FEINT_COST, charOf, defaultDir, firstActive, moveDef } from './step';
import type { Decision, DirSpec, GameState, MoveDef, SimCtx } from './types';

export type Need = 'act' | 'di' | 'none';

/** Can fighter i choose a new action right now? */
export function canAct(st: GameState, i: number, ctx: SimCtx): boolean {
  if (st.ko || st.roundOver) return false;
  const f = st.fighters[i];
  if (f.hitlag > 0) return false;
  if (f.mode === 'idle' || f.mode === 'down') return true;
  if (f.mode === 'move' && f.move && !f.move.offered) {
    const m = moveDef(ctx, f);
    if (!m) return false;
    const fr = f.move.frame;
    if (m.iasa !== undefined && fr >= m.iasa) return true;
    if (m.cancelOnHit !== undefined && f.move.hit && fr >= m.cancelOnHit) return true;
    if (m.cancelOnBlock !== undefined && f.move.blocked && fr >= m.cancelOnBlock) return true;
  }
  return false;
}

/** Is fighter i only cancelling out of a move in progress? */
export function inCancelWindow(st: GameState, i: number, ctx: SimCtx): boolean {
  const f = st.fighters[i];
  return f.mode === 'move' && canAct(st, i, ctx);
}

export function needsInput(st: GameState, i: number, ctx: SimCtx): Need {
  if (st.ko || st.roundOver) return 'none';
  if (canAct(st, i, ctx)) return 'act';
  const f = st.fighters[i];
  if (f.mode === 'hitstun') return 'di';
  return 'none';
}

export interface Availability {
  ok: boolean;
  reason?: string;
}

export function moveAvailable(st: GameState, i: number, m: MoveDef, ctx: SimCtx): Availability {
  const f = st.fighters[i];
  if (m.hidden) return { ok: false, reason: 'internal' };
  const need = needsInput(st, i, ctx);
  if (need === 'none') return { ok: false, reason: 'busy' };
  if (need === 'di') {
    if (!m.burst) return { ok: false, reason: 'in hitstun' };
    return f.burst >= BURST_MAX ? { ok: true } : { ok: false, reason: 'burst not charged' };
  }
  if (f.mode === 'down') return m.wake ? { ok: true } : { ok: false, reason: 'get up first' };
  if (m.wake) return { ok: false, reason: 'only after a knockdown' };
  if (m.where === 'ground' && !f.grounded) return { ok: false, reason: 'on the ground only' };
  if (m.where === 'air' && f.grounded) return { ok: false, reason: 'in the air only' };
  if (m.meter && f.meter < m.meter) return { ok: false, reason: `needs ${m.meter / 1000} bar${m.meter > 1000 ? 's' : ''}` };
  if (m.burst && f.burst < BURST_MAX) return { ok: false, reason: 'burst not charged' };
  if (m.uses === 'airJump' && f.airJumps <= 0) return { ok: false, reason: 'no air jumps left' };
  if (m.uses === 'airDash' && f.airDashes <= 0) return { ok: false, reason: 'no air dashes left' };
  if (m.needsProj && !st.projs.some((p) => !p.dead && p.owner === i && p.kind === m.needsProj)) {
    const pd = charOf(ctx, f).projectiles[m.needsProj];
    return { ok: false, reason: `needs ${pd?.name ?? 'a projectile'} out` };
  }
  if (m.limitProj && st.projs.some((p) => !p.dead && p.owner === i && p.kind === m.limitProj)) {
    const pd = charOf(ctx, f).projectiles[m.limitProj];
    return { ok: false, reason: `${pd?.name ?? 'projectile'} already out` };
  }
  return { ok: true };
}

export function canFeint(st: GameState, i: number, m: MoveDef): boolean {
  if (m.cat !== 'attack' && m.cat !== 'special') return false;
  if (!Number.isFinite(firstActive(m)) || firstActive(m) < 1) return false;
  if (m.throw) return false;
  return st.fighters[i].meter >= (m.meter ?? 0) + FEINT_COST;
}

/** Clamp a direction to its spec. */
export function clampDir(spec: DirSpec | undefined, d: unknown, facing: 1 | -1): [number, number] {
  const fallback: [number, number] = spec ? [spec.def[0] * facing, spec.def[1]] : [facing * 100, 0];
  if (!Array.isArray(d) || d.length !== 2) return fallback;
  let x = Math.trunc(Number(d[0]));
  let y = Math.trunc(Number(d[1]));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return fallback;
  x = clamp(x, -100, 100);
  y = clamp(y, -100, 100);
  // Keep it inside the unit circle.
  const l = len2(x, y);
  if (l > 100) {
    x = Math.trunc((x * 100) / l);
    y = Math.trunc((y * 100) / l);
  }
  if (!spec) return [x, y];
  switch (spec.kind) {
    case 'side':
      return [x < 0 ? -100 : x > 0 ? 100 : spec.def[0] * facing, 0];
    case 'up':
      if (y > -(spec.min ?? 25)) y = -(spec.min ?? 25);
      break;
    case 'down':
      if (y < (spec.min ?? 20)) y = spec.min ?? 20;
      break;
    case 'aim':
      if (x === 0 && y === 0) return fallback;
      break;
    case 'free':
      if (spec.min && len2(x, y) < spec.min) return fallback;
      break;
  }
  const l2 = len2(x, y);
  if (l2 > 100) {
    x = Math.trunc((x * 100) / l2);
    y = Math.trunc((y * 100) / l2);
  }
  return [x, y];
}

export function defaultDecision(st: GameState, i: number, ctx: SimCtx): Decision {
  const need = needsInput(st, i, ctx);
  if (need !== 'act') return { move: '' };
  const f = st.fighters[i];
  if (f.mode === 'down') return { move: 'getup' };
  if (f.mode === 'move') return { move: '' };
  return { move: 'wait', amt: 10 };
}

/** Make any decision legal for fighter i in this state. */
export function sanitize(st: GameState, i: number, d: Decision | null | undefined, ctx: SimCtx): Decision {
  const f = st.fighters[i];
  const need = needsInput(st, i, ctx);
  const raw: Partial<Decision> = d && typeof d === 'object' ? d : {};
  if (need === 'none') return { move: '' };
  if (need === 'di') {
    const out: Decision = { move: '', di: clampDir(undefined, raw.di, f.facing) };
    if (raw.move === 'burst') {
      const m = charOf(ctx, f).moves.burst;
      if (m && moveAvailable(st, i, m, ctx).ok) out.move = 'burst';
    }
    return out;
  }
  const id = typeof raw.move === 'string' ? raw.move : '';
  if (!id) return defaultDecision(st, i, ctx);
  const m = charOf(ctx, f).moves[id];
  if (!m || !moveAvailable(st, i, m, ctx).ok) return defaultDecision(st, i, ctx);
  const out: Decision = { move: id };
  if (m.param?.dir) {
    // Facing for defaults is the facing the move will start with.
    const o = st.fighters[1 - i];
    const facing = m.noTurn ? f.facing : o.x > f.x ? 1 : o.x < f.x ? -1 : f.facing;
    out.dir = clampDir(m.param.dir, raw.dir, facing);
  }
  if (m.param?.amt) {
    const a = m.param.amt;
    const n = Math.trunc(Number(raw.amt));
    out.amt = Number.isFinite(n) ? clamp(n, a.min, a.max) : a.def;
  }
  if (raw.feint && canFeint(st, i, m)) out.feint = true;
  return out;
}

/** The facing a fighter would have if it started a move now. */
export function startFacing(st: GameState, i: number, m: MoveDef): 1 | -1 {
  const f = st.fighters[i];
  const o = st.fighters[1 - i];
  if (m.noTurn) return f.facing;
  return o.x > f.x ? 1 : o.x < f.x ? -1 : f.facing;
}

export function defaultDecisionFor(st: GameState, i: number, m: MoveDef): Decision {
  const d: Decision = { move: m.id };
  if (m.param?.dir) d.dir = defaultDir(m, startFacing(st, i, m));
  if (m.param?.amt) d.amt = m.param.amt.def;
  return d;
}
