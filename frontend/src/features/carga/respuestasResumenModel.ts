// Los textos del resumen de «Respuestas» (modo de una base): qué preparó la app
// sobre el archivo y cómo calza con el formulario. Plurales escritos, sin «(s)»,
// y sin mencionar lo que vale cero.

import { formatoConteo, formatoConteoDe } from "../../lib/formatoNumero";

type Normalizacion = {
  applied: boolean;
  aliases: number;
  select_multiple: number;
  single_child_collapses?: number;
  extra_columns?: number;
  choice_code_maps?: { applied?: boolean; n_questions?: number } | null;
};

type Compatibilidad = {
  applied: boolean;
  ok: boolean | null;
  expected_columns?: number;
  matched_columns: number;
  missing_columns: string[];
  extra_columns: string[];
  n_missing?: number;
  n_extra?: number;
};

/** «10 selecciones múltiples reconstruidas · 18 columnas auxiliares al final». */
export function partesPreparacion(n: Normalizacion | null | undefined): string[] {
  if (!n?.applied) return [];
  const partes: string[] = [];
  if (n.aliases > 0) partes.push(formatoConteoDe(n.aliases, "nombre ajustado", "nombres ajustados"));
  if (n.select_multiple > 0) partes.push(formatoConteoDe(n.select_multiple, "selección múltiple reconstruida", "selecciones múltiples reconstruidas"));
  if ((n.single_child_collapses ?? 0) > 0) partes.push(formatoConteoDe(n.single_child_collapses, "escala unida", "escalas unidas"));
  if ((n.extra_columns ?? 0) > 0) partes.push(formatoConteoDe(n.extra_columns, "columna auxiliar al final", "columnas auxiliares al final"));
  if (n.choice_code_maps?.applied && (n.choice_code_maps.n_questions ?? 0) > 0) {
    partes.push(formatoConteoDe(n.choice_code_maps.n_questions, "pregunta con códigos ajustados", "preguntas con códigos ajustados"));
  }
  return partes;
}

/** «Calza con el formulario: 118 de 118 preguntas · 20 columnas que no son del formulario». */
export function textoCompatibilidad(c: Compatibilidad | null | undefined): { ok: boolean; texto: string } | null {
  if (!c?.applied) return null;
  const ok = !!c.ok;
  const partes: string[] = [ok ? "Calza con el formulario" : "No calza con el formulario"];
  if (typeof c.expected_columns === "number") {
    partes.push(`${formatoConteo(c.matched_columns)} de ${formatoConteoDe(c.expected_columns, "pregunta")}`);
  }
  const faltan = c.n_missing ?? c.missing_columns.length;
  if (faltan > 0) {
    const muestra = c.missing_columns.slice(0, 6).join(", ");
    partes.push(`faltan ${muestra}${faltan > 6 ? ` y ${formatoConteo(faltan - 6)} más` : ""}`);
  }
  const extra = c.n_extra ?? c.extra_columns.length;
  if (extra > 0) partes.push(formatoConteoDe(extra, "columna que no es del formulario", "columnas que no son del formulario"));
  return { ok, texto: partes.join(" · ") };
}
