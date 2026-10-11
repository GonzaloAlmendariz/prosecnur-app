import { describe, expect, it } from "vitest";
import { disponibilidadCompartir } from "./disponibilidadCompartir";

describe("disponibilidad de compartir por alcance (decisión 20)", () => {
  it("en una base todo está disponible", () => {
    const d = disponibilidadCompartir("active");
    expect(Object.values(d).every((x) => x.habilitado)).toBe(true);
  });

  it("en el informe compartido lo que lee o escribe la base activa se deshabilita, con motivo claro", () => {
    const porBase = Object.fromEntries(Object.entries(disponibilidadCompartir("consolidated")).filter(([k]) => k !== "vaciarPlan"));
    expect(Object.keys(porBase).sort()).toEqual(["exportarJson", "importarJson", "planPortatil", "seccionesJson"]);
    for (const [clave, x] of Object.entries(porBase)) {
      expect(x.habilitado, clave).toBe(false);
      if (!x.habilitado) expect(x.motivo, clave).toMatch(/^El informe compartido no se comparte por base: \S/);
    }
  });

  it("vaciar el plan (C14) sigue disponible en el informe compartido: escribe en su propio borrador, no en la base activa", () => {
    expect(disponibilidadCompartir("consolidated").vaciarPlan).toEqual({ habilitado: true });
  });
});
