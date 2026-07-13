// =============================================================================
// helpers/paletteForType.ts — color por tipo de pregunta XLSForm
// =============================================================================
// Mapping centralizado de tipo XLSForm → color de la paleta categórica de
// 10 niveles (`CATEGORICAL_PALETTE_10` de validacion/components/plotlyTheme).
//
// Se usa en:
//   - Iconos del outline (color del icono).
//   - Bordes de tarjetas en el live preview.
//   - Chips de tipo en el inspector y selector de tipo.
//
// Mantener el mapping aquí evita duplicar literales hex por todo el editor.
// =============================================================================

import { CATEGORICAL_PALETTE_10 } from "../../validacion/components/plotlyTheme";

/**
 * Color hex por tipo base. Si el tipo no está mapeado, devuelve el color
 * neutro de la paleta. Los tipos auto-meta (start/end/today/...) comparten
 * el tono "soft" para distinguirlos visualmente como "no preguntan".
 */
export function paletteForType(baseType: string): string {
  switch (baseType) {
    // Selección
    case "select_one":
      return CATEGORICAL_PALETTE_10[0]; // azul primary

    case "select_multiple":
      return CATEGORICAL_PALETTE_10[5]; // lima

    // Numéricos
    case "integer":
    case "decimal":
      return CATEGORICAL_PALETTE_10[3]; // púrpura

    // Texto
    case "text":
      return CATEGORICAL_PALETTE_10[9]; // marrón (neutral cálido)

    // Fechas y tiempo
    case "date":
    case "time":
    case "datetime":
      return CATEGORICAL_PALETTE_10[2]; // ámbar

    // Cálculos / lógica derivada
    case "calculate":
      return CATEGORICAL_PALETTE_10[8]; // indigo

    // Notas y confirmaciones (no preguntan)
    case "note":
    case "acknowledge":
    case "hidden":
    case "start":
    case "end":
    case "today":
    case "deviceid":
    case "username":
      return "var(--pulso-text-soft)"; // tono soft del theme

    // Estructura
    case "begin_group":
    case "end_group":
      return CATEGORICAL_PALETTE_10[1]; // teal

    case "begin_repeat":
    case "end_repeat":
      // Identidad naranja transversal de "grupo repetible" (`--pulso-repeat-*`,
      // ADR 0030). El repeat es de primera clase en toda la app: el mismo
      // naranja lo marca en Carga, el editor y el mapa de lógica. Devolvemos el
      // token CSS (no un hex de la paleta categórica) para que stroke/fill del
      // SVG y los estilos hereden el color resuelto del tema.
      return "var(--pulso-repeat-accent)";

    // Multimedia
    case "image":
    case "audio":
    case "video":
    case "file":
    case "barcode":
      return CATEGORICAL_PALETTE_10[6]; // cyan

    // Geo
    case "geopoint":
    case "geotrace":
    case "geoshape":
      return CATEGORICAL_PALETTE_10[9]; // marrón (igual que text — los geo se distinguen por icono)

    default:
      return "var(--pulso-text-soft)";
  }
}

/**
 * Versión "soft" del color (rgba con alpha bajo) — usada para fondos de
 * cards y badges en el preview. Si el tipo es soft (start/end/...) devuelve
 * un fondo neutral.
 */
export function paletteSoftForType(baseType: string): string {
  // Repeat: fondo naranja suave del token (no el neutro que caería por el
  // guardia `var(` de abajo, ni una conversión rgba de un no-hex).
  if (baseType === "begin_repeat" || baseType === "end_repeat") {
    return "var(--pulso-repeat-bg)";
  }
  const c = paletteForType(baseType);
  if (c.startsWith("var(")) return "var(--pulso-surface-2)";
  return rgbaFromHex(c, 0.1);
}

function rgbaFromHex(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return `rgba(36, 87, 214, ${alpha})`;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
