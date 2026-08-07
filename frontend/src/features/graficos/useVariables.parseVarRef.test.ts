import { describe, expect, it } from "vitest";
import { parseVarRef } from "./useVariables";

// El payload de un slide sobrevive al cambio de graficador: `vars` de
// multi-apiladas en modo `var_cruce` es un objeto de bloques, y al pasar ese
// slide a Radar el picker recibe un objeto donde el tipo promete un string.
describe("parseVarRef", () => {
  it("separa fuente y variable en una referencia multibase", () => {
    expect(parseVarRef("docentes$p30_1")).toEqual({ source: "docentes", name: "p30_1" });
    expect(parseVarRef("sexo")).toEqual({ source: null, name: "sexo" });
  });

  it("no revienta con un valor que no es string", () => {
    // Sin la guarda, `ref.indexOf` tumbaba la aplicación entera.
    const heredado = { Bloque1: ["docentes$p1"] } as unknown as string;
    expect(parseVarRef(heredado)).toEqual({ source: null, name: "" });
    expect(parseVarRef(["a"] as unknown as string)).toEqual({ source: null, name: "" });
    expect(parseVarRef(undefined)).toEqual({ source: null, name: "" });
  });
});
