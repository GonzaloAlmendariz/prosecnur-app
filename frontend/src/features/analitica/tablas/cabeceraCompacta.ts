// Las pestañas de Analítica que dibujan su propia cabecera de pestaña: las de
// vista previa de tablas (Frecuencias y Cruces). Como en el prototipo del
// rediseño, su cabecera lleva las cifras del archivo y la acción principal; la
// página no pinta la suya y les pasa la pestaña y la barra de fuente.

import type { AnaliticaTabId } from "../../../lib/navegacion/catalogos/procesamiento";

export const PESTANAS_CON_VISTA_PREVIA: readonly AnaliticaTabId[] = ["frecuencias", "cruces"];

export function cabeceraCompacta(pestana: AnaliticaTabId): boolean {
  return PESTANAS_CON_VISTA_PREVIA.includes(pestana);
}
