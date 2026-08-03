import { describe, expect, it } from "vitest";

import { fmtDecimal } from "../parametrosVisuales";

/**
 * Un solo significado por símbolo en la misma pantalla.
 *
 * `fmtDecimal` forzaba coma decimal «en español» —la convención de España—
 * mientras el resto de la app formatea en `es-PE`, que usa punto decimal y coma
 * de miles. En la pestaña de Diseño convivían «21,362» (millares) y «1,96»
 * (decimales): **la misma coma con dos significados**, y «1,96» se puede leer
 * como 196.
 *
 * El error es silencioso porque cada número, por separado, se ve bien.
 */
describe("fmtDecimal · separador decimal", () => {
  it("usa punto decimal, como el resto de la app", () => {
    expect(fmtDecimal(1.96, 2)).toBe("1.96");
    expect(fmtDecimal(0.3, 1)).toBe("0.3");
  });

  it("conserva la coma para los miles, sin ambigüedad con el decimal", () => {
    expect(fmtDecimal(21362.55, 2)).toBe("21,362.55");
  });

  it("no deja ningún número con coma decimal", () => {
    for (const valor of [1.96, 2.17, 0.5, 1234.5]) {
      const texto = fmtDecimal(valor, 2);
      const decimal = texto.slice(texto.length - 3);
      expect(decimal, `${valor} → ${texto}`).not.toMatch(/,\d\d$/);
    }
  });
});
