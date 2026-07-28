// xlsformEditor.ts — colección multi-formulario del editor XLSForm + carga.
// Extraído de client.ts (split por dominio, 2026-07). Los consumidores
// importan del barrel ./client; este módulo no cambia el contrato.

import { ApiError, apiFetch, handle, headers } from "./core";
import type { EstudioBase, EstudioLogicSyncResult, EstudioPayload } from "./estudio";
import { normalizeShareArray } from "./graficos";
import type { MonitoreoKoboAssetItem, MonitoreoProcessingHandoffPromoteResult } from "./monitoreo";
import { type EditorPayloadWithHallazgos, type Hallazgo, normalizeEditorPayload, normalizePersistedXlsformWorkbook, type SurveyMonkeyLogicState, type SurveyMonkeyVisualLogicAction, type SurveyMonkeyVisualLogicRule, type XlsformEditorPayload, type XlsformEditorWorkbook, type XlsformFormSource, type XlsformSourceRecord, type XlsformSourceValue } from "./multiIntegrado";

// -----------------------------------------------------------------------------
// Colección multi-formulario del editor XLSForm (Oleada 2)
// -----------------------------------------------------------------------------
// Un proyecto puede alojar varios formularios. El backend mantiene una
// colección nombrada por `id` más un espejo del activo (`s$xlsform_state`,
// shape retrocompatible que consumen Carga/Monitoreo/etc.). El frontend es
// autoritativo del `id` (lo genera con crypto.randomUUID()).

/** Entrada ligera del índice de la biblioteca (sin workbook). */
export type XlsformPublicationStatus =
  | "draft"
  | "published"
  | "changes_pending"
  | "blocked";

export type XlsformPublicationDiagnostic = {
  id: string;
  title: string;
  detail: string;
  rowIndex?: number;
};

export type XlsformInstrumentRevision = {
  schema: string;
  revision_id: string;
  form_id: string;
  revision_no: number;
  content_sha256: string;
  xlsform_file_id: string;
  published_at: string;
};

export type XlsformFormPublication = {
  status: XlsformPublicationStatus;
  draft_content_sha256: string;
  latest_revision: XlsformInstrumentRevision | null;
  blockers: XlsformPublicationDiagnostic[];
  warnings: XlsformPublicationDiagnostic[];
  can_publish: boolean;
  can_delete: boolean;
};

export type FormLibraryEntry = {
  id: string;
  name: string;
  source: XlsformFormSource | null;
  saved_at: number;
  active: boolean;
  /** Conteos calculados en el backend sobre el workbook (para tarjetas del hub
   * sin traer el workbook completo). Ausentes en índices locales antiguos. */
  n_questions?: number;
  n_sections?: number;
  publication: XlsformFormPublication;
};

/** Formulario completo persistido (con workbook + hallazgos). */
export type PersistedXlsformForm = {
  id: string;
  name?: string;
  workbook: XlsformEditorWorkbook;
  source: XlsformFormSource | null;
  hallazgos: Hallazgo[];
  saved_at: number;
};

const XLSFORM_SOURCE_FIELDS = [
  "schema",
  "kind",
  "original_name",
  "actor_key",
  "survey_id",
  "survey_title",
  "translated_at",
  "definition_sha256",
  "definition_fetched_at",
  "question_count",
  "logic_status",
  "publication_guard",
  "variants",
  "remote_payload_sha256_observed",
  "definition_hash_scope",
  "translation_profile",
  "provenance",
  "logic_confirmed_at",
  "logic_confirmation_method",
  "logic_review",
] as const;

const SENSITIVE_SOURCE_KEY = /(?:^|[_-])(?:token|authorization|password|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|cookie|credential|session)(?:$|[_-])/i;

function sanitizeXlsformSourceValue(value: unknown, depth = 0): XlsformSourceValue | undefined {
  if (depth > 12) return undefined;
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeXlsformSourceValue(item, depth + 1))
      .filter((item): item is XlsformSourceValue => item !== undefined);
  }
  if (typeof value !== "object") return undefined;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !SENSITIVE_SOURCE_KEY.test(key))
    .flatMap(([key, item]) => {
      const sanitized = sanitizeXlsformSourceValue(item, depth + 1);
      return sanitized === undefined ? [] : [[key, sanitized] as const];
    });
  return Object.fromEntries(entries) as XlsformSourceRecord;
}

/** Normaliza y sanea la procedencia usando exclusivamente su allowlist pública. */
export function normalizeXlsformFormSource(value: unknown): XlsformFormSource | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const allowed = Object.fromEntries(
    XLSFORM_SOURCE_FIELDS
      .filter((key) => Object.prototype.hasOwnProperty.call(raw, key))
      .map((key) => [key, raw[key]]),
  );
  const sanitized = sanitizeXlsformSourceValue(allowed);
  if (!sanitized || Array.isArray(sanitized) || typeof sanitized !== "object") return null;
  const safe = sanitized as XlsformSourceRecord;
  const kind = typeof safe.kind === "string" && safe.kind.trim() ? safe.kind : null;
  const originalName = typeof safe.original_name === "string" && safe.original_name.trim()
    ? safe.original_name
    : null;
  const variants = Array.isArray(safe.variants)
    ? safe.variants.filter((item): item is XlsformSourceRecord => (
        Boolean(item) && typeof item === "object" && !Array.isArray(item)
      ))
    : undefined;
  const provenance = safe.provenance && typeof safe.provenance === "object" && !Array.isArray(safe.provenance)
    ? safe.provenance as XlsformSourceRecord
    : undefined;
  const logicReview = safe.logic_review && typeof safe.logic_review === "object" && !Array.isArray(safe.logic_review)
    ? safe.logic_review as XlsformSourceRecord
    : undefined;
  const questionCount = typeof safe.question_count === "number" && Number.isFinite(safe.question_count)
    ? safe.question_count
    : null;
  const normalized: XlsformFormSource = {
    kind,
    original_name: originalName,
  };
  for (const field of XLSFORM_SOURCE_FIELDS) {
    if (field === "kind" || field === "original_name" || field === "variants"
      || field === "provenance" || field === "logic_review" || field === "question_count") continue;
    const item = safe[field];
    if (typeof item === "string" || item === null) {
      normalized[field] = item;
    }
  }
  if (Object.prototype.hasOwnProperty.call(safe, "question_count")) normalized.question_count = questionCount;
  if (variants) normalized.variants = variants;
  if (provenance) normalized.provenance = provenance;
  if (logicReview) normalized.logic_review = logicReview;
  const hasRichMetadata = Object.keys(normalized).some((key) => key !== "kind" && key !== "original_name");
  return kind == null && originalName == null && !hasRichMetadata ? null : normalized;
}

function normalizePublicationDiagnostic(value: unknown): XlsformPublicationDiagnostic | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const id = typeof v.id === "string" && v.id.trim() ? v.id : "publication_diagnostic";
  const title = typeof v.title === "string" && v.title.trim() ? v.title : "Revisar formulario";
  const detail = typeof v.detail === "string" ? v.detail : "";
  const rawRowIndex = v.rowIndex ?? v.row_index;
  const rowIndex = typeof rawRowIndex === "number" && Number.isFinite(rawRowIndex)
    ? rawRowIndex
    : undefined;
  return { id, title, detail, ...(rowIndex == null ? {} : { rowIndex }) };
}

function normalizeInstrumentRevision(value: unknown): XlsformInstrumentRevision | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const revisionId = typeof v.revision_id === "string" ? v.revision_id : "";
  const formId = typeof v.form_id === "string" ? v.form_id : "";
  const contentSha256 = typeof v.content_sha256 === "string" ? v.content_sha256 : "";
  const xlsformFileId = typeof v.xlsform_file_id === "string" ? v.xlsform_file_id : "";
  const revisionNo = Number(v.revision_no);
  if (!revisionId || !formId || !contentSha256 || !xlsformFileId || !Number.isFinite(revisionNo)) {
    return null;
  }
  return {
    schema: typeof v.schema === "string" && v.schema ? v.schema : "instrument_revision/v1",
    revision_id: revisionId,
    form_id: formId,
    revision_no: revisionNo,
    content_sha256: contentSha256,
    xlsform_file_id: xlsformFileId,
    published_at: typeof v.published_at === "string" ? v.published_at : "",
  };
}

export function normalizeXlsformFormPublication(value: unknown): XlsformFormPublication {
  const v = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const latestRevision = normalizeInstrumentRevision(v.latest_revision);
  const blockers = Array.isArray(v.blockers)
    ? v.blockers
      .map(normalizePublicationDiagnostic)
      .filter((item): item is XlsformPublicationDiagnostic => item != null)
    : [];
  const warnings = Array.isArray(v.warnings)
    ? v.warnings
      .map(normalizePublicationDiagnostic)
      .filter((item): item is XlsformPublicationDiagnostic => item != null)
    : [];
  const draftContentSha256 = typeof v.draft_content_sha256 === "string"
    ? v.draft_content_sha256
    : "";
  const declaredStatus = v.status;
  const inferredStatus: XlsformPublicationStatus = blockers.length > 0
    ? "blocked"
    : latestRevision == null
      ? "draft"
      : draftContentSha256 === latestRevision.content_sha256
        ? "published"
        : "changes_pending";
  const status: XlsformPublicationStatus =
    declaredStatus === "draft"
      || declaredStatus === "published"
      || declaredStatus === "changes_pending"
      || declaredStatus === "blocked"
      ? declaredStatus
      : inferredStatus;
  const canPublishDefault = status !== "published" && status !== "blocked" && Boolean(draftContentSha256);
  return {
    status,
    draft_content_sha256: draftContentSha256,
    latest_revision: latestRevision,
    blockers,
    warnings,
    can_publish: typeof v.can_publish === "boolean" ? v.can_publish : canPublishDefault,
    can_delete: typeof v.can_delete === "boolean" ? v.can_delete : latestRevision == null,
  };
}

function normalizeFormEntry(value: unknown): FormLibraryEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const id = typeof v.id === "string" ? v.id : "";
  if (!id) return null;
  const savedAt = typeof v.saved_at === "number" && Number.isFinite(v.saved_at)
    ? v.saved_at
    : Number(v.saved_at) || 0;
  return {
    id,
    name: typeof v.name === "string" && v.name.trim() ? v.name : "Formulario",
    source: normalizeXlsformFormSource(v.source),
    saved_at: savedAt,
    active: v.active === true,
    n_questions: typeof v.n_questions === "number" ? v.n_questions : undefined,
    n_sections: typeof v.n_sections === "number" ? v.n_sections : undefined,
    publication: normalizeXlsformFormPublication(v.publication),
  };
}

export async function apiXlsformFormsList(): Promise<{
  ok: true;
  forms: FormLibraryEntry[];
  active_form_id: string | null;
}> {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/forms", { method: "GET", headers: headers() }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  const forms = Array.isArray(r.forms)
    ? r.forms.map(normalizeFormEntry).filter((entry): entry is FormLibraryEntry => entry != null)
    : [];
  return {
    ok: true,
    forms,
    active_form_id: typeof r.active_form_id === "string" ? r.active_form_id : null,
  };
}

export async function apiXlsformFormGet(id: string): Promise<{
  ok: true;
  form: PersistedXlsformForm | null;
}> {
  const raw = await handle<unknown>(
    await apiFetch(`/api/xlsform-editor/forms/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: headers(),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  const formRaw = (r.form ?? {}) as Record<string, unknown>;
  const workbook = normalizePersistedXlsformWorkbook(formRaw.workbook);
  if (!workbook) return { ok: true, form: null };
  const savedAt = typeof formRaw.saved_at === "number" && Number.isFinite(formRaw.saved_at)
    ? formRaw.saved_at
    : Number(formRaw.saved_at) || 0;
  return {
    ok: true,
    form: {
      id: typeof formRaw.id === "string" ? formRaw.id : id,
      name: typeof formRaw.name === "string" ? formRaw.name : undefined,
      workbook,
      source: normalizeXlsformFormSource(formRaw.source),
      hallazgos: Array.isArray(formRaw.hallazgos) ? (formRaw.hallazgos as Hallazgo[]) : [],
      saved_at: savedAt,
    },
  };
}

export async function apiXlsformFormSave(form: PersistedXlsformForm): Promise<{
  ok: true;
  id: string;
  saved_at: number;
  active_form_id: string | null;
}> {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/forms", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ ...form, source: normalizeXlsformFormSource(form.source) }),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  const savedAt = typeof r.saved_at === "number" && Number.isFinite(r.saved_at)
    ? r.saved_at
    : Number(r.saved_at) || Date.now();
  return {
    ok: true,
    id: typeof r.id === "string" ? r.id : form.id,
    saved_at: savedAt,
    active_form_id: typeof r.active_form_id === "string" ? r.active_form_id : null,
  };
}

export async function apiXlsformFormActivate(id: string): Promise<{
  ok: true;
  active_form_id: string | null;
}> {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/forms/activate", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ id }),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    active_form_id: typeof r.active_form_id === "string" ? r.active_form_id : null,
  };
}

export async function apiXlsformFormDelete(id: string): Promise<{
  ok: true;
  active_form_id: string | null;
}> {
  const raw = await handle<unknown>(
    await apiFetch(`/api/xlsform-editor/forms/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: headers(),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    active_form_id: typeof r.active_form_id === "string" ? r.active_form_id : null,
  };
}

export async function apiXlsformFormPublishRevision(
  id: string,
  expectedContentSha256: string,
): Promise<{
  ok: true;
  created: boolean;
  revision: XlsformInstrumentRevision;
  publication: XlsformFormPublication;
}> {
  const raw = await handle<unknown>(
    await apiFetch(`/api/xlsform-editor/forms/${encodeURIComponent(id)}/revisions`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ expected_content_sha256: expectedContentSha256 }),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  const revision = normalizeInstrumentRevision(r.revision);
  if (!revision) {
    throw new ApiError(
      "E_INVALID_RESPONSE",
      "El backend no devolvió una revisión de instrumento válida",
    );
  }
  return {
    ok: true,
    created: r.created === true,
    revision,
    publication: normalizeXlsformFormPublication(r.publication),
  };
}

export async function apiXlsformFormConfirmLogic(
  id: string,
  expectedContentSha256: string,
): Promise<{
  ok: true;
  source: XlsformFormSource | null;
  publication: XlsformFormPublication;
}> {
  const raw = await handle<unknown>(
    await apiFetch(`/api/xlsform-editor/forms/${encodeURIComponent(id)}/logic-confirmation`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ expected_content_sha256: expectedContentSha256 }),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    source: normalizeXlsformFormSource(r.source),
    publication: normalizeXlsformFormPublication(r.publication),
  };
}

export type RuleInterpretation =
  | {
      ok: true;
      regla_parseada: {
	        when_var: string;
	        when_op: "eq" | "ne" | "in" | "not_in";
	        when_codes: string[];
	        actions: string[];
	        n_actions: number;
	      };
	      resolucion: {
	        when_var_label: string;
	        when_var_xlsform: string;
	        kobo_expr: string;
	        when_codes_resueltos: { code: string; label: string }[];
	        targets_resueltos: Array<
	          | { kind: "hide_question"; target: string; label: string }
	          | { kind: "hide_page"; page_id: string; page_label: string; preguntas: string[] }
	          | { kind: "jump_hidden_question"; target: string; label: string; jump_target: string; jump_target_label: string }
	          | { kind: "end_survey" }
	        >;
        choices_disponibles: Array<{
          code: string;
          position: number;
          label: string;
          is_other: boolean;
          is_none: boolean;
        }>;
      };
      texto_humano: string;
      diagrama: {
        origen: { id: string; label: string; condicion: string };
        edges: Array<{ target_id: string; target_label: string; action: string }>;
      };
      warnings: string[];
    }
  | { ok: false; error: string };

// jsonlite (R) serializa vectores de 1 elemento como string suelto en lugar
// de array. Esto rompe cualquier `.map()` en el frontend. El helper coerce
// a array siempre.
function ensureArray<T = unknown>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v == null) return [];
  return [v as T];
}

export async function apiXlsformEditorSmInterpretRule(
  regla: string,
	  opts: {
	    survey_id?: string;
		    workbook?: XlsformEditorWorkbook | null;
		    paginas?: Record<string, string[]>;
		    paginas_labels?: Record<string, string>;
		    choice_order_overrides?: Record<string, string[]>;
		    choice_code_maps?: ChoiceCodeMap[];
	  } = {},
): Promise<RuleInterpretation> {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/sm-interpret-rule", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
	        regla,
	        workbook: opts.workbook ?? undefined,
	        survey_id: opts.survey_id ?? "",
	        paginas: opts.paginas ?? {},
	        paginas_labels: opts.paginas_labels ?? {},
	        choice_order_overrides: opts.choice_order_overrides ?? {},
	        choice_code_maps: opts.choice_code_maps ?? [],
	      }),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.ok !== true) {
    return { ok: false, error: String(r.error ?? "No pude interpretar la regla.") };
  }
  // Normalizar arrays que jsonlite puede haber colapsado a scalar (1 item).
  const reglaP = (r.regla_parseada ?? {}) as Record<string, unknown>;
  const reso = (r.resolucion ?? {}) as Record<string, unknown>;
  const diag = (r.diagrama ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    regla_parseada: {
	      when_var: String(reglaP.when_var ?? ""),
	      when_op: (reglaP.when_op ?? "eq") as "eq" | "ne" | "in" | "not_in",
	      when_codes: ensureArray<string>(reglaP.when_codes).map((x) => String(x)),
	      actions: ensureArray<string>(reglaP.actions).map((x) => String(x)),
	      n_actions: Number(reglaP.n_actions ?? 0),
	    },
	    resolucion: {
	      when_var_label: String(reso.when_var_label ?? ""),
	      when_var_xlsform: String(reso.when_var_xlsform ?? ""),
	      kobo_expr: String(reso.kobo_expr ?? ""),
	      when_codes_resueltos: ensureArray<Record<string, unknown>>(reso.when_codes_resueltos).map((c) => ({
	        code: String(c.code ?? ""),
	        label: String(c.label ?? ""),
      })),
      targets_resueltos: ensureArray<Record<string, unknown>>(reso.targets_resueltos).map((t) => {
        const kind = String(t.kind ?? "");
        if (kind === "hide_question") {
          return { kind: "hide_question" as const, target: String(t.target ?? ""), label: String(t.label ?? "") };
        }
	        if (kind === "hide_page") {
	          return {
	            kind: "hide_page" as const,
            page_id: String(t.page_id ?? ""),
            page_label: String(t.page_label ?? ""),
	            preguntas: ensureArray<string>(t.preguntas).map((x) => String(x)),
	          };
	        }
	        if (kind === "jump_hidden_question") {
	          return {
	            kind: "jump_hidden_question" as const,
	            target: String(t.target ?? ""),
	            label: String(t.label ?? ""),
	            jump_target: String(t.jump_target ?? ""),
	            jump_target_label: String(t.jump_target_label ?? ""),
	          };
	        }
	        return { kind: "end_survey" as const };
	      }),
      choices_disponibles: ensureArray<Record<string, unknown>>(reso.choices_disponibles).map((c) => ({
        code: String(c.code ?? ""),
        position: Number(c.position ?? 0),
        label: String(c.label ?? ""),
        is_other: c.is_other === true || c.is_other === "TRUE",
        is_none: c.is_none === true || c.is_none === "TRUE",
      })),
    },
    texto_humano: String(r.texto_humano ?? ""),
    diagrama: {
      origen: {
        id: String((diag.origen as Record<string, unknown> | undefined)?.id ?? ""),
        label: String((diag.origen as Record<string, unknown> | undefined)?.label ?? ""),
        condicion: String((diag.origen as Record<string, unknown> | undefined)?.condicion ?? ""),
      },
      edges: ensureArray<Record<string, unknown>>(diag.edges).map((e) => ({
        target_id: String(e.target_id ?? ""),
        target_label: String(e.target_label ?? ""),
        action: String(e.action ?? ""),
      })),
    },
    warnings: ensureArray<string>(r.warnings).map((w) => String(w)),
  };
}

export async function apiXlsformEditorSmApplyLogic(
  workbook: XlsformEditorWorkbook,
  reglas: string,
  paginas: Record<string, string[]> = {},
  choice_order_overrides: Record<string, string[]> = {},
  sourceName = "XLSForm actual",
  choice_code_maps: ChoiceCodeMap[] = [],
  replace_existing = false,
): Promise<XlsformEditorPayload> {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/sm-apply-logic", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        workbook,
        reglas,
	        paginas,
		        choice_order_overrides,
		        source_name: sourceName,
		        choice_code_maps,
		        replace_existing,
		      }),
    }),
  );
  return normalizeEditorPayload(raw);
}

export async function apiXlsformEditorImportSurveyMonkeyWithLogic(
  file_id: string | null,
  reglas: string,
  paginas: Record<string, string[]>,
  paginas_labels: Record<string, string>,
  lang = "es",
  smApi?: {
    survey_id: string;
    expected_definition_sha256?: string;
    expected_translation_profile?: string;
  },
  choice_order_overrides?: Record<string, string[]>,
  choice_code_maps: ChoiceCodeMap[] = [],
): Promise<EditorPayloadWithHallazgos> {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/import-surveymonkey-with-logic", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        file_id: file_id ?? "",
        reglas,
        paginas,
        paginas_labels,
        lang,
        survey_id: smApi?.survey_id ?? "",
        expected_definition_sha256: smApi?.expected_definition_sha256 ?? "",
        expected_translation_profile: smApi?.expected_translation_profile ?? "",
        choice_order_overrides: choice_order_overrides ?? {},
        choice_code_maps,
      }),
    })
  );
  const base = normalizeEditorPayload(raw);
  const r = (raw ?? {}) as Record<string, unknown>;
  // ensureArray cubre el caso de jsonlite-collapsed-to-scalar (1 hallazgo).
  const hallazgosRaw = ensureArray<Record<string, unknown>>(r.hallazgos);
  return {
    ...base,
    hallazgos: hallazgosRaw.map((h) => ({
      target: String(h.target ?? ""),
      severity: (h.severity === "info" ? "info" : "warn") as "warn" | "info",
      kind: (h.kind === "baja_completitud" ? "baja_completitud" : "regla_violada") as Hallazgo["kind"],
      mensaje: String(h.mensaje ?? ""),
      coverage_oculta: h.coverage_oculta == null ? null : Number(h.coverage_oculta),
      tasa_respuesta: h.tasa_respuesta == null ? null : Number(h.tasa_respuesta),
      inconsistencias: ensureArray<number>(h.inconsistencias).map((n) => Number(n)),
    })),
  };
}

export function normalizeSurveyMonkeyLogicState(value: unknown): SurveyMonkeyLogicState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const rulesRaw = Array.isArray(raw.advanced_rules)
    ? raw.advanced_rules
    : Array.isArray(raw.rules)
      ? raw.rules
      : [];
  const visualRaw = Array.isArray(raw.visual_rules) ? raw.visual_rules : [];
  const overridesRaw = raw.choice_order_overrides;
  const choice_order_overrides: Record<string, string[]> = {};
  if (overridesRaw && typeof overridesRaw === "object" && !Array.isArray(overridesRaw)) {
    for (const [key, val] of Object.entries(overridesRaw as Record<string, unknown>)) {
      choice_order_overrides[key] = Array.isArray(val) ? val.map((item) => String(item)) : [];
    }
  }
  const choice_code_maps = normalizeChoiceCodeMaps(raw.choice_code_maps ?? raw.choiceCodeMaps);
  const rules = rulesRaw
    .map((item) => {
      const r = (item ?? {}) as Record<string, unknown>;
      return {
        id: String(r.id ?? ""),
        texto: String(r.texto ?? ""),
        texto_humano: String(r.texto_humano ?? ""),
        kobo_expr: r.kobo_expr == null ? undefined : String(r.kobo_expr),
      };
    })
    .filter((rule) => rule.texto.trim());
  const visual_rules: SurveyMonkeyVisualLogicRule[] = visualRaw
    .map((item) => {
      const r = (item ?? {}) as Record<string, unknown>;
      const choicesRaw = Array.isArray(r.choices) ? r.choices : [];
      return {
        id: String(r.id ?? ""),
        variableRef: String(r.variableRef ?? r.variable_ref ?? ""),
        variableLabel: String(r.variableLabel ?? r.variable_label ?? ""),
        choices: choicesRaw.map((choice) => {
          const c = (choice ?? {}) as Record<string, unknown>;
          return {
            choiceName: String(c.choiceName ?? c.choice_name ?? ""),
            choiceLabel: String(c.choiceLabel ?? c.choice_label ?? ""),
            choiceIndex: Number(c.choiceIndex ?? c.choice_index ?? 0),
            action: normalizeSurveyMonkeyVisualAction(c.action),
          };
        }),
      };
    })
    .filter((rule) => rule.variableRef.trim());
  if (!rules.length && !visual_rules.length && Object.keys(choice_order_overrides).length === 0 && choice_code_maps.length === 0) return null;
  return { rules, advanced_rules: rules, visual_rules, choice_order_overrides, choice_code_maps };
}

function normalizeChoiceCodeMaps(value: unknown): ChoiceCodeMap[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const raw = (item ?? {}) as Record<string, unknown>;
      const mappingsRaw = Array.isArray(raw.mappings) ? raw.mappings : [];
      return {
        variable: String(raw.variable ?? ""),
        label: String(raw.label ?? ""),
        type: String(raw.type ?? ""),
        list_name: String(raw.list_name ?? raw.listName ?? ""),
        status: String(raw.status ?? ""),
        high_confidence: Boolean(raw.high_confidence ?? raw.highConfidence),
        requires_confirmation: Boolean(raw.requires_confirmation ?? raw.requiresConfirmation),
        mappings: mappingsRaw.map((mapping) => {
          const m = (mapping ?? {}) as Record<string, unknown>;
          return {
            source_code: String(m.source_code ?? m.sourceCode ?? ""),
            source_column: String(m.source_column ?? m.sourceColumn ?? ""),
            source_label: String(m.source_label ?? m.sourceLabel ?? ""),
            xls_code: String(m.xls_code ?? m.xlsCode ?? ""),
            xls_label: String(m.xls_label ?? m.xlsLabel ?? ""),
            match: String(m.match ?? ""),
          };
        }),
      };
    })
    .filter((map) => map.variable && map.mappings.length > 0);
}

function normalizeSurveyMonkeyVisualAction(value: unknown): SurveyMonkeyVisualLogicAction {
  if (!value || typeof value !== "object") return { kind: "none" };
  const raw = value as Record<string, unknown>;
  const kind = String(raw.kind ?? "none");
  if (kind === "page_top") {
    return {
      kind: "page_top",
      pageId: String(raw.pageId ?? raw.page_id ?? ""),
      pageLabel: String(raw.pageLabel ?? raw.page_label ?? ""),
    };
  }
  if (kind === "question") {
    return {
      kind: "question",
      pageId: String(raw.pageId ?? raw.page_id ?? ""),
      pageLabel: String(raw.pageLabel ?? raw.page_label ?? ""),
      targetRef: String(raw.targetRef ?? raw.target_ref ?? ""),
      targetLabel: String(raw.targetLabel ?? raw.target_label ?? ""),
    };
  }
  if (kind === "end") return { kind: "end" };
  return { kind: "none" };
}

export async function apiXlsformEditorExport(
  workbook: XlsformEditorWorkbook,
  filename?: string,
  source?: XlsformEditorPayload["source"] | null,
  options?: { include_app_columns?: boolean },
) {
  const safeSource = normalizeXlsformFormSource(source);
  return handle<{
    ok: true;
    file_id: string;
    original_name: string;
    size: number;
  }>(
    await apiFetch("/api/xlsform-editor/export", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ workbook, filename, source: safeSource, options }),
    })
  );
}

export async function apiXlsformEditorExportPdf(
  workbook: XlsformEditorWorkbook,
  filename?: string,
  options: {
    title?: string;
    footer_title?: string;
    columns?: 1 | 2;
    logic_language?: "saltos" | "condiciones";
    show_questionnaire_number?: boolean;
    matrix_layout?: "full" | "column";
    consent_var?: string;
    matrix_groups?: Array<{ members: string[]; tenor?: string; special?: string; header?: string }>;
  } = {},
) {
  return handle<{
    ok: true;
    file_id: string;
    original_name: string;
    size: number;
    summary: {
      n_blocks: number;
      n_questions: number;
      n_sections: number;
      n_matrices: number;
    };
    warnings: string[];
  }>(
    await apiFetch("/api/xlsform-editor/export-pdf", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ workbook, filename, options }),
    })
  );
}

/**
 * Exporta el MISMO cuestionario en formato Word (.docx). Reutiliza el mismo
 * modelo que el PDF en el backend (build_model compartido), así que acepta las
 * mismas `options`. Devuelve un file_id descargable/registrable como entregable.
 */
export async function apiXlsformEditorExportWord(
  workbook: XlsformEditorWorkbook,
  filename?: string,
  options: {
    title?: string;
    footer_title?: string;
    columns?: 1 | 2;
    logic_language?: "saltos" | "condiciones";
    show_questionnaire_number?: boolean;
    show_header_title?: boolean;
    matrix_layout?: "full" | "column";
    consent_var?: string;
    matrix_groups?: Array<{ members: string[]; tenor?: string; special?: string; header?: string }>;
  } = {},
) {
  return handle<{
    ok: true;
    file_id: string;
    original_name: string;
    size: number;
    summary: {
      n_blocks: number;
      n_questions: number;
      n_sections: number;
      n_matrices: number;
    };
    warnings: string[];
  }>(
    await apiFetch("/api/xlsform-editor/export-word", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ workbook, filename, options }),
    })
  );
}

/**
 * Diagnostic estructural devuelto por el validador de R. La forma coincide
 * con `BuilderDiagnostic` del frontend para que el badge pueda renderizarlos
 * directo, sin transformación. `rowIndex` y `catalogName` son opcionales.
 */
export type XlsformEditorRemoteDiagnostic = {
  id: string;
  level: "warn" | "info";
  title: string;
  detail: string;
  rowIndex?: number;
  catalogName?: string;
};

/**
 * Llama al validador estructural en R. El frontend lo invoca debounced
 * (~1 s después de la última edición) para refrescar diagnostics que
 * conviene calcular en R (balance de begin/end, integridad de catálogos,
 * regex de form_id, etc.).
 */
export async function apiXlsformEditorValidate(workbook: XlsformEditorWorkbook) {
  return handle<{
    ok: true;
    diagnostics: XlsformEditorRemoteDiagnostic[];
    count: number;
  }>(
    await apiFetch("/api/xlsform-editor/validate", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ workbook }),
    })
  );
}

export async function apiCargaInstrumento(file_id: string) {
  return handle<{
    ok: true;
    resumen: {
      n_preguntas: number;
      n_calculos?: number;
      n_notas?: number;
      n_filas_survey?: number;
      n_secciones: number;
      secciones: string[];
      n_listas_opciones: number;
    };
  }>(
    await apiFetch("/api/carga/instrumento", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    })
  );
}

export type Seccion = {
  name: string;
  label: string;
  is_repeat: boolean;
  is_conditional: boolean;
  relevant: string | null;
  prefix: string;
  // Grupos repetibles: expresión `repeat_count` cruda (p.ej. `count-selected(${services})`)
  // y las variables que la gobiernan (["services"]). Ausente en instrumentos viejos.
  repeat_count?: string | null;
  repeat_count_vars?: string[];
};

export type Pregunta = {
  row_index?: number;
  name: string;
  label: string;
  hint?: string;
  appearance?: string;
  tipo: string;
  type_raw?: string;
  list_name?: string;
  seccion: string;
  required: boolean;
  relevant: boolean;
  constraint: boolean;
  calculate: boolean;
  choice_filter?: boolean;
  relevant_expr?: string | null;
  constraint_expr?: string | null;
  calculation_expr?: string | null;
  choice_filter_expr?: string | null;
  choices?: Array<{ name: string; label: string }>;
};

export async function apiInstrumentoEstructura(base?: string) {
  const trimmed = (base ?? "").trim();
  const qs = trimmed ? `?base=${encodeURIComponent(trimmed)}` : "";
  return handle<{ secciones: Seccion[]; preguntas: Pregunta[] }>(
    await apiFetch(`/api/carga/instrumento/estructura${qs}`, { headers: headers() })
  );
}

export type ChoiceCodeMapItem = {
  source_code: string;
  source_column: string;
  source_label: string;
  xls_code: string;
  xls_label: string;
  match: string;
};

export type ChoiceCodeMap = {
  variable: string;
  label: string;
  type: string;
  list_name: string;
  status: string;
  high_confidence: boolean;
  requires_confirmation: boolean;
  mappings: ChoiceCodeMapItem[];
};

export type ChoiceCodeMapReview = {
  applied: boolean;
  requires_confirmation: boolean;
  n_questions: number;
  maps: ChoiceCodeMap[];
};

export async function apiCargaData(file_id: string) {
  return handle<{
    ok: true;
    preview: {
      n_filas: number;
      n_columnas: number;
      columnas: { nombre: string; tipo: string; origen?: "xlsform" | "extra" }[];
      normalizacion?: {
        applied: boolean;
        aliases: number;
        select_multiple: number;
        single_child_collapses?: number;
        dropped_columns: number;
        xlsform_columns?: number;
        extra_columns?: number;
        alias_columns?: Record<string, string>;
        select_multiple_columns?: Record<string, string[]>;
        single_child_collapse_columns?: Record<string, string>;
        choice_code_maps?: ChoiceCodeMapReview;
      };
      compatibilidad?: {
        applied: boolean;
        ok: boolean | null;
        status: string;
        expected_columns?: number;
        matched_columns: number;
        missing_columns: string[];
        extra_columns: string[];
        n_missing?: number;
        n_extra?: number;
        message: string;
      };
      preview_filas: Record<string, unknown>[];
    };
  }>(
    await apiFetch("/api/carga/data", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    })
  );
}

export type CargaUniverseFilterConfig = {
  version: 1;
  enabled: boolean;
  variable: string;
  real_values: string[];
  test_values: string[];
  missing_policy: "exclude";
  unassigned_policy: "unclassified";
};

export type CargaUniverseVariable = {
  variable: string;
  type?: string | null;
  n_distinct?: number;
};

export type CargaUniverseObservedValue = {
  value: string;
  count: number;
  missing?: boolean;
};

export type CargaUniverseSummary = {
  total: number;
  included: number;
  excluded_test: number;
  excluded_unclassified: number;
};

export type CargaUniverseFilterState = {
  ok: true;
  base_nombre: string | null;
  config: CargaUniverseFilterConfig;
  summary: CargaUniverseSummary | null;
  variable_inventory: CargaUniverseVariable[];
  observed_values: CargaUniverseObservedValue[];
  inherited_from?: string | null;
  read_only?: boolean;
  applied_at?: string | null;
  warnings?: string[];
};

export type CargaUniverseFilterPreview = {
  ok: true;
  base_nombre: string | null;
  config?: CargaUniverseFilterConfig;
  summary: CargaUniverseSummary;
  observed_values: CargaUniverseObservedValue[];
  warnings?: string[];
};

function cargaUniverseFilterQuery(baseNombre?: string | null) {
  const trimmed = String(baseNombre ?? "").trim();
  return trimmed ? `?base_nombre=${encodeURIComponent(trimmed)}` : "";
}

export async function apiCargaUniverseFilterGet(baseNombre?: string | null) {
  return handle<CargaUniverseFilterState>(
    await apiFetch(`/api/carga/universe-filter${cargaUniverseFilterQuery(baseNombre)}`, {
      headers: headers(),
    }),
  );
}

export async function apiCargaUniverseFilterPreview(
  config: CargaUniverseFilterConfig,
  baseNombre?: string | null,
) {
  return handle<CargaUniverseFilterPreview>(
    await apiFetch("/api/carga/universe-filter/preview", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        base_nombre: String(baseNombre ?? "").trim() || null,
        config,
      }),
    }),
  );
}

export async function apiCargaUniverseFilterApply(
  config: CargaUniverseFilterConfig,
  baseNombre?: string | null,
) {
  return handle<CargaUniverseFilterState>(
    await apiFetch("/api/carga/universe-filter", {
      method: "PUT",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        base_nombre: String(baseNombre ?? "").trim() || null,
        config,
      }),
    }),
  );
}

export type CargaPlatformProvider = "surveymonkey" | "kobo";

export type KoboSourceSpec = {
  asset_uid: string;
  base_url: string;
  connection_profile_id: string;
  version_id: string;
  date_modified: string;
  deployment_active: boolean;
  total_remote: number;
  imported_at: string;
  xlsform_file_id: string;
  data_file_id: string;
  source_title?: string;
  source_alias?: string;
};

export type KoboIndependentAssetInput = {
  asset_uid: string;
  title?: string;
  name?: string;
  label?: string;
  source_alias?: string;
  source_title?: string;
  source_channel?: string;
  channel?: string;
  collection_strategy?: string;
  base_url?: string;
  connection_profile_id?: string;
};

export type CargaPlatformImportResult = {
  ok: true;
  provider: CargaPlatformProvider;
  xlsform_file_id: string;
  data_file_id: string;
  source: Record<string, unknown> | KoboSourceSpec;
  resumen: Awaited<ReturnType<typeof apiCargaInstrumento>>["resumen"];
  preview: Awaited<ReturnType<typeof apiCargaData>>["preview"];
  estudio?: EstudioPayload | null;
};

export async function apiCargaImportSurveyMonkey(payload: {
  survey_id: string;
  title?: string;
  base_url?: string;
  connection_profile_id?: string;
  source_alias?: string;
  source_channel?: string;
  response_statuses?: string[];
  keep_missing_status?: boolean;
}): Promise<CargaPlatformImportResult> {
  return handle<CargaPlatformImportResult>(
    await apiFetch("/api/carga/platform/surveymonkey/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiCargaImportKobo(payload: {
  asset_uid: string;
  title?: string;
  base_url?: string;
  connection_profile_id?: string;
}): Promise<CargaPlatformImportResult> {
  return handle<CargaPlatformImportResult>(
    await apiFetch("/api/carga/platform/kobo/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiCargaImportKoboIndependent(payload: {
  assets: KoboIndependentAssetInput[];
}) {
  return handle<{
    ok: true;
    provider: "kobo";
    processing_mode: "independent_siblings";
    active_base: string | null;
    bases: EstudioBase[];
    n_bases: number;
    estudio: EstudioPayload;
    xlsform_logic_sync?: EstudioLogicSyncResult | null;
  }>(
    await apiFetch("/api/carga/platform/kobo/import-independent", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export type KoboIndependentRefreshResult = {
  ok: true;
  provider: "kobo";
  processing_mode: "independent_siblings";
  active_base: string | null;
  results: Array<{
    ok: true;
    base_name: string;
    asset_uid: string;
    rows_before: number;
    rows_after: number;
    total_remote: number;
    xlsform_file_id: string;
    data_file_id: string;
    refreshed_at: string;
  }>;
  updated_bases: string[];
  n_updated_bases: number;
  bases?: EstudioBase[];
  estudio: EstudioPayload;
  message?: string;
};

export async function apiCargaRefreshKoboIndependent(payload: {
  base_names?: string[];
  bases?: Array<string | { base_name?: string; nombre?: string; name?: string }>;
} = {}) {
  return handle<KoboIndependentRefreshResult>(
    await apiFetch("/api/carga/platform/kobo/refresh-independent", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export function normalizeKoboAssets(raw: unknown) {
  const r = (raw ?? {}) as Record<string, unknown>;
  const arr = Array.isArray(r.assets) ? r.assets as Record<string, unknown>[] : [];
  return {
    ok: true as const,
    count: Number(r.count ?? arr.length),
    assets: arr
      .map((item): MonitoreoKoboAssetItem => ({
        uid: String(item.uid ?? ""),
        name: String(item.name ?? item.uid ?? ""),
        version_id: item.version_id == null || item.version_id === "NA" ? "" : String(item.version_id),
        date_modified: item.date_modified == null || item.date_modified === "NA" ? null : String(item.date_modified),
        deployment_active: item.deployment_active === true,
      }))
      .filter((item) => item.uid),
  };
}

export async function apiCargaKoboAssets(
  base_url = "https://kf.kobotoolbox.org",
  limit = 100,
  options: { profile_id?: string; connection_profile_id?: string } = {},
) {
  const raw = await handle<unknown>(
    await apiFetch("/api/carga/platform/kobo/assets", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        base_url,
        limit,
        profile_id: options.profile_id ?? options.connection_profile_id ?? "",
      }),
    }),
  );
  return normalizeKoboAssets(raw);
}

export async function apiCargaKoboDetectedSource() {
  return handle<(KoboSourceSpec & {
    ok: true;
    detected: true;
    provider: "kobo";
    phase: string;
    name: string;
  }) | {
    ok: false;
    detected: false;
  }>(
    await apiFetch("/api/carga/platform/kobo/detected-source", {
      headers: headers(),
    }),
  );
}

export type CargaMonitoreoHandoffValidity =
  | "validation_status"
  | "status_var"
  | "status_candidate"
  | "all_rows"
  | "";

export type CargaMonitoreoHandoffSource = {
  source_id: string;
  label: string;
  kind: string;
  kobo_asset_uid: string;
  validity: CargaMonitoreoHandoffValidity | string;
  counts: { processable: number; total: number };
};

export type CargaMonitoreoHandoffStatus = {
  ok: true;
  detected: boolean;
  // "processable" (territorial) o "source" (general multi-fuente).
  universe: "processable" | "source" | string;
  counts: {
    processable: number;
    validada: number;
    revision: number;
    no_defendible: number;
    total: number;
  };
  source: {
    label: string;
    phase: string;
    kobo_asset_uid: string;
    // Camino general: fuente promovida y como se resolvio "valido".
    kind?: string;
    source_id?: string;
    validity?: CargaMonitoreoHandoffValidity | string;
    status_column?: string;
    // El instrumento de procesamiento SIEMPRE es local (subido por el usuario),
    // nunca de la API de Kobo. "needs_upload" = falta el XLSForm local y la UI
    // debe ofrecer subirlo. "local" = disponible. "none" = no aplica.
    instrument_source: "local" | "needs_upload" | "none";
    // TRUE solo cuando instrument_source === "local".
    instrument_available: boolean;
    // TRUE cuando falta el XLSForm local y la UI debe ofrecer subirlo.
    instrument_needs_upload: boolean;
  };
  // Fuentes promovibles del snapshot (camino general); vacio en territorial.
  sources?: CargaMonitoreoHandoffSource[];
  already_promoted: boolean;
  existing_base:
    | { present: false }
    | {
        present: true;
        nombre: string;
        source_kind: string;
        is_territorial: boolean;
        n_filas: number;
      };
  base_nombre_sugerido: string;
};

export async function apiCargaMonitoreoHandoffStatus() {
  return handle<CargaMonitoreoHandoffStatus>(
    await apiFetch("/api/carga/monitoreo-handoff/status", {
      headers: headers(),
    }),
  );
}

export async function apiCargaMonitoreoHandoffPromote(
  payload: { universe?: string; base_nombre?: string; source_id?: string } = {},
) {
  const sourceId = payload.source_id?.trim();
  return handle<MonitoreoProcessingHandoffPromoteResult>(
    await apiFetch("/api/carga/monitoreo-handoff/promote", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        ...(payload.universe ? { universe: payload.universe } : {}),
        ...(payload.base_nombre ? { base_nombre: payload.base_nombre } : {}),
        ...(sourceId ? { source_id: sourceId } : {}),
      }),
    }),
  );
}

// ── Plan de ingreso de instrumentos publicados ─────────────────────────────
// Este estado vive antes de `s$estudio`: fija qué revisión inmutable corresponde
// a cada actor, pero no crea bases incompletas. `status` y los diagnósticos son
// siempre proyecciones del servidor; el cliente solo guarda las identidades y
// etiquetas editables mediante revisión optimista.
export type ProcessingIntakeStatus =
  | "instrument_ready"
  | "data_preview_ready"
  | "blocked"
  | "materialized"
  | "stale";

export type ProcessingIntakeBindingInput = {
  entry_id: string;
  /** Clave técnica inmutable del destino; nunca es el nombre visible. */
  base: string;
  base_label: string;
  actor_key: string;
  actor: string;
  instrument_revision_id: string;
};

export type ProcessingIntakeEntry = ProcessingIntakeBindingInput & {
  status: ProcessingIntakeStatus;
  form_id: string;
  latest_revision_id: string;
  blocking_reasons: ProcessingIntakeBlockingReason[];
};

export type ProcessingIntakeRevision = XlsformInstrumentRevision & {
  form_name: string;
  source_label: string;
  /** Procedencia congelada al publicar; actor_key nunca se infiere del nombre. */
  source: XlsformFormSource | null;
  is_latest: boolean;
  available: boolean;
  blocking_reasons: ProcessingIntakeBlockingReason[];
};

export type ProcessingIntakeBlockingReason = {
  code: string;
  message: string;
};

export type ProcessingIntakeValidationIssue = {
  code: string;
  message: string;
  entry_id: string;
};

export type ProcessingIntakeValidation = {
  valid: boolean;
  blockers: ProcessingIntakeValidationIssue[];
  warnings: ProcessingIntakeValidationIssue[];
  entries: ProcessingIntakeEntry[];
  max_entries: number;
};

export type ProcessingIntakePlan = {
  schema: "processing_intake/v1" | string;
  processing_mode: "independent_siblings" | string;
  family_id: string;
  revision: number;
  entries: ProcessingIntakeEntry[];
};

export type ProcessingIntakePayload = {
  ok: true;
  intake: ProcessingIntakePlan;
  revisions: ProcessingIntakeRevision[];
  validation: ProcessingIntakeValidation;
};

function processingIntakeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function processingIntakeArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>);
  return [];
}

function processingIntakeString(value: unknown): string {
  return typeof value === "string" && value !== "NA" ? value : "";
}

function normalizeProcessingIntakeStatus(value: unknown): ProcessingIntakeStatus {
  if (
    value === "instrument_ready"
    || value === "data_preview_ready"
    || value === "materialized"
    || value === "stale"
  ) return value;
  return "blocked";
}

function normalizeProcessingIntakeBlockingReason(value: unknown): ProcessingIntakeBlockingReason | null {
  if (typeof value === "string" && value.trim()) {
    return { code: "E_PROCESSING_INTAKE_BLOCKED", message: value.trim() };
  }
  const row = processingIntakeRecord(value);
  const message = processingIntakeString(row.message) || processingIntakeString(row.detail);
  if (!message) return null;
  return {
    code: processingIntakeString(row.code) || "E_PROCESSING_INTAKE_BLOCKED",
    message,
  };
}

function normalizeProcessingIntakeBinding(value: unknown): ProcessingIntakeEntry | null {
  const row = processingIntakeRecord(value);
  const entryId = processingIntakeString(row.entry_id);
  const base = processingIntakeString(row.base);
  const actorKey = processingIntakeString(row.actor_key);
  if (!entryId || !base || !actorKey) return null;
  return {
    entry_id: entryId,
    base,
    base_label: processingIntakeString(row.base_label) || base,
    actor_key: actorKey,
    actor: processingIntakeString(row.actor) || actorKey,
    instrument_revision_id: processingIntakeString(row.instrument_revision_id),
    status: normalizeProcessingIntakeStatus(row.status),
    form_id: processingIntakeString(row.form_id),
    latest_revision_id: processingIntakeString(row.latest_revision_id),
    blocking_reasons: processingIntakeArray(row.blocking_reasons)
      .map(normalizeProcessingIntakeBlockingReason)
      .filter((reason): reason is ProcessingIntakeBlockingReason => reason != null),
  };
}

function normalizeProcessingIntakeRevision(value: unknown): ProcessingIntakeRevision | null {
  const row = processingIntakeRecord(value);
  const revision = normalizeInstrumentRevision(row);
  if (!revision) return null;
  return {
    ...revision,
    form_name: processingIntakeString(row.form_name) || processingIntakeString(row.name),
    source_label: processingIntakeString(row.source_label),
    source: normalizeXlsformFormSource(row.source),
    is_latest: row.is_latest === true || row.latest === true,
    available: row.available !== false,
    blocking_reasons: processingIntakeArray(row.blocking_reasons)
      .map(normalizeProcessingIntakeBlockingReason)
      .filter((reason): reason is ProcessingIntakeBlockingReason => reason != null),
  };
}

function normalizeProcessingIntakeIssue(value: unknown): ProcessingIntakeValidationIssue | null {
  if (typeof value === "string") {
    return { code: "E_PROCESSING_INTAKE_INVALID", message: value, entry_id: "" };
  }
  const row = processingIntakeRecord(value);
  const message = processingIntakeString(row.message) || processingIntakeString(row.detail);
  if (!message) return null;
  return {
    code: processingIntakeString(row.code) || "E_PROCESSING_INTAKE_INVALID",
    message,
    entry_id: processingIntakeString(row.entry_id),
  };
}

export function normalizeProcessingIntakePayload(value: unknown): ProcessingIntakePayload {
  const root = processingIntakeRecord(value);
  const intake = processingIntakeRecord(root.intake);
  const validation = processingIntakeRecord(root.validation);
  const entries = processingIntakeArray(intake.entries)
    .map(normalizeProcessingIntakeBinding)
    .filter((entry): entry is ProcessingIntakeEntry => entry != null);
  const revisions = processingIntakeArray(root.revisions)
    .map(normalizeProcessingIntakeRevision)
    .filter((revision): revision is ProcessingIntakeRevision => revision != null);
  const blockers = processingIntakeArray(validation.blockers)
    .map(normalizeProcessingIntakeIssue)
    .filter((issue): issue is ProcessingIntakeValidationIssue => issue != null);
  const warnings = processingIntakeArray(validation.warnings)
    .map(normalizeProcessingIntakeIssue)
    .filter((issue): issue is ProcessingIntakeValidationIssue => issue != null);
  const validatedEntries = processingIntakeArray(validation.entries)
    .map(normalizeProcessingIntakeBinding)
    .filter((entry): entry is ProcessingIntakeEntry => entry != null);
  const revision = Number(intake.revision);
  const maxEntries = Number(validation.max_entries);
  return {
    ok: true,
    intake: {
      schema: processingIntakeString(intake.schema) || "processing_intake/v1",
      processing_mode: processingIntakeString(intake.processing_mode) || "independent_siblings",
      family_id: processingIntakeString(intake.family_id),
      revision: Number.isFinite(revision) ? revision : 0,
      entries,
    },
    revisions,
    validation: {
      valid: typeof validation.valid === "boolean" ? validation.valid : blockers.length === 0,
      blockers,
      warnings,
      entries: validatedEntries,
      max_entries: Number.isFinite(maxEntries) ? maxEntries : 10,
    },
  };
}

function processingIntakeWireEntries(entries: ProcessingIntakeBindingInput[]) {
  return entries.map((entry) => ({
    entry_id: entry.entry_id,
    base: entry.base,
    base_label: entry.base_label,
    actor_key: entry.actor_key,
    actor: entry.actor,
    instrument_revision_id: entry.instrument_revision_id,
  }));
}

export async function apiCargaProcessingIntake(): Promise<ProcessingIntakePayload> {
  const raw = await handle<unknown>(
    await apiFetch("/api/carga/processing-intake", { headers: headers() }),
  );
  return normalizeProcessingIntakePayload(raw);
}

export async function apiCargaProcessingIntakeSave(payload: {
  expected_revision: number;
  entries: ProcessingIntakeBindingInput[];
}): Promise<ProcessingIntakePayload> {
  const raw = await handle<unknown>(
    await apiFetch("/api/carga/processing-intake", {
      method: "PUT",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        expected_revision: payload.expected_revision,
        entries: processingIntakeWireEntries(payload.entries),
      }),
    }),
  );
  return normalizeProcessingIntakePayload(raw);
}

export async function apiCargaProcessingIntakeValidate(payload: {
  expected_revision: number;
  entries: ProcessingIntakeBindingInput[];
}): Promise<ProcessingIntakePayload> {
  const raw = await handle<unknown>(
    await apiFetch("/api/carga/processing-intake/validate", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        expected_revision: payload.expected_revision,
        entries: processingIntakeWireEntries(payload.entries),
      }),
    }),
  );
  return normalizeProcessingIntakePayload(raw);
}

// ── Handoff batch de acreditación desde Monitoreo ──────────────────────────
// El preview fija el intake y el cache persistido de Monitoreo. La promoción
// reutiliza esos pins y crea/reemplaza el lote completo; nunca una base aislada.
export type AcreditacionBatchPins = {
  intake_revision: number;
  family_id: string;
  cache_token: string;
  preview_fingerprint: string;
};

export type AcreditacionBatchEntry = {
  entry_id: string;
  base: string;
  base_label: string;
  actor_key: string;
  actor: string;
  instrument_revision_id: string;
  selected: number;
  excluded: number;
  status: "ready" | "blocked" | "already_materialized" | string;
  compatibility: {
    ok: boolean;
    message: string;
    missing_columns: string[];
    extra_columns: string[];
  };
  extras: Array<{ name: string; fill_pct: number; n_fill: number; kind: string }>;
  extras_checksum: string;
  blocking_reasons: ProcessingIntakeBlockingReason[];
};

export type AcreditacionBatchPreview = {
  ok: true;
  schema: "accreditation_processing_batch/v1" | string;
  detected: boolean;
  ready: boolean;
  replacement_required: boolean;
  already_materialized: boolean;
  pins: AcreditacionBatchPins;
  totals: { selected: number; excluded: number; total_rollup: number };
  entries: AcreditacionBatchEntry[];
  blockers: ProcessingIntakeBlockingReason[];
};

export type AcreditacionBatchPromoteResult = {
  ok: true;
  promoted: boolean;
  already_materialized: boolean;
  batch_id: string;
  base_names: string[];
  counts: Record<string, number>;
  estudio: EstudioPayload;
};

export async function apiCargaAcreditacionBatchPreview(): Promise<AcreditacionBatchPreview> {
  return handle<AcreditacionBatchPreview>(
    await apiFetch("/api/carga/monitoreo-handoff/preview-batch", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: "{}",
    }),
  );
}

export async function apiCargaAcreditacionBatchPromote(
  pins: AcreditacionBatchPins,
  confirmReplacement = false,
): Promise<AcreditacionBatchPromoteResult> {
  return handle<AcreditacionBatchPromoteResult>(
    await apiFetch("/api/carga/monitoreo-handoff/promote-batch", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        expected_intake_revision: pins.intake_revision,
        expected_family_id: pins.family_id,
        expected_cache_token: pins.cache_token,
        preview_fingerprint: pins.preview_fingerprint,
        confirm_replacement: confirmReplacement,
      }),
    }),
  );
}

// ── Aprobacion metodologica independiente por base ────────────────────────
export type ProcessingReleaseStatus = "pending" | "ready" | "approved" | "stale" | string;

export type ProcessingReleaseBlocker = {
  code: string;
  message: string;
};

export type ProcessingReleaseEntry = {
  base: string;
  base_label: string;
  actor: string;
  entry_id: string;
  family_id: string;
  instrument_revision_id: string;
  status: ProcessingReleaseStatus;
  ready: boolean;
  approved: boolean;
  input_fingerprint: string;
  blockers: ProcessingReleaseBlocker[];
  pins: Record<string, unknown>;
  release: null | {
    schema: "processing_release/v1" | string;
    release_id: string;
    processing_intake_entry_id: string;
    input_fingerprint: string;
    approved_at: string;
  };
};

export type ProcessingReleaseCatalog = {
  ok: true;
  schema: "processing_release_catalog/v1" | string;
  detected: boolean;
  family_id: string;
  active_base: string;
  all_approved: boolean;
  entries: ProcessingReleaseEntry[];
};

export async function apiProcessingReleases(): Promise<ProcessingReleaseCatalog> {
  return handle<ProcessingReleaseCatalog>(
    await apiFetch("/api/processing/releases", { headers: headers() }),
  );
}

export async function apiProcessingReleaseApprove(payload: {
  base: string;
  expected_input_fingerprint: string;
}): Promise<ProcessingReleaseCatalog> {
  return handle<ProcessingReleaseCatalog>(
    await apiFetch("/api/processing/releases/approve", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

// ── Revisión autoritativa de Carga ──────────────────────────────────────────
// Esta superficie reemplaza la lectura implícita de `active_base`: tanto la
// consulta como la persistencia reciben la misma base de manera explícita.
export type CargaReviewCompatibility = {
  applied: boolean;
  ok: boolean;
  status: string;
  missing_columns: string[];
  extra_columns: string[];
  matched_columns: number;
  expected_columns: number;
  n_missing: number;
  n_extra: number;
  message: string;
};

export type CargaReviewChoiceMapping = {
  status: string;
  pending: boolean;
  applied: boolean;
  requires_confirmation: boolean;
  n_questions: number;
  maps: ChoiceCodeMap[];
};

export type CargaReviewReconciliationExtra = {
  name: string;
  fill_pct: number;
  n_fill: number;
  kind: "con_datos" | "vacia";
  incluida: boolean;
  decision: string;
};

export type CargaReviewReconciliation = {
  extra: CargaReviewReconciliationExtra[];
  n_extra: number;
  n_incluidas: number;
  n_excluidas: number;
  n_pendientes: number;
  reviewed: boolean;
};

export type CargaReviewPayload = {
  ok: true;
  base_nombre: string | null;
  compatibility: CargaReviewCompatibility;
  choice_mapping: CargaReviewChoiceMapping;
  reconciliation: CargaReviewReconciliation;
  ready: boolean;
};

function reviewBoolean(value: unknown): boolean {
  if (value === true || value === 1 || value === "1" || value === "true") return true;
  return false;
}

function reviewStrings(value: unknown): string[] {
  return normalizeShareArray<unknown>(value)
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeCargaReviewChoiceMaps(value: unknown): ChoiceCodeMap[] {
  return normalizeShareArray<unknown>(value)
    .map((entry) => reconRecord(entry))
    .filter((entry) => typeof entry.variable === "string" && entry.variable.trim().length > 0)
    .map((entry): ChoiceCodeMap => ({
      variable: String(entry.variable).trim(),
      label: typeof entry.label === "string" ? entry.label : "",
      type: typeof entry.type === "string" ? entry.type : "",
      list_name: typeof entry.list_name === "string" ? entry.list_name : "",
      status: typeof entry.status === "string" ? entry.status : "unknown",
      high_confidence: reviewBoolean(entry.high_confidence),
      requires_confirmation: reviewBoolean(entry.requires_confirmation),
      mappings: normalizeShareArray<unknown>(entry.mappings)
        .map((mapping) => reconRecord(mapping))
        .filter((mapping) => typeof mapping.source_code === "string")
        .map((mapping) => ({
          source_code: String(mapping.source_code),
          source_column: typeof mapping.source_column === "string" ? mapping.source_column : "",
          source_label: typeof mapping.source_label === "string" ? mapping.source_label : "",
          xls_code: typeof mapping.xls_code === "string" ? mapping.xls_code : "",
          xls_label: typeof mapping.xls_label === "string" ? mapping.xls_label : "",
          match: typeof mapping.match === "string" ? mapping.match : "",
        })),
    }));
}

function normalizeCargaReviewPayload(raw: unknown): CargaReviewPayload {
  const root = reconRecord(raw);
  const rawCompatibility = reconRecord(root.compatibility);
  const rawChoiceMapping = reconRecord(root.choice_mapping);
  const rawReconciliation = reconRecord(root.reconciliation);
  const extra = normalizeShareArray<unknown>(rawReconciliation.extra)
    .map((entry) => reconRecord(entry))
    .filter((entry) => typeof entry.name === "string" && entry.name.trim().length > 0)
    .map((entry): CargaReviewReconciliationExtra => {
      const decision = typeof entry.decision === "string" ? entry.decision : "";
      return {
        name: String(entry.name).trim(),
        fill_pct: reconNumber(entry.fill_pct),
        n_fill: reconNumber(entry.n_fill),
        kind: entry.kind === "vacia" ? "vacia" : "con_datos",
        incluida: reviewBoolean(entry.incluida) || decision === "include",
        decision,
      };
    });
  const missingColumns = reviewStrings(rawCompatibility.missing_columns);
  const extraColumns = reviewStrings(rawCompatibility.extra_columns);
  const choiceMappingStatus = typeof rawChoiceMapping.status === "string"
    ? rawChoiceMapping.status
    : "unknown";
  const choiceMaps = normalizeCargaReviewChoiceMaps(rawChoiceMapping.maps);
  const choiceIsConfirmed = choiceMappingStatus === "confirmed";
  const choiceRequiresConfirmation = !choiceIsConfirmed && (
    reviewBoolean(rawChoiceMapping.requires_confirmation)
    || choiceMaps.some((map) => map.requires_confirmation)
  );

  const compatibility: CargaReviewCompatibility = {
    applied: reviewBoolean(rawCompatibility.applied),
    ok: reviewBoolean(rawCompatibility.ok),
    status: typeof rawCompatibility.status === "string" ? rawCompatibility.status : "unknown",
    missing_columns: missingColumns,
    extra_columns: extraColumns,
    matched_columns: reconNumber(rawCompatibility.matched_columns),
    expected_columns: reconNumber(rawCompatibility.expected_columns),
    n_missing: reconNumber(rawCompatibility.n_missing, missingColumns.length),
    n_extra: reconNumber(rawCompatibility.n_extra, extraColumns.length),
    message: typeof rawCompatibility.message === "string" ? rawCompatibility.message : "",
  };
  const choiceMapping: CargaReviewChoiceMapping = {
    status: choiceMappingStatus,
    pending: reviewBoolean(rawChoiceMapping.pending)
      || choiceMappingStatus === "pending"
      || choiceMappingStatus === "requires_confirmation"
      || choiceRequiresConfirmation,
    applied: reviewBoolean(rawChoiceMapping.applied),
    requires_confirmation: choiceRequiresConfirmation,
    n_questions: reconNumber(rawChoiceMapping.n_questions, choiceMaps.length),
    maps: choiceMaps,
  };
  const reconciliation: CargaReviewReconciliation = {
    extra,
    n_extra: reconNumber(rawReconciliation.n_extra, extra.length),
    n_incluidas: reconNumber(
      rawReconciliation.n_incluidas,
      extra.filter((entry) => entry.incluida).length,
    ),
    n_excluidas: reconNumber(
      rawReconciliation.n_excluidas,
      extra.filter((entry) => entry.decision === "exclude").length,
    ),
    n_pendientes: reconNumber(
      rawReconciliation.n_pendientes,
      extra.filter((entry) => entry.decision === "pending").length,
    ),
    reviewed: reviewBoolean(rawReconciliation.reviewed),
  };
  const incompatible = !compatibility.ok
    || compatibility.status === "incompatible"
    || compatibility.n_missing > 0;

  return {
    ok: true,
    base_nombre: typeof root.base_nombre === "string" && root.base_nombre.trim()
      ? root.base_nombre.trim()
      : null,
    compatibility,
    choice_mapping: choiceMapping,
    reconciliation,
    ready: reviewBoolean(root.ready)
      && !incompatible
      && !choiceMapping.pending
      && reconciliation.n_pendientes === 0,
  };
}

export async function apiCargaReview(
  baseNombre?: string | null,
): Promise<CargaReviewPayload> {
  const normalizedBase = baseNombre?.trim();
  const qs = normalizedBase
    ? `?${new URLSearchParams({ base_nombre: normalizedBase }).toString()}`
    : "";
  const raw = await handle<unknown>(
    await apiFetch(`/api/carga/review${qs}`, { headers: headers() }),
  );
  return normalizeCargaReviewPayload(raw);
}

export async function apiCargaReviewReconciliation(
  baseNombre: string | null,
  incluidas: string[],
): Promise<CargaReviewPayload> {
  const normalizedBase = baseNombre?.trim() || null;
  const raw = await handle<unknown>(
    await apiFetch("/api/carga/review/reconciliation", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ base_nombre: normalizedBase, incluidas }),
    }),
  );
  return normalizeCargaReviewPayload(raw);
}

export type CargaReviewSummaryItem = {
  base_nombre: string;
  ready: boolean;
  blockers: string[];
};

export type CargaReviewSummaryPayload = {
  bases: CargaReviewSummaryItem[];
  n_bases: number;
  n_ready: number;
  n_blocked: number;
  all_ready: boolean;
};

function normalizeCargaReviewSummary(raw: unknown): CargaReviewSummaryPayload {
  const root = reconRecord(raw);
  const bases = normalizeShareArray<unknown>(root.bases)
    .map((entry) => reconRecord(entry))
    .filter((entry) => typeof entry.base_nombre === "string" && entry.base_nombre.trim().length > 0)
    .map((entry): CargaReviewSummaryItem => {
      const blockers = reviewStrings(entry.blockers);
      return {
        base_nombre: String(entry.base_nombre).trim(),
        ready: reviewBoolean(entry.ready) && blockers.length === 0,
        blockers,
      };
    });
  const nBases = reconNumber(root.n_bases, bases.length);
  const nReady = reconNumber(root.n_ready, bases.filter((base) => base.ready).length);
  const nBlocked = reconNumber(root.n_blocked, bases.filter((base) => !base.ready).length);
  const actualReady = bases.filter((base) => base.ready).length;
  const actualBlocked = bases.length - actualReady;
  const countsCoherent = nBases === bases.length
    && nReady === actualReady
    && nBlocked === actualBlocked
    && nReady + nBlocked === nBases;

  return {
    bases,
    n_bases: nBases,
    n_ready: nReady,
    n_blocked: nBlocked,
    all_ready: reviewBoolean(root.all_ready)
      && nBases > 0
      && countsCoherent
      && bases.every((base) => base.ready),
  };
}

export async function apiCargaReviewSummary(): Promise<CargaReviewSummaryPayload> {
  const raw = await handle<unknown>(
    await apiFetch("/api/carga/review/summary", { headers: headers() }),
  );
  return normalizeCargaReviewSummary(raw);
}

// ── Reconciliación de variables data ↔ XLSForm ──────────────────────────────
// Cuando la data (upload manual o handoff de Monitoreo) trae variables que ya
// no existen en el XLSForm actual (típicamente de versiones viejas del
// formulario), el backend expone el diff aquí. La decisión de cuáles conservar
// persiste por base; por defecto todas las extra quedan excluidas de la BBDD.
export type ReconciliacionExtraKind = "con_datos" | "vacia";

export type ReconciliacionExtra = {
  name: string;
  fill_pct: number;
  n_fill: number;
  kind: ReconciliacionExtraKind;
  incluida: boolean;
};

export type ReconciliacionInfo = {
  ok: true;
  extra: ReconciliacionExtra[];
  n_extra: number;
  n_incluidas: number;
};

function reconRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function reconNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// Normalizador defensivo: el payload viene de R (fill_pct/n_fill pueden llegar
// como NA/null) y las decisiones alimentan la BBDD, así que blindamos tipos.
function normalizeReconciliacionInfo(raw: unknown): ReconciliacionInfo {
  const root = reconRecord(raw);
  const extra = normalizeShareArray<unknown>(root.extra).map((entry): ReconciliacionExtra => {
    const row = reconRecord(entry);
    return {
      name: String(row.name ?? ""),
      fill_pct: reconNumber(row.fill_pct),
      n_fill: reconNumber(row.n_fill),
      kind: row.kind === "vacia" ? "vacia" : "con_datos",
      incluida: Boolean(row.incluida),
    };
  });
  return {
    ok: true,
    extra,
    n_extra: reconNumber(root.n_extra, extra.length),
    n_incluidas: reconNumber(root.n_incluidas, extra.filter((e) => e.incluida).length),
  };
}

export async function apiAnaliticaReconciliacionGet(): Promise<ReconciliacionInfo> {
  const raw = await handle<unknown>(
    await apiFetch("/api/analitica/reconciliacion", { headers: headers() }),
  );
  return normalizeReconciliacionInfo(raw);
}

export async function apiAnaliticaReconciliacionSet(
  incluidas: string[],
): Promise<ReconciliacionInfo> {
  const raw = await handle<unknown>(
    await apiFetch("/api/analitica/reconciliacion", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ incluidas }),
    }),
  );
  return normalizeReconciliacionInfo(raw);
}

export async function apiCargaConfirmChoiceMapping(baseNombre?: string | null) {
  const normalizedBase = baseNombre?.trim() || null;
  return handle<{
    ok: true;
    confirmed: boolean;
    n_questions?: number;
    confirmed_at?: string;
    message?: string;
  }>(
    await apiFetch("/api/carga/choice-mapping/confirm", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ base_nombre: normalizedBase }),
    }),
  );
}

export type NormalizedExportFormat = "xlsx" | "csv" | "sav";

export async function apiCargaExportNormalized(
  format: NormalizedExportFormat = "xlsx",
  baseNombre?: string | null,
) {
  const qs = new URLSearchParams({ format });
  if (baseNombre) qs.set("base_nombre", baseNombre);
  return handle<{
    ok: true;
    file_id: string;
    size: number;
    original_name: string;
    format: string;
  }>(
    await apiFetch(`/api/carga/data/normalized-export?${qs.toString()}`, {
      headers: headers(),
    }),
  );
}

export type ProcessingSheetMode = "codigos" | "etiquetas";
export type ProcessingSheetTypeKind = "integer" | "sm" | "so" | "text" | "other";

export type ProcessingSheetCategory = { code: string; label: string; count: number };

export type ProcessingSheetColumn = {
  key: string;
  label: string;
  type: string;
  type_base: string;
  type_kind: ProcessingSheetTypeKind;
  source_type_base?: string | null;
  source_type_kind?: ProcessingSheetTypeKind | "" | null;
  coded: boolean;
  is_recoded?: boolean;
  raw_parent?: string | null;
  dummy_parent?: string | null;
  dummy_code?: string | null;
  categories?: ProcessingSheetCategory[] | null;
  value_min?: number | null;
  value_max?: number | null;
};

// Filtro por columna: string (substring, retrocompat) u objeto estructurado.
export type ProcessingSheetColumnFilter =
  | string
  | { op: "in"; values: string[] }
  | { op: "range"; min?: number | null; max?: number | null }
  | { op: "contains"; value: string };

export type ProcessingSheetPayload = {
  ok: true;
  source: "carga" | "analitica" | string;
  modo: ProcessingSheetMode;
  columns: ProcessingSheetColumn[];
  rows: Record<string, string>[];
  total: number;
  page: number;
  page_size: number;
  n_columns: number;
  coded: boolean;
};

export type ProcessingSheetRequest = {
  modo?: ProcessingSheetMode;
  page?: number;
  page_size?: number;
  pageSize?: number;
  search?: string;
  column_filters?: Record<string, ProcessingSheetColumnFilter>;
  columnFilters?: Record<string, ProcessingSheetColumnFilter>;
  sort?: { col: string; desc: boolean } | null;
  base_nombre?: string | null;
  baseNombre?: string | null;
};

export async function apiCargaBaseSheet(opts: ProcessingSheetRequest = {}) {
  return handle<ProcessingSheetPayload>(
    await apiFetch("/api/carga/base-sheet", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(opts),
    }),
  );
}

// Limpia el XLSForm cargado + todos los artefactos derivados
// (rp_inst, rp_data, validación, estudio). Deja la sesión viva pero
// vacía de insumos — el usuario puede cargar otro XLSForm.
export async function apiQuitarInstrumento() {
  return handle<{ ok: true }>(
    await apiFetch("/api/carga/instrumento", {
      method: "DELETE",
      headers: headers(),
    })
  );
}

// Limpia solo la base de datos cargada. El XLSForm se mantiene — es
// el caso común "probé con esta data, ahora quiero otra usando el
// mismo formulario". También resetea rp_data + validación.
export async function apiQuitarData() {
  return handle<{ ok: true }>(
    await apiFetch("/api/carga/data", {
      method: "DELETE",
      headers: headers(),
    })
  );
}

export type DemoMeta = {
  name: string;
  titulo_humano: string;
  descripcion: string;
  icono_ui: string;
  etiqueta_estudio: string;
  n_bases: number;  // 1 para demos single-base, >1 para multi-base (v0.2+)
};

export async function apiListDemos() {
  return handle<{ demos: DemoMeta[] }>(
    await apiFetch("/api/system/demos", { headers: headers() }),
  );
}

export async function apiLoadDemo(name?: string) {
  const url = name
    ? `/api/system/demo?name=${encodeURIComponent(name)}`
    : "/api/system/demo";
  return handle<{
    ok: true;
    session_id: string;
    demo_name: string;
    demo_titulo: string;
    n_bases: number;  // v0.2+: cuántas bases cargó (1 para single-base demos)
    bases: { nombre: string; n_filas: number; n_columnas: number }[];
    // Legacy (primera base, para back-compat con UI v0.1):
    resumen_instrumento: {
      n_preguntas: number;
      n_calculos?: number;
      n_notas?: number;
      n_filas_survey?: number;
      n_secciones: number;
      secciones: string[];
      n_listas_opciones: number;
    };
    n_filas: number;
    n_columnas: number;
  }>(await apiFetch(url, { method: "POST", headers: headers() }));
}

export async function apiShutdown() {
  return handle<{ ok: boolean; message: string }>(
    await apiFetch("/api/system/shutdown", { method: "POST", headers: headers() })
  );
}
