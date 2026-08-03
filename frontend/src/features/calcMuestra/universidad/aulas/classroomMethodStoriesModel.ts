import type { CalcMuestraAulasMethodComparison } from "../../../../api/client";

export const CLASSROOM_METHOD_STORIES = [
  {
    id: "sistematico_pps",
    badge: "Base auditable",
    title: "Sistemático PPS",
    story: "Ordena los cursos-horario, arranca al azar y salta la recta con paso k.",
    visual: "systematic",
  },
  {
    id: "cube_balanceado",
    badge: "Balance",
    title: "Balanceado (cube)",
    story: "Hace coincidir la muestra con el marco en facultad, sexo esperado y tamaño del curso-horario.",
    visual: "cube",
  },
  {
    id: "local_pivotal_balanceado",
    badge: "Dispersión",
    title: "Balance + dispersión",
    story: "Enfrenta vecinos parecidos y los separa para no amontonar programa, nivel u horario.",
    visual: "pivotal",
  },
  {
    id: "pool_controlado",
    badge: "Optimización",
    title: "Pool controlado",
    story: "Sortea 500 muestras candidatas válidas, las audita y conserva la de mejor resultado.",
    visual: "pool",
  },
] as const;

export type ClassroomMethodDecision = {
  kind: "recommended" | "configured";
  methodId: string;
  label: string;
  reason: string;
};

export function resolveClassroomMethodDecision({
  comparisonReady,
  comparison,
  configuredMethodId,
  configuredMethodLabel,
}: {
  comparisonReady: boolean;
  comparison?: CalcMuestraAulasMethodComparison | null;
  configuredMethodId: string;
  configuredMethodLabel: string;
}): ClassroomMethodDecision {
  const recommendation = comparisonReady ? comparison?.recommendation : undefined;
  const recommendedId = String(recommendation?.method_id ?? "").trim();
  if (recommendedId) {
    return {
      kind: "recommended",
      methodId: recommendedId,
      label: String(recommendation?.method_label ?? "").trim() || recommendedId,
      reason: String(recommendation?.operational_reason ?? recommendation?.methodological_reason ?? "").trim() ||
        "Obtuvo el mejor resultado en la comparación vigente.",
    };
  }
  return {
    kind: "configured",
    methodId: configuredMethodId,
    label: configuredMethodLabel,
    reason: "Es la configuración guardada. Corre el comparador para obtener una recomendación acreditada con el marco vigente.",
  };
}
