import type { GraficosConsolidadoPreflight } from "../../api/client";

export type SharedReportPreflightStatus = "idle" | "loading" | "ready" | "blocked" | "error";

export function multibaseReportMenuPresentation(
  status: SharedReportPreflightStatus,
  preflight: GraficosConsolidadoPreflight | null,
  busy: boolean,
) {
  const ready = status === "ready" && preflight?.ready === true;
  const comparisons = preflight?.n_comparison_slides ?? 0;
  const detail = ready
    ? comparisons > 0
      ? `${preflight?.releases.length ?? 0} bases · ${preflight?.n_slides ?? 0} diapositivas · ${comparisons} comparaciones`
      : `${preflight?.releases.length ?? 0} bases · ${preflight?.n_slides ?? 0} diapositivas; sin preguntas comparables detectadas`
    : status === "blocked"
      ? `${preflight?.blockers.length ?? 0} requisitos pendientes para el PPT conjunto`
      : status === "error"
        ? "No se pudo comprobar el estado del informe"
        : "Comprobando releases y compatibilidad metodológica";

  return {
    ready,
    tone: ready ? "ready" : status === "blocked" || status === "error" ? "blocked" : "loading",
    detail,
    sharedDisabled: busy || !ready,
    packageDisabled: busy,
  } as const;
}
