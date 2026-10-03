/**
 * Match controller: the decide → resolve → play-back loop for every mode.
 *
 * Decisions come from a Driver (local humans + CPUs, the network, a replay
 * log, or the title-screen attract mode). The controller resolves them with
 * the deterministic sim, plays the frames back with effects and sound,
 * handles rounds, and drives the planning ghost and HUD.
 */

import { setIntensity, sfx } from '../audio/audio';
import { CHARACTERS, ctxFor } from '../content/roster';
import type { Arena, GhostView } from '../render/arena';
import { ghost, resolve, type GhostPolicy, type MatchLog } from '../sim/resolve';
import { canAct, needsInput } from '../sim/rules';
import { createMatch, hashState, snapshot, startNextRound } from '../sim/state';
import { firstActive } from '../sim/step';
import type { Decision, GameState, MatchConfig, SimCtx, SimEvent, Snapshot } from '../sim/types';
import type { Banner } from '../ui/banner';
import type { Hud } from '../ui/hud';
import type { ActionPanel } from '../ui/panel';
import { settings } from './settings';

export type Mode = 'cpu' | 'local' | 'online' | 'training' | 'replay' | 'attract';

export interface UiBundle {
  arena: Arena;
  hud: Hud;
  panel: ActionPanel;
  banner: Banner;
  /** Recompute the arena band from the DOM (HUD + panel). */
  layout: () => void;
}

export interface Driver {
  /** Decisions for the current decision point. May await humans / network. */
  decide(m: Match): Promise<[Decision, Decision]>;
  /** Called after each resolution (online: report hashes). */
  resolved?(m: Match, hash: string): void;
  /** Match finished. */
  ended?(m: Match): void;
  dispose?(): void;
}

export interface MatchResult {
  winner: number;
  state: GameState;
  log: MatchLog;
  mode: Mode;
}

interface Playback {
  frames: Snapshot[];
  events: SimEvent[];
  pos: number;
  fired: number;
  done: () => void;
}

export class Match {
  readonly mode: Mode;
  readonly cfg: MatchConfig;
  readonly ctx: SimCtx;
  state: GameState;
  log: MatchLog;
  ui: UiBundle;
  driver: Driver;
  labels: [string, string];
  onEnd: (r: MatchResult) => void = () => {};
  /** Hook to adjust state between turns (training mode). */
  beforeDecide: ((st: GameState) => GameState) | null = null;

  private pb: Playback | null = null;
  private disp: { a: Snapshot; b: Snapshot; t: number };
  private slow = 0;
  private ff = false;
  private ghostV: GhostView | null = null;
  private ghostHold = 0;
  ghostOn = settings.ghost;
  paused = false;
  private alive = true;
  private lastRes: { frames: Snapshot[]; events: SimEvent[] } | null = null;
  private wide: boolean;
  victor = -1;
  phase: 'intro' | 'plan' | 'play' | 'between' | 'over' = 'intro';
  /** Fighter whose decision the panel is currently showing. */
  planning = -1;

  constructor(cfg: MatchConfig, mode: Mode, ui: UiBundle, driver: Driver, labels: [string, string], log?: MatchLog) {
    this.mode = mode;
    this.cfg = cfg;
    this.ctx = ctxFor(cfg.stageId);
    this.ui = ui;
    this.driver = driver;
    this.labels = labels;
    this.state = createMatch(cfg, this.ctx);
    this.log = log ?? { v: 2, cfg, steps: [] };
    const s = snapshot(this.state, this.ctx);
    this.disp = { a: s, b: s, t: 0 };
    this.wide = false;
    ui.arena.setMatch(cfg);
    ui.arena.frame(s, true, this.wide);
  }

  get snap(): Snapshot {
    return this.disp.b;
  }

  async start(skipIntro = false) {
    if (this.mode !== 'attract') this.mountHud();
    if (!skipIntro) await this.roundIntro();
    this.loop();
  }

  mountHud() {
    const cfg = this.cfg;
    const defs: [typeof CHARACTERS.razor, typeof CHARACTERS.razor] = [CHARACTERS[cfg.chars[0]], CHARACTERS[cfg.chars[1]]];
    const colors: [number, number] = [this.ui.arena.palette(0)[0], this.ui.arena.palette(1)[0]];
    this.ui.hud.mount(cfg, defs, colors, this.labels);
    this.ui.hud.resetBars([defs[0].hp, defs[1].hp]);
    this.ui.hud.setRound(this.state.round, this.state.wins, this.state.step);
    this.ui.layout();
  }

  /** Jump to a later state without playback (online resume). */
  fastForward(log: [Decision, Decision][]) {
    for (const ds of log) {
      const r = resolve(this.state, ds, this.ctx, { record: false });
      this.state = r.end;
      this.log.steps.push(ds);
      if (this.state.roundOver && this.state.winner === null) this.state = startNextRound(this.state, this.ctx);
    }
    const s = snapshot(this.state, this.ctx);
    this.disp = { a: s, b: s, t: 0 };
    this.ui.hud.resetBars([CHARACTERS[this.cfg.chars[0]].hp, CHARACTERS[this.cfg.chars[1]].hp]);
    this.ui.hud.setRound(this.state.round, this.state.wins, this.state.step);
  }

  abort() {
    this.alive = false;
    this.pb = null;
    this.ghostV = null;
    this.ui.panel.close();
    this.ui.hud.setTags([null, null]);
    this.driver.dispose?.();
  }

  get running(): boolean {
    return this.alive;
  }

  // ------------------------------------------------------------ loop --

  private async loop() {
    while (this.alive) {
      if (this.state.winner !== null) break;
      if (this.beforeDecide) this.state = this.beforeDecide(this.state);
      const s = snapshot(this.state, this.ctx);
      this.disp = { a: s, b: s, t: 0 };
      this.phase = 'plan';
      setIntensity(this.mode === 'attract' ? 0.5 : 0);
      this.showTags();
      let ds: [Decision, Decision];
      try {
        ds = await this.driver.decide(this);
      } catch {
        return; // aborted
      }
      if (!this.alive) return;
      this.ghostV = null;
      this.planning = -1;
      this.ui.hud.setTags([null, null]);
      this.ui.layout();
      this.log.steps.push([ds[0], ds[1]]);
      const r = resolve(this.state, ds, this.ctx);
      this.driver.resolved?.(this, hashState(r.end));
      this.lastRes = { frames: r.frames, events: r.events };
      this.phase = 'play';
      setIntensity(1);
      await this.play(r.frames, r.events);
      if (!this.alive) return;
      this.state = r.end;
      this.ui.hud.setRound(this.state.round, this.state.wins, this.state.step);
      if (this.state.roundOver) {
        this.phase = 'between';
        await this.roundEnd();
        if (!this.alive) return;
        if (this.state.winner !== null) break;
        this.state = startNextRound(this.state, this.ctx);
        const s2 = snapshot(this.state, this.ctx);
        this.disp = { a: s2, b: s2, t: 0 };
        this.ui.arena.frame(s2, false, this.wide);
        this.ui.hud.resetBars([CHARACTERS[this.cfg.chars[0]].hp, CHARACTERS[this.cfg.chars[1]].hp]);
        this.ui.hud.setRound(this.state.round, this.state.wins, this.state.step);
        await this.roundIntro();
      }
    }
    if (!this.alive) return;
    this.phase = 'over';
    this.driver.ended?.(this);
    this.onEnd({ winner: this.state.winner ?? -1, state: this.state, log: this.log, mode: this.mode });
  }

  private play(frames: Snapshot[], events: SimEvent[]): Promise<void> {
    return new Promise((resolve) => {
      this.pb = { frames, events, pos: 0, fired: 0, done: resolve };
      this.ff = false;
    });
  }

  /** Re-watch the previous exchange (planning keeps waiting meanwhile). */
  replayLast() {
    if (!this.lastRes || this.pb) return;
    const keep = this.disp;
    const ghostKeep = this.ghostV;
    this.ghostV = null;
    this.ui.panel.setCollapsed(true);
    this.pb = {
      frames: this.lastRes.frames,
      events: this.lastRes.events,
      pos: 0,
      fired: 0,
      done: () => {
        this.disp = keep;
        this.ghostV = ghostKeep;
        this.ui.panel.setCollapsed(false);
      },
    };
    (this.pb as Playback & { quiet?: boolean }).quiet = true;
  }

  get canReplay(): boolean {
    return !!this.lastRes && this.mode !== 'replay';
  }

  fastForwardPlayback(on: boolean) {
    this.ff = on;
  }

  // ------------------------------------------------------------ rounds --

  private async roundIntro() {
    if (this.mode === 'attract') return;
    const b = this.ui.banner;
    const final = this.state.wins[0] === this.cfg.roundsToWin - 1 && this.state.wins[1] === this.cfg.roundsToWin - 1;
    sfx.round();
    await b.call(final ? 'Final round' : `Round ${this.state.round}`, { ms: 900, cls: 'call-round' });
    if (!this.alive) return;
    sfx.fight();
    await b.call('Fight!', { ms: 520, cls: 'call-fight' });
  }

  private async roundEnd() {
    const st = this.state;
    const w = st.ko?.winner ?? -1;
    if (this.mode === 'attract') {
      await wait(1200);
      return;
    }
    const b = this.ui.banner;
    if (w < 0) {
      await b.call('Double K.O.', { ms: 1300, cls: 'call-ko' });
      return;
    }
    const def = CHARACTERS[this.cfg.chars[w]];
    const perfect = st.fighters[w].hp === def.hp;
    this.victor = w;
    if (st.winner !== null) {
      sfx.win();
      await b.call(`${this.cfg.names[w]} wins`, { sub: perfect ? 'Perfect' : def.title, color: this.ui.arena.palette(w)[0], ms: 1800, cls: 'call-win' });
    } else {
      await b.call(`${this.cfg.names[w]} takes round ${st.round}`, { sub: perfect ? 'Perfect' : undefined, color: this.ui.arena.palette(w)[0], ms: 1400, cls: 'call-roundwin' });
    }
    this.victor = -1;
  }

  // ------------------------------------------------------------ frame --

  tick(dt: number) {
    if (this.paused && this.mode !== 'online') {
      this.render(0);
      return;
    }
    if (this.pb) this.advance(dt);
    if (this.ghostV && this.ghostOn) {
      const g = this.ghostV;
      if (this.ghostHold > 0) this.ghostHold -= dt;
      else {
        g.at += dt * 60;
        const end = g.frames.length - 1;
        if (g.at >= end) {
          g.at = end;
          this.ghostHold = 0.6;
        }
      }
      if (this.ghostHold <= 0 && g.at >= g.frames.length - 1) g.at = 0;
      if (this.ghostHold > 0 && this.ghostHold - dt <= 0) g.at = 0;
    }
    this.render(dt);
  }

  private advance(dt: number) {
    const pb = this.pb!;
    let speed = settings.speed * (this.ff ? 3 : 1);
    if (this.slow > 0) {
      this.slow -= dt;
      speed *= this.slow > 0.4 ? 0.22 : 0.22 + (0.4 - this.slow) * 1.9;
    }
    if (this.mode === 'attract') speed = 1;
    pb.pos += dt * 60 * speed;
    const last = pb.frames.length - 1;
    const k = Math.min(last, Math.floor(pb.pos));
    // fire events up to frame k
    while (pb.fired < pb.events.length && pb.events[pb.fired].f < pb.frames[k].f) {
      this.fire(pb.events[pb.fired], pb.frames[Math.min(last, k)], (pb as Playback & { quiet?: boolean }).quiet);
      pb.fired++;
    }
    const a = pb.frames[Math.max(0, Math.min(last, k))];
    const b = pb.frames[Math.min(last, k + 1)];
    this.disp = { a, b, t: k >= last ? 0 : pb.pos - k };
    if (pb.pos >= last) {
      this.disp = { a: pb.frames[last], b: pb.frames[last], t: 0 };
      this.pb = null;
      pb.done();
    }
  }

  private fire(e: SimEvent, s: Snapshot, quiet = false) {
    const opts = { reducedMotion: settings.reducedMotion, shake: this.mode === 'attract' ? 0.4 : settings.shake };
    this.ui.arena.onEvent(e, s, opts);
    if (this.mode === 'attract') {
      if (e.t === 'ko') this.slow = 1;
      return;
    }
    if (quiet && e.t !== 'hit') return;
    switch (e.t) {
      case 'hit':
        if (e.kind === 'block') sfx.block(e.power);
        else if (e.kind === 'parry') {
          sfx.parry();
          this.slow = Math.max(this.slow, 0.5);
        } else if (e.kind === 'armor') sfx.armor();
        else if (e.kind === 'tech') sfx.tech();
        else if (e.kind === 'grab') sfx.grab();
        else {
          sfx.hit(e.power, e.fx, e.kind === 'counter');
          if (e.kind === 'counter' && !settings.reducedMotion) this.slow = Math.max(this.slow, 0.25);
        }
        break;
      case 'ko':
        sfx.ko();
        this.slow = settings.reducedMotion ? 0.6 : 1.3;
        this.ui.banner.call('K.O.', { ms: 1100, cls: 'call-ko' });
        break;
      case 'whiff': {
        const m = CHARACTERS[this.cfg.chars[e.i]].moves[e.move];
        sfx.whiff((m?.hitboxes?.[0]?.dmg ?? 0) > 70);
        break;
      }
      case 'jump':
        if (e.air) sfx.dash();
        else sfx.jump();
        break;
      case 'land':
        sfx.land(e.hard);
        break;
      case 'wall':
      case 'bounce':
        sfx.wall();
        break;
      case 'spawn':
        sfx.spawn(e.kind);
        break;
      case 'vanish':
      case 'appear':
        sfx.vanish();
        break;
      case 'feint':
        sfx.feint();
        break;
      case 'move': {
        const m = CHARACTERS[this.cfg.chars[e.i]].moves[e.move];
        if (m?.superFlash) {
          sfx.super();
          this.ui.banner.call(m.name, { ms: 700, cls: 'call-super', color: this.ui.arena.palette(e.i)[0] });
        }
        if (e.move === 'burst') sfx.burst();
        if (e.move === 'dash' || e.move === 'backdash' || e.move === 'airdash') sfx.dash();
        break;
      }
    }
  }

  private render(dt: number) {
    const { a, b, t } = this.disp;
    this.ui.arena.render(
      dt,
      a,
      b,
      t,
      {
        hitboxes: settings.hitboxes || this.mode === 'training' ? settings.hitboxes : false,
        reducedMotion: settings.reducedMotion,
        wide: this.wide,
        victor: this.victor >= 0 ? this.victor : undefined,
      },
      this.ghostOn && this.phase === 'plan' && !this.pb ? this.ghostV : null,
    );
    if (this.mode !== 'attract') {
      this.ui.hud.update(b.fighters, dt);
      if (this.phase === 'plan' && !this.pb) this.positionTags();
    }
  }

  // ------------------------------------------------------------ planning --

  /** Called by the panel when the tentative decision changes. */
  preview(me: number, d: Decision | null, policy: GhostPolicy) {
    if (!d) {
      this.ghostV = null;
      this.ui.panel.setReadout('');
      return;
    }
    const st = this.state;
    const o = 1 - me;
    const need = needsInput(st, o, this.ctx);
    let opp: Decision = { move: '' };
    if (need === 'act') opp = st.fighters[o].mode === 'down' ? { move: 'getup' } : policy === 'block' ? { move: 'block', amt: 40 } : { move: 'wait', amt: 60 };
    if (need === 'di') opp = { move: '', di: [0, 0] };
    const g = ghost(st, me, d, opp, policy, this.ctx, { limit: 140, tail: 10 });
    const hits: { x: number; y: number }[] = [];
    let dealt = 0;
    let taken = 0;
    let blocked = false;
    let parried = false;
    for (const e of g.events) {
      if (e.t !== 'hit') continue;
      if (e.a === me && e.v === o) {
        if (e.kind === 'block') blocked = true;
        else if (e.kind === 'parry') parried = true;
        else dealt += e.dmg;
        hits.push({ x: e.x, y: e.y });
      } else if (e.v === me && e.kind !== 'block' && e.kind !== 'parry') taken += e.dmg;
      if (e.v === me && e.kind === 'parry') parried = true;
    }
    const keepAt = this.ghostV ? this.ghostV.at : 0;
    this.ghostV = { frames: g.frames, me, at: Math.min(keepAt, g.frames.length - 1), myNext: g.myNext, showOpponent: true, hits };
    this.ghostHold = 0;

    // Readout
    let adv: number | null = null;
    if (g.myNext > 0 && g.myNext < g.frames.length) {
      const of = g.frames[g.myNext].fighters[o];
      if (of.mode === 'hitstun' || of.mode === 'blockstun' || of.mode === 'parried') adv = of.stun + of.hitlag;
      else if (of.mode === 'kd') adv = of.stun + of.hitlag;
    }
    const nx = g.myNext > 0 ? `free on frame ${g.myNext}` : 'still busy after 140f';
    let html: string;
    let tone: 'good' | 'bad' | 'neutral' = 'neutral';
    if (d.move === '' && d.di) {
      html = taken > 0 ? `Next hits deal <b>${taken}</b> if they continue` : 'DI applies to the next hits you take';
    } else if (taken > 0 && dealt === 0) {
      html = `<b>You get hit</b> · −${taken}`;
      tone = 'bad';
    } else if (parried) {
      html = `<b>Parried!</b> · ${nx}`;
      tone = 'good';
    } else if (dealt > 0) {
      html = `<b>Hit</b> · ${dealt} dmg${adv !== null ? ` · <b>+${adv}</b>` : ''}${taken ? ` · trade −${taken}` : ''}`;
      tone = taken > dealt ? 'bad' : 'good';
    } else if (blocked) {
      html = `<b>Blocked</b> · ${nx}`;
    } else {
      html = cap(nx);
    }
    this.ui.panel.setReadout(html, tone);
  }

  /** Frame the opponent's current attack would hit fighter `me` if it continues. */
  threatFor(me: number): number | null {
    const st = this.state;
    const o = st.fighters[1 - me];
    const busy = o.mode === 'move' || st.projs.some((p) => p.owner !== me);
    if (!busy) return null;
    const g = ghost(st, me, { move: 'wait', amt: 40 }, { move: '' }, 'wait', this.ctx, { limit: 40, tail: 0, record: false });
    const start = st.frame;
    for (const e of g.events) if (e.t === 'hit' && e.v === me) return e.f - start;
    return null;
  }

  // ------------------------------------------------------------ tags --

  private tagText: [{ text: string; tone: string } | null, { text: string; tone: string } | null] = [null, null];

  showTags() {
    const st = this.state;
    if (this.mode === 'attract' || this.mode === 'replay') {
      this.tagText = [null, null];
      return;
    }
    const busy = (i: number): number => {
      const f = st.fighters[i];
      if (canAct(st, i, this.ctx)) return 0;
      switch (f.mode) {
        case 'move':
          return f.hitlag + (f.move ? f.move.total - f.move.frame : 0);
        case 'hitstun':
        case 'blockstun':
        case 'parried':
        case 'kd':
          return f.hitlag + f.stun;
        default:
          return 0;
      }
    };
    this.tagText = [0, 1].map((i) => {
      const f = st.fighters[i];
      const other = busy(1 - i);
      if (canAct(st, i, this.ctx)) {
        if (f.mode === 'down') return { text: 'Getting up', tone: 'warn' };
        return { text: other > 0 ? `Ready  +${other}` : 'Ready', tone: 'good' };
      }
      switch (f.mode) {
        case 'hitstun':
          return { text: `Hitstun ${busy(i)}`, tone: 'bad' };
        case 'blockstun':
          return { text: `Blockstun ${busy(i)}`, tone: 'warn' };
        case 'parried':
          return { text: `Staggered ${busy(i)}`, tone: 'bad' };
        case 'kd':
          return { text: `Down ${busy(i)}`, tone: 'bad' };
        case 'grabbed':
          return { text: 'Grabbed', tone: 'bad' };
        case 'move': {
          const m = CHARACTERS[f.char].moves[f.move!.id];
          const fa = m ? firstActive(m) : Infinity;
          if (Number.isFinite(fa) && f.move!.frame < fa) return { text: `${m.name} · hits in ${fa - f.move!.frame + f.hitlag}`, tone: 'warn' };
          return { text: `${m?.name ?? 'Busy'} · ${busy(i)}`, tone: 'warn' };
        }
        default:
          return null;
      }
    }) as typeof this.tagText;
  }

  private positionTags() {
    if (!settings.frameData) {
      this.ui.hud.setTags([null, null]);
      return;
    }
    const s = this.disp.b;
    this.ui.hud.setTags(
      this.tagText.map((t, i) => {
        if (!t) return null;
        const [x, y] = this.ui.arena.headScreen(i, s);
        return { x, y, text: t.text, tone: t.tone };
      }),
    );
  }
}

export const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
