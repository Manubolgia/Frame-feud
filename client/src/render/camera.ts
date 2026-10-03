/**
 * Fighting-game camera: frames both fighters inside the band of screen the
 * UI leaves free, keeps the floor low in frame, never shows far past the
 * walls, and adds shake and impact zoom. World units are pixels.
 */

export interface Band {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export class Camera {
  /** World point at the centre of the band. */
  x = 0;
  y = -160;
  /** World px visible across the screen width. */
  viewW = 900;
  private tx = 0;
  private ty = -160;
  private tw = 900;
  screenW = 800;
  screenH = 600;
  /** The screen area the fight is framed in (eases toward bandTo). */
  band: Band = { left: 0, top: 0, right: 800, bottom: 600 };
  private bandTo: Band | null = null;
  private snapBand = true;
  shake = 0;
  private shakeX = 0;
  private shakeY = 0;
  punch = 0;
  /** World half-width between the walls. */
  stageHalf = 700;

  resize(w: number, h: number) {
    if (w === this.screenW && h === this.screenH) return;
    this.screenW = w;
    this.screenH = h;
    // a new screen size (rotation, window resize) re-frames at once
    this.snapBand = true;
    if (this.bandTo) this.band = { ...this.bandTo };
  }

  /** Re-frame into a new screen area: eased when the HUD or panel changes size,
   * immediate the first time and after the screen itself resizes. */
  setBand(b: Band) {
    this.bandTo = b;
    if (this.snapBand) {
      this.band = { ...b };
      this.snapBand = false;
    }
  }

  get bandH(): number {
    return Math.max(80, this.band.bottom - this.band.top);
  }

  get bandW(): number {
    return Math.max(120, this.band.right - this.band.left);
  }

  /** Pixels per world px. */
  get scale(): number {
    return (this.bandW / this.viewW) * (1 + this.punch);
  }

  /** Frame a set of world-space points of interest (fighter boxes). */
  target(minX: number, maxX: number, minY: number, snap = false, wide = false) {
    const aspect = this.bandW / this.bandH;
    const span = maxX - minX;
    // Horizontal: both fighters plus margin; vertical: keep head room.
    const portrait = aspect < 1 || this.bandW < 620;
    const margin = portrait ? 18 : 205;
    let w = Math.max(span + margin * 2, portrait ? 320 : 700);
    // Height needed: from floor (with a little below) to above the highest point.
    const needH = Math.max(portrait ? 240 : 320, -minY + 150);
    w = Math.max(w, needH * aspect);
    if (wide) w = Math.max(w, this.stageHalf * 2 + 200);
    w = Math.min(w, this.stageHalf * 2 + (portrait ? 80 : 360));
    const viewH = w / aspect;
    let cx = (minX + maxX) / 2;
    const half = w / 2;
    const lim = this.stageHalf + (portrait ? 40 : 140);
    if (half < lim) cx = Math.max(-lim + half, Math.min(lim - half, cx));
    else cx = 0;
    // Floor sits ~16% above the band bottom unless fighters are high up.
    const floorFrac = portrait ? 0.88 : 0.84;
    let camY = -viewH * (floorFrac - 0.5);
    const top = camY - viewH / 2;
    const topNeeded = minY - 70;
    if (topNeeded < top) camY -= top - topNeeded;
    this.tx = cx;
    this.ty = camY;
    this.tw = w;
    if (snap) {
      this.x = this.tx;
      this.y = this.ty;
      this.viewW = this.tw;
    }
  }

  update(dt: number) {
    if (this.bandTo) {
      const kb = 1 - Math.pow(0.0004, dt);
      const b = this.band;
      const to = this.bandTo;
      b.left += (to.left - b.left) * kb;
      b.top += (to.top - b.top) * kb;
      b.right += (to.right - b.right) * kb;
      b.bottom += (to.bottom - b.bottom) * kb;
    }
    const k = 1 - Math.pow(0.002, dt);
    this.x += (this.tx - this.x) * k;
    this.y += (this.ty - this.y) * k;
    this.viewW += (this.tw - this.viewW) * k;
    this.shake *= Math.pow(0.004, dt);
    if (this.shake < 0.2) this.shake = 0;
    this.punch *= Math.pow(0.02, dt);
    if (this.punch < 0.001) this.punch = 0;
    const a = Math.random() * Math.PI * 2;
    this.shakeX = Math.cos(a) * this.shake;
    this.shakeY = Math.sin(a) * this.shake;
  }

  addShake(px: number) {
    this.shake = Math.min(26, this.shake + px);
  }

  addPunch(f: number) {
    this.punch = Math.min(0.12, this.punch + f);
  }

  /** Screen position of the world origin and the scale, for containers. */
  transform(): { x: number; y: number; s: number } {
    const s = this.scale;
    const cx = this.band.left + this.bandW / 2;
    const cy = this.band.top + this.bandH / 2;
    return { x: cx - (this.x + this.shakeX) * s, y: cy - (this.y + this.shakeY) * s, s };
  }

  toScreen(wx: number, wy: number): [number, number] {
    const t = this.transform();
    return [t.x + wx * t.s, t.y + wy * t.s];
  }
}
