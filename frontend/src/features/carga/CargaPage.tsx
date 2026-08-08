import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle, ArrowRight, ArrowRightLeft, CheckCircle2, ClipboardCheck, CloudDownload,
  Database, FileSpreadsheet, FileWarning, Download, Info, Loader2, RefreshCw, Search, ShieldCheck,
  Table2, Trash2, Upload, UploadCloud,
} from "lucide-react";
import {
  apiCargaBaseSheet,
  apiCargaKoboAssets,
  apiCargaMonitoreoHandoffPromote,
  apiCargaReview,
  apiCargaReviewSummary,
  apiCargaReviewReconciliation,
  apiCargaImportKoboAsync,
  apiCargaImportSurveyMonkeyAsync,
  apiCargaData,
  apiCargaExportNormalized,
  apiCargaConfirmChoiceMapping,
  apiCargaInstrumento,
  apiConnectionsList,
  apiEstudioGet,
  apiEstudioInit,
  apiEstudioSetTopology,
  apiInstrumentoEstructura,
  apiQuitarData,
  apiQuitarInstrumento,
  apiSurveyMonkeyMultibaseListSurveys,
  apiUpload,
  CargaMonitoreoHandoffStatus,
  CargaPlatformImportResult,
  CargaPlatformProvider,
  ChoiceCodeMap,
  ChoiceCodeMapReview,
  ConnectionTokenState,
  CargaReviewPayload,
  CargaReviewSummaryPayload,
  EstudioBase,
  EstudioPayload,
  EstudioProcessingSuggestions,
  KoboSourceSpec,
  MonitoreoKoboAssetItem,
  NormalizedExportFormat,
  Pregunta,
  ReconciliacionInfo,
  Seccion,
  SurveyMonkeyMultibaseListItem,
  downloadUrl,
  uploadKindForDataFile,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { useSeccion } from "../../lib/navegacion/useDireccion";
import "./carga-v2.css";
import "./carga-sources.css";
import { PageFrame } from "../../components/PageFrame";
import { AdaptiveSplitView } from "../../components/AdaptiveSplitView";
import { LoadingBlock, ErrorBlock, EmptyState } from "../../components/States";
import { GlidingTabList } from "../../components/GlidingTabList";
import { BasesPanel } from "./BasesPanel";
import { InstrumentRevisionBindingNotice } from "./InstrumentRevisionBindingNotice";
import { EsquemaBaseSelector } from "./EsquemaBaseSelector";
import { ReconciliacionExtraDialog } from "./ReconciliacionExtraDialog";
import { summaryLabel as reconSummaryLabel } from "./reconciliacionModel";
import { ProcessingSheetViewer } from "../procesamiento/ProcessingSheetViewer";
import { repeatContextFromBase } from "../../lib/rosterExplorer";
import { defaultEsquemaBase } from "./esquemaBaseModel";
import { CargaUniverseFilter } from "./CargaUniverseFilter";
import { ProcessingIntakePanel } from "./ProcessingIntakePanel";
import { AcreditacionBatchPanel } from "./AcreditacionBatchPanel";
import { CargaPlanOverview } from "./CargaPlanOverview";
import { CargaTopologyDecision } from "./CargaTopologyDecision";
import { CargaTopologyPlanBanner } from "./CargaTopologyPlanBanner";
import { declaresMultiBase, isLegacySingleBaseStudy, resolveCargaTopology } from "./CargaTopologyModel";
import { CargaReviewSummary } from "./CargaReviewSummary";
import { CargaStructureWorkbench } from "./CargaStructureWorkbench";
import { useCargaStore, type CargaTopologyIntent, type MultiBaseStrategy } from "./store";
import {
  CARGA_WORKSPACE_TABS,
  resolveCargaWorkspaceTab,
  type CargaWorkspaceContext,
  type CargaWorkspaceTab,
} from "./CargaWorkspaceModel";
import {
  CARGA_WORKSPACE_PANEL_ID,
  CargaWorkspaceNavigation,
  cargaWorkspaceTabId,
} from "./CargaWorkspaceNavigation";
import { CargaWorkspaceHeader } from "./CargaWorkspaceHeader";
import { EquivalenciasPanel } from "./EquivalenciasPanel";
import { CargaSourcesPlan } from "./CargaSourcesPlan";
import {
  CargaMonitoringDiscovery,
  type CargaMonitoringDiscoveryResult,
} from "./CargaMonitoringDiscovery";
import { sourceInputCount, type ProcessingSourcesProfile } from "./CargaSourcesModel";
import { CargaPlatformImportPanel } from "./CargaPlatformImportPanel";
import { esperarResultadoImport, textoDeProgresoImport } from "./importEnSegundoPlano";

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
export type SourceMode = "files" | "platform" | "monitoring";
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

export function cargaSourceModes(
  _suggestions: EstudioProcessingSuggestions | null,
): SourceMode[] {
  return ["files", "platform", "monitoring"];
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

function reviewReconciliationInfo(review: CargaReviewPayload): ReconciliacionInfo {
  return {
    ok: true,
    extra: review.reconciliation.extra.map((extra) => ({
      name: extra.name,
      fill_pct: extra.fill_pct,
      n_fill: extra.n_fill,
      kind: extra.kind,
      incluida: extra.incluida,
    })),
    n_extra: review.reconciliation.n_extra,
    n_incluidas: review.reconciliation.n_incluidas,
  };
}

export default function CargaPage() {
  const { sessionId, state, refresh } = useSession();
  const cargaDireccion = useSeccion("procesamiento");
  const topologyIntent = useCargaStore((store) => store.topologyIntent);
  const setTopologyIntent = useCargaStore((store) => store.setTopologyIntent);
  const multiBaseStrategy = useCargaStore((store) => store.strategy);
  const setMultiBaseStrategy = useCargaStore((store) => store.setStrategy);
  const plannedInputCount = useCargaStore((store) => store.plannedInputCount);
  const setPlannedInputCount = useCargaStore((store) => store.setPlannedInputCount);
  const [instrumento, setInstrumento] = useState<InstrumentoResumen | null>(null);
  const [dataPreview, setDataPreview] = useState<DataPreview | null>(null);
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
  const [reconDialogOpen, setReconDialogOpen] = useState(false);
  const planningSeedRef = useRef("");
  const reconInfo = cargaReview ? reviewReconciliationInfo(cargaReview) : null;

  const sourceModes = cargaSourceModes(processingSuggestions);

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
      // Tras subir data manualmente, revisa si trae variables ajenas al
      // formulario y abre la reconciliación si las hay.
      if (kind === "data") await loadReconciliacion(true);
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
    apiConnectionsList()
      .then((result) => {
        if (!alive) return;
        setConnections(result.connections);
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
        // Import como job en segundo plano (async: true): la app queda usable
        // durante el pull y el resultado es el mismo payload síncrono.
        const start = await apiCargaImportSurveyMonkeyAsync({
          survey_id: survey.id,
          title: survey.title,
          connection_profile_id: activeSmProfile?.id || "",
          source_alias: survey.nickname || survey.title,
          response_statuses: includePartials ? ["completed", "partial"] : ["completed"],
          keep_missing_status: false,
        });
        const result = await esperarResultadoImport<CargaPlatformImportResult>(start.job_id, {
          onProgress: (p) => setBusy(textoDeProgresoImport(`Importando ${survey.title}`, p)),
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
        const start = await apiCargaImportKoboAsync({
          asset_uid: asset.uid,
          title: asset.name,
          base_url: baseUrl,
          connection_profile_id: activeKoboProfile?.id || "",
        });
        const result = await esperarResultadoImport<CargaPlatformImportResult>(start.job_id, {
          onProgress: (p) => setBusy(textoDeProgresoImport(`Importando ${asset.name}`, p)),
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
      const start = await apiCargaImportKoboAsync({
        asset_uid: source.asset_uid,
        title: source.name || source.source_title,
        base_url: source.base_url || activeKoboProfile?.base_url || "https://kobo.unhcr.org",
        connection_profile_id: source.connection_profile_id || activeKoboProfile?.id || "",
      });
      const result = await esperarResultadoImport<CargaPlatformImportResult>(start.job_id, {
        onProgress: (p) => setBusy(textoDeProgresoImport(`Importando ${source.name || source.asset_uid}`, p)),
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

  async function onBringFieldWorkToProcessing() {
    if (
      !handoffStatus
      || (monitoringProfile !== "telefonico" && monitoringProfile !== "territorial")
    ) return;
    const selectedSource = handoffStatus.sources?.find(
      (source) => source.source_id === selectedMonitoringSourceId,
    );
    if (monitoringProfile === "telefonico" && handoffStatus.sources?.length && !selectedSource) {
      setError("Selecciona una fuente de Monitoreo antes de traerla a Procesamiento.");
      return;
    }
    const sourceLabel = selectedSource?.label || handoffStatus.source.label || "trabajo de campo";
    const processable = selectedSource?.counts.processable ?? handoffStatus.counts.processable;
    const replacement = handoffStatus.existing_base.present
      ? ` Reemplazará la base actual de ${handoffStatus.existing_base.n_filas.toLocaleString("es-PE")} filas.`
      : " Creará la base de procesamiento con esta fuente.";
    if (!window.confirm(
      `¿Traer «${sourceLabel}» a Procesamiento?\n\n` +
      `${processable.toLocaleString("es-PE")} respuestas procesables.${replacement}`,
    )) return;
    setError("");
    setHandoffMessage("");
    setBusy("Trayendo tu trabajo de campo al procesamiento…");
    try {
      const result = await apiCargaMonitoreoHandoffPromote(
        selectedMonitoringSourceId ? { source_id: selectedMonitoringSourceId } : {},
      );
      await refresh();
      // El handoff trae data de Monitoreo que puede incluir variables de
      // versiones viejas del formulario: ofrece reconciliarlas.
      await loadReconciliacion(true);
      const fr = result.filter_report ?? {};
      const nf = (n?: number) => (n ?? 0).toLocaleString("es-PE");
      const traidas = result.data?.n_filas ?? fr.filas_incluidas ?? 0;
      const desglose = [
        fr.validada != null ? `${nf(fr.validada)} validadas` : null,
        fr.revision ? `${nf(fr.revision)} en revisión` : null,
      ].filter(Boolean).join(" · ");
      const excluidas = fr.no_defendible_excluidos
        ? ` ${nf(fr.no_defendible_excluidos)} excluidas por no defendibles.`
        : "";
      setHandoffMessage(
        `${nf(traidas)} respuestas traídas${desglose ? ` (${desglose})` : ""}.${excluidas} Ya puedes validar y codificar.`,
      );
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  // Estado de prereqs — muestra al lado del título como meta chip.
  // Un archivo puede pertenecer a otra superficie del proyecto. Carga solo
  // considera disponible un insumo después de que su propio motor lo parsea
  // o previsualiza; así no declara una base lista usando archivos heredados de
  // Monitoreo, Muestra u otro módulo.
  const hasXlsform = !!state?.xlsform && !!state.instrumento_parsed;
  const hasData = !!state?.data && !!state.data_previewed;
  const pendingChoiceMapping = !!dataPreview?.normalizacion?.choice_code_maps?.requires_confirmation;
  const allReady = hasXlsform && hasData && !pendingChoiceMapping;
  // El puente de trabajo de campo es el camino primario cuando aún no hay una
  // base de procesamiento cargada. Deja al banner Kobo remoto como secundario.
  // Nos apoyamos en `already_promoted` (autoritativo: hay base real/activa) y no
  // en `hasData`, porque un archivo `data` heredado de otro módulo (p.ej. la
  // lista de encuestadores de Monitoreo) lo vuelve true en falso y ocultaría la
  // tarjeta justo en el proyecto que la necesita.
  const showFieldWorkHandoff =
    !!handoffStatus &&
    handoffStatus.detected &&
    !handoffStatus.already_promoted;
  const studyLoadingBases = state?.n_bases ?? 0;
  const studyLoadingBasesLabel = `${studyLoadingBases} base${studyLoadingBases === 1 ? "" : "s"}`;

  // ¿Está el usuario en modo multi-base? Dos formas de activarse:
  // 1) Demo/preset cargó ≥1 base real (Acreditación) → has_estudio
  //    true + n_bases ≥ 1 con nombres reales.
  // 2) Usuario activó el toggle "más de una base" manualmente → has_
  //    estudio true + n_bases puede ser 0 (estudio recién inicializado
  //    esperando que suba su primera base).
  // El caso "single-base legacy virtual" (n_bases=1 + nombre=default)
  // se sigue tratando como single-base — aún no hubo intención de
  // multi-base, es solo un mirror del legacy.
  //
  // Salvo que el usuario YA haya declarado lo contrario en Plan: la declaración
  // persistida (`estudio_topology_declared`) es la intención real y le gana al
  // desempate por nombre. Ambas reglas viven en CargaTopologyModel.
  const declaredTopology = state?.estudio_topology_declared ?? null;
  const declaredMultiBase = declaresMultiBase(declaredTopology);
  const hasDefaultStudyBase = isLegacySingleBaseStudy({
    hasStudy: Boolean(state?.has_estudio),
    baseCount: state?.n_bases ?? 0,
    baseNames: state?.bases_nombres ?? [],
    declaredTopology,
  });
  const isIndependentStudy = state?.estudio_processing_mode === "independent_siblings";
  const isMultiBase = !!state
    && state.has_estudio
    && (
      forceMultiBase ||
      isIndependentStudy ||
      declaredMultiBase ||
      !(hasDefaultStudyBase)
    );
  // Payload del estudio — cargamos on-demand cuando entramos a modo
  // multi-base para mostrar el BasesPanel con detalle de cada base.
  const [estudio, setEstudio] = useState<EstudioPayload | null>(null);
  const cargaBaseOptions = estudio ? Object.values(estudio.bases) : [];
  const topologyBases = cargaBaseOptions.filter(
    (base) => base.source_kind !== "kobo_repeat" && !base.parent_base,
  );
  const integratedBaseCount = topologyBases.filter(
    (base) => Boolean(base.multi_integrated),
  ).length;
  const multiBaseInstrumentCount = topologyBases.filter(
    (base) => Boolean(base.xlsform_file_id),
  ).length;
  const multiBaseDataCount = topologyBases.filter(
    (base) => Boolean(base.data_file_id),
  ).length;
  const cargaBaseSignature = estudio
    ? Object.keys(estudio.bases).sort((a, b) => a.localeCompare(b, "es")).join("|")
    : "";
  // En multibase no hay `instrumento_parsed` único; basta con que la estructura
  // de la base elegida esté cargada para mostrar la inspección de esquema. En
  // single-base se conserva el gate histórico.
  const showInspection = isMultiBase
    ? !!estructura
    : !!state?.instrumento_parsed && !!estructura;
  const workspaceHasInstrument = isMultiBase
    ? multiBaseInstrumentCount > 0
    : hasXlsform || showInspection;
  const workspaceHasData = isMultiBase ? multiBaseDataCount > 0 : hasData;
  const workspaceAllReady = isMultiBase
    ? topologyBases.length > 0
      && multiBaseInstrumentCount === topologyBases.length
      && multiBaseDataCount === topologyBases.length
      && !pendingChoiceMapping
    : allReady;
  const topologyHasStudy = Boolean(state?.has_estudio && !hasDefaultStudyBase);
  // Lo que el usuario declaró en Plan manda sobre lo que Monitoreo sugirió: la
  // sugerencia del intake es un default, la declaración es una decisión.
  const declaredTopologyStrategy: MultiBaseStrategy | null =
    declaredTopology === "separate" || declaredTopology === "integrated" || declaredTopology === "independent"
      ? declaredTopology
      : state?.processing_intake_mode === "independent_siblings"
        ? "independent"
        : null;
  const topologyResolution = resolveCargaTopology({
    hasStudy: topologyHasStudy,
    baseCount: topologyHasStudy
      ? estudio
        ? topologyBases.length
        : state?.n_bases ?? 0
      : 0,
    hasInstrument: hasXlsform,
    hasData,
    processingMode: topologyHasStudy ? state?.estudio_processing_mode : null,
    integratedBaseCount,
    declaredStrategy: declaredTopologyStrategy,
    intent: topologyIntent,
  });
  // Un "single" declarado también es una decisión que la vista debe reflejar al
  // reabrir; `declaredTopologyStrategy` sólo cubre las variantes multi.
  const resolvedTopologyIntent: CargaTopologyIntent = topologyIntent
    ?? declaredTopologyStrategy
    ?? (declaredTopology === "single" ? "single" : null);
  const topologyIntentStrategy: MultiBaseStrategy | null =
    resolvedTopologyIntent === "separate" || resolvedTopologyIntent === "integrated" || resolvedTopologyIntent === "independent"
      ? resolvedTopologyIntent
      : null;
  const sourceStrategy = topologyResolution.strategy
    ?? topologyIntentStrategy
    ?? preferredMultiStrategy
    ?? multiBaseStrategy;
  const integratedOriginCount = topologyBases.reduce(
    (total, base) => total + (base.multi_integrated?.origins?.length ?? 0),
    0,
  );
  const materializedInputCount = isMultiBase
    ? sourceStrategy === "integrated"
      ? integratedOriginCount
      : sourceInputCount(cargaBaseOptions)
    : topologyResolution.mode === "multi"
      ? 0
      : Number(hasXlsform || hasData);
  // Conteo de la equivalencia declarada, para que la pestaña diga si hay trabajo
  // hecho sin obligar a abrirla.
  const [equivalenciasFilas, setEquivalenciasFilas] = useState(0);
  const reviewHasIssues = Boolean(cargaReview && (
    !cargaReview.compatibility.ok
    || cargaReview.choice_mapping.pending
    || cargaReview.reconciliation.n_pendientes > 0
  ));
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
    // bases NO comparten instrumento. Espejo del predicado que el backend usa
    // para scopear la config de Analítica (ADR 0061).
    basesSeparadas:
      (declaredTopology === "separate" || declaredTopology === "independent")
      && topologyBases.length > 1,
    equivalenciasDeclaradas: equivalenciasFilas,
  };
  const activeCargaTab = resolveCargaWorkspaceTab(cargaDireccion.pestana, workspaceContext);
  const cargaPlanActive = activeCargaTab === CARGA_WORKSPACE_TABS[0].key;

  // Revisión solo opera sobre bases primarias. Datos conserva su selector
  // completo (incluidos repeats); la normalización ocurre únicamente al entrar
  // en esta pestaña.
  useEffect(() => {
    if (activeCargaTab !== "revision" || !isMultiBase || topologyBases.length === 0) return;
    const primaryNames = new Set(topologyBases.map((base) => base.nombre));
    setSelectedCargaBase((current) => {
      if (primaryNames.has(current)) return current;
      if (estudio?.active_base && primaryNames.has(estudio.active_base)) return estudio.active_base;
      return topologyBases[0]?.nombre ?? "";
    });
  }, [activeCargaTab, cargaBaseSignature, estudio?.active_base, isMultiBase]);

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
    apiCargaReview(selectedCargaBase)
      .then((review) => {
        if (!cancelled) setCargaReview(review);
      })
      .catch(() => {
        if (!cancelled) setCargaReview(null);
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
    apiCargaReviewSummary()
      .then((summary) => {
        if (!cancelled) setCargaReviewSummary(summary);
      })
      .catch(() => {
        if (!cancelled) setCargaReviewSummary(null);
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

  const sourcePlan = (
    <CargaSourcesPlan
      strategy={sourceStrategy}
      single={topologyResolution.mode !== "multi"}
      plannedInputCount={plannedInputCount}
      materializedInputCount={materializedInputCount}
      disabled={!!busy}
      onPlannedInputCountChange={setPlannedInputCount}
    />
  );

  const sourceOriginTabs = (
    <GlidingTabList
      activeKey={sourceMode}
      mode="tabs"
      onRovingKeyChange={(key) => setSourceMode(key as SourceMode)}
      className="pulso-carga-source-switch pulso-compact-tabs pulso-carga-origin-tabs"
      role="radiogroup"
      aria-label="Origen de carga"
    >
      {sourceModes.map((mode) => (
        <button
          key={mode}
          type="button"
          className={`pulso-compact-tab pulso-carga-origin-tab${sourceMode === mode ? " is-active" : ""}`}
          onClick={() => setSourceMode(mode)}
          role="radio"
          aria-checked={sourceMode === mode}
          data-gliding-key={mode}
          title={mode === "files"
            ? "Manual - formulario y respuestas desde archivos locales"
            : mode === "platform"
              ? "Plataforma - SurveyMonkey o KoboToolbox"
              : "Monitoreo - revisar el snapshot local antes de materializar"}
        >
          {mode === "files"
            ? <Upload size={14} />
            : mode === "platform"
              ? <CloudDownload size={14} />
              : <ClipboardCheck size={14} />}
          <span className="pulso-carga-tab-label">
            {mode === "files" ? "Manual" : mode === "platform" ? "Plataforma" : "Monitoreo"}
          </span>
        </button>
      ))}
    </GlidingTabList>
  );

  const monitoringSourcePanel = (
    <>
      <CargaMonitoringDiscovery
        key={sessionId ?? "no-session"}
        reviewLabel={monitoringReviewActionLabel}
        onDiscovered={onMonitoringDiscovered}
      />
      {monitoringReviewed && monitoringProfile === "multi_actor" ? (
        <>
          <ProcessingIntakePanel
            sessionId={sessionId}
            suggestions={processingSuggestions?.groups}
            onPlanSaved={() => setIntakeRefreshToken((current) => current + 1)}
          />
          <AcreditacionBatchPanel
            sessionId={sessionId}
            refreshToken={intakeRefreshToken}
            onPromoted={async (payload) => {
              await onEstudioChanged(payload);
              goCargaWorkspaceTab("revision");
            }}
          />
        </>
      ) : null}
      {monitoringReviewed && (monitoringProfile === "telefonico" || monitoringProfile === "territorial") && showFieldWorkHandoff && handoffStatus ? (
        <FieldWorkHandoffCallout
          status={handoffStatus}
          selectedSourceId={selectedMonitoringSourceId}
          busy={!!busy}
          onBring={() => void onBringFieldWorkToProcessing()}
          onUploadInstrument={(file) => void onPick("xlsform", file)}
        />
      ) : null}
    </>
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
      auditReady={isMultiBase && !estudio ? false : `carga-${activeCargaTab}`}
    >
      {(busy || error || handoffMessage) && (
        <div ref={feedbackRef} className="pulso-feedback-stack pulso-feedback-stack--upload">
          {busy && <LoadingBlock variant="inline" label={busy} />}
          {error && <ErrorBlock label="No se pudo completar la carga" detail={error} />}
          {!busy && !error && handoffMessage && (
            <div className="pulso-carga-handoff-done" role="status">
              <CheckCircle2 size={15} aria-hidden="true" />
              <span>{handoffMessage}</span>
            </div>
          )}
        </div>
      )}

      {activeCargaTab === "revision" && reconInfo && reconInfo.n_extra > 0 && (
        <div className="pulso-recon-panel" data-audit-ready="true">
          <span className="pulso-recon-panel-icon" aria-hidden="true">
            <FileWarning size={16} />
          </span>
          <div className="pulso-recon-panel-copy">
            <span className="pulso-recon-panel-title">
              Variables extra{cargaReview?.base_nombre ? ` · ${cargaReview.base_nombre}` : " en la data"}
            </span>
            <span className="pulso-recon-panel-summary">{reconSummaryLabel(reconInfo)}</span>
          </div>
          <button
            type="button"
            className="pulso-recon-panel-button"
            onClick={() => setReconDialogOpen(true)}
          >
            <ArrowRightLeft size={14} aria-hidden="true" />
            Revisar variables extra
          </button>
        </div>
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

      {/* Modo multi-base: BasesPanel reemplaza los UploadCards.
          Cada base es un par (XLSForm + data) con nombre único. El
          usuario puede agregar, quitar, renombrar y volver a la carga
          simple si queda 1 sola base. */}
      {isMultiBase && estudio && (
        <AdaptiveSplitView
          ariaLabel="Mesa de trabajo de varias bases"
          railLabel="Pestañas de carga"
          className="pulso-upload-section pulso-carga-workbench pulso-carga-workbench--multibase pulso-context-tab-layout"
          rail={(
            <CargaWorkspaceNavigation
              active={activeCargaTab}
              context={workspaceContext}
              onChange={goCargaWorkspaceTab}
            />
          )}
        >
          <div
            id={CARGA_WORKSPACE_PANEL_ID}
            role="tabpanel"
            aria-labelledby={cargaWorkspaceTabId(activeCargaTab)}
            tabIndex={0}
            className={`pulso-carga-content pulso-content-area pulso-carga-content--multi pulso-carga-content--framed${cargaPlanActive ? " is-plan" : ""}`}
          >
            <CargaWorkspaceHeader active={activeCargaTab} context={workspaceContext} />
            <div className="pulso-carga-scrollarea">
            {activeCargaTab === "plan" ? (
              <CargaPlanOverview
                topology={topologyResolution}
                bases={topologyBases}
                hasInstrument={workspaceHasInstrument}
                hasData={workspaceHasData}
                pendingChoiceMapping={pendingChoiceMapping}
                allReady={workspaceAllReady}
                onOpenSources={() => goCargaWorkspaceTab("fuentes")}
              >
                  <CargaTopologyDecision
                    resolution={topologyResolution}
                    intent={resolvedTopologyIntent}
                  disabled={!!busy}
                  onIntentChange={onTopologyIntentChange}
                />
              </CargaPlanOverview>
            ) : activeCargaTab === "fuentes" ? (
              <div className="pulso-carga-surface pulso-carga-sources" data-carga-surface="sources">
              {sourcePlan}
              {sourceOriginTabs}
              {sourceMode === "monitoring" ? monitoringSourcePanel : null}
              {sourceMode === "platform" && sourceStrategy === "separate" ? (
                <div aria-label={`${plannedInputCount} destinos separados planificados`}>
                  <CargaPlatformImportPanel
                    strategy={sourceStrategy}
                    single={false}
                    plannedInputCount={plannedInputCount}
                    onUseManual={() => setSourceMode("files")}
                  />
                </div>
              ) : null}
              {(sourceMode === "files" || (sourceMode === "platform" && sourceStrategy !== "separate")) ? (
                <BasesPanel
                  estudio={estudio}
                  plannedInputCount={plannedInputCount}
                  onChanged={onEstudioChanged}
                  hasSessionXlsform={hasXlsform}
                  autoOpenAdd={autoOpenAddBase}
                  onAutoOpenConsumed={() => setAutoOpenAddBase(false)}
                  initialStrategy={sourceStrategy}
                  onDowngraded={async () => {
                    setAutoOpenAddBase(false);
                    setEstudio(null);
                    setForceMultiBase(false);
                    setPreferredMultiStrategy(undefined);
                    setTopologyIntent("single");
                    goCargaWorkspaceTab("plan");
                    await refresh();
                  }}
                />
              ) : null}
              </div>
            ) : activeCargaTab === "revision" ? (
              <>
                <div className="pulso-carga-review-toolbar">
                  <label className="pulso-carga-review-base-field">
                    <span>Base revisada</span>
                    <select
                      value={selectedCargaBase}
                      onChange={(event) => setSelectedCargaBase(event.target.value)}
                      disabled={!!busy}
                    >
                      {topologyBases.map((base) => (
                        <option key={base.nombre} value={base.nombre}>{base.nombre}</option>
                      ))}
                    </select>
                  </label>
                {cargaReview?.choice_mapping.pending && cargaReview.choice_mapping.maps.length > 0 && (
                  <button
                    type="button"
                    className="pulso-carga-review-mapping-button"
                    onClick={() => setChoiceMappingReview({
                      applied: cargaReview.choice_mapping.applied,
                      requires_confirmation: cargaReview.choice_mapping.requires_confirmation,
                      n_questions: cargaReview.choice_mapping.n_questions,
                      maps: cargaReview.choice_mapping.maps,
                    })}
                    disabled={!!busy}
                  >
                    <ArrowRightLeft size={14} aria-hidden="true" />
                    Revisar mapeo
                  </button>
                )}
                {selectedCargaBase && (
                  <CargaUniverseFilter
                    baseNombre={selectedCargaBase}
                    disabled={!!busy}
                    onApplied={() => {
                      void apiEstudioGet()
                        .then(async (payload) => {
                          await onEstudioChanged(payload);
                          await loadReconciliacion(false);
                          await loadReviewSummary();
                        })
                        .catch((reason: Error) => setError(reason.message));
                    }}
                  />
                )}
                </div>
                <CargaReviewSummary
                  instrumentBaseCount={multiBaseInstrumentCount}
                  dataBaseCount={multiBaseDataCount}
                  pendingChoiceMapping={pendingChoiceMapping}
                  extraVariableCount={cargaReview?.reconciliation.n_pendientes ?? 0}
                  allReady={workspaceAllReady}
                  isMultiBase={isMultiBase}
                  bases={topologyBases.length}
                  review={cargaReview}
                  reviewSummary={cargaReviewSummary}
                  action={cargaReviewSummary?.all_ready && !busy && !error ? <ContinuarCTA /> : undefined}
                />
              </>
            ) : activeCargaTab === "equivalencias" ? (
              <EquivalenciasPanel onDeclaradas={setEquivalenciasFilas} />
            ) : activeCargaTab === "estructura" ? (
              showInspection && estructura ? (
                <CargaStructureWorkbench
                  estructura={estructura}
                  schemaSelector={(
                    <EsquemaBaseSelector
                      bases={estudio.bases}
                      value={esquemaBase}
                      onChange={setEsquemaBase}
                    />
                  )}
                />
              ) : (
                <EmptyState
                  icon={<FileSpreadsheet size={20} />}
                  title="Aún no hay estructura para revisar"
                  hint="Agrega una base con instrumento desde Fuentes para inspeccionar secciones, preguntas y reglas."
                />
              )
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
          </div>
        </AdaptiveSplitView>
      )}

      {isMultiBase && !estudio && (
        <section
          aria-label="Mesa de trabajo de varias bases"
          className="pulso-upload-section pulso-carga-workbench pulso-carga-workbench--top-only"
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
                <strong>Preparando mesa multibase</strong>
                <p>
                  Ordenando {studyLoadingBasesLabel} para mostrar formularios, respuestas
                  y origen de cada fuente sin cambiar tus archivos.
                </p>
              </div>
              <div className="pulso-carga-study-loading-map" aria-hidden="true">
                <span>
                  <Database size={12} />
                  <strong>{studyLoadingBases}</strong>
                  <small>bases</small>
                </span>
                <span>
                  <FileSpreadsheet size={12} />
                  <strong>{hasXlsform && hasData ? "listos" : "revisando"}</strong>
                  <small>insumos</small>
                </span>
                <span>
                  <ShieldCheck size={12} />
                  <strong>{allReady ? "validable" : "pendiente"}</strong>
                  <small>revisión</small>
                </span>
              </div>
            </section>
          </div>
        </section>
      )}

      {/* Sección 1 — LOS DOS INSUMOS (single-base). Solo se muestra si
          NO estamos en modo multi-base. Si estamos en multi-base,
          BasesPanel ya cubre la carga de insumos. */}
      {!isMultiBase && (
      <>
      <AdaptiveSplitView
        ariaLabel="Mesa de trabajo de carga"
        railLabel="Pestañas de carga"
        className="pulso-upload-section pulso-carga-workbench pulso-context-tab-layout"
        rail={(
          <CargaWorkspaceNavigation
            active={activeCargaTab}
            context={workspaceContext}
            onChange={goCargaWorkspaceTab}
          />
        )}
      >

        <div
          id={CARGA_WORKSPACE_PANEL_ID}
          role="tabpanel"
          aria-labelledby={cargaWorkspaceTabId(activeCargaTab)}
          tabIndex={0}
          className={`pulso-carga-content pulso-content-area${cargaPlanActive ? " is-plan" : ""}`}
        >
          <CargaWorkspaceHeader active={activeCargaTab} context={workspaceContext} />
          {activeCargaTab === "plan" ? (
            <CargaPlanOverview
              topology={topologyResolution}
              bases={[]}
              hasInstrument={hasXlsform}
              hasData={hasData}
              pendingChoiceMapping={pendingChoiceMapping}
              allReady={allReady}
              onOpenSources={() => goCargaWorkspaceTab("fuentes")}
            >
              <CargaTopologyDecision
                resolution={topologyResolution}
                intent={resolvedTopologyIntent}
                disabled={!!busy}
                onIntentChange={onTopologyIntentChange}
              />
            </CargaPlanOverview>
          ) : activeCargaTab === "fuentes" ? (
            <div className="pulso-carga-surface pulso-carga-sources" data-carga-surface="sources">
          {sourcePlan}
          {sourceOriginTabs}
          {(resolvedTopologyIntent === "multi" || topologyIntentStrategy !== null) && !topologyHasStudy && (
            <CargaTopologyPlanBanner
              strategy={topologyIntentStrategy}
              disabled={!!busy}
              onEnableMultiBase={onEnableMultiBase}
            />
          )}
          {sourceMode === "monitoring" ? monitoringSourcePanel : null}

          {sourceMode === "platform" && (
            <CargaPlatformImportPanel
              strategy={sourceStrategy}
              single={topologyResolution.mode !== "multi"}
              plannedInputCount={plannedInputCount}
              onUseManual={() => setSourceMode("files")}
            >
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
              detectedKoboSource={detectedKoboSource}
              onImportDetectedKoboSource={() => void onImportDetectedKoboSource()}
              onImport={() => void onPlatformImport()}
            />
            </CargaPlatformImportPanel>
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
                  <InstrumentRevisionBindingNotice base={estudio?.bases?.default} />
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
            </div>
          ) : activeCargaTab === "revision" ? (
            <>
              {cargaReview?.choice_mapping.pending && cargaReview.choice_mapping.maps.length > 0 && (
                <button
                  type="button"
                  className="pulso-carga-review-mapping-button"
                  onClick={() => setChoiceMappingReview({
                    applied: cargaReview.choice_mapping.applied,
                    requires_confirmation: cargaReview.choice_mapping.requires_confirmation,
                    n_questions: cargaReview.choice_mapping.n_questions,
                    maps: cargaReview.choice_mapping.maps,
                  })}
                  disabled={!!busy}
                >
                  <ArrowRightLeft size={14} aria-hidden="true" />
                  Revisar mapeo
                </button>
              )}
              {hasData && !pendingChoiceMapping && (
                <CargaUniverseFilter
                  disabled={!!busy}
                  onApplied={() => {
                    void refresh()
                      .then(() => loadReconciliacion(false))
                      .catch((reason: Error) => setError(reason.message));
                  }}
                />
              )}
              <CargaReviewSummary
                instrumentBaseCount={Number(hasXlsform)}
                dataBaseCount={Number(hasData)}
                pendingChoiceMapping={pendingChoiceMapping}
                extraVariableCount={cargaReview?.reconciliation.n_pendientes ?? 0}
                allReady={allReady}
                isMultiBase={isMultiBase}
                bases={state?.n_bases ?? 0}
                review={cargaReview}
                action={cargaReview?.ready && allReady && !busy && !error ? <ContinuarCTA /> : undefined}
              />
            </>
            ) : activeCargaTab === "equivalencias" ? (
              <EquivalenciasPanel onDeclaradas={setEquivalenciasFilas} />
            ) : activeCargaTab === "estructura" ? (
            showInspection && estructura ? (
              <CargaStructureWorkbench
                estructura={estructura}
              />
            ) : (
              <EmptyState
                icon={<FileSpreadsheet size={20} />}
                title="Aún no hay estructura para revisar"
                hint="Agrega un formulario desde Fuentes para inspeccionar secciones, preguntas y reglas."
              />
            )
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

// Etiqueta humana de la fase territorial (evita mostrar el valor técnico crudo).
function faseTerritorialLabel(phase: string | null | undefined): string {
  const p = String(phase ?? "").trim().toLowerCase();
  if (!p) return "";
  if (p === "field" || p === "campo") return "Campo";
  if (p === "pilot" || p === "piloto" || p === "pilon" || p === "pilón") return "Piloto";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function handoffCount(n: number | null | undefined): number {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

// Tarjeta primaria del puente Monitoreo → Procesamiento: el trabajo de campo
// ya validado se ofrece con su formulario, sin jerga de "promote"/"universo".
function FieldWorkHandoffCallout({
  status,
  selectedSourceId,
  busy,
  onBring,
  onUploadInstrument,
}: {
  status: CargaMonitoreoHandoffStatus;
  selectedSourceId: string | null;
  busy: boolean;
  onBring: () => void;
  onUploadInstrument: (file: File) => void;
}) {
  const { counts, source } = status;
  const selectedSource = status.sources?.find((item) => item.source_id === selectedSourceId);
  const processable = handoffCount(selectedSource?.counts.processable ?? counts.processable);
  const excluded = handoffCount(counts.no_defendible);
  const studyLabel = selectedSource?.label?.trim() || source.label?.trim();
  // El instrumento de procesamiento es SIEMPRE local. Está listo solo cuando
  // hay un XLSForm local disponible; si falta, la UI ofrece subirlo.
  const instrumentReady =
    source.instrument_source === "local" && source.instrument_available === true;
  const instrumentNeedsUpload =
    source.instrument_needs_upload === true || source.instrument_source === "needs_upload";
  const instrumentMissing = !instrumentReady;
  // En el camino general sin status resoluble (validity "all_rows") no todas las
  // filas son "validadas": traemos todo el corte de la fuente. En territorial y en
  // el camino por status, sí se filtró a las respuestas válidas.
  const filteredByValidity =
    source.validity !== undefined && source.validity !== "" && source.validity !== "all_rows";
  const countLine = filteredByValidity
    ? `${processable.toLocaleString("es-PE")} respuestas validadas listas para procesar.`
    : `${processable.toLocaleString("es-PE")} respuestas listas para procesar.`;
  // Si ya hay una base cruda cargada (import previo sin filtrar), el traer la
  // reemplaza en sitio por la selección validada — lo decimos con claridad.
  const replacing =
    status.existing_base.present && !status.existing_base.is_territorial;
  const replacedRows = status.existing_base.present ? status.existing_base.n_filas : 0;
  const instrumentNote = instrumentReady
    ? "Usaremos el formulario (XLSForm) ya cargado en el proyecto."
    : instrumentNeedsUpload
      ? "Falta el formulario (XLSForm). Súbelo para traer el trabajo de campo con su estructura."
      : "El formulario del estudio todavía no está disponible.";

  return (
    <section
      className={`pulso-carga-handoff${instrumentMissing ? " is-warning" : ""}`}
      aria-label="Trabajo de campo listo para procesar"
    >
      <span className="pulso-carga-handoff-icon" aria-hidden="true">
        <ClipboardCheck size={18} />
      </span>
      <div className="pulso-carga-handoff-copy">
        <span className="pulso-carga-handoff-eyebrow">Desde Monitoreo</span>
        <strong className="pulso-carga-handoff-title">
          Tu trabajo de campo está listo para procesar
        </strong>
        {studyLabel ? (
          <span className="pulso-carga-handoff-study">
            {studyLabel}{selectedSource?.kind ? ` · ${selectedSource.kind}` : ""}
          </span>
        ) : null}
        <p className="pulso-carga-handoff-count">
          {countLine}
          {excluded > 0 ? (
            <span className="pulso-carga-handoff-aside">
              {" "}{excluded.toLocaleString("es-PE")} quedan fuera por no ser defendibles.
            </span>
          ) : null}
        </p>
        {replacing ? (
          <span className="pulso-carga-handoff-note is-warning">
            <AlertTriangle size={13} aria-hidden="true" />
            Reemplaza la base actual ({replacedRows.toLocaleString("es-PE")} sin filtrar)
            por esta selección validada.
          </span>
        ) : null}
        <span className={`pulso-carga-handoff-note${instrumentMissing ? " is-warning" : ""}`}>
          {instrumentMissing ? <AlertTriangle size={13} aria-hidden="true" /> : null}
          {instrumentNote}
        </span>
      </div>
      <div className="pulso-carga-handoff-actions">
        {instrumentNeedsUpload ? (
          <label
            className={`pulso-carga-handoff-upload${busy ? " is-disabled" : ""}`}
            title="Sube el XLSForm del formulario (última versión de Kobo)"
          >
            <UploadCloud size={14} aria-hidden="true" />
            Sube el XLSForm del formulario
            <input
              type="file"
              accept=".xlsx,.xls"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Limpiamos el value para permitir re-subir el mismo archivo
                // tras un error de compatibilidad form↔data.
                e.target.value = "";
                if (file) onUploadInstrument(file);
              }}
              style={{ display: "none" }}
            />
          </label>
        ) : null}
        <button
          type="button"
          className="pulso-carga-handoff-primary"
          onClick={onBring}
          disabled={busy || instrumentMissing}
          title={
            instrumentReady
              ? "Traer el trabajo de campo al procesamiento"
              : instrumentNeedsUpload
                ? "Sube el formulario (XLSForm) para traer el trabajo de campo"
                : "El formulario del estudio todavía no está disponible"
          }
        >
          {busy ? <Loader2 size={14} className="pulso-spin" /> : <ArrowRight size={14} />}
          {replacing ? "Reemplazar por la validada" : "Traer al procesamiento"}
        </button>
      </div>
    </section>
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
    <section
      className={`pulso-kobo-detected is-from-monitoreo${compact ? " is-compact" : ""}`}
      aria-label="Instrumento detectado desde Monitoreo"
    >
      <span className="pulso-kobo-detected-icon" aria-hidden="true">
        <CloudDownload size={16} />
      </span>
      <div className="pulso-kobo-detected-copy">
        <span className="pulso-kobo-detected-origin">Detectado desde Monitoreo</span>
        <strong>{source.name || source.source_title || source.asset_uid}</strong>
        <span className="pulso-kobo-detected-meta">
          {faseTerritorialLabel(source.phase) ? (
            <em className="pulso-kobo-detected-fase">{faseTerritorialLabel(source.phase)}</em>
          ) : null}
          {source.base_url ? (
            <span className="pulso-kobo-detected-host">{source.base_url.replace(/^https?:\/\//, "")}</span>
          ) : null}
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
  const providerOptions: CargaPlatformProvider[] = ["surveymonkey", "kobo"];

  return (
    <section className="pulso-platform-import" aria-label="Carga desde plataforma">
      <div className="pulso-platform-topbar">
        <GlidingTabList
          activeKey={provider}
          mode="tabs"
          className="pulso-platform-provider-tabs pulso-compact-tabs"
          role="radiogroup"
          aria-label="Proveedor"
        >
          {providerOptions.map((item, index) => (
            <button
              key={item}
              type="button"
              className={`pulso-compact-tab${provider === item ? " is-active" : ""}`}
              onClick={() => onProviderChange(item)}
              onKeyDown={(event) => {
                const targetIndex = event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? providerOptions.length - 1
                    : event.key === "ArrowRight"
                      ? (index + 1) % providerOptions.length
                      : event.key === "ArrowLeft"
                        ? (index - 1 + providerOptions.length) % providerOptions.length
                        : -1;
                if (targetIndex < 0) return;
                onProviderChange(providerOptions[targetIndex]);
              }}
              role="radio"
              aria-checked={provider === item}
              data-gliding-key={item}
              title={`${providerLabel(item)} - seleccionar proveedor de origen`}
            >
              {item === "surveymonkey" ? <CloudDownload size={14} /> : <Database size={14} />}
              <span className="pulso-platform-provider-label">{providerLabel(item)}</span>
            </button>
          ))}
        </GlidingTabList>
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

      <div className="pulso-platform-controls">
        <label className="pulso-platform-field">
          <span>Conexión</span>
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
            placeholder={isSurveyMonkey ? "Filtrar encuestas" : "Filtrar proyectos"}
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
          Actualizar catálogo
        </button>
        <button
          type="button"
          className="pulso-platform-refresh"
          title={`Forzar actualización del catálogo de ${providerName}`}
          aria-label={`Forzar actualización del catálogo de ${providerName}`}
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
            <strong>{hasConnection ? "Catálogo pendiente" : `Sin conexión con ${providerName}`}</strong>
            <small>{hasConnection ? "Actualiza el catálogo para ver fuentes disponibles." : "Elige una conexión antes de importar."}</small>
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
            : hasConnection
              ? rowsCount > 0
                ? "Elige una fuente para importar."
                : "Actualiza el catálogo y elige una fuente."
              : `Conecta ${providerName} para importar fuentes.`}
        </span>
        <button
          type="button"
          className={`pulso-platform-import-button${selectedReady ? " is-ready" : " is-unavailable"}${busy ? " is-busy" : ""}`}
          onClick={onImport}
          disabled={busy || catalogLoading || !hasConnection || !selectedReady}
        >
          {busy ? <Loader2 size={15} className="pulso-spin" /> : <CloudDownload size={15} />}
          Importar seleccionada
        </button>
      </div>
    </section>
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
  const activeBaseHasData = Boolean(activeBase?.data_file_id);
  const enabled = isMultiBase ? hasMultiBase && activeBaseHasData && !busy && !error : allReady && !busy && !error;
  const disabledMessage = isMultiBase
    ? activeBase
      ? "La base seleccionada todavía no tiene respuestas cargadas."
      : "Agrega al menos una base para ver sus respuestas cargadas."
    : "Carga el formulario y las respuestas para ver la base completa.";
  const sourceLabel = isMultiBase && activeBase
    ? `Carga · ${cargaBaseLabel(activeBase)} · antes de validación, limpieza y codificación`
    : "Carga · antes de validación, limpieza y codificación";

  if (!enabled) {
    return (
      <section className="pulso-carga-base-shell" data-carga-surface="data" aria-label="Base de carga">
        <EmptyState
          icon={<Table2 size={20} />}
          title="Aún no hay datos de Carga para explorar"
          hint={disabledMessage}
        />
      </section>
    );
  }

  return (
    <section className="pulso-carga-base-shell" data-carga-surface="data" aria-label="Base de carga">
      {isMultiBase && baseOptions.length > 1 && (
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
        highlightCoding
        request={activeBase ? { base_nombre: activeBase.nombre } : undefined}
        repeat={repeatContextFromBase(activeBase)}
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
        <span><Upload size={13} /> Carga manual</span>
        <span><CloudDownload size={13} /> Plataforma</span>
        <span><ArrowRightLeft size={13} /> {isMultiBase ? `${bases} base${bases === 1 ? "" : "s"}` : "Una base"}</span>
      </div>
    </section>
  );
}

// =====================================================================
// Upload card — dropzone unificada con estado visual
// =====================================================================


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
        <span
          className={`pulso-upload-state${done ? " is-ready" : disabled && !done ? " is-blocked" : ""}`}
          aria-hidden="true"
        >
          {done ? "Listo" : disabled ? "En espera" : "Pendiente"}
        </span>
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
