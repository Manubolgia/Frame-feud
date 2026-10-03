/**
 * Every move does what its description says: attacks reach what their
 * animation reaches, multi-hits land all their hits, launchers launch,
 * grabs beat blocks, lobbed missiles land where they were aimed.
 */
import { describe, expect, it } from 'vitest';
import { bakeHitpos } from '../src/content/bakehit';
import { HITPOS } from '../src/content/hitpos';
import { px } from '../src/sim/fixed';
import { resolve } from '../src/sim/resolve';
import { createMatch } from '../src/sim/state';
import type { Decision, GameState, SimEvent } from '../src/sim/types';
import { CHARACTERS, ctx } from './helpers';

function setup(a: string, b: string, gap: number, air = false): GameState {
  const s = createMatch({ stageId: 'dojo', chars: [a, b], palettes: [0, 0], names: ['A', 'B'], roundsToWin: 1, seed: 7 }, ctx);
  s.fighters[0].x = px(-gap / 2);
  s.fighters[1].x = px(gap / 2);
  s.fighters[0].meter = 3000;
  if (air) {
    s.fighters[0].y = px(-90);
    s.fighters[0].grounded = false;
  }
  return s;
}

/** Run one move against a dummy until the move (and its projectiles) are done. */
function exchange(a: string, d: Decision, gap: number, defend: Decision = { move: 'wait', amt: 60 }, b = 'grip') {
  const m = CHARACTERS[a].moves[d.move];
  let st = setup(a, b, gap, m.where === 'air');
  const ev: SimEvent[] = [];
  let r = resolve(st, [d, defend], ctx);
  ev.push(...r.events);
  st = r.end;
  let maxAir = 0;
  const track = (frames: typeof r.frames) => {
    for (const f of frames) maxAir = Math.max(maxAir, -f.fighters[1].y);
  };
  track(r.frames);
  for (let k = 0; k < 40 && !st.roundOver; k++) {
    const busy = (st.fighters[0].move && st.fighters[0].move.id === d.move) || st.projs.some((p) => p.owner === 0);
    if (!busy) break;
    r = resolve(st, [{ move: '' }, { move: '' }], ctx);
    ev.push(...r.events);
    track(r.frames);
    st = r.end;
  }
  const hits = ev.filter((e): e is Extract<SimEvent, { t: 'hit' }> => e.t === 'hit' && e.a === 0 && e.v === 1);
  return { st, ev, hits, maxAir: maxAir / 100 };
}

describe('baked hitbox paths', () => {
  it('match the current animations (run `npx vite-node scripts/bake.ts`)', () => {
    expect(bakeHitpos(CHARACTERS)).toEqual(HITPOS);
  });
});

describe('every attack connects somewhere', () => {
  // movement / setup specials with no hitbox of their own
  const setupOnly = new Set(['shadowstep', 'detonate', 'blink', 'hover']);
  for (const [cid, c] of Object.entries(CHARACTERS)) {
    for (const id of c.order) {
      const m = c.moves[id];
      if (m.hidden || !['attack', 'special', 'super'].includes(m.cat) || setupOnly.has(id)) continue;
      it(`${cid} ${m.name} hits a standing dummy at some range`, () => {
        const hit = [50, 90, 140, 200, 300].some((g) => exchange(cid, { move: id }, g).hits.length > 0);
        expect(hit).toBe(true);
      });
    }
  }
});

describe('multi-hit moves land every hit on an open opponent', () => {
  const cases: [string, string, number, number][] = [
    ['razor', 'flurry', 70, 5],
    ['razor', 'thousandcuts', 70, 5],
    ['razor', 'airspin', 50, 3],
    ['arc', 'ray', 200, 5],
  ];
  for (const [c, id, gap, n] of cases) {
    it(`${c} ${id}: ${n} hits`, () => {
      expect(exchange(c, { move: id }, gap).hits.length).toBe(n);
    });
  }
});

describe('launchers launch, small hits do not knock down', () => {
  for (const [c, id] of [['razor', 'risingkick'], ['titan', 'skybreaker'], ['arc', 'risingspark']] as const) {
    it(`${c} ${id} launches a standing opponent`, () => {
      const r = exchange(c, { move: id }, 60);
      expect(r.hits.length).toBeGreaterThan(0);
      expect(r.maxAir).toBeGreaterThan(40);
    });
  }
  for (const c of Object.keys(CHARACTERS)) {
    it(`${c} jab leaves the opponent standing`, () => {
      const r = exchange(c, { move: 'jab' }, 60);
      expect(r.hits.length).toBe(1);
      expect(r.st.fighters[1].mode).not.toBe('kd');
      expect(r.maxAir).toBeLessThan(5);
    });
  }
});

describe('grabs beat block', () => {
  for (const [c, id] of [['razor', 'grab'], ['titan', 'grab'], ['arc', 'grab'], ['grip', 'grab'], ['grip', 'gravitydrop']] as const) {
    it(`${c} ${id}`, () => {
      const r = exchange(c, { move: id, dir: [100, 0] }, 60, { move: 'block', amt: 40 });
      expect(r.hits.some((h) => h.kind === 'throw')).toBe(true);
    });
  }
});

describe('projectiles', () => {
  it('a lobbed missile lands at the chosen range', () => {
    for (const range of [150, 300, 500]) {
      const st = setup('titan', 'grip', 600);
      st.fighters[1].x = px(900); // out of the way
      let r = resolve(st, [{ move: 'missile', amt: range }, { move: 'wait', amt: 60 }], ctx);
      let pop: SimEvent | undefined;
      for (let k = 0; k < 20 && !pop; k++) {
        pop = r.events.find((e) => e.t === 'pop' && e.kind === 'missile');
        if (!pop) r = resolve(r.end, [{ move: '' }, { move: '' }], ctx);
      }
      expect(pop).toBeDefined();
      const landed = (pop as Extract<SimEvent, { t: 'pop' }>).x / 100 - st.fighters[0].x / 100;
      expect(Math.abs(landed - range)).toBeLessThan(30);
    }
  });

  it('a missile aimed at the opponent hits them', () => {
    const r = exchange('titan', { move: 'missile', amt: 300 }, 300);
    expect(r.hits.length).toBeGreaterThan(0);
  });
});
