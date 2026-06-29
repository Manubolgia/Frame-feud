/** Rasterize the app icon to PNG at 192 & 512 using the preinstalled Chromium.
 *  Run: node scripts/gen-icons.mjs  (one-off; outputs land in public/). */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = resolve(__dirname, '../public');

const html = (size) => `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0}#c{width:${size}px;height:${size}px}</style></head>
<body><div id="c"></div>
<script>
const S=${size};const c=document.getElementById('c');
const ns='http://www.w3.org/2000/svg';
c.innerHTML=\`
<svg xmlns='\${ns}' width='\${S}' height='\${S}' viewBox='0 0 512 512'>
  <defs>
    <linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='#161436'/><stop offset='1' stop-color='#07060f'/>
    </linearGradient>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='#00e5ff'/><stop offset='1' stop-color='#6c4cff'/>
    </linearGradient>
    <linearGradient id='g2' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='#6c4cff'/><stop offset='1' stop-color='#ff4d6d'/>
    </linearGradient>
    <filter id='glow'><feGaussianBlur stdDeviation='6' result='b'/><feMerge><feMergeNode in='b'/><feMergeNode in='SourceGraphic'/></feMerge></filter>
  </defs>
  <rect width='512' height='512' rx='112' fill='url(#bg)'/>
  <rect x='66' y='66' width='380' height='380' rx='70' fill='none' stroke='url(#g)' stroke-width='14' opacity='0.5'/>
  <g filter='url(#glow)' stroke-linecap='round' stroke-linejoin='round' fill='none' stroke-width='42'>
    <path d='M158 360 L158 168 L272 168' stroke='url(#g)'/>
    <path d='M158 264 L246 264' stroke='url(#g)'/>
    <path d='M354 168 L354 360 L240 360' stroke='url(#g2)'/>
    <path d='M354 264 L266 264' stroke='url(#g2)'/>
  </g>
</svg>\`;
</script></body></html>`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(html(size), { waitUntil: 'networkidle' });
  await page.waitForTimeout(150);
  await page.locator('#c').screenshot({ path: resolve(out, `icon-${size}.png`), omitBackground: true });
  await page.close();
  console.log('wrote icon-' + size + '.png');
}
await browser.close();
