/**
 * Turn resolution: apply both players' decisions, then run frames until
 * somebody can act again (or the round ends). Also the preview ("ghost")
 * runner the planning UI and the CPU use to look ahead.
 */

import { canAct, needsInput, sanitize } from './rules';
import { cloneState, snapshot, startNextRound } from './state';
import { startMove, stepFrame } from './step';
import type { Decision, GameState, MatchConfig, Resolution, SimCtx, SimEvent, Snapshot } from './types';
import { createMatch } from './state';

export const MAX_RESOLVE_FRAMES = 900;

/** Apply sanitized decisions to a (mutable) state. */
export function applyDecisions(st: GameState, ds: [Decision, Decision], ctx: SimCtx, ev: SimEvent[] | null) {
  const clean: Decision[] = [sanitize(st, 0, ds[0], ctx), sanitize(st, 1, ds[1], ctx)];
  for (let i = 0; i < 2; i++) {
    const f = st.fighters[i];
    if (f.move && canAct(st, i, ctx)) f.move.offered = true;
  }
  for (let i = 0; i < 2; i++) {
    const d = clean[i];
    const f = st.fighters[i];
    if (d.di && f.mode === 'hitstun') f.di = [d.di[0], d.di[1]];
    if (d.move) {
      if (f.move && f.move.victim >= 0) continue; // never abandon a throw mid-air
      startMove(st, i, d, ctx, ev);
    }
  }
}

export function resolve(
  start: GameState,
  ds: [Decision, Decision],
  ctx: SimCtx,
  opts: { record?: boolean; limit?: number } = {},
): Resolution {
  const record = opts.record !== false;
  const limit = opts.limit ?? MAX_RESOLVE_FRAMES;
  const st = cloneState(start);
  const events: SimEvent[] = [];
  const frames: Snapshot[] = record ? [snapshot(st, ctx)] : [];
  applyDecisions(st, ds, ctx, events);
  st.step++;
  let n = 0;
  for (;;) {
    stepFrame(st, ctx, events);
    n++;
    if (record) frames.push(snapshot(st, ctx));
    if (st.roundOver) return { frames, events, end: st, reason: 'round' };
    if (n >= limit) return { frames, events, end: st, reason: 'limit' };
    if (!st.ko && (canAct(st, 0, ctx) || canAct(st, 1, ctx))) return { frames, events, end: st, reason: 'decision' };
  }
}

/** Opponent behaviour assumed by the preview. */
export type GhostPolicy = 'wait' | 'block' | 'repeat';

export interface GhostRun {
  frames: Snapshot[];
  events: SimEvent[];
  /** Frame (index into frames) where `me` can act again, or -1. */
  myNext: number;
  /** Frame where the opponent can act again, or -1. */
  oppNext: number;
  end: GameState;
}

/**
 * Look ahead from `start` with `mine` for fighter `me`, while the opponent
 * keeps doing `opp` (and repeats a policy action whenever it becomes free).
 * Runs until `me` can act again plus a short tail, or `limit` frames.
 */
export function ghost(
  start: GameState,
  me: number,
  mine: Decision,
  opp: Decision,
  policy: GhostPolicy,
  ctx: SimCtx,
  opts: { limit?: number; tail?: number; record?: boolean } = {},
): GhostRun {
  const limit = opts.limit ?? 150;
  const tail = opts.tail ?? 8;
  const record = opts.record !== false;
  const st = cloneState(start);
  const ds: [Decision, Decision] = me === 0 ? [mine, opp] : [opp, mine];
  const events: SimEvent[] = [];
  const frames: Snapshot[] = record ? [snapshot(st, ctx)] : [];
  applyDecisions(st, ds, ctx, events);
  let myNext = -1;
  let oppNext = -1;
  const o = 1 - me;
  for (let n = 1; n <= limit; n++) {
    stepFrame(st, ctx, events);
    if (record) frames.push(snapshot(st, ctx));
    if (st.roundOver) break;
    if (myNext < 0 && canAct(st, me, ctx)) myNext = n;
    if (canAct(st, o, ctx)) {
      if (oppNext < 0) oppNext = n;
      const pd = policyDecision(st, o, policy, opp, ctx);
      const both: [Decision, Decision] = me === 0 ? [{ move: '' }, pd] : [pd, { move: '' }];
      // Only the opponent acts here; `me` keeps whatever it's doing.
      const meCan = canAct(st, me, ctx);
      if (meCan && st.fighters[me].move) st.fighters[me].move!.offered = true;
      applyDecisions(st, both, ctx, events);
      if (meCan && st.fighters[me].mode === 'idle') {
        // me idles through the tail of the preview
      }
    }
    if (myNext >= 0 && n >= myNext + tail) break;
  }
  return { frames, events, myNext, oppNext, end: st };
}

function policyDecision(st: GameState, i: number, policy: GhostPolicy, last: Decision, ctx: SimCtx): Decision {
  const f = st.fighters[i];
  if (needsInput(st, i, ctx) !== 'act') return { move: '' };
  if (f.mode === 'down') return { move: 'getup' };
  if (f.mode === 'move') return { move: '' };
  if (policy === 'block') return { move: 'block', amt: 40 };
  if (policy === 'repeat' && last.move) return last;
  return { move: 'wait', amt: 60 };
}

// ------------------------------------------------------------ match logs --

/** Everything needed to rebuild a match from scratch: the config and every
 *  decision pair, in order. Replays and online resyncs both use this. */
export interface MatchLog {
  v: number;
  cfg: MatchConfig;
  steps: [Decision, Decision][];
}

/** Replay a log up to `upto` steps (default: all). Returns the state at the
 *  next decision point, advancing rounds automatically. */
export function replayLog(log: MatchLog, ctx: SimCtx, upto = log.steps.length): GameState {
  let st = createMatch(log.cfg, ctx);
  for (let k = 0; k < upto; k++) {
    const r = resolve(st, log.steps[k], ctx, { record: false });
    st = r.end;
    if (st.roundOver && st.winner === null) st = startNextRound(st, ctx);
  }
  return st;
}
