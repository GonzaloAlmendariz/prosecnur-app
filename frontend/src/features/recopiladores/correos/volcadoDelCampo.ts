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
  const todo = (n: Node): string => {
    if (n.nodeType === 3) return n.nodeValue ?? "";
    if (unidad(n)) return CHIP;
    return Array.from(n.childNodes).map(todo).join("");
  };
  const recorrer = (actual: Node): boolean => {
    if (actual === nodo) {
      if (actual.nodeType === 3) out += (actual.nodeValue ?? "").slice(0, offset);
      else out += Array.from(actual.childNodes).slice(0, offset).map(todo).join("");
      return true;
    }
    if (actual.nodeType === 3 || unidad(actual)) {
      out += todo(actual);
      return false;
    }
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

export type Volcado = {
  /** El texto del contrato que sale del DOM. */
  texto: string;
  /** Si hay que repintar: el HTML nuevo y dónde va el cursor (desplazamiento visible). */
  repintar: { html: string; cursor: number | null } | null;
};

/**
 * El volcado de un campo de una línea: el texto del contrato y, si quedó una
 * llave escrita, el HTML con el chip y el cursor justo después de lo escrito.
 */
export function volcarCampo(raiz: Node, cursor: { nodo: Node; offset: number } | null, opciones: OpcionesDeTexto): Volcado {
  const texto = textoDelDom(raiz, opciones);
  if (!hayLlaveEscrita(raiz)) return { texto, repintar: null };
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
