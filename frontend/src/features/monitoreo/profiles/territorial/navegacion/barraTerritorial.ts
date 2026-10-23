import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import type { EstadoDelModo } from "../../../shell/BarraDelModo";
import { fmt, pctEntero } from "../rotulos";

/**
 * Lo que la barra del modo territorial dice en todas las pestañas (§0): CORTE,
 * la píldora de estado y las insignias de Control y Avance. Una sola lectura
 * de avance en todo el modo (L20): `advance$validas / advance$meta`.
 */

/** «09/07/26 07:24», en la hora local, sin la coma del locale. */
export function corteCorto(valor: string | null | undefined): string {
  const texto = String(valor ?? "").trim();
  if (!texto) return "";
  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) return texto;
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)}/${dos(fecha.getFullYear() % 100)} ${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}

export function estadoDelModo({
  actualizando,
  cargando,
  hayEstado,
  error,
}: {
  actualizando: boolean;
  cargando: boolean;
  hayEstado: boolean;
  error: string;
}): EstadoDelModo {
  if (actualizando) return { clave: "actualizando" };
  if (error) return { clave: "fallo", detalle: error };
  if (!hayEstado || cargando) return { clave: "preparando" };
  return { clave: "al-dia" };
}

export type LecturaDelAvance = { cuentan: number; meta: number } | null;

/** La única lectura de avance del modo, del corte de avance del motor. */
export function lecturaDelAvance(reports: MonitoreoTerritorialDashboard | null | undefined): LecturaDelAvance {
  const cuentan = Number(reports?.advance?.validas);
  const meta = Number(reports?.advance?.meta);
  if (!Number.isFinite(cuentan) || !Number.isFinite(meta) || meta <= 0) return null;
  return { cuentan, meta };
}

/** Casos en la bandeja de revisión (insignia de Control), del corte de consultas. */
export function casosEnBandeja(reports: MonitoreoTerritorialDashboard | null | undefined): number | null {
  const casos = reports?.internal_queries?.review_cases;
  if (!reports || reports.report_scope !== "queries_summary" && reports.report_scope !== "full") return null;
  return Array.isArray(casos) ? casos.length : null;
}

export function insigniasDelModo(
  avance: LecturaDelAvance,
  bandeja: number | null,
): Partial<Record<"control" | "avance", string>> {
  const insignias: Partial<Record<"control" | "avance", string>> = {};
  if (bandeja != null && bandeja > 0) insignias.control = fmt(bandeja);
  if (avance) insignias.avance = pctEntero(avance.cuentan, avance.meta);
  return insignias;
}
