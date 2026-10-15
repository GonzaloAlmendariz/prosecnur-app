import { describe, expect, it } from "vitest";
import { ApiError, type JobSnapshot } from "../../../api/client";
import { esperarExportPapel, faseDeExport, textoExportando } from "./paperExportJob";

function snap(status: JobSnapshot["status"], extra: Partial<JobSnapshot> = {}): JobSnapshot {
  return {
    id: "j1",
    kind: "xlsform_editor.formulario_pdf",
    status,
    started_at: "2026-10-15T00:00:00Z",
    finished_at: null,
    has_file_result: false,
    result_filename: null,
    result_data: {},
    error: {},
    ...extra,
  };
}

function deps(seq: JobSnapshot[]) {
  let i = 0;
  return {
    status: async () => seq[Math.min(i++, seq.length - 1)],
    cancel: async () => ({ ok: true }),
    setTimer: (fn: () => void) => setTimeout(fn, 0),
  };
}

const OK = {
  ok: true,
  file_id: "f-1",
  original_name: "demo_papel.pdf",
  size: 2048,
  summary: { n_blocks: 3, n_questions: 1, n_sections: 0, n_matrices: 0 },
  warnings: ["Revisar salto manual"],
};

describe("esperarExportPapel", () => {
  it("pasa las fases y resuelve con result_data", async () => {
    const fases: string[] = [];
    const result = await esperarExportPapel("j1", {
      onFase: (f) => fases.push(f),
      pollDeps: deps([
        snap("running", { progress: { phase: "modelo", message: "Armando el modelo" } }),
        snap("running", { progress: { phase: "dibujando", message: "Dibujando" } }),
        snap("done", { result_data: OK }),
      ]),
    });
    expect(fases).toEqual(["Armando el modelo", "Dibujando"]);
    expect(result.file_id).toBe("f-1");
    expect(result.warnings).toEqual(["Revisar salto manual"]);
  });

  it("un error de dominio en done se relanza como ApiError con su código", async () => {
    const p = esperarExportPapel("j1", {
      pollDeps: deps([
        snap("done", { result_data: { ok: false, error: { code: "E_FORM_PDF", status: 422, message: "Sin preguntas" } } }),
      ]),
    });
    await expect(p).rejects.toBeInstanceOf(ApiError);
    await expect(p).rejects.toMatchObject({ code: "E_FORM_PDF" });
  });

  it("status error (worker caído) rechaza con su mensaje", async () => {
    await expect(
      esperarExportPapel("j1", { pollDeps: deps([snap("error", { error: "callr: proceso terminado" })]) }),
    ).rejects.toThrow("callr: proceso terminado");
  });

  it("done sin archivo no se da por bueno", async () => {
    await expect(
      esperarExportPapel("j1", { pollDeps: deps([snap("done", { result_data: { ok: true } })]) }),
    ).rejects.toMatchObject({ code: "E_EXPORT_JOB_RESULT" });
  });
});

describe("texto de progreso", () => {
  it("usa el mensaje de la fase", () => {
    expect(faseDeExport({ phase: "dibujando", message: "Dibujando" })).toBe("Dibujando");
    expect(faseDeExport({})).toBe("");
    expect(faseDeExport(null)).toBe("");
    expect(textoExportando("Word", "Dibujando")).toBe("Exportando Word… Dibujando");
    expect(textoExportando("PDF", "")).toBe("Exportando PDF…");
  });
});
