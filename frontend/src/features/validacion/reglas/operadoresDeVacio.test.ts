import { describe, expect, it } from "vitest";

import type { ExploradorVariable } from "../types";
import { fraseDeReglaPropia, fraseEnTexto } from "../customRuleNarrative";
import { condicionParaGuardar, operatorOptionsForVariable, validarCondiciones, validateGateConditions } from "./modeloRegla";
import { leerOperador, leerOperadorNegado } from "./operadores";

const variable = (tipo: ExploradorVariable["tipo"]): ExploradorVariable => ({ name: "p8", label: "", tipo, n_validos: 0, n_nulos: 0 });

describe("está vacía y tiene respuesta", () => {
  it("se ofrecen en preguntas de respuesta única, número, fecha y texto; no en selección múltiple", () => {
    for (const tipo of ["so", "num", "fecha", "texto"] as const) {
      const ops = operatorOptionsForVariable(variable(tipo)).map((o) => o.value);
      expect(ops).toContain("is_empty");
      expect(ops).toContain("not_empty");
    }
    expect(operatorOptionsForVariable(variable("sm")).map((o) => o.value)).not.toContain("is_empty");
  });

  it("se leen en las tres formas del panel", () => {
    expect(leerOperador("is_empty")).toBe("está vacía");
    expect(leerOperador("not_empty")).toBe("tiene respuesta");
    expect(leerOperador("is_empty", "esperado")).toBe("esté vacía");
    expect(leerOperador("not_empty", "esperado")).toBe("tenga respuesta");
    expect(leerOperadorNegado("is_empty")).toBe("tiene respuesta");
    expect(leerOperadorNegado("not_empty")).toBe("está vacía");
  });

  it("una condición o un filtro sin valor está completo y se guarda sin valor", () => {
    expect(validarCondiciones([{ variable: "p8", op: "is_empty", valor: "" }])).toBe("");
    expect(validateGateConditions([{ variable: "p8", op: "not_empty", value: "" }])).toBe("");
    expect(condicionParaGuardar({ variable: "p8", op: "is_empty", valor: "3" }, () => "num")).toEqual({ variable: "p8", op: "is_empty" });
  });

  it("la frase de la regla los dice sin valor y aclara cuándo decide el vacío", () => {
    const frase = (r: Parameters<typeof fraseDeReglaPropia>[0]) => {
      const piezas = fraseDeReglaPropia(r);
      return piezas ? fraseEnTexto(piezas) : null;
    };
    expect(frase({ tipo: "condiciones", variables: [], params: { modo: "todas", condiciones: [{ variable: "sup", op: "is_empty" }] } }))
      .toBe("Se marca cuando sup está vacía.");
    expect(
      frase({ tipo: "condiciones", variables: [], params: { modo: "todas", condiciones: [{ variable: "p4", op: "==", valor: "1" }, { variable: "p21", op: "is_empty" }] } }),
    ).toBe("Se marca cuando p4 es 1 y p21 está vacía. En las condiciones con valor, una pregunta vacía no las cumple.");
    expect(
      frase({ tipo: "rango_num", variables: ["edad"], params: { min: "16" }, gate_conditions: [{ variable: "p15", op: "not_empty", value: "" }] }),
    ).toBe("Se marca cuando edad es menor que 16. Solo se revisa cuando p15 tiene respuesta.");
  });
});
