import { CHARACTERS, ROSTER } from '../src/content/roster';
import { L, sampleAnim, type Pose } from '../src/content/poses';
import { CanvasPen } from '../src/render/pen';
import { solve, drawFigure, makeCloth, stepCloth, clothAnchors } from '../src/render/figure';

const params = new URLSearchParams(location.search);
const only = params.get('char');
const bg = params.get('bg') ?? '#20202c';
const cols = (params.get('moves') ?? 'stance,jab@a,jab@h,grab@h,block,parry,hurtHigh,hurtAir,lying,rise,airdash,super1,super2').split(',');
const chars = only ? [only] : ROSTER;
const Z = +(params.get('z') ?? 1); const cw = 150 * Z, ch = 190 * Z;
const c = document.getElementById('c') as HTMLCanvasElement;
c.width = cw * cols.length; c.height = ch * chars.length;
const x = c.getContext('2d')!;
x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
const pen = new CanvasPen(x);
chars.forEach((id, r) => {
  const def = CHARACTERS[id];
  const pal = def.palettes[0];
  cols.forEach((col, k) => {
    let pose: Pose = def.stance;
    let prop: any = undefined;
    let grounded = true;
    let label = col;
    const [name, at] = col.split('@');
    if ((L as any)[name]) { pose = (L as any)[name]; grounded = !['rise','hurtAir','airdash','apex','fall','tumble'].includes(name); }
    else {
      let mid = name;
      const supers = Object.values(def.moves).filter(m => m.cat === 'super' && !m.hidden);
      if (name === 'super1') mid = supers[0]?.id; if (name === 'super2') mid = supers[1]?.id;
      if (name === 'special') mid = Object.values(def.moves).find(m => m.cat === 'special')!.id;
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
    const ox = k * cw + cw / 2, oy = r * ch + ch - 30;
    x.strokeStyle = '#444'; x.beginPath(); x.moveTo(k * cw + 8, oy); x.lineTo(k * cw + cw - 8, oy); x.stroke();
    const j = solve(def.build, pose, ox, grounded ? oy : oy - 30 * Z, 1, grounded, 0, null, Z);
    const cloth: any = {};
    const an = clothAnchors(j, def.build);
    if (an.a) { cloth.a = makeCloth(id === "arc" ? 5 : 8, 8, an.a[0], an.a[1]); for (let i = 0; i < 60; i++) stepCloth(cloth.a, an.a[0], an.a[1], 1/60, -300, 900, oy); }
    if (an.b) { cloth.b = makeCloth(5, 8, an.b[0], an.b[1]); for (let i = 0; i < 60; i++) stepCloth(cloth.b, an.b[0], an.b[1], 1/60, -200, 900, oy); }
    drawFigure(pen, j, def.build, { main: pal[0], trim: pal[1], glow: pal[2], time: 0, prop, halo: { c: pal[2], a: 0.18, w: 5 } }, cloth);
    x.fillStyle = '#999'; x.fillText(label, k * cw + 6, r * ch + 14);
  });
});
(window as any).done = true;
