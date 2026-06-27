import type {
  MonitoreoAssistedReview,
  MonitoreoAssistedReviewCandidate,
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
  response: string;
  state: string;
  crossing: string;
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
  excluded: number;
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
  response: "",
  state: "",
  crossing: "",
};

const EMPTY_INTERNAL_QUERIES: MonitoreoInternalQueries = {
  schema: "monitoreo_acreditacion_internal_queries_v1",
  cases: [],
  case_rollup: [],
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
    case_rollup: arrayOrEmpty(value.case_rollup).map(normalizeInternalCase),
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
    if (filters.response && internalCaseResponseStateValue(item) !== filters.response) return false;
    if (filters.state && !internalCaseMatchesState(item, filters.state)) return false;
    if (filters.crossing && internalCaseCrossingValue(item) !== filters.crossing) return false;
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
    responseStates: uniqueSorted(cases.map(internalCaseResponseStateValue), (a, b) => internalCaseResponseStateLabel(a).localeCompare(internalCaseResponseStateLabel(b), "es")),
    crossings: uniqueSorted(cases.map(internalCaseCrossingValue), (a, b) => internalCaseCrossingLabel(a).localeCompare(internalCaseCrossingLabel(b), "es")),
    states: uniqueSorted([
      ...(cases.some(internalCaseIsReviewable) ? ["reviewable"] : []),
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
      if (item.advancement === "excluded") acc.excluded += 1;
      if (boolish(item.pending_exit)) acc.pendingExit += 1;
      if (numberish(item.duplicate_count) > 1) acc.duplicates += 1;
      return acc;
    },
    {
      total: 0,
      effective: 0,
      partial: 0,
      refusal: 0,
      pending: 0,
      excluded: 0,
      review: 0,
      pendingExit: 0,
      duplicates: 0,
    },
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

export function internalCaseResponseStateValue(item: Pick<MonitoreoInternalQueryCase, "platform_state" | "advancement">) {
  const platform = normalizeSearch(item.platform_state);
  const advancement = normalizeSearch(item.advancement);
  const key = platform || advancement;
  if (key.includes("completa") || key.includes("completed") || key === "effective") return "complete";
  if (key.includes("parcial") || key.includes("partial")) return "partial";
  if (key.includes("rechazo") || key.includes("refusal")) return "refusal";
  if (key.includes("sin respuesta") || key === "pending") return "pending";
  return cleanString(item.platform_state || item.advancement) || "pending";
}

export function internalCaseResponseStateLabel(value: string) {
  const key = normalizeSearch(value);
  if (key === "complete") return "Completa";
  if (key === "partial") return "Parcial";
  if (key === "refusal") return "Rechazo";
  if (key === "pending") return "Sin respuesta";
  return cleanString(value) || "Sin respuesta";
}

export function internalCaseCrossingValue(item: Pick<MonitoreoInternalQueryCase, "base_result" | "issue_type" | "identity_status">) {
  const base = normalizeSearch(item.base_result);
  const issue = normalizeSearch(item.issue_type);
  const identity = normalizeSearch(item.identity_status);
  if (!base && !issue && !identity) return "sin_base";
  if (base.includes("correo") || base.includes("email")) return "cruzo_correo";
  if (base === "cruzo" || base.startsWith("cruzo") || base.includes("cruce exacto") || base.includes("en base")) return "cruzo_llave";
  if (base.includes("sin llave") || issue.includes("sin llave") || identity.includes("sin llave")) return "sin_llave";
  if (base.includes("sin cruce") || base.includes("fuera") || issue.includes("fuera base") || identity.includes("fuera base")) return "sin_cruce";
  if (base.includes("sin base")) return "sin_base";
  return cleanString(item.base_result) || "sin_base";
}

export function internalCaseCrossingLabel(value: string) {
  const key = normalizeSearch(value);
  if (key === "cruzo llave" || key === "cruzo_llave") return "Cruzó por llave";
  if (key === "cruzo correo" || key === "cruzo_correo") return "Cruzó por correo";
  if (key === "sin llave" || key === "sin_llave") return "Sin llave";
  if (key === "sin cruce" || key === "sin_cruce") return "Sin cruce";
  if (key === "sin base" || key === "sin_base") return "Sin base";
  return cleanString(value) || "Sin base";
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
    item.duplicate_group_key,
    item.duplicate_group_size,
    item.duplicate_counting_status,
    item.identity_status,
    item.identity_label,
    item.channel_key_strategy,
    item.channel_key_strategy_label,
    item.primary_identity_label,
    item.primary_identity_value,
    item.secondary_identity_label,
    item.secondary_identity_value,
    item.review_priority,
    item.phone_audit?.cv_id,
    item.phone_audit?.final_codpulso,
    item.phone_audit?.declared_phone,
    item.phone_audit?.responsible,
    item.phone_audit?.phone_match_level,
    item.phone_audit?.phone_number_evidence,
    item.phone_audit?.recommended_action,
    item.phone_audit?.link_base?.record,
    item.phone_audit?.link_base?.person_label,
    item.phone_audit?.link_base?.case_key,
    item.phone_audit?.link_base?.status,
    item.phone_audit?.link_base?.responsible,
    item.phone_audit?.link_base?.source,
    item.phone_audit?.manual_code_base?.record,
    item.phone_audit?.manual_code_base?.person_label,
    item.phone_audit?.manual_code_base?.case_key,
    item.phone_audit?.manual_code_base?.status,
    item.phone_audit?.manual_code_base?.responsible,
    item.phone_audit?.manual_code_base?.source,
    item.counts_in_advance ? "cuenta avance conteo" : "",
    item.partial_answered_questions,
    item.partial_total_questions,
    item.partial_completion_pct,
    item.partial_last_question,
    item.partial_next_question,
    item.assisted_review?.primary_key,
    item.assisted_review?.declared_code,
    item.assisted_review?.declared_email,
    item.assisted_review?.declared_name,
    ...(item.assisted_review?.warnings ?? []),
    ...(item.assisted_review?.candidates ?? []).flatMap((candidate) => [
      candidate.person_label,
      candidate.case_key,
      candidate.base_record,
      candidate.base_source,
      candidate.match_label,
      candidate.evidence_label,
      candidate.evidence_level,
      ...(candidate.evidence_fields ?? []),
      candidate.current_status,
    ]),
    ...(item.assisted_review?.assignment_candidates ?? []).flatMap((candidate) => [
      candidate.person_label,
      candidate.case_key,
      candidate.base_record,
      candidate.base_source,
      candidate.match_label,
      candidate.evidence_label,
      candidate.evidence_level,
      ...(candidate.evidence_fields ?? []),
      candidate.current_status,
    ]),
    item.assisted_review?.manual_decision?.assigned_person_label,
    item.assisted_review?.manual_decision?.assigned_case_key,
    item.assisted_review?.manual_decision?.note,
	    item.advancement === "pending" || item.issue_type === "sin_respuesta" ? "sin respuesta pendiente base universo no respondio no respondió faltante" : "",
	    item.pending_exit ? "sale de pendientes faltantes barrido recuperado" : "",
	    item.recovery_collector ? "recopilador recuperacion faltantes presencial" : "",
  ].join(" ");
}

function normalizePhoneAudit(value: MonitoreoInternalQueryCase["phone_audit"]): MonitoreoInternalQueryCase["phone_audit"] {
  if (!value || typeof value !== "object") return null;
  const normalizeBase = (base: NonNullable<MonitoreoInternalQueryCase["phone_audit"]>["link_base"]) => {
    if (!base || typeof base !== "object") return undefined;
    const record = cleanString(base.record);
    const person_label = cleanString(base.person_label);
    const case_key = cleanString(base.case_key);
    const status = cleanString(base.status);
    const responsible = cleanString(base.responsible);
    const source = cleanString(base.source);
    if (!record && !person_label && !case_key && !status && !responsible && !source) return undefined;
    return { record, person_label, case_key, status, responsible, source };
  };
  const normalized = {
    cv_id: cleanString(value.cv_id),
    final_codpulso: cleanString(value.final_codpulso),
    declared_phone: cleanString(value.declared_phone),
    responsible: cleanString(value.responsible),
    phone_match_level: cleanString(value.phone_match_level),
    phone_number_evidence: cleanString(value.phone_number_evidence),
    recommended_action: cleanString(value.recommended_action),
    link_base: normalizeBase(value.link_base),
    manual_code_base: normalizeBase(value.manual_code_base),
  };
  const hasPayload = [
    normalized.cv_id,
    normalized.final_codpulso,
    normalized.declared_phone,
    normalized.responsible,
    normalized.phone_match_level,
    normalized.phone_number_evidence,
    normalized.recommended_action,
    normalized.link_base?.record,
    normalized.manual_code_base?.record,
  ].some(Boolean);
  return hasPayload ? normalized : null;
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
    duplicate_group_key: cleanString(value.duplicate_group_key),
    duplicate_group_size: Math.max(1, numberish(value.duplicate_group_size ?? value.duplicate_count, 1)),
    counts_in_advance: boolish(value.counts_in_advance),
    duplicate_counting_status: cleanString(value.duplicate_counting_status),
    partial_answered_questions: numberish(value.partial_answered_questions),
    partial_total_questions: numberish(value.partial_total_questions),
    partial_completion_pct: numberish(value.partial_completion_pct),
    partial_last_question: cleanString(value.partial_last_question),
    partial_next_question: cleanString(value.partial_next_question),
    identity_status: cleanString(value.identity_status),
    identity_label: cleanString(value.identity_label),
    channel_key_strategy: cleanString(value.channel_key_strategy),
    channel_key_strategy_label: cleanString(value.channel_key_strategy_label),
    primary_identity_label: cleanString(value.primary_identity_label),
    primary_identity_value: cleanString(value.primary_identity_value),
    secondary_identity_label: cleanString(value.secondary_identity_label),
    secondary_identity_value: cleanString(value.secondary_identity_value),
    review_priority: numberish(value.review_priority),
    phone_audit: normalizePhoneAudit(value.phone_audit),
    assisted_review: normalizeAssistedReview(value.assisted_review),
  };
}

function normalizeAssistedReview(value: MonitoreoAssistedReview | null | undefined): MonitoreoAssistedReview | null {
  if (!value || typeof value !== "object") return null;
  const normalizeCandidate = (candidate: MonitoreoAssistedReviewCandidate) => ({
    candidate_id: cleanString(candidate.candidate_id),
    person_label: cleanString(candidate.person_label),
    case_key: cleanString(candidate.case_key),
    base_record: cleanString(candidate.base_record),
    base_source: cleanString(candidate.base_source),
    base_row: numberish(candidate.base_row),
    base_status: cleanString(candidate.base_status),
    match_type: cleanString(candidate.match_type),
    match_label: cleanString(candidate.match_label),
    evidence_level: cleanString(candidate.evidence_level),
    evidence_label: cleanString(candidate.evidence_label),
    evidence_score: numberish(candidate.evidence_score),
    evidence_fields: arrayOrEmpty(candidate.evidence_fields).map(cleanString).filter(Boolean),
    current_status: cleanString(candidate.current_status),
    already_effective: boolish(candidate.already_effective),
    assignment_allowed: candidate.assignment_allowed == null ? undefined : boolish(candidate.assignment_allowed),
    suggested: candidate.suggested == null ? undefined : boolish(candidate.suggested),
  });
  const candidateIsUseful = (candidate: MonitoreoAssistedReviewCandidate) => candidate.candidate_id || candidate.case_key || candidate.person_label;
  const candidates = arrayOrEmpty(value.candidates).map(normalizeCandidate).filter(candidateIsUseful);
  const assignmentCandidates = arrayOrEmpty(value.assignment_candidates).map(normalizeCandidate).filter(candidateIsUseful);
  const manual = value.manual_decision && typeof value.manual_decision === "object" ? {
    response_id: cleanString(value.manual_decision.response_id),
    actor: cleanString(value.manual_decision.actor),
    action: cleanString(value.manual_decision.action),
    declared_code: cleanString(value.manual_decision.declared_code),
    declared_email: cleanString(value.manual_decision.declared_email),
    assigned_person_label: cleanString(value.manual_decision.assigned_person_label),
    assigned_case_key: cleanString(value.manual_decision.assigned_case_key),
    assigned_base_source: cleanString(value.manual_decision.assigned_base_source),
    assigned_base_row: numberish(value.manual_decision.assigned_base_row),
    match_type: cleanString(value.manual_decision.match_type),
    previous_status: cleanString(value.manual_decision.previous_status),
    new_status: cleanString(value.manual_decision.new_status),
    note: cleanString(value.manual_decision.note),
    decided_at: cleanString(value.manual_decision.decided_at),
  } : null;
  const warnings = arrayOrEmpty<string>(value.warnings).map(cleanString).filter(Boolean);
  const hasPayload = boolish(value.eligible) || candidates.length || assignmentCandidates.length || warnings.length || manual ||
    cleanString(value.primary_key) || cleanString(value.declared_code) || cleanString(value.declared_email) || cleanString(value.declared_name);
  if (!hasPayload) return null;
  return {
    eligible: boolish(value.eligible),
    primary_key: cleanString(value.primary_key),
    declared_code: cleanString(value.declared_code),
    declared_email: cleanString(value.declared_email),
    declared_name: cleanString(value.declared_name),
    candidates,
    assignment_candidates: assignmentCandidates,
    warnings,
    manual_decision: manual,
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
  if (state === "reviewable") return internalCaseIsReviewable(item);
  if (state === "non_effective") return item.advancement !== "effective";
  return item.advancement === state || item.platform_state === state || item.issue_type === state || item.identity_status === state;
}

function internalCaseIsReviewable(item: MonitoreoInternalQueryCase) {
  const issueType = normalizeSearch(item.issue_type);
  const baseResult = normalizeSearch(item.base_result);
  const identityStatus = normalizeSearch(item.identity_status);
  const phoneMatch = normalizeSearch(item.phone_audit?.phone_match_level);
  const review = item.assisted_review;
  return Boolean(
    review?.eligible ||
    review?.manual_decision ||
    (review?.candidates?.length ?? 0) > 0 ||
    (review?.assignment_candidates?.length ?? 0) > 0 ||
    (review?.warnings?.length ?? 0) > 0 ||
    issueType === "fuera base" ||
    issueType === "sin llave" ||
    issueType === "incluido con salvedad" ||
    ["conflicto telefonico", "no identificable", "fuera base", "duplicado", "parcial revisable"].includes(identityStatus) ||
    phoneMatch.includes("conflicto") ||
    baseResult.includes("sin cruce") ||
    baseResult.includes("sin llave"),
  );
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
