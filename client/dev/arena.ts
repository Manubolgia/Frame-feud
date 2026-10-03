import '@fontsource/anton/400.css';
import { Application } from 'pixi.js';
import { Arena } from '../src/render/arena';
import { ctxFor } from '../src/content/roster';
import { createMatch, startNextRound } from '../src/sim/state';
import { resolve } from '../src/sim/resolve';
import { cpuDecide } from '../src/game/ai';
import type { Snapshot, SimEvent } from '../src/sim/types';

const q = new URLSearchParams(location.search);
const stage = q.get('stage') ?? 'dojo';
const chars: [string, string] = [q.get('a') ?? 'razor', q.get('b') ?? 'titan'];
const app = new Application();
await app.init({ resizeTo: window, antialias: true, background: '#000', resolution: 1 });
document.body.appendChild(app.canvas);
const arena = new Arena(app);
const cfg = { stageId: stage, chars, palettes: [0, 0] as [number, number], names: ['A', 'B'] as [string, string], roundsToWin: 2, seed: 1 };
arena.setMatch(cfg);
arena.setBand(0, 70, window.innerWidth, window.innerHeight);
const ctx = ctxFor(stage);
let st = createMatch(cfg, ctx);
let frames: Snapshot[] = [];
let events: SimEvent[] = [];
let k = 0;
let fired = 0;
const skip = +(q.get('skip') ?? 0);
for (let i = 0; i < skip; i++) { const r = resolve(st, [cpuDecide(st,0,ctx,2), cpuDecide(st,1,ctx,2)], ctx, {record:false}); st = r.end; if (st.roundOver && st.winner===null) st = startNextRound(st, ctx); }
function next() {
  if (st.roundOver) st = st.winner === null ? startNextRound(st, ctx) : st;
  const r = resolve(st, [cpuDecide(st, 0, ctx, 2), cpuDecide(st, 1, ctx, 2)], ctx);
  frames = r.frames; events = r.events; k = 0; fired = 0; st = r.end;
}
next();
arena.frame(frames[0], true);
let acc = 0;
const speed = +(q.get('speed') ?? 1);
app.ticker.add((t) => {
  const dt = Math.min(0.05, t.deltaMS / 1000);
  acc += dt * 60 * speed;
  while (acc >= 1) {
    acc -= 1;
    k++;
    if (k >= frames.length) { next(); }
    const f = frames[k]?.f ?? 0;
    while (fired < events.length && events[fired].f < f) { arena.onEvent(events[fired], frames[k], {}); fired++; }
  }
  const a = frames[Math.max(0, k - 1)], b = frames[Math.min(frames.length - 1, k)];
  arena.render(dt, a, b, acc, { hitboxes: q.has('hb') });
});
(window as any).ready = true;
