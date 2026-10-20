import { describe, expect, it } from "vitest";
import { scopeKey } from "../state/persistence";
import {
  DEFAULT_PDF_DIALOG_STATE,
  DEFAULT_PDF_EXPORT_PREFERENCE,
  buildMatrixGroups,
  buildMatrixGroupsFromChoices,
  buildPaperExportOptions,
  exportWarningDetail,
  loadPdfDialogState,
  matrixChoiceFor,
  parsePdfDialogState,
  pdfDialogStorageKey,
  savePdfDialogState,
  serializePdfDialogState,
  columnsLabel,
  exportButtonTitle,
  logicLanguageLabel,
  questionnaireNumberLabel,
} from "./pdfExportPreference";
import type { MatrixCandidate } from "../parsing/detectMatrixCandidates";

function candidate(id: string, members: string[]): MatrixCandidate {
  return {
    id,
    sectionLabel: "Formulario",
    listName: "escala",
    count: members.length,
    memberNames: members,
    questionLabels: members.map((m) => m.toUpperCase()),
    scaleOptions: [
      { code: "1", label: "De acuerdo" },
      { code: "9", label: "SIN INF" },
    ],
  };
}

describe("pdfExportPreference", () => {
  it("default es dos columnas + saltos + N.º de cuestionario ON (comportamiento histórico)", () => {
    expect(DEFAULT_PDF_EXPORT_PREFERENCE).toEqual({
      columns: 2,
      logicLanguage: "saltos",
      showQuestionnaireNumber: true,
    });
  });

  it("etiqueta de columnas", () => {
    expect(columnsLabel(1)).toBe("una columna");
    expect(columnsLabel(2)).toBe("dos columnas");
    // "auto" es un valor del motor (reparto por tramos) que hasta ahora no se
    // podía elegir desde el editor: el tipo era `1 | 2` y ni siquiera era
    // representable. Sin etiqueta propia caería en el `else` y el botón de
    // exportar diría "dos columnas" mientras genera otra cosa.
    expect(columnsLabel("auto")).toBe("columnas automáticas");
  });

  it("el título del botón refleja «auto» en vez de mentir con «dos columnas»", () => {
    expect(exportButtonTitle({ ...DEFAULT_PDF_EXPORT_PREFERENCE, columns: "auto" }))
      .toContain("columnas automáticas");
  });

  it("etiqueta de lenguaje de lógica", () => {
    expect(logicLanguageLabel("saltos")).toBe("saltos");
    expect(logicLanguageLabel("condiciones")).toBe("condiciones");
  });

  it("etiqueta del N.º de cuestionario", () => {
    expect(questionnaireNumberLabel(true)).toBe("con N.º de cuestionario");
    expect(questionnaireNumberLabel(false)).toBe("sin N.º de cuestionario");
  });

  it("title del botón combina las tres dimensiones", () => {
    expect(
      exportButtonTitle({ columns: 1, logicLanguage: "condiciones", showQuestionnaireNumber: false }),
    ).toBe("Exportar PDF (una columna, condiciones, sin N.º de cuestionario)");
    expect(exportButtonTitle(DEFAULT_PDF_EXPORT_PREFERENCE)).toBe(
      "Exportar PDF (dos columnas, saltos, con N.º de cuestionario)",
    );
  });
});

describe("buildMatrixGroups", () => {
  const c1 = candidate("matrix_0", ["p1", "p2"]);
  const c2 = candidate("matrix_5", ["p4", "p5"]);

  it("candidato con tenor produce { members, tenor }", () => {
    const groups = buildMatrixGroups([c1], new Set(), {
      matrix_0: "  A continuación, indique…  ",
    });
    expect(groups).toEqual([
      { members: ["p1", "p2"], tenor: "A continuación, indique…" },
    ]);
  });

  it("candidato sin tenor (o solo espacios) produce { members } sin tenor", () => {
    const groups = buildMatrixGroups([c1, c2], new Set(), { matrix_5: "   " });
    expect(groups).toEqual([{ members: ["p1", "p2"] }, { members: ["p4", "p5"] }]);
    expect(groups[0]).not.toHaveProperty("tenor");
    expect(groups[1]).not.toHaveProperty("tenor");
  });

  it("candidato desactivado no aparece en la salida", () => {
    const groups = buildMatrixGroups([c1, c2], new Set(["matrix_0"]), {
      matrix_0: "no debería salir",
      matrix_5: "sí sale",
    });
    expect(groups).toEqual([{ members: ["p4", "p5"], tenor: "sí sale" }]);
  });

  it("sin candidatos devuelve []", () => {
    expect(buildMatrixGroups([], new Set(), {})).toEqual([]);
  });

  it("special ausente o 'auto' omite el campo del payload", () => {
    const sinMap = buildMatrixGroups([c1], new Set(), {});
    expect(sinMap[0]).not.toHaveProperty("special");
    const conAuto = buildMatrixGroups([c1], new Set(), {}, { matrix_0: "auto" });
    expect(conAuto[0]).not.toHaveProperty("special");
    // Un valor de solo espacios colapsa a "auto" y también se omite.
    const soloEspacios = buildMatrixGroups([c1], new Set(), {}, { matrix_0: "  " });
    expect(soloEspacios[0]).not.toHaveProperty("special");
  });

  it("special = 'none' produce el campo special: 'none'", () => {
    const groups = buildMatrixGroups([c1], new Set(), {}, { matrix_0: "none" });
    expect(groups).toEqual([{ members: ["p1", "p2"], special: "none" }]);
  });

  it("special con un código de opción lo incluye junto al tenor", () => {
    const groups = buildMatrixGroups(
      [c1],
      new Set(),
      { matrix_0: "Indique…" },
      { matrix_0: "9" },
    );
    expect(groups).toEqual([{ members: ["p1", "p2"], tenor: "Indique…", special: "9" }]);
  });

  it("header ausente o 'auto' omite el campo del payload", () => {
    const sinMap = buildMatrixGroups([c1], new Set(), {});
    expect(sinMap[0]).not.toHaveProperty("header");
    const conAuto = buildMatrixGroups([c1], new Set(), {}, {}, { matrix_0: "auto" });
    expect(conAuto[0]).not.toHaveProperty("header");
    const soloEspacios = buildMatrixGroups([c1], new Set(), {}, {}, { matrix_0: "  " });
    expect(soloEspacios[0]).not.toHaveProperty("header");
  });

  it("header = 'extremos'/'categorias' produce el campo header", () => {
    const extremos = buildMatrixGroups([c1], new Set(), {}, {}, { matrix_0: "extremos" });
    expect(extremos).toEqual([{ members: ["p1", "p2"], header: "extremos" }]);
    const categorias = buildMatrixGroups([c1], new Set(), {}, {}, { matrix_0: "categorias" });
    expect(categorias).toEqual([{ members: ["p1", "p2"], header: "categorias" }]);
  });

  it("header convive con tenor y special", () => {
    const groups = buildMatrixGroups(
      [c1],
      new Set(),
      { matrix_0: "Indique…" },
      { matrix_0: "9" },
      { matrix_0: "categorias" },
    );
    expect(groups).toEqual([
      { members: ["p1", "p2"], tenor: "Indique…", special: "9", header: "categorias" },
    ]);
  });
});

function memStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    data,
  };
}

describe("estado persistido del diálogo", () => {
  const RUTA = "/Users/x/Drive/Estudios/2026_PUCP_Acreditacion_Contabilidad/V3_Conta 11-08 equivalencias.pulso";
  const OTRA = "/Users/x/Drive/Estudios/2026_PUCP_Acreditacion_Contabilidad/Conta 09-08 equivalencias.pulso";

  it("la clave separa proyecto y formulario, con el scopeKey del autosave", () => {
    expect(pdfDialogStorageKey(RUTA, "f1")).toBe(`pulso.xlsformEditor.pdfExport.v1.${scopeKey(RUTA)}.f1`);
    expect(pdfDialogStorageKey(RUTA, "f1")).not.toBe(pdfDialogStorageKey(OTRA, "f1"));
    expect(pdfDialogStorageKey(RUTA, "f1")).not.toBe(pdfDialogStorageKey(RUTA, "f2"));
    expect(pdfDialogStorageKey(RUTA, null)).toBeNull();
    expect(pdfDialogStorageKey(null, "f1")).toBe("pulso.xlsformEditor.pdfExport.v1.no-project.f1");
  });

  it("vacío o corrupto → defaults", () => {
    expect(parsePdfDialogState(null)).toEqual(DEFAULT_PDF_DIALOG_STATE);
    expect(parsePdfDialogState("")).toEqual(DEFAULT_PDF_DIALOG_STATE);
    expect(parsePdfDialogState("{no json")).toEqual(DEFAULT_PDF_DIALOG_STATE);
    expect(parsePdfDialogState("[1,2]")).toEqual(DEFAULT_PDF_DIALOG_STATE);
    expect(parsePdfDialogState("null")).toEqual(DEFAULT_PDF_DIALOG_STATE);
  });

  it("campos inválidos caen a su default uno por uno", () => {
    const state = parsePdfDialogState(
      JSON.stringify({
        columns: 3,
        logicLanguage: "condiciones",
        showQuestionnaireNumber: "no",
        matrixLayout: "column",
        maxOptionsPerQuestion: 2,
        defaultIntro: false,
        showHeaderTitle: 0,
        matrices: { "p1|p2": { enabled: false, header: "raro", tenor: 5 } },
      }),
    );
    expect(state.columns).toBe(2);
    expect(state.logicLanguage).toBe("condiciones");
    expect(state.showQuestionnaireNumber).toBe(true);
    expect(state.matrixLayout).toBe("column");
    expect(state.maxOptionsPerQuestion).toBe(18);
    expect(state.defaultIntro).toBe(false);
    expect(state.showHeaderTitle).toBe(true);
    expect(state.matrices).toEqual({ "p1|p2": { enabled: false } });
  });

  it("ida y vuelta conserva todo; las matrices viajan por firma de miembros", () => {
    const c = candidate("matrix_0", ["p1", "p2"]);
    const state = {
      ...DEFAULT_PDF_DIALOG_STATE,
      columns: "auto" as const,
      consentVar: "consiente",
      maxOptionsPerQuestion: 25,
      defaultIntro: false,
      showHeaderTitle: false,
      matrices: { "p1|p2": { enabled: true, tenor: "Indique…", special: "9", header: "extremos" } },
    };
    expect(parsePdfDialogState(serializePdfDialogState(state, [c]))).toEqual(state);
  });

  it("restaurar con matrices viejas: las firmas que ya no existen se ignoran", () => {
    const saved = parsePdfDialogState(
      JSON.stringify({ matrices: { "q1|q2": { tenor: "viejo" }, "p1|p2": { enabled: true, tenor: "vigente" } } }),
    );
    // El candidato vigente cambió de id (se insertó una fila arriba): la firma lo encuentra igual.
    const c = candidate("matrix_7", ["p1", "p2"]);
    expect(buildMatrixGroupsFromChoices([c], saved.matrices)).toEqual([
      { members: ["p1", "p2"], tenor: "vigente" },
    ]);
    // Al guardar, la firma vieja se poda.
    expect(JSON.parse(serializePdfDialogState(saved, [c])).matrices).toEqual({ "p1|p2": { enabled: true, tenor: "vigente" } });
    // Sin candidatos (workbook aún sin cargar) no se poda nada.
    expect(Object.keys(JSON.parse(serializePdfDialogState(saved, [])).matrices)).toHaveLength(2);
  });

  it("columna especial guardada que ya no está en la escala vuelve a auto", () => {
    const c = candidate("matrix_0", ["p1", "p2"]);
    expect(matrixChoiceFor(c, { "p1|p2": { special: "99" } }).special).toBe("auto");
    expect(matrixChoiceFor(c, { "p1|p2": { special: "9" } }).special).toBe("9");
    expect(matrixChoiceFor(c, { "p1|p2": { special: "none" } }).special).toBe("none");
  });

  it("default de activación: toda sugerencia nace apagada, como en Impreso", () => {
    expect(matrixChoiceFor(candidate("a", ["p1", "p2"]), {}).enabled).toBe(false);
    expect(matrixChoiceFor(candidate("b", ["p9"]), {}).enabled).toBe(false);
    expect(matrixChoiceFor(candidate("b", ["p9"]), { p9: { enabled: true } }).enabled).toBe(true);
  });

  it("load/save toleran storage roto y no persisten sin clave", () => {
    const roto = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
    };
    expect(loadPdfDialogState("k", roto)).toEqual(DEFAULT_PDF_DIALOG_STATE);
    expect(() => savePdfDialogState("k", DEFAULT_PDF_DIALOG_STATE, [], roto)).not.toThrow();
    const mem = memStorage();
    savePdfDialogState(null, DEFAULT_PDF_DIALOG_STATE, [], mem);
    expect(mem.data.size).toBe(0);
    savePdfDialogState("k", { ...DEFAULT_PDF_DIALOG_STATE, columns: 1 }, [], mem);
    expect(loadPdfDialogState("k", mem).columns).toBe(1);
  });
});

describe("buildPaperExportOptions", () => {
  const c = candidate("matrix_0", ["p1", "p2"]);

  it("con defaults no envía las tres opciones nuevas ni consentimiento", () => {
    const opts = buildPaperExportOptions(DEFAULT_PDF_DIALOG_STATE, [c], []);
    expect(opts).toEqual({
      columns: 2,
      logic_language: "saltos",
      show_questionnaire_number: true,
      matrix_layout: "full",
      matrix_groups: [],
    });
    expect(opts).not.toHaveProperty("title");
  });

  it("sólo viajan matrices activadas con listas de 7 opciones o menos", () => {
    const larga: MatrixCandidate = {
      ...candidate("matrix_1", ["q1", "q2"]),
      scaleOptions: Array.from({ length: 8 }, (_, i) => ({ code: String(i + 1), label: `Opción ${i + 1}` })),
    };
    const matrices = { "p1|p2": { enabled: true }, "q1|q2": { enabled: true } };
    expect(buildMatrixGroupsFromChoices([c, larga], matrices)).toEqual([{ members: ["p1", "p2"] }]);
  });

  it("las envía sólo cuando difieren del default del motor", () => {
    const opts = buildPaperExportOptions(
      { ...DEFAULT_PDF_DIALOG_STATE, maxOptionsPerQuestion: 30, defaultIntro: false, showHeaderTitle: false },
      [],
      [],
    );
    expect(opts.max_options_per_question).toBe(30);
    expect(opts.no_default_intro).toBe(true);
    expect(opts.show_header_title).toBe(false);
  });

  it("consentimiento que ya no es candidato no viaja", () => {
    const state = { ...DEFAULT_PDF_DIALOG_STATE, consentVar: "acepta" };
    expect(buildPaperExportOptions(state, [], ["acepta"]).consent_var).toBe("acepta");
    expect(buildPaperExportOptions(state, [], ["otra"])).not.toHaveProperty("consent_var");
  });
});

describe("exportWarningDetail", () => {
  it("dice la primera advertencia real y cuántas más hay", () => {
    expect(exportWarningDetail([])).toBe("");
    expect(exportWarningDetail(undefined)).toBe("");
    expect(exportWarningDetail(["La pregunta `p5` tiene 30 opciones."])).toBe(
      " · La pregunta `p5` tiene 30 opciones.",
    );
    expect(exportWarningDetail(["uno", " ", "dos", "tres"])).toBe(" · uno (+2 más)");
  });
});
