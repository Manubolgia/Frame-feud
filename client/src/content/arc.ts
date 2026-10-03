/**
 * ARC — zoner. A storm wizard: floaty, with a hover instead of an air dash.
 * Controls space with aimed bolts and a drifting orb she can detonate at
 * will, and blinks out of trouble.
 *
 * Arm angles are relative to the upper spine (torso + chest): a hand aimed
 * straight ahead needs fs = 90 - torso - chest.
 */

import { character } from './build';
import { G, NEUTRAL, P, strike } from './poses';

// Upright caster: lead palm raised and open, the other hand low at the side.
const st = P(NEUTRAL, {
  torso: 2, chest: -2, head: -4,
  fs: 70, fe: 46, fw: -26,
  bs: -8, be: 26,
  fh: 16, fk: 14,
  bh: -18, bk: 16,
});

const palmWind = P(st, { torso: -4, chest: -4, fs: 30, fe: 112, fw: -10, bs: 10, be: 40, dx: -0.01, sq: -0.02 });
const palmHit = P(st, { torso: 14, chest: 4, head: -10, fs: 72, fe: 0, fw: -36, bs: -20, be: 30, fh: 32, fk: 24, bh: -26, bk: 10, dx: 0.03, sq: 0.02 });

const kickWind = P(st, { torso: -4, chest: -4, fs: 50, fe: 60, bs: 10, be: 40, fh: 66, fk: 106, fa: 10, sq: -0.03 });
const kickLow = P(st, { torso: -22, chest: -6, head: 6, fs: 40, fe: 30, bs: -10, be: 40, fh: 78, fk: 0, fa: 26, bh: -6, bk: 30, dx: 0.02 });

const sparkWind = P(st, { torso: 24, chest: 8, head: -16, fs: -10, fe: 40, bs: -20, be: 40, fh: 60, fk: 90, bh: 6, bk: 80, sq: -0.06 });
const sparkHit = P(st, { torso: 8, chest: -2, head: -18, fs: 116, fe: 12, fw: -14, bs: -30, be: 30, fh: 26, fk: 14, bh: -20, bk: 10, dx: 0.03, sq: 0.03 });
const sparkTop = P(sparkHit, { torso: -6, chest: -6, head: -26, fs: 192, fe: 0, fw: 0, fh: 16, fk: 6, sq: 0.05 });

const air = P(NEUTRAL, { torso: 6, chest: 2, head: -6, fs: 60, fe: 50, fw: -20, bs: 20, be: 40, fh: 40, fk: 80, bh: 0, bk: 70, fa: 30, ba: 30 });
const novaWind = P(air, { torso: -6, fh: 70, fk: 124, bh: 20, bk: 110 });
const novaHit = P(air, { torso: -22, chest: -6, head: 4, fs: 20, fe: 40, bs: -40, be: 30, fh: 92, fk: 0, fa: 30, bh: -6, bk: 84 });

const castWind = P(st, { torso: -4, chest: -6, fs: 30, fe: 110, fw: -10, bs: 30, be: 90, sq: -0.02 });
const castHit = P(st, { torso: 12, chest: 0, head: -8, fs: 78, fe: 0, fw: -22, bs: 0, be: 40, fh: 28, fk: 22, bh: -24, bk: 12, dx: 0.03 });
const orbWind = P(st, { torso: -6, chest: -8, head: 6, fs: 54, fe: 110, fw: -40, bs: 50, be: 116, bw: -40 });
const orbHit = P(st, { torso: 8, chest: -2, head: -12, fs: 96, fe: 10, fw: -30, bs: 86, be: 20, bw: -30, fh: 26, fk: 20, bh: -22, bk: 12 });
const snap = P(st, { torso: -4, chest: -6, head: -14, fs: 156, fe: 30, fw: -20, bs: -20, be: 40 });
const blinkOut = P(st, { torso: -8, chest: -6, head: -20, fs: 160, fe: 10, bs: 150, be: 10, fh: 10, fk: 4, bh: -10, bk: 4, sq: 0.08 });

const reach = P(G.reach, { torso: 18, chest: 2, head: -12, fs: 70, fe: 6, fw: -24, bs: 40, be: 40, fh: 40, fk: 34, bh: -30, bk: 20, dx: 0.04 });
const rayPose = P(st, { torso: 6, chest: 0, head: -6, fs: 84, fe: 0, fw: -30, bs: 80, be: 6, bw: -30, fh: 36, fk: 32, bh: -32, bk: 20, dx: -0.02 });
const singPose = P(st, { torso: -10, chest: -10, head: -20, fs: 156, fe: 24, fw: -30, bs: 146, be: 30, bw: -30, fh: 20, fk: 10, bh: -20, bk: 10 });
const singPush = P(singPose, { torso: 10, chest: 0, head: -10, fs: 96, fe: 10, bs: 90, be: 16 });

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
  poses: {
    dash: P(st, { torso: 22, chest: 4, head: -16, fs: -20, fe: 30, fw: 0, bs: -40, be: 30, fh: 50, fk: 50, bh: -36, bk: 60, dx: 0.04 }),
    walkA: P(st, { fh: 30, fk: 8, bh: -26, bk: 26 }),
    walkB: P(st, { fh: -4, fk: 28, bh: 2, bk: 6 }),
    apex: air,
    fall: P(air, { torso: 0, fs: 110, fe: 30, bs: 70, be: 30, fh: 20, fk: 30, bh: -10, bk: 50 }),
    victory: P(st, { torso: -4, chest: -6, head: -14, fs: 150, fe: 20, fw: -30, bs: 120, be: 30, bw: -30, fh: 16, fk: 6, bh: -16, bk: 6 }),
  },
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
      anim: { keys: [[0, air, 'io'], [6, P(air, { fh: 20, fk: 60, bh: -10, bk: 70, fs: 50, fe: 40, bs: 40, be: 40 }), 'lin']], open: [0, 999], power: [0, 999] },
    },
    {
      id: 'jab', name: 'Palm', cat: 'attack', icon: 'palm', total: 17, where: 'ground', cancelOnHit: 8,
      desc: 'A quick palm strike charged with static. Cancels on hit.',
      hitboxes: [{ f0: 5, f1: 7, x: 0, y: 0, r: 24, bone: 'fHand', dmg: 36, hitstun: 16, blockstun: 11, kb: [5, -1], fx: 'zap' }],
      anim: strike(5, 3, 17, palmWind, palmHit, { ready: st, windAt: 3, trail: { limb: 'fa', f0: 5, f1: 7 }, open: [0, 17], power: [5, 8] }),
    },
    {
      id: 'sparkkick', name: 'Spark Kick', cat: 'attack', icon: 'lowkick', total: 28, where: 'ground', low: [3, 18],
      desc: 'Slide in, lean back and snap a long low kick. Her best poke at mid range.',
      motion: [{ f: 3, to: 9, vx: 5.5 }],
      hitboxes: [{ f0: 8, f1: 10, x: 0, y: 0, r: 24, bone: 'fFoot', dmg: 46, hitstun: 20, blockstun: 12, kb: [6, -2], fx: 'zap' }],
      anim: strike(8, 3, 28, kickWind, kickLow, { ready: st, windAt: 4, trail: { limb: 'fl', f0: 8, f1: 10 }, open: [0, 28] }),
    },
    {
      id: 'risingspark', name: 'Rising Spark', cat: 'attack', icon: 'spark', total: 30, where: 'ground', cancelOnHit: 14,
      desc: 'Thrust a crackling palm overhead: anti-air and launcher.',
      hitboxes: [
        { f0: 7, f1: 11, x: 0, y: 0, r: 30, bone: 'fHand', dmg: 50, hitstun: 28, blockstun: 11, kb: [2, -12], fx: 'zap' },
        { f0: 7, f1: 11, x: 0, y: 0, r: 26, bone: 'fElbow', dmg: 50, hitstun: 28, blockstun: 11, kb: [2, -12], fx: 'zap' },
      ],
      anim: strike(7, 5, 30, sparkWind, sparkHit, { ready: st, follow: sparkTop, windAt: 4, trail: { limb: 'fa', f0: 7, f1: 11 }, open: [0, 30], power: [6, 14] }),
    },
    {
      id: 'novakick', name: 'Nova Kick', cat: 'attack', icon: 'airkick', total: 22, where: 'air', landLag: 6, cancelOnHit: 10,
      desc: 'Aerial kick crackling with energy. Cancels on hit.',
      hitboxes: [{ f0: 6, f1: 9, x: 0, y: 0, r: 26, bone: 'fFoot', dmg: 44, hitstun: 18, blockstun: 11, kb: [6, -4], fx: 'zap' }],
      anim: strike(6, 4, 22, novaWind, novaHit, { ready: air, windAt: 3, trail: { limb: 'fl', f0: 6, f1: 9 }, open: [0, 22] }),
    },
    {
      id: 'bolt', name: 'Arc Bolt', cat: 'special', icon: 'bolt', total: 30, where: 'any', land: 'end', limitProj: 'bolt',
      desc: 'Fire a bolt in any direction, on the ground or in the air. One at a time.',
      param: { dir: { kind: 'aim', def: [100, 0] } },
      spawns: [{ f: 10, proj: 'bolt', x: 34, y: -72, speed: 13, aim: true }],
      anim: strike(10, 2, 30, castWind, castHit, { ready: st, windAt: 5, aim: { f0: 9, f1: 20 }, open: [0, 30], power: [6, 14] }),
    },
    {
      id: 'orb', name: 'Orb', cat: 'special', icon: 'orb', total: 32, where: 'any', land: 'end', limitProj: 'orb',
      desc: 'Conjure an orb that drifts where you aim (or hangs still) and zaps on contact. Explodes when it fades.',
      param: { dir: { kind: 'free', def: [60, 0] } },
      spawns: [{ f: 12, proj: 'orb', x: 44, y: -84 }],
      anim: strike(12, 2, 32, orbWind, orbHit, { ready: st, windAt: 6, open: [0, 32], power: [4, 16] }),
    },
    {
      id: 'detonate', name: 'Detonate', cat: 'special', icon: 'detonate', total: 18, where: 'any', land: 'end',
      script: 'detonate', sp: { at: 4 }, needsProj: 'orb',
      desc: 'Snap your fingers: the orb explodes wherever it is.',
      anim: { keys: [[0, st, 'out'], [3, snap, 'in'], [4, P(snap, { fe: 6, fw: 10 }), 'out'], [18, st, 'lin']], power: [3, 6] },
    },
    {
      id: 'blink', name: 'Blink', cat: 'special', icon: 'blink', total: 22, where: 'any', land: 'end', script: 'teleport',
      hide: [5, 10], sp: { at: 11, dist: 230 }, invuln: [{ f0: 4, f1: 12, vs: 'all' }],
      desc: 'Teleport up to 230px in any direction, even into the air.',
      param: { dir: { kind: 'free', def: [-100, 0], min: 30 } },
      anim: { keys: [[0, st, 'out'], [4, blinkOut, 'in'], [11, P(st, { fs: 40, bs: 40, sq: -0.04 }), 'io'], [22, st, 'lin']], open: [0, 22], power: [2, 12] },
    },
    {
      id: 'grab', name: 'Arcane Grasp', cat: 'attack', icon: 'grab', total: 28, where: 'ground',
      desc: 'Seize them and fling them skyward for a juggle. Beats Block, Parry and armor.',
      param: { dir: { kind: 'side', def: [100, 0] } },
      hitboxes: [{ f0: 5, f1: 6, x: 0, y: 0, r: 22, bone: 'fHand', kind: 'grab', throwMove: 'arc_throw', dmg: 0, hitstun: 0, kb: [0, 0] }],
      anim: strike(5, 2, 28, P(st, { fs: 30, fe: 100, sq: -0.03 }), reach, { ready: st, windAt: 3, open: [0, 28] }),
    },
    {
      id: 'arc_throw', name: 'Updraft', cat: 'attack', icon: 'grab', total: 36, where: 'any', hidden: true, noTurn: true,
      desc: '',
      throw: { hold: [[0, 40, -10], [14, 56, -60], [18, 56, -64]], release: 18, hit: { dmg: 90, hitstun: 34, kb: [3, -13], fx: 'zap', hitlag: 10 } },
      anim: { keys: [[0, P(reach, { fe: 30 }), 'io'], [14, P(sparkTop, { fe: 30 }), 'in'], [18, sparkTop, 'out'], [26, sparkTop, 'io'], [36, st, 'lin']], open: [0, 36], power: [12, 22] },
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
      anim: { keys: [[0, st, 'out'], [10, castWind, 'in'], [14, rayPose, 'out'], [36, rayPose, 'io'], [56, st, 'lin']], aim: { f0: 12, f1: 38 }, open: [0, 56], power: [8, 38] },
    },
    {
      id: 'singularity', name: 'Singularity', cat: 'super', icon: 'super2', total: 44, where: 'any', land: 'keep', meter: 2000, superFlash: true,
      float: [0, 40],
      desc: 'Open a black hole that drifts where you aim, drags them in, then collapses. 2 bars.',
      param: { dir: { kind: 'free', def: [100, 0] } },
      invuln: [{ f0: 0, f1: 14, vs: 'all' }],
      spawns: [{ f: 14, proj: 'singularity', x: 50, y: -90 }],
      anim: { keys: [[0, st, 'out'], [10, singPose, 'in'], [14, singPush, 'out'], [30, singPush, 'io'], [44, st, 'lin']], open: [0, 44], power: [6, 30] },
    },
  ],
});
