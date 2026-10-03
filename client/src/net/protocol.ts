/**
 * Wire protocol between the game and the room server (Cloudflare Durable
 * Object). Lockstep on decisions: the server only relays each step's two
 * decisions; every client simulates the identical result itself.
 *
 * The worker keeps a structural copy of these types in worker/src/protocol.ts.
 */

import type { Decision, MatchConfig } from '../sim/types';

export interface SeatInfo {
  name: string;
  char: string;
  /** Family lineup (Family Feud): 1-3 fighters, lead first. */
  team: string[];
  palette: number;
  ready: boolean;
  connected: boolean;
}

export interface Lobby {
  code: string;
  stage: string;
  rounds: number;
  /** Seconds per decision, 0 = untimed. */
  timer: number;
  /** 3v3 Family Feud or a 1v1 duel. */
  format: 'feud' | 'duel';
  seats: [SeatInfo | null, SeatInfo | null];
  host: number;
  spectators: number;
  phase: 'lobby' | 'match' | 'over';
  rematch: [boolean, boolean];
}

export type ClientMsg =
  | { t: 'hello'; v: string; name: string; resume?: { id: string; token: string } }
  | { t: 'pick'; char?: string; team?: string[]; palette?: number; ready?: boolean }
  | { t: 'host'; stage?: string; rounds?: number; timer?: number; format?: 'feud' | 'duel' }
  | { t: 'decide'; step: number; d: Decision }
  | { t: 'undecide'; step: number }
  | { t: 'hash'; step: number; h: string }
  | { t: 'over'; winner: number }
  | { t: 'rematch'; want: boolean }
  | { t: 'lobby' }
  | { t: 'leave' }
  | { t: 'ping'; at: number };

export type ServerMsg =
  | { t: 'welcome'; id: string; token: string; seat: number; lobby: Lobby }
  | { t: 'lobby'; lobby: Lobby }
  | { t: 'start'; cfg: MatchConfig; timer: number; log: [Decision, Decision][]; locked: [boolean, boolean] }
  | { t: 'locked'; step: number; seats: [boolean, boolean] }
  | { t: 'resolve'; step: number; ds: [Decision, Decision] }
  | { t: 'desync'; step: number }
  | { t: 'presence'; seat: number; connected: boolean }
  | { t: 'ended'; winner: number; reason: 'ko' | 'forfeit' }
  | { t: 'error'; code: string; message: string }
  | { t: 'pong'; at: number };
