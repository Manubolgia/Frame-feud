/**
 * Bake limb-riding hitboxes: for every hitbox that names a `bone`, sample
 * the move's animation on each active frame and record where that limb is.
 * The sim reads the result as plain integers, so it stays deterministic.
 *
 *   npx vite-node scripts/bake.ts          write src/content/hitpos.ts
 *   npx vite-node scripts/bake.ts --check  exit 1 if the file is stale
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { CHARACTERS } from '../src/content/roster';
import { bakeHitpos, renderHitpos } from '../src/content/bakehit';

const out = new URL('../src/content/hitpos.ts', import.meta.url);
const text = renderHitpos(bakeHitpos(CHARACTERS));
if (process.argv.includes('--check')) {
  const cur = readFileSync(out, 'utf8');
  if (cur !== text) {
    console.error('src/content/hitpos.ts is stale: run `npx vite-node scripts/bake.ts`');
    process.exit(1);
  }
  console.log('hitpos up to date');
} else {
  writeFileSync(out, text);
  console.log(`baked ${Object.keys(bakeHitpos(CHARACTERS)).length} hitbox paths`);
}
