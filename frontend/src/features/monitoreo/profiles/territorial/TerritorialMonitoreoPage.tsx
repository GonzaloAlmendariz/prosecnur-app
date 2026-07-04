import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  ContactRound,
  DatabaseZap,
  Download,
  Link2,
  ListChecks,
  Loader2,
  MapPin,
  MapPinned,
  Maximize2,
  Minus,
  Plus,
  PlugZap,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Table2,
  Target,
  Trash2,
} from "lucide-react";
import {
  apiMonitoreoState,
  apiMonitoreoTerritorialOperationalAdjustmentApply,
  apiMonitoreoTerritorialOperationalAdjustmentReset,
  apiMonitoreoTerritorialOperationalAdjustmentRevert,
  apiMonitoreoTerritorialPhase,
  type MonitoreoState,
  type MonitoreoTerritorialDashboard,
  type MonitoreoTerritorialConfig,
  type MonitoreoTerritorialOperationalAdjustment,
  type MonitoreoTerritorialPhase,
  type MonitoreoTerritorialPhaseCoherenceItem,
  type MonitoreoTerritorialReportCacheMeta,
  type TerritorialBlockProgress,
  type TerritorialDistrictProgress,
  type TerritorialResponseAuditRow,
} from "../../../../api/client";
import { Alert } from "../../../../components/Alert";
import { PageFrame } from "../../../../components/PageFrame";
import { MonitoreoWorkbenchChrome, MonitoreoWorkbenchHead, MonitoreoWorkbenchRail } from "../../components";
import {
  MONITOREO_ROUTES,
  TERRITORIAL_WORKBENCH_VIEWS,
  type WorkbenchView,
  type WorkbenchViewDefinition,
} from "../../core/monitoreoRegistry";
import { territorialDurationOperationalStatusFromValues } from "../../territorialDuration";
import {
  monitoreoScopeCache,
  reportScopesForTerritorialView,
  territorialReportsCoverView,
  territorialSourceKeyFromState,
} from "../../core/reportScopeCache";
import { MonitoreoModuleChrome } from "../../shell/MonitoreoModuleChrome";
import type { MonitoreoReportScope } from "../types";
import { TerritorialAdvanceWorkbench } from "./TerritorialAdvanceWorkbench";
import { TerritorialDurationControl } from "./TerritorialDurationControl";
import { TerritorialFieldOccurrencesWorkbench } from "./TerritorialFieldOccurrencesWorkbench";
import { TerritorialOutputsPanel } from "./TerritorialOutputsPanel";
import { TerritorialModelWorkbench } from "./TerritorialModelWorkbench";
import { TerritorialQuotaConsistencyPanel } from "./TerritorialQuotaConsistencyPanel";
import { TerritorialProductionAnnulmentWorkspace } from "./TerritorialProductionAnnulmentWorkspace";
import { TerritorialReviewCasesWorkbench } from "./TerritorialReviewCasesWorkbench";
import { TerritorialSourceConsole } from "./TerritorialSourceConsole";
import {
  TerritorialSpatialReconciliationWorkbench,
  TerritorialValidationGeoWorkbench,
} from "./TerritorialValidationGeoWorkbench";
import "../../monitoreo.css";
import "../../shell/monitoreoShell.css";
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
const TERRITORIAL_ROUTE = MONITOREO_ROUTES.find((route) => route.family === "territorial") ?? MONITOREO_ROUTES[0];
type TerritorialLocalTabDefinition = {
  key: string;
  label: string;
  detail: string;
  icon: typeof Route;
};
const TERRITORIAL_LOCAL_TABS = {
  fuentes: [
    { key: "form", label: "Formulario", detail: "Kobo y corte local", icon: DatabaseZap },
    { key: "filter", label: "Filtro y distritos", detail: "Efectivas y alcance", icon: SlidersHorizontal },
    { key: "roster", label: "Encuestadores", detail: "Códigos Pulso", icon: ContactRound },
    { key: "reconciliation", label: "Reconciliación", detail: "Códigos y UMP", icon: Link2 },
    { key: "history", label: "Historial", detail: "Eventos del corte", icon: Clock },
  ],
  modelo: [
    { key: "resumen", label: "Cobertura", detail: "Zonas, UMP y responsables", icon: BarChart3 },
    { key: "tabla", label: "Manzanas", detail: "Orden, titulares y reemplazos", icon: Table2 },
  ],
  calidad: [
    { key: "geolocalizacion", label: "Geolocalización", detail: "GPS y cartografía", icon: MapPin },
    { key: "reconciliacion", label: "Reconciliación UMP", detail: "Sospechas espaciales", icon: Route },
    { key: "duracion", label: "Duración de tiempo", detail: "Normal, corta y muy corta", icon: Clock },
    { key: "cuotas", label: "Cuotas", detail: "Marginales y brechas", icon: Target },
    { key: "anulacion", label: "Anulación", detail: "Tacha auditada", icon: Trash2 },
  ],
  consultas: [
    { key: "registro", label: "Registro", detail: "Tabla principal", icon: Table2 },
    { key: "gps", label: "GPS con señal", detail: "Distancia y cruce", icon: MapPin },
    { key: "duracion", label: "Tiempo corto/muy corto", detail: "Normal, corta y muy corta", icon: Clock },
    { key: "responsable", label: "Cruce responsable", detail: "UMP y equipo", icon: ContactRound },
    { key: "subsanaciones", label: "Subsanaciones", detail: "Excedentes y brechas", icon: ArrowRight },
  ],
  avance: [
    { key: "resumen", label: "Resumen", detail: "KPI territorial", icon: BarChart3 },
    { key: "ump", label: "Mapa y UMP", detail: "Ritmo por manzana", icon: Route },
    { key: "ritmo", label: "Ritmo diario", detail: "Tendencia del corte", icon: CalendarRange },
    { key: "salidas", label: "Salidas", detail: "PDF y Sheets", icon: Download },
  ],
  ocurrencias: [
    { key: "states", label: "Estados general", detail: "Efectivas y no efectivas", icon: ClipboardCheck },
    { key: "ump", label: "Por UMP", detail: "Seguimiento territorial", icon: Route },
    { key: "alerts", label: "Observaciones", detail: "Señales operativas", icon: ShieldAlert },
  ],
  telefonico: [],
} satisfies Record<WorkbenchView, readonly TerritorialLocalTabDefinition[]>;
const TERRITORIAL_ADVANCE_TABS = TERRITORIAL_LOCAL_TABS.avance;
type TerritorialAdvanceLocalTab = typeof TERRITORIAL_ADVANCE_TABS[number]["key"];

function defaultLocalTabForView(view: WorkbenchView) {
  return TERRITORIAL_LOCAL_TABS[view]?.[0]?.key ?? "";
}

function isTerritorialAdvanceLocalTab(value: unknown): value is TerritorialAdvanceLocalTab {
  return TERRITORIAL_ADVANCE_TABS.some((tab) => tab.key === value);
}

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

function territorialOperationalDurationLabel(row: Partial<TerritorialResponseAuditRow>) {
  const seconds = Number(row.duration_seconds);
  const status = territorialDurationOperationalStatusFromValues({
    seconds: Number.isFinite(seconds) ? seconds : null,
    durationStatus: row.duration_status,
    durationOperationalStatus: row.duration_operational_status,
    durationOperationalLabel: row.duration_operational_label,
  });
  if (status === "muy_corto") return "Muy corta";
  if (status === "corto") return "Corta";
  return "Normal";
}

function nullableMetric(value: unknown) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

function labelForPhase(phase: string) {
  return phase === "pilot" ? "Piloto" : "Campo";
}

function territorialPhaseHealthForState(
  state: MonitoreoState | null,
  phase: MonitoreoTerritorialPhase,
): MonitoreoTerritorialPhaseCoherenceItem | null {
  const coherence = state?.territorial_phase_coherence ?? state?.dashboard?.territorial_reports?.phase_coherence ?? null;
  return coherence?.phases?.[phase] ?? (coherence?.active?.phase === phase ? coherence.active : null) ?? null;
}

function territorialPhaseStatusLabel(
  item: MonitoreoTerritorialPhaseCoherenceItem | null,
  phase: MonitoreoTerritorialPhase,
) {
  const label = labelForPhase(phase);
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
      return item.status || "Sin diagnóstico";
  }
}

function territorialReportCacheLabel(
  reportReady: boolean,
  loadingView: WorkbenchView | "initial" | "background" | null,
  meta: MonitoreoTerritorialReportCacheMeta | null | undefined,
) {
  if (reportReady && (meta?.cache_hit || meta?.cache_source === "project" || meta?.cache_source === "snapshot")) {
    return "Cargado desde proyecto";
  }
  if (reportReady) return "Resumen listo";
  if (loadingView) return "Actualizando resumen";
  return "Reporte pendiente";
}

function territorialReportCacheDetail(
  meta: MonitoreoTerritorialReportCacheMeta | null | undefined,
  fallbackSource?: string,
) {
  const source = meta?.cache_source || fallbackSource || "";
  const scope = meta?.report_scope ? String(meta.report_scope).replaceAll("_", " ") : "";
  const payload = Number(meta?.payload_size);
  const size = Number.isFinite(payload) && payload > 0 ? `${Math.round(payload / 1024)} KB` : "";
  const sourceLabel = source === "project"
    ? "caché del proyecto"
    : source === "snapshot"
      ? "snapshot local"
      : source === "build"
        ? "reconstruido"
        : source === "session"
          ? "sesión"
          : source || "memoria local";
  return [sourceLabel, scope, size].filter(Boolean).join(" · ");
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

function scopeForPhaseViewTab(
  phase: MonitoreoTerritorialPhase,
  view: WorkbenchView,
  _localTab = "",
): MonitoreoReportScope {
  if (phase === "pilot") return "advance_summary";
  return scopeForView(view);
}

function territorialReportsCoverSelection(
  reports: MonitoreoTerritorialDashboard | null | undefined,
  view: WorkbenchView,
  localTab = "",
) {
  if (!reports) return false;
  const scope = (reports.report_scope || "full") as MonitoreoReportScope;
  if (view === "avance" && localTab !== "ritmo") {
    return ["advance_summary", "validation_summary", "full"].includes(scope);
  }
  return territorialReportsCoverView(reports, view);
}

function viewNeedsTerritorialReport(view: WorkbenchView, localTab = "") {
  if (view === "fuentes") return false;
  if (view === "avance" && localTab === "salidas") return false;
  return true;
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

function territorialReportKpis(
  reports: MonitoreoTerritorialDashboard | null | undefined,
): Partial<MonitoreoTerritorialDashboard["kpis"]> {
  if (!reports) return {};
  if (reports.report_scope === "source" && reports.source_validity?.effective_count != null) {
    return {
      ...(reports.kpis ?? {}),
      validas: reports.source_validity.effective_count,
      meta: null,
      avance_pct: null,
    };
  }
  if (!reports.advance) return reports.kpis ?? {};
  return {
    ...(reports.kpis ?? {}),
    total_respuestas: reports.advance.total_respuestas ?? reports.kpis?.total_respuestas,
    validas: reports.advance.validas ?? reports.kpis?.validas,
    revision: reports.advance.observacion ?? reports.kpis?.revision,
    no_defendibles: reports.advance.no_validas ?? reports.kpis?.no_defendibles,
    meta: reports.advance.meta ?? reports.kpis?.meta,
    avance_pct: reports.advance.avance_pct ?? reports.kpis?.avance_pct,
  };
}

function TerritorialWorkbenchRail({
  activeDef,
  activeLocalTab,
  activeView,
  cacheMeta,
  error,
  fieldPhaseHealth,
  localTabs,
  loadingView,
  onLocalTabChange,
  onPhaseChange,
  phase,
  pilotPhaseHealth,
  reportReady,
  syncedAt,
}: {
  activeDef: WorkbenchViewDefinition;
  activeLocalTab: string;
  activeView: WorkbenchView;
  cacheMeta?: MonitoreoTerritorialReportCacheMeta | null;
  error: string;
  fieldPhaseHealth: MonitoreoTerritorialPhaseCoherenceItem | null;
  localTabs: readonly TerritorialLocalTabDefinition[];
  loadingView: WorkbenchView | "initial" | "background" | null;
  onLocalTabChange: (tab: string) => void;
  onPhaseChange: (phase: MonitoreoTerritorialPhase) => void;
  phase: MonitoreoTerritorialPhase;
  pilotPhaseHealth: MonitoreoTerritorialPhaseCoherenceItem | null;
  reportReady: boolean;
  syncedAt: string;
}) {
  const ActiveIcon = VIEW_ICONS[activeView] ?? activeDef.icon ?? Route;
  const flowTone = error ? "error" : reportReady ? "ready" : "warning";
  const flowProgress = reportReady ? "100%" : loadingView ? "42%" : "18%";
  const activePhaseHealth = phase === "pilot" ? pilotPhaseHealth : fieldPhaseHealth;
  const reportCacheLabel = territorialReportCacheLabel(reportReady, loadingView, cacheMeta);
  const reportCacheDetail = territorialReportCacheDetail(cacheMeta);
  const phaseStatusClass = error ? "error" : activePhaseHealth?.status || (reportReady ? "configured" : "missing_source");
  const phaseStatusText = error || territorialPhaseStatusLabel(activePhaseHealth, phase);
  const phaseOptions = [
    { key: "pilot" as const, label: "Piloto", hint: territorialPhaseBadgeLabel(pilotPhaseHealth) },
    { key: "field" as const, label: "Campo", hint: territorialPhaseBadgeLabel(fieldPhaseHealth) },
  ];

  const summary = (
    <section
        className={`mon-flow-overview is-${flowTone}`}
        aria-label="Avance del flujo territorial"
        style={{ "--mon-flow-progress": flowProgress } as CSSProperties}
      >
        <div className="mon-flow-overview-head">
          <span>Flujo territorial</span>
          <strong>{reportCacheLabel}</strong>
        </div>
        <div className="mon-flow-track" aria-hidden="true"><span /></div>
        <small>
          {error || (reportReady
            ? `${activeDef.label} disponible · ${reportCacheDetail || "memoria local"}`
            : loadingView === "background"
              ? "Hidratando scopes en segundo plano"
              : phaseStatusText)}
        </small>
    </section>
  );
  const phaseSwitch = (
      <div className="mon-rail-phase-switch" aria-label="Formato territorial">
        <span>Formato territorial</span>
        <div role="tablist" aria-label="Piloto o campo">
          {phaseOptions.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={phase === item.key}
              className={phase === item.key ? "is-active" : ""}
              disabled={phase === item.key || loadingView === "initial"}
              onClick={() => onPhaseChange(item.key)}
            >
              <strong>{item.label}</strong>
              <small>{item.hint}</small>
            </button>
          ))}
        </div>
        <em className={`mon-rail-phase-status is-${phaseStatusClass}`}>
          {phaseStatusText}
        </em>
      </div>
  );

  return (
    <MonitoreoWorkbenchRail
      activeLocalTab={activeLocalTab}
      activeSection={{ ...activeDef, icon: ActiveIcon }}
      activeView={activeView}
      ariaLabel="Flujo territorial"
      localTabs={localTabs}
      modeCountLabel={`${localTabs.length || 1} modos`}
      phaseSwitch={phaseSwitch}
      routeSectionLabel="Territorial · sección"
      routeShortLabel="Territorial"
      statusAriaLabel="Estado territorial y última actualización"
      statusItems={[
        {
          label: "Última actualización",
          value: syncedAt ? formatDate(syncedAt) : "Sin actualización",
          detail: activePhaseHealth?.last_sync_at ? `Fuente ${formatDate(activePhaseHealth.last_sync_at)}` : "Memoria local",
          ready: Boolean(syncedAt),
        },
      ]}
      summary={summary}
      onLocalTabChange={(key) => onLocalTabChange(key)}
    />
  );
}

function TerritorialWorkbenchHead({
  activeDef,
  activeSources,
  headerAvance,
  headerMeta,
  headerValidas,
  nRows,
}: {
  activeDef: WorkbenchViewDefinition;
  activeSources: number;
  headerAvance: number | null | undefined;
  headerMeta: number | null | undefined;
  headerValidas: number | null | undefined;
  nRows: number;
}) {
  const Icon = VIEW_ICONS[activeDef.key] ?? activeDef.icon ?? Route;
  const fuenteView = activeDef.key === "fuentes";
  return (
    <MonitoreoWorkbenchHead
      icon={Icon}
      eyebrow="Territorial · flujo actual"
      title={activeDef.label}
      detail={activeDef.desc}
      pills={fuenteView ? [
        `${activeSources} fuentes`,
        `${fmt(nRows)} registros`,
        `${fmt(headerValidas)} efectivas`,
        headerMeta == null ? "S/D meta" : `${fmt(headerMeta)} meta`,
      ] : [
        `${activeSources} fuentes`,
        `${fmt(nRows)} registros`,
        `${fmt(headerValidas)} válidas`,
        headerMeta == null ? "meta por definir" : `${fmt(headerMeta)} meta`,
        pct(headerAvance),
      ]}
    />
  );
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

function territorialLoadingLabelForView(view: WorkbenchView) {
  switch (view) {
    case "modelo":
      return "Cargando UMPs...";
    case "avance":
      return "Cargando avance territorial...";
    case "consultas":
      return "Cargando consultas internas...";
    case "ocurrencias":
      return "Cargando ocurrencias de campo...";
    case "calidad":
      return "Cargando validación territorial...";
    default:
      return "Cargando datos territoriales...";
  }
}

function territorialLoadingPresentation(view: WorkbenchView): {
  title: string;
  detail: string;
  status: string;
  icon: typeof BarChart3;
  steps: Array<{ label: string; detail: string; icon: typeof BarChart3 }>;
} {
  switch (view) {
    case "modelo":
      return {
        title: "Preparando UMPs",
        detail: "Cruzando Hojas de Ruta, UMP titulares, reemplazos y responsables para abrir el tablero operativo.",
        status: "UMPs, responsables y manzanas",
        icon: Route,
        steps: [
          { label: "Marco territorial", detail: "Titulares y reemplazos", icon: Route },
          { label: "Responsables", detail: "Equipo y asignación", icon: ContactRound },
          { label: "Ficha UMP", detail: "Manzanas y metas", icon: Table2 },
        ],
      };
    case "calidad":
      return {
        title: "Preparando validación territorial",
        detail: "Agrupando GPS, UMP, estados de duración y cuotas para lectura operativa.",
        status: "GPS, reconciliación, tiempo y cuotas",
        icon: ShieldAlert,
        steps: [
          { label: "Geolocalización", detail: "Puntos contra manzanas", icon: MapPin },
          { label: "Reconciliación UMP", detail: "Sospechas espaciales", icon: Route },
          { label: "Tiempo y cuotas", detail: "Outliers y sexo/edad", icon: Clock },
        ],
      };
    case "consultas":
      return {
        title: "Preparando consultas internas",
        detail: "Construyendo la tabla de registros, filtros operativos y accesos directos a GPS y estados de tiempo.",
        status: "Registros por validar",
        icon: Search,
        steps: [
          { label: "Registro maestro", detail: "Una fila por respuesta", icon: Table2 },
          { label: "Filtros", detail: "Distrito, UMP y responsable", icon: SlidersHorizontal },
          { label: "Auditoría UMP", detail: "Cruces y reconciliación", icon: ListChecks },
        ],
      };
    case "avance":
      return {
        title: "Preparando avance territorial",
        detail: "Calculando avance por distrito, manzana, ritmo diario y brechas contra la meta de fase.",
        status: "Distrito, manzana y ritmo",
        icon: BarChart3,
        steps: [
          { label: "KPIs de fase", detail: "Meta, válidas y brecha", icon: Target },
          { label: "Avance por UMP", detail: "Titulares y reemplazos", icon: Route },
          { label: "Ritmo diario", detail: "Serie de campo", icon: CalendarRange },
        ],
      };
    case "ocurrencias":
      return {
        title: "Preparando ocurrencias de campo",
        detail: "Leyendo estados por UMP y señales de atención para seguimiento entre supervisión y campo.",
        status: "Estados y UMP",
        icon: ClipboardCheck,
        steps: [
          { label: "Estados", detail: "Ocurrencias recibidas", icon: ClipboardCheck },
          { label: "Resumen UMP", detail: "Pendientes y resueltos", icon: Route },
          { label: "Sincronización", detail: "Ficha de seguimiento", icon: RefreshCw },
        ],
      };
    default:
      return {
        title: "Preparando datos territoriales",
        detail: "Leyendo los datos locales del proyecto para abrir esta superficie de trabajo.",
        status: "Datos territoriales",
        icon: Activity,
        steps: [
          { label: "Fuente", detail: "Proyecto local", icon: PlugZap },
          { label: "Resumen", detail: "Indicadores", icon: BarChart3 },
          { label: "Vista", detail: "Controles listos", icon: CheckCircle2 },
        ],
      };
  }
}

function territorialLoadingPreview(view: WorkbenchView) {
  switch (view) {
    case "modelo":
      return [
        { label: "Marco", value: "Titulares + R", detail: "rutas y reemplazos", tone: "route" },
        { label: "Equipo", value: "Responsables", detail: "códigos y asignación", tone: "team" },
        { label: "Ficha", value: "UMP / Mz", detail: "metas por manzana", tone: "sheet" },
        { label: "Salida", value: "Tablero", detail: "se abre al terminar", tone: "ready" },
      ];
    case "calidad":
      return [
        { label: "GPS", value: "Manzana", detail: "punto contra ruta", tone: "route" },
        { label: "Tiempo", value: "3 estados", detail: "normal/corta/muy corta", tone: "team" },
        { label: "Cuotas", value: "Sexo/edad", detail: "brechas operativas", tone: "sheet" },
        { label: "Casos", value: "Prioridad", detail: "señales primero", tone: "ready" },
      ];
    case "avance":
      return [
        { label: "Avance", value: "Distrito", detail: "meta y brecha", tone: "route" },
        { label: "UMP", value: "Completas", detail: "titulares/reemplazos", tone: "team" },
        { label: "Ritmo", value: "Diario", detail: "serie del corte", tone: "sheet" },
        { label: "Salidas", value: "PDF/Sheets", detail: "preparación local", tone: "ready" },
      ];
    case "consultas":
      return [
        { label: "Registro", value: "Maestro", detail: "una fila por caso", tone: "route" },
        { label: "Filtros", value: "Distrito/UMP", detail: "foco operativo", tone: "team" },
        { label: "Tiempo", value: "3 estados", detail: "normal/corta/muy corta", tone: "sheet" },
        { label: "Auditoría", value: "UMP", detail: "cruces y señales", tone: "ready" },
      ];
    default:
      return [
        { label: "Fuente", value: "Local", detail: "proyecto .pulso", tone: "route" },
        { label: "Resumen", value: "KPIs", detail: "indicadores", tone: "team" },
        { label: "Vista", value: "Controles", detail: "panel activo", tone: "sheet" },
        { label: "Estado", value: "Listo", detail: "sin tocar Kobo", tone: "ready" },
      ];
  }
}

function TerritorialLoadingView({
  view,
  minHeight = 420,
}: {
  view: WorkbenchView;
  minHeight?: number;
}) {
  const meta = territorialLoadingPresentation(view);
  const preview = territorialLoadingPreview(view);
  const Icon = meta.icon;
  const style = { "--mon-territorial-loading-min-height": `${minHeight}px` } as CSSProperties;
  return (
    <section className={`mon-territorial-loading is-${view}`} role="status" aria-live="polite" style={style}>
      <div className="mon-territorial-loading-shell">
        <div className="mon-territorial-loading-main">
          <span className="mon-territorial-loading-icon" aria-hidden="true">
            <Icon size={19} />
          </span>
          <div>
            <span className="mon-territorial-loading-eyebrow">Preparación local</span>
            <strong>{meta.title}</strong>
            <p>{meta.detail}</p>
          </div>
          <em>
            <Loader2 size={14} className="pulso-spin" />
            {territorialLoadingLabelForView(view)}
          </em>
        </div>
        <div className="mon-territorial-loading-steps" aria-label="Pasos de preparación">
          {meta.steps.map((step) => {
            const StepIcon = step.icon;
            return (
              <article key={step.label}>
                <span><StepIcon size={15} /></span>
                <div>
                  <strong>{step.label}</strong>
                  <small>{step.detail}</small>
                </div>
              </article>
            );
          })}
        </div>
        <div className="mon-territorial-loading-preview" aria-label="Lectura previa de la superficie">
          {preview.map((item) => (
            <span key={`${item.label}-${item.value}`} className={`is-${item.tone}`}>
              <em>{item.label}</em>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
            </span>
          ))}
        </div>
        <small className="mon-territorial-loading-foot">{meta.status} · preparación local</small>
      </div>
    </section>
  );
}

function TerritorialViewError({
  message,
  onRetry,
  retrying = false,
}: {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <Alert kind="error">
      <div className="mon-territorial-view-error">
        <span>{message}</span>
        {onRetry ? (
          <button type="button" className="pulso-button" onClick={onRetry} disabled={retrying}>
            <RefreshCw size={14} className={retrying ? "pulso-spin" : undefined} />
            <span>{retrying ? "Reintentando" : "Reintentar"}</span>
          </button>
        ) : null}
      </div>
    </Alert>
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

function ValidationView({
  activeLocalTab,
  config,
  phase = "field",
  reports,
  selectedResponseId: controlledSelectedResponseId,
  onLocalTabChange,
  onSelectedResponseChange,
  onStateChange,
}: {
  activeLocalTab?: string;
  config?: MonitoreoTerritorialConfig | null;
  phase?: MonitoreoTerritorialPhase;
  reports: MonitoreoTerritorialDashboard | null;
  selectedResponseId?: string;
  onLocalTabChange?: (tab: string) => void;
  onSelectedResponseChange?: (responseId: string) => void;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const [showReplacements, setShowReplacements] = useState(false);
  const [localSelectedResponseId, setLocalSelectedResponseId] = useState("");
  const selectedResponseId = controlledSelectedResponseId ?? localSelectedResponseId;
  const selectResponse = useCallback((responseId: string) => {
    if (controlledSelectedResponseId == null) setLocalSelectedResponseId(responseId);
    onSelectedResponseChange?.(responseId);
  }, [controlledSelectedResponseId, onSelectedResponseChange]);
  const gpsPoints = useMemo(() => (reports ? makeGpsMapPoints(reports) : []), [reports]);
  if (!reports) {
    return <EmptyPanel icon={ShieldAlert} title="Validación pendiente" detail="Todavía no hay auditoría territorial hidratada." />;
  }
  if ((activeLocalTab ?? "geolocalizacion") === "geolocalizacion") {
    return (
      <TerritorialValidationGeoWorkbench
        reports={reports}
        selectedResponseId={selectedResponseId}
        onOpenReconciliation={() => onLocalTabChange?.("reconciliacion")}
      />
    );
  }
  if (activeLocalTab === "reconciliacion") {
    return (
      <TerritorialSpatialReconciliationWorkbench
        phase={phase}
        reports={reports}
        onOpenMap={() => onLocalTabChange?.("geolocalizacion")}
        onSelectResponse={selectResponse}
        onStateChange={onStateChange}
      />
    );
  }
  if (activeLocalTab === "duracion") {
    return (
      <TerritorialDurationControl
        config={config}
        reports={reports}
        selectedResponseId={selectedResponseId}
        onSelectResponse={selectResponse}
        onOpenGeoCase={(row) => {
          const responseId = String(row.response_id ?? "").trim();
          if (responseId) selectResponse(responseId);
          onLocalTabChange?.("geolocalizacion");
        }}
      />
    );
  }
  if (activeLocalTab === "cuotas") {
    return <TerritorialQuotaConsistencyPanel reports={reports} />;
  }
  if (activeLocalTab === "anulacion") {
    return (
      <TerritorialProductionAnnulmentWorkspace
        reports={reports}
        phase={phase}
        onStateChange={onStateChange}
      />
    );
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
        <StatTile label="GPS en zona" value={fmt(territorialReportKpis(reports).geo_ok)} tone="good" />
        <StatTile label="GPS con señal" value={fmt(territorialReportKpis(reports).geo_revision)} tone="warn" />
        <StatTile label="Sin GPS" value={fmt(territorialReportKpis(reports).geo_sin_gps ?? 0)} />
        <StatTile label="Duración p95" value={territorialReportKpis(reports).duration_p95 == null ? "S/D" : `${fmt(territorialReportKpis(reports).duration_p95)} min`} />
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
            { key: "duracion", label: "Tiempo", render: (row) => territorialOperationalDurationLabel(row) },
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

function AdvanceView({ reports }: { reports: MonitoreoTerritorialDashboard | null }) {
  if (!reports) {
    return <EmptyPanel icon={BarChart3} title="Avance pendiente" detail="Todavía no hay avance territorial hidratado." />;
  }
  const districtRows = reports.advance?.district_progress ?? reports.district_progress ?? [];
  const daily = reports.advance?.daily ?? reports.daily ?? [];
  return (
    <div className="ter-stack">
      <div className="ter-stat-row">
        <StatTile label="Válidas" value={fmt(territorialReportKpis(reports).validas)} tone="good" />
        <StatTile label="Meta" value={fmt(territorialReportKpis(reports).meta, "S/D")} />
        <StatTile label="Avance" value={pct(territorialReportKpis(reports).avance_pct)} tone="good" />
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

function renderView(
  view: WorkbenchView,
  reports: MonitoreoTerritorialDashboard | null,
  options: {
    activeLocalTab?: string;
    busy?: boolean;
    onError?: (message: string) => void;
    state?: MonitoreoState | null;
    phase?: MonitoreoTerritorialPhase;
    onPublished?: () => void;
    onReload?: () => void;
    onStateChange?: (state: MonitoreoState) => void;
    onLocalTabChange?: (tab: string) => void;
    onOpenValidationCase?: (tab: "geolocalizacion" | "duracion", responseId?: string) => void;
    onOperationalAdjustmentApply?: (adjustment: MonitoreoTerritorialOperationalAdjustment) => Promise<MonitoreoTerritorialOperationalAdjustment>;
    onOperationalAdjustmentRevert?: (id: string, reason?: string) => Promise<string>;
    onOperationalAdjustmentsReset?: () => Promise<number>;
    selectedValidationResponseId?: string;
    onValidationResponseChange?: (responseId: string) => void;
  } = {},
) {
  const activeAdvanceTab = isTerritorialAdvanceLocalTab(options.activeLocalTab)
    ? options.activeLocalTab
    : "resumen";
  if (view === "fuentes") {
    return (
      <TerritorialSourceConsole
        activeLocalTab={options.activeLocalTab}
        busy={options.busy}
        phase={options.phase ?? "field"}
        reports={reports}
        state={options.state ?? null}
        onError={options.onError}
        onReload={options.onReload ?? (() => undefined)}
        onStateChange={options.onStateChange ?? (() => undefined)}
      />
    );
  }
  if (view === "modelo") {
    return (
      <TerritorialModelWorkbench
        activeLocalTab={options.activeLocalTab}
        busy={options.busy}
        phase={options.phase ?? "field"}
        reports={reports}
        state={options.state ?? null}
        onError={options.onError}
        onReload={options.onReload ?? (() => undefined)}
      />
    );
  }
  if (view === "calidad") {
    return (
      <ValidationView
        activeLocalTab={options.activeLocalTab}
        config={options.state?.config?.territorial ?? null}
        phase={options.phase}
        reports={reports}
        selectedResponseId={options.selectedValidationResponseId}
        onLocalTabChange={options.onLocalTabChange}
        onSelectedResponseChange={options.onValidationResponseChange}
        onStateChange={options.onStateChange}
      />
    );
  }
  if (view === "consultas") {
    return (
      <TerritorialReviewCasesWorkbench
        activeLocalTab={options.activeLocalTab}
        busy={options.busy}
        config={options.state?.config?.territorial ?? null}
        phase={options.phase}
        reports={reports}
        onOperationalAdjustmentApply={options.onOperationalAdjustmentApply}
        onOperationalAdjustmentRevert={options.onOperationalAdjustmentRevert}
        onOperationalAdjustmentsReset={options.onOperationalAdjustmentsReset}
        onOpenValidationCase={options.onOpenValidationCase}
      />
    );
  }
  if (view === "avance" && activeAdvanceTab === "salidas") {
    const state = options.state;
    return (
      <TerritorialOutputsPanel
        config={state?.config}
        clientSheets={state?.publication?.client_last_sheets ?? null}
        internalSheets={state?.publication?.internal_last_sheets ?? null}
        hasSnapshot={Boolean(state?.has_snapshot)}
        nRows={state?.n_rows ?? 0}
        syncedAt={state?.synced_at ?? ""}
        onPublished={options.onPublished}
      />
    );
  }
  if (view === "avance") {
    return (
      <TerritorialAdvanceWorkbench
        activeLocalTab={activeAdvanceTab}
        reports={reports}
        syncedAt={options.state?.synced_at ?? reports?.generated_at ?? ""}
        onLocalTabChange={options.onLocalTabChange}
      />
    );
  }
  if (view === "ocurrencias") {
    return (
      <TerritorialFieldOccurrencesWorkbench
        activeLocalTab={options.activeLocalTab}
        busy={options.busy}
        reports={reports}
        onError={options.onError}
        onReload={options.onReload}
        onStateChange={options.onStateChange}
      />
    );
  }
  return null;
}

export default function TerritorialMonitoreoPage() {
  const [state, setState] = useState<MonitoreoState | null>(null);
  const [activeView, setActiveView] = useState<WorkbenchView>("fuentes");
  const [activeLocalTabs, setActiveLocalTabs] = useState<Partial<Record<WorkbenchView, string>>>({
    fuentes: defaultLocalTabForView("fuentes"),
    modelo: defaultLocalTabForView("modelo"),
    calidad: defaultLocalTabForView("calidad"),
    consultas: defaultLocalTabForView("consultas"),
    avance: defaultLocalTabForView("avance"),
    ocurrencias: defaultLocalTabForView("ocurrencias"),
  });
  const [phase, setPhase] = useState<MonitoreoTerritorialPhase>("field");
  const [selectedValidationResponseId, setSelectedValidationResponseId] = useState("");
  const [loadingView, setLoadingView] = useState<WorkbenchView | "initial" | "background" | null>("initial");
  const [mutationBusy, setMutationBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlightRef = useRef(new Set<string>());
  const scopeStateCacheRef = useRef(new Map<string, MonitoreoState>());
  const stateRef = useRef<MonitoreoState | null>(null);
  const activeViewRef = useRef<WorkbenchView>("fuentes");
  const activeLocalTabsRef = useRef<Partial<Record<WorkbenchView, string>>>(activeLocalTabs);
  const [pendingScopes, setPendingScopes] = useState<Set<string>>(() => new Set());

  const markScopePending = useCallback((key: string, pending: boolean) => {
    setPendingScopes((current) => {
      const alreadyPending = current.has(key);
      if (pending === alreadyPending) return current;
      const next = new Set(current);
      if (pending) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const localTabs = TERRITORIAL_LOCAL_TABS[activeView] ?? [];
  const activeLocalTab = activeLocalTabs[activeView] ?? defaultLocalTabForView(activeView);
  const activeLocalTabDef = localTabs.find((tab) => tab.key === activeLocalTab) ?? localTabs[0] ?? null;
  const sourceKey = state ? territorialSourceKeyFromState(state, phase) : "sin-fuente";
  const preferredScope = scopeForPhaseViewTab(phase, activeView, activeLocalTab);
  const cachedEntry = useMemo(() => {
    if (!state) return null;
    const scopes = [
      preferredScope,
      ...reportScopesForTerritorialView(activeView),
    ].filter((scope, index, all) => all.indexOf(scope) === index);
    for (const scope of scopes) {
      const entry = monitoreoScopeCache.getTerritorial({ phase, source: sourceKey, scope });
      if (entry && territorialReportsCoverSelection(entry.reports, activeView, activeLocalTab)) return entry;
    }
    return null;
  }, [activeLocalTab, activeView, phase, preferredScope, sourceKey, state]);
  const rawReports = reportsFromState(state);
  const reports = rawReports && territorialReportsCoverSelection(rawReports, activeView, activeLocalTab)
    ? rawReports
    : cachedEntry?.reports ?? null;
  const reportReady = Boolean(reports && territorialReportsCoverSelection(reports, activeView, activeLocalTab));

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const scopeStateKey = useCallback((scope: MonitoreoReportScope, phaseValue = phase, sourceValue = sourceKey) => (
    `${phaseValue}|${sourceValue}|${scope}`
  ), [phase, sourceKey]);

  const rememberScopeState = useCallback((next: MonitoreoState) => {
    const entry = monitoreoScopeCache.putTerritorialState(next);
    const nextReports = reportsFromState(next);
    if (!nextReports) return entry;
    const rawPhase = nextReports.active_route_phase || next.config?.territorial?.active_route_phase;
    const nextPhase: MonitoreoTerritorialPhase = rawPhase === "pilot" || rawPhase === "field" ? rawPhase : phase;
    const nextSource = territorialSourceKeyFromState(next, nextPhase);
    const nextScope = (nextReports.report_scope || "full") as MonitoreoReportScope;
    scopeStateCacheRef.current.set(scopeStateKey(nextScope, nextPhase, nextSource), next);
    if (nextScope === "full") {
      (["source", "route_summary", "advance_summary", "validation_summary", "queries_summary"] as MonitoreoReportScope[])
        .forEach((alias) => scopeStateCacheRef.current.set(scopeStateKey(alias, nextPhase, nextSource), next));
    }
    return entry;
  }, [phase, scopeStateKey]);

  const clearScopeStateCache = useCallback(() => {
    scopeStateCacheRef.current.clear();
    monitoreoScopeCache.clear();
  }, []);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    activeLocalTabsRef.current = activeLocalTabs;
  }, [activeLocalTabs]);

  const loadScope = useCallback(async (scope: MonitoreoReportScope, viewForLoading?: WorkbenchView, force = false) => {
    const key = scopeStateKey(scope);
    if (!force) {
      const cachedState = scopeStateCacheRef.current.get(key);
      if (cachedState) {
        setState(withTerritorialPhase(cachedState, phase));
        setError("");
        return cachedState;
      }
      if (monitoreoScopeCache.getTerritorial({ phase, source: sourceKey, scope })) return stateRef.current;
    }
    if (inFlightRef.current.has(key)) return null;
    inFlightRef.current.add(key);
    markScopePending(key, true);
    if (viewForLoading) setLoadingView(viewForLoading);
    try {
      const next = await apiMonitoreoState({ includeReports: true, reportScope: scope, warmupCache: !force, force });
      rememberScopeState(next);
      setState(next);
      setError("");
      return next;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      inFlightRef.current.delete(key);
      markScopePending(key, false);
      if (viewForLoading) setLoadingView(null);
    }
  }, [markScopePending, phase, rememberScopeState, scopeStateKey, sourceKey]);

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
        const requestedView = activeViewRef.current;
        const nextView = viewAllowedInPhase(nextPhase, requestedView) ? requestedView : "avance";
        const nextLocalTab = activeLocalTabsRef.current[nextView] ?? defaultLocalTabForView(nextView);
        setActiveView(nextView);
        const scope = scopeForPhaseViewTab(nextPhase, nextView, nextLocalTab);
        const cached = monitoreoScopeCache.getTerritorial({
          phase: nextPhase,
          source: territorialSourceKeyFromState(nextState, nextPhase),
          scope,
        });
        if (cached && nextState.dashboard) {
          const hydratedFromCache = {
            ...nextState,
            dashboard: {
              ...nextState.dashboard,
              ok: nextState.dashboard.ok ?? true,
              territorial_reports: cached.reports,
            },
            territorial_report_cache: cached.meta ?? nextState.territorial_report_cache,
          } satisfies MonitoreoState;
          rememberScopeState(hydratedFromCache);
          setState(hydratedFromCache);
          setLoadingView(null);
          return;
        }
        const hydrated = await apiMonitoreoState({ includeReports: true, reportScope: scope, warmupCache: true });
        if (cancelled) return;
        rememberScopeState(hydrated);
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
    if (!state || loadingView === "initial") return;
    if (error) return;
    if (cachedEntry) return;
    const scope = scopeForPhaseViewTab(phase, activeView, activeLocalTab);
    const delay = activeView === "avance" ? 180 : 0;
    const timer = window.setTimeout(() => {
      void loadScope(scope, activeView);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [activeLocalTab, activeView, cachedEntry, error, loadScope, loadingView, phase, state]);

  useEffect(() => {
    if (!state || loadingView === "initial") return;
    if (error) return;
    if (phase === "pilot" || activeView !== "avance" || activeLocalTab !== "resumen") return;
    if ((reports?.report_scope || "") !== "route_summary") return;
    const cachedAdvance = monitoreoScopeCache.getTerritorial({
      phase,
      source: sourceKey,
      scope: "advance_summary",
    });
    if (cachedAdvance) return;
    const timer = window.setTimeout(() => {
      void loadScope("advance_summary");
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [activeLocalTab, activeView, error, loadScope, loadingView, phase, reports?.report_scope, sourceKey, state]);

  useEffect(() => {
    if (!state || loadingView === "initial") return;
    if (error) return;
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
  }, [error, state?.synced_at, phase]);

  const visibleViews = useMemo(
    () => TERRITORIAL_WORKBENCH_VIEWS.filter((item) => viewAllowedInPhase(phase, item.key)),
    [phase],
  );
  const activeDef = useMemo(
    () => visibleViews.find((item) => item.key === activeView) ?? visibleViews[0] ?? TERRITORIAL_WORKBENCH_VIEWS[0],
    [activeView, visibleViews],
  );

  useEffect(() => {
    if (!localTabs.length) return;
    if (localTabs.some((tab) => tab.key === activeLocalTab)) return;
    setActiveLocalTabs((current) => ({ ...current, [activeView]: localTabs[0]?.key ?? "" }));
  }, [activeLocalTab, activeView, localTabs]);

  useEffect(() => {
    if (!activeLocalTabDef || typeof window === "undefined") return undefined;
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("prosecnur:monitoreo-local-tab", {
        detail: { view: activeView, key: activeLocalTabDef.key, label: activeLocalTabDef.label },
      }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeLocalTabDef, activeView]);

  const changeLocalTab = useCallback((key: string) => {
    const tab = (TERRITORIAL_LOCAL_TABS[activeView] ?? []).find((item) => item.key === key);
    setActiveLocalTabs((current) => ({ ...current, [activeView]: key }));
    if (tab && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("prosecnur:monitoreo-local-tab", {
        detail: { view: activeView, key: tab.key, label: tab.label },
      }));
    }
  }, [activeView]);
  const openValidationCase = useCallback((tab: "geolocalizacion" | "duracion", responseId?: string) => {
    setActiveLocalTabs((current) => ({ ...current, calidad: tab }));
    if (responseId) setSelectedValidationResponseId(responseId);
    setActiveView("calidad");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("prosecnur:monitoreo-local-tab", {
        detail: { view: "calidad", key: tab },
      }));
    }
  }, []);
  const reportKpis = territorialReportKpis(reports);
  const dashboardKpis = state?.dashboard?.kpis;
  const headerValidas = nullableMetric(reportKpis.validas) ?? nullableMetric(dashboardKpis?.valid);
  const headerMeta = nullableMetric(reportKpis.meta) ?? nullableMetric(dashboardKpis?.target);
  const headerAvance = nullableMetric(reportKpis.avance_pct) ?? nullableMetric(dashboardKpis?.avance_pct);
  const sectionViewMetrics = { avance: pct(headerAvance) };
  const cacheMeta = state?.territorial_report_cache;
  const pilotPhaseHealth = territorialPhaseHealthForState(state, "pilot");
  const fieldPhaseHealth = territorialPhaseHealthForState(state, "field");
  const activePhaseHealth = phase === "pilot" ? pilotPhaseHealth : fieldPhaseHealth;
  const refreshCurrentView = useCallback(() => {
    void loadScope(preferredScope, activeView, true);
  }, [activeView, loadScope, preferredScope]);
  const applyTerritorialPageState = useCallback((next: MonitoreoState) => {
    const withPhase = withTerritorialPhase(next, phase);
    clearScopeStateCache();
    rememberScopeState(withPhase);
    setState(withPhase);
    setError("");
  }, [clearScopeStateCache, phase, rememberScopeState]);
  const applyOperationalAdjustment = useCallback(async (
    adjustment: MonitoreoTerritorialOperationalAdjustment,
  ) => {
    setMutationBusy(true);
    setError("");
    try {
      const result = await apiMonitoreoTerritorialOperationalAdjustmentApply({
        ...adjustment,
        phase: adjustment.phase ?? phase,
      });
      applyTerritorialPageState(result.state);
      return result.adjustment;
    } catch (e) {
      const message = (e as Error).message || String(e);
      setError(message);
      throw e;
    } finally {
      setMutationBusy(false);
    }
  }, [applyTerritorialPageState, phase]);
  const revertOperationalAdjustment = useCallback(async (id: string, reason?: string) => {
    setMutationBusy(true);
    setError("");
    try {
      const result = await apiMonitoreoTerritorialOperationalAdjustmentRevert({ id, phase, reason });
      applyTerritorialPageState(result.state);
      return result.adjustment_id;
    } catch (e) {
      const message = (e as Error).message || String(e);
      setError(message);
      throw e;
    } finally {
      setMutationBusy(false);
    }
  }, [applyTerritorialPageState, phase]);
  const resetOperationalAdjustments = useCallback(async () => {
    setMutationBusy(true);
    setError("");
    try {
      const result = await apiMonitoreoTerritorialOperationalAdjustmentReset({
        phase,
        reason: "Reinicio desde Consultas",
      });
      applyTerritorialPageState(result.state);
      return result.active_before;
    } catch (e) {
      const message = (e as Error).message || String(e);
      setError(message);
      throw e;
    } finally {
      setMutationBusy(false);
    }
  }, [applyTerritorialPageState, phase]);
  const changeTerritorialPhase = useCallback(async (nextPhase: MonitoreoTerritorialPhase) => {
    if (nextPhase === phase) return;
    const nextView = viewAllowedInPhase(nextPhase, activeView) ? activeView : "avance";
    const nextLocalTab = activeLocalTabs[nextView] ?? defaultLocalTabForView(nextView);
    setError("");
    setLoadingView("initial");
    try {
      const phaseResult = await apiMonitoreoTerritorialPhase(nextPhase);
      if (!phaseResult?.ok) throw new Error(`No se pudo seleccionar ${labelForPhase(nextPhase)}.`);
      setPhase(nextPhase);
      setActiveView(nextView);
      clearScopeStateCache();
      const hydrated = await apiMonitoreoState({
        includeReports: true,
        reportScope: scopeForPhaseViewTab(nextPhase, nextView, nextLocalTab),
        warmupCache: true,
      });
      const nextState = withTerritorialPhase(hydrated, nextPhase);
      rememberScopeState(nextState);
      setState(nextState);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingView(null);
    }
  }, [activeLocalTabs, activeView, clearScopeStateCache, phase, rememberScopeState]);
  const primarySources = state?.sources.filter((source) => source.role !== "ocurrencias_campo") ?? [];
  const activeSources = primarySources.filter((source) => source.enabled).length;
  const sourceTotal = primarySources.length;
  const activeScopeKey = `${phase}|${sourceKey}|${preferredScope}`;
  const activeScopePending = pendingScopes.has(activeScopeKey);
  const activeNeedsReport = viewNeedsTerritorialReport(activeView, activeLocalTab);
  const activeLoading = loadingView === "initial"
    || loadingView === activeView
    || activeScopePending
    || Boolean(state && activeNeedsReport && !reportReady && !error);
  const chromeBusy = activeLoading || mutationBusy;
  const chromeGeneratedAt = reports?.generated_at ?? state?.generated_at ?? state?.synced_at ?? "";
  const chromeGenerationStatus = error ? "failed" : reportReady ? "" : "stale";

  return (
    <PageFrame
      title={TERRITORIAL_ROUTE.label}
      headerMode="sr-only"
      bodyMode="fill"
      className="mon-page"
      density="compact"
    >
      <span
        hidden
        data-audit-ready="monitoreo"
        data-audit-has-dashboard={state?.dashboard ? "true" : "false"}
      />
      <MonitoreoModuleChrome
        routes={MONITOREO_ROUTES}
        route={TERRITORIAL_ROUTE}
        routeSelected
        activeView={activeView}
        saving={chromeBusy}
        syncedAt={state?.synced_at ?? ""}
        generatedAt={chromeGeneratedAt}
        generationStatus={chromeGenerationStatus}
        pendingRegeneration={!reportReady && !error}
        sourceTotal={sourceTotal}
        activeSources={activeSources}
        nRows={state?.n_rows ?? 0}
        hasSnapshot={Boolean(state?.has_snapshot)}
        syncing={chromeBusy}
        viewMetrics={sectionViewMetrics}
        advanceSyncDisabled={!state || chromeBusy}
        advanceSyncLabel="Vista"
        advanceSyncTitle="Actualizar vista territorial activa"
        onSyncAdvance={refreshCurrentView}
        onViewChange={setActiveView}
      />

      <MonitoreoWorkbenchChrome
        activeView={activeView}
        isTerritorial
        rail={(
          <TerritorialWorkbenchRail
            activeDef={activeDef}
            activeLocalTab={activeLocalTab}
            activeView={activeView}
            cacheMeta={cacheMeta}
            error={error}
            fieldPhaseHealth={fieldPhaseHealth}
            localTabs={localTabs}
            loadingView={loadingView}
            onLocalTabChange={changeLocalTab}
            onPhaseChange={(nextPhase) => {
              void changeTerritorialPhase(nextPhase);
            }}
            phase={phase}
            pilotPhaseHealth={pilotPhaseHealth}
            reportReady={reportReady}
            syncedAt={state?.synced_at ?? ""}
          />
        )}
        head={(
          <TerritorialWorkbenchHead
            activeDef={activeDef}
            activeSources={activeSources}
            headerAvance={headerAvance}
            headerMeta={headerMeta}
            headerValidas={headerValidas}
            nRows={state?.n_rows ?? reports?.kpis.total_respuestas ?? 0}
          />
        )}
      >
          {error && (
            <TerritorialViewError message={error} onRetry={refreshCurrentView} retrying={chromeBusy} />
          )}

          {activeLoading ? (
            <TerritorialLoadingView view={activeView} minHeight={activeView === "avance" ? 560 : 420} />
          ) : (
            renderView(activeView, reports, {
              activeLocalTab,
              busy: chromeBusy,
              onError: setError,
              onPublished: refreshCurrentView,
              onReload: refreshCurrentView,
              onLocalTabChange: changeLocalTab,
              onOpenValidationCase: openValidationCase,
              onOperationalAdjustmentApply: applyOperationalAdjustment,
              onOperationalAdjustmentRevert: revertOperationalAdjustment,
              onOperationalAdjustmentsReset: resetOperationalAdjustments,
              onStateChange: applyTerritorialPageState,
              onValidationResponseChange: setSelectedValidationResponseId,
              phase,
              selectedValidationResponseId,
              state,
            })
          )}
      </MonitoreoWorkbenchChrome>
    </PageFrame>
  );
}
