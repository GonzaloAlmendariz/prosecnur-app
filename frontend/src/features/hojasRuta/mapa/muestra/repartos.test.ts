import { describe, expect, test } from "vitest";
import type { FilaTamano } from "./motorTamano";
import { repartoMinimos, repartoPorPoblacion } from "./repartos";

const fila = (ubigeo: string, poblacion: number, nMinimo: number): FilaTamano => ({ ubigeo, distrito: ubigeo, poblacion, nMinimo, nUsado: 0, margen: null, margenObjetivo: 0.1, deff: 1 });
const filas = [fila("a", 300, 90), fila("b", 100, 70)];

describe("atajos del reparto", () => {
  test("repartir según población respeta rutas completas y el total", () => {
    const r = repartoPorPoblacion(filas, 160, 8, "proportional");
    expect(r).toEqual({ a: 120, b: 40 });
    expect(Object.values(r).every((n) => n % 8 === 0)).toBe(true);
  });

  test("uniforme reparte igual sin mirar la población", () => {
    expect(repartoPorPoblacion(filas, 160, 8, "uniform")).toEqual({ a: 80, b: 80 });
  });

  test("los mínimos suben a la ruta completa siguiente", () => {
    expect(repartoMinimos(filas, 8)).toEqual({ a: 96, b: 72 });
  });
});
