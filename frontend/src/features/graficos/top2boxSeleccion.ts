// Top Two Box declarado por el analista, siempre dos categorías (R14 del checklist de remasterización; Gonzalo,
// 2026-10-08: «Mantener, que el analista las declare, pero para armarlo debe pedirle dos y la UI debe ser intuitiva»).
//
// El motor ya no deduce el Top Two Box del orden de la escala: si no hay categorías declaradas, omite la columna y lo
// avisa (`.box_decidir`). Por eso el editor ofrece las categorías de la escala y exige exactamente dos; el arg que se
// guarda sigue siendo `top2box_labels` (los planes ya guardados no cambian).

import type { ScaleVar } from "./multiApiladasScale";

/** Lo que nunca entra al Top Two Box: falta de información y no aplica (mismo criterio que el motor, `.DIVERGENTES_ESPECIAL`). */
const ESPECIAL = /^(sin inf|sin información|no sabe|no sé|no se\b|ns\/nr|ns\/no|no responde|no opina|no aplica|ninguno de los anteriores|no utilic|no us[eé]|no he usado)/i;

export const TOP2BOX_CANTIDAD = 2;

/** Categorías elegibles de la escala de las preguntas, en su orden; vacío si no comparten una escala con categorías. */
export function categoriasDeEscala(refs: string[], resolve: (ref: string) => ScaleVar | undefined): string[] {
  const vars = refs.map(resolve).filter((v): v is ScaleVar => !!v);
  const conChoices = vars.find((v) => (v.choices ?? []).length > 0);
  if (!conChoices) return [];
  return (conChoices.choices ?? [])
    .map((c) => (c?.label ?? c?.name ?? "").trim())
    .filter((label) => label.length > 0 && !ESPECIAL.test(label));
}

/**
 * Alterna una categoría en la selección sin pasar de dos: quitarla siempre se puede; agregarla sólo si quedan cupos.
 * Devuelve la selección en el orden de la escala.
 */
export function alternarCategoria(actual: string[], categoria: string, orden: string[]): string[] {
  const set = new Set(actual);
  if (set.has(categoria)) set.delete(categoria);
  else if (set.size < TOP2BOX_CANTIDAD) set.add(categoria);
  const enOrden = orden.filter((c) => set.has(c));
  const fuera = [...set].filter((c) => !orden.includes(c));   // una etiqueta guardada que ya no está en la escala se conserva
  return [...enOrden, ...fuera];
}

export type EstadoTop2Box = { tono: "ok" | "falta" | "ajena"; mensaje: string };

/** Qué le falta a la declaración: dos categorías, y que sean de esta escala. */
export function estadoTop2Box(seleccion: string[], orden: string[]): EstadoTop2Box {
  const ajenas = seleccion.filter((c) => orden.length > 0 && !orden.includes(c));
  if (ajenas.length) return { tono: "ajena", mensaje: `«${ajenas.join("», «")}» no está en la escala de estas preguntas.` };
  if (seleccion.length === TOP2BOX_CANTIDAD) return { tono: "ok", mensaje: `Top Two Box = ${seleccion.join(" + ")}.` };
  const faltan = TOP2BOX_CANTIDAD - seleccion.length;
  return { tono: "falta", mensaje: faltan === 2 ? "Elige las dos categorías que suman el Top Two Box." : "Elige una categoría más." };
}
