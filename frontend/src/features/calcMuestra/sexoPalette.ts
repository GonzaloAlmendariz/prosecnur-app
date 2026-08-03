/**
 * Contrato cromático único para comparaciones por sexo dentro de Cálculo de
 * muestra. Los colores viven como tokens CSS del módulo; este archivo solo
 * normaliza etiquetas y evita que cada gráfico decida una paleta distinta.
 */

export type SexSeriesKind = "male" | "female" | "missing" | "other";

function normalizedSexLabel(label: string) {
  return String(label ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function sexSeriesKind(label: string): SexSeriesKind {
  const key = normalizedSexLabel(label);
  if (!key || ["sindato", "sinrespuesta", "noresponde", "na", "missing"].includes(key)) return "missing";
  if (["m", "male", "masculino", "h", "hombre", "hombres", "varon", "varones"].includes(key)) return "male";
  if (key.includes("hombre") || key.includes("masculino") || key.includes("varon")) return "male";
  if (["f", "female", "femenino", "mujer", "mujeres", "fem"].includes(key)) return "female";
  if (key.includes("mujer") || key.includes("femenino") || key.includes("female")) return "female";
  return "other";
}

/**
 * Etiqueta legible de una serie de sexo.
 *
 * Las leyendas mostraban **«F»** y **«M»** —los códigos con que viene la base—
 * en «Distribución por facultad y sexo» (Entrega) y en el marco de población. Un
 * gráfico que obliga a saber la codificación para leer su leyenda no se entrega
 * a un cliente.
 *
 * Vive junto a `sexSeriesKind` a propósito: color y etiqueta deben decidirse con
 * el mismo criterio, o una serie puede salir rosa y llamarse «M».
 *
 * Lo que no se reconoce **pasa tal cual**: si el estudio subdivide por turno o
 * cohorte, inventarle un nombre sería peor que mostrar su código.
 */
export function sexSeriesLabel(label: string): string {
  const kind = sexSeriesKind(label);
  if (kind === "male") return "Hombres";
  if (kind === "female") return "Mujeres";
  if (kind === "missing") return "Sin dato";
  return label;
}

const OTHER_SERIES = [
  "var(--cmv2-accent)",
  "var(--pulso-accent-cyan)",
  "var(--pulso-text-muted)",
] as const;

export function sexSeriesCssColorForKind(kind: SexSeriesKind, fallbackIndex = 0) {
  if (kind === "male") return "var(--cmv2-sex-hombre)";
  if (kind === "female") return "var(--cmv2-sex-mujer)";
  if (kind === "missing") return "var(--cmv2-sex-sin-dato)";
  return OTHER_SERIES[fallbackIndex % OTHER_SERIES.length];
}

export function sexSeriesCssColor(label: string, fallbackIndex = 0) {
  return sexSeriesCssColorForKind(sexSeriesKind(label), fallbackIndex);
}

/** Etiqueta legible para leyendas. Conserva categorías propias del proyecto,
 * pero expande los códigos institucionales M/F/H. */
export function sexSeriesDisplayLabel(label: string) {
  const kind = sexSeriesKind(label);
  if (kind === "male") return "Hombre";
  if (kind === "female") return "Mujer";
  if (kind === "missing") return "Sin dato";
  return label;
}
