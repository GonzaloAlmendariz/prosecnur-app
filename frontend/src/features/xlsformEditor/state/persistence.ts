// =============================================================================
// state/persistence.ts — autosave del workbook a localStorage
// =============================================================================
// El editor del XLSForm puede tener docenas de cambios sin exportar. Si el
// usuario cierra la pestaña accidentalmente o la app crashea, perdemos todo.
//
// Este módulo persiste el workbook en localStorage cada N segundos
// (default 2s) después de la última edición. Al volver a montar el módulo,
// el componente principal puede leer el snapshot y ofrecer al usuario
// "Continuar editando" vs "Empezar de cero".
//
// Por qué localStorage:
//   - El constructor es trabajo en curso, no un estado efímero.
//   - Debe sobrevivir salir de la app y volver a entrar.
//   - El usuario puede descartarlo explícitamente desde el home.
// =============================================================================

import type { XlsformEditorWorkbook } from "../types";
import {
  apiXlsformEditorStateSave,
  apiXlsformEditorStateLoad,
  type Hallazgo,
} from "../../../api/client";

const STORAGE_KEY = "pulso.xlsformEditor.workbook.v1";
const META_KEY = "pulso.xlsformEditor.meta.v1";
const LEGACY_SESSION_STORAGE_KEY = STORAGE_KEY;
const LEGACY_SESSION_META_KEY = META_KEY;

export type PersistedSnapshot = {
  workbook: XlsformEditorWorkbook;
  savedAt: number;
  /** Nombre original del archivo que se importó (si lo hay). */
  sourceName: string | null;
  /** Tipo de origen: "xlsform" | "surveymonkey" | "blank" | null. */
  sourceKind: string | null;
  /** Hallazgos del validador (si vinieron del último import). */
  hallazgos?: Hallazgo[];
};

// -----------------------------------------------------------------------------
// Save / Load
// -----------------------------------------------------------------------------

/**
 * Guarda un workbook en localStorage junto con metadata. NO debounceado —
 * el caller es responsable de invocar este método con la frecuencia que
 * desee (ver `createPersistenceScheduler`).
 *
 * Devuelve el timestamp de guardado, o null si falla (quota exceeded, etc.).
 */
export function saveSnapshot(
  workbook: XlsformEditorWorkbook,
  meta: { sourceName: string | null; sourceKind: string | null },
): number | null {
  try {
    const savedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workbook));
    localStorage.setItem(
      META_KEY,
      JSON.stringify({
        savedAt,
        sourceName: meta.sourceName,
        sourceKind: meta.sourceKind,
      }),
    );
    return savedAt;
  } catch {
    // QuotaExceeded o SecurityError — silencioso. El logSink ya capta esto.
    return null;
  }
}

/** Lee el snapshot persistido. Devuelve null si no hay o si está corrupto. */
export function loadSnapshot(): PersistedSnapshot | null {
  try {
    let wbRaw = localStorage.getItem(STORAGE_KEY);
    let metaRaw = localStorage.getItem(META_KEY);
    // Migración suave de snapshots viejos guardados en sessionStorage.
    if (!wbRaw) {
      wbRaw = sessionStorage.getItem(LEGACY_SESSION_STORAGE_KEY);
      metaRaw = sessionStorage.getItem(LEGACY_SESSION_META_KEY);
    }
    if (!wbRaw) return null;
    const workbook = JSON.parse(wbRaw) as XlsformEditorWorkbook;
    const meta = metaRaw
      ? (JSON.parse(metaRaw) as { savedAt: number; sourceName: string | null; sourceKind: string | null })
      : { savedAt: Date.now(), sourceName: null, sourceKind: null };
    if (!isWorkbookShape(workbook)) return null;
    return {
      workbook,
      savedAt: meta.savedAt ?? Date.now(),
      sourceName: meta.sourceName ?? null,
      sourceKind: meta.sourceKind ?? null,
    };
  } catch {
    return null;
  }
}

/** Borra cualquier snapshot persistido. Útil al exportar o al "empezar de cero". */
export function clearSnapshot(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(META_KEY);
    sessionStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
    sessionStorage.removeItem(LEGACY_SESSION_META_KEY);
  } catch {
    // ignore
  }
}

// -----------------------------------------------------------------------------
// Sincronización con el backend (.pulso)
// -----------------------------------------------------------------------------
// Cuando hay proyecto activo, además de localStorage también empujamos
// el snapshot al backend vía POST /api/xlsform-editor/state. Eso lo deja
// en `s$xlsform_state` y viaja con build_pulso al .pulso.
//
// localStorage sigue siendo el primer recurso (rápido, offline) y el
// backend es el que sobrevive cierre de tab + reopen de proyecto.

/** Empuja un snapshot al backend. No bloqueante — los errores se silencian. */
export async function syncSnapshotToBackend(
  workbook: XlsformEditorWorkbook,
  meta: { sourceName: string | null; sourceKind: string | null; hallazgos?: Hallazgo[] },
): Promise<void> {
  try {
    await apiXlsformEditorStateSave({
      workbook,
      source: { kind: meta.sourceKind, original_name: meta.sourceName },
      hallazgos: meta.hallazgos ?? [],
      saved_at: Date.now(),
    });
  } catch {
    // ignore — el snapshot local sigue intacto en localStorage.
  }
}

/** Trae el snapshot desde el backend. null si no hay o si falla. */
export async function loadSnapshotFromBackend(): Promise<PersistedSnapshot | null> {
  try {
    const r = await apiXlsformEditorStateLoad();
    if (!r.has_state || !r.state) return null;
    const st = r.state;
    if (!isWorkbookShape(st.workbook)) return null;
    return {
      workbook: st.workbook,
      savedAt: st.saved_at ?? Date.now(),
      sourceName: st.source?.original_name ?? null,
      sourceKind: st.source?.kind ?? null,
      hallazgos: st.hallazgos ?? [],
    };
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Scheduler con debounce
// -----------------------------------------------------------------------------

export type PersistenceScheduler = {
  /** Solicita un guardado. Si ya hay uno pendiente, lo reinicia. */
  schedule: (workbook: XlsformEditorWorkbook, meta: { sourceName: string | null; sourceKind: string | null }) => void;
  /** Fuerza un guardado inmediato (cancela debounce). */
  flush: () => number | null;
  /** Cancela el guardado pendiente sin escribir. */
  cancel: () => void;
};

/**
 * Crea un scheduler que debounceará llamadas a `saveSnapshot`. Default 2s
 * después de la última solicitud → escribe.
 *
 * El callback opcional `onSaved(savedAt)` se invoca tras cada guardado
 * exitoso (útil para actualizar el UI con "Guardado hace X").
 */
export function createPersistenceScheduler(
  onSaved?: (savedAt: number) => void,
  delayMs = 2000,
): PersistenceScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { workbook: XlsformEditorWorkbook; meta: { sourceName: string | null; sourceKind: string | null } } | null = null;

  const flush = (): number | null => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!pending) return null;
    const ts = saveSnapshot(pending.workbook, pending.meta);
    // Fire-and-forget al backend para que el state viaje con el .pulso.
    // Si no hay proyecto activo o no hay backend, falla silenciosamente.
    void syncSnapshotToBackend(pending.workbook, pending.meta);
    pending = null;
    if (ts != null && onSaved) onSaved(ts);
    return ts;
  };

  const schedule: PersistenceScheduler["schedule"] = (workbook, meta) => {
    pending = { workbook, meta };
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, delayMs);
  };

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pending = null;
  };

  return { schedule, flush, cancel };
}

// -----------------------------------------------------------------------------
// Validación de shape (defensiva al deserializar)
// -----------------------------------------------------------------------------

function isWorkbookShape(value: unknown): value is XlsformEditorWorkbook {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return isSheetShape(v.survey) && isSheetShape(v.choices) && isSheetShape(v.settings);
}

function isSheetShape(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.columns) && Array.isArray(v.rows);
}
