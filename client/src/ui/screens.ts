/** DOM screen builders: title, local setup, online lobby, results. */

import { CHARACTERS, DEFAULT_DYNASTIES, ROSTER } from '../content/characters';
import { STAGES, STAGE_LIST } from '../content/stages';
import { sfx } from '../audio/sfx';
import { colorHex, PLAYER_COLORS, PLAYER_GLYPHS } from '../theme';
import type { LobbyState } from '../net/protocol';
import { clear, el } from './dom';
import { icon } from './icons';

export interface LocalSlot {
  role: 'human' | 'cpu' | 'off';
  name: string;
  dynasty: string[];
}
export interface LocalConfig {
  slots: LocalSlot[];
  stageId: string;
  difficulty: number;
}

function logo(): HTMLElement {
  return el('div', {
    cls: 'logo',
    children: [
      el('div', { cls: 'logo-frame', text: 'FRAME' }),
      el('div', { cls: 'logo-feud', text: 'FEUD' }),
      el('div', { cls: 'logo-sub', text: 'simultaneous turn-based platform brawler' }),
    ],
  });
}

export function titleScreen(cb: {
  onLocal: () => void;
  onOnline: () => void;
  onPractice: () => void;
  onHelp: () => void;
  onToggleMute: () => void;
  muted: boolean;
}): HTMLElement {
  const btn = (label: string, sub: string, fn: () => void, primary = false) =>
    el('button', {
      cls: 'menu-btn' + (primary ? ' primary' : ''),
      on: {
        click: () => {
          sfx.uiSelect();
          fn();
        },
      },
      children: [
        el('span', { cls: 'menu-btn-label', text: label }),
        el('span', { cls: 'menu-btn-sub', text: sub }),
      ],
    });

  return el('div', {
    cls: 'screen title-screen',
    children: [
      el('div', { cls: 'bg-grid' }),
      logo(),
      el('div', {
        cls: 'menu-col',
        children: [
          btn('LOCAL MATCH', 'pass-and-play · up to 4 on one device', cb.onLocal, true),
          btn('ONLINE', 'room code · play with friends anywhere', cb.onOnline),
          btn('PRACTICE', 'you vs a CPU dummy — learn the flow', cb.onPractice),
          btn('HOW TO PLAY', 'the 30-second rundown', cb.onHelp),
        ],
      }),
      el('button', {
        cls: 'icon-btn mute-btn',
        html: icon(cb.muted ? 'sound_off' : 'sound_on'),
        on: {
          click: (e: any) => {
            cb.onToggleMute();
            e.currentTarget.innerHTML = icon(cb.muted ? 'sound_off' : 'sound_on');
          },
        },
      }),
      el('div', { cls: 'footer-tag', text: 'plan blind · lock in · watch it resolve' }),
    ],
  });
}

export function helpScreen(onBack: () => void): HTMLElement {
  const step = (n: string, title: string, body: string) =>
    el('div', {
      cls: 'help-step',
      children: [
        el('div', { cls: 'help-num', text: n }),
        el('div', {
          children: [el('h3', { text: title }), el('p', { text: body })],
        }),
      ],
    });
  return el('div', {
    cls: 'screen help-screen',
    children: [
      el('h2', { text: 'HOW TO PLAY' }),
      el('div', {
        cls: 'help-grid',
        children: [
          step('1', 'Plan blind', 'Every player secretly builds a queue of moves for the next ~1.6s. You spend an action budget — you can\'t do everything.'),
          step('2', 'Read your opponents', 'You see the whole board frozen. The ghost trail shows where YOU land if nobody interferes. Predict what others will do.'),
          step('3', 'Lock in', 'When everyone locks, all four plans resolve at once as a cinematic. No reflexes — only reads.'),
          step('4', 'Rack up damage', 'Hits raise your opponent\'s %. Higher % = bigger knockback. Launch them past the blast zone for a KO.'),
          step('5', 'Field a dynasty', 'Each player has a lineup of 3 characters. KO swaps in the next. Last player standing wins.'),
        ],
      }),
      el('button', {
        cls: 'menu-btn primary',
        text: 'GOT IT',
        on: { click: () => { sfx.uiBack(); onBack(); } },
      }),
    ],
  });
}

function dynastyCycler(dynasty: string[], color: number, onchange: () => void): HTMLElement {
  const row = el('div', { cls: 'dynasty-row' });
  const render = () => {
    clear(row);
    dynasty.forEach((cid, i) => {
      const def = CHARACTERS[cid];
      row.appendChild(
        el('button', {
          cls: 'char-chip',
          style: { borderColor: colorHex(def.color) },
          on: {
            click: () => {
              const idx = ROSTER.indexOf(cid);
              dynasty[i] = ROSTER[(idx + 1) % ROSTER.length];
              sfx.uiTap();
              render();
              onchange();
            },
          },
          children: [
            el('span', { cls: 'char-chip-dot', style: { background: colorHex(def.color) } }),
            el('span', { cls: 'char-chip-name', text: def.name }),
            el('span', { cls: 'char-chip-pos', text: `#${i + 1}` }),
          ],
        }),
      );
    });
  };
  render();
  return row;
}

export function localSetupScreen(
  initial: LocalConfig,
  cb: { onStart: (cfg: LocalConfig) => void; onBack: () => void },
): HTMLElement {
  const cfg: LocalConfig = JSON.parse(JSON.stringify(initial));

  const slotCards = el('div', { cls: 'slot-grid' });
  let startBtn: HTMLButtonElement;

  const refreshStart = () => {
    const active = cfg.slots.filter((s) => s.role !== 'off').length;
    const humans = cfg.slots.filter((s) => s.role === 'human').length;
    startBtn.disabled = active < 2 || humans < 1;
    startBtn.textContent = startBtn.disabled ? 'NEED ≥2 PLAYERS' : 'START MATCH ▶';
  };

  const renderSlots = () => {
    clear(slotCards);
    cfg.slots.forEach((slot, i) => {
      const color = PLAYER_COLORS[i];
      const roleBtns = el('div', { cls: 'role-toggle' });
      (['human', 'cpu', 'off'] as const).forEach((role) => {
        roleBtns.appendChild(
          el('button', {
            cls: 'role-btn' + (slot.role === role ? ' active' : ''),
            text: role === 'human' ? 'HUMAN' : role === 'cpu' ? 'CPU' : 'OFF',
            on: {
              click: () => {
                slot.role = role;
                sfx.uiTap();
                renderSlots();
                refreshStart();
              },
            },
          }),
        );
      });

      const card = el('div', {
        cls: 'slot-card' + (slot.role === 'off' ? ' off' : ''),
        style: { borderColor: colorHex(color) },
        children: [
          el('div', {
            cls: 'slot-head',
            children: [
              el('span', { cls: 'slot-glyph', text: PLAYER_GLYPHS[i], style: { color: colorHex(color) } }),
              el('span', { cls: 'slot-title', text: `P${i + 1}` }),
            ],
          }),
          roleBtns,
          slot.role === 'human'
            ? el('input', {
                cls: 'name-input',
                attrs: { value: slot.name, maxlength: '10', placeholder: `Player ${i + 1}` },
                on: { input: (e: any) => (slot.name = e.target.value) },
              })
            : el('div', { cls: 'slot-spacer' }),
          slot.role !== 'off'
            ? el('div', {
                cls: 'dynasty-label-wrap',
                children: [
                  el('div', { cls: 'mini-label', text: 'DYNASTY (tap to swap)' }),
                  dynastyCycler(slot.dynasty, color, () => {}),
                ],
              })
            : el('div', { cls: 'slot-off-msg', text: 'empty' }),
        ],
      });
      slotCards.appendChild(card);
    });
  };

  const stageToggle = el('div', { cls: 'stage-toggle' });
  const renderStage = () => {
    clear(stageToggle);
    STAGE_LIST.forEach((sid) => {
      stageToggle.appendChild(
        el('button', {
          cls: 'pill' + (cfg.stageId === sid ? ' active' : ''),
          text: STAGES[sid].name,
          on: {
            click: () => {
              cfg.stageId = sid;
              sfx.uiTap();
              renderStage();
            },
          },
        }),
      );
    });
  };

  renderSlots();
  renderStage();

  startBtn = el('button', {
    cls: 'menu-btn primary wide',
    text: 'START MATCH ▶',
    on: {
      click: () => {
        sfx.uiSelect();
        cb.onStart(cfg);
      },
    },
  }) as HTMLButtonElement;
  refreshStart();

  const diffWrap = el('div', {
    cls: 'diff-wrap',
    children: [
      el('span', { cls: 'mini-label', text: 'CPU SKILL' }),
      el('input', {
        attrs: { type: 'range', min: '0', max: '100', value: String(cfg.difficulty * 100) },
        cls: 'slider',
        on: { input: (e: any) => (cfg.difficulty = +e.target.value / 100) },
      }),
    ],
  });

  return el('div', {
    cls: 'screen setup-screen',
    children: [
      el('div', {
        cls: 'setup-head',
        children: [
          el('button', { cls: 'icon-btn', html: icon('back'), on: { click: () => { sfx.uiBack(); cb.onBack(); } } }),
          el('h2', { text: 'LOCAL MATCH' }),
          el('div', { cls: 'spacer' }),
        ],
      }),
      slotCards,
      el('div', {
        cls: 'setup-footer',
        children: [
          el('div', { cls: 'stage-wrap', children: [el('span', { cls: 'mini-label', text: 'STAGE' }), stageToggle] }),
          diffWrap,
          startBtn,
        ],
      }),
    ],
  });
}

export function onlineEntryScreen(cb: {
  onCreate: (name: string) => void;
  onJoin: (name: string, room: string) => void;
  onBack: () => void;
  defaultName: string;
}): HTMLElement {
  let name = cb.defaultName;
  let room = '';
  return el('div', {
    cls: 'screen online-screen',
    children: [
      el('div', {
        cls: 'setup-head',
        children: [
          el('button', { cls: 'icon-btn', html: icon('back'), on: { click: () => { sfx.uiBack(); cb.onBack(); } } }),
          el('h2', { text: 'ONLINE' }),
          el('div', { cls: 'spacer' }),
        ],
      }),
      el('div', {
        cls: 'online-card',
        children: [
          el('label', { cls: 'mini-label', text: 'YOUR NAME' }),
          el('input', {
            cls: 'name-input big',
            attrs: { value: name, maxlength: '10', placeholder: 'Name' },
            on: { input: (e: any) => (name = e.target.value) },
          }),
          el('button', {
            cls: 'menu-btn primary wide',
            text: 'CREATE ROOM',
            on: { click: () => { sfx.uiSelect(); cb.onCreate(name || 'Host'); } },
          }),
          el('div', { cls: 'or-divider', text: 'or join with a code' }),
          el('input', {
            cls: 'name-input big code',
            attrs: { maxlength: '6', placeholder: 'ROOM CODE', autocapitalize: 'characters' },
            on: { input: (e: any) => (room = e.target.value.toUpperCase()) },
          }),
          el('button', {
            cls: 'menu-btn wide',
            text: 'JOIN ROOM',
            on: { click: () => { sfx.uiSelect(); cb.onJoin(name || 'Player', room); } },
          }),
        ],
      }),
    ],
  });
}

export function lobbyScreen(
  lobby: LobbyState,
  myId: string,
  cb: {
    onDynasty: (d: string[]) => void;
    onStage: (s: string) => void;
    onReady: (r: boolean) => void;
    onStart: () => void;
    onLeave: () => void;
  },
): HTMLElement {
  const me = lobby.players.find((p) => p.playerId === myId);
  const isHost = !!me?.isHost;
  const allReady = lobby.players.length >= 2 && lobby.players.every((p) => p.ready || p.isHost);

  const playerList = el('div', { cls: 'lobby-list' });
  lobby.players.forEach((p) => {
    const color = PLAYER_COLORS[p.slot];
    playerList.appendChild(
      el('div', {
        cls: 'lobby-player' + (p.playerId === myId ? ' me' : ''),
        style: { borderColor: colorHex(color) },
        children: [
          el('span', { cls: 'slot-glyph', text: PLAYER_GLYPHS[p.slot], style: { color: colorHex(color) } }),
          el('div', {
            cls: 'lobby-pinfo',
            children: [
              el('span', { cls: 'lobby-name', text: p.name + (p.playerId === myId ? ' (you)' : '') }),
              el('span', {
                cls: 'lobby-dynasty',
                text: p.dynasty.map((c) => CHARACTERS[c].name).join(' · '),
              }),
            ],
          }),
          el('span', { cls: 'lobby-status ' + (p.ready || p.isHost ? 'ready' : 'waiting'), text: p.isHost ? 'HOST' : p.ready ? 'READY' : '…' }),
        ],
      }),
    );
  });

  const myDynasty = me ? me.dynasty.slice() : DEFAULT_DYNASTIES[0];

  const stageToggle = el('div', { cls: 'stage-toggle' });
  STAGE_LIST.forEach((sid) => {
    stageToggle.appendChild(
      el('button', {
        cls: 'pill' + (lobby.stageId === sid ? ' active' : ''),
        text: STAGES[sid].name,
        attrs: isHost ? {} : { disabled: 'true' },
        on: { click: () => isHost && cb.onStage(sid) },
      }),
    );
  });

  return el('div', {
    cls: 'screen lobby-screen',
    children: [
      el('div', {
        cls: 'setup-head',
        children: [
          el('button', { cls: 'icon-btn', html: icon('back'), on: { click: cb.onLeave } }),
          el('h2', { text: 'ROOM ' + lobby.room }),
          el('button', {
            cls: 'icon-btn',
            html: icon('copy', { size: 18 }),
            attrs: { title: 'copy code' },
            on: { click: () => navigator.clipboard?.writeText(lobby.room) },
          }),
        ],
      }),
      el('div', { cls: 'lobby-hint', text: 'Share the room code. Up to 4 players.' }),
      playerList,
      el('div', { cls: 'mini-label', text: 'YOUR DYNASTY (tap to swap)' }),
      dynastyCycler(myDynasty, me ? PLAYER_COLORS[me.slot] : 0xffffff, () => cb.onDynasty(myDynasty)),
      el('div', { cls: 'stage-wrap', children: [el('span', { cls: 'mini-label', text: 'STAGE' }), stageToggle] }),
      isHost
        ? el('button', {
            cls: 'menu-btn primary wide',
            text: allReady ? 'START MATCH ▶' : 'WAITING FOR PLAYERS…',
            attrs: allReady ? {} : { disabled: 'true' },
            on: { click: cb.onStart },
          })
        : el('button', {
            cls: 'menu-btn primary wide' + (me?.ready ? ' ready-on' : ''),
            text: me?.ready ? '✓ READY (tap to cancel)' : 'READY UP',
            on: { click: () => cb.onReady(!me?.ready) },
          }),
    ],
  });
}

export function resultsScreen(
  winnerName: string,
  winnerColor: number,
  standings: { name: string; color: number; kos: number }[],
  cb: { onRematch: () => void; onMenu: () => void },
): HTMLElement {
  return el('div', {
    cls: 'screen results-screen',
    children: [
      el('div', { cls: 'bg-grid' }),
      el('div', { cls: 'winner-badge', text: 'WINNER' }),
      el('div', { cls: 'winner-name', style: { color: colorHex(winnerColor) }, text: winnerName }),
      el('div', {
        cls: 'standings',
        children: standings.map((s) =>
          el('div', {
            cls: 'standing-row',
            children: [
              el('span', { cls: 'standing-dot', style: { background: colorHex(s.color) } }),
              el('span', { cls: 'standing-name', text: s.name }),
              el('span', { cls: 'standing-kos', text: `${s.kos} KO` }),
            ],
          }),
        ),
      }),
      el('div', {
        cls: 'menu-col',
        children: [
          el('button', { cls: 'menu-btn primary', text: 'REMATCH', on: { click: () => { sfx.uiSelect(); cb.onRematch(); } } }),
          el('button', { cls: 'menu-btn', text: 'MAIN MENU', on: { click: () => { sfx.uiBack(); cb.onMenu(); } } }),
        ],
      }),
    ],
  });
}

export function defaultLocalConfig(): LocalConfig {
  return {
    slots: [
      { role: 'human', name: 'Player 1', dynasty: DEFAULT_DYNASTIES[0].slice() },
      { role: 'cpu', name: 'CPU 2', dynasty: DEFAULT_DYNASTIES[1].slice() },
      { role: 'cpu', name: 'CPU 3', dynasty: DEFAULT_DYNASTIES[2].slice() },
      { role: 'off', name: 'Player 4', dynasty: DEFAULT_DYNASTIES[3].slice() },
    ],
    stageId: 'skyforge',
    difficulty: 0.7,
  };
}
