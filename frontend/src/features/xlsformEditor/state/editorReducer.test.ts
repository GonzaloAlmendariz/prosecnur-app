import { describe, expect, test } from "vitest";
import type { XlsformEditorWorkbook } from "../types";
import {
  canRedoEditor,
  canUndoEditor,
  createInitialEditorState,
  editorReducer,
  type EditorState,
} from "./editorReducer";

function workbook(label: string): XlsformEditorWorkbook {
  return {
    survey: { name: "survey", columns: ["type", "name", "label"], rows: [["text", "p1", label]] },
    choices: { name: "choices", columns: ["list_name", "name", "label"], rows: [] },
    settings: { name: "settings", columns: ["form_title", "form_id"], rows: [["Demo", "demo"]] },
    paper: null,
    diagnostico: null,
    surveyMonkeyLogic: null,
  };
}

describe("editorReducer — colección multi-formulario", () => {
  test("createInitialEditorState arranca sin formulario activo", () => {
    const state = createInitialEditorState(null);
    expect(state.activeFormId).toBeNull();
    expect(state.workbook).toBeNull();
  });

  test("LOAD_FORM setea activeFormId, resetea historia y limpia dirty", () => {
    // Partimos de un estado sucio con historia acumulada.
    let state: EditorState = createInitialEditorState(workbook("original"));
    state = editorReducer(state, { type: "SET", workbook: workbook("editado") });
    expect(canUndoEditor(state)).toBe(true);
    expect(state.dirty).toBe(true);

    const next = editorReducer(state, {
      type: "LOAD_FORM",
      formId: "form-xyz",
      workbook: workbook("cargado"),
    });

    expect(next.activeFormId).toBe("form-xyz");
    expect(next.workbook?.survey.rows[0][2]).toBe("cargado");
    expect(next.dirty).toBe(false);
    expect(next.lastSavedAt).toBeNull();
    // Historia reseteada: no se puede deshacer al formulario anterior.
    expect(canUndoEditor(next)).toBe(false);
    expect(canRedoEditor(next)).toBe(false);
  });

  test("SET tras LOAD_FORM conserva el activeFormId", () => {
    let state = editorReducer(createInitialEditorState(null), {
      type: "LOAD_FORM",
      formId: "form-1",
      workbook: workbook("a"),
    });
    state = editorReducer(state, { type: "SET", workbook: workbook("b") });
    expect(state.activeFormId).toBe("form-1");
    expect(state.dirty).toBe(true);
  });

  test("CLEAR vuelve al hub (workbook null, activeFormId null) sin tocar nada más", () => {
    const loaded = editorReducer(createInitialEditorState(null), {
      type: "LOAD_FORM",
      formId: "form-1",
      workbook: workbook("a"),
    });
    const cleared = editorReducer(loaded, { type: "CLEAR" });
    expect(cleared.workbook).toBeNull();
    expect(cleared.activeFormId).toBeNull();
    expect(cleared.dirty).toBe(false);
    expect(canUndoEditor(cleared)).toBe(false);
  });

  test("UNDO/REDO preservan el activeFormId", () => {
    let state = editorReducer(createInitialEditorState(null), {
      type: "LOAD_FORM",
      formId: "form-1",
      workbook: workbook("a"),
    });
    state = editorReducer(state, { type: "SET", workbook: workbook("b") });
    const undone = editorReducer(state, { type: "UNDO" });
    expect(undone.activeFormId).toBe("form-1");
    expect(undone.workbook?.survey.rows[0][2]).toBe("a");
    const redone = editorReducer(undone, { type: "REDO" });
    expect(redone.activeFormId).toBe("form-1");
    expect(redone.workbook?.survey.rows[0][2]).toBe("b");
  });
});
