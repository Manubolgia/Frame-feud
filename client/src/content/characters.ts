/**
 * The starter roster: 4 distinct archetypes, each with a deep, characterful kit
 * (9 attacks + the shared movement/defence set). Tuned so each plays very
 * differently but stays roughly balanced around the win condition:
 *
 *  TITAN  — Heavy.   Highest weight/damage, slowest. Big punishes, late KOs.
 *  RAZOR  — Rushdown. Lightest/fastest, multi-hit combo flurries, low raw KB.
 *  ARC    — Zoner.    Aimable energy tools to control space; laggy up close.
 *  GRIP   — Grappler. Command grabs with huge close-range KB; poor at range.
 */

import { FX } from '../sim/fixed';
import type { CharacterDef, MoveDef } from '../sim/types';
import { hb, mergeMoves, universalMoves } from './moves';

function mk(
  stats: {
    id: string; name: string; archetype: string; color: number;
    shape: CharacterDef['shape']; blurb: string;
    walk: number; air: number; jump: number; dash: number;
    gravity: number; weight: number; radius: number; fastFall: number;
  },
  attacks: Record<string, MoveDef>,
): CharacterDef {
  return {
    id: stats.id, name: stats.name, archetype: stats.archetype, color: stats.color,
    shape: stats.shape, blurb: stats.blurb,
    walkSpeed: FX(stats.walk / 1000), airSpeed: FX(stats.air / 1000),
    jumpVel: FX(stats.jump / 1000), gravity: FX(stats.gravity / 1000),
    weight: stats.weight, radius: FX(stats.radius), fastFall: FX(stats.fastFall / 1000),
    moves: mergeMoves(
      universalMoves({
        walk: FX(stats.walk / 1000), air: FX(stats.air / 1000),
        jump: FX(stats.jump / 1000), dash: FX(stats.dash / 1000),
      }),
      attacks,
    ),
  };
}

// ============================ TITAN — Heavy ============================
const titan = mk(
  {
    id: 'titan', name: 'TITAN', archetype: 'Heavy', color: 0xff6a3d, shape: 'heavy',
    blurb: 'Slow, immovable, hits like a freight train. Survives absurd damage and ends stocks in one read.',
    walk: 132, air: 110, jump: -980, dash: 430, gravity: 105, weight: 150, radius: 0.76, fastFall: 220,
  },
  {
    jab: {
      id: 'jab', name: 'Hammer Jab', kind: 'attack', icon: 'fist',
      startup: 4, active: 3, recovery: 10, cost: 1, desc: 'Quick fast poke to start a read.',
      hitboxes: [hb({ ox: 0.95, oy: -0.1, r: 0.62, dmg: 6, kbx: 0.25, kby: -0.1, scaling: 30, hitstun: 9, start: 4, end: 6 })],
    },
    backhand: {
      id: 'backhand', name: 'Backhand', kind: 'attack', icon: 'swipe',
      startup: 7, active: 4, recovery: 13, cost: 2, desc: 'Wide swat that swats foes off the ledge.',
      hitboxes: [hb({ ox: 1.05, oy: -0.2, r: 0.7, dmg: 10, kbx: 0.42, kby: -0.16, scaling: 70, hitstun: 13, start: 7, end: 10 })],
    },
    uppercut: {
      id: 'uppercut', name: 'Sky Hook', kind: 'attack', icon: 'uppercut',
      startup: 8, active: 3, recovery: 16, cost: 2, desc: 'Vertical launcher — start your juggles.',
      selfMotion: [{ atTick: 6, velocity: { x: 0, y: FX(-0.45) } }],
      hitboxes: [hb({ ox: 0.55, oy: -0.65, r: 0.7, dmg: 11, kbx: 0.12, kby: -0.64, scaling: 95, hitstun: 16, start: 8, end: 10 })],
    },
    stomp: {
      id: 'stomp', name: 'Stomp', kind: 'attack', icon: 'stomp',
      startup: 6, active: 4, recovery: 12, cost: 1, desc: 'Low ground hit, good vs dodges.',
      hitboxes: [hb({ ox: 0.6, oy: 0.2, r: 0.6, dmg: 8, kbx: 0.18, kby: -0.22, scaling: 50, hitstun: 11, start: 6, end: 9 })],
    },
    swing: {
      id: 'swing', name: 'Wreckball', kind: 'attack', icon: 'hammer',
      startup: 11, active: 4, recovery: 19, cost: 3, desc: 'Slow heavy smash — a hard read, huge reward.',
      hitboxes: [hb({ ox: 1.25, oy: -0.15, r: 0.85, dmg: 16, kbx: 0.55, kby: -0.34, scaling: 125, hitstun: 18, start: 11, end: 14 })],
    },
    shoulder: {
      id: 'shoulder', name: 'Shoulder Charge', kind: 'special', icon: 'charge',
      startup: 6, active: 9, recovery: 16, cost: 2, desc: 'Lunge forward through projectiles.',
      selfMotion: [{ atTick: 6, velocity: { x: FX(0.62), y: 0 } }],
      hitboxes: [hb({ ox: 0.7, oy: -0.1, r: 0.72, dmg: 12, kbx: 0.5, kby: -0.2, scaling: 82, hitstun: 14, start: 6, end: 13 })],
    },
    rocket: {
      id: 'rocket', name: 'Rocket Rise', kind: 'special', icon: 'rocket',
      startup: 5, active: 6, recovery: 18, cost: 2, desc: 'Rising uppercut — recovery + launch.',
      selfMotion: [{ atTick: 5, velocity: { x: 0, y: FX(-1.0) } }],
      hitboxes: [hb({ ox: 0.3, oy: -0.55, r: 0.7, dmg: 10, kbx: 0.18, kby: -0.55, scaling: 88, hitstun: 14, start: 5, end: 10 })],
    },
    quake: {
      id: 'quake', name: 'Earthquake', kind: 'special', icon: 'quake',
      startup: 12, active: 5, recovery: 22, cost: 3, desc: 'Ground-shaking AOE around Titan.',
      hitboxes: [hb({ ox: 0, oy: 0.15, r: 1.2, dmg: 18, kbx: 0.12, kby: -0.52, scaling: 140, hitstun: 20, start: 12, end: 16 })],
    },
    grab: {
      id: 'grab', name: 'Crush Grab', kind: 'grab', icon: 'grab',
      startup: 7, active: 3, recovery: 20, cost: 2, desc: 'Grab and hurl — beats shields.',
      hitboxes: [hb({ ox: 0.72, oy: -0.2, r: 0.5, dmg: 12, kbx: 0.45, kby: -0.4, scaling: 100, hitstun: 18, start: 7, end: 9 })],
    },
  },
);

// ============================ RAZOR — Rushdown ============================
const razor = mk(
  {
    id: 'razor', name: 'RAZOR', archetype: 'Rushdown', color: 0x37d6ff, shape: 'rush',
    blurb: 'Blistering speed and frame-tight pressure. Light and dies early, but never lets you breathe.',
    walk: 232, air: 196, jump: -1180, dash: 640, gravity: 90, weight: 80, radius: 0.52, fastFall: 260,
  },
  {
    jab: {
      id: 'jab', name: 'Flurry', kind: 'attack', icon: 'blade',
      startup: 2, active: 6, recovery: 6, cost: 1, desc: 'Rapid multi-hit jab that traps foes.',
      hitboxes: [hb({ ox: 0.72, oy: -0.1, r: 0.46, dmg: 3, kbx: 0.12, kby: -0.06, scaling: 18, hitstun: 5, start: 2, end: 7, hits: 4 })],
    },
    slash: {
      id: 'slash', name: 'Phase Slash', kind: 'special', icon: 'slash',
      startup: 4, active: 5, recovery: 10, cost: 2, desc: 'Dash-cancel slash that closes distance.',
      selfMotion: [{ atTick: 4, velocity: { x: FX(0.64), y: 0 } }],
      hitboxes: [hb({ ox: 0.6, oy: -0.1, r: 0.56, dmg: 9, kbx: 0.4, kby: -0.18, scaling: 72, hitstun: 10, start: 4, end: 8 })],
    },
    flipkick: {
      id: 'flipkick', name: 'Flip Kick', kind: 'attack', icon: 'flip',
      startup: 5, active: 4, recovery: 12, cost: 2, desc: 'Somersault launcher into juggles.',
      selfMotion: [{ atTick: 5, velocity: { x: 0, y: FX(-0.7) } }],
      hitboxes: [hb({ ox: 0.42, oy: -0.55, r: 0.6, dmg: 8, kbx: 0.1, kby: -0.56, scaling: 86, hitstun: 12, start: 5, end: 8 })],
    },
    divekick: {
      id: 'divekick', name: 'Meteor Dive', kind: 'special', icon: 'dive', airOnly: true,
      startup: 4, active: 8, recovery: 10, cost: 2, desc: 'Air-only spike — punish whiffs from above.',
      selfMotion: [{ atTick: 4, velocity: { x: FX(0.45), y: FX(0.8) } }],
      hitboxes: [hb({ ox: 0.3, oy: 0.42, r: 0.55, dmg: 10, kbx: 0.25, kby: 0.46, scaling: 92, hitstun: 12, start: 4, end: 11 })],
    },
    blink: {
      id: 'blink', name: 'Blink Strike', kind: 'special', icon: 'dash',
      startup: 3, active: 4, recovery: 14, cost: 2, desc: 'Long forward stab — whiff-punish tool.',
      selfMotion: [{ atTick: 3, velocity: { x: FX(0.9), y: 0 } }],
      hitboxes: [hb({ ox: 0.8, oy: -0.1, r: 0.5, dmg: 7, kbx: 0.32, kby: -0.14, scaling: 64, hitstun: 9, start: 3, end: 6 })],
    },
    whirl: {
      id: 'whirl', name: 'Whirl', kind: 'attack', icon: 'spin',
      startup: 4, active: 8, recovery: 10, cost: 2, desc: 'Spinning blades hit all around you.',
      hitboxes: [hb({ ox: 0, oy: -0.2, r: 0.85, dmg: 2, kbx: 0.1, kby: -0.12, scaling: 22, hitstun: 5, start: 4, end: 11, hits: 5 })],
    },
    updraft: {
      id: 'updraft', name: 'Updraft', kind: 'special', icon: 'rocket',
      startup: 4, active: 6, recovery: 16, cost: 2, desc: 'Rising spin — recovery and a launcher.',
      selfMotion: [{ atTick: 4, velocity: { x: 0, y: FX(-1.15) } }],
      hitboxes: [hb({ ox: 0.2, oy: -0.5, r: 0.6, dmg: 3, kbx: 0.08, kby: -0.4, scaling: 50, hitstun: 8, start: 4, end: 9, hits: 3 })],
    },
    spin: {
      id: 'spin', name: 'Cyclone', kind: 'special', icon: 'spin',
      startup: 8, active: 10, recovery: 16, cost: 3, desc: 'Finisher — the only real KO move you have.',
      hitboxes: [hb({ ox: 0.72, oy: -0.15, r: 0.72, dmg: 14, kbx: 0.5, kby: -0.36, scaling: 116, hitstun: 16, start: 8, end: 16 })],
    },
    counter: {
      id: 'counter', name: 'Parry', kind: 'shield', icon: 'counter', invulnFrames: 10,
      startup: 0, active: 10, recovery: 14, cost: 2, desc: 'I-frames, then a riposte slash.',
      hitboxes: [hb({ ox: 0.7, oy: -0.1, r: 0.6, dmg: 9, kbx: 0.45, kby: -0.3, scaling: 95, hitstun: 14, start: 8, end: 10 })],
    },
  },
);

// ============================ ARC — Zoner ============================
const arc = mk(
  {
    id: 'arc', name: 'ARC', archetype: 'Zoner', color: 0xb45cff, shape: 'zoner',
    blurb: 'Controls space with aimable energy. Punishes every approach — but folds if you get inside.',
    walk: 176, air: 150, jump: -1120, dash: 480, gravity: 88, weight: 98, radius: 0.6, fastFall: 230,
  },
  {
    jab: {
      id: 'jab', name: 'Pulse', kind: 'attack', icon: 'pulse',
      startup: 4, active: 3, recovery: 9, cost: 1, desc: 'Close burst to create breathing room.',
      hitboxes: [hb({ ox: 0.8, oy: -0.1, r: 0.5, dmg: 5, kbx: 0.2, kby: -0.1, scaling: 28, hitstun: 8, start: 4, end: 6 })],
    },
    bolt: {
      id: 'bolt', name: 'Arc Bolt', kind: 'special', icon: 'bolt', aimable: true,
      startup: 6, active: 10, recovery: 14, cost: 2, desc: 'Aimable shot — your bread-and-butter poke.',
      hitboxes: [hb({ ox: 2.4, oy: 0, r: 0.5, dmg: 7, kbx: 0.36, kby: 0, scaling: 60, hitstun: 10, start: 6, end: 15 })],
    },
    charge: {
      id: 'charge', name: 'Rail Cannon', kind: 'special', icon: 'rail', aimable: true,
      startup: 14, active: 8, recovery: 18, cost: 3, desc: 'Slow aimable KO beam. Commit hard.',
      hitboxes: [hb({ ox: 3.1, oy: 0, r: 0.7, dmg: 15, kbx: 0.52, kby: 0, scaling: 122, hitstun: 16, start: 14, end: 21 })],
    },
    scatter: {
      id: 'scatter', name: 'Scatter', kind: 'special', icon: 'burst',
      startup: 8, active: 6, recovery: 14, cost: 2, desc: 'Three-way spread covers the approach.',
      hitboxes: [
        hb({ ox: 1.6, oy: -0.5, r: 0.42, dmg: 5, kbx: 0.3, kby: -0.22, scaling: 50, hitstun: 8, start: 8, end: 13 }),
        hb({ ox: 1.8, oy: 0, r: 0.42, dmg: 5, kbx: 0.34, kby: -0.06, scaling: 50, hitstun: 8, start: 8, end: 13 }),
        hb({ ox: 1.6, oy: 0.5, r: 0.42, dmg: 5, kbx: 0.3, kby: 0.16, scaling: 50, hitstun: 8, start: 8, end: 13 }),
      ],
    },
    antiair: {
      id: 'antiair', name: 'Skyburst', kind: 'attack', icon: 'burst',
      startup: 8, active: 6, recovery: 14, cost: 2, desc: 'Blasts juggling foes out of the air.',
      hitboxes: [hb({ ox: 0.2, oy: -0.95, r: 0.82, dmg: 9, kbx: 0.06, kby: -0.52, scaling: 92, hitstun: 12, start: 8, end: 13 })],
    },
    mine: {
      id: 'mine', name: 'Sky Mine', kind: 'special', icon: 'mine',
      startup: 18, active: 8, recovery: 12, cost: 2, desc: 'Delayed trap — cuts off a landing spot.',
      hitboxes: [hb({ ox: 0.5, oy: 0.1, r: 0.7, dmg: 8, kbx: 0.2, kby: -0.45, scaling: 80, hitstun: 12, start: 18, end: 25 })],
    },
    beam: {
      id: 'beam', name: 'Lance', kind: 'special', icon: 'beam', aimable: true,
      startup: 10, active: 8, recovery: 16, cost: 3, desc: 'Aimable piercing lance across the stage.',
      hitboxes: [
        hb({ ox: 1.4, oy: 0, r: 0.4, dmg: 4, kbx: 0.28, kby: 0, scaling: 55, hitstun: 8, start: 10, end: 17 }),
        hb({ ox: 2.6, oy: 0, r: 0.4, dmg: 5, kbx: 0.34, kby: 0, scaling: 70, hitstun: 10, start: 10, end: 17 }),
        hb({ ox: 3.8, oy: 0, r: 0.4, dmg: 6, kbx: 0.42, kby: 0, scaling: 90, hitstun: 12, start: 10, end: 17 }),
      ],
    },
    nova: {
      id: 'nova', name: 'Nova', kind: 'special', icon: 'nova',
      startup: 12, active: 5, recovery: 20, cost: 3, desc: 'Panic-button blast — clears your space.',
      hitboxes: [hb({ ox: 0, oy: -0.3, r: 1.35, dmg: 16, kbx: 0.2, kby: -0.55, scaling: 130, hitstun: 18, start: 12, end: 16 })],
    },
    teleport: {
      id: 'teleport', name: 'Blink', kind: 'special', icon: 'teleport', invulnFrames: 12,
      startup: 4, active: 8, recovery: 10, cost: 2, desc: 'Invulnerable warp to reset spacing.',
      selfMotion: [{ atTick: 4, velocity: { x: FX(-1.3), y: FX(-0.3) } }],
      hitboxes: [],
    },
  },
);

// ============================ GRIP — Grappler ============================
const grip = mk(
  {
    id: 'grip', name: 'GRIP', archetype: 'Grappler', color: 0x4dff8c, shape: 'grappler',
    blurb: 'A close-range monster. Command grabs and slams that end stocks shockingly early — if you can corner them.',
    walk: 160, air: 126, jump: -1050, dash: 414, gravity: 100, weight: 132, radius: 0.7, fastFall: 240,
  },
  {
    jab: {
      id: 'jab', name: 'Clothesline', kind: 'attack', icon: 'swipe',
      startup: 4, active: 3, recovery: 9, cost: 1, desc: 'Sturdy poke to stuff approaches.',
      hitboxes: [hb({ ox: 0.82, oy: -0.1, r: 0.56, dmg: 6, kbx: 0.22, kby: -0.1, scaling: 30, hitstun: 8, start: 4, end: 6 })],
    },
    headbutt: {
      id: 'headbutt', name: 'Headbutt', kind: 'attack', icon: 'fist',
      startup: 5, active: 3, recovery: 10, cost: 1, desc: 'Fast armored-feeling lunge poke.',
      selfMotion: [{ atTick: 5, velocity: { x: FX(0.3), y: 0 } }],
      hitboxes: [hb({ ox: 0.7, oy: -0.3, r: 0.5, dmg: 7, kbx: 0.28, kby: -0.16, scaling: 55, hitstun: 10, start: 5, end: 7 })],
    },
    grab: {
      id: 'grab', name: 'Snatch', kind: 'grab', icon: 'grab',
      startup: 6, active: 3, recovery: 20, cost: 2, desc: 'Command grab — beats shields, big KB.',
      hitboxes: [hb({ ox: 0.7, oy: -0.2, r: 0.5, dmg: 10, kbx: 0.3, kby: -0.36, scaling: 100, hitstun: 18, start: 6, end: 8 })],
    },
    suplex: {
      id: 'suplex', name: 'Suplex', kind: 'special', icon: 'suplex',
      startup: 7, active: 3, recovery: 18, cost: 2, desc: 'Throws foes straight up for juggles.',
      hitboxes: [hb({ ox: 0.6, oy: -0.45, r: 0.6, dmg: 11, kbx: 0.1, kby: -0.62, scaling: 96, hitstun: 15, start: 7, end: 9 })],
    },
    lariat: {
      id: 'lariat', name: 'Lariat', kind: 'special', icon: 'spin',
      startup: 8, active: 6, recovery: 16, cost: 3, desc: 'Spinning double-arm KO blow.',
      hitboxes: [hb({ ox: 0.92, oy: -0.15, r: 0.82, dmg: 14, kbx: 0.56, kby: -0.2, scaling: 116, hitstun: 16, start: 8, end: 13 })],
    },
    stomp: {
      id: 'stomp', name: 'Sumo Stomp', kind: 'attack', icon: 'stomp',
      startup: 6, active: 4, recovery: 12, cost: 1, desc: 'Low stomp, catches rolls and dodges.',
      hitboxes: [hb({ ox: 0.55, oy: 0.25, r: 0.62, dmg: 8, kbx: 0.16, kby: -0.2, scaling: 48, hitstun: 11, start: 6, end: 9 })],
    },
    splash: {
      id: 'splash', name: 'Body Splash', kind: 'attack', icon: 'dive', airOnly: true,
      startup: 5, active: 8, recovery: 12, cost: 2, desc: 'Aerial crush from above.',
      selfMotion: [{ atTick: 5, velocity: { x: FX(0.2), y: FX(0.7) } }],
      hitboxes: [hb({ ox: 0, oy: 0.35, r: 0.85, dmg: 12, kbx: 0.18, kby: 0.3, scaling: 90, hitstun: 14, start: 5, end: 12 })],
    },
    giantswing: {
      id: 'giantswing', name: 'Giant Swing', kind: 'grab', icon: 'spin',
      startup: 9, active: 4, recovery: 22, cost: 3, desc: 'Command grab launch — ends stocks early.',
      hitboxes: [hb({ ox: 0.65, oy: -0.1, r: 0.55, dmg: 13, kbx: 0.6, kby: -0.34, scaling: 132, hitstun: 18, start: 9, end: 12 })],
    },
    risinglariat: {
      id: 'risinglariat', name: 'Rising Lariat', kind: 'special', icon: 'rocket',
      startup: 6, active: 6, recovery: 18, cost: 2, desc: 'Rising spin — your only recovery.',
      selfMotion: [{ atTick: 6, velocity: { x: 0, y: FX(-0.95) } }],
      hitboxes: [hb({ ox: 0.4, oy: -0.4, r: 0.7, dmg: 9, kbx: 0.2, kby: -0.5, scaling: 84, hitstun: 13, start: 6, end: 11 })],
    },
  },
);

export const CHARACTERS: Record<string, CharacterDef> = { titan, razor, arc, grip };

export const ROSTER: string[] = ['titan', 'razor', 'arc', 'grip'];

/** Default 3-character dynasty presets per player slot. */
export const DEFAULT_DYNASTIES: string[][] = [
  ['titan', 'razor', 'arc'],
  ['razor', 'grip', 'titan'],
  ['arc', 'titan', 'grip'],
  ['grip', 'arc', 'razor'],
];
