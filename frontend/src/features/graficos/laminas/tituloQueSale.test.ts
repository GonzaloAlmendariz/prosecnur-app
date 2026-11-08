import { describe, expect, test } from "vitest";
import type { Slide } from "../../../api/graficos";
import { nombreEnEstructura, tituloQueSale } from "./tituloQueSale";

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
  test("Q2-7: en la Estructura una lámina de resumen sin título se nombra por su tarjeta o su antetítulo, nunca por «docentes$*»", () => {
    const panorama = { id: "d", tipo: "p_slide_1_grafico", payload: { titulo: "", grafico: { graficador: "p_panorama", args: { vars: ["docentes$*", "estudiantes$*"] } } } } as Slide;
    expect(tituloQueSale(panorama, v, "Un gráfico")).toBe("");
    expect(nombreEnEstructura(panorama, v, "Un gráfico")).toBe("Panorama de públicos");
    const cobertura = { id: "e", tipo: "p_slide_1_grafico", payload: { titulo: "", grafico: { graficador: "p_cobertura", args: { bases: ["docentes"] } } } } as Slide;
    expect(nombreEnEstructura(cobertura, v, "Un gráfico")).toBe("Cobertura y participación");
    const recetario = { id: "g", tipo: "p_slide_1_grafico", payload: { titulo: "", meta: { antetitulo: "Brechas" }, grafico: { graficador: "p_barras_agrupadas", args: {} } } } as Slide;
    expect(nombreEnEstructura(recetario, v, "Un gráfico")).toBe("Brechas");
  });
  test("M2: el nombre que el mazo guardó en meta.nombre nombra la lámina sin título en la Estructura, y no es su título", () => {
    const escala = { id: "h", tipo: "p_slide_1_grafico", payload: { titulo: "", meta: { nombre: "Escala bajo 60%", antetitulo: "Brechas" }, grafico: { graficador: "p_panorama", args: { vars: ["docentes$*"] } } } } as Slide;
    expect(nombreEnEstructura(escala, v, "Un gráfico")).toBe("Escala bajo 60%");
    expect(tituloQueSale(escala, v, "Un gráfico")).toBe("");
    const conTitulo = { ...escala, payload: { ...escala.payload, titulo: "Satisfacción" } } as Slide;
    expect(nombreEnEstructura(conTitulo, v, "Un gráfico")).toBe("Satisfacción");
    const enBlanco = { ...escala, payload: { ...escala.payload, meta: { nombre: "  " } } } as Slide;
    expect(nombreEnEstructura(enBlanco, v, "Un gráfico")).toBe("Panorama de públicos");
  });
});
