import { safeTrimmedText } from "./safeText";

type GraficadorDisplayMeta = {
  titulo_humano?: string | null;
};

const GRAFICADOR_LABELS: Record<string, string> = {
  p_barras: "Barras agrupadas",
  p_barras_agrupadas: "Barras agrupadas",
  p_barras_apiladas: "Barras apiladas",
  p_barras_multiapiladas: "Barras multiapiladas",
  p_pie: "Circular",
  p_donut: "Donut",
  p_dicotomica: "Dicotómica",
  p_numerico: "Indicador numérico",
  p_boxplot: "Boxplot",
  p_media_rango: "Media y rango",
  p_radar: "Radar",
  p_tabla: "Tabla",
  p_heatmap_cruce: "Mapa de calor por cruce",
  p_radar_tabla: "Radar + tabla",
};

const WORD_REPLACEMENTS: Record<string, string> = {
  grafico: "gráfico",
  graficos: "gráficos",
  indice: "índice",
  numerico: "numérico",
  seccion: "sección",
  tecnico: "técnico",
};

export function graficadorDisplayName(name?: string, meta?: GraficadorDisplayMeta | null): string {
  const metaLabel = safeTrimmedText(meta?.titulo_humano);
  if (metaLabel) return metaLabel;
  if (!name) return "Gráfico";
  return GRAFICADOR_LABELS[name] ?? humanizeIdentifier(name, "Gráfico");
}

export function graficadorKindLabel(name?: string, meta?: GraficadorDisplayMeta | null): string {
  if (!name) return "Tipo de gráfico";
  return GRAFICADOR_LABELS[name] ?? graficadorDisplayName(name, meta);
}

export function humanizeIdentifier(value: unknown, fallback = "Elemento"): string {
  const raw = safeTrimmedText(value);
  if (!raw) return fallback;

  const normalized = raw
    .replace(/^p_/, "")
    .replace(/^slide_/, "")
    .replace(/^arg_/, "")
    .replace(/[_-]+/g, " ")
    .trim();

  if (!normalized) return fallback;

  return normalized
    .split(/\s+/)
    .map((word) => WORD_REPLACEMENTS[word.toLowerCase()] ?? word)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
