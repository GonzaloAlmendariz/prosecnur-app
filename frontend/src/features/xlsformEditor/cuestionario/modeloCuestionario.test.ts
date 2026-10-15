import { describe, expect, test } from "vitest";
import type { MatrixCandidate } from "../parsing/detectMatrixCandidates";
import type { BuilderNode, BuilderStructure, CatalogSummary } from "../types";
import { armarDocumento, codigosQueHabilitan, formaDe, leerCondicion, marcarOpcionales, rangoDe } from "./modeloCuestionario";

function nodo(rowIndex: number, name: string, base: string, extra: Partial<BuilderNode> = {}): BuilderNode {
  const kind = base === "begin_group" ? "section" : base === "note" ? "note" : "question";
  return {
    rowIndex, depth: 1, kind, label: `Texto ${name}`, name, sectionId: "s",
    typeInfo: { raw: base, base, listName: base.startsWith("select") ? "sino" : "" },
    required: true, relevant: "", constraint: "", calculation: "", choiceFilter: "", hint: "", appearance: "",
    ...extra,
  };
}

const catalogos: CatalogSummary[] = [
  { listName: "sino", title: "sino", items: [{ rowIndex: 1, name: "1", label: "Sí" }, { rowIndex: 2, name: "2", label: "No" }] },
  { listName: "acuerdo", title: "acuerdo", items: [{ rowIndex: 3, name: "1", label: "Nada" }, { rowIndex: 4, name: "5", label: "Mucho" }] },
];

const outline: BuilderNode[] = [
  nodo(1, "intro", "note", { sectionId: "root" }),
  nodo(2, "s1", "begin_group", { label: "Pag1" }),
  nodo(3, "p1", "select_one"),
  nodo(4, "p2", "integer", { constraint: ". >= 18 and . <= 99", relevant: "${p1} = '1'" }),
  nodo(5, "p3a", "select_one", { typeInfo: { raw: "select_one acuerdo", base: "select_one", listName: "acuerdo" } }),
  nodo(6, "p3b", "select_one", { typeInfo: { raw: "select_one acuerdo", base: "select_one", listName: "acuerdo" }, required: false }),
];

const matriz: MatrixCandidate = {
  id: "m1", sectionLabel: "Pag1", listName: "acuerdo", count: 2, memberNames: ["p3a", "p3b"],
  questionLabels: ["a", "b"], scaleOptions: [{ code: "1", label: "Nada" }, { code: "5", label: "Mucho" }],
};

describe("documento de lectura", () => {
  const doc = armarDocumento({ outline } as unknown as BuilderStructure, catalogos, [matriz]);

  test("secciones en orden, con el inicio aparte; numeración de corrido sólo para preguntas", () => {
    expect(doc.map((s) => [s.rotulo, s.preguntas])).toEqual([["Inicio del formulario", 0], ["Pag1", 4]]);
    const [p1, p2] = doc[1].bloques;
    expect(p1).toMatchObject({ tipo: "pregunta", pregunta: { numero: 1, forma: "una" } });
    expect(p2).toMatchObject({ tipo: "pregunta", pregunta: { numero: 2, forma: "numero", rango: { min: "18", max: "99" } } });
  });

  test("la condición se lee en llano y la opción que la habilita lo dice", () => {
    const [p1, p2] = doc[1].bloques;
    if (p1.tipo !== "pregunta" || p2.tipo !== "pregunta") throw new Error("esperaba preguntas");
    expect(p2.pregunta.condicion).toBe("P1 es «Sí»");
    expect(p1.pregunta.opciones).toEqual([
      { codigo: "1", etiqueta: "Sí", habilita: [2] },
      { codigo: "2", etiqueta: "No", habilita: [] },
    ]);
  });

  test("preguntas seguidas con la misma escala salen como una matriz", () => {
    const m = doc[1].bloques[2];
    expect(m.tipo).toBe("matriz");
    if (m.tipo !== "matriz") return;
    expect(m.filas.map((f) => f.numero)).toEqual([3, 4]);
    expect(m.escala.map((o) => o.etiqueta)).toEqual(["Nada", "Mucho"]);
    expect(doc[1].bloques).toHaveLength(3);
  });
});

describe("piezas", () => {
  const refs = { numeroDe: new Map([["p1", 1], ["p5", 5]]), etiquetaDe: (v: string, c: string) => (c === "1" ? "Sí" : null) };

  test("lectura de condiciones", () => {
    expect(leerCondicion("selected(${p5}, '1') and ${p1} != ''", refs)).toBe("P5 incluye «Sí» y P1 tiene respuesta");
    expect(leerCondicion("${p1} >= 3 or ${otra} = '2'", refs)).toBe("P1 ≥ 3 o otra es «2»");
    expect(leerCondicion("not(selected(${p5}, '1'))", refs)).toBe("P5 no incluye «Sí»");
  });

  test("códigos que habilitan, sin contar los negados", () => {
    expect(codigosQueHabilitan("${p1} = '1' or selected(${p5}, '3')")).toEqual([
      { variable: "p5", codigo: "3" }, { variable: "p1", codigo: "1" },
    ]);
    expect(codigosQueHabilitan("not(selected(${p5}, '3'))")).toEqual([]);
  });

  test("forma, rango y qué se marca", () => {
    expect(formaDe("select_multiple")).toBe("varias");
    expect(formaDe("decimal")).toBe("numero");
    expect(rangoDe(". <= 10")).toEqual({ min: null, max: "10" });
    expect(rangoDe("regex(., '^a')")).toBeNull();
    expect(marcarOpcionales(87, 86)).toBe(true);
    expect(marcarOpcionales(10, 3)).toBe(false);
  });
});
