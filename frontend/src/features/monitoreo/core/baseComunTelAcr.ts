// Piezas de la base de Telefónico idénticas a las de la página de Acreditación
// (L33 parte 2, lote 5). Se movieron sin cambiar una línea; telefonicoBase las
// reexporta y la página de Acreditación las importa de aquí.
import { fmt } from "../profiles/telefonico/formato";
import type { MonitoreoAcreditacion, MonitoreoState } from "../../../api/client";
import { pctDecimal } from "./formatoComun";

export function cumplimientoLabel(estado: MonitoreoAcreditacion["dashboard"]["cards"][number]["estado"]) {
  if (estado === "cumple_meta") return "Cumple";
  if (estado === "brecha_menor_documentada") return "Brecha menor";
  if (estado === "brecha_relevante") return "Brecha relevante";
  return "Sin meta";
}
export function formatCaseLabel(value: number) {
  return `${fmt(value)} caso${value === 1 ? "" : "s"}`;
}
export function isTelefonicoMonitoreoState(state?: MonitoreoState | null) {
  return (state?.monitoreo_profile?.family ?? state?.config?.monitoreo_profile?.family) === "telefonico";
}
export function pctFrom(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return "S/D";
  return pctDecimal((value / total) * 100);
}
export function unknownArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}
