import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { BarChart3, CheckCircle2, Download, FileSpreadsheet, FileText, Layers, Loader2, MapPinned, Plus, Play, Search, Shuffle, Target, Trash2 } from "lucide-react";
import {
  apiHojasRutaBlockMap,
  apiHojasRutaContextMap,
  apiHojasRutaGenerate,
  apiHojasRutaPersistWorkspace,
  apiHojasRutaPopulationExport,
  apiHojasRutaPopulationPreview,
  apiHojasRutaQuotaPreview,
  apiHojasRutaSampleSizePreview,
  apiHojasRutaSamplePreview,
  apiHojasRutaState,
  apiHojasRutaStreetMap,
  apiHojasRutaZoneMap,
  downloadUrl,
  AllocationMode,
  HojasRutaAlert,
  HojasRutaAgeRangeMode,
  HojasRutaAgeRange,
  HojasRutaBlockMap,
  HojasRutaBlockMapFeature,
  HojasRutaContextMap,
  HojasRutaContextMapFeature,
  HojasRutaIntegratedConfig,
  HojasRutaJobResult,
  HojasRutaPopulationExportResult,
  HojasRutaSampleSizeConfig,
  HojasRutaSampleSizePreview,
  HojasRutaSamplePreview,
  HojasRutaState,
  HojasRutaStreetMap,
  HojasRutaStreetMapFeature,
  HojasRutaUiState,
  HojasRutaZoneMap,
  HojasRutaZoneMapFeature,
  SampleSizeMode,
  PopulationPlan,
  QuotaPlan,
  SamplingMethod,
} from "../../api/client";
import { Alert } from "../../components/Alert";
import { JobProgress } from "../../components/JobProgress";
import { PageHeader } from "../../components/PageHeader";
import { Panel } from "../../components/Panel";
import { EmptyState, LoadingBlock } from "../../components/States";
import { TabMeta, TabStrip } from "../../components/TabStrip";
import { useSession } from "../../lib/SessionContext";
import districtCoverage from "./limaDistrictCoverage.json";
import {
  clearHojasRutaWorkspaceSnapshot,
  setHojasRutaWorkspaceSnapshot,
} from "./configSnapshot";
import "./hojasRuta.css";

type GeoPosition = [number, number];
type GeoRing = GeoPosition[];
type GeoPolygon = GeoRing[];
type GeoMultiPolygon = GeoPolygon[];
type DistrictGeometry =
  | { type: "Polygon"; coordinates: GeoPolygon }
  | { type: "MultiPolygon"; coordinates: GeoMultiPolygon };
type DistrictFeature = {
  type: "Feature";
  properties: {
    ubigeo: string;
    distrito: string;
    provincia?: string;
    departamento?: string;
    poblacion_2017?: number;
    viviendas_2017?: number;
    label_lon: number;
    label_lat: number;
  };
  geometry: DistrictGeometry;
};
type HojasRutaStage = "territorio" | "poblacion" | "muestra" | "manzanas" | "entrega";
type HojasRutaMapLevel = HojasRutaUiState["map_level"];
const HOJAS_RUTA_STAGES: HojasRutaStage[] = ["territorio", "poblacion", "muestra", "manzanas", "entrega"];

const DISTRICT_FEATURES = (districtCoverage as unknown as { features: DistrictFeature[] }).features;
const DISTRICT_FEATURE_BY_UBIGEO = new Map(DISTRICT_FEATURES.map((feature) => [feature.properties.ubigeo, feature]));
const MAP_SIZE = 560;
const MAP_PADDING = 18;
const BLOCK_MAP_WIDTH = 1100;
const BLOCK_MAP_HEIGHT = 760;
const BLOCK_MAP_PADDING = 18;
const LIMA_MAP_MAX_ZOOM = 5;
const BLOCK_MAP_MAX_ZOOM = 10;
const STREET_MAP_CLIENT_CACHE_VERSION = "street-context-neighbor-v2";
const CONTEXT_MAP_CLIENT_CACHE_VERSION = "context-neighbor-curated-v2";
const MAP_GEOMETRY_STYLE = {
  background: "#f7f5e8",
  contextFill: "rgba(248,246,226,0.76)",
  contextStroke: "rgba(31,41,55,0.66)",
  mutedFill: "rgba(248,246,226,0.64)",
  mutedStroke: "rgba(51,65,85,0.46)",
  focusFill: "rgba(213,241,232,0.72)",
  focusStroke: "#0f766e",
  selectedFill: "#0f766e",
  selectedStroke: "#064e3b",
  hoverStroke: "#022c22",
  inspectedFill: "rgba(15,118,110,0.2)",
} as const;

function streetMapCacheKey(ubigeo: string) {
  return `${ubigeo}|${STREET_MAP_CLIENT_CACHE_VERSION}`;
}

function contextMapCacheKey(ubigeo: string) {
  return `${ubigeo}|${CONTEXT_MAP_CLIENT_CACHE_VERSION}`;
}

function geometryVisualState({
  selected = false,
  focused = false,
  hovered = false,
  muted = false,
}: {
  selected?: boolean;
  focused?: boolean;
  hovered?: boolean;
  muted?: boolean;
}) {
  if (selected) {
    return {
      fill: MAP_GEOMETRY_STYLE.selectedFill,
      stroke: hovered ? MAP_GEOMETRY_STYLE.hoverStroke : MAP_GEOMETRY_STYLE.selectedStroke,
      strokeWidth: hovered ? 1.35 : 1.05,
      opacity: 1,
    };
  }
  if (focused) {
    return {
      fill: MAP_GEOMETRY_STYLE.focusFill,
      stroke: hovered ? MAP_GEOMETRY_STYLE.hoverStroke : MAP_GEOMETRY_STYLE.focusStroke,
      strokeWidth: hovered ? 1.45 : 0.82,
      opacity: 1,
    };
  }
  return {
    fill: muted ? MAP_GEOMETRY_STYLE.mutedFill : MAP_GEOMETRY_STYLE.contextFill,
    stroke: hovered ? MAP_GEOMETRY_STYLE.hoverStroke : muted ? MAP_GEOMETRY_STYLE.mutedStroke : MAP_GEOMETRY_STYLE.contextStroke,
    strokeWidth: hovered ? 1.15 : 0.58,
    opacity: muted ? 0.9 : 1,
  };
}

function normalizeHojasRutaUiState(
  uiState: Partial<HojasRutaUiState> | null | undefined,
  fallbackTerritories: string[] = [],
): HojasRutaUiState {
  const activeStage = HOJAS_RUTA_STAGES.includes(uiState?.active_stage as HojasRutaStage)
    ? uiState?.active_stage as HojasRutaStage
    : "territorio";
  const draft = Array.isArray(uiState?.draft_territories)
    ? uiState?.draft_territories.filter((ubigeo): ubigeo is string => typeof ubigeo === "string" && ubigeo.length > 0)
    : fallbackTerritories;
  const mapUbigeo = typeof uiState?.map_ubigeo === "string" ? uiState.map_ubigeo : "";
  const mapZona = typeof uiState?.map_zona === "string" ? uiState.map_zona : "";
  const mapLevel = ["distritos", "zonas", "manzanas"].includes(String(uiState?.map_level))
    ? uiState?.map_level as HojasRutaMapLevel
    : mapZona ? "manzanas" : mapUbigeo ? "zonas" : "distritos";
  return {
    active_stage: activeStage,
    draft_territories: Array.from(new Set(draft)),
    map_ubigeo: mapUbigeo,
    map_zona: mapZona,
    map_level: mapUbigeo ? mapLevel : "distritos",
    map_selection_mode: Boolean(uiState?.map_selection_mode),
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
type MapPan = { x: number; y: number };

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  border: "1px solid var(--pulso-primary)",
  background: "var(--pulso-primary)",
  color: "white",
  borderRadius: 6,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  border: "1px solid var(--pulso-border)",
  background: "white",
  color: "var(--pulso-text)",
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--pulso-border)",
  borderRadius: 6,
  padding: "8px 10px",
  fontSize: 13,
  background: "white",
  color: "var(--pulso-text)",
};

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("es-PE").format(Number(value ?? 0));
}

function formatPercent(part: number | null | undefined, total: number | null | undefined) {
  const denominator = Number(total ?? 0);
  if (!Number.isFinite(denominator) || denominator <= 0) return "0.0%";
  return new Intl.NumberFormat("es-PE", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number(part ?? 0) / denominator);
}

function formatRate(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(Number(value))) return "Sin dato";
  return new Intl.NumberFormat("es-PE", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value));
}

const DEFAULT_SAMPLE_SIZE: HojasRutaSampleSizeConfig = {
  confidence_level: 0.95,
  margin_total: 0.05,
  margin_district: 0.10,
  margin_district_overrides: {},
  expected_proportion: 0.50,
  design_effect: 1.5,
  design_effect_overrides: {},
  allocation_mode: "proportional",
  enforce_district_floor: true,
  response_rate: 0.90,
  apply_fpc: true,
};

type RouteMultipleStatus = {
  ok: boolean;
  routeSize: number;
  message: string;
  invalidDistricts: Array<{ ubigeo: string; distrito: string; n: number }>;
  previous: number;
  next: number;
};

function normalizeSampleSizeSettings(value: Partial<HojasRutaSampleSizeConfig> | null | undefined): HojasRutaSampleSizeConfig {
  const merged = { ...DEFAULT_SAMPLE_SIZE, ...(value ?? {}) };
  return {
    ...merged,
    allocation_mode: merged.allocation_mode ?? "proportional",
    enforce_district_floor: merged.enforce_district_floor ?? true,
    design_effect_overrides: merged.design_effect_overrides ?? {},
    margin_district_overrides: merged.margin_district_overrides ?? {},
  };
}

function routeExamples(n: number, routeSize: number) {
  const size = Math.max(1, Math.round(routeSize || 1));
  const base = Math.max(size, Math.floor(Math.max(0, n) / size) * size);
  return Array.from(new Set([base, base + size, base + size * 2]));
}

function routeMultipleStatus(
  config: HojasRutaIntegratedConfig | null,
  territories: HojasRutaState["territories"],
): RouteMultipleStatus {
  const routeSize = Math.max(1, Math.round(config?.entrevistas_por_manzana || 1));
  const n = config?.sample_size_mode === "external_district"
    ? Object.values(config.n_por_distrito ?? {}).reduce((sum, value) => sum + Number(value || 0), 0)
    : Number(config?.n_objetivo ?? 0);
  const previous = Math.max(routeSize, Math.floor(Math.max(0, n) / routeSize) * routeSize);
  const next = Math.max(routeSize, Math.ceil(Math.max(1, n) / routeSize) * routeSize);
  if (!config) {
    return { ok: false, routeSize, message: "Define la muestra.", invalidDistricts: [], previous, next };
  }
  if (config.sample_size_mode === "external_district") {
    const byUbigeo = new Map(territories.map((t) => [t.ubigeo, t.distrito]));
    const invalidDistricts = (config.territorios ?? [])
      .map((ubigeo) => ({
        ubigeo,
        distrito: byUbigeo.get(ubigeo) ?? ubigeo,
        n: Math.round(Number(config.n_por_distrito?.[ubigeo] ?? 0)),
      }))
      .filter((row) => row.n > 0 && row.n % routeSize !== 0);
    if (invalidDistricts.length) {
      const first = invalidDistricts[0];
      return {
        ok: false,
        routeSize,
        invalidDistricts,
        previous,
        next,
        message: `${first.distrito}: con ${routeSize} encuestas por ruta usa valores como ${routeExamples(first.n, routeSize).map(formatNumber).join(", ")}.`,
      };
    }
    return { ok: true, routeSize, message: `${formatNumber(n)} encuestas en rutas de ${routeSize}.`, invalidDistricts, previous, next };
  }
  if (n <= 0 || n % routeSize !== 0) {
    return {
      ok: false,
      routeSize,
      invalidDistricts: [],
      previous,
      next,
      message: `Con ${routeSize} encuestas por ruta, el N debe ser multiplo de ${routeSize}. Ejemplos: ${routeExamples(n, routeSize).map(formatNumber).join(", ")}.`,
    };
  }
  return { ok: true, routeSize, message: `${formatNumber(n)} encuestas en rutas de ${routeSize}.`, invalidDistricts: [], previous, next };
}

const AGE_RANGE_MODE_LABELS: Record<HojasRutaAgeRangeMode, string> = {
  manual: "Manual",
  terciles: "Terciles poblacionales",
  cuartiles: "Cuartiles poblacionales",
  quintiles: "Quintiles poblacionales",
};

const ALLOCATION_LABELS: Record<AllocationMode, { title: string; hint: string }> = {
  proportional: {
    title: "Por tamaño",
    hint: "Distritos grandes reciben más encuestas. Es lo estándar para representar al total.",
  },
  uniform: {
    title: "Igualitaria",
    hint: "Mismo N en cada distrito. Úsalo cuando quieres comparar distritos entre sí.",
  },
  compromise: {
    title: "Intermedia",
    hint: "Punto medio: protege a distritos chicos sin abandonar a los grandes.",
  },
};

function percentInput(value: number | null | undefined) {
  return Number(((Number(value ?? 0) || 0) * 100).toFixed(2));
}

function allocateInteger(weights: number[], n: number) {
  const total = weights.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  if (n <= 0 || total <= 0 || weights.length === 0) return weights.map(() => 0);
  const raw = weights.map((value) => (n * Math.max(0, Number(value) || 0)) / total);
  const out = raw.map(Math.floor);
  let rem = n - out.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value), weight: weights[index] ?? 0 }))
    .sort((a, b) => (b.frac - a.frac) || (b.weight - a.weight));
  for (const item of order) {
    if (rem <= 0) break;
    out[item.index] += 1;
    rem -= 1;
  }
  return out;
}

function methodLabel(method: SamplingMethod) {
  if (method === "pps") return "PPS estratificado";
  if (method === "sistematico") return "Sistematico";
  return "Conglomerado fijo";
}

function cartographyModeLabel(mode: string | undefined) {
  if (mode === "local_first_optional_online_cache") return "Local primero";
  if (mode === "on_demand_cache") return "Bajo demanda";
  return "Pendiente";
}

function alertKind(level: HojasRutaAlert["level"]): "info" | "warn" | "error" {
  if (level === "error") return "error";
  if (level === "warn") return "warn";
  return "info";
}

function StatusPill({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "3px 8px",
        fontSize: 11,
        fontWeight: 700,
        background: ok ? "var(--pulso-success-bg)" : "var(--pulso-warn-bg)",
        border: `1px solid ${ok ? "var(--pulso-success-border)" : "var(--pulso-warn-border)"}`,
        color: ok ? "var(--pulso-success-fg)" : "var(--pulso-warn-fg)",
      }}
    >
      {text}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--pulso-text)" }}>{label}</span>
      {children}
    </label>
  );
}

function SampleControl({
  label,
  hint,
  suffix,
  children,
}: {
  label: string;
  hint: string;
  suffix?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="hojas-ruta-sample-control">
      <span>{label}</span>
      <div className="hojas-ruta-sample-input-row">
        {children}
        {suffix ? <em>{suffix}</em> : null}
      </div>
      <small>{hint}</small>
    </label>
  );
}

function SampleAdviceItem({
  tone = "ok",
  label,
  value,
  children,
}: {
  tone?: "ok" | "warn" | "info";
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`hojas-ruta-sample-advice-item is-${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <p>{children}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="hojas-ruta-mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReadinessItem({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <div className={`hojas-ruta-readiness-item ${ok ? "is-ok" : ""}`}>
      <CheckCircle2 size={15} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function numberValue(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : "";
}

function geometryPolygons(geometry: DistrictGeometry): GeoPolygon[] {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

function mapBounds(features: DistrictFeature[]) {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const feature of features) {
    for (const polygon of geometryPolygons(feature.geometry)) {
      for (const ring of polygon) {
        for (const [lon, lat] of ring) {
          minLon = Math.min(minLon, lon);
          minLat = Math.min(minLat, lat);
          maxLon = Math.max(maxLon, lon);
          maxLat = Math.max(maxLat, lat);
        }
      }
    }
  }
  return { minLon, minLat, maxLon, maxLat };
}

function districtShortName(name: string) {
  if (name.includes("SAN JUAN DE LURIGANCHO")) return "SJL";
  if (name.includes("SAN MARTIN DE PORRES")) return "SMP";
  if (name.includes("SANTIAGO DE SURCO")) return "SURCO";
  if (name.includes("VILLA MARIA DEL TRIUNFO")) return "VMT";
  if (name.includes("VILLA EL SALVADOR")) return "VES";
  if (name.includes("CARMEN DE LA LEGUA")) return "CARMEN";
  if (name.includes("PUEBLO LIBRE")) return "P. LIBRE";
  if (name.includes("MAGDALENA DEL MAR")) return "MAGD.";
  if (name.includes("SAN ISIDRO")) return "S. ISIDRO";
  if (name.includes("SAN BORJA")) return "S. BORJA";
  if (name.includes("SAN LUIS")) return "S. LUIS";
  if (name.includes("SANTA ANITA")) return "S. ANITA";
  if (name.includes("LA VICTORIA")) return "L. VICTORIA";
  if (name.includes("BELLAVISTA")) return "BELLAV.";
  if (name.includes("VENTANILLA")) return "VENT.";
  if (name.includes("MIRAFLORES")) return "MIRAF.";
  return name;
}

function districtNameForUbigeo(ubigeo: string) {
  return DISTRICT_FEATURE_BY_UBIGEO.get(ubigeo)?.properties.distrito ?? ubigeo;
}

function clampPanForZoom(pan: MapPan, zoom: number, width: number, height: number) {
  if (zoom <= 1.01) return { x: 0, y: 0 };
  const maxX = (width * (zoom - 1)) / 2 + 80;
  const maxY = (height * (zoom - 1)) / 2 + 80;
  return { x: clamp(pan.x, -maxX, maxX), y: clamp(pan.y, -maxY, maxY) };
}

function mapTransform(width: number, height: number, zoom: number, pan: MapPan) {
  return `translate(${width / 2 + pan.x} ${height / 2 + pan.y}) scale(${zoom}) translate(${-width / 2} ${-height / 2})`;
}

function useMapNavigation(width: number, height: number, minZoom: number, maxZoom: number, initialZoom = minZoom) {
  const startZoom = clamp(initialZoom, minZoom, maxZoom);
  const [zoom, setZoomState] = useState(startZoom);
  const [pan, setPanState] = useState<MapPan>({ x: 0, y: 0 });
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; startPan: MapPan; moved: boolean } | null>(null);
  const suppressClickUntilRef = useRef(0);
  const wheelHostRef = useRef<HTMLElement | null>(null);

  const setZoom = useCallback((nextZoom: number) => {
    const zoomed = clamp(nextZoom, minZoom, maxZoom);
    setPanState((current) => clampPanForZoom(current, zoomed, width, height));
    setZoomState(zoomed);
  }, [height, maxZoom, minZoom, width]);

  const reset = useCallback(() => {
    setZoomState(startZoom);
    setPanState(clampPanForZoom({ x: 0, y: 0 }, startZoom, width, height));
  }, [height, startZoom, width]);

  const zoomAt = useCallback((nextZoom: number, x: number, y: number) => {
    setZoomState((prevZoom) => {
      const zoomed = clamp(nextZoom, minZoom, maxZoom);
      setPanState((currentPan) => {
        const baseX = width / 2 + (x - width / 2 - currentPan.x) / prevZoom;
        const baseY = height / 2 + (y - height / 2 - currentPan.y) / prevZoom;
        const nextPan = {
          x: x - width / 2 - zoomed * (baseX - width / 2),
          y: y - height / 2 - zoomed * (baseY - height / 2),
        };
        return clampPanForZoom(nextPan, zoomed, width, height);
      });
      return zoomed;
    });
  }, [height, maxZoom, minZoom, width]);

  const handleWheel = useCallback((event: WheelEvent, target: HTMLElement) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = target.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * width;
    const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * height;
    const looksLikeTrackpadPan = !event.ctrlKey && zoom > 1 && (Math.abs(event.deltaX) > 0 || Math.abs(event.deltaY) < 45);
    if (looksLikeTrackpadPan) {
      setPanState((current) => clampPanForZoom({
        x: current.x - event.deltaX * (width / Math.max(1, rect.width)),
        y: current.y - event.deltaY * (height / Math.max(1, rect.height)),
      }, zoom, width, height));
      return;
    }
    const intensity = event.ctrlKey ? 0.011 : 0.0048;
    const factor = Math.exp(-event.deltaY * intensity);
    zoomAt(zoom * factor, x, y);
  }, [height, width, zoom, zoomAt]);

  useEffect(() => {
    const node = wheelHostRef.current;
    if (!node) return undefined;
    const listener = (event: WheelEvent) => handleWheel(event, node);
    node.addEventListener("wheel", listener, { passive: false });
    return () => node.removeEventListener("wheel", listener);
  }, [handleWheel]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPan: pan,
      moved: false,
    };
  }, [pan]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = (event.clientX - drag.startX) * (width / Math.max(1, rect.width));
    const dy = (event.clientY - drag.startY) * (height / Math.max(1, rect.height));
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    setPanState(clampPanForZoom({ x: drag.startPan.x + dx, y: drag.startPan.y + dy }, zoom, width, height));
  }, [height, width, zoom]);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (drag?.moved) suppressClickUntilRef.current = Date.now() + 160;
    if (drag?.pointerId === event.pointerId) dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return {
    zoom,
    pan,
    setZoom,
    reset,
    wheelHostRef,
    transform: mapTransform(width, height, zoom, pan),
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
    suppressClick: () => Date.now() < suppressClickUntilRef.current,
  };
}

function buildProjectedDistricts() {
  const bounds = mapBounds(DISTRICT_FEATURES);
  const lonRange = Math.max(0.000001, bounds.maxLon - bounds.minLon);
  const latRange = Math.max(0.000001, bounds.maxLat - bounds.minLat);
  const scale = Math.min((MAP_SIZE - MAP_PADDING * 2) / lonRange, (MAP_SIZE - MAP_PADDING * 2) / latRange);
  const mapW = lonRange * scale;
  const mapH = latRange * scale;
  const offsetX = (MAP_SIZE - mapW) / 2;
  const offsetY = (MAP_SIZE - mapH) / 2;
  const project = ([lon, lat]: GeoPosition) => {
    const x = offsetX + (lon - bounds.minLon) * scale;
    const y = MAP_SIZE - offsetY - (lat - bounds.minLat) * scale;
    return [x, y] as const;
  };
  const ringPath = (ring: GeoRing) => {
    if (!ring.length) return "";
    const [first, ...rest] = ring;
    const [x0, y0] = project(first);
    const tail = rest.map((point) => {
      const [x, y] = project(point);
      return `L${x.toFixed(2)} ${y.toFixed(2)}`;
    });
    return [`M${x0.toFixed(2)} ${y0.toFixed(2)}`, ...tail, "Z"].join(" ");
  };
  return DISTRICT_FEATURES.map((feature) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const polygon of geometryPolygons(feature.geometry)) {
      for (const ring of polygon) {
        for (const point of ring) {
          const [x, y] = project(point);
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    const d = geometryPolygons(feature.geometry)
      .map((polygon) => polygon.map(ringPath).join(" "))
      .join(" ");
    const [labelX, labelY] = project([feature.properties.label_lon, feature.properties.label_lat]);
    return {
      ubigeo: feature.properties.ubigeo,
      distrito: feature.properties.distrito,
      d,
      labelX,
      labelY,
      minX,
      minY,
      maxX,
      maxY,
    };
  });
}

function compactDistrictViewBox(district: ReturnType<typeof buildProjectedDistricts>[number] | undefined) {
  if (!district) return `0 0 ${MAP_SIZE} ${MAP_SIZE}`;
  const aspect = 220 / 164;
  let width = Math.max(48, district.maxX - district.minX);
  let height = Math.max(48, district.maxY - district.minY);
  const margin = Math.max(width, height) * 0.18;
  width += margin * 2;
  height += margin * 2;
  if (width / height < aspect) width = height * aspect;
  else height = width / aspect;
  width = clamp(width, 150, MAP_SIZE);
  height = clamp(height, 112, MAP_SIZE);
  if (width / height < aspect) width = Math.min(MAP_SIZE, height * aspect);
  else height = Math.min(MAP_SIZE, width / aspect);
  const centerX = (district.minX + district.maxX) / 2;
  const centerY = (district.minY + district.maxY) / 2;
  const x = clamp(centerX - width / 2, 0, MAP_SIZE - width);
  const y = clamp(centerY - height / 2, 0, MAP_SIZE - height);
  return `${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}`;
}

function projectDistrictIcon(ubigeo: string) {
  const feature = DISTRICT_FEATURES.find((item) => item.properties.ubigeo === ubigeo);
  if (!feature) return "";
  const size = 48;
  const padding = 5;
  const bounds = mapBounds([feature]);
  const lonRange = Math.max(0.000001, bounds.maxLon - bounds.minLon);
  const latRange = Math.max(0.000001, bounds.maxLat - bounds.minLat);
  const scale = Math.min((size - padding * 2) / lonRange, (size - padding * 2) / latRange);
  const mapW = lonRange * scale;
  const mapH = latRange * scale;
  const offsetX = (size - mapW) / 2;
  const offsetY = (size - mapH) / 2;
  const project = ([lon, lat]: GeoPosition) => {
    const x = offsetX + (lon - bounds.minLon) * scale;
    const y = size - offsetY - (lat - bounds.minLat) * scale;
    return [x, y] as const;
  };
  const ringPath = (ring: GeoRing) => {
    if (!ring.length) return "";
    const [first, ...rest] = ring;
    const [x0, y0] = project(first);
    return [
      `M${x0.toFixed(2)} ${y0.toFixed(2)}`,
      ...rest.map((point) => {
        const [x, y] = project(point);
        return `L${x.toFixed(2)} ${y.toFixed(2)}`;
      }),
      "Z",
    ].join(" ");
  };
  return geometryPolygons(feature.geometry)
    .map((polygon) => polygon.map(ringPath).join(" "))
    .join(" ");
}

function blockGeometryPolygons(feature: HojasRutaBlockMapFeature): GeoPolygon[] {
  if (!feature.geometry) return [];
  if (feature.geometry.type === "Polygon") return [feature.geometry.coordinates as GeoPolygon];
  return feature.geometry.coordinates as GeoPolygon[];
}

function blockFeatureId(feature: HojasRutaBlockMapFeature) {
  const props = feature.properties ?? {};
  return String(props.inei_id_manzana ?? props.ID_MANZANA ?? props.cartografia_id ?? feature.id ?? "");
}

function blockFeatureZone(feature: HojasRutaBlockMapFeature) {
  const props = feature.properties ?? {};
  const id = blockFeatureId(feature);
  return String(props.inei_zona ?? (id.length >= 11 ? id.slice(6, 11) : "")).trim();
}

function zoneGeometryPolygons(feature: HojasRutaZoneMapFeature): GeoPolygon[] {
  if (!feature.geometry) return [];
  if (feature.geometry.type === "Polygon") return [feature.geometry.coordinates as GeoPolygon];
  return feature.geometry.coordinates as GeoPolygon[];
}

function buildZoneProjection(features: HojasRutaZoneMapFeature[]) {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const feature of features) {
    for (const polygon of zoneGeometryPolygons(feature)) {
      for (const ring of polygon) {
        for (const [lon, lat] of ring) {
          minLon = Math.min(minLon, lon);
          minLat = Math.min(minLat, lat);
          maxLon = Math.max(maxLon, lon);
          maxLat = Math.max(maxLat, lat);
        }
      }
    }
  }
  if (!Number.isFinite(minLon)) return null;
  const rawLonRange = Math.max(0.000001, maxLon - minLon);
  const rawLatRange = Math.max(0.000001, maxLat - minLat);
  minLon -= rawLonRange * 0.1;
  maxLon += rawLonRange * 0.1;
  minLat -= rawLatRange * 0.1;
  maxLat += rawLatRange * 0.1;
  const lonRange = Math.max(0.000001, maxLon - minLon);
  const latRange = Math.max(0.000001, maxLat - minLat);
  const scale = Math.min((BLOCK_MAP_WIDTH - BLOCK_MAP_PADDING * 2) / lonRange, (BLOCK_MAP_HEIGHT - BLOCK_MAP_PADDING * 2) / latRange);
  const mapW = lonRange * scale;
  const mapH = latRange * scale;
  const offsetX = (BLOCK_MAP_WIDTH - mapW) / 2;
  const offsetY = (BLOCK_MAP_HEIGHT - mapH) / 2;
  const project = ([lon, lat]: GeoPosition) => {
    const x = offsetX + (lon - minLon) * scale;
    const y = BLOCK_MAP_HEIGHT - offsetY - (lat - minLat) * scale;
    return [x, y] as const;
  };
  return { project };
}

function buildProjectedZoneFeatures(features: HojasRutaZoneMapFeature[], projection = buildZoneProjection(features)) {
  if (!projection) return [];
  return features.map((feature, index) => {
    const props = feature.properties ?? {};
    const zona = String(props.zona ?? feature.id ?? "");
    const id = String(props.id ?? `${props.ubigeo ?? ""}-${zona}`);
    const rings = zoneGeometryPolygons(feature)
      .flatMap((polygon) => polygon.map((ring) => ring.map((point) => projection.project(point) as GeoPosition)));
    const xs = rings.flatMap((ring) => ring.map((point) => point[0]));
    const ys = rings.flatMap((ring) => ring.map((point) => point[1]));
    if (!rings.length || !xs.length || !ys.length) return null;
    const d = rings.map((ring) => {
      const [first, ...rest] = ring;
      return [
        `M${first[0].toFixed(2)} ${first[1].toFixed(2)}`,
        ...rest.map(([x, y]) => `L${x.toFixed(2)} ${y.toFixed(2)}`),
        "Z",
      ].join(" ");
    }).join(" ");
    return {
      key: `${id}:${index}`,
      id,
      zona,
      label: String(props.zona_label ?? `Zona ${zona}`),
      nManzanas: Number(props.n_manzanas ?? 0),
      viviendas: Number(props.viviendas ?? 0),
      poblacion: Number(props.poblacion ?? 0),
      rings,
      bbox: {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
      },
      labelX: (Math.min(...xs) + Math.max(...xs)) / 2,
      labelY: (Math.min(...ys) + Math.max(...ys)) / 2,
      d,
    };
  }).filter((feature): feature is NonNullable<typeof feature> => Boolean(feature?.d));
}

function buildBlockProjection(features: HojasRutaBlockMapFeature[]) {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const feature of features) {
    for (const polygon of blockGeometryPolygons(feature)) {
      for (const ring of polygon) {
        for (const [lon, lat] of ring) {
          minLon = Math.min(minLon, lon);
          minLat = Math.min(minLat, lat);
          maxLon = Math.max(maxLon, lon);
          maxLat = Math.max(maxLat, lat);
        }
      }
    }
  }
  if (!Number.isFinite(minLon)) return null;
  const rawLonRange = Math.max(0.000001, maxLon - minLon);
  const rawLatRange = Math.max(0.000001, maxLat - minLat);
  minLon -= rawLonRange * 0.12;
  maxLon += rawLonRange * 0.12;
  minLat -= rawLatRange * 0.12;
  maxLat += rawLatRange * 0.12;
  const lonRange = Math.max(0.000001, maxLon - minLon);
  const latRange = Math.max(0.000001, maxLat - minLat);
  const scale = Math.min((BLOCK_MAP_WIDTH - BLOCK_MAP_PADDING * 2) / lonRange, (BLOCK_MAP_HEIGHT - BLOCK_MAP_PADDING * 2) / latRange);
  const mapW = lonRange * scale;
  const mapH = latRange * scale;
  const offsetX = (BLOCK_MAP_WIDTH - mapW) / 2;
  const offsetY = (BLOCK_MAP_HEIGHT - mapH) / 2;
  const project = ([lon, lat]: GeoPosition) => {
    const x = offsetX + (lon - minLon) * scale;
    const y = BLOCK_MAP_HEIGHT - offsetY - (lat - minLat) * scale;
    return [x, y] as const;
  };
  return { project };
}

type GeoBBox = {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
};

function blockFeatureGeoBBox(feature: HojasRutaBlockMapFeature): GeoBBox | null {
  const coords = blockGeometryPolygons(feature).flat(2);
  if (!coords.length) return null;
  const lons = coords.map(([lon]) => lon);
  const lats = coords.map(([, lat]) => lat);
  return {
    minLon: Math.min(...lons),
    minLat: Math.min(...lats),
    maxLon: Math.max(...lons),
    maxLat: Math.max(...lats),
  };
}

function blockFeaturesGeoBBox(features: HojasRutaBlockMapFeature[]): GeoBBox | null {
  const boxes = features.map(blockFeatureGeoBBox).filter((box): box is GeoBBox => Boolean(box));
  if (!boxes.length) return null;
  return {
    minLon: Math.min(...boxes.map((box) => box.minLon)),
    minLat: Math.min(...boxes.map((box) => box.minLat)),
    maxLon: Math.max(...boxes.map((box) => box.maxLon)),
    maxLat: Math.max(...boxes.map((box) => box.maxLat)),
  };
}

function expandGeoBBox(box: GeoBBox, pad = 0.32): GeoBBox {
  const lonSpan = Math.max(0.000001, box.maxLon - box.minLon);
  const latSpan = Math.max(0.000001, box.maxLat - box.minLat);
  return {
    minLon: box.minLon - lonSpan * pad,
    maxLon: box.maxLon + lonSpan * pad,
    minLat: box.minLat - latSpan * pad,
    maxLat: box.maxLat + latSpan * pad,
  };
}

function geoBBoxIntersects(a: GeoBBox | null, b: GeoBBox | null) {
  if (!a || !b) return false;
  return !(a.maxLon < b.minLon || a.minLon > b.maxLon || a.maxLat < b.minLat || a.minLat > b.maxLat);
}

function blockFocusFeaturesWithNeighbors(features: HojasRutaBlockMapFeature[], activeZone?: string) {
  if (!activeZone) return features;
  const focused = features.filter((feature) => blockFeatureZone(feature) === activeZone);
  if (!focused.length) return features;
  const focusBox = blockFeaturesGeoBBox(focused);
  if (!focusBox) return focused;
  const neighborBox = expandGeoBBox(focusBox, 0.38);
  const withNeighbors = features.filter((feature) => {
    if (blockFeatureZone(feature) === activeZone) return true;
    return geoBBoxIntersects(blockFeatureGeoBBox(feature), neighborBox);
  });
  return withNeighbors.length ? withNeighbors : focused;
}

function buildProjectedBlockFeatures(features: HojasRutaBlockMapFeature[], projection = buildBlockProjection(features)) {
  if (!projection) return [];
  return features.map((feature, index) => {
    const id = blockFeatureId(feature);
    const rings = blockGeometryPolygons(feature)
      .flatMap((polygon) => polygon.map((ring) => ring.map((point) => projection.project(point) as GeoPosition)));
    const xs = rings.flatMap((ring) => ring.map((point) => point[0]));
    const ys = rings.flatMap((ring) => ring.map((point) => point[1]));
    const projectedRingPath = (ring: GeoRing) => {
      if (!ring.length) return "";
      const [first, ...rest] = ring;
      return [
        `M${first[0].toFixed(2)} ${first[1].toFixed(2)}`,
        ...rest.map(([x, y]) => `L${x.toFixed(2)} ${y.toFixed(2)}`),
        "Z",
      ].join(" ");
    };
    const props = feature.properties;
    return {
      key: `${id}:${props.OBJECTID ?? index}`,
      id,
      label: props.manzana_label ?? String(props.ID_MANZANA ?? feature.id ?? ""),
      source: props.FTE_MZNA ?? "",
      area: props.AREA_M2 ?? null,
      zona: blockFeatureZone(feature) || null,
      manzanaCode: props.inei_manzana ?? null,
      viviendas: props.inei_viviendas ?? null,
      poblacion: props.inei_poblacion ?? null,
      hombres: props.inei_pob_hombres ?? null,
      mujeres: props.inei_pob_mujeres ?? null,
      pob18plus: props.inei_pob_18_plus ?? null,
      rings,
      bbox: {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
      },
      d: rings.map(projectedRingPath).join(" "),
    };
  }).filter((feature) => feature.d);
}

function streetGeometryLines(feature: HojasRutaStreetMapFeature): GeoRing[] {
  if (!feature.geometry) return [];
  if (feature.geometry.type === "LineString") return [feature.geometry.coordinates as GeoRing];
  return feature.geometry.coordinates as GeoRing[];
}

function projectedStreetPath(line: GeoRing) {
  if (!line.length) return "";
  const [first, ...rest] = line;
  return [
    `M${first[0].toFixed(2)} ${first[1].toFixed(2)}`,
    ...rest.map(([x, y]) => `L${x.toFixed(2)} ${y.toFixed(2)}`),
  ].join(" ");
}

function contextGeometryPolygons(feature: HojasRutaContextMapFeature): GeoPolygon[] {
  const geometry = feature.geometry;
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates as GeoPolygon];
  if (geometry.type === "MultiPolygon") return geometry.coordinates as GeoMultiPolygon;
  return [];
}

function contextGeometryLines(feature: HojasRutaContextMapFeature): GeoRing[] {
  const geometry = feature.geometry;
  if (!geometry) return [];
  if (geometry.type === "LineString") return [geometry.coordinates as GeoRing];
  if (geometry.type === "MultiLineString") return geometry.coordinates as GeoRing[];
  return [];
}

function contextGeometryPoints(feature: HojasRutaContextMapFeature): GeoPosition[] {
  const geometry = feature.geometry;
  if (!geometry) return [];
  if (geometry.type === "Point") return [geometry.coordinates as GeoPosition];
  if (geometry.type === "MultiPoint") return geometry.coordinates as GeoPosition[];
  return [];
}

function contextClassStyle(featureClass: string, kind = "", sourceKind = "osm") {
  if (featureClass === "water") return { fill: "rgba(176,216,238,0.78)", stroke: "rgba(55,125,162,0.62)", label: "#24627f" };
  if (featureClass === "coast" || featureClass === "waterway") return { fill: "none", stroke: "rgba(55,125,162,0.76)", label: "#24627f" };
  if (featureClass === "rail") return { fill: "none", stroke: "rgba(88,70,128,0.82)", label: "#4c3b73" };
  if (featureClass === "green") {
    if (sourceKind === "curated" || kind === "park" || kind === "garden") {
      return { fill: "rgba(173,216,125,0.36)", stroke: "rgba(54,112,40,0.62)", label: "#163f1e" };
    }
    return { fill: "rgba(166,214,156,0.24)", stroke: "rgba(45,126,73,0.34)", label: "#27633a" };
  }
  if (featureClass === "square") return { fill: "rgba(232,222,202,0.34)", stroke: "rgba(154,132,91,0.34)", label: "#6f5f3e" };
  if (featureClass === "transit") return { fill: "rgba(232,222,255,0.92)", stroke: "rgba(91,74,150,0.72)", label: "#4c3b73" };
  if (featureClass === "public") return { fill: "rgba(229,236,245,0.58)", stroke: "rgba(59,82,112,0.38)", label: "#334155" };
  if (featureClass === "commerce") return { fill: "rgba(248,250,252,0.5)", stroke: "rgba(148,163,184,0.34)", label: "#64748b" };
  return { fill: "rgba(241,245,249,0.72)", stroke: "rgba(100,116,139,0.4)", label: "#475569" };
}

function contextIsSurface(featureClass: string) {
  return featureClass === "green" || featureClass === "water" || featureClass === "square";
}

function contextIsLinearPriority(featureClass: string) {
  return featureClass === "coast" || featureClass === "waterway";
}

function contextIsLowPriority(featureClass: string) {
  return featureClass === "commerce" || featureClass === "landmark";
}

function contextIsCuratedPark(feature: ReturnType<typeof buildProjectedContextFeatures>[number]) {
  return feature.featureClass === "green" && (feature.sourceKind === "curated" || feature.kind === "park" || feature.kind === "garden");
}

function contextIsPublicKeyPoint(feature: ReturnType<typeof buildProjectedContextFeatures>[number]) {
  const publicKinds = new Set(["police", "hospital", "clinic", "fire_station", "townhall", "courthouse", "library"]);
  if (feature.featureClass === "public" && publicKinds.has(feature.kind)) return true;
  if (feature.kind === "marketplace" && (feature.featureClass === "public" || feature.featureClass === "landmark")) return true;
  return false;
}

function contextLineWidth(featureClass: string, rank: number) {
  if (featureClass === "coast") return 2.5;
  if (featureClass === "waterway") return rank <= 2 ? 2 : 1.25;
  return 0.8;
}

function contextOverlayStrokeWidth(featureClass: string) {
  if (featureClass === "green" || featureClass === "water") return 1.25;
  if (featureClass === "square") return 0.95;
  return 0.85;
}

function shouldShowContextPoint(
  feature: ReturnType<typeof buildProjectedContextFeatures>[number],
  zoom: number,
) {
  if (!feature.hasPoints) return false;
  if (contextIsCuratedPark(feature)) return zoom >= 0.9;
  if (contextIsPublicKeyPoint(feature)) return zoom >= 2.1;
  return false;
}

function contextMarkerLabel(featureClass: string, kind: string) {
  return "";
}

function contextMarkerRadius(
  feature: ReturnType<typeof buildProjectedContextFeatures>[number],
  zoom: number,
) {
  if (contextIsCuratedPark(feature)) return 7.5 / Math.pow(Math.max(1, zoom), 0.24);
  if (contextIsPublicKeyPoint(feature)) return 4.4 / Math.pow(Math.max(1, zoom), 0.3);
  if (feature.featureClass === "green") return 5 / Math.pow(Math.max(1, zoom), 0.28);
  return 3.2 / Math.pow(Math.max(1, zoom), 0.3);
}

function contextLabelSize(
  feature: ReturnType<typeof buildProjectedContextFeatures>[number],
  zoom: number,
) {
  const base = contextIsCuratedPark(feature) ? 10.8
    : feature.featureClass === "green" || feature.featureClass === "water" ? 9.8
      : contextIsPublicKeyPoint(feature) ? 8.8
        : 8;
  return base / Math.pow(Math.max(1, zoom), 0.44);
}

function projectedContextPath(ring: GeoRing, closed = false) {
  if (!ring.length) return "";
  const [first, ...rest] = ring;
  return [
    `M${first[0].toFixed(2)} ${first[1].toFixed(2)}`,
    ...rest.map(([x, y]) => `L${x.toFixed(2)} ${y.toFixed(2)}`),
    closed ? "Z" : "",
  ].filter(Boolean).join(" ");
}

function buildProjectedContextFeatures(
  features: HojasRutaContextMapFeature[],
  projection: ReturnType<typeof buildBlockProjection>,
) {
  if (!projection) return [];
  return features.map((feature, index) => {
    const props = feature.properties ?? {};
    const featureClass = String(props.feature_class ?? "context");
    const rank = Number(props.rank ?? 9);
    const name = String(props.display_name ?? props.name ?? "").trim();
    const polygons = contextGeometryPolygons(feature)
      .flatMap((polygon) => polygon.map((ring) => ring.map((point) => projection.project(point) as GeoPosition)));
    const lines = contextGeometryLines(feature)
      .map((line) => line.map((point) => projection.project(point) as GeoPosition))
      .filter((line) => line.length > 1);
    const points = contextGeometryPoints(feature)
      .map((point) => projection.project(point) as GeoPosition);
    if (!polygons.length && !lines.length && !points.length) return null;
    const allPoints = [...polygons.flat(), ...lines.flat(), ...points];
    const xs = allPoints.map(([x]) => x);
    const ys = allPoints.map(([, y]) => y);
    const d = [
      ...polygons.map((ring) => projectedContextPath(ring, true)),
      ...lines.map((line) => projectedContextPath(line, false)),
    ].filter(Boolean).join(" ");
    return {
      key: String(props.osm_id ?? feature.id ?? `context:${index}`),
      id: String(props.osm_id ?? feature.id ?? `context:${index}`),
      featureClass,
      kind: String(props.kind ?? ""),
      sourceKind: String(props.source_kind ?? "osm"),
      rank,
      name,
      d,
      points,
      hasPolygons: polygons.length > 0,
      hasLines: lines.length > 0,
      hasPoints: points.length > 0,
      labelX: (Math.min(...xs) + Math.max(...xs)) / 2,
      labelY: (Math.min(...ys) + Math.max(...ys)) / 2,
      length: lines.reduce((sum, line) => sum + lineLength(line), 0),
      area: Number(props.area_m2 ?? 0),
    };
  }).filter((feature): feature is NonNullable<typeof feature> => Boolean(feature));
}

function shouldLabelContext(
  feature: ReturnType<typeof buildProjectedContextFeatures>[number],
  zoom: number,
) {
  if (!feature.name || feature.name === feature.kind) return false;
  if (contextIsCuratedPark(feature)) return zoom >= 1.05;
  if (feature.featureClass === "green" || feature.featureClass === "square") return false;
  if (feature.featureClass === "water") return zoom >= 0.95 && (feature.area > 900 || feature.rank <= 2);
  if (contextIsPublicKeyPoint(feature)) return zoom >= 2.8;
  return false;
}

function lineLength(line: GeoRing) {
  let length = 0;
  for (let i = 1; i < line.length; i += 1) {
    length += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
  }
  return length;
}

function normalizeTextAngle(angle: number) {
  let next = angle;
  while (next > 90) next -= 180;
  while (next < -90) next += 180;
  return next;
}

function linePointAtDistance(line: GeoRing, targetDistance: number) {
  if (!line.length) return { x: 0, y: 0, angle: 0 };
  const total = lineLength(line);
  if (total <= 0) {
    const [x, y] = line[Math.floor(line.length / 2)];
    return { x, y, angle: 0 };
  }
  const target = clamp(Number.isFinite(targetDistance) ? targetDistance : total / 2, 0, total);
  let walked = 0;
  for (let i = 1; i < line.length; i += 1) {
    const segment = Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
    if (walked + segment >= target) {
      const ratio = (target - walked) / Math.max(1e-9, segment);
      const x = line[i - 1][0] + (line[i][0] - line[i - 1][0]) * ratio;
      const y = line[i - 1][1] + (line[i][1] - line[i - 1][1]) * ratio;
      const angle = normalizeTextAngle(Math.atan2(line[i][1] - line[i - 1][1], line[i][0] - line[i - 1][0]) * 180 / Math.PI);
      return { x, y, angle };
    }
    walked += segment;
  }
  const [x, y] = line[Math.floor(line.length / 2)];
  return { x, y, angle: 0 };
}

function lineLabelAnchors(line: GeoRing, spacing: number, maxLabels: number) {
  const total = lineLength(line);
  if (total < 54) return [];
  const count = clamp(Math.floor(total / spacing), 1, maxLabels);
  return Array.from({ length: count }, (_, index) => {
    const ratio = (index + 1) / (count + 1);
    return linePointAtDistance(line, total * ratio);
  });
}

function buildProjectedStreetFeatures(
  features: HojasRutaStreetMapFeature[],
  projection: ReturnType<typeof buildBlockProjection>,
) {
  if (!projection) return [];
  return features.map((feature, index) => {
    const lines = streetGeometryLines(feature)
      .map((line) => line.map((point) => projection.project(point) as GeoPosition))
      .filter((line) => line.length > 1);
    if (!lines.length) return null;
    const longestLine = [...lines].sort((a, b) => lineLength(b) - lineLength(a))[0];
    const props = feature.properties ?? {};
    const name = String(props.display_name ?? props.name ?? "").trim();
    const rawRank = Number(props.rank ?? 9);
    const highway = String(props.highway ?? "");
    const avenueLike = Boolean(props.avenue_like) || /(^|\b)(av\.?|avenida|via expresa|circuito)(\b|\s)/i.test(name);
    const rawClassGroup = String(props.class_group ?? "detail");
    const highwayPrincipal = /^(motorway|trunk|primary|secondary|tertiary)/i.test(highway);
    const classGroup = highwayPrincipal && rawClassGroup === "detail" ? "avenue" : rawClassGroup;
    const rank = rawRank <= 4 ? rawRank : avenueLike || classGroup === "avenue" || classGroup === "major" || highwayPrincipal ? 5 : 7;
    const labelSpacing = rank <= 3 ? 150 : rank <= 5 ? 140 : 260;
    const maxLabels = rank <= 3 ? 7 : rank <= 5 ? 6 : 2;
    const labelAnchors = lines
      .flatMap((line) => lineLabelAnchors(line, labelSpacing, maxLabels))
      .slice(0, maxLabels);
    const fallbackAnchor = labelAnchors[0] ?? linePointAtDistance(longestLine, lineLength(longestLine) / 2);
    return {
      key: String(props.id ?? feature.id ?? `${props.osm_id ?? "street"}:${index}`),
      id: String(props.id ?? feature.id ?? `${props.osm_id ?? "street"}:${index}`),
      name,
      highway,
      classGroup,
      avenueLike,
      rank,
      d: lines.map(projectedStreetPath).filter(Boolean).join(" "),
      length: lines.reduce((sum, line) => sum + lineLength(line), 0),
      labelX: fallbackAnchor.x,
      labelY: fallbackAnchor.y,
      labelAngle: fallbackAnchor.angle,
      labelAnchors,
    };
  }).filter((feature): feature is NonNullable<typeof feature> => Boolean(feature?.d));
}

function streetCasingWidth(rank: number) {
  if (rank <= 1) return 13.6;
  if (rank <= 2) return 11.8;
  if (rank <= 3) return 9.6;
  if (rank <= 4) return 7.4;
  if (rank <= 5) return 5.5;
  return 3.2;
}

function streetInnerWidth(rank: number) {
  if (rank <= 1) return 9.8;
  if (rank <= 2) return 8.3;
  if (rank <= 3) return 6.7;
  if (rank <= 4) return 4.9;
  if (rank <= 5) return 3.3;
  return 1.85;
}

function streetIsAvenueLike(street: Pick<ReturnType<typeof buildProjectedStreetFeatures>[number], "rank" | "avenueLike" | "classGroup">) {
  return street.rank <= 5 || street.avenueLike || street.classGroup === "avenue" || street.classGroup === "major";
}

function streetCasingColor(street: Pick<ReturnType<typeof buildProjectedStreetFeatures>[number], "rank" | "avenueLike" | "classGroup">, alpha = 1) {
  if (streetIsAvenueLike(street)) return `rgba(25,32,44,${0.64 * alpha})`;
  return `rgba(51,65,85,${0.5 * alpha})`;
}

function streetInnerColor(street: Pick<ReturnType<typeof buildProjectedStreetFeatures>[number], "rank" | "avenueLike" | "classGroup">, alpha = 1) {
  if (street.rank <= 3) return `rgba(255,255,255,${0.98 * alpha})`;
  if (streetIsAvenueLike(street)) return `rgba(255,255,255,${0.96 * alpha})`;
  return `rgba(255,255,249,${0.95 * alpha})`;
}

function streetLineCap(street: Pick<ReturnType<typeof buildProjectedStreetFeatures>[number], "rank" | "avenueLike" | "classGroup">): CanvasLineCap {
  return streetIsAvenueLike(street) ? "butt" : "round";
}

function shouldShowStreet(
  street: ReturnType<typeof buildProjectedStreetFeatures>[number],
  zoom: number,
) {
  if (street.classGroup === "major" || street.rank <= 4) return true;
  if (street.avenueLike || street.classGroup === "avenue") return zoom >= 0.95;
  if (street.name) return zoom >= 1.25;
  return zoom >= 1.8;
}

function shouldLabelStreet(
  street: ReturnType<typeof buildProjectedStreetFeatures>[number],
  zoom: number,
) {
  if (!street.name) return false;
  if (street.rank <= 4) return zoom >= 0.95;
  if (street.avenueLike || street.classGroup === "avenue") return zoom >= 1.05;
  return zoom >= 2.25;
}

function projectedBlockCenter(feature: Pick<ReturnType<typeof buildProjectedBlockFeatures>[number], "bbox"> | null | undefined) {
  if (!feature) return null;
  return {
    x: (feature.bbox.minX + feature.bbox.maxX) / 2,
    y: (feature.bbox.minY + feature.bbox.maxY) / 2,
  };
}

function streetLabelBaseSize(street: Pick<ReturnType<typeof buildProjectedStreetFeatures>[number], "rank" | "avenueLike" | "classGroup">) {
  if (street.rank <= 2) return 20;
  if (street.rank <= 4) return 18;
  if (street.avenueLike || street.classGroup === "avenue") return 16.5;
  return 13.5;
}

function streetLabelRenderSize(
  street: Pick<ReturnType<typeof buildProjectedStreetFeatures>[number], "rank" | "avenueLike" | "classGroup">,
  zoom: number,
) {
  const base = streetLabelBaseSize(street);
  return base / Math.max(1, zoom);
}

function streetLabelWeight(street: Pick<ReturnType<typeof buildProjectedStreetFeatures>[number], "rank" | "avenueLike" | "classGroup">) {
  return street.rank <= 5 || street.avenueLike || street.classGroup === "avenue" ? 850 : 760;
}

function streetLabelFill(street: Pick<ReturnType<typeof buildProjectedStreetFeatures>[number], "rank" | "avenueLike" | "classGroup">) {
  if (street.rank <= 5 || street.avenueLike || street.classGroup === "avenue") return "rgba(17,24,39,0.96)";
  return "rgba(17,24,39,0.82)";
}

function streetLabelHaloWidth(street: Pick<ReturnType<typeof buildProjectedStreetFeatures>[number], "rank" | "avenueLike" | "classGroup">) {
  return street.rank <= 5 || street.avenueLike || street.classGroup === "avenue" ? 3.2 : 2.5;
}

function streetLabelRenderHaloWidth(
  street: Pick<ReturnType<typeof buildProjectedStreetFeatures>[number], "rank" | "avenueLike" | "classGroup">,
  zoom: number,
) {
  return streetLabelHaloWidth(street) / Math.max(1, zoom);
}

function buildStreetLabelCandidates(
  streets: ReturnType<typeof buildProjectedStreetFeatures>,
  zoom: number,
  focusPoint?: { x: number; y: number } | null,
) {
  const focusRadius = focusPoint ? (zoom < 2 ? 210 : zoom < 5 ? 170 / Math.max(1, zoom / 1.8) : 95) : 0;
  const candidates = streets
    .flatMap((street) => {
      const anchors = street.labelAnchors.length
        ? street.labelAnchors
        : [{ x: street.labelX, y: street.labelY, angle: street.labelAngle }];
      return anchors.flatMap((anchor, index) => {
        const focusDistance = focusPoint ? Math.hypot(anchor.x - focusPoint.x, anchor.y - focusPoint.y) : Infinity;
        const nearFocus = Boolean(focusPoint && street.name && focusDistance <= focusRadius);
        if (!shouldLabelStreet(street, zoom) && !nearFocus) return [];
        return [{
          key: `${street.key}:street-label:${index}`,
          name: street.name,
          x: anchor.x,
          y: anchor.y,
          angle: anchor.angle,
          rank: street.rank,
          avenueLike: street.avenueLike,
          classGroup: street.classGroup,
          length: street.length,
          focusDistance,
          nearFocus,
          priority: (nearFocus ? -2 : 0) + street.rank + (street.avenueLike || street.classGroup === "avenue" ? -0.35 : 0) + Math.min(3, focusDistance / Math.max(1, focusRadius || 1)),
          screenWidth: Math.max(34, street.name.length * streetLabelRenderSize(street, zoom) * 0.58 + 12 / Math.max(1, zoom)),
        }];
      });
    })
    .sort((a, b) => (a.priority - b.priority) || (b.length - a.length));

  const accepted: Array<(typeof candidates)[number]> = [];
  const limit = zoom < 2 ? 72 : zoom < 5 ? 96 : 120;
  for (const candidate of candidates) {
    if (candidate.x < -80 || candidate.x > BLOCK_MAP_WIDTH + 80 || candidate.y < -80 || candidate.y > BLOCK_MAP_HEIGHT + 80) continue;
    const collides = accepted.some((other) => {
      const distance = Math.hypot(candidate.x - other.x, candidate.y - other.y);
      const sameName = candidate.name.toLocaleUpperCase("es-PE") === other.name.toLocaleUpperCase("es-PE");
      const nearFocus = candidate.nearFocus || other.nearFocus;
      const labelSpacing = Math.max(candidate.screenWidth, other.screenWidth) * (sameName ? 1.2 : nearFocus ? 0.9 : 1.05);
      const repeatSpacing = sameName
        ? ((candidate.avenueLike || other.avenueLike || candidate.rank <= 5 || other.rank <= 5) ? 118 : 160) / Math.max(1, zoom)
        : 0;
      return distance < Math.max(labelSpacing, repeatSpacing);
    });
    if (collides) continue;
    accepted.push(candidate);
    if (accepted.length >= limit) break;
  }
  return accepted;
}

function pointInRing(x: number, y: number, ring: GeoRing) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = ((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function featureAtBlockPoint(
  projected: ReturnType<typeof buildProjectedBlockFeatures>,
  x: number,
  y: number,
) {
  for (let i = projected.length - 1; i >= 0; i -= 1) {
    const feature = projected[i];
    if (x < feature.bbox.minX || x > feature.bbox.maxX || y < feature.bbox.minY || y > feature.bbox.maxY) continue;
    if (feature.rings.some((ring) => pointInRing(x, y, ring))) return feature;
  }
  return null;
}

function featureAtZonePoint(
  projected: ReturnType<typeof buildProjectedZoneFeatures>,
  x: number,
  y: number,
) {
  for (let i = projected.length - 1; i >= 0; i -= 1) {
    const feature = projected[i];
    if (x < feature.bbox.minX || x > feature.bbox.maxX || y < feature.bbox.minY || y > feature.bbox.maxY) continue;
    if (feature.rings.some((ring) => pointInRing(x, y, ring))) return feature;
  }
  return null;
}

function buildProjectedDistrictBoundariesForBlocks(
  features: HojasRutaBlockMapFeature[],
  activeUbigeo: string,
  projection = buildBlockProjection(features),
) {
  if (!projection) return [];
  const ringPath = (ring: GeoRing) => {
    if (!ring.length) return "";
    const [first, ...rest] = ring;
    const [x0, y0] = projection.project(first);
    return [
      `M${x0.toFixed(2)} ${y0.toFixed(2)}`,
      ...rest.map((point) => {
        const [x, y] = projection.project(point);
        return `L${x.toFixed(2)} ${y.toFixed(2)}`;
      }),
      "Z",
    ].join(" ");
  };
  return DISTRICT_FEATURES.map((feature) => ({
    ubigeo: feature.properties.ubigeo,
    distrito: feature.properties.distrito,
    active: feature.properties.ubigeo === activeUbigeo,
    label: districtShortName(feature.properties.distrito),
    labelX: projection.project([feature.properties.label_lon, feature.properties.label_lat])[0],
    labelY: projection.project([feature.properties.label_lon, feature.properties.label_lat])[1],
    d: geometryPolygons(feature.geometry).map((polygon) => polygon.map(ringPath).join(" ")).join(" "),
  })).filter((feature) => feature.d);
}

function ZoomControls({
  value,
  min = 1,
  max = 4,
  onChange,
  onReset,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  onReset: () => void;
}) {
  const step = 0.5;
  const atMin = value <= min + 0.001;
  const atMax = value >= max - 0.001;
  const stopInteraction = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <div
      className="hojas-ruta-zoom"
      aria-label="Controles de zoom"
      onPointerDown={stopInteraction}
      onPointerMove={stopInteraction}
      onPointerUp={stopInteraction}
      onPointerCancel={stopInteraction}
      onWheel={stopInteraction}
    >
      <button type="button" onClick={(event) => { event.stopPropagation(); onChange(clamp(value - step, min, max)); }} disabled={atMin}>
        -
      </button>
      <span>{Math.round(value * 100)}%</span>
      <button type="button" onClick={(event) => { event.stopPropagation(); onChange(clamp(value + step, min, max)); }} disabled={atMax}>
        +
      </button>
      <button type="button" onClick={(event) => { event.stopPropagation(); onReset(); }} disabled={atMin}>
        1:1
      </button>
    </div>
  );
}

function BlockCanvasMap({
  projected,
  projectedContext,
  projectedStreets,
  boundaries,
  selectedSet,
  activeZone,
  hoveredId,
  inspectedId,
  onHover,
  onInspect,
  zoom,
  pan,
}: {
  projected: ReturnType<typeof buildProjectedBlockFeatures>;
  projectedContext: ReturnType<typeof buildProjectedContextFeatures>;
  projectedStreets: ReturnType<typeof buildProjectedStreetFeatures>;
  boundaries: ReturnType<typeof buildProjectedDistrictBoundariesForBlocks>;
  selectedSet: Set<string>;
  activeZone?: string;
  hoveredId: string | null;
  inspectedId: string | null;
  onHover: (id: string | null) => void;
  onInspect: (id: string | null) => void;
  zoom: number;
  pan: MapPan;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenToMapPoint = useCallback((event: { clientX: number; clientY: number; currentTarget: HTMLCanvasElement }) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const viewX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * BLOCK_MAP_WIDTH;
    const viewY = ((event.clientY - rect.top) / Math.max(1, rect.height)) * BLOCK_MAP_HEIGHT;
    return {
      x: BLOCK_MAP_WIDTH / 2 + (viewX - BLOCK_MAP_WIDTH / 2 - pan.x) / zoom,
      y: BLOCK_MAP_HEIGHT / 2 + (viewY - BLOCK_MAP_HEIGHT / 2 - pan.y) / zoom,
    };
  }, [pan.x, pan.y, zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform((rect.width * ratio) / BLOCK_MAP_WIDTH, 0, 0, (rect.height * ratio) / BLOCK_MAP_HEIGHT, 0, 0);
    ctx.clearRect(0, 0, BLOCK_MAP_WIDTH, BLOCK_MAP_HEIGHT);
    ctx.fillStyle = MAP_GEOMETRY_STYLE.background;
    ctx.fillRect(0, 0, BLOCK_MAP_WIDTH, BLOCK_MAP_HEIGHT);
    ctx.save();
    ctx.translate(BLOCK_MAP_WIDTH / 2 + pan.x, BLOCK_MAP_HEIGHT / 2 + pan.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-BLOCK_MAP_WIDTH / 2, -BLOCK_MAP_HEIGHT / 2);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const drawContextSurfaces = (overlay = false) => {
      for (const context of projectedContext) {
        if (!context.hasPolygons || !context.d || !contextIsSurface(context.featureClass)) continue;
        const style = contextClassStyle(context.featureClass, context.kind, context.sourceKind);
        const path = new Path2D(context.d);
        ctx.fillStyle = style.fill;
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = (overlay ? contextOverlayStrokeWidth(context.featureClass) : 0.7) / Math.max(1, zoom);
        if (!overlay) ctx.fill(path);
        ctx.stroke(path);
      }
    };
    const drawContextLines = (overlay = false) => {
      for (const context of projectedContext) {
        if (!context.hasLines || !context.d || !contextIsLinearPriority(context.featureClass)) continue;
        const style = contextClassStyle(context.featureClass, context.kind, context.sourceKind);
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = (contextLineWidth(context.featureClass, context.rank) * (overlay ? 1.2 : 0.8)) / Math.max(1, zoom);
        ctx.stroke(new Path2D(context.d));
      }
    };
    const drawContextMarkers = () => {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const context of projectedContext) {
        if (!shouldShowContextPoint(context, zoom)) continue;
        const style = contextClassStyle(context.featureClass, context.kind, context.sourceKind);
        const label = contextMarkerLabel(context.featureClass, context.kind);
        const radius = contextMarkerRadius(context, zoom);
        for (const [x, y] of context.points) {
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = style.fill === "none" ? "rgba(248,250,252,0.78)" : style.fill;
          ctx.strokeStyle = style.stroke;
          ctx.lineWidth = (contextIsLowPriority(context.featureClass) ? 0.6 : 1.15) / Math.max(1, zoom);
          ctx.fill();
          ctx.stroke();
          if (label) {
            ctx.font = `800 ${Math.max(3.8, radius * 1.08)}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
            ctx.fillStyle = style.label;
            ctx.fillText(label, x, y + radius * 0.02);
          }
        }
      }
    };
    const drawContextLabels = () => {
      const contextLabels = projectedContext.filter((context) => shouldLabelContext(context, zoom));
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const context of contextLabels) {
        const style = contextClassStyle(context.featureClass, context.kind, context.sourceKind);
        const fontSize = contextLabelSize(context, zoom);
        ctx.font = `${contextIsLowPriority(context.featureClass) ? 700 : 850} ${fontSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
        ctx.lineWidth = (contextIsLowPriority(context.featureClass) ? 2.2 : 3.2) / Math.max(1, zoom);
        ctx.strokeStyle = "rgba(255,255,255,0.92)";
        ctx.fillStyle = style.label;
        ctx.strokeText(context.name, context.labelX, context.labelY);
        ctx.fillText(context.name, context.labelX, context.labelY);
      }
    };
    drawContextSurfaces(false);
    drawContextLines(false);
    const visibleStreets = projectedStreets.filter((street) => shouldShowStreet(street, zoom));
    const drawStreetRibbons = (alpha = 1) => {
      for (const street of visibleStreets) {
        ctx.strokeStyle = streetCasingColor(street, alpha);
        ctx.lineWidth = streetCasingWidth(street.rank) / Math.max(1, zoom);
        ctx.lineCap = streetLineCap(street);
        ctx.stroke(new Path2D(street.d));
      }
      for (const street of visibleStreets) {
        ctx.strokeStyle = streetInnerColor(street, alpha);
        ctx.lineWidth = streetInnerWidth(street.rank) / Math.max(1, zoom);
        ctx.lineCap = streetLineCap(street);
        ctx.stroke(new Path2D(street.d));
      }
    };
    drawStreetRibbons(0.6);
    const drawStreetLabels = () => {
      const focusedId = inspectedId;
      const focusedFeature = focusedId ? projected.find((feature) => feature.id === focusedId) : null;
      const firstSelected = projected.find((feature) => selectedSet.has(feature.id));
      const labelFocus = projectedBlockCenter(focusedFeature ?? firstSelected ?? null);
      const labelStreets = buildStreetLabelCandidates(visibleStreets, zoom, labelFocus);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const street of labelStreets) {
        const fontSize = streetLabelRenderSize(street, zoom);
        ctx.font = `${streetLabelWeight(street)} ${fontSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
        ctx.save();
        ctx.translate(street.x, street.y);
        ctx.rotate(street.angle * Math.PI / 180);
        ctx.lineWidth = streetLabelRenderHaloWidth(street, zoom);
        ctx.strokeStyle = "rgba(255,255,255,0.97)";
        ctx.fillStyle = streetLabelFill(street);
        ctx.strokeText(street.name, 0, 0);
        ctx.fillText(street.name, 0, 0);
        ctx.restore();
      }
    };
    ctx.strokeStyle = "#b6c4d2";
    ctx.lineWidth = 0.9;
    for (const boundary of boundaries) {
      if (boundary.active) continue;
      ctx.stroke(new Path2D(boundary.d));
    }
    ctx.strokeStyle = "rgba(51,65,85,0.42)";
    ctx.lineWidth = 0.9 / Math.max(1, zoom);
    for (const boundary of boundaries) {
      if (!boundary.active) continue;
      ctx.stroke(new Path2D(boundary.d));
    }
    ctx.lineWidth = 0.68 / Math.max(1, zoom);
    for (const feature of projected) {
      if (selectedSet.has(feature.id)) continue;
      const isFocus = Boolean(activeZone && feature.zona === activeZone);
      const visual = geometryVisualState({ focused: isFocus });
      const path = new Path2D(feature.d);
      ctx.strokeStyle = visual.stroke;
      ctx.fillStyle = visual.fill;
      ctx.fill(path);
      ctx.stroke(path);
    }
    drawContextSurfaces(true);
    drawContextLines(true);
    drawContextMarkers();
    drawContextLabels();
    drawStreetRibbons(1);
    drawStreetLabels();
    ctx.lineWidth = 1.05;
    for (const feature of projected) {
      if (!selectedSet.has(feature.id)) continue;
      const path = new Path2D(feature.d);
      ctx.strokeStyle = MAP_GEOMETRY_STYLE.selectedStroke;
      ctx.fillStyle = MAP_GEOMETRY_STYLE.selectedFill;
      ctx.fill(path);
      ctx.stroke(path);
    }
    const focusedId = inspectedId ?? hoveredId;
    if (focusedId) {
      const focused = projected.find((feature) => feature.id === focusedId);
      if (focused) {
        const path = new Path2D(focused.d);
        if (!selectedSet.has(focused.id)) {
          ctx.fillStyle = MAP_GEOMETRY_STYLE.inspectedFill;
          ctx.fill(path);
        }
        ctx.strokeStyle = MAP_GEOMETRY_STYLE.hoverStroke;
        ctx.lineWidth = 2.2 / Math.max(1, zoom);
        ctx.stroke(path);
      }
    }
    const canvasLabelSize = 15 / Math.max(1, zoom);
    ctx.font = `800 ${canvasLabelSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const boundary of boundaries) {
      const visible = boundary.labelX > -80 && boundary.labelX < BLOCK_MAP_WIDTH + 80 && boundary.labelY > -80 && boundary.labelY < BLOCK_MAP_HEIGHT + 80;
      if (!boundary.active && !visible) continue;
      ctx.lineWidth = 4 / Math.max(1, zoom);
      ctx.strokeStyle = "rgba(255,255,255,0.82)";
      ctx.fillStyle = boundary.active ? "#334155" : "#64748b";
      ctx.strokeText(boundary.label, boundary.labelX, boundary.labelY);
      ctx.fillText(boundary.label, boundary.labelX, boundary.labelY);
    }
    ctx.restore();
  }, [activeZone, boundaries, hoveredId, inspectedId, pan, projected, projectedContext, projectedStreets, selectedSet, zoom]);

  return (
    <div style={{ position: "relative", height: "100%" }}>
      <canvas
        ref={canvasRef}
        aria-label="Mapa de manzanas del distrito"
        onPointerMove={(event) => {
          const point = screenToMapPoint(event);
          const hit = featureAtBlockPoint(projected, point.x, point.y);
          onHover(hit?.id ?? null);
          event.currentTarget.style.cursor = hit ? "pointer" : "grab";
        }}
        onPointerLeave={(event) => {
          onHover(null);
          event.currentTarget.style.cursor = "grab";
        }}
        onClick={(event) => {
          const point = screenToMapPoint(event);
          const hit = featureAtBlockPoint(projected, point.x, point.y);
          onInspect(hit?.id ?? null);
        }}
        style={{ width: "100%", height: "100%", display: "block", background: "#f8fafc" }}
      />
      <div className="hojas-ruta-map-badge">
        {formatNumber(projected.length)} manzanas · render optimizado
      </div>
    </div>
  );
}

function ZoneGeometryMap({
  zoneMap,
  selectedBlocks,
  activeZona,
  compact = false,
  onOpenZone,
}: {
  zoneMap: HojasRutaZoneMap;
  selectedBlocks: HojasRutaSamplePreview["blocks"];
  activeZona?: string;
  compact?: boolean;
  onOpenZone?: (zona: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const pendingZoneClickRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const projection = useMemo(() => buildZoneProjection(zoneMap.geojson.features ?? []), [zoneMap.geojson.features]);
  const projected = useMemo(() => buildProjectedZoneFeatures(zoneMap.geojson.features ?? [], projection), [zoneMap.geojson.features, projection]);
  const navigation = useMapNavigation(BLOCK_MAP_WIDTH, BLOCK_MAP_HEIGHT, 1, compact ? 1 : BLOCK_MAP_MAX_ZOOM);
  const zoneStats = useMemo(() => {
    const map = new Map<string, { manzanas: number; entrevistas: number }>();
    for (const block of selectedBlocks) {
      if (block.ubigeo !== zoneMap.ubigeo) continue;
      const current = map.get(block.zona) ?? { manzanas: 0, entrevistas: 0 };
      current.manzanas += 1;
      current.entrevistas += Number(block.entrevistas || 0);
      map.set(block.zona, current);
    }
    return map;
  }, [selectedBlocks, zoneMap.ubigeo]);
  const hoveredFeature = hovered ? projected.find((zone) => zone.id === hovered || zone.zona === hovered) : null;
  const activeFeature = activeZona ? projected.find((zone) => zone.zona === activeZona) : null;
  const detailFeature = hoveredFeature ?? activeFeature;

  if (!zoneMap.ok || projected.length === 0) {
    return (
      <EmptyState
        icon={<Layers size={18} />}
        title="Zonas no disponibles para este distrito"
        hint={zoneMap.alerts?.[0]?.message ?? "La capa de zonas se deriva de las manzanas locales."}
        variant="inline"
      />
    );
  }

  const screenToMapPoint = (event: { clientX: number; clientY: number; currentTarget: HTMLElement | SVGSVGElement }) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const viewX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * BLOCK_MAP_WIDTH;
    const viewY = ((event.clientY - rect.top) / Math.max(1, rect.height)) * BLOCK_MAP_HEIGHT;
    return {
      x: BLOCK_MAP_WIDTH / 2 + (viewX - BLOCK_MAP_WIDTH / 2 - navigation.pan.x) / navigation.zoom,
      y: BLOCK_MAP_HEIGHT / 2 + (viewY - BLOCK_MAP_HEIGHT / 2 - navigation.pan.y) / navigation.zoom,
    };
  };
  const mapHandlers = compact ? {} : {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      pendingZoneClickRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
      navigation.handlers.onPointerDown(event);
    },
    onPointerMove: navigation.handlers.onPointerMove,
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => {
      pendingZoneClickRef.current = null;
      navigation.handlers.onPointerCancel(event);
    },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
      const pending = pendingZoneClickRef.current;
      const clickDistance = pending && pending.pointerId === event.pointerId
        ? Math.hypot(event.clientX - pending.x, event.clientY - pending.y)
        : Infinity;
      navigation.handlers.onPointerUp(event);
      if (pending && pending.pointerId === event.pointerId && clickDistance < 8 && !navigation.suppressClick()) {
        const point = screenToMapPoint(event);
        const hit = featureAtZonePoint(projected, point.x, point.y);
        if (hit) onOpenZone?.(hit.zona);
      }
      pendingZoneClickRef.current = null;
    },
  };

  return (
    <div
      ref={(node) => {
        navigation.wheelHostRef.current = compact ? null : node;
      }}
      className={`hojas-ruta-zone-map${compact ? " is-compact" : " is-navigable"}`}
      {...mapHandlers}
    >
      <svg
        viewBox={`0 0 ${BLOCK_MAP_WIDTH} ${BLOCK_MAP_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Mapa de zonas del distrito"
        style={{ width: "100%", height: "100%", display: "block" }}
        onPointerMove={(event) => {
          if (compact) return;
          const point = screenToMapPoint(event);
          const hit = featureAtZonePoint(projected, point.x, point.y);
          setHovered(hit?.id ?? null);
        }}
        onPointerLeave={() => setHovered(null)}
      >
        <rect x="0" y="0" width={BLOCK_MAP_WIDTH} height={BLOCK_MAP_HEIGHT} fill={MAP_GEOMETRY_STYLE.background} />
        <g transform={compact ? undefined : navigation.transform}>
          {projected.map((zone) => {
            const stats = zoneStats.get(zone.zona);
            const selected = Boolean(stats?.manzanas);
            const active = activeZona === zone.zona;
            const focused = hovered === zone.id || hovered === zone.zona || active;
            const visual = geometryVisualState({ selected, focused, hovered: hovered === zone.id || hovered === zone.zona });
            return (
              <path
                key={zone.key}
                d={zone.d}
                fill={visual.fill}
                fillRule="evenodd"
                stroke={visual.stroke}
                strokeWidth={focused ? Math.max(1.35, visual.strokeWidth) : visual.strokeWidth}
                vectorEffect="non-scaling-stroke"
                style={{ cursor: compact ? "default" : "pointer", transition: "fill 140ms ease, stroke 140ms ease" }}
              />
            );
          })}
          {!compact && projected.map((zone) => {
            const stats = zoneStats.get(zone.zona);
            const show = navigation.zoom >= 1.4 || Boolean(stats?.manzanas) || activeZona === zone.zona || hovered === zone.id;
            if (!show) return null;
            const fontSize = (stats?.manzanas ? 14 : 11) / navigation.zoom;
            return (
              <text
                key={`${zone.key}:label`}
                x={zone.labelX}
                y={zone.labelY}
                fill={stats?.manzanas ? "white" : "#334155"}
                stroke={stats?.manzanas ? "rgba(6,78,59,0.34)" : "rgba(255,255,255,0.88)"}
                strokeWidth={3 / navigation.zoom}
                paintOrder="stroke"
                fontSize={fontSize}
                fontWeight="850"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                Zona {zone.zona}
              </text>
            );
          })}
        </g>
      </svg>
      {!compact ? <ZoomControls value={navigation.zoom} min={1} max={BLOCK_MAP_MAX_ZOOM} onChange={navigation.setZoom} onReset={navigation.reset} /> : null}
      {!compact ? (
        <div className="hojas-ruta-map-legend" aria-hidden="true">
          <span><i /> Manzanas</span>
          <span><i className="is-green-context" /> Areas verdes</span>
          <span><i className="is-water-context" /> Agua</span>
          <span><i className="is-selected" /> Seleccionadas</span>
        </div>
      ) : null}
      {detailFeature && !compact ? (
        <div className="hojas-ruta-map-info">
          <div style={{ fontSize: 12, fontWeight: 850 }}>Zona {detailFeature.zona}</div>
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 4 }}>
            {formatNumber(detailFeature.nManzanas)} manzanas · {formatNumber(detailFeature.viviendas)} viviendas
          </div>
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 2 }}>
            {formatNumber(detailFeature.poblacion)} personas
          </div>
          {zoneStats.has(detailFeature.zona) ? (
            <div className="hojas-ruta-zone-info-selected">
              <strong>{formatNumber(zoneStats.get(detailFeature.zona)?.manzanas)} seleccionadas</strong>
              <span>{formatNumber(zoneStats.get(detailFeature.zona)?.entrevistas)} encuestas</span>
            </div>
          ) : null}
        </div>
      ) : null}
      {!compact ? (
        <div className="hojas-ruta-map-badge">
          {formatNumber(projected.length)} zonas · click abre manzanas
        </div>
      ) : null}
    </div>
  );
}

function BlockGeometryMap({
  blockMap,
  contextMap,
  streetMap,
  selectedBlocks,
  activeZone,
}: {
  blockMap: HojasRutaBlockMap;
  contextMap?: HojasRutaContextMap | null;
  streetMap?: HojasRutaStreetMap | null;
  selectedBlocks: HojasRutaSamplePreview["blocks"];
  activeZone?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [inspected, setInspected] = useState<string | null>(null);
  const navigation = useMapNavigation(BLOCK_MAP_WIDTH, BLOCK_MAP_HEIGHT, 1, BLOCK_MAP_MAX_ZOOM);
  const allBlockFeatures = useMemo(() => blockMap.geojson.features ?? [], [blockMap.geojson.features]);
  const focusBlockFeatures = useMemo(
    () => blockFocusFeaturesWithNeighbors(allBlockFeatures, activeZone),
    [activeZone, allBlockFeatures],
  );
  const projection = useMemo(() => buildBlockProjection(focusBlockFeatures), [focusBlockFeatures]);
  const projected = useMemo(() => buildProjectedBlockFeatures(allBlockFeatures, projection), [allBlockFeatures, projection]);
  const contextFeatures = contextMap?.ok && contextMap.ubigeo === blockMap.ubigeo ? (contextMap.geojson.features ?? []) : [];
  const projectedContext = useMemo(() => buildProjectedContextFeatures(contextFeatures, projection), [contextFeatures, projection]);
  const streetFeatures = streetMap?.ok && streetMap.ubigeo === blockMap.ubigeo ? (streetMap.geojson.features ?? []) : [];
  const projectedStreets = useMemo(() => buildProjectedStreetFeatures(streetFeatures, projection), [streetFeatures, projection]);
  const boundaries = useMemo(() => buildProjectedDistrictBoundariesForBlocks(focusBlockFeatures, blockMap.ubigeo, projection), [focusBlockFeatures, blockMap.ubigeo, projection]);
  const selectedBlockById = useMemo(() => new Map(selectedBlocks.map((block) => [block.id_manzana, block])), [selectedBlocks]);
  const selectedSet = useMemo(() => new Set(selectedBlocks.map((block) => block.id_manzana)), [selectedBlocks]);
  const hoveredFeature = hovered ? projected.find((f) => f.id === hovered) : null;
  const inspectedFeature = inspected ? projected.find((f) => f.id === inspected) : null;
  const detailFeature = inspectedFeature ?? hoveredFeature;
  const detailBlock = detailFeature ? selectedBlockById.get(detailFeature.id) : null;
  const useCanvas = projected.length > 4000;
  const visibleStreets = useMemo(
    () => projectedStreets.filter((street) => shouldShowStreet(street, navigation.zoom)),
    [projectedStreets, navigation.zoom],
  );
  const streetLabelFocus = useMemo(() => {
    const firstSelected = projected.find((feature) => selectedSet.has(feature.id));
    return projectedBlockCenter(inspectedFeature ?? firstSelected ?? null);
  }, [inspectedFeature, projected, selectedSet]);
  const streetLabels = useMemo(
    () => buildStreetLabelCandidates(visibleStreets, navigation.zoom, streetLabelFocus),
    [streetLabelFocus, visibleStreets, navigation.zoom],
  );
  const streetAttribution = streetMap?.source?.attribution ?? "© OpenStreetMap contributors · ODbL";

  useEffect(() => {
    navigation.reset();
    setHovered(null);
    setInspected(null);
  }, [activeZone, blockMap.ubigeo, navigation.reset]);

  if (!blockMap.ok || projected.length === 0) {
    return (
      <EmptyState
        icon={<MapPinned size={18} />}
        title="Manzanas no disponibles para este distrito"
        hint={blockMap.alerts?.[0]?.message ?? "La cartografia por manzana se cargara cuando exista una fuente compatible."}
        variant="inline"
      />
    );
  }

  return (
    <div
      ref={(node) => {
        navigation.wheelHostRef.current = node;
      }}
      className="hojas-ruta-block-map is-navigable"
      {...navigation.handlers}
    >
      {useCanvas ? (
        <BlockCanvasMap
          projected={projected}
          projectedContext={projectedContext}
          projectedStreets={projectedStreets}
          boundaries={boundaries}
          selectedSet={selectedSet}
          activeZone={activeZone}
          hoveredId={hovered}
          inspectedId={inspected}
          onHover={setHovered}
          onInspect={setInspected}
          zoom={navigation.zoom}
          pan={navigation.pan}
        />
      ) : (
        <svg viewBox={`0 0 ${BLOCK_MAP_WIDTH} ${BLOCK_MAP_HEIGHT}`} role="img" aria-label="Mapa de manzanas del distrito" style={{ width: "100%", height: "100%", display: "block" }}>
          <rect x="0" y="0" width={BLOCK_MAP_WIDTH} height={BLOCK_MAP_HEIGHT} fill={MAP_GEOMETRY_STYLE.background} />
          <g transform={navigation.transform}>
            {projectedContext.map((context) => {
              const style = contextClassStyle(context.featureClass, context.kind, context.sourceKind);
              if (!context.d || (!context.hasPolygons && !context.hasLines)) return null;
              if (!contextIsSurface(context.featureClass) && !contextIsLinearPriority(context.featureClass)) return null;
              return (
                <path
                  key={`${context.key}:context`}
                  d={context.d}
                  fill={context.hasPolygons ? style.fill : "none"}
                  stroke={style.stroke}
                  strokeWidth={context.hasLines ? contextLineWidth(context.featureClass, context.rank) : 0.85}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              );
            })}
            {visibleStreets.map((street) => (
              <path
                key={`${street.key}:casing`}
                d={street.d}
                fill="none"
                stroke={streetCasingColor(street, 0.58)}
                strokeWidth={streetCasingWidth(street.rank)}
                strokeLinecap={streetLineCap(street)}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            ))}
            {visibleStreets.map((street) => (
              <path
                key={`${street.key}:inner`}
                d={street.d}
                fill="none"
                stroke={streetInnerColor(street, 0.72)}
                strokeWidth={streetInnerWidth(street.rank)}
                strokeLinecap={streetLineCap(street)}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            ))}
            {boundaries.map((boundary) => !boundary.active && (
              <path key={boundary.ubigeo} d={boundary.d} fill="none" stroke="rgba(148,163,184,0.62)" strokeWidth={0.85} vectorEffect="non-scaling-stroke" />
            ))}
            {boundaries.map((boundary) => boundary.active && (
              <path
                key={`${boundary.ubigeo}:reference`}
                d={boundary.d}
                fill="none"
                stroke="rgba(51,65,85,0.42)"
                strokeWidth={0.9}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {projected.filter((feature) => !selectedSet.has(feature.id)).map((feature) => {
              const selected = selectedSet.has(feature.id);
              const hoveredFeaturePath = hovered === feature.id;
              const focused = Boolean(activeZone && feature.zona === activeZone);
              const visual = geometryVisualState({ selected, focused, hovered: hoveredFeaturePath });
              return (
                <path
                  key={feature.key}
                  d={feature.d}
                  fill={visual.fill}
                  stroke={visual.stroke}
                  strokeWidth={visual.strokeWidth}
                  vectorEffect="non-scaling-stroke"
                  onMouseEnter={() => setHovered(feature.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setInspected(feature.id)}
                  style={{ transition: "fill 140ms ease, stroke 140ms ease", cursor: "pointer" }}
                />
              );
            })}
            {projectedContext.filter((context) => context.hasPolygons && context.d && contextIsSurface(context.featureClass)).map((context) => {
              const style = contextClassStyle(context.featureClass, context.kind, context.sourceKind);
              return (
                <path
                  key={`${context.key}:context-overlay`}
                  d={context.d}
                  fill="none"
                  stroke={style.stroke}
                  strokeWidth={contextOverlayStrokeWidth(context.featureClass)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              );
            })}
            {projectedContext.filter((context) => context.hasLines && context.d && contextIsLinearPriority(context.featureClass)).map((context) => {
              const style = contextClassStyle(context.featureClass, context.kind, context.sourceKind);
              return (
                <path
                  key={`${context.key}:context-line-overlay`}
                  d={context.d}
                  fill="none"
                  stroke={style.stroke}
                  strokeWidth={contextLineWidth(context.featureClass, context.rank) * 1.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              );
            })}
            {projectedContext.filter((context) => shouldLabelContext(context, navigation.zoom)).map((context) => {
              const style = contextClassStyle(context.featureClass, context.kind, context.sourceKind);
              return (
                <text
                  key={`${context.key}:context-label`}
                  x={context.labelX}
                  y={context.labelY}
                  fill={style.label}
                  stroke="rgba(255,255,255,0.9)"
                  strokeWidth={(contextIsLowPriority(context.featureClass) ? 2.2 : 3.2) / navigation.zoom}
                  paintOrder="stroke"
                  fontSize={contextLabelSize(context, navigation.zoom)}
                  fontWeight={contextIsLowPriority(context.featureClass) ? 700 : 850}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  pointerEvents="none"
                >
                  {context.name}
                </text>
              );
            })}
            {projectedContext.filter((context) => shouldShowContextPoint(context, navigation.zoom)).flatMap((context) => {
              const style = contextClassStyle(context.featureClass, context.kind, context.sourceKind);
              const radius = contextMarkerRadius(context, navigation.zoom);
              const marker = contextMarkerLabel(context.featureClass, context.kind);
              return context.points.map(([x, y], index) => (
                <g
                  key={`${context.key}:point:${index}`}
                  pointerEvents="none"
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    fill={style.fill === "none" ? "rgba(248,250,252,0.78)" : style.fill}
                    stroke={style.stroke}
                    strokeWidth={contextIsLowPriority(context.featureClass) ? 0.6 : 1.15}
                    vectorEffect="non-scaling-stroke"
                  />
                  {marker ? (
                    <text
                      x={x}
                      y={y}
                      fill={style.label}
                      fontSize={Math.max(3.8, radius * 1.08)}
                      fontWeight="850"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {marker}
                    </text>
                  ) : null}
                </g>
              ));
            })}
            {visibleStreets.map((street) => (
              <path
                key={`${street.key}:overlay-casing`}
                d={street.d}
                fill="none"
                stroke={streetCasingColor(street, 1)}
                strokeWidth={streetCasingWidth(street.rank)}
                strokeLinecap={streetLineCap(street)}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            ))}
            {visibleStreets.map((street) => (
              <path
                key={`${street.key}:overlay-inner`}
                d={street.d}
                fill="none"
                stroke={streetInnerColor(street, 1)}
                strokeWidth={streetInnerWidth(street.rank)}
                strokeLinecap={streetLineCap(street)}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            ))}
            {streetLabels.map((street) => (
              <text
                key={`${street.key}:street-label`}
                x={street.x}
                y={street.y}
                transform={`rotate(${street.angle.toFixed(2)} ${street.x.toFixed(2)} ${street.y.toFixed(2)})`}
                fill={streetLabelFill(street)}
                stroke="rgba(255,255,255,0.97)"
                strokeWidth={streetLabelRenderHaloWidth(street, navigation.zoom)}
                paintOrder="stroke"
                fontSize={streetLabelRenderSize(street, navigation.zoom)}
                fontWeight={streetLabelWeight(street)}
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                {street.name}
              </text>
            ))}
            {projected.filter((feature) => selectedSet.has(feature.id)).map((feature) => {
              const hoveredFeaturePath = hovered === feature.id;
              return (
                <path
                  key={feature.key}
                  d={feature.d}
                  fill={MAP_GEOMETRY_STYLE.selectedFill}
                  stroke={hoveredFeaturePath ? MAP_GEOMETRY_STYLE.hoverStroke : MAP_GEOMETRY_STYLE.selectedStroke}
                  strokeWidth={hoveredFeaturePath ? 1.35 : 1.05}
                  vectorEffect="non-scaling-stroke"
                  onMouseEnter={() => setHovered(feature.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setInspected(feature.id)}
                  style={{ transition: "fill 140ms ease, stroke 140ms ease", cursor: "pointer" }}
                />
              );
            })}
            {detailFeature && !selectedSet.has(detailFeature.id) ? (
              <path
                key={`${detailFeature.key}:focused`}
                d={detailFeature.d}
                fill={MAP_GEOMETRY_STYLE.inspectedFill}
                stroke={MAP_GEOMETRY_STYLE.selectedStroke}
                strokeWidth={1.55}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            ) : null}
            {boundaries.map((boundary) => {
              const visible = boundary.labelX > -80 && boundary.labelX < BLOCK_MAP_WIDTH + 80 && boundary.labelY > -80 && boundary.labelY < BLOCK_MAP_HEIGHT + 80;
              if (!boundary.active && !visible) return null;
              const boundaryLabelFontSize = (boundary.active ? 17 : 14) / navigation.zoom;
              const boundaryLabelStrokeWidth = 4 / navigation.zoom;
              return (
                <text
                  key={`${boundary.ubigeo}:label`}
                  x={boundary.labelX}
                  y={boundary.labelY}
                  fill={boundary.active ? "#334155" : "#64748b"}
                  stroke="rgba(255,255,255,0.82)"
                  strokeWidth={boundaryLabelStrokeWidth}
                  paintOrder="stroke"
                  fontSize={boundaryLabelFontSize}
                  fontWeight="850"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  pointerEvents="none"
                >
                  {boundary.label}
                </text>
              );
            })}
          </g>
        </svg>
      )}
      <ZoomControls value={navigation.zoom} min={1} max={BLOCK_MAP_MAX_ZOOM} onChange={navigation.setZoom} onReset={navigation.reset} />
      {streetMap?.ok ? <div className="hojas-ruta-osm-attribution">{streetAttribution}</div> : null}
      {detailFeature && (
        <div className="hojas-ruta-block-popup">
          <div className="hojas-ruta-block-popup-head">
            <div>
              <strong>Manzana {detailFeature.label}</strong>
              {detailFeature.zona ? <span>Zona {detailFeature.zona}</span> : null}
            </div>
            {selectedSet.has(detailFeature.id) ? <StatusPill ok text="Seleccionada" /> : null}
          </div>
          {(detailFeature.viviendas != null || detailFeature.poblacion != null) ? (
            <div className="hojas-ruta-block-popup-stats">
              {detailFeature.viviendas != null ? (
                <div>
                  <span>Viviendas</span>
                  <strong>{formatNumber(Math.round(detailFeature.viviendas))}</strong>
                </div>
              ) : null}
              {detailFeature.poblacion != null ? (
                <div>
                  <span>Población</span>
                  <strong>{formatNumber(Math.round(detailFeature.poblacion))}</strong>
                </div>
              ) : null}
            </div>
          ) : null}
          {(detailFeature.hombres != null || detailFeature.mujeres != null) ? (
            <div className="hojas-ruta-block-popup-sex">
              {detailFeature.hombres != null ? (
                <span>♂ {formatNumber(Math.round(detailFeature.hombres))}</span>
              ) : null}
              {detailFeature.mujeres != null ? (
                <span>♀ {formatNumber(Math.round(detailFeature.mujeres))}</span>
              ) : null}
              {detailFeature.pob18plus != null ? (
                <span className="is-soft">{formatNumber(Math.round(detailFeature.pob18plus))} adultos 18+</span>
              ) : null}
            </div>
          ) : null}
          {detailBlock ? (
            <div className="hojas-ruta-block-popup-assignment">
              <strong>{formatNumber(detailBlock.entrevistas)} encuestas asignadas</strong>
              <span>orden de visita #{formatNumber(detailBlock.orden_seleccion)}</span>
            </div>
          ) : null}
          <div className="hojas-ruta-block-popup-meta">
            <span>{detailFeature.id}</span>
            {detailFeature.area != null ? <span>{formatNumber(Math.round(detailFeature.area))} m²</span> : null}
          </div>
          {inspectedFeature && (
            <button type="button" onClick={() => setInspected(null)} className="hojas-ruta-block-popup-close">
              Cerrar detalle
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function LimaCoverageMap({
  territories,
  selected,
  activeUbigeo,
  compact = false,
  showHeader = false,
  selectionMode = false,
  onFocus,
  onToggleSelection,
}: {
  territories: HojasRutaState["territories"];
  selected: string[];
  activeUbigeo?: string;
  compact?: boolean;
  showHeader?: boolean;
  selectionMode?: boolean;
  onFocus: (ubigeo: string) => void;
  onToggleSelection?: (ubigeo: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const pendingDistrictClickRef = useRef<{ ubigeo: string; pointerId: number; x: number; y: number } | null>(null);
  const navigation = useMapNavigation(MAP_SIZE, MAP_SIZE, 1, LIMA_MAP_MAX_ZOOM, compact ? 1 : 1.28);
  const byUbigeo = useMemo(() => new Map(territories.map((t) => [t.ubigeo, t])), [territories]);
  const projectedDistricts = useMemo(() => buildProjectedDistricts(), []);
  const activeOnMap = activeUbigeo && (compact || selected.includes(activeUbigeo)) ? activeUbigeo : "";
  const infoUbigeo = hovered ?? activeOnMap;
  const infoTerritory = infoUbigeo ? byUbigeo.get(infoUbigeo) : null;
  const infoDistrict = infoUbigeo ? DISTRICT_FEATURE_BY_UBIGEO.get(infoUbigeo) : null;
  const orderedDistricts = useMemo(
    () => [...projectedDistricts].sort((a, b) => Number(selected.includes(a.ubigeo)) - Number(selected.includes(b.ubigeo))),
    [projectedDistricts, selected],
  );
  const activeProjected = activeOnMap ? projectedDistricts.find((district) => district.ubigeo === activeOnMap) : null;
  const compactViewBox = compactDistrictViewBox(activeProjected ?? undefined);
  const mapTransformValue = compact ? undefined : navigation.transform;
  const mapHandlers = compact ? {} : {
    onPointerDown: navigation.handlers.onPointerDown,
    onPointerMove: navigation.handlers.onPointerMove,
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => {
      pendingDistrictClickRef.current = null;
      navigation.handlers.onPointerCancel(event);
    },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
      const pending = pendingDistrictClickRef.current;
      const clickDistance = pending && pending.pointerId === event.pointerId
        ? Math.hypot(event.clientX - pending.x, event.clientY - pending.y)
        : Infinity;
      navigation.handlers.onPointerUp(event);
      if (pending && pending.pointerId === event.pointerId && clickDistance < 8 && !navigation.suppressClick()) {
        if (selectionMode && onToggleSelection) {
          onToggleSelection(pending.ubigeo);
        } else {
          onFocus(pending.ubigeo);
        }
      }
      pendingDistrictClickRef.current = null;
    },
  };

  return (
    <div className={`hojas-ruta-lima-map${compact ? " is-compact" : ""}`}>
      {!compact && showHeader && (
        <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--pulso-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--pulso-text)" }}>Mapa de distritos</div>
            <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 2 }}>
              {selectionMode ? "Click agrega o quita distritos del borrador" : "Click en un distrito para ver sus zonas"}
            </div>
          </div>
          <StatusPill ok text={`${selected.length} en cuotas`} />
        </div>
      )}
      <div
        ref={(node) => {
          navigation.wheelHostRef.current = compact ? null : node;
        }}
        className={`hojas-ruta-lima-map-body${compact ? "" : " is-navigable"}`}
        {...mapHandlers}
      >
        <svg
          viewBox={compact ? compactViewBox : `0 0 ${MAP_SIZE} ${MAP_SIZE}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Mapa real de distritos cubiertos"
          style={{ width: "100%", height: "100%", display: "block", background: MAP_GEOMETRY_STYLE.background }}
        >
          <rect x="0" y="0" width="560" height="560" fill={MAP_GEOMETRY_STYLE.background} />
          <g transform={mapTransformValue}>
          {orderedDistricts.map((district) => {
            const inQuotaFrame = byUbigeo.has(district.ubigeo);
            const isSelected = selected.includes(district.ubigeo);
            const isActive = activeOnMap === district.ubigeo;
            const isHovered = hovered === district.ubigeo;
            const highlighted = isSelected || (compact && isActive);
            const visual = geometryVisualState({
              selected: highlighted,
              focused: isActive || isHovered,
              hovered: isHovered,
              muted: !inQuotaFrame,
            });
            return (
              <path
                key={district.ubigeo}
                d={district.d}
                fill={visual.fill}
                fillRule="evenodd"
                stroke={visual.stroke}
                strokeWidth={isHovered || isActive ? Math.max(1.35, visual.strokeWidth) : visual.strokeWidth}
                vectorEffect="non-scaling-stroke"
                opacity={visual.opacity}
                style={{ cursor: compact ? "default" : "pointer", transition: "fill 140ms ease, stroke 140ms ease, opacity 140ms ease" }}
                onPointerDown={(event) => {
                  if (!compact) {
                    pendingDistrictClickRef.current = {
                      ubigeo: district.ubigeo,
                      pointerId: event.pointerId,
                      x: event.clientX,
                      y: event.clientY,
                    };
                  }
                }}
                onMouseEnter={() => setHovered(district.ubigeo)}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}
          {projectedDistricts.map((district) => {
            const territory = byUbigeo.get(district.ubigeo);
            const activeDistrict = activeOnMap === district.ubigeo;
            const hoveredDistrictLabel = hovered === district.ubigeo;
            const showLabel = !compact && (hoveredDistrictLabel || (activeDistrict && navigation.zoom <= 1.35));
            if ((!territory && !activeDistrict) || !showLabel) return null;
            const label = territory?.distrito ?? district.distrito;
            const labelFontSize = (activeDistrict ? 15 : 11) / navigation.zoom;
            const labelStrokeWidth = (activeDistrict ? 3.2 : 2.2) / navigation.zoom;
            return (
              <text
                key={`${district.ubigeo}:label`}
                x={district.labelX}
                y={district.labelY}
                fill={activeDistrict && (selected.includes(district.ubigeo) || compact) ? "white" : "#334155"}
                stroke={activeDistrict && (selected.includes(district.ubigeo) || compact) ? "rgba(6,78,59,0.22)" : "rgba(255,255,255,0.86)"}
                strokeWidth={labelStrokeWidth}
                paintOrder="stroke"
                fontSize={labelFontSize}
                fontWeight="800"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                {districtShortName(label)}
              </text>
            );
          })}
          </g>
        </svg>
        {!compact && <ZoomControls value={navigation.zoom} min={1} max={LIMA_MAP_MAX_ZOOM} onChange={navigation.setZoom} onReset={navigation.reset} />}
        {!compact && (
          <div className="hojas-ruta-map-legend" aria-hidden="true">
            <span><i /> Contexto</span>
            <span><i className="is-focus" /> En foco</span>
            <span><i className="is-selected" /> {selectionMode ? "En borrador" : "En cuotas"}</span>
          </div>
        )}
        {!compact && infoDistrict && (
          <div className="hojas-ruta-map-info">
            <div style={{ fontSize: 12, fontWeight: 850 }}>{infoTerritory?.distrito ?? infoDistrict.properties.distrito}</div>
            <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 4 }}>
              {infoDistrict.properties.ubigeo} · {selectionMode ? "click agrega/quita" : "click abre zonas"}
            </div>
            {infoTerritory ? (
              <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 2 }}>
                {formatNumber(infoTerritory.viviendas)} viviendas · {formatNumber(infoTerritory.poblacion)} personas
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 2 }}>
                Disponible como contexto cartografico
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DistrictShapeIcon({ ubigeo, active }: { ubigeo: string; active?: boolean }) {
  const d = useMemo(() => projectDistrictIcon(ubigeo), [ubigeo]);
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" style={{ width: 42, height: 42, display: "block", flex: "0 0 auto" }}>
      <rect x="0" y="0" width="48" height="48" rx="8" fill={active ? "#dff3ee" : "#f8fafc"} />
      {d ? <path d={d} fill="#0f766e" stroke="#064e3b" strokeWidth="1.4" fillRule="evenodd" /> : null}
    </svg>
  );
}

function DistrictSelectorGrid({
  territories,
  draft,
  confirmed,
  activeUbigeo,
  onToggleDraft,
  onFocus,
  onSelectMany,
  onClearDraft,
}: {
  territories: HojasRutaState["territories"];
  draft: string[];
  confirmed: string[];
  activeUbigeo: string;
  onToggleDraft: (ubigeo: string) => void;
  onFocus: (ubigeo: string) => void;
  onSelectMany: (ubigeos: string[]) => void;
  onClearDraft: () => void;
}) {
  const [query, setQuery] = useState("");
  const filteredTerritories = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es-PE");
    const base = normalized
      ? territories.filter((t) => `${t.distrito} ${t.ubigeo}`.toLocaleLowerCase("es-PE").includes(normalized))
      : territories;
    return [...base].sort((a, b) => {
      const draftDelta = Number(draft.includes(b.ubigeo)) - Number(draft.includes(a.ubigeo));
      if (draftDelta !== 0) return draftDelta;
      const confirmedDelta = Number(confirmed.includes(b.ubigeo)) - Number(confirmed.includes(a.ubigeo));
      if (confirmedDelta !== 0) return confirmedDelta;
      const activeDelta = Number(confirmed.includes(b.ubigeo) && activeUbigeo === b.ubigeo) - Number(confirmed.includes(a.ubigeo) && activeUbigeo === a.ubigeo);
      if (activeDelta !== 0) return activeDelta;
      return a.distrito.localeCompare(b.distrito, "es");
    });
  }, [activeUbigeo, confirmed, draft, query, territories]);
  const visibleUbigeos = filteredTerritories.map((t) => t.ubigeo);
  const selectedVisibleCount = visibleUbigeos.filter((ubigeo) => draft.includes(ubigeo)).length;

  return (
    <div className="hojas-ruta-district-picker">
      <label className="hojas-ruta-district-search">
        <Search size={15} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar distrito o ubigeo"
          aria-label="Buscar distrito"
        />
      </label>
      <div className="hojas-ruta-district-tools">
        <span>
          {formatNumber(filteredTerritories.length)} visibles · {formatNumber(selectedVisibleCount)} en borrador
        </span>
        <div>
          <button
            type="button"
            onClick={() => onSelectMany(Array.from(new Set([...draft, ...visibleUbigeos])))}
            disabled={filteredTerritories.length === 0}
          >
            Agregar visibles
          </button>
          <button type="button" onClick={onClearDraft} disabled={draft.length === 0}>
            Limpiar borrador
          </button>
        </div>
      </div>
      <div className="hojas-ruta-district-grid">
        {filteredTerritories.map((t) => {
          const isDraft = draft.includes(t.ubigeo);
          const isConfirmed = confirmed.includes(t.ubigeo);
          const isActive = isConfirmed && activeUbigeo === t.ubigeo;
          return (
            <div
              key={t.ubigeo}
              className={`hojas-ruta-district-card${isDraft ? " is-draft" : ""}${isConfirmed ? " is-confirmed" : ""}${isActive ? " is-active" : ""}`}
            >
              <button
                type="button"
                className="hojas-ruta-district-card-main"
                onClick={() => onToggleDraft(t.ubigeo)}
                aria-pressed={isDraft}
              >
                <DistrictShapeIcon ubigeo={t.ubigeo} active={isConfirmed} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 12, fontWeight: 850, color: "var(--pulso-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.distrito}
                  </span>
                  <span style={{ display: "block", marginTop: 3, fontSize: 11, color: "var(--pulso-text-soft)" }}>
                    {formatNumber(t.viviendas)} viviendas · {formatNumber(t.manzanas)} manzanas
                  </span>
                </span>
                {isConfirmed ? <CheckCircle2 size={16} color="var(--pulso-primary)" /> : isDraft ? <CheckCircle2 size={16} color="#2563eb" /> : <span />}
              </button>
              <button
                type="button"
                className="hojas-ruta-district-card-map"
                onClick={() => onFocus(t.ubigeo)}
                title="Ver zonas en el mapa"
                aria-label={`Ver zonas de ${t.distrito}`}
              >
                <MapPinned size={14} />
              </button>
            </div>
          );
        })}
        {filteredTerritories.length === 0 && (
          <div className="hojas-ruta-district-empty">No hay distritos que coincidan con la busqueda.</div>
        )}
      </div>
    </div>
  );
}

function TerritoryMapExplorer({
  territories,
  selected,
  draft,
  activeUbigeo,
  activeZona,
  mapLevel,
  zoneMap,
  blockMap,
  contextMap,
  streetMap,
  zoneMapLoading,
  blockMapLoading,
  selectedBlocks,
  enableMapSelection = true,
  mapSelectionMode,
  onFocus,
  onOpenZone,
  onToggleDraft,
  onMapSelectionModeChange,
  onBackToZones,
  onBackToDistricts,
}: {
  territories: HojasRutaState["territories"];
  selected: string[];
  draft: string[];
  activeUbigeo: string;
  activeZona: string;
  mapLevel: HojasRutaMapLevel;
  zoneMap: HojasRutaZoneMap | null;
  blockMap: HojasRutaBlockMap | null;
  contextMap: HojasRutaContextMap | null;
  streetMap: HojasRutaStreetMap | null;
  zoneMapLoading: boolean;
  blockMapLoading: boolean;
  selectedBlocks: HojasRutaSamplePreview["blocks"];
  enableMapSelection?: boolean;
  mapSelectionMode: boolean;
  onFocus: (ubigeo: string) => void;
  onOpenZone: (zona: string) => void;
  onToggleDraft: (ubigeo: string) => void;
  onMapSelectionModeChange: (enabled: boolean) => void;
  onBackToZones: () => void;
  onBackToDistricts: () => void;
}) {
  const activeTerritory = territories.find((t) => t.ubigeo === activeUbigeo);
  const activeDistrictName = activeTerritory?.distrito ?? districtNameForUbigeo(activeUbigeo);
  const showingZones = mapLevel === "zonas" && !!activeUbigeo && zoneMap?.ubigeo === activeUbigeo;
  const showingBlocks = mapLevel === "manzanas" && !!activeUbigeo && blockMap?.ubigeo === activeUbigeo;

  return (
    <div className="hojas-ruta-map-explorer">
      <div className="hojas-ruta-map-toolbar">
        <div>
          {!showingZones && !showingBlocks ? (
            <div className="hojas-ruta-workbench-eyebrow">Base poblacional INEI 2017</div>
          ) : null}
          <div className="hojas-ruta-map-title">
            {showingBlocks
              ? `Manzanas de ${activeDistrictName}`
              : showingZones
                ? `Zonas de ${activeDistrictName}`
                : "Explora Lima y arma tu marco de campo"}
          </div>
          {activeTerritory ? (
            <div className="hojas-ruta-focus-strip">
              <div className="hojas-ruta-focus-name">
                <span>Distrito enfocado</span>
                <strong>{activeTerritory.distrito}</strong>
              </div>
              <MiniMetric label="Codigo INEI" value={activeTerritory.ubigeo} />
              <MiniMetric label="Viviendas 2017" value={formatNumber(activeTerritory.viviendas)} />
              <MiniMetric label="Manzanas censales" value={formatNumber(activeTerritory.manzanas)} />
              <MiniMetric label="Poblacion 2017" value={formatNumber(activeTerritory.poblacion)} />
            </div>
          ) : (
            <div className="hojas-ruta-focus-empty">Sin distrito enfocado</div>
          )}
        </div>
        <div style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {showingBlocks ? (
            <button type="button" style={{ ...btnSecondary, padding: "6px 10px", fontSize: 12 }} onClick={onBackToZones}>
              <Layers size={13} /> Mapa de zonas
            </button>
          ) : showingZones ? (
            <button type="button" style={{ ...btnSecondary, padding: "6px 10px", fontSize: 12 }} onClick={onBackToDistricts}>
              <MapPinned size={13} /> Mapa distrital
            </button>
          ) : enableMapSelection ? (
            <button
              type="button"
              style={{ ...(mapSelectionMode ? btnPrimary : btnSecondary), padding: "6px 10px", fontSize: 12 }}
              onClick={() => onMapSelectionModeChange(!mapSelectionMode)}
              aria-pressed={mapSelectionMode}
            >
              <CheckCircle2 size={13} /> Seleccion en mapa
            </button>
          ) : null}
          {!showingZones && !showingBlocks && mapSelectionMode ? <StatusPill ok={draft.length > 0} text={`${draft.length} en borrador`} /> : null}
          <StatusPill ok text={`${selected.length} en cuotas`} />
        </div>
      </div>
      <div className="hojas-ruta-map-stage">
        {zoneMapLoading || blockMapLoading ? (
          <LoadingBlock label={mapLevel === "manzanas" ? "Cargando manzanas locales" : "Cargando zonas locales"} />
        ) : showingBlocks && blockMap ? (
          <div className="hojas-ruta-block-stage">
            {blockMap.alerts.map((a) => (
              <Alert key={`${a.code}:${a.message}`} kind={alertKind(a.level)}>{a.message}</Alert>
            ))}
            <BlockGeometryMap blockMap={blockMap} contextMap={contextMap} streetMap={streetMap} selectedBlocks={selectedBlocks} activeZone={activeZona} />
            <div className="hojas-ruta-mini-map">
              {zoneMap?.ubigeo === activeUbigeo ? (
                <ZoneGeometryMap
                  zoneMap={zoneMap}
                  selectedBlocks={selectedBlocks}
                  activeZona={activeZona}
                  compact
                />
              ) : (
                <LimaCoverageMap
                  territories={territories}
                  selected={selected}
                  activeUbigeo={activeUbigeo}
                  compact
                  selectionMode={false}
                  onFocus={onFocus}
                />
              )}
            </div>
          </div>
        ) : showingZones && zoneMap ? (
          <div className="hojas-ruta-block-stage">
            {zoneMap.alerts.map((a) => (
              <Alert key={`${a.code}:${a.message}`} kind={alertKind(a.level)}>{a.message}</Alert>
            ))}
            <ZoneGeometryMap
              zoneMap={zoneMap}
              selectedBlocks={selectedBlocks}
              activeZona={activeZona}
              onOpenZone={onOpenZone}
            />
          </div>
        ) : (
          <LimaCoverageMap
            territories={territories}
            selected={enableMapSelection && mapSelectionMode ? draft : selected}
            activeUbigeo={activeUbigeo}
            selectionMode={enableMapSelection && mapSelectionMode}
            onFocus={onFocus}
            onToggleSelection={onToggleDraft}
          />
        )}
      </div>
    </div>
  );
}

function AgeRangesEditor({
  ranges,
  onChange,
}: {
  ranges: HojasRutaAgeRange[];
  onChange: (ranges: HojasRutaAgeRange[]) => void;
}) {
  function updateRange(index: number, patch: Partial<HojasRutaAgeRange>) {
    onChange(ranges.map((r, i) => {
      if (i !== index) return r;
      const next = { ...r, ...patch };
      const max = next.max == null ? null : Number(next.max);
      const label = max == null ? `${next.min}+` : `${next.min}-${max}`;
      return { ...next, max, label, id: label.replace(/[^0-9A-Za-z]+/g, "_").replace(/^_|_$/g, "") };
    }));
  }

  function removeRange(index: number) {
    if (ranges.length <= 1) return;
    onChange(ranges.filter((_, i) => i !== index));
  }

  function addRange() {
    const last = ranges[ranges.length - 1];
    const min = last?.max != null ? Number(last.max) + 1 : Number(last?.min ?? 65) + 10;
    onChange([...ranges, { id: `${min}_plus`, label: `${min}+`, min, max: null }]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {ranges.map((r, index) => (
        <div key={`${r.id}:${index}`} style={{ display: "grid", gridTemplateColumns: "minmax(70px, 1fr) 86px 86px 32px", gap: 8, alignItems: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--pulso-text)" }}>{r.label}</div>
          <input
            style={fieldStyle}
            type="number"
            min={0}
            value={numberValue(r.min)}
            onChange={(e) => updateRange(index, { min: Math.max(0, Number(e.target.value || 0)) })}
            aria-label={`Edad minima ${r.label}`}
          />
          <input
            style={fieldStyle}
            type="number"
            min={r.min}
            placeholder="+"
            value={numberValue(r.max)}
            onChange={(e) => updateRange(index, { max: e.target.value ? Math.max(r.min, Number(e.target.value)) : null })}
            aria-label={`Edad maxima ${r.label}`}
          />
          <button
            type="button"
            onClick={() => removeRange(index)}
            disabled={ranges.length <= 1}
            title="Eliminar rango"
            style={{ border: "1px solid var(--pulso-border)", background: "white", borderRadius: 6, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: ranges.length <= 1 ? "not-allowed" : "pointer" }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button type="button" onClick={addRange} style={{ ...btnSecondary, alignSelf: "flex-start", padding: "6px 10px", fontSize: 12 }}>
        <Plus size={13} /> Agregar rango
      </button>
    </div>
  );
}

function SamplingMethodExplainer({
  value,
  onChange,
}: {
  value: SamplingMethod;
  onChange: (method: SamplingMethod) => void;
}) {
  const methods: { id: SamplingMethod; title: string; body: string; accent: string }[] = [
    {
      id: "pps",
      title: "PPS estratificado",
      body: "Cada distrito compite dentro de su estrato; una manzana con mas viviendas tiene mas probabilidad.",
      accent: "#0f766e",
    },
    {
      id: "sistematico",
      title: "Sistematico",
      body: "Ordena las manzanas, calcula un salto y arranca desde una posicion aleatoria reproducible.",
      accent: "#1d4ed8",
    },
    {
      id: "conglomerado_fijo",
      title: "Conglomerado fijo",
      body: "Reduce traslados: selecciona menos manzanas y asigna una carga estable de entrevistas.",
      accent: "#7c3aed",
    },
  ];

  function Diagram({ method, accent }: { method: SamplingMethod; accent: string }) {
    if (method === "pps") {
      return (
        <svg viewBox="0 0 120 36" aria-hidden="true" style={{ width: "100%", height: 36 }}>
          {[12, 34, 62, 96].map((x, i) => (
            <circle key={x} cx={x} cy={18} r={[5, 8, 12, 16][i]} fill={i === 3 ? accent : "#dbe7e3"} stroke={accent} strokeWidth="1.4" />
          ))}
        </svg>
      );
    }
    if (method === "sistematico") {
      return (
        <svg viewBox="0 0 120 36" aria-hidden="true" style={{ width: "100%", height: 36 }}>
          <line x1="8" x2="112" y1="18" y2="18" stroke="#cbd5e1" strokeWidth="2" />
          {[18, 46, 74, 102].map((x) => (
            <g key={x}>
              <line x1={x} x2={x} y1="9" y2="27" stroke={accent} strokeWidth="2.4" />
              <circle cx={x} cy={18} r="4" fill="white" stroke={accent} strokeWidth="2" />
            </g>
          ))}
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 120 36" aria-hidden="true" style={{ width: "100%", height: 36 }}>
        {[12, 42, 72, 102].map((x, i) => (
          <rect key={x} x={x} y={8 + (i % 2) * 4} width="18" height="18" rx="3" fill={i < 3 ? accent : "#e2e8f0"} opacity={i < 3 ? 0.9 : 1} />
        ))}
        <path d="M30 17H40 M60 21H70 M90 17H100" stroke="#94a3b8" strokeWidth="1.8" />
      </svg>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
      {methods.map((method) => {
        const active = method.id === value;
        return (
          <button
            key={method.id}
            type="button"
            onClick={() => onChange(method.id)}
            style={{
              border: `1px solid ${active ? method.accent : "var(--pulso-border)"}`,
              background: active ? "#f8fffc" : "white",
              borderRadius: 8,
              padding: 10,
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <Diagram method={method.id} accent={method.accent} />
            <span style={{ display: "block", marginTop: 6, fontSize: 12, fontWeight: 850, color: "var(--pulso-text)" }}>{method.title}</span>
            <span style={{ display: "block", marginTop: 4, fontSize: 11, lineHeight: 1.35, color: "var(--pulso-text-soft)" }}>{method.body}</span>
          </button>
        );
      })}
    </div>
  );
}

type MatrixAgeValues = { Hombre: number; Mujer: number; Total: number; cuota: number };
type MatrixRow = {
  territorio: string;
  ubigeo: string;
  totalPopulation: number;
  totalQuota: number;
  ages: Map<string, MatrixAgeValues>;
};

function buildPopulationMatrix(cells: Record<string, string | number | null>[]) {
  const totalPopulation = cells.reduce((sum, row) => sum + Number(row.poblacion ?? 0), 0);
  const ageGroups = Array.from(new Set(cells.map((row) => String(row.rango_edad ?? "")).filter(Boolean)));
  const hasSexBreakdown = cells.some((row) => ["Hombre", "Mujer"].includes(String(row.sexo ?? "")));
  const totalAgeValues = new Map<string, MatrixAgeValues>();
  const matrixRows = Array.from(cells.reduce((map, row) => {
    const territorio = String(row.territorio ?? "");
    const rango = String(row.rango_edad ?? "");
    const sexo = String(row.sexo ?? "Total");
    const ubigeo = String(row.ubigeo ?? "");
    if (!territorio || !rango) return map;
    if (!map.has(territorio)) {
      map.set(territorio, {
        territorio,
        ubigeo,
        totalPopulation: 0,
        totalQuota: 0,
        ages: new Map<string, MatrixAgeValues>(),
      });
    }
    const item = map.get(territorio)!;
    if (!item.ubigeo && ubigeo) item.ubigeo = ubigeo;
    if (!item.ages.has(rango)) item.ages.set(rango, { Hombre: 0, Mujer: 0, Total: 0, cuota: 0 });
    const age = item.ages.get(rango)!;
    const population = Number(row.poblacion ?? 0);
    if (sexo === "Hombre") age.Hombre += population;
    else if (sexo === "Mujer") age.Mujer += population;
    else age.Total += population;
    age.cuota += Number(row.cuota ?? 0);
    item.totalPopulation += population;
    item.totalQuota += Number(row.cuota ?? 0);

    if (!totalAgeValues.has(rango)) totalAgeValues.set(rango, { Hombre: 0, Mujer: 0, Total: 0, cuota: 0 });
    const totalAge = totalAgeValues.get(rango)!;
    if (sexo === "Hombre") totalAge.Hombre += population;
    else if (sexo === "Mujer") totalAge.Mujer += population;
    else totalAge.Total += population;
    totalAge.cuota += Number(row.cuota ?? 0);

    return map;
  }, new Map<string, MatrixRow>()).values());
  const totalQuota = matrixRows.reduce((sum, row) => sum + row.totalQuota, 0);
  return { totalPopulation, totalQuota, ageGroups, hasSexBreakdown, matrixRows, totalAgeValues };
}

function inverseStandardNormal(p: number) {
  // Acklam's algorithm — buena precisión para qnorm sin dependencias.
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number, r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= pHigh) {
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
          ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

function computeMarginError(
  population: number,
  n: number,
  settings: HojasRutaSampleSizeConfig,
  ubigeo?: string,
): number | null {
  if (!Number.isFinite(population) || !Number.isFinite(n) || population <= 0 || n <= 0) return null;
  const z = inverseStandardNormal((1 + settings.confidence_level) / 2);
  const pq = settings.expected_proportion * (1 - settings.expected_proportion);
  const overrides = settings.design_effect_overrides ?? {};
  const deff = ubigeo && overrides[ubigeo] != null && Number.isFinite(overrides[ubigeo])
    ? Math.max(0.1, overrides[ubigeo])
    : Math.max(0.1, settings.design_effect);
  const fpc = settings.apply_fpc && population > 1
    ? Math.sqrt(Math.max(0, (population - Math.min(n, population)) / (population - 1)))
    : 1;
  return z * Math.sqrt(deff * pq / n) * fpc;
}

function reviewCellClass(header: string, value: unknown) {
  const normalized = header.toLowerCase();
  const classes = [];
  if (typeof value === "number") classes.push("is-number");
  if (/(id|ubigeo|zona|semilla)/.test(normalized)) classes.push("is-code");
  if (/(territorio|distrito)/.test(normalized)) classes.push("is-strong");
  return classes.join(" ") || undefined;
}

function PopulationMatrixPreview({
  population,
  actions,
}: {
  population: PopulationPlan | null;
  actions?: React.ReactNode;
}) {
  const cells = population?.cells ?? [];
  const { totalPopulation, ageGroups, hasSexBreakdown, matrixRows, totalAgeValues } = buildPopulationMatrix(cells);
  if (!population || !cells.length) {
    return (
      <div className="hojas-ruta-pop-preview is-empty">
        Confirma distritos y calcula la poblacion base para ver la matriz INEI 2017 antes de definir el N.
      </div>
    );
  }
  return (
    <div className="hojas-ruta-pop-preview">
      <div className="hojas-ruta-pop-toolbar">
        <div>
          <div className="hojas-ruta-pop-title">Matriz poblacional</div>
          <div className="hojas-ruta-pop-caption">Base INEI 2017 segun distritos y cortes activos.</div>
        </div>
        {actions}
      </div>
      <div className="hojas-ruta-pop-summary">
        <div>
          <span>Poblacion base</span>
          <strong>{formatNumber(Math.round(totalPopulation))}</strong>
        </div>
        <div>
          <span>Distritos</span>
          <strong>{formatNumber(matrixRows.length)}</strong>
        </div>
        <div>
          <span>Celdas</span>
          <strong>{formatNumber(cells.length)}</strong>
        </div>
        <div>
          <span>Fuente</span>
          <strong>{population.age_source?.type?.startsWith("edad_simple_c5p41") ? "INEI 2017" : "Aproximada"}</strong>
        </div>
      </div>
      <div className="hojas-ruta-pop-table">
        <table aria-label="Matriz poblacional INEI 2017">
          <thead>
            <tr>
              <th className="is-district-head" rowSpan={2}>Distrito</th>
              {ageGroups.map((age) => (
                <th key={age} className="is-age-head" colSpan={hasSexBreakdown ? 2 : 1}>{age}</th>
              ))}
              <th className="is-total-head is-final-sticky" rowSpan={2}>Poblacion</th>
            </tr>
            <tr>
              {ageGroups.flatMap((age) => hasSexBreakdown
                ? [<th key={`${age}:h`} className="is-sub-head">Hombres</th>, <th key={`${age}:m`} className="is-sub-head">Mujeres</th>]
                : [<th key={`${age}:total`} className="is-sub-head">Total</th>])}
            </tr>
          </thead>
          <tbody>
            {matrixRows.map((row) => {
              return (
                <tr key={row.territorio}>
                  <td className="is-row-label">{row.territorio}</td>
                  {ageGroups.flatMap((age) => {
                    const values = row.ages.get(age) ?? { Hombre: 0, Mujer: 0, Total: 0 };
                    return hasSexBreakdown
                      ? [
                        <td key={`${row.territorio}:${age}:h`} className="is-number">{formatNumber(Math.round(values.Hombre))}</td>,
                        <td key={`${row.territorio}:${age}:m`} className="is-number">{formatNumber(Math.round(values.Mujer))}</td>,
                      ]
                      : [<td key={`${row.territorio}:${age}:total`} className="is-number">{formatNumber(Math.round(values.Total))}</td>];
                  })}
                  <td className="is-number is-total is-final-sticky">{formatNumber(Math.round(row.totalPopulation))}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="is-row-label">Total general</td>
              {ageGroups.flatMap((age) => {
                const values = totalAgeValues.get(age) ?? { Hombre: 0, Mujer: 0, Total: 0, cuota: 0 };
                return hasSexBreakdown
                  ? [
                    <td key={`total:${age}:h`} className="is-number">{formatNumber(Math.round(values.Hombre))}</td>,
                    <td key={`total:${age}:m`} className="is-number">{formatNumber(Math.round(values.Mujer))}</td>,
                  ]
                  : [<td key={`total:${age}:total`} className="is-number">{formatNumber(Math.round(values.Total))}</td>];
              })}
              <td className="is-number is-total is-final-sticky">{formatNumber(Math.round(totalPopulation))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="hojas-ruta-percent-block">
        <div>
          <div className="hojas-ruta-pop-title">Distribucion proporcional</div>
          <div className="hojas-ruta-pop-caption">Porcentajes dentro de cada distrito y proporcion del marco confirmado.</div>
        </div>
        <div className="hojas-ruta-pop-table is-percent">
          <table aria-label="Distribucion proporcional de la matriz poblacional">
            <thead>
              <tr>
                <th className="is-district-head" rowSpan={2}>Distrito</th>
                {ageGroups.map((age) => (
                  <th key={age} className="is-age-head" colSpan={hasSexBreakdown ? 2 : 1}>{age}</th>
                ))}
                <th className="is-total-head is-final-sticky" rowSpan={2}>Proporcion del marco</th>
              </tr>
              <tr>
                {ageGroups.flatMap((age) => hasSexBreakdown
                  ? [<th key={`${age}:h:pct`} className="is-sub-head">Hombres</th>, <th key={`${age}:m:pct`} className="is-sub-head">Mujeres</th>]
                  : [<th key={`${age}:total:pct`} className="is-sub-head">Total</th>])}
              </tr>
            </thead>
            <tbody>
              {matrixRows.map((row) => (
                <tr key={`${row.territorio}:pct`}>
                  <td className="is-row-label">{row.territorio}</td>
                  {ageGroups.flatMap((age) => {
                    const values = row.ages.get(age) ?? { Hombre: 0, Mujer: 0, Total: 0 };
                    return hasSexBreakdown
                      ? [
                        <td key={`${row.territorio}:${age}:h:pct`} className="is-number">{formatPercent(values.Hombre, row.totalPopulation)}</td>,
                        <td key={`${row.territorio}:${age}:m:pct`} className="is-number">{formatPercent(values.Mujer, row.totalPopulation)}</td>,
                      ]
                      : [<td key={`${row.territorio}:${age}:total:pct`} className="is-number">{formatPercent(values.Total, row.totalPopulation)}</td>];
                  })}
                  <td className="is-number is-total is-final-sticky">{formatPercent(row.totalPopulation, totalPopulation)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="is-row-label">Total general</td>
                {ageGroups.flatMap((age) => {
                  const values = totalAgeValues.get(age) ?? { Hombre: 0, Mujer: 0, Total: 0, cuota: 0 };
                  return hasSexBreakdown
                    ? [
                      <td key={`total:${age}:h:pct`} className="is-number">{formatPercent(values.Hombre, totalPopulation)}</td>,
                      <td key={`total:${age}:m:pct`} className="is-number">{formatPercent(values.Mujer, totalPopulation)}</td>,
                    ]
                    : [<td key={`total:${age}:total:pct`} className="is-number">{formatPercent(values.Total, totalPopulation)}</td>];
                })}
                <td className="is-number is-total is-final-sticky">{formatPercent(totalPopulation, totalPopulation)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <div className="hojas-ruta-pop-footnote">
        Esta vista no usa N de encuestas: solo muestra la poblacion base para decidir la muestra con mejor contexto.
      </div>
    </div>
  );
}

function QuotaMatrixPreview({
  quota,
  sampleSizePreview,
}: {
  quota: QuotaPlan | null;
  sampleSizePreview: HojasRutaSampleSizePreview | null;
}) {
  const cells = quota?.cells ?? [];
  const { totalPopulation, totalQuota, ageGroups, hasSexBreakdown, matrixRows, totalAgeValues } = buildPopulationMatrix(cells);
  if (!quota || !cells.length) {
    return (
      <div className="hojas-ruta-pop-preview is-empty">
        Define el N y calcula cuotas para ver como se reparte la muestra sobre la poblacion base.
      </div>
    );
  }
  const districtDiagByUbigeo = new Map(
    (sampleSizePreview?.district_rows ?? []).map((d) => [d.ubigeo, d]),
  );
  const districtDiagByName = new Map(
    (sampleSizePreview?.district_rows ?? []).map((d) => [d.distrito, d]),
  );
  const sampleSettings = normalizeSampleSizeSettings(
    sampleSizePreview?.sample_size ?? quota.config.sample_size,
  );
  const targetMargin = sampleSettings.margin_district;
  const territoryPopByUbigeo = new Map(
    (quota.territories ?? []).map((t) => [t.ubigeo, Number(t.poblacion ?? 0)]),
  );
  const totalFramePopulation = (quota.territories ?? []).reduce(
    (sum, t) => sum + Number(t.poblacion ?? 0),
    0,
  ) || totalPopulation;
  const totalMarginEstimated = sampleSizePreview?.margin_total_estimated
    ?? computeMarginError(totalFramePopulation, totalQuota, sampleSettings);
  return (
    <div className="hojas-ruta-pop-preview">
      <div className="hojas-ruta-pop-toolbar">
        <div>
          <div className="hojas-ruta-pop-title">Poblacion y cuotas</div>
          <div className="hojas-ruta-pop-caption">Cada fila conserva poblacion base, N asignado y precisión estimada.</div>
        </div>
        <StatusPill ok={quota.ok} text={`${formatNumber(quota.total_asignado)} / ${formatNumber(quota.n_objetivo)} encuestas`} />
      </div>
      <div className="hojas-ruta-pop-summary">
        <div>
          <span>Poblacion base</span>
          <strong>{formatNumber(Math.round(totalPopulation))}</strong>
        </div>
        <div>
          <span>N final</span>
          <strong>{formatNumber(quota.total_asignado)}</strong>
        </div>
        <div>
          <span>Precisión total</span>
          <strong>{totalMarginEstimated != null ? formatRate(totalMarginEstimated) : "—"}</strong>
        </div>
        <div>
          <span>Fuente</span>
          <strong>{quota.age_source?.type?.startsWith("edad_simple_c5p41") ? "INEI 2017" : "Aproximada"}</strong>
        </div>
      </div>
      <div className="hojas-ruta-pop-table">
        <table aria-label="Matriz de poblacion y cuotas">
          <thead>
            <tr>
              <th className="is-district-head" rowSpan={2}>Distrito</th>
              {ageGroups.map((age) => (
                <th key={age} className="is-age-head" colSpan={hasSexBreakdown ? 2 : 1}>{age}</th>
              ))}
              <th className="is-total-head" rowSpan={2}>Poblacion</th>
              <th className="is-total-head" rowSpan={2}>N asignado</th>
              <th
                className="is-total-head is-final-sticky"
                rowSpan={2}
                title={targetMargin != null ? `Objetivo: ±${(targetMargin * 100).toFixed(1)}%` : undefined}
              >
                Precisión
              </th>
            </tr>
            <tr>
              {ageGroups.flatMap((age) => hasSexBreakdown
                ? [<th key={`${age}:h`} className="is-sub-head">Hombres</th>, <th key={`${age}:m`} className="is-sub-head">Mujeres</th>]
                : [<th key={`${age}:total`} className="is-sub-head">Total</th>])}
            </tr>
          </thead>
          <tbody>
            {matrixRows.map((row) => {
              const diag = (row.ubigeo ? districtDiagByUbigeo.get(row.ubigeo) : undefined)
                ?? districtDiagByName.get(row.territorio)
                ?? null;
              const populationForMargin = (row.ubigeo ? territoryPopByUbigeo.get(row.ubigeo) : undefined)
                ?? row.totalPopulation;
              const margin = diag?.margin_estimated
                ?? computeMarginError(populationForMargin, row.totalQuota, sampleSettings, row.ubigeo);
              const overTarget = margin != null && targetMargin != null && margin > targetMargin + 1e-9;
              return (
                <tr key={row.territorio}>
                  <td className="is-row-label">{row.territorio}</td>
                  {ageGroups.flatMap((age) => {
                    const values = row.ages.get(age) ?? { Hombre: 0, Mujer: 0, Total: 0, cuota: 0 };
                    return hasSexBreakdown
                      ? [
                        <td key={`${row.territorio}:${age}:h`} className="is-number">{formatNumber(Math.round(values.Hombre))}</td>,
                        <td key={`${row.territorio}:${age}:m`} className="is-number">{formatNumber(Math.round(values.Mujer))}</td>,
                      ]
                      : [<td key={`${row.territorio}:${age}:total`} className="is-number">{formatNumber(Math.round(values.Total))}</td>];
                  })}
                  <td className="is-number is-total">{formatNumber(Math.round(row.totalPopulation))}</td>
                  <td className="is-number is-total">{formatNumber(Math.round(row.totalQuota))}</td>
                  <td className={`is-number is-total is-final-sticky${overTarget ? " is-warn" : ""}`}>
                    {margin != null ? formatRate(margin) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="is-row-label">Total general</td>
              {ageGroups.flatMap((age) => {
                const values = totalAgeValues.get(age) ?? { Hombre: 0, Mujer: 0, Total: 0, cuota: 0 };
                return hasSexBreakdown
                  ? [
                    <td key={`quota-total:${age}:h`} className="is-number">{formatNumber(Math.round(values.Hombre))}</td>,
                    <td key={`quota-total:${age}:m`} className="is-number">{formatNumber(Math.round(values.Mujer))}</td>,
                  ]
                  : [<td key={`quota-total:${age}:total`} className="is-number">{formatNumber(Math.round(values.Total))}</td>];
              })}
              <td className="is-number is-total">{formatNumber(Math.round(totalPopulation))}</td>
              <td className="is-number is-total">{formatNumber(Math.round(totalQuota))}</td>
              <td className="is-number is-total is-final-sticky">
                {totalMarginEstimated != null ? formatRate(totalMarginEstimated) : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="hojas-ruta-pop-footnote">
        Precisión = margen de error estimado al nivel de confianza configurado, con DEFF y FPC aplicados.
        {targetMargin != null ? ` Objetivo distrital: ±${(targetMargin * 100).toFixed(1)}%.` : ""}
        {sampleSizePreview ? "" : " Calcula la muestra (paso anterior) para ver el detalle."}
      </div>
    </div>
  );
}

function SampleSizeWorkbench({
  config,
  territories,
  preview,
  busy,
  canQuota,
  routeStatus,
  onModeChange,
  onSampleSizeChange,
  onRouteSizeChange,
  onTotalNChange,
  onDistrictNChange,
  onDistrictNPaste,
  onSuggestDistrictN,
  onUseRecommendedN,
  onUseSuggestedDistrictN,
  onPreviewSampleSize,
  onPreviewQuota,
  onDeffOverrideChange,
  onMarginOverrideChange,
}: {
  config: HojasRutaIntegratedConfig;
  territories: HojasRutaState["territories"];
  preview: HojasRutaSampleSizePreview | null;
  busy: string;
  canQuota: boolean;
  routeStatus: RouteMultipleStatus;
  onModeChange: (mode: SampleSizeMode) => void;
  onSampleSizeChange: (patch: Partial<HojasRutaSampleSizeConfig>) => void;
  onRouteSizeChange: (value: number) => void;
  onTotalNChange: (value: number) => void;
  onDistrictNChange: (ubigeo: string, value: number) => void;
  onDistrictNPaste: (startUbigeo: string, text: string) => void;
  onSuggestDistrictN: () => void;
  onUseRecommendedN: () => void;
  onUseSuggestedDistrictN: () => void;
  onPreviewSampleSize: () => void;
  onPreviewQuota: () => void;
  onDeffOverrideChange: (ubigeo: string, value: number | null) => void;
  onMarginOverrideChange: (ubigeo: string, value: number | null) => void;
}) {
  const settings = normalizeSampleSizeSettings(config.sample_size);
  const mode = config.sample_size_mode ?? "calculator";
  const districtRowsByUbigeo = new Map((preview?.district_rows ?? []).map((row) => [row.ubigeo, row]));
  const nDistrictTotal = Object.values(config.n_por_distrito ?? {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const modeCopy = {
    calculator: {
      title: "Prosecnur calcula el N",
      detail: "Usa precisión, confianza y respuesta esperada para decidir el tamaño.",
    },
    external_total: {
      title: "Tengo un N total",
      detail: "Si la muestra ya fue aprobada, Prosecnur la reparte y diagnostica.",
    },
    external_district: {
      title: "Tengo N por distrito",
      detail: "Cada distrito ya tiene meta propia. Prosecnur la respeta y diagnostica.",
    },
  } satisfies Record<SampleSizeMode, { title: string; detail: string }>;
  const designPresets = [
    { label: "PPS", value: 1.5, hint: "recomendado" },
    { label: "Sistemático", value: 1.1, hint: "más parejo" },
    { label: "Conglomerado", value: 2.0, hint: "más conservador" },
  ];
  const precisionTotalPct = percentInput(settings.margin_total);
  const districtAlertPct = percentInput(settings.margin_district);
  const confidencePct = percentInput(settings.confidence_level);
  const responsePct = percentInput(settings.response_rate);
  const precisionTone = settings.margin_total <= 0.05 ? "ok" : settings.margin_total <= 0.08 ? "info" : "warn";
  const designTone = settings.design_effect >= 1 ? "ok" : "warn";
  const responseTone = settings.response_rate >= 0.75 ? "ok" : settings.response_rate >= 0.55 ? "info" : "warn";
  const proportionTone = settings.expected_proportion >= 0.35 && settings.expected_proportion <= 0.65 ? "ok" : "info";
  const allocationMode = settings.allocation_mode ?? "proportional";
  const enforceFloor = settings.enforce_district_floor ?? true;
  const overrides = settings.design_effect_overrides ?? {};
  const marginOverrides = settings.margin_district_overrides ?? {};
  const overrideCount = Object.keys(overrides).length + Object.keys(marginOverrides).length;
  const nUsed = preview?.n_used ?? 0;
  const nRecommended = preview?.n_recommended ?? 0;
  const nRecommendedRoute = preview?.n_recommended_route ?? Math.ceil(Math.max(1, nRecommended) / routeStatus.routeSize) * routeStatus.routeSize;
  const nTotalMin = preview?.n_total_min ?? 0;
  const nDistrictFloor = preview?.n_district_floor ?? 0;
  const districtFloorBinds = nDistrictFloor > nTotalMin && enforceFloor;
  const contactsSuggested = preview?.contacts_suggested ?? 0;
  // Valores de la fórmula para mostrar en vivo
  const zScore = inverseStandardNormal((1 + settings.confidence_level) / 2);
  const pq = settings.expected_proportion * (1 - settings.expected_proportion);
  const nSrs = (zScore * zScore * pq) / (settings.margin_total * settings.margin_total);
  const nDesign = nSrs * settings.design_effect;

  function setPercent(key: keyof HojasRutaSampleSizeConfig, value: string) {
    onSampleSizeChange({ [key]: Math.max(0, Number(value || 0)) / 100 } as Partial<HojasRutaSampleSizeConfig>);
  }

  return (
    <Panel title="Define la muestra" eyebrow="N, precisión y campo">
      <div className="hojas-ruta-sample-size-shell">
        <div className="hojas-ruta-sample-mode-cards" role="tablist" aria-label="Modo de muestra">
          {(["calculator", "external_total", "external_district"] as SampleSizeMode[]).map((item) => (
            <button
              key={item}
              type="button"
              className={mode === item ? "is-active" : ""}
              onClick={() => onModeChange(item)}
            >
              <strong>{modeCopy[item].title}</strong>
              <span>{modeCopy[item].detail}</span>
            </button>
          ))}
        </div>

        <div className="hojas-ruta-sample-size-grid">
          <section className="hojas-ruta-sample-size-config" aria-label="Parametros de muestra">
            <div className="hojas-ruta-sample-size-heading">
              <strong>{mode === "calculator" ? "Calculadora guiada" : "Diagnóstico del N ingresado"}</strong>
              <span>{modeCopy[mode].detail}</span>
            </div>

            {mode === "external_total" && (
              <div className="hojas-ruta-form-grid is-compact">
                <SampleControl
                  label="Encuestas completas aprobadas"
                  suffix="N"
                  hint="Prosecnur lo reparte entre los distritos seleccionados según el modo de asignación elegido."
                >
                  <input
                    style={fieldStyle}
                    type="number"
                    min={1}
                    value={config.n_objetivo}
                    onChange={(e) => onTotalNChange(Math.max(1, Number(e.target.value || 1)))}
                  />
                </SampleControl>
              </div>
            )}

            {mode === "external_district" && (
              <div className="hojas-ruta-sample-district-table">
                <div className="hojas-ruta-action-row is-tight">
                  <button type="button" style={btnSecondary} onClick={onSuggestDistrictN}>
                    Sugerir desde población
                  </button>
                  {preview ? (
                    <button type="button" style={btnSecondary} onClick={onUseSuggestedDistrictN}>
                      Usar sugerencia Prosecnur
                    </button>
                  ) : null}
                  <StatusPill ok={nDistrictTotal > 0} text={`${formatNumber(nDistrictTotal)} encuestas`} />
                </div>
                <p className="hojas-ruta-sample-note">
                  Escribe distrito por distrito o pega una columna desde Excel/Sheets. Prosecnur respeta tu N y solo
                  diagnostica si queda muy bajo o impreciso.
                </p>
                <div className="hojas-ruta-review-table-wrap is-compact">
                  <table className="hojas-ruta-review-table">
                    <thead>
                      <tr>
                        <th>Distrito</th>
                        <th>Población</th>
                        <th>N externo</th>
                        <th>Precisión esperada</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {territories.map((t) => {
                        const diagnostic = districtRowsByUbigeo.get(t.ubigeo);
                        const nValue = config.n_por_distrito?.[t.ubigeo] ?? 0;
                        return (
                          <tr key={t.ubigeo}>
                            <td className="is-strong">{t.distrito}</td>
                            <td className="is-number">{formatNumber(t.poblacion)}</td>
                            <td className="is-number">
                              <input
                                className="hojas-ruta-table-input"
                                type="number"
                                min={0}
                                value={nValue}
                                onChange={(e) => onDistrictNChange(t.ubigeo, Number(e.target.value || 0))}
                                onPaste={(e) => {
                                  const text = e.clipboardData.getData("text");
                                  if (text.includes("\n") || text.includes("\t")) {
                                    e.preventDefault();
                                    onDistrictNPaste(t.ubigeo, text);
                                  }
                                }}
                              />
                            </td>
                            <td className="is-number">{diagnostic ? formatRate(diagnostic.margin_estimated) : "Sin calcular"}</td>
                            <td>
                              <StatusPill ok={diagnostic?.status === "ok"} text={diagnostic?.message ?? "Pendiente"} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="hojas-ruta-sample-setting-group">
              <div className="hojas-ruta-sample-setting-title">
                <strong>Rutas completas</strong>
                <span>Cada manzana seleccionada recibirá exactamente esta carga de encuestas.</span>
              </div>
              <div className="hojas-ruta-form-grid is-compact">
                <SampleControl
                  label="Encuestas por ruta"
                  suffix="por manzana"
                  hint="El N total o el N de cada distrito debe ser múltiplo de este valor."
                >
                  <input
                    style={fieldStyle}
                    type="number"
                    min={1}
                    value={config.entrevistas_por_manzana}
                    onChange={(e) => {
                      const value = Math.max(1, Math.round(Number(e.target.value || 1)));
                      onRouteSizeChange(value);
                    }}
                    aria-label="Encuestas por ruta"
                  />
                </SampleControl>
                <div className={`hojas-ruta-route-check${routeStatus.ok ? " is-ok" : " is-error"}`}>
                  <strong>{routeStatus.ok ? "N compatible" : "N no calza"}</strong>
                  <span>{routeStatus.message}</span>
                </div>
              </div>
            </div>

            <div className="hojas-ruta-sample-setting-group">
              <div className="hojas-ruta-sample-setting-title">
                <strong>1. Precisión que quieres lograr</strong>
                <span>Mientras más exigente seas, mayor será el N recomendado.</span>
              </div>
              <div className="hojas-ruta-form-grid">
                <SampleControl label="Confianza" suffix="%" hint="95% es el estándar para estudios serios.">
                  <input
                    style={fieldStyle}
                    type="number"
                    min={50}
                    max={99.9}
                    step={0.1}
                    value={percentInput(settings.confidence_level)}
                    onChange={(e) => setPercent("confidence_level", e.target.value)}
                  />
                </SampleControl>
                <SampleControl label="Precisión total" suffix="± %" hint={`Ahora: ±${precisionTotalPct} pts para el estudio completo.`}>
                  <input
                    style={fieldStyle}
                    type="number"
                    min={0.1}
                    max={50}
                    step={0.1}
                    value={percentInput(settings.margin_total)}
                    onChange={(e) => setPercent("margin_total", e.target.value)}
                  />
                </SampleControl>
                <SampleControl label="Precisión por distrito" suffix="± %" hint={enforceFloor ? `Garantizada: ±${districtAlertPct} pts en cada distrito.` : `Solo aviso: ±${districtAlertPct} pts.`}>
                  <input
                    style={fieldStyle}
                    type="number"
                    min={0.1}
                    max={80}
                    step={0.1}
                    value={percentInput(settings.margin_district)}
                    onChange={(e) => setPercent("margin_district", e.target.value)}
                  />
                </SampleControl>
              </div>
            </div>

            <div className="hojas-ruta-sample-setting-group">
              <div className="hojas-ruta-sample-setting-title">
                <strong>2. Supuestos de campo</strong>
                <span>Estos controles vuelven el cálculo más realista para encuestas en territorio.</span>
              </div>
              <div className="hojas-ruta-form-grid">
                <SampleControl label="Resultado esperado" suffix="%" hint="50% si no sabes; es el escenario más conservador.">
                  <input
                    style={fieldStyle}
                    type="number"
                    min={0.1}
                    max={99.9}
                    step={0.1}
                    value={percentInput(settings.expected_proportion)}
                    onChange={(e) => setPercent("expected_proportion", e.target.value)}
                  />
                </SampleControl>
                <SampleControl label="Diseño de campo (DEFF)" hint="1.0 es muestra simple; más alto exige más entrevistas.">
                  <input
                    style={fieldStyle}
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={settings.design_effect}
                    onChange={(e) => onSampleSizeChange({ design_effect: Math.max(0.1, Number(e.target.value || 0.1)) })}
                  />
                </SampleControl>
                <SampleControl label="Respuesta esperada" suffix="%" hint="Sirve para estimar contactos, no para cambiar cuotas.">
                  <input
                    style={fieldStyle}
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={percentInput(settings.response_rate)}
                    onChange={(e) => setPercent("response_rate", e.target.value)}
                  />
                </SampleControl>
              </div>
              <div className="hojas-ruta-design-presets" aria-label="Presets de diseño de campo">
                {designPresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className={Math.abs(settings.design_effect - preset.value) < 0.001 ? "is-active" : ""}
                    onClick={() => onSampleSizeChange({ design_effect: preset.value })}
                  >
                    <strong>{preset.label}</strong>
                    <span>Deff {preset.value.toFixed(1)} · {preset.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="hojas-ruta-sample-setting-group">
              <div className="hojas-ruta-sample-setting-title">
                <strong>3. Asignación entre distritos</strong>
                <span>Cómo se reparten las entrevistas entre los distritos del marco.</span>
              </div>
              <div className="hojas-ruta-allocation-cards" role="radiogroup" aria-label="Modo de asignación">
                {(Object.keys(ALLOCATION_LABELS) as AllocationMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={allocationMode === m}
                    className={allocationMode === m ? "is-active" : ""}
                    onClick={() => onSampleSizeChange({ allocation_mode: m })}
                  >
                    <strong>{ALLOCATION_LABELS[m].title}</strong>
                    <span>{ALLOCATION_LABELS[m].hint}</span>
                  </button>
                ))}
              </div>
              <label className="hojas-ruta-checkbox-row">
                <input
                  type="checkbox"
                  checked={enforceFloor}
                  onChange={(e) => onSampleSizeChange({ enforce_district_floor: e.target.checked })}
                />
                <span>
                  Garantizar precisión por distrito (recomendado).{" "}
                  <em>El N recomendado considerará el mínimo necesario en cada distrito.</em>
                </span>
              </label>
            </div>

            <button
              type="button"
              className="hojas-ruta-sample-toggle-advanced"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
            >
              <span>{showAdvanced ? "Ocultar" : "Ver"} ajustes avanzados</span>
              <em>
                Corrección por población finita · ajustes por distrito
                {overrideCount > 0 ? ` · ${overrideCount} distrito(s) ajustado(s)` : ""}
              </em>
            </button>

            {showAdvanced ? (
              <div className="hojas-ruta-sample-advanced">
                <label className="hojas-ruta-checkbox-row">
                  <input
                    type="checkbox"
                    checked={settings.apply_fpc}
                    onChange={(e) => onSampleSizeChange({ apply_fpc: e.target.checked })}
                  />
                  <span>Aplicar corrección por población finita (FPC).</span>
                </label>
                {territories.length > 0 ? (
                  <div className="hojas-ruta-sample-deff-overrides">
                    <div className="hojas-ruta-sample-setting-title">
                      <strong>Ajustes por distrito (opcional)</strong>
                      <span>
                        Si un distrito específico necesita más precisión o tiene un diseño de campo distinto,
                        ajústalo aquí. Deja en blanco para usar los valores generales.
                      </span>
                    </div>
                    <div className="hojas-ruta-review-table-wrap is-compact">
                      <table className="hojas-ruta-review-table">
                        <thead>
                          <tr>
                            <th>Distrito</th>
                            <th>Precisión general</th>
                            <th>Precisión ajustada (±%)</th>
                            <th>Diseño general</th>
                            <th>Diseño ajustado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {territories.map((t) => {
                            const currentDeff = overrides[t.ubigeo];
                            const currentMargin = marginOverrides[t.ubigeo];
                            return (
                              <tr key={t.ubigeo}>
                                <td className="is-strong">{t.distrito}</td>
                                <td className="is-number">±{districtAlertPct}%</td>
                                <td className="is-number">
                                  <input
                                    className="hojas-ruta-table-input"
                                    type="number"
                                    min={0.1}
                                    max={80}
                                    step={0.1}
                                    placeholder="—"
                                    value={currentMargin != null ? Number((currentMargin * 100).toFixed(2)) : ""}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      const value = raw === "" ? null : Math.max(0.001, Number(raw) / 100);
                                      onMarginOverrideChange(t.ubigeo, value);
                                    }}
                                  />
                                </td>
                                <td className="is-number">{settings.design_effect.toFixed(2)}</td>
                                <td className="is-number">
                                  <input
                                    className="hojas-ruta-table-input"
                                    type="number"
                                    min={0.1}
                                    max={20}
                                    step={0.1}
                                    placeholder="—"
                                    value={currentDeff ?? ""}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      const value = raw === "" ? null : Math.max(0.1, Number(raw));
                                      onDeffOverrideChange(t.ubigeo, value);
                                    }}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="hojas-ruta-method-note">
              <strong>Base técnica</strong>
              <span>
                Proporción binaria con confianza {confidencePct}%, varianza p(1-p), DEFF aplicado a la varianza
                {settings.apply_fpc ? ", FPC activo" : ""}. {enforceFloor
                  ? "Bi-objetivo: el N recomendado garantiza precisión total y precisión por distrito (lo que sea mayor)."
                  : "Sólo precisión total; la distrital se calcula como diagnóstico."}
              </span>
            </div>

            <details className="hojas-ruta-sample-tips">
              <summary>
                <strong>Guía rápida de decisión</strong>
              </summary>
              <div className="hojas-ruta-sample-advice">
                <SampleAdviceItem tone={precisionTone} label="Precisión total" value={`± ${precisionTotalPct}%`}>
                  {settings.margin_total <= 0.05
                    ? "Buen estándar para reportar el estudio completo."
                    : settings.margin_total <= 0.08
                      ? "Útil para lectura exploratoria; evita conclusiones muy finas."
                      : "Estudio total amplio. Sube el N si necesitas comparar diferencias pequeñas."}
                </SampleAdviceItem>
                <SampleAdviceItem tone={proportionTone} label="Resultado esperado" value={`${percentInput(settings.expected_proportion)}%`}>
                  {settings.expected_proportion >= 0.35 && settings.expected_proportion <= 0.65
                    ? "Rango conservador. Si no hay evidencia, 50% protege mejor el cálculo."
                    : "Úsalo si tienes evidencia previa; si no, vuelve a 50% para no subestimar el N."}
                </SampleAdviceItem>
                <SampleAdviceItem tone={designTone} label="Diseño de campo" value={`Deff ${settings.design_effect}`}>
                  {settings.design_effect < 1
                    ? "Optimista para campo territorial. Déjalo así con razón clara."
                    : settings.design_effect < 1.3
                      ? "Cerca de muestra simple; razonable para selección dispersa."
                      : settings.design_effect < 1.8
                        ? "Conservador moderado, apropiado para PPS."
                        : "Más conservador; protege cuando la muestra se concentra por manzanas."}
                </SampleAdviceItem>
                <SampleAdviceItem tone={responseTone} label="Respuesta esperada" value={`${responsePct}%`}>
                  {settings.response_rate >= 0.75
                    ? "Carga de contactos manejable para planificar campo."
                    : settings.response_rate >= 0.55
                      ? "Planifica reemplazos: necesitarás más contactos por encuesta completa."
                      : "Riesgo operativo alto. Las cuotas no cambian; los contactos sí crecen mucho."}
                </SampleAdviceItem>
              </div>
            </details>
          </section>

          <section className="hojas-ruta-sample-size-results" aria-label="Resultado de muestra">
            {preview ? (
              <>
                <div className="hojas-ruta-sample-result-hero">
                  <div className="hojas-ruta-sample-result-headline">
                    <span className="eyebrow">N usado para cuotas</span>
                    <strong>{formatNumber(nUsed)}</strong>
                    <small>encuestas efectivas a planificar</small>
                  </div>
                  {mode === "calculator" ? (
                    <button
                      type="button"
                      className="hojas-ruta-sample-result-cta"
                      onClick={onUseRecommendedN}
                      disabled={nUsed === nRecommendedRoute}
                    >
                      Usar N válido ({formatNumber(nRecommendedRoute)})
                    </button>
                  ) : null}
                </div>

                <div className="hojas-ruta-sample-result-breakdown">
                  <div className={districtFloorBinds ? "is-bind" : ""}>
                    <span>Mínimo para precisión total</span>
                    <strong>{formatNumber(nTotalMin)}</strong>
                    <small>para lograr ±{precisionTotalPct}% en el agregado</small>
                  </div>
                  <div className={districtFloorBinds ? "is-bind is-active" : ""}>
                    <span>Mínimo para precisión distrital</span>
                    <strong>{formatNumber(nDistrictFloor)}</strong>
                    <small>{enforceFloor ? `suma de mínimos por distrito (±${districtAlertPct}% c/u)` : "solo diagnóstico (no se aplica como piso)"}</small>
                  </div>
                  <div className="is-recommended">
                    <span>N recomendado por la calculadora</span>
                    <strong>{formatNumber(nRecommended)}</strong>
                    <small>{nRecommendedRoute !== nRecommended ? `siguiente N compatible con rutas: ${formatNumber(nRecommendedRoute)}` : districtFloorBinds ? "manda el piso distrital" : "manda la precisión total"}</small>
                  </div>
                  <div>
                    <span>Precisión total con el N usado</span>
                    <strong>{formatRate(preview.margin_total_estimated)}</strong>
                    <small>{nUsed >= nTotalMin ? "cumple el objetivo" : "queda por encima del objetivo"}</small>
                  </div>
                </div>

                <details className="hojas-ruta-sample-formula">
                  <summary>
                    <strong>¿De dónde sale este N?</strong>
                    <span>Ver el cálculo paso a paso con tus supuestos.</span>
                  </summary>
                  <div className="hojas-ruta-sample-formula-body">
                    <ol>
                      <li>
                        <span className="step">1. Tamaño en muestra simple</span>
                        <code>n = z² · p · q ÷ e²</code>
                        <em>
                          ({zScore.toFixed(3)})² × {settings.expected_proportion.toFixed(2)} × {(1 - settings.expected_proportion).toFixed(2)}
                          {" ÷ ("}{settings.margin_total.toFixed(3)}{")² = "}<strong>{Math.ceil(nSrs)}</strong>
                        </em>
                      </li>
                      <li>
                        <span className="step">2. Ajuste por diseño de campo (DEFF)</span>
                        <code>n × DEFF</code>
                        <em>
                          {Math.ceil(nSrs)} × {settings.design_effect.toFixed(2)} = <strong>{Math.ceil(nDesign)}</strong>
                        </em>
                      </li>
                      {settings.apply_fpc && nTotalMin !== Math.ceil(nDesign) ? (
                        <li>
                          <span className="step">3. Corrección por población finita (FPC)</span>
                          <code>N · n_design ÷ (N + n_design − 1)</code>
                          <em>
                            La población del marco reduce el N a <strong>{formatNumber(nTotalMin)}</strong>.
                          </em>
                        </li>
                      ) : null}
                      {enforceFloor && nDistrictFloor > nTotalMin ? (
                        <li className="is-bind">
                          <span className="step">{settings.apply_fpc ? "4" : "3"}. Piso por precisión distrital</span>
                          <code>max(n_total, Σ n_distrito_mínimo)</code>
                          <em>
                            Para garantizar la precisión por distrito (±{districtAlertPct}%),
                            la suma de los mínimos distritales ({formatNumber(nDistrictFloor)}) supera el N total ({formatNumber(nTotalMin)}).
                            Manda el piso distrital → <strong>{formatNumber(nRecommended)}</strong>.
                          </em>
                        </li>
                      ) : null}
                    </ol>
                    <p className="hojas-ruta-sample-formula-foot">
                      Cambiar la <strong>precisión</strong>, el <strong>resultado esperado (p)</strong>, el <strong>DEFF</strong> o
                      las <strong>precisiones por distrito</strong> recalcula este N.
                    </p>
                  </div>
                </details>

                <div className="hojas-ruta-sample-contacts">
                  <div>
                    <span className="eyebrow">Para campo</span>
                    <strong>{formatNumber(contactsSuggested)}</strong>
                    <small>intentos de contacto sugeridos</small>
                  </div>
                  <p>
                    Las {formatNumber(nUsed)} encuestas <em>efectivas</em> son tu cuota objetivo; los{" "}
                    {formatNumber(contactsSuggested)} <em>intentos</em> compensan la respuesta esperada de{" "}
                    {responsePct}%. La calculadora asume que la no-respuesta es uniforme; si esperas que varíe
                    fuerte por NSE o zona, considera ajustar manualmente.
                  </p>
                </div>

                {preview.alerts.length > 0 ? (
                  <div className="hojas-ruta-sample-alerts">
                    {preview.alerts.map((a) => (
                      <Alert key={`${a.code}:${a.message}`} kind={alertKind(a.level)}>{a.message}</Alert>
                    ))}
                  </div>
                ) : null}

                <div className="hojas-ruta-review-table-wrap is-compact">
                  <table className="hojas-ruta-review-table">
                    <thead>
                      <tr>
                        <th>Distrito</th>
                        <th>N usado</th>
                        <th>N mínimo</th>
                        <th>Precisión</th>
                        <th>DEFF</th>
                        <th>Fracción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.district_rows.map((row) => {
                        const belowFloor = row.n_used > 0 && row.n_used < row.n_min_district;
                        return (
                          <tr key={row.ubigeo} className={belowFloor ? "is-warn" : undefined}>
                            <td className="is-strong">{row.distrito}</td>
                            <td className="is-number">{formatNumber(row.n_used)}</td>
                            <td className="is-number">{formatNumber(row.n_min_district)}</td>
                            <td className="is-number">{formatRate(row.margin_estimated)}</td>
                            <td className="is-number">{row.design_effect?.toFixed(2) ?? settings.design_effect.toFixed(2)}</td>
                            <td className="is-number">{formatRate(row.sampling_fraction, 2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="hojas-ruta-pop-preview is-empty">
                Calcula el diagnóstico para ver el N recomendado, la precisión esperada, contactos sugeridos y alertas por distrito.
              </div>
            )}
          </section>
        </div>

        <div className="hojas-ruta-action-row">
          <button type="button" style={btnSecondary} onClick={onPreviewSampleSize} disabled={busy === "sample-size"}>
            {busy === "sample-size" ? <Loader2 size={14} className="pulso-spin" /> : <BarChart3 size={14} />}
            Revisar muestra
          </button>
          <button type="button" style={btnPrimary} onClick={onPreviewQuota} disabled={!canQuota || busy === "quota"}>
            {busy === "quota" ? <Loader2 size={14} className="pulso-spin" /> : <Target size={14} />}
            Calcular cuotas
          </button>
          <span className="hojas-ruta-soft-text">Las cuotas usan el N confirmado en esta pantalla.</span>
        </div>
      </div>
    </Panel>
  );
}

export default function HojasRutaPage() {
  const { sessionId } = useSession();
  const [state, setState] = useState<HojasRutaState | null>(null);
  const [config, setConfig] = useState<HojasRutaIntegratedConfig | null>(null);
  const [activeStage, setActiveStage] = useState<HojasRutaStage>("territorio");
  const [population, setPopulation] = useState<PopulationPlan | null>(null);
  const [populationExport, setPopulationExport] = useState<HojasRutaPopulationExportResult | null>(null);
  const [sampleSizePreview, setSampleSizePreview] = useState<HojasRutaSampleSizePreview | null>(null);
  const [quota, setQuota] = useState<QuotaPlan | null>(null);
  const [sample, setSample] = useState<HojasRutaSamplePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<HojasRutaJobResult | null>(null);
  const [mapUbigeo, setMapUbigeo] = useState<string>("");
  const [mapZona, setMapZona] = useState<string>("");
  const [mapLevel, setMapLevel] = useState<HojasRutaMapLevel>("distritos");
  const [zoneMap, setZoneMap] = useState<HojasRutaZoneMap | null>(null);
  const [blockMap, setBlockMap] = useState<HojasRutaBlockMap | null>(null);
  const [contextMap, setContextMap] = useState<HojasRutaContextMap | null>(null);
  const [streetMap, setStreetMap] = useState<HojasRutaStreetMap | null>(null);
  const [zoneMapLoading, setZoneMapLoading] = useState(false);
  const [blockMapLoading, setBlockMapLoading] = useState(false);
  const [draftTerritories, setDraftTerritories] = useState<string[]>([]);
  const [mapSelectionMode, setMapSelectionMode] = useState(false);
  const blockMapCacheRef = useRef<Map<string, HojasRutaBlockMap>>(new Map());
  const zoneMapCacheRef = useRef<Map<string, HojasRutaZoneMap>>(new Map());
  const contextMapCacheRef = useRef<Map<string, HojasRutaContextMap>>(new Map());
  const streetMapCacheRef = useRef<Map<string, HojasRutaStreetMap>>(new Map());
  const hydratingRef = useRef(true);
  const persistTimerRef = useRef<number | null>(null);
  const latestWorkspaceRef = useRef<{ config: HojasRutaIntegratedConfig; uiState: HojasRutaUiState } | null>(null);

  const loadState = useCallback(async () => {
    hydratingRef.current = true;
    clearHojasRutaWorkspaceSnapshot();
    setLoading(true);
    setError("");
    try {
      const s = await apiHojasRutaState();
      const restoredConfig = {
        ...s.integrated_config,
        n_mode: s.integrated_config.n_mode ?? "total",
        n_por_distrito: s.integrated_config.n_por_distrito ?? {},
        age_range_mode: s.integrated_config.age_range_mode ?? "manual",
        zone_allocation: s.integrated_config.zone_allocation ?? "proportional",
        sample_size_mode: s.integrated_config.sample_size_mode ?? "calculator",
        sample_size: normalizeSampleSizeSettings(s.integrated_config.sample_size),
      };
      const uiState = normalizeHojasRutaUiState(s.ui_state, restoredConfig.territorios ?? []);
      setState(s);
      setConfig(restoredConfig);
      setActiveStage(uiState.active_stage);
      setPopulation(null);
      setPopulationExport(null);
      setSampleSizePreview(null);
      setQuota(null);
      setSample(null);
      setResult(null);
      setZoneMap(null);
      setBlockMap(null);
      setContextMap(null);
      setStreetMap(null);
      blockMapCacheRef.current.clear();
      zoneMapCacheRef.current.clear();
      contextMapCacheRef.current.clear();
      streetMapCacheRef.current.clear();
      setDraftTerritories(uiState.draft_territories);
      setMapSelectionMode(uiState.map_selection_mode);
      setMapUbigeo(uiState.map_ubigeo);
      setMapZona(uiState.map_zona);
      setMapLevel(uiState.map_level);
      if (uiState.map_ubigeo) {
        setZoneMapLoading(true);
        void apiHojasRutaZoneMap(uiState.map_ubigeo)
          .then((nextZone) => {
            zoneMapCacheRef.current.set(uiState.map_ubigeo, nextZone);
            setZoneMap(nextZone);
          })
          .catch(() => undefined)
          .finally(() => setZoneMapLoading(false));
        if (uiState.map_level === "manzanas") {
          setBlockMapLoading(true);
          void Promise.all([
            apiHojasRutaBlockMap(uiState.map_ubigeo, 0, false),
            apiHojasRutaContextMap(uiState.map_ubigeo).catch(() => null),
            apiHojasRutaStreetMap(uiState.map_ubigeo).catch(() => null),
          ])
            .then(([nextBlock, nextContext, nextStreet]) => {
              blockMapCacheRef.current.set(uiState.map_ubigeo, nextBlock);
              setBlockMap(nextBlock);
              if (nextContext) {
                contextMapCacheRef.current.set(contextMapCacheKey(uiState.map_ubigeo), nextContext);
                setContextMap(nextContext);
              }
              if (nextStreet) {
                streetMapCacheRef.current.set(streetMapCacheKey(uiState.map_ubigeo), nextStreet);
                setStreetMap(nextStreet);
              }
            })
            .catch(() => undefined)
            .finally(() => setBlockMapLoading(false));
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      window.setTimeout(() => {
        hydratingRef.current = false;
      }, 0);
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState, sessionId]);

  const selectedTerritories = config?.territorios ?? [];
  const draftChanged = useMemo(() => {
    const confirmed = new Set(selectedTerritories);
    if (confirmed.size !== draftTerritories.length) return true;
    return draftTerritories.some((ubigeo) => !confirmed.has(ubigeo));
  }, [draftTerritories, selectedTerritories]);
  const hojasRutaUiState = useMemo<HojasRutaUiState>(() => ({
    active_stage: activeStage,
    draft_territories: draftTerritories,
    map_ubigeo: mapUbigeo,
    map_zona: mapZona,
    map_level: mapLevel,
    map_selection_mode: mapSelectionMode,
  }), [activeStage, draftTerritories, mapLevel, mapUbigeo, mapZona, mapSelectionMode]);
  const quotaColumns = useMemo(() => Object.keys(quota?.table?.[0] ?? {}), [quota]);
  const effectiveQuotaN = config?.sample_size_mode === "external_district"
    ? Object.values(config.n_por_distrito ?? {}).reduce((sum, n) => sum + Number(n || 0), 0)
    : Number(config?.n_objetivo ?? 0);
  const routeStatus = useMemo(() => routeMultipleStatus(config, state?.territories ?? []), [config, state?.territories]);
  const canPopulation = !!config && selectedTerritories.length > 0;
  const canQuota = !!config && effectiveQuotaN > 0 && selectedTerritories.length > 0 && !!population?.ok && routeStatus.ok;
  const canSample = !!quota?.ok && !!config;
  const canGenerate = !!sample?.ok && !jobId;
  const selectedBlocks = useMemo(() => sample?.blocks ?? [], [sample]);
  const selectedBlockDistricts = useMemo(() => new Set(selectedBlocks.map((block) => block.ubigeo)).size, [selectedBlocks]);
  const selectedBlockViviendas = selectedBlocks.reduce((sum, block) => sum + Number(block.viviendas || 0), 0);
  const selectedBlockMaxLoad = selectedBlocks.reduce((max, block) => Math.max(max, Number(block.entrevistas || 0)), 0);
  const selectedBlockAvgLoad = selectedBlocks.length
    ? (selectedBlocks.reduce((sum, block) => sum + Number(block.entrevistas || 0), 0) / selectedBlocks.length).toFixed(1)
    : "0.0";

  useEffect(() => {
    if (!config || hydratingRef.current) return undefined;
    latestWorkspaceRef.current = { config, uiState: hojasRutaUiState };
    setHojasRutaWorkspaceSnapshot(config, hojasRutaUiState);

    const timer = window.setTimeout(() => {
      if (persistTimerRef.current === timer) persistTimerRef.current = null;
      void apiHojasRutaPersistWorkspace(config, hojasRutaUiState).catch(() => undefined);
    }, 600);
    persistTimerRef.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (persistTimerRef.current === timer) persistTimerRef.current = null;
    };
  }, [config, hojasRutaUiState]);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      const latest = latestWorkspaceRef.current;
      if (latest) {
        void apiHojasRutaPersistWorkspace(latest.config, latest.uiState).catch(() => undefined);
      }
      clearHojasRutaWorkspaceSnapshot();
    };
  }, []);

  function patchConfig(patch: Partial<HojasRutaIntegratedConfig>) {
    setConfig((prev) => prev ? { ...prev, ...patch } : prev);
    const invalidatesPopulation = ["territorios", "row_var", "subquota_var", "age_ranges", "age_range_mode"].some((key) => key in patch);
    const invalidatesSampleSize = invalidatesPopulation || ["n_objetivo", "n_mode", "n_por_distrito", "sample_size", "sample_size_mode", "entrevistas_por_manzana"].some((key) => key in patch);
    const invalidatesQuota = invalidatesPopulation || ["n_objetivo", "n_mode", "n_por_distrito", "sample_size_mode", "entrevistas_por_manzana"].some((key) => key in patch);
    const invalidatesSample = invalidatesQuota || ["sampling_method", "measure_var", "seed", "max_per_manzana", "entrevistas_por_manzana", "zone_allocation"].some((key) => key in patch);
    if (invalidatesPopulation) {
      setPopulation(null);
      setPopulationExport(null);
    }
    if (invalidatesSampleSize) setSampleSizePreview(null);
    if (invalidatesQuota) setQuota(null);
    if (invalidatesSample) setSample(null);
    setResult(null);
    if (patch.territorios) {
      setZoneMap(null);
      setBlockMap(null);
      setContextMap(null);
      setStreetMap(null);
      setMapZona("");
      if (mapLevel === "manzanas") setMapLevel("zonas");
    }
  }

  function toggleDraftTerritory(ubigeo: string) {
    const set = new Set(draftTerritories);
    if (set.has(ubigeo)) set.delete(ubigeo);
    else set.add(ubigeo);
    setDraftTerritories(Array.from(set));
  }

  function confirmDraftTerritories() {
    if (!config) return;
    patchConfig({ territorios: draftTerritories });
  }

  function setDraftTerritoryList(ubigeos: string[]) {
    setDraftTerritories(Array.from(new Set(ubigeos)));
  }

  function focusDistrict(ubigeo: string) {
    setMapUbigeo(ubigeo);
    setMapZona("");
    setMapLevel("zonas");
    setBlockMap(null);
    setContextMap(null);
    setStreetMap(null);
    void loadZoneMap(ubigeo);
  }

  function openZone(zona: string) {
    const ubigeo = mapUbigeo;
    if (!ubigeo || !zona) return;
    setMapZona(zona);
    setMapLevel("manzanas");
    void loadBlockMap(ubigeo);
  }

  function backToZones() {
    if (!mapUbigeo) {
      setMapLevel("distritos");
      return;
    }
    setMapZona("");
    setMapLevel("zonas");
    setBlockMap(null);
    setContextMap(null);
    setStreetMap(null);
    void loadZoneMap(mapUbigeo);
  }

  function backToDistrictMap() {
    setMapLevel("distritos");
    setMapZona("");
    setBlockMap(null);
    setContextMap(null);
    setStreetMap(null);
  }

  async function previewPopulation() {
    if (!config) return;
    setBusy("population");
    setError("");
    setPopulationExport(null);
    setResult(null);
    try {
      const p = await apiHojasRutaPopulationPreview(config);
      setConfig(p.config);
      setPopulation(p);
      setQuota(null);
      setSample(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function applyAgeRangePreset(ageRangeMode: HojasRutaAgeRangeMode) {
    if (!config || ageRangeMode === "manual") return;
    const nextConfig = { ...config, age_range_mode: ageRangeMode };
    setBusy("age-preset");
    setError("");
    setPopulationExport(null);
    setResult(null);
    try {
      const p = await apiHojasRutaPopulationPreview(nextConfig);
      setConfig(p.config);
      setPopulation(p);
      setQuota(null);
      setSample(null);
      setSampleSizePreview(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function exportPopulation() {
    if (!config) return;
    setBusy("population-export");
    setError("");
    try {
      const exported = await apiHojasRutaPopulationExport(config);
      setPopulationExport(exported);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function previewSampleSize() {
    if (!config) return;
    setBusy("sample-size");
    setError("");
    try {
      const result = await apiHojasRutaSampleSizePreview(config);
      setSampleSizePreview(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function previewQuota() {
    if (!config) return;
    setBusy("quota");
    setError("");
    setResult(null);
    try {
      const q = await apiHojasRutaQuotaPreview(config);
      setConfig(q.config);
      setQuota(q);
      if (!population) {
        setPopulation({
          ok: q.ok,
          frame_meta: q.frame_meta,
          config: q.config,
          total_poblacion: q.cells.reduce((sum, row) => sum + Number(row.poblacion ?? 0), 0),
          age_source: q.age_source,
          territories: q.territories,
          cells: q.cells.map(({ cuota: _cuota, cuota_raw: _cuotaRaw, ...row }) => row),
          table: [],
          alerts: q.alerts,
        });
      }
      setSample(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function previewSample() {
    if (!config) return;
    setBusy("sample");
    setError("");
    setResult(null);
    try {
      const s = await apiHojasRutaSamplePreview(config);
      setConfig(s.config);
      setQuota(s.quota);
      if (!population) {
        setPopulation({
          ok: s.quota.ok,
          frame_meta: s.quota.frame_meta,
          config: s.quota.config,
          total_poblacion: s.quota.cells.reduce((sum, row) => sum + Number(row.poblacion ?? 0), 0),
          age_source: s.quota.age_source,
          territories: s.quota.territories,
          cells: s.quota.cells.map(({ cuota: _cuota, cuota_raw: _cuotaRaw, ...row }) => row),
          table: [],
          alerts: s.quota.alerts,
        });
      }
      setSample(s);
      const firstBlock = s.blocks[0];
      if (firstBlock?.ubigeo) {
        setMapUbigeo(firstBlock.ubigeo);
        setMapZona(firstBlock.zona ?? "");
        setMapLevel(firstBlock.zona ? "manzanas" : "zonas");
        void loadZoneMap(firstBlock.ubigeo);
        void loadBlockMap(firstBlock.ubigeo);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function loadZoneMap(ubigeo = mapUbigeo) {
    if (!ubigeo) return;
    const cachedZone = zoneMapCacheRef.current.get(ubigeo);
    if (cachedZone) {
      setZoneMap(cachedZone);
      setMapUbigeo(ubigeo);
      return;
    }
    setZoneMapLoading(true);
    setError("");
    try {
      const nextZone = await apiHojasRutaZoneMap(ubigeo);
      zoneMapCacheRef.current.set(ubigeo, nextZone);
      setZoneMap(nextZone);
      setMapUbigeo(ubigeo);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setZoneMapLoading(false);
    }
  }

  async function loadBlockMap(ubigeo = mapUbigeo, refresh = false) {
    if (!ubigeo) return;
    if (!refresh) {
      const cachedBlock = blockMapCacheRef.current.get(ubigeo);
      const contextKey = contextMapCacheKey(ubigeo);
      const cachedContext = contextMapCacheRef.current.get(contextKey);
      const streetKey = streetMapCacheKey(ubigeo);
      const cachedStreet = streetMapCacheRef.current.get(streetKey);
      if (cachedBlock) {
        setBlockMap(cachedBlock);
        if (cachedContext) setContextMap(cachedContext);
        else {
          setContextMap(null);
          void apiHojasRutaContextMap(ubigeo)
            .then((nextContext) => {
              contextMapCacheRef.current.set(contextKey, nextContext);
              setContextMap(nextContext);
            })
            .catch(() => undefined);
        }
        if (cachedStreet) setStreetMap(cachedStreet);
        else {
          setStreetMap(null);
          void apiHojasRutaStreetMap(ubigeo)
            .then((nextStreet) => {
              streetMapCacheRef.current.set(streetKey, nextStreet);
              setStreetMap(nextStreet);
            })
            .catch(() => undefined);
        }
        setMapUbigeo(ubigeo);
        return;
      }
    }
    setBlockMapLoading(true);
    setError("");
    try {
      const [nextBlock, nextContext, nextStreet] = await Promise.all([
        apiHojasRutaBlockMap(ubigeo, 0, refresh),
        apiHojasRutaContextMap(ubigeo).catch(() => null),
        apiHojasRutaStreetMap(ubigeo).catch(() => null),
      ]);
      blockMapCacheRef.current.set(ubigeo, nextBlock);
      setBlockMap(nextBlock);
      if (nextContext) {
        contextMapCacheRef.current.set(contextMapCacheKey(ubigeo), nextContext);
        setContextMap(nextContext);
      } else {
        setContextMap(null);
      }
      if (nextStreet) {
        streetMapCacheRef.current.set(streetMapCacheKey(ubigeo), nextStreet);
        setStreetMap(nextStreet);
      } else {
        setStreetMap(null);
      }
      setMapUbigeo(ubigeo);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBlockMapLoading(false);
    }
  }

  async function generate() {
    if (!config) return;
    setBusy("generate");
    setError("");
    setResult(null);
    try {
      const started = await apiHojasRutaGenerate(config);
      setJobId(started.job_id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function setSampleSizeMode(mode: SampleSizeMode) {
    if (!config) return;
    patchConfig({
      sample_size_mode: mode,
      n_mode: mode === "external_district" ? "por_distrito" : "total",
    });
  }

  function patchSampleSize(patch: Partial<HojasRutaSampleSizeConfig>) {
    if (!config) return;
    patchConfig({ sample_size: { ...normalizeSampleSizeSettings(config.sample_size), ...patch } });
  }

  function setDeffOverride(ubigeo: string, value: number | null) {
    if (!config) return;
    const current = normalizeSampleSizeSettings(config.sample_size);
    const overrides = { ...(current.design_effect_overrides ?? {}) };
    if (value == null || !Number.isFinite(value) || value <= 0) {
      delete overrides[ubigeo];
    } else {
      overrides[ubigeo] = Math.max(0.1, Math.min(20, value));
    }
    patchSampleSize({ design_effect_overrides: overrides });
  }

  function setMarginOverride(ubigeo: string, value: number | null) {
    if (!config) return;
    const current = normalizeSampleSizeSettings(config.sample_size);
    const overrides = { ...(current.margin_district_overrides ?? {}) };
    if (value == null || !Number.isFinite(value) || value <= 0) {
      delete overrides[ubigeo];
    } else {
      overrides[ubigeo] = Math.max(0.001, Math.min(0.8, value));
    }
    patchSampleSize({ margin_district_overrides: overrides });
  }

  function setTotalN(value: number) {
    if (!config) return;
    patchConfig({ sample_size_mode: "external_total", n_mode: "total", n_objetivo: Math.max(1, Math.round(value || 1)) });
  }

  function setRouteSize(value: number) {
    if (!config) return;
    const routeSize = Math.max(1, Math.round(value || 1));
    patchConfig({ entrevistas_por_manzana: routeSize, max_per_manzana: routeSize });
  }

  function setDistrictN(ubigeo: string, value: number) {
    if (!config) return;
    const next = { ...(config.n_por_distrito ?? {}), [ubigeo]: Math.max(0, Math.round(value || 0)) };
    const total = Object.values(next).reduce((sum, n) => sum + Number(n || 0), 0);
    patchConfig({ sample_size_mode: "external_district", n_mode: "por_distrito", n_por_distrito: next, n_objetivo: Math.max(1, total || config.n_objetivo) });
  }

  function suggestDistrictN() {
    if (!config || !state) return;
    const selected = state.territories.filter((t) => selectedTerritories.includes(t.ubigeo));
    const routes = Math.max(1, Math.floor(config.n_objetivo / routeStatus.routeSize));
    const suggestedRoutes = allocateInteger(selected.map((t) => t.poblacion), routes);
    const suggested = suggestedRoutes.map((value) => value * routeStatus.routeSize);
    const next = Object.fromEntries(selected.map((t, index) => [t.ubigeo, suggested[index] ?? 0]));
    patchConfig({ sample_size_mode: "external_district", n_mode: "por_distrito", n_por_distrito: next, n_objetivo: suggested.reduce((sum, n) => sum + n, 0) || config.n_objetivo });
  }

  function useRecommendedSampleSize() {
    if (!sampleSizePreview) return;
    patchConfig({
      sample_size_mode: "calculator",
      n_mode: "total",
      n_objetivo: Math.max(1, sampleSizePreview.n_recommended_route ?? sampleSizePreview.n_recommended),
    });
  }

  function useSuggestedDistrictSampleSize() {
    if (!sampleSizePreview?.district_rows.length) return;
    const next = Object.fromEntries(sampleSizePreview.district_rows.map((row) => [row.ubigeo, row.n_recommended]));
    const total = sampleSizePreview.district_rows.reduce((sum, row) => sum + Number(row.n_recommended || 0), 0);
    patchConfig({
      sample_size_mode: "external_district",
      n_mode: "por_distrito",
      n_por_distrito: next,
      n_objetivo: Math.max(1, total),
    });
  }

  function pasteDistrictN(startUbigeo: string, text: string) {
    if (!config) return;
    const startIndex = selectedTerritoryRows.findIndex((t) => t.ubigeo === startUbigeo);
    if (startIndex < 0) return;
    const values = text
      .split(/\r?\n/)
      .map((line) => {
        const numericCells = line
          .split(/\t/)
          .map((value) => Number(String(value).replace(/[^0-9.-]+/g, "")))
          .filter((value) => Number.isFinite(value));
        return numericCells[numericCells.length - 1];
      })
      .filter((value): value is number => Number.isFinite(value));
    if (!values.length) return;
    const next = { ...(config.n_por_distrito ?? {}) };
    values.forEach((value, offset) => {
      const row = selectedTerritoryRows[startIndex + offset];
      if (row) next[row.ubigeo] = Math.max(0, Math.round(value || 0));
    });
    const total = Object.values(next).reduce((sum, n) => sum + Number(n || 0), 0);
    patchConfig({ sample_size_mode: "external_district", n_mode: "por_distrito", n_por_distrito: next, n_objetivo: Math.max(1, total || config.n_objetivo) });
  }

  if (loading || !config) return <LoadingBlock label="Cargando marco INEI 2017" />;

  const frame = state?.frame_meta;
  const territories = state?.territories ?? [];
  const activeMapUbigeo = mapUbigeo || selectedTerritories[0] || "";
  const selectedTerritoryRows = territories.filter((t) => selectedTerritories.includes(t.ubigeo));
  const stageTabs: TabMeta<HojasRutaStage>[] = [
    { key: "territorio", label: "Territorio", icon: MapPinned, desc: "Distritos y manzanas" },
    {
      key: "poblacion",
      label: "Poblacion",
      icon: BarChart3,
      desc: "Matriz INEI 2017",
      disabled: selectedTerritories.length === 0,
      disabledReason: "Confirma al menos un distrito.",
    },
    {
      key: "muestra",
      label: "Muestra",
      icon: Target,
      desc: "N y cuotas",
      disabled: !population?.ok,
      disabledReason: "Calcula primero la matriz poblacional.",
    },
    {
      key: "manzanas",
      label: "Manzanas",
      icon: Shuffle,
      desc: "Seleccion de campo",
      disabled: !quota?.ok,
      disabledReason: "Calcula primero las cuotas.",
    },
    {
      key: "entrega",
      label: "Entrega",
      icon: FileText,
      desc: "Revision y ZIP",
      disabled: !sample?.ok,
      disabledReason: "Selecciona primero las manzanas.",
    },
  ];
  const currentStage = stageTabs.some((tab) => tab.key === activeStage && !tab.disabled) ? activeStage : "territorio";
  const quotaAlerts = [...(quota?.alerts ?? []), ...(sample?.alerts ?? [])]
    .filter((a, i, arr) => arr.findIndex((x) => x.code === a.code && x.message === a.message) === i);
  const stageGuide = {
    territorio: {
      title: "Elige el marco de campo",
      copy: "Confirma distritos sin perder el mapa. El resto del generador solo usara el marco confirmado.",
      next: selectedTerritories.length ? "Siguiente: revisar poblacion" : "Selecciona al menos un distrito",
    },
    poblacion: {
      title: "Revisa a quien representa la muestra",
      copy: "Aqui decides los cortes de edad y sexo que luego se transforman en cuotas operativas.",
      next: population?.ok ? "Siguiente: definir muestra" : "Genera la matriz para continuar",
    },
    muestra: {
      title: "Convierte precision en cuotas",
      copy: "Define el N como decision estadistica y confirma que el resultado sea defendible por distrito.",
      next: quota?.ok ? "Siguiente: seleccionar manzanas" : "Calcula cuotas para continuar",
    },
    manzanas: {
      title: "Aterriza la muestra en territorio",
      copy: "Elige como repartir entrevistas en manzanas y revisa si la carga de campo queda razonable.",
      next: sample?.ok ? "Siguiente: revisar entrega" : "Selecciona manzanas para continuar",
    },
    entrega: {
      title: "Ultima revision antes del ZIP",
      copy: "Comprueba cuotas, manzanas, alertas y contenidos del paquete antes de generar los entregables.",
      next: result ? "ZIP generado" : "Genera los entregables finales",
    },
  } satisfies Record<HojasRutaStage, { title: string; copy: string; next: string }>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader
        title="Hojas de ruta"
        lead="Cuotas, seleccion de manzanas y fichas de campo desde un marco territorial local y trazable."
        meta={frame ? <StatusPill ok={frame.ok} text={`${frame.coverage} · ${frame.version}`} /> : null}
      />

      {error && <Alert kind="error">{error}</Alert>}
      {frame?.pilot && (
        <Alert kind="warn">
          {frame.note}
        </Alert>
      )}

      {!frame?.ok ? (
        <Panel>
          <EmptyState
            icon={<FileText size={18} />}
            title="Marco territorial no disponible"
            hint="No se encontro el paquete INEI 2017 requerido para generar hojas de ruta."
          />
        </Panel>
      ) : (
        <>
          <TabStrip<HojasRutaStage>
            tabs={stageTabs}
            active={currentStage}
            onChange={setActiveStage}
            ariaLabel="Etapas de hojas de ruta"
          />

          <div className="hojas-ruta-stage-coach">
            <div>
              <span>{stageGuide[currentStage].next}</span>
              <strong>{stageGuide[currentStage].title}</strong>
              <p>{stageGuide[currentStage].copy}</p>
            </div>
            <div className="hojas-ruta-readiness-strip" aria-label="Estado del generador">
              <ReadinessItem ok={selectedTerritories.length > 0} label="Territorio" value={`${selectedTerritories.length} dist.`} />
              <ReadinessItem ok={!!population?.ok} label="Poblacion" value={population?.ok ? "lista" : "pendiente"} />
              <ReadinessItem ok={!!quota?.ok} label="Cuotas" value={quota?.ok ? formatNumber(quota.total_asignado) : "pendiente"} />
              <ReadinessItem ok={!!sample?.ok} label="Campo" value={sample?.ok ? `${formatNumber(sample.n_blocks)} mz.` : "pendiente"} />
            </div>
          </div>

          {currentStage === "territorio" && (
            <section className="hojas-ruta-workbench" aria-label="Explorador territorial">
              <div className="hojas-ruta-map-column">
                <div className="hojas-ruta-map-holder">
                  <TerritoryMapExplorer
                    territories={territories}
                    selected={selectedTerritories}
                    draft={draftTerritories}
                    activeUbigeo={activeMapUbigeo}
                    activeZona={mapZona}
                    mapLevel={mapLevel}
                    zoneMap={zoneMap}
                    blockMap={blockMap}
                    contextMap={contextMap}
                    streetMap={streetMap}
                    zoneMapLoading={zoneMapLoading}
                    blockMapLoading={blockMapLoading}
                    selectedBlocks={selectedBlocks}
                    mapSelectionMode={mapSelectionMode}
                    onFocus={focusDistrict}
                    onOpenZone={openZone}
                    onToggleDraft={toggleDraftTerritory}
                    onMapSelectionModeChange={setMapSelectionMode}
                    onBackToZones={backToZones}
                    onBackToDistricts={backToDistrictMap}
                  />
                </div>
              </div>

              <aside className="hojas-ruta-side">
                <section className="hojas-ruta-side-section is-summary">
                  <div className="hojas-ruta-side-kicker">Marco territorial</div>
                  <div className="hojas-ruta-side-title">{frame.coverage}</div>
                  <div className="hojas-ruta-summary-grid">
                    <MiniMetric label="Distritos disponibles" value={formatNumber(frame.n_distritos)} />
                    <MiniMetric label="Manzanas censales" value={formatNumber(frame.n_manzanas)} />
                    <MiniMetric label="Viviendas censadas" value={formatNumber(frame.viviendas)} />
                    <MiniMetric label="Poblacion censada" value={formatNumber(frame.poblacion)} />
                  </div>
                  <div className="hojas-ruta-cartography-row is-compact">
                    <Layers size={16} color="var(--pulso-primary)" />
                    <div>
                      <div className="hojas-ruta-side-title is-small">Cartografia de manzanas</div>
                      <div className="hojas-ruta-side-copy">
                        {frame.block_cartography?.coverage ?? "Lima Metropolitana y Callao"} · Lima 2017 / Callao 2019
                      </div>
                    </div>
                  </div>
                  <div className="hojas-ruta-status-row">
                    <StatusPill ok={frame.age_data?.ok ?? false} text={frame.age_data?.ok ? "Edad simple INEI 2017" : "Edad pendiente"} />
                    <StatusPill ok={!!frame.nse_data?.available} text={frame.nse_data?.available ? "NSE disponible" : "NSE no disponible"} />
                    <StatusPill ok={!!frame.block_cartography?.ok} text={cartographyModeLabel(frame.block_cartography?.mode)} />
                    <StatusPill ok={!!frame.street_cartography?.ok} text={frame.street_cartography?.ok ? "Calles OSM local" : "Calles pendiente"} />
                    <StatusPill ok={!!frame.context_cartography?.ok} text={frame.context_cartography?.ok ? "Contexto local + curado" : "Contexto pendiente"} />
                  </div>
                </section>

                <section className="hojas-ruta-side-section is-flex">
                  <div className="hojas-ruta-district-header">
                    <div>
                      <div className="hojas-ruta-side-kicker">Cuotas</div>
                      <div className="hojas-ruta-side-title is-small">Distritos para confirmar</div>
                    </div>
                    <div className="hojas-ruta-confirmed-pills">
                      <StatusPill ok={selectedTerritories.length > 0} text={`${selectedTerritories.length} confirmados`} />
                      <StatusPill ok={draftTerritories.length > 0} text={`${draftTerritories.length} en borrador`} />
                    </div>
                  </div>
                  <div className="hojas-ruta-confirm-bar">
                    <span>La muestra usara solo distritos confirmados.</span>
                    <button type="button" onClick={confirmDraftTerritories} disabled={!draftChanged}>
                      Confirmar seleccion
                    </button>
                  </div>
                  <DistrictSelectorGrid
                    territories={territories}
                    draft={draftTerritories}
                    confirmed={selectedTerritories}
                    activeUbigeo={activeMapUbigeo}
                    onToggleDraft={toggleDraftTerritory}
                    onFocus={focusDistrict}
                    onSelectMany={setDraftTerritoryList}
                    onClearDraft={() => setDraftTerritories([])}
                  />
                </section>
              </aside>
            </section>
          )}

          {currentStage === "poblacion" && (
            <div className="hojas-ruta-stage-shell">
              <div className="hojas-ruta-stage-grid">
                <Panel title="Cortes de poblacion" eyebrow="INEI 2017">
                  <div className="hojas-ruta-form-grid">
                    <Field label="Filas">
                      <select style={fieldStyle} value={config.row_var} onChange={(e) => patchConfig({ row_var: e.target.value as HojasRutaIntegratedConfig["row_var"] })}>
                        <option value="distrito">Distrito</option>
                        <option value="provincia">Provincia</option>
                        <option value="ubigeo">Ubigeo</option>
                        <option value="zona">Zona censal</option>
                      </select>
                    </Field>
                    <Field label="Columnas">
                      <select style={fieldStyle} value={config.col_var} disabled>
                        <option value="rango_edad">Rangos de edad</option>
                      </select>
                    </Field>
                    <Field label="Sexo">
                      <select style={fieldStyle} value={config.subquota_var} onChange={(e) => patchConfig({ subquota_var: e.target.value as HojasRutaIntegratedConfig["subquota_var"] })}>
                        <option value="sexo">Mostrar hombres y mujeres</option>
                        <option value="ninguna">No dividir por sexo</option>
                      </select>
                    </Field>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <Field label="Rangos de edad">
                      <div className="hojas-ruta-age-preset-row" aria-label="Presets de rangos de edad">
                        {(["terciles", "cuartiles", "quintiles"] as HojasRutaAgeRangeMode[]).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            className={config.age_range_mode === mode ? "is-active" : ""}
                            onClick={() => void applyAgeRangePreset(mode)}
                            disabled={!canPopulation || busy === "age-preset"}
                          >
                            {AGE_RANGE_MODE_LABELS[mode]}
                          </button>
                        ))}
                        <StatusPill ok text={AGE_RANGE_MODE_LABELS[config.age_range_mode ?? "manual"] ?? "Manual"} />
                      </div>
                      <AgeRangesEditor
                        ranges={config.age_ranges}
                        onChange={(age_ranges) => patchConfig({ age_ranges, age_range_mode: "manual" })}
                      />
                    </Field>
                  </div>
                  <div className="hojas-ruta-action-row">
                    <button type="button" style={btnPrimary} onClick={() => void previewPopulation()} disabled={!canPopulation || busy === "population"}>
                      {busy === "population" ? <Loader2 size={14} className="pulso-spin" /> : <BarChart3 size={14} />}
                      Ver matriz poblacional
                    </button>
                    <StatusPill ok={selectedTerritories.length > 0} text={`${selectedTerritories.length} distrito(s)`} />
                  </div>
                </Panel>

                <Panel title="Distritos incluidos" eyebrow="Marco confirmado">
                  <div className="hojas-ruta-selected-list">
                    {selectedTerritoryRows.map((t) => (
                      <div key={t.ubigeo} className="hojas-ruta-selected-row">
                        <DistrictShapeIcon ubigeo={t.ubigeo} active />
                        <div>
                          <strong>{t.distrito}</strong>
                          <span>{formatNumber(t.poblacion)} personas · {formatNumber(t.viviendas)} viviendas</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>

              {population?.alerts.map((a) => (
                <Alert key={`${a.code}:${a.message}`} kind={alertKind(a.level)}>{a.message}</Alert>
              ))}
              <PopulationMatrixPreview
                population={population}
                actions={(
                  <div className="hojas-ruta-action-row is-tight">
                    <button type="button" style={btnSecondary} onClick={() => void exportPopulation()} disabled={!population?.ok || busy === "population-export"}>
                      {busy === "population-export" ? <Loader2 size={14} className="pulso-spin" /> : <FileSpreadsheet size={14} />}
                      Exportar Excel
                    </button>
                    {populationExport && (
                      <a href={downloadUrl(populationExport.file_id)} style={{ ...btnPrimary, textDecoration: "none" }}>
                        <Download size={14} /> Descargar matriz
                      </a>
                    )}
                  </div>
                )}
              />
            </div>
          )}

          {currentStage === "muestra" && (
            <div className="hojas-ruta-stage-shell">
              <SampleSizeWorkbench
                config={config}
                territories={selectedTerritoryRows}
                preview={sampleSizePreview}
                busy={busy}
                canQuota={canQuota}
                routeStatus={routeStatus}
                onModeChange={setSampleSizeMode}
                onSampleSizeChange={patchSampleSize}
                onRouteSizeChange={setRouteSize}
                onTotalNChange={setTotalN}
                onDistrictNChange={setDistrictN}
                onDistrictNPaste={pasteDistrictN}
                onSuggestDistrictN={suggestDistrictN}
                onUseRecommendedN={useRecommendedSampleSize}
                onUseSuggestedDistrictN={useSuggestedDistrictSampleSize}
                onPreviewSampleSize={() => void previewSampleSize()}
                onPreviewQuota={() => void previewQuota()}
                onDeffOverrideChange={setDeffOverride}
                onMarginOverrideChange={setMarginOverride}
              />

              {quotaAlerts.map((a) => (
                <Alert key={`${a.code}:${a.message}`} kind={alertKind(a.level)}>{a.message}</Alert>
              ))}
              <QuotaMatrixPreview quota={quota} sampleSizePreview={sampleSizePreview} />
            </div>
          )}

          {currentStage === "manzanas" && (
            <section className="hojas-ruta-sampling-layout">
              <div className="hojas-ruta-map-column">
                <div className="hojas-ruta-map-holder">
                  <TerritoryMapExplorer
                    territories={territories}
                    selected={selectedTerritories}
                    draft={draftTerritories}
                    activeUbigeo={activeMapUbigeo}
                    activeZona={mapZona}
                    mapLevel={mapLevel}
                    zoneMap={zoneMap}
                    blockMap={blockMap}
                    contextMap={contextMap}
                    streetMap={streetMap}
                    zoneMapLoading={zoneMapLoading}
                    blockMapLoading={blockMapLoading}
                    selectedBlocks={selectedBlocks}
                    mapSelectionMode={false}
                    enableMapSelection={false}
                    onFocus={focusDistrict}
                    onOpenZone={openZone}
                    onToggleDraft={toggleDraftTerritory}
                    onMapSelectionModeChange={setMapSelectionMode}
                    onBackToZones={backToZones}
                    onBackToDistricts={backToDistrictMap}
                  />
                </div>
              </div>
              <div className="hojas-ruta-sampling-panel">
                <Panel title="Selecciona manzanas" eyebrow="Plan de campo">
                  <div className="hojas-ruta-sampling-controls">
                    <div className="hojas-ruta-form-grid is-tight">
                      <Field label="Método de selección">
                        <select style={fieldStyle} value={config.sampling_method} onChange={(e) => patchConfig({ sampling_method: e.target.value as SamplingMethod })}>
                          <option value="pps">PPS estratificado</option>
                          <option value="sistematico">Sistemático</option>
                          <option value="conglomerado_fijo">Conglomerado fijo</option>
                        </select>
                      </Field>
                      <Field label="Tamaño del conglomerado">
                        <select
                          style={fieldStyle}
                          value={config.measure_var}
                          onChange={(e) => patchConfig({ measure_var: e.target.value as HojasRutaIntegratedConfig["measure_var"] })}
                          title={config.measure_var === "viviendas"
                            ? "Cada manzana pesa por su número de viviendas (estándar en encuestas de hogar)."
                            : "Cada manzana pesa por su población (úsalo solo si el muestreo es por persona dentro de la manzana)."}
                        >
                          <option value="viviendas">Viviendas (recomendado)</option>
                          <option value="poblacion">Población</option>
                        </select>
                      </Field>
                      <Field label="Encuestas por ruta">
                        <input
                          style={fieldStyle}
                          type="number"
                          min={1}
                          value={config.entrevistas_por_manzana}
                          onChange={(e) => {
                            const v = Math.max(1, Number(e.target.value || 1));
                            patchConfig({ entrevistas_por_manzana: v, max_per_manzana: v });
                          }}
                        />
                      </Field>
                      <Field label="Semilla reproducible">
                        <input style={fieldStyle} type="number" value={config.seed} onChange={(e) => patchConfig({ seed: Number(e.target.value || 2017) })} />
                      </Field>
                    </div>
                    <p className="hojas-ruta-soft-text" style={{ margin: 0 }}>
                      <strong>Tamaño del conglomerado:</strong>{" "}
                      {config.measure_var === "viviendas"
                        ? `las rutas se dispersan por zona y las manzanas se ponderan por viviendas; cada ruta tendrá ${formatNumber(config.entrevistas_por_manzana)} encuestas.`
                        : `las rutas se dispersan por zona y las manzanas se ponderan por población; cada ruta tendrá ${formatNumber(config.entrevistas_por_manzana)} encuestas.`}
                    </p>
                    <details className="hojas-ruta-method-details">
                      <summary><strong>Cómo funciona el método elegido</strong></summary>
                      <SamplingMethodExplainer value={config.sampling_method} onChange={(sampling_method) => patchConfig({ sampling_method })} />
                    </details>
                  </div>
                  <div className="hojas-ruta-action-row">
                    <button type="button" style={btnPrimary} onClick={() => void previewSample()} disabled={!canSample || busy === "sample"}>
                      {busy === "sample" ? <Loader2 size={14} className="pulso-spin" /> : <Shuffle size={14} />}
                      Seleccionar manzanas
                    </button>
                    <span className="hojas-ruta-soft-text">{methodLabel(config.sampling_method)} · {formatNumber(effectiveQuotaN)} entrevistas objetivo</span>
                  </div>
                </Panel>
                {sample && (
                  <Panel
                    title="Manzanas seleccionadas"
                    eyebrow={`${formatNumber(sample.n_blocks)} de campo`}
                    actions={(
                      <button type="button" style={btnSecondary} onClick={() => setActiveStage("entrega")}>
                        Revisar entrega
                      </button>
                    )}
                  >
                    <div className="hojas-ruta-sampling-mini-summary">
                      <MiniMetric label="Entrevistas" value={formatNumber(sample.total_entrevistas)} />
                      <MiniMetric label="Distritos" value={formatNumber(selectedBlockDistricts)} />
                      <MiniMetric label="Carga media" value={selectedBlockAvgLoad} />
                      <MiniMetric label="Carga máx." value={formatNumber(selectedBlockMaxLoad)} />
                    </div>
                    <div className="hojas-ruta-block-list">
                      {sample.blocks.slice(0, 8).map((b) => (
                        <div key={b.id_manzana} className="hojas-ruta-block-list-row">
                          <div className="hojas-ruta-block-list-info">
                            <strong>{b.distrito}</strong>
                            <span>Zona {b.zona} · ID {b.id_manzana}</span>
                          </div>
                          <div className="hojas-ruta-block-list-meta">
                            <em>{formatNumber(b.entrevistas)}</em>
                            <small>encuestas</small>
                          </div>
                        </div>
                      ))}
                      {sample.blocks.length > 8 ? (
                        <div className="hojas-ruta-block-list-more">
                          <span>+ {formatNumber(sample.blocks.length - 8)} más en la entrega</span>
                        </div>
                      ) : null}
                    </div>
                  </Panel>
                )}
              </div>
            </section>
          )}

          {currentStage === "entrega" && (
            <div className="hojas-ruta-stage-shell">
              <div className="hojas-ruta-delivery-layout">
                <Panel title="Revisión final" eyebrow="Antes de generar">
                  {!quota ? (
                    <EmptyState icon={<BarChart3 size={18} />} title="Sin cuotas calculadas" hint="Calcula cuotas para revisar la asignacion." variant="inline" />
                  ) : (
                    <div className="hojas-ruta-delivery-review">
                      <div className="hojas-ruta-delivery-summary">
                        <MiniMetric label="Cuotas asignadas" value={`${formatNumber(quota.total_asignado)} / ${formatNumber(quota.n_objetivo)}`} />
                        <MiniMetric label="Manzanas" value={sample ? formatNumber(sample.n_blocks) : "0"} />
                        <MiniMetric label="Entrevistas" value={sample ? formatNumber(sample.total_entrevistas) : "0"} />
                        <MiniMetric label="Distritos" value={formatNumber(selectedTerritories.length)} />
                      </div>

                      {quotaAlerts.length ? (
                        <div className="hojas-ruta-sample-alerts">
                          {quotaAlerts.map((a) => (
                            <Alert key={`${a.code}:${a.message}`} kind={alertKind(a.level)}>{a.message}</Alert>
                          ))}
                        </div>
                      ) : (
                        <div className="hojas-ruta-sample-plain-card is-success">
                          <strong>Sin alertas bloqueantes</strong>
                          <span>La asignación de cuotas y manzanas está lista para generar entregables.</span>
                        </div>
                      )}

                      <section className="hojas-ruta-delivery-section">
                        <div className="hojas-ruta-section-title">
                          <strong>Cuotas por perfil</strong>
                          <span>Primeras filas para una revisión rápida.</span>
                        </div>
                        <div className="hojas-ruta-review-table-wrap is-delivery">
                          <table className="hojas-ruta-review-table">
                            <thead>
                              <tr>
                                {quotaColumns.map((h) => (
                                  <th key={h}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {quota.table.slice(0, 16).map((row, i) => (
                                <tr key={i}>
                                  {quotaColumns.map((c) => {
                                    const value = row[c];
                                    return (
                                      <td key={c} className={reviewCellClass(c, value)}>
                                        {typeof value === "number" ? formatNumber(value as number) : String(value ?? "")}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>

                      {sample && (
                        <section className="hojas-ruta-delivery-section">
                          <div className="hojas-ruta-section-title">
                            <strong>Manzanas de campo</strong>
                            <span>Vista operativa de los puntos seleccionados.</span>
                          </div>
                          <div className="hojas-ruta-review-table-wrap is-delivery">
                            <table className="hojas-ruta-review-table">
                              <thead>
                                <tr>
                                  {["Distrito", "ID manzana", "Zona", "Viviendas", "Entrevistas", "Método"].map((h) => (
                                    <th key={h}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {sample.blocks.slice(0, 40).map((b) => (
                                  <tr key={b.id_manzana}>
                                    <td className="is-strong">{b.distrito}</td>
                                    <td className="is-code">{b.id_manzana}</td>
                                    <td className="is-code">{b.zona}</td>
                                    <td className="is-number">{formatNumber(b.viviendas)}</td>
                                    <td className="is-number is-strong">{formatNumber(b.entrevistas)}</td>
                                    <td>{methodLabel(b.metodo)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      )}
                    </div>
                  )}
                </Panel>

                <aside className="hojas-ruta-delivery-side">
                  <Panel title="Paquete de entrega" eyebrow="ZIP final">
                    <div className="hojas-ruta-delivery-checklist">
                      <ReadinessItem ok={selectedTerritories.length > 0} label="Territorio" value={`${selectedTerritories.length} dist.`} />
                      <ReadinessItem ok={!!population?.ok} label="Población" value={population?.ok ? "validada" : "pendiente"} />
                      <ReadinessItem ok={!!quota?.ok} label="Cuotas" value={quota?.ok ? "listas" : "pendiente"} />
                      <ReadinessItem ok={!!sample?.ok} label="Manzanas" value={sample?.ok ? "listas" : "pendiente"} />
                    </div>
                    <button
                      type="button"
                      style={{ ...btnPrimary, width: "100%", justifyContent: "center" }}
                      onClick={() => void generate()}
                      disabled={!canGenerate || busy === "generate"}
                    >
                      {busy === "generate" ? <Loader2 size={14} className="pulso-spin" /> : <Play size={14} />}
                      Generar ZIP
                    </button>
                    <div className="hojas-ruta-output-list">
                      <div>
                        <FileText size={17} />
                        <span>PDF individual por manzana</span>
                      </div>
                      <div>
                        <Layers size={17} />
                        <span>Hoja operativa por zona</span>
                      </div>
                      <div>
                        <FileSpreadsheet size={17} />
                        <span>Resumen Excel del proceso</span>
                      </div>
                      <div>
                        <Layers size={17} />
                        <span>Metadatos del marco y alertas</span>
                      </div>
                    </div>
                    <p className="hojas-ruta-sample-note">
                      Si cambias cuotas, muestra o selección de manzanas, Prosecnur invalidará este resultado para evitar entregar archivos desactualizados.
                    </p>
                  </Panel>
                </aside>
              </div>

              <JobProgress<HojasRutaJobResult>
                label="Generando hojas de ruta"
                jobId={jobId}
                onDone={(data) => {
                  setResult(data);
                  setJobId(null);
                }}
                onError={(msg) => {
                  setError(msg);
                  setJobId(null);
                }}
                onCancelled={() => setJobId(null)}
              />

              {result && (
                <Panel title="Entregables generados" eyebrow="ZIP operativo + informe tecnico">
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <StatusPill ok text={`${formatNumber(result.n_pdfs)} PDFs`} />
                    {result.n_zone_pdfs ? <StatusPill ok text={`${formatNumber(result.n_zone_pdfs)} hojas de zona`} /> : null}
                    <StatusPill ok text={`${formatNumber(result.total_entrevistas)} entrevistas`} />
                    <StatusPill ok text={result.frame_version} />
                    <a href={downloadUrl(result.file_id)} style={{ ...btnPrimary, textDecoration: "none" }}>
                      <Download size={14} /> Descargar ZIP
                    </a>
                  </div>
                </Panel>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
