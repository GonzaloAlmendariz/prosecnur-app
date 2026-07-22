import type { GraficosConsolidadoPreflight } from "../../api/client";

export type SharedReportPreflightStatus = "idle" | "loading" | "ready" | "blocked" | "error";

export type SharedReportPendingRequirement = {
  base: string;
  actor: string;
  status: string;
  detail: string;
};

export function sharedReportPendingRequirements(
  preflight: GraficosConsolidadoPreflight | null,
): SharedReportPendingRequirement[] {
  const releaseBlocker = preflight?.blockers.find(
    (blocker) => blocker.code === "processing_release_not_approved",
  );
  return (releaseBlocker?.requirements ?? []).map((requirement) => ({
    base: requirement.base,
    actor: requirement.actor || requirement.base,
    status: requirement.status,
    detail: requirement.blockers.length
      ? requirement.blockers.map((blocker) => blocker.message).join(" ")
      : requirement.status === "stale"
        ? "Los insumos cambiaron desde la última aprobación; vuelve a revisar y aprobar esta base."
        : "Revisa y aprueba la entrega analítica de esta base.",
  }));
}

export function multibaseReportMenuPresentation(
  status: SharedReportPreflightStatus,
  preflight: GraficosConsolidadoPreflight | null,
  busy: boolean,
) {
  const ready = status === "ready" && preflight?.ready === true;
  const comparisons = preflight?.n_comparison_slides ?? 0;
  const pendingBases = sharedReportPendingRequirements(preflight).length;
  const detail = ready
    ? comparisons > 0
      ? `${preflight?.releases.length ?? 0} bases · ${preflight?.n_slides ?? 0} diapositivas · ${comparisons} comparaciones`
      : `${preflight?.releases.length ?? 0} bases · ${preflight?.n_slides ?? 0} diapositivas; sin preguntas comparables detectadas`
    : status === "blocked"
      ? pendingBases > 0
        ? `${pendingBases} ${pendingBases === 1 ? "base requiere" : "bases requieren"} revisión para el PPT conjunto`
        : `${preflight?.blockers.length ?? 0} requisito${preflight?.blockers.length === 1 ? "" : "s"} pendiente${preflight?.blockers.length === 1 ? "" : "s"} para el PPT conjunto`
      : status === "error"
        ? "No se pudo comprobar el estado del informe"
        : "Comprobando releases y compatibilidad metodológica";

  return {
    ready,
    tone: ready ? "ready" : status === "blocked" || status === "error" ? "blocked" : "loading",
    detail,
    sharedConfigureDisabled: busy,
    sharedExportDisabled: busy || !ready,
    packageDisabled: busy,
  } as const;
}
