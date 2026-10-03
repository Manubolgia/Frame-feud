/** Centre-screen announcements: round calls, K.O., pass-the-device gates,
 *  waiting notices and toasts. */

import { sfx } from '../audio/audio';
import { CHARACTERS } from '../content/roster';
import { hex } from '../render/color';
import { el } from './dom';
import { icon } from './icons';
import { Portrait } from './portrait';

/** One side of a Family Feud bout card. */
export interface VsSide {
  /** Player name ("You", "CPU", an online name). */
  who: string;
  team: string[];
  /** Index of the fighter stepping in; earlier members are out. */
  member: number;
  colors: [number, number, number];
}

export class Banner {
  root = el('div', { cls: 'banner-layer', attrs: { 'aria-live': 'polite' } });
  private status = el('div', { cls: 'status-pill hidden' });
  private toastEl = el('div', { cls: 'toast hidden', attrs: { role: 'status' } });
  private toastTimer = 0;

  constructor() {
    this.root.append(this.status, this.toastEl);
  }

  /** Big animated call ("ROUND 1", "FIGHT!", "K.O."). */
  call(text: string, opts: { sub?: string; color?: number; ms?: number; cls?: string } = {}): Promise<void> {
    return new Promise((resolve) => {
      const e = el('div', {
        cls: `call ${opts.cls ?? ''}`,
        style: opts.color !== undefined ? { '--cc': hex(opts.color) } : {},
        kids: [el('div', { cls: 'call-main', text }), opts.sub ? el('div', { cls: 'call-sub', text: opts.sub }) : null],
      });
      this.root.append(e);
      const ms = opts.ms ?? 1000;
      window.setTimeout(() => {
        e.classList.add('out');
        window.setTimeout(() => {
          e.remove();
          resolve();
        }, 260);
      }, ms);
    });
  }

  /** Family Feud bout card: both fighters stepping in, their families below. */
  versus(title: string, sides: [VsSide, VsSide], ms = 1500): Promise<void> {
    return new Promise((resolve) => {
      const ports: Portrait[] = [];
      const side = (i: 0 | 1) => {
        const s = sides[i];
        const char = s.team[Math.min(s.member, s.team.length - 1)];
        const p = new Portrait(char, 0, i === 0 ? 1 : -1, 'vs-portrait');
        p.colors = s.colors;
        ports.push(p);
        return el('div', {
          cls: `vs-side ${i ? 'r' : 'l'}`,
          style: { '--pc': hex(s.colors[0]), '--pg': hex(s.colors[2]) },
          kids: [
            el('div', { cls: 'vs-plate' }),
            p.canvas,
            el('div', {
              cls: 'vs-info',
              kids: [
                el('div', { cls: 'vs-char', text: CHARACTERS[char]?.name ?? char }),
                el('div', { cls: 'vs-who', text: s.who }),
                el('div', {
                  cls: 'vs-fam',
                  kids: s.team.map((c, k) =>
                    el('span', { cls: `vs-pip${k < s.member ? ' out' : k === s.member ? ' on' : ''}`, text: (CHARACTERS[c]?.name ?? c).slice(0, 3) }),
                  ),
                }),
              ],
            }),
          ],
        });
      };
      const card = el('div', {
        cls: 'vs-card',
        kids: [side(0), el('div', { cls: 'vs-mid', kids: [el('div', { cls: 'vs-title', text: title }), el('div', { cls: 'vs-x', text: 'VS' })] }), side(1)],
      });
      this.root.append(card);
      for (const p of ports) p.start();
      window.setTimeout(() => {
        card.classList.add('out');
        window.setTimeout(() => {
          for (const p of ports) p.stop();
          card.remove();
          resolve();
        }, 300);
      }, ms);
    });
  }

  /** Hot-seat privacy gate. Resolves when the next player taps ready. */
  gate(name: string, color: number, sub: string): Promise<void> {
    return new Promise((resolve) => {
      const go = () => {
        sfx.select();
        document.removeEventListener('keydown', key);
        wrap.remove();
        resolve();
      };
      const key = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      };
      const btn = el('button', { cls: 'btn primary big', attrs: { type: 'button' }, html: `<span>I’m ${escapeHtml(name)} — show my moves</span>`, on: { click: go } });
      const wrap = el('div', {
        cls: 'gate',
        style: { '--pc': hex(color) },
        kids: [
          el('div', {
            cls: 'gate-card',
            kids: [
              el('div', { cls: 'gate-ico', html: icon('users', 40) }),
              el('div', { cls: 'gate-sub', text: 'Pass the device to' }),
              el('div', { cls: 'gate-name', text: name }),
              el('p', { cls: 'gate-hint', text: sub }),
              btn,
            ],
          }),
        ],
      });
      this.root.append(wrap);
      document.addEventListener('keydown', key);
      btn.focus();
    });
  }

  setStatus(html: string | null) {
    if (!html) {
      this.status.classList.add('hidden');
      return;
    }
    this.status.innerHTML = html;
    this.status.classList.remove('hidden');
  }

  toast(text: string, ms = 2200) {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.add('hidden'), ms);
  }

  clear() {
    this.root.querySelectorAll('.call, .gate, .vs-card').forEach((e) => e.remove());
    this.setStatus(null);
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
