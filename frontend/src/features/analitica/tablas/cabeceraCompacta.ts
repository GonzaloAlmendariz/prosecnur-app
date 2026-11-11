// La cabecera de pestaña de Analítica en las pestañas con vista previa de
// tablas (Frecuencias y Cruces): la variante compacta del TabHeading, con la
// línea de casos que cuentan en la misma fila. El alto que se ahorra pasa a la
// vista previa, que a 1366x768 era la que se quedaba sin filas a la vista.

import type { AnaliticaTabId } from "../../../lib/navegacion/catalogos/procesamiento";

export const PESTANAS_CON_VISTA_PREVIA: readonly AnaliticaTabId[] = ["frecuencias", "cruces"];

export function cabeceraCompacta(pestana: AnaliticaTabId): boolean {
  return PESTANAS_CON_VISTA_PREVIA.includes(pestana);
}
