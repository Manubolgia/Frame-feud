/** Where decisions come from: local humans and CPUs, training dummies,
 *  replays, and the title-screen demo. (Online lives in online.ts.) */

import { cpuDecide, type Difficulty } from './ai';
import { needsInput, sanitize } from '../sim/rules';
import type { Decision } from '../sim/types';
import type { Driver, Match } from './match';
import { settings } from './settings';

export type SeatKind = 'human' | 'cpu' | 'dummy';

export type DummyMode = 'stand' | 'block' | 'jump' | 'parry' | 'cpu';

/** Ask a human through the action panel. */
export function askHuman(m: Match, i: number, timer: number | null = null): Promise<Decision> {
  return new Promise((resolve) => {
    const { panel } = m.ui;
    const st = m.state;
    const need = needsInput(st, i, m.ctx);
    m.planning = i;
    panel.onPreview = (d, policy) => m.preview(i, d, policy);
    panel.onReplayLast = () => m.replayLast();
    panel.onGhostToggle = (on) => (m.ghostOn = on);
    panel.setGhost(m.ghostOn);
    let tm = 0;
    let left = timer ?? 0;
    panel.onLock = (d) => {
      window.clearInterval(tm);
      panel.setTimer(null);
      resolve(d);
    };
    panel.open({
      state: st,
      me: i,
      ctx: m.ctx,
      need,
      name: m.cfg.names[i],
      color: m.ui.arena.palette(i)[0],
      threat: m.threatFor(i),
      canReplay: m.canReplay,
      showFrames: settings.frameData,
      timer,
    });
    if (timer) {
      panel.setTimer(left);
      tm = window.setInterval(() => {
        if (!m.running) return window.clearInterval(tm);
        left -= 0.25;
        panel.setTimer(left);
        if (left <= 0) {
          window.clearInterval(tm);
          panel.lock();
          // Nothing picked: fall back to the default.
          if (panel.open_) {
            panel.close();
            resolve(sanitize(st, i, null, m.ctx));
          }
        }
      }, 250);
    }
  });
}

export class LocalDriver implements Driver {
  /** Who is holding the device in hot-seat play. */
  private holder = 0;
  dummy: DummyMode = 'stand';

  constructor(
    private seats: [SeatKind, SeatKind],
    private levels: [Difficulty, Difficulty],
  ) {}

  async decide(m: Match): Promise<[Decision, Decision]> {
    const st = m.state;
    const ds: [Decision | null, Decision | null] = [null, null];
    const humans: number[] = [];
    for (let i = 0; i < 2; i++) {
      const need = needsInput(st, i, m.ctx);
      if (need === 'none') ds[i] = { move: '' };
      else if (this.seats[i] === 'human') humans.push(i);
    }
    // CPUs think while the human is choosing (after the panel paints).
    const cpu = new Promise<void>((resolve) => {
      window.setTimeout(() => {
        for (let i = 0; i < 2; i++) {
          if (ds[i]) continue;
          if (this.seats[i] === 'cpu') ds[i] = cpuDecide(st, i, m.ctx, this.levels[i]);
          else if (this.seats[i] === 'dummy') ds[i] = this.dummyDecide(m, i);
        }
        resolve();
      }, 30);
    });
    // Hot-seat: the holder goes first; show the hand-off screen whenever the
    // device has to change hands.
    humans.sort((a, b) => (a === this.holder ? -1 : b === this.holder ? 1 : a - b));
    const twoHumans = this.seats[0] === 'human' && this.seats[1] === 'human';
    for (let k = 0; k < humans.length; k++) {
      const i = humans[k];
      if (twoHumans && i !== this.holder) {
        const sub = k > 0 ? `${m.cfg.names[1 - i]} has locked in. Keep your choice secret.` : `Only ${m.cfg.names[i]} can act this turn.`;
        await m.ui.banner.gate(m.cfg.names[i], m.ui.arena.palette(i)[0], sub);
      }
      if (!m.running) throw new Error('aborted');
      this.holder = i;
      ds[i] = await askHuman(m, i);
      if (!m.running) throw new Error('aborted');
    }
    await cpu;
    if (!humans.length && m.mode !== 'attract') await waitFrames(220);
    return [ds[0] ?? { move: '' }, ds[1] ?? { move: '' }];
  }

  private dummyDecide(m: Match, i: number): Decision {
    const st = m.state;
    const need = needsInput(st, i, m.ctx);
    if (need === 'di') return { move: '', di: [0, 0] };
    if (need !== 'act') return { move: '' };
    const f = st.fighters[i];
    if (f.mode === 'down') return { move: 'getup' };
    switch (this.dummy) {
      case 'block':
        return { move: 'block', amt: 30 };
      case 'jump':
        return f.grounded ? { move: 'jump', dir: [0, -100] } : { move: 'wait', amt: 20 };
      case 'parry': {
        const t = m.threatFor(i);
        return t !== null ? { move: 'parry', amt: Math.max(1, t) } : { move: 'wait', amt: 6 };
      }
      case 'cpu':
        return cpuDecide(st, i, m.ctx, 1);
      default:
        return { move: 'wait', amt: 30 };
    }
  }
}

export class ReplayDriver implements Driver {
  constructor(private steps: [Decision, Decision][]) {}
  async decide(m: Match): Promise<[Decision, Decision]> {
    const k = m.log.steps.length;
    if (k >= this.steps.length) throw new Error('end of replay');
    return this.steps[k];
  }
}

export class AttractDriver implements Driver {
  async decide(m: Match): Promise<[Decision, Decision]> {
    await waitFrames(80);
    const lv: Difficulty = 1;
    return [cpuDecide(m.state, 0, m.ctx, lv), cpuDecide(m.state, 1, m.ctx, lv)];
  }
}

function waitFrames(ms: number) {
  return new Promise<void>((r) => window.setTimeout(r, ms));
}
