// Mata: un panel de diferencias declarado que el QA no recorre, o con la clase de superficie equivocada.
import { describe, expect, it } from "vitest";
import { PANELES_POR_MODULO } from "../../../../lib/navegacion/manifiesto";
import { PANELES_GRAFICOS, PANEL_DIFERENCIAS_INFORME, PANEL_DIFERENCIAS_LAMINA, PANEL_DIFERENCIAS_REGLA } from "../../panelesGraficos";

describe("paneles de Diferencias entre grupos (ADR 0126)", () => {
  it("tres paneles con su id y su clase", () => {
    expect([PANEL_DIFERENCIAS_REGLA, PANEL_DIFERENCIAS_LAMINA, PANEL_DIFERENCIAS_INFORME].map((p) => [p.id, p.clase])).toEqual([
      ["diferencias-regla", "dialogo"],
      ["diferencias-lamina", "popover"],
      ["diferencias", "sideover"],
    ]);
  });
  it("están en Gráficos y en el manifiesto de Procesamiento, sin ids repetidos", () => {
    const ids = PANELES_GRAFICOS.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(["diferencias-regla", "diferencias-lamina", "diferencias"]));
    const proc = (PANELES_POR_MODULO.procesamiento ?? []).map((p) => p.id);
    expect(proc).toEqual(expect.arrayContaining(["diferencias-regla", "diferencias-lamina", "diferencias"]));
    expect(new Set(proc).size).toBe(proc.length);
  });
});
