/**
 * Dev-only pose & animation viewer.
 *  ?moves=stance,jab@h,...      sheet: one column per pose / move frame (all fighters, or ?char=)
 *  ?char=razor&strip=jab        filmstrip of one move with hitboxes, bones and a dummy at range
 *  &z=2  zoom   &bg=%23202030  background   &step=2  frames per cell   &gap=110  dummy distance
 */
import { CHARACTERS, ROSTER } from '../src/content/roster';
import { L, sampleAnim, type Pose } from '../src/content/poses';
import { CanvasPen } from '../src/render/pen';
import { boneAt, clothAnchors, clothSpec, drawFigure, makeCloth, solve, stepCloth, type FigureCloth } from '../src/render/figure';
import type { CharacterDef, MoveDef } from '../src/sim/types';

const params = new URLSearchParams(location.search);
const only = params.get('char');
const bg = params.get('bg') ?? '#20202c';
const Z = +(params.get('z') ?? 1);
const strip = params.get('strip');
const c = document.getElementById('c') as HTMLCanvasElement;
const x = c.getContext('2d')!;
const pen = new CanvasPen(x);
const AIR = ['rise', 'hurtAir', 'airdash', 'apex', 'fall', 'tumble'];

function settleCloth(id: string, j: ReturnType<typeof solve>, def: CharacterDef, floor: number): FigureCloth {
  const cloth: FigureCloth = {};
  const an = clothAnchors(j, def.build);
  if (an.a) {
    cloth.a = makeCloth(clothSpec(def.build.kit).a![0], clothSpec(def.build.kit).a![1] * Z, an.a[0], an.a[1]);
    for (let i = 0; i < 60; i++) stepCloth(cloth.a, an.a[0], an.a[1], 1 / 60, -260 * Z, 800 * Z, floor);
  }
  if (an.b) {
    cloth.b = makeCloth(clothSpec(def.build.kit).b![0], clothSpec(def.build.kit).b![1] * Z, an.b[0], an.b[1]);
    for (let i = 0; i < 60; i++) stepCloth(cloth.b, an.b[0], an.b[1], 1 / 60, -220 * Z, 700 * Z, floor);
  }
  return cloth;
}

function fig(id: string, def: CharacterDef, pose: Pose, cx: number, floor: number, grounded: boolean, facing: 1 | -1, prop?: any, solid?: number) {
  const pal = def.palettes[0];
  const j = solve(def.build, pose, cx, grounded ? floor : floor - 40 * Z, facing, grounded, 0, null, Z);
  const cloth = solid === undefined ? settleCloth(id, j, def, floor) : {};
  drawFigure(pen, j, def.build, { main: pal[0], trim: pal[1], glow: pal[2], time: 0, prop, solid, open: false }, cloth);
  return j;
}

const rows = params.get('rows');
if (rows && only) {
  // one row per move: the key frames (ready, wind-up, impact, follow-through, recovery)
  const def = CHARACTERS[only];
  const list = rows === 'all' ? def.order.filter((id) => !['wait', 'land'].includes(id)) : rows.split(',');
  const gap = +(params.get('gap') ?? 110);
  const cw = 175 * Z;
  const ch = 170 * Z;
  const N = 8;
  c.width = cw * N;
  c.height = ch * list.length;
  x.fillStyle = bg;
  x.fillRect(0, 0, c.width, c.height);
  list.forEach((id, row) => {
    const m = def.moves[id];
    if (!m) return;
    const hbs = m.hitboxes ?? [];
    const s0 = hbs.length ? Math.min(...hbs.map((h) => h.f0)) : m.spawns?.[0]?.f ?? Math.floor(m.total / 3);
    const s1 = hbs.length ? Math.max(...hbs.map((h) => h.f1)) : s0;
    const cand = [0, Math.max(0, s0 - 3), Math.max(0, s0 - 1), s0, Math.round((s0 + s1) / 2), s1, Math.min(m.total - 1, s1 + Math.round((m.total - s1) / 2)), m.total - 1];
    const grounded = m.where !== 'air';
    cand.forEach((f, col) => {
      const ox = col * cw + 55 * Z;
      const floor = row * ch + ch - 22 * Z;
      x.strokeStyle = '#555';
      x.beginPath();
      x.moveTo(col * cw + 4, floor);
      x.lineTo(col * cw + cw - 4, floor);
      x.stroke();
      fig(only, def, def.stance, ox + gap * Z, floor, true, -1, undefined, 0x4a4a58);
      const pose = sampleAnim(m.anim, f);
      const sp = m.anim.spin;
      const j0 = solve(def.build, pose, ox, grounded ? floor : floor - 40 * Z, 1, grounded, sp && f >= sp.f0 && f <= sp.f1 ? ((f - sp.f0) / Math.max(1, sp.f1 - sp.f0)) * sp.deg : 0, null, Z);
      const pal = def.palettes[0];
      const cloth = settleCloth(only, j0, def, floor);
      const op = m.anim.open && f >= m.anim.open[0] && f <= m.anim.open[1];
      const pw = m.anim.power && f >= m.anim.power[0] && f <= m.anim.power[1];
      drawFigure(pen, j0, def.build, { main: pal[0], trim: pal[1], glow: pal[2], time: f / 60, prop: m.anim.prop, open: !!op, power: !!pw }, cloth);
      const fy = grounded ? floor : floor - 40 * Z;
      for (const hb of hbs) {
        if (f < hb.f0 || f > hb.f1) continue;
        const at = hb.path ? hb.path[Math.min(hb.path.length - 1, f - hb.f0)] : [hb.x, hb.y];
        x.fillStyle = hb.kind === 'grab' ? 'rgba(80,160,255,0.3)' : 'rgba(255,60,90,0.28)';
        x.strokeStyle = hb.kind === 'grab' ? '#4da6ff' : '#ff3b5c';
        x.beginPath();
        x.arc(ox + at[0] * Z, fy + at[1] * Z, hb.r * Z, 0, Math.PI * 2);
        x.fill();
        x.stroke();
      }
      x.fillStyle = '#bbb';
      x.font = `${10 * Math.max(1, Z * 0.7)}px sans-serif`;
      x.fillText(`${col === 0 ? m.name + ' ' : ''}f${f}${f >= s0 && f <= s1 && hbs.length ? ' *' : ''}`, col * cw + 6, row * ch + 13 * Z);
    });
  });
} else if (strip && only) {
  const def = CHARACTERS[only];
  const m: MoveDef = def.moves[strip];
  const step = +(params.get('step') ?? 2);
  const gap = +(params.get('gap') ?? 110);
  const frames: number[] = [];
  for (let f = 0; f < m.total; f += step) frames.push(f);
  const cw = 230 * Z;
  const ch = 220 * Z;
  c.width = cw * Math.min(frames.length, 8);
  c.height = ch * Math.ceil(frames.length / 8);
  x.fillStyle = bg;
  x.fillRect(0, 0, c.width, c.height);
  const grounded = m.where !== 'air';
  frames.forEach((f, n) => {
    const col = n % 8;
    const row = Math.floor(n / 8);
    const ox = col * cw + 70 * Z;
    const floor = row * ch + ch - 26 * Z;
    x.strokeStyle = '#555';
    x.beginPath();
    x.moveTo(col * cw + 4, floor);
    x.lineTo(col * cw + cw - 4, floor);
    x.stroke();
    // dummy (another fighter of the same type, solid) at the given gap
    fig(only, def, def.stance, ox + gap * Z, floor, true, -1, undefined, 0x555566);
    const pose = sampleAnim(m.anim, f);
    const j = fig(only, def, pose, ox, floor, grounded, 1, m.anim.prop);
    const fy = grounded ? floor : floor - 40 * Z;
    // own hurtbox
    x.strokeStyle = 'rgba(80,255,150,0.6)';
    const low = m.low && f >= m.low[0] && f <= m.low[1];
    const hh = def.height * (low ? 0.62 : 1) * Z;
    x.strokeRect(ox - def.width * Z, fy - hh, def.width * 2 * Z, hh);
    for (const hb of m.hitboxes ?? []) {
      if (f < hb.f0 || f > hb.f1) continue;
      x.fillStyle = hb.kind === 'grab' ? 'rgba(80,160,255,0.3)' : 'rgba(255,60,90,0.3)';
      x.strokeStyle = hb.kind === 'grab' ? '#4da6ff' : '#ff3b5c';
      const at = hb.path ? hb.path[Math.min(hb.path.length - 1, f - hb.f0)] : [hb.x, hb.y];
      x.beginPath();
      x.arc(ox + at[0] * Z, fy + at[1] * Z, hb.r * Z, 0, Math.PI * 2);
      x.fill();
      x.stroke();
      if (hb.bone) {
        const b = boneAt(j, hb.bone);
        x.fillStyle = '#ffe14d';
        x.beginPath();
        x.arc(b[0], b[1], 3 * Z, 0, Math.PI * 2);
        x.fill();
      }
    }
    for (const sp of m.spawns ?? []) {
      if (sp.f !== f && !(f < sp.f && f + step > sp.f)) continue;
      x.strokeStyle = '#ffe14d';
      x.beginPath();
      x.arc(ox + sp.x * Z, fy + sp.y * Z, 6 * Z, 0, Math.PI * 2);
      x.stroke();
    }
    x.fillStyle = '#bbb';
    x.font = `${11 * Math.max(1, Z * 0.7)}px sans-serif`;
    const act = (m.hitboxes ?? []).some((hb) => f >= hb.f0 && f <= hb.f1);
    x.fillText(`${m.name} f${f}${act ? '  ACTIVE' : ''}`, col * cw + 6, row * ch + 14 * Z);
  });
} else {
  const cols = (params.get('moves') ?? 'stance,jab@a,jab@h,grab@h,block,parry,hurtHigh,hurtAir,lying').split(',');
  const chars = only ? [only] : ROSTER;
  const cw = 150 * Z;
  const ch = 190 * Z;
  c.width = cw * cols.length;
  c.height = ch * chars.length;
  x.fillStyle = bg;
  x.fillRect(0, 0, c.width, c.height);
  chars.forEach((id, r) => {
    const def = CHARACTERS[id];
    cols.forEach((col, k) => {
      let pose: Pose = def.stance;
      let prop: any = undefined;
      let grounded = true;
      let label = col;
      const [name, at] = col.split('@');
      if ((L as any)[name]) {
        pose = (L as any)[name];
        grounded = !AIR.includes(name);
      } else {
        let mid = name;
        const supers = Object.values(def.moves).filter((m) => m.cat === 'super' && !m.hidden);
        if (name === 'super1') mid = supers[0]?.id;
        if (name === 'super2') mid = supers[1]?.id;
        if (name === 'special') mid = Object.values(def.moves).find((m) => m.cat === 'special')!.id;
        const m = def.moves[mid];
        if (m) {
          const fa = m.hitboxes?.[0]?.f0 ?? m.spawns?.[0]?.f ?? Math.floor(m.total / 2);
          const f = at === 'a' ? Math.max(0, fa - 1) : at === 'h' ? fa : at ? +at : fa;
          pose = sampleAnim(m.anim, f);
          prop = m.anim.prop;
          grounded = m.where !== 'air';
          label = `${m.name} f${f}`;
        }
      }
      const ox = k * cw + cw / 2;
      const oy = r * ch + ch - 30 * Z;
      x.strokeStyle = '#444';
      x.beginPath();
      x.moveTo(k * cw + 8, oy);
      x.lineTo(k * cw + cw - 8, oy);
      x.stroke();
      fig(id, def, pose, ox, oy, grounded, 1, prop);
      x.fillStyle = '#999';
      x.fillText(label, k * cw + 6, r * ch + 14);
    });
  });
}
(window as any).done = true;
