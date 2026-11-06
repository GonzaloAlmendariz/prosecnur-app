// «Un color por opción» (`colorear_por_opcion`, ADR 0130) sin efecto visible (H2 del checklist de usabilidad,
// 2026-11-05): el motor pinta cada barra con el color que la paleta de su lista da a su respuesta
// (`usar_color_categorias`, graficador_barras_agrupadas.R). Si la lista no tiene ningún color, el interruptor encendido
// no cambia nada, y la tarjeta lo dice en vez de callar.

import type { FilaPaleta } from "../../estilo/modeloPaletasConNombre";

/** ¿Las listas de las preguntas del gráfico (las halladas) no tienen ni un color? Sin lista hallada, no se afirma nada. */
export function sinColoresEnLaLista(filas: readonly Pick<FilaPaleta, "opciones" | "faltan">[]): boolean {
  return filas.length > 0 && filas.every((f) => f.opciones.length > 0 && f.faltan >= f.opciones.length);
}

export const AVISO_SIN_COLORES = "Esta lista no tiene colores: asígnalos en";
