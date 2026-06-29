/**
 * Hand-drawn line-art SVG icon set. No emoji anywhere in the app — every move
 * and UI affordance uses one of these. Icons are 24x24, currentColor stroke so
 * they tint with CSS, round joins for a clean, professional feel.
 */

const I: Record<string, string> = {
  // --- movement / defense ---
  step: `<path d="M6 12h9"/><path d="M11 8l5 4-5 4"/>`,
  dash: `<path d="M4 12h8"/><path d="M9 8l4 4-4 4"/><path d="M15 8l4 4-4 4"/>`,
  jump: `<path d="M12 20V7"/><path d="M7 12l5-6 5 6"/><path d="M6 20h12" opacity=".5"/>`,
  hop: `<path d="M5 18l7-9 3 4 4-7"/><path d="M19 6l1 4-4 0" fill="currentColor" stroke="none"/>`,
  shield: `<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/>`,
  dodge: `<path d="M12 4a8 8 0 1 0 6 3"/><path d="M18 3v4h-4"/>`,
  counter: `<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/><path d="M9 12l2 2 4-4"/>`,

  // --- physical strikes ---
  fist: `<rect x="7" y="9" width="10" height="8" rx="2"/><path d="M9 9V7m3 2V6m3 3V7"/>`,
  swipe: `<path d="M4 16c6 1 12-2 16-9"/><path d="M20 7l-1 5-4-2" fill="currentColor" stroke="none"/>`,
  uppercut: `<path d="M12 21V8"/><path d="M7 13l5-6 5 6"/><circle cx="12" cy="5" r="2"/>`,
  stomp: `<path d="M12 3v9"/><path d="M8 8l4 4 4-4"/><path d="M5 17h14"/><path d="M6 20l1-3m11 3l-1-3" opacity=".6"/>`,
  hammer: `<path d="M5 19l8-8"/><rect x="11" y="3" width="9" height="6" rx="1" transform="rotate(45 15 6)"/>`,
  quake: `<path d="M3 9l3 4 3-7 3 9 3-7 3 5 3-3"/><path d="M3 17h18" opacity=".6"/>`,
  charge: `<path d="M5 12h10"/><path d="M11 7l5 5-5 5"/><path d="M17 7v10" /><path d="M20 7v10"/>`,
  rocket: `<path d="M12 21V9"/><path d="M9 13l3-5 3 5"/><path d="M8 8c0-3 2-5 4-5s4 2 4 5"/><path d="M10 21l2-3 2 3" fill="currentColor" stroke="none"/>`,
  grab: `<path d="M8 7v6a4 4 0 0 0 8 0V7"/><path d="M8 7l-2 3m10-3l2 3"/><circle cx="12" cy="17" r="1.5" fill="currentColor" stroke="none"/>`,
  spin: `<path d="M5 12a7 7 0 1 1 2 5"/><path d="M4 12l3 1 1-3" fill="currentColor" stroke="none"/>`,
  blade: `<path d="M5 17l9-9"/><path d="M14 8l3-3 2 2-3 3z" fill="currentColor" stroke="none"/><path d="M9 17l3 3" opacity=".6"/>`,
  slash: `<path d="M6 18L18 6"/><path d="M6 18l1-5 4 1" fill="currentColor" stroke="none"/><path d="M18 6l-1 5-4-1" fill="currentColor" stroke="none"/>`,
  flip: `<path d="M7 16a6 6 0 1 1 9-1"/><path d="M16 9l1 5-5-1" fill="currentColor" stroke="none"/><path d="M9 19l3-3 3 3"/>`,
  dive: `<path d="M12 3v12"/><path d="M7 10l5 6 5-6"/><path d="M6 20h12" opacity=".5"/>`,
  suplex: `<circle cx="9" cy="6" r="2.2"/><path d="M9 8c4 0 6 4 6 8"/><path d="M15 16l3-2m-3 2l1 3"/>`,
  slam: `<circle cx="12" cy="6" r="2.4"/><path d="M12 8v5"/><path d="M6 18h12"/><path d="M9 13l3 5 3-5"/>`,

  // --- energy / projectiles ---
  pulse: `<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" opacity=".5"/>`,
  bolt: `<path d="M4 12h8"/><path d="M12 8l5 4-5 4"/><circle cx="18" cy="12" r="2.4" fill="currentColor" stroke="none"/>`,
  rail: `<path d="M3 12h13"/><path d="M16 9l4 3-4 3z" fill="currentColor" stroke="none"/><path d="M4 9v6m3-6v6" opacity=".5"/>`,
  burst: `<path d="M12 4v4m0 8v4m8-8h-4M8 12H4m12-5l-3 3m-6 6l-3 3m12 0l-3-3M7 7l-3-3"/>`,
  nova: `<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/><path d="M12 3v3m0 12v3m9-9h-3M6 12H3m13-6l-2 2m-6 6l-2 2m10 0l-2-2M8 8L6 6"/>`,
  mine: `<circle cx="12" cy="14" r="4"/><path d="M12 6v4m-4 6l-2 2m12-2l2 2"/><circle cx="12" cy="14" r="1.3" fill="currentColor" stroke="none"/>`,
  beam: `<path d="M3 12h18"/><path d="M3 9v6m4-7v8m4-9v10m4-9v8m4-7v6" opacity=".7"/>`,
  teleport: `<path d="M7 5L17 5 7 19h10"/><circle cx="12" cy="12" r="9" opacity=".35"/>`,

  // --- ui ---
  sound_on: `<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18 7a7 7 0 0 1 0 10" />`,
  sound_off: `<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9l5 6m0-6l-5 6"/>`,
  copy: `<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>`,
  back: `<path d="M15 6l-6 6 6 6"/>`,
  crown: `<path d="M4 8l4 5 4-8 4 8 4-5v9H4z"/>`,
  clear: `<path d="M4 8a8 8 0 1 1-1 4"/><path d="M3 4v5h5" fill="currentColor" stroke="none"/>`,
  undo: `<path d="M9 7L4 12l5 5"/><path d="M4 12h9a6 6 0 0 1 0 12H8" opacity=".9"/>`,
  dot: `<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>`,
};

export interface IconOpts {
  size?: number;
  flip?: boolean;
  cls?: string;
  fill?: boolean;
}

/** Return an inline SVG string for the named icon. */
export function icon(name: string, opts: IconOpts = {}): string {
  const inner = I[name] ?? I.dot;
  const size = opts.size ?? 24;
  const flip = opts.flip ? ' style="transform:scaleX(-1)"' : '';
  const cls = opts.cls ? ` class="${opts.cls}"` : '';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}"${cls}${flip} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

export function hasIcon(name: string): boolean {
  return name in I;
}
