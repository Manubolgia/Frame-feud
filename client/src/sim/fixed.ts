/**
 * Fixed-point integer math for the deterministic simulation.
 *
 * RULE: Every value that feeds back into authoritative game state is an integer
 * scaled by FIXED_SCALE. We only ever use + - * and integer division with
 * explicit truncation. No Math.random, no Math.sin/cos, no sqrt-on-floats.
 * This guarantees byte-identical results across browsers / devices / Node.
 */

export type Fixed = number; // integer = (world unit * FIXED_SCALE)

export const FIXED_SCALE = 1000;
export const ONE: Fixed = FIXED_SCALE;
export const HALF: Fixed = FIXED_SCALE / 2;

export interface Vec2 {
  x: Fixed;
  y: Fixed;
}

/** Author-time helper: turn a human float constant into fixed. Deterministic
 *  because it runs on literal constants (IEEE-754 parse + round are stable). */
export const FX = (n: number): Fixed => Math.round(n * FIXED_SCALE);

export const fromInt = (n: number): Fixed => (n * FIXED_SCALE) | 0;
export const toFloat = (f: Fixed): number => f / FIXED_SCALE;

/** Fixed * Fixed -> Fixed (truncated toward zero). */
export function fxMul(a: Fixed, b: Fixed): Fixed {
  return Math.trunc((a * b) / FIXED_SCALE);
}

/** Fixed / Fixed -> Fixed (truncated toward zero). */
export function fxDiv(a: Fixed, b: Fixed): Fixed {
  if (b === 0) return 0;
  return Math.trunc((a * FIXED_SCALE) / b);
}

/** Multiply a fixed value by an integer scalar / divide by integer. */
export const fxScale = (a: Fixed, num: number, den: number): Fixed =>
  Math.trunc((a * num) / den);

export const absF = (a: Fixed): Fixed => (a < 0 ? -a : a);
export const sign = (a: number): number => (a > 0 ? 1 : a < 0 ? -1 : 0);

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Integer square root (floor). Operates on a plain integer (not fixed). */
export function isqrt(n: number): number {
  if (n <= 0) return 0;
  let x = Math.floor(Math.sqrt(n)); // seed; corrected below so result is exact
  // Correct any float rounding so the result is fully deterministic.
  while (x * x > n) x--;
  while ((x + 1) * (x + 1) <= n) x++;
  return x;
}

/** Length of a fixed-point vector, returned in fixed. */
export function fxLen(x: Fixed, y: Fixed): Fixed {
  // (x^2 + y^2) is in fixed^2 units; isqrt brings it back to fixed.
  return isqrt(x * x + y * y);
}

/**
 * Bhaskara I integer sine approximation. Input: integer degrees.
 * Output: fixed-point sine in [-ONE, ONE]. Pure integer math => deterministic
 * across all JS engines (no Math.sin LUT desync risk).
 */
export function fxSin(degInput: number): Fixed {
  let deg = ((degInput % 360) + 360) % 360;
  let negate = false;
  if (deg >= 180) {
    deg -= 180;
    negate = true;
  }
  const t = deg * (180 - deg);
  // sin = 4t / (40500 - t)  -> scale to fixed
  const val = Math.trunc((4 * t * FIXED_SCALE) / (40500 - t));
  return negate ? -val : val;
}

export function fxCos(deg: number): Fixed {
  return fxSin(deg + 90);
}

export const v2 = (x: Fixed, y: Fixed): Vec2 => ({ x, y });
export const v2add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const v2zero = (): Vec2 => ({ x: 0, y: 0 });
