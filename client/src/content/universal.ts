/**
 * The shared kit: movement, defence and wake-up options every fighter has.
 * Speeds come from each character's stats inside the sim scripts, so one
 * definition serves the whole roster.
 */

import type { MoveDef } from '../sim/types';
import { L, P, still, type AnimDef, type Pose } from './poses';

const walkAnim: AnimDef = { keys: [[0, L.walkA, 'io'], [8, L.walkB, 'io'], [16, L.walkA, 'lin']] };

function rollAnim(total: number, from: number, to: number): AnimDef {
  const ball = P(L.crouch, { torso: 70, head: 30, fs: 120, fe: 140, bs: 110, be: 140, fh: 120, fk: 150, bh: 100, bk: 150 });
  return {
    keys: [
      [0, L.crouch, 'out'],
      [from, ball, 'lin'],
      [to, ball, 'out'],
      [to + 3, L.crouch, 'io'],
      [total, L.stance, 'lin'],
    ],
    spin: { f0: from, f1: to, deg: 360 },
  };
}

export function universalMoves(stance: Pose): Record<string, MoveDef> {
  const st = stance;
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
      anim: walkAnim,
    },
    dash: {
      id: 'dash', name: 'Dash', cat: 'move', icon: 'dash', total: 18, where: 'ground', script: 'dash',
      desc: 'Burst toward your opponent. Distance is adjustable. Builds meter.',
      param: { amt: { min: 30, max: 100, def: 100, label: 'Distance', unit: '%' } },
      anim: { keys: [[0, st, 'out'], [2, L.dash, 'lin'], [11, L.dash, 'out'], [14, L.skid, 'io'], [18, st, 'lin']] },
    },
    backdash: {
      id: 'backdash', name: 'Back Dash', cat: 'move', icon: 'backdash', total: 20, where: 'ground', script: 'backdash',
      desc: 'Hop away from the fight. Invulnerable to strikes for frames 1-5.',
      invuln: [{ f0: 1, f1: 5, vs: 'strike' }],
      anim: { keys: [[0, st, 'out'], [2, L.backdash, 'lin'], [10, L.backdash, 'io'], [20, st, 'lin']] },
    },
    jump: {
      id: 'jump', name: 'Jump', cat: 'move', icon: 'jump', total: 7, where: 'ground', script: 'jump',
      desc: 'Aim your jump: the angle sets the direction, the length sets the height. 3 frames to leave the ground.',
      param: { dir: { kind: 'up', def: [45, -100], min: 25 } },
      anim: { keys: [[0, st, 'out'], [2, L.prejump, 'snap'], [3, L.rise, 'lin'], [7, L.rise, 'lin']] },
    },
    airjump: {
      id: 'airjump', name: 'Air Jump', cat: 'move', icon: 'airjump', total: 6, where: 'air', script: 'airjump', uses: 'airJump', land: 'end',
      desc: 'Jump again in mid-air, aimed like a normal jump.',
      param: { dir: { kind: 'up', def: [40, -100], min: 25 } },
      anim: { keys: [[0, L.apex, 'out'], [3, L.rise, 'lin'], [6, L.rise, 'lin']], spin: { f0: 0, f1: 6, deg: 0 } },
    },
    airdash: {
      id: 'airdash', name: 'Air Dash', cat: 'move', icon: 'airdash', total: 14, where: 'air', script: 'airdash', uses: 'airDash',
      float: [0, 10], land: 'end',
      desc: 'Dash through the air in any direction, ignoring gravity briefly.',
      param: { dir: { kind: 'free', def: [100, 0], min: 40 } },
      anim: { keys: [[0, L.apex, 'snap'], [2, L.airdash, 'lin'], [10, L.airdash, 'io'], [14, L.fall, 'lin']] },
    },
    fastfall: {
      id: 'fastfall', name: 'Fast Fall', cat: 'move', icon: 'fastfall', total: 40, where: 'air', script: 'fastfall', land: 'end',
      desc: 'Plummet straight to the ground.',
      anim: still(P(L.fall, { fs: 150, bs: 140, fh: 10, fk: 10, bh: -10, bk: 20, torso: -4 })),
    },
    block: {
      id: 'block', name: 'Block', cat: 'defend', icon: 'block', total: 14, where: 'any', land: 'keep', block: true,
      desc: 'Guard against strikes and projectiles. Loses to grabs.',
      amtIsLength: true,
      param: { amt: { min: 3, max: 40, def: 14, label: 'Frames', unit: 'f' } },
      anim: { keys: [[0, st, 'out'], [2, L.guard, 'lin']] },
    },
    parry: {
      id: 'parry', name: 'Parry', cat: 'defend', icon: 'parry', total: 23, where: 'any', land: 'keep', parry: true,
      desc: 'Pick the exact frame the hit lands. A clean parry stuns the attacker; a miss leaves you wide open. Loses to grabs.',
      param: { amt: { min: 1, max: 30, def: 6, label: 'Parry on frame', unit: 'f' } },
      // The renderer keys this one off the chosen frame.
      anim: still(L.parryReady),
    },
    roll: {
      id: 'roll', name: 'Roll', cat: 'defend', icon: 'roll', total: 26, where: 'ground', script: 'roll',
      desc: 'Roll forward or back, fully invulnerable for frames 2-15. Slow to recover.',
      invuln: [{ f0: 2, f1: 15, vs: 'all' }],
      sp: { from: 2, to: 16, speed: 9 },
      param: { dir: { kind: 'side', def: [100, 0] } },
      anim: rollAnim(26, 2, 16),
    },
    burst: {
      id: 'burst', name: 'Burst', cat: 'defend', icon: 'burst', total: 32, where: 'any', land: 'keep', burst: true,
      script: 'burst', float: [0, 16],
      desc: 'Explode outward. Usable in hitstun to break a combo. Needs a full burst gauge.',
      invuln: [{ f0: 0, f1: 20, vs: 'all' }],
      hitboxes: [{ f0: 5, f1: 9, x: 0, y: -55, r: 150, dmg: 20, hitstun: 26, kb: [14, -9], radial: true, unblockable: true, hitlag: 10, fx: 'blast' }],
      anim: {
        keys: [
          [0, P(L.crouch, { fs: 150, fe: 150, bs: 150, be: 150, torso: 30, head: 30 }), 'snap'],
          [5, P(L.victory, { fs: 160, fe: 0, bs: 200, be: 0, fh: 30, fk: 0, bh: -30, bk: 0, torso: -10, head: -20 }), 'lin'],
          [14, P(L.victory, { fs: 150, fe: 10, bs: 190, be: 10, fh: 26, fk: 10, bh: -26, bk: 10, torso: -6, head: -16 }), 'io'],
          [32, st, 'lin'],
        ],
      },
    },
    getup: {
      id: 'getup', name: 'Get Up', cat: 'wake', icon: 'getup', total: 16, where: 'ground', wake: true,
      desc: 'Stand up in place. Invulnerable for frames 0-11.',
      invuln: [{ f0: 0, f1: 11, vs: 'all' }],
      anim: { keys: [[0, L.lying, 'out'], [7, L.getup, 'io'], [16, st, 'lin']] },
    },
    wake_roll: {
      id: 'wake_roll', name: 'Tech Roll', cat: 'wake', icon: 'roll', total: 28, where: 'ground', wake: true, script: 'roll',
      desc: 'Roll away (or under them) while getting up. Invulnerable for frames 0-17.',
      invuln: [{ f0: 0, f1: 17, vs: 'all' }],
      sp: { from: 3, to: 17, speed: 8 },
      param: { dir: { kind: 'side', def: [-100, 0] } },
      anim: rollAnim(28, 3, 17),
    },
    wake_attack: {
      id: 'wake_attack', name: 'Rising Kick', cat: 'wake', icon: 'wakekick', total: 36, where: 'ground', wake: true,
      desc: 'Get up swinging. Invulnerable until it hits on frame 10, but very punishable on block.',
      invuln: [{ f0: 0, f1: 9, vs: 'all' }],
      hitboxes: [{ f0: 10, f1: 13, x: 46, y: -34, r: 46, dmg: 40, hitstun: 18, blockstun: 10, kb: [7, -4], fx: 'medium' }],
      anim: {
        keys: [
          [0, L.lying, 'out'],
          [8, P(L.getup, { fh: 30, fk: 120 }), 'snap'],
          [10, P(L.stance, { torso: -24, fh: 110, fk: 0, bh: -10, bk: 20, fs: 40, bs: -40 }), 'lin'],
          [14, P(L.stance, { torso: -18, fh: 100, fk: 10, bh: -10, bk: 20, fs: 40, bs: -40 }), 'io'],
          [24, L.crouch, 'io'],
          [36, st, 'lin'],
        ],
        trail: { limb: 'fl', f0: 10, f1: 13 },
      },
    },
    land: {
      id: 'land', name: 'Landing', cat: 'system', icon: 'dot', total: 4, where: 'any', land: 'keep', hidden: true, noTurn: true,
      amtIsLength: true, desc: '',
      anim: { keys: [[0, L.land, 'io'], [6, st, 'lin']] },
    },
  };
}
