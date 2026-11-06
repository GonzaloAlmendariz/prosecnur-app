// Mata: un conjoint que pisa nombres existentes, que entra en otro lugar que el «+», que deja su lista de elección
// fuera de choices o que se inserta a medias cuando el diseño es inválido.
import { describe, expect, it } from "vitest";
import { parseBuilderStructure } from "../parsing/buildIndex";
import { rowToRecord } from "../parsing/sheetUtils";
import type { XlsformEditorWorkbook } from "../types";
import { insertarConjoint, prefijoLibre } from "./insertarConjoint";
import type { DisenoConjoint } from "./modeloConjoint";

const formulario = (): XlsformEditorWorkbook => ({
  survey: { name: "survey", columns: ["type", "name", "label"], rows: [["text", "nombre", "Nombre"], ["integer", "edad", "Edad"]] },
  choices: { name: "choices", columns: ["list_name", "name", "label"], rows: [["sino", "1", "Sí"]] },
  settings: { name: "settings", columns: ["form_title"], rows: [["Prueba"]] },
});

const diseno = (prefijo = "cj"): DisenoConjoint => ({
  prefijo,
  tareas: 2,
  rotulosPerfil: ["A", "B"],
  pregunta: "¿Cuál?",
  atributos: [
    { clave: "x", rotulo: "X", niveles: [{ codigo: "1", texto: "Uno" }, { codigo: "2", texto: "Dos" }] },
    { clave: "y", rotulo: "Y", niveles: [{ codigo: "a", texto: "A" }, { codigo: "b", texto: "B" }] },
  ],
});

describe("insertar un conjoint", () => {
  it("entra entero después de la fila del «+» y agrega su lista", () => {
    const wb = formulario();
    const r = insertarConjoint(wb, parseBuilderStructure(wb.survey), { despuesDeFila: 0, seccionFila: null }, diseno());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rowIndex).toBe(1);
    expect(rowToRecord(wb.survey, 0).name).toBe("nombre");
    expect(rowToRecord(wb.survey, 1).name).toBe("cj_t1A_x_r");
    expect(rowToRecord(wb.survey, wb.survey.rows.length - 1).name).toBe("edad");
    expect(wb.survey.columns).toEqual(expect.arrayContaining(["calculation", "appearance", "required"]));
    expect(wb.choices.rows.filter((_, i) => rowToRecord(wb.choices, i).list_name === "cj_perfil")).toHaveLength(2);
    expect(r.calculos).toBe(2 * 2 * 2 * 3);
  });

  it("un prefijo ya usado no inserta nada y propone uno libre", () => {
    const wb = formulario();
    insertarConjoint(wb, parseBuilderStructure(wb.survey), { despuesDeFila: null, seccionFila: null }, diseno());
    const antes = wb.survey.rows.length;
    const r = insertarConjoint(wb, parseBuilderStructure(wb.survey), { despuesDeFila: null, seccionFila: null }, diseno());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivos[0]).toMatch(/«cj2»/);
    expect(wb.survey.rows.length).toBe(antes);
    expect(prefijoLibre(wb)).toBe("cj2");
  });

  it("un diseño inválido no toca el formulario", () => {
    const wb = formulario();
    const r = insertarConjoint(wb, parseBuilderStructure(wb.survey), { despuesDeFila: null, seccionFila: null }, { ...diseno(), tareas: 0 });
    expect(r.ok).toBe(false);
    expect(wb.survey.rows.length).toBe(2);
  });
});
