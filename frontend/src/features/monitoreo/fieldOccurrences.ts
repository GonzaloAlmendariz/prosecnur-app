import type {
  MonitoreoFieldOccurrenceDashboard,
  MonitoreoFieldOccurrenceDistrictSummary,
  MonitoreoFieldOccurrenceRecord,
  MonitoreoFieldOccurrenceUmpSummary,
  MonitoreoRow,
} from "../../api/client";

export type OccurrenceUmpAttentionStatus =
  | "reportada_efectiva"
  | "reportada_no_efectiva"
  | "revisar_cruce"
  | "completa_sin_reporte"
  | "incompleta_sin_reporte"
  | "iniciada_sin_reporte"
  | "sin_reporte";

export type OccurrenceUmpAttentionReason =
  | "sin_reporte"
  | "iniciada_sin_reporte"
  | "completa_sin_reporte"
  | "incompleta_sin_reporte"
  | "ump_no_esperada"
  | "fuera_ruta"
  | "multiples_consolidados"
  | "observacion"
  | "motivo_concentrado";

export type OccurrenceOutcomeSummary = {
  key: string;
  label: string;
  total: number;
};

export type OccurrenceRouteUmpRow = {
  id: string;
  key: string;
  ump: string;
  manzana: string;
  manzana_key: string;
  route_label: string;
  distrito: string;
  zona: string;
  responsable: string;
  route_match_status: string;
  route_match_message: string;
  reportes: number;
  efectivas: number;
  no_efectivas: number;
  intentos: number;
  advance_validas: number;
  advance_meta: number;
  advance_started: boolean;
  advance_complete: boolean;
  advance_quota_status: string;
  advance_last_activity: string;
  tasa_no_efectiva: number | null;
  ultimo_reporte: string;
  outcomes: OccurrenceOutcomeSummary[];
  records: MonitoreoFieldOccurrenceRecord[];
  expected_blocks: MonitoreoRow[];
  has_report: boolean;
  is_unreconciled: boolean;
  is_outside_route: boolean;
  has_multiple_reports: boolean;
  has_observation: boolean;
  status: OccurrenceUmpAttentionStatus;
  attention_reasons: OccurrenceUmpAttentionReason[];
  dominant_outcome: OccurrenceOutcomeSummary | null;
  last_report_label: string;
  report_window_label: string;
  observation_excerpt: string;
  source_row_ids: string[];
  search_text: string;
};

export type BuildOccurrenceRouteUmpRowsInput = {
  occurrences?: MonitoreoFieldOccurrenceDashboard | null;
  umpSummary?: MonitoreoFieldOccurrenceUmpSummary[];
};

export type OccurrenceDistrictSummary = MonitoreoFieldOccurrenceDistrictSummary;

const STATUS_PRIORITY: Record<OccurrenceUmpAttentionStatus, number> = {
  revisar_cruce: 0,
  reportada_no_efectiva: 1,
  reportada_efectiva: 2,
  completa_sin_reporte: 3,
  incompleta_sin_reporte: 4,
  iniciada_sin_reporte: 5,
  sin_reporte: 6,
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "" || value === "NA") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function safeInt(value: unknown) {
  return numberOrNull(value) ?? 0;
}

function normalizeKey(value: unknown) {
  return text(value)
    .toLocaleLowerCase("es-PE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const SPANISH_MONTH_ORDER: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function occurrenceDateSortValue(value: unknown) {
  const raw = text(value);
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return Number(`${iso[1]}${iso[2]}${iso[3]}`);
  const key = normalizeKey(raw);
  const label = key.match(/^(\d{1,2})_([a-z]+)(?:_(\d{4}))?$/);
  if (!label) return 0;
  const day = Number(label[1]);
  const month = SPANISH_MONTH_ORDER[label[2]] ?? 0;
  const year = Number(label[3] ?? "0");
  return year * 10000 + month * 100 + day;
}

function latestOccurrenceDateLabel(values: unknown[]) {
  const labels = Array.from(new Set(values.map(text).filter(Boolean)));
  return labels.sort((a, b) => occurrenceDateSortValue(a) - occurrenceDateSortValue(b) || a.localeCompare(b, "es-PE")).at(-1) ?? "";
}

function normalizeUmp(value: unknown) {
  return text(value)
    .replace(/^UMP\s*/i, "")
    .replace(/\.0+$/g, "")
    .replace(/^0+([0-9]+)$/g, "$1")
    .trim();
}

function pick(row: MonitoreoRow | Record<string, unknown> | null | undefined, keys: string[]) {
  if (!row) return "";
  for (const key of keys) {
    const value = text(row[key]);
    if (value) return value;
  }
  return "";
}

function blockUmp(row: MonitoreoRow) {
  return normalizeUmp(pick(row, ["ump_group", "ump", "hoja_num", "orden_seleccion", "titular_hoja_num", "titular_orden_seleccion"]));
}

function blockDistrict(row: MonitoreoRow) {
  return pick(row, ["distrito", "district", "district_label", "ubigeo", "district_key"]);
}

function blockIdentity(row: MonitoreoRow) {
  const ump = blockUmp(row);
  const district = normalizeKey(blockDistrict(row));
  if (ump) return `ump:${district || "sin_distrito"}:${normalizeKey(ump)}`;
  return `route:${normalizeKey(pick(row, ["route_key", "manzana_key", "id_manzana", "block_id", "id"])) || normalizeKey(pick(row, ["manzana", "zona", "distrito"]))}`;
}

function summaryDistrict(row: MonitoreoFieldOccurrenceUmpSummary) {
  return normalizeKey(row.distrito);
}

function summaryUmp(row: MonitoreoFieldOccurrenceUmpSummary) {
  return normalizeUmp(row.ump);
}

function summaryIdentity(row: MonitoreoFieldOccurrenceUmpSummary) {
  const ump = summaryUmp(row);
  if (ump) return `ump:${summaryDistrict(row) || "sin_distrito"}:${normalizeKey(ump)}`;
  return `route:${normalizeKey(row.manzana_key || row.key || row.route_label)}`;
}

function summaryLooseUmp(row: MonitoreoFieldOccurrenceUmpSummary) {
  const ump = summaryUmp(row);
  return ump ? `ump:${normalizeKey(ump)}` : "";
}

function recordIdentity(row: MonitoreoFieldOccurrenceRecord) {
  const ump = normalizeUmp(row.ump);
  if (ump) return `ump:${normalizeKey(row.distrito) || "sin_distrito"}:${normalizeKey(ump)}`;
  return `route:${normalizeKey(row.manzana_key || row.route_label || row.row_id)}`;
}

function recordLooseUmp(row: MonitoreoFieldOccurrenceRecord) {
  const ump = normalizeUmp(row.ump);
  return ump ? `ump:${normalizeKey(ump)}` : "";
}

function recordRouteKey(row: MonitoreoFieldOccurrenceRecord) {
  return normalizeKey(row.manzana_key || row.route_label || row.row_id);
}

function uniqueRows(rows: MonitoreoRow[]) {
  const seen = new Set<string>();
  const out: MonitoreoRow[] = [];
  rows.forEach((row, index) => {
    const key = normalizeKey(pick(row, ["route_key", "manzana_key", "id_manzana", "block_id", "id"])) ||
      `${blockIdentity(row)}:${normalizeKey(pick(row, ["manzana", "zona", "tipo_manzana"]))}` ||
      `row:${index}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(row);
  });
  return out;
}

function routeLabelFromBlock(row: MonitoreoRow, blocks: MonitoreoRow[]) {
  const explicit = pick(row, ["block_label", "route_label", "label"]);
  const manzana = pick(row, ["manzana"]);
  const zona = pick(row, ["zona"]);
  const distrito = blockDistrict(row);
  const ump = blockUmp(row);
  const base = explicit || [
    manzana ? `Mz ${manzana}` : "",
    zona ? `Zona ${zona}` : "",
    distrito,
  ].filter(Boolean).join(" · ");
  const extra = blocks.length > 1 ? ` · ${blocks.length} manzanas` : "";
  return base || (ump ? `UMP ${ump}${extra}` : "UMP sin etiqueta");
}

function routeRecordsForSummary(
  summary: MonitoreoFieldOccurrenceUmpSummary | null,
  records: MonitoreoFieldOccurrenceRecord[],
  identity: string,
) {
  if (!summary) return [];
  const loose = summaryLooseUmp(summary);
  const route = normalizeKey(summary.manzana_key || summary.key || summary.route_label);
  return records.filter((record) => {
    if (recordIdentity(record) === identity) return true;
    if (loose && recordLooseUmp(record) === loose) return true;
    return route && recordRouteKey(record) === route;
  });
}

function topOutcome(outcomes: OccurrenceOutcomeSummary[]) {
  return [...outcomes].filter((item) => item.total > 0).sort((a, b) => b.total - a.total)[0] ?? null;
}

function normalizedBackendStatus(value: unknown): OccurrenceUmpAttentionStatus | null {
  const raw = normalizeKey(value);
  if (raw === "sin_reporte" || raw === "sin_consolidado") return "sin_reporte";
  if (raw === "completa_sin_reporte" || raw === "completa_sin_ocurrencias") return "completa_sin_reporte";
  if (raw === "incompleta_sin_reporte" || raw === "incompleta_sin_ocurrencias") return "incompleta_sin_reporte";
  if (raw === "iniciada_sin_reporte" || raw === "iniciada_sin_ocurrencias") return "iniciada_sin_reporte";
  if (raw === "reportada_efectiva" || raw === "efectiva" || raw === "consolidado") return "reportada_efectiva";
  if (raw === "reportada_no_efectiva" || raw === "no_efectiva") return "reportada_no_efectiva";
  if (raw === "revisar_cruce" || raw === "fuera_ruta" || raw === "priorizar") return "revisar_cruce";
  return null;
}

function classifyRow(input: {
  hasReport: boolean;
  isOutsideRoute: boolean;
  hasMultipleReports: boolean;
  hasObservation: boolean;
  noEfectivas: number;
  isUnexpectedUmp: boolean;
  advanceStarted: boolean;
  advanceComplete: boolean;
  advanceMeta: number;
  backendStatus?: unknown;
}) {
  const reasons: OccurrenceUmpAttentionReason[] = [];
  if (!input.hasReport) reasons.push("sin_reporte");
  if (!input.hasReport && input.advanceStarted && input.advanceComplete) reasons.push("completa_sin_reporte");
  else if (!input.hasReport && input.advanceStarted && input.advanceMeta > 0) reasons.push("incompleta_sin_reporte");
  else if (!input.hasReport && input.advanceStarted) reasons.push("iniciada_sin_reporte");
  if (input.isUnexpectedUmp) reasons.push("ump_no_esperada");
  else if (input.isOutsideRoute) reasons.push("fuera_ruta");
  if (input.hasMultipleReports) reasons.push("multiples_consolidados");
  if (input.hasObservation) reasons.push("observacion");

  const backendStatus = normalizedBackendStatus(input.backendStatus);
  let status: OccurrenceUmpAttentionStatus = backendStatus ?? "reportada_efectiva";
  if (!backendStatus) {
    if (!input.hasReport) {
      if (input.advanceStarted && input.advanceComplete) status = "completa_sin_reporte";
      else if (input.advanceStarted && input.advanceMeta > 0) status = "incompleta_sin_reporte";
      else if (input.advanceStarted) status = "iniciada_sin_reporte";
      else status = "sin_reporte";
    } else if (reasons.includes("fuera_ruta") || reasons.includes("multiples_consolidados")) {
      status = "revisar_cruce";
    } else if (input.noEfectivas > 0) {
      status = "reportada_no_efectiva";
    }
  }
  return { status, reasons };
}

function recordSet(records: MonitoreoFieldOccurrenceRecord[]) {
  const ids = new Set<string>();
  const routes = new Set<string>();
  const identities = new Set<string>();
  const looseUmps = new Set<string>();
  records.forEach((record) => {
    const id = text(record.row_id);
    if (id) ids.add(id);
    const route = recordRouteKey(record);
    if (route) routes.add(route);
    const identity = recordIdentity(record);
    if (identity) identities.add(identity);
    const loose = recordLooseUmp(record);
    if (loose) looseUmps.add(loose);
  });
  return { ids, routes, identities, looseUmps };
}

function rowMatchesSet(rowRecords: MonitoreoFieldOccurrenceRecord[], sets: ReturnType<typeof recordSet>) {
  return rowRecords.some((record) => {
    const id = text(record.row_id);
    if (id && sets.ids.has(id)) return true;
    const route = recordRouteKey(record);
    if (route && sets.routes.has(route)) return true;
    const identity = recordIdentity(record);
    if (identity && sets.identities.has(identity)) return true;
    const loose = recordLooseUmp(record);
    return Boolean(loose && sets.looseUmps.has(loose));
  });
}

function windowLabel(records: MonitoreoFieldOccurrenceRecord[], fallback = "") {
  const withWindow = records.find((record) => text(record.hora_label));
  if (withWindow) {
    const date = text(withWindow.date_label || withWindow.date);
    return [date, text(withWindow.hora_label)].filter(Boolean).join(" · ");
  }
  const start = records.find((record) => text(record.datetime_label || record.date_label || record.hora_inicio));
  if (start) return text(start.datetime_label || start.date_label || start.hora_inicio);
  return fallback;
}

function observationExcerpt(records: MonitoreoFieldOccurrenceRecord[]) {
  return text(records.find((record) => text(record.observaciones))?.observaciones ?? "");
}

function buildSearchText(row: Omit<OccurrenceRouteUmpRow, "search_text">) {
  return [
    row.ump,
    row.manzana,
    row.manzana_key,
    row.route_label,
    row.distrito,
    row.zona,
    row.responsable,
    row.status,
    row.attention_reasons.join(" "),
    row.route_match_status,
    row.route_match_message,
    row.dominant_outcome?.label ?? "",
    row.last_report_label,
    row.advance_validas,
    row.advance_meta,
    row.advance_quota_status,
    row.advance_last_activity,
  ].join(" ").toLocaleLowerCase("es-PE");
}

function makeRow(params: {
  identity: string;
  summary: MonitoreoFieldOccurrenceUmpSummary | null;
  expectedBlocks: MonitoreoRow[];
  records: MonitoreoFieldOccurrenceRecord[];
  isOutsideRoute: boolean;
  highNonEffective: boolean;
}) {
  const anchor = params.expectedBlocks[0];
  const summary = params.summary;
  const outcomes = (summary?.outcomes ?? []).map((item) => ({
    key: item.key,
    label: item.label,
    total: safeInt(item.total),
  }));
  const dominant = topOutcome(outcomes);
  const reportes = safeInt(summary?.reportes);
  const intentos = safeInt(summary?.intentos);
  const noEfectivas = safeInt(summary?.no_efectivas);
  const tasa = numberOrNull(summary?.tasa_no_efectiva);
  const hasReport = summary?.has_report ?? Boolean(summary && reportes > 0);
  const advanceValidas = safeInt(summary?.avance_validas ?? pick(anchor, ["avance_validas", "validas_avance", "validas"]));
  const advanceMeta = safeInt(summary?.avance_meta ?? pick(anchor, ["avance_meta", "target", "meta", "entrevistas"]));
  const advanceLastActivity = text(summary?.avance_ultimo_ingreso ?? pick(anchor, ["avance_ultimo_ingreso", "ultimo_ingreso_avance", "last_record", "ultima_actividad"]));
  const advanceQuotaStatus = text(summary?.avance_estado_cuota ?? pick(anchor, ["avance_estado_cuota", "estado_cuota_avance", "estado_cuota", "status", "estado"]));
  const advanceStarted = Boolean(summary?.avance_iniciada) || advanceValidas > 0;
  const advanceComplete = Boolean(summary?.avance_completa) || (advanceMeta > 0 && advanceValidas >= advanceMeta) || normalizeKey(advanceQuotaStatus) === "completa";
  const hasObservation = params.records.some((record) => text(record.observaciones));
  const hasMultipleReports = reportes > 1;
  const isUnexpectedUmp = params.isOutsideRoute && hasReport && params.expectedBlocks.length === 0 && (
    text(summary?.route_match_status) === "ump_no_esperada" ||
    Boolean(summary?.ump)
  );
  const classification = classifyRow({
    hasReport,
    isOutsideRoute: params.isOutsideRoute,
    hasMultipleReports,
    hasObservation,
    noEfectivas,
    isUnexpectedUmp,
    advanceStarted,
    advanceComplete,
    advanceMeta,
    backendStatus: summary?.estado_consolidado,
  });
  const blockUmpValue = anchor ? blockUmp(anchor) : "";
  const ump = text(summary?.ump) || blockUmpValue;
  const manzana = text(summary?.manzana) || pick(anchor, ["manzana"]);
  const distrito = text(summary?.distrito) || blockDistrict(anchor);
  const zona = text(summary?.zona) || pick(anchor, ["zona"]);
  const routeLabel = text(summary?.route_label) || (anchor ? routeLabelFromBlock(anchor, params.expectedBlocks) : "");
  const lastReport = text(summary?.ultimo_reporte);
  const sourceRowIds = params.records.map((record) => text(record.row_id)).filter(Boolean);
  const base: Omit<OccurrenceRouteUmpRow, "search_text"> = {
    id: params.identity,
    key: text(summary?.key) || params.identity,
    ump,
    manzana,
    manzana_key: text(summary?.manzana_key) || pick(anchor, ["route_key", "manzana_key", "id_manzana"]),
    route_label: routeLabel,
    distrito,
    zona,
    responsable: text(summary?.responsable) || "Sin responsable",
    route_match_status: text(summary?.route_match_status),
    route_match_message: text(summary?.route_match_message),
    reportes,
    efectivas: safeInt(summary?.efectivas),
    no_efectivas: noEfectivas,
    intentos,
    advance_validas: advanceValidas,
    advance_meta: advanceMeta,
    advance_started: advanceStarted,
    advance_complete: advanceComplete,
    advance_quota_status: advanceQuotaStatus,
    advance_last_activity: advanceLastActivity,
    tasa_no_efectiva: tasa,
    ultimo_reporte: lastReport,
    outcomes,
    records: params.records,
    expected_blocks: params.expectedBlocks,
    has_report: hasReport,
    is_unreconciled: isUnexpectedUmp,
    is_outside_route: params.isOutsideRoute,
    has_multiple_reports: hasMultipleReports,
    has_observation: hasObservation,
    status: classification.status,
    attention_reasons: classification.reasons,
    dominant_outcome: dominant,
    last_report_label: lastReport || "Sin reporte",
    report_window_label: windowLabel(params.records, lastReport || "Sin reporte"),
    observation_excerpt: observationExcerpt(params.records),
    source_row_ids: sourceRowIds,
  };
  return { ...base, search_text: buildSearchText(base) };
}

export function buildOccurrenceRouteUmpRows({
  occurrences,
  umpSummary,
}: BuildOccurrenceRouteUmpRowsInput): OccurrenceRouteUmpRow[] {
  const records = occurrences?.records ?? [];
  const summaries = umpSummary ?? occurrences?.by_ump ?? [];
  const routeChoices = uniqueRows([
    ...(occurrences?.config?.route_choices ?? []),
    ...(occurrences?.alerts?.missing_blocks ?? []),
  ]);
  const highSets = recordSet(occurrences?.alerts?.high_non_effective ?? []);
  const outsideSets = recordSet(occurrences?.alerts?.outside_route ?? []);

  const exact = new Map<string, MonitoreoFieldOccurrenceUmpSummary>();
  const loose = new Map<string, MonitoreoFieldOccurrenceUmpSummary[]>();
  summaries.forEach((summary) => {
    exact.set(summaryIdentity(summary), summary);
    const looseKey = summaryLooseUmp(summary);
    if (looseKey) loose.set(looseKey, [...(loose.get(looseKey) ?? []), summary]);
  });

  const expectedGroups = new Map<string, MonitoreoRow[]>();
  routeChoices.forEach((choice) => {
    const key = blockIdentity(choice);
    if (!key) return;
    expectedGroups.set(key, [...(expectedGroups.get(key) ?? []), choice]);
  });

  const usedSummaries = new Set<MonitoreoFieldOccurrenceUmpSummary>();
  const rows: OccurrenceRouteUmpRow[] = [];

  expectedGroups.forEach((blocks, identity) => {
    const looseKey = blockUmp(blocks[0]) ? `ump:${normalizeKey(blockUmp(blocks[0]))}` : "";
    const summary = exact.get(identity) ?? (looseKey && (loose.get(looseKey)?.length ?? 0) === 1 ? loose.get(looseKey)?.[0] : undefined) ?? null;
    if (summary) usedSummaries.add(summary);
    const rowRecords = routeRecordsForSummary(summary, records, identity);
    rows.push(makeRow({
      identity,
      summary,
      expectedBlocks: blocks,
      records: rowRecords,
      isOutsideRoute: rowRecords.length ? rowMatchesSet(rowRecords, outsideSets) : false,
      highNonEffective: rowRecords.length ? rowMatchesSet(rowRecords, highSets) : false,
    }));
  });

  summaries.forEach((summary) => {
    if (usedSummaries.has(summary)) return;
    const identity = summaryIdentity(summary);
    const rowRecords = routeRecordsForSummary(summary, records, identity);
    rows.push(makeRow({
      identity,
      summary,
      expectedBlocks: [],
      records: rowRecords,
      isOutsideRoute: rowRecords.length ? rowMatchesSet(rowRecords, outsideSets) : true,
      highNonEffective: rowRecords.length ? rowMatchesSet(rowRecords, highSets) : false,
    }));
  });

  return rows.sort((a, b) => (
    STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] ||
    Number(b.tasa_no_efectiva ?? -1) - Number(a.tasa_no_efectiva ?? -1) ||
    b.intentos - a.intentos ||
    (a.route_label || a.ump || a.key).localeCompare(b.route_label || b.ump || b.key, "es-PE")
  ));
}

export function buildOccurrenceDistrictSummary(
  occurrences: MonitoreoFieldOccurrenceDashboard | null | undefined,
  rows: OccurrenceRouteUmpRow[],
): OccurrenceDistrictSummary[] {
  const incoming = occurrences?.by_district ?? [];
  if (incoming.length) {
    return [...incoming].sort((a, b) => (
      Number(b.intentos ?? 0) - Number(a.intentos ?? 0) ||
      text(a.distrito).localeCompare(text(b.distrito), "es-PE")
    ));
  }
  const outcomeCatalog = new Map<string, string>();
  (occurrences?.by_outcome ?? []).forEach((item) => outcomeCatalog.set(item.key, item.label));
  rows.forEach((row) => row.outcomes.forEach((item) => outcomeCatalog.set(item.key, item.label)));
  const groups = new Map<string, OccurrenceRouteUmpRow[]>();
  rows.forEach((row) => {
    const district = text(row.distrito) || (
      row.is_unreconciled ? "UMP sin conciliación" : "Sin distrito"
    );
    groups.set(district, [...(groups.get(district) ?? []), row]);
  });
  return Array.from(groups.entries()).map(([distrito, districtRows]) => {
    const outcomes = Array.from(outcomeCatalog.entries()).map(([key, label]) => ({
      key,
      label,
      total: districtRows.reduce((sum, row) => (
        sum + (row.outcomes.find((item) => item.key === key)?.total ?? 0)
      ), 0),
    }));
	    const noEfectivas = districtRows.reduce((sum, row) => sum + row.no_efectivas, 0);
	    const intentos = districtRows.reduce((sum, row) => sum + row.intentos, 0);
	    const dominant = topOutcome(outcomes);
	    const missingAdvanceRows = districtRows.filter((row) => row.advance_started && !row.has_report && !row.is_unreconciled);
	    return {
	      distrito,
	      ump_reportadas: districtRows.filter((row) => row.has_report && !row.is_unreconciled).length,
	      ump_sin_reporte: districtRows.filter((row) => !row.has_report && !row.is_unreconciled).length,
	      ump_iniciadas_sin_reporte: missingAdvanceRows.length,
	      ump_completas_sin_reporte: districtRows.filter((row) => row.status === "completa_sin_reporte" && !row.is_unreconciled).length,
	      ump_incompletas_sin_reporte: districtRows.filter((row) => row.status === "incompleta_sin_reporte" && !row.is_unreconciled).length,
	      validas_sin_reporte: missingAdvanceRows.reduce((sum, row) => sum + row.advance_validas, 0),
	      ultimo_ingreso_sin_reporte: latestOccurrenceDateLabel(missingAdvanceRows.map((row) => row.advance_last_activity)),
	      efectivas: districtRows.reduce((sum, row) => sum + row.efectivas, 0),
      no_efectivas: noEfectivas,
      intentos,
      outcomes,
      motivo_principal: dominant?.label ?? "",
      tasa_no_efectiva: intentos > 0 ? noEfectivas / intentos : null,
    };
  }).sort((a, b) => (
    b.intentos - a.intentos ||
    a.distrito.localeCompare(b.distrito, "es-PE")
  ));
}
