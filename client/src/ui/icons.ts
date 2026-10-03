/**
 * Line-art SVG icons (24×24, currentColor). Every move and UI control uses
 * one of these; there is no emoji or bitmap art anywhere in the game.
 */

const I: Record<string, string> = {
  // ---------------------------------------------------------- movement
  wait: `<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>`,
  walk: `<circle cx="13" cy="4.5" r="1.8"/><path d="M12 8l-2 5 3 2v5M10 13l-3 7M12 8l3 3 3 1M12 8l-3 2-2 3"/>`,
  dash: `<path d="M3 12h7M5 8h5M5 16h5"/><path d="M13 7l5 5-5 5"/><path d="M17 7l5 5-5 5" opacity=".5"/>`,
  backdash: `<path d="M21 12h-7M19 8h-5M19 16h-5"/><path d="M11 7l-5 5 5 5"/><path d="M7 7l-5 5 5 5" opacity=".5"/>`,
  jump: `<path d="M12 20V6"/><path d="M7 11l5-5 5 5"/><path d="M5 21h14" opacity=".45"/>`,
  airjump: `<path d="M12 18V6"/><path d="M7 11l5-5 5 5"/><path d="M8 20h8" stroke-dasharray="2 2"/>`,
  airdash: `<path d="M4 15l7-6"/><path d="M8 9h4v4"/><path d="M13 15l7-6"/><path d="M17 9h4v4" opacity=".5"/>`,
  fastfall: `<path d="M12 3v14"/><path d="M7 12l5 5 5-5"/><path d="M5 21h14"/>`,
  hover: `<circle cx="12" cy="8" r="3"/><path d="M5 15c2 1.5 4.5 2 7 2s5-.5 7-2"/><path d="M8 20c1.2.6 2.5 1 4 1s2.8-.4 4-1" opacity=".5"/>`,
  // ---------------------------------------------------------- defence
  block: `<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>`,
  parry: `<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M13 7l-3 5h4l-3 5"/>`,
  roll: `<circle cx="12" cy="12" r="7"/><path d="M12 5a7 7 0 0 1 7 7"/><path d="M17 9l2 3 2-3" /><circle cx="12" cy="12" r="2"/>`,
  burst: `<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/>`,
  getup: `<path d="M4 20h16"/><circle cx="15" cy="6" r="2"/><path d="M15 9v5l-3 6M15 14l3 6M15 10l-4 2"/>`,
  wakekick: `<path d="M4 20h16"/><circle cx="7" cy="12" r="2"/><path d="M9 13l4 2 6-5"/><path d="M13 15l-2 5"/>`,
  // ---------------------------------------------------------- strikes
  punch: `<rect x="9" y="8" width="10" height="8" rx="2.5"/><path d="M9 11H3M9 14H5"/><path d="M12 8v3M15 8v3"/>`,
  palm: `<path d="M8 20v-8l-2-3M8 12V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10V5.5a1.5 1.5 0 0 1 3 0V13c0 4-2 7-6 7H8"/><path d="M20 8l2-1M20 12h2" opacity=".6"/>`,
  chop: `<path d="M5 19L17 7"/><path d="M14 4l6 6"/><path d="M4 15l5 5" opacity=".5"/>`,
  slash: `<path d="M4 20C10 18 17 12 20 4"/><path d="M8 20l-4 0 0-4" opacity=".6"/><path d="M17 4h3v3"/>`,
  flurry: `<path d="M3 8h9M3 12h12M3 16h9"/><path d="M14 6l4 2-4 2M17 10l4 2-4 2M14 14l4 2-4 2"/>`,
  airslash: `<path d="M4 18C9 16 15 11 19 4"/><path d="M14 20h6" opacity=".4"/><path d="M15 4h4v4"/>`,
  kickup: `<path d="M4 20h16" opacity=".45"/><circle cx="8" cy="5" r="2"/><path d="M8 8v6l-2 6M8 14l7-9"/><path d="M15 5l2-3M17 8l3-1" opacity=".6"/>`,
  sweep: `<path d="M3 20h18"/><circle cx="6" cy="9" r="2"/><path d="M6 12l3 4 10 1"/><path d="M15 13l4 4" opacity=".5"/>`,
  lowkick: `<path d="M3 20h18"/><circle cx="7" cy="5" r="2"/><path d="M7 8v6l-2 6M7 13l11 4"/>`,
  airkick: `<circle cx="7" cy="6" r="2"/><path d="M7 9l2 5 9 1M9 14l-3 5"/><path d="M19 12l2 2-2 2" opacity=".6"/>`,
  spin: `<path d="M5 12a7 7 0 1 1 2.1 5"/><path d="M4 12l3 1 1-3"/><circle cx="12" cy="12" r="2"/>`,
  dive: `<circle cx="7" cy="5" r="2"/><path d="M8 8l4 4 6 8M12 12l-4 2"/><path d="M14 21h7" opacity=".5"/>`,
  uppercut: `<path d="M12 21V9"/><path d="M8 13l4-4 4 4"/><rect x="9" y="2" width="6" height="6" rx="2"/>`,
  piston: `<rect x="11" y="8" width="9" height="8" rx="2.5"/><path d="M11 12H6M6 9v6M3 9v6"/>`,
  pound: `<path d="M12 3v8"/><path d="M8 7l4 4 4-4"/><path d="M3 15l3 3 3-3 3 3 3-3 3 3 3-3"/>`,
  charge: `<path d="M3 12h8"/><path d="M4 8h5M4 16h5" opacity=".5"/><rect x="12" y="7" width="8" height="10" rx="3"/><path d="M20 10l2 2-2 2"/>`,
  missile: `<path d="M5 19c3-8 9-12 15-14"/><path d="M20 5l-1 4-3-3z"/><path d="M4 20l2-3M6 21l1-3" opacity=".5"/>`,
  slam: `<path d="M12 3v11"/><path d="M8 10l4 4 4-4"/><path d="M4 18h16"/><path d="M6 21l2-3M18 21l-2-3" opacity=".6"/>`,
  hammer: `<rect x="5" y="4" width="8" height="6" rx="1.5"/><path d="M11 10l8 10"/><path d="M15 6l3-2" opacity=".5"/>`,
  headbutt: `<circle cx="13" cy="9" r="4"/><path d="M9 12l-4 7M13 13v7"/><path d="M19 7l2-1M19 10h3M19 13l2 1" opacity=".6"/>`,
  lariat: `<circle cx="12" cy="7" r="2"/><path d="M3 11h18M12 9v6l-3 6M12 15l3 6"/><path d="M3 8c2-2 4-3 6-3M21 14c-2 2-4 3-6 3" opacity=".5"/>`,
  leap: `<path d="M3 20c3-12 15-12 18 0"/><path d="M18 17l3 3 1-4"/><circle cx="12" cy="6" r="1.8"/>`,
  elbow: `<path d="M8 3l4 9 6 2"/><path d="M12 12l-2 4"/><path d="M4 21h16"/><path d="M9 18l3 2 3-2" opacity=".6"/>`,
  grab: `<path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V10M10 9V5a1.5 1.5 0 0 1 3 0v5M13 9.5V6a1.5 1.5 0 0 1 3 0v6c0 4.5-2.5 8-6.5 8-2.5 0-4-1.5-5-3l-2-3.5c-.6-1 .7-2.1 1.6-1.3L7 15"/>`,
  piledriver: `<path d="M12 3v6"/><circle cx="12" cy="12" r="3"/><path d="M12 15v4"/><path d="M5 21h14"/><path d="M8 6l4-3 4 3"/>`,
  rush: `<path d="M3 12h5M3 8h3M3 16h3"/><path d="M10 7v10"/><path d="M13 9.5V6a1.5 1.5 0 0 1 3 0v4M16 9V5.5a1.5 1.5 0 0 1 3 0V13c0 3-2 5-5 5"/>`,
  // ---------------------------------------------------------- energy
  bolt: `<path d="M3 12h7"/><path d="M13 5l-2 7h5l-2 7"/><path d="M18 9l3 3-3 3" opacity=".6"/>`,
  orb: `<circle cx="12" cy="12" r="5"/><circle cx="10.5" cy="10.5" r="1.5"/><path d="M3 12h2M19 12h2M12 3v2M12 19v2" opacity=".55"/>`,
  detonate: `<circle cx="12" cy="13" r="5"/><path d="M12 8V4M15 9l2-3M9 9L7 6"/><path d="M10 13l2-2 2 2-2 2z"/>`,
  blink: `<path d="M4 12h3" stroke-dasharray="1.5 2"/><circle cx="16" cy="12" r="4"/><path d="M9 6l2 2M9 18l2-2" opacity=".6"/>`,
  teleport: `<path d="M3 12h4" stroke-dasharray="1.5 2"/><path d="M14 4v16"/><path d="M10 8l4-4 4 4M10 16l4 4 4-4" opacity=".55"/>`,
  kunai: `<path d="M4 20l9-9"/><path d="M13 11l7-7-2 6-5 1z"/><circle cx="4.5" cy="19.5" r="1.5"/>`,
  spark: `<path d="M13 2l-5 10h4l-2 10 7-12h-4l3-8z"/>`,
  // ---------------------------------------------------------- supers
  super1: `<path d="M12 2l2.6 6.4L21 9l-5 4.4L17.5 20 12 16.6 6.5 20 8 13.4 3 9l6.4-.6z"/>`,
  super2: `<path d="M12 2l2.6 6.4L21 9l-5 4.4L17.5 20 12 16.6 6.5 20 8 13.4 3 9l6.4-.6z"/><circle cx="12" cy="11.5" r="2.4"/>`,
  // ---------------------------------------------------------- ui
  play: `<path d="M7 4l13 8-13 8z"/>`,
  pause: `<path d="M8 5v14M16 5v14"/>`,
  stepback: `<path d="M6 5v14"/><path d="M19 5l-10 7 10 7z"/>`,
  stepfwd: `<path d="M18 5v14"/><path d="M5 5l10 7-10 7z"/>`,
  replay: `<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/>`,
  ff: `<path d="M4 6l8 6-8 6zM12 6l8 6-8 6z"/>`,
  gear: `<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>`,
  back: `<path d="M15 5l-7 7 7 7"/>`,
  close: `<path d="M6 6l12 12M18 6L6 18"/>`,
  check: `<path d="M5 12l5 5L19 7"/>`,
  sound: `<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>`,
  mute: `<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9l5 6M21 9l-5 6"/>`,
  eye: `<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>`,
  eyeoff: `<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.8M6.1 6.2A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.3-1"/>`,
  help: `<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7v.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>`,
  info: `<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r=".7" fill="currentColor"/>`,
  user: `<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4-7 8-7s7 2.5 8 7"/>`,
  users: `<circle cx="9" cy="8" r="3.5"/><path d="M2 20c.8-4 3.4-6 7-6s6.2 2 7 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.5 0 4.3 1.5 5 4.5"/>`,
  cpu: `<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>`,
  globe: `<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>`,
  target: `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>`,
  book: `<path d="M4 5c3-1 5.5-1 8 1 2.5-2 5-2 8-1v14c-3-1-5.5-1-8 1-2.5-2-5-2-8-1z"/><path d="M12 6v14"/>`,
  copy: `<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>`,
  share: `<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>`,
  trophy: `<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6"/>`,
  chevron: `<path d="M6 9l6 6 6-6"/>`,
  chevup: `<path d="M6 15l6-6 6 6"/>`,
  lock: `<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>`,
  library: `<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="8.5" cy="12" r="2"/><circle cx="15.5" cy="12" r="2"/><path d="M8 18l1.5-2.5h5L16 18"/>`,
  exit: `<path d="M10 4H5v16h5"/><path d="M14 8l4 4-4 4M9 12h9"/>`,
  dice: `<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.1" fill="currentColor"/><circle cx="15" cy="15" r="1.1" fill="currentColor"/><circle cx="15" cy="9" r="1.1" fill="currentColor"/><circle cx="9" cy="15" r="1.1" fill="currentColor"/>`,
  list: `<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>`,
  wifi: `<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1" fill="currentColor"/>`,
  dot: `<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>`,
};

export function icon(name: string, size = 22, cls = ''): string {
  const inner = I[name] ?? I.dot;
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

export function iconEl(name: string, size = 22, cls = ''): HTMLElement {
  const s = document.createElement('span');
  s.className = 'ico-wrap';
  s.innerHTML = icon(name, size, cls);
  return s;
}

export const hasIcon = (n: string) => n in I;
