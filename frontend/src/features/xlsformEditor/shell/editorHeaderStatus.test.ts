import { describe, expect, it } from "vitest";
import type { XlsformFormPublication } from "../../../api/xlsformEditor";
import type { BuilderDiagnostic } from "../types";
import { deriveEditorHeaderStatus } from "./editorHeaderStatus";
import { buildSuiteMetrics, countFieldsInOutline, formatFieldSectionPair } from "./editorMetrics";

function publication(blockers: XlsformFormPublication["blockers"]): XlsformFormPublication {
  return {
    status: blockers.length ? "blocked" : "draft",
    draft_content_sha256: "abc",
    latest_revision: null,
    blockers,
    warnings: [],
    bound_bases: [],
    can_publish: blockers.length === 0,
    can_delete: true,
  } as XlsformFormPublication;
}

const logicPending = {
  id: "logic_pending_manual_confirmation",
  title: "Lógica pendiente",
  detail: "Confirma la lógica",
} as XlsformFormPublication["blockers"][number];

describe("deriveEditorHeaderStatus (U10)", () => {
  it("no dice «Sin avisos» si la lógica está pendiente de confirmación", () => {
    const status = deriveEditorHeaderStatus([], publication([logicPending]));
    expect(status.label).toBe("Revisa la lógica");
    expect(status.tone).toBe("warn");
    expect(status.logicStepPending).toBe(true);
  });

  it("recién importado, sin publication cargada: la procedencia pendiente basta", () => {
    const source = { kind: "surveymonkey", original_name: "x", logic_status: "pending_manual_confirmation" };
    const status = deriveEditorHeaderStatus([], null, source);
    expect(status.label).toBe("Revisa la lógica");
    expect(status.tone).toBe("warn");
    // Con la publicación vigente y sin blocker, una lógica ya confirmada no avisa.
    expect(deriveEditorHeaderStatus([], publication([]), { ...source, logic_confirmed_at: "2026-10-14" }).label)
      .toBe("Sin avisos");
  });

  it("«Sin avisos» sólo sin diagnósticos ni pasos pendientes", () => {
    expect(deriveEditorHeaderStatus([], publication([])).label).toBe("Sin avisos");
    expect(deriveEditorHeaderStatus([], null).tone).toBe("ok");
  });

  it("un error local manda sobre el paso pendiente", () => {
    const diag = { id: "x", level: "error", title: "t", detail: "d" } as BuilderDiagnostic;
    const status = deriveEditorHeaderStatus([diag], publication([logicPending]));
    expect(status.tone).toBe("error");
    expect(status.label).toBe("1 error");
    expect(status.logicStepPending).toBe(true);
  });

  it("cuenta una corrección remota que no está entre los diagnósticos locales", () => {
    const remote = { id: "dup_names", title: "Nombres repetidos", detail: "d" } as XlsformFormPublication["blockers"][number];
    const status = deriveEditorHeaderStatus([], publication([remote]));
    expect(status.tone).toBe("error");
    expect(status.publicationErrors).toHaveLength(1);
  });
});

describe("editorMetrics (U8)", () => {
  it("cuenta secciones (grupos y repeticiones), nunca piezas", () => {
    const outline = [
      { kind: "section" }, { kind: "question" }, { kind: "note" }, { kind: "calculate" }, { kind: "repeat" },
    ];
    const metrics = buildSuiteMetrics({ outline } as never, 3, []);
    expect(metrics.sections).toBe(2);
    expect(formatFieldSectionPair(1, 1)).toBe("1 campo · 1 sección");
  });

  it("campos = variables que reciben respuesta: sin notas ni `_other` con madre (= import y campañas)", () => {
    const node = (kind: string, name: string, base = "text") => ({ kind, name, typeInfo: { base } });
    const outline = [
      node("section", "pag1", "begin_group"),
      node("note", "nota_pag1_1", "note"),
      node("question", "p1", "select_one"),
      node("question", "p3", "select_one"),
      node("question", "p3_other"),
      node("question", "p13_1", "select_one"),
      node("question", "p13_2", "select_one"),
      node("calculate", "c1", "calculate"),
    ];
    const metrics = buildSuiteMetrics({ outline } as never, 0, []);
    expect(countFieldsInOutline(outline as never)).toBe(5);
    expect(formatFieldSectionPair(5, metrics.sections)).toBe("5 campos · 1 sección");
  });

  it("preguntas (cabecera y Resumen): sin notas, cálculos ni metadatos, con el «Otro» que se pregunta", () => {
    const node = (kind: string, name: string, base = "text") => ({ kind, name, typeInfo: { base } });
    const outline = [
      node("question", "inicio", "start"),
      node("note", "n1", "note"),
      node("question", "p1", "select_one"),
      node("question", "p1_other"),
      node("calculate", "c1", "calculate"),
    ];
    expect(buildSuiteMetrics({ outline } as never, 0, []).fields).toBe(2);
  });
});

describe("conteos de la cabecera que el Resumen repite (E9)", () => {
  const d = (level: "error" | "warn" | "info", id: string) => ({ id, level, title: id, detail: "" });
  it("errores locales y avisos con el mismo número que el rótulo (lo informativo no cuenta como aviso)", () => {
    const status = deriveEditorHeaderStatus([d("error", "a"), d("error", "b"), d("warn", "c"), d("info", "e")] as never, null);
    expect(status.label).toBe("2 errores");
    expect(status.errorCount).toBe(2);
    expect(status.avisoCount).toBe(1);
  });
});

describe("deriveEditorHeaderStatus con la lógica hecha fuera", () => {
  const declarada = {
    kind: "surveymonkey",
    original_name: "x",
    logic_status: "external_declared",
    logic_confirmed_at: "2026-10-14",
    logic_external: { herramienta: "SPSS", nota: "", declarada_en: "2026-10-14" },
  };

  it("rótulo neutro con el programa, nunca «Revisa la lógica»", () => {
    const status = deriveEditorHeaderStatus([], publication([]), declarada);
    expect(status.tone).toBe("neutral");
    expect(status.label).toBe("Lógica: fuera de Prosecnur · SPSS");
    expect(status.logicStepPending).toBe(false);
    expect(status.logicaExterna?.herramienta).toBe("SPSS");
  });

  it("una publicación cargada antes de declarar no reabre el paso de lógica", () => {
    const status = deriveEditorHeaderStatus([], publication([logicPending]), declarada);
    expect(status.label).not.toBe("Revisa la lógica");
    expect(status.logicStepPending).toBe(false);
  });

  it("los avisos del workbook siguen teniendo precedencia", () => {
    const warn = { id: "w1", level: "warn", message: "x" } as unknown as BuilderDiagnostic;
    const status = deriveEditorHeaderStatus([warn], publication([]), declarada);
    expect(status.label).toBe("1 aviso");
    expect(status.logicaExterna).not.toBeNull();
  });
});
