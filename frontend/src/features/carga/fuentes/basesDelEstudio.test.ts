import { describe, expect, it } from "vitest";
import type { EstudioBase } from "../../../api/estudio";
import { basesVisibles, ordenarBasesDelEstudio, origenDeBase } from "./BasesDelEstudio";
import { errorNombreBase } from "./NuevaBaseArchivos";

const base = (nombre: string, extra: Partial<EstudioBase> = {}) => ({ nombre, ...extra }) as EstudioBase;

describe("Fuentes como lista de bases (propuesta F)", () => {
  it("dice de dónde viene cada base en palabras", () => {
    expect(origenDeBase(base("docentes", { source_kind: "surveymonkey" }))).toBe("SurveyMonkey");
    expect(origenDeBase(base("hogares", { source_kind: "kobo_repeat" }))).toBe("KoboToolbox");
    expect(origenDeBase(base("egresados", { source_kind: "manual" }))).toBe("Archivos");
    expect(origenDeBase(base("x"))).toBe("Archivos");
  });

  it("las hijas de un grupo repetido no son tarjetas propias: viven en su madre", () => {
    const e = { bases: { hogares: base("hogares"), miembros: base("miembros", { parent_base: "hogares" }), docentes: base("docentes") } };
    expect(basesVisibles(e).map((b) => b.nombre)).toEqual(["hogares", "docentes"]);
  });

  it("el nombre de una base nueva: sin espacios ni $, y sin repetir otra", () => {
    expect(errorNombreBase("", ["docentes"])).toBeNull();
    expect(errorNombreBase("egresados", ["docentes"])).toBeNull();
    expect(errorNombreBase("personal admin", [])).toMatch(/espacios/);
    expect(errorNombreBase("a$b", [])).toMatch(/espacios/);
    expect(errorNombreBase("docentes", ["docentes"])).toMatch(/Ya hay/);
  });
});

describe("Fuentes sigue el orden de la serie (M6)", () => {
  it("ordena las tarjetas como la serie declarada y deja al final las que no nombra", () => {
    const altas = [base("b2026"), base("b2024"), base("extra"), base("b2025")];
    expect(ordenarBasesDelEstudio(altas, ["b2024", "b2025", "b2026"]).map((b) => b.nombre))
      .toEqual(["b2024", "b2025", "b2026", "extra"]);
  });

  it("sin serie declarada: cronológico si todas nombran un año (F6), si no el orden de alta", () => {
    const altas = [base("b2026"), base("b2024")];
    expect(ordenarBasesDelEstudio(altas, []).map((b) => b.nombre)).toEqual(["b2024", "b2026"]);
    expect(ordenarBasesDelEstudio(altas, ["otra"]).map((b) => b.nombre)).toEqual(["b2024", "b2026"]);
    const mixtas = [base("b2026"), base("docentes"), base("b2024")];
    expect(ordenarBasesDelEstudio(mixtas, []).map((b) => b.nombre)).toEqual(["b2026", "docentes", "b2024"]);
  });
});
