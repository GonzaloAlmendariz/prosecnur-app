import { describe, expect, it } from "vitest";
import type { CalcMuestraResultado } from "../../../../../api/client";
import { defaultComponente } from "../../../sharedCore";
import {
  UNIVERSITY_FACULTY_COMPONENT_ID,
  UNIVERSITY_TOTAL_COMPONENT_ID,
} from "../../shared/constants";
import { universityDefaultWorkspace } from "../../shared/study";
import { salidasChartComponent } from "../SalidasResultadosTab";

function componente(actorId: string, n: number) {
  const resultado: CalcMuestraResultado = {
    n_teorico: n,
    n_objetivo: n,
    n_operativo: n,
    origen_tamano: "formula",
    tecnica: "prob_conglomerado_multietapico",
    computado_at: "2026-08-01T00:00:00Z",
    inferencia: { permitido: true, motivos: null },
  };
  return defaultComponente({ actor_id: actorId, resultado });
}

function workspaceE2() {
  return {
    ...universityDefaultWorkspace(),
    motor_recorrido: {
      schema: "calc_muestra_workspace_motor_v1",
      fuente: "proyecto",
      perfil: null,
      decisiones: { escenario: "e2" },
      tocado: true,
    },
  };
}

describe("SalidasResultadosTab — gráfico del escenario", () => {
  it("muestra P2 en E2 aunque P1 también tenga resultado", () => {
    const p1 = componente(UNIVERSITY_TOTAL_COMPONENT_ID, 175);
    const p2 = componente(UNIVERSITY_FACULTY_COMPONENT_ID, 268);

    expect(salidasChartComponent([p1, p2], workspaceE2())?.actor_id)
      .toBe(UNIVERSITY_FACULTY_COMPONENT_ID);
  });

  it("no cae a P1 cuando E2 no tiene resultado", () => {
    const p1 = componente(UNIVERSITY_TOTAL_COMPONENT_ID, 175);
    const p2 = defaultComponente({ actor_id: UNIVERSITY_FACULTY_COMPONENT_ID });

    expect(salidasChartComponent([p1, p2], workspaceE2())).toBeNull();
    expect(salidasChartComponent([p1], workspaceE2())).toBeNull();
  });
});
