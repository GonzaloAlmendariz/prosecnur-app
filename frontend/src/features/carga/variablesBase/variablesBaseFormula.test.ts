// Regla «fórmula» de una variable calculada (ADR 0106, 2026-10-16).
import { describe, expect, it } from "vitest";
import { normalizarCalculada, normalizarResumenCalculada } from "../../../api/baseVariables";
import {
  borradorCalculadaDesde,
  calculadaParaGuardar,
  insertarEnFormula,
  preguntasUsables,
  reducirCalculada,
  reglaLegible,
  textoResumen,
  validarCalculada,
  variablesDeFormula,
} from "./variablesBaseModel";

describe("variable calculada: fórmula", () => {
  it("lee las variables de la expresión, sueltas o entre comillas invertidas", () => {
    expect(variablesDeFormula("2026 - P8")).toEqual(["P8"]);
    expect(variablesDeFormula("(P5 + P6) / P5 * 100")).toEqual(["P5", "P6"]);
    expect(variablesDeFormula("`x-1` + P10.88")).toEqual(["x-1", "P10.88"]);
    expect(variablesDeFormula("2.5 * 3")).toEqual([]);
  });

  it("insertar agrega el nombre al final y protege un nombre con guion", () => {
    expect(insertarEnFormula("", "P8")).toBe("P8");
    expect(insertarEnFormula("2026 -", "P8")).toBe("2026 - P8");
    expect(insertarEnFormula("1 +", "x-1")).toBe("1 + `x-1`");
  });

  it("valida, arma el cuerpo y se lee en llano", () => {
    let b = borradorCalculadaDesde(null);
    b = reducirCalculada(b, { tipo: "etiqueta", valor: "Años en la universidad" });
    b = reducirCalculada(b, { tipo: "regla", valor: "formula" });
    expect(validarCalculada(b, ["P8"])).toContain("Escribe la fórmula.");
    b = reducirCalculada(b, { tipo: "expresion", valor: "2026 - P9" });
    expect(validarCalculada(b, ["P8"])).toContain("La base no tiene «P9».");
    b = reducirCalculada(b, { tipo: "expresion", valor: " 2026 - P8 " });
    expect(validarCalculada(b, ["P8"])).toEqual([]);
    expect(calculadaParaGuardar(b)).toEqual({
      nombre: b.nombre, etiqueta: "Años en la universidad", regla: "formula", expresion: "2026 - P8", variables: ["P8"],
    });
    expect(reglaLegible({ regla: "formula", variables: ["P8"], codigos: [], escala: [], expresion: "2026 - P8" })).toBe("= 2026 - P8");
  });

  it("el servidor la devuelve con su expresión y el resumen es numérico", () => {
    const c = normalizarCalculada({ nombre: "anios", regla: "formula", expresion: "2026 - P8", variables: ["P8"], especiales_na: ["P8"], escala: [] });
    expect(c?.regla).toBe("formula");
    expect(c?.expresion).toBe("2026 - P8");
    expect(c?.especiales_na).toEqual(["P8"]);
    expect(borradorCalculadaDesde(c).formula.expresion).toBe("2026 - P8");
    const r = normalizarResumenCalculada({ por_codigo: [], n_sin_dato: 5, n_total: 105, n_validos: 100, minimo: 0, maximo: 9 });
    expect(textoResumen(r)).toBe("Con valor 100 · de 0 a 9 · Sin dato 5");
  });

  it("puede partir de una calculada anterior, no de sí misma ni de las de después", () => {
    const v = (name: string) => ({ name, label: name, seccion: "" });
    const catalogo = [v("P8"), v("a"), v("b"), v("c")];
    const calculadas = [{ nombre: "a" }, { nombre: "b" }, { nombre: "c" }];
    expect(preguntasUsables(catalogo, calculadas, "b").map((x) => x.name)).toEqual(["P8", "a"]);
    expect(preguntasUsables(catalogo, calculadas).map((x) => x.name)).toEqual(["P8", "a", "b", "c"]);
  });
});
