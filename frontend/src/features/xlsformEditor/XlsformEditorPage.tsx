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
  AlertTriangle,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  Columns3,
  Download,
  FileSpreadsheet,
  Filter,
  GitBranch,
  Hash,
  Layers3,
  ListChecks,
  Plus,
  Rows3,
  Settings2,
  Sparkles,
  Table2,
  Trash2,
  Type,
  Upload,
  Wand2,
} from "lucide-react";
import {
  apiUpload,
  apiXlsformEditorExport,
  apiXlsformEditorImport,
  apiXlsformEditorImportSurveyMonkey,
  downloadUrl,
} from "../../api/client";
import { Panel } from "../../components/Panel";
import { PageHeader } from "../../components/PageHeader";
import { EmptyState, ErrorBlock, LoadingBlock } from "../../components/States";

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
  CatalogSummary,
  ChoiceItem,
  EditorMode,
  SectionMeta,
  SheetKey,
  TypeInfo,
  XlsformDependency,
  XlsformEditorSheet,
  XlsformEditorWorkbook,
  XlsformIndex,
} from "./types";
import {
  cloneSheet,
  cloneWorkbook,
  createBlankWorkbook,
  deleteRow,
  ensureColumn,
  getSheet,
  insertRecord,
  makeColumnName,
  makeSheet,
  rowToRecord,
  setCell,
} from "./parsing/sheetUtils";
import {
  asRequired,
  buildSimpleCondition,
  buildType,
  cleanFilename,
  extractExpressionVariables,
  formatSource,
  parseSimpleCondition,
  parseType,
  sheetDescription,
  sheetTitle,
  slug,
  typeLabel,
} from "./parsing/parseType";
import {
  buildCatalogs,
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
} from "./state/persistence";
import EmptyHome from "./shell/EmptyHome";
import { ToastDeck, useToastDeck } from "./shell/ToastDeck";
import { DiagnosticsBadge } from "./shell/DiagnosticsPopover";
import { CollapsibleSection } from "./shell/CollapsibleSection";
import CatalogsContextLens from "./catalogs/CatalogsContextLens";
import { SurveyOutline } from "./outline/SurveyOutline";
import type { RowMovePlan } from "./outline/outlineUtils";
import { applyRowMove } from "./outline/outlineUtils";
import { PreviewCanvas } from "./canvas/PreviewCanvas";

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

function logicSummary(node: BuilderNode | null) {
  if (!node) return [];
  const blocks: Array<{ title: string; text: string; icon: ReactNode }> = [];
  if (node.relevant) blocks.push({ title: "Cuándo se muestra", text: node.relevant, icon: <GitBranch size={14} /> });
  if (node.constraint) blocks.push({ title: "Qué valida", text: node.constraint, icon: <CheckCircle2 size={14} /> });
  if (node.choiceFilter) blocks.push({ title: "Cómo filtra opciones", text: node.choiceFilter, icon: <Filter size={14} /> });
  if (node.calculation) blocks.push({ title: "Cómo se calcula", text: node.calculation, icon: <Hash size={14} /> });
  return blocks;
}


export default function XlsformEditorPage() {
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

  const [mode, setMode] = useState<EditorMode>("builder");
  const [advancedSheet, setAdvancedSheet] = useState<SheetKey>("survey");
  const [selection, setSelection] = useState<BuilderSelection | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Todavía no hay un formulario abierto.");
  const [artifact, setArtifact] = useState<{ file_id: string; original_name: string } | null>(null);
  const [source, setSource] = useState<{ kind: string | null; original_name: string | null } | null>(null);
  const [catalogFocus, setCatalogFocus] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  /** Si está abierto el ContextLens de catálogos. Click en el botón
   *  "Catálogos" del header del constructor lo abre; el lens lo cierra. */
  const [catalogsLensOpen, setCatalogsLensOpen] = useState(false);
  /** Snapshot del autosave detectado al montar; muestra UI de "continuar". */
  const [restoreOffer, setRestoreOffer] = useState<ReturnType<typeof loadSnapshot>>(null);
  const xlsInputRef = useRef<HTMLInputElement | null>(null);
  const smInputRef = useRef<HTMLInputElement | null>(null);
  // Notificaciones efímeras (importé X, exporté Y) — reemplazan al setStatus
  // sticky para mensajes de operaciones que cierran su ciclo en un evento.
  const toasts = useToastDeck();

  // Scheduler de autosave a sessionStorage. Se crea una sola vez por
  // montaje del componente; se reusa entre cambios.
  const persistenceRef = useRef<ReturnType<typeof createPersistenceScheduler> | null>(null);
  if (persistenceRef.current === null) {
    persistenceRef.current = createPersistenceScheduler((savedAt) => {
      dispatch({ type: "MARK_SAVED", savedAt });
    }, 2000);
  }
  const persistence = persistenceRef.current;

  // Detectar al montar si hay un snapshot persistido en sessionStorage
  // (tras crash/reload). Lo ofrecemos como "Continuar editando" si el
  // estado actual aún está vacío.
  useEffect(() => {
    const snap = loadSnapshot();
    if (snap) setRestoreOffer(snap);
    // Solo en mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Programar autosave después de cada edición. El scheduler debouncea 2s
  // — si el usuario sigue editando, se posterga; si se queda quieto, escribe.
  useEffect(() => {
    if (!workbook) return;
    if (!dirty) return;
    persistence.schedule(workbook, {
      sourceKind: source?.kind ?? null,
      sourceName: source?.original_name ?? null,
    });
  }, [workbook, dirty, source, persistence]);

  // Atajos de teclado para undo/redo (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Ctrl+Y).
  // Se ignora si el foco está en un input/textarea/contentEditable.
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
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
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

  const visibleTabs = useMemo<SheetKey[]>(() => {
    if (!workbook) return [];
    return workbook.diagnostico
      ? ["survey", "choices", "settings", "diagnostico"]
      : ["survey", "choices", "settings"];
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

  useEffect(() => {
    if (!visibleTabs.includes(advancedSheet)) setAdvancedSheet("survey");
  }, [advancedSheet, visibleTabs]);

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
  const activeCatalogName = selectedTypeInfo?.listName || catalogFocus || catalogs[0]?.listName || null;
  const activeCatalog = catalogs.find((catalog) => catalog.listName === activeCatalogName) ?? null;
  const diagnostics = useMemo(
    () => buildDiagnostics(workbook, xlsformIndex),
    [workbook, xlsformIndex]
  );
  const movement = selection?.kind === "survey"
    ? getSiblingRows(structure, selection.rowIndex)
    : { prevRow: null as number | null, nextRow: null as number | null };

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
      dispatch({ type: "LOAD", workbook: cloneWorkbook(next) });
      setSource(nextSource);
      setArtifact(null);
      setMode("builder");
      setAdvancedSheet("survey");
      setStatus(nextStatus);
      setRestoreOffer(null);
      // El usuario confirmó qué workbook quiere → limpiamos snapshot viejo.
      clearSnapshot();
    },
    [persistence],
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

  // Descartar el snapshot ofrecido al montar y empezar de cero.
  const dismissRestoreOffer = useCallback(() => {
    setRestoreOffer(null);
    clearSnapshot();
  }, []);

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

  async function onImportSurveyMonkey(file?: File) {
    if (!file) return;
    resetMessages();
    setBusy(`Traduciendo ${file.name} desde SurveyMonkey…`);
    try {
      const up = await apiUpload(file, "sav");
      const out = await apiXlsformEditorImportSurveyMonkey(up.file_id, "es");
      loadWorkbook(
        out.workbook,
        out.source,
        `Tradujimos ${file.name} a un constructor editable. Ahora ya puedes pulirlo sin pensar en la sintaxis ODK.`
      );
      toasts.push({
        kind: "success",
        title: "Traducción completada",
        detail: `${file.name} ahora es un XLSForm editable.`,
      });
    } catch (e: unknown) {
      const msg = (e as Error).message;
      setError(msg);
      toasts.push({ kind: "danger", title: "No se pudo traducir", detail: msg });
    } finally {
      setBusy("");
      if (smInputRef.current) smInputRef.current.value = "";
    }
  }

  async function onExport() {
    if (!workbook) return;
    resetMessages();
    setBusy("Exportando XLSForm…");
    try {
      const out = await apiXlsformEditorExport(workbook, cleanFilename(source?.original_name));
      setArtifact({ file_id: out.file_id, original_name: out.original_name });
      // Tras un export exitoso el workbook está "guardado" (en disco).
      // Forzamos el flush del autosave también para sellar el snapshot
      // local con el mismo timestamp.
      const savedAt = persistence.flush() ?? Date.now();
      dispatch({ type: "MARK_SAVED", savedAt });
      setStatus(`Listo: generamos ${out.original_name} para descargarlo o seguir iterándolo.`);
      toasts.push({
        kind: "success",
        title: "Exportación lista",
        detail: out.original_name,
        durationMs: 6000,
        action: {
          label: "Descargar",
          onClick: () => {
            window.open(downloadUrl(out.file_id), "_blank");
          },
        },
      });
    } catch (e: unknown) {
      const msg = (e as Error).message;
      setError(msg);
      toasts.push({ kind: "danger", title: "No se pudo exportar", detail: msg });
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

  function updateSurveyField(rowIndex: number, field: string, value: string) {
    updateWorkbook((draft) => {
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

  function addQuestion(nextBaseType = "text") {
    if (!workbook) return;
    const insertionIndex = resolveInsertionIndex(structure, selection, workbook.survey);
    const nextName = `pregunta_${workbook.survey.rows.length + 1}`;
    const isSelect = nextBaseType === "select_one" || nextBaseType === "select_multiple";
    const listName = isSelect ? (activeCatalogName || `cat_${nextName}`) : "";
    updateWorkbook((draft) => {
      if (isSelect && !catalogs.some((catalog) => catalog.listName === listName)) {
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

  function addSection() {
    if (!workbook) return;
    const insertionIndex = resolveInsertionIndex(structure, selection, workbook.survey);
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
    const question = currentNode.kind === "section" || currentNode.kind === "repeat"
      ? "esta sección"
      : "este elemento";
    if (!window.confirm(`¿Eliminar ${question} del formulario?`)) return;

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
    setSelection(nextRow != null ? { kind: "survey", rowIndex: nextRow } : { kind: "settings" });
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

  function updateAdvancedCell(sheetKey: SheetKey, rowIndex: number, colIndex: number, value: string) {
    updateWorkbook((draft) => {
      const sheet = getSheet(draft, sheetKey);
      if (!sheet) return;
      while (sheet.rows.length <= rowIndex) {
        sheet.rows.push(new Array(sheet.columns.length).fill(""));
      }
      const row = [...(sheet.rows[rowIndex] ?? new Array(sheet.columns.length).fill(""))];
      while (row.length < sheet.columns.length) row.push("");
      row[colIndex] = value;
      sheet.rows[rowIndex] = row;
    });
  }

  function updateAdvancedColumnName(sheetKey: SheetKey, colIndex: number, value: string) {
    updateWorkbook((draft) => {
      const sheet = getSheet(draft, sheetKey);
      if (!sheet) return;
      sheet.columns[colIndex] = value;
    });
  }

  function addAdvancedRow(sheetKey: SheetKey) {
    updateWorkbook((draft) => {
      const sheet = getSheet(draft, sheetKey);
      if (!sheet) return;
      sheet.rows.push(new Array(sheet.columns.length).fill(""));
    });
  }

  function removeAdvancedRow(sheetKey: SheetKey, rowIndex: number) {
    updateWorkbook((draft) => {
      const sheet = getSheet(draft, sheetKey);
      if (!sheet) return;
      deleteRow(sheet, rowIndex);
    });
  }

  function addAdvancedColumn(sheetKey: SheetKey) {
    updateWorkbook((draft) => {
      const sheet = getSheet(draft, sheetKey);
      if (!sheet) return;
      sheet.columns.push(makeColumnName(sheet));
      sheet.rows = sheet.rows.map((row) => [...row, ""]);
    });
  }

  function removeAdvancedColumn(sheetKey: SheetKey, colIndex: number) {
    updateWorkbook((draft) => {
      const sheet = getSheet(draft, sheetKey);
      if (!sheet) return;
      sheet.columns.splice(colIndex, 1);
      sheet.rows = sheet.rows.map((row) => row.filter((_, idx) => idx !== colIndex));
    });
  }

  const settingsRecord = workbook ? rowToRecord(workbook.settings, 0) : null;
  const activeAdvancedSheet = workbook ? getSheet(workbook, advancedSheet) : null;
  const selectedLogic = logicSummary(selectedNode);
  const logicSources = useMemo(
    () => (structure?.outline ?? [])
      .filter((entry) => entry.name && selectedNode?.rowIndex !== entry.rowIndex && entry.kind !== "section" && entry.kind !== "repeat")
      .map((entry) => ({
        name: entry.name,
        label: entry.label,
        type: entry.typeInfo.base,
      })),
    [selectedNode?.rowIndex, structure]
  );
  const addMenuItems: AddMenuItem[] = [
    {
      key: "section",
      label: "Sección",
      hint: "Agrupa preguntas y puede tener una condición propia.",
      icon: <Layers3 size={16} />,
      action: addSection,
    },
    {
      key: "text",
      label: "Pregunta abierta",
      hint: "Texto libre para respuestas cortas o comentarios.",
      icon: <Type size={16} />,
      action: () => addQuestion("text"),
    },
    {
      key: "select_one",
      label: "Selección única",
      hint: "Una sola respuesta usando un catálogo de opciones.",
      icon: <ListChecks size={16} />,
      action: () => addQuestion("select_one"),
    },
    {
      key: "select_multiple",
      label: "Selección múltiple",
      hint: "Varias respuestas usando un catálogo reutilizable.",
      icon: <CheckCircle2 size={16} />,
      action: () => addQuestion("select_multiple"),
    },
    {
      key: "integer",
      label: "Número entero",
      hint: "Edad, cantidades, puntajes u otros valores sin decimales.",
      icon: <Hash size={16} />,
      action: () => addQuestion("integer"),
    },
    {
      key: "decimal",
      label: "Número decimal",
      hint: "Montos, proporciones o medidas con decimales.",
      icon: <Hash size={16} />,
      action: () => addQuestion("decimal"),
    },
    {
      key: "date",
      label: "Fecha",
      hint: "Fechas de atención, nacimiento, visita o eventos.",
      icon: <Rows3 size={16} />,
      action: () => addQuestion("date"),
    },
    {
      key: "note",
      label: "Texto informativo",
      hint: "Instrucciones o mensajes que no guardan respuesta.",
      icon: <FileSpreadsheet size={16} />,
      action: () => addQuestion("note"),
    },
    {
      key: "calculate",
      label: "Cálculo",
      hint: "Variable automática basada en otras respuestas.",
      icon: <Settings2 size={16} />,
      action: () => addQuestion("calculate"),
    },
  ];

  return (
    <div style={{ maxWidth: 1440, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        title="Constructor de XLSForms"
        lead="Diseña formularios con una interfaz guiada y deja la sintaxis XLSForm/ODK como capa técnica. La vista por hojas sigue disponible, pero ya no manda la experiencia."
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
      />

      {restoreOffer && !workbook && (
        <RestoreOfferBanner
          snapshot={restoreOffer}
          onAccept={acceptRestoreOffer}
          onDismiss={dismissRestoreOffer}
        />
      )}

      {error && <ErrorBlock label="No pudimos abrir el constructor" detail={error} />}

      <Panel
        title="Entradas y salidas"
        hint="La idea es trabajar desde un constructor visual. XLSForm y ODK siguen siendo el motor, pero ya no son la interfaz principal."
        actions={(
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={onNewWorkbook} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={14} /> Nuevo formulario
            </button>
            <button type="button" onClick={() => xlsInputRef.current?.click()} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Upload size={14} /> Importar XLSForm
            </button>
            <button type="button" onClick={() => smInputRef.current?.click()} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Wand2 size={14} /> Traducir SurveyMonkey
            </button>
            <button type="button" className="pulso-primary" onClick={onExport} disabled={!workbook || !!busy} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Download size={14} /> Exportar .xlsx
            </button>
          </div>
        )}
      >
        <input
          ref={xlsInputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: "none" }}
          onChange={(e) => void onImportXls(e.target.files?.[0])}
        />
        <input
          ref={smInputRef}
          type="file"
          accept=".sav"
          style={{ display: "none" }}
          onChange={(e) => void onImportSurveyMonkey(e.target.files?.[0])}
        />

        {!workbook ? (
          <EmptyHome
            onNewBlank={onNewWorkbook}
            onImportXls={() => xlsInputRef.current?.click()}
            onImportSurveyMonkey={() => smInputRef.current?.click()}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", color: "var(--pulso-text-soft)", fontSize: 13 }}>
            <Pill tone="info">{structure?.outline.length ?? 0} piezas</Pill>
            <Pill tone="info">{catalogs.length} catálogos</Pill>
            <Pill tone={diagnostics.some((item) => item.level === "warn") ? "warn" : "success"}>
              {diagnostics.filter((item) => item.level === "warn").length} advertencias
            </Pill>
            <span>Las herramientas principales del constructor están justo debajo, junto al formulario activo.</span>
          </div>
        )}
      </Panel>

      {busy && (
        <Panel title="Procesando" hint={busy}>
          <LoadingBlock label={busy} variant="inline" minHeight={88} />
        </Panel>
      )}

      {!workbook && !busy && (
        <Panel noPadding>
          <EmptyState
            icon={<Layers3 size={20} />}
            title="Todavía no hay un constructor abierto"
            hint="Empieza con una base limpia, trae un XLSForm ya existente o usa el botón del traductor de SurveyMonkey para aterrizarlo aquí."
            cta={(
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                <button type="button" className="pulso-primary" onClick={onNewWorkbook}>Crear formulario</button>
                <button type="button" onClick={() => xlsInputRef.current?.click()}>Importar .xlsx</button>
                <button type="button" onClick={() => smInputRef.current?.click()}>Traducir .sav</button>
              </div>
            )}
          />
        </Panel>
      )}

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
            hint={status || "Trabaja en modo Constructor para diseñar el formulario. La vista por hojas queda como recurso técnico secundario."}
            actions={
              mode === "builder" ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setCatalogsLensOpen(true)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    title="Editar listas de opciones"
                  >
                    <ListChecks size={14} />
                    Catálogos
                    {catalogs.length > 0 && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: 18,
                          height: 16,
                          padding: "0 5px",
                          fontSize: 10,
                          fontWeight: 800,
                          background: "var(--pulso-primary-soft)",
                          color: "var(--pulso-primary)",
                          borderRadius: 999,
                        }}
                      >
                        {catalogs.length}
                      </span>
                    )}
                  </button>
                  <DiagnosticsBadge
                    diagnostics={diagnostics}
                    selection={selection}
                    onSelectRow={(rowIndex) => setSelection({ kind: "survey", rowIndex })}
                    onFocusCatalog={(name) => {
                      setCatalogFocus(name);
                      setCatalogsLensOpen(true);
                    }}
                  />
                  <ModeSwitch value={mode} onChange={setMode} />
                </div>
              ) : (
                <ModeSwitch value={mode} onChange={setMode} />
              )
            }
          >
            {mode === "builder" ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "280px minmax(0, 1fr) 340px",
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
                  <BuilderHero
                    selection={selection}
                    node={selectedNode}
                    section={selectedSection}
                    settingsRecord={settingsRecord}
                  />

                  <Panel
                    title={selection?.kind === "settings" ? "Vista del formulario" : "Vista de construcción"}
                    hint={
                      selection?.kind === "settings"
                        ? "Aquí se resume la identidad del formulario antes de entrar al detalle."
                        : "La idea es que entiendas el comportamiento de esta pieza sin leer sintaxis ODK."
                    }
                  >
                    {selection?.kind === "settings" ? (
                      <SettingsCanvas settingsRecord={settingsRecord} />
                    ) : selectedNode && structure ? (
                      <PreviewCanvas
                        node={selectedNode}
                        structure={structure}
                        choices={selectedChoices}
                        logicBlocks={selectedLogic}
                        onSelectByRow={(target) =>
                          target === "settings"
                            ? setSelection({ kind: "settings" })
                            : setSelection({ kind: "survey", rowIndex: target })
                        }
                        onMoveUp={() => moveSelection("up")}
                        onMoveDown={() => moveSelection("down")}
                        onDelete={deleteCurrentSelection}
                        canMoveUp={!!movement.prevRow}
                        canMoveDown={!!movement.nextRow}
                      />
                    ) : (
                      <EmptyState
                        icon={<Sparkles size={18} />}
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
                        <a
                          href={downloadUrl(artifact.file_id)}
                          download={artifact.original_name}
                          style={{
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 12px",
                            borderRadius: 6,
                            fontSize: 13,
                            background: "var(--pulso-primary)",
                            border: "1px solid var(--pulso-primary)",
                            color: "#fff",
                          }}
                        >
                          <Download size={14} /> Descargar export
                        </a>
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
                    title="Inspector"
                    hint="Aquí editas la pieza activa con lenguaje más cercano a la construcción del formulario que a la hoja de cálculo."
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
                      <QuestionInspector
                        node={selectedNode}
                        catalogs={catalogs}
                        activeCatalogName={activeCatalogName}
                        choiceItems={selectedChoices}
                        onFieldChange={(field, value) => updateSurveyField(selectedNode.rowIndex, field, value)}
                        onTypeChange={(value) => updateQuestionType(selectedNode.rowIndex, value)}
                        onRequiredChange={(checked) => toggleRequired(selectedNode.rowIndex, checked)}
                        onSectionKindChange={(value) => updateSectionKind(selectedNode.rowIndex, value)}
                        logicSources={logicSources}
                        onCatalogAssign={(listName) => assignCatalogToQuestion(selectedNode.rowIndex, listName)}
                        onCatalogCreate={() => createCatalog(true)}
                        onCatalogRename={(listName, nextName) => renameCatalog(listName, nextName)}
                        onAddChoice={addChoice}
                        onChoiceChange={updateChoice}
                        onChoiceRemove={removeChoice}
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
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {visibleTabs.map((tab) => {
                    const sheet = getSheet(workbook, tab) ?? makeSheet(tab, []);
                    const selected = advancedSheet === tab;
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setAdvancedSheet(tab)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 12px",
                          borderRadius: 999,
                          border: selected ? "1px solid var(--pulso-primary)" : "1px solid var(--pulso-border)",
                          background: selected ? "var(--pulso-primary-soft)" : "var(--pulso-surface)",
                          color: selected ? "var(--pulso-primary)" : "var(--pulso-text)",
                          fontWeight: selected ? 700 : 600,
                        }}
                      >
                        {sheetTitle(tab)}
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: "rgba(255,255,255,0.78)",
                            border: "1px solid var(--pulso-border)",
                            fontSize: 11,
                            color: "var(--pulso-text-soft)",
                          }}
                        >
                          {sheet.rows.length}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <Panel
                  title={sheetTitle(advancedSheet)}
                  hint={sheetDescription(advancedSheet)}
                  actions={activeAdvancedSheet && advancedSheet !== "diagnostico" ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => addAdvancedColumn(advancedSheet)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Columns3 size={14} /> Añadir columna
                      </button>
                      <button type="button" onClick={() => addAdvancedRow(advancedSheet)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Rows3 size={14} /> Añadir fila
                      </button>
                    </div>
                  ) : undefined}
                >
                  {activeAdvancedSheet ? (
                    <SheetEditor
                      sheet={activeAdvancedSheet}
                      editable={advancedSheet !== "diagnostico"}
                      onCellChange={(rowIndex, colIndex, value) => updateAdvancedCell(advancedSheet, rowIndex, colIndex, value)}
                      onColumnNameChange={(colIndex, value) => updateAdvancedColumnName(advancedSheet, colIndex, value)}
                      onColumnRemove={(colIndex) => removeAdvancedColumn(advancedSheet, colIndex)}
                      onRowRemove={(rowIndex) => removeAdvancedRow(advancedSheet, rowIndex)}
                    />
                  ) : (
                    <EmptyState
                      icon={<Table2 size={18} />}
                      title="Esta hoja no está disponible"
                      hint="Aparecerá automáticamente cuando el import o el traductor la genere."
                      variant="inline"
                    />
                  )}
                </Panel>
              </div>
            )}
          </Panel>

          {/* Índice del instrumento — sección colapsable secundaria que NO
              compite por ancho con el constructor. Se abre on-demand cuando
              el usuario quiere ver dependencias entre preguntas y catálogos. */}
          {mode === "builder" && xlsformIndex && (
            <CollapsibleSection
              title="Índice del instrumento"
              hint={`${xlsformIndex.stats.nQuestions} preguntas · ${xlsformIndex.stats.nDependencies} dependencias detectadas`}
              icon={<Layers3 size={14} />}
              count={xlsformIndex.stats.nMissingReferences || undefined}
              defaultOpen={false}
            >
              <IndexPanel index={xlsformIndex} />
            </CollapsibleSection>
          )}
        </>
      )}

      {/* ContextLens del editor de catálogos — se abre desde el header del
          constructor o cuando un diagnostic apunta a un catálogo. */}
      <CatalogsContextLens
        open={catalogsLensOpen}
        onClose={() => setCatalogsLensOpen(false)}
        catalogsCount={catalogs.length}
        onCreate={() => createCatalog(false)}
        library={(
          <CatalogLibrary
            catalogs={catalogs}
            activeCatalogName={activeCatalogName}
            onFocus={setCatalogFocus}
          />
        )}
        workspace={(
          <CatalogWorkspace
            catalog={activeCatalog}
            onRename={renameCatalog}
            onAddChoice={addCatalogChoice}
            onChoiceChange={updateChoice}
            onChoiceRemove={removeChoice}
          />
        )}
      />

      {/* Toasts deslizables: mensajes efímeros de operaciones (import/export).
          El deck se monta una sola vez y se mantiene a nivel del editor —
          fuera del flujo Panel para que los toasts queden anclados a la
          esquina inferior-derecha sin romper el layout. */}
      <ToastDeck items={toasts.items} onDismiss={toasts.dismiss} />
    </div>
  );
}

function ModeSwitch({
  value,
  onChange,
}: {
  value: EditorMode;
  onChange: (value: EditorMode) => void;
}) {
  return (
    <div style={{ display: "inline-flex", gap: 6, padding: 4, borderRadius: 999, background: "var(--pulso-surface-2)", border: "1px solid var(--pulso-border)" }}>
      <button
        type="button"
        onClick={() => onChange("builder")}
        style={segmentedButtonStyle(value === "builder")}
      >
        <Sparkles size={14} /> Constructor
      </button>
      <button
        type="button"
        onClick={() => onChange("advanced")}
        style={segmentedButtonStyle(value === "advanced")}
      >
        <Table2 size={14} /> Modo avanzado
      </button>
    </div>
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
          <span style={sidebarIconBox(false)}>{item.icon}</span>
          <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <strong style={{ fontSize: 13 }}>{item.label}</strong>
            <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.45 }}>{item.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function BuilderToolsDeck({
  index,
  catalogs,
  activeCatalog,
  activeCatalogName,
  diagnostics,
  selection,
  onCreateCatalog,
  onFocusCatalog,
  onRenameCatalog,
  onAddCatalogChoice,
  onChoiceChange,
  onChoiceRemove,
  onSelectRow,
}: {
  index: XlsformIndex | null;
  catalogs: CatalogSummary[];
  activeCatalog: CatalogSummary | null;
  activeCatalogName: string | null;
  diagnostics: BuilderDiagnostic[];
  selection: BuilderSelection | null;
  onCreateCatalog: () => void;
  onFocusCatalog: (listName: string) => void;
  onRenameCatalog: (currentListName: string, nextListName: string) => void;
  onAddCatalogChoice: (listName: string) => void;
  onChoiceChange: (rowIndex: number, field: "name" | "label", value: string) => void;
  onChoiceRemove: (rowIndex: number) => void;
  onSelectRow: (rowIndex: number) => void;
}) {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: 12,
        alignItems: "start",
      }}
    >
      <Panel
        title="Catálogos de opciones"
        hint="Define listas reutilizables y conéctalas a preguntas cerradas desde el inspector."
        actions={(
          <button type="button" onClick={onCreateCatalog} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Nuevo catálogo
          </button>
        )}
      >
        <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 0.8fr) minmax(220px, 1.2fr)", gap: 12, alignItems: "start" }}>
          <CatalogLibrary
            catalogs={catalogs}
            activeCatalogName={activeCatalogName}
            onFocus={onFocusCatalog}
          />
          <CatalogWorkspace
            catalog={activeCatalog}
            onRename={onRenameCatalog}
            onAddChoice={onAddCatalogChoice}
            onChoiceChange={onChoiceChange}
            onChoiceRemove={onChoiceRemove}
          />
        </div>
      </Panel>

      <Panel
        title="Sugerencias y advertencias"
        hint="El constructor marca problemas frecuentes y te lleva al lugar que necesita revisión."
      >
        <DiagnosticsPanel
          diagnostics={diagnostics}
          selection={selection}
          onSelectRow={onSelectRow}
          onFocusCatalog={onFocusCatalog}
        />
      </Panel>

      <IndexPanel index={index} />
    </section>
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

function segmentedButtonStyle(active: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    border: active ? "1px solid var(--pulso-primary)" : "1px solid transparent",
    background: active ? "white" : "transparent",
    color: active ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
    fontWeight: active ? 700 : 600,
    padding: "7px 12px",
  };
}

function BuilderSidebar({
  structure,
  selection,
  onSelect,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  structure: BuilderStructure | null;
  selection: BuilderSelection | null;
  onSelect: (value: BuilderSelection) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  if (!structure || !structure.outline.length) {
    return (
      <EmptyState
        icon={<Layers3 size={18} />}
        title="Todavía no hay piezas en el formulario"
        hint="Añade una sección o una pregunta para empezar a construir."
        variant="inline"
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 780, overflow: "auto", paddingRight: 4 }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect({ kind: "settings" })}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onSelect({ kind: "settings" });
        }}
        style={sidebarItemStyle(selection?.kind === "settings", 0)}
      >
        <span style={sidebarIconBox(selection?.kind === "settings")}><Settings2 size={14} /></span>
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
          <strong style={{ fontSize: 13 }}>Ajustes del formulario</strong>
          <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>Título, ID y versión</span>
        </span>
      </div>

      {structure.outline.map((node) => {
        const active = selection?.kind === "survey" && selection.rowIndex === node.rowIndex;
        return (
          <div
            key={node.rowIndex}
            role="button"
            tabIndex={0}
            onClick={() => onSelect({ kind: "survey", rowIndex: node.rowIndex })}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onSelect({ kind: "survey", rowIndex: node.rowIndex });
            }}
            style={sidebarItemStyle(active, node.depth)}
          >
            <span style={sidebarIconBox(active)}>
              {node.kind === "section" ? <Layers3 size={14} /> :
               node.kind === "repeat" ? <GitBranch size={14} /> :
               node.kind === "note" ? <Type size={14} /> :
               node.kind === "calculate" ? <Hash size={14} /> :
               <ChevronRight size={14} />}
            </span>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, minWidth: 0 }}>
              <strong
                style={{
                  fontSize: 13,
                  color: "var(--pulso-text)",
                  lineHeight: 1.35,
                  textAlign: "left",
                  whiteSpace: "normal",
                }}
              >
                {node.name || node.label || `fila_${node.rowIndex + 1}`}
              </strong>
              <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
                {node.kind === "question" ? typeLabel(node.typeInfo.base) : previewKindLabel(node)}
                {node.label ? ` · ${node.label}` : ""}
              </span>
            </span>
            {active && (
              <span style={{ display: "inline-flex", gap: 4, marginLeft: "auto", flexShrink: 0 }}>
                <button
                  type="button"
                  className="pulso-icon"
                  disabled={!canMoveUp}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveUp();
                  }}
                  title="Mover arriba"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  className="pulso-icon"
                  disabled={!canMoveDown}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveDown();
                  }}
                  title="Mover abajo"
                >
                  <ArrowDown size={13} />
                </button>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CatalogLibrary({
  catalogs,
  activeCatalogName,
  onFocus,
}: {
  catalogs: CatalogSummary[];
  activeCatalogName: string | null;
  onFocus: (listName: string) => void;
}) {
  if (!catalogs.length) {
    return (
      <EmptyState
        icon={<ListChecks size={18} />}
        title="Todavía no hay catálogos"
        hint="Crea uno desde aquí o desde una pregunta de selección para reutilizar opciones de forma consistente."
        variant="inline"
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {catalogs.map((catalog) => {
        const active = catalog.listName === activeCatalogName;
        return (
          <button
            key={catalog.listName}
            type="button"
            onClick={() => onFocus(catalog.listName)}
            style={{
              width: "100%",
              textAlign: "left",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 12,
              border: active ? "1px solid var(--pulso-primary)" : "1px solid var(--pulso-border)",
              background: active ? "var(--pulso-primary-soft)" : "var(--pulso-surface-2)",
            }}
          >
            <span style={sidebarIconBox(active)}>
              <ListChecks size={14} />
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
              <strong style={{ fontSize: 13 }}>{catalog.listName}</strong>
              <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>
                {catalog.items.length} opciones · {catalog.title}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CatalogWorkspace({
  catalog,
  onRename,
  onAddChoice,
  onChoiceChange,
  onChoiceRemove,
}: {
  catalog: CatalogSummary | null;
  onRename: (currentListName: string, nextListName: string) => void;
  onAddChoice: (listName: string) => void;
  onChoiceChange: (rowIndex: number, field: "name" | "label", value: string) => void;
  onChoiceRemove: (rowIndex: number) => void;
}) {
  if (!catalog) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span className="pulso-section-eyebrow">Catálogo activo</span>
        <button
          type="button"
          className="pulso-icon"
          onClick={() => onAddChoice(catalog.listName)}
          title="Añadir opción"
        >
          <Plus size={13} />
        </button>
      </div>

      <Field label="Nombre reutilizable">
        <input
          value={catalog.listName}
          onChange={(e) => onRename(catalog.listName, e.target.value)}
        />
      </Field>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflow: "auto", paddingRight: 2 }}>
        {catalog.items.map((choice, index) => (
          <div
            key={choice.rowIndex}
            style={{
              border: "1px solid var(--pulso-border)",
              borderRadius: 12,
              background: "var(--pulso-surface-2)",
              padding: "9px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "white",
                  border: "1px solid var(--pulso-border)",
                  color: "var(--pulso-text-soft)",
                  fontSize: 11,
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {index + 1}
              </span>
              <input
                value={choice.label}
                onChange={(e) => onChoiceChange(choice.rowIndex, "label", e.target.value)}
                aria-label={`Texto visible de ${choice.name || index + 1}`}
                placeholder="Texto visible"
              />
              <button
                type="button"
                className="pulso-icon pulso-icon-danger"
                onClick={() => onChoiceRemove(choice.rowIndex)}
                title="Eliminar opción"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <input
              value={choice.name}
              onChange={(e) => onChoiceChange(choice.rowIndex, "name", e.target.value)}
              aria-label={`Código interno de ${choice.label || index + 1}`}
              placeholder="codigo_interno"
              style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function DiagnosticsPanel({
  diagnostics,
  selection,
  onSelectRow,
  onFocusCatalog,
}: {
  diagnostics: BuilderDiagnostic[];
  selection: BuilderSelection | null;
  onSelectRow: (rowIndex: number) => void;
  onFocusCatalog?: (listName: string) => void;
}) {
  if (!diagnostics.length) {
    return (
      <EmptyState
        icon={<CheckCircle2 size={18} />}
        title="Todo se ve bastante bien"
        hint="No detectamos advertencias básicas en esta versión del constructor."
        variant="inline"
      />
    );
  }

  const sorted = [...diagnostics].sort((a, b) => {
    const aSelected = selection?.kind === "survey" && a.rowIndex === selection.rowIndex ? 1 : 0;
    const bSelected = selection?.kind === "survey" && b.rowIndex === selection.rowIndex ? 1 : 0;
    return bSelected - aSelected;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {sorted.slice(0, 8).map((item) => {
        const selected = selection?.kind === "survey" && item.rowIndex === selection.rowIndex;
        const warn = item.level === "warn";
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (item.rowIndex != null) onSelectRow(item.rowIndex);
              else if (item.catalogName) onFocusCatalog?.(item.catalogName);
            }}
            style={{
              width: "100%",
              textAlign: "left",
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              padding: "10px 12px",
              borderRadius: 12,
              border: selected
                ? "1px solid var(--pulso-primary)"
                : warn ? "1px solid var(--pulso-warn-border)" : "1px solid var(--pulso-border)",
              background: selected
                ? "var(--pulso-primary-soft)"
                : warn ? "var(--pulso-warn-bg)" : "var(--pulso-surface-2)",
            }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "white",
                border: "1px solid var(--pulso-border)",
                color: warn ? "var(--pulso-warn-fg)" : "var(--pulso-text-soft)",
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={14} />
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <strong style={{ fontSize: 13 }}>{item.title}</strong>
              <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.55 }}>{item.detail}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function sidebarItemStyle(active: boolean, depth: number): CSSProperties {
  return {
    width: "100%",
    textAlign: "left",
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 12,
    border: active ? "1px solid var(--pulso-primary)" : "1px solid transparent",
    background: active ? "var(--pulso-primary-soft)" : "transparent",
    boxShadow: active ? "0 0 0 3px var(--pulso-primary-ring)" : "none",
    paddingLeft: 12 + depth * 18,
    cursor: "pointer",
  };
}

function sidebarIconBox(active: boolean): CSSProperties {
  return {
    width: 26,
    height: 26,
    borderRadius: 8,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: active ? "white" : "var(--pulso-surface-2)",
    border: "1px solid var(--pulso-border)",
    color: active ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
    flexShrink: 0,
  };
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
  const title = selection?.kind === "settings"
    ? (settingsRecord?.form_title || "Configuración del formulario")
    : (node?.label || "Selecciona un elemento");
  const subtitle = selection?.kind === "settings"
    ? `ID ${settingsRecord?.form_id || "sin definir"} · versión ${settingsRecord?.version || "1"}`
    : node
      ? `${previewKindLabel(node)}${node.name ? ` · ${node.name}` : ""}${section && section.kind !== "root" ? ` · dentro de ${section.label}` : ""}`
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
          {selection?.kind === "settings" ? <Settings2 size={20} /> : <Sparkles size={20} />}
        </span>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 280, flex: 1 }}>
          <span className="pulso-section-eyebrow">
            {selection?.kind === "settings" ? "Identidad del formulario" : "Pieza activa"}
          </span>
          <h2 style={{ margin: 0, fontSize: 28, lineHeight: 1.1, letterSpacing: -0.3, color: "var(--pulso-primary)" }}>
            {title}
          </h2>
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

function QuestionCanvas({
  node,
  choiceItems,
  logicBlocks,
}: {
  node: BuilderNode;
  choiceItems: ChoiceItem[];
  logicBlocks: Array<{ title: string; text: string; icon: ReactNode }>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <article
        style={{
          border: "1px solid var(--pulso-border)",
          borderRadius: 14,
          padding: "18px 18px 16px",
          background: "linear-gradient(180deg, #ffffff 0%, var(--pulso-surface-2) 100%)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Pill>{previewKindLabel(node)}</Pill>
          {node.required && <Pill tone="success">Obligatoria</Pill>}
          {node.relevant && <Pill tone="info">Condicional</Pill>}
          {node.constraint && <Pill tone="warn">Valida respuesta</Pill>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="pulso-section-eyebrow">Vista de la pregunta</span>
          <h3 style={{ margin: 0, fontSize: 24, lineHeight: 1.2 }}>{node.label}</h3>
          {node.hint && (
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--pulso-text-soft)" }}>
              {node.hint}
            </p>
          )}
        </div>

        <AnswerPreview node={node} choiceItems={choiceItems} />
      </article>

      <div style={{ display: "grid", gridTemplateColumns: logicBlocks.length ? "1.15fr 1fr" : "1fr", gap: 12 }}>
        <article
          style={{
            border: "1px solid var(--pulso-border)",
            borderRadius: 12,
            padding: "14px 16px",
            background: "white",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <span className="pulso-section-eyebrow">Qué espera el formulario</span>
          <LogicNarrative node={node} />
        </article>

        {logicBlocks.length > 0 && (
          <article
            style={{
              border: "1px solid var(--pulso-border)",
              borderRadius: 12,
              padding: "14px 16px",
              background: "white",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <span className="pulso-section-eyebrow">Cómo se comporta</span>
            {logicBlocks.map((block) => (
              <div
                key={block.title}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "var(--pulso-surface-2)",
                  border: "1px solid var(--pulso-border)",
                }}
              >
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: "white",
                    border: "1px solid var(--pulso-border)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--pulso-primary)",
                    flexShrink: 0,
                  }}
                >
                  {block.icon}
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <strong style={{ fontSize: 13 }}>{block.title}</strong>
                  <span style={{ fontSize: 12, color: "var(--pulso-text-soft)", lineHeight: 1.55 }}>{block.text}</span>
                </div>
              </div>
            ))}
          </article>
        )}
      </div>
    </div>
  );
}

function LogicNarrative({ node }: { node: BuilderNode }) {
  const typeText = previewKindLabel(node).toLowerCase();
  const lines: string[] = [];

  if (node.kind === "section" || node.kind === "repeat") {
    lines.push(`${node.label} abre un bloque del formulario.`);
    if (node.relevant) lines.push(`Este bloque solo aparece cuando se cumple la condición definida.`);
  } else if (node.kind === "note") {
    lines.push(`${node.label} funciona como un texto de apoyo dentro del formulario.`);
  } else if (node.kind === "calculate") {
    lines.push(`${node.label} se llena de manera automática a partir de una fórmula.`);
  } else {
    lines.push(`La persona encuestada responde esta ${typeText}.`);
    if (node.required) lines.push("La respuesta es obligatoria cuando la pregunta está visible.");
    if (node.constraint) lines.push("Además, la respuesta debe pasar una validación antes de guardarse.");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {lines.map((line) => (
        <div key={line} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: 999,
              background: "var(--pulso-primary-soft)",
              color: "var(--pulso-primary)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            <ArrowRight size={12} />
          </span>
          <span style={{ fontSize: 13, lineHeight: 1.6, color: "var(--pulso-text-soft)" }}>{line}</span>
        </div>
      ))}
    </div>
  );
}

function AnswerPreview({ node, choiceItems }: { node: BuilderNode; choiceItems: ChoiceItem[] }) {
  if (node.kind === "note") {
    return <PreviewBox>Este bloque muestra texto y no espera una respuesta.</PreviewBox>;
  }
  if (node.kind === "calculate") {
    return <PreviewBox>El valor se completa automáticamente con la lógica de cálculo.</PreviewBox>;
  }
  if (node.kind === "section" || node.kind === "repeat") {
    return <PreviewBox>Esta pieza organiza preguntas y define una parte del recorrido del formulario.</PreviewBox>;
  }
  if (node.typeInfo.base === "select_one" || node.typeInfo.base === "select_multiple") {
    const empty = !choiceItems.length;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="pulso-section-eyebrow">Respuesta esperada</span>
          {node.typeInfo.listName && <Pill tone="info">Catálogo: {node.typeInfo.listName}</Pill>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(empty ? [{ rowIndex: -1, name: "opcion_1", label: "Añade opciones desde el inspector" }] : choiceItems.slice(0, 5)).map((choice) => (
            <div
              key={`${choice.name}-${choice.rowIndex ?? choice.name}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--pulso-border)",
                background: "white",
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: node.typeInfo.base === "select_one" ? 999 : 5,
                  border: "1.5px solid var(--pulso-primary-border)",
                  background: "var(--pulso-surface-2)",
                  flexShrink: 0,
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <strong style={{ fontSize: 13 }}>{choice.label || choice.name}</strong>
                <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>{choice.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (node.typeInfo.base === "date") {
    return <PreviewBox>El formulario espera una fecha válida.</PreviewBox>;
  }
  if (node.typeInfo.base === "integer" || node.typeInfo.base === "decimal") {
    return <PreviewBox>El formulario espera una respuesta numérica.</PreviewBox>;
  }
  return <PreviewBox>El formulario espera una respuesta en texto libre.</PreviewBox>;
}

function PreviewBox({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--pulso-border)",
        borderRadius: 12,
        padding: "12px 14px",
        background: "white",
        fontSize: 13,
        color: "var(--pulso-text-soft)",
        lineHeight: 1.6,
      }}
    >
      {children}
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

function QuestionInspector({
  node,
  catalogs,
  activeCatalogName,
  choiceItems,
  onFieldChange,
  onTypeChange,
  onRequiredChange,
  onSectionKindChange,
  logicSources,
  onCatalogAssign,
  onCatalogCreate,
  onCatalogRename,
  onAddChoice,
  onChoiceChange,
  onChoiceRemove,
}: {
  node: BuilderNode;
  catalogs: CatalogSummary[];
  activeCatalogName: string | null;
  choiceItems: ChoiceItem[];
  onFieldChange: (field: string, value: string) => void;
  onTypeChange: (value: string) => void;
  onRequiredChange: (checked: boolean) => void;
  onSectionKindChange: (value: "begin_group") => void;
  logicSources: Array<{ name: string; label: string; type: string }>;
  onCatalogAssign: (listName: string) => void;
  onCatalogCreate: () => void;
  onCatalogRename: (currentListName: string, nextListName: string) => void;
  onAddChoice: () => void;
  onChoiceChange: (rowIndex: number, field: "name" | "label", value: string) => void;
  onChoiceRemove: (rowIndex: number) => void;
}) {
  const isSection = node.kind === "section" || node.kind === "repeat";
  const isQuestionLike = node.kind === "question" || node.kind === "note" || node.kind === "calculate";
  const isSelect = node.typeInfo.base === "select_one" || node.typeInfo.base === "select_multiple";
  const assignedCatalog = node.typeInfo.listName || activeCatalogName || "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <InspectorGroup title={isSection ? "Identidad del bloque" : "Contenido visible"}>
        <Field label={isSection ? "Título de la sección" : "Texto de la pregunta"}>
          <textarea rows={3} value={node.label} onChange={(e) => onFieldChange("label", e.target.value)} />
        </Field>
        <Field label="Nombre interno">
          <input value={node.name} onChange={(e) => onFieldChange("name", e.target.value)} />
        </Field>
        {!isSection && (
          <Field label="Ayuda o pista para el encuestado">
            <textarea rows={2} value={node.hint} onChange={(e) => onFieldChange("hint", e.target.value)} />
          </Field>
        )}
      </InspectorGroup>

      <InspectorGroup title={isSection ? "Estructura del bloque" : "Tipo de respuesta"}>
        {isSection && node.kind === "repeat" ? (
          <PreviewBox>
            Este bloque repetido viene del XLSForm importado. Por ahora lo dejamos visible en el constructor, pero sus ajustes finos viven en modo avanzado.
          </PreviewBox>
        ) : isSection ? (
          <Field label="Clase de bloque">
            <select
              value="begin_group"
              onChange={() => onSectionKindChange("begin_group")}
            >
              <option value="begin_group">Sección simple</option>
            </select>
          </Field>
        ) : (
          <Field label="Tipo de respuesta">
            <select value={node.typeInfo.base} onChange={(e) => onTypeChange(e.target.value)}>
              {QUESTION_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </Field>
        )}
        {isQuestionLike && node.kind === "question" && (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={node.required} onChange={(e) => onRequiredChange(e.target.checked)} />
            Marcar como obligatoria
          </label>
        )}
        {isQuestionLike && (
          <Field label="Apariencia">
            <input value={node.appearance} onChange={(e) => onFieldChange("appearance", e.target.value)} placeholder="Opcional" />
          </Field>
        )}
      </InspectorGroup>

      <InspectorGroup title="Lógica del formulario">
        <GuidedVisibilityControl
          label={isSection ? "Visibilidad de la sección" : "Visibilidad de la pregunta"}
          expression={node.relevant}
          sources={logicSources}
          onChange={(value) => onFieldChange("relevant", value)}
        />
        {!isSection && node.kind !== "note" && (
          <Field label="Validación avanzada de la respuesta">
            <textarea rows={3} value={node.constraint} onChange={(e) => onFieldChange("constraint", e.target.value)} placeholder="Opcional" />
          </Field>
        )}
        {!isSection && node.kind === "calculate" && (
          <Field label="Fórmula del cálculo">
            <textarea rows={3} value={node.calculation} onChange={(e) => onFieldChange("calculation", e.target.value)} placeholder="Expresión de cálculo" />
          </Field>
        )}
        {!isSection && isSelect && (
          <Field label="Filtro del catálogo">
            <textarea rows={3} value={node.choiceFilter} onChange={(e) => onFieldChange("choice_filter", e.target.value)} placeholder="Opcional" />
          </Field>
        )}
      </InspectorGroup>

      {!isSection && isSelect && (
        <InspectorGroup
          title="Catálogo de opciones"
          actions={(
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={onCatalogCreate} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Plus size={14} /> Nuevo catálogo
              </button>
              <button type="button" onClick={onAddChoice} style={{ display: "inline-flex", alignItems: "center", gap: 6 }} disabled={!node.typeInfo.listName}>
                <Plus size={14} /> Añadir opción
              </button>
            </div>
          )}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Field label="Catálogo asignado">
              <select
                value={node.typeInfo.listName}
                onChange={(e) => onCatalogAssign(e.target.value)}
              >
                <option value="">Selecciona un catálogo</option>
                {catalogs.map((catalog) => (
                  <option key={catalog.listName} value={catalog.listName}>
                    {catalog.listName} ({catalog.items.length} opciones)
                  </option>
                ))}
              </select>
            </Field>

            {node.typeInfo.listName && (
              <Field label="Nombre del catálogo">
                <input
                  value={node.typeInfo.listName}
                  onChange={(e) => onCatalogRename(node.typeInfo.listName, e.target.value)}
                  placeholder={assignedCatalog || "catalogo"}
                />
              </Field>
            )}

            {choiceItems.length === 0 && (
              <EmptyState
                icon={<ListChecks size={18} />}
                title="Todavía no hay opciones"
                hint="Crea o asigna un catálogo para que la pregunta tenga opciones reutilizables."
                variant="inline"
              />
            )}
            {choiceItems.map((choice) => (
              <div
                key={choice.rowIndex}
                style={{
                  border: "1px solid var(--pulso-border)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  background: "var(--pulso-surface-2)",
                }}
              >
                <Field label="Texto visible">
                  <input value={choice.label} onChange={(e) => onChoiceChange(choice.rowIndex, "label", e.target.value)} />
                </Field>
                <Field label="Código interno">
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input value={choice.name} onChange={(e) => onChoiceChange(choice.rowIndex, "name", e.target.value)} />
                    <button
                      type="button"
                      className="pulso-icon pulso-icon-danger"
                      onClick={() => onChoiceRemove(choice.rowIndex)}
                      title="Eliminar opción"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </Field>
              </div>
            ))}
          </div>
        </InspectorGroup>
      )}
    </div>
  );
}

function GuidedVisibilityControl({
  label,
  expression,
  sources,
  onChange,
}: {
  label: string;
  expression: string;
  sources: Array<{ name: string; label: string; type: string }>;
  onChange: (value: string) => void;
}) {
  const parsed = parseSimpleCondition(expression);
  const guided = !expression || !!parsed;
  const selectedVariable = parsed?.variableName || sources[0]?.name || "";
  const selectedOperator = parsed?.operator || "=";
  const selectedValue = parsed?.value || "1";

  const applyGuided = (next: Partial<{ variableName: string; operator: string; value: string }>) => {
    const variableName = next.variableName ?? selectedVariable;
    const operator = next.operator ?? selectedOperator;
    const value = next.value ?? selectedValue;
    onChange(buildSimpleCondition(variableName, operator, value));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Field label={label}>
        <select
          value={expression ? (guided ? "conditional" : "advanced") : "always"}
          onChange={(e) => {
            if (e.target.value === "always") onChange("");
            if (e.target.value === "conditional") applyGuided({});
          }}
        >
          <option value="always">Siempre se muestra</option>
          <option value="conditional" disabled={!sources.length}>Se muestra solo si...</option>
          {expression && !guided && <option value="advanced">Condición avanzada importada</option>}
        </select>
      </Field>

      {expression && guided && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 120px 0.8fr",
            gap: 8,
            alignItems: "end",
          }}
        >
          <Field label="Pregunta que activa">
            <select value={selectedVariable} onChange={(e) => applyGuided({ variableName: e.target.value })}>
              {sources.map((source) => (
                <option key={source.name} value={source.name}>
                  {source.name} · {source.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Condición">
            <select value={selectedOperator} onChange={(e) => applyGuided({ operator: e.target.value })}>
              <option value="=">es igual a</option>
              <option value="!=">es distinto de</option>
              <option value=">">mayor que</option>
              <option value=">=">mayor o igual</option>
              <option value="<">menor que</option>
              <option value="<=">menor o igual</option>
              <option value="selected">incluye opción</option>
            </select>
          </Field>
          <Field label="Valor">
            <input value={selectedValue} onChange={(e) => applyGuided({ value: e.target.value })} />
          </Field>
        </div>
      )}

      {expression && !guided && (
        <Field label="Condición avanzada">
          <textarea rows={3} value={expression} onChange={(e) => onChange(e.target.value)} />
        </Field>
      )}
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

function ActionBand({ title, description, icon }: { title: string; description: string; icon: ReactNode }) {
  return (
    <article
      style={{
        border: "1px solid var(--pulso-border)",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        background: "var(--pulso-surface-2)",
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "white",
          border: "1px solid var(--pulso-border)",
          color: "var(--pulso-primary)",
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <strong style={{ fontSize: 13 }}>{title}</strong>
        <span style={{ fontSize: 12, color: "var(--pulso-text-soft)", lineHeight: 1.55 }}>{description}</span>
      </div>
    </article>
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

function SheetEditor({
  sheet,
  editable,
  onCellChange,
  onColumnNameChange,
  onColumnRemove,
  onRowRemove,
}: {
  sheet: XlsformEditorSheet;
  editable: boolean;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  onColumnNameChange: (colIndex: number, value: string) => void;
  onColumnRemove: (colIndex: number) => void;
  onRowRemove: (rowIndex: number) => void;
}) {
  if (!sheet.columns.length) {
    return (
      <EmptyState
        icon={<Columns3 size={18} />}
        title="Esta hoja todavía no tiene columnas"
        hint={editable ? "Añade la primera columna para empezar a estructurar esta parte del XLSForm." : "El traductor no generó columnas visibles para esta hoja."}
        variant="inline"
      />
    );
  }

  const rows = sheet.rows.length ? sheet.rows : (editable ? [new Array(sheet.columns.length).fill("")] : []);

  return (
    <div
      style={{
        border: "1px solid var(--pulso-border)",
        borderRadius: 12,
        overflow: "hidden",
        background: "white",
      }}
    >
      <div style={{ overflow: "auto", maxHeight: 620 }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 900 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
            <tr>
              {sheet.columns.map((column, colIndex) => (
                <th
                  key={`${column}-${colIndex}`}
                  style={{
                    background: "var(--pulso-header-row)",
                    borderBottom: "1px solid var(--pulso-border)",
                    padding: 10,
                    verticalAlign: "top",
                    minWidth: 180,
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      value={column}
                      disabled={!editable}
                      onChange={(e) => onColumnNameChange(colIndex, e.target.value)}
                      aria-label={`Nombre de columna ${colIndex + 1}`}
                      style={{
                        width: "100%",
                        fontWeight: 700,
                        background: editable ? "white" : "transparent",
                      }}
                    />
                    {editable && (
                      <button
                        type="button"
                        className="pulso-icon pulso-icon-danger"
                        onClick={() => onColumnRemove(colIndex)}
                        title="Eliminar columna"
                        aria-label={`Eliminar columna ${column || colIndex + 1}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              {editable && (
                <th
                  style={{
                    width: 54,
                    background: "var(--pulso-header-row)",
                    borderBottom: "1px solid var(--pulso-border)",
                  }}
                />
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {sheet.columns.map((column, colIndex) => (
                  <td
                    key={`${column}-${rowIndex}-${colIndex}`}
                    style={{
                      padding: 8,
                      borderBottom: "1px solid var(--pulso-border)",
                      verticalAlign: "top",
                    }}
                  >
                    <textarea
                      value={row[colIndex] ?? ""}
                      disabled={!editable}
                      rows={1}
                      onChange={(e) => onCellChange(rowIndex, colIndex, e.target.value)}
                      aria-label={`Fila ${rowIndex + 1}, columna ${column || colIndex + 1}`}
                      style={{
                        width: "100%",
                        minHeight: 34,
                        resize: "vertical",
                        lineHeight: 1.45,
                        background: editable ? "white" : "transparent",
                      }}
                    />
                  </td>
                ))}
                {editable && (
                  <td
                    style={{
                      padding: 8,
                      borderBottom: "1px solid var(--pulso-border)",
                      verticalAlign: "top",
                      textAlign: "center",
                    }}
                  >
                    <button
                      type="button"
                      className="pulso-icon pulso-icon-danger"
                      onClick={() => onRowRemove(rowIndex)}
                      title="Eliminar fila"
                      aria-label={`Eliminar fila ${rowIndex + 1}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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

/**
 * Banner que aparece cuando al montar detectamos un snapshot persistido en
 * sessionStorage (típicamente por crash + reload). Le ofrece al usuario
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
      <Sparkles size={16} color="var(--pulso-info-fg)" />
      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          Tenías un formulario abierto antes
        </div>
        <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
          {snapshot.sourceName ? `Archivo: ${snapshot.sourceName} · ` : ""}
          Guardado automáticamente {formatRelativeTime(snapshot.savedAt)}.
        </div>
      </div>
      <button
        type="button"
        className="pulso-primary"
        onClick={onAccept}
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        <Sparkles size={14} /> Continuar editando
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
