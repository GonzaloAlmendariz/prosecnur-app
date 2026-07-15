import { describe, expect, it } from "vitest";
import { detectConsentQuestions } from "./detectConsentQuestions";
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

describe("detectConsentQuestions", () => {
  it("devuelve solo select_one y acknowledge, en orden, con name+label", () => {
    const wb = surveyWorkbook([
      ["select_one si_no", "consentimiento", "¿Acepta participar?"],
      ["text", "nombre", "Nombre"],
      ["select_multiple medios", "medios", "Medios"],
      ["acknowledge", "ok", "Confirmo"],
      ["select_one satisfaccion", "p1", "Servicio A"],
    ]);

    const questions = detectConsentQuestions(wb);
    expect(questions).toEqual([
      { name: "consentimiento", label: "¿Acepta participar?" },
      { name: "ok", label: "Confirmo" },
      { name: "p1", label: "Servicio A" },
    ]);
  });

  it("usa el name como etiqueta cuando no hay label", () => {
    const wb = surveyWorkbook([["select_one si_no", "consentimiento", ""]]);
    expect(detectConsentQuestions(wb)).toEqual([
      { name: "consentimiento", label: "consentimiento" },
    ]);
  });

  it("descarta filas sin name", () => {
    const wb = surveyWorkbook([["select_one si_no", "  ", "Sin nombre"]]);
    expect(detectConsentQuestions(wb)).toEqual([]);
  });

  it("survey vacío devuelve []", () => {
    const wb = createBlankWorkbook();
    expect(detectConsentQuestions(wb)).toEqual([]);
  });
});
