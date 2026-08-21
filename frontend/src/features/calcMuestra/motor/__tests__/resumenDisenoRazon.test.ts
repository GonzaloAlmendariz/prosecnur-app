import { describe, expect, it } from "vitest";
import { primeraRazonInvalida } from "../ResumenDiseno";

describe("primeraRazonInvalida", () => {
  it("saca la razón que publicó R, con su mensaje", () => {
    // Caso real: el motor rechazó el resultado con
    // `population_design_sum_mismatch` y sum 629 contra expected 28.991. La
    // cabecera decía sólo «resultado inválido» y esa explicación se perdía.
    const state = {
      kind: "invalid",
      reasons: [{ code: "population_design_sum_mismatch", message: "La suma de facultades no coincide con el marco validado del diseño." }],
    };
    expect(primeraRazonInvalida(state)).toBe(
      "La suma de facultades no coincide con el marco validado del diseño.",
    );
  });

  it("acepta razones en texto plano, que es como llegan las del front", () => {
    expect(primeraRazonInvalida({ kind: "invalid", reasons: ["El resultado no tiene una forma válida."] }))
      .toBe("El resultado no tiene una forma válida.");
  });

  it("recorta lo que no cabe en una línea de cabecera", () => {
    const larga = "x".repeat(300);
    const r = primeraRazonInvalida({ kind: "invalid", reasons: [larga] }, 40)!;
    expect(r).toHaveLength(40);
    expect(r.endsWith("…")).toBe(true);
  });

  it("sólo habla cuando el estado es inválido", () => {
    expect(primeraRazonInvalida({ kind: "ready", reasons: ["no debería salir"] })).toBeNull();
    expect(primeraRazonInvalida({ kind: "stale", reasons: ["tampoco"] })).toBeNull();
    expect(primeraRazonInvalida({ kind: "legacy", reasons: ["ni esta"] })).toBeNull();
  });

  it("sin razón utilizable devuelve null y la cabecera conserva su texto", () => {
    expect(primeraRazonInvalida({ kind: "invalid" })).toBeNull();
    expect(primeraRazonInvalida({ kind: "invalid", reasons: [] })).toBeNull();
    expect(primeraRazonInvalida({ kind: "invalid", reasons: ["   ", { code: "x" }] })).toBeNull();
  });
});
