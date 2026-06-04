import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  apiConnectionCheck,
  apiConnectionProfileSave,
  apiConnectionProfileSetDefault,
  apiConnectionTokenClear,
  apiConnectionTokenLoad,
  apiConnectionTokenSave,
  apiConnectionsList,
  apiMonitoreoConfig,
  apiMonitoreoDemo,
  apiMonitoreoSource,
  apiMonitoreoSync,
  apiEstudioActiveBaseSet,
  apiEstudioApplyIndependentTemplateLogic,
  apiEstudioPromoteIndependentSiblings,
  apiSurveyMonkeyMultibaseImportIndependent,
  apiSurveyMonkeyMultibaseInspectSurvey,
  apiSurveyMonkeyMultibaseListSurveys,
  apiGraficosPpt,
  apiGraficosPreviewSlide,
  apiAnaliticaConfigPut,
  apiAnaliticaPreparar,
  apiXlsformEditorExportPdf,
  apiXlsformEditorImport,
  apiXlsformEditorImportSurveyMonkeyWithLogic,
  apiXlsformEditorSmCheckToken,
  apiXlsformEditorSmFetchSurveyInfo,
  apiXlsformEditorSmInterpretRule,
  apiXlsformEditorSmListSurveys,
  apiXlsformEditorSmTokenLoad,
  apiXlsformEditorSmTokenSave,
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

describe("SurveyMonkey token client", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("loads token state without exposing a plaintext token", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        has_token: true,
        masked_token: "sm_1...abcdef",
        persisted: true,
        token: "plain-secret-should-be-ignored",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiXlsformEditorSmTokenLoad();

    expect(result).toMatchObject({
      ok: true,
      has_token: true,
      masked_token: "sm_1...abcdef",
      persisted: true,
      ephemeral: false,
    });
    expect(result as Record<string, unknown>).not.toHaveProperty("token");
  });

  test("only sends the token to the backend-owned token save endpoint", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body ?? "{}")));
      const url = String(input);
      if (url.endsWith("/sm-check-token")) return jsonResponse({ ok: true, status_code: 200, n_surveys_visible: 3 });
      if (url.endsWith("/sm-list-surveys")) {
        return jsonResponse({ ok: true, count: 0, total_visible: 0, total_recent: 0, months: 3, surveys: [] });
      }
      if (url.endsWith("/sm-fetch-survey-info")) {
        return jsonResponse({
          ok: true,
          paginas: {},
          pages: [],
          summary: { title: null, language: null, n_paginas: 0, n_preguntas: 0, n_required: 0, n_validation: 0 },
          style: { prefix: "p", pad: 0 },
        });
      }
      if (url.endsWith("/sm-interpret-rule")) {
        return jsonResponse({ ok: true, regla_parseada: {}, resolucion: {}, diagrama: {}, warnings: [] });
      }
      if (url.endsWith("/import-surveymonkey-with-logic")) {
        return jsonResponse({
          ok: true,
          workbook,
          summary: { survey_rows: 1, choices_rows: 0, settings_rows: 1, paper_rows: 1, diagnostico_rows: 0 },
          source: { kind: "surveymonkey", original_name: "SM" },
          warnings: [],
          hallazgos: [],
        });
      }
      return jsonResponse({ ok: true, has_token: true, masked_token: "sm_1...abcdef", persisted: false, ephemeral: true });
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiXlsformEditorSmTokenSave("plain-secret", { persist: false });
    await apiXlsformEditorSmCheckToken();
    await apiXlsformEditorSmListSurveys(20, 3);
    await apiXlsformEditorSmFetchSurveyInfo("file-1", "123456789");
    await apiXlsformEditorSmInterpretRule("P1 = C1 => Fin", { survey_id: "123456789" });
    await apiXlsformEditorImportSurveyMonkeyWithLogic(null, "", {}, {}, "es", { survey_id: "123456789" });

    expect(bodies[0]).toEqual({ token: "plain-secret", persist: false });
    for (const body of bodies.slice(1)) {
      expect(body).not.toHaveProperty("token");
    }
  });
});

describe("Connections client", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("loads shared connection states without exposing plaintext secrets", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        connections: [
          {
            ok: true,
            provider: "surveymonkey",
            label: "SurveyMonkey",
            has_token: true,
            masked_token: "sm_1...abcdef",
            persisted: true,
            ephemeral: false,
            token: "plain-secret-should-be-ignored",
          },
          {
            ok: true,
            provider: "kobo",
            label: "KoboToolbox",
            has_token: false,
            masked_token: "",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiConnectionsList();

    expect(result.connections[0]).toMatchObject({
      ok: true,
      provider: "surveymonkey",
      label: "SurveyMonkey",
      has_token: true,
      masked_token: "sm_1...abcdef",
      persisted: true,
      ephemeral: false,
    });
    expect(result.connections[1]).toMatchObject({
      ok: true,
      provider: "kobo",
      label: "KoboToolbox",
      has_token: false,
      masked_token: "",
      persisted: false,
      ephemeral: false,
    });
    expect(result.connections[0] as Record<string, unknown>).not.toHaveProperty("token");
  });

  test("sends plaintext only when saving a shared credential", async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body ?? "{}")) });
      return jsonResponse({
        ok: true,
        provider: "kobo",
        label: "KoboToolbox",
        has_token: true,
        masked_token: "kobo...secret",
        persisted: true,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiConnectionTokenSave("kobo", "plain-kobo-secret");
    await apiConnectionCheck("kobo");
    await apiConnectionTokenClear("kobo");
    await apiConnectionTokenLoad("kobo");

    expect(calls[0]).toEqual({
      url: "/api/connections/kobo/token",
      body: { token: "plain-kobo-secret", persist: true },
    });
    expect(calls.slice(1).every((call) => !("token" in call.body))).toBe(true);
  });

  test("supports manual SurveyMonkey primary and secondary profiles", async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body ?? "{}")) });
      const url = String(input);
      if (url.endsWith("/profiles/secundaria/default")) {
        return jsonResponse({
          ok: true,
          provider: "surveymonkey",
          label: "SurveyMonkey",
          has_token: true,
          masked_token: "sm_s...ndaria",
          persisted: true,
          active_profile_id: "secundaria",
          active_profile_alias: "Secundaria",
          profiles: [
            { id: "principal", alias: "Principal", is_default: false, has_token: true, masked_token: "sm_p...cipal" },
            { id: "secundaria", alias: "Secundaria", is_default: true, has_token: true, masked_token: "sm_s...ndaria" },
          ],
        });
      }
      return jsonResponse({
        ok: true,
        provider: "surveymonkey",
        label: "SurveyMonkey",
        has_token: true,
        masked_token: "sm_s...ndaria",
        persisted: true,
        active_profile_id: "principal",
        active_profile_alias: "Principal",
        profiles: [
          { id: "principal", alias: "Principal", is_default: true, has_token: true, masked_token: "sm_p...cipal" },
          { id: "secundaria", alias: "Secundaria", is_default: false, has_token: true, masked_token: "sm_s...ndaria" },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const saved = await apiConnectionProfileSave("surveymonkey", "plain-secondary", {
      alias: "Secundaria",
      profile_id: "secundaria",
      make_default: false,
    });
    const active = await apiConnectionProfileSetDefault("surveymonkey", "secundaria");

    expect(calls[0]).toEqual({
      url: "/api/connections/surveymonkey/profiles",
      body: {
        token: "plain-secondary",
        alias: "Secundaria",
        profile_id: "secundaria",
        make_default: false,
      },
    });
    expect(calls[1]).toEqual({
      url: "/api/connections/surveymonkey/profiles/secundaria/default",
      body: {},
    });
    expect(saved.active_profile_alias).toBe("Principal");
    expect(active.active_profile_alias).toBe("Secundaria");
    expect(active.profiles?.find((profile) => profile.id === "secundaria")?.is_default).toBe(true);
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

  test("sends source dimensions for multiform monitoring", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        source: {
          id: "sm_123",
          kind: "surveymonkey",
          label: "SM Demo",
          enabled: true,
          survey_id: "123",
          dimensions: { actor: "Estudiantes" },
        },
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

    await apiMonitoreoSource({
      kind: "surveymonkey",
      survey_id: "123",
      label: "SM Demo",
      dimensions: { actor: "Estudiantes" },
    });

    expect(JSON.parse(String(sentInit?.body))).toEqual({
      kind: "surveymonkey",
      survey_id: "123",
      label: "SM Demo",
      dimensions: { actor: "Estudiantes" },
    });
  });

  test("searches SurveyMonkey surveys for source families", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        from_cache: true,
        cache_status: "hit",
        catalog_fetched_at: "2026-06-02T03:00:00Z",
        catalog_age_seconds: 120,
        catalog_count: 10,
        total_visible: 10,
        total_recent: 4,
        months: 36,
        count: 1,
        surveys: [{
          id: "527327742",
          title: "Acreditacion Contabilidad PUCP Estudiantes",
          nickname: "",
          date_modified: "2026-05-29T00:56:00",
          pais_guess: "",
          response_count: 203,
        }],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiSurveyMonkeyMultibaseListSurveys("contabilidad", 50, 36);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/surveymonkey/multibase/surveys",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({ q: "contabilidad", limit: 50, months: 36 });
    expect(result.surveys[0].id).toBe("527327742");
    expect(result.surveys[0].response_count).toBe(203);
    expect(result.from_cache).toBe(true);
    expect(result.catalog_count).toBe(10);
  });

  test("can force refresh the SurveyMonkey survey catalog", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        from_cache: false,
        cache_status: "refreshed",
        catalog_fetched_at: "2026-06-02T03:05:00Z",
        catalog_age_seconds: 0,
        catalog_count: 0,
        total_visible: 0,
        total_recent: 0,
        months: 6,
        count: 0,
        surveys: [],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiSurveyMonkeyMultibaseListSurveys("", 500, 6, { forceRefresh: true });

    expect(JSON.parse(String(sentInit?.body))).toEqual({
      q: "",
      limit: 500,
      months: 6,
      force_refresh: true,
    });
    expect(result.cache_status).toBe("refreshed");
  });

  test("sets the shared active base selector", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        active: "ingenieria_civil",
        options: ["ingenieria_civil", "ingenieria_industrial"],
        processing_mode: "independent_siblings",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiEstudioActiveBaseSet("ingenieria_civil");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/estudio/active-base",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({ base_nombre: "ingenieria_civil" });
    expect(result.active).toBe("ingenieria_civil");
    expect(result.processing_mode).toBe("independent_siblings");
  });

  test("promotes an existing project to independent sibling mode", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        nombre: "AC_ING_CIVIL",
        processing_mode: "independent_siblings",
        active_base: "ingenieria_civil",
        n_bases: 1,
        bases: {
          ingenieria_civil: {
            nombre: "ingenieria_civil",
            xlsform_file_id: "xls",
            data_file_id: "data",
            data_ext: "xlsx",
            n_filas: 168,
            n_columnas: 74,
            added_at: "2026-05-27T00:00:00Z",
            processing_mode: "independent_siblings",
            source_kind: "existing_project",
            source_title: "Ingeniería Civil",
          },
        },
        max_bases: 16,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiEstudioPromoteIndependentSiblings({
      active_base: "default",
      nombre_nuevo: "ingenieria_civil",
      source_title: "Ingeniería Civil",
      source_kind: "existing_project",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/estudio/independent-siblings/promote",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({
      active_base: "default",
      nombre_nuevo: "ingenieria_civil",
      source_title: "Ingeniería Civil",
      source_kind: "existing_project",
    });
    expect(result.processing_mode).toBe("independent_siblings");
    expect(result.active_base).toBe("ingenieria_civil");
  });

  test("applies template XLSForm logic to independent sibling bases", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        template_base: "ingenieria_civil",
        targets: ["ingenieria_industrial"],
        updated_bases: ["ingenieria_industrial"],
        n_targets: 1,
        n_updated_bases: 1,
        results: [{
          base: "ingenieria_industrial",
          applied_variables: ["p2"],
          skipped_missing_variables: [],
          missing_references: [],
          n_applied_variables: 1,
          n_skipped_missing_variables: 0,
          n_missing_references: 0,
          changed_cells: 2,
          logic_columns: ["relevant", "constraint"],
        }],
        estudio: {
          nombre: "AC Ingenierías",
          processing_mode: "independent_siblings",
          active_base: "ingenieria_civil",
          n_bases: 2,
          bases: {},
          max_bases: 10,
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiEstudioApplyIndependentTemplateLogic({
      template_base: "ingenieria_civil",
      targets: ["ingenieria_industrial"],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/estudio/independent-siblings/apply-template-logic",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({
      template_base: "ingenieria_civil",
      targets: ["ingenieria_industrial"],
    });
    expect(result.n_updated_bases).toBe(1);
    expect(result.results?.[0]?.changed_cells).toBe(2);
  });

  test("imports SurveyMonkey surveys as independent sibling bases", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        processing_mode: "independent_siblings",
        active_base: "ingenieria_civil",
        bases: [],
        n_bases: 2,
        estudio: {
          nombre: null,
          processing_mode: "independent_siblings",
          active_base: "ingenieria_civil",
          n_bases: 2,
          bases: {},
          max_bases: 16,
        },
        audit: { ok: false, surveys: [], ref_survey_id: "1", n_blocking: 1, n_review: 0, n_special: 0, company_positions: [], company_variables: [], diffs: [] },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiSurveyMonkeyMultibaseImportIndependent({
      surveys: [{
        survey_id: "1",
        label: "Ingeniería Geológica",
        date_modified_lte: "2026-05-30T01:27:45+00:00",
        sources: [
          { survey_id: "1", collector_ids: ["campo"] },
          { survey_id: "2", label: "Ingeniería Geológica campaña 2", response_statuses: ["completed", "partial"] },
        ],
      }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/surveymonkey/multibase/import-independent",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({
      surveys: [{
        survey_id: "1",
        label: "Ingeniería Geológica",
        date_modified_lte: "2026-05-30T01:27:45+00:00",
        sources: [
          { survey_id: "1", collector_ids: ["campo"] },
          { survey_id: "2", label: "Ingeniería Geológica campaña 2", response_statuses: ["completed", "partial"] },
        ],
      }],
    });
    expect(result.estudio.processing_mode).toBe("independent_siblings");
  });

  test("inspects SurveyMonkey survey structure and response preview", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        survey_id: "527327742",
        title: "Acreditacion Contabilidad PUCP Estudiantes",
        language: "es",
        n_pages: 2,
        n_questions: 12,
        n_required: 4,
        n_validation: 1,
        pages: [{ page_id: "1", title: "Datos generales", range_label: "Q1-Q4", question_count: 4 }],
        questions: [{ pos: 1, page: 1, qid: "111", family: "single_choice", subtype: "vertical", heading: "Cargo", n_choices: 4, n_rows: 0, n_cols: 0 }],
        responses: { available: true, total: 96, returned: 1, error: "" },
        columns: [{ name: "response_id", non_empty: 1, examples: ["abc"] }],
        sample_rows: [{ response_id: "abc", p1: "Sí" }],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiSurveyMonkeyMultibaseInspectSurvey("527327742", 5);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/surveymonkey/multibase/inspect",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({
      survey_id: "527327742",
      response_limit: 5,
      base_url: "https://api.surveymonkey.com/v3",
    });
    expect(result.title).toContain("Contabilidad");
    expect(result.responses.total).toBe(96);
    expect(result.columns[0].name).toBe("response_id");
    expect(result.sample_rows[0].p1).toBe("Sí");
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

describe("Analitica client", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("source changes are saved before preparing the selected data source", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ ok: true, saved_at: "2026-05-31T00:00:00Z", fuente: "ok", n_filas: 4, n_columnas: 5 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiAnaliticaConfigPut({ fuente_preferida: "adaptados" });
    await apiAnaliticaPreparar();
    await apiAnaliticaConfigPut({ fuente_preferida: "originales" });
    await apiAnaliticaPreparar();

    const calls = fetchMock.mock.calls.map(([input, init]) => ({
      input: String(input),
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    }));

    expect(calls.map((c) => [c.method, c.input])).toEqual([
      ["POST", "/api/analitica/config"],
      ["POST", "/api/analitica/preparar"],
      ["POST", "/api/analitica/config"],
      ["POST", "/api/analitica/preparar"],
    ]);
    expect(calls[0].body).toEqual({ config: { fuente_preferida: "adaptados" } });
    expect(calls[2].body).toEqual({ config: { fuente_preferida: "originales" } });
  });
});

describe("Graficos preview/export client", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("sends current visual config to slide preview and PPT export", async () => {
    const bodies: unknown[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body ?? "{}")));
      if (String(input).endsWith("/preview-slide")) {
        return jsonResponse({
          ok: true,
          file_id: "preview-pptx",
          size: 1024,
          type: "pptx",
          images: [],
          slide_preview: null,
        });
      }
      return jsonResponse({ ok: true, job_id: "job-ppt", kind: "graficos.ppt" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const slide = { id: "s1", tipo: "p_slide_texto", payload: { titulo: "Demo" } };
    const config = {
      presets: { base: { color_titulo: "#123456" } },
      debug_ph: { activo: true, color: "#00FFAA", lwd: 2 },
      iconos: [],
    };

    await apiGraficosPreviewSlide(slide as never, config);
    await apiGraficosPpt({ slides: [slide] } as never, config.presets, {}, config);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/graficos/preview-slide",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/graficos/ppt",
      expect.objectContaining({ method: "POST" }),
    );
    expect(bodies).toEqual([
      { slide, config },
      { plan: { slides: [slide] }, presets: config.presets, w_presets: {}, config },
    ]);
  });

  test("preview slide sends optional quality/image flags when provided", async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body ?? "{}")));
      return jsonResponse({
        ok: true,
        file_id: "preview-pptx",
        size: 1024,
        type: "pptx",
        images: [],
        slide_preview: null,
      });
    }));

    const slide = { id: "s2", tipo: "p_slide_texto", payload: { titulo: "Demo" } };
    const config = { presets: {}, debug_ph: {}, iconos: [] };

    await apiGraficosPreviewSlide(slide as never, config, {
      preview_quality: "normal",
      include_images: true,
    });

    expect(bodies).toEqual([
      {
        slide,
        config,
        preview_quality: "normal",
        include_images: true,
      },
    ]);
  });
});
