import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  ListChecks,
  Plus,
  X,
} from "lucide-react";
import { IconRedo, IconSearch, IconUndo } from "../../lib/icons";
import {
  apiSaveEntregable,
  apiEstudioProcessingSuggestions,
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
  apiXlsformFormSave,
  apiXlsformFormsList,
  downloadUrl,
  normalizeXlsformFormSource,
  type ChoiceCodeMap,
  type Hallazgo,
  type SurveyMonkeyVisualLogicRule,
  type XlsformFormPublication,
  type XlsformFormSource,
} from "../../api/client";
import type { XlsformPaperExportOptions } from "../../api/xlsformEditor";
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
import { registerPendingFlush } from "../../lib/pendingFlushRegistry";
import { editorFormIdFromSearch, editorRequestedFormExists, searchConFormId } from "./state/editorDeepLink";

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
import { crearManejadoresHojas } from "./state/manejadoresHojas";
import {
  buildType,
  cleanFilename,
  formatSource,
  formatSourceLong,
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
import { XlsformTransferNotice } from "./shell/XlsformTransferNotice";
import {
  formSourceWithActorKey,
  instrumentActorOptions,
  type InstrumentActorOption,
} from "./shell/actorAssignmentModel";
import { instrumentActorLabel } from "./shell/formWorkflowView";
import { exportWarningDetail, pdfDialogStorageKey } from "./shell/pdfExportPreference";
import { EditorPestanas } from "./shell/EditorPestanas";
import { usePestanaEditor } from "./shell/pestanaEditor";
import { PANEL_CATALOGOS, PANEL_LOGICA_SURVEYMONKEY } from "./shell/panelesEditor";
import { VistaCuestionario } from "./shell/VistaCuestionario";
import { deriveEditorHeaderStatus } from "./shell/editorHeaderStatus";
import { contextoResumen } from "./resumen/contextoResumen";
import { PestanaImpreso } from "./impreso/PestanaImpreso";
import { usePanelDireccionable } from "../../lib/navegacion/paneles";
import { esperarExportPapel, textoExportando } from "./shell/paperExportJob";
import { ToastDeck, useToastDeck } from "./shell/ToastDeck";
import { EditorCommandBar } from "./shell/EditorCommandBar";
import { EditorSmImportNotice } from "./shell/EditorSmImportNotice";
import { useActivePublicationRefresh } from "./shell/useActivePublicationRefresh";
import { contarEscalasRepetidas, useListasOpcionesPanel } from "./listas";
import { buildSuiteMetrics, formatFieldSectionPair } from "./shell/editorMetrics";
import { RestoreOfferBanner } from "./shell/RestoreOfferBanner";
import { LogicaExternaDialogo, LogicaExternaDisparador } from "./shell/LogicaExterna";
import { useLogicaExterna } from "./shell/useLogicaExterna";
import { CollapsibleSection } from "./shell/CollapsibleSection";
import {
  applyChoiceMove,
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
import { PestanaOpciones } from "./opciones/PestanaOpciones";
import { FormSimulator } from "./shell/FormSimulator";
import { FormSummaryView } from "./shell/FormSummaryView";
import "./styles/xlsformV2";
import "./styles/xf-logic.css";
import { PestanaRestricciones } from "./pestanas/PestanaRestricciones";
import { PestanaCalculos } from "./pestanas/PestanaCalculos";
import { ListaLogica } from "./canvas-graph/ListaLogica";
import { computeQuestionPosition, workbookWithSurveyMonkeyLogic, refreshSurveyMonkeyAdvancedRules, extractExistingKoboLogic, visualActionCountForFooter, mergeAdvancedLogicRules, mergeVisualLogicRules, choiceCodeMapsWithOverrides, mergeChoiceCodeMaps, sectionIdForRow, findNextSiblingAfterSection, findLastDirectChildInSection, buildSectionBoundaryState } from "./state/editorHelpers";
import { SurveyMonkeyLogicPopup } from "./shell/SurveyMonkeyLogicPopup";
import { AddElementMenu } from "./shell/AddElementMenu";

/**
 * Posición 1-indexed de una fila dentro del outline, contando solo
 * preguntas reales (question/note/calculate). Si la fila es una sección o
 * un marcador begin/end, devuelve `undefined`.
 */
export default function XlsformEditorPage() {
  // Detecta si hay un .pulso abierto — al exportar, decide entre guardar
  // al directorio del proyecto (vía /api/fs/save-to-project) o usar la
  // descarga clásica del navegador.
  const { project } = useProjectShell();
  const { sessionId } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const requestedFormId = editorFormIdFromSearch(location.search);
  // Estado del workbook + dirty + lastSavedAt + history (undo/redo) en un
  // solo reducer para mantener consistencia transaccional. Las acciones
  // disponibles son SET (mutación normal), LOAD (importar/restaurar),
  // CLEAR (volver al espacio de formularios), UNDO/REDO y MARK_SAVED.
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
  // El hub no se pinta hasta que el índice del backend contestó (o falló).
  //
  // Sin esto el usuario veía dos homepages seguidos: primero la biblioteca
  // sembrada desde localStorage —que en una máquina fresca está vacía, así que
  // salía la variante "welcome" con el hero de creación y el diagrama— y un
  // instante después la biblioteca real del .pulso. Y aun con localStorage
  // caliente, las tarjetas nacían sin su bloque de publicación y crecían al
  // llegar. Esperar una sola vez cuesta unos ms y entrega una sola superficie.
  const [libraryReady, setLibraryReady] = useState(false);
  // El índice del proyecto no se pudo leer. Distinto de "no hay formularios":
  // afirmar el vacío sin saberlo es la misma mentira que producía el hero de
  // creación delante de un proyecto que sí tenía formularios.
  const [libraryError, setLibraryError] = useState(false);
  const [instrumentActorCatalog, setInstrumentActorCatalog] = useState<{
    status: "loading" | "ready" | "empty" | "error";
    options: InstrumentActorOption[];
  }>({ status: "loading", options: [] });
  const instrumentActors = instrumentActorCatalog.options;
  const [assigningActorFormId, setAssigningActorFormId] = useState<string | null>(null);
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

  // Toda vista es enlazable: con un formulario abierto, la dirección lleva su
  // `form_id`. Sin esto, recargar `?pestana=impreso` caía en la biblioteca y
  // el enlace no llevaba a ningún formulario.
  const hayWorkbook = workbook != null;
  // El usuario pidió la biblioteca («Ver todos»): la apertura automática del
  // formulario activo no lo devuelve adentro hasta que abra uno.
  const hubElegidoRef = useRef(false);
  useEffect(() => {
    if (hayWorkbook) hubElegidoRef.current = false;
    if (!hayWorkbook || !activeFormId || requestedFormId === activeFormId) return;
    navigate(
      { pathname: location.pathname, search: searchConFormId(location.search, activeFormId) },
      { replace: true },
    );
  }, [hayWorkbook, activeFormId, requestedFormId, location.pathname, location.search, navigate]);

  const [selection, setSelection] = useState<BuilderSelection | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Todavía no hay un formulario abierto.");
  const [artifact, setArtifact] = useState<{ file_id: string; original_name: string; extension: "xlsx" | "pdf" | "docx" } | null>(null);
  const [source, setSource] = useState<XlsformFormSource | null>(null);
  const [catalogFocus, setCatalogFocus] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  /** Pestaña del rail (Constructor, Hojas, Mapa de lógica, Impreso…): la
   *  dirección manda (`?pestana=`). Constructor y Hojas leen el mismo
   *  workbook, así que un cambio en una se ve en la otra. */
  const pestanaEditor = usePestanaEditor();
  const { pestana, ir: irPestana, irAPregunta, fijarFoco } = pestanaEditor; // ítem 50: una ficha abierta es el `foco`, sin apilar historial
  const fijarFocoEnSitio = useCallback((valor: string | null) => fijarFoco(valor, { replace: true }), [fijarFoco]);
  /** Editor de listas (ContextLens de catálogos): panel direccionable. */
  const catalogosPanel = usePanelDireccionable(PANEL_CATALOGOS);
  const catalogsLensOpen = catalogosPanel.abierto;
  // Los atajos de teclado se registran una vez: leen la pestaña por ref.
  const irPestanaRef = useRef(irPestana);
  irPestanaRef.current = irPestana;
  const [builderWorkspaceMode, setBuilderWorkspaceMode] =
    useState<FocusWorkspaceMode>("focus");
	  /** Lógica de SurveyMonkey: borrador que se aplica o se descarta → panel. */
	  const smLogicPanel = usePanelDireccionable(PANEL_LOGICA_SURVEYMONKEY);
	  const smLogicDialogOpen = smLogicPanel.abierto;
	  // Los callbacks asíncronos (revisar la lógica tras cambiar de formulario)
	  // abren y cierran el panel con la dirección vigente, no con la de su cierre.
	  const smLogicPanelRef = useRef(smLogicPanel);
	  smLogicPanelRef.current = smLogicPanel;
	  const [logicReviewFormId, setLogicReviewFormId] = useState<string | null>(null);
	  const [smLogicRules, setSmLogicRules] = useState<ConfirmedRule[]>([]);
	  const [smVisualLogicRules, setSmVisualLogicRules] = useState<SurveyMonkeyVisualLogicRule[]>([]);
	  const [smLogicChoiceOverrides, setSmLogicChoiceOverrides] = useState<Record<string, string[]>>({});
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

  // Guardar/duplicar proyecto esperan este flusher (G-13): sin él, un edit
  // hecho dentro de la ventana del debounce no llega al backend antes de que
  // build_pulso serialice y la copia nace sin el último workbook. Al
  // desmontar despachamos el pendiente y recién entonces des-registramos,
  // así un guardado inmediatamente posterior aún espera ese POST.
  useEffect(() => {
    const unregister = registerPendingFlush(() => persistence.flushAndSync());
    return () => {
      void persistence.flushAndSync().finally(unregister);
    };
  }, [persistence]);

  // Scope de persistencia: el path del .pulso activo (o null si no
  // hay proyecto). Determina el bucket de localStorage para que el
  // banner "Tenías un formulario abierto" sea independiente por proyecto.
  const projectScope = project.status.path ?? null;
  const projectScopeRef = useRef(projectScope);
  useEffect(() => {
    projectScopeRef.current = projectScope;
  }, [projectScope]);

  useEffect(() => {
    let cancelled = false;
    setInstrumentActorCatalog({ status: "loading", options: [] });
    void apiEstudioProcessingSuggestions()
      .then((result) => {
        if (cancelled) return;
        const options = instrumentActorOptions(result.groups);
        setInstrumentActorCatalog({
          status: options.length > 0 ? "ready" : "empty",
          options,
        });
      })
      .catch(() => {
        if (!cancelled) setInstrumentActorCatalog({ status: "error", options: [] });
      });
    return () => { cancelled = true; };
  }, [projectScope, sessionId]);

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

  const onAssignFormActor = useCallback(async (id: string, actorKey: string) => {
    if (actorKey && !instrumentActors.some((actor) => actor.actor_key === actorKey)) return;
    setAssigningActorFormId(id);
    setPublicationUi((prev) => ({
      ...prev,
      errorsByFormId: { ...prev.errorsByFormId, [id]: "" },
    }));
    try {
      const local = loadForm(projectScope, id);
      const remote = local ? null : (await apiXlsformFormGet(id)).form;
      const snapshot = local ?? (remote ? {
        workbook: remote.workbook,
        savedAt: remote.saved_at,
        sourceName: remote.source?.original_name ?? null,
        sourceKind: remote.source?.kind ?? null,
        source: remote.source,
        hallazgos: remote.hallazgos,
      } : null);
      if (!snapshot) throw new Error("No se pudo abrir el formulario para asignar el actor.");
      const nextSource = formSourceWithActorKey(snapshot.source ?? null, actorKey);
      const savedAt = Date.now();
      await apiXlsformFormSave({
        id,
        name: deriveFormName(snapshot.workbook, nextSource),
        workbook: snapshot.workbook,
        source: nextSource,
        hallazgos: snapshot.hallazgos ?? [],
        saved_at: savedAt,
      });
      saveForm(projectScope, id, snapshot.workbook, {
        sourceKind: nextSource.kind,
        sourceName: nextSource.original_name,
        source: nextSource,
        hallazgos: snapshot.hallazgos,
      });
      setForms(listForms(projectScope));
      await refreshBackendFormIndex().catch(() => undefined);
      const actor = instrumentActors.find((option) => option.actor_key === actorKey);
      toasts.push({
        kind: "success",
        title: actor ? `Público asignado: ${instrumentActorLabel(actor)}` : "Asignación de público retirada",
        detail: publicationUi.byFormId[id]?.latest_revision
          ? "La revisión ya publicada sigue intacta. Publica el borrador para usar la nueva asignación."
          : "El público quedó guardado en el borrador del instrumento.",
        durationMs: 6000,
      });
    } catch {
      setPublicationUi((prev) => ({
        ...prev,
        errorsByFormId: {
          ...prev.errorsByFormId,
          [id]: "No se guardó el público. El formulario conserva su asignación anterior.",
        },
      }));
      toasts.push({
        kind: "danger",
        title: "No se pudo guardar el público",
        detail: "El formulario conserva su asignación anterior. Comprueba la sesión e inténtalo nuevamente.",
        durationMs: 6000,
      });
    } finally {
      setAssigningActorFormId((current) => current === id ? null : current);
    }
  }, [instrumentActors, projectScope, publicationUi.byFormId, refreshBackendFormIndex, toasts]);

  // Ref a switchToForm para invocarlo desde el hub y el efecto de scope sin
  // problemas de orden de declaración (la callback se define más abajo).
  const switchToFormRef = useRef<((id: string) => Promise<void>) | null>(null);

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

  const openFormLogicReview = useCallback(async (id: string) => {
    const switchForm = switchToFormRef.current;
    if (!switchForm) return;
    await switchForm(id);
    setLogicReviewFormId(id);
    smLogicPanelRef.current.abrir();
  }, []);

  const persistAndConfirmFormLogic = useCallback(async (
    id: string,
    nextWorkbook: XlsformEditorWorkbook,
    nextSource: XlsformFormSource | null,
    nextHallazgos: Hallazgo[],
  ): Promise<boolean> => {
    setPublicationUi((prev) => ({
      ...prev,
      confirmingLogicFormId: id,
      errorsByFormId: { ...prev.errorsByFormId, [id]: "" },
    }));
    try {
      // El workbook revisado se guarda primero de forma explícita. Recién con
      // el hash que devuelve el índice refrescado confirmamos la metodología;
      // así nunca confirmamos por accidente el borrador anterior.
      await apiXlsformFormSave({
        id,
        name: deriveFormName(nextWorkbook, nextSource),
        workbook: nextWorkbook,
        source: nextSource,
        hallazgos: nextHallazgos,
        saved_at: Date.now(),
      });
      const localSavedAt = saveForm(projectScope, id, nextWorkbook, {
        sourceKind: nextSource?.kind ?? null,
        sourceName: nextSource?.original_name ?? null,
        source: nextSource,
        hallazgos: nextHallazgos,
      });
      setForms(listForms(projectScope));
      if (activeFormIdRef.current === id) {
        dispatch({ type: "SET", workbook: nextWorkbook });
        if (localSavedAt != null) dispatch({ type: "MARK_SAVED", savedAt: localSavedAt });
      }
      const indexed = await refreshBackendFormIndex();
      const refreshedPublication = indexed.forms.find((form) => form.id === id)?.publication;
      const refreshedHash = refreshedPublication?.draft_content_sha256;
      if (!refreshedHash) throw new Error("missing refreshed publication hash");
      const result = await apiXlsformFormConfirmLogic(
        id,
        refreshedHash,
      );
      const confirmedSource = result.source ?? nextSource;
      saveForm(projectScope, id, nextWorkbook, {
        sourceKind: confirmedSource?.kind ?? null,
        sourceName: confirmedSource?.original_name ?? null,
        source: confirmedSource,
        hallazgos: nextHallazgos,
      });
      setForms(listForms(projectScope));
      if (activeFormIdRef.current === id) setSource(confirmedSource);
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
      return true;
    } catch {
      await refreshBackendFormIndex().catch(() => undefined);
      const detail = "No se guardó la confirmación. El formulario sigue abierto para que puedas intentarlo nuevamente.";
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
      return false;
    } finally {
      setPublicationUi((prev) => ({
        ...prev,
        confirmingLogicFormId: prev.confirmingLogicFormId === id
          ? null
          : prev.confirmingLogicFormId,
      }));
    }
  }, [projectScope, refreshBackendFormIndex, toasts]);

  // «La lógica y la limpieza se hicieron fuera»: misma ruta que la confirmación.
  const logicaExterna = useLogicaExterna({
    projectScope, activeFormIdRef, setForms, setSource, refreshBackendFormIndex, toasts,
    setPublication: (id, pub) => setPublicationUi((prev) => ({ ...prev, byFormId: { ...prev.byFormId, [id]: pub } })),
    flushPendiente: () => persistence.flushAndSync(),
    onDeclarada: () => { smLogicPanelRef.current.cerrar(); setLogicReviewFormId(null); },
  });

  // Al montar — y al cambiar de proyecto — sembramos la biblioteca
  // multi-formulario: migramos cualquier snapshot legacy mono-formulario,
  // fusionamos las entradas que el backend (.pulso) tenga y que aún no estén
  // en localStorage, y si hay un formulario activo lo hidratamos. Si no hay
  // ninguno, dejamos workbook=null (el espacio de formularios).
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
    setLibraryReady(false);
    setLibraryError(false);
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
        setLibraryError(false);
        backendFormIds = new Set(backend.forms.map((form) => form.id));
        if (backend.active_form_id && !localActive) {
          localActive = backend.active_form_id;
        }
        if (backend.forms.length > 0) {
          formCount = backend.forms.length;
        }
      } catch {
        // Sin backend / sin proyecto: seguimos con lo local, pero sin fingir
        // que la biblioteca está vacía — no lo sabemos.
        if (!cancelled) setLibraryError(true);
      }
      if (cancelled) return;
      // Con VARIOS formularios aterrizamos en el hub (workbook=null → FormsLibrary
      // muestra las tarjetas) para que el usuario elija; solo con UN formulario
      // entramos directo a editarlo. El activo queda apuntado para "Ver todos"
      // / el conmutador del toolbar.
      try {
        if (requestedFormId && requestedFormId === activeFormIdRef.current && workbookRef.current) {
          // La URL sólo acaba de anotar el formulario que ya está abierto
          // (ver el efecto que escribe `form_id`): no hay nada que cambiar.
        } else if (requestedFormId) {
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
        } else if (
          localActive
          && !hubElegidoRef.current
          && (formCount <= 1 || new URLSearchParams(window.location.search).has("pestana"))
        ) {
          // Una dirección que pide una pestaña (`?pestana=impreso`) pide el
          // formulario, no la biblioteca: sin `form_id`, se abre el activo.
          await switchToFormRef.current?.(localActive);
        }
      } finally {
        // El hub ya puede pintarse: o tenemos el índice real, o el backend
        // falló y lo local es todo lo que habrá. Va en `finally` para que un
        // `return` temprano o un error de `switchToForm` no dejen el hub
        // atrapado en su estado de carga.
        if (!cancelled) setLibraryReady(true);
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
        irPestanaRef.current("constructor");
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
  // para el selector de la pestaña Impreso.
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

  /** Desde otra pestaña (mapa, resumen, prueba, avisos): la fila queda elegida en el Constructor. */
  const irAFila = useCallback((rowIndex: number) => {
    selectBuilderFocus({ kind: "survey", rowIndex });
    irPestana("constructor");
  }, [irPestana, selectBuilderFocus]);

  // `?pestana=constructor&foco=<name>` (p. ej. desde Impreso › Papel por
  // pregunta): la pregunta queda elegida. Una sola vez por valor de `foco`: si
  // después se elige otra, editar no la devuelve a la del enlace.
  const focoPregunta = pestana === "constructor" && !pestanaEditor.panel ? pestanaEditor.foco : null;
  const focoAplicadoRef = useRef<string | null>(null);
  useEffect(() => {
    if (pestana !== "constructor") focoAplicadoRef.current = null;
  }, [pestana]);
  useEffect(() => {
    if (!focoPregunta || !structure || focoAplicadoRef.current === focoPregunta) return;
    const nodo = structure.outline.find((n) => n.name === focoPregunta);
    if (!nodo) return;
    focoAplicadoRef.current = focoPregunta;
    selectBuilderFocus({ kind: "survey", rowIndex: nodo.rowIndex });
  }, [focoPregunta, structure, selectBuilderFocus]);

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
  useActivePublicationRefresh(workbook ? activeFormId : null, lastSavedAt, refreshBackendFormIndex);
  const listasPanel = useListasOpcionesPanel();
  // 2026-10-16: el catálogo es la pestaña «Listas de opciones». Lo que abría el panel lateral o el diálogo lleva ahí,
  // y un enlace viejo con `?panel=catalogos` o `?panel=listas-opciones` aterriza en la pestaña.
  const abrirPestanaListas = useCallback(() => irPestana("opciones"), [irPestana]);
  useEffect(() => {
    if (catalogosPanel.abierto || listasPanel.abierto) irPestana("opciones", { replace: true });
  }, [catalogosPanel.abierto, listasPanel.abierto, irPestana]);
  const escalasRepetidas = useMemo(() => contarEscalasRepetidas(workbook), [workbook]);
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
      // La pestaña no se resetea: es la dirección (un enlace a `?pestana=impreso`
      // abre el formulario restaurado en Impreso, no en el Constructor).
      setBuilderWorkspaceMode("focus");
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
        title: "Borrador importado como nuevo",
        detail: `Abrimos ${file.name} como un formulario nuevo. Revisa lógica y público antes de publicar.`,
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
    if (!workbook || !activeFormId) return;
    const isReviewConfirmation = logicReviewFormId === activeFormId;
    const visualText = compileVisualLogicRules(smVisualLogicRules);
    const advancedText = smLogicRules.map((r) => r.texto).join("\n");
    const reglasText = [visualText, advancedText].filter((part) => part.trim()).join("\n");
    if (!reglasText.trim() && !isReviewConfirmation) {
      toasts.push({
        kind: "warn",
        title: "Sin lógica configurada",
        detail: "Configura al menos un salto visual o una regla avanzada antes de aplicar.",
      });
      return;
    }
    setBusy(isReviewConfirmation ? "Guardando la revisión de lógica…" : "Aplicando lógica SurveyMonkey…");
    try {
      let nextWorkbook = workbook;
      let refreshedRules = smLogicRules;
      if (reglasText.trim()) {
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
        refreshedRules = await refreshSurveyMonkeyAdvancedRules(
          smLogicRules,
          workbookWithSurveyMonkeyLogic(result.workbook, smLogicRules, smVisualLogicRules, smLogicChoiceOverrides, choiceCodeMaps),
          smLogicChoiceOverrides,
        );
        nextWorkbook = workbookWithSurveyMonkeyLogic(
          result.workbook,
          refreshedRules,
          smVisualLogicRules,
          smLogicChoiceOverrides,
          choiceCodeMaps,
        );
      }
      setSmLogicRules(refreshedRules);
      if (isReviewConfirmation) {
        const confirmed = await persistAndConfirmFormLogic(
          activeFormId,
          nextWorkbook,
          source,
          hallazgos,
        );
        if (!confirmed) return;
        setLogicReviewFormId(null);
      } else {
        dispatch({ type: "SET", workbook: nextWorkbook });
        setArtifact(null);
        toasts.push({
          kind: "success",
          title: "Lógica SurveyMonkey recalculada",
          detail: "Los saltos del modal reemplazaron la lógica previa en los destinos afectados.",
        });
      }
      smLogicPanelRef.current.cerrar();
    } catch {
      toasts.push({
        kind: "danger",
        title: "No se pudo aplicar la lógica",
        detail: "Revisa la sesión del proyecto e inténtalo nuevamente. Tus cambios siguen abiertos en el editor.",
      });
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
        normalizeXlsformFormSource(source),
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
    exportOptions: XlsformPaperExportOptions = {},
  ) {
    if (!workbook) return;
    const isWord = format === "word";
    const label = isWord ? "Word" : "PDF";
    const ext = isWord ? "docx" : "pdf";
    resetMessages();
    setArtifact(null);
    setBusy(textoExportando(label, ""));
    try {
      const exportableWorkbook = { ...workbook, diagnostico: null };
      const exportFn = isWord ? apiXlsformEditorExportWord : apiXlsformEditorExportPdf;
      const filename = isWord
        ? wordFilenameFromSource(source?.original_name)
        : pdfFilenameFromSource(source?.original_name);
      const job = await exportFn(
        exportableWorkbook,
        filename,
        exportOptions,
      );
      const out = await esperarExportPapel(job.job_id, {
        onFase: (fase) => setBusy(textoExportando(label, fase)),
      });
      setArtifact({ file_id: out.file_id, original_name: out.original_name, extension: ext });
      setStatus(`Listo: generamos ${out.original_name}.`);
      const warnDetail = exportWarningDetail(out.warnings);

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
    hubElegidoRef.current = true;
    // La biblioteca no es una pestaña del formulario: se quitan su `form_id`,
    // su `pestana` y su `foco`, o recargar reabriría el formulario.
    const hub = new URLSearchParams(searchConFormId(location.search, null));
    hub.delete("pestana");
    hub.delete("foco");
    const hubSearch = hub.toString() ? `?${hub.toString()}` : "";
    if (hubSearch !== location.search) {
      navigate({ pathname: location.pathname, search: hubSearch }, { replace: true });
    }
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

  // Editor XLSForm: celdas, filas y columnas en bruto (state/manejadoresHojas.ts).
  const { sheetsUpdateCell, sheetsAddRow, sheetsDeleteRow, sheetsMoveRow, sheetsAddColumn } = crearManejadoresHojas(
    updateWorkbook,
    (cambiadas, anterior, nuevo) =>
      toasts.push({
        kind: "info",
        title: "Referencias actualizadas",
        detail: `${cambiadas} ${cambiadas === 1 ? "celda" : "celdas"} con \${${anterior}} → \${${nuevo}}.`,
      }),
  );

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
  // Foco de la lista de lógica → fila a enfocar en el mapa: «seccion:<fila>» o el nombre de la variable.
  const filaFocoLogica = useMemo(() => {
    const foco = pestana === "logica" ? pestanaEditor.foco : null;
    if (!foco || !structure) return null;
    if (foco.startsWith("seccion:")) return Number(foco.slice(8));
    return structure.outline.find((n) => n.name === foco)?.rowIndex ?? null;
  }, [pestana, pestanaEditor.foco, structure]);
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
      auditReady={workbook ? "xlsform-editor" : undefined /* el hub: lo decide FormsLibrary */}
      resetScrollKey={`${workbook ? "workbook" : "empty"}:${pestana}`}
      toolbar={workbook ? (
        <EditorCommandBar
          switcher={{
            forms,
            activeFormId,
            activeName: activeFormName,
            canCreate: canCreateForm,
            onSwitch: (id) => { void switchToForm(id); },
            onNew: onNewWorkbook,
            onViewAll: onBackToHub,
          }}
          metrics={{
            fields: suiteMetrics.fields,
            sections: suiteMetrics.sections,
            catalogs: catalogs.length,
            readyCatalogs: readyCatalogsCount,
          }}
          source={source}
          dirty={dirty}
          lastSavedAt={lastSavedAt}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={() => dispatch({ type: "UNDO" })}
          onRedo={() => dispatch({ type: "REDO" })}
          listas={{ repetidas: escalasRepetidas, onOpen: abrirPestanaListas }}
          diagnostics={diagnostics}
          publication={activeFormId ? publicationUi.byFormId[activeFormId] ?? null : null}
          selection={selection}
          onSelectRow={irAFila}
          onFocusCatalog={(name) => {
            setCatalogFocus(name);
            irPestana("opciones");
          }}
          onReviewLogic={activeFormId ? () => { void openFormLogicReview(activeFormId); } : undefined}
          logicaExterna={activeFormId ? { formId: activeFormId, acciones: logicaExterna } : undefined}
          canCreate={canCreateForm}
          maxForms={MAX_FORMS}
          onNewBlank={onNewWorkbook}
          onImportXlsform={() => xlsInputRef.current?.click()}
          onImportSurveyMonkey={onImportSurveyMonkey}
          includeAppColumns={includeAppColumns}
          onIncludeAppColumnsChange={setIncludeAppColumns}
          onExport={onExport}
          onOpenDocument={() => irPestana("impreso")}
          busy={!!busy}
        />
      ) : undefined}
    >
      {/*
        El frame mantiene el header del editor fijo dentro del viewport.
        Las zonas pesadas (outline, canvas, inspector, hojas y overlays)
        siguen controlando su propio scroll interno.
      */}
      {error && <ErrorBlock label="No pudimos abrir el editor" detail={error} />}

      {/* Input file oculto para "Importar XLSForm" — disponible siempre,
          tanto desde el espacio de formularios como desde la barra del
          editor con workbook. */}
      <input
        ref={xlsInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: "none" }}
        onChange={(e) => void onImportXls(e.target.files?.[0])}
      />

      {/* Sin workbook abierto, el módulo muestra su único homepage: el
          espacio de formularios. Una sola composición para 0..6 formularios
          —encabezado, grilla y pie no cambian con los datos— con las tres vías
          de creación dentro de su celda. */}
      {!workbook && (
        <FormsLibrary
          forms={forms}
          loading={!libraryReady}
          loadFailed={libraryError}
          onRetryLoad={() => {
            setLibraryError(false);
            setLibraryReady(false);
            void refreshBackendFormIndex()
              .then(() => setLibraryError(false))
              .catch(() => setLibraryError(true))
              .finally(() => setLibraryReady(true));
          }}
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
          onConfirmLogic={(id) => { void openFormLogicReview(id); }}
          logicaExterna={logicaExterna}
          actorOptions={instrumentActors}
          actorCatalogStatus={instrumentActorCatalog.status}
          assigningActorFormId={assigningActorFormId}
          onActorChange={(id, actorKey) => { void onAssignFormActor(id, actorKey); }}
          onNewBlank={onNewWorkbook}
          onImportXls={() => {
            if (blockUntilRestoreDecision("importar otro XLSForm")) return;
            xlsInputRef.current?.click();
          }}
          onImportSurveyMonkey={onImportSurveyMonkey}
          onCampaignsChanged={() => { void refreshBackendFormIndex().catch(() => undefined); }}
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

      {/* En Impreso el progreso vive en el botón de su cabecera y el resultado
          llega como aviso (con «Descargar» si no hay proyecto): estos dos
          paneles empujaban la pestaña hacia abajo mientras exportaba. */}
      {busy && pestanaEditor.pestana !== "impreso" && (
        <Panel title="Procesando" hint={busy}>
          <LoadingBlock label={busy} variant="inline" minHeight={88} />
        </Panel>
      )}

      {workbook && artifact && !(pestanaEditor.pestana === "impreso" && artifact.extension !== "xlsx") && (
        <Panel
          title={artifact.extension === "xlsx" ? "XLSForm listo" : "Documento listo"}
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
          {artifact.extension === "xlsx" ? (
            <div style={{ marginTop: 10 }}>
              <XlsformTransferNotice variant="export" compact />
            </div>
          ) : null}
        </Panel>
      )}

      {/* El espacio de formularios de arriba ya cubre el caso "sin workbook".
          Antes había un `EmptyState` duplicado aquí que repetía las mismas 3
          acciones — eliminado para no doblar el mensaje. */}

      {workbook && (
        <>
          {/* Antes acá iba `BuilderToolsDeck` con catálogos + diagnostics +
              índice en una grilla de 3 columnas que competía por ancho con
              el constructor. En el revamp Sub-PR 4b:
                - Catálogos → botón "Catálogos" en este header → ContextLens.
                - Diagnostics → ícono colapsable (DiagnosticsBadge) en este
                  header → popover floating al click.
                - Índice → CollapsibleSection abajo, no en columna lateral. */}

          <EditorPestanas pestana={pestana} onCambiar={(destino) => irPestana(destino)}>
            {(pestana === "constructor" || pestana === "hojas") && (
                <EditorSmImportNotice
                  formId={activeFormId}
                  source={source}
                  repetidas={escalasRepetidas}
                  onOpenListas={abrirPestanaListas}
                />
            )}
            {pestana === "hojas" && (
              <SheetsView
                workbook={workbook}
                scope={logicScope}
                structure={structure}
                diagnostics={diagnostics}
                onUpdateCell={sheetsUpdateCell}
                onAddRow={sheetsAddRow}
                onDeleteRow={sheetsDeleteRow}
                onMoveRow={sheetsMoveRow}
                onAddColumn={sheetsAddColumn}
              />
            )}
            {pestana === "constructor" && (
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
                        <small>{formatFieldSectionPair(suiteMetrics.fields, suiteMetrics.sections)}</small>
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
                      irPestana("opciones");
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
                        irPestana("opciones");
                      },
                    }}
                  />

                </div>
              </div>
            )}
            {pestana === "cuestionario" && (
              <VistaCuestionario
                workbook={workbook}
                structure={structure}
                logicaPendiente={deriveEditorHeaderStatus(diagnostics, activeFormId ? publicationUi.byFormId[activeFormId] ?? null : null, source).logicStepPending}
                onRevisarLogica={activeFormId ? () => { void openFormLogicReview(activeFormId); } : undefined}
                abierta={pestanaEditor.foco}
                onAbrir={fijarFocoEnSitio}
                onEditar={irAPregunta}
              />
            )}
            {/* El mapa queda montado aunque se cambie de pestaña: conserva zoom y
                encuadre entre visitas (como hacía el overlay). */}
            <div className={pestana === "logica" ? "xfl-logica" : "xfl-logica is-oculta"}>
              {pestana === "logica" && (
                <ListaLogica structure={structure} scope={logicScope} seleccionada={pestanaEditor.foco} onSeleccionar={fijarFocoEnSitio} />
              )}
              <LogicCanvas
                embebido
                seleccionFila={filaFocoLogica}
                open={pestana === "logica"}
                structure={structure}
                catalogs={catalogs}
                onEditarEnConstructor={irAFila}
                acciones={(
                  <button
                    type="button"
                    className="pulso-graph-allbutton"
                    onClick={() => {
                      setLogicReviewFormId(null);
                      smLogicPanel.abrir();
                    }}
                    title="Editar, agregar o reutilizar reglas de salto de SurveyMonkey sin regenerar el XLSForm"
                  >
                    Lógica de SurveyMonkey
                  </button>
                )}
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
            </div>
            {pestana === "restricciones" && (
              <PestanaRestricciones structure={structure} scope={logicScope} seleccionada={pestanaEditor.foco} onSeleccionar={fijarFocoEnSitio} onEditar={irAFila} onCampo={updateSurveyField} onCampos={updateSurveyFields} catalogs={catalogs} />
            )}
            {pestana === "calculos" && (
              <PestanaCalculos structure={structure} scope={logicScope} seleccionada={pestanaEditor.foco} onSeleccionar={fijarFocoEnSitio} onEditar={irAFila} onCampo={updateSurveyField} catalogs={catalogs} />
            )}
            {pestana === "opciones" && workbook && (
              <PestanaOpciones
                workbook={workbook}
                onWorkbookChange={(next) => { dispatch({ type: "SET", workbook: next }); setArtifact(null); }}
                structure={structure}
                catalogs={catalogs}
                seleccionada={pestanaEditor.foco ?? activeCatalogName}
                onSeleccionar={(name) => { setCatalogFocus(name); fijarFocoEnSitio(name); }}
                onCrear={() => createCatalog(false)}
                onRename={renameCatalog}
                onAddChoice={addCatalogChoice}
                onChoiceChange={updateChoiceFields}
                onChoiceRemove={removeChoice}
                onChoiceMove={moveChoice}
                onDeleteCatalog={deleteCatalogAction}
                onIrAPregunta={irAPregunta}
              />
            )}
            {pestana === "filtros" && (
              <ChoiceFiltersView
                open
                structure={structure}
                choicesColumns={workbook.choices.columns}
                choicesRows={workbook.choices.rows}
                seleccionada={pestanaEditor.foco}
                onSeleccionar={fijarFocoEnSitio}
                onEditar={irAFila}
                workbook={workbook}
                catalogs={catalogs}
                onWorkbookChange={(next) => { dispatch({ type: "SET", workbook: next }); setArtifact(null); }}
              />
            )}
            {pestana === "probar" && (
              <FormSimulator
                workbook={workbook}
                structure={structure}
                onEditRow={irAFila}
              />
            )}
            {pestana === "resumen" && (
              <FormSummaryView
                workbook={workbook}
                structure={structure}
                diagnostics={diagnostics}
                onSelectRow={irAFila}
                seccionAbierta={pestanaEditor.foco}
                onSeccionAbierta={fijarFocoEnSitio}
                contexto={contextoResumen(
                  deriveEditorHeaderStatus(diagnostics, activeFormId ? publicationUi.byFormId[activeFormId] ?? null : null, source),
                  {
                    formId: activeFormId,
                    escalasRepetidas,
                    onRevisarLogica: activeFormId ? () => { void openFormLogicReview(activeFormId); } : undefined,
                    onAbrirListas: abrirPestanaListas,
                    onIrAPregunta: irAPregunta,
                    onIrImpreso: () => irPestana("impreso"),
                  },
                )}
              />
            )}
            {pestana === "impreso" && (
              <PestanaImpreso
                key={`${projectScope ?? "no-project"}::${activeFormId ?? "no-form"}`}
                formId={activeFormId}
                workbook={workbook}
                structure={structure}
                storageKey={pdfDialogStorageKey(projectScope, activeFormId)}
                candidatas={matrixCandidates}
                consentimiento={consentQuestions}
                nombrePdf={pdfFilenameFromSource(source?.original_name)}
                parte={pestanaEditor.foco}
                onParte={(parte) => pestanaEditor.fijarFoco(parte)}
                onExportar={(formato, opciones) => { void onExportForm(formato, opciones); }}
                onIrAPregunta={irAPregunta}
                onCampoPapel={updateSurveyField}
                ocupado={busy}
              />
            )}
          </EditorPestanas>

          {/* "Índice del instrumento" eliminado — la información que ofrece
              (variables, dependencias, referencias faltantes) ya está
              disponible en el Mapa de lógica y los avisos. */}
        </>
      )}


      {/* Coachmarks de primer uso — solo aparecen cuando hay workbook con
          contenido editable y el flag `firstUseDone` no está seteado. */}
      {workbook && hasEditableContent && <Coachmarks />}

      <LogicaExternaDialogo control={logicaExterna} formName={forms.find((f) => f.id === logicaExterna.formId)?.name ?? null} />
	      {smLogicDialogOpen && workbook ? createPortal((
	        <SurveyMonkeyLogicPopup
	          workbook={workbook}
	          sourceName={source?.original_name ?? null}
	          rules={smLogicRules}
	          visualRules={smVisualLogicRules}
	          existingKoboLogic={extractExistingKoboLogic(workbook)}
	          overrides={smLogicChoiceOverrides}
	          busy={Boolean(busy)}
	          reviewConfirmation={logicReviewFormId === activeFormId}
	          alternativa={activeFormId && logicReviewFormId === activeFormId ? <LogicaExternaDisparador formId={activeFormId} acciones={logicaExterna} /> : null}
	          onLogicDraftChange={updateSurveyMonkeyLogicDraft}
	          onRulesChange={(nextRules) => updateSurveyMonkeyLogicDraft(nextRules)}
	          onVisualRulesChange={updateSurveyMonkeyVisualRulesDraft}
	          onOverridesChange={updateSurveyMonkeyOverridesDraft}
	          onClose={() => {
	            smLogicPanel.cerrar();
	            setLogicReviewFormId(null);
	          }}
	          onApply={applySurveyMonkeyLogicFromEditor}
	        />
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
          onCampaignDeclared={({ formName }) => {
            setSmImportDialog(null);
            void refreshBackendFormIndex().catch(() => undefined);
            toasts.push({ kind: "success", title: "Campaña agregada", detail: `Quedó declarada en «${formName}».`, durationMs: 6000 });
          }}
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

