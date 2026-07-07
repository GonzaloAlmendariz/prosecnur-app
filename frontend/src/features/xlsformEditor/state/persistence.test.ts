import { afterEach, describe, expect, test, vi } from "vitest";
import type { ChoiceCodeMap, SurveyMonkeyVisualLogicRule } from "../../../api/client";
import type { XlsformEditorWorkbook } from "../types";
import {
  loadSnapshot,
  reconcileSnapshotWithBackend,
  type PersistedSnapshot,
  workbookHasSurveyMonkeyLogic,
} from "./persistence";

function workbook(label: string, surveyMonkeyLogic: XlsformEditorWorkbook["surveyMonkeyLogic"] = null): XlsformEditorWorkbook {
  return {
    survey: {
      name: "survey",
      columns: ["type", "name", "label"],
      rows: [["text", "p1", label]],
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
    surveyMonkeyLogic,
  };
}

function snapshot(
  book: XlsformEditorWorkbook,
  savedAt: number,
  sourceName = "XLSF_MECA.xlsx",
): PersistedSnapshot {
  return {
    workbook: book,
    savedAt,
    sourceName,
    sourceKind: "xlsform",
    hallazgos: [],
  };
}

function makeStorage(initial: Record<string, string> = {}): Storage {
  const store = new Map(Object.entries(initial));
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const advancedRule = {
  id: "a1",
  texto: "Q7 NOT IN [C4, C5] => Ocultar P8",
  texto_humano: "Si p7 no esta en esas opciones, ocultar p8.",
  kobo_expr: "selected(${p7}, '4') or selected(${p7}, '5')",
};

const visualRule: SurveyMonkeyVisualLogicRule = {
  id: "v1",
  variableRef: "Q0001",
  variableLabel: "p1: consentimiento",
  choices: [
    {
      choiceName: "2",
      choiceLabel: "No",
      choiceIndex: 2,
      action: { kind: "end" },
    },
  ],
};

const choiceMap: ChoiceCodeMap = {
  variable: "p27",
  label: "Actividades laborales",
  type: "select_multiple",
  list_name: "lst_p27",
  status: "manual_editor",
  high_confidence: true,
  requires_confirmation: false,
  mappings: [
    {
      source_code: "1",
      source_column: "",
      source_label: "No me encuentro laborando",
      xls_code: "8",
      xls_label: "No me encuentro laborando",
      match: "manual_editor",
    },
  ],
};

function logic({
  advanced = [advancedRule],
  visual = [visualRule],
  maps = [choiceMap],
  overrides = { "27": ["No me encuentro laborando"] },
}: {
  advanced?: (typeof advancedRule)[];
  visual?: SurveyMonkeyVisualLogicRule[];
  maps?: ChoiceCodeMap[];
  overrides?: Record<string, string[]>;
} = {}): NonNullable<XlsformEditorWorkbook["surveyMonkeyLogic"]> {
  return {
    rules: advanced,
    advanced_rules: advanced,
    visual_rules: visual,
    choice_order_overrides: overrides,
    choice_code_maps: maps,
  };
}

describe("SurveyMonkey logic persistence reconciliation", () => {
  test("trata surveyMonkeyLogic vacio serializado desde R como sin logica", () => {
    expect(workbookHasSurveyMonkeyLogic(workbook("local", {} as never))).toBe(false);
  });

  test("recupera la logica del .pulso cuando localStorage la perdio", () => {
    const local = snapshot(workbook("local snapshot", {} as never), 100);
    const remote = snapshot(workbook("remote pulso", logic()), 200);

    const out = reconcileSnapshotWithBackend(local, remote);

    expect(out?.workbook.survey.rows[0][2]).toBe("local snapshot");
    expect(out?.savedAt).toBe(200);
    expect(out?.workbook.surveyMonkeyLogic?.advanced_rules).toHaveLength(1);
    expect(out?.workbook.surveyMonkeyLogic?.visual_rules).toHaveLength(1);
    expect(out?.workbook.surveyMonkeyLogic?.choice_code_maps?.[0].variable).toBe("p27");
  });

  test("no pisa reglas locales ya presentes, solo rellena piezas faltantes", () => {
    const localRule = {
      id: "local",
      texto: "Q1 = C2 => Fin de encuesta.",
      texto_humano: "Si responde no, termina.",
      kobo_expr: "${p1} != '2'",
    };
    const local = snapshot(workbook("local", logic({
      advanced: [localRule],
      visual: [],
      maps: [],
      overrides: {},
    })), 300);
    const remote = snapshot(workbook("remote", logic()), 200);

    const out = reconcileSnapshotWithBackend(local, remote);

    expect(out?.workbook.surveyMonkeyLogic?.advanced_rules[0].id).toBe("local");
    expect(out?.workbook.surveyMonkeyLogic?.visual_rules).toHaveLength(1);
    expect(out?.workbook.surveyMonkeyLogic?.choice_code_maps).toHaveLength(1);
  });
});

describe("XLSForm editor snapshot loading", () => {
  test("normaliza hojas opcionales incompletas antes de ofrecer restauracion", () => {
    const malformed = {
      ...workbook("restaurable"),
      paper: {},
      diagnostico: { rows: [["sin", "columnas"]] },
      surveyMonkeyLogic: {
        advanced_rules: {},
        visual_rules: [{ id: "v1", choices: [{}] }],
        choice_order_overrides: { Q1: "no-es-array" },
        choice_code_maps: [{ mappings: {} }],
      },
    };
    vi.stubGlobal("localStorage", makeStorage({
      "pulso.xlsformEditor.workbook.v2.no-project": JSON.stringify(malformed),
      "pulso.xlsformEditor.meta.v2.no-project": JSON.stringify({
        savedAt: 123,
        sourceName: "autosave.xlsx",
        sourceKind: "xlsform",
      }),
    }));
    vi.stubGlobal("sessionStorage", makeStorage());

    const out = loadSnapshot();

    expect(out?.sourceName).toBe("autosave.xlsx");
    expect(out?.workbook.paper?.columns).toContain("title");
    expect(out?.workbook.paper?.rows).toEqual([]);
    expect(out?.workbook.diagnostico).toBeNull();
    expect(out?.workbook.surveyMonkeyLogic?.advanced_rules).toEqual([]);
    expect(out?.workbook.surveyMonkeyLogic?.visual_rules[0]?.choices[0]?.action).toEqual({ kind: "none" });
    expect(out?.workbook.surveyMonkeyLogic?.choice_order_overrides.Q1).toEqual([]);
  });

  test("ignora snapshots con hojas requeridas sin columnas", () => {
    const malformed = {
      ...workbook("no restaurable"),
      survey: { rows: [["text", "p1", "Pregunta"]] },
    };
    vi.stubGlobal("localStorage", makeStorage({
      "pulso.xlsformEditor.workbook.v2.no-project": JSON.stringify(malformed),
    }));
    vi.stubGlobal("sessionStorage", makeStorage());

    expect(loadSnapshot()).toBeNull();
  });
});
