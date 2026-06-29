/** GameState construction, cloning and deterministic hashing. */

import type { CharacterDef, GameState, PlayerState, StageDef } from './types';

export interface NewMatchConfig {
  stage: StageDef;
  players: {
    playerId: string;
    name: string;
    color: number;
    dynasty: string[];
    isLocal?: boolean;
    isBot?: boolean;
  }[];
  seed: number;
}

export function createMatch(
  cfg: NewMatchConfig,
  chars: Record<string, CharacterDef>,
): GameState {
  const players: PlayerState[] = cfg.players.map((p) => ({
    playerId: p.playerId,
    name: p.name,
    color: p.color,
    dynasty: p.dynasty,
    activeIndex: 0,
    stocksRemaining: p.dynasty.length,
    hustleMeter: 0,
    eliminated: false,
    isLocal: p.isLocal,
    isBot: p.isBot,
  }));

  const state: GameState = {
    turn: 0,
    rngState: cfg.seed >>> 0,
    stageId: cfg.stage.id,
    players,
    characters: players.map(() => null),
  };

  // Spawn first dynasty member for each player.
  players.forEach((p, i) => {
    spawnActive(state, i, cfg.stage, chars);
  });

  return state;
}

export function spawnActive(
  state: GameState,
  playerIndex: number,
  stage: StageDef,
  chars: Record<string, CharacterDef>,
): void {
  const p = state.players[playerIndex];
  if (p.eliminated) {
    state.characters[playerIndex] = null;
    return;
  }
  const charId = p.dynasty[p.activeIndex];
  const def = chars[charId];
  const spawn = stage.spawns[playerIndex % stage.spawns.length];
  state.characters[playerIndex] = {
    charId,
    pos: { x: spawn.x, y: spawn.y },
    vel: { x: 0, y: 0 },
    facing: spawn.x > 0 ? -1 : 1,
    damagePercent: 0,
    hitstun: 0,
    shielding: false,
    grounded: false,
    alive: true,
    invuln: 90, // brief spawn protection (in ticks)
    current: undefined,
  };
  void def;
}

export function cloneState(s: GameState): GameState {
  return {
    turn: s.turn,
    rngState: s.rngState,
    stageId: s.stageId,
    players: s.players.map((p) => ({ ...p, dynasty: p.dynasty.slice() })),
    characters: s.characters.map((c) =>
      c
        ? {
            ...c,
            pos: { ...c.pos },
            vel: { ...c.vel },
            current: c.current
              ? { ...c.current, hitsDone: c.current.hitsDone.slice() }
              : undefined,
          }
        : null,
    ),
  };
}

/**
 * cyrb53-style deterministic hash over the integer-relevant fields of the
 * state. Clients compare this after each resolution to detect desync.
 */
export function hashState(s: GameState): string {
  let h1 = 0xdeadbeef ^ s.turn;
  let h2 = 0x41c6ce57 ^ s.turn;
  const push = (n: number) => {
    const v = n | 0;
    h1 = Math.imul(h1 ^ v, 2654435761);
    h2 = Math.imul(h2 ^ v, 1597334677);
  };
  push(s.rngState);
  push(s.players.length);
  for (const p of s.players) {
    push(p.activeIndex);
    push(p.stocksRemaining);
    push(p.eliminated ? 1 : 0);
  }
  for (const c of s.characters) {
    if (!c) {
      push(0x7fffffff);
      continue;
    }
    push(c.pos.x);
    push(c.pos.y);
    push(c.vel.x);
    push(c.vel.y);
    push(c.facing);
    push(c.damagePercent);
    push(c.hitstun);
    push(c.grounded ? 1 : 0);
    push(c.alive ? 1 : 0);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}
