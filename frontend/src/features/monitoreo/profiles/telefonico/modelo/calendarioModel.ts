/**
 * Modelo › Cuotas y calendario › Calendario del telefónico: el cronograma de
 * campo que se guarda (una fase, `strategy_phases`) y lo que el corte dice de
 * los días de campo.
 *
 * El borrador y su escritura salieron del page-file sin cambiar lo que se
 * guarda. Los días leen la serie diaria compartida (`serieDiariaDelCorte`,
 * la misma de Ritmo, el calendario de Cuotas y la vista del PDF) y los
 * llamados de la hoja (`serieHoja`): la vista anterior leía otro bloque y
 * daba otro total de efectivas, y una fecha del año 2020 aparecía como un
 * segundo «30 junio».
 */

import type {
  MonitoreoAcreditacionReports,
  MonitoreoReportWeekday,
  MonitoreoStateRule,
  MonitoreoStrategyPhase,
} from "../../../../../api/client";
import { normalizeCalendarReportWeekday } from "../avance/ritmoDiario";
import { fechaCorta, resumenDeRitmo, serieDiariaDelCorte, serieHoja } from "../avance/ritmoModel";

export type AcreditacionFieldScheduleDraft = {
  startWeek: number;
  durationWeeks: number;
  startDate: string;
  endDate: string;
  reportWeekday: MonitoreoReportWeekday | "";
};

const ACREDITACION_FIELD_PHASE_ID = "acreditacion-campo";

export function positiveInteger(value: unknown, fallback: number) {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function acreditacionPrimarySchedulePhase(phases: MonitoreoStrategyPhase[]) {
  return phases.find((phase) => phase.id === ACREDITACION_FIELD_PHASE_ID) ?? phases[0] ?? null;
}

export function calendarWeekRangeLabel(startWeek: number | null | undefined, endWeek: number | null | undefined) {
  const start = Number(startWeek);
  const end = Number(endWeek ?? startWeek);
  const fmt = (n: number) => n.toLocaleString("es-PE");
  if (!Number.isFinite(start) || start <= 0) return "Sin semana";
  if (!Number.isFinite(end) || end <= 0 || end === start) return `Semana ${fmt(start)}`;
  return `Semanas ${fmt(start)}-${fmt(end)}`;
}

export function acreditacionScheduleDraftFromPhases(phases: MonitoreoStrategyPhase[]): AcreditacionFieldScheduleDraft {
  const phase = acreditacionPrimarySchedulePhase(phases);
  const startWeek = positiveInteger(phase?.start_week, 1);
  const endWeek = Math.max(startWeek, positiveInteger(phase?.end_week ?? phase?.start_week, startWeek));
  return {
    startWeek,
    durationWeeks: Math.max(1, endWeek - startWeek + 1),
    startDate: phase?.start_date ?? "",
    endDate: phase?.end_date ?? "",
    reportWeekday: normalizeCalendarReportWeekday(phase?.client_report_weekday),
  };
}

export function upsertAcreditacionFieldSchedulePhase(
  phases: MonitoreoStrategyPhase[],
  draft: AcreditacionFieldScheduleDraft,
) {
  const existingIndex = phases.findIndex((phase) => phase.id === ACREDITACION_FIELD_PHASE_ID);
  const targetIndex = existingIndex >= 0 ? existingIndex : phases.length ? 0 : -1;
  const existing = targetIndex >= 0 ? phases[targetIndex] : null;
  const startWeek = positiveInteger(draft.startWeek, 1);
  const durationWeeks = positiveInteger(draft.durationWeeks, 1);
  const nextPhase: MonitoreoStrategyPhase = {
    id: existing?.id || ACREDITACION_FIELD_PHASE_ID,
    stratum: existing?.stratum || "Acreditación",
    modality: existing?.modality || "mixto",
    start_week: startWeek,
    end_week: startWeek + durationWeeks - 1,
    start_date: draft.startDate,
    end_date: draft.endDate,
    client_report_weekday: normalizeCalendarReportWeekday(draft.reportWeekday),
    client_report_exceptions: existing?.client_report_exceptions ?? [],
    target_rule: existing?.target_rule || "Cumplir metas por actor en campo",
    kpi_focus: existing?.kpi_focus?.length ? existing.kpi_focus : ["meta actor", "avance efectivo", "faltantes"],
    kpi_modules: existing?.kpi_modules ?? ["progress"],
    breakdown_vars: existing?.breakdown_vars ?? [],
    attempts_var: existing?.attempts_var ?? "",
    outcome_var: existing?.outcome_var ?? "",
  };
  if (targetIndex < 0) return [nextPhase];
  return phases.map((phase, index) => index === targetIndex ? nextPhase : phase);
}

/** Lo que el cronograma dice, en palabras, para la lectura de la tarjeta. */
export function lecturaDelCronograma(draft: AcreditacionFieldScheduleDraft) {
  const ventana = calendarWeekRangeLabel(draft.startWeek, draft.startWeek + draft.durationWeeks - 1);
  const fechas = draft.startDate && draft.endDate
    ? `${fechaLegible(draft.startDate)} a ${fechaLegible(draft.endDate)}`
    : draft.startDate || draft.endDate
      ? [draft.startDate ? fechaLegible(draft.startDate) : "inicio sin fecha", draft.endDate ? fechaLegible(draft.endDate) : "fin sin fecha"].join(" a ")
      : null;
  return {
    ventana,
    duracion: `${draft.durationWeeks.toLocaleString("es-PE")} ${draft.durationWeeks === 1 ? "semana" : "semanas"}`,
    fechas,
  };
}

function fechaLegible(iso: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : iso;
}

export type DiaDeCampo = {
  fecha: string;
  etiqueta: string;
  kobo: number;
  acumulado: number;
  llamados: number;
};

/**
 * Los días de campo del corte: efectivas de Kobo (serie compartida), su
 * acumulado y los llamados que la hoja registra ese día. Un día entra si tiene
 * efectivas o llamados.
 */
export function diasDeCampo(
  reports: MonitoreoAcreditacionReports | null | undefined,
  reglas: readonly MonitoreoStateRule[],
) {
  const { serie, sinFecha } = serieDiariaDelCorte(reports);
  const hoja = serieHoja(reports, reglas);
  const fechas = [...new Set([...serie.fechas, ...Object.keys(hoja.totalPorFecha)])].sort();
  let acumulado = 0;
  const dias: DiaDeCampo[] = fechas.map((fecha) => {
    const kobo = serie.porFecha[fecha] ?? 0;
    acumulado += kobo;
    return { fecha, etiqueta: fechaCorta(fecha), kobo, acumulado, llamados: hoja.totalPorFecha[fecha] ?? 0 };
  });
  const resumen = resumenDeRitmo(serie, null);
  const conEfectivas = dias.filter((dia) => dia.kobo > 0);
  return {
    dias,
    total: serie.total,
    sinFecha,
    promedio: resumen.promedio,
    pico: resumen.pico ? { etiqueta: fechaCorta(resumen.pico.fecha), casos: resumen.pico.casos } : null,
    desde: conEfectivas[0]?.etiqueta ?? null,
    hasta: conEfectivas.at(-1)?.etiqueta ?? null,
    diasConEfectivas: conEfectivas.length,
    maximo: Math.max(1, ...dias.map((dia) => dia.kobo)),
    hojaHasta: hoja.ultima ? fechaCorta(hoja.ultima) : null,
  };
}
