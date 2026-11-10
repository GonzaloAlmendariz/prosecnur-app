// El Editor de formularios sobre el kit de entregables (ADR 0133, fase 5): lo
// que el módulo agrega al kit y nada más. Puro: se prueba sin React ni red.
//
// - `MODULO_FORMULARIOS`: la carpeta del módulo en la bandeja y en `Entregables\`.
// - `EXPORTES`: título, artículo y formato de cada salida (el XLSForm y el
//   cuestionario impreso en PDF o Word).
// - `avisosDelImpreso`: los avisos que el motor deja al dibujar el
//   cuestionario; salen al pie del contenedor.

import type { Articulo } from "../../../components/entregables/generacionModelo";

export const MODULO_FORMULARIOS = "Formularios";

export type SalidaFormulario = "xlsx" | "pdf" | "word";

export const EXPORTES: Record<SalidaFormulario, { titulo: string; articulo: Articulo; formato: string }> = {
  xlsx: { titulo: "XLSForm", articulo: "el", formato: "xlsx" },
  pdf: { titulo: "Cuestionario en PDF", articulo: "el", formato: "pdf" },
  word: { titulo: "Cuestionario en Word", articulo: "el", formato: "docx" },
};

/** Los avisos del motor en el `result_data` del impreso (un escalar de R llega como texto suelto). */
export function avisosDelImpreso(resultado: unknown): string[] {
  if (!resultado || typeof resultado !== "object" || Array.isArray(resultado)) return [];
  const crudo = (resultado as Record<string, unknown>).warnings;
  const lista = Array.isArray(crudo) ? crudo : typeof crudo === "string" ? [crudo] : [];
  return lista.filter((w): w is string => typeof w === "string" && w.trim() !== "").map((w) => w.trim());
}
