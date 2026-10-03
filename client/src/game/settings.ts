/** Player settings, persisted per device. */

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  /** Resolution playback speed multiplier. */
  speed: number;
  /** Ghost preview plays automatically when you pick a move. */
  ghost: boolean;
  /** Show frame data on move cards and status tags. */
  frameData: boolean;
  shake: number;
  reducedMotion: boolean;
  hitboxes: boolean;
  cpu: 0 | 1 | 2;
  name: string;
  rounds: number;
  stage: string;
  /** Characters + palettes last picked for each side. */
  lastPick: [string, string, number, number];
  seenGuide: boolean;
}

const KEY = 'framefeud.settings.v2';

const DEFAULTS: Settings = {
  master: 0.8,
  music: 0.5,
  sfx: 0.9,
  speed: 1,
  ghost: true,
  frameData: true,
  shake: 1,
  reducedMotion: false,
  hitboxes: false,
  cpu: 1,
  name: '',
  rounds: 2,
  stage: 'dojo',
  lastPick: ['razor', 'titan', 0, 0],
  seenGuide: false,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings: Settings = load();

const listeners: ((s: Settings) => void)[] = [];

export function saveSettings(patch: Partial<Settings> = {}) {
  Object.assign(settings, patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* private mode */
  }
  for (const l of listeners) l(settings);
}

export function onSettings(fn: (s: Settings) => void) {
  listeners.push(fn);
}

// ------------------------------------------------------------ replays --

import type { MatchLog } from '../sim/resolve';

const RKEY = 'framefeud.replays.v2';

export interface SavedReplay {
  at: number;
  mode: string;
  log: MatchLog;
  winner: number | null;
}

export function saveReplay(r: SavedReplay) {
  try {
    const list = loadReplays();
    list.unshift(r);
    localStorage.setItem(RKEY, JSON.stringify(list.slice(0, 6)));
  } catch {
    /* quota */
  }
}

export function loadReplays(): SavedReplay[] {
  try {
    return JSON.parse(localStorage.getItem(RKEY) || '[]');
  } catch {
    return [];
  }
}
