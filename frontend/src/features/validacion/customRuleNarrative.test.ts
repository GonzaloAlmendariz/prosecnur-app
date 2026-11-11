import { describe, expect, it } from "vitest";
import { customRuleToRule, describeCustomParams } from "./customRuleNarrative";
import type { ReglaCustom } from "./types";

describe("narrativa del cruce entre dos respuestas", () => {
  it("dice la condición real de cada lado", () => {
    const texto = describeCustomParams(
      "coherencia_2v",
      { op_x: "==", valor_x: "1", op_y: "not_in", valor_y: ["4", "5", "6", "8"] },
      ["p4", "p21"],
    );
    expect(texto).toBe("Se marca cuando p4 es 1 y p21 no cumple \"no está entre 4, 5, 6, 8\".");
  });

  it("con la condición a medio llenar cae en la explicación genérica", () => {
    const texto = describeCustomParams("coherencia_2v", { op_x: "==" }, ["p4", "p21"]);
    expect(texto).toBe(
      "Se marca cuando la primera respuesta cumple su condición y la segunda no cumple la suya.",
    );
  });
});

describe("objetivo de un criterio guardado", () => {
  const base: ReglaCustom = {
    id: "RC_001",
    created_at: "2026-11-04T00:00:00Z",
    activa: true,
    nombre: "Valor fuera de rango: edad",
    tipo: "rango_num",
    variables: ["edad"],
    params: { min: "16", max: "25" },
    mensaje: "Valor fuera de rango: edad",
    severidad: "error",
    hallazgo_kind: "inconsistencia_usuario",
  };

  it("no repite el nombre como nota cuando no hay detalle propio", () => {
    expect(customRuleToRule(base).objetivo).toBe("Debe estar entre 16 y 25.");
  });

  it("conserva el detalle que escribió el analista", () => {
    const rule = customRuleToRule({ ...base, mensaje: "Revisar con la ficha" });
    expect(rule.objetivo).toBe("Debe estar entre 16 y 25. Nota: Revisar con la ficha");
  });

  it("rotula la inconsistencia como tal", () => {
    expect(customRuleToRule(base).origen_detalle).toBe("Personalizada: inconsistencia definida");
  });
});
