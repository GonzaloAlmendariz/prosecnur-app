import type { MonitoreoReportWeekday } from "../../../../../api/client";
import { formatDate, normalizeSourceMatch } from "../formato";

// Familia de helpers del ritmo diario (puntos por día, cortes de reporte y
// calendario del reporte al cliente), extraída del page-file congelado
// (AcreditacionMonitoreoPage.tsx) en la ola 2 del plan de performance (paso 4
// del mapa de extracción del plan de saneamiento). Copia por perfil
// deliberada: el gemelo mantiene la suya.

export type AcreditacionAdvanceDailyPoint = {
  date: string;
  effective: number;
  partial: number;
  refusals: number;
  total: number;
};

export type AcreditacionDailyReportCut = {
  date: string;
  label: string;
  isFallback?: boolean;
};

export type AcreditacionDailyChartRow = AcreditacionAdvanceDailyPoint & {
  x: number;
  axisLabel: string;
  displayLabel: string;
  dailyTotal: number;
  cumulative: number;
};

export const ACREDITACION_DAILY_NO_DATE_LABEL = "Sin fecha";

export const CALENDAR_DAY_MS = 24 * 60 * 60 * 1000;

export const CALENDAR_REPORT_WEEKDAYS: Array<{ value: MonitoreoReportWeekday; label: string; index: number }> = [
  { value: "lunes", label: "Lunes", index: 1 },
  { value: "martes", label: "Martes", index: 2 },
  { value: "miercoles", label: "Miércoles", index: 3 },
  { value: "jueves", label: "Jueves", index: 4 },
  { value: "viernes", label: "Viernes", index: 5 },
  { value: "sabado", label: "Sábado", index: 6 },
  { value: "domingo", label: "Domingo", index: 0 },
];

export const CALENDAR_REPORT_WEEKDAY_INDEX = new Map(CALENDAR_REPORT_WEEKDAYS.map((item) => [item.value, item.index]));

export const CALENDAR_REPORT_WEEKDAY_LABEL = new Map(CALENDAR_REPORT_WEEKDAYS.map((item) => [item.value, item.label]));

export function calendarIsoDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function normalizeCalendarReportWeekday(value: unknown): MonitoreoReportWeekday | "" {
  const normalized = normalizeSourceMatch(String(value ?? ""));
  const direct = CALENDAR_REPORT_WEEKDAYS.find((item) => item.value === normalized);
  if (direct) return direct.value;
  if (["miercoles", "miércoles", "wednesday", "wed"].includes(normalized)) return "miercoles";
  if (["sabado", "sábado", "saturday", "sat"].includes(normalized)) return "sabado";
  return "";
}

export function calendarReportWeekdayLabel(value: MonitoreoReportWeekday | "" | null | undefined) {
  const normalized = normalizeCalendarReportWeekday(value);
  return normalized ? CALENDAR_REPORT_WEEKDAY_LABEL.get(normalized) ?? normalized : "Sin reporte";
}

export function calendarReportWeekdayFromDate(value: string | null | undefined): MonitoreoReportWeekday | "" {
  const parsed = parseAcreditacionDailyDate(value);
  if (!parsed) return "";
  return CALENDAR_REPORT_WEEKDAYS.find((item) => item.index === parsed.getDay())?.value ?? "";
}

export function parseAcreditacionDailyDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const yearFirst = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (yearFirst) {
    const year = Number(yearFirst[1]);
    const month = Number(yearFirst[2]);
    const day = Number(yearFirst[3]);
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const rawYear = match[3] ? Number(match[3]) : new Date().getFullYear();
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const direct = new Date(text);
  return Number.isNaN(direct.getTime()) ? null : direct;
}

export function isAcreditacionNoDateLabel(value: unknown) {
  const key = normalizeSourceMatch(value).replace(/[^a-z0-9]+/g, " ");
  return !key || key === "sin fecha" || key === "s d" || key === "sd";
}

export function isDatedAcreditacionDailyPoint(point: AcreditacionAdvanceDailyPoint) {
  return !isAcreditacionNoDateLabel(point.date) && Boolean(parseAcreditacionDailyDate(point.date));
}

export function dateOnlyTime(value: Date | null) {
  if (!value) return null;
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function dailyPointTotals(points: AcreditacionAdvanceDailyPoint[]) {
  return points.reduce((acc, point) => ({
    effective: acc.effective + point.effective,
    partial: acc.partial + point.partial,
    refusals: acc.refusals + point.refusals,
    total: acc.total + point.total,
  }), { effective: 0, partial: 0, refusals: 0, total: 0 });
}

export function dailyPointTotalValue(point: AcreditacionAdvanceDailyPoint) {
  return point.total || point.effective + point.partial + point.refusals;
}

export function dailyEffectiveValue(point: AcreditacionAdvanceDailyPoint) {
  return point.effective || dailyPointTotalValue(point);
}

export function sortAcreditacionDailyPoints(points: AcreditacionAdvanceDailyPoint[]) {
  return [...points].sort((a, b) => {
    const aDate = parseAcreditacionDailyDate(a.date);
    const bDate = parseAcreditacionDailyDate(b.date);
    if (aDate && bDate) return aDate.getTime() - bDate.getTime();
    if (aDate) return -1;
    if (bDate) return 1;
    return a.date.localeCompare(b.date, "es", { numeric: true });
  });
}

export function mergeAcreditacionDailyPoints(points: AcreditacionAdvanceDailyPoint[]) {
  const byDate = new Map<string, AcreditacionAdvanceDailyPoint>();
  points.forEach((point) => {
    const parsed = parseAcreditacionDailyDate(point.date);
    const key = parsed ? calendarIsoDate(parsed) : point.date;
    const existing = byDate.get(key) ?? { date: key, effective: 0, partial: 0, refusals: 0, total: 0 };
    existing.effective += point.effective;
    existing.partial += point.partial;
    existing.refusals += point.refusals;
    existing.total += dailyPointTotalValue(point);
    byDate.set(key, existing);
  });
  return sortAcreditacionDailyPoints(Array.from(byDate.values()));
}

export function expandAcreditacionDailyCalendar(
  points: AcreditacionAdvanceDailyPoint[],
  reportCuts: AcreditacionDailyReportCut[] = [],
) {
  const merged = mergeAcreditacionDailyPoints(points);
  const dated = merged
    .map((point) => ({ point, time: dateOnlyTime(parseAcreditacionDailyDate(point.date)) }))
    .filter((item): item is { point: AcreditacionAdvanceDailyPoint; time: number } => item.time != null);
  if (dated.length < 2) return merged;
  const byTime = new Map(dated.map((item) => [item.time, item.point]));
  const first = dated[0].time;
  const lastData = dated.at(-1)?.time ?? first;
  const cutTimes = reportCuts
    .map((cut) => dateOnlyTime(parseAcreditacionDailyDate(cut.date)))
    .filter((time): time is number => time != null && time >= first && time <= lastData + CALENDAR_DAY_MS);
  const last = Math.max(lastData, ...cutTimes, first);
  const totalDays = Math.round((last - first) / CALENDAR_DAY_MS) + 1;
  if (totalDays <= 1 || totalDays > 180) return merged;
  const expanded: AcreditacionAdvanceDailyPoint[] = [];
  for (let index = 0; index < totalDays; index += 1) {
    const time = first + index * CALENDAR_DAY_MS;
    const existing = byTime.get(time);
    if (existing) {
      expanded.push(existing);
    } else {
      expanded.push({ date: calendarIsoDate(new Date(time)), effective: 0, partial: 0, refusals: 0, total: 0 });
    }
  }
  return expanded;
}

export function compactAdvanceDateTickLabel(value: string) {
  if (isAcreditacionNoDateLabel(value)) return "S/D";
  const parsed = parseAcreditacionDailyDate(value);
  if (!parsed) return shortAdvanceDateLabel(value);
  const month = parsed.toLocaleDateString("es-PE", { month: "short" }).replace(".", "").toLowerCase();
  return `${month}<br>${String(parsed.getDate()).padStart(2, "0")}`;
}

export function shortAdvanceDateLabel(value: string) {
  if (isAcreditacionNoDateLabel(value)) return ACREDITACION_DAILY_NO_DATE_LABEL;
  const parsed = parseAcreditacionDailyDate(value);
  if (parsed) {
    return parsed.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" });
  }
  const dayFirst = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dayFirst) return `${dayFirst[1].padStart(2, "0")}/${dayFirst[2].padStart(2, "0")}`;
  const yearFirst = value.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (yearFirst) return `${yearFirst[3].padStart(2, "0")}/${yearFirst[2].padStart(2, "0")}`;
  return value.length > 6 ? value.slice(5) : value;
}

export function paddedAdvanceAxisMax(value: number) {
  if (value <= 0) return undefined;
  if (value <= 8) return Math.ceil(value * 1.25);
  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 1);
  return Math.ceil((value * 1.16) / magnitude) * magnitude;
}

export function dailyCutsForChart(
  points: AcreditacionDailyChartRow[],
  reportCuts: AcreditacionDailyReportCut[] = [],
  fallbackCutDate?: string,
) {
  if (!points.length) return [];
  const dated = points
    .map((point) => ({ point, time: dateOnlyTime(parseAcreditacionDailyDate(point.date)) }))
    .filter((item): item is { point: AcreditacionDailyChartRow; time: number } => item.time != null);
  if (!dated.length) return [];
  const cuts = reportCuts.length
    ? reportCuts
    : fallbackCutDate
      ? [{ date: fallbackCutDate, label: "Corte disponible", isFallback: true }]
      : [];
  const seen = new Set<number>();
  return cuts.flatMap((cut) => {
    const cutTime = dateOnlyTime(parseAcreditacionDailyDate(cut.date));
    if (cutTime == null) return [];
    const match = dated.find((item) => item.time >= cutTime) ?? dated.at(-1);
    if (!match || seen.has(match.point.x)) return [];
    seen.add(match.point.x);
    return [{
      ...cut,
      x: match.point.x,
      point: match.point,
      label: cut.label || formatDate(cut.date || match.point.date || ""),
    }];
  });
}

export function weeklyCutsForChart(
  points: AcreditacionDailyChartRow[],
  reportWeekday: MonitoreoReportWeekday | "" | null | undefined,
) {
  const weekday = normalizeCalendarReportWeekday(reportWeekday);
  const weekdayIndex = weekday ? CALENDAR_REPORT_WEEKDAY_INDEX.get(weekday) : null;
  if (weekdayIndex == null) return [];
  const label = calendarReportWeekdayLabel(weekday);
  return points.flatMap((point) => {
    const parsed = parseAcreditacionDailyDate(point.date);
    if (!parsed || parsed.getDay() !== weekdayIndex) return [];
    return [{
      date: point.date,
      label,
      isFallback: false,
      x: point.x,
      point,
    }];
  });
}

export function sparseDailyChartRows<T extends { x: number }>(rows: T[], minGap: number, maxRows: number) {
  const out: T[] = [];
  rows.sort((a, b) => a.x - b.x).forEach((row) => {
    if (out.length >= maxRows) return;
    if (out.some((item) => Math.abs(item.x - row.x) < minGap)) return;
    out.push(row);
  });
  return out;
}

export function phoneStatusTone(label: string): "good" | "warn" | "risk" | "unswept" | "muted" {
  const key = normalizeSourceMatch(label);
  if (key.includes("por barrer") || key.includes("no barrido") || key.includes("pendiente")) return "unswept";
  if (key.includes("efectiv") || key.includes("complet") || key.includes("contactado")) return "good";
  if (key.includes("no contesta") || key.includes("insistencia") || key.includes("reintento")) return "warn";
  if (key.includes("rechazo") || key.includes("fall") || key.includes("observ")) return "risk";
  return "muted";
}

export function phoneStatusPalette(label: string) {
  const tone = phoneStatusTone(label);
  if (tone === "good") return { color: "#168a55", highlight: "#31c783" };
  if (tone === "warn") return { color: "#b97611", highlight: "#e0a329" };
  if (tone === "risk") return { color: "#a61d4f", highlight: "#d24c79" };
  if (tone === "unswept") return { color: "#94a3b8", highlight: "#d9e2ec" };
  return { color: "#5e7fa5", highlight: "#8fb1d3" };
}
