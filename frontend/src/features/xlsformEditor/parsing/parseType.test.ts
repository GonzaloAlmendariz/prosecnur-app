import { describe, expect, it } from "vitest";
import { asRequired, lecturaRequired } from "./parseType";
import { leerConContexto } from "../reglas/motor";

describe("lecturaRequired", () => {
  it.each(["yes", "YES", "true", "True", "1", "true()", "TRUE()", "si", "Sí", " sí "])("«%s» es siempre", (raw) => {
    expect(lecturaRequired(raw)).toBe("siempre");
  });

  it.each(["", "  ", "no", "NO", "false", "0", "false()", "False()"])("«%s» es nunca", (raw) => {
    expect(lecturaRequired(raw)).toBe("nunca");
  });

  it("null y undefined son nunca", () => {
    expect(lecturaRequired(null)).toBe("nunca");
    expect(lecturaRequired(undefined)).toBe("nunca");
  });

  it.each(["${edad} >= 18", "selected(${p1}, 'si')", "yes()"])("«%s» es expresión", (raw) => {
    expect(lecturaRequired(raw)).toBe("expresion");
  });

  it("asRequired sólo da true con la constante afirmativa", () => {
    expect(asRequired("true()")).toBe(true);
    expect(asRequired("sí")).toBe(true);
    expect(asRequired("no")).toBe(false);
    expect(asRequired("${edad} > 1")).toBe(false);
  });
});

describe("el motor de reglas lee required con la misma función", () => {
  const ctx = { columna: "required" as const, scope: { variables: [], catalogsByListName: new Map() }, actual: null };
  it.each([
    ["Sí", "Obligatoria"],
    ["true()", "Obligatoria"],
    ["FALSE()", "Opcional"],
  ])("«%s» se lee %s", (raw, voz) => {
    const lectura = leerConContexto("required", raw, ctx);
    expect(lectura.tecnica).toBe(false);
    expect(lectura.piezas).toHaveLength(1);
    expect(JSON.stringify(lectura.piezas[0])).toContain(voz);
  });
});
