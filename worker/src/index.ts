/// <reference types="@cloudflare/workers-types" />
/**
 * Frame Feud coordinator Worker. Routes a WSS connection to the right room
 * Durable Object via the room code (`idFromName(code)`), so friends sharing a
 * code land in the same authoritative room. Everything else lives in the DO.
 */

import { Room } from './room';

export { Room };

export interface Env {
  ROOMS: DurableObjectNamespace;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(
        JSON.stringify({ ok: true, service: 'frame-feud', ts: Date.now() }),
        { headers: { 'Content-Type': 'application/json', ...CORS } },
      );
    }

    // WebSocket room endpoint: wss://<worker>/room?code=ABCD
    if (url.pathname === '/room') {
      if (req.headers.get('Upgrade') !== 'websocket') {
        return new Response('expected websocket upgrade', { status: 426, headers: CORS });
      }
      const code = (url.searchParams.get('code') || '').toUpperCase().trim();
      if (!code || code.length < 3 || code.length > 8) {
        return new Response('invalid room code', { status: 400, headers: CORS });
      }
      const id = env.ROOMS.idFromName(code);
      const stub = env.ROOMS.get(id);
      return stub.fetch(req);
    }

    return new Response('not found', { status: 404, headers: CORS });
  },
};
