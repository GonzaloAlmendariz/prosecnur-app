import type { MonitoreoTerritorialPhaseCoherenceItem } from "../../../../api/monitoreo";

// Vara V4 en Monitoreo territorial. `territorial_phase_coherence` trae dos
// conteos por fase y la interfaz sólo decía uno:
//
//   · `local_rows`  — las respuestas de esa fuente en el snapshot local.
//   · `report_rows` — las que quedan tras el corte de la fase, que es con las
//                     que trabaja el tablero.
//
// En acnur_acg, Campo tiene 1 697 locales y 1 693 en el reporte: cuatro
// respuestas del 4 de junio, anteriores al inicio declarado de Campo
// (2026-06-12 10:00Z), que el filtro de fase deja fuera. La consola decía
// «Campo tiene 1,697 respuestas locales sincronizadas» y el badge «1,697
// locales», mientras el tablero contaba 1 693. Cuatro respuestas se perdían
// entre una pantalla y la otra sin que nada lo dijera.
//
// El propio motor usa `report_rows` para decidir si el tablero está
// desactualizado; era el único que lo miraba.

export type FilasDeFase = {
  /** Frase de estado para la consola de fuentes. */
  texto: string;
  /** Etiqueta corta para el badge de la fase. */
  badge: string;
  /** Cuántas quedan fuera del reporte; `null` cuando no hay diferencia. */
  fuera: number | null;
};

function entero(value: unknown): number | null {
  // `Number(null)` es 0, no NaN: sin este guardia un `report_rows: null` —lo
  // que manda un .pulso viejo— afirmaría que se cayeron TODAS las respuestas.
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

function conMiles(value: number): string {
  return new Intl.NumberFormat("es-PE").format(value);
}

/**
 * Cómo se cuentan las respuestas de una fase sincronizada.
 *
 * Devuelve `null` cuando no hay nada distinto que decir —sin `report_rows`, o
 * con los dos conteos iguales—, y entonces la consola conserva el mensaje que
 * manda el motor.
 */
export function describirFilasDeFase(
  item: MonitoreoTerritorialPhaseCoherenceItem | null | undefined,
  label: string,
): FilasDeFase | null {
  if (!item) return null;
  // Sólo sobre la fase sana. La consola devuelve esta frase ANTES que
  // `item.message`, y en `dashboard_stale`, `sync_error` o
  // `source_snapshot_mismatch` el mensaje del motor es más urgente que un
  // desglose de conteos: taparlo con «1 697 locales y 1 693 en el reporte»
  // cambiaría un «actualiza el corte» por una aritmética.
  if (item.status !== "source_synced_with_rows") return null;
  const locales = entero(item.local_rows);
  const enReporte = entero(item.report_rows);
  if (locales === null || enReporte === null) return null;
  // Un reporte con MÁS filas que el snapshot no es una diferencia explicable
  // por el corte de la fase: es un payload incoherente y no se narra.
  if (enReporte >= locales) return null;

  const fuera = locales - enReporte;
  const cuantas = fuera === 1 ? "1 respuesta quedó fuera" : `${conMiles(fuera)} respuestas quedaron fuera`;
  return {
    texto: `${label} tiene ${conMiles(locales)} respuestas locales y el reporte usa ${conMiles(enReporte)}: ${cuantas} del corte de la fase.`,
    badge: `${conMiles(enReporte)} de ${conMiles(locales)}`,
    fuera,
  };
}
