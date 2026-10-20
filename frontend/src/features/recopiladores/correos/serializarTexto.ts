// =============================================================================
// serializarTexto.ts — ida y vuelta entre el texto del contrato y el editor
// =============================================================================
// El texto de un bloque es el del contrato (`collection_mail_template/v2`):
// `**negrita**`, `{{campo}}` y, sólo donde el render los admite, enlaces
// `[texto](url)`. El editor en línea lo muestra con formato real; aquí vive la
// traducción en los dos sentidos, sin React:
//
//   htmlDelTexto(texto)  → el HTML permitido del editor
//   textoDelDom(nodo)    → el texto del contrato, recorriendo ese HTML
//
// **El DOM permitido es cerrado.** Texto, `<strong>`, `<a data-href>`,
// `<span data-campo contenteditable="false">` (el chip de un campo) y `<br>`
// en las propiedades multilínea. Cualquier otro nodo —lo que deja un pegado,
// una cursiva de Chrome, un `<div>` de Enter— se aplana a su texto: nada de lo
// que el autor pegue llega como HTML al correo.
//
// La traducción a HTML sigue el mismo orden que `.cmail_inline` en R (escapar,
// enlaces, negrita, saltos, campos), para que el editor y la vista previa
// dibujen la misma estructura.

/** Mismo patrón que `.CMAIL_LINK_RE` (collection_mail_styles.R). */
export const PATRON_ENLACE = /\[([^\]\n]+)\]\(([^()\s]+)\)/g;
/** Mismo patrón que `.CMAIL_TOKEN_RE`: `{{clave}}` en minúsculas. */
export const PATRON_CAMPO = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;

export type OpcionesDeTexto = {
  /** ¿La propiedad admite `[texto](url)`? (paragraph.text, callout, list, firma, pie). */
  enlaces: boolean;
  /** ¿Un salto de línea es parte del texto? Si no, se vuelve espacio. */
  multilinea: boolean;
  /** Rótulo visible del chip: «Carrera», no `{{carrera}}`. */
  rotuloDeCampo?: (key: string) => string;
  /** Lo que se lee al pasar el cursor sobre el chip (`{{carrera}} → *|CARRERA|*`). */
  ayudaDeCampo?: (key: string) => string;
};

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function desescaparAtributo(texto: string): string {
  return texto
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** El chip de un campo: no se edita por dentro y muestra el rótulo, no el valor. */
export function htmlDelChip(key: string, opts: Pick<OpcionesDeTexto, "rotuloDeCampo" | "ayudaDeCampo">): string {
  const rotulo = opts.rotuloDeCampo?.(key) ?? key;
  const ayuda = opts.ayudaDeCampo?.(key) ?? `{{${key}}}`;
  return `<span data-campo="${escaparHtml(key)}" contenteditable="false" class="rec-capa-chip" title="${escaparHtml(ayuda)}">${escaparHtml(rotulo)}</span>`;
}

/**
 * El texto del contrato como HTML del editor. Se escapa todo lo que escribió
 * el autor antes de poner las marcas propias: un `<` del texto llega como
 * `&lt;`, nunca como etiqueta.
 */
export function htmlDelTexto(texto: string, opts: OpcionesDeTexto): string {
  let out = escaparHtml(texto);
  if (opts.enlaces) {
    out = out.replace(PATRON_ENLACE, (_m, label: string, url: string) => {
      const href = escaparHtml(desescaparAtributo(url));
      return `<a data-href="${href}" class="rec-capa-enlace" title="${href}">${label}</a>`;
    });
  }
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\n/g, opts.multilinea ? "<br>" : " ");
  // Los campos se vuelven chips sólo en el texto, nunca dentro de un atributo
  // (la URL de un enlace puede llevar `{{codigo}}`).
  return out
    .split(/(<[^>]+>)/)
    .map((tramo) => (tramo.startsWith("<") ? tramo : tramo.replace(PATRON_CAMPO, (_m, key: string) => htmlDelChip(key, opts))))
    .join("");
}

const SIN_ANCHO = /[​‌‍﻿]/g;

function textoDeNodo(nodo: Node, opts: OpcionesDeTexto, enEnlace: boolean): string {
  if (nodo.nodeType === 3) {
    const t = (nodo.nodeValue ?? "").replace(/ /g, " ").replace(SIN_ANCHO, "");
    return opts.multilinea ? t : t.replace(/\r?\n/g, " ");
  }
  if (nodo.nodeType !== 1) return "";
  const el = nodo as Element;
  const tag = el.tagName.toLowerCase();
  const campo = el.getAttribute("data-campo");
  if (campo && /^[a-z][a-z0-9_]*$/.test(campo)) return `{{${campo}}}`;
  if (tag === "br") return opts.multilinea ? "\n" : " ";
  const hijos = Array.from(el.childNodes);
  const interior = (dentroDeEnlace: boolean) => hijos.map((h) => textoDeNodo(h, opts, dentroDeEnlace)).join("");
  if (tag === "strong" || tag === "b") {
    const inner = interior(enEnlace);
    return inner.trim() ? `**${inner}**` : inner;
  }
  if (tag === "a") {
    const href = el.getAttribute("data-href") ?? "";
    const inner = interior(true);
    if (!opts.enlaces || enEnlace || !href || !inner.trim() || /\s|[()]/.test(href)) return inner;
    return `[${inner.replace(/[[\]\n]/g, "")}](${href})`;
  }
  // Un `<div>`/`<p>` que deja Enter en Chrome es un renglón nuevo.
  if ((tag === "div" || tag === "p") && el.previousSibling) {
    return (opts.multilinea ? "\n" : " ") + interior(enEnlace);
  }
  return interior(enEnlace);
}

/**
 * Normaliza lo que deja el recorrido para que vuelva a ser texto válido:
 * - dos negritas contiguas (`**a****b**`) son una sola;
 * - un `**` sin pareja se quita (no se guarda como texto);
 * - un `{{` o `}}` suelto se quita: un campo sólo existe como chip o `{{clave}}`;
 * - los saltos al final no significan nada.
 */
export function normalizarTexto(texto: string, opts: Pick<OpcionesDeTexto, "multilinea">): string {
  let out = texto;
  while (out.includes("****")) out = out.replace("****", "");
  const pares = out.match(/\*\*/g)?.length ?? 0;
  if (pares % 2 === 1) {
    const at = out.lastIndexOf("**");
    out = out.slice(0, at) + out.slice(at + 2);
  }
  const campos: string[] = [];
  out = out.replace(PATRON_CAMPO, (m) => {
    campos.push(m);
    return `\u0000${campos.length - 1}\u0000`;
  });
  out = out.replace(/\{\{|\}\}/g, "");
  out = out.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => campos[Number(i)] ?? "");
  if (opts.multilinea) out = out.replace(/\n+$/, "");
  return out;
}

/** El texto del contrato a partir del DOM del editor. */
export function textoDelDom(raiz: Node, opts: OpcionesDeTexto): string {
  const crudo = Array.from(raiz.childNodes).map((h) => textoDeNodo(h, opts, false)).join("");
  return normalizarTexto(crudo, opts);
}

/**
 * Lo que entra al pegar: siempre texto plano. Si el portapapeles sólo trae
 * HTML (algunas apps), se toma su texto visible; ninguna etiqueta pasa.
 */
export function textoDelPegado(datos: { html?: string | null; texto?: string | null }, multilinea: boolean): string {
  let texto = datos.texto ?? "";
  if (!texto && datos.html) texto = textoVisibleDeHtml(datos.html);
  texto = texto.replace(/\r\n?/g, "\n").replace(SIN_ANCHO, "").replace(/ /g, " ");
  return multilinea ? texto.replace(/\n{3,}/g, "\n\n") : texto.replace(/\s*\n\s*/g, " ");
}

/** Texto visible de un fragmento HTML, con los bloques como renglones. */
export function textoVisibleDeHtml(html: string): string {
  if (typeof DOMParser === "undefined") {
    return html
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/\n+$/, "");
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style").forEach((n) => n.remove());
  doc.querySelectorAll("br").forEach((n) => n.replaceWith("\n"));
  doc.querySelectorAll("p,div,li,tr,h1,h2,h3,h4,h5,h6").forEach((n) => n.append("\n"));
  return (doc.body.textContent ?? "").replace(/\n+$/, "");
}

// ---- cursor -------------------------------------------------------------------
// El editor se repinta desde el texto cuando algo cambia por fuera (deshacer,
// un `**` que se vuelve negrita). El cursor se recuerda como cuántos
// caracteres visibles hay antes de él —un chip cuenta como uno— y se repone.

function largoVisible(nodo: Node): number {
  if (nodo.nodeType === 3) return (nodo.nodeValue ?? "").length;
  if (nodo.nodeType !== 1) return 0;
  const el = nodo as Element;
  if (el.hasAttribute("data-campo") || el.tagName === "BR") return 1;
  return Array.from(el.childNodes).reduce((n, h) => n + largoVisible(h), 0);
}

/** Posición del cursor como desplazamiento visible dentro de `raiz`, o `null`. */
export function desplazamientoDelCursor(raiz: Node, nodo: Node, offset: number): number | null {
  if (!raiz.contains(nodo)) return null;
  let total = 0;
  const recorrer = (actual: Node): boolean => {
    if (actual === nodo) {
      if (actual.nodeType === 3) total += offset;
      else for (let i = 0; i < offset && i < actual.childNodes.length; i += 1) total += largoVisible(actual.childNodes[i]);
      return true;
    }
    if (actual.nodeType === 1 && ((actual as Element).hasAttribute("data-campo") || (actual as Element).tagName === "BR")) {
      total += 1;
      return false;
    }
    if (actual.nodeType === 3) {
      total += (actual.nodeValue ?? "").length;
      return false;
    }
    for (const h of Array.from(actual.childNodes)) if (recorrer(h)) return true;
    return false;
  };
  for (const h of Array.from(raiz.childNodes)) if (recorrer(h)) return total;
  return raiz === nodo ? total : null;
}

/** El punto (nodo, offset) que corresponde a un desplazamiento visible. */
export function puntoDelDesplazamiento(raiz: Node, desplazamiento: number): { nodo: Node; offset: number } {
  let resta = Math.max(0, desplazamiento);
  const buscar = (actual: Node): { nodo: Node; offset: number } | null => {
    for (let i = 0; i < actual.childNodes.length; i += 1) {
      const h = actual.childNodes[i];
      if (h.nodeType === 3) {
        const largo = (h.nodeValue ?? "").length;
        if (resta <= largo) return { nodo: h, offset: resta };
        resta -= largo;
      } else if (h.nodeType === 1) {
        const el = h as Element;
        if (el.hasAttribute("data-campo") || el.tagName === "BR") {
          if (resta === 0) return { nodo: actual, offset: i };
          resta -= 1;
          if (resta === 0) return { nodo: actual, offset: i + 1 };
        } else {
          const dentro = buscar(h);
          if (dentro) return dentro;
        }
      }
    }
    return null;
  };
  return buscar(raiz) ?? { nodo: raiz, offset: raiz.childNodes.length };
}
