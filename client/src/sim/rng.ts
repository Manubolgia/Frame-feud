/**
 * Seeded integer PRNG (mulberry32). The state lives inside GameState so the
 * whole sim is reproducible from a single server-provided seed.
 */

export function nextRng(state: number): { value: number; state: number } {
  // mulberry32, kept in unsigned 32-bit space with >>> 0.
  let s = (state + 0x6d2b79f5) | 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296; // in [0,1)
  return { value, state: s >>> 0 };
}

/** Returns an integer in [0, n) and the advanced state. */
export function rngInt(state: number, n: number): { value: number; state: number } {
  const r = nextRng(state);
  return { value: Math.floor(r.value * n), state: r.state };
}

/** Returns an integer in [lo, hi] inclusive. */
export function rngRange(
  state: number,
  lo: number,
  hi: number,
): { value: number; state: number } {
  const r = rngInt(state, hi - lo + 1);
  return { value: lo + r.value, state: r.state };
}
