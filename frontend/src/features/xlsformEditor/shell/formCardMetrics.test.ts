import { describe, expect, test } from "vitest";
import {
  computeFormMetrics,
  formatRelativeSavedAt,
  normalizeOrigin,
  originLabel,
} from "./formCardMetrics";
import type { XlsformEditorWorkbook } from "../types";

function workbook(rows: string[][]): XlsformEditorWorkbook {
  return {
    survey: { name: "survey", columns: ["type", "name", "label"], rows },
    choices: { name: "choices", columns: ["list_name", "name", "label"], rows: [] },
    settings: { name: "settings", columns: ["form_title"], rows: [["Encuesta"]] },
    paper: null,
    diagnostico: null,
    surveyMonkeyLogic: null,
  };
}

describe("computeFormMetrics", () => {
  test("cuenta preguntas excluyendo marcadores de grupo/repeat", () => {
    const wb = workbook([
      ["begin_group", "seccion_a", "Sección A"],
      ["text", "p1", "Pregunta 1"],
      ["select_one lista", "p2", "Pregunta 2"],
      ["end_group", "", ""],
      ["begin_repeat", "rep", "Bloque repetido"],
      ["integer", "p3", "Pregunta 3"],
      ["end_repeat", "", ""],
    ]);
    const m = computeFormMetrics(wb);
    expect(m.questions).toBe(3);
    expect(m.sections).toBe(1);
  });

  test("filas de type vacío no cuentan", () => {
    const wb = workbook([
      ["text", "p1", "Pregunta 1"],
      ["", "", ""],
      ["note", "n1", "Nota"],
    ]);
    expect(computeFormMetrics(wb).questions).toBe(2);
  });

  test("defensivo ante workbook nulo o sin survey", () => {
    expect(computeFormMetrics(null)).toEqual({ questions: 0, sections: 0 });
    expect(computeFormMetrics(undefined)).toEqual({ questions: 0, sections: 0 });
  });

  test("sin columna type devuelve ceros", () => {
    const wb: XlsformEditorWorkbook = {
      survey: { name: "survey", columns: ["name", "label"], rows: [["p1", "x"]] },
      choices: { name: "choices", columns: [], rows: [] },
      settings: { name: "settings", columns: [], rows: [] },
      paper: null,
      diagnostico: null,
      surveyMonkeyLogic: null,
    };
    expect(computeFormMetrics(wb)).toEqual({ questions: 0, sections: 0 });
  });

  test("cuenta múltiples secciones", () => {
    const wb = workbook([
      ["begin_group", "a", "A"],
      ["text", "p1", "1"],
      ["end_group", "", ""],
      ["begin_group", "b", "B"],
      ["text", "p2", "2"],
      ["end_group", "", ""],
    ]);
    expect(computeFormMetrics(wb).sections).toBe(2);
  });
});

describe("formatRelativeSavedAt", () => {
  const now = 1_000_000_000_000;
  test("recién para diferencias menores a 45s", () => {
    expect(formatRelativeSavedAt(now - 10_000, now)).toBe("recién");
  });
  test("minutos", () => {
    expect(formatRelativeSavedAt(now - 5 * 60_000, now)).toBe("hace 5 min");
  });
  test("horas", () => {
    expect(formatRelativeSavedAt(now - 3 * 3_600_000, now)).toBe("hace 3 h");
  });
  test("días", () => {
    expect(formatRelativeSavedAt(now - 2 * 86_400_000, now)).toBe("hace 2 d");
  });
  test("meses en singular y plural", () => {
    expect(formatRelativeSavedAt(now - 31 * 86_400_000, now)).toBe("hace 1 mes");
    expect(formatRelativeSavedAt(now - 70 * 86_400_000, now)).toBe("hace 2 meses");
  });
  test("timestamp futuro cae a recién", () => {
    expect(formatRelativeSavedAt(now + 5_000, now)).toBe("recién");
  });
});

describe("normalizeOrigin / originLabel", () => {
  test("normaliza kinds conocidos", () => {
    expect(normalizeOrigin("xlsform")).toBe("xlsform");
    expect(normalizeOrigin("surveymonkey")).toBe("surveymonkey");
    expect(normalizeOrigin(null)).toBe("blank");
    expect(normalizeOrigin("otro")).toBe("blank");
  });
  test("etiquetas humanas", () => {
    expect(originLabel("xlsform")).toContain("XLSForm");
    expect(originLabel("surveymonkey")).toContain("SurveyMonkey");
    expect(originLabel("blank")).toContain("cero");
  });
});
