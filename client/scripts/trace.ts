/** Frame trace of one exchange:  npx vite-node scripts/trace.ts razor thousandcuts 120 [dummy] [defMove] */
import { CHARACTERS, ctxFor } from '../src/content/roster';
import { px } from '../src/sim/fixed';
import { resolve } from '../src/sim/resolve';
import { createMatch } from '../src/sim/state';

const ctx = ctxFor('dojo');
const [a, move, gapS, dummy = 'grip', defMove = 'wait', airS] = process.argv.slice(2);
const gap = Number(gapS ?? 100);
let st = createMatch({ stageId: 'dojo', chars: [a, dummy], palettes: [0, 0], names: ['A', 'B'], roundsToWin: 1, seed: 1 }, ctx);
st.fighters[0].x = px(-gap / 2);
st.fighters[1].x = px(gap / 2);
st.fighters[0].meter = 3000;
if (airS) { st.fighters[0].y = px(-Number(airS)); st.fighters[0].grounded = false; }
let first = true;
for (let k = 0; k < 12; k++) {
  const r = resolve(st, first ? [{ move }, { move: defMove, amt: 60 }] : [{ move: '' }, { move: '' }], ctx);
  first = false;
  r.frames.forEach((s, n) => {
    if (n === 0) return;
    const f = s.fighters.map((q) => `${q.mode.padEnd(9)} ${(q.move ?? '-').padEnd(12)}${String(q.mf).padStart(3)} x${String(Math.round(q.x / 100)).padStart(5)} y${String(Math.round(q.y / 100)).padStart(5)} hp${String(q.hp).padStart(5)} st${String(q.stun).padStart(3)} lag${q.hitlag}`).join(' | ');
    const evs = r.events.filter((e) => e.f === s.f - 1).map((e) => e.t + (e.t === 'hit' ? `:${e.kind}:${e.dmg}` : e.t === 'spawn' || e.t === 'pop' ? `:${e.kind}` : '')).join(',');
    const pr = s.projs.map((p) => `${p.kind}(${Math.round(p.x / 100)},${Math.round(p.y / 100)})`).join(' ');
    console.log(`${String(s.f).padStart(4)} ${f} ${pr} ${evs}`);
  });
  console.log(`---- decision (${r.reason})`);
  st = r.end;
  if (st.roundOver) break;
  if (!st.fighters[0].move && !st.projs.length && k > 0) break;
}
