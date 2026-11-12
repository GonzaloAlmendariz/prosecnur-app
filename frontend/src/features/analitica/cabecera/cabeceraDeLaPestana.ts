// Qué pestañas de Analítica dibujan su propia cabecera de pestaña.
//
// Frecuencias y Cruces (vista previa de las tablas) y Ponderación (recorrido
// por pasos) se rehicieron con la forma del prototipo: su cabecera lleva sus
// cifras y su acción principal, y la página no pinta la suya. Las demás usan la
// cabecera común del kit que pinta la página (`CabeceraDeAnalitica`) hasta que
// se rehaga su contenido.

import type { AnaliticaTabId } from "../../../lib/navegacion/catalogos/procesamiento";
import { cabeceraCompacta } from "../tablas/cabeceraCompacta";

export const PESTANAS_CON_CABECERA_PROPIA: readonly AnaliticaTabId[] = ["frecuencias", "cruces", "ponderacion"];

export function cabeceraPropia(pestana: AnaliticaTabId): boolean {
  return cabeceraCompacta(pestana) || PESTANAS_CON_CABECERA_PROPIA.includes(pestana);
}
