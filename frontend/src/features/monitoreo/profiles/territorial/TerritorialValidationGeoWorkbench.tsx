import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { ArrowRight, CheckCircle2, ChevronDown, ClipboardCheck, Loader2, MapPin, Maximize2, Minus, Plus, Route, Save, Trash2, XCircle } from "lucide-react";
import {
  apiHojasRutaBlockMap,
  apiHojasRutaZoneMap,
  apiMonitoreoTerritorialReconciliationBatch,
  apiMonitoreoTerritorialSpatialReconciliationDismiss,
  apiMonitoreoTerritorialSpatialReconciliationDismissPattern,
  type HojasRutaBlockMap,
  type HojasRutaBlockMapFeature,
  type HojasRutaContextMapFeature,
  type HojasRutaStreetMapFeature,
  type HojasRutaZoneMap,
  type HojasRutaZoneMapFeature,
  type MonitoreoState,
  type MonitoreoTerritorialDashboard,
  type MonitoreoTerritorialPhase,
  type MonitoreoTerritorialReconciliationBatchChange,
  type MonitoreoTerritorialSpatialQuotaImpact,
  type MonitoreoTerritorialSpatialReconciliationCandidate,
  type MonitoreoTerritorialSpatialReconciliationPattern,
  type MonitoreoTerritorialSpatialReconciliationSummary,
  type MonitoreoTerritorialUmpReconciliation,
  type TerritorialBlockProgress,
  type TerritorialResponseAuditRow,
} from "../../../../api/client";
import { normalizeRouteBlockCode } from "../../routeCoverageModel";
import {
  loadTerritorialRouteCartography,
  sampleTerritorialContextFeatures,
  sampleTerritorialStreetFeatures,
  territorialContextClass,
  territorialContextFeaturePath,
  territorialStreetPath,
} from "./TerritorialRouteCoverageAtlas";
import districtCoverage from "../../../hojasRuta/limaDistrictCoverage.json";

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 620;
const VALIDATION_FOCUS_ZONE_CONTEXT_LIMIT = 96;
const VALIDATION_NEIGHBOR_CONTEXT_LIMIT = 140;
const VALIDATION_NEIGHBOR_CONTEXT_RADIUS_M = 500;
const VALIDATION_SELECTED_GROUP_ZOOM = 3.1;
const VALIDATION_SELECTED_BLOCK_CLICK_ZOOM = 3.85;
const VALIDATION_SELECTED_POINT_ZOOM = 4.2;
const VALIDATION_MAP_MIN_ZOOM = 0.85;
const VALIDATION_MAP_MAX_ZOOM = 5;
const VALIDATION_MAP_ANIMATION_MS = 520;
const VALIDATION_MAP_CONTROL_ANIMATION_MS = 260;
const VALIDATION_WHEEL_PAN_SENSITIVITY = 0.24;
const VALIDATION_WHEEL_PAN_MAX = 24;
const VALIDATION_WHEEL_ZOOM_SENSITIVITY = 0.0042;
const VALIDATION_WHEEL_ZOOM_MAX_DELTA = 32;

type TerritorialValidationGeoWorkbenchProps = {
  reports: MonitoreoTerritorialDashboard;
  selectedResponseId?: string;
  onOpenReconciliation?: () => void;
};

type TerritorialCartographyBundle = {
  blockMap: HojasRutaBlockMap | null;
  zoneMap: HojasRutaZoneMap | null;
};

type TerritorialDistrictGeometry =
  | { type: "Polygon"; coordinates: TerritorialGeoPolygon }
  | { type: "MultiPolygon"; coordinates: TerritorialGeoPolygon[] };

type TerritorialDistrictFeature = {
  type: "Feature";
  properties: {
    ubigeo: string;
    distrito: string;
    label_lon: number;
    label_lat: number;
  };
  geometry: TerritorialDistrictGeometry;
};

type TerritorialGeoPoint = [number, number];
type TerritorialGeoRing = TerritorialGeoPoint[];
type TerritorialGeoPolygon = TerritorialGeoRing[];

type TerritorialMapProjection = {
  width: number;
  height: number;
  hasGeometry: boolean;
  project: (lon: number, lat: number) => { x: number; y: number };
};

type TerritorialMapViewportState = {
  zoom: number;
  pan: { x: number; y: number };
};

type TerritorialStreetLabelAnchor = {
  id: string;
  name: string;
  x: number;
  y: number;
  angle: number;
  major: boolean;
  rank: number;
};

type TerritorialSelectedFeature = {
  feature: HojasRutaBlockMapFeature;
  block: TerritorialBlockProgress;
  key: string;
};

type TerritorialGpsCase = {
  row: TerritorialResponseAuditRow;
  block: TerritorialBlockProgress | null;
  routeBlocks: TerritorialBlockProgress[];
  groupKey: string;
  blockLabel: string;
  assignmentLabel: string;
  responsable: string;
  geoDisposition: TerritorialGeoDispositionKey;
  spatialDistrito: string;
  spatialUbigeo: string;
  gpsDiagnosticLabel: string;
};

type TerritorialGeoBlockGroup = {
  key: string;
  block: TerritorialBlockProgress | null;
  routeBlocks: TerritorialBlockProgress[];
  blockLabel: string;
  assignmentLabel: string;
  responsable: string;
  rows: TerritorialGpsCase[];
  gpsCount: number;
  reviewCount: number;
  noDefendibleCount: number;
};

type TerritorialGeoDispositionKey = "en_zona" | "en_distrito" | "fuera_distrito" | "sin_cruce" | "sin_gps";
type TerritorialGeoDistrictSectionKind = "route" | "outside_frame" | "without_cross" | "without_gps";
type TerritorialGeoRiskTone = "ready" | "warning" | "danger" | "muted";
type TerritorialGeoGroupSection = {
  key: string;
  kind: TerritorialGeoDistrictSectionKind;
  distrito: string;
  ubigeo: string;
  caseCount: number;
  groups: TerritorialGeoBlockGroup[];
};

type TerritorialGeoGroupListItem = {
  key: string;
  section: TerritorialGeoGroupSection;
  sectionMeta: string;
  showHeading: boolean;
  group: TerritorialGeoBlockGroup;
};

type TerritorialGeoZoneSummary = {
  selected: boolean;
  inZoneCount: number;
  outsideZoneCount: number;
  outsideDistrictCount: number;
  withoutCrossCount: number;
  withoutGpsCount: number;
  gpsCount: number;
  caseCount: number;
};

type TerritorialGeoGroupRiskSummary = {
  tone: TerritorialGeoRiskTone;
  distanceLabel: string;
  distanceHint: string;
  tags: Array<{ key: string; label: string; tone: TerritorialGeoRiskTone }>;
};

type TerritorialPendingSpatialReconciliationChange = {
  id: string;
  label: string;
  detail: string;
  payload: MonitoreoTerritorialUmpReconciliation;
  status: "pending" | "saving" | "error";
  error?: string;
};

function territorialSpatialPendingChangeStatusLabel(change: TerritorialPendingSpatialReconciliationChange) {
  if (change.status === "saving") return "Guardando";
  if (change.status === "error") return "Revisar";
  return "Pendiente";
}

const LIMA_DISTRICT_FEATURES = (districtCoverage as unknown as { features: TerritorialDistrictFeature[] }).features;
const CARTOGRAPHY_CACHE = new Map<string, Promise<TerritorialCartographyBundle>>();

function TerritorialValidationGeoWorkbenchImpl({
  reports,
  selectedResponseId,
  onOpenReconciliation,
}: TerritorialValidationGeoWorkbenchProps) {
  const routeBlocks = useMemo(() => (
    (reports.route_blocks?.length ? reports.route_blocks : reports.map?.blocks ?? reports.block_progress ?? [])
      .slice()
      .sort(territorialRouteBlockComparator)
  ), [reports]);
  const rows = useMemo(() => territorialRowsForGeoMap(reports), [reports]);
  const effectiveRows = useMemo(() => rows.filter(territorialResponseIsEffective), [rows]);
  const mapPoints = useMemo(() => territorialKoboMapPoints(reports, effectiveRows), [effectiveRows, reports]);
  const routeUbigeos = useMemo(() => Array.from(new Set(
    routeBlocks
      .map((block) => normalizeRouteBlockCode(block.ubigeo))
      .filter(Boolean)
  )), [routeBlocks]);
  const [cartography, setCartography] = useState<Record<string, TerritorialCartographyBundle>>({});
  const [streetFeaturesByUbigeo, setStreetFeaturesByUbigeo] = useState<Record<string, HojasRutaStreetMapFeature[]>>({});
  const [contextFeaturesByUbigeo, setContextFeaturesByUbigeo] = useState<Record<string, HojasRutaContextMapFeature[]>>({});
  const [loadingCartography, setLoadingCartography] = useState(false);
  const [richLayerLoading, setRichLayerLoading] = useState(false);
  const [mapError, setMapError] = useState("");
  const [richLayerError, setRichLayerError] = useState("");
  const loadedZoneFeatures = useMemo(() => (
    Object.values(cartography).flatMap((bundle) => bundle.zoneMap?.geojson?.features ?? [])
  ), [cartography]);
  const cases = useMemo(() => (
    effectiveRows
      .slice()
      .sort((a, b) => {
        const gpsDiff = Number(!territorialResponseHasGps(a)) - Number(!territorialResponseHasGps(b));
        if (gpsDiff !== 0) return gpsDiff;
        return (a.row_index ?? 0) - (b.row_index ?? 0);
      })
      .map((row) => buildTerritorialGpsCase(row, routeBlocks, loadedZoneFeatures))
  ), [effectiveRows, loadedZoneFeatures, routeBlocks]);
  const groups = useMemo(() => buildTerritorialGeoGroups(cases), [cases]);
  const [selectedGroupKey, setSelectedGroupKey] = useState("");
  const [focusPointId, setFocusPointId] = useState("");
  const selectedGroup = useMemo(() => (
    groups.find((group) => group.key === selectedGroupKey) ?? groups[0] ?? null
  ), [groups, selectedGroupKey]);
  const activeCartographyUbigeos = useMemo(() => {
    const selected = Array.from(new Set(
      (selectedGroup?.routeBlocks ?? [])
        .map((block) => normalizeRouteBlockCode(block.ubigeo))
        .filter(Boolean)
    ));
    return selected.length ? selected : routeUbigeos.slice(0, 1);
  }, [routeUbigeos, selectedGroup]);

  useEffect(() => {
    const missing = activeCartographyUbigeos.filter((ubigeo) => !cartography[ubigeo]);
    if (!missing.length) return;
    let cancelled = false;
    setLoadingCartography(true);
    setMapError("");
    Promise.allSettled(missing.map(async (ubigeo) => [ubigeo, await loadTerritorialCartography(ubigeo)] as const))
      .then((results) => {
        if (cancelled) return;
        const next: Record<string, TerritorialCartographyBundle> = {};
        results.forEach((result) => {
          if (result.status !== "fulfilled") return;
          next[result.value[0]] = result.value[1];
        });
        if (Object.keys(next).length) setCartography((current) => ({ ...current, ...next }));
        if (results.some((result) => result.status === "rejected")) {
          setMapError("No se pudo cargar la cartografia local de Hojas de Ruta para la UMP seleccionada.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCartography(false);
      });
    return () => { cancelled = true; };
  }, [activeCartographyUbigeos, cartography]);

  useEffect(() => {
    const missing = activeCartographyUbigeos.filter((ubigeo) => (
      ubigeo && (!streetFeaturesByUbigeo[ubigeo] || !contextFeaturesByUbigeo[ubigeo])
    ));
    if (!missing.length) return;
    let cancelled = false;
    setRichLayerLoading(true);
    setRichLayerError("");
    Promise.allSettled(missing.map(async (ubigeo) => [
      ubigeo,
      await loadTerritorialRouteCartography(ubigeo, { includeRichLayers: true }),
    ] as const))
      .then((results) => {
        if (cancelled) return;
        const nextStreets: Record<string, HojasRutaStreetMapFeature[]> = {};
        const nextContext: Record<string, HojasRutaContextMapFeature[]> = {};
        results.forEach((result) => {
          if (result.status !== "fulfilled") return;
          const [ubigeo, bundle] = result.value;
          nextStreets[ubigeo] = bundle.streetMap?.geojson?.features ?? [];
          nextContext[ubigeo] = bundle.contextMap?.geojson?.features ?? [];
        });
        if (Object.keys(nextStreets).length) setStreetFeaturesByUbigeo((current) => ({ ...current, ...nextStreets }));
        if (Object.keys(nextContext).length) setContextFeaturesByUbigeo((current) => ({ ...current, ...nextContext }));
        if (results.some((result) => result.status === "rejected")) {
          setRichLayerError("No se pudieron cargar todas las capas de calles/contexto para la UMP seleccionada.");
        }
      })
      .finally(() => {
        if (!cancelled) setRichLayerLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeCartographyUbigeos, contextFeaturesByUbigeo, streetFeaturesByUbigeo]);

  const zoneFeatures = useMemo(() => (
    activeCartographyUbigeos.flatMap((ubigeo) => cartography[ubigeo]?.zoneMap?.geojson?.features ?? [])
  ), [activeCartographyUbigeos, cartography]);
  const blockFeatures = useMemo(() => (
    activeCartographyUbigeos.flatMap((ubigeo) => cartography[ubigeo]?.blockMap?.geojson?.features ?? [])
  ), [activeCartographyUbigeos, cartography]);
  const streetFeatures = useMemo(() => (
    sampleTerritorialStreetFeatures(activeCartographyUbigeos.flatMap((ubigeo) => streetFeaturesByUbigeo[ubigeo] ?? []))
  ), [activeCartographyUbigeos, streetFeaturesByUbigeo]);
  const contextFeatures = useMemo(() => (
    sampleTerritorialContextFeatures(activeCartographyUbigeos.flatMap((ubigeo) => contextFeaturesByUbigeo[ubigeo] ?? []))
  ), [activeCartographyUbigeos, contextFeaturesByUbigeo]);
  useEffect(() => {
    if (selectedGroupKey && groups.some((group) => group.key === selectedGroupKey)) return;
    setSelectedGroupKey(groups[0]?.key ?? "");
  }, [groups, selectedGroupKey]);

  useEffect(() => {
    const responseId = String(selectedResponseId ?? "").trim();
    if (!responseId || !groups.length) return;
    const group = groups.find((item) => item.rows.some((row) => row.row.response_id === responseId));
    if (!group) return;
    setSelectedGroupKey(group.key);
    setFocusPointId(responseId);
  }, [groups, selectedResponseId]);

  const spatialCandidateCount = reports.spatial_reconciliation?.metrics?.candidates
    ?? reports.spatial_reconciliation?.candidates?.length
    ?? 0;
  const spatialPatternCount = reports.spatial_reconciliation?.metrics?.patterns
    ?? reports.spatial_reconciliation?.patterns?.length
    ?? 0;
  const spatialReviewCount = spatialCandidateCount + spatialPatternCount;
  const gpsRows = cases.filter((item) => territorialResponseHasGps(item.row));

  return (
    <div className="mon-territorial-validation-geo-workbench">
      <section className="mon-territorial-validation-geo-reconciliation-entry" aria-label="Acceso a reconciliación UMP">
        <div>
          <span><Route size={14} /> Reconciliación UMP</span>
          <strong>{spatialReviewCount ? `${formatMetric(spatialReviewCount)} sospechas por revisar` : "Sin sospechas espaciales"}</strong>
          <p>Revisa casos donde el GPS sugiere otra UMP/manzana sin perder el foco del mapa.</p>
        </div>
        <button type="button" onClick={onOpenReconciliation}>
          <ClipboardCheck size={14} />
          <span>{spatialReviewCount ? "Abrir reconciliación" : "Ver estado"}</span>
        </button>
      </section>

      <TerritorialValidationGeoRouteMap
        blockFeatures={blockFeatures}
        focusPointId={focusPointId}
        groups={groups}
        contextFeatures={contextFeatures}
        loading={loadingCartography}
        mapError={mapError || richLayerError}
        mapPoints={mapPoints}
        richLayerLoading={richLayerLoading}
        routeBlocks={routeBlocks}
        selectedGroup={selectedGroup}
        streetFeatures={streetFeatures}
        ubigeos={activeCartographyUbigeos}
        zoneFeatures={zoneFeatures}
        onFocusPoint={setFocusPointId}
      />

      <TerritorialGeoCaseList
        focusPointId={focusPointId}
        gpsRows={gpsRows}
        groups={groups}
        selectedGroupKey={selectedGroup?.key ?? ""}
        onFocusPoint={setFocusPointId}
        onSelectGroup={(key) => {
          setSelectedGroupKey(key);
          setFocusPointId("");
        }}
      />
    </div>
  );
}

function TerritorialSpatialReconciliationWorkbenchImpl({
  phase,
  reports,
  saving = false,
  onOpenMap,
  onSelectResponse,
  onStateChange,
}: {
  phase: MonitoreoTerritorialPhase;
  reports: MonitoreoTerritorialDashboard;
  saving?: boolean;
  onOpenMap?: () => void;
  onSelectResponse?: (responseId: string) => void;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const summary = reports.spatial_reconciliation ?? null;
  const [queued, setQueued] = useState<TerritorialPendingSpatialReconciliationChange[]>([]);
  const [applying, setApplying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState("");
  const busy = saving || applying;
  const queuedIds = useMemo(() => new Set(queued.map((item) => item.id)), [queued]);
  const candidates = summary?.candidates ?? [];
  const candidatesById = useMemo(() => new Map(candidates.map((candidate) => [candidate.candidate_id, candidate])), [candidates]);
  const focusCandidateInMap = useCallback((candidate: MonitoreoTerritorialSpatialReconciliationCandidate) => {
    const responseId = String(candidate.response_id ?? "").trim();
    if (responseId) onSelectResponse?.(responseId);
    onOpenMap?.();
  }, [onOpenMap, onSelectResponse]);

  const stageCandidate = useCallback((candidate: MonitoreoTerritorialSpatialReconciliationCandidate) => {
    const change = buildPendingSpatialChange(candidate.reconciliation);
    if (!change) return;
    setQueued((current) => [
      ...current.filter((item) => item.id !== change.id),
      change,
    ]);
    setMessage("Caso espacial puesto en cola.");
    focusCandidateInMap(candidate);
  }, [focusCandidateInMap]);

  const stagePattern = useCallback((pattern: MonitoreoTerritorialSpatialReconciliationPattern) => {
    let staged = 0;
    const next: TerritorialPendingSpatialReconciliationChange[] = [];
    spatialPatternCandidateIds(pattern).forEach((candidateId) => {
      const candidate = candidatesById.get(candidateId);
      const change = candidate ? buildPendingSpatialChange(candidate.reconciliation) : null;
      if (!change) return;
      next.push(change);
      staged += 1;
    });
    if (!staged) return;
    setQueued((current) => {
      const nextIds = new Set(next.map((item) => item.id));
      return [
        ...current.filter((item) => !nextIds.has(item.id)),
        ...next,
      ];
    });
    setMessage(`${formatMetric(staged)} casos del patrón puestos en cola.`);
  }, [candidatesById]);

  const dismissCandidate = useCallback(async (candidate: MonitoreoTerritorialSpatialReconciliationCandidate) => {
    if (busy) return;
    setMessage("");
    try {
      const result = await apiMonitoreoTerritorialSpatialReconciliationDismiss({
        candidate_id: candidate.candidate_id,
        evidence_hash: candidate.evidence_hash,
        phase,
        reason: "Descartado desde Monitoreo territorial.",
      });
      if (result.state) onStateChange?.(result.state);
      setMessage("Sospecha espacial descartada.");
    } catch (error) {
      setMessage((error as Error).message || "No se pudo descartar la sospecha espacial.");
    }
  }, [busy, onStateChange, phase]);

  const dismissPattern = useCallback(async (pattern: MonitoreoTerritorialSpatialReconciliationPattern) => {
    if (busy) return;
    setMessage("");
    try {
      const result = await apiMonitoreoTerritorialSpatialReconciliationDismissPattern({
        evidence_hash: pattern.evidence_hash,
        pattern_key: pattern.pattern_key,
        phase,
        reason: "Patrón descartado desde Monitoreo territorial.",
      });
      if (result.state) onStateChange?.(result.state);
      setMessage("Patrón espacial descartado.");
    } catch (error) {
      setMessage((error as Error).message || "No se pudo descartar el patrón espacial.");
    }
  }, [busy, onStateChange, phase]);

  const applyQueued = useCallback(async () => {
    const changes = queued.filter((item) => item.status !== "saving");
    if (!changes.length || busy) return;
    setApplying(true);
    setMessage("");
    setQueued((current) => current.map((item) => ({ ...item, status: "saving", error: "" })));
    try {
      const payload: MonitoreoTerritorialReconciliationBatchChange[] = changes.map((item) => ({
        client_id: item.id,
        kind: "ump",
        reconciliation: {
          ...item.payload,
          phase,
        },
      }));
      const result = await apiMonitoreoTerritorialReconciliationBatch(payload);
      const failed = new Map(result.failed.map((item) => [item.client_id, item.message || "No se pudo guardar."]));
      const applied = new Set(result.applied.map((item) => item.client_id));
      setQueued((current) => current
        .filter((item) => !applied.has(item.id))
        .map((item) => failed.has(item.id)
          ? { ...item, status: "error", error: failed.get(item.id) }
          : { ...item, status: "pending", error: "" }));
      if (result.state) onStateChange?.(result.state);
      setMessage(failed.size
        ? `${formatMetric(applied.size)} guardadas · ${formatMetric(failed.size)} con error`
        : `${formatMetric(applied.size)} reconciliaciones guardadas.`);
      if (!failed.size) setConfirmOpen(false);
    } catch (error) {
      const msg = (error as Error).message || "No se pudo aplicar la cola espacial.";
      setQueued((current) => current.map((item) => ({ ...item, status: "error", error: msg })));
      setMessage(msg);
    } finally {
      setApplying(false);
    }
  }, [busy, onStateChange, phase, queued]);

  return (
    <div className="mon-territorial-validation-geo-workbench mon-territorial-validation-geo-workbench--reconciliation">
      <section className="mon-territorial-validation-geo-spatial" aria-label="Reconciliación espacial de UMP">
        <TerritorialSpatialReconciliationBatchBar
          changes={queued}
          applying={applying}
          message={message}
          saving={saving}
          summary={summary}
          onConfirm={() => setConfirmOpen(true)}
          onDiscard={() => {
            if (busy) return;
            setQueued([]);
            setConfirmOpen(false);
            setMessage("");
          }}
        />
        <TerritorialSpatialReconciliationBatchDialog
          applying={applying}
          changes={queued}
          message={message}
          open={confirmOpen}
          onApply={applyQueued}
          onOpenChange={setConfirmOpen}
        />
        <TerritorialSpatialReconciliationPanel
          summary={summary}
          queuedIds={queuedIds}
          saving={busy}
          onDismissCandidate={dismissCandidate}
          onDismissPattern={dismissPattern}
          onFocusCandidate={focusCandidateInMap}
          onStageCandidate={stageCandidate}
          onStagePattern={stagePattern}
        />
      </section>
    </div>
  );
}

function TerritorialSpatialReconciliationBatchBar({
  changes,
  applying,
  message,
  saving,
  summary,
  onConfirm,
  onDiscard,
}: {
  changes: TerritorialPendingSpatialReconciliationChange[];
  applying: boolean;
  message: string;
  saving: boolean;
  summary: MonitoreoTerritorialSpatialReconciliationSummary | null;
  onConfirm: () => void;
  onDiscard: () => void;
}) {
  const errorCount = changes.filter((item) => item.status === "error").length;
  const candidateCount = summary?.metrics?.candidates ?? summary?.candidates?.length ?? 0;
  const patternCount = summary?.metrics?.patterns ?? summary?.patterns?.length ?? 0;
  const hasQueue = changes.length > 0;
  const fallbackMessage = hasQueue
    ? `${formatMetric(changes.length)} UMP listas para confirmar${errorCount ? ` · ${formatMetric(errorCount)} con error` : ""}`
    : candidateCount || patternCount
      ? `${formatMetric(candidateCount)} candidatas · ${formatMetric(patternCount)} patrones por revisar`
      : "Motor limpio: sin movimientos preparados.";
  return (
    <section className={`mon-territorial-reconciliation-batchbar${hasQueue ? " is-active" : " is-empty"}`} aria-label="Cambios de reconciliación pendientes">
      <div className="mon-territorial-reconciliation-batchcopy">
        <span><ClipboardCheck size={14} /> Cola de reconciliación UMP</span>
        <strong>{hasQueue ? `${formatMetric(changes.length)} cambios listos` : "Sin cambios en cola"}</strong>
        <em>{message || fallbackMessage}</em>
      </div>
      <div className="mon-territorial-reconciliation-batchrail">
        <div className="mon-territorial-reconciliation-batchcounts" aria-label="Conteo de cambios pendientes">
          <span><strong>{formatMetric(changes.length)}</strong><em>En cola</em></span>
          <span><strong>{formatMetric(candidateCount)}</strong><em>Candidatas</em></span>
          <span><strong>{formatMetric(patternCount)}</strong><em>Patrones</em></span>
        </div>
        <div className="mon-territorial-reconciliation-batchactions">
          {hasQueue ? (
            <>
              <button type="button" onClick={onDiscard} disabled={applying || saving}>
                <Trash2 size={13} />
                <span>Descartar</span>
              </button>
              <button type="button" className="is-primary" onClick={onConfirm} disabled={applying || saving}>
                {applying ? <Loader2 size={13} className="pulso-spin" /> : <CheckCircle2 size={13} />}
                <span>Confirmar lote</span>
              </button>
            </>
          ) : (
            <span className="mon-territorial-reconciliation-batchstate">
              <CheckCircle2 size={13} />
              <span>Revisión manual</span>
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function TerritorialSpatialReconciliationBatchDialog({
  applying,
  changes,
  message,
  open,
  onApply,
  onOpenChange,
}: {
  applying: boolean;
  changes: TerritorialPendingSpatialReconciliationChange[];
  message: string;
  open: boolean;
  onApply: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  if (!open) return null;
  return (
    <>
      <div
        className="mon-territorial-dialog-overlay"
        role="presentation"
        onClick={() => { if (!applying) onOpenChange(false); }}
      />
      <section
        className="mon-territorial-reconciliation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="territorial-spatial-reconciliation-title"
        aria-describedby="territorial-spatial-reconciliation-description"
      >
        <header>
          <div>
            <h2 id="territorial-spatial-reconciliation-title">Confirmar reconciliaciones</h2>
            <p id="territorial-spatial-reconciliation-description" data-radix-dialog-description>
              Se aplicarán {formatMetric(changes.length)} cambios UMP espaciales.
            </p>
          </div>
          <button type="button" aria-label="Cerrar confirmación" onClick={() => onOpenChange(false)} disabled={applying}>
            <XCircle size={16} />
          </button>
        </header>
        {message ? <p className="mon-territorial-reconciliation-dialog-message">{message}</p> : null}
        <div className="mon-territorial-reconciliation-confirm-list" aria-label="Cambios por aplicar">
          {changes.length ? changes.map((change) => (
            <article key={change.id} className={`is-ump is-${change.status || "pending"}`}>
              <span>UMP</span>
              <strong>{change.label}</strong>
              <em>{change.detail}</em>
              <small>{territorialSpatialPendingChangeStatusLabel(change)}</small>
              {change.error ? <p>{change.error}</p> : null}
            </article>
          )) : (
            <div className="mon-territorial-reconciliation-confirm-empty">No hay cambios pendientes.</div>
          )}
        </div>
        <footer>
          <button type="button" className="pulso-button" onClick={() => onOpenChange(false)} disabled={applying}>Cancelar</button>
          <button
            type="button"
            className="pulso-button is-primary"
            onClick={() => { void onApply().catch(() => undefined); }}
            disabled={!changes.length || applying}
          >
            {applying ? <Loader2 size={14} className="pulso-spin" /> : <Save size={14} />}
            <span>Aplicar cambios</span>
          </button>
        </footer>
      </section>
    </>
  );
}

function TerritorialSpatialReconciliationPanel({
  summary,
  queuedIds,
  saving,
  onStageCandidate,
  onStagePattern,
  onDismissCandidate,
  onDismissPattern,
  onFocusCandidate,
}: {
  summary: MonitoreoTerritorialSpatialReconciliationSummary | null;
  queuedIds: Set<string>;
  saving: boolean;
  onStageCandidate: (candidate: MonitoreoTerritorialSpatialReconciliationCandidate) => void;
  onStagePattern: (pattern: MonitoreoTerritorialSpatialReconciliationPattern) => void;
  onDismissCandidate: (candidate: MonitoreoTerritorialSpatialReconciliationCandidate) => void;
  onDismissPattern: (pattern: MonitoreoTerritorialSpatialReconciliationPattern) => void;
  onFocusCandidate: (candidate: MonitoreoTerritorialSpatialReconciliationCandidate) => void;
}) {
  const candidates = summary?.candidates ?? [];
  const patterns = summary?.patterns ?? [];
  const metrics = summary?.metrics ?? { candidates: 0, patterns: 0 };
  const candidatesById = useMemo(() => new Map(candidates.map((candidate) => [candidate.candidate_id, candidate])), [candidates]);
  const hasCandidates = candidates.length > 0 || patterns.length > 0;
  return (
    <section className="mon-territorial-spatial-reconciliation-panel">
      <header>
        <div>
          <span><MapPin size={14} /> Reconciliación UMP</span>
          <strong>{hasCandidates ? `${formatMetric(metrics.candidates ?? candidates.length)} sospechas espaciales` : "Sin sospechas espaciales"}</strong>
          <p>Casos donde la UMP declarada y el GPS apuntan a otra manzana. La sugerencia no cambia datos hasta que se pone en cola y se confirma.</p>
        </div>
        <div className="mon-territorial-spatial-reconciliation-metrics">
          <span><strong>{formatMetric(metrics.high_confidence ?? 0)}</strong><em>alta confianza</em></span>
          <span><strong>{formatMetric(metrics.patterns ?? patterns.length)}</strong><em>patrones</em></span>
          <span><strong>{formatMetric((metrics.dismissed_candidates ?? 0) + (metrics.dismissed_patterns ?? 0))}</strong><em>descartadas</em></span>
        </div>
      </header>
      {!hasCandidates ? (
        <div className="mon-territorial-spatial-empty">
          <CheckCircle2 size={18} />
          <div>
            <strong>No hay casos para reconciliar en este corte.</strong>
            <span>{summary?.reason ? `Motor: ${summary.reason}` : "Las UMP declaradas y la evidencia espacial no generan sugerencias pendientes."}</span>
          </div>
        </div>
      ) : (
        <>
          {patterns.length ? (
            <div className="mon-territorial-spatial-patterns" aria-label="Patrones espaciales detectados">
              {patterns.slice(0, 5).map((pattern) => {
                const candidateIds = spatialPatternCandidateIds(pattern);
                const stagedCount = candidateIds.filter((id) => {
                  const candidate = candidatesById.get(id);
                  const pendingId = candidate ? pendingUmpReconciliationId(candidate.reconciliation) : "";
                  return pendingId && queuedIds.has(pendingId);
                }).length;
                const patternQueued = candidateIds.length > 0 && stagedCount === candidateIds.length;
                return (
                  <article key={pattern.pattern_key} className={`mon-territorial-spatial-pattern is-${normalizeMatch(pattern.confidence)}${patternQueued ? " is-queued" : ""}`}>
                    <div>
                      <span>Patrón · {territorialSpatialConfidenceLabel(pattern.confidence)}</span>
                      <strong>{formatMetric(pattern.count)} casos: UMP {pattern.raw_ump || pattern.declared_ump || "-"} → UMP {pattern.target_ump || "-"}</strong>
                      <em>{pattern.responsible || pattern.target_responsible || "Sin responsable"} · {pattern.target_district || "Sin distrito"}</em>
                    </div>
                    <div className="mon-territorial-spatial-pattern-actions">
                      <small>{formatMetric(pattern.score)} pts · {formatMetric(candidateIds.length)} candidatas{stagedCount ? ` · ${formatMetric(stagedCount)} en cola` : ""}</small>
                      <button type="button" onClick={() => onStagePattern(pattern)} disabled={saving || !candidateIds.length || patternQueued}>
                        <ClipboardCheck size={13} />
                        <span>{patternQueued ? "Patrón en cola" : "Poner patrón en cola"}</span>
                      </button>
                      <button type="button" onClick={() => onDismissPattern(pattern)} disabled={saving}>
                        <Trash2 size={13} />
                        <span>Descartar</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
          <div className="mon-territorial-spatial-candidate-grid" aria-label="Casos sugeridos de reconciliación UMP">
            {candidates.slice(0, 8).map((candidate) => {
              const declared = territorialSpatialBlockLabel({
                blockId: candidate.declared_block_id,
                district: candidate.declared_district,
                manzana: candidate.declared_manzana,
                ump: candidate.declared_ump || candidate.raw_ump,
              });
              const target = territorialSpatialBlockLabel({
                blockId: candidate.target_block_id,
                district: candidate.target_district,
                manzana: candidate.target_manzana,
                ump: candidate.target_ump,
              });
              const queued = queuedIds.has(pendingUmpReconciliationId(candidate.reconciliation));
              return (
                <article key={candidate.candidate_id} className={`mon-territorial-spatial-candidate is-${normalizeMatch(candidate.confidence)}${queued ? " is-queued" : ""}`}>
                  <header>
                    <div>
                      <span>{territorialSpatialConfidenceLabel(candidate.confidence)} · {formatMetric(candidate.score)} pts</span>
                      <strong>{candidate.responsible || candidate.target_responsible || "Sin responsable"}</strong>
                    </div>
                    <span className="mon-territorial-spatial-candidate-status">{queued ? "En cola" : "Sugerencia"}</span>
                    <button type="button" onClick={() => onFocusCandidate(candidate)} title="Ver este punto en el mapa">
                      <MapPin size={14} />
                      <span>Mapa</span>
                    </button>
                  </header>
                  <div className="mon-territorial-spatial-route">
                    <div>
                      <span>Declarado</span>
                      <strong>{declared.main}</strong>
                      <em>{declared.detail || candidate.declared_responsible || "Sin detalle"}</em>
                    </div>
                    <ArrowRight size={16} />
                    <div>
                      <span>Candidato</span>
                      <strong>{target.main}</strong>
                      <em>{target.detail || candidate.target_responsible || "Sin detalle"}</em>
                    </div>
                  </div>
                  <div className="mon-territorial-spatial-evidence">
                    {(candidate.evidence ?? []).slice(0, 4).map((item) => (
                      <span key={`${candidate.candidate_id}-${item.key}`} className={`is-${item.tone || "neutral"}`}>{item.label}</span>
                    ))}
                    {candidate.gps_effective_source ? <span>{territorialGpsSourceLabel(candidate.gps_effective_source)}</span> : null}
                    {candidate.distance_m != null ? <span>{formatMetric(candidate.distance_m)} m</span> : null}
                    {candidate.gps_reclassification_note ? <span className="is-positive">{candidate.gps_reclassification_note}</span> : null}
                  </div>
                  <TerritorialSpatialImpactPreview impact={candidate.impact} />
                  <footer>
                    <button type="button" className="is-primary" onClick={() => onStageCandidate(candidate)} disabled={saving || queued}>
                      <ClipboardCheck size={13} />
                      <span>{queued ? "En cola" : "Poner caso en cola"}</span>
                    </button>
                    <button type="button" onClick={() => onDismissCandidate(candidate)} disabled={saving}>
                      <Trash2 size={13} />
                      <span>Descartar</span>
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function TerritorialValidationGeoRouteMap({
  blockFeatures,
  contextFeatures,
  focusPointId,
  groups,
  loading,
  mapError,
  mapPoints,
  richLayerLoading,
  routeBlocks,
  selectedGroup,
  streetFeatures,
  ubigeos,
  zoneFeatures,
  onFocusPoint,
}: {
  blockFeatures: HojasRutaBlockMapFeature[];
  contextFeatures: HojasRutaContextMapFeature[];
  focusPointId: string;
  groups: TerritorialGeoBlockGroup[];
  loading: boolean;
  mapError: string;
  mapPoints: TerritorialKoboMapPoint[];
  richLayerLoading: boolean;
  routeBlocks: TerritorialBlockProgress[];
  selectedGroup: TerritorialGeoBlockGroup | null;
  streetFeatures: HojasRutaStreetMapFeature[];
  ubigeos: string[];
  zoneFeatures: HojasRutaZoneMapFeature[];
  onFocusPoint: (responseId: string) => void;
}) {
  const initialViewport = useMemo<TerritorialMapViewportState>(() => ({ zoom: 1, pan: { x: 0, y: 0 } }), []);
  const [viewport, setViewport] = useState<TerritorialMapViewportState>(initialViewport);
  const viewportRef = useRef<TerritorialMapViewportState>(initialViewport);
  const animationFrameRef = useRef<number | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; panX: number; panY: number } | null>(null);
  const { zoom, pan } = viewport;
  const selectedFeatures = useMemo(() => (
    selectTerritorialMapFeatures(blockFeatures, selectedGroup?.routeBlocks ?? [])
  ), [blockFeatures, selectedGroup]);
  const selectedBlock = selectedGroup?.block ?? null;
  const selectedBlockKey = selectedBlock ? territorialBlockStableKey(selectedBlock) : "";
  const selectedFeature = useMemo(() => (
    selectedBlockKey
      ? selectedFeatures.find((item) => territorialBlockStableKey(item.block) === selectedBlockKey) ?? selectedFeatures[0] ?? null
      : selectedFeatures[0] ?? null
  ), [selectedBlockKey, selectedFeatures]);
  const selectedRouteZoneKeys = useMemo(() => new Set(
    (selectedGroup?.routeBlocks ?? []).flatMap(territorialBlockZoneKeys).filter(Boolean)
  ), [selectedGroup]);
  const routeZoneFeatures = useMemo(() => (
    zoneFeatures.filter((feature) => territorialZoneFeatureKeys(feature).some((key) => selectedRouteZoneKeys.has(key)))
  ), [selectedRouteZoneKeys, zoneFeatures]);
  const activeUbigeos = useMemo(() => new Set(ubigeos), [ubigeos]);
  const districtFeatures = useMemo(() => (
    LIMA_DISTRICT_FEATURES.filter((feature) => activeUbigeos.has(normalizeRouteBlockCode(feature.properties.ubigeo)))
  ), [activeUbigeos]);
  const operationalDispositionByResponseId = useMemo(() => {
    const dispositions = new Map<string, TerritorialGeoDispositionKey>();
    groups.forEach((group) => group.rows.forEach((item) => {
      if (item.row.response_id) dispositions.set(item.row.response_id, item.geoDisposition);
    }));
    return dispositions;
  }, [groups]);
  const operationalMapPoints = useMemo(() => (
    mapPoints.map((point) => {
      const disposition = operationalDispositionByResponseId.get(String(point.response_id || ""));
      return disposition && disposition !== point.geoDisposition
        ? { ...point, geoDisposition: disposition }
        : point;
    })
  ), [mapPoints, operationalDispositionByResponseId]);
  const selectedResponseIds = useMemo(() => (
    new Set((selectedGroup?.rows ?? []).map((item) => item.row.response_id).filter(Boolean))
  ), [selectedGroup]);
  const visiblePoints = useMemo(() => {
    const selectedGroupPoints = operationalMapPoints.filter((point) => selectedResponseIds.has(point.response_id));
    if (selectedGroupPoints.length) return selectedGroupPoints;
    const selectedDistrict = normalizeRouteBlockCode(selectedGroup?.block?.ubigeo);
    const filtered = operationalMapPoints.filter((point) => (
      selectedDistrict && normalizeRouteBlockCode(point.ubigeo) === selectedDistrict
    ));
    return filtered.length ? filtered : operationalMapPoints;
  }, [operationalMapPoints, selectedGroup, selectedResponseIds]);
  const selectedDistrict = normalizeRouteBlockCode(
    selectedBlock?.ubigeo
      || selectedGroup?.routeBlocks[0]?.ubigeo
      || visiblePoints[0]?.ubigeo
  );
  const selectedFeatureAnchor = useMemo(() => (
    selectedFeature ? territorialFeatureGeoCentroid(selectedFeature.feature) : null
  ), [selectedFeature]);
  const contextAnchorPoints = useMemo(() => {
    const anchors = selectedFeatureAnchor ? [selectedFeatureAnchor] : [];
    visiblePoints.slice(0, 16).forEach((point) => {
      if (!Number.isFinite(point.lonValue) || !Number.isFinite(point.latValue)) return;
      anchors.push({ lon: point.lonValue, lat: point.latValue });
    });
    return anchors;
  }, [selectedFeatureAnchor, visiblePoints]);
  const focusZoneFeatures = useMemo(() => selectTerritorialValidationFocusZoneFeatures({
    anchorPoints: contextAnchorPoints,
    blockFeatures,
    radiusMeters: VALIDATION_NEIGHBOR_CONTEXT_RADIUS_M,
    selectedFeatures,
    selectedRouteZoneKeys,
  }), [blockFeatures, contextAnchorPoints, selectedFeatures, selectedRouteZoneKeys]);
  const neighborFeatures = useMemo(() => selectTerritorialValidationNeighborFeatures({
    anchorPoints: contextAnchorPoints,
    blockFeatures,
    excludedFeatures: focusZoneFeatures,
    radiusMeters: VALIDATION_NEIGHBOR_CONTEXT_RADIUS_M,
    selectedDistrict,
    selectedFeatures,
    selectedRouteZoneKeys,
  }), [blockFeatures, contextAnchorPoints, focusZoneFeatures, selectedDistrict, selectedFeatures, selectedRouteZoneKeys]);
  const projectionDistrictFeatures = useMemo(() => (
    selectedFeatures.length || routeZoneFeatures.length || focusZoneFeatures.length || neighborFeatures.length
      ? []
      : districtFeatures.length
        ? districtFeatures
        : LIMA_DISTRICT_FEATURES
  ), [districtFeatures, focusZoneFeatures.length, neighborFeatures.length, routeZoneFeatures.length, selectedFeatures.length]);
  const projection = useMemo(() => buildTerritorialMapProjection(
    [
      ...focusZoneFeatures,
      ...neighborFeatures,
      ...selectedFeatures.map((item) => item.feature),
    ],
    routeZoneFeatures,
    projectionDistrictFeatures,
    visiblePoints,
  ), [focusZoneFeatures, neighborFeatures, projectionDistrictFeatures, routeZoneFeatures, selectedFeatures, visiblePoints]);
  const streetLabelAnchors = useMemo(() => (
    streetFeatures
      .map((feature) => territorialStreetLabelAnchor(feature, projection))
      .filter((label): label is TerritorialStreetLabelAnchor => Boolean(label))
      .sort((a, b) => Number(b.major) - Number(a.major) || a.rank - b.rank)
      .slice(0, zoom >= 3.2 ? 12 : 7)
  ), [projection, streetFeatures, zoom]);
  const hasVisibleRichLayers = streetFeatures.length > 0 || contextFeatures.length > 0;
  const blockingMapLoading = loading && !projection.hasGeometry;
  const backgroundMapLoading = loading && projection.hasGeometry;
  const blockingRichLayerLoading = richLayerLoading && !hasVisibleRichLayers;
  const geoSummary = useMemo(() => summarizeGeoCases(groups.flatMap((group) => group.rows)), [groups]);
  const selectedBlockPoint = useMemo(() => (
    selectedFeature ? territorialFeatureCentroid(selectedFeature.feature, projection) : null
  ), [projection, selectedFeature]);
  const selectedGpsClusterPoint = useMemo(() => (
    territorialPointClusterCentroid(visiblePoints, projection)
  ), [projection, visiblePoints]);
  const selectedGroupPoint = useMemo(() => (
    selectedGroup?.gpsCount
      ? selectedGpsClusterPoint ?? selectedBlockPoint
      : selectedBlockPoint ?? selectedGpsClusterPoint
  ), [selectedBlockPoint, selectedGpsClusterPoint, selectedGroup?.gpsCount]);
  const selectedGpsPoint = useMemo(() => (
    focusPointId
      ? visiblePoints.find((point) => point.response_id === focusPointId) ?? null
      : null
  ), [focusPointId, visiblePoints]);
  const selectedGpsMapPoint = useMemo(() => (
    selectedGpsPoint ? projection.project(selectedGpsPoint.lonValue, selectedGpsPoint.latValue) : null
  ), [projection, selectedGpsPoint]);
  const selectedLabel = selectedBlock
    ? `${territorialRouteOperationalLabel(selectedBlock)} · ${territorialPhysicalBlockLabel(selectedBlock)}`
    : "GPS y manzanas";
  const zoomClass = zoom >= 2.4 ? "is-zoom-blocks" : zoom >= 1.35 ? "is-zoom-detail" : "is-zoom-general";
  const transform = `translate(${pan.x.toFixed(1)} ${pan.y.toFixed(1)}) scale(${zoom.toFixed(3)})`;
  const pointScale = 1 / Math.max(1, zoom);
  const commitViewport = useCallback((next: TerritorialMapViewportState) => {
    viewportRef.current = next;
    setViewport(next);
  }, []);
  const stopViewportAnimation = useCallback(() => {
    if (animationFrameRef.current == null) return;
    window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  }, []);
  const animateViewportTo = useCallback((target: TerritorialMapViewportState, duration = VALIDATION_MAP_ANIMATION_MS) => {
    stopViewportAnimation();
    const start = viewportRef.current;
    const next = territorialMapViewportWithZoom(target, target.zoom);
    const distance = Math.abs(start.zoom - next.zoom) + Math.abs(start.pan.x - next.pan.x) + Math.abs(start.pan.y - next.pan.y);
    if (duration <= 0 || distance < 0.5 || territorialPrefersReducedMotion()) {
      commitViewport(next);
      return;
    }
    const startedAt = window.performance.now();
    const step = (timestamp: number) => {
      const progress = clamp((timestamp - startedAt) / duration, 0, 1);
      const eased = territorialMapViewportEase(progress);
      commitViewport({
        zoom: lerp(start.zoom, next.zoom, eased),
        pan: {
          x: lerp(start.pan.x, next.pan.x, eased),
          y: lerp(start.pan.y, next.pan.y, eased),
        },
      });
      if (progress < 1) {
        animationFrameRef.current = window.requestAnimationFrame(step);
      } else {
        animationFrameRef.current = null;
      }
    };
    animationFrameRef.current = window.requestAnimationFrame(step);
  }, [commitViewport, stopViewportAnimation]);
  const zoomBy = useCallback((factor: number, anchor = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 }, animated = true) => {
    const next = territorialMapZoomAt(viewportRef.current, factor, anchor);
    if (animated) {
      animateViewportTo(next, VALIDATION_MAP_CONTROL_ANIMATION_MS);
      return;
    }
    stopViewportAnimation();
    commitViewport(next);
  }, [animateViewportTo, commitViewport, stopViewportAnimation]);

  useEffect(() => () => stopViewportAnimation(), [stopViewportAnimation]);

  useEffect(() => {
    if (!projection.hasGeometry || !selectedGroupPoint || focusPointId) return;
    animateViewportTo(territorialMapViewportForPoint(selectedGroupPoint, VALIDATION_SELECTED_GROUP_ZOOM));
  }, [animateViewportTo, focusPointId, projection.hasGeometry, selectedGroup?.key, selectedGroupPoint?.x, selectedGroupPoint?.y]);

  useEffect(() => {
    if (!projection.hasGeometry || !selectedGpsMapPoint || !focusPointId) return;
    animateViewportTo(territorialMapViewportForPoint(selectedGpsMapPoint, VALIDATION_SELECTED_POINT_ZOOM));
  }, [animateViewportTo, focusPointId, projection.hasGeometry, selectedGpsMapPoint?.x, selectedGpsMapPoint?.y]);

  const resetMap = () => {
    animateViewportTo({ zoom: 1, pan: { x: 0, y: 0 } }, VALIDATION_MAP_CONTROL_ANIMATION_MS);
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    stopViewportAnimation();
    const current = viewportRef.current;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: current.pan.x,
      panY: current.pan.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = MAP_WIDTH / Math.max(1, rect.width);
    const scaleY = MAP_HEIGHT / Math.max(1, rect.height);
    commitViewport({
      ...viewportRef.current,
      pan: {
        x: drag.panX + (event.clientX - drag.startX) * scaleX,
        y: drag.panY + (event.clientY - drag.startY) * scaleY,
      },
    });
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  };
  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = territorialNormalizedWheelDelta(event);
    const rect = event.currentTarget.getBoundingClientRect();
    const anchor = {
      x: (event.clientX - rect.left) * (MAP_WIDTH / Math.max(1, rect.width)),
      y: (event.clientY - rect.top) * (MAP_HEIGHT / Math.max(1, rect.height)),
    };
    if (event.ctrlKey || event.metaKey) {
      const zoomDelta = clamp(delta.y || delta.x, -VALIDATION_WHEEL_ZOOM_MAX_DELTA, VALIDATION_WHEEL_ZOOM_MAX_DELTA);
      zoomBy(Math.exp(-zoomDelta * VALIDATION_WHEEL_ZOOM_SENSITIVITY), anchor, false);
      return;
    }
    stopViewportAnimation();
    const panDeltaX = event.shiftKey && Math.abs(delta.x) < 1 ? delta.y : delta.x;
    const panDeltaY = event.shiftKey && Math.abs(delta.x) < 1 ? 0 : delta.y;
    const current = viewportRef.current;
    commitViewport({
      ...current,
      pan: {
        x: current.pan.x - clamp(panDeltaX * VALIDATION_WHEEL_PAN_SENSITIVITY, -VALIDATION_WHEEL_PAN_MAX, VALIDATION_WHEEL_PAN_MAX),
        y: current.pan.y - clamp(panDeltaY * VALIDATION_WHEEL_PAN_SENSITIVITY, -VALIDATION_WHEEL_PAN_MAX, VALIDATION_WHEEL_PAN_MAX),
      },
    });
  };

  return (
    <section className="mon-territorial-route-map-card mon-territorial-validation-geo-map-card" aria-label="Mapa de geolocalización territorial">
      <header>
        <span><MapPin size={14} /> Mapa GPS territorial</span>
        <strong>{selectedLabel}</strong>
      </header>
      <div
        className="mon-territorial-map-viewport mon-territorial-route-map-viewport mon-territorial-validation-geo-map-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div
          className="mon-territorial-map-tools"
          aria-label="Controles del mapa"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerMove={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          <button type="button" aria-label="Acercar mapa" onClick={() => zoomBy(1.45)}><Plus size={13} /></button>
          <button type="button" aria-label="Alejar mapa" onClick={() => zoomBy(0.69)}><Minus size={13} /></button>
          <button type="button" aria-label="Restablecer vista" onClick={resetMap}><Maximize2 size={13} /></button>
          <span className="mon-territorial-map-zoom-readout" aria-label={`Zoom ${zoom.toFixed(1)}x`}>{zoom.toFixed(1)}x</span>
        </div>
        {projection.hasGeometry ? (
          <svg
            className={`is-lima-map is-level-zone ${zoomClass}`}
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            preserveAspectRatio="none"
            role="img"
            aria-label="Mapa de Hojas de Ruta con puntos GPS de Kobo"
          >
            <rect className="mon-territorial-map-water" x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} />
            <g transform={transform}>
              <g className="mon-territorial-map-context-features" aria-label="Contexto territorial de Hoja de Ruta">
                {contextFeatures.map((feature, index) => {
                  const d = territorialContextFeaturePath(feature, projection);
                  if (!d) return null;
                  return (
                    <path
                      key={`context-feature-${feature.properties.id ?? feature.id ?? index}`}
                      d={d}
                      className={`is-${territorialContextClass(feature)}`}
                      vectorEffect="non-scaling-stroke"
                    >
                      <title>{feature.properties.display_name || feature.properties.name || feature.properties.feature_class || "Contexto territorial"}</title>
                    </path>
                  );
                })}
              </g>
              <g className="mon-territorial-map-districts" aria-label="Distritos de ruta">
                {LIMA_DISTRICT_FEATURES.map((feature) => {
                  const d = territorialDistrictPath(feature, projection);
                  if (!d) return null;
                  const key = normalizeRouteBlockCode(feature.properties.ubigeo);
                  return (
                    <path key={key || feature.properties.distrito} d={d} className={activeUbigeos.has(key) ? "is-route" : ""} vectorEffect="non-scaling-stroke">
                      <title>{feature.properties.distrito}</title>
                    </path>
                  );
                })}
              </g>
              <g className="mon-territorial-map-zones" aria-label="Zonas de la UMP seleccionada">
                {routeZoneFeatures.map((feature) => {
                  const d = territorialZonePath(feature, projection);
                  if (!d) return null;
                  return (
                    <path key={territorialZoneFeatureKey(feature)} d={d} className="is-active-zone" vectorEffect="non-scaling-stroke">
                      <title>{territorialZoneDisplayLabel(feature)}</title>
                    </path>
                  );
                })}
              </g>
              <g className="mon-territorial-map-streets" aria-label="Calles principales de Hoja de Ruta">
                {streetFeatures.map((feature, index) => {
                  const d = territorialStreetPath(feature, projection);
                  if (!d) return null;
                  return (
                    <path
                      key={`street-${feature.properties.id ?? feature.id ?? index}`}
                      d={d}
                      className={feature.properties.class_group === "major" ? "is-major" : ""}
                      vectorEffect="non-scaling-stroke"
                    >
                      <title>{feature.properties.display_name || feature.properties.name || "Via local"}</title>
                    </path>
                  );
                })}
              </g>
              {streetLabelAnchors.length ? (
                <g className="mon-territorial-validation-geo-street-labels" aria-label="Nombres de vias principales">
                  {streetLabelAnchors.map((label) => (
                    <text
                      key={label.id}
                      x={label.x.toFixed(2)}
                      y={label.y.toFixed(2)}
                      className={label.major ? "is-major" : ""}
                      transform={`rotate(${(label.angle * 180 / Math.PI).toFixed(2)} ${label.x.toFixed(2)} ${label.y.toFixed(2)})`}
                    >
                      {label.name}
                    </text>
                  ))}
                </g>
              ) : null}
              {focusZoneFeatures.length || neighborFeatures.length ? (
                <g className="mon-territorial-validation-geo-context-blocks" aria-label="Manzanas vecinas de referencia">
                  {focusZoneFeatures.map((feature, index) => {
                    const d = territorialFeaturePath(feature, projection);
                    if (!d) return null;
                    return (
                      <path
                        key={`focus-${territorialFeatureStableKey(feature, index)}`}
                        d={d}
                        className="mon-territorial-validation-geo-context-block is-focus-zone"
                        vectorEffect="non-scaling-stroke"
                      >
                        <title>{`Manzana de zona activa ${territorialFeatureDisplayLabel(feature)}`}</title>
                      </path>
                    );
                  })}
                  {neighborFeatures.map((feature, index) => {
                    const d = territorialFeaturePath(feature, projection);
                    if (!d) return null;
                    const inSelectedRouteZone = territorialFeatureMatchesZoneKeys(feature, selectedRouteZoneKeys);
                    return (
                      <path
                        key={`neighbor-${territorialFeatureStableKey(feature, index)}`}
                        d={d}
                        className={`mon-territorial-validation-geo-context-block is-neighbor${inSelectedRouteZone ? "" : " is-cross-zone"}`}
                        vectorEffect="non-scaling-stroke"
                      >
                        <title>{`${inSelectedRouteZone ? "Manzana vecina" : "Manzana vecina de otra zona"} ${territorialFeatureDisplayLabel(feature)}`}</title>
                      </path>
                    );
                  })}
                </g>
              ) : null}
              <g className="mon-territorial-route-map-route-blocks" aria-label="Manzanas seleccionadas">
                {selectedFeatures.map((item) => {
                  const d = territorialFeaturePath(item.feature, projection);
                  if (!d) return null;
                  const replacement = isReplacementBlock(item.block);
                  const blockCenter = territorialFeatureCentroid(item.feature, projection);
                  const zoomToBlock = () => {
                    if (blockCenter) {
                      animateViewportTo(territorialMapViewportForPoint(blockCenter, VALIDATION_SELECTED_BLOCK_CLICK_ZOOM));
                    }
                  };
                  return (
                    <g
                      key={item.key}
                      className="mon-territorial-map-selected-block-node"
                      role="button"
                      tabIndex={0}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        zoomToBlock();
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        zoomToBlock();
                      }}
                    >
                      <title>{`${territorialRouteOperationalLabel(item.block)} · ${territorialPhysicalBlockLabel(item.block)}`}</title>
                      <path
                        d={d}
                        className="mon-territorial-map-selected-block-hit"
                        vectorEffect="non-scaling-stroke"
                        aria-hidden="true"
                      />
                      <path
                        d={d}
                        className={`mon-territorial-map-selected-block ${replacement ? "is-replacement" : "is-titular"} is-selected`}
                        vectorEffect="non-scaling-stroke"
                        aria-hidden="true"
                      />
                    </g>
                  );
                })}
              </g>
              <g className="mon-territorial-map-point-hit-layer" aria-label="Puntos GPS Kobo">
                {visiblePoints.map((point, index) => {
                  const projected = projection.project(point.lonValue, point.latValue);
                  const selected = focusPointId && point.response_id === focusPointId;
                  const disposition = point.geoDisposition ?? geoDispositionFromRaw(point.geo_estado);
                  const stateClass = territorialGpsStateClass(disposition, disposition);
                  return (
                    <g
                      key={point.response_id || `gps-${index}`}
                      className={`mon-territorial-map-point-node ${stateClass} is-${disposition}${selected ? " is-selected" : ""}`}
                      transform={`translate(${projected.x.toFixed(2)} ${projected.y.toFixed(2)}) scale(${pointScale.toFixed(6)})`}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (point.response_id) onFocusPoint(point.response_id);
                      }}
                    >
                      <circle className="mon-territorial-map-point-hit mon-territorial-map-point-hit-area" r="10.5" />
                      <circle className="mon-territorial-map-point-focus" r={selected ? "6.8" : "5.4"} />
                      <circle className="mon-territorial-map-point-core" r={selected ? "4.2" : "3.2"} />
                      <title>{`${point.declared_ump_normalized || point.advance_block_ump || "UMP S/D"} · ${point.responsible_display || point.submitted_by || "Sin responsable"}`}</title>
                    </g>
                  );
                })}
              </g>
            </g>
            <text className="mon-territorial-map-caption" x="18" y={MAP_HEIGHT - 18}>
              {`${selectedLabel} · arrastra o usa trackpad para mover · Ctrl/Cmd+rueda para zoom suave · ${formatMetric(visiblePoints.length)} puntos visibles · ${formatMetric(routeBlocks.length)} manzanas`}
            </text>
          </svg>
        ) : (
          <div className="mon-territorial-route-map-placeholder" role="status">
            <span><MapPin size={18} /></span>
            <strong>Sin geometria territorial</strong>
            <em>No hay cartografia o puntos GPS para dibujar en este corte.</em>
          </div>
        )}
        {blockingMapLoading ? (
          <span className="mon-territorial-route-map-loading">
            <Loader2 size={13} className="pulso-spin" /> Cargando cartografia
          </span>
        ) : null}
        {backgroundMapLoading ? (
          <span className="mon-territorial-route-map-status">
            Completando cartografia local
          </span>
        ) : null}
        {blockingRichLayerLoading ? (
          <span className="mon-territorial-route-map-loading is-context">
            <Loader2 size={13} className="pulso-spin" /> Cargando calles
          </span>
        ) : null}
        {mapError ? <div className="mon-territorial-map-error">{mapError}</div> : null}
        <div className="mon-territorial-validation-geo-map-footer" aria-label="Resumen GPS y manzanas">
          <span className="is-en_zona"><strong>{formatMetric(geoSummary.en_zona)}</strong><em>En zona</em></span>
          <span className="is-en_distrito"><strong>{formatMetric(geoSummary.en_distrito)}</strong><em>Fuera de zona</em></span>
          <span className="is-fuera_distrito"><strong>{formatMetric(geoSummary.fuera_distrito)}</strong><em>Fuera de distrito</em></span>
          <span className="is-sin_cruce"><strong>{formatMetric(geoSummary.sin_cruce)}</strong><em>Sin cruce</em></span>
          <span className="is-sin_gps"><strong>{formatMetric(geoSummary.sin_gps)}</strong><em>Sin GPS</em></span>
        </div>
      </div>
    </section>
  );
}

function TerritorialGeoCaseList({
  focusPointId,
  gpsRows,
  groups,
  selectedGroupKey,
  onFocusPoint,
  onSelectGroup,
}: {
  focusPointId: string;
  gpsRows: TerritorialGpsCase[];
  groups: TerritorialGeoBlockGroup[];
  selectedGroupKey: string;
  onFocusPoint: (responseId: string) => void;
  onSelectGroup: (key: string) => void;
}) {
  const focusedCaseRef = useRef<HTMLButtonElement | null>(null);
  const localFocusPointRef = useRef("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [expandedKey, setExpandedKey] = useState("");
  const groupItems = useMemo(() => territorialGeoGroupListItems(groups), [groups]);
  const virtualizer = useVirtualizer({
    count: groupItems.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => groupItems[index]?.key ?? index,
    estimateSize: (index) => {
      const item = groupItems[index];
      const headingHeight = item?.showHeading ? 26 : 0;
      const group = item?.group;
      if (!group) return 104 + headingHeight;
      if (item.key !== expandedKey) return 104 + headingHeight;
      const listWidth = scrollRef.current?.clientWidth ?? 0;
      const rowHeight = listWidth <= 520 ? 184 : listWidth <= 720 ? 112 : 88;
      return 148 + headingHeight + group.rows.length * rowHeight;
    },
    overscan: 8,
  });
  const virtualRows = virtualizer.getVirtualItems();
  useEffect(() => {
    if (!expandedKey || groupItems.some((item) => item.key === expandedKey)) return;
    setExpandedKey("");
  }, [expandedKey, groupItems]);
  useEffect(() => {
    const handle = window.requestAnimationFrame(() => virtualizer.measure());
    return () => window.cancelAnimationFrame(handle);
  }, [expandedKey, groupItems, virtualizer]);
  useEffect(() => {
    if (!expandedKey) return undefined;
    const targetIndex = groupItems.findIndex((item) => item.key === expandedKey);
    if (targetIndex < 0) return undefined;
    const handle = window.setTimeout(() => {
      virtualizer.scrollToIndex(targetIndex, { align: "start" });
    }, 90);
    return () => window.clearTimeout(handle);
  }, [expandedKey, groupItems, virtualizer]);
  useEffect(() => {
    if (!focusPointId) return;
    const targetIndex = groupItems.findIndex((item) => item.group.rows.some((caseItem) => caseItem.row.response_id === focusPointId));
    if (targetIndex < 0) return;
    const localFocus = localFocusPointRef.current === focusPointId;
    const focusedItem = groupItems[targetIndex];
    if (!focusedItem) return;
    setExpandedKey(focusedItem.key);
    window.requestAnimationFrame(() => {
      if (!localFocus) virtualizer.scrollToIndex(targetIndex, { align: "center" });
      virtualizer.measure();
    });
  }, [focusPointId, groupItems, virtualizer]);
  useEffect(() => {
    if (!focusPointId) return undefined;
    const localFocus = localFocusPointRef.current === focusPointId;
    const handle = window.setTimeout(() => {
      if (!localFocus) focusedCaseRef.current?.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
      focusedCaseRef.current?.focus({ preventScroll: true });
      if (localFocus) localFocusPointRef.current = "";
    }, 260);
    return () => window.clearTimeout(handle);
  }, [expandedKey, focusPointId]);
  const toggleGroup = useCallback((itemKey: string, groupKey: string) => {
    onSelectGroup(groupKey);
    setExpandedKey((current) => current === itemKey ? "" : itemKey);
  }, [onSelectGroup]);
  const selectGroup = useCallback((key: string) => {
    onSelectGroup(key);
  }, [onSelectGroup]);
  const focusCasePoint = useCallback((groupKey: string, responseId: string) => {
    if (!responseId) return;
    localFocusPointRef.current = responseId;
    selectGroup(groupKey);
    onFocusPoint(responseId);
  }, [onFocusPoint, selectGroup]);
  return (
    <section className="mon-territorial-geo-case-list" aria-label="Todos los casos geolocalizados">
      <header>
        <div>
          <span><MapPin size={14} /> Casos por UMP declarada</span>
          <p>La UMP declarada agrupa los casos; el GPS valida zona/distrito y deja la manzana como referencia.</p>
        </div>
        <strong>{formatMetric(gpsRows.length)} GPS · {formatMetric(groups.reduce((sum, group) => sum + group.rows.length, 0))} casos</strong>
      </header>
      <div ref={scrollRef} className="mon-territorial-geo-case-scroll">
        <div className="mon-territorial-geo-virtual-list" style={{ height: `${virtualizer.getTotalSize()}px` }}>
          {virtualRows.map((virtualRow) => {
            const item = groupItems[virtualRow.index];
            if (!item) return null;
            const { group, section, sectionMeta, showHeading } = item;
            const selected = selectedGroupKey === group.key;
            const expanded = expandedKey === item.key;
            const replacementCount = group.routeBlocks.filter((block) => isReplacementBlock(block)).length;
            const badgeLabel = replacementCount ? `${formatMetric(replacementCount)} R` : "UMP";
            const block = group.block;
            const blockSubtitle = block
              ? `${block.distrito || section.distrito || "Sin distrito"} · Zona ${block.zona || "S/D"} · ${group.assignmentLabel}`
              : group.assignmentLabel;
            const zoneSummary = territorialGeoZoneSummary(group, selected);
            const riskSummary = territorialGeoGroupRiskSummary(group, zoneSummary);
            const pointCountLabel = group.gpsCount
              ? `${formatMetric(group.gpsCount)} GPS`
              : `${formatMetric(group.rows.length)} casos`;
            const casesPanelId = `geo-cases-${item.key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
            const visiblePointCount = group.rows.filter((item) => territorialResponseHasGps(item.row)).length;
            const childContext = selected && zoneSummary.gpsCount
              ? `${formatMetric(zoneSummary.inZoneCount)} en zona UMP · ${formatMetric(zoneSummary.outsideZoneCount)} fuera zona · ${formatMetric(zoneSummary.outsideDistrictCount)} fuera distrito`
              : selected
                ? "UMP enfocada · sin puntos GPS"
                : "Puntos asociados a la UMP declarada";
            return (
              <div
                key={virtualRow.key}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                className={`mon-territorial-geo-virtual-item mon-territorial-geo-district-section is-${section.kind}${showHeading ? " is-section-start" : ""}`}
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                {showHeading ? (
                  <div className="mon-territorial-geo-district-heading">
                    <strong>{section.distrito}</strong>
                    <span>{section.kind === "route" ? sectionMeta : `${section.ubigeo} · ${sectionMeta}`}</span>
                  </div>
                ) : null}
                <div className="mon-territorial-geo-district-group">
                  <div className={`mon-territorial-geo-district-trigger${selected ? " is-selected" : ""}${expanded ? " is-expanded" : ""}`}>
                    <button
                      type="button"
                      className="mon-territorial-geo-district-expander"
                      aria-label={`${expanded ? "Cerrar" : "Abrir"} puntos GPS de ${group.blockLabel}`}
                      aria-expanded={expanded}
                      aria-controls={casesPanelId}
                      onClick={() => toggleGroup(item.key, group.key)}
                    >
                      <ChevronDown size={14} className={expanded ? "is-expanded" : ""} />
                    </button>
                    <button
                      type="button"
                      className="mon-territorial-geo-district-main"
                      aria-pressed={selected}
                      onClick={() => selectGroup(group.key)}
                    >
                      <span className="mon-territorial-geo-district-copy">
                        <strong>{group.blockLabel}</strong>
                        <em>{blockSubtitle}</em>
                      </span>
                      <span className={`mon-territorial-geo-district-risk is-${riskSummary.tone}`}>
                        <span>
                          <strong>{riskSummary.distanceLabel}</strong>
                          <em>{riskSummary.distanceHint}</em>
                        </span>
                        <span>
                          {riskSummary.tags.map((tag) => (
                            <small key={tag.key} className={`is-${tag.tone}`}>{tag.label}</small>
                          ))}
                        </span>
                      </span>
                      <span className="mon-territorial-geo-district-owner">{group.responsable}</span>
                      <span className="mon-territorial-geo-district-metrics">
                        <span className="mon-territorial-geo-district-count">{pointCountLabel}</span>
                        {selected ? <span className="mon-territorial-geo-district-count is-selected-ump">Zona activa</span> : null}
                        <span className="mon-territorial-route-badge is-titular">{badgeLabel}</span>
                      </span>
                    </button>
                  </div>
                  {expanded ? (
                    <div
                      id={casesPanelId}
                      className={`mon-territorial-geo-district-cases has-child-context${selected ? " is-selected-ump" : ""}`}
                    >
                      <div className="mon-territorial-geo-child-context">
                        <span><Route size={13} /> {childContext}</span>
                        <strong>{formatMetric(visiblePointCount)} puntos GPS</strong>
                      </div>
                      {(() => {
                        let gpsPointIndex = 0;
                        return group.rows.map((item, index) => {
                          const row = item.row;
                          const hasGps = territorialResponseHasGps(row);
                          if (hasGps) gpsPointIndex += 1;
                          const pointLabel = hasGps ? `Punto ${formatMetric(gpsPointIndex)}` : "Sin GPS";
                          const disposition = territorialGeoDispositionMeta(item.geoDisposition);
                          const dispositionDetail = item.geoDisposition === "fuera_distrito" && item.spatialDistrito
                            ? `${item.spatialDistrito}${item.spatialUbigeo ? ` · ${item.spatialUbigeo}` : ""}`
                            : item.geoDisposition === "sin_gps"
                              ? `Declarado: ${row.distrito || row.district_code || "sin dato"}`
                              : disposition.detail;
                          const stampParts = territorialSubmissionStampParts(row);
                          const stamp = stampParts.label || `Fila ${formatMetric(row.row_index)}`;
                          const codeLabel = territorialPulsoCodeLabel(row);
                          const enumeratorLabel = territorialCaseResponsibleLabel(row, false);
                          const demographicLabel = `${territorialReviewSexLabel(row)} · ${territorialReviewAgeLabel(row)}`;
                          const focused = Boolean(focusPointId && row.response_id === focusPointId);
                          const rowClickable = Boolean(row.response_id);
                          const fitKind = !hasGps || item.geoDisposition === "sin_gps"
                            ? "associated"
                            : item.geoDisposition === "en_zona"
                              ? "inside"
                              : item.geoDisposition === "fuera_distrito"
                                ? "district"
                                : "outside";
                          const fitLabel = territorialGeoZoneFitLabel(item.geoDisposition, selected);
                          const membershipLabel = selected ? "UMP seleccionada" : "UMP declarada";
                          const showZoneFit = selected && hasGps;
                          const placeLabel = item.geoDisposition === "sin_gps"
                            ? dispositionDetail
                            : item.spatialDistrito
                              ? `${item.spatialDistrito}${item.spatialUbigeo ? ` · ${item.spatialUbigeo}` : ""}`
                              : `${row.distrito || item.spatialDistrito || "Sin distrito"}${row.ubigeo || item.spatialUbigeo ? ` · ${row.ubigeo || item.spatialUbigeo}` : ""}`;
                          const gpsTrace = territorialGpsTraceLabel(row);
                          const geoDetail = [
                            item.gpsDiagnosticLabel || (hasGps ? dispositionDetail : "sin punto"),
                            gpsTrace,
                          ].filter(Boolean).join(" · ");
                          return (
                            <button
                              type="button"
                              key={`${group.key}-${row.response_id || row.row_index || index}`}
                              ref={focused ? focusedCaseRef : undefined}
                              data-response-id={row.response_id || undefined}
                              className={`mon-territorial-geo-case-row is-static is-${item.geoDisposition} is-${fitKind}-block${hasGps ? "" : " is-no-gps"}${focused ? " is-focused-point" : ""}`}
                              disabled={!rowClickable}
                              aria-pressed={rowClickable ? focused : undefined}
                              aria-label={codeLabel !== "S/D" ? `${pointLabel}. Código Pulso ${codeLabel}` : pointLabel}
                              onClick={() => {
                                if (rowClickable) focusCasePoint(group.key, row.response_id);
                              }}
                            >
                              <span className={`mon-territorial-geo-case-dot is-${item.geoDisposition}`} aria-hidden="true" />
                              <span className="mon-territorial-geo-case-main">
                                <span className="mon-territorial-geo-case-title"><strong>{pointLabel}</strong></span>
                                <em className="mon-territorial-geo-case-stamp" title={stamp}>
                                  {stampParts.date ? <span>{stampParts.date}</span> : null}
                                  {stampParts.hour ? <span className="is-time">{stampParts.hour}</span> : null}
                                  {!stampParts.date && !stampParts.hour ? <span>{stamp}</span> : null}
                                  <span className="mon-territorial-geo-case-demo" title={`Sexo y edad: ${demographicLabel}`}>
                                    {demographicLabel}
                                  </span>
                                </em>
                              </span>
                              <span className="mon-territorial-geo-case-meta">
                                <b>{enumeratorLabel}</b>
                                <small>{placeLabel}</small>
                              </span>
                              <span className="mon-territorial-geo-case-place">
                                <b>{item.blockLabel}</b>
                                <small>{geoDetail}</small>
                                <span className="mon-territorial-geo-case-fit is-associated">{membershipLabel}</span>
                                {showZoneFit ? <span className={`mon-territorial-geo-case-fit is-${fitKind}`}>{fitLabel}</span> : null}
                              </span>
                              <span className={`mon-territorial-geo-disposition is-${item.geoDisposition}`}>{disposition.shortLabel}</span>
                            </button>
                          );
                        });
                      })()}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        {!groups.length ? <div className="mon-territorial-source-empty">Sin casos para agrupar por UMP declarada.</div> : null}
        {groups.length ? <div className="mon-territorial-geo-scroll-end">Fin de casos</div> : null}
      </div>
    </section>
  );
}

async function loadTerritorialCartography(ubigeo: string): Promise<TerritorialCartographyBundle> {
  const normalized = normalizeRouteBlockCode(ubigeo);
  const cached = CARTOGRAPHY_CACHE.get(normalized);
  if (cached) return cached;
  const request = Promise.allSettled([
    apiHojasRutaBlockMap(normalized, 0, false),
    apiHojasRutaZoneMap(normalized),
  ]).then((results) => ({
    blockMap: results[0].status === "fulfilled" ? results[0].value : null,
    zoneMap: results[1].status === "fulfilled" ? results[1].value : null,
  }));
  CARTOGRAPHY_CACHE.set(normalized, request);
  return request;
}

function buildTerritorialGpsCase(
  row: TerritorialResponseAuditRow,
  blocks: TerritorialBlockProgress[],
  zoneFeatures: HojasRutaZoneMapFeature[],
): TerritorialGpsCase {
  const block = resolveDeclaredBlock(row, blocks);
  const routeBlocks = block ? resolveRouteSet(block, blocks) : [];
  const spatialDistrict = territorialResponseHasGps(row)
    ? LIMA_DISTRICT_FEATURES.find((feature) => territorialPointInDistrictFeature(Number(row.lon), Number(row.lat), feature)) ?? null
    : null;
  const spatialZone = territorialResponseHasGps(row)
    ? zoneFeatures.find((feature) => territorialPointInZoneFeature(Number(row.lon), Number(row.lat), feature)) ?? null
    : null;
  const geoDisposition = geoDispositionForCase(row, block, routeBlocks, spatialDistrict, spatialZone, zoneFeatures.length > 0);
  const groupBlock = routeBlocks.find((candidate) => !isReplacementBlock(candidate)) ?? block;
  const groupKey = groupBlock ? territorialBlockStableKey(groupBlock) : `sin-ump:${row.declared_ump_normalized || row.advance_block_ump || row.row_index}`;
  const blockLabel = groupBlock ? `${territorialRouteOperationalLabel(groupBlock)} · ${territorialPhysicalBlockLabel(groupBlock)}` : "Sin UMP declarada";
  const nearestDiffers = row.nearest_block_id && block?.id_manzana && normalizeRouteBlockCode(row.nearest_block_id) !== normalizeRouteBlockCode(block.id_manzana);
  return {
    row,
    block: groupBlock,
    routeBlocks: routeBlocks.length ? routeBlocks : groupBlock ? [groupBlock] : [],
    groupKey,
    blockLabel,
    assignmentLabel: groupBlock ? "Asignacion por UMP declarada" : "Sin UMP declarada",
    responsable: territorialCaseResponsibleLabel(row),
    geoDisposition,
    spatialDistrito: spatialDistrict?.properties.distrito || "",
    spatialUbigeo: spatialDistrict?.properties.ubigeo || "",
    gpsDiagnosticLabel: nearestDiffers ? "GPS cercano a otra manzana" : "",
  };
}

function buildTerritorialGeoGroups(cases: TerritorialGpsCase[]): TerritorialGeoBlockGroup[] {
  const lookup = new Map<string, TerritorialGeoBlockGroup>();
  cases.forEach((item) => {
    const group = lookup.get(item.groupKey) ?? {
      key: item.groupKey,
      block: item.block,
      routeBlocks: item.routeBlocks,
      blockLabel: item.blockLabel,
      assignmentLabel: item.assignmentLabel,
      responsable: item.responsable,
      rows: [],
      gpsCount: 0,
      reviewCount: 0,
      noDefendibleCount: 0,
    };
    group.rows.push(item);
    group.routeBlocks = uniqueBlocks([...group.routeBlocks, ...item.routeBlocks]);
    if (territorialResponseHasGps(item.row)) group.gpsCount += 1;
    if (item.geoDisposition === "en_distrito" || item.geoDisposition === "sin_cruce" || item.geoDisposition === "sin_gps") group.reviewCount += 1;
    if (item.geoDisposition === "fuera_distrito") group.noDefendibleCount += 1;
    group.responsable = responsibleGroupLabel(group.rows);
    lookup.set(item.groupKey, group);
  });
  return Array.from(lookup.values()).sort((a, b) => {
    if (a.block && b.block) return territorialRouteBlockComparator(a.block, b.block);
    if (a.block) return -1;
    if (b.block) return 1;
    return a.blockLabel.localeCompare(b.blockLabel, "es-PE", { numeric: true });
  });
}

function resolveDeclaredBlock(row: TerritorialResponseAuditRow, blocks: TerritorialBlockProgress[]) {
  const blockId = normalizeRouteBlockCode(row.advance_block_id || row.nearest_block_id);
  if (blockId) {
    const byId = blocks.find((block) => normalizeRouteBlockCode(block.id_manzana) === blockId);
    if (byId) return byId;
  }
  const declaredUmp = normalizeRouteBlockCode(row.declared_ump_normalized || row.advance_block_ump);
  if (declaredUmp) {
    const byUmp = blocks.find((block) => (
      normalizeRouteBlockCode(block.ump) === declaredUmp
      || normalizeRouteBlockCode(block.hoja_num) === declaredUmp
      || normalizeRouteBlockCode(block.orden_seleccion) === declaredUmp
    ));
    if (byUmp) return byUmp;
  }
  const ubigeo = normalizeRouteBlockCode(row.advance_block_ubigeo || row.ubigeo || row.district_code);
  const zona = normalizeRouteBlockCode(row.advance_block_zona);
  const manzana = normalizeRouteBlockCode(row.advance_block_manzana);
  if (ubigeo && zona && manzana) {
    return blocks.find((block) => (
      normalizeRouteBlockCode(block.ubigeo) === ubigeo
      && normalizeRouteBlockCode(block.zona) === zona
      && normalizeRouteBlockCode(block.manzana) === manzana
    )) ?? null;
  }
  return null;
}

function resolveRouteSet(block: TerritorialBlockProgress, blocks: TerritorialBlockProgress[]) {
  const sameDistrict = blocks.filter((candidate) => normalizeRouteBlockCode(candidate.ubigeo) === normalizeRouteBlockCode(block.ubigeo));
  const titular = isReplacementBlock(block)
    ? sameDistrict.find((candidate) => (
      !isReplacementBlock(candidate)
      && normalizeRouteBlockCode(candidate.id_manzana) === normalizeRouteBlockCode(block.titular_id_manzana)
    )) ?? sameDistrict.find((candidate) => !isReplacementBlock(candidate) && territorialRouteUmpNumber(candidate) === territorialRouteUmpNumber(block)) ?? block
    : block;
  const titularId = normalizeRouteBlockCode(titular.id_manzana);
  const titularUmp = territorialRouteUmpNumber(titular);
  const replacements = sameDistrict.filter((candidate) => (
    isReplacementBlock(candidate)
    && (
      (titularId && normalizeRouteBlockCode(candidate.titular_id_manzana) === titularId)
      || territorialRouteUmpNumber(candidate) === titularUmp
    )
  ));
  return uniqueBlocks([titular, ...replacements]).sort(territorialRouteBlockComparator);
}

function geoDispositionForCase(
  row: TerritorialResponseAuditRow,
  block: TerritorialBlockProgress | null,
  routeBlocks: TerritorialBlockProgress[],
  spatialDistrict: TerritorialDistrictFeature | null,
  spatialZone: HojasRutaZoneMapFeature | null,
  hasZoneContext: boolean,
): TerritorialGeoDispositionKey {
  if (!territorialResponseHasGps(row)) return "sin_gps";
  if (row.geo_estado === "geo_sin_cruce") return "sin_cruce";
  const routeUbigeo = normalizeRouteBlockCode(block?.ubigeo || row.ubigeo || row.district_code);
  const spatialUbigeo = normalizeRouteBlockCode(spatialDistrict?.properties.ubigeo);
  if (spatialUbigeo && routeUbigeo && spatialUbigeo !== routeUbigeo) return "fuera_distrito";
  const routeZoneKeys = new Set(routeBlocks.flatMap(territorialBlockZoneKeys).filter(Boolean));
  const spatialZoneKeys = spatialZone ? territorialZoneFeatureKeys(spatialZone) : [];
  if (spatialZoneKeys.some((key) => routeZoneKeys.has(key))) return "en_zona";
  if (hasZoneContext && spatialUbigeo && routeUbigeo && spatialUbigeo === routeUbigeo && routeZoneKeys.size) return "en_distrito";
  if (row.geo_estado === "geo_no_defendible") return "fuera_distrito";
  if (row.geo_estado === "geo_revision" || row.geo_estado === "geo_cerca") return "en_distrito";
  return "en_zona";
}

function territorialRowsForGeoMap(reports: MonitoreoTerritorialDashboard) {
  if (Array.isArray(reports.response_audit) && reports.response_audit.length) return reports.response_audit;
  return (reports.map?.points ?? []).map((point, index): TerritorialResponseAuditRow => ({
    row_index: index + 1,
    response_id: String(point.response_id || `gps-${index + 1}`),
    district_code: String(point.ubigeo || ""),
    distrito: String(point.distrito || ""),
    ubigeo: String(point.ubigeo || ""),
    consent: "",
    age: numberOrNull(point.age),
    sex: String(point.sex || ""),
    status: "",
    submitted_by: String(point.submitted_by || ""),
    pulso_code: String(point.pulso_code || ""),
    pulso_code_raw: String(point.pulso_code_raw || ""),
    pulso_code_normalized: String(point.pulso_code_normalized || ""),
    enumerator_assigned: String(point.enumerator_assigned || ""),
    responsible_display: String(point.responsible_display || ""),
    pulso_code_recognized: Boolean(point.pulso_code_recognized),
    pulso_code_reconciled: Boolean(point.pulso_code_reconciled),
    pulso_code_range_warning: Boolean(point.pulso_code_range_warning),
    submission_time: String(point.submission_datetime || point.submission_date_iso || ""),
    submission_time_source: String(point.submission_time_source || ""),
    submission_date_iso: String(point.submission_date_iso || ""),
    submission_date: String(point.submission_date || ""),
    submission_hour: String(point.submission_hour || ""),
    submission_datetime: String(point.submission_datetime || ""),
    duration_seconds: numberOrNull(point.duration_seconds),
    lat: numberOrNull(point.lat),
    lon: numberOrNull(point.lon),
    gps_parseable: true,
    geo_estado: String(point.geo_estado || "geo_ok"),
    distance_m: numberOrNull(point.distance_m),
    nearest_block_id: String(point.nearest_block_id || ""),
    nearest_block_type: String(point.nearest_block_type || ""),
    gps_primary_source: String(point.gps_primary_source || ""),
    gps_primary_lat: numberOrNull(point.gps_primary_lat),
    gps_primary_lon: numberOrNull(point.gps_primary_lon),
    gps_primary_altitude: numberOrNull(point.gps_primary_altitude),
    gps_primary_accuracy_m: numberOrNull(point.gps_primary_accuracy_m),
    gps_primary_parseable: Boolean(point.gps_primary_parseable),
    gps_primary_estado: String(point.gps_primary_estado || ""),
    gps_primary_distance_m: numberOrNull(point.gps_primary_distance_m),
    gps_primary_nearest_block_id: String(point.gps_primary_nearest_block_id || ""),
    gps_primary_nearest_block_type: String(point.gps_primary_nearest_block_type || ""),
    gps_primary_geometry_match: String(point.gps_primary_geometry_match || ""),
    gps_effective_source: String(point.gps_effective_source || ""),
    gps_effective_lat: numberOrNull(point.gps_effective_lat),
    gps_effective_lon: numberOrNull(point.gps_effective_lon),
    gps_effective_altitude: numberOrNull(point.gps_effective_altitude),
    gps_effective_accuracy_m: numberOrNull(point.gps_effective_accuracy_m),
    gps_effective_estado: String(point.gps_effective_estado || ""),
    gps_effective_distance_m: numberOrNull(point.gps_effective_distance_m),
    gps_effective_nearest_block_id: String(point.gps_effective_nearest_block_id || ""),
    gps_effective_nearest_block_type: String(point.gps_effective_nearest_block_type || ""),
    gps_effective_geometry_match: String(point.gps_effective_geometry_match || ""),
    gps_reclassified: Boolean(point.gps_reclassified),
    gps_reclassification_note: String(point.gps_reclassification_note || ""),
    declared_ump_raw: String(point.declared_ump_raw || ""),
    declared_ump_normalized: String(point.declared_ump_normalized || ""),
    advance_block_id: String(point.advance_block_id || ""),
    advance_block_ump: String(point.advance_block_ump || ""),
    advance_block_ubigeo: String(point.advance_block_ubigeo || point.ubigeo || ""),
    advance_block_distrito: String(point.advance_block_distrito || point.distrito || ""),
    advance_block_zona: String(point.advance_block_zona || ""),
    advance_block_manzana: String(point.advance_block_manzana || ""),
    advance_block_type: String(point.advance_block_type || ""),
    advance_block_match: Boolean(point.advance_block_match),
    advance_block_match_status: String(point.advance_block_match_status || ""),
    advance_status: "validada",
    observation_status: String(point.observation_status || ""),
    observation_reasons: String(point.observation_reasons || ""),
    validation_status: String(point.validation_status || "validada"),
    source_effective: true,
    advance_valid: true,
    issues: "",
  }));
}

type TerritorialMapPoint = MonitoreoTerritorialDashboard["map"]["points"][number];

type TerritorialKoboMapPoint = Omit<TerritorialMapPoint, "geo_estado" | "lat" | "lon"> & {
  geo_estado: string;
  lat: number;
  lon: number;
  latValue: number;
  lonValue: number;
  geoDisposition?: TerritorialGeoDispositionKey;
};

function territorialKoboMapPoints(
  reports: MonitoreoTerritorialDashboard,
  rows: TerritorialResponseAuditRow[],
): TerritorialKoboMapPoint[] {
  const rowsById = new Map(rows.map((row) => [row.response_id, row]));
  return (reports.map?.points ?? [])
    .map((point): TerritorialKoboMapPoint | null => {
      const row = rowsById.get(String(point.response_id || ""));
      const latValue = numberOrNull(point.gps_effective_lat ?? point.gps_primary_lat ?? point.lat ?? row?.lat);
      const lonValue = numberOrNull(point.gps_effective_lon ?? point.gps_primary_lon ?? point.lon ?? row?.lon);
      if (latValue == null || lonValue == null) return null;
      return {
        ...point,
        lat: latValue,
        lon: lonValue,
        latValue,
        lonValue,
        geo_estado: String(point.geo_estado || row?.geo_estado || "geo_ok"),
        geoDisposition: geoDispositionFromRaw(point.geo_estado || row?.geo_estado),
      };
    })
    .filter((point): point is TerritorialKoboMapPoint => point !== null);
}

function summarizeGeoCases(cases: TerritorialGpsCase[]) {
  return cases.reduce((acc, item) => {
    acc[item.geoDisposition] += 1;
    return acc;
  }, { en_zona: 0, en_distrito: 0, fuera_distrito: 0, sin_cruce: 0, sin_gps: 0 });
}

function territorialMapViewportForPoint(point: { x: number; y: number }, zoom: number): TerritorialMapViewportState {
  const clampedZoom = clamp(zoom, VALIDATION_MAP_MIN_ZOOM, VALIDATION_MAP_MAX_ZOOM);
  return {
    zoom: clampedZoom,
    pan: {
      x: MAP_WIDTH / 2 - point.x * clampedZoom,
      y: MAP_HEIGHT / 2 - point.y * clampedZoom,
    },
  };
}

function territorialMapViewportWithZoom(viewport: TerritorialMapViewportState, zoom: number): TerritorialMapViewportState {
  return {
    zoom: clamp(zoom, VALIDATION_MAP_MIN_ZOOM, VALIDATION_MAP_MAX_ZOOM),
    pan: viewport.pan,
  };
}

function territorialMapZoomAt(
  viewport: TerritorialMapViewportState,
  factor: number,
  anchor: { x: number; y: number },
): TerritorialMapViewportState {
  const nextZoom = clamp(viewport.zoom * factor, VALIDATION_MAP_MIN_ZOOM, VALIDATION_MAP_MAX_ZOOM);
  const currentZoom = Math.max(0.001, viewport.zoom);
  const worldX = (anchor.x - viewport.pan.x) / currentZoom;
  const worldY = (anchor.y - viewport.pan.y) / currentZoom;
  return {
    zoom: nextZoom,
    pan: {
      x: anchor.x - worldX * nextZoom,
      y: anchor.y - worldY * nextZoom,
    },
  };
}

function territorialNormalizedWheelDelta(event: ReactWheelEvent<HTMLDivElement>) {
  const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 120 : 1;
  return {
    x: event.deltaX * multiplier,
    y: event.deltaY * multiplier,
  };
}

function territorialPrefersReducedMotion() {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function territorialMapViewportEase(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function buildTerritorialMapProjection(
  blockFeatures: HojasRutaBlockMapFeature[],
  zoneFeatures: HojasRutaZoneMapFeature[],
  districtFeatures: TerritorialDistrictFeature[],
  points: TerritorialKoboMapPoint[],
): TerritorialMapProjection {
  const coords: TerritorialGeoPoint[] = [];
  blockFeatures.forEach((feature) => territorialFeaturePolygons(feature).forEach((polygon) => polygon.forEach((ring) => coords.push(...ring))));
  zoneFeatures.forEach((feature) => territorialZonePolygons(feature).forEach((polygon) => polygon.forEach((ring) => coords.push(...ring))));
  districtFeatures.forEach((feature) => territorialDistrictPolygons(feature).forEach((polygon) => polygon.forEach((ring) => coords.push(...ring))));
  points.forEach((point) => coords.push([point.lonValue, point.latValue]));
  const valid = coords.filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
  if (!valid.length) {
    return {
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      hasGeometry: false,
      project: () => ({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 }),
    };
  }
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  valid.forEach(([lon, lat]) => {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  });
  const padding = 28;
  const spanLon = Math.max(0.000001, maxLon - minLon);
  const spanLat = Math.max(0.000001, maxLat - minLat);
  const scale = Math.min((MAP_WIDTH - padding * 2) / spanLon, (MAP_HEIGHT - padding * 2) / spanLat);
  const projectedWidth = spanLon * scale;
  const projectedHeight = spanLat * scale;
  const offsetX = (MAP_WIDTH - projectedWidth) / 2;
  const offsetY = (MAP_HEIGHT - projectedHeight) / 2;
  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    hasGeometry: true,
    project: (lon: number, lat: number) => ({
      x: offsetX + (lon - minLon) * scale,
      y: offsetY + (maxLat - lat) * scale,
    }),
  };
}

function selectTerritorialMapFeatures(features: HojasRutaBlockMapFeature[], blocks: TerritorialBlockProgress[]): TerritorialSelectedFeature[] {
  const lookup = new Map<string, TerritorialBlockProgress>();
  blocks.forEach((block) => {
    territorialBlockLookupKeys(block).forEach((key) => {
      if (!lookup.has(key)) lookup.set(key, block);
    });
  });
  const selected: TerritorialSelectedFeature[] = [];
  const used = new Set<string>();
  features.forEach((feature, index) => {
    const match = territorialFeatureLookupKeys(feature).map((key) => lookup.get(key)).find((block) => block && !used.has(territorialBlockStableKey(block)));
    if (!match) return;
    const blockKey = territorialBlockStableKey(match);
    used.add(blockKey);
    selected.push({ feature, block: match, key: `${blockKey}:${territorialFeatureStableKey(feature, index)}` });
  });
  return selected;
}

function territorialBlockLookupKeys(block: TerritorialBlockProgress) {
  const keys = new Set<string>();
  operationalCodeVariants(block.id_manzana).forEach((value) => keys.add(`id:${value}`));
  const ubigeo = normalizeRouteBlockCode(block.ubigeo);
  const zonas = operationalCodeVariants(block.zona, false);
  const manzanas = operationalCodeVariants(block.manzana);
  zonas.forEach((zona) => manzanas.forEach((manzana) => {
    if (ubigeo && zona && manzana) keys.add(`uzm:${ubigeo}:${zona}:${manzana}`);
  }));
  return Array.from(keys);
}

function territorialFeatureLookupKeys(feature: HojasRutaBlockMapFeature) {
  const props = feature.properties || {};
  const keys = new Set<string>();
  [props.ID_MANZANA, props.cartografia_id, props.inei_id_manzana, props.manzana_label, feature.id].forEach((value) => {
    operationalCodeVariants(value).forEach((id) => keys.add(`id:${id}`));
  });
  const ubigeo = normalizeRouteBlockCode(props.ubigeo);
  const zonas = operationalCodeVariants(props.inei_zona, false);
  const manzanas = operationalCodeVariants(props.inei_manzana);
  zonas.forEach((zona) => manzanas.forEach((manzana) => {
    if (ubigeo && zona && manzana) keys.add(`uzm:${ubigeo}:${zona}:${manzana}`);
  }));
  return Array.from(keys);
}

function operationalCodeVariants(value: unknown, includeTrimmed = true) {
  const normalized = normalizeRouteBlockCode(value);
  if (!normalized) return [];
  const values = new Set([normalized]);
  if (includeTrimmed) values.add(stripLeftZeros(normalized));
  return Array.from(values).filter(Boolean);
}

function territorialDistrictPath(feature: TerritorialDistrictFeature, projection: TerritorialMapProjection) {
  return territorialDistrictPolygons(feature)
    .map((polygon) => polygon.map((ring) => territorialRingPath(ring, projection)).filter(Boolean).join(" "))
    .filter(Boolean)
    .join(" ");
}

function territorialFeaturePath(feature: HojasRutaBlockMapFeature, projection: TerritorialMapProjection) {
  return territorialFeaturePolygons(feature)
    .map((polygon) => polygon.map((ring) => territorialRingPath(ring, projection)).filter(Boolean).join(" "))
    .filter(Boolean)
    .join(" ");
}

function territorialFeatureCentroid(feature: HojasRutaBlockMapFeature, projection: TerritorialMapProjection) {
  const points = territorialFeaturePolygons(feature).flatMap((polygon) => polygon.flatMap((ring) => ring));
  const valid = points.filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
  if (!valid.length) return null;
  const total = valid.reduce((acc, [lon, lat]) => ({ lon: acc.lon + lon, lat: acc.lat + lat }), { lon: 0, lat: 0 });
  return projection.project(total.lon / valid.length, total.lat / valid.length);
}

function territorialFeatureGeoCentroid(feature: HojasRutaBlockMapFeature) {
  const points = territorialFeaturePolygons(feature).flatMap((polygon) => polygon.flatMap((ring) => ring));
  const valid = points.filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
  if (!valid.length) return null;
  const total = valid.reduce((acc, [lon, lat]) => ({ lon: acc.lon + lon, lat: acc.lat + lat }), { lon: 0, lat: 0 });
  return { lon: total.lon / valid.length, lat: total.lat / valid.length };
}

function territorialPointClusterCentroid(points: TerritorialKoboMapPoint[], projection: TerritorialMapProjection) {
  const valid = points.filter((point) => Number.isFinite(point.lonValue) && Number.isFinite(point.latValue));
  if (!valid.length) return null;
  const total = valid.reduce((acc, point) => ({ lon: acc.lon + point.lonValue, lat: acc.lat + point.latValue }), { lon: 0, lat: 0 });
  return projection.project(total.lon / valid.length, total.lat / valid.length);
}

function territorialStreetLabelAnchor(feature: HojasRutaStreetMapFeature, projection: TerritorialMapProjection): TerritorialStreetLabelAnchor | null {
  const name = String(feature.properties.display_name || feature.properties.name || "").trim();
  const rank = Number(feature.properties.rank ?? 99);
  const major = feature.properties.class_group === "major" || Boolean(feature.properties.avenue_like) || rank <= 4;
  if (!name || !major) return null;
  const lines = territorialValidationStreetLines(feature)
    .map((line) => line.map(([lon, lat]) => projection.project(lon, lat)))
    .filter((line) => line.length > 1)
    .sort((a, b) => territorialProjectedLineLength(b) - territorialProjectedLineLength(a));
  const line = lines[0];
  if (!line) return null;
  const total = territorialProjectedLineLength(line);
  if (total < 18) return null;
  const target = total / 2;
  let walked = 0;
  for (let i = 1; i < line.length; i += 1) {
    const previous = line[i - 1];
    const current = line[i];
    const segment = Math.hypot(current.x - previous.x, current.y - previous.y);
    if (walked + segment >= target) {
      const ratio = (target - walked) / Math.max(1e-9, segment);
      const x = previous.x + (current.x - previous.x) * ratio;
      const y = previous.y + (current.y - previous.y) * ratio;
      const angle = territorialNormalizeTextAngle(Math.atan2(current.y - previous.y, current.x - previous.x));
      return {
        id: `${name}-${rank}-${x.toFixed(1)}-${y.toFixed(1)}`,
        name,
        x,
        y,
        angle,
        major,
        rank,
      };
    }
    walked += segment;
  }
  return null;
}

function territorialValidationStreetLines(feature: HojasRutaStreetMapFeature): TerritorialGeoRing[] {
  const geometry = feature.geometry;
  if (!geometry) return [];
  if (geometry.type === "LineString") return [normalizeTerritorialRing(geometry.coordinates)];
  if (geometry.type === "MultiLineString") {
    return (geometry.coordinates as unknown[]).map(normalizeTerritorialRing).filter((line) => line.length > 1);
  }
  return [];
}

function territorialProjectedLineLength(line: Array<{ x: number; y: number }>) {
  let length = 0;
  for (let i = 1; i < line.length; i += 1) {
    length += Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y);
  }
  return length;
}

function territorialNormalizeTextAngle(angle: number) {
  let next = angle;
  while (next > Math.PI / 2) next -= Math.PI;
  while (next < -Math.PI / 2) next += Math.PI;
  return next;
}

function territorialZonePath(feature: HojasRutaZoneMapFeature, projection: TerritorialMapProjection) {
  return territorialZonePolygons(feature)
    .map((polygon) => polygon.map((ring) => territorialRingPath(ring, projection)).filter(Boolean).join(" "))
    .filter(Boolean)
    .join(" ");
}

function territorialRingPath(ring: TerritorialGeoRing, projection: TerritorialMapProjection) {
  const path = ring
    .map(([lon, lat], index) => {
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return "";
      const point = projection.project(lon, lat);
      return `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .filter(Boolean)
    .join(" ");
  return path ? `${path} Z` : "";
}

function territorialDistrictPolygons(feature: TerritorialDistrictFeature): TerritorialGeoPolygon[] {
  return feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
}

function territorialFeaturePolygons(feature: HojasRutaBlockMapFeature): TerritorialGeoPolygon[] {
  if (!feature.geometry) return [];
  if (feature.geometry.type === "Polygon") return [feature.geometry.coordinates as TerritorialGeoPolygon];
  return feature.geometry.coordinates as TerritorialGeoPolygon[];
}

function territorialZonePolygons(feature: HojasRutaZoneMapFeature): TerritorialGeoPolygon[] {
  return normalizeTerritorialPolygons(feature.geometry?.coordinates);
}

function normalizeTerritorialPolygons(value: unknown): TerritorialGeoPolygon[] {
  if (!Array.isArray(value)) return [];
  if (isTerritorialRing(value)) return [[normalizeTerritorialRing(value)]];
  if (value.length && isTerritorialRing(value[0])) return [value.map(normalizeTerritorialRing).filter((ring) => ring.length > 1)];
  return value.flatMap((item) => normalizeTerritorialPolygons(item));
}

function normalizeTerritorialRing(value: unknown): TerritorialGeoRing {
  if (!Array.isArray(value)) return [];
  return value
    .map((point) => Array.isArray(point) ? [Number(point[0]), Number(point[1])] as TerritorialGeoPoint : null)
    .filter((point): point is TerritorialGeoPoint => point !== null && Number.isFinite(point[0]) && Number.isFinite(point[1]));
}

function isTerritorialRing(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 1 && value.every((point) => (
    Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1]))
  ));
}

function territorialPointInDistrictFeature(lon: number, lat: number, feature: TerritorialDistrictFeature) {
  return territorialDistrictPolygons(feature).some((polygon) => polygon.some((ring) => pointInRing(lon, lat, ring)));
}

function territorialPointInZoneFeature(lon: number, lat: number, feature: HojasRutaZoneMapFeature) {
  return territorialZonePolygons(feature).some((polygon) => polygon.some((ring) => pointInRing(lon, lat, ring)));
}

function pointInRing(lon: number, lat: number, ring: TerritorialGeoRing) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = ((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-12) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function territorialFeatureStableKey(feature: HojasRutaBlockMapFeature, index: number) {
  const props = feature.properties || {};
  return normalizeRouteBlockCode(
    props.cartografia_id
      || props.inei_id_manzana
      || props.ID_MANZANA
      || territorialFeatureRawProperty(feature, "IDMANZANA", "id_manzana_norm")
      || feature.id
      || index
  ) || String(index);
}

function territorialBlockStableKey(block: TerritorialBlockProgress) {
  return [
    normalizeRouteBlockCode(block.ubigeo),
    normalizeRouteBlockCode(block.zona),
    normalizeRouteBlockCode(block.manzana),
    normalizeRouteBlockCode(block.id_manzana),
  ].filter(Boolean).join(":");
}

function territorialBlockZoneKey(block: TerritorialBlockProgress) {
  return territorialBlockZoneKeys(block)[0] ?? "";
}

function territorialBlockZoneKeys(block: TerritorialBlockProgress) {
  return territorialZoneKeyVariants(block.ubigeo, block.zona);
}

function territorialFeatureZoneKey(feature: HojasRutaBlockMapFeature) {
  return territorialFeatureZoneKeys(feature)[0] ?? "";
}

function territorialFeatureZoneKeys(feature: HojasRutaBlockMapFeature) {
  const ubigeo = territorialFeatureUbigeo(feature);
  const zona = territorialFeatureZoneRawValue(feature);
  return territorialZoneKeyVariants(ubigeo, zona);
}

function territorialFeatureMatchesZoneKeys(feature: HojasRutaBlockMapFeature, zoneKeys: Set<string>) {
  if (!zoneKeys.size) return false;
  return territorialFeatureZoneKeys(feature).some((key) => zoneKeys.has(key));
}

function territorialZoneFeatureKey(feature: HojasRutaZoneMapFeature) {
  return territorialZoneFeatureKeys(feature)[0] ?? "";
}

function territorialZoneFeatureKeys(feature: HojasRutaZoneMapFeature) {
  const props = feature.properties as Record<string, unknown>;
  const ubigeo = normalizeRouteBlockCode(props.ubigeo ?? props.UBIGEO);
  const zona = normalizeRouteBlockCode(props.zona ?? props.CODZONA ?? props.IDZONA ?? feature.id);
  return territorialZoneKeyVariants(ubigeo, zona);
}

function territorialFeatureDisplayLabel(feature: HojasRutaBlockMapFeature) {
  const props = feature.properties as Record<string, unknown>;
  const ubigeo = territorialFeatureUbigeo(feature);
  const zona = territorialFeatureZoneRawValue(feature);
  const manzana = props.inei_manzana ?? props.CODMZNA ?? props.manzana_label ?? props.ID_MANZANA ?? props.IDMANZANA;
  return [
    ubigeo ? `UBIGEO ${ubigeo}` : "",
    zona ? `Z ${zona}` : "",
    manzana ? `Mz ${manzana}` : "",
  ].filter(Boolean).join(" · ") || "sin codigo";
}

function territorialZoneDisplayLabel(feature: HojasRutaZoneMapFeature) {
  const raw = String(feature.properties.zona_label || feature.properties.zona || feature.id || "").trim();
  if (!raw) return "Z S/D";
  const compact = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return compact.startsWith("Z") ? compact : `Z${compact.padStart(5, "0")}`;
}

function selectTerritorialValidationFocusZoneFeatures({
  anchorPoints,
  blockFeatures,
  radiusMeters,
  selectedFeatures,
  selectedRouteZoneKeys,
}: {
  anchorPoints: Array<{ lon: number; lat: number }>;
  blockFeatures: HojasRutaBlockMapFeature[];
  radiusMeters: number;
  selectedFeatures: TerritorialSelectedFeature[];
  selectedRouteZoneKeys: Set<string>;
}) {
  if (!selectedRouteZoneKeys.size) return [];
  const selectedFeatureRefs = new Set(selectedFeatures.map((item) => item.feature));
  const scored = blockFeatures
    .filter((feature) => (
      !selectedFeatureRefs.has(feature)
      && territorialFeatureMatchesZoneKeys(feature, selectedRouteZoneKeys)
    ))
    .map((feature) => {
      const centroid = territorialFeatureGeoCentroid(feature);
      const distance = centroid && anchorPoints.length
        ? Math.min(...anchorPoints.map((anchor) => territorialApproxDistanceMeters(anchor, centroid)))
        : Number.MAX_SAFE_INTEGER;
      return { feature, distance };
    })
    .sort((a, b) => a.distance - b.distance);
  const withinRadius = scored.filter((item) => item.distance <= radiusMeters);
  const picked = withinRadius.length ? withinRadius : scored.slice(0, Math.min(32, VALIDATION_FOCUS_ZONE_CONTEXT_LIMIT));
  return picked
    .slice(0, VALIDATION_FOCUS_ZONE_CONTEXT_LIMIT)
    .map((item) => item.feature);
}

function selectTerritorialValidationNeighborFeatures({
  anchorPoints,
  blockFeatures,
  excludedFeatures,
  radiusMeters,
  selectedDistrict,
  selectedFeatures,
  selectedRouteZoneKeys,
}: {
  anchorPoints: Array<{ lon: number; lat: number }>;
  blockFeatures: HojasRutaBlockMapFeature[];
  excludedFeatures: HojasRutaBlockMapFeature[];
  radiusMeters: number;
  selectedDistrict: string;
  selectedFeatures: TerritorialSelectedFeature[];
  selectedRouteZoneKeys: Set<string>;
}) {
  const excludedFocusFeatures = new Set(excludedFeatures);
  const selectedFeatureRefs = new Set(selectedFeatures.map((item) => item.feature));
  const scoreFeature = (feature: HojasRutaBlockMapFeature) => {
    const centroid = territorialFeatureGeoCentroid(feature);
    const distance = centroid && anchorPoints.length
      ? Math.min(...anchorPoints.map((anchor) => territorialApproxDistanceMeters(anchor, centroid)))
      : Number.MAX_SAFE_INTEGER;
    return {
      feature,
      distance,
      inSelectedRouteZone: territorialFeatureMatchesZoneKeys(feature, selectedRouteZoneKeys),
      sameDistrict: Boolean(selectedDistrict) && territorialFeatureUbigeo(feature) === selectedDistrict,
    };
  };
  const compareContextFeature = (
    a: ReturnType<typeof scoreFeature>,
    b: ReturnType<typeof scoreFeature>,
  ) => (
    Number(a.inSelectedRouteZone) - Number(b.inSelectedRouteZone)
    || Number(b.sameDistrict) - Number(a.sameDistrict)
    || a.distance - b.distance
  );
  const scored = blockFeatures
    .filter((feature) => !selectedFeatureRefs.has(feature))
    .map(scoreFeature)
    .sort(compareContextFeature)
    .filter((item) => item.distance <= radiusMeters);
  const radialContext = scored.filter((item) => !excludedFocusFeatures.has(item.feature));
  const picked = radialContext.length ? radialContext : blockFeatures
    .filter((feature) => !selectedFeatureRefs.has(feature) && !excludedFocusFeatures.has(feature))
    .map(scoreFeature)
    .sort(compareContextFeature)
    .slice(0, Math.min(48, VALIDATION_NEIGHBOR_CONTEXT_LIMIT));
  return picked
    .slice(0, VALIDATION_NEIGHBOR_CONTEXT_LIMIT)
    .map((item) => item.feature);
}

function territorialFeatureUbigeo(feature: HojasRutaBlockMapFeature) {
  const props = feature.properties as Record<string, unknown>;
  return normalizeRouteBlockCode(props.ubigeo ?? props.UBIGEO);
}

function territorialFeatureZoneRawValue(feature: HojasRutaBlockMapFeature) {
  const props = feature.properties as Record<string, unknown>;
  const explicit = props.inei_zona ?? props.CODZONA;
  const suffix = normalizeRouteBlockCode(props.SUFZONA);
  if (explicit && suffix) return `${normalizeRouteBlockCode(explicit).padStart(3, "0")}${suffix.padStart(2, "0")}`;
  if (explicit) return explicit;
  const id = normalizeRouteBlockCode(
    props.inei_id_manzana
      ?? props.cartografia_id
      ?? props.ID_MANZANA
      ?? props.IDMANZANA
      ?? props.id_manzana_norm
      ?? feature.id
  );
  const ubigeo = territorialFeatureUbigeo(feature);
  if (id && ubigeo && id.startsWith(ubigeo) && id.length >= 11) return id.slice(6, 11);
  return "";
}

function territorialZoneKeyVariants(ubigeoValue: unknown, zonaValue: unknown) {
  const ubigeo = normalizeRouteBlockCode(ubigeoValue);
  if (!ubigeo) return [];
  return territorialZoneCodeVariants(zonaValue).map((zona) => `${ubigeo}:${zona}`);
}

function territorialZoneCodeVariants(value: unknown) {
  const normalized = normalizeRouteBlockCode(value);
  if (!normalized) return [];
  const values = new Set<string>();
  const add = (candidate: unknown, includeTrimmed = true) => {
    const code = normalizeRouteBlockCode(candidate);
    if (!code) return;
    values.add(code);
    if (includeTrimmed) values.add(stripLeftZeros(code));
  };
  if (/^\d+$/.test(normalized)) {
    if (normalized.length <= 3) {
      const base = normalized.padStart(3, "0");
      add(base);
      add(`${base}00`, false);
    } else if (normalized.length === 5 && normalized.endsWith("00")) {
      add(normalized, false);
      add(normalized.slice(0, 3));
    } else {
      add(normalized);
    }
  } else {
    add(normalized);
  }
  return Array.from(values).filter(Boolean);
}

function territorialFeatureRawProperty(feature: HojasRutaBlockMapFeature, ...names: string[]) {
  const props = feature.properties as Record<string, unknown>;
  return names.map((name) => props[name]).find((value) => value != null && String(value).trim());
}

function territorialApproxDistanceMeters(
  a: { lon: number; lat: number },
  b: { lon: number; lat: number },
) {
  const latRadians = ((a.lat + b.lat) / 2) * Math.PI / 180;
  const dx = (b.lon - a.lon) * 111_320 * Math.cos(latRadians);
  const dy = (b.lat - a.lat) * 110_574;
  return Math.hypot(dx, dy);
}

function territorialGeoGroupListItems(groups: TerritorialGeoBlockGroup[]): TerritorialGeoGroupListItem[] {
  const sections = new Map<string, TerritorialGeoGroupSection>();
  groups.forEach((group) => {
    const buckets = new Map<string, { sectionMeta: Pick<TerritorialGeoGroupSection, "key" | "kind" | "distrito" | "ubigeo">; rows: TerritorialGpsCase[] }>();
    group.rows.forEach((caseItem) => {
      const sectionMeta = territorialGeoCaseSectionMeta(caseItem, group);
      const bucket = buckets.get(sectionMeta.key) ?? { sectionMeta, rows: [] };
      bucket.rows.push(caseItem);
      buckets.set(sectionMeta.key, bucket);
    });
    buckets.forEach(({ sectionMeta, rows }) => {
      const section = sections.get(sectionMeta.key) ?? {
        ...sectionMeta,
        caseCount: 0,
        groups: [],
      };
      section.caseCount += rows.length;
      section.groups.push(territorialCloneGeoGroupForRows(group, rows));
      sections.set(sectionMeta.key, section);
    });
  });
  return Array.from(sections.values())
    .sort(territorialGeoGroupSectionComparator)
    .flatMap((section) => {
      const sectionMeta = territorialGeoGroupSectionLabel(section);
      return section.groups.map((group, index) => ({
        key: `${section.key}:${group.key}`,
        section,
        sectionMeta,
        showHeading: index === 0,
        group,
      }));
    });
}

function territorialCloneGeoGroupForRows(group: TerritorialGeoBlockGroup, rows: TerritorialGpsCase[]): TerritorialGeoBlockGroup {
  return {
    ...group,
    rows,
    gpsCount: rows.filter((item) => territorialResponseHasGps(item.row)).length,
    reviewCount: rows.filter((item) => item.geoDisposition === "en_distrito" || item.geoDisposition === "sin_cruce" || item.geoDisposition === "sin_gps").length,
    noDefendibleCount: rows.filter((item) => item.geoDisposition === "fuera_distrito").length,
    responsable: responsibleGroupLabel(rows),
  };
}

function territorialGeoCaseSectionMeta(
  item: TerritorialGpsCase,
  group: TerritorialGeoBlockGroup,
): Pick<TerritorialGeoGroupSection, "key" | "kind" | "distrito" | "ubigeo"> {
  if (item.geoDisposition === "sin_cruce") {
    return {
      key: "sin-cruce-territorial",
      kind: "without_cross",
      distrito: "Sin cruce territorial",
      ubigeo: "ruta/crosswalk",
    };
  }
  if (item.geoDisposition === "sin_gps") {
    return {
      key: "sin-punto-geografico",
      kind: "without_gps",
      distrito: "Sin punto geográfico",
      ubigeo: "coord. ausente",
    };
  }
  const block = group.block ?? item.block ?? group.routeBlocks[0] ?? null;
  const distrito = territorialFirstText([
    block?.distrito,
    item.row.distrito,
    item.spatialDistrito,
    item.row.district_code,
  ]) || "Distrito de ruta";
  const ubigeo = normalizeRouteBlockCode(territorialFirstText([
    block?.ubigeo,
    item.row.ubigeo,
    item.row.advance_block_ubigeo,
    item.spatialUbigeo,
    item.row.district_code,
  ]));
  if (!block && territorialResponseHasGps(item.row)) {
    return {
      key: `${ubigeo || "sin-ubigeo"}:${normalizeMatch(distrito) || "sin-distrito"}:fuera-marco`,
      kind: "outside_frame",
      distrito: distrito || "Fuera del marco de ruta",
      ubigeo: ubigeo || "sin UMP",
    };
  }
  return {
    key: `${ubigeo || "sin-ubigeo"}:${normalizeMatch(distrito) || "sin-distrito"}`,
    kind: "route",
    distrito,
    ubigeo,
  };
}

function territorialGeoGroupSectionLabel(section: TerritorialGeoGroupSection) {
  if (section.kind === "outside_frame") return `${formatMetric(section.caseCount)} casos · punto observable`;
  if (section.kind === "without_cross") return `${formatMetric(section.caseCount)} casos · cruce pendiente`;
  if (section.kind === "without_gps") return `${formatMetric(section.caseCount)} casos · hora registrada`;
  return `${section.ubigeo || "Sin ubigeo"} · ${formatMetric(section.caseCount)} casos · ${formatMetric(section.groups.length)} UMP`;
}

function territorialGeoGroupSectionComparator(a: TerritorialGeoGroupSection, b: TerritorialGeoGroupSection) {
  const order: Record<TerritorialGeoDistrictSectionKind, number> = {
    route: 0,
    outside_frame: 1,
    without_cross: 2,
    without_gps: 3,
  };
  return order[a.kind] - order[b.kind]
    || a.distrito.localeCompare(b.distrito, "es-PE", { numeric: true })
    || a.ubigeo.localeCompare(b.ubigeo, "es-PE", { numeric: true });
}

function territorialFirstText(values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function territorialGeoZoneSummary(
  group: TerritorialGeoBlockGroup,
  selected: boolean,
): TerritorialGeoZoneSummary {
  const gpsRows = group.rows.filter((item) => territorialResponseHasGps(item.row));
  const inZoneCount = gpsRows.filter((item) => item.geoDisposition === "en_zona").length;
  const outsideZoneCount = gpsRows.filter((item) => item.geoDisposition === "en_distrito").length;
  const outsideDistrictCount = gpsRows.filter((item) => item.geoDisposition === "fuera_distrito").length;
  const withoutCrossCount = group.rows.filter((item) => item.geoDisposition === "sin_cruce").length;
  const withoutGpsCount = group.rows.filter((item) => item.geoDisposition === "sin_gps").length;
  return {
    selected,
    inZoneCount,
    outsideZoneCount,
    outsideDistrictCount,
    withoutCrossCount,
    withoutGpsCount,
    gpsCount: gpsRows.length,
    caseCount: group.rows.length,
  };
}

function territorialGeoGroupRiskSummary(
  group: TerritorialGeoBlockGroup,
  zoneSummary: TerritorialGeoZoneSummary,
): TerritorialGeoGroupRiskSummary {
  const outsideDistrict = zoneSummary.outsideDistrictCount;
  const outsideZone = zoneSummary.outsideZoneCount;
  const withoutCross = zoneSummary.withoutCrossCount;
  const withoutGps = zoneSummary.withoutGpsCount;
  const tags: TerritorialGeoGroupRiskSummary["tags"] = [];

  if (zoneSummary.inZoneCount) tags.push({ key: "in-zone", label: `${formatMetric(zoneSummary.inZoneCount)} en zona`, tone: "ready" });
  if (outsideZone) tags.push({ key: "outside-zone", label: `${formatMetric(outsideZone)} fuera zona`, tone: "warning" });
  if (outsideDistrict) tags.push({ key: "outside-district", label: `${formatMetric(outsideDistrict)} fuera distrito`, tone: "danger" });
  if (withoutCross) tags.push({ key: "without-cross", label: `${formatMetric(withoutCross)} sin cruce`, tone: "warning" });
  if (withoutGps) tags.push({ key: "without-gps", label: `${formatMetric(withoutGps)} sin GPS`, tone: "muted" });
  if (!tags.length) tags.push({ key: "declared-ump", label: "UMP declarada", tone: "ready" });

  const tone: TerritorialGeoRiskTone = outsideDistrict
    ? "danger"
    : outsideZone || withoutCross
      ? "warning"
      : withoutGps && withoutGps === group.rows.length
        ? "muted"
        : "ready";
  if (zoneSummary.gpsCount > 0) {
    const zoneLabel = outsideDistrict
      ? `${formatMetric(outsideDistrict)} fuera distrito`
      : outsideZone
        ? `${formatMetric(outsideZone)} fuera zona`
        : `${formatMetric(zoneSummary.inZoneCount)}/${formatMetric(zoneSummary.gpsCount)} en zona`;
    return {
      tone,
      distanceLabel: zoneLabel,
      distanceHint: zoneSummary.selected ? "zona UMP" : "criterio territorial",
      tags: tags.slice(0, 3),
    };
  }
  return {
    tone,
    distanceLabel: withoutCross ? "Sin cruce" : withoutGps ? "Sin GPS" : "S/D",
    distanceHint: withoutCross ? "cruce pendiente" : withoutGps ? "coord. ausente" : "sin zona",
    tags: tags.slice(0, 3),
  };
}

function territorialGeoZoneFitLabel(value: TerritorialGeoDispositionKey, selected: boolean) {
  if (value === "en_zona") return selected ? "En zona UMP" : "En zona";
  if (value === "en_distrito") return selected ? "Fuera zona UMP" : "Fuera zona";
  if (value === "fuera_distrito") return "Fuera distrito";
  if (value === "sin_cruce") return "Sin cruce";
  return "Sin GPS";
}

function territorialRouteBlockComparator(a: TerritorialBlockProgress, b: TerritorialBlockProgress) {
  return (numberOrNull(a.rango_inicio) ?? Number.MAX_SAFE_INTEGER) - (numberOrNull(b.rango_inicio) ?? Number.MAX_SAFE_INTEGER)
    || Number(isReplacementBlock(a)) - Number(isReplacementBlock(b))
    || territorialRouteUmpNumber(a) - territorialRouteUmpNumber(b)
    || String(a.distrito).localeCompare(String(b.distrito), "es-PE")
    || String(a.zona).localeCompare(String(b.zona), "es-PE", { numeric: true })
    || String(a.manzana).localeCompare(String(b.manzana), "es-PE", { numeric: true });
}

function territorialRouteUmpNumber(block: TerritorialBlockProgress) {
  return numberOrNull(block.hoja_num)
    ?? numberOrNull(block.orden_seleccion)
    ?? numberOrNull(block.ump)
    ?? numberOrNull(block.titular_hoja_num)
    ?? Number.MAX_SAFE_INTEGER;
}

function territorialRouteReplacementUmpNumber(block: TerritorialBlockProgress) {
  return numberOrNull(block.titular_hoja_num)
    ?? numberOrNull(block.titular_orden_seleccion)
    ?? numberOrNull(block.ump);
}

function territorialRouteReplacementLabel(block: TerritorialBlockProgress) {
  const unit = territorialRouteReplacementUmpNumber(block);
  const order = numberOrNull(block.replacement_order);
  if (unit != null) {
    return order != null && order > 1 ? `R ${formatMetric(unit)}.${formatMetric(order)}` : `R ${formatMetric(unit)}`;
  }
  const fallbackOrder = numberOrNull(block.replacement_order) ?? numberOrNull(block.hoja_num) ?? numberOrNull(block.orden_seleccion);
  return fallbackOrder != null ? `R ${formatMetric(fallbackOrder)}` : "R";
}

function territorialRouteOperationalLabel(block: TerritorialBlockProgress) {
  if (isReplacementBlock(block)) {
    const titular = numberOrNull(block.titular_hoja_num) ?? numberOrNull(block.titular_orden_seleccion);
    return `${titular != null ? `UMP ${formatMetric(titular)}` : "UMP por definir"} · ${territorialRouteReplacementLabel(block)}`;
  }
  const value = territorialRouteUmpNumber(block);
  return Number.isFinite(value) && value !== Number.MAX_SAFE_INTEGER ? `UMP ${formatMetric(value)}` : "UMP por definir";
}

function territorialPhysicalBlockLabel(block: TerritorialBlockProgress) {
  return `Mz ${block.manzana || block.id_manzana || "S/D"}`;
}

function territorialResponseHasGps(row: TerritorialResponseAuditRow) {
  const lat = numberOrNull(row.lat ?? row.gps_effective_lat ?? row.gps_primary_lat);
  const lon = numberOrNull(row.lon ?? row.gps_effective_lon ?? row.gps_primary_lon);
  return Boolean(row.gps_parseable) || (lat != null && lon != null);
}

function territorialResponseIsEffective(row: TerritorialResponseAuditRow) {
  if (row.source_effective === false || row.advance_valid === false) return false;
  const status = normalizeMatch(row.validation_status || row.advance_status || row.status);
  return !["no_defendible", "no_valida", "no_valido", "rechazo", "rechazado", "rejected"].includes(status);
}

function formatDistanceLabel(value: number | null | undefined) {
  const meters = numberOrNull(value);
  if (meters == null) return "S/D";
  if (Math.abs(meters) >= 1000) return `${(meters / 1000).toFixed(meters >= 10000 ? 1 : 2)} km`;
  return `${Math.round(meters)} m`;
}

function territorialGpsTraceLabel(row: Partial<TerritorialResponseAuditRow>) {
  const source = territorialGpsSourceLabel(row.gps_effective_source);
  const primary = territorialGpsSourceLabel(row.gps_primary_source);
  const accuracy = numberOrNull(row.gps_effective_accuracy_m);
  const parts = [
    source ? `fuente ${source}` : "",
    row.gps_reclassified && primary && source && primary !== source ? `reemplaza ${primary}` : "",
    accuracy != null ? `prec. ${formatDistanceLabel(accuracy)}` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

function territorialMissingResponsibleLabel(value: unknown) {
  const key = normalizeMatch(value);
  return !key
    || key === "sd"
    || key === "s_d"
    || /^responsable_\d+$/.test(key)
    || key.includes("sin_responsable")
    || key.includes("sin_asignar")
    || key.includes("no_asignado")
    || key.includes("sin_encuestador")
    || key.includes("responsable_no_identificado");
}

function territorialPulsoCodeLabel(row: TerritorialResponseAuditRow) {
  const code = String(row.pulso_code_normalized || row.pulso_code || row.pulso_code_raw || "").trim();
  return code || "S/D";
}

function territorialEnumeratorName(row: TerritorialResponseAuditRow) {
  const name = String(row.enumerator_assigned || "").trim();
  const code = territorialPulsoCodeLabel(row);
  if (territorialMissingResponsibleLabel(name)) return "";
  if (code !== "S/D" && normalizeRouteBlockCode(name) === normalizeRouteBlockCode(code)) return "";
  return name;
}

function territorialCaseResponsibleLabel(row: TerritorialResponseAuditRow, includeCode = false) {
  const name = territorialEnumeratorName(row);
  const code = territorialPulsoCodeLabel(row);
  if (name && includeCode && code !== "S/D") return `${code} · ${name}`;
  if (name) return name;
  if (code !== "S/D") return "Responsable no identificado";
  return "Sin responsable asignado";
}

function responsibleGroupLabel(cases: TerritorialGpsCase[]) {
  const labels = Array.from(new Set(cases
    .map((item) => territorialCaseResponsibleLabel(item.row, false))
    .filter((label) => !territorialMissingResponsibleLabel(label) && normalizeMatch(label) !== "responsable_no_identificado")));
  if (labels.length === 1) return labels[0];
  if (labels.length > 1) return `${formatMetric(labels.length)} responsables reconocidos`;
  const hasUnrecognizedCode = cases.some((item) => territorialPulsoCodeLabel(item.row) !== "S/D");
  return hasUnrecognizedCode ? "Responsable no identificado" : "Sin responsable asignado";
}

function geoDispositionFromRaw(value: unknown): TerritorialGeoDispositionKey {
  const key = normalizeMatch(value);
  if (key.includes("sin_gps")) return "sin_gps";
  if (key.includes("sin_cruce")) return "sin_cruce";
  if (key.includes("no_defendible") || key.includes("fuera_distrito")) return "fuera_distrito";
  if (key.includes("revision") || key.includes("cerca")) return "en_distrito";
  return "en_zona";
}

function territorialGpsStateClass(value: unknown, fallback: TerritorialGeoDispositionKey) {
  const key = normalizeMatch(value);
  if (key.includes("sin_gps")) return "is-geo_sin_gps";
  if (key.includes("sin_cruce")) return "is-geo_sin_cruce";
  if (key.includes("no_defendible") || key.includes("fuera_distrito")) return "is-geo_no_defendible";
  if (key.includes("revision")) return "is-geo_revision";
  if (key.includes("cerca")) return "is-geo_cerca";
  if (fallback === "sin_gps") return "is-geo_sin_gps";
  if (fallback === "sin_cruce") return "is-geo_sin_cruce";
  if (fallback === "fuera_distrito") return "is-geo_no_defendible";
  if (fallback === "en_distrito") return "is-geo_revision";
  return "is-geo_ok";
}

function territorialGeoDispositionMeta(value: TerritorialGeoDispositionKey) {
  if (value === "en_zona") return { label: "En zona", shortLabel: "Zona", detail: "dentro de zona" };
  if (value === "en_distrito") return { label: "Fuera de zona", shortLabel: "Fuera zona", detail: "en distrito" };
  if (value === "fuera_distrito") return { label: "Fuera de distrito", shortLabel: "Fuera distrito", detail: "fuera de distrito" };
  if (value === "sin_cruce") return { label: "Sin cruce territorial", shortLabel: "Sin cruce", detail: "sin ruta/crosswalk" };
  return { label: "Sin GPS", shortLabel: "Sin GPS", detail: "sin coordenada" };
}

function buildPendingSpatialChange(
  reconciliation: MonitoreoTerritorialUmpReconciliation | null | undefined,
): TerritorialPendingSpatialReconciliationChange | null {
  if (!reconciliation) return null;
  const id = pendingUmpReconciliationId(reconciliation);
  if (!id) return null;
  const route = [
    reconciliation.assigned_ump ? `UMP ${reconciliation.assigned_ump}` : "",
    reconciliation.assigned_district,
    reconciliation.assigned_block_id ? `Mz ${reconciliation.assigned_block_id}` : "",
  ].filter(Boolean).join(" · ");
  return {
    id,
    label: reconciliation.raw_ump || "UMP sin dato",
    detail: `${territorialSpatialReconciliationScopeLabel(reconciliation.scope || "response")} · ${route || "Sin ruta"}`,
    payload: reconciliation,
    status: "pending",
  };
}

function territorialSpatialReconciliationScopeLabel(scope: string) {
  return scope === "ump_value" ? "Valor UMP" : "Esta respuesta";
}

function pendingUmpReconciliationId(reconciliation: MonitoreoTerritorialUmpReconciliation | null | undefined) {
  if (!reconciliation) return "";
  return [
    "ump",
    reconciliation.response_id || reconciliation.response_id_field || "value",
    reconciliation.raw_ump,
    reconciliation.assigned_block_id,
    reconciliation.assigned_ump,
  ].map((value) => String(value ?? "").trim()).join(":");
}

function spatialPatternCandidateIds(pattern: MonitoreoTerritorialSpatialReconciliationPattern) {
  return Array.isArray(pattern.candidate_ids) ? pattern.candidate_ids.filter(Boolean) : [];
}

function territorialSpatialConfidenceLabel(confidence: string) {
  const key = normalizeMatch(confidence);
  if (key === "alta") return "Alta";
  if (key === "media") return "Media";
  if (key === "baja") return "Baja";
  return confidence || "Sin score";
}

function territorialSpatialBlockLabel({
  ump,
  blockId,
  manzana,
  district,
}: {
  ump?: string;
  blockId?: string;
  manzana?: string;
  district?: string;
}) {
  const main = [
    ump ? `UMP ${ump}` : "",
    manzana ? `Mz ${manzana}` : "",
  ].filter(Boolean).join(" · ");
  const fallback = blockId ? `Mz ${blockId}` : "Sin manzana";
  return { main: main || fallback, detail: district || "" };
}

function territorialGpsSourceLabel(value: unknown) {
  const raw = String(value ?? "").trim();
  const key = normalizeMatch(raw);
  if (!raw) return "";
  if (key === "_geolocation" || key === "geolocation") return "Kobo";
  if (key === "gps_inicio") return "GPS inicio";
  if (key === "gps_background") return "GPS fondo";
  return raw;
}

function TerritorialSpatialImpactPreview({ impact }: { impact?: MonitoreoTerritorialSpatialQuotaImpact }) {
  if (!impact) return null;
  const sourceBreaks = Boolean(impact.source?.would_break_quota);
  const targetCompletes = Boolean(impact.target?.would_complete_quota);
  return (
    <div className="mon-territorial-spatial-impact" aria-label="Impacto preliminar en cuotas">
      <span>
        <em>Origen</em>
        <strong>{formatMetric(impact.source?.before_validas ?? 0)} {"->"} {formatMetric(impact.source?.after_validas ?? 0)} / {formatMetric(impact.source?.target ?? 0)}</strong>
      </span>
      <span>
        <em>Destino</em>
        <strong>{formatMetric(impact.target?.before_validas ?? 0)} {"->"} {formatMetric(impact.target?.after_validas ?? 0)} / {formatMetric(impact.target?.target ?? 0)}</strong>
      </span>
      {targetCompletes ? <mark className="is-positive">Completa destino</mark> : null}
      {sourceBreaks ? <mark className="is-danger">Rompe origen</mark> : null}
    </div>
  );
}

type TerritorialSubmissionStampSource = {
  submission_date?: string | null;
  submission_hour?: string | null;
  submission_datetime?: string | null;
  submission_time?: string | null;
  submission_time_source?: string | null;
};

function territorialSubmissionStampParts(row: TerritorialSubmissionStampSource) {
  const date = String(row.submission_date ?? "").trim();
  const hour = normalizeTerritorialHourLabel(String(row.submission_hour ?? "").trim());
  const rawTime = String(row.submission_time ?? "").trim();
  const source = String(row.submission_time_source ?? "").trim();
  const midnightFallback =
    isTerritorialMidnightLabel(hour) &&
    !territorialTimestampHasExplicitNonMidnightClock(rawTime) &&
    !["end", "end_time", "start", "start_time"].includes(source);
  if (date && hour && !midnightFallback) return { date, hour, label: `${date} · ${hour}` };
  if (date && hour && midnightFallback) return { date, hour: "sin hora", label: `${date} · sin hora` };
  if (date || hour) return { date, hour: date ? "" : hour, label: date || hour };
  const fallback = String(row.submission_datetime ?? row.submission_time ?? "").trim();
  return { date: "", hour: "", label: fallback };
}

function normalizeTerritorialHourLabel(value: string) {
  const raw = value.trim();
  const twelveHour = raw.match(/^0?(\d{1,2}):(\d{2})\s*([ap])\.?m\.?$/i);
  if (twelveHour) return `${Number(twelveHour[1])}:${twelveHour[2]}${twelveHour[3].toLowerCase()}m`;
  const twentyFourHour = raw.match(/^([01]?\d|2[0-3]):(\d{2})(?::\d{2})?$/);
  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1]);
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${twentyFourHour[2]}${hour >= 12 ? "pm" : "am"}`;
  }
  return raw;
}

function isTerritorialMidnightLabel(value: string) {
  return /^12:00\s*a\.?m\.?$/i.test(value.trim());
}

function territorialTimestampHasExplicitNonMidnightClock(value: string) {
  const raw = value.trim();
  const match = raw.match(/(?:T|\s)(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  return hour !== 0 || minute !== 0 || second !== 0;
}

function territorialReviewSexLabel(row: Partial<TerritorialResponseAuditRow>) {
  const key = normalizeMatch(row.sex);
  if (["1", "h", "hombre", "masculino", "male", "varon"].includes(key)) return "H";
  if (["2", "m", "mujer", "femenino", "female", "f"].includes(key)) return "M";
  const raw = String(row.sex ?? "").trim();
  return raw || "S/D";
}

function territorialReviewAgeLabel(row: Partial<TerritorialResponseAuditRow>) {
  const age = numberOrNull(row.age);
  return age == null ? "S/D" : formatMetric(age);
}

function uniqueBlocks(blocks: TerritorialBlockProgress[]) {
  const lookup = new Map<string, TerritorialBlockProgress>();
  blocks.forEach((block, index) => {
    const key = territorialBlockStableKey(block) || `block-${index}`;
    if (!lookup.has(key)) lookup.set(key, block);
  });
  return Array.from(lookup.values());
}

function isReplacementBlock(block: TerritorialBlockProgress) {
  return normalizeMatch(block.tipo_manzana) === "reemplazo";
}

function normalizeMatch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function stripLeftZeros(value: unknown) {
  const raw = String(value ?? "").trim();
  const stripped = raw.replace(/^0+(?=\d)/, "");
  return stripped || raw;
}

function numberOrNull(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatMetric(value: unknown) {
  if (value == null || value === "") return "0";
  const n = Number(value);
  if (Number.isFinite(n)) return new Intl.NumberFormat("es-PE").format(n);
  return String(value);
}

// React.memo (unidad 3.6): la página re-renderiza en cada poll de sync y
// transición de scopes; con props estabilizadas en el caller, este workbench
// solo se re-renderiza cuando cambian sus datos reales.
export const TerritorialValidationGeoWorkbench = memo(TerritorialValidationGeoWorkbenchImpl);

// React.memo (unidad 3.6): la página re-renderiza en cada poll de sync y
// transición de scopes; con props estabilizadas en el caller, este workbench
// solo se re-renderiza cuando cambian sus datos reales.
export const TerritorialSpatialReconciliationWorkbench = memo(TerritorialSpatialReconciliationWorkbenchImpl);
