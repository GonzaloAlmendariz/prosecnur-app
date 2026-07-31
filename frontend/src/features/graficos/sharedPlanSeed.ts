import type { GraficosReportScope } from "./reportScope";

// Siembra del informe compartido.
//
// El menú del conjunto promete "N diapositivas · M comparaciones" con el plan
// que el preflight ya arma, pero al entrar al editor el lienzo aparecía vacío:
// el plan se calculaba, se contaba y se descartaba. Aquí se decide cuándo ese
// plan sugerido puede aterrizar en el store.
//
// La regla dura es distinguir "nunca compuesto" de "vaciado a propósito". El
// borrador compartido nace en `revision: 0` y solo la incrementa un guardado
// real, así que revision > 0 con plan vacío significa que alguien borró sus
// láminas: ahí no se siembra nada. Tampoco se pisa trabajo en curso (`dirty`)
// ni un plan que ya tiene slides.

export type SharedPlanSeedInput = {
  scope: GraficosReportScope;
  hydrated: boolean;
  dirty: boolean;
  /** Revisión del borrador compartido; null mientras no terminó de cargar. */
  draftRevision: number | null;
  /** Slides que hoy tiene el store. */
  currentSlideCount: number;
  /** Slides del plan sugerido que trajo el preflight. */
  suggestedSlideCount: number;
  /** Si ya sembramos en esta sesión de edición. */
  alreadySeeded: boolean;
};

export function shouldSeedSharedPlan(input: SharedPlanSeedInput): boolean {
  if (input.scope !== "consolidated") return false;
  if (input.alreadySeeded) return false;
  // Sin hidratar todavía no sabemos qué tiene el store; sembrar aquí pisaría
  // el borrador que está por llegar.
  if (!input.hydrated) return false;
  if (input.draftRevision !== 0) return false;
  if (input.dirty) return false;
  if (input.currentSlideCount > 0) return false;
  return input.suggestedSlideCount > 0;
}
