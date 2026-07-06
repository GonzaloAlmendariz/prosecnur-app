import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Cloud,
  Download,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Layers3,
  ListChecks,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { IconHint, IconNew, IconForward } from "../../lib/icons";
import {
  apiSaveEntregable,
  apiUpload,
  apiXlsformEditorExport,
  apiXlsformEditorExportPdf,
  apiXlsformEditorImport,
  apiXlsformEditorSmApplyLogic,
  apiXlsformEditorSmInterpretRule,
  apiXlsformEditorValidate,
  downloadUrl,
  type ChoiceCodeMap,
  type Hallazgo,
  type SurveyMonkeyVisualLogicRule,
} from "../../api/client";
import { useProjectShell } from "../project/ProjectShell";
import { ImportSurveyMonkeyDialog } from "./shell/ImportSurveyMonkeyDialog";
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
  resolveInsertionIndex,
} from "./parsing/buildIndex";
import { buildDiagnostics } from "./parsing/diagnostics";
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
  loadSnapshot,
  loadSnapshotFromBackend,
  reconcileSnapshotWithBackend,
  saveSnapshot,
  syncSnapshotToBackend,
} from "./state/persistence";
import EmptyHome from "./shell/EmptyHome";
import { QuestionnaireProgressPanel } from "./shell/QuestionnaireProgressPanel";
import { buildWorkbookFromSeed } from "./templates";
import type { TemplateSeed } from "./templates";
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

export default function XlsformEditorPage() {
  // Detecta si hay un .pulso abierto — al exportar, decide entre guardar
  // al directorio del proyecto (vía /api/fs/save-to-project) o usar la
  // descarga clásica del navegador.
  const { project } = useProjectShell();
  const { sessionId } = useSession();
  // Estado del workbook + dirty + lastSavedAt + history (undo/redo) en un
  // solo reducer para mantener consistencia transaccional. Las acciones
  // disponibles son SET (mutación normal), LOAD (importar/restaurar),
  // CLEAR (volver al EmptyHome), UNDO/REDO y MARK_SAVED.
  const [editorState, dispatch] = useReducer(
    editorReducer,
    null,
    () => createInitialEditorState(null),
  );
  const { workbook, dirty, lastSavedAt } = editorState;
  const canUndo = canUndoEditor(editorState);
  const canRedo = canRedoEditor(editorState);

  const [selection, setSelection] = useState<BuilderSelection | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Todavía no hay un formulario abierto.");
  const [artifact, setArtifact] = useState<{ file_id: string; original_name: string; extension: "xlsx" | "pdf" } | null>(null);
  const [source, setSource] = useState<{ kind: string | null; original_name: string | null } | null>(null);
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
	  const [smLogicDialogOpen, setSmLogicDialogOpen] = useState(false);
	  const [smLogicRules, setSmLogicRules] = useState<ConfirmedRule[]>([]);
	  const [smVisualLogicRules, setSmVisualLogicRules] = useState<SurveyMonkeyVisualLogicRule[]>([]);
	  const [smLogicChoiceOverrides, setSmLogicChoiceOverrides] = useState<Record<string, string[]>>({});
	  const [questionnaireViewOpen, setQuestionnaireViewOpen] = useState(false);
  /** Modal de importación SurveyMonkey vía API. El .sav queda solo como ruta
   *  legacy opcional; el flujo principal ya no pide archivo. */
  const [smImportDialog, setSmImportDialog] = useState<
    | { fileId?: string | null; fileName: string }
    | null
  >(null);
  /** Hallazgos del validador empírico (devueltos por import-with-logic).
   *  Se renderizan en panel UI dedicado, NO se exportan al .xlsx. */
  const [hallazgos, setHallazgos] = useState<Hallazgo[]>([]);
  /** Snapshot del autosave detectado al montar; muestra UI de "continuar". */
  const [restoreOffer, setRestoreOffer] = useState<ReturnType<typeof loadSnapshot>>(null);
  const xlsInputRef = useRef<HTMLInputElement | null>(null);
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

  // Detectar al montar — y al cambiar de proyecto — si hay un snapshot
  // persistido para el scope actual. Para proyectos .pulso esperamos al
  // backend y reconciliamos ambos snapshots: localStorage puede ser más
  // fresco, pero el .pulso puede traer metadata crítica como
  // surveyMonkeyLogic. Si cambiamos de proyecto: descartamos el workbook
  // abierto (pertenecía al proyecto anterior) y recargamos contra el nuevo scope.
  // Usamos un ref para detectar el primer mount y NO limpiar entonces.
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
    const local = loadSnapshot(projectScope);
    if (local && !projectScope) {
      setRestoreOffer(local);
    }
    let cancelled = false;
    void loadSnapshotFromBackend().then((remote) => {
      if (cancelled) return;
      const reconciled = reconcileSnapshotWithBackend(local, remote);
      if (reconciled) setRestoreOffer(reconciled);
    });
    return () => {
      cancelled = true;
    };
    // workbookRef intencionalmente no en deps — solo lo consultamos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectScope, restoreKey]);

  // Ref que sigue al workbook actual sin disparar el efecto de scope
  // cuando muta. Lo consultamos al detectar switch de proyecto.
  const workbookRef = useRef(workbook);
  useEffect(() => {
    workbookRef.current = workbook;
  }, [workbook]);

  // Programar autosave después de cada edición. El scheduler debouncea 2s
  // — si el usuario sigue editando, se posterga; si se queda quieto, escribe.
  // Pasamos el `projectScope` para que el snapshot se guarde en el bucket
  // del proyecto actual.
  useEffect(() => {
    if (!workbook) return;
    if (!dirty) return;
    persistence.schedule(
      workbook,
      {
        sourceKind: source?.kind ?? null,
        sourceName: source?.original_name ?? null,
      },
      projectScope,
    );
  }, [workbook, dirty, source, persistence, projectScope]);

  // Atajos de teclado del editor:
  //   Cmd/Ctrl+Z         → deshacer
  //   Cmd/Ctrl+Shift+Z   → rehacer
  //   Ctrl+Y             → rehacer (Windows)
  //   Cmd/Ctrl+N         → nueva pregunta (texto, después de la selección)
  //
  // Undo/redo se ignoran si el foco está en un input/textarea/contentEditable
  // (el usuario espera que Cmd+Z deshaga su tipeo, no la última edición del
  // workbook). "Nueva pregunta" funciona siempre — incluso tipeando — porque
  // es una acción global del editor.
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

      // Cmd/Ctrl+N — nueva pregunta. Siempre funciona, sin importar el
      // foco. PreventDefault es crítico porque el navegador captura
      // este shortcut para "nueva ventana" — en Electron sí lo
      // bloqueamos, en navegadores normales puede que no.
      if (key === "n" && !event.shiftKey) {
        if (!workbookRef.current) return;
        event.preventDefault();
        const afterRow =
          selectionRef.current?.kind === "survey" ? selectionRef.current.rowIndex : null;
        addQuestionRef.current?.("text", afterRow);
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

  // Refs estables para que el handler de teclado (registrado una sola
  // vez en mount) acceda al estado actual sin re-suscribirse.
  const selectionRef = useRef<BuilderSelection | null>(null);
  const addQuestionRef = useRef<typeof addQuestion | null>(null);
  useEffect(() => {
    selectionRef.current = selection;
  });
  useEffect(() => {
    addQuestionRef.current = addQuestion;
  });

  const xlsformIndex = useMemo(
    () => (workbook ? buildXlsformIndex(workbook) : null),
    [workbook]
  );
  const structure = xlsformIndex?.structure ?? null;

  const catalogs = xlsformIndex?.catalogs ?? [];

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
    if (selection.kind === "survey" && !structure?.byRow.has(selection.rowIndex)) {
      if (structure?.firstSelectableRow != null) {
        setSelection({ kind: "survey", rowIndex: structure.firstSelectableRow });
      } else {
        setSelection({ kind: "settings" });
      }
    }
  }, [selection, structure, workbook]);

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
  const activeFocusLabel = useMemo(() => {
    if (!workbook) return "Sin formulario activo";
    if (selection?.kind === "settings") return "Ajustes del formulario";
    if (!selectedNode) return "Sin pieza seleccionada";
    return selectedNode.label || selectedNode.name || `Fila ${selectedNode.rowIndex + 1}`;
  }, [selectedNode, selection?.kind, workbook]);
  const movement = selection?.kind === "survey"
    ? getSiblingRows(structure, selection.rowIndex)
    : { prevRow: null as number | null, nextRow: null as number | null };

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

  const loadWorkbook = useCallback(
    (
      next: XlsformEditorWorkbook,
      nextSource: { kind: string | null; original_name: string | null },
      nextStatus: string,
    ) => {
      // LOAD resetea historia y dirty=false. Cancelamos cualquier autosave
      // pendiente del workbook anterior para no pisar el snapshot nuevo.
      persistence.cancel();
      const loadedWorkbook = cloneWorkbook(next);
      dispatch({ type: "LOAD", workbook: loadedWorkbook });
      setSource(nextSource);
      setArtifact(null);
      setStatus(nextStatus);
      setRestoreOffer(null);
      setEditorMode("builder");
      setBuilderWorkspaceMode("focus");
      setLogicCanvasOpen(false);
      setQuestionnaireViewOpen(false);
      setSmLogicRules(loadedWorkbook.surveyMonkeyLogic?.advanced_rules ?? loadedWorkbook.surveyMonkeyLogic?.rules ?? []);
      setSmVisualLogicRules(loadedWorkbook.surveyMonkeyLogic?.visual_rules ?? []);
      setSmLogicChoiceOverrides(loadedWorkbook.surveyMonkeyLogic?.choice_order_overrides ?? {});
      const sourceMeta = {
        sourceKind: nextSource.kind,
        sourceName: nextSource.original_name,
      };
      const savedAt = saveSnapshot(loadedWorkbook, sourceMeta, projectScope);
      void syncSnapshotToBackend(loadedWorkbook, sourceMeta);
      if (savedAt != null) {
        dispatch({ type: "MARK_SAVED", savedAt });
      }
    },
    [persistence, projectScope],
  );

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
      { kind: snap.sourceKind ?? null, original_name: snap.sourceName ?? null },
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
    resetMessages();
    setBusy(`Importando ${file.name}…`);
    try {
      const up = await apiUpload(file, "xlsform");
      const out = await apiXlsformEditorImport(up.file_id);
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
    resetMessages();
    setSmImportDialog({ fileId: null, fileName: "SurveyMonkey API" });
  }

  // Callback del modal cuando completa con éxito (ya con o sin reglas aplicadas)
  async function onSurveyMonkeyImportComplete(payload: {
    workbook: XlsformEditorWorkbook;
    source: { kind: string | null; original_name: string | null };
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

  async function onExport() {
    if (!workbook) return;
    resetMessages();
    setArtifact(null);
    setBusy("Exportando XLSForm…");
    try {
      const exportableWorkbook = { ...workbook, diagnostico: null };
      const out = await apiXlsformEditorExport(exportableWorkbook, cleanFilename(source?.original_name), source);
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

  async function onExportPdf() {
    if (!workbook) return;
    resetMessages();
    setArtifact(null);
    setBusy("Exportando PDF para papel…");
    try {
      const exportableWorkbook = { ...workbook, diagnostico: null };
      const out = await apiXlsformEditorExportPdf(
        exportableWorkbook,
        pdfFilenameFromSource(source?.original_name),
      );
      setArtifact({ file_id: out.file_id, original_name: out.original_name, extension: "pdf" });
      setStatus(`Listo: generamos ${out.original_name} con plantilla impresa Pulso.`);
      const warnDetail = out.warnings?.length
        ? ` ${out.warnings.length} salto(s) o regla(s) necesitan revisión manual.`
        : "";

      if (project.status.has_project) {
        try {
          const saved = await apiSaveEntregable(out.file_id, entregableStem(out.original_name), { overwrite: true });
          toasts.push({
            kind: out.warnings?.length ? "warn" : "success",
            title: "PDF guardado en el proyecto",
            detail: `${saved.path}${warnDetail}`,
            durationMs: 9000,
          });
        } catch (e) {
          toasts.push({
            kind: "warn",
            title: "PDF listo, pero no se pudo guardar en el proyecto",
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
          title: "PDF listo",
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
      toasts.push({ kind: "danger", title: "No se pudo exportar el PDF", detail: msg });
    } finally {
      setBusy("");
    }
  }

  function onNewWorkbook() {
    if (blockUntilRestoreDecision("empezar otro formulario")) return;
    if (dirty && !window.confirm("Hay cambios sin exportar. ¿Abrimos un constructor nuevo igual?")) return;
    resetMessages();
    loadWorkbook(
      createBlankWorkbook(),
      { kind: null, original_name: null },
      "Creamos una base limpia para diseñar el formulario desde una interfaz guiada."
    );
  }

  /**
   * Carga un template seed (galería del EmptyHome) materializándolo a
   * workbook editable. Comparte el guardarraíl de "cambios sin exportar"
   * con `onNewWorkbook` para que el usuario no pierda trabajo por descuido.
   */
  function onPickTemplate(template: TemplateSeed) {
    if (blockUntilRestoreDecision("cargar una plantilla")) return;
    if (
      dirty &&
      !window.confirm(
        `Hay cambios sin exportar. ¿Reemplazar el formulario actual por la plantilla «${template.title}»?`,
      )
    ) {
      return;
    }
    resetMessages();
    loadWorkbook(
      buildWorkbookFromSeed(template),
      { kind: null, original_name: null },
      `Cargamos la plantilla «${template.title}». Personaliza los textos y las opciones desde el constructor.`,
    );
    toasts.push({
      kind: "success",
      title: "Plantilla cargada",
      detail: `Empezaste con «${template.title}». Edita lo que necesites.`,
    });
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
      insertRecord(draft.choices, draft.choices.rows.length, {
        list_name: nextName,
        name: "opcion_1",
        label: "Nueva opción 1",
      });
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
      setError(`Ya existe un catálogo llamado "${nextListName}".`);
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
    updateWorkbook((draft) => {
      setCell(draft.survey, rowIndex, "type", nextKind);
      const structureDraft = parseBuilderStructure(draft.survey);
      const section = structureDraft.sections.get(`section-${rowIndex}`);
      if (section?.endRowIndex != null) {
        setCell(draft.survey, section.endRowIndex, "type", "end_group");
      } else {
        const closeIndex = rowIndex + 1;
        insertRecord(draft.survey, closeIndex, { type: "end_group" });
      }
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
    // el AddBetween, vinculamos la pregunta a ese listName y NO creamos
    // filas nuevas en `choices`. Si no, generamos una lista nueva con
    // nombre único basado en el nombre de la pregunta.
    let listName = "";
    let createNewList = false;
    if (isSelect) {
      const existing = new Set(catalogs.map((c) => c.listName));
      if (reuseListName && existing.has(reuseListName)) {
        listName = reuseListName;
        createNewList = false;
      } else {
        let candidate = `lista_${nextName}`;
        let i = 2;
        while (existing.has(candidate)) {
          candidate = `lista_${nextName}_${i}`;
          i += 1;
        }
        listName = candidate;
        createNewList = true;
      }
    }
    updateWorkbook((draft) => {
      if (isSelect && createNewList) {
        insertRecord(draft.choices, draft.choices.rows.length, {
          list_name: listName,
          name: "opcion_1",
          label: "Nueva opción 1",
        });
      }
      insertRecord(draft.survey, insertionIndex, {
        type: buildType(nextBaseType, listName),
        name: nextName,
        label: isSelect ? "Nueva pregunta de selección" : nextBaseType === "calculate" ? "Nuevo cálculo" : "Nueva pregunta",
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
    kind: "section" | "text" | "select_one" | "select_multiple" | "integer" | "date" | "note" | "calculate",
    reuseListName?: string,
  ) {
    if (kind === "section") addSection(afterRowIndex);
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

  function deleteCurrentSelection() {
    if (!workbook || !selection || selection.kind !== "survey") return;
    const currentRow = selection.rowIndex;
    const currentNode = structure?.byRow.get(currentRow) ?? null;
    if (!currentNode) return;
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
      title: "Catálogo borrado",
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
      key: "section",
      label: "Sección",
      hint: "Agrupa preguntas y puede tener una condición propia.",
      icon: addMenuIcon("begin_group"),
      action: addSection,
    },
    {
      key: "text",
      label: "Pregunta abierta",
      hint: "Texto libre para respuestas cortas o comentarios.",
      icon: addMenuIcon("text"),
      action: () => addQuestion("text"),
    },
    {
      key: "select_one",
      label: "Selección única",
      hint: "Una sola respuesta usando un catálogo de opciones.",
      icon: addMenuIcon("select_one"),
      action: () => addQuestion("select_one"),
    },
    {
      key: "select_multiple",
      label: "Selección múltiple",
      hint: "Varias respuestas usando un catálogo reutilizable.",
      icon: addMenuIcon("select_multiple"),
      action: () => addQuestion("select_multiple"),
    },
    {
      key: "integer",
      label: "Número entero",
      hint: "Edad, cantidades, puntajes u otros valores sin decimales.",
      icon: addMenuIcon("integer"),
      action: () => addQuestion("integer"),
    },
    {
      key: "decimal",
      label: "Número decimal",
      hint: "Montos, proporciones o medidas con decimales.",
      icon: addMenuIcon("decimal"),
      action: () => addQuestion("decimal"),
    },
    {
      key: "date",
      label: "Fecha",
      hint: "Fechas de atención, nacimiento, visita o eventos.",
      icon: addMenuIcon("date"),
      action: () => addQuestion("date"),
    },
    {
      key: "note",
      label: "Texto informativo",
      hint: "Instrucciones o mensajes que no guardan respuesta.",
      icon: addMenuIcon("note"),
      action: () => addQuestion("note"),
    },
    {
      key: "calculate",
      label: "Cálculo",
      hint: "Variable automática basada en otras respuestas.",
      icon: addMenuIcon("calculate"),
      action: () => addQuestion("calculate"),
    },
  ];

  return (
    <PageFrame
      title="Editor de formularios"
      lead="Constructor visual, hojas técnicas y exportación XLSForm en un mismo workbench."
      className="pulso-xlsform-frame"
      resetScrollKey={`${workbook ? "workbook" : "empty"}:${editorMode}`}
      meta={(
        <div className="pulso-xlsform-doc-meta">
          <StatusChip label={workbook ? formatSource(source?.kind ?? null) : "Sin archivo"} tone={workbook ? "info" : "neutral"} />
          <StatusChip
            label={
              workbook
                ? formatSaveStatus(dirty, lastSavedAt)
                : "Sin cambios pendientes"
            }
            tone={
              workbook && dirty
                ? "warn"
                : workbook && lastSavedAt != null
                  ? "info"
                  : "success"
            }
          />
          {workbook && (canUndo || canRedo) && (
            <div className="pulso-xlsform-history-controls">
              <button
                type="button"
                onClick={() => dispatch({ type: "UNDO" })}
                disabled={!canUndo}
                title="Deshacer (⌘Z)"
                className="pulso-xlsform-history-button"
                aria-label="Deshacer último cambio"
              >
                ↶ Deshacer
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: "REDO" })}
                disabled={!canRedo}
                title="Rehacer (⇧⌘Z)"
                className="pulso-xlsform-history-button"
                aria-label="Rehacer cambio deshecho"
              >
                ↷ Rehacer
              </button>
            </div>
          )}
        </div>
      )}
      toolbar={workbook ? (
        <div className="pulso-xlsform-commandbar" aria-label="Comandos del formulario activo">
          <div className="pulso-xlsform-commandbar-group pulso-xlsform-commandbar-group--document">
            <div className="pulso-xlsform-document-strip" aria-label="Resumen del formulario">
              <span className="pulso-xlsform-document-icon" aria-hidden="true">
                <FileSpreadsheet size={13} />
              </span>
              <span className="pulso-xlsform-commandbar-kicker" title={source?.original_name ?? "Formulario activo"}>
                {source?.original_name ?? "Formulario activo"}
              </span>
              <span className="pulso-xlsform-document-divider" aria-hidden="true" />
              <DocumentMetric value={structure?.outline.length ?? 0} label="piezas" />
              <DocumentMetric value={catalogs.length} label="catálogos" />
              <DocumentMetric
                value={diagnostics.filter((diagnostic) => diagnostic.level === "warn").length}
                label="avisos"
                tone={diagnostics.some((diagnostic) => diagnostic.level === "warn") ? "warn" : "success"}
              />
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
              onOpenSurveyMonkeyLogic={() => setSmLogicDialogOpen(true)}
              onOpenQuestionnaireView={() => setQuestionnaireViewOpen(true)}
              onOpenCatalogsLens={() => setCatalogsLensOpen(true)}
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
            <button type="button" onClick={onNewWorkbook} className="pulso-xlsform-toolbar-button">
              <IconNew size={14} /> Nuevo
            </button>
            <button type="button" onClick={() => xlsInputRef.current?.click()} className="pulso-xlsform-toolbar-button">
              <Upload size={14} /> Importar
            </button>
            <button type="button" onClick={onImportSurveyMonkey} className="pulso-xlsform-toolbar-button">
              <Cloud size={14} /> SurveyMonkey
            </button>
            <button type="button" className="pulso-primary pulso-xlsform-toolbar-button" onClick={onExport} disabled={!!busy}>
              <Download size={14} /> Exportar .xlsx
            </button>
            <button type="button" onClick={onExportPdf} disabled={!!busy} className="pulso-xlsform-toolbar-button">
              <FileText size={14} /> PDF
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
        <EmptyHome
          onNewBlank={onNewWorkbook}
          onImportXls={() => {
            if (blockUntilRestoreDecision("importar otro XLSForm")) return;
            xlsInputRef.current?.click();
          }}
          onImportSurveyMonkey={onImportSurveyMonkey}
          onPickTemplate={onPickTemplate}
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
              defaultName={artifact.original_name.replace(/\.(xlsx|pdf)$/i, "")}
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
            <WorkbenchSuiteHeader
              mode={editorMode}
              busy={busy}
              status={status}
              activeFocusLabel={activeFocusLabel}
              metrics={suiteMetrics}
            />
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
                          type="button"
                          className="pulso-icon"
                          onClick={() => setShowAddMenu((value) => !value)}
                          title="Añadir pieza"
                        >
                          <Plus size={14} />
                        </button>
                        {showAddMenu && (
                          <AddElementMenu
                            items={addMenuItems}
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
                          defaultName={artifact.original_name.replace(/\.(xlsx|pdf)$/i, "")}
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
        catalogsCount={catalogs.length}
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
            onChoiceChange={updateChoice}
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
          // El canvas solo declara relaciones de visibilidad (relevant).
          // Drag-arrow desde A hacia B → B aparece si A tiene valor.
          // El usuario refina el predicado exacto en el inspector.
          updateSurveyField(rowIndex, "relevant", expression);
          toasts.push({
            kind: "success",
            title: "Conexión creada",
            detail:
              "Se condicionó la visibilidad. Refínala en el inspector si quieres precisar el valor.",
          });
	        }}
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
          className="pulso-graph-overlay"
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
                <span>Recorrido completo por secciones y preguntas</span>
              </div>
            </div>
            <div className="pulso-graph-header-right">
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
          <main style={{ padding: 18, overflow: "auto", height: "calc(100vh - 64px)", background: "#f8fafc" }}>
            <div style={{ maxWidth: 1280, margin: "0 auto" }}>
              <QuestionnaireProgressPanel
                structure={structure}
                selection={selection}
                onSelect={(next) => {
                  setSelection(next);
                  setQuestionnaireViewOpen(false);
                }}
              />
            </div>
          </main>
        </div>
      ), document.body) : null}

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
  onClose,
}: {
  items: AddMenuItem[];
  onClose: () => void;
}) {
  return (
    <div className="pulso-add-element-menu">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => {
            item.action();
            onClose();
          }}
          className="pulso-add-element-menu-item"
        >
          <span className="pulso-add-element-menu-icon">
            {item.icon}
          </span>
          <span className="pulso-add-element-menu-copy">
            <strong>{item.label}</strong>
            <span>{item.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
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

function WorkbenchSuiteHeader({
  mode,
  busy,
  status,
  activeFocusLabel,
  metrics,
}: {
  mode: "builder" | "sheets";
  busy: string | null;
  status: string;
  activeFocusLabel: string;
  metrics: SuiteMetrics;
}) {
  const modeLabel = mode === "builder" ? "Constructor profesional" : "Hojas técnicas";
  const modeHint = mode === "builder"
    ? "Diseño visual, outline e inspector trabajan como una sola cabina."
    : "Edición tabular de celdas crudas con sincronización hacia el constructor.";
  const validationLabel = metrics.warnings > 0
    ? `${metrics.warnings} por revisar`
    : "Sin avisos";

  return (
    <div className="pulso-xlsform-suite-header">
      <div className="pulso-xlsform-suite-identity">
        <span className="pulso-xlsform-suite-icon" aria-hidden="true">
          {mode === "builder" ? <Layers3 size={16} /> : <FileSpreadsheet size={16} />}
        </span>
        <div>
          <span className="pulso-section-eyebrow">Suite de formulario</span>
          <strong>{modeLabel}</strong>
          <small>{busy || status || modeHint}</small>
        </div>
      </div>

      <div className="pulso-xlsform-suite-rail" aria-label="Estado del formulario">
        <SuiteMetricItem
          icon={<ListChecks size={14} />}
          value={metrics.questions}
          label="preguntas"
        />
        <SuiteMetricItem
          icon={<GitBranch size={14} />}
          value={metrics.logicRules}
          label="lógica"
        />
        <SuiteMetricItem
          icon={<FileSpreadsheet size={14} />}
          value={metrics.catalogs}
          label="catálogos"
        />
        <SuiteMetricItem
          icon={<ShieldCheck size={14} />}
          value={validationLabel}
          label={metrics.infos > 0 ? `${metrics.infos} notas` : "calidad"}
          tone={metrics.warnings > 0 ? "warn" : "success"}
        />
      </div>

      <div className="pulso-xlsform-suite-focus" title={activeFocusLabel}>
        <span>Foco</span>
        <strong>{activeFocusLabel}</strong>
        <small>
          {metrics.pieces} piezas · {metrics.required} obligatorias
        </small>
      </div>
    </div>
  );
}

function SuiteMetricItem({
  icon,
  value,
  label,
  tone = "neutral",
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  tone?: "neutral" | "warn" | "success";
}) {
  return (
    <span className={`pulso-xlsform-suite-metric is-${tone}`}>
      <span className="pulso-xlsform-suite-metric-icon" aria-hidden="true">
        {icon}
      </span>
      <strong>{value}</strong>
      <small>{label}</small>
    </span>
  );
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
