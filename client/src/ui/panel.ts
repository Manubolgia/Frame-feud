/**
 * The action panel: pick a move, tune its parameters, preview it with the
 * ghost, lock in. In hitstun it becomes the DI + Burst picker.
 */

import { sfx } from '../audio/audio';
import type { GhostPolicy } from '../sim/resolve';
import { canFeint, defaultDecisionFor, inCancelWindow, moveAvailable, startFacing, type Need } from '../sim/rules';
import { FEINT_COST } from '../sim/step';
import type { Category, CharacterDef, Decision, GameState, MoveDef, SimCtx } from '../sim/types';
import { hex } from '../render/color';
import { el } from './dom';
import { fmtAdv, frameInfo } from './framedata';
import { icon } from './icons';
import { DirPad, segmented, Stepper } from './widgets';

const CATS: [Category, string, string][] = [
  ['move', 'Move', 'dash'],
  ['attack', 'Attack', 'punch'],
  ['special', 'Special', 'spark'],
  ['defend', 'Defend', 'block'],
  ['super', 'Super', 'super1'],
];

export interface PanelOpen {
  state: GameState;
  me: number;
  ctx: SimCtx;
  need: Need;
  name: string;
  color: number;
  /** Frame the opponent's current attack would hit us, if it's coming. */
  threat: number | null;
  canReplay: boolean;
  showFrames: boolean;
  /** Seconds left on a turn timer, or null. */
  timer: number | null;
}

export class ActionPanel {
  root: HTMLElement;
  onLock: (d: Decision) => void = () => {};
  onPreview: (d: Decision | null, policy: GhostPolicy) => void = () => {};
  onReplayLast: () => void = () => {};
  onLayout: () => void = () => {};
  onGhostToggle: (on: boolean) => void = () => {};

  private head = el('div', { cls: 'ph-who' });
  private tools = el('div', { cls: 'ph-tools' });
  private tabs = el('div', { cls: 'tabs', attrs: { role: 'tablist' } });
  private grid = el('div', { cls: 'grid' });
  private detail = el('div', { cls: 'detail' });
  private actions = el('div', { cls: 'actions' });
  private left = el('div', { cls: 'panel-left' });
  private timerEl = el('div', { cls: 'ph-timer hidden' });

  private o!: PanelOpen;
  private def!: CharacterDef;
  private cat: Category = 'attack';
  private sel: string | null = null;
  private drafts = new Map<string, Decision>();
  private di: [number, number] = [0, 0];
  private burst = false;
  private policy: GhostPolicy = 'wait';
  private ghostOn = true;
  private collapsed = false;
  private readout = el('div', { cls: 'ghost-readout' });
  private lockBtn!: HTMLButtonElement;
  private isOpen = false;
  private keyHandler = (e: KeyboardEvent) => this.onKey(e);

  constructor() {
    this.root = el('section', {
      cls: 'panel hidden',
      attrs: { 'aria-label': 'Choose your action' },
      kids: [
        el('header', { cls: 'panel-head', kids: [this.head, this.timerEl, this.tools] }),
        el('div', { cls: 'panel-body', kids: [this.left, this.detail, this.actions] }),
      ],
    });
    this.left.append(this.tabs, this.grid);
  }

  /** Forget per-move parameter memory (new match). */
  reset() {
    this.drafts.clear();
    this.sel = null;
    this.cat = 'attack';
    this.policy = 'wait';
  }

  setGhost(on: boolean) {
    this.ghostOn = on;
  }

  get open_(): boolean {
    return this.isOpen;
  }

  open(o: PanelOpen) {
    this.o = o;
    this.def = o.ctx.chars[o.state.fighters[o.me].char];
    this.di = [0, 0];
    this.burst = false;
    this.isOpen = true;
    this.root.classList.remove('hidden');
    this.root.classList.toggle('collapsed', this.collapsed);
    this.root.style.setProperty('--pc', hex(o.color));
    document.addEventListener('keydown', this.keyHandler);
    if (o.need === 'act') {
      const f = o.state.fighters[o.me];
      if (f.mode === 'down') this.cat = 'wake';
      else if (this.cat === 'wake') this.cat = 'attack';
      // keep the last pick if it's still usable
      if (this.sel) {
        const m = this.def.moves[this.sel];
        if (!m || !moveAvailable(o.state, o.me, m, o.ctx).ok) this.sel = null;
        else this.cat = m.cat;
      }
      if (f.mode === 'down' && (!this.sel || !this.def.moves[this.sel].wake)) this.sel = 'getup';
    }
    this.renderHead();
    this.render();
    this.emitPreview();
    this.onLayout();
  }

  close() {
    this.isOpen = false;
    this.root.classList.add('hidden');
    document.removeEventListener('keydown', this.keyHandler);
    this.onLayout();
  }

  setTimer(sec: number | null) {
    if (sec === null) {
      this.timerEl.classList.add('hidden');
      return;
    }
    this.timerEl.classList.remove('hidden');
    this.timerEl.classList.toggle('urgent', sec <= 5);
    this.timerEl.innerHTML = `${icon('wait', 15)}<span>${Math.max(0, Math.ceil(sec))}</span>`;
  }

  setCollapsed(c: boolean) {
    this.collapsed = c;
    this.root.classList.toggle('collapsed', c);
    this.renderTools();
    this.onLayout();
  }

  /** Readout from the ghost run (set by the match controller). */
  setReadout(html: string, tone: 'good' | 'bad' | 'neutral' = 'neutral') {
    this.readout.innerHTML = html;
    this.readout.dataset.tone = tone;
  }

  // ------------------------------------------------------------ header --

  private renderHead() {
    const o = this.o;
    const f = o.state.fighters[o.me];
    let status: string;
    if (o.need === 'di') status = `In hitstun · ${f.stun + f.hitlag}f left — steer with DI`;
    else if (f.mode === 'down') status = 'Knocked down — choose how to get up';
    else if (inCancelWindow(o.state, o.me, o.ctx)) status = 'Your attack connected — cancel into a follow-up, or let it finish';
    else status = f.grounded ? 'Your move' : 'Your move · airborne';
    this.head.replaceChildren(
      el('span', { cls: 'ph-dot' }),
      el('span', { cls: 'ph-name', text: o.name }),
      el('span', { cls: 'ph-char', text: this.def.name }),
      el('span', { cls: 'ph-status', text: status }),
    );
    this.renderTools();
  }

  private renderTools() {
    const tools: HTMLElement[] = [];
    if (this.o && this.o.need === 'act') tools.push(this.ghostCtrl());
    if (this.o?.canReplay)
      tools.push(
        el('button', {
          cls: 'icon-btn small',
          attrs: { type: 'button', title: 'Watch the last exchange again (R)', 'aria-label': 'Replay last exchange' },
          html: icon('replay', 18),
          on: { click: () => this.onReplayLast() },
        }),
      );
    tools.push(
      el('button', {
        cls: 'icon-btn small',
        attrs: { type: 'button', title: this.collapsed ? 'Show the panel (H)' : 'Hide the panel to see the arena (H)', 'aria-label': 'Toggle panel', 'aria-expanded': !this.collapsed },
        html: icon(this.collapsed ? 'chevup' : 'chevron', 18),
        on: {
          click: () => {
            sfx.tap();
            this.setCollapsed(!this.collapsed);
          },
        },
      }),
    );
    this.tools.replaceChildren(...tools);
  }

  // ------------------------------------------------------------ body --

  private render() {
    if (this.o.need === 'di') return this.renderDI();
    this.renderTabs();
    this.renderGrid();
    this.renderDetail();
  }

  private renderTabs() {
    const f = this.o.state.fighters[this.o.me];
    const cats: [Category, string, string][] = f.mode === 'down' ? [['wake', 'Wake up', 'getup']] : CATS;
    this.tabs.replaceChildren(
      ...cats.map(([c, label, ic], i) => {
        const ids = this.idsIn(c);
        const avail = ids.filter((id) => moveAvailable(this.o.state, this.o.me, this.def.moves[id], this.o.ctx).ok).length;
        return el('button', {
          cls: 'tab' + (c === this.cat ? ' on' : '') + (avail === 0 ? ' empty' : ''),
          attrs: { type: 'button', role: 'tab', 'aria-selected': c === this.cat, title: `${label} (${i + 1})` },
          html: `${icon(ic, 17)}<span class="tab-label">${label}</span><span class="tab-count">${avail}</span>`,
          on: {
            click: () => {
              sfx.tap();
              this.cat = c;
              this.renderTabs();
              this.renderGrid();
            },
          },
        });
      }),
    );
  }

  private idsIn(c: Category): string[] {
    return this.def.order.filter((id) => {
      const m = this.def.moves[id];
      return !m.hidden && m.cat === c;
    });
  }

  private renderGrid() {
    const o = this.o;
    const ids = this.idsIn(this.cat);
    this.grid.replaceChildren(
      ...ids.map((id) => {
        const m = this.def.moves[id];
        const av = moveAvailable(o.state, o.me, m, o.ctx);
        const fi = frameInfo(m, this.def, this.drafts.get(id)?.amt);
        const chip = fi.startup !== null ? `${fi.startup}f` : m.amtIsLength || m.parry ? 'var' : `${fi.total}f`;
        const meter = m.meter ? `<span class="tile-meter">${'▮'.repeat(m.meter / 1000)}</span>` : '';
        return el('button', {
          cls: 'tile' + (id === this.sel ? ' on' : '') + (av.ok ? '' : ' off'),
          attrs: { type: 'button', 'data-move': id, title: av.ok ? m.desc : `${m.name}: ${av.reason}` },
          html: `<span class="tile-ico">${icon(m.icon, 24)}</span><span class="tile-name">${m.name}</span><span class="tile-meta">${o.showFrames ? `<span class="tile-f">${chip}</span>` : ''}${meter}</span>`,
          on: { click: () => this.pick(id) },
        });
      }),
    );
  }

  private pick(id: string) {
    const m = this.def.moves[id];
    const av = moveAvailable(this.o.state, this.o.me, m, this.o.ctx);
    if (av.ok) sfx.select();
    else sfx.error();
    this.sel = id;
    this.grid.querySelectorAll('.tile').forEach((t) => t.classList.toggle('on', t.getAttribute('data-move') === id));
    this.renderDetail();
    this.emitPreview();
  }

  private draft(m: MoveDef): Decision {
    let d = this.drafts.get(m.id);
    if (!d) {
      d = defaultDecisionFor(this.o.state, this.o.me, m);
      this.drafts.set(m.id, d);
    } else if (m.param?.dir) {
      // Directions are remembered relative to facing.
      const face = startFacing(this.o.state, this.o.me, m);
      const prevFace = (d as Decision & { _f?: number })._f;
      if (prevFace && prevFace !== face && d.dir) d.dir = [-d.dir[0], d.dir[1]];
    }
    (d as Decision & { _f?: number })._f = startFacing(this.o.state, this.o.me, m);
    return d;
  }

  private renderDetail() {
    const o = this.o;
    if (!this.sel) {
      this.actions.replaceChildren(
        el('button', { cls: 'lock', attrs: { type: 'button', disabled: true }, html: `${icon('lock', 18)}<span>Lock in</span><kbd>Enter</kbd>` }),
      );
      this.detail.replaceChildren(
        el('div', {
          cls: 'detail-empty',
          kids: [
            el('div', { cls: 'detail-empty-ico', html: icon('target', 34) }),
            el('p', { text: 'Pick an action. The ghost shows how it plays out if your opponent does nothing.' }),
            el('p', { cls: 'muted', text: 'Keys: 1–5 tabs · arrows to browse · Enter to lock in · Space to pause the ghost.' }),
          ],
        }),
      );
      return;
    }
    const m = this.def.moves[this.sel];
    const av = moveAvailable(o.state, o.me, m, o.ctx);
    const d = this.draft(m);
    const fi = frameInfo(m, this.def, d.amt);
    const kids: HTMLElement[] = [];
    kids.push(
      el('div', {
        cls: 'detail-head',
        kids: [
          el('span', { cls: 'detail-ico', html: icon(m.icon, 26) }),
          el('div', { cls: 'detail-title', kids: [el('div', { cls: 'detail-name', text: m.name }), el('div', { cls: 'detail-cat', text: catLabel(m.cat) })] }),
        ],
      }),
    );
    kids.push(el('p', { cls: 'detail-desc', text: m.desc }));
    if (o.showFrames) {
      const cell = (k: string, v: string, cls = '') => el('div', { cls: `fd-cell ${cls}`, kids: [el('span', { cls: 'fd-k', text: k }), el('span', { cls: 'fd-v', text: v })] });
      const advCls = (n: number | null) => (n === null ? '' : n >= 0 ? 'pos' : 'neg');
      kids.push(
        el('div', {
          cls: 'fd',
          kids: [
            cell('Startup', fi.startup === null ? '—' : `${fi.startup}`),
            cell('Total', `${fi.total}`),
            cell('Damage', fi.damage === null ? '—' : `${fi.damage}`),
            cell('On hit', fmtAdv(fi.onHit), advCls(fi.onHit)),
            cell('On block', fmtAdv(fi.onBlock), advCls(fi.onBlock)),
          ],
        }),
      );
    }
    if (fi.tags.length) kids.push(el('div', { cls: 'tags', kids: fi.tags.map((t) => el('span', { cls: 'tag', text: t })) }));
    if (!av.ok) kids.push(el('div', { cls: 'detail-warn', html: `${icon('info', 16)}<span>${cap(av.reason ?? 'Unavailable')}</span>` }));

    // parameters
    const params = el('div', { cls: 'params' });
    const facing = startFacing(o.state, o.me, m);
    if (m.param?.dir) {
      const spec = m.param.dir;
      if (spec.kind === 'side') {
        const cur = (d.dir?.[0] ?? spec.def[0] * facing) < 0 ? -100 : 100;
        params.append(
          el('div', {
            cls: 'param',
            kids: [
              el('span', { cls: 'param-label', text: m.throw || m.hitboxes?.some((h) => h.kind === 'grab') ? 'Throw direction' : 'Direction' }),
              segmented<number>(
                [
                  { v: -100, label: facing === -1 ? 'Forward' : 'Back', icon: 'back' },
                  { v: 100, label: facing === 1 ? 'Forward' : 'Back', icon: 'stepfwd' },
                ],
                cur,
                (v) => {
                  d.dir = [v, 0];
                  this.emitPreview();
                },
                'seg-dir',
              ),
            ],
          }),
        );
      } else {
        const pad = new DirPad(spec, d.dir ?? [spec.def[0] * facing, spec.def[1]], facing, `${m.name} direction`);
        pad.onChange = (v) => {
          d.dir = v;
          this.emitPreview();
        };
        params.append(el('div', { cls: 'param param-dir', kids: [el('span', { cls: 'param-label', text: dirLabel(spec.kind) }), pad.root] }));
      }
    }
    if (m.param?.amt) {
      const a = m.param.amt;
      const st = new Stepper(a.label, a.min, a.max, d.amt ?? a.def, a.unit);
      st.onChange = (n) => {
        d.amt = n;
        this.refreshFrames();
        this.emitPreview();
      };
      const wrap = el('div', { cls: 'param', kids: [st.root] });
      if (m.parry && o.threat !== null) {
        st.mark(o.threat, 'Their hit lands here');
        const snap = el('button', {
          cls: 'chip-btn',
          attrs: { type: 'button' },
          html: `${icon('target', 14)}<span>Their hit lands on frame ${o.threat} — snap</span>`,
          on: {
            click: () => {
              st.set(o.threat!, true);
              sfx.select();
            },
          },
        });
        wrap.append(snap);
      }
      params.append(wrap);
    }
    if ((m.cat === 'attack' || m.cat === 'special') && Number.isFinite(fi.startup ?? NaN) && !m.throw && !m.hitboxes?.some((h) => h.kind === 'grab')) {
      const ok = canFeint(o.state, o.me, m);
      const fb = el('button', {
        cls: 'toggle small' + (d.feint && ok ? ' on' : '') + (ok ? '' : ' disabled'),
        attrs: { type: 'button', role: 'switch', 'aria-checked': !!d.feint, title: `Cancel the move just before it becomes active. Costs ${FEINT_COST / 1000} bar.` },
        kids: [
          el('span', { cls: 'toggle-text', kids: [el('span', { cls: 'toggle-label', text: 'Feint' }), el('span', { cls: 'toggle-sub', text: ok ? '½ bar · bail out before it hits' : 'needs ½ bar' })] }),
          el('span', { cls: 'toggle-track', kids: [el('span', { cls: 'toggle-knob' })] }),
        ],
        on: {
          click: () => {
            if (!ok) return sfx.error();
            d.feint = !d.feint;
            fb.classList.toggle('on', !!d.feint);
            sfx.tap();
            this.emitPreview();
          },
        },
      });
      params.append(fb);
    }
    const act: HTMLElement[] = [];
    if (params.childElementCount) act.push(params);
    act.push(this.readout);
    this.lockBtn = el('button', {
      cls: 'lock',
      attrs: { type: 'button', disabled: !av.ok },
      html: `${icon('lock', 18)}<span>Lock in</span><kbd>Enter</kbd>`,
      on: { click: () => this.lock() },
    });
    act.push(this.lockBtn);
    this.detail.replaceChildren(...kids);
    this.actions.replaceChildren(...act);
  }

  private refreshFrames() {
    if (!this.sel) return;
    const m = this.def.moves[this.sel];
    const fi = frameInfo(m, this.def, this.drafts.get(m.id)?.amt);
    const vals = this.detail.querySelectorAll('.fd-cell .fd-v');
    if (vals.length >= 2) vals[1].textContent = `${fi.total}`;
  }

  private ghostCtrl(): HTMLElement {
    const play = el('button', {
      cls: 'icon-btn small',
      attrs: { type: 'button', title: 'Play / pause the ghost (Space)', 'aria-label': 'Toggle ghost preview' },
      html: icon(this.ghostOn ? 'eye' : 'eyeoff', 18),
      on: {
        click: () => {
          this.ghostOn = !this.ghostOn;
          play.innerHTML = icon(this.ghostOn ? 'eye' : 'eyeoff', 18);
          sfx.tap();
          this.onGhostToggle(this.ghostOn);
        },
      },
    });
    const pol = segmented<GhostPolicy>(
      [
        { v: 'wait', label: 'They wait', title: 'Preview assumes the opponent stands still' },
        { v: 'block', label: 'They block', title: 'Preview assumes the opponent blocks' },
      ],
      this.policy,
      (v) => {
        this.policy = v;
        this.emitPreview();
      },
      'seg-small',
    );
    const busy = this.o.state.fighters[1 - this.o.me];
    const oppBusy = busy.mode !== 'idle' && busy.mode !== 'down';
    return el('div', { cls: 'ghost-ctrl', attrs: { title: 'Ghost preview' }, kids: [oppBusy ? null : pol, play] });
  }

  // ------------------------------------------------------------ DI --

  private renderDI() {
    const o = this.o;
    const f = o.state.fighters[o.me];
    const burstMove = this.def.moves.burst;
    const canBurst = !!burstMove && moveAvailable(o.state, o.me, burstMove, o.ctx).ok;
    this.tabs.replaceChildren();
    this.grid.replaceChildren(
      el('div', {
        cls: 'di-info',
        kids: [
          el('div', { cls: 'di-big', text: `${f.comboHits} HIT${f.comboHits === 1 ? '' : 'S'} · ${f.comboDmg} DMG` }),
          el('p', { text: 'You can’t act until hitstun ends. Directional influence (DI) bends the knockback of the next hits you take and lets you drift while airborne — push away from walls and out of combos.' }),
          el('p', {
            cls: 'muted',
            text: canBurst ? 'Burst is charged: explode out of the combo right now.' : `Burst charging: ${Math.floor((f.burst / 1000) * 100)}%`,
          }),
        ],
      }),
    );
    const pad = new DirPad({ kind: 'free', def: [0, 0] }, this.di, f.facing, 'Directional influence');
    pad.onChange = (v) => {
      this.di = v;
      this.emitPreview();
    };
    const burstBtn = el('button', {
      cls: 'toggle burst-toggle' + (this.burst ? ' on' : '') + (canBurst ? '' : ' disabled'),
      attrs: { type: 'button', role: 'switch', 'aria-checked': this.burst },
      kids: [
        el('span', { cls: 'toggle-text', kids: [el('span', { cls: 'toggle-label', html: `${icon('burst', 16)} Burst` }), el('span', { cls: 'toggle-sub', text: canBurst ? 'Break the combo (uses full gauge)' : 'Not charged' })] }),
        el('span', { cls: 'toggle-track', kids: [el('span', { cls: 'toggle-knob' })] }),
      ],
      on: {
        click: () => {
          if (!canBurst) return sfx.error();
          this.burst = !this.burst;
          burstBtn.classList.toggle('on', this.burst);
          sfx.tap();
          this.emitPreview();
        },
      },
    });
    this.lockBtn = el('button', {
      cls: 'lock',
      attrs: { type: 'button' },
      html: `${icon('lock', 18)}<span>Lock in</span><kbd>Enter</kbd>`,
      on: { click: () => this.lock() },
    });
    this.detail.replaceChildren(
      el('div', { cls: 'detail-head', kids: [el('span', { cls: 'detail-ico', html: icon('airdash', 26) }), el('div', { cls: 'detail-title', kids: [el('div', { cls: 'detail-name', text: 'Directional influence' }), el('div', { cls: 'detail-cat', text: 'While in hitstun' })] })] }),
      el('p', { cls: 'detail-desc', text: 'Drag the pad to bend the knockback of the next hits. Leave it centred for none.' }),
      burstBtn,
    );
    this.actions.replaceChildren(
      el('div', { cls: 'params', kids: [el('div', { cls: 'param param-dir', kids: [el('span', { cls: 'param-label', text: 'DI direction' }), pad.root] })] }),
      this.ghostRowDI(),
      this.lockBtn,
    );
  }

  private ghostRowDI(): HTMLElement {
    return this.readout;
  }

  // ------------------------------------------------------------ output --

  current(): Decision | null {
    if (!this.o) return null;
    if (this.o.need === 'di') return { move: this.burst ? 'burst' : '', di: [this.di[0], this.di[1]] };
    if (!this.sel) return null;
    const m = this.def.moves[this.sel];
    const d = this.draft(m);
    const out: Decision = { move: m.id };
    if (d.dir) out.dir = [d.dir[0], d.dir[1]];
    if (d.amt !== undefined) out.amt = d.amt;
    if (d.feint && canFeint(this.o.state, this.o.me, m)) out.feint = true;
    return out;
  }

  private emitPreview() {
    if (!this.isOpen) return;
    const d = this.current();
    if (d && d.move && !moveAvailable(this.o.state, this.o.me, this.def.moves[d.move], this.o.ctx).ok) {
      this.onPreview(null, this.policy);
      this.setReadout('');
      return;
    }
    this.onPreview(d, this.policy);
  }

  lock() {
    const d = this.current();
    if (!d) {
      sfx.error();
      this.grid.classList.remove('nudge');
      void this.grid.offsetWidth;
      this.grid.classList.add('nudge');
      return;
    }
    if (d.move && !moveAvailable(this.o.state, this.o.me, this.def.moves[d.move], this.o.ctx).ok) {
      sfx.error();
      return;
    }
    sfx.lock();
    this.close();
    this.onLock(d);
  }

  // ------------------------------------------------------------ keys --

  private onKey(e: KeyboardEvent) {
    if (!this.isOpen) return;
    const t = e.target as HTMLElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === 'Enter') {
      e.preventDefault();
      this.lock();
      return;
    }
    if (k === ' ') {
      e.preventDefault();
      this.ghostOn = !this.ghostOn;
      this.onGhostToggle(this.ghostOn);
      return;
    }
    if (k === 'h' || k === 'H') {
      this.setCollapsed(!this.collapsed);
      return;
    }
    if ((k === 'r' || k === 'R') && this.o.canReplay) {
      this.onReplayLast();
      return;
    }
    if (this.o.need !== 'act') return;
    if (/^[1-5]$/.test(k)) {
      const f = this.o.state.fighters[this.o.me];
      if (f.mode === 'down') return;
      this.cat = CATS[+k - 1][0];
      sfx.tap();
      this.renderTabs();
      this.renderGrid();
      return;
    }
    if (k === 'ArrowRight' || k === 'ArrowLeft' || k === 'ArrowDown' || k === 'ArrowUp') {
      if (t?.closest?.('.dirpad')) return;
      const ids = this.idsIn(this.cat);
      if (!ids.length) return;
      e.preventDefault();
      const i = this.sel ? ids.indexOf(this.sel) : -1;
      const cols = Math.max(1, Math.round(this.grid.clientWidth / 104));
      const step = k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : k === 'ArrowDown' ? cols : -cols;
      const n = i < 0 ? 0 : Math.max(0, Math.min(ids.length - 1, i + step));
      this.pick(ids[n]);
    }
  }
}

function catLabel(c: Category): string {
  return { move: 'Movement', attack: 'Attack', special: 'Special', defend: 'Defence', super: 'Super', wake: 'Wake-up', system: '' }[c];
}

function dirLabel(k: string): string {
  return { up: 'Jump arc — angle and height', down: 'Dive angle', aim: 'Aim', free: 'Direction and distance', side: 'Direction' }[k] ?? 'Direction';
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
