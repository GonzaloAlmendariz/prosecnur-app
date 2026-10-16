import { describe, expect, test } from "vitest";
import { normalizarColumnasPeso, normalizarPonderacionBases } from "./ponderacionBases";
import { ponderacionDeLaSerie } from "../features/analitica/ponderacionSerieModel";

describe("ponderación de todas las bases", () => {
  // Payload literal del backend (test-ponderacion-bases.R).
  const payload = {
    ok: true,
    bases: {
      b2024: { declarada: true, enabled: true, modo: "columna", peso_columna: "factor_ponderacion" },
      b2025: { declarada: false, enabled: null, modo: null, peso_columna: null, columnas_peso: ["factor_ponderacion"] },
      b2026: { declarada: true, enabled: false, modo: null, peso_columna: null },
      b2027: { declarada: true, enabled: true, modo: null, peso_columna: null },
    },
  };

  test("cada base con la regla del motor", () => {
    expect(normalizarPonderacionBases(payload)).toEqual({
      b2024: { tipo: "columna", columna: "factor_ponderacion" },
      b2025: { tipo: "sin_declarar", columnasPeso: ["factor_ponderacion"] },
      b2026: { tipo: "sin_ponderar" },
      b2027: { tipo: "calibracion" },
    });
  });

  test("la serie usa lo de cada base y no supone lo que el backend no lista", () => {
    const serie = ponderacionDeLaSerie(["b2024", "b2026", "b2030"], "b2026", normalizarPonderacionBases(payload));
    expect(serie.map((s) => s.ponderacion.tipo)).toEqual(["columna", "sin_ponderar", "sin_leer"]);
  });

  test("columnas_peso defensivo: arreglo, escalar de R, lista vacía `{}` o ausente", () => {
    expect(normalizarColumnasPeso(["factor_ponderacion", " ", "factor_ponderacion", "peso"])).toEqual(["factor_ponderacion", "peso"]);
    expect(normalizarColumnasPeso("factor_ponderacion")).toEqual(["factor_ponderacion"]);
    expect(normalizarColumnasPeso([])).toEqual([]);
    expect(normalizarColumnasPeso({})).toEqual([]);
    expect(normalizarColumnasPeso(["NA"])).toEqual([]);
    // Ausente (backend anterior) o nulo: no se sabe, no «ninguna».
    expect(normalizarColumnasPeso(undefined)).toBeNull();
    expect(normalizarColumnasPeso(null)).toBeNull();
    expect(normalizarPonderacionBases({ bases: {
      sin_peso: { declarada: [false], columnas_peso: [] },
      viejo: { declarada: false },
    } })).toEqual({
      sin_peso: { tipo: "sin_declarar", columnasPeso: [] },
      viejo: { tipo: "sin_declarar", columnasPeso: null },
    });
  });
});
