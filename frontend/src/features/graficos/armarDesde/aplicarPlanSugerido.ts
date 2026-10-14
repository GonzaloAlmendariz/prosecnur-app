// «Armar desde un plan sugerido» (contrato A5 rebanada 2b): lo que decide qué se aplica, separado del popover que lo
// muestra. Puro: sin store ni React, para que la forma del paso único (`usePlanStore.aplicarPlanSugerido`) y sus reglas
// —qué identidad sube a `scope_rules.global`, cuándo se propone «Otros»— se prueben sin montar nada. ADR 0102: la
// matriz de equivalencias ya no arma láminas, así que no hay sello de la declaración que grabar.

import type { GraficosSuggestedPlanResponse, PlanJson, PptStyleProfileMeta } from "../../../api/graficos";
import type { GraficosReportScope } from "../reportScope";

/** Entrada de la acción única del store: todo lo que cambia al aplicar un plan sugerido, en un solo paso deshacible. */
export type PlanSugeridoAplicable = {
  plan: PlanJson;
  /** Perfil de estilo PPT que el plan pide; `null` si no hay. */
  perfil: PptStyleProfileMeta | null;
  /** Identidad del plan (perfil, plantilla, modo ACNUR…) que se funde en `scope_rules.global`; `null` si no hay. */
  identidad: Record<string, unknown> | null;
  /** Sólo cuando el analista aceptó lo que el plan propone para «Otros»; si falta, el interruptor no se toca. */
  autoOtrosSlides?: boolean;
};

export type ModoAplicarPlan = "reemplazar" | "fusionar";

type RespuestaPlan = Pick<
  GraficosSuggestedPlanResponse,
  "profile_id" | "template_id" | "acnur_mode" | "report_scope" | "meta" | "auto_otros_slides"
>;

/**
 * `null` si «Armar desde…» se puede usar en este alcance; el motivo si no. Hoy ningún alcance lo deshabilita; la firma
 * se conserva para que un motivo futuro tenga dónde vivir.
 */
export function motivoArmarDesdeDeshabilitado(_scope: GraficosReportScope): string | null {
  return null;
}

/** ¿Se pide la propuesta al backend? Sólo con el popover abierto y sin motivo que lo impida. */
export function debePedirPropuesta(abierto: boolean, motivo: string | null): boolean {
  return abierto && motivo === null;
}

/** Perfil de plantilla con el que se resolvió el plan: el que devolvió el backend o, si no, el elegido (salvo «auto»). */
export function perfilResuelto(respuesta: RespuestaPlan, elegido: string): string {
  return respuesta.profile_id || (elegido === "auto" ? "" : elegido);
}

/** Identidad del plan que sube a `scope_rules.global`; `null` si el plan no trae ninguna. */
export function identidadDelPlan(respuesta: RespuestaPlan, elegido: string): Record<string, unknown> | null {
  const identidad: Record<string, unknown> = {};
  const perfil = perfilResuelto(respuesta, elegido);
  if (perfil) identidad.profile_id = perfil;
  if (respuesta.template_id) identidad.template_id = respuesta.template_id;
  if (respuesta.acnur_mode) identidad.acnur_mode = respuesta.acnur_mode;
  if (respuesta.report_scope) identidad.report_scope = respuesta.report_scope;
  if (respuesta.meta) identidad.meta = respuesta.meta;
  return Object.keys(identidad).length ? identidad : null;
}

function esRegistro(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** `scope_rules` con la identidad fundida en `global` (sin identidad, las mismas reglas). Pura. */
export function scopeRulesConIdentidad(
  scopeRules: Record<string, unknown>,
  identidad: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!identidad || !Object.keys(identidad).length) return scopeRules;
  const global = esRegistro(scopeRules.global) ? scopeRules.global : {};
  return { ...scopeRules, global: { ...global, ...identidad } };
}

/**
 * Lo que el plan propone para las láminas de «Otros» cuando difiere del interruptor actual; `null` si no propone nada
 * distinto. Se muestra y se aplica sólo si el analista lo acepta: un plan nunca cambia el interruptor sin avisar.
 */
export function propuestaOtros(respuesta: RespuestaPlan, actual: boolean): boolean | null {
  const propuesto = respuesta.auto_otros_slides;
  return typeof propuesto === "boolean" && propuesto !== actual ? propuesto : null;
}
