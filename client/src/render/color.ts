/** Colour helpers (cosmetic only). */

export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}

export const lighten = (c: number, t: number) => mix(c, 0xffffff, t);
export const darken = (c: number, t: number) => mix(c, 0x000000, t);
export const hex = (c: number) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');

export const INK = 0x0b0b14;

/** Damage % style colour ramp for health numbers. */
export function hpColor(frac: number): number {
  if (frac > 0.5) return mix(0xffd84a, 0x4dff9c, (frac - 0.5) * 2);
  return mix(0xff3b5c, 0xffd84a, frac * 2);
}
