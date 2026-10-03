import { describe, expect, it } from 'vitest';
import { px } from '../src/sim/fixed';
import { ghost, replayLog, resolve, type MatchLog } from '../src/sim/resolve';
import { canAct, moveAvailable, needsInput, sanitize } from '../src/sim/rules';
import { createMatch, hashState, KO_TAIL, startNextRound } from '../src/sim/state';
import type { Decision, GameState } from '../src/sim/types';
import { CHARACTERS, cfg, ctx, D, duel } from './helpers';

/** Resolve repeatedly with fixed decisions until a frame budget is used. */
function runFor(s: GameState, ds: [Decision, Decision], frames: number): GameState {
  let st = s;
  let used = 0;
  let first = true;
  while (used < frames && !st.roundOver) {
    const r = resolve(st, first ? ds : [D(''), D('')], ctx, { record: true });
    used += r.frames.length - 1;
    st = r.end;
    first = false;
  }
  return st;
}

describe('core hit interactions', () => {
  it('a jab hits an idle opponent and leaves the attacker plus on hit', () => {
    const s = duel('razor', 'titan', 70);
    const r = resolve(s, [D('jab'), D('wait', { amt: 30 })], ctx);
    const hit = r.events.find((e) => e.t === 'hit');
    expect(hit && hit.t === 'hit' && hit.kind).toBe('hit');
    expect(r.end.fighters[1].hp).toBeLessThan(CHARACTERS.titan.hp);
    // Razor gets to act (cancel on hit) while Titan is still in hitstun.
    expect(canAct(r.end, 0, ctx)).toBe(true);
    expect(r.end.fighters[1].mode).toBe('hitstun');
    expect(needsInput(r.end, 1, ctx)).toBe('di');
  });

  it('block stops the damage and puts the defender in blockstun', () => {
    const s = duel('razor', 'titan', 70);
    const r = resolve(s, [D('jab'), D('block', { amt: 20 })], ctx);
    expect(r.events.some((e) => e.t === 'hit' && e.kind === 'block')).toBe(true);
    expect(r.end.fighters[1].hp).toBe(CHARACTERS.titan.hp);
  });

  it('a grab beats block', () => {
    const s = duel('grip', 'razor', 70);
    let st = resolve(s, [D('grab', { dir: [100, 0] }), D('block', { amt: 30 })], ctx).end;
    // play out the throw
    for (let k = 0; k < 6 && st.fighters[1].hp === CHARACTERS.razor.hp; k++) st = resolve(st, [D(''), D('')], ctx).end;
    expect(st.fighters[1].hp).toBeLessThan(CHARACTERS.razor.hp);
  });

  it('a faster strike beats a grab', () => {
    const s = duel('razor', 'grip', 70);
    const r = resolve(s, [D('jab'), D('grab', { dir: [-100, 0] })], ctx);
    expect(r.end.fighters[1].hp).toBeLessThan(CHARACTERS.grip.hp);
    expect(r.end.fighters[0].hp).toBe(CHARACTERS.razor.hp);
  });

  it('two grabs on the same frame tech', () => {
    const s = duel('razor', 'razor', 60);
    const r = resolve(s, [D('grab', { dir: [100, 0] }), D('grab', { dir: [-100, 0] })], ctx);
    expect(r.events.some((e) => e.t === 'hit' && e.kind === 'tech')).toBe(true);
    expect(r.end.fighters[0].hp).toBe(CHARACTERS.razor.hp);
    expect(r.end.fighters[1].hp).toBe(CHARACTERS.razor.hp);
  });

  it('a timed parry stuns the attacker', () => {
    // Titan's Piston lunges and becomes active on frame 11.
    for (const t of [9, 10, 11, 12]) {
      const s = duel('titan', 'razor', 120);
      const r = resolve(s, [D('piston'), D('parry', { amt: t })], ctx);
      const parried = r.events.some((e) => e.t === 'hit' && e.kind === 'parry');
      if (parried) {
        expect(r.end.fighters[1].hp).toBe(CHARACTERS.razor.hp);
        return;
      }
    }
    throw new Error('no parry timing worked');
  });

  it('a mistimed parry gets hit', () => {
    const s = duel('titan', 'razor', 120);
    const r = resolve(s, [D('piston'), D('parry', { amt: 1 })], ctx);
    let st = r.end;
    for (let k = 0; k < 4; k++) st = resolve(st, [D(''), D('')], ctx).end;
    expect(st.fighters[1].hp).toBeLessThan(CHARACTERS.razor.hp);
  });

  it('armor absorbs a hit without interrupting the move', () => {
    const s = duel('titan', 'razor', 90);
    const r = resolve(s, [D('piston'), D('jab')], ctx);
    expect(r.events.some((e) => e.t === 'hit' && e.kind === 'armor')).toBe(true);
    let st = r.end;
    for (let k = 0; k < 4 && st.fighters[1].hp === CHARACTERS.razor.hp; k++) st = resolve(st, [D(''), D('')], ctx).end;
    expect(st.fighters[1].hp).toBeLessThan(CHARACTERS.razor.hp);
  });

  it('projectiles travel and hit at range', () => {
    const s = duel('arc', 'titan', 420);
    let st = resolve(s, [D('bolt', { dir: [100, 0] }), D('wait', { amt: 60 })], ctx).end;
    for (let k = 0; k < 5 && st.fighters[1].hp === CHARACTERS.titan.hp; k++) st = resolve(st, [D('wait', { amt: 60 }), D('')], ctx).end;
    expect(st.fighters[1].hp).toBeLessThan(CHARACTERS.titan.hp);
  });

  it('a sweep knocks down and the victim must choose a wake-up', () => {
    const s = duel('razor', 'titan', 90);
    let st = resolve(s, [D('sweep'), D('wait', { amt: 40 })], ctx).end;
    for (let k = 0; k < 10 && st.fighters[1].mode !== 'down'; k++) st = resolve(st, [D('wait', { amt: 5 }), D('')], ctx).end;
    expect(st.fighters[1].mode).toBe('down');
    expect(needsInput(st, 1, ctx)).toBe('act');
    expect(moveAvailable(st, 1, CHARACTERS.titan.moves.jab, ctx).ok).toBe(false);
    expect(moveAvailable(st, 1, CHARACTERS.titan.moves.getup, ctx).ok).toBe(true);
    expect(sanitize(st, 1, D('jab'), ctx).move).toBe('getup');
  });

  it('combo damage scales down hit after hit', () => {
    const s = duel('razor', 'titan', 70);
    const r = resolve(s, [D('flurry'), D('wait', { amt: 40 })], ctx);
    let st = r.end;
    const dmgs = r.events.filter((e) => e.t === 'hit' && e.kind !== 'block').map((e) => (e as { dmg: number }).dmg);
    for (let k = 0; k < 3; k++) {
      const rr = resolve(st, [D(''), D('')], ctx);
      for (const e of rr.events) if (e.t === 'hit') dmgs.push(e.dmg);
      st = rr.end;
    }
    expect(dmgs.length).toBeGreaterThanOrEqual(3);
    expect(dmgs[2]).toBeLessThan(dmgs[0]);
  });

  it('burst is offered in hitstun and breaks the combo', () => {
    const s = duel('razor', 'titan', 70);
    const r = resolve(s, [D('jab'), D('wait', { amt: 30 })], ctx);
    expect(needsInput(r.end, 1, ctx)).toBe('di');
    expect(sanitize(r.end, 1, D('burst'), ctx).move).toBe('burst');
    const r2 = resolve(r.end, [D('jab'), D('burst')], ctx);
    expect(r2.end.fighters[1].burst).toBeLessThan(1000);
    expect(r2.events.some((e) => e.t === 'move' && e.i === 1 && e.move === 'burst')).toBe(true);
  });

  it('a KO ends the round and awards it', () => {
    const s = duel('razor', 'titan', 70);
    s.fighters[1].hp = 10;
    const r = resolve(s, [D('jab'), D('wait', { amt: 30 })], ctx);
    expect(r.events.some((e) => e.t === 'ko')).toBe(true);
    expect(r.reason).toBe('round');
    expect(r.end.roundOver).toBe(true);
    expect(r.end.wins).toEqual([1, 0]);
    expect(r.end.winner).toBe(0);
    expect(r.end.frame).toBeGreaterThanOrEqual(KO_TAIL);
  });

  it('rounds continue until someone reaches the target', () => {
    const s = createMatch(cfg('razor', 'titan', 5, 2), ctx);
    s.fighters[0].x = px(-35);
    s.fighters[1].x = px(35);
    s.fighters[1].hp = 5;
    const r = resolve(s, [D('jab'), D('wait', { amt: 30 })], ctx);
    expect(r.end.roundOver).toBe(true);
    expect(r.end.winner).toBe(null);
    const n = startNextRound(r.end, ctx);
    expect(n.round).toBe(2);
    expect(n.fighters[1].hp).toBe(CHARACTERS.titan.hp);
    expect(n.wins).toEqual([1, 0]);
  });

  it('DI changes the trajectory of follow-up hits', () => {
    const base = duel('razor', 'titan', 70);
    const r = resolve(base, [D('jab'), D('wait', { amt: 30 })], ctx);
    const a = resolve(r.end, [D('risingkick'), D('', { di: [100, 0] })], ctx).end.fighters[1];
    const b = resolve(r.end, [D('risingkick'), D('', { di: [-100, 0] })], ctx).end.fighters[1];
    expect(a.x === b.x && a.vx === b.vx).toBe(false);
  });

  it('walls stop fighters and walking into each other pushes', () => {
    const s = duel('razor', 'titan', 40);
    const st = runFor(s, [D('walk', { dir: [100, 0], amt: 40 }), D('walk', { dir: [-100, 0], amt: 40 })], 40);
    expect(st.fighters[1].x - st.fighters[0].x).toBeGreaterThanOrEqual(px(CHARACTERS.razor.width + CHARACTERS.titan.width) - 2);
  });
});

describe('rules', () => {
  it('sanitize repairs garbage decisions', () => {
    const s = duel();
    expect(sanitize(s, 0, { move: 'nope' } as Decision, ctx).move).toBe('wait');
    expect(sanitize(s, 0, null, ctx).move).toBe('wait');
    const j = sanitize(s, 0, { move: 'jump', dir: [5000, 5000] } as Decision, ctx);
    expect(j.dir![1]).toBeLessThan(0);
    const w = sanitize(s, 0, { move: 'wait', amt: 99999 } as Decision, ctx);
    expect(w.amt).toBe(60);
    // supers need meter
    expect(sanitize(s, 0, D('thousandcuts'), ctx).move).toBe('wait');
    s.fighters[0].meter = 1000;
    expect(sanitize(s, 0, D('thousandcuts'), ctx).move).toBe('thousandcuts');
    // air moves need to be airborne
    expect(sanitize(s, 0, D('divekick'), ctx).move).toBe('wait');
  });

  it('every move of every character runs without errors', () => {
    for (const [id, def] of Object.entries(CHARACTERS)) {
      for (const m of Object.values(def.moves)) {
        if (m.hidden) continue;
        for (const air of [false, true]) {
          const s = duel(id, 'titan', 100);
          const f = s.fighters[0];
          f.meter = 3000;
          if (air) {
            f.y = px(-200);
            f.grounded = false;
          }
          if (m.wake) {
            if (air) continue;
            f.mode = 'down';
          }
          if (m.needsProj) {
            s.projs.push({ id: 99, owner: 0, kind: m.needsProj, x: px(0), y: px(-80), vx: 0, vy: 0, age: 0, hits: 0, last: -9999, facing: 1, dead: false });
          }
          if (!moveAvailable(s, 0, m, ctx).ok) continue;
          let st = s;
          const d = sanitize(st, 0, D(m.id), ctx);
          expect(d.move, `${id}.${m.id}`).toBe(m.id);
          st = resolve(st, [d, D('wait', { amt: 20 })], ctx).end;
          for (let k = 0; k < 12 && !st.roundOver; k++) st = resolve(st, [D(''), D('')], ctx).end;
          expect(Number.isFinite(st.fighters[0].x)).toBe(true);
          expect(Number.isFinite(st.fighters[1].hp)).toBe(true);
        }
      }
    }
  });

  it('ghost preview reports when you can act again', () => {
    const s = duel('razor', 'titan', 300);
    const g = ghost(s, 0, D('dash'), D('wait', { amt: 60 }), 'wait', ctx);
    expect(g.myNext).toBe(18);
    expect(g.frames.length).toBeGreaterThan(18);
  });
});

describe('determinism', () => {
  function randomMatch(seed: number): { log: MatchLog; hashes: string[] } {
    let rng = seed >>> 0;
    const rand = () => {
      rng = (Math.imul(rng ^ (rng >>> 15), 2246822507) + 0x6d2b79f5) >>> 0;
      return rng / 4294967296;
    };
    const chars = ['razor', 'titan', 'arc', 'grip'];
    const c = cfg(chars[Math.floor(rand() * 4)], chars[Math.floor(rand() * 4)], seed, 2);
    let st = createMatch(c, ctx);
    const log: MatchLog = { v: 1, cfg: c, steps: [] };
    const hashes: string[] = [];
    for (let k = 0; k < 400 && st.winner === null; k++) {
      const ds = [0, 1].map((i) => {
        const def = CHARACTERS[st.fighters[i].char];
        const ids = def.order.filter((id) => moveAvailable(st, i, def.moves[id], ctx).ok);
        const id = ids.length ? ids[Math.floor(rand() * ids.length)] : '';
        return sanitize(
          st,
          i,
          {
            move: id,
            dir: [Math.round(rand() * 200 - 100), Math.round(rand() * 200 - 100)],
            amt: Math.round(rand() * 40),
            di: [Math.round(rand() * 200 - 100), Math.round(rand() * 200 - 100)],
          },
          ctx,
        );
      }) as [Decision, Decision];
      log.steps.push(JSON.parse(JSON.stringify(ds)));
      const r = resolve(st, ds, ctx, { record: false });
      st = r.end;
      if (st.roundOver && st.winner === null) st = startNextRound(st, ctx);
      hashes.push(hashState(st));
    }
    return { log, hashes };
  }

  it('same decisions always give the same states', () => {
    for (const seed of [1, 2, 3, 42, 777]) {
      const a = randomMatch(seed);
      const b = randomMatch(seed);
      expect(a.hashes).toEqual(b.hashes);
    }
  });

  it('a match log replays to the identical final state', () => {
    for (const seed of [5, 6, 7]) {
      const { log, hashes } = randomMatch(seed);
      const st = replayLog(JSON.parse(JSON.stringify(log)), ctx);
      expect(hashState(st)).toBe(hashes[hashes.length - 1]);
    }
  });

  it('every sim value stays an integer', () => {
    const { log } = randomMatch(99);
    const st = replayLog(log, ctx);
    const walk = (v: unknown, path: string) => {
      if (typeof v === 'number') expect(Number.isInteger(v), path).toBe(true);
      else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
    };
    walk(st.fighters, 'fighters');
    walk(st.projs, 'projs');
  });
});
