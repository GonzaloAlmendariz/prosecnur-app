import { describe, expect, it } from "vitest";
import {
  buildChoiceFilterModel,
  extractFilterVariables,
  humanizeLabel,
  parseMatrixTerms,
  type BuildChoiceFilterInput,
} from "./buildChoiceFilterModel";
import type { BuilderNode, BuilderStructure, SectionMeta, TypeInfo } from "../types";

// ── Fábricas mínimas para armar una BuilderStructure de prueba ──────────────

function mkType(raw: string): TypeInfo {
  const parts = raw.split(/\s+/);
  return { raw, base: parts[0] ?? raw, listName: parts[1] ?? "" };
}

function mkNode(partial: Partial<BuilderNode> & { rowIndex: number; name: string }): BuilderNode {
  return {
    depth: 0,
    kind: "question",
    label: "",
    sectionId: "root",
    typeInfo: mkType("text"),
    required: false,
    relevant: "",
    constraint: "",
    calculation: "",
    choiceFilter: "",
    hint: "",
    appearance: "",
    ...partial,
  };
}

function mkStructure(outline: BuilderNode[], sections: SectionMeta[]): BuilderStructure {
  const byRow = new Map<number, BuilderNode>();
  for (const node of outline) byRow.set(node.rowIndex, node);
  const sectionMap = new Map<string, SectionMeta>();
  for (const section of sections) sectionMap.set(section.id, section);
  return {
    outline,
    byRow,
    sections: sectionMap,
    rowToSectionId: new Map(),
    firstSelectableRow: outline[0]?.rowIndex ?? null,
    spans: new Map(),
    unmatchedEndRows: [],
    unclosedSectionIds: [],
  };
}

const SECTION_VBG: SectionMeta = {
  id: "sec_vbg",
  rowIndex: 0,
  endRowIndex: null,
  depth: 0,
  kind: "section",
  label: "Violencia basada en género",
  name: "vbg",
  parentId: null,
  itemCount: 0,
};

describe("extractFilterVariables", () => {
  it("saca los ${var} en orden sin duplicados", () => {
    expect(
      extractFilterVariables("filter_P14=${P14} or filter_P15=${P15} or filter_P14=${P14}"),
    ).toEqual(["P14", "P15"]);
  });
  it("devuelve vacío cuando no hay variables", () => {
    expect(extractFilterVariables("name='0'")).toEqual([]);
  });
});

describe("parseMatrixTerms", () => {
  it("reconoce la disyunción de columna=${var} e ignora name='0'", () => {
    const terms = parseMatrixTerms("filter_P14=${P14} or filter_P15=${P15} or name='0'");
    expect(terms).toEqual([
      { col: "filter_P14", varName: "P14" },
      { col: "filter_P15", varName: "P15" },
    ]);
  });
  it("devuelve null ante formas no reconocidas (funciones/and)", () => {
    expect(parseMatrixTerms("selected(${P14}, 'a')")).toBeNull();
    expect(parseMatrixTerms("filter_P14=${P14} and region=${region}")).toBeNull();
  });
});

describe("humanizeLabel", () => {
  it("stripea etiquetas HTML del label (span de color)", () => {
    expect(humanizeLabel('<span style="color:#002060">VIOLENCIA BASADA EN GÉNERO</span>')).toBe(
      "VIOLENCIA BASADA EN GÉNERO",
    );
  });
  it("stripea markdown (*, ######) y colapsa saltos de línea", () => {
    expect(humanizeLabel("*¿cuál es la que más te afectó?*")).toBe(
      "¿cuál es la que más te afectó?",
    );
    expect(humanizeLabel("###### Título\n\ncon salto")).toBe("Título con salto");
  });
});

describe("buildChoiceFilterModel", () => {
  it("deduplica opciones repetidas ×N por valor de frecuencia (una correspondencia por opción)", () => {
    const outline: BuilderNode[] = [
      mkNode({ rowIndex: 10, name: "P14", label: "*P14 label*", typeInfo: mkType("select_one si_no") }),
      mkNode({ rowIndex: 11, name: "P15", label: "P15 label", typeInfo: mkType("select_one si_no") }),
      mkNode({
        rowIndex: 20,
        name: "P21",
        label: "###### ¿Cuál te afectó más?",
        typeInfo: mkType("select_one expresion_vbg"),
        choiceFilter: "filter_P14=${P14} or filter_P15=${P15} or name='0'",
      }),
    ];
    // Cada opción aparece 4 veces (filter_P14 = 2,3,4,5) — como en el instrumento real.
    const rows: string[][] = [["expresion_vbg", "0", "Selecciona una respuesta", "", ""]];
    for (const freq of ["2", "3", "4", "5"]) {
      rows.push(["expresion_vbg", "contacto", "Contacto físico no deseado", freq, ""]);
    }
    for (const freq of ["2", "3", "4", "5"]) {
      rows.push(["expresion_vbg", "forzada", "Relación sexual forzada", "", freq]);
    }
    const { cards } = buildChoiceFilterModel({
      structure: mkStructure(outline, []),
      choicesColumns: ["list_name", "name", "label", "filter_P14", "filter_P15"],
      choicesRows: rows,
    });
    const card = cards[0]!;
    expect(card.mode).toBe("matrix");
    // 8 filas de opción (2 opciones × 4) colapsan a 2 correspondencias.
    expect(card.pairs).toHaveLength(2);
    expect(card.pairs.map((p) => p.optionName)).toEqual(["contacto", "forzada"]);
    // Labels saneados (sin markdown crudo).
    expect(card.questionLabel).toBe("¿Cuál te afectó más?");
    expect(card.pairs[0]!.antecedent.label).toBe("P14 label");
  });


  it("deriva la matriz OR 1:1 (caso canónico P14/P15 → expresion_vbg)", () => {
    const outline: BuilderNode[] = [
      mkNode({
        rowIndex: 10,
        name: "P14",
        label: "Alguien te tocó, manoseó o besó sin que lo desearas",
        typeInfo: mkType("select_one si_no"),
        sectionId: "sec_vbg",
      }),
      mkNode({
        rowIndex: 11,
        name: "P15",
        label: "Alguien te obligó a mantener relaciones sexuales mediante la fuerza",
        typeInfo: mkType("select_one si_no"),
        sectionId: "sec_vbg",
      }),
      mkNode({
        rowIndex: 20,
        name: "P21",
        label: "¿Cuál de estas formas de violencia te afectó en mayor medida?",
        typeInfo: mkType("select_one expresion_vbg"),
        choiceFilter: "filter_P14=${P14} or filter_P15=${P15} or name='0'",
        sectionId: "sec_vbg",
      }),
    ];
    const input: BuildChoiceFilterInput = {
      structure: mkStructure(outline, [SECTION_VBG]),
      choicesColumns: ["list_name", "name", "label", "filter_P14", "filter_P15"],
      choicesRows: [
        ["expresion_vbg", "0", "Selecciona una respuesta", "", ""],
        ["expresion_vbg", "contacto", "Contacto físico sexual no deseado", "1", ""],
        ["expresion_vbg", "forzada", "Relación sexual forzada", "", "1"],
      ],
    };
    const { cards } = buildChoiceFilterModel(input);
    expect(cards).toHaveLength(1);
    const card = cards[0]!;
    expect(card.mode).toBe("matrix");
    expect(card.derivable).toBe(true);
    expect(card.sectionLabel).toBe("Violencia basada en género");
    expect(card.questionCode).toBe("P21");
    expect(card.antecedents.map((a) => a.varName)).toEqual(["P14", "P15"]);
    // La opción "0" (placeholder) NO produce pareja.
    expect(card.pairs).toHaveLength(2);
    expect(card.pairs[0]).toMatchObject({
      optionLabel: "Contacto físico sexual no deseado",
      antecedent: { varName: "P14", rowIndex: 10 },
    });
    expect(card.pairs[1]).toMatchObject({
      optionLabel: "Relación sexual forzada",
      antecedent: { varName: "P15", rowIndex: 11 },
    });
  });

  it("degrada un filtro simple (region=${region}) sin inventar parejas", () => {
    const outline: BuilderNode[] = [
      mkNode({ rowIndex: 1, name: "region", label: "¿En qué región naciste?", typeInfo: mkType("select_one regiones") }),
      mkNode({
        rowIndex: 2,
        name: "provincia",
        label: "¿En qué provincia?",
        typeInfo: mkType("select_one provincias"),
        choiceFilter: "region=${region}",
      }),
    ];
    const { cards } = buildChoiceFilterModel({
      structure: mkStructure(outline, []),
      choicesColumns: ["list_name", "name", "label", "region"],
      choicesRows: [["provincias", "lima", "Lima", "costa"]],
    });
    expect(cards).toHaveLength(1);
    const card = cards[0]!;
    expect(card.mode).toBe("simple");
    expect(card.derivable).toBe(false);
    expect(card.pairs).toHaveLength(0);
    expect(card.antecedents).toHaveLength(1);
    expect(card.antecedents[0]!.label).toBe("¿En qué región naciste?");
    expect(card.explanation).toContain("¿En qué región naciste?");
  });

  it("no produce ficha cuando no hay choice_filter", () => {
    const outline: BuilderNode[] = [
      mkNode({ rowIndex: 1, name: "P1", label: "Edad", typeInfo: mkType("integer") }),
      mkNode({ rowIndex: 2, name: "P2", label: "Sexo", typeInfo: mkType("select_one sexo") }),
    ];
    const { cards } = buildChoiceFilterModel({
      structure: mkStructure(outline, []),
      choicesColumns: ["list_name", "name", "label"],
      choicesRows: [["sexo", "f", "Femenino"]],
    });
    expect(cards).toHaveLength(0);
  });

  it("degrada a opaque si una opción activa dos columnas de filtro (no 1:1 limpia)", () => {
    const outline: BuilderNode[] = [
      mkNode({ rowIndex: 10, name: "P14", label: "P14 label", typeInfo: mkType("select_one si_no") }),
      mkNode({ rowIndex: 11, name: "P15", label: "P15 label", typeInfo: mkType("select_one si_no") }),
      mkNode({
        rowIndex: 20,
        name: "P21",
        label: "Pregunta filtrada",
        typeInfo: mkType("select_one expresion_vbg"),
        choiceFilter: "filter_P14=${P14} or filter_P15=${P15} or name='0'",
      }),
    ];
    const { cards } = buildChoiceFilterModel({
      structure: mkStructure(outline, []),
      choicesColumns: ["list_name", "name", "label", "filter_P14", "filter_P15"],
      choicesRows: [
        ["expresion_vbg", "0", "Selecciona una respuesta", "", ""],
        // Esta opción activa AMBAS columnas → ambigüedad → degrada.
        ["expresion_vbg", "ambigua", "Opción ambigua", "1", "1"],
      ],
    });
    const card = cards[0]!;
    expect(card.mode).toBe("opaque");
    expect(card.derivable).toBe(false);
    expect(card.pairs).toHaveLength(0);
    // Aun degradada, conserva los antecedentes en lenguaje humano.
    expect(card.antecedents.map((a) => a.varName)).toEqual(["P14", "P15"]);
  });
});
