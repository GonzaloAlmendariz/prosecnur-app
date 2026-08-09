// Mapeo graficador R → tipo de preset. Usado para filtrar overrides
// compatibles en GraficadorSlot y por el OverridesEditor para elegir
// qué args mostrar cuando se edita un override de cierto tipo.
//
// Este mapa ya no es la autoridad para metadata del registry: `preset_key`
// manda cuando viene en el wire. El mapa queda como compatibilidad para refs
// legacy o referencias que todavía no tienen una entrada de registry.

const MAP: Record<string, string | null> = {
  // Alias legacy en planes guardados antes de separar barras agrupadas/apiladas.
  // El backend lo normaliza igual para preview/export; la UI debe mostrar
  // los mismos modos disponibles en slots antiguos.
  p_barras:                     "barras_agrupadas",
  p_barras_apiladas:           "barras_apiladas",
  p_barras_agrupadas:          "barras_agrupadas",
  p_barras_categoricas:         "barras_categoricas",
  p_barras_multiapiladas:      "multi_apiladas",
  p_nube_palabras:              "nube_palabras",
  p_mapa_cobertura_territorial: null,
  p_pie:                        "pie",
  p_donut:                      "donut",
  p_numerico:                   "barras_numericas",
  p_histograma:                 "histograma",
  p_boxplot:                    "boxplot",
  p_media_rango:                "media_rango",
  p_barras_divergentes:         "barras_divergentes",
  p_puntos_comparativos:        "puntos_comparativos",
  p_dumbbell:                   "dumbbell",
  p_lollipop:                   "lollipop",
  p_serie_temporal:             "serie_temporal",
  // p_radar y p_tabla son wrappers de p_radar_tabla; comparten el mismo
  // preset tipo porque todos los args de estilo viven en el mismo lugar.
  p_radar:                      "radar_tabla",
  p_tabla:                      "radar_tabla",
  p_radar_tabla:                "radar_tabla",  // por compat con planes viejos
  p_dim_radar:                  "dim_radar",
  p_dim_radar_tabla:            "dim_radar",
  p_dim_heatmap:                "dim_heatmap",
  p_dim_heatmap_criterios:      "dim_heatmap_criterios",
  p_dim_foda:                   "dim_foda",
  p_dim_comparativo_radarbar:   null,
};

export function graficadorToPresetType(
  graficador: string | undefined,
  registryPresetKey?: string,
): string | null {
  if (registryPresetKey !== undefined) return registryPresetKey.trim() || null;
  if (!graficador) return null;
  return MAP[graficador] ?? null;
}
