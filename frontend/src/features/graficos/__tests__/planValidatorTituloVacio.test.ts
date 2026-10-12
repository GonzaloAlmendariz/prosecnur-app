import { describe, expect, test } from "vitest";
import type { Slide } from "../../../api/graficos";
import { validarPlan, type EntradaValidarPlan } from "../usePlanValidator";

// Mazo de Arte y Diseño (2026-10-12): 12 de 17 láminas de equivalencias sin enunciado salían del PowerPoint tituladas
// con su primera pregunta («Servicio de salud» sobre una lámina que también trae Bienestar Psicológico) y el panel
// decía «0 avisos».

const grafico = (vars: string[]) => ({ graficador: "p_barras_multiapiladas", args: { vars } });

function entrada(slides: Slide[]): EntradaValidarPlan {
  return {
    slides, presets: {}, wPresets: {}, overridesReusables: [], paletas: {}, iconos: [],
    slidesById: { p_slide_1_grafico: { titulo_humano: "Un gráfico", slots: ["grafico"] } },
    graficadoresById: {}, presetsByName: {},
    variables: [
      { name: "p12_1", label: "Servicio de salud", tipo: "select_one", seccion: "", list_name: "l", source: "docentes" },
      { name: "p12_2", label: "Servicio de Bienestar Psicológico", tipo: "select_one", seccion: "", list_name: "l", source: "docentes" },
    ],
    multi: true,
  };
}

describe("lámina sin título", () => {
  test("con varias preguntas avisa, nombrando la lámina por su número", () => {
    const r = validarPlan(entrada([{ id: "s1", tipo: "p_slide_1_grafico", payload: { titulo: "", grafico: grafico(["docentes$p12_1", "docentes$p12_2"]) } }]));
    const aviso = r.warnings.find((w) => w.code === "titulo-vacio");
    expect(aviso?.message).toBe("Lámina 1 (Un gráfico): no tiene título. El PowerPoint la titularía con su primera pregunta, que nombra sólo uno de sus 2 temas; escríbele uno.");
    expect(aviso?.slideId).toBe("s1");
    expect(r.canExport).toBe(true);
  });

  test("cuenta los temas de una lámina de equivalencias (vars por tema)", () => {
    const porTema = { graficador: "p_barras_multiapiladas", args: { modo: "var_cruce", vars: { tema_1: ["docentes$p12_1"], tema_2: ["docentes$p12_2"], tema_3: ["docentes$p12_3"] } } };
    const r = validarPlan(entrada([{ id: "s1", tipo: "p_slide_1_grafico", payload: { titulo: "", grafico: porTema } }]));
    expect(r.warnings.find((w) => w.code === "titulo-vacio")?.message).toContain("sus 3 temas");
    const unTema = { ...porTema, args: { modo: "var_cruce", vars: { tema_1: ["docentes$p3", "estudiantes$p3"] } } };
    expect(validarPlan(entrada([{ id: "s2", tipo: "p_slide_1_grafico", payload: { titulo: "", grafico: unTema } }])).issues.some((w) => w.code === "titulo-vacio")).toBe(false);
  });

  test("con una sola pregunta, o con título, no avisa", () => {
    const r = validarPlan(entrada([
      { id: "s1", tipo: "p_slide_1_grafico", payload: { titulo: "", grafico: grafico(["docentes$p12_1"]) } },
      { id: "s2", tipo: "p_slide_1_grafico", payload: { titulo: "Servicios", grafico: grafico(["docentes$p12_1", "docentes$p12_2"]) } },
    ]));
    expect(r.issues.some((w) => w.code === "titulo-vacio")).toBe(false);
  });
});
