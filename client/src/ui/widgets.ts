/** Input widgets for move parameters: a direction pad, a stepper slider,
 *  segmented choices and toggles. Touch, mouse and keyboard friendly. */

import { sfx } from '../audio/audio';
import type { DirSpec } from '../sim/types';
import { el } from './dom';
import { icon } from './icons';

// ------------------------------------------------------------ direction --

export class DirPad {
  root: HTMLElement;
  private svg: SVGSVGElement;
  private knob: SVGCircleElement;
  private line: SVGLineElement;
  private readout: HTMLElement;
  private v: [number, number] = [100, 0];
  private spec: DirSpec;
  private facing: 1 | -1;
  onChange: (v: [number, number]) => void = () => {};
  private dragging = false;

  constructor(spec: DirSpec, value: [number, number], facing: 1 | -1, label: string) {
    this.spec = spec;
    this.facing = facing;
    const NS = 'http://www.w3.org/2000/svg';
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('viewBox', '-60 -60 120 120');
    this.svg.setAttribute('class', 'dirpad-svg');
    const add = (tag: string, attrs: Record<string, string | number>) => {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, String(attrs[k]));
      this.svg.appendChild(e);
      return e;
    };
    add('circle', { cx: 0, cy: 0, r: 50, class: 'dp-ring' });
    // disallowed half
    if (spec.kind === 'up') add('path', { d: 'M -50 0 A 50 50 0 0 0 50 0 Z', class: 'dp-off' });
    if (spec.kind === 'down') add('path', { d: 'M -50 0 A 50 50 0 0 1 50 0 Z', class: 'dp-off' });
    if (spec.kind === 'free' || spec.kind === 'up' || spec.kind === 'down') add('circle', { cx: 0, cy: 0, r: 25, class: 'dp-mid' });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      add('line', { x1: Math.cos(a) * 44, y1: Math.sin(a) * 44, x2: Math.cos(a) * 50, y2: Math.sin(a) * 50, class: 'dp-tick' });
    }
    add('line', { x1: -50, y1: 0, x2: 50, y2: 0, class: 'dp-axis' });
    add('line', { x1: 0, y1: -50, x2: 0, y2: 50, class: 'dp-axis' });
    // facing marker: which way is "forward"
    add('path', { d: `M ${facing * 54} -5 L ${facing * 60} 0 L ${facing * 54} 5`, class: 'dp-fwd' });
    this.line = add('line', { x1: 0, y1: 0, x2: 0, y2: 0, class: 'dp-line' }) as SVGLineElement;
    this.knob = add('circle', { cx: 0, cy: 0, r: 8, class: 'dp-knob' }) as SVGCircleElement;
    this.readout = el('div', { cls: 'dp-readout' });
    this.root = el('div', {
      cls: 'dirpad',
      attrs: { tabindex: 0, role: 'slider', 'aria-label': label },
      kids: [this.svg, this.readout],
    });
    this.bind();
    this.set(value, false);
  }

  private bind() {
    const toV = (e: PointerEvent): [number, number] => {
      const r = this.svg.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 120 - 60;
      const y = ((e.clientY - r.top) / r.height) * 120 - 60;
      return [Math.round((x / 50) * 100), Math.round((y / 50) * 100)];
    };
    this.svg.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.svg.setPointerCapture(e.pointerId);
      this.set(toV(e), true);
      e.preventDefault();
    });
    this.svg.addEventListener('pointermove', (e) => {
      if (this.dragging) this.set(toV(e), true);
    });
    const end = () => {
      if (this.dragging) sfx.tap();
      this.dragging = false;
    };
    this.svg.addEventListener('pointerup', end);
    this.svg.addEventListener('pointercancel', end);
    this.root.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 25 : 10;
      const [x, y] = this.v;
      let n: [number, number] | null = null;
      if (e.key === 'ArrowLeft') n = [x - step, y];
      if (e.key === 'ArrowRight') n = [x + step, y];
      if (e.key === 'ArrowUp') n = [x, y - step];
      if (e.key === 'ArrowDown') n = [x, y + step];
      if (n) {
        e.preventDefault();
        e.stopPropagation();
        this.set(n, true);
      }
    });
  }

  /** Clamp to the spec the same way the sim's sanitizer will. */
  private clamp(v: [number, number]): [number, number] {
    let [x, y] = v;
    const l = Math.hypot(x, y);
    const s = this.spec;
    if (s.kind === 'aim' && l > 0) {
      x = (x / l) * 100;
      y = (y / l) * 100;
    } else if (l > 100) {
      x = (x / l) * 100;
      y = (y / l) * 100;
    }
    if (s.kind === 'up') y = Math.min(y, -(s.min ?? 25));
    if (s.kind === 'down') y = Math.max(y, s.min ?? 20);
    const l2 = Math.hypot(x, y);
    if (l2 > 100) {
      x = (x / l2) * 100;
      y = (y / l2) * 100;
    }
    if (s.kind === 'free' && s.min && l2 < s.min && l2 > 0) {
      x = (x / l2) * s.min;
      y = (y / l2) * s.min;
    }
    return [Math.round(x), Math.round(y)];
  }

  set(v: [number, number], emit: boolean) {
    this.v = this.clamp(v);
    const [x, y] = this.v;
    const k = 0.5;
    this.knob.setAttribute('cx', String(x * k));
    this.knob.setAttribute('cy', String(y * k));
    this.line.setAttribute('x2', String(x * k));
    this.line.setAttribute('y2', String(y * k));
    const mag = Math.round(Math.min(100, Math.hypot(x, y)));
    const deg = Math.round((Math.atan2(-y, x * this.facing) * 180) / Math.PI);
    this.readout.textContent = this.spec.kind === 'aim' ? `${deg}°` : `${deg}° · ${mag}%`;
    if (emit) this.onChange(this.v);
  }

  get value(): [number, number] {
    return this.v;
  }
}

// ------------------------------------------------------------ amount --

export class Stepper {
  root: HTMLElement;
  private input: HTMLInputElement;
  private val: HTMLElement;
  private markEl: HTMLElement;
  onChange: (n: number) => void = () => {};
  private min: number;
  private max: number;
  private unit: string;

  constructor(label: string, min: number, max: number, value: number, unit: string) {
    this.min = min;
    this.max = max;
    this.unit = unit;
    this.input = el('input', { cls: 'range', attrs: { type: 'range', min, max, step: 1, value, 'aria-label': label } });
    this.val = el('span', { cls: 'stepper-val' });
    this.markEl = el('div', { cls: 'range-mark hidden' });
    const dec = el('button', { cls: 'step-btn', attrs: { type: 'button', 'aria-label': 'less' }, html: '&minus;' });
    const inc = el('button', { cls: 'step-btn', attrs: { type: 'button', 'aria-label': 'more' }, html: '+' });
    dec.addEventListener('click', () => this.nudge(-1));
    inc.addEventListener('click', () => this.nudge(1));
    this.input.addEventListener('input', () => this.set(+this.input.value, true));
    this.input.addEventListener('keydown', (e) => e.stopPropagation());
    this.root = el('div', {
      cls: 'stepper',
      kids: [
        el('div', { cls: 'stepper-head', kids: [el('span', { cls: 'stepper-label', text: label }), this.val] }),
        el('div', { cls: 'stepper-row', kids: [dec, el('div', { cls: 'range-wrap', kids: [this.input, this.markEl] }), inc] }),
      ],
    });
    this.set(value, false);
  }

  nudge(d: number) {
    sfx.tap();
    this.set(+this.input.value + d, true);
  }

  set(n: number, emit: boolean) {
    n = Math.max(this.min, Math.min(this.max, Math.round(n)));
    this.input.value = String(n);
    const u = this.unit === 'f' ? 'f' : this.unit === '%' ? '%' : 'px';
    this.val.textContent = `${n}${u}`;
    const pct = ((n - this.min) / Math.max(1, this.max - this.min)) * 100;
    this.input.style.setProperty('--pct', `${pct}%`);
    if (emit) this.onChange(n);
  }

  /** Show a marker (e.g. "their hit lands here") on the track. */
  mark(n: number | null, label = '') {
    if (n === null || n < this.min || n > this.max) {
      this.markEl.classList.add('hidden');
      return;
    }
    this.markEl.classList.remove('hidden');
    this.markEl.style.left = `${((n - this.min) / Math.max(1, this.max - this.min)) * 100}%`;
    this.markEl.title = label;
  }

  get value(): number {
    return +this.input.value;
  }
}

// ------------------------------------------------------------ choices --

export function segmented<T extends string | number>(
  options: { v: T; label: string; icon?: string; title?: string }[],
  value: T,
  onPick: (v: T) => void,
  cls = '',
): HTMLElement {
  const root = el('div', { cls: `seg ${cls}`, attrs: { role: 'radiogroup' } });
  const render = (cur: T) => {
    root.replaceChildren(
      ...options.map((o) =>
        el('button', {
          cls: 'seg-btn' + (o.v === cur ? ' on' : ''),
          attrs: { type: 'button', role: 'radio', 'aria-checked': o.v === cur, title: o.title },
          html: (o.icon ? icon(o.icon, 16) : '') + `<span>${o.label}</span>`,
          on: {
            click: () => {
              sfx.tap();
              render(o.v);
              onPick(o.v);
            },
          },
        }),
      ),
    );
  };
  render(value);
  return root;
}

export function toggle(label: string, value: boolean, onChange: (v: boolean) => void, sub = ''): HTMLElement {
  const b = el('button', {
    cls: 'toggle' + (value ? ' on' : ''),
    attrs: { type: 'button', role: 'switch', 'aria-checked': value },
    kids: [
      el('span', { cls: 'toggle-text', kids: [el('span', { cls: 'toggle-label', text: label }), sub ? el('span', { cls: 'toggle-sub', text: sub }) : null] }),
      el('span', { cls: 'toggle-track', kids: [el('span', { cls: 'toggle-knob' })] }),
    ],
  });
  b.addEventListener('click', () => {
    value = !value;
    b.classList.toggle('on', value);
    b.setAttribute('aria-checked', String(value));
    sfx.tap();
    onChange(value);
  });
  return b;
}

export function slider(label: string, value: number, onChange: (v: number) => void, fmt = (v: number) => `${Math.round(v * 100)}%`): HTMLElement {
  const out = el('span', { cls: 'slider-val', text: fmt(value) });
  const input = el('input', { cls: 'range', attrs: { type: 'range', min: 0, max: 100, step: 1, value: Math.round(value * 100), 'aria-label': label } });
  input.style.setProperty('--pct', `${Math.round(value * 100)}%`);
  input.addEventListener('input', () => {
    const v = +input.value / 100;
    input.style.setProperty('--pct', `${input.value}%`);
    out.textContent = fmt(v);
    onChange(v);
  });
  return el('label', { cls: 'slider-row', kids: [el('span', { cls: 'slider-label', text: label }), input, out] });
}
