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
  apiInstrumentoEstructura,
  CargaMonitoreoHandoffStatus,
  CargaPlatformImportResult,
  ChoiceCodeMapReview,
  CargaReviewPayload,
  CargaReviewSummaryPayload,
  EstudioPayload,
  EstudioProcessingSuggestions,
  Pregunta,
  ReconciliacionInfo,
  Seccion,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { useSeccion } from "../../lib/navegacion/useDireccion";
import "./carga-v2.css";
import "./carga-sources.css";
import "./carga-scroll-corto.css";
import { PageFrame } from "../../components/PageFrame";
import { ChoiceMappingReviewDialog } from "./ChoiceMappingReviewDialog";
import { ReconciliacionExtraDialog } from "./ReconciliacionExtraDialog";
import { summaryLabel as reconSummaryLabel } from "./reconciliacionModel";
import { defaultEsquemaBase } from "./esquemaBaseModel";
import { useCargaStore, type CargaTopologyIntent, type MultiBaseStrategy } from "./store";
import {
  resolveCargaWorkspaceTab,
  equivalenciasDisponibles,
  type CargaWorkspaceContext,
  type CargaWorkspaceTab,
} from "./CargaWorkspaceModel";
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
import { quitarInsumo, subirInsumo } from "./pestanas/accionesDeInsumos";
import { AvisosDeCarga } from "./pestanas/AvisosDeCarga";
import { AvisoVariablesExtra } from "./pestanas/AvisoVariablesExtra";
import { traerTrabajoDeCampo } from "./pestanas/traerTrabajoDeCampo";
import { MesaDeCarga } from "./pestanas/MesaDeCarga";
import { useModeloCarga } from "./pestanas/useModeloCarga";
import { usePlataformaCarga } from "./pestanas/usePlataformaCarga";
import { PestanaDatos } from "./pestanas/PestanaDatos";
import { PestanaEquivalencias } from "./pestanas/PestanaEquivalencias";
import { PestanaEstructura } from "./pestanas/PestanaEstructura";
import { PestanaFuentes } from "./pestanas/PestanaFuentes";
import { PestanaPlan } from "./pestanas/PestanaPlan";
import { PestanaRevision } from "./pestanas/PestanaRevision";

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
  const [estructura, setEstructura] = useState<{ secciones: Seccion[]; preguntas: Pregunta[] } | null>(null);
  // Base cuyo esquema se muestra en la inspección multibase (madre↔hija). En
  // single-base queda vacío y `estructura` viene del instrumento único.
  const [esquemaBase, setEsquemaBase] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState<string>("");
  const feedbackRef = useRef<HTMLDivElement | null>(null);
  const normalizationDetails = dataPreviewNormalizationDetails(dataPreview);
  const [forceMultiBase, setForceMultiBase] = useState(false);
  const [preferredMultiStrategy, setPreferredMultiStrategy] = useState<MultiBaseStrategy | undefined>(undefined);
  const [sourceMode, setSourceMode] = useState<SourceMode>("files");
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
    setSourceMode,
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

  const sourceModes = cargaSourceModes(processingSuggestions);

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
    workspaceAllReady,
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
  // `null` hasta que Equivalencias la lee; así la pestaña dice "Revisando…" y
  // no un "Pendiente" que todavía no sabe.
  const [equivalenciasFilas, setEquivalenciasFilas] = useState<number | "error" | null>(null);
  const reviewHasIssues = Boolean(cargaReview && (
    !cargaReview.compatibility.ok
    || cargaReview.choice_mapping.pending
    || cargaReview.reconciliation.n_pendientes > 0
  ));
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
    equivalenciasLeyendo: cargaDireccion.pestana === "equivalencias" && equivalenciasFilas === null,
    // Solo mientras se mira Revisión: en otras pestañas no se lee y la marca
    // se quedaría en "Revisando…" para siempre.
    revisionLeyendo: cargaDireccion.pestana === "revision" && !revisionEstado.datosLeidos,
  };
  const activeCargaTab = resolveCargaWorkspaceTab(cargaDireccion.pestana, workspaceContext);

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
    cargaDireccion.irA("pestana", next === "plan" ? null : next, { replace });
  }
  // Flag que le pide al BasesPanel abrir directamente su form "Agregar
  // base" al montar. Se activa tras convertir single → multi con el
  // botón "+ Agregar otra base" para que el usuario no tenga que
  // buscar el botón dentro del panel.
  const [autoOpenAddBase, setAutoOpenAddBase] = useState(false);
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
    setAutoOpenAddBase(false);
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

  // Esquema single-base: instrumento único (comportamiento histórico intacto).
  useEffect(() => {
    if (isMultiBase) return;
    if (state?.instrumento_parsed && !estructura) {
      apiInstrumentoEstructura().then(setEstructura).catch((e) => setError((e as Error).message));
    }
  }, [isMultiBase, state?.instrumento_parsed, estructura]);

  // Esquema multibase: elegir la base cuyo esquema se muestra. Por defecto la
  // que mejor exhibe el begin_repeat (la madre de una base hija repeat) y
  // mantenerla válida si cambia el set de bases.
  useEffect(() => {
    if (!isMultiBase || !estudio) return;
    const names = new Set(Object.keys(estudio.bases));
    setEsquemaBase((current) => (current && names.has(current) ? current : defaultEsquemaBase(estudio.bases, estudio.active_base)));
  }, [isMultiBase, cargaBaseSignature, estudio?.active_base]);

  // Esquema multibase: cargar la estructura de la base elegida y re-cargar
  // cuando el usuario alterna madre↔hija en el selector.
  useEffect(() => {
    if (!isMultiBase || !esquemaBase) return;
    let cancelled = false;
    apiInstrumentoEstructura(esquemaBase)
      .then((r) => { if (!cancelled) setEstructura(r); })
      .catch((e) => { if (!cancelled) setError((e as Error).message); });
    return () => { cancelled = true; };
  }, [isMultiBase, esquemaBase]);

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
    setBusy("Confirmando mapeo de códigos…");
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
    setBusy("Activando modo de varias bases…");
    setTopologyIntent(strategy);
    setPreferredMultiStrategy(strategy);
    setMultiBaseStrategy(strategy);
    try {
      if (state?.has_estudio) {
        const payload = await apiEstudioGet();
        setEstudio(payload);
        setForceMultiBase(true);
        setAutoOpenAddBase(false);
      } else {
        const payload = await apiEstudioInit();
        setEstudio(payload);
        setForceMultiBase(true);
        setAutoOpenAddBase(false);
      }
      // `forceMultiBase` sólo vive en este montaje. Sin persistir la decisión,
      // cerrar el proyecto y volver a abrirlo lo devolvía a la carga simple.
      await apiEstudioSetTopology(strategy);
      await refresh();
      goCargaWorkspaceTab("fuentes");
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

  const onBaseSavRegistrada = () => {
    void apiEstudioGet()
      .then(onEstudioChanged)
      .catch((reason: Error) => setError(reason.message));
  };

  const unica = topologyResolution.mode !== "multi";

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

  const pestana = activeCargaTab === "plan" ? (
    <PestanaPlan
      topologia={topologyResolution}
      bases={isMultiBase ? topologyBases : []}
      tieneFormulario={isMultiBase ? workspaceHasInstrument : hasXlsform}
      tieneRespuestas={workspaceHasData}
      mapeoPendiente={pendingChoiceMapping}
      todoListo={workspaceAllReady}
      onAbrirFuentes={() => goCargaWorkspaceTab("fuentes")}
      intencion={resolvedTopologyIntent}
      ocupado={!!busy}
      onCambiarIntencion={onTopologyIntentChange}
    />
  ) : activeCargaTab === "fuentes" ? (
    <PestanaFuentes
      varias={isMultiBase}
      estudio={estudio}
      estrategia={sourceStrategy}
      unica={unica}
      plannedInputCount={plannedInputCount}
      materializedInputCount={materializedInputCount}
      ocupado={!!busy}
      onPlannedInputCountChange={setPlannedInputCount}
      origen={{ modo: sourceMode, modos: sourceModes, onModo: setSourceMode }}
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
        tieneFormulario: hasXlsform,
        onEstudioCambiado: onEstudioChanged,
        onOrigen: (o) => {
          if (o === "surveymonkey" || o === "kobo") { setPlatformProvider(o); setSourceMode("platform"); }
          else if (o === "archivos") setSourceMode("files");
          else if (o === "monitoreo") setSourceMode("monitoring");
        },
        onDestinoFuente: (d) => {
          setFuenteDestino(d);
          setVistaPreviaFuente(null);
          if (d) { setPlatformProvider("surveymonkey"); setSourceMode("platform"); }
        },
        vistaPreviaFuente: vistaPreviaFuente?.datos ?? null,
        onConfirmarFuente: () => void onPlatformImport(),
        onDescartarVistaPrevia: () => setVistaPreviaFuente(null),
        abrirAgregarBase: autoOpenAddBase,
        onAgregarBaseAbierto: () => setAutoOpenAddBase(false),
        onDegradada: async () => {
          setAutoOpenAddBase(false);
          setEstudio(null);
          setForceMultiBase(false);
          setPreferredMultiStrategy(undefined);
          setTopologyIntent("single");
          goCargaWorkspaceTab("plan");
          await refresh();
        },
        onBaseSavRegistrada,
      }}
      unaBase={{
        onUsarArchivos: () => setSourceMode("files"),
        mostrarAvisoDelPlan: (resolvedTopologyIntent === "multi" || topologyIntentStrategy !== null) && !topologyHasStudy,
        estrategiaDelPlan: topologyIntentStrategy,
        onActivarVariasBases: onEnableMultiBase,
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
        enlaceConRevision: state?.instrument_revision_binding,
        baseUnica: estudio?.bases?.default,
      }}
    />
  ) : activeCargaTab === "revision" ? (
    <PestanaRevision
      varias={isMultiBase}
      ocupado={!!busy}
      leyendo={!revisionEstado.datosLeidos}
      revision={cargaReview}
      mapeoPendiente={pendingChoiceMapping}
      tieneFormulario={hasXlsform}
      tieneRespuestas={hasData}
      todoListo={workspaceAllReady}
      onRevisarMapeo={setChoiceMappingReview}
      onLecturaUniverso={marcarLecturaUniverso}
      onUniversoAplicado={alAplicarUniverso}
      basesPrimarias={topologyBases.map((base) => base.nombre)}
      baseElegida={selectedCargaBase}
      onCambiarBase={setSelectedCargaBase}
      resumenDeBases={cargaReviewSummary}
      formulariosEnBases={multiBaseInstrumentCount}
      respuestasEnBases={multiBaseDataCount}
      basesDeLaSesion={state?.n_bases ?? 0}
      puedeContinuar={isMultiBase
        ? Boolean(cargaReviewSummary?.all_ready && !busy && !error)
        : Boolean(cargaReview?.ready && allReady && !busy && !error)}
    />
  ) : activeCargaTab === "equivalencias" ? (
    <PestanaEquivalencias onDeclaradas={setEquivalenciasFilas} />
  ) : activeCargaTab === "estructura" ? (
    <PestanaEstructura
      varias={isMultiBase}
      hayEstructura={showInspection}
      estructura={estructura}
      bases={estudio?.bases ?? null}
      baseDelEsquema={esquemaBase}
      onCambiarBaseDelEsquema={setEsquemaBase}
    />
  ) : (
    <PestanaDatos
      varias={isMultiBase}
      todoListo={allReady}
      ocupado={busy}
      error={error}
      bases={cargaBaseOptions}
      baseElegida={selectedCargaBase}
      onCambiarBase={setSelectedCargaBase}
    />
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
        (isMultiBase && !estudio) || (activeCargaTab === "revision" && !revisionEstado.completa)
          ? "false"
          : marcaReadinessCarga(hidratacion, activeCargaTab) || "false"
      }
    >
      {(busy || error || handoffMessage) && (
        <AvisosDeCarga ocupado={busy} error={error} avisoDeTraspaso={handoffMessage} refAvisos={feedbackRef} />
      )}

      {activeCargaTab === "revision" && reconInfo && reconInfo.n_extra > 0 && (
        <AvisoVariablesExtra
          baseNombre={cargaReview?.base_nombre}
          resumen={reconSummaryLabel(reconInfo)}
          onRevisar={() => setReconDialogOpen(true)}
        />
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
