import { afterEach, describe, expect, test, vi } from "vitest";
import type { ChoiceCodeMap, SurveyMonkeyVisualLogicRule } from "../../../api/client";
import type { XlsformEditorWorkbook } from "../types";
import {
  deleteForm,
  deriveFormName,
  getActiveForm,
  listForms,
  loadForm,
  loadSnapshot,
  migrateLegacySingleForm,
  reconcileSnapshotWithBackend,
  saveForm,
  saveSnapshot,
  setActiveForm,
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

  test("normaliza metadata no textual de snapshots recuperables", () => {
    vi.stubGlobal("localStorage", makeStorage({
      "pulso.xlsformEditor.workbook.v2.no-project": JSON.stringify(workbook("restaurable")),
      "pulso.xlsformEditor.meta.v2.no-project": JSON.stringify({
        savedAt: 456,
        sourceName: {},
        sourceKind: {},
      }),
    }));
    vi.stubGlobal("sessionStorage", makeStorage());

    const out = loadSnapshot();

    expect(out?.sourceName).toBeNull();
    expect(out?.sourceKind).toBeNull();
    expect(out?.savedAt).toBe(456);
  });

  test("guarda metadata no textual como null", () => {
    const storage = makeStorage();
    vi.stubGlobal("localStorage", storage);

    const savedAt = saveSnapshot(workbook("guardable"), { sourceName: {} as never, sourceKind: {} as never });
    const rawMeta = storage.getItem("pulso.xlsformEditor.meta.v2.no-project");

    expect(savedAt).not.toBeNull();
    expect(JSON.parse(rawMeta ?? "{}")).toMatchObject({
      sourceName: null,
      sourceKind: null,
    });
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

// -----------------------------------------------------------------------------
// Colección multi-formulario
// -----------------------------------------------------------------------------

function untitledWorkbook(surveyLabel: string): XlsformEditorWorkbook {
  const wb = workbook(surveyLabel);
  // Vacía form_title para probar la cascada de deriveFormName.
  wb.settings = { name: "settings", columns: ["form_title", "form_id"], rows: [["", ""]] };
  return wb;
}

describe("deriveFormName cascada", () => {
  test("prefiere settings.form_title", () => {
    expect(deriveFormName(workbook("x"), { kind: "xlsform", original_name: "algo.xlsx" }, 3)).toBe("Demo");
  });

  test("cae a source.original_name sin extension cuando no hay form_title", () => {
    expect(deriveFormName(untitledWorkbook("x"), { kind: "xlsform", original_name: "Encuesta Docentes.xlsx" }, 3))
      .toBe("Encuesta Docentes");
  });

  test("cae a 'Formulario N' cuando no hay titulo ni origen", () => {
    expect(deriveFormName(untitledWorkbook("x"), null, 4)).toBe("Formulario 4");
    expect(deriveFormName(untitledWorkbook("x"), { kind: "blank", original_name: null }, 2)).toBe("Formulario 2");
  });
});

describe("biblioteca multi-formulario (round-trip)", () => {
  test("saveForm/listForms/loadForm/setActiveForm/deleteForm mantienen el indice consistente", () => {
    vi.stubGlobal("localStorage", makeStorage());
    vi.stubGlobal("sessionStorage", makeStorage());

    const savedA = saveForm("proj-1", "form-a", workbook("A"), { sourceName: "a.xlsx", sourceKind: "xlsform" });
    const savedB = saveForm("proj-1", "form-b", untitledWorkbook("B"), { sourceName: "Base B.xlsx", sourceKind: "xlsform" });
    expect(savedA).not.toBeNull();
    expect(savedB).not.toBeNull();

    const forms = listForms("proj-1");
    expect(forms.map((f) => f.id)).toEqual(["form-a", "form-b"]);
    expect(forms[0].name).toBe("Demo"); // form_title
    expect(forms[1].name).toBe("Base B"); // original_name sin extension

    // El workbook por-formulario se recupera por su id.
    expect(loadForm("proj-1", "form-a")?.workbook.survey.rows[0][2]).toBe("A");
    expect(loadForm("proj-1", "form-b")?.workbook.survey.rows[0][2]).toBe("B");
    expect(loadForm("proj-1", "no-existe")).toBeNull();

    // El activo se guarda como campo hermano del array.
    expect(getActiveForm("proj-1")).toBeNull();
    setActiveForm("proj-1", "form-b");
    expect(getActiveForm("proj-1")).toBe("form-b");
    // setActiveForm ignora ids fuera del indice.
    setActiveForm("proj-1", "fantasma");
    expect(getActiveForm("proj-1")).toBe("form-b");

    // Borrar el activo reasigna al mas reciente restante.
    const afterDelete = deleteForm("proj-1", "form-b");
    expect(afterDelete.forms.map((f) => f.id)).toEqual(["form-a"]);
    expect(afterDelete.activeFormId).toBe("form-a");
    expect(loadForm("proj-1", "form-b")).toBeNull();
  });

  test("otro scope no ve los formularios del primero", () => {
    vi.stubGlobal("localStorage", makeStorage());
    vi.stubGlobal("sessionStorage", makeStorage());
    saveForm("proj-1", "form-a", workbook("A"), { sourceName: "a.xlsx", sourceKind: "xlsform" });
    expect(listForms("proj-2")).toEqual([]);
  });
});

describe("migrateLegacySingleForm", () => {
  test("siembra la biblioteca desde el snapshot legacy sin borrarlo y es idempotente", () => {
    // El scope sanitiza no-alfanuméricos (scopeKey): usamos un scope simple
    // para que la clave legacy sembrada coincida con la que lee loadSnapshot.
    const storage = makeStorage({
      "pulso.xlsformEditor.workbook.v2.projx": JSON.stringify(workbook("legacy")),
      "pulso.xlsformEditor.meta.v2.projx": JSON.stringify({
        savedAt: 999,
        sourceName: "legacy.xlsx",
        sourceKind: "xlsform",
      }),
    });
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("sessionStorage", makeStorage());

    const migrated = migrateLegacySingleForm("projx");
    expect(migrated.forms).toHaveLength(1);
    expect(migrated.activeFormId).toBe(migrated.forms[0].id);
    const formId = migrated.forms[0].id;
    // El workbook quedo bajo la clave por-formulario.
    expect(loadForm("projx", formId)?.workbook.survey.rows[0][2]).toBe("legacy");
    // NO borra la clave legacy mono-formulario.
    expect(storage.getItem("pulso.xlsformEditor.workbook.v2.projx")).not.toBeNull();

    // Idempotente: una segunda corrida no duplica ni cambia el id activo.
    const again = migrateLegacySingleForm("projx");
    expect(again.forms).toHaveLength(1);
    expect(again.forms[0].id).toBe(formId);
    expect(again.activeFormId).toBe(formId);
  });

  test("sin snapshot legacy ni indice deja la biblioteca vacia", () => {
    vi.stubGlobal("localStorage", makeStorage());
    vi.stubGlobal("sessionStorage", makeStorage());
    const migrated = migrateLegacySingleForm("proj-vacio");
    expect(migrated.forms).toEqual([]);
    expect(migrated.activeFormId).toBeNull();
  });
});

describe("reconcile por-formulario", () => {
  test("preserva surveyMonkeyLogic del .pulso al abrir un formulario cuyo local la perdio", () => {
    vi.stubGlobal("localStorage", makeStorage());
    vi.stubGlobal("sessionStorage", makeStorage());
    // Local guardado sin logica (p.ej. localStorage nuevo).
    saveForm("proj-1", "form-a", workbook("editado local"), { sourceName: "a.xlsx", sourceKind: "xlsform" });
    const local = loadForm("proj-1", "form-a");
    // Remoto (.pulso) trae la logica de SurveyMonkey.
    const remote = snapshot(workbook("remoto", logic()), 500);

    const out = reconcileSnapshotWithBackend(local, remote);
    expect(out?.workbook.survey.rows[0][2]).toBe("editado local");
    expect(out?.workbook.surveyMonkeyLogic?.advanced_rules).toHaveLength(1);
    expect(out?.workbook.surveyMonkeyLogic?.choice_code_maps?.[0].variable).toBe("p27");
  });
});
