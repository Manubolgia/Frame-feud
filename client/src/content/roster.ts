/** The roster and the stages. */

import type { CharacterDef, SimCtx, StageDef } from '../sim/types';
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
