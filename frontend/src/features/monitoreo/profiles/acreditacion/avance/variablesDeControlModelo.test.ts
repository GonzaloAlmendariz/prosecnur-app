import { describe, expect, it } from "vitest";
import { agruparVariablesDeControl, diferenciaMarcada, esSerieDeAnios, puntos, type FilaDeControl } from "./variablesDeControlModelo";

function fila(actor: string, variable: string, value: string, universe: number): FilaDeControl {
  return { actor, variable, value, universe, effective: 0, partial: 0, refusals: 0, unanswered: 0, baseShare: null, effectiveShare: null, deltaPp: null };
}

describe("Variables de control de Avance", () => {
  it("una serie de años se lee en orden cronológico, no por tamaño", () => {
    // Salía «2021, 2023, 2025, 2022» —por peso en el universo— y obligaba a
    // releer la columna para situarse en el tiempo.
    const grupos = agruparVariablesDeControl([fila("Egresados", "Año", "2023", 50), fila("Egresados", "Año", "2021", 90), fila("Egresados", "Año", "2022", 10)]);
    expect(grupos[0].variables[0].rows.map((r) => r.value)).toEqual(["2021", "2022", "2023"]);
  });

  it("solo aplica cuando TODAS las categorías son años; si no, manda el universo", () => {
    expect(esSerieDeAnios([{ value: "2021" }, { value: "Sin dato" }])).toBe(false);
    expect(esSerieDeAnios([{ value: "2021" }])).toBe(false);
    const grupos = agruparVariablesDeControl([fila("Docentes", "Dedicación", "TPC", 10), fila("Docentes", "Dedicación", "TPA", 90)]);
    expect(grupos[0].variables[0].rows.map((r) => r.value)).toEqual(["TPA", "TPC"]);
  });

  it("agrupa por público y variable", () => {
    const grupos = agruparVariablesDeControl([fila("A", "x", "1", 1), fila("B", "y", "1", 1), fila("A", "z", "1", 1)]);
    expect(grupos.map((g) => [g.actor, g.variables.map((v) => v.variable)])).toEqual([["A", ["x", "z"]], ["B", ["y"]]]);
  });

  it("la diferencia lleva signo y se marca desde 2 puntos", () => {
    expect(puntos(1.25)).toBe("+1.3 pp");
    expect(puntos(null)).toBe("—");
    expect(diferenciaMarcada(-2)).toBe(true);
    expect(diferenciaMarcada(1.9)).toBe(false);
  });
});
