/** Shared visual identity constants. */

export const PLAYER_COLORS = [0xff4d6d, 0x4da6ff, 0xffd24d, 0x6bff9e];
export const PLAYER_NAMES_DEFAULT = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];
export const PLAYER_GLYPHS = ['⬣', '⬢', '◆', '★'];

export function colorHex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

export function lighten(c: number, amt: number): number {
  const r = Math.min(255, ((c >> 16) & 0xff) + amt * 255);
  const g = Math.min(255, ((c >> 8) & 0xff) + amt * 255);
  const b = Math.min(255, (c & 0xff) + amt * 255);
  return (r << 16) | (g << 8) | b;
}

export function darken(c: number, amt: number): number {
  const r = Math.max(0, ((c >> 16) & 0xff) * (1 - amt));
  const g = Math.max(0, ((c >> 8) & 0xff) * (1 - amt));
  const b = Math.max(0, (c & 0xff) * (1 - amt));
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}

export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff,
    ag = (a >> 8) & 0xff,
    ab = a & 0xff;
  const br = (b >> 16) & 0xff,
    bg = (b >> 8) & 0xff,
    bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
