// Deshacer la inserción del mazo sin pisar otra edición. El toast ofrece «Deshacer» durante 8 s, y en ese tiempo el
// analista pudo haber tocado otra cosa (escribir un título, mover una lámina): un `undo()` a ciegas desharía ESA edición
// y dejaría las láminas del mazo puestas. Si el plan sigue siendo exactamente el que dejó la inserción, se deshace el paso;
// si no, se quitan por id las láminas que insertó el mazo, también en un paso deshacible. Pura sobre el store que recibe.

import type { Slide } from "../../../../api/graficos";

/** Lo que el deshacer necesita del store del plan (usePlanStore.getState()). */
export type PlanDeshacible = {
  plan: { slides: readonly Slide[] };
  undo: () => void;
  transformarLaminas: (f: (slides: Slide[]) => Slide[]) => void;
};

/** La foto que deja la inserción: el arreglo de láminas resultante (por identidad) y los ids nuevos. */
export type InsercionMazo = { slides: readonly Slide[]; ids: readonly string[] };

export type ComoSeDeshizo = "deshacer" | "quitar" | "nada";

export function deshacerInsercion(plan: PlanDeshacible, insercion: InsercionMazo): ComoSeDeshizo {
  if (plan.plan.slides === insercion.slides) {
    plan.undo();
    return "deshacer";
  }
  const ids = new Set(insercion.ids);
  if (!plan.plan.slides.some((s) => ids.has(s.id))) return "nada";
  plan.transformarLaminas((slides) => slides.filter((s) => !ids.has(s.id)));
  return "quitar";
}
