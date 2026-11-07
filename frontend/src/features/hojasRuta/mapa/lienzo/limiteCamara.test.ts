import { describe, expect, it } from "vitest";
import { acotarACaja, cajaVisible, encuadre, type Caja } from "./camara";

// Una ciudad de 60 x 80 km en un lienzo de 1000 x 800 px.
const ciudad: Caja = [0, 0, 60_000, 80_000];
const t = { w: 1000, h: 800 };
const limite = { caja: ciudad };

describe("cámara con una ciudad abierta (revisión del 7 nov 2026)", () => {
  it("no se aleja más que el encuadre de la ciudad con su margen", () => {
    const minimo = encuadre(ciudad, t, 0.1).s;
    const lejos = acotarACaja({ x: 30_000, y: 40_000, s: minimo / 10 }, t, limite);
    expect(lejos.s).toBeCloseTo(minimo);
    // Acercarse sigue libre.
    expect(acotarACaja({ x: 30_000, y: 40_000, s: 1 }, t, limite).s).toBe(1);
  });

  it("alejada al máximo, la ciudad entera queda en pantalla aunque se arrastre lejos", () => {
    const minimo = encuadre(ciudad, t, 0.1).s;
    const c = acotarACaja({ x: 500_000, y: -200_000, s: minimo }, t, limite);
    const [vx0, vy0, vx1, vy1] = cajaVisible(c, t);
    expect(vx0).toBeLessThanOrEqual(0);
    expect(vy0).toBeLessThanOrEqual(0);
    expect(vx1).toBeGreaterThanOrEqual(60_000);
    expect(vy1).toBeGreaterThanOrEqual(80_000);
  });

  it("acercada, la vista no pasa del borde de la ciudad más su margen", () => {
    const c = acotarACaja({ x: 500_000, y: -200_000, s: 0.1 }, t, limite);
    const [vx0, vy0, vx1] = cajaVisible(c, t);
    expect(vx1).toBeCloseTo(66_000);
    expect(vy0).toBeCloseTo(-8_000);
    expect(vx0).toBeGreaterThan(0);
  });

  it("sin límite la cámara queda como estaba", () => {
    const c = { x: 500_000, y: -200_000, s: 0.0001 };
    expect(acotarACaja(c, t, null)).toBe(c);
  });
});
