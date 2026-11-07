// Filas y alertas telefónicas: idénticas entre las páginas de Telefónico y
// Acreditación (L33 parte 2, lote 3). Se movieron sin cambiar una línea; las dos
// páginas las importan de aquí. Semántica de familia: no se fusiona nada más.
import { normalizeSourceMatch } from "../profiles/telefonico/formato";
import type { AcreditacionQualityAlertItem } from "../profiles/telefonico/TelefonicoPhoneAlerts";
import type { AcreditacionPhoneSourceContract } from "../profiles/telefonico/TelefonicoSourcesModel";
import { rowNumber } from "./numerosDeFila";

export function phoneRowNumber(row: Record<string, unknown>, keys: string[], fallback = 0) {
  return rowNumber(row, keys, fallback);
}
export function phoneRowOptionalNumber(row: Record<string, unknown>, keys: string[]) {
  const value = rowNumber(row, keys, Number.NaN);
  return Number.isFinite(value) ? value : null;
}
export function phoneRowRatioPct(row: Record<string, unknown>, keys: string[]) {
  const value = phoneRowOptionalNumber(row, keys);
  if (value == null) return null;
  return Math.abs(value) <= 1 ? value * 100 : value;
}
export function phoneAttemptValue(row: Record<string, unknown>, label: string) {
  return phoneRowNumber(row, [label], 0);
}
export function phoneDurationAlertThreshold(alert: AcreditacionQualityAlertItem) {
  const text = normalizeSourceMatch(`${alert.title} ${alert.type} ${alert.detail} ${alert.signal.detail}`);
  const explicit = text.match(/(?:menor(?:es)?\s*a|menos\s*de|<)\s*(\d+(?:[.,]\d+)?)\s*(?:min|minuto|minutos)?/);
  if (explicit) {
    const parsed = Number(explicit[1].replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  if (text.includes("2 min") || text.includes("2 minuto") || text.includes("extremadamente")) return 2;
  if (text.includes("5 min") || text.includes("5 minuto")) return 5;
  return 5;
}
export function phoneDurationAlertDisplayDetail(alert: AcreditacionQualityAlertItem) {
  return (alert.detail || "Revisar duración y consistencia de la respuesta.")
    .replace(/\s*Fuente:.*$/i, "")
    .trim();
}
export function phoneAlertCaseCount(alert: AcreditacionQualityAlertItem) {
  return Math.max(1, Math.round(alert.count ?? alert.total ?? 1));
}
export function phoneContractReadyCount(contract: AcreditacionPhoneSourceContract) {
  return [contract.universe, contract.sweep, contract.platform].filter((slot) => slot.ready).length;
}
export function acreditacionPhoneAlertSignalRows(alerts: AcreditacionQualityAlertItem[]) {
  const rows = new Map<string, { kind: string; label: string; count: number }>();
  alerts.forEach((alert) => {
    const current = rows.get(alert.signal.kind) ?? { kind: alert.signal.kind, label: alert.signal.label, count: 0 };
    current.count += alert.count ?? 1;
    rows.set(alert.signal.kind, current);
  });
  return Array.from(rows.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
}
