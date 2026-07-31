import { describe, expect, it } from "vitest";
import { blockFromArgs, carryCruce, carryVars } from "./multiApiladasCarry";

describe("carryVars", () => {
  it("acarrea las preguntas de un modo simple", () => {
    expect(carryVars({ modo: "var", vars: ["a", "b"] })).toEqual(["a", "b"]);
  });

  it("acarrea la pregunta única del modo cruce", () => {
    expect(carryVars({ modo: "cruce", var: "a", cruces: "sexo" })).toEqual(["a"]);
  });

  it("aplana los temas de comparar públicos", () => {
    expect(carryVars({
      modo: "var_cruce",
      vars: { tema_1: ["docentes$p1"], tema_2: ["egresados$p2"] },
    })).toEqual(["docentes$p1", "egresados$p2"]);
  });

  it("las rescata del primer bloque al volver de Combinar bloques", () => {
    // El caso medido en la app: ida y vuelta por bloques dejaba el
    // constructor vacío.
    expect(carryVars({
      modo: "multilista",
      vars: null,
      bloques: [{ modo: "var", vars: ["a", "b"] }, { modo: "var", vars: ["c"] }],
    })).toEqual(["a", "b"]);
  });

  it("devuelve vacío cuando de verdad no hay nada", () => {
    expect(carryVars({ modo: "var" })).toEqual([]);
    expect(carryVars({ modo: "multilista", bloques: [{ modo: "var", vars: [] }] })).toEqual([]);
  });
});

describe("carryCruce", () => {
  it("conserva el cruce del modo actual y el del bloque", () => {
    expect(carryCruce({ cruces: "sexo" })).toBe("sexo");
    expect(carryCruce({ bloques: [{ modo: "var_cruce", cruces: "region" }] })).toBe("region");
    expect(carryCruce({})).toBe("");
  });
});

describe("blockFromArgs", () => {
  it("siembra el bloque con la lectura anterior en vez de dejarlo vacío", () => {
    expect(blockFromArgs({ modo: "var" }, ["a", "b"], "")).toEqual({ modo: "var", vars: ["a", "b"] });
  });

  it("conserva el cruce cuando la lectura lo usaba", () => {
    expect(blockFromArgs({ modo: "cruce" }, ["a"], "sexo")).toEqual({ modo: "cruce", var: "a", cruces: "sexo" });
    expect(blockFromArgs({ modo: "var_cruce" }, ["a", "b"], "sexo")).toEqual({ modo: "var_cruce", vars: ["a", "b"], cruces: "sexo" });
  });
});
