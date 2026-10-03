/** Settings, pause menu, move list, results, and the replay / training bars. */

import { sfx } from '../../audio/audio';
import { CHARACTERS, colorsFor, familyName } from '../../content/roster';
import type { DummyMode } from '../../game/drivers';
import { saveSettings, settings } from '../../game/settings';
import type { GameState, MatchConfig } from '../../sim/types';
import { hex } from '../../render/color';
import { el } from '../dom';
import { fmtAdv, frameInfo } from '../framedata';
import { icon } from '../icons';
import { Portrait } from '../portrait';
import { segmented, slider, toggle } from '../widgets';
import { menuKeys } from './title';

function head(title: string, onBack: () => void, hint = ''): HTMLElement {
  return el('header', {
    cls: 'screen-head',
    kids: [
      el('button', { cls: 'icon-btn', attrs: { type: 'button', 'aria-label': 'Back' }, html: icon('back', 22), on: { click: () => { sfx.back(); onBack(); } } }),
      el('h2', { text: title }),
      hint ? el('span', { cls: 'head-hint', text: hint }) : null,
    ],
  });
}

// ------------------------------------------------------------ settings --

export function settingsScreen(onBack: () => void): HTMLElement {
  const sec = (title: string, ...kids: (HTMLElement | null)[]) => el('section', { cls: 'set-sec', kids: [el('h3', { text: title }), ...kids] });
  return el('div', {
    cls: 'screen settings',
    kids: [
      head('Settings', onBack),
      el('div', {
        cls: 'set-body',
        kids: [
          sec(
            'Sound',
            slider('Master volume', settings.master, (v) => saveSettings({ master: v })),
            slider('Music', settings.music, (v) => saveSettings({ music: v })),
            slider('Effects', settings.sfx, (v) => saveSettings({ sfx: v })),
          ),
          sec(
            'Gameplay',
            el('div', {
              cls: 'set-row',
              kids: [
                el('span', { cls: 'set-label', kids: [el('span', { text: 'Playback speed' }), el('small', { text: 'How fast each exchange plays out' })] }),
                segmented<number>(
                  [
                    { v: 0.75, label: '0.75×' },
                    { v: 1, label: '1×' },
                    { v: 1.5, label: '1.5×' },
                    { v: 2, label: '2×' },
                  ],
                  settings.speed,
                  (v) => saveSettings({ speed: v }),
                ),
              ],
            }),
            toggle('Ghost preview', settings.ghost, (v) => saveSettings({ ghost: v }), 'Show how your pick plays out before you lock in'),
            toggle('Frame data', settings.frameData, (v) => saveSettings({ frameData: v }), 'Startup, advantage and status tags over the fighters'),
            toggle('Show hitboxes', settings.hitboxes, (v) => saveSettings({ hitboxes: v }), 'Red: attacks · blue: grabs · green: bodies'),
          ),
          sec(
            'Comfort',
            slider('Screen shake', settings.shake, (v) => saveSettings({ shake: v })),
            toggle('Reduced motion', settings.reducedMotion, (v) => saveSettings({ reducedMotion: v }), 'Fewer flashes, particles and slow-motion'),
          ),
          sec(
            'Keyboard',
            el('div', {
              cls: 'keys-grid',
              html: [
                ['1 – 5', 'Move categories'],
                ['Arrows', 'Browse moves / nudge a direction'],
                ['Enter', 'Lock in'],
                ['Space', 'Pause or play the ghost'],
                ['H', 'Hide the action panel'],
                ['R', 'Re-watch the last exchange'],
                ['Hold F', 'Fast-forward an exchange'],
                ['Esc', 'Pause'],
              ]
                .map(([k, v]) => `<kbd>${k}</kbd><span>${v}</span>`)
                .join(''),
            }),
          ),
        ],
      }),
    ],
  });
}

// ------------------------------------------------------------ pause --

export interface PauseItem {
  id: string;
  label: string;
  icon: string;
}

export function pauseMenu(title: string, items: PauseItem[], onPick: (id: string) => void): HTMLElement {
  const list = el('nav', {
    cls: 'pause-list',
    kids: items.map((it) =>
      el('button', {
        cls: 'pause-item' + (it.id === 'quit' ? ' danger' : ''),
        attrs: { type: 'button' },
        html: `${icon(it.icon, 20)}<span>${it.label}</span>`,
        on: {
          click: () => {
            sfx.select();
            onPick(it.id);
          },
        },
      }),
    ),
  });
  menuKeys(list);
  const root = el('div', { cls: 'modal-wrap', kids: [el('div', { cls: 'modal pause', attrs: { role: 'dialog', 'aria-label': title }, kids: [el('h2', { text: title }), list] })] });
  window.setTimeout(() => (list.firstElementChild as HTMLElement | null)?.focus(), 30);
  return root;
}

export function confirmBox(text: string, yes: string, onYes: () => void, onNo: () => void): HTMLElement {
  const no = el('button', { cls: 'btn', attrs: { type: 'button' }, text: 'Cancel', on: { click: () => { sfx.back(); onNo(); } } });
  const root = el('div', {
    cls: 'modal-wrap',
    kids: [
      el('div', {
        cls: 'modal confirm',
        attrs: { role: 'alertdialog' },
        kids: [el('p', { text }), el('div', { cls: 'row', kids: [no, el('button', { cls: 'btn danger', attrs: { type: 'button' }, text: yes, on: { click: () => { sfx.select(); onYes(); } } })] })],
      }),
    ],
  });
  window.setTimeout(() => no.focus(), 30);
  return root;
}

// ------------------------------------------------------------ move list --

export function moveList(char: string, palette: number, onClose: () => void): { root: HTMLElement; dispose: () => void } {
  const def = CHARACTERS[char];
  const p = new Portrait(char, palette, 1, 'ml-portrait');
  const cats: [string, string][] = [
    ['attack', 'Attacks'],
    ['special', 'Specials'],
    ['super', 'Supers'],
    ['move', 'Movement'],
    ['defend', 'Defence'],
    ['wake', 'Wake-up'],
  ];
  const rows: HTMLElement[] = [];
  for (const [c, label] of cats) {
    const ms = def.order.map((id) => def.moves[id]).filter((m) => !m.hidden && m.cat === c);
    if (!ms.length) continue;
    rows.push(el('div', { cls: 'ml-cat', text: label }));
    for (const m of ms) {
      const fi = frameInfo(m, def);
      const row = el('button', {
        cls: 'ml-row',
        attrs: { type: 'button', title: 'Preview the animation' },
        html: `<span class="ml-ico">${icon(m.icon, 22)}</span>
          <span class="ml-main"><span class="ml-name">${m.name}</span><span class="ml-desc">${m.desc}</span>
          ${fi.tags.length ? `<span class="ml-tags">${fi.tags.map((t) => `<i>${t}</i>`).join('')}</span>` : ''}</span>
          <span class="ml-fd"><span><b>${fi.startup ?? '—'}</b>startup</span><span><b>${fi.damage ?? '—'}</b>dmg</span><span><b>${fmtAdv(fi.onBlock)}</b>on block</span></span>`,
        on: {
          click: () => {
            p.move = m.id;
            sfx.tap();
          },
        },
      });
      rows.push(row);
    }
  }
  const pal = def.palettes[palette % def.palettes.length];
  const root = el('div', {
    cls: 'modal-wrap',
    kids: [
      el('div', {
        cls: 'modal movelist',
        style: { '--pc': hex(pal[0]) },
        attrs: { role: 'dialog', 'aria-label': `${def.name} move list` },
        kids: [
          el('div', {
            cls: 'ml-head',
            kids: [
              p.canvas,
              el('div', {
                cls: 'ml-id',
                kids: [el('div', { cls: 'sel-arch', text: def.archetype }), el('div', { cls: 'sel-name', text: def.name }), el('div', { cls: 'sel-title', text: def.title }), el('p', { cls: 'sel-blurb', text: def.blurb }), el('p', { cls: 'muted small', text: 'Tap a move to preview it.' })],
              }),
              el('button', { cls: 'icon-btn close', attrs: { type: 'button', 'aria-label': 'Close' }, html: icon('close', 22), on: { click: () => { sfx.back(); onClose(); } } }),
            ],
          }),
          el('div', { cls: 'ml-list', kids: rows }),
        ],
      }),
    ],
  });
  p.start();
  return { root, dispose: () => p.stop() };
}

// ------------------------------------------------------------ results --

export function resultsScreen(
  st: GameState,
  cfg: MatchConfig,
  colors: [number, number],
  actions: { id: string; label: string; icon: string; primary?: boolean }[],
  onPick: (id: string) => void,
): { root: HTMLElement; dispose: () => void } {
  const w = st.winner ?? -1;
  const ports: Portrait[] = [];
  const side = (i: number) => {
    const ch = st.fighters[i].char;
    const p = new Portrait(ch, cfg.palettes[i], i === 0 ? 1 : -1, 'res-portrait');
    p.colors = colorsFor(cfg, i, ch, st.fighters[1 - i].char);
    p.pose = w === -1 ? 'idle' : w === i ? 'victory' : 'ko';
    ports.push(p);
    const team = cfg.teams?.[i];
    // knocked-out members of side i = the other side's wins
    const fam = team
      ? el('div', {
          cls: 'res-fam',
          kids: team.map((c, k) => el('span', { cls: 'fam-chip' + (k < st.wins[1 - i] ? ' out' : k === st.members[i] ? ' cur' : ''), style: { '--fc': hex(colors[i]) }, text: CHARACTERS[c].name })),
        })
      : null;
    return el('div', { cls: `res-side ${w === i ? 'won' : w === -1 ? '' : 'lost'}`, style: { '--pc': hex(colors[i]) }, kids: [p.canvas, el('div', { cls: 'res-name', text: cfg.names[i] }), el('div', { cls: 'res-char', text: team ? familyName(cfg.names[i]) : CHARACTERS[ch].name }), fam] });
  };
  const stat = (label: string, a: number | string, b: number | string) => el('div', { cls: 'res-stat', kids: [el('span', { text: String(a) }), el('span', { cls: 'res-k', text: label }), el('span', { text: String(b) })] });
  const [A, B] = st.fighters.map((f) => f.stats);
  const btns = actions.map((a) =>
    el('button', {
      cls: 'btn' + (a.primary ? ' primary' : ''),
      attrs: { type: 'button' },
      html: `${icon(a.icon, 18)}<span>${a.label}</span>`,
      on: {
        click: () => {
          sfx.select();
          onPick(a.id);
        },
      },
    }),
  );
  const root = el('div', {
    cls: 'screen results',
    kids: [
      el('div', { cls: 'res-banner', kids: [el('div', { cls: 'res-kicker', text: w === -1 ? 'No contest' : 'Winner' }), el('div', { cls: 'res-winner', style: w >= 0 ? { color: hex(colors[w]) } : {}, text: w === -1 ? 'Draw' : cfg.names[w] })] }),
      el('div', {
        cls: 'res-body',
        kids: [
          side(0),
          el('div', {
            cls: 'res-stats',
            kids: [
              el('div', { cls: 'res-score', text: `${st.wins[0]} – ${st.wins[1]}` }),
              el('div', { cls: 'res-sub', text: `${st.step} turn${st.step === 1 ? '' : 's'} · ${st.round} ${cfg.teams ? 'bout' : 'round'}${st.round === 1 ? '' : 's'}` }),
              stat('Damage dealt', A.dealt, B.dealt),
              stat('Hits landed', A.hits, B.hits),
              stat('Longest combo', A.bestCombo, B.bestCombo),
              stat('Best combo damage', A.bestComboDmg, B.bestComboDmg),
              stat('Parries', A.parries, B.parries),
              stat('Throws', A.throws, B.throws),
              stat('Supers', A.supers, B.supers),
            ],
          }),
          side(1),
        ],
      }),
      el('div', { cls: 'res-actions', kids: btns }),
    ],
  });
  for (const p of ports) p.start();
  window.setTimeout(() => btns[0]?.focus(), 60);
  return { root, dispose: () => ports.forEach((p) => p.stop()) };
}

// ------------------------------------------------------------ replay bar --

export interface ReplayBar {
  root: HTMLElement;
  update(step: number, total: number, playing: boolean): void;
}

export function replayBar(on: { toggle: () => void; speed: (v: number) => void; restart: () => void; exit: () => void }): ReplayBar {
  const play = el('button', { cls: 'icon-btn', attrs: { type: 'button', 'aria-label': 'Play or pause' }, html: icon('pause', 20), on: { click: on.toggle } });
  const label = el('span', { cls: 'rb-label' });
  const prog = el('div', { cls: 'rb-prog', kids: [el('div', { cls: 'rb-fill' })] });
  const root = el('div', {
    cls: 'replay-bar',
    kids: [
      el('span', { cls: 'rb-tag', html: `${icon('replay', 16)}<span>Replay</span>` }),
      el('button', { cls: 'icon-btn', attrs: { type: 'button', 'aria-label': 'Restart' }, html: icon('stepback', 20), on: { click: on.restart } }),
      play,
      prog,
      label,
      segmented<number>([{ v: 0.5, label: '½×' }, { v: 1, label: '1×' }, { v: 2, label: '2×' }, { v: 4, label: '4×' }], 1, on.speed, 'seg-small'),
      el('button', { cls: 'btn small', attrs: { type: 'button' }, html: `${icon('exit', 16)}<span>Exit</span>`, on: { click: on.exit } }),
    ],
  });
  return {
    root,
    update(step, total, playing) {
      play.innerHTML = icon(playing ? 'pause' : 'play', 20);
      label.textContent = `Turn ${Math.min(step, total)} / ${total}`;
      (prog.firstChild as HTMLElement).style.transform = `scaleX(${total ? Math.min(1, step / total) : 0})`;
    },
  };
}

// ------------------------------------------------------------ training --

export interface TrainingOpts {
  dummy: DummyMode;
  refill: boolean;
  meter: boolean;
}

export function trainingBar(opts: TrainingOpts, on: { change: () => void; reset: () => void; swap: () => void }): HTMLElement {
  const body = el('div', {
    cls: 'tb-body',
    kids: [
      el('div', {
        cls: 'tb-row',
        kids: [
          el('span', { cls: 'opt-label', text: 'Dummy' }),
          segmented<DummyMode>(
            [
              { v: 'stand', label: 'Stand' },
              { v: 'block', label: 'Block' },
              { v: 'jump', label: 'Jump' },
              { v: 'parry', label: 'Parry' },
              { v: 'cpu', label: 'CPU' },
            ],
            opts.dummy,
            (v) => {
              opts.dummy = v;
              on.change();
            },
            'seg-small',
          ),
        ],
      }),
      toggle('Refill health', opts.refill, (v) => {
        opts.refill = v;
        on.change();
      }),
      toggle('Infinite meter', opts.meter, (v) => {
        opts.meter = v;
        on.change();
      }),
      toggle('Hitboxes', settings.hitboxes, (v) => saveSettings({ hitboxes: v })),
      el('div', {
        cls: 'tb-row',
        kids: [
          el('button', { cls: 'btn small', attrs: { type: 'button' }, html: `${icon('replay', 16)}<span>Reset positions</span>`, on: { click: on.reset } }),
          el('button', { cls: 'btn small', attrs: { type: 'button' }, html: `${icon('users', 16)}<span>Swap sides</span>`, on: { click: on.swap } }),
        ],
      }),
    ],
  });
  const root = el('details', { cls: 'training-bar', kids: [el('summary', { html: `${icon('gear', 16)}<span>Training</span>` }), body] });
  return root;
}
