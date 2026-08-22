/**
 * El paso «método» del recorrido no promete comparar ni decide por el analista.
 *
 * Decía «3. Método comparado», marcaba «por comparar» sin comparación y su glosa
 * afirmaba «La app elige la opción con mejor balance y menos repetidos». Las tres
 * quedaron falsas el 2026-08-22, cuando comparar dejó de ser requisito y la
 * configuración pasó a mandar (commit f2623619).
 */
import { describe, expect, it } from "vitest";
import { pasoMetodoElegido } from "../ClassroomSelectionPanels";

describe("el paso del método", () => {
  it("está listo con un método vigente aunque no se haya comparado", () => {
    const p = pasoMetodoElegido("Sistemático por facultad", false);
    expect(p.listo).toBe(true);
    expect(p.valor).toBe("Sistemático por facultad");
  });

  it("sin método vigente dice que falta elegir, no que falta comparar", () => {
    const p = pasoMetodoElegido(undefined, false);
    expect(p.listo).toBe(false);
    expect(p.valor).toBe("sin elegir");
    expect(p.valor).not.toMatch(/compar/i);
  });

  it("ninguna glosa dice que la app elige por el analista", () => {
    for (const comparado of [true, false]) {
      const { glosa } = pasoMetodoElegido("Optimizar repetidos", comparado);
      expect(glosa.toLowerCase()).not.toContain("la app elige");
      expect(glosa).toMatch(/puedes/i);
    }
  });

  it("la glosa cambia según se haya comparado o no", () => {
    expect(pasoMetodoElegido("X", true).glosa).not.toBe(pasoMetodoElegido("X", false).glosa);
  });
});
