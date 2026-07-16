import { describe, expect, it } from "vitest";
import { detectMatrixCandidates } from "./detectMatrixCandidates";
import { createBlankWorkbook } from "./sheetUtils";
import type { XlsformEditorWorkbook } from "../types";

// Helper: arma un workbook con una hoja survey mínima (type/name/label) y,
// opcionalmente, una hoja choices (list_name/name/label).
function surveyWorkbook(
  rows: Array<[string, string, string]>,
  choices?: Array<[string, string, string]>,
): XlsformEditorWorkbook {
  const wb = createBlankWorkbook();
  wb.survey = {
    name: "survey",
    columns: ["type", "name", "label"],
    rows: rows.map((r) => [...r]),
  };
  if (choices) {
    wb.choices = {
      name: "choices",
      columns: ["list_name", "name", "label"],
      rows: choices.map((r) => [...r]),
    };
  }
  return wb;
}

describe("detectMatrixCandidates", () => {
  it("detecta runs matrizables (incluye singles), corta por sección y por lista distinta", () => {
    const wb = surveyWorkbook([
      // Run A: dos select_one con la misma lista en la raíz -> matriz de 2
      ["select_one satisfaccion", "p1", "Servicio A"],
      ["select_one satisfaccion", "p2", "Servicio B"],
      // Distinta lista -> corta el run A; queda como single (candidato de 1)
      ["select_one frecuencia", "p3", "Frecuencia X"],
      // Abre una sección: cambia de sección
      ["begin_group", "grupo_1", "Bloque 1"],
      // Run B: dos select_multiple con la misma lista DENTRO de la sección -> matriz de 2
      ["select_multiple medios", "p4", "Medio A"],
      ["select_multiple medios", "p5", "Medio B"],
      ["end_group", "grupo_1", ""],
      // Fuera de la sección, misma lista que dentro pero distinta sección:
      // una sola pregunta -> candidato de 1 (opt-in), separado del run B
      ["select_multiple medios", "p6", "Medio C"],
    ]);

    const candidates = detectMatrixCandidates(wb);
    // p1+p2 (×2), p3 (×1), p4+p5 (×2 Bloque 1), p6 (×1) = 4 candidatos
    expect(candidates).toHaveLength(4);
    const find = (list: string, section: string) =>
      candidates.find((c) => c.listName === list && c.sectionLabel === section);
    expect(find("satisfaccion", "Formulario")).toMatchObject({
      count: 2,
      memberNames: ["p1", "p2"],
      questionLabels: ["Servicio A", "Servicio B"],
    });
    expect(find("frecuencia", "Formulario")).toMatchObject({ count: 1, memberNames: ["p3"] });
    expect(find("medios", "Bloque 1")).toMatchObject({ count: 2, memberNames: ["p4", "p5"] });
    expect(find("medios", "Formulario")).toMatchObject({ count: 1, memberNames: ["p6"] });
  });

  it("una pregunta de otro tipo corta el run: dos singles, no una matriz de dos", () => {
    const wb = surveyWorkbook([
      ["select_one lista_x", "q1", "P1"],
      ["text", "nota", "Comentario"],
      ["select_one lista_x", "q2", "P2"],
    ]);
    const candidates = detectMatrixCandidates(wb);
    expect(candidates).toHaveLength(2);
    expect(candidates.every((c) => c.count === 1)).toBe(true);
    expect(candidates.map((c) => c.memberNames[0])).toEqual(["q1", "q2"]);
  });

  it("mismo list_name pero distinta sección no se fusiona (dos singles separados)", () => {
    const wb = surveyWorkbook([
      ["begin_group", "g1", "Sección 1"],
      ["select_one comun", "a1", "A1"],
      ["end_group", "g1", ""],
      ["begin_group", "g2", "Sección 2"],
      ["select_one comun", "a2", "A2"],
      ["end_group", "g2", ""],
    ]);
    const candidates = detectMatrixCandidates(wb);
    expect(candidates).toHaveLength(2);
    expect(candidates.every((c) => c.count === 1)).toBe(true);
    expect(candidates.map((c) => c.sectionLabel)).toEqual(["Sección 1", "Sección 2"]);
  });

  it("survey vacío devuelve []", () => {
    expect(detectMatrixCandidates(surveyWorkbook([]))).toEqual([]);
  });

  it("extrae scaleOptions de la lista del candidato, en orden", () => {
    const wb = surveyWorkbook(
      [
        ["select_one satisfaccion", "p1", "Servicio A"],
        ["select_one satisfaccion", "p2", "Servicio B"],
      ],
      [
        ["satisfaccion", "1", "De acuerdo"],
        ["satisfaccion", "2", "En desacuerdo"],
        ["satisfaccion", "9", "SIN INF"],
        // Otra lista no debe filtrarse dentro de las opciones del candidato.
        ["frecuencia", "1", "Siempre"],
      ],
    );

    const [candidate] = detectMatrixCandidates(wb);
    expect(candidate.scaleOptions).toEqual([
      { code: "1", label: "De acuerdo" },
      { code: "2", label: "En desacuerdo" },
      { code: "9", label: "SIN INF" },
    ]);
  });

  it("sin hoja choices poblada, scaleOptions es []", () => {
    const wb = surveyWorkbook([
      ["select_one lista_x", "q1", "P1"],
      ["select_one lista_x", "q2", "P2"],
    ]);
    const [candidate] = detectMatrixCandidates(wb);
    expect(candidate.scaleOptions).toEqual([]);
  });
});
