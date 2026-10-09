import { describe, expect, it } from "vitest";

import { normalizaTecho, TECHO_MAXIMO, TECHO_MINIMO, TECHO_POR_DEFECTO } from "./techoElegible";

describe("normalizaTecho", () => {
  it("deja pasar un entero del rango", () => {
    expect(normalizaTecho(15)).toBe(15);
    expect(normalizaTecho("22")).toBe(22);
  });

  it("recorta a los extremos en vez de rechazar", () => {
    expect(normalizaTecho(0)).toBe(TECHO_MINIMO);
    expect(normalizaTecho(999)).toBe(TECHO_MAXIMO);
    expect(normalizaTecho(-4)).toBe(TECHO_MINIMO);
  });

  it("el vacío cae al valor por defecto, no al mínimo", () => {
    // `Number("")` es 0 y 0 es finito: sin esta rama, borrar el campo dejaba el
    // techo en 1 y el reparto entero se encogía a un aula.
    expect(normalizaTecho("")).toBe(TECHO_POR_DEFECTO);
    expect(normalizaTecho("   ")).toBe(TECHO_POR_DEFECTO);
    expect(normalizaTecho(null)).toBe(TECHO_POR_DEFECTO);
    expect(normalizaTecho(undefined)).toBe(TECHO_POR_DEFECTO);
  });

  it("lo que no es número cae al valor por defecto", () => {
    expect(normalizaTecho("quince")).toBe(TECHO_POR_DEFECTO);
    expect(normalizaTecho(Number.NaN)).toBe(TECHO_POR_DEFECTO);
    expect(normalizaTecho(Number.POSITIVE_INFINITY)).toBe(TECHO_POR_DEFECTO);
  });

  it("redondea el decimal en vez de truncarlo", () => {
    expect(normalizaTecho(12.7)).toBe(13);
  });
});
