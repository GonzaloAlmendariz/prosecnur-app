// Base del perfil telefónico: contrato de navegación, tipos y primitivas.
//
// Por qué existe. `TelefonicoMonitoreoPage.tsx` está congelado a crecimiento
// (`agentic/manifest.json`) y aun así subió 136 líneas sobre su línea base
// durante la tanda de pulido de julio. Igual que en el router de R, la causa no
// fue un cambio grande sino la falta de un hogar: el preámbulo del perfil
// —rutas, catálogos de pestañas, tipos del dominio y las primitivas de formato
// que usa todo el archivo— vivía en la cabecera del page-file porque no había
// otro sitio donde ponerlo.
//
// Qué vive aquí:
//
//   1. El contrato de navegación del perfil: `ACREDITACION_ROUTE`,
//      `TELEFONICO_ROUTE` y los catálogos de pestañas por sección
//      (`ACREDITACION_*_TABS`, `TELEFONICO_VISIBLE_*`).
//   2. Los tipos del dominio del perfil y sus guardas.
//   3. Las primitivas compartidas de formato y lectura de filas (`num`, `pct`,
//      `pctFrom`, `rowNumber`, `columnLabel`, `unknownArray`).
//
// Sobre la independencia telefónico ↔ acreditación: este archivo NO se comparte
// con el perfil de acreditación. La decisión vigente es que son productos
// independientes y que el costo de arreglar dos veces la semántica de familia
// se acepta como precio de esa independencia. Extraer aquí no es un paso hacia
// fusionarlos: es darle a telefónico su propia base, dentro de su propia
// carpeta.
//
// La extracción es un movimiento literal: los cuerpos no se tocaron; solo se
// añadió `export` a lo que el page-file consume.

import type { CSSProperties } from "react";
import { AlertCircle, BarChart3, CalendarRange, CheckCircle2, ClipboardCheck, Clock3, ContactRound, Download, Layers3, Link2, ListChecks, PhoneCall, ShieldAlert, Table2, Target } from "lucide-react";
import { MONITOREO_MODOS } from "../../core/monitoreoRegistry";
import { normalizeInternalQueries, summarizeInternalCases } from "../../internalQueries";
import { fmt } from "./formato";
import type {
  MonitoreoAcreditacion,
  MonitoreoAcreditacionComponente,
  MonitoreoAcreditacionIntentos,
  MonitoreoAcreditacionReports,
  MonitoreoRow,
  MonitoreoSource,
  MonitoreoState,
} from "../../../../api/client";
import type { AcreditacionSourceTab } from "./pestanasDeFuentes";
export { pct } from "../../core/formatoComun";
import { pct } from "../../core/formatoComun";

export const ACREDITACION_ROUTE = MONITOREO_MODOS.find((route) => route.family === "acreditacion") ?? MONITOREO_MODOS[0];
export const TELEFONICO_ROUTE = MONITOREO_MODOS.find((route) => route.family === "telefonico") ?? ACREDITACION_ROUTE;
export const ACREDITACION_DEFAULT_ACTORS = ["Estudiantes", "Docentes", "Egresados", "Administrativos", "Empleadores"];
export const KOBO_DEFAULT_BASE_URL = "https://kf.kobotoolbox.org";

export function normalizeKoboBaseUrl(value: unknown) {
  const base = String(value ?? "").trim() || KOBO_DEFAULT_BASE_URL;
  return base.replace(/\/+$/, "") || KOBO_DEFAULT_BASE_URL;
}
export type AcreditacionSourcePresetKey = "base_trabajada" | "barrido_telefonico" | "respuestas_surveymonkey";
export type AcreditacionSourcePreset = {
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
export const ACREDITACION_SOURCE_PRESETS: AcreditacionSourcePreset[] = [
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
    icon: ListChecks,
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
export type AcreditacionModelVisibleTab = typeof ACREDITACION_MODEL_TABS[number]["key"];
export type AcreditacionModelTab = AcreditacionModelVisibleTab | "enlaces" | "casos" | "reglas";
export const ACREDITACION_CONSULTA_TABS = [
  { key: "plataforma", label: "Registros en plataforma", detail: "Respuestas y cruce", icon: ListChecks },
  { key: "base", label: "Estado de la base", detail: "Actor por actor", icon: Table2 },
  { key: "cruces", label: "Cruces efectivos", detail: "Razón de cruce", icon: Link2 },
  { key: "subsanacion", label: "Subsanación", detail: "Decisión auditada", icon: ShieldAlert },
] as const;
export type AcreditacionConsultaTab = typeof ACREDITACION_CONSULTA_TABS[number]["key"];
export const ACREDITACION_PHONE_TABS = [
  { key: "resumen", label: "Resumen", detail: "Cumplimiento y casos", icon: PhoneCall },
  { key: "consultados", label: "Consultados", detail: "Efectivas Kobo", icon: CheckCircle2 },
  { key: "dia", label: "Día", detail: "Efectivas Kobo", icon: CalendarRange },
  { key: "tiempos", label: "Tiempos", detail: "Duración Kobo", icon: Clock3 },
  { key: "incidencia", label: "Sin efectiva", detail: "Insistencia y reintentos", icon: AlertCircle },
  { key: "responsables", label: "Responsables", detail: "Equipo y carga", icon: ContactRound },
  { key: "alertas", label: "Alertas", detail: "Alertas reales", icon: ShieldAlert },
  { key: "supervision", label: "Supervisión telefónica", detail: "Control y muestra", icon: ClipboardCheck },
] as const;
export type AcreditacionPhoneTab = typeof ACREDITACION_PHONE_TABS[number]["key"];
export const ACREDITACION_ADVANCE_TABS = [
  { key: "resumen", label: "Resumen", detail: "Avance general", icon: BarChart3 },
  { key: "actores", label: "Actores", detail: "Brechas por unidad", icon: Layers3 },
  { key: "encuestas", label: "Encuestas", detail: "Fuentes y canales", icon: ListChecks },
  { key: "detalle", label: "Detalle", detail: "Controles", icon: Table2 },
  { key: "salidas", label: "Salidas", detail: "PDF y Sheets", icon: Download },
] as const;
export type AcreditacionAdvanceTab = typeof ACREDITACION_ADVANCE_TABS[number]["key"];
export type AcreditacionLocalTabKey = AcreditacionSourceTab | AcreditacionModelTab | AcreditacionConsultaTab | AcreditacionPhoneTab | AcreditacionAdvanceTab;
export const TELEFONICO_VISIBLE_PHONE_TABS: readonly AcreditacionPhoneTab[] = ["resumen", "tiempos", "incidencia", "responsables", "alertas"];
export const TELEFONICO_VISIBLE_ADVANCE_TABS: readonly AcreditacionAdvanceTab[] = ["resumen", "actores", "salidas"];

export function isTelefonicoVisiblePhoneTab(tab: AcreditacionLocalTabKey): tab is AcreditacionPhoneTab {
  return TELEFONICO_VISIBLE_PHONE_TABS.includes(tab as AcreditacionPhoneTab);
}

export function isTelefonicoVisibleAdvanceTab(tab: AcreditacionLocalTabKey): tab is AcreditacionAdvanceTab {
  return TELEFONICO_VISIBLE_ADVANCE_TABS.includes(tab as AcreditacionAdvanceTab);
}

export type AcreditacionProfileMode = "acreditacion" | "telefonico";
export type AcreditacionActionStatus = { tone: "success" | "error" | "info"; message: string } | null;
export type AcreditacionCaseReconciliationPayload = {
  response_id: string;
  action: "keep_excluded" | "include_with_caveat";
  candidate_id?: string;
  note?: string;
};

export function isTelefonicoMonitoreoState(state?: MonitoreoState | null) {
  return (state?.monitoreo_profile?.family ?? state?.config?.monitoreo_profile?.family) === "telefonico";
}

export function formatCaseLabel(value: number) {
  return `${fmt(value)} caso${value === 1 ? "" : "s"}`;
}


export function pctFrom(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return "S/D";
  return `${((value / total) * 100).toLocaleString("es-PE", { maximumFractionDigits: 1 })}%`;
}

export function num(value: unknown, fallback = 0) {
  if (value == null || value === "") return fallback;
  const parsed = Number(String(value).replace(/%/g, "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function unknownArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function rowNumber(row: Record<string, unknown>, keys: string[], fallback = 0) {
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

export type SeguimientoDraft = {
  n_efectivo: string;
  notas_campo: string;
  intentos: Record<keyof MonitoreoAcreditacionIntentos, string>;
};

export const CANALES: Array<keyof MonitoreoAcreditacionIntentos> = ["email", "whatsapp", "sms", "telefono", "presencial"];

export function draftFromComponent(comp: MonitoreoAcreditacionComponente | null): SeguimientoDraft {
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

export function columnLabel(column: string) {
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

export function stateFromReports(
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

export function cumplimientoLabel(estado: MonitoreoAcreditacion["dashboard"]["cards"][number]["estado"]) {
  if (estado === "cumple_meta") return "Cumple";
  if (estado === "brecha_menor_documentada") return "Brecha menor";
  if (estado === "brecha_relevante") return "Brecha relevante";
  return "Sin meta";
}

export function AcreditacionCumplimientoBadge({ estado }: { estado: MonitoreoAcreditacion["dashboard"]["cards"][number]["estado"] }) {
  return (
    <span className={`mon-acr-model-badge is-${estado}`}>
      {estado === "cumple_meta" ? <CheckCircle2 size={13} /> : estado === "sin_objetivo" ? <Target size={13} /> : <AlertCircle size={13} />}
      {cumplimientoLabel(estado)}
    </span>
  );
}

export function AcreditacionMetric({ label, value, hint }: { label: string; value: number | null | undefined; hint?: string }) {
  return (
    <div className="mon-acr-model-metric">
      <span>{label}</span>
      <strong>{value == null || !Number.isFinite(Number(value)) ? "S/D" : fmt(value)}</strong>
      {hint ? <em>{hint}</em> : null}
    </div>
  );
}


/**
 * Reparte una pista apilada en porcentajes que **suman exactamente 100**.
 *
 * Decisión 1 del goal visual. Las barras de insistencia daban 130, 129, 129 y
 * 133 % en las cuatro filas medidas, y eran dos defectos superpuestos:
 *
 *   1. El denominador era «casos sin respuesta» mientras los segmentos contaban
 *      casos por número de intentos. Conjuntos distintos: una fila con buckets
 *      de 1+2+5 = 8 casos se dividía entre 6.
 *   2. El suelo de visibilidad se aplicaba y ya. Con seis segmentos diminutos
 *      son 18 % de piso, así que la suma pasaba de 100 aunque el denominador
 *      fuera correcto.
 *
 * Al pasar de 100 el apilado desborda y `overflow: hidden` recorta el segmento
 * dominante —justo el que más importa—. Por eso el suelo se aplica y **después**
 * se renormaliza: un segmento chico sigue viéndose y el reparto cierra.
 *
 * El denominador es la suma de los propios valores, así que no puede volver a
 * quedar desalineado de los numeradores que reparte.
 */
export function anchosDeSegmentos(valores: number[], minPct = 3): number[] {
  const positivos = valores.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const total = positivos.reduce((suma, v) => suma + v, 0);
  if (total <= 0) return positivos.map(() => 0);
  const conSuelo = positivos.map((v) => (v > 0 ? Math.max(minPct, (v / total) * 100) : 0));
  const sumaConSuelo = conSuelo.reduce((suma, p) => suma + p, 0);
  return conSuelo.map((p) => (p / sumaConSuelo) * 100);
}
