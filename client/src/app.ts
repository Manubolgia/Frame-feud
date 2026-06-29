/** Game orchestrator: screen flow + the turn loop (plan → lock → resolve →
 *  cinematic playback → review) for both local hotseat and online lockstep. */

import { Application } from 'pixi.js';
import { planBot } from './ai';
import { sfx, setMuted, isMuted, startMusic, unlockAudio } from './audio/sfx';
import { CHARACTERS } from './content/characters';
import { STAGES } from './content/stages';
import { Renderer, type RenderChar } from './render/renderer';
import {
  aliveCount,
  createMatch,
  hashState,
  matchWinner,
  resolveTurn,
  WINDOW_TICKS,
  type ActionQueue,
  type GameState,
  type ResolveResult,
  type SimCtx,
} from './sim';
import { PLAYER_COLORS } from './theme';
import { Banner } from './ui/banner';
import { clear, el, overlay } from './ui/dom';
import { Hud } from './ui/hud';
import { PlanningPanel } from './ui/planning';
import {
  defaultLocalConfig,
  helpScreen,
  localSetupScreen,
  lobbyScreen,
  onlineEntryScreen,
  resultsScreen,
  titleScreen,
  type LocalConfig,
} from './ui/screens';
import { NetClient, type NetStatus } from './net/client';
import type { LobbyState, ServerMsg } from './net/protocol';

type Mode = 'frozen' | 'resolving' | 'idle';

interface Playback {
  res: ResolveResult;
  charIds: (string | null)[];
  t: number;
  speed: number;
  firedTick: number;
  slowmo: number;
  onDone: () => void;
}

export class Game {
  app: Application;
  renderer: Renderer;
  hud = new Hud();
  banner = new Banner();
  panel: PlanningPanel;

  private overlayEl = overlay();
  private gameUiEl: HTMLElement;

  private state!: GameState;
  private ctx!: SimCtx;
  private localHumans: number[] = [];
  private difficulty = 0.7;
  private koCounts: number[] = [];
  private mode: Mode = 'idle';
  private playback?: Playback;
  private frozenHighlight: number | null = null;

  // online
  private net?: NetClient;
  private myId?: string;
  private myIndex = -1;
  private order: string[] = [];
  private lobby?: LobbyState;
  private pendingTurnBegin: number | null = null;
  private wsUrl: string;
  private localConfig: LocalConfig = defaultLocalConfig();

  private hitstopFrames = 0;

  constructor(app: Application) {
    this.app = app;
    this.renderer = new Renderer(app);
    this.wsUrl = (import.meta as any).env?.VITE_WS_URL || '';

    // HUD + banner + game-ui DOM live above canvas
    this.gameUiEl = el('div', { cls: 'game-ui hidden' });
    this.panel = new PlanningPanel(this.renderer, STAGES.skyforge, () => {});
    this.gameUiEl.append(this.hud.root, this.banner.root, this.panel.root);
    document.body.appendChild(this.gameUiEl);

    app.ticker.add(() => this.frame(app.ticker.deltaMS));
    window.addEventListener('resize', () => this.onResize());
    this.showTitle();
  }

  private onResize() {
    this.renderer.resize();
    if (this.state && this.mode === 'frozen') this.snapCam();
  }

  private snapCam() {
    // Bias the action upward so the bottom planning panel doesn't cover it.
    this.renderer.cam.biasY = 0.2;
    this.renderer.cam.snapTo(this.renderer.stageBounds(), 1.5, 3.5);
  }

  // ---------------- screen flow ----------------

  private setScreen(node: HTMLElement | null) {
    clear(this.overlayEl);
    if (node) {
      this.overlayEl.classList.remove('hidden');
      this.overlayEl.appendChild(node);
    } else {
      this.overlayEl.classList.add('hidden');
    }
  }

  showTitle() {
    this.teardownMatch();
    this.gameUiEl.classList.add('hidden');
    this.setScreen(
      titleScreen({
        onLocal: () => this.showLocalSetup(),
        onOnline: () => this.showOnlineEntry(),
        onPractice: () => this.startPractice(),
        onHelp: () => this.setScreen(helpScreen(() => this.showTitle())),
        onToggleMute: () => {
          setMuted(!isMuted());
        },
        muted: isMuted(),
      }),
    );
  }

  private showLocalSetup() {
    this.setScreen(
      localSetupScreen(this.localConfig, {
        onStart: (cfg) => {
          this.localConfig = cfg;
          this.startLocal(cfg);
        },
        onBack: () => this.showTitle(),
      }),
    );
  }

  private startPractice() {
    const cfg: LocalConfig = {
      slots: [
        { role: 'human', name: 'You', dynasty: ['razor', 'titan', 'arc'] },
        { role: 'cpu', name: 'Dummy', dynasty: ['titan', 'titan', 'titan'] },
        { role: 'off', name: '', dynasty: [] },
        { role: 'off', name: '', dynasty: [] },
      ],
      stageId: 'skyforge',
      difficulty: 0.25,
    };
    this.startLocal(cfg);
  }

  // ---------------- local match ----------------

  private startLocal(cfg: LocalConfig) {
    const active = cfg.slots.filter((s) => s.role !== 'off');
    const stage = STAGES[cfg.stageId];
    this.difficulty = cfg.difficulty;
    this.ctx = { chars: CHARACTERS, stage };
    this.state = createMatch(
      {
        stage,
        seed: (Math.random() * 0xffffffff) >>> 0,
        players: active.map((s, i) => ({
          playerId: `p${i}`,
          name: s.name || `P${i + 1}`,
          color: PLAYER_COLORS[i],
          dynasty: s.dynasty,
          isLocal: s.role === 'human',
          isBot: s.role === 'cpu',
        })),
      },
      CHARACTERS,
    );
    this.localHumans = active.map((s, i) => (s.role === 'human' ? i : -1)).filter((i) => i >= 0);
    this.myIndex = -1;
    this.net = undefined;
    this.koCounts = this.state.players.map(() => 0);
    this.enterMatch();
    this.runLocalTurn();
  }

  private enterMatch() {
    this.panel = new PlanningPanel(this.renderer, this.ctx.stage, () => {});
    // re-mount panel root (constructor created new)
    const old = this.gameUiEl.querySelector('.plan-panel');
    if (old) old.remove();
    this.gameUiEl.appendChild(this.panel.root);
    this.renderer.setStage(this.ctx.stage);
    this.renderer.clearJuice();
    this.snapCam();
    this.hud.mount(this.state, this.myIndex >= 0 ? this.myIndex : null);
    this.gameUiEl.classList.remove('hidden');
    this.setScreen(null);
    startMusic();
  }

  private teardownMatch() {
    this.mode = 'idle';
    this.playback = undefined;
    this.banner.clear();
    this.renderer.clearPrediction();
    this.renderer.clearAim();
  }

  private async runLocalTurn() {
    if (this.checkMatchOver()) return;
    const queues: ActionQueue[] = [];
    const multiHuman = this.localHumans.length > 1;

    for (let i = 0; i < this.state.players.length; i++) {
      const p = this.state.players[i];
      if (p.eliminated || !this.state.characters[i]) continue;
      if (this.localHumans.includes(i)) {
        if (multiHuman) await this.banner.passDevice(p.name, p.color);
        this.frozenHighlight = i;
        this.mode = 'frozen';
        this.snapCam();
        const q = await this.planHuman(i);
        queues.push(q);
      } else {
        queues.push(planBot(this.state, i, this.difficulty));
      }
    }

    this.frozenHighlight = null;
    this.banner.clear();
    await this.banner.countdown();
    const res = resolveTurn(this.state, queues, this.ctx);
    this.playResolution(res, () => {
      this.state = res.endState;
      this.afterResolve();
      this.runLocalTurn();
    });
  }

  private planHuman(idx: number): Promise<ActionQueue> {
    return new Promise((resolve) => {
      (this.panel as any).onLock = (q: ActionQueue) => resolve(q);
      this.panel.begin(this.state, idx);
    });
  }

  // ---------------- resolution playback ----------------

  private playResolution(res: ResolveResult, onDone: () => void) {
    this.mode = 'resolving';
    this.banner.clear();
    this.playback = {
      res,
      charIds: this.state.characters.map((c) => (c ? c.charId : null)),
      t: 0,
      speed: 52,
      firedTick: -1,
      slowmo: 0,
      onDone,
    };
  }

  private frame(dtMs: number) {
    const dt = Math.min(dtMs / 1000, 0.05);
    this.renderer.update(dt);

    if (this.mode === 'frozen') {
      this.renderer.drawChars(this.buildFrozenChars());
    } else if (this.mode === 'resolving' && this.playback) {
      this.advancePlayback(dt);
    }
  }

  private advancePlayback(dt: number) {
    const pb = this.playback!;
    let frozen = false;
    if (this.hitstopFrames > 0) {
      this.hitstopFrames -= dt * 60;
      frozen = true;
    }
    if (pb.slowmo > 0) pb.slowmo -= dt;
    const speed = pb.slowmo > 0 ? pb.speed * 0.32 : pb.speed;
    if (!frozen) pb.t += dt * speed;

    const maxT = pb.res.frames.length - 1;
    if (pb.t > maxT) pb.t = maxT;

    // fire events for crossed ticks
    const cur = Math.floor(pb.t);
    while (pb.firedTick < cur) {
      pb.firedTick++;
      this.fireTickEvents(pb, pb.firedTick);
    }

    const chars = this.buildPlaybackChars(pb);
    this.renderer.cam.biasY = 0.06;
    this.renderer.frameChars(chars, 2.2, 2.0);
    this.renderer.drawChars(chars);

    if (pb.t >= maxT && this.hitstopFrames <= 0 && pb.slowmo <= 0) {
      // brief hold then finish
      pb.t = maxT + 0.0001;
      if (pb.firedTick >= pb.res.frames.length - 1) {
        const done = pb.onDone;
        this.playback = undefined;
        this.mode = 'idle';
        done();
      }
    }
  }

  private fireTickEvents(pb: Playback, tick: number) {
    for (const h of pb.res.hits) {
      if (h.tick !== tick) continue;
      const wx = h.pos.x / 1000;
      const wy = h.pos.y / 1000;
      if (h.shielded) {
        this.renderer.juice.burst(wx, wy, 0xbfeaff, 0.25);
        sfx.shieldHit();
        this.hitstopFrames = Math.max(this.hitstopFrames, 3);
        continue;
      }
      const power = Math.min(1, h.knockback / 900);
      this.renderer.juice.burst(wx, wy, this.state.players[h.attacker]?.color ?? 0xffffff, 0.3 + power);
      this.renderer.juice.shockwave(wx, wy, 0xffffff, 0.6 + power);
      this.renderer.cam.addShake(0.08 + power * 0.25);
      this.hitstopFrames = Math.max(this.hitstopFrames, 3 + power * 9);
      sfx.hit(power);
    }
    for (const k of pb.res.kos) {
      if (k.tick !== tick) continue;
      const wx = k.pos.x / 1000;
      const wy = k.pos.y / 1000;
      const col = this.state.players[k.victim]?.color ?? 0xffffff;
      this.renderer.juice.koFlash(wx, wy, col);
      this.renderer.cam.addShake(0.6);
      this.hitstopFrames = Math.max(this.hitstopFrames, 14);
      pb.slowmo = Math.max(pb.slowmo, 0.9);
      sfx.ko();
      const name = this.state.players[k.victim]?.name ?? '';
      this.banner.koPop(name, col);
      if (k.victim !== undefined) this.koCounts[this.attackerCredit(pb, tick, k.victim)]++;
    }
  }

  private attackerCredit(pb: Playback, tick: number, victim: number): number {
    // credit the most recent attacker on this victim
    for (let t = tick; t >= 0; t--) {
      const h = pb.res.hits.find((x) => x.tick === t && x.victim === victim && !x.shielded);
      if (h) return h.attacker;
    }
    return victim;
  }

  private buildPlaybackChars(pb: Playback): (RenderChar | null)[] {
    const i = Math.min(Math.floor(pb.t), pb.res.frames.length - 1);
    const j = Math.min(i + 1, pb.res.frames.length - 1);
    const frac = pb.t - i;
    const fa = pb.res.frames[i];
    const fb = pb.res.frames[j];
    return fa.chars.map((a, k) => {
      if (!a) return null;
      const b = fb.chars[k] ?? a;
      const charId = pb.charIds[k];
      if (!charId) return null;
      const def = CHARACTERS[charId];
      const pos = { x: Math.round(a.pos.x + (b.pos.x - a.pos.x) * frac), y: Math.round(a.pos.y + (b.pos.y - a.pos.y) * frac) };
      let moveActive = false;
      let moveDef: { kind: string; aimable?: boolean } | null = null;
      let movePhase: 'startup' | 'active' | 'recovery' | undefined;
      let moveTotalT: number | undefined;
      if (a.moveId) {
        const m = def.moves[a.moveId];
        if (m) {
          moveDef = { kind: m.kind, aimable: m.aimable };
          const e = a.moveElapsed ?? 0;
          const total = m.startup + m.active + m.recovery;
          moveActive = e >= m.startup && e < m.startup + m.active;
          movePhase = e < m.startup ? 'startup' : e < m.startup + m.active ? 'active' : 'recovery';
          moveTotalT = total > 0 ? Math.min(1, e / total) : 0;
        }
      }
      // motion trail juice for fast chars
      const sp = Math.abs(a.vel.x) + Math.abs(a.vel.y);
      if (sp > 700 && Math.random() < 0.5) {
        this.renderer.juice.trail(pos.x / 1000, (pos.y - def.radius) / 1000, this.state.players[k].color);
      }
      return {
        pos,
        vx: a.vel.x,
        vy: a.vel.y,
        facing: a.facing,
        damagePercent: a.damagePercent,
        shielding: a.shielding,
        grounded: a.grounded,
        hitstun: a.hitstun,
        invuln: a.invuln,
        aimAngle: a.aimAngle,
        alive: true,
        charDef: def,
        playerColor: this.state.players[k].color,
        playerIndex: k,
        moveDef,
        moveActive,
        movePhase,
        moveTotalT,
      };
    });
  }

  private buildFrozenChars(): (RenderChar | null)[] {
    return this.state.characters.map((c, k) => {
      if (!c) return null;
      const def = CHARACTERS[c.charId];
      const dim = this.frozenHighlight != null && this.frozenHighlight !== k;
      return {
        pos: c.pos,
        vx: 0,
        vy: 0,
        facing: c.facing,
        damagePercent: c.damagePercent,
        shielding: false,
        grounded: c.grounded,
        hitstun: 0,
        invuln: dim ? 0 : c.invuln,
        aimAngle: c.facing === 1 ? 0 : 180,
        alive: true,
        charDef: def,
        playerColor: dim ? mixGray(this.state.players[k].color) : this.state.players[k].color,
        playerIndex: k,
        moveDef: null,
        moveActive: false,
        movePhase: undefined,
        moveTotalT: undefined,
      };
    });
  }

  private afterResolve() {
    this.hud.update(this.state, this.myIndex >= 0 ? this.myIndex : null);
  }

  private checkMatchOver(): boolean {
    const w = matchWinner(this.state);
    if (w === null) return false;
    this.showResults(w);
    return true;
  }

  private showResults(winnerIdx: number) {
    this.mode = 'idle';
    this.gameUiEl.classList.add('hidden');
    sfx.win();
    const standings = this.state.players
      .map((p, i) => ({ name: p.name, color: p.color, kos: this.koCounts[i] ?? 0, idx: i }))
      .sort((a, b) => (a.idx === winnerIdx ? -1 : b.idx === winnerIdx ? 1 : b.kos - a.kos));
    const winner =
      winnerIdx >= 0
        ? { name: this.state.players[winnerIdx].name, color: this.state.players[winnerIdx].color }
        : { name: 'DRAW', color: 0xffffff };
    this.setScreen(
      resultsScreen(winner.name, winner.color, standings, {
        onRematch: () => {
          if (this.net) this.showTitle();
          else this.startLocal(this.localConfig);
        },
        onMenu: () => this.showTitle(),
      }),
    );
    if (this.net) {
      this.net.close();
      this.net = undefined;
    }
  }

  // ---------------- online ----------------

  private showOnlineEntry() {
    if (!this.wsUrl) {
      this.setScreen(
        el('div', {
          cls: 'screen help-screen',
          children: [
            el('h2', { text: 'ONLINE NOT CONFIGURED' }),
            el('p', { cls: 'note', html: 'This build has no <code>VITE_WS_URL</code> set, so online play is disabled. Deploy the Cloudflare Worker and rebuild with the WSS URL (see README). Local Match works fully offline.' }),
            el('button', { cls: 'menu-btn primary', text: 'BACK', on: { click: () => this.showTitle() } }),
          ],
        }),
      );
      return;
    }
    this.setScreen(
      onlineEntryScreen({
        defaultName: 'Player',
        onBack: () => this.showTitle(),
        onCreate: (name) => this.connectOnline(name, makeRoomCode()),
        onJoin: (name, room) => {
          if (room.length >= 3) this.connectOnline(name, room);
        },
      }),
    );
  }

  private connectOnline(name: string, room: string) {
    this.banner.status('connecting…');
    this.net = new NetClient(
      this.wsUrl,
      (msg) => this.onNet(msg),
      (s) => this.onNetStatus(s),
    );
    this.net.connect();
    this.net.join(room, name);
    this.myIndex = -1;
    this.localHumans = [];
  }

  private onNetStatus(s: NetStatus) {
    if (s === 'reconnecting') this.banner.status('reconnecting…');
    if (s === 'error') this.banner.status('connection error');
  }

  private onNet(msg: ServerMsg) {
    switch (msg.t) {
      case 'joined':
        this.myId = msg.playerId;
        this.lobby = msg.lobby;
        this.renderLobby();
        break;
      case 'lobby_state':
        this.lobby = msg.lobby;
        if (!msg.lobby.started) this.renderLobby();
        break;
      case 'error':
        this.banner.flash(msg.message, 0xff5577, 1400);
        break;
      case 'match_start':
        this.startOnlineMatch(msg);
        break;
      case 'turn_begin':
        // Buffer if we're still playing out the previous resolution.
        if (this.mode === 'resolving') this.pendingTurnBegin = msg.turn;
        else this.onlinePlan(msg.turn);
        break;
      case 'resolve':
        this.onlineResolve(msg.turn, msg.queues);
        break;
      case 'desync_detected':
        this.banner.flash('resync…', 0xffaa33, 800);
        break;
      case 'state_sync':
        this.state = msg.state;
        this.afterResolve();
        break;
      case 'player_left':
        break;
    }
  }

  private renderLobby() {
    if (!this.lobby || !this.myId) return;
    this.gameUiEl.classList.add('hidden');
    this.setScreen(
      lobbyScreen(this.lobby, this.myId, {
        onDynasty: (d) => this.net?.send({ t: 'pick_dynasty', dynasty: d }),
        onStage: (s) => this.net?.send({ t: 'pick_stage', stageId: s }),
        onReady: (r) => this.net?.send({ t: 'ready_lobby', ready: r }),
        onStart: () => this.net?.send({ t: 'start_match' }),
        onLeave: () => {
          this.net?.close();
          this.net = undefined;
          this.showTitle();
        },
      }),
    );
  }

  private startOnlineMatch(msg: {
    seed: number;
    stageId: string;
    roster: { playerId: string; name: string; slot: number; dynasty: string[] }[];
    order: string[];
  }) {
    const stage = STAGES[msg.stageId] ?? STAGES.skyforge;
    this.ctx = { chars: CHARACTERS, stage };
    this.order = msg.order;
    const byId = new Map(msg.roster.map((r) => [r.playerId, r]));
    // Build the identical deterministic GameState every client constructs.
    this.state = createMatch(
      {
        stage,
        seed: msg.seed,
        players: msg.order.map((id) => {
          const r = byId.get(id)!;
          return {
            playerId: id,
            name: r.name,
            color: PLAYER_COLORS[r.slot % PLAYER_COLORS.length],
            dynasty: r.dynasty,
            isLocal: id === this.myId,
          };
        }),
      },
      CHARACTERS,
    );
    this.myIndex = msg.order.indexOf(this.myId!);
    this.localHumans = [this.myIndex];
    this.koCounts = this.state.players.map(() => 0);
    this.enterMatch();
    this.banner.flash('FIGHT!', this.state.players[this.myIndex]?.color ?? 0xffffff, 800);
  }

  private async onlinePlan(turn: number) {
    if (this.checkMatchOver()) return;
    const me = this.state.players[this.myIndex];
    if (!me || me.eliminated || !this.state.characters[this.myIndex]) {
      // spectating / dead this turn — submit idle
      this.net?.send({
        t: 'plan_submit',
        turn,
        queue: { playerId: this.myId!, characterId: me?.dynasty[me.activeIndex] ?? 'titan', actions: [] },
      });
      this.banner.status('KO — watching…');
      this.frozenHighlight = null;
      this.mode = 'frozen';
      return;
    }
    this.frozenHighlight = this.myIndex;
    this.mode = 'frozen';
    this.snapCam();
    const q = await this.planHuman(this.myIndex);
    this.banner.status('waiting for opponents…');
    this.net?.send({ t: 'plan_submit', turn, queue: q });
  }

  private onlineResolve(turn: number, queues: ActionQueue[]) {
    this.banner.clear();
    const res = resolveTurn(this.state, queues, this.ctx);
    // report hash for consensus
    this.net?.send({ t: 'state_hash', turn, hash: hashState(res.endState) });
    this.playResolution(res, () => {
      this.state = res.endState;
      this.afterResolve();
      if (this.checkMatchOver()) return;
      this.banner.status('');
      // process any turn_begin that arrived during playback
      if (this.pendingTurnBegin != null) {
        const t = this.pendingTurnBegin;
        this.pendingTurnBegin = null;
        this.onlinePlan(t);
      }
    });
  }
}

function mixGray(c: number): number {
  const r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
  const lum = (r + g + b) / 3;
  return ((Math.round((r + lum) / 2) << 16) | (Math.round((g + lum) / 2) << 8) | Math.round((b + lum) / 2)) & 0x808080;
}

function makeRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

void aliveCount;
void WINDOW_TICKS;
