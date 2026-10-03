/**
 * Online play: a room session over the NetClient, and the Driver that feeds
 * networked decisions into a Match.
 */

import { needsInput } from '../sim/rules';
import type { Decision, MatchConfig } from '../sim/types';
import { NetClient, type NetStatus } from '../net/client';
import type { Lobby, ServerMsg } from '../net/protocol';
import { icon } from '../ui/icons';
import { escapeHtml } from '../ui/banner';
import { askHuman } from './drivers';
import type { Driver, Match } from './match';
import { SIM_VERSION } from './version';

export interface SessionHooks {
  lobby(l: Lobby): void;
  start(cfg: MatchConfig, timer: number, log: [Decision, Decision][]): void;
  ended(winner: number, reason: string): void;
  error(code: string, message: string): void;
  status(s: NetStatus): void;
  presence(seat: number, connected: boolean): void;
}

export const WS_URL: string = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_WS_URL ?? '';

export class OnlineSession {
  net: NetClient;
  lobby: Lobby | null = null;
  seat = -1;
  private waiters = new Map<number, (ds: [Decision, Decision]) => void>();
  private resolved = new Map<number, [Decision, Decision]>();
  locked: [boolean, boolean] = [false, false];
  lockStep = -1;
  onLocked: () => void = () => {};
  timer = 0;

  constructor(
    code: string,
    name: string,
    private hooks: SessionHooks,
  ) {
    this.net = new NetClient(
      WS_URL,
      code,
      () => ({ t: 'hello', v: SIM_VERSION, name, resume: this.net?.id && this.net.token ? { id: this.net.id, token: this.net.token } : undefined }),
      (m) => this.onMsg(m),
      (s) => hooks.status(s),
    );
    this.net.connect();
  }

  get code(): string {
    return this.net.code;
  }

  private onMsg(m: ServerMsg) {
    switch (m.t) {
      case 'welcome':
        this.seat = m.seat;
        this.lobby = m.lobby;
        this.hooks.lobby(m.lobby);
        break;
      case 'lobby':
        this.lobby = m.lobby;
        this.hooks.lobby(m.lobby);
        break;
      case 'start':
        this.resolved.clear();
        this.timer = m.timer;
        this.locked = m.locked;
        this.lockStep = m.log.length;
        this.hooks.start(m.cfg, m.timer, m.log);
        break;
      case 'locked':
        this.locked = m.seats;
        this.lockStep = m.step;
        this.onLocked();
        break;
      case 'resolve': {
        this.resolved.set(m.step, m.ds);
        this.locked = [false, false];
        this.lockStep = m.step + 1;
        const w = this.waiters.get(m.step);
        if (w) {
          this.waiters.delete(m.step);
          w(m.ds);
        }
        break;
      }
      case 'presence':
        this.hooks.presence(m.seat, m.connected);
        break;
      case 'ended':
        this.hooks.ended(m.winner, m.reason);
        break;
      case 'desync':
        this.hooks.error('desync', 'The two games disagreed about what happened. The match cannot continue.');
        break;
      case 'error':
        this.hooks.error(m.code, m.message);
        break;
    }
  }

  waitResolve(step: number): Promise<[Decision, Decision]> {
    const have = this.resolved.get(step);
    if (have) return Promise.resolve(have);
    return new Promise((resolve) => this.waiters.set(step, resolve));
  }

  decide(step: number, d: Decision) {
    this.net.send({ t: 'decide', step, d });
  }

  undecide(step: number) {
    this.net.send({ t: 'undecide', step });
  }

  close() {
    this.net.close();
    this.waiters.clear();
  }
}

export class OnlineDriver implements Driver {
  constructor(private s: OnlineSession) {}

  async decide(m: Match): Promise<[Decision, Decision]> {
    const step = m.log.steps.length;
    const seat = this.s.seat;
    const banner = m.ui.banner;
    const other = 1 - seat;
    if (seat >= 0) {
      const need = needsInput(m.state, seat, m.ctx);
      const alreadyLocked = this.s.lockStep === step && this.s.locked[seat];
      if (alreadyLocked) {
        // We locked in before reconnecting; the server keeps that choice.
        banner.setStatus(`<span class="spin"></span><span>Locked in · waiting for ${escapeHtml(m.cfg.names[other])}</span>`);
      } else if (need === 'none') {
        this.s.decide(step, { move: '' });
      } else {
        // Re-open the panel if the player wants to change their mind
        // before the opponent locks in.
        for (;;) {
          const d = await askHuman(m, seat, this.s.timer || null);
          if (!m.running) throw new Error('aborted');
          this.s.decide(step, d);
          const changed = await new Promise<boolean>((resolve) => {
            const render = () => {
              const theyLocked = this.s.lockStep === step && this.s.locked[other];
              banner.setStatus(
                `<span class="spin"></span><span>Locked in · ${theyLocked ? 'resolving…' : `waiting for ${escapeHtml(m.cfg.names[other])}`}</span>` +
                  (theyLocked ? '' : `<button class="chip-btn" data-change>${icon('back', 14)}<span>Change</span></button>`),
              );
              const btn = banner.root.querySelector('[data-change]');
              btn?.addEventListener('click', () => {
                this.s.onLocked = () => {};
                banner.setStatus(null);
                this.s.undecide(step);
                resolve(true);
              });
            };
            this.s.onLocked = render;
            render();
            void this.s.waitResolve(step).then(() => {
              this.s.onLocked = () => {};
              resolve(false);
            });
          });
          if (!changed) break;
        }
      }
    } else {
      banner.setStatus(`<span>${icon('eye', 14)} Spectating</span>`);
    }
    const ds = await this.s.waitResolve(step);
    banner.setStatus(seat < 0 ? `<span>${icon('eye', 14)} Spectating</span>` : null);
    return ds;
  }

  resolved(m: Match, hash: string) {
    this.s.net.send({ t: 'hash', step: m.log.steps.length - 1, h: hash });
  }

  ended(m: Match) {
    this.s.net.send({ t: 'over', winner: m.state.winner ?? -1 });
  }
}
