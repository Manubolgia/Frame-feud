/** Online entry (create / join a room) and the room lobby. */

import { sfx } from '../../audio/audio';
import { CHARACTERS, ROSTER, STAGES, STAGE_LIST } from '../../content/roster';
import type { Lobby } from '../../net/protocol';
import { hex } from '../../render/color';
import { el } from '../dom';
import { icon } from '../icons';
import { Portrait } from '../portrait';
import { segmented } from '../widgets';
import { stageSwatch } from './select';

export function onlineEntry(
  name: string,
  configured: boolean,
  on: { create: (name: string) => void; join: (name: string, code: string) => void; back: () => void },
): HTMLElement {
  const nameIn = el('input', { cls: 'name-in big', attrs: { value: name, maxlength: 12, placeholder: 'Your name', 'aria-label': 'Your name', autocomplete: 'off', spellcheck: 'false' } });
  const codeIn = el('input', {
    cls: 'name-in big code',
    attrs: { maxlength: 5, placeholder: 'CODE', 'aria-label': 'Room code', autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false' },
    on: {
      input: () => {
        codeIn.value = codeIn.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      },
    },
  });
  for (const i of [nameIn, codeIn]) i.addEventListener('keydown', (e) => e.stopPropagation());
  const nm = () => nameIn.value.trim() || 'Player';
  const fromHash = new URLSearchParams(location.hash.slice(1)).get('room');
  if (fromHash) codeIn.value = fromHash.toUpperCase().slice(0, 5);
  const join = () => {
    const c = codeIn.value.trim();
    if (c.length < 4) {
      sfx.error();
      codeIn.focus();
      codeIn.classList.add('shake');
      window.setTimeout(() => codeIn.classList.remove('shake'), 400);
      return;
    }
    sfx.select();
    on.join(nm(), c);
  };
  codeIn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') join();
  });
  const body = configured
    ? el('div', {
        cls: 'online-card',
        kids: [
          el('label', { cls: 'opt-label', text: 'Your name' }),
          nameIn,
          el('button', { cls: 'btn primary big', attrs: { type: 'button' }, html: `${icon('users', 20)}<span>Create a room</span>`, on: { click: () => { sfx.select(); on.create(nm()); } } }),
          el('div', { cls: 'or', text: 'or join a friend' }),
          el('div', { cls: 'join-row', kids: [codeIn, el('button', { cls: 'btn big', attrs: { type: 'button' }, html: `<span>Join</span>${icon('stepfwd', 18)}`, on: { click: join } })] }),
          el('p', { cls: 'muted small', text: 'Rooms hold two fighters and any number of spectators. Every decision is simultaneous, so latency never matters.' }),
        ],
      })
    : el('div', {
        cls: 'online-card',
        kids: [
          el('div', { cls: 'detail-empty-ico', html: icon('wifi', 34) }),
          el('h3', { text: 'Online isn’t set up for this build' }),
          el('p', { cls: 'muted', html: 'This copy of the game has no room server configured (<code>VITE_WS_URL</code>). Versus CPU, local versus and training all work offline. See the README to deploy the free Cloudflare room server.' }),
        ],
      });
  const root = el('div', {
    cls: 'screen online',
    kids: [
      el('header', {
        cls: 'screen-head',
        kids: [el('button', { cls: 'icon-btn', attrs: { type: 'button', 'aria-label': 'Back' }, html: icon('back', 22), on: { click: () => { sfx.back(); on.back(); } } }), el('h2', { text: 'Online' })],
      }),
      body,
    ],
  });
  window.setTimeout(() => (fromHash ? codeIn : nameIn).focus(), 40);
  return root;
}

export interface LobbyHandlers {
  pick: (char: string, palette: number) => void;
  ready: (r: boolean) => void;
  host: (p: { stage?: string; rounds?: number; timer?: number }) => void;
  leave: () => void;
  moves: (char: string, palette: number) => void;
}

/** The lobby re-renders on every lobby update; portraits are kept alive. */
export class LobbyScreen {
  root: HTMLElement;
  private body = el('div', { cls: 'lobby-body' });
  private status = el('div', { cls: 'lobby-status' });
  private ports: [Portrait, Portrait] = [new Portrait('razor', 0, 1, 'lobby-portrait'), new Portrait('titan', 0, -1, 'lobby-portrait')];
  private lobby: Lobby | null = null;

  constructor(
    private seat: number,
    private h: LobbyHandlers,
  ) {
    this.root = el('div', {
      cls: 'screen lobby',
      kids: [
        el('header', {
          cls: 'screen-head',
          kids: [
            el('button', { cls: 'icon-btn', attrs: { type: 'button', 'aria-label': 'Leave room' }, html: icon('back', 22), on: { click: () => { sfx.back(); h.leave(); } } }),
            el('h2', { text: 'Room' }),
            this.status,
          ],
        }),
        this.body,
      ],
    });
    this.ports.forEach((p) => p.start());
  }

  setSeat(seat: number) {
    this.seat = seat;
  }

  setStatus(html: string) {
    this.status.innerHTML = html;
  }

  dispose() {
    this.ports.forEach((p) => p.stop());
  }

  render(l: Lobby) {
    this.lobby = l;
    const me = this.seat;
    const isHost = me === l.host;
    const share = async () => {
      const url = `${location.origin}${location.pathname}#room=${l.code}`;
      try {
        if (navigator.share) await navigator.share({ title: 'Frame Feud', text: `Join my Frame Feud room: ${l.code}`, url });
        else {
          await navigator.clipboard.writeText(url);
          copyBtn.querySelector('span')!.textContent = 'Link copied';
        }
      } catch {
        /* cancelled */
      }
    };
    const copyBtn = el('button', { cls: 'btn small', attrs: { type: 'button' }, html: `${icon('share', 16)}<span>Invite</span>`, on: { click: share } });
    const codeBox = el('div', {
      cls: 'room-code',
      kids: [el('span', { cls: 'opt-label', text: 'Room code' }), el('span', { cls: 'code-big', text: l.code }), copyBtn],
    });
    const seatCard = (i: number) => {
      const s = l.seats[i];
      const p = this.ports[i];
      if (!s) {
        return el('div', { cls: 'seat empty', kids: [el('div', { cls: 'seat-wait', html: `<span class="spin"></span><span>Waiting for a challenger…</span>` }), el('p', { cls: 'muted small', text: `Share the code ${l.code}` })] });
      }
      const def = CHARACTERS[s.char] ?? CHARACTERS.razor;
      p.set(s.char, s.palette);
      const mine = i === me && l.phase === 'lobby';
      const card = el('div', {
        cls: `seat side-${i}` + (mine ? ' mine' : '') + (s.ready ? ' ready' : ''),
        style: { '--pc': hex(def.palettes[s.palette % 4][0]) },
        kids: [
          el('div', { cls: 'seat-head', kids: [el('span', { cls: 'seat-name', text: s.name + (i === me ? ' (you)' : '') }), el('span', { cls: 'seat-badge ' + (s.connected ? (s.ready ? 'ok' : 'wait') : 'off'), text: !s.connected ? 'Offline' : s.ready ? 'Ready' : i === l.host ? 'Host' : 'Choosing' })] }),
          p.canvas,
          el('div', { cls: 'seat-char', kids: [el('b', { text: def.name }), el('span', { text: ` · ${def.archetype}` })] }),
        ],
      });
      if (mine) {
        card.append(
          el('div', {
            cls: 'roster-strip small',
            kids: ROSTER.map((id) =>
              el('button', {
                cls: 'roster-pill' + (id === s.char ? ' on' : ''),
                attrs: { type: 'button' },
                style: { '--rc': hex(CHARACTERS[id].color) },
                text: CHARACTERS[id].name,
                on: { click: () => { sfx.select(); this.h.pick(id, 0); } },
              }),
            ),
          }),
          el('div', {
            cls: 'sel-row',
            kids: [
              el('div', {
                cls: 'swatches',
                kids: def.palettes.map((pal, k) =>
                  el('button', {
                    cls: 'swatch' + (k === s.palette ? ' on' : ''),
                    attrs: { type: 'button', 'aria-label': `Colour ${k + 1}` },
                    style: { background: `linear-gradient(135deg, ${hex(pal[0])} 50%, ${hex(pal[1])} 50%)` },
                    on: { click: () => { sfx.tap(); this.h.pick(s.char, k); } },
                  }),
                ),
              }),
              el('button', { cls: 'btn ghost small', attrs: { type: 'button' }, html: `${icon('list', 16)}<span>Moves</span>`, on: { click: () => this.h.moves(s.char, s.palette) } }),
            ],
          }),
        );
      }
      return card;
    };
    const rules = el('div', {
      cls: 'lobby-rules',
      kids: [
        el('div', { cls: 'opt-label', text: isHost ? 'Rules (you’re the host)' : 'Rules' }),
        el('div', {
          cls: 'stage-row compact',
          kids: STAGE_LIST.map((id) =>
            el('button', {
              cls: 'stage-card' + (id === l.stage ? ' on' : ''),
              attrs: { type: 'button', disabled: !isHost || l.phase !== 'lobby' },
              kids: [el('span', { cls: 'stage-thumb', style: { background: stageSwatch(id) } }), el('span', { cls: 'stage-name', text: STAGES[id].name })],
              on: { click: () => { sfx.tap(); this.h.host({ stage: id }); } },
            }),
          ),
        }),
        el('div', {
          cls: 'opt-inline',
          kids: [el('span', { cls: 'opt-label', text: 'Rounds' }), isHost ? segmented<number>([{ v: 1, label: '1' }, { v: 2, label: '2' }, { v: 3, label: '3' }], l.rounds, (v) => this.h.host({ rounds: v })) : el('b', { text: String(l.rounds) })],
        }),
        el('div', {
          cls: 'opt-inline',
          kids: [
            el('span', { cls: 'opt-label', text: 'Turn timer' }),
            isHost ? segmented<number>([{ v: 0, label: 'Off' }, { v: 30, label: '30s' }, { v: 60, label: '60s' }, { v: 90, label: '90s' }], l.timer, (v) => this.h.host({ timer: v })) : el('b', { text: l.timer ? `${l.timer}s` : 'Off' }),
          ],
        }),
      ],
    });
    const mySeat = me >= 0 ? l.seats[me] : null;
    const both = !!(l.seats[0] && l.seats[1]);
    const readyBtn =
      me >= 0 && mySeat
        ? el('button', {
            cls: 'btn big ' + (mySeat.ready ? 'on-ready' : 'primary'),
            attrs: { type: 'button', disabled: l.phase !== 'lobby' },
            html: mySeat.ready ? `${icon('check', 20)}<span>Ready — waiting${both ? '' : ' for a challenger'}</span>` : `<span>Ready</span>${icon('stepfwd', 18)}`,
            on: { click: () => { sfx.select(); this.h.ready(!mySeat.ready); } },
          })
        : el('div', { cls: 'muted', text: 'You’re spectating this room.' });
    this.body.replaceChildren(
      codeBox,
      el('div', { cls: 'seats', kids: [seatCard(0), el('div', { cls: 'vs', text: 'VS' }), seatCard(1)] }),
      rules,
      el('div', { cls: 'lobby-foot', kids: [readyBtn, l.spectators ? el('span', { cls: 'muted small', html: `${icon('eye', 14)} ${l.spectators} watching` }) : null] }),
    );
  }
}
