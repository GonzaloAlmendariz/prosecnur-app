import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  ContactRound,
  Download,
  Eye,
  FileCheck2,
  Layers3,
  Link2,
  ListChecks,
  Loader2,
  Mail,
  PhoneCall,
  PlugZap,
  Plus,
  QrCode,
  RefreshCw,
  Route,
  Save,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Target,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  apiMonitoreoAcreditacionSeguimiento,
  apiMonitoreoConfig,
  apiMonitoreoCierre,
  apiMonitoreoCollectorsConfig,
  apiMonitoreoExport,
  apiMonitoreoImportFromCalcMuestra,
  apiMonitoreoKoboAssets,
  apiMonitoreoSource,
  apiMonitoreoState,
  apiMonitoreoSupervisionSample,
  apiMonitoreoSurveyMonkeyCollectors,
  apiMonitoreoSync,
  apiSurveyMonkeyMultibaseInspectSurvey,
  apiSurveyMonkeyMultibaseListSurveys,
  apiConnectionsList,
  ConnectionTokenState,
  downloadUrl,
  MonitoreoConfig,
  MonitoreoAcreditacion,
  MonitoreoAcreditacionComponente,
  MonitoreoAcreditacionIntentos,
  MonitoreoAcreditacionSeguimientoPayload,
  MonitoreoCollectorUse,
  MonitoreoDashboard,
  MonitoreoGoal,
  MonitoreoKoboAssetItem,
  MonitoreoLinkCollector,
  MonitoreoOperationalCases,
  MonitoreoOperationalEvent,
  MonitoreoOperationalModel,
  MonitoreoOperationalStrategy,
  MonitoreoOperationalStratum,
  MonitoreoOperationalTarget,
  MonitoreoRow,
  MonitoreoSource,
  MonitoreoSourcePayload,
  MonitoreoSourceKind,
  MonitoreoStateRule,
  MonitoreoState,
  MonitoreoStrategyPhase,
  MonitoreoSurveyMonkeyCollector,
  MonitoreoSyncResult,
  MonitoreoVariable,
  SurveyMonkeyMultibaseInspection,
  SurveyMonkeyMultibaseListItem,
} from "../../api/client";
import { Alert } from "../../components/Alert";
import { JobProgress } from "../../components/JobProgress";
import { PageFrame } from "../../components/PageFrame";
import { Panel } from "../../components/Panel";
import { EmptyState, LoadingBlock } from "../../components/States";
import { useAnaliticaAutosave } from "../analitica/useAnaliticaAutosave";
import { EnumeradoresPane } from "../analitica/panes/EnumeradoresPane";
import "./monitoreo.css";

const EMPTY_ACREDITACION: MonitoreoAcreditacion = {
  enabled: false,
  modo_trabajo: "seguimiento_campo",
  estudio: {
    id: "",
    titulo: "Estudio de acreditacion",
    cliente: "",
    macro_familia: "acreditacion",
    creado_desde_calc_muestra: false,
  },
  componentes: [],
  plan_refuerzo: "",
  aprobacion_metodologica: false,
  cierre_at: "",
  dashboard: {
    cards: [],
    alertas: [],
    cierre_habilitado: false,
    bloqueos: 0,
  },
};

const EMPTY_OPERATIONAL_MODEL: MonitoreoOperationalModel = {
  schema_version: "monitoreo_operativo_v1",
  strata: [],
  targets: [],
  cases: {
    enabled: false,
    case_id_var: "",
    person_label_var: "",
    status_var: "",
    contact_vars: [],
    sensitive_vars: [],
    roster_source: "none",
    notes: "",
  },
  strategies: [],
  events: [
    {
      id: "call_no_answer",
      label: "Llamada no contesta",
      modality: "telefono",
      outcome: "no_efectivo",
      counts_attempt: true,
      counts_contact: false,
      counts_complete: false,
      stop_contact: false,
    },
    {
      id: "call_later",
      label: "Contactar despues",
      modality: "telefono",
      outcome: "pendiente_contacto",
      counts_attempt: true,
      counts_contact: false,
      counts_complete: false,
      stop_contact: false,
    },
    {
      id: "call_whatsapp_contact",
      label: "Contactado por WhatsApp",
      modality: "whatsapp",
      outcome: "contactado_whatsapp",
      counts_attempt: true,
      counts_contact: true,
      counts_complete: false,
      stop_contact: false,
    },
    {
      id: "phone_wrong_number",
      label: "Numero incorrecto",
      modality: "telefono",
      outcome: "numero_incorrecto",
      counts_attempt: true,
      counts_contact: false,
      counts_complete: false,
      stop_contact: true,
    },
    {
      id: "phone_out_of_service",
      label: "No efectivo / fuera de servicio",
      modality: "telefono",
      outcome: "fuera_de_servicio",
      counts_attempt: true,
      counts_contact: false,
      counts_complete: false,
      stop_contact: true,
    },
    {
      id: "call_completed",
      label: "Encuesta completa por llamada",
      modality: "telefono",
      outcome: "completo",
      counts_attempt: true,
      counts_contact: true,
      counts_complete: true,
      stop_contact: true,
    },
    {
      id: "email_sent",
      label: "Correo enviado",
      modality: "email",
      outcome: "enviado",
      counts_attempt: true,
      counts_contact: false,
      counts_complete: false,
      stop_contact: false,
    },
    {
      id: "email_bounced",
      label: "Correo rebotado",
      modality: "email",
      outcome: "rebote",
      counts_attempt: true,
      counts_contact: false,
      counts_complete: false,
      stop_contact: false,
    },
  ],
  link_collectors: [],
  state_rules: [
    {
      id: "valid_complete",
      label: "Completa válida",
      final_state: "complete",
      priority: 10,
      outcome_values: ["completed", "complete", "valid", "approved", "aprobado", "efectivo", "completo"],
      stop_contact: false,
    },
    {
      id: "operational_pending",
      label: "Pendiente operativo",
      final_state: "pending",
      priority: 15,
      outcome_values: ["no_barrido", "contactar_despues", "contactado_whatsapp", "pendiente_contacto"],
      stop_contact: false,
    },
    {
      id: "refusal",
      label: "Rechazo",
      final_state: "refusal",
      priority: 20,
      outcome_values: ["rejected", "rechazo", "refusal"],
      stop_contact: false,
    },
    {
      id: "non_effective_contact",
      label: "Contacto no efectivo",
      final_state: "non_effective",
      priority: 25,
      outcome_values: ["no_contesta", "apagado", "colgo_corto", "no_efectivo", "fuera_de_servicio", "numero_incorrecto", "numero_suspendido", "no_existe_numero"],
      stop_contact: false,
    },
    {
      id: "not_eligible",
      label: "No elegible",
      final_state: "excluded",
      priority: 30,
      outcome_values: ["not_eligible", "no_elegible"],
      stop_contact: false,
    },
  ],
  privacy: {
    local_sensitive: true,
    export_policy: "aggregate_or_redacted",
  },
};

const EMPTY_CONFIG: MonitoreoConfig = {
  enumerator_var: "",
  date_var: "",
  start_var: "",
  end_var: "",
  duration_var: "",
  status_var: "",
  valid_statuses: ["completed", "valid", "approved", "aprobado"],
  id_var: "",
  contact_var: "",
  control_vars: [],
  critical_vars: [],
  goals: [],
  strategy_phases: [],
  operational_model: EMPTY_OPERATIONAL_MODEL,
  objetivo_total: null,
  min_duration_seconds: 60,
  max_duration_seconds: 7200,
  supervision_n: 20,
  supervision_seed: 20260514,
  acreditacion: EMPTY_ACREDITACION,
};

type SourceDraft = {
  kind: MonitoreoSourceKind;
  label: string;
  base_url: string;
  dimensions: SourceDimensions;
};

type SourceDimensions = {
  segmento: string;
  servicio: string;
  territorio: string;
};

const EMPTY_SOURCE_DIMENSIONS: SourceDimensions = {
  segmento: "",
  servicio: "",
  territorio: "",
};

const DEFAULT_SOURCE: SourceDraft = {
  kind: "surveymonkey",
  label: "",
  base_url: "https://api.surveymonkey.com/v3",
  dimensions: EMPTY_SOURCE_DIMENSIONS,
};

type WorkbenchView = "avance" | "modelo" | "fuentes" | "calidad";
type OperationalModelMode = "estructura" | "enlaces" | "casos" | "estrategias" | "reglas";
type AvanceMode = "tablero" | "seguimiento";
type QualityMode = "consistencia" | "supervision" | "equipo";

const WORKBENCH_VIEWS: Array<{
  key: WorkbenchView;
  label: string;
  desc: string;
  icon: typeof BarChart3;
}> = [
  { key: "fuentes", label: "Fuentes", desc: "Elegir encuestas y bases", icon: PlugZap },
  { key: "modelo", label: "Modelo operativo", desc: "Metas, mecanismos y barrido", icon: ListChecks },
  { key: "avance", label: "Avance", desc: "Cumplimiento y brechas", icon: BarChart3 },
  { key: "calidad", label: "Calidad", desc: "Supervisión y consistencia", icon: ShieldAlert },
];

const OPERATIONAL_MODEL_MODES: Array<{
  key: OperationalModelMode;
  label: string;
  desc: string;
  icon: typeof BarChart3;
}> = [
  { key: "estructura", label: "Metas y modalidades", desc: "Por corte: meta y mecanismos", icon: Layers3 },
  { key: "casos", label: "Base de barrido", desc: "Responsables, intentos y estados", icon: ContactRound },
  { key: "enlaces", label: "Enlaces y envíos", desc: "Correo, QR y links", icon: Link2 },
  { key: "reglas", label: "Estados válidos", desc: "Qué cuenta como avance", icon: SlidersHorizontal },
  { key: "estrategias", label: "Calendario", desc: "Mecanismos por semana", icon: Route },
];

const AVANCE_MODES: Array<{
  key: AvanceMode;
  label: string;
  desc: string;
  icon: typeof BarChart3;
}> = [
  { key: "tablero", label: "Tablero", desc: "Metas, brechas y producción", icon: BarChart3 },
  { key: "seguimiento", label: "Seguimiento", desc: "Cortes importados y refuerzos", icon: ClipboardCheck },
];

const QUALITY_MODES: Array<{
  key: QualityMode;
  label: string;
  desc: string;
  icon: typeof BarChart3;
}> = [
  { key: "consistencia", label: "Consistencia", desc: "Alertas e inconsistencias", icon: ShieldAlert },
  { key: "supervision", label: "Supervisión", desc: "Muestra de control", icon: PhoneCall },
  { key: "equipo", label: "Equipo", desc: "Actividad por operador", icon: Activity },
];

const DEFAULT_STRATEGY_PHASE: MonitoreoStrategyPhase = {
  id: "",
  stratum: "",
  modality: "telefono",
  start_week: 1,
  end_week: 1,
  target_rule: "",
  kpi_focus: [],
  kpi_modules: ["progress", "enumerator_activity", "contact_efficiency"],
  breakdown_vars: [],
  attempts_var: "",
  outcome_var: "",
};

const KPI_MODULES = [
  { key: "progress", label: "Avance y brecha", modes: ["email", "whatsapp", "sms", "telefono", "presencial", "mixto"] },
  { key: "distribution", label: "Distribución interna", modes: ["email", "whatsapp", "sms", "telefono", "presencial", "mixto"] },
  { key: "enumerator_activity", label: "Actividad por operador", modes: ["telefono", "presencial", "whatsapp", "mixto"] },
  { key: "contact_efficiency", label: "Efectividad de contacto", modes: ["telefono", "presencial", "whatsapp", "mixto"] },
  { key: "non_effective_attempts", label: "Intentos no efectivos", modes: ["telefono", "whatsapp", "mixto"] },
  { key: "delivery", label: "Envío y entrega", modes: ["email", "sms", "whatsapp", "mixto"] },
  { key: "response_quality", label: "Calidad de respuesta", modes: ["email", "whatsapp", "sms", "telefono", "presencial", "mixto"] },
] as const;

const DEFAULT_KPI_MODULES_BY_MODALITY: Record<MonitoreoStrategyPhase["modality"], string[]> = {
  email: ["progress", "distribution", "delivery"],
  whatsapp: ["progress", "delivery", "contact_efficiency"],
  sms: ["progress", "delivery"],
  telefono: ["progress", "distribution", "enumerator_activity", "contact_efficiency", "non_effective_attempts"],
  presencial: ["progress", "distribution", "enumerator_activity", "contact_efficiency"],
  mixto: ["progress", "distribution", "enumerator_activity", "contact_efficiency", "delivery"],
};

const STRATEGY_SCOPE_OPTIONS: Array<{
  value: string;
  label: string;
  modalities: Array<MonitoreoStrategyPhase["modality"]>;
}> = [
  { value: "todo_el_corte", label: "Todo el corte", modalities: ["email", "whatsapp", "sms", "telefono", "presencial", "mixto"] },
  { value: "pendientes_de_respuesta", label: "Pendientes", modalities: ["email", "whatsapp", "sms", "telefono", "presencial", "mixto"] },
  { value: "no_respondieron", label: "No respondieron", modalities: ["email", "whatsapp", "sms", "telefono", "presencial", "mixto"] },
  { value: "contactables", label: "Contactables", modalities: ["telefono", "whatsapp", "sms", "mixto"] },
  { value: "sin_barrido", label: "Sin barrido", modalities: ["telefono", "presencial", "mixto"] },
  { value: "refuerzo_final", label: "Refuerzo final", modalities: ["email", "whatsapp", "sms", "telefono", "mixto"] },
];

const DEFAULT_SCOPE_BY_MODALITY: Record<MonitoreoStrategyPhase["modality"], string> = {
  email: "pendientes_de_respuesta",
  whatsapp: "contactables",
  sms: "contactables",
  telefono: "sin_barrido",
  presencial: "todo_el_corte",
  mixto: "pendientes_de_respuesta",
};

const KPI_FOCUS_OPTIONS_BY_MODALITY: Record<MonitoreoStrategyPhase["modality"], string[]> = {
  email: ["avance", "faltante_a_meta", "entrega", "rebotes", "distribucion"],
  whatsapp: ["avance", "contacto", "entrega", "conversion", "faltante_a_meta"],
  sms: ["avance", "entrega", "conversion", "faltante_a_meta"],
  telefono: ["avance", "efectivas", "intentos", "no_efectivas", "operadores", "faltante_a_meta"],
  presencial: ["avance", "qr_validos", "cobertura_local", "operadores", "faltante_a_meta"],
  mixto: ["avance", "faltante_a_meta", "contacto", "distribucion", "calidad"],
};

const KPI_FOCUS_LABELS: Record<string, string> = {
  avance: "Avance",
  faltante_a_meta: "Faltante a meta",
  entrega: "Entrega",
  rebotes: "Rebotes",
  distribucion: "Distribución",
  contacto: "Contacto",
  conversion: "Conversion",
  efectivas: "Efectivas",
  intentos: "Intentos",
  no_efectivas: "No efectivas",
  operadores: "Operadores",
  qr_validos: "QR válidos",
  cobertura_local: "Cobertura local",
  calidad: "Calidad",
};

const FINAL_STATE_OPTIONS = [
  { value: "complete", label: "Completa válida" },
  { value: "pending", label: "Pendiente" },
  { value: "non_effective", label: "No efectiva" },
  { value: "refusal", label: "Rechazo" },
  { value: "excluded", label: "Excluida" },
];

const OUTCOME_PRESETS = [
  { value: "completed", label: "Completada" },
  { value: "complete", label: "Completa" },
  { value: "valid", label: "Válida" },
  { value: "approved", label: "Aprobada" },
  { value: "aprobado", label: "Aprobado" },
  { value: "efectivo", label: "Efectivo" },
  { value: "completo", label: "Completo" },
  { value: "no_efectivo", label: "No efectivo" },
  { value: "pendiente_contacto", label: "Pendiente contacto" },
  { value: "contactado_whatsapp", label: "Contactado WhatsApp" },
  { value: "numero_incorrecto", label: "Número incorrecto" },
  { value: "fuera_de_servicio", label: "Fuera de servicio" },
  { value: "rebote", label: "Rebote" },
  { value: "enviado", label: "Enviado" },
  { value: "rejected", label: "Rechazada" },
  { value: "rechazo", label: "Rechazo" },
  { value: "refusal", label: "Refusal" },
  { value: "not_eligible", label: "No elegible" },
  { value: "no_elegible", label: "No elegible" },
];

const ROSTER_SOURCE_OPTIONS: Array<{
  value: MonitoreoOperationalCases["roster_source"];
  label: string;
  detail: string;
}> = [
  {
    value: "none",
    label: "Sin base de barrido",
    detail: "Usa solo las fuentes conectadas para calcular avance agregado.",
  },
  {
    value: "responses",
    label: "Solo respuestas",
    detail: "SurveyMonkey o Kobo aportan estado, fecha, variables y datos de respuesta.",
  },
  {
    value: "uploaded",
    label: "Universo / contactos",
    detail: "Define universo, cuotas, cortes y variables que no salen de la respuesta.",
  },
  {
    value: "external_local",
    label: "Barrido local",
    detail: "Sheet operativo con responsable, status, intentos, fecha y observación.",
  },
];

const COLLECTOR_USE_OPTIONS: Array<{
  value: MonitoreoCollectorUse;
  label: string;
  modality: MonitoreoStrategyPhase["modality"];
  icon: typeof Link2;
}> = [
  { value: "correo_autoaplicado", label: "Correo autoaplicado", modality: "email", icon: Mail },
  { value: "telefono_asistido", label: "Teléfono asistido", modality: "telefono", icon: PhoneCall },
  { value: "presencial_qr", label: "Presencial QR", modality: "presencial", icon: QrCode },
  { value: "enlace_abierto", label: "Enlace abierto", modality: "mixto", icon: Link2 },
  { value: "sms", label: "SMS", modality: "sms", icon: ContactRound },
  { value: "mixto", label: "Mixto/refuerzo", modality: "mixto", icon: Route },
  { value: "sin_clasificar", label: "Sin clasificar", modality: "mixto", icon: SlidersHorizontal },
];

const MODALITY_SELECT_OPTIONS: Array<{
  value: MonitoreoStrategyPhase["modality"];
  label: string;
}> = [
  { value: "email", label: "Correo" },
  { value: "presencial", label: "Presencial / QR" },
  { value: "telefono", label: "Teléfono" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "mixto", label: "Mixto" },
];

const DATA_LAYER_GUIDE: Array<{
  key: Exclude<MonitoreoOperationalCases["roster_source"], "none">;
  label: string;
  meta: string;
  detail: string;
}> = [
  {
    key: "responses",
    label: "Respuesta de plataforma",
    meta: "SurveyMonkey / Kobo",
    detail: "Título completo, estado final, fecha y variables capturadas por la encuesta.",
  },
  {
    key: "uploaded",
    label: "Universo / marco",
    meta: "Metas y estratos",
    detail: "Carrera, territorio, servicio, actor u otra variable que organiza la meta.",
  },
  {
    key: "external_local",
    label: "Base de barrido",
    meta: "Excel / Sheets",
    detail: "Responsable, status, intentos, fecha y observación para teléfono o presencial.",
  },
];

const STRATEGY_LABEL_OPTIONS = [
  "Seguimiento general",
  "Refuerzo telefónico",
  "Refuerzo por correo",
  "Aplicación presencial",
  "Cierre de pendientes",
  "Control de distribución",
  "Revisión de calidad",
];

const STRATEGY_OWNER_OPTIONS = [
  "Coordinación",
  "Equipo de campo",
  "Supervisión",
  "Encuestadores",
  "Soporte de datos",
  "Contraparte local",
];

const STRATEGY_OBJECTIVE_OPTIONS = [
  "Cerrar brecha de meta",
  "Completar pendientes de respuesta",
  "Mejorar efectividad de contacto",
  "Equilibrar distribución interna",
  "Verificar calidad de respuestas",
  "Preparar cierre operativo",
];

const EVENT_PRESETS: Array<{
  label: string;
  modality: MonitoreoStrategyPhase["modality"];
  outcome: string;
  counts_attempt: boolean;
  counts_contact: boolean;
  counts_complete: boolean;
  stop_contact: boolean;
}> = [
  { label: "Respuesta completa", modality: "email", outcome: "completed", counts_attempt: true, counts_contact: true, counts_complete: true, stop_contact: true },
  { label: "Llamada efectiva", modality: "telefono", outcome: "efectivo", counts_attempt: true, counts_contact: true, counts_complete: true, stop_contact: true },
  { label: "No contesta", modality: "telefono", outcome: "no_efectivo", counts_attempt: true, counts_contact: false, counts_complete: false, stop_contact: false },
  { label: "Contactado por WhatsApp", modality: "whatsapp", outcome: "contactado_whatsapp", counts_attempt: true, counts_contact: true, counts_complete: false, stop_contact: false },
  { label: "Número incorrecto", modality: "telefono", outcome: "numero_incorrecto", counts_attempt: true, counts_contact: false, counts_complete: false, stop_contact: true },
  { label: "Fuera de servicio", modality: "telefono", outcome: "fuera_de_servicio", counts_attempt: true, counts_contact: false, counts_complete: false, stop_contact: true },
  { label: "Rebote de correo", modality: "email", outcome: "rebote", counts_attempt: true, counts_contact: false, counts_complete: false, stop_contact: true },
];

const STATE_RULE_PRESETS: Array<{
  label: string;
  final_state: string;
  priority: number;
  outcome_values: string[];
  stop_contact: boolean;
}> = [
  { label: "Completa válida", final_state: "complete", priority: 10, outcome_values: ["completed", "complete", "valid", "approved", "aprobado", "efectivo", "completo"], stop_contact: true },
  { label: "Pendiente de contacto", final_state: "pending", priority: 30, outcome_values: ["pendiente_contacto", "no_efectivo", "no_respondieron"], stop_contact: false },
  { label: "No efectiva", final_state: "non_effective", priority: 40, outcome_values: ["no_efectivo", "numero_incorrecto", "fuera_de_servicio"], stop_contact: false },
  { label: "Rechazo", final_state: "refusal", priority: 20, outcome_values: ["rejected", "rechazo", "refusal"], stop_contact: true },
  { label: "Excluida", final_state: "excluded", priority: 50, outcome_values: ["not_eligible", "no_elegible"], stop_contact: true },
];

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "" || value === "NA") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function numberOrFallback(value: unknown, fallback: number): number {
  const n = numberOrNull(value);
  return n == null ? fallback : n;
}

function arrayOrEmpty<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeModality(value: unknown): MonitoreoStrategyPhase["modality"] {
  return ["email", "whatsapp", "sms", "telefono", "presencial", "mixto"].includes(String(value))
    ? value as MonitoreoStrategyPhase["modality"]
    : "mixto";
}

function mergeStrategyPhase(value: Partial<MonitoreoStrategyPhase> | undefined, index: number): MonitoreoStrategyPhase {
  const modality = normalizeModality(value?.modality ?? DEFAULT_STRATEGY_PHASE.modality);
  return {
    ...DEFAULT_STRATEGY_PHASE,
    ...(value ?? {}),
    id: stringOrEmpty(value?.id) || `fase-${index + 1}`,
    stratum: stringOrEmpty(value?.stratum),
    modality,
    start_week: numberOrNull(value?.start_week),
    end_week: numberOrNull(value?.end_week),
    target_rule: stringOrEmpty(value?.target_rule),
    kpi_focus: arrayOrEmpty<string>(value?.kpi_focus),
    kpi_modules: arrayOrEmpty<string>(value?.kpi_modules).length
      ? arrayOrEmpty<string>(value?.kpi_modules)
      : DEFAULT_KPI_MODULES_BY_MODALITY[modality],
    breakdown_vars: arrayOrEmpty<string>(value?.breakdown_vars),
    attempts_var: stringOrEmpty(value?.attempts_var),
    outcome_var: stringOrEmpty(value?.outcome_var),
  };
}

function normalizeRosterSource(value: unknown): MonitoreoOperationalCases["roster_source"] {
  return ["none", "uploaded", "responses", "external_local"].includes(String(value))
    ? value as MonitoreoOperationalCases["roster_source"]
    : "none";
}

function normalizeStrategyStatus(value: unknown): MonitoreoOperationalStrategy["status"] {
  return ["draft", "active", "paused", "closed"].includes(String(value))
    ? value as MonitoreoOperationalStrategy["status"]
    : "draft";
}

function normalizeExportPolicy(value: unknown): MonitoreoOperationalModel["privacy"]["export_policy"] {
  return ["aggregate_or_redacted", "aggregate_only", "allow_case_level_local"].includes(String(value))
    ? value as MonitoreoOperationalModel["privacy"]["export_policy"]
    : "aggregate_or_redacted";
}

function normalizeCollectorUse(value: unknown): MonitoreoCollectorUse {
  return COLLECTOR_USE_OPTIONS.some((option) => option.value === value)
    ? value as MonitoreoCollectorUse
    : "sin_clasificar";
}

function modalityForCollectorUse(value: MonitoreoCollectorUse): MonitoreoStrategyPhase["modality"] {
  return COLLECTOR_USE_OPTIONS.find((option) => option.value === value)?.modality ?? "mixto";
}

function withOperationalDefaults<T extends { id: string }>(items: Array<Partial<T>>, defaults: T[]): Array<Partial<T>> {
  if (!items.length) return defaults;
  const out = [...items];
  const seen = new Set(
    items
      .map((item) => stringOrEmpty(item.id))
      .filter(Boolean),
  );
  for (const item of defaults) {
    if (!seen.has(item.id)) out.push(item);
  }
  return out;
}

function mergeOperationalModel(value: Partial<MonitoreoOperationalModel> | undefined): MonitoreoOperationalModel {
  const model = value ?? {};
  const cases = model.cases ?? EMPTY_OPERATIONAL_MODEL.cases;
  const privacy = model.privacy ?? EMPTY_OPERATIONAL_MODEL.privacy;
  const events = withOperationalDefaults(
    arrayOrEmpty<Partial<MonitoreoOperationalEvent>>(model.events),
    EMPTY_OPERATIONAL_MODEL.events,
  );
  const stateRules = withOperationalDefaults(
    arrayOrEmpty<Partial<MonitoreoStateRule>>(model.state_rules),
    EMPTY_OPERATIONAL_MODEL.state_rules,
  );
  return {
    schema_version: stringOrEmpty(model.schema_version) || EMPTY_OPERATIONAL_MODEL.schema_version,
    strata: arrayOrEmpty<Partial<MonitoreoOperationalStratum>>(model.strata).map((item, index) => ({
      id: stringOrEmpty(item.id) || `corte-${index + 1}`,
      label: stringOrEmpty(item.label),
      source_id: stringOrEmpty(item.source_id),
      variable: stringOrEmpty(item.variable),
      value: stringOrEmpty(item.value),
      notes: stringOrEmpty(item.notes),
    })),
    targets: arrayOrEmpty<Partial<MonitoreoOperationalTarget>>(model.targets).map((item, index) => {
      const rawFilters = item.filters && typeof item.filters === "object" ? item.filters : {};
      const filters = Object.fromEntries(
        Object.entries(rawFilters)
          .map(([key, value]) => [key, String(value ?? "").trim()] as const)
          .filter(([key, value]) => key.trim() && value),
      );
      return {
        id: stringOrEmpty(item.id) || `meta-${index + 1}`,
        label: stringOrEmpty(item.label),
        stratum_id: stringOrEmpty(item.stratum_id),
        filters,
        meta: numberOrFallback(item.meta, 0),
        notes: stringOrEmpty(item.notes),
      };
    }),
    cases: {
      enabled: Boolean(cases.enabled),
      case_id_var: stringOrEmpty(cases.case_id_var),
      person_label_var: stringOrEmpty(cases.person_label_var),
      status_var: stringOrEmpty(cases.status_var),
      contact_vars: arrayOrEmpty<string>(cases.contact_vars),
      sensitive_vars: arrayOrEmpty<string>(cases.sensitive_vars),
      roster_source: normalizeRosterSource(cases.roster_source),
      notes: stringOrEmpty(cases.notes),
    },
    strategies: arrayOrEmpty<Partial<MonitoreoOperationalStrategy>>(model.strategies).map((item, index) => ({
      id: stringOrEmpty(item.id) || `estrategia-${index + 1}`,
      label: stringOrEmpty(item.label),
      objective: stringOrEmpty(item.objective),
      owner: stringOrEmpty(item.owner),
      status: normalizeStrategyStatus(item.status),
    })),
    link_collectors: arrayOrEmpty<Partial<MonitoreoLinkCollector>>(model.link_collectors).map((item, index) => {
      const operationalUse = normalizeCollectorUse(item.operational_use);
      const modality = normalizeModality(item.modality ?? modalityForCollectorUse(operationalUse));
      return {
        id: stringOrEmpty(item.id) || `${stringOrEmpty(item.source_id) || "fuente"}::${stringOrEmpty(item.collector_id) || `colector-${index + 1}`}`,
        source_id: stringOrEmpty(item.source_id),
        source_label: stringOrEmpty(item.source_label),
        survey_id: stringOrEmpty(item.survey_id),
        collector_id: stringOrEmpty(item.collector_id),
        collector_name: stringOrEmpty(item.collector_name),
        collector_type: stringOrEmpty(item.collector_type),
        operational_use: operationalUse,
        modality,
        roster_required: Boolean(item.roster_required ?? operationalUse === "telefono_asistido"),
      };
    }),
    events: events.map((item, index) => ({
      id: stringOrEmpty(item.id) || `evento-${index + 1}`,
      label: stringOrEmpty(item.label),
      modality: normalizeModality(item.modality),
      outcome: stringOrEmpty(item.outcome),
      counts_attempt: Boolean(item.counts_attempt),
      counts_contact: Boolean(item.counts_contact),
      counts_complete: Boolean(item.counts_complete),
      stop_contact: Boolean(item.stop_contact),
    })),
    state_rules: stateRules.map((item, index) => ({
      id: stringOrEmpty(item.id) || `regla-${index + 1}`,
      label: stringOrEmpty(item.label),
      final_state: stringOrEmpty(item.final_state),
      priority: numberOrFallback(item.priority, index + 1),
      outcome_values: arrayOrEmpty<string>(item.outcome_values),
      stop_contact: Boolean(item.stop_contact),
    })),
    privacy: {
      local_sensitive: privacy.local_sensitive !== false,
      export_policy: normalizeExportPolicy(privacy.export_policy),
    },
  };
}

function cleanSourceDimensions(dimensions: Partial<SourceDimensions> | Record<string, string> | undefined): Record<string, string> {
  const entries = Object.entries(dimensions ?? {})
    .map(([key, value]) => [key.trim(), String(value ?? "").trim()] as const)
    .filter(([key, value]) => key && value);
  return Object.fromEntries(entries);
}

function sourceDimensionEntries(dimensions: Record<string, string> | undefined) {
  return Object.entries(dimensions ?? {}).filter(([, value]) => String(value ?? "").trim());
}

function dimensionLabel(key: string) {
  const labels: Record<string, string> = {
    actor: "Corte principal",
    segmento: "Corte principal",
    servicio: "Corte secundario",
    municipalidad: "Territorio / ámbito",
    territorio: "Territorio / ámbito",
  };
  return labels[key] ?? key.replace(/_/g, " ");
}

function mergeAcreditacion(value: unknown): MonitoreoAcreditacion {
  const acr = (value && typeof value === "object" ? value : {}) as Partial<MonitoreoAcreditacion>;
  const dashboard = acr.dashboard ?? EMPTY_ACREDITACION.dashboard;
  return {
    ...EMPTY_ACREDITACION,
    ...acr,
    estudio: { ...EMPTY_ACREDITACION.estudio, ...(acr.estudio ?? {}) },
    componentes: arrayOrEmpty<MonitoreoAcreditacionComponente>(acr.componentes),
    dashboard: {
      ...EMPTY_ACREDITACION.dashboard,
      ...dashboard,
      cards: arrayOrEmpty(dashboard.cards),
      alertas: arrayOrEmpty(dashboard.alertas),
    },
  };
}

function mergeConfig(config: Partial<MonitoreoConfig> | undefined): MonitoreoConfig {
  const next = { ...EMPTY_CONFIG, ...(config ?? {}) };
  return {
    ...next,
    valid_statuses: arrayOrEmpty<string>(next.valid_statuses).length ? arrayOrEmpty<string>(next.valid_statuses) : EMPTY_CONFIG.valid_statuses,
    control_vars: arrayOrEmpty<string>(next.control_vars),
    critical_vars: arrayOrEmpty<string>(next.critical_vars),
    goals: arrayOrEmpty<MonitoreoGoal>(next.goals),
    strategy_phases: arrayOrEmpty<Partial<MonitoreoStrategyPhase>>(next.strategy_phases).map(mergeStrategyPhase),
    operational_model: mergeOperationalModel(next.operational_model),
    objetivo_total: numberOrNull(next.objetivo_total),
    min_duration_seconds: numberOrFallback(next.min_duration_seconds, EMPTY_CONFIG.min_duration_seconds),
    max_duration_seconds: numberOrFallback(next.max_duration_seconds, EMPTY_CONFIG.max_duration_seconds),
    supervision_n: numberOrFallback(next.supervision_n, EMPTY_CONFIG.supervision_n),
    supervision_seed: numberOrFallback(next.supervision_seed, EMPTY_CONFIG.supervision_seed),
    acreditacion: mergeAcreditacion(next.acreditacion),
  };
}

export default function MonitoreoPage() {
  useAnaliticaAutosave();

  const [state, setState] = useState<MonitoreoState | null>(null);
  const [config, setConfig] = useState<MonitoreoConfig>(EMPTY_CONFIG);
  const [source, setSource] = useState<SourceDraft>(DEFAULT_SOURCE);
  const [loading, setLoading] = useState(true);
  const [savingSource, setSavingSource] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingAcreditacion, setSavingAcreditacion] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [exportLink, setExportLink] = useState<{ href: string; filename: string } | null>(null);
  const [sample, setSample] = useState<MonitoreoRow[]>([]);
  const [activeView, setActiveView] = useState<WorkbenchView>("fuentes");
  const [activeModelMode, setActiveModelMode] = useState<OperationalModelMode>("estructura");
  const [activeAvanceMode, setActiveAvanceMode] = useState<AvanceMode>("tablero");
  const [activeQualityMode, setActiveQualityMode] = useState<QualityMode>("consistencia");

  async function refresh() {
    setError("");
    const next = await apiMonitoreoState();
    setState(next);
    setConfig(mergeConfig(next.config));
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiMonitoreoState()
      .then((next) => {
        if (cancelled) return;
        setState(next);
        setConfig(mergeConfig(next.config));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const variables = state?.variables ?? [];
  const sources = state?.sources ?? [];
  const activeSources = sources.filter((s) => s.enabled);
  const acreditacion = mergeAcreditacion(state?.acreditacion ?? config.acreditacion);
  const rawDashboard = state?.dashboard;
  const dashboard: MonitoreoDashboard | null =
    rawDashboard?.kpis && Array.isArray(rawDashboard.progress) && Array.isArray(rawDashboard.production)
      ? {
          ...rawDashboard,
          progress: rawDashboard.progress ?? [],
          production: rawDashboard.production ?? [],
          inconsistencies: rawDashboard.inconsistencies ?? [],
        }
      : null;

  async function persistSource(payload: MonitoreoSourcePayload) {
    const result = await apiMonitoreoSource(payload);
    setState(result.state);
    setConfig(mergeConfig(result.state.config));
  }

  async function addSurveySource(survey: SurveyMonkeyMultibaseListItem, label: string, dimensions: Partial<SourceDimensions>) {
    setSavingSource(true);
    setError("");
    try {
      await persistSource({
        kind: "surveymonkey",
        label: label.trim() || survey.title,
        survey_id: survey.id,
        base_url: "https://api.surveymonkey.com/v3",
        dimensions: cleanSourceDimensions(dimensions),
      });
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setSavingSource(false);
    }
  }

  async function updateSource(source: MonitoreoSource, patch: Partial<MonitoreoSourcePayload>) {
    setSavingSource(true);
    setError("");
    try {
      await persistSource({
        id: source.id,
        kind: source.kind,
        label: source.label,
        enabled: source.enabled,
        survey_id: source.survey_id,
        asset_uid: source.asset_uid,
        base_url: source.base_url,
        dimensions: source.dimensions,
        ...patch,
      });
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setSavingSource(false);
    }
  }

  async function addKoboSource(asset: MonitoreoKoboAssetItem, label: string, dimensions: Partial<SourceDimensions>) {
    setSavingSource(true);
    setError("");
    try {
      await persistSource({
        kind: "kobo",
        label: label.trim() || asset.name,
        asset_uid: asset.uid,
        base_url: source.base_url || "https://kf.kobotoolbox.org",
        dimensions: cleanSourceDimensions(dimensions),
      });
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setSavingSource(false);
    }
  }

  async function saveConfig() {
    setSavingConfig(true);
    setError("");
    try {
      const result = await apiMonitoreoConfig(config);
      setState(result.state);
      setConfig(mergeConfig(result.config));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingConfig(false);
    }
  }

  async function importCalcMuestra() {
    setSavingAcreditacion(true);
    setError("");
    try {
      const result = await apiMonitoreoImportFromCalcMuestra();
      setState(result.state);
      setConfig(mergeConfig(result.state.config));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingAcreditacion(false);
    }
  }

  async function saveAcreditacionSeguimiento(payload: MonitoreoAcreditacionSeguimientoPayload) {
    setSavingAcreditacion(true);
    setError("");
    try {
      const result = await apiMonitoreoAcreditacionSeguimiento(payload);
      setState(result.state);
      setConfig(mergeConfig(result.state.config));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingAcreditacion(false);
    }
  }

  async function closeAcreditacion(plan_refuerzo: string, aprobar_brechas: boolean) {
    setSavingAcreditacion(true);
    setError("");
    try {
      const result = await apiMonitoreoCierre({ plan_refuerzo, aprobar_brechas });
      setState(result.state);
      setConfig(mergeConfig(result.state.config));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingAcreditacion(false);
    }
  }

  async function syncNow() {
    setError("");
    setExportLink(null);
    try {
      await apiMonitoreoConfig(config);
      const start = await apiMonitoreoSync(config);
      setJobId(start.job_id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function exportReport() {
    setError("");
    try {
      const out = await apiMonitoreoExport(config);
      setExportLink({ href: downloadUrl(out.file_id), filename: out.filename ?? "monitoreo.xlsx" });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function buildSample() {
    setError("");
    try {
      const out = await apiMonitoreoSupervisionSample({
        config,
        n: config.supervision_n,
        seed: config.supervision_seed,
      });
      setSample(out.sample);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) {
    return (
      <div data-audit-route="monitoreo" data-audit-state="loading">
        <LoadingBlock label="Cargando monitoreo..." />
      </div>
    );
  }

  return (
    <PageFrame
      title="Monitoreo de campo"
      lead="Avance de encuesta, cuotas por fuente y calidad desde Kobo y SurveyMonkey."
      toolbar={
        <div className="mon-commandbar">
          <div className="mon-commandbar-group">
            <button
              type="button"
              className={activeSources.length ? "pulso-primary" : ""}
              onClick={syncNow}
              disabled={!activeSources.length || !!jobId}
            >
            {jobId ? <Loader2 size={14} className="pulso-spin" /> : <RefreshCw size={14} />}
            Sincronizar
            </button>
          </div>
          <div className="mon-commandbar-group mon-commandbar-group--end">
            <button type="button" onClick={saveConfig} disabled={savingConfig}>
              <Save size={14} />
              Guardar config
            </button>
            <button type="button" onClick={importCalcMuestra} disabled={savingAcreditacion}>
              {savingAcreditacion ? <Loader2 size={14} className="pulso-spin" /> : <Link2 size={14} />}
              Importar diseño...
            </button>
            <button type="button" onClick={exportReport} disabled={!state?.has_snapshot}>
              <Download size={14} />
              Exportar
            </button>
            {exportLink && (
              <a className="mon-download-link" href={exportLink.href} download={exportLink.filename}>
                {exportLink.filename}
              </a>
            )}
          </div>
        </div>
      }
      bodyMode="fill"
      className="mon-page"
      density="compact"
    >
      <span
        hidden
        data-audit-ready="monitoreo"
        data-audit-has-dashboard={dashboard ? "true" : "false"}
      />
      {error && <Alert kind="error">{error}</Alert>}
      <JobProgress<MonitoreoSyncResult>
        label="Sincronizando monitoreo"
        jobId={jobId}
        onDone={async () => {
          setJobId(null);
          await refresh();
        }}
        onError={(msg) => {
          setJobId(null);
          setError(msg);
        }}
        onCancelled={() => setJobId(null)}
      />

      <section className="mon-workbench pulso-split-view" aria-label="Mesa de trabajo de monitoreo">
        <MonitoreoRail
          activeView={activeView}
          onChange={setActiveView}
          sources={sources}
          activeSources={activeSources.length}
          nRows={state?.n_rows ?? 0}
          syncedAt={state?.synced_at ?? ""}
          dashboardReady={!!dashboard}
          config={config}
        />
        <main className="mon-workbench-main pulso-content-area" aria-live="polite">
          <WorkbenchHead
            activeView={activeView}
            dashboard={dashboard}
            nRows={state?.n_rows ?? 0}
            activeSources={activeSources.length}
            strategyCount={config.strategy_phases.length}
          />
          <div className={`mon-workbench-content mon-workbench-content--${activeView}`}>
            {activeView === "avance" && (
              <AvanceView
                mode={activeAvanceMode}
                onModeChange={setActiveAvanceMode}
                sources={sources}
                config={config}
                dashboard={dashboard}
                syncedAt={state?.synced_at ?? ""}
                nRows={state?.n_rows ?? 0}
                acreditacion={acreditacion}
                savingAcreditacion={savingAcreditacion}
                onImport={importCalcMuestra}
                onSaveSeguimiento={saveAcreditacionSeguimiento}
                onCerrar={closeAcreditacion}
              />
            )}

            {activeView === "modelo" && (
              <OperationalModelPanel
                mode={activeModelMode}
                onModeChange={setActiveModelMode}
                sources={sources}
                config={config}
                acreditacion={acreditacion}
                variables={variables}
                setConfig={setConfig}
                onConfigPersisted={(next) => {
                  setState(next);
                  setConfig(mergeConfig(next.config));
                }}
              />
            )}

            {activeView === "fuentes" && (
              <div className="mon-stage mon-stage--sources">
                <SourcePanel
                  className="mon-fill-panel mon-source-fill-panel"
                  draft={source}
                  setDraft={setSource}
                  saving={savingSource}
                  state={state}
                  onAddSurvey={addSurveySource}
                  onAddKobo={addKoboSource}
                  onUpdateSource={updateSource}
                />
              </div>
            )}

            {activeView === "calidad" && (
              <QualityView
                mode={activeQualityMode}
                onModeChange={setActiveQualityMode}
                config={config}
                inconsistencies={dashboard?.inconsistencies ?? []}
                sample={sample}
                hasSnapshot={!!state?.has_snapshot}
                onBuildSample={buildSample}
              />
            )}
          </div>
        </main>
      </section>
    </PageFrame>
  );
}

function MonitoreoRail({
  activeView,
  onChange,
  sources,
  activeSources,
  nRows,
  syncedAt,
  dashboardReady,
  config,
}: {
  activeView: WorkbenchView;
  onChange: (view: WorkbenchView) => void;
  sources: MonitoreoSource[];
  activeSources: number;
  nRows: number;
  syncedAt: string;
  dashboardReady: boolean;
  config: MonitoreoConfig;
}) {
  return (
    <aside className="mon-workbench-rail pulso-sidebar" aria-label="Flujos de monitoreo">
      <div className="mon-rail-head">
        <span className="pulso-section-eyebrow">Monitoreo</span>
        <strong>Mesa multiflujo</strong>
      </div>
      <div className="mon-workbench-nav" role="tablist" aria-orientation="vertical">
        {WORKBENCH_VIEWS.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={`mon-nav-item${active ? " is-active" : ""}`}
              onClick={() => onChange(item.key)}
            >
              <span className="mon-nav-icon"><Icon size={15} /></span>
              <span className="mon-nav-copy">
                <strong>{item.label}</strong>
                <span>{item.desc}</span>
              </span>
              {active && <CheckCircle2 size={13} className="mon-nav-current" />}
            </button>
          );
        })}
      </div>
      <div className="mon-rail-status" aria-label="Estado del monitoreo">
        <RailMetric label="Fuentes activas" value={`${activeSources}/${sources.length}`} />
        <RailMetric label="Registros" value={nRows ? nRows.toLocaleString("es-PE") : "S/D"} />
        <RailMetric label="Metas" value={String(config.goals.length)} />
        <RailMetric label="Mecanismos" value={String(config.strategy_phases.length)} />
        <div className={`mon-rail-sync${dashboardReady ? " is-ready" : ""}`}>
          <span>{dashboardReady ? "Tablero listo" : "Pendiente de sync"}</span>
          <strong>{syncedAt ? formatDate(syncedAt) : "Sin sincronizar"}</strong>
        </div>
      </div>
    </aside>
  );
}

function RailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="mon-rail-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WorkbenchHead({
  activeView,
  dashboard,
  nRows,
  activeSources,
  strategyCount,
}: {
  activeView: WorkbenchView;
  dashboard: MonitoreoDashboard | null;
  nRows: number;
  activeSources: number;
  strategyCount: number;
}) {
  const meta = WORKBENCH_VIEWS.find((item) => item.key === activeView) ?? WORKBENCH_VIEWS[0];
  const Icon = meta.icon;
  const valid = numberOrNull(dashboard?.kpis?.valid) ?? 0;
  return (
    <header className="mon-workbench-head">
      <span aria-hidden="true" className="mon-workbench-head-icon">
        <Icon size={17} />
      </span>
      <div className="mon-workbench-head-copy">
        <span className="pulso-section-eyebrow">Flujo actual</span>
        <h2>{meta.label}</h2>
        <p>{meta.desc}</p>
      </div>
      <div className="mon-workbench-pills" aria-label="Resumen operativo">
        <span>{activeSources} fuentes</span>
        <span>{nRows ? nRows.toLocaleString("es-PE") : "0"} registros</span>
        <span>{valid.toLocaleString("es-PE")} válidas</span>
        <span>{strategyCount} mecanismos</span>
      </div>
    </header>
  );
}

function StageModeBar<T extends string>({
  options,
  active,
  onChange,
  summary,
}: {
  options: Array<{ key: T; label: string; desc: string; icon: typeof BarChart3 }>;
  active: T;
  onChange: (value: T) => void;
  summary?: ReactNode;
}) {
  return (
    <div className="mon-stage-modebar">
      <div className="mon-stage-segment" role="tablist" aria-label="Modo de trabajo">
        {options.map((option) => {
          const Icon = option.icon;
          const selected = option.key === active;
          return (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={selected}
              className={selected ? "is-active" : ""}
              onClick={() => onChange(option.key)}
            >
              <Icon size={14} />
              <span>
                <strong>{option.label}</strong>
                <em>{option.desc}</em>
              </span>
            </button>
          );
        })}
      </div>
      {summary && <div className="mon-stage-summary">{summary}</div>}
    </div>
  );
}

function AvanceView({
  mode,
  onModeChange,
  sources,
  config,
  dashboard,
  syncedAt,
  nRows,
  acreditacion,
  savingAcreditacion,
  onImport,
  onSaveSeguimiento,
  onCerrar,
}: {
  mode: AvanceMode;
  onModeChange: (mode: AvanceMode) => void;
  sources: MonitoreoSource[];
  config: MonitoreoConfig;
  dashboard: MonitoreoDashboard | null;
  syncedAt: string;
  nRows: number;
  acreditacion: MonitoreoAcreditacion;
  savingAcreditacion: boolean;
  onImport: () => void;
  onSaveSeguimiento: (payload: MonitoreoAcreditacionSeguimientoPayload) => Promise<void>;
  onCerrar: (planRefuerzo: string, aprobarBrechas: boolean) => Promise<void>;
}) {
  return (
    <div className="mon-stage mon-stage--avance">
      <StageModeBar
        options={AVANCE_MODES}
        active={mode}
        onChange={onModeChange}
        summary={
          <>
            <span>{dashboard ? "Sincronizado" : "Sin sincronizar"}</span>
            <span>{nRows.toLocaleString("es-PE")} registros</span>
          </>
        }
      />
      {mode === "tablero" ? (
        dashboard ? (
          <div className="mon-stage-stack mon-stage-stack--dashboard">
            <DashboardSummary dashboard={dashboard} syncedAt={syncedAt} nRows={nRows} />
            <StrataProgressDashboard
              sources={sources}
              config={config}
              acreditacion={acreditacion}
              dashboard={dashboard}
            />
          </div>
        ) : (
        <EmptyState
          icon={<RefreshCw size={18} />}
          title="Sin datos sincronizados"
          hint="Conecta una fuente y sincroniza para ver el tablero operativo."
        />
      )
      ) : acreditacion.enabled ? (
        <AcreditacionPanel
          className="mon-fill-panel mon-acr-fill-panel"
          acreditacion={acreditacion}
          saving={savingAcreditacion}
          onImport={onImport}
          onSaveSeguimiento={onSaveSeguimiento}
          onCerrar={onCerrar}
        />
      ) : (
        <OperationalFollowupPanel
          sources={sources}
          config={config}
          dashboard={dashboard}
          nRows={nRows}
        />
      )}
    </div>
  );
}

type StrataDashboardCard = {
  id: string;
  title: string;
  detail: string;
  modality: MonitoreoStrategyPhase["modality"];
  observed: number | null;
  meta: number | null;
  missing: number | null;
  percent: number | null;
  percentLabel: string;
  alerts: number;
  support: string;
};

function StrataProgressDashboard({
  sources,
  config,
  acreditacion,
  dashboard,
}: {
  sources: MonitoreoSource[];
  config: MonitoreoConfig;
  acreditacion: MonitoreoAcreditacion;
  dashboard: MonitoreoDashboard;
}) {
  const cards = buildStrataDashboardCards(sources, config, acreditacion, dashboard);
  return (
    <Panel
      className="mon-fill-panel mon-strata-dashboard"
      eyebrow="Dashboard de avance"
      title={<span className="mon-title-icon"><BarChart3 size={16} /> Avance por corte</span>}
    >
      <div className="mon-strata-grid">
        {cards.length ? cards.map((card) => (
          <StrataDashboardCardView key={card.id} card={card} />
        )) : (
          <EmptyState icon={<Target size={18} />} title="Sin cortes operativos" variant="inline" />
        )}
      </div>
    </Panel>
  );
}

function StrataDashboardCardView({ card }: { card: StrataDashboardCard }) {
  const Icon = modalityIcon(card.modality);
  const actualLabel = actualLabelForModality(card.modality);
  const barWidth = card.percent == null ? 0 : Math.max(3, Math.min(100, card.percent));
  const dialDegrees = card.percent == null ? 0 : Math.max(0, Math.min(100, card.percent)) * 3.6;
  const missingLabel = card.missing == null ? "S/D" : formatMetric(card.missing);
  const ratioLabel = card.meta == null
    ? `${formatMetric(card.observed)} logradas`
    : `${formatMetric(card.observed)} / ${formatMetric(card.meta)}`;
  const context = stratumContextChips(card.detail);
  const status = card.percent == null ? "Sin meta" : card.percent >= 100 ? "Meta cubierta" : card.percent >= 70 ? "En ruta" : "Requiere impulso";
  const statusTone = card.percent == null ? "muted" : card.percent >= 100 ? "complete" : card.percent >= 70 ? "steady" : "low";
  return (
    <article className={`mon-strata-card is-${card.modality}`}>
      <header className="mon-strata-card-head">
        <div>
          <span className="mon-op-channel"><Icon size={13} /> {modalityLabel(card.modality)}</span>
          <strong>{card.title}</strong>
        </div>
      </header>
      <div className="mon-strata-visual">
        <div
          className={`mon-strata-dial is-${statusTone}`}
          style={{ "--dial": `${dialDegrees}deg` } as CSSProperties}
        >
          <div>
            <strong>{card.percentLabel}</strong>
          </div>
          <span className={`mon-strata-status is-${statusTone}`}>{status}</span>
        </div>
        <div className="mon-strata-score">
          <div className="mon-strata-metrics">
            <VisualMetric label={actualLabel} value={formatMetric(card.observed)} tone={card.observed == null ? "missing" : "ready"} />
            <VisualMetric label="Meta" value={formatMetric(card.meta)} tone={card.meta == null ? "missing" : "ready"} />
            <VisualMetric label="Faltan" value={missingLabel} tone={card.missing == null ? "missing" : card.missing > 0 ? "warning" : "ready"} />
            <VisualMetric label="Alertas" value={formatMetric(card.alerts)} tone={card.alerts > 0 ? "warning" : "ready"} />
          </div>
          <div className="mon-strata-chart" aria-label={card.meta == null ? "Participación de respuestas válidas" : "Avance sobre meta"}>
            <div className="mon-strata-chart-track">
              <span style={{ width: `${barWidth}%` }} />
            </div>
            <p>
              <span>{ratioLabel}</span>
              <strong>{card.percentLabel}</strong>
            </p>
          </div>
        </div>
      </div>
      <footer className="mon-strata-context">
        <div>
          {context.map((item) => <span key={item}>{item}</span>)}
        </div>
        <em>{card.support}</em>
      </footer>
    </article>
  );
}

function VisualMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ready" | "warning" | "missing";
}) {
  return (
    <div className={`mon-visual-metric is-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildStrataDashboardCards(
  sources: MonitoreoSource[],
  config: MonitoreoConfig,
  acreditacion: MonitoreoAcreditacion,
  dashboard: MonitoreoDashboard,
): StrataDashboardCard[] {
  const strata = buildOperationalStrata(sources, config, acreditacion);
  const totalValid = numberOrFallback(dashboard.kpis.valid, 0);
  return strata.map((stratum) => {
    const phase = phaseForStratum(stratum.title, config.strategy_phases);
    const source = sourceForPhase(phase ?? phaseLikeFromStratum(stratum), sources);
    const row = phase
      ? progressRowForPhase(phase, source, dashboard.progress)
      : progressRowForStratum(stratum, source, dashboard.progress);
    const observed = numberOrNull(row?.observado);
    const meta = numberOrNull(row?.meta) ?? stratum.meta;
    const missingRaw = numberOrNull(row?.faltante);
    const missing = missingRaw ?? (meta == null || observed == null ? null : Math.max(0, meta - observed));
    const percent = meta != null && observed != null && meta > 0
      ? Math.min(100, (observed / meta) * 100)
      : observed != null && totalValid > 0
        ? Math.min(100, (observed / totalValid) * 100)
        : null;
    const observedUse = observedCollectorUseForStratum(stratum, config.operational_model.link_collectors);
    const observedModality = modalityFromObservedUse(stratum, observedUse);
    const modality = phase?.modality ?? observedModality ?? inferModalityForStratum(stratum.title);
    return {
      id: stratum.id,
      title: stratum.title,
      detail: stratum.detail,
      modality,
      observed,
      meta,
      missing,
      percent,
      percentLabel: percent == null ? "S/D" : `${percent.toFixed(0)}%`,
      alerts: countAlertsForStratum(dashboard.inconsistencies, stratum, source),
      support: supportLabelForModality(modality, config),
    };
  });
}

function phaseForStratum(title: string, phases: MonitoreoStrategyPhase[]) {
  const normalized = normalizeMatch(title);
  return phases.find((phase) => {
    const phaseTitle = normalizeMatch(phase.stratum);
    return phaseTitle && (phaseTitle === normalized || phaseTitle.includes(normalized) || normalized.includes(phaseTitle));
  }) ?? null;
}

function phaseMatchesStratum(phase: MonitoreoStrategyPhase, title: string) {
  const normalized = normalizeMatch(title);
  const phaseTitle = normalizeMatch(phase.stratum);
  return Boolean(phaseTitle && normalized && (
    phaseTitle === normalized ||
    phaseTitle.includes(normalized) ||
    normalized.includes(phaseTitle)
  ));
}

function phaseEntriesForStratum(title: string, phases: MonitoreoStrategyPhase[]) {
  return phases
    .map((phase, index) => ({ phase, index }))
    .filter((entry) => phaseMatchesStratum(entry.phase, title))
    .sort((a, b) => {
      const aWeek = a.phase.start_week ?? Number.MAX_SAFE_INTEGER - a.index;
      const bWeek = b.phase.start_week ?? Number.MAX_SAFE_INTEGER - b.index;
      return aWeek - bWeek || a.index - b.index;
    });
}

function defaultPhaseForStratum(
  stratum: OperationalStratum,
  modality: MonitoreoStrategyPhase["modality"],
  patch: Partial<MonitoreoStrategyPhase> = {},
): MonitoreoStrategyPhase {
  return {
    ...DEFAULT_STRATEGY_PHASE,
    id: `fase-${stratum.id}-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    stratum: stratum.title,
    modality,
    start_week: patch.start_week ?? 1,
    end_week: patch.end_week ?? null,
    target_rule: DEFAULT_SCOPE_BY_MODALITY[modality],
    kpi_focus: KPI_FOCUS_OPTIONS_BY_MODALITY[modality].slice(0, 3),
    kpi_modules: DEFAULT_KPI_MODULES_BY_MODALITY[modality],
    ...patch,
  };
}

function phaseWithModality(
  phase: MonitoreoStrategyPhase,
  stratum: OperationalStratum,
  modality: MonitoreoStrategyPhase["modality"],
) {
  return {
    ...phase,
    stratum: phase.stratum || stratum.title,
    modality,
    target_rule: DEFAULT_SCOPE_BY_MODALITY[modality],
    kpi_focus: KPI_FOCUS_OPTIONS_BY_MODALITY[modality].slice(0, 3),
    kpi_modules: DEFAULT_KPI_MODULES_BY_MODALITY[modality],
  };
}

function observedCollectorUseForStratum(stratum: OperationalStratum, collectors: MonitoreoLinkCollector[]) {
  const sourceId = stratum.source_id;
  const title = normalizeMatch(stratum.title);
  const matches = collectors.filter((collector) => (
    (sourceId && collector.source_id === sourceId) ||
    normalizeMatch(collector.source_label) === title ||
    normalizeMatch(collector.source_label).includes(title) ||
    title.includes(normalizeMatch(collector.source_label))
  ));
  const use = matches.find((collector) => collector.operational_use !== "sin_clasificar")?.operational_use
    ?? matches[0]?.operational_use
    ?? "";
  if (!use) return null;
  return COLLECTOR_USE_OPTIONS.find((option) => option.value === use) ?? null;
}

function modalityFromObservedUse(stratum: OperationalStratum, observed: { value: MonitoreoCollectorUse; modality: MonitoreoStrategyPhase["modality"] } | null) {
  if (!observed) return null;
  if (observed.value === "enlace_abierto" && /estudiant|alumn/i.test(normalizeMatch(stratum.title))) {
    return "presencial";
  }
  return observed.modality;
}

function phaseLikeFromStratum(stratum: OperationalStratum): MonitoreoStrategyPhase {
  return {
    id: stratum.id,
    stratum: stratum.title,
    modality: inferModalityForStratum(stratum.title),
    start_week: null,
    end_week: null,
    target_rule: "",
    kpi_focus: [],
    kpi_modules: [],
    breakdown_vars: [],
    attempts_var: "",
    outcome_var: "",
  };
}

function progressRowForStratum(
  stratum: OperationalStratum,
  source: MonitoreoSource | null,
  rows: MonitoreoRow[],
) {
  const candidates = [
    stratum.title,
    stratum.detail,
    source?.label,
    ...sourceDimensionEntries(source?.dimensions).map(([, value]) => value),
  ].map(normalizeMatch).filter(Boolean);
  return rows.find((row) => Object.values(row).some((value) => {
    const normalized = normalizeMatch(value);
    return normalized && candidates.some((candidate) => candidate === normalized || candidate.includes(normalized) || normalized.includes(candidate));
  })) ?? null;
}

function countAlertsForStratum(
  rows: MonitoreoRow[],
  stratum: OperationalStratum,
  source: MonitoreoSource | null,
) {
  const candidates = [
    stratum.title,
    source?.label,
    ...sourceDimensionEntries(source?.dimensions).map(([, value]) => value),
  ].map(normalizeMatch).filter(Boolean);
  return rows.filter((row) => Object.values(row).some((value) => {
    const normalized = normalizeMatch(value);
    return normalized && candidates.some((candidate) => candidate === normalized || candidate.includes(normalized) || normalized.includes(candidate));
  })).length;
}

function actualLabelForModality(value: MonitoreoStrategyPhase["modality"] | string) {
  if (value === "presencial") return "QR válidos";
  if (value === "telefono") return "Efectivas";
  return "Respondidas";
}

function supportLabelForModality(value: MonitoreoStrategyPhase["modality"], config: MonitoreoConfig) {
  if (value === "telefono") {
    return config.enumerator_var ? `Equipo: ${config.enumerator_var}` : "Barrido pendiente";
  }
  if (value === "presencial") {
    return "QR presencial";
  }
  if (value === "email") {
    return "Respuesta de plataforma";
  }
  return modalityDataSupportLabel(value);
}

function inferModalityForStratum(title: string): MonitoreoStrategyPhase["modality"] {
  const normalized = normalizeMatch(title);
  if (normalized.includes("egres")) return "telefono";
  if (normalized.includes("estudiant") || normalized.includes("alumn")) return "presencial";
  return "email";
}

function formatMetric(value: number | null) {
  return value == null ? "S/D" : value.toLocaleString("es-PE");
}

function stratumContextChips(detail: string) {
  const parts = detail
    .split(";")
    .map((item) => item.trim().replace(/\.$/, ""))
    .filter(Boolean);
  const compact = parts.map((item) => {
    const normalized = item
      .replace(/^Universo/i, "Universo")
      .replace(/^meta minima/i, "Meta min.")
      .replace(/^recomendada/i, "Recom.")
      .replace(/^tecnica/i, "Tecnica:")
      .replace(/^control/i, "Control:");
    return normalized.length > 34 ? `${normalized.slice(0, 31)}...` : normalized;
  });
  return compact.slice(0, 4);
}

function OperationalFollowupPanel({
  sources,
  config,
  dashboard,
  nRows,
}: {
  sources: MonitoreoSource[];
  config: MonitoreoConfig;
  dashboard: MonitoreoDashboard | null;
  nRows: number;
}) {
  const activeSources = sources.filter((source) => source.enabled);
  const targets = [
    ...config.goals.map((goal, index) => ({ id: `goal-${index}`, meta: goal.meta })),
    ...config.operational_model.targets.map((target) => ({ id: target.id, meta: target.meta })),
  ].filter((target) => Number.isFinite(target.meta) && Number(target.meta) > 0);
  const valid = numberOrFallback(dashboard?.kpis.valid, 0);
  const total = dashboard ? numberOrFallback(dashboard.kpis.total, nRows) : nRows;
  const hasEnumerator = Boolean(config.enumerator_var);
  const kpiBlocks = buildOperationalKpiBlocks(config, sources, dashboard);

  return (
    <div className="mon-operational-followup">
      <Panel
        className="mon-fill-panel mon-followup-panel"
        eyebrow="Seguimiento operativo"
        title={<span className="mon-title-icon"><Route size={16} /> Avance por modelo local</span>}
      >
        <div className="mon-followup-overview">
          <div className="mon-followup-card">
            <span>Fuentes</span>
            <strong>{activeSources.length}/{sources.length}</strong>
            <em>{activeSources.map((source) => source.label).slice(0, 2).join(" · ") || "Sin fuente activa"}</em>
          </div>
          <div className="mon-followup-card">
            <span>Respuestas</span>
            <strong>{valid}/{total}</strong>
            <em>{dashboard ? "Válidas sobre sincronizadas" : "Sin sincronizar"}</em>
          </div>
          <div className="mon-followup-card">
            <span>Metas</span>
            <strong>{targets.length || "S/D"}</strong>
            <em>{targets.length ? "Metas configuradas" : "Pendiente definir cuotas"}</em>
          </div>
          <div className="mon-followup-card">
            <span>Equipo</span>
            <strong>{hasEnumerator ? config.enumerator_var : "S/D"}</strong>
            <em>{hasEnumerator ? "Variable asignada" : "Requiere barrido o responsable"}</em>
          </div>
        </div>
      </Panel>

      <div className="mon-stage-table-grid">
        <TablePanel title="Cortes sincronizados" icon={<Target size={16} />} rows={dashboard?.progress ?? []} />
        <OperationalKpiPanel blocks={kpiBlocks} />
      </div>
    </div>
  );
}

type OperationalKpiStatus = "ready" | "warning" | "missing";

type OperationalKpiItem = {
  label: string;
  value: string;
  hint: string;
  status: OperationalKpiStatus;
};

type OperationalKpiBlock = {
  id: string;
  title: string;
  detail: string;
  modality: MonitoreoStrategyPhase["modality"];
  items: OperationalKpiItem[];
};

function OperationalKpiPanel({ blocks }: { blocks: OperationalKpiBlock[] }) {
  return (
    <Panel
      className="mon-fill-panel mon-operational-kpi-panel"
      eyebrow="Seguimiento"
      title={<span className="mon-title-icon"><ListChecks size={16} /> Indicadores por modalidad</span>}
    >
      <div className="mon-op-kpi-grid">
        {blocks.length ? blocks.map((block) => (
          <OperationalKpiBlockCard key={block.id} block={block} />
        )) : (
          <EmptyState
            icon={<Route size={18} />}
            title="Sin mecanismos configurados"
            hint="Define cómo se recoge información por cada corte para activar indicadores."
            variant="inline"
          />
        )}
      </div>
    </Panel>
  );
}

function OperationalKpiBlockCard({ block }: { block: OperationalKpiBlock }) {
  const Icon = modalityIcon(block.modality);
  return (
    <article className={`mon-op-kpi-block is-${block.modality}`}>
      <header className="mon-op-kpi-head">
        <div>
          <span className="mon-op-channel"><Icon size={13} /> {modalityLabel(block.modality)}</span>
          <strong>{block.title}</strong>
          <em>{block.detail}</em>
        </div>
      </header>
      <div className="mon-op-kpi-metrics">
        {block.items.map((item) => (
          <div key={item.label} className={`mon-op-metric is-${item.status}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <em>{item.hint}</em>
          </div>
        ))}
      </div>
    </article>
  );
}

function buildOperationalKpiBlocks(
  config: MonitoreoConfig,
  sources: MonitoreoSource[],
  dashboard: MonitoreoDashboard | null,
): OperationalKpiBlock[] {
  return config.strategy_phases.map((phase, index) => {
    const source = sourceForPhase(phase, sources);
    const row = progressRowForPhase(phase, source, dashboard?.progress ?? []);
    const observed = numberOrNull(row?.observado);
    const configuredMeta = source ? goalForDimensions(config.goals, source.dimensions) : null;
    const meta = numberOrNull(row?.meta) ?? configuredMeta;
    const missingRaw = numberOrNull(row?.faltante);
    const missing = missingRaw ?? (meta == null || observed == null ? null : Math.max(0, meta - observed));
    const completePct = meta == null || observed == null || meta <= 0 ? null : Math.min(100, (observed / meta) * 100);
    const roster = config.operational_model.cases.roster_source;
    const hasEnumerator = Boolean(config.enumerator_var);
    const hasOperationalRoster = roster === "external_local" || roster === "uploaded";
    const validValue = observed == null ? "S/D" : observed.toLocaleString("es-PE");
    const metaValue = meta == null ? "S/D" : meta.toLocaleString("es-PE");
    const missingValue = missing == null ? "Definir meta" : missing.toLocaleString("es-PE");
    const progressValue = completePct == null ? "S/D" : `${completePct.toFixed(0)}%`;

    const baseItems: OperationalKpiItem[] = [
      {
        label: phase.modality === "presencial" ? "QR válidos" : phase.modality === "telefono" ? "Efectivas" : "Respondidas",
        value: validValue,
        hint: "respuestas completas",
        status: observed == null ? "missing" : "ready",
      },
      {
        label: "Meta",
        value: metaValue,
        hint: "cuota del corte",
        status: meta == null ? "missing" : "ready",
      },
    ];

    const modalityItems: OperationalKpiItem[] = (() => {
      if (phase.modality === "telefono") {
        return [
          {
            label: "Faltante",
            value: missingValue,
            hint: "para cierre telefónico",
            status: missing == null ? "missing" : missing > 0 ? "warning" : "ready",
          },
          {
            label: "No efectivos",
            value: phase.attempts_var && phase.outcome_var ? "Config." : "S/D",
            hint: "requiere intentos/status de barrido",
            status: phase.attempts_var && phase.outcome_var ? "ready" : "missing",
          },
          {
            label: "Equipo",
            value: hasEnumerator ? "Listo" : "S/D",
            hint: hasEnumerator ? config.enumerator_var : "requiere responsable",
            status: hasEnumerator ? "ready" : "missing",
          },
        ];
      }
      if (phase.modality === "presencial") {
        return [
          {
            label: "Avance",
            value: progressValue,
            hint: "sobre meta del corte",
            status: completePct == null ? "missing" : completePct >= 100 ? "ready" : "warning",
          },
          {
            label: "Control local",
            value: hasOperationalRoster ? "Listo" : "S/D",
            hint: "visita, responsable o evidencia",
            status: hasOperationalRoster ? "ready" : "missing",
          },
          {
            label: "Faltante",
            value: missingValue,
            hint: "pendiente presencial/QR",
            status: missing == null ? "missing" : missing > 0 ? "warning" : "ready",
          },
        ];
      }
      if (phase.modality === "email" || phase.modality === "sms" || phase.modality === "whatsapp") {
        return [
          {
            label: "Avance",
            value: progressValue,
            hint: "sobre meta del corte",
            status: completePct == null ? "missing" : completePct >= 100 ? "ready" : "warning",
          },
          {
            label: "Universo",
            value: hasOperationalRoster ? "Listo" : "S/D",
            hint: "base de contactos/envios",
            status: hasOperationalRoster ? "ready" : "missing",
          },
          {
            label: "Faltante",
            value: missingValue,
            hint: "pendiente por cuota",
            status: missing == null ? "missing" : missing > 0 ? "warning" : "ready",
          },
        ];
      }
      return [
        {
          label: "Avance",
          value: progressValue,
          hint: "sobre meta del corte",
          status: completePct == null ? "missing" : completePct >= 100 ? "ready" : "warning",
        },
        {
          label: "Soporte",
          value: modalityDataSupportLabel(phase.modality),
          hint: "según modalidad activa",
          status: "warning",
        },
      ];
    })();

    return {
      id: phase.id || `phase-${index}`,
      title: source?.label || phase.stratum || "Corte operativo",
      detail: phaseWeekLabel(phase),
      modality: phase.modality,
      items: [...baseItems, ...modalityItems].slice(0, 5),
    };
  });
}

function sourceForPhase(phase: MonitoreoStrategyPhase, sources: MonitoreoSource[]) {
  const needle = normalizeMatch(phase.stratum);
  if (!needle) return null;
  return sources.find((source) => normalizeMatch(source.label) === needle)
    ?? sources.find((source) => sourceDimensionEntries(source.dimensions)
      .some(([, value]) => {
        const dimension = normalizeMatch(value);
        return dimension && (dimension === needle || needle.includes(dimension));
      }))
    ?? null;
}

function progressRowForPhase(
  phase: MonitoreoStrategyPhase,
  source: MonitoreoSource | null,
  rows: MonitoreoRow[],
) {
  const candidates = [
    phase.stratum,
    source?.label,
    ...sourceDimensionEntries(source?.dimensions).map(([, value]) => value),
  ].map(normalizeMatch).filter(Boolean);
  if (!candidates.length) return null;
  return rows.find((row) => Object.values(row).some((value) => {
    const normalized = normalizeMatch(value);
    return normalized && candidates.some((candidate) => candidate === normalized || candidate.includes(normalized) || normalized.includes(candidate));
  })) ?? null;
}

function normalizeMatch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function modalityIcon(value: MonitoreoStrategyPhase["modality"] | string) {
  switch (value) {
    case "telefono":
      return PhoneCall;
    case "presencial":
      return QrCode;
    case "email":
      return Mail;
    case "whatsapp":
    case "sms":
      return ContactRound;
    default:
      return Route;
  }
}

type OperationalStratum = {
  id: string;
  title: string;
  source: string;
  source_id: string;
  meta: number | null;
  detail: string;
  modalities: string[];
  filters: Record<string, string>;
};

function buildOperationalStrata(
  sources: MonitoreoSource[],
  config: MonitoreoConfig,
  acreditacion: MonitoreoAcreditacion,
): OperationalStratum[] {
  const out: OperationalStratum[] = [];
  const seenTitles = new Set<string>();
  for (const stratum of config.operational_model.strata) {
    if (!stratum.label && !stratum.variable && !stratum.value) continue;
    const source = stratum.source_id
      ? sources.find((item) => item.id === stratum.source_id)?.label ?? stratum.source_id
      : "Modelo operativo";
    const title = stratum.label || stratum.value || stratum.variable || "Corte operativo";
    seenTitles.add(title.trim().toLocaleLowerCase());
    const filters = stratum.variable && stratum.value ? { [stratum.variable]: stratum.value } : {};
    out.push({
      id: `model-${stratum.id}`,
      title,
      source,
      source_id: stratum.source_id,
      meta: goalForDimensions(config.goals, filters),
      detail: stratum.notes || (stratum.variable ? `${dimensionLabel(stratum.variable.replace(/^dim_/, ""))}: ${stratum.value || "S/D"}` : "Corte operativo"),
      modalities: [],
      filters,
    });
  }
  for (const src of sources) {
    const title = src.label || src.id;
    if (seenTitles.has(title.trim().toLocaleLowerCase())) continue;
    const dims = sourceDimensionEntries(src.dimensions);
    const detail = dims.length
      ? dims.map(([key, value]) => `${dimensionLabel(key)}: ${value}`).join(" · ")
      : src.kind === "kobo" ? "KoboToolbox" : "SurveyMonkey";
    const meta = goalForDimensions(config.goals, src.dimensions);
    out.push({
      id: `source-${src.id}`,
      title,
      source: src.kind === "kobo" ? "KoboToolbox" : "SurveyMonkey",
      source_id: src.id,
      meta,
      detail,
      modalities: [],
      filters: goalFiltersFromDimensions(src.dimensions),
    });
  }
  for (const comp of acreditacion.componentes ?? []) {
    out.push({
      id: `acr-${comp.id}`,
      title: comp.actor,
      source: acreditacion.estudio.titulo,
      source_id: comp.id,
      meta: comp.meta.n_objetivo,
      detail: comp.tecnica || comp.meta.tipo || "Corte operativo",
      modalities: modalitiesFromIntentos(comp.seguimiento.intentos_canal),
      filters: { actor: comp.actor },
    });
  }
  for (const goal of config.goals) {
    const label = goalLabel(goal);
    const goalValues = Object.values(goal.filters).map(String);
    const covered = out.some((item) => (
      normalizeMatch(item.title) === normalizeMatch(label) ||
      goalValues.some((value) => {
        const normalized = normalizeMatch(value);
        return normalized && (
          normalizeMatch(item.title).includes(normalized) ||
          normalizeMatch(item.detail).includes(normalized)
        );
      })
    ));
    if (!covered) {
      out.push({
        id: `goal-${label}`,
        title: label,
        source: "Meta manual",
        source_id: "",
        meta: goal.meta,
        detail: Object.keys(goal.filters).map(dimensionLabel).join(" + ") || "Sin filtro",
        modalities: [],
        filters: goal.filters,
      });
    }
  }
  return out.slice(0, 12);
}

function goalFiltersFromDimensions(dimensions: Record<string, string> | undefined) {
  return Object.fromEntries(
    sourceDimensionEntries(dimensions).map(([key, value]) => [
      key.startsWith("dim_") ? key : `dim_${key}`,
      value,
    ]),
  );
}

function goalForDimensions(goals: MonitoreoGoal[], dimensions: Record<string, string> | undefined) {
  const entries = sourceDimensionEntries(dimensions);
  const match = goals.find((goal) => entries.some(([key, value]) => {
    const candidates = [key, `dim_${key}`];
    return candidates.some((candidate) => goal.filters[candidate] === value);
  }));
  return match?.meta ?? null;
}

function goalLabel(goal: MonitoreoGoal) {
  const entries = Object.entries(goal.filters);
  if (!entries.length) return "Meta general";
  return entries.map(([key, value]) => `${dimensionLabel(key.replace(/^dim_/, ""))}: ${value}`).join(" · ");
}

function modalitiesFromIntentos(intentos: MonitoreoAcreditacionIntentos) {
  return CANALES.filter((canal) => Number(intentos[canal] ?? 0) > 0);
}

function modalityLabel(value: MonitoreoStrategyPhase["modality"] | string) {
  const labels: Record<string, string> = {
    email: "Correo",
    whatsapp: "WhatsApp",
    sms: "SMS",
    telefono: "Teléfono",
    presencial: "Presencial",
    mixto: "Mixto",
  };
  return labels[value] ?? value;
}

function rosterSourceOption(value: MonitoreoOperationalCases["roster_source"]) {
  return ROSTER_SOURCE_OPTIONS.find((option) => option.value === value) ?? ROSTER_SOURCE_OPTIONS[0];
}

function modalityDataNeed(value: MonitoreoStrategyPhase["modality"] | string) {
  switch (value) {
    case "telefono":
      return "Teléfono se beneficia de base de barrido: responsable, status, intentos, fecha y observación.";
    case "presencial":
      return "Presencial puede usar base operativa local para visitas, responsable, estado y evidencias.";
    case "email":
      return "Correo suele partir de universo/contactos y respuesta de plataforma; no necesita barrido caso a caso.";
    case "whatsapp":
      return "WhatsApp puede combinar universo/contactos con eventos de envio, contacto y respuesta.";
    case "sms":
      return "SMS prioriza universo/contactos, entrega y respuesta; los KPIs de operador suelen ser secundarios.";
    default:
      return "Mixto combina capas: plataforma, universo y base operativa según la modalidad activa.";
  }
}

function modalityDataSupportLabel(value: MonitoreoStrategyPhase["modality"] | string) {
  switch (value) {
    case "telefono":
      return "Falta barrido";
    case "presencial":
      return "Falta base operativa";
    case "email":
    case "whatsapp":
    case "sms":
      return "Plataforma/contactos";
    default:
      return "Modelo mixto";
  }
}

function phaseWeekLabel(phase: MonitoreoStrategyPhase) {
  if (!phase.start_week && !phase.end_week) return "Sin semana";
  if (phase.start_week === phase.end_week || !phase.end_week) return `Semana ${phase.start_week}`;
  return `Semanas ${phase.start_week}-${phase.end_week}`;
}

function kpiModuleLabel(key: string) {
  return KPI_MODULES.find((item) => item.key === key)?.label ?? key;
}

function scopeOptionsForModality(modality: MonitoreoStrategyPhase["modality"]) {
  return STRATEGY_SCOPE_OPTIONS.filter((option) => option.modalities.includes(modality));
}

function scopeLabel(value: string, modality: MonitoreoStrategyPhase["modality"]) {
  return scopeOptionsForModality(modality).find((option) => option.value === value)?.label
    ?? STRATEGY_SCOPE_OPTIONS.find((option) => option.value === value)?.label
    ?? (value.length > 42 ? "Regla guardada" : value);
}

function kpiFocusLabel(value: string) {
  const pretty = KPI_FOCUS_LABELS[value] ?? value.replace(/_/g, " ");
  return pretty.length > 26 ? `${pretty.slice(0, 23)}...` : pretty;
}

function focusOptionsForModality(modality: MonitoreoStrategyPhase["modality"], selected: string[]) {
  const base = KPI_FOCUS_OPTIONS_BY_MODALITY[modality] ?? [];
  return Array.from(new Set([...base, ...selected]));
}

function finalStateLabel(value: string) {
  return FINAL_STATE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function outcomeLabel(value: string, events: MonitoreoOperationalEvent[] = []) {
  const eventLabel = events.find((event) => event.outcome === value)?.label;
  if (eventLabel) return prettyOperationalLabel(eventLabel);
  return OUTCOME_PRESETS.find((option) => option.value === value)?.label ?? prettyOperationalLabel(value);
}

function outcomeOptions(events: MonitoreoOperationalEvent[], extras: string[] = []) {
  const out: Array<{ value: string; label: string }> = [];
  const seen = new Set<string>();
  const push = (value: string, label: string) => {
    const clean = value.trim();
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    out.push({ value: clean, label });
  };
  for (const event of events) push(event.outcome, prettyOperationalLabel(event.label || outcomeLabel(event.outcome)));
  for (const option of OUTCOME_PRESETS) push(option.value, option.label);
  for (const extra of extras) push(extra, outcomeLabel(extra, events));
  return out;
}

function prettyOperationalLabel(value: string) {
  if (!value) return "";
  return value
    .replace(/\bNumero\b/g, "Número")
    .replace(/\bnumero\b/g, "número")
    .replace(/\bdespues\b/g, "después")
    .replace(/\bvalida\b/g, "válida")
    .replace(/\bvalidos\b/g, "válidos")
    .replace(/\btelefono\b/g, "teléfono")
    .replace(/\bTelefono\b/g, "Teléfono");
}

function withCurrentOption(options: string[], value: string) {
  const clean = value.trim();
  if (!clean || options.includes(clean)) return options;
  return [...options, clean];
}

function strategyPhaseOptionLabel(phase: MonitoreoStrategyPhase) {
  const stratum = phase.stratum?.trim();
  const modality = modalityLabel(phase.modality);
  if (!stratum) return modality;
  return `${stratum} · ${modality}`;
}

function compactListLabel(values: string[], limit = 2) {
  const clean = values.map((value) => value.trim()).filter(Boolean);
  if (!clean.length) return "";
  if (clean.length <= limit) return clean.join(", ");
  return `${clean.slice(0, limit).join(", ")} +${clean.length - limit}`;
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function phaseOutputSummary(phase: MonitoreoStrategyPhase, config: MonitoreoConfig) {
  const modules = phase.kpi_modules.map(kpiModuleLabel);
  const focus = phase.kpi_focus.length ? `; foco: ${phase.kpi_focus.map(kpiFocusLabel).join(", ")}` : "";
  const scope = phase.target_rule ? `; alcance: ${scopeLabel(phase.target_rule, phase.modality)}` : "";
  const breakdown = phase.breakdown_vars.length ? `; desgloses: ${phase.breakdown_vars.join(", ")}` : "";
  const operator = config.enumerator_var ? ` y operador (${config.enumerator_var})` : "";
  const attempts = phase.attempts_var ? `; intentos: ${phase.attempts_var}` : "";
  const outcome = phase.outcome_var ? `; resultado: ${phase.outcome_var}` : "";
  const base = modules.length ? modules.join(", ") : "avance basico";
  return `${modalityLabel(phase.modality)}: ${base}${scope}${focus}${breakdown}${operator}${attempts}${outcome}.`;
}

function OperationalModelPanel({
  mode,
  onModeChange,
  sources,
  config,
  acreditacion,
  variables,
  setConfig,
  onConfigPersisted,
}: {
  mode: OperationalModelMode;
  onModeChange: (mode: OperationalModelMode) => void;
  sources: MonitoreoSource[];
  config: MonitoreoConfig;
  acreditacion: MonitoreoAcreditacion;
  variables: MonitoreoVariable[];
  setConfig: (next: MonitoreoConfig) => void;
  onConfigPersisted: (next: MonitoreoState) => void;
}) {
  const strata = buildOperationalStrata(sources, config, acreditacion);
  return (
    <div className="mon-stage mon-stage--model">
      <StageModeBar
        options={OPERATIONAL_MODEL_MODES}
        active={mode}
        onChange={onModeChange}
        summary={
          <>
            <span>{sources.filter((source) => source.enabled).length}/{sources.length} fuentes</span>
            <span>{strata.length} cortes</span>
            <span>{config.strategy_phases.length} mecanismos</span>
          </>
        }
      />
      <div className={`mon-model-stage-grid${mode === "estructura" || mode === "casos" || mode === "enlaces" || mode === "reglas" ? " is-wide" : ""}`}>
        <Panel
          className="mon-fill-panel mon-model-panel"
          eyebrow="Modelo operativo"
          title={<span className="mon-title-icon"><ListChecks size={16} /> {OPERATIONAL_MODEL_MODES.find((item) => item.key === mode)?.label}</span>}
        >
          <div className="mon-model-panel-body">
            {mode === "estrategias" && (
              <div className="mon-model-single">
                <StrategyPlanner
                  config={config}
                  setConfig={setConfig}
                  strata={strata}
                  variables={variables}
                />
              </div>
            )}

            {mode === "estructura" && (
              <div className="mon-model-two-column mon-model-two-column--structure">
              <div className="mon-model-block mon-model-block--detected">
                <div className="mon-model-block-head">
                  <span>Cortes detectados</span>
                  <strong>{strata.length || "Sin cortes"}</strong>
                </div>
                <div className={`mon-strata-list mon-contained-list${strata.length ? "" : " is-empty"}`}>
                  {strata.length ? strata.map((item) => (
                    <div key={item.id} className="mon-stratum-card">
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.source}</span>
                      </div>
                      <em>{item.meta == null ? "Meta S/D" : `${item.meta.toLocaleString("es-PE")} casos`}</em>
                      <p>{item.detail}</p>
                      {item.modalities.length > 0 && (
                        <div className="mon-modality-chips">
                          {item.modalities.map((modality) => <span key={modality}>{modalityLabel(modality)}</span>)}
                        </div>
                      )}
                    </div>
                  )) : (
                    <div className="mon-sm-empty">Conecta fuentes o agrega cortes para completar la estructura.</div>
                  )}
                </div>
              </div>
                <OperationalContractPanel
                  mode={mode}
                  sources={sources}
                  config={config}
                  setConfig={setConfig}
                  variables={variables}
                  strata={strata}
                  onConfigPersisted={onConfigPersisted}
                />
              </div>
            )}

            {mode !== "estrategias" && mode !== "estructura" && (
              <OperationalContractPanel
                mode={mode}
                sources={sources}
                config={config}
                setConfig={setConfig}
                variables={variables}
                strata={strata}
                onConfigPersisted={onConfigPersisted}
              />
            )}
          </div>
        </Panel>
        {mode !== "estructura" && mode !== "casos" && mode !== "enlaces" && mode !== "reglas" && (
          <ModelInspector
            mode={mode}
            config={config}
            setConfig={setConfig}
            variables={variables}
            strata={strata}
          />
        )}
      </div>
    </div>
  );
}

function OperationalFlowSummary({
  sources,
  activeSources,
  strata,
  goals,
  cases,
  phases,
  variables,
  alerts,
}: {
  sources: number;
  activeSources: number;
  strata: number;
  goals: number;
  cases: MonitoreoOperationalCases;
  phases: number;
  variables: number;
  alerts: number;
}) {
  return (
    <div className="mon-operational-flow">
      <ModelStep icon={<PlugZap size={15} />} label="Fuentes" value={`${activeSources}/${sources} activas`} />
      <ModelStep icon={<Layers3 size={15} />} label="Cortes y metas" value={`${strata} cortes · ${goals} metas`} />
      <ModelStep icon={<Route size={15} />} label="Mecanismos" value={`${phases} configurados`} />
      <ModelStep icon={<ContactRound size={15} />} label="Base de barrido" value={cases.enabled ? (cases.case_id_var || "Activa") : "Opcional"} />
      <ModelStep icon={<SlidersHorizontal size={15} />} label="Estados" value={`${variables} variables`} />
      <ModelStep icon={<AlertTriangle size={15} />} label="Alertas" value={`${alerts} alertas`} />
    </div>
  );
}

function OperationalContractPanel({
  mode,
  sources,
  config,
  setConfig,
  variables,
  strata,
  onConfigPersisted,
}: {
  mode: OperationalModelMode;
  sources: MonitoreoSource[];
  config: MonitoreoConfig;
  setConfig: (next: MonitoreoConfig) => void;
  variables: MonitoreoVariable[];
  strata: OperationalStratum[];
  onConfigPersisted: (next: MonitoreoState) => void;
}) {
  const model = config.operational_model;
  const variableNames = variables.map((variable) => variable.name);
  const sourceOptions = sources.map((source) => ({ id: source.id, label: source.label || source.id }));
  const showStructure = mode === "estructura";
  const showLinks = mode === "enlaces";
  const showCases = mode === "casos";
  const showStrategies = mode === "estrategias";
  const showRules = mode === "reglas";
  const strategyLabelOptions = Array.from(new Set([
    ...STRATEGY_LABEL_OPTIONS,
    ...config.strategy_phases.map(strategyPhaseOptionLabel).filter(Boolean),
    ...strata.map((item) => `Seguimiento · ${item.title}`),
  ]));

  function setModel(patch: Partial<MonitoreoOperationalModel>) {
    setConfig({
      ...config,
      operational_model: mergeOperationalModel({ ...model, ...patch }),
    });
  }

  function updateCases(patch: Partial<MonitoreoOperationalCases>) {
    setModel({ cases: { ...model.cases, ...patch } });
  }

  function updateStratum(index: number, patch: Partial<MonitoreoOperationalStratum>) {
    setModel({
      strata: model.strata.map((item, i) => i === index ? { ...item, ...patch } : item),
    });
  }

  function addStratum() {
    setModel({
      strata: [
        ...model.strata,
        {
          id: `corte-${Date.now()}`,
          label: "",
          source_id: sourceOptions[0]?.id ?? "",
          variable: variableNames[0] ?? "",
          value: "",
          notes: "",
        },
      ],
    });
  }

  function updateStrategy(index: number, patch: Partial<MonitoreoOperationalStrategy>) {
    setModel({
      strategies: model.strategies.map((item, i) => i === index ? { ...item, ...patch } : item),
    });
  }

  function addStrategy() {
    setModel({
      strategies: [
        ...model.strategies,
        {
          id: `estrategia-${Date.now()}`,
          label: "",
          objective: "",
          owner: "",
          status: "draft",
        },
      ],
    });
  }

  function updateEvent(index: number, patch: Partial<MonitoreoOperationalEvent>) {
    setModel({
      events: model.events.map((item, i) => i === index ? { ...item, ...patch } : item),
    });
  }

  function updateRule(index: number, patch: Partial<MonitoreoStateRule>) {
    setModel({
      state_rules: model.state_rules.map((item, i) => i === index ? { ...item, ...patch } : item),
    });
  }

  return (
    <div className="mon-operational-contract">
      <div className="mon-contract-head">
        <div>
          <span className="pulso-section-eyebrow">Configuración operativa</span>
          <strong>
            {showStructure && "Metas y mecanismos de recolección"}
            {showLinks && "Enlaces, envíos y links"}
            {showCases && "Base de barrido"}
            {showStrategies && "Calendario de recolección"}
            {showRules && "Estados que cuentan como avance"}
          </strong>
        </div>
        <span>Local al proyecto</span>
      </div>

      <div className={`mon-contract-grid${showRules ? " mon-contract-grid--rules" : ""}${showLinks ? " mon-contract-grid--links" : ""}${showCases ? " mon-contract-grid--cases" : ""}`}>
        {showStructure && (
        <div className="mon-contract-block mon-contract-block--wide">
          <div className="mon-contract-block-head">
            <span>Cortes, metas y mecanismos</span>
            <span className="mon-contract-counter">{config.goals.length}/{strata.length} configuradas</span>
          </div>
          <StructureTargetsEditor
            strata={strata}
            goals={config.goals}
            phases={config.strategy_phases}
            collectors={model.link_collectors}
            onChange={(goals) => setConfig({ ...config, goals, objetivo_total: null })}
            onPhasesChange={(strategy_phases) => setConfig({ ...config, strategy_phases })}
          />
        </div>
        )}

        {showCases && (
        <div className="mon-contract-block">
          <div className="mon-contract-block-head">
            <span>Base de barrido</span>
            <label className="mon-switch-line">
              <input
                type="checkbox"
                checked={model.cases.enabled}
                onChange={(e) => updateCases({ enabled: e.target.checked })}
              />
              <span>Usar barrido</span>
            </label>
          </div>
          <div className="mon-cases-body">
            <div className="mon-case-setup">
              <div className="mon-case-grid">
                <VariableSelect
                  label="Identificador"
                  value={model.cases.case_id_var}
                  variables={variableNames}
                  onChange={(value) => updateCases({ case_id_var: value })}
                />
                <VariableSelect
                  label="Persona o caso"
                  value={model.cases.person_label_var}
                  variables={variableNames}
                  onChange={(value) => updateCases({ person_label_var: value })}
                />
                <VariableSelect
                  label="Estado reportado"
                  value={model.cases.status_var}
                  variables={variableNames}
                  onChange={(value) => updateCases({ status_var: value })}
                />
                <label>
                  <span>Origen del barrido</span>
                  <select
                    value={model.cases.roster_source}
                    onChange={(e) => updateCases({ roster_source: e.target.value as MonitoreoOperationalCases["roster_source"] })}
                  >
                    {ROSTER_SOURCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mon-case-chip-grid">
                <VariableChipSelector
                  label="Campos de contacto"
                  values={model.cases.contact_vars}
                  variables={variableNames}
                  onChange={(values) => updateCases({ contact_vars: values })}
                />
                <VariableChipSelector
                  label="Campos sensibles"
                  values={model.cases.sensitive_vars}
                  variables={variableNames}
                  onChange={(values) => updateCases({ sensitive_vars: values })}
                />
              </div>
            </div>
            <div className="mon-data-layer-grid" aria-label="Capas de datos operativos">
              {DATA_LAYER_GUIDE.map((layer) => (
                <button
                  key={layer.key}
                  type="button"
                  className={`mon-data-layer-card${model.cases.roster_source === layer.key ? " is-active" : ""}`}
                  onClick={() => updateCases({ roster_source: layer.key })}
                >
                  <span>{layer.meta}</span>
                  <strong>{layer.label}</strong>
                  <em>{layer.detail}</em>
                </button>
              ))}
              <div className="mon-data-layer-card is-disabled" aria-disabled="true">
                <span>Siguiente integración</span>
                <strong>Google Sheets institucional</strong>
                <em>Conectar la base de barrido viva del Drive para cruzar avance reportado y respuestas reales.</em>
              </div>
            </div>
          </div>
        </div>
        )}

        {showLinks && (
        <CollectorLinksPanel
          sources={sources}
          config={config}
          setConfig={setConfig}
          onConfigPersisted={onConfigPersisted}
        />
        )}

        {showStrategies && (
        <div className="mon-contract-block">
          <div className="mon-contract-block-head">
            <span>Acciones del calendario</span>
            <button type="button" onClick={addStrategy}><Plus size={13} /> Agregar acción</button>
          </div>
          {model.strategies.length ? (
            <div className="mon-contract-list">
              {model.strategies.map((strategy, index) => (
                <div key={strategy.id || index} className="mon-contract-row mon-strategy-editor-row">
                  <label>
                    <span>Nombre</span>
                    <select
                      value={strategy.label}
                      onChange={(e) => updateStrategy(index, { label: e.target.value })}
                    >
                      <option value="">Seleccionar acción</option>
                      {withCurrentOption(strategyLabelOptions, strategy.label).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Estado</span>
                    <select
                      value={strategy.status}
                      onChange={(e) => updateStrategy(index, { status: e.target.value as MonitoreoOperationalStrategy["status"] })}
                    >
                      <option value="draft">Borrador</option>
                      <option value="active">Activa</option>
                      <option value="paused">Pausada</option>
                      <option value="closed">Cerrada</option>
                    </select>
                  </label>
                  <label>
                    <span>Responsable</span>
                    <select
                      value={strategy.owner}
                      onChange={(e) => updateStrategy(index, { owner: e.target.value })}
                    >
                      <option value="">Sin asignar</option>
                      {withCurrentOption(STRATEGY_OWNER_OPTIONS, strategy.owner).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label className="mon-row-span">
                    <span>Objetivo</span>
                    <select
                      value={strategy.objective}
                      onChange={(e) => updateStrategy(index, { objective: e.target.value })}
                    >
                      <option value="">Seleccionar objetivo</option>
                      {withCurrentOption(STRATEGY_OBJECTIVE_OPTIONS, strategy.objective).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="mon-icon-action"
                    aria-label="Quitar acción"
                    onClick={() => setModel({ strategies: model.strategies.filter((_, i) => i !== index) })}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Route size={18} />} title="Sin acciones de calendario" variant="inline" />
          )}
        </div>
        )}

        {showRules && (
        <div className="mon-contract-block mon-contract-block--wide">
          <div className="mon-contract-block-head">
            <span>Estados y resultados</span>
            <span className="mon-contract-counter">{model.events.length} resultados · {model.state_rules.length} estados</span>
          </div>
          <div className="mon-events-rules-grid">
            <div className="mon-contract-list">
              {model.events.map((event, index) => (
                <div key={event.id || index} className="mon-event-row">
                  <label>
                    <span>Evento</span>
                    <select
                      value={event.label}
                      onChange={(e) => {
                        const preset = EVENT_PRESETS.find((item) => item.label === e.target.value);
                        updateEvent(index, preset ? { ...preset } : { label: e.target.value });
                      }}
                    >
                      <option value="">Seleccionar evento</option>
                      {withCurrentOption(EVENT_PRESETS.map((item) => item.label), event.label).map((option) => (
                        <option key={option} value={option}>{prettyOperationalLabel(option)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Modalidad</span>
                    <select
                      value={event.modality}
                      onChange={(e) => updateEvent(index, { modality: e.target.value as MonitoreoStrategyPhase["modality"] })}
                    >
                      <option value="telefono">Teléfono</option>
                      <option value="email">Correo</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="sms">SMS</option>
                      <option value="presencial">Presencial</option>
                      <option value="mixto">Mixto</option>
                    </select>
                  </label>
                  <label>
                    <span>Resultado</span>
                    <select value={event.outcome} onChange={(e) => updateEvent(index, { outcome: e.target.value })}>
                      {outcomeOptions(model.events, [event.outcome]).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <div className="mon-boolean-cluster" aria-label={`Marcadores de ${event.label || "evento"}`}>
                    <CheckboxPill label="Intento" checked={event.counts_attempt} onChange={(checked) => updateEvent(index, { counts_attempt: checked })} />
                    <CheckboxPill label="Contacto" checked={event.counts_contact} onChange={(checked) => updateEvent(index, { counts_contact: checked })} />
                    <CheckboxPill label="Completa" checked={event.counts_complete} onChange={(checked) => updateEvent(index, { counts_complete: checked })} />
                    <CheckboxPill label="Cierra" checked={event.stop_contact} onChange={(checked) => updateEvent(index, { stop_contact: checked })} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mon-contract-list">
              {model.state_rules.map((rule, index) => (
                <div key={rule.id || index} className="mon-rule-row">
                  <label>
                    <span>Regla</span>
                    <select
                      value={rule.label}
                      onChange={(e) => {
                        const preset = STATE_RULE_PRESETS.find((item) => item.label === e.target.value);
                        updateRule(index, preset ? { ...preset } : { label: e.target.value });
                      }}
                    >
                      <option value="">Seleccionar regla</option>
                      {withCurrentOption(STATE_RULE_PRESETS.map((item) => item.label), rule.label).map((option) => (
                        <option key={option} value={option}>{prettyOperationalLabel(option)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Estado final</span>
                    <select value={rule.final_state} onChange={(e) => updateRule(index, { final_state: e.target.value })}>
                      {FINAL_STATE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                      {!FINAL_STATE_OPTIONS.some((option) => option.value === rule.final_state) && (
                        <option value={rule.final_state}>{rule.final_state}</option>
                      )}
                    </select>
                  </label>
                  <label>
                    <span>Prioridad</span>
                    <input
                      type="number"
                      min={1}
                      value={rule.priority}
                      onChange={(e) => updateRule(index, { priority: numberOrFallback(e.target.value, index + 1) })}
                    />
                  </label>
                  <OutcomeValuePicker
                    label="Valores resultado"
                    values={rule.outcome_values}
                    options={outcomeOptions(model.events, rule.outcome_values)}
                    onChange={(outcome_values) => updateRule(index, { outcome_values })}
                  />
                  <CheckboxPill label="Detiene contacto" checked={rule.stop_contact} onChange={(checked) => updateRule(index, { stop_contact: checked })} />
                </div>
              ))}
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

function CollectorLinksPanel({
  sources,
  config,
  setConfig,
  onConfigPersisted,
}: {
  sources: MonitoreoSource[];
  config: MonitoreoConfig;
  setConfig: (next: MonitoreoConfig) => void;
  onConfigPersisted: (next: MonitoreoState) => void;
}) {
  const [items, setItems] = useState<MonitoreoSurveyMonkeyCollector[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadedAt, setLoadedAt] = useState("");
  const [loadMode, setLoadMode] = useState<"local_snapshot" | "surveymonkey" | "">("");
  const sourceIds = sources
    .filter((source) => source.kind === "surveymonkey" && source.enabled)
    .map((source) => source.id);

  const configuredMap = useMemo(() => {
    const out = new Map<string, MonitoreoLinkCollector>();
    for (const item of config.operational_model.link_collectors) {
      out.set(`${item.source_id}::${item.collector_id}`, item);
    }
    return out;
  }, [config.operational_model.link_collectors]);

  const mergedItems = useMemo(() => items.map((item) => {
    const saved = configuredMap.get(`${item.source_id}::${item.collector_id}`);
    return saved ? { ...item, ...saved, configured_use: saved.operational_use } : item;
  }), [items, configuredMap]);

  const summary = useMemo(() => {
    const recipients = mergedItems.reduce((sum, item) => sum + numberOrFallback(item.recipient_summary?.total, 0), 0);
    const links = mergedItems.reduce((sum, item) => sum + numberOrFallback(item.recipient_summary?.personalized_link_count, 0), 0);
    const active = mergedItems.reduce((sum, item) => sum + numberOrFallback(item.active_response_count, 0), 0);
    return { recipients, links, active };
  }, [mergedItems]);

  async function loadCollectors(remote = false) {
    if (!sourceIds.length) {
      setItems([]);
      setLoadMode("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const out = await apiMonitoreoSurveyMonkeyCollectors(sourceIds, { remote });
      setItems(out.collectors);
      setLoadedAt(out.generated_at);
      setLoadMode(out.mode);
    } catch (e) {
      setError((e as Error).message);
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
    const nextItem: MonitoreoLinkCollector = {
      ...current,
      ...patch,
      operational_use: operationalUse,
      modality: patch.modality ?? (patch.operational_use ? modalityForCollectorUse(operationalUse) : current.modality),
      roster_required: patch.roster_required ?? (patch.operational_use ? operationalUse === "telefono_asistido" : current.roster_required),
    };
    const others = config.operational_model.link_collectors.filter((collector) => `${collector.source_id}::${collector.collector_id}` !== key);
    setConfig({
      ...config,
      operational_model: mergeOperationalModel({
        ...config.operational_model,
        link_collectors: [...others, nextItem],
      }),
    });
  }

  function applySuggestions() {
    const next = mergedItems.map((item) => collectorConfigFromDiscovery({
      ...item,
      operational_use: item.suggested_use,
      modality: modalityForCollectorUse(item.suggested_use),
      roster_required: item.suggested_use === "telefono_asistido",
    }));
    setConfig({
      ...config,
      operational_model: mergeOperationalModel({
        ...config.operational_model,
        link_collectors: next,
      }),
    });
  }

  async function saveCollectors() {
    setSaving(true);
    setError("");
    try {
      const payload = mergedItems.length
        ? mergedItems.map(collectorConfigFromDiscovery)
        : config.operational_model.link_collectors;
      const result = await apiMonitoreoCollectorsConfig(payload);
      onConfigPersisted(result.state);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mon-contract-block mon-contract-block--wide mon-collector-manager">
      <div className="mon-contract-block-head">
        <span>Enlaces y envíos SurveyMonkey</span>
        <div className="mon-collector-actions">
          <button type="button" onClick={() => loadCollectors(false)} disabled={loading || !sourceIds.length}>
            {loading ? <Loader2 size={13} className="pulso-spin" /> : <RefreshCw size={13} />}
            Actualizar
          </button>
          <button type="button" onClick={() => loadCollectors(true)} disabled={loading || !sourceIds.length}>
            {loading ? <Loader2 size={13} className="pulso-spin" /> : <PlugZap size={13} />}
            Leer SurveyMonkey
          </button>
          <button type="button" onClick={applySuggestions} disabled={!mergedItems.length}>
            <CheckCircle2 size={13} />
            Clasificar
          </button>
          <button type="button" className="pulso-primary" onClick={saveCollectors} disabled={saving}>
            {saving ? <Loader2 size={13} className="pulso-spin" /> : <Save size={13} />}
            Guardar
          </button>
        </div>
      </div>

      <div className="mon-collector-summary" aria-label="Resumen de enlaces y envíos">
        <span>{mergedItems.length} enlaces/envíos</span>
        <span>{summary.active.toLocaleString("es-PE")} respuestas</span>
        <span>{summary.recipients.toLocaleString("es-PE")} destinatarios observados</span>
        <span>{summary.links.toLocaleString("es-PE")} links usados</span>
        {loadMode && <span>{loadMode === "surveymonkey" ? "SurveyMonkey" : "Datos sincronizados"}</span>}
        {loadedAt && <span>{formatDate(loadedAt)}</span>}
      </div>

      <div className="mon-collector-body">
        {error && <Alert kind="error">{error}</Alert>}

        {!sourceIds.length && (
          <div className="mon-sm-empty">Conecta una encuesta SurveyMonkey para leer enlaces, correos o links personalizados.</div>
        )}

        {loading && (
          <div className="mon-collector-loading">
            <Loader2 size={16} className="pulso-spin" />
            <span>Leyendo enlaces, envíos y conteos seguros...</span>
          </div>
        )}

        {!loading && sourceIds.length > 0 && !mergedItems.length && (
          <div className="mon-sm-empty">Sin enlaces o envíos detectados para las fuentes activas.</div>
        )}

        <div className="mon-collector-list">
          {mergedItems.map((item) => {
            const useOption = collectorUseOption(item.operational_use);
            const UseIcon = useOption.icon;
            const completeCount = countFromRecord(item.recipient_summary?.response_status_counts, ["completely_responded", "completed", "complete"]);
            return (
              <article key={`${item.source_id}-${item.collector_id}`} className={`mon-collector-card is-${item.modality}`}>
                <div className="mon-collector-title">
                  <span className="mon-collector-use-icon"><UseIcon size={14} /></span>
                  <div>
                    <strong>{collectorDisplayName(item)}</strong>
                    <em>{item.source_label || item.source_id}</em>
                  </div>
                  <span className="mon-collector-chip">{collectorTypeLabel(item.collector_type)}</span>
                </div>

                <div className="mon-collector-metrics">
                  <MetricTile label="Respuestas" value={item.active_response_count || item.response_count} />
                  <MetricTile label="Dest. obs." value={item.recipient_summary?.total ?? 0} />
                  <MetricTile label="Links usados" value={item.recipient_summary?.personalized_link_count ?? 0} />
                  <MetricTile label="Completas" value={completeCount} />
                </div>

                <div className="mon-collector-controls">
                  <label>
                    <span>Tipo de uso</span>
                    <select
                      value={item.operational_use}
                      onChange={(e) => updateCollector(item, { operational_use: e.target.value as MonitoreoCollectorUse })}
                    >
                      {COLLECTOR_USE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Modalidad</span>
                    <select
                      value={item.modality}
                      onChange={(e) => updateCollector(item, { modality: e.target.value as MonitoreoStrategyPhase["modality"] })}
                    >
                      <option value="email">Correo</option>
                      <option value="telefono">Teléfono</option>
                      <option value="presencial">Presencial</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="sms">SMS</option>
                      <option value="mixto">Mixto</option>
                    </select>
                  </label>
                  <label className="mon-switch-line mon-collector-roster">
                    <input
                      type="checkbox"
                      checked={item.roster_required}
                      onChange={(e) => updateCollector(item, { roster_required: e.target.checked })}
                    />
                    <span>Requiere barrido</span>
                  </label>
                </div>

                {(item.warnings?.length || item.recipient_summary?.truncated) && (
                  <div className="mon-collector-warnings">
                    {item.recipient_summary?.truncated && <span>Conteo de destinatarios muestreado</span>}
                    {item.warnings?.map((warning) => <span key={warning}>{warning}</span>)}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function collectorConfigFromDiscovery(item: MonitoreoSurveyMonkeyCollector): MonitoreoLinkCollector {
  const operationalUse = normalizeCollectorUse(item.operational_use || item.suggested_use);
  return {
    id: item.id || `${item.source_id}::${item.collector_id}`,
    source_id: item.source_id,
    source_label: item.source_label,
    survey_id: item.survey_id,
    collector_id: item.collector_id,
    collector_name: item.collector_name,
    collector_type: item.collector_type,
    operational_use: operationalUse,
    modality: item.modality || modalityForCollectorUse(operationalUse),
    roster_required: item.roster_required ?? operationalUse === "telefono_asistido",
  };
}

function collectorUseOption(value: MonitoreoCollectorUse) {
  return COLLECTOR_USE_OPTIONS.find((option) => option.value === value) ?? COLLECTOR_USE_OPTIONS[COLLECTOR_USE_OPTIONS.length - 1];
}

function collectorTypeLabel(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === "email") return "Envío por correo";
  if (normalized === "weblink" || normalized === "web_link") return "Link abierto";
  if (normalized === "sms") return "SMS";
  return value || "Enlace";
}

function collectorDisplayName(item: MonitoreoSurveyMonkeyCollector | MonitoreoLinkCollector) {
  const raw = String(item.collector_name || item.collector_id || "Enlace").trim();
  if (/^collector\s+/i.test(raw)) return raw.replace(/^collector/i, "Enlace");
  if (/^colector\s+/i.test(raw)) return raw.replace(/^colector/i, "Enlace");
  return raw;
}

function countFromRecord(record: Record<string, number> | undefined, keys: string[]) {
  if (!record) return 0;
  return keys.reduce((sum, key) => sum + numberOrFallback(record[key], 0), 0);
}

function MetricTile({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "ready" | "warning" }) {
  return (
    <div className={`mon-collector-metric is-${tone}`}>
      <span>{label}</span>
      <strong>{value.toLocaleString("es-PE")}</strong>
    </div>
  );
}

function StructureTargetsEditor({
  strata,
  goals,
  phases,
  collectors,
  onChange,
  onPhasesChange,
}: {
  strata: OperationalStratum[];
  goals: MonitoreoGoal[];
  phases: MonitoreoStrategyPhase[];
  collectors: MonitoreoLinkCollector[];
  onChange: (next: MonitoreoGoal[]) => void;
  onPhasesChange: (next: MonitoreoStrategyPhase[]) => void;
}) {
  const total = goals.reduce((sum, goal) => sum + Math.max(0, numberOrFallback(goal.meta, 0)), 0);
  const configured = strata.filter((stratum) => goalForStratum(goals, stratum) != null).length;

  function setMeta(stratum: OperationalStratum, raw: string) {
    const filters = primaryGoalFiltersForStratum(stratum);
    if (!Object.keys(filters).length) return;
    const meta = raw === "" ? 0 : Math.max(0, Math.round(Number(raw) || 0));
    onChange(upsertGoalForFilters(goals, filters, meta));
  }

  function clearMeta(stratum: OperationalStratum) {
    const filters = primaryGoalFiltersForStratum(stratum);
    onChange(goals.filter((goal) => !goalMatchesFilters(goal, filters)));
  }

  function setStratumPhase(
    stratum: OperationalStratum,
    slot: "primary" | "secondary" | "third",
    rawModality: string,
  ) {
    const entries = phaseEntriesForStratum(stratum.title, phases);
    const slotIndex = slot === "primary" ? 0 : slot === "secondary" ? 1 : 2;
    const phaseEntry = entries[slotIndex] ?? null;
    const previousEntry = entries[slotIndex - 1] ?? null;

    if (slot !== "primary" && !rawModality) {
      if (!phaseEntry) return;
      onPhasesChange(phases.filter((_, index) => index !== phaseEntry.index));
      return;
    }
    if (!rawModality) return;

    const modality = rawModality as MonitoreoStrategyPhase["modality"];
    const nextPhases = phases.slice();
    const defaultStartWeek = slotIndex === 0
      ? 1
      : Math.max(2, (previousEntry?.phase.end_week ?? previousEntry?.phase.start_week ?? slotIndex) + 1);
    if (phaseEntry) {
      nextPhases[phaseEntry.index] = phaseWithModality(phaseEntry.phase, stratum, modality);
    } else {
      nextPhases.push(defaultPhaseForStratum(stratum, modality, { start_week: defaultStartWeek, end_week: null }));
    }
    onPhasesChange(nextPhases);
  }

  if (!strata.length) {
    return <EmptyState icon={<Target size={18} />} title="Sin cortes para asignar meta" variant="inline" />;
  }

  return (
    <div className="mon-target-editor">
      <div className="mon-target-editor-summary">
        <span>
          <strong>{configured}/{strata.length}</strong>
          <em>con meta</em>
        </span>
        <span>
          <strong>{total ? total.toLocaleString("es-PE") : "S/M"}</strong>
          <em>meta total</em>
        </span>
      </div>
      <div className="mon-target-card-list">
        {strata.map((stratum) => {
          const facts = parseStratumFacts(stratum.detail);
          const meta = goalForStratum(goals, stratum);
          const phaseEntries = phaseEntriesForStratum(stratum.title, phases);
          const primaryPhase = phaseEntries[0]?.phase ?? null;
          const secondaryPhase = phaseEntries[1]?.phase ?? null;
          const thirdPhase = phaseEntries[2]?.phase ?? null;
          const observedUse = observedCollectorUseForStratum(stratum, collectors);
          const observedModality = modalityFromObservedUse(stratum, observedUse);
          const primaryModality = primaryPhase?.modality ?? observedModality ?? inferModalityForStratum(stratum.title);
          const filters = primaryGoalFiltersForStratum(stratum);
          const filterText = Object.entries(filters)
            .map(([key, value]) => `${dimensionLabel(key.replace(/^dim_/, ""))}: ${value}`)
            .join(" · ");
          return (
            <article key={stratum.id} className={`mon-target-card${meta != null ? " is-configured" : ""}`}>
              <div className="mon-target-card-main">
                <strong>{stratum.title}</strong>
                <span>{filterText || stratum.source}</span>
              </div>
              <div className="mon-target-facts">
                {facts.universe != null && <span>Universo {facts.universe.toLocaleString("es-PE")}</span>}
                {facts.recommended != null && <span>Recom. {facts.recommended.toLocaleString("es-PE")}</span>}
                {facts.technique && <span>{facts.technique}</span>}
                <span>Observado: {observedUse?.label ?? "Sin clasificar"}</span>
                {meta == null && facts.minimum != null && (
                  <button type="button" onClick={() => setMeta(stratum, String(facts.minimum))}>
                    Min. {facts.minimum.toLocaleString("es-PE")}
                  </button>
                )}
                {meta == null && facts.recommended != null && facts.recommended !== facts.minimum && (
                  <button type="button" onClick={() => setMeta(stratum, String(facts.recommended))}>
                    Recom. {facts.recommended.toLocaleString("es-PE")}
                  </button>
                )}
              </div>
              <label className="mon-target-meta-input">
                <span>Meta</span>
                <input
                  type="number"
                  min={0}
                  value={meta ?? ""}
                  onChange={(e) => setMeta(stratum, e.target.value)}
                  placeholder="0"
                />
              </label>
              <button
                type="button"
                className="mon-icon-action"
                aria-label="Quitar meta"
                disabled={meta == null}
                onClick={() => clearMeta(stratum)}
              >
                <Trash2 size={13} />
              </button>
              <div className="mon-target-modality">
                <label>
                  <span>1er mecanismo</span>
                  <select
                    value={primaryModality}
                    onChange={(e) => setStratumPhase(stratum, "primary", e.target.value)}
                  >
                    {MODALITY_SELECT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>2do mecanismo</span>
                  <select
                    value={secondaryPhase?.modality ?? ""}
                    onChange={(e) => setStratumPhase(stratum, "secondary", e.target.value)}
                  >
                    <option value="">Sin segundo</option>
                    {MODALITY_SELECT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>3er mecanismo</span>
                  <select
                    value={thirdPhase?.modality ?? ""}
                    onChange={(e) => setStratumPhase(stratum, "third", e.target.value)}
                  >
                    <option value="">Sin tercero</option>
                    {MODALITY_SELECT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function primaryGoalFiltersForStratum(stratum: OperationalStratum) {
  const entries = Object.entries(stratum.filters).filter(([, value]) => String(value ?? "").trim());
  const preferred = ["dim_segmento", "segmento", "dim_actor", "actor", "dim_servicio", "servicio", "dim_territorio", "territorio"];
  const selected = preferred
    .map((key) => entries.find(([entryKey]) => entryKey === key))
    .find(Boolean) ?? entries[0];
  if (!selected) return {};
  const [key, value] = selected;
  return { [key.startsWith("dim_") || key === "actor" ? key : `dim_${key}`]: String(value) };
}

function goalForStratum(goals: MonitoreoGoal[], stratum: OperationalStratum) {
  const filters = primaryGoalFiltersForStratum(stratum);
  return goals.find((goal) => goalMatchesFilters(goal, filters))?.meta ?? null;
}

function goalMatchesFilters(goal: MonitoreoGoal, filters: Record<string, string>) {
  const entries = Object.entries(filters).filter(([, value]) => String(value ?? "").trim());
  if (!entries.length) return false;
  return entries.every(([key, value]) => {
    const candidates = key.startsWith("dim_") ? [key, key.replace(/^dim_/, "")] : [key, `dim_${key}`];
    return candidates.some((candidate) => normalizeMatch(goal.filters[candidate]) === normalizeMatch(value));
  });
}

function upsertGoalForFilters(goals: MonitoreoGoal[], filters: Record<string, string>, meta: number) {
  const index = goals.findIndex((goal) => goalMatchesFilters(goal, filters));
  if (index >= 0) {
    return goals.map((goal, i) => i === index ? { ...goal, filters, meta } : goal);
  }
  return [...goals, { filters, meta }];
}

function parseStratumFacts(detail: string) {
  const numberFrom = (pattern: RegExp) => {
    const match = detail.match(pattern);
    return match?.[1] ? Number(match[1].replace(/[^\d]/g, "")) : null;
  };
  const textFrom = (pattern: RegExp) => {
    const match = detail.match(pattern);
    return match?.[1]?.trim().replace(/\.$/, "") ?? "";
  };
  return {
    universe: numberFrom(/universo\s*[: ]\s*(\d[\d.,]*)/i),
    minimum: numberFrom(/meta\s+m[ií]nima\s*[: ]\s*(\d[\d.,]*)/i),
    recommended: numberFrom(/recomendada\s*[: ]\s*(\d[\d.,]*)/i),
    technique: textFrom(/t[eé]cnica\s*[: ]\s*([^;]+)/i),
    control: textFrom(/control\s*[: ]\s*([^;]+)/i),
  };
}

function ModelInspector({
  mode,
  config,
  setConfig,
  variables,
  strata,
}: {
  mode: OperationalModelMode;
  config: MonitoreoConfig;
  setConfig: (next: MonitoreoConfig) => void;
  variables: MonitoreoVariable[];
  strata: OperationalStratum[];
}) {
  const names = variables.map((variable) => variable.name);
  const set = (patch: Partial<MonitoreoConfig>) => setConfig({ ...config, ...patch });
  const modeLabel = OPERATIONAL_MODEL_MODES.find((item) => item.key === mode)?.label ?? "Modelo";
  const goalTotal = config.goals.reduce((sum, goal) => sum + Math.max(0, numberOrFallback(goal.meta, 0)), 0);
  return (
    <Panel
      className="mon-fill-panel mon-model-inspector"
      eyebrow="Inspector"
      title={<span className="mon-title-icon"><SlidersHorizontal size={16} /> Variables y estado</span>}
    >
      <div className="mon-inspector-scroll">
        <div className="mon-inspector-meter">
          <span>
            <strong>{modeLabel}</strong>
            <em>Modo activo</em>
          </span>
          <span>
            <strong>{variables.length}</strong>
            <em>Variables detectadas</em>
          </span>
          <span>
            <strong>{strata.length}</strong>
            <em>Cortes visibles</em>
          </span>
        </div>

        <div className="mon-inspector-section">
          <div className="mon-inspector-section-head">
            <span>
              {mode === "estructura" && "Cortes y metas"}
              {mode === "enlaces" && "Enlaces y envíos"}
              {mode === "casos" && "Base de barrido"}
              {mode === "estrategias" && "Calendario"}
              {mode === "reglas" && "Estados válidos"}
            </span>
          </div>
          {mode === "estructura" && (
            <>
              <div className="mon-inspector-total">
                <span>Meta total</span>
                <strong>{goalTotal ? goalTotal.toLocaleString("es-PE") : "S/M"}</strong>
                <em>{config.goals.length} metas por corte</em>
              </div>
              <ChipPicker label="Variables de corte / estrato" vars={names} selected={config.control_vars} onChange={(control_vars) => set({ control_vars })} />
            </>
          )}
          {mode === "casos" && (
            <>
              <div className="mon-case-grid">
                <VarSelect label="ID" value={config.id_var} vars={names} onChange={(value) => set({ id_var: value })} />
                <VarSelect label="Contacto" value={config.contact_var} vars={names} onChange={(value) => set({ contact_var: value })} />
                <VarSelect label="Estado" value={config.status_var} vars={names} onChange={(value) => set({ status_var: value })} />
                <VarSelect label="Fecha" value={config.date_var} vars={names} onChange={(value) => set({ date_var: value })} />
              </div>
              <p className="mon-inspector-note">
                La base de barrido es opcional: telefono y presencial la usan para responsable, status, intentos y fecha; correo suele apoyarse en universo/contactos y respuesta de plataforma.
              </p>
              <ChipPicker label="Campos criticos" vars={names} selected={config.critical_vars} onChange={(critical_vars) => set({ critical_vars })} />
            </>
          )}
          {mode === "enlaces" && (
            <>
              <div className="mon-inspector-total">
                <span>Clasificados</span>
                <strong>{config.operational_model.link_collectors.length}</strong>
                <em>Enlaces/envíos guardados</em>
              </div>
              <div className="mon-token-list">
                {COLLECTOR_USE_OPTIONS.filter((option) =>
                  config.operational_model.link_collectors.some((collector) => collector.operational_use === option.value),
                ).map((option) => (
                  <button key={option.value} type="button">
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}
          {mode === "estrategias" && (
            <div className="mon-case-grid">
              <VarSelect label="Enumerador" value={config.enumerator_var} vars={names} onChange={(value) => set({ enumerator_var: value })} />
              <VarSelect label="Fecha" value={config.date_var} vars={names} onChange={(value) => set({ date_var: value })} />
              <VarSelect label="Duración" value={config.duration_var} vars={names} onChange={(value) => set({ duration_var: value })} />
              <VarSelect label="Estado" value={config.status_var} vars={names} onChange={(value) => set({ status_var: value })} />
            </div>
          )}
          {mode === "reglas" && (
            <>
              <VarSelect label="Estado" value={config.status_var} vars={names} onChange={(value) => set({ status_var: value })} />
              <OutcomeValuePicker
                label="Estados válidos"
                values={config.valid_statuses}
                options={outcomeOptions(config.operational_model.events, config.valid_statuses)}
                onChange={(valid_statuses) => set({ valid_statuses })}
              />
              <ChipPicker label="Campos criticos" vars={names} selected={config.critical_vars} onChange={(critical_vars) => set({ critical_vars })} />
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

function VariableSelect({
  label,
  value,
  variables,
  onChange,
}: {
  label: string;
  value: string;
  variables: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sin asignar</option>
        {variables.map((variable) => <option key={variable} value={variable}>{variable}</option>)}
      </select>
    </label>
  );
}

function VariableChipSelector({
  label,
  values,
  variables,
  onChange,
}: {
  label: string;
  values: string[];
  variables: string[];
  onChange: (values: string[]) => void;
}) {
  return <TokenVariablePicker label={label} values={values} variables={variables} onChange={onChange} />;
}

function OutcomeValuePicker({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: string[];
  options: Array<{ value: string; label: string }>;
  onChange: (values: string[]) => void;
}) {
  const available = options.filter((option) => !values.includes(option.value));
  return (
    <div className="mon-outcome-picker mon-row-span">
      <span>{label}</span>
      <select
        value=""
        onChange={(e) => {
          const value = e.target.value;
          if (value) onChange([...values, value]);
        }}
      >
        <option value="">{available.length ? "Agregar resultado..." : "Sin resultados disponibles"}</option>
        {available.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <div className="mon-token-list">
        {values.length ? values.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(values.filter((item) => item !== value))}
            title="Quitar resultado"
          >
            {outcomeLabel(value)}
            <XCircle size={12} />
          </button>
        )) : (
          <span className="mon-muted-chip">Sin resultados seleccionados</span>
        )}
      </div>
    </div>
  );
}

function TokenVariablePicker({
  label,
  values,
  variables,
  onChange,
}: {
  label: string;
  values: string[];
  variables: string[];
  onChange: (values: string[]) => void;
}) {
  const available = variables.filter((variable) => !values.includes(variable));
  return (
    <div className="mon-token-picker">
      <span>{label}</span>
      <select
        value=""
        onChange={(e) => {
          const value = e.target.value;
          if (value) onChange([...values, value]);
        }}
      >
        <option value="">{available.length ? "Agregar variable..." : "Sin variables disponibles"}</option>
        {available.map((variable) => <option key={variable} value={variable}>{variable}</option>)}
      </select>
      <div className="mon-token-list">
        {values.length ? values.map((variable) => (
          <button
            key={variable}
            type="button"
            onClick={() => onChange(values.filter((item) => item !== variable))}
            title="Quitar variable"
          >
            {variable}
            <XCircle size={12} />
          </button>
        )) : (
          <span className="mon-muted-chip">Sin variables seleccionadas</span>
        )}
      </div>
    </div>
  );
}

function CheckboxPill({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`mon-checkbox-pill${checked ? " is-active" : ""}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function ModelStep({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="mon-model-step">
      <span>{icon}</span>
      <div>
        <strong>{label}</strong>
        <em>{value}</em>
      </div>
    </div>
  );
}

function StrategyPlanner({
  config,
  setConfig,
  strata,
  variables,
}: {
  config: MonitoreoConfig;
  setConfig: (next: MonitoreoConfig) => void;
  strata: OperationalStratum[];
  variables: MonitoreoVariable[];
}) {
  const phases = config.strategy_phases;
  const variableNames = variables.map((variable) => variable.name);
  const stratumOptions = Array.from(new Set([
    ...strata.map((item) => item.title),
    ...phases.map((phase) => phase.stratum).filter(Boolean),
  ]));

  function setPhases(strategy_phases: MonitoreoStrategyPhase[]) {
    setConfig({ ...config, strategy_phases });
  }

  function updatePhase(index: number, patch: Partial<MonitoreoStrategyPhase>) {
    setPhases(phases.map((phase, i) => i === index ? { ...phase, ...patch } : phase));
  }

  function addPhase() {
    const id = `fase-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    setPhases([
      ...phases,
      {
        ...DEFAULT_STRATEGY_PHASE,
        id,
        stratum: stratumOptions[0] ?? "",
        target_rule: DEFAULT_SCOPE_BY_MODALITY[DEFAULT_STRATEGY_PHASE.modality],
        kpi_focus: KPI_FOCUS_OPTIONS_BY_MODALITY[DEFAULT_STRATEGY_PHASE.modality].slice(0, 3),
      },
    ]);
  }

  return (
    <div className="mon-model-block mon-strategy-block">
      <div className="mon-model-block-head">
        <span>Calendario de mecanismos</span>
        <button type="button" onClick={addPhase}><Plus size={13} /> Agregar mecanismo</button>
      </div>
      {phases.length ? (
        <div className="mon-strategy-list">
          {phases.map((phase, index) => (
            <div key={phase.id || index} className="mon-strategy-row">
              <label>
                <span>Corte</span>
                <select value={phase.stratum} onChange={(e) => updatePhase(index, { stratum: e.target.value })}>
                  <option value="">Sin corte</option>
                  {stratumOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                <span>Mecanismo</span>
                <select
                  value={phase.modality}
                  onChange={(e) => {
                    const modality = e.target.value as MonitoreoStrategyPhase["modality"];
                    updatePhase(index, {
                      modality,
                      target_rule: DEFAULT_SCOPE_BY_MODALITY[modality],
                      kpi_focus: KPI_FOCUS_OPTIONS_BY_MODALITY[modality].slice(0, 3),
                      kpi_modules: DEFAULT_KPI_MODULES_BY_MODALITY[modality],
                    });
                  }}
                >
                  <option value="telefono">Teléfono</option>
                  <option value="email">Correo</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="sms">SMS</option>
                  <option value="presencial">Presencial</option>
                  <option value="mixto">Mixto</option>
                </select>
              </label>
              <label>
                <span>Inicio</span>
                <input
                  type="number"
                  min={1}
                  value={phase.start_week ?? ""}
                  onChange={(e) => updatePhase(index, { start_week: numberOrNull(e.target.value) })}
                />
              </label>
              <label>
                <span>Fin</span>
                <input
                  type="number"
                  min={1}
                  value={phase.end_week ?? ""}
                  onChange={(e) => updatePhase(index, { end_week: numberOrNull(e.target.value) })}
                />
              </label>
              <div className="mon-phase-choice-grid">
                <ChoicePillGroup
                  label="Alcance"
                  options={[
                    ...scopeOptionsForModality(phase.modality).map((option) => ({ value: option.value, label: option.label })),
                    ...(phase.target_rule && !scopeOptionsForModality(phase.modality).some((option) => option.value === phase.target_rule)
                      ? [{ value: phase.target_rule, label: scopeLabel(phase.target_rule, phase.modality) }]
                      : []),
                  ]}
                  selected={phase.target_rule || DEFAULT_SCOPE_BY_MODALITY[phase.modality]}
                  onChange={(target_rule) => updatePhase(index, { target_rule: String(target_rule) })}
                />
                <ChoicePillGroup
                  label="Lecturas de avance"
                  options={focusOptionsForModality(phase.modality, phase.kpi_focus).map((value) => ({ value, label: kpiFocusLabel(value) }))}
                  selected={phase.kpi_focus}
                  multiple
                  onChange={(kpi_focus) => updatePhase(index, { kpi_focus: Array.isArray(kpi_focus) ? kpi_focus : [String(kpi_focus)] })}
                />
              </div>
              <PhaseKpiConfigurator
                phase={phase}
                config={config}
                variableNames={variableNames}
                onChange={(patch) => updatePhase(index, patch)}
              />
              <div className="mon-strategy-summary">
                <CalendarRange size={13} />
                <span>{phaseWeekLabel(phase)}</span>
              </div>
              <button
                type="button"
                className="mon-icon-action"
                aria-label="Quitar mecanismo"
                onClick={() => setPhases(phases.filter((_, i) => i !== index))}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mon-strategy-empty-stack">
          <EmptyState icon={<Route size={18} />} title="Sin calendario configurado" variant="inline" />
          <div className="mon-modality-guide">
            <strong>Capas según modalidad</strong>
            <span>
              Teléfono y presencial pueden sumar una base de barrido local; correo, SMS y WhatsApp suelen partir de universo/contactos y respuesta de plataforma.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ChoicePillGroup({
  label,
  options,
  selected,
  multiple = false,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string | string[];
  multiple?: boolean;
  onChange: (value: string | string[]) => void;
}) {
  const selectedValues = Array.isArray(selected) ? selected : [selected].filter(Boolean);
  return (
    <div className="mon-choice-group">
      <span>{label}</span>
      <div className="mon-choice-list">
        {options.map((option) => {
          const active = selectedValues.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              className={active ? "is-active" : ""}
              onClick={() => {
                if (multiple) {
                  onChange(toggleValue(selectedValues, option.value));
                } else {
                  onChange(option.value);
                }
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PhaseKpiConfigurator({
  phase,
  config,
  variableNames,
  onChange,
}: {
  phase: MonitoreoStrategyPhase;
  config: MonitoreoConfig;
  variableNames: string[];
  onChange: (patch: Partial<MonitoreoStrategyPhase>) => void;
}) {
  const suggested = new Set(DEFAULT_KPI_MODULES_BY_MODALITY[phase.modality]);
  return (
    <div className="mon-strategy-kpi-config">
      <div className="mon-strategy-config-section">
        <span>KPIs visibles</span>
        <div className="mon-kpi-module-grid">
          {KPI_MODULES.map((item) => {
            const active = phase.kpi_modules.includes(item.key);
            const recommended = suggested.has(item.key);
            return (
              <button
                key={item.key}
                type="button"
                className={`${active ? "is-active" : ""}${recommended ? " is-recommended" : ""}`}
                onClick={() => onChange({ kpi_modules: toggleValue(phase.kpi_modules, item.key) })}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <TokenVariablePicker
        label="Desglose dentro del corte"
        values={phase.breakdown_vars}
        variables={variableNames}
        onChange={(breakdown_vars) => onChange({ breakdown_vars })}
      />

      <div className="mon-phase-var-grid">
        <label>
          <span>Variable de intentos</span>
          <select value={phase.attempts_var} onChange={(e) => onChange({ attempts_var: e.target.value })}>
            <option value="">Sin asignar</option>
            {variableNames.map((variable) => <option key={variable} value={variable}>{variable}</option>)}
          </select>
        </label>
        <label>
          <span>Resultado / efectividad</span>
          <select value={phase.outcome_var} onChange={(e) => onChange({ outcome_var: e.target.value })}>
            <option value="">Sin asignar</option>
            {variableNames.map((variable) => <option key={variable} value={variable}>{variable}</option>)}
          </select>
        </label>
      </div>

      <div className="mon-modality-hint">
        <Route size={13} />
        <span>{modalityDataNeed(phase.modality)}</span>
      </div>

      <div className="mon-strategy-output">
        <SlidersHorizontal size={13} />
        <span>{phaseOutputSummary(phase, config)}</span>
      </div>
    </div>
  );
}

function QualityView({
  mode,
  onModeChange,
  config,
  inconsistencies,
  sample,
  hasSnapshot,
  onBuildSample,
}: {
  mode: QualityMode;
  onModeChange: (mode: QualityMode) => void;
  config: MonitoreoConfig;
  inconsistencies: MonitoreoRow[];
  sample: MonitoreoRow[];
  hasSnapshot: boolean;
  onBuildSample: () => void;
}) {
  return (
    <div className="mon-stage mon-stage--quality">
      <StageModeBar
        options={QUALITY_MODES}
        active={mode}
        onChange={onModeChange}
        summary={
          <>
            <span>{inconsistencies.length} alertas</span>
            <span>{sample.length} casos de control</span>
          </>
        }
      />
      {mode === "consistencia" && (
        <div className="mon-stage-single">
          <TablePanel title="Inconsistencias" icon={<ShieldAlert size={16} />} rows={inconsistencies} />
        </div>
      )}
      {mode === "supervision" && (
        <Panel
          className="mon-fill-panel"
          eyebrow="Supervisión"
          title={<span className="mon-title-icon"><PhoneCall size={16} /> Muestra de control</span>}
          actions={<button type="button" onClick={onBuildSample} disabled={!hasSnapshot}>Generar muestra</button>}
        >
          <div className="mon-panel-fill">
            {sample.length ? (
              <DataTable rows={sample} />
            ) : (
              <EmptyState icon={<PhoneCall size={18} />} title="Sin muestra generada" variant="inline" />
            )}
          </div>
        </Panel>
      )}
      {mode === "equipo" && (
        <div className="mon-stage-single">
          {config.enumerator_var ? (
            <div className="mon-stage-single mon-stage-single--external">
              <EnumeradoresPane />
            </div>
          ) : (
            <TeamReadinessPanel config={config} />
          )}
        </div>
      )}
    </div>
  );
}

function TeamReadinessPanel({ config }: { config: MonitoreoConfig }) {
  const roster = rosterSourceOption(config.operational_model.cases.roster_source);
  const rows: MonitoreoRow[] = [
    {
      capa: "Respuestas de plataforma",
      estado: "Lista",
      habilita: "avance, tiempos, consistencia",
    },
    {
      capa: "Responsable/enumerador",
      estado: "Pendiente",
      habilita: "actividad por operador",
    },
    {
      capa: "Base de barrido",
      estado: roster.value === "external_local" || roster.value === "uploaded" ? "Configurada" : "Pendiente",
      habilita: "intentos, status operativo, observaciones",
    },
    {
      capa: "Universo/contactos",
      estado: roster.value === "responses" ? "Parcial" : "S/D",
      habilita: "cobertura y faltantes por caso",
    },
  ];

  return (
    <Panel
      className="mon-fill-panel mon-team-readiness"
      eyebrow="Equipo"
      title={<span className="mon-title-icon"><Activity size={16} /> Preparacion de datos operativos</span>}
    >
      <div className="mon-team-readiness-body">
        <div className="mon-quality-note">
          <div>
            <strong>Sin variable de responsable/enumerador</strong>
            <span>
              En este punto la fuente sirve para avance y calidad de respuesta. Los KPIs por equipo se activan cuando el modelo tiene responsable o barrido local.
            </span>
          </div>
          <em>{roster.label}</em>
        </div>
        <DataTable rows={rows} />
      </div>
    </Panel>
  );
}

function uniqueDimensionOptions(...groups: Array<Array<string | null | undefined>>) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const raw of group) {
      const value = String(raw ?? "").trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      out.push(value);
    }
  }
  return out.slice(0, 80);
}

function inspectionDimensionOptions(inspections: Record<string, { loading: boolean; error: string; data: SurveyMonkeyMultibaseInspection | null }>) {
  return Object.values(inspections).flatMap((inspection) => {
    const data = inspection.data;
    if (!data) return [];
    return [
      data.title,
      ...data.columns.map((column) => column.name),
      ...data.questions.map((question) => question.heading || question.family),
    ];
  });
}

function SourceCredentialStatus({
  state,
  provider,
}: {
  state: ConnectionTokenState | undefined;
  provider: MonitoreoSourceKind;
}) {
  const ready = state?.has_token === true;
  return (
    <span className={`mon-source-credential${ready ? " is-ready" : ""}`}>
      {ready ? "Credencial lista" : "Credencial pendiente"}
      {ready && state?.masked_token ? <em>{state.masked_token}</em> : null}
    </span>
  );
}

function DimensionSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const normalized = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sin asignar</option>
        {normalized.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function SourcePanel({
  className,
  draft,
  setDraft,
  saving,
  state,
  onAddSurvey,
  onAddKobo,
  onUpdateSource,
}: {
  className?: string;
  draft: SourceDraft;
  setDraft: (fn: (prev: SourceDraft) => SourceDraft) => void;
  saving: boolean;
  state: MonitoreoState | null;
  onAddSurvey: (survey: SurveyMonkeyMultibaseListItem, label: string, dimensions: Partial<SourceDimensions>) => Promise<void>;
  onAddKobo: (asset: MonitoreoKoboAssetItem, label: string, dimensions: Partial<SourceDimensions>) => Promise<void>;
  onUpdateSource: (source: MonitoreoSource, patch: Partial<MonitoreoSourcePayload>) => Promise<void>;
}) {
  const isSm = draft.kind === "surveymonkey";
  const configuredSources = state?.sources ?? [];
  const activeCount = configuredSources.filter((src) => src.enabled).length;
  const [smQuery, setSmQuery] = useState("");
  const [smMonths, setSmMonths] = useState(1);
  const [smMeta, setSmMeta] = useState<{ count: number; totalRecent: number; months: number } | null>(null);
  const [smResults, setSmResults] = useState<SurveyMonkeyMultibaseListItem[]>([]);
  const [smLabels, setSmLabels] = useState<Record<string, string>>({});
  const [smSegments, setSmSegments] = useState<Record<string, string>>({});
  const [smInspections, setSmInspections] = useState<Record<string, { loading: boolean; error: string; data: SurveyMonkeyMultibaseInspection | null }>>({});
  const [searchingSm, setSearchingSm] = useState(false);
  const [smError, setSmError] = useState("");
  const [pendingSurveyIds, setPendingSurveyIds] = useState<Set<string>>(() => new Set());
  const [pendingKoboIds, setPendingKoboIds] = useState<Set<string>>(() => new Set());
  const [connectionStates, setConnectionStates] = useState<ConnectionTokenState[]>([]);
  const [koboAssets, setKoboAssets] = useState<MonitoreoKoboAssetItem[]>([]);
  const [koboLabels, setKoboLabels] = useState<Record<string, string>>({});
  const [koboSegments, setKoboSegments] = useState<Record<string, string>>({});
  const [loadingKoboAssets, setLoadingKoboAssets] = useState(false);
  const [koboError, setKoboError] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiConnectionsList()
      .then((result) => {
        if (!cancelled) setConnectionStates(result.connections);
      })
      .catch(() => {
        if (!cancelled) setConnectionStates([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const credential = connectionStates.find((item) => item.provider === draft.kind);
  const configuredSurveyIds = new Set(configuredSources.map((src) => src.survey_id).filter(Boolean));
  const configuredKoboIds = new Set(configuredSources.map((src) => src.asset_uid).filter(Boolean));
  const sourceDimensionValues = configuredSources.flatMap((source) => (
    sourceDimensionEntries(source.dimensions).map(([, value]) => value)
  ));
  const extractedOptions = uniqueDimensionOptions(
    [draft.dimensions.segmento, draft.dimensions.servicio, draft.dimensions.territorio],
    sourceDimensionValues,
    inspectionDimensionOptions(smInspections),
  );
  const visibleSurveysToAdd = smResults.filter((item) => !configuredSurveyIds.has(item.id) && !pendingSurveyIds.has(item.id));

  function segmentForSurvey(survey: SurveyMonkeyMultibaseListItem) {
    return smSegments[survey.id] ?? draft.dimensions.segmento;
  }

  function segmentForKobo(asset: MonitoreoKoboAssetItem) {
    return koboSegments[asset.uid] ?? draft.dimensions.segmento;
  }

  function labelForSurvey(survey: SurveyMonkeyMultibaseListItem) {
    return smLabels[survey.id] ?? (draft.label || survey.title);
  }

  function labelForKobo(asset: MonitoreoKoboAssetItem) {
    return koboLabels[asset.uid] ?? (draft.label || asset.name);
  }

  function setPlatform(kind: MonitoreoSourceKind) {
    setDraft((prev) => ({
      ...prev,
      kind,
      base_url: kind === "kobo" ? "https://kf.kobotoolbox.org" : "https://api.surveymonkey.com/v3",
    }));
  }

  async function searchSurveys() {
    setSearchingSm(true);
    setSmError("");
    try {
      const result = await apiSurveyMonkeyMultibaseListSurveys(smQuery, 50, smMonths);
      setSmResults(result.surveys);
      setSmMeta({ count: result.count, totalRecent: result.total_recent, months: result.months });
      setSmSegments((prev) => {
        const next = { ...prev };
        for (const survey of result.surveys) {
          if (next[survey.id] == null) next[survey.id] = draft.dimensions.segmento;
        }
        return next;
      });
      setSmLabels((prev) => {
        const next = { ...prev };
        for (const survey of result.surveys) {
          if (next[survey.id] == null) next[survey.id] = draft.label || survey.title;
        }
        return next;
      });
    } catch (e) {
      setSmError((e as Error).message);
    } finally {
      setSearchingSm(false);
    }
  }

  async function addSurvey(survey: SurveyMonkeyMultibaseListItem) {
    if (configuredSurveyIds.has(survey.id) || pendingSurveyIds.has(survey.id)) return;
    const segmento = segmentForSurvey(survey);
    setPendingSurveyIds((prev) => new Set(prev).add(survey.id));
    try {
      await onAddSurvey(survey, labelForSurvey(survey), {
        segmento,
        servicio: draft.dimensions.servicio,
        territorio: draft.dimensions.territorio,
      });
    } finally {
      setPendingSurveyIds((prev) => {
        const next = new Set(prev);
        next.delete(survey.id);
        return next;
      });
    }
  }

  async function loadKoboAssets() {
    setLoadingKoboAssets(true);
    setKoboError("");
    try {
      const result = await apiMonitoreoKoboAssets(draft.base_url || "https://kf.kobotoolbox.org", 100);
      setKoboAssets(result.assets);
      setKoboSegments((prev) => {
        const next = { ...prev };
        for (const asset of result.assets) {
          if (next[asset.uid] == null) next[asset.uid] = draft.dimensions.segmento;
        }
        return next;
      });
      setKoboLabels((prev) => {
        const next = { ...prev };
        for (const asset of result.assets) {
          if (next[asset.uid] == null) next[asset.uid] = draft.label || asset.name;
        }
        return next;
      });
    } catch (e) {
      setKoboError((e as Error).message);
    } finally {
      setLoadingKoboAssets(false);
    }
  }

  async function addKobo(asset: MonitoreoKoboAssetItem) {
    if (configuredKoboIds.has(asset.uid) || pendingKoboIds.has(asset.uid)) return;
    setPendingKoboIds((prev) => new Set(prev).add(asset.uid));
    try {
      await onAddKobo(asset, labelForKobo(asset), {
        segmento: segmentForKobo(asset),
        servicio: draft.dimensions.servicio,
        territorio: draft.dimensions.territorio,
      });
    } finally {
      setPendingKoboIds((prev) => {
        const next = new Set(prev);
        next.delete(asset.uid);
        return next;
      });
    }
  }

  async function inspectSurvey(survey: SurveyMonkeyMultibaseListItem) {
    setSmInspections((prev) => ({
      ...prev,
      [survey.id]: { loading: true, error: "", data: prev[survey.id]?.data ?? null },
    }));
    try {
      const data = await apiSurveyMonkeyMultibaseInspectSurvey(survey.id, 5, draft.base_url || "https://api.surveymonkey.com/v3");
      setSmInspections((prev) => ({
        ...prev,
        [survey.id]: { loading: false, error: "", data },
      }));
    } catch (e) {
      setSmInspections((prev) => ({
        ...prev,
        [survey.id]: { loading: false, error: (e as Error).message, data: prev[survey.id]?.data ?? null },
      }));
    }
  }

  async function addVisibleSurveys() {
    setSmError("");
    try {
      for (const survey of visibleSurveysToAdd) {
        await addSurvey(survey);
      }
    } catch (e) {
      setSmError((e as Error).message);
    }
  }

  const hasProviderResults = isSm ? smResults.length > 0 : koboAssets.length > 0;

  return (
    <Panel
      className={className}
      eyebrow="Fuentes"
      title={<span className="mon-title-icon"><PlugZap size={16} /> Conectar fuentes</span>}
      actions={<SourceCredentialStatus state={credential} provider={draft.kind} />}
    >
      <div className="mon-source-shell">
        <div className={`mon-source-setup${hasProviderResults ? " has-results" : ""}`}>
          <div className="mon-source-toolbar">
            <div className="mon-source-segment" role="tablist" aria-label="Proveedor de fuente">
              <button type="button" className={draft.kind === "surveymonkey" ? "is-active" : ""} onClick={() => setPlatform("surveymonkey")}>
                SurveyMonkey
              </button>
              <button type="button" className={draft.kind === "kobo" ? "is-active" : ""} onClick={() => setPlatform("kobo")}>
                KoboToolbox
              </button>
            </div>
            <div className="mon-source-summary">
              <span>{configuredSources.length} fuentes</span>
              <span>{activeCount} activas</span>
              <span>{configuredSources.filter((src) => src.kind === "surveymonkey").length} SurveyMonkey</span>
            </div>
          </div>

          {isSm && (
            <div className="mon-sm-picker">
              <div className="mon-sm-picker-title">
                <Layers3 size={15} />
                <span>Encuestas SurveyMonkey</span>
              </div>
              <div className="mon-sm-picker-head">
                <label>
                  <span>Buscar encuestas</span>
                  <input value={smQuery} onChange={(e) => setSmQuery(e.target.value)} placeholder="Título, ID o palabra clave" />
                </label>
                <label>
                  <span>Periodo</span>
                  <select value={smMonths} onChange={(e) => setSmMonths(Number(e.target.value) || 1)}>
                    <option value={1}>Ultimo mes</option>
                    <option value={2}>Ultimos 2 meses</option>
                    <option value={6}>Ultimos 6 meses</option>
                    <option value={12}>Ultimo ano</option>
                    <option value={36}>Historico reciente</option>
                  </select>
                </label>
                <button type="button" onClick={searchSurveys} disabled={searchingSm || saving}>
                  {searchingSm ? <Loader2 size={14} className="pulso-spin" /> : <Search size={14} />}
                  Buscar
                </button>
                <button type="button" onClick={addVisibleSurveys} disabled={saving || !visibleSurveysToAdd.length}>
                  <Plus size={14} />
                  Agregar visibles
                </button>
              </div>
              {smMeta && (
                <div className="mon-sm-meta">
                  {smMeta.count} visibles para el filtro · {smMeta.totalRecent} modificadas en {smMeta.months === 1 ? "el ultimo mes" : `los ultimos ${smMeta.months} meses`}
                </div>
              )}
              {smError && <div className="mon-sm-error">{smError}</div>}
              {smResults.length > 0 ? (
                <div className="mon-sm-results">
                  {smResults.map((survey) => (
                    <SurveyResultRow
                      key={survey.id}
                      survey={survey}
                      sourceLabel={labelForSurvey(survey)}
                      segment={segmentForSurvey(survey)}
                      options={extractedOptions}
                      inspection={smInspections[survey.id]}
                      added={configuredSurveyIds.has(survey.id)}
                      pending={pendingSurveyIds.has(survey.id)}
                      saving={saving}
                      onSourceLabelChange={(value) => setSmLabels((prev) => ({ ...prev, [survey.id]: value }))}
                      onSegmentChange={(value) => setSmSegments((prev) => ({ ...prev, [survey.id]: value }))}
                      onInspect={() => inspectSurvey(survey)}
                      onAdd={() => addSurvey(survey)}
                    />
                  ))}
                </div>
              ) : (
                <SourcePickerEmpty provider="surveymonkey" configuredCount={configuredSources.length} />
              )}
            </div>
          )}

          {!isSm && (
            <div className="mon-sm-picker">
              <div className="mon-sm-picker-title">
                <Layers3 size={15} />
                <span>Proyectos KoboToolbox</span>
              </div>
              <div className="mon-sm-picker-head mon-sm-picker-head--compact">
                <button type="button" onClick={loadKoboAssets} disabled={loadingKoboAssets || saving}>
                  {loadingKoboAssets ? <Loader2 size={14} className="pulso-spin" /> : <Search size={14} />}
                  Cargar proyectos
                </button>
              </div>
              {koboError && <div className="mon-sm-error">{koboError}</div>}
              {koboAssets.length > 0 ? (
                <div className="mon-sm-results">
                  {koboAssets.map((asset) => (
                    <div className="mon-sm-result" key={asset.uid}>
                      <div className="mon-sm-result-main">
                        <strong title={asset.name}>{asset.name}</strong>
                        <span>{asset.uid}{asset.date_modified ? ` · ${formatDate(asset.date_modified)}` : ""}</span>
                      </div>
                      <label className="mon-source-name-field">
                        <span>Nombre de base</span>
                        <input
                          value={labelForKobo(asset)}
                          onChange={(e) => setKoboLabels((prev) => ({ ...prev, [asset.uid]: e.target.value }))}
                          placeholder="Nombre visible"
                        />
                      </label>
                      <DimensionSelect
                        label="Corte principal"
                        value={segmentForKobo(asset)}
                        options={extractedOptions}
                        onChange={(value) => setKoboSegments((prev) => ({ ...prev, [asset.uid]: value }))}
                      />
                      <div className="mon-sm-result-actions">
                        <button type="button" onClick={() => addKobo(asset)} disabled={saving || configuredKoboIds.has(asset.uid) || pendingKoboIds.has(asset.uid)}>
                          {pendingKoboIds.has(asset.uid) ? <Loader2 size={14} className="pulso-spin" /> : <Plus size={14} />}
                          {configuredKoboIds.has(asset.uid) ? "Agregado" : pendingKoboIds.has(asset.uid) ? "Agregando" : "Agregar"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <SourcePickerEmpty provider="kobo" configuredCount={configuredSources.length} />
              )}
            </div>
          )}

        </div>

        <ConfiguredSourcesList sources={configuredSources} saving={saving} onUpdateSource={onUpdateSource} />
      </div>
    </Panel>
  );
}

function SourcePickerEmpty({
  provider,
  configuredCount,
}: {
  provider: MonitoreoSourceKind;
  configuredCount: number;
}) {
  const label = provider === "kobo" ? "proyectos" : "encuestas";
  if (configuredCount > 0) {
    return (
      <div className="mon-source-picker-note">
        <CheckCircle2 size={15} />
        <div>
          <strong>{configuredCount} fuentes ya configuradas</strong>
          <span>Usa la busqueda solo para agregar nuevas {label}.</span>
        </div>
      </div>
    );
  }
  return (
    <div className="mon-source-picker-note is-empty">
      <Search size={15} />
      <div>
        <strong>Busca {label} para empezar</strong>
        <span>Los resultados apareceran aqui antes de agregarlos al monitoreo.</span>
      </div>
    </div>
  );
}

function ConfiguredSourcesList({
  sources,
  saving,
  onUpdateSource,
}: {
  sources: MonitoreoSource[];
  saving: boolean;
  onUpdateSource: (source: MonitoreoSource, patch: Partial<MonitoreoSourcePayload>) => Promise<void>;
}) {
  const activeCount = sources.filter((src) => src.enabled).length;
  return (
    <aside className="mon-source-configured-panel" aria-label="Fuentes configuradas">
      <div className="mon-source-configured-head">
        <div>
          <span className="mon-source-list-head">Fuentes configuradas</span>
          <strong>{sources.length ? `${sources.length} seleccionadas` : "Sin fuentes"}</strong>
        </div>
        <em>{activeCount}/{sources.length || 0} activas</em>
      </div>
      <div className="mon-source-list">
        {sources.map((src) => {
          const dims = sourceDimensionEntries(src.dimensions);
          return (
            <div key={src.id} className={`mon-source-item${src.enabled ? "" : " is-disabled"}`}>
              <div className="mon-source-main">
                <label className="mon-source-alias">
                  <span>Nombre de base</span>
                  <input
                    defaultValue={src.label}
                    disabled={saving}
                    onBlur={(e) => {
                      const label = e.currentTarget.value.trim();
                      if (label && label !== src.label) {
                        void onUpdateSource(src, { label }).catch(() => {
                          e.currentTarget.value = src.label;
                        });
                      } else {
                        e.currentTarget.value = src.label;
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") {
                        e.currentTarget.value = src.label;
                        e.currentTarget.blur();
                      }
                    }}
                  />
                </label>
                {dims.length > 0 && (
                  <div className="mon-source-dim-badges">
                    {dims.map(([key, value]) => <span key={key}>{dimensionLabel(key)}: {value}</span>)}
                  </div>
                )}
              </div>
              <span>{src.kind === "kobo" ? src.asset_uid : src.survey_id}</span>
              {src.enabled ? <em>{src.last_sync_at ? formatDate(src.last_sync_at) : "Sin sync"}</em> : <em>Inactiva</em>}
            </div>
          );
        })}
        {!sources.length && <div className="mon-sm-empty">Aun no hay fuentes configuradas</div>}
      </div>
    </aside>
  );
}

function SurveyResultRow({
  survey,
  sourceLabel,
  segment,
  options,
  inspection,
  added,
  pending,
  saving,
  onSourceLabelChange,
  onSegmentChange,
  onInspect,
  onAdd,
}: {
  survey: SurveyMonkeyMultibaseListItem;
  sourceLabel: string;
  segment: string;
  options: string[];
  inspection?: { loading: boolean; error: string; data: SurveyMonkeyMultibaseInspection | null };
  added: boolean;
  pending: boolean;
  saving: boolean;
  onSourceLabelChange: (value: string) => void;
  onSegmentChange: (value: string) => void;
  onInspect: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="mon-sm-result">
      <div className="mon-sm-result-main">
        <strong title={survey.title}>{survey.title}</strong>
        <span>{survey.id}{survey.date_modified ? ` · ${formatDate(survey.date_modified)}` : ""}</span>
      </div>
      <label className="mon-source-name-field">
        <span>Nombre de base</span>
        <input value={sourceLabel} onChange={(e) => onSourceLabelChange(e.target.value)} placeholder="Nombre visible" />
      </label>
      <DimensionSelect
        label="Corte principal"
        value={segment}
        options={options}
        onChange={onSegmentChange}
      />
      <div className="mon-sm-result-actions">
        <button type="button" onClick={onInspect} disabled={saving || inspection?.loading}>
          {inspection?.loading ? <Loader2 size={14} className="pulso-spin" /> : <Eye size={14} />}
          Ver datos
        </button>
        <button type="button" onClick={onAdd} disabled={saving || added || pending}>
          {pending ? <Loader2 size={14} className="pulso-spin" /> : <Plus size={14} />}
          {added ? "Agregado" : pending ? "Agregando" : "Agregar"}
        </button>
      </div>
      <SurveyInspectionCard inspection={inspection} />
    </div>
  );
}

function SurveyInspectionCard({
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
  const responseTotal = data.responses.total == null ? "Sin total" : `${data.responses.total} respuestas`;
  const columns = data.columns.slice(0, 12);
  const questions = data.questions.slice(0, 8);
  const sampleRows = data.sample_rows.slice(0, 3);
  const sampleColumns = Object.keys(sampleRows[0] ?? {}).slice(0, 8);
  return (
    <div className="mon-sm-inspection">
      <div className="mon-sm-inspection-head">
        <div>
          <span>Datos detectados</span>
          <strong>{data.title}</strong>
        </div>
        {inspection.loading && <Loader2 size={14} className="pulso-spin" />}
      </div>
      {inspection.error && <div className="mon-sm-error">{inspection.error}</div>}
      <div className="mon-sm-inspection-metrics">
        <span>{data.n_pages} páginas</span>
        <span>{data.n_questions} preguntas</span>
        <span>{responseTotal}</span>
        <span>{data.columns.length} columnas</span>
      </div>
      {columns.length > 0 && (
        <div className="mon-sm-column-list">
          {columns.map((column) => (
            <span key={column.name} title={column.examples.join(" · ")}>
              {column.name}
              <em>{column.non_empty}</em>
            </span>
          ))}
        </div>
      )}
      {questions.length > 0 && (
        <div className="mon-sm-question-list">
          {questions.map((question) => (
            <div key={`${question.qid}-${question.pos}`}>
              <strong>Q{question.pos}</strong>
              <span>{question.heading || question.family}</span>
              <em>{question.family}{question.n_choices ? ` · ${question.n_choices} opciones` : ""}</em>
            </div>
          ))}
        </div>
      )}
      {sampleRows.length > 0 && sampleColumns.length > 0 && (
        <div className="mon-sm-sample-wrap" aria-label="Muestra de respuestas">
          <table className="mon-sm-sample">
            <thead>
              <tr>
                {sampleColumns.map((column) => <th key={column}>{column}</th>)}
              </tr>
            </thead>
            <tbody>
              {sampleRows.map((row, index) => (
                <tr key={index}>
                  {sampleColumns.map((column) => <td key={column}>{row[column] || "—"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!data.responses.available && data.responses.error && (
        <div className="mon-sm-error">{data.responses.error}</div>
      )}
      {data.responses.available && !sampleRows.length && (
        <div className="mon-sm-empty">No hay respuestas en la muestra</div>
      )}
    </div>
  );
}

function MappingPanel({
  config,
  setConfig,
  variables,
}: {
  config: MonitoreoConfig;
  setConfig: (next: MonitoreoConfig) => void;
  variables: MonitoreoVariable[];
}) {
  const names = variables.map((v) => v.name);
  const set = (patch: Partial<MonitoreoConfig>) => setConfig({ ...config, ...patch });
  return (
    <Panel eyebrow="Modelo operativo" title={<span className="mon-title-icon"><SlidersHorizontal size={16} /> Variables, cortes y metas</span>}>
      <div className="mon-form mon-form--two">
        <VarSelect label="Enumerador" value={config.enumerator_var} vars={names} onChange={(v) => set({ enumerator_var: v })} />
        <VarSelect label="Fecha" value={config.date_var} vars={names} onChange={(v) => set({ date_var: v })} />
        <VarSelect label="Estado" value={config.status_var} vars={names} onChange={(v) => set({ status_var: v })} />
        <VarSelect label="Duración" value={config.duration_var} vars={names} onChange={(v) => set({ duration_var: v })} />
        <VarSelect label="ID" value={config.id_var} vars={names} onChange={(v) => set({ id_var: v })} />
        <VarSelect label="Contacto" value={config.contact_var} vars={names} onChange={(v) => set({ contact_var: v })} />
        <label>
          <span>Meta total</span>
          <input
            type="number"
            min={0}
            value={config.objetivo_total ?? ""}
            onChange={(e) => set({ objetivo_total: e.target.value ? Number(e.target.value) : null })}
          />
        </label>
        <OutcomeValuePicker
          label="Estados válidos"
          values={config.valid_statuses}
          options={outcomeOptions(config.operational_model.events, config.valid_statuses)}
          onChange={(valid_statuses) => set({ valid_statuses })}
        />
      </div>
      <ChipPicker label="Variables de corte / estrato" vars={names} selected={config.control_vars} onChange={(control_vars) => set({ control_vars })} />
      <ChipPicker label="Campos críticos" vars={names} selected={config.critical_vars} onChange={(critical_vars) => set({ critical_vars })} />
      <GoalsEditor goals={config.goals} vars={names} onChange={(goals) => set({ goals })} />
    </Panel>
  );
}

function VarSelect({ label, value, vars, onChange }: { label: string; value: string; vars: string[]; onChange: (value: string) => void }) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sin asignar</option>
        {vars.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    </label>
  );
}

function ChipPicker({ label, vars, selected, onChange }: { label: string; vars: string[]; selected: string[]; onChange: (next: string[]) => void }) {
  return <TokenVariablePicker label={label} variables={vars} values={selected} onChange={onChange} />;
}

function GoalsEditor({ goals, vars, onChange }: { goals: MonitoreoGoal[]; vars: string[]; onChange: (next: MonitoreoGoal[]) => void }) {
  function update(i: number, next: MonitoreoGoal) {
    onChange(goals.map((g, idx) => idx === i ? next : g));
  }
  return (
    <div className="mon-goals">
      <div className="mon-goals-head">
        <span>Metas por corte / estrato</span>
        <button type="button" onClick={() => onChange([...goals, { filters: {}, meta: 0 }])}>Agregar meta</button>
      </div>
      {goals.length > 0 && (
        <div className="mon-goal-row mon-goal-row--head" aria-hidden="true">
          <span>Variable</span>
          <span>Valor</span>
          <span>Meta</span>
          <span />
        </div>
      )}
      {goals.map((goal, i) => {
        const key = Object.keys(goal.filters)[0] ?? "";
        const value = key ? goal.filters[key] ?? "" : "";
        return (
          <div key={i} className="mon-goal-row">
            <select
              value={key}
              onChange={(e) => update(i, { ...goal, filters: e.target.value ? { [e.target.value]: value } : {} })}
            >
              <option value="">Variable</option>
              {vars.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <input value={value} onChange={(e) => key && update(i, { ...goal, filters: { [key]: e.target.value } })} />
            <input type="number" min={0} value={goal.meta} onChange={(e) => update(i, { ...goal, meta: Number(e.target.value) || 0 })} />
            <button type="button" aria-label="Quitar meta" onClick={() => onChange(goals.filter((_, idx) => idx !== i))}>
              <Trash2 size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function DashboardSummary({ dashboard, syncedAt, nRows }: { dashboard: MonitoreoDashboard; syncedAt: string; nRows: number }) {
  const kpis = dashboard.kpis;
  const valid = numberOrFallback(kpis.valid, 0);
  const total = numberOrFallback(kpis.total, nRows);
  const target = numberOrNull(kpis.target);
  const avancePct = numberOrNull(kpis.avance_pct);
  const ritmoDiario = numberOrNull(kpis.ritmo_diario);
  const durationP95 = numberOrNull(kpis.duration_p95);
  const alerts = numberOrFallback(kpis.inconsistencies, 0);
  const items = [
    { label: "Validas", value: valid, hint: `${total ? Math.round((valid / total) * 100) : 0}% del total`, meter: total ? (valid / total) * 100 : 0, tone: "ready" },
    { label: "Meta", value: target ?? "S/M", hint: target == null ? "sin meta" : `${formatMetric(Math.max(target - valid, 0))} faltan`, meter: target ? (valid / target) * 100 : null, tone: "ready" },
    { label: "Avance", value: avancePct == null ? "S/M" : `${avancePct}%`, hint: avancePct == null ? "sin meta" : "cumplimiento", meter: avancePct, tone: avancePct != null && avancePct >= 70 ? "ready" : "warning" },
    { label: "Ritmo diario", value: ritmoDiario ?? "S/F", hint: "registros/dia", meter: null, tone: "neutral" },
    { label: "P95 tiempo", value: durationP95 == null ? "S/T" : `${Math.round(durationP95)}s`, hint: "cola operativa", meter: null, tone: "neutral" },
    { label: "Alertas", value: alerts, hint: alerts ? "requiere revision" : "sin alertas", meter: total ? Math.min(100, (alerts / total) * 100) : 0, tone: alerts ? "warning" : "ready" },
  ];
  return (
    <div className="mon-dashboard-panel">
      <Panel eyebrow={syncedAt ? `Sync ${formatDate(syncedAt)}` : "Tablero"} title={`${nRows} registros sincronizados`}>
        <div className="mon-kpi-grid">
          {items.map((item) => (
            <div key={item.label} className={`mon-kpi is-${item.tone}`}>
              <div>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
              {item.meter == null ? (
                <div className="mon-kpi-signal" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
              ) : (
                <div className="mon-kpi-track" aria-hidden="true">
                  <i style={{ width: `${Math.max(3, Math.min(100, item.meter))}%` }} />
                </div>
              )}
              <em>{item.hint}</em>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
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

function AcreditacionPanel({
  className,
  acreditacion,
  saving,
  onImport,
  onSaveSeguimiento,
  onCerrar,
}: {
  className?: string;
  acreditacion: MonitoreoAcreditacion;
  saving: boolean;
  onImport: () => void;
  onSaveSeguimiento: (payload: MonitoreoAcreditacionSeguimientoPayload) => Promise<void>;
  onCerrar: (planRefuerzo: string, aprobarBrechas: boolean) => Promise<void>;
}) {
  const componentes = acreditacion.componentes ?? [];
  const [activeId, setActiveId] = useState(componentes[0]?.id ?? "");
  const selected = componentes.find((comp) => comp.id === activeId) ?? componentes[0] ?? null;
  const [draft, setDraft] = useState<SeguimientoDraft>(() => draftFromComponent(selected));
  const [planRefuerzo, setPlanRefuerzo] = useState(acreditacion.plan_refuerzo ?? "");
  const [aprobarBrechas, setAprobarBrechas] = useState(acreditacion.aprobacion_metodologica ?? false);

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
    setPlanRefuerzo(acreditacion.plan_refuerzo ?? "");
    setAprobarBrechas(acreditacion.aprobacion_metodologica ?? false);
  }, [acreditacion.plan_refuerzo, acreditacion.aprobacion_metodologica]);

  async function saveSelected() {
    if (!selected) return;
    const intentos_canal = CANALES.reduce<Partial<MonitoreoAcreditacionIntentos>>((acc, canal) => {
      acc[canal] = Math.max(0, Number(draft.intentos[canal]) || 0);
      return acc;
    }, {});
    await onSaveSeguimiento({
      id: selected.id,
      n_efectivo: Math.max(0, Number(draft.n_efectivo) || 0),
      notas_campo: draft.notas_campo,
      intentos_canal,
    });
  }

  if (!acreditacion.enabled) {
    return (
      <Panel
        className={className}
        eyebrow="Modelo de campo"
        title={<span className="mon-title-icon"><ClipboardCheck size={16} /> Seguimiento multi-corte</span>}
        actions={
          <button type="button" onClick={onImport} disabled={saving}>
            {saving ? <Loader2 size={14} className="pulso-spin" /> : <Link2 size={14} />}
            Importar diseño
          </button>
        }
      >
        <EmptyState
          icon={<ClipboardCheck size={18} />}
          title="Sin estudio multi-corte"
          hint="Importa un diseño validado del calculador para activar seguimiento por cortes o estratos."
          variant="inline"
        />
      </Panel>
    );
  }

  const dashboard = acreditacion.dashboard;
  const cierreListo = dashboard.cierre_habilitado || planRefuerzo.trim().length > 0 || aprobarBrechas;
  return (
    <Panel
      className={className}
      eyebrow={acreditacion.modo_trabajo === "cierre_campo" ? "Cierre de campo" : "Seguimiento de campo"}
      title={<span className="mon-title-icon"><ClipboardCheck size={16} /> {acreditacion.estudio.titulo}</span>}
      actions={
        <div className="mon-acr-actions">
          <button type="button" onClick={onImport} disabled={saving}>
            {saving ? <Loader2 size={14} className="pulso-spin" /> : <Link2 size={14} />}
            Reimportar
          </button>
          <button
            type="button"
            onClick={() => onCerrar(planRefuerzo, aprobarBrechas)}
            disabled={saving || acreditacion.modo_trabajo === "cierre_campo" || !cierreListo}
          >
            <FileCheck2 size={14} />
            Marcar cierre
          </button>
        </div>
      }
    >
      <div className="mon-acr-grid">
        {dashboard.cards.map((card) => {
          const pct = numberOrNull(card.avance_pct);
          const width = Math.max(0, Math.min(100, pct ?? 0));
          const bench = card.benchmark_comparado;
          return (
            <button
              key={card.id}
              type="button"
              className={`mon-acr-card mon-acr-card--${card.estado}${selected?.id === card.id ? " is-active" : ""}`}
              onClick={() => setActiveId(card.id)}
            >
          <span className="mon-acr-card-head">
                <strong>{card.actor}</strong>
                <EstadoBadge estado={card.estado} />
              </span>
              <span className="mon-acr-count">
                {card.n_efectivo.toLocaleString("es-PE")} / {card.n_objetivo?.toLocaleString("es-PE") ?? "S/M"}
              </span>
              <span className="mon-acr-progress" aria-hidden="true"><i style={{ width: `${width}%` }} /></span>
              <span className="mon-acr-meta">
                {pct == null ? "Sin meta" : `${pct.toFixed(1)}%`}
                {bench ? ` · mediana ${formatRatioPct(bench.mediana_historica)}` : ""}
              </span>
            </button>
          );
        })}
      </div>

      {dashboard.alertas.length > 0 && (
        <div className="mon-acr-alerts">
          {dashboard.alertas.slice(0, 5).map((alerta, i) => (
            <div key={`${alerta.componente_id}-${alerta.tipo}-${i}`} className={`mon-acr-alert is-${alerta.severidad}`}>
              <AlertTriangle size={14} />
              <span><strong>{alerta.actor}</strong>: {alerta.mensaje}</span>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="mon-acr-detail">
          <div className="mon-acr-detail-head">
            <div>
              <h3>{selected.actor}</h3>
              <p>{selected.tecnica || "Sin tecnica"} · {selected.variable_control || "Sin variable de control"}</p>
            </div>
            <EstadoBadge estado={selected.seguimiento.cumplimiento.estado} />
          </div>

          <div className="mon-acr-metrics">
            <Metric label="Universo" value={selected.marco.universo_bruto} />
            <Metric label="Marco act." value={selected.marco.marco_actualizado} />
            <Metric label="Contactable" value={selected.marco.marco_contactable} />
            <Metric label="Meta" value={selected.meta.n_objetivo} />
          </div>

          <div className="mon-form mon-form--two mon-acr-form">
            <label>
              <span>n efectivo</span>
              <input
                type="number"
                min={0}
                value={draft.n_efectivo}
                onChange={(e) => setDraft((prev) => ({ ...prev, n_efectivo: e.target.value }))}
              />
            </label>
            {CANALES.map((canal) => (
              <label key={canal}>
                <span>{canal}</span>
                <input
                  type="number"
                  min={0}
                  value={draft.intentos[canal]}
                  onChange={(e) => setDraft((prev) => ({
                    ...prev,
                    intentos: { ...prev.intentos, [canal]: e.target.value },
                  }))}
                />
              </label>
            ))}
          </div>
          <label className="mon-acr-notes">
            <span>Notas de campo</span>
            <textarea value={draft.notas_campo} onChange={(e) => setDraft((prev) => ({ ...prev, notas_campo: e.target.value }))} />
          </label>
          <div className="mon-acr-footer">
            <div className="mon-acr-close-controls">
              <input
                value={planRefuerzo}
                onChange={(e) => setPlanRefuerzo(e.target.value)}
                placeholder="Plan de refuerzo o justificacion de cierre"
              />
              <label>
                <input
                  type="checkbox"
                  checked={aprobarBrechas}
                  onChange={(e) => setAprobarBrechas(e.target.checked)}
                />
                Aprobacion metodologica
              </label>
            </div>
            <button type="button" onClick={saveSelected} disabled={saving}>
              {saving ? <Loader2 size={14} className="pulso-spin" /> : <Save size={14} />}
              Registrar avance
            </button>
          </div>

          {Object.keys(selected.seguimiento.sub_cuotas_progreso).length > 0 && (
            <MiniTable
              title="Subcuotas"
              rows={Object.entries(selected.seguimiento.sub_cuotas_progreso).map(([celda, row]) => ({ celda, ...row }))}
            />
          )}
          {selected.seguimiento.bolsa_operativa.length > 0 && (
            <MiniTable title="Bolsa operativa" rows={selected.seguimiento.bolsa_operativa} />
          )}
        </div>
      )}
    </Panel>
  );
}

function EstadoBadge({ estado }: { estado: MonitoreoAcreditacion["dashboard"]["cards"][number]["estado"] }) {
  const icon = estado === "cumple_meta"
    ? <CheckCircle2 size={13} />
    : estado === "brecha_relevante"
      ? <XCircle size={13} />
      : estado === "brecha_menor_documentada"
        ? <AlertTriangle size={13} />
        : <Target size={13} />;
  return <span className={`mon-acr-badge is-${estado}`}>{icon}{estadoLabel(estado)}</span>;
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="mon-acr-metric">
      <span>{label}</span>
      <strong>{value == null ? "S/D" : value.toLocaleString("es-PE")}</strong>
    </div>
  );
}

function MiniTable({ title, rows }: { title: string; rows: Record<string, unknown>[] }) {
  return (
    <div className="mon-acr-mini">
      <h4>{title}</h4>
      <DataTable rows={rows as MonitoreoRow[]} />
    </div>
  );
}

function TablePanel({ title, icon, rows }: { title: string; icon: ReactNode; rows: MonitoreoRow[] }) {
  return (
    <div className="mon-table-panel">
      <Panel eyebrow="Tablero" title={<span className="mon-title-icon">{icon}{title}</span>}>
        <div className="mon-panel-fill">
          {rows.length ? (
            <DataTable rows={rows} />
          ) : (
            <EmptyState icon={<Activity size={18} />} title="Sin filas" variant="inline" />
          )}
        </div>
      </Panel>
    </div>
  );
}

function DataTable({ rows }: { rows: MonitoreoRow[] }) {
  const columns = useMemo(() => Array.from(new Set(rows.flatMap((r) => Object.keys(r)))).slice(0, 10), [rows]);
  return (
    <div className="mon-table-wrap">
      <table className="mon-table">
        <thead>
          <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.slice(0, 80).map((row, i) => (
            <tr key={i}>
              {columns.map((c) => <td key={c}>{formatCell(row[c])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown) {
  if (value == null) return "";
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString("es-PE") : value.toFixed(1);
  return String(value);
}

function estadoLabel(estado: MonitoreoAcreditacion["dashboard"]["cards"][number]["estado"]) {
  switch (estado) {
    case "cumple_meta":
      return "Cumple";
    case "brecha_menor_documentada":
      return "Brecha menor";
    case "brecha_relevante":
      return "Brecha relevante";
    default:
      return "Sin meta";
  }
}

function formatRatioPct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "S/D";
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}
