import { describe, expect, it } from "vitest";
import { citaCorta, notasEnTitulo } from "./notaEnTitulo";
import { validarPlan } from "../usePlanValidator";
import type { Slide } from "../../../api/graficos";

describe("nota en el título (D4): se avisa, no se quita", () => {
  it("encuentra corchetes y etiquetas HTML tal como vienen", () => {
    const t = "¿Conoce la misión de la PUCP ? [Entiéndase los propósitos como los lineamientos.]";
    expect(notasEnTitulo(t)).toEqual(["[Entiéndase los propósitos como los lineamientos.]"]);
    expect(notasEnTitulo("Satisfacción <b>general</b>")).toEqual(["<b>", "</b>"]);
    expect(notasEnTitulo("Sin notas (2026)")).toEqual([]);
    expect(citaCorta("[Entiéndase los propósitos de la PUCP como los lineamientos que orientan]")).toMatch(/^\[Entiéndase.*…\]$/);
  });

  it("el validador avisa con el fragmento y el título del plan sigue igual", () => {
    const titulo = "Misión [Entiéndase los propósitos]";
    const slide = { id: "s1", tipo: "p_slide_1_grafico", payload: { titulo, grafico: null } } as unknown as Slide;
    const r = validarPlan({ slides: [slide], presets: {}, wPresets: {}, overridesReusables: [], paletas: {}, iconos: [],
      slidesById: { p_slide_1_grafico: { slots: ["grafico"], titulo_humano: "Un gráfico" } }, graficadoresById: {}, presetsByName: {},
      variables: [], multi: false });
    const aviso = r.issues.find((i) => i.code === "titulo-con-nota");
    expect(aviso?.message).toContain("«[Entiéndase los propósitos]»");
    expect((slide.payload as { titulo: string }).titulo).toBe(titulo);
  });
});
