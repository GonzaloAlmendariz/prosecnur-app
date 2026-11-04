// Funciones y tipos puros del panel de bases de Carga (SurveyMonkey, Kobo,
// fuentes independientes): sin JSX ni estado. Salieron de BasesPanel.tsx
// (L6, 2026-10-28) para que el asistente independiente pueda vivir en su
// propia carpeta; BasesPanel los reexporta para no romper a sus consumidores.

import { type ClipboardEvent, type KeyboardEvent } from "react";
import { Database, Mail, MessageCircle, PhoneCall, QrCode, Route } from "lucide-react";
import type { EstudioBase, EstudioMultiIntegrated, EstudioPayload, EstudioProcessingSuggestionGroup, EstudioProcessingSuggestionSource, EstudioProcessingSuggestions, KoboIndependentAssetInput, SurveyMonkeyMultibaseSurveyInput, SurveyMonkeyMultibaseAudit, SurveyMonkeyMultibaseCollector, SurveyMonkeyDecisionAudit, SurveyMonkeyDecisionPolicy, SurveyMonkeyDecisionSourceAudit, SurveyMonkeyMultibaseListItem, SurveyMonkeyRefreshBasePlan, SurveyMonkeyRefreshResult, SurveyMonkeyWorkbookInspection, RuleInterpretation } from "../../../api/client";
import { smRefreshAction } from "../smEstructuraFuente";
import type { SmImportScopeDraft, SmImportScopeFields } from "../store";
import { formatoConteo } from "../../../lib/formatoNumero";

export function smNormalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function smSurveyTitle(item: SurveyMonkeyMultibaseListItem) {
  return item.nickname || item.title || item.id;
}

export function smSurveyMatchesQuery(item: SurveyMonkeyMultibaseListItem, query: string) {
  const q = smNormalizeSearch(query);
  if (!q) return true;
  const haystack = smNormalizeSearch([
    item.id,
    item.title,
    item.nickname ?? "",
    item.pais_guess ?? "",
  ].join(" "));
  return q.split(" ").filter(Boolean).every((token) => haystack.includes(token));
}

export function smSurveyIdsFromSpec(spec?: SurveyMonkeyMultibaseSurveyInput | null): string[] {
  if (!spec) return [];
  const sources = spec.sources ?? spec.campaigns ?? [];
  return [
    String(spec.survey_id || "").trim(),
    ...sources.flatMap((source) => smSurveyIdsFromSpec(source)),
  ].filter(Boolean);
}

export function smSurveyIdsFromFilter(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const direct = String(record.survey_id ?? record.id ?? "").trim();
  const sources = Array.isArray(record.sources) ? record.sources : [];
  return [
    direct,
    ...sources.flatMap((source) => smSurveyIdsFromFilter(source)),
  ].filter(Boolean);
}

export function smSurveyIdsFromBase(base: EstudioBase) {
  return Array.from(new Set([
    String(base.survey_id || "").trim(),
    ...smSurveyIdsFromSpec(base.surveymonkey_source_spec),
    ...smSurveyIdsFromFilter(base.response_filter),
  ].filter(Boolean)));
}

export function smSurveyCatalogAvailability(
  surveys: SurveyMonkeyMultibaseListItem[] | null | undefined,
  query: string,
  existingSurveyIds: Iterable<string>,
  selectedSurveyIds: Iterable<string>,
) {
  const existing = new Set(Array.from(existingSurveyIds).map((id) => String(id).trim()).filter(Boolean));
  const selected = new Set(Array.from(selectedSurveyIds).map((id) => String(id).trim()).filter(Boolean));
  const matched = (surveys ?? []).filter((item) => smSurveyMatchesQuery(item, query));
  const duplicates = matched.filter((item) => existing.has(item.id) || selected.has(item.id));
  const available = matched.filter((item) => !existing.has(item.id) && !selected.has(item.id));
  return { matched, available, duplicates };
}

export function smDuplicateSurveyAlert(
  duplicates: SurveyMonkeyMultibaseListItem[],
  existingSurveyIds: Set<string>,
  selectedSurveyIds: Set<string>,
) {
  if (!duplicates.length) return "";
  const loaded = duplicates.filter((item) => existingSurveyIds.has(item.id)).length;
  const selected = duplicates.filter((item) => selectedSurveyIds.has(item.id)).length;
  const parts = [
    loaded ? `${loaded} ya ${loaded === 1 ? "está cargada" : "están cargadas"}` : "",
    selected ? `${selected} ya ${selected === 1 ? "está seleccionada" : "están seleccionadas"}` : "",
  ].filter(Boolean);
  const examples = duplicates.slice(0, 3).map((item) => smSurveyTitle(item)).join(", ");
  return `Se ocultaron ${duplicates.length} coincidencia${duplicates.length === 1 ? "" : "s"} repetida${duplicates.length === 1 ? "" : "s"} (${parts.join("; ")}). ${examples}`;
}

export function smBaseSlug(value: string) {
  const slug = smNormalizeSearch(value).replace(/\s+/g, "_").replace(/^_+|_+$/g, "");
  return slug || "base_1";
}

export function smIndependentBaseTitle(base: EstudioBase | null | undefined, estudio: EstudioPayload) {
  const raw = [
    base?.source_alias,
    base?.source_title,
    estudio.nombre,
    base?.xlsform_file_name,
    base?.data_file_name,
    base?.nombre,
  ].find((item) => String(item ?? "").trim() && String(item ?? "").trim() !== "NA");
  const value = String(raw ?? "").replace(/\.(xlsx|xls|sav|csv)$/i, "");
  const upper = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const careers: Array<[string, string]> = [
    ["CIVIL", "Ingeniería Civil"],
    ["INDUSTRIAL", "Ingeniería Industrial"],
    ["GEOLOGICA", "Ingeniería Geológica"],
    ["MINAS", "Ingeniería de Minas"],
    ["ELECTRONICA", "Ingeniería Electrónica"],
    ["MECANICA", "Ingeniería Mecánica"],
    ["MECATRONICA", "Ingeniería Mecatrónica"],
    ["INFORMATICA", "Ingeniería Informática"],
    ["TELECOM", "Ingeniería de Telecomunicaciones"],
  ];
  const match = careers.find(([token]) => upper.includes(token));
  if (match) return match[1];
  return value
    .replace(/_/g, " ")
    .replace(/\b(instrumento|adaptado|data|base|codificacion|encuesta|egresados)\b/gi, " ")
    .replace(/\b\d{1,2} \d{1,2} \d{2,4}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Base existente";
}

export function smExistingBaseLabel(base: EstudioBase) {
  return String(base.source_alias || base.source_title || base.nombre || "").trim() || base.nombre;
}

export function smCompactSurveyLikeLabel(value: string) {
  const cleaned = String(value || "")
    .replace(/_/g, " ")
    .replace(/\bAcreditaci[oó]n\b/gi, " ")
    .replace(/\bEncuesta\s+a\s+(?:E|A)gresados?\b/gi, " ")
    .replace(/\bEncuesta\b/gi, " ")
    .replace(/\b(?:E|A)gresados?\b/gi, " ")
    .replace(/\s*[-–—]\s*/g, " ")
    .replace(/\s+\ba\b\s*$/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || String(value || "").trim();
}

export function smExistingBaseTargetLabel(base: EstudioBase) {
  return smCompactSurveyLikeLabel(smExistingBaseLabel(base));
}

export function smMeaningfulTokens(value: string) {
  const stop = new Set([
    "acreditacion",
    "encuesta",
    "encuestas",
    "egresado",
    "egresados",
    "agresado",
    "agresados",
    "ingenieria",
    "ingenierias",
    "base",
    "data",
    "de",
    "del",
    "la",
    "las",
    "los",
    "a",
    "y",
    "pucp",
  ]);
  return smNormalizeSearch(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stop.has(token));
}

export function smExistingBaseTargetScore(item: SurveyMonkeyMultibaseListItem, base: EstudioBase) {
  const surveyAlias = smNormalizeSearch(smSurveyDefaultAlias(item));
  const surveyTitle = smNormalizeSearch(smSurveyTitle(item));
  const baseLabel = smNormalizeSearch(smExistingBaseLabel(base));
  const baseTitle = smNormalizeSearch(String(base.source_title || base.xlsform_file_name || base.data_file_name || base.nombre || ""));
  const candidates = [baseLabel, baseTitle, smNormalizeSearch(base.nombre)].filter(Boolean);
  if (!surveyAlias || !candidates.length) return 0;
  if (candidates.some((candidate) => candidate === surveyAlias)) return 1.5;
  if (candidates.some((candidate) => candidate.includes(surveyAlias) || surveyAlias.includes(candidate))) return 1.2;
  if (candidates.some((candidate) => surveyTitle.includes(candidate))) return 1.05;

  const surveyTokens = new Set(smMeaningfulTokens(`${surveyAlias} ${surveyTitle}`));
  const baseTokens = new Set(smMeaningfulTokens(candidates.join(" ")));
  if (!surveyTokens.size || !baseTokens.size) return 0;
  const overlap = Array.from(surveyTokens).filter((token) => baseTokens.has(token)).length;
  return overlap / Math.max(1, Math.min(surveyTokens.size, baseTokens.size));
}

export function smBestExistingBaseTarget(item: SurveyMonkeyMultibaseListItem, bases: EstudioBase[]) {
  let best = { baseName: "", score: 0 };
  for (const base of bases) {
    const score = smExistingBaseTargetScore(item, base);
    if (score > best.score) best = { baseName: base.nombre, score };
  }
  return best.score >= 0.58 ? best.baseName : "";
}

export function smWorkbookInspectionWarningCount(inspection?: SurveyMonkeyWorkbookInspection | null) {
  if (!inspection) return 0;
  const sheetWarnings = inspection.sheets.reduce((sum, sheet) => sum + sheet.warnings.length, 0);
  return inspection.warnings.length + sheetWarnings;
}

export function smWorkbookInspectionCellErrorCount(inspection?: SurveyMonkeyWorkbookInspection | null) {
  if (!inspection) return 0;
  return inspection.sheets.reduce((sum, sheet) => sum + (sheet.n_cell_errors ?? 0), 0);
}

export function smWorkbookInspectionCanImport(inspection?: SurveyMonkeyWorkbookInspection | null) {
  return !!inspection && inspection.ok && inspection.n_matched > 0 && inspection.n_blocking === 0;
}

export function smWorkbookMissingLabel(sheet: SurveyMonkeyWorkbookInspection["sheets"][number]) {
  const count = sheet.missing_variables.length;
  if (!count) return "Sin variables faltantes";
  const sample = sheet.missing_variables.slice(0, 4).join(", ");
  return `${count} faltante${count === 1 ? "" : "s"}${sample ? `: ${sample}${count > 4 ? ", ..." : ""}` : ""}`;
}

export function smWorkbookSheetIssueLabel(sheet: SurveyMonkeyWorkbookInspection["sheets"][number]) {
  const nCellErrors = sheet.n_cell_errors ?? 0;
  if (nCellErrors > 0) return `${nCellErrors} celdas con error Excel`;
  return sheet.warnings[0] || "Lista para aplicar";
}

export function smWorkbookSheetIssueTitle(sheet: SurveyMonkeyWorkbookInspection["sheets"][number]) {
  const notes = [...sheet.warnings];
  if ((sheet.n_cell_errors ?? 0) > 0) {
    const sample = (sheet.cell_errors ?? [])
      .slice(0, 3)
      .map((err) => `${err.source}${err.variable ? ` → ${err.variable}` : ""}: ${err.n_errors}`)
      .join(", ");
    notes.push(`Errores Excel detectados${sample ? `: ${sample}` : ""}`);
  }
  return notes.join(", ");
}

export const INDEPENDENT_SIBLINGS_MAX_BASES = 10;

export const SM_CHANNEL_OPTIONS = ["Correo", "Telefónico", "WhatsApp", "Ficha QR", "SMS", "Mixto"] as const;

export function independentSiblingsCapacity(estudio: Pick<EstudioPayload, "max_bases" | "n_bases">) {
  const maxBases = Math.min(estudio.max_bases || INDEPENDENT_SIBLINGS_MAX_BASES, INDEPENDENT_SIBLINGS_MAX_BASES);
  return {
    maxBases,
    capacityLeft: Math.max(0, maxBases - estudio.n_bases),
  };
}

export function independentSiblingsCapacityLabel(activeBases: number, maxBases: number) {
  const activeLabel = activeBases === 1 ? "base activa" : "bases activas";
  return `${activeBases} ${activeLabel}, capacidad máxima ${maxBases}`;
}

export function smDefaultScopeFields(): SmImportScopeFields {
  return {
    collectorIds: "",
    dateModifiedGte: "",
    dateModifiedLte: "",
    includeCompleted: true,
    includePartial: false,
    keepMissingStatus: false,
    collectionStrategy: "campo",
    channel: "",
  };
}

export function smDefaultScopeDraft(): SmImportScopeDraft {
  return {
    ...smDefaultScopeFields(),
    alias: "",
    logicRules: "",
    extraSources: [],
  };
}

export function smMonitoringSuggestionPrimarySource(group: EstudioProcessingSuggestionGroup) {
  return group.sources.find((source) => source.kind === "surveymonkey" && source.survey_id)
    ?? group.sources.find((source) => source.survey_id)
    ?? null;
}

export function smMonitoringSuggestionCanImport(
  group: EstudioProcessingSuggestionGroup,
  existingSurveyIds: Iterable<string>,
  selectedSurveyIds: Iterable<string> = [],
) {
  const primary = smMonitoringSuggestionPrimarySource(group);
  if (!group.importable || group.platform !== "surveymonkey" || !primary?.survey_id) return false;
  const existing = new Set(Array.from(existingSurveyIds).map((id) => String(id).trim()).filter(Boolean));
  const selected = new Set(Array.from(selectedSurveyIds).map((id) => String(id).trim()).filter(Boolean));
  return !existing.has(primary.survey_id) && !selected.has(primary.survey_id);
}

export function koboAssetIdsFromBase(base: EstudioBase) {
  return Array.from(new Set([
    base.kobo_source_spec?.asset_uid,
    base.survey_id,
  ].map((id) => String(id || "").trim()).filter(Boolean)));
}

export function koboMonitoringSuggestionPrimarySource(group: EstudioProcessingSuggestionGroup) {
  return group.sources.find((source) => source.kind === "kobo" && source.asset_uid)
    ?? group.sources.find((source) => source.asset_uid)
    ?? null;
}

export function koboMonitoringSuggestionCanImport(
  group: EstudioProcessingSuggestionGroup,
  existingAssetIds: Iterable<string>,
) {
  const primary = koboMonitoringSuggestionPrimarySource(group);
  if (!group.importable || group.platform !== "kobo" || !primary?.asset_uid) return false;
  const existing = new Set(Array.from(existingAssetIds).map((id) => String(id).trim()).filter(Boolean));
  return !existing.has(primary.asset_uid);
}

export function koboMonitoringSuggestionInput(group: EstudioProcessingSuggestionGroup): KoboIndependentAssetInput | null {
  const primary = koboMonitoringSuggestionPrimarySource(group);
  if (!primary?.asset_uid) return null;
  return {
    ...(group.kobo_input ?? {}),
    asset_uid: primary.asset_uid,
    title: group.kobo_input?.title || primary.title || primary.label || group.actor,
    label: group.kobo_input?.label || group.actor,
    source_alias: group.kobo_input?.source_alias || group.actor,
    source_title: group.kobo_input?.source_title || primary.title || primary.label || group.actor,
    source_channel: group.kobo_input?.source_channel || primary.channel || "",
    channel: group.kobo_input?.channel || primary.channel || "",
    collection_strategy: group.kobo_input?.collection_strategy || primary.collection_strategy || "",
    base_url: group.kobo_input?.base_url || primary.base_url || "",
    connection_profile_id: group.kobo_input?.connection_profile_id || primary.connection_profile_id || "",
  };
}

export function smSuggestionCatalogItem(source: EstudioProcessingSuggestionSource): SurveyMonkeyMultibaseListItem {
  return {
    id: source.survey_id,
    title: source.title || source.label || source.survey_id,
    nickname: source.label || source.actor || null,
    date_modified: source.last_sync_at || null,
    pais_guess: null,
    response_count: source.response_count ?? null,
  };
}

export function smMergeSuggestionCatalog(
  current: SurveyMonkeyMultibaseListItem[] | null,
  groups: EstudioProcessingSuggestionGroup[],
) {
  const byId = new Map<string, SurveyMonkeyMultibaseListItem>();
  for (const item of current ?? []) byId.set(item.id, item);
  for (const group of groups) {
    for (const source of group.sources) {
      if (source.kind !== "surveymonkey" || !source.survey_id) continue;
      if (!byId.has(source.survey_id)) byId.set(source.survey_id, smSuggestionCatalogItem(source));
    }
  }
  return Array.from(byId.values());
}

export function smMonitoringSuggestionScope(
  group: EstudioProcessingSuggestionGroup,
  current?: SmImportScopeDraft,
): SmImportScopeDraft {
  const smSources = group.sources.filter((source) => source.kind === "surveymonkey" && source.survey_id);
  const primary = smSources[0];
  const alias = group.actor || group.label || primary?.label || primary?.title || "";
  const primaryChannel = primary?.channel || group.survey_input?.channel || "";
  const primaryStrategy = (primary?.collection_strategy || group.survey_input?.collection_strategy || "campo") as SmImportScopeFields["collectionStrategy"];
  return {
    ...smDefaultScopeDraft(),
    ...(current ?? {}),
    alias,
    channel: smChannelLabel(primaryChannel) || primaryChannel,
    collectionStrategy: primaryStrategy,
    collectorIds: (primary?.collector_ids ?? []).join(", "),
    extraSources: smSources.slice(1).map((source) => ({
      ...smDefaultScopeFields(),
      key: smNewScopeKey(),
      surveyId: source.survey_id,
      label: [group.actor, smChannelLabel(source.channel) || source.channel]
        .filter(Boolean)
        .join(", ") || group.actor || source.label || source.title,
      query: "",
      channel: smChannelLabel(source.channel) || source.channel,
      collectionStrategy: (source.collection_strategy || "campo") as SmImportScopeFields["collectionStrategy"],
      collectorIds: (source.collector_ids ?? []).join(", "),
    })),
  };
}

export function smSuggestionUsesPersonalizedLink(source: EstudioProcessingSuggestionSource) {
  const haystack = [
    source.collection_strategy,
    source.channel,
    source.label,
    source.title,
  ].join(" ").toLowerCase();
  return haystack.includes("whatsapp")
    || haystack.includes("sms")
    || haystack.includes("personalizado")
    || haystack.includes("custom link")
    || haystack.includes("web link")
    || haystack.includes("weblink")
    || haystack.includes("enlace");
}

export function smSuggestedSurveyMonkeyLogicRulesFromMonitoring(
  suggestions: EstudioProcessingSuggestions | null | undefined,
) {
  if (!suggestions) return "";
  const isAccreditation = suggestions.project_kind === "acreditacion" || suggestions.profile_family === "acreditacion";
  if (!isAccreditation) return "";
  const personalizedSources = suggestions.groups
    .filter((group) => group.platform === "surveymonkey")
    .flatMap((group) => group.sources)
    .filter((source) => source.kind === "surveymonkey" && smSuggestionUsesPersonalizedLink(source));
  if (!personalizedSources.length) return "";
  return "Q1 = C1 => Ocultar P2.";
}

export function smSurveyMonkeyLogicRuleLines(text: string) {
  return text
    .split(/\r?\n|;/g)
    .map((line) => line.trim())
    .filter(Boolean);
}

export type SmLogicPreviewRow = {
  rule: string;
  ok: boolean;
  summary: string;
  detail: string;
  warnings: string[];
  origin?: string;
};

export type SmLogicPreviewEntry = {
  rule: string;
  origin?: string;
};

export function smSurveyMonkeyLogicPreviewNeedsReview(
  ruleLines: string[],
  preview: Array<{ rule: string; ok: boolean }> | null | undefined,
) {
  if (!ruleLines.length) return false;
  if (!preview || preview.length !== ruleLines.length) return true;
  return ruleLines.some((rule, index) => preview[index]?.rule !== rule || !preview[index]?.ok);
}

export function smSurveySpecificLogicRulesBySurvey(
  items: Array<{ id: string }>,
  drafts: Record<string, { logicRules?: string } | undefined>,
) {
  const out: Record<string, string> = {};
  for (const item of items) {
    const rules = String(drafts[item.id]?.logicRules ?? "").trim();
    if (item.id && rules) out[item.id] = rules;
  }
  return out;
}

export function smSurveyMonkeyLogicPreviewEntries(
  commonRules: string,
  specificRulesBySurvey: Record<string, string>,
  surveyLabels: Record<string, string> = {},
) {
  const entries: SmLogicPreviewEntry[] = smSurveyMonkeyLogicRuleLines(commonRules)
    .map((rule) => ({ rule, origin: "Regla común" }));
  for (const [surveyId, rulesText] of Object.entries(specificRulesBySurvey)) {
    const label = surveyLabels[surveyId] || surveyId;
    entries.push(...smSurveyMonkeyLogicRuleLines(rulesText).map((rule) => ({
      rule,
      origin: `Actor ${label}`,
    })));
  }
  return entries;
}

export function smLogicPreviewRow(entry: SmLogicPreviewEntry, interpretation: RuleInterpretation): SmLogicPreviewRow {
  const rule = entry.rule;
  if (interpretation.ok !== true) {
    return {
      rule,
      ok: false,
      summary: "No se pudo interpretar",
      detail: interpretation.error,
      warnings: [],
      origin: entry.origin,
    };
  }
  const actionCount = interpretation.regla_parseada.n_actions || interpretation.regla_parseada.actions.length;
  const expr = interpretation.resolucion.kobo_expr;
  return {
    rule,
    ok: true,
    summary: `${actionCount} acción${actionCount === 1 ? "" : "es"}, ${interpretation.regla_parseada.when_var}`,
    detail: interpretation.texto_humano || expr || "Regla interpretada.",
    warnings: interpretation.warnings ?? [],
    origin: entry.origin,
  };
}

export function smSuggestionResponseLabel(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "sin conteo";
  return `${formatoConteo(value)} respuesta${value === 1 ? "" : "s"}`;
}

export function smChannelKey(value: string) {
  const normalized = smNormalizeSearch(value);
  if (normalized.includes("telefon")) return "telefono";
  if (normalized.includes("whatsapp")) return "whatsapp";
  if (normalized.includes("sms")) return "sms";
  if (normalized.includes("presencial") || normalized.includes("qr") || normalized.includes("ficha")) return "presencial";
  if (normalized.includes("correo") || normalized.includes("email") || normalized.includes("mail")) return "correo";
  if (normalized.includes("web") || normalized.includes("online") || normalized.includes("link") || normalized.includes("enlace")) return "correo";
  if (normalized.includes("mixto") || normalized.includes("multicanal")) return "mixto";
  return normalized ? "mixto" : "";
}

export function smChannelLabel(value: string) {
  const key = smChannelKey(value);
  if (key === "correo") return "Correo";
  if (key === "telefono") return "Telefónico";
  if (key === "whatsapp") return "WhatsApp";
  if (key === "presencial") return "Ficha QR";
  if (key === "sms") return "SMS";
  if (key === "mixto") return "Mixto";
  return "";
}

export function smChannelOptions(value?: string | null) {
  const label = smChannelLabel(String(value ?? ""));
  const options = [...SM_CHANNEL_OPTIONS];
  return label && !options.includes(label as (typeof SM_CHANNEL_OPTIONS)[number])
    ? [label, ...options]
    : options;
}

export function smInferChannelFromText(value: string) {
  const normalized = smNormalizeSearch(value);
  if (normalized.includes("telefon")) return "Telefónico";
  if (normalized.includes("whatsapp")) return "WhatsApp";
  if (normalized.includes("sms")) return "SMS";
  if (normalized.includes("presencial") || normalized.includes("qr")) return "Ficha QR";
  if (normalized.includes("correo") || normalized.includes("email") || normalized.includes("mail")) return "Correo";
  if (normalized.includes("web") || normalized.includes("online") || normalized.includes("link")) return "Correo";
  return "";
}

export function smSurveyDefaultChannel(item: SurveyMonkeyMultibaseListItem) {
  return smInferChannelFromText(`${item.title} ${item.nickname ?? ""}`);
}

export function smChannelFromSpec(spec?: SurveyMonkeyMultibaseSurveyInput | null) {
  if (!spec) return "";
  const labels: string[] = [];
  const direct = smChannelLabel(String(spec.channel || spec.source_channel || spec.canal || ""));
  if (direct) labels.push(direct);
  const sources = spec.sources ?? spec.campaigns ?? [];
  for (const source of sources) {
    const label = smChannelLabel(String(source.channel || source.source_channel || source.canal || ""));
    if (label) labels.push(label);
  }
  const unique = labels.filter((label, index, arr) => label && arr.indexOf(label) === index);
  if (unique.length > 1) return "Mixto";
  return unique[0] || "";
}

export function smBaseChannels(base: EstudioBase) {
  const summaryChannels = Array.isArray(base.surveymonkey_source_summary?.channels)
    ? base.surveymonkey_source_summary.channels.map((item) => smChannelLabel(String(item || ""))).filter(Boolean)
    : [];
  const sourceChannels = (base.surveymonkey_sources ?? [])
    .map((source) => smChannelLabel(String(source.channel || source.channel_key || "")))
    .filter(Boolean);
  const inferredSourceChannels = [
    ...smSourceSummariesFromSpec(base.surveymonkey_source_spec),
    ...smSourceSummariesFromFilter(base.response_filter),
  ].map((source) => source.channel).filter(Boolean);
  const fallback = [
    ...summaryChannels,
    ...sourceChannels,
    ...inferredSourceChannels,
    smChannelLabel(String(base.source_channel || "")),
    smChannelFromSpec(base.surveymonkey_source_spec),
  ].filter(Boolean);
  const unique = fallback.filter((label, index, arr) => arr.indexOf(label) === index);
  return unique.length > 1 ? unique.filter((label) => label !== "Mixto") : unique;
}

export function smBaseChannel(base: EstudioBase) {
  const summaryLabel = smChannelLabel(String(base.surveymonkey_source_summary?.channel_label || ""));
  if (summaryLabel) return summaryLabel;
  const channels = smBaseChannels(base);
  if (channels.length > 1) return "Mixto";
  return channels[0] || "";
}

export function smBaseChannelDetail(base: EstudioBase) {
  const channels = smBaseChannels(base);
  return channels.length > 1 ? channels.join(" + ") : channels[0] || "";
}

export function smBaseHasMixedChannels(base: EstudioBase) {
  return smBaseChannels(base).length > 1 || smChannelLabel(String(base.surveymonkey_source_summary?.channel_label || "")) === "Mixto";
}

export type SmSourceSummary = {
  sourceIndex: number | null;
  surveyId: string;
  title: string;
  channel: string;
  channelKey: string;
  consentVar: string;
  collectionStrategy: string;
  collectorIds: string[];
  collectorCount: number | null;
  validRecords: number | null;
  rawRecords: number | null;
  effectiveRecords: number | null;
  includedRecords: number | null;
  originalRecords: number | null;
  excludedRecords: number | null;
  entersData: boolean;
};

export function smSpecConsentVar(spec?: SurveyMonkeyMultibaseSurveyInput | null) {
  if (!spec) return "";
  return String(spec.consent_var || spec.consentimiento_var || "").trim();
}

export function smNumberFromRecord(value: unknown) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function smStringList(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  const raw = String(value ?? "").trim();
  return raw ? smSplitScopeList(raw) : [];
}

export function smChannelFromStrategy(value: string) {
  const key = smNormalizeSearch(value);
  if (key === "email" || key.includes("correo")) return "Correo";
  if (key.includes("web") || key.includes("link") || key.includes("online")) return "Correo";
  if (key.includes("whatsapp")) return "WhatsApp";
  if (key.includes("sms")) return "SMS";
  if (key.includes("campo") || key.includes("telefon")) return "Telefónico";
  return "";
}

export function smSourceSummaryFromRecord(record: Record<string, unknown>, fallback: Partial<SmSourceSummary> = {}): SmSourceSummary {
  const surveyId = String(record.survey_id ?? record.id ?? fallback.surveyId ?? "").trim();
  const title = String(
    record.source_title ?? record.source_alias ?? record.label ?? record.title ?? fallback.title ?? surveyId,
  ).trim();
  const collectionStrategy = String(record.collection_strategy ?? fallback.collectionStrategy ?? "").trim();
  const explicitChannel = smChannelLabel(String(
    record.source_channel ?? record.channel ?? record.canal ?? record.channel_key ?? fallback.channel ?? fallback.channelKey ?? "",
  ));
  const channel = explicitChannel || smChannelFromStrategy(collectionStrategy);
  const rawRecords = smNumberFromRecord(record.raw_records ?? record.raw_total ?? record.original_rows ?? fallback.rawRecords ?? fallback.originalRecords);
  const effectiveRecords = smNumberFromRecord(record.effective_records ?? record.completed_with_consent ?? fallback.effectiveRecords);
  const includedRecords = smNumberFromRecord(record.included_records ?? record.included ?? record.kept_rows ?? fallback.includedRecords ?? fallback.validRecords);
  const validRecords = smNumberFromRecord(record.valid_records ?? includedRecords ?? effectiveRecords ?? record.kept_rows ?? fallback.validRecords);
  const excludedRecords = smNumberFromRecord(record.excluded_records ?? record.excluded ?? record.excluded_rows ?? fallback.excludedRecords);
  const collectorIds = [
    ...smStringList(record.collector_ids),
    ...smStringList(record.collector_id),
    ...(fallback.collectorIds ?? []),
  ].filter((item, index, arr) => arr.indexOf(item) === index);
  const collectorCount = smNumberFromRecord(record.collector_count ?? fallback.collectorCount) ?? (collectorIds.length ? collectorIds.length : null);
  const consentVar = String(
    record.consent_var ?? record.consentimiento_var ?? record.consent_question ?? fallback.consentVar ?? "",
  ).trim();
  return {
    sourceIndex: smNumberFromRecord(record.index ?? fallback.sourceIndex),
    surveyId,
    title: title || surveyId || "Fuente SurveyMonkey",
    channel,
    channelKey: smChannelKey(channel),
    consentVar,
    collectionStrategy,
    collectorIds,
    collectorCount,
    validRecords,
    rawRecords,
    effectiveRecords,
    includedRecords,
    originalRecords: rawRecords,
    excludedRecords,
    entersData: Boolean(record.enters_data ?? fallback.entersData ?? ((validRecords ?? includedRecords ?? effectiveRecords ?? 0) > 0)),
  };
}

export function smSourceSummariesFromSpec(spec?: SurveyMonkeyMultibaseSurveyInput | null): SmSourceSummary[] {
  if (!spec) return [];
  const fallback = smSourceSummaryFromRecord(spec as unknown as Record<string, unknown>);
  const sources = spec.sources ?? spec.campaigns ?? [];
  const rows = sources.length
    ? sources.map((source) => smSourceSummaryFromRecord(source as unknown as Record<string, unknown>, fallback))
    : [fallback];
  return rows.filter((row) => row.surveyId || row.title);
}

export function smSourceSummariesFromFilter(value: unknown): SmSourceSummary[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const sources = Array.isArray(record.sources) ? record.sources : [];
  if (sources.length) {
    return sources.map((source) => smSourceSummaryFromRecord(source as Record<string, unknown>));
  }
  return [smSourceSummaryFromRecord(record)];
}

export function smSourceSummariesFromBase(base: EstudioBase): SmSourceSummary[] {
  const fromPayload = Array.isArray(base.surveymonkey_sources)
    ? base.surveymonkey_sources.map((source) => smSourceSummaryFromRecord(source as unknown as Record<string, unknown>))
    : [];
  if (fromPayload.length) return fromPayload;
  const fromSpec = smSourceSummariesFromSpec(base.surveymonkey_source_spec);
  const fromFilter = smSourceSummariesFromFilter(base.response_filter);
  if (fromSpec.length) {
    const filterById = new Map(fromFilter.map((source) => [source.surveyId, source]));
    return fromSpec.map((source) => {
      const filter = filterById.get(source.surveyId);
      if (!filter) return source;
      return {
        ...source,
        channel: source.channel || filter.channel,
        consentVar: source.consentVar || filter.consentVar,
        collectionStrategy: source.collectionStrategy || filter.collectionStrategy,
        validRecords: source.validRecords ?? filter.validRecords,
        originalRecords: source.originalRecords ?? filter.originalRecords,
        excludedRecords: source.excludedRecords ?? filter.excludedRecords,
      };
    });
  }
  if (fromFilter.length) return fromFilter;
  return [smSourceSummaryFromRecord({
    survey_id: base.survey_id,
    source_title: base.source_title,
    source_alias: base.source_alias,
    source_channel: base.source_channel,
    consent_var: base.consent_var,
  })];
}

export function smSpecWithPrimaryChannel(spec: SurveyMonkeyMultibaseSurveyInput | null | undefined, channel: string) {
  if (!spec) return null;
  const next: SurveyMonkeyMultibaseSurveyInput = {
    ...spec,
    channel,
    source_channel: channel,
  };
  const sourceItems = spec.sources ?? spec.campaigns;
  if (sourceItems?.length) {
    next.sources = sourceItems.map((source, index) => (
      index === 0 ? { ...source, channel, source_channel: channel } : { ...source }
    ));
    delete next.campaigns;
  }
  return next;
}

export function smSpecWithConsentVar(spec: SurveyMonkeyMultibaseSurveyInput | null | undefined, consentVar: string) {
  if (!spec) return null;
  const nextValue = consentVar.trim();
  const next: SurveyMonkeyMultibaseSurveyInput = { ...spec };
  if (nextValue) next.consent_var = nextValue;
  else delete next.consent_var;
  const sourceItems = spec.sources ?? spec.campaigns;
  if (sourceItems?.length) {
    next.sources = sourceItems.map((source) => {
      const copy: SurveyMonkeyMultibaseSurveyInput = { ...source };
      if (nextValue) copy.consent_var = nextValue;
      else delete copy.consent_var;
      return copy;
    });
    delete next.campaigns;
  }
  return next;
}

export function smSpecSources(spec?: SurveyMonkeyMultibaseSurveyInput | null) {
  if (!spec) return [];
  const sources = spec.sources ?? spec.campaigns ?? [];
  return sources.length ? sources : [spec];
}

export function smScopeValueFromCollectorIds(value: unknown) {
  return smStringList(value).join(", ");
}

export function smWithCollectorIds<T extends SurveyMonkeyMultibaseSurveyInput>(source: T, collectorIds: string[]) {
  const next: T = { ...source };
  if (collectorIds.length) next.collector_ids = collectorIds;
  else delete next.collector_ids;
  delete next.collector_id;
  return next;
}

export function smSpecWithSourceCollectors(
  spec: SurveyMonkeyMultibaseSurveyInput | null | undefined,
  sourceIndex: number,
  collectorIdsValue: string,
) {
  if (!spec) return null;
  const collectorIds = smSplitScopeList(collectorIdsValue);
  const sources = spec.sources ?? spec.campaigns ?? [];
  if (sources.length) {
    const nextSources = sources.map((source, index) => (
      index === sourceIndex ? smWithCollectorIds(source, collectorIds) : { ...source }
    ));
    const next: SurveyMonkeyMultibaseSurveyInput = {
      ...spec,
      sources: nextSources,
    };
    delete next.campaigns;
    if (sourceIndex === 0) {
      return smWithCollectorIds(next, collectorIds);
    }
    return next;
  }
  return sourceIndex === 0 ? smWithCollectorIds(spec, collectorIds) : { ...spec };
}

export function smSpecFromFilterRecord(
  record: Record<string, unknown>,
  fallback: SurveyMonkeyMultibaseSurveyInput,
): SurveyMonkeyMultibaseSurveyInput {
  const surveyId = String(record.survey_id ?? record.id ?? fallback.survey_id ?? "").trim();
  const label = String(
    record.source_alias ?? record.label ?? record.source_title ?? fallback.source_alias ?? fallback.label ?? surveyId,
  ).trim();
  const channel = smChannelLabel(String(record.source_channel ?? record.channel ?? fallback.source_channel ?? fallback.channel ?? ""));
  const spec: SurveyMonkeyMultibaseSurveyInput = {
    survey_id: surveyId,
    label: label || surveyId,
    source_alias: label || surveyId,
    source_title: String(record.source_title ?? fallback.source_title ?? label ?? surveyId).trim(),
    response_statuses: smStringList(record.statuses ?? record.response_statuses ?? fallback.response_statuses),
    keep_missing_status: Boolean(record.keep_missing_status ?? fallback.keep_missing_status ?? false),
    collector_ids: smStringList(record.collector_ids ?? record.collector_id),
    date_modified_gte: String(record.date_modified_gte ?? fallback.date_modified_gte ?? "").trim(),
    date_modified_lte: String(record.date_modified_lte ?? fallback.date_modified_lte ?? "").trim(),
    collection_strategy: String(record.collection_strategy ?? fallback.collection_strategy ?? "").trim(),
    channel,
    source_channel: channel,
    consent_var: String(record.consent_var ?? record.consentimiento_var ?? fallback.consent_var ?? fallback.consentimiento_var ?? "").trim(),
  };
  if (!spec.response_statuses?.length) delete spec.response_statuses;
  if (!spec.collector_ids?.length) delete spec.collector_ids;
  if (!spec.date_modified_gte) delete spec.date_modified_gte;
  if (!spec.date_modified_lte) delete spec.date_modified_lte;
  if (!spec.collection_strategy) delete spec.collection_strategy;
  if (!spec.channel) delete spec.channel;
  if (!spec.source_channel) delete spec.source_channel;
  if (!spec.consent_var) delete spec.consent_var;
  return spec;
}

export function smSpecDraftFromBase(base: EstudioBase): SurveyMonkeyMultibaseSurveyInput | null {
  if (base.surveymonkey_source_spec) return base.surveymonkey_source_spec;
  const surveyId = String(base.survey_id || "").trim();
  if (!surveyId && !base.response_filter) return null;
  const label = String(base.source_alias || base.source_title || base.nombre || surveyId).trim();
  const channel = smChannelLabel(String(base.source_channel || ""));
  const fallback: SurveyMonkeyMultibaseSurveyInput = {
    survey_id: surveyId,
    label,
    source_alias: label,
    source_title: String(base.source_title || label).trim(),
    channel,
    source_channel: channel,
    consent_var: String(base.consent_var || "").trim(),
    response_statuses: ["completed"],
    keep_missing_status: false,
  };
  const filter = base.response_filter;
  if (filter && typeof filter === "object") {
    const record = filter as Record<string, unknown>;
    const sourceRows = Array.isArray(record.sources) ? record.sources as Record<string, unknown>[] : [];
    if (sourceRows.length) {
      return {
        ...fallback,
        sources: sourceRows.map((source) => smSpecFromFilterRecord(source, fallback)),
      };
    }
    return {
      ...fallback,
      sources: [smSpecFromFilterRecord(record, fallback)],
    };
  }
  return surveyId ? fallback : null;
}

export function smBaseConsentVar(base: EstudioBase) {
  const direct = String(base.consent_var || "").trim();
  if (direct) return direct;
  const specDirect = smSpecConsentVar(base.surveymonkey_source_spec);
  if (specDirect) return specDirect;
  return smSourceSummariesFromBase(base).find((source) => source.consentVar)?.consentVar || "";
}

export type SmConsentOption = {
  name: string;
  label: string;
  type: string;
  positiveChoices: Array<{ name: string; label: string }>;
};

export function smShortQuestionLabel(label: string, max = 62) {
  const clean = label.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}

export function smXlsformVariableLabelLookup(base?: Pick<EstudioBase, "xlsform_variables"> | null) {
  const lookup = new Map<string, string>();
  for (const item of base?.xlsform_variables ?? []) {
    const name = String(item.name || "").trim();
    if (!name || lookup.has(name)) continue;
    lookup.set(name, String(item.label || "").replace(/\s+/g, " ").trim());
  }
  return lookup;
}

export function smConsentOptions(base: EstudioBase) {
  const variables = base.xlsform_variables ?? [];
  const byName = new Map<string, SmConsentOption>();
  for (const item of variables) {
    const name = String(item.name || "").trim();
    if (!name) continue;
    const type = String(item.type || "").trim();
    if (type && type !== "select_one") continue;
    byName.set(name, {
      name,
      label: String(item.label || "").trim(),
      type,
      positiveChoices: (item.positive_choices ?? []).map((choice) => ({
        name: String(choice.name || "").trim(),
        label: String(choice.label || "").trim(),
      })).filter((choice) => choice.name || choice.label),
    });
  }
  for (const name of base.consent_candidates ?? []) {
    const key = String(name || "").trim();
    if (key && !byName.has(key)) byName.set(key, { name: key, label: "", type: "", positiveChoices: [] });
  }
  const current = smBaseConsentVar(base);
  if (current && !byName.has(current)) byName.set(current, { name: current, label: "", type: "", positiveChoices: [] });
  const candidateSet = new Set((base.consent_candidates ?? []).map((name) => String(name || "").trim()).filter(Boolean));
  return Array.from(byName.values()).sort((a, b) => {
    const aCandidate = candidateSet.has(a.name) || a.name === current;
    const bCandidate = candidateSet.has(b.name) || b.name === current;
    if (aCandidate !== bCandidate) return aCandidate ? -1 : 1;
    return a.name.localeCompare(b.name, "es");
  });
}

export function smDecisionVariableOptions(base: EstudioBase) {
  const rows = (base.xlsform_variables ?? [])
    .map((item) => ({
      name: String(item.name || "").trim(),
      label: String(item.label || "").trim(),
      type: String(item.type || "").trim(),
    }))
    .filter((item) => item.name);
  const seen = new Set<string>();
  return rows.filter((item) => {
    if (seen.has(item.name)) return false;
    seen.add(item.name);
    return true;
  });
}

export function smConsentFilterInfo(base: EstudioBase) {
  const value = smBaseConsentVar(base);
  const option = smConsentOptions(base).find((item) => item.name === value);
  const approved = option?.positiveChoices?.length ? option.positiveChoices : [{ name: "1", label: "Sí" }];
  return {
    value,
    label: option?.label || "",
    approved,
  };
}

export function smIndependentTemplateBase(estudio: EstudioPayload, bases: EstudioBase[]) {
  const available = new Set(bases.map((base) => base.nombre));
  const candidates = [
    String(estudio.independent_siblings?.template_base || ""),
    String(estudio.active_base || ""),
    bases[0]?.nombre || "",
  ];
  return candidates.find((candidate) => candidate && available.has(candidate)) || "";
}

export function smSourceMetricLabel(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "S/D" : formatoConteo(value);
}

export function smSourceCollectorLabel(source: SmSourceSummary) {
  if (source.collectorIds.length) {
    return `${source.collectorIds.length} filtro${source.collectorIds.length === 1 ? "" : "s"}`;
  }
  if (source.collectorCount != null && source.collectorCount > 0) {
    return `${source.collectorCount} recopilador${source.collectorCount === 1 ? "" : "es"}`;
  }
  return "Todos";
}

export function smDecisionNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function smDecisionOptionalNumber(value: unknown) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function smDecisionRowsImpactText(currentRows: number | null, previewRows: number | null) {
  if (currentRows == null || previewRows == null) {
    return "Cuando termine el recálculo se mostrará si el total sube, baja o queda igual.";
  }
  const currentLabel = formatoConteo(currentRows);
  const previewLabel = formatoConteo(previewRows);
  const delta = previewRows - currentRows;
  if (delta > 0) {
    return `Si aplicas ahora, la base activa pasará de ${currentLabel} a ${previewLabel} casos: entrarán ${formatoConteo(delta)} casos adicionales.`;
  }
  if (delta < 0) {
    return `Si aplicas ahora, la base activa pasará de ${currentLabel} a ${previewLabel} casos: saldrán ${formatoConteo(Math.abs(delta))} casos que ya no cumplen estas reglas.`;
  }
  return `Si aplicas ahora, la base activa quedará con ${currentLabel} casos; no cambia el total, pero sí se reescribe con estas reglas.`;
}

export function smDecisionRowsLabel(value: number | null) {
  return value == null ? "pendiente" : formatoConteo(value);
}

export function smDecisionRowsDeltaLabel(currentRows: number | null, previewRows: number | null) {
  if (currentRows == null || previewRows == null) return "por calcular";
  const delta = previewRows - currentRows;
  if (delta > 0) return `+${formatoConteo(delta)}`;
  if (delta < 0) return `-${formatoConteo(Math.abs(delta))}`;
  return "0";
}

export function smDecisionRowsDeltaTone(currentRows: number | null, previewRows: number | null) {
  if (currentRows == null || previewRows == null) return "is-pending";
  const delta = previewRows - currentRows;
  if (delta > 0) return "is-up";
  if (delta < 0) return "is-down";
  return "is-even";
}

export function smDecisionInitialPolicy(base: EstudioBase): SurveyMonkeyDecisionPolicy {
  const saved = base.surveymonkey_decision_policy ?? {};
  const consentVar = String(saved.consent_var || smBaseConsentVar(base) || "").trim();
  return {
    version: 1,
    statuses: saved.statuses?.length ? saved.statuses : ["completed"],
    collector_ids: saved.collector_ids ?? [],
    consent_var: consentVar,
    consent_yes_values: saved.consent_yes_values?.length ? saved.consent_yes_values : ["1", "si", "sí", "yes", "true", "acepta", "acepto", "accepted"],
    rejection_var: String(saved.rejection_var || consentVar || "").trim(),
    rejection_values: saved.rejection_values?.length ? saved.rejection_values : ["0", "no", "no acepta", "no acepto", "rechaza", "rechazo"],
    include_partials: saved.include_partials === true,
    partial_min_answers: Math.max(10, Number(saved.partial_min_answers ?? 15) || 15),
    include_rejections: saved.include_rejections === true,
    duplicate_key_vars: saved.duplicate_key_vars?.length ? saved.duplicate_key_vars : ["cv_id", "custom_value", "recipient_id"],
    include_duplicates: saved.include_duplicates !== false,
    duplicate_keep: saved.duplicate_keep || "first",
    manual_include_case_uids: saved.manual_include_case_uids ?? [],
    edited: saved.edited === true,
    saved_at: saved.saved_at,
  };
}

export function smDecisionStringList(values: unknown) {
  return Array.isArray(values)
    ? values.map((value) => String(value || "").trim()).filter(Boolean).sort()
    : [];
}

export function smDecisionPolicyFingerprint(policy: SurveyMonkeyDecisionPolicy | null | undefined) {
  const p = policy ?? {};
  return JSON.stringify({
    statuses: smDecisionStringList(p.statuses),
    collector_ids: smDecisionStringList(p.collector_ids),
    consent_var: String(p.consent_var || ""),
    consent_yes_values: smDecisionStringList(p.consent_yes_values),
    rejection_var: String(p.rejection_var || ""),
    rejection_values: smDecisionStringList(p.rejection_values),
    include_partials: p.include_partials === true,
    partial_min_answers: Math.max(10, Number(p.partial_min_answers ?? 15) || 15),
    include_rejections: p.include_rejections === true,
    duplicate_key_vars: smDecisionStringList(p.duplicate_key_vars),
    include_duplicates: p.include_duplicates !== false,
    duplicate_keep: String(p.duplicate_keep || "first"),
    manual_include_case_uids: smDecisionStringList(p.manual_include_case_uids),
  });
}

export function smDecisionValuesToText(values?: string[]) {
  return (values ?? []).join(", ");
}

export function smDecisionTextToValues(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function smDecisionAuditReady(audit: SurveyMonkeyDecisionAudit | null) {
  return !!audit && typeof audit.raw_total !== "undefined" && Array.isArray(audit.sources);
}

export function smDecisionDownstreamLabels(base: EstudioBase) {
  const status = base.status ?? {};
  const labels: string[] = [];
  if (status.validacion) labels.push("Validación");
  if (status.codificacion || status.codificacion_adaptada) labels.push("Codificación");
  if (status.analitica) labels.push("Analítica");
  if (status.graficos) labels.push("Gráficos");
  return labels;
}

export function smDecisionDuplicateOptions(base: EstudioBase, variableOptions: ReturnType<typeof smDecisionVariableOptions>) {
  const metadata = [
    { name: "cv_id", label: "ID personalizado SurveyMonkey" },
    { name: "custom_value", label: "Custom value" },
    { name: "recipient_id", label: "Recipient ID" },
    { name: "response_id", label: "Response ID" },
    { name: "case_uid", label: "Survey + response" },
  ];
  const byName = new Map<string, { name: string; label?: string | null }>();
  for (const item of metadata) byName.set(item.name, item);
  for (const item of variableOptions) byName.set(item.name, item);
  if (!byName.has("p4")) byName.set("p4", { name: "p4", label: "Código PUCP disponible" });
  return Array.from(byName.values());
}

export type SmDecisionCollectorOption = { id: string; label: string; count: number; source: string };

export function smDecisionCollectorOptions(audit: SurveyMonkeyDecisionAudit | null) {
  const byId = new Map<string, SmDecisionCollectorOption>();
  for (const source of audit?.sources ?? []) {
    const sourceLabel = smDecisionSourceName(source);
    const names = new Map<string, string>();
    for (const collector of source.collectors ?? []) {
      const id = String(collector.id || "").trim();
      if (!id) continue;
      const name = String(collector.name || "").trim();
      if (name) names.set(id, name);
    }
    const ids = new Set<string>([
      ...Object.keys(source.collector_counts ?? {}),
      ...Array.from(names.keys()),
    ]);
    for (const rawId of ids) {
      const id = String(rawId || "").trim();
      if (!id || id === "(vacio)") continue;
      const name = names.get(id) || id;
      const count = Number(source.collector_counts?.[id] ?? 0) || 0;
      const existing = byId.get(id);
      if (existing) {
        existing.count += count;
        if (sourceLabel && !existing.source.includes(sourceLabel)) existing.source = [existing.source, sourceLabel].filter(Boolean).join(", ");
      } else {
        byId.set(id, {
          id,
          label: name === id ? id : `${name} (${id})`,
          count,
          source: sourceLabel,
        });
      }
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export function smDecisionCollectorIsTest(collector: Pick<SmDecisionCollectorOption, "label" | "source">) {
  const text = smNormalizeSearch(`${collector.label || ""} ${collector.source || ""}`);
  return text.split(" ").includes("prueba");
}

export function smDecisionValidCollectorIds(collectorOptions: Array<Pick<SmDecisionCollectorOption, "id" | "label" | "source">>) {
  return collectorOptions
    .filter((collector) => String(collector.id || "").trim() && !smDecisionCollectorIsTest(collector))
    .map((collector) => String(collector.id).trim());
}

export function smDecisionPolicyForSurveyMonkeyCommit(
  policy: SurveyMonkeyDecisionPolicy,
  collectorOptions: Array<Pick<SmDecisionCollectorOption, "id" | "label" | "source">>,
) {
  const validIds = smDecisionValidCollectorIds(collectorOptions);
  if (!validIds.length) return { ...policy, edited: true };
  const validSet = new Set(validIds);
  const current = (policy.collector_ids?.length ? policy.collector_ids : validIds)
    .map(String)
    .filter((id) => validSet.has(id));
  return {
    ...policy,
    collector_ids: current.length ? Array.from(new Set(current)) : validIds,
    edited: true,
  };
}

export function smDecisionSourceName(source: SurveyMonkeyDecisionSourceAudit | null | undefined) {
  return String(source?.source_title || source?.source_label || source?.source_alias || source?.survey_id || "Fuente").trim();
}

export function smDecisionDuplicateOptionLabel(option: { name: string; label?: string | null }) {
  const friendly: Record<string, string> = {
    cv_id: "ID del enlace personalizado",
    custom_value: "Valor personalizado del enlace",
    recipient_id: "Destinatario SurveyMonkey",
    response_id: "Respuesta SurveyMonkey",
    case_uid: "Encuesta + respuesta",
    p4: "Código PUCP",
  };
  return friendly[option.name] || (option.label ? `${smShortQuestionLabel(option.label, 52)} (${option.name})` : option.name);
}

export function smDecisionQuestionOptionLabel(option: { name: string; label?: string | null }, max = 62) {
  const label = String(option.label || "").trim();
  if (!label) return option.name;
  return `${smShortQuestionLabel(label, max)} (${option.name})`;
}

export function smCollectorFriendlyName(label: string, id: string) {
  const cleanLabel = String(label || "").trim();
  const cleanId = String(id || "").trim();
  if (!cleanLabel) return "Recopilador sin nombre";
  const idSuffix = cleanId ? ` (${cleanId})` : "";
  const out = cleanLabel.endsWith(idSuffix) ? cleanLabel.slice(0, -idSuffix.length) : cleanLabel;
  return out && out !== cleanId ? out : "Recopilador sin nombre";
}

export function smDecisionCollectorStateLabel(collector: SmDecisionCollectorOption, isSelected: boolean) {
  if (smDecisionCollectorIsTest(collector)) return "Prueba";
  if (smDecisionNumber(collector.count) <= 0) return "Sin respuestas";
  if (isSelected) return "Entra";
  return "Desmarcado";
}

export function smDecisionCollectorStateClass(label: string) {
  if (label === "Entra") return "is-state-in";
  if (label === "Prueba") return "is-state-test";
  if (label === "Sin respuestas") return "is-state-empty";
  return "is-state-out";
}

export function smDecisionCollectorNameMap(audit: SurveyMonkeyDecisionAudit | null) {
  const out = new Map<string, string>();
  for (const source of audit?.sources ?? []) {
    for (const collector of source.collectors ?? []) {
      const id = String(collector.id || "").trim();
      const name = String(collector.name || "").trim();
      if (!id || !name || name === id) continue;
      out.set(id, name);
    }
  }
  return out;
}

export function smDecisionCaseDecisionLabel(value: string) {
  const key = value.replace(/_/g, " ");
  const labels: Record<string, string> = {
    efectiva: "Incluida",
    excluida: "Fuera",
    parcial_excluida: "Parcial fuera",
    parcial_incluida: "Parcial incluida",
    rechazo_excluido: "Rechazo fuera",
    rechazo_incluido: "Rechazo incluido",
    duplicado_excluido: "Duplicado fuera",
    manual_incluida: "Rescate manual",
  };
  return labels[value] || key || "-";
}

export type SmDecisionCaseRow = {
  campania: string;
  collector_id: string;
  collector_label: string;
  case_uid: string;
  survey_id: string;
  response_id: string;
  custom_id: string;
  estado: string;
  respondidas: string;
  answeredRequired: string;
  answerableRequired: string;
  completionLabel: string;
  completionRatio: number | null;
  nearComplete: boolean;
  decision: string;
  incluido: string;
  manual: boolean;
  duplicado: string;
  duplicateGroupSize: string;
  duplicateRank: string;
  duplicateKeptResponseId: string;
  duplicateCodeMatch: string;
  duplicateCareerMatch: string;
  duplicateEvidence: string;
  dateModified: string;
  observado: boolean;
  motivo: string;
};

export function smDecisionRatio(value: unknown) {
  const n = Number(value ?? NaN);
  return Number.isFinite(n) ? n : null;
}

export function smDecisionCaseRows(audit: SurveyMonkeyDecisionAudit | null) {
  const rows: SmDecisionCaseRow[] = [];
  const collectorNames = smDecisionCollectorNameMap(audit);
  for (const source of audit?.sources ?? []) {
    const sourceName = smDecisionSourceName(source);
    for (const item of source.cases ?? []) {
      const collectorId = String(item.collector_id || "");
      const collectorLabel = collectorNames.get(collectorId) || "Recopilador sin nombre";
      if (smDecisionCollectorIsTest({ label: collectorLabel, source: sourceName })) continue;
      rows.push({
        campania: sourceName,
        collector_id: collectorId,
        collector_label: collectorLabel,
        case_uid: String(item.case_uid || ""),
        survey_id: String(item.survey_id || source.survey_id || ""),
        response_id: String(item.response_id || ""),
        custom_id: String(item.cv_id || item.custom_value || item.recipient_id || item.p4 || ""),
        estado: String(item.response_status || ""),
        respondidas: String(item.answered_questions_count || ""),
        answeredRequired: String(item.answered_required_count || item.answered_questions_count || ""),
        answerableRequired: String(item.answerable_required_count || ""),
        completionLabel: String(item.answer_completion_label || item.answered_questions_count || ""),
        completionRatio: smDecisionRatio(item.answer_completion_ratio),
        nearComplete: item.near_complete === "1" || String(item.near_complete || "") === "true",
        decision: String(item.decision_class || ""),
        incluido: String(item.decision_included || ""),
        manual: item.decision_manual_include === "1" || String(item.decision_manual_include || "") === "true",
        duplicado: String(item.duplicate_status || ""),
        duplicateGroupSize: String(item.duplicate_group_size || ""),
        duplicateRank: String(item.duplicate_rank || ""),
        duplicateKeptResponseId: String(item.duplicate_kept_response_id || ""),
        duplicateCodeMatch: String(item.duplicate_code_match || ""),
        duplicateCareerMatch: String(item.duplicate_career_match || ""),
        duplicateEvidence: String(item.duplicate_evidence || ""),
        dateModified: String(item.date_modified || item.date_created || ""),
        observado: item.observed === true || String(item.observed || "") === "true",
        motivo: String(item.observation_reason || ""),
      });
    }
  }
  return rows.sort((a, b) => {
    const aObserved = a.observado === true ? 1 : 0;
    const bObserved = b.observado === true ? 1 : 0;
    if (aObserved !== bObserved) return bObserved - aObserved;
    const aPartial = /partial|parcial/i.test(`${a.estado} ${a.decision}`) ? 1 : 0;
    const bPartial = /partial|parcial/i.test(`${b.estado} ${b.decision}`) ? 1 : 0;
    if (aPartial !== bPartial) return bPartial - aPartial;
    const aRatio = a.completionRatio ?? -1;
    const bRatio = b.completionRatio ?? -1;
    if (aRatio !== bRatio) return bRatio - aRatio;
    return smDecisionNumber(b.answeredRequired) - smDecisionNumber(a.answeredRequired);
  });
}

export function smDecisionCompareLabel(value: string) {
  const key = value.trim().toLowerCase();
  if (key === "coincide") return "coincide";
  if (key === "difiere") return "difiere";
  return "sin dato";
}

export function smDecisionCompareTone(value: string) {
  const key = value.trim().toLowerCase();
  if (key === "coincide") return "is-match";
  if (key === "difiere") return "is-diff";
  return "is-empty";
}

export function smDecisionShortDate(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10);
  return date.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

export function smDecisionPercentLabel(value: number | null) {
  if (value === null) return "";
  const percent = Math.max(0, Math.min(100, Math.round(value * 100)));
  return `${percent}%`;
}

export function smDecisionProgressWidth(value: number | null) {
  if (value === null) return "0%";
  return `${Math.max(0, Math.min(100, Math.round(value * 100)))}%`;
}

export function smDecisionDuplicateEvidenceLine(row: SmDecisionCaseRow) {
  if (!row.duplicateEvidence && !row.duplicateGroupSize) return "";
  const groupSize = Number(row.duplicateGroupSize);
  const groupCopy = Number.isFinite(groupSize) && groupSize > 1
    ? `${groupSize} respuestas con el mismo ID enlace`
    : row.duplicateEvidence
      .replace(/\bcv_id\b/g, "ID enlace")
      .replace(/\brecipient_cv_id\b/g, "ID enlace")
      .replace(/custom_variables\.ID/gi, "ID enlace");
  const parts = [
    groupCopy,
    row.duplicateKeptResponseId ? `Se conserva: ${row.duplicateKeptResponseId}` : "",
    row.dateModified ? `Este caso: ${smDecisionShortDate(row.dateModified)}` : "",
  ].filter(Boolean);
  return parts.join(", ");
}

export function smChannelIcon(key: string) {
  if (key === "correo") return Mail;
  if (key === "telefono") return PhoneCall;
  if (key === "whatsapp" || key === "sms") return MessageCircle;
  if (key === "presencial") return QrCode;
  return Route;
}

export function smNewScopeKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `source_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function smTextShortcutGuard(event: KeyboardEvent<HTMLInputElement>) {
  if (event.metaKey || event.ctrlKey) event.stopPropagation();
}

export function smClipboardGuard(event: ClipboardEvent<HTMLInputElement>) {
  event.stopPropagation();
}

export const SM_DEFAULT_BASE_URL = "https://api.surveymonkey.com/v3";

export const smCollectorCatalogCache = new Map<string, SurveyMonkeyMultibaseCollector[]>();

export function smCollectorCacheKey(surveyId: string, baseUrl = SM_DEFAULT_BASE_URL, profileId = "") {
  return `${profileId.trim()}::${baseUrl}::${surveyId.trim()}`;
}

export function smCollectorDisplayName(item: SurveyMonkeyMultibaseCollector) {
  const name = String(item.name || item.id || "Recopilador").trim();
  return name || item.id || "Recopilador";
}

export function smCollectorTypeLabel(value: string) {
  const key = smNormalizeSearch(value);
  if (key.includes("email")) return "correo";
  if (key.includes("weblink") || key.includes("web_link") || key.includes("web link")) return "enlace";
  if (key.includes("sms")) return "SMS";
  if (key.includes("kiosk")) return "kiosko";
  return value || "tipo S/D";
}

export function smCollectorResponseLabel(count: number | null) {
  if (count == null || !Number.isFinite(count)) return "conteo S/D";
  return `${formatoConteo(count)} respuesta${count === 1 ? "" : "s"}`;
}

export function smToggleCollectorId(current: string, collectorId: string, checked: boolean, orderedIds: string[]) {
  const set = new Set(smSplitScopeList(current));
  if (checked) set.add(collectorId);
  else set.delete(collectorId);
  const ordered = orderedIds.filter((id) => set.has(id));
  const trailing = Array.from(set).filter((id) => !orderedIds.includes(id));
  return [...ordered, ...trailing].join(", ");
}

export function smScopeStatuses(_scope?: SmImportScopeFields) {
  return ["completed"];
}

export function smSplitScopeList(value: string) {
  return value
    .split(/[,\s]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function smScopeDate(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return `${raw}:00+00:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) return `${raw}+00:00`;
  return raw;
}

export function smValidationProfileForStrategy(strategy: SmImportScopeFields["collectionStrategy"]) {
  return strategy === "whatsapp_link" ? "admin_autoadministrado" : "";
}

export function smHasScopeFilters(_scope: SmImportScopeFields) {
  return smSplitScopeList(_scope.collectorIds).length > 0
    || smScopeDate(_scope.dateModifiedGte).length > 0
    || smScopeDate(_scope.dateModifiedLte).length > 0;
}

export function smDateLabel(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Sin fecha";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10);
  return date.toLocaleDateString("es-PE", { year: "numeric", month: "short", day: "2-digit" });
}

export function smSurveyResponseCount(item: Pick<SurveyMonkeyMultibaseListItem, "response_count">) {
  if (item.response_count == null) return null;
  const value = Number(item.response_count);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function smSurveyResponseLabel(item: Pick<SurveyMonkeyMultibaseListItem, "response_count">) {
  const count = smSurveyResponseCount(item);
  if (count == null) return "Conteo no disponible";
  return `${formatoConteo(count)} respuesta${count === 1 ? "" : "s"}`;
}

export function smCatalogDateLabel(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "sin refresco registrado";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function smScopeSummary(scope: SmImportScopeFields, nSources: number) {
  const parts: string[] = [];
  parts.push("Completas");
  const channel = smChannelLabel(scope.channel);
  if (channel) parts.push(channel);
  const collectors = smSplitScopeList(scope.collectorIds);
  if (collectors.length) parts.push(`${collectors.length} recopilador${collectors.length === 1 ? "" : "es"}`);
  if (nSources > 1) parts.push(`${nSources} campañas`);
  return parts.join(", ");
}

export function smSpecCollectorSummary(spec?: SurveyMonkeyMultibaseSurveyInput | null) {
  const sources = smSpecSources(spec);
  if (!sources.length) return "";
  const filtered = sources
    .map((source, index) => {
      const collectors = smStringList(source.collector_ids ?? source.collector_id);
      if (!collectors.length) return "";
      const label = String(source.source_alias || source.source_title || source.label || source.survey_id || `Fuente ${index + 1}`).trim();
      return `${label}: ${collectors.join(", ")}`;
    })
    .filter(Boolean);
  if (!filtered.length) return "Recopiladores: todos incluidos";
  return `Recopiladores filtrados: ${filtered.join(", ")}`;
}

export function smSurveyById(surveys: SurveyMonkeyMultibaseListItem[] | null | undefined, id: string) {
  const clean = id.trim();
  if (!clean) return null;
  return (surveys ?? []).find((item) => item.id === clean) ?? null;
}

export function smKnownSourceCount(
  main: SurveyMonkeyMultibaseListItem,
  scope: SmImportScopeDraft,
  surveys: SurveyMonkeyMultibaseListItem[] | null,
) {
  const counts = [
    smSurveyResponseCount(main),
    ...scope.extraSources
      .filter((source) => source.surveyId.trim())
      .map((source) => smSurveyResponseCount(smSurveyById(surveys, source.surveyId) ?? { response_count: null })),
  ];
  if (counts.some((count) => count == null)) return null;
  return counts.reduce<number>((sum, count) => sum + Number(count), 0);
}

export function smSourceCountLabel(count: number | null) {
  if (count == null) return "conteo parcial/no disponible";
  return `${formatoConteo(count)} respuesta${count === 1 ? "" : "s"}`;
}

export function smExtraSourceCandidates(
  surveys: SurveyMonkeyMultibaseListItem[] | null,
  query: string,
  excludeIds: Set<string>,
  context?: SurveyMonkeyMultibaseListItem,
) {
  const q = query.trim() || smExtraSourceDefaultQuery(context);
  return (surveys ?? [])
    .filter((item) => !excludeIds.has(item.id))
    .filter((item) => smSurveyMatchesQuery(item, q))
    .sort((a, b) => {
      const countDelta = (smSurveyResponseCount(b) ?? -1) - (smSurveyResponseCount(a) ?? -1);
      if (countDelta !== 0) return countDelta;
      return smSurveyTitle(a).localeCompare(smSurveyTitle(b), "es");
    })
    .slice(0, 6);
}

export function smExtraSourceDefaultQuery(item?: SurveyMonkeyMultibaseListItem) {
  if (!item) return "";
  const alias = smSurveyDefaultAlias(item);
  const normalized = smNormalizeSearch(alias || smSurveyTitle(item));
  const stop = new Set([
    "acreditacion",
    "encuesta",
    "egresado",
    "egresados",
    "ingenieria",
    "de",
    "del",
    "la",
    "las",
    "los",
    "a",
    "pucp",
  ]);
  const tokens = normalized.split(" ").filter((token) => token.length > 2 && !stop.has(token));
  return tokens.slice(0, 3).join(" ");
}

export function smNumberRangeLabel(values: number[], singular: string, plural = `${singular}s`) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return `Sin ${plural}`;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const noun = max === 1 ? singular : plural;
  return min === max ? `${max} ${noun}` : `${min}-${max} ${plural}`;
}

export function smRefreshIsNoop(row: SurveyMonkeyRefreshBasePlan): boolean {
  const action = smRefreshAction(row);
  return action === "noop" || action === "noop_structure_warning";
}

export function smRefreshRowStatusText(row: SurveyMonkeyRefreshBasePlan): string {
  const action = smRefreshAction(row);
  if (action === "noop_structure_warning") return "Sin nuevas; se conserva la base actual";
  if (action === "noop") return "Sin nuevas; ya está al día";
  if (row.updateable) return "Se actualizará la base completa con sus fuentes guardadas";
  return "No se actualizará esta base";
}

export function smRefreshSourcesText(sources: SmSourceSummary[]) {
  if (!sources.length) return "";
  return sources
    .map((source) => `${source.title}${source.channel ? ` (${source.channel})` : ""}`)
    .join(", ");
}

export function smRefreshResultSourcesText(row: SurveyMonkeyRefreshResult["results"][number]) {
  const sources = row.sources ?? [];
  if (!sources.length) return "";
  return sources
    .map((source) => {
      const title = String(source.source_title || source.source_alias || source.survey_id || "Fuente").trim();
      const channel = smChannelLabel(String(source.channel || ""));
      const status = String(source.status || "").replace(/_/g, " ");
      return `${title}${channel ? ` (${channel})` : ""}: ${status || (source.refreshed ? "actualizada" : "no actualizada")}`;
    })
    .join(", ");
}

export function smSurveyAuditLabel(
  surveyId: string,
  audit: SurveyMonkeyMultibaseAudit,
  selectedInputs: SurveyMonkeyMultibaseSurveyInput[],
) {
  const input = selectedInputs.find((item) => item.survey_id === surveyId);
  const summary = audit.surveys.find((item) => item.survey_id === surveyId);
  return input?.source_alias || input?.label || summary?.label || summary?.title || surveyId;
}

export function smSurveyDefaultAlias(item: SurveyMonkeyMultibaseListItem) {
  return smCompactSurveyLikeLabel(smSurveyTitle(item));
}

export function smSurveyAlias(item: SurveyMonkeyMultibaseListItem, draft?: SmImportScopeDraft) {
  const alias = (draft?.alias ?? smSurveyDefaultAlias(item)).trim();
  return alias || smSurveyDefaultAlias(item);
}

export function smAliasDraftValue(item: SurveyMonkeyMultibaseListItem, draft?: SmImportScopeDraft) {
  return draft?.alias ?? smSurveyDefaultAlias(item);
}

export function smSourceInputFromScope(
  surveyId: string,
  label: string,
  scope: SmImportScopeFields,
  meta?: { sourceAlias?: string; sourceTitle?: string },
): SurveyMonkeyMultibaseSurveyInput {
  const input: SurveyMonkeyMultibaseSurveyInput = { survey_id: surveyId };
  if (label.trim()) input.label = label.trim();
  if (meta?.sourceAlias?.trim()) input.source_alias = meta.sourceAlias.trim();
  if (meta?.sourceTitle?.trim()) input.source_title = meta.sourceTitle.trim();
  input.response_statuses = smScopeStatuses(scope);
  input.keep_missing_status = false;
  const collectorIds = smSplitScopeList(scope.collectorIds);
  if (collectorIds.length) input.collector_ids = collectorIds;
  const dateModifiedGte = smScopeDate(scope.dateModifiedGte);
  const dateModifiedLte = smScopeDate(scope.dateModifiedLte);
  if (dateModifiedGte) input.date_modified_gte = dateModifiedGte;
  if (dateModifiedLte) input.date_modified_lte = dateModifiedLte;
  input.collection_strategy = scope.collectionStrategy;
  const channel = smChannelLabel(scope.channel);
  if (channel) {
    input.channel = channel;
    input.source_channel = channel;
  }
  const validationProfile = smValidationProfileForStrategy(scope.collectionStrategy);
  if (validationProfile) input.validation_exclusion_profile = validationProfile;
  return input;
}

export function smIndependentSurveyInput(
  item: SurveyMonkeyMultibaseListItem,
  draft?: SmImportScopeDraft,
): SurveyMonkeyMultibaseSurveyInput {
  const label = smSurveyAlias(item, draft);
  const sourceTitle = smSurveyTitle(item);
  const input: SurveyMonkeyMultibaseSurveyInput = {
    survey_id: item.id,
    label,
    source_alias: label,
    source_title: sourceTitle,
    pais: item.pais_guess ?? "",
    response_statuses: ["completed"],
    keep_missing_status: false,
  };
  const baseScope = draft ?? smDefaultScopeDraft();
  input.collection_strategy = baseScope.collectionStrategy;
  const baseChannel = smChannelLabel(baseScope.channel);
  if (baseChannel) {
    input.channel = baseChannel;
    input.source_channel = baseChannel;
  }
  const validationProfile = smValidationProfileForStrategy(baseScope.collectionStrategy);
  if (validationProfile) input.validation_exclusion_profile = validationProfile;
  if (!draft) return input;

  const extraSources = draft.extraSources
    .filter((source) => source.surveyId.trim())
    .map((source) => smSourceInputFromScope(
      source.surveyId.trim(),
      source.label.trim() || label,
      source,
      { sourceAlias: source.label.trim() || label },
    ));
  if (smHasScopeFilters(draft) || extraSources.length) {
    input.sources = [
      smSourceInputFromScope(item.id, label, draft, { sourceAlias: label, sourceTitle }),
      ...extraSources,
    ];
  }
  return input;
}

export function smCampaignInputFromSurvey(
  item: SurveyMonkeyMultibaseListItem,
  draft?: SmImportScopeFields & { alias?: string },
): SurveyMonkeyMultibaseSurveyInput {
  const scope = draft ?? smDefaultScopeDraft();
  const label = (draft?.alias ?? smSurveyDefaultAlias(item)).trim() || smSurveyDefaultAlias(item);
  return smSourceInputFromScope(
    item.id,
    label,
    scope,
    { sourceAlias: label, sourceTitle: smSurveyTitle(item) },
  );
}

export function smSelectedCampaignInputs(
  item: SurveyMonkeyMultibaseListItem,
  draft: SmImportScopeDraft,
  surveys: SurveyMonkeyMultibaseListItem[] | null,
) {
  const inputs = [smCampaignInputFromSurvey(item, draft)];
  for (const source of draft.extraSources) {
    const sourceId = source.surveyId.trim();
    if (!sourceId) continue;
    const picked = smSurveyById(surveys, sourceId);
    const fallbackItem: SurveyMonkeyMultibaseListItem = {
      id: sourceId,
      title: source.label || sourceId,
      nickname: "",
      date_modified: "",
      pais_guess: "",
      response_count: null,
    };
    const sourceItem = picked ?? fallbackItem;
    inputs.push(smCampaignInputFromSurvey(sourceItem, {
      ...source,
      alias: source.label.trim() || smSurveyDefaultAlias(sourceItem),
    }));
  }
  return inputs;
}

export function fileLabel(fileId?: string, fileName?: string) {
  const name = String(fileName ?? "").trim();
  if (name && name !== "NA") return name;
  const id = String(fileId ?? "").trim();
  return id || "Sin archivo";
}

export function importedAtLabel(value?: string) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "NA") return "Fecha no registrada";
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return raw;
  return dt.toLocaleString("es-PE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function responseFilterLabel(filter?: Record<string, unknown> | null) {
  if (!filter || typeof filter !== "object") return "";
  const kind = String(filter.kind ?? "");
  const kept = filter.kept_rows == null || Number.isNaN(Number(filter.kept_rows))
    ? null
    : Number(filter.kept_rows);
  const sourceCount = filter.source_count == null || Number.isNaN(Number(filter.source_count))
    ? null
    : Number(filter.source_count);
  if (kind === "uploaded_data") return kept == null ? "Respuestas subidas" : `Respuestas subidas, ${kept} registros`;
  const parts: string[] = [];
  if (sourceCount && sourceCount > 1) parts.push(`${sourceCount} fuentes`);
  if (kept != null) parts.push(`${kept} filtradas`);
  const statuses = Array.isArray(filter.statuses) ? filter.statuses.map(String).filter(Boolean) : [];
  if (statuses.length) parts.push(statuses.join("/"));
  const collectors = Array.isArray(filter.collector_ids) ? filter.collector_ids.map(String).filter(Boolean) : [];
  if (collectors.length) parts.push(`recopilador ${collectors.join(", ")}`);
  const until = String(filter.date_modified_lte ?? "").trim();
  if (until && until !== "NA") parts.push(`hasta ${until.slice(0, 16).replace("T", " ")}`);
  return parts.join(", ");
}

export type HistoryRecord = Record<string, unknown>;

export type LabelOverrideEntry = {
  key: string;
  value: string;
  origin: string;
  variable: string;
};

export type LabelOverrideGroup = {
  origin: string;
  entries: LabelOverrideEntry[];
};

export type VariantRow = {
  from: string;
  to: string;
  origin: string;
  ref: string;
};

export type VariantGroup = {
  from: string;
  rows: VariantRow[];
};

export function asHistoryRecord(value: unknown): HistoryRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as HistoryRecord : {};
}

export function integratedHistoryArray<T = HistoryRecord>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") return Object.values(value) as T[];
  return [];
}

export function integratedLabelOverrideEntries(meta?: EstudioMultiIntegrated | null) {
  const raw = asHistoryRecord(meta?.label_overrides_by_key);
  const out: LabelOverrideEntry[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value as HistoryRecord)) {
        out.push({
          key: `${key}/${nestedKey}`,
          value: String(nestedValue ?? ""),
          origin: key,
          variable: nestedKey,
        });
      }
    } else {
      out.push({
        key,
        value: String(value ?? ""),
        origin: "Común",
        variable: key,
      });
    }
  }
  return out.filter((entry) => entry.key && entry.value && entry.value !== "[object Object]");
}

export function integratedStandardLabelEntries(meta?: EstudioMultiIntegrated | null) {
  const raw = asHistoryRecord(meta?.label_overrides_standard);
  return Object.entries(raw)
    .map(([key, value]) => ({
      key,
      value: String(value ?? ""),
      origin: "Final común",
      variable: key,
    }))
    .filter((entry) => entry.key && entry.value && entry.value !== "[object Object]");
}

export function integratedLabelOverrideGroups(meta?: EstudioMultiIntegrated | null): LabelOverrideGroup[] {
  const byOrigin = new Map<string, LabelOverrideEntry[]>();
  for (const entry of integratedLabelOverrideEntries(meta)) {
    const origin = entry.origin || "Común";
    byOrigin.set(origin, [...(byOrigin.get(origin) ?? []), entry]);
  }
  return Array.from(byOrigin.entries())
    .map(([origin, entries]) => ({ origin, entries }))
    .sort((a, b) => b.entries.length - a.entries.length || a.origin.localeCompare(b.origin));
}

export function integratedVariantRows(meta?: EstudioMultiIntegrated | null): VariantRow[] {
  return integratedHistoryArray<HistoryRecord>(meta?.variant_map)
    .map((item) => ({
      from: String(item.from ?? ""),
      to: String(item.to ?? ""),
      origin: String(item.origin_key ?? ""),
      ref: String(item.ref_origin_key ?? ""),
    }))
    .filter((item) => item.from || item.to || item.origin);
}

export function integratedVariantGroups(meta?: EstudioMultiIntegrated | null): VariantGroup[] {
  const bySource = new Map<string, VariantRow[]>();
  for (const row of integratedVariantRows(meta)) {
    const source = row.from || "Variable";
    bySource.set(source, [...(bySource.get(source) ?? []), row]);
  }
  return Array.from(bySource.entries())
    .map(([from, rows]) => ({ from, rows }))
    .sort((a, b) => b.rows.length - a.rows.length || a.from.localeCompare(b.from));
}

export type IconCmp = typeof Database;
