import { describe, expect, it } from "vitest";
import { textoConfirmarImportacion, textoConfirmarPlan } from "./textosConfirmacion";

describe("textos de confirmación", () => {
  it("reemplazar y combinar dicen qué pasa y que Deshacer no lo revierte", () => {
    const r = textoConfirmarImportacion("replace", 1, "a.json");
    expect(r).toMatchObject({ titulo: "¿Reemplazar 1 sección con «a.json»?", accion: "Reemplazar" });
    expect(r.detalle).toContain("Deshacer");
    const c = textoConfirmarImportacion("merge", 3, "b.json");
    expect(c).toMatchObject({ titulo: "¿Combinar 3 secciones de «b.json»?", accion: "Combinar" });
  });

  it("plan portátil en singular y plural", () => {
    expect(textoConfirmarPlan(1).titulo).toBe("¿Aplicar el plan a 1 base?");
    expect(textoConfirmarPlan(2).titulo).toBe("¿Aplicar el plan a 2 bases?");
  });
});
