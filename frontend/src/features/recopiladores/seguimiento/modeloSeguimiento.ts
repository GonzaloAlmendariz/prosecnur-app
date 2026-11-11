// Modelo puro de Correo > Seguimiento: cifras, pasos de la prueba de horarios,
// la grilla del plan y lo que dicen los resultados. Sin React.
//
// Cifras (CLAUDE.md, Redacción): conteo y porcentaje juntos, "421 (52.6 %)";
// con base, "4.20 % (784 de 18,648)". Decimal con punto y coma de millares
// (es-PE). Las tasas llegan del backend en 0 a 100.

import type {
  AvisoDelPlan,
  CampanaSeguimiento,
  EstadoSeguimiento,
  EtiquetasDeGrupo,
  FilaDeComparacion,
  FilaDelPlan,
  FilaDelPlanParaGuardar,
  Grupo,
  HorarioSeguimiento,
  ResultadoDeActualizacion,
  Veredicto,
} from "../../../api/mailSeguimiento";
import { SIN_CIFRA, formatoConteo } from "../../../lib/formatoNumero";

// ---- Cifras -------------------------------------------------------------------------

const UNO = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const DOS = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "52.6 %"; bajo 10 %, con dos decimales ("4.20 %"), como se leen las tasas de un recordatorio. */
export function formatoPct(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return SIN_CIFRA;
  return `${(Math.abs(pct) < 10 ? DOS : UNO).format(pct)} %`;
}

/** "4.20 % (784 de 18,648)": la tasa con su numerador y su base. */
export function tasaConBase(x: number, n: number, pct?: number | null): string {
  if (n <= 0) return SIN_CIFRA;
  return `${formatoPct(pct ?? (100 * x) / n)} (${formatoConteo(x)} de ${formatoConteo(n)})`;
}

/** "421 (52.6 %)": el conteo y su porcentaje sobre `n`. */
export function conteoConPct(x: number, n: number): string {
  if (n <= 0) return formatoConteo(x);
  return `${formatoConteo(x)} (${formatoPct((100 * x) / n)})`;
}

/** Diferencia en puntos: "+3.10 pp"; con signo siempre, para leer quién va arriba. */
export function formatoPuntos(pp: number | null | undefined): string {
  if (pp == null || !Number.isFinite(pp)) return SIN_CIFRA;
  const signo = pp > 0 ? "+" : pp < 0 ? "−" : "";
  return `${signo}${(Math.abs(pp) < 10 ? DOS : UNO).format(Math.abs(pp))} pp`;
}

/** "+3.10 pp (IC 95 %: +0.80 a +5.40)". */
export function diferenciaConIntervalo(f: Pick<FilaDeComparacion, "dif_pp" | "dif_li" | "dif_ls">): string {
  if (f.dif_pp == null) return SIN_CIFRA;
  if (f.dif_li == null || f.dif_ls == null) return formatoPuntos(f.dif_pp);
  return `${formatoPuntos(f.dif_pp)} (IC 95 %: ${formatoPuntos(f.dif_li).replace(" pp", "")} a ${formatoPuntos(f.dif_ls)})`;
}

/** El veredicto de una fila; cada brazo se nombra con su artículo ("el grupo A (8:00 p. m.)", "el control"). */
export function textoDeVeredicto(v: Veredicto, nombreA: string, nombreB: string, pocosCasos = false): string {
  const tendencia = pocosCasos ? " (pocos casos)" : "";
  if (v === "A") return `Gana ${nombreA}${tendencia}`;
  if (v === "B") return `Gana ${nombreB}${tendencia}`;
  if (v === "empate") return "Sin diferencia clara";
  return "Sin datos";
}

const n = (v: number) => formatoConteo(v);
const plural = (v: number, a: string, b: string) => (v === 1 ? a : b);

// ---- Fechas ---------------------------------------------------------------------------

const FECHA_HORA = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
});

/** "11/11/2026 15:30" (hora del equipo); vacío si no se puede leer. */
export function fechaHoraLegible(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? iso : FECHA_HORA.format(t);
}

/** Hora real de salida para la celda del plan: sólo la hora si salió el día programado ("10:25"). */
export function salioCorto(enviadoIso: string, programado: string): string {
  const completo = fechaHoraLegible(enviadoIso);
  const t = new Date(enviadoIso);
  if (Number.isNaN(t.getTime()) || !programado) return completo;
  const dia = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  return programado.startsWith(dia) ? completo.split(/,?\s+/).slice(-1)[0] : completo;
}

/** Semilla por defecto: la fecha de hoy, 20261111. */
export function semillaDeHoy(hoy: Date = new Date()): number {
  return hoy.getFullYear() * 10000 + (hoy.getMonth() + 1) * 100 + hoy.getDate();
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const PROGRAMADO = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

export const esHora = (v: string) => HORA.test(v.trim());
export const esFecha = (v: string) => FECHA.test(v.trim());
export const esProgramado = (v: string) => PROGRAMADO.test(v.trim());

/** Un `datetime-local` puede traer segundos ("2026-11-11T20:00:00"): el backend quiere minutos. */
export function aProgramado(valor: string): string {
  const v = valor.trim();
  if (!v) return "";
  const corto = v.slice(0, 16);
  return PROGRAMADO.test(corto) ? corto : "";
}

// ---- Quién respondió ------------------------------------------------------------------

/** Por qué una campaña no entra a "Actualizar todas"; vacío si está lista. */
export function faltaEnCampana(c: Pick<CampanaSeguimiento, "contactos" | "con_enlace" | "encuesta">): string {
  if (!c.contactos) return "Sin contactos";
  if (c.con_enlace <= 0) return "Sin enlaces personales";
  if (!c.encuesta) return "Falta la encuesta";
  return "";
}

export function campanasListas(campanas: readonly CampanaSeguimiento[]): number {
  return campanas.filter((c) => !faltaEnCampana(c)).length;
}

/** Qué falta para "Actualizar todas las campañas"; vacío si se puede. */
export function faltaParaActualizar(estado: EstadoSeguimiento | null, mailchimpListo: boolean, surveymonkeyListo: boolean): string {
  if (!estado) return "Cargando la configuración.";
  if (!mailchimpListo) return "Falta conectar Mailchimp.";
  if (!surveymonkeyListo) return "Falta conectar SurveyMonkey.";
  if (!estado.config.list_id) return "Elige la audiencia de Mailchimp.";
  if (!estado.campanas.length) return "El estudio no tiene campañas de Mailchimp.";
  if (!campanasListas(estado.campanas)) return "Ninguna campaña está lista: elige su encuesta y genera los enlaces en Contactos.";
  return "";
}

export type ResumenDeActualizacion = {
  titulo: string;
  porCampana: { campaign_id: string; publico: string; texto: string; error: boolean }[];
};

/** El resultado de "Actualizar todas las campañas", una línea por campaña (incluidas las saltadas). */
export function resumenDeActualizacion(
  r: ResultadoDeActualizacion,
  publicos: Readonly<Record<string, string>>,
): ResumenDeActualizacion {
  const t = r.totales;
  const partes = [`${n(t.respondieron)} ${plural(t.respondieron, "persona respondió", "personas respondieron")}`];
  if (t.archivados) partes.push(`${n(t.archivados)} ${plural(t.archivados, "correo archivado", "correos archivados")}`);
  if (t.a_medias) partes.push(`${n(t.a_medias)} a medias`);
  const porCampana = r.campanas.map((c) => {
    const publico = publicos[c.campaign_id] ?? c.campaign_id;
    if (!c.ok || c.error) return { campaign_id: c.campaign_id, publico, texto: c.error || "No se pudo actualizar.", error: true };
    const p = [`${n(c.respondents)} ${plural(c.respondents, "respondió", "respondieron")}`];
    if (c.archived + c.archived_second) {
      p.push(`${n(c.archived + c.archived_second)} ${plural(c.archived + c.archived_second, "correo archivado", "correos archivados")}`);
    }
    if (c.partial_people) p.push(`${n(c.partial_people)} a medias`);
    if (c.inactive) p.push(`${n(c.inactive)} ${plural(c.inactive, "inactiva", "inactivas")} en la audiencia`);
    return { campaign_id: c.campaign_id, publico, texto: `${p.join(", ")}.`, error: false };
  });
  const saltadas = r.saltadas.map((s) => ({
    campaign_id: s.campaign_id,
    publico: s.publico || publicos[s.campaign_id] || s.campaign_id,
    texto: `No se actualizó: ${s.motivo || "no está lista"}.`,
    error: true,
  }));
  return { titulo: `${partes.join(", ")}.`, porCampana: [...porCampana, ...saltadas] };
}

// ---- Prueba de horarios: pasos ------------------------------------------------------------

export type IdDePaso = "publicos" | "sorteo" | "etiquetas" | "plan" | "borradores" | "resultados";
export type EstadoDePaso = "hecho" | "sigue" | "pendiente";
export type PasoDeLaPrueba = { id: IdDePaso; numero: number; titulo: string; estado: EstadoDePaso };

const TITULOS: Record<IdDePaso, string> = {
  publicos: "Públicos y horario de oficina",
  sorteo: "Asignación al azar de los grupos",
  etiquetas: "Etiquetas en Mailchimp",
  plan: "Plan de recordatorios",
  borradores: "Borradores por grupo",
  resultados: "Resultados",
};

/** Las filas con hora del plan (las que necesitan su borrador). */
const conHora = (plan: readonly FilaDelPlan[]) => plan.filter((f) => f.programado);

/** ¿El plan tiene la hora de los dos grupos para cada recordatorio de cada público? */
export function planCompleto(h: HorarioSeguimiento): boolean {
  if (!h.campanas.length || !h.rondas.length) return false;
  return h.rondas.every((r) => h.campanas.every((id) => (["A", "B"] as const).every((g) => (
    h.plan.some((f) => f.ronda === r.ronda && f.campaign_id === id && f.grupo === g && f.programado)
  ))));
}

export function pasosDeLaPrueba(h: HorarioSeguimiento): PasoDeLaPrueba[] {
  const hecho: Record<IdDePaso, boolean> = {
    publicos: h.campanas.length > 0,
    sorteo: Boolean(h.sorteado_en),
    etiquetas: Boolean(h.etiquetado_en),
    plan: planCompleto(h),
    borradores: conHora(h.plan).length > 0 && conHora(h.plan).every((f) => f.mailchimp_id),
    resultados: h.plan.some((f) => f.enviado),
  };
  const ids = Object.keys(TITULOS) as IdDePaso[];
  const siguiente = ids.find((id) => !hecho[id]);
  return ids.map((id, i) => ({
    id,
    numero: i + 1,
    titulo: TITULOS[id],
    estado: hecho[id] ? "hecho" : id === siguiente ? "sigue" : "pendiente",
  }));
}

export const ROTULO_DE_ESTADO: Record<EstadoDePaso, string> = { hecho: "Hecho", sigue: "Sigue", pendiente: "Pendiente" };

// ---- Prueba de horarios: plan ------------------------------------------------------------

export type CeldaDelPlan = { grupo: Grupo; fila: FilaDelPlan | null };
export type FilaDeLaGrilla = { campaign_id: string; publico: string; oficina: boolean; A: CeldaDelPlan; B: CeldaDelPlan };
export type RondaDeLaGrilla = { ronda: number; etiqueta: string; filas: FilaDeLaGrilla[]; avisos: AvisoDelPlan[] };

/** La grilla recordatorio por público por grupo, con los avisos del backend de cada recordatorio. */
export function grillaDelPlan(h: HorarioSeguimiento, publicos: Readonly<Record<string, string>>): RondaDeLaGrilla[] {
  const rondas = h.rondas.length
    ? h.rondas
    : [...new Set(h.plan.map((f) => f.ronda))].sort((a, b) => a - b).map((ronda) => ({ ronda, etiqueta: `Recordatorio ${ronda}` }));
  const celda = (ronda: number, id: string, grupo: Grupo): CeldaDelPlan => ({
    grupo,
    fila: h.plan.find((f) => f.ronda === ronda && f.campaign_id === id && f.grupo === grupo) ?? null,
  });
  return rondas.map((r) => ({
    ronda: r.ronda,
    etiqueta: r.etiqueta,
    filas: h.campanas.map((id) => ({
      campaign_id: id,
      publico: publicos[id] ?? id,
      oficina: h.oficina.includes(id),
      A: celda(r.ronda, id, "A"),
      B: celda(r.ronda, id, "B"),
    })),
    avisos: h.avisos.filter((a) => a.ronda === r.ronda),
  }));
}

/** El plan con la hora de una celda cambiada (o agregada), listo para `PUT /horario/plan`. */
export function planConHora(
  plan: readonly FilaDelPlan[],
  cambio: { ronda: number; campaign_id: string; grupo: Grupo; programado: string },
): FilaDelPlanParaGuardar[] {
  const clave = (f: Pick<FilaDelPlan, "ronda" | "campaign_id" | "grupo">) => `${f.ronda}|${f.campaign_id}|${f.grupo}`;
  const buscada = clave(cambio);
  const filas: FilaDelPlanParaGuardar[] = plan.map((f) => ({
    ronda: f.ronda,
    campaign_id: f.campaign_id,
    grupo: f.grupo,
    programado: clave(f) === buscada ? cambio.programado : f.programado,
    mailchimp_id: f.mailchimp_id,
  }));
  if (!plan.some((f) => clave(f) === buscada)) filas.push({ ...cambio, mailchimp_id: "" });
  return filas;
}

/** Fechas por recordatorio para proponer el plan: las que ya tiene el plan o, si no, vacías. */
export function fechasDelPlan(h: HorarioSeguimiento): Record<number, string> {
  const out: Record<number, string> = {};
  for (const r of h.rondas) {
    const f = h.plan.find((x) => x.ronda === r.ronda && x.programado);
    out[r.ronda] = f ? f.programado.slice(0, 10) : "";
  }
  return out;
}

export function resumenDeEtiquetas(r: EtiquetasDeGrupo): string[] {
  return (["A", "B"] as const).map((g) => {
    const x = r[g];
    const inactivos = x.inactivos ? ` (${n(x.inactivos)} ${plural(x.inactivos, "inactiva", "inactivas")}, sin etiqueta)` : "";
    return `Grupo ${g}: ${n(x.etiquetados)} ${plural(x.etiquetados, "contacto", "contactos")} con "${x.etiqueta}"${inactivos}.`;
  });
}

/** Horas desde el envío que ofrece el selector de resultados. */
export const HORIZONTES = [6, 12, 24, 48, 72] as const;
