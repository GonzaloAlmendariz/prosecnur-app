// =============================================================================
// state/persistence.ts — autosave del workbook a sessionStorage
// =============================================================================
// El editor del XLSForm puede tener docenas de cambios sin exportar. Si el
// usuario cierra la pestaña accidentalmente o la app crashea, perdemos todo.
//
// Este módulo persiste el workbook en sessionStorage cada N segundos
// (default 2s) después de la última edición. Al volver a montar el módulo,
// el componente principal puede leer el snapshot y ofrecer al usuario
// "Continuar editando" vs "Empezar de cero".
//
// Por qué sessionStorage y no localStorage:
//   - sessionStorage se limpia al cerrar la pestaña → no contamina sessions
//     futuras con un workbook abandonado.
//   - Sí sobrevive un reload (típico tras crash) — es lo que queremos.
//   - El logSink (commit 03de4ce) ya usa el mismo storage para sus entries.
// =============================================================================

import type { XlsformEditorWorkbook } from "../types";

const STORAGE_KEY = "pulso.xlsformEditor.workbook.v1";
const META_KEY = "pulso.xlsformEditor.meta.v1";

export type PersistedSnapshot = {
  workbook: XlsformEditorWorkbook;
  savedAt: number;
  /** Nombre original del archivo que se importó (si lo hay). */
  sourceName: string | null;
  /** Tipo de origen: "xlsform" | "surveymonkey" | "blank" | null. */
  sourceKind: string | null;
};

// -----------------------------------------------------------------------------
// Save / Load
// -----------------------------------------------------------------------------

/**
 * Guarda un workbook en sessionStorage junto con metadata. NO debounceado —
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
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(workbook));
    sessionStorage.setItem(
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
    const wbRaw = sessionStorage.getItem(STORAGE_KEY);
    const metaRaw = sessionStorage.getItem(META_KEY);
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
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(META_KEY);
  } catch {
    // ignore
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
