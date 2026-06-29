/** Tiny DOM helpers for the overlay UI. */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: {
    cls?: string;
    text?: string;
    html?: string;
    attrs?: Record<string, string>;
    style?: Partial<CSSStyleDeclaration>;
    on?: Partial<Record<keyof HTMLElementEventMap, (e: any) => void>>;
    children?: (HTMLElement | null | undefined)[];
  } = {},
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (opts.cls) e.className = opts.cls;
  if (opts.text != null) e.textContent = opts.text;
  if (opts.html != null) e.innerHTML = opts.html;
  if (opts.attrs) for (const k in opts.attrs) e.setAttribute(k, opts.attrs[k]);
  if (opts.style) Object.assign(e.style, opts.style);
  if (opts.on)
    for (const k in opts.on) e.addEventListener(k, (opts.on as any)[k]);
  if (opts.children)
    for (const c of opts.children) if (c) e.appendChild(c);
  return e;
}

export function clear(node: HTMLElement) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function overlay(): HTMLElement {
  let o = document.getElementById('overlay');
  if (!o) {
    o = el('div', { attrs: { id: 'overlay' } });
    document.body.appendChild(o);
  }
  return o;
}
