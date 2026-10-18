// Insertar en el lugar del «+» de la Estructura. Mata: la pieza cae al final del formulario o de la sección en vez
// de en el hueco elegido, cae DENTRO de una sección cuando el «+» estaba después de su bloque, un nombre nuevo que
// choca con uno existente, una selección sin su lista propia y una sección que nace sin cierre.
import { describe, expect, test } from "vitest";
import { parseBuilderStructure } from "../parsing/buildIndex";
import { rowToRecord } from "../parsing/sheetUtils";
import type { XlsformEditorWorkbook } from "../types";
import { alternarRepeticion, duplicarFila, indiceInsercion, insertarEn, planMoverASeccion, seccionesDestino } from "./accionesConstructor";
import { applyRowMove } from "../outline/outlineUtils";

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

// Acciones de la ficha (C20). Mata: una copia con el mismo código, una copia de sección sin su cierre, referencias de
// la copia que siguen apuntando al original, mover una pieza a sí misma o a la sección donde ya está, y una
// repetición que conserva el cierre de sección.
describe("acciones de la ficha", () => {
  test("duplicar una pregunta: queda debajo con un código libre", () => {
    const wb = libro();
    const r = duplicarFila(wb, parseBuilderStructure(wb.survey), 2);
    expect(r).toEqual({ rowIndex: 3, name: "q1_copia" });
    expect(nombres(wb).slice(2, 5)).toEqual(["q1", "q1_copia", "pregunta_8"]);
    const r2 = duplicarFila(wb, parseBuilderStructure(wb.survey), 2);
    expect(r2.name).toBe("q1_copia_2");
  });

  test("duplicar una sección copia su bloque entero y reescribe las referencias internas", () => {
    const wb = libro();
    wb.survey.columns.push("relevant");
    wb.survey.rows.forEach((f) => f.push(""));
    wb.survey.rows[3]![3] = "${q1} = 1 and ${q0} = 2";
    const r = duplicarFila(wb, parseBuilderStructure(wb.survey), 1);
    expect(r.rowIndex).toBe(5);
    expect(tipos(wb).slice(5, 9)).toEqual(["begin_group", "text", "text", "end_group"]);
    expect(rowToRecord(wb.survey, 7).relevant).toBe("${q1_copia} = 1 and ${q0} = 2");
    expect(rowToRecord(wb.survey, 3).relevant).toBe("${q1} = 1 and ${q0} = 2");
  });

  test("secciones destino: no ofrece la sección actual ni la pieza misma", () => {
    const wb = libro();
    const s = parseBuilderStructure(wb.survey);
    expect(seccionesDestino(s, 2).map((d) => d.rowIndex)).toEqual([null]);
    expect(seccionesDestino(s, 0).map((d) => d.rowIndex)).toEqual([1]);
    expect(seccionesDestino(s, 1).map((d) => d.rowIndex)).toEqual([]);
  });

  test("mover a una sección: queda última dentro, antes del cierre", () => {
    const wb = libro();
    const s = parseBuilderStructure(wb.survey);
    const plan = planMoverASeccion(s, 5, 1, wb.survey.rows.length)!;
    applyRowMove(wb.survey, plan);
    expect(nombres(wb)).toEqual(["q0", "sec", "q1", "pregunta_8", "q3", ""]);
    expect(plan.newStart).toBe(4);
    const plan2 = planMoverASeccion(s, 0, 1, wb.survey.rows.length)!;
    expect(plan2.newStart).toBe(3);
  });

  test("mover fuera de toda sección: al final del formulario", () => {
    const wb = libro();
    const s = parseBuilderStructure(wb.survey);
    const plan = planMoverASeccion(s, 2, null, wb.survey.rows.length)!;
    applyRowMove(wb.survey, plan);
    expect(nombres(wb)).toEqual(["q0", "sec", "pregunta_8", "", "q3", "q1"]);
  });

  test("convertir en repetición cambia apertura y cierre, y vuelve", () => {
    const wb = libro();
    expect(alternarRepeticion(wb, parseBuilderStructure(wb.survey), 1)).toBe("repeat");
    expect(tipos(wb)[1]).toBe("begin_repeat");
    expect(tipos(wb)[4]).toBe("end_repeat");
    expect(alternarRepeticion(wb, parseBuilderStructure(wb.survey), 1)).toBe("group");
    expect(tipos(wb)[4]).toBe("end_group");
  });
});
