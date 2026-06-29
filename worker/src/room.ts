/// <reference types="@cloudflare/workers-types" />
/**
 * Room Durable Object — the authoritative match coordinator.
 *
 * Responsibilities (Mode A authority):
 *  - hold the lobby, turn number, shared seed
 *  - collect each player's locked plan; on all-locked (or deadline) broadcast
 *    a single `resolve` bundle that every client simulates identically
 *  - collect end-of-turn state hashes and flag desyncs (majority wins)
 *  - never simulate — it only relays inputs, so CPU stays tiny
 *
 * Uses the WebSocket Hibernation API so idle rooms cost almost nothing.
 */

import type {
  ActionQueue,
  ClientMsg,
  LobbyPlayer,
  LobbyState,
  ServerMsg,
} from './protocol';
import { ROSTER, STAGES } from './protocol';

interface PlayerRec extends LobbyPlayer {
  token: string;
}

interface Persisted {
  room: string;
  stageId: string;
  players: PlayerRec[];
  started: boolean;
  turn: number;
  phase: 'lobby' | 'planning' | 'resolving';
  seed: number;
  order: string[];
}

const PLAN_DEADLINE_MS = 90_000;
const HASH_DEADLINE_MS = 8_000;

export class Room {
  private ctx: DurableObjectState;
  private env: unknown;
  private s!: Persisted;
  private pendingQueues: Record<string, ActionQueue> = {};
  private hashes: Record<string, string> = {};
  private loaded = false;

  constructor(ctx: DurableObjectState, env: unknown) {
    this.ctx = ctx;
    this.env = env;
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<Persisted>('s');
      this.s = stored ?? {
        room: '',
        stageId: 'skyforge',
        players: [],
        started: false,
        turn: 0,
        phase: 'lobby',
        seed: (Math.random() * 0xffffffff) >>> 0,
        order: [],
      };
      this.loaded = true;
    });
  }

  private async save() {
    await this.ctx.storage.put('s', this.s);
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }
    const code = (url.searchParams.get('code') || '').toUpperCase();
    if (this.s.room === '') {
      this.s.room = code || 'ROOM';
      await this.save();
    }
    const pair = new WebSocketPair();
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  // ---------- hibernation handlers ----------

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
    } catch {
      return;
    }
    try {
      await this.handle(ws, msg);
    } catch (e) {
      this.sendTo(ws, { t: 'error', message: 'server error' });
    }
  }

  async webSocketClose(ws: WebSocket) {
    const pid = this.pidOf(ws);
    if (!pid) return;
    const p = this.s.players.find((x) => x.playerId === pid);
    if (p) p.connected = false;
    await this.save();
    this.broadcastLobby();
    this.broadcast({ t: 'player_left', playerId: pid });
    // if everyone gone, reset
    if (this.s.players.every((x) => !x.connected)) {
      await this.ctx.storage.deleteAll();
    } else if (this.s.phase === 'planning') {
      this.maybeResolve();
    }
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }

  async alarm() {
    // deadline fired
    if (this.s.phase === 'planning') {
      this.doResolve(true);
    } else if (this.s.phase === 'resolving') {
      this.finishTurn(true);
    }
  }

  // ---------- message handling ----------

  private async handle(ws: WebSocket, msg: ClientMsg) {
    switch (msg.t) {
      case 'ping':
        this.sendTo(ws, { t: 'pong' });
        return;
      case 'join':
        return this.onJoin(ws, msg.name);
      case 'reconnect':
        return this.onReconnect(ws, msg.playerId, msg.token);
      case 'pick_dynasty':
        return this.onPick(ws, msg.dynasty);
      case 'pick_stage':
        return this.onStage(ws, msg.stageId);
      case 'ready_lobby':
        return this.onReady(ws, msg.ready);
      case 'start_match':
        return this.onStart(ws);
      case 'plan_submit':
        return this.onPlan(ws, msg.turn, msg.queue);
      case 'state_hash':
        return this.onHash(ws, msg.turn, msg.hash);
      case 'unready_plan':
        delete this.pendingQueues[this.pidOf(ws) || ''];
        this.broadcastPlanStatus();
        return;
    }
  }

  private async onJoin(ws: WebSocket, name: string) {
    if (this.s.started) {
      this.sendTo(ws, { t: 'error', message: 'match already in progress' });
      return;
    }
    if (this.s.players.length >= 4) {
      this.sendTo(ws, { t: 'error', message: 'room full (4 max)' });
      return;
    }
    const slot = this.nextSlot();
    const playerId = crypto.randomUUID();
    const token = crypto.randomUUID();
    const rec: PlayerRec = {
      playerId,
      name: (name || `Player ${slot + 1}`).slice(0, 12),
      slot,
      dynasty: defaultDynasty(slot),
      ready: false,
      connected: true,
      isHost: this.s.players.length === 0,
      token,
    };
    this.s.players.push(rec);
    ws.serializeAttachment({ playerId });
    await this.save();
    this.sendTo(ws, { t: 'joined', playerId, token, slot, lobby: this.lobby() });
    this.broadcastLobby();
  }

  private async onReconnect(ws: WebSocket, playerId: string, token: string) {
    const p = this.s.players.find((x) => x.playerId === playerId && x.token === token);
    if (!p) {
      this.sendTo(ws, { t: 'error', message: 'reconnect failed' });
      return;
    }
    p.connected = true;
    ws.serializeAttachment({ playerId });
    await this.save();
    this.sendTo(ws, { t: 'joined', playerId, token, slot: p.slot, lobby: this.lobby() });
    this.broadcastLobby();
  }

  private async onPick(ws: WebSocket, dynasty: string[]) {
    const p = this.me(ws);
    if (!p || this.s.started) return;
    const clean = dynasty.filter((d) => ROSTER.includes(d)).slice(0, 3);
    if (clean.length === 3) p.dynasty = clean;
    await this.save();
    this.broadcastLobby();
  }

  private async onStage(ws: WebSocket, stageId: string) {
    const p = this.me(ws);
    if (!p || !p.isHost || this.s.started) return;
    if (STAGES.includes(stageId)) this.s.stageId = stageId;
    await this.save();
    this.broadcastLobby();
  }

  private async onReady(ws: WebSocket, ready: boolean) {
    const p = this.me(ws);
    if (!p || this.s.started) return;
    p.ready = ready;
    await this.save();
    this.broadcastLobby();
  }

  private async onStart(ws: WebSocket) {
    const p = this.me(ws);
    if (!p || !p.isHost || this.s.started) return;
    const connected = this.s.players.filter((x) => x.connected);
    if (connected.length < 2) {
      this.sendTo(ws, { t: 'error', message: 'need at least 2 players' });
      return;
    }
    this.s.started = true;
    this.s.seed = (Math.random() * 0xffffffff) >>> 0;
    this.s.order = connected.sort((a, b) => a.slot - b.slot).map((x) => x.playerId);
    this.s.turn = 0;
    this.s.phase = 'planning';
    await this.save();
    this.broadcast({
      t: 'match_start',
      seed: this.s.seed,
      stageId: this.s.stageId,
      roster: this.s.players.map((x) => ({
        playerId: x.playerId,
        name: x.name,
        slot: x.slot,
        dynasty: x.dynasty,
      })),
      order: this.s.order,
    });
    this.beginTurn();
  }

  private beginTurn() {
    this.pendingQueues = {};
    this.hashes = {};
    this.s.phase = 'planning';
    void this.save();
    this.broadcast({ t: 'turn_begin', turn: this.s.turn, deadline: Date.now() + PLAN_DEADLINE_MS });
    this.ctx.storage.setAlarm(Date.now() + PLAN_DEADLINE_MS);
  }

  private async onPlan(ws: WebSocket, turn: number, queue: ActionQueue) {
    const p = this.me(ws);
    if (!p || this.s.phase !== 'planning' || turn !== this.s.turn) return;
    this.pendingQueues[p.playerId] = queue;
    this.broadcastPlanStatus();
    this.maybeResolve();
  }

  private maybeResolve() {
    const expect = this.s.order.filter((id) => {
      const p = this.s.players.find((x) => x.playerId === id);
      return p && p.connected;
    });
    if (expect.length > 0 && expect.every((id) => this.pendingQueues[id])) {
      this.doResolve(false);
    }
  }

  private doResolve(_fromDeadline: boolean) {
    if (this.s.phase !== 'planning') return;
    const queues: ActionQueue[] = this.s.order.map(
      (id) =>
        this.pendingQueues[id] ?? { playerId: id, characterId: '', actions: [] },
    );
    this.s.phase = 'resolving';
    this.hashes = {};
    void this.save();
    this.broadcast({ t: 'resolve', turn: this.s.turn, seed: this.s.seed, queues });
    this.ctx.storage.setAlarm(Date.now() + HASH_DEADLINE_MS);
  }

  private onHash(ws: WebSocket, turn: number, hash: string) {
    const p = this.me(ws);
    if (!p || this.s.phase !== 'resolving' || turn !== this.s.turn) return;
    this.hashes[p.playerId] = hash;
    const connected = this.s.order.filter((id) => {
      const pp = this.s.players.find((x) => x.playerId === id);
      return pp && pp.connected;
    });
    if (connected.every((id) => this.hashes[id])) this.finishTurn(false);
  }

  private finishTurn(_fromDeadline: boolean) {
    if (this.s.phase !== 'resolving') return;
    // consensus: majority hash wins; flag minorities
    const counts: Record<string, number> = {};
    for (const id in this.hashes) counts[this.hashes[id]] = (counts[this.hashes[id]] || 0) + 1;
    let best = '';
    let bestN = -1;
    for (const h in counts) if (counts[h] > bestN) { best = h; bestN = counts[h]; }
    for (const id in this.hashes) {
      if (this.hashes[id] !== best) {
        const wsList = this.wsFor(id);
        for (const w of wsList) this.sendTo(w, { t: 'desync_detected', turn: this.s.turn });
      }
    }
    this.s.turn++;
    this.beginTurn();
  }

  // ---------- helpers ----------

  private nextSlot(): number {
    const used = new Set(this.s.players.map((p) => p.slot));
    for (let i = 0; i < 4; i++) if (!used.has(i)) return i;
    return this.s.players.length;
  }

  private pidOf(ws: WebSocket): string | null {
    const a = ws.deserializeAttachment() as { playerId?: string } | null;
    return a?.playerId ?? null;
  }

  private me(ws: WebSocket): PlayerRec | undefined {
    const pid = this.pidOf(ws);
    return this.s.players.find((x) => x.playerId === pid);
  }

  private wsFor(playerId: string): WebSocket[] {
    return this.ctx.getWebSockets().filter((w) => this.pidOf(w) === playerId);
  }

  private lobby(): LobbyState {
    return {
      room: this.s.room,
      stageId: this.s.stageId,
      started: this.s.started,
      players: this.s.players.map(({ token, ...rest }) => rest),
    };
  }

  private sendTo(ws: WebSocket, msg: ServerMsg) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* socket gone */
    }
  }

  private broadcast(msg: ServerMsg) {
    const str = JSON.stringify(msg);
    for (const w of this.ctx.getWebSockets()) {
      try {
        w.send(str);
      } catch {
        /* ignore */
      }
    }
  }

  private broadcastLobby() {
    this.broadcast({ t: 'lobby_state', lobby: this.lobby() });
  }

  private broadcastPlanStatus() {
    this.broadcast({
      t: 'plan_status',
      turn: this.s.turn,
      readyPlayers: Object.keys(this.pendingQueues),
    });
  }
}

function defaultDynasty(slot: number): string[] {
  const presets = [
    ['titan', 'razor', 'arc'],
    ['razor', 'grip', 'titan'],
    ['arc', 'titan', 'grip'],
    ['grip', 'arc', 'razor'],
  ];
  return presets[slot % presets.length].slice();
}
