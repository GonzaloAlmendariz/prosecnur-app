// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

const llamadas: Array<{ url: string; body: string }> = [];
vi.mock("./core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./core")>()),
  headers: (extra: Record<string, string> = {}) => ({ ...extra }),
  apiFetch: async (url: string, init: RequestInit) => {
    llamadas.push({ url, body: String(init.body) });
    return new Response(JSON.stringify({ ok: true, job_id: "j1", kind: "xlsform_editor.export_pdf" }), { status: 200 });
  },
}));

import { apiXlsformEditorExportPdf, apiXlsformEditorPreviaPdf } from "./xlsformEditor";

afterEach(() => { llamadas.length = 0; });

describe("vista previa del impreso (ADR 0133)", () => {
  const wb = { survey: [], choices: [], settings: [] } as unknown as Parameters<typeof apiXlsformEditorExportPdf>[0];

  it("la previa avisa previa: true para que el motor no copie el PDF a Entregables", async () => {
    await apiXlsformEditorPreviaPdf(wb, "x.pdf", {});
    expect(llamadas[0].url).toBe("/api/xlsform-editor/export-pdf");
    expect(JSON.parse(llamadas[0].body).previa).toBe(true);
  });

  it("la exportación no la marca como previa", async () => {
    await apiXlsformEditorExportPdf(wb, "x.pdf", {});
    expect(JSON.parse(llamadas[0].body).previa).toBeUndefined();
  });
});
