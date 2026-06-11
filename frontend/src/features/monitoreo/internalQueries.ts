import type {
  MonitoreoInternalQueries,
  MonitoreoInternalQueryCase,
  MonitoreoInternalQueryIssue,
  MonitoreoInternalQueryTotal,
} from "../../api/client";

export type InternalQueryFilters = {
  search: string;
  actor: string;
  date: string;
  channel: string;
  collector: string;
  source: string;
  state: string;
};

export type InternalQueryEvidenceMode = "efectivas" | "casos" | "faltantes" | "duplicados" | "diferencias";

export type InternalQueryBlockKey = "avance" | "cruces" | "casos" | "campo" | "auditoria";

export type InternalQueryEvidenceView = "resumen" | "casos" | "flujo" | "alertas" | "distribucion";

export type InternalQueryAnswerType = "advance" | "crossing" | "case_lookup" | "field" | "audit";

export type InternalQuerySummary = {
  total: number;
  effective: number;
  partial: number;
  refusal: number;
  pending: number;
  review: number;
  pendingExit: number;
  duplicates: number;
};

export type InternalQueryTemplate = {
  id: string;
  block: InternalQueryBlockKey;
  question: string;
  helper: string;
  requiredFilters: Array<keyof InternalQueryFilters>;
  answerType: InternalQueryAnswerType;
  evidenceViews: InternalQueryEvidenceView[];
  preferredMode: InternalQueryEvidenceMode;
  defaultFilters?: Partial<InternalQueryFilters>;
};

const INTERNAL_QUERY_MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export const INTERNAL_QUERY_BLOCKS: Array<{
  key: InternalQueryBlockKey;
  label: string;
  description: string;
  kickoff: string;
}> = [
  {
    key: "casos",
    label: "Caso / persona",
    description: "CodPulso, nombre, correo, respuesta y decisión final.",
    kickoff: "Empieza por la unidad mínima: el caso.",
  },
  {
    key: "avance",
    label: "Actor / unidad",
    description: "Actor, carrera, ciclo, año, curso o grupo.",
    kickoff: "Agrega casos solo después de validar la base.",
  },
  {
    key: "cruces",
    label: "Responsable / campo",
    description: "Barrido, faltantes, asignación y salida de pendientes.",
    kickoff: "Mira qué debe mover campo mañana.",
  },
  {
    key: "campo",
    label: "Canal / recopilador",
    description: "Teléfono, enlace web, WhatsApp, QR, correo y usos especiales.",
    kickoff: "Distingue encuesta, recopilador y uso operativo.",
  },
  {
    key: "auditoria",
    label: "Auditoría",
    description: "Descuadres entre universo, SurveyMonkey, barrido y reporte.",
    kickoff: "Explica qué no cuadra y qué decisión tomar.",
  },
];

export const INTERNAL_QUERY_TEMPLATES: InternalQueryTemplate[] = [
  {
    id: "avance-general",
    block: "avance",
    question: "¿Cómo va cada actor o unidad del estudio?",
    helper: "Resume efectivas, parciales, rechazos y casos por revisar sin perder que la unidad real es la persona/caso.",
    requiredFilters: ["actor", "date"],
    answerType: "advance",
    evidenceViews: ["resumen", "distribucion", "casos"],
    preferredMode: "efectivas",
  },
  {
    id: "avance-reporte-interno",
    block: "avance",
    question: "¿El avance del reporte coincide con el avance interno?",
    helper: "Usa los mismos casos deduplicados para revisar descuadres antes de enviar cliente.",
    requiredFilters: ["actor", "source"],
    answerType: "audit",
    evidenceViews: ["resumen", "alertas", "casos"],
    preferredMode: "diferencias",
  },
  {
    id: "cruce-universo-respuestas",
    block: "cruces",
    question: "¿Qué casos del universo ya contestaron y cuáles siguen pendientes para campo?",
    helper: "Contrasta base universo, SurveyMonkey y operación para separar respuesta real de pendiente operativo.",
    requiredFilters: ["actor", "source"],
    answerType: "crossing",
    evidenceViews: ["resumen", "casos", "alertas", "distribucion"],
    preferredMode: "casos",
  },
  {
    id: "cruce-faltantes-salida",
    block: "cruces",
    question: "¿Quién estaba en faltantes o barrido y ya no debería perseguirse?",
    helper: "Valida recuperados incluso si usaron el QR original, WhatsApp u otro recopilador válido.",
    requiredFilters: ["actor", "date", "collector"],
    answerType: "crossing",
    evidenceViews: ["flujo", "casos", "resumen"],
    preferredMode: "faltantes",
  },
  {
    id: "caso-especifico",
    block: "casos",
    question: "¿Qué pasó con este CodPulso o persona?",
    helper: "Busca por código, correo, nombre o response_id y revisa la ficha 360 del caso.",
    requiredFilters: ["search"],
    answerType: "case_lookup",
    evidenceViews: ["casos", "resumen", "alertas"],
    preferredMode: "casos",
  },
  {
    id: "casos-sin-llave",
    block: "casos",
    question: "¿Qué casos aparecen sin código, correo, nombre o llave?",
    helper: "Ubica respuestas útiles para seguimiento pero no defendibles como avance.",
    requiredFilters: ["actor", "source"],
    answerType: "audit",
    evidenceViews: ["alertas", "casos"],
    preferredMode: "diferencias",
    defaultFilters: { state: "sin_llave" },
  },
  {
    id: "campo-recopiladores",
    block: "campo",
    question: "¿Qué produjo cada canal o recopilador y qué uso operativo tuvo?",
    helper: "Separa encuesta, recopilador, canal operativo, QR, teléfono, WhatsApp y enlaces especiales sin duplicar personas.",
    requiredFilters: ["actor", "channel", "collector", "date"],
    answerType: "field",
    evidenceViews: ["resumen", "distribucion", "casos", "flujo"],
    preferredMode: "efectivas",
  },
  {
    id: "campo-faltantes-presencial",
    block: "campo",
    question: "¿Qué entró por Faltantes_presencial y qué entró por QR original?",
    helper: "Trata Faltantes_presencial como recuperación válida y compara con otros QR usados por faltantes.",
    requiredFilters: ["actor", "collector", "date"],
    answerType: "field",
    evidenceViews: ["flujo", "casos", "resumen"],
    preferredMode: "faltantes",
  },
  {
    id: "campo-telefonico",
    block: "campo",
    question: "¿El campo telefónico coincide con lo validado en SurveyMonkey?",
    helper: "Distingue efectivos reportados por campo, respuestas de plataforma y usos especiales como WhatsApp.",
    requiredFilters: ["actor", "channel", "source"],
    answerType: "field",
    evidenceViews: ["alertas", "casos", "resumen"],
    preferredMode: "diferencias",
  },
  {
    id: "auditoria-consentimiento",
    block: "auditoria",
    question: "¿Cuántos completados son rechazos por consentimiento?",
    helper: "Separa completed de SurveyMonkey de efectiva real cuando la persona no acepta consentimiento.",
    requiredFilters: ["actor", "source"],
    answerType: "audit",
    evidenceViews: ["alertas", "casos", "resumen"],
    preferredMode: "diferencias",
    defaultFilters: { state: "refusal" },
  },
  {
    id: "auditoria-duplicados",
    block: "auditoria",
    question: "¿Esto está duplicado o mal contado?",
    helper: "Agrupa por llave de caso y muestra la regla aplicada para contar una sola vez.",
    requiredFilters: ["actor", "search"],
    answerType: "audit",
    evidenceViews: ["alertas", "casos", "resumen"],
    preferredMode: "duplicados",
  },
  {
    id: "auditoria-reporte-cliente",
    block: "auditoria",
    question: "¿Por qué una fuente, el avance interno o el reporte dicen algo distinto?",
    helper: "Busca si la diferencia viene de parciales, rechazos, sin llave, fuera de base, duplicados o recopiladores usados para otro canal.",
    requiredFilters: ["actor", "source", "date"],
    answerType: "audit",
    evidenceViews: ["alertas", "resumen", "casos", "distribucion"],
    preferredMode: "diferencias",
  },
];

export const EMPTY_INTERNAL_QUERY_FILTERS: InternalQueryFilters = {
  search: "",
  actor: "",
  date: "",
  channel: "",
  collector: "",
  source: "",
  state: "",
};

const EMPTY_INTERNAL_QUERIES: MonitoreoInternalQueries = {
  schema: "monitoreo_acreditacion_internal_queries_v1",
  cases: [],
  totals: {
    actor: [],
    date: [],
    channel: [],
    source: [],
    collector: [],
  },
  pending_exit: [],
  issues: [],
  flow: {
    nodes: [],
    links: [],
  },
};

export function internalQueryTemplatesForBlock(block: InternalQueryBlockKey) {
  return INTERNAL_QUERY_TEMPLATES.filter((template) => template.block === block);
}

export function internalQueryTemplateById(id: string) {
  return INTERNAL_QUERY_TEMPLATES.find((template) => template.id === id) ?? INTERNAL_QUERY_TEMPLATES[0];
}

export function normalizeInternalQueries(value: MonitoreoInternalQueries | null | undefined): MonitoreoInternalQueries {
  if (!value) return EMPTY_INTERNAL_QUERIES;
  return {
    schema: cleanString(value.schema) || EMPTY_INTERNAL_QUERIES.schema,
    cases: arrayOrEmpty(value.cases).map(normalizeInternalCase),
    totals: {
      actor: arrayOrEmpty(value.totals?.actor).map(normalizeInternalTotal),
      date: arrayOrEmpty(value.totals?.date).map(normalizeInternalTotal),
      channel: arrayOrEmpty(value.totals?.channel).map(normalizeInternalTotal),
      source: arrayOrEmpty(value.totals?.source).map(normalizeInternalTotal),
      collector: arrayOrEmpty(value.totals?.collector).map(normalizeInternalTotal),
    },
    pending_exit: arrayOrEmpty(value.pending_exit).map(normalizeInternalCase),
    issues: arrayOrEmpty(value.issues).map(normalizeInternalIssue),
    flow: {
      nodes: arrayOrEmpty(value.flow?.nodes).map((node) => ({
        id: cleanString(node.id),
        label: cleanString(node.label),
      })).filter((node) => node.label),
      links: arrayOrEmpty(value.flow?.links).map((link) => ({
        source: cleanString(link.source),
        target: cleanString(link.target),
        value: numberish(link.value),
      })).filter((link) => link.source && link.target && link.value > 0),
    },
  };
}

export function filterInternalQueryCases(cases: MonitoreoInternalQueryCase[], filters: InternalQueryFilters) {
  const q = normalizeSearch(filters.search);
  return cases.filter((item) => {
    if (filters.actor && item.actor !== filters.actor) return false;
    if (filters.date && item.date !== filters.date) return false;
    if (filters.channel && item.channel !== filters.channel) return false;
    if (filters.collector && internalQueryCollectorValue(item) !== filters.collector) return false;
    if (filters.source && item.source_label !== filters.source) return false;
    if (filters.state && !internalCaseMatchesState(item, filters.state)) return false;
    if (!q) return true;
    return matchesSearchTokens(internalCaseSearchText(item), q);
  });
}

export function internalQueryOptions(cases: MonitoreoInternalQueryCase[]) {
  return {
    actors: uniqueSorted(cases.map((item) => item.actor)),
    dates: uniqueSorted(cases.map((item) => item.date), compareInternalQueryDateValues),
    channels: uniqueSorted(cases.map((item) => item.channel)),
    collectors: uniqueSorted(cases.map(internalQueryCollectorValue)),
    sources: uniqueSorted(cases.map((item) => item.source_label)),
    states: uniqueSorted([
      ...(cases.some((item) => item.advancement !== "effective") ? ["non_effective"] : []),
      ...cases.map((item) => item.advancement),
      ...cases.map((item) => item.platform_state),
      ...cases.map((item) => item.issue_type),
    ]),
  };
}

export function summarizeInternalCases(cases: MonitoreoInternalQueryCase[]) {
  return cases.reduce<InternalQuerySummary>(
    (acc, item) => {
      acc.total += 1;
      if (item.advancement === "effective") acc.effective += 1;
      else if (item.advancement === "partial") acc.partial += 1;
      else if (item.advancement === "refusal") acc.refusal += 1;
      else if (item.advancement === "pending") acc.pending += 1;
      else acc.review += 1;
      if (boolish(item.pending_exit)) acc.pendingExit += 1;
      if (numberish(item.duplicate_count) > 1) acc.duplicates += 1;
      return acc;
    },
    { total: 0, effective: 0, partial: 0, refusal: 0, pending: 0, review: 0, pendingExit: 0, duplicates: 0 },
  );
}

export function buildInternalExecutiveAnswer(
  template: InternalQueryTemplate,
  summary: InternalQuerySummary,
  allSummary: InternalQuerySummary,
  activeFilters: boolean,
) {
  const scope = activeFilters ? "con los filtros activos" : "en este corte";
  if (template.answerType === "advance") {
    return {
      tone: "effective" as const,
      label: "Respuesta ejecutiva",
      title: `${formatPlainNumber(summary.effective)} efectivas reales ${scope}.`,
      detail: `${formatPlainNumber(summary.pending)} sin respuesta, ${formatPlainNumber(summary.partial)} parciales y ${formatPlainNumber(summary.refusal)} rechazos quedan separados del avance.`,
    };
  }
  if (template.answerType === "crossing") {
    return {
      tone: "pending" as const,
      label: "Cruce operativo",
      title: `${formatPlainCaseLabel(summary.pending)} sigue${summary.pending === 1 ? "" : "n"} sin respuesta ${scope}.`,
      detail: `${formatPlainCaseLabel(summary.pendingExit)} sale${summary.pendingExit === 1 ? "" : "n"} de pendientes por respuesta válida reconciliada.`,
    };
  }
  if (template.answerType === "case_lookup") {
    return {
      tone: "base" as const,
      label: "Caso trazable",
      title: `${formatPlainCaseLabel(summary.total)} visible${summary.total === 1 ? "" : "s"} de ${formatPlainCaseLabel(allSummary.total)}.`,
      detail: "Selecciona una fila para ver base, respuesta SurveyMonkey, recopilador, regla y decisión de avance.",
    };
  }
  if (template.answerType === "field") {
    return {
      tone: "pending" as const,
      label: "Lectura de campo",
      title: `${formatPlainNumber(summary.effective)} efectivas reales y ${formatPlainNumber(summary.pendingExit)} recuperadas ${scope}.`,
      detail: "Canal y recopilador explican por dónde entró el caso, pero no cambian la unidad de conteo.",
    };
  }
  return {
    tone: summary.duplicates || summary.refusal || summary.review ? "warning" as const : "base" as const,
    label: "Auditoría",
    title: `${formatPlainCaseLabel(summary.partial + summary.refusal + summary.review + summary.duplicates)} explica${summary.partial + summary.refusal + summary.review + summary.duplicates === 1 ? "" : "n"} posibles descuadres ${scope}.`,
    detail: "Sin respuesta, parciales, rechazos, sin llave, fuera de base y duplicados se separan antes de comparar con avance o reporte.",
  };
}

export function internalQueryCaseTone(item: MonitoreoInternalQueryCase): "effective" | "partial" | "refusal" | "warning" | "muted" {
  if (item.advancement === "effective") return "effective";
  if (item.advancement === "partial") return "partial";
  if (item.advancement === "refusal") return "refusal";
  if (item.advancement === "pending") return "muted";
  if (item.issue_type === "sin_llave" || item.issue_type === "fuera_base" || numberish(item.duplicate_count) > 1) return "warning";
  return "muted";
}

export function internalQueryIssueTone(item: MonitoreoInternalQueryIssue): "danger" | "warning" | "info" {
  const severity = normalizeSearch(item.severity);
  if (severity.includes("alta")) return "danger";
  if (severity.includes("media")) return "warning";
  return "info";
}

export function internalQueryTotalLabel(item: MonitoreoInternalQueryTotal, key: "actor" | "date" | "channel" | "source" | "collector") {
  return cleanString(item[key]) || "Sin dato";
}

export function parseInternalQueryDate(value: unknown): Date | null {
  const text = cleanString(value);
  if (!text || normalizeSearch(text).includes("sin fecha")) return null;
  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]) - 1;
    const day = Number(iso[3]);
    const date = new Date(year, month, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const local = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (local) {
    const day = Number(local[1]);
    const month = Number(local[2]) - 1;
    const rawYear = Number(local[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const date = new Date(year, month, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const fallback = new Date(text);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function formatInternalQueryDateLabel(value: unknown) {
  const text = cleanString(value);
  const date = parseInternalQueryDate(text);
  if (!date) return text || "Sin fecha";
  return `${date.getDate()} ${INTERNAL_QUERY_MONTHS_ES[date.getMonth()] ?? ""}`.trim();
}

export function formatInternalQueryDateAxisLabel(value: unknown) {
  const text = cleanString(value);
  const date = parseInternalQueryDate(text);
  if (!date) return text || "Sin fecha";
  const month = (INTERNAL_QUERY_MONTHS_ES[date.getMonth()] ?? "").slice(0, 3);
  return `${date.getDate()} ${month}`.trim();
}

export function compareInternalQueryDateValues(a: string, b: string) {
  const aDate = parseInternalQueryDate(a);
  const bDate = parseInternalQueryDate(b);
  if (aDate && bDate) return aDate.getTime() - bDate.getTime();
  if (aDate) return -1;
  if (bDate) return 1;
  return a.localeCompare(b, "es");
}

export function internalQueryCollectorValue(item: MonitoreoInternalQueryCase) {
  return cleanString(item.collector_name) || cleanString(item.collector_id) || "Sin responsable";
}

export function internalQueryCollectorDisplayLabel(
  value: Pick<MonitoreoInternalQueryCase, "collector_name" | "collector_id" | "channel" | "actor" | "source_label"> | string,
) {
  const item = typeof value === "string"
    ? { collector_name: value, collector_id: "", channel: "", actor: "", source_label: "" }
    : value;
  const rawName = cleanString(item.collector_name);
  const rawId = cleanString(item.collector_id);
  const raw = rawName || rawId;
  const key = normalizeSearch(raw);
  if (!key || isUnassignedCollectorLabel(key)) return "Sin responsable";

  const direct = friendlyCollectorName(raw, key);
  if (direct) return direct;

  const channel = friendlyChannelPrefix(item.channel);
  const actor = cleanString(item.actor);
  if (channel && actor) return `${channel} ${actor}`;
  if (channel) return channel;

  const source = cleanString(item.source_label).replace(/^SurveyMonkey\s+/i, "");
  if (source && !technicalIdLike(source)) return source;
  return `Recopilador ${shortInternalId(raw)}`;
}

export function internalCaseSearchText(item: MonitoreoInternalQueryCase) {
  return [
    item.actor,
    item.person_label,
    item.case_key,
    item.response_id,
    item.date,
    item.source_label,
    item.channel,
    item.collector_id,
    item.collector_name,
    internalQueryCollectorDisplayLabel(item),
    item.platform_state,
    dateSearchTokens(item.date),
    formatInternalQueryDateLabel(item.date),
    item.base_result,
    item.base_record,
    item.base_source,
    item.base_status,
    item.decision,
    item.issue_type,
    item.rule,
    item.advancement === "pending" || item.issue_type === "sin_respuesta" ? "sin respuesta pendiente base universo no respondio no respondió faltante" : "",
    item.pending_exit ? "sale de pendientes faltantes barrido recuperado" : "",
    item.recovery_collector ? "recopilador recuperacion faltantes presencial" : "",
  ].join(" ");
}

function normalizeInternalCase(value: MonitoreoInternalQueryCase): MonitoreoInternalQueryCase {
  return {
    actor: cleanString(value.actor),
    person_label: cleanString(value.person_label),
    case_key: cleanString(value.case_key),
    response_id: cleanString(value.response_id),
    date: cleanString(value.date),
    source_id: cleanString(value.source_id),
    source_label: cleanString(value.source_label),
    channel: cleanString(value.channel),
    collector_id: cleanString(value.collector_id),
    collector_name: cleanString(value.collector_name),
    platform_state: cleanString(value.platform_state),
    base_result: cleanString(value.base_result),
    base_record: cleanString(value.base_record),
    base_source: cleanString(value.base_source),
    base_status: cleanString(value.base_status),
    decision: cleanString(value.decision),
    decision_reason: cleanString(value.decision_reason),
    advancement: cleanString(value.advancement),
    issue_type: cleanString(value.issue_type),
    rule: cleanString(value.rule),
    pending_exit: boolish(value.pending_exit),
    recovery_collector: boolish(value.recovery_collector),
    response_row: numberish(value.response_row),
    duplicate_count: Math.max(1, numberish(value.duplicate_count, 1)),
  };
}

function normalizeInternalTotal(value: MonitoreoInternalQueryTotal): MonitoreoInternalQueryTotal {
  return {
    actor: cleanString(value.actor),
    date: cleanString(value.date),
    channel: cleanString(value.channel),
    source: cleanString(value.source),
    collector: cleanString(value.collector),
    total: numberish(value.total),
    efectivas: numberish(value.efectivas),
    parciales: numberish(value.parciales),
    rechazos: numberish(value.rechazos),
    pendientes: numberish(value.pendientes),
    revision: numberish(value.revision),
    salen_de_pendientes: numberish(value.salen_de_pendientes),
  };
}

function normalizeInternalIssue(value: MonitoreoInternalQueryIssue): MonitoreoInternalQueryIssue {
  return {
    issue_type: cleanString(value.issue_type),
    label: cleanString(value.label),
    severity: cleanString(value.severity),
    actor: cleanString(value.actor),
    case_key: cleanString(value.case_key),
    response_id: cleanString(value.response_id),
    count: Math.max(1, numberish(value.count, 1)),
    detail: cleanString(value.detail),
  };
}

function arrayOrEmpty<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function uniqueSorted(values: string[], compare: (a: string, b: string) => number = (a, b) => a.localeCompare(b, "es")) {
  return Array.from(new Set(values.map(cleanString).filter(Boolean))).sort(compare);
}

function normalizeSearch(value: unknown) {
  return cleanString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@.]+/g, " ")
    .trim();
}

function matchesSearchTokens(text: string, normalizedQuery: string) {
  const normalizedText = normalizeSearch(text);
  return normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => normalizedText.includes(token));
}

function internalCaseMatchesState(item: MonitoreoInternalQueryCase, state: string) {
  if (state === "non_effective") return item.advancement !== "effective";
  return item.advancement === state || item.platform_state === state || item.issue_type === state;
}

function dateSearchTokens(value: string) {
  const text = cleanString(value);
  const date = parseInternalQueryDate(text);
  if (!date) return text;
  const weekdays = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  return `${text} ${formatInternalQueryDateLabel(text)} ${weekdays[date.getDay()]} ${date.getDate()}`;
}

function formatPlainNumber(value: number) {
  return new Intl.NumberFormat("es-PE").format(value);
}

function formatPlainCaseLabel(value: number) {
  return `${formatPlainNumber(value)} caso${value === 1 ? "" : "s"}`;
}

function cleanString(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function numberish(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolish(value: unknown) {
  if (typeof value === "boolean") return value;
  return ["1", "true", "t", "yes", "si", "sí"].includes(cleanString(value).toLowerCase());
}

function isUnassignedCollectorLabel(key: string) {
  return key === "sin responsable"
    || key === "sin asignar"
    || key === "sin asignacion"
    || key === "no asignado"
    || key === "no asignada"
    || key.includes("sin responsable")
    || key.includes("sin asignar");
}

function friendlyCollectorName(raw: string, key: string) {
  if (/^collector\s+/i.test(raw)) return raw.replace(/^collector/i, "Enlace").trim();
  if (/^colector\s+/i.test(raw)) return raw.replace(/^colector/i, "Enlace").trim();
  if (key.includes("qr")) return raw.replace(/^qr[_\s-]*/i, "Enlace QR ").replace(/\s+/g, " ").trim();
  if (key.includes("faltante")) return raw.replace(/_/g, " ").replace(/^faltantes/i, "Faltantes").trim();
  if (key.includes("web link") || key.includes("weblink") || /^web\d*$/i.test(raw)) return "";
  if (technicalIdLike(raw)) return "";
  return raw;
}

function friendlyChannelPrefix(value: unknown) {
  const key = normalizeSearch(value);
  if (!key) return "";
  if (key.includes("telefon")) return "Telefónico";
  if (key.includes("whatsapp")) return "WhatsApp";
  if (key.includes("sms")) return "SMS";
  if (key.includes("qr") || key.includes("presencial")) return "Enlace QR";
  if (key.includes("correo") || key.includes("email") || key.includes("mail")) return "Correo";
  return cleanString(value);
}

function technicalIdLike(value: string) {
  const text = cleanString(value);
  const key = normalizeSearch(text);
  return /^\d{6,}$/.test(text)
    || /^[a-f0-9]{10,}$/i.test(text)
    || /^(collector|colector|web|link)[-_]?\d+$/i.test(text)
    || key === "web link"
    || key === "weblink";
}

function shortInternalId(value: string) {
  const text = cleanString(value);
  if (text.length <= 8) return text || "local";
  return text.slice(-6);
}
