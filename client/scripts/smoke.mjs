/**
 * Headless smoke test. Boots a served build, starts a CPU match, plays a
 * dozen turns with random picks and fails on any console error or if the
 * turn counter stops advancing.
 *
 *   npm run build && npm run preview          # in one terminal
 *   node scripts/smoke.mjs                    # in another
 *
 * SMOKE_URL overrides the address; SMOKE_TURNS the number of turns.
 */
import { chromium } from 'playwright';

const URL = process.env.SMOKE_URL || 'http://localhost:4173/Frame-feud/';
const TURNS = Number(process.env.SMOKE_TURNS || 12);

const launch = { args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] };
const browser = await chromium.launch({ ...launch, executablePath: process.env.CHROMIUM_PATH || undefined }).catch(() =>
  chromium.launch({ ...launch, executablePath: '/opt/pw-browsers/chromium' }),
);
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
await page.addInitScript(() => {
  localStorage.setItem('framefeud.settings.v2', JSON.stringify({ seenGuide: true, speed: 2, rounds: 1, cpu: 0 }));
});

const fail = async (why) => {
  console.error(`smoke: FAIL - ${why}`);
  for (const e of errors) console.error(`  ${e}`);
  await page.screenshot({ path: 'smoke-fail.png' }).catch(() => {});
  await browser.close();
  process.exit(1);
};

await page.goto(URL, { waitUntil: 'networkidle' });
await page.click('[data-id="cpu"]');
await page.click('.go');

const turnOf = () => page.evaluate(() => document.querySelector('.hud-step')?.textContent ?? '');
let played = 0;
let last = '';
let stuckSince = Date.now();
while (played < TURNS) {
  if (await page.locator('.screen.results').count()) break;
  // DI and wake-up turns have no move tiles; those lock in as they are
  const lock = page.locator('.panel:not(.hidden) .lock');
  const tiles = page.locator('.panel:not(.hidden) .tile:not(.off)');
  if (await lock.count()) {
    const tabs = page.locator('.tab:not(.empty)');
    const tn = await tabs.count();
    if (tn > 1) await tabs.nth(Math.floor(Math.random() * tn)).click();
    const n = await tiles.count();
    if (n) await tiles.nth(Math.floor(Math.random() * n)).click();
    if (await lock.isEnabled()) {
      await lock.click();
      played++;
    }
  }
  const t = await turnOf();
  if (t !== last) {
    last = t;
    stuckSince = Date.now();
  } else if (Date.now() - stuckSince > 90_000) {
    await fail(`turn counter stuck at "${t}"`);
  }
  if (errors.length) await fail('console errors');
  await page.waitForTimeout(150);
}

if (errors.length) await fail('console errors');
console.log(`smoke: OK - ${played} turns played, now at "${await turnOf()}"`);
await browser.close();
