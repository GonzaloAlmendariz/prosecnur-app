import { describe, expect, test } from "vitest";
import type { XlsformEditorWorkbook } from "../types";
import { cloneWorkbook } from "./sheetUtils";

function workbookWithEmptyRLogic(): XlsformEditorWorkbook {
  return {
    survey: {
      name: "survey",
      columns: ["type", "name", "label"],
      rows: [["text", "p1", "Pregunta"]],
    },
    choices: {
      name: "choices",
      columns: ["list_name", "name", "label"],
      rows: [],
    },
    settings: {
      name: "settings",
      columns: ["form_title", "form_id"],
      rows: [["Demo", "demo"]],
    },
    paper: null,
    diagnostico: null,
    // jsonlite serializa algunas listas vacias de R como `{}`. El editor
    // debe poder clonar ese estado sin caer antes de normalizarlo.
    surveyMonkeyLogic: {} as never,
  };
}

describe("cloneWorkbook", () => {
  test("tolera surveyMonkeyLogic vacio serializado como objeto", () => {
    const cloned = cloneWorkbook(workbookWithEmptyRLogic());

    expect(cloned.surveyMonkeyLogic?.advanced_rules).toEqual([]);
    expect(cloned.surveyMonkeyLogic?.visual_rules).toEqual([]);
    expect(cloned.surveyMonkeyLogic?.choice_order_overrides).toEqual({});
    expect(cloned.surveyMonkeyLogic?.choice_code_maps).toEqual([]);
  });
});
