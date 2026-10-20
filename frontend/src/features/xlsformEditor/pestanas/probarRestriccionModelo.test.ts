import { describe, expect, test } from "vitest";
import type { BuilderNode } from "../types";
import { casosDeRestriccion, resultadoDeCaso } from "./probarRestriccionModelo";

function nodo(base: string, constraint: string): BuilderNode {
  return {
    rowIndex: 1, depth: 1, kind: "question", label: "x", name: "x", sectionId: "root", typeInfo: { raw: base, base, listName: "" },
    required: false, relevant: "", constraint, calculation: "", choiceFilter: "", hint: "", appearance: "",
  };
}

describe("probar una restricción con casos de la propia regla", () => {
  test("REF10b MM/AAAA: un válido, inválidos que fallan por una cosa y el vacío", () => {
    const n = nodo("text", "regex(., '^[0-9]{2}[/][0-9]{4}$')");
    const casos = casosDeRestriccion(n);
    expect(resultadoDeCaso(n, casos[0]!)).toBe("acepta");
    expect(casos.slice(1, -1).every((v) => resultadoDeCaso(n, v) === "rechaza")).toBe(true);
    expect(casos.at(-1)).toBe("");
  });

  test("una hora aplicada da casos de hora, no correos ni fechas", () => {
    const casos = casosDeRestriccion(nodo("text", "regex(., '^(?:[0-1][0-9]|2[0-3]):[0-5][0-9]$')"));
    expect(casos.some((c) => /^\d{2}:\d{2}$/.test(c))).toBe(true);
    expect(casos.join(" ")).not.toContain("@");
  });

  test("el vacío no se evalúa contra la restricción", () => {
    expect(resultadoDeCaso(nodo("integer", ". >= 0"), "")).toBe("no-se-evalua");
    expect(resultadoDeCaso(nodo("integer", ". >= 0"), "-1")).toBe("rechaza");
  });
});
