/**
 * TITAN — heavy. Slow and enormous, with armored attacks that walk through
 * hits, arcing missiles and the most health in the game.
 */

import { character } from './build';
import { G, L, P, strike } from './poses';

const st = P(L.stance, {
  torso: 8, head: -2,
  fs: 58, fe: 112, bs: 40, be: 120,
  fh: 22, fk: 26, bh: -20, bk: 18,
});

const jabWind = P(st, { fs: 40, fe: 140, torso: 0, bs: 60 });
const jabHit = P(st, { fs: 90, fe: 4, torso: 14, bs: 20, be: 130, fh: 30, fk: 26, bh: -26, bk: 14, dx: 0.03 });
const pistonWind = P(st, { fs: -40, fe: 110, torso: -6, bs: 80, be: 100, fh: 20, fk: 30, bh: -30, bk: 20, dx: -0.03 });
const pistonHit = P(st, { fs: 92, fe: 0, torso: 30, head: -6, bs: -40, be: 60, fh: 52, fk: 40, bh: -36, bk: 6, dx: 0.07 });
const upWind = P(L.crouch, { fs: 0, fe: 130, torso: 30, bs: 20 });
const upHit = P(st, { fs: 176, fe: 6, torso: -12, head: -16, bs: -20, be: 40, fh: 20, fk: 6, bh: -24, bk: 8, dx: 0.02 });
const poundWind = P(st, { fs: 170, fe: 40, bs: 165, be: 40, torso: -14, head: -10, fh: 24, fk: 10, bh: -24, bk: 10 });
const poundHit = P(L.crouch, { fs: 40, fe: 0, bs: 30, be: 0, torso: 54, head: 20, fh: 70, fk: 100, bh: 20, bk: 100 });
const chargePose = P(L.dash, { fs: 70, fe: 30, bs: 90, be: 20, torso: 38, head: -14 });
const launchWind = P(st, { fs: 120, fe: 100, torso: -14, bs: 40 });
const launchHit = P(st, { fs: 130, fe: 0, torso: -6, bs: 20, be: 120 });
const slamPose = P(L.fall, { fs: 190, fe: 10, bs: 180, be: 10, torso: 10, fh: 50, fk: 70, bh: 10, bk: 80 });
const hammerWind = P(L.apex, { fs: 175, fe: 40, bs: 160, be: 50, torso: -12 });
const hammerHit = P(L.apex, { fs: 60, fe: 0, bs: 50, be: 10, torso: 40, fh: 40, fk: 90, bh: 0, bk: 90 });
const gigaWind = P(st, { fs: -70, fe: 120, torso: -20, head: -6, bs: 70, be: 110, fh: 14, fk: 30, bh: -34, bk: 20, dx: -0.05 });
const gigaHit = P(st, { fs: 90, fe: 0, torso: 36, head: -10, bs: -60, be: 50, fh: 58, fk: 44, bh: -42, bk: 4, dx: 0.1 });
const meltWind = P(L.crouch, { fs: 140, fe: 160, bs: 140, be: 160, torso: 40, head: 30 });
const meltHit = P(L.victory, { fs: 120, fe: 0, bs: 230, be: 0, fh: 34, fk: 0, bh: -34, bk: 0, torso: -10, head: -24 });

export const TITAN = character({
  id: 'titan',
  name: 'TITAN',
  title: 'The Walking Siege',
  archetype: 'Heavy',
  blurb: 'A war machine with the most health in the game. Armored attacks walk straight through jabs, missiles arc over walls, and every clean hit hurts.',
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
  projectiles: [
    {
      id: 'missile', name: 'Missile', r: 16, life: 140, gravity: 0.24, clash: true, look: 'missile',
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
      hitboxes: [{ f0: 6, f1: 8, x: 54, y: -80, r: 34, dmg: 52, hitstun: 19, blockstun: 13, kb: [4.5, 0], fx: 'medium' }],
      anim: strike(6, 3, 19, jabWind, jabHit, { ready: st, trail: { limb: 'fa', f0: 6, f1: 8 } }),
    },
    {
      id: 'piston', name: 'Piston', cat: 'attack', icon: 'piston', total: 34, where: 'ground', armor: [3, 10, 1],
      desc: 'Armored lunging haymaker (absorbs one hit). Wall-bounces. Unsafe on block.',
      motion: [{ f: 9, vx: 5 }, { f: 10, to: 13, vx: 3 }],
      hitboxes: [{ f0: 11, f1: 14, x: 66, y: -74, r: 40, dmg: 105, hitstun: 26, blockstun: 14, kb: [11, -4], wallBounce: true, hitlag: 12, fx: 'heavy' }],
      anim: strike(11, 4, 34, pistonWind, pistonHit, { ready: st, trail: { limb: 'fa', f0: 11, f1: 14 } }),
    },
    {
      id: 'skybreaker', name: 'Sky Breaker', cat: 'attack', icon: 'uppercut', total: 36, where: 'ground', armor: [4, 10, 1], cancelOnHit: 18,
      desc: 'Armored rising uppercut. Launches, and swats jumpers out of the air.',
      hitboxes: [{ f0: 10, f1: 13, x: 36, y: -112, r: 44, dmg: 82, hitstun: 34, blockstun: 12, kb: [2, -14], fx: 'heavy' }],
      anim: strike(10, 4, 36, upWind, upHit, { ready: st, trail: { limb: 'fa', f0: 10, f1: 13 } }),
    },
    {
      id: 'pound', name: 'Ground Pound', cat: 'attack', icon: 'pound', total: 40, where: 'ground',
      desc: 'Smash the floor: hits both sides and anyone lying down.',
      hitboxes: [{ f0: 14, f1: 17, x: 0, y: -14, r: 104, dmg: 80, hitstun: 32, blockstun: 16, kb: [6, -10], radial: true, otg: true, fx: 'heavy' }],
      anim: strike(14, 4, 40, poundWind, poundHit, { ready: st }),
    },
    {
      id: 'rocket', name: 'Rocket Charge', cat: 'special', icon: 'charge', total: 46, where: 'ground', armor: [4, 22, 2],
      desc: 'Thrusters on: an armored charge across the stage (absorbs two hits). Very unsafe on block.',
      motion: [{ f: 8, to: 22, vx: 14 }],
      hitboxes: [{ f0: 8, f1: 22, x: 40, y: -66, r: 42, dmg: 95, hitstun: 28, blockstun: 14, kb: [12, -6], wallBounce: true, fx: 'heavy' }],
      anim: { keys: [[0, st, 'out'], [6, P(st, { torso: 30, fs: 60, fe: 40, bs: 80, be: 40 }), 'snap'], [8, chargePose, 'lin'], [22, chargePose, 'out'], [30, L.skid, 'io'], [46, st, 'lin']] },
    },
    {
      id: 'missile', name: 'Missile', cat: 'special', icon: 'missile', total: 34, where: 'ground', limitProj: 'missile',
      desc: 'Lob an arcing missile that explodes on impact. Aim sets angle and power.',
      param: { dir: { kind: 'up', def: [60, -60], min: 30 } },
      spawns: [{ f: 14, proj: 'missile', x: 12, y: -124, speed: 11, aim: true }],
      anim: strike(14, 2, 34, launchWind, launchHit, { ready: st, aim: { f0: 10, f1: 20 } }),
    },
    {
      id: 'dropslam', name: 'Drop Slam', cat: 'special', icon: 'slam', total: 60, where: 'air', script: 'dive', landLag: 14,
      sp: { start: 8, speed: 17 }, landSpawn: 'quake',
      desc: 'Crash down from the air. Spikes airborne foes into a bounce; shakes the ground on landing.',
      param: { dir: { kind: 'down', def: [10, 100], min: 60 } },
      hitboxes: [{ f0: 8, f1: 59, x: 0, y: -10, r: 44, dmg: 85, hitstun: 28, blockstun: 14, kb: [3, 8], groundBounce: true, fx: 'heavy' }],
      anim: { keys: [[0, L.apex, 'out'], [7, slamPose, 'snap'], [8, P(slamPose, { fs: 40, bs: 30, torso: 30 }), 'lin']] },
    },
    {
      id: 'airhammer', name: 'Air Hammer', cat: 'attack', icon: 'hammer', total: 24, where: 'air', landLag: 8,
      desc: 'Double-fisted aerial smash that spikes foes into a ground bounce.',
      hitboxes: [{ f0: 7, f1: 10, x: 46, y: -50, r: 40, dmg: 64, hitstun: 22, blockstun: 12, kb: [5, 6], groundBounce: true, fx: 'heavy' }],
      anim: strike(7, 4, 24, hammerWind, hammerHit, { ready: L.apex, recover: L.fall, trail: { limb: 'fa', f0: 7, f1: 10 } }),
    },
    {
      id: 'grab', name: 'Crusher', cat: 'attack', icon: 'grab', total: 32, where: 'ground',
      desc: 'Grab and slam them into the floor for a bounce. Beats Block, Parry and armor.',
      param: { dir: { kind: 'side', def: [100, 0] } },
      hitboxes: [{ f0: 6, f1: 7, x: 46, y: -72, r: 30, kind: 'grab', throwMove: 'titan_throw', dmg: 0, hitstun: 0, kb: [0, 0] }],
      anim: strike(6, 2, 32, P(st, { fs: 40, fe: 100, bs: 30 }), G.reach, { ready: st }),
    },
    {
      id: 'titan_throw', name: 'Crusher Slam', cat: 'attack', icon: 'grab', total: 40, where: 'any', hidden: true, noTurn: true,
      desc: '',
      throw: { hold: [[0, 46, -10], [12, 36, -96], [22, 34, -16]], release: 22, hit: { dmg: 125, hitstun: 30, kb: [4, 10], groundBounce: true, hitlag: 14, fx: 'throw' } },
      anim: { keys: [[0, G.hold, 'io'], [12, G.heave, 'in'], [22, poundHit, 'lin'], [28, poundHit, 'io'], [40, st, 'lin']] },
    },
    {
      id: 'gigaton', name: 'Gigaton', cat: 'super', icon: 'super1', total: 54, where: 'ground', meter: 1000, superFlash: true,
      armor: [0, 18, 99],
      desc: 'Fully armored mega-punch. Shrugs off everything but grabs. 1 bar.',
      motion: [{ f: 14, vx: 8 }, { f: 15, to: 19, vx: 4 }],
      hitboxes: [{ f0: 16, f1: 20, x: 72, y: -72, r: 56, dmg: 230, hitstun: 40, blockstun: 22, chip: 20, kb: [16, -8], wallBounce: true, hitlag: 20, fx: 'heavy' }],
      anim: strike(16, 5, 54, gigaWind, gigaHit, { ready: st, trail: { limb: 'fa', f0: 16, f1: 20 } }),
    },
    {
      id: 'meltdown', name: 'Meltdown', cat: 'super', icon: 'super2', total: 66, where: 'ground', meter: 2000, superFlash: true,
      desc: 'Reactor overload: a huge invulnerable blast all around. 2 bars.',
      invuln: [{ f0: 0, f1: 18, vs: 'all' }],
      hitboxes: [{ f0: 18, f1: 24, x: 0, y: -60, r: 190, dmg: 290, hitstun: 44, blockstun: 24, chip: 25, kb: [12, -16], radial: true, hitlag: 22, fx: 'blast' }],
      anim: { keys: [[0, st, 'out'], [12, meltWind, 'snap'], [18, meltHit, 'lin'], [30, meltHit, 'io'], [66, st, 'lin']] },
    },
  ],
});
