import { describe, expect, it } from "vitest";

import type { InstrumentoDrillResult } from "../../../api/client";
import {
  avisoDeCasosSinId,
  buildCaseRows,
  buildDecisionPayload,
  emptyEditorForm,
  esFilaSinId,
  getDecisionReadiness,
  type EditorForm,
} from "./modeloLimpieza";

// Corrección 15-M del motor de Hallazgos: el detalle de una regla trae `null`
// en `case_ids` para una fila que no pudo ubicar. El cliente no le inventa un
// id (antes armaba `<regla>::row::<k>`, que el motor rechaza con 422
// `E_LIMPIEZA_CASOS_INVALIDOS`) y esa fila no se puede elegir para una
// decisión caso por caso.

function drill(caseIds: InstrumentoDrillResult["case_ids"], n: number): InstrumentoDrillResult {
  return {
    ok: true,
    regla: {
      id: "RC_EDAD",
      nombre: "Edad fuera de rango",
      variables: ["edad"],
      procesamiento: null,
      activa: true,
      n_inconsistencias: n,
      porcentaje: null,
    } as InstrumentoDrillResult["regla"],
    uuid_col: "response_id",
    case_ids: caseIds,
    casos: Array.from({ length: n }, (_, i) => ({ response_id: caseIds?.[i] ?? null, edad: 15 + i })),
  };
}

function formulario(cambios: Partial<EditorForm>): EditorForm {
  return { ...emptyEditorForm(), rationale: "Revisado", ...cambios };
}

describe("filas del detalle de una regla", () => {
  it("con id, la fila lleva el id del motor y se puede elegir", () => {
    const filas = buildCaseRows(drill(["AUD-009", "AUD-041"], 2), null);
    expect(filas.map((f) => [f.id, f.seleccionable])).toEqual([["AUD-009", true], ["AUD-041", true]]);
  });

  it("un id null no se inventa: la fila queda sin elegir, con una clave que no es un id del motor", () => {
    const filas = buildCaseRows(drill(["AUD-009", null, "AUD-041"], 3), null);
    expect(filas.map((f) => f.seleccionable)).toEqual([true, false, true]);
    expect(filas[1].id).not.toContain("::row::");
    expect(esFilaSinId(filas[1].id)).toBe(true);
    expect(esFilaSinId("AUD-009")).toBe(false);
  });

  it("una lista de ids más corta que los casos, o ausente, tampoco inventa ids", () => {
    expect(buildCaseRows(drill(["AUD-009"], 2), null).map((f) => f.seleccionable)).toEqual([true, false]);
    expect(buildCaseRows(drill(undefined, 2), null).every((f) => !f.seleccionable)).toBe(true);
  });
});

describe("una decisión con filas sin id", () => {
  const sinId = buildCaseRows(drill(["AUD-009", null], 2), null)[1].id;

  it("caso por caso no se guarda y dice la causa", () => {
    const form = formulario({ action_type: "exclude_cases", scope_mode: "selected", use_all_cases: false, target_case_ids: ["AUD-009", sinId] });
    expect(() => buildDecisionPayload({ form, status: "ready", sourceId: "RC_EDAD", sourceType: "custom_rule" }))
      .toThrow("1 caso elegido no tiene identificador en la auditoría");
    expect(getDecisionReadiness(form).ready).toBe(false);
    expect(getDecisionReadiness(form).issues[0]).toContain("no se puede decidir por separado");
  });

  it("concuerda con el número", () => {
    const otra = buildCaseRows(drill([null, null], 2), null).map((f) => f.id);
    const form = formulario({ action_type: "exclude_cases", scope_mode: "selected", use_all_cases: false, target_case_ids: otra });
    expect(avisoDeCasosSinId(form)).toMatch(/^2 casos elegidos no tienen identificador/);
  });

  it("sobre todos los casos de la regla sí se guarda, porque los resuelve el motor", () => {
    const form = formulario({ action_type: "exclude_cases", scope_mode: "all", use_all_cases: true, target_case_ids: [sinId] });
    const payload = buildDecisionPayload({ form, status: "ready", sourceId: "RC_EDAD", sourceType: "custom_rule" });
    expect(payload.target_case_ids).toEqual([]);
    expect(avisoDeCasosSinId(form)).toBeNull();
  });

  it("solo con ids del motor se guarda tal cual", () => {
    const form = formulario({ action_type: "exclude_cases", scope_mode: "selected", use_all_cases: false, target_case_ids: ["AUD-009"] });
    const payload = buildDecisionPayload({ form, status: "ready", sourceId: "RC_EDAD", sourceType: "custom_rule" });
    expect(payload.target_case_ids).toEqual(["AUD-009"]);
  });
});
