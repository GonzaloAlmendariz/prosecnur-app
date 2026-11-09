import { describe, expect, it } from "vitest";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import type { BuilderNode, BuilderStructure } from "../types";
import { partirEnLineas, primeraPagina, textoImpreso } from "./primeraPagina";

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

describe('primera página real de "Así queda" (L36)', () => {
  it("omite los grupos de la plataforma con todo lo que cuelga de ellos, como el documento (D-L36-1)", () => {
    const structure = {
      outline: [
        nodo({ base: "begin_group", kind: "section", name: "survey_monkey_metadata", label: "Metadata SurveyMonkey", depth: 0 }),
        nodo({ base: "text", label: "respondent_id", depth: 1 }),
        nodo({ base: "text", label: "collector_id", depth: 1 }),
        nodo({ base: "begin_group", kind: "section", name: "grp_p1", label: "Datos", depth: 0 }),
        nodo({ base: "integer", label: "Edad", depth: 1 }),
      ],
    } as unknown as BuilderStructure;
    expect(primeraPagina(workbook, structure).preguntas.map((p) => [p.numero, p.texto])).toEqual([["1", "Edad"]]);
  });

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
  it('envuelve por palabras y recorta con "…" lo que no cabe', () => {
    expect(partirEnLineas("¿En qué distrito vive usted actualmente?", 20, 3)).toEqual(["¿En qué distrito", "vive usted", "actualmente?"]);
    const dos = partirEnLineas("uno dos tres cuatro cinco seis siete ocho", 10, 2);
    expect(dos).toHaveLength(2);
    expect(dos[1]!.endsWith("…")).toBe(true);
  });
});

describe("tablas markdown en el esquema (E8 editor-conjoint)", () => {
  it("una tabla de perfiles se resume por columnas y filas, sin barras ni referencias", () => {
    const t = textoImpreso("Elija:\n| | Perfil A | Perfil B |\n|---|---|---|\n| Edad | ${a} | ${b} |\n| Sexo | ${c} | ${d} |");
    expect(t).toBe("Elija: Tabla: Perfil A, Perfil B (2 filas)");
    expect(textoImpreso("**¿Edad?**")).toBe("¿Edad?");
  });
});
