/** Character, palette, stage and rules select for local modes. */

import { sfx } from '../../audio/audio';
import { CHARACTERS, ROSTER, STAGES, STAGE_LIST } from '../../content/roster';
import type { Difficulty } from '../../game/ai';
import { saveSettings, settings } from '../../game/settings';
import type { MatchConfig } from '../../sim/types';
import { hex } from '../../render/color';
import { el } from '../dom';
import { icon } from '../icons';
import { Portrait } from '../portrait';
import { segmented } from '../widgets';

export type SelectMode = 'cpu' | 'local' | 'training';

export interface SelectResult {
  cfg: MatchConfig;
  levels: [Difficulty, Difficulty];
}

const STAGE_SWATCH: Record<string, string> = {
  dojo: 'linear-gradient(180deg,#1d1638 0%,#7a3b63 45%,#e8805e 78%,#ffd9a0 92%,#8a5233 92%,#2b170e 100%)',
  rooftop: 'linear-gradient(180deg,#03050d 0%,#0d1430 55%,#3c2156 88%,#2a2e3c 88%,#14161f 100%)',
  forge: 'linear-gradient(180deg,#0b0518 0%,#2c0f4f 50%,#c2477a 86%,#5b4a99 86%,#1c1233 100%)',
  lab: 'repeating-linear-gradient(90deg,rgba(0,0,0,.07) 0 1px,transparent 1px 12px),linear-gradient(180deg,#e9ecf2 0%,#d4d8e1 86%,#3a3e4a 86%,#3a3e4a 100%)',
};

export function stageSwatch(id: string): string {
  return STAGE_SWATCH[id] ?? STAGE_SWATCH.dojo;
}

interface SideState {
  char: string;
  palette: number;
  name: string;
}

export function selectScreen(
  mode: SelectMode,
  onGo: (r: SelectResult) => void,
  onBack: () => void,
  onMoves: (char: string, palette: number) => void,
): { root: HTMLElement; dispose: () => void } {
  const lp = settings.lastPick;
  const sides: SideState[] = [
    { char: lp[0], palette: lp[2], name: settings.name || (mode === 'local' ? 'Player 1' : 'You') },
    { char: lp[1], palette: lp[3], name: mode === 'cpu' ? 'CPU' : mode === 'training' ? 'Dummy' : 'Player 2' },
  ];
  let stage = mode === 'training' ? 'lab' : settings.stage;
  let rounds = settings.rounds;
  let level: Difficulty = settings.cpu;
  const portraits: Portrait[] = [];

  const titles: Record<SelectMode, string> = { cpu: 'Versus CPU', local: 'Local versus', training: 'Training' };
  const labels: [string, string] =
    mode === 'cpu' ? ['You', 'CPU'] : mode === 'training' ? ['You', 'Training dummy'] : ['Player 1', 'Player 2'];

  const col = (i: number): HTMLElement => {
    const s = sides[i];
    const p = new Portrait(s.char, s.palette, i === 0 ? 1 : -1, 'sel-portrait');
    portraits.push(p);
    const info = el('div', { cls: 'sel-info' });
    const swatches = el('div', { cls: 'swatches', attrs: { role: 'radiogroup', 'aria-label': 'Colour' } });
    const strip = el('div', { cls: 'roster-strip', attrs: { role: 'radiogroup', 'aria-label': 'Fighter' } });
    const nameIn =
      mode === 'local' || i === 0
        ? el('input', {
            cls: 'name-in',
            attrs: { value: s.name, maxlength: 12, 'aria-label': `${labels[i]} name`, spellcheck: 'false', autocomplete: 'off' },
            on: {
              input: (e: Event) => {
                s.name = (e.target as HTMLInputElement).value;
              },
              keydown: (e: KeyboardEvent) => e.stopPropagation(),
            },
          })
        : el('div', { cls: 'name-fixed', text: s.name });
    const render = () => {
      const def = CHARACTERS[s.char];
      p.set(s.char, s.palette);
      const c = hex(def.palettes[s.palette % def.palettes.length][0]);
      colEl.style.setProperty('--pc', c);
      const rating = (k: keyof typeof def.ratings, label: string) =>
        el('div', { cls: 'rating', kids: [el('span', { cls: 'rating-k', text: label }), el('span', { cls: 'rating-bar', kids: [1, 2, 3, 4, 5].map((n) => el('i', { cls: n <= def.ratings[k] ? 'on' : '' })) })] });
      info.replaceChildren(
        el('div', { cls: 'sel-arch', text: `${def.archetype} · ${'●'.repeat(def.difficulty)}${'○'.repeat(3 - def.difficulty)} difficulty` }),
        el('div', { cls: 'sel-name', text: def.name }),
        el('div', { cls: 'sel-title', text: def.title }),
        el('p', { cls: 'sel-blurb', text: def.blurb }),
        el('div', { cls: 'ratings', kids: [rating('power', 'Power'), rating('speed', 'Speed'), rating('range', 'Range'), rating('defense', 'Defence'), rating('mobility', 'Mobility')] }),
        el('div', { cls: 'sel-hp', html: `${icon('user', 14)}<span>${def.hp} health</span>` }),
      );
      swatches.replaceChildren(
        ...def.palettes.map((pal, k) =>
          el('button', {
            cls: 'swatch' + (k === s.palette ? ' on' : ''),
            attrs: { type: 'button', role: 'radio', 'aria-checked': k === s.palette, 'aria-label': `Colour ${k + 1}` },
            style: { background: `linear-gradient(135deg, ${hex(pal[0])} 50%, ${hex(pal[1])} 50%)` },
            on: {
              click: () => {
                s.palette = k;
                sfx.tap();
                render();
              },
            },
          }),
        ),
      );
      strip.replaceChildren(
        ...ROSTER.map((id) => {
          const d = CHARACTERS[id];
          const mini = new Portrait(id, 0, i === 0 ? 1 : -1, 'mini-portrait');
          const b = el('button', {
            cls: 'roster-tile' + (id === s.char ? ' on' : ''),
            attrs: { type: 'button', role: 'radio', 'aria-checked': id === s.char, title: `${d.name} — ${d.archetype}` },
            style: { '--rc': hex(d.color) },
            kids: [mini.canvas, el('span', { cls: 'rt-name', text: d.name })],
            on: {
              click: () => {
                if (s.char !== id) s.palette = 0;
                s.char = id;
                sfx.select();
                render();
              },
            },
          });
          requestAnimationFrame(() => mini.draw());
          return b;
        }),
      );
    };
    const colEl = el('section', {
      cls: `sel-col side-${i}`,
      kids: [
        el('div', { cls: 'sel-label', kids: [el('span', { cls: 'sel-tag', text: labels[i] }), nameIn] }),
        el('div', { cls: 'sel-stage', kids: [p.canvas, info] }),
        el('div', {
          cls: 'sel-controls',
          kids: [
            strip,
            el('div', {
              cls: 'sel-row',
              kids: [
                swatches,
                el('button', {
                  cls: 'btn ghost small',
                  attrs: { type: 'button' },
                  html: `${icon('list', 16)}<span>Moves</span>`,
                  on: { click: () => onMoves(s.char, s.palette) },
                }),
                el('button', {
                  cls: 'btn ghost small',
                  attrs: { type: 'button', title: 'Random fighter' },
                  html: `${icon('dice', 16)}<span>Random</span>`,
                  on: {
                    click: () => {
                      s.char = ROSTER[Math.floor(Math.random() * ROSTER.length)];
                      s.palette = Math.floor(Math.random() * 4);
                      sfx.select();
                      render();
                    },
                  },
                }),
              ],
            }),
          ],
        }),
      ],
    });
    render();
    return colEl;
  };

  const stageRow = el('div', { cls: 'stage-row', attrs: { role: 'radiogroup', 'aria-label': 'Stage' } });
  const renderStages = () => {
    stageRow.replaceChildren(
      ...STAGE_LIST.map((id) =>
        el('button', {
          cls: 'stage-card' + (id === stage ? ' on' : ''),
          attrs: { type: 'button', role: 'radio', 'aria-checked': id === stage },
          kids: [el('span', { cls: 'stage-thumb', style: { background: stageSwatch(id) } }), el('span', { cls: 'stage-name', text: STAGES[id].name }), el('span', { cls: 'stage-sub', text: STAGES[id].subtitle })],
          on: {
            click: () => {
              stage = id;
              sfx.tap();
              renderStages();
            },
          },
        }),
      ),
    );
  };
  renderStages();

  const go = () => {
    sfx.select();
    const n0 = sides[0].name.trim();
    const n1 = sides[1].name.trim();
    const names: [string, string] = [n0 || (mode === 'local' ? 'Player 1' : 'You'), mode === 'cpu' ? 'CPU' : mode === 'training' ? 'Dummy' : n1 || 'Player 2'];
    const patch: Partial<typeof settings> = { lastPick: [sides[0].char, sides[1].char, sides[0].palette, sides[1].palette], cpu: level };
    if (mode !== 'training') {
      patch.stage = stage;
      patch.rounds = rounds;
    }
    if (n0 && n0 !== 'Player 1') patch.name = n0;
    saveSettings(patch);
    onGo({
      cfg: {
        stageId: stage,
        chars: [sides[0].char, sides[1].char],
        palettes: [sides[0].palette, sides[1].palette],
        names,
        roundsToWin: mode === 'training' ? 99 : rounds,
        seed: (Math.random() * 0xffffffff) >>> 0,
      },
      levels: [level, level],
    });
  };

  const opts = el('div', {
    cls: 'sel-options',
    kids: [
      el('div', { cls: 'opt-block', kids: [el('div', { cls: 'opt-label', text: 'Stage' }), stageRow] }),
      mode !== 'training'
        ? el('div', {
            cls: 'opt-inline',
            kids: [
              el('div', { cls: 'opt-label', text: 'Rounds to win' }),
              segmented<number>([{ v: 1, label: '1' }, { v: 2, label: '2' }, { v: 3, label: '3' }], rounds, (v) => (rounds = v)),
            ],
          })
        : null,
      mode === 'cpu'
        ? el('div', {
            cls: 'opt-inline',
            kids: [
              el('div', { cls: 'opt-label', text: 'CPU skill' }),
              segmented<Difficulty>([{ v: 0, label: 'Easy' }, { v: 1, label: 'Normal' }, { v: 2, label: 'Hard' }], level, (v) => (level = v)),
            ],
          })
        : null,
      el('button', { cls: 'btn primary big go', attrs: { type: 'button' }, html: `<span>${mode === 'training' ? 'Start training' : 'Fight'}</span>${icon('stepfwd', 18)}`, on: { click: go } }),
    ],
  });

  const root = el('div', {
    cls: `screen select mode-${mode}`,
    kids: [
      el('header', {
        cls: 'screen-head',
        kids: [
          el('button', { cls: 'icon-btn', attrs: { type: 'button', 'aria-label': 'Back' }, html: icon('back', 22), on: { click: () => { sfx.back(); onBack(); } } }),
          el('h2', { text: titles[mode] }),
          el('span', { cls: 'head-hint', text: mode === 'local' ? 'Two players, one device — the game hides each pick' : mode === 'training' ? 'Practise against a dummy with hitboxes and meter on tap' : 'Pick your fighter and theirs' }),
        ],
      }),
      el('div', { cls: 'sel-body', kids: [col(0), opts, col(1)] }),
    ],
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLInputElement)) go();
  });
  for (const p of portraits) p.start();
  return {
    root,
    dispose: () => portraits.forEach((p) => p.stop()),
  };
}
