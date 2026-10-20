// Texto de pregunta como lo lee la persona encuestada (E6/E8, 2026-10-20). Una sola regla para Cuestionario y Probar:
// `${x}` nunca sale crudo (en Probar va la respuesta ya dada, si no la hay «[Etiqueta corta]» o el código), el
// markdown se pinta y `<br>` es un salto de línea. Las filas técnicas (una nota de imagen sin texto, la pista que
// repite el nombre de una fila rota) no se muestran como si fueran contenido.

import type { BuilderNode } from "../types";
import { renderMarkdownInline, stripMarkdown } from "./markdown";

/** Cómo se lee una referencia `${x}`: su respuesta (si la hay) y su etiqueta. */
export type LectorReferencias = {
  etiquetaDe: (name: string) => string | undefined;
  /** Respuesta ya dada, como texto legible. Sólo en Probar. */
  respuestaDe?: (name: string) => string | undefined;
};

const BR = /<br\s*\/?>/gi;

/** `<br>`, `<br/>` y `<br />` son saltos de línea. */
export function conSaltos(texto: string): string {
  return (texto ?? "").replace(BR, "\n");
}

/** «[Etiqueta corta]» si la etiqueta cabe en 48 caracteres y no cita a otra, si no «[código]». */
export function rotuloDeReferencia(name: string, etiqueta: string | undefined): string {
  const e = stripMarkdown(conSaltos(etiqueta ?? "")).replace(/\s+/g, " ").replace(/[?¿:]+$/g, "").trim();
  return `[${e && e.length <= 48 && !e.includes("${") ? e : name}]`;
}

/** Reemplaza cada `${x}` por la respuesta dada o por su rótulo de referencia. */
export function conReferencias(texto: string, lector: LectorReferencias): string {
  return (texto ?? "").replace(/\$\{\s*([^}\s]+)\s*\}/g, (_m, name: string) => {
    const r = lector.respuestaDe?.(name)?.trim();
    return r ? r : rotuloDeReferencia(name, lector.etiquetaDe(name));
  });
}

/** HTML seguro (escapado por renderMarkdownInline) del texto de una pregunta, nota u opción. */
export function textoPreguntaHtml(texto: string, lector: LectorReferencias): string {
  return renderMarkdownInline(conSaltos(conReferencias(texto, lector)));
}

/** El mismo texto sin marcas, para `aria-label`, `<option>` y `title`. */
export function textoPreguntaPlano(texto: string, lector: LectorReferencias): string {
  return stripMarkdown(conSaltos(conReferencias(texto, lector))).replace(/\s*\n\s*/g, " ").trim();
}

/**
 * Una nota sin texto (la imagen del logo del ACNUR): no es contenido que se lea. El índice rellena la etiqueta vacía
 * con el `name`, así que una nota cuya etiqueta es su propio nombre también cuenta como vacía.
 */
export function esNotaSinTexto(nodo: Pick<BuilderNode, "kind" | "label" | "name">): boolean {
  if (nodo.kind !== "note") return false;
  const t = stripMarkdown(conSaltos(nodo.label ?? "")).trim();
  return !t || t === (nodo.name ?? "").trim();
}

/** La pista que se muestra, o "" si es técnica (repite el nombre de la fila, caso REG02_Other_recod). */
export function pistaLegible(nodo: Pick<BuilderNode, "hint" | "name">): string {
  const h = (nodo.hint ?? "").trim();
  return h && h !== (nodo.name ?? "").trim() ? h : "";
}

/** Una lectura del motor que cita etiquetas con `${x}` o `<br>` adentro, en una línea legible (Mapa de lógica, E11b). */
export function lecturaPlana(texto: string, lector: LectorReferencias): string {
  return conSaltos(conReferencias(texto, lector)).replace(/\s*\n\s*/g, " ").trim();
}
