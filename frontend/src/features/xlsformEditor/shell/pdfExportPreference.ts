// =============================================================================
// shell/pdfExportPreference.ts — lógica pura del selector "DISEÑO DEL PDF"
// =============================================================================
// El popover del split-button de exportación combina tres dimensiones: número de
// columnas (1/2), lenguaje de lógica del cuestionario (saltos/condiciones) y si
// se imprimen los recuadros de N.º de cuestionario en la cabecera. Aquí viven los
// tipos y los helpers puros de etiquetado para poder testearlos sin montar el
// componente.
// =============================================================================

import type { MatrixCandidate } from "../parsing/detectMatrixCandidates";
import { scopeKey } from "../state/persistence";

/**
 * Columnas del PDF de papel.
 *   - 1 / 2: reparto fijo, el de siempre;
 *   - "auto": el motor corta el instrumento en TRAMOS y decide por tramo — una
 *     batería ancha se queda a página completa y el bloque de preguntas cortas
 *     que la rodea va a dos columnas.
 *
 * "auto" existía en el motor desde el reparto equilibrado pero no aquí, así que
 * no había forma de elegirlo sin teclear la opción a mano: una capacidad del
 * motor no está terminada mientras sólo se alcance por fuera del editor.
 */
export type PdfColumns = 1 | 2 | "auto";
export type PdfLogicLanguage = "saltos" | "condiciones";

/**
 * Ancho de las tablas de matriz en el PDF (opción GLOBAL):
 *   - "full": la matriz ocupa todo el ancho de la página (default);
 *   - "column": la matriz fluye dentro de una columna (útil en 2 columnas).
 */
export type PdfMatrixLayout = "full" | "column";

/**
 * Cabecera de una matriz en el PDF:
 *   - "auto": el motor R decide (default; se omite del payload);
 *   - "extremos": rotula solo los extremos de la escala;
 *   - "categorias": rotula cada categoría de la escala.
 */
export type MatrixHeader = "auto" | "extremos" | "categorias";

/**
 * Selección de columna especial ("sin información") de una matriz:
 *   - "auto": el motor R la detecta (comportamiento histórico; se omite del payload);
 *   - "none": la matriz no tiene columna especial;
 *   - cualquier otro string: el código de opción elegido explícitamente.
 */
export type MatrixSpecial = "auto" | "none" | string;

/**
 * Grupo de matriz enviado al motor R. `members` son los nombres de variable de
 * las preguntas del run; `tenor` es el enunciado guía opcional de la tabla
 * (cuando viene, ese tenor toma el número X y las filas pasan a X.1, X.2…);
 * `special` fija la columna de "sin información" (se omite cuando es "auto");
 * `header` fija el estilo de cabecera de la escala (se omite cuando es "auto").
 */
export type MatrixGroupPayload = {
  members: string[];
  tenor?: string;
  special?: string;
  header?: string;
};

/**
 * Arma `options.matrix_groups` a partir de los candidatos detectados, el set de
 * ids DESACTIVADOS (default = todos activos), el map id→tenor, el map
 * id→columna especial y el map id→cabecera. Los candidatos desactivados se
 * omiten; el tenor vacío o de solo espacios se descarta; `special` y `header`
 * se incluyen solo cuando NO son "auto".
 */
export function buildMatrixGroups(
  candidates: readonly MatrixCandidate[],
  disabledIds: ReadonlySet<string>,
  tenorById: Readonly<Record<string, string>>,
  specialById: Readonly<Record<string, string>> = {},
  headerById: Readonly<Record<string, string>> = {},
): MatrixGroupPayload[] {
  return candidates
    .filter((candidate) => !disabledIds.has(candidate.id))
    .map((candidate) => {
      const tenor = (tenorById[candidate.id] ?? "").trim();
      const special = (specialById[candidate.id] ?? "auto").trim() || "auto";
      const header = (headerById[candidate.id] ?? "auto").trim() || "auto";
      const group: MatrixGroupPayload = { members: candidate.memberNames };
      if (tenor) group.tenor = tenor;
      if (special !== "auto") group.special = special;
      if (header !== "auto") group.header = header;
      return group;
    });
}

export type PdfExportPreference = {
  columns: PdfColumns;
  logicLanguage: PdfLogicLanguage;
  showQuestionnaireNumber: boolean;
};

export const DEFAULT_PDF_EXPORT_PREFERENCE: PdfExportPreference = {
  columns: 2,
  logicLanguage: "saltos",
  showQuestionnaireNumber: true,
};

export function columnsLabel(columns: PdfColumns): string {
  if (columns === "auto") return "columnas automáticas";
  return columns === 1 ? "una columna" : "dos columnas";
}

export function logicLanguageLabel(logicLanguage: PdfLogicLanguage): string {
  return logicLanguage === "saltos" ? "saltos" : "condiciones";
}

export function questionnaireNumberLabel(showQuestionnaireNumber: boolean): string {
  return showQuestionnaireNumber ? "con N.º de cuestionario" : "sin N.º de cuestionario";
}

/** Texto del `title` del botón principal: refleja las dimensiones activas. */
export function exportButtonTitle(pref: PdfExportPreference): string {
  return `Exportar PDF (${columnsLabel(pref.columns)}, ${logicLanguageLabel(pref.logicLanguage)}, ${questionnaireNumberLabel(pref.showQuestionnaireNumber)})`;
}

// =============================================================================
// Estado completo del diálogo «Configurar PDF» y su persistencia
// =============================================================================
// Las elecciones del diálogo vivían en `useState` y morían al recargar o al
// reabrir el proyecto. Ahora se guardan en localStorage por proyecto +
// formulario. Las matrices se indexan por su FIRMA (nombres de sus miembros),
// no por el id del candidato: ese id deriva de la fila y cambia en cuanto se
// inserta una pregunta arriba, con lo que el tenor de una matriz terminaría
// aplicado a otra.
// =============================================================================

/** Defaults del motor (`reporte_formulario_pdf.R`). */
export const ENGINE_MAX_OPTIONS_PER_QUESTION = 18;
export const MIN_MAX_OPTIONS_PER_QUESTION = 4;

/** Elección del usuario para UNA matriz candidata. Campos ausentes = default. */
export type PdfMatrixChoice = {
  /** Ausente = default (activa si agrupa 2+ preguntas). */
  enabled?: boolean;
  tenor?: string;
  special?: string;
  header?: string;
};

export type PdfDialogState = {
  columns: PdfColumns;
  logicLanguage: PdfLogicLanguage;
  showQuestionnaireNumber: boolean;
  matrixLayout: PdfMatrixLayout;
  /** `name` de la pregunta de consentimiento o "" = ninguna. */
  consentVar: string;
  maxOptionsPerQuestion: number;
  /** Banda «INSTRUCCIONES» por defecto cuando no hay intro propia. */
  defaultIntro: boolean;
  showHeaderTitle: boolean;
  /** Elecciones por matriz, indexadas por `matrixSignature`. */
  matrices: Record<string, PdfMatrixChoice>;
};

export const DEFAULT_PDF_DIALOG_STATE: PdfDialogState = {
  ...DEFAULT_PDF_EXPORT_PREFERENCE,
  matrixLayout: "full",
  consentVar: "",
  maxOptionsPerQuestion: ENGINE_MAX_OPTIONS_PER_QUESTION,
  defaultIntro: true,
  showHeaderTitle: true,
  matrices: {},
};

/** Firma estable de una matriz: sus miembros en orden. */
export function matrixSignature(candidate: Pick<MatrixCandidate, "memberNames">): string {
  return candidate.memberNames.join("|");
}

/** Elección efectiva de un candidato (default si no hay nada guardado). */
export function matrixChoiceFor(
  candidate: MatrixCandidate,
  matrices: Readonly<Record<string, PdfMatrixChoice>>,
): Required<PdfMatrixChoice> {
  const saved = matrices[matrixSignature(candidate)] ?? {};
  // Una columna especial guardada que ya no existe en la escala (la lista
  // cambió) vuelve a "auto" en vez de viajar al motor como código fantasma.
  const special = saved.special ?? "auto";
  const specialAlive =
    special === "auto" || special === "none" || candidate.scaleOptions.some((o) => o.code === special);
  return {
    enabled: saved.enabled ?? candidate.count >= 2,
    tenor: saved.tenor ?? "",
    special: specialAlive ? special : "auto",
    header: saved.header ?? "auto",
  };
}

/** `options.matrix_groups` desde las elecciones por firma; las firmas que ya no
 *  corresponden a un candidato se ignoran. */
export function buildMatrixGroupsFromChoices(
  candidates: readonly MatrixCandidate[],
  matrices: Readonly<Record<string, PdfMatrixChoice>>,
): MatrixGroupPayload[] {
  const disabled = new Set<string>();
  const tenor: Record<string, string> = {};
  const special: Record<string, string> = {};
  const header: Record<string, string> = {};
  for (const candidate of candidates) {
    const choice = matrixChoiceFor(candidate, matrices);
    if (!choice.enabled) disabled.add(candidate.id);
    tenor[candidate.id] = choice.tenor;
    special[candidate.id] = choice.special;
    header[candidate.id] = choice.header;
  }
  return buildMatrixGroups(candidates, disabled, tenor, special, header);
}

/** Entero válido para el motor o null. */
export function parseMaxOptionsPerQuestion(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  if (!Number.isInteger(n) || n < MIN_MAX_OPTIONS_PER_QUESTION) return null;
  return n;
}

/** Opciones de export-pdf/export-word. Las tres opciones nuevas del motor sólo
 *  viajan cuando difieren de su default; una variable de consentimiento que ya
 *  no está entre las candidatas no se envía. */
export function buildPaperExportOptions(
  state: PdfDialogState,
  candidates: readonly MatrixCandidate[],
  consentNames: readonly string[],
): {
  columns: PdfColumns;
  logic_language: PdfLogicLanguage;
  show_questionnaire_number: boolean;
  matrix_layout: PdfMatrixLayout;
  matrix_groups: MatrixGroupPayload[];
  consent_var?: string;
  max_options_per_question?: number;
  no_default_intro?: boolean;
  show_header_title?: boolean;
} {
  const consent = state.consentVar.trim();
  const maxOptions = parseMaxOptionsPerQuestion(state.maxOptionsPerQuestion);
  return {
    columns: state.columns,
    logic_language: state.logicLanguage,
    show_questionnaire_number: state.showQuestionnaireNumber,
    matrix_layout: state.matrixLayout,
    matrix_groups: buildMatrixGroupsFromChoices(candidates, state.matrices),
    ...(consent && consentNames.includes(consent) ? { consent_var: consent } : {}),
    ...(maxOptions !== null && maxOptions !== ENGINE_MAX_OPTIONS_PER_QUESTION
      ? { max_options_per_question: maxOptions }
      : {}),
    ...(state.defaultIntro ? {} : { no_default_intro: true }),
    ...(state.showHeaderTitle ? {} : { show_header_title: false }),
  };
}

// ── Persistencia ────────────────────────────────────────────────────────────

const STORAGE_PREFIX = "pulso.xlsformEditor.pdfExport.v1";

/** Clave por proyecto + formulario. `scopeKey` es el de la persistencia del
 *  editor (hash de la ruta completa; ver incidente del 2026-10-14). */
export function pdfDialogStorageKey(projectPath: string | null, formId: string | null): string | null {
  if (!formId || !formId.trim()) return null;
  return `${STORAGE_PREFIX}.${scopeKey(projectPath)}.${formId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Lee el estado guardado. Vacío, corrupto o con campos inválidos → defaults
 *  campo a campo; nunca lanza. */
export function parsePdfDialogState(raw: string | null | undefined): PdfDialogState {
  if (!raw) return { ...DEFAULT_PDF_DIALOG_STATE, matrices: {} };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_PDF_DIALOG_STATE, matrices: {} };
  }
  if (!isRecord(data)) return { ...DEFAULT_PDF_DIALOG_STATE, matrices: {} };
  const d = DEFAULT_PDF_DIALOG_STATE;
  const columns = data.columns === 1 || data.columns === 2 || data.columns === "auto" ? data.columns : d.columns;
  const logicLanguage =
    data.logicLanguage === "saltos" || data.logicLanguage === "condiciones" ? data.logicLanguage : d.logicLanguage;
  const matrixLayout = data.matrixLayout === "full" || data.matrixLayout === "column" ? data.matrixLayout : d.matrixLayout;
  const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
  const matrices: Record<string, PdfMatrixChoice> = {};
  if (isRecord(data.matrices)) {
    for (const [signature, value] of Object.entries(data.matrices)) {
      if (!signature || !isRecord(value)) continue;
      const choice: PdfMatrixChoice = {};
      if (typeof value.enabled === "boolean") choice.enabled = value.enabled;
      const tenor = str(value.tenor);
      const special = str(value.special);
      const header = str(value.header);
      if (tenor !== undefined) choice.tenor = tenor;
      if (special !== undefined) choice.special = special;
      if (header === "auto" || header === "extremos" || header === "categorias") choice.header = header;
      matrices[signature] = choice;
    }
  }
  return {
    columns,
    logicLanguage,
    showQuestionnaireNumber: bool(data.showQuestionnaireNumber, d.showQuestionnaireNumber),
    matrixLayout,
    consentVar: str(data.consentVar) ?? d.consentVar,
    maxOptionsPerQuestion: parseMaxOptionsPerQuestion(data.maxOptionsPerQuestion) ?? d.maxOptionsPerQuestion,
    defaultIntro: bool(data.defaultIntro, d.defaultIntro),
    showHeaderTitle: bool(data.showHeaderTitle, d.showHeaderTitle),
    matrices,
  };
}

/** Serializa el estado. Si hay candidatos, poda las matrices que ya no
 *  existen para que la entrada no crezca con firmas viejas. */
export function serializePdfDialogState(
  state: PdfDialogState,
  candidates: readonly MatrixCandidate[],
): string {
  let matrices = state.matrices;
  if (candidates.length) {
    const alive = new Set(candidates.map(matrixSignature));
    matrices = Object.fromEntries(Object.entries(state.matrices).filter(([sig]) => alive.has(sig)));
  }
  return JSON.stringify({ ...state, matrices });
}

type MinimalStorage = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): MinimalStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadPdfDialogState(key: string | null, storage = defaultStorage()): PdfDialogState {
  if (!key || !storage) return parsePdfDialogState(null);
  try {
    return parsePdfDialogState(storage.getItem(key));
  } catch {
    return parsePdfDialogState(null);
  }
}

export function savePdfDialogState(
  key: string | null,
  state: PdfDialogState,
  candidates: readonly MatrixCandidate[],
  storage = defaultStorage(),
): void {
  if (!key || !storage) return;
  try {
    storage.setItem(key, serializePdfDialogState(state, candidates));
  } catch {
    // Cuota llena o storage deshabilitado: la elección sigue viva en memoria.
  }
}

/** Cola del aviso de exportación: la primera advertencia real del motor y
 *  cuántas más hay. Vacío si no hubo advertencias. */
export function exportWarningDetail(warnings: readonly string[] | null | undefined): string {
  const list = (warnings ?? []).map((w) => w.trim()).filter(Boolean);
  if (!list.length) return "";
  const more = list.length > 1 ? ` (+${list.length - 1} más)` : "";
  return ` · ${list[0]}${more}`;
}
