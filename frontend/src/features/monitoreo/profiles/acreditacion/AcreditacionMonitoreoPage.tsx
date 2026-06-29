import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AlertCircle, BarChart3, CalendarRange, CheckCircle2, ClipboardCheck, ContactRound, Download, Eye, FileCheck2, Filter, Layers3, Link2, Loader2, Mail, PhoneCall, PlugZap, Plus, QrCode, RefreshCw, Route, Save, Search, ShieldAlert, SlidersHorizontal, Table2, Target, XCircle } from "lucide-react";
import { PageFrame } from "../../../../components/PageFrame";
import {
  apiJobStatus,
  apiMonitoreoAcreditacionCaseReconciliation,
  apiMonitoreoAcreditacionSeguimiento,
  apiMonitoreoCierre,
  apiMonitoreoCollectorsConfig,
  apiMonitoreoSheetsInspect,
  apiMonitoreoSheetsSource,
  apiMonitoreoSheetsSync,
  apiMonitoreoConfig,
  apiMonitoreoSource,
  apiMonitoreoSources,
  apiMonitoreoState,
  apiMonitoreoSync,
  apiMonitoreoSurveyMonkeyCollectors,
  apiSurveyMonkeyMultibaseInspectSurvey,
  apiSurveyMonkeyMultibaseListSurveys,
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
import { MONITOREO_ROUTES, WORKBENCH_VIEWS, workbenchViewsForRoute, type WorkbenchView } from "../../core/monitoreoRegistry";
import { MonitoreoWorkbenchChrome, MonitoreoWorkbenchHead, MonitoreoWorkbenchRail } from "../../components";
import {
  filterInternalQueryCases,
  internalCaseCrossingLabel,
  internalCaseCrossingValue,
  internalCaseResponseStateLabel,
  internalCaseResponseStateValue,
  internalQueryCollectorDisplayLabel,
  normalizeInternalQueries,
  summarizeInternalCases,
} from "../../internalQueries";
import { MonitoreoOutputsWorkbench } from "../../salidas/MonitoreoOutputsWorkbench";
import { MonitoreoModuleChrome } from "../../shell/MonitoreoModuleChrome";
import type { MonitoreoReportScope } from "../types";
import "../../monitoreo.css";
import "../../shell/monitoreoShell.css";
import "../profilePage.css";

const ACREDITACION_ROUTE = MONITOREO_ROUTES.find((route) => route.family === "acreditacion") ?? MONITOREO_ROUTES[0];
const TELEFONICO_ROUTE = MONITOREO_ROUTES.find((route) => route.family === "telefonico") ?? ACREDITACION_ROUTE;
const ACREDITACION_SOURCE_TABS = [
  { key: "survey", label: "Encuestas", detail: "SurveyMonkey/Kobo", icon: QrCode },
  { key: "sheets", label: "Sheets", detail: "Universo y barrido", icon: Table2 },
  { key: "activas", label: "Fuentes activas", detail: "Estado del paquete", icon: PlugZap },
] as const;
type AcreditacionSourceTab = typeof ACREDITACION_SOURCE_TABS[number]["key"];
type AcreditacionSourcePresetKey = "base_trabajada" | "barrido_telefonico" | "respuestas_surveymonkey";
type AcreditacionSourcePreset = {
  key: AcreditacionSourcePresetKey;
  icon: typeof Layers3;
  label: string;
  service: "Google Sheets" | "SurveyMonkey";
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
    label: "Base trabajada",
    service: "Google Sheets",
    detail: "URL_HOJA_UNIVERSO con BASES_POR_ACTOR: actores o actor principal abierto por carrera.",
    bullets: ["Pestañas universo", "Actores y segmentos", "Variables de control"],
    provider: "google_sheets",
    role: "universo",
    sourceLabel: "Base trabajada",
    sheetLabel: "Pestaña de actor o carrera",
  },
  {
    key: "barrido_telefonico",
    icon: PhoneCall,
    label: "Barrido telefónico",
    service: "Google Sheets",
    detail: "MONITOREOS_TELEFONICOS y PUENTE_UNIVERSO_BARRIDO: casos, CodPulso y enlace personalizado.",
    bullets: ["Pestaña barrido", "Correos web completos", "Columnas por alias"],
    provider: "google_sheets",
    role: "barrido",
    sourceLabel: "Barrido telefónico - Egresados",
    sheetLabel: "Pestaña de barrido",
  },
  {
    key: "respuestas_surveymonkey",
    icon: QrCode,
    label: "Respuestas SurveyMonkey",
    service: "SurveyMonkey",
    detail: "ENCUESTAS_ESTUDIO: una o más encuestas por actor, segmento/carrera y canal.",
    bullets: ["Actor y canal", "Segmento/carrera", "Survey ID"],
    provider: "surveymonkey",
    role: "respuestas",
    sourceLabel: "Respuestas SurveyMonkey",
  },
];
const ACREDITACION_MODEL_TABS = [
  { key: "estructura", label: "Metas y modalidades", detail: "Por corte: meta y mecanismos", icon: Layers3 },
  { key: "casos", label: "Base de barrido", detail: "Responsables, intentos y estados", icon: ContactRound },
  { key: "enlaces", label: "Enlaces y envíos", detail: "Correo, QR y links", icon: Link2 },
  { key: "reglas", label: "Estados válidos", detail: "Qué cuenta como avance", icon: SlidersHorizontal },
  { key: "estrategias", label: "Calendario", detail: "Mecanismos por semana", icon: Route },
] as const;
type AcreditacionModelTab = typeof ACREDITACION_MODEL_TABS[number]["key"];
const ACREDITACION_CONSULTA_TABS = [
  { key: "casos", label: "Casos", detail: "Estado, llave y cruce", icon: Search },
  { key: "efectivas", label: "Efectivas", detail: "Total defendible", icon: CheckCircle2 },
  { key: "faltantes", label: "Faltantes", detail: "Quién deja de estar pendiente", icon: Route },
  { key: "duplicados", label: "Duplicados", detail: "Evitar doble conteo", icon: Link2 },
  { key: "diferencias", label: "Diferencias", detail: "Explicar por qué no cuadra", icon: ShieldAlert },
] as const;
type AcreditacionConsultaTab = typeof ACREDITACION_CONSULTA_TABS[number]["key"];
const ACREDITACION_PHONE_TABS = [
  { key: "resumen", label: "Resumen", detail: "Barrido telefónico", icon: PhoneCall },
  { key: "dia", label: "Día", detail: "Efectivas y rechazos", icon: CalendarRange },
  { key: "responsables", label: "Responsables", detail: "Equipo y carga", icon: ContactRound },
  { key: "alertas", label: "Alertas", detail: "No efectivos", icon: ShieldAlert },
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
type AcreditacionCaseReconciliationPayload = {
  response_id: string;
  action: "keep_excluded" | "include_with_caveat";
  candidate_id?: string;
  note?: string;
};

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

function AcreditacionModelActorSummaryCard({ card }: { card: AcreditacionActorCard }) {
  const connectedMechanisms = card.mechanisms.filter((item) => item.role !== "Universo");
  const baseMechanisms = card.mechanisms.filter((item) => item.role === "Universo" || item.role === "Barrido");
  const responseMechanisms = card.mechanisms.filter((item) => item.role === "Respuestas");
  const channels = Array.from(new Set(connectedMechanisms.map((item) => item.channel || item.role).filter(Boolean)));
  const statusTone = card.meta == null ? "warning" : card.statusTone === "complete" ? "ready" : "base";
  const metaPct = card.meta != null && card.universe > 0
    ? Math.round((card.meta / card.universe) * 1000) / 10
    : null;
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
          <input type="number" min={0} value={card.meta ?? ""} disabled readOnly />
        </label>
        <label>
          <span>% universo</span>
          <input type="number" min={0} max={100} value={metaPct == null ? "" : metaPct} disabled readOnly />
        </label>
        <button type="button" className="is-adjust" disabled>Ajustar</button>
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

function newPlatformRejectionDraft(): PlatformRejectionRuleDraft {
  return { id: `rechazo-plataforma-${Date.now()}-${Math.random().toString(36).slice(2)}`, question: "", answers: "No" };
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
                  <option key={option.value} value={option.value}>{option.label}</option>
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
  onStateChange,
}: {
  reports?: MonitoreoAcreditacionReports | null;
  state?: MonitoreoState | null;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const client = reports?.client_report;
  const actorRows = useMemo(() => (
    client?.actors?.length ? client.actors : rowsFromSheets(reports?.sheets ?? [], ["actor", "avance", "brecha"])
  ), [client?.actors, reports?.sheets]);
  const sourceRows = useMemo(() => (
    client?.sources?.length ? client.sources : rowsFromSheets(reports?.sheets ?? [], ["fuente", "source", "canal"])
  ), [client?.sources, reports?.sheets]);
  const dailyRows = client?.daily_general ?? [];
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
  const surveyCount = activeSources.filter((source) => source.kind === "surveymonkey" && (source.role === "respuestas" || !source.role || Boolean(source.survey_id))).length;
  const sweepCount = activeSources.filter((source) => {
    const role = normalizeSourceMatch(source.role);
    const label = normalizeSourceMatch(source.label);
    return source.kind === "google_sheets" && (role.includes("barrido") || label.includes("barrido") || label.includes("telefon"));
  }).length;
  const mechanismTotal = surveyCount + sweepCount || cards.reduce((sum, card) => sum + card.mechanisms.filter((item) => item.role !== "Universo").length, 0);
  const validRuleCount = (state?.config?.valid_statuses ?? []).length || (state?.config?.operational_model?.state_rules ?? []).length;
  const metaTotal = cards.reduce((sum, card) => sum + (card.meta ?? 0), 0);

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
            <span className="pulso-panel-eyebrow">Modelo operativo</span>
            <h2 className="pulso-panel-title"><span className="mon-title-icon"><Target size={16} /> Meta por actor</span></h2>
            <p className="pulso-panel-hint">Actores, metas, mecanismos, barrido y regla válida desde el corte hidratado.</p>
          </div>
          <div className="mon-acr-model-actions">
            <span>{fmt(cards.length)} actores</span>
            <span>{fmt(surveyCount)} encuestas</span>
            <span>{fmt(sweepCount)} barrido</span>
            <span>{goalSummary.missingMeta ? `${fmt(goalSummary.missingMeta)} sin meta` : "Metas listas"}</span>
            <span>{fmt(mechanismTotal)} canales</span>
          </div>
        </header>
        <div className="mon-acr-model-map" aria-label="Mapa operativo de acreditación">
          <AcreditacionActorDashboardTile label="Actores" value={fmt(cards.length)} hint="modelo base" tone="base" />
          <AcreditacionActorDashboardTile label="Universo" value={fmt(totals.universe)} hint="desde Sheets" tone="ready" />
          <AcreditacionActorDashboardTile label="Meta actor" value={metaTotal ? fmt(metaTotal) : "S/M"} hint={goalSummary.missingMeta ? `${fmt(goalSummary.missingMeta)} pendientes` : "configuradas"} tone={goalSummary.missingMeta ? "warning" : "target"} />
          <AcreditacionActorDashboardTile label="Canales" value={fmt(mechanismTotal)} hint="SurveyMonkey y barrido" tone="base" />
        </div>
        <div className="mon-acr-model-flow" aria-label="Relación meta mecanismo barrido regla válida">
          <span className={goalSummary.missingMeta ? "is-warning" : "is-ready"}>
            <Target size={14} />
            <strong>Meta</strong>
            <em>{goalSummary.configured ? "meta por actor listas" : "metas pendientes"}</em>
          </span>
          <span className={mechanismTotal ? "is-ready" : "is-warning"}>
            <Route size={14} />
            <strong>Mecanismo</strong>
            <em>{mechanismTotal ? `${fmt(mechanismTotal)} fuentes conectadas` : "sin mecanismo de avance"}</em>
          </span>
          <span className={sweepCount ? "is-ready" : "is-warning"}>
            <PhoneCall size={14} />
            <strong>Barrido</strong>
            <em>{sweepCount ? `${fmt(sweepCount)} hoja${sweepCount === 1 ? "" : "s"} de barrido` : "falta barrido telefónico"}</em>
          </span>
          <span className={validRuleCount ? "is-ready" : "is-warning"}>
            <SlidersHorizontal size={14} />
            <strong>Regla válida</strong>
            <em>{validRuleCount ? `${fmt(validRuleCount)} estados configurados` : "definir avance"}</em>
          </span>
        </div>
        <AcreditacionPlatformRejectionEditor state={state} variables={state?.variables ?? []} onStateChange={onStateChange} />
        <div className="mon-acr-model-actor-grid">
          {cards.length ? cards.map((card) => (
            <AcreditacionModelActorSummaryCard key={card.id} card={card} />
          )) : (
            <EmptyPanel title="Sin actores detectados" detail="Carga la base trabajada para armar el modelo por actor." />
          )}
        </div>
      </section>
    </div>
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
  const componentes = acreditacion?.componentes ?? [];
  const cards = acreditacion?.dashboard.cards ?? [];
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
    if (activeTab === "estructura") {
      return <AcreditacionCanonicalModelWorkbench reports={reports} state={state} onStateChange={onStateChange} />;
    }
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
      "WhatsApp": component.seguimiento.intentos_canal.whatsapp,
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
                WhatsApp: component.seguimiento.intentos_canal.whatsapp,
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

  if (activeTab === "estrategias") {
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
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "telefono", label: "Teléfono" },
  { value: "presencial", label: "Presencial / QR" },
  { value: "mixto", label: "Mixto" },
];

type AcreditacionChannelToneKey = "web" | "correo" | "telefono" | "presencial" | "whatsapp" | "sms" | "mixto" | "desconocido";

const ACREDITACION_CHANNEL_OPTIONS: Array<{
  value: string;
  label: string;
  key: AcreditacionChannelToneKey;
  modality: MonitoreoStrategyPhase["modality"];
}> = [
  { value: "Correo", label: "Correo", key: "correo", modality: "email" },
  { value: "Telefónico", label: "Telefónico", key: "telefono", modality: "telefono" },
  { value: "WhatsApp", label: "WhatsApp", key: "whatsapp", modality: "whatsapp" },
  { value: "SMS", label: "SMS", key: "sms", modality: "sms" },
  { value: "Ficha QR", label: "Ficha QR", key: "presencial", modality: "presencial" },
  { value: "Enlace abierto", label: "Web/link", key: "web", modality: "mixto" },
  { value: "Mixto", label: "Mixto/refuerzo", key: "mixto", modality: "mixto" },
  { value: "Desconocido", label: "Desconocido", key: "desconocido", modality: "mixto" },
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
  { value: "presencial_qr", label: "Presencial QR", modality: "presencial", channel: "Ficha QR", icon: QrCode },
  { value: "enlace_abierto", label: "Enlace abierto", modality: "mixto", channel: "Enlace abierto", icon: Link2 },
  { value: "sms", label: "SMS", modality: "sms", channel: "SMS", icon: ContactRound },
  { value: "mixto", label: "Mixto/refuerzo", modality: "mixto", channel: "Mixto", icon: Route },
  { value: "sin_clasificar", label: "Sin clasificar", modality: "mixto", channel: "Desconocido", icon: SlidersHorizontal },
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

function AcreditacionModelConfigWorkbench({
  state,
  activeTab,
  onStateChange,
}: {
  state?: MonitoreoState | null;
  activeTab: AcreditacionModelTab;
  onStateChange?: (state: MonitoreoState) => void;
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
    const channels = uniqueDisplayValues(actorSources.map(sourceChannelLabel));
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
        {header}
        <section className="mon-contract-block mon-contract-block--wide">
          <div className="mon-contract-block-head">
            <span>Base de barrido</span>
            <label className="mon-switch-line">
              <input
                type="checkbox"
                checked={Boolean(model.cases.enabled)}
                onChange={(event) => patchCases({ enabled: event.target.checked })}
              />
              <span>Usar barrido operativo</span>
            </label>
          </div>
          <div className="mon-form mon-form--two">
            <AcreditacionVarSelect label="Identificador" value={model.cases.case_id_var} vars={variableNames} onChange={(value) => patchCases({ case_id_var: value })} />
            <AcreditacionVarSelect label="Persona o caso" value={model.cases.person_label_var} vars={variableNames} onChange={(value) => patchCases({ person_label_var: value })} />
            <AcreditacionVarSelect label="Estado reportado" value={model.cases.status_var} vars={variableNames} onChange={(value) => patchCases({ status_var: value })} />
            <label>
              <span>Origen del barrido</span>
              <select
                value={model.cases.roster_source}
                onChange={(event) => patchCases({ roster_source: event.target.value as MonitoreoConfig["operational_model"]["cases"]["roster_source"] })}
              >
                {MODEL_ROSTER_SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
          <div className="mon-profile-grid">
            <AcreditacionVariableChipPicker label="Campos de contacto" vars={variableNames} selected={model.cases.contact_vars} onChange={(contact_vars) => patchCases({ contact_vars })} />
            <AcreditacionVariableChipPicker label="Campos sensibles" vars={variableNames} selected={model.cases.sensitive_vars} onChange={(sensitive_vars) => patchCases({ sensitive_vars })} />
          </div>
        </section>
      </div>
    );
  }

  if (activeTab === "enlaces") {
    return (
      <div className="mon-acr-model mon-acr-model-config">
        {header}
        <AcreditacionChannelSelectorMatrix
          sources={sources}
          config={draft}
          onConfigChange={setDraft}
          onStateChange={(nextState) => {
            setDraft(nextState.config);
            onStateChange?.(nextState);
          }}
        />
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
              Canal: sourceChannelLabel(source),
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
        {header}
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
        {header}
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
      {header}
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

function scopeForView(view: WorkbenchView): MonitoreoReportScope {
  if (view === "telefonico") return "phone_summary";
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

function compactColumns(rows: Array<Record<string, unknown>>, preferred: string[] = []) {
  const seen = new Set<string>();
  const keys = [...preferred, ...rows.flatMap((row) => Object.keys(row))]
    .filter((key) => key && !key.startsWith("_") && !seen.has(key) && (seen.add(key), true));
  return keys.slice(0, 8);
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

function phoneResponsibleName(row: Record<string, unknown>, index = 0) {
  return phoneRowValue(row, ["Responsable", "Encuestador", "Owner"], "") || `Responsable ${index + 1}`;
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

function mergeAcreditacionPhoneResponsibleRows(...rowGroups: Array<Array<Record<string, unknown>>>) {
  const byResponsible = new Map<string, Record<string, unknown>>();
  const applyNumber = (target: Record<string, unknown>, label: string, value: number | null) => {
    if (value != null) target[label] = value;
  };

  rowGroups.flat().forEach((row, index) => {
    const name = phoneResponsibleName(row, index);
    const key = normalizeSourceMatch(name);
    if (!key) return;
    const current = byResponsible.get(key) ?? { Responsable: name };
    current.Responsable = String(current.Responsable ?? name) || name;
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

function AcreditacionPhoneMetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number | null | undefined;
  hint: string;
  tone: "ready" | "success" | "warning" | "risk" | "neutral" | "swept";
}) {
  return (
    <span className={`mon-phone-metric is-${tone}`}>
      <em>{label}</em>
      <strong>{formatMetric(value)}</strong>
      <small>{hint}</small>
    </span>
  );
}

function AcreditacionPhoneStorage({ totals }: { totals: ReturnType<typeof phoneOperationTotals> }) {
  const total = Math.max(0, totals.total);
  const segments = [
    { key: "swept", label: "Barridos", value: totals.swept, pct: safePercentValue(totals.swept, total) ?? 0, hint: "de la base" },
    { key: "unswept", label: "Por barrer", value: totals.unswept, pct: safePercentValue(totals.unswept, total) ?? 0, hint: "de la base" },
  ].filter((item) => item.value > 0);
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
          {segments.length ? segments.map((segment) => (
            <i
              key={segment.key}
              role="listitem"
              className={`is-${segment.key}`}
              title={`${segment.label}: ${formatMetric(segment.value)} (${phonePercentLabel(segment.pct)})`}
              style={{ "--phone-storage-size": `${Math.max(0, Math.min(100, segment.pct))}%` } as CSSProperties}
            />
          )) : <i className="is-empty" style={{ "--phone-storage-size": "100%" } as CSSProperties} />}
        </div>
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
          {items.map((item) => {
            const pctValue = safePercentValue(item.value, base) ?? 0;
            return (
              <i
                key={item.key}
                role="listitem"
                className={`is-${item.tone}`}
                title={`${item.label}: ${formatMetric(item.value)} (${phonePercentLabel(pctValue)})`}
                style={{
                  "--phone-storage-size": `${Math.max(0, Math.min(100, pctValue))}%`,
                  "--phone-status-color": item.palette.color,
                  "--phone-status-color-hi": item.palette.highlight,
                } as CSSProperties}
              />
            );
          })}
        </div>
      </div>
      <div className="mon-phone-status-rank" aria-label="Estados telefónicos principales">
        {items.sort((a, b) => b.value - a.value).slice(0, 6).map((item) => {
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
        const metrics = phoneResponsibleMetrics(row);
        const total = metrics.assigned ?? metrics.denominator;
        const effectivePct = safePercentValue(metrics.effective, total);
        const nonEffectivePct = safePercentValue(metrics.nonEffective ?? 0, total);
        const pendingPct = safePercentValue(metrics.unswept ?? 0, total);
        const incidencePct = metrics.incidencePct ?? nonEffectivePct;
        return (
          <article key={`${name}-${index}`} className="mon-phone-responsible">
            <header>
              <strong>{name}</strong>
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
      }) : <EmptyPanel title="Sin responsables" detail="No hay filas de responsables para este corte telefónico." />}
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

function AcreditacionPhoneStatusByResponsiblePanel({ rows }: { rows: Array<Record<string, unknown>> }) {
  const grouped = new Map<string, Array<{ label: string; value: number; pct: number; palette: ReturnType<typeof phoneStatusPalette> }>>();
  rows.forEach((row, index) => {
    const name = phoneResponsibleName(row, index);
    if (phoneIsUnassignedResponsible(name)) return;
    const label = phoneRowValue(row, ["Estado", "Estatus", "Indicador"], "Sin estado");
    const value = phoneRowNumber(row, ["Casos", "Valor", "Total"], 0);
    if (value <= 0) return;
    const current = grouped.get(name) ?? [];
    current.push({
      label,
      value,
      pct: phoneRowRatioPct(row, ["% responsable", "% del responsable"]) ?? 0,
      palette: phoneStatusPalette(label),
    });
    grouped.set(name, current);
  });
  const groups = Array.from(grouped.entries()).map(([name, items]) => {
    const total = items.reduce((sum, item) => sum + item.value, 0);
    return {
      name,
      total,
      items: items.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "es")),
    };
  }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "es"));
  if (!groups.length) return null;
  return (
    <article className="mon-phone-ops-card mon-phone-ops-card--statuses">
      <header className="mon-phone-ops-head">
        <div>
          <span>Estados por responsable</span>
          <strong>Distribución telefónica del equipo</strong>
        </div>
        <em>{formatMetric(groups.length)} responsables</em>
      </header>
      <div className="mon-phone-status-owner-list">
        {groups.slice(0, 6).map((group) => (
          <section key={group.name}>
            <header>
              <strong>{group.name}</strong>
              <em>{formatMetric(group.total)} casos</em>
            </header>
            <div className="mon-phone-status-owner-stack" aria-label={`Estados telefónicos de ${group.name}`}>
              {group.items.map((item) => {
                const pctValue = item.pct || safePercentValue(item.value, group.total) || 0;
                return (
                  <i
                    key={`${group.name}-${item.label}`}
                    title={`${item.label}: ${formatMetric(item.value)} (${phonePercentLabel(pctValue)})`}
                    style={{
                      "--phone-status-owner-size": `${Math.max(3, Math.min(100, pctValue))}%`,
                      "--phone-status-owner-color": item.palette.color,
                    } as CSSProperties}
                  />
                );
              })}
            </div>
            <footer>
              {group.items.slice(0, 4).map((item) => (
                <span key={`${group.name}-${item.label}-legend`}>
                  <i style={{ "--phone-status-owner-color": item.palette.color } as CSSProperties} />
                  {item.label}: {formatMetric(item.value)}
                </span>
              ))}
            </footer>
          </section>
        ))}
      </div>
    </article>
  );
}

function AcreditacionPhoneOperationalInsights({
  responsibleRows,
  statusByResponsibleRows,
}: {
  responsibleRows: Array<Record<string, unknown>>;
  statusByResponsibleRows: Array<Record<string, unknown>>;
}) {
  const hasIncidence = responsibleRows.some((row) => {
    const metrics = phoneResponsibleMetrics(row);
    return metrics.swept != null || metrics.nonEffective != null || metrics.incidencePct != null;
  });
  if (!hasIncidence && !statusByResponsibleRows.length) return null;
  return (
    <section className="mon-phone-ops-insights" aria-label="Indicadores operativos del barrido telefónico">
      <AcreditacionPhoneIncidenceInsights rows={responsibleRows} />
      <AcreditacionPhoneStatusByResponsiblePanel rows={statusByResponsibleRows} />
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

  if (!rows.length) return <EmptyPanel title="Sin pendientes telefónicos" detail="Vuelve a sincronizar el barrido para calcular pendientes, insistencia y reintentos." />;
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

function phoneDailyPoints(rows: Array<Record<string, unknown>>) {
  return rows.map((row, index) => {
    const date = phoneRowValue(row, ["Fecha", "Dia", "Día"], `Día ${index + 1}`);
    const effective = phoneRowNumber(row, ["Efectivas", "Casos"], 0);
    const partial = phoneRowNumber(row, ["Parciales", "Parcial"], 0);
    const refusals = phoneRowNumber(row, ["Rechazos telefonicos", "Rechazos telefónicos", "Rechazos", "Rechazo"], 0);
    return { date, effective, partial, refusals, total: effective + partial + refusals };
  }).filter((point) => {
    const dateKey = normalizeSourceMatch(point.date);
    if (["fecha", "dia", "día", "date"].includes(dateKey)) return false;
    return point.total > 0 || point.effective > 0;
  });
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

function AcreditacionPhoneOperationsWorkbench({
  reports,
  activeTab,
}: {
  reports: MonitoreoAcreditacionReports;
  activeTab: AcreditacionPhoneTab;
}) {
  const summaryRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["resumen_telefonico"]);
  const statusRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["estatus_telefonico"]);
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
  const statusByResponsibleRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["estatus_responsable"]);
  const dailyBlock = phoneDailyBlockForPanel(reports);
  const dailyRows = dailyBlock?.rows ?? [];
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
  const generatedAt = reports.generated_at ? formatDate(reports.generated_at) : "";

  return (
    <section
      className="pulso-panel mon-fill-panel mon-phone-panel"
      style={{ minHeight: 0, overflowY: "auto", scrollbarGutter: "stable" } as CSSProperties}
      aria-label="Monitoreo telefónico canónico"
    >
      <header className="pulso-panel-header">
        <div className="pulso-panel-heading">
          <span className="pulso-panel-eyebrow">Operación telefónica</span>
          <h2 className="pulso-panel-title"><span className="mon-title-icon"><PhoneCall size={16} /> Barrido telefónico</span></h2>
          <p className="pulso-panel-hint">Responsables, asignación, insistencia y estados propios del barrido.</p>
        </div>
        <div className="mon-phone-meta">
          <span>{formatMetric(queryCases.length)} casos trazables</span>
          {generatedAt ? <span>{generatedAt}</span> : null}
        </div>
      </header>
      <div className="mon-phone-hero">
        <div className="mon-phone-hero-copy">
          <span>Lectura operativa</span>
          <strong>{formatMetric(totals.total)} personas en la base telefónica</strong>
          <p>{formatMetric(totals.swept)} barridos · {formatMetric(totals.responsables)} responsables · insistencia y estados telefónicos separados de la plataforma general.</p>
        </div>
        <div className="mon-phone-kpis">
          <AcreditacionPhoneMetricCard label="Efectivas tel." value={totals.effective} hint="operativas" tone="success" />
          <AcreditacionPhoneMetricCard label="Por barrer" value={totals.unswept} hint={`${phonePercentLabel(totals.unsweptPct)} del total`} tone={totals.unswept ? "warning" : "ready"} />
          <AcreditacionPhoneMetricCard label="Sin efectiva" value={totals.incidents} hint={`${phonePercentLabel(totals.incidentRatio)} del barrido`} tone={totals.incidents ? "warning" : "ready"} />
        </div>
      </div>
      <div className="mon-phone-tabbody">
        {activeTab === "dia" ? (
          <div className="mon-phone-layout">
            <AcreditacionAdvanceDailyMini points={phoneDailyPoints(dailyRows)} title="Ritmo diario telefónico" variant="source" />
            <DataTable rows={dailyRows} empty="No hay serie diaria telefónica preparada para este corte." />
          </div>
        ) : activeTab === "responsables" ? (
          <div className="mon-phone-layout">
            <AcreditacionPhoneResponsibleCards rows={visibleResponsibleRows} />
            <DataTable rows={visibleResponsibleRows} empty="No hay seguimiento por responsable para este corte." />
          </div>
        ) : activeTab === "alertas" ? (
          <div className="mon-phone-layout">
            <AcreditacionPhonePendingInsistence pendingRows={pendingRows} insistenceRows={insistenceRows} detailRows={detailRows} reattemptRows={reattemptRows} />
            <DataTable rows={[...pendingRows, ...insistenceRows, ...reattemptRows, ...detailRows]} empty="No hay alertas telefónicas para este corte." />
          </div>
        ) : (
          <div className="mon-phone-layout mon-phone-layout--summary">
            <section className="mon-phone-overview-grid" aria-label="Resumen de barrido telefónico">
              <AcreditacionPhoneStorage totals={totals} />
              <AcreditacionPhoneStatusStorage rows={visibleStatusRows} total={totals.total} />
            </section>
            <AcreditacionPhoneOperationalInsights responsibleRows={visibleResponsibleRows} statusByResponsibleRows={statusByResponsibleRows} />
            <div className="mon-profile-grid">
              <section className="mon-profile-panel mon-profile-panel--compact-table">
                <div className="mon-profile-panel-head">
                  <h3>Resumen telefónico</h3>
                  <span>{formatMetric(summaryRows.length)} filas</span>
                </div>
                <DataTable rows={summaryRows} empty="No hay bloque telefónico preparado." />
              </section>
              <section className="mon-profile-panel mon-profile-panel--compact-table">
                <div className="mon-profile-panel-head">
                  <h3>Estados telefónicos</h3>
                  <span>{formatMetric(visibleStatusRows.length)} estados</span>
                </div>
                <DataTable rows={visibleStatusRows} empty="No hay distribución de estados telefónicos." />
              </section>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function renderPhoneView(reports: MonitoreoAcreditacionReports, activeTab: AcreditacionPhoneTab = "resumen") {
  return <AcreditacionPhoneOperationsWorkbench reports={reports} activeTab={activeTab} />;
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
  return String(
    source.dimensions?.canal
    ?? source.dimensions?.channel
    ?? source.dimensions?.modalidad
    ?? source.dimensions?.medio
    ?? "",
  ).trim() || (source.kind === "google_sheets" ? "Base" : "Sin canal");
}

function sourceExternalId(source: MonitoreoSource) {
  if (source.kind === "surveymonkey") return source.survey_id || source.id;
  if (source.kind === "kobo") return source.asset_uid || source.id;
  return [
    source.sheet_binding?.spreadsheet_id,
    source.sheet_binding?.sheet_name,
  ].filter(Boolean).join(" / ") || source.id;
}

function shortenMiddle(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const edge = Math.max(6, Math.floor((maxLength - 3) / 2));
  return `${value.slice(0, edge)}...${value.slice(-edge)}`;
}

function sourceSpreadsheetUrl(source: MonitoreoSource) {
  const raw = String(source.sheet_binding?.spreadsheet_id ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const embeddedId = raw.match(/spreadsheets\/d\/([^/?#]+)/i)?.[1];
  const id = embeddedId || raw;
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/edit`;
}

function sourceSpreadsheetDisplay(source: MonitoreoSource) {
  const raw = String(source.sheet_binding?.spreadsheet_id ?? "").trim();
  const embeddedId = raw.match(/spreadsheets\/d\/([^/?#]+)/i)?.[1];
  const value = embeddedId || raw;
  return value ? shortenMiddle(value.replace(/^https?:\/\//i, ""), 42) : "Abrir spreadsheet";
}

function sourceSyncLabel(source: MonitoreoSource) {
  if (!source.enabled) return "Inactiva";
  return source.last_sync_at ? formatDate(source.last_sync_at) : "Sin sync";
}

function sourcesForPreset(sources: MonitoreoSource[], preset: AcreditacionSourcePreset) {
  if (preset.key === "respuestas_surveymonkey") {
    return sources.filter((source) => (
      source.kind === "surveymonkey"
      && (source.role === "respuestas" || !source.role || Boolean(source.survey_id))
    ));
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

function sourceRowsForTable(sources: MonitoreoSource[]) {
  return sources.map((source) => ({
    Fuente: source.label || source.id,
    Servicio: sourceProviderLabel(source.kind),
    Rol: source.role || "respuestas",
    Actor: sourceActorLabel(source),
    Canal: sourceChannelLabel(source),
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
  return {
    id: source.id,
    kind: source.kind,
    label: source.label,
    enabled: source.enabled,
    role: source.role,
    integration_mode: source.integration_mode,
    sheet_binding: source.sheet_binding,
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
    ?? ACREDITACION_CHANNEL_OPTIONS[ACREDITACION_CHANNEL_OPTIONS.length - 1];
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

  const mergedItems = useMemo(() => items.map((item) => {
    const saved = configuredMap.get(`${item.source_id}::${item.collector_id}`);
    const operationalUse = normalizeCollectorUse(saved?.operational_use ?? item.operational_use ?? item.configured_use ?? item.suggested_use);
    const channel = String(saved?.channel || item.channel || collectorChannelForUse(operationalUse)).trim() || "Desconocido";
    return {
      ...item,
      ...saved,
      channel,
      operational_use: operationalUse,
      configured_use: operationalUse,
      modality: normalizeModelModality(saved?.modality ?? item.modality ?? acreditacionChannelModality(channel)),
      roster_required: saved?.roster_required ?? item.roster_required ?? operationalUse === "telefono_asistido",
    };
  }), [configuredMap, items]);

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
                  <label>
                    <span>Canal</span>
                    <select
                      value={selected}
                      onChange={(event) => setSourceChannels((current) => ({ ...current, [source.id]: event.currentTarget.value }))}
                      disabled={saving != null}
                    >
                      {ACREDITACION_CHANNEL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
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
                    <label>
                      <span>Canal</span>
                      <select
                        value={channelOptionForValue(channel).value}
                        onChange={(event) => updateCollector(item, { channel: event.currentTarget.value })}
                      >
                        {ACREDITACION_CHANNEL_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
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
  if (text.includes("telefon")) return "Telefónico";
  if (text.includes("whatsapp")) return "WhatsApp";
  if (text.includes("sms")) return "SMS";
  if (text.includes("presencial") || text.includes("qr")) return "Ficha QR";
  if (text.includes("correo") || text.includes("email") || text.includes("mail")) return "Correo";
  if (text.includes("egresad")) return "Telefónico";
  return "Correo";
}

function inferAcreditacionSurveyActor(survey: SurveyMonkeyMultibaseListItem) {
  const text = normalizeSourceMatch(`${survey.title} ${survey.nickname ?? ""}`);
  const actor = ["Administrativos", "Docentes", "Egresados", "Estudiantes", "Empleadores"].find((option) => (
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
  busy,
  onSyncSheets,
  onSyncSurvey,
  onSyncAll,
}: {
  sources: MonitoreoSource[];
  reports: MonitoreoAcreditacionReports;
  busy: boolean;
  onSyncSheets: () => Promise<void>;
  onSyncSurvey: () => Promise<void>;
  onSyncAll: () => Promise<void>;
}) {
  const activeSources = sources.filter((source) => source.enabled);
  const sheetCount = activeSources.filter((source) => source.kind === "google_sheets").length;
  const surveyCount = activeSources.filter((source) => source.kind === "surveymonkey").length;
  const baseCount = sourcesForPreset(sources, ACREDITACION_SOURCE_PRESETS[0]).length;
  const sweepCount = sourcesForPreset(sources, ACREDITACION_SOURCE_PRESETS[1]).length;
  return (
    <section className="mon-acr-source-status-strip" aria-label="Estado de fuentes de acreditación">
      <header>
        <span>Fuentes</span>
        <strong>Paquete de acreditación</strong>
        <p>{fmt(sources.length)} configuradas · {fmt(activeSources.length)} activas · corte {formatDate(reports.generated_at)}</p>
      </header>
      <div className="mon-acr-source-status-metrics">
        <span className={sources.length ? "is-ready" : "is-warning"}>
          <PlugZap size={14} />
          <em>Fuentes</em>
          <strong>{fmt(activeSources.length)}/{fmt(sources.length)}</strong>
          <small>paquete activo</small>
        </span>
        <span className={baseCount ? "is-ready" : "is-warning"}>
          <Layers3 size={14} />
          <em>Base</em>
          <strong>{fmt(baseCount)}</strong>
          <small>fuentes base</small>
        </span>
        <span className={surveyCount ? "is-ready" : "is-warning"}>
          <QrCode size={14} />
          <em>Encuestas</em>
          <strong>{fmt(surveyCount)}</strong>
          <small>{fmt(sweepCount)} barrido</small>
        </span>
      </div>
      <AcreditacionSourceSyncActions
        sheetCount={sheetCount}
        surveyCount={surveyCount}
        totalCount={activeSources.length}
        busy={busy}
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
        <em>Sheets define universo y barrido; SurveyMonkey aporta respuestas exactas por actor y canal.</em>
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
  const [busy, setBusy] = useState<"search" | "refresh" | "bulk" | string | null>(null);
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);

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
  const bulkCandidates = results.filter((survey) => !configuredSurveyIds.has(survey.id)).slice(0, 12);

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
        if (next[survey.id] == null) next[survey.id] = inferAcreditacionSurveyActor(survey);
      });
      return next;
    });
    setChannels((prev) => {
      const next = { ...prev };
      surveys.forEach((survey) => {
        if (next[survey.id] == null) next[survey.id] = inferAcreditacionSurveyChannel(survey);
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
      setStatus({ tone: "success", message: `${fmt(result.surveys.length)} encuestas visibles para el filtro.` });
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
    const actor = actors[survey.id] || inferAcreditacionSurveyActor(survey);
    const channel = channels[survey.id] || inferAcreditacionSurveyChannel(survey);
    const label = labels[survey.id] || ["SurveyMonkey", actor, channel].filter(Boolean).join(" · ") || survey.title;
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
        carrera: actor === "Sin actor" ? "" : actor,
        canal: channel,
        servicio: "Respuestas SurveyMonkey",
        survey_title: survey.title,
      }),
    };
  };

  const addSurvey = async (survey: SurveyMonkeyMultibaseListItem) => {
    if (configuredSurveyIds.has(survey.id)) return;
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

  const addDetectedSurveys = async () => {
    if (!bulkCandidates.length) return;
    setBusy("bulk");
    setStatus({ tone: "info", message: `Agregando ${fmt(bulkCandidates.length)} encuestas detectadas...` });
    try {
      const result = await apiMonitoreoSources(bulkCandidates.map(payloadForSurvey));
      onStateChange?.(result.state);
      setStatus({ tone: "success", message: `${fmt(result.sources.length)} fuentes SurveyMonkey quedaron registradas.` });
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
        {results.length ? (
          <button type="button" onClick={() => { void addDetectedSurveys(); }} disabled={Boolean(busy) || !bulkCandidates.length}>
            {busy === "bulk" ? <Loader2 size={14} className="pulso-spin" /> : <Plus size={14} />}
            Agregar detectadas
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
                <label className="mon-source-name-field">
                  <span>Nombre de base</span>
                  <input value={labels[selectedSurvey.id] ?? ""} onChange={(event) => setLabels((prev) => ({ ...prev, [selectedSurvey.id]: event.currentTarget.value }))} placeholder="Nombre visible" />
                </label>
                <label className="mon-source-name-field">
                  <span>Actor / carrera</span>
                  <input value={actors[selectedSurvey.id] ?? ""} onChange={(event) => setActors((prev) => ({ ...prev, [selectedSurvey.id]: event.currentTarget.value }))} placeholder="Actor" />
                </label>
                <label className="mon-source-name-field">
                  <span>Canal</span>
                  <select value={channels[selectedSurvey.id] ?? ""} onChange={(event) => setChannels((prev) => ({ ...prev, [selectedSurvey.id]: event.currentTarget.value }))}>
                    {["Correo", "Telefónico", "WhatsApp", "SMS", "Ficha QR", "Presencial"].map((channel) => (
                      <option key={channel} value={channel}>{channel}</option>
                    ))}
                  </select>
                </label>
                <div className="mon-sm-result-actions">
                  <button type="button" onClick={() => { void inspectSurvey(selectedSurvey); }} disabled={Boolean(busy) || inspections[selectedSurvey.id]?.loading}>
                    {inspections[selectedSurvey.id]?.loading ? <Loader2 size={14} className="pulso-spin" /> : <Eye size={14} />}
                    Ver datos
                  </button>
                  <button type="button" onClick={() => { void addSurvey(selectedSurvey); }} disabled={Boolean(busy) || configuredSurveyIds.has(selectedSurvey.id)}>
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

function AcreditacionConfiguredSourcesList({
  sources,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const [savingId, setSavingId] = useState("");
  const [status, setStatus] = useState<AcreditacionActionStatus>(null);
  const activeCount = sources.filter((source) => source.enabled).length;

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
        <em>{fmt(activeCount)}/{fmt(sources.length || 0)} activas</em>
      </div>
      {status ? <div className={status.tone === "error" ? "mon-sm-error" : "mon-sm-meta"}>{status.message}</div> : null}
      <div className="mon-source-list">
        {sources.map((source) => {
          const dims = sourceDimensionEntries(source.dimensions);
          const saving = savingId === source.id;
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
              {source.enabled ? <em>{source.last_sync_at ? formatDate(source.last_sync_at) : "Sin sync"}</em> : <em>Inactiva</em>}
            </div>
          );
        })}
        {!sources.length ? <div className="mon-sm-empty">Aún no hay fuentes configuradas</div> : null}
      </div>
    </aside>
  );
}

async function waitForSourceSyncJob(jobId: string) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 350 : 1000));
    const snapshot = await apiJobStatus<MonitoreoSyncResult>(jobId);
    if (snapshot.status === "done") return snapshot;
    if (snapshot.status === "cancelled") throw new Error("La sincronización fue cancelada.");
    if (snapshot.status === "error") {
      throw new Error(jobErrorMessage(snapshot.error) || "La sincronización terminó con error.");
    }
  }
  throw new Error("La sincronización sigue en ejecución. Vuelve a actualizar la vista en unos segundos.");
}

function AcreditacionSourceSyncActions({
  sheetCount,
  surveyCount,
  totalCount,
  busy,
  onSyncSheets,
  onSyncSurvey,
  onSyncAll,
}: {
  sheetCount: number;
  surveyCount: number;
  totalCount: number;
  busy: boolean;
  onSyncSheets: () => Promise<void>;
  onSyncSurvey: () => Promise<void>;
  onSyncAll: () => Promise<void>;
}) {
  return (
    <div className="mon-source-sync-actions mon-acr-source-sync-actions" aria-label="Actualizar fuentes de acreditación">
      <button type="button" onClick={() => { void onSyncSheets(); }} disabled={busy || !sheetCount} title={sheetCount ? `${sheetCount} fuentes Sheets activas` : "Sin fuentes Sheets activas"}>
        {busy ? <Loader2 size={13} className="pulso-spin" /> : <Layers3 size={13} />}
        <span>Actualizar Sheets</span>
      </button>
      <button type="button" onClick={() => { void onSyncSurvey(); }} disabled={busy || !surveyCount} title={surveyCount ? `${surveyCount} encuestas activas` : "Sin encuestas SurveyMonkey activas"}>
        {busy ? <Loader2 size={13} className="pulso-spin" /> : <QrCode size={13} />}
        <span>Actualizar encuestas</span>
      </button>
      <button type="button" className="is-primary" onClick={() => { void onSyncAll(); }} disabled={busy || !totalCount} title={totalCount ? `${totalCount} fuentes activas` : "Sin fuentes activas"}>
        {busy ? <Loader2 size={13} className="pulso-spin" /> : <RefreshCw size={13} />}
        <span>Actualizar todo</span>
      </button>
    </div>
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
  const surveyCount = activeSources.filter((source) => source.kind === "surveymonkey").length;

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
          <section className="mon-acr-platform-panel mon-acr-platform-panel--survey" aria-label="Encuestas SurveyMonkey">
            <header className="mon-acr-platform-head">
              <div>
                <span><QrCode size={14} /> Paso 2 · SurveyMonkey</span>
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

function AcreditacionSourcesWorkbench({
  reports,
  state,
  activeTab = "survey",
  onStateChange,
}: {
  reports: MonitoreoAcreditacionReports;
  state?: MonitoreoState | null;
  activeTab?: AcreditacionSourceTab;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const client = reports.client_report;
  const reportSources = client?.sources?.length ? client.sources : rowsFromSheets(reports.sheets, ["fuente", "source", "canal"]);
  const configuredSources = state?.sources ?? [];
  const [activePresetKey, setActivePresetKey] = useState<AcreditacionSourcePresetKey>(
    activeTab === "sheets" ? "base_trabajada" : "respuestas_surveymonkey",
  );
  const [syncBusy, setSyncBusy] = useState<"sheets" | "survey" | "all" | null>(null);
  const [syncStatus, setSyncStatus] = useState<AcreditacionActionStatus>(null);
  useEffect(() => {
    if (activeTab === "survey") setActivePresetKey("respuestas_surveymonkey");
    if (activeTab === "sheets" && activePresetKey === "respuestas_surveymonkey") setActivePresetKey("base_trabajada");
  }, [activePresetKey, activeTab]);

  const configuredRows = sourceRowsForTable(configuredSources);
  const surveySources = configuredSources.filter((source) => source.kind !== "google_sheets");
  const sheetSources = configuredSources.filter((source) => source.kind === "google_sheets");
  const activeSources = configuredSources.filter((source) => source.enabled);
  const activeSurveySources = surveySources.filter((source) => source.enabled && source.kind === "surveymonkey");
  const activeSheetSources = sheetSources.filter((source) => source.enabled);
  const packageRows = sourcePackageRows(configuredSources);
  const activePreset = ACREDITACION_SOURCE_PRESETS.find((preset) => preset.key === activePresetKey) ?? ACREDITACION_SOURCE_PRESETS[0];
  const activePresetSources = sourcesForPreset(configuredSources, activePreset);
  const activePresetRows = sourceRowsForTable(activePresetSources);
  const activePresetActors = uniqueDisplayValues(activePresetSources.map(sourceActorLabel));
  const activePresetChannels = uniqueDisplayValues(activePresetSources.map(sourceChannelLabel));
  const sheetLinkRows = sheetSources.map((source) => ({
    Fuente: source.label || source.id,
    Spreadsheet: sourceSpreadsheetDisplay(source),
    Pestaña: source.sheet_binding?.sheet_name || "Sin pestaña",
    Rango: source.sheet_binding?.range || "A:Z",
    Enlace: sourceSpreadsheetUrl(source),
    Estado: source.enabled ? "Activa" : "Inactiva",
  }));
  const snapshotRows = [
    { Indicador: "Registros locales", Valor: fmt(state?.n_rows ?? 0), Evidencia: state?.has_snapshot ? "Snapshot disponible" : "Sin snapshot" },
    { Indicador: "Corte sincronizado", Valor: state?.synced_at ? state.synced_at : "Sin corte", Evidencia: reports.report_scope ?? "source" },
    { Indicador: "Fuentes configuradas", Valor: fmt(configuredSources.length), Evidencia: `${fmt(configuredSources.filter((source) => source.enabled).length)} activas` },
    { Indicador: "Paquete acreditación", Valor: `${fmt(packageRows.filter((row) => row.Estado === "Lista").length)}/${fmt(packageRows.length)}`, Evidencia: activePreset.label },
    { Indicador: "Último sync paquete", Valor: mostRecentSyncLabel(activeSources), Evidencia: activeSources.length ? "fuentes activas" : "sin fuentes activas" },
  ];
  const surveyRows = sourceRowsForTable(surveySources);
  const sheetRows = sourceRowsForTable(sheetSources);
  const sheetSummaryRows = reports.sheets.map((sheet) => ({
    Hoja: sheet.title || sheet.id,
    ID: sheet.id,
    Bloques: sheet.blocks.length,
    Filas: sheet.blocks.reduce((acc, block) => acc + block.rows.length, 0),
  }));
  const activeRows = sourceRowsForTable(activeSources);
  const sourceEditor = activePreset.provider === "google_sheets" ? (
    <AcreditacionSheetSourceEditor
      preset={activePreset}
      sources={activePresetSources}
      onStateChange={onStateChange}
    />
  ) : (
    <AcreditacionSurveySourcePicker
      sources={activeSurveySources}
      onStateChange={onStateChange}
    />
  );

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

  const syncExternal = async (kind: "survey" | "all", sourceIds: string[], label: string) => {
    if (!sourceIds.length) {
      setSyncStatus({ tone: "error", message: "No hay fuentes activas para actualizar." });
      return;
    }
    setSyncBusy(kind);
    setSyncStatus({ tone: "info", message: `${label}: creando job local...` });
    try {
      const start = await apiMonitoreoSync(undefined, sourceIds);
      setSyncStatus({ tone: "info", message: `${label}: job ${start.job_id} en ejecución.` });
      await waitForSourceSyncJob(start.job_id);
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
    }
  };

  const sourceConsole = (
    <AcreditacionSourcePackageConsole
      sources={configuredSources}
      activePresetKey={activePresetKey}
      status={syncStatus}
      busy={Boolean(syncBusy)}
      onSelectPreset={setActivePresetKey}
      onSyncSheets={syncSheets}
      onSyncSurvey={() => syncExternal("survey", activeSurveySources.map((source) => source.id), "Actualización SurveyMonkey")}
      onSyncAll={() => syncExternal("all", activeSources.map((source) => source.id), "Actualización completa")}
    />
  );

  if (activeTab === "survey") {
    return (
      <div className="mon-profile-stack">
        {sourceConsole}
        {sourceEditor}
        <section className="mon-profile-panel">
          <div className="mon-profile-panel-head">
            <h3>{activePreset.label}</h3>
            <span>{fmt(activePresetSources.length)} fuentes · {fmt(activePresetActors.length || activePresetChannels.length)} cortes</span>
          </div>
          <DataTable
            rows={activePresetRows}
            empty="No hay respuestas SurveyMonkey configuradas para el paquete de acreditación."
            preferredColumns={["Fuente", "Servicio", "Actor", "Canal", "Estado", "Ultimo sync", "ID"]}
          />
        </section>
        <div className="mon-profile-grid">
          <section className="mon-profile-panel">
            <div className="mon-profile-panel-head">
              <h3>Encuestas y recopiladores</h3>
              <span>{fmt(surveyRows.length)} fuentes</span>
            </div>
            <DataTable
              rows={surveyRows}
              empty="No hay fuentes SurveyMonkey/Kobo configuradas para este corte."
              preferredColumns={["Fuente", "Servicio", "Actor", "Canal", "Estado", "Ultimo sync", "ID"]}
            />
          </section>
          <section className="mon-profile-panel">
            <div className="mon-profile-panel-head">
              <h3>Fuentes del reporte</h3>
              <span>{fmt(reportSources.length)} filas</span>
            </div>
            <DataTable rows={reportSources as Array<Record<string, unknown>>} empty="El reporte no declaro fuentes para este corte." />
          </section>
        </div>
      </div>
    );
  }

  if (activeTab === "sheets") {
    return (
      <div className="mon-profile-stack">
        {sourceConsole}
        {sourceEditor}
        <section className="mon-profile-panel">
          <div className="mon-profile-panel-head">
            <h3>Cobertura del paquete</h3>
            <span>{fmt(packageRows.filter((row) => row.Estado === "Lista").length)} piezas listas</span>
          </div>
          <DataTable
            rows={packageRows}
            empty="No hay paquete de fuentes configurado."
            preferredColumns={["Pieza", "Servicio", "Rol", "Configuradas", "Activas", "Estado", "Ultimo sync"]}
          />
        </section>
        <div className="mon-profile-grid">
          <section className="mon-profile-panel">
            <div className="mon-profile-panel-head">
              <h3>Sheets configuradas</h3>
              <span>{fmt(sheetRows.length)} fuentes</span>
            </div>
            <DataTable
              rows={sheetRows}
              empty="No hay Sheets configuradas para universo, barrido o respuestas."
              preferredColumns={["Fuente", "Servicio", "Rol", "Actor", "Estado", "Ultimo sync", "ID"]}
            />
          </section>
          <section className="mon-profile-panel">
            <div className="mon-profile-panel-head">
              <h3>Vínculos Sheets</h3>
              <span>{fmt(sheetLinkRows.length)} enlaces</span>
            </div>
            <DataTable
              rows={sheetLinkRows.length ? sheetLinkRows : sheetSummaryRows}
              empty="No hay vínculos Sheets configurados para este scope."
              preferredColumns={["Fuente", "Spreadsheet", "Pestaña", "Rango", "Estado", "Enlace"]}
            />
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="mon-profile-stack">
      {sourceConsole}
      <AcreditacionConfiguredSourcesList sources={configuredSources} onStateChange={onStateChange} />
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Cobertura fija</h3>
          <span>{fmt(packageRows.length)} piezas</span>
        </div>
        <DataTable
          rows={packageRows}
          empty="No hay cobertura de fuentes para acreditación."
          preferredColumns={["Pieza", "Servicio", "Rol", "Configuradas", "Activas", "Estado", "Ultimo sync"]}
        />
      </section>
      <div className="mon-profile-grid">
        <section className="mon-profile-panel">
          <div className="mon-profile-panel-head">
            <h3>Fuentes del reporte</h3>
            <span>{fmt(reportSources.length)} filas</span>
          </div>
          <DataTable rows={reportSources as Array<Record<string, unknown>>} empty="El reporte no declaro fuentes para este corte." />
        </section>
        <section className="mon-profile-panel">
          <div className="mon-profile-panel-head">
            <h3>Fuentes configuradas</h3>
            <span>{fmt(configuredRows.length)} fuentes</span>
          </div>
          <DataTable
            rows={activeRows.length ? activeRows : configuredRows}
            empty="No hay fuentes configuradas en la sesión."
            preferredColumns={["Fuente", "Servicio", "Rol", "Actor", "Canal", "Estado", "Ultimo sync", "ID"]}
          />
        </section>
      </div>
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Corte local</h3>
          <span>{state?.has_snapshot ? "snapshot listo" : "sin snapshot"}</span>
        </div>
        <DataTable rows={snapshotRows} empty="Sin evidencia de corte local." />
      </section>
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
}: {
  rows: Array<Record<string, unknown>>;
  empty: string;
  preferredColumns?: string[];
}) {
  if (!rows.length) return <p className="mon-profile-muted">{empty}</p>;
  const columns = compactColumns(rows, preferredColumns);
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

type AcreditacionCaseFilters = {
  search: string;
  actor: string;
  channel: string;
  source: string;
  collector: string;
  response: string;
  crossing: string;
};

const EMPTY_CASE_FILTERS: AcreditacionCaseFilters = {
  search: "",
  actor: "",
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
    date: "",
    channel: filters.channel,
    collector: filters.collector,
    source: filters.source,
    response: filters.response,
    state: "",
    crossing: filters.crossing,
  }).length > 0;
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
  return internalQueryCollectorDisplayLabel(item) || item.collector_id || "";
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
  const selectedCandidate = assignmentOptions.find((candidate) => assistedCandidateId(candidate) === selectedCandidateId) ?? null;
  const selectedEvidenceLevel = selectedCandidate ? assistedCandidateEvidenceLevel(selectedCandidate) : "";
  const contradiction = warnings.some((warning) => normalizeCaseSearch(warning).includes("codigo declarado no coincide"));
  const noteRequired = Boolean(contradiction || (selectedCandidate && selectedEvidenceLevel !== "exact"));
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
  const includeDisabled = !onDecision || !selectedCandidate || !selectedCandidatePayloadId || !platformComplete || busy || !assignmentConfirmed || (noteRequired && !note.trim());
  const keepDisabled = !onDecision || busy || !item.response_id;
  const includeHint = !platformComplete
    ? "Solo una respuesta completa puede incluirse con salvedad."
    : !selectedCandidate
      ? "Selecciona una persona pendiente del universo para incluir con salvedad."
      : !selectedCandidatePayloadId
        ? "La coincidencia no tiene un identificador guardable."
      : !assignmentConfirmed
        ? "Confirma esta asignación antes de guardar."
        : noteRequired && !note.trim()
          ? "Agrega una nota para documentar la evidencia o contradicción."
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
    <nav className="mon-acr-query-tabs" role="tablist" aria-label="Pestañas de consultas internas">
      {ACREDITACION_CONSULTA_TABS.map((tab) => {
        const Icon = tab.icon;
        const selected = active === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
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
    </nav>
  );
}

function AcreditacionCrucesView({ cases }: { cases: MonitoreoInternalQueryCase[] }) {
  const crossingRows = groupedCaseRows(cases, internalCaseCrossingValue, internalCaseCrossingLabel);
  const actorRows = groupedCaseRows(cases, (item) => item.actor || "Sin actor", (value) => value);
  const sourceRows = groupedCaseRows(cases, (item) => item.source_label || item.channel || "Sin fuente", (value) => value);
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
                          <strong>{phoneAction || item.base_status || item.channel || "Sin acción telefónica"}</strong>
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

function acreditacionRowsForConsultaTab(cases: MonitoreoInternalQueryCase[], tab: AcreditacionConsultaTab) {
  if (tab === "efectivas") {
    return cases.filter((item) => caseCountsInAdvance(item) === true || item.advancement === "effective");
  }
  if (tab === "faltantes") {
    return cases.filter((item) => explicitBoolean(item.pending_exit) === true || item.advancement === "pending" || item.issue_type === "sin_respuesta");
  }
  if (tab === "duplicados") {
    return cases.filter((item) => Number(item.duplicate_count ?? item.duplicate_group_size ?? 0) > 1 || item.issue_type === "duplicado_caso");
  }
  if (tab === "diferencias") {
    return cases
      .filter((item) => (
        assistedReviewVisible(item) ||
        caseNeedsReconciliationReview(item) ||
        item.advancement !== "effective" ||
        !["", "efectiva_real"].includes(String(item.issue_type || ""))
      ))
      .sort((a, b) => Number(assistedReviewVisible(b)) - Number(assistedReviewVisible(a)) ||
        Number(caseNeedsReconciliationReview(b)) - Number(caseNeedsReconciliationReview(a)) ||
        Number(b.review_priority ?? 0) - Number(a.review_priority ?? 0));
  }
  return cases;
}

function acreditacionIssuesForConsultaTab(issues: MonitoreoInternalQueryIssue[], tab: AcreditacionConsultaTab) {
  if (tab === "duplicados") return issues.filter((issue) => issue.issue_type === "duplicado_caso");
  if (tab === "diferencias") return issues.filter((issue) => issue.issue_type !== "duplicado_caso");
  return issues;
}

function acreditacionQueryAnswerCopy(
  tab: AcreditacionConsultaTab,
  summary: ReturnType<typeof summarizeInternalCases>,
  allSummary: ReturnType<typeof summarizeInternalCases>,
  activeFilters: boolean,
) {
  const scope = activeFilters ? "con los filtros activos" : "en este corte";
  if (tab === "efectivas") {
    return {
      icon: CheckCircle2,
      tone: "effective",
      heading: "Efectivas reales y canales",
      title: `${fmt(summary.effective)} efectivas reales ${scope}.`,
      detail: `${fmt(summary.pending)} sin respuesta, ${fmt(summary.partial)} parciales y ${fmt(summary.refusal)} rechazos quedan separados del avance.`,
    };
  }
  if (tab === "faltantes") {
    return {
      icon: Route,
      tone: "pending",
      heading: "Salida de pendientes",
      title: `${formatCaseLabel(summary.pending)} sigue${summary.pending === 1 ? "" : "n"} sin respuesta ${scope}.`,
      detail: `${formatCaseLabel(summary.pendingExit)} sale${summary.pendingExit === 1 ? "" : "n"} de pendientes por respuesta válida reconciliada.`,
    };
  }
  if (tab === "duplicados") {
    return {
      icon: Link2,
      tone: "warning",
      heading: "Duplicados y conteo único",
      title: `${formatCaseLabel(summary.duplicates)} duplicado${summary.duplicates === 1 ? "" : "s"} visible${summary.duplicates === 1 ? "" : "s"}.`,
      detail: "La mesa cuenta una sola respuesta por llave: completa primero; la fecha más reciente desempata.",
    };
  }
  if (tab === "diferencias") {
    return {
      icon: ShieldAlert,
      tone: "partial",
      heading: "Diferencias y explicación",
      title: `${formatCaseLabel(summary.partial + summary.refusal + summary.review)} explica${summary.partial + summary.refusal + summary.review === 1 ? "" : "n"} descuadres ${scope}.`,
      detail: "Sin respuesta, parciales, rechazos, sin llave y fuera de base se separan antes de comparar con avance o reporte.",
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

function AcreditacionConsultaStatusStrip({
  reports,
  model,
  officialCases,
}: {
  reports: MonitoreoAcreditacionReports;
  model: ReturnType<typeof normalizeInternalQueries>;
  officialCases: MonitoreoInternalQueryCase[];
}) {
  const summary = summarizeInternalCases(officialCases);
  const auditSummary = summarizeInternalCases(model.cases);
  const sources = reports.sheets?.length ?? 0;
  const actors = new Set([...officialCases, ...model.cases].map((item) => item.actor).filter(Boolean)).size;
  const missingKey = model.cases.filter((item) => internalCaseCrossingValue(item) === "sin_llave").length;
  const issueCount = model.issues.reduce((sum, issue) => sum + Number(issue.count || 1), 0);
  return (
    <section className="mon-query-status-strip" aria-label="Estado del corte disponible">
      <header>
        <span>Estado del corte</span>
        <strong>Corte listo para explorar casos</strong>
        <p>{`Corte ${formatDate(reports.generated_at)}. ${fmt(sources)} hojas · ${formatCaseLabel(officialCases.length)} en universo · ${formatCaseLabel(model.cases.length)} auditables.`}</p>
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
        <span className={sources ? "is-base" : "is-warning"}>
          <PlugZap size={14} />
          <em>Fuentes</em>
          <strong>{fmt(sources)}</strong>
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

function AcreditacionCaseExplorerToolbar({
  summary,
  allSummary,
  filters,
  actorOptions,
  channelOptions,
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
  activeActor,
  onReview,
}: {
  cases: MonitoreoInternalQueryCase[];
  activeActor: string;
  onReview: (actor: string) => void;
}) {
  if (!cases.length) return null;
  const actorCounts = cases.reduce<Map<string, number>>((acc, item) => {
    const actor = item.actor || "Sin actor";
    acc.set(actor, (acc.get(actor) ?? 0) + 1);
    return acc;
  }, new Map());
  const actorEntries = Array.from(actorCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));
  const targetActor = activeActor && actorCounts.has(activeActor) ? activeActor : actorEntries[0]?.[0] ?? "";
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
      <button type="button" onClick={() => targetActor && onReview(targetActor)} disabled={!targetActor}>
        Revisar {targetActor || "casos"}
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
                  <small>{item.channel || "Sin canal"}</small>
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
}: {
  item: MonitoreoInternalQueryCase | null;
  busyId?: string;
  onDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
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
          hint={item.channel || item.source_label || "Sin canal"}
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
        <div><dt>Fecha respuesta</dt><dd>{item.date || "Sin fecha"}</dd></div>
        <div><dt>Fila fuente</dt><dd>{item.response_row ? fmt(item.response_row) : "S/D"}</dd></div>
        <div><dt>Duplicados</dt><dd>{Number(item.duplicate_count ?? item.duplicate_group_size ?? 0) > 1 ? fmt(item.duplicate_count ?? item.duplicate_group_size) : "No"}</dd></div>
      </dl>
    </aside>
  );
}

function AcreditacionCasesWorkspace({
  cases,
  selectedCase,
  onCaseSelect,
  title = "Casos trazables",
  busyId = "",
  onDecision,
}: {
  cases: MonitoreoInternalQueryCase[];
  selectedCase: MonitoreoInternalQueryCase | null;
  onCaseSelect: (item: MonitoreoInternalQueryCase) => void;
  title?: string;
  busyId?: string;
  onDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
}) {
  return (
    <div className="mon-query-cases-workspace">
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
      <AcreditacionCaseDetail item={selectedCase} busyId={busyId} onDecision={onDecision} />
    </div>
  );
}

function AcreditacionConsultaBody({
  activeTab,
  modeCases,
  selectedCase,
  modeIssues,
  model,
  onCaseSelect,
  onFilter,
  busyId,
  onDecision,
}: {
  activeTab: AcreditacionConsultaTab;
  modeCases: MonitoreoInternalQueryCase[];
  selectedCase: MonitoreoInternalQueryCase | null;
  modeIssues: MonitoreoInternalQueryIssue[];
  model: ReturnType<typeof normalizeInternalQueries>;
  onCaseSelect: (item: MonitoreoInternalQueryCase) => void;
  onFilter: (patch: Partial<AcreditacionCaseFilters>) => void;
  busyId?: string;
  onDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
}) {
  if (activeTab === "duplicados" || activeTab === "diferencias") {
    const title = activeTab === "duplicados" ? "Duplicados y conteo único" : "Diferencias y explicación";
    const Icon = activeTab === "duplicados" ? Link2 : ShieldAlert;
    const hint = activeTab === "duplicados"
      ? "Casos donde una persona o llave puede tener más de una respuesta."
      : "Parciales, rechazos, sin llave, fuera de base y diferencias entre fuentes.";
    return (
      <div className="mon-query-grid mon-query-grid--issues">
        <section className="mon-query-issues-panel" aria-label={title}>
          <header className="mon-query-section-head">
            <div>
              <span>Auditoría</span>
              <strong><Icon size={16} /> {title}</strong>
              <small>{hint}</small>
            </div>
            <em>{fmt(modeIssues.length)} alertas</em>
          </header>
          <AcreditacionIssueList issues={modeIssues} onFilter={onFilter} />
        </section>
        <AcreditacionCasesWorkspace
          cases={modeCases}
          selectedCase={selectedCase}
          onCaseSelect={onCaseSelect}
          title="Casos vinculados"
          busyId={busyId}
          onDecision={onDecision}
        />
      </div>
    );
  }
  if (activeTab === "efectivas") {
    const summary = summarizeInternalCases(modeCases);
    return (
      <div className="mon-query-grid mon-query-grid--effectives">
        <section className="mon-query-kpi-strip" aria-label="Indicadores de efectivas">
          <span className="is-effective"><em>Efectivas reales</em><strong>{fmt(summary.effective)}</strong><small>completas válidas</small></span>
          <span className="is-partial"><em>Parciales</em><strong>{fmt(summary.partial)}</strong><small>no inflan avance</small></span>
          <span className="is-refusal"><em>Rechazos</em><strong>{fmt(summary.refusal)}</strong><small>consentimiento u otro filtro</small></span>
          <span className="is-warning"><em>Sin respuesta</em><strong>{fmt(summary.pending)}</strong><small>en base</small></span>
        </section>
        <AcreditacionCasesWorkspace cases={modeCases} selectedCase={selectedCase} onCaseSelect={onCaseSelect} title="Casos efectivos" />
      </div>
    );
  }
  if (activeTab === "faltantes") {
    return (
      <div className="mon-query-grid mon-query-grid--pending">
        <section className="mon-query-flow-panel" aria-label="Flujo de salida de pendientes">
          <header className="mon-query-section-head">
            <div>
              <span>Faltantes y barrido</span>
              <strong><Route size={16} /> Base operativa → respuesta → avance</strong>
            </div>
            <em>{formatCaseLabel(modeCases.length)}</em>
          </header>
          <DataTable
            rows={caseDimensionRows(model.cases, "actor", "Actor")}
            empty="No hay flujo por actor para este corte."
          />
        </section>
        <AcreditacionCasesWorkspace cases={modeCases} selectedCase={selectedCase} onCaseSelect={onCaseSelect} title="Casos que salen de pendientes" />
      </div>
    );
  }
  return (
    <AcreditacionCasesWorkspace
      cases={modeCases}
      selectedCase={selectedCase}
      onCaseSelect={onCaseSelect}
      title={activeTab === "casos" ? "Casos dentro de la distribución" : "Casos trazables"}
    />
  );
}

function AcreditacionConsultasPanel({
  reports,
  activeTab: controlledActiveTab,
  onActiveTabChange,
  caseReconciliationBusyId = "",
  caseReconciliationStatus = null,
  onCaseReconciliationDecision,
}: {
  reports: MonitoreoAcreditacionReports;
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
  const [fallbackActiveTab, setFallbackActiveTab] = useState<AcreditacionConsultaTab>("casos");
  const setActiveTab = onActiveTabChange ?? setFallbackActiveTab;
  const activeTab = controlledActiveTab ?? fallbackActiveTab;
  const auditMode = activeTab === "duplicados" || activeTab === "diferencias";
  const explorerCases = auditMode ? model.cases : officialCases;
  const [filters, setFilters] = useState<AcreditacionCaseFilters>({ ...EMPTY_CASE_FILTERS });
  const [selectedId, setSelectedId] = useState("");
  const filteredCases = useMemo(() => explorerCases.filter((item) => caseMatchesFilters(item, filters)), [explorerCases, filters]);
  const actorFacetCases = useMemo(() => explorerCases.filter((item) => caseMatchesFilters(item, { ...filters, actor: "" })), [explorerCases, filters]);
  const channelFacetCases = useMemo(() => explorerCases.filter((item) => caseMatchesFilters(item, { ...filters, channel: "" })), [explorerCases, filters]);
  const sourceFacetCases = useMemo(() => explorerCases.filter((item) => caseMatchesFilters(item, { ...filters, source: "" })), [explorerCases, filters]);
  const collectorFacetCases = useMemo(() => explorerCases.filter((item) => caseMatchesFilters(item, { ...filters, collector: "" })), [explorerCases, filters]);
  const responseFacetCases = useMemo(() => explorerCases.filter((item) => caseMatchesFilters(item, { ...filters, response: "" })), [explorerCases, filters]);
  const crossingFacetCases = useMemo(() => explorerCases.filter((item) => caseMatchesFilters(item, { ...filters, crossing: "" })), [explorerCases, filters]);
  const actorOptions = useMemo(
    () => countCaseOptions(actorFacetCases, (item) => item.actor),
    [actorFacetCases],
  );
  const channelOptions = useMemo(
    () => countCaseOptions(channelFacetCases, caseChannelValue),
    [channelFacetCases],
  );
  const sourceOptions = useMemo(
    () => countCaseOptions(sourceFacetCases, caseSourceValue),
    [sourceFacetCases],
  );
  const collectorOptions = useMemo(
    () => countCaseOptions(collectorFacetCases, caseCollectorValue),
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
  const modeIssues = useMemo(() => acreditacionIssuesForConsultaTab(model.issues, activeTab), [activeTab, model.issues]);
  const summary = useMemo(() => summarizeInternalCases(modeCases), [modeCases]);
  const allSummary = useMemo(() => summarizeInternalCases(explorerCases), [explorerCases]);
  const selectedCase = modeCases.find((item) => caseIdentity(item) === selectedId) ?? modeCases[0] ?? null;
  const queryTabCounts = useMemo<Record<AcreditacionConsultaTab, number>>(() => ({
    casos: filteredCases.length,
    efectivas: acreditacionRowsForConsultaTab(filteredCases, "efectivas").length,
    faltantes: acreditacionRowsForConsultaTab(filteredCases, "faltantes").length,
    duplicados: acreditacionRowsForConsultaTab(filteredCases, "duplicados").length,
    diferencias: acreditacionRowsForConsultaTab(filteredCases, "diferencias").length + model.issues.length,
  }), [filteredCases, model.issues.length]);
  const activeFilters = Object.values(filters).some(Boolean);
  const pendingRiskCases = useMemo(() => filteredCases.filter(assistedReviewVisible), [filteredCases]);
  const queryAnswer = acreditacionQueryAnswerCopy(activeTab, summary, allSummary, activeFilters);
  const QueryAnswerIcon = queryAnswer.icon;
  const patchFilters = (patch: Partial<AcreditacionCaseFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setSelectedId("");
  };
  const clearFilters = () => {
    setFilters({ ...EMPTY_CASE_FILTERS });
    setSelectedId("");
  };
  return (
    <div className="mon-stage mon-stage--consultas mon-acr-cases mon-acr-cases--canonical">
      <AcreditacionConsultaStatusStrip reports={reports} model={model} officialCases={officialCases} />
      {controlledActiveTab ? null : <AcreditacionConsultaTabs active={activeTab} counts={queryTabCounts} onChange={setActiveTab} />}

      <section className="mon-case-explorer" aria-label="Explorador de casos del monitoreo">
        <section className={`mon-query-answer is-${queryAnswer.tone}`} aria-label="Lectura activa del explorador">
          <span><QueryAnswerIcon size={16} /> {queryAnswer.heading}</span>
          <strong>{queryAnswer.title}</strong>
          <p>{queryAnswer.detail}</p>
        </section>
        <AcreditacionCaseExplorerToolbar
          summary={summary}
          allSummary={allSummary}
          filters={filters}
          actorOptions={actorOptions}
          channelOptions={channelOptions}
          sourceOptions={sourceOptions}
          collectorOptions={collectorOptions}
          responseOptions={responseOptions}
          crossingOptions={crossingChipOptions}
          activeFilters={activeFilters}
          onFilter={patchFilters}
          onClear={clearFilters}
        />
        <div className="mon-acr-explorer-meta-row">
          <AcreditacionPendingRiskStrip
            cases={pendingRiskCases}
            activeActor={filters.actor}
            onReview={(actor) => patchFilters({ actor, search: "", crossing: "" })}
          />
          {caseReconciliationStatus ? (
            <span className={`mon-acr-model-action-status is-${caseReconciliationStatus.tone}`}>
              {caseReconciliationStatus.message}
            </span>
          ) : null}
        </div>
        <div className="mon-case-explorer-body">
          <AcreditacionConsultaBody
            activeTab={activeTab}
            modeCases={modeCases}
            selectedCase={selectedCase}
            modeIssues={modeIssues}
            model={model}
            onCaseSelect={(item) => setSelectedId(caseIdentity(item))}
            onFilter={patchFilters}
            busyId={caseReconciliationBusyId}
            onDecision={onCaseReconciliationDecision}
          />
        </div>
      </section>
    </div>
  );
}

type AcreditacionAdvanceCard = {
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

type AcreditacionAdvanceDailySeries = {
  id: string;
  label: string;
  actor?: string;
  channel?: string;
  sourceId?: string;
  collectorId?: string;
  collector?: string;
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

function advanceCardsFromRows(rows: Array<Record<string, unknown>>, goals: MonitoreoGoal[] = []): AcreditacionAdvanceCard[] {
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
    const progress = meta != null ? safePercentValue(effective, meta) : null;
    const coverage = safePercentValue(effective, universe);
    const statusTone: AcreditacionAdvanceCard["statusTone"] = meta == null
      ? "muted"
      : (progress ?? 0) >= 100
        ? "complete"
        : (progress ?? 0) >= 70
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

function dailyPointsFromRows(rows: Array<Record<string, unknown>>): AcreditacionAdvanceDailyPoint[] {
  return rows.map((row, index) => {
    const date = rowText(row, ["Fecha", "Dia", "Día", "Date"], `Dia ${index + 1}`);
    const effective = rowNumber(row, ["Efectivas", "Validas", "Válidas", "Completed"], 0);
    const partial = rowNumber(row, ["Parciales", "Partial"], 0);
    const refusals = rowNumber(row, ["Rechazo", "Rechazos", "Refusals"], 0);
    const total = rowNumber(row, ["Total respuestas", "Total", "Respuestas"], effective + partial + refusals);
    return { date, effective, partial, refusals, total };
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
  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) return direct;
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const rawYear = match[3] ? Number(match[3]) : new Date().getFullYear();
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

function shortAdvanceDateLabel(value: string) {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" });
  }
  const dayFirst = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dayFirst) return `${dayFirst[1].padStart(2, "0")}/${dayFirst[2].padStart(2, "0")}`;
  const yearFirst = value.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (yearFirst) return `${yearFirst[3].padStart(2, "0")}/${yearFirst[2].padStart(2, "0")}`;
  return value.length > 6 ? value.slice(5) : value;
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
}: {
  cards: AcreditacionAdvanceCard[];
}) {
  const totals = advanceTotals(cards);
  const universe = Math.max(0, totals.universe);
  const segments = [
    { key: "completed", label: "Efectivas", value: totals.effective, pct: safePercentValue(totals.effective, universe) ?? 0, hint: "del universo" },
    { key: "partial", label: "Parciales", value: totals.partial, pct: safePercentValue(totals.partial, universe) ?? 0, hint: "no cuentan como efectivas" },
    { key: "refusals", label: "Rechazos", value: totals.refusals, pct: safePercentValue(totals.refusals, universe) ?? 0, hint: "requieren trazabilidad" },
    { key: "pending", label: "Sin respuesta", value: totals.pending, pct: safePercentValue(totals.pending, universe) ?? 0, hint: "por cerrar" },
  ];
  const actorUniverse = [...cards].filter((card) => card.universe > 0).sort((a, b) => b.universe - a.universe).slice(0, 4);
  return (
    <section className="mon-advance-storage" aria-label="Universo y avance de acreditación">
      <header>
        <div>
          <span>Universo de avance</span>
          <strong>{fmt(universe)} casos</strong>
        </div>
        <div className="mon-advance-actor-breakdown" aria-label="Casos por actor">
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
        <em>{pctFrom(totals.effective, universe)} efectivas</em>
      </header>
      <div className="mon-advance-storage-chart">
        <div className="mon-advance-storage-bar" role="list" aria-label={`${fmt(totals.effective)} efectivas de ${fmt(universe)} casos base`}>
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

function AcreditacionAdvanceDailyMini({
  points,
  title = "Ritmo general del estudio",
  variant = "general",
}: {
  points: AcreditacionAdvanceDailyPoint[];
  title?: string;
  variant?: "general" | "actor" | "source";
}) {
  const totals = dailyPointTotals(points);
  const visiblePoints = points.filter((point) => point.total || point.effective || point.partial || point.refusals).slice(-18);
  const rows = [
    { key: "effective", label: "Efectivas", total: totals.effective, values: visiblePoints.map((point) => point.effective) },
    { key: "partial", label: "Parciales", total: totals.partial, values: visiblePoints.map((point) => point.partial) },
    { key: "refusals", label: "Rechazos", total: totals.refusals, values: visiblePoints.map((point) => point.refusals) },
    { key: "total", label: "Total", total: totals.total, values: visiblePoints.map((point) => point.total) },
  ];
  return (
    <article className={`mon-advance-daily-mini is-${variant}`}>
      <header>
        <div>
          <span>Avance diario</span>
          <strong>{title}</strong>
          <em>{fmt(points.length)} días con corte · {fmt(totals.total)} respuestas</em>
        </div>
        <div className="mon-advance-daily-mini-kpis">
          <span className="is-effective"><em>Efectivas</em><strong>{fmt(totals.effective)}</strong></span>
          <span className="is-partial"><em>Parciales</em><strong>{fmt(totals.partial)}</strong></span>
          <span className="is-refusals"><em>Rechazos</em><strong>{fmt(totals.refusals)}</strong></span>
        </div>
      </header>
      <div className="mon-advance-daily-legend">
        <span className="is-completed">Efectivas</span>
        <span className="is-partial">Parciales</span>
        <span className="is-refusals">Rechazos</span>
        <span className="is-cumulative">Total diario</span>
      </div>
      {visiblePoints.length ? (
        <div className="mon-advance-daily-table-wrap">
          <table className="mon-advance-daily-table" aria-label="Detalle diario de avance">
            <thead>
              <tr>
                <th>Estado</th>
                {visiblePoints.map((point, index) => <th key={`head-${index}-${point.date}`} title={point.date}>{shortAdvanceDateLabel(point.date)}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className={`is-${row.key}`}>
                  <th><span>{row.label}</span><em>{fmt(row.total)}</em></th>
                  {row.values.map((value, index) => <td key={`${row.key}-${index}-${visiblePoints[index]?.date ?? "sin-fecha"}`}>{fmt(value)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyPanel title="Sin ritmo diario" detail="El corte todavía no trae una serie diaria para graficar avance." />
      )}
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
  return (
    <div className={`mon-actor-mechanism is-${item.modality} is-${kind}`}>
      <span className="mon-actor-mechanism-icon"><Icon size={13} /></span>
      <div>
        <strong>{item.label}</strong>
        <span>{item.provider} · {item.role}{item.channel ? ` · ${item.channel}` : ""}</span>
      </div>
      <em>
        {item.observed == null ? "S/D" : fmt(item.observed)}
        <small>{item.role === "Universo" ? "universo" : item.role === "Barrido" ? "base" : "respuestas"}</small>
      </em>
      <i style={{ "--mechanism-pct": `${Math.max(0, Math.min(100, pctValue ?? 0))}%` } as CSSProperties} />
    </div>
  );
}

function AcreditacionActorProgressCardView({ card }: { card: AcreditacionActorCard }) {
  const totalProgress = card.progress ?? card.coverage ?? safePercentValue(card.effective, card.universe);
  const dial = Math.max(0, Math.min(100, totalProgress ?? 0)) * 3.6;
  const completedPct = safePercentValue(card.effective, card.universe) ?? 0;
  const partialPct = safePercentValue(card.partial, card.universe) ?? 0;
  const refusalsPct = safePercentValue(card.refusals, card.universe) ?? 0;
  const unansweredPct = Math.max(0, 100 - completedPct - partialPct - refusalsPct);
  const targetPct = safePercentValue(card.meta, card.universe);
  const clampedTargetPct = targetPct == null ? 0 : Math.max(0, Math.min(100, targetPct));
  const targetReached = card.missing != null ? card.missing <= 0 : card.meta != null && card.effective >= card.meta;
  const baseMechanisms = card.mechanisms.filter((item) => item.role === "Universo" || item.role === "Barrido");
  const responseMechanisms = card.mechanisms.filter((item) => item.role === "Respuestas");
  return (
    <article
      className={`mon-actor-card is-${card.statusTone}`}
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
          <span>Actor</span>
          <strong>{card.actor}</strong>
        </div>
        <em>{card.status}</em>
      </header>
      <div className="mon-actor-card-body">
        <div className="mon-actor-radar" aria-label={`Avance de ${card.actor}`}>
          <div className={`mon-actor-dial is-${card.statusTone}`}>
            <strong>{formatPercentLabel(totalProgress)}</strong>
            <span>Total</span>
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
            <strong>{fmt(card.pending)} pendientes</strong>
          </p>
        </div>
        <div className="mon-actor-flow" aria-label="Meta de actor">
          <AcreditacionActorFlowNode label="Universo" value={fmt(card.universe)} tone="base" />
          <AcreditacionActorFlowNode label="Meta" value={card.meta == null ? "S/M" : fmt(card.meta)} tone="target" />
          <AcreditacionActorFlowNode label="Efectivas" value={fmt(card.effective)} tone="ready" />
          <AcreditacionActorFlowNode label="Brecha" value={card.missing == null ? "S/M" : fmt(card.missing)} tone={card.missing != null && card.missing > 0 ? "warning" : "ready"} />
        </div>
      </div>
      {card.dailyPoints.length ? (
        <AcreditacionAdvanceDailyMini points={card.dailyPoints} title={card.actor} variant="actor" />
      ) : null}
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
            <div className="mon-actor-mechanism-empty">Sin base registrada para este actor.</div>
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
    </article>
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
  const cards = actorCardsForDashboard({
    actorRows,
    sourceRows,
    dailyRows,
    actorDailySeries,
    goals: state?.config.goals ?? [],
    sources: state?.sources ?? [],
    progressRows: state?.dashboard?.progress ?? [],
  });
  const totals = advanceTotals(cards);
  const goals = actorGoalSummary(cards);
  const completionPct = safePercentValue(totals.effective, totals.universe);
  const generatedAt = reports.generated_at ? formatDate(reports.generated_at) : "";
  const mechanismTotal = cards.reduce((sum, card) => sum + card.mechanisms.length, 0);
  return (
    <section
      className="pulso-panel mon-fill-panel mon-strata-dashboard mon-actor-dashboard"
      style={{ minHeight: 0, overflowY: "auto", scrollbarGutter: "stable" } as CSSProperties}
      aria-label="Avance canónico por actor"
    >
      <header className="pulso-panel-header">
        <div className="pulso-panel-heading">
          <span className="pulso-panel-eyebrow">Avance</span>
          <h2 className="pulso-panel-title"><span className="mon-title-icon"><Layers3 size={16} /> Avance por actor</span></h2>
          <p className="pulso-panel-hint">Universo, meta, brecha y fuentes por actor institucional.</p>
        </div>
        <div className="pulso-panel-actions mon-actor-dashboard-actions">
          <span>{fmt(cards.length)} actores</span>
          <span>{fmt(mechanismTotal)} mecanismos</span>
          {generatedAt ? <span>{generatedAt}</span> : null}
        </div>
      </header>
      <div className="mon-advance-hero mon-advance-hero--actors">
        <div className="mon-advance-hero-copy">
          <span>Corte por actor</span>
          <strong>{fmt(totals.effective)} efectivas de {fmt(totals.universe)}</strong>
          <p>Lee cada actor como una unidad operativa: universo/base, meta, avance real y mecanismos que alimentan el corte.</p>
        </div>
        <div className="mon-advance-hero-kpis">
          <AcreditacionAdvanceMetric label="Actores" value={fmt(cards.length)} hint={`${fmt(mechanismTotal)} mecanismos`} tone="base" />
          <AcreditacionAdvanceMetric label="Metas actor" value={actorGoalValue(goals)} hint={actorGoalHint(goals)} tone={actorGoalTone(goals)} />
          <AcreditacionAdvanceMetric label="Efectivas" value={fmt(totals.effective)} hint={`${formatPercentLabel(completionPct)} del universo`} tone="ready" />
          <AcreditacionAdvanceMetric label="Pendientes" value={fmt(totals.pending)} hint={`${fmt(totals.partial)} parciales · ${fmt(totals.refusals)} rechazos`} tone={totals.pending ? "warning" : "base"} />
        </div>
      </div>
      <div className="mon-actor-grid">
        {cards.length ? cards.map((card) => (
          <AcreditacionActorProgressCardView key={card.id} card={card} />
        )) : (
          <EmptyPanel title="Sin cortes operativos" detail="El reporte de avance aún no trae actores para mostrar metas, fuentes y brechas." />
        )}
      </div>
    </section>
  );
}

function acreditacionChannelKey(value: string): AcreditacionChannelToneKey {
  const normalized = normalizeSourceMatch(value);
  if (!normalized || normalized === "sin canal" || normalized === "sin dato" || normalized === "desconocido") return "desconocido";
  if (normalized.includes("telefon")) return "telefono";
  if (normalized.includes("whatsapp")) return "whatsapp";
  if (normalized.includes("sms")) return "sms";
  if (normalized.includes("presencial") || normalized.includes("qr")) return "presencial";
  if (normalized.includes("web") || normalized.includes("link") || normalized.includes("enlace")) return "web";
  if (normalized.includes("correo") || normalized.includes("email") || normalized.includes("mail")) return "correo";
  if (normalized.includes("mixto") || normalized.includes("refuerzo")) return "mixto";
  return "mixto";
}

function acreditacionChannelLabel(value: string) {
  const key = acreditacionChannelKey(value);
  if (key === "web") return "Web/link";
  if (key === "correo") return "Correo";
  if (key === "telefono") return "Telefónico";
  if (key === "presencial") return "Ficha QR";
  if (key === "whatsapp") return "WhatsApp";
  if (key === "sms") return "SMS";
  if (key === "desconocido") return "Desconocido";
  const label = String(value ?? "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "Mixto";
}

function AcreditacionChannelBadge({ channel }: { channel: string }) {
  const key = acreditacionChannelKey(channel);
  const Icon = key === "telefono" ? PhoneCall : key === "presencial" ? QrCode : key === "whatsapp" || key === "sms" ? ContactRound : key === "correo" ? Mail : key === "web" ? Link2 : Route;
  return (
    <span className={`mon-channel-badge is-${key}`}>
      <Icon size={12} />
      {acreditacionChannelLabel(channel)}
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
}: {
  actor: string;
  row: AcreditacionAdvanceSurveyRow;
  daily: AcreditacionAdvanceDailySeries | null;
  collectorSeries: AcreditacionAdvanceDailySeries[];
}) {
  const collectors = useMemo(
    () => [...collectorSeries].sort((a, b) => b.total - a.total || (a.collector ?? a.label).localeCompare(b.collector ?? b.label, "es")),
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
              <option key={item.id} value={item.id}>
                {(item.collector || item.label || "Sin recopilador")} · {fmt(item.total)}
              </option>
            ))}
          </select>
          <em>{fmt(collectors.length)} recopilador{collectors.length === 1 ? "" : "es"} · {fmt(collectorTotal)} respuestas</em>
        </label>
      ) : null}
      <AcreditacionAdvanceDailyMini
        title={isCollector ? `${active.collector || "Sin recopilador"} · ${row.title}` : row.title}
        points={active.points}
        variant="source"
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
}: {
  row: AcreditacionAdvanceSurveyRow;
  max: number;
  daily: AcreditacionAdvanceDailySeries | null;
  collectorSeries: AcreditacionAdvanceDailySeries[];
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
      />
    </article>
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
    return fromReport.length
      ? fromReport
      : fromRows.length
        ? fromRows
        : fromCases;
  }, [reports]);
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

function AcreditacionAdvanceFocus({ cards }: { cards: AcreditacionAdvanceCard[] }) {
  const ranked = [...cards].sort((a, b) => (b.missing ?? -1) - (a.missing ?? -1) || b.universe - a.universe).slice(0, 5);
  const totals = advanceTotals(cards);
  return (
    <section className="mon-advance-focus" aria-label="Actores y brechas">
      <header>
        <span>Actor</span>
        <strong>{totals.brechas ? `${fmt(totals.brechas)} con brecha` : `${fmt(totals.metas)} metas cubiertas`}</strong>
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
          <EmptyPanel title="Sin actores" detail="No hay cortes por actor para priorizar brechas." />
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
      <div className="mon-gs-report-tabs" role="tablist" aria-label="Pestañas de reporte de acreditación">
        {sheets.map((sheet) => (
          <button
            key={sheet.id}
            type="button"
            className={sheet.id === activeSheet.id ? "is-active" : ""}
            onClick={() => setActiveId(sheet.id)}
          >
            {sheetTitleIcon(sheet.id)}
            <span>{reportPanelSheetTitle(sheet)}</span>
          </button>
        ))}
      </div>
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
}: {
  reports: MonitoreoAcreditacionReports;
  state?: MonitoreoState | null;
  actorRows: Array<Record<string, unknown>>;
  dailyRows: Array<Record<string, unknown>>;
}) {
  const cards = useMemo(() => advanceCardsFromRows(actorRows, state?.config.goals ?? []), [actorRows, state?.config.goals]);
  const dailyPoints = useMemo(() => dailyPointsFromRows(dailyRows), [dailyRows]);
  const totals = advanceTotals(cards);
  const completionPct = safePercentValue(totals.effective, totals.universe);
  const generatedAt = reports.generated_at ? formatDate(reports.generated_at) : "";
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
          <p>Distingue universo, metas por actor y respuestas de plataforma para leer el avance sin mezclar fuentes.</p>
        </div>
        <div className="mon-advance-hero-kpis">
          <AcreditacionAdvanceMetric label="Metas actor" value={totals.metas ? `${fmt(totals.metas - totals.brechas)}/${fmt(totals.metas)}` : "S/M"} hint={totals.brechas ? `${fmt(totals.brechas)} con brecha` : "sin brecha"} tone={totals.brechas ? "target" : "ready"} />
          <AcreditacionAdvanceMetric label="Efectivas" value={fmt(totals.effective)} hint={`${completionPct == null ? "S/D" : pct(completionPct)} del universo`} tone="ready" />
          <AcreditacionAdvanceMetric label="Pendientes" value={fmt(totals.pending)} hint={`${fmt(totals.partial)} parciales · ${fmt(totals.refusals)} rechazos`} tone={totals.pending ? "warning" : "base"} />
        </div>
      </div>
      <div className="mon-advance-tabbody">
        <div className="mon-advance-summary-grid">
          <AcreditacionAdvanceStorage cards={cards} />
          <AcreditacionAdvanceDailyMini points={dailyPoints} />
          <AcreditacionAdvanceFocus cards={cards} />
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
    onCaseReconciliationDecision?: (payload: AcreditacionCaseReconciliationPayload) => void;
    state?: MonitoreoState | null;
    onStateChange?: (state: MonitoreoState) => void;
    onPublished?: () => void;
    routeLabel?: string;
    savingAcreditacion?: boolean;
  } = {},
) {
  if (view === "avance" && options.activeAdvanceTab === "salidas") {
    const state = options.state;
    return (
      <MonitoreoOutputsWorkbench
        family="acreditacion"
        routeLabel={options.routeLabel ?? "Acreditación"}
        defaultTitle={state?.config?.acreditacion?.estudio?.titulo || "reporte-monitoreo"}
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
        activeTab={options.activeConsultaTab ?? "casos"}
        onActiveTabChange={() => undefined}
        caseReconciliationBusyId={options.caseReconciliationBusyId}
        caseReconciliationStatus={options.caseReconciliationStatus}
        onCaseReconciliationDecision={options.onCaseReconciliationDecision}
      />
    );
  }
  if (view === "telefonico") {
    return renderPhoneView(reports, options.activePhoneTab ?? "resumen");
  }
  const actorRows = client?.actors?.length ? client.actors : rowsFromSheets(reports.sheets, ["actor", "avance", "brecha"]);
  const dailyRows = client?.daily_general ?? [];
  const sourceRows = client?.sources?.length ? client.sources : rowsFromSheets(reports.sheets, ["fuente", "source", "canal"]);
  const controlRows = client?.controls?.length ? client.controls : rowsFromSheets(reports.sheets, ["control", "segmento", "meta"]);
  if (view === "avance" && options.activeAdvanceTab === "actores") {
    return (
      <AcreditacionAdvanceActorsWorkbench
        reports={reports}
        state={options.state}
        actorRows={actorRows as Array<Record<string, unknown>>}
        sourceRows={sourceRows as Array<Record<string, unknown>>}
        dailyRows={dailyRows as Array<Record<string, unknown>>}
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

function activeSourceCount(state: MonitoreoState | null) {
  return (state?.sources ?? []).filter((source) => source.enabled).length;
}

function localTabsForAcreditacionView(view: WorkbenchView) {
  if (view === "fuentes") return ACREDITACION_SOURCE_TABS;
  if (view === "modelo") return ACREDITACION_MODEL_TABS;
  if (view === "consultas") return ACREDITACION_CONSULTA_TABS;
  if (view === "telefonico") return ACREDITACION_PHONE_TABS;
  if (view === "avance") return ACREDITACION_ADVANCE_TABS;
  return [];
}

function AcreditacionWorkbenchRail({
  route,
  activeView,
  activeLocalTab,
  onLocalTabChange,
  syncedAt,
  reports,
}: {
  route: typeof ACREDITACION_ROUTE;
  activeView: WorkbenchView;
  activeLocalTab: string;
  onLocalTabChange: (view: WorkbenchView, tab: AcreditacionLocalTabKey) => void;
  syncedAt: string;
  reports: MonitoreoAcreditacionReports | null;
}) {
  const views = workbenchViewsForRoute(route);
  const activeSection = views.find((item) => item.key === activeView) ?? views[0] ?? {
    label: route.shortLabel,
    desc: "Vista operativa",
    icon: route.icon,
  };
  const localTabs = localTabsForAcreditacionView(activeView);

  return (
    <MonitoreoWorkbenchRail
      activeLocalTab={activeLocalTab}
      activeSection={activeSection}
      activeView={activeView}
      ariaLabel="Flujos de monitoreo de acreditación"
      className="is-acreditacion"
      emptyDetail={reports?.report_scope ?? activeSection.desc ?? "Vista operativa"}
      localTabs={localTabs}
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

function AcreditacionSemanticStatusLegend() {
  return (
    <div className="mon-semantic-legend" aria-label="Leyenda semántica">
      <span className="is-effective">Efectivas</span>
      <span className="is-partial">Parciales</span>
      <span className="is-refusal">Rechazos</span>
      <span className="is-pending">Sin respuesta</span>
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
  const sourceTotal = state?.sources?.length ?? 0;
  const activeSources = activeSourceCount(state);
  const sourceGap = Math.max(0, sourceTotal - activeSources);
  const summary = stateFromReports(reports, num(state?.dashboard?.kpis?.total ?? state?.n_rows, 0), num(state?.dashboard?.kpis?.valid, 0));
  const queries = normalizeInternalQueries(reports?.internal_queries);
  const cases = queries.case_rollup?.length ? queries.case_rollup : queries.cases;
  const caseSummary = summarizeInternalCases(cases);
  const issueCount = queries.issues.reduce((acc, issue) => acc + (num(issue.count, 1) || 1), 0);
  const phoneRows = reports ? rowsForSheetBlock(reports, "monitoreo_telefonico", ["resumen_telefonico", "estatus_telefonico"]) : [];
  const actorRows = reports?.client_report?.actors ?? [];
  const configuredGoals = state?.config?.goals?.filter((goal) => Number(goal.meta) > 0).length ?? 0;
  const bloqueos = state?.acreditacion?.dashboard?.bloqueos ?? 0;
  const itemsByView = {
    fuentes: [
      { label: "Fuentes", value: `${activeSources}/${sourceTotal || 0}`, hint: sourceGap ? `${sourceGap} pendientes` : "paquete listo", tone: sourceGap ? "warning" : "ready", icon: ClipboardCheck },
      { label: "Base", value: state?.n_rows ? fmt(state.n_rows) : "S/D", hint: "registros leídos", tone: state?.n_rows ? "base" : "warning", icon: Table2 },
      { label: "Sync", value: reports ? "Listo" : "Pendiente", hint: reports?.generated_at ? formatDate(reports.generated_at) : "requiere corte", tone: reports ? "ready" : "warning", icon: RefreshCw },
    ],
    modelo: [
      { label: "Actores", value: fmt(actorRows.length), hint: "cortes del reporte", tone: actorRows.length ? "base" : "warning", icon: ClipboardCheck },
      { label: "Metas", value: fmt(configuredGoals), hint: "configuradas", tone: configuredGoals ? "ready" : "warning", icon: Target },
      { label: "Bloqueos", value: fmt(bloqueos), hint: bloqueos ? "requieren cierre" : "sin bloqueos", tone: bloqueos ? "warning" : "ready", icon: ShieldAlert },
    ],
    avance: [
      { label: "Efectivas", value: summary.effective ? fmt(summary.effective) : "S/D", hint: summary.universe ? `${pctFrom(summary.effective, summary.universe)} del universo` : "plataforma completa", tone: summary.effective ? "effective" : "warning", icon: CheckCircle2 },
      { label: "Parciales", value: fmt(summary.partial), hint: "no cuentan como efectivas", tone: summary.partial ? "partial" : "ready", icon: AlertCircle },
      { label: "Universo", value: summary.universe ? fmt(summary.universe) : fmt(state?.n_rows ?? 0), hint: summary.referenceLabel, tone: summary.universe || state?.n_rows ? "base" : "warning", icon: Table2 },
    ],
    consultas: [
      { label: "Efectivas", value: cases.length ? fmt(caseSummary.effective) : "S/D", hint: "reales trazadas", tone: caseSummary.effective ? "effective" : "warning", icon: CheckCircle2 },
      { label: "Salen pendientes", value: fmt(caseSummary.pendingExit), hint: "faltantes recuperados", tone: caseSummary.pendingExit ? "ready" : "base", icon: Link2 },
      { label: "Alertas", value: fmt(issueCount), hint: "casos de revisión", tone: issueCount ? "warning" : "ready", icon: ShieldAlert },
    ],
    telefonico: [
      { label: "Bloques tel.", value: fmt(phoneRows.length), hint: "resumen y estados", tone: phoneRows.length ? "base" : "warning", icon: PhoneCall },
      { label: "Casos", value: cases.length ? fmt(cases.length) : "S/D", hint: "trazabilidad persona", tone: cases.length ? "ready" : "warning", icon: Search },
      { label: "Sin respuesta", value: fmt(summary.unanswered), hint: "pendiente operativo", tone: summary.unanswered ? "pending" : "ready", icon: AlertCircle },
    ],
    ocurrencias: [],
    calidad: [],
  };
  const items = itemsByView[activeView] ?? itemsByView.fuentes;

  return (
    <section className={`mon-clarity-strip is-${activeView}`} aria-label="Lectura operativa de acreditación">
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
      <AcreditacionSemanticStatusLegend />
    </section>
  );
}

export function AcreditacionProfilePage({ mode = "acreditacion" }: { mode?: AcreditacionProfileMode }) {
  const isPhone = mode === "telefonico";
  const route = isPhone ? TELEFONICO_ROUTE : ACREDITACION_ROUTE;
  const profileLabel = isPhone ? "Monitoreo telefónico" : "Acreditación";
  const [state, setState] = useState<MonitoreoState | null>(null);
  const [activeView, setActiveView] = useState<WorkbenchView>(isPhone ? "telefonico" : "fuentes");
  const [activeSourceTab, setActiveSourceTab] = useState<AcreditacionSourceTab>("survey");
  const [activeModelTab, setActiveModelTab] = useState<AcreditacionModelTab>("estructura");
  const [activeConsultaTab, setActiveConsultaTab] = useState<AcreditacionConsultaTab>("casos");
  const [activePhoneTab, setActivePhoneTab] = useState<AcreditacionPhoneTab>("resumen");
  const [activeAdvanceTab, setActiveAdvanceTab] = useState<AcreditacionAdvanceTab>("resumen");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingAcreditacion, setSavingAcreditacion] = useState(false);
  const [actionStatus, setActionStatus] = useState<AcreditacionActionStatus>(null);
  const [caseReconciliationBusyId, setCaseReconciliationBusyId] = useState("");
  const [caseReconciliationStatus, setCaseReconciliationStatus] = useState<AcreditacionActionStatus>(null);
  const activeViewRef = useRef<WorkbenchView>(activeView);
  const loadSeqRef = useRef(0);
  const initialLoadStartedRef = useRef(false);
  const warmedScopesRef = useRef(new Set<string>());

  const activeDef = useMemo(
    () => WORKBENCH_VIEWS.find((item) => item.key === activeView) ?? WORKBENCH_VIEWS[0],
    [activeView],
  );
  const reports = reportsFromState(state);
  const kpis = state?.dashboard?.kpis ?? null;
  const acreditacionState = useMemo(
    () => stateFromReports(reports, num(kpis?.total ?? state?.n_rows, 0), num(kpis?.valid, 0), activeView === "modelo" || activeView === "avance"),
    [activeView, kpis?.total, kpis?.valid, reports, state?.n_rows],
  );

  const prefetchBackgroundScopes = useCallback((view: WorkbenchView) => {
    const activeScope = scopeForView(view);
    const scopes = [activeScope, ...ACREDITACION_BACKGROUND_SCOPES]
      .filter((scope, index, all) => scope !== "full" && all.indexOf(scope) === index);
    scopes.forEach((scope, index) => {
      if (warmedScopesRef.current.has(scope)) return;
      warmedScopesRef.current.add(scope);
      window.setTimeout(() => {
        void apiMonitoreoState({
          includeReports: true,
          reportScope: scope,
          warmupCache: true,
        }).catch(() => {
          warmedScopesRef.current.delete(scope);
        });
      }, 240 + index * 180);
    });
  }, []);

  const loadView = useCallback(async (view: WorkbenchView, force = false) => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    try {
      const next = await apiMonitoreoState({
        includeReports: true,
        reportScope: scopeForView(view),
        warmupCache: !force,
        force,
      });
      if (seq !== loadSeqRef.current || view !== activeViewRef.current) return;
      setState(next);
      setError("");
      prefetchBackgroundScopes(view);
    } catch (e) {
      if (seq !== loadSeqRef.current || view !== activeViewRef.current) return;
      setError((e as Error).message);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [prefetchBackgroundScopes]);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    if (initialLoadStartedRef.current) return;
    initialLoadStartedRef.current = true;
    void loadView(activeView);
  }, [activeView, loadView]);
  const refreshCurrentView = useCallback(() => {
    void loadView(activeView, true);
  }, [activeView, loadView]);
  const saveSeguimiento = useCallback(async (payload: MonitoreoAcreditacionSeguimientoPayload) => {
    setSavingAcreditacion(true);
    setError("");
    setActionStatus(null);
    try {
      const result = await apiMonitoreoAcreditacionSeguimiento(payload);
      setState(result.state);
      setActionStatus({ tone: "success", message: "Avance registrado en el seguimiento." });
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      setActionStatus({ tone: "error", message });
    } finally {
      setSavingAcreditacion(false);
    }
  }, []);
  const closeAcreditacion = useCallback(async (planRefuerzo: string, aprobarBrechas: boolean) => {
    setSavingAcreditacion(true);
    setError("");
    setActionStatus(null);
    try {
      const result = await apiMonitoreoCierre({ plan_refuerzo: planRefuerzo, aprobar_brechas: aprobarBrechas });
      setState(result.state);
      setActionStatus({ tone: "success", message: "Cierre de acreditación actualizado." });
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      setActionStatus({ tone: "error", message });
    } finally {
      setSavingAcreditacion(false);
    }
  }, []);
  const saveCaseReconciliationDecision = useCallback(async (payload: AcreditacionCaseReconciliationPayload) => {
    const responseId = payload.response_id.trim();
    if (!responseId) return;
    setCaseReconciliationBusyId(responseId);
    setCaseReconciliationStatus(null);
    setError("");
    try {
      const result = await apiMonitoreoAcreditacionCaseReconciliation({ ...payload, response_id: responseId });
      setState(result.state);
      const next = await apiMonitoreoState({
        includeReports: true,
        reportScope: "queries_summary",
        warmupCache: false,
        force: true,
      });
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
  }, []);
  const sourceTotal = state?.sources?.length ?? 0;
  const activeSources = activeSourceCount(state);
  const chromeBusy = savingAcreditacion || Boolean(caseReconciliationBusyId);
  const refreshTitle = loading ? "Actualizando vista..." : `Actualizar ${activeDef.shortLabel ?? activeDef.label}`;
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
          syncing={loading}
          syncDisabled={loading}
          syncLabel="Todo"
          syncTitle="Actualizar vista y corte local"
          onSyncAll={() => loadView(activeView, true)}
          advanceSyncDisabled={loading}
          advanceSyncLabel="Avance"
          advanceSyncTitle={refreshTitle}
          onSyncAdvance={() => loadView(activeView, true)}
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
          className="is-acreditacion"
          rail={(
            <AcreditacionWorkbenchRail
              route={route}
              activeView={activeView}
              activeLocalTab={activeLocalTab}
              onLocalTabChange={changeLocalTab}
              syncedAt={state?.synced_at ?? ""}
              reports={reports}
            />
          )}
          head={(
            <AcreditacionWorkbenchHead
              route={route}
              activeView={activeView}
              state={state}
              reports={reports}
            />
          )}
          clarity={(
            <AcreditacionClarityStrip
              activeView={activeView}
              state={state}
              reports={reports}
            />
          )}
          status={(
            activeView === "fuentes" || activeView === "modelo" ? null : (
              <div className="mon-acr-workbench-status">
                <EstadoProgresoCompact summary={acreditacionState} label={isPhone ? "Estado telefónico" : "Estado + progreso"} />
              </div>
            )
          )}
        >
          {loading ? (
            <EmptyPanel title="Preparando vista" detail="Leyendo cache local del proyecto..." />
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
            onCaseReconciliationDecision: saveCaseReconciliationDecision,
            state,
            onStateChange: setState,
            onPublished: refreshCurrentView,
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
