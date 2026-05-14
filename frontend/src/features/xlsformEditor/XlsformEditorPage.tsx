import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  GitBranch,
  Hash,
  Layers3,
  ListChecks,
  Plus,
  Settings2,
  Table2,
  Trash2,
  Type,
  Upload,
  Workflow,
  X,
} from "lucide-react";
import { IconHint, IconNew, IconForward, IconEditor } from "../../lib/icons";
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
  type Hallazgo,
  type SurveyMonkeyVisualLogicRule,
} from "../../api/client";
import { useProjectShell } from "../project/ProjectShell";
import { ImportSurveyMonkeyDialog } from "./shell/ImportSurveyMonkeyDialog";
import { compileVisualLogicRules, RuleWizard, type ConfirmedRule } from "./shell/RuleWizard";
import { HallazgosPanel } from "./shell/HallazgosPanel";
import smMonkey from "../../assets/sm-monkey.png";
import { Panel } from "../../components/Panel";
import { PageFrame } from "../../components/PageFrame";
import { EmptyState, ErrorBlock, LoadingBlock } from "../../components/States";
import SaveEntregableButton from "../project/SaveEntregableButton";

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
  SectionMeta,
  SheetKey,
  XlsformEditorWorkbook,
  XlsformIndex,
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
import {
  canRedoEditor,
  canUndoEditor,
  createInitialEditorState,
  editorReducer,
} from "./state/editorReducer";
import {
  clearSnapshot,
  createPersistenceScheduler,
  loadSnapshot,
  loadSnapshotFromBackend,
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
import { PreviewCanvas } from "./canvas/PreviewCanvas";
import { FormCanvas } from "./canvas/FormCanvas";
import { Inspector } from "./inspector/Inspector";
import { ContextPanel } from "./inspector/ContextPanel";
import { MoreViewsMenu } from "./shell/MoreViewsMenu";
import { Coachmarks } from "./shell/Coachmarks";
import { iconForType } from "./helpers/icons";
import { renderMarkdownInline, stripMarkdown } from "./helpers/markdown";
import { paletteForType } from "./helpers/paletteForType";
import type {
  LogicCatalog,
  LogicScope,
  LogicVariable,
} from "./logic";
import { LogicCanvas } from "./canvas-graph/LogicCanvas";

const QUESTION_TYPE_OPTIONS = [
  { value: "text", label: "Texto corto" },
  { value: "integer", label: "Número entero" },
  { value: "decimal", label: "Número decimal" },
  { value: "date", label: "Fecha" },
  { value: "select_one", label: "Selección única" },
  { value: "select_multiple", label: "Selección múltiple" },
  { value: "note", label: "Texto informativo" },
  { value: "calculate", label: "Cálculo automático" },
];

// (parsing/sheetUtils, parsing/parseType, parsing/buildIndex, parsing/diagnostics
// concentran toda la lógica que antes vivía inline. Mantenemos solo `logicSummary`
// aquí porque depende de iconos JSX — `parsing/*` es puro TS sin JSX.)

/**
 * Posición 1-indexed de una fila dentro del outline, contando solo
 * preguntas reales (question/note/calculate). Si la fila es una sección o
 * un marcador begin/end, devuelve `undefined`. Útil para el header del
 * Inspector y el Breadcrumb del Canvas — comparten esta misma noción.
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

function logicSummary(node: BuilderNode | null) {
  if (!node) return [];
  const blocks: Array<{ title: string; text: string; icon: ReactNode }> = [];
  if (node.relevant) blocks.push({ title: "Cuándo se muestra", text: node.relevant, icon: <GitBranch size={14} /> });
  if (node.constraint) blocks.push({ title: "Qué valida", text: node.constraint, icon: <CheckCircle2 size={14} /> });
  if (node.choiceFilter) blocks.push({ title: "Cómo filtra opciones", text: node.choiceFilter, icon: <Filter size={14} /> });
  if (node.calculation) blocks.push({ title: "Cómo se calcula", text: node.calculation, icon: <Hash size={14} /> });
  return blocks;
}

function workbookWithSurveyMonkeyLogic(
  workbook: XlsformEditorWorkbook,
  advancedRules: ConfirmedRule[],
  visualRules: SurveyMonkeyVisualLogicRule[],
  choiceOrderOverrides: Record<string, string[]>,
): XlsformEditorWorkbook {
  const next = cloneWorkbook(workbook);
  const overrides = Object.fromEntries(
    Object.entries(choiceOrderOverrides).map(([key, labels]) => [key, [...labels]]),
  );
  next.surveyMonkeyLogic = advancedRules.length || visualRules.length || Object.keys(overrides).length
    ? {
        rules: advancedRules.map((rule) => ({ ...rule })),
        advanced_rules: advancedRules.map((rule) => ({ ...rule })),
        visual_rules: visualRules.map((rule) => ({
          ...rule,
          choices: rule.choices.map((choice) => ({ ...choice, action: { ...choice.action } })),
        })),
        choice_order_overrides: overrides,
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

export default function XlsformEditorPage() {
  // Detecta si hay un .pulso abierto — al exportar, decide entre guardar
  // al directorio del proyecto (vía /api/fs/save-to-project) o usar la
  // descarga clásica del navegador.
  const { project } = useProjectShell();
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
  // persistido para el scope actual. Primero local (localStorage), después
  // el backend (state del .pulso). El primero gana porque suele ser más
  // fresco. Si cambiamos de proyecto: descartamos el workbook abierto
  // (pertenecía al proyecto anterior) y recargamos contra el nuevo scope.
  // Usamos un ref para detectar el primer mount y NO limpiar entonces.
  const lastScopeRef = useRef<typeof projectScope>(projectScope);
  useEffect(() => {
    const isProjectSwitch = lastScopeRef.current !== projectScope;
    lastScopeRef.current = projectScope;

    // Si fue un switch de proyecto y había un workbook cargado, lo
    // limpiamos — su snapshot está a salvo en su propio bucket.
    if (isProjectSwitch && workbookRef.current) {
      dispatch({ type: "CLEAR" });
    }

    setRestoreOffer(null);
    const local = loadSnapshot(projectScope);
    if (local) {
      setRestoreOffer(local);
      return;
    }
    let cancelled = false;
    void loadSnapshotFromBackend().then((remote) => {
      if (cancelled) return;
      if (remote) setRestoreOffer(remote);
    });
    return () => {
      cancelled = true;
    };
    // workbookRef intencionalmente no en deps — solo lo consultamos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectScope]);

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

  const visibleTabs = useMemo<SheetKey[]>(() => {
    if (!workbook) return [];
    return ["survey", "choices", "settings", "paper"];
  }, [workbook]);

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

  const uniqueChoiceLists = workbook
    ? (() => {
        const listCol = workbook.choices.columns.indexOf("list_name");
        if (listCol < 0) return 0;
        return new Set(
          workbook.choices.rows
            .map((row) => row[listCol] ?? "")
            .filter((value) => !!value)
        ).size;
      })()
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

  const summaryCards = workbook ? [
    { label: "preguntas y elementos", value: xlsformIndex?.stats.nQuestions ?? structure?.outline.length ?? 0, icon: Table2 },
    { label: "secciones visibles", value: xlsformIndex?.stats.nSections ?? Math.max((structure?.sections.size ?? 1) - 1, 0), icon: Layers3 },
    { label: "listas de opciones", value: xlsformIndex?.stats.nCatalogs ?? uniqueChoiceLists, icon: ListChecks },
    { label: "archivo en sesión", value: source?.original_name ? 1 : 0, icon: FileSpreadsheet },
  ] : [];

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
    setRestoreOffer(null);
    clearSnapshot(projectScope);
  }, [projectScope]);

  // Aceptar el snapshot ofrecido y restaurarlo como workbook actual.
  const acceptRestoreOffer = useCallback(() => {
    const snap = restoreOffer;
    if (!snap) return;
    loadWorkbook(
      snap.workbook,
      { kind: snap.sourceKind ?? null, original_name: snap.sourceName ?? null },
      "Restauramos el formulario que tenías abierto antes del cierre.",
    );
  }, [restoreOffer, loadWorkbook]);

  async function onImportXls(file?: File) {
    if (!file) return;
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
	  }) {
    const fileName = smImportDialog?.fileName ?? payload.source.original_name ?? "archivo";
    const refreshedRules = await refreshSurveyMonkeyAdvancedRules(
      payload.surveyMonkeyRules ?? [],
      payload.workbook,
      payload.surveyMonkeyChoiceOverrides ?? {},
    );
    const workbookWithLogic = workbookWithSurveyMonkeyLogic(
      payload.workbook,
      refreshedRules,
      payload.surveyMonkeyVisualRules ?? [],
      payload.surveyMonkeyChoiceOverrides ?? {},
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
	      const result = await apiXlsformEditorSmApplyLogic(
	        workbook,
	        reglasText,
	        {},
	        smLogicChoiceOverrides,
	        source?.original_name ?? "XLSForm actual",
	      );
	      const refreshedRules = await refreshSurveyMonkeyAdvancedRules(smLogicRules, result.workbook, smLogicChoiceOverrides);
	      const nextWorkbook = workbookWithSurveyMonkeyLogic(result.workbook, refreshedRules, smVisualLogicRules, smLogicChoiceOverrides);
	      setSmLogicRules(refreshedRules);
	      dispatch({ type: "SET", workbook: nextWorkbook });
	      setArtifact(null);
	      setSmLogicDialogOpen(false);
	      toasts.push({
	        kind: "success",
	        title: "Lógica SurveyMonkey aplicada",
	        detail: "Los saltos quedaron aplicados al XLSForm.",
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
  ) {
    setSmLogicRules(nextRules);
    setSmVisualLogicRules(nextVisualRules);
    setSmLogicChoiceOverrides(nextOverrides);
    if (!workbook) return;
    dispatch({ type: "SET", workbook: workbookWithSurveyMonkeyLogic(workbook, nextRules, nextVisualRules, nextOverrides) });
    setArtifact(null);
  }

  function updateSurveyMonkeyOverridesDraft(nextOverrides: Record<string, string[]>) {
    updateSurveyMonkeyLogicDraft(smLogicRules, smVisualLogicRules, nextOverrides);
  }

  function updateSurveyMonkeyVisualRulesDraft(nextVisualRules: SurveyMonkeyVisualLogicRule[]) {
    updateSurveyMonkeyLogicDraft(smLogicRules, nextVisualRules, smLogicChoiceOverrides);
  }

  function entregableStem(originalName: string): string {
    return originalName
      .replace(/\.(xlsx|pdf)$/i, "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/_{2,}/g, "_")
      .replace(/^_+|_+$/g, "");
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
      const out = await apiXlsformEditorExport(exportableWorkbook, cleanFilename(source?.original_name));
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
  function applyOutlineMove(plan: RowMovePlan) {
    if (!workbook) return;
    updateWorkbook((draft) => {
      applyRowMove(draft.survey, plan);
    });
    // Mover la selección al begin del bloque en su nueva posición — feedback
    // visual de que el item se mantuvo seleccionado.
    setSelection({ kind: "survey", rowIndex: plan.newStart });
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
  const selectedLogic = logicSummary(selectedNode);

  // Scope de lógica que el Inspector pasa al LogicBuilder. Variables son
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
        <div style={{ display: "inline-flex", flexWrap: "wrap", gap: 8 }}>
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
            <div style={{ display: "inline-flex", gap: 4 }}>
              <button
                type="button"
                onClick={() => dispatch({ type: "UNDO" })}
                disabled={!canUndo}
                title="Deshacer (⌘Z)"
                style={undoButtonStyle(canUndo)}
                aria-label="Deshacer último cambio"
              >
                ↶ Deshacer
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: "REDO" })}
                disabled={!canRedo}
                title="Rehacer (⇧⌘Z)"
                style={undoButtonStyle(canRedo)}
                aria-label="Rehacer cambio deshecho"
              >
                ↷ Rehacer
              </button>
            </div>
          )}
        </div>
      )}
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
          onImportXls={() => xlsInputRef.current?.click()}
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

      {/* Con workbook → barra de acciones rápidas + métricas. Los
          botones de la barra solo tienen sentido cuando hay un
          formulario abierto: Nuevo abre uno nuevo, Importar reemplaza
          el actual, Traducir SurveyMonkey importa de otra fuente,
          Exportar genera el .xlsx. */}
      {workbook && (
        <Panel
          title="Acciones del formulario"
          hint="Cambia, importa o exporta el formulario activo."
          actions={(
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={onNewWorkbook} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <IconNew size={14} /> Nuevo formulario
              </button>
              <button type="button" onClick={() => xlsInputRef.current?.click()} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Upload size={14} /> Importar XLSForm
              </button>
              <button type="button" onClick={onImportSurveyMonkey} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <img src={smMonkey} alt="" width={16} height={16} style={{ objectFit: "contain" }} /> Traducir SurveyMonkey
              </button>
              <button type="button" className="pulso-primary" onClick={onExport} disabled={!!busy} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Download size={14} /> Exportar .xlsx
              </button>
              <button type="button" onClick={onExportPdf} disabled={!!busy} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <FileText size={14} /> Exportar PDF
              </button>
            </div>
          )}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", color: "var(--pulso-text-soft)", fontSize: 13 }}>
            <Pill tone="info">{structure?.outline.length ?? 0} piezas</Pill>
            <Pill tone="info">{catalogs.length} catálogos</Pill>
            <Pill tone={diagnostics.some((item) => item.level === "warn") ? "warn" : "success"}>
              {diagnostics.filter((item) => item.level === "warn").length} advertencias
            </Pill>
          </div>
        </Panel>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <section
                  key={card.label}
                  className="pulso-card"
                  style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}
                >
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "var(--pulso-primary-soft)",
                      color: "var(--pulso-primary)",
                      border: "1px solid var(--pulso-primary-border)",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={16} />
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <strong style={{ fontSize: 24, lineHeight: 1 }}>{card.value}</strong>
                    <span style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>{card.label}</span>
                  </div>
                </section>
              );
            })}
          </div>

          {/* Antes acá iba `BuilderToolsDeck` con catálogos + diagnostics +
              índice en una grilla de 3 columnas que competía por ancho con
              el constructor. En el revamp Sub-PR 4b:
                - Catálogos → botón "Catálogos" en este header → ContextLens.
                - Diagnostics → ícono colapsable (DiagnosticsBadge) en este
                  header → popover floating al click.
                - Índice → CollapsibleSection abajo, no en columna lateral. */}

          <Panel
            title="Espacio de construcción"
            hint={
              editorMode === "sheets"
                ? "Vista de hojas — edita celdas crudas del XLSForm. Los cambios se reflejan en el constructor automáticamente."
                : status ||
                  "Trabaja en modo Constructor para diseñar el formulario. La vista por hojas queda como recurso técnico secundario."
            }
            actions={
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
            }
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
            <div
              className="pulso-builder-grid"
              style={{
                display: "grid",
                /* Outline 290px (cabe `informante_nombre` en una línea)
                   + centro flex + inspector 340px (cabe el panel sin
                   apretar el toggle de "Avanzado"). Gap 14px. El centro
                   tiene min-width 0 para que sus tarjetas se redimensionen
                   en viewports angostos sin desbordar. */
                gridTemplateColumns: "290px minmax(0, 1fr) 340px",
                gap: 14,
                alignItems: "start",
              }}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Panel
                    title="Estructura del formulario"
                    hint="Navega por secciones y preguntas. Este panel manda el foco del constructor."
                    actions={(
                      <div style={{ position: "relative" }}>
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
                    )}
                  >
                    <SurveyOutline
                      structure={structure}
                      selection={selection}
                      onSelect={setSelection}
                      onMoveUp={() => moveSelection("up")}
                      onMoveDown={() => moveSelection("down")}
                      canMoveUp={!!movement.prevRow}
                      canMoveDown={!!movement.nextRow}
                      onApplyMove={applyOutlineMove}
                    />
                  </Panel>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* BuilderHero solo cuando estamos en Settings y hay
                      contenido editable. Si el form recién se creó (vacío),
                      el hero es ruido — el lienzo ya muestra el empty state
                      grande con su CTA. */}
                  {selection?.kind === "settings" && hasEditableContent && (
                    <BuilderHero
                      selection={selection}
                      node={selectedNode}
                      section={selectedSection}
                      settingsRecord={settingsRecord}
                    />
                  )}

                  <Panel
                    title={
                      selection?.kind === "settings"
                        ? "Vista del formulario"
                        : "Tu formulario"
                    }
                    hint={
                      selection?.kind === "settings"
                        ? "Aquí se resume la identidad del formulario antes de entrar al detalle."
                        : "Haz clic en una pregunta para editarla. Los botones + entre tarjetas agregan preguntas o secciones nuevas."
                    }
                  >
                    {/* Si la selección es settings PERO el workbook está
                        completamente vacío (recién creado, sin secciones),
                        priorizamos el lienzo con su empty state — el
                        usuario quiere armar preguntas, no configurar la
                        identidad del archivo. */}
                    {selection?.kind === "settings" && hasEditableContent ? (
                      <SettingsCanvas settingsRecord={settingsRecord} />
                    ) : workbook && structure ? (
                      <FormCanvas
                        workbook={workbook}
                        structure={structure}
                        selectedRow={selection?.kind === "survey" ? selection.rowIndex : null}
                        catalogUsage={catalogUsage}
                        questionsByCatalog={questionsByCatalog}
                        onSelect={(rowIndex) => setSelection({ kind: "survey", rowIndex })}
                        onLabelChange={(rowIndex, value) => updateSurveyField(rowIndex, "label", value)}
                        onHintChange={(rowIndex, value) => updateSurveyField(rowIndex, "hint", value)}
                        onSectionLabelChange={(rowIndex, value) => updateSurveyField(rowIndex, "label", value)}
                        onChoiceLabelChange={(_listName, choiceRow, value) => updateChoice(choiceRow, "label", value)}
                        onChoiceNameChange={(_listName, choiceRow, value) => updateChoice(choiceRow, "name", value)}
                        onAddChoice={(listName) => addCatalogChoice(listName)}
                        onRemoveChoice={(_listName, choiceRow) => removeChoice(choiceRow)}
                        onRenameList={(oldListName, nextListName) => renameCatalog(oldListName, nextListName)}
                        onCloneCatalog={(questionRowIndex) => cloneCatalogForQuestion(questionRowIndex)}
                        onAddAfter={handleAddAfter}
                        existingLists={existingListsForAdd}
                        onOpenCatalogLens={(listName) => {
                          if (listName) setCatalogFocus(listName);
                          setCatalogsLensOpen(true);
                        }}
                      />
                    ) : (
                      <EmptyState
                        icon={<IconHint size={18} />}
                        title="Selecciona un elemento"
                        hint="Elige una sección o una pregunta para empezar a construirla."
                        variant="inline"
                      />
                    )}
                  </Panel>

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

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Panel
                    title={
                      selection?.kind === "settings"
                        ? "Ajustes del formulario"
                        : selection?.kind === "survey"
                          ? "Detalles de la pregunta"
                          : "Inspector"
                    }
                    hint={
                      selection?.kind === "settings"
                        ? "Título visible, identificador, versión y otros datos del archivo."
                        : selection?.kind === "survey"
                          ? "Configura el tipo, validación, lógica y catálogo. El texto de la pregunta y las opciones se editan directamente en el lienzo."
                          : "Selecciona una pregunta o sección en el lienzo para ver sus detalles aquí."
                    }
                    actions={
                      selection?.kind === "survey"
                        ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button type="button" className="pulso-icon" onClick={() => moveSelection("up")} disabled={!movement.prevRow} title="Mover arriba">
                              <ArrowUp size={14} />
                            </button>
                            <button type="button" className="pulso-icon" onClick={() => moveSelection("down")} disabled={!movement.nextRow} title="Mover abajo">
                              <ArrowDown size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={deleteCurrentSelection}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                color: "var(--pulso-danger-fg)",
                                borderColor: "var(--pulso-danger-border)",
                                background: "var(--pulso-danger-bg)",
                              }}
                            >
                              <Trash2 size={14} /> Eliminar
                            </button>
                          </div>
                        )
                        : undefined
                    }
                  >
                    {selection?.kind === "settings" ? (
                      <SettingsInspector
                        values={settingsRecord}
                        onChange={updateSettingsField}
                      />
                    ) : selectedNode ? (
                      <ContextPanel
                        node={selectedNode}
                        catalogs={catalogs}
                        logicScope={logicScope}
                        position={
                          structure
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
                        onSelectRow={(rowIndex) => setSelection({ kind: "survey", rowIndex })}
                        onFieldChange={(field, value) =>
                          updateSurveyField(selectedNode.rowIndex, field, value)
                        }
                        onTypeChange={(value) => updateQuestionType(selectedNode.rowIndex, value)}
                        onRequiredChange={(checked) =>
                          toggleRequired(selectedNode.rowIndex, checked)
                        }
                        onCatalogAssign={(listName) =>
                          assignCatalogToQuestion(selectedNode.rowIndex, listName)
                        }
                        onCatalogCreate={() => createCatalog(true)}
                        onOpenCatalogLens={(focusListName) => {
                          if (focusListName) setCatalogFocus(focusListName);
                          setCatalogsLensOpen(true);
                        }}
                        onCloneCatalog={() => cloneCatalogForQuestion(selectedNode.rowIndex)}
                      />
                    ) : (
                      <EmptyState
                        icon={<Settings2 size={18} />}
                        title="Sin selección activa"
                        hint="Haz click en una pieza del formulario para editarla desde acá."
                        variant="inline"
                      />
                    )}
                  </Panel>
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
	          rules={smLogicRules}
	          visualRules={smVisualLogicRules}
	          existingKoboLogic={extractExistingKoboLogic(workbook)}
	          overrides={smLogicChoiceOverrides}
	          busy={Boolean(busy)}
	          onRulesChange={(nextRules) => updateSurveyMonkeyLogicDraft(nextRules)}
	          onVisualRulesChange={updateSurveyMonkeyVisualRulesDraft}
	          onOverridesChange={updateSurveyMonkeyOverridesDraft}
	          onClose={() => setSmLogicDialogOpen(false)}
	          onApply={applySurveyMonkeyLogicFromEditor}
	        />
	      ) : null}

	      {questionnaireViewOpen ? (
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
      ) : null}

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
    <div
      style={{
        position: "absolute",
        right: 0,
        top: 38,
        width: 360,
        zIndex: 20,
        border: "1px solid var(--pulso-border)",
        borderRadius: 12,
        background: "white",
        boxShadow: "0 18px 44px rgba(15, 23, 42, 0.18)",
        padding: 8,
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 6,
      }}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => {
            item.action();
            onClose();
          }}
          style={{
            width: "100%",
            textAlign: "left",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid transparent",
            background: "transparent",
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              background: "var(--pulso-surface-2)",
              color: "var(--pulso-text-soft)",
              flexShrink: 0,
            }}
          >
            {item.icon}
          </span>
          <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <strong style={{ fontSize: 13 }}>{item.label}</strong>
            <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.45 }}>{item.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function IndexPanel({ index }: { index: XlsformIndex | null }) {
  if (!index) return null;
  const topDependents = Array.from(index.dependentsByName.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 4);

  return (
    <Panel
      title="Índice del instrumento"
      hint="Base interna para búsqueda, lógica visual, navegación y validaciones asistidas."
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        <IndexMetric label="Variables" value={index.variablesByName.size} />
        <IndexMetric label="Dependencias" value={index.stats.nDependencies} />
        <IndexMetric label="Referencias faltantes" value={index.stats.nMissingReferences} tone={index.stats.nMissingReferences ? "warn" : "success"} />
        <IndexMetric label="Catálogos usados" value={index.questionsByCatalog.size} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        <span className="pulso-section-eyebrow">Variables más usadas en lógica</span>
        {topDependents.length ? topDependents.map(([name, deps]) => (
          <div
            key={name}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              border: "1px solid var(--pulso-border)",
              borderRadius: 8,
              padding: "8px 10px",
              background: "var(--pulso-surface-2)",
            }}
          >
            <code style={{ fontSize: 12 }}>{name}</code>
            <Pill tone="info">{deps.length} usos</Pill>
          </div>
        )) : (
          <span style={{ fontSize: 12, color: "var(--pulso-text-soft)", lineHeight: 1.55 }}>
            Todavía no hay dependencias de lógica detectadas.
          </span>
        )}
      </div>
    </Panel>
  );
}

function IndexMetric({
  label,
  value,
  tone = "info",
}: {
  label: string;
  value: number;
  tone?: "info" | "warn" | "success";
}) {
  return (
    <div
      style={{
        border: "1px solid var(--pulso-border)",
        borderRadius: 8,
        padding: "10px 10px",
        background: tone === "warn" ? "var(--pulso-warn-bg)" : tone === "success" ? "var(--pulso-success-bg)" : "var(--pulso-surface-2)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <strong style={{ fontSize: 20, lineHeight: 1 }}>{value}</strong>
      <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>{label}</span>
    </div>
  );
}

function BuilderHero({
  selection,
  node,
  section,
  settingsRecord,
}: {
  selection: BuilderSelection | null;
  node: BuilderNode | null;
  section: SectionMeta | null;
  settingsRecord: Record<string, string> | null;
}) {
  const titleRaw = selection?.kind === "settings"
    ? (settingsRecord?.form_title || "Configuración del formulario")
    : (node?.label || "Selecciona un elemento");
  // El título se muestra renderizado (negritas/itálicas se ven), no
  // el markdown crudo. La capa técnica (asteriscos) vive en "Hojas".
  const titleHtml = renderMarkdownInline(titleRaw);
  const subtitle = selection?.kind === "settings"
    ? `ID ${settingsRecord?.form_id || "sin definir"} · versión ${settingsRecord?.version || "1"}`
    : node
      ? `${previewKindLabel(node)}${node.name ? ` · ${node.name}` : ""}${section && section.kind !== "root" ? ` · dentro de ${stripMarkdown(section.label)}` : ""}`
      : "Elige una pieza desde la estructura para editarla.";

  return (
    <section
      className="pulso-card"
      style={{
        padding: "22px 22px 18px",
        background:
          "linear-gradient(180deg, rgba(0,36,87,0.05) 0%, rgba(0,36,87,0.02) 100%), white",
        borderColor: "var(--pulso-primary-border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <span
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            background: "white",
            border: "1px solid var(--pulso-primary-border)",
            color: "var(--pulso-primary)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {selection?.kind === "settings" ? <Settings2 size={20} /> : <IconEditor size={20} />}
        </span>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 280, flex: 1 }}>
          <span className="pulso-section-eyebrow">
            {selection?.kind === "settings" ? "Identidad del formulario" : "Pieza activa"}
          </span>
          <h2
            style={{ margin: 0, fontSize: 28, lineHeight: 1.1, letterSpacing: -0.3, color: "var(--pulso-primary)" }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: titleHtml }}
          />
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--pulso-text-soft)", maxWidth: 860 }}>
            {subtitle}
          </p>
        </div>
      </div>
    </section>
  );
}

function SettingsCanvas({ settingsRecord }: { settingsRecord: Record<string, string> | null }) {
  const items = [
    { label: "Título visible", value: settingsRecord?.form_title || "Sin título" },
    { label: "ID interno", value: settingsRecord?.form_id || "Sin ID" },
    { label: "Versión", value: settingsRecord?.version || "1" },
    { label: "Idioma por defecto", value: settingsRecord?.default_language || "es" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
      {items.map((item) => (
        <article
          key={item.label}
          style={{
            border: "1px solid var(--pulso-border)",
            borderRadius: 12,
            padding: "14px 16px",
            background: "var(--pulso-surface-2)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <span className="pulso-section-eyebrow">{item.label}</span>
          <strong style={{ fontSize: 15, lineHeight: 1.4 }}>{item.value}</strong>
        </article>
      ))}
    </div>
  );
}

function SettingsInspector({
  values,
  onChange,
}: {
  values: Record<string, string> | null;
  onChange: (field: string, value: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <InspectorGroup title="Identidad visible">
        <Field label="Título del formulario">
          <input value={values?.form_title ?? ""} onChange={(e) => onChange("form_title", e.target.value)} />
        </Field>
        <Field label="ID interno">
          <input value={values?.form_id ?? ""} onChange={(e) => onChange("form_id", e.target.value)} />
        </Field>
      </InspectorGroup>

      <InspectorGroup title="Control de versión">
        <Field label="Versión">
          <input value={values?.version ?? ""} onChange={(e) => onChange("version", e.target.value)} />
        </Field>
        <Field label="Idioma por defecto">
          <input value={values?.default_language ?? "es"} onChange={(e) => onChange("default_language", e.target.value)} />
        </Field>
      </InspectorGroup>
    </div>
  );
}

function InspectorGroup({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span className="pulso-section-eyebrow">{title}</span>
        {actions}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--pulso-text-soft)" }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      {children}
    </label>
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

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "info" | "warn" | "success" }) {
  const colors = {
    neutral: ["var(--pulso-surface-2)", "var(--pulso-border)", "var(--pulso-text-soft)"],
    info: ["var(--pulso-info-bg)", "var(--pulso-info-border)", "var(--pulso-info-fg)"],
    warn: ["var(--pulso-warn-bg)", "var(--pulso-warn-border)", "var(--pulso-warn-fg)"],
    success: ["var(--pulso-success-bg)", "var(--pulso-success-border)", "var(--pulso-success-fg)"],
  }[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: 999,
        background: colors[0],
        border: `1px solid ${colors[1]}`,
        color: colors[2],
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {children}
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

/** Estilo del par de botones undo/redo en el header. */
function undoButtonStyle(enabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 700,
    border: "1px solid var(--pulso-border)",
    background: "white",
    color: enabled ? "var(--pulso-text)" : "var(--pulso-text-soft)",
    borderRadius: 6,
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.5,
  };
}

function SurveyMonkeyLogicPopup({
  workbook,
  rules,
  visualRules,
  existingKoboLogic,
  overrides,
  busy,
  onRulesChange,
  onVisualRulesChange,
  onOverridesChange,
  onClose,
  onApply,
}: {
  workbook: XlsformEditorWorkbook;
  rules: ConfirmedRule[];
  visualRules: SurveyMonkeyVisualLogicRule[];
  existingKoboLogic: Array<{ name: string; label: string; relevant: string }>;
  overrides: Record<string, string[]>;
  busy: boolean;
  onRulesChange: (rules: ConfirmedRule[]) => void;
  onVisualRulesChange: (rules: SurveyMonkeyVisualLogicRule[]) => void;
  onOverridesChange: (next: Record<string, string[]>) => void;
  onClose: () => void;
  onApply: () => void;
}) {
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
          <RuleWizard
            surveyId=""
            token=""
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
              <CheckCircle2 size={14} /> Aplicar al XLSForm
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
        gap: 12,
        padding: "12px 16px",
        borderRadius: 10,
        background: "var(--pulso-info-bg)",
        border: "1px solid var(--pulso-info-border)",
        color: "var(--pulso-text)",
        flexWrap: "wrap",
      }}
    >
      <IconHint size={16} color="var(--pulso-info-fg)" />
      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          Tenías un formulario abierto antes
        </div>
        <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
          {/* Defensivo: en localStorage viejo `sourceName` puede haber
              quedado como objeto en algún caso edge. Solo lo mostramos
              si es string no vacío. */}
          {typeof snapshot.sourceName === "string" && snapshot.sourceName
            ? `Archivo: ${snapshot.sourceName} · `
            : ""}
          Guardado automáticamente {formatRelativeTime(snapshot.savedAt)}.
        </div>
      </div>
      <button
        type="button"
        className="pulso-primary"
        onClick={onAccept}
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        <IconForward size={14} /> Continuar editando
      </button>
      <button
        type="button"
        onClick={onDismiss}
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        <Trash2 size={14} /> Empezar de cero
      </button>
    </div>
  );
}
