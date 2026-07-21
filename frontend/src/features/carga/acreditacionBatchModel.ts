import type { AcreditacionBatchEntry, AcreditacionBatchPreview } from "../../api/client";

export function acreditacionBatchCanPromote(preview: AcreditacionBatchPreview | null): boolean {
  return Boolean(
    preview?.detected
    && preview.ready
    && !preview.already_materialized
    && preview.entries.length > 0
    && preview.entries.every((entry) => (
      entry.status === "ready" || entry.status === "replacement_required"
    ) && entry.compatibility.ok),
  );
}

export function acreditacionBatchEntryDetail(entry: AcreditacionBatchEntry): string {
  if (entry.blocking_reasons.length > 0) return entry.blocking_reasons[0].message;
  if (!entry.compatibility.ok) return entry.compatibility.message;
  if (entry.extras.length > 0) {
    return `${entry.extras.length} variable${entry.extras.length === 1 ? "" : "s"} extra excluida${entry.extras.length === 1 ? "" : "s"} por defecto.`;
  }
  return "Instrumento y respuestas compatibles.";
}

export function acreditacionBatchTotalLabel(preview: AcreditacionBatchPreview): string {
  const selected = preview.totals.selected.toLocaleString("es-PE");
  const excluded = preview.totals.excluded.toLocaleString("es-PE");
  return `${selected} efectivas listas · ${excluded} fuera del informe de avance`;
}
