/** Top HUD: per-player damage %, character, dynasty stock tray. */

import { CHARACTERS } from '../content/characters';
import type { GameState } from '../sim/types';
import { colorHex, PLAYER_GLYPHS } from '../theme';
import { clear, el } from './dom';

export class Hud {
  root: HTMLElement;
  private cards: HTMLElement[] = [];

  constructor() {
    this.root = el('div', { cls: 'hud hidden' });
  }

  mount(state: GameState, localIndex: number | null) {
    clear(this.root);
    this.cards = [];
    state.players.forEach((p, i) => {
      const color = p.color;
      const card = el('div', {
        cls: 'hud-card' + (localIndex === i ? ' you' : ''),
        style: { borderColor: colorHex(color) },
      });
      this.cards.push(card);
      this.root.appendChild(card);
    });
    this.root.classList.remove('hidden');
    this.update(state, localIndex);
  }

  update(state: GameState, localIndex: number | null) {
    state.players.forEach((p, i) => {
      const card = this.cards[i];
      if (!card) return;
      const color = p.color;
      const ch = state.characters[i];
      const def = CHARACTERS[p.dynasty[p.activeIndex] ?? p.dynasty[0]];
      clear(card);
      if (p.eliminated) {
        card.classList.add('eliminated');
      }
      const stocks = el('div', { cls: 'stock-tray' });
      p.dynasty.forEach((cid, di) => {
        const lost = di < p.activeIndex;
        const cur = di === p.activeIndex && !p.eliminated;
        stocks.appendChild(
          el('span', {
            cls: 'stock-dot' + (lost ? ' lost' : '') + (cur ? ' current' : ''),
            style: { background: lost ? '#333' : colorHex(CHARACTERS[cid].color) },
            attrs: { title: CHARACTERS[cid].name },
          }),
        );
      });
      card.append(
        el('div', {
          cls: 'hud-top',
          children: [
            el('span', { cls: 'hud-glyph', text: PLAYER_GLYPHS[i], style: { color: colorHex(color) } }),
            el('span', { cls: 'hud-name', text: p.name + (localIndex === i ? ' (you)' : '') }),
          ],
        }),
        el('div', {
          cls: 'hud-mid',
          children: [
            el('span', { cls: 'hud-char', text: p.eliminated ? 'OUT' : def.name }),
            el('span', {
              cls: 'hud-dmg',
              style: { color: p.eliminated ? '#666' : colorHex(dmgColor(ch?.damagePercent ?? 0)) },
              text: p.eliminated ? '—' : `${ch?.damagePercent ?? 0}%`,
            }),
          ],
        }),
        stocks,
      );
    });
  }

  hide() {
    this.root.classList.add('hidden');
  }
}

function dmgColor(pct: number): number {
  if (pct < 40) return mix(0xffffff, 0xffe14d, pct / 40);
  if (pct < 90) return mix(0xffe14d, 0xff8a3d, (pct - 40) / 50);
  return mix(0xff8a3d, 0xff3355, Math.min(1, (pct - 90) / 60));
}
function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return ((Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t));
}
