/**
 * Lo que el bloque "Sugerencias para revisar" decide sin pintar (ítem 31):
 * qué línea de concentración se muestra, las columnas de la tabla de casos y
 * la dirección del diálogo de casos (`panel=sugerencia&foco=<id>`).
 */
import { conNivel } from "../../../../lib/navegacion/direccion";
import { searchConPanel, searchSinPanel } from "../../../../lib/navegacion/paneles";
import type { CasoDeSugerencia, SugerenciaParaRevisar } from "../../../../api/validacionDetector";
import { PANEL_SUGERENCIA_VALIDACION } from "../../panelesValidacion";

/**
 * La línea de concentración que va bajo la frase. Solo se muestra si dice algo
 * del caso: una persona que reúne los casos, o que se reparten. Sin rol
 * declarado, el aviso va una sola vez arriba del bloque y no en cada sugerencia.
 */
export function lineaDeConcentracion(s: SugerenciaParaRevisar): { texto: string; destacada: boolean } | null {
  const c = s.concentracion;
  if (!c || !c.texto) return null;
  if (c.estado === "concentrada") return { texto: c.texto, destacada: true };
  if (c.estado === "repartida") return { texto: c.texto, destacada: false };
  return null;
}

export type ColumnaDeCasos = { id: string; encabezado: string; valor: (c: CasoDeSugerencia) => string };

/** Fila, recopilador (si lo hay) y una columna por pregunta que mira la sugerencia. */
export function columnasDeCasos(s: SugerenciaParaRevisar, recopilador: string | null): ColumnaDeCasos[] {
  const cols: ColumnaDeCasos[] = [{ id: "fila", encabezado: "Fila", valor: (c) => (c.fila == null ? "" : String(c.fila)) }];
  if (recopilador) cols.push({ id: "recopilador", encabezado: "Recopilador", valor: (c) => c.recopilador ?? "" });
  for (const p of s.variables) {
    cols.push({ id: `v-${p.variable}`, encabezado: p.variable, valor: (c) => c.valores[p.variable] ?? "" });
  }
  return cols;
}

/** El `search` con el diálogo de casos abierto en una sugerencia. */
export function searchConCasosDeSugerencia(search: string, id: string): string {
  return conNivel(searchConPanel(conNivel(search, "foco", null), PANEL_SUGERENCIA_VALIDACION), "foco", id);
}

/** El `search` sin el diálogo de casos ni su foco. */
export function searchSinCasosDeSugerencia(search: string): string {
  return conNivel(searchSinPanel(search, PANEL_SUGERENCIA_VALIDACION), "foco", null);
}
