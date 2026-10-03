/**
 * GRIP — grappler. Command grabs that beat blocking, armored strikes, and
 * a running grab that closes distance. One correct read takes a third of
 * your health.
 */

import { character } from './build';
import { G, L, P, strike } from './poses';

const st = P(L.stance, {
  torso: 18, head: 4,
  fs: 50, fe: 70, bs: 36, be: 80,
  fh: 30, fk: 40, bh: -24, bk: 28,
});

const chopWind = P(st, { fs: 150, fe: 80, torso: 4 });
const chopHit = P(st, { fs: 70, fe: 10, torso: 26, bs: 20, be: 60, fh: 36, fk: 36, bh: -30, bk: 18, dx: 0.04 });
const headWind = P(st, { torso: -18, head: -20, fs: 30, fe: 80, bs: 20, be: 80, dx: -0.04 });
const headHit = P(st, { torso: 46, head: 26, fs: -20, fe: 40, bs: -30, be: 40, fh: 50, fk: 40, bh: -36, bk: 10, dx: 0.08 });
const lariatPose = P(st, { torso: 4, fs: 96, fe: 0, bs: 96, be: 0, fh: 26, fk: 26, bh: -26, bk: 26 });
const crouchSpring = P(L.crouch, { fs: 20, fe: 60, bs: 10, be: 60 });
const splash = P(L.fall, { torso: 30, fs: 150, fe: 10, bs: 140, be: 10, fh: 60, fk: 60, bh: 20, bk: 80 });
const elbow = P(L.fall, { torso: 50, head: 20, fs: 10, fe: 160, bs: 40, be: 120, fh: 70, fk: 90, bh: 30, bk: 100 });
const check = P(L.apex, { torso: 30, head: 10, fs: 70, fe: 100, bs: 60, be: 110, fh: 40, fk: 60, bh: -10, bk: 70 });
const lift = P(G.heave, { fs: 180, fe: 20, bs: 180, be: 20 });
const drive = P(L.crouch, { torso: 50, fs: 120, fe: 20, bs: 110, be: 20 });
const rush = P(L.dash, { fs: 80, fe: 20, bs: 70, be: 30, torso: 40 });

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
      desc: 'Short, sturdy chop. Cancels on hit — often into a grab.',
      hitboxes: [{ f0: 5, f1: 7, x: 46, y: -72, r: 34, dmg: 44, hitstun: 16, blockstun: 12, kb: [4, 0], fx: 'medium' }],
      anim: strike(5, 3, 18, chopWind, chopHit, { ready: st, trail: { limb: 'fa', f0: 5, f1: 7 } }),
    },
    {
      id: 'headbutt', name: 'Headbutt', cat: 'attack', icon: 'headbutt', total: 32, where: 'ground', armor: [3, 9, 1],
      motion: [{ f: 7, vx: 6 }],
      desc: 'Armored lunging headbutt (absorbs one hit).',
      hitboxes: [{ f0: 10, f1: 12, x: 40, y: -94, r: 36, dmg: 78, hitstun: 24, blockstun: 13, kb: [9, -5], fx: 'heavy' }],
      anim: strike(10, 3, 32, headWind, headHit, { ready: st, trail: { limb: 'head', f0: 10, f1: 12 } }),
    },
    {
      id: 'lariat', name: 'Lariat', cat: 'attack', icon: 'lariat', total: 40, where: 'ground',
      desc: 'Spinning clothesline that hits both sides. Big reward, big risk on block.',
      hitboxes: [
        { f0: 9, f1: 16, x: 52, y: -78, r: 44, dmg: 82, hitstun: 28, blockstun: 14, kb: [10, -9], fx: 'heavy' },
        { f0: 9, f1: 16, x: -52, y: -78, r: 44, dmg: 82, hitstun: 28, blockstun: 14, kb: [-10, -9], fx: 'heavy' },
      ],
      anim: { keys: [[0, st, 'out'], [8, lariatPose, 'lin'], [17, lariatPose, 'io'], [28, st, 'lin'], [40, st, 'lin']], spin: { f0: 8, f1: 17, deg: 360 }, trail: { limb: 'fa', f0: 9, f1: 16 } },
    },
    {
      id: 'bodycheck', name: 'Body Check', cat: 'attack', icon: 'airkick', total: 22, where: 'air', landLag: 6,
      desc: 'A shoulder-first aerial tackle.',
      hitboxes: [{ f0: 6, f1: 10, x: 34, y: -52, r: 44, dmg: 54, hitstun: 20, blockstun: 12, kb: [7, -3], fx: 'medium' }],
      anim: strike(6, 5, 22, P(L.apex, { torso: -10 }), check, { ready: L.apex, recover: L.fall }),
    },
    {
      id: 'leap', name: 'Giant Leap', cat: 'special', icon: 'leap', total: 80, where: 'ground', script: 'leap', land: 'lag', landLag: 12,
      sp: { at: 6, jump: 15, air: 8 }, landSpawn: 'quake',
      desc: 'Leap where you aim and come down with a body splash that shakes the ground.',
      param: { dir: { kind: 'up', def: [60, -80], min: 30 } },
      hitboxes: [{ f0: 20, f1: 79, x: 10, y: -24, r: 48, dmg: 84, hitstun: 30, blockstun: 14, kb: [5, 6], groundBounce: true, fx: 'heavy' }],
      anim: { keys: [[0, st, 'out'], [5, crouchSpring, 'snap'], [6, L.rise, 'lin'], [18, L.apex, 'io'], [22, splash, 'lin']] },
    },
    {
      id: 'elbowdrop', name: 'Elbow Drop', cat: 'special', icon: 'elbow', total: 60, where: 'air', script: 'dive', landLag: 12,
      sp: { start: 6, speed: 16 },
      desc: 'Drop elbow-first. Hits fighters lying on the floor and spikes airborne ones.',
      param: { dir: { kind: 'down', def: [0, 100], min: 60 } },
      hitboxes: [{ f0: 6, f1: 59, x: 0, y: -10, r: 40, dmg: 70, hitstun: 26, blockstun: 12, kb: [3, 5], otg: true, groundBounce: true, fx: 'heavy' }],
      anim: { keys: [[0, L.apex, 'out'], [6, elbow, 'lin']] },
    },
    {
      id: 'grab', name: 'Suplex', cat: 'attack', icon: 'grab', total: 28, where: 'ground',
      desc: 'Standard grab: a suplex that sends them high for a juggle. Beats Block, Parry and armor.',
      param: { dir: { kind: 'side', def: [100, 0] } },
      hitboxes: [{ f0: 5, f1: 6, x: 42, y: -64, r: 30, kind: 'grab', throwMove: 'grip_suplex', dmg: 0, hitstun: 0, kb: [0, 0] }],
      anim: strike(5, 2, 28, P(st, { fs: 40, fe: 90 }), G.reach, { ready: st }),
    },
    {
      id: 'grip_suplex', name: 'Suplex', cat: 'attack', icon: 'grab', total: 44, where: 'any', hidden: true, noTurn: true,
      desc: '',
      throw: { hold: [[0, 40, -10], [10, 20, -118], [20, 40, -30]], release: 20, hit: { dmg: 110, hitstun: 38, kb: [4, -12], fx: 'throw', hitlag: 12 } },
      anim: { keys: [[0, G.hold, 'io'], [10, lift, 'io'], [20, drive, 'lin'], [28, drive, 'io'], [44, st, 'lin']] },
    },
    {
      id: 'gravitydrop', name: 'Gravity Drop', cat: 'special', icon: 'piledriver', total: 44, where: 'ground',
      desc: 'Command grab with long reach: a piledriver for huge damage. Very slow to recover if it misses.',
      hitboxes: [{ f0: 7, f1: 9, x: 52, y: -60, r: 40, kind: 'grab', throwMove: 'grip_pile', dmg: 0, hitstun: 0, kb: [0, 0] }],
      anim: strike(7, 3, 44, P(st, { fs: 20, fe: 60, bs: 10, be: 60, torso: 30 }), P(G.reach, { torso: 34, fs: 96, bs: 90 }), { ready: st }),
    },
    {
      id: 'grip_pile', name: 'Gravity Drop', cat: 'special', icon: 'piledriver', total: 56, where: 'any', hidden: true, noTurn: true,
      desc: '',
      throw: { hold: [[0, 50, -20], [14, 18, -150], [24, 12, -168], [32, 16, -10]], release: 32, hit: { dmg: 190, hitstun: 40, kb: [4, -6], knockdown: true, hitlag: 16, fx: 'heavy' } },
      anim: { keys: [[0, G.hold, 'io'], [14, lift, 'io'], [24, lift, 'in'], [32, drive, 'lin'], [40, drive, 'io'], [56, st, 'lin']] },
    },
    {
      id: 'bullrush', name: 'Bull Rush', cat: 'special', icon: 'rush', total: 44, where: 'ground',
      motion: [{ f: 6, to: 22, vx: 12 }],
      desc: 'Charge forward and grab whatever you hit. Throw forward or back.',
      param: { dir: { kind: 'side', def: [100, 0] } },
      hitboxes: [{ f0: 6, f1: 22, x: 40, y: -60, r: 34, kind: 'grab', throwMove: 'grip_rush', dmg: 0, hitstun: 0, kb: [0, 0] }],
      anim: { keys: [[0, st, 'out'], [5, P(st, { torso: 30 }), 'snap'], [6, rush, 'lin'], [22, rush, 'out'], [30, L.skid, 'io'], [44, st, 'lin']] },
    },
    {
      id: 'grip_rush', name: 'Bull Rush', cat: 'special', icon: 'rush', total: 40, where: 'any', hidden: true, noTurn: true,
      desc: '',
      throw: { hold: [[0, 40, 0], [10, 44, -24], [18, 40, -4]], release: 18, hit: { dmg: 120, hitstun: 32, kb: [10, -7], wallBounce: true, hitlag: 12, fx: 'heavy' } },
      anim: { keys: [[0, G.hold, 'io'], [10, G.heave, 'out'], [18, G.toss, 'lin'], [26, G.toss, 'io'], [40, st, 'lin']] },
    },
    {
      id: 'atlas', name: 'Atlas Buster', cat: 'super', icon: 'super1', total: 40, where: 'ground', meter: 1000, superFlash: true,
      invuln: [{ f0: 0, f1: 8, vs: 'strike' }],
      desc: 'Lightning-fast long-range command grab into a meteor slam. 1 bar.',
      hitboxes: [{ f0: 4, f1: 8, x: 62, y: -60, r: 60, kind: 'grab', throwMove: 'grip_atlas', dmg: 0, hitstun: 0, kb: [0, 0] }],
      anim: strike(4, 5, 40, P(st, { torso: 40 }), P(G.reach, { torso: 40, fs: 96, bs: 92, dx: 0.1 }), { ready: st }),
    },
    {
      id: 'grip_atlas', name: 'Atlas Buster', cat: 'super', icon: 'super1', total: 70, where: 'any', hidden: true, noTurn: true,
      desc: '',
      motion: [{ f: 10, vy: -12 }, { f: 30, vy: 14 }],
      throw: { hold: [[0, 50, -10], [16, 0, -150], [34, 0, -160], [44, 30, 0]], release: 44, hit: { dmg: 300, hitstun: 50, kb: [6, -8], knockdown: true, hitlag: 22, fx: 'heavy' } },
      anim: { keys: [[0, G.hold, 'io'], [16, lift, 'io'], [34, lift, 'in'], [44, drive, 'lin'], [54, drive, 'io'], [70, st, 'lin']], spin: { f0: 16, f1: 34, deg: 360 } },
    },
    {
      id: 'tectonic', name: 'Tectonic', cat: 'super', icon: 'super2', total: 64, where: 'ground', meter: 2000, superFlash: true,
      armor: [0, 20, 99],
      desc: 'Armored stomp that splits the ground across most of the stage. Unblockable, but jumping avoids it. 2 bars.',
      spawns: [{ f: 20, proj: 'tectonic', x: 0, y: 0 }],
      anim: { keys: [[0, st, 'out'], [14, P(st, { fh: 110, fk: 60, torso: -10, fs: 150, bs: 150, fe: 40, be: 40 }), 'snap'], [20, P(L.crouch, { fh: 50, fk: 60, torso: 30, fs: 60, bs: 50 }), 'lin'], [34, L.crouch, 'io'], [64, st, 'lin']] },
    },
  ],
});
