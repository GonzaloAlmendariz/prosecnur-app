import { describe, expect, test } from "vitest";
import type { Slide } from "../../../../api/graficos";
import { validarPlan, type EntradaValidarPlan } from "../../usePlanValidator";
import { baseDeLaPregunta, baseDeRef, cruceEnOtraBase, textoCruceEnOtraBase } from "./baseDelCruce";

// R7-1: en Arte (informe conjunto de tres bases) la pregunta era estudiantes$p5 y «Dividir por» ofrecía las 94 de
// docentes; elegida una, el motor dibujaba un muro de códigos con 0 avisos.

describe("la base del cruce", () => {
  test("lee la base de la pregunta de `var` o de `vars` cuando todas comparten una", () => {
    expect(baseDeRef("estudiantes$p5")).toBe("estudiantes");
    expect(baseDeRef("p5")).toBeNull();
    expect(baseDeLaPregunta({ var: "estudiantes$p5" })).toBe("estudiantes");
    expect(baseDeLaPregunta({ vars: ["docentes$p1", "docentes$p2"] })).toBe("docentes");
    expect(baseDeLaPregunta({ vars: ["docentes$p1", "estudiantes$p1"] })).toBeNull();
    expect(baseDeLaPregunta({ var: "p5" })).toBeNull();
  });

  test("un cruce de otra base se detecta; uno de la misma o sin prefijo, no", () => {
    const otra = cruceEnOtraBase({ var: "estudiantes$p5", cruces: "docentes$p4" });
    expect(otra).toEqual({ arg: "cruces", cruce: "docentes$p4", baseCruce: "docentes", basePregunta: "estudiantes" });
    expect(textoCruceEnOtraBase(otra!)).toBe('"Dividir por" es de la base docentes y la pregunta de la base estudiantes. Elige una pregunta de estudiantes para dividir.');
    expect(cruceEnOtraBase({ var: "estudiantes$p5", cruces: ["estudiantes$p2"] })).toBeNull();
    expect(cruceEnOtraBase({ var: "estudiantes$p5", cruces: "p2" })).toBeNull();
    expect(cruceEnOtraBase({ var: "estudiantes$p5" })).toBeNull();
    expect(cruceEnOtraBase({ vars: ["docentes$p1"], cruce: "estudiantes$p3" })?.arg).toBe("cruce");
  });

  test("el plan viejo con el cruce de otra base lleva error que bloquea el export, con su lámina y su espacio", () => {
    const slides: Slide[] = [{ id: "s6", tipo: "p_slide_1_grafico", payload: { titulo: "Perfil", grafico: { graficador: "p_barras_agrupadas", args: { var: "estudiantes$p5", cruces: "docentes$p4" } } } }];
    const entrada: EntradaValidarPlan = {
      slides, presets: {}, wPresets: {}, overridesReusables: [], paletas: {}, iconos: [],
      slidesById: { p_slide_1_grafico: { slots: ["grafico"], titulo_humano: "Un gráfico" } },
      graficadoresById: {}, presetsByName: {}, variables: [], multi: false,
    };
    const r = validarPlan(entrada);
    const issue = r.issues.filter((i) => i.code === "cruce-otra-base");
    expect(issue).toHaveLength(1);
    expect(issue[0]).toMatchObject({ severity: "error", slideId: "s6", slotName: "grafico" });
    expect(r.canExport).toBe(false);
    const sana = validarPlan({ ...entrada, slides: [{ ...slides[0], payload: { titulo: "Perfil", grafico: { graficador: "p_barras_agrupadas", args: { var: "estudiantes$p5", cruces: "estudiantes$p4" } } } }] });
    expect(sana.issues.filter((i) => i.code === "cruce-otra-base")).toHaveLength(0);
  });
});
