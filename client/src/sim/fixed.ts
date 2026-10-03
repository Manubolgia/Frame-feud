/**
 * Integer math for the deterministic simulation.
 *
 * RULE: every value that feeds back into authoritative state is an integer.
 * Positions and velocities are stored in sub-pixels (SUB per pixel). Only
 * + - * and truncating division are used, plus an exact integer square root,
 * so two browsers (or a browser and Node) always produce identical frames.
 */

/** Sub-pixels per world pixel. */
export const SUB = 100;

/** Author-time helper: pixels (may be fractional) -> sub-pixels. Runs on
 *  literal constants only, so the rounding is stable everywhere. */
export const px = (n: number): number => Math.round(n * SUB);

export const toPx = (s: number): number => s / SUB;

export const sign = (a: number): number => (a > 0 ? 1 : a < 0 ? -1 : 0);
export const abs = (a: number): number => (a < 0 ? -a : a);

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Truncating integer division (toward zero). */
export const idiv = (a: number, b: number): number => (b === 0 ? 0 : Math.trunc(a / b));

/** a * num / den, truncated. */
export const scale = (a: number, num: number, den: number): number =>
  den === 0 ? 0 : Math.trunc((a * num) / den);

/** Exact floor(sqrt(n)) for non-negative integers. */
export function isqrt(n: number): number {
  if (n <= 0) return 0;
  let x = Math.floor(Math.sqrt(n));
  while (x * x > n) x--;
  while ((x + 1) * (x + 1) <= n) x++;
  return x;
}

export const len2 = (x: number, y: number): number => isqrt(x * x + y * y);

/** Rescale the vector (x, y) to integer length `mag`. */
export function withLength(x: number, y: number, mag: number): [number, number] {
  const l = len2(x, y);
  if (l === 0) return [0, 0];
  return [Math.trunc((x * mag) / l), Math.trunc((y * mag) / l)];
}

/** Integer lerp between a and b by t/den. */
export const lerpI = (a: number, b: number, t: number, den: number): number =>
  a + Math.trunc(((b - a) * t) / den);
