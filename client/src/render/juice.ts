/** Particle / spark / shockwave system. Purely cosmetic (float + Math.random
 *  are fine here — none of this touches authoritative sim state). */

import { Container, Graphics } from 'pixi.js';
import type { Camera } from './camera';

interface Particle {
  x: number; // world units
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  gravity: number;
  kind: 'spark' | 'dust' | 'ring' | 'star' | 'trail';
}

export class Juice {
  layer = new Container();
  private g = new Graphics();
  private parts: Particle[] = [];
  private rings: { x: number; y: number; r: number; life: number; maxLife: number; color: number; width: number }[] = [];

  constructor() {
    this.layer.addChild(this.g);
  }

  burst(x: number, y: number, color: number, power: number) {
    const n = Math.min(8 + Math.floor(power * 18), 46);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.4 + Math.random() * 2.2) * (0.5 + power);
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.6,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.4,
        size: 0.06 + Math.random() * 0.12 * (0.6 + power),
        color,
        gravity: 4.5,
        kind: Math.random() < 0.4 ? 'star' : 'spark',
      });
    }
    this.rings.push({ x, y, r: 0.2, life: 0, maxLife: 0.32, color, width: 0.12 + power * 0.18 });
  }

  shockwave(x: number, y: number, color: number, scale: number) {
    this.rings.push({ x, y, r: 0.3, life: 0, maxLife: 0.5, color, width: 0.16 * scale });
  }

  dust(x: number, y: number, color: number) {
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
      const sp = 0.3 + Math.random() * 0.8;
      this.parts.push({
        x: x + (Math.random() - 0.5) * 0.4,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.2,
        size: 0.05 + Math.random() * 0.06,
        color,
        gravity: 1.5,
        kind: 'dust',
      });
    }
  }

  trail(x: number, y: number, color: number) {
    this.parts.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0.22,
      size: 0.16,
      color,
      gravity: 0,
      kind: 'trail',
    });
  }

  koFlash(x: number, y: number, color: number) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 4;
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        maxLife: 0.6 + Math.random() * 0.5,
        size: 0.1 + Math.random() * 0.2,
        color: Math.random() < 0.5 ? color : 0xffffff,
        gravity: 2,
        kind: 'star',
      });
    }
    this.rings.push({ x, y, r: 0.4, life: 0, maxLife: 0.8, color: 0xffffff, width: 0.4 });
    this.rings.push({ x, y, r: 0.4, life: 0, maxLife: 1.0, color, width: 0.25 });
  }

  update(dt: number) {
    for (const p of this.parts) {
      p.life += dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
    }
    this.parts = this.parts.filter((p) => p.life < p.maxLife);
    for (const r of this.rings) {
      r.life += dt;
      r.r += dt * 6;
    }
    this.rings = this.rings.filter((r) => r.life < r.maxLife);
  }

  draw(cam: Camera) {
    const g = this.g;
    g.clear();
    for (const r of this.rings) {
      const t = r.life / r.maxLife;
      const alpha = (1 - t) * 0.8;
      g.circle(cam.toScreenX(r.x * 1000), cam.toScreenY(r.y * 1000), cam.len(r.r));
      g.stroke({ width: Math.max(1, cam.len(r.width * (1 - t))), color: r.color, alpha });
    }
    for (const p of this.parts) {
      const t = p.life / p.maxLife;
      const alpha = 1 - t;
      const sx = cam.toScreenX(p.x * 1000);
      const sy = cam.toScreenY(p.y * 1000);
      const sz = cam.len(p.size * (p.kind === 'trail' ? 1 - t : 1));
      if (p.kind === 'star') {
        drawStar(g, sx, sy, sz * 1.6, sz * 0.7, 4, p.color, alpha);
      } else {
        g.circle(sx, sy, Math.max(0.5, sz));
        g.fill({ color: p.color, alpha });
      }
    }
  }

  clear() {
    this.parts = [];
    this.rings = [];
    this.g.clear();
  }
}

function drawStar(
  g: Graphics,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  points: number,
  color: number,
  alpha: number,
) {
  const step = Math.PI / points;
  let angle = -Math.PI / 2;
  g.moveTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    angle += step;
    g.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  }
  g.closePath();
  g.fill({ color, alpha });
}

/** Hitstop manager: freeze sim playback briefly for impact weight. */
export class Hitstop {
  private frames = 0;
  add(n: number) {
    this.frames = Math.max(this.frames, n);
  }
  /** returns true if currently frozen (consumes one frame). */
  tick(): boolean {
    if (this.frames > 0) {
      this.frames--;
      return true;
    }
    return false;
  }
  get active() {
    return this.frames > 0;
  }
}
