import { describe, expect, it } from "vitest";
import { detectMatrixCandidates } from "./detectMatrixCandidates";
import { createBlankWorkbook } from "./sheetUtils";
import type { XlsformEditorWorkbook } from "../types";

// Helper: arma un workbook con una hoja survey mínima (type/name/label).
function surveyWorkbook(rows: Array<[string, string, string]>): XlsformEditorWorkbook {
  const wb = createBlankWorkbook();
  wb.survey = {
    name: "survey",
    columns: ["type", "name", "label"],
    rows: rows.map((r) => [...r]),
  };
  return wb;
}

describe("detectMatrixCandidates", () => {
  it("detecta dos runs matrizables, corta por sección y por lista distinta", () => {
    const wb = surveyWorkbook([
      // Run A: dos select_one con la misma lista en la raíz -> matriz
      ["select_one satisfaccion", "p1", "Servicio A"],
      ["select_one satisfaccion", "p2", "Servicio B"],
      // Distinta lista -> corta el run A y NO forma matriz solo con una
      ["select_one frecuencia", "p3", "Frecuencia X"],
      // Abre una sección: cambia de sección
      ["begin_group", "grupo_1", "Bloque 1"],
      // Run B: dos select_multiple con la misma lista DENTRO de la sección -> matriz
      ["select_multiple medios", "p4", "Medio A"],
      ["select_multiple medios", "p5", "Medio B"],
      ["end_group", "grupo_1", ""],
      // Fuera de la sección, misma lista que dentro pero distinta sección:
      // una sola pregunta -> no forma matriz
      ["select_multiple medios", "p6", "Medio C"],
    ]);

    const candidates = detectMatrixCandidates(wb);
    expect(candidates).toHaveLength(2);

    const [a, b] = candidates;
    expect(a).toMatchObject({
      listName: "satisfaccion",
      count: 2,
      sectionLabel: "Formulario",
      memberNames: ["p1", "p2"],
      questionLabels: ["Servicio A", "Servicio B"],
    });
    expect(b).toMatchObject({
      listName: "medios",
      count: 2,
      sectionLabel: "Bloque 1",
      memberNames: ["p4", "p5"],
    });
    expect(a.id).not.toBe(b.id);
  });

  it("un run cortado por una pregunta de otro tipo no forma matriz", () => {
    const wb = surveyWorkbook([
      ["select_one lista_x", "q1", "P1"],
      ["text", "nota", "Comentario"],
      ["select_one lista_x", "q2", "P2"],
    ]);
    expect(detectMatrixCandidates(wb)).toHaveLength(0);
  });

  it("mismo list_name pero distinta sección no se fusiona", () => {
    const wb = surveyWorkbook([
      ["begin_group", "g1", "Sección 1"],
      ["select_one comun", "a1", "A1"],
      ["end_group", "g1", ""],
      ["begin_group", "g2", "Sección 2"],
      ["select_one comun", "a2", "A2"],
      ["end_group", "g2", ""],
    ]);
    expect(detectMatrixCandidates(wb)).toHaveLength(0);
  });

  it("survey vacío devuelve []", () => {
    expect(detectMatrixCandidates(surveyWorkbook([]))).toEqual([]);
  });
});
