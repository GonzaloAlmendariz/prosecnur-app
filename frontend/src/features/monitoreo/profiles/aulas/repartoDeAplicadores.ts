/**
 * El reparto vigente de aplicadores, listo para la pestaña de Asignación.
 *
 * Dictado (2026-09-02): «necesitaríamos una pestaña de asignación… para poder
 * hacer una asignación equitativa en base a lo que ya tenemos de momento, pero
 * que sea repetible por si llegan nuevas confirmaciones». La repetibilidad ya
 * la garantiza el motor (`monitoreo_aulas_reparto`, B29): puro y determinista,
 * recomputado en cada conversar del dashboard — cada Recargar trae el reparto
 * del estado nuevo, sin memoria entre corridas.
 *
 * Por eso aquí NO se reordena ni se recalcula nada: el greedy por fecha+hora,
 * el desempate alfabético y la equidad con ceros son pines del motor, y un
 * segundo dueño de cualquiera divergiría en la primera regla nueva. Este
 * módulo solo normaliza la frontera jsonlite y suma los totales que la vista
 * rotula.
 *
 * `null` (bloque ausente) ≠ reparto vacío: sin la clave de disponibilidad en
 * sesión el dashboard no publica el bloque, y la vista dice «falta cargarla»;
 * con la clave y cero agendadas llega `{dias: [], equidad: […0]}` y la vista
 * dice «nada que repartir todavía». Confundirlos es el vacío sin clasificar
 * que el contrato de superficie (C5) existe para impedir.
 */
import type { MonitoreoAulasReparto } from "../../../../api/monitoreo";
import { etiquetaDeFecha } from "./agendaPorDia";

const uno = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);

const texto = (v: unknown): string => {
  const crudo = uno(v);
  return typeof crudo === "string" ? crudo.trim() : "";
};

const num = (v: unknown): number | null => {
  const crudo = uno(v);
  if (crudo === null || crudo === undefined || crudo === "") return null;
  const n = typeof crudo === "number" ? crudo : Number(crudo);
  return Number.isFinite(n) ? n : null;
};

/** Códigos que pueden llegar como lista o como escalar suelto (jsonlite). */
const leerCodigos = (v: unknown): string[] => {
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  if (!Array.isArray(v)) return [];
  return v.map((c) => texto(c)).filter(Boolean);
};

export type AsignacionDeCita = {
  codigo: string;
  aplicador: string;
  inicio: string;
  fin: string;
  /** B36: la puso el usuario (fijación), no el greedy. */
  fijada: boolean;
  /** Lo que la oferta no respalda, declarado por el motor; "" si nada. */
  advertencia: "" | "sin_disponibilidad" | "se_solapa";
};

export type DiaDeReparto = {
  fecha: string;
  /** «Viernes 11/09», la etiqueta de la casa. */
  etiqueta: string;
  /** En el orden del motor: greedy por hora ascendente. */
  asignaciones: AsignacionDeCita[];
  /** Citas pactadas sin candidato libre — el problema operativo del día. */
  noCubiertos: string[];
  /** Fechas sin hora pactada: no piden gente todavía (vocabulario B11). */
  porConfirmar: string[];
};

export type CargaDeAplicador = { aplicador: string; asignadas: number };

export type RepartoVista = {
  dias: DiaDeReparto[];
  /** Alfabético DEL MOTOR, ceros incluidos: quien está libre también cuenta. */
  equidad: CargaDeAplicador[];
  /** Citas con aplicador asignado, sumadas sobre todos los días. */
  citas: number;
  /** Citas pactadas que nadie cubre. */
  sinCubrir: number;
  porConfirmar: number;
  /** Aplicadores del resumen con al menos una cita. */
  conCarga: number;
  /** El tope del rail de cargas; 0 solo cuando no hay equidad que pintar. */
  cargaMax: number;
  /** Días sin fecha o asignaciones sin sus señas: declarados, no tragados. */
  ilegibles: number;
  /** B36: códigos fijados por el usuario cuya cita ya no está pactada. */
  fijadasSinCita: string[];
};

export function repartoDeAplicadores(
  crudo: MonitoreoAulasReparto | null | undefined,
): RepartoVista | null {
  if (crudo === null || crudo === undefined) return null;
  const raiz = crudo as unknown as Record<string, unknown>;

  let ilegibles = 0;
  const dias: DiaDeReparto[] = [];
  for (const diaCrudo of Array.isArray(raiz.dias) ? raiz.dias : []) {
    const d = (diaCrudo ?? {}) as Record<string, unknown>;
    const fecha = texto(d.fecha);
    if (!fecha) {
      ilegibles += 1;
      continue;
    }
    const asignaciones: AsignacionDeCita[] = [];
    for (const aCruda of Array.isArray(d.asignaciones) ? d.asignaciones : []) {
      const a = (aCruda ?? {}) as Record<string, unknown>;
      const codigo = texto(a.codigo);
      const aplicador = texto(a.aplicador);
      if (!codigo || !aplicador) {
        ilegibles += 1;
        continue;
      }
      const avisoCrudo = texto(a.advertencia);
      asignaciones.push({
        codigo,
        aplicador,
        inicio: texto(a.inicio),
        fin: texto(a.fin),
        fijada: uno(a.fijada) === true,
        // Lista cerrada del motor; un valor desconocido no se inventa lectura.
        advertencia:
          avisoCrudo === "sin_disponibilidad" || avisoCrudo === "se_solapa" ? avisoCrudo : "",
      });
    }
    dias.push({
      fecha,
      etiqueta: etiquetaDeFecha(fecha),
      asignaciones,
      noCubiertos: leerCodigos(d.no_cubiertos),
      porConfirmar: leerCodigos(d.por_confirmar),
    });
  }

  const equidad: CargaDeAplicador[] = [];
  for (const eCruda of Array.isArray(raiz.equidad) ? raiz.equidad : []) {
    const e = (eCruda ?? {}) as Record<string, unknown>;
    const aplicador = texto(e.aplicador);
    if (!aplicador) continue;
    equidad.push({ aplicador, asignadas: num(e.asignadas) ?? 0 });
  }

  return {
    dias,
    equidad,
    citas: dias.reduce((n, d) => n + d.asignaciones.length, 0),
    sinCubrir: dias.reduce((n, d) => n + d.noCubiertos.length, 0),
    porConfirmar: dias.reduce((n, d) => n + d.porConfirmar.length, 0),
    conCarga: equidad.filter((e) => e.asignadas > 0).length,
    cargaMax: equidad.reduce((m, e) => Math.max(m, e.asignadas), 0),
    ilegibles,
    fijadasSinCita: leerCodigos(raiz.fijadas_sin_cita),
  };
}
