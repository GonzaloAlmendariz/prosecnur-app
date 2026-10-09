import { describe, expect, it } from "vitest";
import { pctDeCierre } from "./AulasAvanceProyectado";

/**
 * La probabilidad de cierre sale de una posterior Gamma-Poisson corregida por la
 * dispersión medida. `Math.round(p * 100)` la convertía en «100 %» desde 0,996 y
 * en «0 %» desde 0,004: dos afirmaciones absolutas que ese número no sostiene.
 *
 * Medido el 2026-08-30 en el estudio real: CIENCIAS E INGENIERIA / M llega con
 * `prob_cierre` 1 **estando 4 encuestas por debajo de su cuota**. La pantalla
 * decía «100 % de cerrar» sobre una celda que aún no había cerrado.
 */
describe("la probabilidad de cierre no afirma certeza", () => {
  it("no imprime 100 % ni siquiera con probabilidad 1", () => {
    expect(pctDeCierre(1)).toBe(">99 %");
    expect(pctDeCierre(0.996)).toBe(">99 %");
  });

  it("no imprime 0 % con una probabilidad pequeña pero real", () => {
    expect(pctDeCierre(0.004)).toBe("<1 %");
  });

  it("el cero de verdad SÍ es cero: no es lo mismo «casi imposible» que «imposible»", () => {
    expect(pctDeCierre(0)).toBe("0 %");
  });

  it("en el rango normal redondea como siempre, con el espacio que usa el perfil", () => {
    expect(pctDeCierre(0.612)).toBe("61 %");
    expect(pctDeCierre(0.937)).toBe("94 %");
    // Justo por debajo del tope: 0,99 no es «>99 %», es 99 %.
    expect(pctDeCierre(0.99)).toBe("99 %");
  });
});
