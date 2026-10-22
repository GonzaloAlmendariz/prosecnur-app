import { describe, expect, it } from "vitest";

import { rotulosDeCampos } from "./rotulosDeCampos";

describe("rotulosDeCampos: el chip dice el rótulo, en el lienzo y en Envíos", () => {
  const plantilla = { fields: [{ key: "carrera", tag: "CARRERA", label: "Carrera" }, { key: "sede", tag: "SEDE", label: "" }] };

  it("nombra «nombre» y cada campo por su rótulo, con respaldo legible si no lo tiene", () => {
    const r = rotulosDeCampos(plantilla);
    expect(r.rotuloDeCampo("nombre")).toBe("Nombre");
    expect(r.rotuloDeCampo("carrera")).toBe("Carrera");
    expect(r.rotuloDeCampo("sede")).not.toBe("");
    expect(r.ayudaDeCampo("carrera")).toBe("Carrera: cambia con cada persona");
  });

  it("sólo vale lo que la campaña declara (N5)", () => {
    const r = rotulosDeCampos(plantilla);
    expect(r.campoValido("nombre")).toBe(true);
    expect(r.campoValido("carrera")).toBe(true);
    expect(r.campoValido("facultad")).toBe(false);
  });
});
