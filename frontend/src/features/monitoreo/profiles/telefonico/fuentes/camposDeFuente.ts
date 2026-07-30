/**
 * Lectura de los campos de una fuente de Monitoreo.
 *
 * Salieron del page-file por la regla de la casa: el archivo está congelado a
 * crecimiento y estos tres helpers eran justamente lo que la cadena necesitaba
 * para armarse. Aquí caben, y de paso el page-file pierde las líneas que ganó.
 *
 * El `sheet_binding` no siempre trae lo que se le pide: hay fuentes guardadas
 * con los campos planos en la raíz (`row_count`, `last_read_at`) y otras con el
 * binding completo. De ahí el respaldo campo a campo en vez de asumir una forma.
 */

import type { MonitoreoSource } from "../../../../../api/client";
import { formatDate } from "../formato";

export type CampoDeHoja = "spreadsheet_id" | "sheet_name" | "range" | "last_read_at" | "row_count";

function campoPlano(source: MonitoreoSource, key: string) {
  const value = (source as unknown as Record<string, unknown>)[key];
  return String(value ?? "").trim();
}

export function sourceSheetField(source: MonitoreoSource, key: CampoDeHoja) {
  const binding = source.sheet_binding as unknown as Record<string, unknown> | undefined;
  return String(binding?.[key] ?? campoPlano(source, key) ?? "").trim();
}

export function sourceRowCount(source: MonitoreoSource) {
  const raw = Number(sourceSheetField(source, "row_count"));
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

/**
 * Cuándo se leyó por última vez, o por qué no hay fecha.
 *
 * «Inactiva» y «Sin sync» no son lo mismo y la vista los distingue: la primera
 * es una decisión del usuario, la segunda es una fuente que nunca se leyó.
 *
 * La marca puede venir de cinco sitios distintos —la fuente, el binding, el
 * cursor de sincronización o cualquiera de sus recopiladores— y se queda la más
 * reciente, no la primera que aparezca.
 */
export function sourceSyncLabel(source: MonitoreoSource) {
  if (!source.enabled) return "Inactiva";
  const stamps = [
    source.last_sync_at,
    sourceSheetField(source, "last_read_at"),
    source.sync_cursor?.updated_at,
    ...(source.collectors ?? []).flatMap((collector) => [collector.last_sync_at, collector.synced_at]),
  ].filter((value): value is string => Boolean(value));
  if (!stamps.length) return "Sin sync";
  const [latest] = stamps.sort((a, b) => {
    const left = new Date(a).getTime();
    const right = new Date(b).getTime();
    return (Number.isFinite(right) ? right : 0) - (Number.isFinite(left) ? left : 0);
  });
  return formatDate(latest);
}
