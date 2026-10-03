import { CHARACTERS, ctxFor } from '../src/content/roster';
import { px } from '../src/sim/fixed';
import { createMatch } from '../src/sim/state';
import type { Decision, GameState, MatchConfig, SimCtx } from '../src/sim/types';

export const ctx: SimCtx = ctxFor('dojo');

export function cfg(a = 'razor', b = 'titan', seed = 1234, rounds = 1): MatchConfig {
  return { stageId: 'dojo', chars: [a, b], palettes: [0, 0], names: ['A', 'B'], roundsToWin: rounds, seed };
}

/** A fresh match with fighters placed `gap` px apart, facing each other. */
export function duel(a = 'razor', b = 'titan', gap = 80): GameState {
  const s = createMatch(cfg(a, b), ctx);
  s.fighters[0].x = px(-gap / 2);
  s.fighters[1].x = px(gap / 2);
  return s;
}

export const D = (move: string, extra: Partial<Decision> = {}): Decision => ({ move, ...extra });

export { CHARACTERS };
