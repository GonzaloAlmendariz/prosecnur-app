import { describe, expect, test } from "vitest";
import type { Slide, SlideType } from "../../../api/graficos";
import { laminasDelMazo, proponerMazo, type EntradaMazo } from "../laminas/mazoResumen/modeloMazo";
import { SLIDE_GRAF_SLOTS } from "../store";
import { _checkVarRefs, validarPlan, type EntradaValidarPlan } from "../usePlanValidator";
import type { VarWithSource } from "../useVariables";

// Las láminas de resumen leen `base$*` (todas las preguntas de escala de un público, ADR 0135 §2). Hasta este fix el
// validador lo tomaba por una pregunta llamada «*» y cada lámina insertada desde el mazo nacía con «la pregunta
// «docentes$*» no está en el instrumento».

const v = (name: string, source: string): VarWithSource => ({ name, label: name, tipo: "select_one", seccion: "", list_name: "l", source });
const variables: VarWithSource[] = [v("p1", "docentes"), v("p2", "docentes"), v("p1", "estudiantes")];
const bases = new Set(["docentes", "estudiantes"]);

const ARGS: Record<string, string[]> = {
  p_panorama: ["vars", "corte", "corte_etiqueta", "regla", "referencia"],
  p_dumbbell: ["cruce", "grupos", "corte", "corte_etiqueta", "regla", "estilo", "orden"],
  p_barras_divergentes: ["var", "vars", "regla", "estilo", "orden"],
  p_fortalezas: ["vars", "corte", "corte_etiqueta", "n", "regla", "universos"],
  p_cobertura: ["bases", "universos", "metas", "extras"],
};

const mazo: EntradaMazo = {
  estudio: { bases: ["docentes", "estudiantes"], baseActiva: "docentes" },
  publicos: ["docentes", "estudiantes"],
  graficadores: new Set(Object.keys(ARGS)),
  laminas: new Set(["p_slide_1_grafico"]),
  tiposInsertables: new Set(Object.keys(SLIDE_GRAF_SLOTS) as SlideType[]),
  admiteArg: (g, arg) => (ARGS[g] ?? []).includes(arg),
  indicador: null,
  referencia: 60,
};

function entrada(slides: Slide[]): EntradaValidarPlan {
  return {
    slides, presets: {}, wPresets: {}, overridesReusables: [], paletas: {}, iconos: [],
    slidesById: { p_slide_1_grafico: { titulo_humano: "Un gráfico", slots: ["grafico"], slot_specs: [] } },
    graficadoresById: {}, presetsByName: {}, variables, multi: true,
  };
}

describe("el validador reconoce `base$*` como comodín de público", () => {
  test("el comodín de una base del estudio no avisa; el de una base que no existe, sí", () => {
    const graf = { graficador: "p_panorama", args: { vars: ["docentes$*", "estudiantes$*", "fantasma$*", "docentes$p9"] } };
    expect(_checkVarRefs(graf, new Set(["docentes$p1"]), bases)).toEqual(["fantasma$*", "docentes$p9"]);
  });

  test("sin bases, el comportamiento anterior: el comodín no se reconoce", () => {
    expect(_checkVarRefs({ graficador: "p_panorama", args: { vars: ["docentes$*"] } }, new Set())).toEqual(["docentes$*"]);
  });

  test("las láminas que inserta el mazo, todas, no dan ningún var-unknown", () => {
    let i = 0;
    const propuestas = proponerMazo(mazo);
    const slides = laminasDelMazo(propuestas, Object.fromEntries(propuestas.map((p) => [p.id, true as const])), () => `s-${++i}`);
    expect(slides.length).toBeGreaterThan(3);
    expect(slides.some((s) => JSON.stringify(s.payload).includes("$*"))).toBe(true);
    const r = validarPlan(entrada(slides));
    expect(r.warnings.filter((w) => w.code === "var-unknown")).toEqual([]);
  });

  test("una lámina con `fantasma$*` sigue avisando", () => {
    const slides: Slide[] = [{ id: "s1", tipo: "p_slide_1_grafico", payload: { titulo: "x", grafico: { graficador: "p_panorama", args: { vars: ["fantasma$*"] } } } }];
    const r = validarPlan(entrada(slides));
    expect(r.warnings.filter((w) => w.code === "var-unknown")).toHaveLength(1);
  });
});
