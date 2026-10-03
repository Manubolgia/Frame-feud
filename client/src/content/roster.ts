/** The roster and the stages. */

import type { CharacterDef, MatchConfig, SimCtx, StageDef } from '../sim/types';
import { ARC } from './arc';
import { GRIP } from './grip';
import { RAZOR } from './razor';
import { TITAN } from './titan';

export const CHARACTERS: Record<string, CharacterDef> = {
  razor: RAZOR,
  titan: TITAN,
  arc: ARC,
  grip: GRIP,
};

export const ROSTER = ['razor', 'titan', 'arc', 'grip'];

/** Family Feud: every member of a family wears the family's colours
 *  ([main, trim, glow]), so each side reads at a glance. */
export const FAMILY_COLORS: { name: string; c: [number, number, number] }[] = [
  { name: 'Azure', c: [0x2ee6ff, 0x13303f, 0xc8fbff] },
  { name: 'Crimson', c: [0xff4f5e, 0x3a0f16, 0xffd0d6] },
  { name: 'Gold', c: [0xffc93d, 0x3a2e0c, 0xfff2b0] },
  { name: 'Violet', c: [0xb36bff, 0x221338, 0xeedcff] },
  { name: 'Jade', c: [0x4dff9c, 0x113a24, 0xd6ffe7] },
  { name: 'Ember', c: [0xff8a3d, 0x3a1d10, 0xffdcc2] },
];

/** Colours side i wears for a given fighter: family colours in a feud, the
 *  fighter's own palette otherwise. Same-colour mirrors shift side 1. */
/** "The CPU family", or "Your family" for the local player called "You". */
export function familyName(player: string): string {
  return player.trim().toLowerCase() === 'you' ? 'Your family' : `The ${player} family`;
}

export function colorsFor(cfg: Pick<MatchConfig, 'teams' | 'palettes'>, i: number, char: string, other?: string): [number, number, number] {
  if (cfg.teams) {
    let k = cfg.palettes[i] % FAMILY_COLORS.length;
    if (i === 1 && cfg.palettes[0] % FAMILY_COLORS.length === k) k = (k + 1) % FAMILY_COLORS.length;
    return FAMILY_COLORS[k].c;
  }
  const def = CHARACTERS[char];
  let k = cfg.palettes[i] % def.palettes.length;
  if (i === 1 && other === char && cfg.palettes[0] % def.palettes.length === k) k = (k + 1) % def.palettes.length;
  return def.palettes[k];
}

export const STAGES: Record<string, StageDef> = {
  dojo: { id: 'dojo', name: 'Dawn Dojo', subtitle: 'Mountain temple at first light', halfWidth: 700, ceiling: 900, theme: 'dojo' },
  rooftop: { id: 'rooftop', name: 'Neon Rooftop', subtitle: 'Above the city, after midnight', halfWidth: 820, ceiling: 1000, theme: 'rooftop' },
  forge: { id: 'forge', name: 'Skyforge', subtitle: 'A tight arena in the clouds', halfWidth: 600, ceiling: 860, theme: 'forge' },
  lab: { id: 'lab', name: 'Training Lab', subtitle: 'Grid floor, no distractions', halfWidth: 760, ceiling: 1000, theme: 'lab' },
};

export const STAGE_LIST = ['dojo', 'rooftop', 'forge', 'lab'];

export function ctxFor(stageId: string): SimCtx {
  return { chars: CHARACTERS, stage: STAGES[stageId] ?? STAGES.dojo };
}
