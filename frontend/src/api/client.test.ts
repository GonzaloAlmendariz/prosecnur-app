import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  apiConnectionCheck,
  apiConnectionGoogleSheetsConnect,
  apiConnectionProfileSave,
  apiConnectionProfileSetDefault,
  apiConnectionTokenClear,
  apiConnectionTokenLoad,
  apiConnectionTokenSave,
  apiConnectionsList,
  apiPublicArtifact,
  apiMonitoreoClientReportPdf,
  apiMonitoreoClientReportSheetsPublish,
  apiMonitoreoConfig,
  apiMonitoreoDemo,
  apiMonitoreoKoboAssets,
  apiMonitoreoPublicationSheetsPublish,
  apiMonitoreoPublicReport,
  apiMonitoreoState,
  apiMonitoreoSource,
  apiMonitoreoSheetsPublish,
  apiMonitoreoSheetsSource,
  apiMonitoreoSync,
  apiMonitoreoTerritorialMap,
  apiMonitoreoTerritorialMapPrepare,
  apiMonitoreoTerritorialPhase,
  apiMonitoreoTerritorialReconciliationBatch,
  apiMonitoreoTerritorialSource,
  apiMonitoreoTerritorialUmpReconciliation,
  apiEstudioActiveBaseSet,
  apiEstudioApplyIndependentTemplateLogic,
  apiEstudioPromoteIndependentSiblings,
  apiSurveyMonkeyMultibaseApplyCanonicalXlsformLogic,
  apiSurveyMonkeyMultibaseImportIndependent,
  apiSurveyMonkeyMultibaseInspectSurvey,
  apiSurveyMonkeyMultibaseListSurveys,
  apiSurveyMonkeyMultibaseRefresh,
  apiSurveyMonkeyMultibaseRefreshPlan,
  apiSurveyMonkeyMultibaseSavBundleImport,
  apiSurveyMonkeyMultibaseSavBundleInspect,
  apiSurveyMonkeyMultibaseWorkbookImport,
  apiSurveyMonkeyMultibaseWorkbookInspect,
  apiV2InstrumentoVariablesExcluidas,
  apiV2InstrumentoVariablesExcluidasSave,
  apiGraficosPpt,
  apiGraficosPreviewSlide,
  apiGraficosShareExport,
  apiGraficosShareImport,
  apiGraficosShareInspect,
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

describe("Graficos share package client", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("exports and inspects a portable graphics plan package", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(init?.body ? JSON.parse(String(init.body)) : {});
      const url = String(input);
      if (url.endsWith("/share/export")) {
        return jsonResponse({
          ok: true,
          file_id: "pkg-1",
          filename: "plan.pulso-graficos.zip",
          size: 1234,
          exported_at: "2026-06-19T00:00:00Z",
        });
      }
      return jsonResponse({
        ok: true,
        package_file_id: "pkg-1",
        filename: "plan.pulso-graficos.zip",
        manifest: {
          version: "graficos-share/1",
          source_project_name: "Ingenieria",
          created_at: "2026-06-19T00:00:00Z",
          n_slides: 4,
          n_assets: 0,
        },
        summary: { n_bases: 2, n_compatible: 2, n_blocking: 0, n_warnings: 1 },
        default_selected_bases: ["civil", "minas"],
        bases: [
          {
            base_name: "minas",
            selected_default: true,
            blocking: false,
            current: { n_slides: 0 },
            incoming: { n_slides_total: 4, n_slides_applicable: 3, n_slides_skipped: 1 },
            impact: {
              variables_expected: 10,
              variables_available: 9,
              variables_missing: 1,
              missing_variables: [{ code: "p2", label: "Pregunta dos" }],
              skipped_slides: [
                {
                  slide_id: "s2",
                  slide_title: "Slide P2",
                  tipo: "p_slide_1_grafico",
                  missing_variables: [{ code: "p2", label: "Pregunta dos" }],
                },
              ],
              effects: ["Se conserva XLSForm"],
            },
            warnings: ["1 slide se omitira por variables no disponibles."],
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const exported = await apiGraficosShareExport();
    const inspected = await apiGraficosShareInspect({ file_id: exported.file_id });

    expect(exported.file_id).toBe("pkg-1");
    expect(inspected.summary.n_compatible).toBe(2);
    expect(inspected.bases[0].impact.missing_variables[0]).toEqual({ code: "p2", label: "Pregunta dos" });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/graficos/share/export",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/graficos/share/inspect",
      expect.objectContaining({ method: "POST" }),
    );
    expect(bodies[1]).toEqual({ file_id: "pkg-1" });
  });

  test("imports selected bases from a inspected graphics package", async () => {
    let sentBody: Record<string, unknown> | null = null;
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentBody = JSON.parse(String(init?.body ?? "{}"));
      return jsonResponse({
        ok: true,
        imported_at: "2026-06-19T00:00:00Z",
        applied_bases: [{ base_name: "civil", n_slides_applicable: 4, n_slides_skipped: 0 }],
        inspection: {
          ok: true,
          package_file_id: "pkg-1",
          filename: "plan.pulso-graficos.zip",
          manifest: { version: "graficos-share/1", source_project_name: "Ingenieria", created_at: "", n_slides: 4, n_assets: 0 },
          summary: { n_bases: 1, n_compatible: 1, n_blocking: 0, n_warnings: 0 },
          default_selected_bases: ["civil"],
          bases: [],
        },
      });
    }));

    const imported = await apiGraficosShareImport("pkg-1", ["civil"]);

    expect(imported.applied_bases[0].base_name).toBe("civil");
    expect(sentBody).toEqual({ package_file_id: "pkg-1", selected_bases: ["civil"] });
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
            has_token: true,
            masked_token: "kobo...secret",
            active_profile_id: "kobo_unhcr",
            active_profile_alias: "Kobo UNHCR",
            active_profile_base_url: "https://kobo.unhcr.org",
            active_profile_server_label: "UNHCR",
            profiles: [
              {
                id: "kobo_unhcr",
                alias: "Kobo UNHCR",
                is_default: true,
                has_token: true,
                masked_token: "kobo...secret",
                base_url: "https://kobo.unhcr.org",
                server_label: "UNHCR",
              },
            ],
          },
          {
            ok: true,
            provider: "google_sheets",
            label: "Google Sheets",
            has_token: true,
            masked_token: "ya29...token",
            persisted: true,
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
      has_token: true,
      masked_token: "kobo...secret",
      persisted: false,
      ephemeral: false,
      active_profile_id: "kobo_unhcr",
      active_profile_base_url: "https://kobo.unhcr.org",
    });
    expect(result.connections[1].profiles?.[0]).toMatchObject({
      id: "kobo_unhcr",
      base_url: "https://kobo.unhcr.org",
      server_label: "UNHCR",
    });
    expect(result.connections[2]).toMatchObject({
      ok: true,
      provider: "google_sheets",
      label: "Google Sheets",
      has_token: true,
      masked_token: "ya29...token",
      persisted: true,
      ephemeral: false,
    });
    expect(result.connections[0] as Record<string, unknown>).not.toHaveProperty("token");
  });

  test("starts Google Sheets OAuth through global connections", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        provider: "google_sheets",
        authorization_required: true,
        auth_url: "https://accounts.google.com/o/oauth2/auth",
        redirect_uri: "http://127.0.0.1:8787/api/connections/google_sheets/oauth/callback",
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        status: {
          ok: true,
          provider: "google_sheets",
          label: "Google Sheets",
          has_token: false,
          masked_token: "",
          persisted: false,
          ephemeral: false,
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiConnectionGoogleSheetsConnect(
      { installed: { client_id: "client", client_secret: "secret" } },
      "http://127.0.0.1:8787/api/connections/google_sheets/oauth/callback",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/connections/google_sheets/oauth",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({
      oauth: { installed: { client_id: "client", client_secret: "secret" } },
      redirect_uri: "http://127.0.0.1:8787/api/connections/google_sheets/oauth/callback",
    });
    expect(result).toMatchObject({ provider: "google_sheets", authorization_required: true });
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
    await apiConnectionCheck("kobo", { profile_id: "kobo_unhcr", base_url: "https://kobo.unhcr.org" });
    await apiConnectionTokenClear("kobo");
    await apiConnectionTokenLoad("kobo");

    expect(calls[0]).toEqual({
      url: "/api/connections/kobo/token",
      body: { token: "plain-kobo-secret", persist: true },
    });
    expect(calls[1]).toEqual({
      url: "/api/connections/kobo/check",
      body: { profile_id: "kobo_unhcr", base_url: "https://kobo.unhcr.org" },
    });
    expect(calls.slice(1).every((call) => !("token" in call.body))).toBe(true);
  });

  test("supports Kobo profiles with server metadata", async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body ?? "{}")) });
      return jsonResponse({
        ok: true,
        provider: "kobo",
        label: "KoboToolbox",
        has_token: true,
        masked_token: "kobo...123456",
        persisted: true,
        active_profile_id: "kobo_unhcr",
        active_profile_alias: "Kobo UNHCR",
        active_profile_base_url: "https://kobo.unhcr.org",
        active_profile_server_label: "UNHCR",
        profiles: [
          {
            id: "kobo_unhcr",
            alias: "Kobo UNHCR",
            is_default: true,
            has_token: true,
            masked_token: "kobo...123456",
            base_url: "https://kobo.unhcr.org",
            server_label: "UNHCR",
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const saved = await apiConnectionProfileSave("kobo", "plain-kobo-secret", {
      alias: "Kobo UNHCR",
      profile_id: "kobo_unhcr",
      base_url: "https://kobo.unhcr.org",
      make_default: true,
    });

    expect(calls[0]).toEqual({
      url: "/api/connections/kobo/profiles",
      body: {
        token: "plain-kobo-secret",
        alias: "Kobo UNHCR",
        profile_id: "kobo_unhcr",
        make_default: true,
        base_url: "https://kobo.unhcr.org",
      },
    });
    expect(saved.active_profile_base_url).toBe("https://kobo.unhcr.org");
    expect(saved.profiles?.[0]).toMatchObject({ server_label: "UNHCR" });
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

  test("can request lightweight and full monitoring state", async () => {
    const urls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return jsonResponse({
        ok: true,
        sources: [],
        config: {},
        has_snapshot: false,
        synced_at: "",
        n_rows: 0,
        variables: [],
        dashboard: null,
        errors: [],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiMonitoreoState();
    await apiMonitoreoState({ includeReports: false });
    await apiMonitoreoState({ includeReports: true });
    await apiMonitoreoState({ includeReports: true, reportScope: "route_summary" });
    await apiMonitoreoState({ includeReports: true, reportScope: "validation_summary" });
    await apiMonitoreoState({ includeReports: true, reportScope: "queries_summary" });

    expect(urls).toEqual([
      "/api/monitoreo/state",
      "/api/monitoreo/state?include_reports=0",
      "/api/monitoreo/state?include_reports=1",
      "/api/monitoreo/state?include_reports=1&report_scope=route_summary",
      "/api/monitoreo/state?include_reports=1&report_scope=validation_summary",
      "/api/monitoreo/state?include_reports=1&report_scope=queries_summary",
    ]);
  });

  test("loads public artifact descriptor", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        kind: "monitoreo",
        title: "ACNUR avance",
        module: "monitoreo",
        public_scope: "aggregate",
        profile_family: "territorial",
        report_scope: "advance_summary",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiPublicArtifact();

    expect(fetchMock).toHaveBeenCalledWith("/api/public/artifact", expect.objectContaining({ headers: expect.any(Object) }));
    expect(result.kind).toBe("monitoreo");
    expect(result.profile_family).toBe("territorial");
  });

  test("loads public monitoreo report", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        generated_at: "2026-06-16T00:00:00Z",
        synced_at: "2026-06-16T00:00:00Z",
        profile: { family: "acreditacion" },
        accreditation: { actors: [], daily_general: [], daily_actor: [], sources: [], summary: [], has_targets: false },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiMonitoreoPublicReport();

    expect(fetchMock).toHaveBeenCalledWith("/api/monitoreo/public-report", expect.objectContaining({ headers: expect.any(Object) }));
    expect(result.profile.family).toBe("acreditacion");
  });

  test("publishes executive publication tabs to Sheets by audience", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        audience: "internal",
        spreadsheet_id: "sheet_exec",
        controlled_tabs: ["Portada", "Base técnica"],
        updated_at: "2026-06-18T12:00:00Z",
        mode: "controlled_write",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiMonitoreoPublicationSheetsPublish("sheet_exec", {
      audience: "internal",
      includeTargets: true,
      confirmedFullData: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoreo/publication/sheets",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({
      spreadsheet_id: "sheet_exec",
      audience: "internal",
      include_targets: true,
      confirmed_full_data: true,
    });
    expect(result.controlled_tabs).toContain("Base técnica");
  });

  test("lists Kobo assets with selected connection profile", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        count: 1,
        assets: [
          {
            uid: "asset_unhcr",
            name: "UNHCR demo",
            date_modified: "2026-06-04T20:10:21Z",
            deployment_active: true,
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiMonitoreoKoboAssets("https://kobo.unhcr.org", 50, { profile_id: "kobo_unhcr" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoreo/kobo/assets",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({
      base_url: "https://kobo.unhcr.org",
      limit: 50,
      profile_id: "kobo_unhcr",
    });
    expect(result.assets[0]).toMatchObject({ uid: "asset_unhcr", deployment_active: true });
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

  test("registers a Google Sheets source with role, mode and binding", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        source: {
          id: "google_sheets_sheet_123_barrido",
          kind: "google_sheets",
          label: "Barrido",
          enabled: true,
          role: "barrido",
          integration_mode: "connected_read",
          sheet_binding: {
            spreadsheet_id: "sheet_123",
            sheet_name: "Barrido",
            header_row: 1,
            range: "",
            last_read_at: "",
            snapshot_hash: "",
          },
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

    await apiMonitoreoSheetsSource({
      kind: "google_sheets",
      label: "Barrido",
      role: "barrido",
      integration_mode: "connected_read",
      sheet_binding: {
        spreadsheet_id: "sheet_123",
        sheet_name: "Barrido",
        header_row: 1,
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoreo/sheets/source",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({
      kind: "google_sheets",
      label: "Barrido",
      role: "barrido",
      integration_mode: "connected_read",
      sheet_binding: {
        spreadsheet_id: "sheet_123",
        sheet_name: "Barrido",
        header_row: 1,
      },
    });
  });

  test("registers territorial route sheet source with operational defaults", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        source: {
          id: "google_sheets_route_sheet",
          kind: "google_sheets",
          label: "Hoja de ruta operativa",
          enabled: true,
          role: "hoja_ruta",
          integration_mode: "connected_read",
          sheet_binding: {
            spreadsheet_id: "sheet_route",
            sheet_name: "Hojas_de_ruta",
            header_row: 6,
            range: "",
          },
          dimensions: { territorial_phase: "field" },
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

    await apiMonitoreoSheetsSource({
      kind: "google_sheets",
      label: "Hoja de ruta operativa",
      role: "hoja_ruta",
      integration_mode: "connected_read",
      sheet_binding: {
        spreadsheet_id: "sheet_route",
        sheet_name: "Hojas_de_ruta",
        header_row: 6,
        range: "",
      },
      dimensions: { territorial_phase: "field" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoreo/sheets/source",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({
      kind: "google_sheets",
      label: "Hoja de ruta operativa",
      role: "hoja_ruta",
      integration_mode: "connected_read",
      sheet_binding: {
        spreadsheet_id: "sheet_route",
        sheet_name: "Hojas_de_ruta",
        header_row: 6,
        range: "",
      },
      dimensions: { territorial_phase: "field" },
    });
  });

  test("publishes controlled Prosecnur tabs to Sheets", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        spreadsheet_id: "sheet_out",
        controlled_tabs: ["Prosecnur - Resumen", "Prosecnur - Alertas"],
        updated_at: "2026-06-06T12:00:00Z",
        mode: "controlled_write",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiMonitoreoSheetsPublish("sheet_out", { objetivo_total: 10 } as Partial<MonitoreoConfig>);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoreo/sheets/publish",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({
      spreadsheet_id: "sheet_out",
      config: { objetivo_total: 10 },
    });
  });

  test("publishes client report tabs to Sheets with optional targets", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        spreadsheet_id: "sheet_client",
        controlled_tabs: ["Reporte", "Avance por actor"],
        updated_at: "2026-06-08T12:00:00Z",
        mode: "controlled_write",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiMonitoreoClientReportSheetsPublish("sheet_client", {
      includeTargets: true,
      config: { objetivo_total: 10 } as Partial<MonitoreoConfig>,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoreo/client-report/sheets/publish",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({
      spreadsheet_id: "sheet_client",
      include_targets: true,
      config: { objetivo_total: 10 },
    });
  });

  test("starts client report PDF job", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        job_id: "job-client-report",
        kind: "monitoreo.client_report_pdf",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiMonitoreoClientReportPdf({ includeTargets: false });

    expect(result.job_id).toBe("job-client-report");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoreo/client-report/pdf",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({
      include_targets: false,
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
          { survey_id: "2", label: "Ingeniería Geológica campaña 2", response_statuses: ["completed", "partial"], channel: "WhatsApp", source_channel: "WhatsApp" },
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
          { survey_id: "2", label: "Ingeniería Geológica campaña 2", response_statuses: ["completed", "partial"], channel: "WhatsApp", source_channel: "WhatsApp" },
        ],
      }],
    });
    expect(result.estudio.processing_mode).toBe("independent_siblings");
  });

  test("imports independent siblings with a canonical XLSForm logic template", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        processing_mode: "independent_siblings",
        active_base: "ingenieria_civil",
        bases: [],
        n_bases: 1,
        estudio: {
          nombre: null,
          processing_mode: "independent_siblings",
          active_base: "ingenieria_civil",
          n_bases: 1,
          bases: {},
          max_bases: 10,
        },
        audit: { ok: true, surveys: [], ref_survey_id: "1", n_blocking: 0, n_review: 0, n_special: 0, company_positions: [], company_variables: [], diffs: [] },
        xlsform_logic_sync: {
          ok: true,
          template_base: "XLSForm cargado en Carga/Editor",
          targets: ["ingenieria_civil"],
          updated_bases: ["ingenieria_civil"],
          n_targets: 1,
          n_updated_bases: 1,
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiSurveyMonkeyMultibaseImportIndependent({
      surveys: [{ survey_id: "1", label: "Ingeniería Civil" }],
      canonical_xlsform_file_id: "xls-template",
      use_canonical_xlsform_logic: true,
    });

    expect(JSON.parse(String(sentInit?.body))).toEqual({
      surveys: [{ survey_id: "1", label: "Ingeniería Civil" }],
      canonical_xlsform_file_id: "xls-template",
      use_canonical_xlsform_logic: true,
    });
  });

  test("applies canonical XLSForm logic to existing independent siblings", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        template_base: "XLSForm cargado en Carga/Editor",
        targets: ["ingenieria_civil", "ingenieria_industrial"],
        updated_bases: ["ingenieria_civil"],
        n_targets: 2,
        n_updated_bases: 1,
        results: [],
        estudio: {
          nombre: "Ingenieria",
          processing_mode: "independent_siblings",
          active_base: "ingenieria_civil",
          n_bases: 2,
          bases: {},
          max_bases: 10,
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiSurveyMonkeyMultibaseApplyCanonicalXlsformLogic({
      canonical_xlsform_file_id: "xls-template",
      targets: ["ingenieria_civil", "ingenieria_industrial"],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/surveymonkey/multibase/apply-canonical-xlsform-logic",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({
      canonical_xlsform_file_id: "xls-template",
      targets: ["ingenieria_civil", "ingenieria_industrial"],
    });
    expect(result.n_updated_bases).toBe(1);
  });

  test("inspects and imports offline SurveyMonkey workbooks", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/workbook/inspect")) {
        expect(JSON.parse(String(init?.body))).toEqual({
          file_id: "file-xlsx",
          missing_required_policy: "fill_blank_warn",
        });
        return jsonResponse({
          ok: true,
          file_id: "file-xlsx",
          filename: "Base Cliente.xlsx",
          n_sheets: 1,
          n_matched: 1,
          n_blocking: 0,
          blocking_sheets: [],
          sheets: [{
            sheet_name: "Industrial",
            base_name: "ingenieria_industrial",
            matched: true,
            blocking: false,
            n_rows: 206,
            n_columns: 94,
            n_output_columns: 78,
            recognized_headers: 90,
            unknown_headers: ["Columna rara"],
            ambiguous_headers: [],
            missing_variables: ["p3", "p4", "p5"],
            blank_filled_variables: ["p3", "p4", "p5"],
            cell_errors: [{
              source: "Evalúe la utilidad | Claridad",
              kind: "question",
              variable: "p13_1",
              n_errors: 173,
              rows: [2, 3, 4],
            }],
            n_cell_errors: 173,
            warnings: ["La hoja Industrial no trae 3 variables esperadas; se completaron vacías."],
          }],
          warnings: ["La hoja Industrial no trae 3 variables esperadas; se completaron vacías."],
        });
      }
      expect(url).toMatch(/\/workbook\/import$/);
      return jsonResponse({
        ok: true,
        file_id: "file-xlsx",
        filename: "Base Cliente.xlsx",
        imported_bases: 1,
        results: [{
          base_name: "ingenieria_industrial",
          sheet_name: "Industrial",
          data_file_id: "data-new",
          snapshot_file_id: "snap-new",
          n_rows: 206,
          n_columns: 78,
          warnings: [],
        }],
        inspection: {
          ok: true,
          file_id: "file-xlsx",
          filename: "Base Cliente.xlsx",
          n_sheets: 1,
          n_matched: 1,
          n_blocking: 0,
          blocking_sheets: [],
          sheets: [],
          warnings: [],
        },
        estudio: {
          nombre: "AC Ingenierías",
          processing_mode: "independent_siblings",
          active_base: "ingenieria_industrial",
          n_bases: 1,
          bases: {},
          max_bases: 10,
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const inspection = await apiSurveyMonkeyMultibaseWorkbookInspect({
      file_id: "file-xlsx",
      missing_required_policy: "fill_blank_warn",
    });
    expect(inspection.ok).toBe(true);
    expect(inspection.sheets[0].missing_variables).toEqual(["p3", "p4", "p5"]);
    expect(inspection.sheets[0].unknown_headers).toEqual(["Columna rara"]);
    expect(inspection.sheets[0].n_cell_errors).toBe(173);
    expect(inspection.sheets[0].cell_errors?.[0]).toMatchObject({
      source: "Evalúe la utilidad | Claridad",
      variable: "p13_1",
      n_errors: 173,
      rows: [2, 3, 4],
    });

    const imported = await apiSurveyMonkeyMultibaseWorkbookImport({
      file_id: "file-xlsx",
      missing_required_policy: "fill_blank_warn",
    });
    expect(imported.imported_bases).toBe(1);
    expect(imported.results[0].snapshot_file_id).toBe("snap-new");
    expect(imported.estudio.processing_mode).toBe("independent_siblings");
  });

  test("inspects and imports offline SurveyMonkey SAV bundles", async () => {
    const changePlan = {
      action: "replace_data",
      base_name: "ingenieria_civil",
      source_file: "Revision Civil.sav",
      current: { n_rows: 176, n_columns: 84, data_file_id: "old-data", xlsform_file_id: "xls" },
      incoming: { raw_rows: 182, raw_columns: 111, normalized_rows: 182, normalized_columns: 86 },
      impact: {
        rows_delta: 6,
        columns_delta: 2,
        expected_variables: 61,
        matched_variables: 61,
        missing_variables: [],
        blank_filled_variables: [],
        all_empty_variables: ["p28"],
        metadata_columns: ["respondent_id", "collector_id"],
      },
      effects: { xlsform: "preserved", data: "replaced", invalidates: ["validacion", "analitica", "codificacion", "graficos"] },
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/sav-bundle/inspect")) {
        expect(JSON.parse(String(init?.body))).toEqual({
          file_id: "zip-sav",
          missing_required_policy: "fill_blank_warn",
        });
        return jsonResponse({
          ok: true,
          file_id: "zip-sav",
          filename: "Bases finales.zip",
          n_files: 1,
          n_matched: 1,
          n_blocking: 0,
          blocking_files: [],
          files: [{
            file_name: "Revision Civil.sav",
            entry_name: "Bases finales/Revision Civil.sav",
            base_name: "ingenieria_civil",
            matched: true,
            blocking: false,
            action: "replace_data",
            n_rows: 182,
            n_columns: 111,
            n_output_columns: 86,
            expected_variables: 61,
            matched_variables: 61,
            missing_variables: [],
            blank_filled_variables: [],
            all_empty_variables: ["p28"],
            metadata_columns: ["respondent_id", "collector_id"],
            warnings: ["El archivo Civil tiene 1 variables esperadas presentes pero completamente vacías."],
            change_plan: changePlan,
          }],
          warnings: ["El archivo Civil tiene 1 variables esperadas presentes pero completamente vacías."],
        });
      }
      expect(url).toMatch(/\/sav-bundle\/import$/);
      return jsonResponse({
        ok: true,
        file_id: "zip-sav",
        filename: "Bases finales.zip",
        imported_bases: 1,
        results: [{
          base_name: "ingenieria_civil",
          file_name: "Revision Civil.sav",
          entry_name: "Bases finales/Revision Civil.sav",
          data_file_id: "data-new",
          snapshot_file_id: "snap-sav",
          n_rows: 182,
          n_columns: 86,
          warnings: [],
          change_plan: changePlan,
        }],
        inspection: {
          ok: true,
          file_id: "zip-sav",
          filename: "Bases finales.zip",
          n_files: 1,
          n_matched: 1,
          n_blocking: 0,
          blocking_files: [],
          files: [],
          warnings: [],
        },
        estudio: {
          nombre: "AC Ingenierías",
          processing_mode: "independent_siblings",
          active_base: "ingenieria_civil",
          n_bases: 1,
          bases: {},
          max_bases: 10,
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const inspection = await apiSurveyMonkeyMultibaseSavBundleInspect({
      file_id: "zip-sav",
      missing_required_policy: "fill_blank_warn",
    });
    expect(inspection.ok).toBe(true);
    expect(inspection.files[0].change_plan.effects.xlsform).toBe("preserved");
    expect(inspection.files[0].change_plan.impact.rows_delta).toBe(6);
    expect(inspection.files[0].all_empty_variables).toEqual(["p28"]);

    const imported = await apiSurveyMonkeyMultibaseSavBundleImport({
      file_id: "zip-sav",
      missing_required_policy: "fill_blank_warn",
    });
    expect(imported.imported_bases).toBe(1);
    expect(imported.results[0].snapshot_file_id).toBe("snap-sav");
    expect(imported.results[0].change_plan.incoming.normalized_rows).toBe(182);
    expect(imported.estudio.processing_mode).toBe("independent_siblings");
  });

  test("builds SurveyMonkey refresh plan payloads with selected campaigns", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        bases: [{
          base_name: "ingenieria_civil",
          source_alias: "Ingeniería Civil",
          survey_id: "111",
          source_count: 2,
          campaign_suggestions: [{
            survey_id: "222",
            title: "Acreditación Ingeniería Civil - Encuesta a Egresados",
            score: 0.91,
            preselected: true,
          }],
          current_rows: 100,
          remote_rows: 120,
          new_rows: 20,
          edited_rows: 2,
          structure: { ok: true, n_blocking: 0, n_review: 0, diffs: [] },
          codificacion: { has_state: true },
          ok: true,
          updateable: true,
        }],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiSurveyMonkeyMultibaseRefreshPlan({
      months: 12,
      bases: [{
        base_name: "ingenieria_civil",
        campaigns: [{ survey_id: "222", label: "Civil a Egresados", channel: "Correo", source_channel: "Correo" }],
      }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/surveymonkey/multibase/refresh-plan",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({
      months: 12,
      bases: [{
        base_name: "ingenieria_civil",
        campaigns: [{ survey_id: "222", label: "Civil a Egresados", channel: "Correo", source_channel: "Correo" }],
      }],
    });
    expect(result.bases[0].campaign_suggestions?.[0]?.preselected).toBe(true);
    expect(result.bases[0].new_rows).toBe(20);
  });

  test("refreshes SurveyMonkey sibling bases and preserves recode intent", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        results: [{
          base_name: "ingenieria_civil",
          ok: true,
          skipped: false,
          n_new: 20,
          rows_after: 120,
          edited_rows_reported: 2,
          source_count: 2,
          codificacion_job: { ok: true, job_id: "job-recode", kind: "codificacion.reaplicar_surveymonkey", base_name: "ingenieria_civil" },
        }],
        codificacion_jobs: [{ ok: true, job_id: "job-recode", kind: "codificacion.reaplicar_surveymonkey", base_name: "ingenieria_civil" }],
        plan: { ok: true, bases: [] },
        estudio: {
          nombre: "AC Ingenierías",
          processing_mode: "independent_siblings",
          active_base: "ingenieria_civil",
          n_bases: 1,
          bases: {},
          max_bases: 10,
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiSurveyMonkeyMultibaseRefresh({
      months: 12,
      reapply_codificacion: true,
      bases: [{
        base_name: "ingenieria_civil",
        campaigns: [{ survey_id: "222", label: "Civil a Egresados", channel: "Correo", source_channel: "Correo" }],
      }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/surveymonkey/multibase/refresh",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({
      months: 12,
      reapply_codificacion: true,
      bases: [{
        base_name: "ingenieria_civil",
        campaigns: [{ survey_id: "222", label: "Civil a Egresados", channel: "Correo", source_channel: "Correo" }],
      }],
    });
    expect(result.results[0].n_new).toBe(20);
    expect(result.codificacion_jobs?.[0]?.job_id).toBe("job-recode");
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

  test("starts scoped Monitoreo sync with explicit source ids", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ ok: true, job_id: "job-monitoreo" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiMonitoreoSync(undefined, ["kobo_field"]);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoreo/sync",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}"))).toEqual({
      source_ids: ["kobo_field"],
    });
  });

  test("updates territorial phase through lightweight endpoint", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        ok: true,
        config: { territorial: { active_route_phase: "field" } },
        active_route_phase: "field",
        phase_source_status: "missing_source",
        message: "Campo seleccionado, pero todavia no tiene fuente configurada.",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiMonitoreoTerritorialPhase("field");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoreo/territorial/phase",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}"))).toEqual({
      active_route_phase: "field",
    });
    expect(result.phase_source_status).toBe("missing_source");
  });

  test("sends territorial UMP reconciliation through dedicated endpoint", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        ok: true,
        reconciliation: {
          phase: "field",
          scope: "ump_value",
          raw_ump: "UMP 70",
          assigned_block_id: "mz-70",
          assigned_ump: "70",
        },
        config: { territorial: { active_route_phase: "field" } },
        state: { ok: true, sources: [], config: {}, variables: [], dashboard: null, errors: [] },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiMonitoreoTerritorialUmpReconciliation({
      phase: "field",
      scope: "ump_value",
      raw_ump: "UMP 70",
      assigned_block_id: "mz-70",
      assigned_ump: "70",
      assigned_district: "SAN MARTIN",
      assigned_ubigeo: "150101",
      note: "Reconciliacion manual",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoreo/territorial/umps/reconcile",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}"))).toEqual({
      phase: "field",
      scope: "ump_value",
      raw_ump: "UMP 70",
      assigned_block_id: "mz-70",
      assigned_ump: "70",
      assigned_district: "SAN MARTIN",
      assigned_ubigeo: "150101",
      note: "Reconciliacion manual",
    });
    expect(result.reconciliation.assigned_block_id).toBe("mz-70");
  });

  test("sends territorial reconciliation batch through dedicated endpoint", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        ok: true,
        applied: [{ client_id: "code:field:response:r-1", kind: "code", reconciliation: { assigned_code: "P191" } }],
        failed: [{ client_id: "ump:field:ump_value:UMP 70", kind: "ump", code: "E_TEST", message: "Ruta inválida" }],
        config: { territorial: { active_route_phase: "field" } },
        state: { ok: true, sources: [], config: {}, variables: [], dashboard: null, errors: [] },
        saved_project: true,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiMonitoreoTerritorialReconciliationBatch([
      {
        client_id: "code:field:response:r-1",
        kind: "code",
        reconciliation: {
          phase: "field",
          scope: "response",
          response_id: "r-1",
          raw_code: "191",
          normalized_code: "P191",
          assigned_code: "P191",
        },
      },
      {
        client_id: "ump:field:ump_value:UMP 70",
        kind: "ump",
        reconciliation: {
          phase: "field",
          scope: "ump_value",
          raw_ump: "UMP 70",
          assigned_block_id: "mz-70",
          assigned_ump: "70",
        },
      },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoreo/territorial/reconciliation/batch",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}"))).toEqual({
      changes: [
        {
          client_id: "code:field:response:r-1",
          kind: "code",
          reconciliation: {
            phase: "field",
            scope: "response",
            response_id: "r-1",
            raw_code: "191",
            normalized_code: "P191",
            assigned_code: "P191",
          },
        },
        {
          client_id: "ump:field:ump_value:UMP 70",
          kind: "ump",
          reconciliation: {
            phase: "field",
            scope: "ump_value",
            raw_ump: "UMP 70",
            assigned_block_id: "mz-70",
            assigned_ump: "70",
          },
        },
      ],
    });
    expect(result.applied[0]?.client_id).toBe("code:field:response:r-1");
    expect(result.failed[0]?.message).toBe("Ruta inválida");
  });

  test("applies territorial source through lightweight endpoint", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        ok: true,
        source: { id: "kobo_field", kind: "kobo", asset_uid: "asset_field" },
        config: { territorial: { active_route_phase: "field" } },
        state: { ok: true, sources: [], config: {}, variables: [], dashboard: null, errors: [] },
        active_route_phase: "field",
        phase_source_status: "configured",
        message: "Campo seleccionado.",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiMonitoreoTerritorialSource({
      phase: "field",
      asset_uid: "asset_field",
      name: "Formulario Campo",
      version_id: "version_field",
      base_url: "https://kobo.unhcr.org",
      connection_profile_id: "perfil_unhcr",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoreo/territorial/source",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}"))).toEqual({
      phase: "field",
      asset_uid: "asset_field",
      name: "Formulario Campo",
      version_id: "version_field",
      base_url: "https://kobo.unhcr.org",
      connection_profile_id: "perfil_unhcr",
    });
    expect(result.phase_source_status).toBe("configured");
  });

  test("requests territorial map cache layers and prepare endpoint", async () => {
    const urls: string[] = [];
    const bodies: unknown[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      urls.push(String(input));
      if (init?.body) bodies.push(JSON.parse(String(init.body)));
      return jsonResponse({
        ok: true,
        phase: "field",
        layers: ["route_geometry", "gps_points"],
        map_cache: { schema: "monitoreo_territorial_map_cache_v1" },
        payload: { phase: "field", blocks: [], points: [], alerts: [], legend: [] },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiMonitoreoTerritorialMap({
      phase: "field",
      layer: "gps_points",
      hash: "hash-previo",
      allowStale: true,
      prepare: false,
    });
    await apiMonitoreoTerritorialMapPrepare({
      phase: "field",
      layers: ["route_geometry", "gps_points"],
      force: true,
    });

    expect(urls).toEqual([
      "/api/monitoreo/territorial/map?phase=field&layer=gps_points&hash=hash-previo&allow_stale=1&prepare=0",
      "/api/monitoreo/territorial/map/prepare",
    ]);
    expect(bodies[0]).toEqual({
      phase: "field",
      layers: ["route_geometry", "gps_points"],
      force: true,
    });
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

describe("Validacion v2 client", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("reads and saves excluded validation variables by base", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      expect(url).toBe("/api/validacion/v2/instrumento/variables-excluidas");
      expect((init?.headers as Record<string, string>)["X-Base-Nombre"]).toBe("mecatronica");
      if (init?.method === "POST") {
        expect(JSON.parse(String(init.body))).toEqual({ variables: ["p3", "p4"] });
        return jsonResponse({
          ok: true,
          base_nombre: "mecatronica",
          variables: ["p3", "p4"],
          opciones: [],
        });
      }
      return jsonResponse({
        ok: true,
        base_nombre: "mecatronica",
        variables: ["p3"],
        opciones: [{
          variable: "p3",
          label: "Correo",
          n_reglas: 1,
          n_reglas_con_casos: 1,
          n_inconsistencias: 176,
        }],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const current = await apiV2InstrumentoVariablesExcluidas("mecatronica");
    expect(current.variables).toEqual(["p3"]);
    expect(current.opciones[0].n_inconsistencias).toBe(176);

    const saved = await apiV2InstrumentoVariablesExcluidasSave(["p3", "p4"], "mecatronica");
    expect(saved.variables).toEqual(["p3", "p4"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
