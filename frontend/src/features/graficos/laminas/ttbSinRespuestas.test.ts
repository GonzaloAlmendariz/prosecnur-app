// CCSS-UI-1 (QA de CCSS, 2026-10-24): «el Top Two Box está encendido pero sin sus respuestas; el PowerPoint sale sin la
// columna» salía en láminas cuyo PowerPoint sí trae la columna o donde el motor no la pide. El aviso dice lo que hace el
// motor (`.box_decidir`, graficador_box_cobertura.R): las respuestas se leen de `overrides` o de los args (los args
// entran como `...` y `overrides` manda), y sin declararlas sólo avisa en una escala con orden de 3 o más respuestas.
import { describe, expect, it } from "vitest";
import type { Slide } from "../../../api/graficos";
import { validarPlan, type EntradaValidarPlan } from "../usePlanValidator";
import { leerTwoBox } from "./tarjetaGrafico/twoBox";

const CALIDAD = ["Muy malo", "Malo", "Regular", "Bueno", "Muy bueno"];
const v = (name: string, labels: string[]) =>
  ({ name, source: "default", label: name, list_name: `l_${name}`, tipo: "select_one", seccion: "", choices: labels.map((l, i) => ({ name: String(i + 1), label: l })), n_non_empty: 100 });
const VARS = [v("calidad", CALIDAD), v("beca", ["Sí", "No"]), v("carrera", ["Sociología", "Antropología", "Ciencia Política"]), v("sexo", ["Mujer", "Hombre"])] as never[];
const slide = (id: string, graficador: string, args: Record<string, unknown>) =>
  ({ id, tipo: "p_slide_1_grafico", payload: { titulo: "T", grafico: { graficador, args } } }) as unknown as Slide;
const avisosTtb = (...slides: Slide[]) => validarPlan({
  slides, presets: {}, wPresets: {}, overridesReusables: [], paletas: {}, iconos: [], slidesById: {}, graficadoresById: {},
  presetsByName: {}, variables: VARS, multi: false,
} as unknown as EntradaValidarPlan).warnings.filter((w) => w.code === "ttb-sin-respuestas").map((w) => w.slideId);

describe("CCSS-UI-1 · Top Two Box sin respuestas, como lo decide el motor", () => {
  it("apiladas con las respuestas en los args (no en overrides): las lee y no avisa", () => {
    const args = { var: "calidad", cruces: "sexo", barra_extra: ["top2box"], top2box_labels: ["Bueno", "Muy bueno"] };
    expect(leerTwoBox("p_barras_apiladas", args, {})?.top.etiquetas).toEqual(["Bueno", "Muy bueno"]);
    expect(avisosTtb(slide("ccss-038", "p_barras_apiladas", args))).toEqual([]);
  });

  it("overrides manda sobre los args, como en el motor", () => {
    const args = { var: "calidad", top2box_labels: ["Bueno", "Muy bueno"], overrides: { barra_extra: "top2box", top2box_labels: ["Regular"] } };
    expect(leerTwoBox("p_barras_apiladas", args, {})?.top.etiquetas).toEqual(["Regular"]);
  });

  it("Sí/No (escala corta) y una lista sin orden: el motor no la pide, no se avisa", () => {
    expect(avisosTtb(
      slide("beca", "p_barras_apiladas", { var: "beca", cruces: "sexo", barra_extra: ["top2box"] }),
      slide("beca-heredado", "p_barras_apiladas", { var: "beca", cruces: "sexo" }),
      slide("carrera", "p_barras_apiladas", { var: "carrera", barra_extra: ["top2box"] }),
    )).toEqual([]);
  });

  it("una escala con orden y sin respuestas elegidas sigue avisando", () => {
    expect(avisosTtb(slide("calidad", "p_barras_apiladas", { var: "calidad", barra_extra: ["top2box"] }))).toEqual(["calidad"]);
  });
});
