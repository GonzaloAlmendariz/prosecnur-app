// Diagnóstico y vista previa de los filtros de opciones. Mata: una cascada con códigos que no casan dada por buena,
// la lista vacía que nadie ve, una columna inexistente leída como filtro sano, y una expresión que el modelo no sabe
// evaluar previsualizada a ciegas.
import { describe, expect, it } from "vitest";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import { parseBuilderStructure } from "../parsing/buildIndex";
import { acnur } from "../reglas/acnurEs.fixture";
import { analizarFiltro, analizarTodos, columnaParecida, leerCascada, leerFijo, opcionesVisibles, respuestasIniciales } from "./modeloFiltros";

const S = ["type", "name", "label", "choice_filter"];
const C = ["list_name", "name", "label", "province", "filter_P14", "filter_P15", "grupo", "kk", "gasto"];
const ch = (l: string, n: string, e: string, extra: Partial<Record<string, string>> = {}) => C.map((c) => (c === "list_name" ? l : c === "name" ? n : c === "label" ? e : extra[c] ?? ""));

const wb: XlsformEditorWorkbook = {
  survey: {
    columns: S,
    rows: [
      ["select_one prov", "Province", "Provincia", ""],
      ["select_one dist", "District", "Distrito de ${Province}", "province = ${Province}"],
      ["select_one freq", "P14", "Comentarios", ""],
      ["select_one freq", "P15", "Miradas", ""],
      ["select_one forma", "P21", "La más grave", "filter_P14=${P14} or filter_P15=${P15} or name = '0'"],
      ["select_one pais", "REF02", "Nacionalidad", "kk= 'si'"],
      ["select_one motivo", "REF16", "Motivo", "${Province} = 'CAL' and (name = '1' or name = '2')"],
      ["select_one dist", "Roto", "Con columna mala", "provinsia = ${Province}"],
      ["select_one dist", "Opaca", "Función", "contains(province, ${Province})"],
      ["select_multiple dist", "Gastos", "Gastos", ""],
      ["select_one dist", "Mayor", "Mayor gasto", "selected(${Gastos}, gasto) or name = 'ATE'"],
    ],
  },
  choices: {
    columns: C,
    rows: [
      ch("prov", "LMA", "Lima"), ch("prov", "CAL", "Callao"), ch("prov", "ARE", "Arequipa"),
      ch("dist", "MIR", "Miraflores", { province: "LIM", gasto: "MIR" }), ch("dist", "ATE", "Ate", { province: "LIM", gasto: "ATE" }),
      ch("dist", "BEL", "Bellavista", { province: "CAL", gasto: "BEL" }), ch("dist", "CAY", "Cayma", { province: "ARE", gasto: "CAY" }),
      ch("freq", "1", "Nunca"), ch("freq", "2", "Una vez"), ch("freq", "3", "Varias"),
      ch("forma", "0", "Selecciona"),
      ch("forma", "1", "Comentarios", { filter_P14: "2" }), ch("forma", "1", "Comentarios", { filter_P14: "3" }),
      ch("forma", "2", "Miradas", { filter_P15: "2" }), ch("forma", "2", "Miradas", { filter_P15: "3" }),
      ch("forma", "3", "Sin pregunta"),
      ch("pais", "PE", "Perú", { kk: "si" }), ch("pais", "CL", "Chile", { kk: "si" }), ch("pais", "XX", "Otro"),
      ch("motivo", "1", "Costo"), ch("motivo", "2", "Citas"), ch("motivo", "3", "Plazo"),
    ],
  },
  settings: { columns: [], rows: [] },
};
const structure = parseBuilderStructure(wb.survey);
const m = { structure, choices: wb.choices };
const de = (name: string) => analizarFiltro(m, structure.outline.find((n) => n.name === name)!.rowIndex)!;

describe("lectura de formas", () => {
  it("cascada: igual, marcada e incluye, con opciones fijas", () => {
    expect(leerCascada("filter_Province= ${region}")).toEqual({ columna: "filter_Province", madre: "region", forma: "igual", siempre: [] });
    expect(leerCascada("selected(${m},filter_Spent) or name = '99'")).toEqual({ columna: "filter_Spent", madre: "m", forma: "marcada", siempre: ["99"] });
    expect(leerCascada("selected(filter_Q, ${Q})")).toMatchObject({ columna: "filter_Q", forma: "incluye" });
    expect(leerCascada("a = ${x} or b = ${y}")).toBeNull();
  });
  it("fijo: una columna contra un valor, o las opciones nombradas", () => {
    expect(leerFijo("REF02CO= 'kk'")).toEqual({ forma: "columna", columna: "REF02CO", valor: "kk" });
    expect(leerFijo("filter=1")).toEqual({ forma: "columna", columna: "filter", valor: "1" });
    expect(leerFijo("name = '1' or name = '2'")).toEqual({ forma: "nombres", codigos: ["1", "2"] });
  });
});

describe("cascada", () => {
  const a = de("District");
  it("es cascada y la vista previa sigue a la respuesta de la madre", () => {
    expect(a.tipo).toBe("cascada");
    expect(opcionesVisibles(a, wb.choices, { Province: "CAL" })).toEqual(["BEL"]);
    expect(opcionesVisibles(a, wb.choices, { Province: "LMA" })).toEqual([]);
  });
  it("el título no deja ${x} crudo", () => {
    expect(a.etiqueta).toBe("Distrito de [Provincia]");
  });
  it("Lima deja la lista vacía y dos opciones no se ven nunca, con arreglo LIM → LMA", () => {
    expect(a.diagnosticos).toContainEqual({ clase: "vacia", entrada: "Province", respuestas: ["LMA"] });
    expect(a.diagnosticos).toContainEqual({ clase: "nunca", opciones: ["MIR", "ATE"], arreglo: { columna: "province", cambios: [{ de: "LIM", a: "LMA" }] } });
    expect(a.estado).toEqual({ clase: "vacia", texto: "Lista vacía con 1 respuesta" });
  });
  it("la vista previa arranca en una respuesta que muestra algo", () => {
    expect(respuestasIniciales(a, wb.choices)).toEqual({ Province: "CAL" });
  });
  it("selected(${multiple}, col) con una opción fija", () => {
    const g = de("Mayor");
    expect(g.tipo).toBe("cascada");
    expect(opcionesVisibles(g, wb.choices, { Gastos: ["MIR", "CAY"] })).toEqual(["MIR", "ATE", "CAY"]);
    expect(g.estado.clase).toBe("ok");
  });
});

describe("por opción", () => {
  const a = de("P21");
  it("cada opción aparece con su pregunta; la sin pregunta nunca", () => {
    expect(a.tipo).toBe("opcion");
    expect(opcionesVisibles(a, wb.choices, { P14: "2", P15: "1" })).toEqual(["0", "1"]);
    expect(opcionesVisibles(a, wb.choices, { P14: "1", P15: "3" })).toEqual(["0", "2"]);
    expect(a.diagnosticos).toEqual([{ clase: "nunca", opciones: ["3"], arreglo: null }]);
    expect(a.estado.texto).toBe("1 opción nunca visible");
  });
});

describe("fijo y expresión", () => {
  it("fijo: siempre las marcadas", () => {
    const a = de("REF02");
    expect(a.tipo).toBe("fijo");
    expect(opcionesVisibles(a, wb.choices, {})).toEqual(["PE", "CL"]);
    expect(a.estado.clase).toBe("ok");
  });
  it("expresión con condición: la lista vacía fuera de Callao es el diseño, las opciones no nombradas nunca salen", () => {
    const a = de("REF16");
    expect(a.tipo).toBe("expresion");
    expect(opcionesVisibles(a, wb.choices, { Province: "CAL" })).toEqual(["1", "2"]);
    expect(opcionesVisibles(a, wb.choices, { Province: "ARE" })).toEqual([]);
    expect(a.diagnosticos).toEqual([{ clase: "nunca", opciones: ["3"], arreglo: null }]);
  });
  it("columna que no existe: en conflicto, con la parecida", () => {
    const a = de("Roto");
    expect(a.diagnosticos).toEqual([{ clase: "conflicto", columna: "provinsia", sugerida: null }]);
    expect(a.estado.texto).toBe("En conflicto");
    expect(columnaParecida("country", ["list_name", "name", "label", "country_code"])).toBe("country_code");
    expect(columnaParecida("Filter_spent", ["filter_Spent"])).toBe("filter_Spent");
  });
  it("lo que no sabe evaluar queda sin vista previa", () => {
    const a = de("Opaca");
    expect(a.evaluable).toBe(false);
    expect(opcionesVisibles(a, wb.choices, { Province: "CAL" })).toBeNull();
    expect(a.estado).toEqual({ clase: "sin-vista", texto: "Sin vista previa" });
  });
});

describe("con filas reales del ACNUR", () => {
  const A = acnur();
  const todos = analizarTodos({ structure: A.structure, choices: A.workbook.choices });
  const f = (n: string) => todos.find((x) => x.pregunta === n)!;
  it("REF02 es fijo (no una expresión combinada) y la fila rota queda en conflicto", () => {
    expect(f("REF02").tipo).toBe("fijo");
    expect(f("REF02").fijo).toEqual({ forma: "columna", columna: "REF02CO", valor: "kk" });
    expect(f("REG02_Other_recod").estado.clase).toBe("conflicto");
  });
  it("REF16 (condición + opciones nombradas) es una expresión con vista previa", () => {
    expect(f("REF16").tipo).toBe("expresion");
    expect(f("REF16").evaluable).toBe(true);
  });
});
