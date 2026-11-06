import { describe, expect, it } from "vitest";
import { nombreDelEstudio } from "./HomeHero";

const proyecto = { name: "acnur_acg", client: "", project_file: "acnur_acg.pulso", has_project: true, processing_mode: "", saved_at: "" };

describe("nombre del estudio en el Home (6 nov 2026)", () => {
  it("con nombre oficial en la Ficha, encabeza ése y no avisa", () => {
    expect(nombreDelEstudio("Monitoreo Acreditación PUCP 2026", proyecto)).toEqual({ nombre: "Monitoreo Acreditación PUCP 2026", faltaOficial: false });
  });
  it("sin nombre oficial, encabeza el del archivo y avisa", () => {
    expect(nombreDelEstudio("", proyecto)).toEqual({ nombre: "acnur_acg", faltaOficial: true });
  });
  it("mientras la Ficha no se lee, no afirma que falte", () => {
    expect(nombreDelEstudio(undefined, proyecto).faltaOficial).toBe(false);
  });
});
