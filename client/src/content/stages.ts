/** Stages: geometry, spawns, blast zones. All fixed-point. */

import { FX } from '../sim/fixed';
import type { StageDef } from '../sim/types';

const skyforge: StageDef = {
  id: 'skyforge',
  name: 'Skyforge',
  platforms: [
    { x: FX(0), y: FX(0), w: FX(6.0), passThrough: false }, // main
    { x: FX(-3.8), y: FX(-2.8), w: FX(1.9), passThrough: true },
    { x: FX(3.8), y: FX(-2.8), w: FX(1.9), passThrough: true },
    { x: FX(0), y: FX(-5.0), w: FX(1.7), passThrough: true },
  ],
  spawns: [
    { x: FX(-3.2), y: FX(-3.5) },
    { x: FX(-1.1), y: FX(-3.5) },
    { x: FX(1.1), y: FX(-3.5) },
    { x: FX(3.2), y: FX(-3.5) },
  ],
  blastZones: {
    left: FX(-11.5),
    right: FX(11.5),
    top: FX(-9.5),
    bottom: FX(6.8),
  },
  bg: { top: 0x141430, bottom: 0x2a1a4a, accent: 0x6c4cff },
};

const tundra: StageDef = {
  id: 'tundra',
  name: 'Driftpeak',
  platforms: [
    { x: FX(0), y: FX(0.4), w: FX(7.2), passThrough: false },
    { x: FX(-4.6), y: FX(-3.2), w: FX(1.6), passThrough: true },
    { x: FX(4.6), y: FX(-3.2), w: FX(1.6), passThrough: true },
  ],
  spawns: [
    { x: FX(-3.6), y: FX(-3.0) },
    { x: FX(-1.2), y: FX(-3.0) },
    { x: FX(1.2), y: FX(-3.0) },
    { x: FX(3.6), y: FX(-3.0) },
  ],
  blastZones: {
    left: FX(-12.5),
    right: FX(12.5),
    top: FX(-9.0),
    bottom: FX(7.0),
  },
  bg: { top: 0x0b2030, bottom: 0x123a4a, accent: 0x4cc8ff },
};

export const STAGES: Record<string, StageDef> = { skyforge, tundra };
export const STAGE_LIST = ['skyforge', 'tundra'];
