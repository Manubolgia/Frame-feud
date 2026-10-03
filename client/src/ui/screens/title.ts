/** Title screen: the menu over a live CPU-vs-CPU demo fight. */

import { sfx } from '../../audio/audio';
import { inLibrary } from '../../library';
import { APP_VERSION } from '../../game/version';
import { el } from '../dom';
import { icon } from '../icons';

export interface TitleItem {
  id: string;
  label: string;
  sub: string;
  icon: string;
  disabled?: boolean;
}

export function titleScreen(items: TitleItem[], onPick: (id: string) => void, onLibrary: () => void): HTMLElement {
  const list = el('nav', { cls: 'menu', attrs: { 'aria-label': 'Main menu' } });
  items.forEach((it, i) => {
    const b = el('button', {
      cls: 'menu-item' + (it.disabled ? ' disabled' : ''),
      attrs: { type: 'button', 'data-id': it.id, 'aria-disabled': !!it.disabled },
      style: { '--i': String(i) },
      html: `<span class="mi-ico">${icon(it.icon, 22)}</span><span class="mi-text"><span class="mi-label">${it.label}</span><span class="mi-sub">${it.sub}</span></span><span class="mi-arrow">${icon('stepfwd', 16)}</span>`,
      on: {
        click: () => {
          if (it.disabled) {
            sfx.error();
            onPick(it.id);
            return;
          }
          sfx.select();
          onPick(it.id);
        },
        mouseenter: () => sfx.hover(),
      },
    });
    list.append(b);
  });
  menuKeys(list);
  const root = el('div', {
    cls: 'screen title',
    kids: [
      el('div', { cls: 'title-shade' }),
      el('div', {
        cls: 'title-col',
        kids: [
          el('h1', {
            cls: 'logo',
            attrs: { 'aria-label': 'Frame Feud' },
            kids: [el('span', { cls: 'logo-a', text: 'FRAME' }), el('span', { cls: 'logo-b', text: 'FEUD' }), el('span', { cls: 'logo-tag', text: 'Read. Commit. Resolve.' })],
          }),
          list,
          inLibrary
            ? el('button', {
                cls: 'btn ghost library-btn',
                attrs: { type: 'button' },
                html: `${icon('library', 18)}<span>Back to the library</span>`,
                on: { click: onLibrary },
              })
            : null,
        ],
      }),
      el('div', { cls: 'title-foot', kids: [el('span', { text: `v${APP_VERSION}` }), el('span', { text: 'A turn-based fighting game · simultaneous decisions, frame-perfect outcomes' })] }),
    ],
  });
  window.setTimeout(() => (list.firstElementChild as HTMLElement | null)?.focus({ preventScroll: true }), 50);
  return root;
}

/** Up/down arrow navigation for a vertical list of buttons. */
export function menuKeys(list: HTMLElement) {
  list.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = [...list.querySelectorAll<HTMLElement>('button')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const n = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[n]?.focus();
    sfx.hover();
    e.preventDefault();
  });
}
