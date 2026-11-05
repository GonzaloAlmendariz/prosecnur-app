// Letra y eje de las barras agrupadas (U12 del checklist de mandos del mazo, 2026-11-05). La lámina nativa lee del
// gráfico, y sólo de sus `overrides` (no del preset), `size_ejes` en puntos y `size_texto_barras` en milímetros
// (api/R/lamina_tamanos_declarados.R) y `usar_eje_libre`, que deja la escala al máximo observado en vez de 0 a 100 %
// (graficador_barras_agrupadas.R, `escala_completa`; lamina_barras_ancho.R). Ninguno es formal de `p_barras_agrupadas()`,
// así que viajan por `overrides`. La tarjeta habla en puntos: la cifra se guarda en milímetros. Puro.
//
// «Espacio para las etiquetas» (`canvas_w_etiquetas`, «Espacio para etiquetas» en el registro de agrupadas): la columna de
// los nombres de cada barra, en fracción del ancho útil de la lámina (`.lam_tamanos_declarados`, tope 0.9; manda sobre el
// ancho automático en lamina_barras_ancho.R). Tampoco es formal de `p_barras_agrupadas()`: suelto en `args`,
// `.clean_rebuild_args` lo descarta, así que va en `overrides`. La tarjeta habla en % del ancho; se guarda la fracción.

type Valores = Readonly<Record<string, unknown>>;

export const GRAFICADORES_LETRA_Y_EJE: ReadonlySet<string> = new Set(["p_barras_agrupadas"]);

/** Rango de la letra en la tarjeta, en puntos. */
export const LETRA_MIN_PT = 8;
export const LETRA_MAX_PT = 20;
export const LETRA_PASO_PT = 0.5;

const MM_POR_PT = 25.4 / 72;

/** Rango del espacio para las etiquetas en la tarjeta, en % del ancho útil (el motor acepta hasta 90 %). */
export const ETIQUETAS_MIN_PCT = 10;
export const ETIQUETAS_MAX_PCT = 70;
export const ETIQUETAS_PASO_PCT = 5;
const ETIQUETAS_TOPE = 0.9;

export type LetraYEje = { rotuloPt: number | null; cifraPt: number | null; ejeLibre: boolean; etiquetasPct: number | null };

const overridesDe = (args: Valores): Record<string, unknown> =>
  args.overrides && typeof args.overrides === "object" && !Array.isArray(args.overrides) ? (args.overrides as Record<string, unknown>) : {};

const positivo = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

const alMedioPunto = (n: number) => Math.round(n / LETRA_PASO_PT) * LETRA_PASO_PT;

export function leerLetraYEje(args: Valores): LetraYEje {
  const ov = overridesDe(args);
  const mm = positivo(ov.size_texto_barras);
  const frac = positivo(ov.canvas_w_etiquetas);
  return {
    rotuloPt: positivo(ov.size_ejes),
    cifraPt: mm === null ? null : alMedioPunto(mm / MM_POR_PT),
    ejeLibre: ov.usar_eje_libre === true,
    // Lo que el motor no lee (más del 90 %) se muestra vacío, como la lámina: ancho automático.
    etiquetasPct: frac === null || frac > ETIQUETAS_TOPE ? null : Math.round(frac * 100),
  };
}

/** Los `overrides` con el cambio; un tamaño `null` y el eje libre apagado borran su clave. Sin claves, `null`. */
export function conLetraYEje(args: Valores, cambio: Partial<LetraYEje>): Record<string, unknown> | null {
  const ov: Record<string, unknown> = { ...overridesDe(args) };
  if ("rotuloPt" in cambio) {
    if (cambio.rotuloPt == null) delete ov.size_ejes;
    else ov.size_ejes = cambio.rotuloPt;
  }
  if ("cifraPt" in cambio) {
    if (cambio.cifraPt == null) delete ov.size_texto_barras;
    else ov.size_texto_barras = Math.round(cambio.cifraPt * MM_POR_PT * 100) / 100;
  }
  if ("etiquetasPct" in cambio) {
    if (cambio.etiquetasPct == null) delete ov.canvas_w_etiquetas;
    else ov.canvas_w_etiquetas = Math.round(cambio.etiquetasPct) / 100;
  }
  if ("ejeLibre" in cambio) {
    if (cambio.ejeLibre) ov.usar_eje_libre = true;
    else delete ov.usar_eje_libre;
  }
  return Object.keys(ov).length ? ov : null;
}
