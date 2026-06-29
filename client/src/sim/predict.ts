/**
 * Prediction ghost: simulate a single player's queue assuming everyone else
 * stays idle. Used by the planning UI to show "where do I end up if opponents
 * do nothing" — the blind-commitment trajectory. Pure, deterministic, reuses
 * the same engine.
 */

import { resolveTurn, type SimCtx } from './step';
import type { ActionQueue, GameState, Vec2 } from './types';

export interface Prediction {
  path: Vec2[]; // feet position per tick for the planning player
  endDamageTaken: number; // (always 0 vs idle, kept for symmetry)
}

export function predictTrajectory(
  state: GameState,
  playerIndex: number,
  queue: ActionQueue,
  ctx: SimCtx,
): Prediction {
  // Build a queue set where only the planning player acts.
  const queues: ActionQueue[] = [queue];
  const res = resolveTurn(state, queues, ctx);
  const path: Vec2[] = res.frames.map((f) => {
    const c = f.chars[playerIndex];
    return c ? { x: c.pos.x, y: c.pos.y } : { x: 0, y: 0 };
  });
  return { path, endDamageTaken: 0 };
}
