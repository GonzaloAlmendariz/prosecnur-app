import { describe, expect, test } from "vitest";
import type { Slide } from "../../../../api/graficos";
import { validarPlan, type EntradaValidarPlan } from "../../usePlanValidator";
import { baseDeLaPregunta, baseDeRef, cruceEnOtraBase, patchFijarBaseCruce, textoCruceEnOtraBase } from "./baseDelCruce";

// R7-1: en Arte (informe conjunto de tres bases) la pregunta era estudiantes$p5 y «Dividir por» ofrecía las 94 de
// docentes; elegida una, el motor dibujaba un muro de códigos con 0 avisos.

const VARS = [
  { source: "docentes", name: "p4" }, { source: "docentes", name: "sexo" },
  { source: "estudiantes", name: "p5" }, { source: "estudiantes", name: "sexo" },
];

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
    const otra = cruceEnOtraBase({ var: "estudiantes$p5", cruces: "docentes$p4" }, VARS);
    expect(otra).toEqual({ arg: "cruces", cruce: "docentes$p4", baseCruce: "docentes", basePregunta: "estudiantes", existeEnBasePregunta: false });
    expect(textoCruceEnOtraBase(otra!)).toBe('"Dividir por" es de la base docentes y no existe en estudiantes, la base de la pregunta. Elige una pregunta de estudiantes para dividir.');
    expect(cruceEnOtraBase({ var: "estudiantes$p5", cruces: ["estudiantes$p2"] })).toBeNull();
    expect(cruceEnOtraBase({ var: "estudiantes$p5", cruces: "p2" })).toBeNull();
    expect(cruceEnOtraBase({ var: "estudiantes$p5" })).toBeNull();
    expect(cruceEnOtraBase({ vars: ["docentes$p1"], cruce: "estudiantes$p3" })?.arg).toBe("cruce");
  });

  test("R7-18: el prefijo escrito de otra forma (mayúsculas) no es otra base", () => {
    expect(cruceEnOtraBase({ var: "estudiantes$p5", cruces: "Estudiantes$sexo" }, VARS)).toBeNull();
    expect(cruceEnOtraBase({ var: "ESTUDIANTES$p5", cruces: "estudiantes$sexo" }, VARS)).toBeNull();
  });

  test("R7-18: un público hermano con la misma columna es aviso con «Fijar base», no error", () => {
    const args = { var: "estudiantes$p5", cruces: ["docentes$sexo"] };
    const otra = cruceEnOtraBase(args, VARS)!;
    expect(otra.existeEnBasePregunta).toBe(true);
    expect(textoCruceEnOtraBase(otra)).toBe('"Dividir por" está escrito con la base docentes; la lámina lo lee en estudiantes, la base de la pregunta.');
    expect(patchFijarBaseCruce(args, otra)).toEqual({ cruces: ["estudiantes$sexo"] });
  });

  test("el plan viejo con el cruce de otra base lleva error que bloquea el export, con su lámina y su espacio", () => {
    const slides: Slide[] = [{ id: "s6", tipo: "p_slide_1_grafico", payload: { titulo: "Perfil", grafico: { graficador: "p_barras_agrupadas", args: { var: "estudiantes$p5", cruces: "docentes$p4" } } } }];
    const entrada: EntradaValidarPlan = {
      slides, presets: {}, wPresets: {}, overridesReusables: [], paletas: {}, iconos: [],
      slidesById: { p_slide_1_grafico: { slots: ["grafico"], titulo_humano: "Un gráfico" } },
      graficadoresById: {}, presetsByName: {}, variables: VARS.map((v) => ({ ...v, label: v.name, tipo: "select_one x", seccion: "" })), multi: true,
    };
    const r = validarPlan(entrada);
    const issue = r.issues.filter((i) => i.code === "cruce-otra-base");
    expect(issue).toHaveLength(1);
    expect(issue[0]).toMatchObject({ severity: "error", slideId: "s6", slotName: "grafico" });
    expect(r.canExport).toBe(false);
    // R7-18: con la columna en la base de la pregunta, aviso; el export no se bloquea.
    const hermano = validarPlan({ ...entrada, slides: [{ ...slides[0], payload: { titulo: "Perfil", grafico: { graficador: "p_barras_agrupadas", args: { var: "estudiantes$p5", cruces: "docentes$sexo" } } } }] });
    expect(hermano.issues.filter((i) => i.code === "cruce-otra-base").map((i) => i.severity)).toEqual(["warning"]);
    expect(hermano.issues.filter((i) => i.severity === "error" && i.code === "cruce-otra-base")).toHaveLength(0);
    const sana = validarPlan({ ...entrada, slides: [{ ...slides[0], payload: { titulo: "Perfil", grafico: { graficador: "p_barras_agrupadas", args: { var: "estudiantes$p5", cruces: "estudiantes$p4" } } } }] });
    expect(sana.issues.filter((i) => i.code === "cruce-otra-base")).toHaveLength(0);
  });
});
