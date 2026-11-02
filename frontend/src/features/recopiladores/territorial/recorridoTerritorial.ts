// Los números del recorrido de la campaña territorial (revamp v5): qué falta en cada
// sección y cuánto de lo que lee Monitoreo ya está armado. Puro, para probarlo sin red.

import type { AsignacionTerritorial, UnidadesTerritoriales } from "../../../api/materialTerritorial";
import type { ResumenDistrito } from "./revisionUnidades";

export type RecorridoTerritorial = {
  /** Rutas por revisar (titular o reemplazo con aviso o error), como en Selección. */
  porRevisar: number;
  /** Unidades de trabajo que cuentan para la asignación: UMP titulares o zonas. */
  total: number;
  /** De esas, cuántas tienen encuestador en la asignación guardada. */
  asignadas: number;
  /** total − asignadas; es el pendiente de Entrega. */
  sinAsignar: number;
};

export function recorridoTerritorial(
  unidades: UnidadesTerritoriales | null,
  distritos: readonly ResumenDistrito[],
  asignacion: AsignacionTerritorial | null,
): RecorridoTerritorial {
  const porRevisar = unidades?.kind === "cuotas" ? 0 : distritos.reduce((a, d) => a + d.porRevisar, 0);
  const total = !unidades ? 0 : unidades.kind === "cuotas" ? unidades.n_zonas : unidades.n_titulares;
  // En cuotas la asignación usa `id_manzana` = id de la zona; en UMP sólo cuentan las titulares.
  const ids = new Set(
    (asignacion?.asignacion ?? [])
      .filter((a) => a.codigo && (unidades?.kind === "cuotas" || a.role === "titular"))
      .map((a) => a.id_manzana),
  );
  const asignadas = Math.min(ids.size, total);
  return { porRevisar, total, asignadas, sinAsignar: Math.max(total - asignadas, 0) };
}
