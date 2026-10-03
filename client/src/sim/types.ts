/**
 * Type contracts shared by content, the simulation, rendering and the network.
 *
 * Conventions
 *  - World y grows DOWN. The floor is y = 0, so airborne fighters have y < 0.
 *  - Content is authored in pixels; the sim stores sub-pixels (see fixed.ts).
 *  - Move-relative x offsets and knockback point the way the fighter faces.
 *  - Direction parameters chosen by players are absolute screen directions,
 *    integers in [-100, 100] on each axis.
 */

import type { AnimDef, Pose } from '../content/poses';

// ---------------------------------------------------------------- content --

export type Category = 'move' | 'attack' | 'special' | 'defend' | 'super' | 'wake' | 'system';

export interface HitDef {
  dmg: number;
  /** Frames of hitstun on hit (before combo decay). */
  hitstun: number;
  /** Frames of blockstun on block. Defaults to 2/3 of hitstun. */
  blockstun?: number;
  /** Knockback in px/frame, facing-relative (+x away from the attacker). */
  kb: [number, number];
  /** Freeze frames for both sides on contact. Defaults from damage. */
  hitlag?: number;
  /** Percent of damage dealt through a block. */
  chip?: number;
  unblockable?: boolean;
  /** Ground hits normally keep the victim standing; this always floors them. */
  knockdown?: boolean;
  groundBounce?: boolean;
  wallBounce?: boolean;
  /** May strike a knocked-down fighter. */
  otg?: boolean;
  /** Knockback x points away from the hitbox centre instead of the facing. */
  radial?: boolean;
  /** Only connects with grounded fighters (shockwaves). */
  groundOnly?: boolean;
  /** Sound / spark flavour for the renderer. */
  fx?: 'light' | 'medium' | 'heavy' | 'slash' | 'zap' | 'blast' | 'throw';
}

export interface HitboxDef extends HitDef {
  /** Active frames, inclusive, counted from the move's first frame. */
  f0: number;
  f1: number;
  /** Centre offset from the fighter's feet, px (x facing-relative, y up < 0). */
  x: number;
  y: number;
  r: number;
  kind?: 'strike' | 'grab';
  /** Hitboxes sharing a group can only connect once per (re)hit interval. */
  group?: number;
  /** Multi-hit: frames between hits of the same group. */
  rehit?: number;
  maxHits?: number;
  /** Rotate offset + knockback to the move's direction parameter. */
  aimed?: boolean;
  /** Grabs only: move the attacker into this throw on contact. */
  throwMove?: string;
  /** Grabs only: can catch airborne opponents. */
  air?: boolean;
}

export interface SpawnDef {
  f: number;
  proj: string;
  /** Spawn offset from feet, px, facing-relative. */
  x: number;
  y: number;
  /** Launch speed px/frame. With `aim`, along the move's direction. */
  speed?: number;
  aim?: boolean;
  /** Fixed facing-relative velocity px/frame when not aimed. */
  v?: [number, number];
}

export interface MotionKey {
  /** Frame (inclusive) this key applies on; `to` makes it a range. */
  f: number;
  to?: number;
  /** Set velocity (px/frame, facing-relative x). */
  vx?: number;
  vy?: number;
  /** Add to velocity each applied frame. */
  ax?: number;
  ay?: number;
}

export interface ThrowDef {
  /** Victim offset from the attacker while held: [frame, x, y] px. */
  hold: [number, number, number][];
  /** Frame the victim is released and struck. */
  release: number;
  hit: HitDef;
}

export interface DirSpec {
  /**
   * side: left / right only;  free: anywhere in the circle;
   * up: the upper half (jumps);  down: the lower half;  aim: any direction
   */
  kind: 'side' | 'free' | 'up' | 'down' | 'aim';
  def: [number, number];
  /** Minimum magnitude (0..100) for analog kinds. */
  min?: number;
  /** Default is relative to facing (x flipped when facing left). */
  label?: string;
}

export interface AmtSpec {
  min: number;
  max: number;
  def: number;
  label: string;
  unit: 'f' | '%' | 'px';
}

export interface MoveDef {
  id: string;
  name: string;
  cat: Category;
  desc: string;
  icon: string;
  /** Total length in frames (ignored when `amtIsLength`). */
  total: number;
  where: 'ground' | 'air' | 'any';
  /** Air moves: what touching the floor does. */
  land?: 'lag' | 'end' | 'keep';
  landLag?: number;
  hitboxes?: HitboxDef[];
  spawns?: SpawnDef[];
  motion?: MotionKey[];
  /** Frames with gravity off, inclusive. */
  float?: [number, number];
  armor?: [number, number, number];
  invuln?: { f0: number; f1: number; vs: 'all' | 'strike' | 'proj' | 'grab' }[];
  /** Frames the fighter is invisible (teleports). */
  hide?: [number, number];
  /** Frames the hurtbox is crouched (60% height). */
  low?: [number, number];
  block?: boolean;
  parry?: boolean;
  cancelOnHit?: number;
  cancelOnBlock?: number;
  /** Always cancellable from this frame. */
  iasa?: number;
  meter?: number;
  burst?: boolean;
  uses?: 'airJump' | 'airDash';
  /** Only usable while one of the fighter's projectiles of this kind exists. */
  needsProj?: string;
  /** Not usable while a projectile of this kind is alive. */
  limitProj?: string;
  param?: { dir?: DirSpec; amt?: AmtSpec };
  /** Length = amt + amtExtra frames. */
  amtIsLength?: boolean;
  amtExtra?: number;
  /** Special per-frame behaviour implemented in sim/step.ts. */
  script?:
    | 'walk'
    | 'dash'
    | 'backdash'
    | 'jump'
    | 'airjump'
    | 'airdash'
    | 'fastfall'
    | 'hover'
    | 'teleport'
    | 'detonate'
    | 'dive'
    | 'leap'
    | 'roll'
    | 'burst';
  /** Script tuning numbers (meaning depends on the script).
   *  teleport: at (frame), dist (px), behind (1 = appear behind the foe)
   *  dive: start, speed, bounce;  leap: at, jump, air;  roll: from, to, speed
   *  hover: speed;  detonate: at */
  sp?: Record<string, number>;
  throw?: ThrowDef;
  /** Selectable only as a wake-up from a knockdown. */
  wake?: boolean;
  /** Internal (throws, landing): never offered in menus. */
  hidden?: boolean;
  /** On hit, the attacker pops up and the move ends (dive kicks). */
  bounceOnHit?: boolean;
  /** Land: spawn this projectile at the feet (shockwaves). */
  landSpawn?: string;
  /** Do not auto-turn toward the opponent when the move starts. */
  noTurn?: boolean;
  /** Super flash for the renderer. */
  superFlash?: boolean;
  anim: AnimDef;
}

export interface ProjectileDef {
  id: string;
  name: string;
  r: number;
  life: number;
  hit?: HitDef;
  /** px/frame² */
  gravity?: number;
  rehit?: number;
  maxHits?: number;
  /** Dies on touching a wall / the floor (default true). */
  wallStop?: boolean;
  floorStop?: boolean;
  /** Spawned when it dies to the floor / a wall / its lifetime. */
  burstInto?: string;
  /** Also burst when it strikes a fighter. */
  burstOnHit?: boolean;
  /** Projectiles that meet another clashing projectile cancel out. */
  clash?: boolean;
  /** Pulls the owner's opponent toward it, px/frame, within radius px. */
  pull?: { radius: number; speed: number; until: number };
  /** Render style key. */
  look: 'kunai' | 'bolt' | 'orb' | 'blast' | 'missile' | 'wave' | 'singularity' | 'shock';
  /** Hitbox only during these ages, inclusive. */
  activeFrom?: number;
  activeTo?: number;
  /** Speed applied in the facing direction on spawn if the spawn sets none. */
  drift?: number;
}

export interface BuildDef {
  /** Overall height in px (feet to head top). */
  height: number;
  /** Proportions as fractions of height. */
  leg: number;
  torso: number;
  arm: number;
  head: number;
  /** Limb thickness in px. */
  limbW: number;
  torsoW: number;
  /** Accessory set the renderer draws. */
  kit: 'titan' | 'razor' | 'arc' | 'grip';
}

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  archetype: string;
  blurb: string;
  /** Signature colour. */
  color: number;
  /** Alternate palettes: [main, trim, glow]. */
  palettes: [number, number, number][];
  hp: number;
  walk: number;
  dash: number;
  backdash: number;
  jump: number;
  airSpeed: number;
  gravity: number;
  maxFall: number;
  fastFall: number;
  airJumps: number;
  airDashes: number;
  airDash: number;
  /** Hurtbox half-width and height, px. */
  width: number;
  height: number;
  /** Percent of knockback received. */
  kbMul: number;
  ratings: { power: number; speed: number; range: number; defense: number; mobility: number };
  difficulty: 1 | 2 | 3;
  build: BuildDef;
  /** Idle fighting stance. */
  stance: Pose;
  moves: Record<string, MoveDef>;
  projectiles: Record<string, ProjectileDef>;
  /** Order moves appear in menus. */
  order: string[];
}

export interface StageDef {
  id: string;
  name: string;
  subtitle: string;
  /** Half-width of the arena between the walls, px. */
  halfWidth: number;
  ceiling: number;
  theme: 'dojo' | 'rooftop' | 'forge' | 'lab';
}

// ---------------------------------------------------------------- inputs --

/** One player's choice at a decision point. Small and JSON-friendly: this is
 *  exactly what crosses the network. */
export interface Decision {
  /** Move id, or '' to carry on with whatever is happening. */
  move: string;
  dir?: [number, number];
  amt?: number;
  feint?: boolean;
  /** Directional influence while in hitstun. */
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

// ---------------------------------------------------------------- state --

export type FighterMode =
  | 'idle'
  | 'move'
  | 'hitstun'
  | 'blockstun'
  | 'parried'
  | 'grabbed'
  | 'kd'
  | 'down'
  | 'ko';

export interface MoveState {
  id: string;
  frame: number;
  total: number;
  dir: [number, number];
  amt: number;
  feint: boolean;
  /** Some hitbox has connected (hit) / been blocked. */
  hit: boolean;
  blocked: boolean;
  /** A cancel window has already been offered. */
  offered: boolean;
  armor: number;
  /** Per hitbox group: hits landed and the frame of the last hit. */
  hits: number[];
  last: number[];
  /** Start position (teleports). */
  ox: number;
  oy: number;
  /** Grab victim index during a throw, -1 otherwise. */
  victim: number;
}

export interface Fighter {
  char: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  hp: number;
  meter: number;
  burst: number;
  airJumps: number;
  airDashes: number;
  mode: FighterMode;
  move: MoveState | null;
  /** Frames left in hitstun / blockstun / knockdown / parried. */
  stun: number;
  hitlag: number;
  /** Generic invulnerability timer (wake-up). */
  invuln: number;
  di: [number, number];
  comboHits: number;
  comboDmg: number;
  comboOtg: boolean;
  /** Pending bounce flags from the last hit. */
  gb: boolean;
  wb: boolean;
  wallUsed: boolean;
  /** Frame the fighter was last hit (for counter display). */
  stats: FighterStats;
}

export interface FighterStats {
  dealt: number;
  hits: number;
  bestCombo: number;
  bestComboDmg: number;
  parries: number;
  blocks: number;
  throws: number;
  supers: number;
}

export interface Projectile {
  id: number;
  owner: number;
  kind: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  hits: number;
  last: number;
  facing: 1 | -1;
  dead: boolean;
}

export interface GameState {
  cfg: MatchConfig;
  /** Frames since the round started. */
  frame: number;
  /** Decision points resolved so far this match. */
  step: number;
  round: number;
  wins: [number, number];
  fighters: [Fighter, Fighter];
  projs: Projectile[];
  nextId: number;
  /** Set once somebody is KO'd: the frame it happened and the winner
   *  (-1 for a double KO). The round ends `KO_TAIL` frames later. */
  ko: { at: number; winner: number } | null;
  roundOver: boolean;
  /** Match winner once decided: 0, 1, or -1 for a draw. */
  winner: number | null;
}

export interface SimCtx {
  chars: Record<string, CharacterDef>;
  stage: StageDef;
}

// ---------------------------------------------------------------- output --

export type HitKind =
  | 'hit'
  | 'counter'
  | 'block'
  | 'parry'
  | 'armor'
  | 'throw'
  | 'tech'
  | 'grab'
  | 'otg';

export type SimEvent =
  | { t: 'hit'; f: number; kind: HitKind; a: number; v: number; x: number; y: number; dmg: number; power: number; fx: string; combo: number }
  | { t: 'ko'; f: number; v: number; x: number; y: number }
  | { t: 'move'; f: number; i: number; move: string }
  | { t: 'whiff'; f: number; i: number; move: string }
  | { t: 'jump'; f: number; i: number; x: number; y: number; air: boolean }
  | { t: 'land'; f: number; i: number; x: number; hard: boolean }
  | { t: 'wall'; f: number; i: number; x: number; y: number }
  | { t: 'bounce'; f: number; i: number; x: number; y: number }
  | { t: 'spawn'; f: number; i: number; kind: string; x: number; y: number }
  | { t: 'pop'; f: number; kind: string; x: number; y: number }
  | { t: 'vanish'; f: number; i: number; x: number; y: number }
  | { t: 'appear'; f: number; i: number; x: number; y: number }
  | { t: 'feint'; f: number; i: number };

export interface FighterSnap {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  hp: number;
  meter: number;
  burst: number;
  mode: FighterMode;
  move: string | null;
  mf: number;
  mt: number;
  dir: [number, number];
  stun: number;
  hitlag: number;
  invuln: number;
  combo: number;
  comboDmg: number;
  di: [number, number];
  hidden: boolean;
  blocking: boolean;
  parrying: boolean;
  armor: boolean;
  victim: number;
}

export interface ProjSnap {
  id: number;
  owner: number;
  kind: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  facing: 1 | -1;
}

export interface Snapshot {
  f: number;
  fighters: [FighterSnap, FighterSnap];
  projs: ProjSnap[];
}

export interface Resolution {
  frames: Snapshot[];
  events: SimEvent[];
  end: GameState;
  /** Why the run stopped. */
  reason: 'decision' | 'round' | 'limit';
}
