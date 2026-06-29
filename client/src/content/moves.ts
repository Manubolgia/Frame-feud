/** Universal movement / defensive moves, tuned per-character from its stats. */

import { FX } from '../sim/fixed';
import type { CharacterDef, Hitbox, MoveDef, Vec2 } from '../sim/types';

export function hb(p: {
  ox: number;
  oy: number;
  r: number;
  dmg: number;
  kbx: number;
  kby: number;
  scaling: number;
  hitstun: number;
  start: number;
  end: number;
  hits?: number;
}): Hitbox {
  return {
    offset: { x: FX(p.ox), y: FX(p.oy) } as Vec2,
    radius: FX(p.r),
    damage: p.dmg,
    knockback: { x: FX(p.kbx), y: FX(p.kby) } as Vec2,
    knockbackScaling: p.scaling,
    hitstun: p.hitstun,
    activeStart: p.start,
    activeEnd: p.end,
    hits: p.hits,
  };
}

/** Build the shared movement/jump/defence kit, scaled to a character's stats. */
export function universalMoves(stats: {
  walk: number;
  air: number;
  jump: number;
  dash: number;
}): Record<string, MoveDef> {
  return {
    walk_left: {
      id: 'walk_left', name: 'Step', kind: 'movement',
      startup: 0, active: 22, recovery: 2, cost: 1, hitboxes: [],
      tags: ['left'], icon: 'step', iconFlip: true,
      selfMotion: [{ atTick: 0, velocity: { x: stats.walk, y: 0 } }],
      desc: 'Walk left a short distance.',
    },
    walk_right: {
      id: 'walk_right', name: 'Step', kind: 'movement',
      startup: 0, active: 22, recovery: 2, cost: 1, hitboxes: [],
      tags: ['right'], icon: 'step',
      selfMotion: [{ atTick: 0, velocity: { x: stats.walk, y: 0 } }],
      desc: 'Walk right a short distance.',
    },
    dash_left: {
      id: 'dash_left', name: 'Dash', kind: 'movement',
      startup: 2, active: 16, recovery: 6, cost: 2, hitboxes: [],
      tags: ['left'], icon: 'dash', iconFlip: true,
      selfMotion: [{ atTick: 2, velocity: { x: stats.dash, y: 0 } }],
      desc: 'Burst left, covering ground fast.',
    },
    dash_right: {
      id: 'dash_right', name: 'Dash', kind: 'movement',
      startup: 2, active: 16, recovery: 6, cost: 2, hitboxes: [],
      tags: ['right'], icon: 'dash',
      selfMotion: [{ atTick: 2, velocity: { x: stats.dash, y: 0 } }],
      desc: 'Burst right, covering ground fast.',
    },
    jump: {
      id: 'jump', name: 'Jump', kind: 'jump',
      startup: 1, active: 1, recovery: 0, cost: 1, hitboxes: [], icon: 'jump',
      selfMotion: [{ atTick: 1, velocity: { x: 0, y: stats.jump } }],
      desc: 'Leap straight up.',
    },
    hop_left: {
      id: 'hop_left', name: 'Leap', kind: 'jump',
      startup: 1, active: 1, recovery: 0, cost: 1, hitboxes: [],
      tags: ['left'], icon: 'hop', iconFlip: true,
      selfMotion: [{ atTick: 1, velocity: { x: stats.air, y: stats.jump } }],
      desc: 'Jump up and to the left.',
    },
    hop_right: {
      id: 'hop_right', name: 'Leap', kind: 'jump',
      startup: 1, active: 1, recovery: 0, cost: 1, hitboxes: [],
      tags: ['right'], icon: 'hop',
      selfMotion: [{ atTick: 1, velocity: { x: stats.air, y: stats.jump } }],
      desc: 'Jump up and to the right.',
    },
    shield: {
      id: 'shield', name: 'Shield', kind: 'shield',
      startup: 2, active: 26, recovery: 6, cost: 1, hitboxes: [], icon: 'shield',
      desc: 'Block incoming hits (chip pushback only).',
    },
    dodge: {
      id: 'dodge', name: 'Dodge', kind: 'shield',
      startup: 0, active: 14, recovery: 10, cost: 1, hitboxes: [],
      invulnFrames: 14, icon: 'dodge',
      selfMotion: [{ atTick: 0, velocity: { x: 0, y: 0 } }],
      desc: 'Brief invulnerability — slip through an attack.',
    },
  };
}

export function mergeMoves(
  base: Record<string, MoveDef>,
  attacks: Record<string, MoveDef>,
): Record<string, MoveDef> {
  return { ...base, ...attacks };
}

export type { CharacterDef };
