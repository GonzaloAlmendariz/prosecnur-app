import type { CalcMuestraAulasMethodComparison } from "../../../../api/client";
import { classroomMethodLabel as classroomMethodLabelFn } from "./classroomLabels";

/**
 * Cada método tenía DOS nombres: el `title` de aquí, que ve la pestaña Método, y
 * el `label` de UNIVERSITY_AULAS_SELECTOR_OPTIONS, que ven Simulación, el
 * historial y el cierre. Tres de los cuatro no coincidían —«Sistemático PPS» vs
 * «Sistemático por facultad», «Balanceado (cube)» vs «Balance por cuotas y
 * tamaño», «Pool controlado» vs «Optimizar repetidos»—, así que preguntar «qué
 * es sistemático por facultad» no tenía respuesta posible en la pestaña que
 * explica los métodos: ahí ese método se llamaba de otra forma.
 *
 * El nombre lo declara UNA sola fuente, la de las constantes, y aquí sólo queda
 * lo que es propio del relato: la insignia, la frase y el esquema.
 * `classroomMethodStoriesTituloContrato.test.ts` falla si vuelve a aparecer un
 * `title` propio.
 */
export const CLASSROOM_METHOD_STORIES = [
  {
    id: "sistematico_pps",
    badge: "Base auditable",
    story: "Ordena los cursos-horario, arranca en uno al azar y de ahí toma uno de cada tantos, siempre con el mismo salto.",
    visual: "systematic",
  },
  {
    id: "cube_balanceado",
    badge: "Balance",
    story: "Hace coincidir la muestra con el marco en facultad, sexo esperado y tamaño del curso-horario.",
    visual: "cube",
  },
  {
    id: "local_pivotal_balanceado",
    badge: "Dispersión",
    story: "Enfrenta vecinos parecidos y los separa para no amontonar programa, nivel u horario.",
    visual: "pivotal",
  },
  {
    id: "pool_controlado",
    badge: "Optimización",
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
      label: classroomMethodLabelFn(recommendedId) || String(recommendation?.method_label ?? "").trim() || recommendedId,
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
