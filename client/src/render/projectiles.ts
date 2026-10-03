/** Projectile looks, drawn in world space from snapshots. */

import type { Graphics } from 'pixi.js';
import type { ProjSnap, ProjectileDef } from '../sim/types';
import { lighten } from './color';

export function drawProjectile(g: Graphics, p: ProjSnap, def: ProjectileDef, color: number, glow: number, time: number) {
  const x = p.x / 100;
  const y = p.y / 100;
  const vx = p.vx / 100;
  const vy = p.vy / 100;
  const sp = Math.hypot(vx, vy) || 1;
  const ux = vx / sp;
  const uy = vy / sp;
  const r = def.r;
  const age = p.age;
  switch (def.look) {
    case 'kunai': {
      // motion trail
      g.moveTo(x - ux * 60, y - uy * 60).lineTo(x, y).stroke({ color: glow, width: 6, alpha: 0.25, cap: 'round' });
      g.moveTo(x - ux * 30, y - uy * 30).lineTo(x, y).stroke({ color: 0xffffff, width: 2.5, alpha: 0.6, cap: 'round' });
      const nx = -uy;
      const ny = ux;
      g.poly([x + ux * 16, y + uy * 16, x + nx * 5, y + ny * 5, x - ux * 6, y - uy * 6, x - nx * 5, y - ny * 5]).fill({ color: 0xdfe8f2 }).stroke({ color: 0x0b0b14, width: 1.5 });
      g.moveTo(x - ux * 6, y - uy * 6).lineTo(x - ux * 16, y - uy * 16).stroke({ color: 0x23262e, width: 3, cap: 'round' });
      g.circle(x - ux * 18, y - uy * 18, 3.5).stroke({ color: color, width: 2 });
      break;
    }
    case 'bolt': {
      for (let i = 4; i >= 1; i--) g.circle(x - ux * i * 9, y - uy * i * 9, r * (1 - i * 0.18)).fill({ color: glow, alpha: 0.12 });
      g.ellipse(x, y, r * 1.5, r * 1.5).fill({ color: color, alpha: 0.35 });
      g.circle(x, y, r * 0.95).fill({ color: lighten(color, 0.4) });
      g.circle(x, y, r * 0.5).fill({ color: 0xffffff });
      // crackle
      const a0 = time * 40 + p.id;
      for (let k = 0; k < 3; k++) {
        const a = a0 + k * 2.1;
        g.moveTo(x, y)
          .lineTo(x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r * 1.4)
          .lineTo(x + Math.cos(a + 0.6) * r * 2.1, y + Math.sin(a + 0.6) * r * 2.1)
          .stroke({ color: 0xffffff, width: 1.5, alpha: 0.8 });
      }
      break;
    }
    case 'orb': {
      const pulse = 1 + Math.sin(time * 8 + p.id) * 0.08;
      g.circle(x, y, r * 2.2 * pulse).fill({ color: glow, alpha: 0.1 });
      g.circle(x, y, r * 1.4 * pulse).fill({ color: color, alpha: 0.28 });
      g.circle(x, y, r * pulse).fill({ color: lighten(color, 0.2) }).stroke({ color: 0xffffff, width: 2, alpha: 0.8 });
      g.circle(x - r * 0.3, y - r * 0.3, r * 0.35).fill({ color: 0xffffff, alpha: 0.85 });
      for (let k = 0; k < 3; k++) {
        const a = time * 3 + (k * Math.PI * 2) / 3;
        g.circle(x + Math.cos(a) * r * 1.7, y + Math.sin(a) * r * 0.7, 3).fill({ color: 0xffffff, alpha: 0.9 });
      }
      // fading warning when about to expire
      if (def.life - age < 40 && Math.floor(time * 12) % 2 === 0) g.circle(x, y, r * 1.8).stroke({ color: 0xffffff, width: 2, alpha: 0.7 });
      break;
    }
    case 'missile': {
      const nx = -uy;
      const ny = ux;
      // smoke trail
      for (let i = 1; i <= 5; i++) g.circle(x - ux * i * 12, y - uy * i * 12, 4 + i * 2).fill({ color: 0x9a9aa8, alpha: 0.18 - i * 0.025 });
      // flame
      const fl = 0.7 + Math.random() * 0.5;
      g.poly([x - ux * 12 + nx * 5, y - uy * 12 + ny * 5, x - ux * (24 + 14 * fl), y - uy * (24 + 14 * fl), x - ux * 12 - nx * 5, y - uy * 12 - ny * 5]).fill({ color: 0xffb040 });
      g.poly([x - ux * 12 + nx * 2.5, y - uy * 12 + ny * 2.5, x - ux * (18 + 8 * fl), y - uy * (18 + 8 * fl), x - ux * 12 - nx * 2.5, y - uy * 12 - ny * 2.5]).fill({ color: 0xfff2c0 });
      // body
      g.poly([x + ux * 18, y + uy * 18, x + ux * 8 + nx * 7, y + uy * 8 + ny * 7, x - ux * 12 + nx * 7, y - uy * 12 + ny * 7, x - ux * 12 - nx * 7, y - uy * 12 - ny * 7, x + ux * 8 - nx * 7, y + uy * 8 - ny * 7])
        .fill({ color: color })
        .stroke({ color: 0x0b0b14, width: 2 });
      g.poly([x - ux * 12 + nx * 7, y - uy * 12 + ny * 7, x - ux * 16 + nx * 12, y - uy * 16 + ny * 12, x - ux * 6 + nx * 7, y - uy * 6 + ny * 7]).fill({ color: 0x2a2a34 });
      g.poly([x - ux * 12 - nx * 7, y - uy * 12 - ny * 7, x - ux * 16 - nx * 12, y - uy * 16 - ny * 12, x - ux * 6 - nx * 7, y - uy * 6 - ny * 7]).fill({ color: 0x2a2a34 });
      g.circle(x + ux * 6, y + uy * 6, 2.5).fill({ color: glow });
      break;
    }
    case 'blast': {
      const t = Math.min(1, age / Math.max(1, def.life));
      const rr = r * (0.55 + 0.45 * t);
      g.circle(x, y, rr).fill({ color: 0xfff2c0, alpha: 0.5 * (1 - t) });
      g.circle(x, y, rr * 0.75).fill({ color: lighten(color, 0.5), alpha: 0.6 * (1 - t) });
      g.circle(x, y, rr).stroke({ color: 0xffffff, width: 6 * (1 - t) + 1, alpha: 1 - t });
      break;
    }
    case 'shock':
    case 'wave': {
      const t = Math.min(1, age / Math.max(1, def.life));
      const rr = r * (0.3 + 0.7 * t);
      g.ellipse(x, 0, rr, rr * 0.18).fill({ color: color, alpha: 0.35 * (1 - t) });
      g.ellipse(x, 0, rr, rr * 0.18).stroke({ color: 0xffffff, width: 5 * (1 - t) + 1, alpha: 1 - t });
      if (def.look === 'wave') {
        // rocks jutting from the ground
        for (let k = -6; k <= 6; k++) {
          if (k === 0) continue;
          const kx = x + (k / 6) * rr;
          const h = (34 + ((k * 37) % 23)) * (1 - t) * (1 - Math.abs(k) / 8);
          g.poly([kx - 12, 0, kx - 3, -h, kx + 4, -h * 0.8, kx + 12, 0]).fill({ color: 0x6a5a4a, alpha: 1 - t * 0.6 }).stroke({ color: 0x0b0b14, width: 2, alpha: 1 - t });
        }
      }
      break;
    }
    case 'singularity': {
      const t = age / Math.max(1, def.life);
      const pulse = 1 + Math.sin(time * 14) * 0.06;
      for (let k = 0; k < 4; k++) {
        const rr = ((time * 120 + k * 60) % 240) + 30;
        g.circle(x, y, 300 - rr).stroke({ color: color, width: 2, alpha: 0.12 + (rr / 240) * 0.2 });
      }
      g.circle(x, y, r * 2.2 * pulse).fill({ color: color, alpha: 0.25 });
      for (let k = 0; k < 6; k++) {
        const a = time * 6 + k * 1.05;
        g.arc(x, y, r * 1.6, a, a + 0.9).stroke({ color: glow, width: 3, alpha: 0.8 });
      }
      g.circle(x, y, r * pulse).fill({ color: 0x05030a }).stroke({ color: 0xffffff, width: 2.5, alpha: 0.9 });
      if (t > 0.75 && Math.floor(time * 16) % 2 === 0) g.circle(x, y, r * 1.2).fill({ color: 0xffffff, alpha: 0.5 });
      break;
    }
  }
}
