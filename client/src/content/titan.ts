/**
 * TITAN — heavy siege mech. Slow and enormous, with armored attacks that
 * walk through hits, lobbed missiles and the most health in the game.
 *
 * Arm angles are relative to the upper spine (torso + chest): a fist aimed
 * straight ahead needs fs = 90 - torso - chest.
 */

import { character } from './build';
import { G, NEUTRAL, P, strike } from './poses';

// Heavy guard: wide base, fists up at chin height, slight hunch.
const st = P(NEUTRAL, {
  torso: 10, chest: 10, head: -6,
  fs: 50, fe: 72, fw: 0,
  bs: 30, be: 90,
  fh: 22, fk: 20,
  bh: -24, bk: 16,
});

const jabWind = P(st, { torso: 4, chest: 6, fs: 30, fe: 112, bs: 50, be: 100, dx: -0.01, sq: -0.02 });
const jabHit = P(st, { torso: 18, chest: 8, head: -12, fs: 64, fe: 2, bs: 26, be: 120, fh: 32, fk: 24, bh: -30, bk: 10, dx: 0.04, sq: 0.02 });

const pistonWind = P(st, { torso: -6, chest: 0, head: 0, fs: -46, fe: 104, bs: 66, be: 96, fh: 18, fk: 30, bh: -32, bk: 22, dx: -0.04, sq: -0.04 });
const pistonHit = P(st, { torso: 30, chest: 6, head: -24, fs: 54, fe: 0, bs: -40, be: 60, fh: 56, fk: 44, bh: -40, bk: 6, dx: 0.08, sq: 0.03 });

const upWind = P(st, { torso: 30, chest: 10, head: -20, fs: -16, fe: 124, bs: 20, be: 90, fh: 70, fk: 100, bh: 10, bk: 90, sq: -0.06 });
// contact at chin height on the first active frame, then drive straight up
const upHit = P(st, { torso: 6, chest: -2, head: -20, fs: 118, fe: 14, bs: -20, be: 50, fh: 30, fk: 16, bh: -26, bk: 8, dx: 0.04, sq: 0.03 });
const upTop = P(upHit, { torso: -12, chest: -8, head: -26, fs: 194, fe: 4, fh: 18, fk: 6, sq: 0.06 });

const poundWind = P(st, { torso: -12, chest: -8, head: -16, fs: 186, fe: 40, bs: 176, be: 40, fh: 22, fk: 8, bh: -24, bk: 8, sq: 0.04 });
const poundHit = P(st, { torso: 52, chest: 14, head: 10, fs: -40, fe: 0, bs: -46, be: 0, fh: 74, fk: 104, bh: 18, bk: 100, sq: -0.08 });

const charge = P(st, { torso: 40, chest: 6, head: -30, fs: 30, fe: 40, bs: 60, be: 40, fh: 66, fk: 64, bh: -42, bk: 72, dx: 0.06 });
const launchWind = P(st, { torso: 20, chest: 10, head: -14, fs: 20, fe: 90, bs: 10, be: 90, fh: 40, fk: 50, bh: -20, bk: 30, sq: -0.04 });
const launchHit = P(st, { torso: -10, chest: -8, head: -26, fs: 150, fe: 10, bs: 40, be: 80, fh: 20, fk: 10, bh: -26, bk: 10, sq: 0.03 });

const air = P(NEUTRAL, { torso: 10, chest: 8, head: -6, fs: 60, fe: 90, bs: 40, be: 100, fh: 60, fk: 90, bh: 20, bk: 90, fa: 10, ba: 10 });
const slamPose = P(air, { torso: 6, chest: 4, fs: 190, fe: 10, bs: 184, be: 10, fh: 46, fk: 70, bh: 6, bk: 80 });
const slamDown = P(air, { torso: 24, chest: 10, head: -10, fs: 30, fe: 0, bs: 20, be: 0, fh: 30, fk: 40, bh: -10, bk: 60 });
const hammerWind = P(air, { torso: -12, chest: -8, fs: 186, fe: 40, bs: 176, be: 50 });
const hammerHit = P(air, { torso: 40, chest: 10, head: -14, fs: 8, fe: 0, bs: 0, be: 10, fh: 40, fk: 90, bh: 0, bk: 90 });

const reach = P(G.reach, { torso: 24, chest: 6, head: -16, fs: 60, fe: 10, fw: -16, bs: 54, be: 20, fh: 48, fk: 40, bh: -32, bk: 26, dx: 0.05 });
const hold = P(st, { torso: 10, chest: 6, fs: 70, fe: 40, bs: 60, be: 50 });
const heave = P(st, { torso: -24, chest: -10, head: -20, fs: 184, fe: 20, bs: 176, be: 26, fh: 26, fk: 14, bh: -32, bk: 12, dx: -0.03 });

const gigaWind = P(st, { torso: -20, chest: -6, head: -2, fs: -74, fe: 116, bs: 70, be: 100, fh: 14, fk: 30, bh: -36, bk: 22, dx: -0.06, sq: -0.05 });
const gigaHit = P(st, { torso: 36, chest: 10, head: -30, fs: 44, fe: 0, bs: -64, be: 50, fh: 60, fk: 46, bh: -44, bk: 4, dx: 0.11, sq: 0.04 });
const meltWind = P(st, { torso: 40, chest: 20, head: 30, fs: 120, fe: 160, bs: 120, be: 160, fh: 70, fk: 110, bh: 18, bk: 100, sq: -0.12 });
const meltHit = P(NEUTRAL, { torso: -10, chest: -14, head: -26, fs: 150, fe: 0, bs: 220, be: 0, fh: 34, fk: 0, bh: -34, bk: 0, sq: 0.06 });

export const TITAN = character({
  id: 'titan',
  name: 'TITAN',
  title: 'The Walking Siege',
  archetype: 'Heavy',
  blurb: 'A war machine with the most health in the game. Armored attacks walk straight through jabs, missiles land wherever he aims them, and every clean hit hurts.',
  color: 0xff7a3d,
  palettes: [
    [0xff7a3d, 0x3a1d10, 0xffd7a6],
    [0x8fa3b8, 0x1b232c, 0xd9f1ff],
    [0xffd23d, 0x3a2e0c, 0xfff2b0],
    [0xc04dff, 0x281133, 0xf0c8ff],
  ],
  hp: 1400,
  walk: 2.6,
  dash: 10.5,
  backdash: 8,
  jump: 13.5,
  airSpeed: 4.5,
  gravity: 0.62,
  maxFall: 15,
  fastFall: 17,
  airJumps: 1,
  airDashes: 1,
  airDash: 11,
  width: 26,
  height: 128,
  kbMul: 82,
  ratings: { power: 5, speed: 1, range: 3, defense: 5, mobility: 2 },
  difficulty: 1,
  build: { height: 128, leg: 0.44, torso: 0.33, arm: 0.44, head: 0.09, limbW: 13, torsoW: 30, kit: 'titan' },
  stance: st,
  poses: {
    dash: P(st, { torso: 34, chest: 8, head: -26, fs: 20, fe: 60, bs: 0, be: 60, fh: 60, fk: 60, bh: -40, bk: 66, dx: 0.05 }),
    walkA: P(st, { fh: 34, fk: 14, bh: -32, bk: 26, torso: 12 }),
    walkB: P(st, { fh: 4, fk: 30, bh: -10, bk: 8, torso: 8 }),
    guard: P(st, { torso: 6, chest: 14, head: 10, fs: 62, fe: 128, bs: 54, be: 134, fh: 24, fk: 30, bh: -26, bk: 24, dx: -0.02 }),
    apex: air,
    victory: P(st, { torso: -4, chest: -6, head: -14, fs: 176, fe: 30, bs: 30, be: 100, fh: 20, fk: 6, bh: -20, bk: 6 }),
  },
  projectiles: [
    {
      id: 'missile', name: 'Missile', r: 16, life: 160, gravity: 0.24, clash: true, look: 'missile',
      burstInto: 'blast', burstOnHit: true,
      hit: { dmg: 20, hitstun: 18, blockstun: 10, kb: [2, -4], fx: 'medium' },
    },
    {
      id: 'blast', name: 'Blast', r: 72, life: 7, activeTo: 3, floorStop: false, wallStop: false, look: 'blast',
      hit: { dmg: 55, hitstun: 26, blockstun: 14, kb: [6, -9], radial: true, fx: 'blast' },
    },
    {
      id: 'quake', name: 'Quake', r: 74, life: 6, activeTo: 2, floorStop: false, wallStop: false, look: 'shock',
      hit: { dmg: 30, hitstun: 20, blockstun: 10, kb: [5, -6], radial: true, otg: true, groundOnly: true, fx: 'heavy' },
    },
  ],
  moves: [
    {
      id: 'jab', name: 'Hammer Jab', cat: 'attack', icon: 'punch', total: 19, where: 'ground', cancelOnHit: 10,
      desc: 'A heavy but quick straight punch. Cancels on hit.',
      hitboxes: [{ f0: 6, f1: 8, x: 0, y: 0, r: 28, bone: 'fHand', dmg: 52, hitstun: 19, blockstun: 13, kb: [4.5, 0], fx: 'medium' }],
      anim: strike(6, 3, 19, jabWind, jabHit, { ready: st, windAt: 3, trail: { limb: 'fa', f0: 6, f1: 8 } }),
    },
    {
      id: 'piston', name: 'Piston', cat: 'attack', icon: 'piston', total: 34, where: 'ground', armor: [3, 10, 1],
      desc: 'Armored lunging haymaker (absorbs one hit). Wall-bounces. Unsafe on block.',
      motion: [{ f: 9, vx: 5 }, { f: 10, to: 13, vx: 3 }],
      hitboxes: [{ f0: 11, f1: 14, x: 0, y: 0, r: 32, bone: 'fHand', dmg: 105, hitstun: 26, blockstun: 14, kb: [11, -4], wallBounce: true, hitlag: 12, fx: 'heavy' }],
      anim: strike(11, 4, 34, pistonWind, pistonHit, { ready: st, windAt: 5, trail: { limb: 'fa', f0: 11, f1: 14 } }),
    },
    {
      id: 'skybreaker', name: 'Sky Breaker', cat: 'attack', icon: 'uppercut', total: 36, where: 'ground', armor: [4, 10, 1], cancelOnHit: 18,
      desc: 'Armored rising uppercut. Launches, and swats jumpers out of the air.',
      hitboxes: [{ f0: 10, f1: 13, x: 0, y: 0, r: 34, bone: 'fHand', dmg: 82, hitstun: 34, blockstun: 12, kb: [2, -14], fx: 'heavy' }],
      anim: strike(10, 4, 36, upWind, upHit, { ready: st, follow: upTop, windAt: 5, trail: { limb: 'fa', f0: 10, f1: 13 } }),
    },
    {
      id: 'pound', name: 'Ground Pound', cat: 'attack', icon: 'pound', total: 40, where: 'ground',
      desc: 'Smash the floor with both fists: the shockwave hits both sides and anyone lying down.',
      hitboxes: [{ f0: 14, f1: 17, x: 0, y: -14, r: 104, dmg: 80, hitstun: 32, blockstun: 16, kb: [6, -10], radial: true, otg: true, fx: 'heavy' }],
      anim: strike(14, 4, 40, poundWind, poundHit, { ready: st, windAt: 8 }),
    },
    {
      id: 'rocket', name: 'Rocket Charge', cat: 'special', icon: 'charge', total: 46, where: 'ground', armor: [4, 22, 2],
      desc: 'Thrusters on: an armored shoulder charge across the stage (absorbs two hits). Very unsafe on block.',
      motion: [{ f: 8, to: 22, vx: 14 }],
      hitboxes: [{ f0: 8, f1: 22, x: 40, y: -70, r: 44, dmg: 95, hitstun: 28, blockstun: 14, kb: [12, -6], wallBounce: true, fx: 'heavy' }],
      anim: { keys: [[0, st, 'out'], [6, P(st, { torso: 24, fs: 30, fe: 50, bs: 60, be: 40, sq: -0.06 }), 'in'], [8, charge, 'lin'], [22, charge, 'out'], [30, P(st, { torso: -6, fh: 50, fk: 8, bh: -8, bk: 66, dx: -0.04 }), 'io'], [46, st, 'lin']], power: [6, 24] },
    },
    {
      id: 'missile', name: 'Missile', cat: 'special', icon: 'missile', total: 34, where: 'ground', limitProj: 'missile',
      desc: 'Fire a missile from the backpack that comes down exactly where you set the range, then explodes.',
      param: { amt: { min: 80, max: 720, def: 300, label: 'Range', unit: 'px' } },
      spawns: [{ f: 14, proj: 'missile', x: -14, y: -132, lob: { t0: 26, perPx: 15 } }],
      anim: strike(14, 2, 34, launchWind, launchHit, { ready: st, windAt: 8, power: [12, 18] }),
    },
    {
      id: 'dropslam', name: 'Drop Slam', cat: 'special', icon: 'slam', total: 60, where: 'air', script: 'dive', landLag: 14,
      sp: { start: 8, speed: 17 }, landSpawn: 'quake',
      desc: 'Crash down from the air. Spikes airborne foes into a bounce; shakes the ground on landing.',
      param: { dir: { kind: 'down', def: [10, 100], min: 60 } },
      hitboxes: [{ f0: 8, f1: 59, x: 0, y: -16, r: 44, dmg: 85, hitstun: 28, blockstun: 14, kb: [3, 8], groundBounce: true, fx: 'heavy' }],
      anim: { keys: [[0, air, 'out'], [7, slamPose, 'in'], [8, slamDown, 'lin']], power: [0, 59] },
    },
    {
      id: 'airhammer', name: 'Air Hammer', cat: 'attack', icon: 'hammer', total: 24, where: 'air', landLag: 8,
      desc: 'Double-fisted aerial smash that spikes foes into a ground bounce.',
      hitboxes: [{ f0: 7, f1: 10, x: 0, y: 0, r: 32, bone: 'fHand', dmg: 64, hitstun: 22, blockstun: 12, kb: [5, 6], groundBounce: true, fx: 'heavy' }],
      anim: strike(7, 4, 24, hammerWind, hammerHit, { ready: air, windAt: 4, trail: { limb: 'fa', f0: 7, f1: 10 } }),
    },
    {
      id: 'grab', name: 'Crusher', cat: 'attack', icon: 'grab', total: 32, where: 'ground',
      desc: 'Grab and slam them into the floor for a bounce. Beats Block, Parry and armor.',
      param: { dir: { kind: 'side', def: [100, 0] } },
      hitboxes: [{ f0: 6, f1: 7, x: 0, y: 0, r: 26, bone: 'fHand', kind: 'grab', throwMove: 'titan_throw', dmg: 0, hitstun: 0, kb: [0, 0] }],
      anim: strike(6, 2, 32, P(st, { fs: 20, fe: 100, torso: 4, sq: -0.03 }), reach, { ready: st, windAt: 3, open: [3, 12] }),
    },
    {
      id: 'titan_throw', name: 'Crusher Slam', cat: 'attack', icon: 'grab', total: 40, where: 'any', hidden: true, noTurn: true,
      desc: '',
      throw: { hold: [[0, 46, -10], [12, 36, -100], [22, 34, -16]], release: 22, hit: { dmg: 125, hitstun: 30, kb: [4, 10], groundBounce: true, hitlag: 14, fx: 'throw' } },
      anim: { keys: [[0, hold, 'io'], [12, heave, 'in'], [22, poundHit, 'out'], [28, poundHit, 'io'], [40, st, 'lin']], open: [0, 22] },
    },
    {
      id: 'gigaton', name: 'Gigaton', cat: 'super', icon: 'super1', total: 54, where: 'ground', meter: 1000, superFlash: true,
      armor: [0, 18, 99],
      desc: 'Fully armored mega-punch. Shrugs off everything but grabs. 1 bar.',
      motion: [{ f: 14, vx: 8 }, { f: 15, to: 19, vx: 4 }],
      hitboxes: [{ f0: 16, f1: 20, x: 0, y: 0, r: 46, bone: 'fHand', dmg: 230, hitstun: 40, blockstun: 22, chip: 20, kb: [16, -8], wallBounce: true, hitlag: 20, fx: 'heavy' }],
      anim: strike(16, 5, 54, gigaWind, gigaHit, { ready: st, windAt: 6, trail: { limb: 'fa', f0: 16, f1: 20 }, power: [6, 20] }),
    },
    {
      id: 'meltdown', name: 'Meltdown', cat: 'super', icon: 'super2', total: 66, where: 'ground', meter: 2000, superFlash: true,
      desc: 'Reactor overload: a huge invulnerable blast all around. 2 bars.',
      invuln: [{ f0: 0, f1: 18, vs: 'all' }],
      hitboxes: [{ f0: 18, f1: 24, x: 0, y: -60, r: 190, dmg: 290, hitstun: 44, blockstun: 24, chip: 25, kb: [12, -16], radial: true, hitlag: 22, fx: 'blast' }],
      anim: { keys: [[0, st, 'out'], [12, meltWind, 'in'], [18, meltHit, 'out'], [30, meltHit, 'io'], [66, st, 'lin']], power: [0, 30] },
    },
  ],
});
