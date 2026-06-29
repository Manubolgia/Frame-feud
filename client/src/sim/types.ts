/** Shared type contracts for content, planning inputs and authoritative state. */

import type { Fixed, Vec2 } from './fixed';
export type { Fixed, Vec2 } from './fixed';

export type Tick = number; // sim tick index within a turn window

// ---------- content (data-driven) ----------

export interface Hitbox {
  offset: Vec2; // relative to character, +x = facing direction
  radius: Fixed;
  damage: number; // % added on hit (integer)
  knockback: Vec2; // base knockback vector (fixed), +x = facing direction
  knockbackScaling: number; // how much accrued % amplifies knockback (per 100%)
  hitstun: Tick;
  activeStart: Tick; // relative to move start
  activeEnd: Tick;
  hits?: number; // optional: max times this hitbox can connect (default 1)
}

export type MoveKind = 'attack' | 'special' | 'movement' | 'jump' | 'shield' | 'grab' | 'idle';

export interface SelfMotion {
  atTick: Tick;
  velocity?: Vec2; // set velocity (facing-relative x)
  accel?: Vec2; // additive per-tick accel during the move
  faceAim?: boolean;
}

export interface MoveDef {
  id: string;
  name: string;
  kind: MoveKind;
  startup: Tick;
  active: Tick;
  recovery: Tick;
  cost: number; // planning-budget cost
  hitboxes: Hitbox[];
  selfMotion?: SelfMotion[];
  aimable?: boolean;
  airOnly?: boolean;
  groundOnly?: boolean;
  invulnFrames?: number; // grants i-frames while active (dodges/counters)
  tags?: string[];
  /** UI hint: name of an SVG icon (see ui/icons.ts) + optional flip. */
  icon?: string;
  iconFlip?: boolean;
  /** one-line tooltip describing the move's role. */
  desc?: string;
}

export interface CharacterDef {
  id: string;
  name: string;
  archetype: string;
  color: number; // base accent color
  walkSpeed: Fixed;
  airSpeed: Fixed;
  jumpVel: Fixed; // (negative = up)
  gravity: Fixed;
  weight: number; // knockback resistance (heavier = less launch)
  radius: Fixed; // hurtbox radius
  fastFall: Fixed;
  moves: Record<string, MoveDef>;
  /** Visual silhouette descriptor used by the vector renderer. */
  shape: 'heavy' | 'rush' | 'zoner' | 'grappler';
  blurb: string;
}

export interface Platform {
  x: Fixed; // center x
  y: Fixed; // top surface y
  w: Fixed; // half-width
  passThrough: boolean;
}

export interface StageDef {
  id: string;
  name: string;
  platforms: Platform[];
  spawns: Vec2[];
  blastZones: { left: Fixed; right: Fixed; top: Fixed; bottom: Fixed };
  bg: { top: number; bottom: number; accent: number };
}

// ---------- planning / inputs (what the network ships) ----------

export interface PlannedAction {
  moveId: string;
  startTick: Tick;
  aimAngle?: number; // integer degrees
}

export interface ActionQueue {
  playerId: string;
  characterId: string;
  actions: PlannedAction[];
}

// ---------- authoritative state (all integer / fixed) ----------

export interface CharacterState {
  charId: string;
  pos: Vec2;
  vel: Vec2;
  facing: 1 | -1;
  damagePercent: number;
  hitstun: Tick;
  shielding: boolean;
  current?: { moveId: string; elapsed: Tick; aimAngle: number; hitsDone: number[] };
  grounded: boolean;
  alive: boolean;
  invuln: Tick;
}

export interface PlayerState {
  playerId: string;
  name: string;
  color: number;
  dynasty: string[]; // ordered character ids (lineup)
  activeIndex: number;
  stocksRemaining: number;
  hustleMeter: number;
  eliminated: boolean;
  isLocal?: boolean;
  isBot?: boolean;
}

export interface GameState {
  turn: number;
  rngState: number;
  stageId: string;
  players: PlayerState[];
  characters: (CharacterState | null)[]; // index matches players; null when eliminated
}

// ---------- resolution output (for rendering) ----------

export interface HitEvent {
  tick: Tick;
  attacker: number; // player index
  victim: number;
  pos: Vec2;
  damage: number;
  knockback: Fixed; // magnitude, for juice scaling
  shielded: boolean;
}

export interface KoEvent {
  tick: Tick;
  victim: number;
  pos: Vec2;
}

export interface FrameSnapshot {
  chars: ({
    pos: Vec2;
    vel: Vec2;
    facing: 1 | -1;
    damagePercent: number;
    hitstun: Tick;
    shielding: boolean;
    moveId?: string;
    moveElapsed?: number;
    grounded: boolean;
    invuln: number;
    aimAngle: number;
  } | null)[];
}

export interface ResolveResult {
  frames: FrameSnapshot[]; // one per tick (length = window + 1)
  hits: HitEvent[];
  kos: KoEvent[];
  endState: GameState;
  hash: string;
}
