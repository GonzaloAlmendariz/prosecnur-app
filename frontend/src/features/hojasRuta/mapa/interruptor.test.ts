import { describe, expect, test } from "vitest";
import { CLAVE_INTERRUPTOR_LIENZO, lienzoHojasRutaEncendido } from "./interruptor";

describe("interruptor del lienzo de Hojas de ruta", () => {
  test("sólo «1» lo enciende; sin almacenamiento o con error queda la página vieja", () => {
    const con = (valor: string | null) => ({ getItem: (k: string) => (k === CLAVE_INTERRUPTOR_LIENZO ? valor : null) });
    expect(lienzoHojasRutaEncendido(con("1"))).toBe(true);
    expect(lienzoHojasRutaEncendido(con("true"))).toBe(false);
    expect(lienzoHojasRutaEncendido(con(null))).toBe(false);
    expect(lienzoHojasRutaEncendido(null)).toBe(false);
    expect(lienzoHojasRutaEncendido({ getItem: () => { throw new Error("bloqueado"); } })).toBe(false);
  });
});
