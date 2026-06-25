import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  DatabaseZap,
  MapPinned,
  Maximize2,
  Minus,
  Plus,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
} from "lucide-react";
import {
  apiMonitoreoState,
  apiMonitoreoTerritorialPhase,
  type MonitoreoState,
  type MonitoreoTerritorialDashboard,
  type MonitoreoTerritorialPhase,
  type TerritorialBlockProgress,
  type TerritorialDistrictProgress,
  type TerritorialInternalReviewCase,
  type TerritorialResponseAuditRow,
} from "../../../../api/client";
import { MODULE_TONES } from "../../../../lib/modules";
import {
  TERRITORIAL_WORKBENCH_VIEWS,
  type WorkbenchView,
} from "../../core/monitoreoRegistry";
import {
  monitoreoScopeCache,
  reportScopesForTerritorialView,
  territorialReportsCoverView,
  territorialSourceKeyFromState,
} from "../../core/reportScopeCache";
import type { MonitoreoReportScope } from "../types";
import "./territorialProfile.css";

const TERRITORIAL_FIELD_SCOPES: MonitoreoReportScope[] = [
  "source",
  "route_summary",
  "validation_summary",
  "advance_summary",
  "queries_summary",
];
const TERRITORIAL_PILOT_SCOPES: MonitoreoReportScope[] = ["advance_summary"];

const VIEW_ICONS: Partial<Record<WorkbenchView, typeof Route>> = {
  fuentes: DatabaseZap,
  modelo: Route,
  calidad: ShieldAlert,
  consultas: Search,
  avance: BarChart3,
  ocurrencias: MapPinned,
};

function fmt(value: unknown, fallback = "0") {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (Number.isFinite(n)) return new Intl.NumberFormat("es-PE").format(n);
  return String(value);
}

function pct(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "S/D";
  return `${Math.round(n)}%`;
}

function labelForPhase(phase: string) {
  return phase === "pilot" ? "Piloto" : "Campo";
}

function isReplacementBlock(block: TerritorialBlockProgress) {
  return String(block.tipo_manzana || "").toLowerCase() === "reemplazo";
}

function scopeForView(view: WorkbenchView): MonitoreoReportScope {
  return reportScopesForTerritorialView(view)[0] ?? "full";
}

function scopesForPhase(phase: MonitoreoTerritorialPhase): MonitoreoReportScope[] {
  return phase === "pilot" ? TERRITORIAL_PILOT_SCOPES : TERRITORIAL_FIELD_SCOPES;
}

function viewAllowedInPhase(phase: MonitoreoTerritorialPhase, view: WorkbenchView) {
  return phase === "pilot" ? view === "avance" : true;
}

function scopeForPhaseView(phase: MonitoreoTerritorialPhase, view: WorkbenchView) {
  return phase === "pilot" ? "advance_summary" : scopeForView(view);
}

function phaseSourceExists(state: MonitoreoState, phase: MonitoreoTerritorialPhase) {
  const source = state.config?.territorial?.phase_sources?.[phase];
  return Boolean(source?.source_id || source?.asset_uid);
}

function preferredTerritorialPhase(state: MonitoreoState): MonitoreoTerritorialPhase {
  const active = state.config?.territorial?.active_route_phase ?? "field";
  const hasFieldSource = phaseSourceExists(state, "field");
  const hasPilotSource = phaseSourceExists(state, "pilot");
  const hasLegacySource = Boolean(state.config?.territorial?.source_id || state.config?.territorial?.asset_uid);
  if (hasFieldSource || hasLegacySource) return "field";
  if (active === "pilot" && hasPilotSource && !hasFieldSource) return "pilot";
  return "field";
}

function withTerritorialPhase(state: MonitoreoState, phase: MonitoreoTerritorialPhase): MonitoreoState {
  return {
    ...state,
    config: {
      ...state.config,
      territorial: {
        ...state.config.territorial,
        active_route_phase: phase,
      },
    },
  };
}

function reportsFromState(state: MonitoreoState | null) {
  return state?.dashboard?.territorial_reports ?? null;
}

function StatTile({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "warn" | "danger" }) {
  return (
    <div className={`ter-stat ter-stat--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyPanel({ icon: Icon, title, detail }: { icon: typeof Route; title: string; detail: string }) {
  return (
    <div className="ter-empty">
      <span className="ter-empty__icon"><Icon size={18} /></span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function DataTable<T>({
  rows,
  columns,
  empty,
}: {
  rows: T[];
  columns: Array<{ key: string; label: string; render: (row: T) => string | number | null | undefined }>;
  empty: string;
}) {
  if (!rows.length) return <p className="ter-muted">{empty}</p>;
  return (
    <div className="ter-table-wrap">
      <table className="ter-table">
        <thead>
          <tr>{columns.map((col) => <th key={col.key}>{col.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((col) => <td key={col.key}>{col.render(row) ?? ""}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type LightMapPoint = {
  id: string;
  label: string;
  lat: number;
  lon: number;
  kind: "block" | "replacement" | "gps" | "review" | "pending";
  district?: string;
};

function numberOrNull(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function makeBlockMapPoints(blocks: TerritorialBlockProgress[]): LightMapPoint[] {
  return blocks.flatMap((block, index) => {
    const lat = numberOrNull(block.lat);
    const lon = numberOrNull(block.lon);
    if (lat == null || lon == null) return [];
    const pending = Number(block.validas || 0) <= 0;
    return [{
      id: block.id_manzana || `block-${index}`,
      label: `UMP ${block.ump || "S/D"} · ${block.zona || ""}${block.manzana ? `-${block.manzana}` : ""}`,
      lat,
      lon,
      kind: isReplacementBlock(block) ? "replacement" : pending ? "pending" : "block",
      district: block.distrito,
    }];
  });
}

function makeGpsMapPoints(reports: MonitoreoTerritorialDashboard): LightMapPoint[] {
  return (reports.map?.points ?? []).flatMap((point, index) => {
    const lat = numberOrNull(point.gps_effective_lat ?? point.gps_primary_lat ?? point.lat);
    const lon = numberOrNull(point.gps_effective_lon ?? point.gps_primary_lon ?? point.lon);
    if (lat == null || lon == null) return [];
    const status = String(point.geo_estado || point.gps_effective_estado || point.gps_primary_estado || "").toLowerCase();
    return [{
      id: point.response_id || `gps-${index}`,
      label: `${point.declared_ump_normalized || point.advance_block_ump || "UMP S/D"} · ${point.responsible_display || point.submitted_by || "Sin responsable"}`,
      lat,
      lon,
      kind: status.includes("revision") || status.includes("fuera") || status.includes("sin cruce") ? "review" : "gps",
      district: point.distrito,
    }];
  });
}

function projectLightMap(points: LightMapPoint[], zoom: number) {
  if (!points.length) return [];
  const lats = points.map((point) => point.lat);
  const lons = points.map((point) => point.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const latSpan = Math.max(0.001, maxLat - minLat);
  const lonSpan = Math.max(0.001, maxLon - minLon);
  const centerX = 500;
  const centerY = 250;
  const scale = Math.max(1, Math.min(3.6, zoom));
  return points.map((point) => {
    const x = 60 + ((point.lon - minLon) / lonSpan) * 880;
    const y = 460 - ((point.lat - minLat) / latSpan) * 420;
    return {
      ...point,
      x: centerX + (x - centerX) * scale,
      y: centerY + (y - centerY) * scale,
    };
  });
}

function LightTerritorialMap({
  blocks,
  gpsPoints,
  interactive,
}: {
  blocks: TerritorialBlockProgress[];
  gpsPoints?: LightMapPoint[];
  interactive?: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const blockPoints = useMemo(() => makeBlockMapPoints(blocks), [blocks]);
  const points = useMemo(() => [...blockPoints, ...(gpsPoints ?? [])], [blockPoints, gpsPoints]);
  const projected = useMemo(() => projectLightMap(points, zoom), [points, zoom]);
  const hasCoordinates = projected.length > 0;
  return (
    <div className={`ter-lite-map ${interactive ? "ter-lite-map--interactive" : ""}`}>
      {interactive ? (
        <div className="ter-lite-map__tools" aria-label="Controles de mapa">
          <button type="button" aria-label="Acercar" onClick={() => setZoom((value) => Math.min(3.6, value * 1.35))}><Plus size={13} /></button>
          <button type="button" aria-label="Alejar" onClick={() => setZoom((value) => Math.max(1, value / 1.35))}><Minus size={13} /></button>
          <button type="button" aria-label="Ver todo" onClick={() => setZoom(1)}><Maximize2 size={13} /></button>
          <span>{zoom.toFixed(1)}x</span>
        </div>
      ) : null}
      {hasCoordinates ? (
        <svg viewBox="0 0 1000 500" role="img" aria-label="Mapa liviano de manzanas territoriales">
          <rect x="0" y="0" width="1000" height="500" rx="18" />
          <g className="ter-lite-map__grid">
            {Array.from({ length: 9 }).map((_, index) => <line key={`v-${index}`} x1={100 + index * 100} y1="34" x2={100 + index * 100} y2="466" />)}
            {Array.from({ length: 5 }).map((_, index) => <line key={`h-${index}`} x1="46" y1={70 + index * 86} x2="954" y2={70 + index * 86} />)}
          </g>
          <g>
            {projected.map((point) => (
              <circle
                key={`${point.kind}-${point.id}`}
                className={`is-${point.kind}`}
                cx={point.x}
                cy={point.y}
                r={point.kind === "gps" || point.kind === "review" ? 3.4 : 5.6}
              >
                <title>{`${point.label}${point.district ? ` · ${point.district}` : ""}`}</title>
              </circle>
            ))}
          </g>
        </svg>
      ) : (
        <div className="ter-map-lite">
          <div>
            <MapPinned size={22} />
            <strong>Capa territorial pendiente</strong>
            <span>La tabla ya está disponible; las coordenadas locales se dibujarán cuando existan en caché.</span>
          </div>
        </div>
      )}
      <div className="ter-lite-map__legend" aria-label="Leyenda">
        <span><i className="is-block" /> Titular</span>
        <span><i className="is-pending" /> No iniciada</span>
        <span><i className="is-replacement" /> Reemplazo</span>
        {gpsPoints?.length ? <span><i className="is-gps" /> GPS</span> : null}
        {gpsPoints?.length ? <span><i className="is-review" /> Revisar</span> : null}
      </div>
    </div>
  );
}

function SourceView({ reports }: { reports: MonitoreoTerritorialDashboard | null }) {
  if (!reports) {
    return <EmptyPanel icon={DatabaseZap} title="Fuente pendiente" detail="Todavía no hay resumen local de la fuente territorial." />;
  }
  const source = reports.source_coherence;
  const validity = reports.source_validity;
  const drift = source?.drift ?? [];
  return (
    <div className="ter-grid ter-grid--two">
      <section className="ter-panel">
        <h3>Formulario Kobo</h3>
        <dl className="ter-dl">
          <div><dt>Nombre</dt><dd>{source?.asset_name || "Sin nombre"}</dd></div>
          <div><dt>Versión</dt><dd>{source?.version_id || "S/D"}</dd></div>
          <div><dt>Registros Kobo</dt><dd>{fmt(source?.survey_count, "S/D")}</dd></div>
          <div><dt>Campo distrito</dt><dd>{source?.district_field || "Sin configurar"}</dd></div>
        </dl>
      </section>
      <section className="ter-panel">
        <h3>Filtro efectivo</h3>
        <div className="ter-stat-row">
          <StatTile label="Efectivas" value={fmt(validity?.effective_count, "S/D")} tone="good" />
          <StatTile label="No efectivas" value={fmt(validity?.non_effective_count, "S/D")} tone="warn" />
          <StatTile label="Sin dato" value={fmt(validity?.missing_count, "S/D")} />
        </div>
        {drift.length ? (
          <ul className="ter-alert-list">
            {drift.slice(0, 6).map((item, index) => <li key={index}>{item.message}</li>)}
          </ul>
        ) : <p className="ter-muted">Sin alertas de estructura detectadas.</p>}
      </section>
    </div>
  );
}

function RouteView({ reports }: { reports: MonitoreoTerritorialDashboard | null }) {
  if (!reports) {
    return <EmptyPanel icon={Route} title="Manzanas pendientes" detail="La muestra territorial todavía no está hidratada en memoria." />;
  }
  const blocks = reports.route_blocks?.length ? reports.route_blocks : reports.map?.blocks ?? reports.block_progress ?? [];
  const overview = reports.route_overview;
  const points = reports.map?.points ?? [];
  return (
    <div className="ter-stack">
      <div className="ter-stat-row">
        <StatTile label="Manzanas" value={fmt(overview?.operational_block_count ?? blocks.length)} />
        <StatTile label="Reemplazos" value={fmt(overview?.replacement_count, "0")} />
        <StatTile label="Distritos" value={fmt(overview?.district_count, "0")} />
        <StatTile label="GPS visibles" value={fmt(points.length)} tone="good" />
      </div>
      <section className="ter-panel">
        <div className="ter-panel-head">
          <h3>Mapa general de Lima</h3>
          <span>Vista ligera · {fmt(blocks.length)} manzanas</span>
        </div>
        <LightTerritorialMap blocks={blocks} />
      </section>
      <section className="ter-panel">
        <div className="ter-panel-head">
          <h3>Manzanas seleccionadas</h3>
          <span>{fmt(blocks.length)} registros locales</span>
        </div>
        <DataTable<TerritorialBlockProgress>
          rows={blocks.slice(0, 40)}
          empty="No hay manzanas hidratadas para esta fase."
          columns={[
            { key: "ump", label: "UMP", render: (row) => row.ump || "" },
            { key: "mz", label: "Manzana", render: (row) => `${row.zona || ""} · ${row.manzana || row.id_manzana || ""}` },
            { key: "distrito", label: "Distrito", render: (row) => row.distrito },
            { key: "tipo", label: "Tipo", render: (row) => row.tipo_manzana },
            { key: "validas", label: "Válidas", render: (row) => fmt(row.validas) },
            { key: "meta", label: "Meta", render: (row) => fmt(row.meta, "S/D") },
          ]}
        />
      </section>
    </div>
  );
}

function ValidationView({ reports }: { reports: MonitoreoTerritorialDashboard | null }) {
  const [showReplacements, setShowReplacements] = useState(false);
  const gpsPoints = useMemo(() => (reports ? makeGpsMapPoints(reports) : []), [reports]);
  if (!reports) {
    return <EmptyPanel icon={ShieldAlert} title="Validación pendiente" detail="Todavía no hay auditoría territorial hidratada." />;
  }
  const rows = reports.response_audit ?? [];
  const routeBlocks = reports.route_blocks?.length ? reports.route_blocks : reports.map?.blocks ?? reports.block_progress ?? [];
  const visibleBlocks = showReplacements
    ? routeBlocks
    : routeBlocks.filter((block) => !isReplacementBlock(block));
  const notStarted = routeBlocks.filter((block) => Number(block.validas || 0) <= 0).length;
  const replacements = routeBlocks.filter(isReplacementBlock).length;
  return (
    <div className="ter-stack">
      <div className="ter-stat-row">
        <StatTile label="GPS en zona" value={fmt(reports.kpis.geo_ok)} tone="good" />
        <StatTile label="GPS por revisar" value={fmt(reports.kpis.geo_revision)} tone="warn" />
        <StatTile label="Sin GPS" value={fmt(reports.kpis.geo_sin_gps ?? 0)} />
        <StatTile label="Duración p95" value={reports.kpis.duration_p95 == null ? "S/D" : `${fmt(reports.kpis.duration_p95)} min`} />
      </div>
      <section className="ter-panel">
        <div className="ter-panel-head">
          <h3>Mapa operativo único</h3>
          <span>{fmt(visibleBlocks.length)} de {fmt(routeBlocks.length)} manzanas visibles · {fmt(notStarted)} no iniciadas</span>
        </div>
        <div className="ter-map-toolbar">
          <button
            type="button"
            className={!showReplacements ? "is-active" : ""}
            onClick={() => setShowReplacements(false)}
          >
            Titulares
          </button>
          <button
            type="button"
            className={showReplacements ? "is-active" : ""}
            onClick={() => setShowReplacements(true)}
          >
            Incluir reemplazos ({fmt(replacements)})
          </button>
        </div>
        <LightTerritorialMap blocks={visibleBlocks} gpsPoints={gpsPoints} interactive />
      </section>
      <section className="ter-panel">
        <div className="ter-panel-head">
          <h3>Registros auditados</h3>
          <span>{fmt(rows.length)} casos</span>
        </div>
        <DataTable<TerritorialResponseAuditRow>
          rows={rows.slice(0, 45)}
          empty="No hay registros de validación en el scope actual."
          columns={[
            { key: "fecha", label: "Fecha", render: (row) => row.submission_date || row.submission_time || "" },
            { key: "ump", label: "UMP", render: (row) => row.declared_ump_normalized || row.declared_ump_raw || "" },
            { key: "distrito", label: "Distrito", render: (row) => row.distrito },
            { key: "gps", label: "GPS", render: (row) => row.geo_estado },
            { key: "duracion", label: "Duración", render: (row) => row.duration_operational_label || row.duration_status || "" },
            { key: "responsable", label: "Responsable", render: (row) => row.responsible_display || row.submitted_by || "" },
          ]}
        />
      </section>
      <section className="ter-panel">
        <div className="ter-panel-head">
          <h3>Manzanas consideradas por el mapa</h3>
          <span>{fmt(visibleBlocks.length)} visibles</span>
        </div>
        <DataTable<TerritorialBlockProgress>
          rows={visibleBlocks.slice(0, 40)}
          empty="No hay manzanas disponibles para el mapa de validación."
          columns={[
            { key: "ump", label: "UMP", render: (row) => row.ump || "" },
            { key: "mz", label: "Manzana", render: (row) => `${row.zona || ""} · ${row.manzana || row.id_manzana || ""}` },
            { key: "tipo", label: "Tipo", render: (row) => row.tipo_manzana || "titular" },
            { key: "validas", label: "Válidas", render: (row) => fmt(row.validas) },
            { key: "responsable", label: "Responsable", render: (row) => row.responsable || "" },
          ]}
        />
      </section>
    </div>
  );
}

function QueriesView({ reports }: { reports: MonitoreoTerritorialDashboard | null }) {
  if (!reports) {
    return <EmptyPanel icon={Search} title="Consultas pendientes" detail="Todavía no hay consultas internas hidratadas." />;
  }
  const queries = reports.internal_queries;
  const review = queries?.review_cases ?? [];
  return (
    <div className="ter-stack">
      <div className="ter-stat-row">
        <StatTile label="Manzanas incompletas" value={fmt(queries?.incomplete_blocks?.length ?? 0)} tone="warn" />
        <StatTile label="GPS lejanos" value={fmt(queries?.far_gps?.length ?? 0)} tone="warn" />
        <StatTile label="Distritos rezagados" value={fmt(queries?.lagging_districts?.length ?? 0)} />
        <StatTile label="Casos revisión" value={fmt(review.length)} />
      </div>
      <section className="ter-panel">
        <div className="ter-panel-head">
          <h3>Casos accionables</h3>
          <span>{fmt(review.length)} registros</span>
        </div>
        <DataTable<TerritorialInternalReviewCase>
          rows={review.slice(0, 45)}
          empty="No hay casos accionables en este corte."
          columns={[
            { key: "tipo", label: "Tipo", render: (row) => row.type },
            { key: "motivo", label: "Motivo", render: (row) => row.reason },
            { key: "distrito", label: "Distrito", render: (row) => row.district },
            { key: "ump", label: "UMP", render: (row) => row.ump || "" },
            { key: "responsable", label: "Responsable", render: (row) => row.responsible || "" },
          ]}
        />
      </section>
    </div>
  );
}

function AdvanceView({ reports }: { reports: MonitoreoTerritorialDashboard | null }) {
  if (!reports) {
    return <EmptyPanel icon={BarChart3} title="Avance pendiente" detail="Todavía no hay avance territorial hidratado." />;
  }
  const districtRows = reports.advance?.district_progress ?? reports.district_progress ?? [];
  const daily = reports.advance?.daily ?? reports.daily ?? [];
  return (
    <div className="ter-stack">
      <div className="ter-stat-row">
        <StatTile label="Válidas" value={fmt(reports.kpis.validas)} tone="good" />
        <StatTile label="Meta" value={fmt(reports.kpis.meta, "S/D")} />
        <StatTile label="Avance" value={pct(reports.kpis.avance_pct)} tone="good" />
        <StatTile label="Brecha" value={fmt(reports.advance?.brecha, "S/D")} tone="warn" />
      </div>
      <section className="ter-panel">
        <div className="ter-panel-head">
          <h3>Avance por distrito</h3>
          <span>{fmt(districtRows.length)} distritos</span>
        </div>
        <DataTable<TerritorialDistrictProgress>
          rows={districtRows.slice(0, 30)}
          empty="No hay avance por distrito hidratado."
          columns={[
            { key: "distrito", label: "Distrito", render: (row) => row.distrito },
            { key: "validas", label: "Válidas", render: (row) => fmt(row.validas) },
            { key: "meta", label: "Meta", render: (row) => fmt(row.meta, "S/D") },
            { key: "avance", label: "Avance", render: (row) => pct(row.avance_pct) },
            { key: "brecha", label: "Brecha", render: (row) => fmt(row.brecha, "S/D") },
          ]}
        />
      </section>
      <section className="ter-panel">
        <div className="ter-panel-head">
          <h3>Ritmo diario</h3>
          <span>{fmt(daily.length)} días</span>
        </div>
        <DataTable<{ date: string; date_label?: string; total: number; validas: number; revision: number }>
          rows={daily.slice(-20).reverse()}
          empty="No hay serie diaria disponible."
          columns={[
            { key: "fecha", label: "Fecha", render: (row) => row.date_label || row.date },
            { key: "total", label: "Total", render: (row) => fmt(row.total) },
            { key: "validas", label: "Válidas", render: (row) => fmt(row.validas) },
            { key: "revision", label: "Revisión", render: (row) => fmt(row.revision) },
          ]}
        />
      </section>
    </div>
  );
}

function OccurrencesView({ reports }: { reports: MonitoreoTerritorialDashboard | null }) {
  const occurrences = reports?.field_occurrences;
  return (
    <div className="ter-stack">
      <div className="ter-stat-row">
        <StatTile label="Ocurrencias" value={fmt((occurrences as { total?: number } | null | undefined)?.total, "S/D")} />
        <StatTile label="Registros campo" value={fmt(reports?.kpis.total_respuestas, "S/D")} />
        <StatTile label="Equipo" value={fmt(reports?.team?.length ?? 0)} />
      </div>
      <section className="ter-panel">
        <h3>Ocurrencias de campo</h3>
        <p className="ter-muted">
          Esta vista ya carga dentro del perfil territorial ligero. La explotación detallada de ocurrencias queda preparada para extraerse como subvista territorial propia.
        </p>
      </section>
    </div>
  );
}

function renderView(view: WorkbenchView, reports: MonitoreoTerritorialDashboard | null) {
  if (view === "fuentes") return <SourceView reports={reports} />;
  if (view === "modelo") return <RouteView reports={reports} />;
  if (view === "calidad") return <ValidationView reports={reports} />;
  if (view === "consultas") return <QueriesView reports={reports} />;
  if (view === "avance") return <AdvanceView reports={reports} />;
  if (view === "ocurrencias") return <OccurrencesView reports={reports} />;
  return null;
}

export default function TerritorialMonitoreoPage() {
  const [state, setState] = useState<MonitoreoState | null>(null);
  const [activeView, setActiveView] = useState<WorkbenchView>("fuentes");
  const [phase, setPhase] = useState<MonitoreoTerritorialPhase>("field");
  const [loadingView, setLoadingView] = useState<WorkbenchView | "initial" | "background" | null>("initial");
  const [error, setError] = useState("");
  const inFlightRef = useRef(new Set<string>());

  const sourceKey = state ? territorialSourceKeyFromState(state, phase) : "sin-fuente";
  const preferredScope = scopeForPhaseView(phase, activeView);
  const cachedEntry = state
    ? monitoreoScopeCache.findTerritorialForView({ phase, source: sourceKey, view: activeView, preferredScope })
    : null;
  const rawReports = reportsFromState(state);
  const reports = rawReports && territorialReportsCoverView(rawReports, activeView)
    ? rawReports
    : cachedEntry?.reports ?? null;
  const reportReady = Boolean(reports && territorialReportsCoverView(reports, activeView));

  const loadScope = useCallback(async (scope: MonitoreoReportScope, viewForLoading?: WorkbenchView, force = false) => {
    const key = `${phase}|${sourceKey}|${scope}`;
    if (inFlightRef.current.has(key)) return null;
    inFlightRef.current.add(key);
    if (viewForLoading) setLoadingView(viewForLoading);
    try {
      const next = await apiMonitoreoState({ includeReports: true, reportScope: scope, warmupCache: !force, force });
      monitoreoScopeCache.putTerritorialState(next);
      setState(next);
      setError("");
      return next;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      inFlightRef.current.delete(key);
      if (viewForLoading) setLoadingView(null);
    }
  }, [phase, sourceKey]);

  useEffect(() => {
    let cancelled = false;
    setLoadingView("initial");
    apiMonitoreoState({ includeReports: false, warmupCache: true })
      .then(async (next) => {
        if (cancelled) return;
        let nextPhase = preferredTerritorialPhase(next);
        const backendPhase = next.config?.territorial?.active_route_phase ?? "field";
        if (nextPhase !== backendPhase) {
          const phaseResult = await apiMonitoreoTerritorialPhase(nextPhase).catch(() => null);
          if (!phaseResult?.ok) nextPhase = backendPhase;
        }
        const nextState = withTerritorialPhase(next, nextPhase);
        setPhase(nextPhase);
        setState(nextState);
        const nextView = nextPhase === "pilot" ? "avance" : activeView;
        setActiveView(nextView);
        const scope = scopeForPhaseView(nextPhase, nextView);
        const hydrated = await apiMonitoreoState({ includeReports: true, reportScope: scope, warmupCache: true });
        if (cancelled) return;
        monitoreoScopeCache.putTerritorialState(hydrated);
        setState(hydrated);
        setLoadingView(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError((e as Error).message);
          setLoadingView(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!viewAllowedInPhase(phase, activeView)) setActiveView("avance");
  }, [activeView, phase]);

  useEffect(() => {
    if (!state) return;
    const source = territorialSourceKeyFromState(state, phase);
    const cached = monitoreoScopeCache.findTerritorialForView({
      phase,
      source,
      view: activeView,
      preferredScope: scopeForPhaseView(phase, activeView),
    });
    if (cached) return;
    void loadScope(scopeForPhaseView(phase, activeView), activeView);
  }, [activeView, loadScope, phase, state]);

  useEffect(() => {
    if (!state || loadingView === "initial") return;
    let cancelled = false;
    const run = async () => {
      setLoadingView("background");
      for (const scope of scopesForPhase(phase)) {
        if (cancelled) return;
        await loadScope(scope);
      }
      if (!cancelled) setLoadingView(null);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [state?.synced_at, phase]);

  const visibleViews = useMemo(
    () => TERRITORIAL_WORKBENCH_VIEWS.filter((item) => viewAllowedInPhase(phase, item.key)),
    [phase],
  );
  const activeDef = useMemo(
    () => visibleViews.find((item) => item.key === activeView) ?? visibleViews[0] ?? TERRITORIAL_WORKBENCH_VIEWS[0],
    [activeView, visibleViews],
  );
  const headerValidas = reports?.kpis.validas ?? state?.dashboard?.kpis.valid ?? null;
  const headerMeta = reports?.kpis.meta ?? state?.dashboard?.kpis.target ?? null;
  const headerAvance = reports?.kpis.avance_pct ?? state?.dashboard?.kpis.avance_pct ?? null;
  const cacheMeta = state?.territorial_report_cache;

  return (
    <div className="mon-page ter-page" style={MODULE_TONES.monitoreo as CSSProperties}>
      <header className="ter-topbar">
        <div className="ter-brand">
          <span className="ter-brand__icon"><MapPinned size={18} /></span>
          <div>
            <strong>Territorial</strong>
            <span>{labelForPhase(phase)} · {fmt(state?.n_rows ?? reports?.kpis.total_respuestas)} registros</span>
          </div>
        </div>
        <nav className="ter-section-rail" aria-label="Secciones de monitoreo territorial">
          {visibleViews.map((view, index) => {
            const Icon = VIEW_ICONS[view.key] ?? Route;
            return (
              <button
                key={view.key}
                type="button"
                className={view.key === activeView ? "is-active" : ""}
                onClick={() => setActiveView(view.key)}
              >
                <span>{index + 1}</span>
                <Icon size={14} />
                {view.shortLabel ?? view.label}
              </button>
            );
          })}
        </nav>
        <div className="ter-actions">
          <button type="button" onClick={() => void loadScope(preferredScope, activeView, true)}>
            <RefreshCw size={14} />
            Actualizar vista
          </button>
        </div>
      </header>

      <main className="ter-workbench">
        <aside className="ter-sidebar">
          <div className="ter-context">
            <span>PATH ACTIVO</span>
            <strong>Territorial</strong>
            <small>{activeDef.label}</small>
          </div>
          <div className="ter-phase">
            <span>Formato territorial</span>
            <strong>{labelForPhase(phase)}</strong>
            <small>Según la configuración local del proyecto.</small>
          </div>
          <div className="ter-readiness">
            <span>{reportReady ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}</span>
            <div>
              <strong>{reportReady ? "Vista lista" : "Preparando vista"}</strong>
              <small>{cacheMeta?.cache_source ? `Caché ${cacheMeta.cache_source}` : "Memoria local"}</small>
            </div>
          </div>
        </aside>

        <section className="ter-content">
          <div className="ter-content-head">
            <div>
              <span>Territorial · flujo actual</span>
              <h2>{activeDef.label}</h2>
              <p>{activeDef.desc}</p>
            </div>
            <div className="ter-kpi-strip">
              <StatTile label="Válidas" value={fmt(headerValidas)} tone="good" />
              <StatTile label="Meta" value={fmt(headerMeta, "S/D")} />
              <StatTile label="Avance" value={pct(headerAvance)} />
            </div>
          </div>

          {error && (
            <div className="ter-inline-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {loadingView === activeView || loadingView === "initial" ? (
            <EmptyPanel icon={RefreshCw} title="Preparando vista" detail="Leyendo caché local del proyecto..." />
          ) : (
            renderView(activeView, reports)
          )}
        </section>
      </main>
    </div>
  );
}
