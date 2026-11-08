// Reordenar láminas arrastrando, en la Estructura y en la tira de miniaturas (hallazgo 11 de la auditoría de Láminas).
//
// El plan es una lista plana; capítulos, subcapítulos y bloques son tramos contiguos que `construirEstructura` deriva
// de la posición (modeloEstructura.ts). Por eso arrastrar una lámina a otro capítulo SÍ la cambia de capítulo: la deja
// en otro tramo del plan, y el árbol se vuelve a derivar. Arrastrar un separador mueve sólo el separador: el capítulo
// se reabre donde cae y toma las láminas que le siguen, igual que si se moviera con las flechas.
//
// Soltar sobre una fila deja la lámina en el lugar de esa fila (semántica de `arrayMove`): bajando queda después de
// ella, subiendo queda antes. Con nodos plegados o con la búsqueda puesta, las filas visibles son un subconjunto, pero
// el índice se toma en el plan completo, así que el resultado es el mismo que en la lista entera.

import type { NodoEstructura } from "./modeloEstructura";

/** El índice (0-based, en el plan) al que va `activo`; `null` si soltarlo no cambia nada. */
export function destinoArrastre(ids: readonly string[], activo: string, sobre: string | null): number | null {
  if (sobre === null || sobre === activo) return null;
  const desde = ids.indexOf(activo);
  const hasta = ids.indexOf(sobre);
  if (desde < 0 || hasta < 0) return null;
  return hasta;
}

/** El orden que queda (lo mismo que hace `moveSlideTo` del plan con el índice de `destinoArrastre`). */
export function moverLamina(ids: readonly string[], activo: string, sobre: string | null): string[] {
  const destino = destinoArrastre(ids, activo, sobre);
  if (destino === null) return [...ids];
  const resto = ids.filter((id) => id !== activo);
  return [...resto.slice(0, destino), activo, ...resto.slice(destino)];
}

/**
 * Los ids de las filas que la Estructura pinta, en el orden en que se ven (que es el del plan): los nodos plegados no
 * aportan filas. Son los `items` del contexto ordenable: dnd-kit sólo mide lo que existe en el DOM.
 */
export function idsVisiblesEstructura(nodos: readonly NodoEstructura[], abierto: (id: string) => boolean): string[] {
  const ids: string[] = [];
  for (const nodo of nodos) {
    if (!abierto(nodo.id)) continue;
    if (nodo.clase === "bloque") {
      ids.push(...nodo.laminas.map((l) => l.id));
      continue;
    }
    ids.push(nodo.separador.id, ...nodo.laminas.map((l) => l.id));
    for (const s of nodo.subcapitulos) ids.push(s.separador.id, ...s.laminas.map((l) => l.id));
  }
  return ids;
}

/** Lo que el arrastre necesita del plan (`usePlanStore.getState()`), para probarlo sin montar nada. */
export type PlanOrdenable = { moveSlideTo: (id: string, indice: number) => void };

/**
 * Aplica un arrastre soltado: un solo `moveSlideTo`, que es un solo paso de deshacer. `cortar` abre paso propio en el
 * historial (sin él, soltar justo después de escribir un título podía ir en el mismo paso que la escritura).
 */
export function aplicarArrastre(
  plan: PlanOrdenable,
  ids: readonly string[],
  activo: string,
  sobre: string | null,
  cortar: () => void,
): boolean {
  const destino = destinoArrastre(ids, activo, sobre);
  if (destino === null) return false;
  cortar();
  plan.moveSlideTo(activo, destino);
  return true;
}
