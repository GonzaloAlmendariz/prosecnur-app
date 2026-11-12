import type { ExploradorDist } from "../../../../api/validacionExplorar";

/** Cómo se lee la distribución de una pregunta de opciones (prototipo: "Porcentaje / Casos" y "Gráfico / Tabla"). */
export type LecturaDeDistribucion = { valor: "porcentaje" | "casos"; vista: "grafico" | "tabla" };

export const LECTURA_INICIAL: LecturaDeDistribucion = { valor: "porcentaje", vista: "grafico" };

/**
 * Los conmutadores aplican a una pregunta de opciones sin cruce. Un cruce ya
 * elige su lectura dentro (por columna, por fila o casos) y una numérica, una
 * fecha o un texto no tienen filas de opciones que contar.
 */
export function conmutadoresAplican(dist: ExploradorDist | null | undefined, conCruce: boolean): boolean {
  return !conCruce && !!dist && (dist.tipo === "so" || dist.tipo === "sm") && !!dist.filas;
}
