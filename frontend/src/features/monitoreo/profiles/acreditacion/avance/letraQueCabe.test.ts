import { describe, expect, it } from "vitest";
import { altoDeCifras, LETRA_MINIMA, letraQueCabe } from "./letraQueCabe";

describe("letraQueCabe", () => {
  it("con aire, la letra de siempre y en horizontal", () => {
    expect(letraQueCabe(44, ["123", "45"])).toEqual({ letra: 11, girar: false });
  });

  it("estrecho: baja la letra, nunca bajo el piso", () => {
    const letra = letraQueCabe(19, ["123"]);
    expect(letra.girar).toBe(false);
    expect(letra.letra).toBeGreaterThanOrEqual(LETRA_MINIMA);
    expect(letra.letra).toBeLessThan(11);
  });

  it("si ni al piso cabe, se gira en vez de volverse diminuta", () => {
    const letra = letraQueCabe(12, ["1234"]);
    expect(letra.girar).toBe(true);
    expect(letra.letra).toBeGreaterThanOrEqual(LETRA_MINIMA);
  });

  it("en un gráfico bajo no se gira: las cifras se alternan en dos alturas", () => {
    const letra = letraQueCabe(23, ["1,504"], { girable: false });
    expect(letra).toMatchObject({ girar: false, escalonar: true });
    expect(letra.letra).toBeGreaterThanOrEqual(LETRA_MINIMA);
    // La fila alta se reserva arriba: dos líneas en vez de una.
    expect(altoDeCifras(letra, ["1,504"])).toBeGreaterThan(altoDeCifras({ letra: letra.letra, girar: false }, ["1,504"]));
  });
});
