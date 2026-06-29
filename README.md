# Frame Feud

A **4-player platform fighter with simultaneous, turn-based combat.** Everyone
secretly plans a short sequence of moves, locks in, and then all four plans
resolve at once as a juicy little cinematic. *Super Smash Bros.* physics (damage
%, knockback, ring-outs), *Dynasty Feud* rosters (each player fields a lineup of
distinct characters), and the blind-commitment mind-game of *Your Only Move Is
Hustle*.

It plays like a fighting game crossed with chess: no reflexes, only reads.

```
┌─────────────────────────┐        WSS         ┌────────────────────────────┐
│  GitHub Pages (static)  │ ◀───────────────▶  │  Cloudflare Worker         │
│  PWA client             │   WebSocket        │   + Durable Object (room)  │
│  - PixiJS rendering      │                    │   = authoritative room     │
│  - deterministic sim     │                    │     state + turn clock     │
│  - touch planning UI     │                    │     + input relay          │
└─────────────────────────┘                    └────────────────────────────┘
```

The whole concept lives on the **deterministic simulation**: the network only
ships *inputs* (planned move queues) and a *seed*; every client runs the
identical integer/fixed-point sim to produce the identical result. This is
lockstep on inputs — and because combat is turn-based, **no rollback netcode is
required and latency never affects gameplay feel.**

---

## What's in here

```
frame-feud/
  client/                 # the game (TypeScript + Vite + PixiJS, ships static)
    src/
      sim/                # PURE deterministic engine (integer math, Node-testable)
      content/            # data-driven characters, moves, stages
      render/             # PixiJS arena + animated articulated figures + juice
      ui/                 # touch planning UI, screens, HUD, SVG icon set
      net/                # WebSocket client + protocol
      audio/              # procedural WebAudio SFX + music (no asset files)
      app.ts              # turn-loop orchestration (local + online)
    test/                 # determinism test harness
  worker/                 # Cloudflare Worker + Durable Object (room authority)
  .github/workflows/      # GitHub Pages deploy
```

## Features

- **Deterministic fixed-point sim** with a hash-based determinism test suite.
- **Local pass-and-play** for 1–4 players (humans + CPUs) — works fully offline.
- **Online play** via room codes over a Cloudflare Worker + Durable Object
  (WebSocket Hibernation, input-relay + hash-consensus authority).
- **4 distinct, balanced archetypes** (Heavy / Rushdown / Zoner / Grappler),
  each with a deep ~9-move kit plus shared movement/defence.
- **Dynasties:** each player fields an ordered lineup of 3 characters; a KO
  swaps in the next.
- **Animated, articulated fighters** — posed skeletal figures (in the spirit of
  *Your Only Move Is Hustle*) driven by each move's startup/active/recovery.
- **Juice:** hitstop, screenshake, slow-mo KOs, particles, shockwaves, dynamic
  auto-framing camera, procedural SFX + music.
- **Touch-first planning UI** with a move palette, sequence timeline, aim dial,
  budget pips, and a live prediction ghost.
- **Installable PWA** with an offline practice mode.
- **No emoji / no external art** — all icons are hand-drawn SVG, all characters
  and FX are vector, all audio is synthesized.

---

## Run it locally (no accounts needed)

```bash
cd client
npm install
npm run dev        # open the printed localhost URL
```

Local Match and Practice work immediately and entirely offline. Online play is
greyed out until you point the client at a deployed Worker (below).

Other useful scripts (run inside `client/`):

```bash
npm test           # determinism test suite (identical hashes across runs/devices)
npm run build      # typecheck + production build into client/dist
npm run preview    # serve the production build
```

---

## Deploy

There are two independent pieces. **You can ship the game with just step 1**
(local/offline play). Add step 2 to enable online multiplayer.

### 1) Static client → GitHub Pages

The repo includes `.github/workflows/deploy-pages.yml`, which builds `client/`
and publishes it on every push to `main`.

1. Push this repo to GitHub (you already have `manubolgia/frame-feud`).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. The site deploys to `https://<your-user>.github.io/frame-feud/`.

> The Vite `base` defaults to `/frame-feud/`. If your repo has a different name,
> set the `VITE_BASE` env in the workflow (or a repo variable) to
> `/<repo-name>/` — leading and trailing slash required.

### 2) Online server → Cloudflare Worker

```bash
cd worker
npm install
npx wrangler login          # opens a browser to authorize your Cloudflare account
npx wrangler deploy         # deploys the Worker + Room Durable Object
```

Wrangler prints a URL like `https://frame-feud.<your-subdomain>.workers.dev`.
The game connects to the room endpoint at `/room`, so your WebSocket URL is:

```
wss://frame-feud.<your-subdomain>.workers.dev/room
```

Then tell the client about it and rebuild/redeploy Pages:

- **For the GitHub Pages build:** add a repo variable
  **Settings → Secrets and variables → Actions → Variables → New variable**
  named `VITE_WS_URL` with the `wss://…/room` value, then re-run the deploy
  workflow.
- **For local dev:** create `client/.env.local` with:
  ```
  VITE_WS_URL=wss://frame-feud.<your-subdomain>.workers.dev/room
  ```

> **Cloudflare plan note:** this Worker uses a SQLite-backed Durable Object with
> the WebSocket Hibernation API, available on the **Workers Free** plan. Idle
> rooms hibernate, so cost stays near zero. Verify current limits in your
> Cloudflare dashboard.

#### Verify the Worker

```bash
curl https://frame-feud.<your-subdomain>.workers.dev/health
# -> {"ok":true,"service":"frame-feud",...}
```

---

## How a turn flows over the wire (happy path)

`turn_begin` → each client sends `plan_submit` → server relays `plan_status` as
locks arrive → on all-locked (or deadline) the server broadcasts
`resolve{ seed, queues }` → every client simulates + renders the cinematic +
sends `state_hash` → server confirms consensus (or flags `desync_detected`) →
next `turn_begin`.

## The roster

| Character | Archetype | Plays like |
|---|---|---|
| **TITAN** | Heavy | Slow, heaviest, huge damage & knockback. Late KOs, hard reads. |
| **RAZOR** | Rushdown | Fastest, lightest, multi-hit combo flurries, dies early. |
| **ARC** | Zoner | Aimable energy tools that control space; weak up close. |
| **GRIP** | Grappler | Command grabs & slams with massive close-range KB. |

Each fields a dynasty of 3 (mix and match). Movesets are intentionally focused
but distinct — depth comes from the blind planning mind-game, not move count.

---

## Determinism — why it works

JavaScript numbers are float64, and floats drift across devices, which would
desync lockstep. So the simulation (`client/src/sim/`) is **integer/fixed-point
only**: scaled-integer positions/velocities, an integer Bhaskara sine
approximation instead of `Math.sin`, squared-distance comparisons instead of
`sqrt`-on-floats, and a seeded integer PRNG instead of `Math.random`. Anything
purely cosmetic (particles, screenshake, the articulated-figure poses) lives in
`render/` and may use floats freely — it never feeds back into authoritative
state. `npm test` asserts byte-identical state hashes across repeated runs and
across a JSON round-trip (the network parity check).
