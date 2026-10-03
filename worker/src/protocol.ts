/**
 * Wire protocol (server side). Structurally identical to the client's
 * src/net/protocol.ts. The server never simulates: it relays each step's
 * two decisions and keeps the log so anyone can rebuild the match.
 */

export interface Decision {
  move: string;
  dir?: [number, number];
  amt?: number;
  feint?: boolean;
  di?: [number, number];
}

export interface MatchConfig {
  stageId: string;
  chars: [string, string];
  palettes: [number, number];
  names: [string, string];
  roundsToWin: number;
  seed: number;
}

export interface SeatInfo {
  name: string;
  char: string;
  palette: number;
  ready: boolean;
  connected: boolean;
}

export interface Lobby {
  code: string;
  stage: string;
  rounds: number;
  timer: number;
  seats: [SeatInfo | null, SeatInfo | null];
  host: number;
  spectators: number;
  phase: 'lobby' | 'match' | 'over';
  rematch: [boolean, boolean];
}

export type ClientMsg =
  | { t: 'hello'; v: string; name: string; resume?: { id: string; token: string } }
  | { t: 'pick'; char?: string; palette?: number; ready?: boolean }
  | { t: 'host'; stage?: string; rounds?: number; timer?: number }
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

export const ROSTER = ['razor', 'titan', 'arc', 'grip'];
export const STAGES = ['dojo', 'rooftop', 'forge', 'lab'];
export const TIMERS = [0, 30, 60, 90];
