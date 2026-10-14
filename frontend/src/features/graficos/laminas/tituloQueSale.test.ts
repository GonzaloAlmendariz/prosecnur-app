import { describe, expect, test } from "vitest";
import type { Slide } from "../../../api/graficos";
import { tituloQueSale } from "./tituloQueSale";

// Recorrido de Arte y Diseño (2026-10-13): las láminas sin título salían como «Un gráfico» en la maqueta y la Estructura.
describe("título que va a salir", () => {
  const v = [{ name: "p3", label: "¿Cuál es su género?", tipo: "select_one", seccion: "", list_name: "g", source: "docentes" }];
  test("el escrito manda", () => {
    const s = { id: "a", tipo: "p_slide_1_grafico", payload: { titulo: "Género", grafico: { graficador: "p_barras_categoricas", args: { var: "docentes$p3" } } } } as Slide;
    expect(tituloQueSale(s, v, "Un gráfico")).toBe("Género");
  });
  test("sin escrito, el de la pregunta del gráfico", () => {
    const s = { id: "b", tipo: "p_slide_1_grafico", payload: { titulo: "", grafico: { graficador: "p_barras_categoricas", args: { var: "docentes$p3" } } } } as Slide;
    expect(tituloQueSale(s, v, "Un gráfico")).toBe("¿Cuál es su género?");
  });
  test("sin ninguno, vacío: nunca el nombre del tipo", () => {
    const s = { id: "c", tipo: "p_slide_1_grafico", payload: { titulo: "", grafico: null } } as Slide;
    expect(tituloQueSale(s, v, "Un gráfico")).toBe("");
  });
});
