import { describe, expect, it } from "vitest";

import { deltaFlip } from "./useReencajeLienzo";

const caja = (left: number, top: number, width: number, height: number) => ({ left, top, width, height });

describe("deltaFlip (re-encaje del lienzo)", () => {
  it("lleva la hoja nueva al centro y al ancho de la anterior", () => {
    // La Estructura (280 px) se cierra: la hoja crece de 800 a 1000 y su centro se corre a la izquierda.
    const d = deltaFlip(caja(380, 100, 800, 450), caja(240, 50, 1000, 562.5));
    expect(d).not.toBeNull();
    expect(d!.s).toBeCloseTo(0.8, 5);
    expect(d!.dx).toBeCloseTo(380 + 400 - (240 + 500), 5);
    expect(d!.dy).toBeCloseTo(100 + 225 - (50 + 281.25), 5);
  });

  it("no anima cuando la hoja no se movió (el inspector superpuesto a 1024)", () => {
    expect(deltaFlip(caja(10, 10, 600, 337.5), caja(10.4, 10, 600, 337.5))).toBeNull();
  });

  it("no anima contra una hoja sin tamaño", () => {
    expect(deltaFlip(caja(10, 10, 600, 337.5), caja(0, 0, 0, 0))).toBeNull();
  });
});
