// =============================================================================
// state/persistence.ts — autosave del workbook a localStorage (por proyecto)
// =============================================================================
// El editor del XLSForm puede tener docenas de cambios sin exportar. Si el
// usuario cierra la pestaña accidentalmente o la app crashea, perdemos todo.
//
// Este módulo persiste el workbook en localStorage cada N segundos
// (default 2s) después de la última edición. Al volver a montar el módulo,
// el componente principal puede leer el snapshot y ofrecer al usuario
// "Continuar editando" vs "Empezar de cero".
//
// Persistencia POR PROYECTO: las claves incluyen un hash del path del
// `.pulso` activo, así cada proyecto tiene su propio snapshot y abrir
// otro proyecto no muestra el formulario en curso del anterior. Cuando
// no hay proyecto activo se usa la clave `no-project` (un solo bucket
// para el flujo "modo navegador" sin .pulso).
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

const STORAGE_PREFIX = "pulso.xlsformEditor.workbook.v2";
const META_PREFIX = "pulso.xlsformEditor.meta.v2";

/** v1 keys (sin scope de proyecto) — solo se leen como migración. */
const LEGACY_V1_STORAGE = "pulso.xlsformEditor.workbook.v1";
const LEGACY_V1_META = "pulso.xlsformEditor.meta.v1";

/** Identifica el bucket de persistencia. Pasar el path del `.pulso` activo
 *  o null si no hay proyecto. */
export type ProjectScope = string | null;

/** Sanitiza el path del proyecto a un sufijo seguro para localStorage. No
 *  necesitamos reversibilidad — solo discriminar entre proyectos
 *  distintos. Reemplazamos cualquier no-alfanumérico por `_`. */
function scopeKey(scope: ProjectScope): string {
  if (!scope || scope.trim() === "") return "no-project";
  // Limitamos a 80 chars para no inflar la clave indefinidamente.
  return scope.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 80) || "no-project";
}

function workbookKey(scope: ProjectScope): string {
  return `${STORAGE_PREFIX}.${scopeKey(scope)}`;
}

function metaKey(scope: ProjectScope): string {
  return `${META_PREFIX}.${scopeKey(scope)}`;
}

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
 * Guarda un workbook en localStorage junto con metadata, scopeado al
 * proyecto activo (o `no-project` si no hay).
 *
 * Devuelve el timestamp de guardado, o null si falla (quota exceeded, etc.).
 */
export function saveSnapshot(
  workbook: XlsformEditorWorkbook,
  meta: { sourceName: string | null; sourceKind: string | null },
  scope: ProjectScope = null,
): number | null {
  try {
    const savedAt = Date.now();
    localStorage.setItem(workbookKey(scope), JSON.stringify(workbook));
    localStorage.setItem(
      metaKey(scope),
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

/** Lee el snapshot persistido para el proyecto dado. Devuelve null si no
 *  hay o si está corrupto. Como migración suave: si no encuentra v2 en
 *  el bucket `no-project` y existe v1 (legacy global), lo migra ahí.
 *  Para proyectos con scope nunca migramos v1 — esos snapshots eran
 *  pre-feature y no podemos saber a qué proyecto correspondían. */
export function loadSnapshot(scope: ProjectScope = null): PersistedSnapshot | null {
  try {
    let wbRaw = localStorage.getItem(workbookKey(scope));
    let metaRaw = localStorage.getItem(metaKey(scope));

    // Migración v1 → v2 SOLO para el bucket no-project: el snapshot
    // legacy era global y conviene preservarlo cuando el usuario está
    // sin proyecto, pero no asumirlo como propio de un proyecto X.
    if (!wbRaw && scopeKey(scope) === "no-project") {
      wbRaw = localStorage.getItem(LEGACY_V1_STORAGE);
      metaRaw = localStorage.getItem(LEGACY_V1_META);
      if (!wbRaw) {
        wbRaw = sessionStorage.getItem(LEGACY_V1_STORAGE);
        metaRaw = sessionStorage.getItem(LEGACY_V1_META);
      }
      // Si vino de v1, lo persistimos en v2 para que la próxima carga
      // ya use el path moderno y dejemos de tocar el legacy.
      if (wbRaw) {
        try {
          localStorage.setItem(workbookKey(scope), wbRaw);
          if (metaRaw) localStorage.setItem(metaKey(scope), metaRaw);
          localStorage.removeItem(LEGACY_V1_STORAGE);
          localStorage.removeItem(LEGACY_V1_META);
        } catch {
          // ignore
        }
      }
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

/** Borra el snapshot del proyecto indicado (útil al exportar o al
 *  "empezar de cero"). */
export function clearSnapshot(scope: ProjectScope = null): void {
  try {
    localStorage.removeItem(workbookKey(scope));
    localStorage.removeItem(metaKey(scope));
    // Si estamos limpiando no-project, también borramos el legacy v1
    // para no resucitarlo en una recarga.
    if (scopeKey(scope) === "no-project") {
      localStorage.removeItem(LEGACY_V1_STORAGE);
      localStorage.removeItem(LEGACY_V1_META);
      sessionStorage.removeItem(LEGACY_V1_STORAGE);
      sessionStorage.removeItem(LEGACY_V1_META);
    }
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
  schedule: (
    workbook: XlsformEditorWorkbook,
    meta: { sourceName: string | null; sourceKind: string | null },
    scope?: ProjectScope,
  ) => void;
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
  let pending: {
    workbook: XlsformEditorWorkbook;
    meta: { sourceName: string | null; sourceKind: string | null };
    scope: ProjectScope;
  } | null = null;

  const flush = (): number | null => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!pending) return null;
    const ts = saveSnapshot(pending.workbook, pending.meta, pending.scope);
    // Fire-and-forget al backend para que el state viaje con el .pulso.
    // Si no hay proyecto activo o no hay backend, falla silenciosamente.
    void syncSnapshotToBackend(pending.workbook, pending.meta);
    pending = null;
    if (ts != null && onSaved) onSaved(ts);
    return ts;
  };

  const schedule: PersistenceScheduler["schedule"] = (workbook, meta, scope = null) => {
    pending = { workbook, meta, scope };
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
