import { NOMBRE_TIPO_GRAFICO } from "./catalogoGraficos";
import { safeTrimmedText } from "./safeText";

type GraficadorDisplayMeta = {
  titulo_humano?: string | null;
};

// ADR 0139: los nombres salen del catálogo (graficos_tipos.json → iconos/catalogoTipos.generated.ts), no de una lista
// escrita a mano. graficadorDisplay.contract.test.ts falla si se desvían.
const GRAFICADOR_LABELS: Readonly<Record<string, string>> = NOMBRE_TIPO_GRAFICO;

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
