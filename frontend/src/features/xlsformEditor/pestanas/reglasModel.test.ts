import { describe, expect, test } from "vitest";
import type { BuilderNode, BuilderStructure } from "../types";
import { calculosDelFormulario, referenciasDe, restriccionesDelFormulario } from "./reglasModel";

const D = "$";
function nodo(rowIndex: number, name: string, base: string, extra: Partial<BuilderNode> = {}): BuilderNode {
  return {
    rowIndex, depth: 1, kind: base === "calculate" ? "calculate" : "question", label: name, name, sectionId: "root",
    typeInfo: { raw: base, base, listName: "" }, required: true, relevant: "", constraint: "", calculation: "",
    choiceFilter: "", hint: "", appearance: "", ...extra,
  };
}
function estructura(nodes: BuilderNode[]): BuilderStructure {
  return {
    outline: nodes, byRow: new Map(nodes.map((n) => [n.rowIndex, n])), sections: new Map(), rowToSectionId: new Map(),
    firstSelectableRow: nodes[0]?.rowIndex ?? null, spans: new Map(), unmatchedEndRows: [], unclosedSectionIds: [],
  };
}

describe("referenciasDe", () => {
  test("devuelve cada variable una vez, en orden", () => {
    expect(referenciasDe(`${D}{a} > 1 and ${D}{b} < ${D}{a}`)).toEqual(["a", "b"]);
    expect(referenciasDe(". >= 18")).toEqual([]);
  });
});

describe("restriccionesDelFormulario", () => {
  test("separa las que tienen regla de los números/fechas sin regla, y marca la falta de mensaje", () => {
    const s = estructura([
      nodo(1, "edad", "integer", { constraint: ". >= 18 and . <= 99", constraint_message: "Entre 18 y 99" }),
      nodo(2, "anios", "integer", { constraint: `. < ${D}{edad} - 15` }),
      nodo(3, "horas", "decimal"),
      nodo(4, "nombre", "text"),
    ]);
    const r = restriccionesDelFormulario(s);
    expect(r.map((x) => [x.node.name, x.estado])).toEqual([["edad", "con"], ["anios", "con"], ["horas", "sugerida"]]);
    expect(r[1].usa).toEqual(["edad"]);
    expect(r[1].sinMensaje).toBe(true);
    expect(r[0].sinMensaje).toBe(false);
  });
  test("«Depende de» no lista a la propia pregunta (age_est escrita como ${age_est})", () => {
    const r = restriccionesDelFormulario(estructura([nodo(1, "age_est", "integer", { constraint: `${D}{age_est} >= 0 and ${D}{age_est} <= 110` })]));
    expect(r[0]!.usa).toEqual([]);
  });
  test("sin estructura no hay nada", () => {
    expect(restriccionesDelFormulario(null)).toEqual([]);
  });
});

describe("calculosDelFormulario", () => {
  test("encuentra qué usa cada cálculo y quién lo lee, por columna", () => {
    const s = estructura([
      nodo(1, "edad", "integer"),
      nodo(2, "grupo_edad", "calculate", { calculation: `if(${D}{edad} < 25, 'joven', 'adulto')` }),
      nodo(3, "beca", "select_one", { relevant: `${D}{grupo_edad} = 'joven'` }),
      nodo(4, "vacio", "calculate"),
    ]);
    const [g, v] = calculosDelFormulario(s);
    expect(g.usa).toEqual(["edad"]);
    expect(g.loUsan.map((u) => [u.node.name, u.columna])).toEqual([["beca", "relevant"]]);
    expect(v.vacio).toBe(true);
  });
});

describe("S13: una pregunta con fórmula también es un cálculo", () => {
  test("cuenta las preguntas con `calculation` y las marca aparte", () => {
    const outline = [
      nodo(1, "edad", "integer"),
      nodo(2, "edad_calc", "integer", { calculation: `${D}{edad} + 1` }),
      nodo(3, "tramo", "calculate", { calculation: `if(${D}{edad} < 25, 'a', 'b')` }),
    ];
    const items = calculosDelFormulario({ outline } as unknown as BuilderStructure);
    expect(items.map((i) => [i.node.name, i.enPregunta])).toEqual([["edad_calc", true], ["tramo", false]]);
  });
});
