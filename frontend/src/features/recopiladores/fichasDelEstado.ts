/**
 * Las fichas hechas salen del estado persistido, no de la sesión.
 *
 * Paquetes decía «0 de 2,373» con las fichas ya hechas: el numerador contaba
 * las instancias creadas en esta visita (un estado local que nacía vacío) y,
 * aun cargado, contaba INSTANCIAS cuando una sola cubre todas las unidades del
 * plan en `unit_refs`. Lo que se compara con el denominador son UNIDADES del
 * plan cubiertas por instancias vigentes.
 */

import type { CollectionMaterialInstance, CollectionState } from "../../api/recopiladores";

function vigentes(state: CollectionState | null | undefined): CollectionMaterialInstance[] {
  return (state?.material_instances ?? []).filter((instance) => instance.status !== "stale");
}

/** Unidades distintas del plan cubiertas por alguna instancia no stale. */
export function fichasHechasDelEstado(state: CollectionState | null | undefined): number {
  const delPlan = new Set((state?.plan?.units ?? []).map((unit) => unit.unit_id));
  if (!delPlan.size) return 0;
  const cubiertas = new Set<string>();
  for (const instance of vigentes(state)) {
    for (const unitId of instance.unit_refs ?? []) {
      if (delPlan.has(unitId)) cubiertas.add(unitId);
    }
  }
  return cubiertas.size;
}

/**
 * La instancia que «Generar» debe reutilizar: la primera vigente. Sólo cuando
 * no hay ninguna se crea otra; si no, cada visita añadía una instancia nueva.
 */
export function instanciaReutilizable(
  state: CollectionState | null | undefined,
): CollectionMaterialInstance | null {
  return vigentes(state)[0] ?? null;
}
