// Deriva los 8 colores del tema Dashboard a partir de un primario.
//
// Espejo conceptual de `reporte_interactivo_theme_default()` en
// api/R/interactivo_estetica.R:14. Cuando el usuario elige una paleta
// o sobreescribe el primario, derivamos los otros 7 valores con HSL
// math simple — suficiente para v1; si después se quiere control fino
// de los 8 colores se expone como modo avanzado.

import type { DashboardThemeDefault } from "../../../api/client";

const FALLBACK_PRIMARIO = "#002457";

export type DashboardTheme = DashboardThemeDefault;

function clamp(v: number, lo = 0, hi = 255): number {
  return Math.max(lo, Math.min(hi, v));
}

function hexToRgb(hex: unknown): { r: number; g: number; b: number } | null {
  if (typeof hex !== "string") return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

// jsonlite (server) serializa R `NULL` dentro de listas como `[]`
// (array vacío JSON) en lugar de `null`. Sanitiza para que solo strings
// no vacíos se traten como override válido.
function asNonEmptyString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => clamp(Math.round(n)).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

// Mezcla `color` con blanco al `alpha` indicado (0..1, 1 = sin mezclar).
function tint(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const mix = (c: number) => c * alpha + 255 * (1 - alpha);
  return rgbToHex(mix(rgb.r), mix(rgb.g), mix(rgb.b));
}

// Mezcla `color` con negro al `alpha` indicado (0..1, 1 = sin oscurecer).
function shade(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const mix = (c: number) => c * alpha;
  return rgbToHex(mix(rgb.r), mix(rgb.g), mix(rgb.b));
}

export function deriveDashboardTheme(input: {
  paletaId: string | null;
  colorPrimarioOverride: string | null;
  paletaColors?: string[]; // primer color de la paleta seleccionada, si hay
  themeDefault?: DashboardThemeDefault;
}): DashboardTheme {
  const base = input.themeDefault;
  const override = asNonEmptyString(input.colorPrimarioOverride);
  const paletaPrim = asNonEmptyString(input.paletaColors?.[0]);
  const baseFromDefault = asNonEmptyString(base?.color_primario);
  const primario = override ?? paletaPrim ?? baseFromDefault ?? FALLBACK_PRIMARIO;

  // Si no hay override ni paleta y tenemos defaults completos, retornarlos.
  if (!override && !paletaPrim && base) {
    return base;
  }

  return {
    color_primario: primario,
    color_fondo_app: tint(primario, 0.04),
    color_borde: tint(primario, 0.16),
    color_texto: shade(primario, 0.35),
    color_texto_suave: tint(shade(primario, 0.6), 0.55),
    color_superficie: "#ffffff",
    color_superficie_2: tint(primario, 0.03),
    color_header_tabla: tint(primario, 0.1),
  };
}
