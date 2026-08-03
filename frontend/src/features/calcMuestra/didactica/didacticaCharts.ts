/**
 * Builders Plotly de la capa didáctica.
 *
 * Todos los colores se leen de los tokens CSS `--cmv2-*` / `--pulso-*` en
 * runtime (getComputedStyle) y se re-leen cuando cambia `data-theme`, de modo
 * que los charts siguen al tema sin hardcodear hex.
 */
import { useEffect, useMemo, useState } from "react";
import { sexSeriesKind } from "../sexoPalette";

export type DidTokens = {
  accent: string;
  accentSoft: string;
  border: string;
  text: string;
  textMuted: string;
  surface: string;
  success: string;
  warn: string;
  sexMale: string;
  sexFemale: string;
  sexMissing: string;
  font: string;
};

function readToken(styles: CSSStyleDeclaration, name: string, fallback: string) {
  const value = styles.getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Resuelve un valor CSS de color a rgb() computado. Necesario porque varios
 * tokens --cmv2-* son expresiones color-mix() que Plotly no sabe parsear.
 */
function resolveColor(value: string, fallback: string): string {
  if (!value) return fallback;
  if (/^(#|rgb|hsl)/i.test(value)) return value;
  if (typeof document === "undefined") return fallback;
  const probe = document.createElement("span");
  probe.style.display = "none";
  probe.style.color = value;
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved && resolved !== "rgba(0, 0, 0, 0)" ? resolved : fallback;
}

export function readDidTokens(el?: Element | null): DidTokens {
  const target = el ?? document.querySelector(".cmv2-frame") ?? document.documentElement;
  const styles = getComputedStyle(target);
  const rootStyles = getComputedStyle(document.documentElement);
  const accent = resolveColor(
    readToken(styles, "--cmv2-accent", readToken(rootStyles, "--pulso-module-sample", "#7c3aed")),
    "#7c3aed",
  );
  return {
    accent,
    accentSoft: resolveColor(readToken(styles, "--cmv2-accent-soft", ""), "rgba(124, 58, 237, 0.08)"),
    border: resolveColor(
      readToken(styles, "--cmv2-border", readToken(rootStyles, "--pulso-border", "#e2e8f0")),
      "#e2e8f0",
    ),
    text: resolveColor(readToken(rootStyles, "--pulso-text", "#0f172a"), "#0f172a"),
    textMuted: resolveColor(readToken(rootStyles, "--pulso-text-muted", "#64748b"), "#64748b"),
    surface: resolveColor(
      readToken(styles, "--cmv2-surface", readToken(rootStyles, "--pulso-surface", "#ffffff")),
      "#ffffff",
    ),
    success: resolveColor(readToken(rootStyles, "--pulso-success-fg", "#15803d"), "#15803d"),
    warn: resolveColor(readToken(rootStyles, "--pulso-warn-fg", "#b45309"), "#b45309"),
    sexMale: resolveColor(readToken(styles, "--cmv2-sex-hombre", "#2563eb"), "#2563eb"),
    sexFemale: resolveColor(readToken(styles, "--cmv2-sex-mujer", "#c2416b"), "#c2416b"),
    sexMissing: resolveColor(readToken(styles, "--cmv2-sex-sin-dato", "#cbd5e4"), "#cbd5e4"),
    font: readToken(rootStyles, "--pulso-font", "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"),
  };
}

/** Tokens reactivos: se recalculan al cambiar data-theme en <html>. */
export function useDidTokens(): DidTokens {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const observer = new MutationObserver(() => setVersion((v) => v + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => observer.disconnect();
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => readDidTokens(), [version]);
}

/** Escala de tintes del acento para series categóricas (opacidad decreciente). */
export function accentScale(tokens: DidTokens, count: number): string[] {
  const steps = Math.max(count, 1);
  return Array.from({ length: steps }, (_, i) => {
    const alpha = 0.9 - (i / Math.max(steps - 1, 1)) * 0.55;
    return colorWithAlpha(tokens.accent, alpha);
  });
}

export function colorWithAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  if (hex.startsWith("#") && (hex.length === 7 || hex.length === 4)) {
    const full = hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
    const r = parseInt(full.slice(1, 3), 16);
    const g = parseInt(full.slice(3, 5), 16);
    const b = parseInt(full.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
  }
  const rgb = hex.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const [r, g, b] = rgb[1].split(",").map((part) => part.trim());
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
  }
  return color;
}

/** Color resuelto para Plotly a partir del mismo contrato que usan los charts CSS. */
export function didSexSeriesColor(label: string, tokens: DidTokens, fallbackIndex = 0) {
  const kind = sexSeriesKind(label);
  if (kind === "male") return tokens.sexMale;
  if (kind === "female") return tokens.sexFemale;
  if (kind === "missing") return tokens.sexMissing;
  return accentScale(tokens, 3)[fallbackIndex % 3];
}

/** Reexporta la etiqueta canónica: color y nombre se deciden en el mismo sitio. */
export { sexSeriesLabel as didSexSeriesLabel } from "../sexoPalette";

export function didPlotLayout(tokens: DidTokens, overrides?: Record<string, unknown>) {
  return {
    autosize: true,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: tokens.font, size: 11.5, color: tokens.text },
    margin: { l: 10, r: 10, t: 8, b: 10 },
    // Grid sutil y sin zerolines duras: los datos mandan, no la retícula.
    xaxis: { gridcolor: colorWithAlpha(tokens.border, 0.55), zeroline: false, tickfont: { size: 10.5 } },
    yaxis: { gridcolor: colorWithAlpha(tokens.border, 0.55), zeroline: false, tickfont: { size: 10.5 }, automargin: true },
    hoverlabel: {
      bgcolor: tokens.surface,
      bordercolor: tokens.border,
      font: { family: tokens.font, size: 11.5, color: tokens.text },
    },
    // Plotly.react anima el cambio de datos cuando hay transition declarada:
    // al recalcular, las barras se mueven en vez de saltar.
    transition: { duration: 260, easing: "cubic-in-out" },
    ...overrides,
  } as Record<string, unknown>;
}

export const DID_PLOT_CONFIG = {
  displayModeBar: false,
  responsive: true,
} as const;

export type BarrasApiladasSerie = {
  nombre: string;
  valores: number[];
  color?: string;
};

export function buildStackedBars(
  categorias: string[],
  series: BarrasApiladasSerie[],
  tokens: DidTokens,
) {
  const palette = accentScale(tokens, series.length);
  return series.map((serie, i) => ({
    type: "bar",
    orientation: "h",
    name: serie.nombre,
    y: categorias,
    x: serie.valores,
    marker: { color: serie.color ?? palette[i], line: { color: tokens.surface, width: 1 } },
    hovertemplate: `%{y} · ${serie.nombre}: %{x:,d}<extra></extra>`,
  }));
}
