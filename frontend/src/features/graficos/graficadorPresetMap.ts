// Mapeo graficador R → tipo de preset. Usado para filtrar overrides
// compatibles en GraficadorSlot y por el OverridesEditor para elegir
// qué args mostrar cuando se edita un override de cierto tipo.
//
// Fuente de verdad: inspección de los graficadores en
// `prosecnur/R/reporte_plan_slides.R` y los tipos declarados en
// `p_presets()`. Un graficador puede no tener preset tipo asociado
// (ej. p_dim_comparativo_radarbar usa args propios sin preset heredable);
// en ese caso retornamos `null` y el slot no ofrece overrides.

const MAP: Record<string, string | null> = {
  p_barras_apiladas:           "barras_apiladas",
  p_barras_agrupadas:          "barras_agrupadas",
  p_barras_multiapiladas:      "multi_apiladas",
  p_pie:                        "pie",
  p_donut:                      "donut",
  p_numerico:                   "barras_numericas",
  p_boxplot:                    "boxplot",
  p_media_rango:                "media_rango",
  p_radar_tabla:                "radar_tabla",
  p_dim_radar:                  "dim_radar",
  p_dim_radar_tabla:            "dim_radar",
  p_dim_heatmap:                "dim_heatmap",
  p_dim_heatmap_criterios:      "dim_heatmap_criterios",
  p_dim_foda:                   "dim_foda",
  p_dim_comparativo_radarbar:   null,
};

export function graficadorToPresetType(graficador: string | undefined): string | null {
  if (!graficador) return null;
  return MAP[graficador] ?? null;
}
