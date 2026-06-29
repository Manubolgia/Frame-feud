/** Center-screen announcer: pass-device prompts, countdowns, KO flashes. */

import { sfx } from '../audio/sfx';
import { colorHex } from '../theme';
import { clear, el } from './dom';

export class Banner {
  root: HTMLElement;
  constructor() {
    this.root = el('div', { cls: 'banner-layer' });
  }

  /** A tap-to-continue "pass the device" gate for hotseat blind planning. */
  passDevice(name: string, color: number): Promise<void> {
    return new Promise((resolve) => {
      clear(this.root);
      const card = el('div', {
        cls: 'pass-card',
        style: { borderColor: colorHex(color) },
        children: [
          el('div', { cls: 'pass-sub', text: 'PASS THE DEVICE TO' }),
          el('div', { cls: 'pass-name', style: { color: colorHex(color) }, text: name }),
          el('div', { cls: 'pass-hint', text: 'others, look away — plan in secret' }),
          el('button', {
            cls: 'menu-btn primary',
            text: "I'M READY ▶",
            on: {
              click: () => {
                sfx.uiSelect();
                clear(this.root);
                resolve();
              },
            },
          }),
        ],
      });
      this.root.appendChild(card);
    });
  }

  countdown(): Promise<void> {
    return new Promise((resolve) => {
      const seq = ['3', '2', '1', 'RESOLVE'];
      let i = 0;
      const tick = () => {
        clear(this.root);
        const isGo = seq[i] === 'RESOLVE';
        this.root.appendChild(
          el('div', { cls: 'count-num' + (isGo ? ' go' : ''), text: seq[i] }),
        );
        if (isGo) sfx.go();
        else sfx.countdown();
        i++;
        if (i < seq.length) setTimeout(tick, 480);
        else
          setTimeout(() => {
            clear(this.root);
            resolve();
          }, 360);
      };
      tick();
    });
  }

  flash(text: string, color = 0xffffff, ms = 900): Promise<void> {
    return new Promise((resolve) => {
      const e = el('div', { cls: 'big-flash', style: { color: colorHex(color) }, text });
      this.root.appendChild(e);
      setTimeout(() => {
        e.classList.add('out');
        setTimeout(() => {
          e.remove();
          resolve();
        }, 300);
      }, ms);
    });
  }

  koPop(name: string, color: number) {
    const e = el('div', { cls: 'ko-pop', style: { color: colorHex(color) }, text: `${name} KO'd!` });
    this.root.appendChild(e);
    setTimeout(() => {
      e.classList.add('out');
      setTimeout(() => e.remove(), 400);
    }, 1100);
  }

  status(text: string) {
    clear(this.root);
    if (text) this.root.appendChild(el('div', { cls: 'status-msg', text }));
  }

  clear() {
    clear(this.root);
  }
}
