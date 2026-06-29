/** Wire protocol (server side). Kept structurally identical to the client's
 *  net/protocol.ts. The worker treats queues/state as opaque JSON — it never
 *  simulates (Mode A: input relay + hash consensus). */

export interface ActionQueue {
  playerId: string;
  characterId: string;
  actions: { moveId: string; startTick: number; aimAngle?: number }[];
}

export interface LobbyPlayer {
  playerId: string;
  name: string;
  slot: number;
  dynasty: string[];
  ready: boolean;
  connected: boolean;
  isHost: boolean;
}

export interface LobbyState {
  room: string;
  stageId: string;
  players: LobbyPlayer[];
  started: boolean;
}

export type ClientMsg =
  | { t: 'join'; room: string; name: string }
  | { t: 'reconnect'; room: string; playerId: string; token: string }
  | { t: 'pick_dynasty'; dynasty: string[] }
  | { t: 'pick_stage'; stageId: string }
  | { t: 'ready_lobby'; ready: boolean }
  | { t: 'start_match' }
  | { t: 'plan_submit'; turn: number; queue: ActionQueue }
  | { t: 'unready_plan'; turn: number }
  | { t: 'state_hash'; turn: number; hash: string }
  | { t: 'ping' };

export type ServerMsg =
  | { t: 'joined'; playerId: string; token: string; slot: number; lobby: LobbyState }
  | { t: 'lobby_state'; lobby: LobbyState }
  | { t: 'error'; message: string }
  | {
      t: 'match_start';
      seed: number;
      stageId: string;
      roster: { playerId: string; name: string; slot: number; dynasty: string[] }[];
      order: string[];
    }
  | { t: 'turn_begin'; turn: number; deadline?: number }
  | { t: 'plan_status'; turn: number; readyPlayers: string[] }
  | { t: 'resolve'; turn: number; seed: number; queues: ActionQueue[] }
  | { t: 'desync_detected'; turn: number }
  | { t: 'player_left'; playerId: string }
  | { t: 'match_over'; winner: string }
  | { t: 'pong' };

export const ROSTER = ['titan', 'razor', 'arc', 'grip'];
export const STAGES = ['skyforge', 'tundra'];
