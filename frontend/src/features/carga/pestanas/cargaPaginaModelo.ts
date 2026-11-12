import type { DataPreview } from "../RespuestasResumen";
import type {
  apiCargaInstrumento,
  CargaPlatformProvider,
  ChoiceCodeMapReview,
  ConnectionTokenState,
  CargaReviewPayload,
  EstudioBase,
  EstudioProcessingSuggestions,
  KoboSourceSpec,
  ReconciliacionInfo,
} from "../../../api/client";
import { formatoConteo } from "../../../lib/formatoNumero";

// Modelo puro de la página de Carga: etiquetas, normalizaciones de la vista
// previa y adaptaciones de la revisión. Sin React ni pedidos.

export type InstrumentoResumen = Awaited<ReturnType<typeof apiCargaInstrumento>>["resumen"];

export type SourceMode = "files" | "platform" | "monitoring";
export type DetectedKoboSource = KoboSourceSpec & {
  ok: true;
  detected: true;
  provider: "kobo";
  phase: string;
  name: string;
};

export function providerLabel(provider: CargaPlatformProvider) {
  return provider === "kobo" ? "KoboToolbox" : "SurveyMonkey";
}

export function cargaSourceModes(
  _suggestions: EstudioProcessingSuggestions | null,
): SourceMode[] {
  return ["files", "platform", "monitoring"];
}

export function connectedProfiles(connection?: ConnectionTokenState): Array<{ id: string; alias: string; base_url?: string; is_default?: boolean }> {
  const profiles = (connection?.profiles ?? [])
    .filter((profile) => profile.has_token)
    .map((profile) => ({
      id: profile.id,
      alias: profile.alias || "Principal",
      base_url: profile.base_url || "",
      is_default: profile.is_default,
    }));
  if (profiles.length > 0) return profiles;
  if (connection?.has_token) {
    return [{
      id: connection.active_profile_id || "",
      alias: connection.active_profile_alias || "Principal",
      base_url: connection.active_profile_base_url || "",
      is_default: true,
    }];
  }
  return [];
}

export function dataPreviewNormalizationDetails(preview: DataPreview | null): string[] {
  const normalizacion = preview?.normalizacion;
  if (!normalizacion) return [];
  const rows: string[] = [];
  Object.entries(normalizacion.alias_columns ?? {}).forEach(([target, source]) => {
    rows.push(`alias ${source} -> ${target}`);
  });
  Object.entries(normalizacion.single_child_collapse_columns ?? {}).forEach(([target, source]) => {
    rows.push(`colapso ${source} -> ${target}`);
  });
  Object.entries(normalizacion.select_multiple_columns ?? {}).forEach(([target, sources]) => {
    const sourceList = Array.isArray(sources) ? sources : [String(sources)];
    rows.push(`selección múltiple ${target}: ${sourceList.join(", ")}`);
  });
  const choiceMaps = normalizacion.choice_code_maps;
  if (choiceMaps?.applied && choiceMaps.maps.length > 0) {
    choiceMaps.maps.forEach((map) => {
      rows.push(`mapeo de códigos ${map.variable}: ${map.mappings.length} opción(es) por etiqueta`);
    });
  }
  return rows;
}

export function choiceMappingReviewFromPreview(preview: DataPreview | null): ChoiceCodeMapReview | null {
  const review = preview?.normalizacion?.choice_code_maps;
  if (!review?.applied) return null;
  const maps = Array.isArray(review.maps) ? review.maps : [];
  if (!maps.length) return null;
  return { ...review, maps };
}

export function markChoiceMappingConfirmed(preview: DataPreview | null): DataPreview | null {
  if (!preview?.normalizacion?.choice_code_maps) return preview;
  return {
    ...preview,
    normalizacion: {
      ...preview.normalizacion,
      choice_code_maps: {
        ...preview.normalizacion.choice_code_maps,
        requires_confirmation: false,
        maps: preview.normalizacion.choice_code_maps.maps.map((map) => ({
          ...map,
          requires_confirmation: false,
        })),
      },
    },
  };
}

// La revisión publica la decisión de cada columna; el diálogo la necesita para
// respetar solo lo ya decidido y aplicar la regla de marcado a las columnas nuevas.
function decisionDeLaRevision(extra: CargaReviewPayload["reconciliation"]["extra"][number]): "include" | "exclude" | "pending" {
  if (extra.decision === "include" || extra.incluida) return "include";
  if (extra.decision === "exclude") return "exclude";
  return "pending";
}

export function reviewReconciliationInfo(review: CargaReviewPayload): ReconciliacionInfo {
  return {
    ok: true,
    extra: review.reconciliation.extra.map((extra) => ({
      name: extra.name,
      fill_pct: extra.fill_pct,
      n_fill: extra.n_fill,
      kind: extra.kind,
      incluida: extra.incluida,
      decision: decisionDeLaRevision(extra),
      personal: extra.personal,
    })),
    n_extra: review.reconciliation.n_extra,
    n_incluidas: review.reconciliation.n_incluidas,
  };
}

// Etiqueta humana de la fase territorial (evita mostrar el valor técnico crudo).
export function faseTerritorialLabel(phase: string | null | undefined): string {
  const p = String(phase ?? "").trim().toLowerCase();
  if (!p) return "";
  if (p === "field" || p === "campo") return "Campo";
  if (p === "pilot" || p === "piloto" || p === "pilon" || p === "pilón") return "Piloto";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

export function handoffCount(n: number | null | undefined): number {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

export function cargaBaseLabel(base: EstudioBase) {
  return String(base.source_alias || base.source_title || base.nombre || "").trim() || base.nombre;
}

export function cargaBaseMeta(base: EstudioBase) {
  const rows = typeof base.n_filas === "number" ? formatoConteo(base.n_filas) : "sin conteo";
  const cols = typeof base.n_columnas === "number" ? formatoConteo(base.n_columnas) : "sin columnas";
  return `${base.nombre}: ${rows} filas y ${cols} columnas`;
}
