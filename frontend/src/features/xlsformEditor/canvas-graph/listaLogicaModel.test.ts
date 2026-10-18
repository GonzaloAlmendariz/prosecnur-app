import { describe, expect, test } from "vitest";
import { parseBuilderStructure } from "../parsing/buildIndex";
import { dividirPorLogica, focoEnLista, listaLogica } from "./listaLogicaModel";

const D = "$";
const survey = {
  columns: ["type", "name", "label", "relevant", "choice_filter"],
  rows: [
    ["select_one yn", "trabaja", "¿Trabaja?", "", ""],
    ["begin_group", "g_empleo", "Empleo", `${D}{trabaja} = 'si'`, ""],
    ["text", "sector", "Sector", "", ""],
    ["integer", "horas", "Horas", `${D}{sector} != ''`, ""],
    ["end_group", "", "", "", ""],
    ["begin_group", "g_lugar", "Lugar", "", ""],
    ["select_one dist", "distrito", "Distrito", "", "prov = ${D}{provincia}"],
    ["end_group", "", "", "", ""],
  ],
};

describe("lista de la lógica por sección", () => {
  test("separa la regla de toda la sección de las reglas de cada pregunta", () => {
    const l = listaLogica(parseBuilderStructure(survey));
    const empleo = l.secciones.find((s) => s.nombre === "Empleo")!;
    expect(empleo.regla).toBe(`${D}{trabaja} = 'si'`);
    expect(empleo.preguntas).toBe(2);
    expect(empleo.items.map((i) => [i.node.name, i.tipos])).toEqual([["horas", ["aparece"]]]);
    const lugar = l.secciones.find((s) => s.nombre === "Lugar")!;
    expect(lugar.regla).toBe("");
    expect(lugar.items.map((i) => [i.node.name, i.tipos])).toEqual([["distrito", ["opciones"]]]);
    expect(l.deSeccion).toBe(1);
    expect(l.dePregunta).toBe(2);
  });
  test("las secciones llevan letra correlativa y el nivel principal sin lógica no aparece", () => {
    const l = listaLogica(parseBuilderStructure(survey));
    expect(l.secciones.map((s) => s.letra + ":" + s.nombre)).toEqual(["A:Empleo", "B:Lugar"]);
  });
  test("las secciones sin ninguna regla se separan para listarlas juntas (M2)", () => {
    const conVacia = { ...survey, rows: [...survey.rows, ["begin_group", "g_cierre", "Cierre", "", ""], ["note", "fin", "Gracias", "", ""], ["end_group", "", "", "", ""]] };
    const { conLogica, sinLogica } = dividirPorLogica(listaLogica(parseBuilderStructure(conVacia)).secciones);
    expect(conLogica.map((s) => s.nombre)).toEqual(["Empleo", "Lugar"]);
    expect(sinLogica.map((s) => s.letra + ":" + s.nombre)).toEqual(["C:Cierre"]);
  });
});

describe("foco de la lista (S18)", () => {
  test("un foco que no está en la lista se reconoce para avisarlo", () => {
    const lista = listaLogica(parseBuilderStructure(survey));
    expect(focoEnLista(lista, "horas")).toBe(true);
    expect(focoEnLista(lista, "no_existe")).toBe(false);
    expect(focoEnLista(lista, null)).toBe(true);
  });
});
