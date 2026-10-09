import { describe, expect, it } from "vitest";

import { anchoDeBarraDelDia, UTIL_SERIE } from "./anchoDeBarra";

/**
 * La barra del día no se estrecha hasta dejar de leerse.
 *
 * Cada barra de la serie lleva CUATRO elementos dentro: el tramo claro del
 * techo, el oscuro de lo que el diseño pedía, y sendas líneas en la vara y en
 * el techo. El ancho se calculaba con tope pero **sin suelo**:
 *
 *     Math.min((UTIL / (fechas.length - 1)) * 0.36, 4.5)
 *
 * En un viewBox de 0–100 con `preserveAspectRatio="none"` sobre ~900 px, eso da
 * ~15,7 px con 20 días y **~5 px con 60**, donde los dos tonos dejan de
 * distinguirse. Es exactamente el defecto que el registro de pulido midió en el
 * Ritmo diario de telefónico: «una columna de barra apilada mide 7,9 px y sus
 * tres segmentos piden 12».
 *
 * El suelo NO puede ser absoluto: con muchísimos días el paso entre barras se
 * hace menor que el suelo y las barras se solaparían, que es peor. Se acota al
 * paso.
 */
describe("el ancho de la barra del día", () => {
  it("no cambia en el rango normal de un operativo", () => {
    // HSVG2026 duró cuatro semanas. Aquí el cálculo viejo ya daba ancho de
    // sobra, así que el suelo no debe alterarlo.
    for (const n of [5, 10, 20]) {
      const viejo = Math.min((UTIL_SERIE / (n - 1)) * 0.36, 4.5);
      expect(anchoDeBarraDelDia(n)).toBeCloseTo(viejo, 5);
    }
  });

  it("levanta el suelo cuando la barra se volvería ilegible", () => {
    // A 60 días el cálculo viejo daba 0,56 unidades: ~5 px para cuatro
    // elementos dentro.
    expect(Math.min((UTIL_SERIE / 59) * 0.36, 4.5)).toBeLessThan(0.6);
    expect(anchoDeBarraDelDia(60)).toBeGreaterThan(1);
  });

  it("pero NUNCA hasta que las barras se solapen", () => {
    // El paso entre centros es `UTIL / (n - 1)`. Una barra más ancha que el
    // paso pisa a su vecina, y dos barras pegadas se leen como una sola.
    for (const n of [30, 60, 120, 300]) {
      const paso = UTIL_SERIE / (n - 1);
      expect(anchoDeBarraDelDia(n)).toBeLessThanOrEqual(paso);
    }
  });

  it("con un solo día usa el ancho máximo", () => {
    expect(anchoDeBarraDelDia(1)).toBe(4.5);
  });
});
