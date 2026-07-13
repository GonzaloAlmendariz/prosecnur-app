// Lógica de dominio (pura) de la reconciliación de variables data ↔ XLSForm.
// El .tsx solo presenta; aquí vive la selección, el copy y las comparaciones
// para que sea testeable sin montar el componente.
import type { ReconciliacionExtra, ReconciliacionInfo } from "../../api/client";

// Nombres marcados como "incluida" en el estado que trae el backend.
export function initialIncluidas(info: ReconciliacionInfo): string[] {
  return info.extra.filter((extra) => extra.incluida).map((extra) => extra.name);
}

// Etiqueta del relleno para mostrar en la fila. fill_pct viene 0-100.
export function fillLabel(extra: ReconciliacionExtra): string {
  if (extra.kind === "vacia") return "Sin datos";
  const pct = Math.max(0, Math.min(100, extra.fill_pct));
  if (pct > 0 && pct < 1) return "Menos de 1% con datos";
  return `${Math.round(pct)}% con datos`;
}

// Alterna un nombre dentro del conjunto de incluidas, devolviendo un arreglo
// nuevo (no muta). Mantiene el orden de aparición de `extra`.
export function toggleIncluida(
  extras: ReconciliacionExtra[],
  incluidas: string[],
  name: string,
): string[] {
  const set = new Set(incluidas);
  if (set.has(name)) set.delete(name);
  else set.add(name);
  return extras.filter((extra) => set.has(extra.name)).map((extra) => extra.name);
}

// Compara dos selecciones ignorando el orden.
export function selectionEquals(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((name) => set.has(name));
}

// Resumen para el panel revisitable: "3 variables extra · 1 incluida".
export function summaryLabel(info: ReconciliacionInfo): string {
  const extraLabel = `${info.n_extra} variable${info.n_extra === 1 ? "" : "s"} extra`;
  const incluidasLabel = `${info.n_incluidas} incluida${info.n_incluidas === 1 ? "" : "s"}`;
  return `${extraLabel} · ${incluidasLabel}`;
}

// Título del diálogo según cuántas variables se detectaron.
export function dialogTitle(nExtra: number): string {
  if (nExtra === 1) return "Encontramos 1 variable que no está en tu formulario";
  return `Encontramos ${nExtra} variables que no están en tu formulario`;
}
