/**
 * Sincroniza el bloque de diapositivas que deriva la matriz de equivalencias
 * (ADR 0063/0064) sin tocar el resto del plan.
 *
 * El problema que resuelve: aplicar un plan sugerido sólo tenía dos formas y las
 * dos fallan cuando el mazo mezcla lo derivado con lo hecho a mano.
 *
 * - **Reemplazar** sustituye el plan entero: se lleva por delante el perfil
 *   sociodemográfico por actor y cualquier otra diapositiva construida a mano.
 * - **Añadir** concatena: al regenerar tras cambiar la matriz, el mazo acaba con
 *   las diapositivas de equivalencias por duplicado.
 *
 * Aquí las derivadas viven como un bloque identificable —`origen:
 * "equivalencias"`— que se reemplaza entero y en su sitio. Dentro del bloque
 * manda la regeneración; lo que quieras conservar a mano vive fuera de él.
 */

import type { PlanJson, Slide } from "../../api/graficos";

export const ORIGEN_EQUIVALENCIAS = "equivalencias";

export function esEquivalente(slide: Slide): boolean {
  return slide.origen === ORIGEN_EQUIVALENCIAS;
}

export type ResumenSincronizacion = {
  plan: PlanJson;
  /** Cuántas diapositivas derivadas había antes. */
  reemplazadas: number;
  /** Cuántas trae la propuesta nueva. */
  nuevas: number;
  /** Diapositivas del plan que no vienen de la matriz y quedan intactas. */
  conservadas: number;
};

/**
 * Devuelve el plan con el bloque de equivalencias puesto al día.
 *
 * La posición la marca la PRIMERA derivada que hubiera: el bloque se reinserta
 * donde estaba, no al final. Un mazo donde las comparaciones abren el informe no
 * puede acabar con ellas detrás de los anexos sólo por haber regenerado.
 *
 * Si no había ninguna, el bloque entra al final: es material nuevo y el sitio lo
 * decide después quien ordena el mazo.
 */
export function sincronizarEquivalentes(
  actual: PlanJson,
  derivadas: readonly Slide[],
): ResumenSincronizacion {
  const slides = actual.slides ?? [];
  const previas = slides.filter(esEquivalente);
  const otras = slides.filter((s) => !esEquivalente(s));
  const bloque = derivadas.map((s) => ({ ...s, origen: ORIGEN_EQUIVALENCIAS }));

  const primera = slides.findIndex(esEquivalente);
  let resultado: Slide[];
  if (primera === -1) {
    resultado = [...otras, ...bloque];
  } else {
    // Cuántas NO derivadas hay antes de la primera derivada: ese es el punto de
    // inserción dentro de la lista sin derivadas.
    const corte = slides.slice(0, primera).filter((s) => !esEquivalente(s)).length;
    resultado = [...otras.slice(0, corte), ...bloque, ...otras.slice(corte)];
  }

  return {
    plan: { slides: resultado },
    reemplazadas: previas.length,
    nuevas: bloque.length,
    conservadas: otras.length,
  };
}
