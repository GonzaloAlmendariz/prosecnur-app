import { describe, expect, it } from "vitest";
import type { XlsformFormPublication } from "../../../api/xlsformEditor";
import type { BuilderDiagnostic } from "../types";
import { deriveEditorHeaderStatus } from "./editorHeaderStatus";
import { buildSuiteMetrics, formatFieldSectionPair } from "./editorMetrics";

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
    expect(status.label).toBe("1 sin resolver");
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
    expect(metrics.fields).toBe(5);
    expect(formatFieldSectionPair(metrics.fields, metrics.sections)).toBe("5 campos · 1 sección");
  });
});
