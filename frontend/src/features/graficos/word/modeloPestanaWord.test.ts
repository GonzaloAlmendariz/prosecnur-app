import { describe, expect, it } from "vitest";
import { paginasWord } from "../vistaGeneral/paginasWord";
import { paginaDeParte, resumenDeParte } from "./modeloPestanaWord";

const paginas = paginasWord([
  { clase: "seccion", nivel: 1, titulo: "Docencia" },
  { clase: "grafico", graficador: "p_barras_apiladas", pregunta: "¿Qué tan satisfecho está?", base: null },
  { clase: "seccion", nivel: 1, titulo: "Servicios" },
  { clase: "grafico", graficador: "p_pie", pregunta: "¿Usó la biblioteca?", base: null },
], { tituloInforme: "Informe", hayEscalas: true, hayBottom: false });

// W1: cada parte del Word muestra su página y dice lo que el documento tiene ahí.
describe("pestaña Word · partes", () => {
  // Mata: una parte que muestre otra página (p. ej. Gráficos con la apertura de «Cómo leer» sin figuras del plan).
  it("cada parte elige su página", () => {
    expect(paginaDeParte(paginas, "portada")?.clase).toBe("portada");
    expect(paginaDeParte(paginas, "documento")?.clase).toBe("indice");
    expect(paginaDeParte(paginas, "cierre")?.clase).toBe("contraportada");
    const g = paginaDeParte(paginas, "graficos");
    expect(g?.clase === "capitulo" && g.figuras.length > 0).toBe(true);
    expect(paginaDeParte(paginasWord([], { tituloInforme: "x", hayEscalas: false, hayBottom: false }), "graficos")).toBeNull();
  });
  it("el resumen cuenta sobre las páginas", () => {
    expect(resumenDeParte(paginas, "capitulos")).toMatch(/capítulos?$/);
    expect(resumenDeParte(paginas, "graficos")).toMatch(/^\d+ gráficos?$/);
    expect(resumenDeParte(paginas, "documento")).toBe("Contenido e índices y Cómo leer");
    // Un contenido largo se parte en páginas y sólo una trae los índices: igual se nombran.
    const largo = paginasWord(Array.from({ length: 40 }, (_, i) => ({ clase: "seccion" as const, nivel: 1 as const, titulo: `Capítulo ${i}` })),
      { tituloInforme: "x", hayEscalas: false, hayBottom: false, conTablas: true });
    expect(largo.filter((p) => p.clase === "indice").length).toBeGreaterThan(1);
    expect(resumenDeParte(largo, "documento")).toBe("Contenido e índices");
  });
});
