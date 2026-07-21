import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Cloud,
  Download,
  FileSpreadsheet,
  FileText,
  ListChecks,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { IconForward, IconHint, IconNew, IconRedo, IconSearch, IconUndo } from "../../lib/icons";
import {
  apiSaveEntregable,
  apiUpload,
  apiXlsformEditorExport,
  apiXlsformEditorExportPdf,
  apiXlsformEditorExportWord,
  apiXlsformEditorImport,
  apiXlsformEditorImportMatrizPulso,
  isMatrizPulsoImport,
  apiXlsformEditorSmApplyLogic,
  apiXlsformEditorSmInterpretRule,
  apiXlsformEditorValidate,
  apiXlsformFormActivate,
  apiXlsformFormConfirmLogic,
  apiXlsformFormDelete,
  apiXlsformFormGet,
  apiXlsformFormPublishRevision,
  apiXlsformFormsList,
  downloadUrl,
  type ChoiceCodeMap,
  type Hallazgo,
  type SurveyMonkeyVisualLogicRule,
  type XlsformFormPublication,
  type XlsformFormSource,
} from "../../api/client";
import { useProjectShell } from "../project/ProjectShell";
import { ImportSurveyMonkeyDialog } from "./shell/ImportSurveyMonkeyDialog";
import { MatrizPulsoDialog } from "./shell/MatrizPulsoDialog";
import { planMatrizPulsoForms } from "./shell/matrizPulso";
import { compileVisualLogicRules, RuleWizard, type ConfirmedRule } from "./shell/RuleWizard";
import {
  buildSurveyMonkeyLogicPack,
  importSurveyMonkeyLogicPack,
  type SurveyMonkeyLogicPackWarning,
} from "./shell/surveyMonkeyLogicPack";
import { HallazgosPanel } from "./shell/HallazgosPanel";
import { Panel } from "../../components/Panel";
import { PageFrame } from "../../components/PageFrame";
import { EmptyState, ErrorBlock, LoadingBlock } from "../../components/States";
import { ConfigIoButtons } from "../../components/ConfigIoButtons";
import SaveEntregableButton from "../project/SaveEntregableButton";
import { sanitizeFilenameStem } from "../project/FilenameInput";
import { useSession } from "../../lib/SessionContext";
import { editorFormIdFromSearch, editorRequestedFormExists } from "./state/editorDeepLink";

// -----------------------------------------------------------------------------
// Tipos, parsing y helpers extraídos a submódulos durante el revamp Sub-PR 1.
// El comportamiento es idéntico al monolito previo; solo cambian los imports.
// -----------------------------------------------------------------------------
import type {
  AddMenuItem,
  BuilderDiagnostic,
  BuilderNode,
  BuilderSelection,
  BuilderStructure,
  XlsformEditorWorkbook,
} from "./types";
import { PAPER_COLUMNS } from "./types";
import {
  cloneWorkbook,
  createBlankWorkbook,
  deleteRow,
  ensureColumn,
  findVarReferences,
  getCell,
  insertRecord,
  makeSheet,
  makeColumnName,
  replaceVarReferences,
  rowToRecord,
  setCell,
  SURVEY_COLUMNS_WITH_VAR_REFS,
} from "./parsing/sheetUtils";
import { SheetsView } from "./sheets/SheetsView";
import {
  buildType,
  cleanFilename,
  formatSource,
  parseType,
  slug,
} from "./parsing/parseType";
import {
  buildXlsformIndex,
  extractChoiceItems,
  getSiblingRows,
  parseBuilderStructure,
  previewKindLabel,
  resolveInsertionIndex,
} from "./parsing/buildIndex";
import { buildDiagnostics } from "./parsing/diagnostics";
import { detectMatrixCandidates } from "./parsing/detectMatrixCandidates";
import { detectConsentQuestions } from "./parsing/detectConsentQuestions";
import {
  canRedoEditor,
  canUndoEditor,
  createInitialEditorState,
  editorReducer,
} from "./state/editorReducer";
import {
  clearSnapshot,
  clearSnapshotFromBackend,
  createPersistenceScheduler,
  deleteForm,
  deriveFormName,
  getActiveForm,
  isFormLimitError,
  listForms,
  loadForm,
  loadSnapshot,
  MAX_FORMS,
  migrateLegacySingleForm,
  newFormId,
  reconcileSnapshotWithBackend,
  renameForm,
  saveForm,
  setActiveForm,
  syncFormToBackend,
  upsertLibraryEntry,
  type LibraryEntry,
  type PersistedSnapshot,
} from "./state/persistence";
import { FormsLibrary } from "./shell/FormsLibrary";
import { FormSwitcher } from "./shell/FormSwitcher";
import { ConfigurarPdfDialog } from "./shell/ConfigurarPdfDialog";
import { QuestionnaireProgressPanel } from "./shell/QuestionnaireProgressPanel";
import { ToastDeck, useToastDeck } from "./shell/ToastDeck";
import { DiagnosticsBadge } from "./shell/DiagnosticsPopover";
import { CollapsibleSection } from "./shell/CollapsibleSection";
import CatalogsContextLens from "./catalogs/CatalogsContextLens";
import { CatalogLibrary as CatalogLibraryV2 } from "./catalogs/CatalogLibrary";
import { CatalogWorkspace as CatalogWorkspaceV2 } from "./catalogs/CatalogWorkspace";
import {
  applyChoiceMove,
  countCatalogUsage,
  deleteCatalog as deleteCatalogFromSheet,
} from "./catalogs/catalogUtils";
import { SurveyOutline } from "./outline/SurveyOutline";
import type { RowMovePlan } from "./outline/outlineUtils";
import { applyRowMove } from "./outline/outlineUtils";
import {
  FocusedWorkspace,
  type FocusWorkspaceMode,
  type SectionBoundaryState,
} from "./canvas/FocusedWorkspace";
import { MoreViewsMenu } from "./shell/MoreViewsMenu";
import { Coachmarks } from "./shell/Coachmarks";
import { iconForType } from "./helpers/icons";
import { paletteForType } from "./helpers/paletteForType";
import type {
  LogicCatalog,
  LogicScope,
  LogicVariable,
} from "./logic";
import { LogicCanvas } from "./canvas-graph/LogicCanvas";
import { ChoiceFiltersView } from "./choiceFilters/ChoiceFiltersView";
import { FormSimulator } from "./shell/FormSimulator";
import { FormSummaryView } from "./shell/FormSummaryView";
import "./styles/xlsform-v2.css";

/**
 * Posición 1-indexed de una fila dentro del outline, contando solo
 * preguntas reales (question/note/calculate). Si la fila es una sección o
 * un marcador begin/end, devuelve `undefined`.
 */
function computeQuestionPosition(
  structure: BuilderStructure,
  rowIndex: number,
): number | undefined {
  let count = 0;
  for (const n of structure.outline) {
    if (n.kind === "question" || n.kind === "note" || n.kind === "calculate") {
      count += 1;
    }
    if (n.rowIndex === rowIndex) {
      if (n.kind === "question" || n.kind === "note" || n.kind === "calculate") return count;
      return undefined;
    }
  }
  return undefined;
}

function workbookWithSurveyMonkeyLogic(
  workbook: XlsformEditorWorkbook,
  advancedRules: ConfirmedRule[],
  visualRules: SurveyMonkeyVisualLogicRule[],
  choiceOrderOverrides: Record<string, string[]>,
  choiceCodeMaps: ChoiceCodeMap[] = workbook.surveyMonkeyLogic?.choice_code_maps ?? [],
): XlsformEditorWorkbook {
  const next = cloneWorkbook(workbook);
  const overrides = Object.fromEntries(
    Object.entries(choiceOrderOverrides).map(([key, labels]) => [key, [...labels]]),
  );
  const resolvedChoiceCodeMaps = choiceCodeMapsWithOverrides(next, overrides, choiceCodeMaps);
  next.surveyMonkeyLogic = advancedRules.length || visualRules.length || Object.keys(overrides).length || resolvedChoiceCodeMaps.length
    ? {
        rules: advancedRules.map((rule) => ({ ...rule })),
        advanced_rules: advancedRules.map((rule) => ({ ...rule })),
        visual_rules: visualRules.map((rule) => ({
          ...rule,
          choices: rule.choices.map((choice) => ({ ...choice, action: { ...choice.action } })),
        })),
        choice_order_overrides: overrides,
        choice_code_maps: cloneChoiceCodeMaps(resolvedChoiceCodeMaps),
      }
    : null;
  return next;
}

async function refreshSurveyMonkeyAdvancedRules(
  rules: ConfirmedRule[],
  workbook: XlsformEditorWorkbook,
  choiceOrderOverrides: Record<string, string[]>,
): Promise<ConfirmedRule[]> {
  if (!rules.length) return rules;
  return Promise.all(rules.map(async (rule) => {
    try {
      const interp = await apiXlsformEditorSmInterpretRule(rule.texto, {
        workbook,
        choice_order_overrides: choiceOrderOverrides,
        choice_code_maps: workbook.surveyMonkeyLogic?.choice_code_maps ?? [],
      });
      if (!interp.ok) return rule;
      return {
        ...rule,
        texto_humano: interp.texto_humano,
        kobo_expr: interp.resolucion.kobo_expr,
      };
    } catch {
      return rule;
    }
  }));
}

function extractExistingKoboLogic(workbook: XlsformEditorWorkbook | null) {
  if (!workbook) return [];
  const nameIdx = workbook.survey.columns.indexOf("name");
  const labelIdx = workbook.survey.columns.indexOf("label");
  const relIdx = workbook.survey.columns.indexOf("relevant");
  if (nameIdx < 0 || relIdx < 0) return [];
  return workbook.survey.rows
    .map((row) => ({
      name: row[nameIdx] ?? "",
      label: labelIdx >= 0 ? row[labelIdx] ?? "" : "",
      relevant: row[relIdx] ?? "",
    }))
    .filter((item) => item.name && item.relevant.trim())
    .slice(0, 80);
}

function visualActionCountForFooter(rules: SurveyMonkeyVisualLogicRule[]) {
  return rules.reduce((sum, rule) => sum + rule.choices.filter((choice) => choice.action.kind !== "none").length, 0);
}

function actionSignature(choice: SurveyMonkeyVisualLogicRule["choices"][number]) {
  return JSON.stringify({ choiceName: choice.choiceName, action: choice.action });
}

function mergeAdvancedLogicRules(current: ConfirmedRule[], incoming: ConfirmedRule[]) {
  const seen = new Set(current.map((rule) => rule.texto.trim()));
  const merged = [...current];
  for (const rule of incoming) {
    const key = rule.texto.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(rule);
  }
  return merged;
}

function mergeVisualLogicRules(
  current: SurveyMonkeyVisualLogicRule[],
  incoming: SurveyMonkeyVisualLogicRule[],
  warnings: SurveyMonkeyLogicPackWarning[],
) {
  const merged = current.map((rule) => ({
    ...rule,
    choices: rule.choices.map((choice) => ({ ...choice, action: { ...choice.action } })),
  }));
  for (const rule of incoming) {
    const existing = merged.find((item) => item.variableRef === rule.variableRef);
    if (!existing) {
      merged.push({
        ...rule,
        choices: rule.choices.map((choice) => ({ ...choice, action: { ...choice.action } })),
      });
      continue;
    }
    const seen = new Set(existing.choices.map(actionSignature));
    for (const choice of rule.choices) {
      const sameChoice = existing.choices.find((item) => item.choiceName === choice.choiceName);
      const sig = actionSignature(choice);
      if (seen.has(sig)) continue;
      if (sameChoice && JSON.stringify(sameChoice.action) !== JSON.stringify(choice.action)) {
        warnings.push({
          severity: "warn",
          message: `La opción "${choice.choiceLabel}" en ${rule.variableLabel} ya tenía otro salto; se conservó el existente.`,
        });
        continue;
      }
      seen.add(sig);
      existing.choices.push({ ...choice, action: { ...choice.action } });
    }
  }
  return merged;
}

function cloneChoiceCodeMaps(maps: ChoiceCodeMap[] | undefined | null): ChoiceCodeMap[] {
  return (maps ?? []).map((map) => ({
    ...map,
    mappings: map.mappings.map((item) => ({ ...item })),
  }));
}

function normalizeChoiceMapLabel(label: string) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function questionKeyFromVariable(ref: string) {
  const match = ref.match(/^[pq]0*(\d+)/i);
  return match ? String(Number(match[1])) : "";
}

function choiceCodeMapsWithOverrides(
  workbook: XlsformEditorWorkbook,
  overrides: Record<string, string[]>,
  maps: ChoiceCodeMap[] | undefined | null,
): ChoiceCodeMap[] {
  const out = cloneChoiceCodeMaps(maps);
  const existingKeys = new Set(out.map((map) => questionKeyFromVariable(map.variable)).filter(Boolean));
  const surveyCols = workbook.survey.columns;
  const choiceCols = workbook.choices.columns;
  const nameIdx = surveyCols.indexOf("name");
  const typeIdx = surveyCols.indexOf("type");
  const labelIdx = surveyCols.indexOf("label::es") >= 0 ? surveyCols.indexOf("label::es") : surveyCols.indexOf("label");
  const listIdx = choiceCols.indexOf("list_name");
  const choiceNameIdx = choiceCols.indexOf("name");
  const choiceLabelIdx = choiceCols.indexOf("label::es") >= 0 ? choiceCols.indexOf("label::es") : choiceCols.indexOf("label");
  if (nameIdx < 0 || typeIdx < 0 || listIdx < 0 || choiceNameIdx < 0) return out;

  for (const [qKey, labels] of Object.entries(overrides)) {
    if (!labels.length || existingKeys.has(qKey)) continue;
    const surveyRow = workbook.survey.rows.find((row) => questionKeyFromVariable(row[nameIdx] ?? "") === qKey);
    if (!surveyRow) continue;
    const typeRaw = surveyRow[typeIdx] ?? "";
    const typeMatch = typeRaw.match(/^(select_one|select_multiple)\s+(\S+)/i);
    if (!typeMatch) continue;
    const listName = typeMatch[2];
    const choices = workbook.choices.rows
      .filter((row) => (row[listIdx] ?? "") === listName)
      .map((row) => ({
        name: row[choiceNameIdx] ?? "",
        label: (choiceLabelIdx >= 0 ? row[choiceLabelIdx] ?? "" : "") || row[choiceNameIdx] || "",
      }));
    if (!choices.length) continue;
    const choicesByLabel = new Map<string, typeof choices>();
    for (const choice of choices) {
      const key = normalizeChoiceMapLabel(choice.label);
      const arr = choicesByLabel.get(key) ?? [];
      arr.push(choice);
      choicesByLabel.set(key, arr);
    }
    const mappings = labels.map((label, index) => {
      const key = normalizeChoiceMapLabel(label);
      const queue = choicesByLabel.get(key) ?? [];
      const matched = queue.shift();
      if (queue.length) choicesByLabel.set(key, queue);
      else choicesByLabel.delete(key);
      return {
        source_code: String(index + 1),
        source_column: "",
        source_label: label,
        xls_code: matched?.name ?? String(index + 1),
        xls_label: matched?.label ?? label,
        match: matched ? "manual_editor" : "manual_editor_fallback",
      };
    });
    out.push({
      variable: surveyRow[nameIdx] ?? `p${qKey}`,
      label: labelIdx >= 0 ? surveyRow[labelIdx] ?? surveyRow[nameIdx] ?? `p${qKey}` : surveyRow[nameIdx] ?? `p${qKey}`,
      type: typeMatch[1].toLowerCase() === "select_multiple" ? "select_multiple" : "select_one",
      list_name: listName,
      status: "manual_editor",
      high_confidence: true,
      requires_confirmation: false,
      mappings,
    });
    existingKeys.add(qKey);
  }
  return out;
}

function choiceCodeMapKey(map: ChoiceCodeMap) {
  return map.variable.trim().toLowerCase();
}

function mergeChoiceCodeMaps(
  current: ChoiceCodeMap[] | undefined | null,
  incoming: ChoiceCodeMap[] | undefined | null,
  warnings: SurveyMonkeyLogicPackWarning[],
) {
  const merged = cloneChoiceCodeMaps(current);
  const byVariable = new Map(merged.map((map) => [choiceCodeMapKey(map), map]));

  for (const rawMap of incoming ?? []) {
    const map = cloneChoiceCodeMaps([rawMap])[0];
    if (!map) continue;
    const key = choiceCodeMapKey(map);
    const existing = byVariable.get(key);
    if (!existing) {
      merged.push(map);
      byVariable.set(key, map);
      continue;
    }

    const existingBySource = new Map(existing.mappings.map((item) => [item.source_code.trim(), item]));
    for (const item of map.mappings) {
      const sourceCode = item.source_code.trim();
      const currentItem = existingBySource.get(sourceCode);
      if (!currentItem) {
        existing.mappings.push({ ...item });
        existingBySource.set(sourceCode, item);
        continue;
      }
      if (
        currentItem.xls_code !== item.xls_code ||
        currentItem.xls_label !== item.xls_label ||
        currentItem.source_label !== item.source_label
      ) {
        warnings.push({
          severity: "warn",
          message: `El mapa interno ${map.variable} ${sourceCode} ya existía; se conservó el mapeo confirmado en este workbook.`,
        });
      }
    }
  }

  return merged;
}

function sectionIdForRow(rowIndex: number): string {
  return `section-${rowIndex}`;
}

function boundaryNodeLabel(node: BuilderNode | null | undefined): string {
  if (!node) return "la pieza";
  return node.label || node.name || previewKindLabel(node);
}

function findNextSiblingAfterSection(
  structure: BuilderStructure | null,
  sectionRowIndex: number,
): BuilderNode | null {
  const node = structure?.byRow.get(sectionRowIndex);
  if (!structure || !node || (node.kind !== "section" && node.kind !== "repeat")) return null;
  const section = structure.sections.get(sectionIdForRow(sectionRowIndex));
  const span = structure.spans.get(sectionRowIndex);
  const end = section?.endRowIndex ?? span?.end ?? sectionRowIndex;
  return structure.outline.find(
    (entry) => entry.sectionId === node.sectionId && entry.rowIndex > end,
  ) ?? null;
}

function findLastDirectChildInSection(
  structure: BuilderStructure | null,
  sectionRowIndex: number,
): BuilderNode | null {
  if (!structure) return null;
  const section = structure.sections.get(sectionIdForRow(sectionRowIndex));
  const span = structure.spans.get(sectionRowIndex);
  const end = section?.endRowIndex ?? span?.end ?? sectionRowIndex;
  const children = structure.outline.filter(
    (entry) =>
      entry.sectionId === sectionIdForRow(sectionRowIndex) &&
      entry.rowIndex > sectionRowIndex &&
      entry.rowIndex < end,
  );
  return children[children.length - 1] ?? null;
}

function buildSectionBoundaryState(
  structure: BuilderStructure | null,
  node: BuilderNode | null,
): SectionBoundaryState | null {
  if (!structure || !node || (node.kind !== "section" && node.kind !== "repeat")) return null;
  const section = structure.sections.get(sectionIdForRow(node.rowIndex));
  if (!section) return null;
  const itemCount = section.itemCount;
  const next = findNextSiblingAfterSection(structure, node.rowIndex);
  const lastChild = findLastDirectChildInSection(structure, node.rowIndex);
  const closingType = node.kind === "repeat" ? "end_repeat" : "end_group";
  return {
    itemCount,
    closeLabel: itemCount > 0
      ? `${closingType} queda después de ${boundaryNodeLabel(lastChild)}`
      : `${closingType} queda justo después del título`,
    closeDetail: itemCount > 0
      ? "El cierre del XLSForm se mueve automáticamente con estos controles; no necesitas crear una fila manual en Hojas."
      : "El bloque está vacío: el cierre queda debajo del título y las piezas siguientes todavía están fuera.",
    nextLabel: next ? boundaryNodeLabel(next) : null,
    lastChildLabel: lastChild ? boundaryNodeLabel(lastChild) : null,
    canIncludeNext: Boolean(next),
    canReleaseLast: Boolean(lastChild),
  };
}

export default function XlsformEditorPage() {
  // Detecta si hay un .pulso abierto — al exportar, decide entre guardar
  // al directorio del proyecto (vía /api/fs/save-to-project) o usar la
  // descarga clásica del navegador.
  const { project } = useProjectShell();
  const { sessionId } = useSession();
  const location = useLocation();
  const requestedFormId = editorFormIdFromSearch(location.search);
  // Estado del workbook + dirty + lastSavedAt + history (undo/redo) en un
  // solo reducer para mantener consistencia transaccional. Las acciones
  // disponibles son SET (mutación normal), LOAD (importar/restaurar),
  // CLEAR (volver al EmptyHome), UNDO/REDO y MARK_SAVED.
  const [editorState, dispatch] = useReducer(
    editorReducer,
    null,
    () => createInitialEditorState(null),
  );
  const { workbook, dirty, lastSavedAt, activeFormId } = editorState;
  const canUndo = canUndoEditor(editorState);
  const canRedo = canRedoEditor(editorState);

  // Biblioteca multi-formulario del proyecto: entradas ligeras (sin workbook)
  // que alimentan el conmutador rápido del toolbar y — en Oleada 3 — el hub.
  const [forms, setForms] = useState<LibraryEntry[]>([]);
  // Estado remoto de publicación: nunca se mezcla con LibraryEntry ni se
  // persiste en localStorage. El backend es la única autoridad sobre hashes,
  // revisiones, bloqueos y protección de borrado.
  const [publicationUi, setPublicationUi] = useState<{
    byFormId: Record<string, XlsformFormPublication>;
    publishingFormId: string | null;
    confirmingLogicFormId: string | null;
    errorsByFormId: Record<string, string>;
  }>({ byFormId: {}, publishingFormId: null, confirmingLogicFormId: null, errorsByFormId: {} });
  // Ref al activeFormId para consultarlo desde callbacks async (switchToForm)
  // sin re-crear la callback en cada cambio.
  const activeFormIdRef = useRef<string | null>(activeFormId);
  useEffect(() => {
    activeFormIdRef.current = activeFormId;
  }, [activeFormId]);

  const [selection, setSelection] = useState<BuilderSelection | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Todavía no hay un formulario abierto.");
  const [artifact, setArtifact] = useState<{ file_id: string; original_name: string; extension: "xlsx" | "pdf" | "docx" } | null>(null);
  const [source, setSource] = useState<XlsformFormSource | null>(null);
  const [catalogFocus, setCatalogFocus] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  /** Si está abierto el ContextLens de catálogos. Click en el botón
   *  "Catálogos" del header del constructor lo abre; el lens lo cierra. */
  const [catalogsLensOpen, setCatalogsLensOpen] = useState(false);
  /** Modo de visualización del workbook. "builder" = constructor visual
   *  guiado (default). "sheets" = vista por hojas tipo Excel, donde el
   *  usuario edita celdas crudas. Cualquier cambio en sheets se refleja
   *  automáticamente en builder porque ambos leen del mismo workbook. */
  const [editorMode, setEditorMode] = useState<"builder" | "sheets">("builder");
  const [builderWorkspaceMode, setBuilderWorkspaceMode] =
    useState<FocusWorkspaceMode>("focus");
  /** Si está abierto el overlay del mapa de lógica (canvas Obsidian-style).
   *  Se accede desde el botón "Mapa de lógica" del header del constructor. */
	  const [logicCanvasOpen, setLogicCanvasOpen] = useState(false);
	  /** Overlay de «Filtros de opciones»: vista hermana del mapa de lógica que
	   *  explica en lenguaje humano qué respuesta previa habilita qué opción. */
	  const [choiceFiltersOpen, setChoiceFiltersOpen] = useState(false);
	  const [smLogicDialogOpen, setSmLogicDialogOpen] = useState(false);
	  const [smLogicRules, setSmLogicRules] = useState<ConfirmedRule[]>([]);
	  const [smVisualLogicRules, setSmVisualLogicRules] = useState<SurveyMonkeyVisualLogicRule[]>([]);
	  const [smLogicChoiceOverrides, setSmLogicChoiceOverrides] = useState<Record<string, string[]>>({});
	  const [questionnaireViewOpen, setQuestionnaireViewOpen] = useState(false);
  /** Overlays complementarios v2: simulador de llenado y resumen ejecutivo. */
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [summaryViewOpen, setSummaryViewOpen] = useState(false);
  /** Modal de importación SurveyMonkey vía API. El .sav queda solo como ruta
   *  legacy opcional; el flujo principal ya no pide archivo. */
  const [smImportDialog, setSmImportDialog] = useState<
    | { fileId?: string | null; fileName: string }
    | null
  >(null);
  /** Diálogo del importador de "Matriz PULSO IAC-CINDA". Se abre cuando el
   *  backend detecta que el .xlsx subido es una matriz por audiencia en vez de
   *  un XLSForm normal. */
  const [matrizPulsoDialog, setMatrizPulsoDialog] = useState<
    | { fileId: string; fileName: string; audiences: string[] }
    | null
  >(null);
  const [matrizPulsoSubmitting, setMatrizPulsoSubmitting] = useState(false);
  /** Abre/cierra el diálogo "Configurar PDF" que reemplaza al viejo popover. */
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  /**
   * Al exportar el .xlsx, por defecto NO se incluyen las columnas propias de
   * la plataforma (namespace `paper_*` + hojas `paper`/`diagnostico`): sirven
   * para el mapeo a PDF/Word dentro de la app, no para desplegar en Kobo/ODK.
   * Este switch permite conservarlas cuando el usuario sí las necesita.
   */
  const [includeAppColumns, setIncludeAppColumns] = useState(false);
  /** Hallazgos del validador empírico (devueltos por import-with-logic).
   *  Se renderizan en panel UI dedicado, NO se exportan al .xlsx. */
  const [hallazgos, setHallazgos] = useState<Hallazgo[]>([]);
  /** Snapshot del autosave detectado al montar; muestra UI de "continuar". */
  const [restoreOffer, setRestoreOffer] = useState<ReturnType<typeof loadSnapshot>>(null);
  const xlsInputRef = useRef<HTMLInputElement | null>(null);
  const addMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  // Notificaciones efímeras (importé X, exporté Y) — reemplazan al setStatus
  // sticky para mensajes de operaciones que cierran su ciclo en un evento.
  const toasts = useToastDeck();

  // Scheduler de autosave persistente. Se crea una sola vez por
  // montaje del componente; se reusa entre cambios.
  const persistenceRef = useRef<ReturnType<typeof createPersistenceScheduler> | null>(null);
  if (persistenceRef.current === null) {
    persistenceRef.current = createPersistenceScheduler((savedAt) => {
      dispatch({ type: "MARK_SAVED", savedAt });
    }, 2000);
  }
  const persistence = persistenceRef.current;

  // Scope de persistencia: el path del .pulso activo (o null si no
  // hay proyecto). Determina el bucket de localStorage para que el
  // banner "Tenías un formulario abierto" sea independiente por proyecto.
  const projectScope = project.status.path ?? null;
  const projectScopeRef = useRef(projectScope);
  useEffect(() => {
    projectScopeRef.current = projectScope;
  }, [projectScope]);

  // Refresca la lista ligera de formularios de la biblioteca del scope.
  const refreshForms = useCallback(() => {
    setForms(listForms(projectScope));
  }, [projectScope]);

  const refreshBackendFormIndex = useCallback(async () => {
    const backend = await apiXlsformFormsList();
    // Una respuesta del proyecto anterior nunca debe repintar la biblioteca
    // después de un cambio de .pulso.
    if (projectScopeRef.current !== projectScope) return backend;
    for (const entry of backend.forms) {
      const savedAtMs = typeof entry.saved_at === "number"
        ? entry.saved_at
        : Date.parse(entry.saved_at) || Date.now();
      upsertLibraryEntry(projectScope, {
        id: entry.id,
        name: entry.name,
        savedAt: savedAtMs,
        source: entry.source,
        nQuestions: entry.n_questions,
        nSections: entry.n_sections,
      });
    }
    setForms(listForms(projectScope));
    setPublicationUi((prev) => ({
      ...prev,
      byFormId: Object.fromEntries(
        backend.forms.map((entry) => [entry.id, entry.publication]),
      ),
    }));
    return backend;
  }, [projectScope]);

  // Tope de 6 formularios por proyecto (fuente de verdad en persistence).
  // `canCreate` gobierna el estado deshabilitado de las vías de creación en el
  // hub y el conmutador; el backend rechaza el 7º con E_FORM_LIMIT (red de
  // seguridad ante carreras entre ventanas/máquinas).
  const canCreateForm = forms.length < MAX_FORMS;

  // Nombre reactivo del formulario abierto: se deriva del workbook vivo (no del
  // índice `forms`, que se refresca en diferido), así el label del conmutador
  // se actualiza en cuanto cambia `form_title` o se renombra el activo.
  const activeFormName = useMemo(() => {
    if (!workbook) return source?.original_name ?? "Formulario activo";
    const idx = forms.findIndex((f) => f.id === activeFormId);
    const ordinal = idx >= 0 ? idx + 1 : forms.length + 1;
    return deriveFormName(workbook, source, ordinal);
  }, [workbook, source, forms, activeFormId]);

  // Renombra un formulario desde el hub. Persiste local (índice + form_title)
  // y sincroniza al backend en segundo plano. No toca el editor abierto — el
  // hub solo se muestra sin workbook activo.
  const onRenameForm = useCallback((id: string, name: string) => {
    const next = renameForm(projectScope, id, name);
    setForms(next.forms);
    const renamed = loadForm(projectScope, id);
    if (renamed) {
      void syncFormToBackend(id, renamed.workbook, {
        sourceKind: renamed.sourceKind,
        sourceName: renamed.sourceName,
        source: renamed.source,
        hallazgos: renamed.hallazgos,
      })
        .then(refreshBackendFormIndex)
        .catch(() => refreshBackendFormIndex().catch(() => undefined));
    } else {
      void refreshBackendFormIndex().catch(() => undefined);
    }
  }, [projectScope, refreshBackendFormIndex]);

  // El backend decide primero: una revisión publicada no puede desaparecer
  // por una carrera entre dos ventanas. Solo tras confirmar el DELETE se
  // elimina la copia local y se actualiza el hub.
  const onDeleteForm = useCallback(async (id: string) => {
    try {
      await apiXlsformFormDelete(id);
      const next = deleteForm(projectScope, id);
      setForms(next.forms);
      setPublicationUi((prev) => {
        const { [id]: _removed, ...byFormId } = prev.byFormId;
        const { [id]: _removedError, ...errorsByFormId } = prev.errorsByFormId;
        return { ...prev, byFormId, errorsByFormId };
      });
      toasts.push({ kind: "info", title: "Formulario eliminado", durationMs: 4000 });
    } catch (err: unknown) {
      await refreshBackendFormIndex().catch(() => undefined);
      const detail = err instanceof Error ? err.message : "El backend rechazó la eliminación.";
      toasts.push({
        kind: "danger",
        title: "No se pudo eliminar el formulario",
        detail,
        durationMs: 6000,
      });
    }
  }, [projectScope, refreshBackendFormIndex, toasts]);

  const onPublishForm = useCallback(async (id: string) => {
    const publication = publicationUi.byFormId[id];
    if (!publication?.can_publish || !publication.draft_content_sha256) return;
    setPublicationUi((prev) => ({
      ...prev,
      publishingFormId: id,
      errorsByFormId: { ...prev.errorsByFormId, [id]: "" },
    }));
    try {
      const result = await apiXlsformFormPublishRevision(
        id,
        publication.draft_content_sha256,
      );
      await refreshBackendFormIndex();
      toasts.push({
        kind: result.created ? "success" : "info",
        title: result.created ? `Revisión ${result.revision.revision_no} publicada` : "Revisión ya vigente",
        detail: "El instrumento publicado quedó fijado para el procesamiento multibase.",
        durationMs: 5000,
      });
    } catch (err: unknown) {
      // Ante hash obsoleto (409), validación o cualquier rechazo, no hacemos
      // optimismo: recargamos el estado remoto y mostramos el error original.
      await refreshBackendFormIndex().catch(() => undefined);
      const detail = err instanceof Error ? err.message : "El backend rechazó la publicación.";
      setPublicationUi((prev) => ({
        ...prev,
        errorsByFormId: { ...prev.errorsByFormId, [id]: detail },
      }));
      toasts.push({
        kind: "danger",
        title: "No se pudo publicar la revisión",
        detail,
        durationMs: 7000,
      });
    } finally {
      setPublicationUi((prev) => ({
        ...prev,
        publishingFormId: prev.publishingFormId === id ? null : prev.publishingFormId,
      }));
    }
  }, [publicationUi.byFormId, refreshBackendFormIndex, toasts]);

  const onConfirmFormLogic = useCallback(async (id: string) => {
    const publication = publicationUi.byFormId[id];
    if (!publication?.draft_content_sha256) return;
    setPublicationUi((prev) => ({
      ...prev,
      confirmingLogicFormId: id,
      errorsByFormId: { ...prev.errorsByFormId, [id]: "" },
    }));
    try {
      const result = await apiXlsformFormConfirmLogic(
        id,
        publication.draft_content_sha256,
      );
      const local = loadForm(projectScope, id);
      if (local && result.source) {
        saveForm(projectScope, id, local.workbook, {
          sourceKind: result.source.kind,
          sourceName: result.source.original_name,
          source: result.source,
          hallazgos: local.hallazgos,
        });
      }
      const indexed = listForms(projectScope).find((entry) => entry.id === id);
      if (indexed) {
        upsertLibraryEntry(projectScope, { ...indexed, source: result.source ?? indexed.source });
      }
      setPublicationUi((prev) => ({
        ...prev,
        byFormId: { ...prev.byFormId, [id]: result.publication },
      }));
      await refreshBackendFormIndex();
      toasts.push({
        kind: "success",
        title: "Lógica revisada y confirmada",
        detail: "La confirmación quedó ligada a este contenido. Publica la revisión cuando estés listo.",
        durationMs: 6000,
      });
    } catch (err: unknown) {
      await refreshBackendFormIndex().catch(() => undefined);
      const detail = err instanceof Error ? err.message : "El backend rechazó la confirmación de lógica.";
      setPublicationUi((prev) => ({
        ...prev,
        errorsByFormId: { ...prev.errorsByFormId, [id]: detail },
      }));
      toasts.push({
        kind: "danger",
        title: "No se pudo confirmar la lógica",
        detail,
        durationMs: 7000,
      });
    } finally {
      setPublicationUi((prev) => ({
        ...prev,
        confirmingLogicFormId: prev.confirmingLogicFormId === id
          ? null
          : prev.confirmingLogicFormId,
      }));
    }
  }, [projectScope, publicationUi.byFormId, refreshBackendFormIndex, toasts]);

  // Ref a switchToForm para invocarlo desde el efecto de scope sin problemas
  // de orden de declaración (la callback se define más abajo).
  const switchToFormRef = useRef<((id: string) => Promise<void>) | null>(null);

  // Al montar — y al cambiar de proyecto — sembramos la biblioteca
  // multi-formulario: migramos cualquier snapshot legacy mono-formulario,
  // fusionamos las entradas que el backend (.pulso) tenga y que aún no estén
  // en localStorage, y si hay un formulario activo lo hidratamos. Si no hay
  // ninguno, dejamos workbook=null (el hub / EmptyHome).
  const restoreKey = `${sessionId || "no-session"}::${projectScope ?? "no-project"}`;
  const lastScopeRef = useRef(restoreKey);
  useEffect(() => {
    const isProjectSwitch = lastScopeRef.current !== restoreKey;
    lastScopeRef.current = restoreKey;

    // Si fue un switch de proyecto y había un workbook cargado, lo
    // limpiamos — su snapshot está a salvo en su propio bucket.
    if (isProjectSwitch && workbookRef.current) {
      dispatch({ type: "CLEAR" });
    }
    setRestoreOffer(null);
    setPublicationUi({
      byFormId: {},
      publishingFormId: null,
      confirmingLogicFormId: null,
      errorsByFormId: {},
    });

    // Migración legacy → biblioteca (idempotente) + primer listado local.
    const migrated = migrateLegacySingleForm(projectScope);
    setForms(migrated.forms);
    let localActive = migrated.activeFormId;
    let formCount = migrated.forms.length;
    let backendFormIds = new Set<string>();

    let cancelled = false;
    void (async () => {
      // Fusionar formularios que existan en el backend (.pulso) pero cuyo
      // workbook aún no esté en esta máquina (localStorage fresco). El
      // workbook se baja on-demand al abrirlos (switchToForm reconcilia con
      // apiXlsformFormGet).
      try {
        const backend = await refreshBackendFormIndex();
        if (cancelled) return;
        backendFormIds = new Set(backend.forms.map((form) => form.id));
        if (backend.active_form_id && !localActive) {
          localActive = backend.active_form_id;
        }
        if (backend.forms.length > 0) {
          formCount = backend.forms.length;
        }
      } catch {
        // Sin backend / sin proyecto: seguimos con lo local.
      }
      if (cancelled) return;
      // Con VARIOS formularios aterrizamos en el hub (workbook=null → FormsLibrary
      // muestra las tarjetas) para que el usuario elija; solo con UN formulario
      // entramos directo a editarlo. El activo queda apuntado para "Ver todos"
      // / el conmutador del toolbar.
      if (requestedFormId) {
        const requestedExists = editorRequestedFormExists(
          requestedFormId,
          listForms(projectScope).map((form) => form.id),
          backendFormIds,
        ) || localActive === requestedFormId;
        if (requestedExists) {
          await switchToFormRef.current?.(requestedFormId);
          return;
        }
        toasts.push({
          kind: "danger",
          title: "No se encontró el formulario vinculado",
          detail: "El plan de ingreso apunta a un form_id que ya no está disponible en este proyecto.",
          durationMs: 6000,
        });
      } else if (localActive && formCount <= 1) {
        await switchToFormRef.current?.(localActive);
      }
    })();
    return () => {
      cancelled = true;
    };
    // workbookRef y switchToForm intencionalmente fuera de deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectScope, refreshBackendFormIndex, requestedFormId, restoreKey]);

  // Ref que sigue al workbook actual sin disparar el efecto de scope
  // cuando muta. Lo consultamos al detectar switch de proyecto.
  const workbookRef = useRef(workbook);
  useEffect(() => {
    workbookRef.current = workbook;
  }, [workbook]);

  // Programar autosave después de cada edición. El scheduler debouncea 2s
  // — si el usuario sigue editando, se posterga; si se queda quieto, escribe
  // bajo la clave por-formulario del `activeFormId` en el bucket del proyecto.
  useEffect(() => {
    if (!workbook) return;
    if (!dirty) return;
    if (!activeFormId) return;
    persistence.schedule(
      activeFormId,
      workbook,
      {
        sourceKind: source?.kind ?? null,
        sourceName: source?.original_name ?? null,
        source,
      },
      projectScope,
    );
  }, [workbook, dirty, source, persistence, projectScope, activeFormId]);

  // Atajos de teclado del editor:
  //   Cmd/Ctrl+Z         → deshacer
  //   Cmd/Ctrl+Shift+Z   → rehacer
  //   Ctrl+Y             → rehacer (Windows)
  //   Cmd/Ctrl+N         → abrir selector de nueva pieza
  //
  // Undo/redo se ignoran si el foco está en un input/textarea/contentEditable
  // (el usuario espera que Cmd+Z deshaga su tipeo, no la última edición del
  // workbook). El selector de nueva pieza funciona siempre — incluso
  // tipeando — porque es una acción global del editor.
  useEffect(() => {
    function isTypingTarget(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    }
    function onKey(event: KeyboardEvent) {
      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod) return;
      const key = event.key.toLowerCase();

      // Cmd/Ctrl+N — abre el selector de piezas. PreventDefault es
      // crítico porque el navegador captura este shortcut para "nueva
      // ventana" — en Electron sí lo bloqueamos, en navegadores normales
      // puede que no.
      if (key === "n" && !event.shiftKey) {
        if (!workbookRef.current) return;
        event.preventDefault();
        setEditorMode("builder");
        setShowAddMenu(true);
        return;
      }

      // Undo/redo — respetan typing targets.
      if (isTypingTarget(event.target)) return;
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        dispatch({ type: "UNDO" });
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        dispatch({ type: "REDO" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const xlsformIndex = useMemo(
    () => (workbook ? buildXlsformIndex(workbook) : null),
    [workbook]
  );
  const structure = xlsformIndex?.structure ?? null;

  // Candidatos de matriz para el selector de exportación a PDF: runs contiguos
  // de select_one/select_multiple con misma lista dentro de la misma sección.
  const matrixCandidates = useMemo(
    () => (workbook ? detectMatrixCandidates(workbook) : []),
    [workbook],
  );

  // Preguntas candidatas a variable de consentimiento (select_one/acknowledge)
  // para el selector del diálogo "Configurar PDF".
  const consentQuestions = useMemo(
    () => (workbook ? detectConsentQuestions(workbook) : []),
    [workbook],
  );

  const catalogs = xlsformIndex?.catalogs ?? [];
  const readyCatalogsCount = useMemo(
    () => catalogs.filter((catalog) => catalog.items.length > 0).length,
    [catalogs],
  );

  // Filas de CIERRE de sección (end_group/end_repeat). No están en
  // `structure.byRow` (el parser las consume para el span), pero SÍ son
  // filas reales del survey que el usuario puede seleccionar y borrar
  // desde el outline. Este set las hace "válidas" para la selección.
  const sectionEndRows = useMemo(() => {
    const rows = new Set<number>();
    if (structure) {
      for (const meta of structure.sections.values()) {
        if (meta.kind !== "root" && meta.endRowIndex != null) rows.add(meta.endRowIndex);
      }
    }
    return rows;
  }, [structure]);

  useEffect(() => {
    if (!workbook) {
      setSelection(null);
      return;
    }
    if (!selection) {
      if (structure?.firstSelectableRow != null) {
        setSelection({ kind: "survey", rowIndex: structure.firstSelectableRow });
      } else {
        setSelection({ kind: "settings" });
      }
      return;
    }
    if (
      selection.kind === "survey" &&
      !structure?.byRow.has(selection.rowIndex) &&
      !sectionEndRows.has(selection.rowIndex)
    ) {
      if (structure?.firstSelectableRow != null) {
        setSelection({ kind: "survey", rowIndex: structure.firstSelectableRow });
      } else {
        setSelection({ kind: "settings" });
      }
    }
  }, [selection, structure, workbook, sectionEndRows]);

  const selectBuilderFocus = useCallback((next: BuilderSelection) => {
    setSelection(next);
    setBuilderWorkspaceMode("focus");
  }, []);

  const selectedNode = selection?.kind === "survey"
    ? structure?.byRow.get(selection.rowIndex) ?? null
    : null;
  const selectedSection = selectedNode
    ? structure?.sections.get(selectedNode.kind === "section" || selectedNode.kind === "repeat"
        ? `section-${selectedNode.rowIndex}`
        : selectedNode.sectionId) ?? null
    : null;
  const selectedTypeInfo = selectedNode?.typeInfo ?? null;
  const selectedChoices = workbook && selectedTypeInfo?.listName
    ? extractChoiceItems(workbook.choices, selectedTypeInfo.listName)
    : [];
  // Cuando el editor de catálogos (`lens`) está abierto, `catalogFocus`
  // gana — el usuario lo está usando explícitamente para navegar entre
  // listas. Cuando el lens está cerrado, la lista de la pregunta
  // seleccionada en el lienzo da contexto.
  const activeCatalogName = catalogsLensOpen
    ? (catalogFocus || selectedTypeInfo?.listName || catalogs[0]?.listName || null)
    : (selectedTypeInfo?.listName || catalogFocus || catalogs[0]?.listName || null);
  const activeCatalog = catalogs.find((catalog) => catalog.listName === activeCatalogName) ?? null;
  // Cuántas preguntas usan cada catálogo. Lo usa el FormCanvas para
  // marcar listas compartidas (badge "Lista compartida con N preguntas").
  const catalogUsage = useMemo(() => {
    const map = new Map<string, number>();
    if (!xlsformIndex) return map;
    xlsformIndex.questionsByCatalog.forEach((nodes, listName) => {
      map.set(listName, nodes.length);
    });
    return map;
  }, [xlsformIndex]);
  // Para cada catálogo, lista de preguntas que lo usan (rowIndex + label
  // + name). El FormCanvas pasa esto al EditableChoiceList para mostrar
  // los chips de "lista compartida".
  const questionsByCatalog = useMemo(() => {
    const map = new Map<string, Array<{ rowIndex: number; label: string; name: string }>>();
    if (!xlsformIndex) return map;
    xlsformIndex.questionsByCatalog.forEach((nodes, listName) => {
      map.set(
        listName,
        nodes.map((n) => ({ rowIndex: n.rowIndex, label: n.label, name: n.name })),
      );
    });
    return map;
  }, [xlsformIndex]);
  // Listas existentes que el AddBetween del lienzo ofrece reusar al
  // crear una pregunta de selección. Mantenemos el shape liviano
  // (listName + counts) — el menú es flotante y debe leerse en un
  // vistazo.
  const existingListsForAdd = useMemo(() => {
    if (!xlsformIndex) return [];
    return catalogs.map((catalog) => ({
      listName: catalog.listName,
      choicesCount: catalog.items.length,
      usageCount: xlsformIndex.questionsByCatalog.get(catalog.listName)?.length ?? 0,
    }));
  }, [catalogs, xlsformIndex]);
  // Cuando la pregunta seleccionada es obligatoria + tiene relevant
  // (propio o heredado de alguna sección padre), el toggle "Pregunta
  // obligatoria" muestra un aviso "obligatorio condicionado". Esto
  // explica al usuario que la pregunta NO es obligatoria para todos:
  // solo para quienes cumplan la condición de apertura.
  const conditionalContext = useMemo(() => {
    if (!selectedNode || !structure) return null;
    const selfRelevant = selectedNode.relevant?.trim() || "";
    const ancestors: Array<{ sectionLabel: string; relevant: string }> = [];
    let sectionId: string | null = selectedNode.sectionId;
    // Subir por la cadena de secciones padre. Tope en "root" para no
    // bucle infinito si el grafo viene corrupto.
    let safety = 32;
    while (sectionId && sectionId !== "root" && safety-- > 0) {
      const section = structure.sections.get(sectionId);
      if (!section || section.rowIndex == null) break;
      const sectionNode = structure.byRow.get(section.rowIndex);
      const relevant = sectionNode?.relevant?.trim() || "";
      if (relevant) {
        ancestors.push({
          sectionLabel: section.label || section.name || "Sección",
          relevant,
        });
      }
      sectionId = section.parentId ?? null;
    }
    return { selfRelevant, ancestorRelevants: ancestors };
  }, [selectedNode, structure]);

  // Info dinámica del catálogo asignado a la pregunta actualmente
  // seleccionada — la usa el ContextPanel para mostrar la sección
  // "Lista de opciones" con conteo + lista de preguntas que la
  // comparten.
  const selectedCatalogInfo = useMemo(() => {
    if (!selectedNode || !selectedTypeInfo?.listName) return undefined;
    const isSelect =
      selectedTypeInfo.base === "select_one" ||
      selectedTypeInfo.base === "select_multiple";
    if (!isSelect) return undefined;
    const listName = selectedTypeInfo.listName;
    const usedBy = xlsformIndex?.questionsByCatalog.get(listName) ?? [];
    const sharedWith = usedBy
      .filter((n) => n.rowIndex !== selectedNode.rowIndex)
      .map((n) => ({ rowIndex: n.rowIndex, label: n.label, name: n.name }));
    return {
      listName,
      choicesCount: selectedChoices.length,
      sharedWith,
    };
  }, [selectedNode, selectedTypeInfo, selectedChoices, xlsformIndex]);

  // Si el workbook tiene contenido editable (secciones o preguntas
  // reales, no solo auto-meta como _start/_end). Decide si mostramos el
  // empty state grande del lienzo o el contenido normal.
  const hasEditableContent = useMemo(() => {
    if (!structure) return false;
    return structure.outline.some(
      (n) =>
        n.kind === "section" ||
        n.kind === "repeat" ||
        ((n.kind === "question" || n.kind === "note" || n.kind === "calculate") &&
          !["start", "end", "today", "deviceid", "username"].includes(n.typeInfo.base)),
    );
  }, [structure]);
  // Diagnostics locales (cliente): integridad estructural calculada al vuelo
  // a partir del index. Se complementan con los diagnostics remotos (R) que
  // viajan via /api/xlsform-editor/validate.
  const localDiagnostics = useMemo(
    () => buildDiagnostics(workbook, xlsformIndex),
    [workbook, xlsformIndex]
  );

  // Diagnostics remotos (servidor R): balance estricto de begin/end, regex
  // de names, refs de catálogos, slug de form_id. Se invocan debounced ~1s
  // tras cualquier edición. Usamos un useRef + useEffect para debouncear
  // sin librerías extras.
  const [remoteDiagnostics, setRemoteDiagnostics] = useState<BuilderDiagnostic[]>([]);
  const validateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const validateRequestIdRef = useRef(0);

  useEffect(() => {
    if (!workbook) {
      setRemoteDiagnostics([]);
      return;
    }
    if (validateTimerRef.current) clearTimeout(validateTimerRef.current);
    validateTimerRef.current = setTimeout(() => {
      const requestId = ++validateRequestIdRef.current;
      apiXlsformEditorValidate(workbook)
        .then((result) => {
          // Si llegó otro request mientras este iba en vuelo, descartamos.
          if (requestId !== validateRequestIdRef.current) return;
          const remote: BuilderDiagnostic[] = (result.diagnostics ?? []).map(
            (d): BuilderDiagnostic => ({
              id: d.id,
              level: d.level,
              title: d.title,
              detail: d.detail,
              rowIndex: d.rowIndex,
              catalogName: d.catalogName,
            }),
          );
          setRemoteDiagnostics(remote);
        })
        .catch(() => {
          // Si el endpoint falla no rompemos la UI — los locales son suficientes.
          if (requestId === validateRequestIdRef.current) setRemoteDiagnostics([]);
        });
    }, 1000);
    return () => {
      if (validateTimerRef.current) clearTimeout(validateTimerRef.current);
    };
  }, [workbook]);

  // Merge local + remote, deduplicando por id (los locales pueden coincidir
  // con los remotos en patrones obvios — preferimos los del cliente porque
  // se calculan al vuelo y son más frescos).
  const diagnostics = useMemo<BuilderDiagnostic[]>(() => {
    const seen = new Set<string>();
    const out: BuilderDiagnostic[] = [];
    for (const d of localDiagnostics) {
      seen.add(d.id);
      out.push(d);
    }
    for (const d of remoteDiagnostics) {
      if (seen.has(d.id)) continue;
      out.push(d);
    }
    return out;
  }, [localDiagnostics, remoteDiagnostics]);
  const suiteMetrics = useMemo(
    () => buildSuiteMetrics(structure, catalogs.length, diagnostics),
    [structure, catalogs.length, diagnostics],
  );
  const movement = selection?.kind === "survey"
    ? getSiblingRows(structure, selection.rowIndex)
    : { prevRow: null as number | null, nextRow: null as number | null };
  const sectionBoundary = useMemo(
    () => buildSectionBoundaryState(structure, selectedNode),
    [structure, selectedNode],
  );

  // Mapa nombre-de-catálogo → cuántas preguntas lo usan. Se calcula una vez
  // y se pasa al CatalogLibrary para mostrar el badge "usado en N preguntas"
  // y al CatalogWorkspace para habilitar/deshabilitar el botón "Borrar".
  const usageByCatalog = useMemo(() => {
    const map: Record<string, number> = {};
    if (!workbook) return map;
    for (const catalog of catalogs) {
      map[catalog.listName] = countCatalogUsage(workbook.survey, catalog.listName);
    }
    return map;
  }, [workbook, catalogs]);
  const activeCatalogUsage = activeCatalogName
    ? usageByCatalog[activeCatalogName] ?? 0
    : 0;

  useEffect(() => {
    if (!selectedTypeInfo?.listName) return;
    setCatalogFocus(selectedTypeInfo.listName);
  }, [selectedTypeInfo?.listName]);

  useEffect(() => {
    if (!catalogs.length) {
      setCatalogFocus(null);
      return;
    }
    if (catalogFocus && catalogs.some((catalog) => catalog.listName === catalogFocus)) return;
    setCatalogFocus(catalogs[0].listName);
  }, [catalogFocus, catalogs]);

  function resetMessages() {
    setError("");
    setStatus("");
  }

  // Aplica un workbook como el formulario activo. Cuando `formId` viene dado
  // (switchToForm) reusa esa entrada; si no, crea una nueva con un uuid del
  // frontend. Con `register` (default para creaciones) registra el formulario
  // en el backend y lo activa; switchToForm pasa `register:false` porque ya
  // activó por su cuenta.
  const openWorkbookAsForm = useCallback(
    (
      next: XlsformEditorWorkbook,
      nextSource: XlsformFormSource,
      nextStatus: string,
      opts?: { formId?: string; register?: boolean; activate?: boolean; hallazgos?: Hallazgo[] },
    ): string => {
      // LOAD_FORM resetea historia y dirty=false. Sellamos (flush) cualquier
      // autosave pendiente del formulario ANTERIOR antes de cargar el nuevo —
      // así no perdemos sus últimas ediciones (persistence.cancel las perdería).
      persistence.flush();
      const formId = opts?.formId ?? newFormId();
      const loadedWorkbook = cloneWorkbook(next);
      dispatch({ type: "LOAD_FORM", formId, workbook: loadedWorkbook });
      setSource(nextSource);
      setArtifact(null);
      setStatus(nextStatus);
      setRestoreOffer(null);
      setEditorMode("builder");
      setBuilderWorkspaceMode("focus");
      setLogicCanvasOpen(false);
      setChoiceFiltersOpen(false);
      setQuestionnaireViewOpen(false);
      setSmLogicRules(loadedWorkbook.surveyMonkeyLogic?.advanced_rules ?? loadedWorkbook.surveyMonkeyLogic?.rules ?? []);
      setSmVisualLogicRules(loadedWorkbook.surveyMonkeyLogic?.visual_rules ?? []);
      setSmLogicChoiceOverrides(loadedWorkbook.surveyMonkeyLogic?.choice_order_overrides ?? {});
      const sourceMeta = {
        sourceKind: nextSource.kind,
        sourceName: nextSource.original_name,
        source: nextSource,
      };
      const savedAt = saveForm(projectScope, formId, loadedWorkbook, sourceMeta);
      setActiveForm(projectScope, formId);
      if (savedAt != null) {
        dispatch({ type: "MARK_SAVED", savedAt });
      }
      if (opts?.register !== false) {
        // Creación/import: registra el formulario en la colección del backend
        // y lo activa (re-deriva el espejo s$xlsform_state).
        void (async () => {
          try {
            await syncFormToBackend(formId, loadedWorkbook, {
              ...sourceMeta,
              hallazgos: opts?.hallazgos ?? [],
            });
            // En creación por lotes (Matriz PULSO con varias audiencias) NO se
            // activa cada formulario: eso dispara varias activaciones de fondo
            // que pueden sobrepasar al switchToForm final y dejar el espejo del
            // .pulso apuntando al formulario equivocado. El caller activa el
            // elegido al final (activate=false salta la activación aquí).
            if (opts?.activate !== false) {
              await apiXlsformFormActivate(formId);
            }
          } catch (err) {
            if (isFormLimitError(err)) {
              // Carrera contra el tope compartido: el guard cliente vio cupo
              // pero el backend ya estaba lleno (otra ventana/máquina). Revertimos
              // la creación local para no dejar un formulario fantasma y volvemos
              // al hub con un aviso amable en vez de un error crudo.
              const next = deleteForm(projectScope, formId);
              setForms(next.forms);
              dispatch({ type: "CLEAR" });
              resetMessages();
              toasts.push({
                kind: "info",
                title: `Límite de ${MAX_FORMS} formularios`,
                detail:
                  "Este proyecto ya alcanzó el máximo de formularios. Elimina uno para crear otro.",
                durationMs: 6000,
              });
              return;
            }
            // Resto de errores (red, sesión): lo local sigue intacto y
            // reintentará en el próximo autosave.
          }
        })();
      }
      setForms(listForms(projectScope));
      return formId;
    },
    [persistence, projectScope, dispatch, toasts],
  );

  // Wrapper retrocompatible: cada import/creación abre un formulario NUEVO.
  const loadWorkbook = useCallback(
    (
      next: XlsformEditorWorkbook,
      nextSource: XlsformFormSource,
      nextStatus: string,
      hallazgosForBackend?: Hallazgo[],
    ) => {
      openWorkbookAsForm(next, nextSource, nextStatus, { hallazgos: hallazgosForBackend });
    },
    [openWorkbookAsForm],
  );

  // Salta a otro formulario de la biblioteca: sella el actual (flush),
  // lo activa en el backend, baja su workbook (local + .pulso reconciliados)
  // y lo hidrata. El undo/redo del anterior se descarta (ya quedó persistido).
  const switchToForm = useCallback(
    async (id: string): Promise<void> => {
      if (!id || id === activeFormIdRef.current) return;
      persistence.flush();
      try {
        await apiXlsformFormActivate(id);
      } catch {
        // ignore — seguimos con lo local; la activación reintenta al reabrir.
      }
      const local = loadForm(projectScope, id);
      let remote: PersistedSnapshot | null = null;
      let remoteHallazgos: Hallazgo[] = [];
      try {
        const r = await apiXlsformFormGet(id);
        if (r.form) {
          remote = {
            workbook: r.form.workbook,
            savedAt: r.form.saved_at,
            sourceName: r.form.source?.original_name ?? null,
            sourceKind: r.form.source?.kind ?? null,
            source: r.form.source,
            hallazgos: r.form.hallazgos,
          };
          remoteHallazgos = r.form.hallazgos;
        }
      } catch {
        // ignore — reconciliamos solo con lo local.
      }
      const reconciled = reconcileSnapshotWithBackend(local, remote) ?? local ?? remote;
      if (!reconciled) {
        toasts.push({
          kind: "danger",
          title: "No se pudo abrir el formulario",
          detail: "No encontramos el contenido de ese formulario ni localmente ni en el proyecto.",
        });
        refreshForms();
        return;
      }
      setHallazgos(reconciled === remote ? remoteHallazgos : []);
      openWorkbookAsForm(
        reconciled.workbook,
        reconciled.source ?? {
          kind: reconciled.sourceKind,
          original_name: reconciled.sourceName,
        },
        "Cambiaste de formulario.",
        { formId: id, register: false },
      );
    },
    [persistence, projectScope, openWorkbookAsForm, refreshForms, toasts],
  );

  useEffect(() => {
    switchToFormRef.current = switchToForm;
  }, [switchToForm]);

  const updateWorkbook = useCallback(
    (mutator: (draft: XlsformEditorWorkbook) => void) => {
      if (!workbook) return;
      const draft = cloneWorkbook(workbook);
      mutator(draft);
      dispatch({ type: "SET", workbook: draft });
      setArtifact(null);
    },
    [workbook],
  );

  // Descartar el snapshot ofrecido al montar y empezar de cero. Limpia
  // el bucket del proyecto actual — los snapshots de otros proyectos
  // quedan intactos.
  const dismissRestoreOffer = useCallback(() => {
    persistence.cancel();
    setRestoreOffer(null);
    clearSnapshot(projectScope);
    void clearSnapshotFromBackend();
  }, [persistence, projectScope]);

  // Aceptar el snapshot ofrecido y restaurarlo como workbook actual.
  const acceptRestoreOffer = useCallback(() => {
    const snap = restoreOffer;
    if (!snap) return;
    loadWorkbook(
      snap.workbook,
      snap.source ?? { kind: snap.sourceKind ?? null, original_name: snap.sourceName ?? null },
      "Continuamos con el formulario guardado en este proyecto.",
    );
  }, [restoreOffer, loadWorkbook]);

  function blockUntilRestoreDecision(actionLabel: string): boolean {
    if (!restoreOffer || workbook) return false;
    const detail =
      "Primero continúa el formulario guardado o descarta ese guardado. Así evitamos abrir otro flujo encima de una recuperación pendiente.";
    setStatus(detail);
    toasts.push({
      kind: "warn",
      title: `Antes de ${actionLabel}`,
      detail,
      durationMs: 7000,
    });
    return true;
  }

  async function onImportXls(file?: File) {
    if (!file) return;
    if (blockUntilRestoreDecision("importar otro XLSForm")) {
      if (xlsInputRef.current) xlsInputRef.current.value = "";
      return;
    }
    if (blockIfAtFormLimit()) {
      if (xlsInputRef.current) xlsInputRef.current.value = "";
      return;
    }
    resetMessages();
    setBusy(`Importando ${file.name}…`);
    try {
      const up = await apiUpload(file, "xlsform");
      const out = await apiXlsformEditorImport(up.file_id);
      if (isMatrizPulsoImport(out)) {
        // No es un XLSForm: es una Matriz PULSO IAC-CINDA. En vez de cargar un
        // workbook, pedimos al usuario elegir audiencias y generamos un
        // formulario por cada una en el paso siguiente.
        if (out.audiences.length === 0) {
          const detail = "Detectamos una matriz PULSO pero sin columnas de audiencia reconocibles.";
          setError(detail);
          toasts.push({ kind: "warn", title: "Matriz PULSO sin audiencias", detail });
          return;
        }
        setMatrizPulsoDialog({
          fileId: up.file_id,
          fileName: out.original_name ?? file.name,
          audiences: out.audiences,
        });
        return;
      }
      loadWorkbook(
        out.workbook,
        out.source,
        `Abrimos ${file.name} para trabajarlo como constructor de formulario dentro de Prosecnur.`
      );
      setSmLogicRules([]);
      setSmVisualLogicRules([]);
      setSmLogicChoiceOverrides({});
      toasts.push({
        kind: "success",
        title: "Formulario importado",
        detail: `Abrimos ${file.name} en el constructor.`,
      });
    } catch (e: unknown) {
      const msg = (e as Error).message;
      setError(msg);
      toasts.push({ kind: "danger", title: "No se pudo importar", detail: msg });
    } finally {
      setBusy("");
      if (xlsInputRef.current) xlsInputRef.current.value = "";
    }
  }

  function onImportSurveyMonkey() {
    if (blockUntilRestoreDecision("traducir SurveyMonkey")) return;
    if (blockIfAtFormLimit()) return;
    resetMessages();
    setSmImportDialog({ fileId: null, fileName: "SurveyMonkey API" });
  }

  // Confirmación del diálogo de Matriz PULSO: por cada audiencia elegida pide al
  // backend el workbook y lo registra como formulario propio en la biblioteca.
  // Respeta el tope del proyecto (crea hasta el cupo libre) y activa el primero.
  async function onMatrizPulsoConfirm(selectedAudiences: string[]) {
    const dialog = matrizPulsoDialog;
    if (!dialog) return;
    const plan = planMatrizPulsoForms(selectedAudiences, forms.length, MAX_FORMS);
    if (plan.toCreate.length === 0) {
      toasts.push({
        kind: "warn",
        title: `Límite de ${MAX_FORMS} formularios`,
        detail:
          "Este proyecto ya alcanzó el máximo de formularios. Elimina uno para generar los de la matriz.",
        durationMs: 6000,
      });
      return;
    }
    setMatrizPulsoSubmitting(true);
    resetMessages();
    setBusy(`Generando ${plan.toCreate.length} formulario(s) de la matriz PULSO…`);
    const createdIds: string[] = [];
    const scaleNotes: string[] = [];
    const failed: string[] = [];
    try {
      for (const audience of plan.toCreate) {
        try {
          const res = await apiXlsformEditorImportMatrizPulso(dialog.fileId, audience);
          const formId = openWorkbookAsForm(
            res.workbook,
            { kind: "matriz_pulso", original_name: `${dialog.fileName} · ${audience}` },
            `Generamos el formulario de ${audience} desde la matriz PULSO.`,
            // Guarda cada formulario sin activarlo; el switchToForm de abajo
            // activa solo el primero, evitando la carrera de activaciones.
            { activate: false },
          );
          createdIds.push(formId);
          const detailParts: string[] = [];
          if (res.summary.n_acuerdo != null) detailParts.push(`${res.summary.n_acuerdo} de acuerdo`);
          if (res.summary.n_satisfaccion != null) detailParts.push(`${res.summary.n_satisfaccion} de satisfacción`);
          if (res.summary.scale_inferred || detailParts.length > 0) {
            scaleNotes.push(
              `${audience}: escala inferida${detailParts.length ? ` — ${detailParts.join(", ")}` : ""}`,
            );
          }
        } catch {
          failed.push(audience);
        }
      }
    } finally {
      setMatrizPulsoSubmitting(false);
      setBusy("");
    }
    // Activa el primero generado para dejar al usuario dentro de un formulario.
    if (createdIds.length > 0) {
      await switchToForm(createdIds[0]);
    }
    setSmLogicRules([]);
    setSmVisualLogicRules([]);
    setSmLogicChoiceOverrides({});
    setMatrizPulsoDialog(null);
    if (createdIds.length > 0) {
      toasts.push({
        kind: "success",
        title: `Matriz PULSO · ${createdIds.length} formulario${createdIds.length === 1 ? "" : "s"}`,
        detail: `Generamos ${plan.toCreate.slice(0, createdIds.length).join(", ")} desde ${dialog.fileName}.`,
      });
    }
    if (scaleNotes.length > 0) {
      toasts.push({
        kind: "info",
        title: "Escala inferida — revísala",
        detail: `${scaleNotes.join(" · ")}. Revisa las preguntas antes de publicar.`,
        durationMs: 8000,
      });
    }
    if (plan.capped) {
      toasts.push({
        kind: "warn",
        title: `Límite de ${MAX_FORMS} formularios`,
        detail: `Quedó(aron) fuera ${plan.skipped.join(", ")} por el tope del proyecto. Elimina formularios para generar el resto.`,
        durationMs: 7000,
      });
    }
    if (failed.length > 0) {
      toasts.push({
        kind: "danger",
        title: "Algunas audiencias fallaron",
        detail: `No pudimos generar: ${failed.join(", ")}.`,
      });
    }
  }

  // Callback del modal cuando completa con éxito (ya con o sin reglas aplicadas)
  async function onSurveyMonkeyImportComplete(payload: {
    workbook: XlsformEditorWorkbook;
    source: XlsformFormSource;
    hallazgos: Hallazgo[];
    surveyMonkeyRules?: ConfirmedRule[];
    surveyMonkeyVisualRules?: SurveyMonkeyVisualLogicRule[];
    surveyMonkeyChoiceOverrides?: Record<string, string[]>;
    surveyMonkeyChoiceCodeMaps?: ChoiceCodeMap[];
  }) {
    const fileName = smImportDialog?.fileName ?? payload.source.original_name ?? "archivo";
    const choiceCodeMaps = payload.surveyMonkeyChoiceCodeMaps ?? payload.workbook.surveyMonkeyLogic?.choice_code_maps ?? [];
    const workbookDraft = workbookWithSurveyMonkeyLogic(
      payload.workbook,
      payload.surveyMonkeyRules ?? [],
      payload.surveyMonkeyVisualRules ?? [],
      payload.surveyMonkeyChoiceOverrides ?? {},
      choiceCodeMaps,
    );
    const refreshedRules = await refreshSurveyMonkeyAdvancedRules(
      payload.surveyMonkeyRules ?? [],
      workbookDraft,
      payload.surveyMonkeyChoiceOverrides ?? {},
    );
    const workbookWithLogic = workbookWithSurveyMonkeyLogic(
      payload.workbook,
      refreshedRules,
      payload.surveyMonkeyVisualRules ?? [],
      payload.surveyMonkeyChoiceOverrides ?? {},
      choiceCodeMaps,
    );
    setSmImportDialog(null);
    setHallazgos(payload.hallazgos);
    loadWorkbook(
      workbookWithLogic,
      payload.source,
      payload.hallazgos.length > 0
        ? `Tradujimos ${fileName} y aplicamos tu lógica. Hay ${payload.hallazgos.length} hallazgo(s) para revisar.`
        : `Tradujimos ${fileName} a un constructor editable.`,
      payload.hallazgos,
    );
    toasts.push({
      kind: "success",
      title: "Traducción completada",
      detail:
        payload.hallazgos.length > 0
          ? `${fileName} traducido — revisa los hallazgos del validador.`
          : `${fileName} ahora es un XLSForm editable.`,
    });
  }

  async function applySurveyMonkeyLogicFromEditor() {
    if (!workbook) return;
    const visualText = compileVisualLogicRules(smVisualLogicRules);
    const advancedText = smLogicRules.map((r) => r.texto).join("\n");
    const reglasText = [visualText, advancedText].filter((part) => part.trim()).join("\n");
    if (!reglasText.trim()) {
      toasts.push({
        kind: "warn",
        title: "Sin lógica configurada",
        detail: "Configura al menos un salto visual o una regla avanzada antes de aplicar.",
      });
      return;
    }
    setBusy("Aplicando lógica SurveyMonkey…");
    try {
      const choiceCodeMaps = choiceCodeMapsWithOverrides(
        workbook,
        smLogicChoiceOverrides,
        workbook.surveyMonkeyLogic?.choice_code_maps ?? [],
      );
      const result = await apiXlsformEditorSmApplyLogic(
        workbook,
        reglasText,
        {},
        smLogicChoiceOverrides,
        source?.original_name ?? "XLSForm actual",
        choiceCodeMaps,
        true,
      );
      const refreshedRules = await refreshSurveyMonkeyAdvancedRules(
        smLogicRules,
        workbookWithSurveyMonkeyLogic(result.workbook, smLogicRules, smVisualLogicRules, smLogicChoiceOverrides, choiceCodeMaps),
        smLogicChoiceOverrides,
      );
      const nextWorkbook = workbookWithSurveyMonkeyLogic(
        result.workbook,
        refreshedRules,
        smVisualLogicRules,
        smLogicChoiceOverrides,
        choiceCodeMaps,
      );
      setSmLogicRules(refreshedRules);
      dispatch({ type: "SET", workbook: nextWorkbook });
      setArtifact(null);
      setSmLogicDialogOpen(false);
      toasts.push({
        kind: "success",
        title: "Lógica SurveyMonkey recalculada",
        detail: "Los saltos del modal reemplazaron la lógica previa en los destinos afectados.",
      });
    } catch (e) {
      const msg = (e as Error).message;
      toasts.push({ kind: "danger", title: "No se pudo aplicar la lógica", detail: msg });
    } finally {
      setBusy("");
    }
  }

  function updateSurveyMonkeyLogicDraft(
    nextRules: ConfirmedRule[],
    nextVisualRules = smVisualLogicRules,
    nextOverrides = smLogicChoiceOverrides,
    nextChoiceCodeMaps = workbook?.surveyMonkeyLogic?.choice_code_maps ?? [],
  ) {
    setSmLogicRules(nextRules);
    setSmVisualLogicRules(nextVisualRules);
    setSmLogicChoiceOverrides(nextOverrides);
    if (!workbook) return;
    dispatch({
      type: "SET",
      workbook: workbookWithSurveyMonkeyLogic(workbook, nextRules, nextVisualRules, nextOverrides, nextChoiceCodeMaps),
    });
    setArtifact(null);
  }

  function updateSurveyMonkeyOverridesDraft(nextOverrides: Record<string, string[]>, nextChoiceCodeMaps?: ChoiceCodeMap[]) {
    const choiceCodeMaps = nextChoiceCodeMaps ?? workbook?.surveyMonkeyLogic?.choice_code_maps ?? [];
    updateSurveyMonkeyLogicDraft(smLogicRules, smVisualLogicRules, nextOverrides, choiceCodeMaps);
    if (!workbook || smLogicRules.length === 0) return;

    const workbookForRefresh = workbookWithSurveyMonkeyLogic(
      workbook,
      smLogicRules,
      smVisualLogicRules,
      nextOverrides,
      choiceCodeMaps,
    );
    void refreshSurveyMonkeyAdvancedRules(smLogicRules, workbookForRefresh, nextOverrides).then((refreshedRules) => {
      if (JSON.stringify(refreshedRules) === JSON.stringify(smLogicRules)) return;
      updateSurveyMonkeyLogicDraft(refreshedRules, smVisualLogicRules, nextOverrides, choiceCodeMaps);
    });
  }

  function updateSurveyMonkeyVisualRulesDraft(nextVisualRules: SurveyMonkeyVisualLogicRule[]) {
    updateSurveyMonkeyLogicDraft(smLogicRules, nextVisualRules, smLogicChoiceOverrides);
  }

  function entregableStem(originalName: string): string {
    return sanitizeFilenameStem(originalName);
  }

  function pdfFilenameFromSource(name: string | null | undefined): string {
    return cleanFilename(name)
      .replace(/_editado\.xlsx$/i, "_papel.pdf")
      .replace(/\.xlsx$/i, ".pdf");
  }

  function wordFilenameFromSource(name: string | null | undefined): string {
    return cleanFilename(name)
      .replace(/_editado\.xlsx$/i, "_papel.docx")
      .replace(/\.xlsx$/i, ".docx");
  }

  async function onExport() {
    if (!workbook) return;
    resetMessages();
    setArtifact(null);
    setBusy("Exportando XLSForm…");
    try {
      const exportableWorkbook = { ...workbook, diagnostico: null };
      const out = await apiXlsformEditorExport(
        exportableWorkbook,
        cleanFilename(source?.original_name),
        source,
        { include_app_columns: includeAppColumns },
      );
      setArtifact({ file_id: out.file_id, original_name: out.original_name, extension: "xlsx" });
      // Tras un export exitoso el workbook está "guardado" (en disco).
      // Forzamos el flush del autosave también para sellar el snapshot
      // local con el mismo timestamp.
      const savedAt = persistence.flush() ?? Date.now();
      dispatch({ type: "MARK_SAVED", savedAt });
      setStatus(`Listo: generamos ${out.original_name} para descargarlo o seguir iterándolo.`);
      // Si hay un proyecto .pulso abierto, el archivo va automáticamente a
      // su carpeta (junto al .pulso). Si no, fallback a descarga browser.
      if (project.status.has_project) {
        // El backend rechaza nombres con espacios, acentos o caracteres
        // especiales (E_INVALID_FILENAME). Normalizamos: quitamos
        // diacríticos, sustituimos no-alfanuméricos por underscore, y
        // colapsamos repetidos.
        const baseName = entregableStem(out.original_name);
        try {
          const saved = await apiSaveEntregable(out.file_id, baseName, { overwrite: true });
          toasts.push({
            kind: "success",
            title: "Exportación guardada en el proyecto",
            detail: saved.path,
            durationMs: 8000,
          });
        } catch (e) {
          toasts.push({
            kind: "warn",
            title: "No se pudo guardar en la carpeta del proyecto",
            detail: (e as Error).message,
            durationMs: 8000,
            action: {
              label: "Descargar",
              onClick: () => { window.open(downloadUrl(out.file_id), "_blank"); },
            },
          });
        }
      } else {
        toasts.push({
          kind: "success",
          title: "Exportación lista",
          detail: out.original_name,
          durationMs: 6000,
          action: {
            label: "Descargar",
            onClick: () => { window.open(downloadUrl(out.file_id), "_blank"); },
          },
        });
      }
    } catch (e: unknown) {
      const msg = (e as Error).message;
      setError(msg);
      toasts.push({ kind: "danger", title: "No se pudo exportar", detail: msg });
    } finally {
      setBusy("");
    }
  }

  async function onExportForm(
    format: "pdf" | "word" = "pdf",
    columns: 1 | 2 = 2,
    logicLanguage: "saltos" | "condiciones" = "saltos",
    showQuestionnaireNumber: boolean = true,
    matrixGroups: Array<{ members: string[]; tenor?: string; special?: string; header?: string }> = [],
    matrixLayout: "full" | "column" = "full",
    consentVar: string | null = null,
  ) {
    if (!workbook) return;
    const isWord = format === "word";
    const label = isWord ? "Word" : "PDF";
    const ext = isWord ? "docx" : "pdf";
    resetMessages();
    setArtifact(null);
    setBusy(`Exportando ${label} para papel…`);
    try {
      const exportableWorkbook = { ...workbook, diagnostico: null };
      const exportFn = isWord ? apiXlsformEditorExportWord : apiXlsformEditorExportPdf;
      const filename = isWord
        ? wordFilenameFromSource(source?.original_name)
        : pdfFilenameFromSource(source?.original_name);
      const out = await exportFn(
        exportableWorkbook,
        filename,
        {
          columns,
          logic_language: logicLanguage,
          show_questionnaire_number: showQuestionnaireNumber,
          matrix_layout: matrixLayout,
          matrix_groups: matrixGroups,
          ...(consentVar ? { consent_var: consentVar } : {}),
        },
      );
      setArtifact({ file_id: out.file_id, original_name: out.original_name, extension: ext });
      setStatus(`Listo: generamos ${out.original_name} con plantilla impresa Pulso.`);
      const warnDetail = out.warnings?.length
        ? ` ${out.warnings.length} salto(s) o regla(s) necesitan revisión manual.`
        : "";

      if (project.status.has_project) {
        try {
          const saved = await apiSaveEntregable(out.file_id, entregableStem(out.original_name), { overwrite: true });
          toasts.push({
            kind: out.warnings?.length ? "warn" : "success",
            title: `${label} guardado en el proyecto`,
            detail: `${saved.path}${warnDetail}`,
            durationMs: 9000,
          });
        } catch (e) {
          toasts.push({
            kind: "warn",
            title: `${label} listo, pero no se pudo guardar en el proyecto`,
            detail: (e as Error).message,
            durationMs: 8000,
            action: {
              label: "Descargar",
              onClick: () => { window.open(downloadUrl(out.file_id), "_blank"); },
            },
          });
        }
      } else {
        toasts.push({
          kind: out.warnings?.length ? "warn" : "success",
          title: `${label} listo`,
          detail: `${out.original_name}${warnDetail}`,
          durationMs: 7000,
          action: {
            label: "Descargar",
            onClick: () => { window.open(downloadUrl(out.file_id), "_blank"); },
          },
        });
      }
    } catch (e: unknown) {
      const msg = (e as Error).message;
      setError(msg);
      toasts.push({ kind: "danger", title: `No se pudo exportar el ${label}`, detail: msg });
    } finally {
      setBusy("");
    }
  }

  // Vuelve al hub (biblioteca de formularios) sin perder la colección: sella
  // el formulario abierto y despacha CLEAR. El conmutador del toolbar y —en
  // Oleada 3— el hub usan esto para "Ver todos".
  function onBackToHub() {
    const formId = activeFormIdRef.current;
    const currentWorkbook = workbookRef.current;
    persistence.flush();
    resetMessages();
    dispatch({ type: "CLEAR" });
    refreshForms();
    if (formId && currentWorkbook) {
      void syncFormToBackend(formId, currentWorkbook, {
        sourceKind: source?.kind ?? null,
        sourceName: source?.original_name ?? null,
        source,
        hallazgos,
      })
        .then(refreshBackendFormIndex)
        .catch(() => refreshBackendFormIndex().catch(() => undefined));
    } else {
      void refreshBackendFormIndex().catch(() => undefined);
    }
  }

  // Guard del tope de 6: avisa con un toast amable y bloquea la creación. Se
  // llama al inicio de cada vía (nuevo en blanco / importar XLSForm / traducir
  // SurveyMonkey). Devuelve `true` si ya no hay cupo.
  function blockIfAtFormLimit(): boolean {
    if (canCreateForm) return false;
    toasts.push({
      kind: "info",
      title: `Límite de ${MAX_FORMS} formularios`,
      detail: "Este proyecto ya tiene el máximo de formularios. Elimina uno para crear otro.",
      durationMs: 5000,
    });
    return true;
  }

  function onNewWorkbook() {
    if (blockUntilRestoreDecision("empezar otro formulario")) return;
    if (blockIfAtFormLimit()) return;
    if (dirty && !window.confirm("Hay cambios sin exportar. ¿Abrimos un constructor nuevo igual?")) return;
    resetMessages();
    loadWorkbook(
      createBlankWorkbook(),
      { kind: null, original_name: null },
      "Creamos una base limpia para diseñar el formulario desde una interfaz guiada."
    );
  }

  function updateSurveyField(rowIndex: number, field: string, value: string) {
    updateWorkbook((draft) => {
      // Si se está renombrando una pregunta (`name`), debemos también
      // actualizar TODAS las referencias `${oldName}` que existan en
      // las columnas con expresiones (relevant/constraint/calculation/
      // choice_filter/default/label/hint/repeat_count/...). Sin esto
      // un rename rompe lógica silenciosamente — bug latente que el
      // usuario reportó como crítico.
      //
      // El refactor sólo se aplica cuando el rename es VÁLIDO (regex
      // de XLSForm name) y no es un duplicado, para no propagar
      // estados intermedios mientras el usuario está tipeando. Heurística
      // pragmática: si el nuevo valor matchea regex y el viejo también,
      // se aplica.
      if (field === "name") {
        const oldName = getCell(draft.survey, rowIndex, "name");
        const newName = value;
        const NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
        if (
          oldName &&
          newName &&
          oldName !== newName &&
          NAME_RE.test(oldName) &&
          NAME_RE.test(newName)
        ) {
          // Antes de aplicar el rename, propagamos referencias.
          const cellsChanged = replaceVarReferences(
            draft.survey,
            oldName,
            newName,
            [...SURVEY_COLUMNS_WITH_VAR_REFS],
          );
          if (cellsChanged > 0) {
            // El toast se dispara fuera del updater (no dentro del
            // callback de immer). Lo guardamos para post-dispatch.
            queueMicrotask(() => {
              toasts.push({
                kind: "info",
                title: "Referencias actualizadas",
                detail: `${cellsChanged} ${cellsChanged === 1 ? "celda" : "celdas"} con \${${oldName}} → \${${newName}}.`,
              });
            });
          }
        }
      }
      setCell(draft.survey, rowIndex, field, value);
    });
  }

  function updateSurveyFields(rowIndex: number, updates: Record<string, string>) {
    updateWorkbook((draft) => {
      for (const [field, value] of Object.entries(updates)) {
        setCell(draft.survey, rowIndex, field, value);
      }
    });
  }

  function updateSettingsField(field: string, value: string) {
    updateWorkbook((draft) => {
      if (!draft.settings.rows.length) {
        draft.settings.rows.push(new Array(draft.settings.columns.length).fill(""));
      }
      setCell(draft.settings, 0, field, value);
    });
  }

  type EditableSheetKey = "survey" | "choices" | "settings" | "paper";

  function editableSheet(draft: XlsformEditorWorkbook, sheetName: EditableSheetKey) {
    if (sheetName === "paper" && !draft.paper) draft.paper = makeSheet("paper", PAPER_COLUMNS);
    return draft[sheetName]!;
  }

  // ── Handlers del modo Hojas (sheets) — operan a nivel de celda raw ──
  function sheetsUpdateCell(
    sheetName: EditableSheetKey,
    rowIndex: number,
    columnName: string,
    value: string,
  ) {
    updateWorkbook((draft) => {
      // Si es la columna `name` de survey, también propagamos referencias
      // (mismo refactor que en updateSurveyField). Sheets no debería ser
      // un escape hatch silencioso para romper referencias.
      if (sheetName === "survey" && columnName === "name") {
        const oldName = getCell(draft.survey, rowIndex, "name");
        const newName = value;
        const NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
        if (
          oldName &&
          newName &&
          oldName !== newName &&
          NAME_RE.test(oldName) &&
          NAME_RE.test(newName)
        ) {
          const cellsChanged = replaceVarReferences(
            draft.survey,
            oldName,
            newName,
            [...SURVEY_COLUMNS_WITH_VAR_REFS],
          );
          if (cellsChanged > 0) {
            queueMicrotask(() => {
              toasts.push({
                kind: "info",
                title: "Referencias actualizadas",
                detail: `${cellsChanged} ${cellsChanged === 1 ? "celda" : "celdas"} con \${${oldName}} → \${${newName}}.`,
              });
            });
          }
        }
      }
      setCell(editableSheet(draft, sheetName), rowIndex, columnName, value);
    });
  }
  function sheetsAddRow(sheetName: EditableSheetKey) {
    updateWorkbook((draft) => {
      const sheet = editableSheet(draft, sheetName);
      sheet.rows.push(new Array(sheet.columns.length).fill(""));
    });
  }
  function sheetsDeleteRow(
    sheetName: EditableSheetKey,
    rowIndex: number,
  ) {
    updateWorkbook((draft) => {
      deleteRow(editableSheet(draft, sheetName), rowIndex);
    });
  }
  function sheetsMoveRow(
    sheetName: EditableSheetKey,
    rowIndex: number,
    direction: "up" | "down",
  ) {
    updateWorkbook((draft) => {
      const sheet = editableSheet(draft, sheetName);
      const target = direction === "up" ? rowIndex - 1 : rowIndex + 1;
      if (target < 0 || target >= sheet.rows.length) return;
      const next = [...sheet.rows];
      [next[rowIndex], next[target]] = [next[target]!, next[rowIndex]!];
      sheet.rows = next;
    });
  }
  function sheetsAddColumn(
    sheetName: EditableSheetKey,
    columnName: string,
  ) {
    updateWorkbook((draft) => {
      ensureColumn(editableSheet(draft, sheetName), columnName);
    });
  }

  function updateQuestionType(rowIndex: number, nextBaseType: string) {
    updateWorkbook((draft) => {
      const record = rowToRecord(draft.survey, rowIndex);
      const currentType = parseType(record.type ?? "");
      const nextListName = (nextBaseType === "select_one" || nextBaseType === "select_multiple")
        ? (currentType.listName || `lista_${slug(record.name || record.label || "opcion")}`)
        : "";
      setCell(draft.survey, rowIndex, "type", buildType(nextBaseType, nextListName));
    });
  }

  function assignCatalogToQuestion(rowIndex: number, listName: string) {
    updateWorkbook((draft) => {
      const record = rowToRecord(draft.survey, rowIndex);
      const currentType = parseType(record.type ?? "");
      const base = currentType.base === "select_multiple" ? "select_multiple" : "select_one";
      setCell(draft.survey, rowIndex, "type", buildType(base, listName));
    });
    setCatalogFocus(listName);
  }

  function createCatalog(assignToSelected = false) {
    if (!workbook) return;
    const baseName = slug(selectedNode?.name || selectedNode?.label || "catalogo", "catalogo");
    let nextName = `cat_${baseName}`;
    let i = 2;
    const existing = new Set(catalogs.map((catalog) => catalog.listName));
    while (existing.has(nextName)) {
      nextName = `cat_${baseName}_${i}`;
      i += 1;
    }

    updateWorkbook((draft) => {
      if (!assignToSelected) {
        insertRecord(draft.choices, draft.choices.rows.length, {
          list_name: nextName,
          name: "opcion_1",
          label: "Nueva opción 1",
        });
      }
      if (assignToSelected && selection?.kind === "survey") {
        const record = rowToRecord(draft.survey, selection.rowIndex);
        const currentType = parseType(record.type ?? "");
        const base = currentType.base === "select_multiple" ? "select_multiple" : "select_one";
        setCell(draft.survey, selection.rowIndex, "type", buildType(base, nextName));
      }
    });

    setCatalogFocus(nextName);
  }

  function renameCatalog(oldListName: string, nextListNameRaw: string) {
    const nextListName = slug(nextListNameRaw, "catalogo");
    if (!nextListName || nextListName === oldListName) return;
    if (catalogs.some((catalog) => catalog.listName === nextListName)) {
      setError(`Ya existe una lista llamada "${nextListName}".`);
      return;
    }
    setError("");
    updateWorkbook((draft) => {
      const listCol = ensureColumn(draft.choices, "list_name");
      draft.choices.rows = draft.choices.rows.map((row) => {
        const next = [...row];
        if ((next[listCol] ?? "") === oldListName) next[listCol] = nextListName;
        return next;
      });
      const typeCol = ensureColumn(draft.survey, "type");
      draft.survey.rows = draft.survey.rows.map((row) => {
        const next = [...row];
        const typeInfo = parseType(next[typeCol] ?? "");
        if (typeInfo.listName === oldListName && (typeInfo.base === "select_one" || typeInfo.base === "select_multiple")) {
          next[typeCol] = buildType(typeInfo.base, nextListName);
        }
        return next;
      });
    });
    setCatalogFocus(nextListName);
  }

  function updateSectionKind(rowIndex: number, nextKind: "begin_group") {
    // Convierte una fila en apertura de sección SIN crear el cierre
    // automáticamente: el cierre es una pieza que el usuario coloca donde
    // decide (add "Cerrar sección"). Si la fila ya pertenecía a una sección
    // con cierre, ese cierre se mantiene tal cual.
    updateWorkbook((draft) => {
      setCell(draft.survey, rowIndex, "type", nextKind);
    });
  }

  function toggleRequired(rowIndex: number, nextChecked: boolean) {
    updateWorkbook((draft) => {
      setCell(draft.survey, rowIndex, "required", nextChecked ? "yes" : "");
    });
  }

  function addQuestion(
    nextBaseType = "text",
    afterRowIndex?: number | null,
    reuseListName?: string,
  ) {
    if (!workbook) return;
    // Si nos pasan un override (ej. desde el AddBetween del lienzo único),
    // calculamos el índice como si la selección fuera ese row — eso lleva
    // la inserción justo después, respetando límites de sección.
    const overrideSelection: BuilderSelection | null =
      afterRowIndex != null ? { kind: "survey", rowIndex: afterRowIndex } : selection;
    const insertionIndex = resolveInsertionIndex(structure, overrideSelection, workbook.survey);
    const nextName = `pregunta_${workbook.survey.rows.length + 1}`;
    const isSelect = nextBaseType === "select_one" || nextBaseType === "select_multiple";
    // Para selects: si el usuario eligió "reusar lista existente" desde
    // el AddBetween, vinculamos la pregunta a ese listName. Si no,
    // generamos una lista nueva vacía con nombre único basado en la
    // pregunta; las opciones se agregan explícitamente desde el lienzo o
    // el editor de catálogos, sin filas placeholder en `choices`.
    let listName = "";
    if (isSelect) {
      const existing = new Set(catalogs.map((c) => c.listName));
      if (reuseListName && existing.has(reuseListName)) {
        listName = reuseListName;
      } else {
        let candidate = `lista_${nextName}`;
        let i = 2;
        while (existing.has(candidate)) {
          candidate = `lista_${nextName}_${i}`;
          i += 1;
        }
        listName = candidate;
      }
    }
    const defaultLabel = isSelect
      ? "Nueva pregunta de selección"
      : nextBaseType === "calculate"
        ? "Nuevo cálculo"
        : nextBaseType === "note"
          ? "Nueva nota informativa"
          : "Nueva pregunta";
    updateWorkbook((draft) => {
      insertRecord(draft.survey, insertionIndex, {
        type: buildType(nextBaseType, listName),
        name: nextName,
        label: defaultLabel,
        hint: "",
        required: "",
        relevant: "",
        constraint: "",
        calculation: "",
        choice_filter: "",
        appearance: "",
      });
    });
    if (isSelect) setCatalogFocus(listName);
    setSelection({ kind: "survey", rowIndex: insertionIndex });
  }

  /**
   * Inserta una pregunta o sección desde el botón "+" del lienzo único
   * (`AddBetween`). `afterRowIndex` es el rowIndex de la pieza justo
   * arriba del botón — el nuevo elemento queda inmediatamente debajo.
   * Si `afterRowIndex` es null, inserta al final del survey.
   * `reuseListName` solo aplica a select_one/select_multiple — la
   * pregunta nueva queda vinculada a esa lista existente en lugar de
   * crear una nueva.
   */
  function handleAddAfter(
    afterRowIndex: number | null,
    kind: "section" | "section_end" | "text" | "select_one" | "select_multiple" | "integer" | "decimal" | "date" | "image" | "audio" | "video" | "file" | "barcode" | "geopoint" | "note" | "calculate",
    reuseListName?: string,
  ) {
    if (kind === "section") addSection(afterRowIndex);
    else if (kind === "section_end") addSectionClose(afterRowIndex);
    else addQuestion(kind, afterRowIndex, reuseListName);
  }

  /**
   * Clona el catálogo asignado a una pregunta a un listName nuevo y
   * reasigna el `type` de la pregunta. Se invoca desde
   * `EditableChoiceList` cuando el catálogo está compartido y el usuario
   * quiere divergir solo para esta pregunta. El listName nuevo intenta
   * `{old}_copy`, `{old}_copy_2`, ... hasta no chocar.
   */
  function cloneCatalogForQuestion(questionRowIndex: number) {
    if (!workbook || !structure) return;
    const node = structure.byRow.get(questionRowIndex);
    if (!node || !node.typeInfo.listName) return;
    const oldListName = node.typeInfo.listName;
    const existingNames = new Set(catalogs.map((c) => c.listName));
    let suffix = "_copy";
    let attempt = 1;
    let newListName = `${oldListName}${suffix}`;
    while (existingNames.has(newListName)) {
      attempt += 1;
      newListName = `${oldListName}${suffix}_${attempt}`;
    }
    const oldChoices = extractChoiceItems(workbook.choices, oldListName);
    updateWorkbook((draft) => {
      // Insertar todas las filas del catálogo viejo con el nuevo list_name.
      oldChoices.forEach((choice) => {
        insertRecord(draft.choices, draft.choices.rows.length, {
          list_name: newListName,
          name: choice.name,
          label: choice.label,
        });
      });
      // Reasignar el tipo de la pregunta.
      setCell(draft.survey, questionRowIndex, "type", buildType(node.typeInfo.base, newListName));
    });
    setCatalogFocus(newListName);
  }

  /**
   * Crea una sección: inserta el `begin_group` y su `end_group` como par
   * (ambos filas visibles del outline). El cierre NO es un ente oculto y
   * automático como antes: es una pieza propia que el usuario puede mover
   * (arrastrar, sin cruzar antes de su begin) o eliminar. Así la sección
   * nace válida y el autor ajusta su alcance después.
   */
  function addSection(afterRowIndex?: number | null) {
    if (!workbook) return;
    const overrideSelection: BuilderSelection | null =
      afterRowIndex != null ? { kind: "survey", rowIndex: afterRowIndex } : selection;
    const insertionIndex = resolveInsertionIndex(structure, overrideSelection, workbook.survey);
    const nextName = `seccion_${workbook.survey.rows.length + 1}`;
    updateWorkbook((draft) => {
      insertRecord(draft.survey, insertionIndex, {
        type: "begin_group",
        name: nextName,
        label: "Nueva sección",
        relevant: "",
      });
      insertRecord(draft.survey, insertionIndex + 1, { type: "end_group" });
    });
    setSelection({ kind: "survey", rowIndex: insertionIndex });
  }

  /**
   * Inserta un cierre de sección (`end_group`) como pieza independiente.
   * Espejo de `addSection`: el autor decide dónde cierra el grupo abierto
   * más cercano. Si no hay ninguna sección abierta por delante, el aviso
   * de "cierre sin apertura previa" (`unmatchedEndRows`) lo señala.
   */
  function addSectionClose(afterRowIndex?: number | null) {
    if (!workbook) return;
    const overrideSelection: BuilderSelection | null =
      afterRowIndex != null ? { kind: "survey", rowIndex: afterRowIndex } : selection;
    const insertionIndex = resolveInsertionIndex(structure, overrideSelection, workbook.survey);
    updateWorkbook((draft) => {
      insertRecord(draft.survey, insertionIndex, { type: "end_group" });
    });
    setSelection({ kind: "survey", rowIndex: insertionIndex });
  }

  /**
   * Aplica un plan de drag-drop calculado por el outline. El plan ya valida
   * que el destino sea legal (ver `outline/outlineUtils.ts::computeRowMove`)
   * y trae el rango fuente, count y posición de inserción ajustada.
   */
  function mapSurveyRowAfterMove(rowIndex: number, plan: RowMovePlan): number {
    const fromEnd = plan.fromStart + plan.count;
    if (rowIndex >= plan.fromStart && rowIndex < fromEnd) {
      return plan.insertAt + (rowIndex - plan.fromStart);
    }

    if (plan.insertAt < plan.fromStart) {
      if (rowIndex >= plan.insertAt && rowIndex < plan.fromStart) {
        return rowIndex + plan.count;
      }
      return rowIndex;
    }

    const rawInsertAt = plan.insertAt + plan.count;
    if (rowIndex >= fromEnd && rowIndex < rawInsertAt) {
      return rowIndex - plan.count;
    }
    return rowIndex;
  }

  function applyOutlineMove(plan: RowMovePlan) {
    if (!workbook) return;
    const previousSelection = selection;
    updateWorkbook((draft) => {
      applyRowMove(draft.survey, plan);
    });
    // Reordenar no debe navegar el editor. Conservamos la selección actual y
    // solo remapeamos su índice si el movimiento cambió su posición.
    if (previousSelection?.kind === "survey") {
      setSelection({
        kind: "survey",
        rowIndex: mapSurveyRowAfterMove(previousSelection.rowIndex, plan),
      });
    }
  }

  function moveSelection(direction: "up" | "down") {
    if (!workbook || !selection || selection.kind !== "survey" || !structure) return;
    const currentRow = selection.rowIndex;
    const currentSpan = structure.spans.get(currentRow);
    const targetRow = direction === "up" ? movement.prevRow : movement.nextRow;
    const targetSpan = targetRow != null ? structure.spans.get(targetRow) : null;
    if (!currentSpan || !targetSpan || targetRow == null) return;

    const blockLength = currentSpan.end - currentSpan.start + 1;
    const nextStart = direction === "up"
      ? targetSpan.start
      : targetSpan.end - blockLength + 1;

    updateWorkbook((draft) => {
      const block = draft.survey.rows.slice(currentSpan.start, currentSpan.end + 1);
      draft.survey.rows.splice(currentSpan.start, blockLength);
      const insertAt = direction === "up"
        ? targetSpan.start
        : targetSpan.end - blockLength + 1;
      draft.survey.rows.splice(insertAt, 0, ...block);
    });

    setSelection({ kind: "survey", rowIndex: nextStart });
  }

  function moveSectionBoundary(rowIndex: number, direction: "include-next" | "release-last") {
    if (!workbook) return;
    updateWorkbook((draft) => {
      const draftStructure = parseBuilderStructure(draft.survey);
      const section = draftStructure.sections.get(sectionIdForRow(rowIndex));
      if (!section || section.endRowIndex == null) return;

      const target = direction === "include-next"
        ? findNextSiblingAfterSection(draftStructure, rowIndex)
        : findLastDirectChildInSection(draftStructure, rowIndex);
      if (!target) return;

      const targetSpan = draftStructure.spans.get(target.rowIndex);
      if (!targetSpan) return;

      const [closingRow] = draft.survey.rows.splice(section.endRowIndex, 1);
      if (!closingRow) return;

      let insertAt = direction === "include-next"
        ? targetSpan.end + 1
        : targetSpan.start;
      if (section.endRowIndex < insertAt) insertAt -= 1;
      draft.survey.rows.splice(insertAt, 0, closingRow);
    });
    setSelection({ kind: "survey", rowIndex });
  }

  function includeNextInSelectedSection() {
    if (!selectedNode || (selectedNode.kind !== "section" && selectedNode.kind !== "repeat")) return;
    moveSectionBoundary(selectedNode.rowIndex, "include-next");
  }

  function releaseLastFromSelectedSection() {
    if (!selectedNode || (selectedNode.kind !== "section" && selectedNode.kind !== "repeat")) return;
    moveSectionBoundary(selectedNode.rowIndex, "release-last");
  }

  function deleteCurrentSelection() {
    if (!workbook || !selection || selection.kind !== "survey") return;
    const currentRow = selection.rowIndex;
    const currentNode = structure?.byRow.get(currentRow) ?? null;
    // Caso especial: fila de CIERRE de sección (no está en byRow). Se borra
    // como fila simple; deja la sección abierta (el aviso lo señala) y el
    // usuario decide dónde poner el nuevo cierre.
    if (!currentNode) {
      if (!sectionEndRows.has(currentRow)) return;
      if (!window.confirm("¿Eliminar este cierre de sección? La sección quedará abierta hasta que agregues un nuevo cierre.")) return;
      const nextRow = currentRow > 0 ? currentRow - 1 : null;
      updateWorkbook((draft) => {
        deleteRow(draft.survey, currentRow);
      });
      setSelection(nextRow != null ? { kind: "survey", rowIndex: nextRow } : { kind: "settings" });
      return;
    }
    const question =
      currentNode.kind === "section" || currentNode.kind === "repeat"
        ? "esta sección"
        : "este elemento";

    // Antes de pedir confirmación, escaneamos referencias `${name}` que
    // viven en otras filas. Para secciones/repeats, recolectamos todos
    // los names interiores. Si hay referencias, advertimos
    // explícitamente cuántas y dónde — el usuario debe entender que va
    // a romper lógica antes de aceptar.
    const isContainer =
      currentNode.kind === "section" || currentNode.kind === "repeat";
    const namesAtRisk: string[] = [];
    if (isContainer) {
      const draftStructure = structure;
      const section = draftStructure?.sections.get(`section-${currentRow}`);
      const end = section?.endRowIndex ?? currentRow;
      for (let r = currentRow; r <= end; r += 1) {
        const node = draftStructure?.byRow.get(r);
        if (node?.name) namesAtRisk.push(node.name);
      }
    } else if (currentNode.name) {
      namesAtRisk.push(currentNode.name);
    }
    const allRefs = namesAtRisk.flatMap((name) =>
      findVarReferences(
        workbook.survey,
        name,
        SURVEY_COLUMNS_WITH_VAR_REFS,
        // Excluir filas que se van a borrar — esas referencias se irán
        // junto con el bloque, no son "referencias rotas".
        undefined,
      ).filter((ref) => {
        if (isContainer) {
          const section = structure?.sections.get(`section-${currentRow}`);
          const end = section?.endRowIndex ?? currentRow;
          return ref.rowIndex < currentRow || ref.rowIndex > end;
        }
        return ref.rowIndex !== currentRow;
      }),
    );

    let confirmMsg: string;
    if (allRefs.length === 0) {
      confirmMsg = `¿Eliminar ${question} del formulario?`;
    } else {
      const lines = allRefs.slice(0, 6).map((ref) => {
        const refNode = structure?.byRow.get(ref.rowIndex);
        const refLabel = refNode?.name || `Fila ${ref.rowIndex + 1}`;
        return `  · ${refLabel} (${ref.column}): ${ref.snippet}`;
      });
      const overflow =
        allRefs.length > 6 ? `\n  · …y ${allRefs.length - 6} más` : "";
      confirmMsg =
        `Esta acción eliminará ${question}, pero queda referenciada en ${allRefs.length} ${allRefs.length === 1 ? "lugar" : "lugares"} del formulario:\n\n${lines.join("\n")}${overflow}\n\nSi continúas, esas referencias quedarán rotas. ¿Eliminar de todas formas?`;
    }
    if (!window.confirm(confirmMsg)) return;

    const nextRow = currentRow > 0 ? currentRow - 1 : null;
    updateWorkbook((draft) => {
      const draftStructure = parseBuilderStructure(draft.survey);
      if (currentNode.kind === "section" || currentNode.kind === "repeat") {
        const section = draftStructure.sections.get(`section-${currentRow}`);
        const end = section?.endRowIndex ?? currentRow;
        draft.survey.rows.splice(currentRow, Math.max(end - currentRow + 1, 1));
      } else {
        deleteRow(draft.survey, currentRow);
      }
    });
    if (allRefs.length > 0) {
      toasts.push({
        kind: "warn",
        title: "Eliminado con referencias rotas",
        detail: `${allRefs.length} ${allRefs.length === 1 ? "celda" : "celdas"} ahora apuntan a un nombre inexistente. Revisa los diagnostics.`,
      });
    }
    setSelection(
      nextRow != null
        ? { kind: "survey", rowIndex: nextRow }
        : { kind: "settings" },
    );
  }

  function addChoice() {
    if (!workbook || !selectedTypeInfo?.listName || !selectedNode) return;
    const listName = selectedTypeInfo.listName;
    const choiceCount = selectedChoices.length + 1;
    updateWorkbook((draft) => {
      insertRecord(draft.choices, draft.choices.rows.length, {
        list_name: listName,
        name: `opcion_${choiceCount}`,
        label: `Opción ${choiceCount}`,
      });
    });
  }

  function addCatalogChoice(listName: string) {
    if (!workbook || !listName) return;
    const current = catalogs.find((catalog) => catalog.listName === listName);
    const choiceCount = (current?.items.length ?? 0) + 1;
    updateWorkbook((draft) => {
      insertRecord(draft.choices, draft.choices.rows.length, {
        list_name: listName,
        name: `opcion_${choiceCount}`,
        label: `Opción ${choiceCount}`,
      });
    });
    setCatalogFocus(listName);
  }

  function updateChoice(rowIndex: number, field: "name" | "label", value: string) {
    updateWorkbook((draft) => {
      setCell(draft.choices, rowIndex, field, value);
    });
  }

  function updateChoiceFields(rowIndex: number, next: { label: string; name: string }) {
    updateWorkbook((draft) => {
      setCell(draft.choices, rowIndex, "label", next.label);
      setCell(draft.choices, rowIndex, "name", next.name);
    });
  }

  function removeChoice(rowIndex: number) {
    updateWorkbook((draft) => {
      deleteRow(draft.choices, rowIndex);
    });
  }

  /**
   * Reordena una opción dentro de un catálogo. `from`/`to` son rowIndex
   * globales en `choices`. Inserta la fila origen INMEDIATAMENTE ANTES
   * de la fila destino — el handler de drag-drop sigue la convención de
   * "soltar antes de" la fila bajo el cursor.
   */
  function moveChoice(_listName: string, fromRowIndex: number, toRowIndex: number) {
    if (!workbook) return;
    if (fromRowIndex === toRowIndex) return;
    updateWorkbook((draft) => {
      applyChoiceMove(draft.choices, fromRowIndex, toRowIndex, true);
    });
  }

  /**
   * Borra el catálogo completo de la hoja `choices`. Solo se invoca desde
   * la UI cuando el catálogo NO tiene preguntas que lo usen — el
   * `CatalogWorkspace` solo muestra el botón en ese caso.
   */
  function deleteCatalogAction(listName: string) {
    if (!workbook || !listName) return;
    updateWorkbook((draft) => {
      deleteCatalogFromSheet(draft.choices, listName);
    });
    if (catalogFocus === listName) setCatalogFocus(null);
    toasts.push({
      kind: "info",
      title: "Lista borrada",
      detail: `Eliminamos «${listName}» de la hoja choices.`,
    });
  }

  const settingsRecord = workbook ? rowToRecord(workbook.settings, 0) : null;

  // Scope de lógica que el workspace pasa al LogicBuilder. Variables son
  // todas las preguntas del outline excepto la actual (no tiene sentido
  // que una pregunta dependa de sí misma), y excepto secciones/repeats
  // (esos no producen valores comparables). Los catálogos se indexan por
  // listName para lookup O(1) en el ValueInput.
  const logicScope = useMemo<LogicScope>(() => {
    const variables: LogicVariable[] = (structure?.outline ?? [])
      .filter(
        (entry) =>
          entry.name &&
          selectedNode?.rowIndex !== entry.rowIndex &&
          entry.kind !== "section" &&
          entry.kind !== "repeat",
      )
      .map((entry) => ({
        rowIndex: entry.rowIndex,
        name: entry.name,
        label: entry.label,
        baseType: entry.typeInfo.base,
        listName: entry.typeInfo.listName || undefined,
      }));
    const catalogsByListName = new Map<string, LogicCatalog>();
    for (const catalog of catalogs) {
      catalogsByListName.set(catalog.listName, {
        listName: catalog.listName,
        items: catalog.items,
      });
    }
    return { variables, catalogsByListName, allowCurrent: false };
  }, [selectedNode?.rowIndex, structure, catalogs]);
  // Helper local — construye el icono del menú "+" reusando el mismo
  // mapping (iconForType + paletteForType) que el outline. Así el usuario
  // ve idéntico el "tipo" cuando lo agrega y cuando lo navega después.
  const addMenuIcon = (baseType: string) => {
    const Ico = iconForType(baseType);
    const accent = paletteForType(baseType);
    return <Ico size={16} color={accent} />;
  };

  const addMenuItems: AddMenuItem[] = [
    {
      key: "text",
      label: "Pregunta abierta",
      hint: "Texto libre para respuestas cortas o comentarios.",
      icon: addMenuIcon("text"),
      action: () => addQuestion("text"),
      group: "capture",
    },
    {
      key: "integer",
      label: "Número entero",
      hint: "Edades, cantidades o puntajes sin decimales.",
      icon: addMenuIcon("integer"),
      action: () => addQuestion("integer"),
      group: "capture",
    },
    {
      key: "decimal",
      label: "Número decimal",
      hint: "Montos, proporciones o medidas con decimales.",
      icon: addMenuIcon("decimal"),
      action: () => addQuestion("decimal"),
      group: "capture",
    },
    {
      key: "date",
      label: "Fecha",
      hint: "Fechas de visita, nacimiento o eventos.",
      icon: addMenuIcon("date"),
      action: () => addQuestion("date"),
      group: "capture",
    },
    {
      key: "select_one",
      label: "Selección única",
      hint: "Una sola respuesta; deja una lista preparada para opciones reales.",
      icon: addMenuIcon("select_one"),
      action: () => addQuestion("select_one"),
      group: "choices",
    },
    {
      key: "select_multiple",
      label: "Selección múltiple",
      hint: "Varias respuestas; crea una lista Kobo reutilizable.",
      icon: addMenuIcon("select_multiple"),
      action: () => addQuestion("select_multiple"),
      group: "choices",
    },
    {
      key: "image",
      label: "Foto o imagen",
      hint: "Evidencia visual desde cámara o archivo.",
      icon: addMenuIcon("image"),
      action: () => addQuestion("image"),
      group: "evidence",
    },
    {
      key: "audio",
      label: "Audio",
      hint: "Grabación de voz o sonido.",
      icon: addMenuIcon("audio"),
      action: () => addQuestion("audio"),
      group: "evidence",
    },
    {
      key: "video",
      label: "Video",
      hint: "Registro audiovisual corto.",
      icon: addMenuIcon("video"),
      action: () => addQuestion("video"),
      group: "evidence",
    },
    {
      key: "file",
      label: "Archivo",
      hint: "Documento u otro adjunto.",
      icon: addMenuIcon("file"),
      action: () => addQuestion("file"),
      group: "evidence",
    },
    {
      key: "barcode",
      label: "Código de barras",
      hint: "Lectura de código o QR.",
      icon: addMenuIcon("barcode"),
      action: () => addQuestion("barcode"),
      group: "evidence",
    },
    {
      key: "geopoint",
      label: "Punto GPS",
      hint: "Ubicación puntual.",
      icon: addMenuIcon("geopoint"),
      action: () => addQuestion("geopoint"),
      group: "evidence",
    },
    {
      key: "note",
      label: "Nota informativa",
      hint: "Instrucciones, avisos o separadores sin guardar respuesta.",
      icon: addMenuIcon("note"),
      action: () => addQuestion("note"),
      group: "logic",
    },
    {
      key: "calculate",
      label: "Cálculo",
      hint: "Variable automática basada en respuestas.",
      icon: addMenuIcon("calculate"),
      action: () => addQuestion("calculate"),
      group: "logic",
    },
    {
      key: "section",
      label: "Sección",
      hint: "Crea un grupo con su inicio y su cierre. El cierre lo puedes mover o borrar.",
      icon: addMenuIcon("begin_group"),
      action: addSection,
      group: "logic",
    },
    {
      key: "section_end",
      label: "Cerrar sección",
      hint: "Inserta solo un cierre suelto, por si necesitas terminar un grupo en otro punto.",
      icon: addMenuIcon("end_group"),
      action: addSectionClose,
      group: "logic",
    },
  ];

  return (
    <PageFrame
      title="Editor de formularios"
      lead="Constructor visual, hojas técnicas y exportación XLSForm en un mismo workbench."
      className="pulso-xlsform-frame"
      headerMode="sr-only"
      resetScrollKey={`${workbook ? "workbook" : "empty"}:${editorMode}`}
      toolbar={workbook ? (
        <div className="pulso-xlsform-commandbar" aria-label="Comandos del formulario activo">
          <div className="pulso-xlsform-commandbar-group pulso-xlsform-commandbar-group--document">
            <div className="pulso-xlsform-document-strip" aria-label="Resumen del formulario">
              <FormSwitcher
                forms={forms}
                activeFormId={activeFormId}
                activeName={activeFormName}
                canCreate={canCreateForm}
                onSwitch={(id) => { void switchToForm(id); }}
                onNew={onNewWorkbook}
                onViewAll={onBackToHub}
              />
              <span className="pulso-xlsform-document-divider" aria-hidden="true" />
              <DocumentMetric value={structure?.outline.length ?? 0} label="piezas" />
              <DocumentMetric
                value={catalogs.length}
                label={catalogs.length === readyCatalogsCount ? "listas" : "listas preparadas"}
              />
              <DocumentMetric
                value={diagnostics.filter((diagnostic) => diagnostic.level === "warn").length}
                label="avisos"
                tone={diagnostics.some((diagnostic) => diagnostic.level === "warn") ? "warn" : "success"}
              />
            </div>
            <div className="pulso-xlsform-state-strip" aria-label="Estado del formulario">
              <StatusChip label={formatSource(source?.kind ?? null)} tone="info" />
              <StatusChip
                label={formatSaveStatus(dirty, lastSavedAt)}
                tone={dirty ? "warn" : lastSavedAt != null ? "info" : "success"}
              />
              {(canUndo || canRedo) && (
                <div className="pulso-xlsform-history-controls">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "UNDO" })}
                    disabled={!canUndo}
                    title="Deshacer (Cmd/Ctrl+Z)"
                    className="pulso-xlsform-history-button"
                    aria-label="Deshacer último cambio"
                  >
                    <span className="pulso-xlsform-history-icon" aria-hidden="true">
                      <IconUndo size={13} strokeWidth={2.2} />
                    </span>
                    <span>Deshacer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "REDO" })}
                    disabled={!canRedo}
                    title="Rehacer (Shift+Cmd/Ctrl+Z)"
                    className="pulso-xlsform-history-button"
                    aria-label="Rehacer cambio deshecho"
                  >
                    <span className="pulso-xlsform-history-icon" aria-hidden="true">
                      <IconRedo size={13} strokeWidth={2.2} />
                    </span>
                    <span>Rehacer</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="pulso-xlsform-commandbar-group pulso-xlsform-commandbar-group--modes">
            <div
              className="pulso-mode-toggle"
              role="radiogroup"
              aria-label="Modo de edición"
            >
              <button
                type="button"
                role="radio"
                aria-checked={editorMode === "builder"}
                className={editorMode === "builder" ? "is-on" : ""}
                onClick={() => setEditorMode("builder")}
                title="Editor visual guiado"
              >
                Constructor
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={editorMode === "sheets"}
                className={editorMode === "sheets" ? "is-on" : ""}
                onClick={() => setEditorMode("sheets")}
                title="Vista por hojas — edición de celdas crudas"
              >
                Hojas
              </button>
            </div>
            <MoreViewsMenu
              catalogsCount={catalogs.length}
              onOpenLogicCanvas={() => setLogicCanvasOpen(true)}
              onOpenChoiceFilters={() => setChoiceFiltersOpen(true)}
              onOpenSurveyMonkeyLogic={() => setSmLogicDialogOpen(true)}
              onOpenQuestionnaireView={() => setQuestionnaireViewOpen(true)}
              onOpenCatalogsLens={() => setCatalogsLensOpen(true)}
              onOpenSimulator={() => setSimulatorOpen(true)}
              onOpenSummary={() => setSummaryViewOpen(true)}
            />
            <DiagnosticsBadge
              diagnostics={diagnostics}
              selection={selection}
              onSelectRow={(rowIndex) => setSelection({ kind: "survey", rowIndex })}
              onFocusCatalog={(name) => {
                setCatalogFocus(name);
                setCatalogsLensOpen(true);
              }}
            />
          </div>

          <div className="pulso-xlsform-commandbar-group pulso-xlsform-commandbar-group--actions">
            <button
              type="button"
              onClick={onNewWorkbook}
              className="pulso-xlsform-toolbar-button"
              disabled={!canCreateForm}
              title={canCreateForm ? "Crear un formulario nuevo" : `Límite de ${MAX_FORMS} formularios por proyecto`}
            >
              <IconNew size={14} /> Nuevo formulario
            </button>
            <button
              type="button"
              onClick={() => xlsInputRef.current?.click()}
              className="pulso-xlsform-toolbar-button"
              disabled={!canCreateForm}
              title={canCreateForm ? "Importar un XLSForm" : `Límite de ${MAX_FORMS} formularios por proyecto`}
            >
              <Upload size={14} /> Importar
            </button>
            <button
              type="button"
              onClick={onImportSurveyMonkey}
              className="pulso-xlsform-toolbar-button"
              disabled={!canCreateForm}
              title={canCreateForm ? "Traducir una encuesta de SurveyMonkey" : `Límite de ${MAX_FORMS} formularios por proyecto`}
            >
              <Cloud size={14} /> SurveyMonkey
            </button>
            <label
              className="pulso-xlsform-toolbar-check"
              title="Incluye las columnas paper_* y las hojas de la plataforma (mapeo a PDF/Word). Desmárcalo para un XLSForm ODK/Kobo limpio."
            >
              <input
                type="checkbox"
                checked={includeAppColumns}
                onChange={(e) => setIncludeAppColumns(e.target.checked)}
                disabled={!!busy}
              />
              Columnas de plataforma
            </label>
            <button type="button" className="pulso-primary pulso-xlsform-toolbar-button" onClick={onExport} disabled={!!busy}>
              <Download size={14} /> Exportar .xlsx
            </button>
            <button
              type="button"
              className="pulso-xlsform-toolbar-button"
              onClick={() => setPdfDialogOpen(true)}
              disabled={!!busy}
              title="Configurar y exportar el cuestionario impreso (PDF o Word)"
            >
              <FileText size={14} /> Documento
            </button>
          </div>
        </div>
      ) : undefined}
    >
      {/*
        El frame mantiene el header del editor fijo dentro del viewport.
        Las zonas pesadas (outline, canvas, inspector, hojas y overlays)
        siguen controlando su propio scroll interno.
      */}
      {error && <ErrorBlock label="No pudimos abrir el editor" detail={error} />}

      {/* Input file oculto para "Importar XLSForm" — disponible siempre,
          tanto desde el EmptyHome como desde la barra de acciones del
          editor con workbook. */}
      <input
        ref={xlsInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: "none" }}
        onChange={(e) => void onImportXls(e.target.files?.[0])}
      />

      {/* Sin workbook → solo EmptyHome con sus 3 cards (Empezar de cero
          / Importar XLSForm / Traducir SurveyMonkey) y resumeBanner.
          Antes había un Panel "Entradas y salidas" arriba con los mismos
          4 botones — duplicaba acciones y confundía al usuario. */}
      {!workbook && (
        <FormsLibrary
          forms={forms}
          activeFormId={getActiveForm(projectScope)}
          scope={projectScope}
          onOpen={(id) => { void switchToForm(id); }}
          onDelete={onDeleteForm}
          onRename={onRenameForm}
          publications={publicationUi.byFormId}
          publishingFormId={publicationUi.publishingFormId}
          confirmingLogicFormId={publicationUi.confirmingLogicFormId}
          publicationErrors={publicationUi.errorsByFormId}
          onPublish={(id) => { void onPublishForm(id); }}
          onConfirmLogic={(id) => { void onConfirmFormLogic(id); }}
          onNewBlank={onNewWorkbook}
          onImportXls={() => {
            if (blockUntilRestoreDecision("importar otro XLSForm")) return;
            xlsInputRef.current?.click();
          }}
          onImportSurveyMonkey={onImportSurveyMonkey}
          resumeBanner={
            restoreOffer ? (
              <RestoreOfferBanner
                snapshot={restoreOffer}
                onAccept={acceptRestoreOffer}
                onDismiss={dismissRestoreOffer}
              />
            ) : null
          }
        />
      )}

      {busy && (
        <Panel title="Procesando" hint={busy}>
          <LoadingBlock label={busy} variant="inline" minHeight={88} />
        </Panel>
      )}

      {workbook && artifact && (
        <Panel
          title="Export listo"
          hint={project.status.has_project
            ? "El archivo quedó en sesión y puedes guardarlo en el proyecto."
            : "El archivo quedó listo para descargar en esta sesión."}
          actions={(
            <SaveEntregableButton
              fileId={artifact.file_id}
              defaultName={artifact.original_name.replace(/\.(xlsx|pdf|docx)$/i, "")}
              extension={artifact.extension}
              label={`Descargar .${artifact.extension}`}
              icon={artifact.extension === "pdf" ? <FileText size={14} /> : <Download size={14} />}
              className="pulso-primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 6,
                fontSize: 13,
                border: "1px solid var(--pulso-primary)",
              }}
            />
          )}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--pulso-text-soft)", fontSize: 13 }}>
            <FileSpreadsheet size={16} />
            <span>{artifact.original_name}</span>
          </div>
        </Panel>
      )}

      {/* `EmptyHome` arriba ya cubre el caso "sin workbook" con CTAs grandes
          y el resumeBanner. Antes había un `EmptyState` duplicado aquí
          que repetía las mismas 3 acciones — eliminado para no doblar el
          mensaje. */}

      {workbook && (
        <>
          {/* Antes acá iba `BuilderToolsDeck` con catálogos + diagnostics +
              índice en una grilla de 3 columnas que competía por ancho con
              el constructor. En el revamp Sub-PR 4b:
                - Catálogos → botón "Catálogos" en este header → ContextLens.
                - Diagnostics → ícono colapsable (DiagnosticsBadge) en este
                  header → popover floating al click.
                - Índice → CollapsibleSection abajo, no en columna lateral. */}

          <Panel
            className="pulso-xlsform-workbench-panel"
            noPadding
          >
            {editorMode === "sheets" && workbook && (
              <SheetsView
                workbook={workbook}
                onUpdateCell={sheetsUpdateCell}
                onAddRow={sheetsAddRow}
                onDeleteRow={sheetsDeleteRow}
                onMoveRow={sheetsMoveRow}
                onAddColumn={sheetsAddColumn}
              />
            )}
            {editorMode === "builder" && (
              <div className="pulso-builder-grid">
                <div className="pulso-xlsform-workbench-column pulso-xlsform-workbench-column--outline">
                  <Panel
                    className="pulso-xlsform-sidebar-panel"
                    noPadding
                  >
                    <div className="pulso-xlsform-outline-chrome">
                      <div>
                        <span className="pulso-section-eyebrow">Outline maestro</span>
                        <strong>Estructura</strong>
                        <small>{suiteMetrics.questions} preguntas · {suiteMetrics.sections} secciones</small>
                      </div>
                      <div className="pulso-xlsform-outline-actions" style={{ position: "relative" }}>
                        <button
                          ref={addMenuButtonRef}
                          type="button"
                          className="pulso-icon"
                          onClick={() => setShowAddMenu((value) => !value)}
                          title="Añadir pieza (Cmd/Ctrl+N)"
                        >
                          <Plus size={14} />
                        </button>
                        {showAddMenu && (
                          <AddElementMenu
                            items={addMenuItems}
                            anchorElement={addMenuButtonRef.current}
                            onClose={() => setShowAddMenu(false)}
                          />
                        )}
                      </div>
                    </div>
                    <SurveyOutline
                      structure={structure}
                      selection={selection}
                      onSelect={selectBuilderFocus}
                      onMoveUp={() => moveSelection("up")}
                      onMoveDown={() => moveSelection("down")}
                      canMoveUp={!!movement.prevRow}
                      canMoveDown={!!movement.nextRow}
                      onApplyMove={applyOutlineMove}
                    />
                  </Panel>
                </div>

                <div className="pulso-xlsform-workbench-column pulso-xlsform-workbench-column--workspace">
                  <FocusedWorkspace
                    mode={builderWorkspaceMode}
                    onModeChange={setBuilderWorkspaceMode}
                    workbook={workbook}
                    structure={structure}
                    selection={selection}
                    node={selectedNode}
                    section={selectedSection}
                    settingsRecord={settingsRecord}
                    selectedChoices={selectedChoices}
                    selectedPosition={
                      structure && selectedNode
                        ? computeQuestionPosition(structure, selectedNode.rowIndex)
                        : undefined
                    }
                    catalogUsageCount={
                      selectedTypeInfo?.listName
                        ? catalogUsage.get(selectedTypeInfo.listName) ?? 1
                        : 1
                    }
                    catalogInfo={selectedCatalogInfo}
                    conditionalContext={conditionalContext}
                    catalogs={catalogs}
                    logicScope={logicScope}
                    sectionBoundary={sectionBoundary}
                    canMoveUp={!!movement.prevRow}
                    canMoveDown={!!movement.nextRow}
                    onMoveUp={() => moveSelection("up")}
                    onMoveDown={() => moveSelection("down")}
                    onDelete={deleteCurrentSelection}
                    onSettingsChange={updateSettingsField}
                    onFieldChange={(field, value) => {
                      if (!selectedNode) return;
                      updateSurveyField(selectedNode.rowIndex, field, value);
                    }}
                    onFieldsChange={(updates) => {
                      if (!selectedNode) return;
                      updateSurveyFields(selectedNode.rowIndex, updates);
                    }}
                    onTypeChange={(value) => {
                      if (!selectedNode) return;
                      updateQuestionType(selectedNode.rowIndex, value);
                    }}
                    onRequiredChange={(checked) => {
                      if (!selectedNode) return;
                      toggleRequired(selectedNode.rowIndex, checked);
                    }}
                    onCatalogAssign={(listName) => {
                      if (!selectedNode) return;
                      assignCatalogToQuestion(selectedNode.rowIndex, listName);
                    }}
                    onCatalogCreate={() => createCatalog(true)}
                    onOpenCatalogLens={(focusListName) => {
                      if (focusListName) setCatalogFocus(focusListName);
                      setCatalogsLensOpen(true);
                    }}
                    onCloneCatalog={
                      selectedNode
                        ? () => cloneCatalogForQuestion(selectedNode.rowIndex)
                        : undefined
                    }
                    onIncludeNextInSection={includeNextInSelectedSection}
                    onReleaseLastFromSection={releaseLastFromSelectedSection}
                    onSelectRow={(rowIndex) => selectBuilderFocus({ kind: "survey", rowIndex })}
                    formCanvasProps={{
                      catalogUsage,
                      questionsByCatalog,
                      onSelect: (rowIndex) => selectBuilderFocus({ kind: "survey", rowIndex }),
                      onLabelChange: (rowIndex, value) => updateSurveyField(rowIndex, "label", value),
                      onHintChange: (rowIndex, value) => updateSurveyField(rowIndex, "hint", value),
                      onSectionLabelChange: (rowIndex, value) => updateSurveyField(rowIndex, "label", value),
                      onChoiceLabelChange: (_listName, choiceRow, value) => updateChoice(choiceRow, "label", value),
                      onChoiceNameChange: (_listName, choiceRow, value) => updateChoice(choiceRow, "name", value),
                      onAddChoice: (listName) => addCatalogChoice(listName),
                      onRemoveChoice: (_listName, choiceRow) => removeChoice(choiceRow),
                      onRenameList: (oldListName, nextListName) => renameCatalog(oldListName, nextListName),
                      onCloneCatalog: (questionRowIndex) => cloneCatalogForQuestion(questionRowIndex),
                      onAddAfter: (rowIndex, kind, reuseListName) => {
                        handleAddAfter(rowIndex, kind, reuseListName);
                        setBuilderWorkspaceMode("focus");
                      },
                      existingLists: existingListsForAdd,
                      onOpenCatalogLens: (listName) => {
                        if (listName) setCatalogFocus(listName);
                        setCatalogsLensOpen(true);
                      },
                    }}
                  />

                  {artifact && (
                    <Panel
                      title="Último export"
                      hint="Tu versión descargable queda disponible dentro de la sesión."
                      actions={(
                        <SaveEntregableButton
                          fileId={artifact.file_id}
                          defaultName={artifact.original_name.replace(/\.(xlsx|pdf|docx)$/i, "")}
                          extension={artifact.extension}
                          label="Descargar export"
                          icon={artifact.extension === "pdf" ? <FileText size={14} /> : <Download size={14} />}
                          className="pulso-primary"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 12px",
                            borderRadius: 6,
                            fontSize: 13,
                            border: "1px solid var(--pulso-primary)",
                          }}
                        />
                      )}
                    >
                      <span style={{ fontSize: 13, color: "var(--pulso-text-soft)" }}>
                        {artifact.original_name}
                      </span>
                    </Panel>
                  )}
                </div>
              </div>
            )}
          </Panel>

          {/* "Índice del instrumento" eliminado — la información que ofrece
              (variables, dependencias, referencias faltantes) ya está
              disponible en el Mapa de lógica y los avisos. */}
        </>
      )}

      {/* Coachmarks de primer uso — solo aparecen cuando hay workbook con
          contenido editable y el flag `firstUseDone` no está seteado. */}
      {workbook && hasEditableContent && <Coachmarks />}

      {/* ContextLens del editor de catálogos — se abre desde el header del
          constructor o cuando un diagnostic apunta a un catálogo. */}
      <CatalogsContextLens
        open={catalogsLensOpen}
        onClose={() => setCatalogsLensOpen(false)}
        listsCount={catalogs.length}
        readyListsCount={readyCatalogsCount}
        onCreate={() => createCatalog(false)}
        library={(
          <CatalogLibraryV2
            catalogs={catalogs}
            activeCatalogName={activeCatalogName}
            usageByCatalog={usageByCatalog}
            onFocus={setCatalogFocus}
            onCreate={() => createCatalog(false)}
          />
        )}
        workspace={(
          <CatalogWorkspaceV2
            catalog={activeCatalog}
            usageCount={activeCatalogUsage}
            onRename={renameCatalog}
            onAddChoice={addCatalogChoice}
            onChoiceChange={updateChoiceFields}
            onChoiceRemove={removeChoice}
            onChoiceMove={moveChoice}
            onDeleteCatalog={deleteCatalogAction}
          />
        )}
      />

      {/* Mapa de lógica — overlay full-screen estilo Obsidian. Se monta
          siempre (no se desmonta al cerrar) para preservar zoom/pan entre
          aperturas. La condición open={logicCanvasOpen} lo oculta. */}
	      <LogicCanvas
	        open={logicCanvasOpen}
        onClose={() => setLogicCanvasOpen(false)}
        structure={structure}
        catalogs={catalogs}
        onSelectRow={(rowIndex) => setSelection({ kind: "survey", rowIndex })}
        onSetRelevant={(rowIndex, expression) => {
          // El canvas declara/edita/elimina relaciones de visibilidad
          // (relevant). Una expresión vacía ELIMINA la condición (el
          // elemento pasa a mostrarse siempre); una no vacía la crea/edita.
          updateSurveyField(rowIndex, "relevant", expression);
          const cleared = expression.trim() === "";
          toasts.push({
            kind: "success",
            title: cleared ? "Relación eliminada" : "Conexión creada",
            detail: cleared
              ? "Se quitó la condición de visibilidad; el elemento se mostrará siempre."
              : "Se condicionó la visibilidad. Refínala en el inspector si quieres precisar el valor.",
          });
	        }}
	      />

	      {/* Filtros de opciones — overlay hermano del mapa de lógica.
	          Solo lectura: explica qué respuesta previa habilita qué opción,
	          en lenguaje humano. Lee las filas CRUDAS de la hoja choices
	          (con las columnas filter_*) directamente del workbook. */}
	      <ChoiceFiltersView
	        open={choiceFiltersOpen}
	        onClose={() => setChoiceFiltersOpen(false)}
	        structure={structure}
	        choicesColumns={workbook?.choices.columns ?? []}
	        choicesRows={workbook?.choices.rows ?? []}
	        onSelectRow={(rowIndex) => setSelection({ kind: "survey", rowIndex })}
	      />

	      {smLogicDialogOpen && workbook ? (
	        <SurveyMonkeyLogicPopup
	          workbook={workbook}
	          sourceName={source?.original_name ?? null}
	          rules={smLogicRules}
	          visualRules={smVisualLogicRules}
	          existingKoboLogic={extractExistingKoboLogic(workbook)}
	          overrides={smLogicChoiceOverrides}
	          busy={Boolean(busy)}
	          onLogicDraftChange={updateSurveyMonkeyLogicDraft}
	          onRulesChange={(nextRules) => updateSurveyMonkeyLogicDraft(nextRules)}
	          onVisualRulesChange={updateSurveyMonkeyVisualRulesDraft}
	          onOverridesChange={updateSurveyMonkeyOverridesDraft}
	          onClose={() => setSmLogicDialogOpen(false)}
	          onApply={applySurveyMonkeyLogicFromEditor}
	        />
	      ) : null}

	      {questionnaireViewOpen ? createPortal((
        <div
          className="pulso-graph-overlay pulso-questionnaire-overlay pulso-xf-overlay-enter"
          role="dialog"
          aria-label="Vista del cuestionario"
        >
          <header className="pulso-graph-header">
            <div className="pulso-graph-header-left">
              <button
                type="button"
                className="pulso-graph-back"
                onClick={() => setQuestionnaireViewOpen(false)}
              >
                <ChevronLeft size={14} /> Volver al editor
              </button>
              <div className="pulso-graph-header-title">
                <strong>Vista del cuestionario</strong>
                <span>
                  {suiteMetrics.questions} pregunta{suiteMetrics.questions === 1 ? "" : "s"}
                  {" · "}
                  {suiteMetrics.sections} secci{suiteMetrics.sections === 1 ? "ón" : "ones"}
                  {" · "}
                  {suiteMetrics.logicRules} regla{suiteMetrics.logicRules === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            <div className="pulso-graph-header-right">
              <div className="pulso-questionnaire-header-stats" aria-label="Resumen del formulario">
                <span>{suiteMetrics.required} obligatoria{suiteMetrics.required === 1 ? "" : "s"}</span>
                <span>{suiteMetrics.catalogs} catálogo{suiteMetrics.catalogs === 1 ? "" : "s"}</span>
              </div>
              <button
                type="button"
                className="pulso-icon"
                onClick={() => setQuestionnaireViewOpen(false)}
                aria-label="Cerrar vista del cuestionario"
                title="Cerrar"
              >
                <X size={14} />
              </button>
            </div>
          </header>
          <main className="pulso-questionnaire-shell">
            <QuestionnaireProgressPanel
              structure={structure}
              selection={selection}
              onSelect={(next) => {
                setSelection(next);
                setQuestionnaireViewOpen(false);
              }}
            />
          </main>
        </div>
      ), document.body) : null}

      {/* Simulador de llenado — overlay full-screen; evalúa relevant en vivo
          contra las respuestas del usuario. */}
      {workbook && (
        <FormSimulator
          open={simulatorOpen}
          onClose={() => setSimulatorOpen(false)}
          workbook={workbook}
          structure={structure}
          onEditRow={(rowIndex) => {
            setSelection({ kind: "survey", rowIndex });
            setSimulatorOpen(false);
          }}
        />
      )}

      {/* Resumen ejecutivo del formulario — KPIs, distribución por tipo,
          mapa de secciones y salud. */}
      {workbook && (
        <FormSummaryView
          open={summaryViewOpen}
          onClose={() => setSummaryViewOpen(false)}
          workbook={workbook}
          structure={structure}
          diagnostics={diagnostics}
          onSelectRow={(rowIndex) => {
            setSelection({ kind: "survey", rowIndex });
            setSummaryViewOpen(false);
          }}
        />
      )}

      {/* Toasts deslizables: mensajes efímeros de operaciones (import/export).
          El deck se monta una sola vez y se mantiene a nivel del editor —
          fuera del flujo Panel para que los toasts queden anclados a la
          esquina inferior-derecha sin romper el layout. */}
      <ToastDeck items={toasts.items} onDismiss={toasts.dismiss} />

      {/* Diálogo de importación SurveyMonkey vía API. */}
      {smImportDialog ? (
        <ImportSurveyMonkeyDialog
          fileId={smImportDialog.fileId}
          fileName={smImportDialog.fileName}
          onCancel={() => setSmImportDialog(null)}
          onComplete={onSurveyMonkeyImportComplete}
        />
      ) : null}

      {/* Diálogo del importador de Matriz PULSO IAC-CINDA (por audiencia). */}
      {matrizPulsoDialog ? (
        <MatrizPulsoDialog
          fileName={matrizPulsoDialog.fileName}
          audiences={matrizPulsoDialog.audiences}
          existingCount={forms.length}
          maxForms={MAX_FORMS}
          submitting={matrizPulsoSubmitting}
          onCancel={() => {
            if (matrizPulsoSubmitting) return;
            setMatrizPulsoDialog(null);
          }}
          onConfirm={onMatrizPulsoConfirm}
        />
      ) : null}

      {/* Diálogo "Configurar PDF": Formato / Lógica / Matrices. Se mantiene
          montado (aunque cerrado) para conservar las elecciones del usuario
          entre aperturas DEL MISMO formulario. El `key` por formulario activo
          lo remonta al cambiar de formulario, descartando estado form-específico
          (ids de matriz row-based, tenor, columna especial, cabecera, variable
          de consentimiento) que no aplica al nuevo workbook. */}
      <ConfigurarPdfDialog
        key={activeFormId ?? "no-form"}
        open={pdfDialogOpen}
        onClose={() => setPdfDialogOpen(false)}
        onExport={(format, columns, logicLanguage, showQuestionnaireNumber, matrixGroups, matrixLayout, consentVar) => {
          void onExportForm(
            format,
            columns,
            logicLanguage,
            showQuestionnaireNumber,
            matrixGroups,
            matrixLayout,
            consentVar,
          );
        }}
        matrixCandidates={matrixCandidates}
        consentQuestions={consentQuestions}
        fileName={activeFormName}
        busy={!!busy}
      />

      {/* Panel de hallazgos del validador empírico — drawer flotante a la
          derecha. Aparece tras un import-with-logic con resultados. Click en
          un hallazgo navega al inspector de la pregunta target. */}
      {hallazgos.length > 0 && workbook ? (
        <HallazgosPanel
          hallazgos={hallazgos}
          onSelectTarget={(target) => {
            const surveyRows = workbook.survey?.rows ?? [];
            const surveyColumns = workbook.survey?.columns ?? [];
            const nameIdx = surveyColumns.findIndex((c) => c.toLowerCase() === "name");
            if (nameIdx < 0) return;
            const rowIndex = surveyRows.findIndex((row) => (row[nameIdx] ?? "") === target);
            if (rowIndex >= 0) setSelection({ kind: "survey", rowIndex });
          }}
          onClose={() => setHallazgos([])}
        />
      ) : null}
    </PageFrame>
  );
}

function AddElementMenu({
  items,
  anchorElement,
  onClose,
}: {
  items: AddMenuItem[];
  anchorElement: HTMLElement | null;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<"all" | NonNullable<AddMenuItem["group"]>>("all");
  const groups = [
    { id: "choices", label: "Opciones Kobo" },
    { id: "capture", label: "Texto y captura" },
    { id: "evidence", label: "Evidencia y ubicación" },
    { id: "logic", label: "Estructura y lógica" },
  ] as const;
  const normalizedQuery = normalizeAddMenuSearch(query);
  const visibleItems = items.filter((item) => {
    const groupMatches = activeGroup === "all" || item.group === activeGroup;
    if (!groupMatches) return false;
    if (!normalizedQuery) return true;
    const descriptor = describeAddMenuItem(item);
    return normalizeAddMenuSearch([
      item.label,
      item.hint,
      descriptor.tag,
      descriptor.detail,
      ...descriptor.searchTerms,
    ].join(" ")).includes(normalizedQuery);
  });

  useLayoutEffect(() => {
    menuRef.current?.querySelector<HTMLInputElement>(".pulso-add-element-menu-search")?.focus();
  }, []);

  useEffect(() => {
    const menuButtons = () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>(".pulso-add-element-menu-item") ?? []);
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        anchorElement?.focus();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Enter") return;
      const buttons = menuButtons();
      if (!buttons.length) return;
      const activeIndex = buttons.findIndex((button) => button === document.activeElement);
      if (event.key === "Enter" && activeIndex < 0) {
        if (!normalizedQuery) return;
        event.preventDefault();
        buttons[0]?.click();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const fallbackIndex = event.key === "ArrowDown" ? -1 : 0;
      const index = activeIndex >= 0 ? activeIndex : fallbackIndex;
      const nextIndex = event.key === "ArrowDown"
        ? (index + 1) % buttons.length
        : (index - 1 + buttons.length) % buttons.length;
      buttons[nextIndex]?.focus();
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      if (anchorElement?.contains(target)) return;
      onClose();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [anchorElement, normalizedQuery, onClose]);

  const viewportWidth = typeof window === "undefined" ? 1280 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const menuWidth = Math.min(980, viewportWidth - 36);
  const menuHeight = Math.min(820, viewportHeight - 72);
  const style = {
    "--pulso-add-menu-width": `${menuWidth}px`,
    "--pulso-add-menu-height": `${menuHeight}px`,
  } as CSSProperties;

  return createPortal((
    <>
    <button
      type="button"
      className="pulso-add-element-menu-scrim"
      aria-label="Cerrar selector de piezas"
      onClick={() => {
        onClose();
        anchorElement?.focus();
      }}
    />
    <div
      ref={menuRef}
      className="pulso-add-element-menu"
      style={style}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pulso-add-element-menu-title"
    >
      <div className="pulso-add-element-menu-head">
        <span className="pulso-add-element-menu-mark" aria-hidden="true">
          <ListChecks size={14} />
        </span>
        <span className="pulso-add-element-menu-head-copy">
          <strong id="pulso-add-element-menu-title">Añadir pieza al formulario</strong>
          <small>Busca por tipo, evidencia, lógica o lista; Enter aplica la opción enfocada.</small>
        </span>
        <button
          type="button"
          className="pulso-add-element-menu-close"
          onClick={() => {
            onClose();
            anchorElement?.focus();
          }}
          aria-label="Cerrar selector de piezas"
          title="Cerrar"
        >
          <X size={15} />
        </button>
      </div>
      <div className="pulso-add-element-menu-guidance" aria-label="Guía rápida">
        <span><strong>Kobo limpio</strong> las selecciones dejan una lista preparada, sin opciones falsas.</span>
        <span><strong>Secciones</strong> tienen inicio y cierre como piezas separadas; abre donde empieza y cierra donde termina.</span>
        <span><strong>Atajo</strong> Cmd/Ctrl+N abre este selector sin crear campos por defecto.</span>
      </div>
      <div className="pulso-add-element-menu-tools">
        <label className="pulso-add-element-menu-searchbox">
          <IconSearch size={14} aria-hidden="true" />
          <input
            className="pulso-add-element-menu-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Buscar: selección, GPS, cálculo, sección..."
            aria-label="Buscar tipo de pieza"
          />
        </label>
        <div className="pulso-add-element-menu-filters" aria-label="Filtrar familias de piezas">
          <button
            type="button"
            className={activeGroup === "all" ? "is-active" : ""}
            onClick={() => setActiveGroup("all")}
          >
            Todo <span>{items.length}</span>
          </button>
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              className={activeGroup === group.id ? "is-active" : ""}
              onClick={() => setActiveGroup(group.id)}
            >
              {group.label} <span>{items.filter((item) => item.group === group.id).length}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="pulso-add-element-menu-body">
        {groups.map((group) => {
          const groupItems = visibleItems.filter((item) => item.group === group.id);
          if (!groupItems.length) return null;
          return (
            <div key={group.id} className={`pulso-add-element-menu-group${group.id === "choices" ? " is-primary" : ""}`}>
              <span className="pulso-add-element-menu-group-title">{group.label}</span>
              <div className="pulso-add-element-menu-group-grid">
                {groupItems.map((item) => {
                  const descriptor = describeAddMenuItem(item);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        item.action();
                        onClose();
                      }}
                      className={`pulso-add-element-menu-item is-${descriptor.tone}`}
                      aria-describedby={`pulso-add-menu-${item.key}-detail`}
                    >
                      <span className="pulso-add-element-menu-icon">
                        {item.icon}
                      </span>
                      <span className="pulso-add-element-menu-copy">
                        <span className="pulso-add-element-menu-item-topline">
                          <strong>{item.label}</strong>
                          <span className="pulso-add-element-menu-chip">{descriptor.tag}</span>
                        </span>
                        <span>{item.hint}</span>
                        <small id={`pulso-add-menu-${item.key}-detail`}>{descriptor.detail}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {!visibleItems.length && (
          <div className="pulso-add-element-menu-empty">
            <IconSearch size={17} aria-hidden="true" />
            <strong>Sin piezas con ese filtro</strong>
            <span>Prueba con “selección”, “GPS”, “archivo”, “cálculo” o limpia la búsqueda.</span>
          </div>
        )}
      </div>
      <div className="pulso-add-element-menu-footer" aria-label="Atajos del selector">
        <span>Flechas navegan</span>
        <span>Enter añade la opción enfocada</span>
        <span>Esc cierra</span>
      </div>
    </div>
    </>
  ), document.body);
}

function normalizeAddMenuSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function describeAddMenuItem(item: AddMenuItem): {
  tag: string;
  detail: string;
  tone: "choice" | "capture" | "evidence" | "logic";
  searchTerms: string[];
} {
  switch (item.key) {
    case "select_one":
      return {
        tag: "Catálogo Kobo",
        detail: "No agrega opciones falsas; abre con una lista vacía para completar después.",
        tone: "choice",
        searchTerms: ["catalogo", "kobo", "opciones", "radio", "unica"],
      };
    case "select_multiple":
      return {
        tag: "Catálogo Kobo",
        detail: "Crea una lista reutilizable para marcar varias respuestas reales.",
        tone: "choice",
        searchTerms: ["catalogo", "kobo", "opciones", "multiple", "checkbox"],
      };
    case "section":
      return {
        tag: "Inicio + cierre",
        detail: "Crea el grupo con su apertura y su cierre. Luego puedes mover o borrar el cierre para ajustar el alcance.",
        tone: "logic",
        searchTerms: ["grupo", "seccion", "begin", "abrir", "bloque"],
      };
    case "section_end":
      return {
        tag: "Solo cierre",
        detail: "Inserta un cierre suelto, por si necesitas terminar un grupo en un punto específico.",
        tone: "logic",
        searchTerms: ["grupo", "seccion", "end", "cerrar", "cierre", "bloque"],
      };
    case "note":
      return {
        tag: "Sin respuesta",
        detail: "Inserta una nota visible que no guarda respuesta en Kobo.",
        tone: "logic",
        searchTerms: ["nota", "instruccion", "texto informativo"],
      };
    case "calculate":
      return {
        tag: "Automático",
        detail: "Guarda una variable calculada con fórmula XLSForm.",
        tone: "logic",
        searchTerms: ["calculo", "formula", "variable"],
      };
    case "image":
      return {
        tag: "Evidencia",
        detail: "Agrega captura de campo con el tipo técnico correcto para Kobo.",
        tone: "evidence",
        searchTerms: ["foto", "imagen", "camara", "evidencia"],
      };
    case "audio":
      return {
        tag: "Evidencia",
        detail: "Agrega captura de campo con el tipo técnico correcto para Kobo.",
        tone: "evidence",
        searchTerms: ["audio", "voz", "sonido", "evidencia"],
      };
    case "video":
      return {
        tag: "Evidencia",
        detail: "Agrega captura de campo con el tipo técnico correcto para Kobo.",
        tone: "evidence",
        searchTerms: ["video", "audiovisual", "evidencia"],
      };
    case "file":
      return {
        tag: "Evidencia",
        detail: "Agrega captura de campo con el tipo técnico correcto para Kobo.",
        tone: "evidence",
        searchTerms: ["archivo", "adjunto", "documento", "evidencia"],
      };
    case "barcode":
      return {
        tag: "Lectura",
        detail: "Agrega captura de campo con el tipo técnico correcto para Kobo.",
        tone: "evidence",
        searchTerms: ["codigo", "barras", "qr", "lectura", "scanner"],
      };
    case "geopoint":
      return {
        tag: "Ubicación",
        detail: "Agrega captura de campo con el tipo técnico correcto para Kobo.",
        tone: "evidence",
        searchTerms: ["gps", "ubicacion", "geopoint", "punto", "coordenada"],
      };
    case "integer":
    case "decimal":
      return {
        tag: "Número",
        detail: "Después puedes aplicar rangos, mínimos, máximos y mensajes claros.",
        tone: "capture",
        searchTerms: ["numero", "edad", "cantidad", "monto", "rango"],
      };
    case "date":
      return {
        tag: "Fecha",
        detail: "Compatible con reglas de visita, nacimiento o ventanas de levantamiento.",
        tone: "capture",
        searchTerms: ["fecha", "calendario", "dia"],
      };
    default:
      return {
        tag: "Campo",
        detail: "Pieza base para capturar información directa del encuestador.",
        tone: "capture",
        searchTerms: ["texto", "respuesta", "pregunta"],
      };
  }
}

type SuiteMetrics = {
  pieces: number;
  sections: number;
  questions: number;
  catalogs: number;
  required: number;
  logicRules: number;
  warnings: number;
  infos: number;
};

function buildSuiteMetrics(
  structure: BuilderStructure | null,
  catalogsCount: number,
  diagnostics: BuilderDiagnostic[],
): SuiteMetrics {
  const nodes = structure?.outline ?? [];
  return {
    pieces: nodes.length,
    sections: nodes.filter((node) => node.kind === "section" || node.kind === "repeat").length,
    questions: nodes.filter((node) => node.kind === "question" || node.kind === "note" || node.kind === "calculate").length,
    catalogs: catalogsCount,
    required: nodes.filter((node) => node.required).length,
    logicRules: nodes.filter(
      (node) =>
        node.relevant?.trim() ||
        node.constraint?.trim() ||
        node.calculation?.trim() ||
        node.choiceFilter?.trim(),
    ).length,
    warnings: diagnostics.filter((diagnostic) => diagnostic.level === "warn").length,
    infos: diagnostics.filter((diagnostic) => diagnostic.level === "info").length,
  };
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "info" | "warn" | "success";
}) {
  const tokens = {
    neutral: {
      bg: "var(--pulso-surface)",
      border: "var(--pulso-border)",
      fg: "var(--pulso-text-soft)",
    },
    info: {
      bg: "var(--pulso-info-bg)",
      border: "var(--pulso-info-border)",
      fg: "var(--pulso-info-fg)",
    },
    warn: {
      bg: "var(--pulso-warn-bg)",
      border: "var(--pulso-warn-border)",
      fg: "var(--pulso-warn-fg)",
    },
    success: {
      bg: "var(--pulso-success-bg)",
      border: "var(--pulso-success-border)",
      fg: "var(--pulso-success-fg)",
    },
  }[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: 999,
        background: tokens.bg,
        border: `1px solid ${tokens.border}`,
        color: tokens.fg,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {tone === "success" ? <CheckCircle2 size={12} /> : <span style={{ width: 7, height: 7, borderRadius: 999, background: "currentColor", opacity: 0.7 }} />}
      {label}
    </span>
  );
}

function DocumentMetric({
  value,
  label,
  tone = "neutral",
}: {
  value: number;
  label: string;
  tone?: "neutral" | "warn" | "success";
}) {
  return (
    <span className={`pulso-xlsform-document-metric is-${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </span>
  );
}

// =============================================================================
// Helpers añadidos en Sub-PR 2 (estado + autosave + undo/redo)
// =============================================================================

/** Texto humano del estado de guardado para el chip del header. */
function formatSaveStatus(dirty: boolean, lastSavedAt: number | null): string {
  if (dirty) {
    if (lastSavedAt == null) return "Cambios sin guardar";
    return `Cambios sin guardar · último guardado ${formatRelativeTime(lastSavedAt)}`;
  }
  if (lastSavedAt == null) return "Sin cambios pendientes";
  return `Guardado ${formatRelativeTime(lastSavedAt)}`;
}

/** Convierte un timestamp ms epoch en frase tipo "hace 4 s" / "hace 2 min". */
function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return "ahora";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 5) return "ahora";
  if (sec < 60) return `hace ${sec} s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const day = Math.floor(hr / 24);
  return `hace ${day} d`;
}

function SurveyMonkeyLogicPopup({
  workbook,
  sourceName,
  rules,
  visualRules,
  existingKoboLogic,
  overrides,
  busy,
  onLogicDraftChange,
  onRulesChange,
  onVisualRulesChange,
  onOverridesChange,
  onClose,
  onApply,
}: {
  workbook: XlsformEditorWorkbook;
  sourceName: string | null;
  rules: ConfirmedRule[];
  visualRules: SurveyMonkeyVisualLogicRule[];
  existingKoboLogic: Array<{ name: string; label: string; relevant: string }>;
  overrides: Record<string, string[]>;
  busy: boolean;
  onLogicDraftChange: (
    rules: ConfirmedRule[],
    visualRules: SurveyMonkeyVisualLogicRule[],
    overrides: Record<string, string[]>,
    choiceCodeMaps?: ChoiceCodeMap[],
  ) => void;
  onRulesChange: (rules: ConfirmedRule[]) => void;
  onVisualRulesChange: (rules: SurveyMonkeyVisualLogicRule[]) => void;
  onOverridesChange: (next: Record<string, string[]>, nextChoiceCodeMaps?: ChoiceCodeMap[]) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  const [logicPackWarnings, setLogicPackWarnings] = useState<SurveyMonkeyLogicPackWarning[]>([]);
  const refreshedOnOpenRef = useRef(false);

  useEffect(() => {
    if (refreshedOnOpenRef.current || rules.length === 0) return;
    refreshedOnOpenRef.current = true;
    let cancelled = false;
    const choiceCodeMaps = choiceCodeMapsWithOverrides(
      workbook,
      overrides,
      workbook.surveyMonkeyLogic?.choice_code_maps ?? [],
    );
    const workbookForRefresh = workbookWithSurveyMonkeyLogic(
      workbook,
      rules,
      visualRules,
      overrides,
      choiceCodeMaps,
    );
    void refreshSurveyMonkeyAdvancedRules(rules, workbookForRefresh, overrides).then((refreshedRules) => {
      if (cancelled) return;
      const changed = JSON.stringify(refreshedRules) !== JSON.stringify(rules);
      const mapsChanged = JSON.stringify(choiceCodeMaps) !== JSON.stringify(workbook.surveyMonkeyLogic?.choice_code_maps ?? []);
      if (changed || mapsChanged) onLogicDraftChange(refreshedRules, visualRules, overrides, choiceCodeMaps);
    });
    return () => {
      cancelled = true;
    };
  }, [onLogicDraftChange, overrides, rules, visualRules, workbook]);

  async function exportLogicPack() {
    const choiceCodeMaps = choiceCodeMapsWithOverrides(
      workbook,
      overrides,
      workbook.surveyMonkeyLogic?.choice_code_maps ?? [],
    );
    return buildSurveyMonkeyLogicPack({
      workbook,
      advancedRules: rules,
      visualRules,
      choiceOrderOverrides: overrides,
      choiceCodeMaps,
      sourceName,
    });
  }

  async function importLogicPack(parsed: unknown) {
    const imported = importSurveyMonkeyLogicPack(parsed, workbook);
    const warnings = [...imported.warnings];
    const nextRules = mergeAdvancedLogicRules(rules, imported.advanced_rules);
    const nextVisualRules = mergeVisualLogicRules(visualRules, imported.visual_rules, warnings);
    const nextOverrides = { ...overrides };
    for (const [key, labels] of Object.entries(imported.choice_order_overrides)) {
      if (nextOverrides[key] && JSON.stringify(nextOverrides[key]) !== JSON.stringify(labels)) {
        warnings.push({
          severity: "warn",
          message: `La pregunta ${key} ya tenía un orden de opciones personalizado; se conservó el existente.`,
        });
        continue;
      }
      nextOverrides[key] = labels;
    }
    const nextChoiceCodeMaps = mergeChoiceCodeMaps(
      workbook.surveyMonkeyLogic?.choice_code_maps ?? [],
      imported.choice_code_maps,
      warnings,
    );
    const workbookForRefresh = workbookWithSurveyMonkeyLogic(
      workbook,
      nextRules,
      nextVisualRules,
      nextOverrides,
      nextChoiceCodeMaps,
    );
    const refreshedRules = await refreshSurveyMonkeyAdvancedRules(
      nextRules,
      workbookForRefresh,
      nextOverrides,
    );
    setLogicPackWarnings(warnings);
    onLogicDraftChange(refreshedRules, nextVisualRules, nextOverrides, nextChoiceCodeMaps);
    const total = imported.advanced_rules.length + visualActionCountForFooter(imported.visual_rules);
    return `${total} salto${total === 1 ? "" : "s"} cargado${total === 1 ? "" : "s"} para revisar`;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Lógica SurveyMonkey"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 260,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(980px, 100%)",
          maxHeight: "min(860px, calc(100vh - 48px))",
          overflow: "hidden",
          borderRadius: 12,
          background: "white",
          boxShadow: "0 24px 80px rgba(15, 23, 42, 0.28)",
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr) auto",
        }}
      >
        <header
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--pulso-border, #e5e7eb)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Lógica SurveyMonkey</h2>
            <p style={{ margin: "4px 0 0", color: "var(--pulso-muted, #6b7280)", fontSize: 13, lineHeight: 1.45 }}>
              Configura saltos por opción sin ver código. Si necesitas condiciones complejas, usa ramificación avanzada.
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
              <ConfigIoButtons
                filenamePrefix="pulso_surveymonkey_logic"
                exportLabel="Exportar lógica JSON"
                importLabel="Importar lógica JSON"
                onExport={exportLogicPack}
                onImport={importLogicPack}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar lógica SurveyMonkey"
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4 }}
          >
            <X size={20} />
          </button>
        </header>
        <div style={{ padding: 20, overflowY: "auto" }}>
          {logicPackWarnings.length > 0 ? (
            <div
              role="status"
              style={{
                border: "1px solid #fde68a",
                background: "#fffbeb",
                color: "#854d0e",
                borderRadius: 8,
                padding: "10px 12px",
                marginBottom: 14,
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              <strong>Revisión del paquete importado</strong>
              <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                {logicPackWarnings.slice(0, 8).map((warning, index) => (
                  <li key={`${warning.message}-${index}`}>{warning.message}</li>
                ))}
              </ul>
              {logicPackWarnings.length > 8 ? (
                <div style={{ marginTop: 6, fontWeight: 700 }}>
                  +{logicPackWarnings.length - 8} aviso{logicPackWarnings.length - 8 === 1 ? "" : "s"} adicional{logicPackWarnings.length - 8 === 1 ? "" : "es"}.
                </div>
              ) : null}
            </div>
          ) : null}
          <RuleWizard
            surveyId=""
            workbook={workbook}
            paginas={{}}
            paginasLabels={{}}
            confirmed={rules}
            visualRules={visualRules}
            existingKoboLogic={existingKoboLogic}
            onAdd={(rule) => onRulesChange([...rules, rule])}
            onUpdate={(id, rule) => onRulesChange(rules.map((current) => current.id === id ? rule : current))}
            onRemove={(id) => onRulesChange(rules.filter((rule) => rule.id !== id))}
            onClearAll={() => onRulesChange([])}
            onVisualRulesChange={onVisualRulesChange}
            overrides={overrides}
            choiceCodeMaps={workbook.surveyMonkeyLogic?.choice_code_maps ?? []}
            onOverridesChange={onOverridesChange}
          />
        </div>
        <footer
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--pulso-border, #e5e7eb)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            background: "#f8fafc",
          }}
        >
          <span style={{ color: "var(--pulso-muted, #6b7280)", fontSize: 12 }}>
            {visualActionCountForFooter(visualRules) + rules.length} salto{visualActionCountForFooter(visualRules) + rules.length === 1 ? "" : "s"} configurado{visualActionCountForFooter(visualRules) + rules.length === 1 ? "" : "s"}
          </span>
          <div style={{ display: "inline-flex", gap: 8 }}>
            <button type="button" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button
              type="button"
              className="pulso-primary"
              onClick={onApply}
              disabled={busy || (rules.length === 0 && visualActionCountForFooter(visualRules) === 0)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <CheckCircle2 size={14} /> Recalcular y aplicar
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/**
 * Banner que aparece cuando al montar detectamos un snapshot persistido en
 * localStorage o backend. Le ofrece al usuario
 * restaurar lo que estaba editando vs descartarlo.
 */
function RestoreOfferBanner({
  snapshot,
  onAccept,
  onDismiss,
}: {
  snapshot: { savedAt: number; sourceName: string | null };
  onAccept: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="Restaurar formulario anterior"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: 8,
        borderRadius: 12,
        background: "color-mix(in srgb, var(--pulso-info-bg) 82%, #ffffff 18%)",
        border: "1px solid color-mix(in srgb, var(--pulso-info-border) 72%, var(--pulso-border))",
        color: "var(--pulso-text)",
        flexWrap: "wrap",
        boxShadow: "var(--xls-shadow-hairline, 0 1px 2px rgba(15, 23, 42, 0.06))",
      }}
    >
      <button
        type="button"
        onClick={onAccept}
        style={{
          flex: "1 1 420px",
          minWidth: 280,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 12px",
          border: "1px solid transparent",
          borderRadius: 10,
          background: "rgba(255, 255, 255, 0.72)",
          color: "inherit",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 32,
            height: 32,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "0 0 auto",
            borderRadius: 9,
            background: "color-mix(in srgb, var(--pulso-info-fg) 10%, #ffffff)",
            color: "var(--pulso-info-fg)",
          }}
        >
          <IconHint size={16} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 780 }}>
            Continuar formulario guardado
          </span>
          <span style={{ display: "block", fontSize: 12, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
            {/* Defensivo: en localStorage viejo `sourceName` puede haber
                quedado como objeto en algún caso edge. Solo lo mostramos
                si es string no vacío. */}
            {typeof snapshot.sourceName === "string" && snapshot.sourceName
              ? `Archivo: ${snapshot.sourceName} · `
              : ""}
            Guardado automáticamente {formatRelativeTime(snapshot.savedAt)}.
          </span>
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--pulso-info-fg)",
            fontSize: 12,
            fontWeight: 760,
            whiteSpace: "nowrap",
          }}
        >
          Entrar <IconForward size={14} />
        </span>
      </button>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          minHeight: 36,
          padding: "8px 10px",
          border: "1px solid var(--pulso-border)",
          borderRadius: 9,
          background: "#ffffff",
          color: "var(--pulso-text-soft)",
          fontSize: 12,
          fontWeight: 720,
        }}
      >
        <Trash2 size={14} /> Descartar guardado
      </button>
    </div>
  );
}
