/**
 * Impact effects in world space: sparks, flashes, rings, shards, dust,
 * pop-up callouts and damage numbers. Cosmetic only.
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { lighten } from './color';

type Kind = 'streak' | 'shard' | 'dust' | 'smoke' | 'dot';

interface Part {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  drag: number;
  life: number;
  max: number;
  size: number;
  c: number;
  rot: number;
  vr: number;
}

interface Ring {
  x: number;
  y: number;
  r0: number;
  r1: number;
  w: number;
  c: number;
  life: number;
  max: number;
  fill?: boolean;
  squash?: number;
}

interface Spike {
  x: number;
  y: number;
  n: number;
  len: number;
  w: number;
  c: number;
  life: number;
  max: number;
  rot: number;
}

interface Pop {
  t: Text;
  vy: number;
  life: number;
  max: number;
  scale0: number;
}

const r = Math.random;

export class Fx {
  layer = new Container();
  private g = new Graphics();
  private texts = new Container();
  private parts: Part[] = [];
  private rings: Ring[] = [];
  private spikes: Spike[] = [];
  private pops: Pop[] = [];
  reduced = false;

  constructor() {
    this.layer.addChild(this.g, this.texts);
  }

  clear() {
    this.parts = [];
    this.rings = [];
    this.spikes = [];
    for (const p of this.pops) p.t.destroy();
    this.pops = [];
    this.g.clear();
  }

  private part(p: Partial<Part> & { x: number; y: number }) {
    this.parts.push({ kind: 'streak', vx: 0, vy: 0, g: 0, drag: 0.9, life: 0, max: 0.4, size: 3, c: 0xffffff, rot: 0, vr: 0, ...p });
  }

  ring(x: number, y: number, r0: number, r1: number, w: number, c: number, max: number, squash = 1, fill = false) {
    this.rings.push({ x, y, r0, r1, w, c, life: 0, max, squash, fill });
  }

  /** A strike connecting. power 0..100. */
  hit(x: number, y: number, power: number, color: number, dirX: number, fx: string, counter = false) {
    const p = Math.max(0.15, power / 100);
    const big = fx === 'heavy' || fx === 'blast' || p > 0.7;
    const col = counter ? 0xff4060 : color;
    this.ring(x, y, 4, 16 + 30 * p, 3 + 6 * p, 0xffffff, 0.08 + 0.06 * p, 1, true);
    this.ring(x, y, 8, 34 + 50 * p, 2 + 5 * p, col, 0.2 + 0.1 * p);
    if (big) this.ring(x, y, 16, 80 + 70 * p, 3, 0xffffff, 0.3, 0.55);
    this.spikes.push({ x, y, n: fx === 'slash' ? 3 : 7 + Math.round(p * 5), len: 30 + 56 * p, w: 5 + 9 * p, c: col, life: 0, max: 0.12 + 0.07 * p, rot: r() * Math.PI });
    this.spikes.push({ x, y, n: 5, len: 18 + 30 * p, w: 3 + 5 * p, c: 0xffffff, life: 0, max: 0.09 + 0.05 * p, rot: r() * Math.PI });
    const n = Math.round(8 + 26 * p) * (this.reduced ? 0.4 : 1);
    for (let i = 0; i < n; i++) {
      const a = (r() - 0.5) * Math.PI * 1.3 + (dirX > 0 ? 0 : Math.PI);
      const sp = (260 + r() * 900) * (0.5 + p);
      this.part({ kind: 'streak', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, g: 900, drag: 0.86, max: 0.18 + r() * 0.25, size: 2 + r() * 3 * (0.5 + p), c: r() < 0.5 ? 0xffffff : lighten(col, 0.3) });
    }
    if (fx === 'slash') {
      for (let i = 0; i < 2; i++) this.ring(x - dirX * 10, y, 22 + i * 8, 34 + i * 10, 4 - i, i ? col : 0xffffff, 0.12, 1);
    }
    if (fx === 'zap') {
      for (let i = 0; i < 8; i++) this.part({ kind: 'dot', x: x + (r() - 0.5) * 40, y: y + (r() - 0.5) * 40, vx: (r() - 0.5) * 300, vy: (r() - 0.5) * 300, drag: 0.8, max: 0.3, size: 2 + r() * 2, c: 0xd8f6ff });
    }
    if (big) {
      for (let i = 0; i < 6; i++) {
        const a = r() * Math.PI * 2;
        this.part({ kind: 'shard', x, y, vx: Math.cos(a) * 500, vy: Math.sin(a) * 500 - 200, g: 1400, drag: 0.94, max: 0.5, size: 6 + r() * 6, c: col, rot: r() * 6, vr: (r() - 0.5) * 20 });
      }
    }
  }

  block(x: number, y: number, dirX: number, power: number) {
    const p = Math.max(0.2, power / 100);
    // hexagonal guard flash on the defender's side
    this.ring(x, y, 14, 30 + 16 * p, 4, 0x8fe6ff, 0.18, 1.4);
    this.ring(x, y, 6, 20, 8, 0xffffff, 0.07, 1, true);
    for (let i = 0; i < 10; i++) {
      const a = (r() - 0.5) * 1.8 + (dirX > 0 ? Math.PI : 0);
      const sp = 300 + r() * 500;
      this.part({ kind: 'streak', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 600, drag: 0.82, max: 0.16 + r() * 0.12, size: 2 + r() * 2, c: r() < 0.5 ? 0xbff2ff : 0xffffff });
    }
  }

  parry(x: number, y: number) {
    this.ring(x, y, 8, 50, 12, 0xffffff, 0.1, 1, true);
    this.ring(x, y, 16, 120, 5, 0xffffff, 0.35);
    this.ring(x, y, 24, 160, 3, 0x8fe6ff, 0.45);
    this.spikes.push({ x, y, n: 4, len: 130, w: 8, c: 0xffffff, life: 0, max: 0.25, rot: Math.PI / 4 });
    this.spikes.push({ x, y, n: 4, len: 70, w: 6, c: 0x8fe6ff, life: 0, max: 0.3, rot: 0 });
    this.pop(x, y - 60, 'PARRY', 0xbff2ff, 44);
  }

  armor(x: number, y: number) {
    this.ring(x, y, 16, 70, 8, 0xffa040, 0.22);
    this.spikes.push({ x, y, n: 6, len: 50, w: 8, c: 0xffc070, life: 0, max: 0.14, rot: r() * 3 });
    this.pop(x, y - 50, 'ARMOR', 0xffb050, 30);
  }

  tech(x: number, y: number) {
    this.ring(x, y, 10, 110, 8, 0xffffff, 0.3);
    this.pop(x, y - 40, 'TECH', 0xffffff, 34);
  }

  grab(x: number, y: number, c: number) {
    this.ring(x, y, 30, 8, 6, c, 0.16);
    this.ring(x, y, 46, 20, 3, 0xffffff, 0.2);
  }

  counter(x: number, y: number) {
    this.pop(x, y - 70, 'COUNTER', 0xff4060, 36);
  }

  ko(x: number, y: number, c: number) {
    this.ring(x, y, 20, 300, 16, 0xffffff, 0.6);
    this.ring(x, y, 20, 220, 8, c, 0.8);
    this.spikes.push({ x, y, n: 12, len: 220, w: 18, c: 0xffffff, life: 0, max: 0.4, rot: r() * 3 });
    for (let i = 0; i < 50; i++) {
      const a = r() * Math.PI * 2;
      const sp = 300 + r() * 1400;
      this.part({ kind: r() < 0.3 ? 'shard' : 'streak', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 800, drag: 0.9, max: 0.5 + r() * 0.6, size: 3 + r() * 6, c: r() < 0.5 ? c : 0xffffff, rot: r() * 6, vr: (r() - 0.5) * 30 });
    }
  }

  dust(x: number, y: number, dir: number, amount: number, c = 0xd8c8b0) {
    const n = Math.round(amount * (this.reduced ? 0.4 : 1));
    for (let i = 0; i < n; i++) {
      this.part({ kind: 'dust', x: x + (r() - 0.5) * 20, y: y - 2, vx: (dir || (r() < 0.5 ? -1 : 1)) * (60 + r() * 220), vy: -(20 + r() * 90), g: 120, drag: 0.9, max: 0.35 + r() * 0.35, size: 5 + r() * 9, c });
    }
  }

  landing(x: number, hard: boolean, c = 0xd8c8b0) {
    this.dust(x, 0, -1, hard ? 7 : 3, c);
    this.dust(x, 0, 1, hard ? 7 : 3, c);
    if (hard) this.ring(x, 0, 10, 90, 5, 0xffffff, 0.25, 0.25);
  }

  wall(x: number, y: number) {
    this.ring(x, y, 8, 60, 8, 0xffffff, 0.22, 2.2);
    for (let i = 0; i < 14; i++) this.part({ kind: 'shard', x, y: y + (r() - 0.5) * 80, vx: -Math.sign(x) * (100 + r() * 400), vy: (r() - 0.5) * 400, g: 1200, drag: 0.92, max: 0.6, size: 4 + r() * 5, c: 0xcfc3b8, rot: r() * 6, vr: (r() - 0.5) * 20 });
  }

  bounce(x: number) {
    this.ring(x, 0, 10, 80, 6, 0xffffff, 0.22, 0.25);
    this.dust(x, 0, -1, 8);
    this.dust(x, 0, 1, 8);
  }

  smoke(x: number, y: number, c: number) {
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2;
      this.part({ kind: 'smoke', x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 30, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80 - 40, g: -40, drag: 0.92, max: 0.45 + r() * 0.3, size: 12 + r() * 12, c });
    }
  }

  burst(x: number, y: number, c: number) {
    this.ring(x, y, 16, 80, 14, 0xffffff, 0.16, 1, true);
    this.ring(x, y, 30, 170, 8, c, 0.4);
    this.ring(x, y, 40, 200, 3, 0xffffff, 0.5);
    for (let i = 0; i < 30; i++) {
      const a = r() * Math.PI * 2;
      this.part({ kind: 'streak', x, y, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, drag: 0.85, max: 0.35, size: 3, c: r() < 0.5 ? c : 0xffffff });
    }
  }

  explosion(x: number, y: number, radius: number, c: number) {
    this.ring(x, y, radius * 0.2, radius * 0.8, radius * 0.4, 0xfff2c0, 0.14, 1, true);
    this.ring(x, y, radius * 0.4, radius * 1.15, 6, c, 0.3);
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2;
      const sp = 200 + r() * 700;
      this.part({ kind: i % 3 ? 'streak' : 'smoke', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 100, g: 300, drag: 0.88, max: 0.3 + r() * 0.4, size: i % 3 ? 3 : 16, c: i % 3 ? 0xffd27a : 0x5a4a5a });
    }
  }

  shockwave(x: number, radius: number, c: number) {
    this.ring(x, 0, 10, radius, 6, c, 0.3, 0.18);
    this.ring(x, 0, 10, radius * 0.7, 10, 0xffffff, 0.2, 0.14);
    this.dust(x - radius * 0.5, 0, -1, 10, 0xc8b8a0);
    this.dust(x + radius * 0.5, 0, 1, 10, 0xc8b8a0);
  }

  pop(x: number, y: number, text: string, color: number, size: number) {
    const t = new Text({
      text,
      style: new TextStyle({
        fontFamily: 'Anton, Impact, sans-serif',
        fontSize: size,
        fill: color,
        stroke: { color: 0x07070d, width: Math.max(4, size * 0.16), join: 'round' },
        letterSpacing: 1,
      }),
    });
    t.anchor.set(0.5);
    t.x = x;
    t.y = y;
    t.rotation = (r() - 0.5) * 0.12;
    this.texts.addChild(t);
    this.pops.push({ t, vy: -60, life: 0, max: 0.8, scale0: 1.6 });
  }

  damage(x: number, y: number, n: number, color = 0xffffff) {
    const t = new Text({
      text: String(n),
      style: new TextStyle({
        fontFamily: 'Anton, Impact, sans-serif',
        fontSize: 26 + Math.min(26, n / 6),
        fill: color,
        stroke: { color: 0x07070d, width: 5, join: 'round' },
      }),
    });
    t.anchor.set(0.5);
    const stack = this.pops.filter((p) => p.life < 0.35 && Math.abs(p.t.x - x) < 90).length;
    t.x = x + (r() - 0.5) * 16 + stack * 10;
    t.y = y - 24 - stack * 26;
    this.texts.addChild(t);
    this.pops.push({ t, vy: -110, life: 0, max: 0.75, scale0: 1.3 });
  }

  update(dt: number) {
    for (const p of this.parts) {
      p.life += dt;
      p.vy += p.g * dt;
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.parts = this.parts.filter((p) => p.life < p.max);
    for (const q of this.rings) q.life += dt;
    this.rings = this.rings.filter((q) => q.life < q.max);
    for (const s of this.spikes) s.life += dt;
    this.spikes = this.spikes.filter((s) => s.life < s.max);
    for (const p of this.pops) {
      p.life += dt;
      p.t.y += p.vy * dt;
      p.vy *= Math.pow(0.05, dt);
      const k = p.life / p.max;
      const s = k < 0.12 ? p.scale0 - (p.scale0 - 1) * (k / 0.12) : 1;
      p.t.scale.set(s);
      p.t.alpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    }
    for (const p of this.pops) if (p.life >= p.max) p.t.destroy();
    this.pops = this.pops.filter((p) => p.life < p.max);
  }

  draw() {
    const g = this.g;
    g.clear();
    for (const q of this.rings) {
      const t = q.life / q.max;
      const e = 1 - Math.pow(1 - t, 3);
      const rad = q.r0 + (q.r1 - q.r0) * e;
      const a = 1 - t;
      const sq = q.squash ?? 1;
      if (q.fill) g.ellipse(q.x, q.y, rad, rad * sq).fill({ color: q.c, alpha: a * 0.9 });
      else g.ellipse(q.x, q.y, rad, rad * sq).stroke({ color: q.c, width: Math.max(0.5, q.w * (1 - t)), alpha: a });
    }
    for (const s of this.spikes) {
      const t = s.life / s.max;
      const len = s.len * (0.5 + 0.5 * Math.min(1, t * 3));
      const w = s.w * (1 - t);
      for (let i = 0; i < s.n; i++) {
        const a = s.rot + (i / s.n) * Math.PI * 2;
        const l = len * (i % 2 ? 0.65 : 1);
        const cx = Math.cos(a);
        const sy = Math.sin(a);
        g.poly([s.x - sy * w, s.y + cx * w, s.x + cx * l, s.y + sy * l, s.x + sy * w, s.y - cx * w]).fill({ color: s.c, alpha: 1 - t });
      }
    }
    for (const p of this.parts) {
      const t = p.life / p.max;
      const a = 1 - t;
      switch (p.kind) {
        case 'streak': {
          const k = 0.035;
          g.moveTo(p.x, p.y).lineTo(p.x - p.vx * k, p.y - p.vy * k).stroke({ color: p.c, width: p.size * (1 - t * 0.6), alpha: a, cap: 'round' });
          break;
        }
        case 'shard': {
          const s = p.size;
          const c = Math.cos(p.rot);
          const sn = Math.sin(p.rot);
          g.poly([p.x + c * s, p.y + sn * s, p.x - sn * s * 0.5, p.y + c * s * 0.5, p.x - c * s * 0.7, p.y - sn * s * 0.7]).fill({ color: p.c, alpha: a });
          break;
        }
        case 'dust':
          g.circle(p.x, p.y, p.size * (0.6 + t)).fill({ color: p.c, alpha: a * 0.4 });
          break;
        case 'smoke':
          g.circle(p.x, p.y, p.size * (0.7 + t * 1.2)).fill({ color: p.c, alpha: a * 0.35 });
          break;
        case 'dot':
          g.circle(p.x, p.y, p.size).fill({ color: p.c, alpha: a });
          break;
      }
    }
  }
}
