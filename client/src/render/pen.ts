/**
 * A tiny drawing interface with two back ends: PixiJS Graphics for the arena
 * and Canvas2D for DOM portraits (character select, move list). The figure
 * renderer only talks to this, so fighters look identical everywhere.
 */

import type { Graphics } from 'pixi.js';

export interface Stroke {
  w: number;
  c: number;
  a?: number;
}

export interface Pen {
  /** Round-capped polyline. */
  line(pts: number[], w: number, c: number, a?: number): void;
  circle(x: number, y: number, r: number, fill: number | null, a?: number, stroke?: Stroke): void;
  ellipse(x: number, y: number, rx: number, ry: number, fill: number | null, a?: number, stroke?: Stroke): void;
  poly(pts: number[], fill: number | null, a?: number, stroke?: Stroke): void;
  rect(x: number, y: number, w: number, h: number, fill: number, a?: number): void;
  roundRect(x: number, y: number, w: number, h: number, r: number, fill: number | null, a?: number, stroke?: Stroke): void;
  /** Arc stroke from a0 to a1 (radians). */
  arc(x: number, y: number, r: number, a0: number, a1: number, w: number, c: number, a?: number): void;
}

export class PixiPen implements Pen {
  constructor(public g: Graphics) {}

  line(pts: number[], w: number, c: number, a = 1) {
    if (pts.length < 4) return;
    const g = this.g;
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.stroke({ width: w, color: c, alpha: a, cap: 'round', join: 'round' });
  }

  circle(x: number, y: number, r: number, fill: number | null, a = 1, stroke?: Stroke) {
    if (r <= 0) return;
    const g = this.g;
    g.beginPath();
    g.circle(x, y, r);
    if (fill !== null) g.fill({ color: fill, alpha: a });
    if (stroke) g.stroke({ width: stroke.w, color: stroke.c, alpha: stroke.a ?? 1 });
  }

  ellipse(x: number, y: number, rx: number, ry: number, fill: number | null, a = 1, stroke?: Stroke) {
    if (rx <= 0 || ry <= 0) return;
    const g = this.g;
    g.beginPath();
    g.ellipse(x, y, rx, ry);
    if (fill !== null) g.fill({ color: fill, alpha: a });
    if (stroke) g.stroke({ width: stroke.w, color: stroke.c, alpha: stroke.a ?? 1 });
  }

  poly(pts: number[], fill: number | null, a = 1, stroke?: Stroke) {
    if (pts.length < 6) return;
    const g = this.g;
    g.beginPath();
    g.poly(pts, true);
    if (fill !== null) g.fill({ color: fill, alpha: a });
    if (stroke) g.stroke({ width: stroke.w, color: stroke.c, alpha: stroke.a ?? 1, join: 'round' });
  }

  rect(x: number, y: number, w: number, h: number, fill: number, a = 1) {
    const g = this.g;
    g.beginPath();
    g.rect(x, y, w, h);
    g.fill({ color: fill, alpha: a });
  }

  roundRect(x: number, y: number, w: number, h: number, r: number, fill: number | null, a = 1, stroke?: Stroke) {
    const g = this.g;
    g.beginPath();
    g.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
    if (fill !== null) g.fill({ color: fill, alpha: a });
    if (stroke) g.stroke({ width: stroke.w, color: stroke.c, alpha: stroke.a ?? 1 });
  }

  arc(x: number, y: number, r: number, a0: number, a1: number, w: number, c: number, a = 1) {
    if (r <= 0) return;
    const g = this.g;
    g.beginPath();
    g.arc(x, y, r, a0, a1, a1 < a0);
    g.stroke({ width: w, color: c, alpha: a, cap: 'round' });
  }
}

const css = (c: number, a = 1) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;

export class CanvasPen implements Pen {
  constructor(public ctx: CanvasRenderingContext2D) {}

  line(pts: number[], w: number, c: number, a = 1) {
    if (pts.length < 4) return;
    const x = this.ctx;
    x.beginPath();
    x.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]);
    x.lineCap = 'round';
    x.lineJoin = 'round';
    x.lineWidth = w;
    x.strokeStyle = css(c, a);
    x.stroke();
  }

  private finish(fill: number | null, a: number, stroke?: Stroke) {
    const x = this.ctx;
    if (fill !== null) {
      x.fillStyle = css(fill, a);
      x.fill();
    }
    if (stroke) {
      x.lineWidth = stroke.w;
      x.strokeStyle = css(stroke.c, stroke.a ?? 1);
      x.lineJoin = 'round';
      x.stroke();
    }
  }

  circle(cx: number, cy: number, r: number, fill: number | null, a = 1, stroke?: Stroke) {
    if (r <= 0) return;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this.finish(fill, a, stroke);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, fill: number | null, a = 1, stroke?: Stroke) {
    if (rx <= 0 || ry <= 0) return;
    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    this.finish(fill, a, stroke);
  }

  poly(pts: number[], fill: number | null, a = 1, stroke?: Stroke) {
    if (pts.length < 6) return;
    const x = this.ctx;
    x.beginPath();
    x.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]);
    x.closePath();
    this.finish(fill, a, stroke);
  }

  rect(x0: number, y0: number, w: number, h: number, fill: number, a = 1) {
    this.ctx.fillStyle = css(fill, a);
    this.ctx.fillRect(x0, y0, w, h);
  }

  roundRect(x0: number, y0: number, w: number, h: number, r: number, fill: number | null, a = 1, stroke?: Stroke) {
    const x = this.ctx;
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    x.beginPath();
    x.moveTo(x0 + rr, y0);
    x.arcTo(x0 + w, y0, x0 + w, y0 + h, rr);
    x.arcTo(x0 + w, y0 + h, x0, y0 + h, rr);
    x.arcTo(x0, y0 + h, x0, y0, rr);
    x.arcTo(x0, y0, x0 + w, y0, rr);
    x.closePath();
    this.finish(fill, a, stroke);
  }

  arc(cx: number, cy: number, r: number, a0: number, a1: number, w: number, c: number, a = 1) {
    if (r <= 0) return;
    const x = this.ctx;
    x.beginPath();
    x.arc(cx, cy, r, a0, a1, a1 < a0);
    x.lineCap = 'round';
    x.lineWidth = w;
    x.strokeStyle = css(c, a);
    x.stroke();
  }
}
