// Marcas del riel «Señales». Mata: una obligatoria condicionada leída como «opcional» (el nodo sólo guarda un
// booleano), la condición de la sección que no llega a sus preguntas, la propia condición de una sección contada
// como heredada, o una casilla encendida sin marca.
import { describe, expect, test } from "vitest";
import { parseBuilderStructure } from "../parsing/buildIndex";
import { rowToRecord } from "../parsing/sheetUtils";
import type { XlsformEditorSheet } from "../types";
import { RIEL, claveVisible, marcasNodo, tieneCasilla } from "./marcasNodo";

const survey: XlsformEditorSheet = {
  name: "survey",
  columns: ["type", "name", "label", "required", "relevant", "constraint", "constraint_message", "calculation", "choice_filter"],
  rows: [
    ["integer", "edad", "Edad", "yes", "", ". >= 18", "Debe ser mayor de edad", "", ""],
    ["begin_group", "hogar", "Hogar", "", "${edad} >= 18", "", "", "", ""],
    ["select_one sino", "jefe", "¿Es jefe de hogar?", "${edad} > 30", "", "", "", "", ""],
    ["begin_group", "detalle", "Detalle", "", "${jefe} = '1'", "", "", "", ""],
    ["text", "obs", "Observación", "no", "${edad} > 20", ". != ''", "obs", "", ""],
    ["end_group", "", "", "", "", "", "", "", ""],
    ["end_group", "", "", "", "", "", "", "", ""],
    ["calculate", "doble", "", "", "", "", "", "${edad} * 2", ""],
    ["select_one distrito", "distrito", "Distrito", "", "", "", "", "", "provincia = ${prov}"],
  ],
};
const structure = parseBuilderStructure(survey);
const nodo = (name: string) => structure.outline.find((n) => n.name === name)!;
const marcas = (name: string) => {
  const n = nodo(name);
  return marcasNodo(n, structure, rowToRecord(survey, n.rowIndex).required);
};

describe("marcasNodo", () => {
  test("obligatoria siempre y obligatoria condicionada (con el required crudo)", () => {
    expect(marcas("edad").oblig).toEqual({ siempre: true });
    expect(marcas("jefe").oblig).toEqual({ siempre: false, raw: "${edad} > 30" });
    expect(marcas("obs").oblig).toBeNull();
    // Sin el crudo, sólo el booleano del nodo: la condicionada se pierde.
    expect(marcasNodo(nodo("jefe"), structure).oblig).toBeNull();
    expect(marcasNodo(nodo("edad")).oblig).toEqual({ siempre: true });
  });

  test("condición propia y heredada de cada sección que la contiene, de la más cercana a la más externa", () => {
    const m = marcas("obs");
    expect(m.cond).toBe("${edad} > 20");
    expect(m.hered.map((h) => h.etiqueta)).toEqual(["Detalle", "Hogar"]);
    expect(m.hered.map((h) => h.raw)).toEqual(["${jefe} = '1'", "${edad} >= 18"]);
  });

  test("la condición de una sección es propia, no heredada; hereda sólo la de su sección madre", () => {
    const hogar = marcas("hogar");
    expect(hogar.cond).toBe("${edad} >= 18");
    expect(hogar.hered).toEqual([]);
    const detalle = marcas("detalle");
    expect(detalle.cond).toBe("${jefe} = '1'");
    expect(detalle.hered.map((h) => h.etiqueta)).toEqual(["Hogar"]);
  });

  test("sin condición propia, la casilla SI muestra la heredada", () => {
    const m = marcas("jefe");
    expect(m.cond).toBeNull();
    expect(tieneCasilla(m, "cond")).toBe(true);
    expect(claveVisible(m, "cond")).toBe("hered");
    expect(claveVisible(marcas("obs"), "cond")).toBe("cond");
  });

  test("restricción con su mensaje; un mensaje que repite el nombre no es mensaje", () => {
    expect(marcas("edad").regla).toEqual({ raw: ". >= 18", mensaje: "Debe ser mayor de edad" });
    expect(marcas("obs").regla).toEqual({ raw: ". != ''", mensaje: null });
  });

  test("cálculo y filtro de opciones con su lista", () => {
    expect(marcas("doble").calc).toBe("${edad} * 2");
    expect(marcas("distrito").filtro).toEqual({ raw: "provincia = ${prov}", lista: "distrito" });
  });

  test("el riel tiene orden fijo y cada casilla se enciende sólo con su marca", () => {
    expect(RIEL).toEqual(["oblig", "cond", "regla", "calc", "filtro"]);
    const doble = marcas("doble");
    expect(RIEL.filter((k) => tieneCasilla(doble, k))).toEqual(["calc"]);
    const distrito = marcas("distrito");
    expect(RIEL.filter((k) => tieneCasilla(distrito, k))).toEqual(["filtro"]);
    const edad = marcas("edad");
    expect(RIEL.filter((k) => tieneCasilla(edad, k))).toEqual(["oblig", "regla"]);
  });
});
