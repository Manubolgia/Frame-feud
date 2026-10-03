/** Family Feud: lineups of up to three, the next member steps in on a KO. */
import { describe, expect, it } from 'vitest';
import { px } from '../src/sim/fixed';
import { replayLog, resolve, type MatchLog } from '../src/sim/resolve';
import { BOUT_HEAL_PCT, createMatch, hashState, maxHp, startNextRound } from '../src/sim/state';
import type { Decision, GameState, MatchConfig } from '../src/sim/types';
import { CHARACTERS, ctx } from './helpers';

function feudCfg(a: string[], b: string[]): MatchConfig {
  return { stageId: 'dojo', chars: [a[0], b[0]], teams: [a, b], palettes: [0, 1], names: ['A', 'B'], roundsToWin: 1, seed: 99 };
}

/** Knock fighter `v` out with a jab from the other side, play the KO out. */
function knockOut(st: GameState, v: 0 | 1): { st: GameState; steps: [Decision, Decision][] } {
  const s = structuredClone(st) as GameState;
  s.fighters[v].hp = 1;
  s.fighters[0].x = px(-35);
  s.fighters[1].x = px(35);
  const steps: [Decision, Decision][] = [];
  const atk: [Decision, Decision] = v === 1 ? [{ move: 'jab' }, { move: 'wait', amt: 30 }] : [{ move: 'wait', amt: 30 }, { move: 'jab' }];
  let r = resolve(s, atk, ctx);
  steps.push(atk);
  let cur = r.end;
  for (let k = 0; k < 20 && !cur.roundOver; k++) {
    r = resolve(cur, [{ move: '' }, { move: '' }], ctx);
    steps.push([{ move: '' }, { move: '' }]);
    cur = r.end;
  }
  return { st: cur, steps };
}

describe('family feud', () => {
  it('starts with each family lead', () => {
    const st = createMatch(feudCfg(['razor', 'titan', 'arc'], ['grip', 'arc', 'razor']), ctx);
    expect(st.fighters[0].char).toBe('razor');
    expect(st.fighters[1].char).toBe('grip');
    expect(st.members).toEqual([0, 0]);
  });

  it('a KO brings in the next member; the winner keeps its wounds and heals a little', () => {
    let st = createMatch(feudCfg(['razor', 'titan', 'arc'], ['grip', 'arc', 'razor']), ctx);
    st.fighters[0].hp = 400;
    const ko = knockOut(st, 1).st;
    expect(ko.roundOver).toBe(true);
    expect(ko.winner).toBeNull();
    st = startNextRound(ko, ctx);
    expect(st.members).toEqual([0, 1]);
    expect(st.fighters[1].char).toBe('arc');
    expect(st.fighters[1].hp).toBe(maxHp(st.cfg, CHARACTERS.arc));
    expect(st.fighters[0].char).toBe('razor');
    const before = ko.fighters[0].hp;
    const full = maxHp(st.cfg, CHARACTERS.razor);
    expect(st.fighters[0].hp).toBe(before + Math.trunc(((full - before) * BOUT_HEAL_PCT) / 100));
  });

  it('the match ends only when a whole family is down', () => {
    let st = createMatch(feudCfg(['titan'], ['razor', 'arc']), ctx);
    st = startNextRound(knockOut(st, 1).st, ctx);
    expect(st.winner).toBeNull();
    expect(st.fighters[1].char).toBe('arc');
    const end = knockOut(st, 1).st;
    expect(end.winner).toBe(0);
  });

  it('a one-member side loses on its first KO', () => {
    const st = createMatch(feudCfg(['razor', 'titan'], ['grip']), ctx);
    const end = knockOut(st, 1).st;
    expect(end.winner).toBe(0);
  });

  it('replays deterministically across member changes', () => {
    const cfg = feudCfg(['razor', 'titan'], ['grip', 'arc']);
    let st = createMatch(cfg, ctx);
    const steps: [Decision, Decision][] = [];
    // play a few bouts with fixed decisions
    for (let k = 0; k < 400 && st.winner === null; k++) {
      const d: [Decision, Decision] = [{ move: k % 3 ? 'jab' : 'dash' }, { move: k % 4 ? 'jab' : 'block', amt: 12 }];
      const r = resolve(st, d, ctx, { record: false });
      steps.push(d);
      st = r.end;
      if (st.roundOver && st.winner === null) st = startNextRound(st, ctx);
    }
    const log: MatchLog = { v: 2, cfg, steps };
    expect(hashState(replayLog(log, ctx))).toBe(hashState(st));
  });
});
