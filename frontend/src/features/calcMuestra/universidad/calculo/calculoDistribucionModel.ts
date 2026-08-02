import type { CalcMuestraComponente } from "../../../../api/calcMuestra";
import {
  normalizeCalcMuestraDistribucionI19,
  type CalcMuestraDistribucionI19Scenario,
  type CalcMuestraDistribucionI19State,
} from "../../../../api/calcMuestraDistribucionI19";
import {
  UNIVERSITY_FACULTY_COMPONENT_ID,
  UNIVERSITY_TOTAL_COMPONENT_ID,
} from "../shared/constants";
import type { UniversityAulasScenario } from "../shared/study";

export type CalculoDistribucionScenarioMeta = {
  actorId: typeof UNIVERSITY_TOTAL_COMPONENT_ID | typeof UNIVERSITY_FACULTY_COMPONENT_ID;
  scenario: CalcMuestraDistribucionI19Scenario;
  shortLabel: string;
  longLabel: string;
};

export type CalculoDistribucionModel = {
  selection: CalculoDistribucionScenarioMeta;
  state: CalcMuestraDistribucionI19State;
};

export function calculoDistribucionScenarioMeta(
  escenario: UniversityAulasScenario,
): CalculoDistribucionScenarioMeta {
  return escenario === "e2"
    ? {
        actorId: UNIVERSITY_FACULTY_COMPONENT_ID,
        scenario: "p2_facultades",
        shortLabel: "P2 · Facultades",
        longLabel: "Propuesta 2 · precisión formal por facultad",
      }
    : {
        actorId: UNIVERSITY_TOTAL_COMPONENT_ID,
        scenario: "p1_universidad",
        shortLabel: "P1 · Universidad",
        longLabel: "Propuesta 1 · precisión formal global",
      };
}

/** Selecciona solo el actor exacto y entrega su artefacto al normalizador. */
export function buildCalculoDistribucionModel({
  componentes,
  currentFrameHash,
  escenario,
}: {
  componentes: readonly CalcMuestraComponente[];
  currentFrameHash: string | null | undefined;
  escenario: UniversityAulasScenario;
}): CalculoDistribucionModel {
  const selection = calculoDistribucionScenarioMeta(escenario);
  const matchingComponents = componentes.filter((item) => item.actor_id === selection.actorId);
  const component = matchingComponents[0];
  if (matchingComponents.length !== 1 || !component) {
    return {
      selection,
      state: {
        kind: "invalid",
        reasons: [`${selection.shortLabel} requiere exactamente un componente ${selection.actorId}.`],
      },
    };
  }
  return {
    selection,
    state: normalizeCalcMuestraDistribucionI19(component.resultado, {
      component_id: component.id,
      actor_id: selection.actorId,
      scenario: selection.scenario,
      technique: component.tecnica,
      current_frame_hash: currentFrameHash,
    }),
  };
}
