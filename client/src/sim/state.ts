/** GameState construction, rounds, cloning, hashing and snapshots. */

import { px } from './fixed';
import type {
  CharacterDef,
  Fighter,
  FighterSnap,
  GameState,
  MatchConfig,
  SimCtx,
  Snapshot,
} from './types';

/** Distance from centre each fighter starts a round at, px. */
export const START_X = 230;
/** Frames the round keeps running after a KO, for the knock-out flight. */
export const KO_TAIL = 84;
export const METER_BAR = 1000;
export const METER_MAX = 3000;
export const BURST_MAX = 1000;

/** Max fighters in a family. */
export const MAX_FAMILY = 3;
/** Share of lost health a bout winner gets back before the next bout. */
export const BOUT_HEAL_PCT = 20;
/** Family Feud fighters start at this share of their health, so a match of
 *  three bouts each runs about as long as a two-round duel. */
export const FEUD_HP_PCT = 60;

/** A fighter's full health in this match. */
export function maxHp(cfg: MatchConfig, def: CharacterDef): number {
  return isFeud(cfg) ? Math.trunc((def.hp * FEUD_HP_PCT) / 100) : def.hp;
}

/** A side's lineup (a single fighter outside Family Feud). */
export function teamOf(cfg: MatchConfig, i: number): string[] {
  const t = cfg.teams?.[i];
  return t && t.length ? t : [cfg.chars[i]];
}

/** Family Feud: lineups and knock-outs instead of rounds. */
export function isFeud(cfg: MatchConfig): boolean {
  return !!cfg.teams && (teamOf(cfg, 0).length > 1 || teamOf(cfg, 1).length > 1);
}

export function newFighter(def: CharacterDef, side: 0 | 1, meter = 0): Fighter {
  return {
    char: def.id,
    x: px(side === 0 ? -START_X : START_X),
    y: 0,
    vx: 0,
    vy: 0,
    facing: side === 0 ? 1 : -1,
    grounded: true,
    hp: def.hp,
    meter,
    burst: BURST_MAX,
    airJumps: def.airJumps,
    airDashes: def.airDashes,
    mode: 'idle',
    move: null,
    stun: 0,
    hitlag: 0,
    invuln: 0,
    di: [0, 0],
    comboHits: 0,
    comboDmg: 0,
    comboOtg: false,
    gb: false,
    wb: false,
    wallUsed: false,
    stats: { dealt: 0, hits: 0, bestCombo: 0, bestComboDmg: 0, parries: 0, blocks: 0, throws: 0, supers: 0 },
  };
}

export function createMatch(cfg: MatchConfig, ctx: SimCtx): GameState {
  const teams = cfg.teams ? ([cfg.teams[0].slice(0, MAX_FAMILY), cfg.teams[1].slice(0, MAX_FAMILY)] as [string[], string[]]) : undefined;
  const lead: [string, string] = [teams?.[0][0] ?? cfg.chars[0], teams?.[1][0] ?? cfg.chars[1]];
  const a = ctx.chars[lead[0]];
  const b = ctx.chars[lead[1]];
  if (!a || !b) throw new Error('unknown character');
  for (const t of teams ?? []) for (const c of t) if (!ctx.chars[c]) throw new Error('unknown character');
  const c: MatchConfig = { ...cfg, chars: lead, palettes: [cfg.palettes[0], cfg.palettes[1]], names: [cfg.names[0], cfg.names[1]] };
  if (teams) c.teams = teams;
  else delete c.teams;
  const f0 = newFighter(a, 0);
  const f1 = newFighter(b, 1);
  f0.hp = maxHp(c, a);
  f1.hp = maxHp(c, b);
  return {
    cfg: c,
    frame: 0,
    step: 0,
    round: 1,
    wins: [0, 0],
    members: [0, 0],
    fighters: [f0, f1],
    projs: [],
    nextId: 1,
    ko: null,
    roundOver: false,
    winner: null,
  };
}

/** After a round ends: start the next one (meter carries over), or settle
 *  the match. Pure: returns a new state. */
export function startNextRound(s: GameState, ctx: SimCtx): GameState {
  const n = cloneState(s);
  if (!n.roundOver || n.winner !== null) return n;
  const stats = [n.fighters[0].stats, n.fighters[1].stats];
  if (isFeud(n.cfg)) {
    // The fallen fighter's next family member steps in fresh; the bout
    // winner stays, keeps its meter and wounds, and catches its breath.
    const next: Fighter[] = [];
    for (const i of [0, 1] as const) {
      const old = n.fighters[i];
      const team = teamOf(n.cfg, i);
      if (old.hp <= 0 || old.mode === 'ko') {
        n.members[i] = Math.min(team.length - 1, n.members[i] + 1);
        const def = ctx.chars[team[n.members[i]]];
        const f = newFighter(def, i, old.meter);
        f.hp = maxHp(n.cfg, def);
        next.push(f);
      } else {
        const def = ctx.chars[old.char];
        const full = maxHp(n.cfg, def);
        const f = newFighter(def, i, old.meter);
        f.hp = Math.min(full, old.hp + Math.trunc(((full - old.hp) * BOUT_HEAL_PCT) / 100));
        next.push(f);
      }
    }
    n.fighters = [next[0], next[1]];
  } else {
    const a = ctx.chars[n.cfg.chars[0]];
    const b = ctx.chars[n.cfg.chars[1]];
    n.fighters = [newFighter(a, 0, n.fighters[0].meter), newFighter(b, 1, n.fighters[1].meter)];
  }
  n.fighters[0].stats = stats[0];
  n.fighters[1].stats = stats[1];
  n.projs = [];
  n.frame = 0;
  n.round++;
  n.ko = null;
  n.roundOver = false;
  return n;
}

export function cloneState(s: GameState): GameState {
  return {
    cfg: s.cfg,
    frame: s.frame,
    step: s.step,
    round: s.round,
    wins: [s.wins[0], s.wins[1]],
    members: [s.members[0], s.members[1]],
    fighters: [cloneFighter(s.fighters[0]), cloneFighter(s.fighters[1])],
    projs: s.projs.map((p) => ({ ...p })),
    nextId: s.nextId,
    ko: s.ko ? { ...s.ko } : null,
    roundOver: s.roundOver,
    winner: s.winner,
  };
}

function cloneFighter(f: Fighter): Fighter {
  return {
    ...f,
    di: [f.di[0], f.di[1]],
    stats: { ...f.stats },
    move: f.move
      ? { ...f.move, dir: [f.move.dir[0], f.move.dir[1]], hits: f.move.hits.slice(), last: f.move.last.slice() }
      : null,
  };
}

const MODES = ['idle', 'move', 'hitstun', 'blockstun', 'parried', 'grabbed', 'kd', 'down', 'ko'];

/** Deterministic hash of every gameplay-relevant integer. Clients compare
 *  these after each decision to prove they are still in lockstep. */
export function hashState(s: GameState): string {
  let h1 = 0x9e3779b1 ^ s.step;
  let h2 = 0x85ebca6b ^ s.frame;
  const push = (n: number) => {
    const v = n | 0;
    h1 = Math.imul(h1 ^ v, 2654435761);
    h2 = Math.imul(h2 ^ v, 1597334677);
    h1 = (h1 << 13) | (h1 >>> 19);
  };
  const str = (t: string) => {
    for (let i = 0; i < t.length; i++) push(t.charCodeAt(i));
    push(t.length);
  };
  push(s.round);
  push(s.wins[0]);
  push(s.wins[1]);
  push(s.members[0]);
  push(s.members[1]);
  push(s.roundOver ? 1 : 0);
  push(s.winner ?? -9);
  push(s.ko ? s.ko.at : -1);
  push(s.ko ? s.ko.winner : -9);
  push(s.nextId);
  for (const f of s.fighters) {
    str(f.char);
    push(f.x); push(f.y); push(f.vx); push(f.vy); push(f.facing); push(f.grounded ? 1 : 0);
    push(f.hp); push(f.meter); push(f.burst); push(f.airJumps); push(f.airDashes);
    push(MODES.indexOf(f.mode)); push(f.stun); push(f.hitlag); push(f.invuln);
    push(f.di[0]); push(f.di[1]); push(f.comboHits); push(f.comboDmg); push(f.comboOtg ? 1 : 0);
    push(f.gb ? 1 : 0); push(f.wb ? 1 : 0); push(f.wallUsed ? 1 : 0);
    if (f.move) {
      const m = f.move;
      str(m.id);
      push(m.frame); push(m.total); push(m.dir[0]); push(m.dir[1]); push(m.amt);
      push(m.feint ? 1 : 0); push(m.hit ? 1 : 0); push(m.blocked ? 1 : 0); push(m.offered ? 1 : 0);
      push(m.armor); push(m.ox); push(m.oy); push(m.victim);
      for (const v of m.hits) push(v);
      for (const v of m.last) push(v);
    } else push(-7);
  }
  push(s.projs.length);
  for (const p of s.projs) {
    push(p.id); push(p.owner); str(p.kind); push(p.x); push(p.y); push(p.vx); push(p.vy);
    push(p.age); push(p.hits); push(p.last); push(p.facing); push(p.dead ? 1 : 0);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

export function snapFighter(f: Fighter, ctx: SimCtx): FighterSnap {
  const m = f.move;
  const def = m ? ctx.chars[f.char].moves[m.id] : undefined;
  const mf = m ? m.frame : 0;
  return {
    char: f.char,
    x: f.x,
    y: f.y,
    vx: f.vx,
    vy: f.vy,
    facing: f.facing,
    grounded: f.grounded,
    hp: f.hp,
    meter: f.meter,
    burst: f.burst,
    mode: f.mode,
    move: m ? m.id : null,
    mf,
    mt: m ? m.total : 0,
    dir: m ? [m.dir[0], m.dir[1]] : [0, 0],
    stun: f.stun,
    hitlag: f.hitlag,
    invuln: f.invuln,
    combo: f.comboHits,
    comboDmg: f.comboDmg,
    di: [f.di[0], f.di[1]],
    hidden: !!(def?.hide && mf >= def.hide[0] && mf <= def.hide[1]),
    blocking: !!def?.block,
    parrying: !!(def?.parry && m && mf >= m.amt && mf <= m.amt + 2),
    armor: !!(def?.armor && m && m.armor > 0 && mf >= def.armor[0] && mf <= def.armor[1]),
    victim: m ? m.victim : -1,
  };
}

export function snapshot(s: GameState, ctx: SimCtx): Snapshot {
  return {
    f: s.frame,
    fighters: [snapFighter(s.fighters[0], ctx), snapFighter(s.fighters[1], ctx)],
    projs: s.projs
      .filter((p) => !p.dead)
      .map((p) => ({ id: p.id, owner: p.owner, kind: p.kind, x: p.x, y: p.y, vx: p.vx, vy: p.vy, age: p.age, facing: p.facing })),
  };
}
