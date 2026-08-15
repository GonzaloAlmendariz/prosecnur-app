// =============================================================================
// limpiezaArtifacts — lectura defensiva de lo que dejó el cierre de Limpieza
// =============================================================================
// El bundle de artefactos mezcla dos cosas con ciclos de vida distintos:
//
//   · `files` / `finalized_at` — el resultado del último cierre. Editar una
//     decisión los borra (`.limpieza_invalidate_outputs`).
//   · `promocion` — el linaje del ADR 0076, que dice qué base rige. Sobrevive a
//     esa invalidación, porque la base promovida sigue siendo la vigente hasta
//     que alguien la revierta.
//
// Por eso el bundle vale si trae archivos O si trae linaje: descartarlo por no
// tener `files` era lo que dejaba muda la promoción tras cualquier retoque.
// =============================================================================

import type { LimpiezaArtifactsBundle, LimpiezaPromocion, LimpiezaSummary } from "./types";

// R serializa un `NA_integer_` como la cadena "NA" y un linaje ausente como
// `{}`: ni los conteos ni el propio objeto llegan con la forma del tipo.
export function normalizePromocion(value: unknown): LimpiezaPromocion | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const efectivo = typeof raw.effective_data_file_id === "string" ? raw.effective_data_file_id : "";
  const origen = typeof raw.source_data_file_id === "string" ? raw.source_data_file_id : "";
  if (!efectivo && !origen) return null;
  const promocion: LimpiezaPromocion = {
    enabled: raw.enabled === true,
    source_data_file_id: origen,
    effective_data_file_id: efectivo,
    n_casos_antes: asCount(raw.n_casos_antes),
    n_casos_despues: asCount(raw.n_casos_despues),
  };
  if (typeof raw.applied_at === "string") promocion.applied_at = raw.applied_at;
  if (typeof raw.reverted_at === "string") promocion.reverted_at = raw.reverted_at;
  if (typeof raw.bloqueo === "string" && raw.bloqueo.trim()) promocion.bloqueo = raw.bloqueo.trim();
  return promocion;
}

export function extractArtifacts(
  value: LimpiezaSummary["artifacts"] | undefined,
): LimpiezaArtifactsBundle | null {
  if (!value || typeof value !== "object") return null;
  const bundle = value as Partial<LimpiezaArtifactsBundle>;
  const files = Array.isArray(bundle.files) ? bundle.files : [];
  const promocion = normalizePromocion(bundle.promocion);
  if (!files.length && !promocion) return null;
  return promocion ? { ...bundle, files, promocion } : { ...bundle, files };
}

function asCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
