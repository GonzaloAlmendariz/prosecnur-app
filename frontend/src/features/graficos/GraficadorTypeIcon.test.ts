import { describe, expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GraficadorTypeIcon } from "./GraficadorTypeIcon";
import { resolveGraphLucideIcon } from "./lucideRegistry";

const render = (props: Parameters<typeof GraficadorTypeIcon>[0]) =>
  renderToStaticMarkup(createElement(GraficadorTypeIcon, props));

describe("GraficadorTypeIcon (envoltorio de IconoTipo)", () => {
  test.each([
    "p_barras_agrupadas",
    "p_barras_categoricas",
    "p_barras_apiladas",
    "p_dim_comparativo_radarbar",
    "p_mapa_cobertura_territorial",
  ])("delega %s en el sistema de íconos, sin lucide", (name) => {
    const markup = render({ name, iconoUi: "ChartColumn", size: 12 });
    expect(markup).toContain(`data-icono-tipo="${name}"`);
    expect(markup).not.toContain("lucide-");
  });

  test("FODA (retirado del selector) muestra el marco punteado, no lucide", () => {
    const markup = render({ name: "p_dim_foda", iconoUi: "Grid2X2" });
    expect(markup).toContain('data-icono-desconocido="true"');
    expect(markup).not.toContain("lucide-");
  });

  test.each([
    "ChartColumn",
    "Cloud",
    "Map",
    "ChartColumnStacked",
    "AlignHorizontalJustifyCenter",
    "MoveHorizontal",
    "ListOrdered",
    "TrendingUp",
  ])("un graficador fuera del registro resuelve el lucide real %s sin caer en Square", (iconoUi) => {
    expect(resolveGraphLucideIcon(iconoUi, "Square")).not.toBe(resolveGraphLucideIcon("Square", "Square"));
    expect(render({ name: `p_contract_${iconoUi}`, iconoUi, size: 14 })).toContain("lucide-");
  });
});
