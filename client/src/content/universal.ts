/**
 * The shared kit: movement, defence and wake-up options every fighter has.
 * Speeds come from each character's stats inside the sim scripts, and the
 * animations from each character's pose set, so one definition serves the
 * whole roster while everyone still moves in their own way.
 */

import type { MoveDef } from '../sim/types';
import { P, still, type AnimDef, type PoseSet } from './poses';

function rollAnim(ps: PoseSet, total: number, from: number, to: number): AnimDef {
  return {
    keys: [
      [0, ps.crouch, 'out'],
      [from, ps.ball, 'lin'],
      [to, ps.ball, 'out'],
      [to + 3, ps.crouch, 'io'],
      [total, ps.stance, 'lin'],
    ],
    spin: { f0: from, f1: to, deg: 360 },
  };
}

export function universalMoves(ps: PoseSet): Record<string, MoveDef> {
  const st = ps.stance;
  return {
    wait: {
      id: 'wait', name: 'Wait', cat: 'move', icon: 'wait', total: 10, where: 'any', land: 'keep',
      desc: 'Hold position (or drift in the air) for a set number of frames. Patience is an option.',
      amtIsLength: true,
      param: { amt: { min: 1, max: 60, def: 10, label: 'Frames', unit: 'f' } },
      anim: still(st),
    },
    walk: {
      id: 'walk', name: 'Walk', cat: 'move', icon: 'walk', total: 16, where: 'ground', script: 'walk',
      desc: 'Step forward to pressure and build meter, or back off to make space.',
      amtIsLength: true,
      param: { dir: { kind: 'side', def: [100, 0] }, amt: { min: 4, max: 40, def: 16, label: 'Frames', unit: 'f' } },
      anim: { keys: [[0, ps.walkA, 'io'], [8, ps.walkB, 'io'], [16, ps.walkA, 'lin']] },
    },
    dash: {
      id: 'dash', name: 'Dash', cat: 'move', icon: 'dash', total: 18, where: 'ground', script: 'dash',
      desc: 'Burst toward your opponent. Distance is adjustable. Builds meter.',
      param: { amt: { min: 30, max: 100, def: 100, label: 'Distance', unit: '%' } },
      anim: { keys: [[0, st, 'out'], [1, P(ps.crouch, { sq: -0.06 }), 'out'], [3, ps.dash, 'lin'], [11, ps.dash, 'out'], [14, ps.skid, 'io'], [18, st, 'lin']] },
    },
    backdash: {
      id: 'backdash', name: 'Back Dash', cat: 'move', icon: 'backdash', total: 20, where: 'ground', script: 'backdash',
      desc: 'Hop away from the fight. Invulnerable to strikes for frames 1-5.',
      invuln: [{ f0: 1, f1: 5, vs: 'strike' }],
      anim: { keys: [[0, st, 'out'], [2, ps.backdash, 'lin'], [11, ps.backdash, 'io'], [15, P(ps.land, { sq: -0.04 }), 'io'], [20, st, 'lin']] },
    },
    jump: {
      id: 'jump', name: 'Jump', cat: 'move', icon: 'jump', total: 7, where: 'ground', script: 'jump',
      desc: 'Aim your jump: the angle sets the direction, the length sets the height. 3 frames to leave the ground.',
      param: { dir: { kind: 'up', def: [45, -100], min: 25 } },
      anim: { keys: [[0, st, 'out'], [2, ps.prejump, 'snap'], [3, ps.rise, 'lin'], [7, ps.rise, 'lin']] },
    },
    airjump: {
      id: 'airjump', name: 'Air Jump', cat: 'move', icon: 'airjump', total: 6, where: 'air', script: 'airjump', uses: 'airJump', land: 'end',
      desc: 'Jump again in mid-air, aimed like a normal jump.',
      param: { dir: { kind: 'up', def: [40, -100], min: 25 } },
      anim: { keys: [[0, ps.ball, 'out'], [3, ps.rise, 'lin'], [6, ps.rise, 'lin']], spin: { f0: 0, f1: 5, deg: -360 } },
    },
    airdash: {
      id: 'airdash', name: 'Air Dash', cat: 'move', icon: 'airdash', total: 14, where: 'air', script: 'airdash', uses: 'airDash',
      float: [0, 10], land: 'end',
      desc: 'Dash through the air in any direction, ignoring gravity briefly.',
      param: { dir: { kind: 'free', def: [100, 0], min: 40 } },
      anim: { keys: [[0, ps.apex, 'snap'], [2, ps.airdash, 'lin'], [10, ps.airdash, 'io'], [14, ps.fall, 'lin']], power: [0, 10] },
    },
    fastfall: {
      id: 'fastfall', name: 'Fast Fall', cat: 'move', icon: 'fastfall', total: 40, where: 'air', script: 'fastfall', land: 'end',
      desc: 'Plummet straight to the ground.',
      anim: still(P(ps.fall, { fs: 150, bs: 140, fh: 10, fk: 10, bh: -10, bk: 20, torso: -4, sq: 0.08 })),
    },
    block: {
      id: 'block', name: 'Block', cat: 'defend', icon: 'block', total: 14, where: 'any', land: 'keep', block: true,
      desc: 'Guard against strikes and projectiles for a set number of frames. Loses to grabs.',
      amtIsLength: true,
      param: { amt: { min: 3, max: 40, def: 14, label: 'Frames', unit: 'f' } },
      anim: { keys: [[0, st, 'out'], [2, ps.guard, 'lin']] },
    },
    parry: {
      id: 'parry', name: 'Parry', cat: 'defend', icon: 'parry', total: 23, where: 'any', land: 'keep', parry: true,
      desc: 'Pick the exact frame the hit lands. A clean parry stuns the attacker; a miss leaves you wide open. Loses to grabs.',
      param: { amt: { min: 1, max: 30, def: 6, label: 'Parry on frame', unit: 'f' } },
      // The renderer keys this one off the chosen frame.
      anim: still(ps.parryReady),
    },
    roll: {
      id: 'roll', name: 'Roll', cat: 'defend', icon: 'roll', total: 26, where: 'ground', script: 'roll',
      desc: 'Roll forward or back, fully invulnerable for frames 2-15. Slow to recover.',
      invuln: [{ f0: 2, f1: 15, vs: 'all' }],
      sp: { from: 2, to: 16, speed: 9 },
      param: { dir: { kind: 'side', def: [100, 0] } },
      anim: rollAnim(ps, 26, 2, 16),
    },
    burst: {
      id: 'burst', name: 'Burst', cat: 'defend', icon: 'burst', total: 32, where: 'any', land: 'keep', burst: true,
      script: 'burst', float: [0, 16],
      desc: 'Explode outward. Usable in hitstun to break a combo. Needs a full burst gauge.',
      invuln: [{ f0: 0, f1: 20, vs: 'all' }],
      hitboxes: [{ f0: 5, f1: 9, x: 0, y: -55, r: 150, dmg: 20, hitstun: 26, kb: [14, -9], radial: true, unblockable: true, hitlag: 10, fx: 'blast' }],
      anim: { keys: [[0, ps.burstWind, 'snap'], [5, ps.burstOut, 'out'], [14, P(ps.burstOut, { fs: 140, bs: 180, sq: 0 }), 'io'], [32, st, 'lin']], power: [0, 14] },
    },
    getup: {
      id: 'getup', name: 'Get Up', cat: 'wake', icon: 'getup', total: 16, where: 'ground', wake: true,
      desc: 'Stand up in place. Invulnerable for frames 0-11.',
      invuln: [{ f0: 0, f1: 11, vs: 'all' }],
      anim: { keys: [[0, ps.lying, 'out'], [7, ps.getup, 'io'], [16, st, 'lin']] },
    },
    wake_roll: {
      id: 'wake_roll', name: 'Tech Roll', cat: 'wake', icon: 'roll', total: 28, where: 'ground', wake: true, script: 'roll',
      desc: 'Roll away (or under them) while getting up. Invulnerable for frames 0-17.',
      invuln: [{ f0: 0, f1: 17, vs: 'all' }],
      sp: { from: 3, to: 17, speed: 8 },
      param: { dir: { kind: 'side', def: [-100, 0] } },
      anim: { ...rollAnim(ps, 28, 3, 17), keys: [[0, ps.lying, 'out'], ...rollAnim(ps, 28, 3, 17).keys.slice(1)] },
    },
    wake_attack: {
      id: 'wake_attack', name: 'Rising Kick', cat: 'wake', icon: 'wakekick', total: 36, where: 'ground', wake: true,
      desc: 'Get up swinging. Invulnerable until it hits on frame 10, but very punishable on block.',
      invuln: [{ f0: 0, f1: 9, vs: 'all' }],
      hitboxes: [{ f0: 10, f1: 13, x: 46, y: -34, r: 30, dmg: 40, hitstun: 18, blockstun: 10, kb: [7, -4], fx: 'medium', bone: 'fFoot' }],
      anim: {
        keys: [
          [0, ps.lying, 'out'],
          [8, P(ps.getup, { fh: 30, fk: 120 }), 'snap'],
          [10, P(st, { torso: -24, chest: -6, fh: 96, fk: 0, fa: 30, bh: -12, bk: 24, fs: 40, bs: -40 }), 'out'],
          [14, P(st, { torso: -18, chest: -4, fh: 88, fk: 10, fa: 20, bh: -12, bk: 24, fs: 40, bs: -40 }), 'io'],
          [24, ps.crouch, 'io'],
          [36, st, 'lin'],
        ],
        trail: { limb: 'fl', f0: 10, f1: 13 },
      },
    },
    land: {
      id: 'land', name: 'Landing', cat: 'system', icon: 'dot', total: 4, where: 'any', land: 'keep', hidden: true, noTurn: true,
      amtIsLength: true, desc: '',
      anim: { keys: [[0, ps.land, 'io'], [6, st, 'lin']] },
    },
  };
}
