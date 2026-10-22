// volcadoDelCampo.ts — lo que pasa con el DOM de un campo con chips al escribir.
//
// Cuando una llave tecleada o pegada se vuelve chip, el campo se repinta desde
// el texto del contrato y el cursor saltaba al principio («ZEstimado…», N4 del
// re-QA e10). Aquí se decide, sin React, el texto que sale y dónde queda el
// cursor después de repintar: lo escrito antes del cursor, con cada llave ya
// convertida en un chip (que cuenta como un carácter).

import { PATRON_CAMPO, htmlDelTexto, textoDelDom, type OpcionesDeTexto } from "./serializarTexto";

const CHIP = "\u0002";
const LLAVE = new RegExp(PATRON_CAMPO.source);

/** Lo visible antes de `(nodo, offset)`, con chips y saltos como un carácter. */
export function visibleAntesDelCursor(raiz: Node, nodo: Node, offset: number): string | null {
  if (!raiz.contains(nodo)) return null;
  let out = "";
  const unidad = (n: Node) => n.nodeType === 1 && ((n as Element).hasAttribute("data-campo") || (n as Element).tagName === "BR");
  // Un `<div>`/`<p>` que no es el primero es un renglón nuevo (así lo lee textoDelDom): un salto.
  const renglon = (n: Node) => n.nodeType === 1 && /^(DIV|P)$/.test((n as Element).tagName) && n.previousSibling !== null ? CHIP : "";
  const todo = (n: Node): string => {
    if (n.nodeType === 3) return n.nodeValue ?? "";
    if (unidad(n)) return CHIP;
    return renglon(n) + Array.from(n.childNodes).map(todo).join("");
  };
  const recorrer = (actual: Node): boolean => {
    if (actual === nodo) {
      if (actual.nodeType === 3) out += (actual.nodeValue ?? "").slice(0, offset);
      else out += renglon(actual) + Array.from(actual.childNodes).slice(0, offset).map(todo).join("");
      return true;
    }
    if (actual.nodeType === 3 || unidad(actual)) {
      out += todo(actual);
      return false;
    }
    out += renglon(actual);
    for (const h of Array.from(actual.childNodes)) if (recorrer(h)) return true;
    return false;
  };
  if (raiz === nodo) return Array.from(raiz.childNodes).slice(0, offset).map(todo).join("");
  for (const h of Array.from(raiz.childNodes)) if (recorrer(h)) return out;
  return null;
}

/** El desplazamiento del cursor tal como quedará cuando cada llave escrita sea un chip. */
export function desplazamientoConChips(raiz: Node, nodo: Node, offset: number): number | null {
  const antes = visibleAntesDelCursor(raiz, nodo, offset);
  return antes === null ? null : antes.replace(new RegExp(PATRON_CAMPO.source, "g"), CHIP).length;
}

/** ¿Quedó una llave escrita a mano que hay que volver chip? */
export function hayLlaveEscrita(raiz: Node): boolean {
  return LLAVE.test(raiz.textContent ?? "");
}

/** Lo que el DOM del editor admite: texto, negrita, cursiva, enlaces, chips y saltos. */
const ETIQUETAS_PROPIAS = new Set(["STRONG", "B", "EM", "I", "A", "BR"]);

/**
 * ¿Hay un nodo fuera del DOM permitido? Un `<div>` del Enter de Chrome, un
 * `<span>` o una `<font>` de un pegado: el campo se repinta desde el
 * texto del contrato para que lo que se ve sea lo que se guarda.
 */
export function hayNodoAjeno(raiz: Node): boolean {
  return Array.from(raiz.childNodes).some((n) => {
    if (n.nodeType !== 1) return false;
    const el = n as Element;
    if (el.hasAttribute("data-campo")) return false;
    if (!ETIQUETAS_PROPIAS.has(el.tagName.toUpperCase())) return true;
    return hayNodoAjeno(el);
  });
}

/**
 * La posición del cursor en el texto del contrato completo. `antes` es el
 * texto del contrato de lo que hay antes del cursor: si el cursor está dentro
 * de una negrita, `antes` la cierra (`**hol**`) y el texto completo no
 * (`**hola**`). Lo que comparten es la posición válida: insertar ahí deja el
 * campo dentro de la negrita y nunca parte una marca.
 */
export function cursorEnElContrato(antes: string, completo: string): number {
  let i = 0;
  while (i < antes.length && i < completo.length && antes[i] === completo[i]) i += 1;
  // No partir un `\*` (asterisco de texto) ni una marca a medias: se retrocede a su inicio.
  while (i > 0 && (completo[i - 1] === "\\" || (completo[i - 1] === "*" && completo[i] === "*"))) i -= 1;
  return i;
}

export type Volcado = {
  /** El texto del contrato que sale del DOM. */
  texto: string;
  /** Si hay que repintar: el HTML nuevo y dónde va el cursor (desplazamiento visible). */
  repintar: { html: string; cursor: number | null } | null;
};

/**
 * El volcado de un campo del inspector: el texto del contrato y, si quedó una
 * llave escrita o un nodo ajeno, el HTML limpio y el cursor justo después de
 * lo escrito.
 */
export function volcarCampo(raiz: Node, cursor: { nodo: Node; offset: number } | null, opciones: OpcionesDeTexto): Volcado {
  const texto = textoDelDom(raiz, opciones);
  if (!hayLlaveEscrita(raiz) && !hayNodoAjeno(raiz)) return { texto, repintar: null };
  const enChips = cursor ? desplazamientoConChips(raiz, cursor.nodo, cursor.offset) : null;
  return { texto, repintar: { html: htmlDelTexto(texto, opciones), cursor: enChips } };
}

/**
 * Una entrada en el campo: vuelca el DOM, avisa el texto nuevo si cambió y
 * devuelve qué repintar. `ultimo` es el último texto avisado.
 */
export function procesarEntrada(entrada: {
  raiz: Node;
  cursor: { nodo: Node; offset: number } | null;
  opciones: OpcionesDeTexto;
  ultimo: string | null;
  onCambio: (texto: string) => void;
}): Volcado {
  const out = volcarCampo(entrada.raiz, entrada.cursor, entrada.opciones);
  if (out.texto !== entrada.ultimo) entrada.onCambio(out.texto);
  return out;
}
