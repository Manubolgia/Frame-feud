/**
 * One frame of the deterministic simulation.
 *
 * Integer math only. Given the same state and decisions, every device steps
 * to the same next frame: that's the lockstep guarantee the netcode and the
 * replays both stand on.
 */

import { abs, clamp, isqrt, len2, lerpI, px, sign, withLength } from './fixed';
import { BURST_MAX, KO_TAIL, METER_MAX } from './state';
import type {
  CharacterDef,
  Decision,
  Fighter,
  GameState,
  HitDef,
  HitboxDef,
  HitKind,
  MoveDef,
  Projectile,
  ProjectileDef,
  SimCtx,
  SimEvent,
} from './types';

export const FEINT_COST = 500;
export const PARRY_WINDOW = 3;
export const PARRY_RECOVERY = 14;
export const PARRY_STUN = 18;
export const KD_FRAMES = 30;
export const DI_PCT = 28;

const GROUND_FRICTION = px(1.1);
const STUN_FRICTION = px(0.5);
const AIR_DRAG = px(0.035);
const DI_DRIFT = 5; // sub-px/frame² at full DI
const BURST_REGEN_EVERY = 3;

type Ev = SimEvent[] | null;

const emit = (ev: Ev, e: SimEvent) => {
  if (ev) ev.push(e);
};

export const charOf = (ctx: SimCtx, f: Fighter): CharacterDef => ctx.chars[f.char];
export const moveDef = (ctx: SimCtx, f: Fighter): MoveDef | undefined =>
  f.move ? ctx.chars[f.char].moves[f.move.id] : undefined;

/** First frame a move does something threatening (hitbox or projectile). */
export function firstActive(m: MoveDef): number {
  let best = Infinity;
  for (const h of m.hitboxes ?? []) best = Math.min(best, h.f0);
  for (const s of m.spawns ?? []) best = Math.min(best, s.f);
  if (m.throw) best = Math.min(best, 0);
  return best;
}

export function lastActive(m: MoveDef): number {
  let best = -1;
  for (const h of m.hitboxes ?? []) best = Math.max(best, h.f1);
  for (const s of m.spawns ?? []) best = Math.max(best, s.f);
  return best;
}

function groupCount(m: MoveDef): number {
  let n = 1;
  for (const h of m.hitboxes ?? []) n = Math.max(n, (h.group ?? 0) + 1);
  return n;
}

/** Direction param defaults are authored facing-relative. */
export function defaultDir(m: MoveDef, facing: 1 | -1): [number, number] {
  const d = m.param?.dir?.def ?? [100, 0];
  return [d[0] * facing, d[1]];
}

// ------------------------------------------------------------ decisions --

export function faceOpponent(st: GameState, i: number) {
  const f = st.fighters[i];
  const o = st.fighters[1 - i];
  if (o.x !== f.x) f.facing = o.x > f.x ? 1 : -1;
}

/** Start `d.move` on fighter i. The decision must already be sanitized. */
export function startMove(st: GameState, i: number, d: Decision, ctx: SimCtx, ev: Ev) {
  const f = st.fighters[i];
  const def = charOf(ctx, f);
  const m = def.moves[d.move];
  if (!m) return;
  if (!m.noTurn) faceOpponent(st, i);
  if (m.meter) f.meter -= m.meter;
  if (d.feint) f.meter -= FEINT_COST;
  if (m.burst) {
    f.burst = 0;
    // Bursting out of a combo ends it.
    f.comboHits = 0;
    f.comboDmg = 0;
    f.di = [0, 0];
    f.gb = false;
    f.wb = false;
  }
  if (m.uses === 'airJump') f.airJumps--;
  if (m.uses === 'airDash') f.airDashes--;
  const amt = d.amt ?? m.param?.amt?.def ?? 0;
  let total = m.total;
  if (m.amtIsLength) total = amt + (m.amtExtra ?? 0);
  if (m.parry) total = amt + PARRY_WINDOW + PARRY_RECOVERY;
  const g = groupCount(m);
  f.move = {
    id: m.id,
    frame: 0,
    total: Math.max(1, total),
    dir: d.dir ? [d.dir[0], d.dir[1]] : defaultDir(m, f.facing),
    amt,
    feint: !!d.feint,
    hit: false,
    blocked: false,
    offered: false,
    armor: m.armor ? m.armor[2] : 0,
    hits: new Array(g).fill(0),
    last: new Array(g).fill(-9999),
    ox: f.x,
    oy: f.y,
    victim: -1,
  };
  f.mode = 'move';
  f.stun = 0;
  if (m.superFlash) f.stats.supers++;
  emit(ev, { t: 'move', f: st.frame, i, move: m.id });
}

function endMove(st: GameState, i: number) {
  const f = st.fighters[i];
  if (f.move && f.move.victim >= 0) releaseVictim(st, f.move.victim);
  f.move = null;
  f.mode = 'idle';
}

function releaseVictim(st: GameState, v: number) {
  const o = st.fighters[v];
  if (o.mode === 'grabbed') {
    o.mode = 'hitstun';
    o.stun = 6;
    o.grounded = o.y >= 0;
  }
}

/** Landing lag: a tiny hidden move. */
function startLanding(st: GameState, i: number, frames: number, ctx: SimCtx) {
  const f = st.fighters[i];
  if (frames <= 0) {
    f.move = null;
    f.mode = 'idle';
    return;
  }
  f.move = null;
  startMove(st, i, { move: 'land', amt: frames }, ctx, null);
}

// ------------------------------------------------------------ the frame --

export function stepFrame(st: GameState, ctx: SimCtx, ev: Ev) {
  const F = st.fighters;
  const frozen = [F[0].hitlag > 0, F[1].hitlag > 0];
  for (let i = 0; i < 2; i++) if (frozen[i]) F[i].hitlag--;

  const setV: [boolean, boolean][] = [
    [false, false],
    [false, false],
  ];
  for (let i = 0; i < 2; i++) if (!frozen[i]) setV[i] = moveFrame(st, i, ctx, ev);
  for (let i = 0; i < 2; i++) if (!frozen[i]) physics(st, i, ctx, ev, setV[i]);
  separate(st, ctx);
  updateProjectiles(st, ctx, ev);
  const struck = st.ko ? [false, false] : detectHits(st, ctx, ev, frozen);
  for (let i = 0; i < 2; i++) if (!frozen[i] && !struck[i]) advance(st, i, ctx, ev);

  for (let i = 0; i < 2; i++) {
    const f = F[i];
    if (f.mode === 'idle' && f.grounded && f.hitlag === 0) faceOpponent(st, i);
    if (f.mode !== 'ko' && st.frame % BURST_REGEN_EVERY === 0 && f.burst < BURST_MAX) f.burst++;
  }

  if (!st.ko) {
    const ko0 = F[0].mode === 'ko';
    const ko1 = F[1].mode === 'ko';
    if (ko0 || ko1) st.ko = { at: st.frame, winner: ko0 && ko1 ? -1 : ko0 ? 1 : 0 };
  } else if (!st.roundOver && st.frame - st.ko.at >= KO_TAIL) {
    st.roundOver = true;
    const w = st.ko.winner;
    if (w < 0) {
      st.wins[0]++;
      st.wins[1]++;
    } else st.wins[w]++;
    const need = st.cfg.roundsToWin;
    if (st.wins[0] >= need && st.wins[1] >= need) st.winner = -1;
    else if (st.wins[0] >= need) st.winner = 0;
    else if (st.wins[1] >= need) st.winner = 1;
  }
  st.frame++;
}

/** Move scripts for the current move frame. Returns which velocity axes the
 *  move set explicitly this frame (those skip friction / gravity). */
function moveFrame(st: GameState, i: number, ctx: SimCtx, ev: Ev): [boolean, boolean] {
  const f = st.fighters[i];
  const def = charOf(ctx, f);
  let sx = false;
  let sy = false;

  if (f.mode === 'hitstun' && !f.grounded) {
    // Directional influence: a gentle drift while tumbling.
    f.vx += Math.trunc((f.di[0] * DI_DRIFT) / 100);
  }

  if (f.mode !== 'move' || !f.move) return [false, false];
  const mv = f.move;
  const m = def.moves[mv.id];
  if (!m) return [false, false];
  const fr = mv.frame;
  const fc = f.facing;

  if (mv.feint && fr === firstActive(m)) {
    emit(ev, { t: 'feint', f: st.frame, i });
    endMove(st, i);
    return [false, false];
  }

  // Generic motion keys.
  for (const k of m.motion ?? []) {
    if (fr < k.f || fr > (k.to ?? k.f)) continue;
    if (k.vx !== undefined) {
      f.vx = px(k.vx) * fc;
      sx = true;
    }
    if (k.vy !== undefined) {
      f.vy = px(k.vy);
      sy = true;
      if (f.vy < 0) f.grounded = false;
    }
    if (k.ax !== undefined) {
      f.vx += px(k.ax) * fc;
      sx = true;
    }
    if (k.ay !== undefined) {
      f.vy += px(k.ay);
      sy = true;
    }
  }

  const sp = m.sp ?? {};
  const dx = mv.dir[0];
  const dy = mv.dir[1];
  switch (m.script) {
    case 'walk': {
      const dirX = sign(dx) || fc;
      f.vx = def.walk * dirX;
      sx = true;
      const o = st.fighters[1 - i];
      if (sign(o.x - f.x) === dirX && f.meter < METER_MAX) f.meter = Math.min(METER_MAX, f.meter + 2);
      break;
    }
    case 'dash': {
      const speed = Math.trunc((def.dash * clamp(mv.amt, 30, 100)) / 100);
      if (fr >= 2 && fr <= 11) {
        f.vx = fc * Math.trunc((speed * (100 - (fr - 2) * 5)) / 100);
        sx = true;
        if (f.meter < METER_MAX) f.meter = Math.min(METER_MAX, f.meter + 4);
      }
      if (fr === 2) emit(ev, { t: 'jump', f: st.frame, i, x: f.x, y: f.y, air: false });
      break;
    }
    case 'backdash': {
      if (fr >= 1 && fr <= 9) {
        f.vx = -fc * Math.trunc((def.backdash * (100 - (fr - 1) * 7)) / 100);
        sx = true;
      }
      break;
    }
    case 'jump': {
      if (fr === 3) {
        const mag = clamp(abs(dy), 25, 100);
        f.vy = -Math.trunc((def.jump * (45 + Math.trunc((55 * mag) / 100))) / 100);
        f.vx = Math.trunc((def.airSpeed * clamp(dx, -100, 100)) / 100);
        f.grounded = false;
        f.y -= 1;
        sx = sy = true;
        emit(ev, { t: 'jump', f: st.frame, i, x: f.x, y: f.y, air: false });
      }
      break;
    }
    case 'airjump': {
      if (fr === 0) {
        const mag = clamp(abs(dy), 25, 100);
        f.vy = -Math.trunc((def.jump * (40 + Math.trunc((50 * mag) / 100))) / 100);
        f.vx = Math.trunc((def.airSpeed * clamp(dx, -100, 100)) / 100);
        sx = sy = true;
        emit(ev, { t: 'jump', f: st.frame, i, x: f.x, y: f.y, air: true });
      }
      break;
    }
    case 'airdash': {
      if (fr <= 1) {
        f.vx = 0;
        f.vy = 0;
        sx = sy = true;
      } else if (fr === 2) {
        const [vx, vy] = withLength(dx, dy, def.airDash);
        f.vx = vx;
        f.vy = vy;
        if (f.vy < 0) f.grounded = false;
        sx = sy = true;
        emit(ev, { t: 'jump', f: st.frame, i, x: f.x, y: f.y, air: true });
      } else if (fr > 9) {
        f.vx = Math.trunc((f.vx * 88) / 100);
        f.vy = Math.trunc((f.vy * 80) / 100);
        sx = sy = true;
      }
      break;
    }
    case 'fastfall': {
      f.vy = def.fastFall;
      f.vx = Math.trunc((f.vx * 90) / 100);
      sx = sy = true;
      break;
    }
    case 'hover': {
      const speed = px(sp.speed ?? 2.5);
      const [vx, vy] = len2(dx, dy) > 0 ? withLength(dx, dy, Math.trunc((speed * Math.min(100, len2(dx, dy))) / 100)) : [0, 0];
      f.vx = vx;
      f.vy = vy;
      sx = sy = true;
      break;
    }
    case 'teleport': {
      const at = sp.at ?? 8;
      if (fr === (m.hide ? m.hide[0] : 0)) emit(ev, { t: 'vanish', f: st.frame, i, x: f.x, y: f.y });
      if (fr === at) {
        let tx: number;
        let ty: number;
        if (sp.behind) {
          const o = st.fighters[1 - i];
          const side = sign(o.x - mv.ox) || fc;
          tx = o.x + side * px(sp.dist ?? 60);
          ty = 0;
        } else if (m.param?.dir?.kind === 'side') {
          tx = mv.ox + (sign(dx) || fc) * px(mv.amt);
          ty = f.y;
        } else {
          const mag = Math.min(100, len2(dx, dy));
          const [ox, oy] = withLength(dx, dy, Math.trunc((px(sp.dist ?? 200) * mag) / 100));
          tx = mv.ox + ox;
          ty = mv.oy + oy;
        }
        const lim = px(ctx.stage.halfWidth - def.width);
        f.x = clamp(tx, -lim, lim);
        f.y = clamp(ty, -px(ctx.stage.ceiling - def.height), 0);
        f.grounded = f.y >= 0;
        f.vx = 0;
        f.vy = 0;
        sx = sy = true;
        if (sp.behind) faceOpponent(st, i);
        emit(ev, { t: 'appear', f: st.frame, i, x: f.x, y: f.y });
      }
      if (fr < at && m.hide && fr >= m.hide[0]) {
        f.vx = 0;
        f.vy = 0;
        sx = sy = true;
      }
      break;
    }
    case 'detonate': {
      if (fr === (sp.at ?? 4) && m.needsProj) {
        for (const p of st.projs) {
          if (p.dead || p.owner !== i || p.kind !== m.needsProj) continue;
          killProjectile(st, p, ctx, ev, true);
        }
      }
      break;
    }
    case 'dive': {
      if (fr >= (sp.start ?? 6)) {
        const [vx, vy] = withLength(dx, Math.max(dy, 20), px(sp.speed ?? 14));
        f.vx = vx;
        f.vy = vy;
        sx = sy = true;
      } else {
        f.vx = Math.trunc((f.vx * 70) / 100);
        f.vy = Math.min(f.vy, 0);
        sx = sy = true;
      }
      break;
    }
    case 'leap': {
      if (fr === (sp.at ?? 6)) {
        const mag = clamp(abs(dy), 30, 100);
        f.vy = -Math.trunc((px(sp.jump ?? 14) * (50 + Math.trunc((50 * mag) / 100))) / 100);
        f.vx = Math.trunc((px(sp.air ?? 7) * clamp(dx, -100, 100)) / 100);
        f.grounded = false;
        f.y -= 1;
        sx = sy = true;
        emit(ev, { t: 'jump', f: st.frame, i, x: f.x, y: f.y, air: false });
      }
      break;
    }
    case 'roll': {
      if (fr >= (sp.from ?? 2) && fr <= (sp.to ?? 14)) {
        f.vx = (sign(dx) || fc) * px(sp.speed ?? 9);
        sx = true;
      }
      break;
    }
    case 'burst': {
      if (fr === 0) {
        f.vx = 0;
        f.vy = 0;
        sx = sy = true;
      }
      break;
    }
  }

  // Projectiles.
  for (const s of m.spawns ?? []) {
    if (s.f !== fr) continue;
    spawnProjectile(st, i, ctx, s.proj, f.x + px(s.x) * fc, f.y + px(s.y), s, mv.dir, ev);
  }

  // Throws carry the victim.
  if (m.throw && mv.victim >= 0) {
    const v = st.fighters[mv.victim];
    const t = m.throw;
    const back = sign(mv.dir[0]) !== 0 && sign(mv.dir[0]) !== fc;
    if (fr <= t.release) {
      const [hx, hy] = holdAt(t.hold, fr);
      const xo = back ? lerpI(hx, -hx, fr, Math.max(1, t.release)) : hx;
      v.x = f.x + px(xo) * fc;
      v.y = Math.min(0, f.y + px(hy));
      v.grounded = v.y >= 0;
      v.vx = 0;
      v.vy = 0;
      v.facing = (back && fr * 2 > t.release ? fc : -fc) as 1 | -1;
    }
    if (fr === t.release) {
      const lim = px(ctx.stage.halfWidth - charOf(ctx, v).width);
      v.x = clamp(v.x, -lim, lim);
      v.mode = 'idle';
      applyHit(st, i, mv.victim, t.hit, back ? -fc : fc, 0, v.x, v.y - px(40), ctx, ev, 'throw', null);
      mv.victim = -1;
      f.stats.throws++;
    }
  }
  return [sx, sy];
}

function holdAt(hold: [number, number, number][], fr: number): [number, number] {
  if (fr <= hold[0][0]) return [hold[0][1], hold[0][2]];
  for (let k = 0; k < hold.length - 1; k++) {
    const a = hold[k];
    const b = hold[k + 1];
    if (fr <= b[0]) {
      const span = Math.max(1, b[0] - a[0]);
      return [a[1] + ((b[1] - a[1]) * (fr - a[0])) / span, a[2] + ((b[2] - a[2]) * (fr - a[0])) / span];
    }
  }
  const z = hold[hold.length - 1];
  return [z[1], z[2]];
}

function physics(st: GameState, i: number, ctx: SimCtx, ev: Ev, set: [boolean, boolean]) {
  const f = st.fighters[i];
  if (f.mode === 'grabbed') return;
  const def = charOf(ctx, f);
  const m = moveDef(ctx, f);
  const fr = f.move?.frame ?? 0;
  const floating = !!(m?.float && fr >= m.float[0] && fr <= m.float[1]);

  if (!f.grounded && !set[1] && !floating) {
    let g = def.gravity;
    if (f.mode === 'ko') g = Math.trunc((g * 80) / 100);
    f.vy += g;
    if (f.vy > def.maxFall) f.vy = def.maxFall;
  }

  if (!set[0]) {
    if (f.grounded) {
      const fr2 = f.mode === 'hitstun' || f.mode === 'blockstun' || f.mode === 'kd' ? STUN_FRICTION : GROUND_FRICTION;
      f.vx -= sign(f.vx) * Math.min(abs(f.vx), fr2);
    } else if (!floating) {
      f.vx -= sign(f.vx) * Math.min(abs(f.vx), AIR_DRAG);
    }
  }

  f.x += f.vx;
  f.y += f.vy;

  // Floor.
  if (f.y >= 0) {
    const wasAir = !f.grounded;
    const vy = f.vy;
    f.y = 0;
    if (wasAir) land(st, i, ctx, ev, vy);
    else f.vy = 0;
  } else {
    f.grounded = false;
  }

  // Ceiling.
  const top = -px(ctx.stage.ceiling);
  if (f.y - px(def.height) < top) {
    f.y = top + px(def.height);
    if (f.vy < 0) f.vy = f.mode === 'hitstun' || f.mode === 'ko' ? -Math.trunc((f.vy * 40) / 100) : 0;
  }

  // Walls.
  const lim = px(ctx.stage.halfWidth - def.width);
  if (f.x < -lim || f.x > lim) {
    const side = f.x < 0 ? -1 : 1;
    f.x = side * lim;
    const into = sign(f.vx) === side;
    if (into) {
      if ((f.mode === 'hitstun' && (f.wb || abs(f.vx) > px(13)) && !f.wallUsed) || f.mode === 'ko') {
        f.vx = -Math.trunc((f.vx * (f.wb ? 55 : 30)) / 100);
        if (f.mode === 'hitstun') {
          f.vy = Math.min(f.vy, -px(f.wb ? 6 : 3));
          f.grounded = false;
          f.stun += f.wb ? 8 : 2;
          f.wallUsed = true;
        }
        f.wb = false;
        emit(ev, { t: 'wall', f: st.frame, i, x: f.x, y: f.y - px(def.height / 2) });
      } else {
        f.vx = 0;
      }
    }
  }
}

function land(st: GameState, i: number, ctx: SimCtx, ev: Ev, vy: number) {
  const f = st.fighters[i];
  const def = charOf(ctx, f);
  f.airJumps = def.airJumps;
  f.airDashes = def.airDashes;
  switch (f.mode) {
    case 'hitstun': {
      if (f.gb) {
        f.gb = false;
        f.vy = -Math.max(Math.trunc((abs(vy) * 55) / 100), px(7));
        f.y = -1;
        f.grounded = false;
        f.stun += 6;
        emit(ev, { t: 'bounce', f: st.frame, i, x: f.x, y: 0 });
        return;
      }
      f.grounded = true;
      f.vy = 0;
      f.vx = Math.trunc(f.vx / 3);
      f.mode = 'kd';
      f.stun = KD_FRAMES;
      f.move = null;
      emit(ev, { t: 'land', f: st.frame, i, x: f.x, hard: true });
      return;
    }
    case 'ko': {
      if (vy > px(4)) {
        f.vy = -Math.trunc((vy * 35) / 100);
        f.y = -1;
        f.grounded = false;
        f.vx = Math.trunc((f.vx * 70) / 100);
        emit(ev, { t: 'land', f: st.frame, i, x: f.x, hard: true });
      } else {
        f.vy = 0;
        f.grounded = true;
      }
      return;
    }
    case 'move': {
      f.grounded = true;
      f.vy = 0;
      const m = moveDef(ctx, f);
      if (!m) return;
      emit(ev, { t: 'land', f: st.frame, i, x: f.x, hard: false });
      if (m.landSpawn) spawnProjectile(st, i, ctx, m.landSpawn, f.x, 0, null, [f.facing * 100, 0], ev);
      const mode = m.land ?? (m.where === 'air' ? 'lag' : 'keep');
      if (mode === 'end') endMove(st, i);
      else if (mode === 'lag') startLanding(st, i, m.landLag ?? 6, ctx);
      return;
    }
    default: {
      f.grounded = true;
      f.vy = 0;
      if (f.mode === 'idle') emit(ev, { t: 'land', f: st.frame, i, x: f.x, hard: vy > px(9) });
    }
  }
}

/** Push-boxes: standing fighters can't walk through each other. */
function separate(st: GameState, ctx: SimCtx) {
  const [a, b] = st.fighters;
  const solid = (f: Fighter) =>
    f.mode !== 'grabbed' && f.mode !== 'kd' && f.mode !== 'down' && f.mode !== 'ko' && !isHidden(ctx, f);
  if (!solid(a) || !solid(b)) return;
  const da = charOf(ctx, a);
  const db = charOf(ctx, b);
  const hmin = Math.min(px(da.height), px(db.height));
  if (abs(a.y - b.y) > Math.trunc((hmin * 60) / 100)) return;
  const reach = px(da.width) + px(db.width);
  const gap = b.x - a.x;
  if (abs(gap) >= reach) return;
  let dir = sign(gap);
  if (dir === 0) dir = a.facing === 1 ? 1 : -1;
  const overlap = reach - abs(gap);
  const la = px(ctx.stage.halfWidth - da.width);
  const lb = px(ctx.stage.halfWidth - db.width);
  let pa = Math.trunc(overlap / 2);
  let pb = overlap - pa;
  // Whoever is pinned against a wall doesn't move; the other takes it all.
  const ta = clamp(a.x - dir * pa, -la, la);
  const tb = clamp(b.x + dir * pb, -lb, lb);
  const lostA = abs(ta - (a.x - dir * pa));
  const lostB = abs(tb - (b.x + dir * pb));
  a.x = clamp(ta - dir * lostB, -la, la);
  b.x = clamp(tb + dir * lostA, -lb, lb);
}

function isHidden(ctx: SimCtx, f: Fighter): boolean {
  const m = moveDef(ctx, f);
  if (!m?.hide || !f.move) return false;
  return f.move.frame >= m.hide[0] && f.move.frame <= m.hide[1];
}

// ------------------------------------------------------------ projectiles --

function projDef(ctx: SimCtx, st: GameState, p: Projectile): ProjectileDef {
  return ctx.chars[st.fighters[p.owner].char].projectiles[p.kind];
}

export function spawnProjectile(
  st: GameState,
  i: number,
  ctx: SimCtx,
  kind: string,
  x: number,
  y: number,
  s: { speed?: number; aim?: boolean; v?: [number, number] } | null,
  dir: [number, number],
  ev: Ev,
) {
  const f = st.fighters[i];
  const pd = charOf(ctx, f).projectiles[kind];
  if (!pd) return;
  let vx = 0;
  let vy = 0;
  if (s?.aim) {
    [vx, vy] = withLength(dir[0] || f.facing, dir[1], px(s.speed ?? 10));
  } else if (s?.v) {
    vx = px(s.v[0]) * f.facing;
    vy = px(s.v[1]);
  } else if (s?.speed) {
    vx = px(s.speed) * f.facing;
  } else if (pd.drift) {
    const mag = Math.min(100, len2(dir[0], dir[1]));
    [vx, vy] = len2(dir[0], dir[1]) > 0 ? withLength(dir[0], dir[1], Math.trunc((px(pd.drift) * mag) / 100)) : [0, 0];
  }
  st.projs.push({
    id: st.nextId++,
    owner: i,
    kind,
    x,
    y: Math.min(y, 0),
    vx,
    vy,
    age: 0,
    hits: 0,
    last: -9999,
    facing: (sign(vx) || f.facing) as 1 | -1,
    dead: false,
  });
  emit(ev, { t: 'spawn', f: st.frame, i, kind, x, y });
}

function killProjectile(st: GameState, p: Projectile, ctx: SimCtx, ev: Ev, burst: boolean) {
  if (p.dead) return;
  p.dead = true;
  const pd = projDef(ctx, st, p);
  emit(ev, { t: 'pop', f: st.frame, kind: p.kind, x: p.x, y: p.y });
  if (burst && pd.burstInto) {
    spawnProjectile(st, p.owner, ctx, pd.burstInto, p.x, p.y, null, [0, 0], ev);
  }
}

function updateProjectiles(st: GameState, ctx: SimCtx, ev: Ev) {
  const hw = px(ctx.stage.halfWidth);
  for (const p of st.projs) {
    if (p.dead) continue;
    const pd = projDef(ctx, st, p);
    p.age++;
    if (pd.gravity) p.vy += px(pd.gravity);
    if (pd.pull && p.age <= pd.pull.until && !st.ko) {
      const v = st.fighters[1 - p.owner];
      if (v.mode !== 'grabbed' && v.mode !== 'kd' && v.mode !== 'down' && v.mode !== 'ko') {
        const vd = charOf(ctx, v);
        const cx = v.x;
        const cy = v.y - px(vd.height / 2);
        const ddx = p.x - cx;
        const ddy = p.y - cy;
        const d = len2(ddx, ddy);
        if (d > 0 && d < px(pd.pull.radius)) {
          const step = Math.min(d, px(pd.pull.speed));
          v.x += Math.trunc((ddx * step) / d);
          if (!v.grounded) v.y = Math.min(0, v.y + Math.trunc((ddy * step) / d));
          const lim = px(ctx.stage.halfWidth - vd.width);
          v.x = clamp(v.x, -lim, lim);
        }
      }
    }
    p.x += p.vx;
    p.y += p.vy;
    if (p.age >= pd.life) {
      killProjectile(st, p, ctx, ev, true);
      continue;
    }
    if (p.x < -hw || p.x > hw) {
      if (pd.wallStop !== false) {
        p.x = clamp(p.x, -hw, hw);
        killProjectile(st, p, ctx, ev, true);
        continue;
      }
      p.x = clamp(p.x, -hw, hw);
      p.vx = 0;
    }
    if (p.y >= 0 && p.vy >= 0 && p.age > 1) {
      if (pd.floorStop !== false && p.vy > 0) {
        p.y = 0;
        killProjectile(st, p, ctx, ev, true);
        continue;
      }
      p.y = 0;
      p.vy = 0;
    }
  }
  // Clashes between opposing projectiles.
  for (let a = 0; a < st.projs.length; a++) {
    const p = st.projs[a];
    if (p.dead) continue;
    const pa = projDef(ctx, st, p);
    if (!pa.clash) continue;
    for (let b = a + 1; b < st.projs.length; b++) {
      const q = st.projs[b];
      if (q.dead || q.owner === p.owner) continue;
      const pb = projDef(ctx, st, q);
      if (!pb.clash) continue;
      const rr = px(pa.r + pb.r);
      const ddx = p.x - q.x;
      const ddy = p.y - q.y;
      if (ddx * ddx + ddy * ddy <= rr * rr) {
        killProjectile(st, p, ctx, ev, false);
        killProjectile(st, q, ctx, ev, false);
        break;
      }
    }
  }
  st.projs = st.projs.filter((p) => !p.dead);
}

// ------------------------------------------------------------ hits --

interface Pending {
  a: number;
  v: number;
  hb: HitDef;
  kind: 'strike' | 'grab';
  proj: Projectile | null;
  pd: ProjectileDef | null;
  box: HitboxDef | null;
  cx: number;
  cy: number;
  kbx: number;
  kby: number;
  group: number;
}

function hurtbox(ctx: SimCtx, f: Fighter): [number, number, number, number] {
  const def = charOf(ctx, f);
  let w = px(def.width);
  let h = px(def.height);
  if (f.mode === 'kd' || f.mode === 'down') {
    h = px(30);
    w = px(Math.round(def.height * 0.48));
  } else {
    const m = moveDef(ctx, f);
    if (m?.low && f.move && f.move.frame >= m.low[0] && f.move.frame <= m.low[1]) h = Math.trunc((h * 62) / 100);
    else if (!f.grounded && (f.mode === 'hitstun' || f.mode === 'ko')) h = Math.trunc((h * 80) / 100);
  }
  return [f.x - w, f.y - h, f.x + w, f.y];
}

function circleHits(cx: number, cy: number, r: number, box: [number, number, number, number]): boolean {
  const nx = clamp(cx, box[0], box[2]);
  const ny = clamp(cy, box[1], box[3]);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

type Vuln = 'strike' | 'proj' | 'grab';

function invulnerable(ctx: SimCtx, v: Fighter, type: Vuln, otg: boolean): boolean {
  if (v.mode === 'grabbed' || v.mode === 'ko') return true;
  if (v.mode === 'kd' || v.mode === 'down') return !otg || type === 'grab';
  if (v.invuln > 0) return true;
  if (isHidden(ctx, v)) return true;
  if (v.move && v.move.victim >= 0) return true; // mid-throw
  const m = moveDef(ctx, v);
  if (m?.invuln && v.move) {
    const fr = v.move.frame;
    for (const w of m.invuln) {
      if (fr < w.f0 || fr > w.f1) continue;
      if (w.vs === 'all' || w.vs === type) return true;
    }
  }
  return false;
}

function detectHits(st: GameState, ctx: SimCtx, ev: Ev, frozen: boolean[]): [boolean, boolean] {
  const pending: Pending[] = [];
  const F = st.fighters;

  // Fighter hitboxes.
  for (let a = 0; a < 2; a++) {
    const f = F[a];
    if (frozen[a] || f.mode !== 'move' || !f.move) continue;
    const m = moveDef(ctx, f);
    if (!m?.hitboxes) continue;
    const mv = f.move;
    const fr = mv.frame;
    const v = 1 - a;
    const victim = F[v];
    const box = hurtbox(ctx, victim);
    const seen = new Set<number>();
    for (const hb of m.hitboxes) {
      if (fr < hb.f0 || fr > hb.f1) continue;
      const g = hb.group ?? 0;
      if (seen.has(g)) continue;
      const max = hb.maxHits ?? 1;
      if (mv.hits[g] >= max) continue;
      if (mv.hits[g] > 0 && (!hb.rehit || fr - mv.last[g] < hb.rehit)) continue;
      let cx: number;
      let cy: number;
      let kbx: number;
      let kby: number;
      if (hb.aimed) {
        const [ux, uy] = withLength(mv.dir[0] || f.facing, mv.dir[1], 1000);
        cx = f.x + Math.trunc((ux * px(hb.x)) / 1000);
        cy = f.y + px(hb.y) + Math.trunc((uy * px(hb.x)) / 1000);
        const mag = len2(px(hb.kb[0]), px(hb.kb[1]));
        kbx = Math.trunc((ux * mag) / 1000);
        kby = Math.trunc((uy * mag) / 1000) + px(Math.min(0, hb.kb[1]) / 2);
      } else {
        cx = f.x + px(hb.x) * f.facing;
        cy = f.y + px(hb.y);
        kbx = px(hb.kb[0]) * f.facing;
        kby = px(hb.kb[1]);
      }
      if (hb.radial) kbx = abs(kbx) * (victim.x >= f.x ? 1 : -1);
      if (hb.groundOnly && !victim.grounded) continue;
      if (!circleHits(cx, cy, px(hb.r), box)) continue;
      const kind = hb.kind ?? 'strike';
      if (invulnerable(ctx, victim, kind === 'grab' ? 'grab' : 'strike', !!hb.otg)) continue;
      if (kind === 'grab') {
        if (!victim.grounded && !hb.air) continue;
        if (victim.mode !== 'idle' && victim.mode !== 'move') continue;
      }
      seen.add(g);
      pending.push({ a, v, hb, kind, proj: null, pd: null, box: hb, cx, cy, kbx, kby, group: g });
      break; // one hitbox per attacker per frame
    }
  }

  // Projectile hitboxes.
  for (const p of st.projs) {
    if (p.dead) continue;
    const pd = projDef(ctx, st, p);
    if (!pd.hit) continue;
    if (pd.activeFrom !== undefined && p.age < pd.activeFrom) continue;
    if (pd.activeTo !== undefined && p.age > pd.activeTo) continue;
    if (p.hits >= (pd.maxHits ?? 1)) continue;
    if (p.hits > 0 && (!pd.rehit || st.frame - p.last < pd.rehit)) continue;
    const v = 1 - p.owner;
    const victim = F[v];
    if (invulnerable(ctx, victim, 'proj', !!pd.hit.otg)) continue;
    if (pd.hit.groundOnly && !victim.grounded) continue;
    if (!circleHits(p.x, p.y, px(pd.r), hurtbox(ctx, victim))) continue;
    let dirX: number = p.facing;
    if (pd.hit.radial) dirX = victim.x >= p.x ? 1 : -1;
    pending.push({
      a: p.owner,
      v,
      hb: pd.hit,
      kind: 'strike',
      proj: p,
      pd,
      box: null,
      cx: p.x,
      cy: p.y,
      kbx: px(pd.hit.kb[0]) * dirX,
      kby: px(pd.hit.kb[1]),
      group: 0,
    });
  }

  const struck: [boolean, boolean] = [false, false];
  if (pending.length === 0) return struck;

  // Strikes beat grabs on the same frame; two grabs at once is a tech.
  const strikesOn = [false, false];
  for (const h of pending) if (h.kind === 'strike') strikesOn[h.v] = true;
  const grabs = pending.filter((h) => h.kind === 'grab' && !strikesOn[h.a]);
  if (grabs.length === 2) {
    throwTech(st, ctx, ev);
    return [true, true];
  }

  for (const h of pending) {
    if (h.kind === 'grab') {
      if (strikesOn[h.a]) continue;
      if (F[h.a].mode !== 'move') continue;
      startThrow(st, h, ctx, ev);
      struck[h.v] = true;
      continue;
    }
    resolveStrike(st, h, ctx, ev);
    struck[h.v] = true;
  }
  return struck;
}

function throwTech(st: GameState, ctx: SimCtx, ev: Ev) {
  const [a, b] = st.fighters;
  const dir = sign(b.x - a.x) || 1;
  for (const [f, s] of [
    [a, -dir],
    [b, dir],
  ] as [Fighter, number][]) {
    f.move = null;
    f.mode = 'blockstun';
    f.stun = 16;
    f.vx = s * px(7);
    f.hitlag = 6;
  }
  emit(ev, {
    t: 'hit',
    f: st.frame,
    kind: 'tech',
    a: 0,
    v: 1,
    x: (a.x + b.x) >> 1,
    y: -px(60),
    dmg: 0,
    power: 30,
    fx: 'throw',
    combo: 0,
  });
}

function startThrow(st: GameState, h: Pending, ctx: SimCtx, ev: Ev) {
  const f = st.fighters[h.a];
  const v = st.fighters[h.v];
  const grab = h.box!;
  const dir = f.move!.dir;
  if (!grab.throwMove) return;
  const tm = charOf(ctx, f).moves[grab.throwMove];
  if (!tm) return;
  f.move = null;
  f.mode = 'idle';
  startMove(st, h.a, { move: grab.throwMove, dir }, ctx, null);
  f.move!.victim = h.v;
  if (v.move && v.move.victim >= 0) releaseVictim(st, v.move.victim);
  v.mode = 'grabbed';
  v.move = null;
  v.stun = 0;
  v.vx = 0;
  v.vy = 0;
  v.comboHits = 0;
  v.comboDmg = 0;
  emit(ev, { t: 'hit', f: st.frame, kind: 'grab', a: h.a, v: h.v, x: h.cx, y: h.cy, dmg: 0, power: 30, fx: 'throw', combo: 0 });
}

function resolveStrike(st: GameState, h: Pending, ctx: SimCtx, ev: Ev) {
  const F = st.fighters;
  const v = F[h.v];
  const a = F[h.a];
  const vm = moveDef(ctx, v);
  const vfr = v.move?.frame ?? 0;
  const hb = h.hb;

  const registerHit = (blocked: boolean) => {
    if (h.proj) {
      h.proj.hits++;
      h.proj.last = st.frame;
      if (h.proj.hits >= (h.pd!.maxHits ?? 1)) killProjectile(st, h.proj, ctx, ev, !!h.pd!.burstOnHit);
    } else if (a.move) {
      a.move.hits[h.group]++;
      a.move.last[h.group] = a.move.frame;
      if (blocked) a.move.blocked = true;
      else a.move.hit = true;
    }
  };

  // Parry: a perfectly timed read.
  if (vm?.parry && v.move && vfr >= v.move.amt && vfr < v.move.amt + PARRY_WINDOW && !hb.unblockable) {
    v.move = null;
    v.mode = 'idle';
    v.hitlag = 10;
    v.meter = Math.min(METER_MAX, v.meter + 150);
    v.stats.parries++;
    if (h.proj) {
      killProjectile(st, h.proj, ctx, ev, false);
    } else {
      if (a.move && a.move.victim >= 0) releaseVictim(st, a.move.victim);
      a.move = null;
      a.mode = 'parried';
      a.stun = PARRY_STUN;
      a.vx = 0;
      a.hitlag = 10;
    }
    emit(ev, { t: 'hit', f: st.frame, kind: 'parry', a: h.a, v: h.v, x: h.cx, y: h.cy, dmg: 0, power: 60, fx: 'zap', combo: 0 });
    return;
  }

  const blocking = (vm?.block && v.mode === 'move') || v.mode === 'blockstun';
  if (blocking && !hb.unblockable) {
    const chip = Math.trunc((hb.dmg * (hb.chip ?? 0)) / 100);
    v.hp -= chip;
    v.move = null;
    v.mode = 'blockstun';
    v.stun = hb.blockstun ?? Math.trunc((hb.hitstun * 2) / 3);
    const pushDir = sign(h.kbx) || (v.x >= a.x ? 1 : -1);
    const push = clamp(Math.trunc((abs(h.kbx) * 60) / 100), px(3), px(9));
    v.vx = pushDir * push;
    v.facing = (pushDir === 1 ? -1 : 1) as 1 | -1;
    const lim = px(ctx.stage.halfWidth - charOf(ctx, v).width);
    if (!h.proj && abs(v.x) >= lim - px(4) && sign(v.x) === pushDir && a.grounded) {
      a.vx = -pushDir * Math.trunc((push * 80) / 100);
    }
    const lag = Math.max(3, Math.trunc((hitlagOf(hb) * 70) / 100));
    v.hitlag = lag;
    if (!h.proj) a.hitlag = lag;
    v.meter = Math.min(METER_MAX, v.meter + 25);
    a.meter = Math.min(METER_MAX, a.meter + Math.trunc(hb.dmg / 2));
    v.stats.blocks++;
    registerHit(true);
    emit(ev, { t: 'hit', f: st.frame, kind: 'block', a: h.a, v: h.v, x: h.cx, y: h.cy, dmg: chip, power: Math.min(100, hb.dmg), fx: hb.fx ?? 'medium', combo: 0 });
    if (v.hp <= 0) knockOut(st, h.v, h.kbx, h.kby, ctx, ev);
    return;
  }

  if (vm?.armor && v.move && v.move.armor > 0 && vfr >= vm.armor[0] && vfr <= vm.armor[1]) {
    v.move.armor--;
    const dmg = Math.max(1, Math.trunc(hb.dmg / 2));
    v.hp -= dmg;
    const lag = hitlagOf(hb);
    v.hitlag = lag;
    if (!h.proj) a.hitlag = lag;
    a.meter = Math.min(METER_MAX, a.meter + Math.trunc(dmg / 2));
    registerHit(false);
    emit(ev, { t: 'hit', f: st.frame, kind: 'armor', a: h.a, v: h.v, x: h.cx, y: h.cy, dmg, power: Math.min(100, hb.dmg), fx: hb.fx ?? 'heavy', combo: 0 });
    if (v.hp <= 0) knockOut(st, h.v, h.kbx, h.kby, ctx, ev);
    return;
  }

  // Clean hit.
  const dirX = sign(h.kbx) || (v.x >= a.x ? 1 : -1);
  applyHit(st, h.a, h.v, hb, dirX, h.proj ? 1 : 0, h.cx, h.cy, ctx, ev, null, h, registerHit);
}

function hitlagOf(hb: HitDef): number {
  return hb.hitlag ?? clamp(4 + Math.trunc(hb.dmg / 14), 5, 13);
}

/**
 * Damage + hitstun + knockback on v from a. Used by strikes, projectiles and
 * throws. `dirX` is the knockback's horizontal sign.
 */
function applyHit(
  st: GameState,
  ai: number,
  vi: number,
  hb: HitDef,
  dirX: number,
  isProj: number,
  cx: number,
  cy: number,
  ctx: SimCtx,
  ev: Ev,
  forced: HitKind | null,
  pending: Pending | null = null,
  register: ((b: boolean) => void) | null = null,
) {
  const F = st.fighters;
  const a = F[ai];
  const v = F[vi];
  const vdef = charOf(ctx, v);
  const vm = moveDef(ctx, v);
  const otg = v.mode === 'kd' || v.mode === 'down';
  const n = v.comboHits;
  const counter =
    !forced &&
    !otg &&
    n === 0 &&
    v.mode === 'move' &&
    !!vm &&
    !!v.move &&
    !!(vm.hitboxes?.length || vm.spawns?.length) &&
    v.move.frame <= lastActive(vm);

  let pct = n === 0 ? 100 : Math.max(30, 100 - 10 * n);
  if (counter) pct = Math.trunc((pct * 120) / 100);
  if (otg) pct = Math.trunc(pct / 2);
  const dmg = Math.max(1, Math.trunc((hb.dmg * pct) / 100));

  let stun = hb.hitstun;
  if (n > 2) stun = Math.max(Math.trunc((hb.hitstun * 40) / 100), hb.hitstun - 2 * (n - 2));
  if (counter) stun += 6;

  let kx = pending ? pending.kbx : px(hb.kb[0]) * dirX;
  let ky = pending ? pending.kby : px(hb.kb[1]);
  kx = Math.trunc((kx * vdef.kbMul) / 100);
  ky = Math.trunc((ky * vdef.kbMul) / 100);
  if (counter) {
    kx = Math.trunc((kx * 112) / 100);
    ky = Math.trunc((ky * 112) / 100);
  }
  if (n > 0 && (v.di[0] !== 0 || v.di[1] !== 0)) {
    const mag = len2(kx, ky);
    if (mag > 0) {
      const nx = kx + Math.trunc((v.di[0] * mag * DI_PCT) / 10000);
      const ny = ky + Math.trunc((v.di[1] * mag * DI_PCT) / 10000);
      [kx, ky] = withLength(nx, ny, mag);
    }
  }

  if (v.move && v.move.victim >= 0) releaseVictim(st, v.move.victim);
  v.hp -= dmg;
  v.move = null;
  v.mode = 'hitstun';
  v.stun = stun;
  v.facing = (dirX === 1 ? -1 : 1) as 1 | -1;
  v.gb = !!hb.groundBounce;
  v.wb = !!hb.wallBounce;
  if (otg) {
    v.comboOtg = true;
    v.vx = Math.trunc(kx / 2);
    v.vy = -px(6);
    v.grounded = false;
    v.y = Math.min(v.y, -1);
  } else if (v.grounded && ky >= 0 && !hb.knockdown) {
    v.vx = kx;
    v.vy = 0;
  } else {
    v.vx = kx;
    v.vy = hb.knockdown ? Math.min(ky, -px(4)) : ky;
    if (v.vy < 0) {
      v.grounded = false;
      v.y = Math.min(v.y, -1);
    }
  }

  let lag = hitlagOf(hb);
  if (counter) lag += 3;
  v.hitlag = lag;
  if (!isProj) a.hitlag = lag;

  // Pinned against a wall: the attacker takes the push instead.
  const lim = px(ctx.stage.halfWidth - vdef.width);
  if (!isProj && v.grounded && abs(v.x) >= lim - px(4) && sign(v.x) === dirX && a.grounded && !forced) {
    a.vx = -dirX * Math.min(abs(kx), px(6));
  }

  a.meter = Math.min(METER_MAX, a.meter + dmg);
  v.meter = Math.min(METER_MAX, v.meter + Math.trunc(dmg / 2));
  v.burst = Math.min(BURST_MAX, v.burst + Math.trunc(dmg / 2));
  v.comboHits++;
  v.comboDmg += dmg;
  a.stats.dealt += dmg;
  a.stats.hits++;
  if (v.comboHits > a.stats.bestCombo) a.stats.bestCombo = v.comboHits;
  if (v.comboDmg > a.stats.bestComboDmg) a.stats.bestComboDmg = v.comboDmg;
  if (register) register(false);

  const kind: HitKind = forced ?? (otg ? 'otg' : counter ? 'counter' : 'hit');
  emit(ev, {
    t: 'hit',
    f: st.frame,
    kind,
    a: ai,
    v: vi,
    x: cx,
    y: cy,
    dmg,
    power: Math.min(100, Math.trunc((hb.dmg * 100) / 140)),
    fx: hb.fx ?? (hb.dmg >= 90 ? 'heavy' : hb.dmg >= 50 ? 'medium' : 'light'),
    combo: v.comboHits,
  });
  if (v.hp <= 0) knockOut(st, vi, kx, ky, ctx, ev);
}

function knockOut(st: GameState, vi: number, kx: number, ky: number, ctx: SimCtx, ev: Ev) {
  const v = st.fighters[vi];
  v.hp = 0;
  v.mode = 'ko';
  v.move = null;
  v.stun = 0;
  const dir = sign(kx) || -v.facing;
  v.vx = dir * Math.max(abs(Math.trunc((kx * 140) / 100)), px(8));
  v.vy = Math.min(Math.trunc((ky * 140) / 100), -px(10));
  v.grounded = false;
  v.y = Math.min(v.y, -1);
  v.hitlag = Math.max(v.hitlag, 22);
  const o = st.fighters[1 - vi];
  o.hitlag = Math.max(o.hitlag, 22);
  emit(ev, { t: 'ko', f: st.frame, v: vi, x: v.x, y: v.y - px(charOf(ctx, v).height / 2) });
}

// ------------------------------------------------------------ counters --

function advance(st: GameState, i: number, ctx: SimCtx, ev: Ev) {
  const f = st.fighters[i];
  if (f.invuln > 0) f.invuln--;
  switch (f.mode) {
    case 'move': {
      const mv = f.move!;
      const m = moveDef(ctx, f);
      if (m?.bounceOnHit && mv.hit) {
        f.vy = -px(m.sp?.bounce ?? 8);
        f.vx = -f.facing * px(2);
        f.grounded = false;
        endMove(st, i);
        return;
      }
      if (m && !mv.hit && !mv.blocked && m.hitboxes?.length && mv.frame === firstActive(m)) {
        emit(ev, { t: 'whiff', f: st.frame, i, move: mv.id });
      }
      mv.frame++;
      if (mv.frame >= mv.total) endMove(st, i);
      return;
    }
    case 'hitstun':
    case 'blockstun':
    case 'parried': {
      f.stun--;
      if (f.stun <= 0) {
        f.stun = 0;
        f.mode = 'idle';
        resetCombo(f);
      }
      return;
    }
    case 'kd': {
      f.stun--;
      if (f.stun <= 0) {
        f.stun = 0;
        f.mode = 'down';
        resetCombo(f);
      }
      return;
    }
  }
}

function resetCombo(f: Fighter) {
  f.comboHits = 0;
  f.comboDmg = 0;
  f.comboOtg = false;
  f.di = [0, 0];
  f.gb = false;
  f.wb = false;
  f.wallUsed = false;
}

export { isqrt };
