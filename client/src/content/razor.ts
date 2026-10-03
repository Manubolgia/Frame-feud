/**
 * RAZOR — rushdown. The fastest fighter: two air jumps, two air dashes, a
 * teleport, and frame-tight pressure. Light, so she flies far when hit.
 */

import { character } from './build';
import { G, L, P, strike, type AnimDef } from './poses';

const st = P(L.stance, {
  torso: 16, head: -8,
  fs: 74, fe: 84, bs: 18, be: 124,
  fh: 36, fk: 48, bh: -26, bk: 34,
});

const raise = P(st, { fs: 165, fe: 36, torso: 2, bs: 10 });
const cut = P(st, { fs: 82, fe: 0, torso: 24, head: 0, fh: 46, fk: 34, bh: -32, bk: 20, bs: -30, be: 60, dx: 0.05 });
const stabA = P(st, { fs: 94, fe: 0, bs: 40, be: 130, torso: 20, dx: 0.04 });
const stabB = P(st, { fs: 46, fe: 120, bs: 94, be: 0, torso: 22, dx: 0.05 });
const kickHigh = P(st, { torso: -28, head: -12, fh: 152, fk: 2, bh: -6, bk: 12, fs: 30, fe: 40, bs: -46, be: 30 });
const sweep = P(st, { torso: 38, head: 12, fh: 94, fk: 4, bh: 36, bk: 150, fs: 40, fe: 60, bs: 100, be: 30, dx: 0.02 });
const airCut = P(L.apex, { fs: 74, fe: 0, torso: 30, fh: 62, fk: 84, bh: 8, bk: 92, bs: -20 });
const dive = P(L.fall, { rot: 32, torso: 0, head: 10, fh: 26, fk: 0, bh: -34, bk: 112, fs: 120, fe: 30, bs: 150, be: 30 });
const throwBack = P(st, { fs: 168, fe: 84, torso: -10, bs: 40, be: 90 });
const throwFwd = P(st, { fs: 86, fe: 0, torso: 22, bs: -34, be: 40, dx: 0.04 });
const spinPose = P(L.apex, { fs: 100, fe: 0, bs: 100, be: 0, fh: 40, fk: 60, bh: -20, bk: 60, torso: 0 });
const draw = P(st, { fs: 12, fe: 150, torso: 26, bs: 20, be: 140, fh: 50, fk: 70, bh: -20, bk: 60 });
const iaido = P(L.dash, { fs: 104, fe: 0, torso: 42, head: -6, bs: -60, be: 20, dx: 0.08 });

const shadowStep: AnimDef = {
  keys: [
    [0, st, 'out'],
    [5, P(L.crouch, { torso: 34 }), 'snap'],
    [14, P(L.crouch, { torso: 20 }), 'io'],
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
  ratings: { power: 2, speed: 5, range: 2, defense: 2, mobility: 5 },
  difficulty: 2,
  build: { height: 104, leg: 0.48, torso: 0.3, arm: 0.42, head: 0.1, limbW: 7, torsoW: 15, kit: 'razor' },
  stance: st,
  projectiles: [
    {
      id: 'kunai', name: 'Kunai', r: 10, life: 50, clash: true, look: 'kunai',
      hit: { dmg: 26, hitstun: 17, blockstun: 10, kb: [4, -2], fx: 'slash' },
    },
  ],
  moves: [
    {
      id: 'jab', name: 'Quick Slash', cat: 'attack', icon: 'slash', total: 15, where: 'ground', cancelOnHit: 7, cancelOnBlock: 9,
      desc: 'Her fastest strike. Cancels into anything on hit.',
      hitboxes: [{ f0: 4, f1: 5, x: 42, y: -62, r: 30, dmg: 34, hitstun: 15, blockstun: 11, kb: [3.5, 0], fx: 'slash' }],
      anim: strike(4, 2, 15, raise, cut, { ready: st, trail: { limb: 'fa', f0: 4, f1: 5 }, prop: 'blade' }),
    },
    {
      id: 'flurry', name: 'Flurry', cat: 'attack', icon: 'flurry', total: 30, where: 'ground', cancelOnHit: 21,
      desc: 'Four quick stabs and a finishing cut. Safe on block.',
      hitboxes: [
        { f0: 6, f1: 15, x: 46, y: -60, r: 34, dmg: 12, hitstun: 16, blockstun: 9, kb: [1.6, 0], rehit: 3, maxHits: 4, group: 0, fx: 'slash' },
        { f0: 17, f1: 18, x: 50, y: -60, r: 36, dmg: 30, hitstun: 22, blockstun: 12, kb: [7, -3], group: 1, fx: 'slash' },
      ],
      anim: {
        keys: [
          [0, st, 'out'], [5, P(st, { fs: 40, fe: 140 }), 'snap'], [6, stabA, 'lin'], [8, stabB, 'lin'], [10, stabA, 'lin'],
          [12, stabB, 'lin'], [14, stabA, 'lin'], [16, raise, 'snap'], [17, cut, 'lin'], [21, cut, 'io'], [30, st, 'lin'],
        ],
        trail: { limb: 'fa', f0: 6, f1: 18 },
        prop: 'blade',
      },
    },
    {
      id: 'risingkick', name: 'Rising Kick', cat: 'attack', icon: 'kickup', total: 28, where: 'ground', cancelOnHit: 14,
      desc: 'Launches straight up. Cancel into a jump and keep the combo going.',
      hitboxes: [{ f0: 6, f1: 9, x: 30, y: -72, r: 36, dmg: 48, hitstun: 30, blockstun: 12, kb: [2, -13], fx: 'medium' }],
      anim: strike(6, 4, 28, P(L.crouch, { fs: 40, bs: 20 }), kickHigh, { ready: st, trail: { limb: 'fl', f0: 6, f1: 9 } }),
    },
    {
      id: 'sweep', name: 'Sweep', cat: 'attack', icon: 'sweep', total: 30, where: 'ground', low: [3, 22],
      desc: 'Low spinning sweep that knocks down. Ducks under high attacks.',
      hitboxes: [{ f0: 9, f1: 11, x: 54, y: -12, r: 30, dmg: 44, hitstun: 24, blockstun: 12, kb: [3, -5], knockdown: true, fx: 'medium' }],
      anim: strike(9, 3, 30, P(L.crouch, { torso: 30 }), sweep, { ready: st, trail: { limb: 'fl', f0: 9, f1: 11 } }),
    },
    {
      id: 'aircut', name: 'Air Slash', cat: 'attack', icon: 'airslash', total: 18, where: 'air', landLag: 5, cancelOnHit: 9,
      desc: 'Quick aerial cut. Cancels on hit.',
      hitboxes: [{ f0: 5, f1: 7, x: 40, y: -50, r: 36, dmg: 40, hitstun: 18, blockstun: 11, kb: [5, -3], fx: 'slash' }],
      anim: strike(5, 3, 18, P(L.apex, { fs: 170, fe: 30 }), airCut, { ready: L.apex, recover: L.fall, trail: { limb: 'fa', f0: 5, f1: 7 }, prop: 'blade' }),
    },
    {
      id: 'airspin', name: 'Air Spin', cat: 'attack', icon: 'spin', total: 24, where: 'air', landLag: 6,
      desc: 'Spin with blades out, hitting all around three times.',
      hitboxes: [{ f0: 6, f1: 15, x: 0, y: -52, r: 50, dmg: 16, hitstun: 16, blockstun: 8, kb: [2, -5], rehit: 4, maxHits: 3, radial: true, fx: 'slash' }],
      anim: { keys: [[0, L.apex, 'out'], [5, spinPose, 'lin'], [16, spinPose, 'io'], [24, L.fall, 'lin']], spin: { f0: 5, f1: 16, deg: 720 }, trail: { limb: 'fa', f0: 6, f1: 15 }, prop: 'blade' },
    },
    {
      id: 'divekick', name: 'Dive Kick', cat: 'special', icon: 'dive', total: 50, where: 'air', script: 'dive', landLag: 10,
      bounceOnHit: true, sp: { start: 5, speed: 15, bounce: 8 },
      desc: 'Aim a diving kick. On hit she bounces off, ready to act again.',
      param: { dir: { kind: 'down', def: [70, 70], min: 30 } },
      hitboxes: [{ f0: 5, f1: 49, x: 18, y: -8, r: 30, dmg: 50, hitstun: 20, blockstun: 13, kb: [6, -4], fx: 'medium' }],
      anim: { keys: [[0, L.apex, 'out'], [5, dive, 'lin']], trail: { limb: 'fl', f0: 5, f1: 49 } },
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
      spawns: [{ f: 9, proj: 'kunai', x: 30, y: -66, speed: 17, aim: true }],
      anim: strike(9, 2, 26, throwBack, throwFwd, { ready: st, trail: { limb: 'fa', f0: 8, f1: 10 }, aim: { f0: 8, f1: 16 } }),
    },
    {
      id: 'grab', name: 'Snatch', cat: 'attack', icon: 'grab', total: 26, where: 'ground',
      desc: 'Grab and throw, forward or back. Beats Block, Parry and armor; loses to any strike.',
      param: { dir: { kind: 'side', def: [100, 0] } },
      hitboxes: [{ f0: 4, f1: 5, x: 38, y: -60, r: 26, kind: 'grab', throwMove: 'razor_throw', dmg: 0, hitstun: 0, kb: [0, 0] }],
      anim: strike(4, 2, 26, P(st, { fs: 40, fe: 90 }), G.reach, { ready: st }),
    },
    {
      id: 'razor_throw', name: 'Snatch Throw', cat: 'attack', icon: 'grab', total: 30, where: 'any', hidden: true, noTurn: true,
      desc: '',
      throw: { hold: [[0, 34, 0], [10, 40, -30], [16, 22, -72]], release: 16, hit: { dmg: 80, hitstun: 32, kb: [7, -11], fx: 'throw', hitlag: 10 } },
      anim: { keys: [[0, G.hold, 'io'], [10, G.heave, 'out'], [16, G.toss, 'lin'], [22, G.toss, 'io'], [30, st, 'lin']] },
    },
    {
      id: 'thousandcuts', name: 'Thousand Cuts', cat: 'super', icon: 'super1', total: 52, where: 'ground', meter: 1000, superFlash: true,
      desc: 'Invulnerable rush that carries them across the stage, then a wall-bouncing finisher. 1 bar.',
      invuln: [{ f0: 0, f1: 10, vs: 'all' }],
      motion: [{ f: 8, to: 20, vx: 22 }, { f: 21, vx: 2 }],
      hitboxes: [
        { f0: 8, f1: 20, x: 20, y: -60, r: 46, dmg: 22, hitstun: 30, blockstun: 10, chip: 20, kb: [2, -1], rehit: 3, maxHits: 4, group: 0, fx: 'slash' },
        { f0: 24, f1: 26, x: 42, y: -60, r: 52, dmg: 90, hitstun: 40, blockstun: 16, chip: 20, kb: [11, -10], wallBounce: true, group: 1, fx: 'heavy', hitlag: 16 },
      ],
      anim: {
        keys: [[0, st, 'out'], [6, draw, 'snap'], [8, iaido, 'lin'], [20, iaido, 'out'], [23, raise, 'snap'], [24, cut, 'lin'], [32, cut, 'io'], [52, st, 'lin']],
        trail: { limb: 'fa', f0: 8, f1: 26 },
        prop: 'blade',
      },
    },
    {
      id: 'finaldraw', name: 'Final Draw', cat: 'super', icon: 'super2', total: 60, where: 'ground', meter: 2000, superFlash: true,
      script: 'teleport', hide: [6, 17], sp: { at: 18, behind: 1, dist: 72 },
      desc: 'Vanish, reappear behind them and cut once. Huge damage. 2 bars.',
      invuln: [{ f0: 0, f1: 21, vs: 'all' }],
      hitboxes: [{ f0: 22, f1: 25, x: 50, y: -60, r: 62, dmg: 240, hitstun: 44, blockstun: 20, chip: 25, kb: [12, -12], fx: 'heavy', hitlag: 20 }],
      anim: {
        keys: [[0, st, 'out'], [5, draw, 'snap'], [18, draw, 'lin'], [21, draw, 'snap'], [22, iaido, 'lin'], [32, iaido, 'io'], [60, st, 'lin']],
        trail: { limb: 'fa', f0: 22, f1: 25 },
        prop: 'blade',
      },
    },
  ],
});
