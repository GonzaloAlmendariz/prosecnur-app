import { describe, expect, test } from "vitest";
import { calcularTamano, margenTotalParaN, type EntradaTamano } from "./motorTamano";

const entrada: EntradaTamano = {
  distritos: [
    { ubigeo: "a", distrito: "A", poblacion: 400000 },
    { ubigeo: "b", distrito: "B", poblacion: 250000 },
  ],
  parametros: { confianza: 0.95, margenTotal: 0.04, margenDistrito: 0.1, p: 0.5, deff: 1.5, asignacion: "proportional", piso: false, respuesta: 0.9, fpc: true },
  modo: "calculator",
  nTotal: 0,
  nPorDistrito: {},
  porRuta: 8,
};

describe("margen de las alternativas", () => {
  test("para el N en uso coincide con el margen total del motor", () => {
    const r = calcularTamano(entrada);
    expect(margenTotalParaN(entrada, r.nUsado)).toBeCloseTo(r.margenTotal ?? 0, 12);
  });

  test("más N da menos margen", () => {
    expect(margenTotalParaN(entrada, 1600)!).toBeLessThan(margenTotalParaN(entrada, 800)!);
  });

  test("con N cero no hay margen", () => {
    expect(margenTotalParaN(entrada, 0)).toBeNull();
  });
});
