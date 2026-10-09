/**
 * L7 del loop de mejoras (2026-09-27): las ayudas escribían «0,05» mientras la
 * pantalla pinta «z = 1.96» y «±5.0%». es-PE usa punto decimal.
 */
import { describe, expect, it } from "vitest";

import { AYUDA_MARGEN_MEDIA } from "../modeloParametros";

describe("ayudas de parámetros", () => {
  it("el margen de una media escribe el decimal con punto", () => {
    expect(AYUDA_MARGEN_MEDIA).not.toMatch(/\d,\d/);
    expect(AYUDA_MARGEN_MEDIA).toContain("0.05");
  });
});
