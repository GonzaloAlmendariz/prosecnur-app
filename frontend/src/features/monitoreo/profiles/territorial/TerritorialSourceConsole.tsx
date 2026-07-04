import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ContactRound,
  DatabaseZap,
  Download,
  ExternalLink,
  FileCheck2,
  Link2,
  Loader2,
  MapPin,
  RefreshCw,
  Route,
  Save,
  Search,
  SlidersHorizontal,
  Table2,
  Upload,
  XCircle,
} from "lucide-react";
import {
  apiJobStatus,
  apiMonitoreoKoboAssets,
  apiMonitoreoSheetsSource,
  apiMonitoreoSheetsSync,
  apiMonitoreoSync,
  apiMonitoreoTerritorialConfig,
  apiMonitoreoTerritorialEnumeratorsCodes,
  apiMonitoreoTerritorialEnumeratorsTemplate,
  apiMonitoreoTerritorialEnumeratorsUpload,
  apiMonitoreoTerritorialInspectKobo,
  apiMonitoreoTerritorialReconciliationBatch,
  apiMonitoreoTerritorialSource,
  type JobSnapshot,
  type MonitoreoConfig,
  type MonitoreoKoboAssetItem,
  type MonitoreoSource,
  type MonitoreoSourcePayload,
  type MonitoreoState,
  type MonitoreoTerritorialDashboard,
  type MonitoreoTerritorialPhase,
  type MonitoreoTerritorialPhaseCoherenceItem,
  type MonitoreoTerritorialPhaseMapping,
  type MonitoreoTerritorialReconciliationBatchChange,
  type MonitoreoVariable,
} from "../../../../api/client";
import type { WorkbenchView } from "../../core/monitoreoRegistry";

type TerritorialSourceTab = "form" | "filter" | "roster" | "reconciliation" | "history";
type TerritorialSourceDeclaredUmpRow = NonNullable<MonitoreoTerritorialDashboard["ump_declared_summary"]>["rows"][number];

export type TerritorialSourceConsoleProps = {
  activeLocalTab?: string;
  phase: MonitoreoTerritorialPhase;
  reports: MonitoreoTerritorialDashboard | null;
  state: MonitoreoState | null;
  busy?: boolean;
  onStateChange: (state: MonitoreoState) => void;
  onReload: () => void;
  onSyncKobo?: () => Promise<void> | void;
  onError?: (message: string) => void;
};

const TERRITORIAL_SOURCE_TABS: TerritorialSourceTab[] = ["form", "filter", "roster", "reconciliation", "history"];

function isTerritorialSourceTab(value: unknown): value is TerritorialSourceTab {
  return TERRITORIAL_SOURCE_TABS.includes(value as TerritorialSourceTab);
}

function fmt(value: unknown, fallback = "0") {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (Number.isFinite(n)) return new Intl.NumberFormat("es-PE").format(n);
  return String(value);
}

function num(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeSearch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

function phaseLabel(phase: MonitoreoTerritorialPhase) {
  return phase === "pilot" ? "Piloto" : "Campo";
}

function territorialPhaseStatusLabel(item: MonitoreoTerritorialPhaseCoherenceItem | null, phase: MonitoreoTerritorialPhase) {
  const label = phaseLabel(phase);
  if (!item) return `${label} seleccionado.`;
  if (item.message) return item.message;
  switch (item.status) {
    case "source_not_applied":
      return `${label} no tiene formulario aplicado.`;
    case "source_applied_not_synced":
      return `${label} tiene formulario aplicado, pero falta sincronizar respuestas locales.`;
    case "source_synced_with_rows":
      return `${label} tiene ${fmt(item.local_rows)} respuestas locales sincronizadas.`;
    case "source_synced_zero_rows":
      return `${label} sincronizado con 0 respuestas reales.`;
    case "dashboard_stale":
      return `${label} tiene tablero desactualizado respecto de su fuente.`;
    case "source_snapshot_mismatch":
      return `${label} tiene desalineación entre fuente aplicada y snapshot.`;
    case "sync_error":
      return `La última actualización de ${label} terminó con error.`;
    default:
      return `${label} seleccionado.`;
  }
}

function territorialPhaseBadgeLabel(item: MonitoreoTerritorialPhaseCoherenceItem | null) {
  if (!item) return "Sin diagnóstico";
  switch (item.status) {
    case "source_not_applied":
      return "Sin fuente";
    case "source_applied_not_synced":
      return "Sin actualizar";
    case "source_synced_with_rows":
      return `${fmt(item.local_rows)} locales`;
    case "source_synced_zero_rows":
      return "Sin respuestas";
    case "dashboard_stale":
      return "Ficha desactualizada";
    case "source_snapshot_mismatch":
      return "Revisar fuente";
    case "sync_error":
      return "Error al actualizar";
    default:
      return item.status;
  }
}

function territorialPhaseStatusTone(item: MonitoreoTerritorialPhaseCoherenceItem | null) {
  if (!item) return "unknown";
  if (item.status === "source_synced_with_rows") return "ready";
  if (item.status === "source_synced_zero_rows") return "empty";
  if (item.status === "source_applied_not_synced" || item.status === "dashboard_stale") return "warning";
  if (item.status === "source_not_applied") return "missing";
  if (item.status === "source_snapshot_mismatch" || item.status === "sync_error") return "error";
  return "base";
}

function shortenMiddle(value = "", max = 34) {
  if (value.length <= max) return value;
  const side = Math.max(6, Math.floor((max - 1) / 2));
  return `${value.slice(0, side)}...${value.slice(-side)}`;
}

function downloadFile(url: string) {
  if (!url) return;
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function cleanDimensions(dimensions: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(dimensions)
      .map(([key, value]) => [key, String(value ?? "").trim()] as const)
      .filter(([, value]) => value),
  );
}

function sourcePhase(source: MonitoreoSource | null | undefined): MonitoreoTerritorialPhase | "" {
  const phase = source?.dimensions?.territorial_phase;
  return phase === "pilot" || phase === "field" ? phase : "";
}

function koboSourceForPhase(sources: MonitoreoSource[], config: MonitoreoConfig, phase: MonitoreoTerritorialPhase) {
  const phaseSource = config.territorial.phase_sources?.[phase];
  return sources.find((source) => source.id && source.id === phaseSource?.source_id)
    ?? sources.find((source) => source.kind === "kobo" && source.asset_uid && source.asset_uid === phaseSource?.asset_uid)
    ?? sources.find((source) => source.kind === "kobo" && sourcePhase(source) === phase)
    ?? sources.find((source) => source.kind === "kobo" && source.enabled && source.role !== "ocurrencias_campo")
    ?? sources.find((source) => source.kind === "kobo" && source.role !== "ocurrencias_campo")
    ?? null;
}

function routeSheetSourceForPhase(sources: MonitoreoSource[], phase: MonitoreoTerritorialPhase) {
  return sources.find((source) => source.kind === "google_sheets" && source.role === "hoja_ruta" && sourcePhase(source) === phase)
    ?? sources.find((source) => source.kind === "google_sheets" && source.role === "hoja_ruta")
    ?? null;
}

function mappingForPhase(config: MonitoreoConfig, phase: MonitoreoTerritorialPhase): MonitoreoTerritorialPhaseMapping {
  return {
    ...config.territorial,
    ...(config.territorial.phase_mappings?.[phase] ?? {}),
    platform_effective_values: [
      ...((config.territorial.phase_mappings?.[phase]?.platform_effective_values ?? config.territorial.platform_effective_values) ?? []),
    ],
  };
}

function selectedOptionLabel(variables: MonitoreoVariable[], name = "") {
  const variable = variables.find((item) => item.name === name);
  return variable?.label || variable?.name || name || "Por definir";
}

function jobProgressText(job: JobSnapshot | null) {
  const progress = job?.progress;
  if (!progress) return "";
  if ("message" in progress && typeof progress.message === "string" && progress.message) return progress.message;
  if ("phase" in progress && typeof progress.phase === "string" && progress.phase) return progress.phase;
  return "";
}

function jobProgressPercent(job: JobSnapshot | null) {
  const progress = job?.progress;
  if (!progress) return null;
  if ("percent" in progress && typeof progress.percent === "number" && Number.isFinite(progress.percent)) {
    return Math.max(0, Math.min(100, Math.round(progress.percent)));
  }
  if (
    "current" in progress
    && "total" in progress
    && typeof progress.current === "number"
    && typeof progress.total === "number"
    && progress.total > 0
  ) {
    return Math.max(0, Math.min(100, Math.round((progress.current / progress.total) * 100)));
  }
  return null;
}

function isTerminalJob(job: JobSnapshot | null) {
  return job?.status === "done" || job?.status === "error" || job?.status === "cancelled";
}

function variableOptions(variables: MonitoreoVariable[], reports: MonitoreoTerritorialDashboard | null) {
  const byName = new Map<string, { name: string; label: string; type: string }>();
  for (const variable of variables) {
    byName.set(variable.name, {
      name: variable.name,
      label: variable.label || variable.name,
      type: variable.tipo || "",
    });
  }
  for (const field of reports?.source_coherence?.survey_fields ?? []) {
    byName.set(field.xpath || field.name, {
      name: field.xpath || field.name,
      label: field.label || field.name,
      type: field.type || "",
    });
    byName.set(field.name, {
      name: field.name,
      label: field.label || field.name,
      type: field.type || "",
    });
  }
  return Array.from(byName.values()).sort((a, b) => a.label.localeCompare(b.label, "es"));
}

function sourceReadinessItems(config: MonitoreoConfig, reports: MonitoreoTerritorialDashboard | null, phase: MonitoreoTerritorialPhase, source: MonitoreoSource | null) {
  const phaseSource = config.territorial.phase_sources?.[phase];
  const mapping = mappingForPhase(config, phase);
  const detected = reports?.source_coherence?.detected_fields ?? {};
  const effectiveValues = mapping.platform_effective_values ?? [];
  const hasAsset = Boolean(phaseSource?.asset_uid || source?.asset_uid || reports?.source_coherence?.asset_uid);
  const checks = [
    { key: "form", label: "Formulario Kobo", ready: hasAsset, detail: phaseSource?.kobo_asset_name || source?.label || reports?.source_coherence?.asset_name || "Sin asset" },
    { key: "district", label: "Distrito", ready: Boolean(mapping.district_var), detail: mapping.district_var || "Sin variable" },
    { key: "ump", label: "UMP / manzana", ready: Boolean(mapping.ump_var), detail: mapping.ump_var || "Sin variable" },
    { key: "pulso", label: "Código Pulso", ready: Boolean(mapping.pulso_code_var), detail: mapping.pulso_code_var || "Sin variable" },
    { key: "filter", label: "Filtro efectivo", ready: Boolean(mapping.platform_effective_var && effectiveValues.length), detail: mapping.platform_effective_var ? `${mapping.platform_effective_var} = ${effectiveValues.join(", ") || "sin valor"}` : "Sin filtro" },
  ];
  return checks.map((check) => {
    const detectedKey = check.key === "pulso" ? "enumerator_pulso_code" : check.key === "filter" ? "valid_filter_question" : check.key;
    const present = detected[detectedKey]?.present;
    return {
      ...check,
      ready: check.ready && present !== false,
      warning: check.ready && present === false,
    };
  });
}

export function TerritorialSourceConsole({
  activeLocalTab,
  busy = false,
  phase,
  reports,
  state,
  onError,
  onReload,
  onSyncKobo,
  onStateChange,
}: TerritorialSourceConsoleProps) {
  const config = state?.config;
  const sources = state?.sources ?? [];
  const variables = state?.variables ?? [];
  const history = state?.territorial_update_history ?? [];
  const [activeTab, setActiveTab] = useState<TerritorialSourceTab>(isTerritorialSourceTab(activeLocalTab) ? activeLocalTab : "form");
  const [assets, setAssets] = useState<MonitoreoKoboAssetItem[]>([]);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetError, setAssetError] = useState("");
  const [assetQuery, setAssetQuery] = useState("");
  const [assetFilter, setAssetFilter] = useState<"all" | "active">("all");
  const [pendingAssetUid, setPendingAssetUid] = useState("");
  const [showFormList, setShowFormList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [sheetSpreadsheetId, setSheetSpreadsheetId] = useState("");
  const [sheetRange, setSheetRange] = useState("");
  const [syncJob, setSyncJob] = useState<JobSnapshot | null>(null);
  const [syncJobId, setSyncJobId] = useState("");
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(() => new Set());
  const [batchApplying, setBatchApplying] = useState(false);
  const [batchMessage, setBatchMessage] = useState("");
  const [rosterFile, setRosterFile] = useState<File | null>(null);
  const [rosterFormat, setRosterFormat] = useState<"PXXX" | "DNI">("PXXX");
  const [rosterSearch, setRosterSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const syncJobReloadedRef = useRef("");

  const koboSource = config ? koboSourceForPhase(sources, config, phase) : null;
  const routeSheetSource = routeSheetSourceForPhase(sources, phase);
  const phaseSource = config?.territorial.phase_sources?.[phase];
  const activeAssetUid = phaseSource?.asset_uid || koboSource?.asset_uid || reports?.source_coherence?.asset_uid || "";
  const activeAssetName = phaseSource?.kobo_asset_name || reports?.source_coherence?.asset_name || koboSource?.label || "";
  const activeVersion = phaseSource?.kobo_version_id || reports?.source_coherence?.version_id || "";
  const baseUrl = phaseSource?.base_url || koboSource?.base_url || "https://kf.kobotoolbox.org";
  const profileId = phaseSource?.connection_profile_id || koboSource?.connection_profile_id || "";
  const options = useMemo(() => variableOptions(variables, reports), [reports, variables]);
  const mapping = useMemo(() => config ? mappingForPhase(config, phase) : null, [config, phase]);
  const readiness = useMemo(() => config ? sourceReadinessItems(config, reports, phase, koboSource) : [], [config, koboSource, phase, reports]);
  const readyCount = readiness.filter((item) => item.ready).length;
  const routeSheet = reports?.route_sheet ?? null;
  const batchRecommendations = useMemo(() => routeSheet?.recommendations?.batch ?? [], [routeSheet?.recommendations?.batch]);
  const selectedBatchRecommendations = useMemo(
    () => batchRecommendations.filter((item) => selectedBatchIds.has(item.client_id)),
    [batchRecommendations, selectedBatchIds],
  );
  const sourceValidity = reports?.source_validity ?? null;
  const sourceCoherence = reports?.source_coherence ?? null;
  const phaseCoherence = state?.territorial_phase_coherence ?? state?.dashboard?.territorial_reports?.phase_coherence ?? null;
  const activePhaseHealth = phaseCoherence?.phases?.[phase] ?? (phaseCoherence?.active?.phase === phase ? phaseCoherence.active : null) ?? null;
  const connectedRouteSheet = Boolean(routeSheetSource);
  const validFilterValues = mapping?.platform_effective_values ?? [];

  const notifyError = useCallback((error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error);
    onError?.(msg);
    setMessage("");
    return msg;
  }, [onError]);

  useEffect(() => {
    setActiveTab(isTerritorialSourceTab(activeLocalTab) ? activeLocalTab : "form");
  }, [activeLocalTab]);

  useEffect(() => {
    if (activeAssetUid) setShowFormList(false);
  }, [activeAssetUid]);

  useEffect(() => {
    setSheetSpreadsheetId(routeSheetSource?.sheet_binding?.spreadsheet_id ?? "");
    setSheetRange(routeSheetSource?.sheet_binding?.range ?? "");
  }, [routeSheetSource?.id, routeSheetSource?.sheet_binding?.range, routeSheetSource?.sheet_binding?.spreadsheet_id]);

  useEffect(() => {
    setSelectedBatchIds(new Set());
    setBatchMessage("");
  }, [activeAssetUid, phase, routeSheet?.source_id]);

  useEffect(() => {
    if (!selectedBatchIds.size) return;
    const availableIds = new Set(batchRecommendations.map((item) => item.client_id));
    setSelectedBatchIds((current) => {
      const next = new Set(Array.from(current).filter((id) => availableIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [batchRecommendations, selectedBatchIds.size]);

  useEffect(() => {
    if (!syncJobId) return;
    if (isTerminalJob(syncJob)) {
      if (syncJob?.status === "done" && syncJobReloadedRef.current !== syncJobId) {
        syncJobReloadedRef.current = syncJobId;
        onReload();
      }
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const next = await apiJobStatus(syncJobId);
        if (cancelled) return;
        setSyncJob(next);
        if (next.status === "done" && syncJobReloadedRef.current !== syncJobId) {
          syncJobReloadedRef.current = syncJobId;
          onReload();
        }
        if (next.status === "error" || next.status === "cancelled") {
          setSyncJobId("");
        }
      } catch (error) {
        if (!cancelled) {
          notifyError(error);
          setSyncJobId("");
        }
      }
    };
    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 1400);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [notifyError, onReload, syncJob?.status, syncJobId]);

  const loadAssets = useCallback(async () => {
    setAssetsLoading(true);
    setAssetError("");
    try {
      const result = await apiMonitoreoKoboAssets(baseUrl, 100, { connection_profile_id: profileId || undefined });
      setAssets(result.assets);
      setAssetsLoaded(true);
    } catch (error) {
      setAssetError(notifyError(error));
    } finally {
      setAssetsLoading(false);
    }
  }, [baseUrl, notifyError, profileId]);

  const applyAsset = useCallback(async (asset: MonitoreoKoboAssetItem) => {
    if (!config) return;
    setSaving(true);
    setMessage("");
    try {
      const result = await apiMonitoreoTerritorialSource({
        phase,
        asset_uid: asset.uid,
        name: `${asset.name} · ${phaseLabel(phase)}`,
        version_id: asset.version_id || "",
        base_url: baseUrl,
        connection_profile_id: profileId,
        source_id: koboSource?.id,
      });
      onStateChange(result.state);
      setPendingAssetUid("");
      setMessage(result.message || `Formulario aplicado a ${phaseLabel(phase)}.`);
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  }, [baseUrl, config, koboSource?.id, notifyError, onStateChange, phase, profileId]);

  const inspectKobo = useCallback(async () => {
    setSaving(true);
    setMessage("");
    try {
      const result = await apiMonitoreoTerritorialInspectKobo({
        phase,
        asset_uid: activeAssetUid,
        source_id: koboSource?.id,
        base_url: baseUrl,
        connection_profile_id: profileId,
      });
      onStateChange(result.state);
      setMessage(`Inspección Kobo lista: ${result.schema.name || activeAssetName || "formulario"} · ${fmt(result.schema.survey_count, "0")} preguntas.`);
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  }, [activeAssetName, activeAssetUid, baseUrl, koboSource?.id, notifyError, onStateChange, phase, profileId]);

  const switchPhase = useCallback(async (nextPhase: MonitoreoTerritorialPhase) => {
    if (!config || nextPhase === phase) return;
    setSaving(true);
    setMessage("");
    try {
      const result = await apiMonitoreoTerritorialConfig({ active_route_phase: nextPhase });
      onStateChange(result.state);
      setMessage(`Fase territorial activa: ${phaseLabel(nextPhase)}.`);
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  }, [config, notifyError, onStateChange, phase]);

  const syncKobo = useCallback(async () => {
    if (!config || !koboSource?.id) return;
    setSaving(true);
    setMessage("");
    try {
      if (onSyncKobo) {
        await Promise.resolve(onSyncKobo());
        setMessage(`Actualización ${phaseLabel(phase)} en cola.`);
        return;
      }
      const result = await apiMonitoreoSync(config, [koboSource.id]);
      setSyncJobId(result.job_id);
      syncJobReloadedRef.current = "";
      const first = await apiJobStatus(result.job_id).catch(() => null);
      setSyncJob(first);
      setMessage(`Sincronización Kobo en cola: ${result.job_id}.`);
      onReload();
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  }, [config, koboSource?.id, notifyError, onReload, onSyncKobo, phase]);

  const toggleBatchRecommendation = useCallback((clientId: string) => {
    setSelectedBatchIds((current) => {
      const next = new Set(current);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  }, []);

  const selectAllBatchRecommendations = useCallback(() => {
    setSelectedBatchIds(new Set(batchRecommendations.map((item) => item.client_id)));
  }, [batchRecommendations]);

  const clearBatchRecommendations = useCallback(() => {
    setSelectedBatchIds(new Set());
  }, []);

  const applyBatchReconciliation = useCallback(async () => {
    if (!selectedBatchRecommendations.length) return;
    setBatchApplying(true);
    setBatchMessage("");
    setMessage("");
    try {
      const changes: MonitoreoTerritorialReconciliationBatchChange[] = selectedBatchRecommendations.map((item) => (
        item.kind === "code"
          ? { client_id: item.client_id, kind: "code", reconciliation: item.reconciliation }
          : { client_id: item.client_id, kind: "ump", reconciliation: item.reconciliation }
      ));
      const result = await apiMonitoreoTerritorialReconciliationBatch(changes);
      if (result.state) {
        onStateChange(result.state);
      }
      setSelectedBatchIds(new Set());
      setBatchMessage(
        result.failed.length
          ? `Aplicadas ${fmt(result.applied.length)} y ${fmt(result.failed.length)} con error.`
          : `Aplicadas ${fmt(result.applied.length)} reconciliaciones.`,
      );
    } catch (error) {
      setBatchMessage(notifyError(error));
    } finally {
      setBatchApplying(false);
    }
  }, [notifyError, onStateChange, selectedBatchRecommendations]);

  const saveMapping = useCallback(async (patch: Partial<MonitoreoTerritorialPhaseMapping>) => {
    if (!config || !mapping) return;
    setSaving(true);
    setMessage("");
    try {
      const current: Partial<Record<MonitoreoTerritorialPhase, MonitoreoTerritorialPhaseMapping>> = config.territorial.phase_mappings ?? {};
      const nextMapping = { ...mapping, ...patch };
      const result = await apiMonitoreoTerritorialConfig({
        active_route_phase: phase,
        phase_mappings: {
          pilot: current.pilot ?? mappingForPhase(config, "pilot"),
          field: current.field ?? mappingForPhase(config, "field"),
          [phase]: nextMapping,
        },
        ...nextMapping,
      });
      onStateChange(result.state);
      setMessage("Configuración operativa guardada.");
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  }, [config, mapping, notifyError, onStateChange, phase]);

  const saveRouteSheet = useCallback(async () => {
    if (!sheetSpreadsheetId.trim()) {
      setMessage("");
      onError?.("Pega el ID o URL del Spreadsheet de Hojas de Ruta.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const payload: MonitoreoSourcePayload = {
        id: routeSheetSource?.id,
        kind: "google_sheets",
        label: routeSheetSource?.label || "Hoja de ruta operativa",
        enabled: routeSheetSource?.enabled ?? true,
        role: "hoja_ruta",
        integration_mode: "connected_read",
        sheet_binding: {
          spreadsheet_id: sheetSpreadsheetId.trim(),
          sheet_name: "Hojas_de_ruta",
          header_row: 6,
          range: sheetRange.trim(),
        },
        dimensions: cleanDimensions({ ...(routeSheetSource?.dimensions ?? {}), territorial_phase: phase }),
      };
      const result = await apiMonitoreoSheetsSource(payload);
      onStateChange(result.state);
      setMessage("Hoja de Ruta guardada para la fase territorial.");
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  }, [notifyError, onError, onStateChange, phase, routeSheetSource, sheetRange, sheetSpreadsheetId]);

  const syncRouteSheet = useCallback(async () => {
    if (!routeSheetSource?.id) return;
    setSaving(true);
    setMessage("");
    try {
      const result = await apiMonitoreoSheetsSync([routeSheetSource.id]);
      onStateChange(result.state);
      setMessage("Snapshot de Hojas de Ruta sincronizado.");
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  }, [notifyError, onStateChange, routeSheetSource?.id]);

  const uploadRoster = useCallback(async (selectedFile?: File | null) => {
    const file = selectedFile ?? rosterFile;
    if (!file) {
      fileInputRef.current?.click();
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const result = await apiMonitoreoTerritorialEnumeratorsUpload(file, {
        code_var: mapping?.pulso_code_var || "codigo_pulso",
        ump_var: mapping?.ump_var || "ump",
        code_format: rosterFormat,
      });
      onStateChange(result.state);
      setMessage(`Base de encuestadores cargada: ${fmt(result.enumerator_roster.total)} registros.`);
      setRosterFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  }, [mapping?.pulso_code_var, mapping?.ump_var, notifyError, onStateChange, rosterFile, rosterFormat]);

  const downloadRosterTemplate = useCallback(async () => {
    setSaving(true);
    setMessage("");
    try {
      const result = await apiMonitoreoTerritorialEnumeratorsTemplate();
      downloadFile(result.download_url);
      setMessage(`Plantilla generada: ${result.filename}.`);
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  }, [notifyError]);

  const downloadRosterCodes = useCallback(async () => {
    setSaving(true);
    setMessage("");
    try {
      const result = await apiMonitoreoTerritorialEnumeratorsCodes();
      downloadFile(result.download_url);
      setMessage(`Códigos exportados: ${result.filename}.`);
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  }, [notifyError]);

  const filteredAssets = useMemo(() => {
    const q = assetQuery.trim().toLocaleLowerCase("es-PE");
    return assets
      .filter((asset) => assetFilter === "all" || asset.deployment_active)
      .filter((asset) => !q || `${asset.name} ${asset.uid}`.toLocaleLowerCase("es-PE").includes(q))
      .sort((a, b) => {
        if (a.uid === activeAssetUid) return -1;
        if (b.uid === activeAssetUid) return 1;
        return String(b.date_modified ?? "").localeCompare(String(a.date_modified ?? ""));
      })
      .slice(0, 18);
  }, [activeAssetUid, assetFilter, assetQuery, assets]);

  if (!config) {
    return (
      <div className="mon-territorial-source-empty">
        <Loader2 size={16} className="pulso-spin" />
        Preparando configuración territorial...
      </div>
    );
  }

  const pendingAsset = pendingAssetUid ? assets.find((asset) => asset.uid === pendingAssetUid) ?? null : null;
  const formReady = Boolean(activeAssetUid);
  const responseCount = num(sourceValidity?.total_responses ?? activePhaseHealth?.local_rows ?? reports?.kpis.total_respuestas) ?? 0;
  const sourceReceivedCount = num(activePhaseHealth?.local_rows ?? responseCount) ?? responseCount;
  const sourceEffectiveCount = num(sourceValidity?.effective_count);
  const sourceMissingCount = num(sourceValidity?.missing_count);
  const sourceNonEffectiveCount = num(sourceValidity?.non_effective_count);
  const effectivePct = sourceValidity?.total_responses
    ? Math.round(((sourceValidity.effective_count ?? 0) / sourceValidity.total_responses) * 100)
    : null;
  const filterConfigured = Boolean(mapping?.platform_effective_var && validFilterValues.length);
  const notCountingCount = sourceNonEffectiveCount ?? (
    sourceEffectiveCount == null ? null : Math.max(0, responseCount - sourceEffectiveCount - (sourceMissingCount ?? 0))
  );
  const liveDistricts = sourceCoherence?.district_choices ?? config.territorial.district_crosswalk.map((row) => ({ name: row.kobo_code, label: row.kobo_label }));
  const routeDistricts = config.territorial.district_crosswalk;
  const alignedDistricts = routeDistricts.filter((row) => (
    liveDistricts.some((district) => district.name === row.kobo_code || district.label === row.kobo_label)
  ));
  const missingRouteDistricts = routeDistricts.filter((row) => !alignedDistricts.some((aligned) => aligned.kobo_code === row.kobo_code));
  const extraKoboDistricts = liveDistricts.filter((district) => (
    !routeDistricts.some((row) => row.kobo_code === district.name || row.kobo_label === district.label)
  ));
  const routeDistrictTotal = routeDistricts.length || liveDistricts.length;
  const districtCrossPct = routeDistrictTotal ? Math.round((alignedDistricts.length / routeDistrictTotal) * 100) : null;
  const surveyQuestionCount = sourceCoherence?.survey_count ?? null;
  const surveyChoiceCount = sourceCoherence?.choices_count ?? null;
  const schemaHealthPct = surveyQuestionCount ? 100 : activeAssetUid ? 55 : 0;
  const sourceReadinessGaps = readiness.filter((item) => !item.ready).map((item) => item.label);
  const sourceOperationalReady = Boolean(activeAssetUid && !sourceReadinessGaps.length);
  const sourceReadinessTone: "ready" | "warning" | "missing" = !activeAssetUid ? "missing" : sourceOperationalReady ? "ready" : "warning";
  const sourceOperationalStatus = !activeAssetUid
    ? "Sin formulario"
    : sourceOperationalReady
      ? `Listo para ${phaseLabel(phase)}`
      : "Revisar configuración";
  const sourceReadinessMessage = !activeAssetUid
    ? `Selecciona el formulario que usará ${phaseLabel(phase).toLocaleLowerCase("es-PE")}.`
    : sourceOperationalReady
      ? `${phaseLabel(phase)} está usando este formulario. ${sourceEffectiveCount == null ? "El corte queda pendiente de conteo." : `${fmt(sourceEffectiveCount)} respuestas pasan el filtro.`}`
      : `Falta completar: ${sourceReadinessGaps.join(", ")}.`;
  const selectedFilterValueLabels = validFilterValues.slice(0, 6);
  const sourceFilterRuleLabel = filterConfigured
    ? `Pasan el filtro con: ${selectedFilterValueLabels.join(", ") || "valor configurado"}`
    : "Define qué respuestas pasan el filtro.";
  const phaseCards = (["pilot", "field"] as MonitoreoTerritorialPhase[]).map((itemPhase) => {
    const itemSource = koboSourceForPhase(sources, config, itemPhase);
    const itemPhaseSource = config.territorial.phase_sources?.[itemPhase];
    const health = state?.territorial_phase_coherence?.phases?.[itemPhase] ?? null;
    const assetUid = itemPhaseSource?.asset_uid || itemSource?.asset_uid || "";
    const name = itemPhaseSource?.kobo_asset_name || itemSource?.label || "Selecciona un formulario Kobo";
    return {
      phase: itemPhase,
      label: phaseLabel(itemPhase),
      hint: itemPhase === "field" ? "Formulario de campo" : "Formulario piloto",
      assetUid,
      name,
      health,
    };
  });
  const roster = config.territorial.enumerator_roster;
  const codeSummary = reports?.enumerator_code_summary;
  const rosterAssignments = roster?.assignments ?? [];
  const rosterCodeRows = codeSummary?.assigned_summary?.length
    ? codeSummary.assigned_summary
    : rosterAssignments.map((row) => ({
      code: row.codigo_pulso,
      name: row.nombre,
      response_count: 0,
      auto_response_count: 0,
      reconciled_response_count: 0,
      appears_in_base: false,
      last_record: "",
      status: "sin_registros",
    }));
  const normalizedRosterSearch = normalizeSearch(rosterSearch);
  const filteredRosterCodeRows = rosterCodeRows.filter((row) => {
    if (!normalizedRosterSearch) return true;
    return normalizeSearch([
      row.code,
      row.name,
      row.status,
      row.last_record,
    ].join(" ")).includes(normalizedRosterSearch);
  });
  const assignedStatusLabel = (row: (typeof rosterCodeRows)[number]) => {
    const status = String(row.status ?? "");
    if (status === "reconciliado" || (row.reconciled_response_count ?? 0) > 0) return "Reconciliado";
    if (status === "revisar") return "Revisar";
    if ((row.response_count ?? 0) > 0 || row.appears_in_base) return "Reconocido";
    return "Sin registros";
  };
  const assignedStatusTone = (row: (typeof rosterCodeRows)[number]) => {
    const label = assignedStatusLabel(row);
    if (label === "Reconocido" || label === "Reconciliado") return "ready";
    if (label === "Revisar") return "warning";
    return "muted";
  };
  const umpSummary = reports?.ump_declared_summary;
  const codeReviewRows = [
    ...(codeSummary?.reconciliation_responses ?? []),
    ...(codeSummary?.unrecognized_responses ?? []),
  ].slice(0, 8);
  const umpRows = umpSummary?.rows ?? [];
  const umpManualRows = umpRows.filter((row) => row.status === "review" || row.status === "missing");
  const umpReviewRows = (umpManualRows.length
    ? umpManualRows
    : umpRows).slice(0, 8);
  const umpRowsWithoutRoute = umpManualRows.filter((row) => !row.assigned_ump && !(row.route_blocks?.length ?? 0));
  const umpRowsWithRouteCandidate = umpManualRows.filter((row) => (row.route_blocks?.length ?? 0) > 0 || Boolean(row.assigned_ump));
  const umpManualPreviewRows = (umpManualRows.length ? umpManualRows : umpRows).slice(0, 4);
  const umpAcceptedCount = (umpSummary?.metrics?.recognized_ump_count ?? 0) + (umpSummary?.metrics?.reconciled_ump_count ?? 0);
  const declaredUmpReviewReason = (row: TerritorialSourceDeclaredUmpRow) => {
    if (row.status === "missing") return "Sin UMP declarada";
    if (row.assigned_ump) return "Ruta guardada";
    if ((row.route_blocks?.length ?? 0) > 1) return `${fmt(row.route_blocks?.length)} rutas posibles`;
    if ((row.route_blocks?.length ?? 0) === 1) return "Ruta candidata";
    return "Sin ruta asignada";
  };
  const declaredUmpStatusLabel = (status: string) => {
    if (status === "recognized") return "Exacta";
    if (status === "reconciled") return "Reconciliada";
    if (status === "missing") return "Sin UMP";
    if (status === "review") return "Revisar";
    return status || "S/D";
  };
  const declaredUmpStatusTone = (status: string) => {
    if (status === "recognized" || status === "reconciled") return "ready";
    if (status === "review") return "warning";
    if (status === "missing") return "danger";
    return "muted";
  };
  const routeSheetMetrics = routeSheet?.metrics;
  const syncProgressPercent = jobProgressPercent(syncJob);
  const batchCodeCount = batchRecommendations.filter((item) => item.kind === "code").length;
  const batchUmpCount = batchRecommendations.filter((item) => item.kind === "ump").length;
  const hasBatchRecommendations = batchRecommendations.length > 0;
  const batchStatusTitle = selectedBatchRecommendations.length
    ? `${fmt(selectedBatchRecommendations.length)} seleccionadas`
    : hasBatchRecommendations
      ? `${fmt(batchRecommendations.length)} sugerencias listas`
      : "Sin lote automático";
  const batchStatusDetail = batchMessage || (selectedBatchRecommendations.length
    ? "Revisa la selección antes de aplicar el lote canónico."
    : hasBatchRecommendations
      ? "Selecciona sugerencias individuales o aplica todo el lote seguro."
      : "No hay sugerencias automáticas seguras; las filas visibles quedan como revisión manual.");
  const codeBatchIndex = useMemo(() => {
    const index = new Map<string, string>();
    batchRecommendations.forEach((item) => {
      if (item.kind !== "code") return;
      const reconciliation = item.reconciliation;
      const responseScoped = Boolean(reconciliation.response_id) || String(reconciliation.scope ?? "").trim() === "response";
      const keys = [
        reconciliation.response_id ? `response:${reconciliation.response_id}` : "",
        ...(!responseScoped ? [
          reconciliation.raw_code ? `raw:${reconciliation.raw_code}` : "",
          reconciliation.normalized_code ? `normalized:${reconciliation.normalized_code}` : "",
        ] : []),
      ];
      keys.forEach((key) => {
        if (key && !index.has(key)) index.set(key, item.client_id);
      });
    });
    return index;
  }, [batchRecommendations]);
  const umpBatchIndex = useMemo(() => {
    const index = new Map<string, string>();
    batchRecommendations.forEach((item) => {
      if (item.kind !== "ump") return;
      const reconciliation = item.reconciliation;
      const responseScoped = Boolean(reconciliation.response_id) || String(reconciliation.scope ?? "").trim() === "response";
      const keys = [
        reconciliation.response_id ? `response:${reconciliation.response_id}` : "",
        ...(!responseScoped ? [
          reconciliation.raw_ump ? `raw:${reconciliation.raw_ump}` : "",
          reconciliation.assigned_ump ? `assigned:${reconciliation.assigned_ump}` : "",
          reconciliation.assigned_block_id ? `block:${reconciliation.assigned_block_id}` : "",
          reconciliation.raw_ump && reconciliation.assigned_ump ? `pair:${reconciliation.raw_ump}->${reconciliation.assigned_ump}` : "",
        ] : []),
      ];
      keys.forEach((key) => {
        if (key && !index.has(key)) index.set(key, item.client_id);
      });
    });
    return index;
  }, [batchRecommendations]);

  return (
    <div className={`mon-territorial-source-console is-tab-${activeTab}`} data-source-tab={activeTab}>
      <section className="mon-territorial-source-command" aria-label="Consola canónica de fuentes territoriales">
        <div className="mon-territorial-source-title">
          <span><DatabaseZap size={15} /> Fuentes territoriales</span>
          <strong>{activeAssetName || "Formulario Kobo por definir"}</strong>
          <em>{sourceOperationalStatus}{sourceReceivedCount ? ` · ${fmt(sourceReceivedCount)} respuestas recibidas` : ""}</em>
        </div>
        <div className="mon-territorial-source-top-metrics" aria-label="Resumen de fuente">
          <span><strong>{fmt(alignedDistricts.length)}</strong><em>alineados</em></span>
          <span><strong>{fmt(sourceReceivedCount)}</strong><em>recibidas</em></span>
          <span><strong>{sourceEffectiveCount == null ? "S/D" : fmt(sourceEffectiveCount)}</strong><em>pasan filtro</em></span>
        </div>
        <button type="button" className="pulso-button is-primary" onClick={() => { void syncKobo(); }} disabled={saving || busy || !koboSource?.id}>
          {saving ? <Loader2 size={14} className="pulso-spin" /> : <RefreshCw size={14} />}
          <span>Actualizar {phaseLabel(phase)}</span>
        </button>
      </section>

      {activeTab !== "form" && activePhaseHealth ? (
        <div className={`mon-territorial-source-status is-${territorialPhaseStatusTone(activePhaseHealth)} is-${activePhaseHealth.status}`}>
          <span>{territorialPhaseBadgeLabel(activePhaseHealth)}</span>
          <strong>{territorialPhaseStatusLabel(activePhaseHealth, phase)}</strong>
          <em>{fmt(activePhaseHealth.snapshot_total_rows)} filas locales</em>
        </div>
      ) : null}

      {activeTab === "form" ? (
        <div className="mon-territorial-source-workgrid is-single">
          <section className="mon-territorial-phase-source-strip" aria-label="Formularios por fase">
            {phaseCards.map((item) => (
              <button
                key={item.phase}
                type="button"
                className={`${phase === item.phase ? "is-active" : ""} ${item.assetUid ? "is-ready" : "is-warning"}`}
                onClick={() => { void switchPhase(item.phase); }}
                disabled={saving || busy}
              >
                <span>
                  <strong>{item.label}</strong>
                  <em>{item.hint}</em>
                </span>
                <i>{item.assetUid ? "Definido" : "Pendiente"}</i>
                <small>{item.assetUid ? `${shortenMiddle(item.name, 38)} · ${fmt(item.health?.local_rows ?? 0)} locales` : "Selecciona un formulario Kobo"}</small>
              </button>
            ))}
          </section>

          <section className={`mon-territorial-source-card mon-territorial-route-sheet-source is-${connectedRouteSheet ? routeSheet?.headers_ok === false ? "warning" : "ready" : "missing"}`} aria-label="Hoja de ruta operativa">
            <header>
              <span><Route size={14} /> Hoja de ruta operativa</span>
              <strong>{connectedRouteSheet ? routeSheet?.headers_ok === false ? "Revisar encabezados" : "Conectada" : "Opcional"}</strong>
            </header>
            <div className="mon-territorial-route-sheet-source-body">
              <div className="mon-territorial-route-sheet-source-copy">
                <strong>{routeSheetSource?.label || "Conecta la Google Sheet de Hojas de Ruta"}</strong>
                <em>{routeSheetSource?.last_sync_at ? `Actualizada ${formatDate(routeSheetSource.last_sync_at)}` : "Rol hoja_ruta · Hojas_de_ruta · encabezado fila 6"}</em>
              </div>
              <div className="mon-territorial-route-sheet-source-metrics" aria-label="Resumen de hoja de ruta">
                <span><strong>{fmt(routeSheetMetrics?.assignments ?? 0)}</strong><em>asignaciones</em></span>
                <span className={(routeSheetMetrics?.assigned_without_response ?? 0) ? "is-warning" : ""}><strong>{fmt(routeSheetMetrics?.assigned_without_response ?? 0)}</strong><em>sin primera encuesta</em></span>
                <span className={(routeSheetMetrics?.wrong_ump_candidates ?? 0) ? "is-warning" : ""}><strong>{fmt(routeSheetMetrics?.wrong_ump_candidates ?? 0)}</strong><em>UMP sospechosa</em></span>
                <span className={(routeSheetMetrics?.wrong_code_candidates ?? 0) ? "is-warning" : ""}><strong>{fmt(routeSheetMetrics?.wrong_code_candidates ?? 0)}</strong><em>Código Pulso</em></span>
              </div>
              <div className="mon-territorial-route-sheet-source-form">
                <label>
                  <span>Spreadsheet</span>
                  <input value={sheetSpreadsheetId} onChange={(event) => setSheetSpreadsheetId(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." disabled={saving || busy} />
                </label>
                <label>
                  <span>Rango</span>
                  <input value={sheetRange} onChange={(event) => setSheetRange(event.target.value)} placeholder="Opcional" disabled={saving || busy} />
                </label>
                <button type="button" onClick={() => { void saveRouteSheet(); }} disabled={saving || busy} title={connectedRouteSheet ? "Actualizar enlace" : "Conectar"}>
                  {saving ? <Loader2 size={13} className="pulso-spin" /> : <Save size={13} />}
                  <span>{connectedRouteSheet ? "Actualizar" : "Conectar"}</span>
                </button>
                <button type="button" className="is-primary" onClick={() => { void syncRouteSheet(); }} disabled={saving || busy || !routeSheetSource?.id} title="Sincronizar">
                  {saving ? <Loader2 size={13} className="pulso-spin" /> : <RefreshCw size={13} />}
                  <span>Sincronizar</span>
                </button>
                {sheetSpreadsheetId ? (
                  <a href={sheetSpreadsheetId.startsWith("http") ? sheetSpreadsheetId : `https://docs.google.com/spreadsheets/d/${sheetSpreadsheetId}/edit`} target="_blank" rel="noopener noreferrer" title="Abrir Spreadsheet">
                    <ExternalLink size={13} />
                  </a>
                ) : null}
              </div>
              {routeSheet?.warnings?.[0]?.message || routeSheet?.reason ? (
                <div className="mon-territorial-route-sheet-source-note is-warning">{routeSheet.warnings?.[0]?.message || routeSheet.reason}</div>
              ) : null}
            </div>
          </section>

          {formReady && !showFormList ? (
            <section className="mon-territorial-source-card mon-territorial-form-picker is-selected" aria-label="Formulario Kobo territorial aplicado">
              <header>
                <span><DatabaseZap size={14} /> Formulario {phase === "field" ? "campo" : "piloto"}</span>
                <strong>Definido</strong>
              </header>
              <div className="mon-territorial-form-detail">
                <div className="mon-territorial-form-summary-row">
                  <div className="mon-territorial-form-detail-main">
                    <div>
                      <strong>{activeAssetName || "Formulario Kobo seleccionado"}</strong>
                      <em>{sourceReadinessMessage}</em>
                    </div>
                    <span className={`is-${sourceReadinessTone}`}>{sourceOperationalStatus}</span>
                  </div>
                  <div className="mon-territorial-form-actions" aria-label="Acciones del formulario aplicado">
                    <button
                      type="button"
                      onClick={() => {
                        setShowFormList(true);
                        if (!assetsLoaded) void loadAssets();
                      }}
                      disabled={saving || busy}
                    >
                      <Search size={13} />
                      <span>Cambiar formulario</span>
                    </button>
                    <button type="button" onClick={() => { void inspectKobo(); }} disabled={saving || busy || !activeAssetUid}>
                      {saving ? <Loader2 size={13} className="pulso-spin" /> : <RefreshCw size={13} />}
                      <span>Actualizar ficha</span>
                    </button>
                  </div>
                </div>
                <div className="mon-territorial-form-kpi-grid" aria-label="Estado operativo de la fuente">
                  <TerritorialSourceMetric label="Distritos alineados" value={`${fmt(alignedDistricts.length)} de ${fmt(routeDistrictTotal)}`} hint={alignedDistricts.length >= routeDistrictTotal ? "Hojas de Ruta y Kobo coinciden" : "Revisar cobertura territorial"} progress={districtCrossPct ?? 0} tone={alignedDistricts.length >= routeDistrictTotal ? "ready" : "warning"} />
                  <TerritorialSourceMetric label="Respuestas recibidas" value={fmt(responseCount)} hint={koboSource?.last_sync_at ? `Actualizado ${formatDate(koboSource.last_sync_at)}` : "Sin actualización reciente"} progress={responseCount ? 100 : 0} tone={responseCount ? "base" : "warning"} />
                  <TerritorialSourceMetric label="Respuestas que pasan el filtro" value={sourceEffectiveCount == null ? "Por definir" : fmt(sourceEffectiveCount)} hint={filterConfigured ? `${effectivePct == null ? "S/D" : `${effectivePct}%`} del corte` : "Define el corte operativo"} progress={effectivePct ?? 0} tone={filterConfigured ? "ready" : "warning"} />
                  <TerritorialSourceMetric label="Formulario leído" value={surveyQuestionCount == null ? "Pendiente" : `${fmt(surveyQuestionCount)} preguntas`} hint={surveyChoiceCount == null ? `Inspección ${formatDate(sourceCoherence?.date_modified)}` : `${fmt(surveyChoiceCount)} opciones disponibles`} progress={schemaHealthPct} tone={surveyQuestionCount ? "ready" : "warning"} />
                </div>
                <div className={`mon-territorial-form-readiness is-${sourceReadinessTone}`} aria-label="Preparación de la fuente">
                  {sourceReadinessTone === "ready" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                  <div>
                    <strong>{sourceOperationalStatus}</strong>
                    <em>{sourceReadinessMessage}</em>
                  </div>
                  <span>{filterConfigured ? "Corte definido" : "Corte pendiente"}</span>
                </div>
              </div>
            </section>
          ) : null}

          {(!formReady || showFormList) ? (
          <section className="mon-territorial-source-card" aria-label="Formulario Kobo territorial">
            <header>
              <span><DatabaseZap size={14} /> Formulario Kobo</span>
              <strong>{formReady ? "Configurado" : "Pendiente"}</strong>
            </header>
            <dl>
              <div><dt>Asset Kobo</dt><dd>{activeAssetUid ? shortenMiddle(activeAssetUid, 42) : "Sin asset definido"}</dd></div>
              <div><dt>Nombre</dt><dd>{activeAssetName || "Sin nombre"}</dd></div>
              <div><dt>Versión</dt><dd>{activeVersion || "Sin versión"}</dd></div>
              <div><dt>Modificación</dt><dd>{formatDate(sourceCoherence?.date_modified)}</dd></div>
              <div><dt>Source ID</dt><dd>{phaseSource?.source_id || koboSource?.id || "Sin source_id"}</dd></div>
            </dl>
            <div className="mon-territorial-source-search">
              <input value={assetQuery} onChange={(event) => setAssetQuery(event.target.value)} placeholder={`Buscar formulario Kobo para ${phaseLabel(phase).toLowerCase()}...`} />
              <button type="button" onClick={() => { void loadAssets(); }} disabled={assetsLoading || saving || busy} title="Actualizar listado">
                {assetsLoading ? <Loader2 size={14} className="pulso-spin" /> : <Search size={14} />}
              </button>
            </div>
            <div className="mon-territorial-asset-filters" aria-label="Filtros de formulario Kobo">
              <button type="button" className={assetFilter === "all" ? "is-active" : ""} onClick={() => setAssetFilter("all")}>Todos</button>
              <button type="button" className={assetFilter === "active" ? "is-active" : ""} onClick={() => setAssetFilter("active")}>Desplegados</button>
            </div>
            {assetError ? <div className="mon-territorial-route-sheet-source-note is-error">{assetError}</div> : null}
            <div className="mon-territorial-asset-list">
              {filteredAssets.length ? filteredAssets.map((asset) => {
                const active = asset.uid === activeAssetUid;
                const pending = asset.uid === pendingAssetUid && !active;
                return (
                  <article key={asset.uid} className={active ? "is-active" : pending ? "is-pending" : ""}>
                    <div>
                      <strong>{asset.name}</strong>
                      <em>{shortenMiddle(asset.uid, 34)} · {asset.version_id || "sin versión"} · {formatDate(asset.date_modified)}</em>
                    </div>
                    <span className={active ? "is-ready" : pending ? "is-warning" : ""}>{active ? "Aplicado" : pending ? "Pendiente" : asset.deployment_active ? "Desplegado" : "Inactivo"}</span>
                    <button type="button" onClick={() => active ? setPendingAssetUid("") : setPendingAssetUid(asset.uid)} disabled={saving || busy}>
                      <CheckCircle2 size={13} />
                      <span>{active ? "Aplicado" : pending ? "Pendiente" : "Elegir"}</span>
                    </button>
                  </article>
                );
              }) : (
                <div className="mon-territorial-source-empty">
                  {assetsLoading ? "Leyendo formularios Kobo..." : !assetsLoaded ? "Carga el listado de formularios Kobo para elegir una fuente." : "No hay formularios para esta búsqueda."}
                  {!assetsLoading && !assetsLoaded ? (
                    <button type="button" onClick={() => { void loadAssets(); }} disabled={saving || busy}>
                      <RefreshCw size={13} />
                      <span>Cargar listado</span>
                    </button>
                  ) : null}
                </div>
              )}
            </div>
            {pendingAsset ? (
              <div className="mon-territorial-form-apply">
                <div>
                  <strong>{pendingAsset.name}</strong>
                  <em>{shortenMiddle(pendingAsset.uid, 36)}{pendingAsset.version_id ? ` · ${pendingAsset.version_id}` : ""}</em>
                </div>
                <button type="button" className="pulso-button is-primary" onClick={() => { void applyAsset(pendingAsset); }} disabled={saving || busy}>
                  {saving ? <Loader2 size={13} className="pulso-spin" /> : <Save size={13} />}
                  <span>Aplicar a {phaseLabel(phase)}</span>
                </button>
              </div>
            ) : null}
          </section>
          ) : null}
          <section className="mon-territorial-source-card" aria-label="Acciones de formulario Kobo">
            <header>
              <span><RefreshCw size={14} /> Inspección y sincronización</span>
              <strong>{koboSource?.last_sync_at ? formatDate(koboSource.last_sync_at) : "Sin sync local"}</strong>
            </header>
            <div className="mon-territorial-source-stats">
              <span><strong>{sourceCoherence?.deployment_active === false ? "Inactivo" : "Activo"}</strong><em>despliegue</em></span>
              <span><strong>{fmt(sourceCoherence?.choices_count, "S/D")}</strong><em>choices</em></span>
              <span><strong>{fmt(sourceCoherence?.drift?.length ?? 0)}</strong><em>alertas</em></span>
            </div>
            <div className="mon-territorial-source-card-actions">
              <button type="button" className="pulso-button" onClick={() => { void inspectKobo(); }} disabled={saving || busy || !activeAssetUid}>
                {saving ? <Loader2 size={14} className="pulso-spin" /> : <FileCheck2 size={14} />}
                <span>Inspeccionar Kobo</span>
              </button>
              <button type="button" className="pulso-button is-primary" onClick={() => { void syncKobo(); }} disabled={saving || busy || !koboSource?.id}>
                {saving ? <Loader2 size={14} className="pulso-spin" /> : <RefreshCw size={14} />}
                <span>Sincronizar respuestas</span>
              </button>
            </div>
            {syncJob ? (
              <div className="mon-territorial-route-sheet-source-note is-ready">
                <div>
                  Job {syncJob.id}: {syncJob.status} · {jobProgressText(syncJob) || "en cola"}
                  {syncProgressPercent == null ? null : ` · ${syncProgressPercent}%`}
                </div>
                {syncProgressPercent == null ? null : (
                  <div className="mon-territorial-source-progress" aria-label={`Progreso ${syncProgressPercent}%`}>
                    <span style={{ width: `${syncProgressPercent}%` }} />
                  </div>
                )}
              </div>
            ) : null}
            {sourceCoherence?.drift?.length ? (
              <div className="mon-territorial-alert-list">
                {sourceCoherence.drift.slice(0, 6).map((alert) => (
                  <span key={alert.code} className={alert.severity === "error" ? "is-warning" : "is-base"}>
                    <AlertTriangle size={13} />
                    {alert.message}
                  </span>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {activeTab === "filter" && mapping ? (
        <div className="mon-territorial-source-workgrid mon-territorial-source-workgrid--filter">
          <section className="mon-territorial-source-card mon-territorial-filter-config-summary" aria-label="Configuracion operativa del formulario">
            <header>
              <span><SlidersHorizontal size={14} /> Configuración operativa del formulario</span>
              <strong>{phaseLabel(phase)} · {activeAssetName || "Formulario territorial"}</strong>
            </header>
            <p>
              <span>{fmt(sourceReceivedCount)} respuestas locales · {sourceEffectiveCount == null ? "sin corte calculado" : `${fmt(sourceEffectiveCount)} efectivas`} · {fmt(alignedDistricts.length)} distritos cruzados</span>
              <small>{activeAssetUid ? `${shortenMiddle(activeAssetUid, 48)} · ${activeVersion || "sin versión"}` : "Sin asset aplicado"}</small>
            </p>
            <div className={`mon-territorial-filter-config-state is-${validFilterValues.length && alignedDistricts.length ? "ready" : "warning"}`}>
              <span>{validFilterValues.length && alignedDistricts.length ? "Definido" : "Revisar"}</span>
              <strong>{validFilterValues.length ? "Configuración revisada" : "Configuración pendiente"}</strong>
              <em>{validFilterValues.length ? "Variables, ruta y respuestas locales cruzan para esta fase." : "Completa la pregunta y valor del filtro efectivo."}</em>
            </div>
            <div className="mon-territorial-filter-config-actions">
              <button type="button" onClick={selectAllBatchRecommendations} disabled={saving || busy || !batchRecommendations.length}>
                <RefreshCw size={13} />
                <span>Usar sugerencias</span>
              </button>
              <button type="button" onClick={clearBatchRecommendations} disabled={saving || busy || !selectedBatchIds.size}>
                <XCircle size={13} />
                <span>Descartar cambios</span>
              </button>
              <button type="button" onClick={() => { void saveMapping({}); }} disabled={saving || busy}>
                {saving ? <Loader2 size={13} className="pulso-spin" /> : <Save size={13} />}
                <span>Guardar configuración</span>
              </button>
              <small>Datos locales: {formatDate(state?.synced_at)}</small>
            </div>
          </section>

          <section className="mon-territorial-source-card" aria-label="Variables territoriales">
            <header>
              <span><SlidersHorizontal size={14} /> Variables territoriales</span>
              <strong>{readiness.slice(1).every((item) => item.ready) ? "Definidas" : "Revisar"}</strong>
            </header>
            <div className="mon-territorial-source-checklist">
              {readiness.slice(1).map((item) => (
                <span key={item.key} className={item.ready ? "is-ready" : "is-warning"}>
                  <b>{item.label}</b>
                  <em>{item.detail}</em>
                  <i>{item.ready ? "Listo" : item.warning ? "Revisar" : "Pendiente"}</i>
                </span>
              ))}
            </div>
            <div className="mon-territorial-operational-layout" aria-label="Variables operativas">
              {[
                ["district_var", "Distrito", MapPin],
                ["ump_var", "UMP / manzana", Route],
                ["pulso_code_var", "Código Pulso", ContactRound],
                ["gps_var", "Geolocalización", MapPin],
                ["age_var", "Edad", Table2],
                ["sex_var", "Sexo", Table2],
                ["platform_effective_var", "Pregunta filtro", FileCheck2],
              ].map(([key, label, Icon]) => (
                <label key={key as string} className="mon-territorial-source-field">
                  <span><Icon size={13} /> {label as string}</span>
                  <select
                    value={String(mapping[key as keyof MonitoreoTerritorialPhaseMapping] ?? "")}
                    disabled={saving || busy}
                    onChange={(event) => {
                      const value = event.target.value;
                      void saveMapping({ [key as keyof MonitoreoTerritorialPhaseMapping]: value } as Partial<MonitoreoTerritorialPhaseMapping>);
                    }}
                  >
                    <option value="">Por definir</option>
                    {options.map((option) => <option key={`${key}-${option.name}`} value={option.name}>{option.label} · {option.type || "campo"}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </section>
          <section className="mon-territorial-source-card" aria-label="Regla de encuesta efectiva">
            <header>
              <span><FileCheck2 size={14} /> Encuesta efectiva</span>
              <strong>{sourceValidity?.effective_count == null ? "Pendiente" : `${fmt(sourceValidity.effective_count)} efectivas`}</strong>
            </header>
            <div className="mon-territorial-source-cut-counts">
              <span><b>{fmt(sourceValidity?.total_responses ?? 0)}</b><em>respuestas</em></span>
              <span><b>{fmt(sourceValidity?.effective_count, "S/D")}</b><em>efectivas</em></span>
              <span className="is-warning"><b>{fmt(sourceValidity?.non_effective_count, "S/D")}</b><em>no efectivas</em></span>
              <span><b>{fmt(sourceValidity?.missing_count, "S/D")}</b><em>sin dato</em></span>
            </div>
            <label className="mon-territorial-source-field">
              <span>Valor válido para {selectedOptionLabel(variables, mapping.platform_effective_var)}</span>
              <select
                value={validFilterValues[0] ?? ""}
                disabled={saving || busy || !mapping.platform_effective_var}
                onChange={(event) => {
                  const value = event.target.value;
                  void saveMapping({ platform_effective_values: value ? [value] : [] });
                }}
              >
                <option value="">Por definir</option>
                {(sourceValidity?.options ?? []).map((option) => (
                  <option key={option.value} value={option.value}>{option.label || option.value}{option.count != null ? ` · ${fmt(option.count)}` : ""}</option>
                ))}
                {!sourceValidity?.options?.length && variables.find((variable) => variable.name === mapping.platform_effective_var)?.values?.slice(0, 80).map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
            <div className="mon-territorial-source-coverage-summary">
              {(sourceCoherence?.district_choices ?? []).slice(0, 12).map((district) => (
                <span key={district.name} className={config.territorial.district_crosswalk.some((row) => row.kobo_code === district.name) ? "" : "is-warning"}>
                  <strong>{district.name}</strong>
                  <em>{district.label}</em>
                </span>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "roster" ? (
        <div className="mon-territorial-source-workgrid is-single">
          <section className="mon-territorial-source-card mon-territorial-enumerator-roster is-roster" aria-label="Encuestadores y códigos Pulso">
            <header>
              <span><ContactRound size={14} /> Encuestadores y códigos Pulso</span>
              <strong>{rosterAssignments.length ? `${fmt(rosterAssignments.length)} asignados` : "Por definir"}</strong>
            </header>
            <div className="mon-territorial-enumerator-layout">
              <div className="mon-territorial-enumerator-command">
                <div className="mon-territorial-enumerator-state">
                  <span><ContactRound size={18} /></span>
                  <div>
                    <strong>{roster?.file_name || "Subir Excel de encuestadores"}</strong>
                    <em>{roster?.uploaded_at ? `${formatDate(roster.uploaded_at)} · formato ${roster.code_format || rosterFormat}` : "Usa AP PATERNO, AP MATERNO y NOMBRES."}</em>
                  </div>
                </div>
                <div className="mon-territorial-enumerator-fieldchips" aria-label="Campos de cruce Kobo">
                  <span><strong>{mapping?.pulso_code_var || roster?.code_var || "codigo_pulso"}</strong><em>código Pulso</em></span>
                  <span><strong>{mapping?.ump_var || roster?.ump_var || "ump"}</strong><em>UMP / manzana</em></span>
                </div>
                <div className="mon-territorial-enumerator-mode" aria-label="Formato de código Pulso">
                  <span>Tipo de código</span>
                  <div>
                    {(["PXXX", "DNI"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={rosterFormat === mode ? "is-active" : ""}
                        onClick={() => setRosterFormat(mode)}
                        disabled={saving || busy}
                      >
                        {mode === "DNI" ? "DNI del Excel" : "PXXX aleatorio"}
                      </button>
                    ))}
                  </div>
                  <em>{rosterFormat === "DNI" ? "Requiere columna DNI completa y sin duplicados." : "Genera códigos aleatorios y conserva los ya asignados."}</em>
                </div>
                <p>
                  Estos códigos identifican al responsable cuando Kobo trae el campo abierto de código Pulso. Deben copiarse exactamente; con PXXX se conservan los ya asignados y con DNI se usa el documento del Excel.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  hidden
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0] ?? null;
                    setRosterFile(file);
                    if (file) void uploadRoster(file);
                  }}
                />
                <div className="mon-territorial-enumerator-actions">
                  <button type="button" className="pulso-button" onClick={() => { void downloadRosterTemplate(); }} disabled={saving || busy}>
                    <Download size={15} />
                    <span>Plantilla Excel</span>
                  </button>
                  <button type="button" className="pulso-button is-code-download" onClick={() => { void downloadRosterCodes(); }} disabled={saving || busy || !rosterAssignments.length}>
                    <Download size={15} />
                    <span>Descargar códigos</span>
                  </button>
                  <button type="button" className="pulso-button" onClick={() => fileInputRef.current?.click()} disabled={saving || busy}>
                    {saving && rosterFile ? <Loader2 size={15} className="pulso-spin" /> : <Upload size={15} />}
                    <span>{rosterAssignments.length ? "Actualizar Excel" : "Subir Excel"}</span>
                  </button>
                </div>
              </div>

              <div className="mon-territorial-enumerator-table" aria-label="Asignaciones de código Pulso">
                {rosterAssignments.length ? (
                  <>
                    <div className="mon-territorial-enumerator-table-toolbar">
                      <label>
                        <Search size={13} />
                        <input
                          value={rosterSearch}
                          onChange={(event) => setRosterSearch(event.currentTarget.value)}
                          placeholder="Buscar encuestador por nombre, código o estado"
                        />
                      </label>
                      <span>{fmt(filteredRosterCodeRows.length)} / {fmt(rosterCodeRows.length)} visibles</span>
                      {rosterSearch ? (
                        <button type="button" onClick={() => setRosterSearch("")}>
                          <XCircle size={13} />
                          <span>Limpiar</span>
                        </button>
                      ) : null}
                    </div>
                    <table>
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Encuestador</th>
                          <th>Respuestas</th>
                          <th>Último</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRosterCodeRows.length ? filteredRosterCodeRows.slice(0, 80).map((row) => (
                          <tr key={`${row.code}-${row.name}`}>
                            <td><span>{row.code}</span></td>
                            <td>{row.name}</td>
                            <td>
                              {fmt(row.response_count ?? 0)}
                              {(row.reconciled_response_count ?? 0) > 0 ? <em>+{fmt(row.reconciled_response_count)} reconciliadas</em> : null}
                            </td>
                            <td>{row.last_record || "S/D"}</td>
                            <td><b className={`is-${assignedStatusTone(row)}`}>{assignedStatusLabel(row)}</b></td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={5}>No hay encuestadores con esos filtros.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </>
                ) : (
                  <div className="mon-territorial-enumerator-empty">
                    <Upload size={22} />
                    <strong>Roster pendiente</strong>
                    <em>Sube un Excel con apellidos y nombres para generar códigos aleatorios PXXX.</em>
                    <div>
                      <span>AP PATERNO</span>
                      <span>AP MATERNO</span>
                      <span>NOMBRES</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "reconciliation" ? (
        <div className="mon-territorial-source-workgrid is-single mon-territorial-source-workgrid--reconciliation">
          <section className="mon-territorial-source-card mon-territorial-reconciliation-console" aria-label="Reconciliación UMP y Código Pulso">
            <header>
              <span><Link2 size={14} /> Lote de reconciliación</span>
              <strong>{batchStatusTitle}</strong>
            </header>
            <div className={`mon-territorial-reconciliation-batchbar ${selectedBatchRecommendations.length ? "is-active" : ""}${hasBatchRecommendations ? "" : " is-empty"}`} aria-label="Aplicación por lote de reconciliación">
              <div className="mon-territorial-reconciliation-batchcopy">
                <span><Link2 size={13} /> Lote canónico</span>
                <strong>{batchStatusTitle}</strong>
                <em>{batchStatusDetail}</em>
              </div>
              <div className="mon-territorial-reconciliation-batchrail">
                <div className="mon-territorial-reconciliation-batchcounts">
                  <span><strong>{fmt(batchCodeCount)}</strong><em>código</em></span>
                  <span><strong>{fmt(batchUmpCount)}</strong><em>UMP</em></span>
                </div>
                {hasBatchRecommendations ? (
                  <div className="mon-territorial-reconciliation-batchactions">
                    <button type="button" onClick={selectAllBatchRecommendations} disabled={saving || busy || batchApplying || !batchRecommendations.length}>
                      Todas
                    </button>
                    <button type="button" onClick={clearBatchRecommendations} disabled={saving || busy || batchApplying || !selectedBatchRecommendations.length}>
                      Limpiar
                    </button>
                    <button type="button" className="is-primary" onClick={() => { void applyBatchReconciliation(); }} disabled={saving || busy || batchApplying || !selectedBatchRecommendations.length}>
                      {batchApplying ? <Loader2 size={13} className="pulso-spin" /> : <CheckCircle2 size={13} />}
                      <span>Aplicar</span>
                    </button>
                  </div>
                ) : (
                  <div className="mon-territorial-reconciliation-batchstate">
                    <CheckCircle2 size={13} />
                    <span>Revisión manual</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mon-territorial-reconciliation-panels">
              <section className="mon-territorial-reconciliation-panel is-code" aria-label="Códigos Pulso por revisar">
                <header>
                  <span><ContactRound size={14} /> Códigos Pulso</span>
                  <strong>{fmt(codeSummary?.unrecognized_response_count ?? codeSummary?.unrecognized_code_count ?? 0)} por revisar</strong>
                </header>
                <div className="mon-territorial-reconciliation-metrics">
                  <span><strong>{fmt(codeSummary?.roster_total ?? rosterAssignments.length)}</strong><em>códigos reconocidos</em></span>
                  <span><strong>{fmt(codeSummary?.response_code_count ?? 0)}</strong><em>códigos en base</em></span>
                  <span><strong>{fmt(codeSummary?.auto_recognized_response_count ?? codeSummary?.auto_recognized_code_count ?? 0)}</strong><em>auto</em></span>
                  <span><strong>{fmt(codeSummary?.reconciled_response_count ?? codeSummary?.reconciled_code_count ?? 0)}</strong><em>manual</em></span>
                  <span className={(codeSummary?.unrecognized_response_count ?? 0) ? "is-warning" : ""}><strong>{fmt(codeSummary?.unrecognized_response_count ?? 0)}</strong><em>revisar</em></span>
                  <span><strong>{fmt(codeSummary?.missing_response_count ?? 0)}</strong><em>sin código</em></span>
                </div>
                <div className="mon-territorial-reconciliation-list">
                  {codeReviewRows.length ? codeReviewRows.map((row, index) => {
                    const recommendationId = codeBatchIndex.get(row.response_id ? `response:${row.response_id}` : "")
                      ?? codeBatchIndex.get(row.raw_code ? `raw:${row.raw_code}` : "")
                      ?? codeBatchIndex.get(row.normalized_code ? `normalized:${row.normalized_code}` : "")
                      ?? codeBatchIndex.get(row.code ? `normalized:${row.code}` : "");
                    const isSelected = recommendationId ? selectedBatchIds.has(recommendationId) : false;
                    const tone = row.reconciled || row.assigned_code ? "ready" : "warning";
                    const rowKey = `${row.response_id || index}-${row.raw_code || row.normalized_code || row.code}`;
                    const rowContent = (
                      <>
                        <span>{isSelected ? "Seleccionada" : recommendationId ? "Sugerida" : row.reconciled || row.assigned_code ? "Asignada" : "Por revisar"}</span>
                        <strong>{row.raw_code || row.normalized_code || row.code || "S/D"}</strong>
                        <em>{row.ump || "UMP S/D"} · {row.district || "Distrito S/D"}</em>
                        <small>{row.assigned_code ? `${row.assigned_code} · ${row.assigned_name || "asignada"}` : recommendationId ? "Lista para lote canónico" : "Sin asignación guardada"}</small>
                      </>
                    );
                    if (!recommendationId) {
                      return (
                        <article key={rowKey} className={`is-${tone}`}>
                          {rowContent}
                        </article>
                      );
                    }
                    return (
                    <button
                      key={rowKey}
                      type="button"
                      className={`mon-territorial-reconciliation-row is-${tone}${recommendationId ? " is-recommended" : ""}${isSelected ? " is-selected" : ""}`}
                      onClick={() => { if (recommendationId) toggleBatchRecommendation(recommendationId); }}
                      disabled={saving || busy || batchApplying}
                    >
                      {rowContent}
                    </button>
                    );
                  }) : (
                    <div className="mon-territorial-source-empty">Sin códigos pendientes.</div>
                  )}
                </div>
              </section>

              <section className="mon-territorial-reconciliation-panel is-ump" aria-label="UMP declaradas por revisar">
                <header>
                  <span><Route size={14} /> UMP exacta</span>
                  <strong>{fmt(umpSummary?.metrics?.review_ump_count ?? 0)} por revisar</strong>
                </header>
                <div className="mon-territorial-reconciliation-metrics">
                  <span><strong>{fmt(umpSummary?.metrics?.recognized_ump_count ?? 0)}</strong><em>UMP exactas</em></span>
                  <span><strong>{fmt(umpSummary?.metrics?.reconciled_ump_count ?? 0)}</strong><em>UMP reconciliadas</em></span>
                  <span className={(umpSummary?.metrics?.review_ump_count ?? 0) ? "is-warning" : ""}><strong>{fmt(umpSummary?.metrics?.review_ump_count ?? 0)}</strong><em>UMP por revisar</em></span>
                  <span><strong>{fmt(umpSummary?.metrics?.responses_with_ump ?? 0)}</strong><em>respuestas con UMP</em></span>
                  <span><strong>{fmt(umpSummary?.metrics?.responses_without_ump ?? 0)}</strong><em>sin UMP</em></span>
                </div>
                <div className="mon-territorial-reconciliation-list">
                  {umpReviewRows.length ? umpReviewRows.map((row, index) => {
                    const assignedUmp = row.assigned_ump || row.route_blocks?.[0]?.route_ump || "";
                    const recommendationId = umpBatchIndex.get(row.response_id ? `response:${row.response_id}` : "")
                      ?? umpBatchIndex.get(row.raw_ump ? `raw:${row.raw_ump}` : "")
                      ?? umpBatchIndex.get(row.normalized_ump ? `raw:${row.normalized_ump}` : "")
                      ?? umpBatchIndex.get(assignedUmp ? `assigned:${assignedUmp}` : "")
                      ?? umpBatchIndex.get(row.assigned_block_id ? `block:${row.assigned_block_id}` : "")
                      ?? umpBatchIndex.get(row.raw_ump && assignedUmp ? `pair:${row.raw_ump}->${assignedUmp}` : "");
                    const isSelected = recommendationId ? selectedBatchIds.has(recommendationId) : false;
                    const tone = declaredUmpStatusTone(row.status);
                    const rowKey = `${row.raw_ump || index}-${row.response_id || row.status}`;
                    const rowContent = (
                      <>
                        <span>{isSelected ? "Seleccionada" : recommendationId ? "Sugerida" : declaredUmpStatusLabel(row.status)}</span>
                        <strong>{row.raw_ump || row.normalized_ump || "UMP S/D"}</strong>
                        <em>{assignedUmp || "Sin ruta asignada"} · {row.assigned_district || row.route_blocks?.[0]?.distrito || "Distrito S/D"}</em>
                        <small>{fmt(row.response_count)} respuestas · {recommendationId ? "lista para lote" : row.responsible || row.assigned_responsible || row.route_blocks?.[0]?.responsable || "Sin responsable"}</small>
                      </>
                    );
                    if (!recommendationId) {
                      return (
                        <article key={rowKey} className={`is-${tone}`}>
                          {rowContent}
                        </article>
                      );
                    }
                    return (
                    <button
                      key={rowKey}
                      type="button"
                      className={`mon-territorial-reconciliation-row is-${tone}${recommendationId ? " is-recommended" : ""}${isSelected ? " is-selected" : ""}`}
                      onClick={() => { if (recommendationId) toggleBatchRecommendation(recommendationId); }}
                      disabled={saving || busy || batchApplying}
                    >
                      {rowContent}
                    </button>
                    );
                  }) : (
                    <div className="mon-territorial-source-empty">Sin UMP pendientes.</div>
                  )}
                </div>
                <aside className="mon-territorial-reconciliation-queue" aria-label="Bandeja de revisión de UMP">
                  <div className="mon-territorial-reconciliation-queue-head">
                    <span><SlidersHorizontal size={13} /> Cola UMP</span>
                    <strong>{fmt(umpSummary?.metrics?.review_ump_count ?? 0)} pendientes</strong>
                  </div>
                  <div className="mon-territorial-reconciliation-queue-metrics">
                    <span><strong>{fmt(umpAcceptedCount)}</strong><em>listas</em></span>
                    <span className={umpRowsWithoutRoute.length ? "is-warning" : ""}><strong>{fmt(umpRowsWithoutRoute.length)}</strong><em>sin ruta</em></span>
                    <span className={(umpSummary?.metrics?.responses_without_ump ?? 0) ? "is-warning" : ""}><strong>{fmt(umpSummary?.metrics?.responses_without_ump ?? 0)}</strong><em>sin UMP</em></span>
                    <span className={batchUmpCount ? "is-primary" : ""}><strong>{fmt(batchUmpCount)}</strong><em>sugeridas</em></span>
                  </div>
                  <div className="mon-territorial-reconciliation-queue-list">
                    {umpManualPreviewRows.length ? umpManualPreviewRows.map((row, index) => {
                      const assignedUmp = row.assigned_ump || row.route_blocks?.[0]?.route_ump || "";
                      const district = row.assigned_district || row.route_blocks?.[0]?.distrito || "Distrito S/D";
                      return (
                        <span key={`${row.raw_ump || "missing"}-${row.response_id || index}`}>
                          <strong>{row.raw_ump || row.normalized_ump || "UMP S/D"}</strong>
                          <em>{declaredUmpReviewReason(row)}</em>
                          <small>{assignedUmp || "Sin ruta"} · {district}</small>
                        </span>
                      );
                    }) : (
                      <span className="is-empty">
                        <strong>Sin cola manual</strong>
                        <em>Todo exacto</em>
                        <small>{fmt(umpRowsWithRouteCandidate.length)} con ruta candidata</small>
                      </span>
                    )}
                  </div>
                </aside>
              </section>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "history" ? (
        <section className="mon-territorial-source-card mon-territorial-history is-standalone" aria-label="Historial de actualizaciones">
          <header>
            <span><Clock size={14} /> Historial de actualizaciones</span>
            <strong>{fmt(history.length)} eventos</strong>
          </header>
          <div className="mon-territorial-history-list">
            {history.length ? history.slice(0, 24).map((entry) => (
              <article key={entry.id || `${entry.type}-${entry.created_at}`}>
                <time>{formatDate(entry.created_at)}</time>
                <div>
                  <strong>{entry.type === "inspect" ? "Inspección" : "Sincronización"}</strong>
                  <em>{entry.asset_name || activeAssetName || "Formulario Kobo"}</em>
                  <small>{entry.version_id || "sin versión"} · {fmt(entry.response_count)} respuestas</small>
                </div>
                <span className={`is-${entry.status === "warning" ? "warning" : entry.status === "error" ? "error" : "ready"}`}>
                  {entry.status === "warning" ? "Alerta" : entry.status === "error" ? "Error" : "OK"}
                </span>
              </article>
            )) : (
              <div className="mon-territorial-source-empty">Todavía no hay inspecciones ni sincronizaciones registradas.</div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function isTerritorialSourceView(view: WorkbenchView, localTab?: string) {
  return view === "fuentes" && isTerritorialSourceTab(localTab ?? "form");
}

function TerritorialSourceMetric({
  label,
  value,
  hint,
  progress,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  progress: number;
  tone: "base" | "ready" | "warning";
}) {
  return (
    <article className={`mon-territorial-source-metric is-${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <em>{hint}</em>
      </div>
      <b aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></b>
    </article>
  );
}
