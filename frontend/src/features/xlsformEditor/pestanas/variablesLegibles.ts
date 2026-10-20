import { stripMarkdown } from "../helpers/markdown";
import type { Pieza } from "../reglas/piezas";

// Una sola forma de nombrar una variable en las pestañas de reglas: la etiqueta de la pregunta en texto plano o,
// si no tiene, su código. Nada de `${x}` crudo ni comillas «» alrededor.

export type EtiquetaDe = (name: string) => string | null | undefined;

const REF = /\$\{\s*([^}\s]+)\s*\}/g;

/** Texto plano de una etiqueta: sin markdown, y cada `${x}` dentro cambiado por la etiqueta de x (o x). */
export function etiquetaPlana(texto: string, etiquetaDe?: EtiquetaDe): string {
  return stripMarkdown(texto)
    .replace(REF, (_m, n: string) => stripMarkdown(etiquetaDe?.(n) ?? "").replace(REF, "$1").trim() || n)
    .replace(/\s+/g, " ")
    .trim();
}

/** ¿Va un espacio antes de esta pieza? No ante «,», «.», «:», «)» ni después de «(». */
export function espacioAntes(previa: Pieza | undefined, pieza: Pieza): boolean {
  if (!previa) return false;
  const txt = (p: Pieza) => (p.tipo === "texto" || p.tipo === "valor" ? p.texto : "");
  if (/^[,.;:)?!]/.test(txt(pieza))) return false;
  if (/\($/.test(txt(previa))) return false;
  return true;
}

/** La frase en texto plano con las variables nombradas por su etiqueta. */
export function textoLegible(piezas: readonly Pieza[], etiquetaDe?: EtiquetaDe): string {
  return piezas
    .map((p, i) => {
      const t = p.tipo === "pregunta" ? etiquetaPlana(p.etiqueta, etiquetaDe) || p.name : p.tipo === "opcion" ? etiquetaPlana(p.etiqueta, etiquetaDe) || p.valor : p.texto;
      return (espacioAntes(piezas[i - 1], p) ? " " : "") + t;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}
