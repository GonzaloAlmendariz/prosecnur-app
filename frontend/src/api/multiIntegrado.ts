// multiIntegrado.ts — multi integrado genérico (instrumentos hermanos → una base).
// Extraído de client.ts (split por dominio, 2026-07). Los consumidores
// importan del barrel ./client; este módulo no cambia el contrato.

import { apiFetch, downloadFailedMessage, handle, headers } from "./core";
import type { EstudioBase, EstudioPayload } from "./estudio";
import type { MonitoreoSheetsConnectResult } from "./monitoreo";
import { type ChoiceCodeMap, normalizeSurveyMonkeyLogicState, normalizeXlsformFormSource } from "./xlsformEditor";

// ============================================================================
// Multi integrado generico: instrumentos hermanos -> una base + XLSForm comun
// ============================================================================

export type MultiIntegratedOrigin = {
  source_kind: "manual" | "surveymonkey";
  key_value: string;
  label?: string;
  xlsform_file_id?: string;
  data_file_id?: string;
  survey_id?: string;
};

export type MultiIntegratedDiff = {
  id: string;
  origin_id: string;
  source_kind: "manual" | "surveymonkey" | string;
  origin_key: string;
  ref_origin_id?: string;
  ref_origin_key?: string;
  variable: string;
  pos: number | null;
  kind: string;
  severity: "info" | "review" | "blocking" | string;
  message: string;
  ref: string;
  current: string;
  needs_decision: boolean;
  suggested_name: string;
  suggested_label: string;
};

export type MultiIntegratedAudit = {
  ok: boolean;
  origin_key_name: string;
  guide: { file_id: string; original_name: string };
  origins: Array<MultiIntegratedOrigin & { id: string }>;
  n_origins: number;
  n_pending: number;
  n_blocking: number;
  n_info: number;
  company_variables: string[];
  diffs: MultiIntegratedDiff[];
};

export type MultiIntegratedDecisions = {
  resolved_ids?: string[];
  label_overrides?: Record<string, string>;
  variant_names?: Record<string, string>;
};

export type MultiIntegratedDraft = {
  version?: number;
  source_mode?: "manual" | "surveymonkey";
  guide_xlsform_file_id?: string;
  guide_options?: Array<{ fileId?: string; file_id?: string; label?: string }>;
  guide_survey_id?: string;
  origin_key_name?: string;
  base_name?: string;
  query?: string;
  rows?: Array<MultiIntegratedOrigin & {
    localId?: string;
    local_id?: string;
    xlsformFileName?: string;
    xlsform_file_name?: string;
    dataFileName?: string;
    data_file_name?: string;
    surveyTitle?: string;
    survey_title?: string;
  }>;
  audit?: MultiIntegratedAudit | null;
  decisions?: MultiIntegratedDecisions;
  updated_at?: string;
};

function normalizeMultiIntegratedAudit(raw: unknown): MultiIntegratedAudit {
  const r = (raw ?? {}) as Record<string, unknown>;
  const diffsRaw = Array.isArray(r.diffs) ? r.diffs as Record<string, unknown>[] : [];
  const originsRaw = Array.isArray(r.origins) ? r.origins as Record<string, unknown>[] : [];
  return {
    ok: Boolean(r.ok),
    origin_key_name: String(r.origin_key_name ?? "origen"),
    guide: {
      file_id: String((r.guide as Record<string, unknown> | undefined)?.file_id ?? ""),
      original_name: String((r.guide as Record<string, unknown> | undefined)?.original_name ?? ""),
    },
    origins: originsRaw.map((o) => ({
      id: String(o.id ?? ""),
      source_kind: (String(o.source_kind ?? "manual") as "manual" | "surveymonkey"),
      key_value: String(o.key_value ?? ""),
      label: String(o.label ?? ""),
      xlsform_file_id: String(o.xlsform_file_id ?? ""),
      data_file_id: String(o.data_file_id ?? ""),
      survey_id: String(o.survey_id ?? ""),
    })),
    n_origins: Number(r.n_origins ?? originsRaw.length),
    n_pending: Number(r.n_pending ?? 0),
    n_blocking: Number(r.n_blocking ?? 0),
    n_info: Number(r.n_info ?? 0),
    company_variables: Array.isArray(r.company_variables) ? r.company_variables.map(String) : [],
    diffs: diffsRaw.map((d) => ({
      id: String(d.id ?? ""),
      origin_id: String(d.origin_id ?? ""),
      source_kind: String(d.source_kind ?? ""),
      origin_key: String(d.origin_key ?? ""),
      ref_origin_id: String(d.ref_origin_id ?? ""),
      ref_origin_key: String(d.ref_origin_key ?? ""),
      variable: String(d.variable ?? ""),
      pos: d.pos == null ? null : Number(d.pos),
      kind: String(d.kind ?? ""),
      severity: String(d.severity ?? "review"),
      message: String(d.message ?? ""),
      ref: String(d.ref ?? ""),
      current: String(d.current ?? ""),
      needs_decision: Boolean(d.needs_decision),
      suggested_name: String(d.suggested_name ?? ""),
      suggested_label: String(d.suggested_label ?? ""),
    })),
  };
}

function normalizeMultiIntegratedDraft(raw: unknown): MultiIntegratedDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const rowsRaw = Array.isArray(r.rows) ? r.rows as Record<string, unknown>[] : [];
  const guideOptionsRaw = Array.isArray(r.guide_options) ? r.guide_options as Record<string, unknown>[] : [];
  const audit = r.audit && typeof r.audit === "object" ? normalizeMultiIntegratedAudit(r.audit) : null;
  const decisionsRaw = (r.decisions ?? {}) as Record<string, unknown>;
  return {
    version: Number(r.version ?? 1),
    source_mode: String(r.source_mode ?? "manual") === "surveymonkey" ? "surveymonkey" : "manual",
    guide_xlsform_file_id: String(r.guide_xlsform_file_id ?? ""),
    guide_options: guideOptionsRaw.map((option) => ({
      fileId: String(option.fileId ?? option.file_id ?? ""),
      file_id: String(option.file_id ?? option.fileId ?? ""),
      label: String(option.label ?? ""),
    })),
    guide_survey_id: String(r.guide_survey_id ?? ""),
    origin_key_name: String(r.origin_key_name ?? "origen"),
    base_name: String(r.base_name ?? "base_integrada"),
    query: String(r.query ?? ""),
    rows: rowsRaw.map((row) => ({
      source_kind: String(row.source_kind ?? "manual") === "surveymonkey" ? "surveymonkey" : "manual",
      key_value: String(row.key_value ?? ""),
      label: String(row.label ?? ""),
      xlsform_file_id: String(row.xlsform_file_id ?? ""),
      data_file_id: String(row.data_file_id ?? ""),
      survey_id: String(row.survey_id ?? ""),
      localId: String(row.localId ?? row.local_id ?? ""),
      xlsformFileName: String(row.xlsformFileName ?? row.xlsform_file_name ?? ""),
      dataFileName: String(row.dataFileName ?? row.data_file_name ?? ""),
      surveyTitle: String(row.surveyTitle ?? row.survey_title ?? ""),
    })),
    audit,
    decisions: {
      resolved_ids: Array.isArray(decisionsRaw.resolved_ids) ? decisionsRaw.resolved_ids.map(String) : [],
      label_overrides: (decisionsRaw.label_overrides ?? {}) as Record<string, string>,
      variant_names: (decisionsRaw.variant_names ?? {}) as Record<string, string>,
    },
    updated_at: String(r.updated_at ?? ""),
  };
}

export async function apiMultiIntegratedAudit(payload: {
  guide_xlsform_file_id: string;
  origin_key_name: string;
  origins: MultiIntegratedOrigin[];
  profile_id?: string;
  connection_profile_id?: string;
}) {
  const { profile_id, connection_profile_id, ...requestPayload } = payload;
  const profileId = profile_id?.trim() || connection_profile_id?.trim();
  const raw = await handle<unknown>(
    await apiFetch("/api/multi/integrated/audit", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        ...requestPayload,
        ...(profileId ? { profile_id: profileId } : {}),
      }),
    }),
  );
  return normalizeMultiIntegratedAudit(raw);
}

export async function apiMultiIntegratedImport(payload: {
  guide_xlsform_file_id: string;
  origin_key_name: string;
  origins: MultiIntegratedOrigin[];
  base_name?: string;
  decisions?: MultiIntegratedDecisions;
  profile_id?: string;
  connection_profile_id?: string;
}) {
  const { profile_id, connection_profile_id, ...requestPayload } = payload;
  const profileId = profile_id?.trim() || connection_profile_id?.trim();
  const raw = await handle<unknown>(
    await apiFetch("/api/multi/integrated/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        ...requestPayload,
        ...(profileId ? { profile_id: profileId } : {}),
      }),
    }),
  ) as Record<string, unknown>;
  return {
    ok: true as const,
    base: raw.base as EstudioBase,
    estudio: raw.estudio as EstudioPayload,
    audit: normalizeMultiIntegratedAudit(raw.audit),
    n_filas: Number(raw.n_filas ?? 0),
    n_columnas: Number(raw.n_columnas ?? 0),
  };
}

export async function apiMultiIntegratedDecisionsDocx(payload: {
  audit: MultiIntegratedAudit;
  decisions?: MultiIntegratedDecisions;
}): Promise<Blob> {
  const res = await apiFetch("/api/multi/integrated/decisions-docx", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    throw new Error(downloadFailedMessage(res.status, raw));
  }
  return await res.blob();
}

export async function apiMultiIntegratedDraftGet() {
  const raw = await handle<{ ok: true; draft?: unknown }>(
    await apiFetch("/api/multi/integrated/draft", { headers: headers() }),
  );
  return normalizeMultiIntegratedDraft(raw.draft);
}

export async function apiMultiIntegratedDraftSave(draft: MultiIntegratedDraft, persistProject = false) {
  const raw = await handle<{ ok: true; draft?: unknown; project?: { saved?: boolean; error?: string; reason?: string; saved_at?: string } }>(
    await apiFetch("/api/multi/integrated/draft", {
      method: "PUT",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ draft, persist_project: persistProject }),
    }),
  );
  return {
    ok: true as const,
    draft: normalizeMultiIntegratedDraft(raw.draft),
    project: raw.project ?? null,
  };
}

export async function apiMultiIntegratedDraftClear(persistProject = false) {
  return handle<{ ok: true }>(
    await apiFetch(`/api/multi/integrated/draft?persist_project=${persistProject ? "true" : "false"}`, {
      method: "DELETE",
      headers: headers(),
    }),
  );
}

export type XlsformEditorSheet = {
  name?: string | null;
  columns: string[];
  rows: string[][];
};

export type SurveyMonkeyVisualLogicAction =
  | { kind: "none" }
  | { kind: "page_top"; pageId: string; pageLabel: string }
  | { kind: "question"; pageId: string; pageLabel: string; targetRef: string; targetLabel: string }
  | { kind: "end" };

export type SurveyMonkeyVisualLogicRule = {
  id: string;
  variableRef: string;
  variableLabel: string;
  choices: Array<{
    choiceName: string;
    choiceLabel: string;
    choiceIndex: number;
    action: SurveyMonkeyVisualLogicAction;
  }>;
};

export type SurveyMonkeyLogicState = {
  rules?: Array<{
    id: string;
    texto: string;
    texto_humano: string;
    kobo_expr?: string;
  }>;
  advanced_rules: Array<{
    id: string;
    texto: string;
    texto_humano: string;
    kobo_expr?: string;
  }>;
  visual_rules: SurveyMonkeyVisualLogicRule[];
  choice_order_overrides: Record<string, string[]>;
  choice_code_maps?: ChoiceCodeMap[];
};

export type XlsformEditorWorkbook = {
  survey: XlsformEditorSheet;
  choices: XlsformEditorSheet;
  settings: XlsformEditorSheet;
  paper?: XlsformEditorSheet | null;
  diagnostico?: XlsformEditorSheet | null;
  surveyMonkeyLogic?: SurveyMonkeyLogicState | null;
};

export type XlsformSourceValue =
  | string
  | number
  | boolean
  | null
  | XlsformSourceValue[]
  | XlsformSourceRecord;

export type XlsformSourceRecord = {
  [key: string]: XlsformSourceValue;
};

/**
 * Procedencia portable de un instrumento. La allowlist impide que credenciales
 * o campos accidentales de respuestas remotas terminen en localStorage o en el
 * `.pulso`; `kind` y `original_name` conservan compatibilidad con snapshots
 * anteriores del editor.
 */
export type XlsformFormSource = {
  schema?: string | null;
  kind: string | null;
  original_name: string | null;
  actor_key?: string | null;
  survey_id?: string | null;
  survey_title?: string | null;
  translated_at?: string | null;
  definition_sha256?: string | null;
  definition_fetched_at?: string | null;
  question_count?: number | null;
  logic_status?: string | null;
  publication_guard?: string | null;
  variants?: XlsformSourceRecord[];
  remote_payload_sha256_observed?: string | null;
  definition_hash_scope?: string | null;
  translation_profile?: string | null;
  provenance?: XlsformSourceRecord;
  logic_confirmed_at?: string | null;
  logic_confirmation_method?: string | null;
  logic_review?: XlsformSourceRecord;
};

export type XlsformEditorPayload = {
  ok: true;
  workbook: XlsformEditorWorkbook;
  summary: {
    survey_rows: number;
    choices_rows: number;
    settings_rows: number;
    paper_rows?: number;
    diagnostico_rows: number;
  };
  source: XlsformFormSource;
  warnings: string[];
};

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => (item == null ? "" : String(item)));
  if (value == null) return [];
  return [String(value)];
}

function normalizeSheet(value: unknown, fallbackName?: string): XlsformEditorSheet {
  const raw = (value ?? {}) as Record<string, unknown>;
  const rowsRaw = Array.isArray(raw.rows) ? raw.rows : [];
  return collapseMultilingualColumns({
    name: typeof raw.name === "string" ? raw.name : (fallbackName ?? null),
    columns: asStringArray(raw.columns),
    rows: rowsRaw.map((row) => asStringArray(row)),
  });
}

function isPersistedSheetPayload(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const raw = value as Record<string, unknown>;
  return Array.isArray(raw.columns) && Array.isArray(raw.rows);
}

export function normalizePersistedXlsformWorkbook(value: unknown): XlsformEditorWorkbook | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (
    !isPersistedSheetPayload(raw.survey)
    || !isPersistedSheetPayload(raw.choices)
    || !isPersistedSheetPayload(raw.settings)
  ) {
    return null;
  }
  return {
    survey: normalizeSheet(raw.survey, "survey"),
    choices: normalizeSheet(raw.choices, "choices"),
    settings: normalizeSheet(raw.settings, "settings"),
    paper: isPersistedSheetPayload(raw.paper) ? normalizeSheet(raw.paper, "paper") : null,
    diagnostico: isPersistedSheetPayload(raw.diagnostico)
      ? normalizeSheet(raw.diagnostico, "diagnostico")
      : null,
    surveyMonkeyLogic: normalizeSurveyMonkeyLogicState(
      raw.surveyMonkeyLogic ?? raw.survey_monkey_logic,
    ),
  };
}

function collapseMultilingualColumns(sheet: XlsformEditorSheet): XlsformEditorSheet {
  const multilingualBases = new Set(["label", "hint", "constraint_message", "required_message"]);
  const aliasEntries = sheet.columns
    .map((column) => {
      const match = /^(label|hint|constraint_message|required_message)::(.+)$/i.exec(column);
      if (!match) return null;
      const base = match[1].toLowerCase();
      if (!multilingualBases.has(base)) return null;
      return { from: column, to: base, lang: match[2].toLowerCase() };
    })
    .filter((entry): entry is { from: string; to: string; lang: string } => Boolean(entry));
  if (!aliasEntries.length) return sheet;

  const columns = [...sheet.columns];
  for (const { to } of aliasEntries) {
    if (!columns.includes(to)) columns.push(to);
  }
  const drop = new Set(aliasEntries.map(({ from }) => from));
  const keptColumns = columns.filter((column) => !drop.has(column));

  const originalIndex = new Map(sheet.columns.map((column, index) => [column, index]));
  const rows = sheet.rows.map((row) => {
    const values = new Map<string, string>();
    sheet.columns.forEach((column, index) => {
      values.set(column, row[index] ?? "");
    });
    const grouped = new Map<string, Array<{ from: string; lang: string }>>();
    for (const entry of aliasEntries) {
      grouped.set(entry.to, [...(grouped.get(entry.to) ?? []), { from: entry.from, lang: entry.lang }]);
    }
    for (const [to, candidatesRaw] of grouped) {
      const candidates = [...candidatesRaw].sort((a, b) => {
        if (a.lang === "es") return -1;
        if (b.lang === "es") return 1;
        return a.from.localeCompare(b.from);
      });
      const firstValue = candidates
        .map(({ from }) => row[originalIndex.get(from) ?? -1] ?? "")
        .find((cell) => Boolean(cell));
      if (firstValue) {
        values.set(to, firstValue);
      } else if (!values.get(to)) {
        values.set(to, "");
      }
    }
    return keptColumns.map((column) => values.get(column) ?? "");
  });

  return { ...sheet, columns: keptColumns, rows };
}

export function normalizeEditorPayload(value: unknown): XlsformEditorPayload {
  const raw = (value ?? {}) as Record<string, unknown>;
  const workbookRaw = (raw.workbook ?? {}) as Record<string, unknown>;
  const summaryRaw = (raw.summary ?? {}) as Record<string, unknown>;
  const sourceRaw = (raw.source ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    workbook: {
      survey: normalizeSheet(workbookRaw.survey, "survey"),
      choices: normalizeSheet(workbookRaw.choices, "choices"),
      settings: normalizeSheet(workbookRaw.settings, "settings"),
      paper: workbookRaw.paper ? normalizeSheet(workbookRaw.paper, "paper") : null,
      diagnostico: workbookRaw.diagnostico ? normalizeSheet(workbookRaw.diagnostico, "diagnostico") : null,
      surveyMonkeyLogic: normalizeSurveyMonkeyLogicState(workbookRaw.surveyMonkeyLogic ?? workbookRaw.survey_monkey_logic),
    },
    summary: {
      survey_rows: Number(summaryRaw.survey_rows ?? 0),
      choices_rows: Number(summaryRaw.choices_rows ?? 0),
      settings_rows: Number(summaryRaw.settings_rows ?? 0),
      paper_rows: Number(summaryRaw.paper_rows ?? 0),
      diagnostico_rows: Number(summaryRaw.diagnostico_rows ?? 0),
    },
    source: normalizeXlsformFormSource(sourceRaw) ?? { kind: null, original_name: null },
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.map((item) => String(item))
      : [],
  };
}

// Variante de respuesta cuando el archivo subido NO es un XLSForm normal sino
// una "Matriz PULSO IAC-CINDA" (preguntas por criterio/subcriterio con columnas
// de audiencia). El backend la detecta y, en vez del workbook, devuelve las
// audiencias disponibles para que el front pida elegir cuáles generar.
export type XlsformEditorImportMatrizPulso = {
  kind: "matriz_pulso";
  audiences: string[];
  original_name: string | null;
};

// Resultado discriminado del import: XLSForm normal (kind:"xlsform") o matriz
// PULSO (kind:"matriz_pulso"). El caller discrimina por `kind`.
export type XlsformEditorImportResult =
  | ({ kind: "xlsform" } & XlsformEditorPayload)
  | XlsformEditorImportMatrizPulso;

export function isMatrizPulsoImport(
  result: XlsformEditorImportResult,
): result is XlsformEditorImportMatrizPulso {
  return result.kind === "matriz_pulso";
}

export function normalizeXlsformImportResult(value: unknown): XlsformEditorImportResult {
  const raw = (value ?? {}) as Record<string, unknown>;
  if (raw.kind === "matriz_pulso") {
    return {
      kind: "matriz_pulso",
      audiences: asStringArray(raw.audiences).filter((audience) => audience.trim().length > 0),
      original_name: raw.original_name == null ? null : String(raw.original_name),
    };
  }
  return { kind: "xlsform", ...normalizeEditorPayload(raw) };
}

export async function apiXlsformEditorImport(file_id: string): Promise<XlsformEditorImportResult> {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    })
  );
  return normalizeXlsformImportResult(raw);
}

// Segundo paso del flujo matriz PULSO: para una audiencia elegida el backend
// construye el workbook XLSForm correspondiente. Devuelve además un resumen con
// la escala inferida (preguntas de acuerdo/satisfacción) y warnings a revisar.
export type MatrizPulsoImportSummary = {
  audience: string | null;
  survey_rows: number;
  choices_rows: number;
  settings_rows: number;
  n_acuerdo: number | null;
  n_satisfaccion: number | null;
  scale_inferred: boolean;
};

export type MatrizPulsoImportResult = {
  workbook: XlsformEditorWorkbook;
  summary: MatrizPulsoImportSummary;
  warnings: string[];
};

function matrizNumOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeMatrizPulsoImport(value: unknown): MatrizPulsoImportResult {
  const raw = (value ?? {}) as Record<string, unknown>;
  const workbookRaw = (raw.workbook ?? {}) as Record<string, unknown>;
  const summaryRaw = (raw.summary ?? {}) as Record<string, unknown>;
  return {
    workbook: {
      survey: normalizeSheet(workbookRaw.survey, "survey"),
      choices: normalizeSheet(workbookRaw.choices, "choices"),
      settings: normalizeSheet(workbookRaw.settings, "settings"),
      paper: workbookRaw.paper ? normalizeSheet(workbookRaw.paper, "paper") : null,
      diagnostico: workbookRaw.diagnostico ? normalizeSheet(workbookRaw.diagnostico, "diagnostico") : null,
      surveyMonkeyLogic: normalizeSurveyMonkeyLogicState(
        workbookRaw.surveyMonkeyLogic ?? workbookRaw.survey_monkey_logic,
      ),
    },
    summary: {
      audience: summaryRaw.audience == null ? null : String(summaryRaw.audience),
      survey_rows: Number(summaryRaw.survey_rows ?? 0),
      choices_rows: Number(summaryRaw.choices_rows ?? 0),
      settings_rows: Number(summaryRaw.settings_rows ?? 0),
      n_acuerdo: matrizNumOrNull(summaryRaw.n_acuerdo),
      n_satisfaccion: matrizNumOrNull(summaryRaw.n_satisfaccion),
      scale_inferred: Boolean(summaryRaw.scale_inferred),
    },
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map((item) => String(item)) : [],
  };
}

export async function apiXlsformEditorImportMatrizPulso(
  file_id: string,
  audience: string,
): Promise<MatrizPulsoImportResult> {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/import-matriz-pulso", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id, audience }),
    })
  );
  return normalizeMatrizPulsoImport(raw);
}

export async function apiXlsformEditorImportSurveyMonkey(file_id: string, lang = "es") {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/import-surveymonkey", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id, lang }),
    })
  );
  return normalizeEditorPayload(raw);
}

export type SurveyMonkeyChoice = { code: string; label: string };
export type SurveyMonkeyQuestion = {
  name: string;
  name_raw: string;
  group: string;
  label: string | null;
  kind: string;
  choices: SurveyMonkeyChoice[];
};

export type SurveyMonkeyMeta = {
  ok: true;
  n_filas: number;
  preguntas: SurveyMonkeyQuestion[];
};

export async function apiXlsformEditorSavMeta(file_id: string): Promise<SurveyMonkeyMeta> {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/sav-meta", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    })
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    n_filas: Number(r.n_filas ?? 0),
    preguntas: Array.isArray(r.preguntas)
      ? (r.preguntas as Record<string, unknown>[]).map((p) => ({
          name: String(p.name ?? ""),
          name_raw: String(p.name_raw ?? ""),
          group: String(p.group ?? ""),
          label: p.label == null ? null : String(p.label),
          kind: String(p.kind ?? ""),
          choices: Array.isArray(p.choices)
            ? (p.choices as Record<string, unknown>[]).map((c) => ({
                code: String(c.code ?? ""),
                label: String(c.label ?? ""),
              }))
            : [],
        }))
      : [],
  };
}

export type Hallazgo = {
  target: string;
  severity: "warn" | "info";
  kind: "regla_violada" | "baja_completitud";
  mensaje: string;
  coverage_oculta: number | null;
  tasa_respuesta: number | null;
  inconsistencias: number[];
};

export type EditorPayloadWithHallazgos = XlsformEditorPayload & {
  hallazgos: Hallazgo[];
};

// El token vive en backend: persistido cifrado en disco local o efímero por
// sesión. El frontend solo muestra estado/máscara y nunca recibe el secreto.
export type SurveyMonkeyTokenState = {
  ok: true;
  has_token: boolean;
  masked_token: string;
  persisted: boolean;
  ephemeral: boolean;
  active_profile_id?: string;
  active_profile_alias?: string;
  active_profile_base_url?: string;
  active_profile_server_label?: string;
  profile_count?: number;
  profiles?: ConnectionProfileState[];
};

export type ConnectionProvider = "surveymonkey" | "kobo" | "google_sheets";

export type ConnectionProfileState = {
  id: string;
  alias: string;
  is_default: boolean;
  has_token: boolean;
  masked_token: string;
  base_url?: string;
  server_label?: string;
  updated_at?: string;
  legacy?: boolean;
};

export type ConnectionTokenState = SurveyMonkeyTokenState & {
  provider: ConnectionProvider;
  label: string;
};

export type ConnectionCheckResult =
  | {
      ok: true;
      provider?: ConnectionProvider;
      status_code: number;
      n_surveys_visible?: number | null;
      count?: number | null;
      base_url?: string;
      profile_id?: string;
    }
  | {
      ok: false;
      provider?: ConnectionProvider;
      status_code?: number;
      error: string;
    };

function normalizeConnectionProvider(value: unknown): ConnectionProvider {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "kobo" || raw === "kobotoolbox") return "kobo";
  if (raw === "google_sheets" || raw === "googlesheets" || raw === "sheets" || raw === "google") return "google_sheets";
  return "surveymonkey";
}

function normalizeConnectionTokenState(raw: unknown, providerHint: ConnectionProvider): ConnectionTokenState {
  const r = (raw ?? {}) as Record<string, unknown>;
  const provider = normalizeConnectionProvider(r.provider ?? providerHint);
  const profiles = Array.isArray(r.profiles) ? r.profiles.map(normalizeConnectionProfileState) : [];
  return {
    ok: true,
    provider,
    label: String(r.label ?? (provider === "kobo" ? "KoboToolbox" : provider === "google_sheets" ? "Google Sheets" : "SurveyMonkey")),
    has_token: r.has_token === true,
    masked_token: String(r.masked_token ?? ""),
    persisted: r.persisted === true,
    ephemeral: r.ephemeral === true,
    active_profile_id: r.active_profile_id == null ? "" : String(r.active_profile_id),
    active_profile_alias: r.active_profile_alias == null ? "" : String(r.active_profile_alias),
    active_profile_base_url: r.active_profile_base_url == null ? "" : String(r.active_profile_base_url),
    active_profile_server_label: r.active_profile_server_label == null ? "" : String(r.active_profile_server_label),
    profile_count: r.profile_count == null ? profiles.length : Number(r.profile_count),
    profiles,
  };
}

function normalizeConnectionProfileState(raw: unknown): ConnectionProfileState {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(r.id ?? ""),
    alias: String(r.alias ?? "Principal"),
    is_default: r.is_default === true,
    has_token: r.has_token === true,
    masked_token: String(r.masked_token ?? ""),
    base_url: r.base_url == null ? "" : String(r.base_url),
    server_label: r.server_label == null ? "" : String(r.server_label),
    updated_at: r.updated_at == null ? "" : String(r.updated_at),
    legacy: r.legacy === true,
  };
}

function normalizeSurveyMonkeyTokenState(raw: unknown): SurveyMonkeyTokenState {
  const state = normalizeConnectionTokenState(raw, "surveymonkey");
  return {
    ok: true,
    has_token: state.has_token,
    masked_token: state.masked_token,
    persisted: state.persisted,
    ephemeral: state.ephemeral,
    active_profile_id: state.active_profile_id,
    active_profile_alias: state.active_profile_alias,
    active_profile_base_url: state.active_profile_base_url,
    active_profile_server_label: state.active_profile_server_label,
    profile_count: state.profile_count,
    profiles: state.profiles,
  };
}

export async function apiConnectionsList(): Promise<{ ok: true; connections: ConnectionTokenState[] }> {
  const raw = await handle<unknown>(
    await apiFetch("/api/connections", {
      method: "GET",
      headers: headers(),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  const arr = Array.isArray(r.connections) ? r.connections : [];
  return {
    ok: true,
    connections: arr.map((item) =>
      normalizeConnectionTokenState(item, normalizeConnectionProvider((item as Record<string, unknown> | null)?.provider)),
    ),
  };
}

export async function apiConnectionTokenLoad(provider: ConnectionProvider): Promise<ConnectionTokenState> {
  const raw = await handle<unknown>(
    await apiFetch(`/api/connections/${provider}/token`, {
      method: "GET",
      headers: headers(),
    }),
  );
  return normalizeConnectionTokenState(raw, provider);
}

export async function apiConnectionTokenSave(
  provider: ConnectionProvider,
  token: string,
  options: { persist?: boolean } = {},
): Promise<ConnectionTokenState> {
  const raw = await handle<unknown>(
    await apiFetch(`/api/connections/${provider}/token`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ token, persist: options.persist !== false }),
    }),
  );
  return normalizeConnectionTokenState(raw, provider);
}

export async function apiConnectionGoogleSheetsConnect(oauth: unknown, redirectUri?: string) {
  return handle<MonitoreoSheetsConnectResult>(
    await apiFetch("/api/connections/google_sheets/oauth", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ oauth, redirect_uri: redirectUri }),
    }),
  );
}

export async function apiConnectionTokenClear(provider: ConnectionProvider): Promise<ConnectionTokenState> {
  const raw = await handle<unknown>(
    await apiFetch(`/api/connections/${provider}/token`, {
      method: "DELETE",
      headers: headers(),
    }),
  );
  return normalizeConnectionTokenState(raw, provider);
}

export async function apiConnectionProfilesList(
  provider: ConnectionProvider,
): Promise<{ ok: true; provider: ConnectionProvider; default_profile_id: string; profiles: ConnectionProfileState[] }> {
  const raw = await handle<unknown>(
    await apiFetch(`/api/connections/${provider}/profiles`, {
      method: "GET",
      headers: headers(),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    provider,
    default_profile_id: String(r.default_profile_id ?? ""),
    profiles: Array.isArray(r.profiles) ? r.profiles.map(normalizeConnectionProfileState) : [],
  };
}

export async function apiConnectionProfileSave(
  provider: ConnectionProvider,
  token: string,
  options: { alias?: string; profile_id?: string; make_default?: boolean; base_url?: string; server_label?: string } = {},
): Promise<ConnectionTokenState> {
  const body: Record<string, unknown> = {
    token,
    alias: options.alias ?? "",
    profile_id: options.profile_id ?? "",
    make_default: options.make_default !== false,
  };
  if (options.base_url != null) body.base_url = options.base_url;
  if (options.server_label != null) body.server_label = options.server_label;
  const raw = await handle<unknown>(
    await apiFetch(`/api/connections/${provider}/profiles`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    }),
  );
  return normalizeConnectionTokenState(raw, provider);
}

export async function apiConnectionProfileSetDefault(
  provider: ConnectionProvider,
  profileId: string,
): Promise<ConnectionTokenState> {
  const raw = await handle<unknown>(
    await apiFetch(`/api/connections/${provider}/profiles/${encodeURIComponent(profileId)}/default`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: "{}",
    }),
  );
  return normalizeConnectionTokenState(raw, provider);
}

export async function apiConnectionProfileDelete(
  provider: ConnectionProvider,
  profileId: string,
): Promise<ConnectionTokenState> {
  const raw = await handle<unknown>(
    await apiFetch(`/api/connections/${provider}/profiles/${encodeURIComponent(profileId)}`, {
      method: "DELETE",
      headers: headers(),
    }),
  );
  return normalizeConnectionTokenState(raw, provider);
}

export async function apiConnectionCheck(
  provider: ConnectionProvider,
  options: { base_url?: string; profile_id?: string } = {},
): Promise<ConnectionCheckResult> {
  const raw = await handle<unknown>(
    await apiFetch(`/api/connections/${provider}/check`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(options),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.ok === true) {
    return {
      ok: true,
      provider,
      status_code: Number(r.status_code ?? 200),
      n_surveys_visible: r.n_surveys_visible == null || r.n_surveys_visible === "NA"
        ? null
        : Number(r.n_surveys_visible),
      count: r.count == null || r.count === "NA" ? null : Number(r.count),
      base_url: r.base_url == null ? "" : String(r.base_url),
      profile_id: r.profile_id == null ? "" : String(r.profile_id),
    };
  }
  return {
    ok: false,
    provider,
    status_code: r.status_code == null ? undefined : Number(r.status_code),
    error: String(r.error ?? "No se pudo verificar la conexión"),
  };
}

export async function apiXlsformEditorSmTokenLoad(): Promise<SurveyMonkeyTokenState> {
  return normalizeSurveyMonkeyTokenState(await apiConnectionTokenLoad("surveymonkey"));
}

export async function apiXlsformEditorSmTokenSave(
  token: string,
  options: { persist?: boolean } = {},
): Promise<SurveyMonkeyTokenState> {
  return normalizeSurveyMonkeyTokenState(await apiConnectionTokenSave("surveymonkey", token, options));
}

export async function apiXlsformEditorSmTokenClear(): Promise<SurveyMonkeyTokenState> {
  return normalizeSurveyMonkeyTokenState(await apiConnectionTokenClear("surveymonkey"));
}

export type SurveyMonkeyTokenInfo =
  | { ok: true; status_code: number; n_surveys_visible: number | null }
  | { ok: false; status_code?: number; error: string };

export async function apiXlsformEditorSmCheckToken(): Promise<SurveyMonkeyTokenInfo> {
  const raw = await apiConnectionCheck("surveymonkey");
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.ok === true) {
    return {
      ok: true,
      status_code: Number(r.status_code ?? 200),
      n_surveys_visible: r.n_surveys_visible == null || r.n_surveys_visible === "NA"
        ? null
        : Number(r.n_surveys_visible),
    };
  }
  return {
    ok: false,
    status_code: r.status_code == null ? undefined : Number(r.status_code),
    error: String(r.error ?? "Token inválido"),
  };
}

export type SurveyMonkeyListItem = {
  id: string;
  title: string;
  nickname: string | null;
  date_modified: string | null;
};

export async function apiXlsformEditorSmListSurveys(
  limit = 500,
  months = 6,
  options: { forceRefresh?: boolean } = {},
): Promise<{
  ok: true;
  count: number;
  total_visible: number;
  total_recent: number;
  months: number;
  from_cache: boolean;
  cache_status: string;
  refresh_error: string;
  catalog_fetched_at: string | null;
  catalog_age_seconds: number | null;
  catalog_count: number;
  surveys: SurveyMonkeyListItem[];
}> {
  const payload: Record<string, unknown> = { limit, months };
  if (options.forceRefresh) payload.force_refresh = true;
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/sm-list-surveys", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  const arr = Array.isArray(r.surveys) ? (r.surveys as Record<string, unknown>[]) : [];
  return {
    ok: true,
    count: Number(r.count ?? arr.length),
    total_visible: Number(r.total_visible ?? arr.length),
    total_recent: Number(r.total_recent ?? arr.length),
    months: Number(r.months ?? months),
    from_cache: Boolean(r.from_cache),
    cache_status: String(r.cache_status ?? ""),
    refresh_error: String(r.refresh_error ?? ""),
    catalog_fetched_at: r.catalog_fetched_at == null || r.catalog_fetched_at === "NA" ? null : String(r.catalog_fetched_at),
    catalog_age_seconds: r.catalog_age_seconds == null || r.catalog_age_seconds === "NA" ? null : Number(r.catalog_age_seconds),
    catalog_count: Number(r.catalog_count ?? r.total_visible ?? arr.length),
    surveys: arr.map((s) => ({
      id: String(s.id ?? ""),
      title: String(s.title ?? "(sin título)"),
      nickname: s.nickname == null || s.nickname === "NA" ? null : String(s.nickname),
      date_modified: s.date_modified == null || s.date_modified === "NA" ? null : String(s.date_modified),
    })),
  };
}

export type SurveyMonkeyApiInfo = {
  ok: true;
  paginas: Record<string, string[]>;
  pages: Array<{
    page_id: string;
    title: string | null;
    label: string;
    range_label: string;
    question_count: number;
    notes: string[];
    questions: string[];
    question_details: Array<{
      name: string;
      heading: string | null;
      family: string | null;
      subtype: string | null;
      choices: SurveyMonkeyChoice[];
      children: Array<{
        name: string;
        heading: string | null;
        type: string | null;
        list_name: string | null;
      }>;
    }>;
  }>;
  summary: {
    title: string | null;
    language: string | null;
    n_paginas: number;
    n_preguntas: number;
    n_required: number;
    n_validation: number;
  };
  style: { prefix: string; pad: number };
  definition: SurveyMonkeyDefinition | null;
};

export type SurveyMonkeyDefinition = {
  schema: string;
  sha256: string;
  fetched_at: string;
  survey_id: string;
  question_count: number;
  hash_scope: string;
  translation_profile: string;
};

export async function apiXlsformEditorSmFetchSurveyInfo(
  file_id: string | null,
  survey_id: string,
): Promise<SurveyMonkeyApiInfo> {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/sm-fetch-survey-info", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id: file_id ?? "", survey_id }),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  const paginasRaw = (r.paginas ?? {}) as Record<string, unknown>;
  const pagesRaw = Array.isArray(r.pages) ? (r.pages as Record<string, unknown>[]) : [];
  const summaryRaw = (r.summary ?? {}) as Record<string, unknown>;
  const styleRaw = (r.style ?? {}) as Record<string, unknown>;
  const definitionRaw = r.definition && typeof r.definition === "object" && !Array.isArray(r.definition)
    ? r.definition as Record<string, unknown>
    : null;
  const paginas: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(paginasRaw)) {
    paginas[k] = normalizeStringArray(v);
  }
  return {
    ok: true,
    paginas,
    pages: pagesRaw.map((p) => {
      const details = normalizeRecordArray(p.question_details).map((q) => ({
        name: String(q.name ?? ""),
        heading: q.heading == null || q.heading === "NA" ? null : String(q.heading),
        family: q.family == null || q.family === "NA" ? null : String(q.family),
        subtype: q.subtype == null || q.subtype === "NA" ? null : String(q.subtype),
        choices: normalizeRecordArray(q.choices).map((c) => ({
          code: String(c.code ?? ""),
          label: String(c.label ?? ""),
        })),
        children: normalizeRecordArray(q.children).map((c) => ({
          name: String(c.name ?? ""),
          heading: c.heading == null || c.heading === "NA" ? null : String(c.heading),
          type: c.type == null || c.type === "NA" ? null : String(c.type),
          list_name: c.list_name == null || c.list_name === "NA" ? null : String(c.list_name),
        })),
      }));
      const questions = normalizeStringArray(p.questions);
      const normalizedQuestions = questions.length > 0
        ? questions
        : details.map((q) => q.name).filter(Boolean);
      return {
        page_id: String(p.page_id ?? ""),
        title: p.title == null || p.title === "NA" ? null : String(p.title),
        label: String(p.label ?? ""),
        range_label: String(p.range_label ?? ""),
        question_count: Number(p.question_count ?? normalizedQuestions.length),
        notes: normalizeStringArray(p.notes),
        questions: normalizedQuestions,
        question_details: details,
      };
    }),
    summary: {
      title: summaryRaw.title == null ? null : String(summaryRaw.title),
      language: summaryRaw.language == null ? null : String(summaryRaw.language),
      n_paginas: Number(summaryRaw.n_paginas ?? 0),
      n_preguntas: Number(summaryRaw.n_preguntas ?? 0),
      n_required: Number(summaryRaw.n_required ?? 0),
      n_validation: Number(summaryRaw.n_validation ?? 0),
    },
    style: {
      prefix: String(styleRaw.prefix ?? "p"),
      pad: Number(styleRaw.pad ?? 0),
    },
    definition: definitionRaw
      ? {
          schema: String(definitionRaw.schema ?? "surveymonkey_definition/v1"),
          sha256: String(definitionRaw.sha256 ?? ""),
          fetched_at: definitionRaw.fetched_at == null || definitionRaw.fetched_at === "NA"
            ? ""
            : String(definitionRaw.fetched_at),
          survey_id: String(definitionRaw.survey_id ?? survey_id),
          question_count: Number(definitionRaw.question_count ?? summaryRaw.n_preguntas ?? 0),
          hash_scope: String(definitionRaw.hash_scope ?? ""),
          translation_profile: String(definitionRaw.translation_profile ?? ""),
        }
      : null,
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((x) => String(x)).filter(Boolean);
  if (value == null || value === "NA") return [];
  const str = String(value);
  return str ? [str] : [];
}

export function normalizeRecordArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (value && typeof value === "object") return [value as Record<string, unknown>];
  return [];
}

// Estado persistido del editor xlsform en el backend (viaja con el .pulso
// cuando el usuario lo guarda). Es la fuente de verdad cuando hay proyecto
// abierto; sessionStorage queda como cache local del lado del navegador.
export type PersistedXlsformState = {
  workbook: XlsformEditorWorkbook;
  source: XlsformFormSource | null;
  hallazgos: Hallazgo[];
  saved_at: number;
};

export async function apiXlsformEditorStateLoad(): Promise<{
  ok: true;
  has_state: boolean;
  state: PersistedXlsformState | null;
}> {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/state", { method: "GET", headers: headers() }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  const stateRaw = r.state && typeof r.state === "object" && !Array.isArray(r.state)
    ? r.state as Record<string, unknown>
    : null;
  return {
    ok: true,
    has_state: r.has_state === true && stateRaw != null,
    state: r.has_state === true && stateRaw != null
      ? {
          workbook: stateRaw.workbook as XlsformEditorWorkbook,
          source: normalizeXlsformFormSource(stateRaw.source),
          hallazgos: Array.isArray(stateRaw.hallazgos) ? stateRaw.hallazgos as Hallazgo[] : [],
          saved_at: Number(stateRaw.saved_at) || 0,
        }
      : null,
  };
}

export async function apiXlsformEditorStateSave(state: PersistedXlsformState): Promise<{
  ok: true;
  saved_at: string;
}> {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/state", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ ...state, source: normalizeXlsformFormSource(state.source) }),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  return { ok: true, saved_at: String(r.saved_at ?? "") };
}

export async function apiXlsformEditorStateClear(): Promise<{ ok: true }> {
  await handle<unknown>(
    await apiFetch("/api/xlsform-editor/state", { method: "DELETE", headers: headers() }),
  );
  return { ok: true };
}
