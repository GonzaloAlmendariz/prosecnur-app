// Helpers de formato y rótulos idénticos entre las páginas de Telefónico y
// Acreditación (L33 parte 2, lote 1). Se movieron sin cambiar una línea; las
// dos páginas los importan de aquí. Semántica de familia: no se fusiona nada más.
import { fmt, normalizeSourceMatch } from "../profiles/telefonico/formato";
import { type MonitoreoAcreditacionReports, type MonitoreoGoal, type MonitoreoInternalQueryCase, type MonitoreoLinkCollector, type MonitoreoReportBlock, type MonitoreoSource, type MonitoreoStrategyPhase, type MonitoreoSurveyMonkeyCollector, type MonitoreoVariable, type SurveyMonkeyMultibaseListItem } from "../../../api/client";
import { calendarDateDiffDays, collectorNumber, normalizeReportMatch, parseCalendarIsoDate, reportNumberValue } from "./rotulosComunes";
import { calendarAddDaysIso, reportBlockColumns, reportBlockForSheet } from "./tablasComunes";
import { internalCaseCrossingValue, internalCaseResponseStateValue } from "../internalQueries";
import { dailyPointTotals, type AcreditacionAdvanceDailyPoint } from "../profiles/telefonico/avance/ritmoDiario";
import { acreditacionSurveyStateTone } from "./casosComunes";
import { BarChart3, ClipboardCheck, FileCheck2, PhoneCall, ShieldAlert } from "lucide-react";

export function preferredPhoneEffectiveValue(choices: string[]) {
  return choices.find((choice) => ["yes", "si", "sí", "1", "true"].includes(normalizeSourceMatch(choice)))
    ?? choices.find((choice) => normalizeSourceMatch(choice).includes("consent"))
    ?? choices[0]
    ?? "";
}

export function splitListInput(value: string) {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function calendarPhaseDurationDays(phase: MonitoreoStrategyPhase) {
  const start = phase.start_date ?? "";
  const end = phase.end_date || start;
  if (!start || !end) return null;
  const diff = calendarDateDiffDays(start, end);
  return diff != null && diff >= 0 ? diff + 1 : null;
}

export function calendarPhaseWeekDurationDays(phase: MonitoreoStrategyPhase) {
  const startWeek = Number(phase.start_week);
  const endWeek = Number(phase.end_week ?? phase.start_week);
  if (!Number.isFinite(startWeek) || startWeek <= 0) return 1;
  if (!Number.isFinite(endWeek) || endWeek < startWeek) return 7;
  return Math.max(1, endWeek - startWeek + 1) * 7;
}

export function calendarPhaseOverlapCount(phase: MonitoreoStrategyPhase, index: number, phases: MonitoreoStrategyPhase[]) {
  const start = phase.start_date ?? "";
  const end = phase.end_date || start;
  if (!start || !end || calendarDateDiffDays(start, end) == null) return 0;
  return phases.reduce((count, candidate, candidateIndex) => {
    if (candidateIndex === index) return count;
    const candidateStart = candidate.start_date ?? "";
    const candidateEnd = candidate.end_date || candidateStart;
    if (!candidateStart || !candidateEnd) return count;
    const validCandidate = calendarDateDiffDays(candidateStart, candidateEnd);
    if (validCandidate == null || validCandidate < 0) return count;
    const overlaps = start <= candidateEnd && candidateStart <= end;
    return overlaps ? count + 1 : count;
  }, 0);
}

export function calendarBasePhase(phases: MonitoreoStrategyPhase[]) {
  return phases.find((phase) => parseCalendarIsoDate(phase.start_date));
}

export function distributeCalendarDatesByWeek(phases: MonitoreoStrategyPhase[]) {
  const basePhase = calendarBasePhase(phases);
  const baseDate = basePhase?.start_date ?? "";
  if (!basePhase || !baseDate) return null;
  const baseWeek = Number(basePhase.start_week) > 0 ? Number(basePhase.start_week) : 1;
  return phases.map((phase) => {
    const startWeek = Number(phase.start_week) > 0 ? Number(phase.start_week) : baseWeek;
    const endWeek = Number(phase.end_week ?? phase.start_week) >= startWeek ? Number(phase.end_week ?? phase.start_week) : startWeek;
    const startOffset = Math.max(0, startWeek - baseWeek) * 7;
    const durationDays = Math.max(1, endWeek - startWeek + 1) * 7;
    const startDate = calendarAddDaysIso(baseDate, startOffset);
    return {
      ...phase,
      start_date: startDate,
      end_date: startDate ? calendarAddDaysIso(startDate, durationDays - 1) : phase.end_date,
    };
  });
}

export function inferCalendarModality(channels: string[], sources: MonitoreoSource[]): MonitoreoStrategyPhase["modality"] {
  const text = [...channels, ...sources.map((source) => source.label), ...sources.map((source) => source.role)]
    .map(normalizeSourceMatch)
    .join(" ");
  const hits: MonitoreoStrategyPhase["modality"][] = [];
  if (text.includes("telefon") || text.includes("phone") || text.includes("call")) hits.push("telefono");
  if (text.includes("whatsapp") || text.includes("wa ")) hits.push("whatsapp");
  if (text.includes("sms")) hits.push("sms");
  if (text.includes("presencial") || text.includes("qr")) hits.push("presencial");
  if (text.includes("correo") || text.includes("email") || text.includes("mail") || text.includes("survey") || text.includes("web")) hits.push("email");
  const uniqueHits = Array.from(new Set(hits));
  if (uniqueHits.length > 1) return "mixto";
  return uniqueHits[0] ?? (channels.length > 1 ? "mixto" : "email");
}

export function calendarGoalActor(goal: MonitoreoGoal, preferredKey: string) {
  const filters = goal.filters ?? {};
  const preferred = preferredKey ? filters[preferredKey] : "";
  const fallback = Object.values(filters).find((value) => String(value ?? "").trim());
  return String(preferred || fallback || "").trim();
}

export function calendarGoalForActor(actor: string, goals: MonitoreoGoal[], preferredKey: string) {
  const actorKey = normalizeSourceMatch(actor);
  const goal = goals.find((item) => normalizeSourceMatch(calendarGoalActor(item, preferredKey)) === actorKey);
  const meta = goal ? Number(goal.meta) : NaN;
  return Number.isFinite(meta) && meta > 0 ? meta : null;
}

export function calendarTargetRule(actor: string, meta: number | null) {
  if (meta && meta > 0) return `Cubrir ${fmt(meta)} efectivas de ${actor}`;
  return `Cubrir meta y faltantes de ${actor}`;
}

export function splitCalendarTokens(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function phoneQuotaGoalValue(goal: MonitoreoGoal, variable: string) {
  return String(goal.filters?.[variable] ?? "").trim();
}

export function statusValueOptions(variables: MonitoreoVariable[], statusVar: string, current: string[]) {
  const variableValues = variables.find((variable) => variable.name === statusVar)?.values ?? [];
  return Array.from(new Set([
    ...current,
    ...variableValues,
    "completed",
    "complete",
    "valid",
    "approved",
    "submitted",
    "rechazo",
    "rejected",
    "partial",
  ].map((value) => String(value ?? "").trim()).filter(Boolean)));
}

export function phoneIsUnassignedResponsible(value: string) {
  const key = normalizeSourceMatch(value);
  return !key || key.includes("sin responsable") || key.includes("sin asignar") || key.includes("no asignad");
}

export function phoneQuotaStatusTone(status: string, gap: number | null) {
  const key = normalizeSourceMatch(status);
  if (key.includes("cumple") || key.includes("completa") || gap === 0) return "ready";
  if (key.includes("sin meta")) return "base";
  return "warning";
}

export function phoneDailyBlockForPanel(reports: MonitoreoAcreditacionReports): MonitoreoReportBlock | null {
  const phoneEffective = reportBlockForSheet(reports, "monitoreo_telefonico", "avance_efectivo_dia");
  if (phoneEffective?.rows.length) return phoneEffective;

  const summaryEffective = reportBlockForSheet(reports, "resumen", "avance_efectivo_dia");
  if (summaryEffective?.rows.length) {
    const columns = reportBlockColumns(summaryEffective);
    const dateColumns = columns.filter((column) => {
      const key = normalizeReportMatch(column);
      return key && !["unidad", "actor", "estado", "estatus", "total"].includes(key);
    });
    const rows = dateColumns.map((column) => ({
      Fecha: column,
      Efectivas: summaryEffective.rows.reduce((sum, row) => sum + reportNumberValue(row[column]), 0),
    })).filter((row) => row.Efectivas > 0);
    if (rows.length) {
      return {
        id: "avance_efectivo_dia",
        title: "Avance efectivo por día",
        columns: ["Fecha", "Efectivas"],
        rows,
        note: "Corte diario consolidado desde el avance efectivo.",
      };
    }
  }

  return reportBlockForSheet(reports, "monitoreo_telefonico", "produccion_dia");
}

export function uniqueDisplayValues(values: unknown[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const label = String(value ?? "").trim();
    const key = normalizeSourceMatch(label);
    if (!label || !key || key === "sin dato" || key === "sin actor" || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

export function isPlatformResponseSource(source: MonitoreoSource) {
  return (source.kind === "surveymonkey" || source.kind === "kobo")
    && (source.role === "respuestas" || !source.role || Boolean(source.survey_id) || Boolean(source.asset_uid));
}

export function isSurveyMonkeyResponseSource(source: MonitoreoSource) {
  return source.kind === "surveymonkey"
    && (source.role === "respuestas" || !source.role || Boolean(source.survey_id));
}

export function isKoboResponseSource(source: MonitoreoSource) {
  return source.kind === "kobo"
    && (source.role === "respuestas" || !source.role || Boolean(source.asset_uid));
}

export function shortenMiddle(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const edge = Math.max(6, Math.floor((maxLength - 3) / 2));
  return `${value.slice(0, edge)}...${value.slice(-edge)}`;
}

export function sourceFlatField(source: MonitoreoSource, key: string) {
  const value = (source as unknown as Record<string, unknown>)[key];
  return String(value ?? "").trim();
}

export function presetSourceStatus(sources: MonitoreoSource[]) {
  if (!sources.length) return "Pendiente";
  if (sources.some((source) => source.enabled)) return "Lista";
  return "Inactiva";
}

export function cleanSourceDimensions(dimensions: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(dimensions)
      .map(([key, value]) => [key, String(value ?? "").trim()] as const)
      .filter(([, value]) => value.length > 0),
  );
}

export function sourceDimensionEntries(dimensions: Record<string, string> | undefined) {
  return Object.entries(dimensions ?? {})
    .filter(([, value]) => String(value ?? "").trim())
    .slice(0, 8);
}

export function collectorDisplayName(item: MonitoreoSurveyMonkeyCollector | MonitoreoLinkCollector) {
  const raw = String(item.collector_name || item.collector_id || "Recopilador").trim();
  if (/^collector\s+/i.test(raw)) return raw.replace(/^collector/i, "Recopilador");
  if (/^colector\s+/i.test(raw)) return raw.replace(/^colector/i, "Recopilador");
  return raw;
}

export function countFromRecord(record: Record<string, number> | undefined, keys: string[]) {
  if (!record) return 0;
  return keys.reduce((sum, key) => sum + collectorNumber(record[key]), 0);
}

export function inferAcreditacionSurveyChannel(survey: SurveyMonkeyMultibaseListItem) {
  const text = normalizeSourceMatch(`${survey.title} ${survey.nickname ?? ""}`);
  const institutionalActor = text.includes("docent") || text.includes("administr");
  if (text.includes("correo") || text.includes("email") || text.includes("mail")) return "Correo";
  if (text.includes("telefon")) return "Telefónico";
  if (text.includes("presencial") || text.includes("qr")) return "Presencial (Ficha QR)";
  if (institutionalActor && !text.includes("whatsapp") && !text.includes("sms")) return "Correo";
  if (text.includes("whatsapp") || text.includes("sms") || text.includes("web") || text.includes("link") || text.includes("enlace")) return "Enlace personalizado (Whatsapp)";
  if (text.includes("egresad")) return "Telefónico";
  return "Correo";
}

export function surveyMonkeyDisplayTitle(survey: SurveyMonkeyMultibaseListItem) {
  return survey.nickname || survey.title || survey.id;
}

export function platformToneValue(item: MonitoreoInternalQueryCase): "effective" | "partial" | "refusal" | "warning" | "muted" {
  const response = internalCaseResponseStateValue(item);
  if (response === "complete") return "effective";
  if (response === "partial") return "partial";
  if (response === "refusal") return "refusal";
  if (response === "pending") return "muted";
  return "warning";
}

export function crossingToneValue(item: MonitoreoInternalQueryCase): "effective" | "partial" | "refusal" | "warning" | "muted" {
  const crossing = internalCaseCrossingValue(item);
  if (crossing === "cruzo_llave" || crossing === "cruzo_correo") return "effective";
  if (crossing === "sin_cruce" || crossing === "sin_llave") return "warning";
  return "muted";
}

export function acreditacionQueryDonutBackground(segments: Array<{ value: number; color: string }>) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  if (!total) return "conic-gradient(#dbe2ec 0deg 360deg)";
  let start = 0;
  const parts = segments
    .filter((segment) => segment.value > 0)
    .map((segment) => {
      const end = start + (segment.value / total) * 360;
      const part = `${segment.color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
      start = end;
      return part;
    });
  return `conic-gradient(${parts.join(", ")})`;
}

export function uniqueNormalizedKeys(values: unknown[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  values.forEach((value) => {
    const key = normalizeSourceMatch(value);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(key);
  });
  return out;
}

export function addAcreditacionDailyValue(
  points: Map<string, AcreditacionAdvanceDailyPoint>,
  date: string,
  tone: ReturnType<typeof acreditacionSurveyStateTone>,
  value: number,
) {
  if (!value) return;
  const point = points.get(date) ?? { date, effective: 0, partial: 0, refusals: 0, total: 0 };
  if (tone === "completed") point.effective += value;
  if (tone === "partial") point.partial += value;
  if (tone === "refusals") point.refusals += value;
  point.total += value;
  points.set(date, point);
}

export function dailySeriesTotals(points: AcreditacionAdvanceDailyPoint[]) {
  const totals = dailyPointTotals(points);
  return {
    completed: totals.effective,
    partial: totals.partial,
    refusals: totals.refusals,
    total: totals.total,
  };
}

export function collectorDisplayLookupKey(sourceKey: string, collectorKey: string) {
  return `${sourceKey}\r${collectorKey}`;
}

export function sourceRoleForActor(source: MonitoreoSource) {
  const role = normalizeSourceMatch(source.role);
  const label = normalizeSourceMatch(source.label);
  if (role.includes("universo") || role.includes("base")) return "Universo";
  if (role.includes("barrido") || label.includes("barrido") || label.includes("telefon")) return "Barrido";
  return "Respuestas";
}

export function surveySourceForAcreditacionId(sourceId: string, sources: MonitoreoSource[]) {
  const key = normalizeSourceMatch(sourceId);
  if (!key) return null;
  return sources.find((source) => normalizeSourceMatch(source.id) === key || normalizeSourceMatch(source.survey_id) === key) ?? null;
}

export function surveySourceForAcreditacionTitle(title: string, sources: MonitoreoSource[]) {
  const key = normalizeSourceMatch(title);
  if (!key) return null;
  return sources.find((source) => [
    source.label,
    source.survey_title,
    source.dimensions?.survey_title,
    source.survey_id,
  ].some((value) => normalizeSourceMatch(value) === key))
    ?? sources.find((source) => {
      const label = normalizeSourceMatch(source.survey_title || source.dimensions?.survey_title || source.label);
      return label && (label.includes(key) || key.includes(label));
    })
    ?? null;
}

export function sheetTitleIcon(id: string) {
  const key = normalizeReportMatch(id);
  if (key.includes("alert")) return <ShieldAlert size={14} />;
  if (key.includes("telefon")) return <PhoneCall size={14} />;
  if (key.includes("reporte")) return <FileCheck2 size={14} />;
  if (key.includes("encuesta")) return <BarChart3 size={14} />;
  return <ClipboardCheck size={14} />;
}
