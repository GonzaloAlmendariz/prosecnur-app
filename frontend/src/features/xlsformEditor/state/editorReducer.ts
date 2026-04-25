// =============================================================================
// state/editorReducer.ts — reducer del workbook + historia de undo/redo
// =============================================================================
// Diseño "set workbook" (no granular): cada vez que el caller calcula un nuevo
// workbook, lo despacha completo y el reducer:
//   1. Empuja el workbook anterior al `UndoStack` (si `pushHistory=true`).
//   2. Reemplaza el workbook actual.
//   3. Marca `dirty=true` y resetea `lastSavedAt` a null (hasta el próximo
//      autosave).
//
// Se mantiene este patrón en lugar de acciones tipadas por mutación
// (PATCH_ROW, INSERT_ROW, etc.) porque el monolito ya tiene ~20 sitios donde
// se calcula el nuevo workbook con `cloneWorkbook` + mutación. Migrarlos
// uno por uno ahora multiplica el riesgo; con este reducer la migración
// es de 1 línea por sitio (`setWorkbook(next)` → `dispatch({ type: "SET",
// workbook: next })`).
//
// Las acciones especiales:
//   - "LOAD"       → reemplaza workbook + resetea historia (al importar).
//   - "UNDO"/"REDO" → mueve el cursor del UndoStack y aplica.
//   - "MARK_SAVED" → setea dirty=false y guarda lastSavedAt.
//   - "CLEAR"      → workbook=null, historia vacía (volver al EmptyHome).
// =============================================================================

import type { XlsformEditorWorkbook } from "../types";
import {
  canRedoUndoStack,
  canUndoUndoStack,
  createUndoStack,
  currentUndoStack,
  emptyUndoStack,
  pushUndoStack,
  redoUndoStack,
  resetUndoStack,
  undoUndoStack,
  type UndoStack,
} from "./undoStack";

// -----------------------------------------------------------------------------
// Tipos
// -----------------------------------------------------------------------------

export type EditorState = {
  workbook: XlsformEditorWorkbook | null;
  /** Hay cambios sin persistir/exportar. */
  dirty: boolean;
  /** Último timestamp en que se confirmó persistencia (ms epoch). */
  lastSavedAt: number | null;
  /** Stack de undo/redo del workbook. */
  history: UndoStack<XlsformEditorWorkbook | null>;
};

export type EditorAction =
  /**
   * Reemplaza el workbook con uno nuevo y empuja el anterior a la historia.
   * Usado por todas las mutaciones del editor (patch, insert, move, etc.).
   */
  | { type: "SET"; workbook: XlsformEditorWorkbook | null }
  /**
   * Carga un workbook nuevo: resetea la historia y marca dirty=false.
   * Usado al importar XLSForm/SurveyMonkey o restaurar un snapshot.
   */
  | { type: "LOAD"; workbook: XlsformEditorWorkbook | null }
  /** Vuelve al EmptyHome — historia limpia, workbook null, dirty=false. */
  | { type: "CLEAR" }
  /** Mueve el cursor de historia atrás. */
  | { type: "UNDO" }
  /** Mueve el cursor de historia adelante. */
  | { type: "REDO" }
  /** Marca el workbook como guardado (autosave / export confirmados). */
  | { type: "MARK_SAVED"; savedAt: number };

// -----------------------------------------------------------------------------
// Estado inicial
// -----------------------------------------------------------------------------

export function createInitialEditorState(
  initialWorkbook: XlsformEditorWorkbook | null = null,
): EditorState {
  return {
    workbook: initialWorkbook,
    dirty: false,
    lastSavedAt: null,
    history: initialWorkbook != null
      ? createUndoStack<XlsformEditorWorkbook | null>(initialWorkbook)
      : emptyUndoStack<XlsformEditorWorkbook | null>(),
  };
}

// -----------------------------------------------------------------------------
// Reducer puro
// -----------------------------------------------------------------------------

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET": {
      // No-op si el workbook nuevo es referencialmente igual al actual.
      if (action.workbook === state.workbook) return state;
      const history = pushUndoStack(state.history, action.workbook);
      return {
        workbook: action.workbook,
        dirty: true,
        lastSavedAt: null,
        history,
      };
    }
    case "LOAD": {
      const history =
        action.workbook != null
          ? resetUndoStack<XlsformEditorWorkbook | null>(action.workbook)
          : emptyUndoStack<XlsformEditorWorkbook | null>();
      return {
        workbook: action.workbook,
        dirty: false,
        lastSavedAt: null,
        history,
      };
    }
    case "CLEAR": {
      return {
        workbook: null,
        dirty: false,
        lastSavedAt: null,
        history: emptyUndoStack<XlsformEditorWorkbook | null>(),
      };
    }
    case "UNDO": {
      if (!canUndoUndoStack(state.history)) return state;
      const history = undoUndoStack(state.history);
      const wb = currentUndoStack(history);
      return {
        ...state,
        workbook: wb,
        dirty: true,
        lastSavedAt: null,
        history,
      };
    }
    case "REDO": {
      if (!canRedoUndoStack(state.history)) return state;
      const history = redoUndoStack(state.history);
      const wb = currentUndoStack(history);
      return {
        ...state,
        workbook: wb,
        dirty: true,
        lastSavedAt: null,
        history,
      };
    }
    case "MARK_SAVED": {
      return { ...state, dirty: false, lastSavedAt: action.savedAt };
    }
    default: {
      // Exhaustiveness check: si TS detecta un type no manejado,
      // el `never` falla en compilación.
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}

// -----------------------------------------------------------------------------
// Selectores derivados (helpers para el componente)
// -----------------------------------------------------------------------------

export function canUndoEditor(state: EditorState): boolean {
  return canUndoUndoStack(state.history);
}

export function canRedoEditor(state: EditorState): boolean {
  return canRedoUndoStack(state.history);
}
