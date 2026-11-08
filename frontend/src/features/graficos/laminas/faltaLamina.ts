// Lo que le falta a una lámina para poder dibujarse (Q4-2 y Q4-4 de la prueba con Arte, 2026-11-07). Mientras falte un
// dato obligatorio no se sabe cómo va a salir: el inspector no dice «Sale como imagen» y el visor no pide la vista previa
// al motor (que respondería con un error de dibujo), sino que deja la maqueta con lo que falta. Cubre la brecha entre
// grupos (aperturas del resumen y recetario), que tiene un orden de elección declarado, y el indicador (R5-2): el
// panorama, el contraste entre públicos y las fortalezas no se dibujan sin `corte` (el motor aborta: graficos_panorama_plan.R,
// graficos_fortalezas_plan.R, graficos_ola4_plan.R). Pura: sin React.

import type { GraficadorRef, Slide } from "../../../api/graficos";
import { SLIDE_GRAF_SLOTS } from "../store";
import { corteDe, esEntreGrupos, faltaEnBrecha } from "./brecha/modeloBrechaGrupos";

/** Lo que dice la maqueta cuando falta el indicador: el mismo texto que la brecha entre grupos. */
export const FALTA_INDICADOR = "Marca qué respuestas suman el indicador.";

/** Los gráficos que no se dibujan sin indicador (`corte` sin valor por defecto en el motor). */
const SUMAN_INDICADOR: ReadonlySet<string> = new Set(["p_panorama", "p_fortalezas", "p_dumbbell"]);

const comoRef = (v: unknown): GraficadorRef | null =>
  v && typeof v === "object" && !Array.isArray(v) && typeof (v as GraficadorRef).graficador === "string" ? (v as GraficadorRef) : null;

/** Lo que falta en un gráfico, o `null`. */
export function faltaEnGrafico(g: GraficadorRef): string | null {
  const args = g.args ?? {};
  if (g.graficador === "p_dumbbell" && esEntreGrupos(args)) return faltaEnBrecha(args);
  if (SUMAN_INDICADOR.has(g.graficador) && !corteDe(args).length) return FALTA_INDICADOR;
  return null;
}

/** Lo primero que falta en los gráficos de la lámina, en el orden de sus ranuras; `null` si nada. */
export function faltaEnLamina(slide: Slide): string | null {
  const payload = (slide.payload ?? {}) as Record<string, unknown>;
  for (const slot of SLIDE_GRAF_SLOTS[slide.tipo] ?? []) {
    const g = comoRef(payload[slot]);
    const falta = g ? faltaEnGrafico(g) : null;
    if (falta) return falta;
  }
  return null;
}
