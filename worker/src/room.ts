/// <reference types="@cloudflare/workers-types" />
/**
 * Room Durable Object: the authority for one room code.
 *
 *  - lobby: two seats (plus any number of spectators), fighter picks, rules
 *  - match: collects one decision per seat for the current step, then
 *    broadcasts both; keeps the full decision log so a reconnecting player
 *    or a late spectator can rebuild the exact match locally
 *  - deadlines (turn timer) and forfeits (disconnects) run on alarms
 *
 * It never simulates. Every client runs the same deterministic sim; the
 * clients compare state hashes and the room flags any disagreement.
 * Uses the WebSocket Hibernation API, so idle rooms cost nothing.
 */

import type { ClientMsg, Decision, Lobby, MatchConfig, ServerMsg } from './protocol';
import { ROSTER, STAGES, TIMERS } from './protocol';

interface Seat {
  id: string;
  token: string;
  name: string;
  char: string;
  /** Family lineup, lead first (Family Feud). */
  team: string[];
  palette: number;
  ready: boolean;
  connected: boolean;
  /** When a disconnected player forfeits (ms epoch), 0 = never. */
  forfeitAt: number;
}

interface RoomState {
  code: string;
  version: string;
  stage: string;
  rounds: number;
  timer: number;
  format: 'feud' | 'duel';
  seats: [Seat | null, Seat | null];
  host: number;
  phase: 'lobby' | 'match' | 'over';
  cfg: MatchConfig | null;
  step: number;
  pending: [Decision | null, Decision | null];
  deadline: number;
  rematch: [boolean, boolean];
  hashes: [number, string | null, string | null][];
}

interface Attachment {
  id: string;
  seat: number;
}

/** Grace period before a disconnected player forfeits a running match. */
const FORFEIT_MS = 90_000;
/** Extra time on top of the turn timer, covering playback of the last turn. */
const MAX_FAMILY = 3;
const DEADLINE_SLACK_MS = 20_000;
const MAX_MSG = 4096;

export class Room {
  private ctx: DurableObjectState;
  private s!: RoomState;

  constructor(ctx: DurableObjectState, _env: unknown) {
    this.ctx = ctx;
    this.ctx.blockConcurrencyWhile(async () => {
      this.s = (await this.ctx.storage.get<RoomState>('s')) ?? fresh();
    });
  }

  private async save() {
    await this.ctx.storage.put('s', this.s);
  }

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const code = (new URL(req.url).searchParams.get('code') || '').toUpperCase();
    if (!this.s.code) {
      this.s.code = code;
      await this.save();
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  // ------------------------------------------------------------ socket events --

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
    if (text.length > MAX_MSG) return;
    let msg: ClientMsg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object' || typeof (msg as { t?: unknown }).t !== 'string') return;
    try {
      await this.handle(ws, msg);
    } catch (e) {
      this.send(ws, { t: 'error', code: 'server', message: 'Something went wrong on the server.' });
    }
  }

  async webSocketClose(ws: WebSocket) {
    await this.dropped(ws);
  }

  async webSocketError(ws: WebSocket) {
    await this.dropped(ws);
  }

  private async dropped(ws: WebSocket) {
    const a = this.att(ws);
    if (!a || a.seat < 0) {
      this.broadcastLobby();
      return;
    }
    const seat = this.s.seats[a.seat];
    if (!seat || seat.id !== a.id) return;
    // Another socket of the same player still open (reconnected first)?
    if (this.sockets().some((w) => w !== ws && this.att(w)?.id === a.id)) return;
    seat.connected = false;
    if (this.s.phase === 'match') seat.forfeitAt = Date.now() + FORFEIT_MS;
    if (this.s.phase !== 'match') seat.ready = false;
    await this.save();
    await this.schedule();
    this.broadcast({ t: 'presence', seat: a.seat, connected: false });
    this.broadcastLobby();
    if (this.s.phase === 'lobby' && this.sockets().filter((w) => w !== ws).length === 0) {
      // Nobody left in the lobby: forget the room.
      await this.ctx.storage.deleteAll();
      this.s = fresh();
    }
  }

  async alarm() {
    const now = Date.now();
    if (this.s.phase === 'match') {
      for (let i = 0; i < 2; i++) {
        const seat = this.s.seats[i];
        if (seat && !seat.connected && seat.forfeitAt && now >= seat.forfeitAt) {
          await this.forfeit(i);
          return;
        }
      }
      if (this.s.deadline && now >= this.s.deadline) {
        this.s.pending = [this.s.pending[0] ?? { move: '' }, this.s.pending[1] ?? { move: '' }];
        await this.resolveStep();
        return;
      }
    }
    await this.schedule();
  }

  /** Arm the alarm for the earliest pending deadline or forfeit. */
  private async schedule() {
    const times: number[] = [];
    if (this.s.phase === 'match') {
      if (this.s.deadline) times.push(this.s.deadline);
      for (const seat of this.s.seats) if (seat && !seat.connected && seat.forfeitAt) times.push(seat.forfeitAt);
    }
    if (times.length) await this.ctx.storage.setAlarm(Math.min(...times));
    else await this.ctx.storage.deleteAlarm();
  }

  // ------------------------------------------------------------ messages --

  private async handle(ws: WebSocket, m: ClientMsg) {
    if (m.t === 'ping') {
      this.send(ws, { t: 'pong', at: Number(m.at) || 0 });
      return;
    }
    if (m.t === 'hello') return this.hello(ws, m);
    const a = this.att(ws);
    if (!a) return;
    const seatIdx = a.seat;
    const seat = seatIdx >= 0 ? this.s.seats[seatIdx] : null;
    if (seatIdx >= 0 && (!seat || seat.id !== a.id)) return;
    switch (m.t) {
      case 'pick':
        if (!seat || this.s.phase !== 'lobby') return;
        if (typeof m.char === 'string' && ROSTER.includes(m.char)) {
          seat.char = m.char;
          if (seat.team?.length) seat.team[0] = m.char;
          else seat.team = [m.char];
        }
        if (Array.isArray(m.team) && m.team.length >= 1 && m.team.length <= MAX_FAMILY && m.team.every((c) => typeof c === 'string' && ROSTER.includes(c))) {
          seat.team = m.team.slice();
          seat.char = seat.team[0];
        }
        if (Number.isInteger(m.palette) && m.palette! >= 0 && m.palette! < 6) seat.palette = m.palette!;
        if (typeof m.ready === 'boolean') seat.ready = m.ready;
        await this.save();
        this.broadcastLobby();
        if (this.s.seats[0]?.ready && this.s.seats[1]?.ready && this.s.seats[0].connected && this.s.seats[1].connected) await this.startMatch();
        return;
      case 'host':
        if (seatIdx !== this.s.host || this.s.phase !== 'lobby') return;
        if (typeof m.stage === 'string' && STAGES.includes(m.stage)) this.s.stage = m.stage;
        if (Number.isInteger(m.rounds) && m.rounds! >= 1 && m.rounds! <= 3) this.s.rounds = m.rounds!;
        if (Number.isInteger(m.timer) && TIMERS.includes(m.timer!)) this.s.timer = m.timer!;
        if (m.format === 'feud' || m.format === 'duel') this.s.format = m.format;
        await this.save();
        this.broadcastLobby();
        return;
      case 'decide':
        if (!seat || this.s.phase !== 'match' || m.step !== this.s.step || this.s.pending[seatIdx]) return;
        this.s.pending[seatIdx] = cleanDecision(m.d);
        await this.save();
        this.broadcastLocked();
        if (this.s.pending[0] && this.s.pending[1]) await this.resolveStep();
        return;
      case 'undecide':
        if (!seat || this.s.phase !== 'match' || m.step !== this.s.step) return;
        if (this.s.pending[0] && this.s.pending[1]) return;
        this.s.pending[seatIdx] = null;
        await this.save();
        this.broadcastLocked();
        return;
      case 'hash':
        return this.onHash(seatIdx, m.step, m.h);
      case 'over':
        if (this.s.phase !== 'match') return;
        this.s.phase = 'over';
        this.s.deadline = 0;
        this.s.rematch = [false, false];
        for (const st of this.s.seats) if (st) st.forfeitAt = 0;
        await this.save();
        await this.schedule();
        this.broadcastLobby();
        return;
      case 'rematch':
        if (!seat || this.s.phase !== 'over') return;
        this.s.rematch[seatIdx] = !!m.want;
        await this.save();
        this.broadcastLobby();
        if (this.s.rematch[0] && this.s.rematch[1]) await this.startMatch();
        return;
      case 'lobby':
        if (!seat || this.s.phase === 'lobby') return;
        if (this.s.phase === 'match') return;
        this.s.phase = 'lobby';
        for (const st of this.s.seats) if (st) st.ready = false;
        await this.save();
        this.broadcastLobby();
        return;
      case 'leave':
        await this.leave(ws, seatIdx);
        return;
    }
  }

  private async hello(ws: WebSocket, m: Extract<ClientMsg, { t: 'hello' }>) {
    const v = String(m.v || '').slice(0, 64);
    if (this.s.version && v !== this.s.version) {
      this.send(ws, { t: 'error', code: 'version', message: 'This room is running a different version of Frame Feud. Reload the page to update, then try again.' });
      ws.close(4000, 'version');
      return;
    }
    if (!this.s.version) this.s.version = v;
    const name = cleanName(m.name);
    // Resume a seat?
    if (m.resume && typeof m.resume.id === 'string') {
      const i = this.s.seats.findIndex((st) => st && st.id === m.resume!.id && st.token === m.resume!.token);
      if (i >= 0) {
        const seat = this.s.seats[i]!;
        // Close any stale socket for this seat.
        for (const w of this.sockets()) if (w !== ws && this.att(w)?.id === seat.id) w.close(4001, 'replaced');
        seat.connected = true;
        seat.forfeitAt = 0;
        ws.serializeAttachment({ id: seat.id, seat: i } satisfies Attachment);
        await this.save();
        await this.schedule();
        this.send(ws, { t: 'welcome', id: seat.id, token: seat.token, seat: i, lobby: this.lobby() });
        if (this.s.phase !== 'lobby' && this.s.cfg) await this.sendStart(ws);
        this.broadcast({ t: 'presence', seat: i, connected: true });
        this.broadcastLobby();
        return;
      }
    }
    // A free seat in the lobby?
    const free = this.s.phase === 'lobby' ? this.s.seats.findIndex((st) => st === null || (!st.connected && !st.ready)) : -1;
    if (free >= 0) {
      const old = this.s.seats[free];
      const seat: Seat = {
        id: crypto.randomUUID(),
        token: crypto.randomUUID(),
        name,
        char: free === 0 ? 'razor' : 'titan',
        team: free === 0 ? ['razor', 'arc', 'titan'] : ['titan', 'grip', 'razor'],
        palette: free === 0 ? 0 : 1,
        ready: false,
        connected: true,
        forfeitAt: 0,
      };
      if (old && !old.connected) {
        for (const w of this.sockets()) if (this.att(w)?.id === old.id) w.close(4001, 'replaced');
      }
      this.s.seats[free] = seat;
      if (!this.s.seats[this.s.host] || !this.s.seats[this.s.host]!.connected) this.s.host = free;
      ws.serializeAttachment({ id: seat.id, seat: free } satisfies Attachment);
      await this.save();
      this.send(ws, { t: 'welcome', id: seat.id, token: seat.token, seat: free, lobby: this.lobby() });
      this.broadcastLobby();
      return;
    }
    // Spectator.
    const id = crypto.randomUUID();
    ws.serializeAttachment({ id, seat: -1 } satisfies Attachment);
    this.send(ws, { t: 'welcome', id, token: '', seat: -1, lobby: this.lobby() });
    if (this.s.phase !== 'lobby' && this.s.cfg) await this.sendStart(ws);
    this.broadcastLobby();
  }

  private async leave(ws: WebSocket, seatIdx: number) {
    if (seatIdx >= 0) {
      if (this.s.phase === 'match') {
        await this.forfeit(seatIdx);
      }
      if (this.s.phase !== 'match') {
        this.s.seats[seatIdx] = null;
        if (this.s.host === seatIdx) this.s.host = 1 - seatIdx;
        for (const st of this.s.seats) if (st) st.ready = false;
        if (this.s.phase === 'over') this.s.phase = 'lobby';
      }
      await this.save();
    }
    ws.serializeAttachment({ id: '', seat: -2 });
    try {
      ws.close(1000, 'left');
    } catch {
      /* already closed */
    }
    this.broadcastLobby();
  }

  private async forfeit(loser: number) {
    if (this.s.phase !== 'match') return;
    this.s.phase = 'over';
    this.s.deadline = 0;
    this.s.rematch = [false, false];
    for (const st of this.s.seats) if (st) st.forfeitAt = 0;
    await this.save();
    await this.schedule();
    this.broadcast({ t: 'ended', winner: 1 - loser, reason: 'forfeit' });
    this.broadcastLobby();
  }

  // ------------------------------------------------------------ match --

  private async startMatch() {
    const [a, b] = this.s.seats;
    if (!a || !b) return;
    const feud = this.s.format === 'feud';
    const ta = a.team?.length ? a.team : [a.char];
    const tb = b.team?.length ? b.team : [b.char];
    this.s.cfg = {
      stageId: this.s.stage,
      chars: feud ? [ta[0], tb[0]] : [a.char, b.char],
      palettes: [feud ? a.palette : a.palette % 4, feud ? b.palette : b.palette % 4],
      names: [a.name, b.name],
      roundsToWin: this.s.rounds,
      seed: (crypto.getRandomValues(new Uint32Array(1))[0] >>> 0),
    };
    if (feud) this.s.cfg.teams = [ta.slice(), tb.slice()];
    // Clear the previous log.
    const keys = await this.ctx.storage.list({ prefix: 'log:' });
    if (keys.size) await this.ctx.storage.delete([...keys.keys()]);
    this.s.phase = 'match';
    this.s.step = 0;
    this.s.pending = [null, null];
    this.s.rematch = [false, false];
    this.s.hashes = [];
    for (const st of this.s.seats) if (st) {
      st.ready = false;
      st.forfeitAt = 0;
    }
    this.s.deadline = this.s.timer ? Date.now() + this.s.timer * 1000 + DEADLINE_SLACK_MS : 0;
    await this.save();
    await this.schedule();
    this.broadcast({ t: 'start', cfg: this.s.cfg, timer: this.s.timer, log: [], locked: [false, false] });
    this.broadcastLobby();
  }

  private async resolveStep() {
    const ds: [Decision, Decision] = [this.s.pending[0] ?? { move: '' }, this.s.pending[1] ?? { move: '' }];
    const step = this.s.step;
    await this.ctx.storage.put(`log:${String(step).padStart(6, '0')}`, ds);
    this.s.step++;
    this.s.pending = [null, null];
    this.s.deadline = this.s.timer ? Date.now() + this.s.timer * 1000 + DEADLINE_SLACK_MS : 0;
    await this.save();
    await this.schedule();
    this.broadcast({ t: 'resolve', step, ds });
  }

  private async onHash(seatIdx: number, step: number, h: string) {
    if (seatIdx < 0 || !Number.isInteger(step) || typeof h !== 'string') return;
    let row = this.s.hashes.find((r) => r[0] === step);
    if (!row) {
      row = [step, null, null];
      this.s.hashes.push(row);
      if (this.s.hashes.length > 8) this.s.hashes.shift();
    }
    row[seatIdx + 1] = h.slice(0, 40);
    if (row[1] && row[2] && row[1] !== row[2]) this.broadcast({ t: 'desync', step });
    await this.save();
  }

  private async sendStart(ws: WebSocket) {
    const entries = await this.ctx.storage.list<[Decision, Decision]>({ prefix: 'log:' });
    const log = [...entries.values()];
    this.send(ws, {
      t: 'start',
      cfg: this.s.cfg!,
      timer: this.s.timer,
      log,
      locked: [!!this.s.pending[0], !!this.s.pending[1]],
    });
  }

  // ------------------------------------------------------------ helpers --

  private sockets(): WebSocket[] {
    return this.ctx.getWebSockets();
  }

  private att(ws: WebSocket): Attachment | null {
    const a = ws.deserializeAttachment() as Attachment | null;
    return a && a.seat >= -1 ? a : null;
  }

  private lobby(): Lobby {
    const spectators = this.sockets().filter((w) => this.att(w)?.seat === -1).length;
    return {
      code: this.s.code,
      stage: this.s.stage,
      rounds: this.s.rounds,
      timer: this.s.timer,
      format: this.s.format ?? 'feud',
      seats: this.s.seats.map((st) => (st ? { name: st.name, char: st.char, team: st.team ?? [st.char], palette: st.palette, ready: st.ready, connected: st.connected } : null)) as Lobby['seats'],
      host: this.s.host,
      spectators,
      phase: this.s.phase,
      rematch: this.s.rematch,
    };
  }

  private send(ws: WebSocket, m: ServerMsg) {
    try {
      ws.send(JSON.stringify(m));
    } catch {
      /* socket gone */
    }
  }

  private broadcast(m: ServerMsg) {
    const s = JSON.stringify(m);
    for (const w of this.sockets()) {
      if (!this.att(w)) continue;
      try {
        w.send(s);
      } catch {
        /* ignore */
      }
    }
  }

  private broadcastLobby() {
    this.broadcast({ t: 'lobby', lobby: this.lobby() });
  }

  private broadcastLocked() {
    this.broadcast({ t: 'locked', step: this.s.step, seats: [!!this.s.pending[0], !!this.s.pending[1]] });
  }
}

function fresh(): RoomState {
  return {
    code: '',
    version: '',
    stage: 'dojo',
    rounds: 2,
    timer: 60,
    format: 'feud',
    seats: [null, null],
    host: 0,
    phase: 'lobby',
    cfg: null,
    step: 0,
    pending: [null, null],
    deadline: 0,
    rematch: [false, false],
    hashes: [],
  };
}

function cleanName(n: unknown): string {
  const s = String(n ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 12);
  return s || 'Player';
}

const int = (v: unknown, lo: number, hi: number): number | undefined => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : undefined;
};

/** Shape-check a decision. Game legality is enforced by every client's sim. */
function cleanDecision(d: unknown): Decision {
  const o = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
  const out: Decision = { move: typeof o.move === 'string' ? o.move.slice(0, 32) : '' };
  if (Array.isArray(o.dir) && o.dir.length === 2) {
    const x = int(o.dir[0], -100, 100);
    const y = int(o.dir[1], -100, 100);
    if (x !== undefined && y !== undefined) out.dir = [x, y];
  }
  const amt = int(o.amt, 0, 999);
  if (amt !== undefined) out.amt = amt;
  if (o.feint === true) out.feint = true;
  if (Array.isArray(o.di) && o.di.length === 2) {
    const x = int(o.di[0], -100, 100);
    const y = int(o.di[1], -100, 100);
    if (x !== undefined && y !== undefined) out.di = [x, y];
  }
  return out;
}
