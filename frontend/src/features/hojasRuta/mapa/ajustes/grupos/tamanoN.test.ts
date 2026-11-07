import { describe, expect, it } from "vitest";
import { divisoresEntre, intervaloP50, leerN, multiplosCercanos, nEfectivo } from "./tamanoN";

describe("tamaño y precisión: N, k y lo que se muestra", () => {
  it("lee el N escrito con o sin separadores", () => {
    expect(leerN("1,200")).toBe(1200);
    expect(leerN(" 1 800 ")).toBe(1800);
    expect(leerN("12a")).toBeNull();
    expect(leerN("0")).toBeNull();
  });
  it("ofrece los dos múltiplos de k más cercanos", () => {
    expect(multiplosCercanos(1195, 8)).toEqual([1192, 1200]);
    expect(multiplosCercanos(1200, 8)).toBeNull();
    expect(multiplosCercanos(5, 8)).toEqual([8, 8]);
  });
  it("k se elige entre los divisores de N de 4 a 12", () => {
    expect(divisoresEntre(1200)).toEqual([4, 5, 6, 8, 10, 12]);
    expect(divisoresEntre(1800)).toEqual([4, 5, 6, 8, 9, 10, 12]);
    expect(divisoresEntre(7)).toEqual([7]);
  });
  it("intervalo para p = 50 % y tamaño efectivo", () => {
    expect(intervaloP50(0.028)?.map((v) => Math.round(v * 10) / 10)).toEqual([47.2, 52.8]);
    expect(intervaloP50(null)).toBeNull();
    expect(nEfectivo(1200, 1.5)).toBe(800);
  });
});

import { alMultiplo } from "../../muestra/MargenCurva";
describe("curva interactiva", () => {
  it("el punto elegido se redondea a rutas completas, nunca bajo k", () => {
    expect(alMultiplo(1203, 8)).toBe(1200);
    expect(alMultiplo(1205, 8)).toBe(1208);
    expect(alMultiplo(3, 8)).toBe(8);
  });
});
