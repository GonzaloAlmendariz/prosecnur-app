import { useEffect, useRef, useState } from "react";
import type { CambiosDeRespuestas } from "../../api/estudio";
import type { DataPreview } from "./RespuestasResumen";
import {
  apiCargaReview,
  apiCargaReviewSummary,
  apiCargaReviewReconciliation,
  apiCargaConfirmChoiceMapping,
  apiEstudioGet,
  apiEstudioInit,
  apiEstudioSetTopology,
  CargaMonitoreoHandoffStatus,
  CargaPlatformImportResult,
  ChoiceCodeMapReview,
  CargaReviewPayload,
  CargaReviewSummaryPayload,
  EstudioPayload,
  EstudioProcessingSuggestions,
  ReconciliacionInfo,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { useSeccion } from "../../lib/navegacion/useDireccion";
import { pestanasCargaDisponibles } from "../../lib/navegacion/catalogos/procesamiento";
import { toast } from "../../components/toasterStore";
import "./carga-v2.css";
import "./carga-sources.css";
import "./carga-scroll-corto.css";
import { PageFrame } from "../../components/PageFrame";
import { ChoiceMappingReviewDialog } from "./ChoiceMappingReviewDialog";
import { ReconciliacionExtraDialog } from "./ReconciliacionExtraDialog";
import { useCargaStore, type CargaTopologyIntent, type MultiBaseStrategy } from "./store";
import {
  equivalenciasDisponibles,
  type CargaWorkspaceContext,
  type CargaWorkspaceTab,
} from "./CargaWorkspaceModel";
import {
  PESTANA_CARGA_POR_DEFECTO,
  avisoPestanaNoDisponible,
  clavePedidaCarga,
  pestanaPedidaDeDireccion,
  resolverPestanaCarga,
} from "./pestanaCarga";
import type { CargaMonitoringDiscoveryResult } from "./CargaMonitoringDiscovery";
import type { ProcessingSourcesProfile } from "./CargaSourcesModel";
import { CargaHidratando } from "./CargaHidratando";
import { marcaReadinessCarga } from "./cargaHidratacion";
import {
  CARGA_REVISION_SIN_LEER,
  baseRevisadaElegida,
  cargaRevisionEstadoLectura,
  type CargaRevisionLectura,
} from "./cargaRevisionLecturaModel";
import { baseDeLaDireccion } from "./fuentesEmparejamientoModel";
import { exitoDe, useImportsDeCarga } from "./plataforma/useImportsDeCarga";
import {
  cargaSourceModes,
  choiceMappingReviewFromPreview,
  dataPreviewNormalizationDetails,
  markChoiceMappingConfirmed,
  reviewReconciliationInfo,
  type InstrumentoResumen,
  type SourceMode,
} from "./pestanas/cargaPaginaModelo";
import { quitarInsumo, subirInsumo, usarFormularioDelEditor } from "./pestanas/accionesDeInsumos";
import { AvisosDeCarga } from "./pestanas/AvisosDeCarga";
import { usePanelDireccionable } from "../../lib/navegacion/paneles";
import { PANEL_AGREGAR_BASE } from "./panelesCarga";
import { traerTrabajoDeCampo } from "./pestanas/traerTrabajoDeCampo";
import { MesaDeCarga } from "./pestanas/MesaDeCarga";
import { revisionConPendientes } from "./pestanas/revision/comprobacionesModel";
import { useModeloCarga } from "./pestanas/useModeloCarga";
import { usePlataformaCarga } from "./pestanas/usePlataformaCarga";
import { PestanaBases } from "./pestanas/PestanaBases";
import { PestanaEquivalencias } from "./pestanas/PestanaEquivalencias";
import { PestanaFormulario } from "./pestanas/PestanaFormulario";
import { PestanaRespuestas } from "./pestanas/PestanaRespuestas";
import { PestanaRevision } from "./pestanas/PestanaRevision";
import { PestanaVariables } from "./pestanas/PestanaVariables";
import { etiquetaDeBase } from "./pestanas/bases/basesModel";
import { BASE_UNICA, baseDeVariables, type ContextoDeCarga } from "./pestanas/contextoDeCarga";
import { useEstructuraDeBase, useLecturaDeEstructura } from "./pestanas/useEstructuraDeBase";
import { useElegirBaseDeVariables } from "./pestanas/useElegirBaseDeVariables";

// Fase 1 — Carga de insumos.
//
// El analista sube su propio XLSForm + base de datos. Cada archivo se parsea
// y muestra un resumen con contadores.
//
// Tras la carga, esta página muestra la estructura del instrumento
// (secciones + preguntas con reglas) para que el analista verifique
// antes de pasar a Validación.

export { cargaSourceModes };
export type { SourceMode };


export default function CargaPage() {
  const { sessionId, state, refresh, error: errorSesion } = useSession();
  const cargaDireccion = useSeccion("procesamiento");
  const elegirBaseDeVariables = useElegirBaseDeVariables();
  const topologyIntent = useCargaStore((store) => store.topologyIntent);
  const setTopologyIntent = useCargaStore((store) => store.setTopologyIntent);
  const multiBaseStrategy = useCargaStore((store) => store.strategy);
  const setMultiBaseStrategy = useCargaStore((store) => store.setStrategy);
  const plannedInputCount = useCargaStore((store) => store.plannedInputCount);
  const setPlannedInputCount = useCargaStore((store) => store.setPlannedInputCount);
  const [instrumento, setInstrumento] = useState<InstrumentoResumen | null>(null);
  const [dataPreview, setDataPreview] = useState<DataPreview | null>(null);
  // Al reemplazar las respuestas: qué cambió y si hay que volver a adaptar.
  const [cambiosRespuestas, setCambiosRespuestas] = useState<CambiosDeRespuestas | null>(null);
  const [choiceMappingReview, setChoiceMappingReview] = useState<ChoiceCodeMapReview | null>(null);
  const estadoEstructura = useEstructuraDeBase();
  const { estructura, setEstructura, esquemaBase, setEsquemaBase } = estadoEstructura;
  const [error, setError] = useState<string>("");
  const agregarBaseAbierto = usePanelDireccionable(PANEL_AGREGAR_BASE).abierto;
  const [busy, setBusy] = useState<string>("");
  const feedbackRef = useRef<HTMLDivElement | null>(null);
  const normalizationDetails = dataPreviewNormalizationDetails(dataPreview);
  const [forceMultiBase, setForceMultiBase] = useState(false);
  const [preferredMultiStrategy, setPreferredMultiStrategy] = useState<MultiBaseStrategy | undefined>(undefined);
  const monitoringReviewActionLabel = "Revisar Monitoreo";
  const [selectedCargaBase, setSelectedCargaBase] = useState("");
  // L5b: los imports de plataforma corren en el store (sobreviven a cambiar de
  // pestaña y se cancelan); aquí solo se aplica lo que dejaron en el estudio.
  const importsPlataforma = useImportsDeCarga(({ terminado }) => {
    const exito = exitoDe(terminado);
    if (!exito) return;
    if (exito.unico) applyPlatformImportResult(exito.unico);
    if (exito.estudio) void onEstudioChanged(exito.estudio);
    void refresh();
  });
  const {
    plataforma,
    setPlatformProvider,
    setFuenteDestino,
    vistaPreviaFuente,
    setVistaPreviaFuente,
    onPlatformImport,
  } = usePlataformaCarga({
    importsPlataforma,
    leerContexto: () => ({ estudio, esVarias: topologyResolution.mode === "multi", estrategia: sourceStrategy }),
    ocupado: !!busy,
    setBusy,
    setError,
    onEstudioChanged,
    refresh,
  });
  const [processingSuggestions, setProcessingSuggestions] = useState<EstudioProcessingSuggestions | null>(null);
  const [monitoringReviewed, setMonitoringReviewed] = useState(false);
  const [monitoringProfile, setMonitoringProfile] = useState<ProcessingSourcesProfile | null>(null);
  const [intakeRefreshToken, setIntakeRefreshToken] = useState(0);
  const [handoffStatus, setHandoffStatus] = useState<CargaMonitoreoHandoffStatus | null>(null);
  const [selectedMonitoringSourceId, setSelectedMonitoringSourceId] = useState<string | null>(null);
  const [handoffMessage, setHandoffMessage] = useState("");
  // Revisión autoritativa de la base elegida. El diálogo existente recibe una
  // adaptación de `reconciliation`, sin mantener un segundo motor de decisión.
  const [cargaReview, setCargaReview] = useState<CargaReviewPayload | null>(null);
  const [cargaReviewSummary, setCargaReviewSummary] = useState<CargaReviewSummaryPayload | null>(null);
  // Para qué base terminó cada lectura de Revisión: sin ella la vista se
  // declaraba lista y "Sin incidencias" mientras todavía leía.
  const [revisionLectura, setRevisionLectura] = useState<CargaRevisionLectura>(CARGA_REVISION_SIN_LEER);
  const [reconDialogOpen, setReconDialogOpen] = useState(false);
  const planningSeedRef = useRef("");
  const reconInfo = cargaReview ? reviewReconciliationInfo(cargaReview) : null;

  const efectosDeInsumos = {
    setError, setBusy, setInstrumento, setEstructura, setDataPreview, setCambiosRespuestas,
    setChoiceMappingReview, refresh, leerRevision: loadReconciliacion,
  };
  const onQuitar = (kind: "xlsform" | "data") => quitarInsumo(kind, efectosDeInsumos);
  const onPick = (kind: "xlsform" | "data", file?: File) =>
    subirInsumo(kind, file, { ...efectosDeInsumos, tieneFormulario: !!state?.xlsform });

  function applyPlatformImportResult(result: CargaPlatformImportResult) {
    setInstrumento(result.resumen);
    setDataPreview(result.preview);
    const review = choiceMappingReviewFromPreview(result.preview);
    setChoiceMappingReview(review?.requires_confirmation ? review : null);
    setEstructura(null);
  }

  // Consulta la revisión autoritativa de la misma base que luego recibirá la
  // reconciliación. Una cadena vacía representa la base legacy y el cliente la
  // serializa sin query (GET) o como `base_nombre: null` (POST).
  async function loadReconciliacion(openIfExtra: boolean) {
    try {
      const review = await apiCargaReview(selectedCargaBase);
      setCargaReview(review);
      if (openIfExtra && review.reconciliation.n_pendientes > 0) {
        setReconDialogOpen(true);
      }
    } catch {
      setCargaReview(null);
    }
  }

  async function loadReviewSummary() {
    if (!isMultiBase) {
      setCargaReviewSummary(null);
      return null;
    }
    try {
      const summary = await apiCargaReviewSummary();
      setCargaReviewSummary(summary);
      return summary;
    } catch {
      setCargaReviewSummary(null);
      return null;
    }
  }

  async function onSaveReconciliacion(incluidas: string[]): Promise<ReconciliacionInfo> {
    const review = await apiCargaReviewReconciliation(selectedCargaBase, incluidas);
    setCargaReview(review);
    if (isMultiBase) await loadReviewSummary();
    return reviewReconciliationInfo(review);
  }

  const onBringFieldWorkToProcessing = () => traerTrabajoDeCampo({
    traspaso: handoffStatus,
    perfil: monitoringProfile,
    fuenteSeleccionada: selectedMonitoringSourceId,
    setError,
    setBusy,
    setAviso: setHandoffMessage,
    refresh,
    leerRevision: loadReconciliacion,
  });

  const {
    hasXlsform,
    hasData,
    pendingChoiceMapping,
    allReady,
    showFieldWorkHandoff,
    declaredTopology,
    isMultiBase,
    estudio,
    setEstudio,
    reintentarEstudio,
    hidratacion,
    cargaBaseOptions,
    topologyBases,
    multiBaseInstrumentCount,
    multiBaseDataCount,
    cargaBaseSignature,
    showInspection,
    workspaceHasInstrument,
    workspaceHasData,
    topologyHasStudy,
    topologyResolution,
    resolvedTopologyIntent,
    topologyIntentStrategy,
    sourceStrategy,
    materializedInputCount,
  } = useModeloCarga({
    state,
    errorSesion,
    dataPreview,
    estructura,
    handoffStatus,
    forceMultiBase,
    preferredMultiStrategy,
    topologyIntent,
    multiBaseStrategy,
  });
  // Conteo de la equivalencia declarada, para que la pestaña diga si hay trabajo
  // hecho sin obligar a abrirla.
  // `null` hasta que Equivalencias la lee; así la pestaña dice "Revisando" y
  // no un "Pendiente" que todavía no sabe.
  const [equivalenciasFilas, setEquivalenciasFilas] = useState<number | "error" | null>(null);
  // Variables lee la base elegida: mientras tanto la página no se declara lista.
  const [variablesLeyendo, setVariablesLeyendo] = useState(false);
  const reviewHasIssues = Boolean(cargaReview) && revisionConPendientes(cargaReview, false);
  const revisionEstado = cargaRevisionEstadoLectura({
    isMultiBase,
    baseSeleccionada: selectedCargaBase,
    basesPrimarias: topologyBases.map((base) => base.nombre),
    insumosListos: Boolean(state?.instrumento_parsed && state?.data_previewed),
    // Con la misma condición con que cada rama monta el filtro de universo.
    universoBase: isMultiBase
      ? selectedCargaBase || null
      : hasData && !pendingChoiceMapping ? "" : null,
    lectura: revisionLectura,
  });
  function marcarLecturaUniverso(base: string, leida: boolean) {
    setRevisionLectura((lectura) => ({ ...lectura, universo: leida ? base : null }));
  }
  // `foco=<base>:<survey_id>` del panel de emparejamiento: la base que nombra
  // el enlace es la que Revisión debe mostrar.
  const baseDelEnlace = baseDeLaDireccion(cargaDireccion.panel, cargaDireccion.foco);
  // ADR 0142: la pestaña pedida, con las claves viejas leídas como alias y el
  // panel lateral de variables leído como la pestaña Variables.
  const pestanaPedida = pestanaPedidaDeDireccion({ pestana: cargaDireccion.pestana, panel: cargaDireccion.panel });
  const clavePedida = clavePedidaCarga(pestanaPedida);
  const workspaceContext: CargaWorkspaceContext = {
    hasInstrument: workspaceHasInstrument,
    hasData: workspaceHasData,
    hasBase: isMultiBase ? topologyBases.length > 0 : hasData,
    hasReviewIssues: pendingChoiceMapping || reviewHasIssues,
    isMultiBase,
    baseCount: isMultiBase ? topologyBases.length : hasData ? 1 : 0,
    instrumentBaseCount: isMultiBase ? multiBaseInstrumentCount : undefined,
    dataBaseCount: isMultiBase ? multiBaseDataCount : undefined,
    // ADR 0062: la equivalencia entre públicos sólo significa algo cuando las
    // bases NO comparten instrumento. Espejo del predicado del backend (ADR 0061).
    basesSeparadas: equivalenciasDisponibles({
      topologiaDeclarada: declaredTopology,
      modoProcesamiento: state?.estudio_processing_mode,
      basesPrimarias: topologyBases.length,
    }),
    equivalenciasDeclaradas: equivalenciasFilas,
    equivalenciasLeyendo: clavePedida === "equivalencias" && equivalenciasFilas === null,
    // Solo mientras se mira Revisión: en otras pestañas no se lee y la marca
    // se quedaría en "Revisando" para siempre.
    revisionLeyendo: clavePedida === "revision" && !revisionEstado.datosLeidos,
  };
  // Lo que el estudio ofrece solo se sabe con la página hidratada: antes, la
  // pestaña pedida se muestra tal cual en la silueta y no se corrige nada.
  const resolucion = hidratacion.fase === "lista"
    ? resolverPestanaCarga(
      pestanaPedida,
      pestanasCargaDisponibles({ basesSeparadas: Boolean(workspaceContext.basesSeparadas) }).map((tab) => tab.key),
    )
    : { pestana: clavePedida ?? PESTANA_CARGA_POR_DEFECTO, noDisponible: null };
  const activeCargaTab = resolucion.pestana;

  // Una dirección que pide una pestaña que este estudio no ofrece (Equivalencias
  // con una sola base) no aterriza muda en Bases: se corrige la dirección y se
  // dice por qué (mismo patrón que Analítica).
  useEffect(() => {
    if (!resolucion.noDisponible) return;
    const aviso = avisoPestanaNoDisponible(resolucion.noDisponible);
    cargaDireccion.irA("pestana", null, { replace: true });
    toast.info(aviso.mensaje, aviso.detalle ? { detalle: aviso.detalle } : undefined);
  }, [resolucion.noDisponible]);

  // Revisión solo opera sobre bases primarias. Datos conserva su selector
  // completo (incluidos repeats); la normalización ocurre únicamente al entrar
  // en esta pestaña.
  useEffect(() => {
    if (activeCargaTab !== "revision" || !isMultiBase || topologyBases.length === 0) return;
    const basesPrimarias = topologyBases.map((base) => base.nombre);
    setSelectedCargaBase((actual) => baseRevisadaElegida({
      actual,
      basesPrimarias,
      baseDeLaDireccion: baseDelEnlace,
      baseActiva: estudio?.active_base,
    }));
  }, [activeCargaTab, baseDelEnlace, cargaBaseSignature, estudio?.active_base, isMultiBase]);

  // La lectura depende de pestaña + base. No usa el endpoint legacy que resolvía
  // implícitamente contra `active_base` y podía guardar otra base distinta.
  useEffect(() => {
    if (activeCargaTab !== "revision") return;
    if (!isMultiBase) {
      if (!state?.instrumento_parsed || !state?.data_previewed) {
        setCargaReview(null);
        return;
      }
    }
    if (isMultiBase && !topologyBases.some((base) => base.nombre === selectedCargaBase)) {
      setCargaReview(null);
      return;
    }
    let cancelled = false;
    setCargaReview(null);
    setRevisionLectura((lectura) => ({ ...lectura, revision: null }));
    apiCargaReview(selectedCargaBase)
      .then((review) => {
        if (!cancelled) setCargaReview(review);
      })
      .catch(() => {
        if (!cancelled) setCargaReview(null);
      })
      .finally(() => {
        // La base de esta corrida del efecto: un cambio posterior la cancela.
        if (!cancelled) setRevisionLectura((lectura) => ({ ...lectura, revision: selectedCargaBase }));
      });
    return () => { cancelled = true; };
  }, [activeCargaTab, cargaBaseSignature, isMultiBase, selectedCargaBase, state?.data_previewed, state?.instrumento_parsed]);

  // El avance multibase depende de todas las bases primarias, no solo del
  // detalle que el selector está mostrando en este momento.
  useEffect(() => {
    if (activeCargaTab !== "revision" || !isMultiBase) {
      setCargaReviewSummary(null);
      return;
    }
    let cancelled = false;
    setCargaReviewSummary(null);
    setRevisionLectura((lectura) => ({ ...lectura, resumen: false }));
    apiCargaReviewSummary()
      .then((summary) => {
        if (!cancelled) setCargaReviewSummary(summary);
      })
      .catch(() => {
        if (!cancelled) setCargaReviewSummary(null);
      })
      .finally(() => {
        if (!cancelled) setRevisionLectura((lectura) => ({ ...lectura, resumen: true }));
      });
    return () => { cancelled = true; };
  }, [activeCargaTab, cargaBaseSignature, isMultiBase]);

  function goCargaWorkspaceTab(next: CargaWorkspaceTab, replace = false) {
    cargaDireccion.irA("pestana", next === PESTANA_CARGA_POR_DEFECTO ? null : next, { replace });
  }
  const lastSessionIdRef = useRef(sessionId);

  useEffect(() => {
    const intakeCount = state?.processing_intake_entries_count ?? 0;
    const seedKey = `${sessionId ?? ""}:${state?.processing_intake_mode ?? ""}:${intakeCount}`;
    if (planningSeedRef.current === seedKey) return;
    planningSeedRef.current = seedKey;
    if (state?.processing_intake_mode === "independent_siblings" && intakeCount > 0) {
      setMultiBaseStrategy("independent");
      setPlannedInputCount(intakeCount);
    }
  }, [sessionId, state?.processing_intake_entries_count, state?.processing_intake_mode]);

  useEffect(() => {
    if (materializedInputCount > plannedInputCount) {
      setPlannedInputCount(materializedInputCount);
    }
  }, [materializedInputCount, plannedInputCount, setPlannedInputCount]);

  useEffect(() => {
    if (!sessionId || lastSessionIdRef.current === sessionId) return;
    lastSessionIdRef.current = sessionId;
    setInstrumento(null);
    setDataPreview(null);
    setChoiceMappingReview(null);
    setEstructura(null);
    setEsquemaBase("");
    setEstudio(null);
    setSelectedCargaBase("");
    setCargaReview(null);
    setReconDialogOpen(false);
    setForceMultiBase(false);
    setPreferredMultiStrategy(undefined);
    setTopologyIntent(null);
    setPlannedInputCount(1);
    setMonitoringReviewed(false);
    setMonitoringProfile(null);
    setProcessingSuggestions(null);
    setHandoffStatus(null);
    setSelectedMonitoringSourceId(null);
    setError("");
    setBusy("");
  }, [sessionId]);

  useEffect(() => {
    if (!isMultiBase) {
      setSelectedCargaBase("");
      return;
    }
    if (!cargaBaseOptions.length) {
      setSelectedCargaBase("");
      return;
    }
    const names = new Set(cargaBaseOptions.map((base) => base.nombre));
    setSelectedCargaBase((current) => {
      if (names.has(current)) return current;
      if (estudio?.active_base && names.has(estudio.active_base)) return estudio.active_base;
      return cargaBaseOptions[0]?.nombre ?? "";
    });
  }, [cargaBaseSignature, estudio?.active_base, isMultiBase]);

  useEffect(() => {
    if (!error) return;
    feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  // La estructura del formulario de la base elegida (pestaña Formulario).
  useLecturaDeEstructura(estadoEstructura, {
    esVarias: isMultiBase,
    instrumentoParseado: Boolean(state?.instrumento_parsed),
    estudio,
    firmaDeBases: cargaBaseSignature,
    onError: setError,
  });

  // Tras cambios al estudio (add/remove/rename base), refrescar
  // session state + estudio payload. En multibase, los effects de esquema
  // reconstruyen la base elegida + su estructura; aquí solo limpiamos el caso
  // sin bases.
  async function onEstudioChanged(payload: EstudioPayload) {
    setEstudio(payload);
    if (payload.processing_mode === "independent_siblings" || payload.n_bases > 1) {
      setForceMultiBase(true);
    }
    if (payload.processing_mode === "independent_siblings") {
      setPreferredMultiStrategy("independent");
      setMultiBaseStrategy("independent");
    }
    await refresh();
    if (payload.n_bases === 0) {
      setEsquemaBase("");
      setEstructura(null);
    }
    // n_bases > 0: el effect de esquema multibase elige la base (madre del
    // repeat por defecto) y el effect de fetch carga su estructura.
  }

  async function onConfirmChoiceMapping() {
    setError("");
    setBusy("Confirmando mapeo de códigos");
    try {
      await apiCargaConfirmChoiceMapping(selectedCargaBase);
      setDataPreview((prev) => markChoiceMappingConfirmed(prev));
      setChoiceMappingReview(null);
      await refresh();
      await loadReconciliacion(false);
      if (isMultiBase) await loadReviewSummary();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function onEnableMultiBase(strategy: MultiBaseStrategy) {
    setError("");
    setBusy("Activando modo de varias bases");
    setTopologyIntent(strategy);
    setPreferredMultiStrategy(strategy);
    setMultiBaseStrategy(strategy);
    try {
      if (state?.has_estudio) {
        const payload = await apiEstudioGet();
        setEstudio(payload);
        setForceMultiBase(true);
      } else {
        const payload = await apiEstudioInit();
        setEstudio(payload);
        setForceMultiBase(true);
      }
      // `forceMultiBase` sólo vive en este montaje. Sin persistir la decisión,
      // cerrar el proyecto y volver a abrirlo lo devolvía a la carga simple.
      await apiEstudioSetTopology(strategy);
      await refresh();
      goCargaWorkspaceTab("bases");
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy("");
    }
  }

  function onTopologyIntentChange(next: CargaTopologyIntent) {
    setTopologyIntent(next);
    if (next === "separate" || next === "integrated" || next === "independent") {
      setMultiBaseStrategy(next);
      setPlannedInputCount(plannedInputCount);
    }
    // Sólo se persiste sobre un estudio que ya existe. Escribir aquí cuando aún
    // no hay estudio lo inicializaría al primer click en Plan y volvería
    // `has_estudio` verdadero antes de tiempo, que es la señal de la que cuelga
    // el flujo de carga simple. Mientras no exista, la elección sigue viviendo
    // en el store y se persiste al activar el plan o al crear la primera base.
    // "multi" queda fuera: es "varias, todavía no sé cómo", no una decisión.
    if (!state?.has_estudio) return;
    if (next !== "single" && next !== "separate" && next !== "integrated" && next !== "independent") return;
    void apiEstudioSetTopology(next)
      .then(() => refresh())
      .catch((reason) => setError((reason as Error).message));
  }

  function onMonitoringDiscovered(result: CargaMonitoringDiscoveryResult) {
    const reviewed = result.suggestions !== null && result.handoff !== null;
    setProcessingSuggestions(result.suggestions);
    setHandoffStatus(result.handoff);
    setMonitoringProfile(result.profile);
    setSelectedMonitoringSourceId(result.selectedSourceId);
    setMonitoringReviewed(reviewed);
  }

  // El estudio dejó de ser de varias bases (volver a una o quitar todas, en la relación entre las bases).
  async function onDegradada() {
    setEstudio(null);
    setForceMultiBase(false);
    setPreferredMultiStrategy(undefined);
    setTopologyIntent("single");
    goCargaWorkspaceTab("bases");
    await refresh();
  }

  const onBaseSavRegistrada = () => {
    void apiEstudioGet()
      .then(onEstudioChanged)
      .catch((reason: Error) => setError(reason.message));
  };

  // Al aplicar el filtro de universo se vuelve a leer lo que depende de él: con
  // varias bases también el estudio y el avance de todas.
  function alAplicarUniverso() {
    if (isMultiBase) {
      void apiEstudioGet()
        .then(async (payload) => {
          await onEstudioChanged(payload);
          await loadReconciliacion(false);
          await loadReviewSummary();
        })
        .catch((reason: Error) => setError(reason.message));
      return;
    }
    void refresh()
      .then(() => loadReconciliacion(false))
      .catch((reason: Error) => setError(reason.message));
  }

  // Lo que comparten Variables, Formulario y Respuestas (ADR 0142).
  const basesPrimarias = topologyBases.map((base) => base.nombre);
  const contextoDeCarga: ContextoDeCarga = {
    estudio,
    esVarias: isMultiBase,
    basesPrimarias,
    basesTodas: isMultiBase ? cargaBaseOptions : [],
    baseElegida: isMultiBase ? selectedCargaBase : "",
    onCambiarBase: setSelectedCargaBase,
    ocupado: busy,
    error,
    todoListo: allReady,
  };
  // La base que muestra Revisión: con varias, la elegida; con una, la única del estudio.
  const baseRevisada = isMultiBase
    ? topologyBases.find((base) => base.nombre === selectedCargaBase) ?? null
    : estudio?.bases?.[BASE_UNICA] ?? null;
  const basesDeVariables = isMultiBase ? cargaBaseOptions.map((base) => base.nombre) : [];
  const contextoDeVariables: ContextoDeCarga = {
    ...contextoDeCarga,
    baseElegida: baseDeVariables({
      esVarias: isMultiBase,
      hayRespuestas: hasData,
      bases: basesDeVariables,
      basesPrimarias,
      foco: cargaDireccion.foco,
      baseActiva: estudio?.active_base,
    }),
    // La base de Variables vive en la dirección (`foco`), para que el enlace la nombre.
    onCambiarBase: elegirBaseDeVariables,
  };

  const pestana = activeCargaTab === "bases" ? (
    <PestanaBases
      varias={isMultiBase}
      estudio={estudio}
      estrategia={sourceStrategy}
      tieneEstudio={Boolean(state?.has_estudio)}
      ocupado={!!busy}
      errorDeCarga={error}
      entradasPrevistas={plannedInputCount}
      entradasMinimas={materializedInputCount}
      onEntradasPrevistas={setPlannedInputCount}
      relacion={{
        topologia: topologyResolution,
        intencion: resolvedTopologyIntent,
        ocupado: !!busy,
        onCambiarIntencion: onTopologyIntentChange,
        porActivar: !isMultiBase && (resolvedTopologyIntent === "multi" || topologyIntentStrategy !== null) && !topologyHasStudy,
        estrategiaPorActivar: topologyIntentStrategy,
        onActivarVariasBases: onEnableMultiBase,
        estudio: isMultiBase && estudio
          ? { nombre: typeof estudio.nombre === "string" ? estudio.nombre : "", bases: cargaBaseOptions.map((b) => b.nombre), nGruposRepetidos: cargaBaseOptions.length - topologyBases.length }
          : null,
        onEstudioCambiado: onEstudioChanged,
        onSinVariasBases: onDegradada,
      }}
      onOrigen={(o) => {
        if (o === "surveymonkey" || o === "kobo") setPlatformProvider(o);
      }}
      plataforma={plataforma}
      monitoreo={{
        sessionId,
        etiquetaRevisar: monitoringReviewActionLabel,
        onDescubierto: onMonitoringDiscovered,
        revisado: monitoringReviewed,
        perfil: monitoringProfile,
        sugerencias: processingSuggestions?.groups,
        tokenDeLectura: intakeRefreshToken,
        onPlanGuardado: () => setIntakeRefreshToken((current) => current + 1),
        onPromovido: async (payload) => {
          await onEstudioChanged(payload);
          goCargaWorkspaceTab("revision");
        },
        mostrarTraspaso: showFieldWorkHandoff,
        traspaso: handoffStatus,
        fuenteSeleccionada: selectedMonitoringSourceId,
        ocupado: !!busy,
        onTraer: () => void onBringFieldWorkToProcessing(),
        onSubirFormulario: (file) => void onPick("xlsform", file),
      }}
      variasBases={{
        onEstudioCambiado: onEstudioChanged,
        onDestinoFuente: (d) => {
          setFuenteDestino(d);
          setVistaPreviaFuente(null);
          if (d) setPlatformProvider("surveymonkey");
        },
        vistaPreviaFuente: vistaPreviaFuente?.datos ?? null,
        onConfirmarFuente: () => void onPlatformImport(),
        onDescartarVistaPrevia: () => setVistaPreviaFuente(null),
        onBaseSavRegistrada,
      }}
      unaBase={{
        ocupado: !!busy,
        tieneFormulario: hasXlsform,
        tieneRespuestas: hasData,
        mapeoPendiente: pendingChoiceMapping,
        formulario: instrumento,
        vistaPrevia: dataPreview,
        cambios: cambiosRespuestas,
        detallesNormalizacion: normalizationDetails,
        onCerrarCambios: () => setCambiosRespuestas(null),
        onRevisarMapeo: setChoiceMappingReview,
        onSubir: onPick,
        onQuitar,
        onUsarDelEditor: (f) => usarFormularioDelEditor(f, efectosDeInsumos),
        enlaceConRevision: state?.instrument_revision_binding,
      }}
    />
  ) : activeCargaTab === "revision" ? (
    <PestanaRevision
      varias={isMultiBase}
      ocupado={!!busy}
      leyendo={!revisionEstado.datosLeidos}
      revision={cargaReview}
      mapeoPendiente={pendingChoiceMapping}
      tieneFormulario={isMultiBase ? Boolean(baseRevisada?.xlsform_file_id) : hasXlsform}
      tieneRespuestas={isMultiBase ? Boolean(baseRevisada?.data_file_id) : hasData}
      onRevisarMapeo={setChoiceMappingReview}
      onLecturaUniverso={marcarLecturaUniverso}
      onUniversoAplicado={alAplicarUniverso}
      onGuardarColumnas={onSaveReconciliacion}
      basesPrimarias={topologyBases.map((base) => base.nombre)}
      etiquetasDeBases={Object.fromEntries(topologyBases.map((base) => [base.nombre, etiquetaDeBase(base)]))}
      baseElegida={selectedCargaBase}
      onCambiarBase={setSelectedCargaBase}
      resumenDeBases={cargaReviewSummary}
      filasDeLaBase={baseRevisada?.n_filas ?? null}
      puedeContinuar={isMultiBase
        ? Boolean(cargaReviewSummary?.all_ready && !busy && !error)
        : Boolean(cargaReview?.ready && allReady && !busy && !error)}
    />
  ) : activeCargaTab === "variables" ? (
    <PestanaVariables
      contexto={contextoDeVariables}
      bases={basesDeVariables}
      conCatalogo={Boolean(workspaceContext.basesSeparadas)}
      onLeyendo={setVariablesLeyendo}
    />
  ) : activeCargaTab === "equivalencias" ? (
    <PestanaEquivalencias onDeclaradas={setEquivalenciasFilas} />
  ) : activeCargaTab === "formulario" ? (
    <PestanaFormulario
      contexto={contextoDeCarga}
      hayEstructura={showInspection}
      estructura={estructura}
      baseDelEsquema={esquemaBase}
      onCambiarBaseDelEsquema={setEsquemaBase}
    />
  ) : (
    <PestanaRespuestas contexto={contextoDeCarga} />
  );


  return (
    <PageFrame
      title="Fase 1 - Preparar insumos"
      lead="Carga el formulario y las respuestas para preparar el estudio."
      className="pulso-carga-frame"
      density="compact"
      headerMode="sr-only"
      bodyMode="fill"
      layout="workbench"
      scrollOwner="panels"
      // La marca se escribe "false", no se omite: sin ella el runtime toma la
      // primera marca descendiente (la del panel de variables extra dice
      // "true") y daba Revisión por lista mientras todavía leía. Mientras la
      // página se hidrata tampoco hay marca (L4, `cargaHidratacion.ts`).
      auditReady={
        (isMultiBase && !estudio)
          || (activeCargaTab === "revision" && !revisionEstado.completa)
          || (activeCargaTab === "variables" && variablesLeyendo)
          ? "false"
          : marcaReadinessCarga(hidratacion, activeCargaTab) || "false"
      }
    >
      {/* Con "Agregar base" abierto el error se dibuja dentro del diálogo; aquí quedaría detrás del velo. */}
      {(busy || (error && !agregarBaseAbierto) || handoffMessage) && (
        <AvisosDeCarga ocupado={busy} error={agregarBaseAbierto ? "" : error} avisoDeTraspaso={handoffMessage} refAvisos={feedbackRef} />
      )}

      {reconDialogOpen && reconInfo && (
        <ReconciliacionExtraDialog
          info={reconInfo}
          onSave={onSaveReconciliacion}
          onClose={() => setReconDialogOpen(false)}
        />
      )}

      {choiceMappingReview && (
        <ChoiceMappingReviewDialog
          review={choiceMappingReview}
          busy={!!busy}
          onClose={() => setChoiceMappingReview(null)}
          onConfirm={onConfirmChoiceMapping}
        />
      )}

      {/* Una mesa para las dos organizaciones: con varias bases el estudio ya
          cubre la carga (BasesPanel); con una sola, la mesa espera a que la
          página termine de hidratarse. Cambiar de organización remonta la mesa. */}
      {((isMultiBase && estudio) || (!isMultiBase && hidratacion.fase === "lista")) && (
        <MesaDeCarga
          key={isMultiBase ? "varias" : "una"}
          varias={isMultiBase}
          activa={activeCargaTab}
          contexto={workspaceContext}
          onCambiar={goCargaWorkspaceTab}
        >
          {pestana}
        </MesaDeCarga>
      )}

      {hidratacion.fase !== "lista" && (
        <CargaHidratando
          pestana={activeCargaTab}
          hidratacion={hidratacion}
          onCambiarPestana={goCargaWorkspaceTab}
          onReintentar={hidratacion.fase === "error" && hidratacion.motivo === "sesion" ? () => void refresh() : reintentarEstudio}
        />
      )}


    </PageFrame>
  );
}
