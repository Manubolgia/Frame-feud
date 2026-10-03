/**
 * WebSocket client for a room. Reconnects with backoff and resumes the same
 * seat using the token the server issued, so a dropped phone connection
 * picks the match back up where it was.
 */

import type { ClientMsg, ServerMsg } from './protocol';

export type NetStatus = 'connecting' | 'open' | 'reconnecting' | 'closed' | 'failed';

const RESUME_KEY = 'framefeud.resume';

export interface Resume {
  code: string;
  id: string;
  token: string;
}

export function savedResume(): Resume | null {
  try {
    return JSON.parse(sessionStorage.getItem(RESUME_KEY) || 'null');
  } catch {
    return null;
  }
}

export function clearResume() {
  try {
    sessionStorage.removeItem(RESUME_KEY);
  } catch {
    /* ignore */
  }
}

export class NetClient {
  private ws: WebSocket | null = null;
  private url: string;
  private attempts = 0;
  private closedByUser = false;
  private ping = 0;
  private queue: ClientMsg[] = [];
  id: string | null = null;
  token: string | null = null;
  rtt = 0;
  status: NetStatus = 'connecting';

  constructor(
    base: string,
    public code: string,
    private hello: () => ClientMsg,
    private onMsg: (m: ServerMsg) => void,
    private onStatus: (s: NetStatus) => void,
  ) {
    const sep = base.includes('?') ? '&' : '?';
    this.url = `${base}${sep}code=${encodeURIComponent(code)}`;
    const r = savedResume();
    if (r && r.code === code) {
      this.id = r.id;
      this.token = r.token;
    }
  }

  connect() {
    this.closedByUser = false;
    this.setStatus(this.attempts ? 'reconnecting' : 'connecting');
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.retry();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.attempts = 0;
      this.setStatus('open');
      this.raw(this.hello());
      for (const m of this.queue.splice(0)) this.raw(m);
      window.clearInterval(this.ping);
      this.ping = window.setInterval(() => this.raw({ t: 'ping', at: performance.now() }), 15000);
    };
    ws.onmessage = (ev) => {
      let m: ServerMsg;
      try {
        m = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (m.t === 'welcome') {
        this.id = m.id;
        this.token = m.token;
        try {
          sessionStorage.setItem(RESUME_KEY, JSON.stringify({ code: this.code, id: m.id, token: m.token }));
        } catch {
          /* ignore */
        }
      }
      if (m.t === 'pong') this.rtt = performance.now() - m.at;
      this.onMsg(m);
    };
    ws.onclose = () => {
      window.clearInterval(this.ping);
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.closedByUser) this.setStatus('closed');
      else this.retry();
    };
    ws.onerror = () => {
      /* onclose follows */
    };
  }

  private retry() {
    if (this.closedByUser) return;
    this.attempts++;
    if (this.attempts > 12) {
      this.setStatus('failed');
      return;
    }
    this.setStatus('reconnecting');
    const wait = Math.min(8000, 400 * 2 ** Math.min(this.attempts, 5)) + Math.random() * 300;
    window.setTimeout(() => this.connect(), wait);
  }

  private setStatus(s: NetStatus) {
    this.status = s;
    this.onStatus(s);
  }

  private raw(m: ClientMsg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  /** Send now, or as soon as the socket is back. */
  send(m: ClientMsg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.raw(m);
    else if (m.t !== 'ping') this.queue.push(m);
  }

  close() {
    this.closedByUser = true;
    window.clearInterval(this.ping);
    try {
      this.raw({ t: 'leave' });
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
    clearResume();
  }
}
