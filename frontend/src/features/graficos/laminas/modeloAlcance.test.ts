import { describe, expect, it } from "vitest";
import type { Slide } from "../../../api/graficos";
import { conAjusteEnElTipo, esPropio, ranurasDelTipo, valorDelTipo } from "./modeloAlcance";

const slides = [
  { id: "a", tipo: "p_slide_1_grafico", payload: { grafico: { graficador: "p_barras_apiladas", args: { invertir_barras: true } } } },
  { id: "b", tipo: "p_slide_2_graficos", payload: { izquierda: { graficador: "p_barras_apiladas", args: {} }, derecha: { graficador: "p_pie", args: {} } } },
] as unknown as Slide[];

// O7b: «Sólo este gráfico» frente al tipo, y aplicar al tipo en un solo cambio.
describe("alcance de un ajuste", () => {
  it("el valor del tipo es su preset o el por defecto, y propio es distinto de él", () => {
    expect(valorDelTipo({}, "barras_apiladas", "invertir_barras", false)).toBe(false);
    expect(valorDelTipo({ barras_apiladas: { invertir_barras: true } }, "barras_apiladas", "invertir_barras", false)).toBe(true);
    expect(esPropio({ invertir_barras: true }, "invertir_barras", false)).toBe(true);
    expect(esPropio({ invertir_barras: false }, "invertir_barras", false)).toBe(false);
    expect(esPropio({}, "invertir_barras", false)).toBe(false);
  });

  it("las ranuras del tipo, también la de una lámina de dos gráficos", () => {
    expect(ranurasDelTipo(slides, "barras_apiladas")).toEqual([{ slideId: "a", slot: "grafico" }, { slideId: "b", slot: "izquierda" }]);
  });

  // Mata: aplicar sólo al preset (un ajuste que el motor lee del gráfico no cambiaría) o tocar gráficos de otro tipo.
  it("aplicar al tipo escribe el preset y cada gráfico del tipo, y deja los demás intactos", () => {
    const r = conAjusteEnElTipo({ presets: {}, slides }, "barras_apiladas", { invertir_barras: true });
    expect(r.presets).toEqual({ barras_apiladas: { invertir_barras: true } });
    const b = r.slides[1].payload as Record<string, { args: Record<string, unknown> }>;
    expect(b.izquierda.args.invertir_barras).toBe(true);
    expect(b.derecha.args).toEqual({});
    // Después de aplicar, ningún gráfico del tipo queda como propio.
    for (const { slideId, slot } of ranurasDelTipo(r.slides, "barras_apiladas")) {
      const args = ((r.slides.find((s) => s.id === slideId)!.payload as Record<string, { args: Record<string, unknown> }>)[slot]).args;
      expect(esPropio(args, "invertir_barras", valorDelTipo(r.presets, "barras_apiladas", "invertir_barras", false))).toBe(false);
    }
  });
});
