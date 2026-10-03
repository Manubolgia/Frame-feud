/**
 * Move audit: run every attack/special/super against a dummy at several
 * ranges (standing still and blocking) and print what actually happened.
 *   npx vite-node scripts/audit.ts [char] [dummy]
 */
import { CHARACTERS, ctxFor } from '../src/content/roster';
import { px } from '../src/sim/fixed';
import { resolve } from '../src/sim/resolve';
import { canAct } from '../src/sim/rules';
import { createMatch } from '../src/sim/state';
import type { Decision, GameState, SimEvent } from '../src/sim/types';

const ctx = ctxFor('dojo');
const only = process.argv[2];
const dummy = process.argv[3] ?? 'grip';
const gaps = [60, 120, 200, 320];

function setup(a: string, b: string, gap: number, air: boolean): GameState {
  const s = createMatch({ stageId: 'dojo', chars: [a, b], palettes: [0, 0], names: ['A', 'B'], roundsToWin: 1, seed: 1 }, ctx);
  s.fighters[0].x = px(-gap / 2);
  s.fighters[1].x = px(gap / 2);
  s.fighters[0].meter = 3000;
  if (air) {
    s.fighters[0].y = px(-90);
    s.fighters[0].grounded = false;
  }
  return s;
}

function run(a: string, move: string, gap: number, def: Decision, air: boolean) {
  let st = setup(a, dummy, gap, air);
  const ev: SimEvent[] = [];
  let r = resolve(st, [{ move }, def], ctx);
  ev.push(...r.events);
  st = r.end;
  let frames = r.frames.length - 1;
  let maxAir = 0;
  for (const fr of r.frames) maxAir = Math.max(maxAir, -fr.fighters[1].y);
  let guard = 0;
  // keep going (no new inputs) while the attacker is still in its move
  while (guard++ < 40 && !st.roundOver && ((st.fighters[0].move && st.fighters[0].move.id === move) || st.projs.some((p) => p.owner === 0))) {
    r = resolve(st, [{ move: '' }, { move: '' }], ctx);
    ev.push(...r.events);
    for (const fr of r.frames) maxAir = Math.max(maxAir, -fr.fighters[1].y);
    st = r.end;
    frames += r.frames.length - 1;
  }
  const hits = ev.filter((e): e is Extract<SimEvent, { t: 'hit' }> => e.t === 'hit' && e.a === 0);
  const got = hits.filter((h) => h.v === 1);
  const dmg = got.reduce((s, h) => s + h.dmg, 0);
  const kinds = [...new Set(got.map((h) => h.kind))].join('+');
  const v = st.fighters[1];
  const spawned = ev.filter((e) => e.t === 'spawn' && e.i === 0).length;
  const firstHit = got.length ? got[0].f : -1;
  return {
    s: got.length ? `${kinds}${got.length > 1 ? 'x' + got.length : ''} ${dmg}dmg @${firstHit} ${v.mode}${maxAir > 20 ? ` air${Math.round(maxAir / 100)}` : ''}${spawned ? ` proj${spawned}` : ''}` : `miss${spawned ? ` proj${spawned}` : ''}`,
    hit: got.length > 0,
  };
}

for (const [cid, c] of Object.entries(CHARACTERS)) {
  if (only && only !== cid) continue;
  console.log(`\n=== ${c.name} vs ${dummy}`);
  for (const id of c.order) {
    const m = c.moves[id];
    if (!m || m.hidden || !['attack', 'special', 'super'].includes(m.cat)) continue;
    const air = m.where === 'air';
    const cells = gaps.map((g) => run(cid, id, g, { move: 'wait', amt: 60 }, air).s);
    const blk = gaps.map((g) => run(cid, id, g, { move: 'block', amt: 60 }, air).s);
    console.log(`${(m.name + (air ? ' (air)' : '')).padEnd(18)} | ${cells.map((x) => x.padEnd(30)).join('|')}`);
    console.log(`${'   vs block'.padEnd(18)} | ${blk.map((x) => x.padEnd(30)).join('|')}`);
  }
}
