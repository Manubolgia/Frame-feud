/** Draws a fighter into a DOM canvas with the same figure renderer the arena
 *  uses: character select portraits, results screen, move list. */

import { L, P, sampleAnim, type Pose } from '../content/poses';
import { CHARACTERS } from '../content/roster';
import { clothAnchors, clothSpec, drawFigure, makeCloth, solve, stepCloth, type FigureCloth } from '../render/figure';
import { CanvasPen } from '../render/pen';

export class Portrait {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pen: CanvasPen;
  char: string;
  palette: number;
  private cloth: FigureCloth = {};
  private t = 0;
  private raf = 0;
  private last = 0;
  pose: 'idle' | 'victory' | 'ko' | string = 'idle';
  facing: 1 | -1;
  /** Move animation to loop instead of idling. */
  move: string | null = null;
  /** Explicit [main, trim, glow] (family colours) instead of a palette. */
  colors: [number, number, number] | null = null;

  constructor(char: string, palette: number, facing: 1 | -1 = 1, cls = 'portrait') {
    this.canvas = document.createElement('canvas');
    this.canvas.className = cls;
    this.ctx = this.canvas.getContext('2d')!;
    this.pen = new CanvasPen(this.ctx);
    this.char = char;
    this.palette = palette;
    this.facing = facing;
  }

  set(char: string, palette: number, colors: [number, number, number] | null = null) {
    if (char !== this.char) this.cloth = {};
    this.char = char;
    this.palette = palette;
    this.colors = colors;
    this.draw();
  }

  start() {
    const loop = (ms: number) => {
      const dt = this.last ? Math.min(0.05, (ms - this.last) / 1000) : 0.016;
      this.last = ms;
      this.t += dt;
      this.draw(dt);
      this.raf = requestAnimationFrame(loop);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  draw(dt = 0) {
    const c = this.canvas;
    const r = c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(10, Math.round((r.width || 200) * dpr));
    const h = Math.max(10, Math.round((r.height || 260) * dpr));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const x = this.ctx;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, w, h);
    const def = CHARACTERS[this.char];
    if (!def) return;
    const pal = this.colors ?? def.palettes[this.palette % def.palettes.length];
    // a raised fist needs headroom above the figure
    const scale = (h * (this.pose === 'victory' && !this.move ? 0.62 : 0.74)) / 128;
    const floor = h * 0.92;
    const cx = w / 2;
    let pose: Pose = def.stance;
    let grounded = true;
    let spin = 0;
    let prop = undefined as undefined | 'blade' | 'orb' | 'gun' | 'none';
    if (this.move && def.moves[this.move]) {
      const m = def.moves[this.move];
      const f = (this.t * 60) % (m.total + 24);
      pose = sampleAnim(m.anim, Math.min(f, m.total));
      prop = m.anim.prop;
      grounded = m.where !== 'air';
      if (m.anim.spin && f >= m.anim.spin.f0 && f <= m.anim.spin.f1) spin = ((f - m.anim.spin.f0) / (m.anim.spin.f1 - m.anim.spin.f0)) * m.anim.spin.deg;
    } else if (this.pose === 'victory') {
      pose = P(def.stance, { fs: 135, fe: 50, bs: 20, be: 60, torso: 0, head: -10, fh: 16, fk: 8, bh: -14, bk: 8 });
    } else if (this.pose === 'ko') {
      pose = L.lying;
    } else {
      const b = Math.sin(this.t * 2.4) * 2;
      pose = P(def.stance, { torso: def.stance.torso + b * 0.6, fs: def.stance.fs + b, bs: def.stance.bs + b * 0.7 });
      if (def.build.kit === 'razor') prop = 'none';
    }
    // floor shadow
    x.fillStyle = 'rgba(0,0,0,0.35)';
    x.beginPath();
    x.ellipse(cx, floor + 2 * scale, def.width * 1.8 * scale, def.width * 0.4 * scale, 0, 0, Math.PI * 2);
    x.fill();
    const j = solve(def.build, pose, cx, grounded ? floor : floor - 40 * scale, this.facing, grounded, spin, null, scale);
    const an = clothAnchors(j, def.build);
    const spec = clothSpec(def.build.kit);
    if (an.a) {
      if (!this.cloth.a) this.cloth.a = makeCloth(spec.a![0], spec.a![1] * scale, an.a[0], an.a[1]);
      stepCloth(this.cloth.a, an.a[0], an.a[1], dt || 0.016, -this.facing * (240 + Math.sin(this.t * 1.7) * 160) * scale, 700 * scale, floor);
    }
    if (an.b) {
      if (!this.cloth.b) this.cloth.b = makeCloth(spec.b![0], spec.b![1] * scale, an.b[0], an.b[1]);
      stepCloth(this.cloth.b, an.b[0], an.b[1], dt || 0.016, -this.facing * 200 * scale, 700 * scale, floor);
    }
    drawFigure(this.pen, j, def.build, { main: pal[0], trim: pal[1], glow: pal[2], time: this.t, prop, halo: { c: pal[2], a: 0.16, w: 6 } }, this.cloth);
  }
}
