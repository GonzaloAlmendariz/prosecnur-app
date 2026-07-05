import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight, ArrowRightLeft, CheckCircle2, CloudDownload, Database, FileSpreadsheet,
  Download, Info, Loader2, RefreshCw, Search, ShieldCheck, Table2, Trash2, Upload,
} from "lucide-react";
import {
  apiCargaBaseSheet,
  apiCargaKoboAssets,
  apiCargaKoboDetectedSource,
  apiCargaImportKobo,
  apiCargaImportSurveyMonkey,
  apiCargaData,
  apiCargaExportNormalized,
  apiCargaConfirmChoiceMapping,
  apiCargaInstrumento,
  apiConnectionsList,
  apiEstudioDowngradeToSingle,
  apiEstudioFromSession,
  apiEstudioGet,
  apiEstudioInit,
  apiEstudioProcessingSuggestions,
  apiInstrumentoEstructura,
  apiQuitarData,
  apiQuitarInstrumento,
  apiSurveyMonkeyMultibaseListSurveys,
  apiUpload,
  CargaPlatformImportResult,
  CargaPlatformProvider,
  ChoiceCodeMap,
  ChoiceCodeMapReview,
  ConnectionTokenState,
  EstudioBase,
  EstudioPayload,
  EstudioProcessingSuggestions,
  KoboSourceSpec,
  MonitoreoKoboAssetItem,
  NormalizedExportFormat,
  Pregunta,
  Seccion,
  SurveyMonkeyMultibaseListItem,
  downloadUrl,
  uploadKindForDataFile,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { ContextBar, ContextBarDivider } from "../../components/ContextBar";
import { Panel } from "../../components/Panel";
import { PageFrame } from "../../components/PageFrame";
import { AdaptiveSplitView } from "../../components/AdaptiveSplitView";
import { LoadingBlock, ErrorBlock, EmptyState } from "../../components/States";
import { SaveStatusIndicator } from "../../components/SaveStatusIndicator";
import SeccionesPanel from "./SeccionesPanel";
import PreguntasPanel from "./PreguntasPanel";
import { BasesPanel } from "./BasesPanel";
import { ProcessingSheetViewer } from "../procesamiento/ProcessingSheetViewer";

// Fase 1 — Carga de insumos.
//
// El analista sube su propio XLSForm + base de datos. Cada archivo se parsea
// y muestra un resumen con contadores.
//
// Tras la carga, esta página muestra la estructura del instrumento
// (secciones + preguntas con reglas) para que el analista verifique
// antes de pasar a Validación.

type InstrumentoResumen = Awaited<ReturnType<typeof apiCargaInstrumento>>["resumen"];
type DataPreview = Awaited<ReturnType<typeof apiCargaData>>["preview"];

type IconCmp = typeof Database;
type SourceMode = "files" | "platform";
type CargaWorkspaceTab = "insumos" | "base";
type DetectedKoboSource = KoboSourceSpec & {
  ok: true;
  detected: true;
  provider: "kobo";
  phase: string;
  name: string;
};

function providerLabel(provider: CargaPlatformProvider) {
  return provider === "kobo" ? "KoboToolbox" : "SurveyMonkey";
}

function connectedProfiles(connection?: ConnectionTokenState): Array<{ id: string; alias: string; base_url?: string; is_default?: boolean }> {
  const profiles = (connection?.profiles ?? [])
    .filter((profile) => profile.has_token)
    .map((profile) => ({
      id: profile.id,
      alias: profile.alias || "Principal",
      base_url: profile.base_url || "",
      is_default: profile.is_default,
    }));
  if (profiles.length > 0) return profiles;
  if (connection?.has_token) {
    return [{
      id: connection.active_profile_id || "",
      alias: connection.active_profile_alias || "Principal",
      base_url: connection.active_profile_base_url || "",
      is_default: true,
    }];
  }
  return [];
}

function dataPreviewNormalizationDetails(preview: DataPreview | null): string[] {
  const normalizacion = preview?.normalizacion;
  if (!normalizacion) return [];
  const rows: string[] = [];
  Object.entries(normalizacion.alias_columns ?? {}).forEach(([target, source]) => {
    rows.push(`alias ${source} -> ${target}`);
  });
  Object.entries(normalizacion.single_child_collapse_columns ?? {}).forEach(([target, source]) => {
    rows.push(`colapso ${source} -> ${target}`);
  });
  Object.entries(normalizacion.select_multiple_columns ?? {}).forEach(([target, sources]) => {
    const sourceList = Array.isArray(sources) ? sources : [String(sources)];
    rows.push(`selección múltiple ${target}: ${sourceList.join(", ")}`);
  });
  const choiceMaps = normalizacion.choice_code_maps;
  if (choiceMaps?.applied && choiceMaps.maps.length > 0) {
    choiceMaps.maps.forEach((map) => {
      rows.push(`mapeo de códigos ${map.variable}: ${map.mappings.length} opción(es) por etiqueta`);
    });
  }
  return rows;
}

function choiceMappingReviewFromPreview(preview: DataPreview | null): ChoiceCodeMapReview | null {
  const review = preview?.normalizacion?.choice_code_maps;
  if (!review?.applied) return null;
  const maps = Array.isArray(review.maps) ? review.maps : [];
  if (!maps.length) return null;
  return { ...review, maps };
}

function markChoiceMappingConfirmed(preview: DataPreview | null): DataPreview | null {
  if (!preview?.normalizacion?.choice_code_maps) return preview;
  return {
    ...preview,
    normalizacion: {
      ...preview.normalizacion,
      choice_code_maps: {
        ...preview.normalizacion.choice_code_maps,
        requires_confirmation: false,
        maps: preview.normalizacion.choice_code_maps.maps.map((map) => ({
          ...map,
          requires_confirmation: false,
        })),
      },
    },
  };
}

function normalizedChoiceCode(value: string): string {
  return String(value ?? "").replace(/^0+([0-9]+)$/, "$1");
}

function choiceMapChangedItems(map: ChoiceCodeMap) {
  return map.mappings.filter((item) => normalizedChoiceCode(item.source_code) !== normalizedChoiceCode(item.xls_code));
}

export default function CargaPage() {
  const { sessionId, state, refresh } = useSession();
  const [instrumento, setInstrumento] = useState<InstrumentoResumen | null>(null);
  const [dataPreview, setDataPreview] = useState<DataPreview | null>(null);
  const [choiceMappingReview, setChoiceMappingReview] = useState<ChoiceCodeMapReview | null>(null);
  const [estructura, setEstructura] = useState<{ secciones: Seccion[]; preguntas: Pregunta[] } | null>(null);
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState<string>("");
  const feedbackRef = useRef<HTMLDivElement | null>(null);
  const normalizationDetails = dataPreviewNormalizationDetails(dataPreview);
  const [forceMultiBase, setForceMultiBase] = useState(false);
  const [preferredMultiStrategy, setPreferredMultiStrategy] = useState<"separate" | "integrated" | "independent" | undefined>(undefined);
  const [sourceMode, setSourceMode] = useState<SourceMode>("files");
  const [activeCargaTab, setActiveCargaTab] = useState<CargaWorkspaceTab>("insumos");
  const [selectedCargaBase, setSelectedCargaBase] = useState("");
  const [platformProvider, setPlatformProvider] = useState<CargaPlatformProvider>("surveymonkey");
  const [connections, setConnections] = useState<ConnectionTokenState[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [platformQuery, setPlatformQuery] = useState("");
  const [smSurveys, setSmSurveys] = useState<SurveyMonkeyMultibaseListItem[]>([]);
  const [koboAssets, setKoboAssets] = useState<MonitoreoKoboAssetItem[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState("");
  const [selectedAssetUid, setSelectedAssetUid] = useState("");
  const [selectedSmProfileId, setSelectedSmProfileId] = useState("");
  const [selectedKoboProfileId, setSelectedKoboProfileId] = useState("");
  const [includePartials, setIncludePartials] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [platformError, setPlatformError] = useState("");
  const [platformMessage, setPlatformMessage] = useState("");
  const [detectedKoboSource, setDetectedKoboSource] = useState<DetectedKoboSource | null>(null);
  const [processingSuggestions, setProcessingSuggestions] = useState<EstudioProcessingSuggestions | null>(null);
  const [processingSuggestionsStatus, setProcessingSuggestionsStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    setProcessingSuggestionsStatus("Leyendo Monitoreo...");
    apiEstudioProcessingSuggestions()
      .then((payload) => {
        if (cancelled) return;
        setProcessingSuggestions(payload);
        setProcessingSuggestionsStatus("");
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setProcessingSuggestions(null);
        setProcessingSuggestionsStatus(e.message);
      });
    return () => { cancelled = true; };
  }, [sessionId]);

  async function onQuitar(kind: "xlsform" | "data") {
    const label = kind === "xlsform" ? "el formulario" : "las respuestas";
    // Borrar el instrumento vuelve inválidos a la data + estudio; borrar
    // la data también invalida el estudio multi-base. Confirmamos para
    // evitar pérdidas accidentales cuando el usuario ya avanzó.
    if (!window.confirm(
      `¿Quitar ${label}?\n\nSe vaciará lo que depende de esto:\n` +
      (kind === "xlsform"
        ? "el formulario, su lectura, las respuestas y el estudio.\n\n" +
          "Podrás volver a cargar otro formulario después."
        : "las respuestas y el estudio. El formulario se queda cargado.\n\n" +
          "Podrás subir otra base de respuestas después."
      )
    )) return;

    setError("");
    setBusy(`Quitando ${label}…`);
    try {
      if (kind === "xlsform") {
        await apiQuitarInstrumento();
        setInstrumento(null);
        setEstructura(null);
        // Quitar XLSForm también invalida la data a nivel UI porque
        // el backend la tiró de la sesión.
        setDataPreview(null);
        setChoiceMappingReview(null);
      } else {
        await apiQuitarData();
        setDataPreview(null);
        setChoiceMappingReview(null);
      }
      await refresh();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function onPick(kind: "xlsform" | "data", file?: File) {
    if (!file) return;
    if (kind === "data" && !state?.xlsform) {
      setError("Primero carga el formulario. Las respuestas se preparan y validan usando esa estructura.");
      return;
    }
    setError("");
    setBusy(`Subiendo ${file.name}…`);
    try {
      const uploadKind = kind === "data" ? uploadKindForDataFile(file) : kind;
      const up = await apiUpload(file, uploadKind);
      setBusy(`Procesando ${file.name}…`);
      if (kind === "xlsform") {
        const r = await apiCargaInstrumento(up.file_id);
        setInstrumento(r.resumen);
        setEstructura(null);
      } else {
        const r = await apiCargaData(up.file_id);
        setDataPreview(r.preview);
        const review = choiceMappingReviewFromPreview(r.preview);
        setChoiceMappingReview(review?.requires_confirmation ? review : null);
      }
      await refresh();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const smConnection = connections.find((connection) => connection.provider === "surveymonkey");
  const koboConnection = connections.find((connection) => connection.provider === "kobo");
  const smProfiles = connectedProfiles(smConnection);
  const koboProfiles = connectedProfiles(koboConnection);
  const activeSmProfile = smProfiles.find((profile) => profile.id === selectedSmProfileId) ?? smProfiles.find((profile) => profile.is_default) ?? smProfiles[0] ?? null;
  const activeKoboProfile = koboProfiles.find((profile) => profile.id === selectedKoboProfileId) ?? koboProfiles.find((profile) => profile.is_default) ?? koboProfiles[0] ?? null;

  useEffect(() => {
    let alive = true;
    setConnectionsLoading(true);
    Promise.allSettled([apiConnectionsList(), apiCargaKoboDetectedSource()])
      .then(([connectionsResult, koboHintResult]) => {
        if (!alive) return;
        if (connectionsResult.status === "fulfilled") {
          setConnections(connectionsResult.value.connections);
        } else {
          setPlatformError((connectionsResult.reason as Error).message);
        }
        if (koboHintResult.status === "fulfilled" && koboHintResult.value.ok && koboHintResult.value.detected) {
          setDetectedKoboSource(koboHintResult.value);
          if (koboHintResult.value.connection_profile_id) {
            setSelectedKoboProfileId(koboHintResult.value.connection_profile_id);
          }
        }
      })
      .catch((e) => {
        if (alive) setPlatformError((e as Error).message);
      })
      .finally(() => {
        if (alive) setConnectionsLoading(false);
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!selectedSmProfileId && activeSmProfile?.id) setSelectedSmProfileId(activeSmProfile.id);
    if (!selectedKoboProfileId && activeKoboProfile?.id) setSelectedKoboProfileId(activeKoboProfile.id);
  }, [activeKoboProfile?.id, activeSmProfile?.id, selectedKoboProfileId, selectedSmProfileId]);

  async function loadPlatformCatalog(forceRefresh = false) {
    setPlatformError("");
    setPlatformMessage("");
    setCatalogLoading(true);
    try {
      if (platformProvider === "surveymonkey") {
        if (!smConnection?.has_token) {
          setSmSurveys([]);
          setPlatformError("Conecta SurveyMonkey en Configuración para leer encuestas.");
          return;
        }
        const result = await apiSurveyMonkeyMultibaseListSurveys(platformQuery, 80, 36, {
          forceRefresh,
          profile_id: activeSmProfile?.id || "",
        });
        setSmSurveys(result.surveys);
        if (result.surveys.length && !result.surveys.some((survey) => survey.id === selectedSurveyId)) {
          setSelectedSurveyId(result.surveys[0].id);
        }
        setPlatformMessage(`${result.surveys.length} encuesta${result.surveys.length === 1 ? "" : "s"} disponibles.`);
      } else {
        if (!koboConnection?.has_token) {
          setKoboAssets([]);
          setPlatformError("Conecta KoboToolbox en Configuración para leer proyectos.");
          return;
        }
        const baseUrl = activeKoboProfile?.base_url || koboConnection.active_profile_base_url || "https://kf.kobotoolbox.org";
        const result = await apiCargaKoboAssets(baseUrl, 100, {
          profile_id: activeKoboProfile?.id || "",
        });
        const query = platformQuery.trim().toLowerCase();
        const assets = query
          ? result.assets.filter((asset) => `${asset.name} ${asset.uid}`.toLowerCase().includes(query))
          : result.assets;
        setKoboAssets(assets);
        if (assets.length && !assets.some((asset) => asset.uid === selectedAssetUid)) {
          setSelectedAssetUid(assets[0].uid);
        }
        setPlatformMessage(`${assets.length} proyecto${assets.length === 1 ? "" : "s"} disponibles.`);
      }
    } catch (e: unknown) {
      setPlatformError((e as Error).message);
    } finally {
      setCatalogLoading(false);
    }
  }

  function applyPlatformImportResult(result: CargaPlatformImportResult) {
    setInstrumento(result.resumen);
    setDataPreview(result.preview);
    const review = choiceMappingReviewFromPreview(result.preview);
    setChoiceMappingReview(review?.requires_confirmation ? review : null);
    setEstructura(null);
  }

  async function onPlatformImport() {
    setError("");
    setPlatformError("");
    setPlatformMessage("");
    try {
      if (platformProvider === "surveymonkey") {
        const survey = smSurveys.find((item) => item.id === selectedSurveyId);
        if (!survey) {
          setPlatformError("Selecciona una encuesta SurveyMonkey.");
          return;
        }
        setBusy(`Importando ${survey.title} desde SurveyMonkey…`);
        const result = await apiCargaImportSurveyMonkey({
          survey_id: survey.id,
          title: survey.title,
          connection_profile_id: activeSmProfile?.id || "",
          source_alias: survey.nickname || survey.title,
          response_statuses: includePartials ? ["completed", "partial"] : ["completed"],
          keep_missing_status: false,
        });
        applyPlatformImportResult(result);
        setPlatformMessage(`${survey.title} quedó cargada como formulario y respuestas.`);
      } else {
        const asset = koboAssets.find((item) => item.uid === selectedAssetUid);
        if (!asset) {
          setPlatformError("Selecciona un proyecto Kobo.");
          return;
        }
        const baseUrl = activeKoboProfile?.base_url || koboConnection?.active_profile_base_url || "https://kf.kobotoolbox.org";
        setBusy(`Importando ${asset.name} desde KoboToolbox…`);
        const result = await apiCargaImportKobo({
          asset_uid: asset.uid,
          title: asset.name,
          base_url: baseUrl,
          connection_profile_id: activeKoboProfile?.id || "",
        });
        applyPlatformImportResult(result);
        setPlatformMessage(`${asset.name} quedó cargado como formulario y respuestas.`);
      }
      await refresh();
    } catch (e: unknown) {
      setPlatformError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function seedDetectedKoboAsset(source: DetectedKoboSource) {
    setPlatformProvider("kobo");
    setSelectedAssetUid(source.asset_uid);
    setPlatformQuery(source.name || source.source_title || "");
    setKoboAssets((prev) => {
      const exists = prev.some((asset) => asset.uid === source.asset_uid);
      const detectedAsset: MonitoreoKoboAssetItem = {
        uid: source.asset_uid,
        name: source.name || source.source_title || source.asset_uid,
        version_id: source.version_id || "",
        date_modified: source.date_modified || null,
        deployment_active: source.deployment_active === true,
      };
      return exists ? prev : [detectedAsset, ...prev];
    });
  }

  async function onImportDetectedKoboSource() {
    const source = detectedKoboSource;
    if (!source) return;
    setError("");
    setPlatformError("");
    setPlatformMessage("");
    setSourceMode("platform");
    seedDetectedKoboAsset(source);
    if (!koboConnection?.has_token) {
      setPlatformError("Conecta KoboToolbox en Configuración para importar la fuente detectada.");
      return;
    }
    setBusy(`Importando ${source.name || source.asset_uid} desde KoboToolbox…`);
    try {
      const result = await apiCargaImportKobo({
        asset_uid: source.asset_uid,
        title: source.name || source.source_title,
        base_url: source.base_url || activeKoboProfile?.base_url || "https://kobo.unhcr.org",
        connection_profile_id: source.connection_profile_id || activeKoboProfile?.id || "",
      });
      applyPlatformImportResult(result);
      setPlatformMessage(`${source.name || source.asset_uid} quedó cargado como formulario y respuestas.`);
      await refresh();
    } catch (e: unknown) {
      setPlatformError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    if (state?.instrumento_parsed && !estructura) {
      apiInstrumentoEstructura().then(setEstructura).catch((e) => setError((e as Error).message));
    }
  }, [state?.instrumento_parsed, estructura]);

  // Estado de prereqs — muestra al lado del título como meta chip.
  const hasXlsform = !!state?.xlsform;
  const hasData = !!state?.data;
  const pendingChoiceMapping = !!dataPreview?.normalizacion?.choice_code_maps?.requires_confirmation;
  const allReady = hasXlsform && hasData && !pendingChoiceMapping;

  // ¿Está el usuario en modo multi-base? Dos formas de activarse:
  // 1) Demo/preset cargó ≥1 base real (Acreditación) → has_estudio
  //    true + n_bases ≥ 1 con nombres reales.
  // 2) Usuario activó el toggle "más de una base" manualmente → has_
  //    estudio true + n_bases puede ser 0 (estudio recién inicializado
  //    esperando que suba su primera base).
  // El caso "single-base legacy virtual" (n_bases=1 + nombre=default)
  // se sigue tratando como single-base — aún no hubo intención de
  // multi-base, es solo un mirror del legacy.
  const hasDefaultStudyBase = !!state
    && state.has_estudio
    && state.n_bases === 1
    && state.bases_nombres[0] === "default";
  const isIndependentStudy = state?.estudio_processing_mode === "independent_siblings";
  const isMultiBase = !!state
    && state.has_estudio
    && (
      forceMultiBase ||
      isIndependentStudy ||
      !(hasDefaultStudyBase)
    );

  // Payload del estudio — cargamos on-demand cuando entramos a modo
  // multi-base para mostrar el BasesPanel con detalle de cada base.
  const [estudio, setEstudio] = useState<EstudioPayload | null>(null);
  const cargaBaseOptions = estudio ? Object.values(estudio.bases) : [];
  const cargaBaseSignature = estudio
    ? Object.keys(estudio.bases).sort((a, b) => a.localeCompare(b, "es")).join("|")
    : "";
  // Flag que le pide al BasesPanel abrir directamente su form "Agregar
  // base" al montar. Se activa tras convertir single → multi con el
  // botón "+ Agregar otra base" para que el usuario no tenga que
  // buscar el botón dentro del panel.
  const [autoOpenAddBase, setAutoOpenAddBase] = useState(false);
  const lastSessionIdRef = useRef(sessionId);

  useEffect(() => {
    if (!sessionId || lastSessionIdRef.current === sessionId) return;
    lastSessionIdRef.current = sessionId;
    setInstrumento(null);
    setDataPreview(null);
    setChoiceMappingReview(null);
    setEstructura(null);
    setEstudio(null);
    setAutoOpenAddBase(false);
    setActiveCargaTab("insumos");
    setSelectedCargaBase("");
    setForceMultiBase(false);
    setPreferredMultiStrategy(undefined);
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

  useEffect(() => {
    if (!isMultiBase) {
      setEstudio(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const p = await apiEstudioGet();
        if (!cancelled) setEstudio(p);
      } catch {
        // Si falla (ej. sesión recién creada sin estudio), el BasesPanel
        // no se renderiza — volvemos a los UploadCards.
        if (!cancelled) setEstudio(null);
      }
    })();
    return () => { cancelled = true; };
  }, [isMultiBase, state?.n_bases, state?.bases_nombres?.join(",")]);

  // Tras cambios al estudio (add/remove/rename base), refrescar
  // session state + estudio payload + re-hidratar estructura del primer
  // instrumento si aplica.
  async function onEstudioChanged(payload: EstudioPayload) {
    setEstudio(payload);
    if (payload.processing_mode === "independent_siblings" || payload.n_bases > 1) {
      setForceMultiBase(true);
    }
    if (payload.processing_mode === "independent_siblings") {
      setPreferredMultiStrategy("independent");
    }
    await refresh();
    if (payload.n_bases > 0) {
      try {
        const r = await apiInstrumentoEstructura();
        setEstructura(r);
      } catch { /* primera base puede no tener estructura aún */ }
    } else {
      setEstructura(null);
    }
  }

  async function onConfirmChoiceMapping() {
    setError("");
    setBusy("Confirmando mapeo de códigos…");
    try {
      await apiCargaConfirmChoiceMapping();
      setDataPreview((prev) => markChoiceMappingConfirmed(prev));
      setChoiceMappingReview(null);
      await refresh();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function onExportNormalized(format: NormalizedExportFormat) {
    setError("");
    setBusy(`Preparando base normalizada .${format}…`);
    try {
      const out = await apiCargaExportNormalized(format);
      window.location.href = downloadUrl(out.file_id);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function openIndependentProcessingFromMonitoring() {
    setError("");
    setPlatformError("");
    setBusy("Preparando varias fuentes desde Monitoreo...");
    try {
      let payload: EstudioPayload;
      if (state?.has_estudio) {
        payload = await apiEstudioGet();
      } else if (hasXlsform && hasData) {
        await apiEstudioFromSession();
        payload = await apiEstudioGet();
      } else {
        payload = await apiEstudioInit();
      }
      setEstudio(payload);
      setForceMultiBase(true);
      setPreferredMultiStrategy("independent");
      setAutoOpenAddBase(false);
      setSourceMode("platform");
      setActiveCargaTab("insumos");
      await refresh();
    } catch (e) {
      setPlatformError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

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
      toolbar={
        <ContextBar
          ariaLabel="Estado de carga y modo del estudio"
          className="pulso-carga-commandbar"
          elevated
        >
          <CargaCommandSummary
            hasXlsform={hasXlsform}
            hasData={hasData}
            pendingChoiceMapping={pendingChoiceMapping}
            allReady={allReady}
          />
          {(allReady || hasXlsform || hasData) && (
            <SaveStatusIndicator
              state={allReady ? "saved" : "dirty"}
              variant="badge"
              savedLabel="Insumos listos"
            />
          )}
          <ContextBarDivider />
          <MultiBaseToggle
            on={isMultiBase}
            canTurnOff={isMultiBase && (state?.n_bases ?? 0) <= 1}
            bases={state?.n_bases ?? 0}
            disabled={!!busy}
            onTurnOn={async () => {
              setError("");
              setBusy("Activando modo de varias bases…");
              try {
                if (state?.has_estudio) {
                  const p = await apiEstudioGet();
                  setEstudio(p);
                  setForceMultiBase(true);
                  setAutoOpenAddBase(false);
                  setPreferredMultiStrategy(hasDefaultStudyBase ? "independent" : undefined);
                } else if (hasXlsform && hasData) {
                  // Hay archivos single-base — los promovemos a base_1.
                  await apiEstudioFromSession();
                  const p = await apiEstudioGet();
                  setEstudio(p);
                  setForceMultiBase(true);
                  setPreferredMultiStrategy("independent");
                  setAutoOpenAddBase(false);
                } else {
                  // Todavía no hay archivos — creamos un estudio vacío.
                  // En vacío dejamos que el BasesPanel muestre primero
                  // la estrategia de importación/API; el usuario aún puede
                  // escoger "Agregar otra base" si quiere carga manual.
                  const p = await apiEstudioInit();
                  setEstudio(p);
                  setForceMultiBase(true);
                  setPreferredMultiStrategy(undefined);
                  setAutoOpenAddBase(false);
                }
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy("");
              }
            }}
            onTurnOff={async () => {
              setError("");
              setBusy("Volviendo a una sola base…");
              try {
                await apiEstudioDowngradeToSingle();
                setEstudio(null);
                setAutoOpenAddBase(false);
                setForceMultiBase(false);
                setPreferredMultiStrategy(undefined);
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy("");
              }
            }}
          />
        </ContextBar>
      }
    >
      {(busy || error) && (
        <div ref={feedbackRef} className="pulso-feedback-stack pulso-feedback-stack--upload">
          {busy && <LoadingBlock variant="inline" label={busy} />}
          {error && <ErrorBlock label="No se pudo completar la carga" detail={error} />}
        </div>
      )}

      {choiceMappingReview && (
        <ChoiceMappingReviewDialog
          review={choiceMappingReview}
          busy={!!busy}
          onClose={() => setChoiceMappingReview(null)}
          onConfirm={onConfirmChoiceMapping}
        />
      )}

      {/* Modo multi-base: BasesPanel reemplaza los UploadCards.
          Cada base es un par (XLSForm + data) con nombre único. El
          usuario puede agregar, quitar, renombrar y volver a la carga
          simple si queda 1 sola base. */}
      {isMultiBase && estudio && (
        <AdaptiveSplitView
          ariaLabel="Mesa de trabajo de varias bases"
          railLabel="Estado de carga"
          className="pulso-upload-section pulso-carga-workbench"
          rail={(
            <CargaStageRail
              hasXlsform={hasXlsform}
              hasData={hasData}
              pendingChoiceMapping={pendingChoiceMapping}
              allReady={allReady}
              isMultiBase={isMultiBase}
              bases={state?.n_bases ?? 0}
              instrumento={instrumento}
              dataPreview={dataPreview}
              estructura={estructura}
            />
          )}
        >
          <div className="pulso-carga-content pulso-content-area pulso-carga-content--multi">
            <CargaSuiteBar
              modeLabel="Varias bases"
              headline={cargaBaseOptions.length > 0 ? "Mesa multibase activa" : "Define las fuentes del estudio"}
              detail={cargaBaseOptions.length > 0
                ? `${cargaBaseOptions.length} base${cargaBaseOptions.length === 1 ? "" : "s"} listas para revisar, comparar y consolidar.`
                : "Elige entre carga manual, fuentes conectadas o organización independiente desde Monitoreo."}
              hasXlsform={hasXlsform}
              hasData={hasData}
              pendingChoiceMapping={pendingChoiceMapping}
              allReady={allReady}
              controls={(
                <CargaWorkspaceTabs
                  active={activeCargaTab}
                  onChange={setActiveCargaTab}
                  baseReady={cargaBaseOptions.length > 0}
                />
              )}
            />
            {activeCargaTab === "insumos" ? (
              <>
                <BasesPanel
                  estudio={estudio}
                  onChanged={onEstudioChanged}
                  hasSessionXlsform={hasXlsform}
                  autoOpenAdd={autoOpenAddBase}
                  onAutoOpenConsumed={() => setAutoOpenAddBase(false)}
                  initialStrategy={preferredMultiStrategy}
                  onDowngraded={async () => {
                    setAutoOpenAddBase(false);
                    setEstudio(null);
                    setForceMultiBase(false);
                    setPreferredMultiStrategy(undefined);
                    setActiveCargaTab("insumos");
                    await refresh();
                  }}
                />
                <CargaFollowupContent
                  showInspection={!!state?.instrumento_parsed && !!estructura}
                  estructura={estructura}
                  hasXlsform={hasXlsform}
                  hasData={hasData}
                  pendingChoiceMapping={pendingChoiceMapping}
                  allReady={allReady}
                  isMultiBase={isMultiBase}
                  bases={state?.n_bases ?? 0}
                  busy={busy}
                  error={error}
                />
              </>
            ) : (
              <CargaBaseSheetPane
                isMultiBase
                allReady={allReady}
                busy={busy}
                error={error}
                baseOptions={cargaBaseOptions}
                selectedBase={selectedCargaBase}
                onSelectedBaseChange={setSelectedCargaBase}
              />
            )}
          </div>
        </AdaptiveSplitView>
      )}

      {isMultiBase && !estudio && (
        <AdaptiveSplitView
          ariaLabel="Mesa de trabajo de varias bases"
          railLabel="Estado de carga"
          className="pulso-upload-section pulso-carga-workbench"
          rail={(
            <CargaStageRail
              hasXlsform={hasXlsform}
              hasData={hasData}
              pendingChoiceMapping={pendingChoiceMapping}
              allReady={allReady}
              isMultiBase={isMultiBase}
              bases={state?.n_bases ?? 0}
              instrumento={instrumento}
              dataPreview={dataPreview}
              estructura={estructura}
            />
          )}
        >
          <div className="pulso-carga-content pulso-content-area">
            <CargaReadinessBoard
              hasXlsform={hasXlsform}
              hasData={hasData}
              pendingChoiceMapping={pendingChoiceMapping}
              allReady={allReady}
              isMultiBase={isMultiBase}
              bases={state?.n_bases ?? 0}
            />
            <section className="pulso-carga-study-loading" aria-live="polite">
              <span aria-hidden="true">
                <Loader2 size={17} className="pulso-spin" />
              </span>
              <div>
                <strong>Abriendo bases del estudio</strong>
                <p>La estructura de bases se está preparando para mostrar formularios, respuestas y origen de cada fuente.</p>
              </div>
              <div className="pulso-carga-study-skeleton" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            </section>
          </div>
        </AdaptiveSplitView>
      )}

      {/* Sección 1 — LOS DOS INSUMOS (single-base). Solo se muestra si
          NO estamos en modo multi-base. Si estamos en multi-base,
          BasesPanel ya cubre la carga de insumos. */}
      {!isMultiBase && (
      <>
      <AdaptiveSplitView
        ariaLabel="Mesa de trabajo de carga"
        railLabel="Estado de carga"
        className="pulso-upload-section pulso-carga-workbench"
        rail={(
          <CargaStageRail
            hasXlsform={hasXlsform}
            hasData={hasData}
            pendingChoiceMapping={pendingChoiceMapping}
            allReady={allReady}
            isMultiBase={isMultiBase}
            bases={state?.n_bases ?? 0}
            instrumento={instrumento}
            dataPreview={dataPreview}
            estructura={estructura}
          />
        )}
      >

        <div className="pulso-carga-content pulso-content-area">
          <CargaSuiteBar
            modeLabel={sourceMode === "files" ? "Carga manual" : "Carga conectada"}
            headline={allReady ? "Insumos listos para validar" : sourceMode === "platform" ? "Importa desde una plataforma" : "Carga formulario y respuestas"}
            detail={sourceMode === "platform"
              ? "Lee SurveyMonkey o KoboToolbox, selecciona una fuente y deja el instrumento con su base listos en el mismo flujo."
              : "Carga primero el formulario y luego las respuestas para reconstruir variables, códigos y compatibilidad antes de validar."}
            hasXlsform={hasXlsform}
            hasData={hasData}
            pendingChoiceMapping={pendingChoiceMapping}
            allReady={allReady}
            controls={(
              <>
              <CargaWorkspaceTabs
                active={activeCargaTab}
                onChange={setActiveCargaTab}
                baseReady={allReady}
              />
              {activeCargaTab === "insumos" && (
                <div className="pulso-carga-source-switch" role="tablist" aria-label="Origen de carga">
                  <button
                    type="button"
                    className={sourceMode === "files" ? "is-active" : ""}
                    onClick={() => setSourceMode("files")}
                    role="tab"
                    aria-selected={sourceMode === "files"}
                    title="Archivos - carga manual desde XLSForm y respuestas"
                  >
                    <Upload size={14} />
                    <span className="pulso-carga-tab-label">Archivos</span>
                  </button>
                  <button
                    type="button"
                    className={sourceMode === "platform" ? "is-active" : ""}
                    onClick={() => setSourceMode("platform")}
                    role="tab"
                    aria-selected={sourceMode === "platform"}
                    title="Plataforma - importar desde SurveyMonkey o KoboToolbox"
                  >
                    <CloudDownload size={14} />
                    <span className="pulso-carga-tab-label">Plataforma</span>
                  </button>
                </div>
              )}
              </>
            )}
          />

          {activeCargaTab === "insumos" ? (
            <>
          {sourceMode === "files" && detectedKoboSource && (
            <DetectedKoboSourceCallout
              source={detectedKoboSource}
              busy={!!busy}
              hasConnection={koboConnection?.has_token === true}
              onImport={() => void onImportDetectedKoboSource()}
              onReview={() => {
                setSourceMode("platform");
                seedDetectedKoboAsset(detectedKoboSource);
              }}
            />
          )}

          {sourceMode === "platform" && (
            <PlatformImportPanel
              provider={platformProvider}
              onProviderChange={(provider) => {
                setPlatformProvider(provider);
                setPlatformError("");
                setPlatformMessage("");
              }}
              connectionsLoading={connectionsLoading}
              smConnection={smConnection}
              koboConnection={koboConnection}
              smProfiles={smProfiles}
              koboProfiles={koboProfiles}
              selectedSmProfileId={activeSmProfile?.id || ""}
              selectedKoboProfileId={activeKoboProfile?.id || ""}
              onSmProfileChange={(profileId) => {
                setSelectedSmProfileId(profileId);
                setSmSurveys([]);
                setSelectedSurveyId("");
              }}
              onKoboProfileChange={(profileId) => {
                setSelectedKoboProfileId(profileId);
                setKoboAssets([]);
                setSelectedAssetUid("");
              }}
              query={platformQuery}
              onQueryChange={setPlatformQuery}
              catalogLoading={catalogLoading}
              onLoadCatalog={(force) => void loadPlatformCatalog(force)}
              smSurveys={smSurveys}
              koboAssets={koboAssets}
              selectedSurveyId={selectedSurveyId}
              selectedAssetUid={selectedAssetUid}
              onSurveySelect={setSelectedSurveyId}
              onAssetSelect={setSelectedAssetUid}
              includePartials={includePartials}
              onIncludePartialsChange={setIncludePartials}
              busy={!!busy}
              error={platformError}
              message={platformMessage}
              processingSuggestions={processingSuggestions}
              processingSuggestionsStatus={processingSuggestionsStatus}
              onOpenIndependentProcessing={() => void openIndependentProcessingFromMonitoring()}
              detectedKoboSource={detectedKoboSource}
              onImportDetectedKoboSource={() => void onImportDetectedKoboSource()}
              onImport={() => void onPlatformImport()}
            />
          )}

          {sourceMode === "files" && (
          <div className="pulso-upload-grid">
            <UploadCard
              kind="xlsform"
              icon={FileSpreadsheet}
              title="1. Formulario del estudio"
              hint="El archivo que define preguntas, opciones, secciones y reglas del estudio."
              whatIs={
                <>
                  Es un archivo <strong>Excel (.xlsx)</strong> de formulario:
                  una hoja <code>survey</code> con las preguntas y una <code>choices</code>{" "}
                  con las opciones. Sin este archivo, la app no sabe qué variables significan qué.
                </>
              }
              accept=".xlsx,.xls"
              acceptLabel="Solo Excel (.xlsx)"
              done={hasXlsform}
              busy={!!busy}
              disabled={!!busy}
              resumen={instrumento && (
                <>
                  <ResumenStat label="Preguntas" value={instrumento.n_preguntas} />
                  {(instrumento.n_calculos ?? 0) > 0 && (
                    <ResumenStat label="Cálculos" value={instrumento.n_calculos ?? 0} />
                  )}
                  <ResumenStat label="Secciones" value={instrumento.n_secciones} />
                  <ResumenStat label="Listas de opciones" value={instrumento.n_listas_opciones} />
                </>
              )}
              onPick={(file) => onPick("xlsform", file)}
              onRemove={() => onQuitar("xlsform")}
            />

            <UploadCard
              kind="data"
              icon={Database}
              title="2. Respuestas"
              hint={hasXlsform
                ? "El archivo con las respuestas. Se revisará contra el formulario ya cargado."
                : "Primero carga el formulario para activar las respuestas y evitar una preparación incompleta."}
              whatIs={
                <>
                  Es el resultado de tu trabajo de campo. Acepta <strong>Excel (.xlsx)</strong>,{" "}
                  <strong>CSV</strong>, <strong>SPSS (.sav)</strong> o un <strong>ZIP</strong> con
                  un único <code>.sav</code>. Las columnas deben corresponder a las variables del formulario.
                </>
              }
              accept=".xlsx,.xls,.csv,.sav,.zip,application/x-spss-sav,application/octet-stream,application/zip,application/x-zip-compressed"
              acceptLabel=".xlsx · .csv · .sav · .zip"
              done={hasData}
              busy={!!busy}
              disabled={!!busy || !hasXlsform}
              disabledHint="Disponible después de cargar el formulario"
              resumen={dataPreview && (
                <>
                  <ResumenStat label="Filas" value={dataPreview.n_filas} />
                  <ResumenStat label="Columnas" value={dataPreview.n_columnas} />
                  <div className="pulso-upload-normalizacion">
                    {dataPreview.normalizacion?.applied
                      ? (
                        <>
                          Preparación aplicada · {dataPreview.normalizacion.aliases} alias
                          {dataPreview.normalizacion.select_multiple > 0
                            ? ` · ${dataPreview.normalizacion.select_multiple} selección múltiple reconstruida`
                            : ""}
                          {(dataPreview.normalizacion.single_child_collapses ?? 0) > 0
                            ? ` · ${dataPreview.normalizacion.single_child_collapses} escala(s) colapsada(s)`
                            : ""}
                          {typeof dataPreview.normalizacion.extra_columns === "number" && dataPreview.normalizacion.extra_columns > 0
                            ? ` · ${dataPreview.normalizacion.extra_columns} columna(s) auxiliar(es) al final`
                            : ""}
                          {dataPreview.normalizacion.choice_code_maps?.applied
                            ? ` · ${dataPreview.normalizacion.choice_code_maps.n_questions} mapeo(s) de códigos`
                            : ""}
                        </>
                      )
                      : "Preparación pendiente: se activa después de cargar el formulario"}
                  </div>
                  {choiceMappingReviewFromPreview(dataPreview) && (
                    <div className={`pulso-choice-map-inline${dataPreview.normalizacion?.choice_code_maps?.requires_confirmation ? " needs-review" : ""}`}>
                      <span aria-hidden="true" className="pulso-choice-map-inline-icon">
                        <ArrowRightLeft size={13} />
                      </span>
                      <span>
                        {dataPreview.normalizacion?.choice_code_maps?.requires_confirmation
                          ? "Pulso detectó las mismas etiquetas con códigos distintos. Confirma cómo ajustar las respuestas antes de validar."
                          : "Mapeo de códigos confirmado para estas respuestas."}
                      </span>
                      <button
                        type="button"
                        className="pulso-choice-map-inline-button"
                        onClick={() => setChoiceMappingReview(choiceMappingReviewFromPreview(dataPreview))}
                      >
                        {dataPreview.normalizacion?.choice_code_maps?.requires_confirmation ? "Revisar" : "Ver mapeo"}
                      </button>
                    </div>
                  )}
                  {normalizationDetails.length > 0 && (
                    <details className="pulso-normalization-details">
                      <summary>Ver normalización</summary>
                      <ul>
                        {normalizationDetails.map((row, i) => (
                          <li key={i}>{row}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {dataPreview.normalizacion?.applied && !pendingChoiceMapping && (
                    <NormalizedExportActions
                      busy={!!busy}
                      onExport={(format) => void onExportNormalized(format)}
                    />
                  )}
                  {dataPreview.compatibilidad?.applied && (
                    <div className={`pulso-upload-compat ${dataPreview.compatibilidad.ok ? "is-ok" : "is-bad"}`}>
                      {dataPreview.compatibilidad.ok ? "Compatible con el formulario" : "Incompatible con el formulario"}
                      {typeof dataPreview.compatibilidad.expected_columns === "number"
                        ? ` · ${dataPreview.compatibilidad.matched_columns}/${dataPreview.compatibilidad.expected_columns} variables`
                        : ""}
                      {(dataPreview.compatibilidad.n_missing ?? dataPreview.compatibilidad.missing_columns.length) > 0
                        ? ` · faltan ${dataPreview.compatibilidad.missing_columns.slice(0, 6).join(", ")}`
                        : ""}
                      {(dataPreview.compatibilidad.n_extra ?? dataPreview.compatibilidad.extra_columns.length) > 0
                        ? ` · ${dataPreview.compatibilidad.n_extra ?? dataPreview.compatibilidad.extra_columns.length} extra permitida(s)`
                        : ""}
                    </div>
                  )}
                  {dataPreview.columnas.length > 0 && (
                    <details className="pulso-column-details">
                      <summary>
                        Ver columnas ({dataPreview.columnas.length})
                      </summary>
                      <ul>
                        {dataPreview.columnas.map((c, i) => (
                          <li key={i}>
                            <code>{c.nombre}</code>{" "}
                            <em>({c.tipo})</em>
                            {c.origen === "extra" && (
                              <span className="pulso-column-extra">extra</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              )}
              onPick={(file) => onPick("data", file)}
              onRemove={() => onQuitar("data")}
            />
          </div>
          )}
          <CargaFollowupContent
            showInspection={!!state?.instrumento_parsed && !!estructura}
            estructura={estructura}
            hasXlsform={hasXlsform}
            hasData={hasData}
            pendingChoiceMapping={pendingChoiceMapping}
            allReady={allReady}
            isMultiBase={isMultiBase}
            bases={state?.n_bases ?? 0}
            busy={busy}
            error={error}
          />
            </>
          ) : (
            <CargaBaseSheetPane
              allReady={allReady}
              busy={busy}
              error={error}
              baseOptions={[]}
              selectedBase=""
              onSelectedBaseChange={setSelectedCargaBase}
            />
          )}
        </div>

        {/* El botón "+ Agregar otra base" se eliminó — ahora la
            conversión single→multi se hace con el MultiBaseToggle de
            arriba del todo. */}
      </AdaptiveSplitView>
      </>
      )}
    </PageFrame>
  );
}

// `EstudioActivoBanner` (banner genérico multi-base que vivía acá) se
// reemplazó por `BasesPanel` completo — ahora no solo muestra las bases
// sino que permite renombrar, quitar y agregar.

function NormalizedExportActions({
  busy,
  onExport,
}: {
  busy: boolean;
  onExport: (format: NormalizedExportFormat) => void;
}) {
  return (
    <div className="pulso-normalized-export-actions">
      <span>Base normalizada</span>
      {(["xlsx", "csv", "sav"] as NormalizedExportFormat[]).map((format) => (
        <button
          key={format}
          type="button"
          disabled={busy}
          onClick={() => onExport(format)}
        >
          <Download size={12} />
          .{format}
        </button>
      ))}
    </div>
  );
}

function DetectedKoboSourceCallout({
  source,
  busy,
  hasConnection,
  compact = false,
  onImport,
  onReview,
}: {
  source: DetectedKoboSource;
  busy: boolean;
  hasConnection: boolean;
  compact?: boolean;
  onImport: () => void;
  onReview: () => void;
}) {
  return (
    <section className={`pulso-kobo-detected${compact ? " is-compact" : ""}`} aria-label="Fuente Kobo detectada">
      <span className="pulso-kobo-detected-icon" aria-hidden="true">
        <CloudDownload size={16} />
      </span>
      <div className="pulso-kobo-detected-copy">
        <strong>Fuente Kobo detectada</strong>
        <span>
          {source.name || source.source_title || source.asset_uid}
          {source.base_url ? ` · ${source.base_url.replace(/^https?:\/\//, "")}` : ""}
          {source.phase ? ` · fase ${source.phase}` : ""}
        </span>
      </div>
      <div className="pulso-kobo-detected-actions">
        <button
          type="button"
          className="pulso-kobo-detected-secondary"
          onClick={onReview}
          disabled={busy}
        >
          Revisar
        </button>
        <button
          type="button"
          className="pulso-kobo-detected-primary"
          onClick={onImport}
          disabled={busy || !hasConnection}
          title={hasConnection ? "Importar fuente Kobo detectada" : "Conecta KoboToolbox en Configuración"}
        >
          {busy ? <Loader2 size={14} className="pulso-spin" /> : <CloudDownload size={14} />}
          Importar fuente detectada
        </button>
      </div>
    </section>
  );
}

function PlatformProcessingSuggestions({
  suggestions,
  status,
  busy,
  onOpen,
}: {
  suggestions: EstudioProcessingSuggestions | null;
  status: string;
  busy: boolean;
  onOpen: () => void;
}) {
  const groups = suggestions?.groups ?? [];
  const shouldShow = Boolean(status || suggestions?.has_suggestions || suggestions?.profile_family === "acreditacion");
  if (!shouldShow) return null;
  const smGroups = groups.filter((group) => group.platform === "surveymonkey" && group.importable);
  const koboGroups = groups.filter((group) => group.platform === "kobo" && group.importable);
  const readyGroups = smGroups.length + koboGroups.length;
  return (
    <div className="pulso-monitoring-suggestions is-platform" aria-label="Sugerencias de Procesamiento desde Monitoreo">
      <div className="pulso-monitoring-suggestions-head">
        <span className="pulso-monitoring-suggestions-icon" aria-hidden="true">
          {status ? <Loader2 size={15} className="pulso-spin" /> : <ArrowRightLeft size={15} />}
        </span>
        <div>
          <strong>Procesamiento de acreditación sugerido desde Monitoreo</strong>
          <span>
            {status || suggestions?.message || "Las fuentes pueden organizarse por actor."}
          </span>
        </div>
        <div className="pulso-monitoring-suggestions-actions">
          <button type="button" onClick={onOpen} disabled={busy || !readyGroups}>
            <ArrowRight size={13} />
            Abrir fuentes independientes
          </button>
        </div>
      </div>
      {groups.length ? (
        <div className="pulso-monitoring-suggestion-grid" role="list">
          {groups.map((group) => {
            const channels = Array.from(new Set(group.sources.map((source) => source.channel).filter(Boolean)));
            return (
              <div className="pulso-monitoring-suggestion-row is-compact" role="listitem" key={group.id}>
                <div className="pulso-monitoring-suggestion-actor">
                  <strong>{group.actor}</strong>
                  <small>{group.platform === "surveymonkey" ? "SurveyMonkey" : "Kobo"} · {group.source_count} fuente{group.source_count === 1 ? "" : "s"}</small>
                </div>
                <div className="pulso-monitoring-suggestion-meta">
                  <span>{group.response_count ? `${group.response_count} resp.` : "sin conteo"}</span>
                  <span>{channels.length > 1 ? "Canal mixto" : channels[0] || "Canal por definir"}</span>
                  <span>{group.importable ? "Listo para traducir" : "Detectado"}</span>
                </div>
                <span className={`pulso-platform-suggestion-status${group.importable ? " is-ready" : ""}`}>
                  {group.importable ? <CheckCircle2 size={12} /> : <Info size={12} />}
                  {group.importable ? (group.platform === "kobo" ? "Kobo" : "SurveyMonkey") : "Pendiente"}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="pulso-monitoring-suggestions-note">
          <Info size={13} />
          <span>{suggestions?.message || "Sin fuentes listas para Procesamiento."}</span>
        </div>
      )}
    </div>
  );
}

function PlatformImportPanel({
  provider,
  onProviderChange,
  connectionsLoading,
  smConnection,
  koboConnection,
  smProfiles,
  koboProfiles,
  selectedSmProfileId,
  selectedKoboProfileId,
  onSmProfileChange,
  onKoboProfileChange,
  query,
  onQueryChange,
  catalogLoading,
  onLoadCatalog,
  smSurveys,
  koboAssets,
  selectedSurveyId,
  selectedAssetUid,
  onSurveySelect,
  onAssetSelect,
  includePartials,
  onIncludePartialsChange,
  busy,
  error,
  message,
  processingSuggestions,
  processingSuggestionsStatus,
  onOpenIndependentProcessing,
  detectedKoboSource,
  onImportDetectedKoboSource,
  onImport,
}: {
  provider: CargaPlatformProvider;
  onProviderChange: (provider: CargaPlatformProvider) => void;
  connectionsLoading: boolean;
  smConnection?: ConnectionTokenState;
  koboConnection?: ConnectionTokenState;
  smProfiles: Array<{ id: string; alias: string; base_url?: string; is_default?: boolean }>;
  koboProfiles: Array<{ id: string; alias: string; base_url?: string; is_default?: boolean }>;
  selectedSmProfileId: string;
  selectedKoboProfileId: string;
  onSmProfileChange: (profileId: string) => void;
  onKoboProfileChange: (profileId: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  catalogLoading: boolean;
  onLoadCatalog: (forceRefresh: boolean) => void;
  smSurveys: SurveyMonkeyMultibaseListItem[];
  koboAssets: MonitoreoKoboAssetItem[];
  selectedSurveyId: string;
  selectedAssetUid: string;
  onSurveySelect: (surveyId: string) => void;
  onAssetSelect: (assetUid: string) => void;
  includePartials: boolean;
  onIncludePartialsChange: (value: boolean) => void;
  busy: boolean;
  error: string;
  message: string;
  processingSuggestions: EstudioProcessingSuggestions | null;
  processingSuggestionsStatus: string;
  onOpenIndependentProcessing: () => void;
  detectedKoboSource: DetectedKoboSource | null;
  onImportDetectedKoboSource: () => void;
  onImport: () => void;
}) {
  const isSurveyMonkey = provider === "surveymonkey";
  const connection = isSurveyMonkey ? smConnection : koboConnection;
  const profiles = isSurveyMonkey ? smProfiles : koboProfiles;
  const selectedProfileId = isSurveyMonkey ? selectedSmProfileId : selectedKoboProfileId;
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? profiles[0] ?? null;
  const hasConnection = connection?.has_token === true;
  const selectedSurvey = smSurveys.find((survey) => survey.id === selectedSurveyId) ?? null;
  const selectedAsset = koboAssets.find((asset) => asset.uid === selectedAssetUid) ?? null;
  const selectedReady = isSurveyMonkey ? Boolean(selectedSurvey) : Boolean(selectedAsset);
  const rowsCount = isSurveyMonkey ? smSurveys.length : koboAssets.length;
  const providerName = providerLabel(provider);

  return (
    <section className="pulso-platform-import" aria-label="Carga desde plataforma">
      <div className="pulso-platform-topbar">
        <div className="pulso-platform-provider-tabs" role="tablist" aria-label="Proveedor">
          {(["surveymonkey", "kobo"] as CargaPlatformProvider[]).map((item) => (
            <button
              key={item}
              type="button"
              className={provider === item ? "is-active" : ""}
              onClick={() => onProviderChange(item)}
              role="tab"
              aria-selected={provider === item}
              title={`${providerLabel(item)} - seleccionar proveedor de origen`}
            >
              {item === "surveymonkey" ? <CloudDownload size={14} /> : <Database size={14} />}
              <span className="pulso-platform-provider-label">{providerLabel(item)}</span>
            </button>
          ))}
        </div>
        <div className="pulso-platform-topbar-actions">
          <div className={`pulso-platform-status${hasConnection ? " is-ready" : ""}`}>
            <span aria-hidden="true" />
            {connectionsLoading ? "Verificando conexiones" : hasConnection ? "Conectado" : "Sin conexión"}
          </div>
          {isSurveyMonkey && (
            <label className="pulso-platform-check">
              <input
                type="checkbox"
                checked={includePartials}
                onChange={(event) => onIncludePartialsChange(event.target.checked)}
                disabled={busy}
              />
              <span>Parciales</span>
            </label>
          )}
        </div>
      </div>

      <PlatformProcessingSuggestions
        suggestions={processingSuggestions}
        status={processingSuggestionsStatus}
        busy={busy}
        onOpen={onOpenIndependentProcessing}
      />

      <div className="pulso-platform-controls">
        <label className="pulso-platform-field">
          <span>Perfil</span>
          <select
            value={selectedProfile?.id || ""}
            onChange={(event) => {
              if (isSurveyMonkey) onSmProfileChange(event.target.value);
              else onKoboProfileChange(event.target.value);
            }}
            disabled={busy || catalogLoading || profiles.length <= 1}
          >
            {profiles.length > 0 ? profiles.map((profile) => (
              <option key={profile.id || profile.alias} value={profile.id}>
                {profile.alias}{profile.base_url ? ` · ${profile.base_url.replace(/^https?:\/\//, "")}` : ""}
              </option>
            )) : (
              <option value="">Sin perfil conectado</option>
            )}
          </select>
        </label>
        <label className="pulso-platform-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onLoadCatalog(false);
            }}
            placeholder={isSurveyMonkey ? "Buscar encuesta" : "Buscar proyecto"}
            disabled={busy || catalogLoading || !hasConnection}
          />
        </label>
        <button
          type="button"
          className="pulso-platform-load"
          onClick={() => onLoadCatalog(false)}
          disabled={busy || catalogLoading || !hasConnection}
        >
          {catalogLoading ? <Loader2 size={14} className="pulso-spin" /> : <CloudDownload size={14} />}
          Leer lista
        </button>
        <button
          type="button"
          className="pulso-platform-refresh"
          title={`Actualizar ${providerName}`}
          aria-label={`Actualizar ${providerName}`}
          onClick={() => onLoadCatalog(true)}
          disabled={busy || catalogLoading || !hasConnection}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {!isSurveyMonkey && detectedKoboSource && (
        <DetectedKoboSourceCallout
          source={detectedKoboSource}
          busy={busy}
          hasConnection={hasConnection}
          compact
          onImport={onImportDetectedKoboSource}
          onReview={() => {
            onQueryChange(detectedKoboSource.name || detectedKoboSource.source_title || "");
            onAssetSelect(detectedKoboSource.asset_uid);
          }}
        />
      )}

      {error && <div className="pulso-platform-alert is-error">{error}</div>}
      {message && !error && <div className="pulso-platform-alert">{message}</div>}

      <div className="pulso-platform-list" aria-label={`Catálogo ${providerName}`}>
        {rowsCount === 0 ? (
          <div className="pulso-platform-empty">
            <span className="pulso-platform-empty-icon" aria-hidden="true">
              <Search size={15} />
            </span>
            <strong>{hasConnection ? "Catálogo sin cargar" : `Sin conexión ${providerName}`}</strong>
            <small>{hasConnection ? "0 fuentes disponibles en esta vista" : "Perfil pendiente"}</small>
          </div>
        ) : isSurveyMonkey ? (
          smSurveys.map((survey) => (
            <button
              key={survey.id}
              type="button"
              className={`pulso-platform-row${selectedSurveyId === survey.id ? " is-selected" : ""}`}
              onClick={() => onSurveySelect(survey.id)}
              aria-pressed={selectedSurveyId === survey.id}
            >
              <span className="pulso-platform-row-main">
                <strong>{survey.title}</strong>
                <small>
                  Survey ID {survey.id}
                  {survey.nickname ? ` · ${survey.nickname}` : ""}
                  {survey.date_modified ? ` · ${survey.date_modified.slice(0, 10)}` : ""}
                </small>
              </span>
              <span className="pulso-platform-row-count">
                {survey.response_count ?? "—"} resp.
              </span>
            </button>
          ))
        ) : (
          koboAssets.map((asset) => (
            <button
              key={asset.uid}
              type="button"
              className={`pulso-platform-row${selectedAssetUid === asset.uid ? " is-selected" : ""}`}
              onClick={() => onAssetSelect(asset.uid)}
              aria-pressed={selectedAssetUid === asset.uid}
            >
              <span className="pulso-platform-row-main">
                <strong>{asset.name}</strong>
                <small>
                  Asset {asset.uid}
                  {asset.date_modified ? ` · ${asset.date_modified.slice(0, 10)}` : ""}
                </small>
              </span>
              <span className={`pulso-platform-row-count${asset.deployment_active ? " is-live" : ""}`}>
                {asset.deployment_active ? "activo" : "borrador"}
              </span>
            </button>
          ))
        )}
      </div>

      <div className={`pulso-platform-footer${selectedReady ? " is-ready" : " is-waiting"}`}>
        <span>
          {selectedReady
            ? isSurveyMonkey
              ? selectedSurvey?.title
              : selectedAsset?.name
            : "Selecciona una fuente para activar la importación"}
        </span>
        <button
          type="button"
          className={`pulso-platform-import-button${selectedReady ? " is-ready" : " is-unavailable"}${busy ? " is-busy" : ""}`}
          onClick={onImport}
          disabled={busy || catalogLoading || !hasConnection || !selectedReady}
        >
          {busy ? <Loader2 size={15} className="pulso-spin" /> : <CloudDownload size={15} />}
          Importar a carga
        </button>
      </div>
    </section>
  );
}

function CargaWorkspaceTabs({
  active,
  baseReady,
  onChange,
}: {
  active: CargaWorkspaceTab;
  baseReady: boolean;
  onChange: (tab: CargaWorkspaceTab) => void;
}) {
  return (
    <div className="pulso-carga-source-switch pulso-carga-view-tabs" role="tablist" aria-label="Vista de carga">
      <button
        type="button"
        className={`pulso-carga-view-tab${active === "insumos" ? " is-active" : ""}`}
        onClick={() => onChange("insumos")}
        role="tab"
        aria-selected={active === "insumos"}
        title="Insumos - formulario, respuestas y fuentes"
      >
        <Upload size={14} />
        <span className="pulso-carga-tab-label">Insumos</span>
      </button>
      <button
        type="button"
        className={`pulso-carga-view-tab${active === "base" ? " is-active" : ""}${baseReady ? " is-ready" : " is-pending"}`}
        onClick={() => onChange("base")}
        role="tab"
        aria-selected={active === "base"}
        aria-disabled={!baseReady}
        title={baseReady ? "Base de carga - revisar respuestas cargadas" : "Base de carga - pendiente hasta cargar formulario y respuestas"}
      >
        <Table2 size={14} />
        <span className="pulso-carga-tab-label">Base de carga</span>
        <span className="pulso-carga-view-tab-state" aria-hidden="true" />
      </button>
    </div>
  );
}

function CargaBaseSheetPane({
  isMultiBase = false,
  allReady,
  busy,
  error,
  baseOptions,
  selectedBase,
  onSelectedBaseChange,
}: {
  isMultiBase?: boolean;
  allReady: boolean;
  busy: string;
  error: string;
  baseOptions: EstudioBase[];
  selectedBase: string;
  onSelectedBaseChange: (base: string) => void;
}) {
  const activeBase = baseOptions.find((base) => base.nombre === selectedBase) ?? baseOptions[0] ?? null;
  const hasMultiBase = isMultiBase && baseOptions.length > 0;
  const enabled = isMultiBase ? hasMultiBase && !busy && !error : allReady && !busy && !error;
  const disabledMessage = isMultiBase
    ? "Agrega al menos una base para ver sus respuestas cargadas."
    : "Carga el formulario y las respuestas para ver la base completa.";
  const sourceLabel = isMultiBase && activeBase
    ? `Carga · ${cargaBaseLabel(activeBase)} · antes de validación, limpieza y codificación`
    : "Carga · antes de validación, limpieza y codificación";

  return (
    <section className="pulso-carga-base-shell" aria-label="Base de carga">
      {isMultiBase && (
        <div className="pulso-carga-base-picker">
          <div>
            <strong>Base visible</strong>
            <span>{activeBase ? cargaBaseMeta(activeBase) : "Sin bases cargadas"}</span>
          </div>
          <label>
            <span className="pulso-sr-only">Seleccionar base de carga</span>
            <select
              value={activeBase?.nombre ?? ""}
              onChange={(event) => onSelectedBaseChange(event.target.value)}
              disabled={!baseOptions.length || !!busy}
            >
              {baseOptions.map((base) => (
                <option key={base.nombre} value={base.nombre}>
                  {cargaBaseLabel(base)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <ProcessingSheetViewer
        title="Base de carga"
        sourceLabel={sourceLabel}
        enabled={enabled}
        disabledMessage={disabledMessage}
        request={activeBase ? { base_nombre: activeBase.nombre } : undefined}
        load={apiCargaBaseSheet}
      />
    </section>
  );
}

function cargaBaseLabel(base: EstudioBase) {
  return String(base.source_alias || base.source_title || base.nombre || "").trim() || base.nombre;
}

function cargaBaseMeta(base: EstudioBase) {
  const rows = typeof base.n_filas === "number" ? base.n_filas.toLocaleString("es-PE") : "sin conteo";
  const cols = typeof base.n_columnas === "number" ? base.n_columnas.toLocaleString("es-PE") : "sin columnas";
  return `${base.nombre} · ${rows} filas · ${cols} columnas`;
}

function CargaFollowupContent({
  showInspection,
  estructura,
  hasXlsform,
  hasData,
  pendingChoiceMapping,
  allReady,
  isMultiBase,
  bases,
  busy,
  error,
}: {
  showInspection: boolean;
  estructura: { secciones: Seccion[]; preguntas: Pregunta[] } | null;
  hasXlsform: boolean;
  hasData: boolean;
  pendingChoiceMapping: boolean;
  allReady: boolean;
  isMultiBase: boolean;
  bases: number;
  busy: string;
  error: string;
}) {
  const showReadinessBoard = !showInspection && (allReady || pendingChoiceMapping || isMultiBase);

  return (
    <>
      {showInspection && estructura && (
        <section className="pulso-carga-inspection" aria-label="Inspección del instrumento">
          <Panel
            eyebrow="Instrumento"
            title="Mapa de secciones"
            hint="Cada fila es una sección del formulario con sus reglas de visibilidad."
            className="pulso-carga-inspection-panel"
          >
            <SeccionesPanel secciones={estructura.secciones} />
          </Panel>
          <Panel
            eyebrow="Instrumento"
            title="Mapa del instrumento"
            hint="Distingue preguntas respondidas, variables calculadas y reglas declaradas en el formulario."
            className="pulso-carga-inspection-panel"
          >
            <PreguntasPanel preguntas={estructura.preguntas} secciones={estructura.secciones} />
          </Panel>
        </section>
      )}

      {showReadinessBoard && (
        <CargaReadinessBoard
          hasXlsform={hasXlsform}
          hasData={hasData}
          pendingChoiceMapping={pendingChoiceMapping}
          allReady={allReady}
          isMultiBase={isMultiBase}
          bases={bases}
        />
      )}

      {allReady && !busy && !error && <ContinuarCTA />}
    </>
  );
}

function CargaReadinessBoard({
  hasXlsform,
  hasData,
  pendingChoiceMapping,
  allReady,
  isMultiBase,
  bases,
}: {
  hasXlsform: boolean;
  hasData: boolean;
  pendingChoiceMapping: boolean;
  allReady: boolean;
  isMultiBase: boolean;
  bases: number;
}) {
  const reviewReady = allReady && !pendingChoiceMapping;
  const headline = allReady
    ? "Base lista para revisar"
    : hasXlsform
    ? "Falta conectar respuestas"
    : "Prepara los insumos";
  const detail = allReady
    ? "El siguiente paso es auditar consistencia, filtros y reglas antes de producir resultados."
    : hasXlsform
    ? "El formulario ya define la estructura. Ahora carga o importa las respuestas."
    : "Comienza con el formulario; luego Pulso habilita la carga de respuestas.";
  const items = [
    {
      key: "form",
      icon: FileSpreadsheet,
      title: "Formulario",
      meta: hasXlsform ? "Estructura disponible" : "Pendiente",
      ready: hasXlsform,
    },
    {
      key: "data",
      icon: Database,
      title: "Respuestas",
      meta: hasData ? "Base conectada" : hasXlsform ? "Lista para cargar" : "Bloqueada",
      ready: hasData,
    },
    {
      key: "review",
      icon: ShieldCheck,
      title: "Revisión",
      meta: pendingChoiceMapping ? "Mapeo pendiente" : reviewReady ? "Lista" : "En espera",
      ready: reviewReady,
      warning: pendingChoiceMapping,
    },
  ];

  return (
    <section className="pulso-carga-readiness" aria-label="Estado operativo de carga">
      <div className="pulso-carga-readiness-main">
        <span className="pulso-carga-readiness-icon" aria-hidden="true">
          {allReady ? <CheckCircle2 size={20} /> : <Upload size={20} />}
        </span>
        <div>
          <span className="pulso-carga-readiness-kicker">Preparación</span>
          <strong>{headline}</strong>
          <p>{detail}</p>
        </div>
      </div>

      <div className="pulso-carga-readiness-grid">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.key}
              className={`pulso-carga-readiness-card${item.ready ? " is-ready" : ""}${item.warning ? " is-warning" : ""}`}
            >
              <span aria-hidden="true">
                <Icon size={16} />
              </span>
              <strong>{item.title}</strong>
              <small>{item.meta}</small>
            </div>
          );
        })}
      </div>

      <div className="pulso-carga-entry-strip" aria-label="Modos de entrada">
        <span><Upload size={13} /> Archivos</span>
        <span><CloudDownload size={13} /> Plataforma</span>
        <span><ArrowRightLeft size={13} /> {isMultiBase ? `${bases} base${bases === 1 ? "" : "s"}` : "Una base"}</span>
      </div>
    </section>
  );
}

// =====================================================================
// Upload card — dropzone unificada con estado visual
// =====================================================================
function CargaCommandSummary({
  hasXlsform,
  hasData,
  pendingChoiceMapping,
  allReady,
}: {
  hasXlsform: boolean;
  hasData: boolean;
  pendingChoiceMapping: boolean;
  allReady: boolean;
}) {
  const reviewLabel = pendingChoiceMapping ? "Mapeo pendiente" : allReady ? "Listo para validar" : "En preparación";
  return (
    <div className="pulso-carga-command-summary" aria-label="Resumen de carga">
      <CargaCommandPill label="Formulario" done={hasXlsform} />
      <CargaCommandPill label="Respuestas" done={hasData} />
      <span className={`pulso-carga-command-review${allReady ? " is-ready" : pendingChoiceMapping ? " needs-review" : ""}`}>
        <ShieldCheck size={13} />
        {reviewLabel}
      </span>
    </div>
  );
}

function CargaCommandPill({ label, done }: { label: string; done: boolean }) {
  return (
    <span className={`pulso-carga-command-pill${done ? " is-done" : ""}`}>
      <span aria-hidden="true" className="pulso-carga-command-dot" />
      {label}
    </span>
  );
}

function CargaSuiteBar({
  modeLabel,
  headline,
  detail,
  hasXlsform,
  hasData,
  pendingChoiceMapping,
  allReady,
  controls,
}: {
  modeLabel: string;
  headline: string;
  detail: string;
  hasXlsform: boolean;
  hasData: boolean;
  pendingChoiceMapping: boolean;
  allReady: boolean;
  controls: ReactNode;
}) {
  const reviewText = pendingChoiceMapping ? "Revisar códigos" : allReady ? "Validable" : "Pendiente";
  return (
    <section className="pulso-carga-suitebar" aria-label="Centro de control de carga">
      <div className="pulso-carga-suitebar-main">
        <span className="pulso-carga-suitebar-icon" aria-hidden="true">
          {allReady ? <ShieldCheck size={18} /> : <Database size={18} />}
        </span>
        <div className="pulso-carga-suitebar-copy">
          <span className="pulso-carga-suitebar-kicker">{modeLabel}</span>
          <strong>{headline}</strong>
          <p>{detail}</p>
        </div>
      </div>
      <div className="pulso-carga-suitebar-meter" aria-label="Estado de insumos">
        <CargaCommandPill label="Formulario" done={hasXlsform} />
        <CargaCommandPill label="Respuestas" done={hasData} />
        <span className={`pulso-carga-command-review${allReady ? " is-ready" : pendingChoiceMapping ? " needs-review" : ""}`}>
          <ShieldCheck size={13} />
          {reviewText}
        </span>
      </div>
      <div className="pulso-carga-suitebar-controls">
        {controls}
      </div>
    </section>
  );
}

function CargaStageRail({
  hasXlsform,
  hasData,
  pendingChoiceMapping,
  allReady,
  isMultiBase,
  bases,
  instrumento,
  dataPreview,
  estructura,
}: {
  hasXlsform: boolean;
  hasData: boolean;
  pendingChoiceMapping: boolean;
  allReady: boolean;
  isMultiBase: boolean;
  bases: number;
  instrumento: InstrumentoResumen | null;
  dataPreview: DataPreview | null;
  estructura: { secciones: Seccion[]; preguntas: Pregunta[] } | null;
}) {
  const xlsformMeta = instrumento
    ? `${instrumento.n_preguntas} preguntas · ${instrumento.n_secciones} secciones`
    : hasXlsform
    ? "Formulario cargado"
    : "Pendiente";
  const dataMeta = dataPreview
    ? `${dataPreview.n_filas} filas · ${dataPreview.n_columnas} columnas`
    : hasData
    ? "Respuestas cargadas"
    : hasXlsform
    ? "Lista para cargar"
    : "Espera el formulario";
  const reviewTone = pendingChoiceMapping ? "warning" : allReady ? "ready" : "pending";
  const reviewMeta = pendingChoiceMapping
    ? "Requiere confirmar mapeo"
    : allReady
    ? "Compatible para Validación"
    : estructura
    ? `${estructura.secciones.length} secciones detectadas`
    : "Se activa con ambos insumos";

  return (
    <aside className="pulso-carga-stage-rail pulso-sidebar" aria-label="Estado de la carga">
      <div className="pulso-carga-stage-head">
        <span className="pulso-carga-stage-kicker">Ruta de carga</span>
        <strong>{allReady ? "Insumos listos" : "Preparando estudio"}</strong>
      </div>
      <div className="pulso-carga-stage-list">
        <CargaStageItem
          icon={FileSpreadsheet}
          title="Formulario"
          meta={xlsformMeta}
          tone={hasXlsform ? "ready" : "pending"}
          index="1"
        />
        <CargaStageItem
          icon={Database}
          title="Respuestas"
          meta={dataMeta}
          tone={hasData ? "ready" : "pending"}
          index="2"
        />
        <CargaStageItem
          icon={ShieldCheck}
          title="Revisión"
          meta={reviewMeta}
          tone={reviewTone}
          index="3"
        />
      </div>
      <div className={`pulso-carga-stage-mode${isMultiBase ? " is-on" : ""}`}>
        <span>{isMultiBase ? "Varias bases" : "Una base"}</span>
        <strong>{isMultiBase ? `${bases} base${bases === 1 ? "" : "s"}` : "Flujo simple"}</strong>
      </div>
    </aside>
  );
}

function CargaStageItem({
  icon: Icon,
  title,
  meta,
  tone,
  index,
}: {
  icon: IconCmp;
  title: string;
  meta: string;
  tone: "ready" | "pending" | "warning";
  index: string;
}) {
  return (
    <div className={`pulso-carga-stage-item is-${tone}`}>
      <span className="pulso-carga-stage-index">{index}</span>
      <span aria-hidden="true" className="pulso-carga-stage-icon">
        <Icon size={15} />
      </span>
      <span className="pulso-carga-stage-copy">
        <strong>{title}</strong>
        <span>{meta}</span>
      </span>
    </div>
  );
}

function UploadCard({
  kind, icon: Icon, title, hint, whatIs, accept, acceptLabel, done, busy, disabled, disabledHint, resumen, onPick, onRemove,
}: {
  kind: "xlsform" | "data";
  icon: IconCmp;
  title: string;
  hint: React.ReactNode;
  /** Explicación adicional de qué ES este insumo (no qué hacer). */
  whatIs: React.ReactNode;
  accept: string;
  /** Etiqueta humana de formatos aceptados (ej. "Solo Excel (.xlsx)"). */
  acceptLabel: string;
  done: boolean;
  /** Si hay otra operación en curso globalmente, deshabilita Remove. */
  busy: boolean;
  disabled?: boolean;
  disabledHint?: string;
  resumen: React.ReactNode | null;
  onPick: (file?: File) => void;
  onRemove: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div className={`pulso-upload-card${done ? " is-done" : ""}${disabled && !done ? " is-disabled" : ""}`}>
      {/* Header del insumo */}
      <div className="pulso-upload-card-head">
        <span aria-hidden="true" className="pulso-upload-card-icon">
          {done ? <CheckCircle2 size={22} /> : <Icon size={22} />}
        </span>
        <div className="pulso-upload-card-copy">
          <h3 className="pulso-upload-card-title">
            {title}
          </h3>
          <span className="pulso-upload-card-hint">
            {hint}
          </span>
        </div>
        {/* Botón Quitar — solo visible cuando el insumo ya está cargado. */}
        {done && (
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            title={`Quitar ${kind === "xlsform" ? "formulario" : "respuestas"}`}
            aria-label={`Quitar ${kind === "xlsform" ? "formulario" : "respuestas"}`}
            className="pulso-upload-remove"
          >
            <Trash2 size={11} /> Quitar
          </button>
        )}
      </div>

      {/* Qué es este archivo — explicación clara del concepto */}
      <div className="pulso-upload-note">
        {whatIs}
      </div>

      {/* Dropzone */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled) return;
          onPick(e.dataTransfer.files?.[0]);
        }}
        className={`pulso-upload-dropzone${dragOver ? " is-drag-over" : ""}${disabled ? " is-disabled" : ""}`}
        aria-disabled={disabled}
      >
        <Upload size={22} className="pulso-upload-dropzone-icon" />
        <span className="pulso-upload-dropzone-title">
          {disabled && !done
            ? "Carga el formulario primero"
            : done
            ? `Reemplazar ${kind === "xlsform" ? "formulario" : "respuestas"}`
            : "Arrastra o haz click para subir"}
        </span>
        <span className="pulso-upload-dropzone-formats">
          {disabled && disabledHint ? disabledHint : acceptLabel}
        </span>
        <input
          type="file"
          accept={accept}
          disabled={disabled}
          onChange={(e) => onPick(e.target.files?.[0])}
          style={{ display: "none" }}
        />
      </label>

      {resumen && (
        <div className="pulso-upload-summary">
          {resumen}
        </div>
      )}
    </div>
  );
}

function ResumenStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="pulso-resumen-stat">
      <span>{label}</span>
      <strong>
        {value}
      </strong>
    </div>
  );
}

function ChoiceMappingReviewDialog({
  review,
  busy,
  onClose,
  onConfirm,
}: {
  review: ChoiceCodeMapReview;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const needsConfirmation = review.requires_confirmation;
  const changedCounts = review.maps.map((map) => choiceMapChangedItems(map).length);
  const totalChangedOptions = changedCounts.reduce((sum, count) => sum + count, 0);
  const allHighConfidence = review.maps.every((map) => map.high_confidence);
  return (
    <div className="pulso-choice-map-backdrop" role="presentation">
      <div
        className="pulso-choice-map-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="choice-map-title"
      >
        <div className="pulso-choice-map-head">
          <span aria-hidden="true" className="pulso-choice-map-head-icon">
            {needsConfirmation ? <ArrowRightLeft size={18} /> : <ShieldCheck size={18} />}
          </span>
          <div>
            <p className="pulso-choice-map-kicker">
              Preparación de respuestas
            </p>
            <h2 id="choice-map-title">
              Usar mapeo recomendado
            </h2>
          </div>
        </div>

        <div className="pulso-choice-map-explain">
          <Info size={16} />
          <p>
            Pulso detectó diferencias entre los códigos de origen y los valores finales del formulario. Las
            etiquetas coinciden, pero algunos códigos no. Al confirmar, las respuestas se ajustan hacia el
            formulario y las reglas usan ese mismo puente para interpretar C1, C2, C3.
          </p>
        </div>

        <div className="pulso-choice-map-summary">
          <div>
            <span>Preguntas afectadas</span>
            <strong>{review.maps.length}</strong>
          </div>
          <div>
            <span>Opciones ajustadas</span>
            <strong>{totalChangedOptions}</strong>
          </div>
          <div>
            <span>Confianza</span>
            <strong>{allHighConfidence ? "Alta" : "Requiere revisión"}</strong>
          </div>
        </div>

        <p className="pulso-choice-map-guidance">
          Revisa solo si algo te llama la atención. Si las etiquetas son las correctas, la acción esperada es usar el mapeo recomendado.
        </p>

        <div className="pulso-choice-map-list">
          {review.maps.map((map, index) => (
            <ChoiceMappingCard
              key={`${map.variable}-${map.list_name}`}
              map={map}
              defaultOpen={!map.high_confidence || index === 0}
            />
          ))}
        </div>

        <div className="pulso-choice-map-actions">
          <button
            type="button"
            className="pulso-choice-map-secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cerrar y revisar luego
          </button>
          {needsConfirmation && (
            <button
              type="button"
              className="pulso-choice-map-primary"
              onClick={onConfirm}
              disabled={busy}
            >
              <ShieldCheck size={15} />
              Usar este mapeo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChoiceMappingCard({ map, defaultOpen }: { map: ChoiceCodeMap; defaultOpen?: boolean }) {
  const changedRows = choiceMapChangedItems(map);
  const visibleRows = changedRows.length > 0 ? changedRows : map.mappings.slice(0, 4);
  const unchangedRows = Math.max(0, map.mappings.length - changedRows.length);
  return (
    <details className="pulso-choice-map-card" open={defaultOpen}>
      <summary className="pulso-choice-map-card-head">
        <div>
          <h3>
            <code>{map.variable}</code> {map.label}
          </h3>
          <p>
            {changedRows.length} ajuste(s) de código · {map.type === "select_multiple" ? "selección múltiple" : "selección única"} · lista <code>{map.list_name}</code>
          </p>
        </div>
        <span className={`pulso-choice-map-confidence${map.high_confidence ? " is-high" : " is-review"}`}>
          {map.high_confidence ? "Alta confianza" : "Revisar"}
        </span>
      </summary>

      <div className="pulso-choice-map-table" role="table" aria-label={`Mapeo de ${map.variable}`}>
        <div className="pulso-choice-map-row is-head" role="row">
          <span role="columnheader">Código origen SM/SAV</span>
          <span role="columnheader">Etiqueta detectada</span>
          <span role="columnheader">Valor final del formulario</span>
        </div>
        {visibleRows.map((item, idx) => (
          <div className="pulso-choice-map-row" role="row" key={`${item.source_code}-${item.xls_code}-${idx}`}>
            <span role="cell">
              <code>C{item.source_code}</code>
            </span>
            <span role="cell">
              {item.source_label || item.xls_label}
            </span>
            <span role="cell">
              <code>{item.xls_code}</code>
              {item.xls_label && <em>{item.xls_label}</em>}
            </span>
          </div>
        ))}
      </div>

      {unchangedRows > 0 && (
        <p className="pulso-choice-map-more">
          {unchangedRows} opción(es) ya coincidían o no necesitaban cambio.
        </p>
      )}
    </details>
  );
}

// =====================================================================
// CTA al final — "Continuar a Validación"
// =====================================================================
function ContinuarCTA() {
  return (
    <div className="pulso-continue-cta">
      <span aria-hidden="true" className="pulso-continue-cta-icon">
        <CheckCircle2 size={17} />
      </span>
      <div className="pulso-continue-cta-copy">
        <div className="pulso-continue-cta-title">
          Insumos cargados
        </div>
        <div className="pulso-continue-cta-note">
          Ya puedes auditar las respuestas en Validación o pasar directo a Codificación si no necesitas revisar reglas.
        </div>
      </div>
      <a
        href="/validacion"
        className="pulso-continue-cta-link"
      >
        Ir a Validación <ArrowRight size={13} />
      </a>
    </div>
  );
}

// =====================================================================
// MultiBaseToggle — switch explícito entre "una base" y "varias bases"
// =====================================================================
// Copy intencionalmente humano: evitamos "multi-base", "single-base",
// "XLSForm" etc. en el label. El switch dice simplemente "El estudio
// tiene más de una base".
//
// Estados:
//   - off + (algo cargado): click encendido → convierte a varias bases.
//   - on + bases<=1: click apagado → degrada a una sola base.
//   - on + bases>1: no puede apagarse sin pérdida — queda bloqueado
//     con tooltip "quita las bases extra primero". El botón "Cerrar
//     estudio" del panel cubre el caso destructivo.
function MultiBaseToggle({
  on, canTurnOff, bases, disabled, onTurnOn, onTurnOff,
}: {
  on: boolean;
  canTurnOff: boolean;
  bases: number;
  disabled: boolean;
  onTurnOn: () => Promise<void>;
  onTurnOff: () => Promise<void>;
}) {
  const locked = on && !canTurnOff;
  const effectiveDisabled = disabled || locked;

  const handleClick = async () => {
    if (effectiveDisabled) return;
    if (on) await onTurnOff();
    else await onTurnOn();
  };

  const hint = on
    ? bases > 1
      ? `Tienes ${bases} bases. Para volver a una sola, quita las extras en el panel de abajo.`
      : "Activo: puedes subir varias bases o importar encuestas por API."
    : "Úsalo cuando el estudio combine varias bases, encuestas o submuestras.";

  return (
    <div
      role="group"
      aria-labelledby="multibase-toggle-label"
      className={`pulso-multibase-toggle${on ? " is-on" : ""}${locked ? " is-locked" : ""}`}
    >
      <div className="pulso-multibase-toggle-copy">
        <div
          id="multibase-toggle-label"
          className="pulso-multibase-toggle-title"
        >
          Varias bases
        </div>
        <div className="pulso-multibase-toggle-hint">
          {hint}
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Varias bases"
        onClick={handleClick}
        disabled={effectiveDisabled}
        title={locked ? "Quita las bases extra primero para apagarlo" : undefined}
        className="pulso-switch"
      >
        <span aria-hidden="true" className="pulso-switch-thumb" />
      </button>
    </div>
  );
}
