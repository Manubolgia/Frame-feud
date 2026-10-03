/**
 * GRIP — grappler. A pro wrestler: command grabs that beat blocking,
 * armored strikes, and a running grab that closes distance. One correct
 * read takes a third of your health.
 *
 * Arm angles are relative to the upper spine (torso + chest): a hand aimed
 * straight ahead needs fs = 90 - torso - chest.
 */

import { character } from './build';
import { NEUTRAL, P, strike } from './poses';

// Wrestler's crouch: wide and low, both hands open and forward to tie up.
const st = P(NEUTRAL, {
  torso: 26, chest: 8, head: -22,
  fs: 50, fe: 34, fw: -10,
  bs: 42, be: 42, bw: -10,
  fh: 40, fk: 54,
  bh: -30, bk: 40,
});

const chopWind = P(st, { torso: 12, chest: 4, head: -14, fs: 156, fe: 70, fw: 0, bs: 40, be: 70, fh: 34, fk: 44, sq: -0.03 });
const chopHit = P(st, { torso: 30, chest: 8, head: -26, fs: 34, fe: 6, fw: 6, bs: 20, be: 80, fh: 46, fk: 44, bh: -36, bk: 26, dx: 0.04, sq: 0.02 });

const headWind = P(st, { torso: -16, chest: -10, head: -24, fs: -30, fe: 90, bs: -20, be: 90, fh: 30, fk: 40, bh: -34, bk: 30, dx: -0.04, sq: -0.04 });
const headHit = P(st, { torso: 48, chest: 16, head: 26, fs: -40, fe: 50, bs: -50, be: 50, fh: 56, fk: 44, bh: -40, bk: 8, dx: 0.09, sq: 0.03 });

const lariatPose = P(st, { torso: 4, chest: 0, head: -6, fs: 90, fe: 0, fw: 0, bs: 90, be: 0, bw: 0, fh: 26, fk: 26, bh: -26, bk: 26 });

const air = P(NEUTRAL, { torso: 14, chest: 8, head: -14, fs: 60, fe: 60, fw: -10, bs: 50, be: 60, fh: 60, fk: 90, bh: 20, bk: 90, fa: 10, ba: 10 });
const check = P(air, { torso: 36, chest: 12, head: -10, fs: 36, fe: 126, bs: 40, be: 110, fh: 30, fk: 60, bh: -20, bk: 70 });
const crouchSpring = P(st, { torso: 40, chest: 10, head: -30, fs: -20, fe: 40, bs: -30, be: 40, fh: 80, fk: 120, bh: 20, bk: 110, sq: -0.1 });
const leapRise = P(air, { torso: 0, chest: -6, head: -20, fs: 160, fe: 10, bs: 150, be: 10, fh: 30, fk: 40, bh: -20, bk: 50, sq: 0.06 });
const splash = P(air, { torso: 40, chest: 10, head: -20, fs: 130, fe: 10, bs: 120, be: 10, fh: 60, fk: 50, bh: 20, bk: 70, rot: 30 });
const elbow = P(air, { torso: 50, chest: 12, head: 10, fs: -54, fe: 158, bs: 30, be: 110, fh: 70, fk: 90, bh: 30, bk: 100 });

const reach = P(st, { torso: 26, chest: 6, head: -22, fs: 58, fe: 8, fw: -16, bs: 52, be: 14, bw: -16, fh: 50, fk: 44, bh: -36, bk: 22, dx: 0.06 });
const hold = P(st, { torso: 14, chest: 6, fs: 70, fe: 50, bs: 64, be: 56 });
const lift = P(st, { torso: -40, chest: -20, head: -30, fs: 180, fe: 20, bs: 176, be: 20, fh: 24, fk: 20, bh: -30, bk: 30, dx: -0.05 });
const drive = P(st, { torso: 50, chest: 16, head: 0, fs: 100, fe: 20, bs: 94, be: 20, fh: 76, fk: 110, bh: 20, bk: 106, sq: -0.08 });
const rush = P(st, { torso: 44, chest: 6, head: -34, fs: 40, fe: 20, fw: -10, bs: 34, be: 24, bw: -10, fh: 66, fk: 64, bh: -42, bk: 72, dx: 0.06 });
const longReach = P(reach, { torso: 34, chest: 6, fs: 50, fe: 4, bs: 46, be: 10, fh: 60, fk: 50, bh: -44, bk: 12, dx: 0.12 });
const stompUp = P(st, { torso: -6, chest: -6, head: -16, fs: 160, fe: 40, bs: 150, be: 40, fh: 112, fk: 70, bh: -10, bk: 10, sq: 0.04 });
const stompDown = P(st, { torso: 36, chest: 10, head: -6, fs: 40, fe: 20, bs: 30, be: 20, fh: 54, fk: 60, bh: -26, bk: 40, sq: -0.08 });

export const GRIP = character({
  id: 'grip',
  name: 'GRIP',
  title: 'The Iron Clinch',
  archetype: 'Grappler',
  blurb: 'Command grabs that blow straight through blocking, armored headbutts, and a running grab. Wins on reads, loses when kept out.',
  color: 0x5dff8a,
  palettes: [
    [0x5dff8a, 0x123a1f, 0xd6ffe2],
    [0xff5d5d, 0x3a1212, 0xffd6d6],
    [0x5db8ff, 0x12263a, 0xd6ecff],
    [0xffb85d, 0x3a2812, 0xffeed6],
  ],
  hp: 1250,
  walk: 3.0,
  dash: 12,
  backdash: 9,
  jump: 12.5,
  airSpeed: 5,
  gravity: 0.6,
  maxFall: 14,
  fastFall: 16,
  airJumps: 1,
  airDashes: 1,
  airDash: 12,
  width: 24,
  height: 118,
  kbMul: 90,
  ratings: { power: 5, speed: 2, range: 1, defense: 4, mobility: 3 },
  difficulty: 2,
  build: { height: 118, leg: 0.43, torso: 0.33, arm: 0.45, head: 0.09, limbW: 12, torsoW: 28, kit: 'grip' },
  stance: st,
  poses: {
    dash: rush,
    walkA: P(st, { fh: 54, fk: 44, bh: -40, bk: 50 }),
    walkB: P(st, { fh: 22, fk: 64, bh: -14, bk: 24 }),
    apex: air,
    guard: P(st, { torso: 14, chest: 16, head: 6, fs: 58, fe: 120, bs: 50, be: 126, fh: 30, fk: 40, bh: -26, bk: 30, dx: -0.02 }),
    victory: P(st, { torso: -2, chest: -8, head: -14, fs: 170, fe: 60, fw: 0, bs: 170, be: 60, bw: 0, fh: 26, fk: 20, bh: -26, bk: 20 }),
  },
  projectiles: [
    {
      id: 'quake', name: 'Shockwave', r: 76, life: 6, activeTo: 2, floorStop: false, wallStop: false, look: 'shock',
      hit: { dmg: 30, hitstun: 22, blockstun: 10, kb: [5, -6], radial: true, otg: true, groundOnly: true, fx: 'heavy' },
    },
    {
      id: 'tectonic', name: 'Tectonic Wave', r: 320, life: 10, activeTo: 5, floorStop: false, wallStop: false, look: 'wave',
      hit: { dmg: 230, hitstun: 44, kb: [8, -15], radial: true, unblockable: true, groundOnly: true, hitlag: 20, fx: 'blast' },
    },
  ],
  moves: [
    {
      id: 'jab', name: 'Chop', cat: 'attack', icon: 'chop', total: 18, where: 'ground', cancelOnHit: 9,
      desc: 'A short, heavy knife-hand chop. Cancels on hit, often into a grab.',
      hitboxes: [{ f0: 5, f1: 7, x: 0, y: 0, r: 26, bone: 'fHand', dmg: 44, hitstun: 16, blockstun: 12, kb: [4, 0], fx: 'medium' }],
      anim: strike(5, 3, 18, chopWind, chopHit, { ready: st, windAt: 3, trail: { limb: 'fa', f0: 5, f1: 7 }, open: [0, 18] }),
    },
    {
      id: 'headbutt', name: 'Headbutt', cat: 'attack', icon: 'headbutt', total: 32, where: 'ground', armor: [3, 9, 1],
      motion: [{ f: 7, vx: 6 }],
      desc: 'Armored lunging headbutt (absorbs one hit).',
      hitboxes: [{ f0: 10, f1: 12, x: 0, y: 0, r: 28, bone: 'head', dmg: 78, hitstun: 24, blockstun: 13, kb: [9, -5], fx: 'heavy' }],
      anim: strike(10, 3, 32, headWind, headHit, { ready: st, windAt: 6, trail: { limb: 'head', f0: 10, f1: 12 } }),
    },
    {
      id: 'lariat', name: 'Lariat', cat: 'attack', icon: 'lariat', total: 40, where: 'ground',
      desc: 'Spinning clothesline with both arms out: hits both sides. Big reward, big risk on block.',
      hitboxes: [
        { f0: 9, f1: 16, x: 52, y: -78, r: 44, dmg: 82, hitstun: 28, blockstun: 14, kb: [10, -9], fx: 'heavy' },
        { f0: 9, f1: 16, x: -52, y: -78, r: 44, dmg: 82, hitstun: 28, blockstun: 14, kb: [-10, -9], fx: 'heavy' },
      ],
      anim: { keys: [[0, st, 'out'], [6, P(st, { torso: 10, fs: 70, fe: 30, bs: 60, be: 30, sq: -0.04 }), 'in'], [8, lariatPose, 'lin'], [17, lariatPose, 'io'], [28, st, 'lin'], [40, st, 'lin']], spin: { f0: 8, f1: 17, deg: 360 }, trail: { limb: 'fa', f0: 9, f1: 16 } },
    },
    {
      id: 'bodycheck', name: 'Body Check', cat: 'attack', icon: 'airkick', total: 22, where: 'air', landLag: 6,
      desc: 'A shoulder-first aerial tackle.',
      hitboxes: [{ f0: 6, f1: 10, x: 34, y: -54, r: 42, dmg: 54, hitstun: 20, blockstun: 12, kb: [7, -3], fx: 'medium' }],
      anim: strike(6, 5, 22, P(air, { torso: -10, chest: -6 }), check, { ready: air, windAt: 3 }),
    },
    {
      id: 'leap', name: 'Giant Leap', cat: 'special', icon: 'leap', total: 80, where: 'ground', script: 'leap', land: 'lag', landLag: 12,
      sp: { at: 6, jump: 15, air: 8 }, landSpawn: 'quake',
      desc: 'Leap where you aim and come down with a body splash that shakes the ground.',
      param: { dir: { kind: 'up', def: [60, -80], min: 30 } },
      hitboxes: [{ f0: 20, f1: 79, x: 10, y: -30, r: 48, dmg: 84, hitstun: 30, blockstun: 14, kb: [5, 6], groundBounce: true, fx: 'heavy' }],
      anim: { keys: [[0, st, 'out'], [5, crouchSpring, 'in'], [6, leapRise, 'out'], [18, air, 'io'], [22, splash, 'lin']] },
    },
    {
      id: 'elbowdrop', name: 'Elbow Drop', cat: 'special', icon: 'elbow', total: 60, where: 'air', script: 'dive', landLag: 12,
      sp: { start: 6, speed: 16 },
      desc: 'Drop elbow-first. Hits fighters lying on the floor and spikes airborne ones.',
      param: { dir: { kind: 'down', def: [0, 100], min: 60 } },
      hitboxes: [{ f0: 6, f1: 59, x: 0, y: 0, r: 30, bone: 'fElbow', dmg: 70, hitstun: 26, blockstun: 12, kb: [3, 5], otg: true, groundBounce: true, fx: 'heavy' }],
      anim: { keys: [[0, air, 'out'], [5, P(elbow, { fs: 120, fe: 120 }), 'in'], [6, elbow, 'lin']] },
    },
    {
      id: 'grab', name: 'Suplex', cat: 'attack', icon: 'grab', total: 28, where: 'ground',
      desc: 'Standard grab: a suplex that sends them high for a juggle. Beats Block, Parry and armor.',
      param: { dir: { kind: 'side', def: [100, 0] } },
      hitboxes: [{ f0: 5, f1: 6, x: 0, y: 0, r: 24, bone: 'fHand', kind: 'grab', throwMove: 'grip_suplex', dmg: 0, hitstun: 0, kb: [0, 0] }],
      anim: strike(5, 2, 28, P(st, { fs: 30, fe: 80, bs: 30, be: 80, sq: -0.03 }), reach, { ready: st, windAt: 3, open: [0, 28] }),
    },
    {
      id: 'grip_suplex', name: 'Suplex', cat: 'attack', icon: 'grab', total: 44, where: 'any', hidden: true, noTurn: true,
      desc: '',
      throw: { hold: [[0, 40, -10], [10, 20, -118], [20, 40, -30]], release: 20, hit: { dmg: 110, hitstun: 38, kb: [4, -12], fx: 'throw', hitlag: 12 } },
      anim: { keys: [[0, hold, 'io'], [10, lift, 'io'], [20, drive, 'out'], [28, drive, 'io'], [44, st, 'lin']], open: [0, 44] },
    },
    {
      id: 'gravitydrop', name: 'Gravity Drop', cat: 'special', icon: 'piledriver', total: 44, where: 'ground',
      desc: 'Lunging command grab with long reach: a piledriver for huge damage. Very slow to recover if it misses.',
      hitboxes: [{ f0: 7, f1: 9, x: 0, y: 0, r: 32, bone: 'fHand', kind: 'grab', throwMove: 'grip_pile', dmg: 0, hitstun: 0, kb: [0, 0] }],
      anim: strike(7, 3, 44, P(st, { torso: 30, fs: 20, fe: 60, bs: 10, be: 60, sq: -0.05 }), longReach, { ready: st, windAt: 4, open: [0, 44] }),
    },
    {
      id: 'grip_pile', name: 'Gravity Drop', cat: 'special', icon: 'piledriver', total: 56, where: 'any', hidden: true, noTurn: true,
      desc: '',
      throw: { hold: [[0, 50, -20], [14, 18, -150], [24, 12, -168], [32, 16, -10]], release: 32, hit: { dmg: 190, hitstun: 40, kb: [4, -6], knockdown: true, hitlag: 16, fx: 'heavy' } },
      anim: { keys: [[0, hold, 'io'], [14, lift, 'io'], [24, lift, 'in'], [32, drive, 'out'], [40, drive, 'io'], [56, st, 'lin']], open: [0, 56] },
    },
    {
      id: 'bullrush', name: 'Bull Rush', cat: 'special', icon: 'rush', total: 44, where: 'ground',
      motion: [{ f: 6, to: 22, vx: 12 }],
      desc: 'Charge forward and grab whatever you hit. Throw forward or back.',
      param: { dir: { kind: 'side', def: [100, 0] } },
      hitboxes: [{ f0: 6, f1: 22, x: 40, y: -60, r: 34, kind: 'grab', throwMove: 'grip_rush', dmg: 0, hitstun: 0, kb: [0, 0] }],
      anim: { keys: [[0, st, 'out'], [5, P(st, { torso: 34, sq: -0.05 }), 'in'], [6, rush, 'lin'], [22, rush, 'out'], [30, P(st, { torso: -4, fh: 50, fk: 8, bh: -8, bk: 66, dx: -0.04 }), 'io'], [44, st, 'lin']], open: [0, 44] },
    },
    {
      id: 'grip_rush', name: 'Bull Rush', cat: 'special', icon: 'rush', total: 40, where: 'any', hidden: true, noTurn: true,
      desc: '',
      throw: { hold: [[0, 40, 0], [10, 44, -24], [18, 40, -4]], release: 18, hit: { dmg: 120, hitstun: 32, kb: [10, -7], wallBounce: true, hitlag: 12, fx: 'heavy' } },
      anim: { keys: [[0, hold, 'io'], [10, lift, 'out'], [18, P(drive, { rot: 0, torso: 40 }), 'lin'], [26, drive, 'io'], [40, st, 'lin']], open: [0, 18] },
    },
    {
      id: 'atlas', name: 'Atlas Buster', cat: 'super', icon: 'super1', total: 40, where: 'ground', meter: 1000, superFlash: true,
      invuln: [{ f0: 0, f1: 8, vs: 'strike' }],
      desc: 'Lightning-fast long-range command grab into a meteor slam. 1 bar.',
      hitboxes: [{ f0: 4, f1: 8, x: 0, y: 0, r: 46, bone: 'fHand', kind: 'grab', throwMove: 'grip_atlas', dmg: 0, hitstun: 0, kb: [0, 0] }],
      anim: strike(4, 5, 40, P(st, { torso: 40, sq: -0.06 }), P(longReach, { dx: 0.16 }), { ready: st, windAt: 2, open: [0, 40] }),
    },
    {
      id: 'grip_atlas', name: 'Atlas Buster', cat: 'super', icon: 'super1', total: 70, where: 'any', hidden: true, noTurn: true,
      desc: '',
      motion: [{ f: 10, vy: -12 }, { f: 30, vy: 14 }],
      throw: { hold: [[0, 50, -10], [16, 0, -150], [34, 0, -160], [44, 30, 0]], release: 44, hit: { dmg: 300, hitstun: 50, kb: [6, -8], knockdown: true, hitlag: 22, fx: 'heavy' } },
      anim: { keys: [[0, hold, 'io'], [16, lift, 'io'], [34, lift, 'in'], [44, drive, 'out'], [54, drive, 'io'], [70, st, 'lin']], spin: { f0: 16, f1: 34, deg: 360 }, open: [0, 44] },
    },
    {
      id: 'tectonic', name: 'Tectonic', cat: 'super', icon: 'super2', total: 64, where: 'ground', meter: 2000, superFlash: true,
      armor: [0, 20, 99],
      desc: 'Armored stomp that splits the ground across most of the stage. Unblockable, but jumping avoids it. 2 bars.',
      spawns: [{ f: 20, proj: 'tectonic', x: 0, y: 0 }],
      anim: { keys: [[0, st, 'out'], [14, stompUp, 'in'], [20, stompDown, 'out'], [34, stompDown, 'io'], [64, st, 'lin']] },
    },
  ],
});
