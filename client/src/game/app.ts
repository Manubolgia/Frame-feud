/**
 * The application shell: screens, the per-frame ticker, layout of the arena
 * band around the HUD and action panel, and wiring every game mode.
 */

import type { Application } from 'pixi.js';
import { sfx, startMusic, unlockAudio } from '../audio/audio';
import { CHARACTERS, ROSTER, STAGE_LIST } from '../content/roster';
import { ejectToLibrary, helloLibrary, inLibrary } from '../library';
import { Arena } from '../render/arena';
import type { MatchLog } from '../sim/resolve';
import type { GameState, MatchConfig } from '../sim/types';
import { Banner } from '../ui/banner';
import { el } from '../ui/dom';
import { Hud } from '../ui/hud';
import { icon } from '../ui/icons';
import { ActionPanel } from '../ui/panel';
import { guideScreen } from '../ui/screens/guide';
import { LobbyScreen, onlineEntry } from '../ui/screens/online';
import { confirmBox, moveList, pauseMenu, replayBar, resultsScreen, settingsScreen, trainingBar, type ReplayBar, type TrainingOpts } from '../ui/screens/overlays';
import { selectScreen, type SelectMode, type SelectResult } from '../ui/screens/select';
import { titleScreen } from '../ui/screens/title';
import { clearResume, savedResume } from '../net/client';
import type { Difficulty } from './ai';
import { AttractDriver, LocalDriver, ReplayDriver, type SeatKind } from './drivers';
import { Match, type Mode, type UiBundle } from './match';
import { OnlineDriver, OnlineSession, WS_URL } from './online';
import { loadReplays, saveReplay, saveSettings, settings } from './settings';

export class App {
  private pixi: Application;
  private arena: Arena;
  private hud = new Hud();
  private panel = new ActionPanel();
  private banner = new Banner();
  private ui: UiBundle;
  private gameLayer = el('div', { cls: 'game-layer' });
  private screens = el('div', { cls: 'screens' });
  private modal = el('div', { cls: 'modal-layer' });
  private match: Match | null = null;
  private dispose: (() => void) | null = null;
  private modalDispose: (() => void) | null = null;
  private replayCtl: ReplayBar | null = null;
  private trainingEl: HTMLElement | null = null;
  private lastSetup: { mode: Mode; sel: SelectResult } | null = null;
  private session: OnlineSession | null = null;
  private lobbyScreen: LobbyScreen | null = null;
  private replayState = { playing: true, speed: 1 };
  private where: 'title' | 'menu' | 'match' | 'results' = 'title';

  constructor(pixi: Application) {
    this.pixi = pixi;
    this.arena = new Arena(pixi);
    this.ui = { arena: this.arena, hud: this.hud, panel: this.panel, banner: this.banner, layout: () => this.layoutSoon() };
    this.gameLayer.append(this.hud.root, this.hud.tagLayer, this.banner.root, this.panel.root);
    document.body.append(this.gameLayer, this.screens, this.modal);
    this.panel.onLayout = () => this.layoutSoon();
    this.hud.onPause = () => this.pause();

    pixi.ticker.add((t) => this.frame(Math.min(0.05, t.deltaMS / 1000)));
    window.addEventListener('resize', () => {
      this.arena.resize();
      this.layoutSoon();
    });
    this.bindInput();
    helloLibrary();
    this.showTitle();
  }

  // ------------------------------------------------------------ frame --

  private frame(dt: number) {
    if (this.match) this.match.tick(dt);
    if (this.replayCtl && this.match) {
      this.replayCtl.update(this.match.log.steps.length, this.replayTotal, this.replayState.playing);
    }
  }

  private layoutQueued = false;
  private layoutSoon() {
    if (this.layoutQueued) return;
    this.layoutQueued = true;
    requestAnimationFrame(() => {
      this.layoutQueued = false;
      this.layout();
    });
  }

  private layout() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    let top = 8;
    let bottom = H - 8;
    let right = W;
    const hudR = this.hud.root.classList.contains('hidden') ? null : this.hud.root.getBoundingClientRect();
    if (hudR && hudR.height) top = hudR.bottom + 6;
    const pr = this.panel.root.classList.contains('hidden') ? null : this.panel.root.getBoundingClientRect();
    if (pr && pr.height) {
      const side = pr.left > W * 0.35 && pr.top < H * 0.3;
      if (side) {
        if (pr.height > H * 0.4) right = pr.left - 4;
      } else bottom = pr.top - 4;
    }
    const rb = this.replayCtl?.root.getBoundingClientRect();
    if (rb && rb.height) bottom = Math.min(bottom, rb.top - 4);
    let left = 0;
    if (this.where !== 'match') {
      top = 0;
      bottom = H;
      right = W;
      // Frame the demo fight beside the title menu on wide screens.
      if (this.where === 'title' && W > 760) left = Math.min(W * 0.4, 520);
    }
    this.arena.setBand(left, top, right, bottom);
  }

  // ------------------------------------------------------------ input --

  private bindInput() {
    const unlock = () => {
      unlockAudio();
      startMusic();
    };
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.modal.childElementCount) {
          this.closeModal();
          if (this.match?.paused) this.resume();
          return;
        }
        if (this.where === 'match') this.pause();
        else if (this.where === 'menu') (this.screens.querySelector('.screen-head .icon-btn') as HTMLButtonElement | null)?.click();
      }
      if ((e.key === 'f' || e.key === 'F') && this.match) this.match.fastForwardPlayback(true);
    });
    document.addEventListener('keyup', (e) => {
      if ((e.key === 'f' || e.key === 'F') && this.match) this.match.fastForwardPlayback(false);
    });
    // Hold on the arena to fast-forward an exchange.
    const canvas = this.pixi.canvas;
    canvas.addEventListener('pointerdown', () => this.match?.phase === 'play' && this.match.fastForwardPlayback(true));
    const off = () => this.match?.fastForwardPlayback(false);
    canvas.addEventListener('pointerup', off);
    canvas.addEventListener('pointercancel', off);
    canvas.addEventListener('pointerleave', off);
  }

  // ------------------------------------------------------------ screens --

  private setScreen(node: HTMLElement | null, dispose: (() => void) | null = null) {
    this.dispose?.();
    this.dispose = dispose;
    this.screens.replaceChildren();
    if (node) this.screens.append(node);
    this.screens.classList.toggle('active', !!node);
  }

  private openModal(node: HTMLElement, dispose: (() => void) | null = null) {
    this.closeModal();
    this.modal.append(node);
    this.modalDispose = dispose;
  }

  private closeModal() {
    this.modalDispose?.();
    this.modalDispose = null;
    this.modal.replaceChildren();
  }

  private stopMatch() {
    this.match?.abort();
    this.match = null;
    this.hud.hide();
    this.panel.close();
    this.panel.reset();
    this.banner.clear();
    this.replayCtl?.root.remove();
    this.replayCtl = null;
    this.trainingEl?.remove();
    this.trainingEl = null;
    this.gameLayer.classList.remove('in-match');
  }

  showTitle() {
    this.stopMatch();
    this.leaveOnline();
    this.closeModal();
    this.where = 'title';
    this.startAttract();
    this.layoutSoon();
    const items = [
      { id: 'cpu', label: 'Versus CPU', sub: 'Fight the computer at three skill levels', icon: 'cpu' },
      { id: 'local', label: 'Local versus', sub: 'Two players on one device — picks stay secret', icon: 'users' },
      { id: 'online', label: 'Online', sub: WS_URL ? 'Room codes · play a friend anywhere' : 'Not set up in this build', icon: 'globe', disabled: !WS_URL },
      { id: 'training', label: 'Training', sub: 'Dummy, hitboxes and infinite meter', icon: 'target' },
      { id: 'guide', label: 'How to play', sub: 'Frames, reads and the ghost in seven pages', icon: 'book' },
      { id: 'replays', label: 'Replays', sub: 'Watch your recent matches', icon: 'replay', disabled: loadReplays().length === 0 },
      { id: 'settings', label: 'Settings', sub: 'Sound, speed, comfort, controls', icon: 'gear' },
    ];
    this.setScreen(
      titleScreen(
        items,
        (id) => {
          switch (id) {
            case 'cpu':
            case 'local':
            case 'training':
              if (!settings.seenGuide && id !== 'training') {
                saveSettings({ seenGuide: true });
                this.showGuide(() => this.showSelect(id));
              } else this.showSelect(id);
              break;
            case 'online':
              this.showOnline();
              break;
            case 'guide':
              saveSettings({ seenGuide: true });
              this.showGuide(() => this.showTitle());
              break;
            case 'replays':
              this.showReplays();
              break;
            case 'settings':
              this.showSettings(() => this.showTitle());
              break;
          }
        },
        () => ejectToLibrary(),
      ),
    );
  }

  private startAttract() {
    if (this.match?.mode === 'attract') return;
    this.stopMatch();
    const r = (n: number) => Math.floor(Math.random() * n);
    const cfg: MatchConfig = {
      stageId: STAGE_LIST.filter((s) => s !== 'lab')[r(3)],
      chars: [ROSTER[r(4)], ROSTER[r(4)]],
      palettes: [r(4), r(4)],
      names: ['A', 'B'],
      roundsToWin: 1,
      seed: (Math.random() * 1e9) >>> 0,
    };
    const m = new Match(cfg, 'attract', this.ui, new AttractDriver(), ['', '']);
    m.onEnd = () => {
      if (this.match === m) {
        this.match = null;
        window.setTimeout(() => {
          if (this.where === 'title' || this.where === 'menu') this.startAttract();
        }, 600);
      }
    };
    this.match = m;
    this.layoutSoon();
    void m.start(true);
  }

  private showGuide(back: () => void) {
    this.where = 'menu';
    this.setScreen(guideScreen(back));
  }

  private showSettings(back: () => void) {
    this.where = this.where === 'match' ? 'match' : 'menu';
    this.setScreen(settingsScreen(back));
  }

  private showSelect(mode: SelectMode) {
    this.where = 'menu';
    const s = selectScreen(
      mode,
      (sel) => this.startLocal(mode, sel),
      () => this.showTitle(),
      (char, pal) => this.showMoves(char, pal),
    );
    this.setScreen(s.root, s.dispose);
  }

  private showMoves(char: string, pal: number) {
    const ml = moveList(char, pal, () => this.closeModal());
    this.openModal(ml.root, ml.dispose);
  }

  private showReplays() {
    const list = loadReplays();
    this.where = 'menu';
    const root = el('div', {
      cls: 'screen replays',
      kids: [
        el('header', {
          cls: 'screen-head',
          kids: [el('button', { cls: 'icon-btn', attrs: { type: 'button', 'aria-label': 'Back' }, html: icon('back', 22), on: { click: () => { sfx.back(); this.showTitle(); } } }), el('h2', { text: 'Replays' })],
        }),
        el('div', {
          cls: 'replay-list',
          kids: list.map((r) => {
            const c = r.log.cfg;
            const w = r.winner;
            return el('button', {
              cls: 'replay-item',
              attrs: { type: 'button' },
              html: `<span class="ri-text"><span class="ri-vs"><b>${esc(c.names[0])}</b> <i>${CHARACTERS[c.chars[0]]?.name ?? ''}</i> <span class="ri-x">vs</span> <b>${esc(c.names[1])}</b> <i>${CHARACTERS[c.chars[1]]?.name ?? ''}</i></span>
                <span class="ri-meta">${new Date(r.at).toLocaleString()} · ${r.log.steps.length} turns · ${w === null ? 'unfinished' : w < 0 ? 'draw' : `${esc(c.names[w])} won`}</span></span>
                <span class="ri-play">${icon('play', 14)}<span>Watch</span></span>`,
              on: { click: () => this.startReplay(r.log) },
            });
          }),
        }),
      ],
    });
    this.setScreen(root);
  }

  // ------------------------------------------------------------ local --

  private startLocal(mode: SelectMode, sel: SelectResult) {
    this.setScreen(null);
    this.stopMatch();
    this.where = 'match';
    this.lastSetup = { mode, sel };
    const seats: [SeatKind, SeatKind] = mode === 'cpu' ? ['human', 'cpu'] : mode === 'local' ? ['human', 'human'] : ['human', 'dummy'];
    const driver = new LocalDriver(seats, sel.levels as [Difficulty, Difficulty]);
    const labels: [string, string] = mode === 'cpu' ? ['P1', `CPU · ${['Easy', 'Normal', 'Hard'][sel.levels[1]]}`] : mode === 'local' ? ['P1', 'P2'] : ['P1', 'Dummy'];
    const m = new Match({ ...sel.cfg, seed: (Math.random() * 1e9) >>> 0 }, mode, this.ui, driver, labels);
    this.match = m;
    this.gameLayer.classList.add('in-match');
    if (mode === 'training') this.setupTraining(m, driver);
    m.onEnd = (r) => {
      if (this.match !== m) return;
      if (mode !== 'training') saveReplay({ at: Date.now(), mode, log: r.log, winner: r.winner });
      this.showResults(r.state, r.log, mode);
    };
    void m.start(mode === 'training');
  }

  private setupTraining(m: Match, driver: LocalDriver) {
    const opts: TrainingOpts = { dummy: 'stand', refill: true, meter: true };
    driver.dummy = opts.dummy;
    m.beforeDecide = (st: GameState) => {
      const f = st.fighters[1];
      const p = st.fighters[0];
      if (opts.meter) {
        p.meter = 3000;
        f.meter = 3000;
      }
      if (opts.refill && f.comboHits === 0 && (f.mode === 'idle' || f.mode === 'down')) {
        f.hp = CHARACTERS[f.char].hp;
      }
      if (p.mode === 'idle') p.hp = Math.max(p.hp, Math.round(CHARACTERS[p.char].hp * 0.25));
      return st;
    };
    const bar = trainingBar(opts, {
      change: () => (driver.dummy = opts.dummy),
      reset: () => {
        if (!this.lastSetup) return;
        sfx.select();
        this.startLocal('training', this.lastSetup.sel);
      },
      swap: () => {
        if (!this.lastSetup) return;
        const s = this.lastSetup.sel;
        const cfg = { ...s.cfg, chars: [s.cfg.chars[1], s.cfg.chars[0]] as [string, string], palettes: [s.cfg.palettes[1], s.cfg.palettes[0]] as [number, number] };
        sfx.select();
        this.startLocal('training', { ...s, cfg });
      },
    });
    this.trainingEl = bar;
    this.gameLayer.append(bar);
  }

  private replayTotal = 0;

  private startReplay(log: MatchLog) {
    this.setScreen(null);
    this.stopMatch();
    this.where = 'match';
    const driver = new ReplayDriver(log.steps);
    const m = new Match({ ...log.cfg }, 'replay', this.ui, driver, ['', '']);
    this.match = m;
    this.replayTotal = log.steps.length;
    this.replayState = { playing: true, speed: 1 };
    this.gameLayer.classList.add('in-match');
    const keep = settings.speed;
    const bar = replayBar({
      toggle: () => {
        this.replayState.playing = !this.replayState.playing;
        m.paused = !this.replayState.playing;
        sfx.tap();
      },
      speed: (v) => {
        this.replayState.speed = v;
        settings.speed = v;
      },
      restart: () => {
        settings.speed = keep;
        this.startReplay(log);
      },
      exit: () => {
        settings.speed = keep;
        sfx.back();
        this.showTitle();
      },
    });
    this.replayCtl = bar;
    this.gameLayer.append(bar.root);
    m.onEnd = (r) => {
      settings.speed = keep;
      if (this.match === m) this.showResults(r.state, log, 'replay');
    };
    this.layoutSoon();
    void m.start();
  }

  private showResults(st: GameState, log: MatchLog, mode: Mode | 'replay') {
    this.where = 'results';
    const colors: [number, number] = [this.arena.palette(0)[0], this.arena.palette(1)[0]];
    const cfg = log.cfg;
    const acts =
      mode === 'online'
        ? [
            { id: 'rematch', label: 'Rematch', icon: 'replay', primary: true },
            { id: 'lobby', label: 'Change fighters', icon: 'users' },
            { id: 'watch', label: 'Watch replay', icon: 'play' },
            { id: 'leave', label: 'Leave room', icon: 'exit' },
          ]
        : [
            { id: 'rematch', label: mode === 'replay' ? 'Watch again' : 'Rematch', icon: 'replay', primary: true },
            ...(mode === 'replay' ? [] : [{ id: 'watch', label: 'Watch replay', icon: 'play' }]),
            ...(mode === 'replay' ? [] : [{ id: 'select', label: 'Character select', icon: 'users' }]),
            { id: 'menu', label: 'Main menu', icon: 'exit' },
          ];
    const r = resultsScreen(st, cfg, colors, acts, (id) => {
      switch (id) {
        case 'rematch':
          if (mode === 'online') {
            this.session?.net.send({ t: 'rematch', want: true });
            this.banner.toast('Rematch requested — waiting for your opponent');
            return;
          }
          if (mode === 'replay') return this.startReplay(log);
          if (this.lastSetup) this.startLocal(this.lastSetup.mode as SelectMode, this.lastSetup.sel);
          break;
        case 'watch':
          if (mode === 'online') {
            const keepSession = this.session;
            this.session = null;
            this.startReplay(log);
            this.session = keepSession;
            return;
          }
          this.startReplay(log);
          break;
        case 'select':
          if (this.lastSetup) {
            this.stopMatch();
            this.startAttract();
            this.showSelect(this.lastSetup.mode as SelectMode);
          }
          break;
        case 'lobby':
          this.session?.net.send({ t: 'lobby' });
          break;
        case 'leave':
        case 'menu':
          this.showTitle();
          break;
      }
    });
    this.panel.close();
    this.hud.hide();
    this.setScreen(r.root, r.dispose);
    this.layoutSoon();
  }

  // ------------------------------------------------------------ pause --

  private pause() {
    const m = this.match;
    if (!m || m.mode === 'attract' || this.modal.childElementCount) return;
    if (m.mode !== 'online') m.paused = true;
    sfx.select();
    const me = m.mode === 'online' ? Math.max(0, this.session?.seat ?? 0) : m.planning >= 0 ? m.planning : 0;
    const items = [
      { id: 'resume', label: 'Resume', icon: 'play' },
      { id: 'moves', label: `Move list · ${CHARACTERS[m.cfg.chars[me]].name}`, icon: 'list' },
      ...(m.mode === 'local' || m.mode === 'cpu' ? [{ id: 'moves2', label: `Move list · ${CHARACTERS[m.cfg.chars[1 - me]].name}`, icon: 'list' }] : []),
      { id: 'guide', label: 'How to play', icon: 'book' },
      { id: 'settings', label: 'Settings', icon: 'gear' },
      ...(m.mode === 'cpu' || m.mode === 'local' || m.mode === 'training' ? [{ id: 'restart', label: 'Restart match', icon: 'replay' }] : []),
      { id: 'quit', label: m.mode === 'online' ? 'Leave room' : 'Quit to menu', icon: 'exit' },
    ];
    this.openModal(
      pauseMenu(m.mode === 'online' ? 'Menu (the match keeps going)' : 'Paused', items, (id) => {
        switch (id) {
          case 'resume':
            this.closeModal();
            this.resume();
            break;
          case 'moves':
          case 'moves2': {
            const i = id === 'moves' ? me : 1 - me;
            const ml = moveList(m.cfg.chars[i], m.cfg.palettes[i], () => {
              this.closeModal();
              this.pause();
            });
            this.openModal(ml.root, ml.dispose);
            break;
          }
          case 'guide': {
            const g = guideScreen(() => {
              this.closeModal();
              this.pause();
            });
            this.openModal(el('div', { cls: 'modal-wrap full', kids: [g] }));
            break;
          }
          case 'settings': {
            const s = settingsScreen(() => {
              this.closeModal();
              this.pause();
            });
            this.openModal(el('div', { cls: 'modal-wrap full', kids: [s] }));
            break;
          }
          case 'restart':
            this.closeModal();
            if (this.lastSetup) this.startLocal(this.lastSetup.mode as SelectMode, this.lastSetup.sel);
            break;
          case 'quit':
            this.openModal(
              confirmBox(
                m.mode === 'online' ? 'Leave the room? Your opponent wins by forfeit.' : 'Quit this match?',
                m.mode === 'online' ? 'Leave' : 'Quit',
                () => {
                  this.closeModal();
                  this.showTitle();
                },
                () => {
                  this.closeModal();
                  this.pause();
                },
              ),
            );
            break;
        }
      }),
    );
  }

  private resume() {
    if (this.match && this.match.mode !== 'replay') this.match.paused = false;
    if (this.match?.mode === 'replay') this.match.paused = !this.replayState.playing;
  }

  // ------------------------------------------------------------ online --

  private leaveOnline() {
    this.lobbyScreen?.dispose();
    this.lobbyScreen = null;
    if (this.session) {
      this.session.close();
      this.session = null;
    }
  }

  private showOnline() {
    this.where = 'menu';
    const resume = savedResume();
    const entry = onlineEntry(settings.name || '', !!WS_URL, {
      create: (name) => {
        saveSettings({ name });
        this.connect(makeCode(), name);
      },
      join: (name, code) => {
        saveSettings({ name });
        this.connect(code, name);
      },
      back: () => this.showTitle(),
    });
    if (resume && WS_URL) {
      entry.querySelector('.online-card')?.prepend(
        el('button', {
          cls: 'btn big rejoin',
          attrs: { type: 'button' },
          html: `${icon('replay', 18)}<span>Rejoin room ${esc(resume.code)}</span>`,
          on: { click: () => this.connect(resume.code, settings.name || 'Player') },
        }),
      );
    }
    this.setScreen(entry);
  }

  private connect(code: string, name: string) {
    this.leaveOnline();
    const handlers = {
      pick: (char: string, palette: number) => this.session?.net.send({ t: 'pick', char, palette }),
      ready: (r: boolean) => this.session?.net.send({ t: 'pick', ready: r }),
      host: (p: { stage?: string; rounds?: number; timer?: number }) => this.session?.net.send({ t: 'host', ...p }),
      leave: () => this.showTitle(),
      moves: (c: string, p: number) => this.showMoves(c, p),
    };
    const ls = new LobbyScreen(-1, handlers);
    ls.setStatus(`<span class="spin"></span><span>Connecting…</span>`);
    this.lobbyScreen = ls;
    this.setScreen(ls.root);
    this.where = 'menu';
    const s = new OnlineSession(code, name, {
      lobby: (l) => {
        if (l.phase === 'lobby') {
          if (this.where === 'match' || this.where === 'results') {
            this.stopMatch();
            this.startAttract();
          }
          if (!this.lobbyScreen) {
            this.lobbyScreen = new LobbyScreen(s.seat, handlers);
          }
          this.lobbyScreen.setSeat(s.seat);
          this.lobbyScreen.render(l);
          this.lobbyScreen.setStatus(`<span class="dot-ok"></span><span>Connected</span>`);
          if (!this.screens.contains(this.lobbyScreen.root)) this.setScreen(this.lobbyScreen.root);
          this.where = 'menu';
        } else if (l.phase === 'over' && this.where === 'results') {
          const want = l.rematch;
          const other = 1 - s.seat;
          if (s.seat >= 0 && want[other] && !want[s.seat]) this.banner.toast('Your opponent wants a rematch');
        }
      },
      start: (cfg, _timer, log) => {
        this.startOnlineMatch(s, cfg, log);
      },
      ended: (winner, reason) => {
        if (reason === 'forfeit' && this.match?.mode === 'online') {
          const m = this.match;
          this.banner.toast(winner === s.seat ? 'Your opponent left — you win by forfeit' : 'Match forfeited');
          const st = m.state;
          st.winner = winner;
          m.abort();
          this.showResults(st, m.log, 'online');
        }
      },
      error: (code, message) => {
        if (code === 'version') {
          this.leaveOnline();
          this.setScreen(
            el('div', {
              cls: 'screen online',
              kids: [
                el('div', {
                  cls: 'online-card',
                  kids: [
                    el('h3', { text: 'Update needed' }),
                    el('p', { cls: 'muted', text: message }),
                    el('button', { cls: 'btn primary', attrs: { type: 'button' }, text: 'Reload', on: { click: () => location.reload() } }),
                    el('button', { cls: 'btn', attrs: { type: 'button' }, text: 'Main menu', on: { click: () => this.showTitle() } }),
                  ],
                }),
              ],
            }),
          );
          return;
        }
        if (code === 'full' || code === 'nope') {
          clearResume();
          this.banner.toast(message, 3500);
          this.showOnline();
          return;
        }
        this.banner.toast(message, 3000);
      },
      status: (st) => {
        if (st === 'open') this.banner.setStatus(null);
        else if (st === 'reconnecting') this.banner.setStatus(`<span class="spin"></span><span>Connection lost — reconnecting…</span>`);
        else if (st === 'failed') {
          this.banner.setStatus(null);
          this.banner.toast('Could not reach the room server.', 3500);
          this.showOnline();
        }
        if (this.lobbyScreen && st !== 'open') this.lobbyScreen.setStatus(st === 'failed' ? 'Offline' : `<span class="spin"></span><span>${st === 'connecting' ? 'Connecting…' : 'Reconnecting…'}</span>`);
      },
      presence: (seat, connected) => {
        if (seat === s.seat || !this.match) return;
        if (!connected) this.banner.setStatus(`<span class="spin"></span><span>Opponent disconnected — waiting for them to come back</span>`);
        else {
          this.banner.setStatus(null);
          this.banner.toast('Opponent reconnected');
        }
      },
    });
    this.session = s;
  }

  private startOnlineMatch(s: OnlineSession, cfg: MatchConfig, log: [import('../sim/types').Decision, import('../sim/types').Decision][]) {
    this.lobbyScreen?.dispose();
    this.lobbyScreen = null;
    this.setScreen(null);
    this.stopMatch();
    this.closeModal();
    this.where = 'match';
    const labels: [string, string] = [s.seat === 0 ? 'You' : 'P1', s.seat === 1 ? 'You' : 'P2'];
    const m = new Match(cfg, 'online', this.ui, new OnlineDriver(s), labels);
    this.match = m;
    this.gameLayer.classList.add('in-match');
    m.onEnd = (r) => {
      if (this.match !== m) return;
      saveReplay({ at: Date.now(), mode: 'online', log: r.log, winner: r.winner });
      this.showResults(r.state, r.log, 'online');
    };
    if (log.length) {
      m.mountHud();
      m.fastForward(log);
      void m.start(true);
    } else void m.start();
  }
}

function makeCode(): string {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export { inLibrary };
