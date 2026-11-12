import { describe, expect, it } from "vitest";

import type { DataReviewVariable, VariableInstrumento } from "../../../api/analitica";
import type { ListaCatalogoEntry } from "../panes/ordenCategoriasModel";
import {
  cifrasDeCategorias,
  especialesAlFinal,
  especialesDelEstudio,
  especialesEnSuLugar,
  indiceDelSeparador,
  listasQueCasan,
  moverConTeclado,
  opcionesDeLaLista,
} from "./modeloDeCategorias";

const pregunta = (name: string, list_name: string, label = name, tipo = "select_one"): VariableInstrumento => ({ name, label, tipo, list_name });
const revision = (name: string, opciones: [string, string, number][]): DataReviewVariable => ({
  name, tipo_xlsform: "select_one", seccion: "", included: true, label_actual: name, label_original: name,
  n_non_missing: 0, n_missing: 0, opciones: opciones.map(([code, label, count]) => ({ code, label, count })),
});
const lista = (listName: string, ordinalEfectivo = false): ListaCatalogoEntry => ({
  listName, nVariables: 1, nCategorias: 2, tieneOverride: false, ordinalAuto: ordinalEfectivo, ordinalEfectivo,
});

describe("modelo de Orden de categorías", () => {
  it("toma las opciones de la primera pregunta de la lista que trae datos y dice cuál", () => {
    const r = opcionesDeLaLista(
      [pregunta("p1", "sat"), pregunta("p2", "sat")],
      [revision("p1", []), revision("p2", [["1", "Sí", 4]]), revision("otra", [["9", "X", 1]])],
    );
    expect(r.fuente).toBe("p2");
    expect(r.opciones.map((o) => o.code)).toEqual(["1"]);
    expect(opcionesDeLaLista([pregunta("p9", "x")], []).fuente).toBeNull();
  });

  it("busca por el nombre de la lista o por una pregunta que la usa", () => {
    const catalogo = [lista("sat"), lista("sexo")];
    const preguntas = [pregunta("p12", "sat", "Satisfacción con la formación"), pregunta("e1", "sexo", "Sexo")];
    expect(listasQueCasan(catalogo, preguntas, "SEX").map((e) => e.listName)).toEqual(["sexo"]);
    expect(listasQueCasan(catalogo, preguntas, "formación").map((e) => e.listName)).toEqual(["sat"]);
    expect(listasQueCasan(catalogo, preguntas, "p12").map((e) => e.listName)).toEqual(["sat"]);
    expect(listasQueCasan(catalogo, preguntas, "  ")).toHaveLength(2);
  });

  it("junta los códigos especiales del estudio y suma sus casos", () => {
    const r = especialesDelEstudio([
      revision("a", [["1", "Sí", 3], ["99", "No responde", 2]]),
      revision("b", [["98", "No sabe", 0], ["99", "No contesta", 5]]),
    ]);
    expect(r).toEqual([
      { code: "98", label: "No sabe", casos: 0 },
      { code: "99", label: "No responde", casos: 7 },
    ]);
  });

  it("Especiales al final: se lee de la secuencia y al apagarse cada especial vuelve a su lugar del formulario", () => {
    expect(especialesAlFinal(["1", "2", "98", "99"])).toBe(true);
    expect(especialesAlFinal(["1", "98", "2"])).toBe(false);
    expect(especialesAlFinal(["1", "2"])).toBe(false);
    const formulario = ["1", "98", "2", "3"];
    expect(especialesEnSuLugar(["3", "2", "1", "98"], formulario)).toEqual(["3", "2", "1", "98"]);
    expect(especialesEnSuLugar(["1", "2", "3", "98"], formulario)).toEqual(["1", "98", "2", "3"]);
    expect(especialesEnSuLugar(["1", "2", "99"], ["1", "2"])).toEqual(["1", "2", "99"]);
  });

  it("la línea de los especiales va antes del primero solo cuando todos quedan atrás", () => {
    expect(indiceDelSeparador(["1", "2", "98", "99"])).toBe(2);
    expect(indiceDelSeparador(["1", "98", "2"])).toBeNull();
    expect(indiceDelSeparador(["98", "99"])).toBeNull();
  });

  it("Alt con las flechas mueve una posición y con Inicio o Fin al extremo; sin Alt no mueve", () => {
    const codes = ["a", "b", "c"];
    expect(moverConTeclado(codes, 1, "ArrowUp", true)).toEqual(["b", "a", "c"]);
    expect(moverConTeclado(codes, 1, "ArrowDown", true)).toEqual(["a", "c", "b"]);
    expect(moverConTeclado(codes, 2, "Home", true)).toEqual(["c", "a", "b"]);
    expect(moverConTeclado(codes, 0, "End", true)).toEqual(["b", "c", "a"]);
    expect(moverConTeclado(codes, 1, "ArrowUp", false)).toBeNull();
    expect(moverConTeclado(codes, 1, "Enter", true)).toBeNull();
  });

  it("las cifras cuentan listas, ordinales, especiales con casos y preguntas con lista", () => {
    const c = cifrasDeCategorias(
      [lista("sat", true), lista("sexo")],
      [{ code: "98", label: "No sabe", casos: 0 }, { code: "99", label: "No responde", casos: 3 }],
      [pregunta("p1", "sat"), pregunta("p2", "sexo"), pregunta("edad", "", "Edad", "integer")],
    );
    expect(c).toEqual({ listas: 2, ordinales: 1, especialesEnUso: 1, preguntasConLista: 2, preguntas: 3 });
  });
});
