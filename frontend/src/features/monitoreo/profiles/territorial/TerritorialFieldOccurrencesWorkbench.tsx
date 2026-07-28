import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  ChevronDown,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  FileCheck2,
  Link2,
  Loader2,
  MapPin,
  PlugZap,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import {
  apiConnectionsList,
  apiMonitoreoKoboAssets,
  apiMonitoreoTerritorialOccurrencesConfig,
  apiMonitoreoTerritorialOccurrencesInspect,
  apiMonitoreoTerritorialOccurrencesSync,
  apiMonitoreoTerritorialOccurrencesUploadKobo,
  apiMonitoreoTerritorialOccurrencesXlsform,
  apiMonitoreoTerritorialUmpExport,
  downloadUrl,
  type ConnectionTokenState,
  type MonitoreoFieldOccurrenceConfig,
  type MonitoreoFieldOccurrenceDashboard,
  type MonitoreoFieldOccurrenceFieldCheck,
  type MonitoreoKoboAssetItem,
  type MonitoreoState,
  type MonitoreoTerritorialDashboard,
} from "../../../../api/client";
import { Panel } from "../../../../components/Panel";
import { recorteTabla } from "../../corte/corteContract";
import { OccurrenceSourceBar } from "./TerritorialOccurrencesSourceBar";
import {
  buildOccurrenceDistrictSummary,
  buildOccurrenceRouteUmpRows,
  type OccurrenceDistrictSummary,
  type OccurrenceOutcomeSummary,
  type OccurrenceRouteUmpRow,
  type OccurrenceUmpAttentionReason,
  type OccurrenceUmpAttentionStatus,
} from "../../fieldOccurrences";

type OccurrenceTab = "states" | "distritos" | "registro" | "ump" | "alerts" | "rhythm";
type OccurrenceBusy = "" | "config" | "xlsform" | "upload" | "inspect" | "sync" | "ump-export";
type OccurrenceAlertKind = "missing" | "observations" | "outside_route" | "high_non_effective";
type OccurrenceAlertFilter = "todos" | OccurrenceAlertKind;
type OccurrenceRegisterFilter = "todos" | "con_registro" | "sin_registro" | "sin_conciliacion";

type OccurrenceAlertReviewItem = {
  id: string;
  kind: OccurrenceAlertKind;
  title: string;
  meta: string;
  detail: string;
  value: string;
  searchText: string;
};

type TerritorialFieldOccurrencesWorkbenchProps = {
  pestanaActiva?: string;
  busy?: boolean;
  reports: MonitoreoTerritorialDashboard | null;
  onError?: (message: string) => void;
  onReload?: () => void;
  onStateChange?: (state: MonitoreoState) => void;
};

const EMPTY_OCCURRENCE_SUMMARY: MonitoreoFieldOccurrenceDashboard["summary"] = {
  total_records: 0,
  days_reported: 0,
  responsables: 0,
  manzanas_reportadas: 0,
  efectivas: 0,
  no_efectivas: 0,
  intentos: 0,
  tasa_no_efectiva: null,
};

const OCCURRENCE_STATUS_META: Record<OccurrenceUmpAttentionStatus, { label: string; caption: string }> = {
  revisar_cruce: { label: "Cruce por revisar", caption: "UMP o ruta por confirmar" },
  reportada_no_efectiva: { label: "Con reporte no efectivo", caption: "Resultado registrado" },
  reportada_efectiva: { label: "Con reporte efectivo", caption: "Con efectivas" },
  completa_sin_reporte: { label: "Completa sin reporte", caption: "Cumplio cuota sin ocurrencias" },
  incompleta_sin_reporte: { label: "Incompleta sin reporte", caption: "Avance pendiente sin ocurrencias" },
  iniciada_sin_reporte: { label: "Iniciada sin reporte", caption: "Avance sin ocurrencias" },
  sin_reporte: { label: "Sin reporte", caption: "UMP esperada" },
};

const OCCURRENCE_OUTCOME_COLORS: Record<string, string> = {
  no_queria_participar: "#c2416b",
  vivienda_abandonada_inaccesible: "#7c3aed",
  hogar_migrante_refugiado: "#0e7490",
  hogar_ausente: "#d97706",
  no_cumple_criterios: "#2563eb",
  fuera_cuota: "#9333ea",
  encuesta_inconclusa: "#64748b",
};

const OCCURRENCE_ALERT_META: Record<OccurrenceAlertKind, { label: string; shortLabel: string; empty: string }> = {
  missing: {
    label: "UMP sin reporte",
    shortLabel: "Sin reporte",
    empty: "No hay UMP esperadas sin reporte de ocurrencias.",
  },
  observations: {
    label: "Observaciones",
    shortLabel: "Observ.",
    empty: "No hay observaciones reportadas.",
  },
  outside_route: {
    label: "Fuera de ruta",
    shortLabel: "Fuera ruta",
    empty: "No hay ocurrencias fuera de ruta.",
  },
  high_non_effective: {
    label: "No efectividad alta",
    shortLabel: "No efect.",
    empty: "No hay concentraciones altas de no efectividad.",
  },
};

const OCCURRENCE_REASON_LABELS: Record<OccurrenceUmpAttentionReason, string> = {
  sin_reporte: "Sin reporte",
  iniciada_sin_reporte: "Avance sin ocurrencia",
  completa_sin_reporte: "Cuota completa",
  incompleta_sin_reporte: "Cuota incompleta",
  ump_no_esperada: "UMP no esperada",
  fuera_ruta: "Fuera de ruta",
  multiples_consolidados: "Multiples reportes",
  observacion: "Con observacion",
  motivo_concentrado: "Motivo concentrado",
};

type KoboOccurrenceProfile = {
  id: string;
  alias: string;
  is_default?: boolean;
  has_token?: boolean;
  base_url?: string;
  server_label?: string;
};

const occurrenceAssetCatalogCache = new Map<string, MonitoreoKoboAssetItem[]>();

function formatMetric(value: unknown, fallback = "0") {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (Number.isFinite(n)) return new Intl.NumberFormat("es-PE").format(n);
  return String(value);
}

function formatPercentLabel(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "S/D";
  return `${Math.round(n)}%`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "Sin fecha";
  return date.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

function shortenMiddle(value: string, max = 32) {
  const raw = String(value ?? "");
  if (raw.length <= max) return raw;
  const edge = Math.max(6, Math.floor((max - 3) / 2));
  return `${raw.slice(0, edge)}...${raw.slice(-edge)}`;
}

function normalizeKoboBaseUrl(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin.replace(/\/+$/, "");
  } catch {
    const cleaned = raw
      .split("#")[0]
      .replace(/\/api\/v2.*$/i, "")
      .replace(/\/+$/, "");
    if (!cleaned) return "";
    return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
  }
}

function koboOccurrenceLandingUrl(baseUrl: string, assetUid: string) {
  const base = normalizeKoboBaseUrl(baseUrl) || "https://kf.kobotoolbox.org";
  return `${base}/#/forms/${encodeURIComponent(assetUid)}/landing`;
}

function koboOccurrenceProfiles(connection: ConnectionTokenState | null): KoboOccurrenceProfile[] {
  if (!connection) return [];
  const profiles = (connection.profiles ?? [])
    .map((profile) => ({
      id: profile.id,
      alias: profile.alias || profile.server_label || "Kobo",
      is_default: profile.is_default,
      has_token: profile.has_token,
      base_url: profile.base_url,
      server_label: profile.server_label,
    }))
    .filter((profile) => profile.id || profile.base_url);
  if (profiles.length) return profiles;
  if (!connection.has_token && !connection.active_profile_base_url && !connection.active_profile_id) return [];
  return [{
    id: connection.active_profile_id || "",
    alias: connection.active_profile_alias || connection.active_profile_server_label || "Kobo",
    is_default: true,
    has_token: connection.has_token,
    base_url: connection.active_profile_base_url,
    server_label: connection.active_profile_server_label,
  }];
}

function koboOccurrenceProfileLabel(profile: KoboOccurrenceProfile) {
  const label = profile.server_label || profile.alias || "Kobo";
  const base = normalizeKoboBaseUrl(profile.base_url);
  return base ? `${label} · ${base.replace(/^https?:\/\//i, "")}` : label;
}

function occurrenceOutcomeColor(key: string) {
  return OCCURRENCE_OUTCOME_COLORS[key] ?? "#b66a2c";
}

function isOccurrenceTab(value: unknown): value is OccurrenceTab {
  return value === "states" || value === "distritos" || value === "registro" || value === "ump" || value === "alerts" || value === "rhythm";
}

function occurrenceRateLabel(summary: MonitoreoFieldOccurrenceDashboard["summary"]) {
  return summary.tasa_no_efectiva == null || Number.isNaN(Number(summary.tasa_no_efectiva))
    ? "S/D"
    : formatPercentLabel(Number(summary.tasa_no_efectiva) * 100);
}

function occurrenceConfigStatusLabel(value: unknown) {
  const key = String(value ?? "").trim().toLocaleLowerCase("es-PE");
  if (key === "deployed") return "Desplegado";
  if (key === "synced") return "Sincronizado";
  if (key === "generated") return "XLSForm generado";
  if (key === "configured") return "Configurado";
  if (key === "not_configured") return "Sin configurar";
  return key ? String(value) : "Sin configurar";
}

function latestOccurrenceDateLabel(values: string[]) {
  const labels = Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
  return labels.sort((a, b) => a.localeCompare(b, "es-PE", { numeric: true })).at(-1) ?? "";
}

function occurrenceAdvanceProgressLabel(row: Pick<OccurrenceRouteUmpRow, "advance_validas" | "advance_meta">) {
  return row.advance_meta > 0
    ? `${formatMetric(row.advance_validas)}/${formatMetric(row.advance_meta)} validas`
    : `${formatMetric(row.advance_validas)} validas`;
}

function occurrenceRowsAdvanceContext(rows: OccurrenceRouteUmpRow[]) {
  const validas = rows.reduce((sum, row) => sum + row.advance_validas, 0);
  const meta = rows.reduce((sum, row) => sum + Math.max(0, row.advance_meta), 0);
  const latest = latestOccurrenceDateLabel(rows.map((row) => row.advance_last_activity));
  const progress = meta > 0
    ? `${formatMetric(validas)}/${formatMetric(meta)} validas`
    : `${formatMetric(validas)} validas`;
  return latest ? `${progress} · ultimo ingreso ${latest}` : progress;
}

function occurrenceBlockIsReplacement(block: OccurrenceRouteUmpRow["expected_blocks"][number]) {
  const type = `${block.tipo_manzana ?? ""} ${block.block_type ?? ""} ${block.tipo ?? ""}`.toLocaleLowerCase("es-PE");
  if (type.includes("reemplazo") || type.includes("replacement")) return true;
  const declaredUmp = String(block.ump_group ?? block.ump ?? "").trim();
  const titularHint = String(block.titular_hoja_num ?? block.titular_orden_seleccion ?? "").trim();
  return Boolean(titularHint && /(?:^|[^a-z0-9])R\s*[0-9]+(?:$|[^a-z0-9])/i.test(declaredUmp));
}

function occurrenceBlockLookupValues(block: OccurrenceRouteUmpRow["expected_blocks"][number]) {
  return [
    block.route_key,
    block.manzana_key,
    block.id_manzana,
    block.block_id,
    block.id,
  ].map((value) => String(value ?? "").trim()).filter(Boolean);
}

function occurrenceBlockHasAdvance(block: OccurrenceRouteUmpRow["expected_blocks"][number]) {
  return [
    block.validas,
    block.avance_validas,
    block.revision,
    block.no_defendibles,
    block.no_defendibles_validas,
  ].some((value) => Number(value) > 0);
}

function occurrenceRowAppliedReplacementCount(row: Pick<OccurrenceRouteUmpRow, "expected_blocks" | "records" | "has_report" | "manzana" | "zona" | "distrito">) {
  return row.expected_blocks.filter((block) => {
    if (!occurrenceBlockIsReplacement(block)) return false;
    if (occurrenceBlockHasAdvance(block)) return true;
    const blockKeys = new Set(occurrenceBlockLookupValues(block));
    const blockManzana = String(block.manzana ?? "").trim();
    const blockZona = String(block.zona ?? "").trim();
    const blockDistrito = String(block.distrito ?? "").trim();
    if (row.has_report && blockManzana && row.manzana === blockManzana && (!blockZona || row.zona === blockZona) && (!blockDistrito || row.distrito === blockDistrito)) {
      return true;
    }
    return row.records.some((record) => {
      const recordKeys = [record.manzana_key, record.route_label, record.row_id].map((value) => String(value ?? "").trim()).filter(Boolean);
      if (recordKeys.some((key) => blockKeys.has(key))) return true;
      const recordType = String(record.tipo_manzana ?? "").toLocaleLowerCase("es-PE");
      const recordManzana = String(record.manzana ?? "").trim();
      const recordZona = String(record.zona ?? "").trim();
      const recordDistrito = String(record.distrito ?? "").trim();
      return recordType.includes("reemplazo") && blockManzana && recordManzana === blockManzana && (!blockZona || recordZona === blockZona) && (!blockDistrito || recordDistrito === blockDistrito);
    });
  }).length;
}

function occurrenceCoverageCounts(rows: OccurrenceRouteUmpRow[]) {
  const expectedRows = rows.filter((row) => !row.is_unreconciled);
  const missingAdvanceRows = expectedRows.filter((row) => row.advance_started && !row.has_report);
  return {
    expected: expectedRows.length,
    reported: expectedRows.filter((row) => row.has_report).length,
    missing: expectedRows.filter((row) => !row.has_report).length,
    validasMissing: missingAdvanceRows.reduce((sum, row) => sum + row.advance_validas, 0),
    latestMissing: latestOccurrenceDateLabel(missingAdvanceRows.map((row) => row.advance_last_activity)),
    replacementFamilies: expectedRows.filter((row) => occurrenceRowAppliedReplacementCount(row) > 0).length,
    unreconciled: rows.filter((row) => row.is_unreconciled).length,
  };
}

function compactParts(parts: Array<string | number | boolean | null | undefined>) {
  return parts.map((part) => String(part ?? "").trim()).filter(Boolean).join(" · ");
}

function occurrenceRecordCode(row: MonitoreoFieldOccurrenceDashboard["records"][number]) {
  return String(row.codigo_pulso || row.row_id || "Sin codigo").trim();
}

function occurrenceRecordStamp(row: MonitoreoFieldOccurrenceDashboard["records"][number]) {
  return String(row.datetime_label || row.date_label || row.date || row.hora_label || "").trim();
}

function occurrenceRecordPlace(row: MonitoreoFieldOccurrenceDashboard["records"][number]) {
  return compactParts([
    row.distrito || "Sin distrito",
    row.zona ? `Zona ${row.zona}` : "",
    row.manzana ? `Mz ${row.manzana}` : "",
    row.ump ? `UMP ${row.ump}` : "",
  ]);
}

function occurrenceRecordRouteMessage(row: MonitoreoFieldOccurrenceDashboard["records"][number]) {
  return String(row.route_match_message || row.route_match_status || "").trim();
}

function buildOccurrenceAlertReviewItems({
  missingRows,
  observationRows,
  outsideRouteRows,
  highNonEffectiveRows,
}: {
  missingRows: OccurrenceRouteUmpRow[];
  observationRows: MonitoreoFieldOccurrenceDashboard["alerts"]["observations"];
  outsideRouteRows: MonitoreoFieldOccurrenceDashboard["alerts"]["outside_route"];
  highNonEffectiveRows: MonitoreoFieldOccurrenceDashboard["alerts"]["high_non_effective"];
}): OccurrenceAlertReviewItem[] {
  const missingItems = missingRows.map((row) => {
    const meta = compactParts([
      row.distrito || "Sin distrito",
      row.responsable || "Sin responsable",
      row.route_label,
    ]);
    const detail = row.advance_started
      ? compactParts([occurrenceAdvanceProgressLabel(row), row.advance_quota_status || "avance iniciado", row.advance_last_activity])
      : "Sin avance territorial ni ocurrencia sincronizada";
    const title = `UMP ${row.ump || "S/D"}${row.manzana ? ` · Mz ${row.manzana}` : ""}`;
    return {
      id: `missing:${row.id}`,
      kind: "missing" as const,
      title,
      meta,
      detail,
      value: OCCURRENCE_STATUS_META[row.status].label,
      searchText: `${title} ${meta} ${detail} ${row.search_text}`.toLocaleLowerCase("es-PE"),
    };
  });

  const observationItems = observationRows.map((row, index) => {
    const code = occurrenceRecordCode(row);
    const meta = compactParts([occurrenceRecordStamp(row), row.responsable, occurrenceRecordPlace(row)]);
    const detail = String(row.observaciones || "Observacion sin texto").trim();
    const title = compactParts([code, row.route_label || (row.ump ? `UMP ${row.ump}` : "")]) || code;
    return {
      id: `observation:${row.row_id || code}:${index}`,
      kind: "observations" as const,
      title,
      meta,
      detail,
      value: formatMetric(row.no_efectivas || row.intentos),
      searchText: `${title} ${meta} ${detail}`.toLocaleLowerCase("es-PE"),
    };
  });

  const outsideItems = outsideRouteRows.map((row, index) => {
    const code = occurrenceRecordCode(row);
    const place = occurrenceRecordPlace(row);
    const detail = occurrenceRecordRouteMessage(row) || "La ocurrencia no coincide con una UMP esperada.";
    const title = compactParts([code, row.ump ? `UMP ${row.ump}` : "", row.manzana ? `Mz ${row.manzana}` : ""]) || code;
    return {
      id: `outside:${row.row_id || code}:${index}`,
      kind: "outside_route" as const,
      title,
      meta: compactParts([occurrenceRecordStamp(row), row.responsable, place]),
      detail,
      value: row.route_match_status || "Revisar",
      searchText: `${title} ${place} ${detail} ${row.route_match_status}`.toLocaleLowerCase("es-PE"),
    };
  });

  const highNonEffectiveItems = highNonEffectiveRows.map((row, index) => {
    const code = occurrenceRecordCode(row);
    const rate = row.tasa_no_efectiva == null ? "S/D" : formatPercentLabel(row.tasa_no_efectiva * 100);
    const title = compactParts([code, row.route_label || (row.ump ? `UMP ${row.ump}` : ""), row.distrito]) || code;
    const detail = compactParts([
      `${formatMetric(row.no_efectivas)} no efectivas`,
      `${formatMetric(row.intentos)} intentos`,
      `${rate} tasa`,
      row.observaciones,
    ]);
    return {
      id: `high:${row.row_id || code}:${index}`,
      kind: "high_non_effective" as const,
      title,
      meta: compactParts([occurrenceRecordStamp(row), row.responsable, occurrenceRecordPlace(row)]),
      detail,
      value: rate,
      searchText: `${title} ${detail} ${row.responsable}`.toLocaleLowerCase("es-PE"),
    };
  });

  return [...missingItems, ...outsideItems, ...observationItems, ...highNonEffectiveItems];
}

function TerritorialFieldOccurrencesWorkbenchImpl({
  pestanaActiva,
  busy = false,
  reports,
  onError,
  onReload,
  onStateChange,
}: TerritorialFieldOccurrencesWorkbenchProps) {
  const occurrences = reports?.field_occurrences ?? null;
  const config = occurrences?.config ?? null;
  const summary = occurrences?.summary ?? EMPTY_OCCURRENCE_SUMMARY;
  const [localBusy, setLocalBusy] = useState<OccurrenceBusy>("");
  const [fieldCheck, setFieldCheck] = useState<MonitoreoFieldOccurrenceFieldCheck | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [koboConnection, setKoboConnection] = useState<ConnectionTokenState | null>(null);
  const [connectionLoading, setConnectionLoading] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState(config?.connection_profile_id ?? "");
  const [occurrenceAssets, setOccurrenceAssets] = useState<MonitoreoKoboAssetItem[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [assetsError, setAssetsError] = useState("");
  const [assetQuery, setAssetQuery] = useState("");
  const [pendingAssetUid, setPendingAssetUid] = useState("");
  const [assetSelectionError, setAssetSelectionError] = useState("");
  const [alertSearch, setAlertSearch] = useState("");
  const [alertFilter, setAlertFilter] = useState<OccurrenceAlertFilter>("todos");
  const tab = isOccurrenceTab(pestanaActiva) ? pestanaActiva : "states";
  const disabled = busy || Boolean(localBusy);
  const active = Boolean(config?.asset_uid);
  const surveyLink = String(config?.survey_url || config?.asset_url || "").trim();
  const rateLabel = occurrenceRateLabel(summary);
  const koboProfiles = useMemo(() => koboOccurrenceProfiles(koboConnection), [koboConnection]);
  const selectedProfile = useMemo(() => {
    if (!koboProfiles.length) return null;
    return koboProfiles.find((profile) => profile.id === selectedProfileId) ??
      koboProfiles.find((profile) => profile.is_default) ??
      koboProfiles[0];
  }, [koboProfiles, selectedProfileId]);
  const hasKoboToken = Boolean(koboConnection?.has_token || selectedProfile?.has_token);
  const occurrenceBaseUrl = normalizeKoboBaseUrl(
    selectedProfile?.base_url ||
      config?.base_url ||
      koboConnection?.active_profile_base_url ||
      "https://kf.kobotoolbox.org",
  );
  const occurrenceAssetCatalogKey = `occurrences::${selectedProfile?.id || selectedProfileId || "default"}::${occurrenceBaseUrl}`;
  const filteredOccurrenceAssets = useMemo(() => {
    const q = assetQuery.trim().toLocaleLowerCase("es-PE");
    return occurrenceAssets
      .filter((asset) => {
        const haystack = `${asset.name} ${asset.uid}`.toLocaleLowerCase("es-PE");
        return !q || haystack.includes(q);
      })
      .sort((a, b) => {
        if (a.uid === config?.asset_uid) return -1;
        if (b.uid === config?.asset_uid) return 1;
        if (a.deployment_active !== b.deployment_active) return a.deployment_active ? -1 : 1;
        return String(b.date_modified ?? "").localeCompare(String(a.date_modified ?? ""));
      })
      .slice(0, 8);
  }, [assetQuery, config?.asset_uid, occurrenceAssets]);
  const occurrenceConnectionLabel = connectionLoading
    ? "cargando cuentas"
    : hasKoboToken
      ? `${koboProfiles.length || 1} perfil Kobo`
      : "sin token Kobo";
  const showAssetPicker = !active || assetPickerOpen;
  const configStatusLabel = occurrenceConfigStatusLabel(config?.status || (active ? "configured" : "not_configured"));
  const xlsformLabel = config?.generated_at
    ? formatDate(config.generated_at)
    : config?.xlsform_filename
      ? config.xlsform_filename
      : "Sin XLSForm local";
  const uploadLabel = config?.uploaded_at
    ? formatDate(config.uploaded_at)
    : hasKoboToken
      ? "Pendiente de despliegue"
      : "Sin token Kobo";
  const syncLabel = config?.last_sync_at ? formatDate(config.last_sync_at) : "Sin sincronizar";

  const routeUmpRows = useMemo(() => buildOccurrenceRouteUmpRows({ occurrences }), [occurrences]);
  const coverageCounts = useMemo(() => occurrenceCoverageCounts(routeUmpRows), [routeUmpRows]);
  const districtSummary = useMemo(() => buildOccurrenceDistrictSummary(occurrences, routeUmpRows), [occurrences, routeUmpRows]);
  const topOutcomes = useMemo(() => (
    [...(occurrences?.by_outcome ?? [])].sort((a, b) => b.total - a.total).slice(0, 7)
  ), [occurrences?.by_outcome]);
  const history = occurrences?.history ?? [];
  const expectedRouteUmpRows = routeUmpRows.filter((row) => !row.is_unreconciled);
  const startedNoOccurrenceRows = expectedRouteUmpRows.filter((row) => row.advance_started && !row.has_report);
  const completeNoOccurrenceRows = expectedRouteUmpRows.filter((row) => row.status === "completa_sin_reporte");
  const incompleteNoOccurrenceRows = expectedRouteUmpRows.filter((row) => row.status === "incompleta_sin_reporte");
  const alertReviewItems = useMemo(() => buildOccurrenceAlertReviewItems({
    missingRows: expectedRouteUmpRows.filter((row) => !row.has_report),
    observationRows: occurrences?.alerts?.observations ?? [],
    outsideRouteRows: occurrences?.alerts?.outside_route ?? [],
    highNonEffectiveRows: occurrences?.alerts?.high_non_effective ?? [],
  }), [expectedRouteUmpRows, occurrences?.alerts?.high_non_effective, occurrences?.alerts?.observations, occurrences?.alerts?.outside_route]);
  const alertKindCounts = useMemo(() => {
    const counts: Record<OccurrenceAlertKind, number> = {
      missing: 0,
      observations: 0,
      outside_route: 0,
      high_non_effective: 0,
    };
    alertReviewItems.forEach((item) => {
      counts[item.kind] += 1;
    });
    return counts;
  }, [alertReviewItems]);
  const filteredAlertItems = useMemo(() => {
    const query = alertSearch.trim().toLocaleLowerCase("es-PE");
    return alertReviewItems
      .filter((item) => alertFilter === "todos" || item.kind === alertFilter)
      .filter((item) => !query || item.searchText.includes(query))
      .slice(0, 80);
  }, [alertFilter, alertReviewItems, alertSearch]);

  useEffect(() => {
    let cancelled = false;
    setConnectionLoading(true);
    setConnectionError("");
    apiConnectionsList()
      .then((result) => {
        if (cancelled) return;
        setKoboConnection(result.connections.find((item) => item.provider === "kobo") ?? null);
      })
      .catch((error: unknown) => {
        if (!cancelled) setConnectionError((error as Error).message || String(error));
      })
      .finally(() => {
        if (!cancelled) setConnectionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const configuredProfileId = String(config?.connection_profile_id ?? "").trim();
    if (configuredProfileId) {
      setSelectedProfileId(configuredProfileId);
      return;
    }
    const preferred = koboConnection?.active_profile_id ||
      koboProfiles.find((profile) => profile.is_default)?.id ||
      koboProfiles[0]?.id ||
      "";
    if (preferred) setSelectedProfileId((current) => current || preferred);
  }, [config?.connection_profile_id, koboConnection?.active_profile_id, koboProfiles]);

  useEffect(() => {
    setOccurrenceAssets(occurrenceAssetCatalogCache.get(occurrenceAssetCatalogKey) ?? []);
    setAssetsLoaded(occurrenceAssetCatalogCache.has(occurrenceAssetCatalogKey));
    setAssetsError("");
    setAssetSelectionError("");
  }, [occurrenceAssetCatalogKey]);

  useEffect(() => {
    setFieldCheck(null);
  }, [config?.asset_uid]);

  useEffect(() => {
    setAssetPickerOpen(!active);
  }, [active, config?.asset_uid]);

  const runAction = useCallback(async (kind: OccurrenceBusy, action: () => Promise<void>) => {
    setLocalBusy(kind);
    onError?.("");
    try {
      await action();
    } catch (error) {
      onError?.((error as Error).message || String(error));
    } finally {
      setLocalBusy("");
    }
  }, [onError]);

  const loadOccurrenceAssets = useCallback(async (force = false) => {
    if (!occurrenceBaseUrl) {
      setAssetsError("Define primero el servidor Kobo.");
      return;
    }
    setAssetsLoading(true);
    setAssetsError("");
    try {
      if (!force && occurrenceAssetCatalogCache.has(occurrenceAssetCatalogKey)) {
        setOccurrenceAssets(occurrenceAssetCatalogCache.get(occurrenceAssetCatalogKey) ?? []);
        setAssetsLoaded(true);
        return;
      }
      const result = await apiMonitoreoKoboAssets(occurrenceBaseUrl, 100, {
        connection_profile_id: selectedProfile?.id || selectedProfileId || undefined,
      });
      occurrenceAssetCatalogCache.set(occurrenceAssetCatalogKey, result.assets);
      setOccurrenceAssets(result.assets);
      setAssetsLoaded(true);
    } catch (error) {
      setAssetsError((error as Error).message || String(error));
    } finally {
      setAssetsLoading(false);
    }
  }, [occurrenceAssetCatalogKey, occurrenceBaseUrl, selectedProfile?.id, selectedProfileId]);

  const configureOccurrenceAsset = useCallback(async (asset: MonitoreoKoboAssetItem) => {
    const cleanBase = normalizeKoboBaseUrl(occurrenceBaseUrl) || "https://kf.kobotoolbox.org";
    const assetUrl = koboOccurrenceLandingUrl(cleanBase, asset.uid);
    const sameAsset = asset.uid === config?.asset_uid;
    const patch: Partial<MonitoreoFieldOccurrenceConfig> = {
      enabled: true,
      form_title: config?.form_title || "OCURRENCIAS DE TRABAJO DE CAMPO",
      asset_uid: asset.uid,
      asset_name: asset.name || asset.uid,
      version_id: asset.version_id || "",
      source_id: config?.source_id || "",
      base_url: cleanBase,
      survey_url: assetUrl,
      asset_url: assetUrl,
      connection_profile_id: selectedProfile?.id || selectedProfileId || "",
      status: sameAsset && config?.status ? config.status : "configured",
      last_sync_at: sameAsset ? config?.last_sync_at || "" : "",
      uploaded_at: sameAsset ? config?.uploaded_at || "" : "",
    };
    setLocalBusy("config");
    setPendingAssetUid(asset.uid);
    setAssetSelectionError("");
    onError?.("");
    try {
      const result = await apiMonitoreoTerritorialOccurrencesConfig(patch);
      onStateChange?.(result.state);
      setAssetPickerOpen(false);
      onReload?.();
    } catch (error) {
      const message = (error as Error).message || String(error);
      setAssetSelectionError(message);
      onError?.(message);
    } finally {
      setPendingAssetUid("");
      setLocalBusy("");
    }
  }, [
    config?.asset_uid,
    config?.form_title,
    config?.last_sync_at,
    config?.source_id,
    config?.status,
    config?.uploaded_at,
    occurrenceBaseUrl,
    onError,
    onReload,
    onStateChange,
    selectedProfile?.id,
    selectedProfileId,
  ]);

  const generateXlsform = useCallback(() => runAction("xlsform", async () => {
    const result = await apiMonitoreoTerritorialOccurrencesXlsform(config ?? {});
    onStateChange?.(result.state);
    if (result.download_url && typeof window !== "undefined") {
      window.open(result.download_url, "_blank", "noopener,noreferrer");
    }
  }), [config, onStateChange, runAction]);

  const uploadKobo = useCallback(() => runAction("upload", async () => {
    const result = await apiMonitoreoTerritorialOccurrencesUploadKobo({
      ...(config ?? {}),
      base_url: occurrenceBaseUrl || config?.base_url,
      connection_profile_id: selectedProfile?.id || selectedProfileId || config?.connection_profile_id,
    });
    onStateChange?.(result.state);
    setAssetPickerOpen(false);
    onReload?.();
  }), [config, occurrenceBaseUrl, onReload, onStateChange, runAction, selectedProfile?.id, selectedProfileId]);

  const inspectFields = useCallback(() => runAction("inspect", async () => {
    const result = await apiMonitoreoTerritorialOccurrencesInspect(config ?? {});
    setFieldCheck(result.field_check);
  }), [config, runAction]);

  const exportUmp = useCallback((opts: { responsable?: string; only_missing?: boolean } = {}) =>
    runAction("ump-export", async () => {
      const result = await apiMonitoreoTerritorialUmpExport({
        ...(opts.responsable ? { responsable: opts.responsable } : {}),
        ...(opts.only_missing ? { only_missing: true } : {}),
      });
      if (result.file_id && typeof window !== "undefined") {
        window.open(downloadUrl(result.file_id), "_blank", "noopener,noreferrer");
      }
    }), [runAction]);

  const syncOccurrences = useCallback(() => runAction("sync", async () => {
    const result = await apiMonitoreoTerritorialOccurrencesSync({
      asset_uid: config?.asset_uid,
      source_id: config?.source_id,
    });
    onStateChange?.(result.state);
  }), [config?.asset_uid, config?.source_id, onStateChange, runAction]);

  const copyOccurrenceLink = useCallback(async () => {
    if (!surveyLink) return;
    try {
      await navigator.clipboard?.writeText(surveyLink);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 1600);
    } catch {
      setCopiedLink(false);
    }
  }, [surveyLink]);

  if (!reports) {
    return (
      <section className="mon-stage mon-stage--ocurrencias">
        <Panel className="mon-territorial-panel mon-field-occurrences">
          <div className="mon-field-occurrences-setup">
            <header>
              <div>
                <span>Preparando ocurrencias</span>
                <strong>La vista necesita el scope de consultas</strong>
                <em>Usa Actualizar vista para hidratar el tablero territorial.</em>
              </div>
            </header>
          </div>
        </Panel>
      </section>
    );
  }

  return (
    <section className="mon-stage mon-stage--ocurrencias">
      <Panel className="mon-territorial-panel mon-field-occurrences">
        <OccurrenceSourceBar
          estado={configStatusLabel}
          activa={active}
          reportes={formatMetric(summary.total_records)}
          ultimaSync={syncLabel}
          formulario={config?.asset_name || config?.form_title || "OCURRENCIAS DE TRABAJO DE CAMPO"}
        >
        <section className={`mon-field-occurrences-command ${active ? "is-active" : "is-empty"}`} aria-label="Formulario y acciones de ocurrencias">
          <div className="mon-field-occurrences-command-source">
            <span>{active ? "Formulario Kobo activo" : "Formulario por seleccionar"}</span>
            <strong>{config?.asset_name || config?.form_title || "OCURRENCIAS DE TRABAJO DE CAMPO"}</strong>
            <em>{active ? shortenMiddle(config?.asset_uid ?? "", 34) : "Genera el XLSForm o vincula el formulario desde la consola canonica"}</em>
          </div>
          <div className="mon-field-occurrences-command-actions">
            <button type="button" className="pulso-button" onClick={() => setAssetPickerOpen((current) => !current)} disabled={disabled}>
              {assetPickerOpen ? <ChevronDown size={15} /> : <Search size={15} />}
              {assetPickerOpen ? "Ocultar Kobo" : active ? "Cambiar formulario" : "Elegir formulario"}
            </button>
            <button type="button" className="pulso-button" onClick={generateXlsform} disabled={disabled}>
              {localBusy === "xlsform" ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
              XLSForm
            </button>
            <button type="button" className="pulso-button" onClick={uploadKobo} disabled={disabled || !hasKoboToken}>
              {localBusy === "upload" ? <Loader2 size={15} className="spin" /> : <UploadCloud size={15} />}
              Subir Kobo
            </button>
            <button type="button" className="pulso-button" onClick={inspectFields} disabled={disabled || !active}>
              {localBusy === "inspect" ? <Loader2 size={15} className="spin" /> : <FileCheck2 size={15} />}
              Campos
            </button>
            <button type="button" className="pulso-button" onClick={() => exportUmp({})} disabled={disabled} title="Descarga un Excel con las UMP totales y sus estados">
              {localBusy === "ump-export" ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
              Excel UMP
            </button>
            <button type="button" className="pulso-button is-primary" onClick={syncOccurrences} disabled={disabled || !active}>
              {localBusy === "sync" ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
              Actualizar
            </button>
            <button type="button" className="pulso-button" onClick={copyOccurrenceLink} disabled={disabled || !surveyLink} title={copiedLink ? "Enlace copiado" : "Copiar enlace"}>
              {copiedLink ? <CheckCircle2 size={15} /> : <Link2 size={15} />}
            </button>
          </div>
        </section>

        <section className="mon-field-occurrences-connect-summary" aria-label="Estado de configuracion de ocurrencias">
          <span>
            <FileCheck2 size={14} />
            <strong>{configStatusLabel}</strong>
            <em>{config?.source_id || "Sin source_id"}</em>
          </span>
          <span>
            <Download size={14} />
            <strong>{config?.xlsform_filename || "XLSForm"}</strong>
            <em>{xlsformLabel}</em>
          </span>
          <span>
            <UploadCloud size={14} />
            <strong>{active ? shortenMiddle(config?.asset_uid ?? "", 28) : "Sin asset Kobo"}</strong>
            <em>{uploadLabel}</em>
          </span>
          <span>
            <RefreshCw size={14} />
            <strong>{formatMetric(summary.total_records)} reportes locales</strong>
            <em>{syncLabel}</em>
          </span>
        </section>

        {(showAssetPicker || connectionError || assetsError || assetSelectionError) ? (
          <section className="mon-field-occurrences-connect" aria-label="Seleccion de formulario Kobo para ocurrencias">
            <header>
              <div>
                <span><PlugZap size={13} /> Formularios Kobo</span>
                <strong>{config?.asset_name || "Selecciona formulario de ocurrencias"}</strong>
              </div>
              <em>{occurrenceConnectionLabel}</em>
            </header>
            {showAssetPicker ? (
              <>
                <div className="mon-field-occurrences-connect-controls">
                  <label>
                    <span>Cuenta</span>
                    <select
                      value={selectedProfile?.id || selectedProfileId}
                      onChange={(event) => setSelectedProfileId(event.target.value)}
                      disabled={connectionLoading || !koboProfiles.length || disabled}
                    >
                      {koboProfiles.length ? koboProfiles.map((profile) => (
                        <option key={profile.id || profile.base_url || profile.alias} value={profile.id}>
                          {koboOccurrenceProfileLabel(profile)}
                        </option>
                      )) : (
                        <option value="">Kobo sin configurar</option>
                      )}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="pulso-button"
                    onClick={() => { void loadOccurrenceAssets(true); }}
                    disabled={assetsLoading || disabled || !hasKoboToken || !occurrenceBaseUrl}
                  >
                    {assetsLoading ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
                    Cargar formularios
                  </button>
                  <label className="mon-field-occurrences-connect-search">
                    <Search size={14} />
                    <input
                      value={assetQuery}
                      onChange={(event) => setAssetQuery(event.target.value)}
                      placeholder="Buscar formulario..."
                      disabled={!assetsLoaded && !occurrenceAssets.length}
                    />
                  </label>
                </div>
                {(connectionError || assetsError || assetSelectionError) ? (
                  <p className="mon-field-occurrences-connect-error">{connectionError || assetsError || assetSelectionError}</p>
                ) : null}
                {!hasKoboToken && !connectionLoading && !connectionError ? (
                  <p className="mon-field-occurrences-connect-note">Configura Kobo en Usuarios para cargar formularios desde la API.</p>
                ) : null}
                {hasKoboToken && !assetsLoaded && !assetsLoading ? (
                  <p className="mon-field-occurrences-connect-note">Carga el catalogo Kobo para elegir el formulario de ocurrencias.</p>
                ) : null}
                {assetsLoaded ? (
                  <div className="mon-field-occurrences-assets">
                    {filteredOccurrenceAssets.map((asset) => {
                      const selected = asset.uid === config?.asset_uid;
                      const choosing = pendingAssetUid === asset.uid || (localBusy === "config" && selected);
                      return (
                        <button
                          key={asset.uid}
                          type="button"
                          className={`mon-field-occurrences-asset ${selected ? "is-selected" : ""}`}
                          onClick={() => { void configureOccurrenceAsset(asset); }}
                          disabled={disabled || choosing || !hasKoboToken}
                        >
                          <span>
                            <strong>{asset.name || asset.uid}</strong>
                            <em>{shortenMiddle(asset.uid, 30)}{asset.version_id ? ` · v ${shortenMiddle(asset.version_id, 14)}` : ""}</em>
                          </span>
                          <b className={asset.deployment_active ? "is-active" : ""}>{asset.deployment_active ? "activo" : "sin deploy"}</b>
                          <i>{choosing ? <Loader2 size={13} className="spin" /> : selected ? <CheckCircle2 size={13} /> : "Usar"}</i>
                        </button>
                      );
                    })}
                    {!filteredOccurrenceAssets.length ? (
                      <p className="mon-field-occurrences-connect-note">Sin formularios para esta busqueda.</p>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </section>
        ) : null}

        {fieldCheck ? (
          <div className={`mon-field-occurrences-fieldcheck ${fieldCheck.required_ok ? "is-ready" : "is-warning"}`}>
            <header>
              <span>{fieldCheck.required_ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />} Prueba de campos</span>
              <strong>{fieldCheck.message}</strong>
              <em>{formatMetric(fieldCheck.field_count)} campos leidos</em>
            </header>
            <div>
              {fieldCheck.items.slice(0, 14).map((item) => (
                <span key={item.key} className={item.ok ? "is-ok" : item.required ? "is-missing" : "is-optional"}>
                  {item.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  <b>{item.label}</b>
                  <em>{item.found_name || (item.required ? "faltante" : "opcional")}</em>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        </OccurrenceSourceBar>

        {tab === "states" ? (
          <section className="mon-field-occurrences-overview is-summary">
            {/* Estos cuatro conteos vivían dentro de la banda de configuración, que
                es donde menos significan: cobertura y no efectividad son lectura del
                campo, no estado del formulario. Bajan a Resumen, su pestaña
                propietaria. */}
            <div className="mon-field-occurrences-coverage-strip" aria-label="Cobertura de reportes de ocurrencia">
              <span>
                <strong>{formatMetric(coverageCounts.reported)}/{formatMetric(coverageCounts.expected)}</strong>
                <em>UMP con registro</em>
              </span>
              <span className={coverageCounts.missing ? "is-warning" : ""}>
                <strong>{formatMetric(coverageCounts.missing)}</strong>
                <em>sin registro · {formatMetric(coverageCounts.validasMissing)} válidas sin ocurrencias</em>
              </span>
              <span>
                <strong>{formatMetric(coverageCounts.replacementFamilies)}</strong>
                <em>reemplazos usados como titular</em>
              </span>
            </div>
            <div className="mon-field-occurrences-state-grid">
              <OccurrenceStateComposition summary={summary} rateLabel={rateLabel} />
              <OccurrenceOutcomeBars items={topOutcomes} total={summary.no_efectivas} />
            </div>
          </section>
        ) : null}

        {tab === "distritos" ? (
          <section className="mon-field-occurrences-overview is-distritos" aria-label="Estados de ocurrencia por distrito">
            <OccurrenceDistrictMatrix rows={districtSummary} />
          </section>
        ) : null}

        {tab === "registro" ? (
          <OccurrenceRegisterWorkspace rows={routeUmpRows} />
        ) : null}

        {tab === "ump" ? (
          <OccurrenceUmpWorkspace rows={routeUmpRows} allRows={routeUmpRows} onExportUmp={exportUmp} />
        ) : null}

        {tab === "alerts" ? (
          <section className="mon-field-occurrences-body is-alerts" data-occurrence-tab="alerts">
            <section className="mon-field-occurrences-alerts-panel" aria-label="Alertas revisables de ocurrencias">
              <header>
                <div>
                  <span><ShieldAlert size={14} /> Alertas revisables</span>
                  <strong>{formatMetric(filteredAlertItems.length)} visibles de {formatMetric(alertReviewItems.length)}</strong>
                  <em>Sin reporte, observaciones, fuera de ruta y no efectividad alta</em>
                </div>
                <b>{alertFilter === "todos" ? "Todos" : OCCURRENCE_ALERT_META[alertFilter].shortLabel}</b>
              </header>
              <div className="mon-field-occurrences-alerts-toolbar" aria-label="Filtros de alertas de ocurrencias">
                <label className="mon-field-occurrences-alert-search">
                  <Search size={14} />
                  <input
                    value={alertSearch}
                    onChange={(event) => setAlertSearch(event.target.value)}
                    placeholder="Buscar UMP, codigo, distrito, responsable o mensaje"
                  />
                </label>
                <select value={alertFilter} onChange={(event) => setAlertFilter(event.target.value as OccurrenceAlertFilter)} aria-label="Filtrar alertas de ocurrencias">
                  <option value="todos">Todas las alertas ({formatMetric(alertReviewItems.length)})</option>
                  <option value="missing">Sin reporte ({formatMetric(alertKindCounts.missing)})</option>
                  <option value="observations">Observaciones ({formatMetric(alertKindCounts.observations)})</option>
                  <option value="outside_route">Fuera de ruta ({formatMetric(alertKindCounts.outside_route)})</option>
                  <option value="high_non_effective">No efectividad alta ({formatMetric(alertKindCounts.high_non_effective)})</option>
                </select>
              </div>
              <div className="mon-field-occurrences-alert-list" role="list" aria-label="Lista revisable de alertas de ocurrencias">
                {filteredAlertItems.map((item) => (
                  <OccurrenceAlertReviewRow key={item.id} item={item} />
                ))}
                {!filteredAlertItems.length ? (
                  <em>{alertFilter === "todos" ? "Sin alertas para revisar con estos filtros." : OCCURRENCE_ALERT_META[alertFilter].empty}</em>
                ) : null}
              </div>
            </section>

            {/* Acá vivía un lateral con «Tipos de ocurrencia» —los mismos siete
                motivos que ya muestra Resumen, valor por valor— y «Cobertura»
                —los mismos conteos de Reporte UMP—. Repetirlos costaba 394px de
                contenido fuera de alcance en la pestaña que existe justamente
                para trabajar los casos. Cada dato se queda en su pestaña
                propietaria y desde acá se llega con un enlace. */}
          </section>
        ) : null}

        {tab === "rhythm" ? (
          <OccurrenceRhythmWorkspace
            rows={occurrences?.by_day ?? []}
            history={history}
            summary={summary}
            syncLabel={syncLabel}
            configStatusLabel={configStatusLabel}
          />
        ) : null}
      </Panel>
    </section>
  );
}

function OccurrenceStateComposition({
  summary,
  rateLabel,
}: {
  summary: MonitoreoFieldOccurrenceDashboard["summary"];
  rateLabel: string;
}) {
  const totalAttempts = summary.intentos || summary.efectivas + summary.no_efectivas;
  const total = Math.max(1, totalAttempts);
  const effectivePct = Math.max(0, Math.min(100, (summary.efectivas / total) * 100));
  const nonEffectivePct = Math.max(0, Math.min(100, (summary.no_efectivas / total) * 100));
  return (
    <section className="mon-field-occurrences-chart-card is-state" aria-label="Estados generales de ocurrencias">
      <header>
        <span><CheckCircle2 size={14} /> Estados generales</span>
      </header>
      {/* El número grande era «intentos reportados». Un intento no es un logro:
          es el denominador. Lo que decide la operación —y lo que el equipo mira
          para reaccionar— es qué proporción de esos intentos no llegó a
          entrevista. Esa es la cifra que lidera, con su denominador al lado. */}
      <div className="mon-field-occurrences-intents-card is-rate">
        <span>Tasa de no efectividad</span>
        <strong>{rateLabel}</strong>
        <em>{formatMetric(summary.no_efectivas)} no efectivas de {formatMetric(totalAttempts)} intentos</em>
      </div>
      <div className="mon-field-occurrences-state-meter" aria-hidden="true">
        <span className="is-effective" style={{ width: `${effectivePct}%` }} />
        <span className="is-noneffective" style={{ width: `${nonEffectivePct}%` }} />
      </div>
      <div className="mon-field-occurrences-state-stats">
        <span className="is-effective"><strong>{formatMetric(summary.efectivas)}</strong><em>Efectivas</em></span>
        <span className="is-noneffective"><strong>{formatMetric(summary.no_efectivas)}</strong><em>No efectivas</em></span>
        <span><strong>{formatMetric(totalAttempts)}</strong><em>Intentos</em></span>
        <span><strong>{formatMetric(summary.days_reported)}</strong><em>Dias</em></span>
      </div>
    </section>
  );
}

function OccurrenceOutcomeBars({ items, total }: { items: OccurrenceOutcomeSummary[]; total: number }) {
  const max = Math.max(1, ...items.map((item) => item.total));
  return (
    <section className="mon-field-occurrences-chart-card is-outcomes" aria-label="Motivos no efectivos">
      <header>
        <span><ShieldAlert size={14} /> Motivos no efectivos</span>
        <strong>{formatMetric(total)} eventos</strong>
      </header>
      <div>
        {items.length ? items.map((item) => (
          <article key={item.key} style={{ "--occurrence-outcome-color": occurrenceOutcomeColor(item.key) } as CSSProperties}>
            <span>{item.label}</span>
            <b>{formatMetric(item.total)}</b>
            <i style={{ width: `${Math.max(4, (item.total / max) * 100)}%` }} />
          </article>
        )) : (
          <em>Sin motivos sincronizados.</em>
        )}
      </div>
    </section>
  );
}

function OccurrenceDailyBars({ rows }: { rows: MonitoreoFieldOccurrenceDashboard["by_day"] }) {
  const max = Math.max(1, ...rows.map((row) => row.intentos || 0));
  return (
    <section className="mon-field-occurrences-chart-card is-daily" aria-label="Ritmo diario de ocurrencias">
      <header>
        <span><CalendarRange size={14} /> Ritmo diario</span>
        <strong>{formatMetric(rows.length)} dias</strong>
      </header>
      <div className="mon-field-occurrences-daily-bars">
        {rows.length ? rows.map((row) => {
          const total = Math.max(0, row.intentos || row.efectivas + row.no_efectivas);
          const effectivePct = total > 0 ? Math.max(0, Math.min(100, ((row.efectivas || 0) / total) * 100)) : 0;
          const nonEffectivePct = total > 0 ? Math.max(0, Math.min(100, ((row.no_efectivas || 0) / total) * 100)) : 0;
          const volumePct = Math.max(10, Math.min(100, (total / max) * 100));
          return (
            <article key={row.date}>
              <div className="mon-field-occurrences-daily-label">
                <strong>{row.date_label || formatShortDate(row.date)}</strong>
                <em>{formatMetric(total)} intentos</em>
              </div>
              <div className="mon-field-occurrences-daily-track" aria-hidden="true">
                <span style={{ width: `${volumePct}%` }}>
                  <i className="is-effective" style={{ width: `${effectivePct}%` }} />
                  <i className="is-noneffective" style={{ width: `${nonEffectivePct}%` }} />
                </span>
              </div>
              <div className="mon-field-occurrences-daily-values">
                <span className="is-effective"><strong>{formatMetric(row.efectivas)}</strong><em>Efectivas</em></span>
                <span className="is-noneffective"><strong>{formatMetric(row.no_efectivas)}</strong><em>No efectivas</em></span>
              </div>
            </article>
          );
        }) : (
          <em>Sin fechas sincronizadas.</em>
        )}
      </div>
    </section>
  );
}

function OccurrenceRhythmWorkspace({
  rows,
  history,
  summary,
  syncLabel,
  configStatusLabel,
}: {
  rows: MonitoreoFieldOccurrenceDashboard["by_day"];
  history: NonNullable<MonitoreoFieldOccurrenceDashboard["history"]>;
  summary: MonitoreoFieldOccurrenceDashboard["summary"];
  syncLabel: string;
  configStatusLabel: string;
}) {
  const totalAttempts = summary.intentos || summary.efectivas + summary.no_efectivas;
  const latestDay = [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date), "es-PE")).at(-1);
  const peakDay = [...rows].sort((a, b) => (b.intentos || 0) - (a.intentos || 0))[0];
  // El historial cortaba a 18 eventos sin decirlo: la memoria de la fuente es
  // justo lo que se consulta cuando un conteo no cuadra, y perder eventos ahí en
  // silencio es lo peor que puede pasar.
  const recorteHistorial = recorteTabla(history, 18, "fila");
  return (
    <section className="mon-field-occurrences-body is-rhythm" data-occurrence-tab="rhythm">
      <OccurrenceDailyBars rows={rows} />
      <aside className="mon-field-occurrences-side is-alert-summary mon-field-occurrences-rhythm-side">
        <section className="mon-field-occurrences-rhythm-summary">
          <header><CalendarRange size={15} /><strong>Corte y ritmo</strong></header>
          <div className="mon-field-occurrences-rhythm-kpis">
            <span><strong>{formatMetric(totalAttempts)}</strong><em>intentos</em></span>
            <span><strong>{formatMetric(rows.length)}</strong><em>dias con reporte</em></span>
            <span><strong>{peakDay ? formatMetric(peakDay.intentos || 0) : "0"}</strong><em>pico diario{peakDay ? ` · ${peakDay.date_label || formatShortDate(peakDay.date)}` : ""}</em></span>
            <span><strong>{latestDay?.date_label || "S/D"}</strong><em>ultimo dia</em></span>
            {/* «formulario» y «última sincronización» eran configuración dentro de
                una pestaña operativa; ahora viven en la barra de fuente, visible
                en las cinco pestañas. */}
          </div>
        </section>
        <section className="mon-field-occurrences-history">
          <header><Clock size={15} /><strong>Historial operativo</strong><em>{formatMetric(history.length)} eventos</em></header>
          <div className="mon-field-occurrences-history-list">
            {recorteHistorial.visibles.map((entry) => (
              <article key={entry.id}>
                <div>
                  <strong>{entry.type || "evento"}</strong>
                  {entry.status ? <span>{entry.status}</span> : null}
                </div>
                <p>{entry.created_at ? formatDate(entry.created_at) : "sin fecha"} · {formatMetric(entry.response_count)} registros{entry.asset_uid ? ` · ${shortenMiddle(entry.asset_uid, 20)}` : ""}</p>
                {entry.message ? <small>{entry.message}</small> : null}
              </article>
            ))}
            {!history.length && <em>Sin eventos registrados.</em>}
            {recorteHistorial.recortado ? (
              <em className="mon-field-occurrences-history-recorte">
                {recorteHistorial.etiqueta.replace("filas", "eventos")}
              </em>
            ) : null}
          </div>
        </section>
      </aside>
    </section>
  );
}

function OccurrenceDistrictMatrix({ rows }: { rows: OccurrenceDistrictSummary[] }) {
  const maxIntentos = Math.max(1, ...rows.map((row) => row.intentos || 0));
  return (
    <section className="mon-field-occurrences-districts" aria-label="Resumen de estados por distrito">
      <header>
        <div>
          <span><MapPin size={14} /> Resumen por distrito</span>
          <strong>{formatMetric(rows.length)} distritos</strong>
        </div>
        <em>Estados consolidados y motivo predominante</em>
      </header>
      <div
        className="mon-field-occurrences-district-rows"
        data-qa-geometry-group="territorial-occurrence-districts"
        data-qa-geometry-contract="equal"
      >
        {rows.length ? rows.map((row) => {
          const intentos = Math.max(0, row.intentos || row.efectivas + row.no_efectivas);
          const effectivePct = intentos > 0 ? Math.max(0, Math.min(100, (row.efectivas / intentos) * 100)) : 0;
          const nonEffectivePct = intentos > 0 ? Math.max(0, Math.min(100, (row.no_efectivas / intentos) * 100)) : 0;
          const volumePct = Math.max(8, Math.min(100, (intentos / maxIntentos) * 100));
          const totalUmp = Math.max(1, row.ump_reportadas + row.ump_sin_reporte);
          const reportedPct = Math.max(0, Math.min(100, (row.ump_reportadas / totalUmp) * 100));
          const topOutcomes = [...(row.outcomes ?? [])].filter((item) => item.total > 0).sort((a, b) => b.total - a.total).slice(0, 3);
          const rate = row.tasa_no_efectiva == null ? "S/D" : formatPercentLabel(row.tasa_no_efectiva * 100);
          const validasSinReporte = row.validas_sin_reporte ?? 0;
          const ultimoIngresoSinReporte = row.ultimo_ingreso_sin_reporte ?? "";
          return (
            <article
              key={row.distrito || "sin-distrito"}
              className="mon-field-occurrences-district-row"
              data-qa-geometry-member
            >
              <div className="mon-field-occurrences-district-name">
                <strong>{row.distrito || "Sin distrito"}</strong>
                <span>{formatMetric(row.ump_reportadas)} reportadas · {formatMetric(row.ump_completas_sin_reporte ?? 0)} completas sin ocurrencias · {formatMetric(row.ump_incompletas_sin_reporte ?? 0)} incompletas · {formatMetric(validasSinReporte)} validas{ultimoIngresoSinReporte ? ` · ultimo ingreso ${ultimoIngresoSinReporte}` : ""}</span>
              </div>
              <div className="mon-field-occurrences-district-coverage" aria-label="Cobertura UMP">
                <span>
                  <i className="is-reported" style={{ width: `${reportedPct}%` }} />
                  <i className="is-missing" style={{ width: `${100 - reportedPct}%` }} />
                </span>
                <em>{formatMetric(row.ump_reportadas)}/{formatMetric(totalUmp)} UMP</em>
              </div>
              <div className="mon-field-occurrences-district-meter" aria-label="Estados efectivos y no efectivos">
                <span style={{ width: `${volumePct}%` }}>
                  <i className="is-effective" style={{ width: `${effectivePct}%` }} />
                  <i className="is-noneffective" style={{ width: `${nonEffectivePct}%` }} />
                </span>
              </div>
              <div className="mon-field-occurrences-district-counts">
                <span className="is-effective"><strong>{formatMetric(row.efectivas)}</strong><em>Efectivas</em></span>
                <span className="is-noneffective"><strong>{formatMetric(row.no_efectivas)}</strong><em>No efectivas</em></span>
                <span className="is-complete-missing"><strong>{formatMetric(row.ump_completas_sin_reporte ?? 0)}</strong><em>Completas sin ocurrencias</em></span>
                <span className="is-incomplete-missing"><strong>{formatMetric(row.ump_incompletas_sin_reporte ?? 0)}</strong><em>Incompletas sin ocurrencias</em></span>
                <span className="is-advance-missing"><strong>{formatMetric(validasSinReporte)}</strong><em>Validas sin ocurrencias{ultimoIngresoSinReporte ? ` · ${ultimoIngresoSinReporte}` : ""}</em></span>
                <span><strong>{rate}</strong><em>Tasa</em></span>
              </div>
              <div className="mon-field-occurrences-district-outcomes">
                {topOutcomes.length ? topOutcomes.map((item) => (
                  <span key={item.key} style={{ "--occurrence-outcome-color": occurrenceOutcomeColor(item.key) } as CSSProperties}>
                    <b>{item.label}</b>
                    <em>{formatMetric(item.total)}</em>
                  </span>
                )) : (
                  <span className="is-empty"><b>Sin motivos no efectivos</b><em>{formatMetric(intentos)} intentos</em></span>
                )}
              </div>
            </article>
          );
        }) : (
          <em>Sin distritos con ocurrencias sincronizadas.</em>
        )}
      </div>
    </section>
  );
}

function occurrenceRegisterStatus(row: OccurrenceRouteUmpRow): Exclude<OccurrenceRegisterFilter, "todos"> {
  if (row.is_unreconciled) return "sin_conciliacion";
  return row.has_report ? "con_registro" : "sin_registro";
}

function occurrenceRegisterStatusLabel(status: Exclude<OccurrenceRegisterFilter, "todos">) {
  if (status === "con_registro") return "CON REPORTE";
  if (status === "sin_conciliacion") return "Sin conciliacion";
  return "SIN REPORTE";
}

function occurrenceRegisterStamp(row: OccurrenceRouteUmpRow) {
  const record = row.records.find((item) => occurrenceRecordStamp(item));
  const stamp = record ? occurrenceRecordStamp(record) : "";
  if (stamp) return stamp;
  if (row.has_report && row.last_report_label && row.last_report_label !== "Sin reporte") return row.last_report_label;
  return "";
}

function occurrenceRegisterReporter(row: OccurrenceRouteUmpRow) {
  const record = row.records.find((item) => String(item.responsable || item.codigo_pulso).trim());
  return String(record?.responsable || record?.codigo_pulso || "").trim();
}

function occurrenceRegisterCsvValue(value: unknown) {
  const textValue = String(value ?? "").replace(/\r?\n/g, " ").trim();
  return /[",;]/.test(textValue) ? `"${textValue.replace(/"/g, '""')}"` : textValue;
}

function occurrenceRegisterDownloadCsv(rows: ReturnType<typeof buildOccurrenceRegisterRows>, suffix = "visibles") {
  const header = [
    "UMP",
    "Reporte_UMP",
    "Responsable",
    "Distrito",
    "Zona",
    "Manzana",
    "Tipo_manzana",
    "Meta",
    "Validas",
    "Revision",
    "No_defendibles",
    "Avance_pct",
    "Brecha",
    "Fecha_reporte",
    "Codigo_pulso_reporte",
  ];
  const body = rows
    .filter((item) => !item.row.is_unreconciled)
    .map((item) => [
      item.row.ump,
      item.statusLabel,
      item.row.responsable || "Sin responsable",
      item.row.distrito,
      item.row.zona,
      item.row.manzana,
      item.row.expected_blocks[0]?.tipo_manzana ?? "",
      item.row.advance_meta,
      item.row.advance_validas,
      item.row.expected_blocks.reduce((sum, block) => sum + Number(block.revision ?? 0), 0),
      item.row.expected_blocks.reduce((sum, block) => sum + Number(block.no_defendibles ?? 0), 0),
      item.row.advance_meta > 0 ? Math.round((item.row.advance_validas / item.row.advance_meta) * 100) : "",
      Math.max(0, item.row.advance_meta - item.row.advance_validas),
      item.row.has_report ? item.registeredAt : "",
      item.row.records.map((record) => occurrenceRecordCode(record)).filter(Boolean).join("; "),
    ]);
  const csv = [header, ...body]
    .map((line) => line.map(occurrenceRegisterCsvValue).join(","))
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reporte_ump_ocurrencias_${suffix}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildOccurrenceRegisterRows(rows: OccurrenceRouteUmpRow[]) {
  return rows.map((row) => {
    const status = occurrenceRegisterStatus(row);
    const statusLabel = occurrenceRegisterStatusLabel(status);
    const registeredAt = occurrenceRegisterStamp(row);
    const reporter = occurrenceRegisterReporter(row);
    const replacementCount = occurrenceRowAppliedReplacementCount(row);
    const dateLabel = registeredAt || (row.has_report ? row.report_window_label : "");
    const title = row.is_unreconciled
      ? `UMP ${row.ump || "S/D"}`
      : `UMP ${row.ump || "S/D"}${row.manzana ? ` · Mz ${row.manzana}` : ""}`;
    const routeMeta = row.is_unreconciled
      ? row.route_match_message || "No cruza con la ruta activa"
      : replacementCount > 0
        ? `${row.route_label || row.distrito || "Ruta activa"} · R cuenta como titular`
        : row.route_label || row.distrito || "Ruta activa";
    const advanceLabel = occurrenceAdvanceProgressLabel(row);
    const sourceLabel = row.is_unreconciled
      ? "Por conciliar"
      : row.has_report
        ? "Reporte UMP"
        : row.advance_started
          ? `${advanceLabel} · sin reporte`
          : "Sin reporte";
    const searchText = [
      row.search_text,
      title,
      routeMeta,
      statusLabel,
      row.responsable,
      reporter,
      dateLabel,
      sourceLabel,
    ].join(" ").toLocaleLowerCase("es-PE");
    return {
      row,
      status,
      statusLabel,
      registeredAt: dateLabel,
      reporter,
      replacementCount,
      sourceLabel,
      title,
      routeMeta,
      searchText,
    };
  }).sort((a, b) => {
    const priority: Record<Exclude<OccurrenceRegisterFilter, "todos">, number> = {
      sin_registro: 0,
      sin_conciliacion: 1,
      con_registro: 2,
    };
    return priority[a.status] - priority[b.status] ||
      String(a.row.distrito).localeCompare(String(b.row.distrito), "es-PE") ||
      String(a.row.ump).localeCompare(String(b.row.ump), "es-PE", { numeric: true }) ||
      a.title.localeCompare(b.title, "es-PE", { numeric: true });
  });
}

function OccurrenceRegisterWorkspace({ rows }: { rows: OccurrenceRouteUmpRow[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OccurrenceRegisterFilter>("todos");
  const [districtFilter, setDistrictFilter] = useState("todos");
  const registerRows = useMemo(() => buildOccurrenceRegisterRows(rows), [rows]);
  const counts = useMemo(() => {
    const expected = registerRows.filter((item) => !item.row.is_unreconciled);
    return {
      expected: expected.length,
      reported: expected.filter((item) => item.status === "con_registro").length,
      missing: expected.filter((item) => item.status === "sin_registro").length,
      unreconciled: registerRows.filter((item) => item.status === "sin_conciliacion").length,
      replacements: expected.filter((item) => item.replacementCount > 0).length,
    };
  }, [registerRows]);
  const districtOptions = useMemo(() => (
    Array.from(new Set(registerRows.map((item) => item.row.distrito).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es-PE"))
  ), [registerRows]);
  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es-PE");
    return registerRows.filter((item) => {
      if (statusFilter !== "todos" && item.status !== statusFilter) return false;
      if (districtFilter !== "todos" && item.row.distrito !== districtFilter) return false;
      return !query || item.searchText.includes(query);
    });
  }, [districtFilter, registerRows, search, statusFilter]);

  return (
    <section className="mon-field-occurrences-register" aria-label="Reporte UMP de ocurrencias" data-occurrence-tab="registro">
      <header className="mon-field-occurrences-register-head">
        <div>
          <span><FileCheck2 size={14} /> Reporte UMP</span>
          <strong>{formatMetric(counts.reported)} con reporte · {formatMetric(counts.missing)} sin reporte</strong>
          {/* Decía «151 visibles de 150 UMP oficiales»: más filas en pantalla que
              universo, porque `expected` excluye las no conciliadas y la lista no.
              El denominador ahora es el mismo universo que se está listando. */}
          <em>{formatMetric(filteredRows.length)} visibles de {formatMetric(registerRows.length)} en la lista · {formatMetric(counts.expected)} UMP oficiales · {formatMetric(counts.unreconciled)} por conciliar</em>
        </div>
        <div className="mon-field-occurrences-register-kpis" aria-label="Resumen del registro UMP">
          <span className="is-total"><strong>{formatMetric(counts.expected)}</strong><em>UMP oficiales</em></span>
          <span className="is-reported"><strong>{formatMetric(counts.reported)}</strong><em>con reporte</em></span>
          <span className="is-missing"><strong>{formatMetric(counts.missing)}</strong><em>sin reporte</em></span>
          <span className="is-review"><strong>{formatMetric(counts.unreconciled)}</strong><em>controles</em></span>
        </div>
      </header>

      <div className="mon-field-occurrences-register-toolbar" aria-label="Filtros del registro de ocurrencias">
        <label className="mon-field-occurrences-search">
          <Search size={14} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar UMP, distrito, responsable o fecha" />
        </label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as OccurrenceRegisterFilter)} aria-label="Filtrar registro por estado">
          <option value="todos">Todos ({formatMetric(registerRows.length)})</option>
          <option value="con_registro">Con reporte ({formatMetric(counts.reported)})</option>
          <option value="sin_registro">Sin reporte ({formatMetric(counts.missing)})</option>
          <option value="sin_conciliacion">Controles ({formatMetric(counts.unreconciled)})</option>
        </select>
        <select value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value)} aria-label="Filtrar registro por distrito">
          <option value="todos">Todos los distritos</option>
          {districtOptions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button type="button" className="pulso-button" onClick={() => occurrenceRegisterDownloadCsv(filteredRows, "visibles")}>
          <Download size={14} />
          CSV UMP
        </button>
      </div>

      <div className="mon-field-occurrences-register-table" role="table" aria-label="Lista simple de UMP con y sin reporte">
        <div className="mon-field-occurrences-register-row is-head" role="row">
          <span role="columnheader">UMP</span>
          <span role="columnheader">Reporte UMP</span>
          <span role="columnheader">Responsable</span>
          <span role="columnheader">Distrito</span>
          <span role="columnheader">Avance</span>
          <span role="columnheader">Fecha reporte</span>
        </div>
        <div className="mon-field-occurrences-register-list" role="rowgroup">
          {filteredRows.map((item) => (
            <article key={item.row.id} className={`mon-field-occurrences-register-row is-${item.status}`} role="row">
              <span className="is-identity" role="cell">
                <strong>{item.title}</strong>
                <em>{item.routeMeta}</em>
              </span>
              <span role="cell">
                <b>{item.statusLabel}</b>
                <em>{item.row.is_unreconciled ? item.row.route_match_status || "revisar" : item.row.has_report ? "reporte único por UMP" : "pendiente"}</em>
              </span>
              <span role="cell">
                <strong>{item.row.responsable || "Sin responsable"}</strong>
                <em>{item.replacementCount > 0 ? `${formatMetric(item.replacementCount)} R bajo titular` : "asignado en ruta"}</em>
              </span>
              <span role="cell">
                <strong>{item.row.distrito || "Sin distrito"}</strong>
                <em>{compactParts([item.row.zona ? `Zona ${item.row.zona}` : "", item.row.manzana ? `Mz ${item.row.manzana}` : ""]) || "Sin manzana"}</em>
              </span>
              <span role="cell">
                <strong>{occurrenceAdvanceProgressLabel(item.row)}</strong>
                <em>{item.row.advance_last_activity || item.row.advance_quota_status || "sin avance"}</em>
              </span>
              <span role="cell">
                <strong>{item.row.has_report ? item.registeredAt || "Con reporte" : "Sin reporte"}</strong>
                <em>{item.sourceLabel}</em>
              </span>
            </article>
          ))}
          {!filteredRows.length ? (
            <p className="mon-field-occurrences-register-empty">Sin UMP para estos filtros.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

const OCCURRENCE_MISSING_STATES: OccurrenceUmpAttentionStatus[] = [
  "sin_reporte", "iniciada_sin_reporte", "incompleta_sin_reporte", "completa_sin_reporte",
];

function OccurrenceUmpWorkspace({ rows, allRows, onExportUmp }: {
  rows: OccurrenceRouteUmpRow[];
  allRows: OccurrenceRouteUmpRow[];
  onExportUmp?: (opts: { responsable?: string; only_missing?: boolean }) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | OccurrenceUmpAttentionStatus>("todos");
  const [districtFilter, setDistrictFilter] = useState("todos");
  const [responsableFilter, setResponsableFilter] = useState("todos");
  const [outcomeFilter, setOutcomeFilter] = useState("todos");
  const [selectedId, setSelectedId] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const districtOptions = useMemo(() => (
    Array.from(new Set(rows.map((row) => row.distrito).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es-PE"))
  ), [rows]);
  const responsableOptions = useMemo(() => (
    Array.from(new Set(rows.map((row) => row.responsable).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es-PE"))
  ), [rows]);
  const outcomeOptions = useMemo(() => {
    const pairs = new Map<string, string>();
    rows.forEach((row) => {
      if (row.dominant_outcome?.key) pairs.set(row.dominant_outcome.key, row.dominant_outcome.label);
    });
    return Array.from(pairs.entries()).sort((a, b) => a[1].localeCompare(b[1], "es-PE"));
  }, [rows]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    if (statusFilter !== "todos" && row.status !== statusFilter) return false;
    if (districtFilter !== "todos" && row.distrito !== districtFilter) return false;
    if (responsableFilter !== "todos" && row.responsable !== responsableFilter) return false;
    if (outcomeFilter !== "todos" && row.dominant_outcome?.key !== outcomeFilter) return false;
    const q = search.trim().toLocaleLowerCase("es-PE");
    return !q || row.search_text.includes(q);
  }), [districtFilter, outcomeFilter, responsableFilter, rows, search, statusFilter]);
  const selectedRow = filteredRows.find((row) => row.id === selectedId) ?? filteredRows[0] ?? null;
  const counts = useMemo(() => {
    const expectedRows = allRows.filter((row) => !row.is_unreconciled);
    const missingAdvanceRows = expectedRows.filter((row) => row.advance_started && !row.has_report);
    return {
      expected: expectedRows.length,
      reportadas: expectedRows.filter((row) => row.has_report).length,
      efectivas: expectedRows.filter((row) => row.status === "reportada_efectiva").length,
      noEfectivas: expectedRows.filter((row) => row.status === "reportada_no_efectiva").length,
      completasSinReporte: expectedRows.filter((row) => row.status === "completa_sin_reporte").length,
      incompletasSinReporte: expectedRows.filter((row) => row.status === "incompleta_sin_reporte").length,
      iniciadasSinReporte: missingAdvanceRows.length,
      validasSinReporte: missingAdvanceRows.reduce((sum, row) => sum + row.advance_validas, 0),
      ultimaSinReporte: latestOccurrenceDateLabel(missingAdvanceRows.map((row) => row.advance_last_activity)),
      sinConciliacion: allRows.filter((row) => row.is_unreconciled).length,
      sinReporte: expectedRows.filter((row) => !row.has_report).length,
      replacementFamilies: expectedRows.filter((row) => occurrenceRowAppliedReplacementCount(row) > 0).length,
      expectedBlocks: expectedRows.reduce((sum, row) => sum + row.expected_blocks.length, 0),
    };
  }, [allRows]);
  useEffect(() => {
    if (!selectedRow) setDetailOpen(false);
  }, [selectedRow]);
  const coverageSummary = counts.sinConciliacion
    ? `${formatMetric(counts.expected)} UMP titulares · ${formatMetric(counts.sinConciliacion)} sin conciliacion · ${formatMetric(filteredRows.length)} visibles`
    : `${formatMetric(counts.expected)} UMP titulares · ${formatMetric(filteredRows.length)} visibles`;

  // El inspector cambiaba de lado según la paridad de la fila: abrir la UMP 22 lo
  // ponía a la derecha y la 23 a la izquierda. Nada en el dato justifica el salto,
  // y obliga a rastrear con la vista dónde apareció el detalle cada vez. Posición
  // fija: siempre a la derecha, como el resto de inspectores del sistema.
  const openDetail = useCallback((row: OccurrenceRouteUmpRow) => {
    setSelectedId(row.id);
    setDetailOpen(true);
  }, []);

  return (
    <section className="mon-field-occurrences-workspace" aria-label="Cobertura por UMP">
      <header className="mon-field-occurrences-workspace-head">
        <div className="mon-field-occurrences-workspace-title">
          <span><Route size={14} /> Lista completa de UMP</span>
          {/* El titular decía «150 titulares · 138 con registro · 12 sin registro»,
              que es palabra por palabra el de Reporte UMP: dos pestañas con el
              mismo encabezado y nada que explicara en qué se diferencian. Esta
              lidera con el resultado de la ocurrencia, que es su eje propio;
              el cumplimiento de entrega es el de la pestaña vecina. */}
          <strong>{formatMetric(counts.efectivas)} efectivas · {formatMetric(counts.noEfectivas)} no efectivas</strong>
          <em>Mismo universo que Reporte UMP ({formatMetric(counts.expected)} titulares); acá manda qué pasó dentro de cada una · {formatMetric(counts.expectedBlocks)} manzanas activas</em>
        </div>
        {/* Diez indicadores con el mismo peso no jerarquizan nada. Se separan los
            que piden acción de los que solo dan contexto. */}
        <div className="mon-field-occurrences-workspace-stats is-attention" aria-label="UMP que piden atención">
          <span className="is-sin_reporte"><strong>{formatMetric(counts.sinReporte)}</strong><em>sin reporte</em></span>
          <span className="is-completa_sin_reporte"><strong>{formatMetric(counts.completasSinReporte)}</strong><em>completas sin ocurrencias</em></span>
          <span className="is-incompleta_sin_reporte"><strong>{formatMetric(counts.incompletasSinReporte)}</strong><em>incompletas sin ocurrencias</em></span>
          <span className="is-iniciada_sin_reporte"><strong>{formatMetric(counts.validasSinReporte)}</strong><em>validas sin ocurrencias{counts.ultimaSinReporte ? ` · ${counts.ultimaSinReporte}` : ""}</em></span>
          <span className="is-revisar_cruce"><strong>{formatMetric(counts.sinConciliacion)}</strong><em>sin conciliacion</em></span>
        </div>
        <div className="mon-field-occurrences-workspace-stats is-context" aria-label="Contexto de cobertura UMP">
          <span className="is-total"><strong>{formatMetric(counts.expected)}</strong><em>UMP titulares</em></span>
          <span className="is-reported"><strong>{formatMetric(counts.reportadas)}</strong><em>con registro</em></span>
          <span className="is-reportada_efectiva"><strong>{formatMetric(counts.efectivas)}</strong><em>efectivas</em></span>
          <span className="is-reportada_no_efectiva"><strong>{formatMetric(counts.noEfectivas)}</strong><em>no efectivas</em></span>
          <span className="is-replacement"><strong>{formatMetric(counts.replacementFamilies)}</strong><em>reemplazo usado como titular</em></span>
        </div>
      </header>

      <div className="mon-field-occurrences-workspace-filters" aria-label="Filtros de cobertura UMP">
        <label className="mon-field-occurrences-search">
          <Search size={14} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar UMP, manzana, distrito o responsable" />
        </label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "todos" | OccurrenceUmpAttentionStatus)} aria-label="Filtrar por estado UMP">
          <option value="todos">Todos los estados</option>
          <option value="reportada_efectiva">Con reporte efectivo</option>
          <option value="reportada_no_efectiva">Con reporte no efectivo</option>
          <option value="revisar_cruce">Cruce por revisar</option>
          <option value="completa_sin_reporte">Completa sin reporte</option>
          <option value="incompleta_sin_reporte">Incompleta sin reporte</option>
          <option value="iniciada_sin_reporte">Iniciada sin reporte</option>
          <option value="sin_reporte">Sin reporte</option>
        </select>
        <select value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value)} aria-label="Filtrar por distrito">
          <option value="todos">Todos los distritos</option>
          {districtOptions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={responsableFilter} onChange={(event) => setResponsableFilter(event.target.value)} aria-label="Filtrar por responsable">
          <option value="todos">Todos los responsables</option>
          {responsableOptions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={outcomeFilter} onChange={(event) => setOutcomeFilter(event.target.value)} aria-label="Filtrar por motivo predominante">
          <option value="todos">Todos los motivos</option>
          {outcomeOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        {onExportUmp ? (
          <button
            type="button"
            className="pulso-button"
            onClick={() => onExportUmp({
              responsable: responsableFilter !== "todos" ? responsableFilter : undefined,
              only_missing: OCCURRENCE_MISSING_STATES.includes(statusFilter as OccurrenceUmpAttentionStatus),
            })}
            title="Exporta a Excel las UMP con los filtros aplicados (responsable / faltantes)"
          >
            <Download size={14} />
            Excel
          </button>
        ) : null}
      </div>

      <div className={`mon-field-occurrences-board ${detailOpen && selectedRow ? "is-detail-open is-detail-right" : ""}`}>
        <section className="mon-field-occurrences-ump-index" aria-label="Lista operativa de UMP">
          <header>
            <div>
              <span>Cobertura territorial</span>
              <strong>{formatMetric(filteredRows.length)} visibles</strong>
            </div>
            <em>Ordenadas por estado y resultado</em>
          </header>
          <div className="mon-field-occurrences-ump-rows" role="listbox" aria-label="UMP esperadas y sin conciliacion">
            {filteredRows.map((row) => (
              <OccurrenceUmpListRow key={row.id} row={row} selected={detailOpen && row.id === selectedRow?.id} onSelect={() => openDetail(row)} />
            ))}
            {!filteredRows.length && <p className="mon-field-occurrences-connect-note">Sin UMP para estos filtros.</p>}
          </div>
        </section>
        {detailOpen && selectedRow ? <OccurrenceUmpDetail row={selectedRow} side="right" onClose={() => setDetailOpen(false)} /> : null}
      </div>
    </section>
  );
}

function OccurrenceStatusBadge({ status, label }: { status: OccurrenceUmpAttentionStatus; label?: string }) {
  const meta = OCCURRENCE_STATUS_META[status];
  const icon = status === "reportada_efectiva"
    ? <CheckCircle2 size={12} />
    : status === "reportada_no_efectiva"
      ? <ClipboardCheck size={12} />
      : status === "revisar_cruce"
        ? <AlertTriangle size={12} />
        : <Clock size={12} />;
  return <span className={`mon-field-occurrences-status is-${status}`}>{icon}{label ?? meta.label}</span>;
}

function OccurrenceUmpListRow({
  row,
  selected,
  onSelect,
}: {
  row: OccurrenceRouteUmpRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const effectivePct = row.intentos > 0 ? Math.max(0, Math.min(100, (row.efectivas / row.intentos) * 100)) : 0;
  const nonEffectivePct = row.intentos > 0 ? Math.max(0, Math.min(100, (row.no_efectivas / row.intentos) * 100)) : 0;
  const unexpectedUmp = row.is_unreconciled;
  const missingWithAdvance = !unexpectedUmp && !row.has_report && row.advance_started;
  const replacementCount = occurrenceRowAppliedReplacementCount(row);
  const hasReplacementFamily = !unexpectedUmp && replacementCount > 0;
  const advanceProgress = occurrenceAdvanceProgressLabel(row);
  const title = unexpectedUmp ? "UMP sin conciliacion" : `UMP ${row.ump || "S/D"}${row.manzana ? ` · Mz ${row.manzana}` : ""}`;
  const identityLabel = unexpectedUmp
    ? `Declarada ${row.ump || "S/D"} · requiere cruce`
    : hasReplacementFamily
      ? `${row.route_label || row.distrito || "Ruta esperada"} · reemplazo cuenta como titular`
      : row.route_label || `${row.distrito || "Sin distrito"}${row.zona ? ` · Zona ${row.zona}` : ""}`;
  const rate = row.tasa_no_efectiva == null ? "S/D" : formatPercentLabel(row.tasa_no_efectiva * 100);
  const resultLabel = unexpectedUmp
    ? "No vinculada a una UMP esperada"
    : row.status === "completa_sin_reporte"
      ? "Cuota completa sin registro de ocurrencias"
      : row.status === "incompleta_sin_reporte"
        ? "Cuota incompleta sin registro de ocurrencias"
        : row.status === "iniciada_sin_reporte"
          ? "Iniciada sin registro de ocurrencias"
    : row.has_report
      ? row.dominant_outcome?.label ?? (row.no_efectivas > 0 ? "No efectiva sin motivo" : "Consolidado efectivo")
      : "Sin reporte registrado";
  const resultMeta = unexpectedUmp
    ? row.route_match_message || `La UMP declarada ${row.ump || "S/D"} queda fuera del marco hasta conciliarse.`
    : missingWithAdvance
      ? `${advanceProgress}${row.advance_last_activity ? ` · ultimo ingreso ${row.advance_last_activity}` : ""}`
    : row.has_report
    ? `${formatMetric(row.efectivas)} efectivas · ${formatMetric(row.no_efectivas)} no efectivas · ${rate} no efectiva`
    : "Esperada en hoja de ruta";
  const sourceMeta = missingWithAdvance
    ? `${advanceProgress}${row.advance_last_activity ? ` · ${row.advance_last_activity}` : ""} · ocurrencias pendiente`
    : row.has_report
      ? `${formatMetric(row.reportes)} reporte${row.reportes === 1 ? "" : "s"} · ${formatMetric(row.intentos)} intento${row.intentos === 1 ? "" : "s"}`
      : "Pendiente de sincronizacion";
  const resultColor = row.dominant_outcome ? occurrenceOutcomeColor(row.dominant_outcome.key) : "var(--occurrence-status-color)";
  return (
    <button type="button" className={`mon-field-occurrences-ump-row is-${row.status} ${missingWithAdvance ? "is-advance-missing" : ""} ${hasReplacementFamily ? "is-replacement-family" : ""} ${selected ? "is-selected" : ""}`} onClick={onSelect} role="option" aria-selected={selected}>
      <div className="mon-field-occurrences-ump-row-main">
        <div className="mon-field-occurrences-ump-identity">
          <span>{title}</span>
          <strong>{identityLabel}</strong>
        </div>
        <OccurrenceStatusBadge status={row.status} label={unexpectedUmp ? "Sin conciliacion" : undefined} />
      </div>
      <div className="mon-field-occurrences-ump-row-signal">
        <div className={`mon-field-occurrences-ump-meter ${row.has_report ? "" : "is-empty"}`} aria-hidden="true">
          <span style={{ width: row.has_report ? "100%" : "0%" }}>
            <i className="is-effective" style={{ width: `${effectivePct}%` }} />
            <i className="is-noneffective" style={{ width: `${nonEffectivePct}%` }} />
          </span>
        </div>
        <div className="mon-field-occurrences-ump-row-result" style={{ "--occurrence-outcome-color": resultColor } as CSSProperties}>
          <strong>{resultLabel}</strong>
          <em>{resultMeta}</em>
        </div>
      </div>
      <div className="mon-field-occurrences-ump-row-meta">
        <span>{unexpectedUmp ? "UMP sin conciliacion" : row.distrito || "Sin distrito"}</span>
        <span>{row.responsable || "Sin responsable"}</span>
        {hasReplacementFamily ? <span>{formatMetric(replacementCount)} reemplazo{replacementCount === 1 ? "" : "s"} usado{replacementCount === 1 ? "" : "s"} como titular</span> : null}
        <span>{sourceMeta}</span>
      </div>
    </button>
  );
}

function OccurrenceUmpDetail({
  row,
  side = "right",
  onClose,
}: {
  row: OccurrenceRouteUmpRow;
  side?: "left" | "right";
  onClose: () => void;
}) {
  const total = Math.max(1, row.intentos);
  const effectivePct = Math.max(0, Math.min(100, (row.efectivas / total) * 100));
  const nonEffectivePct = Math.max(0, Math.min(100, (row.no_efectivas / total) * 100));
  const topOutcomes = [...row.outcomes].filter((item) => item.total > 0).sort((a, b) => b.total - a.total).slice(0, 6);
  const unexpectedUmp = row.is_unreconciled;
  const missingWithAdvance = !unexpectedUmp && !row.has_report && row.advance_started;
  const replacementCount = occurrenceRowAppliedReplacementCount(row);
  const activeBlockCount = row.expected_blocks.length;
  const advanceProgress = occurrenceAdvanceProgressLabel(row);
  const missingNoticeTitle = row.status === "completa_sin_reporte"
    ? "UMP completa sin registro de ocurrencias"
    : row.status === "incompleta_sin_reporte"
      ? "UMP incompleta sin registro de ocurrencias"
      : "UMP iniciada sin registro de ocurrencias";
  const missingNoticeText = row.status === "completa_sin_reporte"
    ? "Ya cumple la cuota de avance, pero falta el registro operativo de ocurrencias."
    : row.status === "incompleta_sin_reporte"
      ? "Ya registra avance valido, todavia no completa cuota y falta el registro operativo de ocurrencias."
      : "Registra avance territorial valido, pero falta el registro operativo de ocurrencias.";
  const title = unexpectedUmp ? "UMP sin conciliacion" : `UMP ${row.ump || "S/D"}${row.manzana ? ` · Mz ${row.manzana}` : ""}`;
  const subtitle = unexpectedUmp
    ? `Declarada ${row.ump || "S/D"} · pendiente de cruce con ruta esperada`
    : row.route_label || row.distrito || "Sin ruta asignada";
  const rate = row.tasa_no_efectiva == null ? "S/D" : formatPercentLabel(row.tasa_no_efectiva * 100);
  const districtLabel = row.distrito || (unexpectedUmp ? "UMP sin conciliacion" : "Sin distrito");
  const reasonLabels = row.attention_reasons.map((reason) => OCCURRENCE_REASON_LABELS[reason] ?? reason);
  const sourceRows = row.records.slice(0, 8);
  const sourceTotal = row.records.length;
  const sourceOverflow = Math.max(0, sourceTotal - sourceRows.length);
  return (
    <section
      className={`mon-field-occurrences-ump-detail is-${row.status} ${missingWithAdvance ? "is-advance-missing" : ""} is-${side}`}
      aria-label="Detalle de UMP seleccionada"
      aria-modal="false"
      role="dialog"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <header className="mon-field-occurrences-detail-head">
        <div>
          <span>Detalle de recorrido</span>
          <strong>{title}</strong>
          <em>{subtitle}</em>
        </div>
        <div className="mon-field-occurrences-detail-actions">
          <OccurrenceStatusBadge status={row.status} label={unexpectedUmp ? "Sin conciliacion" : undefined} />
          <button type="button" className="mon-field-occurrences-detail-close" onClick={onClose} aria-label="Cerrar detalle">
            <X size={14} />
          </button>
        </div>
      </header>

      {unexpectedUmp ? (
        <section className="mon-field-occurrences-detail-notice">
          <AlertTriangle size={14} />
          <div>
            <strong>UMP declarada sin conciliacion</strong>
            <span>{row.route_match_message || `La UMP declarada ${row.ump || "S/D"} no se incluye como UMP esperada hasta reconciliarse con la ruta activa.`}</span>
          </div>
        </section>
      ) : null}

      {missingWithAdvance ? (
        <section className="mon-field-occurrences-detail-notice is-advance-missing">
          <Clock size={14} />
          <div>
            <strong>{missingNoticeTitle}</strong>
            <span>{missingNoticeText} {advanceProgress}{row.advance_last_activity ? ` · ultimo ingreso ${row.advance_last_activity}` : ""}.</span>
          </div>
        </section>
      ) : null}

      {!unexpectedUmp && replacementCount > 0 ? (
        <section className="mon-field-occurrences-detail-notice is-replacement-family">
          <Route size={14} />
          <div>
            <strong>Reemplazo usado como titular</strong>
            <span>{formatMetric(replacementCount)} reemplazo{replacementCount === 1 ? "" : "s"} se cuenta{replacementCount === 1 ? "" : "n"} dentro de UMP {row.ump || "S/D"} porque el formulario de ocurrencias no registra sufijo R.</span>
          </div>
        </section>
      ) : null}

      {row.observation_excerpt ? (
        <section className="mon-field-occurrences-detail-notice">
          <ShieldAlert size={14} />
          <div>
            <strong>Observacion reportada</strong>
            <span>{row.observation_excerpt}</span>
          </div>
        </section>
      ) : null}

      <div className="mon-field-occurrences-detail-kpis">
        <OccurrenceDetailMetric label="intentos" value={formatMetric(row.intentos)} />
        <OccurrenceDetailMetric label="efectivas" value={formatMetric(row.efectivas)} tone="effective" />
        <OccurrenceDetailMetric label="no efectivas" value={formatMetric(row.no_efectivas)} tone="noneffective" />
        <OccurrenceDetailMetric label="validas avance" value={occurrenceAdvanceProgressLabel(row)} />
        <OccurrenceDetailMetric label="reportes fuente" value={formatMetric(sourceTotal)} />
        {replacementCount > 0 ? <OccurrenceDetailMetric label="reemplazos usados" value={formatMetric(replacementCount)} tone="replacement" /> : null}
        {activeBlockCount > 1 ? <OccurrenceDetailMetric label="manzanas activas" value={formatMetric(activeBlockCount)} /> : null}
      </div>
      <div className="mon-field-occurrences-detail-meter" aria-label="Composicion efectiva y no efectiva">
        <span className="is-effective" style={{ width: `${effectivePct}%` }} />
        <span className="is-noneffective" style={{ width: `${nonEffectivePct}%` }} />
      </div>
      {reasonLabels.length ? (
        <section className="mon-field-occurrences-detail-section">
          <header><AlertTriangle size={14} /><strong>Razones de atencion</strong><em>{formatMetric(reasonLabels.length)}</em></header>
          <div className="mon-field-occurrences-reasons">
            {reasonLabels.map((label) => <span key={label}>{label}</span>)}
          </div>
        </section>
      ) : null}
      <div className="mon-field-occurrences-detail-grid">
        <section>
          <header><ShieldAlert size={14} /><strong>Motivos predominantes</strong></header>
          <div className="mon-field-occurrences-detail-outcomes">
            {topOutcomes.length ? topOutcomes.map((item) => (
              <article key={item.key}>
                <span>{item.label}</span>
                <strong>{formatMetric(item.total)}</strong>
              </article>
            )) : <em>Sin motivos no efectivos reportados.</em>}
          </div>
        </section>
        <section>
          <header><Clock size={14} /><strong>Ventana reportada</strong></header>
          <div className="mon-field-occurrences-detail-facts">
            <p><span>Ultimo reporte</span><strong>{row.last_report_label}</strong></p>
            <p><span>Horario</span><strong>{row.report_window_label}</strong></p>
            <p><span>Responsable</span><strong>{row.responsable || "Sin responsable"}</strong></p>
            <p><span>Distrito</span><strong>{districtLabel}</strong></p>
            <p><span>Estado cuota avance</span><strong>{row.advance_quota_status || (row.advance_complete ? "Completa" : row.advance_started ? "Cuota pendiente" : "Sin avance")}</strong></p>
            <p><span>Tasa no efectiva</span><strong>{rate}</strong></p>
            <p><span>Ruta/cruce</span><strong>{row.route_match_message || row.route_match_status || (row.has_report ? "Reporte conciliado" : "Esperada en ruta")}</strong></p>
            <p><span>Fuente</span><strong>{row.source_row_ids.length ? `${formatMetric(row.source_row_ids.length)} filas Kobo` : "Sin filas fuente"}</strong></p>
          </div>
        </section>
      </div>

      <section className="mon-field-occurrences-detail-section is-records">
        <header><FileCheck2 size={14} /><strong>Registros fuente</strong><em>{formatMetric(sourceTotal)} filas{sourceOverflow ? ` · +${formatMetric(sourceOverflow)}` : ""}</em></header>
        <div>
          {sourceRows.length ? sourceRows.map((record, index) => {
            const code = occurrenceRecordCode(record);
            const place = occurrenceRecordPlace(record);
            const stamp = occurrenceRecordStamp(record);
            const routeMessage = occurrenceRecordRouteMessage(record);
            const note = compactParts([record.observaciones, routeMessage, place]);
            return (
              <article key={`${record.row_id || code}:${index}`}>
                <strong>{code}</strong>
                <span>{stamp || "Sin fecha reportada"}</span>
                <em>{note || "Sin observacion ni mensaje de ruta"}</em>
              </article>
            );
          }) : <em>Sin registros fuente asociados a esta UMP.</em>}
        </div>
      </section>
    </section>
  );
}

function OccurrenceDetailMetric({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <span className={tone ? `is-${tone}` : ""}>
      <strong>{value}</strong>
      <em>{label}</em>
    </span>
  );
}

function OccurrenceAlertReviewRow({ item }: { item: OccurrenceAlertReviewItem }) {
  const icon = item.kind === "missing"
    ? <Route size={14} />
    : item.kind === "observations"
      ? <ShieldAlert size={14} />
      : item.kind === "outside_route"
        ? <AlertTriangle size={14} />
        : <BarChart3 size={14} />;
  const meta = OCCURRENCE_ALERT_META[item.kind];
  return (
    <article className={`mon-field-occurrences-alert-row is-${item.kind}`} role="listitem">
      <span className="mon-field-occurrences-alert-icon" aria-hidden="true">{icon}</span>
      <div>
        <span>{meta.label}</span>
        <strong>{item.title}</strong>
        <em>{item.meta || "Sin contexto territorial"}</em>
        {item.detail ? <p>{item.detail}</p> : null}
      </div>
      <b>{item.value}</b>
    </article>
  );
}

function OccurrenceAlertLine({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <p className={value ? "is-warning" : "is-ready"}>
      <strong>{formatMetric(value)}</strong>
      <span>{label}</span>
      {hint ? <small>{hint}</small> : null}
    </p>
  );
}

// React.memo (unidad 3.6): la página re-renderiza en cada poll de sync y
// transición de scopes; con props estabilizadas en el caller, este workbench
// solo se re-renderiza cuando cambian sus datos reales.
export const TerritorialFieldOccurrencesWorkbench = memo(TerritorialFieldOccurrencesWorkbenchImpl);
