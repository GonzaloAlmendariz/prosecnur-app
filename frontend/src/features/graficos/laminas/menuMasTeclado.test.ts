import { describe, expect, it } from "vitest";
import { indiceMenuTrasTecla } from "./BarraLaminas";

describe("menú ⋯ de Láminas por teclado", () => {
  it("flechas circulan, Inicio y Fin saltan a los extremos, otra tecla no navega", () => {
    expect(indiceMenuTrasTecla("ArrowDown", -1, 4)).toBe(0);
    expect(indiceMenuTrasTecla("ArrowDown", 3, 4)).toBe(0);
    expect(indiceMenuTrasTecla("ArrowUp", 0, 4)).toBe(3);
    expect(indiceMenuTrasTecla("ArrowUp", -1, 4)).toBe(3);
    expect(indiceMenuTrasTecla("Home", 2, 4)).toBe(0);
    expect(indiceMenuTrasTecla("End", 0, 4)).toBe(3);
    expect(indiceMenuTrasTecla("a", 0, 4)).toBeNull();
    expect(indiceMenuTrasTecla("ArrowDown", 0, 0)).toBeNull();
  });
});
