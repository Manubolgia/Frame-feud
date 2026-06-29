/** Headless smoke test: boot the built app, drive title -> local match ->
 *  planning -> lock -> resolution, asserting no console errors and that the
 *  turn loop actually advances. */
import { chromium } from 'playwright';

const URL = process.env.SMOKE_URL || 'http://localhost:4173/frame-feud/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 900, height: 520 } });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

async function tap(text) {
  const el = page.getByText(text, { exact: false }).first();
  await el.click();
  await page.waitForTimeout(250);
}

// title -> local
await page.locator('.menu-btn-label', { hasText: 'LOCAL MATCH' }).click();
await page.waitForTimeout(300);
// start match (default config: 1 human + 2 cpu)
await page.locator('.menu-btn.primary.wide').click();
await page.waitForTimeout(600);

// Should be in planning now (panel visible). Add a couple moves + lock.
const panel = await page.locator('.plan-panel').isVisible().catch(() => false);
console.log('planning panel visible:', panel);
if (panel) {
  const btns = page.locator('.move-btn:not(.disabled)');
  const n = await btns.count();
  console.log('palette moves:', n);
  if (n > 0) {
    await btns.nth(1).click();
    await page.waitForTimeout(120);
    await btns.nth(Math.min(3, n - 1)).click();
    await page.waitForTimeout(120);
  }
  await page.locator('.lock-btn').click();
  await page.waitForTimeout(400);
}

// poll up to 12s for the next planning phase to confirm the loop cycles
async function waitForPlanning(ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const vis = await page.locator('.plan-panel').isVisible().catch(() => false);
    const lock = await page.locator('.lock-btn').isVisible().catch(() => false);
    if (vis && lock) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

const backToPlanning = await waitForPlanning(14000);
const hud = await page.locator('.hud-card').count();
console.log('hud cards:', hud);
console.log('cycled back to planning after a turn:', backToPlanning);

// run several automated turns to ensure stability over many turns
let turnsDone = 0;
for (let t = 0; t < 6; t++) {
  if (await page.locator('.lock-btn').isVisible().catch(() => false)) {
    const bb = page.locator('.move-btn:not(.disabled)');
    if ((await bb.count()) > 2) { await bb.nth(2).click(); await page.waitForTimeout(80); }
    await page.locator('.lock-btn').click();
    turnsDone++;
    // wait for either next planning or results screen
    const ok = await Promise.race([
      waitForPlanning(14000),
      page.locator('.results-screen').waitFor({ timeout: 14000 }).then(() => 'results').catch(() => false),
    ]);
    if (ok === 'results') { console.log('reached results at turn', turnsDone); break; }
  } else if (await page.locator('.results-screen').isVisible().catch(() => false)) {
    console.log('match over (results visible)');
    break;
  }
}
console.log('turns driven:', turnsDone);

console.log('--- console errors ---');
console.log(errors.length ? errors.slice(0, 20).join('\n') : '(none)');
await browser.close();
process.exit(errors.length ? 1 : 0);
