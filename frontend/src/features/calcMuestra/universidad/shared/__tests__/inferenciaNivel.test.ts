import { describe, expect, it } from "vitest";
import { inferUniversityColumn } from "../categorias";

// Acuerdo de la reunión del diseño muestral (2026-07-15): "el nivel curricular
// manda; los créditos son apoyo". El motor R ya resuelve el rol level en ese
// orden (calc_muestra_aulas.R); este test fija el ESPEJO del frontend para que
// una base con ambas columnas sugiera la curricular.
describe("inferUniversityColumn — rol level (nivel curricular manda)", () => {
  it("con ambas columnas presentes prefiere 'Nivel curricular' sobre 'Nivel según créditos'", () => {
    const columnas = [
      "Código estudiante",
      "Nivel según créditos",
      "Nivel curricular",
      "Facultad",
    ];
    expect(inferUniversityColumn("level", columnas)).toBe("Nivel curricular");
  });

  it("el orden de las columnas en la base no altera la preferencia", () => {
    const columnas = ["Nivel curricular", "Nivel según créditos"];
    const invertidas = ["Nivel según créditos", "Nivel curricular"];
    expect(inferUniversityColumn("level", columnas)).toBe("Nivel curricular");
    expect(inferUniversityColumn("level", invertidas)).toBe("Nivel curricular");
  });

  it("Ciclo también gana a las variantes por créditos", () => {
    const columnas = ["Nivel por créditos", "Ciclo"];
    expect(inferUniversityColumn("level", columnas)).toBe("Ciclo");
  });

  it("sin variante curricular, créditos sigue mapeando (es apoyo, no descarte)", () => {
    const columnas = ["Código", "Nivel según créditos", "Facultad"];
    expect(inferUniversityColumn("level", columnas)).toBe("Nivel según créditos");
  });
});
