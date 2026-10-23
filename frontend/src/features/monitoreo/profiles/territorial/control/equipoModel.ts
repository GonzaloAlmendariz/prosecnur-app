import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { territorialDurationOperationalStatusFromValues } from "../../../territorialDuration";
import { diaYMes, nombreDeDistrito, numeroDeUmp, pctEntero, rotuloDeAplicador } from "../rotulos";

/**
 * Control › Equipo (territorial.md §3.8): una fila por código de aplicador.
 * Estado, recibidas, cuentan, UMP y distritos salen de
 * `production_annulments$responsibles`; las señales (GPS observado, menos de 5
 * min, cuentan por día) de `response_audit` por `pulso_code`, y lo que está en
 * bandeja de `internal_queries$review_cases`. Cada fuente puede faltar según
 * el corte: lo que falta queda `null`, no cero.
 */

export type SenalDeCodigo = { tipo: string; rotulo: string; casos: number };

export type FilaDeEquipo = {
  clave: string;
  codigo: string;
  aplicador: string;
  anulado: boolean;
  recibidas: number;
  cuentan: number;
  umps: number;
  distritos: string[];
  gpsObservado: { casos: number; base: number; texto: string } | null;
  cortas: number | null;
  /** Cuentan por día, sobre el eje común `dias`. */
  porDia: number[] | null;
  ultimo: string;
  enBandeja: number | null;
  senales: SenalDeCodigo[];
  umpsConSenal: Array<{ ump: string; casos: number }>;
};

export type ModeloEquipo = {
  filas: FilaDeEquipo[];
  dias: string[];
  conAuditoria: boolean;
  conBandeja: boolean;
};

const ROTULO_DE_SENAL: Record<string, string> = {
  gps: "GPS fuera de su manzana",
  duration: "Duración corta",
  ump: "UMP sin cruce",
  record: "Registro por revisar",
};

function n(valor: unknown): number {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function codigoDe(valor: unknown): string {
  return String(valor ?? "").trim().toUpperCase();
}

export function construirEquipo(
  consultas: MonitoreoTerritorialDashboard | null | undefined,
  validacion: MonitoreoTerritorialDashboard | null | undefined,
): ModeloEquipo {
  const responsables = consultas?.production_annulments?.responsibles ?? validacion?.production_annulments?.responsibles ?? [];
  const auditoria = Array.isArray(validacion?.response_audit) ? validacion.response_audit : [];
  const casos = consultas?.internal_queries?.review_cases ?? [];
  const conAuditoria = auditoria.length > 0;
  const conBandeja = Array.isArray(consultas?.internal_queries?.review_cases);
  const dias = [...new Set(auditoria.map((fila) => String(fila.submission_date_iso ?? "")).filter(Boolean))].sort();

  const filas: FilaDeEquipo[] = responsables.map((responsable) => {
    const codigo = codigoDe(responsable.pulso_code) || codigoDe(String(responsable.label).split("·")[0]);
    const propias = auditoria.filter((fila) => codigoDe(fila.pulso_code) === codigo);
    const conGps = propias.filter((fila) => fila.geo_estado !== "geo_sin_gps" && fila.geo_estado !== "geo_sin_cruce");
    const observado = conGps.filter((fila) => fila.geo_estado === "geo_revision" || fila.geo_estado === "geo_no_defendible").length;
    const cortas = propias.filter((fila) => {
      const segundos = Number(fila.duration_seconds);
      return territorialDurationOperationalStatusFromValues({
        seconds: Number.isFinite(segundos) && segundos > 0 ? segundos : null,
        durationStatus: fila.duration_status,
        durationOperationalStatus: fila.duration_operational_status,
      }) !== "normal";
    }).length;
    const porDia = dias.map((dia) => propias.filter((fila) => fila.submission_date_iso === dia && fila.advance_valid !== false).length);
    const enBandeja = casos.filter((caso) => codigoDe(caso.pulso_code) === codigo);
    const porTipo = new Map<string, number>();
    const porUmp = new Map<string, number>();
    for (const caso of enBandeja) {
      porTipo.set(caso.type, (porTipo.get(caso.type) ?? 0) + 1);
      const ump = numeroDeUmp(caso.ump);
      if (ump) porUmp.set(ump, (porUmp.get(ump) ?? 0) + 1);
    }
    return {
      clave: String(responsable.key),
      codigo,
      aplicador: rotuloDeAplicador(responsable.label),
      anulado: String(responsable.status ?? "").toLowerCase() === "anulado",
      recibidas: Math.round(n(responsable.responses)),
      cuentan: Math.round(n(responsable.valid_responses)),
      umps: Math.round(n(responsable.umps)),
      distritos: String(responsable.districts ?? "").split("·").map((item) => item.trim()).filter(Boolean).map(nombreDeDistrito),
      gpsObservado: conAuditoria ? { casos: observado, base: conGps.length, texto: pctEntero(observado, conGps.length) } : null,
      cortas: conAuditoria ? cortas : null,
      porDia: conAuditoria ? porDia : null,
      ultimo: diaYMes(responsable.latest_activity),
      enBandeja: conBandeja ? enBandeja.length : null,
      senales: [...porTipo.entries()]
        .map(([tipo, cantidad]) => ({ tipo, rotulo: ROTULO_DE_SENAL[tipo] ?? "Otra señal", casos: cantidad }))
        .sort((a, b) => b.casos - a.casos),
      umpsConSenal: [...porUmp.entries()]
        .map(([ump, cantidad]) => ({ ump, casos: cantidad }))
        .sort((a, b) => b.casos - a.casos || Number(a.ump) - Number(b.ump)),
    };
  });
  filas.sort((a, b) => Number(a.anulado) - Number(b.anulado) || (b.enBandeja ?? 0) - (a.enBandeja ?? 0) || b.cuentan - a.cuentan);
  return { filas, dias, conAuditoria, conBandeja };
}
