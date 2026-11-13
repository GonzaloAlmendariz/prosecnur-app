import { describe, expect, it } from "vitest";
import { customRuleToRule, describeCustomParams, fraseDeReglaPropia, fraseEnTexto } from "./customRuleNarrative";
import type { ReglaCustom } from "./types";

describe("narrativa del cruce entre dos respuestas", () => {
  it("dice la condición real de cada lado", () => {
    const texto = describeCustomParams(
      "coherencia_2v",
      { op_x: "==", valor_x: "1", op_y: "not_in", valor_y: ["4", "5", "6", "8"] },
      ["p4", "p21"],
    );
    expect(texto).toBe("Se marca cuando p4 es 1 y p21 no cumple \"no es ninguna de 4, 5, 6, 8\".");
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

describe("frase de la regla en el panel", () => {
  const frase = (r: Parameters<typeof fraseDeReglaPropia>[0]) => {
    const piezas = fraseDeReglaPropia(r);
    return piezas ? fraseEnTexto(piezas) : null;
  };

  it("Dos respuestas que deben cuadrar: niega lo esperado y dice que un vacío marca", () => {
    expect(
      frase({ tipo: "coherencia_2v", variables: ["p4", "p9b"], params: { op_x: ">=", valor_x: "2025", op_y: "<=", valor_y: "5" } }),
    ).toBe("Se marca cuando p4 es mayor o igual a 2025 y p9b es mayor que 5 o está vacía.");
  });

  it("Dos respuestas que deben cuadrar contra otra pregunta", () => {
    const piezas = fraseDeReglaPropia({
      tipo: "coherencia_2v",
      variables: ["p4", "p21"],
      params: { op_x: "==", valor_x: "1", op_y: "<", valor_y_variable: "p15" },
    });
    expect(piezas && fraseEnTexto(piezas)).toBe("Se marca cuando p4 es 1 y p21 es mayor o igual a p15 o está vacía.");
    expect(piezas?.filter((p) => p.tipo === "pregunta").map((p) => (p.tipo === "pregunta" ? p.variable : ""))).toEqual(["p4", "p21", "p15"]);
  });

  it("Condiciones combinadas con alguna: une con o, no repite la pregunta y dice que un vacío no marca", () => {
    expect(
      frase({
        tipo: "condiciones",
        variables: [],
        params: {
          modo: "alguna",
          condiciones: [
            { variable: "p4", op: "<", variable_comparada: "p3a" },
            { variable: "p4", op: ">", valor: 2026 },
          ],
        },
      }),
    ).toBe("Se marca cuando p4 es menor que p3a o es mayor que 2026. Una pregunta vacía no cumple su condición.");
  });

  it("Condiciones combinadas con todas: une con y", () => {
    const piezas = fraseDeReglaPropia({
      tipo: "condiciones",
      variables: [],
      params: { modo: "todas", condiciones: [{ variable: "edad", op: "<", valor: 30 }, { variable: "hogar", op: ">=", valor: 4 }] },
    });
    expect(piezas?.filter((p) => p.tipo === "conector").map((p) => (p.tipo === "conector" ? p.texto : ""))).toEqual(["y"]);
  });

  it("una regla a medio armar no tiene frase", () => {
    expect(frase({ tipo: "coherencia_2v", variables: ["p4"], params: {} })).toBeNull();
    expect(frase({ tipo: "condiciones", variables: [], params: { modo: "todas", condiciones: [{ variable: "p4", op: ">" }] } })).toBeNull();
  });

  it("el filtro se lee al final", () => {
    expect(
      frase({
        tipo: "rango_num",
        variables: ["edad"],
        params: { min: "16", max: "25" },
        gate_conditions: [{ variable: "sede", op: "==", value: "2" }],
      }),
    ).toBe("Se marca cuando edad es menor que 16 o es mayor que 25. Solo se revisa cuando sede es 2.");
  });

  it("la narrativa de la lista describe condiciones y la comparación con otra pregunta", () => {
    expect(describeCustomParams("coherencia_2v", { op_x: "==", valor_x: "1", op_y: "<", valor_y_variable: "p15" }, ["p4", "p21"])).toBe(
      'Se marca cuando p4 es 1 y p21 no cumple "es menor que p15".',
    );
    expect(
      describeCustomParams("condiciones", { modo: "alguna", condiciones: [{ variable: "p4", op: ">", valor: 2026 }, { variable: "p5", op: "==", valor: "1" }] }),
    ).toBe("Se marca cuando p4 es mayor que 2026 o p5 es 1; una pregunta vacía no cumple su condición.");
  });
});
