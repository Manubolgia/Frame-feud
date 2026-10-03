# Frame Feud

A 1v1 turn-based fighting game in the style of *Your Only Move Is Hustle*.
Both players pick a move in secret, lock in, and the exchange plays out frame
by frame until one of them can act again. No reflexes, only reads.

**Play:** https://manubolgia.github.io/Frame-feud/ (also in the
[MNBG Tape Library](https://github.com/manubolgia/mnbglibrary)).

It runs in any modern browser, on desktop or phone, installs as a PWA and plays
offline against the CPU or a friend on the same device. Online play needs the
small Cloudflare Worker in `worker/`.

---

## How a turn works

1. **Pick.** The game stops at the first frame either fighter can act. Each
   player picks a move from the panel (Move, Attack, Special, Defend, Super),
   aims it if it takes a direction, and locks in. Neither sees the other's pick.
2. **Preview.** Before locking in, a ghost replays your pick against what you
   expect the opponent to do ("they wait" or "they block"). The readout shows
   who acts first and by how many frames.
3. **Resolve.** Both picks run at once, frame by frame, with hitstop, knockback
   and the camera following the action. Play stops again as soon as anyone can
   act: you get a turn mid-combo when your move can cancel, after blocking, on
   landing and so on.

The whole game is a set of counters:

| Option | Beats | Loses to |
|---|---|---|
| Attack | Grabs, waiting, slower attacks | Blocks (when unsafe), parries |
| Block | Attacks | Grabs, getting outmanoeuvred |
| Parry (3-frame window) | A hit you timed right | Grabs, a feint, a mistimed read |
| Grab | Blocks and parries | Any attack, a jump |

### Mechanics

- **Frame data** for every move: startup, total length, damage, advantage on
  hit and on block, plus tags such as *armor*, *low profile*, *launcher*,
  *knockdown*, *unblockable*. It's shown in the panel, the move list and over
  the fighters while you plan.
- **Cancels.** Many attacks offer a new turn on hit (or on block) partway
  through, which is how combos are built one decision at a time.
- **Combos** scale damage down and shorten hitstun the longer they run, so
  loops end.
- **Directional influence (DI).** While being hit you get a turn to bend the
  knockback with a small direction pad.
- **Burst.** A gauge that refills over time. When it's full, spend it to
  explode outward and break out of a combo, or as a raw attack.
- **Meter** (3 bars) builds as you deal and take damage. It pays for supers
  (1 or 2 bars) and for **feints**: half a bar to bail out of an attack
  before it hits.
- **Armor** lets some heavy moves walk through hits; **counter hits** reward
  hitting someone mid-startup.
- **Knockdowns** give the fallen player a wake-up choice (get up, tech roll,
  rising kick), with OTG hits, wall and ground bounces for the attacker.
- **Projectiles** clash with each other, can be detonated, pulled back or
  burst through.
- **Air movement**: jumps, air jumps, air dashes and fast-falls, with
  character-specific counts.

All of this runs in a deterministic integer simulation, so replays, the ghost
and online play always match.

---

## The roster

| Fighter | Archetype | HP | Plays like |
|---|---|---|---|
| **RAZOR**, *The Quiet Edge* | Rushdown | 1000 | Two air jumps, two air dashes and a teleport. Fast cancels, kunai and a dive kick. Gets in, never lets go, dies early on a bad guess. |
| **TITAN**, *The Walking Siege* | Heavy | 1400 | Armored attacks that walk through jabs, arcing missiles, ground pounds, a rocket charge and a command grab. Every clean hit hurts. |
| **ARC**, *The Storm Scholar* | Zoner | 1050 | Bolts, a slow orb you can detonate, blink, an updraft and a beam super. Controls space and keeps you out. |
| **GRIP**, *The Iron Clinch* | Grappler | 1250 | A suplex, a long-reach piledriver, a grabbing bull rush, a body-splash leap and an armored headbutt. Turns every block into a guessing game. |

Each fighter has around twelve moves of their own on top of the shared
movement, defence and wake-up options, plus four colour palettes. Every move
has a keyframed animation, and hits get effects and sounds that fit the move.

**Stages:** Dawn Dojo, Neon Rooftop, Skyforge and Training Lab. Each has
parallax layers, ambient motion, walls and a ceiling.

## Modes

- **Versus CPU** with Easy, Normal and Hard. The CPU plays out the likely
  exchanges for each pick, builds a payoff table and mixes its choices, so it
  can't be beaten by repeating one thing.
- **Local versus.** Two players on one device; a hand-off screen hides each
  pick from the other player.
- **Online.** Room codes, a lobby with fighter picks, rounds and a turn timer,
  spectators, reconnection mid-match and rematches.
- **Training.** Dummy set to stand, block, jump, parry or CPU; refill health,
  infinite meter, hitbox display, reset and swap sides.
- **Replays.** Recent matches are saved locally and can be rewatched with
  pause, speed and restart controls.
- **How to play.** A seven-page illustrated guide.

## Controls

The panel works with touch, mouse and keyboard:

| Key | Action |
|---|---|
| 1 – 5 | Move categories |
| Arrows | Browse moves / nudge an aim direction |
| Enter | Lock in |
| Space | Pause or play the ghost |
| H | Hide the action panel |
| R | Rewatch the last exchange |
| Hold F (or hold on the arena) | Fast-forward an exchange |
| Esc | Pause menu |

The settings cover master, music and effect volume, playback speed, ghost,
frame data and hitboxes, screen shake and reduced motion.

---

## Run it locally

```bash
cd client
npm install
npm run dev          # http://localhost:5173/Frame-feud/
```

Everything except Online works with no setup. Other scripts in `client/`:

```bash
npm test             # simulation, mechanics and CPU tests (Vitest)
npm run typecheck
npm run build        # typecheck + production build into client/dist
npm run preview      # serve the production build on :4173
node scripts/smoke.mjs   # headless browser smoke test against the preview
node scripts/gen-icons.mjs  # regenerate PNG icons from public/favicon.svg
```

Two dev-only pages help with content work (served by `npm run dev`):

- `/Frame-feud/dev/poses.html?char=razor`: every move of a fighter, frame by
  frame, for animation work.
- `/Frame-feud/dev/arena.html`: the arena renderer on its own, for stages and
  effects.

### Online play locally

```bash
cd worker && npm install && npx wrangler dev --port 8787
cd client && VITE_WS_URL=ws://127.0.0.1:8787/room npm run dev
```

Open two browser windows, create a room in one and join with the code in the
other.

---

## Deploy

### Client → GitHub Pages

`.github/workflows/deploy-pages.yml` tests, builds and publishes `client/` on
every push to `main`. In the repository settings, set **Pages → Source** to
**GitHub Actions**. The site lives at `https://<user>.github.io/<repo>/`.

The Pages path is case-sensitive (`/Frame-feud/`, capital F). The workflow
derives Vite's `base` from the repository name, so a rename keeps working.

### Online server → Cloudflare Worker

```bash
cd worker
npm install
npx wrangler login
npx wrangler deploy
```

Wrangler prints `https://frame-feud.<subdomain>.workers.dev`. Point the client
at its `/room` endpoint and redeploy Pages:

- GitHub: **Settings → Secrets and variables → Actions → Variables**, add
  `VITE_WS_URL` = `wss://frame-feud.<subdomain>.workers.dev/room`, then
  re-run the deploy workflow.
- Local: put the same line in `client/.env.local`.

Without `VITE_WS_URL` the build ships with the Online menu entry disabled.
`curl https://frame-feud.<subdomain>.workers.dev/health` checks the Worker.

The Worker uses a SQLite-backed Durable Object with WebSocket Hibernation,
which is available on the Workers Free plan; idle rooms cost nothing.

---

## How it's built

```
client/
  src/
    sim/       deterministic engine: integer maths, frame stepping, hit
               resolution, rules for what can be picked, resolve/ghost/replay
    content/   fighters, moves, frame data, poses and stages (pure data)
    game/      match controller, drivers (human, CPU, hotseat, online),
               CPU, settings, app shell
    render/    PixiJS arena: skeletal figures, cloth, stages, camera, effects
    ui/        DOM panel, HUD, banners, screens, frame-data formatting, icons
    net/       WebSocket client and protocol types
    audio/     procedural WebAudio sound effects and music (no audio files)
    library.ts MNBG Tape Library integration
  test/        mechanics, determinism and CPU tests
  dev/         pose and arena dev pages
  scripts/     icon generator, smoke test
worker/
  src/         Worker router + Room Durable Object
```

**Determinism.** The simulation (`client/src/sim/`) uses integers only
(sub-pixel positions, integer square roots, a seeded PRNG) and never reads the
clock, so the same config and decisions give the same frames on every device.
A match is stored as its config plus the list of decision pairs; that is the
replay format, the online protocol and what the tests hash. Rendering,
particles and audio may use floats freely because nothing feeds back into the
simulation.

**Online.** The Room Durable Object is the authority on the lobby and on
decisions, not on the game state. Each turn both players send `decide`; when
both are in, the room broadcasts `resolve` with the pair and every client
simulates it locally. Clients send a hash of the resulting state; if two hashes
differ the room reports a desync. The room keeps the decision log, so a client
that drops (or a spectator who joins late) gets the log in `start` and replays
it to catch up. A resume token keeps the seat across reconnects, the room's
alarm runs the turn timer and disconnect forfeits, and a client running a
different build (`SIM_VERSION`) is turned away with a prompt to reload.

**Rendering.** Fighters are forward-kinematic skeletons posed from per-move
keyframes, with planted feet, verlet cloth (scarves, hoods), outlines and
per-character kits. Effects (hit sparks, rings, trails, debris, slow motion,
screen shake) and a camera that frames both fighters are layered on top. A
canvas-2D backend of the same drawing code renders the character portraits.

## MNBG Tape Library

When the game runs inside the [MNBG Tape Library](https://github.com/manubolgia/mnbglibrary)
it announces itself with `mnbglibrary:hello` (so the library hides its eject
tab), adds a "Back to the library" menu entry and respects the library's
safe-area insets.
