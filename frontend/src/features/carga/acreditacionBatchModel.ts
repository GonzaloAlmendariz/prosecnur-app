import type { AcreditacionBatchEntry, AcreditacionBatchPreview } from "../../api/client";

export type AcreditacionBatchFailureView = {
  message: string;
  guided: boolean;
};

export function acreditacionBatchFailureView(
  code: string,
  fallbackMessage: string,
): AcreditacionBatchFailureView {
  if (code === "E_ACREDITACION_BATCH_INTAKE") {
    return {
      guided: true,
      message: "Falta asignar un formulario publicado a uno o más públicos antes de crear las bases.",
    };
  }
  return { guided: false, message: fallbackMessage || "No se pudo preparar el corte de Monitoreo." };
}

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
