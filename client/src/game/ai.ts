/**
 * CPU opponent.
 *
 * At every decision point the CPU builds a menu of concrete options (moves
 * with sensible parameters), a smaller set of things the human might do,
 * and plays every pairing forward ~45 frames with the real simulation.
 * Each outcome is scored (damage, frame advantage, knockdowns, corner
 * pressure, spacing for its archetype), giving a payoff matrix. Harder CPUs
 * approximate the game-theoretic mixed strategy for that matrix, so they're
 * hard to exploit; easier ones assume you'll stand still and add noise.
 */

import { abs, len2, px, sign } from '../sim/fixed';
import { applyDecisions } from '../sim/resolve';
import { canAct, moveAvailable, needsInput, sanitize } from '../sim/rules';
import { cloneState } from '../sim/state';
import { lastActive, firstActive, stepFrame } from '../sim/step';
import type { CharacterDef, Decision, Fighter, GameState, MoveDef, SimCtx } from '../sim/types';

export type Difficulty = 0 | 1 | 2;

interface Profile {
  /** Spacing (px) this archetype wants. */
  range: number;
  aggression: number;
}

const PROFILES: Record<string, Profile> = {
  razor: { range: 90, aggression: 1.2 },
  titan: { range: 120, aggression: 1.0 },
  arc: { range: 330, aggression: 0.7 },
  grip: { range: 70, aggression: 1.15 },
};

const HORIZON = [30, 42, 52];

type Rand = () => number;

export function cpuDecide(st: GameState, me: number, ctx: SimCtx, level: Difficulty, rand: Rand = Math.random): Decision {
  const need = needsInput(st, me, ctx);
  if (need === 'none') return { move: '' };
  if (need === 'di') return sanitize(st, me, diChoice(st, me, ctx, level, rand), ctx);

  const mine = candidates(st, me, ctx, level);
  if (mine.length === 0) return sanitize(st, me, null, ctx);
  const theirs = responses(st, 1 - me, ctx, level);

  // Payoff matrix: rows = my options, cols = their options.
  const M: number[][] = mine.map((a) => theirs.map((b) => evaluate(st, me, a, b, ctx, HORIZON[level])));

  let weights: number[];
  if (level === 0) {
    // Assume the opponent idles; pick among the better half at random.
    const vals = M.map((row) => row[0]);
    weights = softmax(vals, 40);
  } else if (level === 1) {
    const colW = theirs.map((_, j) => (j === 0 ? 1.5 : 1));
    const vals = M.map((row) => row.reduce((s, v, j) => s + v * colW[j], 0) / colW.reduce((s, w) => s + w, 0));
    weights = softmax(vals, 18);
  } else {
    weights = solveMixed(M, 300);
    // A little exploration so hard CPUs aren't perfectly predictable.
    const n = weights.length;
    weights = weights.map((w) => w * 0.94 + 0.06 / n);
    // Prefer pure best responses when the opponent's options are all the same.
    if (theirs.length === 1) {
      const vals = M.map((row) => row[0]);
      weights = softmax(vals, 6);
    }
  }
  const pick = sample(weights, rand);
  return sanitize(st, me, mine[pick], ctx);
}

// ------------------------------------------------------------ options --

function dirTo(from: Fighter, to: Fighter, toDef: CharacterDef): [number, number] {
  const dx = to.x - from.x;
  const dy = to.y - px(toDef.height * 0.5) - (from.y - px(60));
  const l = len2(dx, dy) || 1;
  return [Math.round((dx * 100) / l), Math.round((dy * 100) / l)];
}

function reach(m: MoveDef): number {
  let r = 0;
  for (const h of m.hitboxes ?? []) {
    const xs = h.path ? h.path.map((p) => abs(p[0])) : [abs(h.x)];
    r = Math.max(r, Math.max(...xs) + h.r);
  }
  return r;
}

function candidates(st: GameState, i: number, ctx: SimCtx, level: Difficulty): Decision[] {
  const f = st.fighters[i];
  const o = st.fighters[1 - i];
  const def = ctx.chars[f.char];
  const odef = ctx.chars[o.char];
  const fwd = sign(o.x - f.x) || f.facing;
  const dist = abs(o.x - f.x);
  const out: Decision[] = [];
  const add = (d: Decision) => {
    const m = def.moves[d.move];
    if (m && moveAvailable(st, i, m, ctx).ok) out.push(d);
  };
  const aim = dirTo(f, o, odef);

  for (const id of def.order) {
    const m = def.moves[id];
    if (!moveAvailable(st, i, m, ctx).ok) continue;
    switch (id) {
      case 'wait':
        add({ move: 'wait', amt: 6 });
        if (level > 0) add({ move: 'wait', amt: 16 });
        break;
      case 'walk':
        add({ move: 'walk', dir: [fwd * 100, 0], amt: 12 });
        add({ move: 'walk', dir: [-fwd * 100, 0], amt: 12 });
        break;
      case 'dash':
        add({ move: 'dash', amt: 100 });
        if (level > 0) add({ move: 'dash', amt: 55 });
        break;
      case 'jump':
        add({ move: 'jump', dir: [fwd * 55, -100] });
        add({ move: 'jump', dir: [0, -100] });
        if (level > 0) add({ move: 'jump', dir: [-fwd * 55, -100] });
        if (level > 1) add({ move: 'jump', dir: [fwd * 80, -45] });
        break;
      case 'airjump':
        add({ move: 'airjump', dir: [fwd * 50, -100] });
        if (level > 0) add({ move: 'airjump', dir: [-fwd * 50, -100] });
        break;
      case 'airdash':
        add({ move: 'airdash', dir: [fwd * 100, 0] });
        add({ move: 'airdash', dir: [fwd * 70, 70] });
        if (level > 0) add({ move: 'airdash', dir: [-fwd * 100, 0] });
        break;
      case 'hover':
        add({ move: 'hover', dir: [0, 0], amt: 16 });
        add({ move: 'hover', dir: [-fwd * 100, 0], amt: 20 });
        break;
      case 'block':
        add({ move: 'block', amt: 10 });
        if (level > 0) add({ move: 'block', amt: 20 });
        break;
      case 'parry': {
        const t = threatFrame(st, i, ctx);
        if (t > 0) {
          const err = level === 2 ? 0 : level === 1 ? 1 : 3;
          add({ move: 'parry', amt: Math.max(1, t + (err ? Math.round((Math.random() * 2 - 1) * err) : 0)) });
        } else if (level > 0) {
          add({ move: 'parry', amt: 5 });
          if (level > 1) add({ move: 'parry', amt: 9 });
        }
        break;
      }
      case 'roll':
      case 'wake_roll':
        add({ move: id, dir: [fwd * 100, 0] });
        add({ move: id, dir: [-fwd * 100, 0] });
        break;
      case 'shadowstep':
        add({ move: id, dir: [fwd * 100, 0], amt: Math.min(240, Math.max(60, Math.round(dist / 100) + 70)) });
        add({ move: id, dir: [-fwd * 100, 0], amt: 160 });
        break;
      case 'blink':
        add({ move: id, dir: [-fwd * 100, 0] });
        add({ move: id, dir: [-fwd * 70, -70] });
        if (level > 0) add({ move: id, dir: [fwd * 100, 0] });
        break;
      case 'orb':
        add({ move: id, dir: [fwd * 70, 0] });
        add({ move: id, dir: [0, 0] });
        break;
      case 'leap': {
        const k = Math.min(100, Math.round(dist / 4 / 100));
        add({ move: id, dir: [fwd * Math.max(20, k), -90] });
        break;
      }
      case 'divekick':
      case 'dropslam':
      case 'elbowdrop':
        add({ move: id, dir: [Math.round(aim[0] * 0.8), Math.max(30, aim[1])] });
        break;
      case 'missile': {
        // land it on them, or a little in front to catch a dash in
        const d = Math.round(dist / 100);
        add({ move: id, amt: Math.max(80, Math.min(720, d)) });
        if (level > 0) add({ move: id, amt: Math.max(80, Math.min(720, d - 70)) });
        break;
      }
      default:
        if (m.param?.dir?.kind === 'aim') {
          add({ move: id, dir: aim });
        } else if (m.param?.dir?.kind === 'side') {
          add({ move: id, dir: [fwd * 100, 0] });
          if (level > 0 && (m.hitboxes?.some((h) => h.kind === 'grab') || m.cat === 'attack')) add({ move: id, dir: [-fwd * 100, 0] });
        } else if (m.param?.dir) {
          add({ move: id, dir: aim });
        } else {
          // Strikes the opponent can't possibly reach are pruned early.
          const r = reach(m);
          if (r > 0 && !m.spawns && m.script !== 'dive' && dist / 100 > r + odef.width + 260) continue;
          add({ move: id });
        }
    }
  }
  return out;
}

/** What the opponent might do, for the payoff matrix. */
function responses(st: GameState, i: number, ctx: SimCtx, level: Difficulty): Decision[] {
  const need = needsInput(st, i, ctx);
  if (need !== 'act') return [{ move: '', di: [0, 0] }];
  const f = st.fighters[i];
  if (f.mode === 'move') return [{ move: '' }];
  const def = ctx.chars[f.char];
  const o = st.fighters[1 - i];
  const fwd = sign(o.x - f.x) || f.facing;
  const out: Decision[] = [];
  const add = (d: Decision) => {
    const m = def.moves[d.move];
    if (m && moveAvailable(st, i, m, ctx).ok && !out.some((x) => x.move === d.move)) out.push(d);
  };
  if (f.mode === 'down') {
    add({ move: 'getup' });
    add({ move: 'wake_attack' });
    add({ move: 'wake_roll', dir: [-fwd * 100, 0] });
    return out.length ? out : [{ move: '' }];
  }
  add({ move: 'wait', amt: 8 });
  if (level === 0) return out;
  add({ move: 'block', amt: 16 });
  // Their fastest strike and their grab.
  const strikes = def.order
    .map((id) => def.moves[id])
    .filter((m) => (m.cat === 'attack' || m.cat === 'special') && m.hitboxes?.length && !m.hidden && moveAvailable(st, i, m, ctx).ok);
  strikes.sort((a, b) => firstActive(a) - firstActive(b));
  const fast = strikes.find((m) => !m.hitboxes!.some((h) => h.kind === 'grab'));
  if (fast) add({ move: fast.id, dir: fast.param?.dir ? [fwd * 100, 0] : undefined });
  const grab = strikes.find((m) => m.hitboxes!.some((h) => h.kind === 'grab'));
  if (grab) add({ move: grab.id, dir: [fwd * 100, 0] });
  if (f.grounded) add({ move: 'jump', dir: [fwd * 50, -100] });
  if (level > 1) {
    if (f.grounded) add({ move: 'backdash' });
    const big = strikes.filter((m) => !m.hitboxes!.some((h) => h.kind === 'grab')).sort((a, b) => maxDmg(b) - maxDmg(a))[0];
    if (big) add({ move: big.id, dir: big.param?.dir ? [fwd * 100, 0] : undefined });
    add({ move: 'dash', amt: 100 });
  }
  return out;
}

function maxDmg(m: MoveDef): number {
  return Math.max(0, ...(m.hitboxes ?? []).map((h) => h.dmg));
}

/** If the opponent's current action will strike us while we stand still,
 *  the move frame a parry started now should be timed for. */
function threatFrame(st: GameState, me: number, ctx: SimCtx): number {
  const o = st.fighters[1 - me];
  const busy = o.mode === 'move' || st.projs.some((p) => p.owner !== me);
  if (!busy) return -1;
  const s = cloneState(st);
  const ds: [Decision, Decision] = [{ move: '' }, { move: '' }];
  ds[me] = { move: 'wait', amt: 40 };
  applyDecisions(s, ds, ctx, null);
  const ev: { t: string; v?: number; f: number }[] = [];
  const start = s.frame;
  for (let n = 0; n < 40; n++) {
    stepFrame(s, ctx, ev as never);
    const hit = ev.find((e) => e.t === 'hit' && e.v === me);
    if (hit) return hit.f - start;
    if (canAct(s, 1 - me, ctx) && s.fighters[1 - me].mode !== 'move') return -1;
  }
  return -1;
}

// ------------------------------------------------------------ rollout --

function evaluate(st: GameState, me: number, mine: Decision, theirs: Decision, ctx: SimCtx, horizon: number): number {
  const s = cloneState(st);
  const o = 1 - me;
  const ds: [Decision, Decision] = me === 0 ? [mine, theirs] : [theirs, mine];
  applyDecisions(s, ds, ctx, null);
  const hp0 = [st.fighters[0].hp, st.fighters[1].hp];
  for (let n = 0; n < horizon; n++) {
    stepFrame(s, ctx, null);
    if (s.ko) break;
    const a = canAct(s, me, ctx);
    const b = canAct(s, o, ctx);
    if (a || b) {
      const next: [Decision, Decision] = [{ move: '' }, { move: '' }];
      if (a) next[me] = reactive(s, me, ctx);
      if (b) next[o] = reactive(s, o, ctx);
      applyDecisions(s, next, ctx, null);
    }
  }
  return score(st, s, me, ctx, hp0);
}

/** Cheap continuation policy used inside rollouts. */
function reactive(st: GameState, i: number, ctx: SimCtx): Decision {
  const f = st.fighters[i];
  const o = st.fighters[1 - i];
  if (f.mode === 'down') return { move: 'getup' };
  if (f.mode === 'move') return { move: '' };
  const def = ctx.chars[f.char];
  const dist = abs(o.x - f.x) / 100 - ctx.chars[o.char].width;
  const vulnerable = o.mode === 'hitstun' || o.mode === 'parried' || (o.mode === 'move' && o.move && lastActive(ctx.chars[o.char].moves[o.move.id]) < o.move.frame);
  if (vulnerable) {
    let best: MoveDef | null = null;
    for (const id of def.order) {
      const m = def.moves[id];
      if (m.cat !== 'attack' || !m.hitboxes?.length || m.hitboxes.some((h) => h.kind === 'grab')) continue;
      if (!moveAvailable(st, i, m, ctx).ok) continue;
      if (reach(m) < dist) continue;
      if (!best || firstActive(m) < firstActive(best)) best = m;
    }
    if (best) return { move: best.id };
  }
  const threat = o.mode === 'move' && o.move && ctx.chars[o.char].moves[o.move.id].hitboxes?.some((h) => h.kind !== 'grab') && o.move.frame <= lastActive(ctx.chars[o.char].moves[o.move.id]);
  if (threat && moveAvailable(st, i, def.moves.block, ctx).ok) return { move: 'block', amt: 10 };
  return { move: 'wait', amt: 4 };
}

function busyFor(f: Fighter, ctx: SimCtx, st: GameState, i: number): number {
  if (canAct(st, i, ctx)) return 0;
  let n = f.hitlag;
  switch (f.mode) {
    case 'move':
      n += f.move ? f.move.total - f.move.frame : 0;
      if (f.move && f.move.victim >= 0) n -= 40; // mid-throw is good for us
      break;
    case 'hitstun':
      n += f.stun + (f.grounded ? 0 : 10);
      break;
    case 'blockstun':
    case 'parried':
      n += f.stun;
      break;
    case 'kd':
      n += f.stun + 8;
      break;
    case 'grabbed':
      n += 40;
      break;
    case 'ko':
      n += 200;
      break;
  }
  return n;
}

function score(before: GameState, s: GameState, me: number, ctx: SimCtx, hp0: number[]): number {
  const o = 1 - me;
  const F = s.fighters;
  if (F[o].mode === 'ko' || F[o].hp <= 0) return 5000;
  if (F[me].mode === 'ko' || F[me].hp <= 0) return -5000;
  const dealt = hp0[o] - F[o].hp;
  const taken = hp0[me] - F[me].hp;
  let v = dealt * 1.15 - taken;
  // Grabs in progress count as the damage they're about to do.
  if (F[me].move && F[me].move!.victim >= 0) v += 60;
  if (F[o].move && F[o].move!.victim >= 0) v -= 60;
  const adv = Math.max(-30, Math.min(30, busyFor(F[o], ctx, s, o) - busyFor(F[me], ctx, s, me)));
  v += adv * 2.2;
  if (F[o].mode === 'hitstun' && adv > 6) v += 25;
  if (F[o].mode === 'kd') v += 30;
  if (F[me].mode === 'kd') v -= 30;
  // Spacing for the archetype.
  const prof = PROFILES[F[me].char] ?? { range: 120, aggression: 1 };
  const d = abs(F[o].x - F[me].x) / 100;
  v -= Math.min(30, abs(d - prof.range) / 12) * prof.aggression;
  // Corner pressure.
  const lim = ctx.stage.halfWidth;
  const oWall = lim - abs(F[o].x) / 100;
  const mWall = lim - abs(F[me].x) / 100;
  if (oWall < 140 && sign(F[o].x) === sign(F[o].x - F[me].x)) v += 12;
  if (mWall < 140 && sign(F[me].x) === sign(F[me].x - F[o].x)) v -= 12;
  // Meter is a resource.
  v += (F[me].meter - before.fighters[me].meter) * 0.02;
  v -= (F[o].meter - before.fighters[o].meter) * 0.02;
  return v;
}

// ------------------------------------------------------------ DI / burst --

function diChoice(st: GameState, me: number, ctx: SimCtx, level: Difficulty, rand: Rand): Decision {
  const f = st.fighters[me];
  const o = st.fighters[1 - me];
  const away = sign(f.x - o.x) || -o.facing;
  const lim = px(ctx.stage.halfWidth - 140);
  // Near a wall, DI away from it to escape the corner.
  const dx = abs(f.x) > lim ? -sign(f.x) * 100 : away * 100;
  const d: Decision = { move: '', di: level === 0 ? [Math.round(rand() * 200 - 100), Math.round(rand() * 200 - 100)] : [dx, -40] };
  const m = ctx.chars[f.char].moves.burst;
  if (m && moveAvailable(st, me, m, ctx).ok) {
    const dangerous = f.comboHits >= 3 || f.comboDmg > 140 || f.hp < ctx.chars[f.char].hp * 0.3;
    const p = level === 0 ? 0.08 : level === 1 ? 0.35 : 0.55;
    if (dangerous && rand() < p) d.move = 'burst';
  }
  return d;
}

// ------------------------------------------------------------ math --

function softmax(vals: number[], temp: number): number[] {
  const m = Math.max(...vals);
  const e = vals.map((v) => Math.exp((v - m) / Math.max(1e-6, temp)));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
}

function sample(w: number[], rand: Rand): number {
  let r = rand();
  for (let k = 0; k < w.length; k++) {
    r -= w[k];
    if (r <= 0) return k;
  }
  return w.length - 1;
}

/** Fictitious play on a zero-sum matrix: approximate equilibrium mix for
 *  the row player. */
export function solveMixed(M: number[][], iters: number): number[] {
  const R = M.length;
  const C = M[0].length;
  const rowCount = new Array(R).fill(0);
  const colCount = new Array(C).fill(0);
  const rowPay = new Array(R).fill(0);
  const colPay = new Array(C).fill(0);
  let r = 0;
  let c = 0;
  for (let t = 0; t < iters; t++) {
    rowCount[r]++;
    colCount[c]++;
    for (let i = 0; i < R; i++) rowPay[i] += M[i][c];
    for (let j = 0; j < C; j++) colPay[j] += M[r][j];
    r = argmax(rowPay);
    c = argmin(colPay);
  }
  const tot = rowCount.reduce((a, b) => a + b, 0);
  return rowCount.map((x) => x / tot);
}

function argmax(a: number[]): number {
  let k = 0;
  for (let i = 1; i < a.length; i++) if (a[i] > a[k]) k = i;
  return k;
}
function argmin(a: number[]): number {
  let k = 0;
  for (let i = 1; i < a.length; i++) if (a[i] < a[k]) k = i;
  return k;
}
