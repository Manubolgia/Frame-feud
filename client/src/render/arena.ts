/**
 * The arena scene: camera, stage, fighters, projectiles, effects and the
 * planning ghost. Fed with simulation snapshots; never touches sim state.
 */

import { AlphaFilter, Application, Container, Graphics } from 'pixi.js';
import { ctxFor } from '../content/roster';
import type { CharacterDef, FighterSnap, MatchConfig, SimCtx, SimEvent, Snapshot } from '../sim/types';
import { choosePose } from './anim';
import { Camera } from './camera';
import { darken, lighten, mix } from './color';
import { boneAt, clothAnchors, clothSpec, drawFigure, makeCloth, solve, stepCloth, type FigureCloth, type Joints, type Look, type P2 } from './figure';
import { Fx } from './fx';
import { PixiPen } from './pen';
import { drawProjectile } from './projectiles';
import { StageView } from './stage';

interface FState {
  cloth: FigureCloth;
  walk: number;
  lastX: number;
  trail: { pts: P2[]; age: number[] };
  flash: number;
  lastJ: Joints | null;
  airTime: number;
}

export interface GhostView {
  frames: Snapshot[];
  me: number;
  /** Fractional frame index being shown. */
  at: number;
  myNext: number;
  showOpponent: boolean;
  hits: { x: number; y: number }[];
}

export interface ArenaOpts {
  hitboxes?: boolean;
  reducedMotion?: boolean;
  shake?: number;
  /** Fit the whole stage (title attract mode). */
  wide?: boolean;
  /** Highlight fighter i (planning), dim the other slightly. */
  focus?: number;
  /** Winner pose after a KO. */
  victor?: number;
}

export class Arena {
  app: Application;
  cam = new Camera();
  ctx: SimCtx;
  cfg: MatchConfig | null = null;
  private root = new Container();
  private back = new Container();
  private dim = new Graphics();
  private world = new Container();
  private shadows = new Graphics();
  private fighters = new Graphics();
  private ghostG = new Graphics();
  /** Ghost figures: each drawn opaque and faded as one layer, so the
   *  overlapping body parts don't stack up into a blotchy silhouette. */
  private ghostFigs = [0.28, 0.35, 0.55].map((alpha) => {
    const g = new Graphics();
    g.filters = [new AlphaFilter({ alpha })];
    return { g, pen: new PixiPen(g) };
  });
  private ghostLayer = new Container();
  private projG = new Graphics();
  private debugG = new Graphics();
  private screenFx = new Graphics();
  fx = new Fx();
  private stage: StageView | null = null;
  private fs: FState[] = [this.newF(), this.newF()];
  private time = 0;
  private dimAmt = 0;
  private dimFocus = -1;
  private flashAmt = 0;
  private flashColor = 0xffffff;
  private pen: PixiPen;
  private ghostPen: PixiPen;

  constructor(app: Application) {
    this.app = app;
    this.ctx = ctxFor('dojo');
    this.pen = new PixiPen(this.fighters);
    this.ghostPen = new PixiPen(this.ghostG);
    this.ghostLayer.addChild(...this.ghostFigs.map((f) => f.g), this.ghostG);
    this.world.addChild(this.shadows, this.ghostLayer, this.projG, this.fighters, this.fx.layer, this.debugG);
    this.root.addChild(this.back, this.dim, this.world, this.screenFx);
    app.stage.addChild(this.root);
    this.resize();
  }

  private newF(): FState {
    return { cloth: {}, walk: 0, lastX: 0, trail: { pts: [], age: [] }, flash: 0, lastJ: null, airTime: 0 };
  }

  resize() {
    this.cam.resize(this.app.renderer.width / this.app.renderer.resolution, this.app.renderer.height / this.app.renderer.resolution);
  }

  setBand(left: number, top: number, right: number, bottom: number) {
    this.cam.band = { left, top, right: Math.max(left + 120, right), bottom: Math.max(top + 80, bottom) };
  }

  setMatch(cfg: MatchConfig) {
    this.cfg = cfg;
    this.ctx = ctxFor(cfg.stageId);
    if (this.stage) {
      this.back.removeChildren();
      this.world.removeChild(this.stage.world, this.stage.front);
      this.root.removeChild(this.stage.ambient);
      this.stage.destroy();
    }
    this.stage = new StageView(this.ctx.stage);
    this.back.addChild(this.stage.back);
    this.world.addChildAt(this.stage.world, 0);
    this.world.addChild(this.stage.front);
    this.root.addChildAt(this.stage.ambient, this.root.getChildIndex(this.screenFx));
    this.cam.stageHalf = this.ctx.stage.halfWidth;
    this.fs = [this.newF(), this.newF()];
    this.fx.clear();
    this.dimAmt = 0;
    this.flashAmt = 0;
  }

  palette(i: number): [number, number, number] {
    const cfg = this.cfg!;
    const def = this.ctx.chars[cfg.chars[i]];
    const p = def.palettes[cfg.palettes[i] % def.palettes.length];
    // Mirror matches with the same palette: shift P2's colours.
    if (i === 1 && cfg.chars[0] === cfg.chars[1] && cfg.palettes[0] === cfg.palettes[1]) {
      const q = def.palettes[(cfg.palettes[1] + 1) % def.palettes.length];
      return q;
    }
    return p;
  }

  /** Camera framing for a snapshot. */
  frame(s: Snapshot, snap = false, wide = false) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = 0;
    for (let i = 0; i < 2; i++) {
      const f = s.fighters[i];
      const def = this.ctx.chars[this.cfg!.chars[i]];
      const x = f.x / 100;
      minX = Math.min(minX, x - def.width);
      maxX = Math.max(maxX, x + def.width);
      minY = Math.min(minY, f.y / 100 - def.height);
    }
    this.cam.target(minX, maxX, minY, snap, wide);
  }

  // ------------------------------------------------------------ events --

  /** Visual reaction to a sim event (sound is handled by the caller). */
  onEvent(e: SimEvent, s: Snapshot, opts: ArenaOpts) {
    const shakeK = opts.shake ?? 1;
    const red = !!opts.reducedMotion;
    this.fx.reduced = red;
    const col = (i: number) => this.palette(i)[0];
    switch (e.t) {
      case 'hit': {
        const x = e.x / 100;
        const y = e.y / 100;
        const dirX = Math.sign(s.fighters[e.v].x - s.fighters[e.a].x) || 1;
        switch (e.kind) {
          case 'block':
            this.fx.block(x, y, dirX, e.power);
            this.cam.addShake((2 + e.power / 25) * shakeK);
            break;
          case 'parry':
            this.fx.parry(x, y);
            this.flash(0xffffff, red ? 0.15 : 0.45);
            this.cam.addShake(8 * shakeK);
            this.cam.addPunch(red ? 0 : 0.06);
            break;
          case 'armor':
            this.fx.armor(x, y);
            this.cam.addShake(5 * shakeK);
            break;
          case 'tech':
            this.fx.tech(x, y);
            break;
          case 'grab':
            this.fx.grab(x, y, col(e.a));
            break;
          default: {
            const counter = e.kind === 'counter';
            this.fx.hit(x, y, e.power, lighten(col(e.a), 0.2), dirX, e.fx, counter);
            if (counter) this.fx.counter(x, y);
            this.fx.damage(x, y, e.dmg, counter ? 0xff6080 : 0xffffff);
            this.cam.addShake((3 + e.power / 9) * shakeK);
            if (e.power > 60 && !red) this.cam.addPunch(0.03 + e.power / 3000);
            this.fs[e.v].flash = 0.09;
          }
        }
        break;
      }
      case 'ko':
        this.fx.ko(e.x / 100, e.y / 100, col(e.v));
        this.flash(0xffffff, red ? 0.2 : 0.7);
        this.cam.addShake(18 * shakeK);
        if (!red) this.cam.addPunch(0.1);
        break;
      case 'land':
        this.fx.landing(e.x / 100, e.hard, this.dustColor());
        if (e.hard) this.cam.addShake(3 * shakeK);
        break;
      case 'jump':
        if (!e.air) this.fx.dust(e.x / 100, 0, 0, 5, this.dustColor());
        else this.fx.ring(e.x / 100, e.y / 100 - 10, 6, 40, 4, 0xffffff, 0.2, 0.35);
        break;
      case 'wall':
        this.fx.wall(e.x / 100, e.y / 100);
        this.cam.addShake(8 * shakeK);
        break;
      case 'bounce':
        this.fx.bounce(e.x / 100);
        this.cam.addShake(6 * shakeK);
        break;
      case 'vanish':
      case 'appear':
        this.fx.smoke(e.x / 100, e.y / 100 - 50, darken(col(e.i), 0.4));
        break;
      case 'move': {
        const def = this.ctx.chars[this.cfg!.chars[e.i]];
        const m = def.moves[e.move];
        if (m?.superFlash) {
          this.dimAmt = 1;
          this.dimFocus = e.i;
          const f = s.fighters[e.i];
          this.fx.ring(f.x / 100, f.y / 100 - def.height / 2, 200, 20, 6, this.palette(e.i)[2], 0.35);
          this.fx.ring(f.x / 100, f.y / 100 - def.height / 2, 260, 40, 3, 0xffffff, 0.4);
        }
        if (e.move === 'burst') {
          const f = s.fighters[e.i];
          this.fx.burst(f.x / 100, f.y / 100 - def.height / 2, this.palette(e.i)[0]);
          this.flash(0xffffff, red ? 0.1 : 0.3);
        }
        break;
      }
      case 'pop': {
        // blasts draw their own explosion as a projectile
        if (e.kind === 'blast' || e.kind === 'orbblast' || e.kind === 'singblast') break;
        if (e.kind === 'missile' || e.kind === 'orb' || e.kind === 'singularity') {
          this.fx.explosion(e.x / 100, e.y / 100, 50, 0xffb040);
        } else {
          this.fx.ring(e.x / 100, e.y / 100, 4, 30, 4, 0xffffff, 0.18);
        }
        break;
      }
      case 'spawn': {
        if (e.kind === 'blast' || e.kind === 'orbblast' || e.kind === 'singblast') {
          this.fx.explosion(e.x / 100, e.y / 100, e.kind === 'singblast' ? 150 : 90, 0xff8a40);
          this.cam.addShake(9 * shakeK);
        } else if (e.kind === 'quake' || e.kind === 'tectonic') {
          this.fx.shockwave(e.x / 100, e.kind === 'tectonic' ? 640 : 150, 0xffffff);
          this.cam.addShake((e.kind === 'tectonic' ? 20 : 7) * shakeK);
        } else {
          this.fx.ring(e.x / 100, e.y / 100, 4, 34, 5, this.palette(e.i)[2], 0.2);
        }
        break;
      }
      case 'feint':
        this.fx.pop(s.fighters[e.i].x / 100, s.fighters[e.i].y / 100 - 140, 'FEINT', 0xd8d8ff, 26);
        break;
    }
  }

  private dustColor(): number {
    switch (this.ctx.stage.theme) {
      case 'rooftop':
        return 0x8a90a8;
      case 'forge':
        return 0xe0a6ff;
      case 'lab':
        return 0x9ea4b2;
      default:
        return 0xe0c8a8;
    }
  }

  flash(c: number, a: number) {
    this.flashColor = c;
    this.flashAmt = Math.max(this.flashAmt, a);
  }

  // ------------------------------------------------------------ draw --

  /**
   * Draw the scene between snapshots a and b (t in 0..1).
   */
  render(dt: number, a: Snapshot, b: Snapshot, t: number, opts: ArenaOpts, ghost: GhostView | null = null) {
    this.time += dt;
    const cam = this.cam;
    this.frame(b, false, !!opts.wide);
    cam.update(dt);
    if (!this.stage) return;
    this.stage.layout(cam);
    this.stage.update(dt, cam, !!opts.reducedMotion);
    const tr = cam.transform();
    this.world.position.set(tr.x, tr.y);
    this.world.scale.set(tr.s);

    // super dim
    this.dimAmt = Math.max(0, this.dimAmt - dt * 1.6);
    this.dim.clear();
    if (this.dimAmt > 0) this.dim.rect(0, 0, cam.screenW, cam.screenH).fill({ color: 0x05040a, alpha: 0.6 * Math.min(1, this.dimAmt * 1.4) });

    this.drawProjectiles(a, b, t);
    this.drawFighters(a, b, t, dt, opts);
    this.drawGhost(ghost);
    this.drawDebug(b, !!opts.hitboxes);
    this.fx.update(dt);
    this.fx.draw();

    // screen flash
    this.flashAmt = Math.max(0, this.flashAmt - dt * 3.2);
    this.screenFx.clear();
    if (this.flashAmt > 0) this.screenFx.rect(0, 0, cam.screenW, cam.screenH).fill({ color: this.flashColor, alpha: this.flashAmt * 0.6 });
  }

  private drawProjectiles(a: Snapshot, b: Snapshot, t: number) {
    const g = this.projG;
    g.clear();
    for (const p of b.projs) {
      const pa = a.projs.find((q) => q.id === p.id);
      const owner = this.cfg!.chars[p.owner];
      const def = this.ctx.chars[owner].projectiles[p.kind];
      if (!def) continue;
      const ip = pa ? { ...p, x: pa.x + (p.x - pa.x) * t, y: pa.y + (p.y - pa.y) * t } : p;
      const pal = this.palette(p.owner);
      drawProjectile(g, ip, def, pal[0], pal[2], this.time);
    }
  }

  private drawFighters(a: Snapshot, b: Snapshot, t: number, dt: number, opts: ArenaOpts) {
    const g = this.fighters;
    g.clear();
    this.shadows.clear();
    // The fighter mid-attack draws on top.
    const order = [0, 1];
    const busy = (s: FighterSnap) => (s.mode === 'move' ? 1 : 0) + (s.victim >= 0 ? 2 : 0);
    if (busy(b.fighters[0]) > busy(b.fighters[1])) order.reverse();
    for (const i of order) this.drawOne(i, a.fighters[i], b.fighters[i], t, dt, opts);
  }

  private drawOne(i: number, sa: FighterSnap, sb: FighterSnap, t: number, dt: number, opts: ArenaOpts) {
    const cfg = this.cfg!;
    const def: CharacterDef = this.ctx.chars[cfg.chars[i]];
    const st = this.fs[i];
    const s = t < 0.5 ? sa : sb;
    let x = (sa.x + (sb.x - sa.x) * t) / 100;
    const y = (sa.y + (sb.y - sa.y) * t) / 100;
    const mf = sa.move === sb.move && sb.mf >= sa.mf ? sa.mf + (sb.mf - sa.mf) * t : s.mf;
    // walk phase advances with distance travelled
    st.walk += Math.abs(x - st.lastX) / (def.build.height * 0.9);
    st.lastX = x;
    // victims shake during hitlag
    if (s.hitlag > 0 && (s.mode === 'hitstun' || s.mode === 'blockstun') && !opts.reducedMotion) x += Math.sin(this.time * 90) * 2.5;

    const pal = this.palette(i);
    const po = choosePose(def, s, mf, this.time + i * 1.3, st.walk);
    if (opts.victor === i && s.mode === 'idle' && s.grounded) po.pose = { ...po.pose, ...victoryPose() };
    const j = solve(def.build, po.pose, x, y, s.facing, po.grounded && s.grounded, po.spin, po.aim);
    st.lastJ = j;

    // shadow
    const hgt = Math.max(0, -y);
    const sw = def.width * 1.6 * Math.max(0.35, 1 - hgt / 500);
    this.shadows.ellipse(x, 2, sw, sw * 0.22).fill({ color: this.stage!.theme.shadow, alpha: 0.35 * Math.max(0.3, 1 - hgt / 400) });

    if (s.hidden) {
      st.trail.pts = [];
      return;
    }

    // cloth
    const an = clothAnchors(j, def.build);
    const spec = clothSpec(def.build.kit);
    const wind = -(s.vx / 100) * 60 * 6 - s.facing * 260 + Math.sin(this.time * 3.1 + i) * 160;
    if (an.a) {
      if (!st.cloth.a) st.cloth.a = makeCloth(spec.a![0], spec.a![1], an.a[0], an.a[1]);
      stepCloth(st.cloth.a, an.a[0], an.a[1], dt, wind, 700, 0);
    }
    if (an.b) {
      if (!st.cloth.b) st.cloth.b = makeCloth(spec.b![0], spec.b![1], an.b[0], an.b[1]);
      stepCloth(st.cloth.b, an.b[0], an.b[1], dt, wind * 0.8, 700, 0);
    }

    // limb smear
    this.drawTrail(st, j, po.trail, pal[2], dt);

    st.flash = Math.max(0, st.flash - dt);
    const theme = this.stage!.theme;
    let halo: Look['halo'] = theme.halo > 0 ? { c: theme.rim, a: theme.halo, w: 5 } : undefined;
    if (s.armor) halo = { c: 0xffa040, a: 0.55 + 0.25 * Math.sin(this.time * 30), w: 9 };
    else if (s.invuln > 0 || (s.mode === 'move' && isInvuln(def, s))) halo = { c: 0xffffff, a: 0.3 + 0.2 * Math.sin(this.time * 40), w: 7 };
    if (s.parrying) halo = { c: 0x9fe8ff, a: 0.8, w: 10 };
    const dimmed = opts.focus !== undefined && opts.focus !== i;
    const look: Look = {
      main: dimmed ? mix(pal[0], 0x777788, 0.25) : pal[0],
      trim: pal[1],
      glow: pal[2],
      time: this.time,
      flash: st.flash > 0 ? 1 : 0,
      halo,
      prop: po.prop,
      power: po.power,
      open: po.open,
      charge: po.power ? 0.6 : 0,
    };
    drawFigure(this.pen, j, def.build, look, st.cloth);

    // guard shield
    if (s.blocking || s.mode === 'blockstun') {
      const cx = j.neck[0] + s.facing * def.width * 0.9;
      const cy = (j.neck[1] + j.hip[1]) / 2;
      const r = def.height * 0.42;
      const hit = s.mode === 'blockstun' ? 0.35 : 0;
      const pts: number[] = [];
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * Math.PI * 2 + Math.PI / 6;
        pts.push(cx + Math.cos(ang) * r * 0.55, cy + Math.sin(ang) * r);
      }
      this.fighters.poly(pts).fill({ color: 0x8fe6ff, alpha: 0.12 + hit }).stroke({ color: 0xcff6ff, width: 2.5, alpha: 0.7 + hit });
    }
  }

  private drawTrail(st: FState, j: Joints, limb: string | null, c: number, dt: number) {
    const tr = st.trail;
    for (let k = 0; k < tr.age.length; k++) tr.age[k] += dt;
    while (tr.age.length && tr.age[0] > 0.1) {
      tr.age.shift();
      tr.pts.shift();
    }
    if (limb) {
      const p =
        limb === 'tip' ? boneAt(j, 'tip') : limb === 'fa' ? boneAt(j, 'fHand') : limb === 'ba' ? boneAt(j, 'bHand') : limb === 'fl' ? boneAt(j, 'fFoot') : limb === 'bl' ? boneAt(j, 'bFoot') : j.head;
      tr.pts.push([p[0], p[1]]);
      tr.age.push(0);
    }
    if (tr.pts.length < 2) return;
    const g = this.fighters;
    for (let k = 1; k < tr.pts.length; k++) {
      const a = tr.pts[k - 1];
      const b = tr.pts[k];
      const life = 1 - tr.age[k] / 0.1;
      g.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ color: 0xffffff, width: 14 * life, alpha: 0.5 * life, cap: 'round' });
      g.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ color: c, width: 22 * life, alpha: 0.22 * life, cap: 'round' });
    }
  }

  // ------------------------------------------------------------ ghost --

  private drawGhost(gv: GhostView | null) {
    const g = this.ghostG;
    g.clear();
    for (const f of this.ghostFigs) f.g.clear();
    if (!gv || gv.frames.length < 2) return;
    const me = gv.me;
    const pal = this.palette(me);
    const frames = gv.frames;
    // trajectory: a dotted line of my feet through the preview
    const def = this.ctx.chars[this.cfg!.chars[me]];
    const end = gv.myNext > 0 ? Math.min(gv.myNext, frames.length - 1) : frames.length - 1;
    for (let k = 0; k <= end; k += 2) {
      const f = frames[k].fighters[me];
      const yy = f.y / 100 - def.height * 0.5;
      g.circle(f.x / 100, yy, k % 10 === 0 ? 3.2 : 2).fill({ color: pal[2], alpha: k % 10 === 0 ? 0.9 : 0.5 });
    }
    // where I'll be when I can act again
    if (gv.myNext > 0 && gv.myNext < frames.length) {
      const f = frames[gv.myNext].fighters[me];
      this.ghostFigure(me, f, gv.myNext, pal[2], 0);
    }
    // the animated ghost
    const k = Math.max(0, Math.min(frames.length - 1, Math.floor(gv.at)));
    const fr = frames[k];
    if (gv.showOpponent) this.ghostFigure(1 - me, fr.fighters[1 - me], gv.at, this.palette(1 - me)[2], 1);
    this.ghostFigure(me, fr.fighters[me], gv.at, lighten(pal[2], 0.2), 2);
    for (const p of fr.projs) {
      g.circle(p.x / 100, p.y / 100, 10).stroke({ color: this.palette(p.owner)[2], width: 2, alpha: 0.7 });
    }
    for (const h of gv.hits) {
      const x = h.x / 100;
      const y = h.y / 100;
      g.moveTo(x - 12, y - 12).lineTo(x + 12, y + 12).stroke({ color: 0xffffff, width: 4, alpha: 0.9 });
      g.moveTo(x + 12, y - 12).lineTo(x - 12, y + 12).stroke({ color: 0xffffff, width: 4, alpha: 0.9 });
      g.circle(x, y, 16).stroke({ color: 0xff4060, width: 2.5, alpha: 0.9 });
    }
  }

  private ghostFigure(i: number, s: FighterSnap, mf: number, c: number, slot: number) {
    const def = this.ctx.chars[this.cfg!.chars[i]];
    if (s.hidden) return;
    const po = choosePose(def, s, s.mf + (mf % 1), 0, 0);
    const j = solve(def.build, po.pose, s.x / 100, s.y / 100, s.facing, po.grounded && s.grounded, po.spin, po.aim);
    drawFigure(this.ghostFigs[slot].pen, j, def.build, { main: c, trim: c, glow: c, solid: c, time: 0, prop: po.prop });
  }

  // ------------------------------------------------------------ debug --

  private drawDebug(s: Snapshot, on: boolean) {
    const g = this.debugG;
    g.clear();
    if (!on) return;
    for (let i = 0; i < 2; i++) {
      const f = s.fighters[i];
      const def = this.ctx.chars[this.cfg!.chars[i]];
      let w = def.width;
      let h = def.height;
      if (f.mode === 'kd' || f.mode === 'down') {
        h = 30;
        w = Math.round(def.height * 0.48);
      }
      const x = f.x / 100;
      const y = f.y / 100;
      g.rect(x - w, y - h, w * 2, h).stroke({ color: 0x4dff9c, width: 1.5, alpha: 0.9 });
      if (f.mode === 'move' && f.move) {
        const m = def.moves[f.move];
        for (const hb of m?.hitboxes ?? []) {
          if (f.mf < hb.f0 || f.mf > hb.f1) continue;
          let cx: number;
          let cy: number;
          if (hb.aimed) {
            const l = Math.hypot(f.dir[0], f.dir[1]) || 1;
            cx = x + (f.dir[0] / l) * hb.x;
            cy = y + hb.y + (f.dir[1] / l) * hb.x;
          } else {
            const at = hb.path ? hb.path[Math.min(hb.path.length - 1, Math.floor(f.mf) - hb.f0)] : [hb.x, hb.y];
            cx = x + at[0] * f.facing;
            cy = y + at[1];
          }
          g.circle(cx, cy, hb.r).fill({ color: hb.kind === 'grab' ? 0x4da6ff : 0xff3b5c, alpha: 0.25 }).stroke({ color: hb.kind === 'grab' ? 0x4da6ff : 0xff3b5c, width: 2 });
        }
      }
    }
    for (const p of s.projs) {
      const def = this.ctx.chars[this.cfg!.chars[p.owner]].projectiles[p.kind];
      if (def?.hit) g.circle(p.x / 100, p.y / 100, def.r).stroke({ color: 0xff3b5c, width: 2 });
    }
  }

  /** Screen position of a fighter's head, for DOM labels. */
  headScreen(i: number, s: Snapshot): [number, number] {
    const def = this.ctx.chars[this.cfg!.chars[i]];
    const f = s.fighters[i];
    return this.cam.toScreen(f.x / 100, f.y / 100 - def.height - 18);
  }
}

function isInvuln(def: CharacterDef, s: FighterSnap): boolean {
  const m = s.move ? def.moves[s.move] : undefined;
  if (!m?.invuln) return false;
  return m.invuln.some((w) => s.mf >= w.f0 && s.mf <= w.f1 && w.vs === 'all');
}

function victoryPose() {
  return { fs: 170, fe: 10, bs: 20, be: 60, torso: 0, head: -14 };
}
