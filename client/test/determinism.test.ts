import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../src/content/characters';
import { STAGES } from '../src/content/stages';
import {
  createMatch,
  hashState,
  resolveTurn,
  matchWinner,
  validateQueue,
  WINDOW_TICKS,
  type ActionQueue,
  type SimCtx,
  type GameState,
} from '../src/sim';

const ctx: SimCtx = { chars: CHARACTERS, stage: STAGES.skyforge };

function freshMatch(seed: number): GameState {
  return createMatch(
    {
      stage: STAGES.skyforge,
      seed,
      players: [
        { playerId: 'p0', name: 'A', color: 0xff0000, dynasty: ['titan', 'razor', 'arc'] },
        { playerId: 'p1', name: 'B', color: 0x00ff00, dynasty: ['razor', 'grip', 'titan'] },
        { playerId: 'p2', name: 'C', color: 0x0000ff, dynasty: ['arc', 'titan', 'grip'] },
        { playerId: 'p3', name: 'D', color: 0xffff00, dynasty: ['grip', 'arc', 'razor'] },
      ],
    },
    CHARACTERS,
  );
}

function sampleQueues(state: GameState): ActionQueue[] {
  return [
    {
      playerId: 'p0',
      characterId: state.players[0].dynasty[state.players[0].activeIndex],
      actions: [
        { moveId: 'dash_right', startTick: 0 },
        { moveId: 'swing', startTick: 24 },
      ],
    },
    {
      playerId: 'p1',
      characterId: state.players[1].dynasty[state.players[1].activeIndex],
      actions: [
        { moveId: 'jump', startTick: 2 },
        { moveId: 'divekick', startTick: 18 },
      ],
    },
    {
      playerId: 'p2',
      characterId: state.players[2].dynasty[state.players[2].activeIndex],
      actions: [{ moveId: 'bolt', startTick: 5, aimAngle: 200 }],
    },
    {
      playerId: 'p3',
      characterId: state.players[3].dynasty[state.players[3].activeIndex],
      actions: [
        { moveId: 'walk_left', startTick: 0 },
        { moveId: 'lariat', startTick: 26 },
      ],
    },
  ];
}

describe('deterministic simulation', () => {
  it('produces identical end hashes across repeated runs', () => {
    const hashes: string[] = [];
    for (let i = 0; i < 50; i++) {
      const s = freshMatch(0xc0ffee);
      const res = resolveTurn(s, sampleQueues(s), ctx);
      hashes.push(res.hash);
    }
    expect(new Set(hashes).size).toBe(1);
  });

  it('end hash matches hashState of endState', () => {
    const s = freshMatch(12345);
    const res = resolveTurn(s, sampleQueues(s), ctx);
    expect(res.hash).toBe(hashState(res.endState));
  });

  it('different seeds with idle queues still deterministic per seed', () => {
    const run = (seed: number) => {
      const s = freshMatch(seed);
      return resolveTurn(s, [], ctx).hash;
    };
    expect(run(1)).toBe(run(1));
    expect(run(2)).toBe(run(2));
  });

  it('survives a multi-turn match without throwing and reaches a winner-ish state', () => {
    let s = freshMatch(777);
    let turns = 0;
    while (matchWinner(s) === null && turns < 400) {
      // Everyone spams their biggest move at the nearest target-ish.
      const queues: ActionQueue[] = s.players.map((p, i) => {
        const cid = p.dynasty[p.activeIndex];
        return {
          playerId: p.playerId,
          characterId: cid,
          actions: s.characters[i]
            ? [
                { moveId: i % 2 === 0 ? 'dash_right' : 'dash_left', startTick: 0 },
                { moveId: 'jab', startTick: 20 },
                { moveId: 'jump', startTick: 40 },
              ]
            : [],
        };
      });
      s = resolveTurn(s, queues, ctx).endState;
      turns++;
    }
    expect(turns).toBeLessThan(400);
  });

  it('JSON serialize -> deserialize -> resolve is identical (network parity)', () => {
    const s = freshMatch(0xabcdef);
    const queues = sampleQueues(s);
    const direct = resolveTurn(s, queues, ctx).hash;
    // Simulate the wire: state stays, only seed+queues ship.
    const wire = JSON.parse(JSON.stringify({ queues }));
    const s2 = freshMatch(0xabcdef);
    const viaWire = resolveTurn(s2, wire.queues, ctx).hash;
    expect(viaWire).toBe(direct);
  });

  it('rejects illegal queues in validation', () => {
    expect(validateQueue(ctx, { playerId: 'x', characterId: 'titan', actions: [{ moveId: 'nope', startTick: 0 }] }).ok).toBe(false);
    expect(validateQueue(ctx, { playerId: 'x', characterId: 'titan', actions: [{ moveId: 'jab', startTick: WINDOW_TICKS + 5 }] }).ok).toBe(false);
    expect(
      validateQueue(ctx, {
        playerId: 'x',
        characterId: 'titan',
        actions: [
          { moveId: 'swing', startTick: 0 },
          { moveId: 'quake', startTick: 10 },
        ],
      }).ok,
    ).toBe(false); // 3 + 3 = 6 > budget 5
  });
});
