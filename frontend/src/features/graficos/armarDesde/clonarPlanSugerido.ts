// Plan sugerido aplicado con ids nuevos y textos visibles normalizados. Lo usan el popover "Armar desde" (informe
// compartido) y la pestaña Plantillas.
import type { PlanJson, Slide } from "../../../api/client";

function newSlideId(prefix = "sug") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

const VISIBLE_PAYLOAD_TEXT_KEYS = new Set([
  "titulo",
  "subtitulo",
  "texto",
  "bullets",
  "base",
  "pie",
  "etiqueta",
  "subtexto",
  "introduccion_word",
]);

export function normalizeAcnurVisibleText(value: string): string {
  return value
    .replace(/ACNUR\s+KOICA\s*[-–]\s*/gi, "ACNUR territorial - ")
    .replace(/ACNUR\s+KOICA/gi, "ACNUR territorial")
    .replace(/ACNUR\/KOICA/gi, "ACNUR territorial")
    .replace(/Overview territorial\s+KOICA/gi, "Overview territorial")
    .replace(/diseño\s+KOICA/gi, "diseño territorial")
    .replace(/diseno\s+KOICA/gi, "diseño territorial")
    .replace(/\bKOICA\b/gi, "territorial");
}

function normalizeVisiblePayloadValue(value: unknown): unknown {
  if (typeof value === "string") return normalizeAcnurVisibleText(value);
  if (Array.isArray(value)) return value.map((item) => (typeof item === "string" ? normalizeAcnurVisibleText(item) : item));
  return value;
}

function cloneSuggestedPayload(payload: Slide["payload"]): Slide["payload"] {
  const cloned = JSON.parse(JSON.stringify(payload ?? {})) as Record<string, unknown>;
  for (const key of VISIBLE_PAYLOAD_TEXT_KEYS) {
    if (key in cloned) cloned[key] = normalizeVisiblePayloadValue(cloned[key]);
  }
  return cloned as Slide["payload"];
}

export function clonePlanWithFreshIds(plan: PlanJson): PlanJson {
  return {
    slides: (plan.slides ?? []).map((slide): Slide => ({
      ...slide,
      id: newSlideId("sug"),
      payload: cloneSuggestedPayload(slide.payload),
    })),
  };
}

