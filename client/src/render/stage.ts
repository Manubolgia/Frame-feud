/**
 * Procedural stage art: a gradient sky, parallax silhouettes, the arena
 * floor and walls, and ambient particles. Everything is vector, built once
 * per stage; per frame only container transforms and particles change.
 */

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { StageDef } from '../sim/types';
import { darken, lighten, mix } from './color';
import type { Camera } from './camera';

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  s: number;
  r: number;
  vr: number;
  life: number;
}

interface Theme {
  sky: [number, string][];
  ambient: 'petals' | 'rain' | 'embers' | 'none';
  rim: number;
  /** Fighter halo alpha for readability on this background. */
  halo: number;
  shadow: number;
}

const THEMES: Record<StageDef['theme'], Theme> = {
  dojo: { sky: [[0, '#1d1638'], [0.45, '#7a3b63'], [0.78, '#e8805e'], [1, '#ffd9a0']], ambient: 'petals', rim: 0xffe2b8, halo: 0.18, shadow: 0x2a1410 },
  rooftop: { sky: [[0, '#03050d'], [0.55, '#0d1430'], [0.85, '#251a4a'], [1, '#3c2156']], ambient: 'rain', rim: 0x9fe8ff, halo: 0.26, shadow: 0x000000 },
  forge: { sky: [[0, '#0b0518'], [0.5, '#2c0f4f'], [0.85, '#7a2a77'], [1, '#c2477a']], ambient: 'embers', rim: 0xffb3ff, halo: 0.24, shadow: 0x12051f },
  lab: { sky: [[0, '#e9ecf2'], [1, '#d4d8e1']], ambient: 'none', rim: 0xffffff, halo: 0.0, shadow: 0x7f8594 },
};

/** Tiny seeded RNG so stage art is identical every time. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5) >>> 0;
    return s / 4294967296;
  };
}

function gradientTexture(stops: [number, string][]): Texture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 512;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, 512);
  for (const [t, col] of stops) g.addColorStop(t, col);
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 512);
  return Texture.from(c);
}

export class StageView {
  readonly def: StageDef;
  readonly theme: Theme;
  /** Screen-space layers (added behind the world container). */
  back = new Container();
  /** World-space floor/walls (inside the world container, behind fighters). */
  world = new Graphics();
  /** World-space overlays in front of fighters. */
  front = new Graphics();
  /** Screen-space ambient particles (in front of everything world). */
  ambient = new Graphics();

  private sky = new Sprite();
  private far = new Container();
  private mid = new Container();
  private farG = new Graphics();
  private midG = new Graphics();
  /** Stars and nebulae across the whole screen. */
  private sun = new Graphics();
  /** The sun or moon, drawn around (0, 0) and placed over the fight area. */
  private orb = new Graphics();
  private motes: Mote[] = [];
  private time = 0;
  private lastW = 0;
  private lastH = 0;
  private lastOrb = 0;

  constructor(def: StageDef) {
    this.def = def;
    this.theme = THEMES[def.theme];
    this.sky.texture = gradientTexture(this.theme.sky);
    this.far.addChild(this.farG);
    this.mid.addChild(this.midG);
    this.back.addChild(this.sky, this.sun, this.orb, this.far, this.mid);
    this.buildFar();
    this.buildMid();
    this.buildWorld();
  }

  destroy() {
    this.back.destroy({ children: true });
    this.world.destroy();
    this.front.destroy();
    this.ambient.destroy();
  }

  // ---------------------------------------------------------- layout --

  layout(cam: Camera) {
    const W = cam.screenW;
    const H = cam.screenH;
    this.sky.x = 0;
    this.sky.y = 0;
    this.sky.width = W;
    this.sky.height = H;
    const t = cam.transform();
    const floorY = t.y; // world y = 0 on screen
    const u = cam.bandH / 600;
    for (const [layer, par] of [
      [this.far, 0.12],
      [this.mid, 0.32],
    ] as [Container, number][]) {
      layer.scale.set(u * (0.85 + par * 0.6));
      layer.x = cam.band.left + cam.bandW / 2 - cam.x * t.s * par;
      layer.y = floorY - (cam.y + 160) * t.s * par * 0.4 + (layer === this.far ? -u * 6 : 0);
    }
    if (W !== this.lastW || H !== this.lastH) {
      this.lastW = W;
      this.lastH = H;
      this.drawSky(W, H);
      if (this.motes.length === 0) this.seedMotes(W, H);
    }
    // The sun / moon sits over the fight area (not the whole screen, which on
    // a phone is half panel), low over the horizon, drifting with the camera.
    const orbR = Math.round(Math.min(cam.bandW, cam.bandH) * (this.def.theme === 'dojo' ? 0.12 : 0.07));
    if (orbR !== this.lastOrb) {
      this.lastOrb = orbR;
      this.drawOrb(orbR);
    }
    const dx = -cam.x * t.s * 0.03;
    const dy = -(cam.y + 160) * t.s * 0.03;
    this.sun.x = dx;
    this.sun.y = dy;
    if (this.def.theme === 'dojo') {
      this.orb.x = cam.band.left + cam.bandW * 0.3 + dx;
      this.orb.y = Math.max(cam.band.top + orbR * 1.5, floorY - cam.bandH * 0.36) + dy;
    } else {
      this.orb.x = cam.band.left + cam.bandW * 0.78 + dx;
      this.orb.y = cam.band.top + Math.max(orbR * 2, cam.bandH * 0.18) + dy;
    }
  }

  // ---------------------------------------------------------- sky --

  private drawSky(W: number, H: number) {
    const g = this.sun;
    g.clear();
    const R = rng(7);
    switch (this.def.theme) {
      case 'rooftop':
        for (let i = 0; i < 180; i++) {
          const sx = R() * W;
          const sy = R() * H * 0.6;
          g.circle(sx, sy, R() < 0.1 ? 1.4 : 0.8).fill({ color: 0xffffff, alpha: 0.25 + R() * 0.6 });
        }
        break;
      case 'forge':
        for (let i = 0; i < 120; i++) g.circle(R() * W, R() * H * 0.5, R() * 1.2 + 0.4).fill({ color: 0xffd6ff, alpha: 0.2 + R() * 0.5 });
        // nebula
        for (let i = 0; i < 9; i++) {
          g.ellipse(W * (0.15 + R() * 0.7), H * (0.12 + R() * 0.3), W * (0.12 + R() * 0.2), H * (0.05 + R() * 0.08)).fill({ color: R() < 0.5 ? 0xff5fd2 : 0x6b5cff, alpha: 0.06 });
        }
        break;
    }
  }

  private drawOrb(r: number) {
    const g = this.orb;
    g.clear();
    const R = rng(7);
    switch (this.def.theme) {
      case 'dojo': {
        for (let i = 6; i >= 1; i--) g.circle(0, 0, r * (1 + i * 0.35)).fill({ color: 0xffd7a0, alpha: 0.05 });
        g.circle(0, 0, r).fill({ color: 0xfff1cf, alpha: 0.95 });
        // streaky clouds across the sun
        for (let i = 0; i < 5; i++) {
          const cy = -r * 0.6 + i * r * 0.32;
          g.roundRect(-r * (1.6 + R()), cy, r * (2.4 + R() * 1.4), r * 0.09, r * 0.05).fill({ color: 0xc8607a, alpha: 0.35 });
        }
        break;
      }
      case 'rooftop': {
        for (let i = 5; i >= 1; i--) g.circle(0, 0, r * (1 + i * 0.5)).fill({ color: 0x9ab4ff, alpha: 0.04 });
        g.circle(0, 0, r).fill({ color: 0xeef3ff });
        g.circle(-r * 0.3, -r * 0.15, r * 0.22).fill({ color: 0xc9d4ef, alpha: 0.8 });
        g.circle(r * 0.25, r * 0.3, r * 0.15).fill({ color: 0xc9d4ef, alpha: 0.8 });
        break;
      }
    }
  }

  // ---------------------------------------------------------- parallax --

  /** Far layer: units are ~1px at a 600px-tall band; y = 0 is the horizon. */
  private buildFar() {
    const g = this.farG;
    const R = rng(11);
    switch (this.def.theme) {
      case 'dojo': {
        ridge(g, R, -1600, 1600, -230, 120, 0x5d3561, 0.85, 16);
        // pagoda on the ridge
        pagoda(g, 360, -250, 0x46264b);
        ridge(g, R, -1600, 1600, -150, 90, 0x7a3f5f, 0.9, 22);
        g.rect(-1600, -120, 3200, 30).fill({ color: 0xffd7c0, alpha: 0.12 });
        ridge(g, R, -1600, 1600, -80, 60, 0x93485e, 0.95, 30);
        g.rect(-1600, -60, 3200, 70).fill({ color: 0xffc9a8, alpha: 0.1 });
        break;
      }
      case 'rooftop': {
        let x = -1700;
        while (x < 1700) {
          const w = 40 + R() * 90;
          const h = 80 + R() * 260;
          g.rect(x, -h, w, h + 40).fill({ color: 0x151b38 });
          for (let wy = -h + 10; wy < -10; wy += 14) {
            for (let wx = x + 6; wx < x + w - 8; wx += 12) {
              if (R() < 0.32) g.rect(wx, wy, 5, 7).fill({ color: R() < 0.8 ? 0xffd27a : 0x8fe8ff, alpha: 0.35 + R() * 0.4 });
            }
          }
          if (R() < 0.25) {
            g.rect(x + w / 2 - 1, -h - 40, 2, 40).fill({ color: 0x151b38 });
            g.circle(x + w / 2, -h - 40, 3).fill({ color: 0xff3b5c, alpha: 0.9 });
          }
          x += w + 4 + R() * 20;
        }
        break;
      }
      case 'forge': {
        // cloud banks
        for (let i = 0; i < 26; i++) {
          const cx = -1700 + i * 135 + R() * 60;
          g.ellipse(cx, -40 - R() * 50, 120 + R() * 80, 40 + R() * 24).fill({ color: 0xb14fa0, alpha: 0.35 });
        }
        // floating islands with crystals
        for (const [ix, iy, s] of [[-700, -260, 1], [520, -320, 0.8], [1180, -200, 0.6], [-1250, -330, 0.7]] as const) {
          island(g, ix, iy, s, R);
        }
        for (let i = 0; i < 30; i++) g.ellipse(-1700 + i * 120 + R() * 50, 20 - R() * 20, 140 + R() * 60, 34).fill({ color: 0xe07ab8, alpha: 0.25 });
        break;
      }
      case 'lab':
        break;
    }
  }

  private buildMid() {
    const g = this.midG;
    const R = rng(23);
    switch (this.def.theme) {
      case 'dojo': {
        // pines on both sides
        for (const side of [-1, 1]) {
          for (let i = 0; i < 7; i++) {
            const x = side * (620 + i * 130 + R() * 60);
            pine(g, x, 30, 0.8 + R() * 0.7, 0x2e1a35);
          }
        }
        break;
      }
      case 'rooftop': {
        let x = -1500;
        while (x < 1500) {
          const w = 90 + R() * 140;
          const h = 120 + R() * 220;
          g.rect(x, -h, w, h + 80).fill({ color: 0x0a0d1f });
          g.rect(x, -h, w, 3).fill({ color: 0x1f2747 });
          if (R() < 0.55) {
            const nc = [0x22e8ff, 0xff3bb4, 0xffd23b, 0x7cff6b][Math.floor(R() * 4)];
            const sw = 30 + R() * 40;
            const sx = x + R() * (w - sw);
            const sy = -h + 20 + R() * (h * 0.4);
            g.roundRect(sx - 4, sy - 4, sw + 8, 26, 8).fill({ color: nc, alpha: 0.12 });
            g.roundRect(sx, sy, sw, 18, 5).stroke({ color: nc, width: 2.5, alpha: 0.95 });
            g.rect(sx + 6, sy + 7, sw - 12, 3).fill({ color: nc, alpha: 0.85 });
          }
          for (let wy = -h + 14; wy < -10; wy += 22) {
            for (let wx = x + 10; wx < x + w - 14; wx += 20) if (R() < 0.18) g.rect(wx, wy, 8, 10).fill({ color: 0xffe2a8, alpha: 0.28 });
          }
          x += w + 10 + R() * 40;
        }
        break;
      }
      case 'forge': {
        for (let i = 0; i < 12; i++) {
          const cx = -1500 + i * 260 + R() * 100;
          g.ellipse(cx, 30, 200 + R() * 120, 60 + R() * 20).fill({ color: 0xd889c4, alpha: 0.28 });
        }
        break;
      }
      case 'lab':
        break;
    }
  }

  // ---------------------------------------------------------- arena --

  private buildWorld() {
    const g = this.world;
    const hw = this.def.halfWidth;
    const top = -this.def.ceiling - 200;
    const R = rng(31);
    const span = hw + 1400;
    switch (this.def.theme) {
      case 'dojo': {
        // floor surface + front face
        g.rect(-span, 0, span * 2, 64).fill({ color: 0x8a5233 });
        for (let i = 0; i < 6; i++) g.rect(-span, i * 11, span * 2, 11).fill({ color: mix(0xc4834f, 0x6a3a22, i / 5), alpha: 0.9 });
        for (let x = -span; x < span; x += 90) {
          const s = x / 900;
          g.moveTo(x, 0).lineTo(x + s * 60, 64).stroke({ color: 0x4d2a17, width: 2, alpha: 0.45 });
        }
        g.rect(-span, 0, span * 2, 3).fill({ color: 0xffe0b0, alpha: 0.6 });
        g.rect(-span, 64, span * 2, 1400).fill({ color: 0x2b170e });
        g.rect(-span, 64, span * 2, 8).fill({ color: 0x12090a, alpha: 0.6 });
        // walls: lacquered pillars and paper screens outside the arena
        for (const side of [-1, 1]) {
          const x0 = side * hw;
          const out = side;
          g.rect(Math.min(x0 + out * 30, x0 + out * 520), top, 490, -top).fill({ color: 0x3b2018 });
          for (let k = 0; k < 4; k++) {
            const px0 = x0 + out * (70 + k * 115);
            g.rect(Math.min(px0, px0 + out * 100), -420, 100, 410).fill({ color: 0xf2dfbd, alpha: 0.9 });
            for (let ly = -420; ly < -10; ly += 34) g.rect(Math.min(px0, px0 + out * 100), ly, 100, 2).fill({ color: 0x6b4630, alpha: 0.6 });
            for (let lx = 0; lx <= 100; lx += 25) g.rect(Math.min(px0, px0 + out * 100) + lx - 1, -420, 2, 410).fill({ color: 0x6b4630, alpha: 0.6 });
          }
          // the pillar the fighters bump into
          const pw = 38;
          const px1 = side > 0 ? x0 : x0 - pw;
          g.rect(px1, top, pw, -top).fill({ color: 0xb3262d });
          g.rect(px1 + (side > 0 ? 4 : pw - 12), top, 8, -top).fill({ color: 0xe0545a, alpha: 0.7 });
          g.rect(px1 - 6, -26, pw + 12, 26).fill({ color: 0x1d0f0b });
          g.rect(px1 - 4, -560, pw + 8, 18).fill({ color: 0xd9a441 });
          // lantern
          const lx = x0 - side * 70;
          g.moveTo(lx, top).lineTo(lx, -520).stroke({ color: 0x1d0f0b, width: 2 });
          g.roundRect(lx - 16, -520, 32, 46, 14).fill({ color: 0xe8443a });
          g.roundRect(lx - 16, -520, 32, 46, 14).stroke({ color: 0x5a1612, width: 2 });
          g.circle(lx, -497, 40).fill({ color: 0xffb070, alpha: 0.12 });
        }
        break;
      }
      case 'rooftop': {
        g.rect(-span, 0, span * 2, 60).fill({ color: 0x2a2e3c });
        for (let i = 0; i < 5; i++) g.rect(-span, i * 12, span * 2, 12).fill({ color: mix(0x4a5068, 0x23262f, i / 4), alpha: 0.9 });
        g.rect(-span, 0, span * 2, 2).fill({ color: 0x9fe8ff, alpha: 0.35 });
        for (let x = -span; x < span; x += 160) g.moveTo(x, 0).lineTo(x + (x / 1000) * 40, 60).stroke({ color: 0x15171f, width: 2, alpha: 0.6 });
        // puddles with neon reflections
        for (let i = 0; i < 9; i++) {
          const px0 = -hw + R() * hw * 2;
          const pw = 50 + R() * 90;
          g.ellipse(px0, 18 + R() * 30, pw, 6 + R() * 4).fill({ color: 0x0d1020, alpha: 0.8 });
          g.ellipse(px0 + pw * 0.2, 20 + R() * 26, pw * 0.4, 2).fill({ color: R() < 0.5 ? 0x22e8ff : 0xff3bb4, alpha: 0.35 });
        }
        // parapet face
        g.rect(-span, 60, span * 2, 1400).fill({ color: 0x14161f });
        for (let x = -span; x < span; x += 46) g.rect(x, 60, 2, 300).fill({ color: 0x0b0c12, alpha: 0.8 });
        g.rect(-span, 60, span * 2, 6).fill({ color: 0x3a3f52 });
        // walls: stair housings with signs
        for (const side of [-1, 1]) {
          const x0 = side * hw;
          const bx = side > 0 ? x0 : x0 - 260;
          g.rect(bx, -300, 260, 300).fill({ color: 0x1c1f2b });
          g.rect(bx, -300, 260, 8).fill({ color: 0x343a50 });
          const dx = side > 0 ? bx + 40 : bx + 260 - 110;
          g.rect(dx, -170, 70, 170).fill({ color: 0x10121a });
          g.rect(dx + 52, -90, 6, 6).fill({ color: 0xc9b06a });
          const nc = side > 0 ? 0xff3bb4 : 0x22e8ff;
          const sx = side > 0 ? bx + 130 : bx + 20;
          g.roundRect(sx - 6, -268, 112, 64, 14).fill({ color: nc, alpha: 0.15 });
          g.roundRect(sx, -262, 100, 52, 9).stroke({ color: nc, width: 4 });
          g.moveTo(sx + 20, -248).lineTo(sx + 40, -224).lineTo(sx + 60, -248).lineTo(sx + 80, -224).stroke({ color: nc, width: 4, alpha: 0.95 });
          // antenna
          const ax = side > 0 ? bx + 220 : bx + 40;
          g.rect(ax - 2, -480, 4, 180).fill({ color: 0x272b3a });
          g.circle(ax, -480, 5).fill({ color: 0xff3b5c });
          g.circle(ax, -480, 16).fill({ color: 0xff3b5c, alpha: 0.18 });
          // fence beyond
          g.rect(bx + (side > 0 ? 260 : -500), -140, 500, 140).fill({ color: 0x0f111a, alpha: 0.7 });
        }
        break;
      }
      case 'forge': {
        const pw = hw + 70;
        // underside fading into the clouds
        g.poly([-pw, 0, pw, 0, pw - 80, 150, 260, 230, -260, 230, -pw + 80, 150]).fill({ color: 0x1c1233 });
        g.rect(-pw, 0, pw * 2, 46).fill({ color: 0x3a2d66 });
        for (let i = 0; i < 4; i++) g.rect(-pw, i * 11, pw * 2, 11).fill({ color: mix(0x5b4a99, 0x2a1f4d, i / 3), alpha: 0.95 });
        g.rect(-pw, 0, pw * 2, 2).fill({ color: 0xf0b8ff, alpha: 0.8 });
        for (let x = -pw + 40; x < pw; x += 120) {
          g.rect(x, 4, 2, 38).fill({ color: 0xc06bff, alpha: 0.65 });
          g.circle(x + 1, 52, 3).fill({ color: 0xff6bd6 });
        }
        g.rect(-pw, 44, pw * 2, 4).fill({ color: 0xff6bd6, alpha: 0.6 });
        // thrusters under the platform
        for (const tx of [-pw + 160, 0, pw - 160]) {
          g.roundRect(tx - 30, 150, 60, 40, 8).fill({ color: 0x2a1f4d });
          g.ellipse(tx, 200, 22, 30).fill({ color: 0xff8ae0, alpha: 0.35 });
          g.ellipse(tx, 196, 10, 16).fill({ color: 0xffffff, alpha: 0.6 });
        }
        // barrier pylons
        for (const side of [-1, 1]) {
          const x0 = side * hw;
          const px0 = side > 0 ? x0 : x0 - 34;
          g.roundRect(px0, -260, 34, 260, 8).fill({ color: 0x2b2050 });
          g.roundRect(px0 + 8, -250, 18, 240, 6).fill({ color: 0x4f3a8f });
          g.circle(px0 + 17, -272, 14).fill({ color: 0xff6bd6 });
          g.circle(px0 + 17, -272, 30).fill({ color: 0xff6bd6, alpha: 0.18 });
          // energy curtain above
          for (let i = 0; i < 6; i++) g.rect(px0 + 12 + i * 2, top, 2, -top - 270).fill({ color: 0xff8ae0, alpha: 0.06 + i * 0.02 });
        }
        break;
      }
      case 'lab': {
        // grid wall behind the arena
        const gs = 50;
        for (let x = -span; x <= span; x += gs) g.rect(x, top, x % 250 === 0 ? 2 : 1, -top).fill({ color: 0xaab0bd, alpha: x % 250 === 0 ? 0.7 : 0.35 });
        for (let y = 0; y >= top; y -= gs) g.rect(-span, y, span * 2, y % 250 === 0 ? 2 : 1).fill({ color: 0xaab0bd, alpha: y % 250 === 0 ? 0.7 : 0.35 });
        g.rect(-span, 0, span * 2, 1400).fill({ color: 0x3a3e4a });
        g.rect(-span, 0, span * 2, 4).fill({ color: 0x1d2028 });
        for (let x = -hw; x <= hw; x += 50) g.rect(x - 1, 4, 2, x % 250 === 0 ? 22 : 10).fill({ color: 0xd4d8e1, alpha: 0.8 });
        for (const side of [-1, 1]) {
          const x0 = side * hw;
          const bx = side > 0 ? x0 : x0 - 40;
          g.rect(bx, top, 40, -top).fill({ color: 0x2a2e38 });
          for (let y = -40; y > top; y -= 80) {
            g.poly([bx, y, bx + 40, y - 40, bx + 40, y - 20, bx, y + 20]).fill({ color: 0xffc83a, alpha: 0.9 });
          }
        }
        break;
      }
    }
  }

  // ---------------------------------------------------------- ambient --

  private seedMotes(W: number, H: number) {
    const n = this.theme.ambient === 'rain' ? 90 : this.theme.ambient === 'none' ? 0 : 34;
    for (let i = 0; i < n; i++) this.motes.push(this.newMote(W, H, true));
  }

  private newMote(W: number, H: number, anywhere: boolean): Mote {
    const a = this.theme.ambient;
    const r = Math.random;
    if (a === 'rain') return { x: r() * W * 1.2, y: anywhere ? r() * H : -20, vx: -120, vy: 900 + r() * 300, s: 10 + r() * 14, r: 0, vr: 0, life: 0 };
    if (a === 'embers') return { x: r() * W, y: anywhere ? r() * H : H + 10, vx: (r() - 0.5) * 20, vy: -(30 + r() * 60), s: 1 + r() * 2.2, r: r() * 6, vr: 0, life: r() * 10 };
    return { x: anywhere ? r() * W : W + 20, y: r() * H * 0.9, vx: -(40 + r() * 70), vy: 18 + r() * 30, s: 3 + r() * 3, r: r() * 6, vr: (r() - 0.5) * 4, life: r() * 10 };
  }

  update(dt: number, cam: Camera, reduced: boolean) {
    this.time += dt;
    const g = this.ambient;
    g.clear();
    if (reduced || this.theme.ambient === 'none') return;
    const W = cam.screenW;
    const H = cam.screenH;
    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i];
      m.life += dt;
      m.x += m.vx * dt + Math.sin(m.life * 1.7) * (this.theme.ambient === 'petals' ? 18 : 6) * dt;
      m.y += m.vy * dt;
      m.r += m.vr * dt;
      const off = m.x < -40 || m.y > H + 30 || m.y < -40;
      if (off) {
        this.motes[i] = this.newMote(W, H, false);
        continue;
      }
      switch (this.theme.ambient) {
        case 'rain':
          g.moveTo(m.x, m.y).lineTo(m.x + m.vx * 0.012, m.y + m.s).stroke({ color: 0x9fc8ff, width: 1, alpha: 0.28 });
          break;
        case 'embers':
          g.circle(m.x, m.y, m.s).fill({ color: 0xffa6f0, alpha: 0.45 + 0.4 * Math.sin(m.life * 3 + m.r) });
          break;
        case 'petals':
          g.ellipse(m.x, m.y, m.s * (0.6 + 0.4 * Math.abs(Math.sin(m.r))), m.s * 0.55).fill({ color: 0xffb3c8, alpha: 0.85 });
          break;
      }
    }
  }
}

// ------------------------------------------------------------ shapes --

function ridge(g: Graphics, R: () => number, x0: number, x1: number, base: number, amp: number, color: number, alpha: number, step: number) {
  const pts: number[] = [x0, 200];
  let y = base;
  for (let x = x0; x <= x1; x += step) {
    y += (R() - 0.5) * amp * 0.35;
    y = Math.max(base - amp, Math.min(base + amp * 0.3, y));
    pts.push(x, y);
  }
  pts.push(x1, 200);
  g.poly(pts).fill({ color, alpha });
}

function pagoda(g: Graphics, x: number, y: number, c: number) {
  for (let i = 0; i < 4; i++) {
    const w = 46 - i * 9;
    const yy = y - i * 22;
    g.poly([x - w, yy, x + w, yy, x + w * 0.7, yy - 8, x - w * 0.7, yy - 8]).fill({ color: c });
    g.rect(x - w * 0.5, yy - 22, w, 14).fill({ color: c });
  }
  g.rect(x - 1.5, y - 110, 3, 24).fill({ color: c });
}

function pine(g: Graphics, x: number, y: number, s: number, c: number) {
  g.rect(x - 5 * s, y - 60 * s, 10 * s, 70 * s).fill({ color: darken(c, 0.2) });
  for (let i = 0; i < 4; i++) {
    const w = (70 - i * 14) * s;
    const yy = y - (60 + i * 42) * s;
    g.poly([x - w, yy + 24 * s, x + w, yy + 24 * s, x + w * 0.2, yy - 30 * s, x - w * 0.3, yy - 26 * s]).fill({ color: c });
  }
}

function island(g: Graphics, x: number, y: number, s: number, R: () => number) {
  g.poly([x - 130 * s, y, x + 140 * s, y, x + 60 * s, y + 70 * s, x - 10 * s, y + 130 * s, x - 70 * s, y + 60 * s]).fill({ color: 0x2a1640 });
  g.rect(x - 130 * s, y - 6 * s, 270 * s, 8 * s).fill({ color: 0x4a2a6a });
  for (let i = 0; i < 5; i++) {
    const cx = x - 90 * s + i * 45 * s + R() * 10;
    const h = (20 + R() * 40) * s;
    g.poly([cx - 8 * s, y - 4 * s, cx, y - h, cx + 8 * s, y - 4 * s]).fill({ color: lighten(0xb36bff, R() * 0.3), alpha: 0.9 });
  }
  g.ellipse(x, y - 20 * s, 120 * s, 40 * s).fill({ color: 0xb36bff, alpha: 0.08 });
}
