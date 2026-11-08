// Mata: una lista que no se ve como se dibuja en los modos fijos (residuales en medio, invertir que no invierte), una vista
// previa que ignora el modo bajo el cursor o un orden heredado manual que se pinta como si fuera el recetario.
import { describe, expect, it } from "vitest";
import type { GraficosCategorias } from "../../../api/graficos";
import { ordenDelModo, ordenVisible } from "./ordenVisible";
import { ORDEN_POR_DEFECTO } from "./ordenCategorias";

const datos: GraficosCategorias = {
  var: "p7", base: "", pregunta: "", ordinal: false, tipo: "select_one", modo_recetario: "frecuencia",
  categorias: [
    { codigo: "1", etiqueta: "Alfa", n: 3, pct: 0.3, residual: false },
    { codigo: "2", etiqueta: "Beta", n: 5, pct: 0.5, residual: false },
    { codigo: "0", etiqueta: "Otro", n: 9, pct: 0.1, residual: true },
    { codigo: "3", etiqueta: "Gama", n: 3, pct: 0.3, residual: false },
  ],
  orden: { recetario: ["2", "1", "3", "0"], instrumento: ["1", "2", "3", "0"], frecuencia: ["2", "1", "3", "0"] },
  avisos: [],
};

describe("orden visible en cada modo", () => {
  it("frecuencia: de mayor a menor; invertida, de menor a mayor con empates por instrumento; residuales al final", () => {
    expect(ordenDelModo("frecuencia", datos, false)).toEqual(["2", "1", "3", "0"]);
    expect(ordenDelModo("frecuencia", datos, true)).toEqual(["1", "3", "2", "0"]);
  });
  it("instrumento: su orden, invertido de punta a punta, residuales al final", () => {
    expect(ordenDelModo("instrumento", datos, false)).toEqual(["1", "2", "3", "0"]);
    expect(ordenDelModo("instrumento", datos, true)).toEqual(["3", "2", "1", "0"]);
  });
  it("recetario sigue al modo que aplica a este dato", () => {
    expect(ordenDelModo("recetario", datos, true)).toEqual(ordenDelModo("frecuencia", datos, true));
    expect(ordenDelModo("recetario", { ...datos, modo_recetario: null }, false)).toEqual(["2", "1", "3", "0"]);
  });
  it("la vista previa manda sobre el modo guardado; sin ella, el guardado (también el personalizado)", () => {
    const personal = { modo: "personalizado" as const, lista: ["3", "1", "2"], invertir: false };
    expect(ordenVisible(personal, datos, {}, "instrumento")).toEqual(["1", "2", "3", "0"]);
    expect(ordenVisible(personal, datos, {})).toEqual(["3", "1", "2", "0"]);
    expect(ordenVisible(ORDEN_POR_DEFECTO, datos, {})).toEqual(["2", "1", "3", "0"]);
  });
  it("con un orden heredado en recetario: el que se sabe reproducir, o nada si es manual", () => {
    expect(ordenVisible(ORDEN_POR_DEFECTO, datos, { overrides: { orden_barras: "instrumento" } })).toEqual(["1", "2", "3", "0"]);
    expect(ordenVisible(ORDEN_POR_DEFECTO, datos, { overrides: { orden_barras: "manual" } })).toBeNull();
    // La vista previa de otro modo sí se ve: elegirlo reemplaza al heredado.
    expect(ordenVisible(ORDEN_POR_DEFECTO, datos, { overrides: { orden_barras: "manual" } }, "frecuencia")).toEqual(["2", "1", "3", "0"]);
  });
});
