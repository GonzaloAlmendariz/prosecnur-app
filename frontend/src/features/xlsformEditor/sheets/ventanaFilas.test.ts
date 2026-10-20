// Mata: una ventana que deja la fila visible fuera del DOM, o espaciadores que no suman el alto total (el scroll salta).
import { describe, expect, test } from "vitest";
import { calcularVentana, incluirFilas, offsetsDeFilas } from "./ventanaFilas";

describe("ventanaFilas", () => {
  test("offsets con alturas medidas y estimadas", () => {
    expect(offsetsDeFilas(3, new Map([[1, 100]]), 40)).toEqual([0, 40, 140, 180]);
  });

  test("la ventana cubre lo visible más el margen y los espaciadores suman el total", () => {
    const offsets = offsetsDeFilas(893, new Map(), 40);
    const v = calcularVentana({ offsets, desde: 4000, alto: 600, margen: 5 });
    expect(v.inicio).toBe(95);
    expect(v.fin).toBe(121);
    expect(v.arriba + (offsets[v.fin]! - offsets[v.inicio]!) + v.abajo).toBe(893 * 40);
  });

  test("bordes: arriba del todo, al final y hoja vacía", () => {
    const offsets = offsetsDeFilas(10, new Map(), 40);
    expect(calcularVentana({ offsets, desde: -50, alto: 120, margen: 2 })).toMatchObject({ inicio: 0, arriba: 0 });
    expect(calcularVentana({ offsets, desde: 9999, alto: 120, margen: 2 })).toMatchObject({ fin: 10, abajo: 0 });
    expect(calcularVentana({ offsets: [0], desde: 0, alto: 100, margen: 2 })).toEqual({ inicio: 0, fin: 0, arriba: 0, abajo: 0 });
  });

  test("la fila en edición cercana estira la ventana; una lejana no", () => {
    const offsets = offsetsDeFilas(200, new Map(), 10);
    const v = calcularVentana({ offsets, desde: 500, alto: 100, margen: 0 });
    expect(incluirFilas(v, offsets, [62, null])).toMatchObject({ inicio: 50, fin: 63, abajo: 1370 });
    expect(incluirFilas(v, offsets, [5])).toMatchObject({ inicio: 5, arriba: 50 });
    expect(incluirFilas(v, offsets, [190]).fin).toBe(61);
  });
});
