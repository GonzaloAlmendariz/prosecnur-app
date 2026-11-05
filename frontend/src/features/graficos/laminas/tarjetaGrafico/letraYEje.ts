// Letra y eje de las barras agrupadas (U12 del checklist de mandos del mazo, 2026-11-05). La lámina nativa lee del
// gráfico, y sólo de sus `overrides` (no del preset), `size_ejes` en puntos y `size_texto_barras` en milímetros
// (api/R/lamina_tamanos_declarados.R) y `usar_eje_libre`, que deja la escala al máximo observado en vez de 0 a 100 %
// (graficador_barras_agrupadas.R, `escala_completa`; lamina_barras_ancho.R). Ninguno es formal de `p_barras_agrupadas()`,
// así que viajan por `overrides`. La tarjeta habla en puntos: la cifra se guarda en milímetros. Puro.

type Valores = Readonly<Record<string, unknown>>;

export const GRAFICADORES_LETRA_Y_EJE: ReadonlySet<string> = new Set(["p_barras_agrupadas"]);

/** Rango de la letra en la tarjeta, en puntos. */
export const LETRA_MIN_PT = 8;
export const LETRA_MAX_PT = 20;
export const LETRA_PASO_PT = 0.5;

const MM_POR_PT = 25.4 / 72;

export type LetraYEje = { rotuloPt: number | null; cifraPt: number | null; ejeLibre: boolean };

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
  return {
    rotuloPt: positivo(ov.size_ejes),
    cifraPt: mm === null ? null : alMedioPunto(mm / MM_POR_PT),
    ejeLibre: ov.usar_eje_libre === true,
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
  if ("ejeLibre" in cambio) {
    if (cambio.ejeLibre) ov.usar_eje_libre = true;
    else delete ov.usar_eje_libre;
  }
  return Object.keys(ov).length ? ov : null;
}
