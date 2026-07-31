/** Smooth, auto-framing camera. Maps fixed-point world coords to screen px.
 *  Camera math is cosmetic only — never feeds back into the sim. */

import { FIXED_SCALE } from '../sim/fixed';

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export class Camera {
  cx = 0; // world center x (fixed units / FIXED_SCALE -> we store in float world units)
  cy = 0;
  viewH = 16; // world units visible vertically
  // targets for smoothing
  private tcx = 0;
  private tcy = 0;
  private tViewH = 16;
  shakeX = 0;
  shakeY = 0;
  /** Vertical framing bias as a fraction of viewH (>0 shifts action upward on
   *  screen). Used for small cosmetic nudges. */
  biasY = 0;
  /** Screen pixels occluded by UI: the HUD cards on top, the planning panel
   *  below. The camera fits the action into the clear band between them and
   *  centres it there, so fighters are never drawn underneath either. */
  insetBottom = 0;
  insetTop = 0;
  private shakeMag = 0;

  screenW = 800;
  screenH = 600;

  resize(w: number, h: number) {
    this.screenW = w;
    this.screenH = h;
  }

  /** Instantly snap (used at planning start). */
  snapTo(b: Bounds, padX: number, padY: number) {
    this.computeTarget(b, padX, padY);
    this.cx = this.tcx;
    this.cy = this.tcy;
    this.viewH = this.tViewH;
  }

  setTarget(b: Bounds, padX: number, padY: number) {
    this.computeTarget(b, padX, padY);
  }

  private computeTarget(b: Bounds, padX: number, padY: number) {
    const aspect = this.screenW / this.screenH;
    const w = Math.max(b.maxX - b.minX + padX * 2, 6);
    const h = Math.max(b.maxY - b.minY + padY * 2, 4);

    // Only the band between the HUD and the planning panel is really visible.
    // Zoom to fit that band rather than the full canvas. Cap the total inset so
    // a huge panel can't collapse the band to nothing.
    const maxInset = this.screenH * 0.8;
    let insetT = Math.max(0, this.insetTop);
    let insetB = Math.max(0, this.insetBottom);
    const total = insetT + insetB;
    if (total > maxInset && total > 0) {
      const k = maxInset / total;
      insetT *= k;
      insetB *= k;
    }
    const visH = Math.max(this.screenH - insetT - insetB, 1);

    const viewHByH = (h * this.screenH) / visH; // fit height into the clear band
    const viewHByW = w / aspect; // full width is never occluded
    this.tViewH = Math.max(viewHByH, viewHByW);

    // Re-centre on the clear band: shift by half the *difference* of the two
    // insets, converted from pixels into world units.
    const shift = ((insetB - insetT) * this.tViewH) / (2 * this.screenH);
    this.tcx = (b.minX + b.maxX) / 2;
    this.tcy = (b.minY + b.maxY) / 2 + shift + this.biasY * this.tViewH;
  }

  addShake(mag: number) {
    this.shakeMag = Math.min(this.shakeMag + mag, 0.9);
  }

  update(dt: number) {
    const k = 1 - Math.pow(0.0008, dt); // smoothing factor
    this.cx += (this.tcx - this.cx) * k;
    this.cy += (this.tcy - this.cy) * k;
    this.viewH += (this.tViewH - this.viewH) * k;
    // shake
    this.shakeMag *= Math.pow(0.0005, dt);
    if (this.shakeMag < 0.001) this.shakeMag = 0;
    const ang = Math.random() * Math.PI * 2;
    this.shakeX = Math.cos(ang) * this.shakeMag;
    this.shakeY = Math.sin(ang) * this.shakeMag;
  }

  get scale(): number {
    return this.screenH / this.viewH;
  }

  /** fixed-point world -> screen pixel. */
  toScreenX(fx: number): number {
    const wx = fx / FIXED_SCALE;
    return (wx - (this.cx + this.shakeX)) * this.scale + this.screenW / 2;
  }
  toScreenY(fy: number): number {
    const wy = fy / FIXED_SCALE;
    return (wy - (this.cy + this.shakeY)) * this.scale + this.screenH / 2;
  }
  /** world-units length -> pixels. */
  len(units: number): number {
    return units * this.scale;
  }
  fxLen(fixedLen: number): number {
    return (fixedLen / FIXED_SCALE) * this.scale;
  }

  /** screen px -> world fixed. */
  toWorldX(px: number): number {
    return ((px - this.screenW / 2) / this.scale + this.cx) * FIXED_SCALE;
  }
  toWorldY(px: number): number {
    return ((px - this.screenH / 2) / this.scale + this.cy) * FIXED_SCALE;
  }
}
