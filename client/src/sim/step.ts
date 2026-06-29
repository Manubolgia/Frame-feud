/**
 * The deterministic simulation step + full turn resolution.
 *
 * Everything here is integer/fixed-point. Given identical (state, queues, seed)
 * this produces byte-identical output on every device — the lockstep guarantee.
 */

import { absF, fxCos, fxDiv, fxMul, fxSin, isqrt, sign, type Vec2 } from './fixed';
import { cloneState, hashState, spawnActive } from './state';
import type {
  ActionQueue,
  CharacterDef,
  CharacterState,
  FrameSnapshot,
  GameState,
  HitEvent,
  KoEvent,
  MoveDef,
  ResolveResult,
  StageDef,
} from './types';

export const TICK_RATE = 60;
export const WINDOW_TICKS = 96; // 1.6s resolution window
export const PLAN_BUDGET = 5; // action-budget points per turn

const MAX_FALL = 900; // fixed velocity per tick cap
const GROUND_FRICTION = 120; // fixed velocity reduction per tick on ground
const AIR_FRICTION = 35;
const HITSTUN_DECAY_FRICTION = 18; // very light friction during knockback

interface SimCtx {
  chars: Record<string, CharacterDef>;
  stage: StageDef;
}

function defOf(ctx: SimCtx, c: CharacterState): CharacterDef {
  return ctx.chars[c.charId];
}

function moveOf(ctx: SimCtx, c: CharacterState, id: string): MoveDef | undefined {
  return defOf(ctx, c).moves[id];
}

/** Direction unit-ish vector (fixed) for an aim angle. 0deg = right, 90 = up. */
function aimDir(angle: number): Vec2 {
  return { x: fxCos(angle), y: -fxSin(angle) };
}

function isActionable(c: CharacterState): boolean {
  return c.alive && c.hitstun <= 0 && !c.current;
}

/** Begin a move on a character if possible. */
function startMove(
  ctx: SimCtx,
  c: CharacterState,
  moveId: string,
  aimAngle: number,
): void {
  const def = defOf(ctx, c);
  const m = def.moves[moveId];
  if (!m) return;
  if (m.airOnly && c.grounded) return;
  if (m.groundOnly && !c.grounded) return;
  c.current = { moveId, elapsed: 0, aimAngle, hitsDone: m.hitboxes.map(() => 0) };
  c.shielding = false;
}

/** Apply self-motion keyframes that trigger on this elapsed tick. */
function applySelfMotion(ctx: SimCtx, c: CharacterState, m: MoveDef): void {
  if (!m.selfMotion || !c.current) return;
  const e = c.current.elapsed;
  for (const sm of m.selfMotion) {
    if (sm.atTick !== e) continue;
    if (sm.velocity) {
      if (m.aimable && sm.faceAim) {
        const dir = aimDir(c.current.aimAngle);
        const speed = sm.velocity.x; // magnitude carried in x for aimed dashes
        c.vel.x = fxMul(dir.x, speed);
        c.vel.y = fxMul(dir.y, speed);
      } else {
        c.vel.x = sm.velocity.x * c.facing;
        c.vel.y = sm.velocity.y;
      }
    }
    if (sm.accel) {
      c.vel.x += sm.accel.x * c.facing;
      c.vel.y += sm.accel.y;
    }
  }
}

function moveTotalLen(m: MoveDef): number {
  return m.startup + m.active + m.recovery;
}

/** Physics integration for one character for one tick. */
function integrate(ctx: SimCtx, c: CharacterState): void {
  const def = defOf(ctx, c);

  // Gravity (skip a touch lighter while shielding on ground is naturally grounded).
  if (!c.grounded) {
    c.vel.y += def.gravity;
    if (c.vel.y > MAX_FALL) c.vel.y = MAX_FALL;
  }

  // Friction.
  if (c.hitstun > 0) {
    c.vel.x -= sign(c.vel.x) * Math.min(absF(c.vel.x), HITSTUN_DECAY_FRICTION);
  } else if (c.grounded && !c.current) {
    c.vel.x -= sign(c.vel.x) * Math.min(absF(c.vel.x), GROUND_FRICTION);
  } else if (!c.grounded) {
    c.vel.x -= sign(c.vel.x) * Math.min(absF(c.vel.x), AIR_FRICTION);
  }

  c.pos.x += c.vel.x;
  c.pos.y += c.vel.y;
}

/** Resolve landing on platforms. */
function platformCollide(ctx: SimCtx, c: CharacterState, prevY: number): void {
  const def = defOf(ctx, c);
  const foot = c.pos.y; // pos is feet position
  const prevFoot = prevY;
  c.grounded = false;
  for (const pf of ctx.stage.platforms) {
    const left = pf.x - pf.w;
    const right = pf.x + pf.w;
    if (c.pos.x < left - def.radius || c.pos.x > right + def.radius) continue;
    const surface = pf.y;
    if (c.vel.y >= 0 && prevFoot <= surface + 1 && foot >= surface) {
      // pass-through platforms only catch when falling onto them
      c.pos.y = surface;
      c.vel.y = 0;
      c.grounded = true;
      break;
    }
  }
}

/** Compute world-space active hitboxes for an attacker this tick. */
interface ActiveHit {
  cx: number;
  cy: number;
  radius: number;
  damage: number;
  kbx: number;
  kby: number;
  scaling: number;
  hitstun: number;
  idx: number; // hitbox index (for hits-done bookkeeping)
}

function activeHitboxes(ctx: SimCtx, c: CharacterState): ActiveHit[] {
  if (!c.current) return [];
  const m = moveOf(ctx, c, c.current.moveId);
  if (!m) return [];
  const e = c.current.elapsed;
  const out: ActiveHit[] = [];
  m.hitboxes.forEach((hb, idx) => {
    if (e < hb.activeStart || e > hb.activeEnd) return;
    const maxHits = hb.hits ?? 1;
    if (c.current!.hitsDone[idx] >= maxHits) return;
    let ox = hb.offset.x;
    let oy = hb.offset.y;
    let kbx = hb.knockback.x;
    let kby = hb.knockback.y;
    if (m.aimable) {
      const dir = aimDir(c.current!.aimAngle);
      const dist = ox; // aimed hitbox places offset.x along aim
      ox = fxMul(dir.x, dist);
      oy = fxMul(dir.y, dist);
      const kbMag = isqrt(kbx * kbx + kby * kby);
      kbx = fxMul(dir.x, kbMag);
      kby = fxMul(dir.y, kbMag);
    } else {
      ox *= c.facing;
      kbx *= c.facing;
    }
    out.push({
      cx: c.pos.x + ox,
      cy: c.pos.y - defOf(ctx, c).radius + oy, // offset around torso
      radius: hb.radius,
      damage: hb.damage,
      kbx,
      kby,
      scaling: hb.knockbackScaling,
      hitstun: hb.hitstun,
      idx,
    });
  });
  return out;
}

function applyKnockback(
  ctx: SimCtx,
  victim: CharacterState,
  hb: ActiveHit,
): number {
  const def = defOf(ctx, victim);
  // Smash-style: launch grows with accumulated damage, reduced by weight.
  // factor = (100 + damage * scaling/100) / weight, all integer.
  const dmgFactor = 100 + Math.trunc((victim.damagePercent * hb.scaling) / 100);
  const weight = def.weight;
  const mag = isqrt(hb.kbx * hb.kbx + hb.kby * hb.kby);
  const launch = Math.trunc((mag * dmgFactor) / weight);
  if (mag > 0) {
    victim.vel.x = Math.trunc((hb.kbx * launch) / mag);
    victim.vel.y = Math.trunc((hb.kby * launch) / mag);
  } else {
    victim.vel.y = -launch;
  }
  victim.grounded = false;
  const stun = hb.hitstun + Math.trunc(launch / 60);
  victim.hitstun = stun;
  victim.current = undefined;
  return launch;
}

function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function snapshot(state: GameState): FrameSnapshot {
  return {
    chars: state.characters.map((c) =>
      c
        ? {
            pos: { ...c.pos },
            vel: { ...c.vel },
            facing: c.facing,
            damagePercent: c.damagePercent,
            hitstun: c.hitstun,
            shielding: c.shielding,
            moveId: c.current?.moveId,
            moveElapsed: c.current?.elapsed,
            grounded: c.grounded,
            invuln: c.invuln,
            aimAngle: c.current?.aimAngle ?? (c.facing === 1 ? 0 : 180),
          }
        : null,
    ),
  };
}

/**
 * Resolve a full turn: run WINDOW_TICKS of deterministic simulation over all
 * player queues, then handle KO/dynasty-swap, advance turn counter, hash.
 */
export function resolveTurn(
  start: GameState,
  queues: ActionQueue[],
  ctx: SimCtx,
): ResolveResult {
  const state = cloneState(start);
  const frames: FrameSnapshot[] = [snapshot(state)];
  const hits: HitEvent[] = [];
  const kos: KoEvent[] = [];

  // Index queues by player order.
  const queueByPlayer = new Map<string, ActionQueue>();
  for (const q of queues) queueByPlayer.set(q.playerId, q);

  for (let tick = 0; tick < WINDOW_TICKS; tick++) {
    // --- Phase A: start scheduled actions & advance move timers ---
    state.characters.forEach((c, i) => {
      if (!c || !c.alive) return;
      const q = queueByPlayer.get(state.players[i].playerId);
      if (q) {
        for (const a of q.actions) {
          if (a.startTick === tick && isActionable(c)) {
            startMove(ctx, c, a.moveId, a.aimAngle ?? (c.facing === 1 ? 0 : 180));
          }
        }
      }
      if (c.invuln > 0) c.invuln--;
      if (c.hitstun > 0) c.hitstun--;

      if (c.current) {
        const m = moveOf(ctx, c, c.current.moveId);
        if (m) {
          applySelfMotion(ctx, c, m);
          // shield active during the move's active window for shield moves
          c.shielding = m.kind === 'shield' && c.current.elapsed >= m.startup &&
            c.current.elapsed < m.startup + m.active;
          // i-frames for dodges / counters (cover startup through active)
          if (m.invulnFrames && c.current.elapsed < m.invulnFrames) {
            c.invuln = Math.max(c.invuln, 2);
          }
        }
      } else {
        c.shielding = false;
      }
    });

    // --- Phase B: physics integration ---
    const prevY: number[] = state.characters.map((c) => (c ? c.pos.y : 0));
    state.characters.forEach((c) => {
      if (!c || !c.alive) return;
      integrate(ctx, c);
    });

    // --- Phase C: platform collisions ---
    state.characters.forEach((c, i) => {
      if (!c || !c.alive) return;
      platformCollide(ctx, c, prevY[i]);
    });

    // --- Phase D: hit detection (deterministic attacker order) ---
    state.characters.forEach((attacker, ai) => {
      if (!attacker || !attacker.alive || !attacker.current) return;
      const boxes = activeHitboxes(ctx, attacker);
      if (boxes.length === 0) return;
      state.characters.forEach((victim, vi) => {
        if (vi === ai || !victim || !victim.alive) return;
        if (victim.invuln > 0) return;
        const def = defOf(ctx, victim);
        for (const hb of boxes) {
          if (attacker.current!.hitsDone[hb.idx] >= (1)) {
            // re-check against multi-hit cap inside activeHitboxes already; guard simple
          }
          const rr = hb.radius + def.radius;
          if (
            distSq(hb.cx, hb.cy, victim.pos.x, victim.pos.y - def.radius) <=
            rr * rr
          ) {
            attacker.current!.hitsDone[hb.idx]++;
            const shielded = victim.shielding;
            if (shielded) {
              // chip: small pushback, tiny damage, no launch
              victim.vel.x = sign(hb.kbx || (vi < ai ? -1 : 1)) * 120;
              hits.push({
                tick,
                attacker: ai,
                victim: vi,
                pos: { x: victim.pos.x, y: victim.pos.y - def.radius },
                damage: 0,
                knockback: 120,
                shielded: true,
              });
            } else {
              victim.damagePercent += hb.damage;
              victim.facing = attacker.pos.x <= victim.pos.x ? 1 : -1;
              const launch = applyKnockback(ctx, victim, hb);
              hits.push({
                tick,
                attacker: ai,
                victim: vi,
                pos: { x: victim.pos.x, y: victim.pos.y - def.radius },
                damage: hb.damage,
                knockback: launch,
                shielded: false,
              });
            }
            break; // one hitbox connection per attacker per victim per tick
          }
        }
      });
    });

    // --- Phase E: advance move elapsed & expire finished moves ---
    state.characters.forEach((c) => {
      if (!c || !c.alive || !c.current) return;
      c.current.elapsed++;
      const m = moveOf(ctx, c, c.current.moveId);
      if (!m || c.current.elapsed >= moveTotalLen(m)) {
        c.current = undefined;
        c.shielding = false;
      }
    });

    // --- Phase F: blast-zone KO checks ---
    const bz = ctx.stage.blastZones;
    state.characters.forEach((c, i) => {
      if (!c || !c.alive) return;
      if (
        c.pos.x < bz.left ||
        c.pos.x > bz.right ||
        c.pos.y < bz.top ||
        c.pos.y > bz.bottom
      ) {
        c.alive = false;
        kos.push({ tick, victim: i, pos: { x: c.pos.x, y: c.pos.y } });
      }
    });

    frames.push(snapshot(state));
  }

  // --- Post-turn: process KOs into dynasty swaps / eliminations ---
  state.characters.forEach((c, i) => {
    if (c && c.alive) return;
    const p = state.players[i];
    if (p.eliminated) {
      state.characters[i] = null;
      return;
    }
    // this character died (or was already dead this turn)
    if (c && !c.alive) {
      p.activeIndex++;
      p.stocksRemaining = Math.max(0, p.dynasty.length - p.activeIndex);
      if (p.activeIndex >= p.dynasty.length) {
        p.eliminated = true;
        state.characters[i] = null;
      } else {
        spawnActive(state, i, ctx.stage, ctx.chars);
      }
    }
  });

  state.turn = start.turn + 1;
  const hash = hashState(state);
  return { frames, hits, kos, endState: state, hash };
}

/** Number of players still in the match. */
export function aliveCount(state: GameState): number {
  return state.players.filter((p) => !p.eliminated).length;
}

export function matchWinner(state: GameState): number | null {
  const alive = state.players
    .map((p, i) => ({ p, i }))
    .filter((x) => !x.p.eliminated);
  if (alive.length === 1) return alive[0].i;
  if (alive.length === 0) return -1; // draw (simultaneous KO)
  return null;
}

export function totalBudget(): number {
  return PLAN_BUDGET;
}

export function queueCost(ctx: SimCtx, q: ActionQueue): number {
  const def = ctx.chars[q.characterId];
  if (!def) return Infinity;
  let sum = 0;
  for (const a of q.actions) {
    const m = def.moves[a.moveId];
    if (!m) return Infinity;
    sum += m.cost;
  }
  return sum;
}

/** Server-shareable validation: legal moves, within budget + window. */
export function validateQueue(
  ctx: SimCtx,
  q: ActionQueue,
): { ok: boolean; reason?: string } {
  const def = ctx.chars[q.characterId];
  if (!def) return { ok: false, reason: 'unknown character' };
  let cost = 0;
  for (const a of q.actions) {
    const m = def.moves[a.moveId];
    if (!m) return { ok: false, reason: `unknown move ${a.moveId}` };
    if (a.startTick < 0 || a.startTick >= WINDOW_TICKS)
      return { ok: false, reason: 'action outside window' };
    cost += m.cost;
  }
  if (cost > PLAN_BUDGET) return { ok: false, reason: 'over budget' };
  return { ok: true };
}

export { fxDiv, fxMul, fxSin };
export type { SimCtx };
