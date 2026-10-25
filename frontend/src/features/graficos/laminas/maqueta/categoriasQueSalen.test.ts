// CCSS-UI-2 y CCSS-UI-3 (bandeja CCSS, 2026-10-24): la maqueta dice lo que el entregable muestra. El panel lleva el
// `titulo` que el plan declara para el gráfico (el motor lo pone sobre el panel: `title_slide`), y la leyenda lista las
// categorías que el motor dibuja: sin las que no tienen casos, sin las excluidas y con el resto en «Otros» cuando hay tope.
import { describe, expect, it } from "vitest";
import type { Slide } from "../../../../api/graficos";
import { ranurasDeMaqueta } from "../modeloMaqueta";
import { categoriasQueSalen } from "./categoriasQueSalen";
import { fichaDeRanura } from "./fichaModelo";

const A10 = {
  name: "A10", label: "¿Dónde estudiaste la mayor parte de tu educación secundaria?", tipo: "select_one", seccion: "A",
  list_name: "lugar_sec",
  choices: [
    { name: "1", label: "Lima Metropolitana" }, { name: "2", label: "Callao" }, { name: "3", label: "Otra región del Perú" },
    { name: "4", label: "En otro país" }, { name: "5", label: "Otro" },
  ],
  n_non_empty: 397,
};
const CONTEOS = [
  { codigo: "1", etiqueta: "Lima Metropolitana", n: 262 }, { codigo: "2", etiqueta: "Callao", n: 20 },
  { codigo: "3", etiqueta: "Otra región del Perú", n: 115 }, { codigo: "4", etiqueta: "En otro país", n: 0 },
  { codigo: "5", etiqueta: "Otro", n: 0 },
];
const lamina9 = (args: Record<string, unknown>) => ({
  tipo: "p_slide_2_graficos",
  payload: { titulo: "Dos de cada tres…", izquierda: { graficador: "p_donut", args: { var: "A10", ...args } }, derecha: { graficador: "p_donut", args: { var: "A10" } } },
}) as unknown as Slide;

describe("CCSS-UI-2 · el panel lleva el título que el plan declara", () => {
  it("la ranura expone el título del gráfico y su variable", () => {
    const [r] = ranurasDeMaqueta(lamina9({ titulo: "Dónde estudió la secundaria" }), [A10]);
    expect(r.tituloPanel).toBe("Dónde estudió la secundaria");
    expect(r.variable).toBe("A10");
  });

  it("la ficha dice el título del plan, no el enunciado del instrumento", () => {
    const [r] = ranurasDeMaqueta(lamina9({ titulo: "Dónde estudió la secundaria" }), [A10]);
    expect(fichaDeRanura(r, "Gráfico de dona").preguntas).toEqual(["Dónde estudió la secundaria"]);
  });

  it("los overrides mandan, como en el motor; sin título, queda la pregunta", () => {
    const [r] = ranurasDeMaqueta(lamina9({ titulo: "A", overrides: { titulo: "B" } }), [A10]);
    expect(r.tituloPanel).toBe("B");
    const [sin, otra] = ranurasDeMaqueta(lamina9({ titulo: "  " }), [A10]);
    expect(sin.tituloPanel).toBeNull();
    expect(fichaDeRanura(otra, "Gráfico de dona").preguntas).toEqual([A10.label]);
  });
});

describe("CCSS-UI-3 · la leyenda lista las categorías que el motor dibuja", () => {
  const opciones = A10.choices.map((c) => ({ rotulo: c.label, color: null, codigo: c.name }));

  it("sin conteos todavía, no inventa: quedan todas", () => {
    expect(categoriasQueSalen(opciones, null, "p_donut", {}).opciones.map((o) => o.rotulo)).toHaveLength(5);
  });

  it("las que no tienen casos no salen, y se nombran aparte", () => {
    const out = categoriasQueSalen(opciones, CONTEOS, "p_donut", {});
    expect(out.opciones.map((o) => o.rotulo)).toEqual(["Lima Metropolitana", "Callao", "Otra región del Perú"]);
    expect(out.fuera).toEqual(["En otro país", "Otro"]);
  });

  it("excluir_opciones saca la categoría por código o por rótulo", () => {
    const out = categoriasQueSalen(opciones, CONTEOS, "p_donut", { excluir_opciones: "2" });
    expect(out.opciones.map((o) => o.rotulo)).toEqual(["Lima Metropolitana", "Otra región del Perú"]);
    expect(categoriasQueSalen(opciones, null, "p_donut", { excluir_opciones: ["Callao"] }).opciones.map((o) => o.rotulo)).not.toContain("Callao");
  });

  it("top_k deja las k mayores y junta el resto en «Otros» (o la etiqueta del plan)", () => {
    const out = categoriasQueSalen(opciones, CONTEOS, "p_donut", { top_k: 2, etiqueta_otros: "Otras zonas" });
    expect(out.opciones.map((o) => o.rotulo)).toEqual(["Lima Metropolitana", "Otra región del Perú", "Otras zonas"]);
  });

  it("barras agrupadas con máximo de categorías: el resto va a «Otros» salvo que se apague", () => {
    const ops = opciones.slice(0, 3);
    const con = categoriasQueSalen(ops, CONTEOS, "p_barras_agrupadas", { max_categorias: 2 });
    expect(con.opciones.map((o) => o.rotulo)).toEqual(["Lima Metropolitana", "Otra región del Perú", "Otros"]);
    const sin = categoriasQueSalen(ops, CONTEOS, "p_barras_agrupadas", { max_categorias: 2, agrupar_resto_en_otros: false });
    expect(sin.opciones.map((o) => o.rotulo)).toEqual(["Lima Metropolitana", "Otra región del Perú"]);
  });

  it("la ficha de la lámina 9 ya no promete «En otro país» ni «Otro», y lo dice en un chip", () => {
    const [r] = ranurasDeMaqueta(lamina9({ titulo: "Dónde estudió la secundaria" }), [A10]);
    const f = fichaDeRanura(r, "Gráfico de dona", CONTEOS);
    expect(f.leyendas[0].items.map((i) => i.rotulo)).toEqual(["Lima Metropolitana", "Callao", "Otra región del Perú"]);
    expect(f.ajustes).toContain("Sin casos: En otro país, Otro");
  });
});
