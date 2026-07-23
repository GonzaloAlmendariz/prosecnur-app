// surveymonkey.ts — integración SurveyMonkey multibase contra XLSForm canónico.
// Extraído de client.ts (split por dominio, 2026-07). Los consumidores
// importan del barrel ./client; este módulo no cambia el contrato.

import { apiFetch, handle, headers } from "./core";
import type { EstudioBase, EstudioLogicSyncResult, EstudioPayload } from "./estudio";
import { normalizeRecordArray } from "./multiIntegrado";
import type { ChoiceCodeMap } from "./xlsformEditor";

// ============================================================================
// SurveyMonkey multibase contra XLSForm canonico
// ============================================================================

export type SurveyMonkeyMultibaseSurveyInput = {
  survey_id: string;
  pais?: string;
  label?: string;
  source_alias?: string;
  source_title?: string;
  channel?: string;
  canal?: string;
  source_channel?: string;
  consent_var?: string;
  consentimiento_var?: string;
  data_file_id?: string;
  response_statuses?: string[];
  keep_missing_status?: boolean;
  collector_id?: string;
  collector_ids?: string[];
  date_modified_gte?: string;
  date_modified_lte?: string;
  collection_strategy?: "campo" | "whatsapp_link" | "web_link" | "email" | "otro" | string;
  validation_exclusion_profile?: string;
  excluded_validation_vars?: string[];
  sources?: SurveyMonkeyMultibaseSurveyInput[];
  campaigns?: SurveyMonkeyMultibaseSurveyInput[];
};

export type SurveyMonkeyDecisionPolicy = {
  version?: number;
  edited?: boolean;
  statuses?: string[];
  collector_ids?: string[];
  consent_var?: string;
  consent_yes_values?: string[];
  rejection_var?: string;
  rejection_values?: string[];
  include_partials?: boolean;
  partial_min_answers?: number;
  include_rejections?: boolean;
  duplicate_key_vars?: string[];
  include_duplicates?: boolean;
  duplicate_keep?: "first" | "latest" | "most_answered" | string;
  manual_include_case_uids?: string[];
  saved_at?: string;
};

export type SurveyMonkeyDecisionCaseAudit = {
  source_label?: string;
  case_uid?: string;
  survey_id?: string;
  source_title?: string;
  source_channel?: string;
  collector_id?: string;
  response_id?: string;
  recipient_id?: string;
  custom_value?: string;
  cv_id?: string;
  p4?: string;
  response_status?: string;
  date_created?: string;
  date_modified?: string;
  answered_questions_count?: string;
  answered_required_count?: string;
  answerable_required_count?: string;
  answer_completion_ratio?: string;
  answer_completion_label?: string;
  near_complete?: string;
  decision_class?: string;
  decision_included?: string;
  decision_manual_include?: string;
  duplicate_status?: string;
  duplicate_key_var?: string;
  duplicate_key?: string;
  duplicate_group_size?: string;
  duplicate_rank?: string;
  duplicate_kept_case_uid?: string;
  duplicate_kept_response_id?: string;
  duplicate_code_match?: string;
  duplicate_career_match?: string;
  duplicate_evidence?: string;
  observed?: boolean;
  observation_reason?: string;
};

export type SurveyMonkeyDecisionSourceAudit = {
  source_label?: string;
  survey_id?: string;
  source_title?: string;
  source_alias?: string;
  raw_total?: number;
  completed?: number;
  completed_with_consent?: number;
  partials_revisable?: number;
  rejections?: number;
  unclear_consent?: number;
  duplicate_groups?: number;
  duplicate_rows?: number;
  duplicate_extra_rows?: number;
  duplicates_excluded?: number;
  duplicates_included?: number;
  manual_included?: number;
  near_complete_cases?: number;
  observed_cases?: number;
  included?: number;
  excluded?: number;
  collectors_included?: number;
  partial_min_answers?: number;
  consent_var?: string;
  rejection_var?: string;
  consent_available?: boolean;
  duplicate_key_vars?: string[];
  duplicate_keep?: string;
  include_duplicates?: boolean;
  status_counts?: Record<string, number>;
  collector_counts?: Record<string, number>;
  collectors?: Array<{
    id?: string;
    name?: string;
    type?: string;
    response_count?: number | null;
  }>;
  cases?: SurveyMonkeyDecisionCaseAudit[];
  case_rows_omitted?: number;
};

export type SurveyMonkeyDecisionAudit = {
  version?: number;
  audited_at?: string;
  raw_total?: number;
  completed?: number;
  completed_with_consent?: number;
  partials_revisable?: number;
  rejections?: number;
  unclear_consent?: number;
  duplicate_groups?: number;
  duplicate_rows?: number;
  duplicate_extra_rows?: number;
  duplicates_excluded?: number;
  duplicates_included?: number;
  manual_included?: number;
  near_complete_cases?: number;
  observed_cases?: number;
  case_rows_omitted?: number;
  included?: number;
  excluded?: number;
  collectors_included?: number;
  sources?: SurveyMonkeyDecisionSourceAudit[];
  policy?: SurveyMonkeyDecisionPolicy;
};

export type SurveyMonkeyMultibaseListItem = {
  id: string;
  title: string;
  nickname: string | null;
  date_modified: string | null;
  pais_guess: string | null;
  response_count?: number | null;
};

export type SurveyMonkeyMultibaseCollector = {
  id: string;
  name: string;
  type: string;
  response_count: number | null;
  date_created: string | null;
  date_modified: string | null;
};

export type SurveyMonkeyMultibaseInspection = {
  ok: true;
  survey_id: string;
  title: string;
  language: string;
  n_pages: number;
  n_questions: number;
  n_required: number;
  n_validation: number;
  pages: Array<{
    page_id: string;
    title: string;
    range_label: string;
    question_count: number;
  }>;
  questions: Array<{
    pos: number;
    page: number;
    qid: string;
    family: string;
    subtype: string;
    heading: string;
    n_choices: number;
    n_rows: number;
    n_cols: number;
  }>;
  responses: {
    available: boolean;
    total: number | null;
    returned: number;
    error: string;
  };
  columns: Array<{
    name: string;
    non_empty: number;
    examples: string[];
  }>;
  sample_rows: Array<Record<string, string>>;
};

export type SurveyMonkeyMultibaseSurveySummary = {
  survey_id: string;
  title: string;
  pais: string;
  label: string;
  n_pages: number;
  n_questions: number;
  n_responses: number | null;
  responses_available: boolean;
  responses_error: string;
  data_file_id?: string;
};

export type SurveyMonkeyMultibaseDiff = {
  survey_id: string;
  pos: number;
  variable: string;
  severity: "blocking" | "review" | "special";
  kind: "missing_or_extra" | "structure" | "options" | "wording" | "company_list" | "company_logic" | string;
  message: string;
  ref: string;
  current: string;
};

export type SurveyMonkeyMultibaseAudit = {
  ok: boolean;
  surveys: SurveyMonkeyMultibaseSurveySummary[];
  ref_survey_id: string;
  n_blocking: number;
  n_review: number;
  n_special: number;
  company_positions: number[];
  company_variables: string[];
  diffs: SurveyMonkeyMultibaseDiff[];
};

export type SurveyMonkeyWorkbookMappedHeader = {
  source: string;
  kind: "metadata" | "question" | "select_multiple" | string;
  variable?: string;
  code?: string;
  columns?: string[];
};

export type SurveyMonkeyWorkbookCellError = {
  source: string;
  kind: string;
  variable?: string;
  code?: string;
  n_errors: number;
  rows?: number[];
};

export type SurveyMonkeyWorkbookSheetInspection = {
  sheet_name: string;
  base_name?: string | null;
  matched: boolean;
  blocking: boolean;
  n_rows: number;
  n_columns: number;
  n_output_columns?: number;
  recognized_headers: number;
  mapped_headers?: SurveyMonkeyWorkbookMappedHeader[];
  unknown_headers: string[];
  ambiguous_headers: string[];
  missing_variables: string[];
  blank_filled_variables?: string[];
  cell_errors?: SurveyMonkeyWorkbookCellError[];
  n_cell_errors?: number;
  warnings: string[];
};

export type SurveyMonkeyWorkbookInspection = {
  ok: boolean;
  file_id: string;
  filename: string;
  n_sheets: number;
  n_matched: number;
  n_blocking: number;
  blocking_sheets: string[];
  sheets: SurveyMonkeyWorkbookSheetInspection[];
  warnings: string[];
};

export type SurveyMonkeyWorkbookImportResult = {
  ok: true;
  file_id: string;
  filename: string;
  imported_bases: number;
  results: Array<{
    base_name: string;
    sheet_name: string;
    data_file_id: string;
    snapshot_file_id: string;
    n_rows: number;
    n_columns: number;
    warnings: string[];
    base?: EstudioBase;
  }>;
  inspection: SurveyMonkeyWorkbookInspection;
  estudio: EstudioPayload;
};

export type SurveyMonkeySavBundleChangePlan = {
  action: "replace_data" | string;
  base_name: string;
  source_file: string;
  current: {
    n_rows?: number | null;
    n_columns?: number | null;
    data_file_id?: string;
    xlsform_file_id?: string;
  };
  incoming: {
    raw_rows: number;
    raw_columns: number;
    normalized_rows: number;
    normalized_columns: number;
  };
  impact: {
    rows_delta?: number | null;
    columns_delta?: number | null;
    expected_variables: number;
    matched_variables: number;
    missing_variables: string[];
    blank_filled_variables: string[];
    all_empty_variables: string[];
    metadata_columns: string[];
  };
  effects: {
    xlsform: "preserved" | string;
    data: "replaced" | string;
    invalidates: string[];
  };
};

export type SurveyMonkeySavBundleMissingRequiredPolicy = "strict" | "fill_blank_warn";

export type SurveyMonkeySavBundleInstrumentRevision = {
  status: "pinned_healthy" | "legacy_unpinned" | "blocked";
  healthy: boolean | null;
  revision_id: string;
  revision_hash: string;
  base_revision_hash: string;
  base_xlsform_file_id: string;
  revision_xlsform_file_id: string;
  reasons: string[];
  warning: string;
};

export type SurveyMonkeySavNormalizationStatus = "unchanged" | "transformed" | "warning" | "source_only";

export type SurveyMonkeySavNormalizationSourceColumn = {
  name: string;
  storage_type: string;
  label: string;
  labelled: boolean | null;
};

export type SurveyMonkeySavNormalizationXlsform = {
  name: string;
  label: string;
  type: string;
  type_base: string;
  list_name: string;
};

export type SurveyMonkeySavNormalizationOperation = {
  kind: string;
  label: string;
  detail: string;
  source: string;
  target: string;
};

export type SurveyMonkeySavNormalizationCatalogChoice = {
  name: string;
  value: string;
  label: string;
};

export type SurveyMonkeySavNormalizationCatalogMapping = {
  source_code: string;
  source_column: string;
  source_label: string;
  xls_code: string;
  xls_label: string;
  match: string;
  source: string;
  target: string;
  target_label: string;
};

export type SurveyMonkeySavNormalizationCatalog = {
  list_name: string;
  origin: string;
  sealed_sha256: string;
  choices: SurveyMonkeySavNormalizationCatalogChoice[];
  mappings: SurveyMonkeySavNormalizationCatalogMapping[];
};

export type SurveyMonkeySavNormalizationAlert = {
  severity: "info" | "warning" | "error";
  code: string;
  count: number;
  variables: string[];
  message: string;
};

export type SurveyMonkeySavNormalizationVariable = {
  id: string;
  variable: string;
  source_columns: SurveyMonkeySavNormalizationSourceColumn[];
  xlsform: SurveyMonkeySavNormalizationXlsform | null;
  status: SurveyMonkeySavNormalizationStatus;
  operations: SurveyMonkeySavNormalizationOperation[];
  catalog: SurveyMonkeySavNormalizationCatalog | null;
  alerts: SurveyMonkeySavNormalizationAlert[];
};

export type SurveyMonkeySavNormalizationReview = {
  schema: string;
  normalizer_contract: string;
  fingerprint: string;
  privacy: {
    response_values_included: false;
    direct_identifier_values_included: false;
    free_text_values_included: false;
    schema_names_included: true;
    xlsform_labels_included: true;
    choice_catalog_included: true;
  };
  summary: {
    total_variables: number;
    expected_variables: number;
    source_only_variables: number;
    status_counts: Record<SurveyMonkeySavNormalizationStatus, number>;
    operation_counts: Record<string, number>;
    alerts: number;
  };
  alerts: SurveyMonkeySavNormalizationAlert[];
  variables: SurveyMonkeySavNormalizationVariable[];
};

export type SurveyMonkeySavBundleFileInspection = {
  file_name: string;
  entry_name: string;
  base_name?: string | null;
  matched: boolean;
  blocking: boolean;
  action: "replace_data" | string;
  n_rows: number;
  n_columns: number;
  n_output_columns: number;
  expected_variables: number;
  matched_variables: number;
  missing_variables: string[];
  blank_filled_variables: string[];
  all_empty_variables: string[];
  metadata_columns: string[];
  instrument_revision: SurveyMonkeySavBundleInstrumentRevision;
  normalization_review?: SurveyMonkeySavNormalizationReview | null;
  warnings: string[];
  change_plan: SurveyMonkeySavBundleChangePlan;
};

export type SurveyMonkeySavBundleInspection = {
  ok: boolean;
  file_id: string;
  filename: string;
  n_files: number;
  n_matched: number;
  n_blocking: number;
  blocking_files: string[];
  inspection_fingerprint: string;
  files: SurveyMonkeySavBundleFileInspection[];
  change_plan: SurveyMonkeySavBundleFileInspection[];
  warnings: string[];
};

export type SurveyMonkeySavBundleImportResult = {
  ok: true;
  file_id: string;
  filename: string;
  imported_bases: number;
  results: Array<{
    base_name: string;
    file_name: string;
    entry_name: string;
    data_file_id: string;
    snapshot_file_id: string;
    n_rows: number;
    n_columns: number;
    warnings: string[];
    change_plan: SurveyMonkeySavBundleChangePlan;
    base?: EstudioBase;
  }>;
  inspection: SurveyMonkeySavBundleInspection;
  estudio: EstudioPayload;
};

export type SurveyMonkeyRefreshCampaignSuggestion = {
  survey_id: string;
  title: string;
  nickname?: string | null;
  label?: string;
  channel?: string;
  source_channel?: string;
  date_modified?: string | null;
  response_count?: number | null;
  score: number;
  preselected: boolean;
  reason?: string;
};

export type SurveyMonkeyRefreshBasePlan = {
  base_name: string;
  source_alias?: string;
  source_title?: string;
  survey_id?: string;
  source_count?: number;
  existing_campaigns?: string[];
  accepted_campaigns?: string[];
  campaign_suggestions?: SurveyMonkeyRefreshCampaignSuggestion[];
  current_rows?: number | null;
  remote_rows?: number | null;
  new_rows?: number | null;
  edited_rows?: number | null;
  edited_case_uids?: string[];
  structure?: {
    ok?: boolean;
    n_blocking?: number;
    n_review?: number;
    diffs?: SurveyMonkeyMultibaseDiff[];
  };
  codificacion?: {
    has_state?: boolean;
  };
  source_spec?: SurveyMonkeyMultibaseSurveyInput;
  ok: boolean;
  updateable: boolean;
  refresh_action?: "update" | "noop" | "noop_structure_warning" | "blocked" | "error" | string;
  needs_update?: boolean;
  structure_warning_only?: boolean;
  issues?: string[];
};

export type SurveyMonkeyRefreshPlan = {
  ok: boolean;
  bases: SurveyMonkeyRefreshBasePlan[];
  campaign_suggestions?: Record<string, SurveyMonkeyRefreshCampaignSuggestion[]>;
  catalog?: {
    from_cache?: boolean;
    cache_status?: string;
    refresh_error?: string;
    catalog_fetched_at?: string | null;
  };
  message?: string;
};

export type SurveyMonkeyRefreshSelection = {
  base_name: string;
  campaigns?: SurveyMonkeyMultibaseSurveyInput[];
};

export type SurveyMonkeyRefreshResult = {
  ok: boolean;
  results: Array<{
    base_name: string;
    ok: boolean;
    skipped?: boolean;
    noop?: boolean;
    refresh_action?: string;
    reason?: string;
    n_new?: number;
    current_rows_before?: number | null;
    rows_after?: number | null;
    edited_rows_reported?: number | null;
    source_count?: number;
    raw_snapshot_regenerated?: boolean;
    raw_snapshot_file_id?: string | null;
    raw_snapshot_only?: boolean;
    data_refresh_blocked?: boolean;
    sources?: Array<{
      index?: number;
      survey_id?: string | null;
      source_title?: string | null;
      source_alias?: string | null;
      channel?: string | null;
      refreshed?: boolean;
      status?: string | null;
      reason?: string | null;
    }>;
    codificacion_job?: { ok?: boolean; job_id?: string; kind?: string; base_name?: string; error?: string } | null;
  }>;
  codificacion_jobs?: Array<{ ok?: boolean; job_id?: string; kind?: string; base_name?: string; error?: string }>;
  plan: SurveyMonkeyRefreshPlan;
  estudio: EstudioPayload;
};

export async function apiSurveyMonkeyMultibaseListSurveys(
  q = "",
  limit = 200,
  months = 6,
  options: { forceRefresh?: boolean; profile_id?: string; connection_profile_id?: string } = {},
) {
  const payload: Record<string, unknown> = { q, limit, months };
  if (options.forceRefresh) payload.force_refresh = true;
  if (options.profile_id || options.connection_profile_id) {
    payload.profile_id = options.profile_id ?? options.connection_profile_id;
  }
  const raw = await handle<unknown>(
    await apiFetch("/api/surveymonkey/multibase/surveys", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  const arr = Array.isArray(r.surveys) ? (r.surveys as Record<string, unknown>[]) : [];
  return {
    ok: true as const,
    from_cache: Boolean(r.from_cache),
    cache_status: String(r.cache_status ?? ""),
    refresh_error: String(r.refresh_error ?? ""),
    catalog_fetched_at: r.catalog_fetched_at == null || r.catalog_fetched_at === "NA" ? null : String(r.catalog_fetched_at),
    catalog_age_seconds: r.catalog_age_seconds == null || r.catalog_age_seconds === "NA" ? null : Number(r.catalog_age_seconds),
    catalog_count: Number(r.catalog_count ?? r.total_visible ?? arr.length),
    total_visible: Number(r.total_visible ?? arr.length),
    total_recent: Number(r.total_recent ?? arr.length),
    months: Number(r.months ?? months),
    count: Number(r.count ?? arr.length),
    surveys: arr.map((s): SurveyMonkeyMultibaseListItem => ({
      id: String(s.id ?? ""),
      title: String(s.title ?? "(sin título)"),
      nickname: s.nickname == null || s.nickname === "NA" ? null : String(s.nickname),
      date_modified: s.date_modified == null || s.date_modified === "NA" ? null : String(s.date_modified),
      pais_guess: s.pais_guess == null || s.pais_guess === "NA" ? null : String(s.pais_guess),
      response_count: s.response_count == null || s.response_count === "NA" ? null : Number(s.response_count),
    })),
  };
}

export async function apiSurveyMonkeyMultibaseInspectSurvey(
  survey_id: string,
  response_limit = 5,
  base_url = "https://api.surveymonkey.com/v3",
  options: { profile_id?: string; connection_profile_id?: string } = {},
) {
  const payload: Record<string, unknown> = { survey_id, response_limit, base_url };
  if (options.profile_id || options.connection_profile_id) {
    payload.profile_id = options.profile_id ?? options.connection_profile_id;
  }
  const raw = await handle<unknown>(
    await apiFetch("/api/surveymonkey/multibase/inspect", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  const response = (r.responses ?? {}) as Record<string, unknown>;
  const pages = normalizeRecordArray(r.pages).map((page) => ({
    page_id: String(page.page_id ?? ""),
    title: String(page.title ?? ""),
    range_label: String(page.range_label ?? ""),
    question_count: Number(page.question_count ?? 0),
  }));
  const questions = normalizeRecordArray(r.questions).map((q) => ({
    pos: Number(q.pos ?? 0),
    page: Number(q.page ?? 0),
    qid: String(q.qid ?? ""),
    family: String(q.family ?? ""),
    subtype: String(q.subtype ?? ""),
    heading: String(q.heading ?? ""),
    n_choices: Number(q.n_choices ?? 0),
    n_rows: Number(q.n_rows ?? 0),
    n_cols: Number(q.n_cols ?? 0),
  }));
  const columns = normalizeRecordArray(r.columns).map((column) => ({
    name: String(column.name ?? ""),
    non_empty: Number(column.non_empty ?? 0),
    examples: Array.isArray(column.examples) ? column.examples.map(String) : [],
  }));
  const sampleRows = normalizeRecordArray(r.sample_rows).map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value ?? "")])),
  );
  return {
    ok: true as const,
    survey_id: String(r.survey_id ?? survey_id),
    title: String(r.title ?? ""),
    language: String(r.language ?? ""),
    n_pages: Number(r.n_pages ?? pages.length),
    n_questions: Number(r.n_questions ?? questions.length),
    n_required: Number(r.n_required ?? 0),
    n_validation: Number(r.n_validation ?? 0),
    pages,
    questions,
    responses: {
      available: Boolean(response.available),
      total: response.total == null || response.total === "NA" ? null : Number(response.total),
      returned: Number(response.returned ?? sampleRows.length),
      error: String(response.error ?? ""),
    },
    columns,
    sample_rows: sampleRows,
  };
}

export async function apiSurveyMonkeyMultibaseCollectors(
  survey_id: string,
  base_url = "https://api.surveymonkey.com/v3",
  options: { profile_id?: string; connection_profile_id?: string } = {},
) {
  const payload: Record<string, unknown> = { survey_id, base_url };
  if (options.profile_id || options.connection_profile_id) {
    payload.profile_id = options.profile_id ?? options.connection_profile_id;
  }
  const raw = await handle<unknown>(
    await apiFetch("/api/surveymonkey/multibase/collectors", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  const collectors = normalizeRecordArray(r.collectors).map((collector): SurveyMonkeyMultibaseCollector => ({
    id: String(collector.id ?? ""),
    name: String(collector.name ?? collector.id ?? ""),
    type: String(collector.type ?? ""),
    response_count: collector.response_count == null || collector.response_count === "NA" ? null : Number(collector.response_count),
    date_created: collector.date_created == null || collector.date_created === "NA" ? null : String(collector.date_created),
    date_modified: collector.date_modified == null || collector.date_modified === "NA" ? null : String(collector.date_modified),
  }));
  return {
    ok: true as const,
    survey_id: String(r.survey_id ?? survey_id),
    total: Number(r.total ?? collectors.length),
    collectors,
  };
}

export async function apiSurveyMonkeyMultibaseAudit(
  surveys: SurveyMonkeyMultibaseSurveyInput[],
  canonical_xlsform_file_id = "",
) {
  return handle<SurveyMonkeyMultibaseAudit>(
    await apiFetch("/api/surveymonkey/multibase/audit", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ surveys, canonical_xlsform_file_id }),
    }),
  );
}

export async function apiSurveyMonkeyMultibaseImport(payload: {
  surveys: SurveyMonkeyMultibaseSurveyInput[];
  base_name?: string;
  wording_decisions?: Record<string, string>;
  canonical_xlsform_file_id?: string;
}) {
  return handle<{
    ok: true;
    base: EstudioBase;
    estudio: EstudioPayload;
    audit: SurveyMonkeyMultibaseAudit;
    n_filas: number;
    n_columnas: number;
  }>(
    await apiFetch("/api/surveymonkey/multibase/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiSurveyMonkeyMultibaseImportIndependent(payload: {
  surveys: SurveyMonkeyMultibaseSurveyInput[];
  response_statuses?: string[];
  keep_missing_status?: boolean;
  canonical_xlsform_file_id?: string;
  use_canonical_xlsform_logic?: boolean;
  surveymonkey_logic_rules?: string;
  surveymonkey_logic_rules_by_survey?: Record<string, string>;
  logic_pages?: Record<string, string[]>;
  choice_order_overrides?: Record<string, string[]>;
  choice_code_maps?: ChoiceCodeMap[];
  replace_existing_logic?: boolean;
}) {
  return handle<{
    ok: true;
    processing_mode: "independent_siblings";
    active_base: string | null;
    bases: EstudioBase[];
    n_bases: number;
    estudio: EstudioPayload;
    audit: SurveyMonkeyMultibaseAudit;
    xlsform_logic_sync?: EstudioLogicSyncResult | null;
  }>(
    await apiFetch("/api/surveymonkey/multibase/import-independent", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiSurveyMonkeyMultibaseApplyCanonicalXlsformLogic(payload: {
  canonical_xlsform_file_id?: string;
  targets?: string[];
  clear_target_logic?: boolean;
}) {
  return handle<EstudioLogicSyncResult>(
    await apiFetch("/api/surveymonkey/multibase/apply-canonical-xlsform-logic", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

function normalizeWorkbookStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "")).filter(Boolean);
}

function normalizeWorkbookNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
}

function normalizeWorkbookInspection(raw: unknown): SurveyMonkeyWorkbookInspection {
  const r = (raw ?? {}) as Record<string, unknown>;
  const sheets = normalizeRecordArray(r.sheets).map((sheet): SurveyMonkeyWorkbookSheetInspection => ({
    sheet_name: String(sheet.sheet_name ?? ""),
    base_name: sheet.base_name == null || sheet.base_name === "NA" ? null : String(sheet.base_name),
    matched: Boolean(sheet.matched),
    blocking: Boolean(sheet.blocking),
    n_rows: Number(sheet.n_rows ?? 0),
    n_columns: Number(sheet.n_columns ?? 0),
    n_output_columns: sheet.n_output_columns == null || sheet.n_output_columns === "NA" ? undefined : Number(sheet.n_output_columns),
    recognized_headers: Number(sheet.recognized_headers ?? 0),
    mapped_headers: normalizeRecordArray(sheet.mapped_headers).map((header): SurveyMonkeyWorkbookMappedHeader => ({
      source: String(header.source ?? ""),
      kind: String(header.kind ?? ""),
      variable: header.variable == null || header.variable === "NA" ? undefined : String(header.variable),
      code: header.code == null || header.code === "NA" ? undefined : String(header.code),
      columns: normalizeWorkbookStringArray(header.columns),
    })),
    unknown_headers: normalizeWorkbookStringArray(sheet.unknown_headers),
    ambiguous_headers: normalizeWorkbookStringArray(sheet.ambiguous_headers),
    missing_variables: normalizeWorkbookStringArray(sheet.missing_variables),
    blank_filled_variables: normalizeWorkbookStringArray(sheet.blank_filled_variables),
    cell_errors: normalizeRecordArray(sheet.cell_errors).map((err): SurveyMonkeyWorkbookCellError => ({
      source: String(err.source ?? ""),
      kind: String(err.kind ?? ""),
      variable: err.variable == null || err.variable === "NA" ? undefined : String(err.variable),
      code: err.code == null || err.code === "NA" ? undefined : String(err.code),
      n_errors: Number(err.n_errors ?? 0),
      rows: normalizeWorkbookNumberArray(err.rows),
    })),
    n_cell_errors: sheet.n_cell_errors == null || sheet.n_cell_errors === "NA" ? undefined : Number(sheet.n_cell_errors),
    warnings: normalizeWorkbookStringArray(sheet.warnings),
  }));
  return {
    ok: Boolean(r.ok),
    file_id: String(r.file_id ?? ""),
    filename: String(r.filename ?? ""),
    n_sheets: Number(r.n_sheets ?? sheets.length),
    n_matched: Number(r.n_matched ?? sheets.filter((sheet) => sheet.matched && !sheet.blocking).length),
    n_blocking: Number(r.n_blocking ?? sheets.filter((sheet) => sheet.blocking).length),
    blocking_sheets: normalizeWorkbookStringArray(r.blocking_sheets),
    sheets,
    warnings: normalizeWorkbookStringArray(r.warnings),
  };
}

export async function apiSurveyMonkeyMultibaseWorkbookInspect(payload: {
  file_id: string;
  sheet_base_map?: Record<string, string>;
  missing_required_policy?: "fill_blank_warn" | string;
}) {
  const raw = await handle<unknown>(
    await apiFetch("/api/surveymonkey/multibase/workbook/inspect", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
  return normalizeWorkbookInspection(raw);
}

export async function apiSurveyMonkeyMultibaseWorkbookImport(payload: {
  file_id: string;
  sheet_base_map?: Record<string, string>;
  missing_required_policy?: "fill_blank_warn" | string;
}) {
  const raw = await handle<unknown>(
    await apiFetch("/api/surveymonkey/multibase/workbook/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    ok: Boolean(r.ok) as true,
    file_id: String(r.file_id ?? payload.file_id),
    filename: String(r.filename ?? ""),
    imported_bases: Number(r.imported_bases ?? 0),
    results: normalizeRecordArray(r.results).map((row) => ({
      base_name: String(row.base_name ?? ""),
      sheet_name: String(row.sheet_name ?? ""),
      data_file_id: String(row.data_file_id ?? ""),
      snapshot_file_id: String(row.snapshot_file_id ?? ""),
      n_rows: Number(row.n_rows ?? 0),
      n_columns: Number(row.n_columns ?? 0),
      warnings: normalizeWorkbookStringArray(row.warnings),
      base: row.base as EstudioBase | undefined,
    })),
    inspection: normalizeWorkbookInspection(r.inspection),
    estudio: r.estudio as EstudioPayload,
  } satisfies SurveyMonkeyWorkbookImportResult;
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === "NA") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeSavBundleChangePlan(raw: unknown): SurveyMonkeySavBundleChangePlan {
  const r = (raw ?? {}) as Record<string, unknown>;
  const current = (r.current ?? {}) as Record<string, unknown>;
  const incoming = (r.incoming ?? {}) as Record<string, unknown>;
  const impact = (r.impact ?? {}) as Record<string, unknown>;
  const effects = (r.effects ?? {}) as Record<string, unknown>;
  return {
    action: String(r.action ?? "replace_data"),
    base_name: String(r.base_name ?? ""),
    source_file: String(r.source_file ?? ""),
    current: {
      n_rows: nullableNumber(current.n_rows),
      n_columns: nullableNumber(current.n_columns),
      data_file_id: String(current.data_file_id ?? ""),
      xlsform_file_id: String(current.xlsform_file_id ?? ""),
    },
    incoming: {
      raw_rows: Number(incoming.raw_rows ?? 0),
      raw_columns: Number(incoming.raw_columns ?? 0),
      normalized_rows: Number(incoming.normalized_rows ?? 0),
      normalized_columns: Number(incoming.normalized_columns ?? 0),
    },
    impact: {
      rows_delta: nullableNumber(impact.rows_delta),
      columns_delta: nullableNumber(impact.columns_delta),
      expected_variables: Number(impact.expected_variables ?? 0),
      matched_variables: Number(impact.matched_variables ?? 0),
      missing_variables: normalizeWorkbookStringArray(impact.missing_variables),
      blank_filled_variables: normalizeWorkbookStringArray(impact.blank_filled_variables),
      all_empty_variables: normalizeWorkbookStringArray(impact.all_empty_variables),
      metadata_columns: normalizeWorkbookStringArray(impact.metadata_columns),
    },
    effects: {
      xlsform: String(effects.xlsform ?? "preserved"),
      data: String(effects.data ?? "replaced"),
      invalidates: normalizeWorkbookStringArray(effects.invalidates),
    },
  };
}

function normalizeSavBundleInstrumentRevision(raw: unknown): SurveyMonkeySavBundleInstrumentRevision {
  const r = (raw ?? {}) as Record<string, unknown>;
  const rawStatus = String(r.status ?? "blocked");
  const status: SurveyMonkeySavBundleInstrumentRevision["status"] = (
    rawStatus === "pinned_healthy" || rawStatus === "legacy_unpinned"
  ) ? rawStatus : "blocked";
  return {
    status,
    healthy: typeof r.healthy === "boolean" ? r.healthy : null,
    revision_id: String(r.revision_id ?? ""),
    revision_hash: String(r.revision_hash ?? ""),
    base_revision_hash: String(r.base_revision_hash ?? ""),
    base_xlsform_file_id: String(r.base_xlsform_file_id ?? ""),
    revision_xlsform_file_id: String(r.revision_xlsform_file_id ?? ""),
    reasons: normalizeWorkbookStringArray(r.reasons),
    warning: String(r.warning ?? ""),
  };
}

function savNormalizationRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function savNormalizationRecords(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

function savNormalizationString(value: unknown, fallback = ""): string {
  if (value == null || value === "NA") return fallback;
  return String(value).trim();
}

function savNormalizationCount(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeSavNormalizationSourceColumn(raw: unknown): SurveyMonkeySavNormalizationSourceColumn | null {
  if (typeof raw === "string" || typeof raw === "number") {
    const name = savNormalizationString(raw);
    return name ? { name, storage_type: "", label: "", labelled: null } : null;
  }
  const row = savNormalizationRecord(raw);
  if (!row) return null;
  const name = savNormalizationString(row.name ?? row.column ?? row.source);
  if (!name) return null;
  return {
    name,
    storage_type: savNormalizationString(row.storage_type ?? row.type),
    label: savNormalizationString(row.label ?? row.variable_label),
    labelled: typeof row.labelled === "boolean" ? row.labelled : null,
  };
}

function normalizeSavNormalizationXlsform(raw: unknown): SurveyMonkeySavNormalizationXlsform | null {
  const row = savNormalizationRecord(raw);
  if (!row) return null;
  const name = savNormalizationString(row.name ?? row.variable);
  if (!name) return null;
  return {
    name,
    label: savNormalizationString(row.label),
    type: savNormalizationString(row.type),
    type_base: savNormalizationString(row.type_base ?? row.base_type),
    list_name: savNormalizationString(row.list_name ?? row.catalog),
  };
}

function normalizeSavNormalizationOperation(raw: unknown): SurveyMonkeySavNormalizationOperation | null {
  if (typeof raw === "string" || typeof raw === "number") {
    const kind = savNormalizationString(raw);
    return kind ? { kind, label: kind, detail: "", source: "", target: "" } : null;
  }
  const row = savNormalizationRecord(raw);
  if (!row) return null;
  const kind = savNormalizationString(row.kind ?? row.operation ?? row.code ?? row.type, "transform");
  return {
    kind,
    label: savNormalizationString(row.label ?? row.title, kind),
    detail: savNormalizationString(row.detail ?? row.message ?? row.description),
    source: savNormalizationString(row.source ?? row.from ?? row.before),
    target: savNormalizationString(row.target ?? row.to ?? row.after),
  };
}

function normalizeSavNormalizationChoice(raw: unknown): SurveyMonkeySavNormalizationCatalogChoice | null {
  if (typeof raw === "string" || typeof raw === "number") {
    const value = savNormalizationString(raw);
    return value ? { name: value, value, label: "" } : null;
  }
  const row = savNormalizationRecord(raw);
  if (!row) return null;
  const value = savNormalizationString(row.value ?? row.name ?? row.code);
  if (!value) return null;
  return { name: value, value, label: savNormalizationString(row.label ?? row.text) };
}

function normalizeSavNormalizationMapping(raw: unknown): SurveyMonkeySavNormalizationCatalogMapping | null {
  if (Array.isArray(raw)) {
    const source = savNormalizationString(raw[0]);
    const target = savNormalizationString(raw[1]);
    return source || target ? {
      source_code: source,
      source_column: "",
      source_label: "",
      xls_code: target,
      xls_label: "",
      match: "",
      source,
      target,
      target_label: "",
    } : null;
  }
  const row = savNormalizationRecord(raw);
  if (!row) return null;
  const source = savNormalizationString(row.source_code ?? row.source ?? row.from ?? row.source_value ?? row.sav);
  const target = savNormalizationString(row.xls_code ?? row.target ?? row.to ?? row.target_value ?? row.xlsform);
  if (!source && !target) return null;
  return {
    source_code: source,
    source_column: savNormalizationString(row.source_column ?? row.column),
    source_label: savNormalizationString(row.source_label ?? row.from_label),
    xls_code: target,
    xls_label: savNormalizationString(row.xls_label ?? row.target_label ?? row.to_label),
    match: savNormalizationString(row.match ?? row.status),
    source,
    target,
    target_label: savNormalizationString(row.xls_label ?? row.target_label ?? row.to_label),
  };
}

function normalizeSavNormalizationCatalog(raw: unknown): SurveyMonkeySavNormalizationCatalog | null {
  const row = savNormalizationRecord(raw);
  if (!row) return null;
  return {
    list_name: savNormalizationString(row.list_name ?? row.name),
    origin: savNormalizationString(row.origin ?? row.source),
    sealed_sha256: savNormalizationString(row.sealed_sha256 ?? row.sha256 ?? row.fingerprint),
    choices: savNormalizationRecords(row.choices)
      .map(normalizeSavNormalizationChoice)
      .filter((item): item is SurveyMonkeySavNormalizationCatalogChoice => item != null),
    mappings: savNormalizationRecords(row.mappings ?? row.mapping)
      .map(normalizeSavNormalizationMapping)
      .filter((item): item is SurveyMonkeySavNormalizationCatalogMapping => item != null),
  };
}

function normalizeSavNormalizationAlert(raw: unknown): SurveyMonkeySavNormalizationAlert | null {
  if (typeof raw === "string" || typeof raw === "number") {
    const message = savNormalizationString(raw);
    return message ? { severity: "warning", code: "", count: 1, variables: [], message } : null;
  }
  const row = savNormalizationRecord(raw);
  if (!row) return null;
  const rawSeverity = savNormalizationString(row.severity ?? row.level ?? row.tone).toLowerCase();
  const severity: SurveyMonkeySavNormalizationAlert["severity"] = rawSeverity === "error"
    ? "error"
    : rawSeverity === "info"
      ? "info"
      : "warning";
  const message = savNormalizationString(row.message ?? row.detail ?? row.label ?? row.code);
  if (!message) return null;
  return {
    severity,
    code: savNormalizationString(row.code),
    count: savNormalizationCount(row.count, 1),
    variables: normalizeWorkbookStringArray(row.variables),
    message,
  };
}

function normalizeSavNormalizationVariable(raw: unknown, index: number): SurveyMonkeySavNormalizationVariable | null {
  const row = savNormalizationRecord(raw);
  if (!row) return null;
  const sourceColumns = savNormalizationRecords(row.source_columns ?? row.sources)
    .map(normalizeSavNormalizationSourceColumn)
    .filter((item): item is SurveyMonkeySavNormalizationSourceColumn => item != null);
  const xlsform = normalizeSavNormalizationXlsform(row.xlsform ?? row.target);
  const rawStatus = savNormalizationString(row.status).toLowerCase();
  const status: SurveyMonkeySavNormalizationStatus = (
    rawStatus === "unchanged" || rawStatus === "transformed" || rawStatus === "source_only"
  ) ? rawStatus : "warning";
  const id = savNormalizationString(row.id ?? row.variable, xlsform?.name || sourceColumns[0]?.name || `variable-${index + 1}`);
  return {
    id,
    variable: savNormalizationString(row.variable, id),
    source_columns: sourceColumns,
    xlsform,
    status,
    operations: savNormalizationRecords(row.operations)
      .map(normalizeSavNormalizationOperation)
      .filter((item): item is SurveyMonkeySavNormalizationOperation => item != null),
    catalog: normalizeSavNormalizationCatalog(row.catalog),
    alerts: savNormalizationRecords(row.alerts)
      .map(normalizeSavNormalizationAlert)
      .filter((item): item is SurveyMonkeySavNormalizationAlert => item != null),
  };
}

function normalizeSavNormalizationReview(raw: unknown): SurveyMonkeySavNormalizationReview | null {
  const row = savNormalizationRecord(raw);
  if (!row) return null;
  const variables = savNormalizationRecords(row.variables)
    .map(normalizeSavNormalizationVariable)
    .filter((item): item is SurveyMonkeySavNormalizationVariable => item != null);
  const summary = savNormalizationRecord(row.summary) ?? {};
  const statusCounts = savNormalizationRecord(summary.status_counts) ?? summary;
  const operationCounts = savNormalizationRecord(summary.operation_counts) ?? {};
  const alerts = savNormalizationRecords(row.alerts)
    .map(normalizeSavNormalizationAlert)
    .filter((item): item is SurveyMonkeySavNormalizationAlert => item != null);
  const variablesWithAlerts = variables.map((variable) => {
    const names = new Set([
      variable.id,
      variable.variable,
      variable.xlsform?.name ?? "",
      ...variable.source_columns.map((column) => column.name),
    ].filter(Boolean));
    const related = alerts.filter((alert) => alert.variables.some((name) => names.has(name)));
    return { ...variable, alerts: [...variable.alerts, ...related] };
  });
  const countStatus = (status: SurveyMonkeySavNormalizationStatus) => variablesWithAlerts.filter((variable) => variable.status === status).length;
  return {
    schema: savNormalizationString(row.schema),
    normalizer_contract: savNormalizationString(row.normalizer_contract ?? row.contract),
    fingerprint: savNormalizationString(row.fingerprint ?? row.sha256),
    privacy: {
      response_values_included: false,
      direct_identifier_values_included: false,
      free_text_values_included: false,
      schema_names_included: true,
      xlsform_labels_included: true,
      choice_catalog_included: true,
    },
    summary: {
      total_variables: savNormalizationCount(summary.total_variables ?? summary.total ?? summary.variables ?? summary.n_variables, variables.length),
      expected_variables: savNormalizationCount(
        summary.expected_variables,
        variablesWithAlerts.filter((variable) => variable.xlsform != null).length,
      ),
      source_only_variables: savNormalizationCount(summary.source_only_variables, countStatus("source_only")),
      status_counts: {
        unchanged: savNormalizationCount(statusCounts.unchanged ?? summary.n_unchanged, countStatus("unchanged")),
        transformed: savNormalizationCount(statusCounts.transformed ?? summary.n_transformed, countStatus("transformed")),
        warning: savNormalizationCount(statusCounts.warning ?? statusCounts.warnings ?? summary.n_warning, countStatus("warning")),
        source_only: savNormalizationCount(statusCounts.source_only ?? summary.n_source_only, countStatus("source_only")),
      },
      operation_counts: Object.fromEntries(
        Object.entries(operationCounts).map(([key, value]) => [key, savNormalizationCount(value, 0)]),
      ),
      alerts: savNormalizationCount(summary.alerts, alerts.reduce((sum, alert) => sum + alert.count, 0)),
    },
    alerts,
    variables: variablesWithAlerts,
  };
}

function normalizeSavBundleInspection(raw: unknown): SurveyMonkeySavBundleInspection {
  const r = (raw ?? {}) as Record<string, unknown>;
  const files = normalizeRecordArray(r.files).map((file): SurveyMonkeySavBundleFileInspection => ({
    file_name: String(file.file_name ?? ""),
    entry_name: String(file.entry_name ?? ""),
    base_name: file.base_name == null || file.base_name === "NA" ? null : String(file.base_name),
    matched: Boolean(file.matched),
    blocking: Boolean(file.blocking),
    action: String(file.action ?? "replace_data"),
    n_rows: Number(file.n_rows ?? 0),
    n_columns: Number(file.n_columns ?? 0),
    n_output_columns: Number(file.n_output_columns ?? 0),
    expected_variables: Number(file.expected_variables ?? 0),
    matched_variables: Number(file.matched_variables ?? 0),
    missing_variables: normalizeWorkbookStringArray(file.missing_variables),
    blank_filled_variables: normalizeWorkbookStringArray(file.blank_filled_variables),
    all_empty_variables: normalizeWorkbookStringArray(file.all_empty_variables),
    metadata_columns: normalizeWorkbookStringArray(file.metadata_columns),
    instrument_revision: normalizeSavBundleInstrumentRevision(file.instrument_revision),
    normalization_review: normalizeSavNormalizationReview(file.normalization_review),
    warnings: normalizeWorkbookStringArray(file.warnings),
    change_plan: normalizeSavBundleChangePlan(file.change_plan),
  }));
  return {
    ok: Boolean(r.ok),
    file_id: String(r.file_id ?? ""),
    filename: String(r.filename ?? ""),
    n_files: Number(r.n_files ?? files.length),
    n_matched: Number(r.n_matched ?? files.filter((file) => file.matched && !file.blocking).length),
    n_blocking: Number(r.n_blocking ?? files.filter((file) => file.blocking).length),
    blocking_files: normalizeWorkbookStringArray(r.blocking_files),
    inspection_fingerprint: String(r.inspection_fingerprint ?? ""),
    files,
    change_plan: files,
    warnings: normalizeWorkbookStringArray(r.warnings),
  };
}

export async function apiSurveyMonkeyMultibaseSavBundleInspect(payload: {
  file_id: string;
  file_base_map?: Record<string, string>;
  missing_required_policy: SurveyMonkeySavBundleMissingRequiredPolicy;
}) {
  const raw = await handle<unknown>(
    await apiFetch("/api/surveymonkey/multibase/sav-bundle/inspect", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
  return normalizeSavBundleInspection(raw);
}

export async function apiSurveyMonkeyMultibaseSavBundleImport(payload: {
  file_id: string;
  file_base_map: Record<string, string>;
  missing_required_policy: SurveyMonkeySavBundleMissingRequiredPolicy;
  expected_inspection_fingerprint: string;
}) {
  const raw = await handle<unknown>(
    await apiFetch("/api/surveymonkey/multibase/sav-bundle/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    ok: Boolean(r.ok) as true,
    file_id: String(r.file_id ?? payload.file_id),
    filename: String(r.filename ?? ""),
    imported_bases: Number(r.imported_bases ?? 0),
    results: normalizeRecordArray(r.results).map((row) => ({
      base_name: String(row.base_name ?? ""),
      file_name: String(row.file_name ?? ""),
      entry_name: String(row.entry_name ?? ""),
      data_file_id: String(row.data_file_id ?? ""),
      snapshot_file_id: String(row.snapshot_file_id ?? ""),
      n_rows: Number(row.n_rows ?? 0),
      n_columns: Number(row.n_columns ?? 0),
      warnings: normalizeWorkbookStringArray(row.warnings),
      change_plan: normalizeSavBundleChangePlan(row.change_plan),
      base: row.base as EstudioBase | undefined,
    })),
    inspection: normalizeSavBundleInspection(r.inspection),
    estudio: r.estudio as EstudioPayload,
  } satisfies SurveyMonkeySavBundleImportResult;
}

export async function apiSurveyMonkeyMultibaseDecisionPreview(payload: {
  base_name: string;
  policy?: SurveyMonkeyDecisionPolicy | null;
}) {
  return handle<{
    ok: true;
    base_name: string;
    policy: SurveyMonkeyDecisionPolicy;
    audit: SurveyMonkeyDecisionAudit;
    n_filas_preview: number;
    n_columnas_preview: number;
  }>(
    await apiFetch("/api/surveymonkey/multibase/decision-preview", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiSurveyMonkeyMultibaseDecisionApply(payload: {
  base_name: string;
  policy?: SurveyMonkeyDecisionPolicy | null;
  regenerate_data?: boolean;
  force_replace_adapted?: boolean;
}) {
  return handle<{
    ok: true;
    base_name: string;
    policy: SurveyMonkeyDecisionPolicy;
    audit: SurveyMonkeyDecisionAudit;
    generated_file_id?: string | null;
    replaced_active?: boolean;
    kept_adapted_data?: boolean;
    kept_downstream_data?: boolean;
    estudio: EstudioPayload;
  }>(
    await apiFetch("/api/surveymonkey/multibase/decision-apply", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiSurveyMonkeyMultibaseRefreshPlan(payload: {
  bases?: SurveyMonkeyRefreshSelection[];
  months?: number;
  force_refresh?: boolean;
} = {}) {
  return handle<SurveyMonkeyRefreshPlan>(
    await apiFetch("/api/surveymonkey/multibase/refresh-plan", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiSurveyMonkeyMultibaseRefresh(payload: {
  bases?: SurveyMonkeyRefreshSelection[];
  months?: number;
  force_refresh?: boolean;
  reapply_codificacion?: boolean;
  regenerate_raw_snapshot?: boolean;
  raw_snapshot_only?: boolean;
}) {
  return handle<SurveyMonkeyRefreshResult>(
    await apiFetch("/api/surveymonkey/multibase/refresh", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}
