/** "How to play": a paged, illustrated guide. */

import { sfx } from '../../audio/audio';
import { el } from '../dom';
import { icon } from '../icons';

interface Page {
  title: string;
  body: string[];
  art: string;
}

const svg = (inner: string, vb = '0 0 360 200') => `<svg viewBox="${vb}" class="guide-art" aria-hidden="true">${inner}</svg>`;

const fighter = (x: number, y: number, c: string, flip = false, s = 1) => {
  const f = flip ? -1 : 1;
  return `<g transform="translate(${x} ${y}) scale(${f * s} ${s})" stroke="${c}" stroke-width="7" stroke-linecap="round" fill="none">
    <circle cx="0" cy="-74" r="9" fill="${c}" stroke="none"/>
    <path d="M0 -62 L-2 -34"/><path d="M-2 -34 L-12 -14 L-16 0"/><path d="M-2 -34 L8 -16 L10 0"/>
    <path d="M0 -58 L14 -50 L22 -60"/><path d="M0 -58 L-10 -46 L-4 -40"/></g>`;
};

const PAGES: Page[] = [
  {
    title: 'Everyone moves at once',
    body: [
      'Frame Feud is a fighting game played in turns. At every decision point, both players secretly pick an action, lock in, and the game plays out frame by frame until somebody can act again.',
      'Fast actions give you your next turn sooner. Slow, powerful ones commit you for longer — and your opponent may get a turn while you’re still swinging.',
    ],
    art: svg(`
      <text x="18" y="40" class="ga-t">YOU</text><text x="18" y="96" class="ga-t">THEM</text>
      ${[...Array(18)].map((_, i) => `<rect x="${70 + i * 15}" y="26" width="12" height="20" rx="2" class="${i < 4 ? 'ga-start' : i < 6 ? 'ga-act' : i < 14 ? 'ga-rec' : 'ga-free'}"/>`).join('')}
      ${[...Array(18)].map((_, i) => `<rect x="${70 + i * 15}" y="82" width="12" height="20" rx="2" class="${i < 8 ? 'ga-wait' : 'ga-free'}"/>`).join('')}
      <path d="M190 18 V112" class="ga-cut"/><text x="196" y="130" class="ga-s">they can act → pause</text>
      <text x="70" y="160" class="ga-s"><tspan class="ga-k1">■</tspan> startup  <tspan class="ga-k2">■</tspan> active  <tspan class="ga-k3">■</tspan> recovery</text>`),
  },
  {
    title: 'Family feud',
    body: [
      'Each side brings a family of up to three fighters, in the order they’ll fight. A bout is one fighter from each family, and fighters enter at 60% of their usual health so a whole feud stays quick.',
      'When a fighter is knocked out, the next member of their family steps in fresh. The winner stays on with their wounds, heals a fifth of what they’ve lost and keeps their meter. The last family standing wins.',
    ],
    art: svg(`
      <text x="20" y="26" class="ga-t">YOUR FAMILY</text>
      ${[0, 1, 2].map((i) => `<rect x="${20 + i * 38}" y="34" width="32" height="16" rx="4" class="${i === 0 ? 'ga-fam-on' : 'ga-fam'}"/>`).join('')}
      <text x="340" y="26" class="ga-t" text-anchor="end">THEIRS</text>
      ${[0, 1, 2].map((i) => `<rect x="${226 + i * 38}" y="34" width="32" height="16" rx="4" class="${i === 0 ? 'ga-fam-out' : i === 1 ? 'ga-fam2-on' : 'ga-fam2'}"/>`).join('')}
      <path d="M232 37 L252 47 M252 37 L232 47" class="ga-x"/>
      ${fighter(110, 178, '#3de0ff', false, 0.9)}
      <g opacity=".35" transform="translate(214 172) rotate(-90)">${fighter(0, 0, '#ff4f6d', false, 0.7)}</g>
      ${fighter(300, 178, '#ff4f6d', true, 0.9)}
      <path d="M336 76 C350 96 346 112 326 118" class="ga-arrow" marker-end="url(#ahf)"/>
      <text x="262" y="78" class="ga-s">steps in</text><text x="186" y="196" class="ga-s">K.O.</text>
      <defs><marker id="ahf" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>`),
  },
  {
    title: 'Read the frames',
    body: [
      'Every move has startup (frames before it can hit), active frames, and recovery. The panel shows each move’s numbers, including how many frames ahead (+) or behind (−) you are after it hits or is blocked.',
      'Above each fighter a tag shows what they’re doing and for how long. “Ready +12” means you get to act 12 frames before them: plenty of time to start a combo.',
    ],
    art: svg(`
      ${fighter(110, 170, '#2ee6ff')}${fighter(250, 170, '#ff7a3d', true)}
      <rect x="60" y="34" width="100" height="26" rx="13" class="ga-good"/><text x="110" y="52" class="ga-tag">READY +12</text>
      <rect x="196" y="34" width="110" height="26" rx="13" class="ga-bad"/><text x="251" y="52" class="ga-tag">HITSTUN 12</text>`),
  },
  {
    title: 'Strike, block, grab',
    body: [
      'Strikes beat grabs. Blocks stop strikes and projectiles. Grabs beat blocks (and parries and armor). Every exchange is a read.',
      'Parry is the high-risk block: choose the exact frame the hit will land. Nail it and the attacker is stunned; miss and you’re wide open. When the opponent is mid-attack, the Parry slider marks exactly when their hit arrives.',
    ],
    art: svg(`
      <g class="ga-tri"><circle cx="180" cy="40" r="30"/><circle cx="90" cy="160" r="30"/><circle cx="270" cy="160" r="30"/></g>
      <text x="180" y="45" class="ga-tl">STRIKE</text><text x="90" y="165" class="ga-tl">BLOCK</text><text x="270" y="165" class="ga-tl">GRAB</text>
      <path d="M205 62 L250 128" class="ga-arrow" marker-end="url(#ah)"/><path d="M240 160 L122 160" class="ga-arrow" marker-end="url(#ah)"/><path d="M106 132 L158 64" class="ga-arrow" marker-end="url(#ah)"/>
      <text x="246" y="92" class="ga-s">beats</text><text x="160" y="152" class="ga-s">beats</text><text x="98" y="92" class="ga-s">beats</text>
      <defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>`),
  },
  {
    title: 'Trust the ghost',
    body: [
      'While you pick, a ghost acts out your choice in the arena, assuming your opponent stands still (or blocks — you can switch). Dots trace your path; the outline marks where you’ll be when you can act again.',
      'Aim jumps, dashes and projectiles with the direction pad, set timings with the slider, and watch the readout: hit, blocked, or how many frames until you’re free.',
    ],
    art: svg(`
      ${fighter(90, 170, '#2ee6ff')}
      <g opacity=".45">${fighter(200, 120, '#9ff6ff')}</g>
      ${[...Array(12)].map((_, i) => { const t = i / 11; const x = 100 + t * 110; const y = 130 - Math.sin(t * Math.PI) * 70 + t * 10; return `<circle cx="${x}" cy="${y}" r="${i % 3 ? 2.5 : 4}" class="ga-dot"/>`; }).join('')}
      <rect x="230" y="30" width="116" height="34" rx="8" class="ga-panel"/><text x="288" y="52" class="ga-tag">HIT · 48 · +14</text>`),
  },
  {
    title: 'Getting hit: DI and Burst',
    body: [
      'Hits deal damage and hitstun. Follow-ups that land before hitstun ends form a combo, with damage scaling down each hit.',
      'While you’re stuck in hitstun you still choose: directional influence (DI) bends the knockback of the next hits — steer away from walls and out of reach. With a full Burst gauge you can explode out of the combo entirely.',
    ],
    art: svg(`
      ${fighter(150, 160, '#ff7a3d', true)}
      <path d="M150 90 L230 40" class="ga-kb"/><path d="M150 90 L250 70" class="ga-di"/>
      <text x="236" y="36" class="ga-s">knockback</text><text x="256" y="76" class="ga-s ga-dic">with DI</text>
      <circle cx="80" cy="60" r="26" class="ga-burst"/><text x="80" y="65" class="ga-tl">BURST</text>`),
  },
  {
    title: 'Knockdowns, armor and walls',
    body: [
      'Landing from a launch knocks you down. You’re safe on the floor (except from moves that hit downed fighters), then choose how to rise: in place, rolling, or with a risky invulnerable kick.',
      'Armored moves absorb hits and keep going — only grabs stop them cleanly. Wall-bounce and ground-bounce hits keep combos alive near the edges.',
    ],
    art: svg(`
      <path d="M20 170 H340" class="ga-floor"/><path d="M330 30 V170" class="ga-wall"/>
      <g transform="translate(120 162) rotate(-90)">${fighter(0, 0, '#5dff8a', false, 0.8)}</g>
      <text x="80" y="130" class="ga-s">DOWN</text>
      <path d="M220 120 L320 90 L270 60" class="ga-kb"/><text x="230" y="50" class="ga-s">wall bounce</text>`),
  },
  {
    title: 'Meter, supers and feints',
    body: [
      'Dealing and taking damage, walking or dashing forward, and parrying all build super meter (up to three bars). Supers cost one or two bars and turn a read into a round.',
      'Half a bar buys a feint: an attack that cancels itself just before it would hit, baiting parries and blocks. Use it when your opponent can see your startup coming.',
    ],
    art: svg(`
      ${[0, 1, 2].map((i) => `<rect x="${70 + i * 76}" y="80" width="68" height="18" rx="4" class="${i < 2 ? 'ga-meter' : 'ga-meter-off'}"/>`).join('')}
      <text x="180" y="130" class="ga-tl">SUPER METER</text>
      <path d="M180 30 l8 18 20 2 -15 13 5 20 -18 -11 -18 11 5 -20 -15 -13 20 -2z" class="ga-star"/>`),
  },
];

export function guideScreen(onBack: () => void): HTMLElement {
  let page = 0;
  const art = el('div', { cls: 'guide-visual' });
  const text = el('div', { cls: 'guide-text' });
  const dots = el('div', { cls: 'guide-dots' });
  const prev = el('button', { cls: 'btn', attrs: { type: 'button' }, html: `${icon('back', 18)}<span>Back</span>` });
  const next = el('button', { cls: 'btn primary', attrs: { type: 'button' } });
  const render = () => {
    const p = PAGES[page];
    art.innerHTML = p.art;
    text.replaceChildren(el('div', { cls: 'guide-kicker', text: `${page + 1} / ${PAGES.length}` }), el('h3', { text: p.title }), ...p.body.map((b) => el('p', { text: b })));
    dots.replaceChildren(...PAGES.map((_, i) => el('span', { cls: i === page ? 'on' : '' })));
    prev.disabled = page === 0;
    next.innerHTML = page === PAGES.length - 1 ? `<span>Got it</span>${icon('check', 18)}` : `<span>Next</span>${icon('stepfwd', 18)}`;
  };
  const go = (d: number) => {
    if (page + d >= PAGES.length) {
      sfx.select();
      onBack();
      return;
    }
    page = Math.max(0, Math.min(PAGES.length - 1, page + d));
    sfx.tap();
    render();
  };
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  const root = el('div', {
    cls: 'screen guide',
    kids: [
      el('header', {
        cls: 'screen-head',
        kids: [
          el('button', { cls: 'icon-btn', attrs: { type: 'button', 'aria-label': 'Back' }, html: icon('back', 22), on: { click: () => { sfx.back(); onBack(); } } }),
          el('h2', { text: 'How to play' }),
        ],
      }),
      el('div', { cls: 'guide-card', kids: [art, text] }),
      el('div', { cls: 'guide-nav', kids: [prev, dots, next] }),
    ],
  });
  root.tabIndex = -1;
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  });
  render();
  window.setTimeout(() => next.focus(), 30);
  return root;
}
