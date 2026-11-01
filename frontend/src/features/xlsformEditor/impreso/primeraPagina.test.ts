import { describe, expect, it } from "vitest";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import type { BuilderNode, BuilderStructure } from "../types";
import { partirEnLineas, primeraPagina } from "./primeraPagina";

function nodo(p: Partial<BuilderNode> & { base: string; listName?: string }): BuilderNode {
  return {
    rowIndex: 0, depth: 0, kind: "question", label: "", name: "", sectionId: "", required: false, relevant: "",
    constraint: "", calculation: "", choiceFilter: "", hint: "", appearance: "",
    ...p,
    typeInfo: { raw: p.base, base: p.base, listName: p.listName ?? "" },
  } as BuilderNode;
}

const workbook = {
  settings: { columns: ["form_title"], rows: [["Encuesta de protección 2026"]] },
  choices: {
    columns: ["list_name", "name", "label"],
    rows: [["sexo", "1", "Mujer"], ["sexo", "2", "Hombre"], ...Array.from({ length: 7 }, (_, i) => ["dep", String(i), `Departamento ${i}`])],
  },
} as unknown as XlsformEditorWorkbook;

describe("primera página real de «Así queda» (L36)", () => {
  it("lleva el título y las preguntas imprimibles con su número y sus opciones", () => {
    const structure = {
      outline: [
        nodo({ base: "start", kind: "question", label: "start" }),
        nodo({ base: "begin_group", kind: "section", label: "Datos" }),
        nodo({ base: "select_one", label: "¿Cuál es su **sexo**?", listName: "sexo" }),
        nodo({ base: "calculate", kind: "calculate", label: "edad_calc" }),
        nodo({ base: "note", kind: "note", label: "Lea en voz alta" }),
        nodo({ base: "select_multiple", label: "Departamentos visitados", listName: "dep", paperNumber: "P2" }),
        nodo({ base: "integer", label: "Edad" }),
        nodo({ base: "text", label: "Sólo digital", paperSkip: "yes" }),
      ],
    } as unknown as BuilderStructure;
    const pagina = primeraPagina(workbook, structure);
    expect(pagina.titulo).toBe("Encuesta de protección 2026");
    expect(pagina.preguntas.map((p) => [p.numero, p.texto, p.marca])).toEqual([
      ["1", "¿Cuál es su sexo?", "circulo"],
      ["", "Lea en voz alta", "linea"],
      ["P2", "Departamentos visitados", "cuadro"],
      ["3", "Edad", "linea"],
    ]);
    expect(pagina.preguntas[0]!.opciones).toEqual(["Mujer", "Hombre"]);
    expect(pagina.preguntas[2]!.opciones).toHaveLength(5);
    expect(pagina.preguntas[2]!.restantes).toBe(2);
  });

  it("sin estructura no inventa preguntas", () => {
    expect(primeraPagina(workbook, null).preguntas).toEqual([]);
  });
});

describe("partirEnLineas", () => {
  it("envuelve por palabras y recorta con «…» lo que no cabe", () => {
    expect(partirEnLineas("¿En qué distrito vive usted actualmente?", 20, 3)).toEqual(["¿En qué distrito", "vive usted", "actualmente?"]);
    const dos = partirEnLineas("uno dos tres cuatro cinco seis siete ocho", 10, 2);
    expect(dos).toHaveLength(2);
    expect(dos[1]!.endsWith("…")).toBe(true);
  });
});
