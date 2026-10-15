import { describe, expect, it } from "vitest";
import type { Slide } from "../../../api/graficos";
import { AJUSTES_WORD, ajustesSobrantes, sinSobrantes, tiposDelInforme } from "./ajustesWord";

// O7a: Word, Gráficos ofrece sólo lo que cambia el documento y avisa lo guardado que ya no se usa.
describe("ajustes del Word", () => {
  it("los tipos del informe, sin repetir y en orden", () => {
    const s = (tipo: string, payload: Record<string, unknown>) => ({ id: tipo, tipo, payload }) as unknown as Slide;
    expect(tiposDelInforme([
      s("p_slide_1_grafico", { grafico: { graficador: "p_pie" } }),
      s("p_slide_2_graficos", { izquierda: { graficador: "p_barras_apiladas" }, derecha: { graficador: "p_pie" } }),
      s("p_slide_portada", { titulo: "x" }),
    ])).toEqual(["pie", "barras_apiladas"]);
  });

  // Mata: dejar ofrecido o sin avisar un decimal del Word que pisa Reglas (O2), o tipo_pie / bins (O3).
  it("decimales, método, tipo de torta y bins nunca son ajustes del Word; sí se avisan si estaban guardados", () => {
    const todos = Object.values(AJUSTES_WORD).flat().map((a) => a.arg);
    for (const prohibido of ["decimales", "metodo_redondeo", "decimales_pct", "valores_decimales", "tipo_pie", "bins", "ancho_bin"]) {
      expect(todos).not.toContain(prohibido);
    }
    const sob = ajustesSobrantes({ pie: { decimales_pct: 1, tipo_pie: "donut" }, barras_apiladas: { mostrar_barra_extra: false, canvas_w_extra: 2 } });
    expect(sob).toEqual([{ tipo: "pie", arg: "decimales_pct" }, { tipo: "pie", arg: "tipo_pie" }, { tipo: "barras_apiladas", arg: "canvas_w_extra" }]);
  });

  it("quitar los sobrantes los devuelve al valor por defecto y no toca lo demás", () => {
    const actual = { pie: { decimales_pct: 1, otro: "x" }, barras_apiladas: { canvas_w_extra: 2, mostrar_barra_extra: false } };
    const defaults = { barras_apiladas: { canvas_w_extra: 1.2 } };
    expect(sinSobrantes(actual, defaults, [{ tipo: "pie", arg: "decimales_pct" }, { tipo: "barras_apiladas", arg: "canvas_w_extra" }]))
      .toEqual({ pie: { otro: "x" }, barras_apiladas: { canvas_w_extra: 1.2, mostrar_barra_extra: false } });
  });
});
