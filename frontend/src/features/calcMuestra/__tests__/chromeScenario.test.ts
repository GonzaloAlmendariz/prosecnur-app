import { describe, expect, it } from "vitest";
import { DEFAULT_CALC_MUESTRA_ESTUDIO } from "../../../api/client";
import { chromeTokensForDesk } from "../CalcMuestraPage";
import { defaultComponente } from "../sharedCore";
import { UNIVERSITY_TOTAL_COMPONENT_ID } from "../universidad/shared/constants";
import { universityDefaultWorkspace } from "../universidad/shared/study";

describe("chromeTokensForDesk — escenario autoritativo", () => {
  it("E2 sin componente P2 queda pendiente y no publica el resultado P1", () => {
    const p1 = defaultComponente({ actor_id: UNIVERSITY_TOTAL_COMPONENT_ID });
    p1.resultado = {
      n_teorico: 175,
      n_objetivo: 175,
      n_operativo: 175,
      origen_tamano: "formula",
      tecnica: p1.tecnica,
      computado_at: "2026-08-01T00:00:00Z",
      inferencia: { permitido: true, motivos: null },
      aulas_base_total: 13,
    };
    const workspace = {
      ...universityDefaultWorkspace(),
      motor_recorrido: {
        schema: "calc_muestra_workspace_motor_v1",
        fuente: "proyecto",
        perfil: null,
        decisiones: { escenario: "e2" },
        tocado: true,
      },
    };
    const tokens = chromeTokensForDesk({
      desk: "opinion_universitaria",
      estudio: { ...DEFAULT_CALC_MUESTRA_ESTUDIO, componentes: [p1], workspace },
      workspace,
      productos: ["muestra_probabilistica"],
      resultados: 1,
      aulasState: null,
    });

    expect(tokens.find((token) => token.label === "Cálculo")?.value).toBe("pendiente");
  });
});
