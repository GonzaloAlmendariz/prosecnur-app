import { describe, expect, it } from "vitest";
import type { EstudioBase } from "../../../api/estudio";
import { basesVisibles, origenDeBase } from "./BasesDelEstudio";
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
