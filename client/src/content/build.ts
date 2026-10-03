/** Turns authoring-friendly character sheets (pixels, px/frame) into the
 *  sub-pixel CharacterDefs the simulation runs on. */

import { px } from '../sim/fixed';
import type { BuildDef, CharacterDef, MoveDef, ProjectileDef } from '../sim/types';
import { poseSet, type Pose, type PoseSet } from './poses';
import { HITPOS } from './hitpos';
import { universalMoves } from './universal';

export interface Sheet {
  id: string;
  name: string;
  title: string;
  archetype: string;
  blurb: string;
  color: number;
  palettes: [number, number, number][];
  hp: number;
  /** px/frame */
  walk: number;
  dash: number;
  backdash: number;
  jump: number;
  airSpeed: number;
  /** px/frame² */
  gravity: number;
  maxFall: number;
  fastFall: number;
  airJumps: number;
  airDashes: number;
  airDash: number;
  width: number;
  height: number;
  kbMul: number;
  ratings: CharacterDef['ratings'];
  difficulty: 1 | 2 | 3;
  build: BuildDef;
  stance: Pose;
  /** Overrides of the default pose set (locomotion, guard, hurt...). */
  poses?: Partial<PoseSet>;
  moves: MoveDef[];
  projectiles?: ProjectileDef[];
  /** Universal moves this character does not get. */
  without?: string[];
}

const MENU_ORDER = [
  'wait', 'walk', 'dash', 'backdash', 'jump', 'airjump', 'airdash', 'fastfall',
  'block', 'parry', 'roll', 'burst',
  'getup', 'wake_roll', 'wake_attack',
];

export function character(s: Sheet): CharacterDef {
  const ps = poseSet(s.stance, s.poses);
  const uni = universalMoves(ps);
  for (const id of s.without ?? []) delete uni[id];
  const moves: Record<string, MoveDef> = { ...uni };
  for (const m of s.moves) {
    if (moves[m.id] && !uni[m.id]) throw new Error(`${s.id}: duplicate move ${m.id}`);
    moves[m.id] = m;
  }
  // Hitboxes that ride a limb follow it frame by frame (baked positions).
  for (const m of Object.values(moves)) {
    m.hitboxes?.forEach((hb, n) => {
      const path = hb.bone && !hb.aimed ? HITPOS[`${s.id}/${m.id}/${n}`] : undefined;
      if (path) m.hitboxes![n] = { ...hb, path };
    });
  }
  const projectiles: Record<string, ProjectileDef> = {};
  for (const p of s.projectiles ?? []) projectiles[p.id] = p;
  const order = [
    ...MENU_ORDER.filter((id) => moves[id]),
    ...s.moves.map((m) => m.id).filter((id) => !MENU_ORDER.includes(id)),
  ];
  return {
    id: s.id,
    name: s.name,
    title: s.title,
    archetype: s.archetype,
    blurb: s.blurb,
    color: s.color,
    palettes: s.palettes,
    hp: s.hp,
    walk: px(s.walk),
    dash: px(s.dash),
    backdash: px(s.backdash),
    jump: px(s.jump),
    airSpeed: px(s.airSpeed),
    gravity: px(s.gravity),
    maxFall: px(s.maxFall),
    fastFall: px(s.fastFall),
    airJumps: s.airJumps,
    airDashes: s.airDashes,
    airDash: px(s.airDash),
    width: s.width,
    height: s.height,
    kbMul: s.kbMul,
    ratings: s.ratings,
    difficulty: s.difficulty,
    build: s.build,
    stance: s.stance,
    poses: ps,
    moves,
    projectiles,
    order,
  };
}
