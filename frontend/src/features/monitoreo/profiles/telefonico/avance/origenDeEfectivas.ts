/**
 * De dónde salen las efectivas de las cuotas del corte (reparo 1 del numerador,
 * 3/11). El motor cuenta la efectiva de Kobo cuando la plataforma trae
 * respuestas y «Completa» de la hoja cuando no; cada fila de `cuotas_variable`
 * lo publica en `Origen`. Ritmo, Avance › Cuotas y la barra lo escriben igual.
 */
export type OrigenDeEfectivas = "kobo" | "hoja" | "mixto";

export function origenDeEfectivas(filas: ReadonlyArray<Record<string, unknown>>): OrigenDeEfectivas {
  const origenes = new Set(filas.map((fila) => String(fila.Origen ?? "").trim().toLowerCase()).filter(Boolean));
  if (origenes.has("hoja") && origenes.has("kobo")) return "mixto";
  return origenes.has("hoja") ? "hoja" : "kobo";
}

/** «de la hoja», «de Kobo y de la hoja»; vacío con Kobo, que es lo que la vista ya da por dicho. */
export function sufijoDeOrigen(origen: OrigenDeEfectivas | null | undefined): string {
  if (origen === "hoja") return " de la hoja";
  if (origen === "mixto") return " de Kobo y de la hoja";
  return "";
}
