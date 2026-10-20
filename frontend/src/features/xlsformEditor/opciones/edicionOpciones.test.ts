// E2: la opción nueva nace sin texto y con un código libre, la lista nueva no pisa otra, mover deja la opción en el
// lugar de la vecina y unificar propone el nombre de la lista más usada. Mata: «Opción 4» como valor real, un nombre
// repetido, un movimiento que no se mueve y un slug largo armado con las etiquetas.
import { describe, expect, it } from "vitest";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import { agregarOpcion, codigoLibre, crearLista, moverOpcion, nombreUnificadoCorto, totalListas } from "./edicionOpciones";

const libro = (rows: string[][]): XlsformEditorWorkbook => ({
  survey: { name: "survey", columns: ["type", "name"], rows: [] },
  choices: { name: "choices", columns: ["list_name", "name", "label"], rows },
  settings: { name: "settings", columns: [], rows: [] },
} as unknown as XlsformEditorWorkbook);

describe("ediciones de la pestaña Listas de opciones", () => {
  it("agrega la opción al final de su lista, sin texto y con el siguiente código", () => {
    const wb = libro([["sn", "1", "Sí"], ["sn", "2", "No"], ["sn", "99", "NS/NR"], ["otra", "a", "A"]]);
    const r = agregarOpcion(wb, "sn");
    expect(r.rowIndex).toBe(3);
    expect(r.workbook.choices.rows[3]).toEqual(["sn", "3", ""]);
    expect(r.workbook.choices.rows[4]).toEqual(["otra", "a", "A"]);
    expect(wb.choices.rows).toHaveLength(4);
  });
  it("con códigos de texto usa opcion_N libre", () => {
    expect(codigoLibre(["si", "no"])).toBe("opcion_3");
    expect(codigoLibre(["si", "opcion_2"])).toBe("opcion_3");
    expect(codigoLibre([])).toBe("1");
  });
  it("crea una lista con nombre libre, también frente a listas citadas sin opciones", () => {
    const wb = libro([["nueva_lista", "1", "x"]]);
    const r = crearLista(wb, ["nueva_lista_2"]);
    expect(r.listName).toBe("nueva_lista_3");
    expect(r.workbook.choices.rows[r.rowIndex]).toEqual(["nueva_lista_3", "1", ""]);
  });
  it("mueve una opción al lugar de la vecina, hacia abajo y hacia arriba", () => {
    const wb = libro([["l", "1", "A"], ["l", "2", "B"], ["l", "3", "C"]]);
    const abajo = moverOpcion(wb, 0, 1);
    expect(abajo.choices.rows.map((r) => r[2])).toEqual(["B", "A", "C"]);
    expect(moverOpcion(abajo, 1, 0).choices.rows.map((r) => r[2])).toEqual(["A", "B", "C"]);
    expect(moverOpcion(wb, 0, 9)).toBe(wb);
  });
  it("propone como nombre unificado el de la lista más usada", () => {
    const grupo = { firma: "f", listas: ["yes_no_a", "yes_no_b"], opciones: [], preguntas: [], sugerencia: "si_no_no_se_largo" };
    expect(nombreUnificadoCorto(grupo, { yes_no_a: 1, yes_no_b: 10 })).toBe("yes_no_b");
    expect(nombreUnificadoCorto(grupo, {})).toBe("yes_no_a");
  });
  it("el contador cuenta como la cabecera y dice aparte las listas sin opciones", () => {
    expect(totalListas([{ items: [1] }, { items: [] }])).toBe("1 lista · 1 sin opciones");
    expect(totalListas([{ items: [1] }, { items: [1] }])).toBe("2 listas");
  });
});
