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

import {
  PAPER_COLUMNS,
} from "../types";
import type { XlsformEditorSheet, XlsformEditorWorkbook } from "../types";
import {
  apiXlsformEditorStateClear,
  apiXlsformEditorStateSave,
  apiXlsformEditorStateLoad,
  apiXlsformFormSave,
  type Hallazgo,
} from "../../../api/client";

const STORAGE_PREFIX = "pulso.xlsformEditor.workbook.v2";
const META_PREFIX = "pulso.xlsformEditor.meta.v2";
const LIBRARY_PREFIX = "pulso.xlsformEditor.library.v1";

/** Tope de formularios por proyecto. La UI deshabilita las vías de creación al
 *  alcanzarlo y el backend rechaza el intento nº 7 con `E_FORM_LIMIT`. Vive
 *  aquí, junto a la lógica de la biblioteca, para que hub y conmutador
 *  compartan una única fuente de verdad. */
export const MAX_FORMS = 6;

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

/** Sanitiza un formId a un sufijo seguro para localStorage. Los uuid de
 *  `crypto.randomUUID()` ya son seguros; esto solo blinda ids ad-hoc. */
function formKeyPart(formId: string): string {
  return formId.replace(/[^a-zA-Z0-9-]+/g, "_").slice(0, 64) || "form";
}

/** Clave del workbook por-formulario: `...workbook.v2.<scope>.<formId>`. */
function formWorkbookKey(scope: ProjectScope, formId: string): string {
  return `${STORAGE_PREFIX}.${scopeKey(scope)}.${formKeyPart(formId)}`;
}

/** Clave de la metadata por-formulario: `...meta.v2.<scope>.<formId>`. */
function formMetaKey(scope: ProjectScope, formId: string): string {
  return `${META_PREFIX}.${scopeKey(scope)}.${formKeyPart(formId)}`;
}

/** Clave del índice de la biblioteca: `...library.v1.<scope>`. */
function libraryKey(scope: ProjectScope): string {
  return `${LIBRARY_PREFIX}.${scopeKey(scope)}`;
}

// -----------------------------------------------------------------------------
// Índice de la biblioteca multi-formulario
// -----------------------------------------------------------------------------
// Un proyecto aloja varios formularios. El índice es ligero (sin workbooks):
// cada workbook vive en su propia clave `...workbook.v2.<scope>.<formId>`.
// El shape persistido en `...library.v1.<scope>` es:
//
//   { "activeFormId": string | null,
//     "forms": [ { id, name, savedAt, source } ] }
//
// `activeFormId` es campo hermano del array `forms` (no se guarda repetido por
// entrada). Cada entrada de `forms` es solo metadata para pintar el hub y el
// conmutador del toolbar sin cargar los workbooks.

/** Origen de un formulario (import xlsform / surveymonkey / blank…). */
export type FormSource = { kind: string | null; original_name: string | null } | null;

/** Entrada ligera del índice de la biblioteca (sin workbook). */
export type LibraryEntry = {
  id: string;
  name: string;
  savedAt: number;
  source: FormSource;
  /** Conteos calculados por el backend (para tarjetas del hub cuyo workbook aún
   * no está en localStorage). Opcionales: índices locales viejos no los traen. */
  nQuestions?: number;
  nSections?: number;
};

/** Índice completo persistido para un scope. */
export type LibraryIndex = {
  activeFormId: string | null;
  forms: LibraryEntry[];
};

function emptyIndex(): LibraryIndex {
  return { activeFormId: null, forms: [] };
}

function normalizeSource(value: unknown): FormSource {
  if (!isPlainRecord(value)) return null;
  const kind = nullableString(value.kind);
  const originalName = nullableString(value.original_name);
  if (kind == null && originalName == null) return null;
  return { kind, original_name: originalName };
}

function normalizeEntry(value: unknown): LibraryEntry | null {
  if (!isPlainRecord(value)) return null;
  const id = typeof value.id === "string" && value.id.trim() ? value.id : null;
  if (!id) return null;
  return {
    id,
    name: typeof value.name === "string" && value.name.trim() ? value.name : "Formulario",
    savedAt: savedAtOrNow(value.savedAt),
    source: normalizeSource(value.source),
    nQuestions: typeof value.nQuestions === "number" ? value.nQuestions : undefined,
    nSections: typeof value.nSections === "number" ? value.nSections : undefined,
  };
}

function readIndex(scope: ProjectScope): LibraryIndex {
  try {
    const raw = localStorage.getItem(libraryKey(scope));
    if (!raw) return emptyIndex();
    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainRecord(parsed)) return emptyIndex();
    const forms = arrayOrEmpty(parsed.forms)
      .map(normalizeEntry)
      .filter((entry): entry is LibraryEntry => entry != null);
    const activeFormId =
      typeof parsed.activeFormId === "string" && forms.some((f) => f.id === parsed.activeFormId)
        ? parsed.activeFormId
        : null;
    return { activeFormId, forms };
  } catch {
    return emptyIndex();
  }
}

function writeIndex(scope: ProjectScope, index: LibraryIndex): void {
  try {
    localStorage.setItem(libraryKey(scope), JSON.stringify(index));
  } catch {
    // QuotaExceeded / SecurityError — silencioso, igual que saveSnapshot.
  }
}

/** Deriva el nombre visible de un formulario con la cascada:
 *  `settings.form_title` → `source.original_name` sin extensión →
 *  `"Formulario <ordinal>"`. */
export function deriveFormName(
  workbook: XlsformEditorWorkbook,
  source: FormSource,
  fallbackOrdinal = 1,
): string {
  const title = readSettingValue(workbook, "form_title");
  if (title && title.trim()) return title.trim();
  const original = source?.original_name;
  if (original && original.trim()) return stripExtension(original.trim());
  return `Formulario ${fallbackOrdinal}`;
}

function readSettingValue(workbook: XlsformEditorWorkbook, column: string): string | null {
  const settings = workbook.settings;
  if (!settings) return null;
  const idx = settings.columns.indexOf(column);
  if (idx < 0) return null;
  const row = settings.rows[0];
  if (!row) return null;
  const value = row[idx];
  return typeof value === "string" && value.trim() ? value : null;
}

function stripExtension(name: string): string {
  return name.replace(/\.[^./\\]+$/, "");
}

// -----------------------------------------------------------------------------
// API multi-formulario
// -----------------------------------------------------------------------------

/** Lista las entradas ligeras de la biblioteca del scope. */
export function listForms(scope: ProjectScope): LibraryEntry[] {
  return readIndex(scope).forms;
}

/** Id del formulario activo del scope (o null). */
export function getActiveForm(scope: ProjectScope): string | null {
  return readIndex(scope).activeFormId;
}

/** Marca `formId` como activo si existe en el índice. */
export function setActiveForm(scope: ProjectScope, formId: string | null): void {
  const index = readIndex(scope);
  if (formId != null && !index.forms.some((f) => f.id === formId)) return;
  writeIndex(scope, { ...index, activeFormId: formId });
}

/** Lee el snapshot de un formulario concreto. null si no existe o corrupto. */
export function loadForm(scope: ProjectScope, formId: string): PersistedSnapshot | null {
  try {
    const wbRaw = localStorage.getItem(formWorkbookKey(scope, formId));
    if (!wbRaw) return null;
    const workbook = normalizeWorkbookSnapshot(JSON.parse(wbRaw));
    if (!workbook) return null;
    const metaRaw = localStorage.getItem(formMetaKey(scope, formId));
    const meta = metaRaw
      ? JSON.parse(metaRaw) as Record<string, unknown>
      : { savedAt: Date.now(), sourceName: null, sourceKind: null };
    return {
      workbook,
      savedAt: savedAtOrNow(meta.savedAt),
      sourceName: nullableString(meta.sourceName),
      sourceKind: nullableString(meta.sourceKind),
    };
  } catch {
    return null;
  }
}

/** Guarda el workbook de un formulario y actualiza (upsert) su entrada en el
 *  índice. Devuelve el timestamp, o null si falló la escritura. */
export function saveForm(
  scope: ProjectScope,
  formId: string,
  workbook: XlsformEditorWorkbook,
  meta: { sourceName: string | null; sourceKind: string | null },
): number | null {
  try {
    const savedAt = Date.now();
    localStorage.setItem(formWorkbookKey(scope, formId), JSON.stringify(workbook));
    localStorage.setItem(
      formMetaKey(scope, formId),
      JSON.stringify({
        savedAt,
        sourceName: nullableString(meta.sourceName),
        sourceKind: nullableString(meta.sourceKind),
      }),
    );
    const index = readIndex(scope);
    const existingIdx = index.forms.findIndex((f) => f.id === formId);
    const source = normalizeSource({ kind: meta.sourceKind, original_name: meta.sourceName });
    const ordinal = existingIdx >= 0 ? existingIdx + 1 : index.forms.length + 1;
    const entry: LibraryEntry = {
      id: formId,
      name: deriveFormName(workbook, source, ordinal),
      savedAt,
      source,
    };
    const forms = existingIdx >= 0
      ? index.forms.map((f, i) => (i === existingIdx ? entry : f))
      : [...index.forms, entry];
    writeIndex(scope, { activeFormId: index.activeFormId, forms });
    return savedAt;
  } catch {
    return null;
  }
}

/** Inserta o actualiza SOLO la entrada de índice (sin tocar el workbook). Se
 *  usa para reflejar formularios que existen en el backend pero cuyo workbook
 *  aún no se ha bajado a esta máquina. */
export function upsertLibraryEntry(scope: ProjectScope, entry: LibraryEntry): void {
  const index = readIndex(scope);
  const existingIdx = index.forms.findIndex((f) => f.id === entry.id);
  const forms = existingIdx >= 0
    ? index.forms.map((f, i) => (i === existingIdx ? { ...f, ...entry } : f))
    : [...index.forms, entry];
  writeIndex(scope, { activeFormId: index.activeFormId, forms });
}

/** Escribe un valor en la hoja `settings` (columna, primera fila), clonando
 *  el workbook. Crea la columna y/o la fila si no existen. */
function writeSettingValue(
  workbook: XlsformEditorWorkbook,
  column: string,
  value: string,
): XlsformEditorWorkbook {
  const settings = workbook.settings;
  const columns = [...settings.columns];
  let idx = columns.indexOf(column);
  if (idx < 0) {
    columns.push(column);
    idx = columns.length - 1;
  }
  const baseRow = settings.rows[0] ? [...settings.rows[0]] : [];
  while (baseRow.length < columns.length) baseRow.push("");
  baseRow[idx] = value;
  const rows = settings.rows.length > 0
    ? settings.rows.map((row, i) => (i === 0 ? baseRow : row))
    : [baseRow];
  return { ...workbook, settings: { ...settings, columns, rows } };
}

/** Renombra un formulario. Actualiza la entrada del índice y —si hay copia
 *  local del workbook— escribe `settings.form_title` para que el nombre
 *  sobreviva a un futuro autosave (deriveFormName prioriza form_title). No
 *  bloqueante: sincroniza el nombre al backend en segundo plano. Devuelve el
 *  índice resultante. */
export function renameForm(
  scope: ProjectScope,
  formId: string,
  name: string,
): LibraryIndex {
  const trimmed = name.trim();
  if (!trimmed) return readIndex(scope);
  const snap = loadForm(scope, formId);
  if (snap) {
    const workbook = writeSettingValue(snap.workbook, "form_title", trimmed);
    const meta = { sourceName: snap.sourceName, sourceKind: snap.sourceKind };
    saveForm(scope, formId, workbook, meta);
    // Rename opera sobre un formulario existente: nunca dispara E_FORM_LIMIT,
    // pero blindamos el promise huérfano por si el re-throw del tope aflora.
    void syncFormToBackend(formId, workbook, meta).catch(() => {});
  } else {
    const index = readIndex(scope);
    const forms = index.forms.map((f) => (f.id === formId ? { ...f, name: trimmed } : f));
    writeIndex(scope, { ...index, forms });
  }
  return readIndex(scope);
}

/** Borra un formulario (workbook + meta + entrada). Si era el activo, reasigna
 *  al más reciente restante (o null si no queda ninguno). Devuelve el índice
 *  resultante. */
export function deleteForm(scope: ProjectScope, formId: string): LibraryIndex {
  try {
    localStorage.removeItem(formWorkbookKey(scope, formId));
    localStorage.removeItem(formMetaKey(scope, formId));
  } catch {
    // ignore
  }
  const index = readIndex(scope);
  const forms = index.forms.filter((f) => f.id !== formId);
  let activeFormId = index.activeFormId;
  if (activeFormId === formId) {
    const mostRecent = forms.slice().sort((a, b) => b.savedAt - a.savedAt)[0];
    activeFormId = mostRecent ? mostRecent.id : null;
  }
  const next = { activeFormId, forms };
  writeIndex(scope, next);
  return next;
}

/** Migra un proyecto legacy mono-formulario a la biblioteca multi-formulario.
 *  Idempotente: si ya hay índice con formularios, no hace nada. Si no hay
 *  índice pero sí un snapshot legacy (clave sin formId, vía loadSnapshot),
 *  siembra la biblioteca con un id nuevo como activo, SIN borrar la clave
 *  legacy (se retira en una versión posterior). Devuelve el índice resultante. */
export function migrateLegacySingleForm(scope: ProjectScope): LibraryIndex {
  const existing = readIndex(scope);
  if (existing.forms.length > 0) return existing;

  const legacy = loadSnapshot(scope);
  if (!legacy) return existing;

  const formId = newFormId();
  saveForm(scope, formId, legacy.workbook, {
    sourceName: legacy.sourceName,
    sourceKind: legacy.sourceKind,
  });
  setActiveForm(scope, formId);
  return readIndex(scope);
}

/** Genera un id de formulario. Prefiere `crypto.randomUUID()`; cae a un id
 *  pseudoaleatorio si el runtime no lo expone. */
export function newFormId(): string {
  const cryptoObj = typeof globalThis !== "undefined"
    ? (globalThis.crypto as Crypto | undefined)
    : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  return `form-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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

type SurveyMonkeyLogic = NonNullable<XlsformEditorWorkbook["surveyMonkeyLogic"]>;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function arrayOrEmpty<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function stringArrayOrEmpty(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => (item == null ? "" : String(item))) : [];
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function savedAtOrNow(value: unknown): number {
  // Número válido y positivo → tal cual. String ISO (p.ej. el `saved_at` del
  // backend al hidratar un .pulso) → se parsea a ms. Cualquier otra cosa
  // (0, NaN, undefined, string inválido) → ahora, para no mostrar "1970".
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return Date.now();
}

function cloneSurveyMonkeyLogic(logic: XlsformEditorWorkbook["surveyMonkeyLogic"] | unknown): SurveyMonkeyLogic | null {
  if (!isPlainRecord(logic)) return null;
  const advanced = arrayOrEmpty<Record<string, unknown>>(logic.advanced_rules ?? logic.rules)
    .filter(isPlainRecord)
    .map((rule) => ({ ...rule })) as SurveyMonkeyLogic["advanced_rules"];
  const visualRules = arrayOrEmpty<Record<string, unknown>>(logic.visual_rules)
    .filter(isPlainRecord)
    .map((rule) => ({
      ...rule,
      choices: arrayOrEmpty<Record<string, unknown>>(rule.choices)
        .filter(isPlainRecord)
        .map((choice) => ({
          ...choice,
          action: isPlainRecord(choice.action) ? { ...choice.action } : { kind: "none" },
        })),
    })) as SurveyMonkeyLogic["visual_rules"];
  const choiceOrderOverrides = isPlainRecord(logic.choice_order_overrides)
    ? Object.fromEntries(
        Object.entries(logic.choice_order_overrides).map(([key, labels]) => [key, stringArrayOrEmpty(labels)]),
      )
    : {};
  const choiceCodeMaps = arrayOrEmpty<Record<string, unknown>>(logic.choice_code_maps)
    .filter(isPlainRecord)
    .map((map) => ({
      ...map,
      mappings: arrayOrEmpty<Record<string, unknown>>(map.mappings)
        .filter(isPlainRecord)
        .map((item) => ({ ...item })),
    })) as SurveyMonkeyLogic["choice_code_maps"];
  return {
    rules: advanced.map((rule) => ({ ...rule })),
    advanced_rules: advanced,
    visual_rules: visualRules,
    choice_order_overrides: choiceOrderOverrides,
    choice_code_maps: choiceCodeMaps,
  };
}

export function workbookHasSurveyMonkeyLogic(workbook: XlsformEditorWorkbook | null | undefined): boolean {
  const logic = cloneSurveyMonkeyLogic(workbook?.surveyMonkeyLogic);
  if (!logic) return false;
  return (
    logic.advanced_rules.length > 0 ||
    logic.visual_rules.length > 0 ||
    Object.keys(logic.choice_order_overrides).length > 0 ||
    (logic.choice_code_maps ?? []).length > 0
  );
}

export function reconcileSnapshotWithBackend(
  local: PersistedSnapshot | null,
  remote: PersistedSnapshot | null,
): PersistedSnapshot | null {
  if (!local) return remote;
  if (!remote) return local;

  const localLogic = cloneSurveyMonkeyLogic(local.workbook.surveyMonkeyLogic);
  const remoteLogic = cloneSurveyMonkeyLogic(remote.workbook.surveyMonkeyLogic);
  if (!remoteLogic || !workbookHasSurveyMonkeyLogic(remote.workbook)) return local;

  const localHasLogic = workbookHasSurveyMonkeyLogic(local.workbook);
  const mergedLogic: SurveyMonkeyLogic = localHasLogic && localLogic
    ? {
        rules: localLogic.advanced_rules.length ? localLogic.rules ?? localLogic.advanced_rules : remoteLogic.rules ?? remoteLogic.advanced_rules,
        advanced_rules: localLogic.advanced_rules.length ? localLogic.advanced_rules : remoteLogic.advanced_rules,
        visual_rules: localLogic.visual_rules.length ? localLogic.visual_rules : remoteLogic.visual_rules,
        choice_order_overrides: Object.keys(localLogic.choice_order_overrides).length
          ? localLogic.choice_order_overrides
          : remoteLogic.choice_order_overrides,
        choice_code_maps: (localLogic.choice_code_maps ?? []).length ? localLogic.choice_code_maps : remoteLogic.choice_code_maps,
      }
    : remoteLogic;

  return {
    ...local,
    savedAt: Math.max(local.savedAt, remote.savedAt),
    workbook: {
      ...local.workbook,
      surveyMonkeyLogic: mergedLogic,
    },
  };
}

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
        sourceName: nullableString(meta.sourceName),
        sourceKind: nullableString(meta.sourceKind),
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
    const workbook = normalizeWorkbookSnapshot(JSON.parse(wbRaw));
    const meta = metaRaw
      ? JSON.parse(metaRaw) as Record<string, unknown>
      : { savedAt: Date.now(), sourceName: null, sourceKind: null };
    if (!workbook) return null;
    return {
      workbook,
      savedAt: savedAtOrNow(meta.savedAt),
      sourceName: nullableString(meta.sourceName),
      sourceKind: nullableString(meta.sourceKind),
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

/** Limpia el snapshot persistido en backend. Se usa cuando el usuario
 * descarta explícitamente un formulario recuperable. */
export async function clearSnapshotFromBackend(): Promise<void> {
  try {
    await apiXlsformEditorStateClear();
  } catch {
    // ignore — limpiar localStorage ya basta para la sesión local.
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

/** Empuja un snapshot al backend vía /state (deprecado). No bloqueante. Se
 *  conserva para el flujo legacy mono-formulario; el multi-formulario usa
 *  `syncFormToBackend`. */
export async function syncSnapshotToBackend(
  workbook: XlsformEditorWorkbook,
  meta: { sourceName: string | null; sourceKind: string | null; hallazgos?: Hallazgo[] },
): Promise<void> {
  try {
    await apiXlsformEditorStateSave({
      workbook,
      source: { kind: nullableString(meta.sourceKind), original_name: nullableString(meta.sourceName) },
      hallazgos: meta.hallazgos ?? [],
      saved_at: Date.now(),
    });
  } catch {
    // ignore — el snapshot local sigue intacto en localStorage.
  }
}

/** Empuja un formulario concreto al backend vía POST /forms. Cuando el
 *  `formId` es el activo, el backend re-deriva el espejo `s$xlsform_state`
 *  (así los consumidores externos — Carga, Monitoreo — leen el activo
 *  fresco). No bloqueante — los errores se silencian. */
export async function syncFormToBackend(
  formId: string,
  workbook: XlsformEditorWorkbook,
  meta: { sourceName: string | null; sourceKind: string | null; hallazgos?: Hallazgo[] },
): Promise<void> {
  try {
    const source = { kind: nullableString(meta.sourceKind), original_name: nullableString(meta.sourceName) };
    await apiXlsformFormSave({
      id: formId,
      name: deriveFormName(workbook, source),
      workbook,
      source,
      hallazgos: meta.hallazgos ?? [],
      saved_at: Date.now(),
    });
  } catch (err) {
    // El tope compartido (E_FORM_LIMIT) sí es significativo: la UI necesita
    // avisar y revertir la creación local. El resto de errores (red, sesión)
    // se silencian — el snapshot local sigue intacto en localStorage y el
    // próximo autosave reintenta.
    if (isFormLimitError(err)) throw err;
  }
}

/** `true` si el error propagado por el api client corresponde al tope de
 *  formularios del backend (`E_FORM_LIMIT`). El client lo serializa como
 *  `[E_FORM_LIMIT] <mensaje>`, así que basta con inspeccionar el texto. */
export function isFormLimitError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("E_FORM_LIMIT");
}

/** Trae el snapshot desde el backend. null si no hay o si falla. */
export async function loadSnapshotFromBackend(): Promise<PersistedSnapshot | null> {
  try {
    const r = await apiXlsformEditorStateLoad();
    if (!r.has_state || !r.state) return null;
    const st = r.state;
    const workbook = normalizeWorkbookSnapshot(st.workbook);
    if (!workbook) return null;
    return {
      workbook,
      savedAt: savedAtOrNow(st.saved_at),
      sourceName: nullableString(st.source?.original_name),
      sourceKind: nullableString(st.source?.kind),
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
  /** Solicita un guardado del formulario `formId`. Si ya hay uno pendiente,
   *  lo reinicia. */
  schedule: (
    formId: string,
    workbook: XlsformEditorWorkbook,
    meta: { sourceName: string | null; sourceKind: string | null },
    scope?: ProjectScope,
  ) => void;
  /** Fuerza el guardado pendiente inmediato (cancela debounce). Usa el
   *  `formId` con el que se agendó. */
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
    formId: string;
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
    // Guardado local bajo la clave por-formulario + upsert del índice.
    const ts = saveForm(pending.scope, pending.formId, pending.workbook, pending.meta);
    // Fire-and-forget al backend: upsert del formulario en la colección; si
    // es el activo el backend re-deriva el espejo que consume el .pulso.
    void syncFormToBackend(pending.formId, pending.workbook, pending.meta).catch(() => {});
    pending = null;
    if (ts != null && onSaved) onSaved(ts);
    return ts;
  };

  const schedule: PersistenceScheduler["schedule"] = (formId, workbook, meta, scope = null) => {
    pending = { formId, workbook, meta, scope };
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
  return normalizeWorkbookSnapshot(value) != null;
}

function normalizeWorkbookSnapshot(value: unknown): XlsformEditorWorkbook | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const survey = normalizeSheet(v.survey, "survey", null);
  const choices = normalizeSheet(v.choices, "choices", null);
  const settings = normalizeSheet(v.settings, "settings", null);
  if (!survey || !choices || !settings) return null;
  return {
    survey,
    choices,
    settings,
    paper: normalizeSheet(v.paper, "paper", PAPER_COLUMNS),
    diagnostico: normalizeSheet(v.diagnostico, "diagnostico", null),
    surveyMonkeyLogic: cloneSurveyMonkeyLogic(v.surveyMonkeyLogic),
  };
}

function normalizeSheet(
  value: unknown,
  fallbackName: string,
  fallbackColumns: readonly string[] | null,
): XlsformEditorSheet | null {
  if (!isPlainRecord(value)) return null;
  const v = value as Record<string, unknown>;
  const columns = Array.isArray(v.columns)
    ? v.columns.map((column) => (column == null ? "" : String(column)))
    : fallbackColumns == null ? null : [...fallbackColumns];
  if (!columns) return null;
  const rows = Array.isArray(v.rows)
    ? v.rows.map((row) => Array.isArray(row) ? row.map((cell) => (cell == null ? "" : String(cell))) : [])
    : [];
  return {
    name: typeof v.name === "string" ? v.name : fallbackName,
    columns,
    rows,
  };
}
