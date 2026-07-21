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
  apiMonitoreoKoboSurveyLink,
  apiMonitoreoPublicationEvidencePack,
  apiMonitoreoPublicationPreflight,
  apiMonitoreoPublicationSheetsPublish,
  apiMonitoreoPublicReport,
  apiMonitoreoState,
  apiMonitoreoSource,
  apiMonitoreoSheetsPublish,
  apiMonitoreoSheetsSource,
  apiMonitoreoSync,
  apiMonitoreoAcreditacionCaseReconciliation,
  apiMonitoreoTerritorialMap,
  apiMonitoreoTerritorialMapPrepare,
  apiMonitoreoTerritorialOperationalPackageReview,
  apiMonitoreoTerritorialPhase,
  apiMonitoreoTerritorialReconciliationBatch,
  apiMonitoreoTerritorialSource,
  apiMonitoreoTerritorialUmpReconciliation,
  apiUpload,
  apiCargaRefreshKoboIndependent,
  apiCargaProcessingIntake,
  apiCargaProcessingIntakeSave,
  apiCargaProcessingIntakeValidate,
  apiCargaAcreditacionBatchPreview,
  apiCargaAcreditacionBatchPromote,
  apiProcessingReleases,
  apiProcessingReleaseApprove,
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
  apiGraficosConsolidadoPreflight,
  apiGraficosPptConsolidado,
  apiGraficosSlideLayoutPreview,
  apiGraficosPreviewSlide,
  apiGraficosShareExport,
  apiGraficosShareImport,
  apiGraficosShareInspect,
  apiAnaliticaConfigPut,
  apiAnaliticaPreparar,
  apiXlsformEditorExportPdf,
  apiXlsformEditorImport,
  apiXlsformEditorImportMatrizPulso,
  apiXlsformEditorImportSurveyMonkeyWithLogic,
  isMatrizPulsoImport,
  normalizeXlsformImportResult,
  apiXlsformEditorSmCheckToken,
  apiXlsformEditorSmFetchSurveyInfo,
  apiXlsformEditorSmInterpretRule,
  apiXlsformEditorSmListSurveys,
  apiXlsformEditorSmTokenLoad,
  apiXlsformEditorSmTokenSave,
  apiXlsformFormConfirmLogic,
  apiXlsformFormGet,
  apiXlsformFormPublishRevision,
  apiXlsformFormsList,
  invalidateMonitoreoStateWarmCache,
  normalizeXlsformFormPublication,
  normalizeProcessingIntakePayload,
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

describe("XLSForm instrument revision client", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("normalizes the four remote publication states defensively", async () => {
    const revision = {
      schema: "instrument_revision/v1",
      revision_id: "rev-1",
      form_id: "actor-a",
      revision_no: 1,
      content_sha256: "published-hash",
      xlsform_file_id: "file-xlsx-1",
      published_at: "2026-07-20T12:00:00Z",
    };
    const fetchMock = vi.fn(async () => jsonResponse({
      ok: true,
      active_form_id: "draft-form",
      forms: [
        {
          id: "draft-form",
          name: "Borrador",
          publication: {
            status: "draft",
            draft_content_sha256: "draft-hash",
            latest_revision: null,
            blockers: [],
            warnings: [],
            can_publish: true,
            can_delete: true,
          },
        },
        {
          id: "published-form",
          name: "Publicado",
          publication: {
            status: "published",
            draft_content_sha256: "published-hash",
            latest_revision: revision,
            blockers: [],
            warnings: [],
            can_publish: false,
            can_delete: false,
          },
        },
        {
          id: "changed-form",
          name: "Cambios",
          publication: {
            status: "changes_pending",
            draft_content_sha256: "new-hash",
            latest_revision: revision,
            blockers: [],
            warnings: [],
            can_publish: true,
            can_delete: false,
          },
        },
        {
          id: "blocked-form",
          name: "Bloqueado",
          publication: {
            status: "blocked",
            draft_content_sha256: "blocked-hash",
            latest_revision: null,
            blockers: [{
              id: "missing_name",
              title: "Falta name",
              detail: "Revisa la fila",
              row_index: 3,
            }],
            warnings: [],
            can_publish: false,
            can_delete: true,
          },
        },
      ],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiXlsformFormsList();

    expect(result.forms.map((form) => form.publication.status)).toEqual([
      "draft",
      "published",
      "changes_pending",
      "blocked",
    ]);
    expect(result.forms[1]?.publication.latest_revision?.revision_no).toBe(1);
    expect(result.forms[3]?.publication.blockers[0]?.rowIndex).toBe(3);
  });

  test("round-trips the safe SurveyMonkey source allowlist without secrets", async () => {
    const source = {
      schema: "survey_source/v1",
      kind: "surveymonkey",
      original_name: "Docentes",
      actor_key: "docentes",
      survey_id: "sm-123",
      survey_title: "Encuesta a docentes",
      translated_at: "2026-07-20T12:00:00Z",
      definition_sha256: "a".repeat(64),
      definition_fetched_at: "2026-07-20T11:00:00Z",
      question_count: 38,
      logic_status: "pending_manual_confirmation",
      publication_guard: "Confirma manualmente la lógica antes de publicar.",
      variants: [{ survey_id: "sm-124", channel: "personalizado" }],
      remote_payload_sha256_observed: "b".repeat(64),
      definition_hash_scope: "survey+choices+settings",
      provenance: { provider: "surveymonkey_api", token: "discard" },
      logic_confirmed_at: "2026-07-20T13:00:00Z",
      logic_confirmation_method: "analyst_review",
      logic_review: { reviewer: "analista", authorization: "discard" },
      token: "discard",
      unapproved_field: "discard",
    };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      ok: true,
      active_form_id: "form-docentes",
      forms: [{ id: "form-docentes", name: "Docentes", source }],
    })));

    const result = await apiXlsformFormsList();
    const normalized = result.forms[0]?.source as Record<string, unknown>;

    expect(normalized).toMatchObject({
      schema: "survey_source/v1",
      kind: "surveymonkey",
      original_name: "Docentes",
      actor_key: "docentes",
      survey_id: "sm-123",
      definition_sha256: "a".repeat(64),
      logic_status: "pending_manual_confirmation",
      variants: [{ survey_id: "sm-124", channel: "personalizado" }],
      provenance: { provider: "surveymonkey_api" },
      logic_review: { reviewer: "analista" },
    });
    expect(normalized).not.toHaveProperty("token");
    expect(normalized).not.toHaveProperty("unapproved_field");
    expect(normalized.provenance).not.toHaveProperty("token");
    expect(normalized.logic_review).not.toHaveProperty("authorization");
  });

  test("infers blocker precedence when a malformed payload declares draft", () => {
    const publication = normalizeXlsformFormPublication({
      status: "draft",
      draft_content_sha256: "hash",
      blockers: [{ id: "bad_logic", title: "Lógica inválida", detail: "relevant" }],
      can_publish: true,
      can_delete: true,
    });

    // El normalizador preserva el contrato remoto; el helper de presentación
    // aplica la precedencia defensiva sin reescribir estado del backend.
    expect(publication.status).toBe("draft");
    expect(publication.blockers).toHaveLength(1);
  });

  test("publishes the exact form id with the expected draft hash", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        created: true,
        revision: {
          schema: "instrument_revision/v1",
          revision_id: "rev-actor-a-1",
          form_id: "actor / A",
          revision_no: 1,
          content_sha256: "draft-hash-123",
          xlsform_file_id: "file-xlsx-1",
          published_at: "2026-07-20T12:00:00Z",
        },
        publication: {
          status: "published",
          draft_content_sha256: "draft-hash-123",
          latest_revision: {
            schema: "instrument_revision/v1",
            revision_id: "rev-actor-a-1",
            form_id: "actor / A",
            revision_no: 1,
            content_sha256: "draft-hash-123",
            xlsform_file_id: "file-xlsx-1",
            published_at: "2026-07-20T12:00:00Z",
          },
          blockers: [],
          warnings: [],
          can_publish: false,
          can_delete: false,
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiXlsformFormPublishRevision("actor / A", "draft-hash-123");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/xlsform-editor/forms/actor%20%2F%20A/revisions",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({
      expected_content_sha256: "draft-hash-123",
    });
    expect(result.revision.form_id).toBe("actor / A");
    expect(result.publication.status).toBe("published");
  });

  test("confirma la lógica por formulario y hash sin publicar", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        source: {
          schema: "survey_source/v1",
          kind: "surveymonkey",
          original_name: "Docentes",
          survey_id: "sm-123",
          logic_status: "confirmed",
          logic_confirmed_at: "2026-07-20T22:00:00Z",
          logic_confirmation_method: "editor_manual_review",
          logic_review: { content_sha256: "draft-hash-123" },
        },
        publication: {
          status: "draft",
          draft_content_sha256: "draft-hash-123",
          latest_revision: null,
          blockers: [],
          warnings: [],
          can_publish: true,
          can_delete: true,
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiXlsformFormConfirmLogic("actor / A", "draft-hash-123");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/xlsform-editor/forms/actor%20%2F%20A/logic-confirmation",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({
      expected_content_sha256: "draft-hash-123",
    });
    expect(result.source?.logic_status).toBe("confirmed");
    expect(result.publication.status).toBe("draft");
    expect(result.publication.can_publish).toBe(true);
    expect(result.publication.latest_revision).toBeNull();
  });

  test("preserva la procedencia acreditada completa y descarta secretos", async () => {
    const source = {
      schema: "acreditacion_actor_instrument_draft/v1",
      kind: "surveymonkey",
      original_name: "Administrativos",
      actor_key: "administrativos",
      survey_id: "527574340",
      survey_title: "Encuesta Administrativos",
      definition_sha256: "abc123",
      definition_fetched_at: "2026-07-20T12:00:00Z",
      question_count: 15,
      logic_status: "pending_manual_confirmation",
      publication_guard: "missing_form_id_until_logic_confirmed",
      variants: [{ survey_id: "527574340", channel: "web", token: "no-copiar" }],
      definition_hash_scope: "survey+choices+settings",
      authorization: "Bearer no-copiar",
    };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      ok: true,
      form: {
        id: "acrconta-administrativos",
        name: "Administrativos",
        workbook: {
          survey: { columns: [], rows: [] },
          choices: { columns: [], rows: [] },
          settings: { columns: [], rows: [] },
        },
        source,
        hallazgos: [],
        saved_at: "2026-07-20T12:00:00Z",
      },
    })));

    const result = await apiXlsformFormGet("acrconta-administrativos");

    expect(result.form?.source).toMatchObject({
      schema: source.schema,
      actor_key: source.actor_key,
      survey_id: source.survey_id,
      definition_sha256: source.definition_sha256,
      logic_status: source.logic_status,
      variants: [{ survey_id: "527574340", channel: "web" }],
    });
    expect(result.form?.source).not.toHaveProperty("authorization");
    expect(result.form?.source?.variants?.[0]).not.toHaveProperty("token");
  });
});

describe("Processing intake client", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const response = {
    ok: true,
    intake: {
      schema: "processing_intake/v1",
      processing_mode: "independent_siblings",
      family_id: "family-1",
      revision: 3,
      entries: {
        docentes: {
          entry_id: "entry-1",
          base: "base_1",
          base_label: "Docentes",
          actor_key: "actor_1",
          actor: "Docentes",
          instrument_revision_id: "rev-1",
          status: "stale",
          form_id: "form-docentes",
          latest_revision_id: "rev-2",
          blocking_reasons: [],
        },
      },
    },
    revisions: [
      {
        schema: "instrument_revision/v1",
        revision_id: "rev-1",
        form_id: "form-docentes",
        revision_no: 1,
        content_sha256: "hash-1",
        xlsform_file_id: "file-1",
        published_at: "2026-07-20T12:00:00Z",
        form_name: "Encuesta Docentes",
        is_latest: false,
      },
      {
        schema: "instrument_revision/v1",
        revision_id: "rev-2",
        form_id: "form-docentes",
        revision_no: 2,
        content_sha256: "hash-2",
        xlsform_file_id: "file-2",
        published_at: "2026-07-20T13:00:00Z",
        form_name: "Encuesta Docentes",
        is_latest: true,
      },
    ],
    validation: { valid: true, blockers: [], warnings: [], entries: [], max_entries: 10 },
  };

  test("normalizes named R entry lists without replacing historical revisions", () => {
    const result = normalizeProcessingIntakePayload(response);
    expect(result.intake.entries).toHaveLength(1);
    expect(result.intake.entries[0]).toMatchObject({
      entry_id: "entry-1",
      base: "base_1",
      actor_key: "actor_1",
      instrument_revision_id: "rev-1",
      latest_revision_id: "rev-2",
      status: "stale",
    });
    expect(result.revisions.map((revision) => revision.revision_id)).toEqual(["rev-1", "rev-2"]);
  });

  test("normalizes structured blocking reasons and catalog availability", () => {
    const result = normalizeProcessingIntakePayload({
      ...response,
      revisions: [{
        ...response.revisions[0],
        available: false,
        blocking_reasons: [{ code: "E_FILE_MISSING", message: "No existe el XLSX publicado." }],
      }],
      intake: {
        ...response.intake,
        entries: [{
          ...response.intake.entries.docentes,
          status: "blocked",
          blocking_reasons: [{ code: "E_FILE_MISSING", message: "No existe el XLSX publicado." }],
        }],
      },
    });

    expect(result.revisions[0]).toMatchObject({
      available: false,
      blocking_reasons: [{ code: "E_FILE_MISSING", message: "No existe el XLSX publicado." }],
    });
    expect(result.intake.entries[0]?.blocking_reasons[0]?.message).toContain("XLSX");
  });

  test("keeps candidate readiness returned by the read-only validation endpoint", () => {
    const candidate = response.intake.entries.docentes;
    const result = normalizeProcessingIntakePayload({
      ...response,
      intake: { ...response.intake, entries: [] },
      validation: {
        valid: true,
        blockers: [],
        warnings: [],
        max_entries: 10,
        entries: [candidate],
      },
    });
    expect(result.intake.entries).toHaveLength(0);
    expect(result.validation.entries).toMatchObject([{ entry_id: "entry-1", status: "stale" }]);
    expect(result.validation.max_entries).toBe(10);
  });

  test("lists the intake from its authoritative endpoint", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(response));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiCargaProcessingIntake();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/carga/processing-intake",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(result.intake.revision).toBe(3);
  });

  test.each([
    ["save", apiCargaProcessingIntakeSave, "PUT", "/api/carga/processing-intake"],
    ["validate", apiCargaProcessingIntakeValidate, "POST", "/api/carga/processing-intake/validate"],
  ] as const)("%s sends stable identities and never sends derived status", async (_name, action, method, url) => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse(response);
    });
    vi.stubGlobal("fetch", fetchMock);

    await action({
      expected_revision: 3,
      entries: [{
        entry_id: "entry-1",
        base: "base_1",
        base_label: "Docentes visibles",
        actor_key: "actor_1",
        actor: "Docentes visibles",
        instrument_revision_id: "rev-1",
      }],
    });

    expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({ method }));
    expect(JSON.parse(String(sentInit?.body))).toEqual({
      expected_revision: 3,
      entries: [{
        entry_id: "entry-1",
        base: "base_1",
        base_label: "Docentes visibles",
        actor_key: "actor_1",
        actor: "Docentes visibles",
        instrument_revision_id: "rev-1",
      }],
    });
    expect(String(sentInit?.body)).not.toContain("status");
  });
});

describe("accreditation monitoring batch client", () => {
  beforeEach(() => vi.stubGlobal("localStorage", makeLocalStorage()));
  afterEach(() => vi.unstubAllGlobals());

  const preview = {
    ok: true,
    schema: "accreditation_processing_batch/v1",
    detected: true,
    ready: true,
    replacement_required: false,
    already_materialized: false,
    pins: {
      intake_revision: 2,
      family_id: "family-1",
      cache_token: "cache-1",
      preview_fingerprint: "preview-1",
    },
    totals: { selected: 410, excluded: 109, total_rollup: 519 },
    entries: [],
    blockers: [],
  };

  test("previews only through the batch endpoint", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(preview));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiCargaAcreditacionBatchPreview();

    expect(result.totals.selected).toBe(410);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/carga/monitoreo-handoff/preview-batch",
      expect.objectContaining({ method: "POST", body: "{}" }),
    );
  });

  test("promote copies every preview pin and a single replacement decision", async () => {
    let sentInit: RequestInit | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        promoted: true,
        already_materialized: false,
        batch_id: "batch-1",
        base_names: ["administrativos", "docentes", "egresados", "estudiantes"],
        counts: { administrativos: 15, docentes: 52, egresados: 178, estudiantes: 165 },
        estudio: { ok: true, nombre: "ACRDCONTA", processing_mode: "independent_siblings", active_base: "administrativos", n_bases: 4, bases: {} },
      });
    }));

    await apiCargaAcreditacionBatchPromote(preview.pins, true);

    expect(JSON.parse(String(sentInit?.body))).toEqual({
      expected_intake_revision: 2,
      expected_family_id: "family-1",
      expected_cache_token: "cache-1",
      preview_fingerprint: "preview-1",
      confirm_replacement: true,
    });
  });
});

describe("processing releases client", () => {
  beforeEach(() => vi.stubGlobal("localStorage", makeLocalStorage()));
  afterEach(() => vi.unstubAllGlobals());

  const catalog = {
    ok: true,
    schema: "processing_release_catalog/v1",
    detected: true,
    family_id: "family-1",
    active_base: "docentes",
    all_approved: false,
    entries: [{
      base: "docentes",
      base_label: "Docentes",
      actor: "Docentes",
      entry_id: "entry-docentes",
      family_id: "family-1",
      instrument_revision_id: "revision-docentes",
      status: "ready",
      ready: true,
      approved: false,
      input_fingerprint: "fingerprint-docentes",
      blockers: [],
      pins: {},
      release: null,
    }],
  };

  test("lists the read-only release catalog", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(catalog));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiProcessingReleases();

    expect(result.entries[0]?.status).toBe("ready");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/processing/releases",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  test("approval sends the exact base fingerprint", async () => {
    let sentInit: RequestInit | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse(catalog);
    }));

    await apiProcessingReleaseApprove({
      base: "docentes",
      expected_input_fingerprint: "fingerprint-docentes",
    });

    expect(JSON.parse(String(sentInit?.body))).toEqual({
      base: "docentes",
      expected_input_fingerprint: "fingerprint-docentes",
    });
  });
});

describe("consolidated graphics client", () => {
  beforeEach(() => vi.stubGlobal("localStorage", makeLocalStorage()));
  afterEach(() => vi.unstubAllGlobals());

  test("reads release-gated preflight", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      ok: true,
      schema: "graficos_consolidado/v1",
      ready: true,
      blockers: [],
      source_order: ["docentes", "estudiantes", "administrativos"],
      releases: [],
      input_fingerprint: "fingerprint",
      plan_sha256: "plan",
      n_slides: 4,
      warnings: [],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiGraficosConsolidadoPreflight();

    expect(result.ready).toBe(true);
    expect(result.source_order).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/graficos/consolidado/preflight",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  test("starts one consolidated PPT job with global style", async () => {
    let sentInit: RequestInit | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({ ok: true, job_id: "job-1", kind: "graficos.ppt_consolidado" });
    }));

    await apiGraficosPptConsolidado({ multi_apiladas: { mostrar_leyenda: true } }, { template_id: "generic_16_9" });

    expect(JSON.parse(String(sentInit?.body))).toEqual({
      presets: { multi_apiladas: { mostrar_leyenda: true } },
      config: { template_id: "generic_16_9" },
    });
  });
});

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

    expect(result.kind).toBe("xlsform");
    if (result.kind !== "xlsform") throw new Error("esperaba un import XLSForm normal");
    expect(result.workbook.paper).toEqual(paperSheet);
    expect(result.summary.paper_rows).toBe(1);
  });

  test("discrimina la variante matriz PULSO del import", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        kind: "matriz_pulso",
        audiences: ["Docentes", "Estudiantes", "", "Administrativos"],
        original_name: "Matriz IAC-CINDA.xlsx",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiXlsformEditorImport("uploaded-xlsx");

    expect(result.kind).toBe("matriz_pulso");
    expect(isMatrizPulsoImport(result)).toBe(true);
    if (!isMatrizPulsoImport(result)) throw new Error("esperaba una matriz PULSO");
    // Descarta la audiencia vacía y conserva el orden.
    expect(result.audiences).toEqual(["Docentes", "Estudiantes", "Administrativos"]);
    expect(result.original_name).toBe("Matriz IAC-CINDA.xlsx");
  });

  test("normalizeXlsformImportResult trata la respuesta sin kind como XLSForm", () => {
    const result = normalizeXlsformImportResult({
      ok: true,
      workbook,
      summary: { survey_rows: 1, choices_rows: 0, settings_rows: 1, diagnostico_rows: 0 },
      source: { kind: "xlsform", original_name: "demo.xlsx" },
      warnings: [],
    });
    expect(result.kind).toBe("xlsform");
    expect(isMatrizPulsoImport(result)).toBe(false);
  });

  test("import-matriz-pulso construye workbook + resumen de escala por audiencia", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        workbook,
        summary: {
          audience: "Docentes",
          survey_rows: 1,
          choices_rows: 0,
          settings_rows: 1,
          n_acuerdo: 12,
          n_satisfaccion: 8,
          scale_inferred: true,
        },
        warnings: ["Escala inferida"],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiXlsformEditorImportMatrizPulso("uploaded-xlsx", "Docentes");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/xlsform-editor/import-matriz-pulso",
      expect.objectContaining({ method: "POST" }),
    );
    const payload = JSON.parse(String(sentInit?.body));
    expect(payload).toEqual({ file_id: "uploaded-xlsx", audience: "Docentes" });
    expect(result.workbook.paper).toEqual(paperSheet);
    expect(result.summary.audience).toBe("Docentes");
    expect(result.summary.n_acuerdo).toBe(12);
    expect(result.summary.n_satisfaccion).toBe(8);
    expect(result.summary.scale_inferred).toBe(true);
    expect(result.warnings).toEqual(["Escala inferida"]);
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
            incoming: { n_slides_total: 4, n_slides_applicable: 4, n_slides_skipped: 0 },
            impact: {
              variables_expected: 10,
              variables_available: 9,
              variables_missing: 1,
              missing_variables: [{ code: "p2", label: "Pregunta dos" }],
              skipped_slides: [],
              affected_slides: [
                {
                  slide_id: "s2",
                  slide_title: "Slide P2",
                  tipo: "p_slide_1_grafico",
                  missing_variables: [{ code: "p2", label: "Pregunta dos" }],
                },
              ],
              effects: ["Se conserva XLSForm"],
            },
            warnings: ["1 slide se conservara con variables faltantes vacias."],
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
    expect(inspected.bases[0].incoming.n_slides_applicable).toBe(4);
    expect(inspected.bases[0].incoming.n_slides_skipped).toBe(0);
    expect(inspected.bases[0].impact.affected_slides[0].slide_id).toBe("s2");
    expect(inspected.bases[0].impact.skipped_slides).toHaveLength(0);
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
        applied_bases: [{ base_name: "civil", n_slides_applicable: 4, n_slides_skipped: 0, affected_slides: [] }],
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
    invalidateMonitoreoStateWarmCache();
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
    await apiMonitoreoState({ includeReports: true, reportScope: "phone_summary" });

    expect(urls).toEqual([
      "/api/monitoreo/state",
      "/api/monitoreo/state?include_reports=0",
      "/api/monitoreo/state?include_reports=1",
      "/api/monitoreo/state?include_reports=1&report_scope=route_summary",
      "/api/monitoreo/state?include_reports=1&report_scope=validation_summary",
      "/api/monitoreo/state?include_reports=1&report_scope=queries_summary",
      "/api/monitoreo/state?include_reports=1&report_scope=phone_summary",
    ]);
  });

  test("reuses resolved warm monitoring state cache for repeated warmup requests", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        sources: [],
        config: {},
        has_snapshot: false,
        synced_at: "",
        n_rows: 0,
        variables: [],
        dashboard: null,
        errors: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = await apiMonitoreoState({ includeReports: false, warmupCache: true });
    const second = await apiMonitoreoState({ includeReports: false, warmupCache: true });

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoreo/state?include_reports=0",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  test("dedupes in-flight warm monitoring state requests", async () => {
    const body = {
      ok: true,
      sources: [],
      config: {},
      has_snapshot: false,
      synced_at: "",
      n_rows: 0,
      variables: [],
      dashboard: null,
      errors: [],
    };
    const resolvers: Array<(value: Response) => void> = [];
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      resolvers.push(resolve);
    }));
    vi.stubGlobal("fetch", fetchMock);

    const firstPromise = apiMonitoreoState({ includeReports: false, warmupCache: true });
    const secondPromise = apiMonitoreoState({ includeReports: false, warmupCache: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolvers[0]?.(jsonResponse(body));
    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoreo/state?include_reports=0",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  test("invalidates warm monitoring state cache after mutations", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/monitoreo/territorial/phase")) {
        return jsonResponse({
          ok: true,
          config: {},
          active_route_phase: "field",
          phase_source_status: "configured",
          message: "ok",
        });
      }
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

    const first = await apiMonitoreoState({ includeReports: false, warmupCache: true });
    const second = await apiMonitoreoState({ includeReports: false, warmupCache: true });
    await apiMonitoreoTerritorialPhase("field");
    const third = await apiMonitoreoState({ includeReports: false, warmupCache: true });

    expect(second).toBe(first);
    expect(third).not.toBe(first);
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      "/api/monitoreo/state?include_reports=0",
      "/api/monitoreo/territorial/phase",
      "/api/monitoreo/state?include_reports=0",
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
      referenceDriftFileId: "reference-drift-file",
      operationalPackageReview: {
        status: "review_ready",
        publication_ready: false,
      },
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
      reference_drift_file_id: "reference-drift-file",
      operational_package_review: {
        status: "review_ready",
        publication_ready: false,
      },
    });
    expect(result.controlled_tabs).toContain("Base técnica");
  });

  test("runs executive publication preflight before Sheets publishing", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        audience: "internal",
        family: "acreditacion",
        report_scope: "full",
        tabs: ["Resumen", "Corte y fuentes"],
        preflight: {
          schema: "monitoreo_deliverables_preflight_v1",
          generated_at: "2026-06-29T00:00:00Z",
          family: "acreditacion",
          audience: "internal",
          project: "ACRDCONTA",
          cut: "2026-06-29T00:00:00Z",
          source: "Motor canónico Prosecnur",
          status: "ready",
          score: 100,
          blocking_issues: [],
          warnings: [],
          scorecard: { status: "ready", score: 100, blocking_count: 0, warning_count: 0 },
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiMonitoreoPublicationPreflight("sheet_exec", {
      audience: "internal",
      includeTargets: true,
      confirmedFullData: true,
      referenceDriftFileId: "reference-drift-file",
      operationalPackageReview: {
        status: "review_ready",
        publication_ready: false,
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoreo/publication/preflight",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({
      spreadsheet_id: "sheet_exec",
      audience: "internal",
      include_targets: true,
      confirmed_full_data: true,
      reference_drift_file_id: "reference-drift-file",
      operational_package_review: {
        status: "review_ready",
        publication_ready: false,
      },
    });
    expect(result.preflight.status).toBe("ready");
    expect(result.tabs).toContain("Resumen");
  });

  test("creates executive publication evidence pack download by audience", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        audience: "internal",
        family: "acreditacion",
        report_scope: "full",
        tabs: ["Resumen", "Corte y fuentes"],
        preflight: {
          schema: "monitoreo_deliverables_preflight_v1",
          generated_at: "2026-06-29T00:00:00Z",
          family: "acreditacion",
          audience: "internal",
          project: "ACRDCONTA",
          cut: "2026-06-29T00:00:00Z",
          source: "Motor canónico Prosecnur",
          status: "ready",
          score: 100,
          blocking_issues: [],
          warnings: [],
          scorecard: { status: "ready", score: 100, blocking_count: 0, warning_count: 0 },
        },
        evidence_pack: {
          schema: "monitoreo_deliverables_evidence_pack_result_v1",
          report_json: "tmp/qa/monitoreo-deliverables/acrdconta-internal/report.json",
          report_md: "tmp/qa/monitoreo-deliverables/acrdconta-internal/report.md",
          artifacts: { generated_xlsx: "generated.xlsx" },
        },
        files: {
          operational_package_request_csv: {
            file_id: "request-csv",
            filename: "acrdconta-internal-operational-package-request.csv",
            size: 456,
          },
          operational_package_request: {
            file_id: "request-json",
            filename: "acrdconta-internal-operational-package-request.json",
            size: 789,
          },
          operational_package_status: {
            file_id: "status-json",
            filename: "acrdconta-internal-operational-package-status.json",
            size: 321,
          },
          publication_decision: {
            file_id: "decision-json",
            filename: "acrdconta-internal-publication-decision.json",
            size: 654,
          },
        },
        zip: { file_id: "pack-file", filename: "acrdconta-internal-evidence-pack.zip", size: 1234 },
        file_id: "pack-file",
        filename: "acrdconta-internal-evidence-pack.zip",
        size: 1234,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiMonitoreoPublicationEvidencePack("sheet_exec", {
      audience: "internal",
      includeTargets: true,
      confirmedFullData: true,
      referenceDriftFileId: "reference-drift-file",
      operationalPackageReview: {
        status: "review_ready",
        publication_ready: false,
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoreo/publication/evidence-pack",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({
      spreadsheet_id: "sheet_exec",
      audience: "internal",
      include_targets: true,
      confirmed_full_data: true,
      reference_drift_file_id: "reference-drift-file",
      operational_package_review: {
        status: "review_ready",
        publication_ready: false,
      },
    });
    expect(result.file_id).toBe("pack-file");
    expect(result.download_url).toContain("/api/files/pack-file/download");
    expect(result.files?.operational_package_request_csv?.download_url).toContain("/api/files/request-csv/download");
    expect(result.files?.operational_package_request?.download_url).toContain("/api/files/request-json/download");
    expect(result.files?.operational_package_status?.download_url).toContain("/api/files/status-json/download");
    expect(result.files?.publication_decision?.download_url).toContain("/api/files/decision-json/download");
    expect(result.evidence_pack.artifacts?.generated_xlsx).toBe("generated.xlsx");
  });

  test("uploads completed territorial operational packages with a dedicated kind", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return jsonResponse(url.includes("monitoreo_reference_drift")
        ? {
            file_id: "reference-drift-file",
            kind: "monitoreo_reference_drift",
            original_name: "territorial-drift-report.csv",
            size: 96,
            ext: "csv",
          }
        : {
            file_id: "operational-package-file",
            kind: "monitoreo_operational_package",
            original_name: "completed-operational-package.csv",
            size: 64,
            ext: "csv",
          });
    });
    vi.stubGlobal("fetch", fetchMock);

    const packageResult = await apiUpload(
      new File(["package_item\nump_subsanada:UMP 101\n"], "completed-operational-package.csv", { type: "text/csv" }),
      "monitoreo_operational_package",
    );
    const driftResult = await apiUpload(
      new File(["required_package_item\nump_subsanada:UMP 101\n"], "territorial-drift-report.csv", { type: "text/csv" }),
      "monitoreo_reference_drift",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/files/upload?kind=monitoreo_operational_package",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/files/upload?kind=monitoreo_reference_drift",
      expect.objectContaining({ method: "POST" }),
    );
    expect(packageResult.kind).toBe("monitoreo_operational_package");
    expect(packageResult.ext).toBe("csv");
    expect(driftResult.kind).toBe("monitoreo_reference_drift");
    expect(driftResult.ext).toBe("csv");
  });

  test("reviews territorial operational package without applying it", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        status: "review_ready",
        publication_gate: "operational_package_review_ready",
        blocks_publication: true,
        safe_to_apply: true,
        would_mutate_pulso: false,
        review: {
          schema: "monitoreo_deliverables_territorial_operational_package_review_v1",
          status: "review_ready",
          publication_gate: "operational_package_review_ready",
          blocks_publication: true,
          safe_to_apply: true,
          would_mutate_pulso: false,
          coverage: { package_rows: 2, missing_ump_items: [], missing_tachas: 0, incomplete_rows: 0 },
        },
        files: {
          template: { file_id: "template-file", filename: "acnurcg-operational-package-template.csv", size: 120 },
          review_csv: { file_id: "review-file", filename: "acnurcg-operational-package-review.csv", size: 240 },
          report_json: { file_id: "review-json", filename: "acnurcg-operational-package-review.json", size: 320 },
          report_md: { file_id: "review-md", filename: "acnurcg-operational-package-review.md", size: 180 },
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiMonitoreoTerritorialOperationalPackageReview({
      packageFileId: "operational-package-file",
      packageRows: [{ package_item: "ump_subsanada:UMP 101" }],
      driftRows: [{ required_package_item: "ump_subsanada:UMP 101", blocks_publication: true }],
      driftFileId: "reference-drift-file",
      requiredOperationalPackage: { tachas: 0 },
      requiredTachas: 0,
      source: "Sheet validado ACNURCG",
      cut: "2026-06-26",
      project: "ACNURCG",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoreo/territorial/operational-package/review",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({
      package_file_id: "operational-package-file",
      package_rows: [{ package_item: "ump_subsanada:UMP 101" }],
      drift_rows: [{ required_package_item: "ump_subsanada:UMP 101", blocks_publication: true }],
      drift_file_id: "reference-drift-file",
      required_operational_package: { tachas: 0 },
      required_tachas: 0,
      source: "Sheet validado ACNURCG",
      cut: "2026-06-26",
      project: "ACNURCG",
    });
    expect(result.safe_to_apply).toBe(true);
    expect(result.would_mutate_pulso).toBe(false);
    expect(result.files?.template?.download_url).toContain("/api/files/template-file/download");
    expect(result.files?.review_csv?.download_url).toContain("/api/files/review-file/download");
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

  test("resolves Kobo survey link without exposing token", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        asset_uid: "asset_unhcr",
        name: "UNHCR demo",
        base_url: "https://kobo.unhcr.org",
        survey_url: "https://ee.kobotoolbox.org/x/abc123",
        landing_url: "https://kobo.unhcr.org/#/forms/asset_unhcr/landing",
        version_id: "v1",
        deployment_active: true,
        resolved_from: "deployment",
        token: "plain-secret-should-never-be-used",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiMonitoreoKoboSurveyLink({
      asset_uid: "asset_unhcr",
      base_url: "https://kobo.unhcr.org",
      connection_profile_id: "kobo_unhcr",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoreo/kobo/survey-link",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({
      asset_uid: "asset_unhcr",
      base_url: "https://kobo.unhcr.org",
      profile_id: "kobo_unhcr",
    });
    expect(result).toMatchObject({
      asset_uid: "asset_unhcr",
      survey_url: "https://ee.kobotoolbox.org/x/abc123",
      resolved_from: "deployment",
    });
    expect(result as Record<string, unknown>).not.toHaveProperty("token");
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
      surveymonkey_logic_rules: "Q1 = C1 => Ocultar P2.",
      surveymonkey_logic_rules_by_survey: {
        "1": "Q1 != C1 => Ocultar P2.",
      },
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
      surveymonkey_logic_rules: "Q1 = C1 => Ocultar P2.",
      surveymonkey_logic_rules_by_survey: {
        "1": "Q1 != C1 => Ocultar P2.",
      },
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

  test("refreshes Kobo independent siblings with saved base names", async () => {
    let sentInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentInit = init;
      return jsonResponse({
        ok: true,
        provider: "kobo",
        processing_mode: "independent_siblings",
        active_base: "docentes",
        results: [{
          ok: true,
          base_name: "docentes",
          asset_uid: "asset_docentes",
          rows_before: 2,
          rows_after: 3,
          total_remote: 3,
          xlsform_file_id: "xls-new",
          data_file_id: "data-new",
          refreshed_at: "2026-07-02T12:00:00Z",
        }],
        updated_bases: ["docentes"],
        n_updated_bases: 1,
        estudio: {
          nombre: null,
          processing_mode: "independent_siblings",
          active_base: "docentes",
          n_bases: 1,
          bases: {},
          max_bases: 10,
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiCargaRefreshKoboIndependent({ base_names: ["docentes"] });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/carga/platform/kobo/refresh-independent",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(sentInit?.body))).toEqual({ base_names: ["docentes"] });
    expect(result.n_updated_bases).toBe(1);
    expect(result.results[0]?.rows_after).toBe(3);
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

  test("starts Monitoreo sync with explicit sync mode", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ ok: true, job_id: "job-monitoreo" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiMonitoreoSync(undefined, ["sm_docentes"], { syncMode: "advance" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoreo/sync",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}"))).toEqual({
      source_ids: ["sm_docentes"],
      sync_mode: "advance",
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

  test("sends Acreditacion case reconciliation through dedicated endpoint", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        ok: true,
        decision: {
          response_id: "r-parcial-validable",
          action: "include_with_caveat",
          assigned_case_key: "codigo:A1",
          note: "Parcial validada manualmente por evidencia suficiente.",
        },
        config: { monitoreo_profile: { family: "acreditacion" } },
        state: { ok: true, sources: [], config: {}, variables: [], dashboard: null, errors: [] },
        saved_project: true,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiMonitoreoAcreditacionCaseReconciliation({
      response_id: "r-parcial-validable",
      action: "include_with_caveat",
      candidate_id: "codigo:A1",
      note: "Parcial validada manualmente por evidencia suficiente.",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoreo/acreditacion/case-reconciliation",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}"))).toEqual({
      response_id: "r-parcial-validable",
      action: "include_with_caveat",
      candidate_id: "codigo:A1",
      note: "Parcial validada manualmente por evidencia suficiente.",
    });
    expect(result.decision.action).toBe("include_with_caveat");
    expect(result.saved_project).toBe(true);
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

  test("dedupes in-flight territorial map layer requests", async () => {
    const body = {
      ok: true,
      phase: "field",
      layers: ["gps_points"],
      payload: { phase: "field", blocks: [], points: [], alerts: [], legend: [] },
    };
    const resolvers: Array<(value: Response) => void> = [];
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      resolvers.push(resolve);
    }));
    vi.stubGlobal("fetch", fetchMock);

    const firstPromise = apiMonitoreoTerritorialMap({
      phase: "field",
      layer: "gps_points",
      allowStale: true,
      prepare: false,
    });
    const secondPromise = apiMonitoreoTerritorialMap({
      phase: "field",
      layer: "gps_points",
      allowStale: true,
      prepare: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolvers[0]?.(jsonResponse(body));
    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoreo/territorial/map?phase=field&layer=gps_points&allow_stale=1&prepare=0",
      expect.objectContaining({ headers: expect.any(Object) }),
    );

    const thirdPromise = apiMonitoreoTerritorialMap({
      phase: "field",
      layer: "gps_points",
      allowStale: true,
      prepare: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    resolvers[1]?.(jsonResponse(body));
    await thirdPromise;
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

  test("preview slide sends optional quality/image/render flags when provided", async () => {
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
      include_images: false,
      render_slide_preview: false,
    });

    expect(bodies).toEqual([
      {
        slide,
        config,
        preview_quality: "normal",
        include_images: false,
        render_slide_preview: false,
      },
    ]);
  });

  test("requests slide layout geometry by slide type", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      ok: true,
      tipo: "p_slide_2_graficos",
      contract: "slide_2",
      layout: "Graficos_2columnas",
      aspectRatio: 16 / 9,
      source: "template",
      placeholders: [
        {
          key: "left",
          payload_key: "izquierda",
          role: "chart",
          rect: { x: 0.05, y: 0.1, width: 0.4, height: 0.7 },
        },
      ],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await apiGraficosSlideLayoutPreview("p_slide_2_graficos");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/graficos/slide-layout-preview?tipo=p_slide_2_graficos",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(response.placeholders[0]?.payload_key).toBe("izquierda");
  });
});
