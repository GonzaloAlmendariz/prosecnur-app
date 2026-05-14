import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  apiXlsformEditorExportPdf,
  apiXlsformEditorImport,
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
