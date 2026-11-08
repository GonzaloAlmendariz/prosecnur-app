import { describe, expect, it } from "vitest";
import type { Slide } from "../../../../api/graficos";
import {
  esGraficoDeResumen, ORIGEN_LAMINA_RESUMEN,
  conClave, conClaves, esClave, leerPreguntasClave, marcadasDe, motivoNoCuenta, preguntasDelGrafico, primerGraficoConPregunta,
} from "./modeloPreguntasClave";

describe("modeloPreguntasClave (H14)", () => {
  it("lee lo guardado defensivamente: lista, texto suelto de R, objeto vacío y basura", () => {
    expect(leerPreguntasClave({ preguntas_clave: ["P1", " P2 ", "", "P1"] })).toEqual(["P1", "P2"]);
    expect(leerPreguntasClave({ preguntas_clave: "base$P1" as unknown as string[] })).toEqual(["base$P1"]);
    expect(leerPreguntasClave({ preguntas_clave: {} as unknown as string[] })).toEqual([]);
    expect(leerPreguntasClave({})).toEqual([]);
    expect(leerPreguntasClave(null)).toEqual([]);
  });

  it("marca y desmarca una referencia tal como la escribe el gráfico", () => {
    expect(conClave([], "P1", true)).toEqual(["P1"]);
    expect(conClave(["P1"], "P1", true)).toEqual(["P1"]);
    expect(conClave(["P1", "base$P2"], "P1", false)).toEqual(["base$P2"]);
    // `P2` y `base$P2` son referencias distintas: no se confunden.
    expect(esClave(["base$P2"], "P2")).toBe(false);
    expect(conClaves(["P9"], ["A", "B"], true)).toEqual(["P9", "A", "B"]);
    expect(conClaves(["P9", "A", "B"], ["A", "B"], false)).toEqual(["P9"]);
    expect(marcadasDe(["A", "Z"], ["A", "B"])).toBe(1);
  });

  it("las preguntas de un gráfico: su var, o cada una de vars; ni citas ni temas por público", () => {
    expect(preguntasDelGrafico("p_barras_agrupadas", { var: "P1", vars: ["X"] })).toEqual(["P1"]);
    expect(preguntasDelGrafico("p_barras_multiapiladas", { vars: ["A", "b$B", "A", 3] })).toEqual(["A", "b$B"]);
    expect(preguntasDelGrafico("p_citas", { var: "abierta" })).toEqual([]);
    expect(preguntasDelGrafico("p_barras_multiapiladas", { vars: { tema_1: ["d$p1", "e$p1"] } })).toEqual([]);
    expect(preguntasDelGrafico("p_dona", {})).toEqual([]);
  });

  it("el primer gráfico con pregunta, como lámina y ranura", () => {
    const slides: Slide[] = [
      { id: "s1", tipo: "p_slide_seccion", payload: { titulo: "S" } },
      { id: "s2", tipo: "p_slide_2_graficos", payload: { izquierda: { graficador: "p_citas", args: { var: "x" } }, derecha: { graficador: "p_dona", args: { var: "P5" } } } },
    ] as unknown as Slide[];
    const slots = { p_slide_seccion: [], p_slide_2_graficos: ["izquierda", "derecha"] };
    expect(primerGraficoConPregunta(slides, slots)).toEqual({ id: "s2", ranura: 2 });
    expect(primerGraficoConPregunta(slides.slice(0, 1), slots)).toBeNull();
    expect(primerGraficoConPregunta(slides, slots, () => false)).toBeNull();
  });

  it("qué gráficos cuentan para el resumen ejecutivo, como el motor (.resumen_dif_preguntas_plan)", () => {
    const base = { tipoLamina: "p_slide_1_grafico", graficador: "p_barras_agrupadas", args: { var: "P1" }, conTwoBox: false };
    expect(motivoNoCuenta(base)).toBeNull();
    expect(motivoNoCuenta({ ...base, tipoLamina: "p_slide_1_grafico_narrativo" })).toBeNull();
    expect(motivoNoCuenta({ ...base, tipoLamina: "p_slide_2_graficos" })).toBe("lamina");
    expect(motivoNoCuenta({ ...base, graficador: "p_lineas_nivel" })).toBe("tipo");
    expect(motivoNoCuenta({ ...base, graficador: "p_dicotomica" })).toBeNull();
    expect(motivoNoCuenta({ ...base, args: { var: "P1", cruces: ["sexo"] } })).toBe("cruce");
    expect(motivoNoCuenta({ ...base, args: { var: "P1", cruces: [] } })).toBeNull();
    expect(motivoNoCuenta({ ...base, args: { var: "P1", overrides: { cruces: "area" } } })).toBe("cruce");
    const bateria = { ...base, graficador: "p_barras_multiapiladas", args: { vars: ["A", "B"] } };
    expect(motivoNoCuenta(bateria)).toBe("sin_two_box");
    expect(motivoNoCuenta({ ...bateria, conTwoBox: true })).toBeNull();
    expect(motivoNoCuenta({ ...bateria, args: { vars: ["A"] } })).toBeNull();
  });
});

describe("R6-14: lámina del resumen ejecutivo", () => {
  it("se reconoce por su origen, su graficador, su estilo, su regla o sus base$*; una pregunta suelta no", () => {
    expect(esGraficoDeResumen({ origen: "resumen", graficador: "p_barras_agrupadas", args: { var: "p1" } })).toBe(true);
    expect(esGraficoDeResumen({ graficador: "p_panorama", args: {} })).toBe(true);
    expect(esGraficoDeResumen({ graficador: "p_dumbbell", args: { estilo: "resumen" } })).toBe(true);
    expect(esGraficoDeResumen({ graficador: "p_barras_divergentes", args: { regla: { tipo: "bajo_umbral" } } })).toBe(true);
    expect(esGraficoDeResumen({ graficador: "p_barras_multiapiladas", args: { vars: ["docentes$*"] } })).toBe(true);
    expect(esGraficoDeResumen({ graficador: "p_barras_agrupadas", args: { var: "p1", cruces: ["sexo"] } })).toBe(false);
  });
  it("el origen es el que pone el mazo", async () => {
    const { ORIGEN_RESUMEN } = await import("../mazoResumen/modeloMazo");
    expect(ORIGEN_LAMINA_RESUMEN).toBe(ORIGEN_RESUMEN);
  });
});
