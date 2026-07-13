import { describe, expect, it } from "vitest";
import { buildRuleFlow, deriveVerdict, humanizeRuleType } from "./ruleFlowModel";
import type { ReglaLike } from "./narrative";

function nodeKinds(regla: ReglaLike, extra: Parameters<typeof buildRuleFlow>[0] = { regla }) {
  return buildRuleFlow({ ...extra, regla }).nodes.map((n) => n.kind);
}

describe("humanizeRuleType", () => {
  it("mapea tipos conocidos", () => {
    expect(humanizeRuleType("required")).toMatch(/responderse/i);
    expect(humanizeRuleType("range")).toMatch(/rango/i);
    expect(humanizeRuleType("calculate_check")).toMatch(/cálculo/i);
  });
  it("cae al tipo de observación cuando no hay tipo_regla", () => {
    expect(humanizeRuleType(null, "constraint numérico")).toMatch(/restricción/i);
  });
  it("tiene fallback genérico", () => {
    expect(humanizeRuleType("desconocido")).toMatch(/validación/i);
  });
});

describe("deriveVerdict", () => {
  it("issues cuando hay inconsistencias", () => {
    expect(deriveVerdict({ regla: {}, nInconsistencias: 3 })).toBe("issues");
  });
  it("clean cuando no hay casos", () => {
    expect(deriveVerdict({ regla: {}, nInconsistencias: 0 })).toBe("clean");
  });
  it("prioriza estados especiales sobre el conteo", () => {
    expect(deriveVerdict({ regla: {}, estadoDinamico: "no_aplicable", nInconsistencias: 0 })).toBe("not_applicable");
    expect(deriveVerdict({ regla: {}, estadoDinamico: "desalineada" })).toBe("misaligned");
    expect(deriveVerdict({ regla: {}, estadoDinamico: "no_evaluada" })).toBe("not_evaluated");
    expect(deriveVerdict({ regla: {}, issueCode: "sin_datos_repeat" })).toBe("pending_child");
    expect(deriveVerdict({ regla: {}, requiresExternalDataset: true })).toBe("external");
  });
});

describe("buildRuleFlow — adaptación por tipo", () => {
  it("required simple: objetivo + condición + veredicto (sin gate/drivers/compare)", () => {
    const regla: ReglaLike = {
      id: "r1",
      tipo_regla: "required",
      variables: ["p1"],
      variable_roles: { target: "p1" },
    };
    expect(nodeKinds(regla)).toEqual(["target", "condition", "verdict"]);
  });

  it("skip con drivers muestra el nodo de activadores", () => {
    const regla: ReglaLike = {
      id: "r2",
      tipo_regla: "skip",
      variables: ["p2", "consent"],
      variable_roles: { target: "p2", drivers: ["consent"] },
    };
    expect(nodeKinds(regla)).toEqual(["drivers", "target", "condition", "verdict"]);
  });

  it("coherence con compare muestra el nodo de comparación", () => {
    const regla: ReglaLike = {
      id: "r3",
      tipo_regla: "coherence",
      variables: ["edad", "edad2"],
      variable_roles: { target: "edad", compare: ["edad2"] },
    };
    expect(nodeKinds(regla)).toEqual(["target", "condition", "compare", "verdict"]);
  });

  it("calculate_check con gate humano y objetivo específico", () => {
    const regla: ReglaLike = {
      id: "p_space04",
      tipo_regla: "calculate_check",
      variables: ["p_space04"],
      variable_roles: { target: "p_space04", gate: ["consent"] },
      presentation: {
        gate_humano: "Cuando la persona dio su consentimiento.",
        objetivo: "El espacio disponible se calcula a partir de las respuestas del hogar.",
      },
    };
    const flow = buildRuleFlow({ regla, nInconsistencias: 12, porcentaje: 4.2 });
    expect(flow.nodes.map((n) => n.kind)).toEqual(["gate", "target", "condition", "verdict"]);
    const gate = flow.nodes.find((n) => n.kind === "gate");
    expect(gate?.detail).toMatch(/consentimiento/i);
    const condition = flow.nodes.find((n) => n.kind === "condition");
    expect(condition?.detail).toMatch(/espacio disponible/i);
    expect(flow.verdictKind).toBe("issues");
    const verdict = flow.nodes.find((n) => n.kind === "verdict");
    expect(verdict?.title).toMatch(/12/);
  });

  it("descarta detalle_condicion técnico y no lo usa como prosa", () => {
    const regla: ReglaLike = {
      id: "r4",
      tipo_regla: "constraint",
      variables: ["x"],
      variable_roles: { target: "x" },
      presentation: { detalle_condicion: "NO se cumple que ((${x} >= 0) and (${x} <= 5))" },
    };
    const condition = buildRuleFlow({ regla }).nodes.find((n) => n.kind === "condition");
    expect(condition?.detail).toBeNull();
  });

  it("siempre incluye un nodo objetivo aunque no haya target explícito", () => {
    const regla: ReglaLike = { id: "r5", tipo_regla: "outlier", variables: [] };
    const kinds = nodeKinds(regla);
    expect(kinds).toContain("target");
    expect(kinds).toContain("verdict");
  });
});
