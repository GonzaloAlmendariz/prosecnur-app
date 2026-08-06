import { describe, expect, it } from "vitest";
import { avisoDeclaracionAplicada, estadoDeclaracionAplicada } from "./declaracionAplicada";

describe("desfase entre el mazo aplicado y la declaración", () => {
  it("un plan que no salió de la declaración no se compara", () => {
    // Sin este caso, cualquier proyecto con equivalencias declaradas vería el
    // aviso aunque su plan de láminas se hubiera armado a mano.
    expect(estadoDeclaracionAplicada({
      revisionAplicada: "", revisionActual: "abc", declarada: true,
    })).toBe("sin-mazo-derivado");
    expect(avisoDeclaracionAplicada("sin-mazo-derivado")).toBe("");
  });

  it("misma revisión, sin aviso", () => {
    expect(estadoDeclaracionAplicada({
      revisionAplicada: "abc", revisionActual: "abc", declarada: true,
    })).toBe("al-dia");
    expect(avisoDeclaracionAplicada("al-dia")).toBe("");
  });

  it("la declaración cambió después de aplicar", () => {
    const estado = estadoDeclaracionAplicada({
      revisionAplicada: "abc", revisionActual: "xyz", declarada: true,
    });
    expect(estado).toBe("desfasada");
    // El aviso tiene que decir por qué NO se actualiza solo: un plan que se
    // regenera destruiría las ediciones manuales sin dejar rastro.
    expect(avisoDeclaracionAplicada(estado)).toMatch(/no se actualiza solo/);
    expect(avisoDeclaracionAplicada(estado)).toMatch(/editado a mano/);
  });

  it("la declaración desapareció bajo un mazo ya aplicado", () => {
    // No es lo mismo que estar desfasado: no hay con qué contrastar, y las
    // láminas siguen siendo válidas.
    expect(estadoDeclaracionAplicada({
      revisionAplicada: "abc", revisionActual: "", declarada: false,
    })).toBe("declaracion-retirada");
    expect(estadoDeclaracionAplicada({
      revisionAplicada: "abc", revisionActual: "abc", declarada: false,
    })).toBe("declaracion-retirada");
  });
});
