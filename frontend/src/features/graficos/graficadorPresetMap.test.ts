import { describe, expect, test } from "vitest";
import { graficadorToPresetType } from "./graficadorPresetMap";

describe("graficadorToPresetType", () => {
  test("mantiene aliases legacy compatibles con modos por slot", () => {
    expect(graficadorToPresetType("p_barras")).toBe("barras_agrupadas");
    expect(graficadorToPresetType("p_barras_agrupadas")).toBe("barras_agrupadas");
  });

  test("cubre el censo actual de 23 graficadores y aliases aplicables", () => {
    expect(Object.fromEntries([
      "p_barras_agrupadas",
      "p_barras_categoricas",
      "p_barras_apiladas",
      "p_barras_multiapiladas",
      "p_nube_palabras",
      "p_mapa_cobertura_territorial",
      "p_pie",
      "p_donut",
      "p_numerico",
      "p_histograma",
      "p_boxplot",
      "p_media_rango",
      "p_barras_divergentes",
      "p_dumbbell",
      "p_lollipop",
      "p_serie_temporal",
      "p_radar",
      "p_tabla",
      "p_dim_radar",
      "p_dim_heatmap",
      "p_dim_comparativo_radarbar",
      "p_dim_foda",
      "p_dim_heatmap_criterios",
    ].map((name) => [name, graficadorToPresetType(name)]))).toEqual({
      p_barras_agrupadas: "barras_agrupadas",
      p_barras_categoricas: "barras_categoricas",
      p_barras_apiladas: "barras_apiladas",
      p_barras_multiapiladas: "multi_apiladas",
      p_nube_palabras: "nube_palabras",
      p_mapa_cobertura_territorial: null,
      p_pie: "pie",
      p_donut: "donut",
      p_numerico: "barras_numericas",
      p_histograma: "histograma",
      p_boxplot: "boxplot",
      p_media_rango: "media_rango",
      p_barras_divergentes: "barras_divergentes",
      p_dumbbell: "dumbbell",
      p_lollipop: "lollipop",
      p_serie_temporal: "serie_temporal",
      p_radar: "radar_tabla",
      p_tabla: "radar_tabla",
      p_dim_radar: "dim_radar",
      p_dim_heatmap: "dim_heatmap",
      p_dim_comparativo_radarbar: null,
      p_dim_foda: "dim_foda",
      p_dim_heatmap_criterios: "dim_heatmap_criterios",
    });
    expect(graficadorToPresetType("p_radar_tabla")).toBe("radar_tabla");
    expect(graficadorToPresetType("p_dim_radar_tabla")).toBe("dim_radar");
  });

  test("da autoridad a preset_key incluso cuando declara ausencia", () => {
    expect(graficadorToPresetType("p_barras_agrupadas", "histograma")).toBe("histograma");
    expect(graficadorToPresetType("p_barras_agrupadas", "")).toBeNull();
    expect(graficadorToPresetType("p_desconocido", "serie_temporal")).toBe("serie_temporal");
  });
});
