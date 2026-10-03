/** Small DOM helpers for the overlay UI. */

type Child = Node | string | null | undefined | false;

export interface ElOpts {
  cls?: string;
  text?: string;
  html?: string;
  attrs?: Record<string, string | number | boolean | undefined>;
  style?: Partial<CSSStyleDeclaration> & Record<string, string>;
  on?: Partial<Record<keyof HTMLElementEventMap, (e: any) => void>>;
  kids?: Child[];
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, o: ElOpts = {}): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (o.cls) e.className = o.cls;
  if (o.text != null) e.textContent = o.text;
  if (o.html != null) e.innerHTML = o.html;
  if (o.attrs)
    for (const k in o.attrs) {
      const v = o.attrs[k];
      if (v === undefined || v === false) continue;
      e.setAttribute(k, v === true ? '' : String(v));
    }
  if (o.style)
    for (const k in o.style) {
      const v = (o.style as Record<string, string>)[k];
      if (k.startsWith('--')) e.style.setProperty(k, v);
      else (e.style as unknown as Record<string, string>)[k] = v;
    }
  if (o.on) for (const k in o.on) e.addEventListener(k, (o.on as Record<string, (ev: Event) => void>)[k]);
  if (o.kids) for (const c of o.kids) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}

export function clear(n: Element) {
  while (n.firstChild) n.removeChild(n.firstChild);
}

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T | null;

/** A button that plays the UI click and runs fn. */
export function button(label: string | Node, fn: () => void, cls = 'btn', attrs: ElOpts['attrs'] = {}): HTMLButtonElement {
  const b = el('button', { cls, attrs: { type: 'button', ...attrs }, kids: [label] });
  b.addEventListener('click', (e) => {
    e.preventDefault();
    fn();
  });
  return b;
}
