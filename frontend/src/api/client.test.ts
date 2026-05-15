import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  apiMonitoreoConfig,
  apiMonitoreoDemo,
  apiMonitoreoSource,
  apiMonitoreoSync,
  apiXlsformEditorExportPdf,
  apiXlsformEditorImport,
  type MonitoreoConfig,
  type XlsformEditorWorkbook,
} from "./client";

const paperSheet = {
  name: "paper",
  columns: ["id", "kind", "position", "title", "body", "layout"],
  rows: [["consent", "consent", "1", "Consentimiento", "Texto para papel", "full"]],
};

const workbook: XlsformEditorWorkbook = {
  survey: {
    name: "survey",
    columns: ["type", "name", "label"],
    rows: [["text", "nombre", "Nombre"]],
  },
  choices: {
    name: "choices",
    columns: ["list_name", "name", "label", "paper_skip"],
    rows: [],
  },
  settings: {
    name: "settings",
    columns: ["form_title", "form_id"],
    rows: [["Encuesta demo", "demo"]],
  },
  paper: paperSheet,
};

function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("XLSForm editor PDF client", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("sends workbook paper sheet and export options to the PDF endpoint", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        file_id: "file-pdf",
        original_name: "demo_papel.pdf",
        size: 2048,
        summary: { n_blocks: 3, n_questions: 1, n_sections: 0, n_matrices: 0 },
        warnings: ["Revisar salto manual"],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiXlsformEditorExportPdf(workbook, "demo_papel.pdf", {
      title: "Encuesta demo",
      footer_title: "Pulso",
    });

    expect(result.file_id).toBe("file-pdf");
    expect(result.warnings).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/xlsform-editor/export-pdf",
      expect.objectContaining({ method: "POST" }),
    );

    const payload = JSON.parse(String(sentInit?.body));
    expect(payload.filename).toBe("demo_papel.pdf");
    expect(payload.options).toEqual({ title: "Encuesta demo", footer_title: "Pulso" });
    expect(payload.workbook.paper).toEqual(paperSheet);
  });

  test("preserves the optional paper sheet when normalizing imports", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        workbook,
        summary: {
          survey_rows: 1,
          choices_rows: 0,
          settings_rows: 1,
          paper_rows: 1,
          diagnostico_rows: 0,
        },
        source: { kind: "xlsform", original_name: "demo.xlsx" },
        warnings: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiXlsformEditorImport("uploaded-xlsx");

    expect(result.workbook.paper).toEqual(paperSheet);
    expect(result.summary.paper_rows).toBe(1);
  });
});

describe("Monitoreo client", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("saves a SurveyMonkey source without forcing a second token flow", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        source: { id: "sm_123", kind: "surveymonkey", label: "SM Demo", enabled: true, survey_id: "123" },
        validation: { ok: true },
        state: {
          ok: true,
          sources: [],
          config: {},
          has_snapshot: false,
          synced_at: "",
          n_rows: 0,
          variables: [],
          dashboard: null,
          errors: [],
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiMonitoreoSource({ kind: "surveymonkey", survey_id: "123", label: "SM Demo" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoreo/source",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({
      kind: "surveymonkey",
      survey_id: "123",
      label: "SM Demo",
    });
  });

  test("wraps config payloads consistently for save and sync", async () => {
    const bodies: unknown[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body ?? "{}")));
      if (String(input).endsWith("/sync")) return jsonResponse({ ok: true, job_id: "job-monitoreo" });
      return jsonResponse({
        ok: true,
        config: { enumerator_var: "enum" },
        state: {
          ok: true,
          sources: [],
          config: { enumerator_var: "enum" },
          has_snapshot: false,
          synced_at: "",
          n_rows: 0,
          variables: [],
          dashboard: null,
          errors: [],
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const config: Partial<MonitoreoConfig> = { enumerator_var: "enum", control_vars: ["zona"] };
    await apiMonitoreoConfig(config);
    await apiMonitoreoSync(config);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/monitoreo/config",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/monitoreo/sync",
      expect.objectContaining({ method: "POST" }),
    );
    expect(bodies).toEqual([{ config }, { config }]);
  });

  test("loads demo data through its own endpoint", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        state: {
          ok: true,
          sources: [],
          config: {},
          has_snapshot: true,
          synced_at: "2026-05-14T00:00:00Z",
          n_rows: 96,
          variables: [],
          dashboard: null,
          errors: [],
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiMonitoreoDemo({ seed: 7, n: 24 });

    expect(result.state.has_snapshot).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoreo/demo",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({ seed: 7, n: 24 });
  });
});
