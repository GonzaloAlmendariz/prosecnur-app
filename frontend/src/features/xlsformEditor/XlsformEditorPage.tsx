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
  Download,
  FileSpreadsheet,
  Filter,
  GitBranch,
  Hash,
  Layers3,
  ListChecks,
  Plus,
  Settings2,
  Sparkles,
  Table2,
  Trash2,
  Type,
  Upload,
  Wand2,
  Workflow,
} from "lucide-react";
import {
  apiUpload,
  apiXlsformEditorExport,
  apiXlsformEditorImport,
  apiXlsformEditorImportSurveyMonkey,
  apiXlsformEditorValidate,
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
  SectionMeta,
  SheetKey,
  XlsformEditorWorkbook,
  XlsformIndex,
} from "./types";
import {
  cloneWorkbook,
  createBlankWorkbook,
  deleteRow,
  ensureColumn,
  getCell,
  insertRecord,
  makeColumnName,
  replaceVarReferences,
  rowToRecord,
  setCell,
  SURVEY_COLUMNS_WITH_VAR_REFS,
} from "./parsing/sheetUtils";
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
} from "./state/persistence";
import EmptyHome from "./shell/EmptyHome";
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
import { Inspector } from "./inspector/Inspector";
import { ForeignLanguageBadge } from "./inspector/ForeignLanguageBadge";
import { scanForeignLanguages } from "./parsing/languageScan";
import { iconForType } from "./helpers/icons";
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
  /** Si está abierto el overlay del mapa de lógica (canvas Obsidian-style).
   *  Se accede desde el botón "Mapa de lógica" del header del constructor. */
  const [logicCanvasOpen, setLogicCanvasOpen] = useState(false);
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

  // Idiomas extra detectados al importar (label::English, hint::Français, …).
  // Si hay alguno, mostramos un banner persistente arriba del Inspector
  // explicando que se preservan al exportar pero no se editan en F1.
  const foreignLanguageNotice = useMemo(
    () => scanForeignLanguages(workbook),
    [workbook],
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
            onPickTemplate={onPickTemplate}
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
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setLogicCanvasOpen(true)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  title="Ver el grafo de dependencias del formulario"
                >
                  <Workflow size={14} />
                  Mapa de lógica
                </button>
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
              </div>
            }
          >
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
                  {/* Banner de idiomas extra: aparece encima del Inspector
                      cuando el .xlsx importado trae label::English u otras
                      traducciones. F1 las preserva pero no las edita. */}
                  <ForeignLanguageBadge notice={foreignLanguageNotice} />

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
                      <Inspector
                        node={selectedNode}
                        catalogs={catalogs}
                        logicScope={logicScope}
                        position={
                          structure
                            ? computeQuestionPosition(structure, selectedNode.rowIndex)
                            : undefined
                        }
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
          </Panel>

          {/* Índice del instrumento — sección colapsable secundaria que NO
              compite por ancho con el constructor. Se abre on-demand cuando
              el usuario quiere ver dependencias entre preguntas y catálogos. */}
          {xlsformIndex && (
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

      {/* Toasts deslizables: mensajes efímeros de operaciones (import/export).
          El deck se monta una sola vez y se mantiene a nivel del editor —
          fuera del flujo Panel para que los toasts queden anclados a la
          esquina inferior-derecha sin romper el layout. */}
      <ToastDeck items={toasts.items} onDismiss={toasts.dismiss} />
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
