import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  apiJobStatus,
  apiMonitoreoSync,
  apiMonitoreoState,
  apiMonitoreoTerritorialOccurrencesSync,
  apiMonitoreoTerritorialOperationalAdjustmentApply,
  apiMonitoreoTerritorialOperationalAdjustmentReset,
  apiMonitoreoTerritorialOperationalAdjustmentRevert,
  apiMonitoreoTerritorialPhase,
  type JobSnapshot,
  type MonitoreoSource,
  type MonitoreoState,
  type MonitoreoSyncResult,
  type MonitoreoTerritorialDashboard,
  type MonitoreoTerritorialConfig,
  type MonitoreoTerritorialOperationalAdjustment,
  type MonitoreoTerritorialPhase,
  type MonitoreoTerritorialPhaseCoherenceItem,
  type TerritorialBlockProgress,
  type TerritorialDistrictProgress,
  type TerritorialResponseAuditRow,
} from "../../../../api/client";
import { Alert } from "../../../../components/Alert";
import { ContextTabRail } from "../../../../components/ContextTabRail";
import type { ContextTabRailEstado } from "../../../../components/ContextTabRail";
import { PageFrame } from "../../../../components/PageFrame";
import {
  MonitoreoRailLastUpdate,
  MonitoreoWorkbenchChrome,
  MonitoreoWorkbenchHead,
} from "../../components";
import {
  MONITOREO_MODOS,
  TERRITORIAL_WORKBENCH_VIEWS,
  type MonitoreoSeccion,
  type MonitoreoSeccionDefinicion,
} from "../../core/monitoreoRegistry";
import {
  pestanaInicialMonitoreo,
  seccionInicialMonitoreo,
  useMonitoreoDireccion,
} from "../../useMonitoreoDireccion";
import { useRegistrarPestanasMonitoreo } from "../../useRegistrarPestanas";
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
import { corteTerritorial } from "../../corte/corteAdapters";
import { estadoVisual, readinessDeSalidas } from "../../corte/corteContract";
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
const TERRITORIAL_CANONICAL_HEADER_SCOPES: MonitoreoReportScope[] = [
  "advance_summary",
  "validation_summary",
  "queries_summary",
  "full",
];
const TERRITORIAL_CANONICAL_HEADER_SCOPE_SET = new Set<string>(TERRITORIAL_CANONICAL_HEADER_SCOPES);

const VIEW_ICONS: Partial<Record<MonitoreoSeccion, typeof Route>> = {
  fuentes: DatabaseZap,
  modelo: Route,
  calidad: ShieldAlert,
  consultas: Search,
  avance: BarChart3,
  ocurrencias: MapPinned,
};
const TERRITORIAL_ROUTE = MONITOREO_MODOS.find((route) => route.family === "territorial") ?? MONITOREO_MODOS[0];
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
    // «Resumen» cargaba cinco bloques en 1.248px y el tablero de distritos
    // —660px él solo— empujaba prioridades y corte operativo fuera del pliegue.
    // Cada pestaña responde ahora una pregunta: cómo vamos / dónde estamos.
    { key: "resumen", label: "Resumen", detail: "Estado del campo y corte", icon: BarChart3 },
    { key: "distritos", label: "Distritos", detail: "Cobertura y cuotas", icon: MapPinned },
    { key: "ump", label: "Mapa y UMP", detail: "Ritmo por manzana", icon: Route },
    { key: "ritmo", label: "Ritmo diario", detail: "Tendencia del corte", icon: CalendarRange },
    { key: "salidas", label: "Salidas", detail: "PDF y Sheets", icon: Download },
  ],
  ocurrencias: [
    // La matriz por distrito sale de «Resumen»: allí competía con la tasa de no
    // efectividad y sus motivos, que son la lectura que manda.
    { key: "states", label: "Resumen", detail: "No efectividad y motivos", icon: ClipboardCheck },
    { key: "distritos", label: "Distritos", detail: "Estados por distrito", icon: MapPinned },
    { key: "registro", label: "Reporte UMP", detail: "Con/sin reporte", icon: Table2 },
    { key: "ump", label: "UMP", detail: "Con/sin ocurrencia", icon: Route },
    { key: "alerts", label: "Alertas", detail: "Cruces y observaciones", icon: ShieldAlert },
    { key: "rhythm", label: "Ritmo", detail: "Dias e historial", icon: CalendarRange },
  ],
  telefonico: [],
} satisfies Record<MonitoreoSeccion, readonly TerritorialLocalTabDefinition[]>;
const TERRITORIAL_ADVANCE_TABS = TERRITORIAL_LOCAL_TABS.avance;
type TerritorialAdvanceLocalTab = typeof TERRITORIAL_ADVANCE_TABS[number]["key"];

function defaultLocalTabForView(view: MonitoreoSeccion) {
  return TERRITORIAL_LOCAL_TABS[view]?.[0]?.key ?? "";
}

/**
 * Readiness y badge de cada pestaña de Avance territorial.
 *
 * Todo se deriva del corte canónico, así que el rail no puede contradecir lo que
 * muestra el panel: era exactamente lo que pasaba cuando cada superficie contaba
 * por su cuenta.
 */
function estadoPestanaAvanceTerritorial(
  key: string,
  state: MonitoreoState | null,
  reports: MonitoreoTerritorialDashboard | null,
): { estado?: ContextTabRailEstado; badge?: string } {
  const corte = corteTerritorial(state, reports);
  const configurado = Boolean(state?.has_snapshot);
  const evaluado = corte.oficial != null;

  if (key === "salidas") {
    const readiness = readinessDeSalidas(corte);
    return {
      estado: readiness.estado,
      badge: readiness.bloqueos.length ? String(readiness.bloqueos.length) : undefined,
    };
  }
  if (key === "ump") {
    const blocks = reports?.advance?.block_progress ?? [];
    const pendientes = blocks.filter((row) => (row.validas ?? 0) < (row.meta ?? 0)).length;
    return {
      estado: estadoVisual({ configurado: blocks.length > 0, evaluado, completo: pendientes === 0 }),
      badge: pendientes ? String(pendientes) : undefined,
    };
  }
  if (key === "ritmo") {
    const dias = reports?.advance?.daily ?? [];
    const conValidas = dias.filter((row) => (row.validas ?? 0) > 0).length;
    return {
      estado: estadoVisual({ configurado, evaluado: dias.length > 0, completo: conValidas > 0 }),
    };
  }
  if (key === "distritos") {
    const distritos = reports?.advance?.district_progress ?? [];
    const conBrecha = distritos.filter((row) => (row.brecha ?? 0) > 0).length;
    return {
      estado: estadoVisual({ configurado: distritos.length > 0, evaluado, completo: conBrecha === 0 }),
      badge: conBrecha ? String(conBrecha) : undefined,
    };
  }
  // resumen
  return {
    estado: estadoVisual({ configurado, evaluado, completo: evaluado && corte.brecha === 0 }),
    badge: corte.brecha ? String(corte.brecha) : undefined,
  };
}

function territorialContextTabId(view: MonitoreoSeccion, key: string) {
  return `mon-territorial-${view}-tab-${key}`;
}

function territorialContextPanelId(view: MonitoreoSeccion) {
  return `mon-territorial-${view}-panel`;
}

// Fallback estable para callbacks opcionales: una lambda inline nueva por
// render rompería el React.memo de los workbenches hijos.
const noop = () => undefined;

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

function isReplacementBlock(block: TerritorialBlockProgress) {
  return String(block.tipo_manzana || "").toLowerCase() === "reemplazo";
}

function scopeForView(view: MonitoreoSeccion): MonitoreoReportScope {
  return reportScopesForTerritorialView(view)[0] ?? "full";
}

function scopesForPhase(phase: MonitoreoTerritorialPhase): MonitoreoReportScope[] {
  return phase === "pilot" ? TERRITORIAL_PILOT_SCOPES : TERRITORIAL_FIELD_SCOPES;
}

function viewAllowedInPhase(phase: MonitoreoTerritorialPhase, view: MonitoreoSeccion) {
  return phase === "pilot" ? view === "avance" : true;
}

function sourcePhase(source: MonitoreoSource | null | undefined): MonitoreoTerritorialPhase | "" {
  const phase = source?.dimensions?.territorial_phase;
  return phase === "pilot" || phase === "field" ? phase : "";
}

function activeTerritorialKoboSource(state: MonitoreoState | null, phase: MonitoreoTerritorialPhase) {
  if (!state) return null;
  const phaseSource = state.config?.territorial?.phase_sources?.[phase];
  const sources = (state.sources ?? []).filter((source) => (
    source.kind === "kobo" && source.role !== "ocurrencias_campo"
  ));
  return sources.find((source) => source.id && source.id === phaseSource?.source_id)
    ?? sources.find((source) => source.asset_uid && source.asset_uid === phaseSource?.asset_uid)
    ?? sources.find((source) => sourcePhase(source) === phase)
    ?? sources.find((source) => source.enabled)
    ?? sources[0]
    ?? null;
}

function isTerminalJob<T>(job: JobSnapshot<T> | null): job is JobSnapshot<T> {
  return job?.status === "done" || job?.status === "error" || job?.status === "cancelled";
}

function jobProgressPercent(job: JobSnapshot | null) {
  const percent = Number(job?.progress && "percent" in job.progress ? job.progress.percent : null);
  if (!Number.isFinite(percent)) return null;
  return Math.max(0, Math.min(100, percent));
}

function jobProgressPhase(job: JobSnapshot | null) {
  const progress = job?.progress;
  return progress && "phase" in progress && typeof progress.phase === "string" ? progress.phase : undefined;
}

function jobProgressMessage(job: JobSnapshot | null) {
  const progress = job?.progress;
  return progress && "message" in progress && typeof progress.message === "string" ? progress.message : undefined;
}

function jobErrorMessage(job: JobSnapshot | null) {
  const error = job?.error;
  if (!error) return "";
  return typeof error === "string" ? error : "";
}

function scopeForPhaseViewTab(
  phase: MonitoreoTerritorialPhase,
  view: MonitoreoSeccion,
  _localTab = "",
): MonitoreoReportScope {
  if (phase === "pilot") return "advance_summary";
  return scopeForView(view);
}

function territorialReportsCoverSelection(
  reports: MonitoreoTerritorialDashboard | null | undefined,
  view: MonitoreoSeccion,
  localTab = "",
) {
  if (!reports) return false;
  const scope = (reports.report_scope || "full") as MonitoreoReportScope;
  if (view === "avance" && localTab !== "ritmo") {
    return ["advance_summary", "validation_summary", "full"].includes(scope);
  }
  return territorialReportsCoverView(reports, view);
}

function viewNeedsTerritorialReport(view: MonitoreoSeccion, localTab = "") {
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

const TerritorialWorkbenchHead = memo(function TerritorialWorkbenchHead({
  activeDef,
  activeSources,
  fieldPhaseHealth,
  headerAvance,
  headerMeta,
  headerValidas,
  loadingView,
  nRows,
  onPhaseChange,
  pestanaEstado,
  pestanaLabel,
  phase,
  pilotPhaseHealth,
}: {
  activeDef: MonitoreoSeccionDefinicion;
  activeSources: number;
  fieldPhaseHealth: MonitoreoTerritorialPhaseCoherenceItem | null;
  headerAvance: number | null | undefined;
  headerMeta: number | null | undefined;
  headerValidas: number | null | undefined;
  loadingView: MonitoreoSeccion | "initial" | "background" | null;
  nRows: number;
  onPhaseChange: (phase: MonitoreoTerritorialPhase) => void;
  pestanaEstado?: ContextTabRailEstado;
  pestanaLabel?: string;
  phase: MonitoreoTerritorialPhase;
  pilotPhaseHealth: MonitoreoTerritorialPhaseCoherenceItem | null;
}) {
  const Icon = VIEW_ICONS[activeDef.key] ?? activeDef.icon ?? Route;
  const fuenteView = activeDef.key === "fuentes";
  const phaseOptions = [
    { key: "pilot" as const, label: "Piloto", hint: territorialPhaseBadgeLabel(pilotPhaseHealth) },
    { key: "field" as const, label: "Campo", hint: territorialPhaseBadgeLabel(fieldPhaseHealth) },
  ];
  return (
    <>
      <MonitoreoWorkbenchHead
        icon={Icon}
        eyebrow="Territorial · flujo actual"
        title={activeDef.label}
        pestanaLabel={pestanaLabel}
        pestanaEstado={pestanaEstado}
        detail={activeDef.desc}
        // "N registros" a secas era el conteo crudo y se leía como casos
        // defendibles. La píldora lo nombra por lo que es. Dice «recibidas» y no
        // «en el snapshot» —cómo lo guarda la app— para hablar igual que los
        // otros perfiles; la distinción con las válidas es la que importa y se
        // mantiene.
        pills={fuenteView ? [
          `${activeSources} fuentes`,
          `${fmt(nRows)} recibidas`,
          `${fmt(headerValidas)} efectivas`,
          headerMeta == null ? "sin meta declarada" : `${fmt(headerMeta)} meta`,
        ] : [
          `${activeSources} fuentes`,
          `${fmt(nRows)} recibidas`,
          `${fmt(headerValidas)} válidas`,
          headerMeta == null ? "sin meta declarada" : `${fmt(headerMeta)} meta`,
          pct(headerAvance),
        ]}
      />
      <div className="mon-rail-phase-switch" aria-label="Formato territorial">
        <span>Formato territorial</span>
        <div role="group" aria-label="Piloto o campo">
          {phaseOptions.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={phase === item.key}
              className={phase === item.key ? "is-active" : ""}
              disabled={phase === item.key || loadingView === "initial"}
              onClick={() => onPhaseChange(item.key)}
            >
              <strong>{item.label}</strong>
              <small>{item.hint}</small>
            </button>
          ))}
        </div>
      </div>
    </>
  );
});

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

function territorialLoadingLabelForView(view: MonitoreoSeccion) {
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

function territorialLoadingPresentation(view: MonitoreoSeccion): {
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

function territorialLoadingPreview(view: MonitoreoSeccion) {
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
}: {
  view: MonitoreoSeccion;
}) {
  const meta = territorialLoadingPresentation(view);
  const preview = territorialLoadingPreview(view);
  const Icon = meta.icon;
  return (
    <section className={`mon-territorial-loading is-${view}`} role="status" aria-live="polite">
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
  pestanaActiva,
  config,
  phase = "field",
  reports,
  selectedResponseId: controlledSelectedResponseId,
  onCambioPestana,
  onSelectedResponseChange,
  onStateChange,
}: {
  pestanaActiva?: string;
  config?: MonitoreoTerritorialConfig | null;
  phase?: MonitoreoTerritorialPhase;
  reports: MonitoreoTerritorialDashboard | null;
  selectedResponseId?: string;
  onCambioPestana?: (tab: string) => void;
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
  // Handlers estables: los workbenches de validación están memoizados y una
  // arrow inline nueva por render anularía ese memo.
  const openReconciliationTab = useCallback(() => onCambioPestana?.("reconciliacion"), [onCambioPestana]);
  const openGeolocationTab = useCallback(() => onCambioPestana?.("geolocalizacion"), [onCambioPestana]);
  const openGeoCaseFromDuration = useCallback((row: TerritorialResponseAuditRow) => {
    const responseId = String(row.response_id ?? "").trim();
    if (responseId) selectResponse(responseId);
    onCambioPestana?.("geolocalizacion");
  }, [onCambioPestana, selectResponse]);
  if (!reports) {
    return <EmptyPanel icon={ShieldAlert} title="Validación pendiente" detail="Todavía no hay auditoría territorial hidratada." />;
  }
  if ((pestanaActiva ?? "geolocalizacion") === "geolocalizacion") {
    return (
      <TerritorialValidationGeoWorkbench
        reports={reports}
        selectedResponseId={selectedResponseId}
        onOpenReconciliation={openReconciliationTab}
      />
    );
  }
  if (pestanaActiva === "reconciliacion") {
    return (
      <TerritorialSpatialReconciliationWorkbench
        phase={phase}
        reports={reports}
        onOpenMap={openGeolocationTab}
        onSelectResponse={selectResponse}
        onStateChange={onStateChange}
      />
    );
  }
  if (pestanaActiva === "duracion") {
    return (
      <TerritorialDurationControl
        config={config}
        reports={reports}
        selectedResponseId={selectedResponseId}
        onSelectResponse={selectResponse}
        onOpenGeoCase={openGeoCaseFromDuration}
      />
    );
  }
  if (pestanaActiva === "cuotas") {
    return <TerritorialQuotaConsistencyPanel reports={reports} />;
  }
  if (pestanaActiva === "anulacion") {
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
  view: MonitoreoSeccion,
  reports: MonitoreoTerritorialDashboard | null,
  options: {
    pestanaActiva?: string;
    busy?: boolean;
    onError?: (message: string) => void;
    state?: MonitoreoState | null;
    phase?: MonitoreoTerritorialPhase;
    onPublished?: () => void;
    onReload?: () => void;
    onSyncKobo?: () => Promise<void> | void;
    onStateChange?: (state: MonitoreoState) => void;
    onCambioPestana?: (tab: string) => void;
    onOpenValidationCase?: (tab: "geolocalizacion" | "duracion", responseId?: string) => void;
    onOperationalAdjustmentApply?: (adjustment: MonitoreoTerritorialOperationalAdjustment) => Promise<MonitoreoTerritorialOperationalAdjustment>;
    onOperationalAdjustmentRevert?: (id: string, reason?: string) => Promise<string>;
    onOperationalAdjustmentsReset?: () => Promise<number>;
    selectedValidationResponseId?: string;
    onValidationResponseChange?: (responseId: string) => void;
  } = {},
) {
  const activeAdvanceTab = isTerritorialAdvanceLocalTab(options.pestanaActiva)
    ? options.pestanaActiva
    : "resumen";
  if (view === "fuentes") {
    return (
      <TerritorialSourceConsole
        pestanaActiva={options.pestanaActiva}
        busy={options.busy}
        phase={options.phase ?? "field"}
        reports={reports}
        state={options.state ?? null}
        onError={options.onError}
        onReload={options.onReload ?? noop}
        onSyncKobo={options.onSyncKobo ?? noop}
        onStateChange={options.onStateChange ?? noop}
      />
    );
  }
  if (view === "modelo") {
    return (
      <TerritorialModelWorkbench
        pestanaActiva={options.pestanaActiva}
        busy={options.busy}
        phase={options.phase ?? "field"}
        reports={reports}
        state={options.state ?? null}
        onError={options.onError}
        onReload={options.onReload ?? noop}
      />
    );
  }
  if (view === "calidad") {
    return (
      <ValidationView
        pestanaActiva={options.pestanaActiva}
        config={options.state?.config?.territorial ?? null}
        phase={options.phase}
        reports={reports}
        selectedResponseId={options.selectedValidationResponseId}
        onCambioPestana={options.onCambioPestana}
        onSelectedResponseChange={options.onValidationResponseChange}
        onStateChange={options.onStateChange}
      />
    );
  }
  if (view === "consultas") {
    return (
      <TerritorialReviewCasesWorkbench
        pestanaActiva={options.pestanaActiva}
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
        corte={corteTerritorial(state, reports)}
        syncedAt={state?.synced_at ?? ""}
        onPublished={options.onPublished}
      />
    );
  }
  if (view === "avance") {
    return (
      <TerritorialAdvanceWorkbench
        pestanaActiva={activeAdvanceTab}
        reports={reports}
        syncedAt={options.state?.synced_at ?? reports?.generated_at ?? ""}
        onCambioPestana={options.onCambioPestana}
      />
    );
  }
  if (view === "ocurrencias") {
    return (
      <TerritorialFieldOccurrencesWorkbench
        pestanaActiva={options.pestanaActiva}
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
  const [seccionActiva, setActiveView] = useState<MonitoreoSeccion>(() => seccionInicialMonitoreo("fuentes", TERRITORIAL_WORKBENCH_VIEWS));
  const [activeLocalTabs, setActiveLocalTabs] = useState<Partial<Record<MonitoreoSeccion, string>>>(() => {
    const porDefecto: Partial<Record<MonitoreoSeccion, string>> = {
      fuentes: defaultLocalTabForView("fuentes"),
      modelo: defaultLocalTabForView("modelo"),
      calidad: defaultLocalTabForView("calidad"),
      consultas: defaultLocalTabForView("consultas"),
      avance: defaultLocalTabForView("avance"),
      ocurrencias: defaultLocalTabForView("ocurrencias"),
    };
    // `?pestana=` solo aplica a la sección con la que se aterriza: pedir
    // "mapa" no debe reescribir la pestaña recordada de las otras cinco.
    const seccion = seccionInicialMonitoreo("fuentes", TERRITORIAL_WORKBENCH_VIEWS);
    const disponibles = (TERRITORIAL_LOCAL_TABS[seccion] ?? []).map((tab) => tab.key);
    return {
      ...porDefecto,
      [seccion]: pestanaInicialMonitoreo(
        porDefecto[seccion] ?? defaultLocalTabForView(seccion),
        disponibles,
      ),
    };
  });
  const [phase, setPhase] = useState<MonitoreoTerritorialPhase>("field");
  const [selectedValidationResponseId, setSelectedValidationResponseId] = useState("");
  const [loadingView, setLoadingView] = useState<MonitoreoSeccion | "initial" | "background" | null>("initial");
  const [mutationBusy, setMutationBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlightRef = useRef(new Map<string, number>());
  const scopeRequestSeqRef = useRef(0);
  const latestScopeRequestRef = useRef(new Map<string, number>());
  const scopeStateCacheRef = useRef(new Map<string, MonitoreoState>());
  const stateRef = useRef<MonitoreoState | null>(null);
  const activeViewRef = useRef<MonitoreoSeccion>("fuentes");
  const activeLocalTabsRef = useRef<Partial<Record<MonitoreoSeccion, string>>>(activeLocalTabs);
  const [chromeSyncJob, setChromeSyncJob] = useState<JobSnapshot<MonitoreoSyncResult> | null>(null);
  const [chromeSyncJobId, setChromeSyncJobId] = useState("");
  const [chromeSyncMode, setChromeSyncMode] = useState<"advance" | "full">("advance");
  const chromeSyncReloadedRef = useRef("");
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

  const localTabs = TERRITORIAL_LOCAL_TABS[seccionActiva] ?? [];
  const pestanaActiva = activeLocalTabs[seccionActiva] ?? defaultLocalTabForView(seccionActiva);
  const contextPanelId = territorialContextPanelId(seccionActiva);
  const contextTabId = useCallback(
    (key: string) => territorialContextTabId(seccionActiva, key),
    [seccionActiva],
  );
  useMonitoreoDireccion(seccionActiva, pestanaActiva, "territorial", {
    onSeccionPedida: setActiveView,
    onPestanaPedida: (pestana, seccion) => {
      // Solo si esa pestaña existe en la sección destino: una dirección con
      // una pestaña ajena no debe dejar la sección sin selección válida.
      const disponibles = TERRITORIAL_LOCAL_TABS[seccion] ?? [];
      if (!disponibles.some((tab) => tab.key === pestana)) return;
      setActiveLocalTabs((actuales) => ({ ...actuales, [seccion]: pestana }));
    },
  });
  // Publica las pestañas de esta sección para que el inspector las enumere.
  useRegistrarPestanasMonitoreo("territorial", seccionActiva, localTabs);
  const activeLocalTabDef = localTabs.find((tab) => tab.key === pestanaActiva) ?? localTabs[0] ?? null;
  const sourceKey = state ? territorialSourceKeyFromState(state, phase) : "sin-fuente";
  const preferredScope = scopeForPhaseViewTab(phase, seccionActiva, pestanaActiva);
  const cachedEntry = useMemo(() => {
    if (!state) return null;
    const scopes = [
      preferredScope,
      ...reportScopesForTerritorialView(seccionActiva),
    ].filter((scope, index, all) => all.indexOf(scope) === index);
    for (const scope of scopes) {
      const entry = monitoreoScopeCache.getTerritorial({ phase, source: sourceKey, scope });
      if (entry && territorialReportsCoverSelection(entry.reports, seccionActiva, pestanaActiva)) return entry;
    }
    return null;
  }, [pestanaActiva, seccionActiva, phase, preferredScope, sourceKey, state]);
  const rawReports = reportsFromState(state);
  const reports = rawReports && territorialReportsCoverSelection(rawReports, seccionActiva, pestanaActiva)
    ? rawReports
    : cachedEntry?.reports ?? null;
  const reportReady = Boolean(reports && territorialReportsCoverSelection(reports, seccionActiva, pestanaActiva));

  // El rail territorial montaba `ContextTabRail` sin estado: nunca tuvo señal de
  // readiness, ni siquiera la que Acreditación calculaba y descartaba. Las
  // pestañas de Avance —que son las que sostienen el entregable— ahora la traen.
  const contextTabItems = useMemo(
    () => localTabs.map((tab) => ({
      key: tab.key,
      label: tab.label,
      description: tab.detail,
      icon: tab.icon,
      ...(seccionActiva === "avance"
        ? estadoPestanaAvanceTerritorial(tab.key, state, reports)
        : {}),
    })),
    [localTabs, reports, seccionActiva, state],
  );
  // Readiness de la pestaña activa, para decirla en el encabezado del workbench.
  const pestanaEstadoActiva = contextTabItems.find((tab) => tab.key === pestanaActiva)?.estado;

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

  // Invalidación selectiva (unidad 3.4): borra los scopes de UNA fase+fuente
  // (estados locales y caché compartido de reportes) sin tocar el resto.
  const invalidateScopeStateForSource = useCallback((phaseValue: MonitoreoTerritorialPhase, sourceValue: string) => {
    const prefix = `${phaseValue}|${sourceValue}|`;
    for (const key of Array.from(scopeStateCacheRef.current.keys())) {
      if (key.startsWith(prefix)) scopeStateCacheRef.current.delete(key);
    }
    monitoreoScopeCache.invalidateTerritorial({ phase: phaseValue, source: sourceValue });
  }, []);

  useEffect(() => {
    activeViewRef.current = seccionActiva;
  }, [seccionActiva]);

  useEffect(() => {
    activeLocalTabsRef.current = activeLocalTabs;
  }, [activeLocalTabs]);

  const loadScope = useCallback(async (scope: MonitoreoReportScope, viewForLoading?: MonitoreoSeccion, force = false) => {
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
    const inFlightCount = inFlightRef.current.get(key) ?? 0;
    if (inFlightCount > 0 && !force) return null;
    const requestId = scopeRequestSeqRef.current + 1;
    scopeRequestSeqRef.current = requestId;
    latestScopeRequestRef.current.set(key, requestId);
    inFlightRef.current.set(key, inFlightCount + 1);
    markScopePending(key, true);
    if (viewForLoading) setLoadingView(viewForLoading);
    try {
      const next = await apiMonitoreoState({ includeReports: true, reportScope: scope, warmupCache: !force, force });
      if (latestScopeRequestRef.current.get(key) !== requestId) return next;
      rememberScopeState(next);
      setState(next);
      setError("");
      return next;
    } catch (e) {
      if (latestScopeRequestRef.current.get(key) === requestId) {
        setError((e as Error).message);
      }
      return null;
    } finally {
      const isLatestRequest = latestScopeRequestRef.current.get(key) === requestId;
      const remaining = Math.max(0, (inFlightRef.current.get(key) ?? 1) - 1);
      if (remaining > 0) {
        inFlightRef.current.set(key, remaining);
      } else {
        inFlightRef.current.delete(key);
        latestScopeRequestRef.current.delete(key);
        markScopePending(key, false);
      }
      if (viewForLoading && isLatestRequest) setLoadingView(null);
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
    if (!viewAllowedInPhase(phase, seccionActiva)) setActiveView("avance");
  }, [seccionActiva, phase]);

  useEffect(() => {
    if (!state || loadingView === "initial") return;
    if (error) return;
    if (cachedEntry) return;
    const scope = scopeForPhaseViewTab(phase, seccionActiva, pestanaActiva);
    const delay = seccionActiva === "avance" ? 180 : 0;
    const timer = window.setTimeout(() => {
      void loadScope(scope, seccionActiva);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [pestanaActiva, seccionActiva, cachedEntry, error, loadScope, loadingView, phase, state]);

  useEffect(() => {
    if (!state || loadingView === "initial") return;
    if (error) return;
    if (rawReports && TERRITORIAL_CANONICAL_HEADER_SCOPE_SET.has(rawReports.report_scope || "")) return;
    const cachedAdvance = monitoreoScopeCache.getTerritorial({
      phase,
      source: sourceKey,
      scope: "advance_summary",
    });
    if (cachedAdvance) return;
    const timer = window.setTimeout(() => {
      void loadScope("advance_summary");
    }, 160);
    return () => window.clearTimeout(timer);
  }, [error, loadScope, loadingView, phase, rawReports?.report_scope, sourceKey, state?.synced_at]);

  useEffect(() => {
    if (!state || loadingView === "initial") return;
    if (error) return;
    if (phase === "pilot" || seccionActiva !== "avance" || pestanaActiva !== "resumen") return;
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
  }, [pestanaActiva, seccionActiva, error, loadScope, loadingView, phase, reports?.report_scope, sourceKey, state]);

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
    () => visibleViews.find((item) => item.key === seccionActiva) ?? visibleViews[0] ?? TERRITORIAL_WORKBENCH_VIEWS[0],
    [seccionActiva, visibleViews],
  );

  useEffect(() => {
    if (!localTabs.length) return;
    if (localTabs.some((tab) => tab.key === pestanaActiva)) return;
    setActiveLocalTabs((current) => ({ ...current, [seccionActiva]: localTabs[0]?.key ?? "" }));
  }, [pestanaActiva, seccionActiva, localTabs]);

  useEffect(() => {
    if (!activeLocalTabDef || typeof window === "undefined") return undefined;
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("prosecnur:monitoreo-local-tab", {
        detail: { view: seccionActiva, key: activeLocalTabDef.key, label: activeLocalTabDef.label },
      }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeLocalTabDef, seccionActiva]);

  const changeLocalTab = useCallback((key: string) => {
    const tab = (TERRITORIAL_LOCAL_TABS[seccionActiva] ?? []).find((item) => item.key === key);
    setActiveLocalTabs((current) => ({ ...current, [seccionActiva]: key }));
    if (tab && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("prosecnur:monitoreo-local-tab", {
        detail: { view: seccionActiva, key: tab.key, label: tab.label },
      }));
    }
  }, [seccionActiva]);
  useEffect(() => {
    const tabsByKey = new Map(localTabs.map((tab) => [tab.key, tab]));
    function handleLocalTabActive(event: Event) {
      const detail = (event as CustomEvent<{ view?: string; key?: unknown }>).detail;
      const key = typeof detail?.key === "string" ? detail.key : "";
      if (detail?.view !== seccionActiva || !tabsByKey.has(key) || key === pestanaActiva) return;
      changeLocalTab(key);
    }
    window.addEventListener("prosecnur:monitoreo-local-tab-active", handleLocalTabActive);
    return () => window.removeEventListener("prosecnur:monitoreo-local-tab-active", handleLocalTabActive);
  }, [changeLocalTab, localTabs, pestanaActiva, seccionActiva]);
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
  const canonicalHeaderReports = useMemo(() => {
    if (rawReports && TERRITORIAL_CANONICAL_HEADER_SCOPE_SET.has(rawReports.report_scope || "")) return rawReports;
    for (const scope of TERRITORIAL_CANONICAL_HEADER_SCOPES) {
      const entry = monitoreoScopeCache.getTerritorial({ phase, source: sourceKey, scope });
      if (entry?.reports) return entry.reports;
    }
    return null;
  }, [phase, rawReports, sourceKey, state?.synced_at]);
  const reportKpis = territorialReportKpis(reports);
  const canonicalReportKpis = territorialReportKpis(canonicalHeaderReports);
  const dashboardKpis = state?.dashboard?.kpis;
  const headerValidas = nullableMetric(canonicalReportKpis.validas) ?? nullableMetric(reportKpis.validas) ?? nullableMetric(dashboardKpis?.valid);
  const headerMeta = nullableMetric(canonicalReportKpis.meta) ?? nullableMetric(reportKpis.meta) ?? nullableMetric(dashboardKpis?.target);
  const headerAvance = nullableMetric(canonicalReportKpis.avance_pct) ?? nullableMetric(reportKpis.avance_pct) ?? nullableMetric(dashboardKpis?.avance_pct);
  const sectionViewMetrics = { avance: pct(headerAvance) };
  const pilotPhaseHealth = territorialPhaseHealthForState(state, "pilot");
  const fieldPhaseHealth = territorialPhaseHealthForState(state, "field");
  const refreshCurrentView = useCallback(() => {
    void loadScope(preferredScope, seccionActiva, true);
  }, [seccionActiva, loadScope, preferredScope]);
  const syncActiveTerritorialSource = useCallback(async (syncMode: "advance" | "full" = "advance") => {
    if (!state?.config) {
      setError("Abre un proyecto territorial antes de actualizar.");
      return;
    }
    const source = activeTerritorialKoboSource(state, phase);
    if (!source?.id) {
      setError(`Define primero una fuente Kobo para ${phase === "field" ? "Campo" : "Piloto"}.`);
      return;
    }
    setError("");
    setChromeSyncMode(syncMode);
    setChromeSyncJob(null);
    setChromeSyncJobId("");
    chromeSyncReloadedRef.current = "";
    try {
      const started = await apiMonitoreoSync(state.config, [source.id], { syncMode });
      setChromeSyncJobId(started.job_id);
      const first = await apiJobStatus<MonitoreoSyncResult>(started.job_id).catch(() => null);
      setChromeSyncJob(first);
    } catch (e) {
      setChromeSyncJob(null);
      setChromeSyncJobId("");
      setError((e as Error).message);
      throw e;
    }
  }, [phase, state]);
  const syncAdvance = useCallback(async () => {
    // El Avance también refresca las ocurrencias de campo si hay una fuente
    // configurada (va a Kobo aparte). Fire-and-forget tolerante: si no hay token
    // o fuente, no bloquea el avance; al terminar refresca la vista para tomar el
    // snapshot nuevo de ocurrencias.
    const fo = (state?.config?.territorial as { field_occurrences?: { source_id?: string; asset_uid?: string } } | undefined)?.field_occurrences;
    if (fo && (fo.source_id || fo.asset_uid)) {
      void apiMonitoreoTerritorialOccurrencesSync({ source_id: fo.source_id, asset_uid: fo.asset_uid })
        .then(() => refreshCurrentView())
        .catch(() => { /* sin token/fuente Kobo: el avance sigue igual */ });
    }
    await syncActiveTerritorialSource("advance");
  }, [refreshCurrentView, state, syncActiveTerritorialSource]);
  const syncField = useCallback(() => syncActiveTerritorialSource("full"), [syncActiveTerritorialSource]);
  useEffect(() => {
    if (!chromeSyncJobId) return;
    if (isTerminalJob(chromeSyncJob)) {
      if (chromeSyncJob.status === "done" && chromeSyncReloadedRef.current !== chromeSyncJobId) {
        chromeSyncReloadedRef.current = chromeSyncJobId;
        refreshCurrentView();
      }
      if (chromeSyncJob.status === "error") {
        setError(jobErrorMessage(chromeSyncJob) || "La actualización territorial terminó con error.");
      }
      setChromeSyncJobId("");
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const next = await apiJobStatus<MonitoreoSyncResult>(chromeSyncJobId);
        if (cancelled) return;
        setChromeSyncJob(next);
        if (next.status === "done" && chromeSyncReloadedRef.current !== chromeSyncJobId) {
          chromeSyncReloadedRef.current = chromeSyncJobId;
          refreshCurrentView();
          setChromeSyncJobId("");
        } else if (next.status === "error") {
          setError(jobErrorMessage(next) || "La actualización territorial terminó con error.");
          setChromeSyncJobId("");
        } else if (next.status === "cancelled") {
          setChromeSyncJobId("");
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setChromeSyncJobId("");
        }
      }
    };
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 1400);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // Deps por status/id (patrón de TerritorialModelWorkbench): con el objeto
    // `chromeSyncJob` en las deps, cada setChromeSyncJob(next) del tick
    // desmontaba el intervalo y disparaba un poll inmediato extra, duplicando
    // la cadencia real contra el Plumber mono-hilo.
  }, [chromeSyncJob?.status, chromeSyncJobId, refreshCurrentView]);
  const applyTerritorialPageState = useCallback((next: MonitoreoState) => {
    const withPhase = withTerritorialPhase(next, phase);
    // Invalidación selectiva (3.4f): una mutación territorial (ajuste
    // operativo, anulación, reconciliación, cambio de fuente) altera los
    // reportes de TODOS los scopes de su fase+fuente —una anulación cambia
    // válidas en avance, validación y consultas—, así que esa fase+fuente se
    // invalida en bloque. Los scopes de la otra fase y de otras fuentes no
    // dependen de esos datos y se conservan calientes en lugar del clear
    // total que forzaba a re-hidratar todo el módulo.
    const nextSource = territorialSourceKeyFromState(withPhase, phase);
    invalidateScopeStateForSource(phase, nextSource);
    if (sourceKey !== nextSource) invalidateScopeStateForSource(phase, sourceKey);
    rememberScopeState(withPhase);
    setState(withPhase);
    setError("");
  }, [invalidateScopeStateForSource, phase, rememberScopeState, sourceKey]);
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
    const nextView = viewAllowedInPhase(nextPhase, seccionActiva) ? seccionActiva : "avance";
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
  }, [activeLocalTabs, seccionActiva, clearScopeStateCache, phase, rememberScopeState]);
  const handlePhaseChange = useCallback((nextPhase: MonitoreoTerritorialPhase) => {
    void changeTerritorialPhase(nextPhase);
  }, [changeTerritorialPhase]);
  const primarySources = state?.sources.filter((source) => source.role !== "ocurrencias_campo") ?? [];
  const activeSources = primarySources.filter((source) => source.enabled).length;
  const sourceTotal = primarySources.length;
  const activeScopeKey = `${phase}|${sourceKey}|${preferredScope}`;
  const activeScopePending = pendingScopes.has(activeScopeKey);
  const activeNeedsReport = viewNeedsTerritorialReport(seccionActiva, pestanaActiva);
  const activeLoading = loadingView === "initial"
    || loadingView === seccionActiva
    || activeScopePending
    || Boolean(state && activeNeedsReport && !reportReady && !error);
  const chromeSyncing = Boolean(chromeSyncJobId);
  const chromeBusy = activeLoading || mutationBusy || chromeSyncing;
  const chromeSyncProgress = chromeSyncing ? {
    active: chromeSyncMode,
    percent: jobProgressPercent(chromeSyncJob),
    phase: jobProgressPhase(chromeSyncJob) ?? "Actualizando",
    message: jobProgressMessage(chromeSyncJob) ?? "Sincronizando respuestas territoriales...",
  } : null;
  const chromeGeneratedAt = reports?.generated_at ?? state?.generated_at ?? state?.synced_at ?? "";
  const chromeGenerationStatus = error ? "failed" : reportReady ? "" : "stale";

  return (
    <PageFrame
      title={TERRITORIAL_ROUTE.label}
      headerMode="sr-only"
      bodyMode="fill"
      layout="workbench"
      scrollOwner="panels"
      resetScrollKey={`${seccionActiva}/${pestanaActiva}`}
      className="mon-page"
      density="compact"
    >
      <span
        hidden
        data-audit-ready={activeLoading ? undefined : "monitoreo"}
        data-audit-loading={activeLoading ? "true" : "false"}
        data-audit-has-dashboard={state?.dashboard ? "true" : "false"}
      />
      <MonitoreoModuleChrome
        routes={MONITOREO_MODOS}
        route={TERRITORIAL_ROUTE}
        routeSelected
        seccionActiva={seccionActiva}
        saving={chromeBusy}
        syncedAt={state?.synced_at ?? ""}
        generatedAt={chromeGeneratedAt}
        generationStatus={chromeGenerationStatus}
        pendingRegeneration={!reportReady && !error}
        sourceTotal={sourceTotal}
        activeSources={activeSources}
        nRows={state?.n_rows ?? 0}
        hasSnapshot={Boolean(state?.has_snapshot)}
        syncing={chromeSyncing}
        syncProgress={chromeSyncProgress}
        viewMetrics={sectionViewMetrics}
        syncDisabled={!state || chromeBusy}
        syncLabel="Todo"
        syncTitle="Actualizar todas las respuestas Kobo de la fase activa"
        onSyncAll={syncField}
        advanceSyncDisabled={!state || chromeBusy}
        advanceSyncLabel="Avance"
        advanceSyncTitle="Actualizar avance territorial"
        onSyncAdvance={syncAdvance}
        onCambioSeccion={setActiveView}
      />

      <MonitoreoWorkbenchChrome
        seccionActiva={seccionActiva}
        isTerritorial
        hasReportStatus
        scrollResetKey={`${seccionActiva}/${pestanaActiva}`}
        rail={(
          <ContextTabRail
            ariaLabel={`Pestañas locales de ${activeDef.label}`}
            activeKey={pestanaActiva}
            items={contextTabItems}
            panelId={contextPanelId}
            tabId={contextTabId}
            onChange={changeLocalTab}
            footer={(
              <MonitoreoRailLastUpdate value={state?.synced_at ?? ""} />
            )}
          />
        )}
        head={(
          <TerritorialWorkbenchHead
            activeDef={activeDef}
            activeSources={activeSources}
            fieldPhaseHealth={fieldPhaseHealth}
            headerAvance={headerAvance}
            headerMeta={headerMeta}
            headerValidas={headerValidas}
            loadingView={loadingView}
            nRows={state?.n_rows ?? reports?.kpis.total_respuestas ?? 0}
            onPhaseChange={handlePhaseChange}
            pestanaEstado={pestanaEstadoActiva}
            pestanaLabel={activeLocalTabDef?.label}
            phase={phase}
            pilotPhaseHealth={pilotPhaseHealth}
          />
        )}
        contentId={contextPanelId}
        contentRole="tabpanel"
        contentAriaLabelledBy={contextTabId(pestanaActiva)}
      >
          {error && (
            <TerritorialViewError message={error} onRetry={refreshCurrentView} retrying={chromeBusy} />
          )}

          {activeLoading ? (
            <TerritorialLoadingView view={seccionActiva} />
          ) : (
            renderView(seccionActiva, reports, {
              pestanaActiva,
              busy: chromeBusy,
              onError: setError,
              onPublished: refreshCurrentView,
              onReload: refreshCurrentView,
              onSyncKobo: syncField,
              onCambioPestana: changeLocalTab,
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
