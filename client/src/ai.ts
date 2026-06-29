/** Lightweight bot planner. Produces a legal ActionQueue. Bots exist only in
 *  local/practice matches (a single host simulates), so ordinary randomness is
 *  fine here — the queue it returns then feeds the deterministic sim. */

import { CHARACTERS } from './content/characters';
import { PLAN_BUDGET, WINDOW_TICKS } from './sim/step';
import type { ActionQueue, GameState, PlannedAction } from './sim/types';

export function planBot(state: GameState, idx: number, difficulty = 0.7): ActionQueue {
  const me = state.characters[idx];
  const player = state.players[idx];
  const cid = player.dynasty[player.activeIndex];
  const def = CHARACTERS[cid];
  const queue: ActionQueue = { playerId: player.playerId, characterId: cid, actions: [] };
  if (!me) return queue;

  // nearest living opponent
  let target: number = -1;
  let best = Infinity;
  state.characters.forEach((c, j) => {
    if (j === idx || !c || !c.alive) return;
    const d = Math.abs(c.pos.x - me.pos.x) + Math.abs(c.pos.y - me.pos.y) * 0.5;
    if (d < best) {
      best = d;
      target = j;
    }
  });

  let budget = PLAN_BUDGET;
  let tick = 0;
  const add = (a: PlannedAction, cost: number, dur: number) => {
    if (budget - cost < 0 || tick >= WINDOW_TICKS) return;
    queue.actions.push(a);
    budget -= cost;
    tick += dur;
  };

  const dumb = Math.random() > difficulty;
  const tgt = target >= 0 ? state.characters[target]! : null;
  const dx = tgt ? tgt.pos.x - me.pos.x : me.pos.x > 0 ? -1 : 1;
  const toRight = dx > 0;

  // Self-preservation: if off the main platform and below, jump back.
  if (!me.grounded && me.pos.y > 1000) {
    add({ moveId: me.pos.x > 0 ? 'hop_left' : 'hop_right', startTick: tick }, 1, 6);
  }

  const attacks = pickAttacks(def, Math.abs(dx) / 1000);

  if (!dumb && Math.abs(dx) > 2200) {
    add({ moveId: toRight ? 'dash_right' : 'dash_left', startTick: tick }, 2, 18);
  } else if (Math.abs(dx) > 1300) {
    add({ moveId: toRight ? 'walk_right' : 'walk_left', startTick: tick }, 1, 18);
  } else {
    // face target via a tiny step
    add({ moveId: toRight ? 'walk_right' : 'walk_left', startTick: tick }, 1, 6);
  }

  // commit an attack (aim toward target for aimable)
  for (const atk of attacks) {
    const m = def.moves[atk];
    if (!m) continue;
    if (budget < m.cost) continue;
    const action: PlannedAction = { moveId: atk, startTick: tick };
    if (m.aimable && tgt) {
      const ang = Math.round((Math.atan2(-(tgt.pos.y - me.pos.y), tgt.pos.x - me.pos.x) * 180) / Math.PI);
      action.aimAngle = ((ang % 360) + 360) % 360;
    }
    add(action, m.cost, m.startup + m.active + m.recovery);
    break;
  }

  // occasional mixup: shield or another poke
  if (budget >= 1 && Math.random() < 0.5) {
    add({ moveId: 'shield', startTick: Math.min(tick, WINDOW_TICKS - 10) }, 1, 20);
  }

  return queue;
}

function pickAttacks(def: { moves: Record<string, any> }, distUnits: number): string[] {
  const ids = Object.keys(def.moves).filter((id) => {
    const m = def.moves[id];
    return m.hitboxes.length > 0;
  });
  // prefer ranged when far, heavy when close — shuffle a bit
  ids.sort(() => Math.random() - 0.5);
  if (distUnits > 2.2) {
    ids.sort((a, b) => (def.moves[b].aimable ? 1 : 0) - (def.moves[a].aimable ? 1 : 0));
  } else {
    ids.sort((a, b) => def.moves[b].hitboxes[0].damage - def.moves[a].hitboxes[0].damage);
  }
  return ids;
}
