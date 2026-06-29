/** The touch planning panel: move palette, sequential timeline, aim, lock-in.
 *  Emits a validated ActionQueue when the player locks. */

import { sfx } from '../audio/sfx';
import { CHARACTERS } from '../content/characters';
import { PLAN_BUDGET, WINDOW_TICKS } from '../sim/step';
import { predictTrajectory } from '../sim/predict';
import type { ActionQueue, GameState, MoveDef, PlannedAction } from '../sim/types';
import type { Renderer } from '../render/renderer';
import { colorHex } from '../theme';
import { clear, el } from './dom';
import { icon } from './icons';

interface Entry {
  moveId: string;
  aimAngle?: number;
}

const MOVEMENT_IDS = [
  'walk_left', 'walk_right', 'dash_left', 'dash_right',
  'jump', 'hop_left', 'hop_right', 'shield', 'dodge',
];

export class PlanningPanel {
  root: HTMLElement;
  private renderer: Renderer;
  private state!: GameState;
  private idx = 0;
  private entries: Entry[] = [];
  private onLock: (q: ActionQueue) => void;
  private ctx: { chars: typeof CHARACTERS; stage: any };

  private timelineEl!: HTMLElement;
  private paletteEl!: HTMLElement;
  private budgetEl!: HTMLElement;
  private headEl!: HTMLElement;
  private aimWrap!: HTMLElement;
  private lockBtn!: HTMLButtonElement;

  private pendingAim?: { moveId: string; angle: number };

  constructor(
    renderer: Renderer,
    stage: any,
    onLock: (q: ActionQueue) => void,
  ) {
    this.renderer = renderer;
    this.ctx = { chars: CHARACTERS, stage };
    this.onLock = onLock;
    this.root = el('div', { cls: 'plan-panel hidden' });
    this.build();
  }

  private build() {
    this.headEl = el('div', { cls: 'plan-head' });
    this.budgetEl = el('div', { cls: 'budget-pips' });
    this.timelineEl = el('div', { cls: 'timeline' });
    this.paletteEl = el('div', { cls: 'palette' });
    this.aimWrap = el('div', { cls: 'aim-panel hidden' });

    this.lockBtn = el('button', {
      cls: 'lock-btn',
      text: 'LOCK IN',
      on: { click: () => this.lock() },
    }) as HTMLButtonElement;

    const controls = el('div', {
      cls: 'plan-controls',
      children: [
        el('button', { cls: 'ctrl-btn', html: icon('clear', { size: 18 }) + '<span>Clear</span>', on: { click: () => this.clearQueue() } }),
        el('button', { cls: 'ctrl-btn', html: icon('undo', { size: 18 }) + '<span>Undo</span>', on: { click: () => this.undo() } }),
        this.lockBtn,
      ],
    });

    this.root.append(
      el('div', { cls: 'plan-topbar', children: [this.headEl, this.budgetEl] }),
      el('div', { cls: 'timeline-wrap', children: [el('span', { cls: 'tl-label', text: 'SEQUENCE' }), this.timelineEl] }),
      this.aimWrap,
      this.paletteEl,
      controls,
    );
  }

  begin(state: GameState, playerIndex: number) {
    this.state = state;
    this.idx = playerIndex;
    this.entries = [];
    this.pendingAim = undefined;
    this.aimWrap.classList.add('hidden');
    this.root.classList.remove('hidden');
    this.renderer.clearAim();
    this.renderPalette();
    this.refresh();
  }

  hide() {
    this.root.classList.add('hidden');
    this.renderer.clearPrediction();
    this.renderer.clearAim();
  }

  private def() {
    const p = this.state.players[this.idx];
    return CHARACTERS[p.dynasty[p.activeIndex]];
  }

  private moveLen(m: MoveDef) {
    return m.startup + m.active + m.recovery;
  }

  private usedBudget(): number {
    const def = this.def();
    return this.entries.reduce((s, e) => s + def.moves[e.moveId].cost, 0);
  }

  private buildActions(): PlannedAction[] {
    const def = this.def();
    const out: PlannedAction[] = [];
    let cursor = 0;
    for (const e of this.entries) {
      const m = def.moves[e.moveId];
      if (cursor + this.moveLen(m) > WINDOW_TICKS) break;
      out.push({ moveId: e.moveId, startTick: cursor, aimAngle: e.aimAngle });
      cursor += this.moveLen(m);
    }
    return out;
  }

  private cursorTick(): number {
    const def = this.def();
    let cursor = 0;
    for (const e of this.entries) cursor += this.moveLen(def.moves[e.moveId]);
    return cursor;
  }

  private canAdd(m: MoveDef): boolean {
    if (this.usedBudget() + m.cost > PLAN_BUDGET) return false;
    if (this.cursorTick() + this.moveLen(m) > WINDOW_TICKS) return false;
    return true;
  }

  private renderPalette() {
    clear(this.paletteEl);
    const def = this.def();
    const color = this.state.players[this.idx].color;

    const groups = [
      { label: 'MOVE', ids: MOVEMENT_IDS.filter((id) => def.moves[id]) },
      {
        label: def.name + ' MOVES',
        ids: Object.keys(def.moves).filter((id) => !MOVEMENT_IDS.includes(id)),
      },
    ];

    for (const grp of groups) {
      const section = el('div', { cls: 'palette-group' });
      section.appendChild(el('div', { cls: 'group-label', text: grp.label }));
      const grid = el('div', { cls: 'move-grid' });
      for (const id of grp.ids) {
        const m = def.moves[id];
        if (!m) continue;
        const b = el('button', {
          cls: 'move-btn',
          attrs: m.desc ? { 'data-move': id, title: m.desc } : { 'data-move': id },
          style: { borderColor: colorHex(color) },
          on: { click: () => this.tapMove(id) },
          children: [
            el('span', { cls: 'move-glyph', html: icon(m.icon ?? 'dot', { size: 26, flip: m.iconFlip }) }),
            el('span', { cls: 'move-name', text: m.name }),
            el('span', {
              cls: 'move-meta',
              children: [
                el('span', { cls: 'cost-dots', text: '◈'.repeat(m.cost) }),
                m.aimable ? el('span', { cls: 'aim-tag', text: 'aim' }) : null,
              ],
            }),
          ],
        });
        grid.appendChild(b);
      }
      section.appendChild(grid);
      this.paletteEl.appendChild(section);
    }
  }

  private tapMove(id: string) {
    const def = this.def();
    const m = def.moves[id];
    if (!this.canAdd(m)) {
      sfx.uiBack();
      this.flashBudget();
      return;
    }
    if (m.aimable) {
      this.openAim(id);
      return;
    }
    this.entries.push({ moveId: id });
    sfx.place();
    this.refresh();
  }

  private openAim(moveId: string) {
    // default aim toward nearest opponent
    const me = this.state.characters[this.idx]!;
    let ang = me.facing === 1 ? 0 : 180;
    let best = Infinity;
    this.state.characters.forEach((c, j) => {
      if (j === this.idx || !c || !c.alive) return;
      const d = Math.abs(c.pos.x - me.pos.x) + Math.abs(c.pos.y - me.pos.y);
      if (d < best) {
        best = d;
        ang = Math.round((Math.atan2(-(c.pos.y - me.pos.y), c.pos.x - me.pos.x) * 180) / Math.PI);
      }
    });
    ang = ((ang % 360) + 360) % 360;
    this.pendingAim = { moveId, angle: ang };
    this.renderAim();
  }

  private renderAim() {
    clear(this.aimWrap);
    this.aimWrap.classList.remove('hidden');
    const pa = this.pendingAim!;
    const def = this.def();
    const m = def.moves[pa.moveId];
    const drawPreview = () => {
      const me = this.state.characters[this.idx]!;
      this.renderer.drawAim(me.pos, def, pa.angle, this.state.players[this.idx].color);
    };
    drawPreview();
    this.aimWrap.append(
      el('div', { cls: 'aim-title', text: `AIM ${m.name}` }),
      el('input', {
        cls: 'slider aim-slider',
        attrs: { type: 'range', min: '0', max: '359', value: String(pa.angle) },
        on: {
          input: (e: any) => {
            pa.angle = +e.target.value;
            drawPreview();
          },
        },
      }),
      el('div', {
        cls: 'aim-actions',
        children: [
          el('button', { cls: 'ctrl-btn', text: 'Cancel', on: { click: () => this.cancelAim() } }),
          el('button', {
            cls: 'ctrl-btn primary',
            text: 'Add ✓',
            on: {
              click: () => {
                this.entries.push({ moveId: pa.moveId, aimAngle: pa.angle });
                this.pendingAim = undefined;
                this.aimWrap.classList.add('hidden');
                this.renderer.clearAim();
                sfx.place();
                this.refresh();
              },
            },
          }),
        ],
      }),
    );
  }

  private cancelAim() {
    this.pendingAim = undefined;
    this.aimWrap.classList.add('hidden');
    this.renderer.clearAim();
    sfx.uiBack();
  }

  private undo() {
    if (this.entries.length === 0) return;
    this.entries.pop();
    sfx.uiTap();
    this.refresh();
  }

  private clearQueue() {
    this.entries = [];
    sfx.uiBack();
    this.refresh();
  }

  private flashBudget() {
    this.budgetEl.classList.remove('flash');
    void this.budgetEl.offsetWidth;
    this.budgetEl.classList.add('flash');
  }

  private refresh() {
    const def = this.def();
    const p = this.state.players[this.idx];
    // head
    clear(this.headEl);
    this.headEl.append(
      el('span', { cls: 'plan-pname', style: { color: colorHex(p.color) }, text: p.name }),
      el('span', { cls: 'plan-cname', text: ` · ${def.name}` }),
      el('span', { cls: 'plan-arch', text: def.archetype }),
    );
    // budget pips
    clear(this.budgetEl);
    const used = this.usedBudget();
    this.budgetEl.appendChild(el('span', { cls: 'budget-label', text: 'BUDGET' }));
    for (let i = 0; i < PLAN_BUDGET; i++) {
      this.budgetEl.appendChild(el('span', { cls: 'pip' + (i < used ? ' used' : '') }));
    }
    // timeline
    clear(this.timelineEl);
    if (this.entries.length === 0) {
      this.timelineEl.appendChild(el('span', { cls: 'tl-empty', text: 'tap moves to build a sequence — empty = stand still' }));
    }
    this.entries.forEach((e, i) => {
      const m = def.moves[e.moveId];
      this.timelineEl.appendChild(
        el('button', {
          cls: 'tl-chip',
          on: { click: () => { this.entries.splice(i, 1); sfx.uiTap(); this.refresh(); } },
          children: [
            el('span', { cls: 'tl-glyph', html: icon(m.icon ?? 'dot', { size: 18, flip: m.iconFlip }) }),
            el('span', { cls: 'tl-name', text: m.name + (e.aimAngle != null ? ` ${e.aimAngle}°` : '') }),
            el('span', { cls: 'tl-x', text: '×' }),
          ],
        }),
      );
    });
    // palette button enabled state
    this.paletteEl.querySelectorAll<HTMLButtonElement>('.move-btn').forEach((b) => {
      const id = b.getAttribute('data-move')!;
      const m = def.moves[id];
      b.classList.toggle('disabled', !this.canAdd(m));
    });
    // prediction
    const q: ActionQueue = {
      playerId: p.playerId,
      characterId: p.dynasty[p.activeIndex],
      actions: this.buildActions(),
    };
    const pred = predictTrajectory(this.state, this.idx, q, this.ctx);
    this.renderer.drawPrediction(pred.path, p.color, def);
  }

  private lock() {
    const p = this.state.players[this.idx];
    const q: ActionQueue = {
      playerId: p.playerId,
      characterId: p.dynasty[p.activeIndex],
      actions: this.buildActions(),
    };
    sfx.lock();
    this.hide();
    this.onLock(q);
  }
}
