// Escritura de filtros: cada edición de la matriz o de la lista cae en la celda correcta de choices y en el
// choice_filter, sin tocar otras listas. Mata: editar REF02 como expresión, perder opciones fijas al editar la
// cascada y reemplazar un código en una lista ajena.
import { describe, expect, it } from "vitest";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import { parseBuilderStructure } from "../parsing/buildIndex";
import {
  alternarFijaCascada,
  escribirIntento,
  intentoCompleto,
  marcarCascada,
  marcarFijo,
  reemplazarCodigos,
  renombrarColumna,
} from "./escrituraFiltros";
import { analizarFiltro, leerCascada } from "./modeloFiltros";

const wb: XlsformEditorWorkbook = {
  survey: {
    columns: ["type", "name", "label", "choice_filter"],
    rows: [
      ["select_one prov", "Province", "Provincia", ""],
      ["select_one dist", "District", "Distrito", "province = ${Province}"],
      ["select_one pais", "REF02", "Nacionalidad", "kk = 'si'"],
      ["select_one freq", "P14", "P14", ""],
      ["select_one freq", "P15", "P15", ""],
      ["select_one forma", "P21", "La más grave", ""],
    ],
  },
  choices: {
    columns: ["list_name", "name", "label", "province", "kk"],
    rows: [
      ["prov", "LMA", "Lima", "", ""], ["prov", "CAL", "Callao", "", ""],
      ["dist", "MIR", "Miraflores", "LIM", ""], ["dist", "BEL", "Bellavista", "CAL", ""],
      ["otra", "X", "Otra", "LIM", ""],
      ["pais", "PE", "Perú", "", "si"], ["pais", "CL", "Chile", "", ""],
      ["freq", "1", "Nunca", "", ""], ["freq", "2", "Una vez", "", ""],
      ["forma", "a", "A", "", ""], ["forma", "b", "B", "", ""],
    ],
  },
  settings: { columns: [], rows: [] },
};
const celda = (w: XlsformEditorWorkbook, lista: string, codigo: string, col: string) =>
  w.choices.rows.find((r) => r[0] === lista && r[1] === codigo)?.[w.choices.columns.indexOf(col)];
const filtro = (w: XlsformEditorWorkbook, fila: number) => w.survey.rows[fila]![w.survey.columns.indexOf("choice_filter")];

describe("cascada", () => {
  it("marcar reemplaza la respuesta y volver a marcar la borra", () => {
    const w1 = marcarCascada(wb, "dist", "province", "igual", "MIR", "LMA");
    expect(celda(w1, "dist", "MIR", "province")).toBe("LMA");
    expect(celda(marcarCascada(w1, "dist", "province", "igual", "MIR", "LMA"), "dist", "MIR", "province")).toBe("");
  });
  it("incluye acumula respuestas separadas por espacio", () => {
    const w1 = marcarCascada(wb, "dist", "province", "incluye", "BEL", "LMA");
    expect(celda(w1, "dist", "BEL", "province")).toBe("CAL LMA");
  });
  it("una opción fija se agrega a la expresión sin perder la cascada", () => {
    const c = leerCascada(filtro(wb, 1)!)!;
    const w1 = alternarFijaCascada(wb, 1, c, "MIR");
    expect(filtro(w1, 1)).toBe("province = ${Province} or name = 'MIR'");
    expect(filtro(alternarFijaCascada(w1, 1, leerCascada(filtro(w1, 1)!)!, "MIR"), 1)).toBe("province = ${Province}");
  });
  it("el arreglo de códigos sólo toca la lista del filtro", () => {
    const w1 = reemplazarCodigos(wb, "dist", "province", [{ de: "LIM", a: "LMA" }]);
    expect(celda(w1, "dist", "MIR", "province")).toBe("LMA");
    expect(celda(w1, "otra", "X", "province")).toBe("LIM");
  });
  it("renombrar una columna no toca referencias ni literales", () => {
    expect(renombrarColumna("country = ${country} or name = 'country'", "country", "country_code")).toBe("country_code = ${country} or name = 'country'");
  });
});

describe("fijo", () => {
  it("se edita como lista: desmarcar vacía la celda, marcar pone el valor y el choice_filter no cambia", () => {
    const s = parseBuilderStructure(wb.survey);
    const a = analizarFiltro({ structure: s, choices: wb.choices }, 2)!;
    const w1 = marcarFijo(wb, 2, "pais", a.fijo!, ["PE"], false);
    const w2 = marcarFijo(w1, 2, "pais", a.fijo!, ["CL"], true);
    expect(celda(w2, "pais", "PE", "kk")).toBe("");
    expect(celda(w2, "pais", "CL", "kk")).toBe("si");
    expect(filtro(w2, 2)).toBe("kk = 'si'");
  });
  it("por nombres reescribe la expresión en el orden de la lista", () => {
    const w1 = marcarFijo(wb, 2, "pais", { forma: "nombres", codigos: ["CL"] }, ["PE"], true);
    expect(filtro(w1, 2)).toBe("name = 'PE' or name = 'CL'");
  });
});

describe("crear", () => {
  it("cascada nueva: columna vacía y expresión estándar", () => {
    const w1 = escribirIntento(wb, 5, "forma", { forma: "cascada", madre: "P14", columna: "filtro_P14" });
    expect(w1.choices.columns).toContain("filtro_P14");
    expect(filtro(w1, 5)).toBe("filtro_P14=${P14}");
  });
  it("por opción: pide dos preguntas y deja todas las opciones fijas para repartir", () => {
    expect(intentoCompleto({ forma: "opcion", preguntas: ["P14"] })).toBe(false);
    const w1 = escribirIntento(wb, 5, "forma", { forma: "opcion", preguntas: ["P14", "P15"] });
    expect(filtro(w1, 5)).toBe("selected(filter_P14, ${P14}) or selected(filter_P15, ${P15}) or name = 'a' or name = 'b'");
    const a = analizarFiltro({ structure: parseBuilderStructure(w1.survey), choices: w1.choices }, 5)!;
    expect(a.tipo).toBe("opcion");
  });
  it("fijo nuevo marca todas las opciones: nada cambia para el encuestado hasta desmarcar", () => {
    const w1 = escribirIntento(wb, 5, "forma", { forma: "fijo", columna: "solo", valor: "si" });
    expect(celda(w1, "forma", "a", "solo")).toBe("si");
    expect(celda(w1, "pais", "PE", "solo")).toBe("");
    expect(filtro(w1, 5)).toBe("solo = 'si'");
  });
});
