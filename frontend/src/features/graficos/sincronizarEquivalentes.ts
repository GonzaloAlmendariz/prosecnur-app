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
 * Cada derivada se reemplaza en su sitio: un mazo donde las comparaciones abren el
 * informe no puede acabar con ellas detrás de los anexos sólo por haber regenerado,
 * ni las láminas hechas a mano que viven entre ellas, detrás del bloque.
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

  // En su sitio, una a una (G15, Arte 2026-10-13): reinsertar el bloque contiguo en la primera derivada empujaba detrás
  // de todo el bloque las láminas hechas a mano que vivían intercaladas —objetivo, Top Two Box, índice—. Cada derivada
  // vieja cede su posición a la nueva del mismo orden; las que sobran se retiran y las que faltan entran tras la última.
  const ultima = slides.reduce((u, s, i) => (esEquivalente(s) ? i : u), -1);
  let resultado: Slide[];
  if (ultima === -1) {
    resultado = [...otras, ...bloque];
  } else {
    resultado = [];
    let k = 0;
    slides.forEach((s, i) => {
      if (!esEquivalente(s)) resultado.push(s);
      else if (k < bloque.length) resultado.push(bloque[k++]);
      if (i === ultima) resultado.push(...bloque.slice(k));
    });
  }

  return {
    plan: { slides: resultado },
    reemplazadas: previas.length,
    nuevas: bloque.length,
    conservadas: otras.length,
  };
}
