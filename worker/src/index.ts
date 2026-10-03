/// <reference types="@cloudflare/workers-types" />
/**
 * Frame Feud room server. Routes each WebSocket to the Durable Object for its
 * room code (idFromName(code)), so everyone sharing a code meets in the same
 * authoritative room.
 */

import { Room } from './room';

export { Room };

export interface Env {
  ROOMS: DurableObjectNamespace;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, service: 'frame-feud', protocol: 2, ts: Date.now() }), {
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // wss://<worker>/room?code=ABCDE
    if (url.pathname === '/room') {
      if (req.headers.get('Upgrade') !== 'websocket') {
        return new Response('expected a websocket upgrade', { status: 426, headers: CORS });
      }
      const code = (url.searchParams.get('code') || '').toUpperCase().trim();
      if (!/^[A-Z0-9]{4,6}$/.test(code)) return new Response('invalid room code', { status: 400, headers: CORS });
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      return stub.fetch(req);
    }

    return new Response('not found', { status: 404, headers: CORS });
  },
};
