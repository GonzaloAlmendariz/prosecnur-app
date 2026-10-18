// Insertar en el lugar del «+» de la Estructura. Mata: la pieza cae al final del formulario o de la sección en vez
// de en el hueco elegido, cae DENTRO de una sección cuando el «+» estaba después de su bloque, un nombre nuevo que
// choca con uno existente, una selección sin su lista propia y una sección que nace sin cierre.
import { describe, expect, test } from "vitest";
import { parseBuilderStructure } from "../parsing/buildIndex";
import { rowToRecord } from "../parsing/sheetUtils";
import type { XlsformEditorWorkbook } from "../types";
import { indiceInsercion, insertarEn } from "./accionesConstructor";

function libro(): XlsformEditorWorkbook {
  return {
    survey: {
      name: "survey",
      columns: ["type", "name", "label"],
      rows: [
        ["text", "q0", "Antes"], // 0
        ["begin_group", "sec", "Sección"], // 1
        ["text", "q1", "Uno"], // 2
        ["text", "pregunta_8", "Choca"], // 3
        ["end_group", "", ""], // 4
        ["text", "q3", "Después"], // 5
      ],
    },
    choices: { name: "choices", columns: ["list_name", "name", "label"], rows: [["lista_pregunta_7", "1", "Sí"]] },
    settings: { name: "settings", columns: [], rows: [] },
  };
}

const tipos = (wb: XlsformEditorWorkbook) => wb.survey.rows.map((_, i) => rowToRecord(wb.survey, i).type);
const nombres = (wb: XlsformEditorWorkbook) => wb.survey.rows.map((_, i) => rowToRecord(wb.survey, i).name);

describe("indiceInsercion", () => {
  const wb = libro();
  const s = parseBuilderStructure(wb.survey);
  const n = wb.survey.rows.length;
  test("después de una pregunta: la fila siguiente", () => {
    expect(indiceInsercion(s, { despuesDeFila: 2, seccionFila: 1 }, n)).toBe(3);
  });
  test("después de la última de la sección: antes de su cierre, dentro", () => {
    expect(indiceInsercion(s, { despuesDeFila: 3, seccionFila: 1 }, n)).toBe(4);
  });
  test("después de una sección: después de su cierre, fuera", () => {
    expect(indiceInsercion(s, { despuesDeFila: 1, seccionFila: null }, n)).toBe(5);
  });
  test("primera dentro de una sección", () => {
    expect(indiceInsercion(s, { despuesDeFila: null, seccionFila: 1 }, n)).toBe(2);
  });
  test("primera del formulario", () => {
    expect(indiceInsercion(s, { despuesDeFila: null, seccionFila: null }, n)).toBe(0);
  });
});

describe("insertarEn", () => {
  test("una pregunta de texto cae en el hueco elegido con un nombre libre", () => {
    const wb = libro();
    const r = insertarEn(wb, parseBuilderStructure(wb.survey), { despuesDeFila: 2, seccionFila: 1 }, "text");
    expect(r.rowIndex).toBe(3);
    // rows.length + 1 = 7 está libre.
    expect(r.name).toBe("pregunta_7");
    expect(nombres(wb).slice(2, 5)).toEqual(["q1", "pregunta_7", "pregunta_8"]);
    expect(rowToRecord(wb.survey, 3).label).toBe("Nueva pregunta");
    // Sigue dentro de la sección.
    expect(parseBuilderStructure(wb.survey).rowToSectionId.get(3)).toBe("section-1");
  });

  test("el nombre salta los que ya existen", () => {
    const wb = libro();
    wb.survey.rows.push(["text", "pregunta_8", "Extra"]); // ahora rows.length + 1 = 8, que choca
    const r = insertarEn(wb, parseBuilderStructure(wb.survey), { despuesDeFila: 0, seccionFila: null }, "integer");
    expect(r.name).toBe("pregunta_9");
  });

  test("una selección nace con su lista propia, sin chocar con una lista existente", () => {
    const wb = libro();
    const r = insertarEn(wb, parseBuilderStructure(wb.survey), { despuesDeFila: 5, seccionFila: null }, "select_one");
    expect(r.name).toBe("pregunta_7");
    expect(r.listName).toBe("lista_pregunta_7_2");
    expect(rowToRecord(wb.survey, 6).type).toBe("select_one lista_pregunta_7_2");
    expect(rowToRecord(wb.survey, 6).label).toBe("Nueva pregunta de selección");
  });

  test("un cálculo se nombra como cálculo", () => {
    const wb = libro();
    const r = insertarEn(wb, parseBuilderStructure(wb.survey), { despuesDeFila: null, seccionFila: 1 }, "calculate");
    expect(r).toMatchObject({ rowIndex: 2, name: "calculo_7" });
  });

  test("una sección entra con su cierre, después del bloque elegido", () => {
    const wb = libro();
    const r = insertarEn(wb, parseBuilderStructure(wb.survey), { despuesDeFila: 1, seccionFila: null }, "begin_group");
    expect(r.rowIndex).toBe(5);
    expect(tipos(wb)).toEqual(["text", "begin_group", "text", "text", "end_group", "begin_group", "end_group", "text"]);
    const s = parseBuilderStructure(wb.survey);
    expect(s.unclosedSectionIds).toEqual([]);
    expect(s.unmatchedEndRows).toEqual([]);
  });
});
