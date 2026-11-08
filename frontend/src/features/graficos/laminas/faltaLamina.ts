// Lo que le falta a una lámina para poder dibujarse (Q4-2 y Q4-4 de la prueba con Arte, 2026-11-07). Mientras falte un
// dato obligatorio no se sabe cómo va a salir: el inspector no dice «Sale como imagen» y el visor no pide la vista previa
// al motor (que respondería con un error de dibujo), sino que deja la maqueta con lo que falta. Hoy cubre la brecha entre
// grupos (aperturas del resumen y recetario), la única que tiene un orden de elección declarado. Pura: sin React.

import type { GraficadorRef, Slide } from "../../../api/graficos";
import { SLIDE_GRAF_SLOTS } from "../store";
import { esEntreGrupos, faltaEnBrecha } from "./brecha/modeloBrechaGrupos";

const comoRef = (v: unknown): GraficadorRef | null =>
  v && typeof v === "object" && !Array.isArray(v) && typeof (v as GraficadorRef).graficador === "string" ? (v as GraficadorRef) : null;

/** Lo que falta en un gráfico, o `null`. */
export function faltaEnGrafico(g: GraficadorRef): string | null {
  const args = g.args ?? {};
  if (g.graficador === "p_dumbbell" && esEntreGrupos(args)) return faltaEnBrecha(args);
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
