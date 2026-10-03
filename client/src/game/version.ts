/**
 * A fingerprint of everything that affects the simulation. Two clients may
 * only play online if their fingerprints match, so a stale cached build can
 * never desync a match.
 */

import { CHARACTERS, STAGES } from '../content/roster';

function strip(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      if (k === 'anim' || k === 'desc' || k === 'blurb' || k === 'palettes' || k === 'build' || k === 'stance' || k === 'icon' || k === 'name' || k === 'title' || k === 'look' || k === 'subtitle' || k === 'theme') continue;
      o[k] = strip((v as Record<string, unknown>)[k]);
    }
    return o;
  }
  return v;
}

function hash(s: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822519);
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

export const SIM_VERSION = 'ff2-' + hash(JSON.stringify(strip({ CHARACTERS, STAGES })));
export const APP_VERSION = '2.0.0';
