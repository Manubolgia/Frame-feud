/** PixiJS arena renderer. Reads sim-shaped render frames and draws them with
 *  interpolation + juice. Cosmetic only — never mutates sim state. */

import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { CharacterDef, StageDef, Vec2 } from '../sim/types';
import { darken, lighten, mix, PLAYER_GLYPHS } from '../theme';
import { Camera, type Bounds } from './camera';
import { drawFigure, type FigureState } from './figure';
import { Juice } from './juice';

export interface RenderChar {
  pos: Vec2; // fixed
  vx: number;
  vy: number;
  facing: 1 | -1;
  damagePercent: number;
  shielding: boolean;
  grounded: boolean;
  hitstun: number;
  invuln: number;
  aimAngle: number;
  alive: boolean;
  charDef: CharacterDef;
  playerColor: number;
  playerIndex: number;
  moveDef?: { kind: string; aimable?: boolean } | null;
  moveActive?: boolean;
  movePhase?: 'startup' | 'active' | 'recovery';
  moveTotalT?: number;
}

export class Renderer {
  app: Application;
  cam = new Camera();
  juice = new Juice();
  root = new Container();

  private bg = new Graphics();
  private bgGlow = new Graphics();
  private stageG = new Graphics();
  private ghostG = new Graphics();
  private aimG = new Graphics();
  private charG = new Graphics();
  private fxG = new Graphics();
  private labels: Container;
  private labelTexts: { chip: Text; name: Text }[] = [];
  private time = 0;
  private stage?: StageDef;

  constructor(app: Application) {
    this.app = app;
    this.root.addChild(this.bg, this.bgGlow, this.stageG, this.ghostG, this.aimG, this.charG, this.fxG);
    this.root.addChild(this.juice.layer);
    this.labels = new Container();
    this.root.addChild(this.labels);
    app.stage.addChild(this.root);
    this.resize();
  }

  resize() {
    const w = this.app.renderer.width;
    const h = this.app.renderer.height;
    this.cam.resize(w, h);
  }

  setStage(stage: StageDef) {
    this.stage = stage;
  }

  stageBounds(): Bounds {
    const s = this.stage!;
    return {
      minX: -s.platforms[0].w / 1000 - 3,
      maxX: s.platforms[0].w / 1000 + 3,
      minY: s.platforms.reduce((m, p) => Math.min(m, p.y / 1000), 0) - 4,
      maxY: s.platforms[0].y / 1000 + 2,
    };
  }

  private drawBackground() {
    const s = this.stage!;
    const w = this.app.renderer.width;
    const h = this.app.renderer.height;
    const g = this.bg;
    g.clear();
    // vertical gradient via stacked bands
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const col = mix(s.bg.top, s.bg.bottom, t);
      g.rect(0, (h * i) / steps, w, h / steps + 1);
      g.fill({ color: col });
    }
    // accent glow blobs (parallax-ish, follow camera lightly)
    const gg = this.bgGlow;
    gg.clear();
    const px = -this.cam.cx * this.cam.scale * 0.08;
    const py = -this.cam.cy * this.cam.scale * 0.08;
    for (let i = 0; i < 3; i++) {
      const bx = w * (0.25 + i * 0.28) + px;
      const by = h * (0.3 + (i % 2) * 0.3) + py;
      gg.circle(bx, by, h * 0.4);
      gg.fill({ color: s.bg.accent, alpha: 0.05 });
    }
  }

  private drawStage() {
    const s = this.stage!;
    const g = this.stageG;
    g.clear();
    for (const pf of s.platforms) {
      const left = this.cam.toScreenX(pf.x - pf.w);
      const right = this.cam.toScreenX(pf.x + pf.w);
      const top = this.cam.toScreenY(pf.y);
      const w = right - left;
      if (pf.passThrough) {
        // thin neon ledge
        g.roundRect(left, top - 2, w, 10, 5);
        g.fill({ color: lighten(s.bg.accent, 0.2), alpha: 0.85 });
        g.roundRect(left, top - 2, w, 4, 2);
        g.fill({ color: 0xffffff, alpha: 0.25 });
      } else {
        const depth = this.app.renderer.height - top + 40;
        // solid stage block with top highlight
        g.roundRect(left, top, w, depth, 14);
        g.fill({ color: darken(s.bg.bottom, 0.35) });
        g.roundRect(left, top, w, 12, 6);
        g.fill({ color: s.bg.accent, alpha: 0.9 });
        g.roundRect(left, top, w, 5, 3);
        g.fill({ color: 0xffffff, alpha: 0.4 });
      }
    }
  }

  drawBlastZones() {
    // subtle vignette frame implied by camera; skip explicit lines for cleanliness
  }

  /** Draw the planning prediction ghost trail. */
  drawPrediction(path: Vec2[], color: number, charDef: CharacterDef) {
    const g = this.ghostG;
    g.clear();
    if (path.length < 2) return;
    // dotted trajectory
    for (let i = 0; i < path.length; i += 3) {
      const p = path[i];
      const t = i / path.length;
      g.circle(this.cam.toScreenX(p.x), this.cam.toScreenY(p.y - charDef.radius), Math.max(1.5, this.cam.len(0.07)));
      g.fill({ color, alpha: 0.15 + 0.5 * (1 - t) });
    }
    // ghost silhouette at end
    const end = path[path.length - 1];
    const r = this.cam.fxLen(charDef.radius);
    g.circle(this.cam.toScreenX(end.x), this.cam.toScreenY(end.y - charDef.radius), r);
    g.stroke({ width: 2, color, alpha: 0.5 });
  }

  clearPrediction() {
    this.ghostG.clear();
  }

  drawAim(originFx: Vec2, charDef: CharacterDef, angleDeg: number, color: number) {
    const g = this.aimG;
    g.clear();
    const ox = this.cam.toScreenX(originFx.x);
    const oy = this.cam.toScreenY(originFx.y - charDef.radius);
    const rad = (angleDeg * Math.PI) / 180;
    const len = this.cam.len(3.2);
    const ex = ox + Math.cos(rad) * len;
    const ey = oy - Math.sin(rad) * len;
    g.moveTo(ox, oy);
    g.lineTo(ex, ey);
    g.stroke({ width: 3, color, alpha: 0.7 });
    // arrowhead
    g.circle(ex, ey, 6);
    g.fill({ color, alpha: 0.9 });
  }

  clearAim() {
    this.aimG.clear();
  }

  /** Recompute camera target to frame all live characters. */
  frameChars(chars: (RenderChar | null)[], padX: number, padY: number) {
    const live = chars.filter((c): c is RenderChar => !!c && c.alive);
    if (live.length === 0) {
      this.cam.setTarget(this.stageBounds(), 0, 0);
      return;
    }
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const c of live) {
      const x = c.pos.x / 1000;
      const y = c.pos.y / 1000;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y - c.charDef.radius / 1000 - 1);
      maxY = Math.max(maxY, y + 0.5);
    }
    // keep stage floor in view a bit
    const sb = this.stageBounds();
    minY = Math.min(minY, sb.maxY - 5);
    maxY = Math.max(maxY, sb.maxY);
    this.cam.setTarget({ minX, maxX, minY, maxY }, padX, padY);
  }

  drawChars(chars: (RenderChar | null)[]) {
    this.drawBackground();
    this.drawStage();
    const g = this.charG;
    g.clear();
    // ensure label slots
    while (this.labelTexts.length < chars.length) {
      const chip = new Text({ text: '', style: chipStyle() });
      chip.anchor.set(0.5, 0.5);
      const name = new Text({ text: '', style: nameStyle() });
      name.anchor.set(0.5, 1);
      this.labels.addChild(name, chip);
      this.labelTexts.push({ chip, name });
    }

    chars.forEach((c, i) => {
      const lab = this.labelTexts[i];
      if (!c || !c.alive) {
        lab.chip.visible = false;
        lab.name.visible = false;
        return;
      }
      this.drawCharacter(g, c);
      // label chip
      const sx = this.cam.toScreenX(c.pos.x);
      const r = this.cam.fxLen(c.charDef.radius);
      const top = this.cam.toScreenY(c.pos.y) - r * 2 - 8;
      lab.chip.visible = true;
      lab.name.visible = true;
      lab.chip.text = `${PLAYER_GLYPHS[c.playerIndex % 4]} ${c.damagePercent}%`;
      lab.chip.x = sx;
      lab.chip.y = top;
      (lab.chip.style as TextStyle).fill = damageColor(c.damagePercent);
      lab.name.text = c.charDef.name;
      lab.name.x = sx;
      lab.name.y = top - 14;
      (lab.name.style as TextStyle).fill = lighten(c.playerColor, 0.3);
    });
  }

  private drawCharacter(g: Graphics, c: RenderChar) {
    const sxFeet = this.cam.toScreenX(c.pos.x);
    const syFeet = this.cam.toScreenY(c.pos.y);
    const r = this.cam.fxLen(c.charDef.radius);
    const cy = syFeet - r; // body center
    const t = this.time;
    const bob = c.grounded ? Math.sin(t * 3 + c.playerIndex) * r * 0.04 : 0;
    const bodyColor = mix(c.playerColor, c.charDef.color, 0.42);
    const outline = lighten(c.playerColor, 0.35);
    const blink = c.invuln > 0 && Math.floor(t * 16) % 2 === 0;

    // shadow
    g.ellipse(sxFeet, syFeet + 3, r * 0.9, r * 0.28);
    g.fill({ color: 0x000000, alpha: 0.28 });

    // aura ring
    g.circle(sxFeet, cy + bob, r * 1.16);
    g.fill({ color: c.playerColor, alpha: 0.14 });

    if (blink) return; // flicker during invuln

    // shield bubble
    if (c.shielding) {
      g.circle(sxFeet, cy + bob, r * 1.5);
      g.fill({ color: 0x9fe8ff, alpha: 0.2 });
      g.circle(sxFeet, cy + bob, r * 1.5);
      g.stroke({ width: 2, color: 0xcdf3ff, alpha: 0.6 });
    }

    // Articulated, animated figure (posed from move state).
    const fs: FigureState = {
      grounded: c.grounded,
      vx: c.vx,
      vy: c.vy,
      hitstun: c.hitstun,
      shielding: c.shielding,
      facing: c.facing,
      aimAngle: c.aimAngle,
      moveKind: c.moveDef?.kind,
      moveAimable: c.moveDef?.aimable,
      movePhase: c.movePhase,
      moveTotalT: c.moveTotalT,
      worldX: sxFeet,
    };
    drawFigure(g, sxFeet, syFeet + bob, r, c.charDef, bodyColor, outline, fs, t);
  }

  private drawSilhouette(
    g: Graphics,
    shape: CharacterDef['shape'],
    cx: number,
    cy: number,
    r: number,
    facing: number,
    fill: number,
    outline: number,
  ) {
    const stroke = { width: Math.max(2, r * 0.12), color: outline, alpha: 0.95 };
    switch (shape) {
      case 'heavy': {
        g.roundRect(cx - r * 0.85, cy - r * 0.95, r * 1.7, r * 1.9, r * 0.4);
        g.fill({ color: fill });
        g.stroke(stroke);
        // chest plate
        g.roundRect(cx - r * 0.5, cy - r * 0.4, r * 1.0, r * 0.7, r * 0.2);
        g.fill({ color: darken(fill, 0.25) });
        break;
      }
      case 'rush': {
        // sleek arrow body
        g.moveTo(cx + facing * r * 0.95, cy);
        g.lineTo(cx - facing * r * 0.7, cy - r * 0.95);
        g.lineTo(cx - facing * r * 0.35, cy);
        g.lineTo(cx - facing * r * 0.7, cy + r * 0.95);
        g.closePath();
        g.fill({ color: fill });
        g.stroke(stroke);
        break;
      }
      case 'zoner': {
        // diamond core + orbit
        g.moveTo(cx, cy - r);
        g.lineTo(cx + r * 0.85, cy);
        g.lineTo(cx, cy + r);
        g.lineTo(cx - r * 0.85, cy);
        g.closePath();
        g.fill({ color: fill });
        g.stroke(stroke);
        const t = this.time * 2;
        g.circle(cx + Math.cos(t) * r * 0.95, cy + Math.sin(t) * r * 0.7, r * 0.16);
        g.fill({ color: lighten(fill, 0.4) });
        break;
      }
      case 'grappler': {
        g.circle(cx, cy, r * 0.95);
        g.fill({ color: fill });
        g.stroke(stroke);
        // fists
        g.circle(cx + facing * r * 0.85, cy + r * 0.5, r * 0.36);
        g.fill({ color: darken(fill, 0.15) });
        g.stroke({ width: stroke.width, color: outline, alpha: 0.8 });
        g.circle(cx - facing * r * 0.85, cy + r * 0.5, r * 0.36);
        g.fill({ color: darken(fill, 0.15) });
        g.stroke({ width: stroke.width, color: outline, alpha: 0.8 });
        break;
      }
    }
  }

  update(dt: number) {
    this.time += dt;
    this.cam.update(dt);
    this.juice.update(dt);
    this.juice.draw(this.cam);
  }

  clearJuice() {
    this.juice.clear();
  }
}

function chipStyle(): TextStyle {
  return new TextStyle({
    fontFamily: 'Rajdhani, Arial, sans-serif',
    fontSize: 18,
    fontWeight: '700',
    fill: 0xffffff,
    stroke: { color: 0x000000, width: 4 },
  });
}
function nameStyle(): TextStyle {
  return new TextStyle({
    fontFamily: 'Rajdhani, Arial, sans-serif',
    fontSize: 12,
    fontWeight: '700',
    fill: 0xffffff,
    stroke: { color: 0x000000, width: 3 },
    letterSpacing: 1,
  });
}

function damageColor(pct: number): number {
  // white -> yellow -> orange -> red as % climbs
  if (pct < 40) return mix(0xffffff, 0xffe14d, pct / 40);
  if (pct < 90) return mix(0xffe14d, 0xff8a3d, (pct - 40) / 50);
  return mix(0xff8a3d, 0xff3355, Math.min(1, (pct - 90) / 60));
}
