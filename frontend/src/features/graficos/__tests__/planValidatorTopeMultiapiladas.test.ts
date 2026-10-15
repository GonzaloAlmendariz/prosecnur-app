import { describe, expect, test } from "vitest";
import type { Slide } from "../../../api/graficos";
import { validarPlan, type EntradaValidarPlan } from "../usePlanValidator";

// Gonzalo (2026-10-14): «mejor limitamos multiapiladas a 6 barras únicamente». El motor lo avisa; el plan no deja
// exportar una lámina que pase de seis.

const variables = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"].flatMap((name) => (
  ["docentes", "estudiantes"].map((source) => (
    { name, label: `Pregunta ${name}`, tipo: "select_one", seccion: "", list_name: "l", source }
  ))
));

function entrada(args: Record<string, unknown>, graficador = "p_barras_multiapiladas"): EntradaValidarPlan {
  const slides: Slide[] = [{ id: "s1", tipo: "p_slide_1_grafico", payload: { titulo: "Servicios", grafico: { graficador, args } } }];
  return {
    slides, presets: {}, wPresets: {}, overridesReusables: [], paletas: {}, iconos: [],
    slidesById: { p_slide_1_grafico: { titulo_humano: "Un gráfico", slots: ["grafico"] } },
    graficadoresById: {}, presetsByName: {}, variables, multi: true,
  };
}

const refs = (n: number) => Array.from({ length: n }, (_, i) => `docentes$p${i + 1}`);
const tope = (args: Record<string, unknown>, graficador?: string) =>
  validarPlan(entrada(args, graficador)).errors.find((e) => e.code === "multiapiladas-tope");

describe("una multiapilada lleva hasta seis barras", () => {
  test("seis preguntas exportan; siete bloquean con la cifra y lo que hay que hacer", () => {
    expect(tope({ modo: "var", vars: refs(6) })).toBeUndefined();
    const error = tope({ modo: "var", vars: refs(7) });
    expect(error?.message).toBe("Lámina 1 · “Servicios” (Un gráfico), espacio «Gráfico»: tiene 7 barras y una multiapilada lleva hasta 6. Divídela en dos láminas.");
    expect(error?.slideId).toBe("s1");
    expect(validarPlan(entrada({ modo: "var", vars: refs(7) })).canExport).toBe(false);
  });

  test("por públicos cuenta cada referencia de cada tema", () => {
    const tema = (p: string) => [`docentes$${p}`, `estudiantes$${p}`];
    expect(tope({ modo: "var_cruce", vars: { tema_1: tema("p1"), tema_2: tema("p2"), tema_3: tema("p3") } })).toBeUndefined();
    expect(tope({ modo: "var_cruce", vars: { tema_1: tema("p1"), tema_2: tema("p2"), tema_3: tema("p3"), tema_4: tema("p4") } })?.message)
      .toContain("tiene 8 barras");
  });

  test("bloques: suma; con un bloque por grupos dice «al menos»", () => {
    const bloques = [{ modo: "var", vars: refs(4) }, { modo: "var", vars: ["estudiantes$p1", "estudiantes$p2", "estudiantes$p3"] }];
    expect(tope({ modo: "multilista", bloques })?.message).toContain("tiene 7 barras");
    expect(tope({ modo: "multilista", bloques: [...bloques, { modo: "cruce", var: "docentes$p5", cruces: "docentes$p6" }] })?.message)
      .toContain("tiene al menos 7 barras");
  });

  test("lo que abre por grupos no se cuenta, y otros gráficos no tienen tope", () => {
    expect(tope({ modo: "var_cruce", vars: refs(7), cruces: "docentes$p7" })).toBeUndefined();
    expect(tope({ modo: "var", vars: refs(7) }, "p_barras_simples")).toBeUndefined();
  });
});
