import { describe, expect, test } from "vitest";
import { conAjuste, deffAcotado, margenDesdePct, normalizarAjustes } from "./mapaDeAjustes";

describe("margen y DEFF por distrito (P3 de la paridad)", () => {
  test("un mapa vacío que llega como [] es {}, y se descartan valores que no sirven", () => {
    expect(normalizarAjustes([])).toEqual({});
    expect(normalizarAjustes(null)).toEqual({});
    expect(normalizarAjustes({ "150103": 0.08, "150108": "1.5", x: 0, y: "nada" })).toEqual({ "150103": 0.08, "150108": 1.5 });
  });

  test("poner y quitar el ajuste de un distrito", () => {
    const m = conAjuste({}, "150103", 0.08);
    expect(m).toEqual({ "150103": 0.08 });
    expect(conAjuste(m, "150103", null)).toEqual({});
    expect(conAjuste(m, "150108", Number.NaN)).toEqual({ "150103": 0.08 });
  });

  test("margen en % a fracción y DEFF, acotados", () => {
    expect(margenDesdePct(8)).toBeCloseTo(0.08);
    expect(margenDesdePct(500)).toBe(0.8);
    expect(deffAcotado(0)).toBe(0.1);
    expect(deffAcotado(1.4)).toBe(1.4);
  });
});
