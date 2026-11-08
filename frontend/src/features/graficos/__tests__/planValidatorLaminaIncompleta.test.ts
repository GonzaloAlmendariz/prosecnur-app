import { describe, expect, test } from "vitest";
import type { Slide } from "../../../api/graficos";
import { validarPlan, type EntradaValidarPlan } from "../usePlanValidator";
import { agruparAvisos, totalAvisos } from "../laminas/resumenInforme";
import { FALTA_INDICADOR } from "../laminas/faltaLamina";

// Ronda 5: la maqueta decía lo que le faltaba a la lámina (un contraste sin indicador) y la barra seguía en «0 avisos».

const entrada = (slides: Slide[]): EntradaValidarPlan => ({
  slides, presets: {}, wPresets: {}, overridesReusables: [], paletas: {}, iconos: [],
  slidesById: {}, graficadoresById: {}, presetsByName: {}, variables: [], multi: false,
});
const conGrafico = (id: string, graficador: string, args: Record<string, unknown>): Slide => ({
  id, tipo: "p_slide_1_grafico", payload: { titulo: "Contraste", grafico: { graficador, args } },
});

describe("lámina incompleta", () => {
  test("un contraste sin indicador entra al conteo con el texto de la maqueta y lleva a la lámina", () => {
    const slides = [
      { id: "p", tipo: "p_slide_portada", payload: { titulo: "Informe" } } as Slide,
      conGrafico("c", "p_dumbbell", { estilo: "resumen", cruce: null, bases: ["a", "b"] }),
    ];
    const r = validarPlan(entrada(slides));
    const issue = r.issues.filter((i) => i.code === "lamina-incompleta");
    expect(issue).toHaveLength(1);
    expect(issue[0].slideId).toBe("c");
    expect(issue[0].detalle).toBe(FALTA_INDICADOR);
    expect(issue[0].message).toMatch(/^Lámina 2.*: marca qué respuestas suman el indicador\.$/);
    expect(r.canExport).toBe(false);
    expect(totalAvisos(agruparAvisos(r.issues, {}, slides.map((s) => s.id)))).toBe(1);
  });

  test("uno por lámina aunque falten varias cosas, y nada cuando no falta nada", () => {
    const sinNada = validarPlan(entrada([conGrafico("b", "p_dumbbell", { estilo: "resumen", vars: ["docentes$*"], regla: { tipo: "mayor_diferencia", n: 10 } })]));
    expect(sinNada.issues.filter((i) => i.code === "lamina-incompleta")).toHaveLength(1);
    expect(sinNada.issues[0].detalle).toMatch(/pregunta que define/);
    const completa = validarPlan(entrada([conGrafico("k", "p_panorama", { corte: ["4", "5"] })]));
    expect(completa.issues).toHaveLength(0);
    expect(totalAvisos(agruparAvisos(completa.issues, {}, ["k"]))).toBe(0);
  });
});
