/** Human-readable frame data derived from move definitions. */

import { firstActive, lastActive, PARRY_RECOVERY, PARRY_WINDOW } from '../sim/step';
import type { CharacterDef, HitDef, MoveDef } from '../sim/types';

export interface FrameInfo {
  startup: number | null;
  active: number | null;
  total: number;
  damage: number | null;
  onHit: number | null;
  onBlock: number | null;
  tags: string[];
}

/** Advantage after the last hitbox connects at its first active frame. */
function adv(stun: number, total: number, f0: number): number {
  return stun - (total - f0 - 1);
}

export function frameInfo(m: MoveDef, def: CharacterDef, amt?: number): FrameInfo {
  let total = m.total;
  if (m.amtIsLength) total = (amt ?? m.param?.amt?.def ?? 0) + (m.amtExtra ?? 0);
  if (m.parry) total = (amt ?? m.param?.amt?.def ?? 6) + PARRY_WINDOW + PARRY_RECOVERY;
  const tags: string[] = [];
  const hbs = m.hitboxes ?? [];
  const grab = hbs.some((h) => h.kind === 'grab');
  let startup: number | null = null;
  let active: number | null = null;
  let damage: number | null = null;
  let onHit: number | null = null;
  let onBlock: number | null = null;
  const fa = firstActive(m);
  if (Number.isFinite(fa) && (hbs.length || m.spawns?.length)) {
    startup = fa;
    const la = lastActive(m);
    active = Math.max(1, la - fa + 1);
  }
  if (grab) {
    tags.push('Grab');
    const g = hbs.find((h) => h.kind === 'grab')!;
    const t = g.throwMove ? def.moves[g.throwMove] : undefined;
    if (t?.throw) damage = t.throw.hit.dmg;
  } else if (hbs.length) {
    const groups = new Map<number, { dmg: number; n: number }>();
    for (const h of hbs) {
      const k = h.group ?? 0;
      const cur = groups.get(k) ?? { dmg: 0, n: 0 };
      cur.dmg = Math.max(cur.dmg, h.dmg);
      cur.n = Math.max(cur.n, h.maxHits ?? 1);
      groups.set(k, cur);
    }
    damage = [...groups.values()].reduce((s, g) => s + g.dmg * g.n, 0);
    const last = hbs.reduce((a, b) => (b.f0 > a.f0 ? b : a), hbs[0]);
    onHit = adv(last.hitstun, total, last.f0);
    onBlock = last.unblockable ? null : adv(last.blockstun ?? Math.trunc((last.hitstun * 2) / 3), total, last.f0);
    if (m.script === 'dive' || m.script === 'leap') {
      onHit = null;
      onBlock = null;
    }
  } else if (m.spawns?.length) {
    const p = def.projectiles[m.spawns[0].proj];
    const hit: HitDef | undefined = p?.hit ?? (p?.burstInto ? def.projectiles[p.burstInto]?.hit : undefined);
    if (hit) damage = hit.dmg;
    tags.push('Projectile');
  }
  if (m.armor) tags.push(m.armor[2] >= 99 ? 'Super armor' : `Armor ×${m.armor[2]}`);
  if (m.invuln?.some((w) => w.vs === 'all')) tags.push('Invulnerable');
  else if (m.invuln?.some((w) => w.vs === 'strike')) tags.push('Strike invuln');
  else if (m.invuln?.some((w) => w.vs === 'proj')) tags.push('Projectile invuln');
  if (hbs.some((h) => h.unblockable)) tags.push('Unblockable');
  if (hbs.some((h) => h.otg)) tags.push('Hits downed');
  if (m.low) tags.push('Low profile');
  if (hbs.some((h) => h.kb[1] <= -10)) tags.push('Launcher');
  if (hbs.some((h) => h.wallBounce)) tags.push('Wall bounce');
  if (hbs.some((h) => h.groundBounce)) tags.push('Ground bounce');
  if (hbs.some((h) => h.knockdown)) tags.push('Knockdown');
  if (m.cancelOnHit !== undefined) tags.push(`Cancel on hit (f${m.cancelOnHit})`);
  if (m.meter) tags.push(`${m.meter / 1000} bar${m.meter > 1000 ? 's' : ''}`);
  return { startup, active, total, damage, onHit, onBlock, tags };
}

export const fmtAdv = (n: number | null) => (n === null ? '—' : n > 0 ? `+${n}` : String(n));
