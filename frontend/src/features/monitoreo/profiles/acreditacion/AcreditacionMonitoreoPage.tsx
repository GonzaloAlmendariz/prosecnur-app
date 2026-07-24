import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AlertCircle, BarChart3, CalendarRange, CheckCircle2, ChevronDown, ClipboardCheck, ContactRound, Download, Eye, FileCheck2, Filter, KeyRound, Layers3, Link2, Loader2, Mail, PhoneCall, PlugZap, Plus, QrCode, RefreshCw, Route, Save, Search, ShieldAlert, SlidersHorizontal, Table2, Target, XCircle } from "lucide-react";
import { PageFrame } from "../../../../components/PageFrame";
import { GlidingTabList } from "../../../../components/GlidingTabList";
import {
  apiConnectionTokenLoad,
  apiJobStatus,
  apiMonitoreoAcreditacionCaseReconciliation,
  apiMonitoreoAcreditacionSeguimiento,
  apiMonitoreoCierre,
  apiMonitoreoCollectorsConfig,
  apiMonitoreoKoboAssets,
  apiMonitoreoSheetsInspect,
  apiMonitoreoSheetsSource,
  apiMonitoreoSheetsSync,
  apiMonitoreoConfig,
  apiMonitoreoSource,
  apiMonitoreoState,
  apiMonitoreoSync,
  apiMonitoreoSurveyMonkeyCollectors,
  apiSurveyMonkeyMultibaseInspectSurvey,
  apiSurveyMonkeyMultibaseListSurveys,
  type ConnectionTokenState,
  type MonitoreoAcreditacion,
  type MonitoreoAcreditacionComponente,
  type MonitoreoAcreditacionIntentos,
  type MonitoreoAcreditacionReports,
  type MonitoreoAcreditacionSeguimientoPayload,
  type MonitoreoAssistedReviewCandidate,
  type MonitoreoCollectorUse,
  type MonitoreoConfig,
  type MonitoreoGoal,
  type MonitoreoInternalQueryCase,
  type MonitoreoInternalQueryIssue,
  type JobProgress as JobProgressData,
  type MonitoreoKoboAssetItem,
  type MonitoreoLinkCollector,
  type MonitoreoReportBlock,
  type MonitoreoReportSheet,
  type MonitoreoReportWeekday,
  type MonitoreoRow,
  type MonitoreoSheetsInspectResult,
  type MonitoreoSource,
  type MonitoreoSourcePayload,
  type MonitoreoState,
  type MonitoreoStrategyReportException,
  type MonitoreoStrategyPhase,
  type MonitoreoSurveyMonkeyCollector,
  type MonitoreoSyncResult,
  type MonitoreoVariable,
  type SurveyMonkeyMultibaseInspection,
  type SurveyMonkeyMultibaseListItem,
} from "../../../../api/client";
import { MODULE_TONES } from "../../../../lib/modules";
import { PlotlyChart } from "../../../../lib/PlotlyChart";
import { MONITOREO_ROUTES, WORKBENCH_VIEWS, workbenchViewsForRoute, type WorkbenchView } from "../../core/monitoreoRegistry";
import { initialMonitoreoView, useMonitoreoTabParam } from "../../useMonitoreoTabParam";
import { buildCaseCrossingExplanation } from "../../core/acreditacionActorCases";
import { MonitoreoWorkbenchChrome, MonitoreoWorkbenchHead, MonitoreoWorkbenchRail, type MonitoreoWorkbenchRailTab } from "../../components";
import {
  filterInternalQueryCases,
  compareInternalQueryDateValues,
  formatInternalQueryDateLabel,
  internalCaseCrossingLabel,
  internalCaseCrossingValue,
  internalCaseResponseStateLabel,
  internalCaseResponseStateValue,
  internalQueryCollectorDisplayLabel,
  internalQueryCollectorValue,
  normalizeInternalQueries,
  summarizeInternalCases,
} from "../../internalQueries";
import { MonitoreoOutputsWorkbench } from "../../salidas/MonitoreoOutputsWorkbench";
import { MonitoreoModuleChrome } from "../../shell/MonitoreoModuleChrome";
import {
  ACREDITACION_PHONE_ALERT_RULES,
  acreditacionQualityActionLabel,
  acreditacionQualityLevelLabel,
  acreditacionQualityPriorityValue,
  acreditacionQualityStatusLabel,
  buildAcreditacionPhoneRealAlertModel,
  buildAcreditacionPhoneSupervisionModel,
  type AcreditacionPhoneSupervisionPriorityGroup,
  type AcreditacionPhoneSupervisionModel,
  type AcreditacionQualityAlertItem,
  type AcreditacionQualityAlertTone,
} from "./AcreditacionPhoneAlerts";
import { upsertAcreditacionActorGoal } from "./AcreditacionActorGoals";
import {
  buildAcreditacionPhoneDailyPoints,
  buildAcreditacionPhoneDailyStatusSeries,
  type AcreditacionPhoneDailyPoint,
  type AcreditacionPhoneDailyStatusSeries,
} from "./AcreditacionPhoneDailyTrend";
import {
  acreditacionActorOptions,
  acreditacionCollectorCountForSource,
  acreditacionCollectorsForSource,
  acreditacionKoboResponseSources,
  acreditacionSourceChannel,
  acreditacionSourceResponseCount,
  acreditacionSourceWithOperationalMetadata,
  acreditacionSweepSourceForChannel,
  acreditacionSweepSources,
  buildAcreditacionPhoneSourceContract,
  buildAcreditacionTelephoneChannels,
  acreditacionSurveySourceName,
  buildAcreditacionActiveSourcesSummary,
  type AcreditacionCollectorRow,
  type AcreditacionPhoneSourceContract,
  type AcreditacionPhoneSourceSlot,
  type AcreditacionTelephoneChannel,
} from "./AcreditacionSourcesModel";
import { SourceSyncActions, type SourceSyncActionsProgress } from "../../components";
import type { MonitoreoReportScope } from "../types";
import "../../monitoreo.css";
import "../../shell/monitoreoShell.css";
import "../profilePage.css";

const ACREDITACION_ROUTE = MONITOREO_ROUTES.find((route) => route.family === "acreditacion") ?? MONITOREO_ROUTES[0];
const TELEFONICO_ROUTE = MONITOREO_ROUTES.find((route) => route.family === "telefonico") ?? ACREDITACION_ROUTE;
const ACREDITACION_SOURCE_TABS = [
  { key: "survey", label: "Encuestas en plataforma", detail: "SurveyMonkey/Kobo", icon: QrCode },
  { key: "sheets", label: "Bases en Sheets", detail: "Universo por actor", icon: Table2 },
  { key: "collectors", label: "Recopiladores", detail: "Inclusion y alias", icon: ContactRound },
  { key: "activas", label: "Fuentes activas", detail: "Estado del paquete", icon: PlugZap },
] as const;
type AcreditacionSourceTab = typeof ACREDITACION_SOURCE_TABS[number]["key"];
const ACREDITACION_DEFAULT_ACTORS = ["Estudiantes", "Docentes", "Egresados", "Administrativos", "Empleadores"];
const KOBO_DEFAULT_BASE_URL = "https://kf.kobotoolbox.org";
type AcreditacionSourcePresetKey = "base_trabajada" | "barrido_telefonico" | "respuestas_surveymonkey";
type AcreditacionSourcePreset = {
  key: AcreditacionSourcePresetKey;
  icon: typeof Layers3;
  label: string;
  service: "Google Sheets" | "SurveyMonkey/Kobo";
  detail: string;
  bullets: string[];
  provider: MonitoreoSource["kind"];
  role: NonNullable<MonitoreoSource["role"]>;
  sourceLabel: string;
  sheetLabel?: string;
};
const ACREDITACION_SOURCE_PRESETS: AcreditacionSourcePreset[] = [
  {
    key: "base_trabajada",
    icon: Layers3,
    label: "Base de universo",
    service: "Google Sheets",
    detail: "Excel o Google Sheet que define el universo/base telefónica y sus variables de cuota.",
    bullets: ["Universo contactable", "Variables de cuota", "Población objetivo"],
    provider: "google_sheets",
    role: "universo",
    sourceLabel: "Base de universo",
    sheetLabel: "Pestaña de universo",
  },
  {
    key: "barrido_telefonico",
    icon: PhoneCall,
    label: "Barrido telefónico",
    service: "Google Sheets",
    detail: "Hoja operativa donde viven asignaciones, responsables, intentos, estados y fechas de llamada.",
    bullets: ["Asignaciones", "Responsables", "Estados e intentos"],
    provider: "google_sheets",
    role: "barrido",
    sourceLabel: "Barrido telefónico",
    sheetLabel: "Pestaña de barrido",
  },
  {
    key: "respuestas_surveymonkey",
    icon: QrCode,
    label: "Kobo/plataforma",
    service: "SurveyMonkey/Kobo",
    detail: "ENCUESTAS_ESTUDIO: una o más encuestas Kobo o SurveyMonkey por actor, segmento/carrera y canal.",
    bullets: ["Actor y canal", "Segmento/carrera", "Encuesta/asset"],
    provider: "surveymonkey",
    role: "respuestas",
    sourceLabel: "Respuestas de plataforma",
  },
];
export const ACREDITACION_MODEL_TABS = [
  { key: "estructura", label: "Modelo operativo", detail: "Metas por actor", icon: Target },
  { key: "estrategias", label: "Cronograma", detail: "Campo y reportes", icon: CalendarRange },
  { key: "resumen", label: "Resumen", detail: "Lectura de Fuentes", icon: BarChart3 },
] as const;
type AcreditacionModelVisibleTab = typeof ACREDITACION_MODEL_TABS[number]["key"];
type AcreditacionModelTab = AcreditacionModelVisibleTab | "enlaces" | "casos" | "reglas";
export const ACREDITACION_CONSULTA_TABS = [
  { key: "plataforma", label: "Registros en plataforma", detail: "Respuestas y cruce", icon: QrCode },
  { key: "base", label: "Estado de la base", detail: "Actor por actor", icon: Table2 },
  { key: "cruces", label: "Cruces efectivos", detail: "Razón de cruce", icon: Link2 },
  { key: "subsanacion", label: "Subsanación", detail: "Decisión auditada", icon: ShieldAlert },
] as const;
export type AcreditacionConsultaTab = typeof ACREDITACION_CONSULTA_TABS[number]["key"];
export const ACREDITACION_PHONE_TABS = [
  { key: "resumen", label: "Resumen", detail: "Barrido telefónico", icon: PhoneCall },
  { key: "dia", label: "Día", detail: "Efectivas Kobo", icon: CalendarRange },
  { key: "incidencia", label: "Incidencias de la base", detail: "Sin efectiva e insistencia", icon: AlertCircle },
  { key: "responsables", label: "Responsables", detail: "Equipo y carga", icon: ContactRound },
  { key: "alertas", label: "Alertas", detail: "Alertas reales", icon: ShieldAlert },
  { key: "supervision", label: "Supervisión telefónica", detail: "Control y muestra", icon: ClipboardCheck },
] as const;
type AcreditacionPhoneTab = typeof ACREDITACION_PHONE_TABS[number]["key"];
const ACREDITACION_ADVANCE_TABS = [
  { key: "resumen", label: "Resumen", detail: "Avance general", icon: BarChart3 },
  { key: "actores", label: "Actores", detail: "Brechas por unidad", icon: Layers3 },
  { key: "encuestas", label: "Encuestas", detail: "Fuentes y canales", icon: QrCode },
  { key: "detalle", label: "Detalle", detail: "Controles", icon: Table2 },
  { key: "salidas", label: "Salidas", detail: "PDF y Sheets", icon: Download },
] as const;
type AcreditacionAdvanceTab = typeof ACREDITACION_ADVANCE_TABS[number]["key"];
type AcreditacionLocalTabKey = AcreditacionSourceTab | AcreditacionModelTab | AcreditacionConsultaTab | AcreditacionPhoneTab | AcreditacionAdvanceTab;
export type AcreditacionProfileMode = "acreditacion" | "telefonico";
type AcreditacionActionStatus = { tone: "success" | "error" | "info"; message: string } | null;
type AcreditacionSourceSyncProgress = {
  mode: "advance" | "full";
  percent: number | null;
  phase: string;
  message: string;
};
type AcreditacionCaseReconciliationPayload = {
  response_id: string;
  action: "keep_excluded" | "include_with_caveat";
  candidate_id?: string;
  note?: string;
};

function isTelefonicoMonitoreoState(state?: MonitoreoState | null) {
  return (state?.monitoreo_profile?.family ?? state?.config?.monitoreo_profile?.family) === "telefonico";
}

function fmt(value: unknown, fallback = "0") {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (Number.isFinite(n)) return new Intl.NumberFormat("es-PE").format(n);
  return String(value);
}

function formatCaseLabel(value: number) {
  return `${fmt(value)} caso${value === 1 ? "" : "s"}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

function pct(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "S/D";
  return `${Math.round(n)}%`;
}

function pctFrom(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return "S/D";
  return `${((value / total) * 100).toLocaleString("es-PE", { maximumFractionDigits: 1 })}%`;
}

function num(value: unknown, fallback = 0) {
  if (value == null || value === "") return fallback;
  const parsed = Number(String(value).replace(/%/g, "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function unknownArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function rowNumber(row: Record<string, unknown>, keys: string[], fallback = 0) {
  const normalized = new Map(Object.keys(row).map((key) => [
    key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
    key,
  ]));
  for (const key of keys) {
    const hit = normalized.get(key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
    if (hit) return num(row[hit], fallback);
  }
  return fallback;
}

type SeguimientoDraft = {
  n_efectivo: string;
  notas_campo: string;
  intentos: Record<keyof MonitoreoAcreditacionIntentos, string>;
};

const CANALES: Array<keyof MonitoreoAcreditacionIntentos> = ["email", "whatsapp", "sms", "telefono", "presencial"];

function draftFromComponent(comp: MonitoreoAcreditacionComponente | null): SeguimientoDraft {
  const intentos = comp?.seguimiento.intentos_canal ?? { email: 0, whatsapp: 0, sms: 0, telefono: 0, presencial: 0 };
  return {
    n_efectivo: String(comp?.seguimiento.n_efectivo ?? 0),
    notas_campo: comp?.seguimiento.notas_campo ?? "",
    intentos: {
      email: String(intentos.email ?? 0),
      whatsapp: String(intentos.whatsapp ?? 0),
      sms: String(intentos.sms ?? 0),
      telefono: String(intentos.telefono ?? 0),
      presencial: String(intentos.presencial ?? 0),
    },
  };
}

function columnLabel(column: string) {
  const labels: Record<string, string> = {
    "Rechazos plataforma": "Rechazo",
    Rechazos: "Rechazo",
    "Sin respuesta plataforma": "Sin respuesta",
    Validas: "Válidas",
    Universo: "Base reportada",
  };
  return labels[column] ?? column.replaceAll("_", " ");
}

type AcreditacionStateSummary = {
  universe: number;
  effective: number;
  partial: number;
  refusal: number;
  unanswered: number;
  reference: number | null;
  referenceLabel: string;
};

function stateFromActors(actors: MonitoreoRow[] = [], fallbackRows = 0, fallbackValid = 0): AcreditacionStateSummary {
  const totals = actors.reduce<AcreditacionStateSummary>((acc, row) => {
    const record = row as Record<string, unknown>;
    acc.universe += rowNumber(record, ["Universo", "Total"], 0);
    acc.effective += rowNumber(record, ["Efectivas", "Completas", "Validas", "Válidas"], 0);
    acc.partial += rowNumber(record, ["Parciales"], 0);
    acc.refusal += rowNumber(record, ["Rechazo", "Rechazos plataforma", "Rechazos"], 0);
    acc.unanswered += rowNumber(record, ["Sin respuesta"], 0);
    const ref = rowNumber(record, ["Referencia operativa", "Meta", "Mínimo", "Minimo"], Number.NaN);
    if (Number.isFinite(ref) && ref > 0) acc.reference = (acc.reference ?? 0) + ref;
    const label = String(record["Referencia etiqueta"] ?? "").trim();
    if (label) acc.referenceLabel = label;
    return acc;
  }, { universe: 0, effective: 0, partial: 0, refusal: 0, unanswered: 0, reference: null, referenceLabel: "Mínimo a alcanzar" });

  if (!actors.length) {
    totals.universe = Math.max(0, fallbackRows);
    totals.effective = Math.max(0, fallbackValid);
  }
  if (totals.universe > 0 && totals.unanswered <= 0) {
    totals.unanswered = Math.max(0, totals.universe - totals.effective - totals.partial - totals.refusal);
  }
  return totals;
}

function stateFromReports(
  reports: MonitoreoAcreditacionReports | null,
  fallbackRows = 0,
  fallbackValid = 0,
  preferActors = false,
): AcreditacionStateSummary {
  const actorSummary = stateFromActors(reports?.client_report?.actors ?? [], fallbackRows, fallbackValid);
  if (preferActors && reports?.client_report?.actors?.length) return actorSummary;
  const queries = normalizeInternalQueries(reports?.internal_queries);
  const cases = queries.case_rollup?.length ? queries.case_rollup : [];
  if (cases.length) {
    const summary = summarizeInternalCases(cases);
    return {
      universe: cases.length,
      effective: summary.effective,
      partial: summary.partial,
      refusal: summary.refusal,
      unanswered: summary.pending,
      reference: null,
      referenceLabel: "Casos oficiales",
    };
  }
  return actorSummary;
}

function EstadoProgresoPanel({ summary, label = "Estado + progreso" }: { summary: AcreditacionStateSummary; label?: string }) {
  const total = Math.max(1, summary.universe || summary.effective + summary.partial + summary.refusal + summary.unanswered);
  const progress = summary.universe > 0 ? Math.min(100, Math.max(0, (summary.effective / summary.universe) * 100)) : 0;
  const states = [
    { key: "effective", label: "Efectivas", value: summary.effective },
    { key: "partial", label: "Parciales", value: summary.partial },
    { key: "refusal", label: "Rechazo", value: summary.refusal },
    { key: "unanswered", label: "Sin respuesta", value: summary.unanswered },
  ];
  return (
    <div className="mon-acr-state-panel" aria-label={label}>
      <div className="mon-acr-state-head">
        <span>{label}</span>
        <strong>{pct(progress)}</strong>
      </div>
      <div className="mon-acr-state-grid">
        {states.map((item) => (
          <div key={item.key} className={`mon-acr-state mon-acr-state--${item.key}`}>
            <span>{item.label}</span>
            <strong>{fmt(item.value)} <small>({pctFrom(item.value, total)})</small></strong>
          </div>
        ))}
      </div>
      <div className="mon-acr-state-meter" aria-label={`Base reportada ${fmt(summary.universe)}`}>
        {states.map((item) => {
          const share = total > 0 ? Math.max(0, (item.value / total) * 100) : 0;
          return (
            <i key={item.key} className={`is-${item.key}`} style={{ width: `${share}%` }}>
              {share >= 3 ? <span>{share >= 8 ? `${item.label} ${pctFrom(item.value, total)}` : pctFrom(item.value, total)}</span> : null}
            </i>
          );
        })}
      </div>
      <div className="mon-acr-state-foot">
        <span>Base reportada: {fmt(summary.universe)}</span>
        {summary.reference ? <em>{summary.referenceLabel}: {fmt(summary.reference)}</em> : null}
      </div>
    </div>
  );
}

function EstadoProgresoCompact({ summary, label = "Estado + progreso" }: { summary: AcreditacionStateSummary; label?: string }) {
  const total = Math.max(1, summary.universe || summary.effective + summary.partial + summary.refusal + summary.unanswered);
  const progress = summary.universe > 0 ? Math.min(100, Math.max(0, (summary.effective / summary.universe) * 100)) : 0;
  const segments = [
    { key: "effective", label: "Efectivas", value: summary.effective, pct: (summary.effective / total) * 100 },
    { key: "partial", label: "Parciales", value: summary.partial, pct: (summary.partial / total) * 100 },
    { key: "refusal", label: "Rechazos", value: summary.refusal, pct: (summary.refusal / total) * 100 },
    { key: "unanswered", label: "Sin respuesta", value: summary.unanswered, pct: (summary.unanswered / total) * 100 },
  ];

  return (
    <div className="mon-acr-state-compact" aria-label={label}>
      <div className="mon-acr-state-compact-copy">
        <span>{label}</span>
        <strong>{progress.toLocaleString("es-PE", { maximumFractionDigits: 0 })}%</strong>
        <em>{fmt(summary.effective)} efectivas · {fmt(summary.unanswered)} sin respuesta · base {fmt(summary.universe)}</em>
      </div>
      <div className="mon-acr-state-compact-meter" aria-label={`Base reportada ${fmt(summary.universe)}`}>
        {segments.map((item) => (
          <i
            key={item.key}
            className={`is-${item.key}`}
            title={`${item.label}: ${fmt(item.value)} (${pct(item.pct)})`}
            style={{ "--acr-state-compact-size": `${Math.max(0, Math.min(100, item.pct))}%` } as CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}

function cumplimientoLabel(estado: MonitoreoAcreditacion["dashboard"]["cards"][number]["estado"]) {
  if (estado === "cumple_meta") return "Cumple";
  if (estado === "brecha_menor_documentada") return "Brecha menor";
  if (estado === "brecha_relevante") return "Brecha relevante";
  return "Sin meta";
}

function AcreditacionCumplimientoBadge({ estado }: { estado: MonitoreoAcreditacion["dashboard"]["cards"][number]["estado"] }) {
  return (
    <span className={`mon-acr-model-badge is-${estado}`}>
      {estado === "cumple_meta" ? <CheckCircle2 size={13} /> : estado === "sin_objetivo" ? <Target size={13} /> : <AlertCircle size={13} />}
      {cumplimientoLabel(estado)}
    </span>
  );
}

function AcreditacionMetric({ label, value, hint }: { label: string; value: number | null | undefined; hint?: string }) {
  return (
    <div className="mon-acr-model-metric">
      <span>{label}</span>
      <strong>{value == null || !Number.isFinite(Number(value)) ? "S/D" : fmt(value)}</strong>
      {hint ? <em>{hint}</em> : null}
    </div>
  );
}

function AcreditacionModelActorSummaryCard({
  card,
  saving,
  onSaveGoal,
}: {
  card: AcreditacionActorCard;
  saving?: boolean;
  onSaveGoal?: (actor: string, meta: number, metaPct: number | null) => Promise<void>;
}) {
  const connectedMechanisms = card.mechanisms.filter((item) => item.role !== "Universo");
  const baseMechanisms = card.mechanisms.filter((item) => item.role === "Universo" || item.role === "Barrido");
  const responseMechanisms = card.mechanisms.filter((item) => item.role === "Respuestas");
  const channels = Array.from(new Set(connectedMechanisms.map((item) => {
    if (!item.channel) return item.role;
    const label = acreditacionChannelLabel(item.channel);
    return label === "Sin canal" ? item.role : label;
  }).filter(Boolean)));
  const statusTone = card.meta == null ? "warning" : card.statusTone === "complete" ? "ready" : "base";
  const metaPct = card.meta != null && card.universe > 0
    ? Math.round((card.meta / card.universe) * 1000) / 10
    : null;
  const [minimumDraft, setMinimumDraft] = useState(card.meta == null ? "" : String(card.meta));
  const [pctDraft, setPctDraft] = useState(metaPct == null ? "" : String(metaPct));
  const nextMinimum = Math.max(0, Math.round(Number(minimumDraft) || 0));
  const nextPct = pctDraft.trim() ? Math.max(0, Math.min(100, Number(pctDraft) || 0)) : null;
  const canSaveGoal = Boolean(onSaveGoal && card.actor.trim());

  useEffect(() => {
    setMinimumDraft(card.meta == null ? "" : String(card.meta));
    setPctDraft(metaPct == null ? "" : String(metaPct));
  }, [card.id, card.meta, metaPct]);

  const updateMinimumDraft = (value: string) => {
    setMinimumDraft(value);
    if (card.universe > 0) {
      const minimum = Math.max(0, Math.round(Number(value) || 0));
      const percent = Math.round((minimum / card.universe) * 1000) / 10;
      setPctDraft(String(Math.max(0, Math.min(100, percent))));
    }
  };

  const updatePctDraft = (value: string) => {
    setPctDraft(value);
    if (card.universe > 0) {
      const percent = Math.max(0, Math.min(100, Number(value) || 0));
      setMinimumDraft(String(Math.round((card.universe * percent) / 100)));
    }
  };

  const saveGoal = () => {
    if (!onSaveGoal) return;
    void onSaveGoal(card.actor, nextMinimum, nextPct);
  };
  const renderMechanism = (item: AcreditacionActorMechanism) => {
    const Icon = mechanismIcon(item.modality);
    return (
      <div key={item.id} className={`mon-acr-model-source-item is-${mechanismKind(item)}`}>
        <Icon size={13} />
        <span>{item.label}</span>
        <em>{item.role === "Universo" ? "Base trabajada" : item.role === "Barrido" ? "Barrido telefónico" : item.provider === "SurveyMonkey" ? "Encuesta" : "Respuesta"}</em>
      </div>
    );
  };

  return (
    <article className={`mon-acr-model-actor is-${statusTone}`}>
      <header className="mon-acr-model-actor-head">
        <div>
          <span>Actor</span>
          <strong>{card.actor}</strong>
        </div>
        <em>{card.meta == null ? "Meta pendiente" : "Meta confirmada"}</em>
      </header>
      <div className="mon-acr-model-actor-metrics">
        <AcreditacionActorFlowNode label="Universo" value={fmt(card.universe)} tone="base" />
        <AcreditacionActorFlowNode label="Meta actor" value={card.meta == null ? "S/M" : fmt(card.meta)} tone={card.meta == null ? "warning" : "target"} />
        <AcreditacionActorFlowNode label="Efectivas" value={fmt(card.effective)} tone="ready" />
      </div>
      <div className="mon-acr-model-minimum-editor" aria-label={`Meta de ${card.actor}`}>
        <label>
          <span>Mínimo N</span>
          <input
            type="number"
            min={0}
            value={minimumDraft}
            onChange={(event) => updateMinimumDraft(event.currentTarget.value)}
            disabled={saving || !canSaveGoal}
          />
        </label>
        <label>
          <span>% universo</span>
          <input
            type="number"
            min={0}
            max={100}
            value={pctDraft}
            onChange={(event) => updatePctDraft(event.currentTarget.value)}
            disabled={saving || !canSaveGoal || card.universe <= 0}
          />
        </label>
        <button type="button" className="is-adjust" onClick={saveGoal} disabled={saving || !canSaveGoal}>
          {saving ? "Guardando" : "Ajustar"}
        </button>
      </div>
      <div className="mon-acr-model-channel-strip">
        {channels.length ? channels.map((channel) => <span key={channel}>{channel}</span>) : <span>Sin canal</span>}
      </div>
      <div className="mon-acr-model-source-list">
        {baseMechanisms.length ? (
          <section className="mon-acr-model-source-group mon-acr-model-source-group--base">
            <header>
              <span>Base y barrido</span>
              <em>{baseMechanisms.length}</em>
            </header>
            {baseMechanisms.map(renderMechanism)}
          </section>
        ) : null}
        {responseMechanisms.length ? (
          <section className="mon-acr-model-source-group mon-acr-model-source-group--responses">
            <header>
              <span>Fuentes de respuesta</span>
              <em>{responseMechanisms.length}</em>
            </header>
            {responseMechanisms.map(renderMechanism)}
          </section>
        ) : null}
      </div>
    </article>
  );
}

type PlatformRejectionRuleDraft = {
  id: string;
  question: string;
  answers: string;
};

type PlatformRejectionQuestionOption = {
  value: string;
  label: string;
  choices: string[];
  support: number;
};

type PhoneEffectiveFilterConfig = {
  enabled: boolean;
  variable: string;
  values: string[];
  label: string;
  value_label: string;
  source_kind: string;
};

type PhoneEffectiveFilterQuestionOption = {
  value: string;
  label: string;
  choices: string[];
  support: number;
  type: string;
};

function newPlatformRejectionDraft(): PlatformRejectionRuleDraft {
  return { id: `rechazo-plataforma-${Date.now()}-${Math.random().toString(36).slice(2)}`, question: "", answers: "No" };
}

function normalizePhoneEffectiveFilter(value: unknown): PhoneEffectiveFilterConfig {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawValues = raw.values ?? raw.options ?? raw.value;
  const values = (Array.isArray(rawValues) ? rawValues : [rawValues])
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
  return {
    enabled: Boolean(raw.enabled ?? raw.activo ?? (String(raw.variable ?? raw.field ?? "").trim() && values.length)),
    variable: String(raw.variable ?? raw.field ?? raw.question ?? raw.pregunta ?? "").trim(),
    values,
    label: String(raw.label ?? raw.etiqueta ?? "").trim(),
    value_label: String(raw.value_label ?? raw.etiqueta_valor ?? "").trim(),
    source_kind: String(raw.source_kind ?? raw.provider ?? "kobo").trim(),
  };
}

function phoneEffectiveFilterLabel(option: PhoneEffectiveFilterQuestionOption) {
  return option.label && option.label !== option.value ? `${option.label} (${option.value})` : option.value;
}

function preferredPhoneEffectiveValue(choices: string[]) {
  return choices.find((choice) => ["yes", "si", "sí", "1", "true"].includes(normalizeSourceMatch(choice)))
    ?? choices.find((choice) => normalizeSourceMatch(choice).includes("consent"))
    ?? choices[0]
    ?? "";
}

function phoneEffectiveFilterQuestionScore(option: PhoneEffectiveFilterQuestionOption) {
  const haystack = normalizeSourceMatch(`${option.value} ${option.label} ${option.type}`);
  if (haystack.includes("consent")) return 0;
  if (haystack.includes("elegib") || haystack.includes("apto")) return 1;
  if (haystack.includes("filtro") || haystack.includes("screen")) return 2;
  if (haystack.includes("select_one")) return 5;
  return 10;
}

function phoneEffectiveFilterQuestionOptions(
  variables: MonitoreoVariable[],
  sourceMetadata: MonitoreoState["source_metadata"] | null | undefined,
  platformSources: MonitoreoSource[],
) {
  const platformSourceIds = new Set(platformSources.map((source) => source.id).filter(Boolean));
  const options = new Map<string, PhoneEffectiveFilterQuestionOption>();
  const addOption = (input: {
    value: string;
    label?: string;
    choices?: unknown[];
    support?: number;
    type?: string;
  }) => {
    const value = String(input.value ?? "").trim();
    if (!value) return;
    const key = normalizeSourceMatch(value);
    if (!key || value.startsWith(".") || key.startsWith(".") || key.includes("snapshot") || key.includes("prosecnur")) return;
    if (value.startsWith("_") || key.includes("attachment") || key.includes("version") || key.includes("uuid") || key.includes("submission") || key.includes("integration")) return;
    const choices = uniqueDisplayValues(unknownArray<unknown>(input.choices)).slice(0, 40);
    if (!choices.length) return;
    const existing = options.get(key);
    const nextChoices = uniqueDisplayValues([...(existing?.choices ?? []), ...choices]);
    options.set(key, {
      value: existing?.value ?? value,
      label: String(input.label ?? existing?.label ?? value).trim() || value,
      choices: nextChoices,
      support: Math.max(existing?.support ?? 0, Number(input.support) || nextChoices.length),
      type: String(input.type ?? existing?.type ?? "").trim(),
    });
  };

  variables.forEach((variable) => {
    addOption({
      value: variable.name,
      label: variable.label || variable.name,
      choices: variable.values ?? [],
      support: variable.n_unique,
      type: variable.tipo,
    });
  });

  Object.entries(sourceMetadata?.variables_by_source ?? {}).forEach(([sourceId, stats]) => {
    if (platformSourceIds.size && !platformSourceIds.has(sourceId)) return;
    unknownArray<Record<string, unknown>>(stats).forEach((stat) => {
      addOption({
        value: String(stat.name ?? "").trim(),
        label: String(stat.label ?? stat.name ?? "").trim(),
        choices: unknownArray<unknown>(stat.examples),
        support: Number(stat.non_empty ?? stat.total ?? 0),
        type: String(stat.kind ?? ""),
      });
    });
  });

  return Array.from(options.values())
    .sort((a, b) => phoneEffectiveFilterQuestionScore(a) - phoneEffectiveFilterQuestionScore(b) || a.value.localeCompare(b.value, "es"))
    .slice(0, 160);
}

function phoneEffectiveFilterAnswerOptions(
  options: PhoneEffectiveFilterQuestionOption[],
  variable: string,
  currentValue: string,
) {
  const key = normalizeSourceMatch(variable);
  const option = options.find((item) => normalizeSourceMatch(item.value) === key);
  const choices = option?.choices ?? [];
  if (currentValue && !choices.some((choice) => normalizeSourceMatch(choice) === normalizeSourceMatch(currentValue))) {
    return [currentValue, ...choices];
  }
  return choices;
}

function platformRejectionDrafts(rules: Array<Record<string, unknown>>): PlatformRejectionRuleDraft[] {
  const drafts = rules
    .map((rule, index) => {
      const question = unknownArray<unknown>(rule.question_patterns).map((item) => String(item ?? "").trim()).filter(Boolean).join(", ");
      const answers = unknownArray<unknown>(rule.rejection_answers).map((item) => String(item ?? "").trim()).filter(Boolean).join(", ");
      return { id: `rechazo-plataforma-${index}`, question, answers: answers || "No" };
    })
    .filter((draft) => draft.question.trim() || draft.answers.trim());
  return drafts.length ? drafts : [newPlatformRejectionDraft()];
}

function humanizeQuestionSlug(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([a-záéíóúñ])/g, (letter) => letter.toLocaleUpperCase("es"));
}

function platformQuestionLabel(variable: MonitoreoVariable) {
  const name = variable.name;
  const directLabel = String(variable.label ?? "").trim();
  if (directLabel && directLabel !== name) return directLabel;
  const [code, rawLabel] = name.split("__", 2);
  return rawLabel ? humanizeQuestionSlug(rawLabel) : code;
}

function compactSelectLabel(value: string, maxLength = 68) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function platformQuestionOptions(variables: MonitoreoVariable[]): PlatformRejectionQuestionOption[] {
  return variables
    .map((variable) => {
      const choices = unknownArray<string>(variable.values)
        .map((item) => String(item ?? "").trim())
        .filter(Boolean);
      return {
        value: variable.name,
        label: platformQuestionLabel(variable),
        choices,
        support: Math.max(0, (variable.n_unique ?? 0) - (variable.n_missing ? 0 : 0)),
      };
    })
    .filter((option) => {
      const key = normalizeSourceMatch(option.value);
      return /^q\d{4}$/i.test(option.value)
        && option.choices.length >= 2
        && option.choices.length <= 10
        && !key.includes("otro especifique");
    })
    .sort((a, b) => {
      const aIsFilter = normalizeSourceMatch(a.value) === "q0001" ? -1 : 0;
      const bIsFilter = normalizeSourceMatch(b.value) === "q0001" ? -1 : 0;
      return aIsFilter - bIsFilter || a.value.localeCompare(b.value, "es");
    });
}

function withCurrentQuestionOption(options: PlatformRejectionQuestionOption[], value: string) {
  const clean = value.trim();
  if (!clean || options.some((option) => option.value === clean)) return options;
  return [{ value: clean, label: clean, choices: [], support: 0 }, ...options];
}

function platformAnswerOptions(options: PlatformRejectionQuestionOption[], draft: PlatformRejectionRuleDraft) {
  const selected = options.find((option) => option.value === draft.question);
  const choices = selected?.choices ?? [];
  const current = draft.answers.trim();
  return current && !choices.includes(current) ? [current, ...choices] : choices;
}

function splitListInput(value: string) {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function AcreditacionPlatformRejectionEditor({
  state,
  variables,
  onStateChange,
}: {
  state?: MonitoreoState | null;
  variables: MonitoreoVariable[];
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const rules = unknownArray<Record<string, unknown>>(state?.config?.monitoreo_profile?.rejection_rules);
  const rulesKey = JSON.stringify(rules);
  const [drafts, setDrafts] = useState<PlatformRejectionRuleDraft[]>(() => platformRejectionDrafts(rules));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);
  const questionOptions = platformQuestionOptions(variables);
  const configured = drafts.filter((draft) => draft.question.trim() && draft.answers.trim()).length;

  useEffect(() => {
    setDrafts(platformRejectionDrafts(rules));
  }, [rulesKey]);

  const updateDraft = (id: string, patch: Partial<PlatformRejectionRuleDraft>) => {
    setDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, ...patch } : draft));
  };

  const addDraft = () => {
    setDrafts((current) => [...current, newPlatformRejectionDraft()]);
  };

  const removeDraft = (id: string) => {
    setDrafts((current) => {
      const next = current.filter((draft) => draft.id !== id);
      return next.length ? next : [newPlatformRejectionDraft()];
    });
  };

  const saveRules = async () => {
    if (!state?.config) return;
    setSaving(true);
    setStatus({ tone: "info", message: "Guardando regla de rechazo..." });
    const rejection_rules = drafts
      .map((draft) => ({
        enabled: true,
        actor: "",
        question_patterns: splitListInput(draft.question),
        rejection_answers: splitListInput(draft.answers),
      }))
      .filter((rule) => rule.question_patterns.length && rule.rejection_answers.length);
    try {
      const result = await apiMonitoreoConfig({
        ...state.config,
        monitoreo_profile: {
          ...state.config.monitoreo_profile,
          rejection_rules,
        },
      });
      onStateChange?.(result.state);
      setStatus({ tone: "success", message: "Reglas de rechazo actualizadas." });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`mon-platform-rejection-rule${configured ? " is-configured" : " is-empty"}`} aria-label="Definición de rechazo de plataforma">
      <header>
        <div>
          <span>Rechazo de plataforma</span>
          <strong>{configured ? `${configured} regla${configured === 1 ? "" : "s"} activa${configured === 1 ? "" : "s"}` : "Sin regla definida"}</strong>
          <p>Define qué pregunta filtro y qué respuesta marcan rechazo dentro de las respuestas de plataforma.</p>
        </div>
        <button type="button" onClick={() => void saveRules()} disabled={saving || !state?.config}>
          {saving ? <Loader2 size={13} className="pulso-spin" /> : <Save size={13} />}
          Guardar regla
        </button>
      </header>
      <div className="mon-platform-rule-list">
        {drafts.map((draft, index) => {
          const answerOptions = platformAnswerOptions(questionOptions, draft);
          return (
          <article key={draft.id} className="mon-platform-rule-row">
            <div className="mon-platform-rule-index" aria-label={`Condición ${index + 1}`}>
              <span>Condición {String(index + 1).padStart(2, "0")}</span>
            </div>
            <label>
              <span>Pregunta de selección única</span>
              <select
                value={draft.question}
                onChange={(event) => {
                  const question = event.target.value;
                  const option = questionOptions.find((item) => item.value === question);
                  updateDraft(draft.id, {
                    question,
                    answers: option?.choices.includes(draft.answers) ? draft.answers : option?.choices[0] ?? draft.answers,
                  });
                }}
                disabled={saving}
              >
                <option value="">Seleccionar pregunta</option>
                {withCurrentQuestionOption(questionOptions, draft.question).map((option) => (
                  <option key={option.value} value={option.value} title={option.label}>
                    {compactSelectLabel(option.label)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Respuesta que rechaza</span>
              <select
                value={draft.answers}
                onChange={(event) => updateDraft(draft.id, { answers: event.target.value })}
                disabled={saving}
              >
                {answerOptions.length ? answerOptions.map((answer) => (
                  <option key={answer} value={answer}>{answer}</option>
                )) : <option value={draft.answers}>{draft.answers || "No"}</option>}
              </select>
            </label>
            <button type="button" aria-label="Quitar condición" onClick={() => removeDraft(draft.id)} disabled={saving}>
              <XCircle size={13} />
            </button>
          </article>
          );
        })}
      </div>
      <footer>
        <span>{fmt(variables.length)} variables inspeccionadas</span>
        <span>{fmt(configured)} reglas configuradas</span>
        <button type="button" onClick={addDraft} disabled={saving}>
          <Plus size={13} />
          Agregar condición
        </button>
      </footer>
      {status ? <span className={`mon-acr-model-action-status is-${status.tone}`}>{status.message}</span> : null}
    </section>
  );
}

function AcreditacionCanonicalModelWorkbench({
  reports,
  state,
  activeTab = "estructura",
  onStateChange,
}: {
  reports?: MonitoreoAcreditacionReports | null;
  state?: MonitoreoState | null;
  activeTab?: AcreditacionModelTab;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const client = reports?.client_report;
  const actorRows = useMemo(() => (
    client?.actors?.length ? client.actors : rowsFromSheets(reports?.sheets ?? [], ["actor", "avance", "brecha"])
  ), [client?.actors, reports?.sheets]);
  const sourceRows = useMemo(() => (
    client?.sources?.length ? client.sources : rowsFromSheets(reports?.sheets ?? [], ["fuente", "source", "canal"])
  ), [client?.sources, reports?.sheets]);
  const sheetActorDailyRows = useMemo(
    () => reports ? rowsForSheetBlock(reports, "cliente_avance_actor", ["avance_actor_dia"]) : [],
    [reports],
  );
  const dailyRows = client?.daily_actor?.length
    ? client.daily_actor
    : sheetActorDailyRows.length
      ? sheetActorDailyRows
      : client?.daily_general ?? [];
  const allowedActors = useMemo(
    () => new Set(actorRows.map((row, index) => normalizeSourceMatch(rowText(row, ["Actor", "Unidad", "Corte", "Carrera"], `Actor ${index + 1}`)))),
    [actorRows],
  );
  const actorDailySeries = useMemo(
    () => reports ? buildAcreditacionAdvanceDailySeries(reports, "avance_general_dia", "Unidad", allowedActors) : [],
    [allowedActors, reports],
  );
  const cards = useMemo(() => actorCardsForDashboard({
    actorRows,
    sourceRows: sourceRows as Array<Record<string, unknown>>,
    dailyRows,
    actorDailySeries,
    goals: state?.config?.goals ?? [],
    sources: state?.sources ?? [],
    progressRows: state?.dashboard?.progress ?? [],
  }), [actorDailySeries, actorRows, dailyRows, sourceRows, state?.config?.goals, state?.dashboard?.progress, state?.sources]);
  const totals = advanceTotals(cards);
  const goalSummary = actorGoalSummary(cards);
  const activeSources = (state?.sources ?? []).filter((source) => source.enabled);
  const sourceSummary = buildAcreditacionActiveSourcesSummary(state?.sources ?? [], state?.config?.operational_model.link_collectors ?? []);
  const telephoneChannels = buildAcreditacionTelephoneChannels(state?.sources ?? [], state?.config?.operational_model.link_collectors ?? []);
  const activeSheetBases = activeSources.filter((source) => source.kind === "google_sheets" && source.role === "universo").length;
  const surveyCount = activeSources.filter(isPlatformResponseSource).length;
  const sweepCount = acreditacionSweepSources(activeSources).length;
  const mechanismTotal = surveyCount + sweepCount || cards.reduce((sum, card) => sum + card.mechanisms.filter((item) => item.role !== "Universo").length, 0);
  const metaTotal = cards.reduce((sum, card) => sum + (card.meta ?? 0), 0);
  const goalActorKey = preferredGoalVariable((state?.variables ?? []).map((variable) => variable.name)) || "dim_actor";
  const [goalSavingActor, setGoalSavingActor] = useState("");
  const [goalStatus, setGoalStatus] = useState<AcreditacionActionStatus>(null);
  const [quotaStatus, setQuotaStatus] = useState<AcreditacionActionStatus>(null);
  const scheduleDraft = acreditacionScheduleDraftFromPhases(state?.config?.strategy_phases ?? []);
  const scheduleWindow = calendarWeekRangeLabel(scheduleDraft.startWeek, scheduleDraft.startWeek + scheduleDraft.durationWeeks - 1);
  const reportWeekdayLabel = calendarReportWeekdayLabel(scheduleDraft.reportWeekday);
  const phoneQuotaReportRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"]) : [];
  const isPhoneModel = isTelefonicoMonitoreoState(state);
  const phoneQuotaVariable = isPhoneModel && state?.config
    ? preferredPhoneQuotaVariable(state.variables ?? [], state.config.control_vars ?? [], phoneQuotaReportRows, state.config.goals ?? [])
    : "";
  const phoneQuotaEditorRows = isPhoneModel && state?.config
    ? buildAcreditacionPhoneQuotaEditorRows({
      variable: phoneQuotaVariable,
      variables: state.variables ?? [],
      goals: state.config.goals ?? [],
      quotaRows: phoneQuotaReportRows,
    })
    : [];
  const phoneQuotaBaseTotal = phoneQuotaEditorRows.reduce((sum, row) => sum + row.universe, 0);
  const phoneQuotaEffectiveTotal = phoneQuotaEditorRows.reduce((sum, row) => sum + row.effective, 0);
  const phoneQuotaMetaTotal = phoneQuotaVariable && state?.config ? phoneQuotaGoalTotal(state.config.goals ?? [], phoneQuotaVariable) : 0;
  const modelActionLabels = isPhoneModel
    ? [
      phoneQuotaVariable ? `Variable ${phoneQuotaVariableLabel(phoneQuotaVariable)}` : "Sin variable rectora",
      phoneQuotaMetaTotal ? `${fmt(phoneQuotaMetaTotal)} objetivo` : "Sin objetivo",
      `${fmt(phoneQuotaEffectiveTotal)} efectivas Kobo`,
      `${fmt(phoneQuotaEditorRows.length)} categorías`,
    ]
    : [
      `${fmt(cards.length)} actores`,
      goalSummary.missingMeta ? `${fmt(goalSummary.missingMeta)} sin meta` : "Metas listas",
      scheduleWindow,
      reportWeekdayLabel,
    ];
  const activeVisibleTab: AcreditacionModelVisibleTab = activeTab === "estrategias" || activeTab === "resumen" ? activeTab : "estructura";
  const modelCopy = activeVisibleTab === "estrategias"
    ? {
      eyebrow: "Cronograma operativo",
      title: "Campo y reportes",
      hint: "Configura semanas de campo, fechas opcionales y día de entrega del reporte de avance.",
    }
    : activeVisibleTab === "resumen"
      ? {
        eyebrow: "Resumen metodológico",
        title: "Lectura de Fuentes",
        hint: "Revisa el estado de encuestas, bases y barrido sin editar canales ni fuentes desde Modelo.",
      }
      : isPhoneModel
        ? {
          eyebrow: "Modelo telefónico",
          title: "Cuotas por variable",
          hint: "Define la variable rectora, sus categorías y metas; el avance de cumplimiento se revisa en Avance.",
        }
      : {
        eyebrow: "Modelo operativo",
        title: "Metas por actor",
        hint: "Define la meta de cada actor. Fuentes conserva canales, barrido, enlaces y filtro de efectiva.",
      };

  const saveActorGoal = useCallback(async (actor: string, meta: number, metaPct: number | null) => {
    if (!state?.config) return;
    setGoalSavingActor(actor);
    setGoalStatus({ tone: "info", message: `Guardando meta de ${actor}...` });
    try {
      const result = await apiMonitoreoConfig({
        ...state.config,
        goals: upsertAcreditacionActorGoal({
          goals: state.config.goals ?? [],
          actor,
          meta,
          metaPct,
          goalKey: goalActorKey,
        }),
      });
      onStateChange?.(result.state);
      setGoalStatus({ tone: "success", message: `Meta de ${actor} actualizada.` });
    } catch (error) {
      setGoalStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setGoalSavingActor("");
    }
  }, [goalActorKey, onStateChange, state?.config]);
  const savePhoneQuotaPatch = useCallback((patch: Partial<MonitoreoConfig>) => {
    if (!state?.config) return;
    const nextConfig = { ...state.config, ...patch };
    setQuotaStatus({ tone: "info", message: "Guardando cuotas telefónicas..." });
    void apiMonitoreoConfig(nextConfig)
      .then((result) => {
        onStateChange?.(result.state);
        setQuotaStatus({ tone: "success", message: "Cuotas telefónicas actualizadas." });
      })
      .catch((error) => {
        setQuotaStatus({ tone: "error", message: (error as Error).message });
      });
  }, [onStateChange, state?.config]);

  if (!reports) {
    return <EmptyPanel title="Modelo pendiente" detail="Todavía no hay reporte local preparado para reconstruir metas, mecanismos y barrido." />;
  }

  return (
    <div className="mon-stage mon-stage--model mon-stage--acr-model">
      <section
        className="pulso-panel mon-fill-panel mon-acr-model-panel"
        style={{ minHeight: 0, overflowY: "auto", scrollbarGutter: "stable" } as CSSProperties}
        aria-label="Modelo operativo canónico de acreditación"
      >
        <header className="pulso-panel-header">
          <div className="pulso-panel-heading">
            <span className="pulso-panel-eyebrow">{modelCopy.eyebrow}</span>
            <h2 className="pulso-panel-title"><span className="mon-title-icon"><Target size={16} /> {modelCopy.title}</span></h2>
            <p className="pulso-panel-hint">{modelCopy.hint}</p>
          </div>
          <div className="mon-acr-model-actions">
            {modelActionLabels.map((label) => <span key={label}>{label}</span>)}
          </div>
        </header>
        {goalStatus ? <span className={`mon-acr-model-action-status is-${goalStatus.tone}`}>{goalStatus.message}</span> : null}
        <div className="mon-acr-model-map" aria-label="Mapa operativo de acreditación">
          {isPhoneModel ? (
            <>
              <AcreditacionActorDashboardTile label="Variable rectora" value={phoneQuotaVariable ? phoneQuotaVariableLabel(phoneQuotaVariable) : "Pendiente"} hint={`${fmt(phoneQuotaEditorRows.length)} categorías`} tone={phoneQuotaVariable ? "ready" : "warning"} />
              <AcreditacionActorDashboardTile label="Base telefónica" value={fmt(phoneQuotaBaseTotal || totals.universe)} hint="casos con CodPulso" tone={phoneQuotaBaseTotal || totals.universe ? "ready" : "warning"} />
              <AcreditacionActorDashboardTile label="Objetivo Kobo" value={phoneQuotaMetaTotal ? fmt(phoneQuotaMetaTotal) : "S/M"} hint="efectivas filtradas" tone={phoneQuotaMetaTotal ? "target" : "warning"} />
              <AcreditacionActorDashboardTile label="Categorías" value={fmt(phoneQuotaEditorRows.length)} hint={phoneQuotaVariable ? `metas por ${phoneQuotaVariableLabel(phoneQuotaVariable).toLowerCase()}` : "define variable"} tone={phoneQuotaEditorRows.length ? "ready" : "warning"} />
            </>
          ) : (
            <>
              <AcreditacionActorDashboardTile label="Actores" value={fmt(cards.length)} hint="modelo base" tone="base" />
              <AcreditacionActorDashboardTile label="Universo" value={fmt(totals.universe)} hint="desde Sheets" tone="ready" />
              <AcreditacionActorDashboardTile label="Meta actor" value={metaTotal ? fmt(metaTotal) : "S/M"} hint={goalSummary.missingMeta ? `${fmt(goalSummary.missingMeta)} pendientes` : "configuradas"} tone={goalSummary.missingMeta ? "warning" : "target"} />
              <AcreditacionActorDashboardTile label="Campo" value={scheduleWindow} hint={reportWeekdayLabel === "Sin reporte" ? "reporte pendiente" : `reporte ${reportWeekdayLabel.toLowerCase()}`} tone={scheduleDraft.reportWeekday ? "ready" : "warning"} />
            </>
          )}
        </div>
        {activeVisibleTab === "estructura" && isPhoneModel && state?.config ? (
          <>
            <AcreditacionPhoneQuotaEditor
              draft={state.config}
              variables={state.variables ?? []}
              platformSources={(state.sources ?? []).filter(isKoboResponseSource)}
              quotaRows={phoneQuotaReportRows}
              onPatchConfig={savePhoneQuotaPatch}
            />
            {quotaStatus ? <span className={`mon-acr-model-action-status is-${quotaStatus.tone}`}>{quotaStatus.message}</span> : null}
          </>
        ) : null}
        {activeVisibleTab === "estructura" && !isPhoneModel ? (
          <div className="mon-acr-model-actor-grid">
            {cards.length ? cards.map((card) => (
              <AcreditacionModelActorSummaryCard
                key={card.id}
                card={card}
                saving={goalSavingActor === card.actor}
                onSaveGoal={saveActorGoal}
              />
            )) : (
              <EmptyPanel title="Sin actores detectados" detail="Carga la base trabajada para armar el modelo por actor." />
            )}
          </div>
        ) : null}
        {activeVisibleTab === "estrategias" ? (
          <AcreditacionFieldSchedulePanel config={state?.config ?? null} onStateChange={onStateChange} />
        ) : null}
        {activeVisibleTab === "resumen" ? (
          <section className="mon-contract-block mon-contract-block--wide" aria-label="Resumen de Fuentes para Modelo">
            <div className="mon-contract-block-head">
              <span>Resumen de Fuentes</span>
              <span className="mon-contract-counter">Solo lectura</span>
            </div>
            <div className="mon-acr-active-kpis">
              <StatTile label="Encuestas activas" value={fmt(sourceSummary.activeSurveys)} tone={sourceSummary.activeSurveys ? "good" : "warn"} />
              <StatTile label="Bases Sheets" value={fmt(activeSheetBases)} tone={activeSheetBases ? "good" : "warn"} />
              <StatTile label="Barrido" value={fmt(sweepCount)} tone={sweepCount ? "good" : "neutral"} />
              <StatTile label="Canales tel." value={fmt(telephoneChannels.length)} tone={telephoneChannels.length ? "good" : "neutral"} />
            </div>
            <p className="mon-profile-muted">
              Canales, recopiladores, barrido, enlaces y filtro de efectiva se editan en Fuentes. Modelo solo los resume para contextualizar las metas y el cronograma.
            </p>
          </section>
        ) : null}
      </section>
    </div>
  );
}

function AcreditacionFieldSchedulePanel({
  config,
  onStateChange,
}: {
  config: MonitoreoConfig | null;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const [draft, setDraft] = useState<AcreditacionFieldScheduleDraft>(() => (
    acreditacionScheduleDraftFromPhases(config?.strategy_phases ?? [])
  ));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);

  useEffect(() => {
    setDraft(acreditacionScheduleDraftFromPhases(config?.strategy_phases ?? []));
  }, [config?.strategy_phases]);

  if (!config) {
    return <EmptyPanel title="Cronograma pendiente" detail="La configuración local todavía no está disponible para editar semanas y reportes." />;
  }

  const previewPhase = acreditacionScheduleDraftFromPhases(upsertAcreditacionFieldSchedulePhase(config.strategy_phases ?? [], draft));
  const previewWindow = calendarWeekRangeLabel(previewPhase.startWeek, previewPhase.startWeek + previewPhase.durationWeeks - 1);
  const dateWindow = draft.startDate || draft.endDate
    ? [draft.startDate || "inicio pendiente", draft.endDate || "fin pendiente"].join(" a ")
    : "Fechas opcionales";

  const patchDraft = (patch: Partial<AcreditacionFieldScheduleDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const saveSchedule = async () => {
    setSaving(true);
    setStatus({ tone: "info", message: "Guardando cronograma de campo..." });
    try {
      const result = await apiMonitoreoConfig({
        ...config,
        strategy_phases: upsertAcreditacionFieldSchedulePhase(config.strategy_phases ?? [], draft),
      });
      onStateChange?.(result.state);
      setDraft(acreditacionScheduleDraftFromPhases(result.config.strategy_phases ?? []));
      setStatus({ tone: "success", message: "Cronograma de campo actualizado." });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mon-contract-block mon-contract-block--wide mon-field-schedule-panel" aria-label="Cronograma operativo">
      <div className="mon-contract-block-head">
        <span>Cronograma de campo</span>
        <button type="button" onClick={() => { void saveSchedule(); }} disabled={saving}>
          {saving ? <Loader2 size={13} className="pulso-spin" /> : <Save size={13} />}
          Guardar cronograma
        </button>
      </div>
      <div className="mon-acr-active-kpis">
        <StatTile label="Ventana" value={previewWindow} tone="good" />
        <StatTile label="Semanas" value={fmt(draft.durationWeeks)} tone={draft.durationWeeks ? "good" : "warn"} />
        <StatTile label="Fechas" value={dateWindow} tone={draft.startDate && draft.endDate ? "good" : "neutral"} />
        <StatTile label="Reporte" value={calendarReportWeekdayLabel(draft.reportWeekday)} tone={draft.reportWeekday ? "good" : "warn"} />
      </div>
      <div className="mon-form mon-form--two">
        <label>
          <span>Semana inicio</span>
          <input
            type="number"
            min={1}
            value={draft.startWeek}
            disabled={saving}
            onChange={(event) => patchDraft({ startWeek: positiveInteger(event.currentTarget.value, 1) })}
          />
        </label>
        <label>
          <span>Cantidad de semanas</span>
          <input
            type="number"
            min={1}
            value={draft.durationWeeks}
            disabled={saving}
            onChange={(event) => patchDraft({ durationWeeks: positiveInteger(event.currentTarget.value, 1) })}
          />
        </label>
        <label>
          <span>Fecha campo inicio</span>
          <input
            type="date"
            value={draft.startDate}
            disabled={saving}
            onChange={(event) => patchDraft({ startDate: event.currentTarget.value })}
          />
        </label>
        <label>
          <span>Fecha campo fin</span>
          <input
            type="date"
            min={draft.startDate || undefined}
            value={draft.endDate}
            disabled={saving}
            onChange={(event) => patchDraft({ endDate: event.currentTarget.value })}
          />
        </label>
        <label>
          <span>Día de reporte de avance</span>
          <select
            value={draft.reportWeekday}
            disabled={saving}
            onChange={(event) => patchDraft({ reportWeekday: event.currentTarget.value as MonitoreoReportWeekday | "" })}
          >
            <option value="">Sin día definido</option>
            {CALENDAR_REPORT_WEEKDAYS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      {status ? <span className={`mon-acr-model-action-status is-${status.tone}`}>{status.message}</span> : null}
    </section>
  );
}

function AcreditacionModelWorkbench({
  acreditacion,
  reports,
  state,
  activeTab = "estructura",
  saving,
  actionStatus,
  onSaveSeguimiento,
  onCerrar,
  onStateChange,
}: {
  acreditacion: MonitoreoAcreditacion | null | undefined;
  reports?: MonitoreoAcreditacionReports | null;
  state?: MonitoreoState | null;
  activeTab?: AcreditacionModelTab;
  saving: boolean;
  actionStatus: AcreditacionActionStatus;
  onSaveSeguimiento?: (payload: MonitoreoAcreditacionSeguimientoPayload) => Promise<void>;
  onCerrar?: (planRefuerzo: string, aprobarBrechas: boolean) => Promise<void>;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  if (String(activeTab) === "estructura") {
    return <AcreditacionCanonicalModelWorkbench reports={reports} state={state} activeTab={activeTab} onStateChange={onStateChange} />;
  }

  if (!acreditacion?.enabled) {
    return <AcreditacionCanonicalModelWorkbench reports={reports} state={state} activeTab={activeTab} onStateChange={onStateChange} />;
  }
  if (String(activeTab) === "resumen" || String(activeTab) === "estrategias") {
    return <AcreditacionCanonicalModelWorkbench reports={reports} state={state} activeTab={activeTab} onStateChange={onStateChange} />;
  }

  const componentes = acreditacion.componentes ?? [];
  const cards = acreditacion.dashboard.cards ?? [];
  const [activeId, setActiveId] = useState(componentes[0]?.id ?? "");
  const selected = componentes.find((comp) => comp.id === activeId) ?? componentes[0] ?? null;
  const selectedCard = cards.find((card) => card.id === selected?.id) ?? cards[0] ?? null;
  const [draft, setDraft] = useState<SeguimientoDraft>(() => draftFromComponent(selected));
  const [planRefuerzo, setPlanRefuerzo] = useState(acreditacion?.plan_refuerzo ?? "");
  const [aprobarBrechas, setAprobarBrechas] = useState(Boolean(acreditacion?.aprobacion_metodologica));

  useEffect(() => {
    if (componentes.length && !componentes.some((comp) => comp.id === activeId)) {
      setActiveId(componentes[0].id);
    }
  }, [activeId, componentes]);

  useEffect(() => {
    setDraft(draftFromComponent(selected));
  }, [
    selected?.id,
    selected?.seguimiento.n_efectivo,
    selected?.seguimiento.notas_campo,
    selected?.seguimiento.intentos_canal.email,
    selected?.seguimiento.intentos_canal.whatsapp,
    selected?.seguimiento.intentos_canal.sms,
    selected?.seguimiento.intentos_canal.telefono,
    selected?.seguimiento.intentos_canal.presencial,
  ]);

  useEffect(() => {
    setPlanRefuerzo(acreditacion?.plan_refuerzo ?? "");
    setAprobarBrechas(Boolean(acreditacion?.aprobacion_metodologica));
  }, [acreditacion?.plan_refuerzo, acreditacion?.aprobacion_metodologica]);

  if (!acreditacion?.enabled) {
    return (
      <AcreditacionModelConfigWorkbench
        state={state}
        activeTab={activeTab}
        onStateChange={onStateChange}
      />
    );
  }

  const canClose = Boolean(acreditacion.dashboard.cierre_habilitado || planRefuerzo.trim() || aprobarBrechas);
  const cierreDisabled = saving || acreditacion.modo_trabajo === "cierre_campo" || !canClose;
  const strategyRows = (state?.config.strategy_phases ?? []).map((phase) => ({
    ID: phase.id || "sin_id",
    Estrato: phase.stratum || "Todo",
    Modalidad: phase.modality,
    Inicio: phase.start_week,
    Fin: phase.end_week,
    "Fecha inicio": phase.start_date || "S/F",
    "Fecha fin": phase.end_date || "S/F",
    Regla: phase.target_rule || "Sin regla",
    KPI: Array.isArray(phase.kpi_focus) ? phase.kpi_focus.join(", ") : "",
  }));
  const sourceRows = (state?.sources ?? []).map((source) => ({
    Fuente: source.label || source.id,
    Tipo: source.kind,
    Rol: source.role || "respuestas",
    Estado: source.enabled ? "Activa" : "Inactiva",
    ID: source.id,
  }));
  const saveSelected = () => {
    if (!selected || !onSaveSeguimiento) return;
    const intentos_canal = CANALES.reduce<Partial<MonitoreoAcreditacionIntentos>>((acc, canal) => {
      acc[canal] = Math.max(0, Number(draft.intentos[canal]) || 0);
      return acc;
    }, {});
    void onSaveSeguimiento({
      id: selected.id,
      n_efectivo: Math.max(0, Number(draft.n_efectivo) || 0),
      notas_campo: draft.notas_campo,
      intentos_canal,
    });
  };

  if (activeTab === "casos") {
    const bolsaRows = componentes.flatMap((component) => (
      component.seguimiento.bolsa_operativa.map((row) => ({ Actor: component.actor, ...row }))
    )) as unknown as Array<Record<string, unknown>>;
    const seguimientoRows = componentes.map((component) => ({
      Actor: component.actor,
      Tecnica: component.tecnica,
      "n efectivo": component.seguimiento.n_efectivo,
      "Meta": component.meta.n_objetivo ?? "S/M",
      "Email": component.seguimiento.intentos_canal.email,
      "Enlace": component.seguimiento.intentos_canal.whatsapp,
      "SMS": component.seguimiento.intentos_canal.sms,
      "Teléfono": component.seguimiento.intentos_canal.telefono,
      "Presencial": component.seguimiento.intentos_canal.presencial,
      Estado: cumplimientoLabel(component.seguimiento.cumplimiento.estado),
    }));
    return (
      <div className="mon-acr-model">
        <div className="mon-profile-stat-row">
          <StatTile label="Actores" value={fmt(componentes.length)} tone={componentes.length ? "good" : "neutral"} />
          <StatTile label="Bolsa operativa" value={fmt(bolsaRows.length)} tone={bolsaRows.length ? "good" : "neutral"} />
          <StatTile label="Bloqueos" value={fmt(acreditacion.dashboard.bloqueos)} tone={acreditacion.dashboard.bloqueos ? "warn" : "good"} />
          <StatTile label="Modo" value={acreditacion.modo_trabajo === "cierre_campo" ? "Cierre" : "Campo"} />
        </div>
        <div className="mon-profile-grid">
          <section className="mon-profile-panel">
            <div className="mon-profile-panel-head">
              <h3>Base de barrido y seguimiento</h3>
              <span>{fmt(seguimientoRows.length)} actores</span>
            </div>
            <DataTable rows={seguimientoRows} empty="No hay actores para seguimiento." />
          </section>
          <section className="mon-profile-panel">
            <div className="mon-profile-panel-head">
              <h3>Bolsa operativa</h3>
              <span>{fmt(bolsaRows.length)} filas</span>
            </div>
            <DataTable rows={bolsaRows} empty="No hay bolsa operativa normalizada." />
          </section>
        </div>
      </div>
    );
  }

  if (activeTab === "enlaces") {
    return (
      <div className="mon-acr-model">
        <div className="mon-profile-stat-row">
          <StatTile label="Fuentes" value={fmt(sourceRows.length)} tone={sourceRows.length ? "good" : "warn"} />
          <StatTile label="Activas" value={fmt(sourceRows.filter((row) => row.Estado === "Activa").length)} tone="good" />
          <StatTile label="Canales" value={fmt(CANALES.length)} />
          <StatTile label="Componentes" value={fmt(componentes.length)} />
        </div>
        <div className="mon-profile-grid">
          <section className="mon-profile-panel">
            <div className="mon-profile-panel-head">
              <h3>Fuentes, links y recopiladores</h3>
              <span>{fmt(sourceRows.length)} fuentes</span>
            </div>
            <DataTable rows={sourceRows} empty="No hay fuentes conectadas para enlaces/envíos." />
          </section>
          <section className="mon-profile-panel">
            <div className="mon-profile-panel-head">
              <h3>Intentos por canal</h3>
              <span>{fmt(componentes.length)} actores</span>
            </div>
            <DataTable
              rows={componentes.map((component) => ({
                Actor: component.actor,
                Email: component.seguimiento.intentos_canal.email,
                Enlace: component.seguimiento.intentos_canal.whatsapp,
                SMS: component.seguimiento.intentos_canal.sms,
                Telefono: component.seguimiento.intentos_canal.telefono,
                Presencial: component.seguimiento.intentos_canal.presencial,
              }))}
              empty="No hay intentos por canal."
            />
          </section>
        </div>
      </div>
    );
  }

  if (activeTab === "reglas") {
    const ruleRows = cards.map((card) => ({
      Actor: card.actor,
      Estado: cumplimientoLabel(card.estado),
      "n efectivo": card.n_efectivo,
      Meta: card.n_objetivo ?? "S/M",
      Brecha: card.brecha_absoluta ?? 0,
      "% avance": card.avance_pct == null ? "S/D" : pct(card.avance_pct),
    }));
    return (
      <div className="mon-acr-model">
        {acreditacion.dashboard.alertas.length ? (
          <section className="mon-acr-model-alerts" aria-label="Alertas de reglas de avance">
            {acreditacion.dashboard.alertas.slice(0, 8).map((alerta, index) => (
              <div key={`${alerta.componente_id}-${alerta.tipo}-${index}`} className={`is-${alerta.severidad}`}>
                <AlertCircle size={14} />
                <span><strong>{alerta.actor}</strong>: {alerta.mensaje}</span>
              </div>
            ))}
          </section>
        ) : null}
        <section className="mon-profile-panel">
          <div className="mon-profile-panel-head">
            <h3>Estados válidos, metas y brechas</h3>
            <span>{fmt(ruleRows.length)} reglas</span>
          </div>
          <DataTable rows={ruleRows} empty="No hay reglas de cumplimiento para este modelo." />
        </section>
      </div>
    );
  }

  if (String(activeTab) === "__legacy_estrategias__") {
    return (
      <div className="mon-acr-model">
        <div className="mon-profile-stat-row">
          <StatTile label="Fases" value={fmt(strategyRows.length)} tone={strategyRows.length ? "good" : "warn"} />
          <StatTile label="Plan refuerzo" value={planRefuerzo.trim() ? "Activo" : "Pendiente"} tone={planRefuerzo.trim() ? "good" : "warn"} />
          <StatTile label="Aprobación" value={aprobarBrechas ? "Sí" : "No"} tone={aprobarBrechas ? "good" : "neutral"} />
          <StatTile label="Cierre" value={acreditacion.modo_trabajo === "cierre_campo" ? "Marcado" : "Editable"} />
        </div>
        <section className="mon-profile-panel">
          <div className="mon-profile-panel-head">
            <h3>Calendario y mecanismos por semana</h3>
            <span>{fmt(strategyRows.length)} fases</span>
          </div>
          <DataTable rows={strategyRows} empty="No hay fases estratégicas configuradas." />
        </section>
        <section className="mon-acr-model-close" aria-label="Cierre de acreditación">
          <div>
            <span>Cierre metodológico</span>
            <input
              value={planRefuerzo}
              disabled={saving || acreditacion.modo_trabajo === "cierre_campo"}
              onChange={(event) => setPlanRefuerzo(event.target.value)}
              placeholder="Plan de refuerzo o justificación de cierre"
            />
          </div>
          <label>
            <input
              type="checkbox"
              checked={aprobarBrechas}
              disabled={saving || acreditacion.modo_trabajo === "cierre_campo"}
              onChange={(event) => setAprobarBrechas(event.target.checked)}
            />
            Aprobación metodológica
          </label>
          <button type="button" disabled={cierreDisabled || !onCerrar} onClick={() => void onCerrar?.(planRefuerzo, aprobarBrechas)}>
            <FileCheck2 size={14} />
            {acreditacion.modo_trabajo === "cierre_campo" ? "Cierre marcado" : "Marcar cierre"}
          </button>
        </section>
        {actionStatus ? <span className={`mon-acr-model-action-status is-${actionStatus.tone}`}>{actionStatus.message}</span> : null}
      </div>
    );
  }

  return (
    <div className="mon-acr-model">
      <section className="mon-acr-model-summary" aria-label="Resumen del modelo de acreditación">
        <div>
          <span>{acreditacion.modo_trabajo === "cierre_campo" ? "Cierre de campo" : "Seguimiento de campo"}</span>
          <strong>{acreditacion.estudio.titulo}</strong>
          <p>{acreditacion.estudio.cliente || "Modelo operativo por actores, metas, intentos y brechas de acreditación."}</p>
        </div>
        <div className="mon-acr-model-summary__stats">
          <StatTile label="Actores" value={fmt(componentes.length)} tone={componentes.length ? "good" : "neutral"} />
          <StatTile label="Bloqueos" value={fmt(acreditacion.dashboard.bloqueos)} tone={acreditacion.dashboard.bloqueos ? "warn" : "good"} />
          <StatTile label="Cierre" value={acreditacion.modo_trabajo === "cierre_campo" ? "Marcado" : canClose ? "Disponible" : "Pendiente"} tone={canClose ? "good" : "warn"} />
        </div>
      </section>

      {acreditacion.dashboard.alertas.length ? (
        <section className="mon-acr-model-alerts" aria-label="Alertas de seguimiento">
          {acreditacion.dashboard.alertas.slice(0, 6).map((alerta, index) => (
            <div key={`${alerta.componente_id}-${alerta.tipo}-${index}`} className={`is-${alerta.severidad}`}>
              <AlertCircle size={14} />
              <span><strong>{alerta.actor}</strong>: {alerta.mensaje}</span>
            </div>
          ))}
        </section>
      ) : null}

      <div className="mon-acr-model-grid">
        <aside className="mon-acr-model-list" aria-label="Actores de acreditación">
          <header>
            <span>Actores y meta</span>
            <strong>{fmt(cards.length)} tarjetas</strong>
          </header>
          {cards.map((card) => {
            const active = selected?.id === card.id;
            const width = Math.max(0, Math.min(100, Number(card.avance_pct ?? 0)));
            return (
              <button key={card.id} type="button" className={active ? "is-active" : ""} onClick={() => setActiveId(card.id)}>
                <span>
                  <strong>{card.actor}</strong>
                  <AcreditacionCumplimientoBadge estado={card.estado} />
                </span>
                <em>{fmt(card.n_efectivo)} / {card.n_objetivo == null ? "S/M" : fmt(card.n_objetivo)}</em>
                <i aria-hidden="true"><b style={{ width: `${width}%` }} /></i>
              </button>
            );
          })}
        </aside>

        <section className="mon-acr-model-detail" aria-label="Detalle y edición de seguimiento">
          {selected && selectedCard ? (
            <>
              <header>
                <div>
                  <span>Componente seleccionado</span>
                  <strong>{selected.actor}</strong>
                  <p>{selected.tecnica || "Sin técnica"} · {selected.variable_control || "Sin variable de control"}</p>
                </div>
                <AcreditacionCumplimientoBadge estado={selected.seguimiento.cumplimiento.estado} />
              </header>

              <div className="mon-acr-model-metrics">
                <AcreditacionMetric label="Universo" value={selected.marco.universo_bruto} />
                <AcreditacionMetric label="Marco actualizado" value={selected.marco.marco_actualizado} />
                <AcreditacionMetric label="Contactable" value={selected.marco.marco_contactable} />
                <AcreditacionMetric label="Meta efectiva" value={selected.meta.n_objetivo} hint={selectedCard.avance_pct == null ? "sin avance" : `${pct(selectedCard.avance_pct)} avance`} />
              </div>

              <div className="mon-acr-model-form">
                <label>
                  <span>n efectivo</span>
                  <input
                    type="number"
                    min={0}
                    value={draft.n_efectivo}
                    disabled={saving}
                    onChange={(event) => setDraft((current) => ({ ...current, n_efectivo: event.target.value }))}
                  />
                </label>
                {CANALES.map((canal) => (
                  <label key={canal}>
                    <span>{canal}</span>
                    <input
                      type="number"
                      min={0}
                      value={draft.intentos[canal]}
                      disabled={saving}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        intentos: { ...current.intentos, [canal]: event.target.value },
                      }))}
                    />
                  </label>
                ))}
              </div>

              <label className="mon-acr-model-notes">
                <span>Notas de campo</span>
                <textarea
                  value={draft.notas_campo}
                  disabled={saving}
                  onChange={(event) => setDraft((current) => ({ ...current, notas_campo: event.target.value }))}
                />
              </label>

              <div className="mon-acr-model-actions">
                <button type="button" onClick={saveSelected} disabled={saving || !onSaveSeguimiento}>
                  <Save size={14} />
                  Registrar avance
                </button>
                {actionStatus ? <span className={`is-${actionStatus.tone}`}>{actionStatus.message}</span> : null}
              </div>

              <section className="mon-acr-model-close" aria-label="Cierre de acreditación">
                <div>
                  <span>Cierre metodológico</span>
                  <input
                    value={planRefuerzo}
                    disabled={saving || acreditacion.modo_trabajo === "cierre_campo"}
                    onChange={(event) => setPlanRefuerzo(event.target.value)}
                    placeholder="Plan de refuerzo o justificación de cierre"
                  />
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={aprobarBrechas}
                    disabled={saving || acreditacion.modo_trabajo === "cierre_campo"}
                    onChange={(event) => setAprobarBrechas(event.target.checked)}
                  />
                  Aprobación metodológica
                </label>
                <button type="button" disabled={cierreDisabled || !onCerrar} onClick={() => void onCerrar?.(planRefuerzo, aprobarBrechas)}>
                  <FileCheck2 size={14} />
                  {acreditacion.modo_trabajo === "cierre_campo" ? "Cierre marcado" : "Marcar cierre"}
                </button>
              </section>

              {Object.keys(selected.seguimiento.sub_cuotas_progreso).length ? (
                <section className="mon-profile-panel">
                  <div className="mon-profile-panel-head">
                    <h3>Subcuotas</h3>
                    <span>{fmt(Object.keys(selected.seguimiento.sub_cuotas_progreso).length)} celdas</span>
                  </div>
                  <DataTable
                    rows={Object.entries(selected.seguimiento.sub_cuotas_progreso).map(([celda, row]) => ({ Celda: celda, ...row }))}
                    empty="Sin subcuotas para este componente."
                  />
                </section>
              ) : null}

              {selected.seguimiento.bolsa_operativa.length ? (
                <section className="mon-profile-panel">
                  <div className="mon-profile-panel-head">
                    <h3>Bolsa operativa</h3>
                    <span>{fmt(selected.seguimiento.bolsa_operativa.length)} filas</span>
                  </div>
                  <DataTable rows={selected.seguimiento.bolsa_operativa as unknown as Array<Record<string, unknown>>} empty="Sin bolsa operativa para este componente." />
                </section>
              ) : null}
            </>
          ) : (
            <EmptyPanel title="Sin componente seleccionado" detail="El modelo está activo, pero aún no hay actores normalizados para editar." />
          )}
        </section>
      </div>
    </div>
  );
}

const MODEL_MODALITY_OPTIONS: Array<{ value: MonitoreoStrategyPhase["modality"]; label: string }> = [
  { value: "email", label: "Correo" },
  { value: "whatsapp", label: "Enlace" },
  { value: "sms", label: "SMS" },
  { value: "telefono", label: "Teléfono" },
  { value: "presencial", label: "Presencial / QR" },
  { value: "mixto", label: "Mixto" },
];

type AcreditacionChannelToneKey = "correo" | "telefono" | "presencial" | "enlace" | "kobo" | "desconocido";

const ACREDITACION_CHANNEL_OPTIONS: Array<{
  value: string;
  label: string;
  key: AcreditacionChannelToneKey;
  modality: MonitoreoStrategyPhase["modality"];
  icon: typeof Link2;
}> = [
  { value: "Correo", label: "Correo", key: "correo", modality: "email", icon: Mail },
  { value: "Presencial (Ficha QR)", label: "Ficha QR", key: "presencial", modality: "presencial", icon: QrCode },
  { value: "Enlace personalizado (Whatsapp)", label: "Enlace", key: "enlace", modality: "whatsapp", icon: Link2 },
  { value: "Kobo", label: "Kobo", key: "kobo", modality: "mixto", icon: QrCode },
  { value: "Telefónico", label: "Telefónico", key: "telefono", modality: "telefono", icon: PhoneCall },
];

const MODEL_COLLECTOR_USE_OPTIONS: Array<{
  value: MonitoreoCollectorUse;
  label: string;
  modality: MonitoreoStrategyPhase["modality"];
  channel: string;
  icon: typeof Link2;
}> = [
  { value: "correo_autoaplicado", label: "Correo autoaplicado", modality: "email", channel: "Correo", icon: Mail },
  { value: "telefono_asistido", label: "Teléfono asistido", modality: "telefono", channel: "Telefónico", icon: PhoneCall },
  { value: "presencial_qr", label: "Ficha QR", modality: "presencial", channel: "Presencial (Ficha QR)", icon: QrCode },
  { value: "enlace_abierto", label: "Enlace", modality: "whatsapp", channel: "Enlace personalizado (Whatsapp)", icon: Link2 },
  { value: "sms", label: "SMS", modality: "sms", channel: "Enlace personalizado (Whatsapp)", icon: ContactRound },
  { value: "mixto", label: "Refuerzo operativo", modality: "mixto", channel: "Correo", icon: Route },
  { value: "sin_clasificar", label: "Sin clasificar", modality: "mixto", channel: "Correo", icon: SlidersHorizontal },
];

const MODEL_ROSTER_SOURCE_OPTIONS = [
  { value: "none", label: "Sin barrido" },
  { value: "source", label: "Fuente configurada" },
  { value: "uploaded", label: "Archivo cargado" },
  { value: "external_local", label: "Base local externa" },
] as const;

const MODEL_FINAL_STATE_OPTIONS = [
  { value: "complete", label: "Completa" },
  { value: "partial", label: "Parcial" },
  { value: "refusal", label: "Rechazo" },
  { value: "pending", label: "Pendiente" },
  { value: "invalid", label: "No válida" },
];

type AcreditacionCalendarActorPlan = {
  actor: string;
  channels: string[];
  sourceCount: number;
  meta: number | null;
  modality: MonitoreoStrategyPhase["modality"];
  startWeek: number;
  endWeek: number;
};

function calendarWeekRangeLabel(startWeek: number | null | undefined, endWeek: number | null | undefined) {
  const start = Number(startWeek);
  const end = Number(endWeek ?? startWeek);
  if (!Number.isFinite(start) || start <= 0) return "Sin semana";
  if (!Number.isFinite(end) || end <= 0 || end === start) return `Semana ${fmt(start)}`;
  return `Semanas ${fmt(start)}-${fmt(end)}`;
}

function calendarWeekWindowLabel(phases: MonitoreoStrategyPhase[], fallbackEnd: number | null) {
  const weeks = phases.flatMap((phase) => [
    Number(phase.start_week),
    Number(phase.end_week ?? phase.start_week),
  ]).filter((week) => Number.isFinite(week) && week > 0);
  if (weeks.length) {
    const min = Math.min(...weeks);
    const max = Math.max(...weeks);
    return min === max ? `Semana ${fmt(min)}` : `Semanas ${fmt(min)}-${fmt(max)}`;
  }
  if (fallbackEnd && fallbackEnd > 0) return `Sugerido S1-S${fmt(fallbackEnd)}`;
  return "Pendiente";
}

function calendarDateWindowLabel(phases: MonitoreoStrategyPhase[]) {
  const dates = phases.flatMap((phase) => [
    phase.start_date ?? "",
    phase.end_date ?? phase.start_date ?? "",
  ]).filter(Boolean).sort();
  if (!dates.length) return "Por definir";
  const start = dates[0];
  const end = dates[dates.length - 1];
  return start === end ? start : `${start} a ${end}`;
}

type AcreditacionCalendarPhaseDateState = "ready" | "partial" | "empty" | "invalid";

type AcreditacionCalendarPhaseDateStatus = {
  state: AcreditacionCalendarPhaseDateState;
  label: string;
  detail: string;
  durationLabel: string;
  overlapCount: number;
};

type AcreditacionCalendarTimelineDay = {
  iso: string;
  dayLabel: string;
  weekdayLabel: string;
};

type AcreditacionCalendarTimelineItem = {
  key: string;
  index: number;
  phase: MonitoreoStrategyPhase;
  startIndex: number;
  endIndex: number;
  state: AcreditacionCalendarPhaseDateState;
  rangeLabel: string;
  durationLabel: string;
};

type AcreditacionCalendarReportRow = {
  key: string;
  week: number | null;
  weekday: MonitoreoReportWeekday | "";
  date: string;
  label: string;
  note: string;
  isException: boolean;
};

const CALENDAR_DAY_MS = 24 * 60 * 60 * 1000;
const CALENDAR_DATE_FORMATTER = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short" });
const CALENDAR_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("es-PE", { weekday: "short" });
const CALENDAR_REPORT_WEEKDAYS: Array<{ value: MonitoreoReportWeekday; label: string; index: number }> = [
  { value: "lunes", label: "Lunes", index: 1 },
  { value: "martes", label: "Martes", index: 2 },
  { value: "miercoles", label: "Miércoles", index: 3 },
  { value: "jueves", label: "Jueves", index: 4 },
  { value: "viernes", label: "Viernes", index: 5 },
  { value: "sabado", label: "Sábado", index: 6 },
  { value: "domingo", label: "Domingo", index: 0 },
];
const CALENDAR_REPORT_WEEKDAY_INDEX = new Map(CALENDAR_REPORT_WEEKDAYS.map((item) => [item.value, item.index]));
const CALENDAR_REPORT_WEEKDAY_LABEL = new Map(CALENDAR_REPORT_WEEKDAYS.map((item) => [item.value, item.label]));
const ACREDITACION_FIELD_PHASE_ID = "acreditacion-campo";

export type AcreditacionFieldScheduleDraft = {
  startWeek: number;
  durationWeeks: number;
  startDate: string;
  endDate: string;
  reportWeekday: MonitoreoReportWeekday | "";
};

function positiveInteger(value: unknown, fallback: number) {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function acreditacionPrimarySchedulePhase(phases: MonitoreoStrategyPhase[]) {
  return phases.find((phase) => phase.id === ACREDITACION_FIELD_PHASE_ID) ?? phases[0] ?? null;
}

export function acreditacionScheduleDraftFromPhases(phases: MonitoreoStrategyPhase[]): AcreditacionFieldScheduleDraft {
  const phase = acreditacionPrimarySchedulePhase(phases);
  const startWeek = positiveInteger(phase?.start_week, 1);
  const endWeek = Math.max(startWeek, positiveInteger(phase?.end_week ?? phase?.start_week, startWeek));
  return {
    startWeek,
    durationWeeks: Math.max(1, endWeek - startWeek + 1),
    startDate: phase?.start_date ?? "",
    endDate: phase?.end_date ?? "",
    reportWeekday: normalizeCalendarReportWeekday(phase?.client_report_weekday),
  };
}

export function upsertAcreditacionFieldSchedulePhase(
  phases: MonitoreoStrategyPhase[],
  draft: AcreditacionFieldScheduleDraft,
) {
  const existingIndex = phases.findIndex((phase) => phase.id === ACREDITACION_FIELD_PHASE_ID);
  const targetIndex = existingIndex >= 0 ? existingIndex : phases.length ? 0 : -1;
  const existing = targetIndex >= 0 ? phases[targetIndex] : null;
  const startWeek = positiveInteger(draft.startWeek, 1);
  const durationWeeks = positiveInteger(draft.durationWeeks, 1);
  const nextPhase: MonitoreoStrategyPhase = {
    id: existing?.id || ACREDITACION_FIELD_PHASE_ID,
    stratum: existing?.stratum || "Acreditación",
    modality: existing?.modality || "mixto",
    start_week: startWeek,
    end_week: startWeek + durationWeeks - 1,
    start_date: draft.startDate,
    end_date: draft.endDate,
    client_report_weekday: normalizeCalendarReportWeekday(draft.reportWeekday),
    client_report_exceptions: existing?.client_report_exceptions ?? [],
    target_rule: existing?.target_rule || "Cumplir metas por actor en campo",
    kpi_focus: existing?.kpi_focus?.length ? existing.kpi_focus : ["meta actor", "avance efectivo", "faltantes"],
    kpi_modules: existing?.kpi_modules ?? ["progress"],
    breakdown_vars: existing?.breakdown_vars ?? [],
    attempts_var: existing?.attempts_var ?? "",
    outcome_var: existing?.outcome_var ?? "",
  };
  if (targetIndex < 0) return [nextPhase];
  return phases.map((phase, index) => index === targetIndex ? nextPhase : phase);
}

function parseCalendarIsoDate(value: string | null | undefined) {
  const match = String(value ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function calendarIsoDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function calendarAddDaysIso(value: string, days: number) {
  const date = parseCalendarIsoDate(value);
  if (!date) return "";
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return calendarIsoDate(next);
}

function calendarDateDiffDays(start: string, end: string) {
  const startDate = parseCalendarIsoDate(start);
  const endDate = parseCalendarIsoDate(end);
  if (!startDate || !endDate) return null;
  return Math.round((endDate.getTime() - startDate.getTime()) / CALENDAR_DAY_MS);
}

function formatCalendarDateLabel(value: string | null | undefined) {
  const date = parseCalendarIsoDate(value);
  return date ? CALENDAR_DATE_FORMATTER.format(date).replace(".", "") : "";
}

function formatCalendarWeekdayLabel(value: string | null | undefined) {
  const date = parseCalendarIsoDate(value);
  return date ? CALENDAR_WEEKDAY_FORMATTER.format(date).replace(".", "") : "";
}

function calendarPhaseDurationDays(phase: MonitoreoStrategyPhase) {
  const start = phase.start_date ?? "";
  const end = phase.end_date || start;
  if (!start || !end) return null;
  const diff = calendarDateDiffDays(start, end);
  return diff != null && diff >= 0 ? diff + 1 : null;
}

function calendarPhaseWeekDurationDays(phase: MonitoreoStrategyPhase) {
  const startWeek = Number(phase.start_week);
  const endWeek = Number(phase.end_week ?? phase.start_week);
  if (!Number.isFinite(startWeek) || startWeek <= 0) return 1;
  if (!Number.isFinite(endWeek) || endWeek < startWeek) return 7;
  return Math.max(1, endWeek - startWeek + 1) * 7;
}

function calendarDurationLabel(days: number | null) {
  if (!days || days <= 0) return "Duración pendiente";
  return days === 1 ? "1 día" : `${fmt(days)} días`;
}

function normalizeCalendarReportWeekday(value: unknown): MonitoreoReportWeekday | "" {
  const normalized = normalizeSourceMatch(String(value ?? ""));
  const direct = CALENDAR_REPORT_WEEKDAYS.find((item) => item.value === normalized);
  if (direct) return direct.value;
  if (["miercoles", "miércoles", "wednesday", "wed"].includes(normalized)) return "miercoles";
  if (["sabado", "sábado", "saturday", "sat"].includes(normalized)) return "sabado";
  return "";
}

function calendarReportWeekdayLabel(value: MonitoreoReportWeekday | "" | null | undefined) {
  const normalized = normalizeCalendarReportWeekday(value);
  return normalized ? CALENDAR_REPORT_WEEKDAY_LABEL.get(normalized) ?? normalized : "Sin reporte";
}

function calendarReportWeekdayFromDate(value: string | null | undefined): MonitoreoReportWeekday | "" {
  const parsed = parseAcreditacionDailyDate(value);
  if (!parsed) return "";
  return CALENDAR_REPORT_WEEKDAYS.find((item) => item.index === parsed.getDay())?.value ?? "";
}

function calendarReportExceptions(phase: MonitoreoStrategyPhase): MonitoreoStrategyReportException[] {
  return (phase.client_report_exceptions ?? []).map((item) => ({
    week: Number.isFinite(Number(item.week)) && Number(item.week) > 0 ? Number(item.week) : null,
    weekday: normalizeCalendarReportWeekday(item.weekday),
    date: item.date ?? "",
    note: item.note ?? "",
  })).filter((item) => item.week || item.date || item.weekday || item.note);
}

function calendarWeekRange(phase: MonitoreoStrategyPhase) {
  const start = Number(phase.start_week);
  const end = Number(phase.end_week ?? phase.start_week);
  const startWeek = Number.isFinite(start) && start > 0 ? start : 1;
  const endWeek = Number.isFinite(end) && end >= startWeek ? end : startWeek;
  return { startWeek, endWeek };
}

function calendarReportDateForWeek(phase: MonitoreoStrategyPhase, week: number | null, weekday: MonitoreoReportWeekday | "", overrideDate = "") {
  if (overrideDate) return overrideDate;
  if (!phase.start_date || !week || !weekday) return "";
  const { startWeek } = calendarWeekRange(phase);
  const weekStart = calendarAddDaysIso(phase.start_date, Math.max(0, week - startWeek) * 7);
  const weekStartDate = parseCalendarIsoDate(weekStart);
  const weekdayIndex = CALENDAR_REPORT_WEEKDAY_INDEX.get(weekday);
  if (!weekStartDate || weekdayIndex == null) return "";
  const delta = (weekdayIndex - weekStartDate.getDay() + 7) % 7;
  const date = calendarAddDaysIso(weekStart, delta);
  if (phase.end_date && date > phase.end_date) return "";
  return date;
}

function calendarReportScheduleRows(phase: MonitoreoStrategyPhase): AcreditacionCalendarReportRow[] {
  const defaultWeekday = normalizeCalendarReportWeekday(phase.client_report_weekday);
  const exceptions = calendarReportExceptions(phase);
  const byWeek = new Map(exceptions.filter((item) => item.week).map((item) => [Number(item.week), item]));
  const rows: AcreditacionCalendarReportRow[] = [];
  const { startWeek, endWeek } = calendarWeekRange(phase);
  if (defaultWeekday) {
    for (let week = startWeek; week <= endWeek; week += 1) {
      const exception = byWeek.get(week);
      const weekday = normalizeCalendarReportWeekday(exception?.weekday) || defaultWeekday;
      const date = calendarReportDateForWeek(phase, week, weekday, exception?.date ?? "");
      rows.push({
        key: `week-${week}`,
        week,
        weekday,
        date,
        label: date ? formatCalendarDateLabel(date) : `Semana ${fmt(week)}`,
        note: exception?.note ?? "",
        isException: Boolean(exception),
      });
    }
  }
  exceptions
    .filter((item) => !item.week)
    .forEach((exception, index) => {
      const weekday = normalizeCalendarReportWeekday(exception.weekday);
      const date = exception.date ?? "";
      rows.push({
        key: `exception-${index}-${date || weekday}`,
        week: null,
        weekday,
        date,
        label: date ? formatCalendarDateLabel(date) : "Excepción",
        note: exception.note ?? "",
        isException: true,
      });
    });
  return rows;
}

function acreditacionReportWeekdayFromPhases(phases: MonitoreoStrategyPhase[] = []) {
  const primary = acreditacionPrimarySchedulePhase(phases);
  const primaryWeekday = normalizeCalendarReportWeekday(primary?.client_report_weekday);
  if (primaryWeekday) return primaryWeekday;
  for (const phase of phases) {
    const weekday = normalizeCalendarReportWeekday(phase.client_report_weekday);
    if (weekday) return weekday;
    const exceptionWeekday = calendarReportExceptions(phase).map((item) => normalizeCalendarReportWeekday(item.weekday)).find(Boolean);
    if (exceptionWeekday) return exceptionWeekday;
  }
  return "";
}

function acreditacionReportCutsFromPhases(phases: MonitoreoStrategyPhase[] = []): AcreditacionDailyReportCut[] {
  const rows = phases.flatMap((phase) => calendarReportScheduleRows(phase));
  const byDate = new Map<string, AcreditacionDailyReportCut>();
  rows.forEach((row) => {
    if (!row.date) return;
    const weekday = calendarReportWeekdayLabel(row.weekday);
    const label = row.week ? `S${fmt(row.week)} · ${weekday}` : weekday;
    byDate.set(row.date, { date: row.date, label });
  });
  return Array.from(byDate.values()).sort((a, b) => {
    const aTime = dateOnlyTime(parseAcreditacionDailyDate(a.date)) ?? 0;
    const bTime = dateOnlyTime(parseAcreditacionDailyDate(b.date)) ?? 0;
    return aTime - bTime || a.label.localeCompare(b.label, "es");
  });
}

function calendarPhaseDateRangeLabel(phase: MonitoreoStrategyPhase) {
  const start = phase.start_date ?? "";
  const end = phase.end_date ?? "";
  if (start && end) {
    const diff = calendarDateDiffDays(start, end);
    if (diff != null && diff < 0) return "Rango inválido";
    const startLabel = formatCalendarDateLabel(start);
    const endLabel = formatCalendarDateLabel(end);
    return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
  }
  if (start) return `Desde ${formatCalendarDateLabel(start)}`;
  if (end) return `Hasta ${formatCalendarDateLabel(end)}`;
  return "Sin fecha";
}

function calendarPhaseOverlapCount(phase: MonitoreoStrategyPhase, index: number, phases: MonitoreoStrategyPhase[]) {
  const start = phase.start_date ?? "";
  const end = phase.end_date || start;
  if (!start || !end || calendarDateDiffDays(start, end) == null) return 0;
  return phases.reduce((count, candidate, candidateIndex) => {
    if (candidateIndex === index) return count;
    const candidateStart = candidate.start_date ?? "";
    const candidateEnd = candidate.end_date || candidateStart;
    if (!candidateStart || !candidateEnd) return count;
    const validCandidate = calendarDateDiffDays(candidateStart, candidateEnd);
    if (validCandidate == null || validCandidate < 0) return count;
    const overlaps = start <= candidateEnd && candidateStart <= end;
    return overlaps ? count + 1 : count;
  }, 0);
}

function calendarPhaseDateStatus(phase: MonitoreoStrategyPhase, index: number, phases: MonitoreoStrategyPhase[]): AcreditacionCalendarPhaseDateStatus {
  const start = phase.start_date ?? "";
  const end = phase.end_date ?? "";
  const diff = start && end ? calendarDateDiffDays(start, end) : null;
  const overlapCount = calendarPhaseOverlapCount(phase, index, phases);
  if (diff != null && diff < 0) {
    return {
      state: "invalid",
      label: "Rango inválido",
      detail: "La fecha fin queda antes del inicio.",
      durationLabel: "Corregir fechas",
      overlapCount,
    };
  }
  if (start && end) {
    const duration = calendarPhaseDurationDays(phase);
    return {
      state: overlapCount ? "partial" : "ready",
      label: calendarPhaseDateRangeLabel(phase),
      detail: overlapCount ? `Se cruza con ${fmt(overlapCount)} fase${overlapCount === 1 ? "" : "s"}` : "Rango definido",
      durationLabel: calendarDurationLabel(duration),
      overlapCount,
    };
  }
  if (start || end) {
    return {
      state: "partial",
      label: calendarPhaseDateRangeLabel(phase),
      detail: "Completa inicio y fin para leer la ventana.",
      durationLabel: "Rango incompleto",
      overlapCount,
    };
  }
  return {
    state: "empty",
    label: "Sin fecha de campo",
    detail: "Define inicio para hidratar el calendario.",
    durationLabel: "Pendiente",
    overlapCount,
  };
}

function calendarBasePhase(phases: MonitoreoStrategyPhase[]) {
  return phases.find((phase) => parseCalendarIsoDate(phase.start_date));
}

function distributeCalendarDatesByWeek(phases: MonitoreoStrategyPhase[]) {
  const basePhase = calendarBasePhase(phases);
  const baseDate = basePhase?.start_date ?? "";
  if (!basePhase || !baseDate) return null;
  const baseWeek = Number(basePhase.start_week) > 0 ? Number(basePhase.start_week) : 1;
  return phases.map((phase) => {
    const startWeek = Number(phase.start_week) > 0 ? Number(phase.start_week) : baseWeek;
    const endWeek = Number(phase.end_week ?? phase.start_week) >= startWeek ? Number(phase.end_week ?? phase.start_week) : startWeek;
    const startOffset = Math.max(0, startWeek - baseWeek) * 7;
    const durationDays = Math.max(1, endWeek - startWeek + 1) * 7;
    const startDate = calendarAddDaysIso(baseDate, startOffset);
    return {
      ...phase,
      start_date: startDate,
      end_date: startDate ? calendarAddDaysIso(startDate, durationDays - 1) : phase.end_date,
    };
  });
}

function buildCalendarTimeline(phases: MonitoreoStrategyPhase[]) {
  const ranges = phases.map((phase, index) => {
    const start = phase.start_date ?? "";
    const end = phase.end_date || start;
    const diff = start && end ? calendarDateDiffDays(start, end) : null;
    if (!start || !end || diff == null || diff < 0) return null;
    return { phase, index, start, end };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));

  const missingDates = phases.length - ranges.length;
  if (!ranges.length) {
    return { days: [] as AcreditacionCalendarTimelineDay[], items: [] as AcreditacionCalendarTimelineItem[], missingDates, totalDays: 0 };
  }

  const start = ranges.map((item) => item.start).sort()[0];
  const end = ranges.map((item) => item.end).sort().at(-1) ?? start;
  const totalDays = Math.max(1, (calendarDateDiffDays(start, end) ?? 0) + 1);
  const days = Array.from({ length: totalDays }, (_, offset) => {
    const iso = calendarAddDaysIso(start, offset);
    return {
      iso,
      dayLabel: formatCalendarDateLabel(iso),
      weekdayLabel: formatCalendarWeekdayLabel(iso),
    };
  });
  const items = ranges.map((item) => {
    const startIndex = Math.max(0, calendarDateDiffDays(start, item.start) ?? 0);
    const endIndex = Math.max(startIndex, calendarDateDiffDays(start, item.end) ?? startIndex);
    const status = calendarPhaseDateStatus(item.phase, item.index, phases);
    return {
      key: item.phase.id || `${item.index}-${item.start}-${item.end}`,
      index: item.index,
      phase: item.phase,
      startIndex,
      endIndex,
      state: status.state,
      rangeLabel: status.label,
      durationLabel: status.durationLabel,
    };
  });
  return { days, items, missingDates, totalDays };
}

function AcreditacionFieldCalendarTimeline({ phases }: { phases: MonitoreoStrategyPhase[] }) {
  const timeline = buildCalendarTimeline(phases);
  const readyCount = timeline.items.filter((item) => item.state === "ready").length;
  const partialCount = timeline.items.length - readyCount;
  const timelineStyle = { "--calendar-day-count": Math.max(1, timeline.days.length) } as CSSProperties;

  if (!phases.length) {
    return null;
  }

  return (
    <div className={`mon-calendar-timeline-panel${timeline.items.length ? "" : " is-empty"}`} aria-label="Vista visual del calendario de campo">
      <div className="mon-calendar-timeline-head">
        <div>
          <span><CalendarRange size={13} /> Calendario visual</span>
          <strong>
            {timeline.items.length
              ? `${formatCalendarDateLabel(timeline.days[0]?.iso)} - ${formatCalendarDateLabel(timeline.days.at(-1)?.iso)}`
              : "Define fechas para ver la ventana"}
          </strong>
        </div>
        <div className="mon-calendar-timeline-kpis">
          <span className="is-ready">{fmt(readyCount)} listas</span>
          <span className={partialCount ? "is-warning" : "is-ready"}>{fmt(partialCount)} por revisar</span>
          <span>{timeline.totalDays ? calendarDurationLabel(timeline.totalDays) : "Sin rango"}</span>
        </div>
      </div>
      {timeline.items.length ? (
        <div className="mon-calendar-timeline-scroll">
          <div className="mon-calendar-timeline-grid" style={timelineStyle}>
            <div className="mon-calendar-timeline-days">
              {timeline.days.map((day) => (
                <div key={day.iso} className="mon-calendar-timeline-day">
                  <strong>{day.dayLabel}</strong>
                  <span>{day.weekdayLabel}</span>
                </div>
              ))}
            </div>
            <div className="mon-calendar-timeline-lanes">
              {timeline.items.map((item) => (
                <div key={item.key} className="mon-calendar-timeline-row">
                  <div
                    className={`mon-calendar-timeline-bar is-${item.state}`}
                    style={{ gridColumn: `${item.startIndex + 1} / ${item.endIndex + 2}` }}
                  >
                    <strong>{item.phase.stratum || `Fase ${fmt(item.index + 1)}`}</strong>
                    <span>{item.rangeLabel} · {item.durationLabel}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="mon-calendar-timeline-empty">Las fases existen, pero ninguna tiene fecha de campo definida.</p>
      )}
      {timeline.missingDates > 0 ? (
        <p className="mon-calendar-timeline-note">{fmt(timeline.missingDates)} fase{timeline.missingDates === 1 ? "" : "s"} sin fecha completa todavía.</p>
      ) : null}
    </div>
  );
}

function inferCalendarModality(channels: string[], sources: MonitoreoSource[]): MonitoreoStrategyPhase["modality"] {
  const text = [...channels, ...sources.map((source) => source.label), ...sources.map((source) => source.role)]
    .map(normalizeSourceMatch)
    .join(" ");
  const hits: MonitoreoStrategyPhase["modality"][] = [];
  if (text.includes("telefon") || text.includes("phone") || text.includes("call")) hits.push("telefono");
  if (text.includes("whatsapp") || text.includes("wa ")) hits.push("whatsapp");
  if (text.includes("sms")) hits.push("sms");
  if (text.includes("presencial") || text.includes("qr")) hits.push("presencial");
  if (text.includes("correo") || text.includes("email") || text.includes("mail") || text.includes("survey") || text.includes("web")) hits.push("email");
  const uniqueHits = Array.from(new Set(hits));
  if (uniqueHits.length > 1) return "mixto";
  return uniqueHits[0] ?? (channels.length > 1 ? "mixto" : "email");
}

function calendarGoalActor(goal: MonitoreoGoal, preferredKey: string) {
  const filters = goal.filters ?? {};
  const preferred = preferredKey ? filters[preferredKey] : "";
  const fallback = Object.values(filters).find((value) => String(value ?? "").trim());
  return String(preferred || fallback || "").trim();
}

function calendarGoalForActor(actor: string, goals: MonitoreoGoal[], preferredKey: string) {
  const actorKey = normalizeSourceMatch(actor);
  const goal = goals.find((item) => normalizeSourceMatch(calendarGoalActor(item, preferredKey)) === actorKey);
  const meta = goal ? Number(goal.meta) : NaN;
  return Number.isFinite(meta) && meta > 0 ? meta : null;
}

function calendarTargetRule(actor: string, meta: number | null) {
  if (meta && meta > 0) return `Cubrir ${fmt(meta)} efectivas de ${actor}`;
  return `Cubrir meta y faltantes de ${actor}`;
}

function calendarPhaseFromPlan(plan: AcreditacionCalendarActorPlan, index: number): MonitoreoStrategyPhase {
  return {
    id: `campo-${Date.now()}-${index}`,
    stratum: plan.actor,
    modality: plan.modality,
    start_week: plan.startWeek,
    end_week: plan.endWeek,
    start_date: "",
    end_date: "",
    client_report_weekday: "",
    client_report_exceptions: [],
    target_rule: calendarTargetRule(plan.actor, plan.meta),
    kpi_focus: ["meta actor", "avance efectivo", "faltantes"],
    kpi_modules: ["progress", "contact_efficiency"],
    breakdown_vars: [],
    attempts_var: "",
    outcome_var: "",
  };
}

function splitCalendarTokens(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

const PHONE_QUOTA_ACTOR_FILTER_KEYS = new Set([
  "actor",
  "dim actor",
  "unidad",
  "publico objetivo",
  "público objetivo",
]);

export type AcreditacionPhoneQuotaEditorRow = {
  key: string;
  variable: string;
  variableLabel: string;
  value: string;
  universe: number;
  meta: number | null;
  effective: number;
  partial: number;
  refusals: number;
  unswept: number;
  gap: number | null;
  requiredSuccessPct: number | null;
  nonEffectiveMargin: number | null;
  source: "base" | "configured";
};

function phoneQuotaIsActorFilterKey(key: string) {
  return PHONE_QUOTA_ACTOR_FILTER_KEYS.has(normalizeSourceMatch(key));
}

function phoneQuotaGoalHasActor(goal: MonitoreoGoal) {
  return Object.keys(goal.filters ?? {}).some(phoneQuotaIsActorFilterKey);
}

function phoneQuotaGoalValue(goal: MonitoreoGoal, variable: string) {
  return String(goal.filters?.[variable] ?? "").trim();
}

function phoneQuotaGoalTotal(goals: MonitoreoGoal[], variable: string) {
  return goals.reduce((sum, goal) => (
    !phoneQuotaGoalHasActor(goal) && phoneQuotaGoalValue(goal, variable)
      ? sum + Math.max(0, Number(goal.meta) || 0)
      : sum
  ), 0);
}

function phoneQuotaGoalVariables(goals: MonitoreoGoal[] = []) {
  const names = goals.flatMap((goal) => (
    phoneQuotaGoalHasActor(goal)
      ? []
      : Object.keys(goal.filters ?? {}).filter((key) => String(goal.filters?.[key] ?? "").trim())
  ));
  return uniqueDisplayValues(names);
}

function phoneQuotaUpsertGoal(goals: MonitoreoGoal[], variable: string, value: string, meta: number, keepZero = false) {
  const cleanValue = value.trim();
  const cleanMeta = Math.max(0, Number(meta) || 0);
  const next = goals.filter((goal) => {
    if (phoneQuotaGoalHasActor(goal)) return true;
    return phoneQuotaGoalValue(goal, variable) !== cleanValue;
  });
  if (cleanValue && (cleanMeta > 0 || keepZero)) {
    next.push({ filters: { [variable]: cleanValue }, meta: cleanMeta });
  }
  return next;
}

function phoneQuotaRemoveGoal(goals: MonitoreoGoal[], variable: string, value: string) {
  const cleanValue = value.trim();
  return goals.filter((goal) => {
    if (phoneQuotaGoalHasActor(goal)) return true;
    return phoneQuotaGoalValue(goal, variable) !== cleanValue;
  });
}

function phoneQuotaVariableOptions(variables: MonitoreoVariable[], controlVars: string[], rows: Array<Record<string, unknown>>, goals: MonitoreoGoal[] = []) {
  const names = uniqueDisplayValues([
    ...controlVars,
    ...rows.map((row) => phoneRowValue(row, ["Variable", "Variable control", "variable_control", "Variable cuota", "Variable de cuota", "Corte"], "")),
    ...phoneQuotaGoalVariables(goals),
    ...variables.map((variable) => variable.name),
  ]).filter((name) => (
    phoneQuotaGoalVariables(goals).includes(name)
    || variables.some((variable) => variable.name === name)
    || rows.some((row) => normalizeSourceMatch(phoneRowValue(row, ["Variable"], "")) === normalizeSourceMatch(name))
  ));
  const preferred = names.filter((name) => ["sede", "distrito", "dim_segmento", "segmento", "dim_actor"].includes(normalizeSourceMatch(name)));
  const rest = names.filter((name) => !preferred.includes(name));
  return [...preferred, ...rest];
}

function preferredPhoneQuotaVariable(variables: MonitoreoVariable[], controlVars: string[], rows: Array<Record<string, unknown>>, goals: MonitoreoGoal[] = []) {
  const options = phoneQuotaVariableOptions(variables, controlVars, rows, goals);
  return options.find((name) => normalizeSourceMatch(name) === "sede")
    ?? options.find((name) => controlVars.includes(name))
    ?? options[0]
    ?? "";
}

export function buildAcreditacionPhoneQuotaEditorRows({
  variable,
  variables,
  goals,
  quotaRows,
}: {
  variable: string;
  variables: MonitoreoVariable[];
  goals: MonitoreoGoal[];
  quotaRows: Array<Record<string, unknown>>;
}): AcreditacionPhoneQuotaEditorRow[] {
  if (!variable) return [];
  const variableMeta = variables.find((item) => item.name === variable);
  const reportRows = quotaRows.map((row) => {
    const rawVariable = phoneRowValue(row, ["Variable", "Variable control", "variable_control", "Variable cuota", "Variable de cuota", "Corte"], "");
    return {
      actor: phoneRowValue(row, ["Actor", "Unidad", "Público objetivo", "Publico objetivo"], "Total") || "Total",
      variable: rawVariable,
      value: phoneRowValue(row, ["Valor", "Categoria", "Categoría", "Nivel", "Segmento", "Grupo", "Etiqueta"], ""),
      universe: phoneRowNumber(row, ["Universo", "Base", "Población", "Poblacion", "Población objetivo", "Poblacion objetivo", "Total", "Casos"], 0),
      meta: phoneRowOptionalNumber(row, ["Meta", "Cuota", "Objetivo", "Mínimo", "Minimo"]),
      effective: phoneRowNumber(row, ["Efectivas", "Completas", "Efectivas telefónicas", "Efectivas telefonicas"], 0),
      partial: phoneRowNumber(row, ["Parciales", "Parcial"], 0),
      refusals: phoneRowNumber(row, ["Rechazos telefónicos", "Rechazos telefonicos", "Rechazos", "Rechazo"], 0),
      unswept: phoneRowNumber(row, ["No barridos", "Por barrer"], 0),
    };
  }).filter((row) => row.variable === variable && row.value);
  const hasTotalRows = reportRows.some((row) => ["total", "todos"].includes(normalizeSourceMatch(row.actor)));
  const sourceRows = hasTotalRows ? reportRows.filter((row) => ["total", "todos"].includes(normalizeSourceMatch(row.actor))) : reportRows;
  const byValue = new Map<string, Omit<AcreditacionPhoneQuotaEditorRow, "key" | "variableLabel" | "requiredSuccessPct" | "nonEffectiveMargin" | "source">>();
  sourceRows.forEach((row) => {
    const current = byValue.get(row.value) ?? {
      variable,
      value: row.value,
      universe: 0,
      meta: null,
      effective: 0,
      partial: 0,
      refusals: 0,
      unswept: 0,
      gap: null,
    };
    current.universe += row.universe;
    current.effective += row.effective;
    current.partial += row.partial;
    current.refusals += row.refusals;
    current.unswept += row.unswept;
    if (row.meta != null) current.meta = (current.meta ?? 0) + row.meta;
    byValue.set(row.value, current);
  });
  const goalValues = new Map<string, number>();
  goals.forEach((goal) => {
    if (phoneQuotaGoalHasActor(goal)) return;
    const value = phoneQuotaGoalValue(goal, variable);
    if (!value) return;
    goalValues.set(value, (goalValues.get(value) ?? 0) + Math.max(0, Number(goal.meta) || 0));
  });
  const values = uniqueDisplayValues([
    ...Array.from(byValue.keys()),
    ...(variableMeta?.values ?? []),
    ...Array.from(goalValues.keys()),
  ]);
  const variableLabel = phoneQuotaVariableLabel(variable);
  return values.map((value) => {
    const base = byValue.get(value) ?? {
      variable,
      value,
      universe: 0,
      meta: null,
      effective: 0,
      partial: 0,
      refusals: 0,
      unswept: 0,
      gap: null,
    };
    const meta = goalValues.has(value) ? goalValues.get(value)! : base.meta;
    const gap = meta != null ? Math.max(0, meta - base.effective) : null;
    const requiredSuccessPct = meta != null && base.universe > 0 ? safePercentValue(meta, base.universe) : null;
    const nonEffectiveMargin = meta != null && base.universe > 0 ? base.universe - meta : null;
    return {
      ...base,
      key: `${normalizeSourceMatch(variable)}-${normalizeSourceMatch(value)}`,
      variableLabel,
      meta,
      gap,
      requiredSuccessPct,
      nonEffectiveMargin,
      source: base.universe > 0 ? "base" as const : "configured" as const,
    };
  }).sort((a, b) => (
    (b.meta ?? 0) - (a.meta ?? 0)
    || b.universe - a.universe
    || a.value.localeCompare(b.value, "es", { numeric: true })
  ));
}

function AcreditacionPhoneQuotaEditor({
  draft,
  variables,
  platformSources = [],
  quotaRows,
  onPatchConfig,
}: {
  draft: MonitoreoConfig;
  variables: MonitoreoVariable[];
  platformSources?: MonitoreoSource[];
  quotaRows: Array<Record<string, unknown>>;
  onPatchConfig: (patch: Partial<MonitoreoConfig>) => void;
}) {
  const [newValue, setNewValue] = useState("");
  const variableOptions = phoneQuotaVariableOptions(variables, draft.control_vars, quotaRows, draft.goals);
  const [activeVariable, setActiveVariable] = useState(() => preferredPhoneQuotaVariable(variables, draft.control_vars, quotaRows, draft.goals));

  useEffect(() => {
    if (!activeVariable || !variableOptions.includes(activeVariable)) {
      setActiveVariable(preferredPhoneQuotaVariable(variables, draft.control_vars, quotaRows, draft.goals));
    }
  }, [activeVariable, draft.control_vars, draft.goals, quotaRows, variableOptions, variables]);

  const rows = buildAcreditacionPhoneQuotaEditorRows({
    variable: activeVariable,
    variables,
    goals: draft.goals,
    quotaRows,
  });
  const allCandidateVariables = variableOptions.map((name) => {
    const candidateRows = buildAcreditacionPhoneQuotaEditorRows({
      variable: name,
      variables,
      goals: draft.goals,
      quotaRows,
    });
    return {
      name,
      label: phoneQuotaVariableLabel(name),
      categories: candidateRows.length,
      universe: candidateRows.reduce((sum, row) => sum + row.universe, 0),
      meta: phoneQuotaGoalTotal(draft.goals, name),
    };
  });
  const candidateVariables = allCandidateVariables
    .filter((candidate) => (
      normalizeSourceMatch(candidate.name) === normalizeSourceMatch(activeVariable)
      || candidate.universe > 0
      || candidate.meta > 0
    ))
    .sort((a, b) => (
      Number(normalizeSourceMatch(b.name) === normalizeSourceMatch(activeVariable)) - Number(normalizeSourceMatch(a.name) === normalizeSourceMatch(activeVariable))
      || b.universe - a.universe
      || b.meta - a.meta
      || a.label.localeCompare(b.label, "es")
    ))
    .slice(0, 6);
  const quotaTotal = activeVariable ? phoneQuotaGoalTotal(draft.goals, activeVariable) : 0;
  const totalUniverse = rows.reduce((sum, row) => sum + row.universe, 0);
  const totalEffective = rows.reduce((sum, row) => sum + row.effective, 0);
  const totalGap = rows.reduce((sum, row) => sum + (row.gap ?? 0), 0);
  const rowsWithoutBase = rows.filter((row) => row.meta != null && row.meta > 0 && row.universe <= 0).length;
  const activeVariableLabel = activeVariable ? phoneQuotaVariableLabel(activeVariable) : "Sin variable";
  const phoneFilter = normalizePhoneEffectiveFilter(draft.monitoreo_profile?.platform_effective_filter);
  const phoneFilterConfigured = Boolean(phoneFilter.enabled && phoneFilter.variable && phoneFilter.values.length);
  const phoneFilterQuestionLabel = phoneFilter.label || (phoneFilter.variable ? phoneQuotaVariableLabel(phoneFilter.variable) : "");
  const phoneFilterValueLabel = phoneFilter.value_label || phoneFilter.values.join(", ");
  const activePlatformSources = platformSources.filter((source) => source.enabled);
  const variableIsSaved = activeVariable
    ? draft.control_vars.some((name) => normalizeSourceMatch(name) === normalizeSourceMatch(activeVariable))
    : false;
  const quotaProgressPct = quotaTotal > 0
    ? safePercentValue(totalEffective, quotaTotal)
    : safePercentValue(totalEffective, totalUniverse);
  const boundedQuotaProgressPct = Math.max(0, Math.min(100, quotaProgressPct ?? 0));
  const focusRows = [...rows]
    .filter((row) => row.meta != null || row.universe > 0 || row.effective > 0)
    .sort((a, b) => (
      (b.gap ?? 0) - (a.gap ?? 0)
      || (b.meta ?? 0) - (a.meta ?? 0)
      || b.universe - a.universe
      || a.value.localeCompare(b.value, "es", { numeric: true })
    ))
    .slice(0, 6);
  const decisionSteps = [
    {
      key: "filter",
      label: "Filtro",
      value: phoneFilterConfigured ? phoneFilterQuestionLabel : "Sin filtro",
      detail: phoneFilterConfigured ? phoneFilterValueLabel : "Kobo",
      tone: phoneFilterConfigured ? "ready" : "warning",
    },
    {
      key: "variable",
      label: "Variable",
      value: activeVariable ? activeVariableLabel : "Pendiente",
      detail: activeVariable ? `${fmt(rows.length)} categorías` : "Seleccionar",
      tone: activeVariable ? "ready" : "warning",
    },
    {
      key: "goal",
      label: "Meta",
      value: quotaTotal ? fmt(quotaTotal) : "S/M",
      detail: quotaTotal ? "cuotas Kobo" : "sin objetivo",
      tone: quotaTotal ? "ready" : "warning",
    },
    {
      key: "effective",
      label: "Kobo",
      value: fmt(totalEffective),
      detail: "filtradas",
      tone: totalEffective ? "ready" : "neutral",
    },
    {
      key: "gap",
      label: "Avance",
      value: fmt(totalGap),
      detail: totalGap ? "se revisa en Avance" : "meta cubierta",
      tone: totalGap ? "warning" : "ready",
    },
  ] as const;
  const governorFacts = [
    {
      key: "kobo",
      label: "Fuente Kobo",
      value: activePlatformSources.length ? `${fmt(activePlatformSources.length)} activa${activePlatformSources.length === 1 ? "" : "s"}` : "Pendiente",
      tone: activePlatformSources.length ? "ready" : "warning",
    },
    {
      key: "filter",
      label: "Efectiva Kobo",
      value: phoneFilterConfigured ? `${phoneFilterQuestionLabel} = ${phoneFilterValueLabel}` : "Configurar filtro",
      tone: phoneFilterConfigured ? "ready" : "warning",
    },
    {
      key: "quota",
      label: "Cuotas",
      value: activeVariable ? `${activeVariableLabel} · ${fmt(rows.length)} categorías` : "Sin variable",
      tone: activeVariable ? "ready" : "warning",
    },
    {
      key: "match",
      label: "Contraste",
      value: "CodPulso Kobo vs barrido",
      tone: activePlatformSources.length && activeVariable ? "ready" : "warning",
    },
  ] as const;

  const saveActiveVariable = () => {
    if (!activeVariable) return;
    const nextControlVars = variableIsSaved ? draft.control_vars : [...draft.control_vars, activeVariable];
    onPatchConfig({
      control_vars: nextControlVars,
      objetivo_total: quotaTotal > 0 ? quotaTotal : draft.objetivo_total,
    });
  };

  const patchGoals = (goals: MonitoreoGoal[]) => {
    const nextControlVars = activeVariable && !draft.control_vars.includes(activeVariable)
      ? [...draft.control_vars, activeVariable]
      : draft.control_vars;
    const nextTotal = activeVariable ? phoneQuotaGoalTotal(goals, activeVariable) : 0;
    onPatchConfig({
      goals,
      control_vars: nextControlVars,
      objetivo_total: nextTotal > 0 ? nextTotal : draft.objetivo_total,
    });
  };
  const updateMeta = (value: string, meta: number, keepZero = false) => {
    if (!activeVariable) return;
    patchGoals(phoneQuotaUpsertGoal(draft.goals, activeVariable, value, meta, keepZero));
  };
  const removeValue = (value: string) => {
    if (!activeVariable) return;
    patchGoals(phoneQuotaRemoveGoal(draft.goals, activeVariable, value));
  };
  const addCategory = () => {
    const value = newValue.trim();
    if (!activeVariable || !value) return;
    updateMeta(value, 0, true);
    setNewValue("");
  };

  return (
    <section className="mon-contract-block mon-contract-block--wide mon-phone-quota-editor">
      <div className="mon-phone-quota-editor-head">
        <div>
          <span>Modelo telefónico</span>
          <strong>{activeVariable ? `${activeVariableLabel} organiza categorías y metas` : "Elige la variable rectora"}</strong>
          <small>Kobo aporta efectivas; el barrido conserva estados telefónicos en paralelo.</small>
        </div>
        <div className="mon-phone-quota-editor-controls">
          <label>
            <span>Variable</span>
            <select value={activeVariable} onChange={(event) => setActiveVariable(event.target.value)}>
              <option value="">Seleccionar</option>
              {variableOptions.map((name) => <option key={name} value={name}>{phoneQuotaVariableLabel(name)}</option>)}
            </select>
          </label>
          <button
            type="button"
            className="mon-phone-quota-governor-save"
            onClick={saveActiveVariable}
            disabled={!activeVariable || variableIsSaved}
          >
            <CheckCircle2 size={13} />
            {variableIsSaved ? "Variable guardada" : "Usar para cuotas"}
          </button>
          <label>
            <span>Objetivo total</span>
            <input
              type="number"
              min={0}
              value={draft.objetivo_total ?? (quotaTotal || "")}
              onChange={(event) => onPatchConfig({ objetivo_total: event.target.value ? Number(event.target.value) : null })}
            />
          </label>
        </div>
      </div>
      <div className="mon-phone-quota-governor" aria-label="Variable rectora del monitoreo telefónico">
        <div className="mon-phone-quota-governor-main">
          <div
            className="mon-phone-quota-governor-gauge"
            style={{ "--phone-quota-governor-pct": `${Math.max(2, boundedQuotaProgressPct)}%` } as CSSProperties}
            aria-label={quotaProgressPct == null ? "Sin avance de cuota" : `${formatPercentLabel(quotaProgressPct)} de la meta Kobo`}
          >
            <strong>{quotaProgressPct == null ? "S/M" : formatPercentLabel(quotaProgressPct)}</strong>
            <em>Kobo</em>
          </div>
          <div>
            <span><SlidersHorizontal size={13} /> Variable rectora</span>
            <strong>{activeVariable ? activeVariableLabel : "Seleccionar variable"}</strong>
            <p>{activeVariable ? "Cada categoría cruza meta, base telefónica y efectivas Kobo para leer cumplimiento." : "Elige la variable que define las cuotas operativas del estudio telefónico."}</p>
          </div>
        </div>
        <div className="mon-phone-quota-decision-path" aria-label="Regla de lectura de cuotas telefónicas">
          {decisionSteps.map((step, index) => (
            <Fragment key={step.key}>
              <span className={`is-${step.tone}`}>
                <em>{step.label}</em>
                <strong>{step.value}</strong>
                <small>{step.detail}</small>
              </span>
              {index < decisionSteps.length - 1 ? <i aria-hidden="true" /> : null}
            </Fragment>
          ))}
        </div>
        <div className="mon-phone-quota-governor-facts" aria-label="Condiciones para contar efectivas Kobo por cuota">
          {governorFacts.map((fact) => (
            <span key={fact.key} className={`is-${fact.tone}`}>
              <em>{fact.label}</em>
              <strong title={fact.value}>{fact.value}</strong>
            </span>
          ))}
        </div>
        {focusRows.length ? (
          <div className="mon-phone-quota-gap-board" aria-label={`Categorías de cuota por ${activeVariableLabel}`}>
            <header>
              <span><BarChart3 size={13} /> Categorías de {activeVariableLabel}</span>
              <strong>{fmt(rows.length)} categorías · {quotaTotal ? `${fmt(quotaTotal)} meta` : "sin meta"}</strong>
            </header>
            <div>
              {focusRows.map((row) => {
                const metaPct = row.meta != null && row.universe > 0 ? safePercentValue(row.meta, row.universe) ?? 0 : 0;
                return (
                  <article key={row.key} className={row.meta != null ? "is-ready" : "is-gap"}>
                    <span>
                      <strong>{row.value}</strong>
                      <em>{fmt(row.universe)} base · {row.meta == null ? "sin meta" : `${fmt(row.meta)} meta`}</em>
                    </span>
                    <i
                      aria-hidden="true"
                      style={{
                        "--phone-quota-gap-pct": "0%",
                        "--phone-quota-progress-pct": `${Math.max(metaPct ? 4 : 0, Math.min(100, metaPct))}%`,
                      } as CSSProperties}
                    />
                    <small>{row.requiredSuccessPct == null ? "sin base" : `${formatPercentLabel(row.requiredSuccessPct)} requerido`}</small>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}
        {candidateVariables.length ? (
          <div className="mon-phone-quota-governor-candidates" aria-label="Variables candidatas para cuotas">
            {candidateVariables.map((candidate) => (
              <button
                key={candidate.name}
                type="button"
                className={normalizeSourceMatch(candidate.name) === normalizeSourceMatch(activeVariable) ? "is-active" : ""}
                onClick={() => setActiveVariable(candidate.name)}
              >
                <strong>{candidate.label}</strong>
                <em>{fmt(candidate.categories)} categorías · {fmt(candidate.universe)} base{candidate.meta ? ` · ${fmt(candidate.meta)} meta` : ""}</em>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mon-phone-quota-editor-summary" aria-label="Resumen de cuotas telefónicas editables">
        <span><em>Objetivo Kobo</em><strong>{quotaTotal ? fmt(quotaTotal) : "S/M"}</strong></span>
        <span><em>Base telefónica</em><strong>{fmt(totalUniverse)}</strong></span>
        <span><em>Efectivas Kobo</em><strong>{fmt(totalEffective)}</strong></span>
        <span className={totalGap ? "is-warning" : "is-ready"}><em>Pendiente avance</em><strong>{fmt(totalGap)}</strong></span>
        <span className={rowsWithoutBase ? "is-warning" : "is-ready"}><em>Sin base</em><strong>{fmt(rowsWithoutBase)}</strong></span>
      </div>
      <div className="mon-phone-quota-editor-add">
        <input value={newValue} onChange={(event) => setNewValue(event.target.value)} placeholder={`Nuevo valor de ${activeVariable ? phoneQuotaVariableLabel(activeVariable).toLowerCase() : "variable"}`} />
        <button type="button" onClick={addCategory} disabled={!activeVariable || !newValue.trim()}><Plus size={13} /> Agregar categoría</button>
      </div>
      {rows.length ? (
        <div className="mon-phone-quota-editor-list">
          {rows.map((row) => {
            const progressPct = row.meta && row.meta > 0 ? safePercentValue(row.effective, row.meta) ?? 0 : safePercentValue(row.effective, row.universe) ?? 0;
            const marginTitle = row.nonEffectiveMargin == null
              ? "Sin base"
              : row.nonEffectiveMargin >= 0
                ? `${fmt(row.nonEffectiveMargin)} no efectivas posibles`
                : `${fmt(Math.abs(row.nonEffectiveMargin))} base faltante`;
            const marginLabel = row.nonEffectiveMargin == null
              ? "Sin base"
              : row.nonEffectiveMargin >= 0
                ? fmt(row.nonEffectiveMargin)
                : fmt(Math.abs(row.nonEffectiveMargin));
            const marginMetricLabel = row.nonEffectiveMargin != null && row.nonEffectiveMargin < 0 ? "Base faltante" : "No efectivas";
            return (
              <article key={row.key} className={`mon-phone-quota-editor-row ${row.source === "configured" ? "is-configured" : ""} ${row.gap ? "is-gap" : "is-ready"}`}>
                <header>
                  <div>
                    <span>{row.variableLabel}</span>
                    <strong>{row.value}</strong>
                  </div>
                  <button type="button" aria-label={`Quitar cuota ${row.value}`} onClick={() => removeValue(row.value)}>
                    <XCircle size={14} />
                  </button>
                </header>
                <div className="mon-phone-quota-editor-row-grid">
                  <span><em>Universo</em><strong>{fmt(row.universe)}</strong></span>
                  <label>
                    <span>Meta</span>
                    <input type="number" min={0} value={row.meta ?? 0} onChange={(event) => updateMeta(row.value, Number(event.target.value) || 0, true)} />
                  </label>
                  <span><em>Efectivas</em><strong>{fmt(row.effective)}</strong></span>
                  <span><em>Brecha</em><strong>{row.gap == null ? "S/M" : fmt(row.gap)}</strong></span>
                  <span><em title="Tasa requerida para cubrir la meta Kobo">Tasa req.</em><strong>{row.requiredSuccessPct == null ? "S/B" : formatPercentLabel(row.requiredSuccessPct)}</strong></span>
                  <span><em title={marginTitle}>{marginMetricLabel}</em><strong title={marginTitle}>{marginLabel}</strong></span>
                </div>
                <i aria-hidden="true" style={{ "--phone-quota-editor-pct": `${Math.max(2, Math.min(100, progressPct))}%` } as CSSProperties} />
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyPanel title="Sin categorías de cuota" detail="Selecciona una variable de control o agrega una categoría para definir metas telefónicas." />
      )}
    </section>
  );
}

function AcreditacionModelConfigWorkbench({
  state,
  activeTab,
  onStateChange,
  showHeader = true,
}: {
  state?: MonitoreoState | null;
  activeTab: AcreditacionModelTab;
  onStateChange?: (state: MonitoreoState) => void;
  showHeader?: boolean;
}) {
  const [draft, setDraft] = useState<MonitoreoConfig | null>(() => state?.config ?? null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);

  useEffect(() => {
    if (state?.config) setDraft(state.config);
  }, [state?.config]);

  if (!state || !draft) {
    return <EmptyPanel title="Modelo pendiente" detail="La configuración operativa se activa cuando el proyecto termina de cargar su estado local." />;
  }

  const variables = state.variables ?? [];
  const variableNames = variables.map((variable) => variable.name);
  const model = draft.operational_model;
  const statusOptions = statusValueOptions(variables, draft.status_var, draft.valid_statuses);
  const sources = state.sources ?? [];
  const activeSources = sources.filter((source) => source.enabled);
  const goalTotal = draft.goals.reduce((sum, goal) => sum + Math.max(0, Number(goal.meta) || 0), 0);
  const configuredGoals = draft.goals.filter((goal) => Number(goal.meta) > 0).length;
  const goalActorKey = preferredGoalVariable(variableNames);
  const calendarActorLabels = uniqueDisplayValues([
    ...draft.goals.map((goal) => calendarGoalActor(goal, goalActorKey)),
    ...activeSources.map(sourceActorLabel),
  ]);
  const calendarActorPlans: AcreditacionCalendarActorPlan[] = calendarActorLabels.map((actor, index) => {
    const actorKey = normalizeSourceMatch(actor);
    const actorSources = activeSources.filter((source) => {
      const sourceActor = normalizeSourceMatch(sourceActorLabel(source));
      const sourceLabel = normalizeSourceMatch(source.label);
      return sourceActor === actorKey || sourceLabel.includes(actorKey);
    });
    const channels = uniqueDisplayValues(actorSources.map((source) => acreditacionChannelLabel(sourceChannelLabel(source))));
    const meta = calendarGoalForActor(actor, draft.goals, goalActorKey);
    return {
      actor,
      channels,
      sourceCount: actorSources.length,
      meta,
      modality: inferCalendarModality(channels, actorSources),
      startWeek: index + 1,
      endWeek: index + 1,
    };
  });
  const suggestedCalendarEnd = calendarActorPlans.length ? calendarActorPlans[calendarActorPlans.length - 1].endWeek : null;
  const calendarWindow = calendarWeekWindowLabel(draft.strategy_phases, suggestedCalendarEnd);
  const calendarDateWindow = calendarDateWindowLabel(draft.strategy_phases);
  const plannedActorCount = uniqueDisplayValues(draft.strategy_phases.map((phase) => phase.stratum)).length || calendarActorPlans.length;
  const modelReports = reportsFromState(state);
  const phoneQuotaReportRows = modelReports
    ? rowsForSheetBlock(modelReports, "monitoreo_telefonico", ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"])
    : [];
  const showPhoneQuotaEditor = normalizeSourceMatch(draft.monitoreo_profile?.family ?? "").includes("telefon")
    || phoneQuotaReportRows.length > 0
    || draft.operational_model.link_collectors.some((collector) => normalizeSourceMatch(collector.channel ?? "").includes("telefon"));

  const patchConfig = (patch: Partial<MonitoreoConfig>) => {
    setDraft((current) => current ? { ...current, ...patch } : current);
  };
  const patchModel = (patch: Partial<MonitoreoConfig["operational_model"]>) => {
    setDraft((current) => current ? {
      ...current,
      operational_model: { ...current.operational_model, ...patch },
    } : current);
  };
  const patchCases = (patch: Partial<MonitoreoConfig["operational_model"]["cases"]>) => {
    patchModel({ cases: { ...model.cases, ...patch } });
  };

  const saveConfig = async () => {
    if (!draft) return;
    setSaving(true);
    setStatus({ tone: "info", message: "Guardando configuración operativa..." });
    try {
      const result = await apiMonitoreoConfig(draft);
      setDraft(result.config);
      onStateChange?.(result.state);
      setStatus({ tone: "success", message: "Modelo operativo guardado." });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const updateGoal = (index: number, goal: MonitoreoGoal) => {
    patchConfig({ goals: draft.goals.map((item, itemIndex) => itemIndex === index ? goal : item) });
  };
  const removeGoal = (index: number) => {
    patchConfig({ goals: draft.goals.filter((_, itemIndex) => itemIndex !== index) });
  };
  const addGoal = () => {
    const key = preferredGoalVariable(variableNames);
    patchConfig({ goals: [...draft.goals, { filters: key ? { [key]: "" } : {}, meta: 0 }] });
  };
  const updatePhase = (index: number, phase: MonitoreoStrategyPhase) => {
    patchConfig({ strategy_phases: draft.strategy_phases.map((item, itemIndex) => itemIndex === index ? phase : item) });
  };
  const removePhase = (index: number) => {
    patchConfig({ strategy_phases: draft.strategy_phases.filter((_, itemIndex) => itemIndex !== index) });
  };
  const nextPhaseStartWeek = () => {
    const last = Math.max(0, ...draft.strategy_phases.map((phase) => Number(phase.end_week ?? phase.start_week) || 0));
    return last + 1;
  };
  const addPhase = () => {
    const startWeek = nextPhaseStartWeek();
    patchConfig({
      strategy_phases: [
        ...draft.strategy_phases,
        {
          id: `fase-${Date.now()}`,
          stratum: "",
          modality: "email",
          start_week: startWeek,
          end_week: startWeek,
          start_date: "",
          end_date: "",
          client_report_weekday: "",
          client_report_exceptions: [],
          target_rule: "",
          kpi_focus: [],
          kpi_modules: [],
          breakdown_vars: [],
          attempts_var: "",
          outcome_var: "",
        },
      ],
    });
  };

  const header = (
    <section className="mon-acr-model-summary mon-acr-model-config-summary" aria-label="Modelo operativo configurable">
      <div>
        <span>Modelo operativo</span>
        <strong>Variables, metas y reglas de avance</strong>
        <p>Configuración local del proyecto. El seguimiento multi-corte puede importarse después, pero estas pestañas ya controlan el modelo base.</p>
      </div>
      <div className="mon-acr-model-summary__stats">
        <StatTile label="Variables" value={fmt(variableNames.length)} tone={variableNames.length ? "good" : "warn"} />
        <StatTile label="Metas" value={fmt(configuredGoals)} tone={configuredGoals ? "good" : "warn"} />
        <StatTile label="Fases" value={fmt(draft.strategy_phases.length)} tone={draft.strategy_phases.length ? "good" : "neutral"} />
      </div>
      <div className="mon-acr-model-config-actions">
        <button type="button" onClick={() => void saveConfig()} disabled={saving}>
          {saving ? <Loader2 size={14} className="pulso-spin" /> : <Save size={14} />}
          Guardar modelo
        </button>
        {status ? <span className={`mon-acr-model-action-status is-${status.tone}`}>{status.message}</span> : null}
      </div>
    </section>
  );

  if (activeTab === "casos") {
    return (
      <div className="mon-acr-model mon-acr-model-config">
        {showHeader ? header : null}
        <AcreditacionSweepBaseWorkbench
          sources={sources}
          config={draft}
          cases={model.cases}
          variableNames={variableNames}
          onCasesChange={patchCases}
          onStateChange={onStateChange}
        />
      </div>
    );
  }

  if (activeTab === "enlaces") {
    const collectorSummary = buildAcreditacionActiveSourcesSummary(sources, draft.operational_model.link_collectors);
    return (
      <div className="mon-acr-model mon-acr-model-config">
        {showHeader ? header : null}
        <section className="mon-profile-panel mon-acr-model-router-note">
          <div className="mon-profile-panel-head">
            <h3>Enlaces operativos</h3>
            <span>{fmt(collectorSummary.includedCollectors)} recopiladores incluidos</span>
          </div>
          <p className="mon-profile-muted">
            La clasificacion editable de recopiladores vive en Fuentes, dentro de la pestaña Recopiladores. Este modelo conserva la relacion guardada para metas, reglas y avance.
          </p>
          <div className="mon-acr-active-kpis">
            <StatTile label="Encuestas activas" value={fmt(collectorSummary.activeSurveys)} tone={collectorSummary.activeSurveys ? "good" : "warn"} />
            <StatTile label="Actores con encuesta" value={fmt(collectorSummary.actorsWithSurvey.length)} tone={collectorSummary.actorsWithSurvey.length ? "good" : "warn"} />
            <StatTile label="Incluidos" value={fmt(collectorSummary.includedCollectors)} tone={collectorSummary.includedCollectors ? "good" : "neutral"} />
            <StatTile label="Sin metadata" value={fmt(collectorSummary.missingCollectorMetadata)} tone={collectorSummary.missingCollectorMetadata ? "warn" : "good"} />
          </div>
        </section>
        <section className="mon-profile-panel">
          <div className="mon-profile-panel-head">
            <h3>Fuentes disponibles para mecanismos</h3>
            <span>{fmt(activeSources.length)} activas</span>
          </div>
          <DataTable
            rows={activeSources.map((source) => ({
              Fuente: source.label || source.id,
              Servicio: source.kind,
              Rol: source.role || "respuestas",
              Actor: sourceActorLabel(source),
              Canal: acreditacionChannelLabel(sourceChannelLabel(source)),
              ID: source.id,
            }))}
            empty="Sin fuentes activas para enlazar mecanismos."
            preferredColumns={["Fuente", "Servicio", "Rol", "Actor", "Canal", "ID"]}
          />
        </section>
      </div>
    );
  }

  if (activeTab === "reglas") {
    return (
      <div className="mon-acr-model mon-acr-model-config">
        {showHeader ? header : null}
        <section className="mon-contract-block mon-contract-block--wide">
          <div className="mon-contract-block-head">
            <span>Estados válidos y reglas de avance</span>
            <span className="mon-contract-counter">{fmt(model.events.length)} eventos · {fmt(model.state_rules.length)} reglas</span>
          </div>
          <div className="mon-form mon-form--two">
            <AcreditacionVarSelect label="Variable de estado" value={draft.status_var} vars={variableNames} onChange={(status_var) => patchConfig({ status_var })} />
            <AcreditacionValuePicker label="Estados válidos" options={statusOptions} values={draft.valid_statuses} onChange={(valid_statuses) => patchConfig({ valid_statuses })} />
          </div>
          <div className="mon-profile-grid">
            <AcreditacionEventsEditor
              events={model.events}
              onChange={(events) => patchModel({ events })}
            />
            <AcreditacionStateRulesEditor
              rules={model.state_rules}
              eventValues={model.events.map((event) => event.outcome).filter(Boolean)}
              onChange={(state_rules) => patchModel({ state_rules })}
            />
          </div>
        </section>
      </div>
    );
  }

  if (activeTab === "estrategias") {
    const seedCalendar = () => {
      patchConfig({ strategy_phases: calendarActorPlans.map(calendarPhaseFromPlan) });
    };
    const addPhaseForPlan = (plan: AcreditacionCalendarActorPlan) => {
      patchConfig({ strategy_phases: [...draft.strategy_phases, calendarPhaseFromPlan(plan, draft.strategy_phases.length)] });
    };
    const distributedCalendar = distributeCalendarDatesByWeek(draft.strategy_phases);
    const distributeCalendar = () => {
      if (distributedCalendar) patchConfig({ strategy_phases: distributedCalendar });
    };
    const setPhaseDuration = (index: number, days: number) => {
      const phase = draft.strategy_phases[index];
      if (!phase?.start_date) return;
      updatePhase(index, {
        ...phase,
        end_date: calendarAddDaysIso(phase.start_date, Math.max(1, days) - 1),
      });
    };
    const alignPhaseAfterPrevious = (index: number) => {
      const phase = draft.strategy_phases[index];
      const previous = draft.strategy_phases.slice(0, index).reverse().find((item) => item.end_date || item.start_date);
      const previousEnd = previous?.end_date || previous?.start_date || "";
      if (!phase || !previousEnd) return;
      const startDate = calendarAddDaysIso(previousEnd, 1);
      const duration = calendarPhaseDurationDays(phase) ?? calendarPhaseWeekDurationDays(phase);
      updatePhase(index, {
        ...phase,
        start_date: startDate,
        end_date: startDate ? calendarAddDaysIso(startDate, Math.max(1, duration) - 1) : phase.end_date,
      });
    };
    const addReportException = (index: number) => {
      const phase = draft.strategy_phases[index];
      if (!phase) return;
      const exceptions = calendarReportExceptions(phase);
      const { startWeek } = calendarWeekRange(phase);
      updatePhase(index, {
        ...phase,
        client_report_exceptions: [
          ...exceptions,
          { week: startWeek, weekday: normalizeCalendarReportWeekday(phase.client_report_weekday) || "viernes", date: "", note: "" },
        ],
      });
    };
    const updateReportException = (index: number, exceptionIndex: number, patch: Partial<MonitoreoStrategyReportException>) => {
      const phase = draft.strategy_phases[index];
      if (!phase) return;
      const exceptions = calendarReportExceptions(phase).map((item, itemIndex) => (
        itemIndex === exceptionIndex ? { ...item, ...patch } : item
      ));
      updatePhase(index, { ...phase, client_report_exceptions: exceptions });
    };
    const removeReportException = (index: number, exceptionIndex: number) => {
      const phase = draft.strategy_phases[index];
      if (!phase) return;
      updatePhase(index, {
        ...phase,
        client_report_exceptions: calendarReportExceptions(phase).filter((_, itemIndex) => itemIndex !== exceptionIndex),
      });
    };
    return (
      <div className="mon-acr-model mon-acr-model-config">
        {showHeader ? header : null}
        <section className="mon-contract-block mon-contract-block--wide mon-calendar-field-plan">
          <div className="mon-calendar-field-head">
            <div>
              <span>Calendario de campo</span>
              <strong>Ventanas, actor y mecanismo por semana</strong>
            </div>
            <div className="mon-calendar-field-actions">
              {!draft.strategy_phases.length && calendarActorPlans.length ? (
                <button type="button" onClick={seedCalendar}><CalendarRange size={13} /> Crear calendario base</button>
              ) : null}
              <button
                type="button"
                onClick={distributeCalendar}
                disabled={!distributedCalendar}
                title={distributedCalendar ? "Usar la primera fecha definida como ancla y completar cada fase por semana." : "Define la fecha inicio de una fase para distribuir el calendario."}
              >
                <CalendarRange size={13} /> Distribuir semanas
              </button>
              <button type="button" onClick={addPhase}><Plus size={13} /> Agregar fase</button>
            </div>
          </div>
          <div className="mon-calendar-field-summary" aria-label="Resumen del calendario de campo">
            <StatTile label="Ventana campo" value={calendarWindow} tone={draft.strategy_phases.length ? "good" : "warn"} />
            <StatTile label="Fechas campo" value={calendarDateWindow} tone={calendarDateWindow === "Por definir" ? "warn" : "good"} />
            <StatTile label="Actores" value={fmt(plannedActorCount)} tone={plannedActorCount ? "good" : "warn"} />
            <StatTile label="Mecanismos" value={fmt(activeSources.length)} tone={activeSources.length ? "good" : "neutral"} />
          </div>
          <AcreditacionFieldCalendarTimeline phases={draft.strategy_phases} />
          <datalist id="mon-acr-calendar-actors">
            {calendarActorPlans.map((plan) => <option key={plan.actor} value={plan.actor} />)}
          </datalist>
          <div className="mon-calendar-suggestion-grid" aria-label="Fases sugeridas por actor">
            {calendarActorPlans.slice(0, 6).map((plan) => (
              <article key={plan.actor} className="mon-calendar-suggestion-card">
                <header>
                  <span>{calendarWeekRangeLabel(plan.startWeek, plan.endWeek)}</span>
                  <strong>{plan.actor}</strong>
                </header>
                <div className="mon-calendar-suggestion-metrics">
                  <span><Target size={12} /> {plan.meta ? fmt(plan.meta) : "S/M"}</span>
                  <span><Route size={12} /> {MODEL_MODALITY_OPTIONS.find((option) => option.value === plan.modality)?.label ?? plan.modality}</span>
                  <span><PlugZap size={12} /> {fmt(plan.sourceCount)}</span>
                </div>
                <p>{plan.channels.length ? plan.channels.slice(0, 3).join(" · ") : "Canal por definir"}</p>
                <button type="button" onClick={() => addPhaseForPlan(plan)}>Usar fase</button>
              </article>
            ))}
            {!calendarActorPlans.length ? (
              <EmptyPanel title="Actores pendientes" detail="Configura metas o fuentes activas para armar el calendario por actor." />
            ) : null}
          </div>
          <div className="mon-calendar-phase-list">
            {draft.strategy_phases.map((phase, index) => {
              const dateStatus = calendarPhaseDateStatus(phase, index, draft.strategy_phases);
              const canUsePrevious = Boolean(draft.strategy_phases.slice(0, index).some((item) => item.end_date || item.start_date));
              const reportWeekday = normalizeCalendarReportWeekday(phase.client_report_weekday);
              const reportRows = calendarReportScheduleRows(phase);
              const reportExceptions = calendarReportExceptions(phase);
              return (
                <article key={phase.id || index} className={`mon-calendar-phase-card is-${dateStatus.state}`}>
                  <header>
                    <div className="mon-calendar-phase-title">
                      <span>{calendarWeekRangeLabel(phase.start_week, phase.end_week)}</span>
                      <strong>{phase.stratum || "Campo general"}</strong>
                    </div>
                    <div className="mon-calendar-phase-actions">
                      <span className={`mon-calendar-date-badge is-${dateStatus.state}`}>
                        <CalendarRange size={12} />
                        {dateStatus.label}
                      </span>
                      <button type="button" className="mon-icon-action" aria-label="Quitar fase" onClick={() => removePhase(index)}>
                        <XCircle size={13} />
                      </button>
                    </div>
                  </header>
                  <div className="mon-calendar-phase-date-summary">
                    <span>{dateStatus.durationLabel}</span>
                    <em>
                      {dateStatus.detail}
                      {reportWeekday ? ` · Reporte ${calendarReportWeekdayLabel(reportWeekday).toLowerCase()}` : ""}
                    </em>
                  </div>
                  <div className="mon-calendar-phase-grid">
                    <label className="mon-calendar-phase-wide">
                      <span>Corte / actor</span>
                      <input list="mon-acr-calendar-actors" value={phase.stratum} onChange={(event) => updatePhase(index, { ...phase, stratum: event.target.value })} />
                    </label>
                    <label>
                      <span>Mecanismo</span>
                      <select value={phase.modality} onChange={(event) => updatePhase(index, { ...phase, modality: event.target.value as MonitoreoStrategyPhase["modality"] })}>
                        {MODEL_MODALITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Semana campo inicio</span>
                      <input
                        type="number"
                        min={1}
                        value={phase.start_week ?? ""}
                        onChange={(event) => {
                          const startWeek = event.target.value ? Number(event.target.value) : null;
                          const endWeek = startWeek && phase.end_week && phase.end_week < startWeek ? startWeek : phase.end_week;
                          updatePhase(index, { ...phase, start_week: startWeek, end_week: endWeek });
                        }}
                      />
                    </label>
                    <label>
                      <span>Semana campo fin</span>
                      <input
                        type="number"
                        min={1}
                        value={phase.end_week ?? ""}
                        onChange={(event) => {
                          const rawEndWeek = event.target.value ? Number(event.target.value) : null;
                          const endWeek = rawEndWeek && phase.start_week && rawEndWeek < phase.start_week ? phase.start_week : rawEndWeek;
                          updatePhase(index, { ...phase, end_week: endWeek });
                        }}
                      />
                    </label>
                    <div className="mon-calendar-date-editor mon-calendar-phase-wide">
                      <label>
                        <span>Fecha campo inicio</span>
                        <input
                          type="date"
                          value={phase.start_date ?? ""}
                          onChange={(event) => {
                            const startDate = event.target.value;
                            const endDate = startDate && phase.end_date && phase.end_date < startDate ? startDate : (phase.end_date || startDate);
                            updatePhase(index, { ...phase, start_date: startDate, end_date: endDate });
                          }}
                        />
                      </label>
                      <label>
                        <span>Fecha campo fin</span>
                        <input
                          type="date"
                          min={phase.start_date || undefined}
                          value={phase.end_date ?? ""}
                          onChange={(event) => {
                            const rawEndDate = event.target.value;
                            const endDate = rawEndDate && phase.start_date && rawEndDate < phase.start_date ? phase.start_date : rawEndDate;
                            updatePhase(index, { ...phase, end_date: endDate });
                          }}
                        />
                      </label>
                      <div className="mon-calendar-date-quick" aria-label={`Atajos de fecha para ${phase.stratum || `fase ${index + 1}`}`}>
                        <button type="button" onClick={() => setPhaseDuration(index, 1)} disabled={!phase.start_date}>1 día</button>
                        <button type="button" onClick={() => setPhaseDuration(index, 3)} disabled={!phase.start_date}>3 días</button>
                        <button type="button" onClick={() => setPhaseDuration(index, 7)} disabled={!phase.start_date}>7 días</button>
                        <button type="button" onClick={() => alignPhaseAfterPrevious(index)} disabled={!canUsePrevious}>Desde anterior</button>
                      </div>
                    </div>
                    <div className="mon-calendar-report-editor mon-calendar-phase-wide">
                      <div className="mon-calendar-report-rule">
                        <label>
                          <span>Reporte al cliente</span>
                          <select
                            value={reportWeekday}
                            onChange={(event) => updatePhase(index, {
                              ...phase,
                              client_report_weekday: event.target.value as MonitoreoReportWeekday | "",
                            })}
                          >
                            <option value="">Sin cadencia semanal</option>
                            {CALENDAR_REPORT_WEEKDAYS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                        <button type="button" onClick={() => addReportException(index)}>
                          <Plus size={12} />
                          Agregar excepción
                        </button>
                      </div>
                      {reportRows.length ? (
                        <div className="mon-calendar-report-preview" aria-label={`Fechas de reporte al cliente para ${phase.stratum || `fase ${index + 1}`}`}>
                          {reportRows.slice(0, 6).map((row) => (
                            <span key={row.key} className={row.isException ? "is-exception" : ""}>
                              <strong>{row.week ? `S${fmt(row.week)}` : "Extra"}</strong>
                              <em>{row.label}</em>
                              <small>{calendarReportWeekdayLabel(row.weekday)}</small>
                            </span>
                          ))}
                          {reportRows.length > 6 ? <span><strong>+{fmt(reportRows.length - 6)}</strong><em>más</em><small>reporte</small></span> : null}
                        </div>
                      ) : (
                        <p className="mon-calendar-report-empty">Define un día semanal o una excepción para programar reportes al cliente.</p>
                      )}
                      {reportExceptions.length ? (
                        <div className="mon-calendar-report-exceptions" aria-label={`Excepciones de reporte al cliente para ${phase.stratum || `fase ${index + 1}`}`}>
                          {reportExceptions.map((exception, exceptionIndex) => (
                            <article key={`${exception.week ?? "extra"}-${exceptionIndex}`}>
                              <label>
                                <span>Semana</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={exception.week ?? ""}
                                  onChange={(event) => updateReportException(index, exceptionIndex, {
                                    week: event.target.value ? Number(event.target.value) : null,
                                  })}
                                />
                              </label>
                              <label>
                                <span>Día excepción</span>
                                <select
                                  value={normalizeCalendarReportWeekday(exception.weekday)}
                                  onChange={(event) => updateReportException(index, exceptionIndex, {
                                    weekday: event.target.value as MonitoreoReportWeekday | "",
                                  })}
                                >
                                  <option value="">Sin día</option>
                                  {CALENDAR_REPORT_WEEKDAYS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                <span>Fecha fija</span>
                                <input
                                  type="date"
                                  value={exception.date ?? ""}
                                  onChange={(event) => updateReportException(index, exceptionIndex, { date: event.target.value })}
                                />
                              </label>
                              <label className="mon-calendar-report-exception-note">
                                <span>Motivo</span>
                                <input
                                  value={exception.note ?? ""}
                                  onChange={(event) => updateReportException(index, exceptionIndex, { note: event.target.value })}
                                  placeholder="ej. feriado, comité, cierre"
                                />
                              </label>
                              <button type="button" className="mon-icon-action" aria-label="Quitar excepción" onClick={() => removeReportException(index, exceptionIndex)}>
                                <XCircle size={13} />
                              </button>
                            </article>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <label className="mon-calendar-phase-wide">
                      <span>Regla objetivo</span>
                      <input value={phase.target_rule} onChange={(event) => updatePhase(index, { ...phase, target_rule: event.target.value })} placeholder="ej. completar meta del actor" />
                    </label>
                    <label className="mon-calendar-phase-wide">
                      <span>Foco KPI</span>
                      <input
                        value={phase.kpi_focus.join(", ")}
                        onChange={(event) => updatePhase(index, { ...phase, kpi_focus: splitCalendarTokens(event.target.value) })}
                        placeholder="meta actor, avance efectivo, faltantes"
                      />
                    </label>
                  </div>
                </article>
              );
            })}
            {!draft.strategy_phases.length ? <EmptyPanel title="Sin fases guardadas" detail="El calendario base se arma desde actores, metas y fuentes activas." /> : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mon-acr-model mon-acr-model-config">
      {showHeader ? header : null}
      <section className="mon-contract-block mon-contract-block--wide">
        <div className="mon-contract-block-head">
          <span>Cortes, metas y variables</span>
          <span className="mon-contract-counter">{fmt(configuredGoals)}/{fmt(draft.goals.length)} metas · total {goalTotal ? fmt(goalTotal) : "S/M"}</span>
        </div>
        <div className="mon-form mon-form--two">
          <AcreditacionVarSelect label="Enumerador" value={draft.enumerator_var} vars={variableNames} onChange={(enumerator_var) => patchConfig({ enumerator_var })} />
          <AcreditacionVarSelect label="Fecha" value={draft.date_var} vars={variableNames} onChange={(date_var) => patchConfig({ date_var })} />
          <AcreditacionVarSelect label="Estado" value={draft.status_var} vars={variableNames} onChange={(status_var) => patchConfig({ status_var })} />
          <AcreditacionVarSelect label="Duración" value={draft.duration_var} vars={variableNames} onChange={(duration_var) => patchConfig({ duration_var })} />
          <AcreditacionVarSelect label="ID" value={draft.id_var} vars={variableNames} onChange={(id_var) => patchConfig({ id_var })} />
          <AcreditacionVarSelect label="Contacto" value={draft.contact_var} vars={variableNames} onChange={(contact_var) => patchConfig({ contact_var })} />
          <label>
            <span>Meta total</span>
            <input
              type="number"
              min={0}
              value={draft.objetivo_total ?? ""}
              onChange={(event) => patchConfig({ objetivo_total: event.target.value ? Number(event.target.value) : null })}
            />
          </label>
          <AcreditacionValuePicker label="Estados válidos" options={statusOptions} values={draft.valid_statuses} onChange={(valid_statuses) => patchConfig({ valid_statuses })} />
        </div>
        <div className="mon-profile-grid">
          <AcreditacionVariableChipPicker label="Variables de corte / estrato" vars={variableNames} selected={draft.control_vars} onChange={(control_vars) => patchConfig({ control_vars })} />
          <AcreditacionVariableChipPicker label="Campos críticos" vars={variableNames} selected={draft.critical_vars} onChange={(critical_vars) => patchConfig({ critical_vars })} />
        </div>
      </section>
      {showPhoneQuotaEditor ? (
        <AcreditacionPhoneQuotaEditor
          draft={draft}
          variables={variables}
          platformSources={sources.filter(isKoboResponseSource)}
          quotaRows={phoneQuotaReportRows}
          onPatchConfig={patchConfig}
        />
      ) : null}
      <section className="mon-contract-block mon-contract-block--wide">
        <div className="mon-contract-block-head">
          <span>Metas por corte / estrato</span>
          <button type="button" onClick={addGoal}><Plus size={13} /> Agregar meta</button>
        </div>
        <AcreditacionGoalsEditor goals={draft.goals} vars={variableNames} onUpdate={updateGoal} onRemove={removeGoal} />
      </section>
    </div>
  );
}

function AcreditacionSweepBaseWorkbench({
  sources,
  config,
  cases,
  variableNames,
  onCasesChange,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  config: MonitoreoConfig;
  cases: MonitoreoConfig["operational_model"]["cases"];
  variableNames: string[];
  onCasesChange: (patch: Partial<MonitoreoConfig["operational_model"]["cases"]>) => void;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const [selectedByChannel, setSelectedByChannel] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState("");
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);
  const sweepPreset = ACREDITACION_SOURCE_PRESETS.find((preset) => preset.key === "barrido_telefonico") ?? ACREDITACION_SOURCE_PRESETS[1];
  const telephoneChannels = useMemo(
    () => buildAcreditacionTelephoneChannels(sources, config.operational_model.link_collectors),
    [config.operational_model.link_collectors, sources],
  );
  const sweepSourceCandidates = useMemo(() => acreditacionSweepSources(sources), [sources]);
  const selectableSweepSources = sweepSourceCandidates.filter((source) => source.enabled);
  const confirmedChannels = telephoneChannels.filter((channel) => (
    Boolean(acreditacionSweepSourceForChannel(sweepSourceCandidates, channel))
  ));
  const sourceOptions = selectableSweepSources.length ? selectableSweepSources : sweepSourceCandidates;

  const confirmSweepBase = async (channel: AcreditacionTelephoneChannel) => {
    const matched = acreditacionSweepSourceForChannel(sweepSourceCandidates, channel);
    const sourceId = selectedByChannel[channel.key] ?? matched?.id ?? "";
    const source = sweepSourceCandidates.find((item) => item.id === sourceId) ?? null;
    if (!source) {
      setStatus({ tone: "error", message: "Selecciona o registra una hoja de barrido antes de confirmar." });
      return;
    }
    setSavingKey(channel.key);
    setStatus({ tone: "info", message: `Confirmando barrido para ${channel.actor}...` });
    try {
      const result = await apiMonitoreoSource(sourcePayloadFromExisting(source, {
        enabled: true,
        role: "barrido",
        integration_mode: source.integration_mode || "connected_read",
        dimensions: cleanSourceDimensions({
          ...source.dimensions,
          actor: channel.actor,
          segmento: channel.actor,
          canal: "Telefónico",
          channel: "Telefónico",
          servicio: "Barrido telefónico",
          sheet_name: source.sheet_binding?.sheet_name ?? source.dimensions?.sheet_name,
          survey_id: channel.surveyId || undefined,
          survey_source_id: channel.sourceId || undefined,
          source_id: channel.sourceId || undefined,
          collector_id: channel.collectorId || undefined,
          collector_name: channel.collectorName || undefined,
        }),
      }));
      onStateChange?.(result.state);
      setSelectedByChannel((current) => ({ ...current, [channel.key]: result.source.id }));
      onCasesChange({ enabled: true, roster_source: "external_local" });
      setStatus({ tone: "success", message: `Base de barrido confirmada para ${channel.actor}.` });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setSavingKey("");
    }
  };

  return (
    <>
      <section className="mon-contract-block mon-contract-block--wide">
        <div className="mon-contract-block-head">
          <span>Base de barrido</span>
          <label className="mon-switch-line">
            <input
              type="checkbox"
              checked={Boolean(cases.enabled)}
              onChange={(event) => onCasesChange({ enabled: event.target.checked })}
            />
            <span>Usar barrido operativo</span>
          </label>
        </div>
        <div className="mon-acr-active-kpis" aria-label="Resumen de base de barrido">
          <StatTile label="Canales telefónicos" value={fmt(telephoneChannels.length)} tone={telephoneChannels.length ? "good" : "warn"} />
          <StatTile label="Bases de barrido" value={fmt(sweepSourceCandidates.length)} tone={sweepSourceCandidates.length ? "good" : "warn"} />
          <StatTile label="Confirmadas" value={`${fmt(confirmedChannels.length)}/${fmt(telephoneChannels.length)}`} tone={telephoneChannels.length && confirmedChannels.length === telephoneChannels.length ? "good" : "warn"} />
        </div>
        <p className="mon-profile-muted">
          Los canales telefónicos salen de Enlaces y envíos. La base de barrido se confirma contra una fuente Google Sheets con rol barrido para que el modelo sepa qué hoja alimenta responsables, intentos y estados.
        </p>
        {status ? <div className={status.tone === "error" ? "mon-sm-error" : "mon-sm-meta"}>{status.message}</div> : null}
        <div className="mon-profile-grid">
          <AcreditacionSheetSourceEditor preset={sweepPreset} sources={sweepSourceCandidates} onStateChange={onStateChange} />
          <section className="mon-profile-panel">
            <div className="mon-profile-panel-head">
              <h3>Campos operativos</h3>
              <span>{cases.enabled ? "Activo" : "Pendiente"}</span>
            </div>
            <div className="mon-form mon-form--two">
              <AcreditacionVarSelect label="Identificador" value={cases.case_id_var} vars={variableNames} onChange={(value) => onCasesChange({ case_id_var: value })} />
              <AcreditacionVarSelect label="Persona o caso" value={cases.person_label_var} vars={variableNames} onChange={(value) => onCasesChange({ person_label_var: value })} />
              <AcreditacionVarSelect label="Estado reportado" value={cases.status_var} vars={variableNames} onChange={(value) => onCasesChange({ status_var: value })} />
              <label>
                <span>Origen del barrido</span>
                <select
                  value={cases.roster_source}
                  onChange={(event) => onCasesChange({ roster_source: event.target.value as MonitoreoConfig["operational_model"]["cases"]["roster_source"] })}
                >
                  {MODEL_ROSTER_SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
            <div className="mon-profile-grid">
              <AcreditacionVariableChipPicker label="Campos de contacto" vars={variableNames} selected={cases.contact_vars} onChange={(contact_vars) => onCasesChange({ contact_vars })} />
              <AcreditacionVariableChipPicker label="Campos sensibles" vars={variableNames} selected={cases.sensitive_vars} onChange={(sensitive_vars) => onCasesChange({ sensitive_vars })} />
            </div>
          </section>
        </div>
      </section>
      <section className="mon-contract-block mon-contract-block--wide mon-channel-selector-matrix" aria-label="Canales telefónicos con base de barrido">
        <div className="mon-contract-block-head">
          <span>Canales telefónicos definidos en Enlaces y envíos</span>
          <span className="mon-contract-counter">{fmt(confirmedChannels.length)} confirmados</span>
        </div>
        {!telephoneChannels.length ? (
          <EmptyPanel title="Sin canales telefónicos" detail="Clasifica al menos un recopilador como Teléfono asistido o Barrido en Enlaces y envíos." />
        ) : (
          <div className="mon-collector-list">
            {telephoneChannels.map((channel) => {
              const matched = acreditacionSweepSourceForChannel(sweepSourceCandidates, channel);
              const selectedId = selectedByChannel[channel.key] ?? matched?.id ?? "";
              const selectedSource = sourceOptions.find((source) => source.id === selectedId) ?? matched ?? null;
              const dimensions = sourceDimensionEntries(selectedSource?.dimensions).slice(0, 5);
              return (
                <article key={channel.key} className={`mon-collector-card mon-collector-card--channel is-${matched ? "telefono" : "mixto"}`}>
                  <div className="mon-collector-title">
                    <span className="mon-collector-use-icon"><PhoneCall size={14} /></span>
                    <div>
                      <strong>{channel.actor}</strong>
                      <em>{channel.collectorName} · {channel.sourceName}</em>
                    </div>
                    <span className="mon-collector-chip">{matched ? "Base confirmada" : "Por confirmar"}</span>
                  </div>
                  <div className="mon-collector-metrics">
                    <AcreditacionCollectorMetric label="Respuestas" value={channel.responseCount} tone={channel.responseCount ? "ready" : "neutral"} />
                    <AcreditacionCollectorMetric label="Barrido" value={matched ? 1 : 0} tone={matched ? "ready" : "warning"} />
                    <AcreditacionCollectorMetric label="Hoja" value={selectedSource?.sheet_binding?.sheet_name ? 1 : 0} tone={selectedSource?.sheet_binding?.sheet_name ? "ready" : "neutral"} />
                  </div>
                  <div className="mon-collector-controls mon-collector-controls--channel">
                    <label>
                      <span>Base de barrido</span>
                      <select
                        value={selectedId}
                        onChange={(event) => setSelectedByChannel((current) => ({ ...current, [channel.key]: event.currentTarget.value }))}
                        disabled={Boolean(savingKey)}
                      >
                        <option value="">Sin base confirmada</option>
                        {sourceOptions.map((source) => (
                          <option key={source.id} value={source.id}>
                            {[source.label || source.id, source.sheet_binding?.sheet_name, sourceActorLabel(source)].filter(Boolean).join(" · ")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="pulso-primary"
                      onClick={() => { void confirmSweepBase(channel); }}
                      disabled={savingKey === channel.key || !selectedId}
                    >
                      {savingKey === channel.key ? <Loader2 size={13} className="pulso-spin" /> : <CheckCircle2 size={13} />}
                      Confirmar selección
                    </button>
                  </div>
                  <div className="mon-collector-channel-line">
                    <AcreditacionChannelBadge channel={channel.channel} />
                    <span>{channel.collectorId || channel.sourceId} · {channel.collectorType}</span>
                  </div>
                  {selectedSource ? (
                    <div className="mon-source-dim-badges">
                      <span>{selectedSource.sheet_binding?.sheet_name || "Pestaña pendiente"}</span>
                      {sourceSpreadsheetUrl(selectedSource) ? (
                        <a href={sourceSpreadsheetUrl(selectedSource)} target="_blank" rel="noreferrer">
                          {sourceSpreadsheetDisplay(selectedSource)}
                        </a>
                      ) : null}
                      {dimensions.map(([key, value]) => <span key={`${channel.key}-${key}`}>{dimensionLabel(key)}: {value}</span>)}
                    </div>
                  ) : (
                    <div className="mon-sm-empty">Registra una hoja de barrido arriba para asociarla a este canal.</div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

function AcreditacionVarSelect({ label, value, vars, onChange }: { label: string; value: string; vars: string[]; onChange: (value: string) => void }) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Sin asignar</option>
        {vars.map((variable) => <option key={variable} value={variable}>{variable}</option>)}
      </select>
    </label>
  );
}

function AcreditacionVariableChipPicker({
  label,
  vars,
  selected,
  onChange,
}: {
  label: string;
  vars: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const available = vars.filter((variable) => !selected.includes(variable));
  return (
    <div className="mon-token-picker">
      <span>{label}</span>
      <select value="" onChange={(event) => event.target.value && onChange([...selected, event.target.value])}>
        <option value="">{available.length ? "Agregar variable..." : "Sin variables disponibles"}</option>
        {available.map((variable) => <option key={variable} value={variable}>{variable}</option>)}
      </select>
      <div className="mon-token-list">
        {selected.length ? selected.map((variable) => (
          <button key={variable} type="button" onClick={() => onChange(selected.filter((item) => item !== variable))}>
            {variable}
            <XCircle size={12} />
          </button>
        )) : <span className="mon-muted-chip">Sin variables seleccionadas</span>}
      </div>
    </div>
  );
}

function AcreditacionValuePicker({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const available = options.filter((option) => option && !values.includes(option));
  return (
    <div className="mon-token-picker mon-row-span">
      <span>{label}</span>
      <select value="" onChange={(event) => event.target.value && onChange([...values, event.target.value])}>
        <option value="">{available.length ? "Agregar estado..." : "Sin estados disponibles"}</option>
        {available.map((option) => <option key={option} value={option}>{prettyModelLabel(option)}</option>)}
      </select>
      <div className="mon-token-list">
        {values.length ? values.map((value) => (
          <button key={value} type="button" onClick={() => onChange(values.filter((item) => item !== value))}>
            {prettyModelLabel(value)}
            <XCircle size={12} />
          </button>
        )) : <span className="mon-muted-chip">Sin estados seleccionados</span>}
      </div>
    </div>
  );
}

function AcreditacionGoalsEditor({
  goals,
  vars,
  onUpdate,
  onRemove,
}: {
  goals: MonitoreoGoal[];
  vars: string[];
  onUpdate: (index: number, goal: MonitoreoGoal) => void;
  onRemove: (index: number) => void;
}) {
  if (!goals.length) {
    return <EmptyPanel title="Sin metas por corte" detail="Agrega metas para que el modelo pueda calcular brechas contra actor, carrera o segmento." />;
  }
  return (
    <div className="mon-goals">
      <div className="mon-goal-row mon-goal-row--head" aria-hidden="true">
        <span>Variable</span>
        <span>Valor</span>
        <span>Meta</span>
        <span />
      </div>
      {goals.map((goal, index) => {
        const key = Object.keys(goal.filters ?? {})[0] ?? "";
        const value = key ? String(goal.filters[key] ?? "") : "";
        return (
          <div key={index} className="mon-goal-row">
            <select
              value={key}
              onChange={(event) => {
                const nextKey = event.target.value;
                onUpdate(index, { ...goal, filters: nextKey ? { [nextKey]: value } : {} });
              }}
            >
              <option value="">Variable</option>
              {vars.map((variable) => <option key={variable} value={variable}>{variable}</option>)}
            </select>
            <input
              value={value}
              onChange={(event) => key && onUpdate(index, { ...goal, filters: { [key]: event.target.value } })}
              placeholder="valor"
            />
            <input
              type="number"
              min={0}
              value={goal.meta ?? 0}
              onChange={(event) => onUpdate(index, { ...goal, meta: Math.max(0, Number(event.target.value) || 0) })}
            />
            <button type="button" aria-label="Quitar meta" onClick={() => onRemove(index)}>
              <XCircle size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function AcreditacionEventsEditor({
  events,
  onChange,
}: {
  events: MonitoreoConfig["operational_model"]["events"];
  onChange: (next: MonitoreoConfig["operational_model"]["events"]) => void;
}) {
  const update = (index: number, patch: Partial<MonitoreoConfig["operational_model"]["events"][number]>) => {
    onChange(events.map((event, itemIndex) => itemIndex === index ? { ...event, ...patch } : event));
  };
  return (
    <section className="mon-profile-panel">
      <div className="mon-profile-panel-head">
        <h3>Eventos operativos</h3>
        <button type="button" onClick={() => onChange([...events, {
          id: `evento-${Date.now()}`,
          label: "Completa",
          modality: "email",
          outcome: "completed",
          counts_attempt: true,
          counts_contact: true,
          counts_complete: true,
          stop_contact: true,
        }])}>
          <Plus size={13} /> Agregar
        </button>
      </div>
      <div className="mon-contract-list">
        {events.map((event, index) => (
          <article key={event.id || index} className="mon-event-row">
            <label><span>Evento</span><input value={event.label} onChange={(e) => update(index, { label: e.target.value })} /></label>
            <label>
              <span>Modalidad</span>
              <select value={event.modality} onChange={(e) => update(index, { modality: e.target.value as MonitoreoStrategyPhase["modality"] })}>
                {MODEL_MODALITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label><span>Resultado</span><input value={event.outcome} onChange={(e) => update(index, { outcome: e.target.value })} /></label>
            <label className="mon-switch-line"><input type="checkbox" checked={event.counts_complete} onChange={(e) => update(index, { counts_complete: e.target.checked })} /><span>Completa</span></label>
          </article>
        ))}
        {!events.length ? <p className="mon-profile-muted">Sin eventos configurados.</p> : null}
      </div>
    </section>
  );
}

function AcreditacionStateRulesEditor({
  rules,
  eventValues,
  onChange,
}: {
  rules: MonitoreoConfig["operational_model"]["state_rules"];
  eventValues: string[];
  onChange: (next: MonitoreoConfig["operational_model"]["state_rules"]) => void;
}) {
  const update = (index: number, patch: Partial<MonitoreoConfig["operational_model"]["state_rules"][number]>) => {
    onChange(rules.map((rule, itemIndex) => itemIndex === index ? { ...rule, ...patch } : rule));
  };
  return (
    <section className="mon-profile-panel">
      <div className="mon-profile-panel-head">
        <h3>Reglas de estado final</h3>
        <button type="button" onClick={() => onChange([...rules, {
          id: `regla-${Date.now()}`,
          label: "Completa válida",
          final_state: "complete",
          priority: rules.length + 1,
          outcome_values: eventValues[0] ? [eventValues[0]] : ["completed"],
          stop_contact: true,
        }])}>
          <Plus size={13} /> Agregar
        </button>
      </div>
      <div className="mon-contract-list">
        {rules.map((rule, index) => (
          <article key={rule.id || index} className="mon-rule-row">
            <label><span>Regla</span><input value={rule.label} onChange={(e) => update(index, { label: e.target.value })} /></label>
            <label>
              <span>Estado final</span>
              <select value={rule.final_state} onChange={(e) => update(index, { final_state: e.target.value })}>
                {MODEL_FINAL_STATE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label><span>Prioridad</span><input type="number" min={1} value={rule.priority} onChange={(e) => update(index, { priority: Number(e.target.value) || index + 1 })} /></label>
            <AcreditacionValuePicker
              label="Valores resultado"
              options={Array.from(new Set([...eventValues, ...rule.outcome_values, "completed", "valid", "approved", "rechazo", "rejected"]))}
              values={rule.outcome_values}
              onChange={(outcome_values) => update(index, { outcome_values })}
            />
          </article>
        ))}
        {!rules.length ? <p className="mon-profile-muted">Sin reglas de avance configuradas.</p> : null}
      </div>
    </section>
  );
}

function statusValueOptions(variables: MonitoreoVariable[], statusVar: string, current: string[]) {
  const variableValues = variables.find((variable) => variable.name === statusVar)?.values ?? [];
  return Array.from(new Set([
    ...current,
    ...variableValues,
    "completed",
    "complete",
    "valid",
    "approved",
    "submitted",
    "rechazo",
    "rejected",
    "partial",
  ].map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function preferredGoalVariable(vars: string[]) {
  return vars.find((variable) => normalizeSourceMatch(variable).includes("actor"))
    ?? vars.find((variable) => normalizeSourceMatch(variable).includes("carrera"))
    ?? vars.find((variable) => normalizeSourceMatch(variable).includes("segment"))
    ?? vars[0]
    ?? "";
}

function prettyModelLabel(value: string) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\bcompleted\b/i, "Completa")
    .replace(/\bapproved\b/i, "Aprobada")
    .replace(/\brejected\b/i, "Rechazo")
    .replace(/\bpartial\b/i, "Parcial");
}

function scopeForView(view: WorkbenchView, family?: string): MonitoreoReportScope {
  if (view === "telefonico") return "phone_summary";
  if (view === "modelo" && family === "telefonico") return "phone_summary";
  if (view === "consultas") return "queries_summary";
  if (view === "modelo") return "advance_summary";
  if (view === "fuentes") return "source";
  return "advance_summary";
}

const ACREDITACION_BACKGROUND_SCOPES: MonitoreoReportScope[] = [
  "source",
  "advance_summary",
  "queries_summary",
  "phone_summary",
];

function reportsFromState(state: MonitoreoState | null) {
  return normalizeAcreditacionReports(state?.dashboard?.acreditacion_reports ?? null);
}

function normalizeAcreditacionReports(reports: MonitoreoAcreditacionReports | null | undefined): MonitoreoAcreditacionReports | null {
  if (!reports) return null;
  const client = reports.client_report ?? null;
  return {
    ...reports,
    schema: reports.schema || "apps_script_acreditacion_v1",
    generated_at: reports.generated_at || "",
    reference_tabs: Array.isArray(reports.reference_tabs) ? reports.reference_tabs : [],
    internal_queries: reports.internal_queries ?? null,
    client_report: client
      ? {
        ...client,
        summary: Array.isArray(client.summary) ? client.summary : [],
        actors: Array.isArray(client.actors) ? client.actors : [],
        daily_general: Array.isArray(client.daily_general) ? client.daily_general : [],
        daily_actor: Array.isArray(client.daily_actor) ? client.daily_actor : [],
        sources: Array.isArray(client.sources) ? client.sources : [],
        collector_sources: Array.isArray(client.collector_sources) ? client.collector_sources : [],
        controls: Array.isArray(client.controls) ? client.controls : [],
        sheets: Array.isArray(client.sheets) ? client.sheets : [],
      }
      : null,
    sheets: Array.isArray(reports.sheets) ? reports.sheets : [],
  };
}

function rowValue(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Si" : "No";
  return String(value);
}

function compactColumns(rows: Array<Record<string, unknown>>, preferred: string[] = [], maxColumns = 8) {
  const seen = new Set<string>();
  const keys = [...preferred, ...rows.flatMap((row) => Object.keys(row))]
    .filter((key) => key && !key.startsWith("_") && !seen.has(key) && (seen.add(key), true));
  return keys.slice(0, maxColumns);
}

function rowsFromSheets(sheets: MonitoreoReportSheet[] = [], terms: string[] = []) {
  const filters = terms.map((term) => term.toLowerCase());
  return sheets.flatMap((sheet) => (
    sheet.blocks.flatMap((block) => {
      const haystack = `${sheet.id} ${sheet.title} ${block.id} ${block.title}`.toLowerCase();
      if (filters.length && !filters.some((term) => haystack.includes(term))) return [];
      return block.rows.map((row) => ({
        _sheet: sheet.title,
        _block: block.title,
        ...row,
      }));
    })
  ));
}

function rowsForSheetBlock(
  reports: MonitoreoAcreditacionReports,
  sheetId: string,
  blockIds: string[] = [],
) {
  const sheet = reports.sheets.find((item) => item.id === sheetId) ?? null;
  if (!sheet) return [];
  const wanted = new Set(blockIds.map((id) => id.toLowerCase()));
  return sheet.blocks.flatMap((block) => {
    if (wanted.size && !wanted.has(String(block.id).toLowerCase())) return [];
    return block.rows.map((row) => ({
      _block: block.title,
      ...row,
    }));
  }) as Array<Record<string, unknown>>;
}

function phoneRowValue(row: Record<string, unknown>, keys: string[], fallback = "") {
  return rowText(row, keys, fallback).trim();
}

function phoneRowNumber(row: Record<string, unknown>, keys: string[], fallback = 0) {
  return rowNumber(row, keys, fallback);
}

function phoneRowOptionalNumber(row: Record<string, unknown>, keys: string[]) {
  const value = rowNumber(row, keys, Number.NaN);
  return Number.isFinite(value) ? value : null;
}

function phoneRowRatioPct(row: Record<string, unknown>, keys: string[]) {
  const value = phoneRowOptionalNumber(row, keys);
  if (value == null) return null;
  return Math.abs(value) <= 1 ? value * 100 : value;
}

function phoneQuotaVariableLabel(value: string) {
  const raw = String(value ?? "").trim();
  const cleaned = raw
    .replace(/^(dim|dimension|variable|var|control)[_\s-]+/i, "")
    .trim();
  return humanizeQuestionSlug(cleaned || raw || "Variable");
}

function phoneSummaryValue(rows: Array<Record<string, unknown>>, labelNeedle: string) {
  const wanted = normalizeSourceMatch(labelNeedle);
  const row = rows.find((item) => normalizeSourceMatch(phoneRowValue(item, ["Indicador", "Metrica", "Métrica", "Variable"])).includes(wanted));
  if (!row) return null;
  const value = rowNumber(row, ["Valor", "Casos", "Total"], NaN);
  return Number.isFinite(value) ? value : null;
}

function phonePercentLabel(value: number | null | undefined) {
  return formatPercentLabel(value);
}

function phoneStatusTone(label: string): "good" | "warn" | "risk" | "unswept" | "muted" {
  const key = normalizeSourceMatch(label);
  if (key.includes("por barrer") || key.includes("no barrido") || key.includes("pendiente")) return "unswept";
  if (key.includes("efectiv") || key.includes("complet") || key.includes("contactado")) return "good";
  if (key.includes("no contesta") || key.includes("insistencia") || key.includes("reintento")) return "warn";
  if (key.includes("rechazo") || key.includes("fall") || key.includes("observ")) return "risk";
  return "muted";
}

function phoneStatusPalette(label: string) {
  const tone = phoneStatusTone(label);
  if (tone === "good") return { color: "#168a55", highlight: "#31c783" };
  if (tone === "warn") return { color: "#b97611", highlight: "#e0a329" };
  if (tone === "risk") return { color: "#a61d4f", highlight: "#d24c79" };
  if (tone === "unswept") return { color: "#94a3b8", highlight: "#d9e2ec" };
  return { color: "#5e7fa5", highlight: "#8fb1d3" };
}

function phoneLooksLikeTechnicalSourceLabel(value: string) {
  const key = normalizeSourceMatch(value);
  if (!key) return false;
  return (
    key.includes("base de barrido")
    || key.includes("base barrido")
    || key.includes("barrido telefon")
    || key.includes("_base")
    || key.includes("_pdm")
    || key.includes("spreadsheet")
    || key.includes("google sheets")
    || key.includes("kobotoolbox")
    || key.includes("surveymonkey")
    || /^\d+[_-]/.test(key)
  );
}

function phoneCleanResponsibleDisplayName(value: string) {
  const parts = value.split(/\s+·\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1 && phoneLooksLikeTechnicalSourceLabel(parts[parts.length - 1])) {
    return parts.slice(0, -1).join(" · ");
  }
  return value;
}

function phoneResponsibleBaseName(row: Record<string, unknown>, index = 0) {
  const raw = phoneRowValue(row, ["Responsable", "Encuestador", "Owner"], "") || `Responsable ${index + 1}`;
  return phoneCleanResponsibleDisplayName(raw);
}

function phoneResponsibleActorName(row: Record<string, unknown>) {
  const actor = phoneRowValue(row, ["Actor", "Unidad"], "");
  const actorKey = normalizeSourceMatch(actor);
  if (phoneLooksLikeTechnicalSourceLabel(actor)) return "";
  return actorKey && !actorKey.includes("sin actor") ? actor : "";
}

function phoneResponsibleName(row: Record<string, unknown>, index = 0) {
  const base = phoneResponsibleBaseName(row, index);
  const actor = phoneResponsibleActorName(row);
  const actorKey = normalizeSourceMatch(actor);
  if (actorKey && !actorKey.includes("sin actor") && normalizeSourceMatch(base) !== actorKey) return `${base} · ${actor}`;
  return base;
}

function phoneIsUnassignedResponsible(value: string) {
  const key = normalizeSourceMatch(value);
  return !key || key.includes("sin responsable") || key.includes("sin asignar") || key.includes("no asignad");
}

function phoneResponsibleMetrics(row: Record<string, unknown>) {
  const assigned = phoneRowNumber(row, ["Casos asignados", "Total telefonico", "Total telefónico", "Asignados"], NaN);
  const unswept = phoneRowNumber(row, ["No barridos", "Por barrer"], NaN);
  const swept = phoneRowNumber(row, ["Barridos", "Casos barridos"], Number.isFinite(assigned) && Number.isFinite(unswept) ? Math.max(0, assigned - unswept) : NaN);
  const effective = phoneRowNumber(row, ["Efectivas", "Completas", "Completas telefonicas", "Completas telefónicas"], 0);
  const nonEffective = phoneRowNumber(row, ["Sin efectiva", "No efectivas", "Barridos sin efectiva", "Incidencias", "Incid."], Number.isFinite(swept) ? Math.max(0, swept - effective) : NaN);
  const denominator = Math.max(1, Number.isFinite(assigned) ? assigned : effective + (Number.isFinite(nonEffective) ? nonEffective : 0) + (Number.isFinite(unswept) ? unswept : 0));
  const incidencePct = phoneRowRatioPct(row, ["Ratio incidencias", "% sin efectiva", "Ratio sin efectiva"])
    ?? (Number.isFinite(nonEffective) && Number.isFinite(swept) ? safePercentValue(nonEffective, swept) : null);
  return {
    assigned: Number.isFinite(assigned) ? assigned : null,
    swept: Number.isFinite(swept) ? swept : null,
    unswept: Number.isFinite(unswept) ? unswept : null,
    effective,
    nonEffective: Number.isFinite(nonEffective) ? nonEffective : null,
    incidencePct,
    denominator,
  };
}

const ACREDITACION_PHONE_SUPERVISION_SAMPLE_RATE = 0.3;

type AcreditacionPhoneSupervisionControlRow = {
  key: string;
  responsible: string;
  actor: string;
  effective: number;
  target: number;
  observed: number;
  gap: number;
  coveragePct: number | null;
  priorityCases: number;
  source: "read" | "proposed";
};

export type AcreditacionPhoneSupervisionControlPlan = {
  hasReadBase: boolean;
  rows: AcreditacionPhoneSupervisionControlRow[];
  tableRows: Array<Record<string, unknown>>;
  exportRows: Array<Record<string, unknown>>;
  totalEffective: number;
  targetTotal: number;
  observedTotal: number;
  selectedTotal: number;
  gapTotal: number;
  coveragePct: number | null;
};

type AcreditacionPhoneTimeBucketKey = "under2" | "under5" | "normal";

type AcreditacionPhoneTimeBucket = {
  key: AcreditacionPhoneTimeBucketKey;
  label: string;
  hint: string;
  count: number;
  percent: number;
  tone: AcreditacionQualityAlertTone;
};

export type AcreditacionPhoneTimeControlModel = {
  totalEffective: number;
  flaggedTotal: number;
  under2: number;
  under5: number;
  normal: number;
  buckets: AcreditacionPhoneTimeBucket[];
  alerts: AcreditacionQualityAlertItem[];
};

export function buildAcreditacionPhoneSupervisionControlPlan({
  responsibleRows,
  sampleRows,
  priorityGroups,
  fallbackEffective = 0,
}: {
  responsibleRows: Array<Record<string, unknown>>;
  sampleRows: Array<Record<string, unknown>>;
  priorityGroups: AcreditacionPhoneSupervisionPriorityGroup[];
  fallbackEffective?: number;
}): AcreditacionPhoneSupervisionControlPlan {
  const hasReadBase = sampleRows.length > 0;
  const observedByResponsible = new Map<string, { responsible: string; observed: number }>();
  sampleRows.forEach((row, index) => {
    const responsible = phoneSupervisionBaseResponsibleName(row, index);
    const key = normalizeSourceMatch(responsible);
    const observed = phoneRowOptionalNumber(row, ["Casos", "Muestra", "Seleccionados", "Casos supervision", "Casos supervisión", "N"]) ?? 1;
    const current = observedByResponsible.get(key) ?? { responsible, observed: 0 };
    current.observed += Math.max(0, observed);
    observedByResponsible.set(key, current);
  });

  const priorityByResponsible = new Map<string, number>();
  priorityGroups.forEach((group) => {
    priorityByResponsible.set(normalizeSourceMatch(group.title), group.count);
  });

  const rowsByResponsible = new Map<string, AcreditacionPhoneSupervisionControlRow>();
  responsibleRows
    .filter((row, index) => !phoneIsUnassignedResponsible(phoneSupervisionBaseResponsibleName(row, index)))
    .forEach((row, index) => {
      const responsible = phoneSupervisionBaseResponsibleName(row, index);
      const key = normalizeSourceMatch(responsible) || `responsable-${index}`;
      const actor = phoneResponsibleActorName(row);
      const metrics = phoneResponsibleMetrics(row);
      const effective = Math.max(0, metrics.effective);
      const target = effective > 0 ? Math.ceil(effective * ACREDITACION_PHONE_SUPERVISION_SAMPLE_RATE) : 0;
      const observed = observedByResponsible.get(key)?.observed ?? 0;
      rowsByResponsible.set(key, {
        key,
        responsible,
        actor,
        effective,
        target,
        observed,
        gap: Math.max(0, target - observed),
        coveragePct: target > 0 ? safePercentValue(observed, target) : null,
        priorityCases: priorityByResponsible.get(key) ?? 0,
        source: hasReadBase ? "read" : "proposed",
      });
    });

  observedByResponsible.forEach((item, key) => {
    if (rowsByResponsible.has(key)) return;
    rowsByResponsible.set(key, {
      key,
      responsible: item.responsible,
      actor: "",
      effective: 0,
      target: item.observed,
      observed: item.observed,
      gap: 0,
      coveragePct: 100,
      priorityCases: priorityByResponsible.get(key) ?? 0,
      source: "read",
    });
  });

  if (!rowsByResponsible.size && fallbackEffective > 0) {
    const target = Math.ceil(fallbackEffective * ACREDITACION_PHONE_SUPERVISION_SAMPLE_RATE);
    rowsByResponsible.set("equipo-telefonico", {
      key: "equipo-telefonico",
      responsible: "Equipo telefónico",
      actor: "Todos",
      effective: fallbackEffective,
      target,
      observed: 0,
      gap: hasReadBase ? target : target,
      coveragePct: hasReadBase ? 0 : null,
      priorityCases: priorityGroups.reduce((sum, group) => sum + group.count, 0),
      source: hasReadBase ? "read" : "proposed",
    });
  }

  const rows = Array.from(rowsByResponsible.values()).sort((a, b) => (
    b.gap - a.gap
    || b.priorityCases - a.priorityCases
    || b.target - a.target
    || a.responsible.localeCompare(b.responsible, "es")
  ));
  const totalEffective = rows.reduce((sum, row) => sum + row.effective, 0);
  const targetTotal = rows.reduce((sum, row) => sum + row.target, 0);
  const observedTotal = rows.reduce((sum, row) => sum + row.observed, 0);
  const selectedTotal = hasReadBase ? observedTotal : targetTotal;
  const gapTotal = hasReadBase ? rows.reduce((sum, row) => sum + row.gap, 0) : targetTotal;
  const tableRows = rows.map((row) => ({
    Responsable: row.responsible,
    Base: row.actor || "Todos",
    Efectivas: row.effective,
    "Objetivo 30%": row.target,
    [hasReadBase ? "Base leída" : "Base propuesta"]: hasReadBase ? row.observed : row.target,
    "Por completar": row.gap,
    Cobertura: row.coveragePct == null ? (hasReadBase ? "S/M" : "Propuesta") : formatPercentLabel(row.coveragePct),
    Prioridad: row.priorityCases,
  }));

  return {
    hasReadBase,
    rows,
    tableRows,
    exportRows: hasReadBase ? sampleRows : tableRows,
    totalEffective,
    targetTotal,
    observedTotal,
    selectedTotal,
    gapTotal,
    coveragePct: targetTotal > 0 ? safePercentValue(observedTotal, targetTotal) : null,
  };
}

export function buildAcreditacionPhoneTimeControl({
  alerts,
  totalEffective = 0,
}: {
  alerts: AcreditacionQualityAlertItem[];
  totalEffective?: number;
}): AcreditacionPhoneTimeControlModel {
  const durationAlerts = alerts.filter((alert) => alert.signal.kind === "short_duration");
  const under2 = durationAlerts.reduce((sum, alert) => {
    const threshold = phoneDurationAlertThreshold(alert);
    return threshold <= 2 ? sum + phoneAlertCaseCount(alert) : sum;
  }, 0);
  const under5 = durationAlerts.reduce((sum, alert) => {
    const threshold = phoneDurationAlertThreshold(alert);
    return threshold > 2 && threshold <= 5 ? sum + phoneAlertCaseCount(alert) : sum;
  }, 0);
  const flaggedTotal = under2 + under5;
  const effectiveBase = Math.max(0, totalEffective, flaggedTotal);
  const normal = Math.max(0, effectiveBase - flaggedTotal);
  const bucketInputs: Array<Omit<AcreditacionPhoneTimeBucket, "percent">> = [
    {
      key: "under2",
      label: "<2 min",
      hint: "supervisión prioritaria",
      count: under2,
      tone: under2 ? "danger" : "ok",
    },
    {
      key: "under5",
      label: "<5 min",
      hint: "revisar saltos y consistencia",
      count: under5,
      tone: under5 ? "warning" : "ok",
    },
    {
      key: "normal",
      label: "5+ min",
      hint: "duración esperada",
      count: normal,
      tone: "ok",
    },
  ];

  return {
    totalEffective: effectiveBase,
    flaggedTotal,
    under2,
    under5,
    normal,
    buckets: bucketInputs.map((bucket) => ({
      ...bucket,
      percent: effectiveBase > 0 ? safePercentValue(bucket.count, effectiveBase) ?? 0 : 0,
    })),
    alerts: durationAlerts,
  };
}

function phoneDurationAlertThreshold(alert: AcreditacionQualityAlertItem) {
  const text = normalizeSourceMatch(`${alert.title} ${alert.type} ${alert.detail} ${alert.signal.detail}`);
  const explicit = text.match(/(?:menor(?:es)?\s*a|menos\s*de|<)\s*(\d+(?:[.,]\d+)?)\s*(?:min|minuto|minutos)?/);
  if (explicit) {
    const parsed = Number(explicit[1].replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  if (text.includes("2 min") || text.includes("2 minuto") || text.includes("extremadamente")) return 2;
  if (text.includes("5 min") || text.includes("5 minuto")) return 5;
  return 5;
}

function phoneAlertCaseCount(alert: AcreditacionQualityAlertItem) {
  return Math.max(1, Math.round(alert.count ?? alert.total ?? 1));
}

function phoneSupervisionBaseResponsibleName(row: Record<string, unknown>, index: number) {
  const raw = phoneRowValue(row, ["Responsable", "Encuestador", "Operador", "Agente", "Owner"], "") || `Responsable ${index + 1}`;
  return phoneCleanResponsibleDisplayName(raw);
}

function mergeAcreditacionPhoneResponsibleRows(...rowGroups: Array<Array<Record<string, unknown>>>) {
  const byResponsible = new Map<string, Record<string, unknown>>();
  const applyNumber = (target: Record<string, unknown>, label: string, value: number | null) => {
    if (value != null) target[label] = value;
  };

  rowGroups.flat().forEach((row, index) => {
    const name = phoneResponsibleName(row, index);
    const baseName = phoneRowValue(row, ["Responsable", "Encuestador", "Owner"], "") || name;
    const actor = phoneRowValue(row, ["Actor", "Unidad"], "");
    const key = normalizeSourceMatch(name);
    if (!key) return;
    const current = byResponsible.get(key) ?? { Responsable: baseName };
    current.Responsable = String(current.Responsable ?? baseName) || baseName;
    if (actor) current.Actor = actor;
    applyNumber(current, "Casos asignados", phoneRowOptionalNumber(row, ["Casos asignados", "Total telefonico", "Total telefónico", "Asignados"]));
    applyNumber(current, "Barridos", phoneRowOptionalNumber(row, ["Barridos", "Casos barridos"]));
    applyNumber(current, "No barridos", phoneRowOptionalNumber(row, ["No barridos", "Por barrer"]));
    applyNumber(current, "Efectivas", phoneRowOptionalNumber(row, ["Efectivas", "Completas", "Completas telefonicas", "Completas telefónicas"]));
    applyNumber(current, "Sin efectiva", phoneRowOptionalNumber(row, ["Sin efectiva", "No efectivas", "Barridos sin efectiva", "Incidencias", "Incid."]));
    applyNumber(current, "Ratio incidencias", phoneRowRatioPct(row, ["Ratio incidencias", "% sin efectiva", "Ratio sin efectiva"]));
    byResponsible.set(key, current);
  });

  return Array.from(byResponsible.values()).map((row) => {
    const metrics = phoneResponsibleMetrics(row);
    if (metrics.assigned != null && metrics.unswept != null && metrics.swept == null) row.Barridos = Math.max(0, metrics.assigned - metrics.unswept);
    if (metrics.swept != null && metrics.nonEffective != null && metrics.incidencePct == null) {
      row["Ratio incidencias"] = safePercentValue(metrics.nonEffective, metrics.swept);
    }
    return row;
  }).sort((a, b) => {
    const bMetrics = phoneResponsibleMetrics(b);
    const aMetrics = phoneResponsibleMetrics(a);
    return bMetrics.effective - aMetrics.effective
      || (bMetrics.assigned ?? 0) - (aMetrics.assigned ?? 0)
      || (bMetrics.unswept ?? 0) - (aMetrics.unswept ?? 0)
      || phoneResponsibleName(a).localeCompare(phoneResponsibleName(b), "es");
  });
}

function phoneDisplayRowsWithBaseColumn(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => {
    if (!Object.prototype.hasOwnProperty.call(row, "Actor")) return row;
    const { Actor: actor, ...rest } = row;
    return { Base: actor, ...rest };
  });
}

function phoneOperationTotals(
  summaryRows: Array<Record<string, unknown>>,
  statusRows: Array<Record<string, unknown>>,
  responsibleRows: Array<Record<string, unknown>>,
  dailyRows: Array<Record<string, unknown>>,
) {
  const total = phoneSummaryValue(summaryRows, "total telefonico")
    ?? phoneSummaryValue(summaryRows, "total telefónico")
    ?? statusRows.reduce((sum, row) => sum + phoneRowNumber(row, ["Casos"], 0), 0);
  const unswept = phoneSummaryValue(summaryRows, "no barridos")
    ?? responsibleRows.reduce((sum, row) => sum + (phoneResponsibleMetrics(row).unswept ?? 0), 0);
  const swept = phoneSummaryValue(summaryRows, "casos barridos") ?? Math.max(0, total - unswept);
  const effectiveFromResponsible = responsibleRows.reduce((sum, row) => sum + phoneResponsibleMetrics(row).effective, 0);
  const effectiveFromDaily = dailyRows.reduce((sum, row) => sum + phoneRowNumber(row, ["Efectivas", "Casos"], 0), 0);
  const effective = effectiveFromResponsible || effectiveFromDaily || statusRows.reduce((sum, row) => {
    const label = phoneRowValue(row, ["Estado", "Estatus", "Indicador"]);
    return phoneStatusTone(label) === "good" ? sum + phoneRowNumber(row, ["Casos", "Valor"], 0) : sum;
  }, 0);
  const incidents = responsibleRows.reduce((sum, row) => sum + (phoneResponsibleMetrics(row).nonEffective ?? 0), 0) || Math.max(0, swept - effective);
  const responsables = new Set(responsibleRows.map((row, index) => phoneResponsibleName(row, index)).filter((name) => !phoneIsUnassignedResponsible(name))).size;
  return {
    total,
    swept,
    unswept,
    effective,
    incidents,
    responsables,
    sweptPct: safePercentValue(swept, total),
    unsweptPct: safePercentValue(unswept, total),
    incidentRatio: safePercentValue(incidents, swept),
  };
}

export type AcreditacionPhoneQuotaRow = {
  key: string;
  actor: string;
  variable: string;
  value: string;
  universe: number;
  meta: number | null;
  effective: number;
  partial: number;
  refusals: number;
  unswept: number;
  advancePct: number | null;
  gap: number | null;
  status: string;
};

export function phoneQuotaRowsForPanel(rows: Array<Record<string, unknown>>): AcreditacionPhoneQuotaRow[] {
  const mapped = rows.map((row, index) => {
    const actor = phoneRowValue(row, [
      "Actor",
      "Unidad",
      "Público objetivo",
      "Publico objetivo",
      "Actor específico",
      "Actor especifico",
      "Segmento actor",
    ], "Todos") || "Todos";
    const variable = phoneQuotaVariableLabel(phoneRowValue(row, [
      "Variable",
      "Variable control",
      "variable_control",
      "Variable cuota",
      "Variable de cuota",
      "Corte",
      "Dimensión",
      "Dimension",
    ], "") || "Variable");
    const value = phoneRowValue(row, ["Valor", "Categoria", "Categoría", "Nivel", "Segmento", "Grupo", "Etiqueta"], `Valor ${index + 1}`);
    const universe = phoneRowNumber(row, ["Universo", "Base", "Población", "Poblacion", "Población objetivo", "Poblacion objetivo", "Total", "Casos"], 0);
    const meta = phoneRowOptionalNumber(row, ["Meta", "Cuota", "Objetivo", "Mínimo", "Minimo"]);
    const effective = phoneRowNumber(row, ["Efectivas", "Completas", "Efectivas telefónicas", "Efectivas telefonicas"], 0);
    const partial = phoneRowNumber(row, ["Parciales", "Parcial"], 0);
    const refusals = phoneRowNumber(row, ["Rechazos telefónicos", "Rechazos telefonicos", "Rechazos", "Rechazo"], 0);
    const unswept = phoneRowNumber(row, ["No barridos", "Por barrer"], Math.max(0, universe - effective - partial - refusals));
    const advancePct = phoneRowRatioPct(row, ["Avance meta", "% avance meta", "Cumplimiento", "% cumplimiento"])
      ?? (meta != null ? safePercentValue(effective, meta) : safePercentValue(effective, universe));
    const gap = phoneRowOptionalNumber(row, ["Brecha", "Faltante", "Por completar"])
      ?? (meta != null ? Math.max(0, meta - effective) : null);
    const status = phoneRowValue(row, ["Estado cuota", "Estado", "Status"], "") || (gap != null ? (gap > 0 ? "Brecha" : "Cumple") : "Sin meta");
    return {
      key: `${normalizeSourceMatch(actor)}-${normalizeSourceMatch(variable)}-${normalizeSourceMatch(value)}-${index}`,
      actor,
      variable,
      value,
      universe,
      meta,
      effective,
      partial,
      refusals,
      unswept,
      advancePct,
      gap,
      status,
    };
  }).filter((row) => row.value && (row.universe > 0 || (row.meta != null && row.meta > 0)));
  const totalKeys = new Set(mapped
    .filter((row) => ["total", "todos"].includes(normalizeSourceMatch(row.actor)) && row.meta != null)
    .map((row) => `${normalizeSourceMatch(row.variable)}\r${normalizeSourceMatch(row.value)}`));
  return mapped
    .filter((row) => !totalKeys.has(`${normalizeSourceMatch(row.variable)}\r${normalizeSourceMatch(row.value)}`) || ["total", "todos"].includes(normalizeSourceMatch(row.actor)))
    .sort((a, b) => (
      (["total", "todos"].includes(normalizeSourceMatch(a.actor)) ? -1 : 0) - (["total", "todos"].includes(normalizeSourceMatch(b.actor)) ? -1 : 0)
      ||
      a.actor.localeCompare(b.actor, "es")
      || a.variable.localeCompare(b.variable, "es")
      || (b.gap ?? -1) - (a.gap ?? -1)
      || b.universe - a.universe
      || a.value.localeCompare(b.value, "es", { numeric: true })
    ));
}

function phoneQuotaStatusTone(status: string, gap: number | null) {
  const key = normalizeSourceMatch(status);
  if (key.includes("cumple") || key.includes("completa") || gap === 0) return "ready";
  if (key.includes("sin meta")) return "base";
  return "warning";
}

function AcreditacionPhoneQuotaPanel({ rows }: { rows: Array<Record<string, unknown>> }) {
  const quotaRows = phoneQuotaRowsForPanel(rows);
  const variables = uniqueDisplayValues(quotaRows.map((row) => row.variable));
  const [activeVariable, setActiveVariable] = useState("");
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (activeVariable && !variables.includes(activeVariable)) setActiveVariable("");
  }, [activeVariable, variables]);
  if (!quotaRows.length) {
    return (
      <section className="mon-phone-quota-panel is-empty" aria-label="Cuotas telefónicas por variable">
        <EmptyPanel title="Sin cuotas por variable" detail="Define una variable de control en la base de público objetivo para leer cuotas telefónicas por categoría." />
      </section>
    );
  }

  const visibleRows = activeVariable ? quotaRows.filter((row) => row.variable === activeVariable) : quotaRows;
  const groups = Array.from(visibleRows.reduce((acc, row) => {
    const key = normalizeSourceMatch(row.variable) || "variable";
    const current = acc.get(key) ?? { variable: row.variable, rows: [] as AcreditacionPhoneQuotaRow[] };
    current.rows.push(row);
    acc.set(key, current);
    return acc;
  }, new Map<string, { variable: string; rows: AcreditacionPhoneQuotaRow[] }>()).values());
  const variableTotals = variables.map((variable) => {
    const rowsForVariable = quotaRows.filter((row) => row.variable === variable);
    return {
      universe: rowsForVariable.reduce((sum, row) => sum + row.universe, 0),
      meta: rowsForVariable.reduce((sum, row) => sum + (row.meta ?? 0), 0),
      effective: rowsForVariable.reduce((sum, row) => sum + row.effective, 0),
      gap: rowsForVariable.reduce((sum, row) => sum + (row.gap ?? 0), 0),
    };
  });
  const totalUniverse = activeVariable
    ? visibleRows.reduce((sum, row) => sum + row.universe, 0)
    : Math.max(0, ...variableTotals.map((item) => item.universe));
  const totalMeta = activeVariable
    ? visibleRows.reduce((sum, row) => sum + (row.meta ?? 0), 0)
    : Math.max(0, ...variableTotals.map((item) => item.meta));
  const totalEffective = activeVariable
    ? visibleRows.reduce((sum, row) => sum + row.effective, 0)
    : Math.max(0, ...variableTotals.map((item) => item.effective));
  const totalGap = activeVariable
    ? visibleRows.reduce((sum, row) => sum + (row.gap ?? 0), 0)
    : Math.max(0, ...variableTotals.map((item) => item.gap));
  const detailId = "mon-phone-quota-detail";

  return (
    <section className="mon-phone-quota-panel" aria-label="Cuotas telefónicas por variable">
      <header className="mon-phone-ops-head mon-phone-quota-head">
        <div>
          <span>Cuotas telefónicas</span>
          <strong>Base objetivo por variable</strong>
          <small>Kobo aporta efectivas; el barrido aporta estado de llamada. {formatMetric(visibleRows.length)} categoría{visibleRows.length === 1 ? "" : "s"}.</small>
        </div>
        <div className="mon-phone-quota-actions">
          <em>{formatMetric(variables.length)} variable{variables.length === 1 ? "" : "s"}</em>
          <button
            type="button"
            className={`mon-phone-quota-toggle ${expanded ? "is-open" : ""}`}
            aria-expanded={expanded}
            aria-controls={detailId}
            onClick={() => setExpanded((value) => !value)}
          >
            <ChevronDown size={14} />
            <span>{expanded ? "Ocultar detalle" : "Ver detalle"}</span>
          </button>
        </div>
      </header>
      <div className="mon-phone-quota-summary" aria-label="Resumen de cuotas telefónicas">
        <span><em>Universo</em><strong>{formatMetric(totalUniverse)}</strong></span>
        <span className={totalMeta ? "is-target" : "is-base"}><em>Meta</em><strong>{totalMeta ? formatMetric(totalMeta) : "Sin meta"}</strong></span>
        <span className="is-ready"><em>Efectivas</em><strong>{formatMetric(totalEffective)}</strong></span>
        <span className={totalGap ? "is-warning" : "is-ready"}><em>Brecha</em><strong>{formatMetric(totalGap)}</strong></span>
      </div>
      {expanded ? (
        <div id={detailId} className="mon-phone-quota-detail">
          {variables.length > 1 ? (
            <div className="mon-phone-quota-filter">
              <span>Variable</span>
              <div className="mon-phone-quota-tabs" role="group" aria-label="Variable de cuota telefónica">
                <button
                  type="button"
                  className={!activeVariable ? "is-active" : ""}
                  onClick={() => setActiveVariable("")}
                >
                  Todas
                </button>
                {variables.map((variable) => (
                  <button
                    key={variable}
                    type="button"
                    className={variable === activeVariable ? "is-active" : ""}
                    onClick={() => setActiveVariable(variable)}
                  >
                    {variable}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mon-phone-quota-single">
              <span>Variable</span>
              <strong>{variables[0] ?? "Variable"}</strong>
            </div>
          )}
          <div className="mon-phone-quota-grid">
            {groups.map((group) => (
              <article key={group.variable} className="mon-phone-quota-actor mon-phone-quota-variable">
                <header>
                  <strong>{group.variable}</strong>
                  <em>{formatMetric(group.rows.length)} categoría{group.rows.length === 1 ? "" : "s"} · {formatMetric(group.rows.reduce((sum, row) => sum + row.universe, 0))} base</em>
                </header>
                <div className="mon-phone-quota-rows">
                  {group.rows.map((row) => {
                    const pctValue = row.advancePct ?? 0;
                    const tone = phoneQuotaStatusTone(row.status, row.gap);
                    return (
                      <section key={row.key} className={`mon-phone-quota-row is-${tone}`}>
                        <div className="mon-phone-quota-row-head">
                          <span>{row.variable}</span>
                          <strong>{row.value}</strong>
                        </div>
                        <div className="mon-phone-quota-row-metrics">
                          <span>{formatMetric(row.effective)} efectivas</span>
                          <span>{row.meta == null ? "sin meta" : `${formatMetric(row.meta)} meta`}</span>
                        </div>
                        <i aria-hidden="true" style={{ "--phone-quota-pct": `${Math.max(2, Math.min(100, pctValue))}%` } as CSSProperties} />
                        <footer>
                          <span>{formatPercentLabel(row.advancePct)}</span>
                          <span>{row.gap == null ? "Sin meta" : `${formatMetric(row.gap)} faltan`}</span>
                          <span>{formatMetric(row.unswept)} por barrer</span>
                        </footer>
                      </section>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AcreditacionPhoneStorage({ totals }: { totals: ReturnType<typeof phoneOperationTotals> }) {
  const total = Math.max(0, totals.total);
  const segments = [
    { key: "swept", label: "Barridos", value: totals.swept, pct: safePercentValue(totals.swept, total) ?? 0, hint: "de la base" },
    { key: "unswept", label: "Por barrer", value: totals.unswept, pct: safePercentValue(totals.unswept, total) ?? 0, hint: "de la base" },
  ].filter((item) => item.value > 0);
  let segmentOffset = 0;
  const positionedSegments = segments.map((segment) => {
    const segmentPct = Math.max(0, Math.min(100, segment.pct));
    const start = segmentOffset;
    segmentOffset += segmentPct;
    return { ...segment, pct: segmentPct, center: Math.max(6, Math.min(94, start + segmentPct / 2)) };
  });
  const [hoveredSegmentKey, setHoveredSegmentKey] = useState("");
  const hoveredSegment = positionedSegments.find((segment) => segment.key === hoveredSegmentKey) ?? null;
  return (
    <div className="mon-phone-storage" aria-label="Distribución telefónica">
      <div className="mon-phone-storage-head">
        <div>
          <span>Barra de barrido</span>
          <strong>{formatMetric(total)} personas en base telefónica</strong>
        </div>
        <em>{phonePercentLabel(totals.sweptPct)} barrido</em>
      </div>
      <div className="mon-phone-storage-bar-wrap">
        <div className="mon-phone-storage-bar" role="list" aria-label={`${formatMetric(totals.swept)} barridos y ${formatMetric(totals.unswept)} por barrer`}>
          {positionedSegments.length ? positionedSegments.map((segment) => (
            <i
              key={segment.key}
              role="listitem"
              tabIndex={0}
              className={`is-${segment.key}`}
              aria-label={`${segment.label}: ${formatMetric(segment.value)} (${phonePercentLabel(segment.pct)} ${segment.hint})`}
              title={`${segment.label}: ${formatMetric(segment.value)} (${phonePercentLabel(segment.pct)})`}
              onBlur={() => setHoveredSegmentKey("")}
              onFocus={() => setHoveredSegmentKey(segment.key)}
              onMouseEnter={() => setHoveredSegmentKey(segment.key)}
              onMouseLeave={() => setHoveredSegmentKey("")}
              style={{ "--phone-storage-size": `${segment.pct}%` } as CSSProperties}
            />
          )) : <i className="is-empty" style={{ "--phone-storage-size": "100%" } as CSSProperties} />}
        </div>
        {hoveredSegment ? (
          <div
            className="mon-phone-bar-tooltip"
            style={{ "--phone-bar-tooltip-x": `${hoveredSegment.center}%` } as CSSProperties}
          >
            <strong>{hoveredSegment.label}</strong>
            <span>{formatMetric(hoveredSegment.value)} casos</span>
            <em>{phonePercentLabel(hoveredSegment.pct)} {hoveredSegment.hint}</em>
          </div>
        ) : null}
      </div>
      <div className="mon-phone-flow" aria-label="Embudo operativo del barrido">
        {[
          { key: "swept", label: "Barrido", value: totals.swept, pct: totals.sweptPct, hint: "de la base", tone: "swept" },
          { key: "effective", label: "Efectivas", value: totals.effective, pct: safePercentValue(totals.effective, total), hint: "de la base", tone: "effective" },
          { key: "incidents", label: "Sin efectiva", value: totals.incidents, pct: totals.incidentRatio, hint: "del barrido", tone: totals.incidents > 0 ? "incidents" : "calm" },
          { key: "unswept", label: "Por barrer", value: totals.unswept, pct: totals.unsweptPct, hint: "de la base", tone: "unswept" },
        ].map((step) => (
          <span key={step.key} className={`is-${step.tone}`} style={{ "--phone-flow": `${Math.max(0, Math.min(100, step.pct ?? 0))}%` } as CSSProperties}>
            <em>{step.label}</em>
            <strong>{formatMetric(step.value)}</strong>
            <i aria-hidden="true" />
            <small>{phonePercentLabel(step.pct)} {step.hint}</small>
          </span>
        ))}
      </div>
      <div className="mon-phone-storage-legend">
        <span className="is-swept"><em>Barridos</em><strong>{formatMetric(totals.swept)}</strong><small>{phonePercentLabel(totals.sweptPct)} de la base</small></span>
        <span className="is-unswept"><em>Por barrer</em><strong>{formatMetric(totals.unswept)}</strong><small>{phonePercentLabel(totals.unsweptPct)} de la base</small></span>
        <span className="is-total"><em>Base telefónica</em><strong>{formatMetric(total)}</strong><small>personas registradas</small></span>
      </div>
    </div>
  );
}

function AcreditacionPhoneStatusStorage({
  rows,
  total,
}: {
  rows: Array<Record<string, unknown>>;
  total: number;
}) {
  const items = rows.map((row, index) => {
    const label = phoneRowValue(row, ["Estado", "Estatus", "Indicador"], `Estado ${index + 1}`);
    const value = phoneRowNumber(row, ["Casos", "Valor", "Total"], 0);
    const palette = phoneStatusPalette(label);
    return { key: `${normalizeSourceMatch(label)}-${index}`, label, value, tone: phoneStatusTone(label), palette };
  }).filter((item) => item.value > 0);
  const base = Math.max(0, items.reduce((sum, item) => sum + item.value, 0) || total);
  const rankedItems = [...items].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "es"));
  let statusOffset = 0;
  const positionedItems = items.map((item) => {
    const pctValue = Math.max(0, Math.min(100, safePercentValue(item.value, base) ?? 0));
    const start = statusOffset;
    statusOffset += pctValue;
    return { ...item, pctValue, center: Math.max(6, Math.min(94, start + pctValue / 2)) };
  });
  const [hoveredStatusKey, setHoveredStatusKey] = useState("");
  const hoveredStatus = positionedItems.find((item) => item.key === hoveredStatusKey) ?? null;
  if (!items.length) return <EmptyPanel title="Sin estados telefónicos" detail="El corte todavía no trae la distribución de estados del barrido." />;
  return (
    <div className="mon-phone-storage mon-phone-storage--statuses" aria-label="Estados telefónicos">
      <div className="mon-phone-storage-head">
        <div>
          <span>Estados telefónicos</span>
          <strong>Estado de la base de llamadas</strong>
        </div>
        <em>{formatMetric(base)} casos</em>
      </div>
      <div className="mon-phone-storage-bar-wrap">
        <div className="mon-phone-storage-bar mon-phone-status-stack" role="list" aria-label="Distribución de estados telefónicos">
          {positionedItems.map((item) => (
            <i
              key={item.key}
              role="listitem"
              tabIndex={0}
              className={`is-${item.tone}`}
              aria-label={`${item.label}: ${formatMetric(item.value)} (${phonePercentLabel(item.pctValue)} del barrido)`}
              title={`${item.label}: ${formatMetric(item.value)} (${phonePercentLabel(item.pctValue)})`}
              onBlur={() => setHoveredStatusKey("")}
              onFocus={() => setHoveredStatusKey(item.key)}
              onMouseEnter={() => setHoveredStatusKey(item.key)}
              onMouseLeave={() => setHoveredStatusKey("")}
              style={{
                "--phone-storage-size": `${item.pctValue}%`,
                "--phone-status-color": item.palette.color,
                "--phone-status-color-hi": item.palette.highlight,
              } as CSSProperties}
            />
          ))}
        </div>
        {hoveredStatus ? (
          <div
            className="mon-phone-bar-tooltip"
            style={{ "--phone-bar-tooltip-x": `${hoveredStatus.center}%` } as CSSProperties}
          >
            <strong>{hoveredStatus.label}</strong>
            <span>{formatMetric(hoveredStatus.value)} casos</span>
            <em>{phonePercentLabel(hoveredStatus.pctValue)} del barrido</em>
          </div>
        ) : null}
      </div>
      <div className="mon-phone-status-rank" aria-label="Todos los estados telefónicos de la base">
        {rankedItems.map((item) => {
          const pctValue = safePercentValue(item.value, base) ?? 0;
          return (
            <span
              key={`${item.key}-rank`}
              className={`is-${item.tone}`}
              style={{
                "--phone-status-rank": `${Math.max(2, Math.min(100, pctValue))}%`,
                "--phone-status-rank-color": item.palette.color,
                "--phone-status-rank-hi": item.palette.highlight,
              } as CSSProperties}
              title={`${item.label}: ${formatMetric(item.value)} (${phonePercentLabel(pctValue)})`}
            >
              <strong>{item.label}</strong>
              <em>{formatMetric(item.value)}</em>
              <i aria-hidden="true" />
              <small>{phonePercentLabel(pctValue)} del barrido</small>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function AcreditacionPhoneResponsibleCards({ rows }: { rows: Array<Record<string, unknown>> }) {
  const assignedRows = rows.filter((row, index) => !phoneIsUnassignedResponsible(phoneResponsibleName(row, index)));
  const unassignedRows = rows.filter((row, index) => phoneIsUnassignedResponsible(phoneResponsibleName(row, index)));
  const visibleActors = new Set(assignedRows.map((row) => normalizeSourceMatch(phoneResponsibleActorName(row))).filter(Boolean));
  const showActorContext = visibleActors.size > 1;
  return (
    <div className="mon-phone-responsibles" aria-label="Producción por responsable">
      <header className="mon-phone-responsibles-head">
        <div>
          <span>Equipo asignado</span>
          <strong>Producción por responsable y asignación</strong>
        </div>
        <em>{formatMetric(assignedRows.length)} responsables</em>
      </header>
      {assignedRows.length ? assignedRows.map((row, index) => {
        const name = phoneResponsibleName(row, index);
        const displayName = phoneResponsibleBaseName(row, index);
        const actor = phoneResponsibleActorName(row);
        const metrics = phoneResponsibleMetrics(row);
        const total = metrics.assigned ?? metrics.denominator;
        const effectivePct = safePercentValue(metrics.effective, total);
        const nonEffectivePct = safePercentValue(metrics.nonEffective ?? 0, total);
        const pendingPct = safePercentValue(metrics.unswept ?? 0, total);
        const incidencePct = metrics.incidencePct ?? nonEffectivePct;
        return (
          <article key={`${name}-${index}`} className="mon-phone-responsible" title={actor ? `${displayName} · ${actor}` : displayName}>
            <header>
              <div className="mon-phone-responsible-title">
                <strong>{displayName}</strong>
                {showActorContext && actor ? <span>{actor}</span> : null}
              </div>
              <em>{formatMetric(metrics.effective)} efectivas</em>
            </header>
            <div className="mon-phone-responsible-meter" aria-label={`Composición operativa de ${name}`}>
              <span className="is-effective" style={{ "--phone-segment": `${Math.max(2, Math.min(100, effectivePct ?? 0))}%` } as CSSProperties} />
              <span className="is-non-effective" style={{ "--phone-segment": `${Math.max(0, Math.min(100, nonEffectivePct ?? 0))}%` } as CSSProperties} />
              <span className="is-pending" style={{ "--phone-segment": `${Math.max(0, Math.min(100, pendingPct ?? 0))}%` } as CSSProperties} />
            </div>
            <div className="mon-phone-responsible-chips">
              {metrics.assigned != null ? <span>{formatMetric(metrics.assigned)} asignados</span> : null}
              {metrics.swept != null ? <span>{formatMetric(metrics.swept)} barridos</span> : null}
              <span>{formatMetric(metrics.effective)} efectivas</span>
              {metrics.nonEffective != null ? <span>{formatMetric(metrics.nonEffective)} sin efectiva</span> : null}
              {incidencePct != null ? <span>{phonePercentLabel(incidencePct)} ratio incidencias</span> : null}
              {metrics.unswept != null ? <span>{formatMetric(metrics.unswept)} por barrer</span> : null}
            </div>
            <footer className="mon-phone-responsible-foot">
              <span className="is-effective"><i /><strong>{phonePercentLabel(effectivePct)}</strong><em>Efectivas</em></span>
              <span className="is-non-effective"><i /><strong>{phonePercentLabel(incidencePct)}</strong><em>Ratio incid.</em></span>
              <span className="is-pending"><i /><strong>{phonePercentLabel(pendingPct)}</strong><em>Por barrer</em></span>
            </footer>
          </article>
        );
      }) : <EmptyPanel title="Sin responsables" detail="La base está cargada; falta asignar responsables antes de evaluar producción." />}
      {unassignedRows.length ? (
        <aside className="mon-phone-unassigned">
          <AlertCircle size={16} />
          <div>
            <span>Brecha de asignación</span>
            <strong>{formatMetric(unassignedRows.length)} fila{unassignedRows.length === 1 ? "" : "s"} sin responsable</strong>
            <em>No entra al ranking del equipo.</em>
          </div>
        </aside>
      ) : null}
    </div>
  );
}

function AcreditacionPhoneIncidenceInsights({ rows }: { rows: Array<Record<string, unknown>> }) {
  const visible = rows.map((row, index) => {
    const metrics = phoneResponsibleMetrics(row);
    return {
      key: `${phoneResponsibleName(row, index)}-${index}`,
      name: phoneResponsibleName(row, index),
      metrics,
    };
  }).filter((item) => !phoneIsUnassignedResponsible(item.name) && (
    item.metrics.swept != null
    || item.metrics.nonEffective != null
    || item.metrics.incidencePct != null
  )).sort((a, b) => (b.metrics.incidencePct ?? 0) - (a.metrics.incidencePct ?? 0) || (b.metrics.nonEffective ?? 0) - (a.metrics.nonEffective ?? 0));
  if (!visible.length) return null;
  const totalSwept = visible.reduce((sum, item) => sum + (item.metrics.swept ?? 0), 0);
  const totalIncidents = visible.reduce((sum, item) => sum + (item.metrics.nonEffective ?? 0), 0);
  const totalEffective = visible.reduce((sum, item) => sum + item.metrics.effective, 0);
  const incidencePct = safePercentValue(totalIncidents, totalSwept);
  return (
    <article className="mon-phone-ops-card mon-phone-ops-card--compare">
      <header className="mon-phone-ops-head">
        <div>
          <span>Ratio de incidencias</span>
          <strong>Barridos sin efectiva por responsable</strong>
        </div>
        <em>{phonePercentLabel(incidencePct)} del barrido</em>
      </header>
      <div className="mon-phone-compare-summary">
        <span><strong>{formatMetric(totalSwept)}</strong><em>barridos</em></span>
        <span><strong>{formatMetric(totalEffective)}</strong><em>efectivas tel.</em></span>
        <span className={totalIncidents ? "is-warning" : "is-ok"}><strong>{formatMetric(totalIncidents)}</strong><em>sin efectiva</em></span>
      </div>
      <div className="mon-phone-compare-list">
        {visible.slice(0, 8).map((item) => {
          const swept = item.metrics.swept ?? item.metrics.denominator;
          const effectivePct = safePercentValue(item.metrics.effective, swept) ?? 0;
          const incidence = item.metrics.incidencePct ?? safePercentValue(item.metrics.nonEffective ?? 0, swept) ?? 0;
          const review = item.metrics.nonEffective ?? 0;
          return (
            <section key={item.key} className={`mon-phone-compare-row ${review ? "is-warning" : "is-ok"}`}>
              <div className="mon-phone-compare-title">
                <strong>{item.name}</strong>
                <em>{review ? `${formatMetric(review)} sin efectiva` : "sin incidencia"}</em>
              </div>
              <div className="mon-phone-compare-bars">
                <span>
                  <small>Efectivas</small>
                  <i style={{ "--phone-compare-bar": `${Math.max(0, Math.min(100, effectivePct))}%` } as CSSProperties} />
                  <b>{formatMetric(item.metrics.effective)}</b>
                </span>
                <span className="is-platform">
                  <small>Incidencias</small>
                  <i style={{ "--phone-compare-bar": `${Math.max(0, Math.min(100, incidence))}%` } as CSSProperties} />
                  <b>{phonePercentLabel(incidence)}</b>
                </span>
              </div>
              <footer>
                {item.metrics.assigned != null ? <span>{formatMetric(item.metrics.assigned)} asignados</span> : null}
                {item.metrics.swept != null ? <span>{formatMetric(item.metrics.swept)} barridos</span> : null}
                {item.metrics.unswept != null ? <span>{formatMetric(item.metrics.unswept)} por barrer</span> : null}
              </footer>
            </section>
          );
        })}
      </div>
    </article>
  );
}

function AcreditacionPhoneIncidenceSection({
  responsibleRows,
}: {
  responsibleRows: Array<Record<string, unknown>>;
}) {
  const hasIncidence = responsibleRows.some((row) => {
    const metrics = phoneResponsibleMetrics(row);
    return metrics.swept != null || metrics.nonEffective != null || metrics.incidencePct != null;
  });
  if (!hasIncidence) {
    return (
      <EmptyPanel
        title="Sin incidencia de base"
        detail="Aún no hay llamadas barridas. Primero asigna responsables y sincroniza estados de llamada."
      />
    );
  }
  return (
    <section className="mon-phone-ops-insights" aria-label="Incidencia de la base telefónica">
      <AcreditacionPhoneIncidenceInsights rows={responsibleRows} />
    </section>
  );
}

function phoneAttemptValue(row: Record<string, unknown>, label: string) {
  return phoneRowNumber(row, [label], 0);
}

const ACREDITACION_PHONE_ATTEMPT_BUCKETS = [
  { key: "1", label: "1", detail: "1 intento", candidates: ["1 intento"] },
  { key: "2", label: "2", detail: "2 intentos", candidates: ["2 intentos"] },
  { key: "3", label: "3", detail: "3 intentos", candidates: ["3 intentos"] },
  { key: "4", label: "4", detail: "4 intentos", candidates: ["4 intentos"] },
  { key: "5", label: "5", detail: "5 intentos", candidates: ["5 intentos"] },
  {
    key: "6plus",
    label: "6+",
    detail: "6 o más intentos",
    candidates: ["6 intentos", "6 o mas intentos", "6 o más intentos", "7 intentos", "mas de 7 intentos", "más de 7 intentos"],
  },
] as const;

type AcreditacionPhoneAttemptBucket = typeof ACREDITACION_PHONE_ATTEMPT_BUCKETS[number];

function phoneAttemptBucketValue(row: Record<string, unknown>, bucket: AcreditacionPhoneAttemptBucket) {
  return bucket.candidates.reduce((sum, candidate) => sum + phoneAttemptValue(row, candidate), 0);
}

function phoneOpsPercent(value: number, total: number) {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

function phoneAttemptIntensity(avg: number | null) {
  if (avg == null) return { key: "unknown", label: "S/D insistencia" };
  if (avg >= 4) return { key: "high", label: "Insistencia alta" };
  if (avg >= 3) return { key: "medium", label: "Insistencia media" };
  return { key: "low", label: "Insistencia baja" };
}

type AcreditacionPhoneNoAnswerCase = {
  id: string;
  name: string;
  actor: string;
  code: string;
  status: string;
  attempts: number;
  target: number;
  ratioPct: number;
  dateLabel: string;
  intensity: ReturnType<typeof phoneAttemptIntensity>;
};

function phoneCaseDateLabel(row: Record<string, unknown>) {
  const raw = phoneRowValue(row, ["Fecha"], "");
  if (!raw || normalizeSourceMatch(raw).includes("sin fecha")) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

function phoneNoAnswerCaseFromRow(row: Record<string, unknown>, index: number, ownerKey: string): AcreditacionPhoneNoAnswerCase {
  const rawName = phoneRowValue(row, ["Caso", "Persona", "Nombre", "Nombres", "Apellidos y nombres"], "");
  const code = phoneRowValue(row, ["CodPulso", "Codigo", "Código", "Llave"], "");
  const attempts = Math.max(0, Math.floor(phoneRowNumber(row, ["Intentos"], 0)));
  const target = Math.max(1, Math.floor(phoneRowNumber(row, ["Intentos objetivo", "Objetivo intentos"], 4)));
  const ratioSource = phoneRowOptionalNumber(row, ["Ratio insistencia", "Ratio de insistencia"]);
  const ratio = Math.max(0, ratioSource ?? attempts / target);
  return {
    id: `${ownerKey || "responsable"}-${code || rawName || index}-${index}`,
    name: rawName || code || "Caso sin nombre",
    actor: phoneRowValue(row, ["Actor", "Unidad"], "Sin actor"),
    code,
    status: phoneRowValue(row, ["Estado", "Status", "Estatus"], "No contesta"),
    attempts,
    target,
    ratioPct: Math.max(0, Math.min(100, ratio * 100)),
    dateLabel: phoneCaseDateLabel(row),
    intensity: phoneAttemptIntensity(attempts || null),
  };
}

function phoneAttemptCountLabel(value: number) {
  return value === 1 ? "1 intento" : `${formatMetric(value)} intentos`;
}

function AcreditacionPhoneSupervisionBoard({
  reports,
  alertRows,
  responsibleRows,
  pendingRows,
  insistenceRows,
  reattemptRows,
  totals,
  fallbackEffective,
}: {
  reports: MonitoreoAcreditacionReports;
  alertRows: Array<Record<string, unknown>>;
  responsibleRows: Array<Record<string, unknown>>;
  pendingRows: Array<Record<string, unknown>>;
  insistenceRows: Array<Record<string, unknown>>;
  reattemptRows: Array<Record<string, unknown>>;
  totals: ReturnType<typeof phoneOperationTotals>;
  fallbackEffective: number;
}) {
  const sampleRows = acreditacionPhoneControlSampleRows(reports);
  const model = buildAcreditacionPhoneSupervisionModel({ alertRows, pendingRows, insistenceRows, reattemptRows });
  const controlPlan = buildAcreditacionPhoneSupervisionControlPlan({
    responsibleRows,
    sampleRows,
    priorityGroups: model.priorityGroups,
    fallbackEffective: Math.max(totals.effective, fallbackEffective),
  });
  const timeControl = buildAcreditacionPhoneTimeControl({
    alerts: model.alerts,
    totalEffective: Math.max(controlPlan.totalEffective, totals.effective, fallbackEffective),
  });
  const handleExport = () => {
    downloadRowsAsCsv(
      controlPlan.exportRows,
      `base-barrido-supervision-${controlPlan.hasReadBase ? "leida" : "propuesta"}-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  };
  return (
    <div className="mon-phone-supervision-shell" aria-label="Supervisión telefónica">
      <section className={`mon-phone-supervision-hero is-${model.highest}`} aria-label="Resumen de supervisión telefónica">
        <div className="mon-phone-supervision-lead">
          <span>
            {model.highest === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {acreditacionQualityStatusLabel(model.highest)}
          </span>
          <strong>{timeControl.totalEffective ? "Control de tiempo y muestra" : "Sin producción efectiva"}</strong>
          <p>Primero se revisa duración de efectivas Kobo; luego se define la muestra de supervisión por responsable.</p>
        </div>
        <div className="mon-phone-supervision-metrics">
          <span className={timeControl.totalEffective ? "is-base" : "is-warning"}><em>Efectivas Kobo</em><strong>{formatMetric(timeControl.totalEffective)}</strong><small>pasan filtro</small></span>
          <span className={timeControl.under2 ? "is-warning" : "is-ready"}><em>{"<2 min"}</em><strong>{formatMetric(timeControl.under2)}</strong><small>prioridad</small></span>
          <span className={timeControl.under5 ? "is-warning" : "is-ready"}><em>{"<5 min"}</em><strong>{formatMetric(timeControl.under5)}</strong><small>revisión</small></span>
          <span className={controlPlan.hasReadBase ? "is-ready" : "is-warning"}><em>Muestra</em><strong>{formatMetric(controlPlan.selectedTotal)}</strong><small>{controlPlan.hasReadBase ? "leída" : "propuesta"}</small></span>
        </div>
      </section>

      <div className="mon-phone-supervision-grid">
        <div className="mon-phone-supervision-primary">
          <AcreditacionPhoneSupervisionTimeControl model={timeControl} />
          <AcreditacionPhoneSupervisionSamplePlan plan={controlPlan} onExport={handleExport} />
        </div>
        <aside className="mon-phone-supervision-aside">
          <AcreditacionPhoneSupervisionPriorityPanel groups={model.priorityGroups} />
          <AcreditacionPhoneSupervisionBaseState plan={controlPlan} sampleRows={sampleRows} />
        </aside>
      </div>
    </div>
  );
}

function AcreditacionPhoneSupervisionTimeControl({ model }: { model: AcreditacionPhoneTimeControlModel }) {
  const reviewTone = model.under2 ? "danger" : model.under5 ? "warning" : "ok";
  const visibleAlerts = model.alerts.slice(0, 4);
  return (
    <section className={`mon-phone-time-control is-${reviewTone}`} aria-label="Control de tiempo de encuestas Kobo">
      <header className="mon-phone-ops-head">
        <div>
          <span>Control de tiempo</span>
          <strong>Duración de efectivas Kobo</strong>
        </div>
        <em>{formatMetric(model.flaggedTotal)} por revisar</em>
      </header>
      <div className="mon-phone-time-track" aria-label="Distribución por duración">
        {model.buckets.map((bucket) => (
          <span
            key={bucket.key}
            className={`is-${bucket.key}`}
            style={{ width: `${bucket.count > 0 ? Math.max(4, bucket.percent) : 0}%` } as CSSProperties}
            title={`${bucket.label}: ${formatMetric(bucket.count)} (${formatPercentLabel(bucket.percent)})`}
          />
        ))}
      </div>
      <div className="mon-phone-time-buckets">
        {model.buckets.map((bucket) => (
          <article key={`phone-time-bucket-${bucket.key}`} className={`is-${bucket.key} is-${bucket.tone}`}>
            <span>{bucket.label}</span>
            <strong>{formatMetric(bucket.count)}</strong>
            <em>{bucket.hint}</em>
          </article>
        ))}
      </div>
      <div className="mon-phone-time-alerts">
        {visibleAlerts.length ? visibleAlerts.map((alert) => (
          <article key={`phone-time-alert-${alert.id}`} className={`is-${alert.tone}`}>
            <span>{phoneDurationAlertThreshold(alert) <= 2 ? "<2 min" : "<5 min"}</span>
            <strong>{alert.title}</strong>
            <p>{phoneDurationAlertDisplayDetail(alert)}</p>
            <em>{formatMetric(phoneAlertCaseCount(alert))} caso{phoneAlertCaseCount(alert) === 1 ? "" : "s"}</em>
          </article>
        )) : (
          <p>No hay señales de duración corta en el corte. Las efectivas se mantienen como 5+ min salvo nueva evidencia.</p>
        )}
      </div>
    </section>
  );
}

function phoneDurationAlertDisplayDetail(alert: AcreditacionQualityAlertItem) {
  return (alert.detail || "Revisar duración y consistencia de la respuesta.")
    .replace(/\s*Fuente:.*$/i, "")
    .trim();
}

function AcreditacionPhoneSupervisionSamplePlan({
  plan,
  onExport,
}: {
  plan: AcreditacionPhoneSupervisionControlPlan;
  onExport: () => void;
}) {
  return (
    <section className="mon-phone-supervision-plan" aria-label="Base de barrido de supervisión">
      <header className="mon-phone-ops-head">
        <div>
          <span>Base de barrido de supervisión</span>
          <strong>{plan.hasReadBase ? "Lectura de base cargada" : "Propuesta 30% por responsable"}</strong>
        </div>
        <button type="button" className="mon-phone-supervision-export" onClick={onExport} disabled={!plan.exportRows.length}>
          <Download size={13} />
          Exportar CSV
        </button>
      </header>
      <div className="mon-phone-supervision-plan-strip" aria-label="Resumen de muestra de supervisión">
        <span><em>Responsables</em><strong>{formatMetric(plan.rows.length)}</strong></span>
        <span><em>Objetivo</em><strong>{formatMetric(plan.targetTotal)}</strong></span>
        <span><em>{plan.hasReadBase ? "Leídos" : "Propuestos"}</em><strong>{formatMetric(plan.selectedTotal)}</strong></span>
        <span className={plan.gapTotal ? "is-warning" : "is-ready"}><em>{plan.hasReadBase ? "Brecha" : "Por generar"}</em><strong>{formatMetric(plan.gapTotal)}</strong></span>
      </div>
      <DataTable
        rows={plan.tableRows}
        empty="No hay efectivas por responsable para proponer una base de supervisión."
        preferredColumns={["Responsable", "Base", "Efectivas", "Objetivo 30%", plan.hasReadBase ? "Base leída" : "Base propuesta", "Por completar", "Cobertura", "Prioridad"]}
        maxColumns={8}
      />
    </section>
  );
}

function AcreditacionPhoneSupervisionBaseState({
  plan,
  sampleRows,
}: {
  plan: AcreditacionPhoneSupervisionControlPlan;
  sampleRows: Array<Record<string, unknown>>;
}) {
  const status = plan.hasReadBase ? "Base leída" : "Base propuesta";
  return (
    <section className="mon-phone-supervision-source" aria-label="Estado de base de supervisión">
      <header className="mon-phone-ops-head">
        <div>
          <span>Lectura y entregable</span>
          <strong>{status}</strong>
        </div>
        <em>{plan.hasReadBase ? `${formatMetric(sampleRows.length)} filas` : "CSV local"}</em>
      </header>
      <div className="mon-phone-supervision-source-list">
        <span>
          <strong>{plan.hasReadBase ? "Lectura" : "Definición"}</strong>
          <em>{plan.hasReadBase ? "bloque muestra_control" : "objetivo 30% por responsable"}</em>
        </span>
        <span>
          <strong>Entregables</strong>
          <em>{plan.hasReadBase ? "lista para publicar" : "requiere generación formal"}</em>
        </span>
        <span>
          <strong>Cobertura</strong>
          <em>{plan.coveragePct == null ? "Sin lectura" : formatPercentLabel(plan.coveragePct)}</em>
        </span>
      </div>
    </section>
  );
}

function AcreditacionPhoneSupervisionPriorityPanel({ groups }: { groups: AcreditacionPhoneSupervisionModel["priorityGroups"] }) {
  return (
    <section className="mon-phone-supervision-priority" aria-label="Prioridades de supervisión telefónica">
      <header className="mon-phone-ops-head">
        <div>
          <span>Prioridad operativa</span>
          <strong>Qué revisar primero</strong>
        </div>
        <em>{formatMetric(groups.length)} foco{groups.length === 1 ? "" : "s"}</em>
      </header>
      <div>
        {groups.length ? groups.map((group) => (
          <article key={group.key} className={`is-${group.tone}`}>
            <span>{acreditacionQualityStatusLabel(group.tone)}</span>
            <strong>{group.title}</strong>
            <p>{group.detail}</p>
            <em>{formatMetric(group.count)} caso{group.count === 1 ? "" : "s"}</em>
          </article>
        )) : (
          <EmptyPanel title="Sin prioridades telefónicas" detail="No hay alertas activas de llamadas, responsables o barrido." />
        )}
      </div>
    </section>
  );
}

function AcreditacionPhoneQualityAlertsPanel({
  model,
  generatedAt,
}: {
  model: AcreditacionPhoneSupervisionModel;
  generatedAt: string;
}) {
  const visibleAlerts = model.activeAlerts;
  const signalRows = acreditacionPhoneAlertSignalRows(visibleAlerts);
  const observationCount = visibleAlerts.length;
  const impactedCases = model.activeAlertCount;
  const observationLabel = observationCount === 1 ? "observación" : "observaciones";
  const heroTitle = observationCount
    ? `${formatMetric(observationCount)} ${observationLabel} localizada${observationCount === 1 ? "" : "s"}`
    : "No hay observaciones telefónicas activas";
  const heroCopy = observationCount
    ? `Impactan ${formatMetric(impactedCases)} caso${impactedCases === 1 ? "" : "s"} y separan preparación, asignación y calidad antes de pasar a supervisión.`
    : "El reporte canónico no trae señales de enlace, duración, asignación o conciliación Kobo-barrido.";
  const summary = [
    { label: "Observaciones", value: formatMetric(observationCount), hint: observationCount ? "filas agregadas" : "sin pendientes", tone: model.highest },
    { label: "Casos impactados", value: formatMetric(impactedCases), hint: impactedCases ? "requieren lectura" : "sin impacto", tone: impactedCases ? model.highest : "ok" },
    { label: "Prioridad", value: acreditacionQualityPriorityValue(model.highest), hint: observationCount ? "nivel más alto" : "lista", tone: model.highest },
  ];
  return (
    <section className={`mon-quality-alert-panel is-${model.highest}`} aria-label="Observaciones telefónicas accionables">
      <header className="mon-quality-section-head">
        <div>
          <span>Alertas telefónicas</span>
          <strong><ShieldAlert size={16} /> Observaciones de llamadas y asignación</strong>
        </div>
        <div className="mon-quality-alert-meta">
          <span>{generatedAt ? formatDate(generatedAt) : "Sin sincronizar"}</span>
          <span>{formatMetric(observationCount)} activa{observationCount === 1 ? "" : "s"}</span>
        </div>
      </header>
      <div className="mon-quality-alert-hero">
        <div className="mon-quality-alert-lead">
          <span className="mon-quality-alert-chip">
            {model.highest === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {acreditacionQualityStatusLabel(model.highest)}
          </span>
          <strong>{heroTitle}</strong>
          <p>{heroCopy}</p>
        </div>
        <div className="mon-quality-alert-stats">
          {summary.map((item) => (
            <span key={item.label} className={`is-${item.tone}`}>
              <em>{item.label}</em>
              <strong>{item.value}</strong>
              <small>{item.hint}</small>
            </span>
          ))}
        </div>
      </div>

      <div className="mon-quality-alert-layout">
        <div className="mon-quality-alert-list" aria-label="Observaciones localizadas">
          {visibleAlerts.length ? visibleAlerts.map((alert) => (
            <AcreditacionPhoneQualityAlertCard key={alert.id} alert={alert} />
          )) : (
            <EmptyPanel title="Sin observaciones telefónicas" detail="El bloque canónico de alertas no trae señales de llamadas o asignación para este corte." />
          )}
        </div>

        <aside className="mon-quality-alert-where" aria-label="Ubicación de observaciones">
          <div>
            <span>Dónde revisar primero</span>
            <strong>{model.locations.length ? `${model.locations.length} punto${model.locations.length === 1 ? "" : "s"}` : "Sin puntos pendientes"}</strong>
          </div>
          {model.locations.length ? (
            <div className="mon-quality-alert-where-list">
              {model.locations.map((location) => (
                <div key={location.where} className={`is-${location.tone}`}>
                  <span>
                    <strong>{location.where}</strong>
                    <em>{formatMetric(location.count)} caso{location.count === 1 ? "" : "s"}</em>
                  </span>
                  <i style={{ "--quality-location-pct": `${location.percent}%` } as CSSProperties} />
                </div>
              ))}
            </div>
          ) : (
            <p>El barrido telefónico no muestra observaciones pendientes.</p>
          )}
          <div className="mon-quality-alert-rulebook" aria-label="Reglas de alerta telefónica">
            <span>Señales entrenadas</span>
            {ACREDITACION_PHONE_ALERT_RULES.map((rule) => {
              const active = signalRows.find((row) => row.kind === rule.kind);
              return (
                <div key={rule.kind} className={active ? "is-active" : ""}>
                  <strong>{rule.label}</strong>
                  <em>{active ? `${formatMetric(active.count)} caso${active.count === 1 ? "" : "s"}` : "vigilada"}</em>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </section>
  );
}

function acreditacionPhoneAlertSignalRows(alerts: AcreditacionQualityAlertItem[]) {
  const rows = new Map<string, { kind: string; label: string; count: number }>();
  alerts.forEach((alert) => {
    const current = rows.get(alert.signal.kind) ?? { kind: alert.signal.kind, label: alert.signal.label, count: 0 };
    current.count += alert.count ?? 1;
    rows.set(alert.signal.kind, current);
  });
  return Array.from(rows.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
}

function AcreditacionPhoneQualityAlertCard({ alert }: { alert: AcreditacionQualityAlertItem }) {
  return (
    <article className={`mon-quality-alert-card is-${alert.tone}`}>
      <div className="mon-quality-alert-card-head">
        <span>{acreditacionQualityLevelLabel(alert.level, alert.tone)}</span>
        <span>{alert.signal.label}</span>
        {alert.count != null && <em>{formatMetric(alert.count)} caso{alert.count === 1 ? "" : "s"}</em>}
      </div>
      <strong>{alert.title}</strong>
      <p>{alert.detail}</p>
      <span className="mon-quality-alert-action">
        <ClipboardCheck size={13} />
        {acreditacionQualityActionLabel(alert)}
      </span>
      <div className="mon-quality-alert-foot">
        <span><Route size={13} /> {alert.where}</span>
        {alert.code && <span>Código {alert.code}</span>}
        {alert.total != null && alert.count != null && alert.total > 0 && (
          <span>{formatPercentLabel(safePercentValue(alert.count, alert.total))} del grupo</span>
        )}
      </div>
    </article>
  );
}

function acreditacionPhoneControlSampleRows(reports: MonitoreoAcreditacionReports) {
  return rowsForSheetBlock(reports, "monitoreo_telefonico", ["muestra_control", "muestra_supervision", "control_sample"]);
}

function AcreditacionPhonePendingInsistence({
  pendingRows,
  insistenceRows,
  detailRows,
  reattemptRows,
}: {
  pendingRows: Array<Record<string, unknown>>;
  insistenceRows: Array<Record<string, unknown>>;
  detailRows: Array<Record<string, unknown>>;
  reattemptRows: Array<Record<string, unknown>>;
}) {
  const rowsByName = new Map<string, {
    key: string;
    name: string;
    pending: Record<string, unknown> | null;
    insistence: Record<string, unknown> | null;
    reattempt: Record<string, unknown> | null;
    details: Array<Record<string, unknown>>;
  }>();
  const ensure = (row: Record<string, unknown>, index: number) => {
    const name = phoneResponsibleName(row, index);
    const key = normalizeSourceMatch(name) || `responsable-${index}`;
    const current = rowsByName.get(key) ?? { key, name, pending: null, insistence: null, reattempt: null, details: [] };
    rowsByName.set(key, current);
    return current;
  };
  pendingRows.filter((row, index) => !phoneIsUnassignedResponsible(phoneResponsibleName(row, index))).forEach((row, index) => { ensure(row, index).pending = row; });
  insistenceRows.filter((row, index) => !phoneIsUnassignedResponsible(phoneResponsibleName(row, index))).forEach((row, index) => { ensure(row, index).insistence = row; });
  reattemptRows.filter((row, index) => !phoneIsUnassignedResponsible(phoneResponsibleName(row, index))).forEach((row, index) => { ensure(row, index).reattempt = row; });
  detailRows.filter((row, index) => !phoneIsUnassignedResponsible(phoneResponsibleName(row, index))).forEach((row, index) => { ensure(row, index).details.push(row); });

  const rows = Array.from(rowsByName.values()).map((record) => {
    const pending = phoneRowNumber(record.pending ?? {}, ["No barridos", "Por barrer"], 0);
    const assigned = phoneRowOptionalNumber(record.pending ?? {}, ["Casos asignados", "Asignados"]);
    const swept = assigned == null ? null : Math.max(0, assigned - pending);
    const noAnswer = phoneRowNumber(record.insistence ?? {}, ["Casos no contesta"], 0);
    const avg = phoneRowOptionalNumber(record.insistence ?? {}, ["Promedio intentos"]);
    const buckets = ACREDITACION_PHONE_ATTEMPT_BUCKETS.map((bucket, index) => ({
      ...bucket,
      index,
      value: phoneAttemptBucketValue(record.insistence ?? {}, bucket),
    }));
    const noAnswerCases = record.details
      .map((item, index) => phoneNoAnswerCaseFromRow(item, index, record.key))
      .sort((a, b) => a.attempts - b.attempts || a.name.localeCompare(b.name, "es"));
    return {
      ...record,
      assigned,
      swept,
      pending,
      noAnswer,
      avg,
      buckets,
      reattemptable: phoneRowOptionalNumber(record.reattempt ?? {}, ["Casos reintentables"]),
      lowReattempt: phoneRowOptionalNumber(record.reattempt ?? {}, ["Reintentos bajos"]),
      noAnswerCases,
      intensity: phoneAttemptIntensity(avg),
    };
  }).sort((a, b) => b.pending - a.pending || b.noAnswer - a.noAnswer || a.name.localeCompare(b.name, "es"));

  const totalAssigned = rows.reduce((sum, row) => sum + (row.assigned ?? 0), 0);
  const totalPending = rows.reduce((sum, row) => sum + row.pending, 0);
  const totalNoAnswer = rows.reduce((sum, row) => sum + row.noAnswer, 0);
  const totalAttemptCases = rows.reduce((sum, row) => sum + row.buckets.reduce((inner, bucket) => inner + bucket.value, 0), 0);
  const weightedAttempts = rows.reduce((sum, row) => (
    sum + row.buckets.reduce((inner, bucket, index) => inner + (bucket.value * (index === 5 ? 6 : index + 1)), 0)
  ), 0);
  const avgAttempts = totalAttemptCases > 0 ? weightedAttempts / totalAttemptCases : null;
  const totalBuckets = ACREDITACION_PHONE_ATTEMPT_BUCKETS.map((bucket, index) => ({
    ...bucket,
    value: rows.reduce((sum, row) => sum + (row.buckets[index]?.value ?? 0), 0),
  }));
  const unassignedPending = pendingRows.filter((row, index) => phoneIsUnassignedResponsible(phoneResponsibleName(row, index)));
  const unassignedCases = unassignedPending.reduce((sum, row) => sum + phoneRowNumber(row, ["No barridos", "Por barrer", "Casos asignados"], 0), 0);

  if (!rows.length) return <EmptyPanel title="Sin pendientes telefónicos" detail="Los no-contactos, insistencias y reintentos aparecerán después de sincronizar estados de llamada." />;
  return (
    <article className="mon-phone-ops-card mon-phone-ops-card--pending-workbench">
      <header className="mon-phone-ops-head">
        <div>
          <span>Pendientes e insistencia</span>
          <strong>Barrido pendiente y fuerza de contacto por responsable</strong>
        </div>
        <em>{formatMetric(rows.length)} responsables</em>
      </header>
      <div className="mon-phone-pending-workbench-summary">
        <span><strong>{formatMetric(totalAssigned)}</strong><em>personas asignadas</em></span>
        <span className={totalPending ? "is-warning" : "is-ok"}><strong>{formatMetric(totalPending)}</strong><em>casos por barrer</em></span>
        <span><strong>{formatMetric(totalNoAnswer)}</strong><em>casos que no contestan</em></span>
        <span><strong>{avgAttempts == null ? "S/D" : avgAttempts.toLocaleString("es-PE", { maximumFractionDigits: 1 })}</strong><em>promedio de intentos</em></span>
      </div>
      <div className="mon-phone-attempt-scale" aria-label="Escala de insistencia por intentos">
        {totalBuckets.map((bucket, index) => (
          <span key={bucket.key} className={`is-bucket-${index + 1}`}>
            <strong>{bucket.detail}</strong>
            <em>{formatMetric(bucket.value)}</em>
          </span>
        ))}
      </div>
      <div className="mon-phone-pending-workbench-list">
        {rows.map((row) => {
          const assigned = Math.max(0, row.assigned ?? row.pending);
          const swept = Math.max(0, row.swept ?? Math.max(0, assigned - row.pending));
          const pendingPct = safePercentValue(row.pending, assigned) ?? 0;
          const sweptPct = safePercentValue(swept, assigned) ?? 0;
          const attemptTotal = Math.max(1, row.noAnswer);
          return (
            <section key={row.key} className={`mon-phone-pending-person is-${row.pending ? "pending" : "clear"}`}>
              <header>
                <div>
                  <strong>{row.name}</strong>
                  <em>{formatMetric(assigned)} personas asignadas · {formatMetric(row.noAnswer)} casos sin respuesta telefónica</em>
                </div>
                <span className={row.pending ? "is-warning" : "is-ok"}>
                  <strong>{formatMetric(row.pending)}</strong>
                  <em>casos por barrer</em>
                </span>
              </header>
              <div className="mon-phone-pending-track-block">
                <div className="mon-phone-track-labels">
                  <span><strong>{formatMetric(swept)}</strong><em>casos barridos</em></span>
                  <span><strong>{formatMetric(row.pending)}</strong><em>casos por barrer</em></span>
                </div>
                <div className="mon-phone-pending-track" aria-label={`${row.name}: ${formatMetric(swept)} barridos y ${formatMetric(row.pending)} por barrer`}>
                  {swept > 0 ? <i className="is-swept" style={{ "--phone-segment": `${Math.max(0, Math.min(100, sweptPct))}%` } as CSSProperties} /> : null}
                  {row.pending > 0 ? <i className="is-pending" style={{ "--phone-segment": `${Math.max(0, Math.min(100, pendingPct))}%` } as CSSProperties} /> : null}
                  {!swept && !row.pending ? <i className="is-empty" style={{ "--phone-segment": "100%" } as CSSProperties} /> : null}
                </div>
              </div>
              <div className="mon-phone-attempt-track-block">
                <div className="mon-phone-track-labels">
                  <span><strong>{row.avg == null ? "S/D" : row.avg.toLocaleString("es-PE", { maximumFractionDigits: 1 })}</strong><em>promedio de intentos</em></span>
                  <span><strong>{formatMetric(row.reattemptable ?? 0)}</strong><em>casos reintentables</em></span>
                </div>
                <div className="mon-phone-attempt-track" aria-label={`${row.name}: distribución de intentos en casos que no contestan`}>
                  {row.buckets.map((bucket) => (
                    bucket.value > 0 ? (
                      <i key={`${row.key}-${bucket.key}`} className={`is-bucket-${bucket.index + 1}`} style={{ "--phone-segment": `${Math.max(3, Math.min(100, phoneOpsPercent(bucket.value, attemptTotal)))}%` } as CSSProperties} />
                    ) : null
                  ))}
                  {!row.buckets.some((bucket) => bucket.value > 0) ? <i className="is-empty" style={{ "--phone-segment": "100%" } as CSSProperties} /> : null}
                </div>
                <div className="mon-phone-attempt-inline-counts">
                  {row.buckets.map((bucket) => (
                    <span key={`${row.key}-${bucket.key}-count`} className={`is-bucket-${bucket.index + 1}`}>
                      <em>{bucket.detail}</em>
                      <strong>{formatMetric(bucket.value)}</strong>
                    </span>
                  ))}
                </div>
              </div>
              {row.noAnswerCases.length ? (
                <div className="mon-phone-noanswer-cases">
                  <header>
                    <span>Casos que no contestan</span>
                    <strong>{formatMetric(row.noAnswerCases.length)} caso{row.noAnswerCases.length === 1 ? "" : "s"} con intento registrado</strong>
                  </header>
                  <div className="mon-phone-noanswer-list">
                    {row.noAnswerCases.map((item) => (
                      <article key={item.id} className={`is-${item.intensity.key}`}>
                        <div>
                          <strong>{item.name}</strong>
                          <em>{item.actor}{item.code ? ` · CodPulso ${item.code}` : " · sin CodPulso"}{item.dateLabel ? ` · ${item.dateLabel}` : ""}</em>
                        </div>
                        <span><strong>{phoneAttemptCountLabel(item.attempts)}</strong><em>de {formatMetric(item.target)} intentos base</em></span>
                        <i title={`${item.status}: ${phoneAttemptCountLabel(item.attempts)} de ${formatMetric(item.target)}`}>
                          <b style={{ "--phone-case-pct": `${item.ratioPct}%` } as CSSProperties} />
                        </i>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
              <footer>
                <span className={`is-${row.intensity.key}`}>{row.intensity.label}</span>
                {row.lowReattempt != null && row.lowReattempt > 0 ? <span>{formatMetric(row.lowReattempt)} casos con baja insistencia</span> : null}
              </footer>
            </section>
          );
        })}
      </div>
      {unassignedPending.length ? (
        <aside className="mon-phone-unassigned">
          <AlertCircle size={16} />
          <div>
            <span>Sin responsable asignado</span>
            <strong>{formatMetric(unassignedCases)} casos por asignar</strong>
            <em>Se gestionan como brecha de asignación.</em>
          </div>
        </aside>
      ) : null}
    </article>
  );
}

function AcreditacionPhoneDailyStatusBars({ series }: { series: AcreditacionPhoneDailyStatusSeries[] }) {
  if (!series.length) return null;
  const preparedSeries = series.map((item) => {
    const datedPoints = item.points.filter((point) => point.date);
    const datedTotal = datedPoints.reduce((sum, point) => sum + point.value, 0);
    const undatedTotal = item.points.reduce((sum, point) => sum + (!point.date ? point.value : 0), 0);
    return { ...item, points: datedPoints, datedTotal, undatedTotal };
  });
  const visibleSeries = preparedSeries.filter((item) => item.datedTotal > 0).slice(0, 8);
  const maxPoint = Math.max(1, ...visibleSeries.flatMap((item) => item.points.map((point) => point.value)));
  const total = series.reduce((sum, item) => sum + item.total, 0);
  const datedTotal = preparedSeries.reduce((sum, item) => sum + item.datedTotal, 0);
  const undatedSeries = preparedSeries.filter((item) => item.undatedTotal > 0).slice(0, 6);
  const undatedTotal = preparedSeries.reduce((sum, item) => sum + item.undatedTotal, 0);
  return (
    <div className="mon-phone-status-daily" aria-label="Estados telefónicos por día">
      <header className="mon-phone-status-daily-head">
        <div>
          <span>Estados telefónicos</span>
          <strong>Lectura paralela por día</strong>
        </div>
        <em>{formatMetric(datedTotal)} con fecha / {formatMetric(total)} total</em>
      </header>
      {visibleSeries.length ? (
        <div className="mon-phone-status-daily-grid">
          {visibleSeries.map((item) => {
            const palette = phoneStatusPalette(item.label);
            return (
              <section
                key={`phone-status-day-${normalizeSourceMatch(item.label)}`}
                className={`is-${phoneStatusTone(item.label)}`}
                style={{
                  "--phone-status-color": palette.color,
                  "--phone-status-color-hi": palette.highlight,
                } as CSSProperties}
              >
                <div className="mon-phone-status-daily-title">
                  <strong>{item.label}</strong>
                  <em>{formatMetric(item.datedTotal)}</em>
                </div>
                <div className="mon-phone-status-daily-bars" aria-label={`${item.label}: distribución diaria`}>
                  {item.points.map((point) => {
                    const size = point.value > 0 ? Math.max(5, Math.min(100, (point.value / maxPoint) * 100)) : 0;
                    return (
                      <span key={`${item.label}-${point.rawLabel}`} title={`${item.label} · ${point.label}: ${formatMetric(point.value)}`}>
                        <i style={{ "--phone-status-day": `${size}%` } as CSSProperties} />
                        <small>{point.axisLabel || point.label}</small>
                        <b>{formatMetric(point.value)}</b>
                      </span>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <p className="mon-phone-status-note">El barrido trae estados telefónicos, pero todavía no tienen una fecha diaria usable para graficar.</p>
      )}
      {undatedTotal > 0 && (
        <div className="mon-phone-status-undated" aria-label="Estados telefónicos sin fecha diaria">
          <strong>{formatMetric(undatedTotal)} casos sin fecha fuera del ritmo diario</strong>
          <div>
            {undatedSeries.map((item) => (
              <span key={`phone-status-undated-${normalizeSourceMatch(item.label)}`}>
                {item.label} <b>{formatMetric(item.undatedTotal)}</b>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AcreditacionPhoneDailyTrend({
  rows,
  statusRows = [],
}: {
  rows: Array<Record<string, unknown>>;
  statusRows?: Array<Record<string, unknown>>;
}) {
  const points = buildAcreditacionPhoneDailyPoints(rows);
  const statusSeries = buildAcreditacionPhoneDailyStatusSeries(statusRows);
  const loosePoints = points.filter((point) => !point.date);
  const datedPoints = points.filter((point) => point.date);
  const series = datedPoints;
  const pointTotal = (point: AcreditacionPhoneDailyPoint) => point.effective;
  let runningTotal = 0;
  const chartRows = series.map((point) => {
    const dailyTotal = pointTotal(point);
    runningTotal += dailyTotal;
    return {
      ...point,
      dailyTotal,
      cumulativeTotal: runningTotal,
    };
  });
  const totalPeriod = chartRows[chartRows.length - 1]?.cumulativeTotal ?? 0;
  const averagePerDay = chartRows.length ? totalPeriod / chartRows.length : 0;
  const averageLabel = averagePerDay.toLocaleString("es-PE", {
    maximumFractionDigits: averagePerDay < 10 ? 1 : 0,
  });
  const bestPoint = chartRows.reduce<(AcreditacionPhoneDailyPoint & { dailyTotal: number; cumulativeTotal: number }) | null>((best, point) => (
    !best || point.dailyTotal > best.dailyTotal ? point : best
  ), null);
  const lastPoint = [...chartRows].reverse().find((point) => point.date) ?? chartRows[chartRows.length - 1] ?? null;
  const xLabels = chartRows.map((point) => point.axisLabel || point.label);
  const hoverData = chartRows.map((point) => [
    point.label,
    point.effective,
    point.dailyTotal,
    point.cumulativeTotal,
  ]);
  const chartData = [
    {
      type: "bar" as const,
      name: "Efectivas",
      x: xLabels,
      y: chartRows.map((point) => point.effective),
      marker: { color: "#168a55", line: { width: 0 } },
      customdata: hoverData,
      hovertemplate: "Efectivas: %{y}<extra></extra>",
    },
    {
      type: "scatter" as const,
      mode: "lines+markers" as const,
      name: "Acumulado",
      x: xLabels,
      y: chartRows.map((point) => point.cumulativeTotal),
      yaxis: "y2",
      line: { color: "#17212f", width: 3, shape: "spline" as const, smoothing: 0.45 },
      marker: {
        color: "#ffffff",
        size: 8,
        line: { color: "#17212f", width: 2 },
      },
      customdata: hoverData,
      hovertemplate: "Efectivas Kobo: %{customdata[2]}<br>Acumulado: %{customdata[3]}<extra></extra>",
    },
  ];
  const chartLayout = {
    barmode: "stack" as const,
    bargap: chartRows.length <= 1 ? 0.72 : chartRows.length <= 7 ? 0.42 : 0.24,
    hovermode: "x unified" as const,
    showlegend: false,
    margin: { l: 48, r: 58, t: 14, b: chartRows.length > 7 ? 70 : 48 },
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    hoverlabel: {
      align: "left" as const,
      bgcolor: "#ffffff",
      bordercolor: "rgba(15, 23, 42, 0.12)",
      font: { color: "#17212f", size: 12 },
    },
    xaxis: {
      type: "category",
      fixedrange: true,
      showgrid: false,
      zeroline: false,
      tickangle: chartRows.length > 7 ? -32 : 0,
      tickfont: { color: "#5f6b7a", size: 10 },
      automargin: true,
    },
    yaxis: {
      title: { text: "Efectivas/día", font: { color: "#5f6b7a", size: 11 } },
      fixedrange: true,
      rangemode: "tozero",
      showline: false,
      zeroline: false,
      gridcolor: "rgba(15, 23, 42, 0.08)",
      tickfont: { color: "#5f6b7a", size: 10 },
    },
    yaxis2: {
      title: { text: "Acumulado", font: { color: "#17212f", size: 11 } },
      overlaying: "y",
      side: "right",
      fixedrange: true,
      rangemode: "tozero",
      showgrid: false,
      zeroline: false,
      tickfont: { color: "#17212f", size: 10 },
    },
  };
  const chartConfig = {
    displayModeBar: false,
    doubleClick: false,
    responsive: true,
    scrollZoom: false,
  };
  if (!chartRows.length) {
    if (statusSeries.length) {
      return (
        <div className="mon-phone-trend" aria-label="Composición temporal de estados telefónicos">
          <EmptyPanel
            title={points.length ? "Efectivas sin fecha diaria" : "Sin efectivas diarias"}
            detail={points.length ? "El corte trae efectivas Kobo sin fecha usable; se muestran fuera del gráfico para no crear un día ficticio." : "El corte no trae efectivas Kobo con fecha, pero sí estados telefónicos del barrido."}
          />
          <AcreditacionPhoneDailyStatusBars series={statusSeries} />
          {loosePoints.length > 0 && (
            <div className="mon-phone-trend-loose">
              {loosePoints.map((point) => (
                <span key={`loose-${point.rawLabel}`}>
                  <strong>{point.label}</strong>
                  <em>{formatMetric(point.effective)} efectivas Kobo sin fecha diaria</em>
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }
    if (loosePoints.length) {
      return (
        <div className="mon-phone-trend" aria-label="Efectivas Kobo sin fecha diaria">
          <EmptyPanel
            title="Efectivas sin fecha diaria"
            detail="El corte trae efectivas Kobo sin fecha usable; se muestran fuera del gráfico para no crear un día ficticio."
          />
          <div className="mon-phone-trend-loose">
            {loosePoints.map((point) => (
              <span key={`loose-${point.rawLabel}`}>
                <strong>{point.label}</strong>
                <em>{formatMetric(point.effective)} efectivas Kobo sin fecha diaria</em>
              </span>
            ))}
          </div>
        </div>
      );
    }
    return (
      <EmptyPanel
        title="Sin avance diario"
        detail="Cuando el corte traiga fecha de respuesta Kobo, aquí aparecerá el ritmo diario."
      />
    );
  }
  return (
    <div className="mon-phone-trend" aria-label="Efectivas Kobo por día">
      <header className="mon-phone-trend-head">
        <div>
          <span>Efectivas Kobo</span>
          <strong>Ritmo diario y acumulado</strong>
        </div>
        <div className="mon-phone-trend-legend" aria-label="Series">
          <span className="is-effective">Efectivas Kobo</span>
          <span className="is-cumulative">Acumulado</span>
        </div>
      </header>

      <div className="mon-phone-trend-metrics">
        <span className="is-total">
          <em>Total periodo</em>
          <strong>{formatMetric(totalPeriod)}</strong>
          <small>efectivas Kobo fechadas</small>
        </span>
        <span className="is-average">
          <em>Promedio/día</em>
          <strong>{averageLabel}</strong>
          <small>{formatMetric(chartRows.length)} cortes diarios</small>
        </span>
        <span className="is-best">
          <em>Mejor día</em>
          <strong>{bestPoint ? formatMetric(bestPoint.dailyTotal) : "S/D"}</strong>
          <small>{bestPoint?.label ?? "Sin fecha"}</small>
        </span>
        <span className="is-last">
          <em>Último corte</em>
          <strong>{lastPoint ? formatMetric(lastPoint.dailyTotal) : "S/D"}</strong>
          <small>{lastPoint?.label ?? "Sin fecha"}</small>
        </span>
      </div>

      <div className={`mon-phone-trend-parallel${statusSeries.length ? "" : " is-single"}`}>
        <div className="mon-phone-trend-chart">
          <PlotlyChart
            data={chartData}
            layout={chartLayout}
            config={chartConfig}
            height={340}
            ariaLabel="Efectivas Kobo diarias y acumuladas"
          />
        </div>

        <AcreditacionPhoneDailyStatusBars series={statusSeries} />
      </div>

      {loosePoints.length > 0 && (
        <div className="mon-phone-trend-loose">
          {loosePoints.map((point) => (
            <span key={`loose-${point.rawLabel}`}>
              <strong>{point.label}</strong>
              <em>{formatMetric(point.effective)} efectivas Kobo sin fecha diaria</em>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function phoneDailyBlockForPanel(reports: MonitoreoAcreditacionReports): MonitoreoReportBlock | null {
  const phoneEffective = reportBlockForSheet(reports, "monitoreo_telefonico", "avance_efectivo_dia");
  if (phoneEffective?.rows.length) return phoneEffective;

  const summaryEffective = reportBlockForSheet(reports, "resumen", "avance_efectivo_dia");
  if (summaryEffective?.rows.length) {
    const columns = reportBlockColumns(summaryEffective);
    const dateColumns = columns.filter((column) => {
      const key = normalizeReportMatch(column);
      return key && !["unidad", "actor", "estado", "estatus", "total"].includes(key);
    });
    const rows = dateColumns.map((column) => ({
      Fecha: column,
      Efectivas: summaryEffective.rows.reduce((sum, row) => sum + reportNumberValue(row[column]), 0),
    })).filter((row) => row.Efectivas > 0);
    if (rows.length) {
      return {
        id: "avance_efectivo_dia",
        title: "Avance efectivo por día",
        columns: ["Fecha", "Efectivas"],
        rows,
        note: "Corte diario consolidado desde el avance efectivo.",
      };
    }
  }

  return reportBlockForSheet(reports, "monitoreo_telefonico", "produccion_dia");
}

function phoneBooleanValue(row: Record<string, unknown>, keys: string[]) {
  const raw = phoneRowValue(row, keys, "");
  const key = normalizeSourceMatch(raw);
  if (["si", "sí", "yes", "true", "1"].includes(key)) return true;
  if (["no", "false", "0"].includes(key)) return false;
  return Boolean(phoneRowNumber(row, keys, 0));
}

type PhonePlatformComparisonTotals = {
  total: number;
  phoneEffective: number;
  platformComplete: number;
  matchedEffective: number;
  mismatch: number;
  phoneWithoutPlatform: number;
  platformWithoutPhone: number;
  withoutCode: number;
};

export function phonePlatformComparisonTotals(rows: Array<Record<string, unknown>>): PhonePlatformComparisonTotals {
  const initialTotals: PhonePlatformComparisonTotals = {
    total: 0,
    phoneEffective: 0,
    platformComplete: 0,
    matchedEffective: 0,
    mismatch: 0,
    phoneWithoutPlatform: 0,
    platformWithoutPhone: 0,
    withoutCode: 0,
  };

  return rows.reduce<PhonePlatformComparisonTotals>((acc, row) => {
    const phoneEffective = phoneBooleanValue(row, ["Efectiva telefónica", "Efectiva telefonica"]);
    const platformComplete = phoneBooleanValue(row, ["Efectiva Kobo", "Plataforma completa"]);
    const matchLabel = normalizeSourceMatch(phoneRowValue(row, ["Coinciden efectivas"], ""));
    const code = phoneRowValue(row, ["CodPulso", "Cod Pulso", "Codigo", "Código"], "");
    const comparable = phoneEffective || platformComplete || matchLabel === "no";
    acc.total += 1;
    if (phoneEffective) acc.phoneEffective += 1;
    if (platformComplete) acc.platformComplete += 1;
    if (phoneEffective && platformComplete) acc.matchedEffective += 1;
    if (comparable && phoneEffective !== platformComplete) acc.mismatch += 1;
    if (phoneEffective && !platformComplete) acc.phoneWithoutPlatform += 1;
    if (!phoneEffective && platformComplete) acc.platformWithoutPhone += 1;
    if (!normalizeSourceMatch(code)) acc.withoutCode += 1;
    return acc;
  }, initialTotals);
}

function phonePlatformComparisonIsMismatch(row: Record<string, unknown>) {
  const phoneEffective = phoneBooleanValue(row, ["Efectiva telefónica", "Efectiva telefonica"]);
  const platformComplete = phoneBooleanValue(row, ["Efectiva Kobo", "Plataforma completa"]);
  const matchLabel = normalizeSourceMatch(phoneRowValue(row, ["Coinciden efectivas"], ""));
  const detail = normalizeSourceMatch(phoneRowValue(row, ["Coincidencia"], ""));
  return matchLabel === "no"
    || phoneEffective !== platformComplete
    || detail.includes("sin codpulso")
    || detail.includes("sin plataforma")
    || detail.includes("sin kobo")
    || detail.includes("sin tel");
}

function phonePlatformComparisonTone(row: Record<string, unknown>): "ok" | "warning" | "pending" {
  if (phonePlatformComparisonIsMismatch(row)) return "warning";
  const phoneEffective = phoneBooleanValue(row, ["Efectiva telefónica", "Efectiva telefonica"]);
  const platformComplete = phoneBooleanValue(row, ["Efectiva Kobo", "Plataforma completa"]);
  if (phoneEffective && platformComplete) return "ok";
  return "pending";
}

function phonePlatformComparisonLabel(row: Record<string, unknown>) {
  const tone = phonePlatformComparisonTone(row);
  const detail = phoneRowValue(row, ["Coincidencia", "Detalle"], "");
  if (detail) return detail;
  if (tone === "warning") return "Revisar cruce";
  if (tone === "ok") return "Coincide como efectiva";
  return "Sin efectiva en ambas fuentes";
}

function phonePlatformComparisonFocusRows(rows: Array<Record<string, unknown>>, mismatchRows: Array<Record<string, unknown>>) {
  if (mismatchRows.length) return mismatchRows.slice(0, 12);
  const effectiveRows = rows.filter((row) => (
    phoneBooleanValue(row, ["Efectiva telefónica", "Efectiva telefonica"])
    || phoneBooleanValue(row, ["Efectiva Kobo", "Plataforma completa"])
  ));
  return (effectiveRows.length ? effectiveRows : rows).slice(0, 12);
}

function phonePlatformComparisonEvidenceRows(
  rows: Array<Record<string, unknown>>,
  mismatchRows: Array<Record<string, unknown>>,
  limit = 80,
) {
  const ordered: Array<Record<string, unknown>> = [];
  const seen = new Set<Record<string, unknown>>();
  const push = (row: Record<string, unknown>) => {
    if (seen.has(row)) return;
    seen.add(row);
    ordered.push(row);
  };
  const matchedEffectiveRows = rows.filter((row) => phonePlatformComparisonTone(row) === "ok");
  const pendingRows = rows.filter((row) => phonePlatformComparisonTone(row) === "pending");
  mismatchRows.forEach(push);
  matchedEffectiveRows.forEach(push);
  pendingRows.forEach(push);
  rows.forEach(push);
  return {
    rows: ordered.slice(0, limit),
    hidden: Math.max(0, ordered.length - limit),
  };
}

function AcreditacionPhoneComparisonCaseCard({
  row,
  index,
}: {
  row: Record<string, unknown>;
  index: number;
}) {
  const code = phoneRowValue(row, ["CodPulso", "Cod Pulso", "Codigo", "Código", "Llave"], "");
  const responsible = phoneRowValue(row, ["Responsable", "Operador", "Encuestador", "Asignado"], "");
  const rawDate = phoneRowValue(row, ["Fecha", "Fecha Kobo", "Fecha plataforma", "Última respuesta", "Ultima respuesta"], "");
  const date = isAcreditacionNoDateLabel(rawDate) ? "" : rawDate;
  const phoneStatus = phoneRowValue(row, ["Estado telefónico", "Estado telefonico", "Avance telefónico", "Avance telefonico"], "");
  const platformStatus = phoneRowValue(row, ["Avance plataforma", "Estado plataforma", "Estado Kobo"], "");
  const phoneEffective = phoneBooleanValue(row, ["Efectiva telefónica", "Efectiva telefonica"]);
  const platformComplete = phoneBooleanValue(row, ["Efectiva Kobo", "Plataforma completa"]);
  const tone = phonePlatformComparisonTone(row);
  const Icon = tone === "warning" ? AlertCircle : tone === "ok" ? CheckCircle2 : Search;
  const codeLabel = code ? `CodPulso ${code}` : `Caso sin CodPulso ${index + 1}`;
  return (
    <section className={`mon-phone-compare-case is-${tone}`}>
      <header>
        <span><Icon size={13} /> {tone === "warning" ? "Revisar" : tone === "ok" ? "Coincide" : "Sin efectiva"}</span>
        <strong>{codeLabel}</strong>
        <em>{phonePlatformComparisonLabel(row)}</em>
      </header>
      <div className="mon-phone-compare-case-flow" aria-label={code ? `Conciliación de ${code}` : `Conciliación del caso ${index + 1}`}>
        <span className={phoneEffective ? "is-ready" : "is-muted"}>
          <em>Barrido</em>
          <strong>{phoneEffective ? "Efectiva" : phoneStatus || "Sin efectiva"}</strong>
        </span>
        <i className={tone === "warning" ? "is-warning" : tone === "ok" ? "is-ok" : "is-muted"} aria-hidden="true">
          <KeyRound size={12} />
          <small>{code || `#${index + 1}`}</small>
        </i>
        <span className={platformComplete ? "is-platform" : "is-muted"}>
          <em>Kobo</em>
          <strong>{platformComplete ? "Efectiva" : platformStatus || "Sin efectiva"}</strong>
        </span>
      </div>
      <footer>
        {responsible ? <span>{responsible}</span> : null}
        {date ? <span>{formatDate(date)}</span> : null}
        <span>{tone === "ok" ? "Efectivas coinciden" : tone === "warning" ? "Cruce pendiente" : "Sin efectiva"}</span>
      </footer>
    </section>
  );
}

function AcreditacionPhoneComparisonEvidenceItem({
  row,
  index,
}: {
  row: Record<string, unknown>;
  index: number;
}) {
  const code = phoneRowValue(row, ["CodPulso", "Cod Pulso", "Codigo", "Código", "Llave"], "");
  const responsible = phoneRowValue(row, ["Responsable", "Operador", "Encuestador", "Asignado"], "");
  const rawDate = phoneRowValue(row, ["Fecha", "Fecha Kobo", "Fecha plataforma", "Última respuesta", "Ultima respuesta"], "");
  const date = isAcreditacionNoDateLabel(rawDate) ? "" : rawDate;
  const phoneStatus = phoneRowValue(row, ["Estado telefónico", "Estado telefonico", "Avance telefónico", "Avance telefonico"], "");
  const platformStatus = phoneRowValue(row, ["Avance plataforma", "Estado plataforma", "Estado Kobo"], "");
  const phoneEffective = phoneBooleanValue(row, ["Efectiva telefónica", "Efectiva telefonica"]);
  const platformComplete = phoneBooleanValue(row, ["Efectiva Kobo", "Plataforma completa"]);
  const tone = phonePlatformComparisonTone(row);
  const statusLabel = tone === "warning" ? "Revisar" : tone === "ok" ? "Coincide" : "Sin efectiva";
  return (
    <article className={`mon-phone-compare-evidence-item is-${tone}`}>
      <span className="mon-phone-compare-evidence-code">
        <KeyRound size={12} />
        <strong>{code || `Sin CodPulso ${index + 1}`}</strong>
        <em>{statusLabel}</em>
      </span>
      <span className={phoneEffective ? "is-ready" : "is-muted"}>
        <em>Barrido</em>
        <strong>{phoneEffective ? "Efectiva" : phoneStatus || "No efectiva"}</strong>
      </span>
      <span className={platformComplete ? "is-platform" : "is-muted"}>
        <em>Kobo</em>
        <strong>{platformComplete ? "Efectiva" : platformStatus || "No efectiva"}</strong>
      </span>
      <span className="mon-phone-compare-evidence-note">
        <em>{phonePlatformComparisonLabel(row)}</em>
        <strong>{[responsible, date ? formatDate(date) : ""].filter(Boolean).join(" · ") || "Sin responsable/fecha"}</strong>
      </span>
    </article>
  );
}

function AcreditacionPhonePlatformComparison({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (!rows.length) {
    return (
      <EmptyPanel
        title="Sin comparación Kobo-barrido"
        detail="El reporte todavía no trae filas con CodPulso para conciliar el avance telefónico contra Kobo."
      />
    );
  }
  const totals = phonePlatformComparisonTotals(rows);
  const mismatchRows = rows.filter(phonePlatformComparisonIsMismatch);
  const focusRows = phonePlatformComparisonFocusRows(rows, mismatchRows);
  const evidence = phonePlatformComparisonEvidenceRows(rows, mismatchRows);
  const evidenceRows = evidence.rows;
  const hiddenEvidenceCount = evidence.hidden;
  const comparableEffective = Math.max(totals.phoneEffective, totals.platformComplete);
  const comparableDenominator = Math.max(1, comparableEffective);
  const effectiveMatchLabel = phoneCodPulsoEffectiveMatchLabel(totals);
  const effectiveBadge = effectiveMatchLabel === "S/D" ? `${formatMetric(totals.total)} llaves` : `${effectiveMatchLabel} efectivas`;
  const platformDelta = totals.platformComplete - totals.phoneEffective;
  const syncTone = totals.mismatch ? "warning" : comparableEffective ? "ok" : "pending";
  const traceableCodes = Math.max(0, totals.total - totals.withoutCode);
  const phoneEffectivePct = safePercentValue(totals.phoneEffective, comparableDenominator) ?? 0;
  const platformEffectivePct = safePercentValue(totals.platformComplete, comparableDenominator) ?? 0;
  const matchedPct = safePercentValue(totals.matchedEffective, comparableDenominator) ?? 0;
  const traceablePct = safePercentValue(traceableCodes, Math.max(1, totals.total)) ?? 0;
  const summaryItems = [
    { key: "phone", label: "Barrido declara", value: totals.phoneEffective, pct: safePercentValue(totals.phoneEffective, comparableDenominator), tone: "effective", hint: "estado telefónico efectivo" },
    { key: "platform", label: "Kobo valida", value: totals.platformComplete, pct: safePercentValue(totals.platformComplete, comparableDenominator), tone: "platform", hint: "pasan filtro y completan" },
    { key: "matched", label: "Coinciden", value: totals.matchedEffective, pct: safePercentValue(totals.matchedEffective, comparableDenominator), tone: "ok", hint: `${effectiveMatchLabel} por CodPulso` },
    { key: "mismatch", label: "Diferencias", value: totals.mismatch, pct: safePercentValue(totals.mismatch, comparableDenominator), tone: totals.mismatch ? "warning" : "ok", hint: "requieren revisión individual" },
  ];
  return (
    <article className="mon-phone-ops-card mon-phone-ops-card--platform-match" aria-label="Comparación CodPulso entre barrido y Kobo">
      <header className="mon-phone-ops-head">
        <div>
          <span>CodPulso</span>
          <strong>Barrido telefónico vs efectivas Kobo</strong>
          <small>Kobo define las efectivas; el barrido debe coincidir por código individual.</small>
        </div>
        <em>{effectiveBadge}</em>
      </header>
      <div className={`mon-phone-codpulso-stage is-${syncTone}`} aria-label="Trazabilidad visual por CodPulso">
        <section
          className="mon-phone-codpulso-source is-phone"
          style={{ "--codpulso-source-pct": `${Math.max(2, Math.min(100, phoneEffectivePct))}%` } as CSSProperties}
        >
          <span><PhoneCall size={13} /> Barrido declara</span>
          <strong>{formatMetric(totals.phoneEffective)}</strong>
          <em>estado telefónico efectivo</em>
          <i aria-hidden="true" />
        </section>
        <div
          className="mon-phone-codpulso-keyway"
          style={{ "--codpulso-match-pct": `${Math.max(0, Math.min(100, matchedPct))}%` } as CSSProperties}
        >
          <div className="mon-phone-codpulso-ring" aria-hidden="true">
            <strong>{effectiveMatchLabel}</strong>
            <em>coinciden</em>
          </div>
          <span><KeyRound size={14} /> CodPulso individual</span>
          <p>
            {totals.mismatch
              ? `${formatMetric(totals.mismatch)} códigos dicen algo distinto entre barrido y Kobo.`
              : comparableEffective
                ? "Las efectivas del barrido están alineadas con Kobo por código."
                : "Aún no hay efectivas comparables por código."}
          </p>
        </div>
        <section
          className="mon-phone-codpulso-source is-kobo"
          style={{ "--codpulso-source-pct": `${Math.max(2, Math.min(100, platformEffectivePct))}%` } as CSSProperties}
        >
          <span><QrCode size={13} /> Kobo valida</span>
          <strong>{formatMetric(totals.platformComplete)}</strong>
          <em>{platformDelta === 0 ? "mismo volumen efectivo" : `${platformDelta > 0 ? "+" : ""}${formatMetric(platformDelta)} frente al barrido`}</em>
          <i aria-hidden="true" />
        </section>
        <aside
          className="mon-phone-codpulso-trace"
          style={{ "--codpulso-trace-pct": `${Math.max(0, Math.min(100, traceablePct))}%` } as CSSProperties}
        >
          <span>Llaves trazadas</span>
          <strong>{formatMetric(totals.total)}</strong>
          <em>{totals.withoutCode ? `${formatMetric(totals.withoutCode)} sin CodPulso` : "todas comparables"}</em>
          <i aria-hidden="true" />
        </aside>
      </div>
      <div className="mon-phone-codpulso-proof" aria-label="Evidencia resumida de coincidencia efectiva">
        {summaryItems.map((item) => (
          <section
            key={item.key}
            className={`is-${item.tone}`}
            style={{ "--phone-proof-pct": `${Math.max(0, Math.min(100, item.pct ?? 0))}%` } as CSSProperties}
          >
            <span>{item.label}</span>
            <strong>{formatMetric(item.value)}</strong>
            <em>{item.key === "matched" ? "alineadas" : item.key === "mismatch" ? "por revisar" : "casos"}</em>
            <i aria-hidden="true" />
            <small>{item.key === "matched" || item.key === "mismatch" ? item.hint : `${phonePercentLabel(item.pct)} · ${item.hint}`}</small>
          </section>
        ))}
      </div>
      <div className="mon-phone-compare-board" aria-label="Casos priorizados por CodPulso">
        <header>
          <span>{mismatchRows.length ? "Diferencias por revisar" : "Coincidencia efectiva"}</span>
          <strong>{mismatchRows.length ? `${formatMetric(mismatchRows.length)} códigos necesitan revisión` : `${effectiveMatchLabel} efectivas alineadas`}</strong>
          <em>{mismatchRows.length ? "Prioriza códigos donde barrido y Kobo no dicen lo mismo." : "Muestra de códigos efectivos para confirmar trazabilidad."}</em>
        </header>
        <div className="mon-phone-compare-cases">
          {focusRows.map((row, index) => (
            <AcreditacionPhoneComparisonCaseCard key={`${phoneRowValue(row, ["CodPulso", "Cod Pulso", "Codigo", "Código"], "")}-${index}`} row={row} index={index} />
          ))}
        </div>
      </div>
      <details className="mon-phone-compare-evidence">
        <summary>
          <span><FileCheck2 size={13} /> Evidencia por llave</span>
          <em>{formatMetric(evidenceRows.length)} visibles{hiddenEvidenceCount ? ` · ${formatMetric(hiddenEvidenceCount)} más` : ""}</em>
        </summary>
        <div className="mon-phone-compare-evidence-list" aria-label="Evidencia visual de comparación por CodPulso">
          {evidenceRows.map((row, index) => (
            <AcreditacionPhoneComparisonEvidenceItem
              key={`evidence-${phoneRowValue(row, ["CodPulso", "Cod Pulso", "Codigo", "Código"], "")}-${index}`}
              row={row}
              index={index}
            />
          ))}
        </div>
      </details>
    </article>
  );
}

function AcreditacionPhoneOperationsWorkbench({
  reports,
  activeTab,
  fallbackEffective = 0,
  standalone = false,
}: {
  reports: MonitoreoAcreditacionReports;
  activeTab: AcreditacionPhoneTab;
  fallbackEffective?: number;
  standalone?: boolean;
}) {
  const summaryRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["resumen_telefonico"]);
  const statusRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["estatus_telefonico"]);
  const quotaRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"]);
  const responsibleRows = mergeAcreditacionPhoneResponsibleRows(
    rowsForSheetBlock(reports, "monitoreo_telefonico", ["operacion_responsable"]),
    rowsForSheetBlock(reports, "monitoreo_telefonico", ["efectivos_responsable"]),
    rowsForSheetBlock(reports, "monitoreo_telefonico", ["no_barridos_responsable"]),
    rowsForSheetBlock(reports, "monitoreo_telefonico", ["responsables_barrido"]),
  );
  const pendingRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["no_barridos_responsable"]);
  const insistenceRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["insistencia_no_contesta"]);
  const detailRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["detalle_no_contesta"]);
  const reattemptRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["reintentos_responsable"]);
  const alertRows = rowsForSheetBlock(reports, "alertas", ["alertas"]);
  const reconciliationRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["comparacion_codpulso", "campo_vs_plataforma_codpulso"]);
  const dailyBlock = phoneDailyBlockForPanel(reports);
  const dailyRows = dailyBlock?.rows ?? [];
  const statusDailyRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["estatus_dia", "estados_dia", "estatus_telefonico_dia"]);
  const queries = normalizeInternalQueries(reports.internal_queries);
  const queryCases = queries.case_rollup?.length ? queries.case_rollup : queries.cases;
  const fallbackStatusRows = groupedCaseRows(queryCases, internalCaseResponseStateValue, internalCaseResponseStateLabel);
  const fallbackResponsibleRows = groupedCaseRows(
    queryCases,
    (item) => internalQueryCollectorDisplayLabel(item) || item.collector_id || "Sin responsable",
    (value) => value,
  );
  const visibleStatusRows = statusRows.length ? statusRows : fallbackStatusRows;
  const visibleResponsibleRows = responsibleRows.length ? responsibleRows : fallbackResponsibleRows;
  const totals = phoneOperationTotals(summaryRows, visibleStatusRows, visibleResponsibleRows, dailyRows);
  const reportEffectiveFallback = Math.max(stateFromReports(reports).effective, fallbackEffective);
  const generatedAt = reports.generated_at ? formatDate(reports.generated_at) : "";

  return (
    <section
      className={`pulso-panel mon-fill-panel mon-phone-panel${standalone ? " is-standalone-phone" : ""}`}
      style={{ minHeight: 0, overflowY: "auto", scrollbarGutter: "stable" } as CSSProperties}
      aria-label={standalone ? "Monitoreo telefónico standalone" : "Monitoreo telefónico canónico"}
    >
      <header className="pulso-panel-header">
        <div className="pulso-panel-heading">
          <span className="pulso-panel-eyebrow">{standalone ? "Monitoreo telefónico standalone" : "Operación telefónica"}</span>
          <h2 className="pulso-panel-title"><span className="mon-title-icon"><PhoneCall size={16} /> Barrido telefónico</span></h2>
          <p className="pulso-panel-hint">
            {standalone
              ? "Estados telefónicos, barrido, responsables y cruce individual con Kobo por CodPulso."
              : "Responsables, asignación, insistencia y estados propios del barrido."}
          </p>
        </div>
        <div className="mon-phone-meta">
          <span>{formatMetric(queryCases.length)} casos trazables</span>
          {generatedAt ? <span>{generatedAt}</span> : null}
        </div>
      </header>
      <div className="mon-phone-tabbody">
        {activeTab === "dia" ? (
          <div className="mon-phone-layout mon-phone-layout--alerts">
            <AcreditacionPhoneDailyTrend rows={dailyRows} statusRows={statusDailyRows} />
          </div>
        ) : activeTab === "responsables" ? (
          <div className="mon-phone-layout mon-phone-layout--responsables">
            <AcreditacionPhoneResponsibleCards rows={visibleResponsibleRows} />
          </div>
        ) : activeTab === "incidencia" ? (
          <div className="mon-phone-layout">
            <AcreditacionPhoneIncidenceSection responsibleRows={visibleResponsibleRows} />
            <AcreditacionPhonePendingInsistence pendingRows={pendingRows} insistenceRows={insistenceRows} detailRows={detailRows} reattemptRows={reattemptRows} />
            <DataTable
              rows={phoneDisplayRowsWithBaseColumn([...pendingRows, ...insistenceRows, ...reattemptRows, ...detailRows])}
              empty="No hay pendientes, insistencia o detalle de no contacto para este corte."
            />
          </div>
        ) : activeTab === "alertas" ? (
          <div className="mon-phone-layout">
            <AcreditacionPhoneQualityAlertsPanel model={buildAcreditacionPhoneRealAlertModel({ alertRows })} generatedAt={reports.generated_at} />
          </div>
        ) : activeTab === "supervision" ? (
          <div className="mon-phone-layout">
            <AcreditacionPhoneSupervisionBoard reports={reports} alertRows={alertRows} responsibleRows={visibleResponsibleRows} pendingRows={pendingRows} insistenceRows={insistenceRows} reattemptRows={reattemptRows} totals={totals} fallbackEffective={reportEffectiveFallback} />
          </div>
        ) : (
          <div className="mon-phone-layout mon-phone-layout--summary">
            {standalone ? <AcreditacionPhonePlatformComparison rows={reconciliationRows} /> : null}
            <section className="mon-phone-overview-grid" aria-label="Resumen de barrido telefónico">
              <AcreditacionPhoneStorage totals={totals} />
              <AcreditacionPhoneStatusStorage rows={visibleStatusRows} total={totals.total} />
              <AcreditacionPhoneQuotaPanel rows={quotaRows} />
            </section>
          </div>
        )}
      </div>
    </section>
  );
}

function renderPhoneView(reports: MonitoreoAcreditacionReports, activeTab: AcreditacionPhoneTab = "resumen", fallbackEffective = 0, standalone = false) {
  return <AcreditacionPhoneOperationsWorkbench reports={reports} activeTab={activeTab} fallbackEffective={fallbackEffective} standalone={standalone} />;
}

function normalizeSourceMatch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function uniqueDisplayValues(values: unknown[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const label = String(value ?? "").trim();
    const key = normalizeSourceMatch(label);
    if (!label || !key || key === "sin dato" || key === "sin actor" || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

function sourceProviderLabel(kind: MonitoreoSource["kind"]) {
  if (kind === "google_sheets") return "Google Sheets";
  if (kind === "surveymonkey") return "SurveyMonkey";
  if (kind === "kobo") return "KoboToolbox";
  return kind;
}

function sourceActorLabel(source: MonitoreoSource) {
  return String(
    source.dimensions?.actor
    ?? source.dimensions?.carrera
    ?? source.dimensions?.segmento
    ?? source.dimensions?.unidad
    ?? "",
  ).trim() || "Sin actor";
}

function sourceChannelLabel(source: MonitoreoSource) {
  return acreditacionSourceChannel(source) || (source.kind === "google_sheets" ? "Base" : "Sin canal");
}

function sourceExternalId(source: MonitoreoSource) {
  if (source.kind === "surveymonkey") return source.survey_id || source.id;
  if (source.kind === "kobo") return source.asset_uid || source.id;
  return [
    sourceSheetField(source, "spreadsheet_id"),
    sourceSheetField(source, "sheet_name"),
  ].filter(Boolean).join(" / ") || source.id;
}

function isPlatformResponseSource(source: MonitoreoSource) {
  return (source.kind === "surveymonkey" || source.kind === "kobo")
    && (source.role === "respuestas" || !source.role || Boolean(source.survey_id) || Boolean(source.asset_uid));
}

function isSurveyMonkeyResponseSource(source: MonitoreoSource) {
  return source.kind === "surveymonkey"
    && (source.role === "respuestas" || !source.role || Boolean(source.survey_id));
}

function isKoboResponseSource(source: MonitoreoSource) {
  return source.kind === "kobo"
    && (source.role === "respuestas" || !source.role || Boolean(source.asset_uid));
}

function shortenMiddle(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const edge = Math.max(6, Math.floor((maxLength - 3) / 2));
  return `${value.slice(0, edge)}...${value.slice(-edge)}`;
}

function sourceFlatField(source: MonitoreoSource, key: string) {
  const value = (source as unknown as Record<string, unknown>)[key];
  return String(value ?? "").trim();
}

function sourceSheetField(source: MonitoreoSource, key: "spreadsheet_id" | "sheet_name" | "range" | "last_read_at" | "row_count") {
  const binding = source.sheet_binding as unknown as Record<string, unknown> | undefined;
  return String(binding?.[key] ?? sourceFlatField(source, key) ?? "").trim();
}

function sourceRowCount(source: MonitoreoSource) {
  const raw = Number(sourceSheetField(source, "row_count"));
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function sourceSpreadsheetUrl(source: MonitoreoSource) {
  const raw = sourceSheetField(source, "spreadsheet_id");
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const embeddedId = raw.match(/spreadsheets\/d\/([^/?#]+)/i)?.[1];
  const id = embeddedId || raw;
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/edit`;
}

function sourceSpreadsheetDisplay(source: MonitoreoSource) {
  const raw = sourceSheetField(source, "spreadsheet_id");
  const embeddedId = raw.match(/spreadsheets\/d\/([^/?#]+)/i)?.[1];
  const value = embeddedId || raw;
  return value ? shortenMiddle(value.replace(/^https?:\/\//i, ""), 42) : "Abrir spreadsheet";
}

function sourceSyncLabel(source: MonitoreoSource) {
  if (!source.enabled) return "Inactiva";
  const stamps = [
    source.last_sync_at,
    sourceSheetField(source, "last_read_at"),
    source.sync_cursor?.updated_at,
    ...(source.collectors ?? []).flatMap((collector) => [collector.last_sync_at, collector.synced_at]),
  ].filter((value): value is string => Boolean(value));
  if (!stamps.length) return "Sin sync";
  const [latest] = stamps.sort((a, b) => {
    const left = new Date(a).getTime();
    const right = new Date(b).getTime();
    return (Number.isFinite(right) ? right : 0) - (Number.isFinite(left) ? left : 0);
  });
  return formatDate(latest);
}

function actorInitialLabel(value: string) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalizeSourceMatch(normalized) === "sin actor") return "?";
  const words = normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const letters = words.length > 1
    ? words.slice(0, 2).map((word) => word.charAt(0)).join("")
    : (words[0] ?? normalized).slice(0, 2);
  return letters.toLocaleUpperCase("es-PE");
}

function sourcesForPreset(sources: MonitoreoSource[], preset: AcreditacionSourcePreset) {
  if (preset.key === "respuestas_surveymonkey") {
    return sources.filter(isPlatformResponseSource);
  }
  return sources.filter((source) => source.kind === "google_sheets" && source.role === preset.role);
}

function presetSourceStatus(sources: MonitoreoSource[]) {
  if (!sources.length) return "Pendiente";
  if (sources.some((source) => source.enabled)) return "Lista";
  return "Inactiva";
}

function mostRecentSyncLabel(sources: MonitoreoSource[]) {
  const stamps = sources
    .map((source) => source.last_sync_at)
    .filter((value): value is string => Boolean(value));
  if (!stamps.length) return "Sin sync";
  const sorted = stamps.sort((a, b) => {
    const left = new Date(a).getTime();
    const right = new Date(b).getTime();
    return (Number.isFinite(right) ? right : 0) - (Number.isFinite(left) ? left : 0);
  });
  return formatDate(sorted[0]);
}

function sourceRowsForTable(sources: MonitoreoSource[], { phoneMode = false }: { phoneMode?: boolean } = {}) {
  return sources.map((source) => ({
    Fuente: source.label || source.id,
    Servicio: sourceProviderLabel(source.kind),
    Rol: source.role || "respuestas",
    ...(phoneMode
      ? { Segmento: sourceActorLabel(source) === "Sin actor" ? "Sin segmentar" : sourceActorLabel(source) }
      : { Actor: sourceActorLabel(source) }),
    Canal: acreditacionChannelLabel(sourceChannelLabel(source)),
    Estado: source.enabled ? "Activa" : "Inactiva",
    "Ultimo sync": sourceSyncLabel(source),
    ID: sourceExternalId(source),
  }));
}

function sourcePackageRows(sources: MonitoreoSource[]) {
  return ACREDITACION_SOURCE_PRESETS.map((preset) => {
    const presetSources = sourcesForPreset(sources, preset);
    const active = presetSources.filter((source) => source.enabled);
    return {
      Pieza: preset.label,
      Servicio: preset.service,
      Rol: preset.role,
      Configuradas: presetSources.length,
      Activas: active.length,
      Estado: presetSourceStatus(presetSources),
      "Ultimo sync": mostRecentSyncLabel(presetSources),
    };
  });
}

function cleanSourceDimensions(dimensions: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(dimensions)
      .map(([key, value]) => [key, String(value ?? "").trim()] as const)
      .filter(([, value]) => value.length > 0),
  );
}

function sourceDimensionEntries(dimensions: Record<string, string> | undefined) {
  return Object.entries(dimensions ?? {})
    .filter(([, value]) => String(value ?? "").trim())
    .slice(0, 8);
}

function dimensionLabel(key: string) {
  const labels: Record<string, string> = {
    actor: "Actor",
    carrera: "Carrera",
    canal: "Canal",
    channel: "Canal",
    segmento: "Segmento",
    servicio: "Servicio",
    territorio: "Territorio",
    sheet_name: "Pestaña",
    survey_title: "Encuesta",
  };
  return labels[key] ?? key.replaceAll("_", " ");
}

function sourcePayloadFromExisting(source: MonitoreoSource, patch: Partial<MonitoreoSourcePayload>): MonitoreoSourcePayload {
  const fallbackSheetBinding = sourceSheetField(source, "spreadsheet_id")
    ? {
      spreadsheet_id: sourceSheetField(source, "spreadsheet_id"),
      sheet_name: sourceSheetField(source, "sheet_name"),
      header_row: Number(source.sheet_binding?.header_row ?? 1),
      range: sourceSheetField(source, "range"),
    }
    : undefined;
  return {
    id: source.id,
    kind: source.kind,
    label: source.label,
    enabled: source.enabled,
    role: source.role,
    integration_mode: source.integration_mode,
    sheet_binding: source.sheet_binding ?? fallbackSheetBinding,
    asset_uid: source.asset_uid,
    survey_id: source.survey_id,
    survey_title: source.survey_title,
    base_url: source.base_url,
    connection_profile_id: source.connection_profile_id,
    declared_person_code_var: source.declared_person_code_var,
    declared_person_code_label: source.declared_person_code_label,
    dimensions: source.dimensions,
    ...patch,
  };
}

function normalizeCollectorUse(value: unknown): MonitoreoCollectorUse {
  return MODEL_COLLECTOR_USE_OPTIONS.some((option) => option.value === value)
    ? value as MonitoreoCollectorUse
    : "sin_clasificar";
}

function normalizeModelModality(value: unknown): MonitoreoStrategyPhase["modality"] {
  return MODEL_MODALITY_OPTIONS.some((option) => option.value === value)
    ? value as MonitoreoStrategyPhase["modality"]
    : "mixto";
}

function collectorUseOption(value: MonitoreoCollectorUse) {
  return MODEL_COLLECTOR_USE_OPTIONS.find((option) => option.value === value)
    ?? MODEL_COLLECTOR_USE_OPTIONS[MODEL_COLLECTOR_USE_OPTIONS.length - 1];
}

function modalityForCollectorUse(value: MonitoreoCollectorUse): MonitoreoStrategyPhase["modality"] {
  return collectorUseOption(value).modality;
}

function collectorChannelForUse(value: MonitoreoCollectorUse) {
  return collectorUseOption(value).channel;
}

function channelOptionForValue(value: unknown) {
  const key = acreditacionChannelKey(String(value ?? ""));
  return ACREDITACION_CHANNEL_OPTIONS.find((option) => option.key === key)
    ?? ACREDITACION_CHANNEL_OPTIONS[0];
}

function channelVisualForValue(value: unknown, emptyLabel = "Elegir canal") {
  const raw = String(value ?? "").trim();
  const key = acreditacionChannelKey(raw);
  if (key === "desconocido") {
    return {
      key,
      label: raw || emptyLabel,
      icon: SlidersHorizontal,
    };
  }
  const option = ACREDITACION_CHANNEL_OPTIONS.find((item) => item.key === key) ?? ACREDITACION_CHANNEL_OPTIONS[0];
  return {
    key: option.key,
    label: option.label,
    icon: option.icon,
  };
}

function AcreditacionChannelSelect({
  value,
  onChange,
  disabled,
  allowEmpty = false,
  label = "Canal",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  allowEmpty?: boolean;
  label?: string;
}) {
  const visual = channelVisualForValue(value);
  const Icon = visual.icon;
  const selectValue = allowEmpty ? value : channelOptionForValue(value).value;
  return (
    <label className="mon-channel-select mon-channel-select-field">
      <span>{label}</span>
      <div className={`mon-channel-select-control is-${visual.key}`} data-channel={visual.key}>
        <span className="mon-channel-select-icon" aria-hidden="true">
          <Icon size={14} />
        </span>
        <select
          value={selectValue}
          onChange={(event) => onChange(event.currentTarget.value)}
          disabled={disabled}
          aria-label={label}
        >
          {allowEmpty ? <option value="">Elegir canal</option> : null}
          {ACREDITACION_CHANNEL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
    </label>
  );
}

function AcreditacionChannelDeclarationPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const current = channelOptionForValue(value).value;
  return (
    <div className="mon-acr-channel-declare-field">
      <span>Canal base</span>
      <div className="mon-acr-channel-choice-strip" role="radiogroup" aria-label="Canal base de la encuesta">
        {ACREDITACION_CHANNEL_OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = option.value === current;
          return (
            <button
              key={option.value}
              type="button"
              className={`is-${option.key}${active ? " is-active" : ""}`}
              aria-pressed={active}
              aria-label={option.label}
              title={option.label}
              disabled={disabled}
              onClick={() => onChange(option.value)}
            >
              <Icon size={13} />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function acreditacionChannelModality(value: unknown): MonitoreoStrategyPhase["modality"] {
  return channelOptionForValue(value).modality;
}

function collectorTypeLabel(value: string) {
  const normalized = normalizeSourceMatch(value);
  if (normalized === "email") return "Envío por correo";
  if (normalized === "weblink" || normalized === "web_link" || normalized === "web link") return "Link abierto";
  if (normalized === "sms") return "SMS";
  return value || "Enlace";
}

function collectorDisplayName(item: MonitoreoSurveyMonkeyCollector | MonitoreoLinkCollector) {
  const raw = String(item.collector_name || item.collector_id || "Recopilador").trim();
  if (/^collector\s+/i.test(raw)) return raw.replace(/^collector/i, "Recopilador");
  if (/^colector\s+/i.test(raw)) return raw.replace(/^colector/i, "Recopilador");
  return raw;
}

function collectorNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function countFromRecord(record: Record<string, number> | undefined, keys: string[]) {
  if (!record) return 0;
  return keys.reduce((sum, key) => sum + collectorNumber(record[key]), 0);
}

function collectorConfigFromDiscovery(item: MonitoreoSurveyMonkeyCollector | MonitoreoLinkCollector): MonitoreoLinkCollector {
  const operationalUse = normalizeCollectorUse(item.operational_use || ("suggested_use" in item ? item.suggested_use : ""));
  const channel = String(item.channel || collectorChannelForUse(operationalUse) || "Desconocido").trim() || "Desconocido";
  const modality = normalizeModelModality(item.modality || acreditacionChannelModality(channel) || modalityForCollectorUse(operationalUse));
  return {
    id: item.id || `${item.source_id}::${item.collector_id}`,
    source_id: item.source_id,
    source_label: item.source_label,
    survey_id: item.survey_id,
    collector_id: item.collector_id,
    collector_name: item.collector_name,
    collector_type: item.collector_type,
    enabled: item.enabled ?? true,
    channel,
    operational_use: operationalUse,
    modality,
    roster_required: item.roster_required ?? operationalUse === "telefono_asistido",
  };
}

function AcreditacionCollectorMetric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "ready" | "warning" }) {
  return (
    <div className={`mon-collector-metric is-${tone}`}>
      <span>{label}</span>
      <strong>{fmt(value)}</strong>
    </div>
  );
}

function AcreditacionChannelSelectorMatrix({
  sources,
  config,
  onConfigChange,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  config: MonitoreoConfig;
  onConfigChange: (config: MonitoreoConfig) => void;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const surveySources = useMemo(() => sources.filter((source) => source.kind === "surveymonkey"), [sources]);
  const activeSurveySources = useMemo(() => surveySources.filter((source) => source.enabled), [surveySources]);
  const sourceIds = useMemo(() => activeSurveySources.map((source) => source.id), [activeSurveySources]);
  const sourceSignature = useMemo(() => surveySources.map((source) => `${source.id}:${sourceChannelLabel(source)}:${source.enabled}`).join("|"), [surveySources]);
  const [sourceChannels, setSourceChannels] = useState<Record<string, string>>({});
  const [items, setItems] = useState<MonitoreoSurveyMonkeyCollector[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<"sources" | "collectors" | null>(null);
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);
  const [loadedAt, setLoadedAt] = useState("");
  const [loadMode, setLoadMode] = useState<"local_snapshot" | "surveymonkey" | "">("");

  useEffect(() => {
    setSourceChannels(Object.fromEntries(
      surveySources.map((source) => [source.id, channelOptionForValue(sourceChannelLabel(source)).value]),
    ));
  }, [sourceSignature, surveySources]);

  const configuredMap = useMemo(() => {
    const out = new Map<string, MonitoreoLinkCollector>();
    for (const item of config.operational_model.link_collectors) {
      out.set(`${item.source_id}::${item.collector_id}`, item);
    }
    return out;
  }, [config.operational_model.link_collectors]);
  const sourceChannelById = useMemo(() => new Map(
    surveySources.map((source) => [
      source.id,
      sourceChannels[source.id] || channelOptionForValue(sourceChannelLabel(source)).value,
    ]),
  ), [sourceChannels, surveySources]);

  const mergedItems = useMemo(() => items.map((item) => {
    const saved = configuredMap.get(`${item.source_id}::${item.collector_id}`);
    const operationalUse = normalizeCollectorUse(saved?.operational_use ?? item.operational_use ?? item.configured_use ?? item.suggested_use);
    const sourceChannel = sourceChannelById.get(item.source_id);
    const channel = String(saved?.channel || item.channel || sourceChannel || collectorChannelForUse(operationalUse)).trim() || "Desconocido";
    return {
      ...item,
      ...saved,
      channel,
      operational_use: operationalUse,
      configured_use: operationalUse,
      modality: normalizeModelModality(saved?.modality ?? item.modality ?? acreditacionChannelModality(channel)),
      roster_required: saved?.roster_required ?? item.roster_required ?? operationalUse === "telefono_asistido",
    };
  }), [configuredMap, items, sourceChannelById]);

  const summary = useMemo(() => {
    const recipients = mergedItems.reduce((sum, item) => sum + collectorNumber(item.recipient_summary?.total), 0);
    const links = mergedItems.reduce((sum, item) => sum + collectorNumber(item.recipient_summary?.personalized_link_count), 0);
    const active = mergedItems.reduce((sum, item) => sum + collectorNumber(item.active_response_count || item.response_count), 0);
    const unclassified = mergedItems.filter((item) => normalizeCollectorUse(item.operational_use) === "sin_clasificar").length;
    const channels = new Set([
      ...surveySources.map((source) => acreditacionChannelKey(sourceChannels[source.id] || sourceChannelLabel(source))),
      ...mergedItems.map((item) => acreditacionChannelKey(item.channel || "")),
    ]);
    return { recipients, links, active, unclassified, channels: channels.size };
  }, [mergedItems, sourceChannels, surveySources]);

  const dirtySourceCount = useMemo(() => surveySources.filter((source) => (
    (sourceChannels[source.id] || "") !== channelOptionForValue(sourceChannelLabel(source)).value
  )).length, [sourceChannels, surveySources]);

  async function loadCollectors(remote = false) {
    if (!sourceIds.length) {
      setItems([]);
      setLoadMode("");
      setLoadedAt("");
      return;
    }
    setLoading(true);
    setStatus({ tone: "info", message: remote ? "Leyendo recopiladores desde SurveyMonkey..." : "Leyendo recopiladores desde snapshot local..." });
    try {
      const result = await apiMonitoreoSurveyMonkeyCollectors(sourceIds, {
        remote,
        includeRecipients: remote,
        includeDetails: remote,
      });
      setItems(result.collectors);
      setLoadedAt(result.generated_at);
      setLoadMode(result.mode);
      setStatus({ tone: "success", message: `${fmt(result.collectors.length)} recopiladores disponibles para clasificar.` });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCollectors(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceIds.join("|")]);

  function updateCollector(item: MonitoreoSurveyMonkeyCollector, patch: Partial<MonitoreoLinkCollector>) {
    const key = `${item.source_id}::${item.collector_id}`;
    const current = configuredMap.get(key) ?? collectorConfigFromDiscovery(item);
    const operationalUse = normalizeCollectorUse(patch.operational_use ?? current.operational_use);
    const nextChannel = String(patch.channel ?? current.channel ?? item.channel ?? collectorChannelForUse(operationalUse)).trim() || "Desconocido";
    const nextModality = patch.modality
      ?? (patch.operational_use ? modalityForCollectorUse(operationalUse) : patch.channel ? acreditacionChannelModality(nextChannel) : current.modality);
    const nextItem: MonitoreoLinkCollector = {
      ...current,
      ...patch,
      channel: nextChannel,
      operational_use: operationalUse,
      modality: normalizeModelModality(nextModality),
      roster_required: patch.roster_required ?? (patch.operational_use ? operationalUse === "telefono_asistido" : current.roster_required),
    };
    const others = config.operational_model.link_collectors.filter((collector) => `${collector.source_id}::${collector.collector_id}` !== key);
    onConfigChange({
      ...config,
      operational_model: {
        ...config.operational_model,
        link_collectors: [...others, nextItem],
      },
    });
  }

  function applySuggestions() {
    const next = mergedItems.map((item) => {
      const suggested = normalizeCollectorUse(item.suggested_use);
      const channel = item.channel || collectorChannelForUse(suggested);
      return collectorConfigFromDiscovery({
        ...item,
        operational_use: suggested,
        channel,
        modality: acreditacionChannelModality(channel),
        roster_required: suggested === "telefono_asistido",
      });
    });
    onConfigChange({
      ...config,
      operational_model: {
        ...config.operational_model,
        link_collectors: next,
      },
    });
    setStatus({ tone: "info", message: "Sugerencias aplicadas al borrador. Revisa y guarda para persistir." });
  }

  async function saveCollectors() {
    setSaving("collectors");
    setStatus({ tone: "info", message: "Guardando clasificación de recopiladores..." });
    try {
      const payload = mergedItems.length
        ? mergedItems.map(collectorConfigFromDiscovery)
        : config.operational_model.link_collectors;
      const result = await apiMonitoreoCollectorsConfig(payload);
      onStateChange?.(result.state);
      setStatus({ tone: "success", message: "Recopiladores guardados en el modelo operativo." });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setSaving(null);
    }
  }

  async function saveSourceChannels() {
    const changed = surveySources.filter((source) => (
      (sourceChannels[source.id] || "") !== channelOptionForValue(sourceChannelLabel(source)).value
    ));
    if (!changed.length) return;
    setSaving("sources");
    setStatus({ tone: "info", message: `Guardando canal en ${fmt(changed.length)} encuesta${changed.length === 1 ? "" : "s"}...` });
    try {
      let nextState: MonitoreoState | null = null;
      for (const source of changed) {
        const channel = sourceChannels[source.id] || "Desconocido";
        const result = await apiMonitoreoSource(sourcePayloadFromExisting(source, {
          dimensions: cleanSourceDimensions({
            ...source.dimensions,
            canal: channel,
          }),
        }));
        nextState = result.state;
      }
      if (nextState) onStateChange?.(nextState);
      setStatus({ tone: "success", message: "Canales de encuesta guardados." });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="mon-contract-block mon-contract-block--wide mon-channel-selector-matrix" aria-label="Selector de canal por encuesta y recopilador">
      <div className="mon-contract-block-head">
        <span>Canales, enlaces y recopiladores</span>
        <div className="mon-collector-actions">
          <button type="button" onClick={() => { void loadCollectors(false); }} disabled={loading || !sourceIds.length}>
            {loading ? <Loader2 size={13} className="pulso-spin" /> : <RefreshCw size={13} />}
            Snapshot
          </button>
          <button type="button" onClick={() => { void loadCollectors(true); }} disabled={loading || !sourceIds.length}>
            {loading ? <Loader2 size={13} className="pulso-spin" /> : <PlugZap size={13} />}
            SurveyMonkey
          </button>
          <button type="button" onClick={applySuggestions} disabled={!mergedItems.length}>
            <CheckCircle2 size={13} />
            Sugerir usos
          </button>
          <button type="button" onClick={() => { void saveSourceChannels(); }} disabled={saving != null || !dirtySourceCount}>
            {saving === "sources" ? <Loader2 size={13} className="pulso-spin" /> : <Save size={13} />}
            Guardar canales
          </button>
          <button type="button" className="pulso-primary" onClick={() => { void saveCollectors(); }} disabled={saving != null || loading}>
            {saving === "collectors" ? <Loader2 size={13} className="pulso-spin" /> : <Save size={13} />}
            Guardar recopiladores
          </button>
        </div>
      </div>

      <div className="mon-collector-summary" aria-label="Resumen de canales y recopiladores">
        <span>{fmt(surveySources.length)} encuestas SM</span>
        <span>{fmt(mergedItems.length)} recopiladores</span>
        <span>{fmt(summary.channels)} canales</span>
        <span>{fmt(summary.active)} respuestas</span>
        <span>{fmt(summary.recipients)} destinatarios</span>
        <span>{fmt(summary.links)} links usados</span>
        {summary.unclassified ? <span>{fmt(summary.unclassified)} sin clasificar</span> : null}
        {dirtySourceCount ? <span>{fmt(dirtySourceCount)} canales sin guardar</span> : null}
        {loadMode ? <span>{loadMode === "surveymonkey" ? "API SurveyMonkey" : "Snapshot local"}</span> : null}
        {loadedAt ? <span>{formatDate(loadedAt)}</span> : null}
      </div>

      {status ? <div className={status.tone === "error" ? "mon-sm-error" : "mon-sm-meta"}>{status.message}</div> : null}

      <div className="mon-channel-matrix-layout">
        <div className="mon-survey-channel-panel" aria-label="Canal por encuesta">
          <header>
            <div>
              <span>Encuestas conectadas</span>
              <strong>Canal operativo por fuente</strong>
            </div>
            <em>{fmt(activeSurveySources.length)} activas</em>
          </header>
          <div className="mon-survey-channel-list">
            {surveySources.map((source) => {
              const selected = sourceChannels[source.id] || channelOptionForValue(sourceChannelLabel(source)).value;
              return (
                <article key={source.id} className={`mon-survey-channel-row${source.enabled ? "" : " is-disabled"}`}>
                  <div className="mon-survey-channel-main">
                    <AcreditacionChannelBadge channel={selected} />
                    <div>
                      <strong>{source.survey_title || source.label || source.id}</strong>
                      <em>{sourceActorLabel(source)} · {sourceExternalId(source)}</em>
                    </div>
                  </div>
                  <AcreditacionChannelSelect
                    value={selected}
                    onChange={(channel) => setSourceChannels((current) => ({ ...current, [source.id]: channel }))}
                    disabled={saving != null}
                  />
                </article>
              );
            })}
            {!surveySources.length ? (
              <div className="mon-sm-empty">Conecta una fuente SurveyMonkey para clasificar canales y recopiladores.</div>
            ) : null}
          </div>
        </div>

        <div className="mon-collector-body mon-collector-body--matrix" aria-label="Canal por recopilador">
          {loading ? (
            <div className="mon-collector-loading">
              <Loader2 size={16} className="pulso-spin" />
              <span>Leyendo recopiladores locales...</span>
            </div>
          ) : null}
          {!loading && sourceIds.length > 0 && !mergedItems.length ? (
            <div className="mon-sm-empty">Sin recopiladores detectados. Revisa el snapshot local o lee SurveyMonkey de forma explícita.</div>
          ) : null}
          {!sourceIds.length ? (
            <div className="mon-sm-empty">No hay encuestas SurveyMonkey activas para descubrir recopiladores.</div>
          ) : null}
          <div className="mon-collector-list">
            {mergedItems.map((item) => {
              const operationalUse = normalizeCollectorUse(item.operational_use);
              const useOption = collectorUseOption(operationalUse);
              const UseIcon = useOption.icon;
              const channel = item.channel || collectorChannelForUse(operationalUse);
              const completeCount = countFromRecord(item.recipient_summary?.response_status_counts, ["completely_responded", "completed", "complete"]);
              return (
                <article key={`${item.source_id}-${item.collector_id}`} className={`mon-collector-card mon-collector-card--channel is-${item.modality}`}>
                  <div className="mon-collector-title">
                    <span className="mon-collector-use-icon"><UseIcon size={14} /></span>
                    <div>
                      <strong>{collectorDisplayName(item)}</strong>
                      <em>{item.source_label || item.source_id}</em>
                    </div>
                    <span className="mon-collector-chip">{collectorTypeLabel(item.collector_type)}</span>
                  </div>

                  <div className="mon-collector-metrics">
                    <AcreditacionCollectorMetric label="Respuestas" value={collectorNumber(item.active_response_count || item.response_count)} tone={collectorNumber(item.active_response_count || item.response_count) ? "ready" : "neutral"} />
                    <AcreditacionCollectorMetric label="Dest. obs." value={collectorNumber(item.recipient_summary?.total)} />
                    <AcreditacionCollectorMetric label="Links usados" value={collectorNumber(item.recipient_summary?.personalized_link_count)} />
                    <AcreditacionCollectorMetric label="Efectivas" value={completeCount} tone={completeCount ? "ready" : "neutral"} />
                  </div>

                  <div className="mon-collector-controls mon-collector-controls--channel">
                    <label>
                      <span>Uso</span>
                      <select
                        value={operationalUse}
                        onChange={(event) => updateCollector(item, { operational_use: event.currentTarget.value as MonitoreoCollectorUse })}
                      >
                        {MODEL_COLLECTOR_USE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <AcreditacionChannelSelect
                      value={channelOptionForValue(channel).value}
                      onChange={(channelValue) => updateCollector(item, { channel: channelValue })}
                    />
                    <label>
                      <span>Modalidad</span>
                      <select
                        value={normalizeModelModality(item.modality)}
                        onChange={(event) => updateCollector(item, { modality: event.currentTarget.value as MonitoreoStrategyPhase["modality"] })}
                      >
                        {MODEL_MODALITY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="mon-switch-line mon-collector-roster">
                      <input
                        type="checkbox"
                        checked={Boolean(item.roster_required)}
                        onChange={(event) => updateCollector(item, { roster_required: event.currentTarget.checked })}
                      />
                      <span>Barrido</span>
                    </label>
                  </div>

                  <div className="mon-collector-channel-line">
                    <AcreditacionChannelBadge channel={channel} />
                    <span>{collectorDisplayName(item)} · {item.collector_id}</span>
                  </div>

                  {(item.warnings?.length || item.recipient_summary?.truncated) ? (
                    <div className="mon-collector-warnings">
                      {item.recipient_summary?.truncated ? <span>Conteo de destinatarios muestreado</span> : null}
                      {item.warnings?.map((warning) => <span key={warning}>{warning}</span>)}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function inferAcreditacionSurveyChannel(survey: SurveyMonkeyMultibaseListItem) {
  const text = normalizeSourceMatch(`${survey.title} ${survey.nickname ?? ""}`);
  const institutionalActor = text.includes("docent") || text.includes("administr");
  if (text.includes("correo") || text.includes("email") || text.includes("mail")) return "Correo";
  if (text.includes("telefon")) return "Telefónico";
  if (text.includes("presencial") || text.includes("qr")) return "Presencial (Ficha QR)";
  if (institutionalActor && !text.includes("whatsapp") && !text.includes("sms")) return "Correo";
  if (text.includes("whatsapp") || text.includes("sms") || text.includes("web") || text.includes("link") || text.includes("enlace")) return "Enlace personalizado (Whatsapp)";
  if (text.includes("egresad")) return "Telefónico";
  return "Correo";
}

function inferAcreditacionSurveyActor(survey: SurveyMonkeyMultibaseListItem) {
  const text = normalizeSourceMatch(`${survey.title} ${survey.nickname ?? ""}`);
  const actor = ACREDITACION_DEFAULT_ACTORS.find((option) => (
    text.includes(normalizeSourceMatch(option))
  ));
  return actor ?? "Sin actor";
}

function surveyMonkeyDisplayTitle(survey: SurveyMonkeyMultibaseListItem) {
  return survey.nickname || survey.title || survey.id;
}

function jobErrorMessage(error: unknown) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error === "object" && Object.keys(error as Record<string, unknown>).length === 0) return "";
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function AcreditacionSourceStatusStrip({
  sources,
  reports,
  phoneMode = false,
  status,
  busy,
  progress = null,
  onSyncSheets,
  onSyncSurvey,
  onSyncAll,
}: {
  sources: MonitoreoSource[];
  reports: MonitoreoAcreditacionReports;
  phoneMode?: boolean;
  status?: AcreditacionActionStatus;
  busy: boolean;
  progress?: SourceSyncActionsProgress | null;
  onSyncSheets: () => Promise<void>;
  onSyncSurvey: () => Promise<void>;
  onSyncAll: () => Promise<void>;
}) {
  const activeSources = sources.filter((source) => source.enabled);
  const phoneContract = phoneMode ? buildAcreditacionPhoneSourceContract(sources) : null;
  const phoneReadyCount = phoneContract ? phoneContractReadyCount(phoneContract) : 0;
  const packageActiveCount = phoneContract ? phoneReadyCount : activeSources.length;
  const packageTotalCount = phoneContract ? 3 : sources.length;
  const sheetCount = activeSources.filter((source) => source.kind === "google_sheets").length;
  const surveyCount = phoneContract ? phoneContract.platform.sources.filter((source) => source.enabled).length : activeSources.filter(isPlatformResponseSource).length;
  const baseCount = phoneContract ? (phoneContract.universe.ready ? 1 : 0) : sourcesForPreset(sources, ACREDITACION_SOURCE_PRESETS[0]).length;
  const sweepCount = phoneContract ? (phoneContract.sweep.ready ? 1 : 0) : sourcesForPreset(sources, ACREDITACION_SOURCE_PRESETS[1]).length;
  return (
    <section className="mon-acr-source-status-strip" aria-label="Estado de fuentes de acreditación">
      {status ? <span className={`mon-acr-model-action-status is-${status.tone}`}>{status.message}</span> : null}
      <header>
        <span>Fuentes</span>
        <strong>{phoneContract ? "Paquete telefónico" : "Paquete de acreditación"}</strong>
        <p>{fmt(packageTotalCount)} operativas · {fmt(packageActiveCount)} listas · corte {formatDate(reports.generated_at)}</p>
      </header>
      <div className="mon-acr-source-status-metrics">
        <span className={packageActiveCount >= packageTotalCount && packageTotalCount ? "is-ready" : "is-warning"}>
          <PlugZap size={14} />
          <em>Fuentes</em>
          <strong>{fmt(packageActiveCount)}/{fmt(packageTotalCount)}</strong>
          <small>{phoneContract ? "paquete operativo" : "paquete activo"}</small>
        </span>
        <span className={baseCount ? "is-ready" : "is-warning"}>
          <Layers3 size={14} />
          <em>Base</em>
          <strong>{fmt(baseCount)}</strong>
          <small>fuentes base</small>
        </span>
        <span className={surveyCount ? "is-ready" : "is-warning"}>
          <QrCode size={14} />
          <em>{phoneContract ? "Kobo" : "Plataforma"}</em>
          <strong>{fmt(surveyCount)}</strong>
          <small>{fmt(sweepCount)} barrido</small>
        </span>
      </div>
      <AcreditacionSourceSyncActions
        sheetCount={sheetCount}
        surveyCount={surveyCount}
        totalCount={activeSources.length}
        busy={busy}
        progress={progress}
        surveyLabel={phoneContract ? "Kobo" : "encuestas"}
        surveyTitle={phoneContract ? "fuentes Kobo activas" : "encuestas de plataforma activas"}
        onSyncSheets={onSyncSheets}
        onSyncSurvey={onSyncSurvey}
        onSyncAll={onSyncAll}
      />
    </section>
  );
}

function AcreditacionSourceBlueprint({
  sources,
  activePresetKey,
  onSelectPreset,
}: {
  sources: MonitoreoSource[];
  activePresetKey: AcreditacionSourcePresetKey;
  onSelectPreset: (key: AcreditacionSourcePresetKey) => void;
}) {
  return (
    <div className="mon-acr-fixed-source-head">
      <div className="mon-acr-fixed-source-title">
        <span><PlugZap size={13} /> Configuración fija</span>
        <strong>Arquitectura de fuentes de acreditación</strong>
        <em>Sheets define universo y barrido; Kobo/SurveyMonkey aportan respuestas exactas por actor y canal.</em>
      </div>
      <div className="mon-acr-fixed-source-summary" aria-label="Resumen de paquete">
        {ACREDITACION_SOURCE_PRESETS.map((preset) => {
          const presetSources = sourcesForPreset(sources, preset);
          const ready = presetSources.some((source) => source.enabled);
          return (
            <span key={preset.key} className={ready ? "is-ready" : "is-warning"}>
              {ready ? `${preset.label} lista` : `Falta ${preset.label.toLowerCase()}`}
            </span>
          );
        })}
      </div>
      <div className="mon-acr-source-blueprint" aria-label="Flujo de fuentes de acreditación">
        {ACREDITACION_SOURCE_PRESETS.map((preset, index) => {
          const Icon = preset.icon;
          const presetSources = sourcesForPreset(sources, preset);
          const ready = presetSources.some((source) => source.enabled);
          return (
            <button
              key={preset.key}
              type="button"
              className={`mon-acr-source-blueprint-step${ready ? " is-ready" : ""}${activePresetKey === preset.key ? " is-active" : ""}`}
              onClick={() => onSelectPreset(preset.key)}
            >
              <i>{String(index + 1).padStart(2, "0")}</i>
              <Icon size={15} />
              <strong>{preset.label}</strong>
              <em>{presetSources.length ? `${fmt(presetSources.length)} fuente${presetSources.length === 1 ? "" : "s"}` : "pendiente"}</em>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AcreditacionSourceRequirementCard({
  preset,
  sources,
  active,
  onSelect,
}: {
  preset: AcreditacionSourcePreset;
  sources: MonitoreoSource[];
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = preset.icon;
  const ready = sources.some((source) => source.enabled);
  const sheetLabels = uniqueDisplayValues(sources.map((source) => (
    source.sheet_binding?.sheet_name
    ?? sourceActorLabel(source)
    ?? source.label
  )));
  const actorLabels = uniqueDisplayValues(sources.map(sourceActorLabel));
  const spreadsheetLinks = sources
    .map((source) => ({ href: sourceSpreadsheetUrl(source), label: sourceSpreadsheetDisplay(source) }))
    .filter((link) => link.href)
    .filter((link, index, list) => list.findIndex((item) => item.href === link.href) === index)
    .slice(0, 3);
  const visibleSheets = sheetLabels.slice(0, 5);
  const visibleActors = actorLabels.slice(0, 4);
  const visibleTags = uniqueDisplayValues([...visibleSheets, ...visibleActors]).slice(0, 8);
  const hiddenTagCount = Math.max(0, sheetLabels.length + actorLabels.length - visibleTags.length);
  const lastSync = mostRecentSyncLabel(sources);
  return (
    <article className={`mon-acr-requirement-card${active ? " is-active" : ""}${ready ? " is-ready" : ""}`}>
      <div className="mon-acr-requirement-main">
        <span className="mon-acr-requirement-icon"><Icon size={15} /></span>
        <span className="mon-acr-requirement-copy">
          <strong>{preset.label}</strong>
          <em>{sources.length ? `${fmt(sources.length)} fuente${sources.length === 1 ? "" : "s"}` : "Pendiente"}</em>
        </span>
        <span className="mon-acr-requirement-status">{ready ? "Lista" : "Falta"}</span>
        <button type="button" className="mon-acr-requirement-adjust" onClick={onSelect}>
          Ajustar
        </button>
      </div>
      <p className="mon-acr-requirement-detail">
        {sources.length ? preset.detail : preset.key === "base_trabajada" ? "Lee las pestañas del universo." : preset.key === "barrido_telefonico" ? "Selecciona la pestaña de barrido." : "Asigna encuestas por actor y canal."}
      </p>
      <div className="mon-acr-requirement-data">
        <div className="mon-acr-requirement-field">
          <span>{preset.provider === "google_sheets" ? "Spreadsheet" : "Encuesta"}</span>
          <div className="mon-acr-requirement-links">
            {spreadsheetLinks.length ? spreadsheetLinks.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer" title={link.href}>
                <Link2 size={12} />
                <span>{link.label}</span>
              </a>
            )) : (
              <em>{preset.provider === "google_sheets" ? "Enlace pendiente" : "Survey ID pendiente"}</em>
            )}
          </div>
        </div>
        <div className="mon-acr-requirement-field">
          <span>{preset.key === "base_trabajada" ? "Pestañas / actores" : preset.key === "barrido_telefonico" ? "Pestaña de barrido" : "Actores / canales"}</span>
          <div className="mon-acr-requirement-sheets">
            {visibleTags.map((label) => <i key={label}>{label}</i>)}
            {hiddenTagCount > 0 ? <i>+{fmt(hiddenTagCount)}</i> : null}
            {!sheetLabels.length && !actorLabels.length ? <i>Pendiente</i> : null}
          </div>
        </div>
      </div>
      {sources.length ? (
        <div className={`mon-acr-requirement-ops is-${preset.key === "barrido_telefonico" ? "phone" : "universe"}`}>
          <div className="mon-acr-requirement-ops-copy">
            <span>{preset.service}</span>
            <p>{preset.detail}</p>
          </div>
          <div className="mon-acr-requirement-metrics">
            <span className="mon-acr-requirement-metric">
              <em>Activas</em>
              <strong>{fmt(sources.filter((source) => source.enabled).length)}</strong>
              <span>sincronizables</span>
            </span>
            <span className="mon-acr-requirement-metric">
              <em>Cortes</em>
              <strong>{fmt(Math.max(sheetLabels.length, actorLabels.length, sources.length))}</strong>
              <span>segmentos</span>
            </span>
            <span className="mon-acr-requirement-metric">
              <em>Último sync</em>
              <strong>{lastSync === "Sin sync" ? "Sin sync" : "Listo"}</strong>
              <span>{lastSync}</span>
            </span>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function AcreditacionSheetSourceEditor({
  preset,
  sources,
  onStateChange,
}: {
  preset: AcreditacionSourcePreset;
  sources: MonitoreoSource[];
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const firstSource = sources[0] ?? null;
  const [editingSourceId, setEditingSourceId] = useState(firstSource?.id ?? "");
  const [spreadsheetId, setSpreadsheetId] = useState(firstSource?.sheet_binding?.spreadsheet_id ?? "");
  const [sheetName, setSheetName] = useState(firstSource?.sheet_binding?.sheet_name ?? "");
  const [sourceLabel, setSourceLabel] = useState(firstSource?.label || preset.sourceLabel);
  const [range, setRange] = useState(firstSource?.sheet_binding?.range ?? "");
  const [inspection, setInspection] = useState<MonitoreoSheetsInspectResult | null>(null);
  const [busy, setBusy] = useState<"inspect" | "save" | null>(null);
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);

  useEffect(() => {
    const next = sources[0] ?? null;
    setEditingSourceId(next?.id ?? "");
    setSpreadsheetId(next?.sheet_binding?.spreadsheet_id ?? "");
    setSheetName(next?.sheet_binding?.sheet_name ?? "");
    setSourceLabel(next?.label || preset.sourceLabel);
    setRange(next?.sheet_binding?.range ?? "");
    setInspection(null);
    setStatus(null);
  }, [preset.key]);

  const selectSource = (sourceId: string) => {
    const selected = sources.find((source) => source.id === sourceId) ?? null;
    setEditingSourceId(sourceId);
    setSpreadsheetId(selected?.sheet_binding?.spreadsheet_id ?? "");
    setSheetName(selected?.sheet_binding?.sheet_name ?? "");
    setSourceLabel(selected?.label || preset.sourceLabel);
    setRange(selected?.sheet_binding?.range ?? "");
    setInspection(null);
    setStatus(null);
  };

  const inspectSheets = async () => {
    if (!spreadsheetId.trim()) {
      setStatus({ tone: "error", message: "Pega el Spreadsheet ID o URL antes de leer pestañas." });
      return;
    }
    setBusy("inspect");
    setStatus({ tone: "info", message: "Leyendo pestañas desde Google Sheets..." });
    try {
      const result = await apiMonitoreoSheetsInspect({
        spreadsheet_id: spreadsheetId.trim(),
        sheet_name: sheetName.trim(),
        header_row: 1,
        range: range.trim(),
      });
      setInspection(result);
      setStatus({ tone: "success", message: `${fmt(result.sheets.length)} pestañas detectadas en ${result.title || "Spreadsheet"}.` });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const saveSheet = async () => {
    if (!spreadsheetId.trim() || !sheetName.trim()) {
      setStatus({ tone: "error", message: "Spreadsheet y pestaña son obligatorios." });
      return;
    }
    setBusy("save");
    setStatus({ tone: "info", message: editingSourceId ? "Guardando ajuste de fuente..." : "Registrando fuente Sheets..." });
    try {
      const result = await apiMonitoreoSheetsSource({
        id: editingSourceId || undefined,
        kind: "google_sheets",
        label: sourceLabel.trim() || preset.sourceLabel,
        enabled: true,
        role: preset.role,
        integration_mode: "connected_read",
        sheet_binding: {
          spreadsheet_id: spreadsheetId.trim(),
          sheet_name: sheetName.trim(),
          header_row: 1,
          range: range.trim(),
        },
        dimensions: cleanSourceDimensions({
          actor: preset.key === "barrido_telefonico" ? "Egresados" : sheetName.trim(),
          carrera: preset.key === "base_trabajada" ? sheetName.trim() : "",
          canal: preset.key === "barrido_telefonico" ? "Telefónico" : "Base",
          servicio: preset.label,
          sheet_name: sheetName.trim(),
        }),
      });
      onStateChange?.(result.state);
      setEditingSourceId(result.source.id);
      setStatus({ tone: "success", message: `${result.source.label || preset.label} quedó registrada en el paquete.` });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mon-acr-source-editor mon-acr-sheet-adjustment" aria-label={`Editor de ${preset.label}`}>
      <div className="mon-acr-sheet-adjustment-head">
        <div>
          <span>{editingSourceId ? "Editando fuente" : "Nueva fuente"}</span>
          <strong>{preset.label}</strong>
        </div>
        <button type="button" className="mon-acr-sheet-adjustment-close" onClick={() => selectSource("")}>
          Nueva
        </button>
      </div>
      {sources.length > 0 ? (
        <label className="mon-acr-sheet-source-select">
          <span>Fuente</span>
          <select value={editingSourceId} onChange={(event) => selectSource(event.currentTarget.value)} disabled={Boolean(busy)}>
            <option value="">{preset.key === "base_trabajada" ? "Nueva pestaña" : "Nuevo barrido"}</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.label || source.sheet_binding?.sheet_name || source.id}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="mon-acr-sheet-form">
        <label>
          <span>Spreadsheet</span>
          <input
            value={spreadsheetId}
            onChange={(event) => setSpreadsheetId(event.currentTarget.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            disabled={Boolean(busy)}
          />
        </label>
        <label>
          <span>{preset.sheetLabel ?? "Pestaña"}</span>
          <input
            value={sheetName}
            onChange={(event) => setSheetName(event.currentTarget.value)}
            placeholder={preset.key === "barrido_telefonico" ? "Barrido" : "Administrativos"}
            disabled={Boolean(busy)}
          />
        </label>
        <label>
          <span>Nombre operativo</span>
          <input
            value={sourceLabel}
            onChange={(event) => setSourceLabel(event.currentTarget.value)}
            placeholder={preset.sourceLabel}
            disabled={Boolean(busy)}
          />
        </label>
        <label>
          <span>Rango</span>
          <input
            value={range}
            onChange={(event) => setRange(event.currentTarget.value)}
            placeholder="Opcional"
            disabled={Boolean(busy)}
          />
        </label>
        <div className="mon-acr-sheet-actions">
          <button type="button" onClick={() => { void inspectSheets(); }} disabled={Boolean(busy) || !spreadsheetId.trim()}>
            {busy === "inspect" ? <Loader2 size={14} className="pulso-spin" /> : <Search size={14} />}
            Leer pestañas
          </button>
          <button type="button" onClick={() => { void saveSheet(); }} disabled={Boolean(busy) || !spreadsheetId.trim() || !sheetName.trim()}>
            {busy === "save" ? <Loader2 size={14} className="pulso-spin" /> : <CheckCircle2 size={14} />}
            {editingSourceId ? "Guardar ajuste" : "Registrar base"}
          </button>
        </div>
      </div>
      {status ? <div className={status.tone === "error" ? "mon-sm-error" : "mon-sm-meta"}>{status.message}</div> : null}
      {inspection ? (
        <div className="mon-acr-sheet-inspection">
          <div className="mon-acr-sheet-inspection-head">
            <strong>{inspection.title || inspection.spreadsheet_id}</strong>
            <span>{fmt(inspection.sheets.length)} pestañas · {fmt(inspection.headers.length)} encabezados</span>
          </div>
          <div className="mon-acr-sheet-tabs">
            {inspection.sheets.slice(0, 14).map((sheet) => (
              <button key={sheet.title} type="button" onClick={() => setSheetName(sheet.title)}>
                {sheet.title}
              </button>
            ))}
          </div>
          {inspection.headers.length ? (
            <div className="mon-source-dim-badges">
              {inspection.headers.slice(0, 12).map((header) => <span key={header}>{header}</span>)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AcreditacionSurveySourcePicker({
  sources,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const configuredSurveyIds = useMemo(() => new Set(
    sources.map((source) => source.survey_id).filter((value): value is string => Boolean(value)),
  ), [sources]);
  const [query, setQuery] = useState("");
  const [months, setMonths] = useState(6);
  const [filter, setFilter] = useState("");
  const [results, setResults] = useState<SurveyMonkeyMultibaseListItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [actors, setActors] = useState<Record<string, string>>({});
  const [channels, setChannels] = useState<Record<string, string>>({});
  const [inspections, setInspections] = useState<Record<string, { loading: boolean; error: string; data: SurveyMonkeyMultibaseInspection | null }>>({});
  const [meta, setMeta] = useState<{ totalRecent: number; months: number; fromCache: boolean } | null>(null);
  const [busy, setBusy] = useState<"search" | "refresh" | string | null>(null);
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);
  const actorOptions = useMemo(
    () => acreditacionActorOptions(sources.filter(isPlatformResponseSource), ACREDITACION_DEFAULT_ACTORS),
    [sources],
  );

  const visibleSurveys = useMemo(() => {
    const needle = normalizeSourceMatch(filter);
    const filtered = needle
      ? results.filter((survey) => normalizeSourceMatch(`${survey.title} ${survey.nickname ?? ""} ${survey.id} ${actors[survey.id] ?? ""} ${channels[survey.id] ?? ""}`).includes(needle))
      : results;
    return filtered.sort((a, b) => {
      const aSelected = a.id === selectedId;
      const bSelected = b.id === selectedId;
      if (aSelected !== bSelected) return aSelected ? -1 : 1;
      const aAdded = configuredSurveyIds.has(a.id);
      const bAdded = configuredSurveyIds.has(b.id);
      if (aAdded !== bAdded) return aAdded ? 1 : -1;
      return surveyMonkeyDisplayTitle(a).localeCompare(surveyMonkeyDisplayTitle(b), "es");
    });
  }, [actors, channels, configuredSurveyIds, filter, results, selectedId]);
  const selectedSurvey = results.find((survey) => survey.id === selectedId) ?? visibleSurveys[0] ?? null;
  const selectedActor = selectedSurvey ? (actors[selectedSurvey.id] ?? "").trim() : "";
  const selectedChannel = selectedSurvey ? (channels[selectedSurvey.id] ?? "").trim() : "";
  const canAddSelectedSurvey = Boolean(selectedSurvey && selectedActor && selectedChannel && !configuredSurveyIds.has(selectedSurvey.id));

  const hydrateSurveyDefaults = (surveys: SurveyMonkeyMultibaseListItem[]) => {
    setLabels((prev) => {
      const next = { ...prev };
      surveys.forEach((survey) => {
        if (next[survey.id] == null) next[survey.id] = surveyMonkeyDisplayTitle(survey);
      });
      return next;
    });
    setActors((prev) => {
      const next = { ...prev };
      surveys.forEach((survey) => {
        if (next[survey.id] == null) next[survey.id] = "";
      });
      return next;
    });
    setChannels((prev) => {
      const next = { ...prev };
      surveys.forEach((survey) => {
        if (next[survey.id] == null) next[survey.id] = "";
      });
      return next;
    });
  };

  const searchSurveys = async (forceRefresh = false) => {
    setBusy(forceRefresh ? "refresh" : "search");
    setStatus({ tone: "info", message: forceRefresh ? "Actualizando catálogo SurveyMonkey..." : "Buscando encuestas SurveyMonkey..." });
    try {
      const result = await apiSurveyMonkeyMultibaseListSurveys(query, 100, months, { forceRefresh });
      hydrateSurveyDefaults(result.surveys);
      setResults(result.surveys);
      setSelectedId((current) => current || result.surveys[0]?.id || "");
      setMeta({ totalRecent: result.total_recent, months: result.months, fromCache: result.from_cache });
      setStatus(null);
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const inspectSurvey = async (survey: SurveyMonkeyMultibaseListItem) => {
    setInspections((prev) => ({
      ...prev,
      [survey.id]: { loading: true, error: "", data: prev[survey.id]?.data ?? null },
    }));
    try {
      const data = await apiSurveyMonkeyMultibaseInspectSurvey(survey.id, 5, "https://api.surveymonkey.com/v3");
      setInspections((prev) => ({
        ...prev,
        [survey.id]: { loading: false, error: "", data },
      }));
    } catch (error) {
      setInspections((prev) => ({
        ...prev,
        [survey.id]: { loading: false, error: (error as Error).message, data: prev[survey.id]?.data ?? null },
      }));
    }
  };

  const payloadForSurvey = (survey: SurveyMonkeyMultibaseListItem): MonitoreoSourcePayload => {
    const actor = actors[survey.id] || "";
    const channel = channels[survey.id] || "";
    const label = labels[survey.id] || surveyMonkeyDisplayTitle(survey) || survey.title;
    return {
      kind: "surveymonkey",
      label,
      survey_id: survey.id,
      survey_title: survey.title,
      base_url: "https://api.surveymonkey.com/v3",
      role: "respuestas",
      integration_mode: "connected_read",
      dimensions: cleanSourceDimensions({
        actor,
        segmento: actor,
        carrera: actor,
        canal: channel,
        servicio: "Respuestas SurveyMonkey",
        survey_title: survey.title,
      }),
    };
  };

  const addSurvey = async (survey: SurveyMonkeyMultibaseListItem) => {
    if (configuredSurveyIds.has(survey.id)) return;
    const actor = (actors[survey.id] ?? "").trim();
    const channel = (channels[survey.id] ?? "").trim();
    if (!actor || !channel) {
      setSelectedId(survey.id);
      setStatus({ tone: "error", message: "Elige actor y canal antes de agregar esta encuesta." });
      return;
    }
    setBusy(survey.id);
    setStatus({ tone: "info", message: `Agregando ${surveyMonkeyDisplayTitle(survey)}...` });
    try {
      const result = await apiMonitoreoSource(payloadForSurvey(survey));
      onStateChange?.(result.state);
      setStatus({ tone: "success", message: `${result.source.label || survey.title} quedó agregada al paquete.` });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`mon-acr-source-editor mon-acr-survey-add${results.length ? " has-results" : " is-compact"}`} aria-label="Picker de respuestas SurveyMonkey">
      <div className="mon-acr-survey-add-head">
        <label>
          <span>Buscar encuesta SurveyMonkey</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Egresados, Estudiantes, Docentes..."
            disabled={Boolean(busy)}
          />
        </label>
        <label>
          <span>Periodo</span>
          <select value={months} onChange={(event) => setMonths(Number(event.currentTarget.value) || 1)} disabled={Boolean(busy)}>
            <option value={1}>Último mes</option>
            <option value={2}>Últimos 2 meses</option>
            <option value={6}>Últimos 6 meses</option>
            <option value={12}>Último año</option>
            <option value={36}>Histórico reciente</option>
          </select>
        </label>
        <button type="button" onClick={() => { void searchSurveys(false); }} disabled={Boolean(busy)}>
          {busy === "search" ? <Loader2 size={14} className="pulso-spin" /> : <Search size={14} />}
          Buscar
        </button>
        {results.length ? (
          <button type="button" onClick={() => { void searchSurveys(true); }} disabled={Boolean(busy)}>
            {busy === "refresh" ? <Loader2 size={14} className="pulso-spin" /> : <RefreshCw size={14} />}
            Actualizar
          </button>
        ) : null}
      </div>
      {meta ? (
        <div className="mon-sm-meta">
          {fmt(results.length)} visibles · {fmt(meta.totalRecent)} recientes en {meta.months === 1 ? "el último mes" : `los últimos ${fmt(meta.months)} meses`}
          {meta.fromCache ? " · catálogo local" : " · SurveyMonkey"}
        </div>
      ) : null}
      {status ? <div className={status.tone === "error" ? "mon-sm-error" : "mon-sm-meta"}>{status.message}</div> : null}
      {results.length ? (
        <div className="mon-sm-survey-workflow">
          <div className="mon-sm-survey-catalog">
            <div className="pulso-sm-survey-picker">
              <label className="pulso-sm-search">
                <Search size={14} />
                <input
                  value={filter}
                  onChange={(event) => setFilter(event.currentTarget.value)}
                  placeholder="Filtrar por nombre, actor o ID"
                  disabled={Boolean(busy)}
                />
              </label>
              <div className="pulso-sm-list-caption">{fmt(visibleSurveys.length)} de {fmt(results.length)} encuestas</div>
            </div>
            <div className="pulso-sm-survey-list" aria-label="Encuestas SurveyMonkey">
              {visibleSurveys.map((survey) => {
                const selected = survey.id === selectedSurvey?.id;
                const added = configuredSurveyIds.has(survey.id);
                return (
                  <button
                    key={survey.id}
                    type="button"
                    className={`pulso-sm-survey-card${selected ? " is-selected" : ""}${added ? " is-added" : ""}`}
                    onClick={() => setSelectedId(survey.id)}
                    disabled={Boolean(busy)}
                    aria-pressed={selected}
                  >
                    <span className="pulso-sm-survey-card-copy">
                      <strong>{surveyMonkeyDisplayTitle(survey)}</strong>
                      <small>{survey.id}{survey.date_modified ? ` · ${formatDate(survey.date_modified)}` : ""}</small>
                      <span className="pulso-sm-survey-card-meta">
                        {survey.pais_guess ? <b>{survey.pais_guess}</b> : null}
                        {survey.response_count != null ? <i>{fmt(survey.response_count)} respuestas</i> : null}
                      </span>
                    </span>
                    <em>{added ? "Agregada" : selected ? "En edición" : "Elegir"}</em>
                  </button>
                );
              })}
              {!visibleSurveys.length ? <div className="pulso-sm-empty">No hay coincidencias con el filtro actual.</div> : null}
            </div>
          </div>
          {selectedSurvey ? (
            <div className="mon-sm-selected-survey">
              <div className="pulso-sm-selected-head">
                <strong>Encuesta seleccionada</strong>
                <span>{surveyMonkeyDisplayTitle(selectedSurvey)} · {selectedSurvey.id}</span>
              </div>
              <div className="mon-sm-result">
                <div className="mon-sm-result-main">
                  <strong>{selectedSurvey.title}</strong>
                  <span>{selectedSurvey.date_modified ? formatDate(selectedSurvey.date_modified) : "Sin fecha de modificación"}</span>
                </div>
                <div className="mon-sm-selected-fields">
                  <label className="mon-source-name-field">
                    <span>Nombre real en plataforma</span>
                    <input value={labels[selectedSurvey.id] ?? ""} onChange={(event) => setLabels((prev) => ({ ...prev, [selectedSurvey.id]: event.currentTarget.value }))} placeholder={selectedSurvey.title || "Nombre visible"} />
                  </label>
                  <AcreditacionActorAssignableField
                    value={actors[selectedSurvey.id] ?? ""}
                    options={actorOptions}
                    disabled={Boolean(busy)}
                    onChange={(actor) => setActors((prev) => ({ ...prev, [selectedSurvey.id]: actor }))}
                  />
                  <AcreditacionChannelSelect
                    value={channels[selectedSurvey.id] ?? ""}
                    onChange={(channel) => setChannels((prev) => ({ ...prev, [selectedSurvey.id]: channel }))}
                    disabled={Boolean(busy)}
                    allowEmpty
                  />
                </div>
                {!canAddSelectedSurvey && !configuredSurveyIds.has(selectedSurvey.id) ? (
                  <div className="mon-sm-meta">Elige actor y canal para habilitar el alta individual.</div>
                ) : null}
                <div className="mon-sm-result-actions">
                  <button type="button" onClick={() => { void inspectSurvey(selectedSurvey); }} disabled={Boolean(busy) || inspections[selectedSurvey.id]?.loading}>
                    {inspections[selectedSurvey.id]?.loading ? <Loader2 size={14} className="pulso-spin" /> : <Eye size={14} />}
                    Ver datos
                  </button>
                  <button type="button" onClick={() => { void addSurvey(selectedSurvey); }} disabled={Boolean(busy) || !canAddSelectedSurvey}>
                    {busy === selectedSurvey.id ? <Loader2 size={14} className="pulso-spin" /> : <Plus size={14} />}
                    {configuredSurveyIds.has(selectedSurvey.id) ? "Ya agregada" : "Agregar al proyecto"}
                  </button>
                </div>
                <AcreditacionSurveyInspectionCard inspection={inspections[selectedSurvey.id]} />
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mon-source-picker-note is-empty">
          <Search size={15} />
          <div>
            <strong>Busca respuestas SurveyMonkey</strong>
            <span>Los resultados aparecerán aquí antes de agregarlos al paquete de acreditación.</span>
          </div>
        </div>
      )}
    </div>
  );
}

function AcreditacionKoboSourcePicker({
  sources,
  phoneMode = false,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  phoneMode?: boolean;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const configuredAssetIds = useMemo(() => new Set(
    sources.map((source) => source.asset_uid).filter((value): value is string => Boolean(value)),
  ), [sources]);
  const configuredBaseUrl = sources[0]?.base_url || "";
  const configuredProfileId = sources[0]?.connection_profile_id || "";
  const [koboConnection, setKoboConnection] = useState<ConnectionTokenState | null>(null);
  const [baseUrl, setBaseUrl] = useState(configuredBaseUrl || KOBO_DEFAULT_BASE_URL);
  const [profileId, setProfileId] = useState(configuredProfileId);
  const [filter, setFilter] = useState("");
  const [assets, setAssets] = useState<MonitoreoKoboAssetItem[]>([]);
  const [selectedUid, setSelectedUid] = useState("");
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [actors, setActors] = useState<Record<string, string>>({});
  const [channels, setChannels] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"list" | string | null>(null);
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);

  const preferredKoboProfile = useMemo(() => {
    const profiles = koboConnection?.profiles ?? [];
    return profiles.find((profile) => profile.id === koboConnection?.active_profile_id)
      ?? profiles.find((profile) => profile.is_default)
      ?? profiles.find((profile) => profile.base_url)
      ?? profiles[0]
      ?? null;
  }, [koboConnection]);
  const preferredBaseUrl = koboConnection?.active_profile_base_url || preferredKoboProfile?.base_url || "";
  const preferredProfileId = koboConnection?.active_profile_id || preferredKoboProfile?.id || "";

  useEffect(() => {
    let cancelled = false;
    void apiConnectionTokenLoad("kobo")
      .then((connection) => {
        if (cancelled) return;
        setKoboConnection(connection);
      })
      .catch(() => {
        if (!cancelled) setKoboConnection(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (configuredBaseUrl) {
      setBaseUrl(configuredBaseUrl);
    } else if (preferredBaseUrl) {
      setBaseUrl((current) => {
        const trimmed = current.trim();
        return trimmed && trimmed !== KOBO_DEFAULT_BASE_URL ? current : preferredBaseUrl;
      });
    }
    if (configuredProfileId) {
      setProfileId(configuredProfileId);
    } else if (preferredProfileId) {
      setProfileId((current) => current.trim() ? current : preferredProfileId);
    }
  }, [configuredBaseUrl, configuredProfileId, preferredBaseUrl, preferredProfileId]);

  const visibleAssets = useMemo(() => {
    const needle = normalizeSourceMatch(filter);
    const filtered = needle
      ? assets.filter((asset) => normalizeSourceMatch(`${asset.name} ${asset.uid}`).includes(needle))
      : assets;
    return [...filtered].sort((a, b) => {
      const aSelected = a.uid === selectedUid;
      const bSelected = b.uid === selectedUid;
      if (aSelected !== bSelected) return aSelected ? -1 : 1;
      const aAdded = configuredAssetIds.has(a.uid);
      const bAdded = configuredAssetIds.has(b.uid);
      if (aAdded !== bAdded) return aAdded ? 1 : -1;
      return (a.name || a.uid).localeCompare(b.name || b.uid, "es");
    });
  }, [assets, configuredAssetIds, filter, selectedUid]);
  const selectedAsset = assets.find((asset) => asset.uid === selectedUid) ?? visibleAssets[0] ?? null;

  const hydrateKoboDefaults = (items: MonitoreoKoboAssetItem[]) => {
    setLabels((prev) => {
      const next = { ...prev };
      items.forEach((asset) => {
        if (next[asset.uid] == null) next[asset.uid] = asset.name || asset.uid;
      });
      return next;
    });
    setActors((prev) => {
      const next = { ...prev };
      items.forEach((asset) => {
        if (next[asset.uid] == null) next[asset.uid] = "";
      });
      return next;
    });
    setChannels((prev) => {
      const next = { ...prev };
      items.forEach((asset) => {
        if (next[asset.uid] == null) next[asset.uid] = "";
      });
      return next;
    });
  };

  const listAssets = async () => {
    setBusy("list");
    setStatus({ tone: "info", message: "Leyendo formularios Kobo disponibles..." });
    try {
      const result = await apiMonitoreoKoboAssets(baseUrl.trim() || KOBO_DEFAULT_BASE_URL, 100, {
        connection_profile_id: profileId.trim() || undefined,
      });
      hydrateKoboDefaults(result.assets);
      setAssets(result.assets);
      setSelectedUid((current) => current || result.assets[0]?.uid || "");
      setStatus({ tone: "success", message: `${fmt(result.assets.length)} formulario${result.assets.length === 1 ? "" : "s"} Kobo disponibles para seleccionar.` });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const payloadForAsset = (asset: MonitoreoKoboAssetItem): MonitoreoSourcePayload => {
    const actor = phoneMode ? "" : actors[asset.uid] || "";
    const segment = actors[asset.uid] || "";
    const channel = phoneMode ? "Kobo" : channels[asset.uid] || "";
    const label = labels[asset.uid] || asset.name || asset.uid;
    return {
      kind: "kobo",
      label,
      asset_uid: asset.uid,
      survey_title: asset.name || label,
      base_url: baseUrl.trim() || KOBO_DEFAULT_BASE_URL,
      connection_profile_id: profileId.trim(),
      role: "respuestas",
      integration_mode: "connected_read",
      dimensions: cleanSourceDimensions({
        actor,
        segmento: phoneMode ? segment : actor,
        carrera: phoneMode ? segment : actor,
        canal: channel,
        servicio: "Respuestas Kobo",
        survey_title: asset.name || label,
      }),
    };
  };

  const addAsset = async (asset: MonitoreoKoboAssetItem) => {
    if (configuredAssetIds.has(asset.uid)) return;
    setBusy(asset.uid);
    setStatus({ tone: "info", message: `Registrando ${asset.name || asset.uid} como ${phoneMode ? "instrumento" : "encuesta"} Kobo...` });
    try {
      const result = await apiMonitoreoSource(payloadForAsset(asset));
      onStateChange?.(result.state);
      setStatus({ tone: "success", message: `${result.source.label || asset.name || asset.uid} quedó como ${phoneMode ? "instrumento" : "encuesta"} Kobo.` });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`mon-acr-source-editor mon-acr-survey-add mon-acr-kobo-add${assets.length ? " has-results" : " is-compact"}`} aria-label="Selector de encuesta Kobo en plataforma">
      <div className="mon-acr-survey-add-head">
        <label>
          <span>URL Kobo</span>
          <input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.currentTarget.value)}
            placeholder={preferredBaseUrl || KOBO_DEFAULT_BASE_URL}
            disabled={Boolean(busy)}
          />
        </label>
        <label>
          <span>Perfil</span>
          <input
            value={profileId}
            onChange={(event) => setProfileId(event.currentTarget.value)}
            placeholder="Opcional"
            disabled={Boolean(busy)}
          />
        </label>
        <label>
          <span>Filtro</span>
          <input
            value={filter}
            onChange={(event) => setFilter(event.currentTarget.value)}
            placeholder="Buscar formulario"
            disabled={Boolean(busy)}
          />
        </label>
        <button type="button" onClick={() => { void listAssets(); }} disabled={Boolean(busy)}>
          {busy === "list" ? <Loader2 size={14} className="pulso-spin" /> : <Search size={14} />}
          Listar Kobo
        </button>
      </div>
      {status ? <div className={status.tone === "error" ? "mon-sm-error" : "mon-sm-meta"}>{status.message}</div> : null}
      {assets.length ? (
        <div className="mon-sm-survey-workflow">
          <div className="mon-sm-survey-catalog">
            <div className="pulso-sm-survey-picker">
              <div className="pulso-sm-list-caption">{fmt(visibleAssets.length)} de {fmt(assets.length)} formularios Kobo</div>
            </div>
            <div className="pulso-sm-survey-list" aria-label="Formularios Kobo">
              {visibleAssets.map((asset) => {
                const selected = asset.uid === selectedAsset?.uid;
                const added = configuredAssetIds.has(asset.uid);
                return (
                  <button
                    key={asset.uid}
                    type="button"
                    className={`pulso-sm-survey-card${selected ? " is-selected" : ""}${added ? " is-added" : ""}`}
                    onClick={() => setSelectedUid(asset.uid)}
                    disabled={Boolean(busy)}
                    aria-pressed={selected}
                  >
                    <span className="pulso-sm-survey-card-copy">
                      <strong>{asset.name || asset.uid}</strong>
                      <small>{asset.uid}{asset.date_modified ? ` · ${formatDate(asset.date_modified)}` : ""}</small>
                      <span className="pulso-sm-survey-card-meta">
                        <b>{asset.deployment_active ? "Deploy activo" : "Sin deploy activo"}</b>
                        {asset.version_id ? <i>{asset.version_id}</i> : null}
                      </span>
                    </span>
                    <em>{added ? "Agregada" : selected ? "En edición" : "Elegir"}</em>
                  </button>
                );
              })}
              {!visibleAssets.length ? <div className="pulso-sm-empty">No hay formularios Kobo con ese filtro.</div> : null}
            </div>
          </div>
          {selectedAsset ? (
            <div className="mon-sm-selected-survey">
              <div className="pulso-sm-selected-head">
                <strong>Encuesta Kobo seleccionada</strong>
                <span>{selectedAsset.name || selectedAsset.uid} · {shortenMiddle(selectedAsset.uid, 34)}</span>
              </div>
              <div className="mon-sm-result">
                <label className="mon-source-name-field">
                  <span>{phoneMode ? "Nombre del instrumento" : "Nombre real en plataforma"}</span>
                  <input value={labels[selectedAsset.uid] ?? ""} onChange={(event) => setLabels((prev) => ({ ...prev, [selectedAsset.uid]: event.currentTarget.value }))} placeholder={selectedAsset.name || "Nombre visible"} />
                </label>
                <label className="mon-source-name-field">
                  <span>{phoneMode ? "Segmento operativo" : "Actor / carrera"}</span>
                  <input value={actors[selectedAsset.uid] ?? ""} onChange={(event) => setActors((prev) => ({ ...prev, [selectedAsset.uid]: event.currentTarget.value }))} placeholder={phoneMode ? "Opcional: sede u otro segmento" : "Actor"} />
                </label>
                {phoneMode ? (
                  <div className="mon-phone-kobo-fixed-channel">
                    <QrCode size={14} />
                    <span>
                      <strong>Kobo es la plataforma rectora</strong>
                      <em>El canal no define efectivas; solo el filtro guardado.</em>
                    </span>
                  </div>
                ) : (
                  <AcreditacionChannelSelect
                    value={channels[selectedAsset.uid] ?? ""}
                    onChange={(channel) => setChannels((prev) => ({ ...prev, [selectedAsset.uid]: channel }))}
                    allowEmpty
                  />
                )}
                <div className="mon-sm-result-actions">
                  <button type="button" onClick={() => { void addAsset(selectedAsset); }} disabled={Boolean(busy) || configuredAssetIds.has(selectedAsset.uid)}>
                    {busy === selectedAsset.uid ? <Loader2 size={14} className="pulso-spin" /> : <Plus size={14} />}
                    {configuredAssetIds.has(selectedAsset.uid) ? "Ya agregada" : phoneMode ? "Usar como instrumento" : "Usar como plataforma"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mon-source-picker-note is-empty">
          <Search size={15} />
          <div>
            <strong>Selecciona la encuesta Kobo de plataforma</strong>
            <span>{phoneMode ? "Lista los formularios Kobo y elige el instrumento que cuenta efectivas contra CodPulso." : "Lista los formularios Kobo y elige cuál alimenta el avance contra la base de barrido."}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function AcreditacionSurveyInspectionCard({
  inspection,
}: {
  inspection?: { loading: boolean; error: string; data: SurveyMonkeyMultibaseInspection | null };
}) {
  if (!inspection) return null;
  if (inspection.loading && !inspection.data) {
    return (
      <div className="mon-sm-inspection">
        <Loader2 size={14} className="pulso-spin" />
        <span>Cargando estructura y respuestas...</span>
      </div>
    );
  }
  if (inspection.error && !inspection.data) {
    return <div className="mon-sm-error mon-sm-inspection-error">{inspection.error}</div>;
  }
  const data = inspection.data;
  if (!data) return null;
  const columns = data.columns.slice(0, 12);
  const questions = data.questions.slice(0, 8);
  return (
    <div className="mon-sm-inspection">
      <div className="mon-sm-inspection-head">
        <div>
          <span>Datos detectados</span>
          <strong>{data.title || data.survey_id}</strong>
        </div>
        {inspection.loading ? <Loader2 size={14} className="pulso-spin" /> : null}
      </div>
      {inspection.error ? <div className="mon-sm-error">{inspection.error}</div> : null}
      <div className="mon-sm-inspection-metrics">
        <span>{fmt(data.n_pages)} páginas</span>
        <span>{fmt(data.n_questions)} preguntas</span>
        <span>{data.responses.total == null ? "Sin total" : `${fmt(data.responses.total)} respuestas`}</span>
        <span>{fmt(data.columns.length)} columnas</span>
      </div>
      {columns.length ? (
        <div className="mon-sm-column-list">
          {columns.map((column) => (
            <span key={column.name} title={column.examples.join(" · ")}>
              {column.name}
              <em>{fmt(column.non_empty)}</em>
            </span>
          ))}
        </div>
      ) : null}
      {questions.length ? (
        <div className="mon-sm-question-list">
          {questions.map((question) => (
            <div key={`${question.qid}-${question.pos}`}>
              <strong>Q{question.pos}</strong>
              <span>{question.heading || question.family}</span>
              <em>{question.family}{question.n_choices ? ` · ${fmt(question.n_choices)} opciones` : ""}</em>
            </div>
          ))}
        </div>
      ) : null}
      {!data.responses.available && data.responses.error ? <div className="mon-sm-error">{data.responses.error}</div> : null}
    </div>
  );
}

function AcreditacionActorAssignableField({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string;
  options: string[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const currentKey = normalizeSourceMatch(value);
  const visibleOptions = options.slice(0, 8);
  return (
    <div className="mon-acr-actor-field">
      <label>
        <span>Actor</span>
        <input
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder="Escribir actor o elegir sugerencia"
          disabled={disabled}
        />
      </label>
      {visibleOptions.length ? (
        <div className="mon-acr-actor-choice-row" aria-label="Actores sugeridos">
          {visibleOptions.map((actor) => {
            const active = normalizeSourceMatch(actor) === currentKey;
            return (
              <button
                key={actor}
                type="button"
                className={active ? "is-active" : ""}
                onClick={() => onChange(actor)}
                disabled={disabled}
              >
                {active ? <CheckCircle2 size={12} /> : null}
                {actor}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function AcreditacionPlatformSurveySourcesView({
  sources,
  config,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  config?: MonitoreoConfig;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const surveySources = sources.filter(isSurveyMonkeyResponseSource);
  const koboSources = sources.filter(isKoboResponseSource);
  const platformSources = sources.filter(isPlatformResponseSource);
  const linkCollectors = config?.operational_model.link_collectors ?? [];
  const configuredActorOptions = acreditacionActorOptions(platformSources);
  const actorOptions = acreditacionActorOptions(platformSources, ACREDITACION_DEFAULT_ACTORS);
  const [drafts, setDrafts] = useState<Record<string, { actor: string; channel: string }>>({});
  const [savingId, setSavingId] = useState("");
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);

  useEffect(() => {
    setDrafts(Object.fromEntries(platformSources.map((source) => [
      source.id,
      {
        actor: sourceActorLabel(source) === "Sin actor" ? "" : sourceActorLabel(source),
        channel: channelOptionForValue(sourceChannelLabel(source)).value,
      },
    ])));
  }, [platformSources.map((source) => `${source.id}:${sourceActorLabel(source)}:${sourceChannelLabel(source)}`).join("|")]);

  const declarationGroups = useMemo(() => {
    const groups = new Map<string, { actor: string; sources: MonitoreoSource[] }>();
    platformSources.forEach((source) => {
      const actor = drafts[source.id]?.actor || sourceActorLabel(source);
      const key = normalizeSourceMatch(actor) || source.id;
      const group = groups.get(key) ?? { actor, sources: [] };
      group.sources.push(source);
      groups.set(key, group);
    });
    return Array.from(groups.values()).map((group) => {
      const channels = new Map<string, ReturnType<typeof channelVisualForValue> & { count: number }>();
      group.sources.forEach((source) => {
        const channel = channelVisualForValue(drafts[source.id]?.channel || sourceChannelLabel(source), "Canal sin declarar");
        const current = channels.get(channel.key);
        channels.set(channel.key, current ? { ...current, count: current.count + 1 } : { ...channel, count: 1 });
      });
      return { ...group, channels: Array.from(channels.values()) };
    });
  }, [drafts, platformSources]);

  async function saveSurvey(source: MonitoreoSource) {
    const draft = drafts[source.id];
    if (!draft) return;
    setSavingId(source.id);
    setStatus({ tone: "info", message: `Guardando declaracion de ${acreditacionSurveySourceName(source)}...` });
    try {
      const result = await apiMonitoreoSource(sourcePayloadFromExisting(source, {
        label: acreditacionSurveySourceName(source),
        enabled: source.enabled,
        dimensions: cleanSourceDimensions({
          ...source.dimensions,
          actor: draft.actor,
          segmento: draft.actor,
          carrera: draft.actor,
          canal: draft.channel,
          servicio: source.kind === "kobo" ? "Respuestas Kobo" : "Respuestas SurveyMonkey",
          survey_title: source.survey_title || source.label,
        }),
      }));
      onStateChange?.(result.state);
      setStatus({ tone: "success", message: `${result.source.label || source.id} quedo declarada.` });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className="mon-acr-source-view mon-acr-platform-surveys">
      {status ? <div className={status.tone === "error" ? "mon-sm-error" : "mon-sm-meta"}>{status.message}</div> : null}
      <details className="mon-acr-source-disclosure" open={!platformSources.length}>
        <summary>
          <span><Plus size={14} /> Agregar SurveyMonkey</span>
          <em>{surveySources.length ? "Catalogo cerrado por defecto" : "Sin SurveyMonkey configuradas"}</em>
        </summary>
        <AcreditacionSurveySourcePicker
          sources={surveySources}
          onStateChange={onStateChange}
        />
      </details>
      <details className="mon-acr-source-disclosure" open={!platformSources.length && !koboSources.length}>
        <summary>
          <span><QrCode size={14} /> Seleccionar encuesta Kobo</span>
          <em>{koboSources.length ? `${fmt(koboSources.length)} Kobo seleccionada${koboSources.length === 1 ? "" : "s"}` : "Sin Kobo"}</em>
        </summary>
        <AcreditacionKoboSourcePicker
          sources={koboSources}
          onStateChange={onStateChange}
        />
      </details>

      <section className="mon-acr-object-surface" aria-label="Encuestas en plataforma configuradas">
        <div className="mon-acr-object-surface-head">
          <div>
            <span>Encuestas en plataforma</span>
            <strong>{fmt(platformSources.length)} fuente{platformSources.length === 1 ? "" : "s"} SurveyMonkey/Kobo</strong>
          </div>
          <em>{fmt(configuredActorOptions.length)} actores detectados</em>
        </div>
        {declarationGroups.length ? (
          <div className="mon-acr-survey-declaration-map" aria-label="Declarador de encuestas por actor y canal">
            <header>
              <span><Route size={14} /> Declaración actor-canal</span>
              <strong>Qué actor usa qué encuesta y por qué canal</strong>
            </header>
            <div className="mon-acr-survey-declaration-list">
              {declarationGroups.map((group) => (
                <article key={normalizeSourceMatch(group.actor) || group.actor}>
                  <div className="mon-acr-survey-declaration-main">
                    <ContactRound size={14} />
                    <span>
                      <small>Actor</small>
                      <strong>{group.actor}</strong>
                    </span>
                    <em>{fmt(group.sources.length)} encuesta{group.sources.length === 1 ? "" : "s"}</em>
                  </div>
                  <div className="mon-acr-survey-declaration-surveys">
                    {group.sources.slice(0, 3).map((source) => {
                      const channel = channelVisualForValue(drafts[source.id]?.channel || sourceChannelLabel(source), "Canal sin declarar");
                      const Icon = channel.icon;
                      return (
                        <span key={source.id} className={`is-${channel.key}`}>
                          <Icon size={12} />
                          <strong>{acreditacionSurveySourceName(source)}</strong>
                          <small>{channel.label}</small>
                        </span>
                      );
                    })}
                    {group.sources.length > 3 ? <span className="is-more">+{fmt(group.sources.length - 3)} más</span> : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}
        <div className="mon-acr-survey-card-grid">
          {platformSources.map((source) => {
            const draft = drafts[source.id] ?? {
              actor: sourceActorLabel(source) === "Sin actor" ? "" : sourceActorLabel(source),
              channel: channelOptionForValue(sourceChannelLabel(source)).value,
            };
            const collectorCount = acreditacionCollectorCountForSource(source, linkCollectors);
            const collectorRows = acreditacionCollectorsForSource(source, linkCollectors);
            const overrideCount = collectorRows.filter((row) => (
              row.saved?.channel
              && acreditacionChannelKey(row.saved.channel) !== acreditacionChannelKey(draft.channel)
            )).length;
            const inheritedCount = Math.max(0, collectorRows.length - overrideCount);
            const sourceActor = draft.actor || sourceActorLabel(source);
            const actorInitial = actorInitialLabel(sourceActor);
            const responseCount = acreditacionSourceResponseCount(source, linkCollectors);
            const channel = channelVisualForValue(draft.channel, "Canal sin declarar");
            const ChannelIcon = channel.icon;
            const dirty = draft.actor !== (sourceActorLabel(source) === "Sin actor" ? "" : sourceActorLabel(source))
              || draft.channel !== channelOptionForValue(sourceChannelLabel(source)).value;
            return (
              <article key={source.id} className={`mon-acr-source-object-card${source.enabled ? "" : " is-disabled"}`}>
                <div className="mon-acr-source-object-main">
                  <span className="mon-acr-source-object-icon" role="img" aria-label={`Actor ${sourceActor}`}>
                    {actorInitial}
                  </span>
                  <div>
                    <strong>{acreditacionSurveySourceName(source)}</strong>
                    <em>{source.survey_id || source.asset_uid || source.id}</em>
                  </div>
                  <span className={source.enabled ? "is-ready" : "is-muted"}>{source.enabled ? "Activa" : "Inactiva"}</span>
                </div>
                <div className="mon-acr-source-object-metrics">
                  <span><small>Recopiladores</small><strong>{fmt(collectorCount)}</strong></span>
                  <span><small>Ultimo sync</small><strong>{sourceSyncLabel(source)}</strong></span>
                  <span><small>Respuestas</small><strong>{fmt(responseCount)}</strong></span>
                </div>
                <div className="mon-acr-source-object-routing" aria-label="Declaración operativa de la encuesta">
                  <AcreditacionActorAssignableField
                    value={draft.actor}
                    options={actorOptions}
                    disabled={Boolean(savingId)}
                    onChange={(actor) => setDrafts((current) => ({ ...current, [source.id]: { ...draft, actor } }))}
                  />
                  <AcreditacionChannelDeclarationPicker
                    value={draft.channel}
                    disabled={Boolean(savingId)}
                    onChange={(nextChannel) => setDrafts((current) => ({ ...current, [source.id]: { ...draft, channel: nextChannel } }))}
                  />
                  <div className="mon-acr-source-inheritance">
                    <span className={`is-${channel.key}`}><ChannelIcon size={13} /> Base {channel.label}</span>
                    <span><CheckCircle2 size={13} /> {fmt(inheritedCount)} heredan</span>
                    <span><ShieldAlert size={13} /> {fmt(overrideCount)} excepciones</span>
                  </div>
                  <button type="button" onClick={() => { void saveSurvey(source); }} disabled={Boolean(savingId) || !dirty}>
                    {savingId === source.id ? <Loader2 size={14} className="pulso-spin" /> : <Save size={14} />}
                    Guardar declaración
                  </button>
                </div>
              </article>
            );
          })}
          {!platformSources.length ? (
            <div className="mon-acr-empty-state">
              <QrCode size={18} />
              <strong>Sin encuestas conectadas</strong>
              <span>Agrega SurveyMonkey o selecciona una encuesta Kobo de plataforma y después asigna cada una al actor correcto.</span>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function AcreditacionSheetsByActorView({
  sources,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const surveySources = sources.filter(isPlatformResponseSource);
  const baseSources = sources.filter((source) => source.kind === "google_sheets" && source.role === "universo");
  const sweepSources = sources.filter((source) => source.kind === "google_sheets" && source.role === "barrido");
  const [manualActor, setManualActor] = useState("");
  const [manualActors, setManualActors] = useState<string[]>([]);
  const actorOptions = acreditacionActorOptions([...surveySources, ...baseSources], manualActors);
  const [selectedActor, setSelectedActor] = useState(actorOptions[0] ?? "");
  const selectedSource = baseSources.find((source) => normalizeSourceMatch(sourceActorLabel(source)) === normalizeSourceMatch(selectedActor)) ?? null;
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [range, setRange] = useState("");
  const [inspection, setInspection] = useState<MonitoreoSheetsInspectResult | null>(null);
  const [busy, setBusy] = useState<"inspect" | "save" | null>(null);
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);

  useEffect(() => {
    if (!selectedActor && actorOptions.length) setSelectedActor(actorOptions[0]);
  }, [actorOptions, selectedActor]);

  useEffect(() => {
    setSpreadsheetId(selectedSource?.sheet_binding?.spreadsheet_id ?? "");
    setSheetName(selectedSource?.sheet_binding?.sheet_name ?? "");
    setRange(selectedSource?.sheet_binding?.range ?? "");
    setInspection(null);
    setStatus(null);
  }, [selectedSource?.id, selectedActor]);

  async function inspectSheets() {
    if (!spreadsheetId.trim()) {
      setStatus({ tone: "error", message: "Pega el Spreadsheet ID o URL antes de leer pestañas." });
      return;
    }
    setBusy("inspect");
    setStatus({ tone: "info", message: "Leyendo pestañas desde Google Sheets..." });
    try {
      const result = await apiMonitoreoSheetsInspect({
        spreadsheet_id: spreadsheetId.trim(),
        sheet_name: sheetName.trim(),
        header_row: 1,
        range: range.trim(),
      });
      setInspection(result);
      setStatus({ tone: "success", message: `${fmt(result.sheets.length)} pestañas detectadas en ${result.title || "Spreadsheet"}.` });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function saveActorSheet() {
    if (!selectedActor.trim() || !spreadsheetId.trim() || !sheetName.trim()) {
      setStatus({ tone: "error", message: "Actor, Spreadsheet y pestaña son obligatorios." });
      return;
    }
    setBusy("save");
    setStatus({ tone: "info", message: selectedSource ? "Guardando base por actor..." : "Registrando base por actor..." });
    try {
      const result = await apiMonitoreoSheetsSource({
        id: selectedSource?.id,
        kind: "google_sheets",
        label: `Base ${selectedActor.trim()}`,
        enabled: true,
        role: "universo",
        integration_mode: "connected_read",
        sheet_binding: {
          spreadsheet_id: spreadsheetId.trim(),
          sheet_name: sheetName.trim(),
          header_row: 1,
          range: range.trim(),
        },
        dimensions: cleanSourceDimensions({
          actor: selectedActor.trim(),
          carrera: selectedActor.trim(),
          segmento: selectedActor.trim(),
          canal: "Base",
          servicio: "Base en Sheets",
          sheet_name: sheetName.trim(),
        }),
      });
      onStateChange?.(result.state);
      setStatus({ tone: "success", message: `Base ${selectedActor.trim()} quedo vinculada.` });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setBusy(null);
    }
  }

  function addManualActor() {
    const label = manualActor.trim();
    if (!label) return;
    setManualActors((current) => acreditacionActorOptions([], [...current, label]));
    setSelectedActor(label);
    setManualActor("");
  }

  return (
    <div className="mon-acr-source-view mon-acr-sheets-by-actor">
      {status ? <div className={status.tone === "error" ? "mon-sm-error" : "mon-sm-meta"}>{status.message}</div> : null}
      <section className="mon-acr-object-surface">
        <div className="mon-acr-object-surface-head">
          <div>
            <span>Bases en Sheets</span>
            <strong>Una base por actor requerido</strong>
          </div>
          <em>{fmt(baseSources.length)}/{fmt(actorOptions.length)} actores vinculados</em>
        </div>
        <div className="mon-acr-actor-source-layout">
          <div className="mon-acr-actor-rail" aria-label="Actores para bases Sheets">
            <div className="mon-acr-manual-actor">
              <input
                value={manualActor}
                onChange={(event) => setManualActor(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addManualActor();
                }}
                placeholder="Agregar actor manual"
              />
              <button type="button" onClick={addManualActor} disabled={!manualActor.trim()}>
                <Plus size={14} />
              </button>
            </div>
            {actorOptions.map((actor) => {
              const actorSource = baseSources.find((source) => normalizeSourceMatch(sourceActorLabel(source)) === normalizeSourceMatch(actor));
              return (
                <button
                  key={actor}
                  type="button"
                  className={`mon-acr-actor-sheet-card${actor === selectedActor ? " is-active" : ""}${actorSource ? " is-ready" : ""}`}
                  onClick={() => setSelectedActor(actor)}
                >
                  <span>{actorSource ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}</span>
                  <strong>{actor}</strong>
                  <em>{actorSource?.sheet_binding?.sheet_name || "Base pendiente"}</em>
                </button>
              );
            })}
            {!actorOptions.length ? (
              <div className="mon-sm-empty">Configura actores en Encuestas en plataforma o agrega uno manualmente.</div>
            ) : null}
          </div>
          <div className="mon-acr-actor-sheet-editor">
            <div className="mon-acr-sheet-adjustment-head">
              <div>
                <span>{selectedSource ? "Base vinculada" : "Base pendiente"}</span>
                <strong>{selectedActor || "Selecciona un actor"}</strong>
              </div>
            </div>
            <div className="mon-acr-sheet-form">
              <label>
                <span>Spreadsheet</span>
                <input value={spreadsheetId} onChange={(event) => setSpreadsheetId(event.currentTarget.value)} placeholder="https://docs.google.com/spreadsheets/d/..." disabled={Boolean(busy) || !selectedActor} />
              </label>
              <label>
                <span>Pestaña del actor</span>
                <input value={sheetName} onChange={(event) => setSheetName(event.currentTarget.value)} placeholder={selectedActor || "Actor"} disabled={Boolean(busy) || !selectedActor} />
              </label>
              <label>
                <span>Rango</span>
                <input value={range} onChange={(event) => setRange(event.currentTarget.value)} placeholder="Opcional" disabled={Boolean(busy) || !selectedActor} />
              </label>
              <div className="mon-acr-sheet-actions">
                <button type="button" onClick={() => { void inspectSheets(); }} disabled={Boolean(busy) || !spreadsheetId.trim() || !selectedActor}>
                  {busy === "inspect" ? <Loader2 size={14} className="pulso-spin" /> : <Search size={14} />}
                  Leer pestañas
                </button>
                <button type="button" onClick={() => { void saveActorSheet(); }} disabled={Boolean(busy) || !selectedActor || !spreadsheetId.trim() || !sheetName.trim()}>
                  {busy === "save" ? <Loader2 size={14} className="pulso-spin" /> : <Save size={14} />}
                  Confirmar base
                </button>
              </div>
            </div>
            {inspection ? (
              <div className="mon-acr-sheet-inspection">
                <div className="mon-acr-sheet-inspection-head">
                  <strong>{inspection.title || inspection.spreadsheet_id}</strong>
                  <span>{fmt(inspection.sheets.length)} pestañas · {fmt(inspection.headers.length)} encabezados</span>
                </div>
                <div className="mon-acr-sheet-tabs">
                  {inspection.sheets.slice(0, 14).map((sheet) => (
                    <button key={sheet.title} type="button" onClick={() => setSheetName(sheet.title)}>
                      {sheet.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <details className="mon-acr-source-disclosure">
        <summary>
          <span><PhoneCall size={14} /> Barrido telefónico</span>
          <em>{sweepSources.length ? `${fmt(sweepSources.length)} fuente${sweepSources.length === 1 ? "" : "s"}` : "Opcional si existe"}</em>
        </summary>
        <AcreditacionSheetSourceEditor
          preset={ACREDITACION_SOURCE_PRESETS[1]}
          sources={sweepSources}
          onStateChange={onStateChange}
        />
      </details>
    </div>
  );
}

function collectorConfigFromRow(row: AcreditacionCollectorRow, patch: Partial<MonitoreoLinkCollector> = {}): MonitoreoLinkCollector {
  const operationalUse = normalizeCollectorUse(patch.operational_use ?? row.saved?.operational_use ?? row.operationalUse);
  const channel = String(patch.channel ?? row.saved?.channel ?? row.channel ?? collectorChannelForUse(operationalUse)).trim() || "Sin clasificar";
  const collectorName = String(patch.collector_name ?? (row.alias || row.saved?.collector_name || row.platformName || row.collectorId)).trim();
  return {
    id: row.saved?.id || row.key,
    source_id: row.sourceId,
    source_label: row.sourceName,
    survey_id: row.surveyId,
    collector_id: row.collectorId,
    collector_name: collectorName,
    collector_type: row.collectorType,
    enabled: patch.enabled ?? row.enabled,
    channel,
    operational_use: operationalUse,
    modality: normalizeModelModality(patch.modality ?? row.saved?.modality ?? row.modality ?? acreditacionChannelModality(channel)),
    roster_required: patch.roster_required ?? row.saved?.roster_required ?? row.rosterRequired,
  };
}

function AcreditacionCollectorsSourceView({
  sources,
  config,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  config?: MonitoreoConfig;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const surveySources = sources.filter((source) => source.kind === "surveymonkey" && source.enabled);
  const configuredCollectors = config?.operational_model.link_collectors ?? [];
  const [selectedSourceId, setSelectedSourceId] = useState(surveySources[0]?.id ?? "");
  const [draftCollectors, setDraftCollectors] = useState<MonitoreoLinkCollector[]>(configuredCollectors);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);

  useEffect(() => {
    setDraftCollectors(configuredCollectors);
  }, [configuredCollectors.map((collector) => `${collector.source_id}:${collector.collector_id}:${collector.enabled}:${collector.collector_name}:${collector.channel}:${collector.operational_use}`).join("|")]);

  useEffect(() => {
    if (!selectedSourceId && surveySources.length) setSelectedSourceId(surveySources[0].id);
    if (selectedSourceId && surveySources.length && !surveySources.some((source) => source.id === selectedSourceId)) setSelectedSourceId(surveySources[0].id);
  }, [selectedSourceId, surveySources]);

  const selectedSource = surveySources.find((source) => source.id === selectedSourceId) ?? surveySources[0] ?? null;
  const selectedHasMetadata = Boolean(selectedSource?.collectors?.length);
  const collectorRows = selectedSource && selectedHasMetadata
    ? acreditacionCollectorsForSource(selectedSource, draftCollectors).filter((row) => row.hasPlatformMetadata)
    : [];
  const selectedSavedCount = selectedSource
    ? draftCollectors.filter((collector) => collector.source_id === selectedSource.id || collector.survey_id === selectedSource.survey_id).length
    : 0;

  function updateCollector(row: AcreditacionCollectorRow, patch: Partial<MonitoreoLinkCollector>) {
    const next = collectorConfigFromRow(row, patch);
    setDraftCollectors((current) => [
      ...current.filter((collector) => `${collector.source_id}::${collector.collector_id}` !== `${next.source_id}::${next.collector_id}`),
      next,
    ]);
  }

  async function saveCollectors() {
    setSaving(true);
    setStatus({ tone: "info", message: "Guardando recopiladores incluidos, alias y uso operativo..." });
    try {
      const result = await apiMonitoreoCollectorsConfig(draftCollectors);
      onStateChange?.(result.state);
      setStatus({ tone: "success", message: "Cambios de recopiladores confirmados." });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mon-acr-source-view mon-acr-collectors-view">
      {status ? <div className={status.tone === "error" ? "mon-sm-error" : "mon-sm-meta"}>{status.message}</div> : null}
      <section className="mon-acr-object-surface">
        <div className="mon-acr-object-surface-head">
          <div>
            <span>Recopiladores</span>
            <strong>{selectedSource ? acreditacionSurveySourceName(selectedSource) : "Sin encuesta activa"}</strong>
          </div>
          <button type="button" className="pulso-primary" onClick={() => { void saveCollectors(); }} disabled={saving || !surveySources.length}>
            {saving ? <Loader2 size={14} className="pulso-spin" /> : <Save size={14} />}
            Confirmar cambios
          </button>
        </div>
        <div className="mon-acr-collector-picker">
          {surveySources.map((source) => {
            const count = acreditacionCollectorCountForSource(source, draftCollectors);
            const hasMetadata = Boolean(source.collectors?.length);
            const channel = sourceChannelLabel(source);
            return (
              <button
                key={source.id}
                type="button"
                className={`${source.id === selectedSource?.id ? "is-active" : ""}${hasMetadata ? "" : " is-missing"}`}
                onClick={() => setSelectedSourceId(source.id)}
              >
                <AcreditacionChannelBadge channel={channel} />
                <span>
                  <strong>{acreditacionSurveySourceName(source)}</strong>
                  <em>{sourceActorLabel(source)} · {sourceExternalId(source)}</em>
                </span>
                <b>{hasMetadata ? `${fmt(count)} recopiladores` : "Sin metadata"}</b>
              </button>
            );
          })}
          {!surveySources.length ? <div className="mon-sm-empty">No hay encuestas SurveyMonkey activas.</div> : null}
        </div>
        {selectedSource && !selectedHasMetadata ? (
          <div className="mon-acr-metadata-missing">
            <AlertCircle size={16} />
            <div>
              <strong>Falta metadata real de recopiladores</strong>
              <span>Ejecuta Actualizar todo para guardar los nombres reales de plataforma. No se muestran nombres inventados desde IDs o alias antiguos.</span>
              {selectedSavedCount ? <em>{fmt(selectedSavedCount)} relaciones guardadas se usaran en Avance.</em> : null}
            </div>
          </div>
        ) : null}
        <div className="mon-acr-collector-list">
          {collectorRows.map((row) => {
            const operationalUse = normalizeCollectorUse(row.saved?.operational_use ?? row.operationalUse);
            const useOption = collectorUseOption(operationalUse);
            const UseIcon = useOption.icon;
            return (
              <article key={row.key} className={`mon-collector-card mon-acr-collector-row is-${row.modality}${row.enabled ? "" : " is-disabled"}`}>
                <div className="mon-collector-title">
                  <span className="mon-collector-use-icon"><UseIcon size={14} /></span>
                  <div>
                    <strong>{row.platformName}</strong>
                    <em>{row.alias ? `Alias: ${row.alias}` : "Sin alias operativo"}</em>
                  </div>
                  <span className="mon-collector-chip">{collectorTypeLabel(row.collectorType)}</span>
                </div>
                <div className="mon-collector-metrics">
                  <AcreditacionCollectorMetric label="Respuestas" value={row.responseCount} tone={row.responseCount ? "ready" : "neutral"} />
                  <AcreditacionCollectorMetric label="Uso" value={row.enabled ? 1 : 0} tone={row.enabled ? "ready" : "warning"} />
                  <AcreditacionCollectorMetric label="Alias" value={row.alias ? 1 : 0} />
                  <AcreditacionCollectorMetric label="Barrido" value={row.rosterRequired ? 1 : 0} />
                </div>
                <div className="mon-collector-controls mon-acr-collector-controls">
                  <label className="mon-switch-line">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(event) => updateCollector(row, { enabled: event.currentTarget.checked })}
                    />
                    <span>
                      <strong>{row.enabled ? "Incluido" : "Excluido"}</strong>
                      <em>{row.enabled ? "Cuenta en este canal" : "No participa"}</em>
                    </span>
                  </label>
                  <label>
                    <span>Alias</span>
                    <input
                      value={row.alias}
                      onChange={(event) => updateCollector(row, { collector_name: event.currentTarget.value })}
                      placeholder="Alias opcional"
                    />
                  </label>
                  <label>
                    <span>Uso</span>
                    <select
                      value={operationalUse}
                      onChange={(event) => updateCollector(row, { operational_use: event.currentTarget.value as MonitoreoCollectorUse })}
                    >
                      {MODEL_COLLECTOR_USE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <AcreditacionChannelSelect
                    value={channelOptionForValue(row.saved?.channel ?? row.channel).value}
                    onChange={(channel) => updateCollector(row, { channel })}
                  />
                </div>
              </article>
            );
          })}
          {selectedHasMetadata && !collectorRows.length ? (
            <div className="mon-sm-empty">Esta encuesta no tiene recopiladores persistidos.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function AcreditacionActiveSourcesView({
  sources,
  config,
  reportSources,
  state,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  config?: MonitoreoConfig;
  reportSources: Array<Record<string, unknown>>;
  state?: MonitoreoState | null;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const linkCollectors = config?.operational_model.link_collectors ?? [];
  const summary = buildAcreditacionActiveSourcesSummary(sources, linkCollectors);
  const surveySources = sources.filter((source) => isPlatformResponseSource(source) && source.enabled);
  const sheetSources = sources.filter((source) => source.kind === "google_sheets" && source.enabled);
  const packageRows = sourcePackageRows(sources);
  const isPhoneView = isTelefonicoMonitoreoState(state);
  const activeRows = sourceRowsForTable(sources.filter((source) => source.enabled), { phoneMode: isPhoneView });

  if (isPhoneView) {
    const contract = buildAcreditacionPhoneSourceContract(sources);
    const slots = [contract.universe, contract.sweep, contract.platform];
    const readySlots = slots.filter((slot) => slot.ready).length;
    const phoneSheetSources = Array.from(new Map(
      [...contract.universe.sources, ...contract.sweep.sources]
        .filter((source) => source.enabled)
        .map((source) => [source.id, source] as const),
    ).values());
    const koboSources = contract.platform.sources.filter((source) => source.enabled);
    return (
      <div className="mon-acr-source-view mon-acr-active-sources">
        <section className="mon-acr-active-hero">
          <div>
            <span>Paquete telefónico</span>
            <strong>{fmt(readySlots)}/3 fuentes listas para monitoreo</strong>
            <p>Base telefónica, barrido y Kobo se mantienen separados: Kobo manda efectivas y el barrido aporta estados telefónicos.</p>
          </div>
          <div className="mon-acr-active-kpis">
            <StatTile label="Fuentes" value={`${fmt(readySlots)}/3`} tone={readySlots === 3 ? "good" : "warn"} />
            <StatTile label="Sheets" value={fmt(phoneSheetSources.length)} tone={phoneSheetSources.length >= 2 ? "good" : "warn"} />
            <StatTile label="Kobo" value={fmt(koboSources.length)} tone={koboSources.length ? "good" : "warn"} />
            <StatTile label="Ultimo sync" value={summary.lastSync ? formatDate(summary.lastSync) : "Sin sync"} tone={summary.lastSync ? "good" : "warn"} />
          </div>
        </section>
        <div className="mon-acr-active-grid">
          <section className="mon-acr-object-surface">
            <div className="mon-acr-object-surface-head">
              <div>
                <span>Contrato telefónico</span>
                <strong>{fmt(readySlots)} de 3 piezas listas</strong>
              </div>
              <em>{contract.ready ? "Paquete completo" : "Faltan piezas"}</em>
            </div>
            <div className="mon-acr-active-source-list">
              {slots.map((slot) => (
                <article key={slot.key} className={slot.ready ? "is-ready" : "is-warning"}>
                  <strong>{slot.label}</strong>
                  <span>{slot.purpose}</span>
                  <em>{slot.ready ? `${fmt(slot.sources.filter((source) => source.enabled).length)} activa` : "Pendiente"}</em>
                </article>
              ))}
            </div>
          </section>
          <section className="mon-acr-object-surface">
            <div className="mon-acr-object-surface-head">
              <div>
                <span>Base y barrido</span>
                <strong>{fmt(phoneSheetSources.length)} fuente{phoneSheetSources.length === 1 ? "" : "s"} Sheets</strong>
              </div>
              <em>estados en paralelo</em>
            </div>
            <div className="mon-acr-active-source-list">
              {phoneSheetSources.map((source) => (
                <article key={source.id}>
                  <strong>{source.label || source.sheet_binding?.sheet_name || source.id}</strong>
                  <span>{source.role === "barrido" ? "Barrido telefónico" : "Base telefónica"} · {source.sheet_binding?.sheet_name || "Sin pestaña"}</span>
                  <em>{sourceSyncLabel(source)}</em>
                </article>
              ))}
              {!phoneSheetSources.length ? <div className="mon-sm-empty">Sin Sheets telefónicas activas.</div> : null}
            </div>
          </section>
          <section className="mon-acr-object-surface">
            <div className="mon-acr-object-surface-head">
              <div>
                <span>Kobo efectivo</span>
                <strong>{fmt(koboSources.length)} encuesta{ koboSources.length === 1 ? "" : "s"} activa{ koboSources.length === 1 ? "" : "s"}</strong>
              </div>
              <em>avance por CodPulso</em>
            </div>
            <div className="mon-acr-active-source-list">
              {koboSources.map((source) => (
                <article key={source.id}>
                  <strong>{acreditacionSurveySourceName(source)}</strong>
                  <span>{sourceProviderLabel(source.kind)} · {shortenMiddle(sourceExternalId(source), 34)}</span>
                  <em>{fmt(acreditacionSourceResponseCount(source))} respuestas</em>
                </article>
              ))}
              {!koboSources.length ? <div className="mon-sm-empty">Sin Kobo activo.</div> : null}
            </div>
          </section>
        </div>
        <details className="mon-acr-source-disclosure">
          <summary>
            <span><Table2 size={14} /> Detalle de fuentes</span>
            <em>{fmt(activeRows.length)} activas</em>
          </summary>
          <div className="mon-profile-grid">
            <section className="mon-profile-panel">
              <div className="mon-profile-panel-head">
                <h3>Fuentes activas</h3>
                <span>{fmt(activeRows.length)} filas</span>
              </div>
              <DataTable rows={activeRows} empty="No hay fuentes activas." preferredColumns={["Fuente", "Servicio", "Rol", "Estado", "Ultimo sync", "ID"]} />
            </section>
            <section className="mon-profile-panel">
              <div className="mon-profile-panel-head">
                <h3>Fuentes del corte</h3>
                <span>{fmt(reportSources.length)} filas</span>
              </div>
              <DataTable rows={reportSources} empty="El corte no declaró fuentes." />
            </section>
          </div>
          <AcreditacionConfiguredSourcesList
            sources={sources}
            syncFallback={state?.synced_at ?? state?.generated_at}
            phoneMode
            onStateChange={onStateChange}
          />
        </details>
      </div>
    );
  }

  return (
    <div className="mon-acr-source-view mon-acr-active-sources">
      <section className="mon-acr-active-hero">
        <div>
          <span>Fuentes activas</span>
          <strong>{fmt(summary.activeSurveys + summary.activeSheetBases)} piezas alimentando monitoreo</strong>
          <p>Resumen operativo de lo que se usara para nutrir avance, actores, bases y recopiladores.</p>
        </div>
        <div className="mon-acr-active-kpis">
          <StatTile label="Encuestas" value={fmt(summary.activeSurveys)} tone={summary.activeSurveys ? "good" : "warn"} />
          <StatTile label="Bases actor" value={fmt(summary.activeSheetBases)} tone={summary.missingSheetActors.length ? "warn" : "good"} />
          <StatTile label="Recop. incluidos" value={fmt(summary.includedCollectors)} tone={summary.includedCollectors ? "good" : "neutral"} />
          <StatTile label="Ultimo sync" value={summary.lastSync ? formatDate(summary.lastSync) : "Sin sync"} tone={summary.lastSync ? "good" : "warn"} />
        </div>
      </section>
      <div className="mon-acr-active-grid">
        <section className="mon-acr-object-surface">
          <div className="mon-acr-object-surface-head">
            <div>
              <span>Actores y cobertura</span>
              <strong>{fmt(summary.actorsWithSurvey.length)} actores con encuesta</strong>
            </div>
            <em>{summary.missingSheetActors.length ? `${fmt(summary.missingSheetActors.length)} bases faltantes` : "Bases alineadas"}</em>
          </div>
          <div className="mon-acr-active-actor-list">
            {summary.actorsWithSurvey.map((actor) => {
              const hasSheet = summary.actorsWithSheet.some((sheetActor) => normalizeSourceMatch(sheetActor) === normalizeSourceMatch(actor));
              const actorSurveys = surveySources.filter((source) => normalizeSourceMatch(sourceActorLabel(source)) === normalizeSourceMatch(actor));
              return (
                <article key={actor} className={hasSheet ? "is-ready" : "is-warning"}>
                  <strong>{actor}</strong>
                  <span>{fmt(actorSurveys.length)} encuesta{actorSurveys.length === 1 ? "" : "s"}</span>
                  <em>{hasSheet ? "Base Sheets vinculada" : "Falta base Sheets"}</em>
                </article>
              );
            })}
            {!summary.actorsWithSurvey.length ? <div className="mon-sm-empty">Sin actores activos desde encuestas.</div> : null}
          </div>
        </section>
        <section className="mon-acr-object-surface">
          <div className="mon-acr-object-surface-head">
            <div>
              <span>Recopiladores</span>
              <strong>{fmt(summary.includedCollectors)} incluidos · {fmt(summary.excludedCollectors)} excluidos</strong>
            </div>
            <em>{summary.missingCollectorMetadata ? `${fmt(summary.missingCollectorMetadata)} sin metadata` : "Metadata real lista"}</em>
          </div>
          <div className="mon-acr-active-source-list">
            {surveySources.map((source) => {
              const rows = acreditacionCollectorsForSource(source, linkCollectors);
              return (
                <article key={source.id}>
                  <strong>{acreditacionSurveySourceName(source)}</strong>
                  <span>{sourceActorLabel(source)} · {fmt(rows.filter((row) => row.enabled).length)} incluidos</span>
                  <em>{source.collectors?.length ? `${fmt(source.collectors.length)} nombres reales` : "Falta Actualizar todo"}</em>
                </article>
              );
            })}
            {!surveySources.length ? <div className="mon-sm-empty">Sin encuestas activas.</div> : null}
          </div>
        </section>
        <section className="mon-acr-object-surface">
          <div className="mon-acr-object-surface-head">
            <div>
              <span>Bases Sheets vinculadas</span>
              <strong>{fmt(sheetSources.length)} fuente{sheetSources.length === 1 ? "" : "s"}</strong>
            </div>
            <em>{state?.has_snapshot ? "Snapshot local listo" : "Sin snapshot"}</em>
          </div>
          <div className="mon-acr-active-source-list">
            {sheetSources.map((source) => (
              <article key={source.id}>
                <strong>{source.label || sourceActorLabel(source)}</strong>
                <span>{source.sheet_binding?.sheet_name || "Sin pestaña"} · {sourceActorLabel(source)}</span>
                <em>{sourceSyncLabel(source)}</em>
              </article>
            ))}
            {!sheetSources.length ? <div className="mon-sm-empty">Sin bases Sheets activas.</div> : null}
          </div>
        </section>
      </div>
      <details className="mon-acr-source-disclosure">
        <summary>
          <span><Table2 size={14} /> Detalle tecnico</span>
          <em>{fmt(activeRows.length)} fuentes activas</em>
        </summary>
        <div className="mon-profile-grid">
          <section className="mon-profile-panel">
            <div className="mon-profile-panel-head">
              <h3>Cobertura fija</h3>
              <span>{fmt(packageRows.length)} piezas</span>
            </div>
            <DataTable rows={packageRows} empty="No hay cobertura de fuentes para acreditacion." preferredColumns={["Pieza", "Servicio", "Configuradas", "Activas", "Estado", "Ultimo sync"]} />
          </section>
          <section className="mon-profile-panel">
            <div className="mon-profile-panel-head">
              <h3>Fuentes configuradas</h3>
              <span>{fmt(activeRows.length)} activas</span>
            </div>
            <DataTable rows={activeRows} empty="No hay fuentes activas." preferredColumns={["Fuente", "Servicio", "Actor", "Canal", "Estado", "Ultimo sync", "ID"]} />
          </section>
          <section className="mon-profile-panel">
            <div className="mon-profile-panel-head">
              <h3>Fuentes del reporte</h3>
              <span>{fmt(reportSources.length)} filas</span>
            </div>
            <DataTable rows={reportSources} empty="El reporte no declaro fuentes para este corte." />
          </section>
        </div>
        <AcreditacionConfiguredSourcesList
          sources={sources}
          syncFallback={state?.synced_at ?? state?.generated_at}
          onStateChange={onStateChange}
        />
      </details>
    </div>
  );
}

function AcreditacionConfiguredSourcesList({
  sources,
  syncFallback,
  phoneMode = false,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  syncFallback?: string;
  phoneMode?: boolean;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const [savingId, setSavingId] = useState("");
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);
  const phoneContract = phoneMode ? buildAcreditacionPhoneSourceContract(sources) : null;
  const activeCount = phoneContract ? phoneContractReadyCount(phoneContract) : sources.filter((source) => source.enabled).length;
  const totalCount = phoneContract ? 3 : sources.length;

  const updateSource = async (source: MonitoreoSource, patch: Partial<MonitoreoSourcePayload>) => {
    setSavingId(source.id);
    setStatus({ tone: "info", message: `Guardando ${source.label || source.id}...` });
    try {
      const result = await apiMonitoreoSource(sourcePayloadFromExisting(source, patch));
      onStateChange?.(result.state);
      setStatus({ tone: "success", message: `${result.source.label || source.id} actualizado.` });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
      throw error;
    } finally {
      setSavingId("");
    }
  };

  return (
    <aside className="mon-source-configured-panel mon-acr-configured-sources-panel" aria-label="Fuentes configuradas">
      <div className="mon-source-configured-head">
        <div>
          <span className="mon-source-list-head">Fuentes configuradas</span>
          <strong>{sources.length ? `${fmt(sources.length)} seleccionadas` : "Sin fuentes"}</strong>
        </div>
        <em>{fmt(activeCount)}/{fmt(totalCount || 0)} {phoneContract ? "operativas" : "activas"}</em>
      </div>
      {status ? <div className={status.tone === "error" ? "mon-sm-error" : "mon-sm-meta"}>{status.message}</div> : null}
      <div className="mon-source-list">
        {sources.map((source) => {
          const dims = sourceDimensionEntries(source.dimensions);
          const saving = savingId === source.id;
          const syncLabel = sourceSyncLabel(source);
          const displayedSync = syncLabel === "Sin sync" && source.enabled && syncFallback ? formatDate(syncFallback) : syncLabel;
          return (
            <div key={source.id} className={`mon-source-item${source.enabled ? "" : " is-disabled"}`}>
              <div className="mon-source-main">
                <label className="mon-source-alias">
                  <span>Nombre de base</span>
                  <input
                    defaultValue={source.label}
                    disabled={Boolean(savingId)}
                    onBlur={(event) => {
                      const label = event.currentTarget.value.trim();
                      if (label && label !== source.label) {
                        void updateSource(source, { label }).catch(() => {
                          event.currentTarget.value = source.label;
                        });
                      } else {
                        event.currentTarget.value = source.label;
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      if (event.key === "Escape") {
                        event.currentTarget.value = source.label;
                        event.currentTarget.blur();
                      }
                    }}
                  />
                </label>
                {dims.length ? (
                  <div className="mon-source-dim-badges">
                    {dims.map(([key, value]) => <span key={key}>{dimensionLabel(key)}: {value}</span>)}
                  </div>
                ) : null}
              </div>
              <span>{saving ? "Guardando..." : sourceExternalId(source)}</span>
              <em>{displayedSync}</em>
            </div>
          );
        })}
        {!sources.length ? <div className="mon-sm-empty">Aún no hay fuentes configuradas</div> : null}
      </div>
    </aside>
  );
}

function normalizeSourceSyncProgress(progress: JobProgressData | Record<string, never> | null | undefined) {
  if (!progress || typeof progress !== "object") return null;
  if (!("phase" in progress) && !("percent" in progress) && !("message" in progress)) return null;
  const raw = progress as JobProgressData;
  const percent = Number(raw.percent);
  return {
    percent: Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : null,
    phase: typeof raw.phase === "string" ? raw.phase : "",
    message: typeof raw.message === "string" ? raw.message : "",
  };
}

async function waitForSourceSyncJob(
  jobId: string,
  onProgress?: (progress: Omit<AcreditacionSourceSyncProgress, "mode">) => void,
) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 350 : 1000));
    const snapshot = await apiJobStatus<MonitoreoSyncResult>(jobId);
    const progress = normalizeSourceSyncProgress(snapshot.progress);
    if (progress) onProgress?.(progress);
    if (snapshot.status === "done") return snapshot;
    if (snapshot.status === "cancelled") throw new Error("La sincronización fue cancelada.");
    if (snapshot.status === "error") {
      throw new Error(jobErrorMessage(snapshot.error) || "La sincronización terminó con error.");
    }
  }
  throw new Error("La sincronización sigue en ejecución. Vuelve a actualizar la vista en unos segundos.");
}

// Adaptador local sobre la tira canónica compartida (components/SourceSyncActions):
// conserva la firma histórica de este profile y aplica el vocabulario uniforme
// (fuentes por nombre + "Todo" para el sync completo).
function AcreditacionSourceSyncActions({
  sheetCount,
  surveyCount,
  totalCount,
  busy,
  progress = null,
  surveyLabel = "encuestas",
  surveyTitle = "encuestas de plataforma activas",
  onSyncSheets,
  onSyncSurvey,
  onSyncAll,
}: {
  sheetCount: number;
  surveyCount: number;
  totalCount: number;
  busy: boolean;
  progress?: SourceSyncActionsProgress | null;
  surveyLabel?: string;
  surveyTitle?: string;
  onSyncSheets: () => Promise<void>;
  onSyncSurvey: () => Promise<void>;
  onSyncAll: () => Promise<void>;
}) {
  return (
    <SourceSyncActions
      className="mon-acr-source-sync-actions"
      ariaLabel="Actualizar fuentes de acreditación"
      busy={busy}
      progress={progress}
      actions={[
        { key: "sheets", label: "Sheets", title: sheetCount ? `${sheetCount} fuentes Sheets activas` : "Sin fuentes Sheets activas", icon: Layers3, disabled: !sheetCount, onRun: onSyncSheets },
        { key: "survey", label: surveyLabel, title: surveyCount ? `${surveyCount} ${surveyTitle}` : `Sin ${surveyTitle}`, icon: QrCode, disabled: !surveyCount, onRun: onSyncSurvey },
        { key: "all", label: "Todo", title: totalCount ? `${totalCount} fuentes activas` : "Sin fuentes activas", icon: RefreshCw, disabled: !totalCount, primary: true, onRun: onSyncAll },
      ]}
    />
  );
}

function AcreditacionSourcePackageConsole({
  sources,
  activePresetKey,
  status,
  busy,
  onSelectPreset,
  onSyncSheets,
  onSyncSurvey,
  onSyncAll,
}: {
  sources: MonitoreoSource[];
  activePresetKey: AcreditacionSourcePresetKey;
  status: AcreditacionActionStatus;
  busy: boolean;
  onSelectPreset: (key: AcreditacionSourcePresetKey) => void;
  onSyncSheets: () => Promise<void>;
  onSyncSurvey: () => Promise<void>;
  onSyncAll: () => Promise<void>;
}) {
  const activePreset = ACREDITACION_SOURCE_PRESETS.find((preset) => preset.key === activePresetKey) ?? ACREDITACION_SOURCE_PRESETS[0];
  const basePreset = ACREDITACION_SOURCE_PRESETS[0];
  const sweepPreset = ACREDITACION_SOURCE_PRESETS[1];
  const surveyPreset = ACREDITACION_SOURCE_PRESETS[2];
  const baseSources = sourcesForPreset(sources, basePreset);
  const sweepSources = sourcesForPreset(sources, sweepPreset);
  const surveySources = sourcesForPreset(sources, surveyPreset);
  const activeSources = sources.filter((source) => source.enabled);
  const sheetCount = activeSources.filter((source) => source.kind === "google_sheets").length;
  const surveyCount = activeSources.filter(isPlatformResponseSource).length;

  return (
    <section className="mon-acr-sources-panel mon-acr-sources-panel--standalone">
      {status ? <span className={`mon-acr-model-action-status is-${status.tone}`}>{status.message}</span> : null}
      <div className="mon-acr-fixed-source-shell">
        <AcreditacionSourceBlueprint
          sources={sources}
          activePresetKey={activePreset.key}
          onSelectPreset={onSelectPreset}
        />
        <AcreditacionSourceSyncActions
          sheetCount={sheetCount}
          surveyCount={surveyCount}
          totalCount={activeSources.length}
          busy={busy}
          onSyncSheets={onSyncSheets}
          onSyncSurvey={onSyncSurvey}
          onSyncAll={onSyncAll}
        />
        <div className="mon-acr-fixed-source-grid">
          <section className="mon-acr-platform-panel mon-acr-platform-panel--sheets" aria-label="Bases de Sheets">
            <header className="mon-acr-platform-head">
              <div>
                <span><Layers3 size={14} /> Paso 1 · Google Sheets</span>
                <strong>Base trabajada y barrido telefónico</strong>
              </div>
              <em>{fmt(baseSources.length + sweepSources.length)} conectadas</em>
            </header>
            <div className="mon-acr-requirement-grid">
              <AcreditacionSourceRequirementCard
                preset={basePreset}
                sources={baseSources}
                active={activePreset.key === basePreset.key}
                onSelect={() => onSelectPreset(basePreset.key)}
              />
              <AcreditacionSourceRequirementCard
                preset={sweepPreset}
                sources={sweepSources}
                active={activePreset.key === sweepPreset.key}
                onSelect={() => onSelectPreset(sweepPreset.key)}
              />
            </div>
          </section>
          <section className="mon-acr-platform-panel mon-acr-platform-panel--survey" aria-label="Encuestas de plataforma">
            <header className="mon-acr-platform-head">
              <div>
                <span><QrCode size={14} /> Paso 2 · Kobo/plataforma</span>
                <strong>Respuestas por actor, segmento y canal</strong>
              </div>
              <em>{fmt(surveySources.length)} seleccionadas</em>
            </header>
            <AcreditacionSourceRequirementCard
              preset={surveyPreset}
              sources={surveySources}
              active={activePreset.key === surveyPreset.key}
              onSelect={() => onSelectPreset(surveyPreset.key)}
            />
            <div className="mon-acr-source-context">
              <strong>{activePreset.label}</strong>
              <span>{activePreset.detail}</span>
              <div className="mon-acr-source-step-tags">
                {activePreset.bullets.map((bullet) => <i key={bullet}>{bullet}</i>)}
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

function AcreditacionPhoneSourceSlotCard({
  slot,
  icon,
  syncFallback,
  rowFallback = 0,
  onSelect,
}: {
  slot: AcreditacionPhoneSourceSlot;
  icon: ReactNode;
  syncFallback?: string;
  rowFallback?: number;
  onSelect?: () => void;
}) {
  const active = slot.sources.filter((source) => source.enabled);
  const primary = active[0] ?? slot.sources[0] ?? null;
  const statusLabel = slot.status === "ready" ? "Lista" : slot.status === "inactive" ? "Inactiva" : "Pendiente";
  const statusDetail = slot.key === "universo"
    ? "define la base y las cuotas"
    : slot.key === "barrido"
      ? "define responsables y estados"
      : "define avance y cruce CodPulso";
  const rows = slot.sources.reduce((sum, source) => (
    sum + (slot.key === "plataforma" ? acreditacionSourceResponseCount(source) : sourceRowCount(source))
  ), 0) || rowFallback;
  const syncLabel = primary ? sourceSyncLabel(primary) : "Sin sync";
  const displayedSync = syncLabel === "Sin sync" && slot.ready && syncFallback ? formatDate(syncFallback) : syncLabel;
  const isPlatform = slot.key === "plataforma";
  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!onSelect) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect();
  };
  return (
    <article
      className={`mon-phone-source-slot is-${slot.status}${onSelect ? " is-clickable" : ""}`}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <div className="mon-phone-source-slot-main">
        <span className="mon-phone-source-slot-icon">{icon}</span>
        <div>
          <strong>{slot.label}</strong>
          <em>{slot.purpose}</em>
        </div>
        <span className="mon-phone-source-slot-status">{statusLabel}</span>
      </div>
      <div className="mon-phone-source-slot-data">
        <span>
          <em>Fuente</em>
          {primary ? <strong>{primary.label || primary.id}</strong> : <strong>Sin fuente vinculada</strong>}
        </span>
        <span>
          <em>{isPlatform ? "Servicio" : "Spreadsheet"}</em>
          {isPlatform && primary ? (
            <strong>{sourceProviderLabel(primary.kind)}</strong>
          ) : primary && sourceSpreadsheetUrl(primary) ? (
            <a href={sourceSpreadsheetUrl(primary)} target="_blank" rel="noreferrer" title={sourceSpreadsheetUrl(primary)} onClick={(event) => event.stopPropagation()}>
              {sourceSpreadsheetDisplay(primary)}
            </a>
          ) : (
            <strong>Enlace pendiente</strong>
          )}
        </span>
        <span>
          <em>{isPlatform ? "Encuesta / asset" : "Pestaña / rango"}</em>
          <strong title={primary ? sourceExternalId(primary) : ""}>
            {primary
              ? isPlatform
                ? shortenMiddle(sourceExternalId(primary), 38)
                : [sourceSheetField(primary, "sheet_name"), sourceSheetField(primary, "range")].filter(Boolean).join(" · ") || "Sin pestaña"
              : "Pendiente"}
          </strong>
        </span>
        <span>
          <em>Lectura</em>
          <strong>{slot.sources.length ? `${fmt(active.length)}/${fmt(slot.sources.length)} activas` : statusDetail}</strong>
        </span>
        <span>
          <em>Filas</em>
          <strong>{rows ? fmt(rows) : slot.ready ? "Listo" : "S/D"}</strong>
        </span>
        <span>
          <em>Último sync</em>
          <strong>{displayedSync}</strong>
        </span>
      </div>
      <div className="mon-phone-source-slot-tags" aria-label={`Columnas esperadas para ${slot.label}`}>
        {slot.expected.map((item) => <i key={item}>{item}</i>)}
      </div>
    </article>
  );
}

function AcreditacionPhoneInstrumentDecision({
  contract,
  state,
  syncedAt,
}: {
  contract: AcreditacionPhoneSourceContract;
  state?: MonitoreoState | null;
  syncedAt?: string;
}) {
  const activePlatformSources = contract.platform.sources.filter((source) => source.enabled);
  const primary = activePlatformSources[0] ?? contract.platform.sources[0] ?? null;
  const responseCount = activePlatformSources.reduce((sum, source) => sum + acreditacionSourceResponseCount(source), 0);
  const filter = normalizePhoneEffectiveFilter(state?.config?.monitoreo_profile?.platform_effective_filter);
  const filterConfigured = Boolean(filter.enabled && filter.variable && filter.values.length);
  const filterQuestion = filter.label || filter.variable;
  const filterValue = filter.value_label || filter.values[0] || "";
  const instrumentSync = primary ? sourceSyncLabel(primary) : syncedAt ? formatDate(syncedAt) : "Sin sync";
  const sourceTitle = primary ? acreditacionSurveySourceName(primary) : "";
  const ready = contract.platform.ready && contract.sweep.ready && contract.universe.ready && filterConfigured;
  const assetLabel = primary ? shortenMiddle(sourceExternalId(primary), 48) : "Selecciona un formulario Kobo";
  const filterLabel = filterConfigured ? `${filterQuestion || filter.variable} = ${filterValue}` : "Elige consentimiento/elegibilidad";
  const responseLabel = responseCount ? `${fmt(responseCount)} respuestas` : primary ? "sin respuestas leídas" : "pendiente";
  return (
    <section className={`mon-phone-instrument-decision${ready ? " is-ready" : " has-pending"}`} aria-label="Instrumento y filtro efectivo de Kobo">
      <header>
        <div>
          <span><QrCode size={13} /> Instrumento Kobo</span>
          <strong>{sourceTitle || "Encuesta pendiente"}</strong>
          <p>Kobo manda el avance efectivo; el barrido telefónico se lee en paralelo para confirmar estados y coincidencia por CodPulso.</p>
        </div>
        <em>{ready ? "Listo para avance" : "Revisar decisión"}</em>
      </header>
      <div className="mon-phone-kobo-dossier">
        <article className={contract.platform.ready ? "is-ready" : "is-warning"}>
          <span><QrCode size={13} /> Instrumento activo</span>
          <strong>{sourceTitle || "Kobo pendiente"}</strong>
          <p>{primary ? "Este formulario alimenta el conteo de efectivas. El avance se valida con filtro y se contrasta contra el barrido por CodPulso." : "Selecciona el formulario Kobo que alimentará el avance telefónico."}</p>
          <div>
            <em>{primary ? sourceProviderLabel(primary.kind) : "Kobo"}</em>
            <em>{assetLabel}</em>
            <em>{instrumentSync}</em>
          </div>
        </article>
        <div className="mon-phone-kobo-decision-stack" aria-label="Decisiones que convierten Kobo en avance">
          <span className={contract.platform.ready ? "is-ready" : "is-warning"}>
            <em>1 · Instrumento</em>
            <strong>{sourceTitle || "Pendiente"}</strong>
            <small>{responseLabel}</small>
          </span>
          <span className={filterConfigured ? "is-ready" : "is-warning"}>
            <em>2 · Filtro efectiva</em>
            <strong>{filterLabel}</strong>
            <small>{filterConfigured ? "cuenta como efectiva Kobo" : "sin filtro no hay cierre de avance"}</small>
          </span>
          <span className={contract.universe.ready && contract.sweep.ready ? "is-ready" : "is-warning"}>
            <em>3 · Contraste telefónico</em>
            <strong>{contract.universe.ready && contract.sweep.ready ? "Base + barrido listos" : "Faltan Sheets"}</strong>
            <small>estados telefónicos en paralelo</small>
          </span>
          <span className={primary ? "is-ready" : "is-warning"}>
            <em>4 · Llave CodPulso</em>
            <strong>{primary ? "Cruce individual" : "Pendiente"}</strong>
            <small>{responseLabel}</small>
          </span>
        </div>
      </div>
    </section>
  );
}

function AcreditacionPhoneSheetsDecision({
  contract,
  syncedAt,
  nRows = 0,
}: {
  contract: AcreditacionPhoneSourceContract;
  syncedAt?: string;
  nRows?: number;
}) {
  const universePrimary = contract.universe.sources.find((source) => source.enabled) ?? contract.universe.sources[0] ?? null;
  const sweepPrimary = contract.sweep.sources.find((source) => source.enabled) ?? contract.sweep.sources[0] ?? null;
  const universeRows = contract.universe.sources.reduce((sum, source) => sum + sourceRowCount(source), 0) || nRows;
  const sweepRows = contract.sweep.sources.reduce((sum, source) => sum + sourceRowCount(source), 0);
  const sheetSync = [universePrimary, sweepPrimary]
    .map((source) => source ? sourceSyncLabel(source) : "")
    .find((label) => label && label !== "Sin sync")
    ?? (syncedAt ? formatDate(syncedAt) : "Sin sync");
  const ready = contract.universe.ready && contract.sweep.ready;
  return (
    <section className={`mon-phone-instrument-decision mon-phone-sheets-decision${ready ? " is-ready" : " has-pending"}`} aria-label="Base y barrido telefónico">
      <header>
        <div>
          <span><Table2 size={13} /> Base y barrido</span>
          <strong>{ready ? "Sheets listos para operación" : "Completa universo y barrido"}</strong>
          <p>La base define a quién llamar; el barrido conserva responsables, intentos, estados y fechas. Kobo queda separado como validación de efectivas.</p>
        </div>
        <em>{ready ? "Listo para llamadas" : "Faltan Sheets"}</em>
      </header>
      <div className="mon-phone-instrument-grid">
        <span className={contract.universe.ready ? "is-ready" : "is-warning"}>
          <em>Universo</em>
          <strong>{universeRows ? fmt(universeRows) : contract.universe.ready ? "Listo" : "Pendiente"}</strong>
          <small>{universePrimary ? sourceSheetField(universePrimary, "sheet_name") || "pestaña vinculada" : "base y cuotas"}</small>
        </span>
        <span className={contract.sweep.ready ? "is-ready" : "is-warning"}>
          <em>Barrido</em>
          <strong>{sweepRows ? fmt(sweepRows) : contract.sweep.ready ? "Listo" : "Pendiente"}</strong>
          <small>{sweepPrimary ? sourceSheetField(sweepPrimary, "sheet_name") || "pestaña vinculada" : "responsables y estados"}</small>
        </span>
        <span className={contract.sweep.ready ? "is-ready" : "is-warning"}>
          <em>Estados telefónicos</em>
          <strong>{contract.sweep.ready ? "Separados" : "Pendientes"}</strong>
          <small>consulta operativa, no efectiva Kobo</small>
        </span>
        <span className={ready ? "is-ready" : "is-warning"}>
          <em>Último sync</em>
          <strong>{sheetSync}</strong>
          <small>lectura local de Sheets</small>
        </span>
      </div>
    </section>
  );
}

function AcreditacionPhoneEffectiveFilterEditor({
  state,
  variables,
  platformSources,
  onStateChange,
}: {
  state?: MonitoreoState | null;
  variables: MonitoreoVariable[];
  platformSources: MonitoreoSource[];
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const savedFilter = normalizePhoneEffectiveFilter(state?.config?.monitoreo_profile?.platform_effective_filter);
  const filterKey = JSON.stringify(savedFilter);
  const options = phoneEffectiveFilterQuestionOptions(variables, state?.source_metadata, platformSources);
  const [draft, setDraft] = useState(() => ({
    variable: savedFilter.variable,
    value: savedFilter.values[0] ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);
  const selectedOption = options.find((option) => normalizeSourceMatch(option.value) === normalizeSourceMatch(draft.variable)) ?? null;
  const valueOptions = phoneEffectiveFilterAnswerOptions(options, draft.variable, draft.value);
  const likelyFilterOptions = options.filter((option) => phoneEffectiveFilterQuestionScore(option) <= 2);
  const suggestedOptions = uniqueDisplayValues([
    ...(selectedOption ? [selectedOption.value] : []),
    ...likelyFilterOptions.map((option) => option.value),
  ]).map((value) => options.find((option) => option.value === value)).filter(Boolean).slice(0, 3) as PhoneEffectiveFilterQuestionOption[];
  const configured = Boolean(draft.variable.trim() && draft.value.trim());
  const displayLabel = configured
    ? `${selectedOption ? phoneEffectiveFilterLabel(selectedOption) : draft.variable} = ${draft.value}`
    : "Sin filtro";

  useEffect(() => {
    setDraft({
      variable: savedFilter.variable,
      value: savedFilter.values[0] ?? "",
    });
  }, [filterKey]);

  const saveFilter = async () => {
    if (!state?.config) return;
    setSaving(true);
    setStatus({ tone: "info", message: "Guardando filtro Kobo..." });
    try {
      const result = await apiMonitoreoConfig({
        ...state.config,
        monitoreo_profile: {
          ...state.config.monitoreo_profile,
          platform_effective_filter: {
            enabled: configured,
            variable: draft.variable.trim(),
            values: configured ? [draft.value.trim()] : [],
            label: selectedOption ? phoneEffectiveFilterLabel(selectedOption) : draft.variable.trim(),
            value_label: draft.value.trim(),
            source_kind: "kobo",
          },
        },
      });
      onStateChange?.(result.state);
      setStatus({ tone: "success", message: "Filtro Kobo actualizado." });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`mon-platform-rejection-rule mon-phone-effective-filter${configured ? " is-configured" : " is-empty"}`} aria-label="Filtro de efectiva Kobo">
      <header>
        <div>
          <span><Filter size={12} /> Filtro de efectiva Kobo</span>
          <strong>{displayLabel}</strong>
          <p>Selecciona la pregunta de consentimiento o elegibilidad y el valor que convierte una respuesta completa en efectiva.</p>
        </div>
        <button type="button" onClick={() => void saveFilter()} disabled={saving || !state?.config}>
          {saving ? <Loader2 size={13} className="pulso-spin" /> : <Save size={13} />}
          Guardar filtro
        </button>
      </header>
      <div className="mon-phone-filter-decision" aria-label="Decisión del filtro Kobo">
        <span className={draft.variable ? "is-ready" : "is-empty"}>
          <em>Pregunta</em>
          <strong>{selectedOption ? phoneEffectiveFilterLabel(selectedOption) : draft.variable || "Pendiente"}</strong>
        </span>
        <span className={draft.value ? "is-ready" : "is-empty"}>
          <em>Valor que cuenta</em>
          <strong>{draft.value || "Pendiente"}</strong>
        </span>
        <span className={configured ? "is-ready" : "is-warning"}>
          <em>Resultado</em>
          <strong>{configured ? "Cuenta como efectiva Kobo" : "No valida avance"}</strong>
        </span>
      </div>
      {suggestedOptions.length ? (
        <div className="mon-phone-filter-suggestions" aria-label="Sugerencias de filtro de efectiva">
          <span>Preguntas candidatas</span>
          {suggestedOptions.map((option) => {
            const value = preferredPhoneEffectiveValue(option.choices);
            const active = normalizeSourceMatch(option.value) === normalizeSourceMatch(draft.variable);
            return (
              <button
                key={option.value}
                type="button"
                className={active ? "is-active" : ""}
                onClick={() => setDraft({ variable: option.value, value })}
                disabled={saving}
              >
                <strong>{phoneEffectiveFilterLabel(option)}</strong>
                <em>{value ? `Cuenta: ${value}` : `${fmt(option.choices.length)} valores`}</em>
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="mon-platform-rule-list">
        <article className="mon-platform-rule-row mon-platform-rule-row--filter">
          <label>
            <span>Pregunta de selección única</span>
            <select
              value={draft.variable}
              onChange={(event) => {
                const variable = event.target.value;
                const option = options.find((item) => item.value === variable);
                const value = option?.choices.some((choice) => normalizeSourceMatch(choice) === normalizeSourceMatch(draft.value))
                  ? draft.value
                  : preferredPhoneEffectiveValue(option?.choices ?? []);
                setDraft({ variable, value });
              }}
              disabled={saving}
            >
              <option value="">Seleccionar pregunta</option>
              {options.map((option) => (
                <option key={option.value} value={option.value} title={phoneEffectiveFilterLabel(option)}>
                  {compactSelectLabel(phoneEffectiveFilterLabel(option))}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Valor que cuenta</span>
            <select
              value={draft.value}
              onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))}
              disabled={saving || !draft.variable}
            >
              {valueOptions.length ? valueOptions.map((value) => (
                <option key={value} value={value}>{value}</option>
              )) : <option value={draft.value}>{draft.value || "Sin valores"}</option>}
            </select>
          </label>
        </article>
      </div>
      <footer>
        <span>{fmt(options.length)} preguntas con valores</span>
        <span>{platformSources.length ? `${fmt(platformSources.length)} fuente${platformSources.length === 1 ? "" : "s"} Kobo` : "Sin Kobo"}</span>
      </footer>
      {status ? <span className={`mon-acr-model-action-status is-${status.tone}`}>{status.message}</span> : null}
    </section>
  );
}

function AcreditacionPhoneSourcesContractPanel({
  state,
  sources,
  syncedAt,
  nRows = 0,
  focus = "all",
  onStateChange,
  onSourceTabChange,
}: {
  state?: MonitoreoState | null;
  sources: MonitoreoSource[];
  syncedAt?: string;
  nRows?: number;
  focus?: "all" | "sheets" | "kobo";
  onStateChange?: (state: MonitoreoState) => void;
  onSourceTabChange?: (tab: AcreditacionSourceTab) => void;
}) {
  const contract = buildAcreditacionPhoneSourceContract(sources);
  const basePreset = ACREDITACION_SOURCE_PRESETS[0];
  const sweepPreset = ACREDITACION_SOURCE_PRESETS[1];
  const platformSources = contract.platform.sources;
  const koboSources = platformSources.filter(isKoboResponseSource);
  const missingLabel = contract.missing.length
    ? contract.missing.map((item) => (
      item === "universo"
        ? "base de universo"
        : item === "barrido"
          ? "barrido"
          : "Kobo"
    )).join(", ")
    : "contrato completo";
  const focusCopy = focus === "sheets"
    ? {
      eyebrow: "Base y barrido",
      title: "Sheets operativos para llamar y registrar estados",
      detail: "Aquí se revisan solo las hojas que definen población, responsables, intentos, estados y fechas de llamada.",
    }
    : focus === "kobo"
      ? {
        eyebrow: "Kobo",
        title: "Instrumento y filtro que cuentan efectivas",
        detail: "Aquí se escoge la encuesta Kobo y la pregunta de consentimiento que transforma respuestas completas en efectivas del monitoreo.",
      }
      : {
        eyebrow: "Paquete",
        title: "Contrato de fuentes telefónicas",
        detail: "La base define a quién llamar; el barrido registra operación telefónica; Kobo valida efectivas por CodPulso.",
      };
  const showSheetsDecision = focus === "sheets";
  const showKoboDecision = focus === "kobo";
  const showKoboEditor = focus === "kobo" || !contract.platform.ready;
  const showSheetsEditors = focus === "sheets" || !contract.ready;
  const activeSweepSource = contract.sweep.sources.find((source) => source.enabled) ?? contract.sweep.sources[0] ?? null;
  const activeKoboCount = koboSources.filter((source) => source.enabled).length;
  const sourceSlots = focus === "kobo"
    ? [contract.platform]
    : focus === "sheets"
      ? [contract.universe, contract.sweep]
      : [contract.universe, contract.sweep, contract.platform];
  const packageSteps = [
    {
      label: "Población",
      value: contract.universe.ready ? "Base lista" : "Falta base",
      detail: `${fmt(nRows)} casos`,
      tone: contract.universe.ready ? "ready" : "warning",
    },
    {
      label: "Operación",
      value: contract.sweep.ready ? "Barrido listo" : "Falta barrido",
      detail: activeSweepSource ? sourceSheetField(activeSweepSource, "sheet_name") || "responsables y estados" : "responsables y estados",
      tone: contract.sweep.ready ? "ready" : "warning",
    },
    {
      label: "Efectivas",
      value: contract.platform.ready ? "Kobo listo" : "Falta Kobo",
      detail: `${fmt(activeKoboCount)} encuesta${activeKoboCount === 1 ? "" : "s"}`,
      tone: contract.platform.ready ? "ready" : "warning",
    },
  ] as const;
  return (
    <section className={`mon-phone-source-contract is-focus-${focus}${contract.ready ? " is-ready" : " has-missing"}`} aria-label="Contrato de fuentes telefónicas">
      <header className="mon-phone-source-contract-head">
        <div>
          <span><PlugZap size={14} /> {focusCopy.eyebrow}</span>
          <strong>{focusCopy.title}</strong>
          <p>{focusCopy.detail}</p>
        </div>
        <em>{contract.ready ? "Listo para monitoreo" : `Falta ${missingLabel}`}</em>
      </header>
      <div className="mon-phone-source-contract-grid">
        {sourceSlots.map((slot) => (
          <AcreditacionPhoneSourceSlotCard
            key={slot.key}
            slot={slot}
            icon={slot.key === "universo" ? <Layers3 size={15} /> : slot.key === "barrido" ? <PhoneCall size={15} /> : <QrCode size={15} />}
            rowFallback={slot.key === "universo" ? nRows : undefined}
            syncFallback={syncedAt}
            onSelect={() => onSourceTabChange?.(slot.key === "plataforma" ? "survey" : "sheets")}
          />
        ))}
      </div>
      {focus === "all" ? (
        <div className="mon-phone-source-package-map" aria-label="Lectura del paquete telefónico">
          {packageSteps.map((step) => (
            <span key={step.label} className={`is-${step.tone}`}>
              <em>{step.label}</em>
              <strong>{step.value}</strong>
              <small>{step.detail}</small>
            </span>
          ))}
        </div>
      ) : null}
      {showSheetsDecision ? (
        <AcreditacionPhoneSheetsDecision
          contract={contract}
          syncedAt={syncedAt}
          nRows={nRows}
        />
      ) : null}
      {showKoboDecision ? (
        <>
          <AcreditacionPhoneInstrumentDecision
            contract={contract}
            state={state}
            syncedAt={syncedAt}
          />
          <AcreditacionPhoneEffectiveFilterEditor
            state={state}
            variables={state?.variables ?? []}
            platformSources={platformSources}
            onStateChange={onStateChange}
          />
        </>
      ) : null}
      {!contract.ready ? (
        <div className="mon-phone-source-contract-alert">
          <AlertCircle size={15} />
          <span>
            {!contract.universe.ready
              ? "Primero vincula la base de universo; luego el barrido telefónico y Kobo para separar población, operación diaria y avance."
              : !contract.sweep.ready
                ? "La base de universo ya está vinculada. Falta registrar la hoja de barrido con responsables, estados e intentos."
                : "Base y barrido ya están vinculados. Falta seleccionar la encuesta Kobo que alimenta la comparación de efectivas."}
          </span>
        </div>
      ) : null}
      <details className="mon-phone-source-editors" open={showSheetsEditors}>
        <summary>
          <span><Table2 size={14} /> Configurar base y barrido</span>
          <em>{contract.ready ? "Editar fuentes" : "Completar fuentes"}</em>
        </summary>
        <div className="mon-phone-source-editor-grid">
          <AcreditacionSheetSourceEditor
            preset={basePreset}
            sources={contract.universe.sources}
            onStateChange={onStateChange}
          />
          <AcreditacionSheetSourceEditor
            preset={sweepPreset}
            sources={contract.sweep.sources}
            onStateChange={onStateChange}
          />
        </div>
      </details>
      <details className="mon-phone-source-editors" open={showKoboEditor}>
        <summary>
          <span><QrCode size={14} /> Seleccionar Kobo</span>
          <em>{contract.platform.ready ? "Editar Kobo" : "Falta Kobo"}</em>
        </summary>
        <div className="mon-phone-source-editor-grid mon-phone-source-editor-grid--platform">
          <AcreditacionKoboSourcePicker
            sources={koboSources}
            phoneMode
            onStateChange={onStateChange}
          />
        </div>
      </details>
    </section>
  );
}

function AcreditacionSourcesWorkbench({
  reports,
  state,
  activeTab = "survey",
  onStateChange,
  onSourceTabChange,
}: {
  reports: MonitoreoAcreditacionReports;
  state?: MonitoreoState | null;
  activeTab?: AcreditacionSourceTab;
  onStateChange?: (state: MonitoreoState) => void;
  onSourceTabChange?: (tab: AcreditacionSourceTab) => void;
}) {
  const client = reports.client_report;
  const reportSources = (client?.sources?.length ? client.sources : rowsFromSheets(reports.sheets, ["fuente", "source", "canal"])) as Array<Record<string, unknown>>;
  const configuredSources = state?.sources ?? [];
  const operationalSources = useMemo(
    () => configuredSources.map((source) => acreditacionSourceWithOperationalMetadata(source, state?.source_metadata)),
    [configuredSources, state?.source_metadata],
  );
  const [syncBusy, setSyncBusy] = useState<"sheets" | "survey" | "all" | null>(null);
  const [syncStatus, setSyncStatus] = useState<AcreditacionActionStatus>(null);
  const [syncProgress, setSyncProgress] = useState<SourceSyncActionsProgress | null>(null);
  const isPhoneSourceModel = isTelefonicoMonitoreoState(state);
  const platformSources = isPhoneSourceModel ? acreditacionKoboResponseSources(operationalSources) : operationalSources.filter(isPlatformResponseSource);
  const sheetSources = operationalSources.filter((source) => source.kind === "google_sheets");
  const activeSources = operationalSources.filter((source) => source.enabled);
  const activeSurveySources = platformSources.filter((source) => source.enabled);
  const activeSheetSources = sheetSources.filter((source) => source.enabled);

  const syncSheets = async () => {
    const sourceIds = activeSheetSources.map((source) => source.id);
    if (!sourceIds.length) {
      setSyncStatus({ tone: "error", message: "No hay fuentes Sheets activas para actualizar." });
      return;
    }
    setSyncBusy("sheets");
    setSyncStatus({ tone: "info", message: `Actualizando ${fmt(sourceIds.length)} fuentes Sheets...` });
    try {
      const result = await apiMonitoreoSheetsSync(sourceIds);
      onStateChange?.(result.state);
      setSyncStatus({ tone: "success", message: `Sheets sincronizadas: ${fmt(result.n_rows)} registros locales.` });
    } catch (e) {
      const message = (e as Error).message;
      setSyncStatus({ tone: "error", message });
    } finally {
      setSyncBusy(null);
    }
  };

  const syncExternal = async (kind: "survey" | "all", sourceIds: string[], label: string, syncMode: "full" | "advance" = "full") => {
    if (!sourceIds.length) {
      setSyncStatus({ tone: "error", message: "No hay fuentes activas para actualizar." });
      return;
    }
    setSyncBusy(kind);
    setSyncStatus({ tone: "info", message: `${label}: creando job local...` });
    setSyncProgress({ percent: 2, phase: "Preparando", message: `${label}: creando job local...` });
    try {
      const start = await apiMonitoreoSync(undefined, sourceIds, { syncMode });
      setSyncStatus({ tone: "info", message: `${label}: job ${start.job_id} en ejecución.` });
      setSyncProgress({ percent: 8, phase: "En cola", message: `${label}: job ${start.job_id} en ejecución.` });
      await waitForSourceSyncJob(start.job_id, (progress) => setSyncProgress(progress));
      const next = await apiMonitoreoState({
        includeReports: true,
        reportScope: "source",
        warmupCache: false,
        force: true,
      });
      onStateChange?.(next);
      setSyncStatus({ tone: "success", message: `${label}: fuentes sincronizadas y corte local actualizado.` });
    } catch (e) {
      const message = (e as Error).message;
      setSyncStatus({ tone: "error", message });
    } finally {
      setSyncBusy(null);
      setSyncProgress(null);
    }
  };

  const sourceStatus = (
    <AcreditacionSourceStatusStrip
      sources={operationalSources}
      reports={reports}
      phoneMode={isPhoneSourceModel}
      status={syncStatus}
      busy={Boolean(syncBusy)}
      progress={syncProgress}
      onSyncSheets={syncSheets}
      onSyncSurvey={() => syncExternal("survey", activeSurveySources.map((source) => source.id), isPhoneSourceModel ? "Actualizacion Kobo" : "Actualizacion de plataforma", "full")}
      onSyncAll={() => syncExternal("all", activeSources.map((source) => source.id), "Actualizacion completa", "full")}
    />
  );
  const phoneSourceContract = (focus: "all" | "sheets" | "kobo" = "all") => isPhoneSourceModel ? (
    <AcreditacionPhoneSourcesContractPanel
      state={state}
      sources={operationalSources}
      syncedAt={state?.synced_at ?? reports.generated_at}
      nRows={state?.n_rows ?? 0}
      focus={focus}
      onStateChange={onStateChange}
      onSourceTabChange={onSourceTabChange}
    />
  ) : null;

  if (activeTab === "survey") {
    return (
      <div className="mon-profile-stack">
        {sourceStatus}
        {isPhoneSourceModel ? phoneSourceContract("kobo") : (
          <AcreditacionPlatformSurveySourcesView
            sources={operationalSources}
            config={state?.config}
            onStateChange={onStateChange}
          />
        )}
      </div>
    );
  }

  if (activeTab === "sheets") {
    return (
      <div className="mon-profile-stack">
        {sourceStatus}
        {phoneSourceContract("sheets")}
        {isPhoneSourceModel ? (
          <AcreditacionConfiguredSourcesList
            sources={operationalSources}
            syncFallback={state?.synced_at ?? reports.generated_at}
            phoneMode={isPhoneSourceModel}
            onStateChange={onStateChange}
          />
        ) : (
          <AcreditacionSheetsByActorView
            sources={operationalSources}
            onStateChange={onStateChange}
          />
        )}
      </div>
    );
  }

  if (activeTab === "collectors") {
    return (
      <div className="mon-profile-stack">
        {sourceStatus}
        <AcreditacionCollectorsSourceView
          sources={operationalSources}
          config={state?.config}
          onStateChange={onStateChange}
        />
      </div>
    );
  }

  return (
    <div className="mon-profile-stack">
      {sourceStatus}
      {isPhoneSourceModel ? (
        <>
          {phoneSourceContract("all")}
          <AcreditacionConfiguredSourcesList
            sources={operationalSources}
            syncFallback={state?.synced_at ?? reports.generated_at}
            phoneMode={isPhoneSourceModel}
            onStateChange={onStateChange}
          />
        </>
      ) : (
        <AcreditacionActiveSourcesView
          sources={operationalSources}
          config={state?.config}
          reportSources={reportSources}
          state={state}
          onStateChange={onStateChange}
        />
      )}
    </div>
  );
}

function StatTile({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "warn" }) {
  return (
    <div className={`mon-profile-stat mon-profile-stat--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DataTable({
  rows,
  empty,
  preferredColumns = [],
  maxColumns = 8,
}: {
  rows: Array<Record<string, unknown>>;
  empty: string;
  preferredColumns?: string[];
  maxColumns?: number;
}) {
  if (!rows.length) return <p className="mon-profile-muted">{empty}</p>;
  const columns = compactColumns(rows, preferredColumns, maxColumns);
  return (
    <div className="mon-profile-table-wrap">
      <table className="mon-profile-table">
        <thead>
          <tr>{columns.map((column) => <th key={column}>{columnLabel(column)}</th>)}</tr>
        </thead>
        <tbody>
          {rows.slice(0, 80).map((row, index) => (
            <tr key={index}>
              {columns.map((column) => <td key={column}>{rowValue(row, column)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function downloadRowsAsCsv(rows: Array<Record<string, unknown>>, filename: string) {
  if (!rows.length || typeof document === "undefined" || typeof URL === "undefined" || typeof Blob === "undefined") return;
  const columns = compactColumns(rows, [], 60);
  const csv = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  const raw = value == null ? "" : String(value);
  return `"${raw.replace(/"/g, "\"\"")}"`;
}

type AcreditacionCaseFilters = {
  search: string;
  actor: string;
  date: string;
  channel: string;
  source: string;
  collector: string;
  response: string;
  crossing: string;
};

const EMPTY_CASE_FILTERS: AcreditacionCaseFilters = {
  search: "",
  actor: "",
  date: "",
  channel: "",
  source: "",
  collector: "",
  response: "",
  crossing: "",
};

const RESPONSE_FILTER_ORDER = ["complete", "partial", "refusal", "pending"];

function normalizeCaseSearch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@.]+/g, " ")
    .trim();
}

function caseIdentity(item: MonitoreoInternalQueryCase) {
  return item.response_id || item.case_key || `${item.actor}-${item.response_row}-${item.person_label}`;
}

function caseDisplayName(item: MonitoreoInternalQueryCase) {
  return String(item.person_label || item.case_key || item.response_id || "Caso sin llave")
    .toLocaleLowerCase("es-PE")
    .replace(/(^|[\s,.'’()-])(\p{L})/gu, (_match, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase("es-PE")}`);
}

function caseMatchesFilters(item: MonitoreoInternalQueryCase, filters: AcreditacionCaseFilters) {
  return filterInternalQueryCases([item], {
    search: filters.search,
    actor: filters.actor,
    date: filters.date,
    channel: filters.channel,
    collector: filters.collector,
    source: filters.source,
    response: filters.response,
    state: "",
    crossing: filters.crossing,
  }).length > 0;
}

function consultaFiltersForTab(filters: AcreditacionCaseFilters, tab: AcreditacionConsultaTab): AcreditacionCaseFilters {
  if (tab === "base") {
    return {
      ...EMPTY_CASE_FILTERS,
      search: filters.search,
      actor: filters.actor,
      response: filters.response,
    };
  }
  return filters;
}

function countCaseOptions(
  cases: MonitoreoInternalQueryCase[],
  valueForCase: (item: MonitoreoInternalQueryCase) => string,
  labelForValue: (value: string) => string = (value) => value,
  order: string[] = [],
) {
  const counts = new Map<string, number>();
  cases.forEach((item) => {
    const value = valueForCase(item);
    if (!value) return;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, label: labelForValue(value), count }))
    .sort((a, b) => {
      const aIndex = order.indexOf(a.value);
      const bIndex = order.indexOf(b.value);
      if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      return a.label.localeCompare(b.label, "es");
    });
}

function caseChannelValue(item: MonitoreoInternalQueryCase) {
  return item.channel || "";
}

function caseSourceValue(item: MonitoreoInternalQueryCase) {
  return item.source_label || item.source_id || item.base_source || "";
}

function caseCollectorValue(item: MonitoreoInternalQueryCase) {
  return internalQueryCollectorValue(item) || item.collector_id || "";
}

function caseToneClass(item: MonitoreoInternalQueryCase) {
  const response = internalCaseResponseStateValue(item);
  if (response === "complete") return "is-effective";
  if (response === "partial") return "is-partial";
  if (response === "refusal") return "is-refusal";
  return "is-muted";
}

function caseWithoutCrossing(item: MonitoreoInternalQueryCase) {
  const crossing = internalCaseCrossingValue(item);
  return crossing === "sin_cruce" || crossing === "sin_llave" || crossing === "sin_base";
}

function caseHasPlatformResponse(item: MonitoreoInternalQueryCase) {
  return Boolean(String(item.response_id || "").trim());
}

function caseResponseSortTime(item: MonitoreoInternalQueryCase) {
  const raw = String(item.response_datetime || item.date || "").trim();
  if (!raw || normalizeCaseSearch(raw).includes("sin fecha")) return 0;
  const date = raw.includes("T") || raw.includes(":") ? new Date(raw) : new Date(`${raw}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function caseResponseDateTimeLabel(item: MonitoreoInternalQueryCase) {
  const rawDateTime = String(item.response_datetime || "").trim();
  if (rawDateTime) {
    const date = new Date(rawDateTime);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
    }
    return rawDateTime;
  }
  const rawDate = String(item.date || "").trim();
  if (!rawDate) return "Sin fecha";
  return formatInternalQueryDateLabel(rawDate);
}

export function caseResponseTimeDetailLabel(item: MonitoreoInternalQueryCase) {
  const rawDateTime = String(item.response_datetime || "").trim();
  if (!rawDateTime) return "Sin hora registrada";
  const date = new Date(rawDateTime);
  if (Number.isNaN(date.getTime())) return "Hora no normalizada";
  return date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

function comparePlatformCases(a: MonitoreoInternalQueryCase, b: MonitoreoInternalQueryCase) {
  return caseResponseSortTime(b) - caseResponseSortTime(a) ||
    String(b.response_row ?? "").localeCompare(String(a.response_row ?? ""), "es", { numeric: true }) ||
    caseDisplayName(a).localeCompare(caseDisplayName(b), "es");
}

export function caseIsSubsanacionCandidate(item: MonitoreoInternalQueryCase) {
  return caseHasPlatformResponse(item) && caseWithoutCrossing(item);
}

export function caseIsActionableSubsanacion(item: MonitoreoInternalQueryCase) {
  const response = internalCaseResponseStateValue(item);
  return caseIsSubsanacionCandidate(item) && (response === "complete" || response === "partial");
}

function caseSubsanacionActionLabel(item: MonitoreoInternalQueryCase) {
  if (caseIsActionableSubsanacion(item)) return "Subsanar";
  if (internalCaseResponseStateValue(item) === "refusal") return "No accionable";
  if (internalCaseResponseStateValue(item) === "pending") return "Sin respuesta";
  return assistedReviewVisible(item) ? "Revisar" : "Explicar";
}

function caseCompletionGroupKey(item: MonitoreoInternalQueryCase) {
  const actor = normalizeCaseSearch(item.actor || "sin actor");
  const key = normalizeCaseSearch(item.case_key);
  if (!key) return "";
  return `${actor}:${key}`;
}

export function caseHasLaterCompleteResponse(item: MonitoreoInternalQueryCase, allCases: MonitoreoInternalQueryCase[]) {
  if (internalCaseResponseStateValue(item) !== "partial" || !caseHasPlatformResponse(item)) return false;
  const groupKey = caseCompletionGroupKey(item);
  if (!groupKey) return false;
  const responseId = String(item.response_id || "").trim();
  const currentTime = caseResponseSortTime(item);
  return allCases.some((candidate) => {
    if (candidate === item) return false;
    if (caseCompletionGroupKey(candidate) !== groupKey) return false;
    if (responseId && String(candidate.response_id || "").trim() === responseId) return false;
    if (internalCaseResponseStateValue(candidate) !== "complete") return false;
    if (caseCountsInAdvance(candidate) !== true) return false;
    const candidateTime = caseResponseSortTime(candidate);
    if (currentTime > 0 && candidateTime > 0) return candidateTime > currentTime;
    return true;
  });
}

export function casePlatformActionLabel(item: MonitoreoInternalQueryCase, allCases: MonitoreoInternalQueryCase[] = []) {
  if (caseIsSubsanacionCandidate(item)) return caseSubsanacionActionLabel(item);
  if (caseHasLaterCompleteResponse(item, allCases)) return "Completada después";
  return "Sin subsanación";
}

function casePlatformActionDetail(item: MonitoreoInternalQueryCase, allCases: MonitoreoInternalQueryCase[] = []) {
  if (caseHasLaterCompleteResponse(item, allCases)) {
    return "La parcial queda como trazabilidad; el mismo caso tiene una completa posterior que cuenta en avance.";
  }
  return "Sin decisión o subsanación operativa asociada.";
}

function caseSubsanacionActionDetail(item: MonitoreoInternalQueryCase) {
  if (caseIsActionableSubsanacion(item)) {
    return "Respuesta completa o parcial sin cruce: puede vincularse con evidencia y nota.";
  }
  if (internalCaseResponseStateValue(item) === "refusal") {
    return "Rechazo no identificable: queda explicado, no se puede asignar al universo sin evidencia.";
  }
  return "No hay respuesta efectiva que mover al avance.";
}

function caseIsAuditable(item: MonitoreoInternalQueryCase) {
  return (
    item.advancement !== "effective" ||
    caseWithoutCrossing(item) ||
    Number(item.duplicate_count ?? item.duplicate_group_size ?? 0) > 1 ||
    caseCountsInAdvance(item) === false ||
    Boolean(casePhoneAction(item)) ||
    Boolean(String(item.issue_type || "").trim())
  );
}

function explicitBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (["true", "1", "si", "sí", "yes", "cuenta", "cuenta en avance"].includes(normalized)) return true;
  if (["false", "0", "no", "no cuenta", "no cuenta en avance"].includes(normalized)) return false;
  return null;
}

function caseCountsInAdvance(item: MonitoreoInternalQueryCase): boolean | null {
  const explicit = explicitBoolean(item.counts_in_advance);
  if (explicit !== null) return explicit;
  const status = String(item.duplicate_counting_status ?? "").toLowerCase();
  if (status.includes("no cuenta")) return false;
  if (status.includes("cuenta")) return true;
  if (item.advancement === "effective") return true;
  if (["partial", "refusal", "pending", "excluded"].includes(item.advancement)) return false;
  return null;
}

function caseCountsLabel(item: MonitoreoInternalQueryCase) {
  const counts = caseCountsInAdvance(item);
  if (counts === true) return "Cuenta";
  if (counts === false) return "No cuenta";
  return "Revisar";
}

function caseDuplicateLabel(item: MonitoreoInternalQueryCase) {
  const duplicateCount = Number(item.duplicate_count ?? item.duplicate_group_size ?? 0);
  if (duplicateCount > 1) return item.duplicate_counting_status || `${fmt(duplicateCount)} respuestas`;
  return item.duplicate_counting_status || "Sin duplicado";
}

function casePartialLabel(item: MonitoreoInternalQueryCase) {
  const answered = Number(item.partial_answered_questions ?? Number.NaN);
  const total = Number(item.partial_total_questions ?? Number.NaN);
  const pctValue = Number(item.partial_completion_pct ?? Number.NaN);
  if (Number.isFinite(answered) && Number.isFinite(total) && total > 0) {
    const percent = Number.isFinite(pctValue) ? pctValue : (answered / total) * 100;
    return `${fmt(answered)}/${fmt(total)} (${pct(percent)})`;
  }
  if (Number.isFinite(pctValue)) return pct(pctValue);
  return internalCaseResponseStateValue(item) === "partial" ? "Parcial sin detalle" : "";
}

function casePrimaryEvidence(item: MonitoreoInternalQueryCase) {
  const label = item.primary_identity_label || item.identity_label || item.channel_key_strategy_label || "Llave";
  const value = item.primary_identity_value || item.case_key || item.phone_audit?.cv_id || item.response_id || "";
  return value ? `${label}: ${value}` : "Sin evidencia primaria";
}

function caseSecondaryEvidence(item: MonitoreoInternalQueryCase) {
  const phone = item.phone_audit;
  if (item.secondary_identity_value) {
    return `${item.secondary_identity_label || "Evidencia secundaria"}: ${item.secondary_identity_value}`;
  }
  if (phone?.final_codpulso) return `Código final: ${phone.final_codpulso}`;
  if (phone?.declared_phone) return `Celular declarado: ${phone.declared_phone}`;
  if (phone?.manual_code_base?.case_key) return `Código manual: ${phone.manual_code_base.case_key}`;
  return "";
}

type AcreditacionCaseKeyEvidenceTone = "primary" | "secondary" | "base";

type AcreditacionCaseKeyEvidenceRow = {
  label: string;
  value: string;
  tone: AcreditacionCaseKeyEvidenceTone;
};

function cleanCaseKeyText(value: unknown) {
  return String(value ?? "").trim();
}

function caseKeyStrategyFallbackLabel(item: MonitoreoInternalQueryCase) {
  const key = normalizeCaseSearch([
    item.channel_key_strategy,
    item.channel_key_strategy_label,
    item.channel,
    item.collector_name,
    item.source_label,
  ].join(" "));
  if (key.includes("telefon")) return "Telefónico: enlace personalizado + código final";
  if (key.includes("whatsapp")) return "WhatsApp: pregunta de código PUCP";
  if (key.includes("qr") || key.includes("presencial") || key.includes("ficha")) return "QR presencial: pregunta de código PUCP";
  if (key.includes("correo") || key.includes("email") || key.includes("mail")) return "Correo: metadata del envío";
  if (key.includes("enlace") || key.includes("web") || key.includes("link") || key.includes("sms")) return "Enlace: pregunta de código PUCP";
  return "Llave configurada por fuente";
}

function caseKeyStrategyHint(item: MonitoreoInternalQueryCase) {
  const strategyKey = normalizeCaseSearch([
    item.channel_key_strategy,
    item.channel_key_strategy_label,
  ].join(" "));
  const channel = acreditacionChannelDisplay(item.channel || item.source_label);
  if (strategyKey.includes("llave configurada") || strategyKey.includes("configurada")) {
    return `Primero llave configurada para ${channel}; usar auxiliares para explicar o subsanar.`;
  }
  const key = normalizeCaseSearch([
    item.channel_key_strategy,
    item.channel_key_strategy_label,
    item.channel,
    item.collector_name,
    item.source_label,
  ].join(" "));
  if (key.includes("telefon")) return "Primero enlace personalizado; si no cruza, revisar código final y celular declarado.";
  if (key.includes("correo") || key.includes("email") || key.includes("mail")) return "Primero correo o metadata de envío; código declarado queda como apoyo.";
  if (key.includes("qr") || key.includes("presencial") || key.includes("ficha")) return "Primero código PUCP declarado en ficha QR; revisar digitación si queda sin cruce.";
  if (key.includes("whatsapp") || key.includes("enlace") || key.includes("web") || key.includes("link") || key.includes("sms")) return "Primero código PUCP declarado en el enlace; usar correo o nombre como apoyo.";
  return "Primero variable de llave configurada; usar auxiliares para explicar o subsanar.";
}

export function caseKeyTraceSummary(item: MonitoreoInternalQueryCase) {
  const phone = item.phone_audit;
  const channelLabel = acreditacionChannelDisplay(item.channel || item.source_label);
  const strategyLabelRaw = cleanCaseKeyText(item.channel_key_strategy_label) || caseKeyStrategyFallbackLabel(item);
  const strategyLabel = normalizeCaseSearch(strategyLabelRaw).includes("llave configurada") && channelLabel !== "Sin canal"
    ? `${channelLabel}: llave configurada por fuente`
    : strategyLabelRaw;
  const primaryLabel = cleanCaseKeyText(item.primary_identity_label || item.identity_label) || (
    normalizeCaseSearch(strategyLabel).includes("telefon") ? "Enlace usado" : "Llave leída"
  );
  const primaryValue = cleanCaseKeyText(item.primary_identity_value) ||
    cleanCaseKeyText(phone?.cv_id) ||
    cleanCaseKeyText(item.case_key);
  const secondaryLabel = cleanCaseKeyText(item.secondary_identity_label) || "Evidencia auxiliar";
  const secondaryValue = cleanCaseKeyText(item.secondary_identity_value) ||
    cleanCaseKeyText(phone?.final_codpulso) ||
    cleanCaseKeyText(phone?.declared_phone) ||
    cleanCaseKeyText(phone?.manual_code_base?.case_key);
  const baseValue = cleanCaseKeyText(item.base_record) ||
    cleanCaseKeyText(item.base_source) ||
    internalCaseCrossingLabel(internalCaseCrossingValue(item));
  const rows: AcreditacionCaseKeyEvidenceRow[] = [];
  const seen = new Set<string>();
  const addRow = (label: string, value: string, tone: AcreditacionCaseKeyEvidenceTone) => {
    const normalizedValue = cleanCaseKeyText(value);
    if (!normalizedValue) return;
    const id = `${normalizeCaseSearch(label)}:${normalizeCaseSearch(normalizedValue)}`;
    if (seen.has(id)) return;
    seen.add(id);
    rows.push({ label, value: normalizedValue, tone });
  };
  if (primaryValue) {
    addRow(primaryLabel, primaryValue, "primary");
  } else {
    rows.push({ label: primaryLabel, value: "Sin llave declarada", tone: "primary" });
  }
  addRow(secondaryLabel, secondaryValue, "secondary");
  addRow("Base / cruce", baseValue, "base");
  return {
    strategyLabel,
    strategyHint: caseKeyStrategyHint(item),
    channelLabel,
    primaryEvidence: rows[0] ? `${rows[0].label}: ${rows[0].value}` : "Sin evidencia primaria",
    secondaryEvidence: rows[1] ? `${rows[1].label}: ${rows[1].value}` : "",
    evidenceRows: rows,
  };
}

type AcreditacionSubsanacionGuideTone = "ready" | "warning" | "blocked" | "done";

function assistedReviewCandidateCountForCase(item: MonitoreoInternalQueryCase) {
  const seen = new Set<string>();
  [...(item.assisted_review?.candidates ?? []), ...(item.assisted_review?.assignment_candidates ?? [])].forEach((candidate) => {
    const id = cleanCaseKeyText(candidate.candidate_id || candidate.case_key || candidate.base_record || candidate.person_label);
    if (id) seen.add(id);
  });
  return seen.size;
}

export function acreditacionSubsanacionCaseGuide(item: MonitoreoInternalQueryCase | null) {
  if (!item) {
    return {
      tone: "warning" as AcreditacionSubsanacionGuideTone,
      badge: "Sin selección",
      title: "Elige un caso accionable",
      detail: "Empieza por una completa o parcial sin cruce; luego revisa llave, evidencia auxiliar y decisión.",
      primaryAction: "Seleccionar caso",
      steps: ["Abrir accionable", "Leer llave por canal", "Decidir con constancia"],
    };
  }
  const trace = caseKeyTraceSummary(item);
  const response = internalCaseResponseStateValue(item);
  const manual = item.assisted_review?.manual_decision ?? null;
  const candidateCount = assistedReviewCandidateCountForCase(item);
  const hasDeclaredKey = !normalizeCaseSearch(trace.primaryEvidence).includes("sin llave declarada");
  if (manual) {
    return {
      tone: "done" as AcreditacionSubsanacionGuideTone,
      badge: "Con constancia",
      title: manual.action === "include_with_caveat" ? "Ya fue incluida con salvedad" : "Ya quedó excluida",
      detail: manual.note || "Revisa la persona asignada y la nota registrada antes de cambiar la decisión.",
      primaryAction: "Auditar decisión registrada",
      steps: ["Revisar persona asignada", "Leer nota", "Mantener trazabilidad"],
    };
  }
  if (caseIsActionableSubsanacion(item)) {
    if (candidateCount > 0) {
      return {
        tone: "ready" as AcreditacionSubsanacionGuideTone,
        badge: `${fmt(candidateCount)} coincidencia${candidateCount === 1 ? "" : "s"}`,
        title: "Puede decidirse con evidencia",
        detail: "Compara la llave del canal con las coincidencias. Si la persona es correcta, confirma e incluye con salvedad; si no, mantenla excluida.",
        primaryAction: "Elegir persona o mantener excluida",
        steps: ["Confirmar llave", "Comparar candidato", "Guardar decisión"],
      };
    }
    if (!hasDeclaredKey && trace.secondaryEvidence) {
      return {
        tone: "warning" as AcreditacionSubsanacionGuideTone,
        badge: "Falta llave",
        title: "Primero identifica con evidencia auxiliar",
        detail: "No hay llave principal declarada. Usa correo, nombre u otra evidencia para buscar a la persona antes de incluirla.",
        primaryAction: "Buscar coincidencia antes de incluir",
        steps: ["Usar correo/nombre", "Buscar en universo", "Decidir con nota"],
      };
    }
    return {
      tone: "warning" as AcreditacionSubsanacionGuideTone,
      badge: caseCountsLabel(item),
      title: "Revisar llave antes de decidir",
      detail: "Hay una respuesta completa o parcial sin cruce, pero no hay coincidencia automática confiable.",
      primaryAction: "Verificar llave o mantener excluida",
      steps: ["Leer llave usada", "Contrastar base", "Guardar constancia"],
    };
  }
  if (response === "refusal") {
    return {
      tone: "blocked" as AcreditacionSubsanacionGuideTone,
      badge: "No accionable",
      title: "No se asigna al universo",
      detail: "Un rechazo sin identificación no debe moverse al avance. Déjalo explicado salvo que exista evidencia externa documentada.",
      primaryAction: "Mantener excluida",
      steps: ["Leer motivo", "Confirmar no identificación", "Dejar constancia"],
    };
  }
  return {
    tone: "blocked" as AcreditacionSubsanacionGuideTone,
    badge: "Explicativo",
    title: "Solo explica la diferencia",
    detail: "Este caso ayuda a entender la brecha, pero no trae una respuesta asignable al avance.",
    primaryAction: "Revisar sin incluir",
    steps: ["Leer estado", "Revisar evidencia", "Mantener fuera del avance"],
  };
}

function casePhoneAction(item: MonitoreoInternalQueryCase) {
  return String(item.phone_audit?.recommended_action || "").trim();
}

function caseNeedsReconciliationReview(item: MonitoreoInternalQueryCase) {
  return (
    caseCountsInAdvance(item) !== true ||
    Number(item.duplicate_count ?? item.duplicate_group_size ?? 0) > 1 ||
    internalCaseResponseStateValue(item) === "partial" ||
    Boolean(casePhoneAction(item)) ||
    Boolean(String(item.issue_type || "").trim())
  );
}

function assistedReviewFlagTruthy(value: unknown) {
  if (typeof value === "boolean") return value;
  return ["1", "true", "t", "yes", "si", "sí"].includes(String(value ?? "").trim().toLowerCase());
}

function assistedCandidateId(candidate: MonitoreoAssistedReviewCandidate) {
  return candidate.candidate_id || candidate.case_key || `${candidate.base_source}:${candidate.base_row}`;
}

function assistedCandidateEvidenceLevel(candidate: MonitoreoAssistedReviewCandidate) {
  const level = normalizeCaseSearch(candidate.evidence_level);
  const matchType = normalizeCaseSearch(candidate.match_type);
  if (level.includes("exact") || matchType.includes("exact")) return "exact";
  if (level.includes("possible") || level.includes("probable") || matchType.includes("similar")) return "possible";
  return "manual";
}

function assistedCandidateEvidenceLabel(candidate: MonitoreoAssistedReviewCandidate) {
  const level = assistedCandidateEvidenceLevel(candidate);
  const matchType = normalizeCaseSearch(candidate.match_type);
  const label = normalizeCaseSearch(candidate.evidence_label);
  if (level === "exact") {
    if ((matchType.includes("email") || label.includes("correo")) && (matchType.includes("code") || label.includes("codigo"))) {
      return "Correo y código exactos";
    }
    if (matchType.includes("email") || label.includes("correo")) return "Correo exacto";
    if (matchType.includes("code") || label.includes("codigo")) return "Código exacto";
    return "Coincidencia exacta";
  }
  if (level === "possible") {
    if (matchType.includes("email") || label.includes("correo")) return "Correo compatible";
    if (matchType.includes("code") || label.includes("codigo")) return "Código compatible";
    return "Coincidencia compatible";
  }
  return "Búsqueda manual";
}

function assistedCandidateEvidenceRank(candidate: MonitoreoAssistedReviewCandidate) {
  const level = assistedCandidateEvidenceLevel(candidate);
  if (level === "exact") return 0;
  if (level === "possible") return 1;
  return 2;
}

function assistedReviewVisible(item: MonitoreoInternalQueryCase) {
  const review = item.assisted_review;
  const issueKey = normalizeCaseSearch(item.issue_type);
  const baseKey = normalizeCaseSearch(item.base_result);
  const reviewableCase = Boolean(
    item.response_id &&
    (
      issueKey === "fuera_base" ||
      issueKey === "fuera base" ||
      issueKey === "sin_llave" ||
      issueKey === "sin llave" ||
      issueKey === "incluido_con_salvedad" ||
      issueKey === "incluido con salvedad" ||
      baseKey.includes("sin cruce") ||
      baseKey.includes("sin llave")
    ),
  );
  return Boolean(
    reviewableCase ||
    review?.manual_decision ||
    assistedReviewFlagTruthy(review?.eligible) ||
    review?.candidates?.length ||
    review?.assignment_candidates?.length ||
    review?.warnings?.length,
  );
}

function assistedReviewDecisionNotes(
  warnings: string[],
  candidates: MonitoreoAssistedReviewCandidate[],
  selectedCandidate: MonitoreoAssistedReviewCandidate | null,
) {
  const notes: Array<{ tone: "info" | "warning"; title: string; detail: string }> = [];
  const add = (note: { tone: "info" | "warning"; title: string; detail: string }) => {
    if (notes.some((item) => item.title === note.title && item.detail === note.detail)) return;
    notes.push(note);
  };
  warnings.forEach((warning) => {
    const key = normalizeCaseSearch(warning);
    if (key.includes("codigo declarado no coincide")) {
      add({
        tone: "warning",
        title: "Código y correo no apuntan igual",
        detail: "Si decides incluir, la nota debe explicar por qué la persona asignada es la correcta.",
      });
      return;
    }
    if (key.includes("correo") || key.includes("compatible")) {
      add({
        tone: "info",
        title: "Evidencia secundaria",
        detail: "Hay una pista de identidad, pero no cuenta hasta asignarla, confirmarla y guardar.",
      });
      return;
    }
    add({ tone: "warning", title: "Revisar antes de decidir", detail: warning });
  });
  if (candidates.some((candidate) => assistedReviewFlagTruthy(candidate.already_effective))) {
    add({
      tone: "warning",
      title: "Ya asignada",
      detail: "La persona detectada tiene otra respuesta reconciliada; este caso no debe sumar avance por sí solo.",
    });
  }
  if (selectedCandidate) {
    const level = assistedCandidateEvidenceLevel(selectedCandidate);
    if (level === "manual") {
      add({ tone: "info", title: "Nota requerida para incluir", detail: "Documenta la evidencia externa antes de guardar." });
    } else if (level === "possible") {
      add({ tone: "info", title: "Nota requerida para incluir", detail: "La evidencia es compatible, no exacta; documenta por qué esta persona es la correcta." });
    }
  }
  return notes;
}

function AcreditacionAssistedReviewBlock({
  item,
  busy,
  onDecision,
}: {
  item: MonitoreoInternalQueryCase;
  busy: boolean;
  onDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
}) {
  const review = item.assisted_review;
  const candidates = useMemo<MonitoreoAssistedReviewCandidate[]>(() => (
    Array.isArray(review?.candidates) ? review.candidates : []
  ), [review?.candidates]);
  const assignmentCandidates = useMemo<MonitoreoAssistedReviewCandidate[]>(() => (
    Array.isArray(review?.assignment_candidates) ? review.assignment_candidates : []
  ), [review?.assignment_candidates]);
  const warnings = useMemo(() => (
    Array.isArray(review?.warnings)
      ? review.warnings.map((warning) => String(warning ?? "")).filter(Boolean)
      : []
  ), [review?.warnings]);
  const manual = review?.manual_decision ?? null;
  const visible = assistedReviewVisible(item);
  const evidenceRows = useMemo(() => {
    const seen = new Set<string>();
    const out: MonitoreoAssistedReviewCandidate[] = [];
    [...candidates, ...assignmentCandidates].forEach((candidate) => {
      const id = assistedCandidateId(candidate);
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push(candidate);
    });
    return out.sort((a, b) => assistedCandidateEvidenceRank(a) - assistedCandidateEvidenceRank(b) ||
      String(a.person_label || a.case_key).localeCompare(String(b.person_label || b.case_key), "es"));
  }, [assignmentCandidates, candidates]);
  const assignmentOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: MonitoreoAssistedReviewCandidate[] = [];
    [...candidates, ...assignmentCandidates].forEach((candidate) => {
      const id = assistedCandidateId(candidate);
      if (!id || seen.has(id) || assistedReviewFlagTruthy(candidate.already_effective)) return;
      seen.add(id);
      out.push(candidate);
    });
    return out.sort((a, b) => String(a.person_label || a.case_key).localeCompare(String(b.person_label || b.case_key), "es"));
  }, [assignmentCandidates, candidates]);
  const candidateKey = candidates.map(assistedCandidateId).join("|");
  const assignmentKey = assignmentCandidates.map(assistedCandidateId).join("|");
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignmentConfirmed, setAssignmentConfirmed] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    setSelectedCandidateId("");
    setAssignmentSearch("");
    setAssignmentConfirmed(false);
    setNote("");
  }, [assignmentKey, candidateKey, item.response_id]);

  if (!visible) return null;

  const platformComplete = normalizeCaseSearch(internalCaseResponseStateLabel(internalCaseResponseStateValue(item))).includes("completa") ||
    normalizeCaseSearch(item.platform_state).includes("completa");
  const platformPartial = internalCaseResponseStateValue(item) === "partial" ||
    normalizeCaseSearch(item.platform_state).includes("parcial");
  const validatableState = platformComplete || platformPartial;
  const selectedCandidate = assignmentOptions.find((candidate) => assistedCandidateId(candidate) === selectedCandidateId) ?? null;
  const selectedEvidenceLevel = selectedCandidate ? assistedCandidateEvidenceLevel(selectedCandidate) : "";
  const contradiction = warnings.some((warning) => normalizeCaseSearch(warning).includes("codigo declarado no coincide"));
  const noteRequired = Boolean(platformPartial || contradiction || (selectedCandidate && selectedEvidenceLevel !== "exact"));
  const assignmentQuery = normalizeCaseSearch(assignmentSearch);
  const candidateMatchesSearch = (candidate: MonitoreoAssistedReviewCandidate) => {
    if (!assignmentQuery) return true;
    const haystack = normalizeCaseSearch([
      candidate.person_label,
      candidate.case_key,
      candidate.base_record,
      candidate.base_source,
      candidate.base_status,
      candidate.current_status,
      candidate.match_label,
      candidate.evidence_label,
      candidate.evidence_level,
      ...(candidate.evidence_fields ?? []),
    ].join(" "));
    return assignmentQuery.split(/\s+/).filter(Boolean).every((token) => haystack.includes(token));
  };
  const visibleEvidenceRows = evidenceRows.slice(0, 5);
  const filteredAssignmentOptions = assignmentOptions.filter(candidateMatchesSearch);
  const visibleAssignmentOptions = filteredAssignmentOptions.slice(0, assignmentQuery ? 12 : 8);
  const unavailableMatches = assignmentQuery
    ? evidenceRows.filter((candidate) => assistedReviewFlagTruthy(candidate.already_effective) && candidateMatchesSearch(candidate))
    : [];
  const selectedCandidatePayloadId = selectedCandidate ? (selectedCandidate.candidate_id || selectedCandidate.case_key || "") : "";
  const includeDisabled = !onDecision || !selectedCandidate || !selectedCandidatePayloadId || !validatableState || busy || !assignmentConfirmed || (noteRequired && !note.trim());
  const keepDisabled = !onDecision || busy || !item.response_id;
  const includeHint = !validatableState
    ? "Solo una respuesta completa o una parcial revisable puede incluirse con salvedad."
    : !selectedCandidate
      ? "Selecciona una persona pendiente del universo para incluir con salvedad."
      : !selectedCandidatePayloadId
        ? "La coincidencia no tiene un identificador guardable."
      : !assignmentConfirmed
        ? "Confirma esta asignación antes de guardar."
      : noteRequired && !note.trim()
          ? platformPartial
            ? "Agrega una nota para documentar por qué la parcial cuenta con validación explícita."
            : "Agrega una nota para documentar la evidencia o contradicción."
          : "";
  const decisionNotes = assistedReviewDecisionNotes(warnings, evidenceRows, selectedCandidate);
  const declaredCode = review?.declared_code || review?.primary_key || item.case_key || "S/D";
  const declaredEmail = review?.declared_email || "S/D";
  const submit = (action: "keep_excluded" | "include_with_caveat") => {
    if (!onDecision || !item.response_id) return;
    if (action === "include_with_caveat" && !selectedCandidate) return;
    onDecision({
      response_id: item.response_id,
      action,
      candidate_id: action === "include_with_caveat" ? selectedCandidatePayloadId : undefined,
      note: note.trim(),
    });
  };

  return (
    <section className="mon-assisted-review mon-acr-assisted-review" aria-label="Revisión asistida del caso">
      <header>
        <span><ShieldAlert size={14} /> Revisión asistida</span>
        {manual ? <em>{manual.action === "include_with_caveat" ? "Incluida con salvedad" : "Excluida"}</em> : <em>Sin decisión</em>}
      </header>
      <div className="mon-assisted-review-evidence">
        <div><dt>Código declarado</dt><dd>{declaredCode}</dd></div>
        <div><dt>Correo declarado</dt><dd>{declaredEmail}</dd></div>
      </div>
      <div className="mon-assisted-evidence-found" aria-label="Evidencia encontrada">
        <span>Evidencia encontrada · no asigna automáticamente</span>
        {visibleEvidenceRows.length ? (
          <div>
            {visibleEvidenceRows.map((candidate) => {
              const alreadyCovered = assistedReviewFlagTruthy(candidate.already_effective);
              return (
                <article key={assistedCandidateId(candidate)} className={alreadyCovered ? "is-covered" : ""}>
                  <strong>{assistedCandidateEvidenceLabel(candidate)}</strong>
                  <small>{[candidate.person_label || candidate.base_record, candidate.case_key || "Sin código oficial"].filter(Boolean).join(" · ")}</small>
                  {alreadyCovered ? <em>Ya asignada</em> : null}
                </article>
              );
            })}
            {evidenceRows.length > visibleEvidenceRows.length ? <small className="mon-assisted-evidence-more">+{fmt(evidenceRows.length - visibleEvidenceRows.length)} coincidencias compatibles.</small> : null}
          </div>
        ) : (
          <p>Sin coincidencia por código o correo.</p>
        )}
      </div>
      {onDecision ? (
        <div className="mon-assisted-assignment" aria-label="Asignación a persona del universo">
          <label>
            <span>Asignación a persona pendiente</span>
            <small>La evidencia orienta; solo se aplica cuando eliges una persona, confirmas y guardas.</small>
            <input
              type="search"
              value={assignmentSearch}
              onChange={(event) => setAssignmentSearch(event.target.value)}
              placeholder="Buscar nombre, código o correo..."
            />
          </label>
          {unavailableMatches.length ? (
            <div className="mon-assisted-assignment-found" aria-label="Resultado encontrado fuera de pendientes">
              <span>Resultado encontrado fuera de pendientes</span>
              {unavailableMatches.slice(0, 4).map((candidate) => (
                <article key={`unavailable-${assistedCandidateId(candidate)}`}>
                  <strong>{candidate.person_label || candidate.base_record || "Persona del universo"}</strong>
                  <small>{[candidate.case_key || "Sin código oficial", "No está en pendientes"].join(" · ")}</small>
                  <em>Ya asignada</em>
                </article>
              ))}
            </div>
          ) : null}
          {assignmentOptions.length ? (
            <div className="mon-assisted-assignment-list">
              {visibleAssignmentOptions.map((candidate) => {
                const id = assistedCandidateId(candidate);
                const selected = id === selectedCandidateId;
                const level = assistedCandidateEvidenceLevel(candidate);
                return (
                  <button
                    key={id}
                    type="button"
                    className={selected ? "is-selected" : ""}
                    aria-pressed={selected}
                    onClick={() => setSelectedCandidateId(id)}
                  >
                    <span>
                      <strong>{candidate.person_label || candidate.base_record || "Persona del universo"}</strong>
                      <small>{[candidate.case_key || "Sin código oficial", candidate.current_status || candidate.base_status || "Pendiente en universo/base", candidate.base_source].filter(Boolean).join(" · ")}</small>
                    </span>
                    <em className={`is-${level}`}>{assistedCandidateEvidenceLabel(candidate)}</em>
                  </button>
                );
              })}
              {filteredAssignmentOptions.length > visibleAssignmentOptions.length ? <small>Mostrando {fmt(visibleAssignmentOptions.length)} de {fmt(filteredAssignmentOptions.length)} personas pendientes.</small> : null}
              {assignmentQuery && !visibleAssignmentOptions.length ? <small>No hay personas pendientes que coincidan con la búsqueda.</small> : null}
            </div>
          ) : (
            <p className="mon-assisted-review-empty">No hay personas pendientes disponibles en el universo de este actor.</p>
          )}
        </div>
      ) : null}
      {selectedCandidate ? (
        <div className="mon-assisted-selected">
          <span>Persona seleccionada</span>
          <strong>{selectedCandidate.person_label || selectedCandidate.base_record || "Persona del universo"}</strong>
          <small>{[selectedCandidate.case_key || "Sin código oficial", item.actor].filter(Boolean).join(" · ")}</small>
          <p>La asignación no se aplica hasta guardar.</p>
        </div>
      ) : null}
      {selectedCandidate ? (
        <label className="mon-assisted-confirm">
          <input
            type="checkbox"
            checked={assignmentConfirmed}
            onChange={(event) => setAssignmentConfirmed(event.target.checked)}
          />
          <span>Confirmo esta asignación. La evidencia por correo/código solo orienta; no decide automáticamente.</span>
        </label>
      ) : null}
      {decisionNotes.length ? (
        <div className="mon-assisted-decision-notes" role="status" aria-label="Lectura para decidir">
          {decisionNotes.map((item) => (
            <article key={`${item.title}-${item.detail}`} className={`is-${item.tone}`}>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </article>
          ))}
        </div>
      ) : null}
      {manual ? (
        <div className="mon-assisted-manual">
          <span>Decisión registrada</span>
          <strong>{manual.action === "include_with_caveat" ? "Incluida con salvedad" : "Mantener excluida"}</strong>
          <small>{[manual.assigned_person_label, manual.assigned_case_key, manual.match_type].filter(Boolean).join(" · ") || "Sin asignación al universo"}</small>
          {manual.note ? <p>{manual.note}</p> : null}
        </div>
      ) : null}
      {onDecision ? (
        <div className="mon-assisted-actions">
          <label>
            <span>Nota</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder={noteRequired ? "Nota requerida para incluir con salvedad" : "Nota opcional"}
            />
          </label>
          <div>
            <button type="button" className="is-keep" disabled={keepDisabled} onClick={() => submit("keep_excluded")}>
              {busy ? <Loader2 size={14} className="pulso-spin" /> : <XCircle size={14} />}
              <span>Mantener excluida</span>
            </button>
            <button type="button" className="is-include" disabled={includeDisabled} onClick={() => submit("include_with_caveat")}>
              {busy ? <Loader2 size={14} className="pulso-spin" /> : <CheckCircle2 size={14} />}
              <span>Incluir con salvedad</span>
            </button>
          </div>
          {includeHint ? <small className="mon-assisted-action-hint">{includeHint}</small> : null}
        </div>
      ) : null}
    </section>
  );
}

function responseCounts(cases: MonitoreoInternalQueryCase[]) {
  return cases.reduce(
    (acc, item) => {
      const response = internalCaseResponseStateValue(item);
      acc.total += 1;
      if (response === "complete") acc.complete += 1;
      else if (response === "partial") acc.partial += 1;
      else if (response === "refusal") acc.refusal += 1;
      else acc.pending += 1;
      if (caseWithoutCrossing(item)) acc.withoutCrossing += 1;
      return acc;
    },
    { total: 0, complete: 0, partial: 0, refusal: 0, pending: 0, withoutCrossing: 0 },
  );
}

function groupedCaseRows(
  cases: MonitoreoInternalQueryCase[],
  groupValue: (item: MonitoreoInternalQueryCase) => string,
  groupLabel: (value: string) => string,
) {
  const groups = new Map<string, MonitoreoInternalQueryCase[]>();
  cases.forEach((item) => {
    const value = groupValue(item) || "Sin dato";
    const bucket = groups.get(value) ?? [];
    bucket.push(item);
    groups.set(value, bucket);
  });
  return Array.from(groups.entries())
    .map(([value, rows]) => {
      const counts = responseCounts(rows);
      return {
        Grupo: groupLabel(value),
        Casos: counts.total,
        Completas: counts.complete,
        Parciales: counts.partial,
        Rechazos: counts.refusal,
        "Sin respuesta": counts.pending,
        "Sin cruce": counts.withoutCrossing,
      };
    })
    .sort((a, b) => Number(b.Casos) - Number(a.Casos) || String(a.Grupo).localeCompare(String(b.Grupo), "es"));
}

function caseAuditRows(cases: MonitoreoInternalQueryCase[]) {
  return cases.filter(caseIsAuditable).map((item) => ({
    Actor: item.actor || "Sin actor",
    Persona: caseDisplayName(item),
    "Estado respuesta": internalCaseResponseStateLabel(internalCaseResponseStateValue(item)),
    "Cuenta avance": caseCountsLabel(item),
    Cruce: internalCaseCrossingLabel(internalCaseCrossingValue(item)),
    Decisión: item.decision || advancementLabel(item.advancement),
    Motivo: item.decision_reason || item.rule || item.issue_type || "Regla estándar",
    "Evidencia primaria": casePrimaryEvidence(item),
    "Evidencia secundaria": caseSecondaryEvidence(item),
    "Acción telefónica": casePhoneAction(item),
    Duplicados: caseDuplicateLabel(item),
    Parcial: casePartialLabel(item),
    "Response ID": item.response_id || "",
  }));
}

function advancementLabel(value: string) {
  if (value === "effective") return "Efectiva";
  if (value === "included_review") return "Incluida auditada";
  if (value === "partial") return "Parcial";
  if (value === "refusal") return "Rechazo";
  if (value === "pending") return "Sin respuesta";
  if (value === "excluded") return "Excluida";
  return value || "Revisión";
}

function AcreditacionCaseFilterChips({
  label,
  value,
  allLabel,
  allCount,
  options,
  onChange,
}: {
  label: string;
  value: string;
  allLabel: string;
  allCount: number;
  options: Array<{ value: string; label: string; count: number }>;
  onChange: (value: string) => void;
}) {
  return (
    <section className="mon-acr-case-chip-filter" aria-label={`Filtro por ${label}`}>
      <span>{label}</span>
      <div>
        <button type="button" className={!value ? "is-active" : ""} aria-pressed={!value} onClick={() => onChange("")}>
          <strong>{allLabel}</strong>
          <em>{fmt(allCount)}</em>
        </button>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={[value === option.value ? "is-active" : "", `is-${option.value}`].filter(Boolean).join(" ")}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            <strong>{option.label}</strong>
            <em>{fmt(option.count)}</em>
          </button>
        ))}
      </div>
    </section>
  );
}

function CaseStatusPill({ value }: { value: string }) {
  return (
    <span className={`mon-acr-status-pill is-${value}`}>
      {internalCaseResponseStateLabel(value)}
    </span>
  );
}

function CaseCrossingPill({ value }: { value: string }) {
  return (
    <span className={`mon-acr-cross-pill is-${value}`}>
      {internalCaseCrossingLabel(value)}
    </span>
  );
}

function AcreditacionCaseDonut({ summary }: { summary: ReturnType<typeof summarizeInternalCases> }) {
  const total = Math.max(1, summary.total);
  const effective = (summary.effective / total) * 360;
  const partial = effective + (summary.partial / total) * 360;
  const refusal = partial + (summary.refusal / total) * 360;
  const style = {
    "--donut-effective": `${effective}deg`,
    "--donut-partial": `${partial}deg`,
    "--donut-refusal": `${refusal}deg`,
  } as CSSProperties;

  return (
    <div className="mon-acr-case-donut" style={style} aria-label={`Resumen de ${fmt(summary.total)} casos`}>
      <div className="mon-acr-case-donut-ring" aria-hidden="true">
        <span>
          <strong>{fmt(summary.effective)}</strong>
          <em>completas</em>
        </span>
      </div>
      <div className="mon-acr-case-donut-caption">
        <span>Respuesta validada</span>
        <strong>{pctFrom(summary.effective, summary.total || 1)}</strong>
      </div>
    </div>
  );
}

function AcreditacionCaseOverview({
  summary,
  allSummary,
  filteredCount,
  totalCount,
}: {
  summary: ReturnType<typeof summarizeInternalCases>;
  allSummary: ReturnType<typeof summarizeInternalCases>;
  filteredCount: number;
  totalCount: number;
}) {
  return (
    <section className="mon-acr-case-overview" aria-label="Resumen de consultas">
      <AcreditacionCaseDonut summary={summary.total ? summary : allSummary} />
      <div className="mon-acr-case-kpis">
        <StatTile label="Casos visibles" value={`${fmt(filteredCount)} / ${fmt(totalCount)}`} tone={filteredCount ? "good" : "neutral"} />
        <StatTile label="Completas" value={fmt(summary.effective)} tone="good" />
        <StatTile label="Parciales" value={fmt(summary.partial)} tone={summary.partial ? "warn" : "neutral"} />
        <StatTile label="Rechazos / sin respuesta" value={`${fmt(summary.refusal)} / ${fmt(summary.pending)}`} tone={summary.refusal || summary.pending ? "warn" : "neutral"} />
      </div>
    </section>
  );
}

function AcreditacionConsultaTabs({
  active,
  counts,
  onChange,
}: {
  active: AcreditacionConsultaTab;
  counts: Record<AcreditacionConsultaTab, number>;
  onChange: (tab: AcreditacionConsultaTab) => void;
}) {
  return (
    <GlidingTabList as="nav" activeKey={active} className="mon-acr-query-tabs" role="tablist" aria-label="Pestañas de consultas internas">
      {ACREDITACION_CONSULTA_TABS.map((tab) => {
        const Icon = tab.icon;
        const selected = active === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            data-gliding-key={tab.key}
            aria-selected={selected}
            className={selected ? "is-active" : ""}
            onClick={() => onChange(tab.key)}
          >
            <Icon size={14} />
            <span>
              <strong>{tab.label}</strong>
              <em>{tab.detail}</em>
            </span>
            <small>{fmt(counts[tab.key])}</small>
          </button>
        );
      })}
    </GlidingTabList>
  );
}

function AcreditacionCrucesView({ cases }: { cases: MonitoreoInternalQueryCase[] }) {
  const crossingRows = groupedCaseRows(cases, internalCaseCrossingValue, internalCaseCrossingLabel);
  const actorRows = groupedCaseRows(cases, (item) => item.actor || "Sin actor", (value) => value);
  const sourceRows = groupedCaseRows(cases, (item) => item.source_label || acreditacionChannelDisplay(item.channel, "Sin fuente"), (value) => value);
  return (
    <div className="mon-acr-insight-grid">
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Cruce por llave</h3>
          <span>{fmt(crossingRows.length)} tipos</span>
        </div>
        <DataTable rows={crossingRows} empty="No hay cruces para los filtros activos." />
      </section>
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Actor y estado</h3>
          <span>{fmt(actorRows.length)} actores</span>
        </div>
        <DataTable rows={actorRows} empty="No hay actores para los filtros activos." />
      </section>
      <section className="mon-profile-panel mon-acr-insight-wide">
        <div className="mon-profile-panel-head">
          <h3>Fuente y respuesta</h3>
          <span>{fmt(sourceRows.length)} fuentes</span>
        </div>
        <DataTable rows={sourceRows} empty="No hay fuentes para los filtros activos." />
      </section>
    </div>
  );
}

function AcreditacionAuditoriaView({
  cases,
  issues,
}: {
  cases: MonitoreoInternalQueryCase[];
  issues: Array<Record<string, unknown>>;
}) {
  const auditRows = caseAuditRows(cases);
  const noCrossing = cases.filter(caseWithoutCrossing).length;
  const duplicates = cases.filter((item) => Number(item.duplicate_count ?? item.duplicate_group_size ?? 0) > 1).length;
  const partials = cases.filter((item) => internalCaseResponseStateValue(item) === "partial").length;
  return (
    <div className="mon-profile-stack">
      <div className="mon-profile-stat-row">
        <StatTile label="Casos auditables" value={fmt(auditRows.length)} tone={auditRows.length ? "warn" : "good"} />
        <StatTile label="Sin cruce" value={fmt(noCrossing)} tone={noCrossing ? "warn" : "good"} />
        <StatTile label="Duplicados" value={fmt(duplicates)} tone={duplicates ? "warn" : "neutral"} />
        <StatTile label="Parciales" value={fmt(partials)} tone={partials ? "warn" : "neutral"} />
      </div>
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Casos que explican diferencias</h3>
          <span>{fmt(auditRows.length)} filas</span>
        </div>
        <DataTable rows={auditRows} empty="No hay casos auditables con los filtros activos." />
      </section>
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Alertas internas</h3>
          <span>{fmt(issues.length)} alertas</span>
        </div>
        <DataTable rows={issues} empty="No hay alertas internas para este corte." />
      </section>
    </div>
  );
}

function AcreditacionReconciliacionView({
  cases,
  busyId = "",
  status = null,
  onDecision,
}: {
  cases: MonitoreoInternalQueryCase[];
  busyId?: string;
  status?: AcreditacionActionStatus;
  onDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
}) {
  const reviewCases = cases.filter(caseNeedsReconciliationReview);
  const assistedCases = cases.filter(assistedReviewVisible);
  const visible = (assistedCases.length ? assistedCases : reviewCases.length ? reviewCases : cases).slice(0, 120);
  const countsAdvance = cases.filter((item) => caseCountsInAdvance(item) === true).length;
  const notCounting = cases.filter((item) => caseCountsInAdvance(item) === false).length;
  const duplicates = cases.filter((item) => Number(item.duplicate_count ?? item.duplicate_group_size ?? 0) > 1).length;
  const phoneActions = cases.filter((item) => Boolean(casePhoneAction(item))).length;
  const visibleTotal = assistedCases.length || reviewCases.length || cases.length;

  return (
    <div className="mon-acr-recon">
      <section className="mon-profile-stat-row" aria-label="Resumen de reconciliación">
        <StatTile label="Cuentan" value={fmt(countsAdvance)} tone={countsAdvance ? "good" : "neutral"} />
        <StatTile label="No cuentan" value={fmt(notCounting)} tone={notCounting ? "warn" : "good"} />
        <StatTile label="Duplicados" value={fmt(duplicates)} tone={duplicates ? "warn" : "good"} />
        <StatTile label="Revisión asistida" value={fmt(assistedCases.length)} tone={assistedCases.length ? "warn" : "neutral"} />
        <StatTile label="Acción tel." value={fmt(phoneActions)} tone={phoneActions ? "warn" : "neutral"} />
      </section>
      {status ? <span className={`mon-acr-model-action-status is-${status.tone}`}>{status.message}</span> : null}

      <section className="mon-profile-panel mon-acr-recon-panel">
        <div className="mon-profile-panel-head">
          <h3>Reconciliación persona · respuesta · barrido</h3>
          <span>{fmt(visible.length)} de {fmt(visibleTotal)} casos</span>
        </div>
        {visible.length ? (
          <div className="mon-acr-recon-table-wrap">
            <table className="mon-acr-recon-table">
              <thead>
                <tr>
                  <th>Persona / código</th>
                  <th>Cuenta</th>
                  <th>Evidencia</th>
                  <th>Teléfono / acción</th>
                  <th>Duplicado y parcial</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const counts = caseCountsInAdvance(item);
                  const phoneAction = casePhoneAction(item);
                  const reviewVisible = assistedReviewVisible(item);
                  const id = caseIdentity(item);
                  return (
                    <Fragment key={id}>
                      <tr className={counts === true ? "is-counting" : counts === false ? "is-not-counting" : "is-review"}>
                        <td>
                          <strong>{caseDisplayName(item)}</strong>
                          <small>{item.actor || "Sin actor"} · {item.case_key || "sin llave"} · {item.response_id || "sin response_id"}</small>
                        </td>
                        <td>
                          <span className={`mon-acr-count-pill ${counts === true ? "is-yes" : counts === false ? "is-no" : "is-review"}`}>
                            {caseCountsLabel(item)}
                          </span>
                          <small>{item.decision || advancementLabel(item.advancement)}</small>
                        </td>
                        <td>
                          <strong>{casePrimaryEvidence(item)}</strong>
                          <small>{caseSecondaryEvidence(item) || internalCaseCrossingLabel(internalCaseCrossingValue(item))}</small>
                        </td>
                        <td>
                          <strong>{phoneAction || item.base_status || acreditacionChannelDisplay(item.channel, "Sin acción telefónica")}</strong>
                          <small>{item.source_label || "Sin fuente"} · {internalQueryCollectorDisplayLabel(item)}</small>
                        </td>
                        <td>
                          <strong>{caseDuplicateLabel(item)}</strong>
                          <small>{casePartialLabel(item) || item.rule || item.issue_type || "Sin parcialidad reportada"}</small>
                        </td>
                      </tr>
                      {reviewVisible ? (
                        <tr className="mon-acr-recon-review-row">
                          <td colSpan={5}>
                            <AcreditacionAssistedReviewBlock
                              item={item}
                              busy={busyId === item.response_id}
                              onDecision={onDecision}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mon-profile-muted">No hay casos de reconciliación para los filtros activos.</p>
        )}
      </section>
    </div>
  );
}

export function acreditacionRowsForConsultaTab(cases: MonitoreoInternalQueryCase[], tab: AcreditacionConsultaTab) {
  if (tab === "plataforma") {
    return cases.filter(caseHasPlatformResponse).sort(comparePlatformCases);
  }
  if (tab === "cruces") {
    return cases.filter(caseHasPlatformResponse).sort((a, b) => (
      Number(caseWithoutCrossing(b)) - Number(caseWithoutCrossing(a)) ||
      Number(b.review_priority ?? 0) - Number(a.review_priority ?? 0) ||
      comparePlatformCases(a, b)
    ));
  }
  if (tab === "subsanacion") {
    return cases.filter(caseIsSubsanacionCandidate).sort((a, b) => (
      Number(caseIsActionableSubsanacion(b)) - Number(caseIsActionableSubsanacion(a)) ||
      Number(assistedReviewVisible(b)) - Number(assistedReviewVisible(a)) ||
      Number(b.review_priority ?? 0) - Number(a.review_priority ?? 0) ||
      comparePlatformCases(a, b)
    ));
  }
  return cases;
}

export function acreditacionConsultaShowsCutStatusStrip(tab: AcreditacionConsultaTab) {
  return tab === "cruces";
}

function acreditacionIssuesForConsultaTab(issues: MonitoreoInternalQueryIssue[], tab: AcreditacionConsultaTab) {
  if (tab === "subsanacion") {
    return issues.filter((issue) => {
      const key = normalizeCaseSearch(issue.issue_type);
      return key.includes("sin llave") || key.includes("fuera base") || key.includes("sin cruce");
    });
  }
  return issues;
}

function acreditacionQueryAnswerCopy(
  tab: AcreditacionConsultaTab,
  summary: ReturnType<typeof summarizeInternalCases>,
  allSummary: ReturnType<typeof summarizeInternalCases>,
  activeFilters: boolean,
) {
  const scope = activeFilters ? "con los filtros activos" : "en este corte";
  if (tab === "plataforma") {
    return {
      icon: QrCode,
      tone: "base",
      heading: "Registros recibidos",
      title: `${formatCaseLabel(summary.total)} de plataforma ${scope}.`,
      detail: "Ordenados por última respuesta, separando estado, actor, hora y cruce con la base.",
    };
  }
  if (tab === "base") {
    return {
      icon: Table2,
      tone: "pending",
      heading: "Estado de la base",
      title: `${formatCaseLabel(summary.total)} del universo ${scope}.`,
      detail: `${fmt(summary.effective)} completas, ${fmt(summary.partial)} parciales, ${fmt(summary.refusal)} rechazos y ${fmt(summary.pending)} sin respuesta.`,
    };
  }
  if (tab === "cruces") {
    return {
      icon: Link2,
      tone: "warning",
      heading: "Cruce y no cruce",
      title: `${formatCaseLabel(summary.total)} explicado${summary.total === 1 ? "" : "s"} ${scope}.`,
      detail: "Cada fila muestra por qué cruzó, por qué no cruzó, si el no cruce es esperable o si requiere subsanación.",
    };
  }
  if (tab === "subsanacion") {
    return {
      icon: ShieldAlert,
      tone: "partial",
      heading: "Subsanación auditada",
      title: `${formatCaseLabel(summary.total)} sin cruce ${scope}.`,
      detail: "Las completas/parciales pueden resolverse con candidato y nota; los rechazos no identificables quedan documentados.",
    };
  }
  return {
    icon: Search,
    tone: "base",
    heading: "Casos, respuesta y cruce",
    title: `${formatCaseLabel(summary.total)} visible${summary.total === 1 ? "" : "s"} de ${formatCaseLabel(allSummary.total)}.`,
    detail: "La tabla separa respuesta de SurveyMonkey, cruce con base/universo y decisión de avance caso por caso.",
  };
}

function caseToneValue(item: MonitoreoInternalQueryCase): "effective" | "partial" | "refusal" | "warning" | "muted" {
  if (item.advancement === "effective") return "effective";
  if (item.advancement === "partial") return "partial";
  if (item.advancement === "refusal") return "refusal";
  if (assistedReviewVisible(item) || caseNeedsReconciliationReview(item)) return "warning";
  return "muted";
}

function platformToneValue(item: MonitoreoInternalQueryCase): "effective" | "partial" | "refusal" | "warning" | "muted" {
  const response = internalCaseResponseStateValue(item);
  if (response === "complete") return "effective";
  if (response === "partial") return "partial";
  if (response === "refusal") return "refusal";
  if (response === "pending") return "muted";
  return "warning";
}

function crossingToneValue(item: MonitoreoInternalQueryCase): "effective" | "partial" | "refusal" | "warning" | "muted" {
  const crossing = internalCaseCrossingValue(item);
  if (crossing === "cruzo_llave" || crossing === "cruzo_correo") return "effective";
  if (crossing === "sin_cruce" || crossing === "sin_llave") return "warning";
  return "muted";
}

function issueToneValue(issue: MonitoreoInternalQueryIssue): "danger" | "warning" | "info" {
  const severity = normalizeCaseSearch(issue.severity);
  if (severity.includes("alta")) return "danger";
  if (severity.includes("media")) return "warning";
  return "info";
}

function caseDimensionRows(
  cases: MonitoreoInternalQueryCase[],
  dimension: "actor" | "source_label" | "channel" | "date",
  label: string,
) {
  const groups = new Map<string, MonitoreoInternalQueryCase[]>();
  cases.forEach((item) => {
    const key = String(item[dimension] || "Sin dato");
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  });
  return Array.from(groups.entries())
    .map(([group, rows]) => {
      const summary = summarizeInternalCases(rows);
      return {
        [label]: group,
        Total: summary.total,
        Efectivas: summary.effective,
        Parciales: summary.partial,
        Rechazos: summary.refusal,
        "Sin respuesta": summary.pending,
      };
    })
    .sort((a, b) => Number(b.Total) - Number(a.Total) || String(a[label]).localeCompare(String(b[label]), "es"));
}

type AcreditacionCaseBreakdownDimension = "actor" | "source" | "channel" | "date" | "collector";

type AcreditacionCaseBreakdownRow = {
  value: string;
  label: string;
  total: number;
  effective: number;
  partial: number;
  refusal: number;
  pending: number;
  review: number;
};

function acreditacionCaseBreakdownValue(item: MonitoreoInternalQueryCase, dimension: AcreditacionCaseBreakdownDimension) {
  if (dimension === "actor") return item.actor || "";
  if (dimension === "source") return caseSourceValue(item);
  if (dimension === "channel") return caseChannelValue(item);
  if (dimension === "date") return item.date || "";
  return caseCollectorValue(item);
}

function acreditacionCaseBreakdownLabel(value: string, dimension: AcreditacionCaseBreakdownDimension) {
  if (!value) return "Sin dato";
  if (dimension === "channel") return acreditacionChannelLabel(value);
  if (dimension === "collector") return internalQueryCollectorDisplayLabel(value);
  return value;
}

function acreditacionCaseBreakdownRows(
  cases: MonitoreoInternalQueryCase[],
  dimension: AcreditacionCaseBreakdownDimension,
): AcreditacionCaseBreakdownRow[] {
  const groups = new Map<string, MonitoreoInternalQueryCase[]>();
  cases.forEach((item) => {
    const value = acreditacionCaseBreakdownValue(item, dimension);
    const key = value || "__missing__";
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  });
  return Array.from(groups.entries())
    .map(([key, rows]) => {
      const value = key === "__missing__" ? "" : key;
      const summary = summarizeInternalCases(rows);
      return {
        value,
        label: acreditacionCaseBreakdownLabel(value, dimension),
        total: summary.total,
        effective: summary.effective,
        partial: summary.partial,
        refusal: summary.refusal,
        pending: summary.pending,
        review: summary.review,
      };
    })
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es"));
}

function acreditacionQueryDonutBackground(segments: Array<{ value: number; color: string }>) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  if (!total) return "conic-gradient(#dbe2ec 0deg 360deg)";
  let start = 0;
  const parts = segments
    .filter((segment) => segment.value > 0)
    .map((segment) => {
      const end = start + (segment.value / total) * 360;
      const part = `${segment.color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
      start = end;
      return part;
    });
  return `conic-gradient(${parts.join(", ")})`;
}

function AcreditacionConsultaStatusStrip({
  reports,
  model,
  officialCases,
  sources = [],
}: {
  reports: MonitoreoAcreditacionReports;
  model: ReturnType<typeof normalizeInternalQueries>;
  officialCases: MonitoreoInternalQueryCase[];
  sources?: MonitoreoSource[];
}) {
  const summary = summarizeInternalCases(officialCases);
  const auditSummary = summarizeInternalCases(model.cases);
  const caseSources = new Set(officialCases.map(caseSourceValue).filter(Boolean));
  const sourceCount = sources.length || caseSources.size || reports.sheets?.length || 0;
  const actors = new Set([...officialCases, ...model.cases].map((item) => item.actor).filter(Boolean)).size;
  const missingKey = model.cases.filter((item) => internalCaseCrossingValue(item) === "sin_llave").length;
  const issueCount = model.issues.reduce((sum, issue) => sum + Number(issue.count || 1), 0);
  return (
    <section className="mon-query-status-strip" aria-label="Estado del corte disponible">
      <header>
        <span>Estado del corte</span>
        <strong>Corte listo para explorar casos</strong>
        <p>{`Corte ${formatDate(reports.generated_at)}. ${fmt(sourceCount)} fuentes · ${formatCaseLabel(officialCases.length)} en universo · ${formatCaseLabel(model.cases.length)} auditables.`}</p>
      </header>
      <div className="mon-query-status-metrics">
        <span className={officialCases.length ? "is-base" : "is-warning"}>
          <Layers3 size={14} />
          <em>Universo</em>
          <strong>{fmt(officialCases.length)}</strong>
          <small>{fmt(actors)} actores</small>
        </span>
        <span className={summary.pending || missingKey ? "is-warning" : "is-ready"}>
          <Search size={14} />
          <em>Casos</em>
          <strong>{fmt(summary.total)}</strong>
          <small>{fmt(summary.pending)} sin respuesta · {fmt(missingKey)} sin llave</small>
        </span>
        <span className={sourceCount ? "is-base" : "is-warning"}>
          <PlugZap size={14} />
          <em>Fuentes</em>
          <strong>{fmt(sourceCount)}</strong>
          <small>{fmt(reports.reference_tabs?.length ?? 0)} pestañas de referencia</small>
        </span>
        <span className={issueCount || auditSummary.duplicates ? "is-warning" : "is-ready"}>
          <ShieldAlert size={14} />
          <em>Alertas</em>
          <strong>{fmt(issueCount)}</strong>
          <small>{fmt(auditSummary.duplicates)} duplicados</small>
        </span>
      </div>
    </section>
  );
}

function AcreditacionQuerySelect({
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string; count: number }>;
  allLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mon-query-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} ({fmt(option.count)})
          </option>
        ))}
      </select>
    </label>
  );
}

function AcreditacionPlatformCapsuleSelect({
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string; count: number }>;
  allLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`mon-acr-platform-filter-pill${value ? " is-active" : ""}`}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {compactSelectLabel(option.label, 34)} ({fmt(option.count)})
          </option>
        ))}
      </select>
    </label>
  );
}

function AcreditacionPlatformFilterCapsules({
  filters,
  actorOptions,
  channelOptions,
  dateOptions,
  sourceOptions,
  collectorOptions,
  responseOptions,
  crossingOptions,
  activeFilters,
  onFilter,
  onClear,
}: {
  filters: AcreditacionCaseFilters;
  actorOptions: Array<{ value: string; label: string; count: number }>;
  channelOptions: Array<{ value: string; label: string; count: number }>;
  dateOptions: Array<{ value: string; label: string; count: number }>;
  sourceOptions: Array<{ value: string; label: string; count: number }>;
  collectorOptions: Array<{ value: string; label: string; count: number }>;
  responseOptions: Array<{ value: string; label: string; count: number }>;
  crossingOptions: Array<{ value: string; label: string; count: number }>;
  activeFilters: boolean;
  onFilter: (patch: Partial<AcreditacionCaseFilters>) => void;
  onClear: () => void;
}) {
  return (
    <div className="mon-acr-platform-filters" aria-label="Filtros de registros en plataforma">
      <label className={`mon-acr-platform-search-pill${filters.search ? " is-active" : ""}`}>
        <Search size={14} />
        <input
          value={filters.search}
          onChange={(event) => onFilter({ search: event.target.value })}
          placeholder="Buscar código, nombre, correo o response_id"
        />
      </label>
      <AcreditacionPlatformCapsuleSelect label="Actor" value={filters.actor} options={actorOptions} allLabel="Todos" onChange={(actor) => onFilter({ actor })} />
      <AcreditacionPlatformCapsuleSelect label="Respuesta" value={filters.response} options={responseOptions} allLabel="Todas" onChange={(response) => onFilter({ response })} />
      <AcreditacionPlatformCapsuleSelect label="Cruce" value={filters.crossing} options={crossingOptions} allLabel="Todos" onChange={(crossing) => onFilter({ crossing })} />
      <AcreditacionPlatformCapsuleSelect label="Fecha" value={filters.date} options={dateOptions} allLabel="Todas" onChange={(date) => onFilter({ date })} />
      <AcreditacionPlatformCapsuleSelect label="Canal" value={filters.channel} options={channelOptions} allLabel="Todos" onChange={(channel) => onFilter({ channel })} />
      <AcreditacionPlatformCapsuleSelect label="Fuente" value={filters.source} options={sourceOptions} allLabel="Todas" onChange={(source) => onFilter({ source })} />
      <AcreditacionPlatformCapsuleSelect label="Recopilador" value={filters.collector} options={collectorOptions} allLabel="Todos" onChange={(collector) => onFilter({ collector })} />
      <button type="button" className="mon-acr-platform-clear-pill" onClick={onClear} disabled={!activeFilters} title="Limpiar filtros">
        <XCircle size={14} />
        <span>Limpiar</span>
      </button>
    </div>
  );
}

function AcreditacionCaseExplorerToolbar({
  summary,
  allSummary,
  filters,
  actorOptions,
  channelOptions,
  dateOptions,
  sourceOptions,
  collectorOptions,
  responseOptions,
  crossingOptions,
  activeFilters,
  onFilter,
  onClear,
}: {
  summary: ReturnType<typeof summarizeInternalCases>;
  allSummary: ReturnType<typeof summarizeInternalCases>;
  filters: AcreditacionCaseFilters;
  actorOptions: Array<{ value: string; label: string; count: number }>;
  channelOptions: Array<{ value: string; label: string; count: number }>;
  dateOptions: Array<{ value: string; label: string; count: number }>;
  sourceOptions: Array<{ value: string; label: string; count: number }>;
  collectorOptions: Array<{ value: string; label: string; count: number }>;
  responseOptions: Array<{ value: string; label: string; count: number }>;
  crossingOptions: Array<{ value: string; label: string; count: number }>;
  activeFilters: boolean;
  onFilter: (patch: Partial<AcreditacionCaseFilters>) => void;
  onClear: () => void;
}) {
  return (
    <header className="mon-case-explorer-toolbar">
      <div className="mon-case-explorer-title">
        <span>Explorador</span>
        <strong><Search size={16} /> Casos del corte</strong>
        <p>{formatCaseLabel(summary.total)} visibles de {formatCaseLabel(allSummary.total)}. Cada fila separa respuesta, cruce con base y decisión de avance.</p>
      </div>
      <div className="mon-case-filterbar" aria-label="Filtros de casos">
        <label className="mon-query-search">
          <Search size={14} />
          <input
            value={filters.search}
            onChange={(event) => onFilter({ search: event.target.value })}
            placeholder="Buscar código, nombre, correo o response_id..."
          />
        </label>
        <AcreditacionQuerySelect label="Actor" value={filters.actor} options={actorOptions} allLabel="Todos" onChange={(actor) => onFilter({ actor })} />
        <AcreditacionQuerySelect label="Fecha" value={filters.date} options={dateOptions} allLabel="Todas" onChange={(date) => onFilter({ date })} />
        <AcreditacionQuerySelect label="Canal" value={filters.channel} options={channelOptions} allLabel="Todos" onChange={(channel) => onFilter({ channel })} />
        <AcreditacionQuerySelect label="Fuente" value={filters.source} options={sourceOptions} allLabel="Todas" onChange={(source) => onFilter({ source })} />
        <AcreditacionQuerySelect label="Recopilador" value={filters.collector} options={collectorOptions} allLabel="Todos" onChange={(collector) => onFilter({ collector })} />
        <AcreditacionQuerySelect label="Respuesta" value={filters.response} options={responseOptions} allLabel="Todas" onChange={(response) => onFilter({ response })} />
        <AcreditacionQuerySelect label="Cruce" value={filters.crossing} options={crossingOptions} allLabel="Todos" onChange={(crossing) => onFilter({ crossing })} />
        <button type="button" onClick={onClear} disabled={!activeFilters} title="Limpiar filtros">
          <XCircle size={14} />
          <span>Limpiar</span>
        </button>
      </div>
    </header>
  );
}

function AcreditacionPendingRiskStrip({
  cases,
  onReview,
}: {
  cases: MonitoreoInternalQueryCase[];
  onReview: () => void;
}) {
  if (!cases.length) return null;
  const actorCounts = cases.reduce<Map<string, number>>((acc, item) => {
    const actor = item.actor || "Sin actor";
    acc.set(actor, (acc.get(actor) ?? 0) + 1);
    return acc;
  }, new Map());
  const actorEntries = Array.from(actorCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));
  const exactCount = cases.reduce((sum, item) => sum + (item.assisted_review?.assignment_candidates ?? []).filter((candidate) => assistedCandidateEvidenceLevel(candidate) === "exact").length, 0);
  const possibleCount = cases.reduce((sum, item) => sum + (item.assisted_review?.assignment_candidates ?? []).filter((candidate) => assistedCandidateEvidenceLevel(candidate) === "possible").length, 0);
  return (
    <section className="mon-pending-risk-strip" aria-label="Pendientes con posible respuesta no reconciliada">
      <span><AlertCircle size={15} /></span>
      <div>
        <strong>{formatCaseLabel(cases.length)} revisables pueden afectar la lista de no respuesta</strong>
        <p>Hay respuestas excluidas o sin llave con correo/código compatible. No cuentan hasta decidirlas con nota.</p>
      </div>
      <ul>
        {actorEntries.slice(0, 3).map(([actor, count]) => (
          <li key={actor}><b>{actor}</b><em>{fmt(count)}</em></li>
        ))}
      </ul>
      <small>{fmt(exactCount)} exactas · {fmt(possibleCount)} similares</small>
      <button type="button" onClick={onReview}>
        Ver casos revisables
      </button>
    </section>
  );
}

function AcreditacionIssueList({
  issues,
  onFilter,
}: {
  issues: MonitoreoInternalQueryIssue[];
  onFilter: (patch: Partial<AcreditacionCaseFilters>) => void;
}) {
  if (!issues.length) {
    return <p className="mon-profile-muted">Sin alertas para esta lectura.</p>;
  }
  return (
    <div className="mon-query-issue-list">
      {issues.slice(0, 24).map((issue, index) => (
        <button
          key={`${issue.issue_type}-${issue.response_id}-${issue.case_key}-${index}`}
          type="button"
          className={`is-${issueToneValue(issue)}`}
          onClick={() => onFilter({
            actor: issue.actor || "",
            search: issue.response_id || issue.case_key || issue.detail || issue.label,
          })}
        >
          <span>
            <strong>{issue.label || issue.issue_type || "Alerta"}</strong>
            <small>{issue.detail || issue.case_key || issue.response_id || "Sin detalle"}</small>
          </span>
          <em>{formatCaseLabel(Number(issue.count || 1))}</em>
        </button>
      ))}
    </div>
  );
}

function AcreditacionTraceStep({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <span>
      <i>{icon}</i>
      <em>{label}</em>
      <strong>{value}</strong>
      <small>{hint}</small>
    </span>
  );
}

function AcreditacionCaseKeyTrace({ item }: { item: MonitoreoInternalQueryCase }) {
  const trace = caseKeyTraceSummary(item);
  return (
    <section className="mon-case-key-trace" aria-label="Llave por canal">
      <header>
        <span><KeyRound size={14} /> Llave por canal</span>
        <strong>{trace.strategyLabel}</strong>
        <em>{trace.channelLabel}</em>
      </header>
      <div className="mon-case-key-evidence">
        {trace.evidenceRows.map((row) => (
          <span key={`${row.label}-${row.value}`} className={`is-${row.tone}`}>
            <em>{row.label}</em>
            <strong>{row.value}</strong>
          </span>
        ))}
      </div>
      <p>{trace.strategyHint}</p>
    </section>
  );
}

function AcreditacionSubsanacionCoach({ item }: { item: MonitoreoInternalQueryCase }) {
  const guide = acreditacionSubsanacionCaseGuide(item);
  return (
    <section className={`mon-acr-subsanacion-coach is-${guide.tone}`} aria-label="Qué hacer ahora">
      <header>
        <span><Target size={14} /> Qué hacer ahora</span>
        <em>{guide.badge}</em>
        <strong>{guide.title}</strong>
        <p>{guide.detail}</p>
      </header>
      <div>
        {guide.steps.map((step, index) => (
          <span key={step}>
            <em>{index + 1}</em>
            <strong>{step}</strong>
          </span>
        ))}
      </div>
      <small><CheckCircle2 size={13} /> {guide.primaryAction}</small>
    </section>
  );
}

function AcreditacionSubsanacionWorkflow({
  actionable,
  explanatory,
  manual,
}: {
  actionable: number;
  explanatory: number;
  manual: number;
}) {
  return (
    <div className="mon-acr-subsanacion-workflow" aria-label="Ruta de decisión de subsanación">
      <span className="is-warning">
        <em>1</em>
        <strong>Prioriza</strong>
        <small>{fmt(actionable)} accionables</small>
      </span>
      <span className="is-base">
        <em>2</em>
        <strong>Comprueba</strong>
        <small>llave y auxiliares</small>
      </span>
      <span className={manual ? "is-effective" : explanatory ? "is-refusal" : "is-base"}>
        <em>3</em>
        <strong>Decide</strong>
        <small>{manual ? `${fmt(manual)} con constancia` : `${fmt(explanatory)} explicativos`}</small>
      </span>
    </div>
  );
}

function AcreditacionCasesTable({
  cases,
  selectedCase,
  onCaseSelect,
}: {
  cases: MonitoreoInternalQueryCase[];
  selectedCase: MonitoreoInternalQueryCase | null;
  onCaseSelect: (item: MonitoreoInternalQueryCase) => void;
}) {
  if (!cases.length) {
    return <p className="mon-profile-muted">No hay casos con los filtros activos.</p>;
  }
  const visible = cases.slice(0, 120);
  const selectedId = selectedCase ? caseIdentity(selectedCase) : "";
  return (
    <div className="mon-query-table-wrap">
      <table className="mon-query-table">
        <colgroup>
          <col className="mon-query-col-case" />
          <col className="mon-query-col-state" />
          <col className="mon-query-col-base" />
          <col className="mon-query-col-response" />
          <col className="mon-query-col-channel" />
        </colgroup>
        <thead>
          <tr>
            <th>Persona / llave</th>
            <th>Estado respuesta</th>
            <th>Cruce</th>
            <th>Respuesta</th>
            <th>Canal / recopilador</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((item) => {
            const id = caseIdentity(item);
            const selected = id === selectedId;
            const responseValue = internalCaseResponseStateValue(item);
            const crossingValue = internalCaseCrossingValue(item);
            return (
              <tr key={id} className={`is-${caseToneValue(item)}${selected ? " is-selected" : ""}`}>
                <td>
                  <button type="button" onClick={() => onCaseSelect(item)}>
                    <strong>{caseDisplayName(item)}</strong>
                    <small>{item.actor || "Sin actor"} · {item.case_key || "sin llave"}</small>
                  </button>
                </td>
                <td>
                  <span className={`mon-query-badge is-${platformToneValue(item)}`}>{internalCaseResponseStateLabel(responseValue)}</span>
                  <small>Avance: {advancementLabel(item.advancement)}</small>
                </td>
                <td>
                  <span className={`mon-query-badge is-${crossingToneValue(item)}`}>{internalCaseCrossingLabel(crossingValue)}</span>
                  <small>{item.base_record || item.base_source || item.base_result || "Sin base"}</small>
                </td>
                <td>
                  <span>{item.response_id || "sin response_id"}</span>
                  <small>{item.date || "sin fecha"} · {item.source_label || "SurveyMonkey"}</small>
                </td>
                <td>
                  <span>{internalQueryCollectorDisplayLabel(item)}</span>
                  <small>{acreditacionChannelDisplay(item.channel)}</small>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {cases.length > visible.length ? (
        <p className="mon-query-table-more">
          Mostrando {fmt(visible.length)} de {fmt(cases.length)} casos. Usa filtros para acotar.
        </p>
      ) : null}
    </div>
  );
}

function AcreditacionCaseDetail({
  item,
  busyId = "",
  onDecision,
  showSubsanacionGuide = false,
}: {
  item: MonitoreoInternalQueryCase | null;
  busyId?: string;
  onDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
  showSubsanacionGuide?: boolean;
}) {
  if (!item) {
    return (
      <aside className="mon-query-detail is-empty" aria-label="Detalle de caso">
        <EmptyPanel title="Selecciona un caso" detail="El detalle muestra base, respuesta, recopilador, regla y decisión." />
      </aside>
    );
  }
  const responseValue = internalCaseResponseStateValue(item);
  const crossingValue = internalCaseCrossingValue(item);
  const showAssisted = assistedReviewVisible(item);
  return (
    <aside className={`mon-query-detail is-${caseToneValue(item)}`} aria-label="Detalle de caso seleccionado">
      <header>
        <span>Ficha 360 del caso · {item.actor || "Sin actor"}</span>
        <strong>{caseDisplayName(item)}</strong>
        <em>{advancementLabel(item.advancement)}</em>
      </header>

      <section className="mon-query-decision-card" aria-label="Explicación de la decisión final">
        <span><CheckCircle2 size={14} /> Decisión final</span>
        <strong>{item.decision || advancementLabel(item.advancement)}</strong>
        <p>{item.decision_reason || item.rule || item.issue_type || "Clasificación construida con la regla estándar del estudio."}</p>
        <div>
          <em>Respuesta: {internalCaseResponseStateLabel(responseValue)}</em>
          <em>Cruce: {internalCaseCrossingLabel(crossingValue)}</em>
          <em>Avance: {advancementLabel(item.advancement)}</em>
          {item.pending_exit ? <em>Sale de pendientes</em> : null}
          {Number(item.duplicate_count ?? item.duplicate_group_size ?? 0) > 1 ? <em>{fmt(item.duplicate_count ?? item.duplicate_group_size)} duplicados</em> : null}
        </div>
      </section>

      {showSubsanacionGuide ? <AcreditacionSubsanacionCoach item={item} /> : null}

      <AcreditacionCaseKeyTrace item={item} />

      {showAssisted ? (
        <AcreditacionAssistedReviewBlock
          item={item}
          busy={busyId === item.response_id}
          onDecision={onDecision}
        />
      ) : null}

      <div className="mon-query-trace-chain" aria-label="Cadena de trazabilidad">
        <AcreditacionTraceStep
          icon={<Layers3 size={14} />}
          label="Universo / base oficial"
          value={item.base_record || item.case_key || "Sin registro en base"}
          hint={`${item.base_source || "Sin fuente"} · ${item.base_status || item.base_result || "Sin estado"}`}
        />
        <AcreditacionTraceStep
          icon={<ClipboardCheck size={14} />}
          label="Respuesta"
          value={item.response_id || "Sin response_id"}
          hint={`${internalCaseResponseStateLabel(responseValue)} · ${item.date || "Sin fecha"}`}
        />
        <AcreditacionTraceStep
          icon={<Route size={14} />}
          label="Canal operativo / recopilador"
          value={internalQueryCollectorDisplayLabel(item)}
          hint={item.channel ? acreditacionChannelDisplay(item.channel) : item.source_label || "Sin canal"}
        />
        <AcreditacionTraceStep
          icon={<SlidersHorizontal size={14} />}
          label="Regla de base"
          value={item.rule || item.issue_type || "Regla estándar"}
          hint={item.decision_reason || "Sin motivo adicional"}
        />
      </div>

      <dl className="mon-query-detail-facts">
        <div><dt>CodPulso / llave</dt><dd>{item.case_key || "Sin llave"}</dd></div>
        <div><dt>Cruce</dt><dd>{internalCaseCrossingLabel(crossingValue)}</dd></div>
        <div><dt>Cuenta avance</dt><dd>{caseCountsLabel(item)}</dd></div>
        <div><dt>Responsable/recopilador</dt><dd>{internalQueryCollectorDisplayLabel(item)}</dd></div>
        <div><dt>Response ID</dt><dd>{item.response_id || "Sin response_id"}</dd></div>
        <div><dt>Fecha y hora</dt><dd>{caseResponseDateTimeLabel(item)}</dd></div>
        <div><dt>Hora respuesta</dt><dd>{caseResponseTimeDetailLabel(item)}</dd></div>
        <div><dt>Duplicados</dt><dd>{Number(item.duplicate_count ?? item.duplicate_group_size ?? 0) > 1 ? fmt(item.duplicate_count ?? item.duplicate_group_size) : "No"}</dd></div>
      </dl>
    </aside>
  );
}

function AcreditacionQueryBreakdownCard({
  title,
  dimension,
  rows,
  icon,
  onSelect,
}: {
  title: string;
  dimension: AcreditacionCaseBreakdownDimension;
  rows: AcreditacionCaseBreakdownRow[];
  icon: ReactNode;
  onSelect: (value: string) => void;
}) {
  const limitedRows = rows.slice(0, 10);
  const totals = rows.reduce((acc, row) => ({
    total: acc.total + row.total,
    effective: acc.effective + row.effective,
    partial: acc.partial + row.partial,
    refusal: acc.refusal + row.refusal,
    pending: acc.pending + row.pending,
    review: acc.review + row.review,
  }), { total: 0, effective: 0, partial: 0, refusal: 0, pending: 0, review: 0 });
  const effectivePct = safePercentValue(totals.effective, totals.total);
  const donutSegments = [
    { value: totals.effective, color: "#168a55" },
    { value: totals.partial, color: "#b97611" },
    { value: totals.refusal, color: "#a61d4f" },
    { value: totals.pending, color: "#7a8796" },
    { value: totals.review, color: "#5f6b7a" },
  ];

  if (!limitedRows.length) {
    return (
      <section className="mon-query-chart-card">
        <header><span>{icon}{title}</span></header>
        <div className="mon-query-breakdown-empty">
          <EmptyPanel title="Sin datos" detail="No hay casos con este filtro." />
        </div>
      </section>
    );
  }

  return (
    <section className="mon-query-chart-card">
      <header>
        <span>{icon}{title}</span>
        <em>{formatCaseLabel(totals.total)}</em>
      </header>
      <div className="mon-query-chart-legend" aria-label="Series del desglose">
        <span className="is-effective">Efectivas</span>
        <span className="is-partial">Parciales</span>
        <span className="is-refusal">Rechazos</span>
        <span>Sin respuesta</span>
        <span className="is-review">Revisión</span>
      </div>
      <div className="mon-query-breakdown">
        <div
          className="mon-query-donut"
          style={{ "--query-donut-bg": acreditacionQueryDonutBackground(donutSegments) } as CSSProperties}
          aria-label={`${formatPercentLabel(effectivePct)} de efectivas`}
        >
          <span>{formatPercentLabel(effectivePct)}</span>
          <em>efectivas</em>
        </div>
        <div className="mon-query-breakdown-table-wrap">
          <table className="mon-query-breakdown-table">
            <thead>
              <tr>
                <th>{title.replace(/^Por\s+/i, "")}</th>
                <th>Total</th>
                <th>Efec.</th>
                <th>Parc.</th>
                <th>Rech.</th>
                <th>Sin resp.</th>
              </tr>
            </thead>
            <tbody>
              {limitedRows.map((row) => (
                <tr key={`${dimension}-${row.value || "sin-dato"}`}>
                  <td>
                    <button
                      type="button"
                      onClick={() => row.value && onSelect(row.value)}
                      disabled={!row.value}
                      title={row.value ? "Filtrar por este valor" : "Sin valor filtrable"}
                    >
                      {row.label}
                    </button>
                  </td>
                  <td>{fmt(row.total)}</td>
                  <td>{fmt(row.effective)}</td>
                  <td>{fmt(row.partial)}</td>
                  <td>{fmt(row.refusal)}</td>
                  <td>{fmt(row.pending)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > limitedRows.length ? (
            <p>{fmt(rows.length - limitedRows.length)} valores adicionales disponibles con filtros.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function AcreditacionDistributionView({
  cases,
  selectedCase,
  onCaseSelect,
  onFilter,
  busyId,
  onDecision,
}: {
  cases: MonitoreoInternalQueryCase[];
  selectedCase: MonitoreoInternalQueryCase | null;
  onCaseSelect: (item: MonitoreoInternalQueryCase) => void;
  onFilter: (patch: Partial<AcreditacionCaseFilters>) => void;
  busyId?: string;
  onDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
}) {
  const byActor = acreditacionCaseBreakdownRows(cases, "actor");
  const bySource = acreditacionCaseBreakdownRows(cases, "source");
  const byChannel = acreditacionCaseBreakdownRows(cases, "channel");
  return (
    <div className="mon-query-grid mon-query-grid--distribution">
      <div className="mon-query-chart-grid">
        <AcreditacionQueryBreakdownCard
          title="Por actor"
          dimension="actor"
          rows={byActor}
          icon={<ContactRound size={15} />}
          onSelect={(actor) => onFilter({ actor })}
        />
        <AcreditacionQueryBreakdownCard
          title="Por fuente/base"
          dimension="source"
          rows={bySource}
          icon={<Layers3 size={15} />}
          onSelect={(source) => onFilter({ source })}
        />
        <AcreditacionQueryBreakdownCard
          title="Por canal"
          dimension="channel"
          rows={byChannel}
          icon={<Route size={15} />}
          onSelect={(channel) => onFilter({ channel })}
        />
      </div>

      <AcreditacionCasesWorkspace
        cases={cases}
        selectedCase={selectedCase}
        onCaseSelect={onCaseSelect}
        title="Casos dentro de la distribución"
        busyId={busyId}
        onDecision={onDecision}
      />
    </div>
  );
}

function AcreditacionEffectivesView({
  cases,
  selectedCase,
  onCaseSelect,
  onFilter,
  busyId,
  onDecision,
}: {
  cases: MonitoreoInternalQueryCase[];
  selectedCase: MonitoreoInternalQueryCase | null;
  onCaseSelect: (item: MonitoreoInternalQueryCase) => void;
  onFilter: (patch: Partial<AcreditacionCaseFilters>) => void;
  busyId?: string;
  onDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
}) {
  const summary = summarizeInternalCases(cases);
  const byDate = acreditacionCaseBreakdownRows(cases, "date");
  const byChannel = acreditacionCaseBreakdownRows(cases, "channel");
  const byCollector = acreditacionCaseBreakdownRows(cases, "collector");
  return (
    <div className="mon-query-grid mon-query-grid--effectives">
      <section className="mon-query-kpi-strip" aria-label="Indicadores de efectivas">
        <span className="is-effective"><em>Efectivas reales</em><strong>{fmt(summary.effective)}</strong><small>completas válidas</small></span>
        <span className="is-partial"><em>Parciales</em><strong>{fmt(summary.partial)}</strong><small>no inflan avance</small></span>
        <span className="is-refusal"><em>Rechazos</em><strong>{fmt(summary.refusal)}</strong><small>consentimiento u otro filtro</small></span>
        <span className="is-warning"><em>Sin respuesta</em><strong>{fmt(summary.pending)}</strong><small>en base</small></span>
      </section>

      <div className="mon-query-chart-grid">
        <AcreditacionQueryBreakdownCard
          title="Por fecha"
          dimension="date"
          rows={byDate}
          icon={<CalendarRange size={15} />}
          onSelect={(date) => onFilter({ date })}
        />
        <AcreditacionQueryBreakdownCard
          title="Por canal"
          dimension="channel"
          rows={byChannel}
          icon={<Route size={15} />}
          onSelect={(channel) => onFilter({ channel })}
        />
        <AcreditacionQueryBreakdownCard
          title="Por recopilador"
          dimension="collector"
          rows={byCollector}
          icon={<QrCode size={15} />}
          onSelect={(collector) => onFilter({ collector })}
        />
      </div>

      <AcreditacionCasesWorkspace
        cases={cases}
        selectedCase={selectedCase}
        onCaseSelect={onCaseSelect}
        title="Casos efectivos"
        busyId={busyId}
        onDecision={onDecision}
      />
    </div>
  );
}

function AcreditacionPendingExitView({
  cases,
  selectedCase,
  onCaseSelect,
  onFilter,
  busyId,
  onDecision,
}: {
  cases: MonitoreoInternalQueryCase[];
  selectedCase: MonitoreoInternalQueryCase | null;
  onCaseSelect: (item: MonitoreoInternalQueryCase) => void;
  onFilter: (patch: Partial<AcreditacionCaseFilters>) => void;
  busyId?: string;
  onDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
}) {
  const visibleSelectedCase = selectedCase && cases.some((item) => caseIdentity(item) === caseIdentity(selectedCase))
    ? selectedCase
    : cases[0] ?? null;
  return (
    <div className="mon-query-grid mon-query-grid--pending">
      <section className={`mon-query-flow-panel${cases.length ? "" : " is-empty-flow"}`} aria-label="Flujo de salida de pendientes">
        <header className="mon-query-section-head">
          <div>
            <span>Faltantes y barrido</span>
            <strong><Route size={16} /> Base operativa → respuesta → avance</strong>
          </div>
          <em>{formatCaseLabel(cases.length)}</em>
        </header>
        {cases.length ? (
          <DataTable
            rows={caseDimensionRows(cases, "actor", "Actor")}
            empty="No hay flujo por actor para este corte."
          />
        ) : (
          <EmptyPanel
            title="Sin flujo disponible"
            detail="No hay casos recuperados desde faltantes o barrido con los filtros activos."
          />
        )}
      </section>
      <AcreditacionCasesWorkspace
        cases={cases}
        selectedCase={visibleSelectedCase}
        onCaseSelect={onCaseSelect}
        title="Casos que salen de pendientes"
        busyId={busyId}
        onDecision={onDecision}
        showDetailWhenEmpty={false}
      />
    </div>
  );
}

function AcreditacionPlatformRecordsView({
  cases,
  allCases,
  selectedCase,
  filters,
  actorOptions,
  channelOptions,
  dateOptions,
  sourceOptions,
  collectorOptions,
  responseOptions,
  crossingOptions,
  activeFilters,
  onCaseSelect,
  onFilter,
  onClear,
  onJumpToSubsanacion,
}: {
  cases: MonitoreoInternalQueryCase[];
  allCases: MonitoreoInternalQueryCase[];
  selectedCase: MonitoreoInternalQueryCase | null;
  filters: AcreditacionCaseFilters;
  actorOptions: Array<{ value: string; label: string; count: number }>;
  channelOptions: Array<{ value: string; label: string; count: number }>;
  dateOptions: Array<{ value: string; label: string; count: number }>;
  sourceOptions: Array<{ value: string; label: string; count: number }>;
  collectorOptions: Array<{ value: string; label: string; count: number }>;
  responseOptions: Array<{ value: string; label: string; count: number }>;
  crossingOptions: Array<{ value: string; label: string; count: number }>;
  activeFilters: boolean;
  onCaseSelect: (item: MonitoreoInternalQueryCase) => void;
  onFilter: (patch: Partial<AcreditacionCaseFilters>) => void;
  onClear: () => void;
  onJumpToSubsanacion: (item: MonitoreoInternalQueryCase) => void;
}) {
  const visible = cases.slice(0, 160);
  const selectedId = selectedCase ? caseIdentity(selectedCase) : "";
  return (
    <div className="mon-acr-platform-grid">
      <section className="mon-query-table-panel mon-acr-platform-table-panel" aria-label="Registros en plataforma">
        <header className="mon-query-section-head">
          <div>
            <span>Registros en plataforma</span>
            <strong><QrCode size={16} /> Respuestas por última actualización</strong>
          </div>
          <em>{fmt(cases.length)} filas</em>
        </header>
        <AcreditacionPlatformFilterCapsules
          filters={filters}
          actorOptions={actorOptions}
          channelOptions={channelOptions}
          dateOptions={dateOptions}
          sourceOptions={sourceOptions}
          collectorOptions={collectorOptions}
          responseOptions={responseOptions}
          crossingOptions={crossingOptions}
          activeFilters={activeFilters}
          onFilter={onFilter}
          onClear={onClear}
        />
        {visible.length ? (
          <div className="mon-query-table-wrap">
            <table className="mon-query-table mon-acr-platform-table">
              <thead>
                <tr>
                  <th>Actor / caso</th>
                  <th>Respuesta</th>
                  <th>Fecha y hora</th>
                  <th>Canal / fuente</th>
                  <th>Cruce</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const id = caseIdentity(item);
                  const selected = id === selectedId;
                  const canOpenSubsanacion = caseIsSubsanacionCandidate(item);
                  const actionLabel = casePlatformActionLabel(item, allCases);
                  const trace = caseKeyTraceSummary(item);
                  return (
                    <tr key={id} className={`is-${caseToneValue(item)}${selected ? " is-selected" : ""}`}>
                      <td>
                        <button type="button" onClick={() => onCaseSelect(item)}>
                          <strong>{caseDisplayName(item)}</strong>
                          <small>{item.actor || "Sin actor"} · {item.case_key || "sin llave"}</small>
                        </button>
                      </td>
                      <td>
                        <CaseStatusPill value={internalCaseResponseStateValue(item)} />
                        <small>{item.response_id || "sin response_id"}</small>
                      </td>
	                      <td>
	                        <span>{caseResponseDateTimeLabel(item)}</span>
	                        <small>{caseResponseTimeDetailLabel(item)}</small>
	                      </td>
                      <td>
                        <span>{acreditacionChannelLabel(item.channel || item.source_label)}</span>
                        <small>{[trace.strategyLabel, item.source_label, internalQueryCollectorDisplayLabel(item)].filter(Boolean).join(" · ")}</small>
                      </td>
                      <td>
                        <CaseCrossingPill value={internalCaseCrossingValue(item)} />
                        <small>{item.base_record || item.base_source || item.base_result || "Sin base"}</small>
                      </td>
                      <td>
                        {canOpenSubsanacion ? (
                          <button type="button" className="mon-acr-table-action" onClick={() => onJumpToSubsanacion(item)}>
                            <ShieldAlert size={13} />
                            <span>{actionLabel}</span>
                          </button>
                        ) : (
                          <span className="mon-acr-action-muted" title={casePlatformActionDetail(item, allCases)}>{actionLabel}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyPanel title="Sin registros de plataforma" detail="No hay respuestas de plataforma con los filtros activos." />
        )}
        {cases.length > visible.length ? <p className="mon-query-table-more">Mostrando {fmt(visible.length)} de {fmt(cases.length)} registros. Usa filtros para acotar.</p> : null}
      </section>
    </div>
  );
}

function AcreditacionBaseStateChips({
  value,
  options,
  allCount,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string; count: number }>;
  allCount: number;
  onChange: (value: string) => void;
}) {
  const ordered = ["complete", "partial", "refusal", "pending"];
  const optionMap = new Map(options.map((option) => [option.value, option]));
  const visibleOptions = ordered
    .map((key) => optionMap.get(key) ?? { value: key, label: internalCaseResponseStateLabel(key), count: 0 });
  return (
    <section className="mon-acr-state-capsules" aria-label="Filtro por estado de respuesta en base">
      <button type="button" className={!value ? "is-active" : ""} aria-pressed={!value} onClick={() => onChange("")}>
        <span>Todos</span>
        <em>{fmt(allCount)}</em>
      </button>
      {visibleOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`${value === option.value ? "is-active " : ""}is-${option.value}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          <span>{option.label}</span>
          <em>{fmt(option.count)}</em>
        </button>
      ))}
    </section>
  );
}

function AcreditacionBaseCapsuleSelect({
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string; count: number }>;
  allLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`mon-acr-base-filter-pill${value ? " is-active" : ""}`}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {compactSelectLabel(option.label, 34)} ({fmt(option.count)})
          </option>
        ))}
      </select>
    </label>
  );
}

function AcreditacionBaseFilterBar({
  filters,
  actorOptions,
  responseOptions,
  responseAllCount,
  activeFilters,
  onFilter,
  onClear,
}: {
  filters: AcreditacionCaseFilters;
  actorOptions: Array<{ value: string; label: string; count: number }>;
  responseOptions: Array<{ value: string; label: string; count: number }>;
  responseAllCount: number;
  activeFilters: boolean;
  onFilter: (patch: Partial<AcreditacionCaseFilters>) => void;
  onClear: () => void;
}) {
  return (
    <div className="mon-acr-base-filters" aria-label="Filtros de estado de la base">
      <label className={`mon-acr-base-search-pill${filters.search ? " is-active" : ""}`}>
        <Search size={14} />
        <input
          value={filters.search}
          onChange={(event) => onFilter({ search: event.target.value })}
          placeholder="Buscar nombre, código o correo en la base"
        />
      </label>
      <AcreditacionBaseCapsuleSelect
        label="Actor"
        value={filters.actor}
        options={actorOptions}
        allLabel="Todos los actores"
        onChange={(actor) => onFilter({ actor })}
      />
      <AcreditacionBaseStateChips
        value={filters.response}
        options={responseOptions}
        allCount={responseAllCount}
        onChange={(response) => onFilter({ response })}
      />
      <button type="button" className="mon-acr-base-clear-pill" onClick={onClear} disabled={!activeFilters} title="Limpiar filtros">
        <XCircle size={14} />
        <span>Limpiar</span>
      </button>
    </div>
  );
}

function AcreditacionBaseStatusView({
  cases,
  selectedCase,
  filters,
  actorOptions,
  responseOptions,
  responseAllCount,
  activeFilters,
  onCaseSelect,
  onFilter,
  onClear,
}: {
  cases: MonitoreoInternalQueryCase[];
  selectedCase: MonitoreoInternalQueryCase | null;
  filters: AcreditacionCaseFilters;
  actorOptions: Array<{ value: string; label: string; count: number }>;
  responseOptions: Array<{ value: string; label: string; count: number }>;
  responseAllCount: number;
  activeFilters: boolean;
  onCaseSelect: (item: MonitoreoInternalQueryCase) => void;
  onFilter: (patch: Partial<AcreditacionCaseFilters>) => void;
  onClear: () => void;
}) {
  const visible = cases;
  const selectedId = selectedCase ? caseIdentity(selectedCase) : "";
  return (
    <div className="mon-acr-base-grid">
      <section className="mon-query-table-panel mon-acr-base-table-panel" aria-label="Estado de la base por actor">
        <header className="mon-query-section-head">
          <div>
            <span>Estado de la base</span>
            <strong><Table2 size={16} /> Universo persona por persona</strong>
          </div>
          <em>{fmt(cases.length)} casos</em>
        </header>
        <AcreditacionBaseFilterBar
          filters={filters}
          actorOptions={actorOptions}
          responseOptions={responseOptions}
          responseAllCount={responseAllCount}
          activeFilters={activeFilters}
          onFilter={onFilter}
          onClear={onClear}
        />
        {visible.length ? (
          <div className="mon-query-table-wrap">
            <table className="mon-query-table mon-acr-base-table">
              <thead>
                <tr>
                  <th>Persona / código</th>
                  <th>Actor</th>
                  <th>Estado respuesta</th>
                  <th>Última respuesta</th>
                  <th>Cruce</th>
                  <th>Avance final</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const id = caseIdentity(item);
                  const selected = id === selectedId;
                  return (
                    <tr key={id} className={`is-${caseToneValue(item)}${selected ? " is-selected" : ""}`}>
                      <td>
                        <button type="button" onClick={() => onCaseSelect(item)}>
                          <strong>{caseDisplayName(item)}</strong>
                          <small>{item.case_key || item.base_record || "sin código"}</small>
                        </button>
                      </td>
                      <td>{item.actor || "Sin actor"}</td>
                      <td><CaseStatusPill value={internalCaseResponseStateValue(item)} /></td>
                      <td>
                        <span>{caseHasPlatformResponse(item) ? caseResponseDateTimeLabel(item) : "Sin respuesta"}</span>
                        <small>{item.response_id || item.base_status || "Pendiente en base"}</small>
                      </td>
                      <td>
                        <CaseCrossingPill value={internalCaseCrossingValue(item)} />
                        <small>{item.base_source || item.base_result || "Sin base"}</small>
                      </td>
                      <td>
                        <span>{advancementLabel(item.advancement)}</span>
                        <small>{caseCountsLabel(item)}</small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyPanel title="Sin casos de base" detail="No hay filas del universo con los filtros activos." />
        )}
      </section>
    </div>
  );
}

function AcreditacionCrossingsView({
  cases,
  selectedCase,
  onCaseSelect,
  onJumpToSubsanacion,
}: {
  cases: MonitoreoInternalQueryCase[];
  selectedCase: MonitoreoInternalQueryCase | null;
  onCaseSelect: (item: MonitoreoInternalQueryCase) => void;
  onJumpToSubsanacion: (item: MonitoreoInternalQueryCase) => void;
}) {
  const visible = cases.slice(0, 160);
  const selectedId = selectedCase ? caseIdentity(selectedCase) : "";
  return (
    <div className="mon-acr-crossing-grid">
      <section className="mon-query-table-panel" aria-label="Cruces efectivos">
        <header className="mon-query-section-head">
          <div>
            <span>Cruces efectivos</span>
            <strong><Link2 size={16} /> Razón de cruce o no cruce</strong>
            <small>Duplicados, diferencias y respuestas fuera de base se leen aquí sin mezclar conteo final con explicación técnica.</small>
          </div>
          <em>{fmt(cases.length)} registros</em>
        </header>
        {visible.length ? (
          <div className="mon-query-table-wrap">
            <table className="mon-query-table mon-acr-crossing-table">
              <thead>
                <tr>
                  <th>Caso</th>
                  <th>Cruce</th>
                  <th>Razón</th>
                  <th>Evidencia</th>
                  <th>Decisión / acción</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const id = caseIdentity(item);
                  const selected = id === selectedId;
                  const explanation = buildCaseCrossingExplanation(item);
                  const canOpenSubsanacion = caseIsSubsanacionCandidate(item);
                  const trace = caseKeyTraceSummary(item);
                  return (
                    <tr key={id} className={`is-${explanation.tone}${selected ? " is-selected" : ""}`}>
                      <td>
                        <button type="button" onClick={() => onCaseSelect(item)}>
                          <strong>{caseDisplayName(item)}</strong>
                          <small>{item.actor || "Sin actor"} · {item.response_id || item.case_key || "sin llave"}</small>
                        </button>
                      </td>
                      <td>
                        <CaseCrossingPill value={internalCaseCrossingValue(item)} />
                        <small>{internalCaseResponseStateLabel(internalCaseResponseStateValue(item))}</small>
                      </td>
                      <td>
                        <strong>{explanation.title}</strong>
                        <small>{explanation.detail}</small>
                      </td>
                      <td>
                        <span>{trace.primaryEvidence}</span>
                        <small>{[trace.strategyLabel, trace.secondaryEvidence || explanation.evidenceDetail].filter(Boolean).join(" · ")}</small>
                      </td>
                      <td>
                        <strong>{explanation.decisionLabel}</strong>
                        <small>{explanation.action}</small>
                        {canOpenSubsanacion ? (
                          <button type="button" className="mon-acr-inline-action" onClick={() => onJumpToSubsanacion(item)}>
                            {caseSubsanacionActionLabel(item)}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyPanel title="Sin registros de plataforma" detail="No hay cruces para los filtros activos." />
        )}
      </section>
      <AcreditacionCaseDetail item={selectedCase} />
    </div>
  );
}

function AcreditacionSubsanacionView({
  cases,
  selectedCase,
  busyId,
  onCaseSelect,
  onDecision,
}: {
  cases: MonitoreoInternalQueryCase[];
  selectedCase: MonitoreoInternalQueryCase | null;
  busyId?: string;
  onCaseSelect: (item: MonitoreoInternalQueryCase) => void;
  onDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
}) {
  const actionable = cases.filter(caseIsActionableSubsanacion);
  const explanatory = cases.filter((item) => !caseIsActionableSubsanacion(item));
  const manual = cases.filter((item) => item.assisted_review?.manual_decision).length;
  const selectedVisible = selectedCase && cases.some((item) => caseIdentity(item) === caseIdentity(selectedCase)) ? selectedCase : cases[0] ?? null;
  return (
    <div className="mon-acr-subsanacion-grid">
      <section className="mon-query-issues-panel" aria-label="Lista de subsanación">
        <header className="mon-query-section-head">
          <div>
            <span>Subsanación</span>
            <strong><ShieldAlert size={16} /> Bandeja de decisión</strong>
            <small>Trabaja primero las completas/parciales sin cruce; cada caso debe terminar incluido con salvedad o explicado.</small>
          </div>
          <em>{fmt(cases.length)} casos</em>
        </header>
        <AcreditacionSubsanacionWorkflow actionable={actionable.length} explanatory={explanatory.length} manual={manual} />
        {cases.length ? (
          <div className="mon-acr-subsanacion-list">
            {[{ title: "Accionables", rows: actionable }, { title: "Explicativos", rows: explanatory }].map((group) => (
              <section key={group.title}>
                <span>{group.title}</span>
                {group.rows.length ? group.rows.slice(0, 80).map((item) => {
                  const selected = selectedVisible && caseIdentity(selectedVisible) === caseIdentity(item);
                  const trace = caseKeyTraceSummary(item);
                  return (
                    <button key={caseIdentity(item)} type="button" className={selected ? "is-active" : ""} onClick={() => onCaseSelect(item)}>
                      <strong>{caseDisplayName(item)}</strong>
                      <small>{item.actor || "Sin actor"} · {caseSubsanacionActionDetail(item)}</small>
                      <span className="mon-acr-subsanacion-key">{trace.strategyLabel} · {trace.primaryEvidence}</span>
                      <em>{caseSubsanacionActionLabel(item)}</em>
                    </button>
                  );
                }) : <p>Sin casos en este grupo.</p>}
              </section>
            ))}
          </div>
        ) : (
          <EmptyPanel title="Sin no cruces" detail="No hay casos sin cruce con los filtros activos." />
        )}
      </section>
      <AcreditacionCaseDetail item={selectedVisible} busyId={busyId} onDecision={onDecision} showSubsanacionGuide />
    </div>
  );
}

function AcreditacionCasesWorkspace({
  cases,
  selectedCase,
  onCaseSelect,
  title = "Casos trazables",
  busyId = "",
  onDecision,
  showDetailWhenEmpty = true,
}: {
  cases: MonitoreoInternalQueryCase[];
  selectedCase: MonitoreoInternalQueryCase | null;
  onCaseSelect: (item: MonitoreoInternalQueryCase) => void;
  title?: string;
  busyId?: string;
  onDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
  showDetailWhenEmpty?: boolean;
}) {
  const showDetail = Boolean(selectedCase || showDetailWhenEmpty);
  return (
    <div className={`mon-query-cases-workspace${showDetail ? "" : " mon-query-cases-workspace--no-detail"}`}>
      <section className="mon-query-table-panel" aria-label={title}>
        <div className="mon-query-table-head-stack">
          <header className="mon-query-section-head">
            <div>
              <span>Detalle local</span>
              <strong><Search size={16} /> {title}</strong>
            </div>
            <em>{fmt(cases.length)} filas</em>
          </header>
        </div>
        <AcreditacionCasesTable cases={cases} selectedCase={selectedCase} onCaseSelect={onCaseSelect} />
      </section>
      {showDetail ? <AcreditacionCaseDetail item={selectedCase} busyId={busyId} onDecision={onDecision} /> : null}
    </div>
  );
}

function AcreditacionConsultaBody({
  activeTab,
  modeCases,
  allModeCases,
  selectedCase,
  filters,
  actorOptions,
  channelOptions,
  dateOptions,
  sourceOptions,
  collectorOptions,
  responseOptions,
  crossingOptions,
  responseAllCount,
  activeFilters,
  onCaseSelect,
  onFilter,
  onClear,
  onJumpToSubsanacion,
  busyId,
  onDecision,
}: {
  activeTab: AcreditacionConsultaTab;
  modeCases: MonitoreoInternalQueryCase[];
  allModeCases: MonitoreoInternalQueryCase[];
  selectedCase: MonitoreoInternalQueryCase | null;
  filters: AcreditacionCaseFilters;
  actorOptions: Array<{ value: string; label: string; count: number }>;
  channelOptions: Array<{ value: string; label: string; count: number }>;
  dateOptions: Array<{ value: string; label: string; count: number }>;
  sourceOptions: Array<{ value: string; label: string; count: number }>;
  collectorOptions: Array<{ value: string; label: string; count: number }>;
  responseOptions: Array<{ value: string; label: string; count: number }>;
  crossingOptions: Array<{ value: string; label: string; count: number }>;
  responseAllCount: number;
  activeFilters: boolean;
  onCaseSelect: (item: MonitoreoInternalQueryCase) => void;
  onFilter: (patch: Partial<AcreditacionCaseFilters>) => void;
  onClear: () => void;
  onJumpToSubsanacion: (item: MonitoreoInternalQueryCase) => void;
  busyId?: string;
  onDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
}) {
  if (activeTab === "base") {
    return (
      <AcreditacionBaseStatusView
        cases={modeCases}
        selectedCase={selectedCase}
        filters={filters}
        actorOptions={actorOptions}
        responseOptions={responseOptions}
        responseAllCount={responseAllCount}
        activeFilters={activeFilters}
        onFilter={onFilter}
        onClear={onClear}
        onCaseSelect={onCaseSelect}
      />
    );
  }
  if (activeTab === "cruces") {
    return (
      <AcreditacionCrossingsView
        cases={modeCases}
        selectedCase={selectedCase}
        onCaseSelect={onCaseSelect}
        onJumpToSubsanacion={onJumpToSubsanacion}
      />
    );
  }
  if (activeTab === "subsanacion") {
    return (
      <AcreditacionSubsanacionView
        cases={modeCases}
        selectedCase={selectedCase}
        onCaseSelect={onCaseSelect}
        busyId={busyId}
        onDecision={onDecision}
      />
    );
  }
  return (
    <AcreditacionPlatformRecordsView
      cases={modeCases}
      allCases={allModeCases}
      selectedCase={selectedCase}
      filters={filters}
      actorOptions={actorOptions}
      channelOptions={channelOptions}
      dateOptions={dateOptions}
      sourceOptions={sourceOptions}
      collectorOptions={collectorOptions}
      responseOptions={responseOptions}
      crossingOptions={crossingOptions}
      activeFilters={activeFilters}
      onCaseSelect={onCaseSelect}
      onFilter={onFilter}
      onClear={onClear}
      onJumpToSubsanacion={onJumpToSubsanacion}
    />
  );
}

function AcreditacionConsultasPanel({
  reports,
  sources = [],
  activeTab: controlledActiveTab,
  onActiveTabChange,
  caseReconciliationBusyId = "",
  caseReconciliationStatus = null,
  onCaseReconciliationDecision,
}: {
  reports: MonitoreoAcreditacionReports;
  sources?: MonitoreoSource[];
  activeTab?: AcreditacionConsultaTab;
  onActiveTabChange?: (tab: AcreditacionConsultaTab) => void;
  caseReconciliationBusyId?: string;
  caseReconciliationStatus?: AcreditacionActionStatus;
  onCaseReconciliationDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
}) {
  const model = useMemo(() => normalizeInternalQueries(reports.internal_queries), [reports.internal_queries]);
  const officialCases = useMemo(() => (
    model.case_rollup?.length ? model.case_rollup : model.cases
  ), [model.case_rollup, model.cases]);
  const [fallbackActiveTab, setFallbackActiveTab] = useState<AcreditacionConsultaTab>("plataforma");
  const setActiveTab = onActiveTabChange ?? setFallbackActiveTab;
  const activeTab = controlledActiveTab ?? fallbackActiveTab;
  const explorerCases = activeTab === "base" ? officialCases : model.cases;
  const [filters, setFilters] = useState<AcreditacionCaseFilters>({ ...EMPTY_CASE_FILTERS });
  const activeCaseFilters = useMemo(() => consultaFiltersForTab(filters, activeTab), [activeTab, filters]);
  const [selectedId, setSelectedId] = useState("");
  const filteredCases = useMemo(() => explorerCases.filter((item) => caseMatchesFilters(item, activeCaseFilters)), [activeCaseFilters, explorerCases]);
  const actorFacetCases = useMemo(() => explorerCases.filter((item) => caseMatchesFilters(item, { ...activeCaseFilters, actor: "" })), [activeCaseFilters, explorerCases]);
  const dateFacetCases = useMemo(() => explorerCases.filter((item) => caseMatchesFilters(item, { ...activeCaseFilters, date: "" })), [activeCaseFilters, explorerCases]);
  const channelFacetCases = useMemo(() => explorerCases.filter((item) => caseMatchesFilters(item, { ...activeCaseFilters, channel: "" })), [activeCaseFilters, explorerCases]);
  const sourceFacetCases = useMemo(() => explorerCases.filter((item) => caseMatchesFilters(item, { ...activeCaseFilters, source: "" })), [activeCaseFilters, explorerCases]);
  const collectorFacetCases = useMemo(() => explorerCases.filter((item) => caseMatchesFilters(item, { ...activeCaseFilters, collector: "" })), [activeCaseFilters, explorerCases]);
  const responseFacetCases = useMemo(() => explorerCases.filter((item) => caseMatchesFilters(item, { ...activeCaseFilters, response: "" })), [activeCaseFilters, explorerCases]);
  const crossingFacetCases = useMemo(() => explorerCases.filter((item) => caseMatchesFilters(item, { ...activeCaseFilters, crossing: "" })), [activeCaseFilters, explorerCases]);
  const actorOptions = useMemo(
    () => countCaseOptions(actorFacetCases, (item) => item.actor),
    [actorFacetCases],
  );
  const channelOptions = useMemo(
    () => countCaseOptions(channelFacetCases, caseChannelValue),
    [channelFacetCases],
  );
  const dateOrder = useMemo(
    () => Array.from(new Set(dateFacetCases.map((item) => item.date).filter(Boolean))).sort(compareInternalQueryDateValues),
    [dateFacetCases],
  );
  const dateOptions = useMemo(
    () => countCaseOptions(dateFacetCases, (item) => item.date, formatInternalQueryDateLabel, dateOrder),
    [dateFacetCases, dateOrder],
  );
  const sourceOptions = useMemo(
    () => countCaseOptions(sourceFacetCases, caseSourceValue),
    [sourceFacetCases],
  );
  const collectorOptions = useMemo(
    () => countCaseOptions(collectorFacetCases, caseCollectorValue, internalQueryCollectorDisplayLabel),
    [collectorFacetCases],
  );
  const responseOptions = useMemo(
    () => countCaseOptions(responseFacetCases, internalCaseResponseStateValue, internalCaseResponseStateLabel, RESPONSE_FILTER_ORDER),
    [responseFacetCases],
  );
  const crossingChipOptions = useMemo(
    () => countCaseOptions(crossingFacetCases, internalCaseCrossingValue, internalCaseCrossingLabel),
    [crossingFacetCases],
  );
  const modeCases = useMemo(() => acreditacionRowsForConsultaTab(filteredCases, activeTab), [activeTab, filteredCases]);
  const allModeCases = useMemo(() => acreditacionRowsForConsultaTab(explorerCases, activeTab), [activeTab, explorerCases]);
  const summary = useMemo(() => summarizeInternalCases(modeCases), [modeCases]);
  const allSummary = useMemo(() => summarizeInternalCases(allModeCases), [allModeCases]);
  const selectedCase = modeCases.find((item) => caseIdentity(item) === selectedId) ?? modeCases[0] ?? null;
  const responseAllCount = responseOptions.reduce((sum, option) => sum + option.count, 0);
  const platformTabFilters = useMemo(() => consultaFiltersForTab(filters, "plataforma"), [filters]);
  const baseTabFilters = useMemo(() => consultaFiltersForTab(filters, "base"), [filters]);
  const filteredPlatformCases = useMemo(
    () => model.cases.filter((item) => caseMatchesFilters(item, platformTabFilters)),
    [model.cases, platformTabFilters],
  );
  const filteredOfficialCases = useMemo(
    () => officialCases.filter((item) => caseMatchesFilters(item, baseTabFilters)),
    [baseTabFilters, officialCases],
  );
  const queryTabCounts = useMemo<Record<AcreditacionConsultaTab, number>>(() => ({
    plataforma: acreditacionRowsForConsultaTab(filteredPlatformCases, "plataforma").length,
    base: filteredOfficialCases.length,
    cruces: acreditacionRowsForConsultaTab(filteredPlatformCases, "cruces").length,
    subsanacion: acreditacionRowsForConsultaTab(filteredPlatformCases, "subsanacion").length,
  }), [filteredOfficialCases.length, filteredPlatformCases]);
  const activeFilters = Object.values(activeCaseFilters).some(Boolean);
  const pendingRiskCases = useMemo(() => (
    filteredPlatformCases.filter((item) => caseIsActionableSubsanacion(item) || assistedReviewVisible(item))
  ), [filteredPlatformCases]);
  const queryAnswer = acreditacionQueryAnswerCopy(activeTab, summary, allSummary, activeFilters);
  const QueryAnswerIcon = queryAnswer.icon;
  const isTableOnlyTab = activeTab === "plataforma" || activeTab === "base";
  const showCutStatusStrip = acreditacionConsultaShowsCutStatusStrip(activeTab);
  const compactStage = !showCutStatusStrip && controlledActiveTab;
  const patchFilters = (patch: Partial<AcreditacionCaseFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setSelectedId("");
  };
  const clearFilters = () => {
    setFilters({ ...EMPTY_CASE_FILTERS });
    setSelectedId("");
  };
  return (
    <div className={`mon-stage mon-stage--consultas mon-acr-cases mon-acr-cases--canonical${compactStage ? " is-no-cut-strip" : ""}`}>
      {showCutStatusStrip ? <AcreditacionConsultaStatusStrip reports={reports} model={model} officialCases={officialCases} sources={sources} /> : null}
      {controlledActiveTab ? null : <AcreditacionConsultaTabs active={activeTab} counts={queryTabCounts} onChange={setActiveTab} />}

      <section className={`mon-case-explorer${isTableOnlyTab ? " is-platform-table-only" : ""}`} aria-label="Explorador de casos del monitoreo">
        {isTableOnlyTab ? null : (
          <section className={`mon-query-answer is-${queryAnswer.tone}`} aria-label="Lectura activa del explorador">
            <span><QueryAnswerIcon size={16} /> {queryAnswer.heading}</span>
            <strong>{queryAnswer.title}</strong>
            <p>{queryAnswer.detail}</p>
          </section>
        )}
        {isTableOnlyTab ? null : (
          <AcreditacionCaseExplorerToolbar
            summary={summary}
            allSummary={allSummary}
            filters={activeCaseFilters}
            actorOptions={actorOptions}
            channelOptions={channelOptions}
            dateOptions={dateOptions}
            sourceOptions={sourceOptions}
            collectorOptions={collectorOptions}
            responseOptions={responseOptions}
            crossingOptions={crossingChipOptions}
            activeFilters={activeFilters}
            onFilter={patchFilters}
            onClear={clearFilters}
          />
        )}
        {isTableOnlyTab && !caseReconciliationStatus ? null : (
          <div className="mon-acr-explorer-meta-row">
            {isTableOnlyTab ? null : (
              <AcreditacionPendingRiskStrip
                cases={pendingRiskCases}
                onReview={() => {
                  setActiveTab("subsanacion");
                  setFilters((current) => ({
                    ...current,
                    actor: "",
                    search: "",
                    crossing: "",
                  }));
                  setSelectedId("");
                }}
              />
            )}
            {caseReconciliationStatus ? (
              <span className={`mon-acr-model-action-status is-${caseReconciliationStatus.tone}`}>
                {caseReconciliationStatus.message}
              </span>
            ) : null}
          </div>
        )}
        <div className="mon-case-explorer-body">
          <AcreditacionConsultaBody
            activeTab={activeTab}
            modeCases={modeCases}
            allModeCases={allModeCases}
            selectedCase={selectedCase}
            filters={activeCaseFilters}
            actorOptions={actorOptions}
            channelOptions={channelOptions}
            dateOptions={dateOptions}
            sourceOptions={sourceOptions}
            collectorOptions={collectorOptions}
            responseOptions={responseOptions}
            crossingOptions={crossingChipOptions}
            responseAllCount={responseAllCount}
            activeFilters={activeFilters}
            onCaseSelect={(item) => setSelectedId(caseIdentity(item))}
            onFilter={patchFilters}
            onClear={clearFilters}
            onJumpToSubsanacion={(item) => {
              setActiveTab("subsanacion");
              setFilters((current) => ({
                ...current,
                actor: item.actor || current.actor,
                crossing: "",
                search: item.response_id || item.case_key || caseDisplayName(item),
              }));
              setSelectedId(caseIdentity(item));
            }}
            busyId={caseReconciliationBusyId}
            onDecision={onCaseReconciliationDecision}
          />
        </div>
      </section>
    </div>
  );
}

export type AcreditacionAdvanceCard = {
  id: string;
  actor: string;
  universe: number;
  effective: number;
  partial: number;
  refusals: number;
  pending: number;
  meta: number | null;
  missing: number | null;
  progress: number | null;
  coverage: number | null;
  statusTone: "complete" | "steady" | "low" | "muted";
};

type AcreditacionActorMechanism = {
  id: string;
  label: string;
  provider: string;
  role: "Universo" | "Barrido" | "Respuestas";
  modality: "base" | "sweep" | "response" | "telefono" | "presencial" | "email";
  observed: number | null;
  channel: string;
};

type AcreditacionActorCard = AcreditacionAdvanceCard & {
  status: string;
  mechanisms: AcreditacionActorMechanism[];
  dailyPoints: AcreditacionAdvanceDailyPoint[];
};

type AcreditacionAdvanceDailyPoint = {
  date: string;
  effective: number;
  partial: number;
  refusals: number;
  total: number;
};

function phoneCodPulsoEffectiveMatchLabel(comparison: Pick<PhonePlatformComparisonTotals, "phoneEffective" | "platformComplete" | "matchedEffective">) {
  const comparableEffective = Math.max(comparison.phoneEffective, comparison.platformComplete);
  return comparableEffective ? `${fmt(comparison.matchedEffective)}/${fmt(comparableEffective)}` : "S/D";
}

type AcreditacionDailyReportCut = {
  date: string;
  label: string;
  isFallback?: boolean;
};

type AcreditacionDailyChartRow = AcreditacionAdvanceDailyPoint & {
  x: number;
  axisLabel: string;
  displayLabel: string;
  dailyTotal: number;
  cumulative: number;
};

type AcreditacionAdvanceDailySeries = {
  id: string;
  label: string;
  actor?: string;
  channel?: string;
  sourceId?: string;
  collectorId?: string;
  collector?: string;
  collectorDisplay?: string;
  points: AcreditacionAdvanceDailyPoint[];
  completed: number;
  partial: number;
  refusals: number;
  total: number;
};

type AcreditacionAdvanceSurveyRow = {
  id: string;
  sourceId: string;
  title: string;
  actor: string;
  channel: string;
  surveyId: string;
  total: number;
  effective: number;
  partial: number;
  refusals: number;
  states: Array<{ label: string; value: number }>;
};

type AcreditacionControlVariableRow = {
  actor: string;
  variable: string;
  value: string;
  universe: number;
  effective: number;
  partial: number;
  refusals: number;
  unanswered: number;
  baseShare: number | null;
  effectiveShare: number | null;
  deltaPp: number | null;
};

function rowText(row: Record<string, unknown>, keys: string[], fallback = "") {
  const normalized = new Map(Object.keys(row).map((key) => [
    key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
    key,
  ]));
  for (const key of keys) {
    const hit = normalized.get(key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
    if (!hit) continue;
    const value = row[hit];
    if (value != null && value !== "") return String(value);
  }
  return fallback;
}

function safePercentValue(value: number | null | undefined, total: number | null | undefined) {
  if (!Number.isFinite(Number(value)) || !Number.isFinite(Number(total)) || Number(total) <= 0) return null;
  return (Number(value) / Number(total)) * 100;
}

function formatMetric(value: number | null | undefined) {
  return fmt(value ?? 0);
}

function formatPercentLabel(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "S/D";
  return `${value.toLocaleString("es-PE", { maximumFractionDigits: 1 })}%`;
}

function formatSignedPp(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "S/D";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("es-PE", { maximumFractionDigits: 1 })} pp`;
}

function normalizeReportMatch(value: unknown) {
  return normalizeSourceMatch(value);
}

function reportBlockForSheet(
  reports: MonitoreoAcreditacionReports | null | undefined,
  sheetId: string,
  blockId?: string,
) {
  const sheetKey = normalizeReportMatch(sheetId);
  const sheet = reports?.sheets.find((item) => normalizeReportMatch(item.id) === sheetKey) ?? null;
  if (!sheet) return null;
  if (!blockId) return sheet.blocks[0] ?? null;
  const blockKey = normalizeReportMatch(blockId);
  return sheet.blocks.find((block) => normalizeReportMatch(block.id) === blockKey) ?? null;
}

function reportBlockColumns(block: MonitoreoReportBlock | null | undefined) {
  if (!block) return [];
  return block.columns.length ? block.columns : Array.from(new Set(block.rows.flatMap((row) => Object.keys(row))));
}

function reportNumberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/%/g, "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function reportPercentValue(value: unknown, column: string) {
  const normalized = normalizeReportMatch(column);
  if (!normalized.includes("avance") && !String(column).includes("%") && !normalized.includes("porcentaje") && !normalized.includes("del total") && !normalized.includes("ratio")) return null;
  if (value == null || value === "") return null;
  const parsed = reportNumberValue(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.abs(parsed) <= 10 ? parsed * 100 : parsed;
}

function reportStateTone(value: string) {
  const normalized = normalizeReportMatch(value);
  if (normalized.includes("alta") || normalized.includes("rechazo") || normalized.includes("riesgo") || normalized.includes("no ")) return "risk";
  if (normalized.includes("media") || normalized.includes("parcial") || normalized.includes("contactar") || normalized.includes("pendiente")) return "warn";
  if (normalized.includes("ok") || normalized.includes("efectiv") || normalized.includes("completa")) return "good";
  return "muted";
}

function advanceGoalForActor(actor: string, goals: MonitoreoGoal[]) {
  const actorKey = normalizeSourceMatch(actor);
  const direct = goals.find((goal) => Object.values(goal.filters ?? {}).some((value) => normalizeSourceMatch(value) === actorKey));
  return direct && Number.isFinite(Number(direct.meta)) ? Number(direct.meta) : null;
}

export function advanceCardsFromRows(rows: Array<Record<string, unknown>>, goals: MonitoreoGoal[] = []): AcreditacionAdvanceCard[] {
  return rows.map((row, index) => {
    const actor = rowText(row, ["Actor", "Unidad", "Corte", "Carrera"], `Actor ${index + 1}`);
    const universe = rowNumber(row, ["Base reportada", "Universo", "Total", "Base", "Casos"], 0);
    const effective = rowNumber(row, ["Efectivas", "Validas", "Válidas", "Completas", "Completed"], 0);
    const partial = rowNumber(row, ["Parciales", "Partial"], 0);
    const refusals = rowNumber(row, ["Rechazo", "Rechazos", "Refusals"], 0);
    const explicitPending = rowNumber(row, ["Sin respuesta", "Pendientes", "Unanswered", "Pending"], NaN);
    const pending = Number.isFinite(explicitPending) ? explicitPending : Math.max(0, universe - effective - partial - refusals);
    const rowMeta = rowNumber(row, ["Meta", "Objetivo", "Meta efectiva", "Target"], NaN);
    const goalMeta = advanceGoalForActor(actor, goals);
    const meta = Number.isFinite(rowMeta) && rowMeta > 0 ? rowMeta : goalMeta;
    const missing = meta != null ? Math.max(0, meta - effective) : null;
    const progress = safePercentValue(effective, universe);
    const coverage = progress;
    const targetProgress = meta != null ? safePercentValue(effective, meta) : null;
    const statusTone: AcreditacionAdvanceCard["statusTone"] = meta == null
      ? "muted"
      : missing === 0
        ? "complete"
        : (targetProgress ?? 0) >= 70
          ? "steady"
          : "low";
    return {
      id: `avance-${normalizeSourceMatch(actor) || index}`,
      actor,
      universe,
      effective,
      partial,
      refusals,
      pending,
      meta,
      missing,
      progress,
      coverage,
      statusTone,
    };
  }).sort((a, b) => {
    const aNeeds = a.meta == null ? 1 : 0;
    const bNeeds = b.meta == null ? 1 : 0;
    return aNeeds - bNeeds || b.effective - a.effective || a.actor.localeCompare(b.actor, "es");
  });
}

function preferredPhoneAdvanceQuotaVariable(rows: AcreditacionPhoneQuotaRow[]) {
  const withMeta = rows.filter((row) => row.meta != null && row.meta > 0);
  const variables = uniqueDisplayValues((withMeta.length ? withMeta : rows).map((row) => row.variable));
  const priority = ["sede", "distrito", "grupo", "segmento", "actor"];
  return variables.find((variable) => priority.includes(normalizeSourceMatch(variable)))
    ?? variables[0]
    ?? "";
}

export function phoneQuotaAdvanceCardsFromRows(rows: Array<Record<string, unknown>>): AcreditacionAdvanceCard[] {
  const quotaRows = phoneQuotaRowsForPanel(rows);
  const variable = preferredPhoneAdvanceQuotaVariable(quotaRows);
  const sourceRows = (variable ? quotaRows.filter((row) => row.variable === variable) : quotaRows)
    .filter((row) => row.meta != null || row.universe > 0);
  return sourceRows.map((row, index) => {
    const meta = row.meta != null ? Math.max(0, Number(row.meta) || 0) : null;
    const missing = meta != null ? Math.max(0, meta - row.effective) : null;
    const targetProgress = meta != null ? safePercentValue(row.effective, meta) : null;
    const coverage = safePercentValue(row.effective, row.universe);
    const statusTone: AcreditacionAdvanceCard["statusTone"] = meta == null
      ? "muted"
      : missing === 0
        ? "complete"
        : (targetProgress ?? 0) >= 70
          ? "steady"
          : "low";
    return {
      id: `phone-quota-${normalizeSourceMatch(row.variable)}-${normalizeSourceMatch(row.value) || index}`,
      actor: row.value,
      universe: row.universe,
      effective: row.effective,
      partial: row.partial,
      refusals: row.refusals,
      pending: row.unswept,
      meta,
      missing,
      progress: targetProgress,
      coverage,
      statusTone,
    };
  }).sort((a, b) => (
    (b.missing ?? -1) - (a.missing ?? -1)
    || b.universe - a.universe
    || a.actor.localeCompare(b.actor, "es", { numeric: true })
  ));
}

function advanceTotals(cards: AcreditacionAdvanceCard[]) {
  return cards.reduce((acc, card) => ({
    universe: acc.universe + card.universe,
    effective: acc.effective + card.effective,
    partial: acc.partial + card.partial,
    refusals: acc.refusals + card.refusals,
    pending: acc.pending + card.pending,
    metas: acc.metas + (card.meta != null ? 1 : 0),
    brechas: acc.brechas + (card.missing != null && card.missing > 0 ? 1 : 0),
  }), { universe: 0, effective: 0, partial: 0, refusals: 0, pending: 0, metas: 0, brechas: 0 });
}

const ACREDITACION_DAILY_NO_DATE_LABEL = "Sin fecha";
const ACREDITACION_DAILY_HEADER_LABELS = new Set(["fecha", "echa", "dia", "día", "date"]);

function isAcreditacionDailyHeaderLabel(value: unknown) {
  const key = normalizeSourceMatch(value);
  return ACREDITACION_DAILY_HEADER_LABELS.has(key);
}

function isAcreditacionNoDateLabel(value: unknown) {
  const key = normalizeSourceMatch(value).replace(/[^a-z0-9]+/g, " ");
  return !key || key === "sin fecha" || key === "s d" || key === "sd";
}

function isDatedAcreditacionDailyPoint(point: AcreditacionAdvanceDailyPoint) {
  return !isAcreditacionNoDateLabel(point.date) && Boolean(parseAcreditacionDailyDate(point.date));
}

function normalizeAcreditacionDailyDateLabel(value: unknown) {
  const text = String(value ?? "").trim();
  return isAcreditacionNoDateLabel(text) ? ACREDITACION_DAILY_NO_DATE_LABEL : text;
}

export function dailyPointsFromRows(rows: Array<Record<string, unknown>>): AcreditacionAdvanceDailyPoint[] {
  return rows.flatMap((row) => {
    const rawDate = rowText(row, ["Fecha", "Dia", "Día", "Date"], "");
    if (isAcreditacionDailyHeaderLabel(rawDate)) return [];
    const date = normalizeAcreditacionDailyDateLabel(rawDate);
    const effective = rowNumber(row, ["Efectivas", "Validas", "Válidas", "Completed"], 0);
    const partial = rowNumber(row, ["Parciales", "Partial"], 0);
    const refusals = rowNumber(row, ["Rechazo", "Rechazos", "Rechazos telefónicos", "Rechazos plataforma", "Refusals"], 0);
    const total = rowNumber(row, ["Total respuestas", "Total", "Respuestas"], effective + partial + refusals);
    return [{ date, effective, partial, refusals, total }];
  });
}

function dailyPointTotals(points: AcreditacionAdvanceDailyPoint[]) {
  return points.reduce((acc, point) => ({
    effective: acc.effective + point.effective,
    partial: acc.partial + point.partial,
    refusals: acc.refusals + point.refusals,
    total: acc.total + point.total,
  }), { effective: 0, partial: 0, refusals: 0, total: 0 });
}

function dailyPointTotalValue(point: AcreditacionAdvanceDailyPoint) {
  return point.total || point.effective + point.partial + point.refusals;
}

function dailyEffectiveValue(point: AcreditacionAdvanceDailyPoint) {
  return point.effective || dailyPointTotalValue(point);
}

function dateOnlyTime(value: Date | null) {
  if (!value) return null;
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function compactAdvanceDateTickLabel(value: string) {
  if (isAcreditacionNoDateLabel(value)) return "S/D";
  const parsed = parseAcreditacionDailyDate(value);
  if (!parsed) return shortAdvanceDateLabel(value);
  const month = parsed.toLocaleDateString("es-PE", { month: "short" }).replace(".", "").toLowerCase();
  return `${month}<br>${String(parsed.getDate()).padStart(2, "0")}`;
}

function mergeAcreditacionDailyPoints(points: AcreditacionAdvanceDailyPoint[]) {
  const byDate = new Map<string, AcreditacionAdvanceDailyPoint>();
  points.forEach((point) => {
    const parsed = parseAcreditacionDailyDate(point.date);
    const key = parsed ? calendarIsoDate(parsed) : point.date;
    const existing = byDate.get(key) ?? { date: key, effective: 0, partial: 0, refusals: 0, total: 0 };
    existing.effective += point.effective;
    existing.partial += point.partial;
    existing.refusals += point.refusals;
    existing.total += dailyPointTotalValue(point);
    byDate.set(key, existing);
  });
  return sortAcreditacionDailyPoints(Array.from(byDate.values()));
}

function expandAcreditacionDailyCalendar(
  points: AcreditacionAdvanceDailyPoint[],
  reportCuts: AcreditacionDailyReportCut[] = [],
) {
  const merged = mergeAcreditacionDailyPoints(points);
  const dated = merged
    .map((point) => ({ point, time: dateOnlyTime(parseAcreditacionDailyDate(point.date)) }))
    .filter((item): item is { point: AcreditacionAdvanceDailyPoint; time: number } => item.time != null);
  if (dated.length < 2) return merged;
  const byTime = new Map(dated.map((item) => [item.time, item.point]));
  const first = dated[0].time;
  const lastData = dated.at(-1)?.time ?? first;
  const cutTimes = reportCuts
    .map((cut) => dateOnlyTime(parseAcreditacionDailyDate(cut.date)))
    .filter((time): time is number => time != null && time >= first && time <= lastData + CALENDAR_DAY_MS);
  const last = Math.max(lastData, ...cutTimes, first);
  const totalDays = Math.round((last - first) / CALENDAR_DAY_MS) + 1;
  if (totalDays <= 1 || totalDays > 180) return merged;
  const expanded: AcreditacionAdvanceDailyPoint[] = [];
  for (let index = 0; index < totalDays; index += 1) {
    const time = first + index * CALENDAR_DAY_MS;
    const existing = byTime.get(time);
    if (existing) {
      expanded.push(existing);
    } else {
      expanded.push({ date: calendarIsoDate(new Date(time)), effective: 0, partial: 0, refusals: 0, total: 0 });
    }
  }
  return expanded;
}

function dailyCutsForChart(
  points: AcreditacionDailyChartRow[],
  reportCuts: AcreditacionDailyReportCut[] = [],
  fallbackCutDate?: string,
) {
  if (!points.length) return [];
  const dated = points
    .map((point) => ({ point, time: dateOnlyTime(parseAcreditacionDailyDate(point.date)) }))
    .filter((item): item is { point: AcreditacionDailyChartRow; time: number } => item.time != null);
  if (!dated.length) return [];
  const cuts = reportCuts.length
    ? reportCuts
    : fallbackCutDate
      ? [{ date: fallbackCutDate, label: "Corte disponible", isFallback: true }]
      : [];
  const seen = new Set<number>();
  return cuts.flatMap((cut) => {
    const cutTime = dateOnlyTime(parseAcreditacionDailyDate(cut.date));
    if (cutTime == null) return [];
    const match = dated.find((item) => item.time >= cutTime) ?? dated.at(-1);
    if (!match || seen.has(match.point.x)) return [];
    seen.add(match.point.x);
    return [{
      ...cut,
      x: match.point.x,
      point: match.point,
      label: cut.label || formatDate(cut.date || match.point.date || ""),
    }];
  });
}

function weeklyCutsForChart(
  points: AcreditacionDailyChartRow[],
  reportWeekday: MonitoreoReportWeekday | "" | null | undefined,
) {
  const weekday = normalizeCalendarReportWeekday(reportWeekday);
  const weekdayIndex = weekday ? CALENDAR_REPORT_WEEKDAY_INDEX.get(weekday) : null;
  if (weekdayIndex == null) return [];
  const label = calendarReportWeekdayLabel(weekday);
  return points.flatMap((point) => {
    const parsed = parseAcreditacionDailyDate(point.date);
    if (!parsed || parsed.getDay() !== weekdayIndex) return [];
    return [{
      date: point.date,
      label,
      isFallback: false,
      x: point.x,
      point,
    }];
  });
}

function sparseDailyChartRows<T extends { x: number }>(rows: T[], minGap: number, maxRows: number) {
  const out: T[] = [];
  rows.sort((a, b) => a.x - b.x).forEach((row) => {
    if (out.length >= maxRows) return;
    if (out.some((item) => Math.abs(item.x - row.x) < minGap)) return;
    out.push(row);
  });
  return out;
}

function acreditacionReportRowValue(row: Record<string, unknown>, candidates: string[]) {
  const normalized = new Map(Object.keys(row).map((key) => [normalizeSourceMatch(key), key]));
  for (const candidate of candidates) {
    const hit = normalized.get(normalizeSourceMatch(candidate));
    if (hit) return row[hit];
  }
  return null;
}

function acreditacionReportColumn(block: MonitoreoReportBlock | null | undefined, candidates: string[]) {
  const wanted = candidates.map(normalizeSourceMatch);
  return reportBlockColumns(block).find((column) => wanted.includes(normalizeSourceMatch(column))) ?? null;
}

function acreditacionReportBlockDateColumns(block: MonitoreoReportBlock | null | undefined) {
  const excluded = new Set([
    "unidad",
    "actor",
    "corte",
    "carrera",
    "canal",
    "modalidad",
    "estado",
    "estatus",
    "total",
    "fecha",
    "dia",
    "día",
    "fuente",
    "source",
    "source_id",
    "source id",
    "id fuente",
    "encuesta",
    "survey_id",
    "survey id",
    "id encuesta",
    "recopilador",
    "collector",
    "collector_id",
    "collector id",
    "id recopilador",
    "tipo recopilador",
    "tipo_recopilador",
    "efectivas",
    "validas",
    "válidas",
    "completas",
    "completed",
    "parciales",
    "partial",
    "rechazo",
    "rechazos",
    "rechazos plataforma",
    "refusals",
    "respuestas",
    "total respuestas",
    "acumulado",
    "avance",
    "porcentaje",
  ]);
  return reportBlockColumns(block).filter((column) => {
    const key = normalizeSourceMatch(column);
    if (!key || excluded.has(key)) return false;
    return /\d/.test(column) || (block?.rows ?? []).some((row) => reportNumberValue(row[column]) > 0);
  });
}

function acreditacionSurveyStateTone(state: string): "completed" | "partial" | "refusals" | "pending" {
  const key = normalizeSourceMatch(state);
  if (key.includes("completa") || key.includes("efectiva") || key.includes("valida")) return "completed";
  if (key.includes("parcial")) return "partial";
  if (key.includes("rechazo") || key.includes("rechaz")) return "refusals";
  return "pending";
}

function parseAcreditacionDailyDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const yearFirst = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (yearFirst) {
    const year = Number(yearFirst[1]);
    const month = Number(yearFirst[2]);
    const day = Number(yearFirst[3]);
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const rawYear = match[3] ? Number(match[3]) : new Date().getFullYear();
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const direct = new Date(text);
  return Number.isNaN(direct.getTime()) ? null : direct;
}

function sortAcreditacionDailyPoints(points: AcreditacionAdvanceDailyPoint[]) {
  return [...points].sort((a, b) => {
    const aDate = parseAcreditacionDailyDate(a.date);
    const bDate = parseAcreditacionDailyDate(b.date);
    if (aDate && bDate) return aDate.getTime() - bDate.getTime();
    if (aDate) return -1;
    if (bDate) return 1;
    return a.date.localeCompare(b.date, "es", { numeric: true });
  });
}

function uniqueNormalizedKeys(values: unknown[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  values.forEach((value) => {
    const key = normalizeSourceMatch(value);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(key);
  });
  return out;
}

function addAcreditacionDailyValue(
  points: Map<string, AcreditacionAdvanceDailyPoint>,
  date: string,
  tone: ReturnType<typeof acreditacionSurveyStateTone>,
  value: number,
) {
  if (!value) return;
  const point = points.get(date) ?? { date, effective: 0, partial: 0, refusals: 0, total: 0 };
  if (tone === "completed") point.effective += value;
  if (tone === "partial") point.partial += value;
  if (tone === "refusals") point.refusals += value;
  point.total += value;
  points.set(date, point);
}

function dailySeriesTotals(points: AcreditacionAdvanceDailyPoint[]) {
  const totals = dailyPointTotals(points);
  return {
    completed: totals.effective,
    partial: totals.partial,
    refusals: totals.refusals,
    total: totals.total,
  };
}

function buildAcreditacionAdvanceDailySeries(
  reports: MonitoreoAcreditacionReports | null | undefined,
  blockId: string,
  groupColumn: string,
  allowedGroups?: Set<string>,
): AcreditacionAdvanceDailySeries[] {
  const block = reportBlockForSheet(reports, "resumen", blockId)
    ?? reportBlockForSheet(reports, "reporte", blockId);
  if (!block) return [];
  const groupCandidates = normalizeSourceMatch(groupColumn) === "unidad"
    ? ["Unidad", "Actor", "Corte", "Carrera"]
    : [groupColumn];
  const groupKey = acreditacionReportColumn(block, groupCandidates);
  if (!groupKey) return [];
  const dates = acreditacionReportBlockDateColumns(block);
  if (!dates.length) return [];
  const grouped = new Map<string, { label: string; points: Map<string, AcreditacionAdvanceDailyPoint> }>();
  block.rows.forEach((row, index) => {
    const label = String(row[groupKey] ?? "").trim() || `${groupColumn} ${index + 1}`;
    const key = normalizeSourceMatch(label) || `${normalizeSourceMatch(groupColumn)}-${index}`;
    if (allowedGroups?.size && !allowedGroups.has(key)) return;
    const state = String(acreditacionReportRowValue(row, ["estado", "estatus"]) ?? "").trim();
    const tone = acreditacionSurveyStateTone(state);
    const entry = grouped.get(key) ?? { label, points: new Map<string, AcreditacionAdvanceDailyPoint>() };
    dates.forEach((date) => addAcreditacionDailyValue(entry.points, date, tone, reportNumberValue(row[date])));
    grouped.set(key, entry);
  });
  return Array.from(grouped.entries()).map(([id, entry]) => {
    const points = sortAcreditacionDailyPoints(Array.from(entry.points.values()))
      .filter((point) => point.total > 0 || point.effective > 0);
    const totals = dailySeriesTotals(points);
    return {
      id,
      label: entry.label,
      points,
      completed: totals.completed,
      partial: totals.partial,
      refusals: totals.refusals,
      total: totals.total,
    };
  }).filter((item) => item.total > 0 || item.completed > 0)
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es"));
}

function buildAcreditacionAdvanceDailySourceSeries(
  reports: MonitoreoAcreditacionReports | null | undefined,
): AcreditacionAdvanceDailySeries[] {
  const block = reportBlockForSheet(reports, "avance_encuesta", "avance_fuente_dia");
  if (!block) return [];
  const dates = acreditacionReportBlockDateColumns(block);
  if (!dates.length) return [];
  const grouped = new Map<string, {
    label: string;
    actor: string;
    channel: string;
    sourceId: string;
    points: Map<string, AcreditacionAdvanceDailyPoint>;
  }>();
  block.rows.forEach((row, index) => {
    const sourceId = String(acreditacionReportRowValue(row, ["source_id", "source id", "id fuente"]) ?? "").trim();
    const label = String(acreditacionReportRowValue(row, ["fuente", "source", "encuesta"]) ?? `Fuente ${index + 1}`).trim() || `Fuente ${index + 1}`;
    const actor = String(acreditacionReportRowValue(row, ["actor", "unidad", "corte", "carrera"]) ?? "").trim();
    const channel = String(acreditacionReportRowValue(row, ["canal", "modalidad", "channel"]) ?? "").trim();
    const key = normalizeSourceMatch(sourceId || label) || `source-${index}`;
    const tone = acreditacionSurveyStateTone(String(acreditacionReportRowValue(row, ["estado", "estatus"]) ?? ""));
    const entry = grouped.get(key) ?? { label, actor, channel, sourceId, points: new Map<string, AcreditacionAdvanceDailyPoint>() };
    dates.forEach((date) => addAcreditacionDailyValue(entry.points, date, tone, reportNumberValue(row[date])));
    grouped.set(key, entry);
  });
  return Array.from(grouped.entries()).map(([id, entry]) => {
    const points = sortAcreditacionDailyPoints(Array.from(entry.points.values()))
      .filter((point) => point.total > 0 || point.effective > 0);
    const totals = dailySeriesTotals(points);
    return {
      id,
      label: entry.label,
      actor: entry.actor,
      channel: entry.channel,
      sourceId: entry.sourceId,
      points,
      completed: totals.completed,
      partial: totals.partial,
      refusals: totals.refusals,
      total: totals.total,
    };
  }).filter((item) => item.total > 0 || item.completed > 0)
    .sort((a, b) => b.total - a.total || (a.actor ?? "").localeCompare(b.actor ?? "", "es") || a.label.localeCompare(b.label, "es"));
}

function buildAcreditacionAdvanceDailyCollectorSeries(
  reports: MonitoreoAcreditacionReports | null | undefined,
): AcreditacionAdvanceDailySeries[] {
  const block = reportBlockForSheet(reports, "avance_encuesta", "avance_recopilador_dia");
  if (!block) return [];
  const dates = acreditacionReportBlockDateColumns(block);
  if (!dates.length) return [];
  const grouped = new Map<string, {
    label: string;
    actor: string;
    channel: string;
    sourceId: string;
    collectorId: string;
    collector: string;
    points: Map<string, AcreditacionAdvanceDailyPoint>;
  }>();
  block.rows.forEach((row, index) => {
    const sourceId = String(acreditacionReportRowValue(row, ["source_id", "source id", "id fuente"]) ?? "").trim();
    const label = String(acreditacionReportRowValue(row, ["fuente", "source", "encuesta"]) ?? `Fuente ${index + 1}`).trim() || `Fuente ${index + 1}`;
    const actor = String(acreditacionReportRowValue(row, ["actor", "unidad", "corte", "carrera"]) ?? "").trim();
    const channel = String(acreditacionReportRowValue(row, ["canal", "modalidad", "channel"]) ?? "").trim();
    const collectorId = String(acreditacionReportRowValue(row, ["collector_id", "collector id", "id recopilador"]) ?? "").trim();
    const collector = String(acreditacionReportRowValue(row, ["recopilador", "collector", "responsable"]) ?? "").trim() || collectorId || "Sin recopilador";
    const sourceKey = normalizeSourceMatch(sourceId || label) || `source-${index}`;
    const collectorKey = normalizeSourceMatch(collectorId || collector) || `collector-${index}`;
    const key = `${sourceKey}\r${collectorKey}`;
    const tone = acreditacionSurveyStateTone(String(acreditacionReportRowValue(row, ["estado", "estatus"]) ?? ""));
    const entry = grouped.get(key) ?? { label, actor, channel, sourceId, collectorId, collector, points: new Map<string, AcreditacionAdvanceDailyPoint>() };
    dates.forEach((date) => addAcreditacionDailyValue(entry.points, date, tone, reportNumberValue(row[date])));
    grouped.set(key, entry);
  });
  return Array.from(grouped.entries()).map(([id, entry]) => {
    const points = sortAcreditacionDailyPoints(Array.from(entry.points.values()))
      .filter((point) => point.total > 0 || point.effective > 0);
    const totals = dailySeriesTotals(points);
    return {
      id,
      label: entry.label,
      actor: entry.actor,
      channel: entry.channel,
      sourceId: entry.sourceId,
      collectorId: entry.collectorId,
      collector: entry.collector,
      points,
      completed: totals.completed,
      partial: totals.partial,
      refusals: totals.refusals,
      total: totals.total,
    };
  }).filter((item) => item.total > 0 || item.completed > 0)
    .sort((a, b) => b.total - a.total || (a.collector ?? "").localeCompare(b.collector ?? "", "es"));
}

function fallbackDailyDateFromRow(row: Record<string, unknown>, index: number) {
  return rowText(row, [
    "Última respuesta",
    "Ultima respuesta",
    "Última efectiva",
    "Ultima efectiva",
    "Primer día",
    "Primer dia",
    "Fecha",
    "Dia",
    "Día",
  ], `Corte ${index + 1}`);
}

function dailyPointFromSummaryRow(row: Record<string, unknown>, index: number): AcreditacionAdvanceDailyPoint {
  const effective = rowNumber(row, ["Efectivas", "Validas", "Válidas", "Completas", "Completed"], 0);
  const partial = rowNumber(row, ["Parciales", "Partial"], 0);
  const refusals = rowNumber(row, ["Rechazos plataforma", "Rechazos", "Rechazo", "Refusals"], 0);
  const explicitTotal = rowNumber(row, ["Total respuestas", "Total", "Respuestas", "Casos"], NaN);
  return {
    date: fallbackDailyDateFromRow(row, index),
    effective,
    partial,
    refusals,
    total: Number.isFinite(explicitTotal) ? explicitTotal : effective + partial + refusals,
  };
}

function buildAcreditacionDailySourceSeriesFromRows(
  rows: Array<Record<string, unknown>> = [],
): AcreditacionAdvanceDailySeries[] {
  const block = {
    id: "source_rows",
    title: "Fuentes por día",
    columns: Array.from(new Set(rows.flatMap((row) => Object.keys(row)))),
    rows: rows as MonitoreoRow[],
  } as MonitoreoReportBlock;
  const dates = acreditacionReportBlockDateColumns(block);
  if (dates.length && rows.some((row) => rowText(row, ["Estado", "Estatus"], ""))) {
    const grouped = new Map<string, {
      label: string;
      actor: string;
      channel: string;
      sourceId: string;
      points: Map<string, AcreditacionAdvanceDailyPoint>;
    }>();
    rows.forEach((row, index) => {
      const sourceId = rowText(row, ["source_id", "source id", "id fuente", "Source ID"], "");
      const label = rowText(row, ["Fuente", "Encuesta", "Source"], `Fuente ${index + 1}`);
      const actor = rowText(row, ["Actor", "Unidad", "Corte", "Carrera"], "");
      const channel = rowText(row, ["Canal", "Modalidad", "Channel"], "");
      const key = normalizeSourceMatch(sourceId || label) || `source-date-${index}`;
      const tone = acreditacionSurveyStateTone(rowText(row, ["Estado", "Estatus"], ""));
      const entry = grouped.get(key) ?? { label, actor, channel, sourceId, points: new Map<string, AcreditacionAdvanceDailyPoint>() };
      dates.forEach((date) => addAcreditacionDailyValue(entry.points, date, tone, reportNumberValue(row[date])));
      grouped.set(key, entry);
    });
    return Array.from(grouped.entries()).map(([id, entry]) => {
      const points = sortAcreditacionDailyPoints(Array.from(entry.points.values()))
        .filter((point) => point.total > 0 || point.effective > 0);
      const totals = dailySeriesTotals(points);
      return {
        id,
        label: entry.label,
        actor: entry.actor,
        channel: entry.channel,
        sourceId: entry.sourceId,
        points,
        completed: totals.completed,
        partial: totals.partial,
        refusals: totals.refusals,
        total: totals.total,
      };
    }).filter((item) => item.total > 0 || item.completed > 0)
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es"));
  }
  const grouped = new Map<string, {
    label: string;
    actor: string;
    channel: string;
    sourceId: string;
    points: AcreditacionAdvanceDailyPoint[];
  }>();
  rows.forEach((row, index) => {
    const sourceId = rowText(row, ["source_id", "source id", "id fuente", "Source ID"], "");
    const label = rowText(row, ["Fuente", "Encuesta", "Source"], `Fuente ${index + 1}`);
    const actor = rowText(row, ["Actor", "Unidad", "Corte", "Carrera"], "");
    const channel = rowText(row, ["Canal", "Modalidad", "Channel"], "");
    const key = normalizeSourceMatch(sourceId || label) || `source-summary-${index}`;
    const entry = grouped.get(key) ?? { label, actor, channel, sourceId, points: [] };
    const point = dailyPointFromSummaryRow(row, index);
    if (point.total > 0 || point.effective > 0) entry.points.push(point);
    grouped.set(key, entry);
  });
  return Array.from(grouped.entries()).map(([id, entry]) => {
    const pointsByDate = new Map<string, AcreditacionAdvanceDailyPoint>();
    entry.points.forEach((point) => {
      const existing = pointsByDate.get(point.date) ?? { date: point.date, effective: 0, partial: 0, refusals: 0, total: 0 };
      existing.effective += point.effective;
      existing.partial += point.partial;
      existing.refusals += point.refusals;
      existing.total += point.total;
      pointsByDate.set(point.date, existing);
    });
    const points = sortAcreditacionDailyPoints(Array.from(pointsByDate.values()));
    const totals = dailySeriesTotals(points);
    return {
      id,
      label: entry.label,
      actor: entry.actor,
      channel: entry.channel,
      sourceId: entry.sourceId,
      points,
      completed: totals.completed,
      partial: totals.partial,
      refusals: totals.refusals,
      total: totals.total,
    };
  }).filter((item) => item.total > 0 || item.completed > 0)
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es"));
}

function buildAcreditacionDailyCollectorSeriesFromRows(
  rows: Array<Record<string, unknown>> = [],
): AcreditacionAdvanceDailySeries[] {
  const block = {
    id: "collector_rows",
    title: "Recopiladores por día",
    columns: Array.from(new Set(rows.flatMap((row) => Object.keys(row)))),
    rows: rows as MonitoreoRow[],
  } as MonitoreoReportBlock;
  const dates = acreditacionReportBlockDateColumns(block);
  if (dates.length && rows.some((row) => rowText(row, ["Estado", "Estatus"], ""))) {
    const grouped = new Map<string, {
      label: string;
      actor: string;
      channel: string;
      sourceId: string;
      collectorId: string;
      collector: string;
      points: Map<string, AcreditacionAdvanceDailyPoint>;
    }>();
    rows.forEach((row, index) => {
      const sourceId = rowText(row, ["source_id", "source id", "id fuente", "Source ID"], "");
      const label = rowText(row, ["Fuente", "Encuesta", "Source"], `Fuente ${index + 1}`);
      const actor = rowText(row, ["Actor", "Unidad", "Corte", "Carrera"], "");
      const channel = rowText(row, ["Canal", "Modalidad", "Channel"], "");
      const collectorId = rowText(row, ["collector_id", "collector id", "id recopilador"], "");
      const collector = rowText(row, ["Recopilador", "Collector", "Responsable"], collectorId || "Sin recopilador");
      const sourceKey = normalizeSourceMatch(sourceId || label) || `source-date-${index}`;
      const collectorKey = normalizeSourceMatch(collectorId || collector) || `collector-date-${index}`;
      const key = `${sourceKey}\r${collectorKey}`;
      const tone = acreditacionSurveyStateTone(rowText(row, ["Estado", "Estatus"], ""));
      const entry = grouped.get(key) ?? { label, actor, channel, sourceId, collectorId, collector, points: new Map<string, AcreditacionAdvanceDailyPoint>() };
      dates.forEach((date) => addAcreditacionDailyValue(entry.points, date, tone, reportNumberValue(row[date])));
      grouped.set(key, entry);
    });
    return Array.from(grouped.entries()).map(([id, entry]) => {
      const points = sortAcreditacionDailyPoints(Array.from(entry.points.values()))
        .filter((point) => point.total > 0 || point.effective > 0);
      const totals = dailySeriesTotals(points);
      return {
        id,
        label: entry.label,
        actor: entry.actor,
        channel: entry.channel,
        sourceId: entry.sourceId,
        collectorId: entry.collectorId,
        collector: entry.collector,
        points,
        completed: totals.completed,
        partial: totals.partial,
        refusals: totals.refusals,
        total: totals.total,
      };
    }).filter((item) => item.total > 0 || item.completed > 0)
      .sort((a, b) => b.total - a.total || (a.collector ?? "").localeCompare(b.collector ?? "", "es"));
  }
  const grouped = new Map<string, {
    label: string;
    actor: string;
    channel: string;
    sourceId: string;
    collectorId: string;
    collector: string;
    points: AcreditacionAdvanceDailyPoint[];
  }>();
  rows.forEach((row, index) => {
    const sourceId = rowText(row, ["source_id", "source id", "id fuente", "Source ID"], "");
    const label = rowText(row, ["Fuente", "Encuesta", "Source"], `Fuente ${index + 1}`);
    const actor = rowText(row, ["Actor", "Unidad", "Corte", "Carrera"], "");
    const channel = rowText(row, ["Canal", "Modalidad", "Channel"], "");
    const collectorId = rowText(row, ["collector_id", "collector id", "id recopilador"], "");
    const collector = rowText(row, ["Recopilador", "Collector", "Responsable"], collectorId || "Sin recopilador");
    const sourceKey = normalizeSourceMatch(sourceId || label) || `source-summary-${index}`;
    const collectorKey = normalizeSourceMatch(collectorId || collector) || `collector-summary-${index}`;
    const key = `${sourceKey}\r${collectorKey}`;
    const entry = grouped.get(key) ?? { label, actor, channel, sourceId, collectorId, collector, points: [] };
    const point = dailyPointFromSummaryRow(row, index);
    if (point.total > 0 || point.effective > 0) entry.points.push(point);
    grouped.set(key, entry);
  });
  return Array.from(grouped.entries()).map(([id, entry]) => {
    const pointsByDate = new Map<string, AcreditacionAdvanceDailyPoint>();
    entry.points.forEach((point) => {
      const existing = pointsByDate.get(point.date) ?? { date: point.date, effective: 0, partial: 0, refusals: 0, total: 0 };
      existing.effective += point.effective;
      existing.partial += point.partial;
      existing.refusals += point.refusals;
      existing.total += point.total;
      pointsByDate.set(point.date, existing);
    });
    const points = sortAcreditacionDailyPoints(Array.from(pointsByDate.values()));
    const totals = dailySeriesTotals(points);
    return {
      id,
      label: entry.label,
      actor: entry.actor,
      channel: entry.channel,
      sourceId: entry.sourceId,
      collectorId: entry.collectorId,
      collector: entry.collector,
      points,
      completed: totals.completed,
      partial: totals.partial,
      refusals: totals.refusals,
      total: totals.total,
    };
  }).filter((item) => item.total > 0 || item.completed > 0)
    .sort((a, b) => b.total - a.total || (a.collector ?? "").localeCompare(b.collector ?? "", "es"));
}

function caseDailyTone(item: MonitoreoInternalQueryCase): ReturnType<typeof acreditacionSurveyStateTone> {
  if (item.advancement === "effective") return "completed";
  if (item.advancement === "partial") return "partial";
  if (item.advancement === "refusal") return "refusals";
  return acreditacionSurveyStateTone(item.platform_state);
}

function buildAcreditacionDailyCollectorSeriesFromInternalQueries(
  reports: MonitoreoAcreditacionReports | null | undefined,
): AcreditacionAdvanceDailySeries[] {
  const cases = normalizeInternalQueries(reports?.internal_queries).cases;
  if (!cases.length) return [];
  const grouped = new Map<string, {
    label: string;
    actor: string;
    channel: string;
    sourceId: string;
    collectorId: string;
    collector: string;
    points: Map<string, AcreditacionAdvanceDailyPoint>;
  }>();
  cases.forEach((item, index) => {
    const sourceId = item.source_id || "";
    const label = item.source_label || sourceId || `Fuente ${index + 1}`;
    const collector = internalQueryCollectorDisplayLabel(item);
    const collectorId = item.collector_id || collector;
    const sourceKey = normalizeSourceMatch(sourceId || label) || `source-case-${index}`;
    const collectorKey = normalizeSourceMatch(collectorId || collector) || `collector-case-${index}`;
    const key = `${sourceKey}\r${collectorKey}`;
    const entry = grouped.get(key) ?? {
      label,
      actor: item.actor || "",
      channel: item.channel || "",
      sourceId,
      collectorId,
      collector,
      points: new Map<string, AcreditacionAdvanceDailyPoint>(),
    };
    addAcreditacionDailyValue(entry.points, item.date || "Sin fecha", caseDailyTone(item), 1);
    grouped.set(key, entry);
  });
  return Array.from(grouped.entries()).map(([id, entry]) => {
    const points = sortAcreditacionDailyPoints(Array.from(entry.points.values()))
      .filter((point) => point.total > 0 || point.effective > 0);
    const totals = dailySeriesTotals(points);
    return {
      id,
      label: entry.label,
      actor: entry.actor,
      channel: entry.channel,
      sourceId: entry.sourceId,
      collectorId: entry.collectorId,
      collector: entry.collector,
      points,
      completed: totals.completed,
      partial: totals.partial,
      refusals: totals.refusals,
      total: totals.total,
    };
  }).filter((item) => item.total > 0 || item.completed > 0)
    .sort((a, b) => b.total - a.total || (a.collector ?? "").localeCompare(b.collector ?? "", "es"));
}

function groupAcreditacionCollectorsBySource(series: AcreditacionAdvanceDailySeries[]) {
  const grouped = new Map<string, AcreditacionAdvanceDailySeries[]>();
  series.forEach((item) => {
    uniqueNormalizedKeys([item.sourceId, item.label]).forEach((key) => {
      const current = grouped.get(key) ?? [];
      current.push(item);
      grouped.set(key, current);
    });
  });
  return grouped;
}

function collectorDisplayLookupKey(sourceKey: string, collectorKey: string) {
  return `${sourceKey}\r${collectorKey}`;
}

function isTechnicalAcreditacionCollectorLabel(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return false;
  const key = normalizeSourceMatch(text);
  return /^\d{6,}$/.test(text)
    || /^[a-f0-9]{10,}$/i.test(text)
    || /^(collector|colector|web|link)[-_]?\d+$/i.test(text)
    || key === "web link"
    || key === "weblink";
}

function acreditacionCollectorDisplayFromRow(row: AcreditacionCollectorRow) {
  return [
    row.alias,
    row.platformName,
    row.saved?.collector_name,
    row.platform?.name,
    row.platform?.collector_name,
  ].map((value) => String(value ?? "").trim())
    .find((value) => value && !isTechnicalAcreditacionCollectorLabel(value)) ?? "";
}

function buildAcreditacionCollectorDisplayIndex(
  sources: MonitoreoSource[],
  linkCollectors: MonitoreoLinkCollector[] = [],
) {
  const index = new Map<string, string>();
  sources.forEach((source) => {
    acreditacionCollectorsForSource(source, linkCollectors).forEach((collector) => {
      const display = acreditacionCollectorDisplayFromRow(collector);
      if (!display) return;
      const sourceKeys = uniqueNormalizedKeys([
        source.id,
        source.survey_id,
        source.label,
        source.survey_title,
        source.dimensions?.survey_title,
        collector.sourceId,
        collector.surveyId,
        collector.sourceName,
      ]);
      const collectorKeys = uniqueNormalizedKeys([
        collector.collectorId,
        collector.alias,
        collector.platformName,
        collector.saved?.collector_name,
        collector.platform?.name,
        collector.platform?.collector_name,
      ]);
      collectorKeys.forEach((collectorKey) => {
        if (!index.has(collectorKey)) index.set(collectorKey, display);
      });
      sourceKeys.forEach((sourceKey) => {
        collectorKeys.forEach((collectorKey) => {
          index.set(collectorDisplayLookupKey(sourceKey, collectorKey), display);
        });
      });
    });
  });
  return index;
}

function resolveAcreditacionCollectorDisplay(
  series: AcreditacionAdvanceDailySeries,
  displayIndex: Map<string, string>,
  index: number,
) {
  const sourceKeys = uniqueNormalizedKeys([series.sourceId, series.label]);
  const collectorKeys = uniqueNormalizedKeys([series.collectorId, series.collector]);
  for (const sourceKey of sourceKeys) {
    for (const collectorKey of collectorKeys) {
      const match = displayIndex.get(collectorDisplayLookupKey(sourceKey, collectorKey));
      if (match) return match;
    }
  }
  for (const collectorKey of collectorKeys) {
    const match = displayIndex.get(collectorKey);
    if (match) return match;
  }
  const raw = String(series.collector ?? "").trim();
  if (raw && !isTechnicalAcreditacionCollectorLabel(raw)) return raw;
  return `Recopilador ${index + 1}`;
}

function applyAcreditacionCollectorDisplayNames(
  series: AcreditacionAdvanceDailySeries[],
  sources: MonitoreoSource[],
  linkCollectors: MonitoreoLinkCollector[] = [],
) {
  const displayIndex = buildAcreditacionCollectorDisplayIndex(sources, linkCollectors);
  return series.map((item, index) => ({
    ...item,
    collectorDisplay: resolveAcreditacionCollectorDisplay(item, displayIndex, index),
  }));
}

function acreditacionCollectorSeriesDisplayName(series: AcreditacionAdvanceDailySeries) {
  return series.collectorDisplay
    || (series.collector && !isTechnicalAcreditacionCollectorLabel(series.collector) ? series.collector : "")
    || "Recopilador";
}

function acreditacionCollectorsForSurvey(
  row: AcreditacionAdvanceSurveyRow,
  grouped: Map<string, AcreditacionAdvanceDailySeries[]>,
) {
  const seen = new Set<string>();
  const out: AcreditacionAdvanceDailySeries[] = [];
  uniqueNormalizedKeys([row.sourceId, row.title, row.surveyId]).forEach((key) => {
    (grouped.get(key) ?? []).forEach((item) => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      out.push(item);
    });
  });
  return out;
}

function actorStatusLabel(card: AcreditacionAdvanceCard) {
  if (card.meta == null) return "Meta pendiente";
  if (card.statusTone === "complete") return "Meta cubierta";
  if (card.statusTone === "steady") return "En ruta";
  return "Requiere impulso";
}

function actorGoalSummary(cards: AcreditacionAdvanceCard[]) {
  const configured = cards.filter((card) => card.meta != null);
  const complete = configured.filter((card) => (card.missing ?? 0) <= 0).length;
  const gaps = configured.filter((card) => (card.missing ?? 0) > 0);
  const totalGap = gaps.reduce((sum, card) => sum + (card.missing ?? 0), 0);
  return {
    configured: configured.length,
    complete,
    gaps: gaps.length,
    totalGap,
    missingMeta: Math.max(0, cards.length - configured.length),
  };
}

function actorGoalValue(summary: ReturnType<typeof actorGoalSummary>) {
  return summary.configured ? `${fmt(summary.complete)}/${fmt(summary.configured)}` : "S/M";
}

function actorGoalHint(summary: ReturnType<typeof actorGoalSummary>) {
  if (!summary.configured) return "metas pendientes";
  if (summary.gaps) return `${fmt(summary.gaps)} con brecha · ${fmt(summary.totalGap)} faltan`;
  if (summary.missingMeta) return `${fmt(summary.missingMeta)} sin meta`;
  return "metas cubiertas";
}

function actorGoalTone(summary: ReturnType<typeof actorGoalSummary>): "base" | "target" | "ready" | "warning" {
  if (!summary.configured) return "target";
  return summary.gaps ? "warning" : "ready";
}

function sourceRoleForActor(source: MonitoreoSource) {
  const role = normalizeSourceMatch(source.role);
  const label = normalizeSourceMatch(source.label);
  if (role.includes("universo") || role.includes("base")) return "Universo";
  if (role.includes("barrido") || label.includes("barrido") || label.includes("telefon")) return "Barrido";
  return "Respuestas";
}

function sourceModalityForActor(source: MonitoreoSource): AcreditacionActorMechanism["modality"] {
  const role = sourceRoleForActor(source);
  const channel = normalizeSourceMatch(sourceChannelLabel(source));
  const label = normalizeSourceMatch(source.label);
  if (role === "Universo") return "base";
  if (role === "Barrido") return "sweep";
  if (channel.includes("telefono") || channel.includes("whatsapp") || label.includes("telefon")) return "telefono";
  if (channel.includes("presencial")) return "presencial";
  if (channel.includes("email") || channel.includes("correo")) return "email";
  return "response";
}

function mechanismKind(item: AcreditacionActorMechanism) {
  if (item.role === "Universo") return "base";
  if (item.role === "Barrido") return "sweep";
  return "response";
}

function mechanismIcon(value: AcreditacionActorMechanism["modality"]) {
  if (value === "base") return Table2;
  if (value === "sweep" || value === "telefono") return PhoneCall;
  if (value === "presencial") return ContactRound;
  if (value === "email") return Link2;
  return QrCode;
}

function compactMechanismLabel(label: string) {
  return String(label || "Fuente")
    .replace(/\s+/g, " ")
    .replace(/^respuestas?\s+/i, "")
    .replace(/^base\s+/i, "Base ")
    .trim();
}

function actorMechanismObserved(
  actor: string,
  source: MonitoreoSource,
  sourceRows: Array<Record<string, unknown>>,
  progressRows: MonitoreoRow[] = [],
) {
  const actorKey = normalizeSourceMatch(actor);
  const sourceKey = normalizeSourceMatch(source.label);
  const row = sourceRows.find((item) => {
    const rowActor = normalizeSourceMatch(rowText(item, ["Actor", "Unidad", "Corte", "Carrera"]));
    const rowSource = normalizeSourceMatch(rowText(item, ["Fuente", "Encuesta", "Source"]));
    if (rowActor && rowActor !== actorKey) return false;
    return rowSource && (rowSource === sourceKey || rowSource.includes(sourceKey) || sourceKey.includes(rowSource));
  });
  if (row) {
    const total = rowNumber(row, ["Total respuestas", "Total", "Respuestas"], NaN);
    if (Number.isFinite(total)) return total;
    return rowNumber(row, ["Efectivas", "Validas", "Válidas", "Completas"], 0)
      + rowNumber(row, ["Parciales"], 0)
      + rowNumber(row, ["Rechazos plataforma", "Rechazos"], 0);
  }
  const progress = progressRows.find((item) => {
    const rowActor = normalizeSourceMatch(item.dim_actor);
    const rowSource = normalizeSourceMatch(item[".source_label"] ?? item.source_label);
    return rowActor === actorKey && rowSource && (rowSource === sourceKey || rowSource.includes(sourceKey) || sourceKey.includes(rowSource));
  });
  return progress ? num(progress.observado, 0) : null;
}

function actorMechanismsForCard(
  card: AcreditacionAdvanceCard,
  sources: MonitoreoSource[] = [],
  sourceRows: Array<Record<string, unknown>> = [],
  progressRows: MonitoreoRow[] = [],
): AcreditacionActorMechanism[] {
  const actorKey = normalizeSourceMatch(card.actor);
  const seen = new Set<string>();
  const mechanisms: AcreditacionActorMechanism[] = [];
  const actorSources = sources.filter((source) => {
    const sourceActor = normalizeSourceMatch(sourceActorLabel(source));
    return sourceActor === actorKey || (!sourceActor && normalizeSourceMatch(source.label).includes(actorKey));
  });
  actorSources.forEach((source) => {
    const role = sourceRoleForActor(source);
    const modality = sourceModalityForActor(source);
    const id = source.id || `${actorKey}-${normalizeSourceMatch(source.label)}`;
    if (seen.has(id)) return;
    seen.add(id);
    mechanisms.push({
      id,
      label: compactMechanismLabel(source.label),
      provider: sourceProviderLabel(source.kind),
      role,
      modality,
      observed: role === "Universo" && card.universe ? card.universe : actorMechanismObserved(card.actor, source, sourceRows, progressRows),
      channel: sourceChannelLabel(source),
    });
  });
  sourceRows.forEach((row, index) => {
    const rowActor = normalizeSourceMatch(rowText(row, ["Actor", "Unidad", "Corte", "Carrera"]));
    if (rowActor !== actorKey) return;
    const sourceLabel = rowText(row, ["Fuente", "Encuesta", "Source"], "Respuestas");
    const id = `${actorKey}-source-row-${normalizeSourceMatch(sourceLabel)}-${index}`;
    if (seen.has(id) || actorSources.some((source) => normalizeSourceMatch(source.label) === normalizeSourceMatch(sourceLabel))) return;
    seen.add(id);
    const channel = rowText(row, ["Canal", "Modalidad", "Channel"], "Plataforma");
    const observed = rowNumber(row, ["Total respuestas", "Total"], NaN);
    mechanisms.push({
      id,
      label: compactMechanismLabel(sourceLabel),
      provider: "Reporte",
      role: "Respuestas",
      modality: normalizeSourceMatch(channel).includes("telefon") ? "telefono" : "response",
      observed: Number.isFinite(observed)
        ? observed
        : rowNumber(row, ["Efectivas", "Validas", "Válidas"], 0) + rowNumber(row, ["Parciales"], 0) + rowNumber(row, ["Rechazos"], 0),
      channel,
    });
  });
  if (!mechanisms.some((item) => item.role === "Universo") && card.universe > 0) {
    mechanisms.unshift({
      id: `${actorKey}-universo`,
      label: "Base trabajada",
      provider: "Google Sheets",
      role: "Universo",
      modality: "base",
      observed: card.universe,
      channel: "Universo",
    });
  }
  if (!mechanisms.some((item) => item.role === "Respuestas") && card.effective + card.partial + card.refusals > 0) {
    mechanisms.push({
      id: `${actorKey}-respuestas`,
      label: "Respuestas conectadas",
      provider: "Reporte",
      role: "Respuestas",
      modality: "response",
      observed: card.effective + card.partial + card.refusals,
      channel: "Plataforma",
    });
  }
  return mechanisms.sort((a, b) => {
    const rank = (item: AcreditacionActorMechanism) => item.role === "Universo" ? 0 : item.role === "Barrido" ? 1 : 2;
    return rank(a) - rank(b) || (b.observed ?? -1) - (a.observed ?? -1) || a.label.localeCompare(b.label, "es");
  });
}

function dailyPointsForActor(actor: string, dailyRows: Array<Record<string, unknown>> = []) {
  const actorKey = normalizeSourceMatch(actor);
  return dailyRows
    .filter((row) => {
      const rowActor = normalizeSourceMatch(rowText(row, ["Actor", "Unidad", "Corte", "Carrera"]));
      return rowActor && rowActor === actorKey;
    })
    .map((row, index) => {
      const date = rowText(row, ["Fecha", "Dia", "Día", "Date"], `Dia ${index + 1}`);
      const effective = rowNumber(row, ["Efectivas", "Validas", "Válidas", "Completed"], 0);
      const partial = rowNumber(row, ["Parciales", "Partial"], 0);
      const refusals = rowNumber(row, ["Rechazo", "Rechazos", "Refusals"], 0);
      const total = rowNumber(row, ["Total respuestas", "Total", "Respuestas"], effective + partial + refusals);
      return { date, effective, partial, refusals, total };
    });
}

function actorCardsForDashboard({
  actorRows,
  sourceRows,
  dailyRows,
  actorDailySeries,
  goals,
  sources,
  progressRows,
}: {
  actorRows: Array<Record<string, unknown>>;
  sourceRows?: Array<Record<string, unknown>>;
  dailyRows?: Array<Record<string, unknown>>;
  actorDailySeries?: AcreditacionAdvanceDailySeries[];
  goals?: MonitoreoGoal[];
  sources?: MonitoreoSource[];
  progressRows?: MonitoreoRow[];
}): AcreditacionActorCard[] {
  const dailyByActor = new Map((actorDailySeries ?? []).map((series) => [normalizeSourceMatch(series.label), series.points]));
  return advanceCardsFromRows(actorRows, goals ?? []).map((card) => ({
    ...card,
    status: actorStatusLabel(card),
    mechanisms: actorMechanismsForCard(card, sources ?? [], sourceRows ?? [], progressRows ?? []),
    dailyPoints: dailyByActor.get(normalizeSourceMatch(card.actor)) ?? dailyPointsForActor(card.actor, dailyRows ?? []),
  }));
}

function phoneQuotaDailyPointsByValue(
  reports: MonitoreoAcreditacionReports,
  quotaRows: AcreditacionPhoneQuotaRow[],
) {
  const variable = preferredPhoneAdvanceQuotaVariable(quotaRows);
  const variableLabel = phoneQuotaVariableLabel(variable);
  const valueKeys = new Set(quotaRows.map((row) => normalizeSourceMatch(row.value)).filter(Boolean));
  const out = new Map<string, Map<string, AcreditacionAdvanceDailyPoint>>();
  const addPoint = (value: string, date: string, effective = 1) => {
    const valueKey = normalizeSourceMatch(value);
    if (!valueKey || !valueKeys.has(valueKey)) return;
    const cleanDate = normalizeAcreditacionDailyDateLabel(date);
    if (isAcreditacionNoDateLabel(cleanDate)) return;
    const amount = Math.max(0, Number(effective) || 0);
    if (!amount) return;
    const points = out.get(valueKey) ?? new Map<string, AcreditacionAdvanceDailyPoint>();
    const point = points.get(cleanDate) ?? { date: cleanDate, effective: 0, partial: 0, refusals: 0, total: 0 };
    point.effective += amount;
    point.total += amount;
    points.set(cleanDate, point);
    out.set(valueKey, points);
  };
  const variableDailyRows = rowsForSheetBlock(reports, "monitoreo_telefonico", [
    "avance_efectivo_variable_dia",
    "avance_cuota_dia",
    "avance_efectivo_cuota_dia",
  ]);
  variableDailyRows.forEach((row) => {
    const rowVariable = phoneRowValue(row, ["Variable", "variable", "Cuota"], "");
    if (variable && normalizeSourceMatch(rowVariable) !== normalizeSourceMatch(variable)) return;
    const value = phoneRowValue(row, ["Valor", variable, variableLabel, "Sede", "Distrito", "Segmento", "Grupo"], "");
    const date = phoneRowValue(row, ["Fecha", "Fecha Kobo", "Fecha plataforma", "Día", "Dia"], "");
    const effective = phoneRowNumber(row, ["Efectivas Kobo", "Efectivas", "Completas", "Total"], 0);
    addPoint(value, date, effective);
  });
  if (out.size) {
    return new Map(Array.from(out.entries()).map(([key, points]) => [key, sortAcreditacionDailyPoints(Array.from(points.values()))]));
  }
  const comparisonRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["comparacion_codpulso", "campo_vs_plataforma_codpulso"]);
  comparisonRows.forEach((row, index) => {
    if (!phoneBooleanValue(row, ["Efectiva Kobo", "Plataforma completa"])) return;
    const value = phoneRowValue(row, [
      variable,
      variableLabel,
      "Sede",
      "Distrito",
      "Segmento",
      "Grupo",
      "Categoria",
      "Categoría",
      "Valor",
    ], "");
    const valueKey = normalizeSourceMatch(value);
    if (!valueKey || !valueKeys.has(valueKey)) return;
    const date = normalizeAcreditacionDailyDateLabel(phoneRowValue(row, [
      "Fecha Kobo",
      "Fecha plataforma",
      "Última respuesta",
      "Ultima respuesta",
      "Fecha",
      "Día",
      "Dia",
    ], `Corte ${index + 1}`));
    addPoint(value, date, 1);
  });
  return new Map(Array.from(out.entries()).map(([key, points]) => [key, sortAcreditacionDailyPoints(Array.from(points.values()))]));
}

export function phoneQuotaCardsForDashboard(reports: MonitoreoAcreditacionReports): AcreditacionActorCard[] {
  const quotaRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"]);
  const parsedQuotaRows = phoneQuotaRowsForPanel(quotaRows);
  const dailyByValue = phoneQuotaDailyPointsByValue(reports, parsedQuotaRows);
  return phoneQuotaAdvanceCardsFromRows(quotaRows).map((card) => ({
    ...card,
    status: actorStatusLabel(card),
    mechanisms: [],
    dailyPoints: dailyByValue.get(normalizeSourceMatch(card.actor)) ?? [],
  }));
}

function shortAdvanceDateLabel(value: string) {
  if (isAcreditacionNoDateLabel(value)) return ACREDITACION_DAILY_NO_DATE_LABEL;
  const parsed = parseAcreditacionDailyDate(value);
  if (parsed) {
    return parsed.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" });
  }
  const dayFirst = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dayFirst) return `${dayFirst[1].padStart(2, "0")}/${dayFirst[2].padStart(2, "0")}`;
  const yearFirst = value.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (yearFirst) return `${yearFirst[3].padStart(2, "0")}/${yearFirst[2].padStart(2, "0")}`;
  return value.length > 6 ? value.slice(5) : value;
}

function paddedAdvanceAxisMax(value: number) {
  if (value <= 0) return undefined;
  if (value <= 8) return Math.ceil(value * 1.25);
  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 1);
  return Math.ceil((value * 1.16) / magnitude) * magnitude;
}

function AcreditacionAdvanceMetric({
  label,
  value,
  hint,
  tone = "base",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "base" | "target" | "ready" | "warning";
}) {
  return (
    <span className={`mon-advance-metric is-${tone}`}>
      <em>{label}</em>
      <strong>{value}</strong>
      <small>{hint}</small>
    </span>
  );
}

function AcreditacionAdvanceStorage({
  cards,
  scopeLabel = "actor",
}: {
  cards: AcreditacionAdvanceCard[];
  scopeLabel?: string;
}) {
  const totals = advanceTotals(cards);
  const universe = Math.max(0, totals.universe);
  const isPhoneScope = normalizeSourceMatch(scopeLabel) !== "actor";
  const phoneSweptWithoutEffective = Math.max(0, universe - totals.effective - totals.pending);
  const segments = isPhoneScope
    ? [
      { key: "completed", label: "Efectivas Kobo", value: totals.effective, pct: safePercentValue(totals.effective, universe) ?? 0, hint: "pasan el filtro" },
      { key: "phone", label: "Barridas sin efectiva", value: phoneSweptWithoutEffective, pct: safePercentValue(phoneSweptWithoutEffective, universe) ?? 0, hint: "estado telefónico" },
      { key: "pending", label: "Por barrer", value: totals.pending, pct: safePercentValue(totals.pending, universe) ?? 0, hint: "base telefónica" },
    ]
    : [
      { key: "completed", label: "Efectivas", value: totals.effective, pct: safePercentValue(totals.effective, universe) ?? 0, hint: "del universo" },
      { key: "partial", label: "Parciales", value: totals.partial, pct: safePercentValue(totals.partial, universe) ?? 0, hint: "no cuentan como efectivas" },
      { key: "refusals", label: "Rechazos", value: totals.refusals, pct: safePercentValue(totals.refusals, universe) ?? 0, hint: "requieren trazabilidad" },
      { key: "pending", label: "Sin respuesta", value: totals.pending, pct: safePercentValue(totals.pending, universe) ?? 0, hint: "por cerrar" },
    ];
  const actorUniverse = [...cards].filter((card) => card.universe > 0).sort((a, b) => b.universe - a.universe).slice(0, 4);
  const storageAriaLabel = isPhoneScope ? "Base telefónica y avance Kobo" : "Universo y avance de acreditación";
  const storageHeading = isPhoneScope ? "Base telefónica" : "Universo de avance";
  const storageProgress = isPhoneScope ? `${pctFrom(totals.effective, universe)} efectivas Kobo` : `${pctFrom(totals.effective, universe)} efectivas`;
  return (
    <section className="mon-advance-storage" aria-label={storageAriaLabel}>
      <header>
        <div>
          <span>{storageHeading}</span>
          <strong>{fmt(universe)} casos</strong>
        </div>
        <em>{storageProgress}</em>
      </header>
      <div className="mon-advance-actor-breakdown" aria-label={`Casos por ${scopeLabel.toLowerCase()}`}>
        {actorUniverse.map((card) => (
          <span
            key={`${card.id}-universe`}
            title={`${card.actor}: ${fmt(card.universe)} casos (${pctFrom(card.universe, universe)})`}
            style={{ "--advance-actor-size": `${Math.max(0, Math.min(100, safePercentValue(card.universe, universe) ?? 0))}%` } as CSSProperties}
          >
            <em>{card.actor}</em>
            <strong>{fmt(card.universe)}</strong>
            <i aria-hidden="true" />
          </span>
        ))}
      </div>
      <div className="mon-advance-storage-chart">
        <div className="mon-advance-storage-bar" role="list" aria-label={`${fmt(totals.effective)} ${isPhoneScope ? "efectivas Kobo" : "efectivas"} de ${fmt(universe)} casos base`}>
          {segments.some((segment) => segment.value > 0)
            ? segments.map((segment) => (
              <i
                key={segment.key}
                role="listitem"
                aria-label={`${segment.label}: ${fmt(segment.value)} casos, ${pct(segment.pct)} ${segment.hint}`}
                className={`is-${segment.key}`}
                title={`${segment.label}: ${fmt(segment.value)} (${pct(segment.pct)})`}
                style={{ "--advance-storage-size": `${Math.max(0, Math.min(100, segment.pct))}%` } as CSSProperties}
              />
            ))
            : <i className="is-empty" style={{ "--advance-storage-size": "100%" } as CSSProperties} />}
        </div>
      </div>
      <div className="mon-advance-storage-legend">
        {segments.map((segment) => (
          <span key={segment.key} className={`is-${segment.key}`}>
            <em>{segment.label}</em>
            <strong>{fmt(segment.value)}</strong>
            <small>{segment.hint}</small>
          </span>
        ))}
      </div>
    </section>
  );
}

function AcreditacionPhoneQuotaRhythmBoard({
  cards,
  variable,
  cutDate,
}: {
  cards: AcreditacionActorCard[];
  variable: string;
  cutDate?: string;
}) {
  const quotaCards = [...cards].sort((a, b) => (
    (b.missing ?? -1) - (a.missing ?? -1)
    || b.universe - a.universe
    || a.actor.localeCompare(b.actor, "es")
  ));
  const cardsWithSeries = quotaCards.filter((card) => card.dailyPoints.length);
  const totalEffective = quotaCards.reduce((sum, card) => sum + card.effective, 0);
  const totalMeta = quotaCards.reduce((sum, card) => sum + (card.meta ?? 0), 0);
  const totalGap = quotaCards.reduce((sum, card) => sum + (card.missing ?? 0), 0);
  const visibleCards = (cardsWithSeries.length ? cardsWithSeries : quotaCards).slice(0, 8);
  const datedEffective = quotaCards.reduce((sum, card) => (
    sum + card.dailyPoints.reduce((inner, point) => inner + dailyEffectiveValue(point), 0)
  ), 0);
  const datedLabel = totalEffective && datedEffective !== totalEffective
    ? `${fmt(datedEffective)}/${fmt(totalEffective)}`
    : fmt(datedEffective || totalEffective);
  const hasSeries = cardsWithSeries.length > 0;
  return (
    <section className={`mon-phone-quota-rhythm${hasSeries ? " has-series" : " is-missing-series"}`} aria-label={`Avance diario por ${variable}`}>
      <header>
        <div>
          <span><CalendarRange size={13} /> Ritmo por {variable.toLowerCase()}</span>
          <strong>{hasSeries ? `Cuotas con ritmo diario propio` : "Falta fecha por cuota"}</strong>
          <p>
            {hasSeries
              ? `Cada ${variable.toLowerCase()} muestra su donut de avance, KPIs y barra diaria de efectivas Kobo; no es un total mezclado.`
              : `El corte trae metas y pendientes por ${variable.toLowerCase()}, pero no suficientes fechas por CodPulso para dibujar la serie de cada cuota.`}
          </p>
        </div>
        <div className="mon-phone-quota-rhythm-kpis">
          <span><em>{variable}</em><strong>{fmt(quotaCards.length)}</strong></span>
          <span><em>Meta</em><strong>{totalMeta ? fmt(totalMeta) : "S/M"}</strong></span>
          <span className={totalGap ? "is-warning" : "is-ready"}><em>Faltan</em><strong>{fmt(totalGap)}</strong></span>
          <span className="is-ready"><em>Fechadas</em><strong>{datedLabel}</strong></span>
        </div>
      </header>
      <div className="mon-phone-quota-rhythm-grid">
        {visibleCards.length ? visibleCards.map((card) => {
          const progress = card.meta ? safePercentValue(card.effective, card.meta) ?? 0 : card.coverage ?? 0;
          const cardDated = card.dailyPoints.reduce((sum, point) => sum + dailyEffectiveValue(point), 0);
          const orderedDaily = sortAcreditacionDailyPoints(card.dailyPoints)
            .filter((point) => isDatedAcreditacionDailyPoint(point) && dailyEffectiveValue(point) > 0);
          const visibleDaily = orderedDaily.slice(-10);
          const maxDaily = Math.max(1, ...visibleDaily.map((point) => dailyEffectiveValue(point)));
          const latestDatedPoint = orderedDaily.at(-1) ?? null;
          return (
            <article key={card.id} className={card.dailyPoints.length ? "has-series" : "is-missing-series"}>
              <div className="mon-phone-quota-rhythm-card-head">
                <div>
                  <span>{variable}</span>
                  <strong>{card.actor}</strong>
                  <em>{card.meta == null ? "Meta pendiente" : `${fmt(card.effective)} de ${fmt(card.meta)} efectivas Kobo`}</em>
                </div>
                <b>{formatPercentLabel(progress)}</b>
              </div>
              <div className="mon-phone-quota-rhythm-donut" aria-label={`${card.actor}: ${formatPercentLabel(progress)} de avance`}>
                <i aria-hidden="true" style={{ "--phone-quota-rhythm-pct": `${Math.max(0, Math.min(100, progress))}%` } as CSSProperties} />
                <span>
                  <strong>{fmt(card.effective)}</strong>
                  <em>{card.meta == null ? "sin meta" : `de ${fmt(card.meta)}`}</em>
                  <small>{card.missing == null ? "meta pendiente" : card.missing > 0 ? `${fmt(card.missing)} faltan` : "cuota cubierta"}</small>
                </span>
              </div>
              <i aria-hidden="true" style={{ "--phone-quota-rhythm-pct": `${Math.max(2, Math.min(100, progress))}%` } as CSSProperties} />
              <div className="mon-phone-quota-rhythm-card-metrics">
                <span><em>Base</em><strong>{fmt(card.universe)}</strong></span>
                <span><em>Faltan</em><strong>{card.missing == null ? "S/M" : fmt(card.missing)}</strong></span>
                <span><em>Fechadas</em><strong>{cardDated ? fmt(cardDated) : "S/D"}</strong></span>
              </div>
              <div className="mon-phone-quota-rhythm-daily" aria-label={`Ritmo diario de ${card.actor}`}>
                <span>
                  <em>{fmt(orderedDaily.length)} {orderedDaily.length === 1 ? "día" : "días"}</em>
                  <strong>{latestDatedPoint ? shortAdvanceDateLabel(latestDatedPoint.date) : "Sin fecha"}</strong>
                </span>
                <div>
                  {visibleDaily.length ? visibleDaily.map((point) => {
                    const value = dailyEffectiveValue(point);
                    const height = Math.max(8, Math.min(100, safePercentValue(value, maxDaily) ?? 0));
                    return (
                      <i
                        key={`${card.id}-${point.date}`}
                        title={`${shortAdvanceDateLabel(point.date)}: ${fmt(value)} efectivas Kobo`}
                        style={{ "--phone-quota-rhythm-day": `${height}%` } as CSSProperties}
                      />
                    );
                  }) : <em>Sin serie diaria</em>}
                </div>
              </div>
              <small>
                {latestDatedPoint
                  ? `Último día ${shortAdvanceDateLabel(latestDatedPoint.date)} · ${fmt(dailyEffectiveValue(latestDatedPoint))} efectivas Kobo`
                  : "Sin serie diaria para esta cuota."}
              </small>
            </article>
          );
        }) : (
          <EmptyPanel title="Sin cuotas" detail={`Define ${variable.toLowerCase()} y metas Kobo para ver el avance diario por cuota.`} />
        )}
      </div>
    </section>
  );
}

function AcreditacionAdvanceDailyMini({
  points,
  title = "Ritmo general del estudio",
  variant = "general",
  cutDate,
  reportCuts = [],
  reportWeekday = "",
  effectiveOnly = false,
  compact = false,
}: {
  points: AcreditacionAdvanceDailyPoint[];
  title?: string;
  variant?: "general" | "actor" | "source";
  cutDate?: string;
  reportCuts?: AcreditacionDailyReportCut[];
  reportWeekday?: MonitoreoReportWeekday | "";
  effectiveOnly?: boolean;
  compact?: boolean;
}) {
  const orderedSourcePoints = mergeAcreditacionDailyPoints(sortAcreditacionDailyPoints(points));
  const orderedPoints = expandAcreditacionDailyCalendar(orderedSourcePoints, reportCuts);
  const totals = dailyPointTotals(orderedSourcePoints);
  const isCompactChart = compact && variant !== "general";
  const visibleLimit = isCompactChart ? 14 : variant === "general" ? 42 : variant === "actor" ? 35 : 30;
  let cumulative = 0;
  const allChartRows = orderedPoints.map((point) => {
    const dailyTotal = effectiveOnly ? dailyEffectiveValue(point) : dailyPointTotalValue(point);
    cumulative += dailyTotal;
    return {
      ...point,
      x: 0,
      axisLabel: compactAdvanceDateTickLabel(point.date),
      displayLabel: shortAdvanceDateLabel(point.date),
      dailyTotal,
      cumulative,
    };
  });
  const visiblePoints = allChartRows.slice(-visibleLimit);
  const chartRows = visiblePoints.map((point, index) => ({ ...point, x: index }));
  const hasDailySignal = chartRows.some((point) => point.dailyTotal > 0);
  const lastPoint = chartRows.at(-1) ?? null;
  const bestPoint = chartRows.reduce<typeof chartRows[number] | null>((best, point) => (
    !best || point.dailyTotal > best.dailyTotal ? point : best
  ), null);
  const averageBase = effectiveOnly ? totals.effective : totals.total;
  const average = chartRows.length ? averageBase / chartRows.length : 0;
  const resolvedReportWeekday = normalizeCalendarReportWeekday(reportWeekday) || calendarReportWeekdayFromDate(cutDate);
  const datedCuts = dailyCutsForChart(chartRows, reportCuts);
  const inferredWeeklyCuts = datedCuts.length ? [] : weeklyCutsForChart(chartRows, resolvedReportWeekday);
  const cuts = datedCuts.length ? datedCuts : inferredWeeklyCuts.length ? inferredWeeklyCuts : dailyCutsForChart(chartRows, [], cutDate);
  const cutXSet = new Set(cuts.map((cut) => cut.x));
  const tickEvery = chartRows.length > 40 ? 7 : chartRows.length > 28 ? 5 : chartRows.length > 16 ? 3 : chartRows.length > 10 ? 2 : 1;
  const tickRows = chartRows.filter((point, index) => (
    index === 0 || index === chartRows.length - 1 || index % tickEvery === 0 || cutXSet.has(point.x)
  ));
  const cumulativeCandidates = Array.from(new Map([
    ...(chartRows.length <= 14 ? ([chartRows[0]].filter(Boolean) as typeof chartRows) : []),
    ...cuts.map((cut) => cut.point),
    ...([chartRows.at(-1)].filter(Boolean) as typeof chartRows),
  ].map((point) => [point.x, point])).values());
  const cumulativeLabelRows = sparseDailyChartRows(
    cumulativeCandidates,
    variant === "general" ? 3 : 4,
    variant === "general" ? 8 : 5,
  );
  const showDenseDailyLabels = isCompactChart
    ? chartRows.length <= 7
    : variant === "general"
    ? chartRows.length <= 42
    : chartRows.length <= 24;
  const dailyLabelCandidates = showDenseDailyLabels
    ? chartRows.filter((point) => point.dailyTotal > 0)
    : Array.from(new Map([
      ...(bestPoint && bestPoint.dailyTotal > 0 ? [bestPoint] : []),
      ...(lastPoint && lastPoint.dailyTotal > 0 ? [lastPoint] : []),
      ...cuts.map((cut) => cut.point).filter((point) => point.dailyTotal > 0),
    ].map((point) => [point.x, point])).values());
  const dailyLabelRows = sparseDailyChartRows(
    dailyLabelCandidates,
    showDenseDailyLabels ? 1 : variant === "general" ? 2 : 3,
    showDenseDailyLabels ? Math.min(42, dailyLabelCandidates.length) : variant === "general" ? 8 : 5,
  );
  const dateLabelRows = isCompactChart ? [] : chartRows;
  const chartBottomMargin = isCompactChart ? 36 : variant === "general" ? 86 : variant === "actor" ? 78 : 72;
  const maxDaily = chartRows.reduce((max, point) => Math.max(max, point.dailyTotal), 0);
  const maxCumulative = chartRows.reduce((max, point) => Math.max(max, point.cumulative), 0);
  const dailyAxisMax = paddedAdvanceAxisMax(maxDaily);
  const cumulativeAxisMax = paddedAdvanceAxisMax(maxCumulative);
  const hoverData = chartRows.map((point) => [
    point.date,
    point.effective,
    point.partial,
    point.refusals,
    point.dailyTotal,
    point.cumulative,
  ]);
  const hoverTemplate = effectiveOnly
    ? [
      "<b>%{customdata[0]}</b>",
      "Efectivas Kobo <b>%{customdata[1]}</b>",
      "Acumulado <b>%{customdata[5]}</b>",
      "<extra></extra>",
    ].join("<br>")
    : [
      "<b>%{customdata[0]}</b>",
      "Efectivas %{customdata[1]} · Parciales %{customdata[2]} · Rechazos %{customdata[3]}",
      "Total día <b>%{customdata[4]}</b> · Acumulado <b>%{customdata[5]}</b>",
      "<extra></extra>",
    ].join("<br>");
  const chartData = [
    {
      type: "bar" as const,
      name: "Efectivas",
      x: chartRows.map((point) => point.x),
      y: chartRows.map((point) => point.effective),
      marker: { color: "#168a55", line: { color: "rgba(255, 255, 255, 0.72)", width: 0.8 } },
      customdata: hoverData,
      hovertemplate: hoverTemplate,
    },
    ...(!effectiveOnly ? [
    {
      type: "bar" as const,
      name: "Parciales",
      x: chartRows.map((point) => point.x),
      y: chartRows.map((point) => point.partial),
      marker: { color: "#b97611", line: { color: "rgba(255, 255, 255, 0.72)", width: 0.8 } },
      customdata: hoverData,
      hovertemplate: hoverTemplate,
    },
    {
      type: "bar" as const,
      name: "Rechazos",
      x: chartRows.map((point) => point.x),
      y: chartRows.map((point) => point.refusals),
      marker: { color: "#a61d4f", line: { color: "rgba(255, 255, 255, 0.72)", width: 0.8 } },
      customdata: hoverData,
      hovertemplate: hoverTemplate,
    },
    ] : []),
    {
      type: "scatter" as const,
      mode: "lines+markers" as const,
      name: effectiveOnly ? "Acumulado Kobo" : "Acumulado total",
      x: chartRows.map((point) => point.x),
      y: chartRows.map((point) => point.cumulative),
      yaxis: "y2",
      line: { color: "#17212f", width: 3, shape: "spline" as const, smoothing: 0.45 },
      marker: {
        color: "#ffffff",
        size: variant === "general" ? 8 : 6,
        line: { color: "#17212f", width: 2 },
      },
      customdata: hoverData,
      hovertemplate: hoverTemplate,
    },
  ];
  const chartLayout = {
    barmode: "stack" as const,
    bargap: chartRows.length <= 1 ? 0.72 : chartRows.length <= 7 ? 0.42 : 0.24,
    dragmode: false as const,
    font: {
      family: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      color: "#17212f",
    },
    hovermode: "closest" as const,
    showlegend: false,
    margin: {
      l: isCompactChart ? 24 : 48,
      r: isCompactChart ? 28 : 58,
      t: isCompactChart ? 20 : 36,
      b: chartBottomMargin,
    },
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    hoverlabel: {
      align: "left" as const,
      bgcolor: "#ffffff",
      bordercolor: "rgba(15, 23, 42, 0.12)",
      font: { color: "#17212f", size: 12, family: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" },
    },
    shapes: [
      ...cuts.map((cut) => ({
        type: "line" as const,
        xref: "x" as const,
        yref: "paper" as const,
        x0: cut.x,
        x1: cut.x,
        y0: 0,
        y1: 1,
        line: {
          color: cut.isFallback ? "rgba(190, 18, 60, 0.5)" : "rgba(15, 58, 117, 0.32)",
          width: cut.isFallback ? 1.4 : 1,
          dash: cut.isFallback ? "dash" : "dot",
        },
      })),
    ],
    annotations: [
      ...(isCompactChart ? [] : cumulativeLabelRows.map((point) => ({
        x: point.x,
        y: 1.08,
        xref: "x" as const,
        yref: "paper" as const,
        text: fmt(point.cumulative),
        showarrow: false,
        font: { color: "#0f3a75", size: 10, family: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" },
      }))),
      ...dailyLabelRows.map((point) => ({
        x: point.x,
        y: -0.08,
        xref: "x" as const,
        yref: "paper" as const,
        text: fmt(point.dailyTotal),
        showarrow: false,
        xanchor: "center" as const,
        yanchor: "middle" as const,
        font: { color: "#168a55", size: 10, family: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" },
      })),
      ...dateLabelRows.map((point) => ({
        x: point.x,
        y: -0.22,
        xref: "x" as const,
        yref: "paper" as const,
        text: point.axisLabel,
        showarrow: false,
        xanchor: "center" as const,
        yanchor: "top" as const,
        align: "center" as const,
        font: { color: "#5f6b7a", size: 10, family: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" },
      })),
    ],
    xaxis: {
      fixedrange: true,
      showgrid: false,
      zeroline: false,
      range: chartRows.length ? [-0.55, Math.max(0.55, chartRows.length - 0.45)] : undefined,
      tickangle: 0,
      tickvals: tickRows.map((point) => point.x),
      ticktext: tickRows.map((point) => (isCompactChart ? point.displayLabel : point.axisLabel)),
      showticklabels: isCompactChart,
      ticks: "",
      tickfont: { color: "#5f6b7a", size: isCompactChart ? 9 : 10 },
      automargin: true,
    },
    yaxis: {
      title: isCompactChart ? undefined : { text: effectiveOnly ? "Efectivas/día" : "Respuestas/día", font: { color: "#5f6b7a", size: 11 } },
      fixedrange: true,
      range: dailyAxisMax ? [0, dailyAxisMax] : undefined,
      rangemode: "tozero",
      showline: false,
      showticklabels: !isCompactChart,
      zeroline: false,
      gridcolor: "rgba(15, 23, 42, 0.06)",
      tickfont: { color: "#5f6b7a", size: 10 },
    },
    yaxis2: {
      title: isCompactChart ? undefined : { text: "Acumulado", font: { color: "#17212f", size: 11 } },
      overlaying: "y",
      side: "right",
      fixedrange: true,
      range: cumulativeAxisMax ? [0, cumulativeAxisMax] : undefined,
      rangemode: "tozero",
      showgrid: false,
      showticklabels: !isCompactChart,
      zeroline: false,
      tickfont: { color: "#17212f", size: 10 },
    },
  };
  const chartConfig = {
    displayModeBar: false,
    doubleClick: false,
    responsive: true,
    scrollZoom: false,
  };
  const averageLabel = average ? average.toLocaleString("es-PE", { maximumFractionDigits: 1 }) : "S/D";
  const chartHeight = isCompactChart ? 154 : variant === "general" ? 360 : 300;
  const dailyLabel = effectiveOnly ? "efectivas" : "respuestas";
  const signalDayCount = orderedSourcePoints.filter((point) => dailyPointTotalValue(point) > 0).length;
  return (
    <article className={`mon-advance-daily-mini is-${variant}${isCompactChart ? " is-compact" : ""}`}>
      <header>
        <div>
          <span>Avance diario</span>
          <strong>{title}</strong>
          <em>{countText(signalDayCount, "día", "días")} con respuesta · {fmt(effectiveOnly ? totals.effective : totals.total)} {dailyLabel} · {averageLabel}/día</em>
        </div>
        <div className="mon-advance-daily-mini-tools">
          <div className="mon-advance-daily-mini-kpis">
            <span className="is-effective"><em>Efectivas</em><strong>{fmt(totals.effective)}</strong></span>
            {!effectiveOnly ? (
              <>
                <span className="is-partial"><em>Parciales</em><strong>{fmt(totals.partial)}</strong></span>
                <span className="is-refusals"><em>Rechazos</em><strong>{fmt(totals.refusals)}</strong></span>
              </>
            ) : null}
          </div>
          {hasDailySignal && !isCompactChart ? (
            <div className="mon-advance-daily-legend" aria-label="Leyenda de avance diario">
              <span className="is-completed">Efectivas</span>
              {!effectiveOnly ? (
                <>
                  <span className="is-partial">Parciales</span>
                  <span className="is-refusals">Rechazos</span>
                </>
              ) : null}
              <span className="is-cumulative">Acumulado</span>
            </div>
          ) : null}
        </div>
      </header>
      {hasDailySignal ? (
        <div className="mon-advance-daily-board">
          <div className="mon-advance-line-chart">
            <PlotlyChart
              data={chartData}
              layout={chartLayout}
              config={chartConfig}
              height={chartHeight}
              ariaLabel={`Avance diario y acumulado: ${title}`}
            />
          </div>
        </div>
      ) : (
        <EmptyPanel title="Sin ritmo diario" detail="El corte todavía no trae respuestas fechadas para graficar avance." />
      )}
      {orderedPoints.length > visiblePoints.length ? (
        <div className="mon-advance-daily-loose">
          <span><strong>{fmt(visiblePoints.length)} de {fmt(orderedPoints.length)}</strong><em> días calendario visibles en el gráfico</em></span>
        </div>
      ) : null}
    </article>
  );
}

function AcreditacionActorDashboardTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "base" | "target" | "ready" | "warning";
}) {
  return (
    <div className={`mon-actor-dashboard-tile is-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{hint}</em>
    </div>
  );
}

function AcreditacionActorFlowNode({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "base" | "target" | "ready" | "warning";
}) {
  return (
    <span className={`mon-actor-flow-node is-${tone}`}>
      <em>{label}</em>
      <strong>{value}</strong>
    </span>
  );
}

function AcreditacionActorMechanismGroup({
  title,
  caption,
  value,
  tone,
  children,
}: {
  title: string;
  caption: string;
  value: string;
  tone: "base" | "responses";
  children: ReactNode;
}) {
  return (
    <section className={`mon-actor-mechanism-group is-${tone}`}>
      <header>
        <div>
          <span>{title}</span>
          <em>{caption}</em>
        </div>
        <strong>{value}</strong>
      </header>
      <div className="mon-actor-mechanism-list">{children}</div>
    </section>
  );
}

function AcreditacionActorMechanismRow({
  item,
  universe,
}: {
  item: AcreditacionActorMechanism;
  universe: number | null | undefined;
}) {
  const Icon = mechanismIcon(item.modality);
  const pctValue = safePercentValue(item.observed ?? 0, universe ?? null);
  const kind = mechanismKind(item);
  const channelLabel = item.channel ? acreditacionChannelLabel(item.channel) : "";
  const visibleChannel = channelLabel && channelLabel !== "Sin canal" ? channelLabel : "";
  return (
    <div className={`mon-actor-mechanism is-${item.modality} is-${kind}`}>
      <span className="mon-actor-mechanism-icon"><Icon size={13} /></span>
      <div>
        <strong>{item.label}</strong>
        <span>{item.provider} · {item.role}{visibleChannel ? ` · ${visibleChannel}` : ""}</span>
      </div>
      <em>
        {item.observed == null ? "S/D" : fmt(item.observed)}
        <small>{item.role === "Universo" ? "universo" : item.role === "Barrido" ? "base" : "respuestas"}</small>
      </em>
      <i style={{ "--mechanism-pct": `${Math.max(0, Math.min(100, pctValue ?? 0))}%` } as CSSProperties} />
    </div>
  );
}

function AcreditacionActorProgressCardView({
  card,
  cutDate,
  reportCuts = [],
  reportWeekday = "",
  scopeLabel = "Actor",
}: {
  card: AcreditacionActorCard;
  cutDate?: string;
  reportCuts?: AcreditacionDailyReportCut[];
  reportWeekday?: MonitoreoReportWeekday | "";
  scopeLabel?: string;
}) {
  const totalProgress = card.progress ?? card.coverage ?? safePercentValue(card.effective, card.universe);
  const dial = Math.max(0, Math.min(100, totalProgress ?? 0)) * 3.6;
  const isPhoneQuotaScope = scopeLabel !== "Actor";
  const completedPct = safePercentValue(card.effective, card.universe) ?? 0;
  const sweptWithoutEffective = isPhoneQuotaScope
    ? Math.max(0, card.universe - card.effective - card.pending)
    : card.partial;
  const partialPct = safePercentValue(sweptWithoutEffective, card.universe) ?? 0;
  const refusalsPct = isPhoneQuotaScope ? 0 : safePercentValue(card.refusals, card.universe) ?? 0;
  const unansweredPct = isPhoneQuotaScope
    ? safePercentValue(card.pending, card.universe) ?? 0
    : Math.max(0, 100 - completedPct - partialPct - refusalsPct);
  const targetPct = safePercentValue(card.meta, card.universe);
  const clampedTargetPct = targetPct == null ? 0 : Math.max(0, Math.min(100, targetPct));
  const targetReached = card.missing != null ? card.missing <= 0 : card.meta != null && card.effective >= card.meta;
  const baseMechanisms = card.mechanisms.filter((item) => item.role === "Universo" || item.role === "Barrido");
  const responseMechanisms = card.mechanisms.filter((item) => item.role === "Respuestas");
  return (
    <article
      className={`mon-actor-card is-${card.statusTone}${isPhoneQuotaScope ? " is-phone-quota" : ""}`}
      style={{
        "--actor-dial": `${dial}deg`,
        "--actor-complete": `${Math.max(0, Math.min(100, completedPct))}%`,
        "--actor-partial": `${Math.max(0, Math.min(100, completedPct + partialPct))}%`,
        "--actor-refusal": `${Math.max(0, Math.min(100, completedPct + partialPct + refusalsPct))}%`,
        "--actor-target": `${clampedTargetPct}%`,
      } as CSSProperties}
    >
      <header className="mon-actor-card-head">
        <div>
          <span>{scopeLabel}</span>
          <strong>{card.actor}</strong>
        </div>
        <em>{card.status}</em>
      </header>
      <div className="mon-actor-card-body">
        <div className="mon-actor-radar" aria-label={`Avance de ${card.actor}`}>
          <div className={`mon-actor-dial is-${card.statusTone}`}>
            <strong>{formatPercentLabel(totalProgress)}</strong>
            <span>{isPhoneQuotaScope ? "Meta" : "Total"}</span>
          </div>
          <div
            className={`mon-actor-pipeline-wrap${targetPct == null ? "" : " has-target"}`}
            role="img"
            aria-label={`${fmt(card.effective)} efectivas de ${fmt(card.universe)} universo`}
          >
            <div className="mon-actor-pipeline" aria-hidden="true">
              <span className="is-complete" />
              <span className="is-partial" />
              <span className="is-refusal" />
              <span className="is-pending" style={{ width: `${unansweredPct}%` }} />
            </div>
            {targetPct != null ? (
              <span
                className={`mon-actor-target ${targetReached ? "is-reached" : "is-open"}`}
                title={`Meta ${fmt(card.meta)} (${formatPercentLabel(targetPct)} del universo)`}
                aria-hidden="true"
              />
            ) : null}
          </div>
          <p>
            <span>{fmt(card.effective)} efectivas</span>
            <strong>{fmt(card.pending)} {isPhoneQuotaScope ? "por barrer" : "pendientes"}</strong>
          </p>
        </div>
        <div className="mon-actor-flow" aria-label={`Meta de ${scopeLabel.toLowerCase()}`}>
          <AcreditacionActorFlowNode label="Universo" value={fmt(card.universe)} tone="base" />
          <AcreditacionActorFlowNode label="Meta" value={card.meta == null ? "S/M" : fmt(card.meta)} tone="target" />
          <AcreditacionActorFlowNode label="Efectivas" value={fmt(card.effective)} tone="ready" />
          <AcreditacionActorFlowNode label={isPhoneQuotaScope ? "Pendiente" : "Brecha"} value={card.missing == null ? "S/M" : fmt(card.missing)} tone={card.missing != null && card.missing > 0 ? "warning" : "ready"} />
        </div>
      </div>
      {card.dailyPoints.length ? (
        <AcreditacionAdvanceDailyMini
          points={card.dailyPoints}
          title={card.actor}
          variant="actor"
          cutDate={cutDate}
          reportCuts={reportCuts}
          reportWeekday={reportWeekday}
          effectiveOnly={scopeLabel !== "Actor"}
          compact={isPhoneQuotaScope}
        />
      ) : isPhoneQuotaScope ? (
        <div className="mon-phone-quota-series-note" role="note">
          <CalendarRange size={16} aria-hidden="true" />
          <div>
            <strong>Ritmo diario pendiente</strong>
            <span>El corte trae meta y efectivas de esta cuota, pero falta la fecha de cada CodPulso asociada a la variable para dibujar la serie.</span>
          </div>
        </div>
      ) : null}
      {!isPhoneQuotaScope ? (
      <div className="mon-actor-mechanisms" aria-label={`Fuentes y avance de ${card.actor}`}>
        <AcreditacionActorMechanismGroup
          title="Universo y bases"
          caption="Base trabajada y barrido"
          value={card.universe ? `${fmt(card.universe)} universo` : `${fmt(baseMechanisms.length)} fuentes`}
          tone="base"
        >
          {baseMechanisms.length ? baseMechanisms.map((item) => (
            <AcreditacionActorMechanismRow key={item.id} item={item} universe={card.universe} />
          )) : (
            <div className="mon-actor-mechanism-empty">Sin base registrada para esta unidad.</div>
          )}
        </AcreditacionActorMechanismGroup>
        <AcreditacionActorMechanismGroup
          title="Avance en plataformas"
          caption="Respuestas por canal"
          value={`${fmt(card.effective)} efectivas`}
          tone="responses"
        >
          {responseMechanisms.length ? responseMechanisms.map((item) => (
            <AcreditacionActorMechanismRow key={item.id} item={item} universe={card.universe} />
          )) : (
            <div className="mon-actor-mechanism-empty">Sin respuestas conectadas para este actor.</div>
          )}
        </AcreditacionActorMechanismGroup>
      </div>
      ) : null}
    </article>
  );
}

function AcreditacionPhoneQuotaLaneCard({ card }: { card: AcreditacionActorCard }) {
  const meta = card.meta ?? 0;
  const metaProgress = meta > 0 ? safePercentValue(card.effective, meta) ?? 0 : safePercentValue(card.effective, card.universe) ?? 0;
  const baseProgress = safePercentValue(card.effective, card.universe) ?? 0;
  const targetPct = safePercentValue(meta, card.universe) ?? 0;
  const gap = card.missing ?? Math.max(0, meta - card.effective);
  const orderedDaily = sortAcreditacionDailyPoints(card.dailyPoints).filter((point) => dailyEffectiveValue(point) > 0);
  const visibleDaily = orderedDaily.slice(-6);
  const maxDaily = Math.max(1, ...visibleDaily.map(dailyEffectiveValue));
  const lastPoint = orderedDaily.at(-1) ?? null;
  const dailyTotal = orderedDaily.reduce((sum, point) => sum + dailyEffectiveValue(point), 0);
  return (
    <article
      className={`mon-phone-quota-lane is-${card.statusTone}`}
      style={{
        "--phone-quota-lane-pct": `${Math.max(baseProgress ? 3 : 0, Math.min(100, baseProgress))}%`,
        "--phone-quota-lane-target": `${Math.max(0, Math.min(100, targetPct))}%`,
      } as CSSProperties}
    >
      <div className="mon-phone-quota-lane-title">
        <span>Sede</span>
        <strong>{card.actor}</strong>
        <em>{gap > 0 ? `${fmt(gap)} por cumplir` : "cuota cubierta"}</em>
      </div>
      <div className="mon-phone-quota-lane-progress" aria-label={`Avance de cuota de ${card.actor}`}>
        <div>
          <strong>{meta > 0 ? `${fmt(card.effective)} / ${fmt(meta)}` : fmt(card.effective)}</strong>
          <span>{formatPercentLabel(metaProgress)} de la meta Kobo</span>
        </div>
        <i aria-hidden="true"><b /></i>
        <small>Base {fmt(card.universe)} · por barrer {fmt(card.pending)}</small>
      </div>
      <div className="mon-phone-quota-lane-metrics" aria-label={`Indicadores de ${card.actor}`}>
        <span><em>Meta</em><strong>{meta ? fmt(meta) : "S/M"}</strong></span>
        <span><em>Kobo</em><strong>{fmt(card.effective)}</strong></span>
        <span className={gap ? "is-warning" : "is-ready"}><em>Pendiente</em><strong>{fmt(gap)}</strong></span>
      </div>
      <div className="mon-phone-quota-lane-spark" aria-label={`Ritmo diario de ${card.actor}`}>
        <span>
          <em>{fmt(orderedDaily.length)} día{orderedDaily.length === 1 ? "" : "s"}</em>
          <strong>{lastPoint ? shortAdvanceDateLabel(lastPoint.date) : "Sin fecha"}</strong>
        </span>
        <div>
          {visibleDaily.length ? visibleDaily.map((point) => {
            const value = dailyEffectiveValue(point);
            return (
              <i
                key={point.date}
                title={`${shortAdvanceDateLabel(point.date)}: ${fmt(value)} efectivas Kobo`}
                style={{ "--phone-quota-lane-day": `${Math.max(8, Math.min(100, safePercentValue(value, maxDaily) ?? 0))}%` } as CSSProperties}
              />
            );
          }) : <em>Sin serie</em>}
        </div>
        <small>{fmt(dailyTotal)} fechadas</small>
      </div>
    </article>
  );
}

function AcreditacionPhoneQuotaLaneBoard({
  cards,
  totals,
  generatedAt,
}: {
  cards: AcreditacionActorCard[];
  totals: ReturnType<typeof advanceTotals>;
  generatedAt: string;
}) {
  const withMeta = cards.filter((card) => card.meta != null);
  const reached = withMeta.filter((card) => (card.missing ?? 0) <= 0).length;
  const metaTotal = cards.reduce((sum, card) => sum + Math.max(0, card.meta ?? 0), 0);
  const gapTotal = cards.reduce((sum, card) => sum + Math.max(0, card.missing ?? 0), 0);
  const datedTotal = cards.reduce(
    (sum, card) => sum + card.dailyPoints.reduce((inner, point) => inner + dailyEffectiveValue(point), 0),
    0,
  );
  return (
    <div className="mon-phone-quota-lane-board">
      <section className="mon-phone-quota-lane-brief" aria-label="Resumen de cuotas Kobo por sede">
        <div>
          <span>Cuotas Kobo por sede</span>
          <strong>{fmt(totals.effective)} efectivas de {metaTotal ? fmt(metaTotal) : "S/M"}</strong>
          <p>Todas las sedes quedan visibles en una sola lectura: meta, efectivas Kobo, pendiente por cumplir y señal diaria fechada.</p>
        </div>
        <div className="mon-phone-quota-lane-kpis">
          <span><em>Sedes</em><strong>{fmt(cards.length)}</strong></span>
          <span><em>Cubiertas</em><strong>{fmt(reached)}/{fmt(withMeta.length || cards.length)}</strong></span>
          <span className={gapTotal ? "is-warning" : "is-ready"}><em>Pendiente</em><strong>{fmt(gapTotal)}</strong></span>
          <span><em>Fechadas</em><strong>{fmt(datedTotal)}</strong></span>
          {generatedAt ? <span><em>Corte</em><strong>{generatedAt}</strong></span> : null}
        </div>
      </section>
      <div className="mon-phone-quota-lane-list" aria-label="Carriles de avance por sede">
        {cards.length ? cards.map((card) => (
          <AcreditacionPhoneQuotaLaneCard key={card.id} card={card} />
        )) : (
          <EmptyPanel title="Sin cuotas operativas" detail="El reporte telefónico aún no trae categorías de cuota para mostrar metas, efectivas Kobo y pendientes." />
        )}
      </div>
    </div>
  );
}

function AcreditacionAdvanceActorsWorkbench({
  reports,
  state,
  actorRows,
  sourceRows,
  dailyRows,
}: {
  reports: MonitoreoAcreditacionReports;
  state?: MonitoreoState | null;
  actorRows: Array<Record<string, unknown>>;
  sourceRows: Array<Record<string, unknown>>;
  dailyRows: Array<Record<string, unknown>>;
}) {
  const allowedActors = new Set(actorRows.map((row, index) => normalizeSourceMatch(rowText(row, ["Actor", "Unidad", "Corte", "Carrera"], `Actor ${index + 1}`))));
  const actorDailySeries = buildAcreditacionAdvanceDailySeries(reports, "avance_general_dia", "Unidad", allowedActors);
  const isPhoneModel = isTelefonicoMonitoreoState(state);
  const phoneQuotaCards = useMemo(() => phoneQuotaCardsForDashboard(reports), [reports]);
  const cards = isPhoneModel && phoneQuotaCards.length ? phoneQuotaCards : actorCardsForDashboard({
    actorRows,
    sourceRows,
    dailyRows,
    actorDailySeries,
    goals: state?.config.goals ?? [],
    sources: state?.sources ?? [],
    progressRows: state?.dashboard?.progress ?? [],
  });
  const scopeLabel = isPhoneModel && phoneQuotaCards.length ? "Sede" : "Actor";
  const totals = advanceTotals(cards);
  const goals = actorGoalSummary(cards);
  const completionPct = safePercentValue(totals.effective, totals.universe);
  const generatedAt = reports.generated_at ? formatDate(reports.generated_at) : "";
  const mechanismTotal = cards.reduce((sum, card) => sum + card.mechanisms.length, 0);
  const unitCountLabel = scopeLabel === "Sede"
    ? `${fmt(cards.length)} sede${cards.length === 1 ? "" : "s"}`
    : `${fmt(cards.length)} actor${cards.length === 1 ? "" : "es"}`;
  const mechanismSummary = scopeLabel === "Sede"
    ? `${fmt(cards.filter((card) => card.meta != null).length)} metas`
    : `${fmt(mechanismTotal)} mecanismos`;
  const phoneQuotaWithMeta = cards.filter((card) => card.meta != null).length;
  const phoneQuotaReached = cards.filter((card) => card.meta != null && (card.missing ?? 0) <= 0).length;
  const reportCuts = useMemo(
    () => acreditacionReportCutsFromPhases(state?.config?.strategy_phases ?? []),
    [state?.config?.strategy_phases],
  );
  const reportWeekday = useMemo(
    () => acreditacionReportWeekdayFromPhases(state?.config?.strategy_phases ?? []),
    [state?.config?.strategy_phases],
  );

  if (isPhoneModel) {
    return (
      <section
        className="pulso-panel mon-fill-panel mon-strata-dashboard mon-actor-dashboard mon-phone-quota-lane-workbench"
        style={{ minHeight: 0, overflowY: "auto", scrollbarGutter: "stable" } as CSSProperties}
        aria-label={`Cuotas Kobo por ${scopeLabel.toLowerCase()}`}
      >
        <header className="pulso-panel-header">
          <div className="pulso-panel-heading">
            <span className="pulso-panel-eyebrow">Avance</span>
            <h2 className="pulso-panel-title"><span className="mon-title-icon"><Layers3 size={16} /> Cuotas Kobo por sede</span></h2>
            <p className="pulso-panel-hint">Meta, efectivas Kobo, pendiente por cumplir y ritmo diario fechable sin mezclarlo con estados telefónicos.</p>
          </div>
          <div className="pulso-panel-actions mon-actor-dashboard-actions">
            <span>{unitCountLabel}</span>
            <span>{mechanismSummary}</span>
            {generatedAt ? <span>{generatedAt}</span> : null}
          </div>
        </header>
        <AcreditacionPhoneQuotaRhythmBoard
          cards={cards}
          variable={scopeLabel}
          cutDate={reports.generated_at}
        />
        <AcreditacionPhoneQuotaLaneBoard
          cards={cards}
          totals={totals}
          generatedAt={generatedAt}
        />
      </section>
    );
  }

  return (
    <section
      className="pulso-panel mon-fill-panel mon-strata-dashboard mon-actor-dashboard"
      style={{ minHeight: 0, overflowY: "auto", scrollbarGutter: "stable" } as CSSProperties}
      aria-label={isPhoneModel ? `Cuotas Kobo por ${scopeLabel.toLowerCase()}` : "Avance canónico por actor"}
    >
      <header className="pulso-panel-header">
        <div className="pulso-panel-heading">
          <span className="pulso-panel-eyebrow">Avance</span>
          <h2 className="pulso-panel-title"><span className="mon-title-icon"><Layers3 size={16} /> {isPhoneModel ? `Cuotas Kobo por ${scopeLabel.toLowerCase()}` : `Avance por ${scopeLabel.toLowerCase()}`}</span></h2>
          <p className="pulso-panel-hint">{isPhoneModel ? `Meta, efectivas Kobo, pendiente por cumplir y base telefónica por ${scopeLabel.toLowerCase()}.` : `Universo, meta, brecha y fuentes por ${scopeLabel.toLowerCase()}.`}</p>
        </div>
        <div className="pulso-panel-actions mon-actor-dashboard-actions">
          <span>{unitCountLabel}</span>
          <span>{mechanismSummary}</span>
          {generatedAt ? <span>{generatedAt}</span> : null}
        </div>
      </header>
      <div className="mon-advance-hero mon-advance-hero--actors">
        <div className="mon-advance-hero-copy">
          <span>{isPhoneModel ? `Cuota por ${scopeLabel.toLowerCase()}` : `Corte por ${scopeLabel.toLowerCase()}`}</span>
          <strong>{fmt(totals.effective)} {isPhoneModel ? "efectivas Kobo" : "efectivas"} de {fmt(totals.universe)}</strong>
          <p>{isPhoneModel ? `Cada ${scopeLabel.toLowerCase()} muestra la base telefónica, la meta, las efectivas Kobo y lo que falta cumplir.` : `Lee cada ${scopeLabel.toLowerCase()} como una unidad operativa: universo/base, meta, avance real y mecanismos que alimentan el corte.`}</p>
        </div>
        <div className="mon-advance-hero-kpis">
          <AcreditacionAdvanceMetric label={scopeLabel === "Sede" ? "Sedes" : "Actores"} value={fmt(cards.length)} hint={mechanismSummary} tone="base" />
          <AcreditacionAdvanceMetric
            label={isPhoneModel ? "Cuotas cumplidas" : `Metas ${scopeLabel.toLowerCase()}`}
            value={isPhoneModel ? `${fmt(phoneQuotaReached)}/${fmt(phoneQuotaWithMeta || cards.length)}` : actorGoalValue(goals)}
            hint={isPhoneModel ? `${fmt(phoneQuotaWithMeta)} con meta Kobo` : actorGoalHint(goals)}
            tone={isPhoneModel ? (phoneQuotaWithMeta && phoneQuotaReached >= phoneQuotaWithMeta ? "ready" : "target") : actorGoalTone(goals)}
          />
          <AcreditacionAdvanceMetric label="Efectivas" value={fmt(totals.effective)} hint={`${formatPercentLabel(completionPct)} del universo`} tone="ready" />
          <AcreditacionAdvanceMetric
            label={isPhoneModel ? "Por barrer" : "Pendientes"}
            value={fmt(totals.pending)}
            hint={isPhoneModel ? "estado telefónico pendiente" : `${fmt(totals.partial)} parciales · ${fmt(totals.refusals)} rechazos`}
            tone={totals.pending ? "warning" : "base"}
          />
        </div>
      </div>
      <div className={`mon-actor-grid${isPhoneModel ? " mon-actor-grid--phone-quota" : ""}`}>
        {cards.length ? cards.map((card) => (
          <AcreditacionActorProgressCardView
            key={card.id}
            card={card}
            cutDate={reports.generated_at}
            reportCuts={reportCuts}
            reportWeekday={reportWeekday}
            scopeLabel={scopeLabel}
          />
        )) : (
          <EmptyPanel
            title={isPhoneModel ? "Sin cuotas operativas" : "Sin cortes operativos"}
            detail={isPhoneModel ? "El reporte telefónico aún no trae categorías de cuota para mostrar metas, efectivas Kobo y pendientes." : "El reporte de avance aún no trae actores para mostrar metas, fuentes y brechas."}
          />
        )}
      </div>
    </section>
  );
}

function acreditacionChannelKey(value: string): AcreditacionChannelToneKey {
  const normalized = normalizeSourceMatch(value);
  if (!normalized || normalized === "sin canal" || normalized === "sin dato" || normalized === "desconocido") return "desconocido";
  if (normalized.includes("kobo")) return "kobo";
  if (normalized.includes("telefon")) return "telefono";
  if (normalized.includes("presencial") || normalized.includes("qr")) return "presencial";
  if (normalized.includes("correo") || normalized.includes("email") || normalized.includes("mail")) return "correo";
  if (normalized.includes("whatsapp") || normalized.includes("sms") || normalized.includes("web") || normalized.includes("link") || normalized.includes("enlace")) return "enlace";
  return "desconocido";
}

export function acreditacionChannelLabel(value: string) {
  const key = acreditacionChannelKey(value);
  if (key === "correo") return "Correo";
  if (key === "telefono") return "Telefónico";
  if (key === "presencial") return "Ficha QR";
  if (key === "enlace") return "Enlace";
  if (key === "kobo") return "Kobo";
  return "Sin canal";
}

function acreditacionChannelDisplay(value: unknown, fallback = "Sin canal") {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const label = acreditacionChannelLabel(raw);
  return label === "Sin canal" ? raw : label;
}

function AcreditacionChannelBadge({ channel }: { channel: string }) {
  const key = acreditacionChannelKey(channel);
  const option = ACREDITACION_CHANNEL_OPTIONS.find((item) => item.key === key);
  const Icon = option?.icon ?? Route;
  return (
    <span className={`mon-channel-badge is-${key}`}>
      <Icon size={12} />
      {option?.label ?? acreditacionChannelLabel(channel)}
    </span>
  );
}

function surveySourceForAcreditacionId(sourceId: string, sources: MonitoreoSource[]) {
  const key = normalizeSourceMatch(sourceId);
  if (!key) return null;
  return sources.find((source) => normalizeSourceMatch(source.id) === key || normalizeSourceMatch(source.survey_id) === key) ?? null;
}

function surveySourceForAcreditacionTitle(title: string, sources: MonitoreoSource[]) {
  const key = normalizeSourceMatch(title);
  if (!key) return null;
  return sources.find((source) => [
    source.label,
    source.survey_title,
    source.dimensions?.survey_title,
    source.survey_id,
  ].some((value) => normalizeSourceMatch(value) === key))
    ?? sources.find((source) => {
      const label = normalizeSourceMatch(source.survey_title || source.dimensions?.survey_title || source.label);
      return label && (label.includes(key) || key.includes(label));
    })
    ?? null;
}

function addAcreditacionSurveyState(row: AcreditacionAdvanceSurveyRow, label: string, value: number) {
  if (!value) return;
  const existing = row.states.find((item) => normalizeSourceMatch(item.label) === normalizeSourceMatch(label));
  if (existing) existing.value += value;
  else row.states.push({ label, value });
}

function buildAcreditacionSurveyRows(
  sourceRows: Array<Record<string, unknown>>,
  sources: MonitoreoSource[] = [],
): AcreditacionAdvanceSurveyRow[] {
  const grouped = new Map<string, AcreditacionAdvanceSurveyRow>();
  sourceRows.forEach((row, index) => {
    const rawTitle = rowText(row, ["Fuente", "Encuesta", "Source"], `Encuesta ${index + 1}`).trim() || `Encuesta ${index + 1}`;
    const rowSourceId = rowText(row, ["source_id", "source id", "id fuente", "Source ID"], "");
    const source = (rowSourceId ? surveySourceForAcreditacionId(rowSourceId, sources) : null)
      ?? surveySourceForAcreditacionTitle(rawTitle, sources);
    const title = String(source?.survey_title ?? source?.dimensions?.survey_title ?? source?.label ?? rawTitle).trim() || rawTitle;
    const actor = String(source ? sourceActorLabel(source) : rowText(row, ["Actor", "Unidad", "Corte", "Carrera"], "Sin actor")).trim() || "Sin actor";
    const channel = String(source ? sourceChannelLabel(source) : rowText(row, ["Canal", "Modalidad", "Channel"], "Mixto")).trim() || "Mixto";
    const surveyId = String(source?.survey_id ?? rowText(row, ["survey_id", "survey id", "id encuesta", "Survey ID"], "")).trim();
    const sourceId = String(source?.id ?? rowSourceId ?? "").trim();
    const key = normalizeSourceMatch(sourceId || surveyId || title || rawTitle) || `survey-${index}`;
    const existing = grouped.get(key) ?? {
      id: key,
      sourceId,
      title,
      actor,
      channel,
      surveyId,
      total: 0,
      effective: 0,
      partial: 0,
      refusals: 0,
      states: [],
    };
    const effective = rowNumber(row, ["Efectivas", "Validas", "Válidas", "Completas", "Completed"], NaN);
    const partial = rowNumber(row, ["Parciales", "Partial"], NaN);
    const refusals = rowNumber(row, ["Rechazos plataforma", "Rechazos", "Rechazo", "Refusals"], NaN);
    const explicitTotal = rowNumber(row, ["Total respuestas", "Total", "Respuestas", "Casos"], NaN);
    const hasParts = Number.isFinite(effective) || Number.isFinite(partial) || Number.isFinite(refusals);
    const partsTotal = (Number.isFinite(effective) ? effective : 0)
      + (Number.isFinite(partial) ? partial : 0)
      + (Number.isFinite(refusals) ? refusals : 0);
    const total = Number.isFinite(explicitTotal) ? explicitTotal : partsTotal;
    const rawState = rowText(row, ["Estado", "Estatus"], "");

    if (hasParts) {
      const eff = Number.isFinite(effective) ? effective : 0;
      const part = Number.isFinite(partial) ? partial : 0;
      const ref = Number.isFinite(refusals) ? refusals : 0;
      existing.effective += eff;
      existing.partial += part;
      existing.refusals += ref;
      existing.total += Number.isFinite(explicitTotal) ? explicitTotal : eff + part + ref;
      addAcreditacionSurveyState(existing, "Efectivas", eff);
      addAcreditacionSurveyState(existing, "Parciales", part);
      addAcreditacionSurveyState(existing, "Rechazos", ref);
    } else if (rawState) {
      const tone = acreditacionSurveyStateTone(rawState);
      const value = Number.isFinite(total) ? total : 0;
      if (tone === "completed") existing.effective += value;
      if (tone === "partial") existing.partial += value;
      if (tone === "refusals") existing.refusals += value;
      existing.total += value;
      addAcreditacionSurveyState(existing, rawState, value);
    } else if (Number.isFinite(total) && total > 0) {
      existing.total += total;
      addAcreditacionSurveyState(existing, "Total respuestas", total);
    }
    grouped.set(key, existing);
  });
  return Array.from(grouped.values()).map((row) => ({
    ...row,
    states: row.states.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "es")),
  })).sort((a, b) => b.total - a.total || a.actor.localeCompare(b.actor, "es") || a.title.localeCompare(b.title, "es"));
}

function mergeAcreditacionSurveyRowsWithDailySeries(
  rows: AcreditacionAdvanceSurveyRow[],
  series: AcreditacionAdvanceDailySeries[],
) {
  const keys = new Set(rows.flatMap((row) => uniqueNormalizedKeys([row.sourceId, row.title, row.surveyId])));
  const out = rows.map((row) => {
    const match = series.find((item) => uniqueNormalizedKeys([item.sourceId, item.label]).some((key) => uniqueNormalizedKeys([row.sourceId, row.title, row.surveyId]).includes(key)));
    if (!match || row.total > 0) return row;
    return {
      ...row,
      total: match.total,
      effective: match.completed,
      partial: match.partial,
      refusals: match.refusals,
      states: [
        { label: "Efectivas", value: match.completed },
        { label: "Parciales", value: match.partial },
        { label: "Rechazos", value: match.refusals },
      ].filter((item) => item.value > 0),
    };
  });
  if (rows.length) return out;
  series.forEach((item, index) => {
    const itemKeys = uniqueNormalizedKeys([item.sourceId, item.label]);
    if (itemKeys.some((key) => keys.has(key))) return;
    itemKeys.forEach((key) => keys.add(key));
    out.push({
      id: itemKeys[0] || `daily-source-${index}`,
      sourceId: item.sourceId ?? "",
      title: item.label,
      actor: item.actor || "Sin actor",
      channel: item.channel || "Mixto",
      surveyId: "",
      total: item.total,
      effective: item.completed,
      partial: item.partial,
      refusals: item.refusals,
      states: [
        { label: "Efectivas", value: item.completed },
        { label: "Parciales", value: item.partial },
        { label: "Rechazos", value: item.refusals },
      ].filter((state) => state.value > 0),
    });
  });
  return out.sort((a, b) => b.total - a.total || a.actor.localeCompare(b.actor, "es") || a.title.localeCompare(b.title, "es"));
}

function groupAcreditacionSurveyRows(rows: AcreditacionAdvanceSurveyRow[]) {
  const grouped = new Map<string, { actor: string; rows: AcreditacionAdvanceSurveyRow[]; effective: number; partial: number; refusals: number; total: number }>();
  rows.forEach((row) => {
    const actor = row.actor || "Sin actor";
    const key = normalizeSourceMatch(actor) || "sin-actor";
    const current = grouped.get(key) ?? { actor, rows: [], effective: 0, partial: 0, refusals: 0, total: 0 };
    current.rows.push(row);
    current.effective += row.effective;
    current.partial += row.partial;
    current.refusals += row.refusals;
    current.total += row.total;
    grouped.set(key, current);
  });
  return Array.from(grouped.values()).map((group) => ({
    ...group,
    rows: group.rows.sort((a, b) => b.total - a.total || a.title.localeCompare(b.title, "es")),
  })).sort((a, b) => b.total - a.total || a.actor.localeCompare(b.actor, "es"));
}

function dailySeriesForSurvey(
  row: AcreditacionAdvanceSurveyRow,
  series: AcreditacionAdvanceDailySeries[],
) {
  const rowKeys = uniqueNormalizedKeys([row.sourceId, row.title, row.surveyId]);
  return series.find((item) => uniqueNormalizedKeys([item.sourceId, item.label]).some((key) => rowKeys.includes(key))) ?? null;
}

function AcreditacionAdvanceSurveyDailyChart({
  actor,
  row,
  daily,
  collectorSeries,
  cutDate,
  reportCuts = [],
  reportWeekday = "",
}: {
  actor: string;
  row: AcreditacionAdvanceSurveyRow;
  daily: AcreditacionAdvanceDailySeries | null;
  collectorSeries: AcreditacionAdvanceDailySeries[];
  cutDate?: string;
  reportCuts?: AcreditacionDailyReportCut[];
  reportWeekday?: MonitoreoReportWeekday | "";
}) {
  const collectors = useMemo(
    () => [...collectorSeries].sort((a, b) => (
      b.total - a.total
      || acreditacionCollectorSeriesDisplayName(a).localeCompare(acreditacionCollectorSeriesDisplayName(b), "es")
    )),
    [collectorSeries],
  );
  const [selectedCollectorId, setSelectedCollectorId] = useState("total");
  const selectedCollector = selectedCollectorId === "total"
    ? null
    : collectors.find((item) => item.id === selectedCollectorId) ?? null;
  const fallbackCollector = !daily ? collectors[0] ?? null : null;
  const active = selectedCollector ?? daily ?? fallbackCollector;
  const selectValue = selectedCollector?.id ?? (daily ? "total" : fallbackCollector?.id ?? "total");

  useEffect(() => {
    if (selectedCollectorId === "total") return;
    if (!collectors.some((item) => item.id === selectedCollectorId)) setSelectedCollectorId("total");
  }, [collectors, selectedCollectorId]);

  if (!active) return null;
  const isCollector = Boolean(selectedCollector) || (!daily && Boolean(fallbackCollector));
  const datedDays = active.points.filter((point) => parseAcreditacionDailyDate(point.date)).length;
  const collectorTotal = collectors.reduce((sum, item) => sum + item.total, 0);
  return (
    <div className="mon-advance-survey-chart-stack">
      {collectors.length ? (
        <label className="mon-advance-collector-switch">
          <span>Recopilador</span>
          <select value={selectValue} onChange={(event) => setSelectedCollectorId(event.currentTarget.value)}>
            {daily ? <option value="total">Encuesta completa</option> : null}
            {collectors.map((item) => (
              <option key={item.id} value={item.id} title={item.collectorId ? `ID ${item.collectorId}` : undefined}>
                {acreditacionCollectorSeriesDisplayName(item)} · {fmt(item.total)}
              </option>
            ))}
          </select>
          <em>{fmt(collectors.length)} recopilador{collectors.length === 1 ? "" : "es"} · {fmt(collectorTotal)} respuestas</em>
        </label>
      ) : null}
      <AcreditacionAdvanceDailyMini
        title={isCollector ? `${acreditacionCollectorSeriesDisplayName(active)} · ${row.title}` : row.title}
        points={active.points}
        variant="source"
        cutDate={cutDate}
        reportCuts={reportCuts}
        reportWeekday={reportWeekday}
      />
      <div className="mon-advance-daily-foot">
        <span><strong>{actor}</strong> · {acreditacionChannelLabel(row.channel)}</span>
        <span><strong>{fmt(datedDays)}</strong> días con fecha</span>
      </div>
    </div>
  );
}

function AcreditacionAdvanceSurveyCard({
  row,
  max,
  daily,
  collectorSeries,
  cutDate,
  reportCuts = [],
  reportWeekday = "",
}: {
  row: AcreditacionAdvanceSurveyRow;
  max: number;
  daily: AcreditacionAdvanceDailySeries | null;
  collectorSeries: AcreditacionAdvanceDailySeries[];
  cutDate?: string;
  reportCuts?: AcreditacionDailyReportCut[];
  reportWeekday?: MonitoreoReportWeekday | "";
}) {
  const width = row.total > 0 ? Math.max(3, Math.min(100, safePercentValue(row.total, max) ?? 0)) : 0;
  return (
    <article className="mon-advance-survey-card">
      <div className="mon-advance-survey-main">
        <header>
          <AcreditacionChannelBadge channel={row.channel} />
          <strong>{row.title}</strong>
          <span>{acreditacionChannelLabel(row.channel)}{row.surveyId ? ` · ${row.surveyId}` : ""}</span>
        </header>
        <div className="mon-advance-survey-meter" aria-label={`Respuestas de ${row.title}`}>
          <strong>{fmt(row.total)}</strong>
          <span>respuestas</span>
          <i style={{ "--advance-survey-total": `${width}%` } as CSSProperties} />
        </div>
        <div className="mon-advance-survey-states">
          {(row.states.length ? row.states : [
            { label: "Efectivas", value: row.effective },
            { label: "Parciales", value: row.partial },
            { label: "Rechazos", value: row.refusals },
          ]).slice(0, 4).map((state) => (
            <span key={`${row.id}-${state.label}`} className={`is-${acreditacionSurveyStateTone(state.label)}`}>
              <em>{state.label}</em>
              <strong>{fmt(state.value)}</strong>
            </span>
          ))}
        </div>
      </div>
      <AcreditacionAdvanceSurveyDailyChart
        actor={row.actor}
        row={row}
        daily={daily}
        collectorSeries={collectorSeries}
        cutDate={cutDate}
        reportCuts={reportCuts}
        reportWeekday={reportWeekday}
      />
    </article>
  );
}

function AcreditacionAdvancePhoneKoboCard({
  row,
  max,
  daily,
  cutDate,
  reportCuts = [],
  reportWeekday = "",
}: {
  row: AcreditacionAdvanceSurveyRow;
  max: number;
  daily: AcreditacionAdvanceDailySeries | null;
  cutDate?: string;
  reportCuts?: AcreditacionDailyReportCut[];
  reportWeekday?: MonitoreoReportWeekday | "";
}) {
  const effective = Math.max(row.effective, daily?.completed ?? 0);
  const responses = Math.max(row.total, daily?.total ?? effective);
  const width = responses > 0 ? Math.max(3, Math.min(100, safePercentValue(responses, max) ?? 0)) : 0;
  return (
    <article className="mon-advance-survey-card mon-advance-survey-card--phone">
      <div className="mon-advance-survey-main">
        <header>
          <AcreditacionChannelBadge channel="Kobo" />
          <strong>{row.title}</strong>
          <span>{row.surveyId || row.sourceId ? `Encuesta ${row.surveyId || row.sourceId}` : "Encuesta Kobo vinculada"}</span>
        </header>
        <div className="mon-advance-survey-meter" aria-label={`Efectivas Kobo de ${row.title}`}>
          <strong>{fmt(effective)}</strong>
          <span>efectivas Kobo</span>
          <i style={{ "--advance-survey-total": `${width}%` } as CSSProperties} />
        </div>
        <div className="mon-advance-phone-kobo-facts">
          <span className="is-effective"><em>Pasan filtro</em><strong>{fmt(effective)}</strong></span>
          <span><em>Respuestas Kobo</em><strong>{fmt(responses)}</strong></span>
        </div>
      </div>
      <div className="mon-advance-survey-chart-stack">
        {daily ? (
          <AcreditacionAdvanceDailyMini
            title={`Efectivas por día · ${row.title}`}
            points={daily.points}
            variant="source"
            cutDate={cutDate}
            reportCuts={reportCuts}
            reportWeekday={reportWeekday}
            effectiveOnly
          />
        ) : (
          <div className="mon-phone-kobo-no-chart">
            <CalendarRange size={16} />
            <strong>Sin fecha por encuesta</strong>
            <span>El corte trae efectivas Kobo, pero no una serie diaria para esta fuente.</span>
          </div>
        )}
      </div>
    </article>
  );
}

function AcreditacionAdvancePhoneKoboWorkbench({
  reports,
  state,
  rows,
  sourceDailySeries,
  reportCuts,
  reportWeekday,
}: {
  reports: MonitoreoAcreditacionReports;
  state?: MonitoreoState | null;
  rows: AcreditacionAdvanceSurveyRow[];
  sourceDailySeries: AcreditacionAdvanceDailySeries[];
  reportCuts: AcreditacionDailyReportCut[];
  reportWeekday: MonitoreoReportWeekday | "";
}) {
  const koboKeys = new Set((state?.sources ?? [])
    .filter(isKoboResponseSource)
    .flatMap((source) => uniqueNormalizedKeys([source.id, source.survey_id, source.label, source.survey_title, source.dimensions?.survey_title])));
  const koboRows = koboKeys.size
    ? rows.filter((row) => uniqueNormalizedKeys([row.sourceId, row.surveyId, row.title]).some((key) => koboKeys.has(key)))
    : rows;
  const comparisonRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["comparacion_codpulso", "campo_vs_plataforma_codpulso"]);
  const comparison = phonePlatformComparisonTotals(comparisonRows);
  const statusRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["estatus_telefonico"]);
  const quotaRows = phoneQuotaRowsForPanel(rowsForSheetBlock(reports, "monitoreo_telefonico", ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"]));
  const filter = normalizePhoneEffectiveFilter(state?.config?.monitoreo_profile?.platform_effective_filter);
  const filterConfigured = Boolean(filter.enabled && filter.variable && filter.values.length);
  const totalEffective = comparison.platformComplete || koboRows.reduce((sum, row) => sum + Math.max(row.effective, dailySeriesForSurvey(row, sourceDailySeries)?.completed ?? 0), 0);
  const totalResponses = koboRows.reduce((sum, row) => sum + Math.max(row.total, dailySeriesForSurvey(row, sourceDailySeries)?.total ?? 0), 0) || totalEffective;
  const max = Math.max(1, totalResponses, ...koboRows.map((row) => row.total), ...sourceDailySeries.map((series) => series.total));
  const statusTotal = Math.max(1, statusRows.reduce((sum, row) => sum + phoneRowNumber(row, ["Casos", "Valor", "Total"], 0), 0));
  const statusItems = statusRows.map((row, index) => ({
    key: `${phoneRowValue(row, ["Estado", "Estatus", "Indicador"], `Estado ${index + 1}`)}-${index}`,
    label: phoneRowValue(row, ["Estado", "Estatus", "Indicador"], `Estado ${index + 1}`),
    value: phoneRowNumber(row, ["Casos", "Valor", "Total"], 0),
  })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);
  const quotaVariable = preferredPhoneAdvanceQuotaVariable(quotaRows);
  const quotaPreview = (quotaVariable ? quotaRows.filter((row) => row.variable === quotaVariable) : quotaRows)
    .slice(0, 5);
  const generatedAt = reports.generated_at ? formatDate(reports.generated_at) : "";
  return (
    <section
      className="pulso-panel mon-fill-panel mon-advance-panel mon-advance-surveys mon-advance-phone-kobo"
      style={{ minHeight: 0, overflowY: "auto", scrollbarGutter: "stable" } as CSSProperties}
      aria-label="Avance telefónico por Kobo"
    >
      <header className="pulso-panel-header">
        <div className="pulso-panel-heading">
          <span className="pulso-panel-eyebrow">Avance</span>
          <h2 className="pulso-panel-title"><span className="mon-title-icon"><QrCode size={16} /> Kobo efectivo</span></h2>
          <p className="pulso-panel-hint">Kobo manda el avance; el barrido telefónico se lee en paralelo como estado de consulta.</p>
        </div>
        <div className="pulso-panel-actions mon-advance-meta">
          <span>{fmt(koboRows.length)} encuesta{koboRows.length === 1 ? "" : "s"} Kobo</span>
          {generatedAt ? <span>{generatedAt}</span> : null}
        </div>
      </header>
      <div className="mon-advance-hero mon-advance-hero--surveys">
        <div className="mon-advance-hero-copy">
          <span>Fuente rectora</span>
          <strong>{fmt(totalEffective)} efectivas Kobo</strong>
          <p>Cuenta solo respuestas completas que pasan el filtro configurado. La coincidencia con llamadas se verifica por CodPulso, no por suma agregada.</p>
        </div>
        <div className="mon-advance-hero-kpis">
          <AcreditacionAdvanceMetric label="Kobo" value={fmt(totalEffective)} hint={filterConfigured ? "filtro aplicado" : "filtro pendiente"} tone={filterConfigured ? "ready" : "warning"} />
          <AcreditacionAdvanceMetric label="Barrido efectivo" value={fmt(comparison.phoneEffective)} hint="declarado en base" tone="base" />
          <AcreditacionAdvanceMetric label="CodPulso" value={phoneCodPulsoEffectiveMatchLabel(comparison)} hint={comparison.mismatch ? `${fmt(comparison.mismatch)} diferencias` : `${fmt(comparisonRows.length)} llaves trazadas`} tone={comparison.mismatch ? "warning" : "ready"} />
          <AcreditacionAdvanceMetric label="Cuotas" value={quotaRows.length ? fmt(quotaRows.length) : "S/D"} hint={quotaVariable || "sin variable"} tone={quotaRows.length ? "target" : "base"} />
        </div>
      </div>
      <div className="mon-phone-kobo-parallel">
        <section className="mon-phone-kobo-status-panel" aria-label="Estados telefónicos paralelos">
          <header>
            <span>Estados telefónicos</span>
            <strong>Barrido como consulta</strong>
            <em>Estos estados explican operación; no reemplazan la efectiva Kobo.</em>
          </header>
          <div>
            {statusItems.length ? statusItems.map((item) => (
              <span key={item.key}>
                <small>{item.label}</small>
                <i style={{ "--phone-status-pct": `${Math.max(2, Math.min(100, safePercentValue(item.value, statusTotal) ?? 0))}%` } as CSSProperties} />
                <strong>{fmt(item.value)}</strong>
              </span>
            )) : (
              <em>Sin distribución de estados telefónicos en el corte.</em>
            )}
          </div>
        </section>
        <section className="mon-phone-kobo-status-panel mon-phone-kobo-status-panel--quota" aria-label="Cuotas telefónicas">
          <header>
            <span>Cuotas</span>
            <strong>{quotaVariable || "Variable pendiente"}</strong>
            <em>Meta visual para saber cuánto falta cumplir por categoría.</em>
          </header>
          <div>
            {quotaPreview.length ? quotaPreview.map((row) => {
              const pctValue = row.advancePct ?? safePercentValue(row.effective, row.meta ?? row.universe) ?? 0;
              return (
                <span key={row.key}>
                  <small>{row.value}</small>
                  <i style={{ "--phone-status-pct": `${Math.max(2, Math.min(100, pctValue))}%` } as CSSProperties} />
                  <strong>{row.gap == null ? fmt(row.effective) : `${fmt(row.gap)} faltan`}</strong>
                </span>
              );
            }) : (
              <em>Sin cuotas por variable en el corte.</em>
            )}
          </div>
        </section>
      </div>
      <div className="mon-advance-survey-actor-stack">
        {koboRows.length ? (
          <article className="mon-advance-survey-actor-card mon-advance-survey-actor-card--phone">
            <header className="mon-advance-survey-actor-head">
              <div>
                <span>Instrumentos Kobo</span>
                <strong>Efectivas filtradas</strong>
                <em>{fmt(totalResponses)} respuestas Kobo leídas · {filterConfigured ? `${filter.variable} = ${filter.values[0]}` : "elige filtro de consentimiento"}</em>
              </div>
              <div className="mon-advance-survey-actor-kpis mon-advance-survey-actor-kpis--phone">
                <span className="is-effective"><em>Efectivas</em><strong>{fmt(totalEffective)}</strong></span>
                <span><em>Encuestas</em><strong>{fmt(koboRows.length)}</strong></span>
              </div>
            </header>
            <div className="mon-advance-survey-actor-sources">
              {koboRows.map((row) => (
                <AcreditacionAdvancePhoneKoboCard
                  key={row.id}
                  row={row}
                  max={max}
                  daily={dailySeriesForSurvey(row, sourceDailySeries)}
                  cutDate={reports.generated_at}
                  reportCuts={reportCuts}
                  reportWeekday={reportWeekday}
                />
              ))}
            </div>
          </article>
        ) : (
          <EmptyPanel title="Sin encuesta Kobo activa" detail="Selecciona la encuesta Kobo en Fuentes para que el avance tenga una fuente rectora." />
        )}
      </div>
    </section>
  );
}

function AcreditacionAdvanceSurveysWorkbench({
  reports,
  state,
  sourceRows,
}: {
  reports: MonitoreoAcreditacionReports;
  state?: MonitoreoState | null;
  sourceRows: Array<Record<string, unknown>>;
}) {
  const sourceDailySeries = useMemo(() => {
    const fromReport = buildAcreditacionAdvanceDailySourceSeries(reports);
    const fallbackRows = [
      ...((reports.client_report?.sources ?? []) as Array<Record<string, unknown>>),
      ...rowsFromSheets(reports.sheets, ["fuente"]),
    ];
    return fromReport.length
      ? fromReport
      : buildAcreditacionDailySourceSeriesFromRows(fallbackRows);
  }, [reports]);
  const collectorDailySeries = useMemo(() => {
    const fromReport = buildAcreditacionAdvanceDailyCollectorSeries(reports);
    const fallbackRows = [
      ...((reports.client_report?.collector_sources ?? []) as Array<Record<string, unknown>>),
      ...rowsFromSheets(reports.sheets, ["recopilador", "collector"]),
    ];
    const fromRows = buildAcreditacionDailyCollectorSeriesFromRows(fallbackRows);
    const fromCases = buildAcreditacionDailyCollectorSeriesFromInternalQueries(reports);
    const rawSeries = fromReport.length
      ? fromReport
      : fromRows.length
        ? fromRows
        : fromCases;
    return applyAcreditacionCollectorDisplayNames(
      rawSeries,
      state?.sources ?? [],
      state?.config?.operational_model?.link_collectors ?? [],
    );
  }, [reports, state?.config?.operational_model?.link_collectors, state?.sources]);
  const rows = useMemo(() => mergeAcreditacionSurveyRowsWithDailySeries(
    buildAcreditacionSurveyRows(sourceRows, state?.sources ?? []),
    sourceDailySeries,
  ), [sourceRows, state?.sources, sourceDailySeries]);
  const groups = useMemo(() => groupAcreditacionSurveyRows(rows), [rows]);
  const collectorsBySource = useMemo(() => groupAcreditacionCollectorsBySource(collectorDailySeries), [collectorDailySeries]);
  const max = Math.max(1, ...rows.map((row) => row.total), ...sourceDailySeries.map((series) => series.total));
  const channelCount = uniqueDisplayValues(rows.map((row) => acreditacionChannelLabel(row.channel))).length;
  const totalEffective = rows.reduce((sum, row) => sum + row.effective, 0);
  const totalResponses = rows.reduce((sum, row) => sum + row.total, 0);
  const totalPartial = rows.reduce((sum, row) => sum + row.partial, 0);
  const totalRefusals = rows.reduce((sum, row) => sum + row.refusals, 0);
  const totalCollectors = collectorDailySeries.length;
  const generatedAt = reports.generated_at ? formatDate(reports.generated_at) : "";
  const reportCuts = useMemo(
    () => acreditacionReportCutsFromPhases(state?.config?.strategy_phases ?? []),
    [state?.config?.strategy_phases],
  );
  const reportWeekday = useMemo(
    () => acreditacionReportWeekdayFromPhases(state?.config?.strategy_phases ?? []),
    [state?.config?.strategy_phases],
  );
  if (isTelefonicoMonitoreoState(state)) {
    return (
      <AcreditacionAdvancePhoneKoboWorkbench
        reports={reports}
        state={state}
        rows={rows}
        sourceDailySeries={sourceDailySeries}
        reportCuts={reportCuts}
        reportWeekday={reportWeekday}
      />
    );
  }
  return (
    <section
      className="pulso-panel mon-fill-panel mon-advance-panel mon-advance-surveys"
      style={{ minHeight: 0, overflowY: "auto", scrollbarGutter: "stable" } as CSSProperties}
      aria-label="Avance canónico por encuesta y canal"
    >
      <header className="pulso-panel-header">
        <div className="pulso-panel-heading">
          <span className="pulso-panel-eyebrow">Avance</span>
          <h2 className="pulso-panel-title"><span className="mon-title-icon"><QrCode size={16} /> Encuestas, canales y recopiladores</span></h2>
          <p className="pulso-panel-hint">Fuentes exactas integradas por actor, canal y ritmo diario de respuesta.</p>
        </div>
        <div className="pulso-panel-actions mon-advance-meta">
          <span>{fmt(rows.length)} fuentes</span>
          {generatedAt ? <span>{generatedAt}</span> : null}
        </div>
      </header>
      <div className="mon-advance-hero mon-advance-hero--surveys">
        <div className="mon-advance-hero-copy">
          <span>Fuentes y canales</span>
          <strong>{fmt(totalEffective)} efectivas de {fmt(totalResponses)} respuestas</strong>
          <p>Integra la producción por encuesta, canal y recopilador para distinguir qué plataforma sostiene el avance de cada actor.</p>
        </div>
        <div className="mon-advance-hero-kpis">
          <AcreditacionAdvanceMetric label="Fuentes" value={fmt(rows.length)} hint={`${fmt(channelCount)} canales · ${fmt(groups.length)} actores`} tone="base" />
          <AcreditacionAdvanceMetric label="Efectivas" value={fmt(totalEffective)} hint={`${fmt(totalPartial)} parciales`} tone="ready" />
          <AcreditacionAdvanceMetric label="Rechazos" value={fmt(totalRefusals)} hint={totalCollectors ? `${fmt(totalCollectors)} recopiladores` : "sin serie por recopilador"} tone={totalRefusals ? "warning" : "base"} />
          <AcreditacionAdvanceMetric label="Recopiladores" value={fmt(totalCollectors)} hint={totalCollectors ? "selección diaria disponible" : `${fmt(totalResponses)} respuestas`} tone={totalCollectors ? "ready" : "target"} />
        </div>
      </div>
      {groups.length ? (
        <div className="mon-advance-survey-actor-stack">
          {groups.map((group) => (
            <article key={normalizeSourceMatch(group.actor)} className="mon-advance-survey-actor-card">
              <header className="mon-advance-survey-actor-head">
                <div>
                  <span>Actor</span>
                  <strong>{group.actor}</strong>
                  <em>{fmt(group.rows.length)} fuentes exactas · {fmt(group.total)} respuestas</em>
                </div>
                <div className="mon-advance-survey-actor-kpis">
                  <span className="is-effective"><em>Efectivas</em><strong>{fmt(group.effective)}</strong></span>
                  <span className="is-partial"><em>Parciales</em><strong>{fmt(group.partial)}</strong></span>
                  <span className="is-refusals"><em>Rechazos</em><strong>{fmt(group.refusals)}</strong></span>
                </div>
              </header>
              <div className="mon-advance-survey-actor-sources">
                {group.rows.map((row) => {
                  const daily = dailySeriesForSurvey(row, sourceDailySeries);
                  const collectorSeries = acreditacionCollectorsForSurvey(row, collectorsBySource);
                  return (
                    <AcreditacionAdvanceSurveyCard
                      key={row.id}
                      row={row}
                      max={max}
                      daily={daily}
                      collectorSeries={collectorSeries}
                      cutDate={reports.generated_at}
                      reportCuts={reportCuts}
                      reportWeekday={reportWeekday}
                    />
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyPanel title="Sin respuestas de fuentes" detail="Sincroniza las fuentes de plataforma o barrido para ver este desglose por canal." />
      )}
    </section>
  );
}

function AcreditacionAdvanceFocus({ cards, scopeLabel = "Actor" }: { cards: AcreditacionAdvanceCard[]; scopeLabel?: string }) {
  const ranked = [...cards].sort((a, b) => (b.missing ?? -1) - (a.missing ?? -1) || b.universe - a.universe).slice(0, 5);
  const totals = advanceTotals(cards);
  const isPhoneQuotaScope = scopeLabel !== "Actor";
  return (
    <section className="mon-advance-focus" aria-label={`${scopeLabel}s y ${isPhoneQuotaScope ? "pendientes" : "brechas"}`}>
      <header>
        <span>{scopeLabel}</span>
        <strong>
          {totals.brechas
            ? `${fmt(totals.brechas)} ${isPhoneQuotaScope ? "con pendiente" : "con brecha"}`
            : `${fmt(totals.metas)} metas cubiertas`}
        </strong>
      </header>
      <div>
        {ranked.length ? ranked.map((card) => {
          const progress = card.progress ?? card.coverage ?? 0;
          const metaLabel = card.meta == null
            ? "Meta pendiente"
            : card.missing && card.missing > 0
              ? `${fmt(card.missing)} faltan de ${fmt(card.meta)}`
              : `Meta ${fmt(card.meta)} cubierta`;
          return (
            <article key={card.id} className={`is-${card.statusTone}`}>
              <div>
                <strong>{card.actor}</strong>
                <span>{fmt(card.effective)} efectivas · {fmt(card.universe)} universo</span>
              </div>
              <em>{metaLabel}</em>
              <i style={{ "--advance-focus-pct": `${Math.max(0, Math.min(100, progress))}%` } as CSSProperties} />
            </article>
          );
        }) : (
          <EmptyPanel title={`Sin ${scopeLabel.toLowerCase()}s`} detail={`No hay cortes por ${scopeLabel.toLowerCase()} para priorizar ${isPhoneQuotaScope ? "pendientes" : "brechas"}.`} />
        )}
      </div>
    </section>
  );
}

function controlVariableRows(
  reports: MonitoreoAcreditacionReports | null | undefined,
  fallbackRows: Array<Record<string, unknown>> = [],
): AcreditacionControlVariableRow[] {
  const block = reportBlockForSheet(reports, "reporte", "detalle_variables_control")
    ?? reportBlockForSheet(reports, "cliente_variables_control", "variables_control");
  const sourceRows = block?.rows.length ? block.rows : fallbackRows;
  const rows = sourceRows.map((row) => {
    const record = row as Record<string, unknown>;
    const actor = rowText(record, ["actor", "unidad", "corte", "carrera"], "").trim();
    const variable = rowText(record, ["variable", "variable control", "variable_control", "control", "segmento"], "").trim();
    const value = rowText(record, ["valor", "categoria", "categoría", "nivel", "segmento", "grupo"], "").trim();
    const universe = rowNumber(record, ["universo", "base reportada", "base", "total"], 0);
    const effective = rowNumber(record, ["efectivas", "validas", "válidas", "completas"], 0);
    const partial = rowNumber(record, ["parciales", "partial"], 0);
    const refusals = rowNumber(record, ["rechazos plataforma", "rechazos", "rechazo"], 0);
    const unanswered = rowNumber(record, ["sin respuesta plataforma", "sin respuesta", "pendientes"], Math.max(0, universe - effective - partial - refusals));
    return {
      actor,
      variable,
      value,
      universe,
      effective,
      partial,
      refusals,
      unanswered,
      baseShare: null,
      effectiveShare: null,
      deltaPp: null,
    };
  }).filter((row) => row.actor && row.variable && row.value && row.universe > 0);

  const totals = new Map<string, { universe: number; effective: number }>();
  rows.forEach((row) => {
    const key = `${normalizeReportMatch(row.actor)}::${normalizeReportMatch(row.variable)}`;
    const current = totals.get(key) ?? { universe: 0, effective: 0 };
    current.universe += row.universe;
    current.effective += row.effective;
    totals.set(key, current);
  });

  return rows.map((row) => {
    const totalsForVariable = totals.get(`${normalizeReportMatch(row.actor)}::${normalizeReportMatch(row.variable)}`);
    const baseShare = totalsForVariable && totalsForVariable.universe > 0 ? (row.universe / totalsForVariable.universe) * 100 : null;
    const effectiveShare = totalsForVariable && totalsForVariable.effective > 0 ? (row.effective / totalsForVariable.effective) * 100 : null;
    const deltaPp = baseShare != null && effectiveShare != null ? effectiveShare - baseShare : null;
    return { ...row, baseShare, effectiveShare, deltaPp };
  }).sort((a, b) => a.actor.localeCompare(b.actor, "es") || a.variable.localeCompare(b.variable, "es") || a.value.localeCompare(b.value, "es", { numeric: true }));
}

function groupControlVariableRows(rows: AcreditacionControlVariableRow[]) {
  const actorMap = new Map<string, Map<string, AcreditacionControlVariableRow[]>>();
  rows.forEach((row) => {
    const variables = actorMap.get(row.actor) ?? new Map<string, AcreditacionControlVariableRow[]>();
    const values = variables.get(row.variable) ?? [];
    values.push(row);
    variables.set(row.variable, values);
    actorMap.set(row.actor, variables);
  });
  return Array.from(actorMap.entries()).map(([actor, variables]) => ({
    actor,
    variables: Array.from(variables.entries()).map(([variable, variableRows]) => ({
      variable,
      rows: variableRows.sort((a, b) => b.universe - a.universe || a.value.localeCompare(b.value, "es", { numeric: true })),
    })),
  }));
}

function AcreditacionControlVariablesPanel({
  reports,
  fallbackRows,
}: {
  reports: MonitoreoAcreditacionReports | null | undefined;
  fallbackRows?: Array<Record<string, unknown>>;
}) {
  const rows = controlVariableRows(reports, fallbackRows);
  const groups = groupControlVariableRows(rows);
  const totalVariables = groups.reduce((sum, group) => sum + group.variables.length, 0);
  if (!rows.length) {
    return (
      <section className="pulso-panel mon-control-detail-panel" aria-label="Variables de control">
        <header className="pulso-panel-header">
          <div className="pulso-panel-heading">
            <span className="pulso-panel-eyebrow">Variables de control</span>
            <h2 className="pulso-panel-title"><span className="mon-title-icon"><SlidersHorizontal size={16} /> Distribución del corte</span></h2>
          </div>
        </header>
        <div className="mon-control-detail-brief">
          <div>
            <span>Lectura de representatividad</span>
            <strong>Sin variables de control detectadas</strong>
            <p>Cuando el corte incluya variables como año de egreso, dedicación o área, aparecerá la comparación entre universo y corte efectivo.</p>
          </div>
          <div className="mon-control-detail-legend" aria-label="Leyenda de variables de control">
            <span className="is-base">Universo</span>
            <span className="is-effective">Corte efectivo</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="pulso-panel mon-control-detail-panel" aria-label="Variables de control">
      <header className="pulso-panel-header">
        <div className="pulso-panel-heading">
          <span className="pulso-panel-eyebrow">Variables de control</span>
          <h2 className="pulso-panel-title"><span className="mon-title-icon"><SlidersHorizontal size={16} /> Universo vs corte efectivo</span></h2>
        </div>
        <div className="pulso-panel-actions mon-control-detail-meta">
          <span>{groups.length} actores</span>
          <span>{totalVariables} variables</span>
        </div>
      </header>
      <div className="mon-control-detail-brief">
        <div>
          <span>Lectura de representatividad</span>
          <strong>Proporción esperada frente a proporción lograda</strong>
          <p>Compara cuánto pesa cada categoría dentro del universo y cuánto pesa dentro de las efectivas del corte. No mide cobertura de la categoría, mide similitud de composición.</p>
        </div>
        <div className="mon-control-detail-legend" aria-label="Leyenda de variables de control">
          <span className="is-base">Universo</span>
          <span className="is-effective">Corte efectivo</span>
          <span className="is-partial">Parciales</span>
          <span className="is-refusals">Rechazos</span>
        </div>
      </div>
      <div className="mon-control-detail-grid">
        {groups.map((group) => (
          <section key={group.actor} className="mon-control-actor-card">
            <header>
              <div>
                <span>Actor</span>
                <strong>{group.actor}</strong>
              </div>
              <em>{group.variables.length} variable{group.variables.length === 1 ? "" : "s"}</em>
            </header>
            {group.variables.map((variable) => (
              <article key={`${group.actor}-${variable.variable}`} className="mon-control-variable-card">
                <header>
                  <div>
                    <span>Variable de control</span>
                    <strong>{variable.variable}</strong>
                  </div>
                  <em>{formatMetric(variable.rows.reduce((sum, row) => sum + row.universe, 0))} universo</em>
                </header>
                <div className="mon-control-variable-rows">
                  {variable.rows.map((row) => (
                    <AcreditacionControlVariableComparisonRow key={`${group.actor}-${variable.variable}-${row.value}`} row={row} />
                  ))}
                </div>
              </article>
            ))}
          </section>
        ))}
      </div>
    </section>
  );
}

function AcreditacionControlVariableComparisonRow({ row }: { row: AcreditacionControlVariableRow }) {
  const basePct = row.baseShare;
  const effectivePct = row.effectiveShare;
  const delta = row.deltaPp;
  const tone = delta == null || Math.abs(delta) <= 4 ? "steady" : delta > 0 ? "over" : "under";
  return (
    <div className={`mon-control-variable-row is-${tone}`}>
      <div className="mon-control-variable-label">
        <strong>{row.value}</strong>
        <span>{formatMetric(row.effective)} efectivas · {formatMetric(row.universe)} en universo</span>
      </div>
      <div className="mon-control-variable-bars" aria-label={`${row.value}: ${formatPercentLabel(basePct)} del universo y ${formatPercentLabel(effectivePct)} del corte efectivo`}>
        <span className="is-base">
          <em>Universo</em>
          <i style={{ "--control-pct": `${Math.max(1, Math.min(100, basePct ?? 0))}%` } as CSSProperties} />
          <strong>{formatPercentLabel(basePct)}</strong>
        </span>
        <span className="is-effective">
          <em>Corte</em>
          <i style={{ "--control-pct": `${Math.max(1, Math.min(100, effectivePct ?? 0))}%` } as CSSProperties} />
          <strong>{formatPercentLabel(effectivePct)}</strong>
        </span>
      </div>
      <div className="mon-control-variable-kpis">
        <span className="is-partial"><em>Parciales</em><strong>{formatMetric(row.partial)}</strong></span>
        <span className="is-refusals"><em>Rechazos</em><strong>{formatMetric(row.refusals)}</strong></span>
        <span className={`is-delta is-${tone}`}><em>Desvío</em><strong>{formatSignedPp(delta)}</strong></span>
      </div>
    </div>
  );
}

function clientReportSheetsForPanel(client: MonitoreoAcreditacionReports["client_report"] | null | undefined) {
  if (!client) return [];
  const mainBlocks: MonitoreoReportBlock[] = [];
  if (client.actors?.length) {
    mainBlocks.push({
      id: "resumen_actor",
      title: "Resumen por actor",
      columns: compactColumns(client.actors as Array<Record<string, unknown>>, ["Actor", "Universo", "Efectivas", "Parciales", "Rechazos plataforma", "Sin respuesta", "Avance universo", "Meta", "Brecha meta"]),
      rows: client.actors,
    });
  }
  if (client.daily_general?.length) {
    mainBlocks.push({
      id: "avance_diario",
      title: "Avance diario general",
      columns: compactColumns(client.daily_general as Array<Record<string, unknown>>, ["Fecha", "Efectivas", "Parciales", "Rechazos plataforma", "Total respuestas", "Acumulado"]),
      rows: client.daily_general,
    });
  }
  if (client.controls?.length) {
    mainBlocks.push({
      id: "variables_control",
      title: "Distribución por variable de control",
      columns: compactColumns(client.controls as Array<Record<string, unknown>>, ["Actor", "Variable", "Valor", "Universo", "Efectivas", "Parciales", "Rechazos plataforma", "% base", "% efectivas", "Diferencia pp"]),
      rows: client.controls,
    });
  }
  const out: MonitoreoReportSheet[] = [];
  if (mainBlocks.length) {
    out.push({
      id: "reporte",
      title: "Reporte",
      description: "Integra avance por actor, cortes diarios, distribución y brechas de respuesta desde el client_report del corte.",
      scope: "cliente",
      blocks: mainBlocks,
    });
  }
  if (client.sources?.length) {
    out.push({
      id: "avance_encuesta",
      title: "Encuestas",
      description: "Producción de respuestas por fuente y canal para revisar qué plataformas aportan al avance.",
      scope: "cliente",
      blocks: [{
        id: "fuentes_actor",
        title: "Fuentes por actor",
        columns: compactColumns(client.sources as Array<Record<string, unknown>>, ["Actor", "Canal", "Fuente", "Efectivas", "Parciales", "Rechazos plataforma", "Total respuestas", "Primer día", "Última respuesta"]),
        rows: client.sources,
      }],
    });
  }
  return out;
}

function reportSheetsForPanel(reports: MonitoreoAcreditacionReports | null | undefined) {
  const sheets = reports?.sheets ?? [];
  const byId = new Map(sheets.map((sheet) => [normalizeReportMatch(sheet.id), sheet]));
  const report = byId.get("reporte");
  const summary = byId.get("resumen");
  const survey = byId.get("avance_encuesta");
  const reportBlocks = report?.blocks?.length ? report.blocks : summary?.blocks ?? [];
  const blocks = [...reportBlocks];
  const distribution = summary?.blocks.find((block) => normalizeReportMatch(block.id) === "distribucion_egresados");
  if (distribution && !blocks.some((block) => normalizeReportMatch(block.id) === normalizeReportMatch(distribution.id))) blocks.push(distribution);
  const mainReport: MonitoreoReportSheet | null = (report ?? summary) ? {
    ...(report ?? summary)!,
    id: "reporte",
    title: "Reporte",
    description: "Integra avance por actor, cortes diarios, distribución y brechas de respuesta en una sola lectura.",
    scope: "estudio",
    blocks,
  } : null;
  const panelSheets = [
    mainReport,
    survey ? {
      ...survey,
      title: "Encuestas",
      description: "Producción de respuestas por encuesta y canal para revisar qué plataformas aportan al avance.",
      scope: "estudio",
    } : null,
  ].filter((sheet): sheet is MonitoreoReportSheet => Boolean(sheet));
  return panelSheets.length ? panelSheets : clientReportSheetsForPanel(reports?.client_report);
}

function reportPanelSheetTitle(sheet: MonitoreoReportSheet) {
  if (normalizeReportMatch(sheet.id) === "reporte" || normalizeReportMatch(sheet.id) === "resumen") return "Reporte";
  if (normalizeReportMatch(sheet.id) === "avance_encuesta") return "Encuestas";
  return sheet.title.replace(/\binterno\b/gi, "").replace(/\s{2,}/g, " ").trim();
}

function reportPanelSheetDescription(sheet: MonitoreoReportSheet) {
  if (normalizeReportMatch(sheet.id) === "reporte" || normalizeReportMatch(sheet.id) === "resumen") {
    return "Integra avance por actor, cortes diarios, distribución y brechas de respuesta en una sola lectura.";
  }
  if (normalizeReportMatch(sheet.id) === "avance_encuesta") {
    return "Producción de respuestas por encuesta y canal para revisar qué plataformas aportan al avance.";
  }
  return sheet.description.replace(/\bProsecnur\b/gi, "").replace(/\binterno\b/gi, "").replace(/\s{2,}/g, " ").trim();
}

function reportPanelScopeLabel(scope: string) {
  if (scope === "cliente") return "Reporte";
  if (scope === "estudio") return "Corte del estudio";
  return "Corte operativo";
}

function reportColumnDisplayLabel(column: string) {
  const normalized = normalizeReportMatch(column);
  if (normalized === "actor") return "Actor";
  if (normalized === "actores") return "Actores";
  return columnLabel(column);
}

function reportSheetTone(id: string) {
  const key = normalizeReportMatch(id);
  if (key.includes("alert")) return "risk";
  if (key.includes("telefon")) return "phone";
  if (key.includes("encuesta")) return "survey";
  if (key.includes("reporte")) return "report";
  return "summary";
}

function reportBlockTone(blockId: string, sheetId: string) {
  const id = normalizeReportMatch(`${sheetId} ${blockId}`);
  if (id.includes("alert")) return "risk";
  if (id.includes("telefon") || id.includes("estatus") || id.includes("responsable")) return "phone";
  if (id.includes("encuesta")) return "survey";
  if (id.includes("dia") || id.includes("avance")) return "trend";
  return "summary";
}

function sheetTitleIcon(id: string) {
  const key = normalizeReportMatch(id);
  if (key.includes("alert")) return <ShieldAlert size={14} />;
  if (key.includes("telefon")) return <PhoneCall size={14} />;
  if (key.includes("reporte")) return <FileCheck2 size={14} />;
  if (key.includes("encuesta")) return <BarChart3 size={14} />;
  return <ClipboardCheck size={14} />;
}

function buildReportSheetStats(sheet: MonitoreoReportSheet) {
  const totalRows = sheet.blocks.reduce((sum, block) => sum + block.rows.length, 0);
  const mainMetric = sheet.blocks.map(reportBlockMetric).find((metric) => metric.tone !== "neutral") ?? reportBlockMetric(sheet.blocks[0]);
  return [
    { label: "Bloques", value: fmt(sheet.blocks.length) },
    { label: "Filas", value: fmt(totalRows) },
    { label: mainMetric.label, value: mainMetric.value },
  ];
}

function shortColumnLabel(column: string) {
  return column.replace(/^% del /i, "% ").replace(/^Avance /i, "").slice(0, 18);
}

function reportBlockMetric(block?: MonitoreoReportBlock) {
  if (!block || !block.rows.length) return { label: "Filas", value: "0", tone: "neutral" };
  const cols = reportBlockColumns(block);
  const pick = (candidates: string[]) => cols.find((column) => {
    const normalized = normalizeReportMatch(column);
    return candidates.some((candidate) => normalized.includes(candidate));
  });
  const pctCol = pick(["avance total", "avance minimo", "porcentaje", "del total", "universo", "efectivas"]);
  if (pctCol) {
    const values = block.rows.map((row) => reportPercentValue(row[pctCol], pctCol)).filter((value): value is number => value != null);
    if (values.length) {
      const value = values.reduce((sum, item) => sum + item, 0) / values.length;
      return { label: shortColumnLabel(pctCol), value: formatPercentLabel(value), tone: value >= 70 ? "good" : value > 0 ? "warn" : "neutral" };
    }
  }
  const numericCol = pick(["total", "casos", "respuestas", "completas", "efectivas", "alerta"]);
  if (numericCol) {
    const total = block.rows.reduce((sum, row) => sum + reportNumberValue(row[numericCol]), 0);
    return { label: shortColumnLabel(numericCol), value: fmt(total), tone: total > 0 ? "good" : "neutral" };
  }
  return { label: "Filas", value: fmt(block.rows.length), tone: "neutral" };
}

function formatReportCell(value: unknown, column: string) {
  if (value == null || value === "") return "";
  if (typeof value === "number") {
    const normalized = normalizeReportMatch(column);
    if (normalized.includes("avance") || String(column).includes("%") || normalized.includes("ratio")) {
      const pctValue = Math.abs(value) <= 10 ? value * 100 : value;
      return `${pctValue.toLocaleString("es-PE", { maximumFractionDigits: 1 })}%`;
    }
    return Number.isInteger(value) ? fmt(value) : value.toLocaleString("es-PE", { maximumFractionDigits: 1 });
  }
  const text = String(value);
  if (normalizeReportMatch(column).includes("fecha")) return text;
  const normalized = normalizeReportMatch(text);
  if (normalized === "no barridos") return "Por barrer";
  if (normalized === "casos barridos") return "Barridos";
  return text;
}

function ReportTableCell({ value, column, rowContext = "" }: { value: unknown; column: string; rowContext?: string }) {
  const text = formatReportCell(value, column);
  const normalized = normalizeReportMatch(column);
  const percent = reportPercentValue(value, column);
  if (percent != null) {
    return (
      <span className="mon-report-cell mon-report-cell--percent" style={{ "--mon-report-pct": `${Math.max(0, Math.min(100, percent))}%` } as CSSProperties}>
        <i />
        <span>{text}</span>
      </span>
    );
  }
  if (normalized.includes("nivel") || normalized.includes("estado") || normalized.includes("estatus") || normalized.includes("avance")) {
    return <span className={`mon-report-cell mon-report-cell--state is-${reportStateTone(`${text} ${rowContext}`)}`}>{text || "S/D"}</span>;
  }
  if (typeof value === "number") return <span className="mon-report-cell mon-report-cell--number">{text}</span>;
  return <span className="mon-report-cell">{text}</span>;
}

function GsReportBlockTable({ sheet, block }: { sheet: MonitoreoReportSheet; block: MonitoreoReportBlock }) {
  const columns = reportBlockColumns(block);
  const rows = block.rows.slice(0, 18);
  const metric = reportBlockMetric(block);
  const clipped = block.rows.length > rows.length;
  return (
    <section className={`mon-gs-report-block is-${reportBlockTone(block.id, sheet.id)}`}>
      <header>
        <div>
          <strong>{block.title}</strong>
          <small>{fmt(columns.length)} columnas · {fmt(block.rows.length)} filas</small>
        </div>
        <span className={`mon-gs-block-metric is-${metric.tone}`}>
          <em>{metric.label}</em>
          <strong>{metric.value}</strong>
        </span>
      </header>
      {rows.length ? (
        <div className="mon-gs-report-table-wrap">
          <table className="mon-gs-report-table">
            <thead>
              <tr>{columns.map((column) => <th key={`${block.id}-${column}`}>{reportColumnDisplayLabel(column)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => {
                const rowContext = `${sheet.id} ${block.id} ${Object.values(row).join(" ")}`;
                return (
                  <tr key={`${sheet.id}-${block.id}-${rowIndex}`}>
                    {columns.map((column) => (
                      <td key={`${sheet.id}-${block.id}-${rowIndex}-${column}`}>
                        <ReportTableCell value={row[column]} column={column} rowContext={rowContext} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mon-profile-muted">Sin filas.</p>
      )}
      {clipped && <span className="mon-gs-report-overflow">Mostrando 18 de {fmt(block.rows.length)} filas. Usa el scroll horizontal para revisar columnas.</span>}
      {block.note && <em>{block.note}</em>}
    </section>
  );
}

function AcreditacionGsReportsPanel({ reports }: { reports: MonitoreoAcreditacionReports | null | undefined }) {
  const sheets = useMemo(() => reportSheetsForPanel(reports), [reports]);
  const [activeId, setActiveId] = useState(sheets[0]?.id ?? "");
  const activeSheet = sheets.find((sheet) => sheet.id === activeId) ?? sheets[0] ?? null;
  useEffect(() => {
    if (!sheets.length) return;
    if (!sheets.some((sheet) => sheet.id === activeId)) setActiveId(sheets[0].id);
  }, [activeId, sheets]);

  if (!reports || !activeSheet) {
    return (
      <section className="pulso-panel mon-gs-report-panel mon-gs-report-panel--avance" aria-label="Reporte de avance">
        <header className="pulso-panel-header">
          <div className="pulso-panel-heading">
            <span className="pulso-panel-eyebrow">Lectura del avance</span>
            <h2 className="pulso-panel-title"><span className="mon-title-icon"><ClipboardCheck size={16} /> Reporte</span></h2>
          </div>
        </header>
        <EmptyPanel title="Reporte sin bloques" detail="El corte todavía no trae las tablas de reporte para revisar detalle de avance." />
      </section>
    );
  }

  const totalRows = activeSheet.blocks.reduce((sum, block) => sum + block.rows.length, 0);
  const reportStats = buildReportSheetStats(activeSheet);
  const title = reportPanelSheetTitle(activeSheet);
  const description = reportPanelSheetDescription(activeSheet);
  return (
    <section className="pulso-panel mon-gs-report-panel mon-gs-report-panel--avance" aria-label="Reporte de avance">
      <header className="pulso-panel-header">
        <div className="pulso-panel-heading">
          <span className="pulso-panel-eyebrow">Lectura del avance</span>
          <h2 className="pulso-panel-title"><span className="mon-title-icon"><ClipboardCheck size={16} /> Reporte</span></h2>
        </div>
        <div className="pulso-panel-actions mon-gs-report-meta">
          <span>Corte del estudio</span>
          <span>{fmt(totalRows)} filas</span>
          <span>{formatDate(reports.generated_at)}</span>
        </div>
      </header>
      <div className={`mon-gs-report-brief is-${reportSheetTone(activeSheet.id)}`}>
        <div className="mon-gs-report-brief-main">
          <span className="mon-gs-report-chip">{sheetTitleIcon(activeSheet.id)} {reportPanelScopeLabel(activeSheet.scope)}</span>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
        <div className="mon-gs-report-brief-stats" aria-label="Indicadores del reporte">
          {reportStats.map((stat) => (
            <span key={stat.label}>
              <em>{stat.label}</em>
              <strong>{stat.value}</strong>
            </span>
          ))}
        </div>
      </div>
      <GlidingTabList activeKey={activeSheet.id} className="mon-gs-report-tabs" role="tablist" aria-label="Pestañas de reporte de acreditación">
        {sheets.map((sheet) => (
          <button
            key={sheet.id}
            type="button"
            role="tab"
            data-gliding-key={sheet.id}
            aria-selected={sheet.id === activeSheet.id}
            className={sheet.id === activeSheet.id ? "is-active" : ""}
            onClick={() => setActiveId(sheet.id)}
          >
            {sheetTitleIcon(sheet.id)}
            <span>{reportPanelSheetTitle(sheet)}</span>
          </button>
        ))}
      </GlidingTabList>
      <div className="mon-gs-report-body" data-report-sheet={activeSheet.id}>
        <p>{description}</p>
        <div className="mon-gs-report-blocks">
          {activeSheet.blocks.map((block) => (
            <GsReportBlockTable key={block.id} sheet={activeSheet} block={block} />
          ))}
        </div>
      </div>
    </section>
  );
}

function AcreditacionAdvanceDetailWorkbench({
  reports,
  state,
  actorRows,
  controlRows,
}: {
  reports: MonitoreoAcreditacionReports;
  state?: MonitoreoState | null;
  actorRows: Array<Record<string, unknown>>;
  controlRows: Array<Record<string, unknown>>;
}) {
  const cards = useMemo(() => advanceCardsFromRows(actorRows, state?.config.goals ?? []), [actorRows, state?.config.goals]);
  const totals = advanceTotals(cards);
  const completionPct = safePercentValue(totals.effective, totals.universe);
  const generatedAt = reports.generated_at ? formatDate(reports.generated_at) : "";
  return (
    <section className="pulso-panel mon-advance-panel" aria-label="Detalle canónico de avance">
      <header className="pulso-panel-header">
        <div className="pulso-panel-heading">
          <span className="pulso-panel-eyebrow">Avance</span>
          <h2 className="pulso-panel-title"><span className="mon-title-icon"><BarChart3 size={16} /> Reporte</span></h2>
          <p className="pulso-panel-hint">Variables de control, tablas de reporte y lectura de composición.</p>
        </div>
        <div className="pulso-panel-actions mon-advance-meta">
          <span>{fmt(state?.n_rows ?? totals.universe)} registros</span>
          {generatedAt ? <span>{generatedAt}</span> : null}
        </div>
      </header>
      <div className="mon-advance-hero">
        <div className="mon-advance-hero-copy">
          <span>Corte sincronizado</span>
          <strong>{fmt(totals.effective)} efectivas de {fmt(totals.universe)}</strong>
          <p>Revisa si el corte efectivo conserva la composición esperada del universo y abre las tablas publicables del reporte.</p>
        </div>
        <div className="mon-advance-hero-kpis">
          <AcreditacionAdvanceMetric label="Variables" value={fmt(controlVariableRows(reports, controlRows).length)} hint="categorías de control" tone="target" />
          <AcreditacionAdvanceMetric label="Efectivas" value={fmt(totals.effective)} hint={`${completionPct == null ? "S/D" : pct(completionPct)} del universo`} tone="ready" />
          <AcreditacionAdvanceMetric label="Reporte" value={fmt(reportSheetsForPanel(reports).length)} hint="pestañas disponibles" />
        </div>
      </div>
      <div className="mon-advance-tabbody">
        <div className="mon-advance-detail-stack">
          <AcreditacionControlVariablesPanel reports={reports} fallbackRows={controlRows} />
          <AcreditacionGsReportsPanel reports={reports} />
        </div>
      </div>
    </section>
  );
}

function AcreditacionAdvanceSummaryWorkbench({
  reports,
  state,
  actorRows,
  dailyRows,
  onNavigateLocalTab,
}: {
  reports: MonitoreoAcreditacionReports;
  state?: MonitoreoState | null;
  actorRows: Array<Record<string, unknown>>;
  dailyRows: Array<Record<string, unknown>>;
  onNavigateLocalTab?: (view: WorkbenchView, tab: AcreditacionLocalTabKey) => void;
}) {
  const isPhoneModel = isTelefonicoMonitoreoState(state);
  const phoneQuotaCards = useMemo(() => phoneQuotaCardsForDashboard(reports), [reports]);
  const cards = useMemo(() => (
    isPhoneModel && phoneQuotaCards.length
      ? phoneQuotaCards
      : advanceCardsFromRows(actorRows, state?.config.goals ?? [])
  ), [actorRows, isPhoneModel, phoneQuotaCards, state?.config.goals]);
  const scopeLabel = isPhoneModel && phoneQuotaCards.length ? "Sede" : "Actor";
  const rawDailyPoints = useMemo(() => dailyPointsFromRows(dailyRows), [dailyRows]);
  const dailyPoints = useMemo(() => (
    isPhoneModel ? rawDailyPoints.filter(isDatedAcreditacionDailyPoint) : rawDailyPoints
  ), [isPhoneModel, rawDailyPoints]);
  const totals = advanceTotals(cards);
  const completionPct = safePercentValue(totals.effective, totals.universe);
  const generatedAt = reports.generated_at ? formatDate(reports.generated_at) : "";
  const reportCuts = useMemo(
    () => acreditacionReportCutsFromPhases(state?.config?.strategy_phases ?? []),
    [state?.config?.strategy_phases],
  );
  const reportWeekday = useMemo(
    () => acreditacionReportWeekdayFromPhases(state?.config?.strategy_phases ?? []),
    [state?.config?.strategy_phases],
  );
  const phoneComparisonRows = isPhoneModel
    ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["comparacion_codpulso", "campo_vs_plataforma_codpulso"])
    : [];
  const phoneComparison = isPhoneModel ? phonePlatformComparisonTotals(phoneComparisonRows) : null;
  const phoneStatusRows = isPhoneModel
    ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["estatus_telefonico"])
    : [];
  const phoneStatusTotal = Math.max(1, phoneStatusRows.reduce((sum, row) => sum + phoneRowNumber(row, ["Casos", "Valor", "Total"], 0), 0));
  const phoneStatusItems = phoneStatusRows.map((row, index) => {
    const label = phoneRowValue(row, ["Estado", "Estatus", "Indicador"], `Estado ${index + 1}`);
    const value = phoneRowNumber(row, ["Casos", "Valor", "Total"], 0);
    return { key: `${normalizeSourceMatch(label)}-${index}`, label, value, tone: phoneStatusTone(label) };
  }).filter((item) => item.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);
  const quotaRows = isPhoneModel
    ? phoneQuotaRowsForPanel(rowsForSheetBlock(reports, "monitoreo_telefonico", ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"]))
    : [];
  const quotaVariable = isPhoneModel ? preferredPhoneAdvanceQuotaVariable(quotaRows) || scopeLabel : scopeLabel;
  const phoneFilter = isPhoneModel ? normalizePhoneEffectiveFilter(state?.config?.monitoreo_profile?.platform_effective_filter) : null;
  const phoneFilterConfigured = Boolean(phoneFilter?.enabled && phoneFilter.variable && phoneFilter.values.length);
  const phonePlatformSource = isPhoneModel
    ? state?.sources?.find(isKoboResponseSource) ?? null
    : null;
  const phoneInstrumentTitle = phonePlatformSource ? acreditacionSurveySourceName(phonePlatformSource) : "Kobo pendiente";
  const phoneInstrumentAsset = phonePlatformSource ? sourceExternalId(phonePlatformSource) : "";
  const phoneFilterLabel = phoneFilterConfigured
    ? `${phoneFilter?.label || phoneFilter?.variable} = ${phoneFilter?.value_label || phoneFilter?.values[0]}`
    : "Sin filtro";
  const phoneFilterHint = phoneFilterConfigured
    ? "opción válida"
    : "elige consentimiento";
  const dailySignalDays = dailyPoints.filter((point) => dailyPointTotalValue(point) > 0).length;
  const undatedPhoneEffective = isPhoneModel
    ? rawDailyPoints.filter((point) => !isDatedAcreditacionDailyPoint(point)).reduce((sum, point) => sum + dailyEffectiveValue(point), 0)
    : 0;

  if (isPhoneModel) {
    const comparison = phoneComparison ?? {
      phoneEffective: 0,
      platformComplete: totals.effective,
      matchedEffective: 0,
      mismatch: 0,
    };
    const platformEffective = comparison.platformComplete || totals.effective;
    return (
      <section className="pulso-panel mon-advance-panel mon-phone-advance-summary" aria-label="Resumen de avance telefónico">
        <header className="pulso-panel-header">
          <div className="pulso-panel-heading">
            <span className="pulso-panel-eyebrow">Avance telefónico</span>
            <h2 className="pulso-panel-title"><span className="mon-title-icon"><BarChart3 size={16} /> Kobo, barrido y cuotas</span></h2>
            <p className="pulso-panel-hint">Kobo manda las efectivas; el barrido conserva estados telefónicos y CodPulso verifica coincidencia individual.</p>
          </div>
          <div className="pulso-panel-actions mon-advance-meta">
            <span>{fmt(state?.n_rows ?? totals.universe)} registros</span>
            {generatedAt ? <span>{generatedAt}</span> : null}
          </div>
        </header>
        <div className="mon-phone-advance-hero">
          <div className="mon-phone-advance-hero-copy">
            <span>Fuente rectora</span>
            <strong>{fmt(platformEffective)} efectivas Kobo</strong>
            <p>{phoneFilterConfigured ? `Filtro aplicado: ${phoneFilter?.label || phoneFilter?.variable} = ${phoneFilter?.value_label || phoneFilter?.values[0]}` : "Configura el filtro de consentimiento/elegibilidad para que el avance quede completamente validado."}</p>
          </div>
          <div className="mon-phone-advance-hero-kpis">
            <AcreditacionAdvanceMetric label="Variable cuota" value={quotaVariable} hint={`${fmt(cards.length)} categorías`} tone={quotaRows.length ? "target" : "warning"} />
            <AcreditacionAdvanceMetric label="CodPulso" value={phoneCodPulsoEffectiveMatchLabel(comparison)} hint={comparison.mismatch ? `${fmt(comparison.mismatch)} diferencias` : `${fmt(phoneComparisonRows.length)} llaves trazadas`} tone={comparison.mismatch ? "warning" : "ready"} />
            <AcreditacionAdvanceMetric label="Barrido efectivo" value={fmt(comparison.phoneEffective)} hint="declarado en base" tone="base" />
            <AcreditacionAdvanceMetric label="Por barrer" value={fmt(totals.pending)} hint="estado telefónico" tone={totals.pending ? "warning" : "base"} />
          </div>
        </div>
        <div className="mon-phone-advance-rule-console" aria-label="Regla operativa Kobo para avance telefónico">
          <section className={phoneFilterConfigured ? "is-ready" : "is-warning"}>
            <span><QrCode size={13} /> Regla Kobo</span>
            <strong>{phoneFilterConfigured ? "Efectiva = completa y pasa filtro" : "Falta elegir filtro de efectiva"}</strong>
            <p>{phoneFilterConfigured ? "Kobo cuenta el avance; el barrido queda como consulta operativa y CodPulso prueba coincidencia individual." : "Sin filtro, el tablero muestra la producción leída, pero la validación de avance todavía no queda cerrada."}</p>
          </section>
          <div className="mon-phone-advance-rule-steps">
            <button type="button" className={phonePlatformSource ? "is-ready" : "is-warning"} onClick={() => onNavigateLocalTab?.("fuentes", "survey")}>
              <span><QrCode size={13} /> Instrumento</span>
              <strong>{phoneInstrumentTitle}</strong>
              <em>{phoneInstrumentAsset ? shortenMiddle(phoneInstrumentAsset, 38) : "Selecciona Kobo"}</em>
            </button>
            <i aria-hidden="true" />
            <button type="button" className={phoneFilterConfigured ? "is-ready" : "is-warning"} onClick={() => onNavigateLocalTab?.("fuentes", "survey")}>
              <span><Filter size={13} /> Filtro</span>
              <strong>{phoneFilterLabel}</strong>
              <em>{phoneFilterHint}</em>
            </button>
            <i aria-hidden="true" />
            <button type="button" className={quotaRows.length ? "is-ready" : "is-warning"} onClick={() => onNavigateLocalTab?.("modelo", "estructura")}>
              <span><SlidersHorizontal size={13} /> Variable rectora</span>
              <strong>{quotaVariable}</strong>
              <em>{fmt(cards.length)} categorías de cuota</em>
            </button>
            <i aria-hidden="true" />
            <button type="button" className={comparison.mismatch ? "is-warning" : "is-ready"} onClick={() => onNavigateLocalTab?.("avance", "detalle")}>
              <span><KeyRound size={13} /> CodPulso</span>
              <strong>{phoneCodPulsoEffectiveMatchLabel(comparison)}</strong>
              <em>{comparison.mismatch ? `${fmt(comparison.mismatch)} diferencias` : "coincidencia individual"}</em>
            </button>
          </div>
        </div>
        <div className="mon-phone-advance-grid">
          <AcreditacionAdvanceDailyMini
            points={dailyPoints}
            title="Ritmo general Kobo"
            variant="source"
            cutDate={reports.generated_at}
            reportCuts={reportCuts}
            reportWeekday={reportWeekday}
            effectiveOnly
            compact
          />
          <section className="mon-phone-advance-parallel" aria-label="Estados de plataforma y estados telefónicos en paralelo">
            <header>
              <div>
                <span>Contexto telefónico</span>
                <strong>La llamada explica operación; Kobo valida avance</strong>
              </div>
              <em>{fmt(dailySignalDays)} día{dailySignalDays === 1 ? "" : "s"} con efectivas{undatedPhoneEffective ? ` · ${fmt(undatedPhoneEffective)} sin fecha` : ""}</em>
            </header>
            <div className="mon-phone-advance-parallel-grid">
              <article>
                <span>Kobo efectivo</span>
                <strong>{fmt(platformEffective)} efectivas</strong>
                <p>{phoneFilterConfigured ? "Pasan filtro y cuentan para cuota." : "Pendiente definir filtro de efectiva."}</p>
                <i style={{ "--phone-advance-pct": `${Math.max(2, Math.min(100, safePercentValue(platformEffective, totals.universe) ?? 0))}%` } as CSSProperties} />
              </article>
              <article>
                <span>Barrido telefónico</span>
                <strong>{fmt(comparison.phoneEffective)} efectivas declaradas</strong>
                <p>{comparison.mismatch ? `${fmt(comparison.mismatch)} CodPulso no coinciden.` : "Coincide con Kobo por llave individual."}</p>
                <i style={{ "--phone-advance-pct": `${Math.max(2, Math.min(100, safePercentValue(comparison.phoneEffective, totals.universe) ?? 0))}%` } as CSSProperties} />
              </article>
            </div>
            <div className="mon-phone-advance-status-list" aria-label="Distribución de estados telefónicos">
              {phoneStatusItems.length ? phoneStatusItems.map((item) => (
                <span key={item.key} className={`is-${item.tone}`}>
                  <em>{item.label}</em>
                  <i style={{ "--phone-advance-pct": `${Math.max(2, Math.min(100, safePercentValue(item.value, phoneStatusTotal) ?? 0))}%` } as CSSProperties} />
                  <strong>{fmt(item.value)}</strong>
                </span>
              )) : (
                <span className="is-muted"><em>Sin estados telefónicos</em><strong>S/D</strong></span>
              )}
            </div>
          </section>
          <AcreditacionAdvanceStorage cards={cards} scopeLabel={scopeLabel} />
          <AcreditacionAdvanceFocus cards={cards} scopeLabel={scopeLabel} />
        </div>
      </section>
    );
  }

  return (
    <section className="pulso-panel mon-advance-panel" aria-label="Resumen canónico de avance">
      <header className="pulso-panel-header">
        <div className="pulso-panel-heading">
          <span className="pulso-panel-eyebrow">Avance</span>
          <h2 className="pulso-panel-title"><span className="mon-title-icon"><BarChart3 size={16} /> Reporte</span></h2>
          <p className="pulso-panel-hint">Corte cliente, universo, metas y ritmo diario.</p>
        </div>
        <div className="pulso-panel-actions mon-advance-meta">
          <span>{fmt(state?.n_rows ?? totals.universe)} registros</span>
          {generatedAt ? <span>{generatedAt}</span> : null}
        </div>
      </header>
      <div className="mon-advance-hero">
        <div className="mon-advance-hero-copy">
          <span>Corte sincronizado</span>
          <strong>{fmt(totals.effective)} efectivas de {fmt(totals.universe)}</strong>
          <p>Distingue universo, metas por {scopeLabel.toLowerCase()} y respuestas de plataforma para leer el avance sin mezclar fuentes.</p>
        </div>
        <div className="mon-advance-hero-kpis">
          <AcreditacionAdvanceMetric label={`Metas ${scopeLabel.toLowerCase()}`} value={totals.metas ? `${fmt(totals.metas - totals.brechas)}/${fmt(totals.metas)}` : "S/M"} hint={totals.brechas ? `${fmt(totals.brechas)} con brecha` : "sin brecha"} tone={totals.brechas ? "target" : "ready"} />
          <AcreditacionAdvanceMetric label="Efectivas" value={fmt(totals.effective)} hint={`${completionPct == null ? "S/D" : pct(completionPct)} del universo`} tone="ready" />
          <AcreditacionAdvanceMetric
            label={isPhoneModel ? "Por barrer" : "Pendientes"}
            value={fmt(totals.pending)}
            hint={isPhoneModel ? "estado telefónico pendiente" : `${fmt(totals.partial)} parciales · ${fmt(totals.refusals)} rechazos`}
            tone={totals.pending ? "warning" : "base"}
          />
        </div>
      </div>
      <div className="mon-advance-tabbody">
        <div className="mon-advance-summary-grid">
          <AcreditacionAdvanceDailyMini
            points={dailyPoints}
            cutDate={reports.generated_at}
            reportCuts={reportCuts}
            reportWeekday={reportWeekday}
            effectiveOnly={isPhoneModel}
          />
          <AcreditacionAdvanceStorage cards={cards} scopeLabel={scopeLabel} />
          <AcreditacionAdvanceFocus cards={cards} scopeLabel={scopeLabel} />
        </div>
      </div>
    </section>
  );
}

function EmptyPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mon-profile-empty">
      <span className="mon-profile-empty__icon"><ClipboardCheck size={18} /></span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function AcreditacionLoadingPanel({ view, label }: { view: WorkbenchView; label: string }) {
  const items = view === "consultas"
    ? [
      { icon: Search, label: "Cruces", value: "plataforma/base" },
      { icon: Table2, label: "Casos", value: "actor y canal" },
      { icon: ShieldAlert, label: "Alertas", value: "subsanación" },
    ]
    : [
      { icon: RefreshCw, label: "Cache", value: "local" },
      { icon: Table2, label: "Corte", value: "reportes" },
      { icon: CheckCircle2, label: "Vista", value: label },
    ];

  return (
    <section className={`mon-acr-loading-card is-${view}`} aria-live="polite" aria-label={`Preparando ${label}`}>
      <div className="mon-acr-loading-card__copy">
        <span><Loader2 size={14} className="pulso-spin" /> Preparando {label}</span>
        <strong>Actualizando cache local</strong>
        <p>{view === "consultas" ? "Leyendo trazabilidad, cruces y revisión asistida." : "Leyendo el corte disponible para esta sección."}</p>
      </div>
      <div className="mon-acr-loading-card__items" aria-hidden="true">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <span key={`${item.label}-${item.value}`}>
              <Icon size={13} />
              <em>{item.label}</em>
              <strong>{item.value}</strong>
            </span>
          );
        })}
      </div>
      <div className="mon-acr-loading-card__skeleton" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}

function renderAcreditacionView(
  view: WorkbenchView,
  reports: MonitoreoAcreditacionReports | null,
  options: {
    activeSourceTab?: AcreditacionSourceTab;
    activeModelTab?: AcreditacionModelTab;
    activeConsultaTab?: AcreditacionConsultaTab;
    activePhoneTab?: AcreditacionPhoneTab;
    activeAdvanceTab?: AcreditacionAdvanceTab;
    acreditacion?: MonitoreoAcreditacion | null;
    actionStatus?: AcreditacionActionStatus;
    caseReconciliationBusyId?: string;
    caseReconciliationStatus?: AcreditacionActionStatus;
    onSaveSeguimiento?: (payload: MonitoreoAcreditacionSeguimientoPayload) => Promise<void>;
    onCerrar?: (planRefuerzo: string, aprobarBrechas: boolean) => Promise<void>;
    onConsultaTabChange?: (tab: AcreditacionConsultaTab) => void;
    onCaseReconciliationDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
    state?: MonitoreoState | null;
    onStateChange?: (state: MonitoreoState) => void;
    onPublished?: () => void;
    onNavigateLocalTab?: (view: WorkbenchView, tab: AcreditacionLocalTabKey) => void;
    routeLabel?: string;
    savingAcreditacion?: boolean;
  } = {},
) {
  if (view === "avance" && options.activeAdvanceTab === "salidas") {
    const state = options.state;
    const isPhoneOutputs = isTelefonicoMonitoreoState(state);
    return (
      <MonitoreoOutputsWorkbench
        family={isPhoneOutputs ? "telefonico" : "acreditacion"}
        routeLabel={isPhoneOutputs ? "Monitoreo telefónico" : options.routeLabel ?? "Acreditación"}
        defaultTitle={isPhoneOutputs ? "" : state?.config?.acreditacion?.estudio?.titulo || "reporte-monitoreo"}
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
  if (!reports) {
    return <EmptyPanel title="Resumen pendiente" detail="Todavia no hay reporte local preparado para esta vista." />;
  }
  const client = reports.client_report;
  if (view === "fuentes") {
    return (
      <AcreditacionSourcesWorkbench
        reports={reports}
        state={options.state}
        activeTab={options.activeSourceTab ?? "survey"}
        onStateChange={options.onStateChange}
        onSourceTabChange={(tab) => options.onNavigateLocalTab?.("fuentes", tab)}
      />
    );
  }
  if (view === "modelo") {
    return (
      <AcreditacionModelWorkbench
        acreditacion={options.acreditacion}
        reports={reports}
        state={options.state}
        activeTab={options.activeModelTab ?? "estructura"}
        saving={Boolean(options.savingAcreditacion)}
        actionStatus={options.actionStatus ?? null}
        onSaveSeguimiento={options.onSaveSeguimiento}
        onCerrar={options.onCerrar}
        onStateChange={options.onStateChange}
      />
    );
  }
  if (view === "consultas") {
    return (
      <AcreditacionConsultasPanel
        reports={reports}
        sources={options.state?.sources ?? []}
        activeTab={options.activeConsultaTab ?? "plataforma"}
        onActiveTabChange={options.onConsultaTabChange}
        caseReconciliationBusyId={options.caseReconciliationBusyId}
        caseReconciliationStatus={options.caseReconciliationStatus}
        onCaseReconciliationDecision={options.onCaseReconciliationDecision}
      />
    );
  }
  if (view === "telefonico") {
    return renderPhoneView(
      reports,
      options.activePhoneTab ?? "resumen",
      num(options.state?.dashboard?.kpis?.valid, 0),
      isTelefonicoMonitoreoState(options.state),
    );
  }
  const isPhoneModel = isTelefonicoMonitoreoState(options.state);
  const actorRows = client?.actors?.length ? client.actors : rowsFromSheets(reports.sheets, ["actor", "avance", "brecha"]);
  const phoneDailyRows = isPhoneModel
    ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["avance_efectivo_dia", "produccion_dia"])
    : [];
  const clientDailyRows = client?.daily_general ?? [];
  const dailyRows = isPhoneModel
    ? (phoneDailyRows.length ? phoneDailyRows : clientDailyRows)
    : (clientDailyRows.length ? clientDailyRows : phoneDailyRows);
  const sheetActorDailyRows = rowsForSheetBlock(reports, "cliente_avance_actor", ["avance_actor_dia"]);
  const actorDailyRows = client?.daily_actor?.length
    ? client.daily_actor
    : sheetActorDailyRows.length
      ? sheetActorDailyRows
      : dailyRows;
  const sourceRows = client?.sources?.length ? client.sources : rowsFromSheets(reports.sheets, ["fuente", "source", "canal"]);
  const controlRows = client?.controls?.length ? client.controls : rowsFromSheets(reports.sheets, ["control", "segmento", "meta"]);
  if (view === "avance" && options.activeAdvanceTab === "actores") {
    return (
      <AcreditacionAdvanceActorsWorkbench
        reports={reports}
        state={options.state}
        actorRows={actorRows as Array<Record<string, unknown>>}
        sourceRows={sourceRows as Array<Record<string, unknown>>}
        dailyRows={actorDailyRows as Array<Record<string, unknown>>}
      />
    );
  }
  if (view === "avance" && options.activeAdvanceTab === "encuestas") {
    return (
      <AcreditacionAdvanceSurveysWorkbench
        reports={reports}
        state={options.state}
        sourceRows={sourceRows as Array<Record<string, unknown>>}
      />
    );
  }
  if (view === "avance" && isPhoneModel && options.activeAdvanceTab === "detalle") {
    const reconciliationRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["comparacion_codpulso", "campo_vs_plataforma_codpulso"]);
    return (
      <div className="mon-profile-stack">
        <AcreditacionPhonePlatformComparison rows={reconciliationRows} />
      </div>
    );
  }
  if (view === "avance" && options.activeAdvanceTab === "detalle") {
    return (
      <AcreditacionAdvanceDetailWorkbench
        reports={reports}
        state={options.state}
        actorRows={actorRows as Array<Record<string, unknown>>}
        controlRows={controlRows as Array<Record<string, unknown>>}
      />
    );
  }
  if (view === "avance") {
    return (
      <AcreditacionAdvanceSummaryWorkbench
        reports={reports}
        state={options.state}
        actorRows={actorRows as Array<Record<string, unknown>>}
        dailyRows={dailyRows as Array<Record<string, unknown>>}
        onNavigateLocalTab={options.onNavigateLocalTab}
      />
    );
  }
  return (
    <div className="mon-profile-stack">
      <div className="mon-profile-grid">
        <section className="mon-profile-panel">
          <div className="mon-profile-panel-head">
            <h3>Avance por actor</h3>
            <span>{fmt(actorRows.length)} filas</span>
          </div>
          <DataTable rows={actorRows as Array<Record<string, unknown>>} empty="No hay avance por actor preparado." />
        </section>
        <section className="mon-profile-panel">
          <div className="mon-profile-panel-head">
            <h3>Ritmo diario</h3>
            <span>{fmt(dailyRows.length)} dias</span>
          </div>
          <DataTable rows={dailyRows as Array<Record<string, unknown>>} empty="No hay serie diaria preparada." />
        </section>
      </div>
    </div>
  );
}

function phoneContractReadyCount(contract: AcreditacionPhoneSourceContract) {
  return [contract.universe, contract.sweep, contract.platform].filter((slot) => slot.ready).length;
}

function activeSourceCount(state: MonitoreoState | null) {
  if (isTelefonicoMonitoreoState(state)) {
    return phoneContractReadyCount(buildAcreditacionPhoneSourceContract(state?.sources ?? []));
  }
  return (state?.sources ?? []).filter((source) => source.enabled).length;
}

type AcreditacionRailStatus = NonNullable<MonitoreoWorkbenchRailTab["status"]>;

function countText(count: number, singular: string, plural = `${singular}s`) {
  return `${fmt(count)} ${count === 1 ? singular : plural}`;
}

function readyStatus(ready: boolean, risk = false): AcreditacionRailStatus {
  if (risk) return "risk";
  return ready ? "ready" : "warning";
}

function railTab(
  tab: typeof ACREDITACION_SOURCE_TABS[number]
    | typeof ACREDITACION_MODEL_TABS[number]
    | typeof ACREDITACION_CONSULTA_TABS[number]
    | typeof ACREDITACION_PHONE_TABS[number]
    | typeof ACREDITACION_ADVANCE_TABS[number],
  patch: Partial<Pick<MonitoreoWorkbenchRailTab, "label" | "detail" | "badge" | "status">> = {},
): MonitoreoWorkbenchRailTab {
  return { ...tab, ...patch };
}

function acreditacionRailSourceStats(state: MonitoreoState | null, reports: MonitoreoAcreditacionReports | null) {
  const sources = (state?.sources ?? []).map((source) => acreditacionSourceWithOperationalMetadata(source, state?.source_metadata));
  const enabled = sources.filter((source) => source.enabled);
  const platform = sources.filter(isPlatformResponseSource);
  const sheets = sources.filter((source) => source.kind === "google_sheets");
  const collectors = state?.config?.operational_model.link_collectors ?? [];
  const reportSources = reports?.client_report?.sources?.length
    ? reports.client_report.sources
    : rowsFromSheets(reports?.sheets ?? [], ["fuente", "source", "canal"]);
  return {
    total: sources.length,
    enabled: enabled.length,
    platform: platform.length,
    platformEnabled: platform.filter((source) => source.enabled).length,
    sheets: sheets.length,
    sheetsEnabled: sheets.filter((source) => source.enabled).length,
    collectors: collectors.length,
    reportSources: reportSources.length,
  };
}

function acreditacionRailModelStats(state: MonitoreoState | null, reports: MonitoreoAcreditacionReports | null) {
  const client = reports?.client_report;
  const actorRows = client?.actors?.length ? client.actors : rowsFromSheets(reports?.sheets ?? [], ["actor", "avance", "brecha"]);
  const phoneQuotaRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"]) : [];
  const quotaVariables = uniqueDisplayValues(phoneQuotaRows.map((row) => phoneRowValue(row, ["Variable"], ""))).length;
  const phases = state?.config?.strategy_phases ?? [];
  const scheduleDraft = acreditacionScheduleDraftFromPhases(phases);
  const goals = state?.config?.goals?.filter((goal) => Number(goal.meta) > 0).length ?? 0;
  return {
    actors: actorRows.length,
    goals,
    phases: phases.length,
    schedule: scheduleDraft.durationWeeks
      ? `${fmt(scheduleDraft.durationWeeks)} sem · ${calendarReportWeekdayLabel(scheduleDraft.reportWeekday)}`
      : phases.length
        ? countText(phases.length, "fase")
        : "sin cronograma",
    phoneQuotaRows: phoneQuotaRows.length,
    phoneQuotaVariables: quotaVariables,
  };
}

function acreditacionRailPhoneStats(state: MonitoreoState | null, reports: MonitoreoAcreditacionReports | null) {
  const contract = buildAcreditacionPhoneSourceContract(state?.sources ?? []);
  const summaryRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["resumen_telefonico"]) : [];
  const statusRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["estatus_telefonico"]) : [];
  const quotaRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"]) : [];
  const responsibleRows = reports ? mergeAcreditacionPhoneResponsibleRows(
    rowsForSheetBlock(reports, "monitoreo_telefonico", ["operacion_responsable"]),
    rowsForSheetBlock(reports, "monitoreo_telefonico", ["efectivos_responsable"]),
    rowsForSheetBlock(reports, "monitoreo_telefonico", ["no_barridos_responsable"]),
    rowsForSheetBlock(reports, "monitoreo_telefonico", ["responsables_barrido"]),
  ) : [];
  const queries = normalizeInternalQueries(reports?.internal_queries);
  const queryCases = queries.case_rollup?.length ? queries.case_rollup : queries.cases;
  const fallbackStatusRows = groupedCaseRows(queryCases, internalCaseResponseStateValue, internalCaseResponseStateLabel);
  const fallbackResponsibleRows = groupedCaseRows(
    queryCases,
    (item) => internalQueryCollectorDisplayLabel(item) || item.collector_id || "Sin responsable",
    (value) => value,
  );
  const visibleStatusRows = statusRows.length ? statusRows : fallbackStatusRows;
  const visibleResponsibleRows = responsibleRows.length ? responsibleRows : fallbackResponsibleRows;
  const dailyRows = reports ? phoneDailyBlockForPanel(reports)?.rows ?? [] : [];
  const totals = phoneOperationTotals(summaryRows, visibleStatusRows, visibleResponsibleRows, dailyRows);
  const pendingRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["no_barridos_responsable"]) : [];
  const insistenceRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["insistencia_no_contesta"]) : [];
  const detailRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["detalle_no_contesta"]) : [];
  const reattemptRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["reintentos_responsable"]) : [];
  const alertRows = reports ? rowsForSheetBlock(reports, "alertas", ["alertas"]) : [];
  const alertModel = buildAcreditacionPhoneRealAlertModel({ alertRows });
  const comparisonRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["comparacion_codpulso", "campo_vs_plataforma_codpulso"]) : [];
  const comparison = phonePlatformComparisonTotals(comparisonRows);
  const platformEffective = comparison.platformComplete || stateFromReports(reports, num(state?.dashboard?.kpis?.total ?? state?.n_rows, 0), num(state?.dashboard?.kpis?.valid, 0)).effective;
  const phoneFilter = normalizePhoneEffectiveFilter(state?.config?.monitoreo_profile?.platform_effective_filter);
  const phoneFilterConfigured = Boolean(phoneFilter.enabled && phoneFilter.variable && phoneFilter.values.length);
  const sourceReady = phoneContractReadyCount(contract);
  return {
    contract,
    sourceReady,
    koboSources: contract.platform.sources.filter((source) => source.enabled).length,
    sheetReady: [contract.universe, contract.sweep].filter((slot) => slot.ready).length,
    totals,
    dailyRows: dailyRows.length,
    quotaRows: quotaRows.length,
    responsibleRows: visibleResponsibleRows.length,
    pendingRows: pendingRows.length + insistenceRows.length + detailRows.length + reattemptRows.length,
    alerts: alertModel.activeAlertCount,
    comparisonRows: comparisonRows.length,
    comparison,
    platformEffective,
    phoneFilterConfigured,
  };
}

function acreditacionRailAdvanceStats(state: MonitoreoState | null, reports: MonitoreoAcreditacionReports | null) {
  const client = reports?.client_report;
  const actorRows = client?.actors?.length ? client.actors : rowsFromSheets(reports?.sheets ?? [], ["actor", "avance", "brecha"]);
  const sourceRows = client?.sources?.length ? client.sources : rowsFromSheets(reports?.sheets ?? [], ["fuente", "source", "canal"]);
  const controlRows = client?.controls?.length ? client.controls : rowsFromSheets(reports?.sheets ?? [], ["control", "segmento", "meta"]);
  const phone = acreditacionRailPhoneStats(state, reports);
  const summary = stateFromReports(reports, num(state?.dashboard?.kpis?.total ?? state?.n_rows, 0), num(state?.dashboard?.kpis?.valid, 0), true);
  return {
    actors: actorRows.length,
    sources: sourceRows.length,
    controls: controlRows.length,
    summary,
    phone,
  };
}

export function localTabsForAcreditacionView(
  view: WorkbenchView,
  state: MonitoreoState | null,
  reports: MonitoreoAcreditacionReports | null,
  route: typeof ACREDITACION_ROUTE,
) {
  const isPhoneRoute = route.family === "telefonico" || isTelefonicoMonitoreoState(state);
  const sourceStats = acreditacionRailSourceStats(state, reports);
  const modelStats = acreditacionRailModelStats(state, reports);
  // La ruta de acreditación posee legítimamente la sección Teléfono: sus
  // pestañas no pueden depender de que la familia sea "telefonico" (gate de
  // 0.5.1 que dejaba el rail VACÍO en proyectos de acreditación aunque el
  // backend traiga los bloques monitoreo_telefonico completos).
  const phoneStats = isPhoneRoute || view === "telefonico"
    ? acreditacionRailPhoneStats(state, reports)
    : null;
  const advanceStats = acreditacionRailAdvanceStats(state, reports);

  if (view === "fuentes") {
    if (isPhoneRoute && phoneStats) {
      const [survey, sheets, , active] = ACREDITACION_SOURCE_TABS;
      return [
        railTab(survey, {
          label: "Kobo",
          detail: phoneStats.contract.platform.ready
            ? `${countText(phoneStats.koboSources, "encuesta")} · ${phoneStats.phoneFilterConfigured ? "filtro listo" : "elige filtro"}`
            : "elige encuesta y filtro de efectiva",
          badge: phoneStats.koboSources ? fmt(phoneStats.koboSources) : undefined,
          status: readyStatus(phoneStats.contract.platform.ready && phoneStats.phoneFilterConfigured),
        }),
        railTab(sheets, {
          label: "Base y barrido",
          detail: `${phoneStats.sheetReady}/2 Sheets · universo y estados`,
          badge: `${phoneStats.sheetReady}/2`,
          status: readyStatus(phoneStats.sheetReady === 2),
        }),
        railTab(active, {
          label: "Paquete",
          detail: `${phoneStats.sourceReady}/3 fuentes · corte local`,
          badge: `${phoneStats.sourceReady}/3`,
          status: readyStatus(phoneStats.sourceReady === 3),
        }),
      ];
    }
    const [survey, sheets, collectors, active] = ACREDITACION_SOURCE_TABS;
    return [
      railTab(survey, {
        label: "Plataforma",
        detail: sourceStats.platform ? `${countText(sourceStats.platformEnabled, "activa")} · respuestas` : "conecta encuestas",
        badge: sourceStats.platform ? fmt(sourceStats.platform) : undefined,
        status: readyStatus(sourceStats.platformEnabled > 0),
      }),
      railTab(sheets, {
        label: "Bases",
        detail: sourceStats.sheets ? `${countText(sourceStats.sheetsEnabled, "activa")} · universo` : "conecta Sheets",
        badge: sourceStats.sheets ? fmt(sourceStats.sheets) : undefined,
        status: readyStatus(sourceStats.sheetsEnabled > 0),
      }),
      railTab(collectors, {
        label: "Recopiladores",
        detail: sourceStats.collectors ? `${countText(sourceStats.collectors, "enlace")} · inclusión` : "vincula enlaces",
        badge: sourceStats.collectors ? fmt(sourceStats.collectors) : undefined,
        status: readyStatus(sourceStats.collectors > 0),
      }),
      railTab(active, {
        label: "Estado",
        detail: `${sourceStats.enabled}/${sourceStats.total || 0} fuentes · ${countText(sourceStats.reportSources, "fila")}`,
        badge: sourceStats.total ? `${sourceStats.enabled}/${sourceStats.total}` : undefined,
        status: readyStatus(sourceStats.total > 0 && sourceStats.enabled === sourceStats.total),
      }),
    ];
  }

  if (view === "modelo") {
    const [structure, schedule, summary] = ACREDITACION_MODEL_TABS;
    if (isPhoneRoute && phoneStats) {
      return [
        railTab(structure, {
          label: "Cuotas",
          detail: modelStats.phoneQuotaRows
            ? `${countText(modelStats.phoneQuotaVariables, "variable")} · metas Kobo`
            : "define metas por variable",
          badge: modelStats.phoneQuotaRows ? fmt(modelStats.phoneQuotaRows) : undefined,
          status: readyStatus(modelStats.phoneQuotaRows > 0),
        }),
        railTab(schedule, {
          label: "Cronograma",
          detail: modelStats.schedule,
          badge: modelStats.phases ? fmt(modelStats.phases) : undefined,
          status: readyStatus(modelStats.phases > 0),
        }),
        railTab(summary, {
          label: "Lectura",
          detail: `${phoneStats.sourceReady}/3 fuentes · ${countText(phoneStats.totals.total, "caso")}`,
          badge: `${phoneStats.sourceReady}/3`,
          status: readyStatus(phoneStats.sourceReady === 3),
        }),
      ];
    }
    return [
      railTab(structure, {
        detail: modelStats.actors ? `${countText(modelStats.actors, "actor")} · ${countText(modelStats.goals, "meta")}` : "define actores y metas",
        badge: modelStats.actors ? fmt(modelStats.actors) : undefined,
        status: readyStatus(modelStats.actors > 0 || modelStats.goals > 0),
      }),
      railTab(schedule, {
        detail: modelStats.schedule,
        badge: modelStats.phases ? fmt(modelStats.phases) : undefined,
        status: readyStatus(modelStats.phases > 0),
      }),
      railTab(summary, {
        label: "Lectura",
        detail: `${sourceStats.enabled}/${sourceStats.total || 0} fuentes · sin editar`,
        badge: sourceStats.total ? `${sourceStats.enabled}/${sourceStats.total}` : undefined,
        status: readyStatus(sourceStats.enabled > 0),
      }),
    ];
  }

  if (view === "consultas") {
    const queries = normalizeInternalQueries(reports?.internal_queries);
    const cases = queries.case_rollup?.length ? queries.case_rollup : queries.cases;
    const caseSummary = summarizeInternalCases(cases);
    const issues = queries.issues.reduce((acc, issue) => acc + (num(issue.count, 1) || 1), 0);
    const [platform, base, crosses, fixes] = ACREDITACION_CONSULTA_TABS;
    return [
      railTab(platform, {
        detail: cases.length ? `${countText(cases.length, "caso")} · respuestas` : "sin casos trazados",
        badge: cases.length ? fmt(cases.length) : undefined,
        status: readyStatus(cases.length > 0),
      }),
      railTab(base, {
        detail: `${countText(caseSummary.pending, "pendiente")} · base`,
        badge: caseSummary.pending ? fmt(caseSummary.pending) : undefined,
        status: readyStatus(cases.length > 0),
      }),
      railTab(crosses, {
        detail: `${countText(caseSummary.effective, "efectiva")} · cruce`,
        badge: caseSummary.effective ? fmt(caseSummary.effective) : undefined,
        status: readyStatus(caseSummary.effective > 0),
      }),
      railTab(fixes, {
        detail: issues ? `${countText(issues, "alerta")} · revisar` : "sin alertas",
        badge: issues ? fmt(issues) : undefined,
        status: readyStatus(!issues, issues > 0),
      }),
    ];
  }

  if (view === "telefonico" && phoneStats) {
    const [summary, day, incidence, responsible, alerts, supervision] = ACREDITACION_PHONE_TABS;
    return [
      railTab(summary, {
        label: "Barrido + Kobo",
        detail: phoneStats.comparisonRows
          ? `${fmt(phoneStats.comparison.matchedEffective)} coinciden · ${fmt(phoneStats.comparison.mismatch)} dif.`
          : `${fmt(phoneStats.totals.effective)} efectivas declaradas`,
        badge: phoneStats.comparisonRows ? fmt(phoneStats.comparisonRows) : undefined,
        status: readyStatus(phoneStats.comparisonRows > 0, phoneStats.comparison.mismatch > 0),
      }),
      railTab(day, {
        label: "Ritmo diario",
        detail: `${countText(phoneStats.dailyRows, "día", "días")} · ${fmt(phoneStats.platformEffective)} Kobo`,
        badge: phoneStats.dailyRows ? fmt(phoneStats.dailyRows) : undefined,
        status: readyStatus(phoneStats.dailyRows > 0),
      }),
      railTab(incidence, {
        label: "Sin efectiva",
        detail: `${fmt(phoneStats.totals.incidents)} sin efectiva · ${fmt(phoneStats.totals.unswept)} por barrer`,
        badge: phoneStats.pendingRows ? fmt(phoneStats.pendingRows) : undefined,
        status: phoneStats.totals.incidents || phoneStats.totals.unswept ? "warning" : "ready",
      }),
      railTab(responsible, {
        label: "Responsables",
        detail: `${countText(phoneStats.totals.responsables || phoneStats.responsibleRows, "persona")} · carga`,
        badge: phoneStats.totals.responsables ? fmt(phoneStats.totals.responsables) : undefined,
        status: readyStatus(phoneStats.responsibleRows > 0),
      }),
      railTab(alerts, {
        label: "Alertas reales",
        detail: phoneStats.alerts ? countText(phoneStats.alerts, "alerta localizada", "alertas localizadas") : "sin alertas activas",
        badge: phoneStats.alerts ? fmt(phoneStats.alerts) : undefined,
        status: readyStatus(!phoneStats.alerts, phoneStats.alerts > 0),
      }),
      railTab(supervision, {
        label: "Supervisión",
        detail: phoneStats.comparison.mismatch
          ? `${fmt(phoneStats.comparison.mismatch)} diferencias priorizadas`
          : `${fmt(phoneStats.totals.effective)} efectivas para control`,
        badge: phoneStats.comparison.mismatch ? fmt(phoneStats.comparison.mismatch) : undefined,
        status: readyStatus(phoneStats.totals.effective > 0, phoneStats.comparison.mismatch > 0),
      }),
    ];
  }

  if (view === "avance") {
    const [summary, actors, surveys, detail, outputs] = ACREDITACION_ADVANCE_TABS;
    if (isPhoneRoute && phoneStats) {
      return [
        railTab(summary, {
          label: "Diario general",
          detail: `${countText(phoneStats.platformEffective, "efectiva")} · ritmo Kobo`,
          badge: phoneStats.platformEffective ? fmt(phoneStats.platformEffective) : undefined,
          status: readyStatus(phoneStats.platformEffective > 0 && phoneStats.phoneFilterConfigured),
        }),
        railTab(actors, {
          label: "Cuotas",
          detail: phoneStats.quotaRows ? `${countText(phoneStats.quotaRows, "celda")} · pendientes` : "sin cuotas leídas",
          badge: phoneStats.quotaRows ? fmt(phoneStats.quotaRows) : undefined,
          status: readyStatus(phoneStats.quotaRows > 0),
        }),
        railTab(surveys, {
          label: "Contexto",
          detail: `${countText(phoneStats.platformEffective, "efectiva")} · barrido paralelo`,
          badge: phoneStats.platformEffective ? fmt(phoneStats.platformEffective) : undefined,
          status: readyStatus(phoneStats.platformEffective > 0),
        }),
        railTab(detail, {
          label: "CodPulso",
          detail: phoneStats.comparison.mismatch
            ? `${countText(phoneStats.comparison.mismatch, "diferencia")} · revisar`
            : "coincidencia barrido-Kobo",
          badge: phoneStats.comparison.mismatch ? fmt(phoneStats.comparison.mismatch) : undefined,
          status: readyStatus(!phoneStats.comparison.mismatch, phoneStats.comparison.mismatch > 0),
        }),
        railTab(outputs, {
          label: "Salidas",
          detail: "publica PDF y hojas de avance",
          status: state?.has_snapshot ? "ready" : "muted",
        }),
      ];
    }
    return [
      railTab(summary, {
        detail: `${fmt(advanceStats.summary.effective)} efectivas · ${fmt(advanceStats.summary.universe)} universo`,
        badge: advanceStats.summary.effective ? fmt(advanceStats.summary.effective) : undefined,
        status: readyStatus(advanceStats.summary.effective > 0),
      }),
      railTab(actors, {
        detail: `${countText(advanceStats.actors, "actor")} · brechas`,
        badge: advanceStats.actors ? fmt(advanceStats.actors) : undefined,
        status: readyStatus(advanceStats.actors > 0),
      }),
      railTab(surveys, {
        detail: `${countText(advanceStats.sources, "fuente")} · canales`,
        badge: advanceStats.sources ? fmt(advanceStats.sources) : undefined,
        status: readyStatus(advanceStats.sources > 0),
      }),
      railTab(detail, {
        detail: `${countText(advanceStats.controls, "control")} · reglas`,
        badge: advanceStats.controls ? fmt(advanceStats.controls) : undefined,
        status: readyStatus(advanceStats.controls > 0),
      }),
      railTab(outputs, {
        detail: "publica PDF y hojas cliente",
        status: state?.has_snapshot ? "ready" : "muted",
      }),
    ];
  }

  return [];
}

function AcreditacionWorkbenchRail({
  route,
  activeView,
  activeLocalTab,
  onLocalTabChange,
  syncedAt,
  state,
  reports,
}: {
  route: typeof ACREDITACION_ROUTE;
  activeView: WorkbenchView;
  activeLocalTab: string;
  onLocalTabChange: (view: WorkbenchView, tab: AcreditacionLocalTabKey) => void;
  syncedAt: string;
  state: MonitoreoState | null;
  reports: MonitoreoAcreditacionReports | null;
}) {
  const views = workbenchViewsForRoute(route);
  const activeSection = views.find((item) => item.key === activeView) ?? views[0] ?? {
    label: route.shortLabel,
    desc: "Vista operativa",
    icon: route.icon,
  };
  const localTabs = localTabsForAcreditacionView(activeView, state, reports, route);

  return (
    <MonitoreoWorkbenchRail
      activeLocalTab={activeLocalTab}
      activeSection={activeSection}
      activeView={activeView}
      ariaLabel="Flujos de monitoreo de acreditación"
      className="is-acreditacion"
      emptyDetail={reports?.report_scope ?? activeSection.desc ?? "Vista operativa"}
      iconOnlyTabs
      localTabs={localTabs}
      modeCountLabel={`${localTabs.length || 1} pestañas`}
      routeLabel={route.shortLabel}
      routeSectionLabel={`${route.shortLabel} · sección`}
      routeShortLabel={route.shortLabel}
      statusAriaLabel="Última actualización del monitoreo"
      statusItems={[
        {
          label: "Última actualización",
          value: syncedAt ? formatDate(syncedAt) : "Sin actualización",
          ready: Boolean(syncedAt),
        },
      ]}
      onLocalTabChange={(key) => onLocalTabChange(activeView, key as AcreditacionLocalTabKey)}
    />
  );
}

function AcreditacionWorkbenchHead({
  route,
  activeView,
  state,
  reports,
}: {
  route: typeof ACREDITACION_ROUTE;
  activeView: WorkbenchView;
  state: MonitoreoState | null;
  reports: MonitoreoAcreditacionReports | null;
}) {
  const views = workbenchViewsForRoute(route);
  const meta = views.find((item) => item.key === activeView) ?? views[0];
  const Icon = meta.icon;
  const activeSources = activeSourceCount(state);
  const preferActors = activeView === "modelo" || activeView === "avance";
  const summary = stateFromReports(reports, num(state?.dashboard?.kpis?.total ?? state?.n_rows, 0), num(state?.dashboard?.kpis?.valid, 0), preferActors);
  const valid = num(state?.dashboard?.kpis?.valid, 0) || summary.effective;
  const mechanisms = state?.config?.strategy_phases?.length ?? 0;
  const actorCount = reports?.client_report?.actors?.length ?? 0;
  const lastPill = activeView === "modelo"
    ? `${fmt(actorCount)} actores`
    : `${fmt(mechanisms)} mecanismos`;

  return (
    <MonitoreoWorkbenchHead
      icon={Icon}
      eyebrow={`${route.shortLabel} · flujo actual`}
      title={meta.label}
      detail={meta.desc}
      pills={[
        `${activeSources} fuentes`,
        `${fmt(state?.n_rows ?? 0)} registros`,
        `${fmt(valid)} válidas`,
        lastPill,
      ]}
    />
  );
}

export function acreditacionPhoneStatusLegendItems(rows: Array<Record<string, unknown>>) {
  return rows.map((row, index) => {
    const label = phoneRowValue(row, ["Estado", "Estatus", "Indicador"], `Estado ${index + 1}`);
    const value = phoneRowNumber(row, ["Casos", "Valor", "Total"], 0);
    const tone = phoneStatusTone(label);
    const palette = phoneStatusPalette(label);
    return {
      key: `${normalizeSourceMatch(label) || "estado"}-${index}`,
      label,
      value,
      tone,
      palette,
    };
  }).filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "es"));
}

function phoneSemanticToneClass(tone: ReturnType<typeof phoneStatusTone>) {
  if (tone === "good") return "is-effective";
  if (tone === "warn") return "is-partial";
  if (tone === "risk") return "is-refusal";
  if (tone === "unswept") return "is-pending";
  return "is-assignment";
}

function AcreditacionSemanticStatusLegend({ rows }: { rows: Array<Record<string, unknown>> }) {
  const items = acreditacionPhoneStatusLegendItems(rows);
  if (!items.length) return null;
  return (
    <div className="mon-semantic-legend is-phone" aria-label="Estados de la base telefónica">
      {items.map((item) => (
        <span
          key={item.key}
          className={phoneSemanticToneClass(item.tone)}
          style={{ "--clarity-accent": item.palette.color } as CSSProperties}
          title={`${item.label}: ${fmt(item.value)}`}
        >
          <i aria-hidden="true" />
          <em>{item.label}</em>
          <strong>{fmt(item.value)}</strong>
        </span>
      ))}
    </div>
  );
}

function AcreditacionClarityStrip({
  activeView,
  state,
  reports,
}: {
  activeView: WorkbenchView;
  state: MonitoreoState | null;
  reports: MonitoreoAcreditacionReports | null;
}) {
  const isPhoneState = isTelefonicoMonitoreoState(state);
  const sourceTotal = isPhoneState ? 3 : state?.sources?.length ?? 0;
  const activeSources = activeSourceCount(state);
  const sourceGap = Math.max(0, sourceTotal - activeSources);
  const summary = stateFromReports(reports, num(state?.dashboard?.kpis?.total ?? state?.n_rows, 0), num(state?.dashboard?.kpis?.valid, 0));
  const queries = normalizeInternalQueries(reports?.internal_queries);
  const cases = queries.case_rollup?.length ? queries.case_rollup : queries.cases;
  const caseSummary = summarizeInternalCases(cases);
  const issueCount = queries.issues.reduce((acc, issue) => acc + (num(issue.count, 1) || 1), 0);
  const phoneSummaryRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["resumen_telefonico"]) : [];
  const phoneRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["resumen_telefonico", "estatus_telefonico"]) : [];
  const phoneStatusSheetRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["estatus_telefonico"]) : [];
  const phoneStatusRows = phoneStatusSheetRows.length
    ? phoneStatusSheetRows
    : groupedCaseRows(cases, internalCaseResponseStateValue, internalCaseResponseStateLabel);
  const phoneStatusTotal = phoneStatusRows.reduce((sum, row) => sum + phoneRowNumber(row, ["Casos", "Valor", "Total"], 0), 0);
  const phoneBaseFromReport = phoneSummaryValue(phoneSummaryRows, "total telefonico")
    ?? phoneSummaryValue(phoneSummaryRows, "total telefónico")
    ?? phoneStatusTotal;
  const phoneBaseTotal = phoneBaseFromReport
    || summary.universe
    || state?.n_rows
    || 0;
  const phonePendingTotal = phoneSummaryValue(phoneSummaryRows, "no barridos") ?? summary.unanswered;
  const platformCaseCount = cases.length;
  const platformHasReport = Boolean(
    platformCaseCount ||
      reports?.client_report?.actors?.length ||
      reports?.client_report?.sources?.length ||
      reports?.client_report?.daily_general?.length,
  );
  const actorRows = reports?.client_report?.actors ?? [];
  const configuredGoals = state?.config?.goals?.filter((goal) => Number(goal.meta) > 0).length ?? 0;
  const bloqueos = state?.acreditacion?.dashboard?.bloqueos ?? 0;
  const phoneQuotaReportRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"]) : [];
  const phoneQuotaVariable = isPhoneState && state?.config
    ? preferredPhoneQuotaVariable(state.variables ?? [], state.config.control_vars ?? [], phoneQuotaReportRows, state.config.goals ?? [])
    : "";
  const phoneQuotaEditorRows = isPhoneState && state?.config
    ? buildAcreditacionPhoneQuotaEditorRows({
      variable: phoneQuotaVariable,
      variables: state.variables ?? [],
      goals: state.config.goals ?? [],
      quotaRows: phoneQuotaReportRows,
    })
    : [];
  const phoneQuotaGoal = phoneQuotaVariable && state?.config ? phoneQuotaGoalTotal(state.config.goals ?? [], phoneQuotaVariable) : 0;
  const itemsByView = {
    fuentes: [
      { label: "Fuentes", value: `${activeSources}/${sourceTotal || 0}`, hint: sourceGap ? `${sourceGap} pendientes` : "paquete listo", tone: sourceGap ? "warning" : "ready", icon: ClipboardCheck },
      { label: "Base", value: state?.n_rows ? fmt(state.n_rows) : "S/D", hint: "registros leídos", tone: state?.n_rows ? "base" : "warning", icon: Table2 },
      { label: "Sync", value: reports ? "Listo" : "Pendiente", hint: reports?.generated_at ? formatDate(reports.generated_at) : "requiere corte", tone: reports ? "ready" : "warning", icon: RefreshCw },
    ],
    modelo: isPhoneState ? [
      { label: "Variable rectora", value: phoneQuotaVariable ? phoneQuotaVariableLabel(phoneQuotaVariable) : "Pendiente", hint: `${fmt(phoneQuotaEditorRows.length)} categorías`, tone: phoneQuotaVariable ? "base" : "warning", icon: SlidersHorizontal },
      { label: "Objetivo Kobo", value: phoneQuotaGoal ? fmt(phoneQuotaGoal) : "S/M", hint: "efectivas filtradas", tone: phoneQuotaGoal ? "ready" : "warning", icon: Target },
      { label: "Categorías", value: fmt(phoneQuotaEditorRows.length), hint: phoneQuotaVariable ? `metas por ${phoneQuotaVariableLabel(phoneQuotaVariable).toLowerCase()}` : "define variable", tone: phoneQuotaEditorRows.length ? "ready" : "warning", icon: ShieldAlert },
    ] : [
      { label: "Actores", value: fmt(actorRows.length), hint: "cortes del reporte", tone: actorRows.length ? "base" : "warning", icon: ClipboardCheck },
      { label: "Metas", value: fmt(configuredGoals), hint: "configuradas", tone: configuredGoals ? "ready" : "warning", icon: Target },
      { label: "Bloqueos", value: fmt(bloqueos), hint: bloqueos ? "requieren cierre" : "sin bloqueos", tone: bloqueos ? "warning" : "ready", icon: ShieldAlert },
    ],
    avance: [
      { label: "Efectivas", value: summary.effective ? fmt(summary.effective) : "S/D", hint: summary.universe ? `${pctFrom(summary.effective, summary.universe)} del universo` : isPhoneState ? "efectivas Kobo" : "plataforma completa", tone: summary.effective ? "effective" : "warning", icon: CheckCircle2 },
      isPhoneState
        ? { label: "Kobo", value: platformCaseCount ? fmt(platformCaseCount) : (platformHasReport ? "Listo" : "Pendiente"), hint: "cruce por CodPulso", tone: platformHasReport ? "ready" : "warning", icon: Search }
        : { label: "Parciales", value: fmt(summary.partial), hint: "no cuentan como efectivas", tone: summary.partial ? "partial" : "ready", icon: AlertCircle },
      { label: "Universo", value: summary.universe ? fmt(summary.universe) : fmt(state?.n_rows ?? 0), hint: summary.referenceLabel, tone: summary.universe || state?.n_rows ? "base" : "warning", icon: Table2 },
    ],
    consultas: [
      { label: "Efectivas", value: cases.length ? fmt(caseSummary.effective) : "S/D", hint: "reales trazadas", tone: caseSummary.effective ? "effective" : "warning", icon: CheckCircle2 },
      { label: "Salen pendientes", value: fmt(caseSummary.pendingExit), hint: "faltantes recuperados", tone: caseSummary.pendingExit ? "ready" : "base", icon: Link2 },
      { label: "Alertas", value: fmt(issueCount), hint: "casos de revisión", tone: issueCount ? "warning" : "ready", icon: ShieldAlert },
    ],
    telefonico: [
      { label: "Base tel.", value: phoneBaseTotal ? fmt(phoneBaseTotal) : "Pendiente", hint: phoneRows.length ? "base de barrido" : "requiere corte", tone: phoneBaseTotal ? "base" : "warning", icon: PhoneCall },
      { label: "Kobo", value: platformCaseCount ? fmt(platformCaseCount) : (platformHasReport ? "Listo" : "Pendiente"), hint: platformCaseCount ? "casos trazados" : "cruce no cargado", tone: platformHasReport ? "ready" : "warning", icon: Search },
      { label: "Por barrer", value: fmt(phonePendingTotal), hint: "operación telefónica", tone: phonePendingTotal ? "pending" : "ready", icon: AlertCircle },
    ],
    ocurrencias: [],
    calidad: [],
  };
  const items = itemsByView[activeView] ?? itemsByView.fuentes;
  const clarityLabel = isPhoneState ? "Lectura operativa de monitoreo telefónico" : "Lectura operativa de acreditación";

  return (
    <section className={`mon-clarity-strip is-${activeView}`} aria-label={clarityLabel}>
      <div className="mon-clarity-items">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <span key={`${activeView}-${item.label}`} className={`mon-clarity-card is-${item.tone}`}>
              <Icon size={14} />
              <span>
                <em>{item.label}</em>
                <strong>{item.value}</strong>
                <small>{item.hint}</small>
              </span>
            </span>
          );
        })}
      </div>
      {activeView === "telefonico" ? <AcreditacionSemanticStatusLegend rows={phoneStatusRows} /> : null}
    </section>
  );
}

export function AcreditacionProfilePage({ mode = "acreditacion" }: { mode?: AcreditacionProfileMode }) {
  const isPhone = mode === "telefonico";
  const route = isPhone ? TELEFONICO_ROUTE : ACREDITACION_ROUTE;
  const profileLabel = isPhone ? "Monitoreo telefónico" : "Acreditación";
  const [state, setState] = useState<MonitoreoState | null>(null);
  const [activeView, setActiveView] = useState<WorkbenchView>(() => initialMonitoreoView("fuentes", workbenchViewsForRoute(route)));
  useMonitoreoTabParam(activeView);
  const [activeSourceTab, setActiveSourceTab] = useState<AcreditacionSourceTab>(isPhone ? "sheets" : "survey");
  const [activeModelTab, setActiveModelTab] = useState<AcreditacionModelTab>("estructura");
  const [activeConsultaTab, setActiveConsultaTab] = useState<AcreditacionConsultaTab>("plataforma");
  const [activePhoneTab, setActivePhoneTab] = useState<AcreditacionPhoneTab>("resumen");
  const [activeAdvanceTab, setActiveAdvanceTab] = useState<AcreditacionAdvanceTab>("resumen");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingAcreditacion, setSavingAcreditacion] = useState(false);
  const [sourceSyncing, setSourceSyncing] = useState(false);
  const [sourceSyncProgress, setSourceSyncProgress] = useState<AcreditacionSourceSyncProgress | null>(null);
  const [actionStatus, setActionStatus] = useState<AcreditacionActionStatus>(null);
  const [caseReconciliationBusyId, setCaseReconciliationBusyId] = useState("");
  const [caseReconciliationStatus, setCaseReconciliationStatus] = useState<AcreditacionActionStatus>(null);
  const activeViewRef = useRef<WorkbenchView>(activeView);
  const loadSeqRef = useRef(0);
  const initialLoadStartedRef = useRef(false);
  const warmedScopesRef = useRef(new Set<string>());
  const stateByScopeRef = useRef(new Map<string, MonitoreoState>());
  const scopeCacheEpochRef = useRef(0);

  const routeWorkbenchViews = useMemo(() => workbenchViewsForRoute(route), [route]);
  const activeDef = useMemo(
    () => routeWorkbenchViews.find((item) => item.key === activeView)
      ?? WORKBENCH_VIEWS.find((item) => item.key === activeView)
      ?? routeWorkbenchViews[0]
      ?? WORKBENCH_VIEWS[0],
    [activeView, routeWorkbenchViews],
  );
  const reports = reportsFromState(state);
  const prefetchBackgroundScopes = useCallback((view: WorkbenchView) => {
    const activeScope = scopeForView(view, route.family);
    const scopes = [activeScope, ...ACREDITACION_BACKGROUND_SCOPES]
      .filter((scope, index, all) => scope !== "full" && all.indexOf(scope) === index);
    scopes.forEach((scope, index) => {
      if (stateByScopeRef.current.has(scope)) {
        warmedScopesRef.current.add(scope);
        return;
      }
      if (warmedScopesRef.current.has(scope)) return;
      warmedScopesRef.current.add(scope);
      const cacheEpoch = scopeCacheEpochRef.current;
      window.setTimeout(() => {
        void apiMonitoreoState({
          includeReports: true,
          reportScope: scope,
          warmupCache: true,
        }).then((next) => {
          if (cacheEpoch !== scopeCacheEpochRef.current) return;
          stateByScopeRef.current.set(scope, next);
        }).catch(() => {
          if (cacheEpoch !== scopeCacheEpochRef.current) return;
          warmedScopesRef.current.delete(scope);
        });
      }, 240 + index * 180);
    });
  }, [route.family]);

  // Nota (unidad 3.4): a diferencia del perfil territorial (invalidación
  // selectiva por fase+fuente), aquí el caché guarda MonitoreoState COMPLETOS
  // keyed solo por scope; toda mutación de este perfil cambia config/KPIs que
  // cualquier vista lee del state cacheado, así que conservar scopes tras una
  // mutación mostraría estado visiblemente stale. El clear total sigue siendo
  // la invalidación correcta para este perfil.
  const clearScopeStateCache = useCallback(() => {
    scopeCacheEpochRef.current += 1;
    stateByScopeRef.current.clear();
    warmedScopesRef.current.clear();
  }, []);

  const loadView = useCallback(async (view: WorkbenchView, force = false) => {
    const seq = ++loadSeqRef.current;
    const reportScope = scopeForView(view, route.family);
    if (force) {
      clearScopeStateCache();
    } else {
      const cachedState = stateByScopeRef.current.get(reportScope);
      if (cachedState) {
        setState(cachedState);
        setError("");
        setLoading(false);
        warmedScopesRef.current.add(reportScope);
        prefetchBackgroundScopes(view);
        return;
      }
    }
    setLoading(true);
    try {
      const next = await apiMonitoreoState({
        includeReports: true,
        reportScope,
        warmupCache: !force,
        force,
      });
      if (seq !== loadSeqRef.current || view !== activeViewRef.current) return;
      stateByScopeRef.current.set(reportScope, next);
      warmedScopesRef.current.add(reportScope);
      setState(next);
      setError("");
      prefetchBackgroundScopes(view);
    } catch (e) {
      if (seq !== loadSeqRef.current || view !== activeViewRef.current) return;
      setError((e as Error).message);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [clearScopeStateCache, prefetchBackgroundScopes, route.family]);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    if (initialLoadStartedRef.current) return;
    initialLoadStartedRef.current = true;
    void loadView(activeView);
  }, [activeView, loadView]);

  useEffect(() => {
    if (!isPhone || activeView !== "fuentes" || activeSourceTab !== "collectors") return;
    setActiveSourceTab("survey");
  }, [activeSourceTab, activeView, isPhone]);

  const refreshCurrentView = useCallback(() => {
    void loadView(activeView, true);
  }, [activeView, loadView]);
  const applyStateChange = useCallback((nextState: MonitoreoState) => {
    clearScopeStateCache();
    setState(nextState);
    const reportScope = scopeForView(activeViewRef.current, route.family);
    stateByScopeRef.current.set(reportScope, nextState);
    warmedScopesRef.current.add(reportScope);
  }, [clearScopeStateCache, route.family]);
  const saveSeguimiento = useCallback(async (payload: MonitoreoAcreditacionSeguimientoPayload) => {
    setSavingAcreditacion(true);
    setError("");
    setActionStatus(null);
    try {
      const result = await apiMonitoreoAcreditacionSeguimiento(payload);
      clearScopeStateCache();
      setState(result.state);
      setActionStatus({ tone: "success", message: "Avance registrado en el seguimiento." });
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      setActionStatus({ tone: "error", message });
    } finally {
      setSavingAcreditacion(false);
    }
  }, [clearScopeStateCache]);
  const closeAcreditacion = useCallback(async (planRefuerzo: string, aprobarBrechas: boolean) => {
    setSavingAcreditacion(true);
    setError("");
    setActionStatus(null);
    try {
      const result = await apiMonitoreoCierre({ plan_refuerzo: planRefuerzo, aprobar_brechas: aprobarBrechas });
      clearScopeStateCache();
      setState(result.state);
      setActionStatus({ tone: "success", message: "Cierre de acreditación actualizado." });
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      setActionStatus({ tone: "error", message });
    } finally {
      setSavingAcreditacion(false);
    }
  }, [clearScopeStateCache]);
  const saveCaseReconciliationDecision = useCallback(async (payload: AcreditacionCaseReconciliationPayload) => {
    const responseId = payload.response_id.trim();
    if (!responseId) return;
    setCaseReconciliationBusyId(responseId);
    setCaseReconciliationStatus(null);
    setError("");
    try {
      const result = await apiMonitoreoAcreditacionCaseReconciliation({ ...payload, response_id: responseId });
      clearScopeStateCache();
      setState(result.state);
      const next = await apiMonitoreoState({
        includeReports: true,
        reportScope: "queries_summary",
        warmupCache: false,
        force: true,
      });
      stateByScopeRef.current.set("queries_summary", next);
      warmedScopesRef.current.add("queries_summary");
      setState(next);
      setCaseReconciliationStatus({
        tone: "success",
        message: result.decision.action === "include_with_caveat"
          ? "Caso incluido con salvedad y reporte actualizado."
          : "Caso mantenido fuera del avance y reporte actualizado.",
      });
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      setCaseReconciliationStatus({ tone: "error", message });
    } finally {
      setCaseReconciliationBusyId("");
    }
  }, [clearScopeStateCache]);
  const runProfileSourceSync = useCallback(async (syncMode: "full" | "advance") => {
    const currentSources = state?.sources ?? [];
    const sourceIds = currentSources
      .filter((source) => {
        if (!source.enabled) return false;
        if (syncMode === "full") return true;
        if (route.family === "telefonico") return source.kind === "kobo" && (source.role === "respuestas" || !source.role || Boolean(source.asset_uid));
        return (source.kind === "surveymonkey" || source.kind === "kobo") && (source.role === "respuestas" || !source.role);
      })
      .map((source) => source.id);
    if (!sourceIds.length) {
      const message = syncMode === "full"
        ? "No hay fuentes activas para actualizar."
        : "No hay fuentes de respuesta activas para actualizar avance.";
      setError(message);
      setActionStatus({ tone: "error", message });
      return;
    }
	    setSourceSyncing(true);
	    setSourceSyncProgress({
	      mode: syncMode,
	      percent: 2,
	      phase: "Preparando",
	      message: syncMode === "full" ? "Preparando actualización completa..." : "Preparando avance...",
	    });
	    setError("");
	    setActionStatus({ tone: "info", message: syncMode === "full" ? "Actualizando todas las fuentes activas..." : "Actualizando solo avance de respuestas..." });
	    try {
	      const start = await apiMonitoreoSync(state?.config, sourceIds, { syncMode });
	      setSourceSyncProgress({
	        mode: syncMode,
	        percent: 8,
	        phase: "En cola",
	        message: `Job ${start.job_id} en cola.`,
	      });
	      setActionStatus({ tone: "info", message: `Sincronizacion ${syncMode === "full" ? "completa" : "de avance"} en job ${start.job_id}.` });
	      await waitForSourceSyncJob(start.job_id, (progress) => {
	        setSourceSyncProgress({
	          mode: syncMode,
	          ...progress,
	        });
	      });
      clearScopeStateCache();
      const reportScope = scopeForView(activeViewRef.current, route.family);
      const next = await apiMonitoreoState({
        includeReports: true,
        reportScope,
        warmupCache: false,
        force: true,
      });
      stateByScopeRef.current.set(reportScope, next);
      warmedScopesRef.current.add(reportScope);
      setState(next);
      setActionStatus({ tone: "success", message: syncMode === "full" ? "Actualizacion completa lista; recopiladores persistidos si la API devolvio metadata." : "Avance actualizado usando la relacion guardada de recopiladores." });
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      setActionStatus({ tone: "error", message });
	    } finally {
	      setSourceSyncProgress(null);
	      setSourceSyncing(false);
	    }
  }, [clearScopeStateCache, route.family, state?.config, state?.sources]);
  const sourceTotal = isPhone ? 3 : state?.sources?.length ?? 0;
  const activeSources = activeSourceCount(state);
  const chromeBusy = savingAcreditacion || sourceSyncing || Boolean(caseReconciliationBusyId);
  const refreshTitle = sourceSyncing ? "Sincronizando fuentes..." : loading ? "Actualizando vista..." : `Actualizar ${activeDef.shortLabel ?? activeDef.label}`;
  const activeLocalTab = activeView === "fuentes"
    ? activeSourceTab
    : activeView === "modelo"
      ? activeModelTab
      : activeView === "consultas"
        ? activeConsultaTab
        : activeView === "telefonico"
          ? activePhoneTab
          : activeView === "avance"
            ? activeAdvanceTab
            : "";
  const hideWorkbenchStatus = activeView === "consultas" && (activeConsultaTab === "plataforma" || activeConsultaTab === "base");
  const changeLocalTab = useCallback((view: WorkbenchView, tab: AcreditacionLocalTabKey) => {
    if (view === "fuentes" && ACREDITACION_SOURCE_TABS.some((item) => item.key === tab)) {
      setActiveSourceTab(tab as AcreditacionSourceTab);
    } else if (view === "modelo" && ACREDITACION_MODEL_TABS.some((item) => item.key === tab)) {
      setActiveModelTab(tab as AcreditacionModelTab);
    } else if (view === "consultas" && ACREDITACION_CONSULTA_TABS.some((item) => item.key === tab)) {
      setActiveConsultaTab(tab as AcreditacionConsultaTab);
    } else if (view === "telefonico" && ACREDITACION_PHONE_TABS.some((item) => item.key === tab)) {
      setActivePhoneTab(tab as AcreditacionPhoneTab);
    } else if (view === "avance" && ACREDITACION_ADVANCE_TABS.some((item) => item.key === tab)) {
      setActiveAdvanceTab(tab as AcreditacionAdvanceTab);
    }
  }, []);
  const navigateLocalTab = useCallback((view: WorkbenchView, tab: AcreditacionLocalTabKey) => {
    changeLocalTab(view, tab);
    if (view === activeViewRef.current) return;
    activeViewRef.current = view;
    setActiveView(view);
    if (view !== "avance") setActiveAdvanceTab("resumen");
    void loadView(view);
  }, [changeLocalTab, loadView]);

  return (
    <div className="mon-profile-canonical-shell" style={MODULE_TONES.monitoreo as CSSProperties}>
        <PageFrame
          title={route.label}
        layout="workbench"
        scrollOwner="panels"
        bodyMode="fill"
        headerMode="sr-only"
        className="mon-page"
        resetScrollKey={`${activeView}:${activeLocalTab}`}
        density="compact"
      >
        <span
          hidden
          data-audit-ready="monitoreo-acreditacion"
          data-audit-has-dashboard={state?.dashboard ? "true" : "false"}
        />
        {error ? <div className="mon-profile-error"><AlertCircle size={16} /> {error}</div> : null}

        <MonitoreoModuleChrome
          routes={[route]}
          route={route}
          routeSelected
          activeView={activeView}
          saving={chromeBusy}
          syncedAt={state?.synced_at ?? ""}
          generatedAt={state?.generated_at ?? reports?.generated_at ?? ""}
          generationStatus={state?.generation_status ?? ""}
          pendingRegeneration={Boolean(state?.pending_regeneration)}
          syncErrors={state?.sync_errors ?? state?.errors ?? []}
          sourceTotal={sourceTotal}
          activeSources={activeSources}
          nRows={state?.n_rows ?? 0}
          hasSnapshot={Boolean(state?.has_snapshot)}
	          syncing={loading || sourceSyncing}
	          syncProgress={sourceSyncProgress}
	          syncDisabled={loading || sourceSyncing}
          syncLabel="Todo"
          syncTitle="Actualizar todas las fuentes activas"
          onSyncAll={() => { void runProfileSourceSync("full"); }}
          advanceSyncDisabled={loading || sourceSyncing}
          advanceSyncLabel="Avance"
          advanceSyncTitle={refreshTitle}
          onSyncAdvance={() => { void runProfileSourceSync("advance"); }}
          onViewChange={(view) => {
            if (view === activeView) return;
            activeViewRef.current = view;
            setActiveView(view);
            if (view !== "avance") setActiveAdvanceTab("resumen");
            void loadView(view);
          }}
        />

        <MonitoreoWorkbenchChrome
          activeView={activeView}
          ariaLabel={`Mesa de trabajo de acreditación: ${activeDef.label}`}
          className="is-acreditacion"
          rail={(
            <AcreditacionWorkbenchRail
              route={route}
              activeView={activeView}
              activeLocalTab={activeLocalTab}
              onLocalTabChange={changeLocalTab}
              syncedAt={state?.synced_at ?? ""}
              state={state}
              reports={reports}
            />
          )}
          head={null}
          clarity={(
            <AcreditacionClarityStrip
              activeView={activeView}
              state={state}
              reports={reports}
            />
          )}
          status={null}
        >
          {loading ? (
            <AcreditacionLoadingPanel view={activeView} label={activeDef.label} />
          ) : renderAcreditacionView(activeView, reports, {
            activeSourceTab,
            activeModelTab,
            activeConsultaTab,
            activePhoneTab,
            activeAdvanceTab,
            acreditacion: state?.acreditacion ?? null,
            actionStatus,
            caseReconciliationBusyId,
            caseReconciliationStatus,
            onSaveSeguimiento: saveSeguimiento,
            onCerrar: closeAcreditacion,
            onConsultaTabChange: setActiveConsultaTab,
            onCaseReconciliationDecision: saveCaseReconciliationDecision,
            state,
            onStateChange: applyStateChange,
            onPublished: refreshCurrentView,
            onNavigateLocalTab: navigateLocalTab,
            routeLabel: profileLabel,
            savingAcreditacion,
          })}
        </MonitoreoWorkbenchChrome>
      </PageFrame>
    </div>
  );
}

export default function AcreditacionMonitoreoPage() {
  return <AcreditacionProfilePage mode="acreditacion" />;
}
