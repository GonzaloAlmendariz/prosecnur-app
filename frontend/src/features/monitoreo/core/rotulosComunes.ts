// Helpers de formato y rótulos idénticos entre las páginas de Telefónico y
// Acreditación (L33 parte 2, lote 1). Se movieron sin cambiar una línea; las
// dos páginas los importan de aquí. Semántica de familia: no se fusiona nada más.
import { type MonitoreoInternalQueryCase, type MonitoreoSource, type MonitoreoStrategyPhase } from "../../../api/client";
import { fmt, formatDate, formatMetric, normalizeSourceMatch } from "../profiles/telefonico/formato";
import { ACREDITACION_DAILY_NO_DATE_LABEL, CALENDAR_DAY_MS, isAcreditacionNoDateLabel } from "../profiles/telefonico/avance/ritmoDiario";
import { formatInternalQueryDateLabel } from "../internalQueries";
import { pctDecimal } from "./formatoComun";

export function compactSelectLabel(value: string, maxLength = 68) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export function calendarWeekWindowLabel(phases: MonitoreoStrategyPhase[], fallbackEnd: number | null) {
  const weeks = phases.flatMap((phase) => [
    Number(phase.start_week),
    Number(phase.end_week ?? phase.start_week),
  ]).filter((week) => Number.isFinite(week) && week > 0);
  if (weeks.length) {
    const min = Math.min(...weeks);
    const max = Math.max(...weeks);
    return min === max ? `Semana ${fmt(min)}` : `Semanas ${fmt(min)}-${fmt(max)}`;
  }
  if (fallbackEnd && fallbackEnd > 0) return `Sugerido S1-S${fmt(fallbackEnd)}`;
  return "Pendiente";
}

export function calendarDateWindowLabel(phases: MonitoreoStrategyPhase[]) {
  const dates = phases.flatMap((phase) => [
    phase.start_date ?? "",
    phase.end_date ?? phase.start_date ?? "",
  ]).filter(Boolean).sort();
  if (!dates.length) return "Por definir";
  const start = dates[0];
  const end = dates[dates.length - 1];
  return start === end ? start : `${start} a ${end}`;
}

export function parseCalendarIsoDate(value: string | null | undefined) {
  const match = String(value ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function calendarDateDiffDays(start: string, end: string) {
  const startDate = parseCalendarIsoDate(start);
  const endDate = parseCalendarIsoDate(end);
  if (!startDate || !endDate) return null;
  return Math.round((endDate.getTime() - startDate.getTime()) / CALENDAR_DAY_MS);
}

export function calendarDurationLabel(days: number | null) {
  if (!days || days <= 0) return "Duración pendiente";
  return days === 1 ? "1 día" : `${fmt(days)} días`;
}

export function prettyModelLabel(value: string) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\bcompleted\b/i, "Completa")
    .replace(/\bapproved\b/i, "Aprobada")
    .replace(/\brejected\b/i, "Rechazo")
    .replace(/\bpartial\b/i, "Parcial");
}

export function phonePercentLabel(value: number | null | undefined) {
  return formatPercentLabel(value);
}

export function phoneLooksLikeTechnicalSourceLabel(value: string) {
  const key = normalizeSourceMatch(value);
  if (!key) return false;
  return (
    key.includes("base de barrido")
    || key.includes("base barrido")
    || key.includes("barrido telefon")
    || key.includes("_base")
    || key.includes("_pdm")
    || key.includes("spreadsheet")
    || key.includes("google sheets")
    || key.includes("kobotoolbox")
    || key.includes("surveymonkey")
    || /^\d+[_-]/.test(key)
  );
}

export function phoneOpsPercent(value: number, total: number) {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

export function phoneAttemptCountLabel(value: number) {
  return value === 1 ? "1 intento" : `${formatMetric(value)} intentos`;
}

export function sourceProviderLabel(kind: MonitoreoSource["kind"]) {
  if (kind === "google_sheets") return "Google Sheets";
  if (kind === "surveymonkey") return "SurveyMonkey";
  if (kind === "kobo") return "KoboToolbox";
  return kind;
}

export function sourceActorLabel(source: MonitoreoSource) {
  return String(
    source.dimensions?.actor
    ?? source.dimensions?.carrera
    ?? source.dimensions?.segmento
    ?? source.dimensions?.unidad
    ?? "",
  ).trim() || "Sin actor";
}

export function mostRecentSyncLabel(sources: MonitoreoSource[]) {
  const stamps = sources
    .map((source) => source.last_sync_at)
    .filter((value): value is string => Boolean(value));
  if (!stamps.length) return "Sin sync";
  const sorted = stamps.sort((a, b) => {
    const left = new Date(a).getTime();
    const right = new Date(b).getTime();
    return (Number.isFinite(right) ? right : 0) - (Number.isFinite(left) ? left : 0);
  });
  return formatDate(sorted[0]);
}

export function dimensionLabel(key: string) {
  const labels: Record<string, string> = {
    actor: "Actor",
    carrera: "Carrera",
    canal: "Canal",
    channel: "Canal",
    segmento: "Segmento",
    servicio: "Servicio",
    territorio: "Territorio",
    sheet_name: "Pestaña",
    survey_title: "Encuesta",
  };
  return labels[key] ?? key.replaceAll("_", " ");
}

export function collectorNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function caseResponseDateTimeLabel(item: MonitoreoInternalQueryCase) {
  const rawDateTime = String(item.response_datetime || "").trim();
  if (rawDateTime) {
    const date = new Date(rawDateTime);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
    }
    return rawDateTime;
  }
  const rawDate = String(item.date || "").trim();
  if (!rawDate) return "Sin fecha";
  return formatInternalQueryDateLabel(rawDate);
}

export function caseResponseTimeDetailLabel(item: MonitoreoInternalQueryCase) {
  const rawDateTime = String(item.response_datetime || "").trim();
  if (!rawDateTime) return "Sin hora registrada";
  const date = new Date(rawDateTime);
  if (Number.isNaN(date.getTime())) return "Hora no normalizada";
  return date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

export function explicitBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (["true", "1", "si", "sí", "yes", "cuenta", "cuenta en avance"].includes(normalized)) return true;
  if (["false", "0", "no", "no cuenta", "no cuenta en avance"].includes(normalized)) return false;
  return null;
}

export function caseCountsInAdvance(item: MonitoreoInternalQueryCase): boolean | null {
  const explicit = explicitBoolean(item.counts_in_advance);
  if (explicit !== null) return explicit;
  const status = String(item.duplicate_counting_status ?? "").toLowerCase();
  if (status.includes("no cuenta")) return false;
  if (status.includes("cuenta")) return true;
  if (item.advancement === "effective") return true;
  if (["partial", "refusal", "pending", "excluded"].includes(item.advancement)) return false;
  return null;
}

export function caseCountsLabel(item: MonitoreoInternalQueryCase) {
  const counts = caseCountsInAdvance(item);
  if (counts === true) return "Cuenta";
  if (counts === false) return "No cuenta";
  return "Revisar";
}

export function caseDuplicateLabel(item: MonitoreoInternalQueryCase) {
  const duplicateCount = Number(item.duplicate_count ?? item.duplicate_group_size ?? 0);
  if (duplicateCount > 1) return item.duplicate_counting_status || `${fmt(duplicateCount)} respuestas`;
  return item.duplicate_counting_status || "Sin duplicado";
}

export function cleanCaseKeyText(value: unknown) {
  return String(value ?? "").trim();
}

export function advancementLabel(value: string) {
  if (value === "effective") return "Efectiva";
  if (value === "included_review") return "Incluida auditada";
  if (value === "partial") return "Parcial";
  if (value === "refusal") return "Rechazo";
  if (value === "pending") return "Sin respuesta";
  if (value === "excluded") return "Excluida";
  return value || "Revisión";
}

export function formatPercentLabel(value: number | null | undefined) {
  return pctDecimal(value);
}

export function formatSignedPp(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "S/D";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("es-PE", { maximumFractionDigits: 1 })} pp`;
}

export function normalizeReportMatch(value: unknown) {
  return normalizeSourceMatch(value);
}

export function reportNumberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/%/g, "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function reportPercentValue(value: unknown, column: string) {
  const normalized = normalizeReportMatch(column);
  if (!normalized.includes("avance") && !String(column).includes("%") && !normalized.includes("porcentaje") && !normalized.includes("del total") && !normalized.includes("ratio")) return null;
  if (value == null || value === "") return null;
  const parsed = reportNumberValue(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.abs(parsed) <= 10 ? parsed * 100 : parsed;
}

export function normalizeAcreditacionDailyDateLabel(value: unknown) {
  const text = String(value ?? "").trim();
  return isAcreditacionNoDateLabel(text) ? ACREDITACION_DAILY_NO_DATE_LABEL : text;
}

export function isTechnicalAcreditacionCollectorLabel(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return false;
  const key = normalizeSourceMatch(text);
  return /^\d{6,}$/.test(text)
    || /^[a-f0-9]{10,}$/i.test(text)
    || /^(collector|colector|web|link)[-_]?\d+$/i.test(text)
    || key === "web link"
    || key === "weblink";
}

export function compactMechanismLabel(label: string) {
  return String(label || "Fuente")
    .replace(/\s+/g, " ")
    .replace(/^respuestas?\s+/i, "")
    .replace(/^base\s+/i, "Base ")
    .trim();
}

export function shortColumnLabel(column: string) {
  return column.replace(/^% del /i, "% ").replace(/^Avance /i, "").slice(0, 18);
}

export function formatReportCell(value: unknown, column: string) {
  if (value == null || value === "") return "";
  if (typeof value === "number") {
    const normalized = normalizeReportMatch(column);
    if (normalized.includes("avance") || String(column).includes("%") || normalized.includes("ratio")) {
      const pctValue = Math.abs(value) <= 10 ? value * 100 : value;
      return pctDecimal(pctValue);
    }
    return Number.isInteger(value) ? fmt(value) : value.toLocaleString("es-PE", { maximumFractionDigits: 1 });
  }
  const text = String(value);
  if (normalizeReportMatch(column).includes("fecha")) return text;
  const normalized = normalizeReportMatch(text);
  if (normalized === "no barridos") return "Por barrer";
  if (normalized === "casos barridos") return "Barridos";
  return text;
}
