// =============================================================================
// serializarTexto.ts — ida y vuelta entre el texto del contrato y el editor
// =============================================================================
// El texto de un bloque es el del contrato (`collection_mail_template/v2`):
// `**negrita**`, `*cursiva*`, `***ambas***`, `{{campo}}` y, sólo donde el
// render los admite, enlaces `[texto](url)`. Un asterisco que es texto se
// escribe `\*` («5\*3»): así nunca abre una cursiva. El editor en línea lo
// muestra con formato real; aquí vive la traducción en los dos sentidos, sin
// React:
//
//   htmlDelTexto(texto)  → el HTML permitido del editor
//   textoDelDom(nodo)    → el texto del contrato, recorriendo ese HTML
//
// **El DOM permitido es cerrado.** Texto, `<strong>`/`<b>`, `<em>`/`<i>`,
// `<a data-href>`, `<span data-campo contenteditable="false">` (el chip de un
// campo) y `<br>` en las propiedades multilínea. Cualquier otro nodo —lo que
// deja un pegado, una fuente, un `<div>` de Enter— se aplana a su texto: nada
// de lo que el autor pegue llega como HTML al correo.
//
// **Marcas sin ambigüedad.** El texto se escribe por tramos de formato
// parejo: cada tramo lleva sus marcas completas (`**a** ***b*** **c**`, no
// `**a *b* c**`), los espacios de sus bordes quedan fuera de las marcas y dos
// tramos con formato distinto que se tocan sin espacio (un cambio a mitad de
// palabra) se quedan con el formato que comparten. El lector, en cambio,
// entiende también las formas anidadas que produce el importador
// (`*a **b***`): es el mismo emparejamiento con pila de
// `collection_mail_marks.R`.
//
// La traducción a HTML sigue el mismo orden que `.cmail_inline` en R (escapar,
// enlaces, énfasis, saltos, campos), para que el editor y la vista previa
// dibujen la misma estructura.

/** Mismo patrón que `.CMAIL_LINK_RE` (collection_mail_styles.R). */
export const PATRON_ENLACE = /\[([^\]\n]+)\]\(([^()\s]+)\)/g;
/** Asterisco literal (`\*`): nunca es marca. */
export const PATRON_ASTERISCO_LITERAL = /\\\*/g;
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

const LITERAL = "\u0001";

type Etiqueta = (tipo: "strong" | "em", cierre: boolean) => string;
type Corrida = { inicio: number; largo: number; abre: boolean; cierra: boolean };

/**
 * Una línea con sus marcas resueltas. Espejo de `.cmail_marks_line`
 * (collection_mail_marks.R): un asterisco abre si lo sigue algo que no es
 * espacio y cierra si lo precede algo que no es espacio; los pares se
 * emparejan con una pila (el cierre busca la apertura más cercana; dos o más
 * de cada lado hacen negrita, uno cursiva) y lo que no empareja queda literal.
 * Así `***a** b*` es `<em><strong>a</strong> b</em>`.
 */
function marcasDeLinea(linea: string, etiqueta: Etiqueta): string {
  const chars = Array.from(linea);
  if (!chars.includes("*")) return linea;
  const espacio = (c: string) => /^\s$/.test(c);
  const corridas: Corrida[] = [];
  for (let i = 0; i < chars.length; ) {
    if (chars[i] !== "*") { i += 1; continue; }
    let j = i;
    while (j + 1 < chars.length && chars[j + 1] === "*") j += 1;
    const antes = i > 0 ? chars[i - 1] : " ";
    const despues = j + 1 < chars.length ? chars[j + 1] : " ";
    corridas.push({ inicio: i, largo: j - i + 1, abre: !espacio(despues), cierra: !espacio(antes) });
    i = j + 1;
  }
  const resto = corridas.map((c) => c.largo);
  const aperturas: string[][] = corridas.map(() => []);
  const cierres: string[][] = corridas.map(() => []);
  const activa = corridas.map(() => true);
  corridas.forEach((c, k) => {
    if (!c.cierra) return;
    let o = k - 1;
    while (resto[k] > 0 && o >= 0) {
      if (!corridas[o].abre || !activa[o] || resto[o] === 0) { o -= 1; continue; }
      const usa = resto[o] >= 2 && resto[k] >= 2 ? 2 : 1;
      const tipo = usa === 2 ? "strong" : "em";
      resto[o] -= usa;
      resto[k] -= usa;
      aperturas[o] = [etiqueta(tipo, false), ...aperturas[o]];
      cierres[k] = [...cierres[k], etiqueta(tipo, true)];
      // Lo que quedó entre la apertura y el cierre ya no empareja (CommonMark).
      for (let x = o + 1; x <= k - 1; x += 1) activa[x] = false;
      if (resto[o] === 0) o -= 1;
    }
  });
  let out = "";
  let pos = 0;
  corridas.forEach((c, k) => {
    out += chars.slice(pos, c.inicio).join("") + cierres[k].join("") + "*".repeat(resto[k]) + aperturas[k].join("");
    pos = c.inicio + c.largo;
  });
  return out + chars.slice(pos).join("");
}

function aplicarMarcas(texto: string, etiqueta: Etiqueta): string {
  const conLiterales = texto.split("\\*").join(LITERAL);
  return conLiterales.split("\n").map((l) => marcasDeLinea(l, etiqueta)).join("\n").split(LITERAL).join("*");
}

/**
 * Las marcas de énfasis como `<strong>`/`<em>`; un `\*` queda como `*` de
 * texto. Recibe texto ya escapado (o que no necesita escaparse).
 */
export function enfasisAHtml(texto: string): string {
  return aplicarMarcas(texto, (tipo, cierre) => (cierre ? `</${tipo}>` : `<${tipo}>`));
}

/** El texto sin marcas de énfasis (`.cmail_marks_strip`): resumen, texto plano. */
export function sinEnfasis(texto: string): string {
  return aplicarMarcas(texto, () => "");
}

/** Un asterisco de texto, escrito para que no abra una marca. */
export function escaparAsteriscos(texto: string): string {
  return texto.replace(/\*/g, "\\*");
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
  out = enfasisAHtml(out);
  out = out.replace(/\n/g, opts.multilinea ? "<br>" : " ");
  // Los campos se vuelven chips sólo en el texto, nunca dentro de un atributo
  // (la URL de un enlace puede llevar `{{codigo}}`).
  return out
    .split(/(<[^>]+>)/)
    .map((tramo) => (tramo.startsWith("<") ? tramo : tramo.replace(PATRON_CAMPO, (_m, key: string) => htmlDelChip(key, opts))))
    .join("");
}

const SIN_ANCHO = /[​‌‍﻿]/g;

type Formato = { b: boolean; i: boolean };

/** Lo que queda del DOM: tramos de texto, chips, saltos y enlaces, cada uno con su formato. */
type Unidad =
  | ({ t: "texto"; texto: string } & Formato)
  | ({ t: "campo"; key: string } & Formato)
  | { t: "salto" }
  | { t: "enlace"; href: string; unidades: Unidad[] };

const SIN_FORMATO: Formato = { b: false, i: false };

/** El formato que pone un elemento: etiqueta o `style` (lo que deja Chrome al quitar una marca). */
function formatoDe(el: Element, actual: Formato): Formato {
  const tag = el.tagName.toLowerCase();
  let { b, i } = actual;
  if (tag === "strong" || tag === "b") b = true;
  if (tag === "em" || tag === "i") i = true;
  const style = (el.getAttribute("style") ?? "").toLowerCase();
  const peso = style.match(/font-weight\s*:\s*([a-z0-9]+)/)?.[1];
  if (peso) b = peso === "bold" || peso === "bolder" || Number(peso) >= 600;
  const estilo = style.match(/font-style\s*:\s*([a-z]+)/)?.[1];
  if (estilo) i = estilo === "italic" || estilo === "oblique";
  return { b, i };
}

function unidadesDe(nodo: Node, opts: OpcionesDeTexto, formato: Formato, enEnlace: boolean): Unidad[] {
  if (nodo.nodeType === 3) {
    const t = (nodo.nodeValue ?? "").replace(/\u00a0/g, " ").replace(SIN_ANCHO, "");
    const texto = opts.multilinea ? t : t.replace(/\r?\n/g, " ");
    return texto ? [{ t: "texto", texto, ...formato }] : [];
  }
  if (nodo.nodeType !== 1) return [];
  const el = nodo as Element;
  const tag = el.tagName.toLowerCase();
  const campo = el.getAttribute("data-campo");
  if (campo && /^[a-z][a-z0-9_]*$/.test(campo)) return [{ t: "campo", key: campo, ...formato }];
  if (tag === "br") return [opts.multilinea ? { t: "salto" } : { t: "texto", texto: " ", ...formato }];
  const propio = formatoDe(el, formato);
  const hijos = (dentroDeEnlace: boolean) => Array.from(el.childNodes).flatMap((h) => unidadesDe(h, opts, propio, dentroDeEnlace));
  if (tag === "a") {
    const href = el.getAttribute("data-href") ?? "";
    const interior = hijos(true);
    const conTexto = interior.some((u) => u.t === "campo" || (u.t === "texto" && u.texto.trim()));
    if (!opts.enlaces || enEnlace || !href || !conTexto || /\s|[()]/.test(href)) return interior;
    return [{ t: "enlace", href, unidades: interior }];
  }
  // Un `<div>`/`<p>` que deja Enter en Chrome es un renglón nuevo.
  if ((tag === "div" || tag === "p") && el.previousSibling) {
    const salto: Unidad = opts.multilinea ? { t: "salto" } : { t: "texto", texto: " ", ...SIN_FORMATO };
    return [salto, ...hijos(enEnlace)];
  }
  return hijos(enEnlace);
}

function esBlanco(u: Unidad): boolean {
  return u.t === "texto" && !u.texto.trim();
}

/** El formato de una unidad; el de un enlace es el que comparte todo su texto. */
function formatoDeUnidad(u: Unidad): Formato {
  if (u.t === "salto") return SIN_FORMATO;
  if (u.t !== "enlace") return { b: u.b, i: u.i };
  const llenas = u.unidades.filter((x) => !esBlanco(x) && x.t !== "salto");
  if (!llenas.length) return SIN_FORMATO;
  return llenas.map(formatoDeUnidad).reduce((a, f) => ({ b: a.b && f.b, i: a.i && f.i }));
}

function restar(f: Formato, base: Formato): Formato {
  return { b: f.b && !base.b, i: f.i && !base.i };
}

const igual = (a: Formato, b: Formato) => a.b === b.b && a.i === b.i;
const conFormato = (f: Formato) => f.b || f.i;
const marcaDe = (f: Formato) => (f.b && f.i ? "***" : f.b ? "**" : f.i ? "*" : "");

type Tramo = { formato: Formato; unidades: Unidad[] };

/** Espacios que un tramo tiene al principio y al final (quedan fuera de sus marcas). */
function bordes(unidades: readonly Unidad[]): { antes: string; despues: string } {
  const primera = unidades[0];
  const ultima = unidades[unidades.length - 1];
  const antes = primera?.t === "texto" ? primera.texto.match(/^\s*/)?.[0] ?? "" : "";
  const despues = ultima?.t === "texto" ? ultima.texto.match(/\s*$/)?.[0] ?? "" : "";
  return { antes, despues };
}

function tramosDe(unidades: readonly Unidad[], base: Formato): Tramo[] {
  const formatos = unidades.map((u) => restar(formatoDeUnidad(u), base));
  // Un espacio suelto entre dos tramos iguales es parte de ellos; si no, va sin formato.
  for (;;) {
    const tramos: { formato: Formato; desde: number; hasta: number }[] = [];
    formatos.forEach((f, idx) => {
      const ultimo = tramos[tramos.length - 1];
      if (ultimo && igual(ultimo.formato, f) && unidades[idx].t !== "salto" && unidades[ultimo.hasta].t !== "salto") ultimo.hasta = idx;
      else tramos.push({ formato: f, desde: idx, hasta: idx });
    });
    // Dos tramos con formato distinto que se tocan sin espacio se quedan con lo que comparten.
    let tocado = false;
    for (let k = 0; k + 1 < tramos.length; k += 1) {
      const a = tramos[k];
      const b = tramos[k + 1];
      if (!conFormato(a.formato) || !conFormato(b.formato)) continue;
      const finA = bordes(unidades.slice(a.desde, a.hasta + 1)).despues;
      const inicioB = bordes(unidades.slice(b.desde, b.hasta + 1)).antes;
      if (finA || inicioB) continue;
      const comun = { b: a.formato.b && b.formato.b, i: a.formato.i && b.formato.i };
      for (let x = a.desde; x <= b.hasta; x += 1) formatos[x] = comun;
      tocado = true;
      break;
    }
    if (!tocado) return tramos.map((t) => ({ formato: t.formato, unidades: unidades.slice(t.desde, t.hasta + 1) }));
  }
}

function escribirUnidad(u: Unidad, base: Formato): string {
  switch (u.t) {
    case "texto": return escaparAsteriscos(u.texto);
    case "campo": return `{{${u.key}}}`;
    case "salto": return "\n";
    case "enlace": {
      const propio = formatoDeUnidad(u);
      const dentro = { b: base.b || propio.b, i: base.i || propio.i };
      return `[${escribir(u.unidades, dentro).replace(/[[\]\n]/g, "")}](${u.href})`;
    }
  }
}

function escribir(unidades: readonly Unidad[], base: Formato): string {
  return tramosDe(unidades, base).map(({ formato, unidades: grupo }) => {
    const dentro = { b: base.b || formato.b, i: base.i || formato.i };
    const cuerpo = grupo.map((u) => escribirUnidad(u, dentro)).join("");
    if (!conFormato(formato)) return cuerpo;
    const antes = cuerpo.match(/^\s*/)?.[0] ?? "";
    const resto = cuerpo.slice(antes.length);
    const despues = resto.match(/\s*$/)?.[0] ?? "";
    const centro = resto.slice(0, resto.length - despues.length);
    if (!centro) return cuerpo;
    const marca = marcaDe(formato);
    return `${antes}${marca}${centro}${marca}${despues}`;
  }).join("");
}

/**
 * Normaliza lo que deja el recorrido para que vuelva a ser texto válido:
 * - dos negritas contiguas (`**a****b**`) son una sola;
 * - un `**` sin pareja se quita (no se guarda como texto);
 * - un `{{` o `}}` suelto se quita: un campo sólo existe como chip o `{{clave}}`;
 * - los saltos al final no significan nada.
 * Un asterisco literal (`\*`) no cuenta como marca.
 */
export function normalizarTexto(texto: string, opts: Pick<OpcionesDeTexto, "multilinea">): string {
  let out = texto.replace(PATRON_ASTERISCO_LITERAL, LITERAL);
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
  return out.replace(/\u0001/g, "\\*");
}

/** El texto del contrato a partir del DOM del editor. */
export function textoDelDom(raiz: Node, opts: OpcionesDeTexto): string {
  const unidades = Array.from(raiz.childNodes).flatMap((h) => unidadesDe(h, opts, SIN_FORMATO, false));
  return normalizarTexto(escribir(unidades, SIN_FORMATO), opts);
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
