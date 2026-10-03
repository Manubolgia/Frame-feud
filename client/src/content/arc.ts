/**
 * ARC — zoner. Floaty, with a hover instead of an air dash. Controls space
 * with aimed bolts and a drifting orb she can detonate at will, and blinks
 * out of trouble.
 */

import { character } from './build';
import { G, L, P, strike } from './poses';

const st = P(L.stance, {
  torso: 2, head: -6,
  fs: 54, fe: 70, bs: 30, be: 90,
  fh: 18, fk: 20, bh: -14, bk: 14,
});

const palmWind = P(st, { fs: 30, fe: 120, torso: -2 });
const palmHit = P(st, { fs: 92, fe: 0, torso: 14, bs: 10, be: 60, fh: 30, fk: 24, bh: -24, bk: 10, dx: 0.03 });
const kickWind = P(st, { fh: 60, fk: 100, torso: -6 });
const kickLow = P(st, { torso: -18, head: -6, fh: 80, fk: 0, bh: -10, bk: 30, fs: 60, fe: 40, bs: -20, be: 40, dx: 0.02 });
const castWind = P(st, { fs: 30, fe: 110, bs: 40, be: 100, torso: -6 });
const castHit = P(st, { fs: 92, fe: 0, bs: 70, be: 50, torso: 14, dx: 0.03 });
const orbWind = P(st, { fs: 110, fe: 90, bs: 100, be: 100, torso: -4, head: -10 });
const orbHit = P(st, { fs: 100, fe: 10, bs: 80, be: 30, torso: 8 });
const snap = P(st, { fs: 150, fe: 30, bs: -20, be: 40, torso: -6, head: -10 });
const novaWind = P(L.apex, { fh: 70, fk: 120, torso: -10 });
const novaHit = P(L.apex, { fh: 96, fk: 0, bh: 0, bk: 70, torso: -20, fs: 40, bs: -30 });
const sparkWind = P(L.crouch, { fs: 20, fe: 100 });
const sparkHit = P(st, { fs: 170, fe: 0, bs: 30, be: 60, torso: -8, head: -14, fh: 14, fk: 8, bh: -20, bk: 10 });
const rayPose = P(st, { fs: 92, fe: 0, bs: 84, be: 10, torso: 6, head: 0, fh: 34, fk: 30, bh: -30, bk: 20, dx: -0.02 });
const singPose = P(st, { fs: 150, fe: 20, bs: 140, be: 30, torso: -10, head: -16 });

export const ARC = character({
  id: 'arc',
  name: 'ARC',
  title: 'The Storm Scholar',
  archetype: 'Zoner',
  blurb: 'Floats, hovers and blinks. Aimed bolts and a drifting orb she can detonate let her fight from anywhere but up close.',
  color: 0xb36bff,
  palettes: [
    [0xb36bff, 0x221338, 0xeedcff],
    [0x3dd9a8, 0x0f2e25, 0xc4ffe9],
    [0xff8f3d, 0x3a1f0c, 0xffe0c2],
    [0x6b8cff, 0x131c38, 0xd6e0ff],
  ],
  hp: 1050,
  walk: 3.2,
  dash: 11.5,
  backdash: 10,
  jump: 13,
  airSpeed: 5.5,
  gravity: 0.45,
  maxFall: 10,
  fastFall: 13,
  airJumps: 1,
  airDashes: 0,
  airDash: 0,
  width: 19,
  height: 112,
  kbMul: 104,
  ratings: { power: 3, speed: 3, range: 5, defense: 2, mobility: 4 },
  difficulty: 3,
  build: { height: 112, leg: 0.47, torso: 0.31, arm: 0.42, head: 0.1, limbW: 8, torsoW: 17, kit: 'arc' },
  stance: st,
  without: ['airdash'],
  projectiles: [
    {
      id: 'bolt', name: 'Arc Bolt', r: 16, life: 70, clash: true, look: 'bolt',
      hit: { dmg: 42, hitstun: 22, blockstun: 12, kb: [6, -3], fx: 'zap' },
    },
    {
      id: 'orb', name: 'Orb', r: 22, life: 300, drift: 2.2, rehit: 30, maxHits: 3, wallStop: false, floorStop: false,
      burstInto: 'orbblast', look: 'orb',
      hit: { dmg: 22, hitstun: 26, blockstun: 10, kb: [1, -7], fx: 'zap' },
    },
    {
      id: 'orbblast', name: 'Orb Blast', r: 96, life: 7, activeTo: 3, floorStop: false, wallStop: false, look: 'blast',
      hit: { dmg: 72, hitstun: 30, blockstun: 14, kb: [7, -11], radial: true, fx: 'blast' },
    },
    {
      id: 'singularity', name: 'Singularity', r: 26, life: 72, drift: 3.2, wallStop: false, floorStop: false, look: 'singularity',
      pull: { radius: 340, speed: 3.4, until: 60 }, burstInto: 'singblast',
    },
    {
      id: 'singblast', name: 'Collapse', r: 150, life: 9, activeTo: 4, floorStop: false, wallStop: false, look: 'blast',
      hit: { dmg: 210, hitstun: 40, blockstun: 20, chip: 20, kb: [8, -14], radial: true, hitlag: 18, fx: 'blast' },
    },
  ],
  moves: [
    {
      id: 'hover', name: 'Hover', cat: 'move', icon: 'hover', total: 24, where: 'air', script: 'hover', land: 'end',
      amtIsLength: true, float: [0, 999], sp: { speed: 3 },
      desc: 'Float in place, or drift slowly in any direction.',
      param: { dir: { kind: 'free', def: [0, 0] }, amt: { min: 6, max: 60, def: 24, label: 'Frames', unit: 'f' } },
      anim: { keys: [[0, L.apex, 'io'], [6, P(L.apex, { fh: 20, fk: 60, bh: -10, bk: 70, fs: 40, fe: 60, bs: 30, be: 60 }), 'lin']] },
    },
    {
      id: 'jab', name: 'Palm', cat: 'attack', icon: 'palm', total: 17, where: 'ground', cancelOnHit: 8,
      desc: 'A quick charged palm strike to create space. Cancels on hit.',
      hitboxes: [{ f0: 5, f1: 7, x: 44, y: -64, r: 32, dmg: 36, hitstun: 16, blockstun: 11, kb: [5, -1], fx: 'zap' }],
      anim: strike(5, 3, 17, palmWind, palmHit, { ready: st, trail: { limb: 'fa', f0: 5, f1: 7 } }),
    },
    {
      id: 'sparkkick', name: 'Spark Kick', cat: 'attack', icon: 'lowkick', total: 28, where: 'ground', low: [3, 18],
      desc: 'Long-reaching low kick. Her best poke at mid range.',
      hitboxes: [{ f0: 8, f1: 10, x: 76, y: -18, r: 30, dmg: 46, hitstun: 20, blockstun: 12, kb: [6, -2], fx: 'zap' }],
      anim: strike(8, 3, 28, kickWind, kickLow, { ready: st, trail: { limb: 'fl', f0: 8, f1: 10 } }),
    },
    {
      id: 'risingspark', name: 'Rising Spark', cat: 'attack', icon: 'spark', total: 30, where: 'ground', cancelOnHit: 14,
      desc: 'Lightning pillar overhead: anti-air and launcher.',
      hitboxes: [{ f0: 7, f1: 11, x: 26, y: -112, r: 40, dmg: 50, hitstun: 28, blockstun: 11, kb: [2, -12], fx: 'zap' }],
      anim: strike(7, 5, 30, sparkWind, sparkHit, { ready: st }),
    },
    {
      id: 'novakick', name: 'Nova Kick', cat: 'attack', icon: 'airkick', total: 22, where: 'air', landLag: 6, cancelOnHit: 10,
      desc: 'Aerial kick crackling with energy. Cancels on hit.',
      hitboxes: [{ f0: 6, f1: 9, x: 38, y: -40, r: 38, dmg: 44, hitstun: 18, blockstun: 11, kb: [6, -4], fx: 'zap' }],
      anim: strike(6, 4, 22, novaWind, novaHit, { ready: L.apex, recover: L.fall, trail: { limb: 'fl', f0: 6, f1: 9 } }),
    },
    {
      id: 'bolt', name: 'Arc Bolt', cat: 'special', icon: 'bolt', total: 30, where: 'any', land: 'end', limitProj: 'bolt',
      desc: 'Fire a bolt in any direction, on the ground or in the air. One at a time.',
      param: { dir: { kind: 'aim', def: [100, 0] } },
      spawns: [{ f: 10, proj: 'bolt', x: 30, y: -70, speed: 13, aim: true }],
      anim: strike(10, 2, 30, castWind, castHit, { ready: st, aim: { f0: 8, f1: 20 } }),
    },
    {
      id: 'orb', name: 'Orb', cat: 'special', icon: 'orb', total: 32, where: 'any', land: 'end', limitProj: 'orb',
      desc: 'Conjure an orb that drifts where you aim (or hangs still) and zaps on contact. Explodes when it fades.',
      param: { dir: { kind: 'free', def: [60, 0] } },
      spawns: [{ f: 12, proj: 'orb', x: 40, y: -82 }],
      anim: strike(12, 2, 32, orbWind, orbHit, { ready: st }),
    },
    {
      id: 'detonate', name: 'Detonate', cat: 'special', icon: 'detonate', total: 18, where: 'any', land: 'end',
      script: 'detonate', sp: { at: 4 }, needsProj: 'orb',
      desc: 'Snap your fingers: the orb explodes wherever it is.',
      anim: { keys: [[0, st, 'out'], [3, snap, 'snap'], [4, P(snap, { fe: 0 }), 'lin'], [18, st, 'lin']] },
    },
    {
      id: 'blink', name: 'Blink', cat: 'special', icon: 'blink', total: 22, where: 'any', land: 'end', script: 'teleport',
      hide: [5, 10], sp: { at: 11, dist: 230 }, invuln: [{ f0: 4, f1: 12, vs: 'all' }],
      desc: 'Teleport up to 230px in any direction, even into the air.',
      param: { dir: { kind: 'free', def: [-100, 0], min: 30 } },
      anim: { keys: [[0, st, 'out'], [4, P(st, { fs: 150, bs: 150, fe: 10, be: 10, torso: -6 }), 'snap'], [11, P(st, { fs: 40, bs: 40 }), 'io'], [22, st, 'lin']] },
    },
    {
      id: 'grab', name: 'Arcane Grasp', cat: 'attack', icon: 'grab', total: 28, where: 'ground',
      desc: 'Seize them and fling them skyward for a juggle. Beats Block, Parry and armor.',
      param: { dir: { kind: 'side', def: [100, 0] } },
      hitboxes: [{ f0: 5, f1: 6, x: 40, y: -62, r: 28, kind: 'grab', throwMove: 'arc_throw', dmg: 0, hitstun: 0, kb: [0, 0] }],
      anim: strike(5, 2, 28, P(st, { fs: 30, fe: 100 }), G.reach, { ready: st }),
    },
    {
      id: 'arc_throw', name: 'Updraft', cat: 'attack', icon: 'grab', total: 36, where: 'any', hidden: true, noTurn: true,
      desc: '',
      throw: { hold: [[0, 40, -10], [14, 56, -60], [18, 56, -64]], release: 18, hit: { dmg: 90, hitstun: 34, kb: [3, -13], fx: 'zap', hitlag: 10 } },
      anim: { keys: [[0, G.hold, 'io'], [14, P(sparkHit, { fe: 30 }), 'lin'], [18, sparkHit, 'lin'], [26, sparkHit, 'io'], [36, st, 'lin']] },
    },
    {
      id: 'ray', name: 'Ray', cat: 'super', icon: 'super1', total: 56, where: 'any', land: 'keep', meter: 1000, superFlash: true,
      float: [0, 50],
      desc: 'A stage-length beam in any direction. Shrugs off projectiles while charging. 1 bar.',
      param: { dir: { kind: 'aim', def: [100, 0] } },
      invuln: [{ f0: 0, f1: 15, vs: 'proj' }],
      hitboxes: [90, 190, 290, 390, 490, 590].flatMap((d) => [
        { f0: 16, f1: 32, x: d, y: -70, r: 42, dmg: 30, hitstun: 24, blockstun: 8, chip: 20, kb: [3, -1] as [number, number], rehit: 4, maxHits: 4, aimed: true, group: 0, fx: 'zap' as const },
        { f0: 34, f1: 35, x: d, y: -70, r: 46, dmg: 60, hitstun: 34, blockstun: 14, chip: 20, kb: [10, -6] as [number, number], aimed: true, group: 1, fx: 'heavy' as const },
      ]).sort((a, b) => a.group - b.group),
      anim: { keys: [[0, st, 'out'], [10, castWind, 'snap'], [14, rayPose, 'lin'], [36, rayPose, 'io'], [56, st, 'lin']], aim: { f0: 12, f1: 38 } },
    },
    {
      id: 'singularity', name: 'Singularity', cat: 'super', icon: 'super2', total: 44, where: 'any', land: 'keep', meter: 2000, superFlash: true,
      float: [0, 40],
      desc: 'Open a black hole that drifts where you aim, drags them in, then collapses. 2 bars.',
      param: { dir: { kind: 'free', def: [100, 0] } },
      invuln: [{ f0: 0, f1: 14, vs: 'all' }],
      spawns: [{ f: 14, proj: 'singularity', x: 50, y: -90 }],
      anim: { keys: [[0, st, 'out'], [10, singPose, 'snap'], [14, P(singPose, { fs: 110, bs: 100, torso: 10 }), 'lin'], [30, P(singPose, { fs: 110, bs: 100, torso: 10 }), 'io'], [44, st, 'lin']] },
    },
  ],
});
