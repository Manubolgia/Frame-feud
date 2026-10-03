import { describe, expect, it } from 'vitest';
import { cpuDecide, solveMixed, type Difficulty } from '../src/game/ai';
import { resolve } from '../src/sim/resolve';
import { sanitize } from '../src/sim/rules';
import { createMatch, startNextRound } from '../src/sim/state';
import type { Decision, GameState } from '../src/sim/types';
import { cfg, ctx } from './helpers';

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5) >>> 0;
    return s / 4294967296;
  };
}

function play(a: string, b: string, la: Difficulty, lb: Difficulty, seed: number) {
  const rand = seeded(seed);
  let st: GameState = createMatch(cfg(a, b, seed, 1), ctx);
  let steps = 0;
  let worst = 0;
  while (st.winner === null && steps < 1500) {
    const t0 = performance.now();
    const ds: [Decision, Decision] = [cpuDecide(st, 0, ctx, la, rand), cpuDecide(st, 1, ctx, lb, rand)];
    worst = Math.max(worst, performance.now() - t0);
    for (let i = 0; i < 2; i++) expect(sanitize(st, i, ds[i], ctx)).toEqual(ds[i]);
    st = resolve(st, ds, ctx, { record: false }).end;
    if (st.roundOver && st.winner === null) st = startNextRound(st, ctx);
    steps++;
  }
  return { winner: st.winner, steps, worst, hp: st.fighters.map((f) => f.hp) };
}

describe('cpu', () => {
  it('fictitious play finds rock-paper-scissors', () => {
    const w = solveMixed(
      [
        [0, -1, 1],
        [1, 0, -1],
        [-1, 1, 0],
      ],
      3000,
    );
    for (const x of w) expect(Math.abs(x - 1 / 3)).toBeLessThan(0.05);
  });

  it('plays legal, finishing matches at every level', () => {
    const pairs: [string, string][] = [
      ['razor', 'titan'],
      ['arc', 'grip'],
      ['grip', 'razor'],
      ['titan', 'arc'],
    ];
    for (const [k, [a, b]] of pairs.entries()) {
      const lvl = (k % 3) as Difficulty;
      const r = play(a, b, lvl, lvl, 100 + k);
      // eslint-disable-next-line no-console
      console.log(`${a} vs ${b} @${lvl}: winner ${r.winner} in ${r.steps} steps, slowest decision ${r.worst.toFixed(0)}ms, hp ${r.hp}`);
      expect(r.winner).not.toBeNull();
    }
  }, 120000);

  it('hard beats easy most of the time', () => {
    let hard = 0;
    const games = 6;
    for (let g = 0; g < games; g++) {
      const chars = ['razor', 'titan', 'arc', 'grip'];
      const a = chars[g % 4];
      const b = chars[(g + 1) % 4];
      // alternate sides
      const r = g % 2 === 0 ? play(a, b, 2, 0, 500 + g) : play(a, b, 0, 2, 500 + g);
      const hardSide = g % 2 === 0 ? 0 : 1;
      if (r.winner === hardSide) hard++;
    }
    // eslint-disable-next-line no-console
    console.log(`hard won ${hard}/${games}`);
    expect(hard).toBeGreaterThanOrEqual(4);
  }, 300000);
});
