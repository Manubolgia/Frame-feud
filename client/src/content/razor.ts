/**
 * RAZOR — rushdown ninja. The fastest fighter: two air jumps, two air
 * dashes, a teleport, a katana she draws for every cut and frame-tight
 * pressure. Light, so she flies far when hit.
 */

import { character } from './build';
import { G, NEUTRAL, P, strike, type AnimDef } from './poses';

// Low ninja guard: lead knife-hand forward, rear fist at the chest.
const st = P(NEUTRAL, {
  torso: 20, chest: 6, head: -16,
  fs: 62, fe: 34, fw: -12,
  bs: 26, be: 118,
  fh: 44, fk: 60,
  bh: -30, bk: 34,
  dx: 0.01,
});

// --- the cut: sword raised overhead behind, then a falling diagonal slash
const cutWind = P(st, { torso: 6, chest: -8, head: -8, fs: 172, fe: 36, fw: 16, bs: 50, be: 90, fh: 40, fk: 52, bh: -28, bk: 30, dx: -0.01, sq: -0.03 });
const cutHit = P(st, { torso: 28, chest: 10, head: -18, fs: 44, fe: 0, fw: -4, bs: -20, be: 60, fh: 58, fk: 42, bh: -38, bk: 14, dx: 0.06, sq: 0.03 });
const cutFollow = P(cutHit, { torso: 34, chest: 12, fs: 6, fe: 0, fw: -14, bs: -36, dx: 0.07 });

// --- stabs
const stabOut = P(st, { torso: 26, chest: 6, head: -16, fs: 60, fe: 0, fw: 0, bs: 10, be: 120, fh: 56, fk: 40, bh: -38, bk: 14, dx: 0.06 });
const stabIn = P(st, { torso: 22, chest: 6, fs: 40, fe: 26, fw: 0, bs: 20, be: 120, fh: 50, fk: 48, bh: -34, bk: 22, dx: 0.04 });

// --- kicks
const kickChamber = P(st, { torso: 8, chest: -4, head: -10, fs: 30, fe: 60, bs: -10, be: 70, fh: 82, fk: 116, fa: 20, bh: -16, bk: 16, dx: -0.01, sq: -0.04 });
const kickUp = P(st, { torso: -18, chest: -10, head: -12, fs: 34, fe: 40, bs: -46, be: 40, fh: 124, fk: 2, fa: 34, bh: -8, bk: 4, dx: 0.02, sq: 0.04 });
const kickTop = P(kickUp, { torso: -26, chest: -12, fh: 158, fk: 8, fs: 50, bs: -60 });

const sweepWind = P(st, { torso: 40, chest: 10, head: -26, fs: -10, fe: 20, bs: -40, be: 30, fh: 84, fk: 136, bh: 26, bk: 126, sq: -0.05 });
const sweepHit = P(st, { torso: 46, chest: 14, head: -36, fs: -24, fe: 10, fw: -30, bs: -60, be: 20, fh: 70, fk: 0, fa: -20, bh: 40, bk: 156 });
const sweepFollow = P(sweepHit, { fh: 62, torso: 42 });

// --- air
const air = P(NEUTRAL, { torso: 8, chest: 6, head: -10, fh: 64, fk: 100, bh: 20, bk: 96, fa: 20, ba: 20, fs: 80, fe: 70, bs: 40, be: 100 });
const airWind = P(air, { torso: -8, chest: -8, fs: 176, fe: 30, fw: 20 });
const airHit = P(air, { torso: 30, chest: 12, head: -20, fs: 30, fe: 0, fw: -10, bs: -30, be: 40, fh: 40, fk: 80, bh: -6, bk: 90 });
const airFollow = P(airHit, { fs: 4, fw: -16, torso: 34 });
const spinPose = P(air, { torso: 0, chest: 0, fs: 96, fe: 0, fw: 0, bs: 100, be: 0, fh: 50, fk: 70, bh: -20, bk: 70 });
const dive = P(NEUTRAL, { torso: -14, chest: -6, head: 4, fs: 156, fe: 20, bs: -50, be: 40, fh: 48, fk: 0, fa: 36, bh: -14, bk: 118, ba: 30, rot: 0 });

// --- throws and grabs
const reach = P(G.reach, { torso: 30, chest: 8, head: -16, fs: 54, fe: 6, fw: -14, bs: 40, be: 100, fh: 56, fk: 44, bh: -38, bk: 16, dx: 0.06 });
const throwBack = P(st, { torso: -8, chest: -8, head: -6, fs: 164, fe: 80, bs: 40, be: 90, fh: 34, fk: 30, bh: -26, bk: 20, dx: -0.02 });
const throwFwd = P(st, { torso: 26, chest: 8, head: -16, fs: 58, fe: 0, bs: -34, be: 40, fh: 52, fk: 40, bh: -38, bk: 14, dx: 0.05 });

// --- supers
const draw = P(st, { torso: 30, chest: 8, head: -22, fs: 168, fe: 60, fw: 20, bs: 70, be: 120, fh: 70, fk: 100, bh: -40, bk: 70, sq: -0.06 });
const iaido = P(st, { torso: 46, chest: 8, head: -30, fs: 40, fe: 0, fw: -6, bs: -60, be: 20, fh: 84, fk: 70, bh: -48, bk: 40, dx: 0.08 });

const shadowStep: AnimDef = {
  keys: [
    [0, st, 'out'],
    [5, P(st, { torso: 40, chest: 10, fh: 80, fk: 120, bh: 20, bk: 110, sq: -0.08 }), 'snap'],
    [13, P(st, { torso: 34, chest: 10, fh: 70, fk: 104, bh: 10, bk: 90, sq: -0.04 }), 'out'],
    [24, st, 'lin'],
  ],
};

export const RAZOR = character({
  id: 'razor',
  name: 'RAZOR',
  title: 'The Quiet Edge',
  archetype: 'Rushdown',
  blurb: 'Blistering speed, two air jumps, two air dashes and a teleport. Gets in, never lets go, and dies early if she guesses wrong.',
  color: 0x2ee6ff,
  palettes: [
    [0x2ee6ff, 0x13303f, 0xc8fbff],
    [0xff4f7b, 0x3a0f1d, 0xffd0dc],
    [0xeeeeee, 0x23262e, 0x9fd8ff],
    [0xa4ff5c, 0x1d3311, 0xe6ffd0],
  ],
  hp: 1000,
  walk: 4.0,
  dash: 14,
  backdash: 11,
  jump: 14.5,
  airSpeed: 6.5,
  gravity: 0.6,
  maxFall: 13,
  fastFall: 16,
  airJumps: 2,
  airDashes: 2,
  airDash: 14,
  width: 18,
  height: 104,
  kbMul: 112,
  ratings: { power: 2, speed: 5, range: 3, defense: 2, mobility: 5 },
  difficulty: 2,
  build: { height: 104, leg: 0.48, torso: 0.3, arm: 0.42, head: 0.1, limbW: 7, torsoW: 15, kit: 'razor' },
  stance: st,
  poses: {
    dash: P(st, { torso: 52, chest: 2, head: -40, fs: -64, fe: 10, bs: -84, be: 10, fh: 78, fk: 74, bh: -48, bk: 96, dx: 0.06 }),
    walkA: P(st, { fh: 58, fk: 50, bh: -40, bk: 50 }),
    walkB: P(st, { fh: 20, fk: 70, bh: -6, bk: 18 }),
    apex: air,
    victory: P(st, { torso: 4, chest: -6, head: -10, fs: 172, fe: 6, fw: 0, bs: 30, be: 110, fh: 18, fk: 10, bh: -16, bk: 8 }),
  },
  projectiles: [
    {
      id: 'kunai', name: 'Kunai', r: 10, life: 50, clash: true, look: 'kunai',
      hit: { dmg: 26, hitstun: 17, blockstun: 10, kb: [4, -2], fx: 'slash' },
    },
  ],
  moves: [
    {
      id: 'jab', name: 'Quick Slash', cat: 'attack', icon: 'slash', total: 16, where: 'ground', cancelOnHit: 7, cancelOnBlock: 9,
      desc: 'Draw and cut in one motion: her fastest strike, with real sword reach. Cancels into anything on hit.',
      hitboxes: [
        { f0: 4, f1: 6, x: 0, y: 0, r: 22, bone: 'blade', dmg: 34, hitstun: 15, blockstun: 11, kb: [3.5, 0], fx: 'slash' },
        { f0: 4, f1: 6, x: 0, y: 0, r: 16, bone: 'tip', dmg: 34, hitstun: 15, blockstun: 11, kb: [3.5, 0], fx: 'slash' },
      ],
      anim: strike(4, 3, 16, cutWind, cutHit, { ready: st, follow: cutFollow, windAt: 2, trail: { limb: 'tip', f0: 4, f1: 6 }, prop: 'blade' }),
    },
    {
      id: 'flurry', name: 'Flurry', cat: 'attack', icon: 'flurry', total: 30, where: 'ground', cancelOnHit: 21,
      desc: 'Four quick stabs and a finishing cut. Safe on block.',
      hitboxes: [
        { f0: 6, f1: 15, x: 0, y: 0, r: 18, bone: 'tip', dmg: 12, hitstun: 16, blockstun: 9, kb: [1.6, 0], rehit: 3, maxHits: 4, group: 0, fx: 'slash' },
        { f0: 6, f1: 15, x: 0, y: 0, r: 20, bone: 'blade', dmg: 12, hitstun: 16, blockstun: 9, kb: [1.6, 0], rehit: 3, maxHits: 4, group: 0, fx: 'slash' },
        { f0: 17, f1: 19, x: 0, y: 0, r: 24, bone: 'blade', dmg: 30, hitstun: 22, blockstun: 12, kb: [7, -3], group: 1, fx: 'slash' },
      ],
      anim: {
        keys: [
          [0, st, 'out'], [4, stabIn, 'in'], [6, stabOut, 'lin'], [7, stabIn, 'lin'], [9, stabOut, 'lin'], [10, stabIn, 'lin'],
          [12, stabOut, 'lin'], [13, stabIn, 'lin'], [15, stabOut, 'out'], [16, cutWind, 'in'], [17, cutHit, 'out'], [20, cutFollow, 'io'], [30, st, 'lin'],
        ],
        trail: { limb: 'tip', f0: 6, f1: 19 },
        prop: 'blade',
      },
    },
    {
      id: 'risingkick', name: 'Rising Kick', cat: 'attack', icon: 'kickup', total: 28, where: 'ground', cancelOnHit: 14,
      desc: 'A snapping kick that sweeps straight up and launches. Cancel into a jump and keep the combo going.',
      hitboxes: [{ f0: 6, f1: 9, x: 0, y: 0, r: 24, bone: 'fFoot', dmg: 48, hitstun: 30, blockstun: 12, kb: [2, -13], fx: 'medium' }],
      anim: strike(6, 4, 28, kickChamber, kickUp, { ready: st, follow: kickTop, windAt: 3, trail: { limb: 'fl', f0: 6, f1: 9 } }),
    },
    {
      id: 'sweep', name: 'Sweep', cat: 'attack', icon: 'sweep', total: 30, where: 'ground', low: [3, 22],
      desc: 'Drop low and sweep the legs out: knocks down and ducks under high attacks.',
      hitboxes: [{ f0: 9, f1: 11, x: 0, y: 0, r: 24, bone: 'fFoot', dmg: 44, hitstun: 24, blockstun: 12, kb: [3, -5], knockdown: true, fx: 'medium' }],
      anim: strike(9, 3, 30, sweepWind, sweepHit, { ready: st, follow: sweepFollow, windAt: 5, recover: sweepWind, trail: { limb: 'fl', f0: 9, f1: 11 } }),
    },
    {
      id: 'aircut', name: 'Air Slash', cat: 'attack', icon: 'airslash', total: 18, where: 'air', landLag: 5, cancelOnHit: 9,
      desc: 'A falling cut in mid-air. Cancels on hit.',
      hitboxes: [
        { f0: 5, f1: 7, x: 0, y: 0, r: 24, bone: 'blade', dmg: 40, hitstun: 18, blockstun: 11, kb: [5, -3], fx: 'slash' },
        { f0: 5, f1: 7, x: 0, y: 0, r: 16, bone: 'tip', dmg: 40, hitstun: 18, blockstun: 11, kb: [5, -3], fx: 'slash' },
      ],
      anim: strike(5, 3, 18, airWind, airHit, { ready: air, follow: airFollow, windAt: 2, trail: { limb: 'tip', f0: 5, f1: 7 }, prop: 'blade' }),
    },
    {
      id: 'airspin', name: 'Air Spin', cat: 'attack', icon: 'spin', total: 24, where: 'air', landLag: 6,
      desc: 'Spin with the blade out, hitting all around three times.',
      hitboxes: [{ f0: 6, f1: 15, x: 0, y: -52, r: 54, dmg: 16, hitstun: 16, blockstun: 8, kb: [2, -5], rehit: 4, maxHits: 3, radial: true, fx: 'slash' }],
      anim: { keys: [[0, air, 'out'], [5, spinPose, 'lin'], [16, spinPose, 'io'], [24, air, 'lin']], spin: { f0: 5, f1: 16, deg: 720 }, trail: { limb: 'tip', f0: 6, f1: 15 }, prop: 'blade' },
    },
    {
      id: 'divekick', name: 'Dive Kick', cat: 'special', icon: 'dive', total: 50, where: 'air', script: 'dive', landLag: 10,
      bounceOnHit: true, sp: { start: 5, speed: 15, bounce: 8 },
      desc: 'Aim a diving kick. On hit she bounces off, ready to act again.',
      param: { dir: { kind: 'down', def: [70, 70], min: 30 } },
      hitboxes: [{ f0: 5, f1: 49, x: 0, y: 0, r: 22, bone: 'fFoot', dmg: 50, hitstun: 20, blockstun: 13, kb: [6, -4], fx: 'medium' }],
      anim: { keys: [[0, air, 'out'], [4, P(air, { fh: 80, fk: 130, torso: -10 }), 'in'], [5, dive, 'lin']], trail: { limb: 'fl', f0: 5, f1: 49 } },
    },
    {
      id: 'shadowstep', name: 'Shadow Step', cat: 'special', icon: 'teleport', total: 24, where: 'ground', script: 'teleport',
      hide: [6, 12], sp: { at: 13 }, invuln: [{ f0: 5, f1: 14, vs: 'all' }],
      desc: 'Vanish and reappear up to 240px away. Crosses up opponents.',
      param: { dir: { kind: 'side', def: [100, 0] }, amt: { min: 60, max: 240, def: 160, label: 'Distance', unit: 'px' } },
      anim: shadowStep,
    },
    {
      id: 'kunai', name: 'Kunai', cat: 'special', icon: 'kunai', total: 26, where: 'any', land: 'end', limitProj: 'kunai',
      desc: 'Throw a fast blade in any direction. One in flight at a time.',
      param: { dir: { kind: 'aim', def: [100, 0] } },
      spawns: [{ f: 9, proj: 'kunai', x: 34, y: -64, speed: 17, aim: true }],
      anim: strike(9, 2, 26, throwBack, throwFwd, { ready: st, windAt: 5, trail: { limb: 'fa', f0: 8, f1: 10 }, aim: { f0: 9, f1: 16 }, open: [9, 18] }),
    },
    {
      id: 'grab', name: 'Snatch', cat: 'attack', icon: 'grab', total: 26, where: 'ground',
      desc: 'Grab and throw, forward or back. Beats Block, Parry and armor; loses to any strike.',
      param: { dir: { kind: 'side', def: [100, 0] } },
      hitboxes: [{ f0: 4, f1: 5, x: 0, y: 0, r: 20, bone: 'fHand', kind: 'grab', throwMove: 'razor_throw', dmg: 0, hitstun: 0, kb: [0, 0] }],
      anim: strike(4, 2, 26, P(st, { fs: 40, fe: 90, torso: 14, sq: -0.03 }), reach, { ready: st, windAt: 2, open: [2, 12] }),
    },
    {
      id: 'razor_throw', name: 'Snatch Throw', cat: 'attack', icon: 'grab', total: 30, where: 'any', hidden: true, noTurn: true,
      desc: '',
      throw: { hold: [[0, 34, 0], [10, 40, -30], [16, 22, -72]], release: 16, hit: { dmg: 80, hitstun: 32, kb: [7, -11], fx: 'throw', hitlag: 10 } },
      anim: { keys: [[0, G.hold, 'io'], [10, G.heave, 'out'], [16, G.toss, 'lin'], [22, G.toss, 'io'], [30, st, 'lin']], open: [0, 16] },
    },
    {
      id: 'thousandcuts', name: 'Thousand Cuts', cat: 'super', icon: 'super1', total: 52, where: 'ground', meter: 1000, superFlash: true,
      desc: 'Invulnerable rush that carries them across the stage, then a wall-bouncing finisher. 1 bar.',
      invuln: [{ f0: 0, f1: 10, vs: 'all' }],
      motion: [{ f: 8, to: 20, vx: 22 }, { f: 21, vx: 2 }],
      hitboxes: [
        { f0: 8, f1: 20, x: 26, y: -58, r: 48, dmg: 22, hitstun: 30, blockstun: 10, chip: 20, kb: [2, -1], rehit: 3, maxHits: 4, group: 0, fx: 'slash' },
        { f0: 24, f1: 26, x: 0, y: 0, r: 34, bone: 'blade', dmg: 90, hitstun: 40, blockstun: 16, chip: 20, kb: [11, -10], wallBounce: true, group: 1, fx: 'heavy', hitlag: 16 },
      ],
      anim: {
        keys: [[0, st, 'out'], [6, draw, 'snap'], [8, iaido, 'lin'], [20, iaido, 'out'], [23, cutWind, 'in'], [24, cutHit, 'out'], [32, cutFollow, 'io'], [52, st, 'lin']],
        trail: { limb: 'tip', f0: 8, f1: 26 },
        prop: 'blade',
      },
    },
    {
      id: 'finaldraw', name: 'Final Draw', cat: 'super', icon: 'super2', total: 60, where: 'ground', meter: 2000, superFlash: true,
      script: 'teleport', hide: [6, 17], sp: { at: 18, behind: 1, dist: 72 },
      desc: 'Vanish, reappear behind them and cut once. Huge damage. 2 bars.',
      invuln: [{ f0: 0, f1: 21, vs: 'all' }],
      hitboxes: [
        { f0: 22, f1: 25, x: 0, y: 0, r: 40, bone: 'blade', dmg: 240, hitstun: 44, blockstun: 20, chip: 25, kb: [12, -12], fx: 'heavy', hitlag: 20 },
        { f0: 22, f1: 25, x: 0, y: 0, r: 26, bone: 'tip', dmg: 240, hitstun: 44, blockstun: 20, chip: 25, kb: [12, -12], fx: 'heavy', hitlag: 20 },
      ],
      anim: {
        keys: [[0, st, 'out'], [5, draw, 'snap'], [18, draw, 'lin'], [21, draw, 'in'], [22, cutHit, 'out'], [26, cutFollow, 'out'], [34, iaido, 'io'], [60, st, 'lin']],
        trail: { limb: 'tip', f0: 22, f1: 25 },
        prop: 'blade',
      },
    },
  ],
});
