import { describe, expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GraficadorTypeIcon, graficadorIconVariant } from "./GraficadorTypeIcon";

describe("graficadorIconVariant", () => {
  test("asigna pictogramas especificos a graficadores basicos", () => {
    expect(graficadorIconVariant("p_barras_agrupadas")).toBe("barras-agrupadas");
    expect(graficadorIconVariant("p_barras_apiladas")).toBe("barras-apiladas");
    expect(graficadorIconVariant("p_barras_multiapiladas")).toBe("multi-apiladas");
    expect(graficadorIconVariant("p_pie")).toBe("pie");
    expect(graficadorIconVariant("p_donut")).toBe("donut");
    expect(graficadorIconVariant("p_boxplot")).toBe("boxplot");
    expect(graficadorIconVariant("p_radar")).toBe("radar");
    expect(graficadorIconVariant("p_tabla")).toBe("tabla");
  });

  test("asigna pictogramas especificos a graficadores dimensionales", () => {
    expect(graficadorIconVariant("p_dim_radar")).toBe("dim-radar");
    expect(graficadorIconVariant("p_dim_radar_tabla")).toBe("dim-radar-tabla");
    expect(graficadorIconVariant("p_dim_heatmap")).toBe("dim-heatmap");
    expect(graficadorIconVariant("p_dim_comparativo_radarbar")).toBe("dim-radarbar");
    expect(graficadorIconVariant("p_dim_foda")).toBe("dim-foda");
    expect(graficadorIconVariant("p_dim_heatmap_criterios")).toBe("dim-heatmap-criterios");
  });

  test("usa fallback Lucide para graficadores futuros", () => {
    expect(graficadorIconVariant("p_grafico_nuevo")).toBeNull();
  });

  test("renderiza pictogramas SVG compactos para graficadores conocidos", () => {
    const markup = renderToStaticMarkup(createElement(GraficadorTypeIcon, {
      name: "p_dim_comparativo_radarbar",
      size: 25,
    }));

    expect(markup).toContain("<svg");
    expect(markup).toContain('viewBox="0 0 24 24"');
  });
});
