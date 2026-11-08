// R5-7: el arrastre entre grupos de la Estructura y de la tira no desplaza las vecinas. Con el desplazamiento de
// dnd-kit las filas se corrían por debajo de cabeceras y separadores que no se mueven, y la vista previa dibujaba la
// lámina en el grupo equivocado. Ahora las vecinas se quedan quietas y la fila de destino marca dónde entra: antes de
// ella si la lámina sube, después si baja (lo mismo que escribe `aplicarArrastre` al soltar). Pura.

import type { SortingStrategy } from "@dnd-kit/sortable";

/** Estrategia que no mueve a nadie: sólo la lámina tomada sigue al puntero (su propio transform). */
export const sinDesplazar: SortingStrategy = () => null;

export type LadoInsercion = "antes" | "despues";

/** Dónde se marca la inserción en la fila `index`, o `null` si no es el destino (o es la propia lámina tomada). */
export function ladoInsercion(index: number, activeIndex: number, overIndex: number): LadoInsercion | null {
  if (activeIndex < 0 || overIndex < 0 || index !== overIndex || index === activeIndex) return null;
  return activeIndex > overIndex ? "antes" : "despues";
}
