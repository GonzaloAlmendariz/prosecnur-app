// DOM mínimo para los tests del editor de correos (Vitest corre sin jsdom).
// Entiende el subconjunto que producen el render y el editor: etiquetas con
// atributos entre comillas dobles, `<br>`/`<img>` sin cierre, texto con las
// entidades básicas. Un `data-rect="x,y,w,h"` define lo que devuelve
// `getBoundingClientRect`. No es un parser de HTML general.

type Rect = { left: number; top: number; width: number; height: number };

export class NodoDePrueba {
  childNodes: NodoDePrueba[] = [];
  parentNode: NodoDePrueba | null = null;
  constructor(public nodeType: 1 | 3, public tagName = "", public nodeValue: string | null = null, public attrs: Record<string, string> = {}) {}

  get previousSibling(): NodoDePrueba | null {
    if (!this.parentNode) return null;
    const i = this.parentNode.childNodes.indexOf(this);
    return i > 0 ? this.parentNode.childNodes[i - 1] : null;
  }
  get cells(): NodoDePrueba[] {
    return this.childNodes.filter((n) => n.tagName === "TD");
  }
  getAttribute(name: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
  }
  hasAttribute(name: string): boolean {
    return this.getAttribute(name) !== null;
  }
  contains(other: NodoDePrueba): boolean {
    if (other === this) return true;
    return this.childNodes.some((c) => c.contains(other));
  }
  getBoundingClientRect(): Rect {
    const [x, y, w, h] = (this.getAttribute("data-rect") ?? "0,0,0,0").split(",").map(Number);
    return { left: x, top: y, width: w, height: h };
  }
  private todos(): NodoDePrueba[] {
    return this.childNodes.flatMap((c) => (c.nodeType === 1 ? [c, ...c.todos()] : []));
  }
  querySelectorAll(selector: string): NodoDePrueba[] {
    const attr = selector.match(/^\[([a-z-]+)\]$/);
    const tag = selector.match(/^[a-z]+$/);
    return this.todos().filter((n) => (attr ? n.hasAttribute(attr[1]) : tag ? n.tagName === selector.toUpperCase() : false));
  }
  querySelector(selector: string): NodoDePrueba | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  get textContent(): string {
    return this.nodeType === 3 ? this.nodeValue ?? "" : this.childNodes.map((c) => c.textContent).join("");
  }
}

const VACIAS = new Set(["br", "img", "meta", "hr"]);

function entidades(t: string): string {
  return t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

/** Parsea un fragmento HTML a un árbol de prueba con raíz `<div>`. */
export function domDePrueba(html: string): NodoDePrueba {
  const raiz = new NodoDePrueba(1, "DIV");
  const pila: NodoDePrueba[] = [raiz];
  const re = /<\/?([a-zA-Z0-9]+)((?:\s+[a-zA-Z_:-][\w:.-]*(?:="[^"]*")?)*)\s*\/?>|([^<]+)/g;
  for (const m of html.matchAll(re)) {
    const actual = pila[pila.length - 1];
    if (m[3] !== undefined) {
      const t = new NodoDePrueba(3, "", entidades(m[3]));
      t.parentNode = actual;
      actual.childNodes.push(t);
      continue;
    }
    const tag = m[1].toLowerCase();
    if (m[0].startsWith("</")) {
      const i = pila.map((n) => n.tagName).lastIndexOf(tag.toUpperCase());
      if (i > 0) pila.length = i;
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of (m[2] ?? "").matchAll(/([a-zA-Z_:-][\w:.-]*)(?:="([^"]*)")?/g)) attrs[a[1]] = entidades(a[2] ?? "");
    const el = new NodoDePrueba(1, tag.toUpperCase(), null, attrs);
    el.parentNode = actual;
    actual.childNodes.push(el);
    if (!VACIAS.has(tag) && !m[0].endsWith("/>")) pila.push(el);
  }
  return raiz;
}
