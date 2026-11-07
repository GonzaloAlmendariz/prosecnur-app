import { describe, expect, it } from "vitest";
import { acotarACaja, encuadre, type Caja } from "./camara";

// Una ciudad de 60 x 80 km en un lienzo de 1000 x 800 px.
const ciudad: Caja = [0, 0, 60_000, 80_000];
const t = { w: 1000, h: 800 };

describe("cámara con una ciudad abierta (revisión del 7 nov 2026)", () => {
  it("no se aleja más que el encuadre de la ciudad con su margen", () => {
    const minimo = encuadre(ciudad, t, 0.25).s;
    const lejos = acotarACaja({ x: 30_000, y: 40_000, s: minimo / 10 }, t, { caja: ciudad });
    expect(lejos.s).toBeCloseTo(minimo);
    // Acercarse sigue libre.
    expect(acotarACaja({ x: 30_000, y: 40_000, s: 1 }, t, { caja: ciudad }).s).toBe(1);
  });

  it("el centro no sale de la ciudad: no se arrastra hasta la vecina", () => {
    const c = acotarACaja({ x: 500_000, y: -200_000, s: 1 }, t, { caja: ciudad });
    expect([c.x, c.y]).toEqual([60_000, 0]);
  });

  it("sin límite la cámara queda como estaba", () => {
    const c = { x: 500_000, y: -200_000, s: 0.0001 };
    expect(acotarACaja(c, t, null)).toBe(c);
  });
});
