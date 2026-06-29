/** Thin WebSocket client for the Cloudflare room. Lockstep on inputs:
 *  we only ship planned queues + hashes; the sim runs locally. */

import type { ClientMsg, ServerMsg } from './protocol';

export type NetHandler = (msg: ServerMsg) => void;

export class NetClient {
  private ws?: WebSocket;
  private url: string;
  private handler: NetHandler;
  private onStatus: (s: NetStatus) => void;
  private heartbeat?: number;
  playerId?: string;
  token?: string;
  room?: string;
  closedByUser = false;

  private base: string;

  constructor(url: string, handler: NetHandler, onStatus: (s: NetStatus) => void) {
    this.base = url;
    this.url = url;
    this.handler = handler;
    this.onStatus = onStatus;
  }

  /** Point the socket at a specific room (the Durable Object is keyed by code). */
  connectToRoom(room: string) {
    const sep = this.base.includes('?') ? '&' : '?';
    this.url = `${this.base}${sep}code=${encodeURIComponent(room)}`;
    this.room = room;
    this.connect();
  }

  connect() {
    this.closedByUser = false;
    this.onStatus('connecting');
    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      this.onStatus('error');
      return;
    }
    this.ws.onopen = () => {
      this.onStatus('open');
      this.heartbeat = window.setInterval(() => this.send({ t: 'ping' }), 20000);
    };
    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as ServerMsg;
        if (msg.t === 'joined') {
          this.playerId = msg.playerId;
          this.token = msg.token;
        }
        this.handler(msg);
      } catch {
        /* ignore malformed */
      }
    };
    this.ws.onclose = () => {
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.onStatus(this.closedByUser ? 'closed' : 'reconnecting');
      if (!this.closedByUser) {
        setTimeout(() => this.reconnect(), 1500);
      }
    };
    this.ws.onerror = () => this.onStatus('error');
  }

  private reconnect() {
    if (this.closedByUser) return;
    this.connect();
    const wait = () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        if (this.room && this.playerId && this.token) {
          this.send({ t: 'reconnect', room: this.room, playerId: this.playerId, token: this.token });
        }
      } else {
        setTimeout(wait, 200);
      }
    };
    wait();
  }

  send(msg: ClientMsg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  join(room: string, name: string) {
    this.room = room;
    const go = () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) this.send({ t: 'join', room, name });
      else setTimeout(go, 150);
    };
    go();
  }

  close() {
    this.closedByUser = true;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.ws?.close();
  }
}

export type NetStatus = 'connecting' | 'open' | 'reconnecting' | 'closed' | 'error';
