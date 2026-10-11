import { describe, expect, it } from "vitest";
import { disponibilidadCompartir } from "./disponibilidadCompartir";

describe("disponibilidad de compartir por alcance (decisión 20)", () => {
  it("en una base todo está disponible", () => {
    const d = disponibilidadCompartir("active");
    expect(Object.values(d).every((x) => x.habilitado)).toBe(true);
  });

  it("en el informe compartido todo se deshabilita, con motivo claro", () => {
    const d = disponibilidadCompartir("consolidated");
    for (const [clave, x] of Object.entries(d)) {
      expect(x.habilitado, clave).toBe(false);
      if (!x.habilitado) expect(x.motivo, clave).toMatch(/^El informe compartido no se comparte por base: \S/);
    }
  });
});
