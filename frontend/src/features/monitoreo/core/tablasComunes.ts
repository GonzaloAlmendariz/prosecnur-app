// Helpers de formato y rótulos idénticos entre las páginas de Telefónico y
// Acreditación (L33 parte 2, lote 1). Se movieron sin cambiar una línea; las
// dos páginas los importan de aquí. Semántica de familia: no se fusiona nada más.
import { formatPercentLabel, normalizeReportMatch, parseCalendarIsoDate, reportNumberValue, reportPercentValue, shortColumnLabel } from "./rotulosComunes";
import { CALENDAR_REPORT_WEEKDAY_INDEX, calendarIsoDate, normalizeCalendarReportWeekday } from "../profiles/telefonico/avance/ritmoDiario";
import { type MonitoreoAcreditacionReports, type MonitoreoInternalQueryCase, type MonitoreoReportBlock, type MonitoreoReportSheet, type MonitoreoReportWeekday, type MonitoreoState, type MonitoreoStrategyPhase, type MonitoreoStrategyReportException } from "../../../api/client";
import { internalCaseCrossingValue, internalCaseResponseStateValue, summarizeInternalCases } from "../internalQueries";
import { fmt, normalizeSourceMatch } from "../profiles/telefonico/formato";

export function calendarAddDaysIso(value: string, days: number) {
  const date = parseCalendarIsoDate(value);
  if (!date) return "";
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return calendarIsoDate(next);
}

export function calendarReportExceptions(phase: MonitoreoStrategyPhase): MonitoreoStrategyReportException[] {
  return (phase.client_report_exceptions ?? []).map((item) => ({
    week: Number.isFinite(Number(item.week)) && Number(item.week) > 0 ? Number(item.week) : null,
    weekday: normalizeCalendarReportWeekday(item.weekday),
    date: item.date ?? "",
    note: item.note ?? "",
  })).filter((item) => item.week || item.date || item.weekday || item.note);
}

export function calendarWeekRange(phase: MonitoreoStrategyPhase) {
  const start = Number(phase.start_week);
  const end = Number(phase.end_week ?? phase.start_week);
  const startWeek = Number.isFinite(start) && start > 0 ? start : 1;
  const endWeek = Number.isFinite(end) && end >= startWeek ? end : startWeek;
  return { startWeek, endWeek };
}

export function calendarReportDateForWeek(phase: MonitoreoStrategyPhase, week: number | null, weekday: MonitoreoReportWeekday | "", overrideDate = "") {
  if (overrideDate) return overrideDate;
  if (!phase.start_date || !week || !weekday) return "";
  const { startWeek } = calendarWeekRange(phase);
  const weekStart = calendarAddDaysIso(phase.start_date, Math.max(0, week - startWeek) * 7);
  const weekStartDate = parseCalendarIsoDate(weekStart);
  const weekdayIndex = CALENDAR_REPORT_WEEKDAY_INDEX.get(weekday);
  if (!weekStartDate || weekdayIndex == null) return "";
  const delta = (weekdayIndex - weekStartDate.getDay() + 7) % 7;
  const date = calendarAddDaysIso(weekStart, delta);
  if (phase.end_date && date > phase.end_date) return "";
  return date;
}

export function reportsFromState(state: MonitoreoState | null) {
  return normalizeAcreditacionReports(state?.dashboard?.acreditacion_reports ?? null);
}

export function normalizeAcreditacionReports(reports: MonitoreoAcreditacionReports | null | undefined): MonitoreoAcreditacionReports | null {
  if (!reports) return null;
  const client = reports.client_report ?? null;
  return {
    ...reports,
    schema: reports.schema || "apps_script_acreditacion_v1",
    generated_at: reports.generated_at || "",
    reference_tabs: Array.isArray(reports.reference_tabs) ? reports.reference_tabs : [],
    internal_queries: reports.internal_queries ?? null,
    client_report: client
      ? {
        ...client,
        summary: Array.isArray(client.summary) ? client.summary : [],
        actors: Array.isArray(client.actors) ? client.actors : [],
        daily_general: Array.isArray(client.daily_general) ? client.daily_general : [],
        daily_actor: Array.isArray(client.daily_actor) ? client.daily_actor : [],
        sources: Array.isArray(client.sources) ? client.sources : [],
        collector_sources: Array.isArray(client.collector_sources) ? client.collector_sources : [],
        controls: Array.isArray(client.controls) ? client.controls : [],
        sheets: Array.isArray(client.sheets) ? client.sheets : [],
      }
      : null,
    sheets: Array.isArray(reports.sheets) ? reports.sheets : [],
  };
}

export function rowValue(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}

export function rowsFromSheets(sheets: MonitoreoReportSheet[] = [], terms: string[] = []) {
  const filters = terms.map((term) => term.toLowerCase());
  return sheets.flatMap((sheet) => (
    sheet.blocks.flatMap((block) => {
      const haystack = `${sheet.id} ${sheet.title} ${block.id} ${block.title}`.toLowerCase();
      if (filters.length && !filters.some((term) => haystack.includes(term))) return [];
      return block.rows.map((row) => ({
        _sheet: sheet.title,
        _block: block.title,
        ...row,
      }));
    })
  ));
}

export function rowsForSheetBlock(
  reports: MonitoreoAcreditacionReports,
  sheetId: string,
  blockIds: string[] = [],
) {
  const sheet = reports.sheets.find((item) => item.id === sheetId) ?? null;
  if (!sheet) return [];
  const wanted = new Set(blockIds.map((id) => id.toLowerCase()));
  return sheet.blocks.flatMap((block) => {
    if (wanted.size && !wanted.has(String(block.id).toLowerCase())) return [];
    return block.rows.map((row) => ({
      _block: block.title,
      ...row,
    }));
  }) as Array<Record<string, unknown>>;
}

export function phoneDisplayRowsWithBaseColumn(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => {
    if (!Object.prototype.hasOwnProperty.call(row, "Actor")) return row;
    const { Actor: actor, ...rest } = row;
    return { Base: actor, ...rest };
  });
}

export function acreditacionPhoneControlSampleRows(reports: MonitoreoAcreditacionReports) {
  return rowsForSheetBlock(reports, "monitoreo_telefonico", ["muestra_control", "muestra_supervision", "control_sample"]);
}

export function caseDisplayName(item: MonitoreoInternalQueryCase) {
  return String(item.person_label || item.case_key || item.response_id || "Caso sin llave")
    .toLocaleLowerCase("es-PE")
    .replace(/(^|[\s,.'’()-])(\p{L})/gu, (_match, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase("es-PE")}`);
}

export function caseWithoutCrossing(item: MonitoreoInternalQueryCase) {
  const crossing = internalCaseCrossingValue(item);
  return crossing === "sin_cruce" || crossing === "sin_llave" || crossing === "sin_base";
}

export function casePhoneAction(item: MonitoreoInternalQueryCase) {
  return String(item.phone_audit?.recommended_action || "").trim();
}

export function responseCounts(cases: MonitoreoInternalQueryCase[]) {
  return cases.reduce(
    (acc, item) => {
      const response = internalCaseResponseStateValue(item);
      acc.total += 1;
      if (response === "complete") acc.complete += 1;
      else if (response === "partial") acc.partial += 1;
      else if (response === "refusal") acc.refusal += 1;
      else acc.pending += 1;
      if (caseWithoutCrossing(item)) acc.withoutCrossing += 1;
      return acc;
    },
    { total: 0, complete: 0, partial: 0, refusal: 0, pending: 0, withoutCrossing: 0 },
  );
}

export function groupedCaseRows(
  cases: MonitoreoInternalQueryCase[],
  groupValue: (item: MonitoreoInternalQueryCase) => string,
  groupLabel: (value: string) => string,
) {
  const groups = new Map<string, MonitoreoInternalQueryCase[]>();
  cases.forEach((item) => {
    const value = groupValue(item) || "Sin dato";
    const bucket = groups.get(value) ?? [];
    bucket.push(item);
    groups.set(value, bucket);
  });
  return Array.from(groups.entries())
    .map(([value, rows]) => {
      const counts = responseCounts(rows);
      return {
        Grupo: groupLabel(value),
        Casos: counts.total,
        Completas: counts.complete,
        Parciales: counts.partial,
        Rechazos: counts.refusal,
        "Sin respuesta": counts.pending,
        "Sin cruce": counts.withoutCrossing,
      };
    })
    .sort((a, b) => Number(b.Casos) - Number(a.Casos) || String(a.Grupo).localeCompare(String(b.Grupo), "es"));
}

export function caseDimensionRows(
  cases: MonitoreoInternalQueryCase[],
  dimension: "actor" | "source_label" | "channel" | "date",
  label: string,
) {
  const groups = new Map<string, MonitoreoInternalQueryCase[]>();
  cases.forEach((item) => {
    const key = String(item[dimension] || "Sin dato");
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  });
  return Array.from(groups.entries())
    .map(([group, rows]) => {
      const summary = summarizeInternalCases(rows);
      return {
        [label]: group,
        Total: summary.total,
        Efectivas: summary.effective,
        Parciales: summary.partial,
        Rechazos: summary.refusal,
        "Sin respuesta": summary.pending,
      };
    })
    .sort((a, b) => Number(b.Total) - Number(a.Total) || String(a[label]).localeCompare(String(b[label]), "es"));
}

export function reportBlockForSheet(
  reports: MonitoreoAcreditacionReports | null | undefined,
  sheetId: string,
  blockId?: string,
) {
  const sheetKey = normalizeReportMatch(sheetId);
  const sheet = reports?.sheets.find((item) => normalizeReportMatch(item.id) === sheetKey) ?? null;
  if (!sheet) return null;
  if (!blockId) return sheet.blocks[0] ?? null;
  const blockKey = normalizeReportMatch(blockId);
  return sheet.blocks.find((block) => normalizeReportMatch(block.id) === blockKey) ?? null;
}

export function reportBlockColumns(block: MonitoreoReportBlock | null | undefined) {
  if (!block) return [];
  return block.columns.length ? block.columns : Array.from(new Set(block.rows.flatMap((row) => Object.keys(row))));
}

export function reportStateTone(value: string) {
  const normalized = normalizeReportMatch(value);
  if (normalized.includes("alta") || normalized.includes("rechazo") || normalized.includes("riesgo") || normalized.includes("no ")) return "risk";
  if (normalized.includes("media") || normalized.includes("parcial") || normalized.includes("contactar") || normalized.includes("pendiente")) return "warn";
  if (normalized.includes("ok") || normalized.includes("efectiv") || normalized.includes("completa")) return "good";
  return "muted";
}

export function acreditacionReportRowValue(row: Record<string, unknown>, candidates: string[]) {
  const normalized = new Map(Object.keys(row).map((key) => [normalizeSourceMatch(key), key]));
  for (const candidate of candidates) {
    const hit = normalized.get(normalizeSourceMatch(candidate));
    if (hit) return row[hit];
  }
  return null;
}

export function acreditacionReportColumn(block: MonitoreoReportBlock | null | undefined, candidates: string[]) {
  const wanted = candidates.map(normalizeSourceMatch);
  return reportBlockColumns(block).find((column) => wanted.includes(normalizeSourceMatch(column))) ?? null;
}

export function acreditacionReportBlockDateColumns(block: MonitoreoReportBlock | null | undefined) {
  const excluded = new Set([
    "unidad",
    "actor",
    "corte",
    "carrera",
    "canal",
    "modalidad",
    "estado",
    "estatus",
    "total",
    "fecha",
    "dia",
    "día",
    "fuente",
    "source",
    "source_id",
    "source id",
    "id fuente",
    "encuesta",
    "survey_id",
    "survey id",
    "id encuesta",
    "recopilador",
    "collector",
    "collector_id",
    "collector id",
    "id recopilador",
    "tipo recopilador",
    "tipo_recopilador",
    "efectivas",
    "validas",
    "válidas",
    "completas",
    "completed",
    "parciales",
    "partial",
    "rechazo",
    "rechazos",
    "rechazos plataforma",
    "refusals",
    "respuestas",
    "total respuestas",
    "acumulado",
    "avance",
    "porcentaje",
  ]);
  return reportBlockColumns(block).filter((column) => {
    const key = normalizeSourceMatch(column);
    if (!key || excluded.has(key)) return false;
    return /\d/.test(column) || (block?.rows ?? []).some((row) => reportNumberValue(row[column]) > 0);
  });
}

export function reportPanelSheetTitle(sheet: MonitoreoReportSheet) {
  if (normalizeReportMatch(sheet.id) === "reporte" || normalizeReportMatch(sheet.id) === "resumen") return "Reporte";
  if (normalizeReportMatch(sheet.id) === "avance_encuesta") return "Encuestas";
  return sheet.title.replace(/\binterno\b/gi, "").replace(/\s{2,}/g, " ").trim();
}

export function reportBlockTone(blockId: string, sheetId: string) {
  const id = normalizeReportMatch(`${sheetId} ${blockId}`);
  if (id.includes("alert")) return "risk";
  if (id.includes("telefon") || id.includes("estatus") || id.includes("responsable")) return "phone";
  if (id.includes("encuesta")) return "survey";
  if (id.includes("dia") || id.includes("avance")) return "trend";
  return "summary";
}

export function reportBlockMetric(block?: MonitoreoReportBlock) {
  if (!block || !block.rows.length) return { label: "Filas", value: "0", tone: "neutral" };
  const cols = reportBlockColumns(block);
  const pick = (candidates: string[]) => cols.find((column) => {
    const normalized = normalizeReportMatch(column);
    return candidates.some((candidate) => normalized.includes(candidate));
  });
  const pctCol = pick(["avance total", "avance minimo", "porcentaje", "del total", "universo", "efectivas"]);
  if (pctCol) {
    const values = block.rows.map((row) => reportPercentValue(row[pctCol], pctCol)).filter((value): value is number => value != null);
    if (values.length) {
      const value = values.reduce((sum, item) => sum + item, 0) / values.length;
      return { label: shortColumnLabel(pctCol), value: formatPercentLabel(value), tone: value >= 70 ? "good" : value > 0 ? "warn" : "neutral" };
    }
  }
  const numericCol = pick(["total", "casos", "respuestas", "completas", "efectivas", "alerta"]);
  if (numericCol) {
    const total = block.rows.reduce((sum, row) => sum + reportNumberValue(row[numericCol]), 0);
    return { label: shortColumnLabel(numericCol), value: fmt(total), tone: total > 0 ? "good" : "neutral" };
  }
  return { label: "Filas", value: fmt(block.rows.length), tone: "neutral" };
}
