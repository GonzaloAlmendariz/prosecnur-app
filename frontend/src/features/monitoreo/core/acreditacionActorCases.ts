import type { MonitoreoInternalQueryCase } from "../../../api/client";
import type { InternalQueryFilters } from "../internalQueries";

export const ACTOR_ALL_KEY = "__all__";

export type ActorSidebarItem = {
  key: string;
  label: string;
  total: number;
  reviewable: number;
  missingKey: number;
  outsideBase: number;
  duplicates: number;
  phone: number;
  effective: number;
  partial: number;
  refusal: number;
  pending: number;
  disabled: boolean;
};

export type ActorCaseReport = {
  actorKey: string;
  label: string;
  total: number;
  identified: number;
  effective: number;
  partial: number;
  refusal: number;
  pending: number;
  reviewable: number;
  missingKey: number;
  outsideBase: number;
  duplicates: number;
  phone: number;
};

export type ReconciliationGroupModel = {
  id: "reviewable" | "matched" | "complete-review" | "missing-key" | "outside-base" | "duplicates" | "partials" | "assisted";
  label: string;
  title: string;
  detail: string;
  cases: MonitoreoInternalQueryCase[];
  filters: Partial<InternalQueryFilters>;
  tone: "ready" | "warning" | "danger" | "base";
};

export type CaseCrossingExplanation = {
  title: string;
  detail: string;
  evidenceLabel: string;
  evidenceDetail: string;
  decisionLabel: string;
  action: string;
  tone: "ready" | "warning" | "danger" | "base";
};

const CANONICAL_ACTORS = ["Administrativos", "Docentes", "Egresados", "Estudiantes"];

function cleanText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeKey(value: unknown) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function titleLabel(value: unknown) {
  const text = cleanText(value);
  if (!text) return "Sin dato";
  return text
    .toLocaleLowerCase("es-PE")
    .replace(/(^|[\s,.'’()-])(\p{L})/gu, (_match, prefix: string, letter: string) => (
      `${prefix}${letter.toLocaleUpperCase("es-PE")}`
    ));
}

function compact(parts: Array<unknown>) {
  return parts.map(cleanText).filter(Boolean).join(" · ");
}

function caseIdentity(item: MonitoreoInternalQueryCase) {
  return item.response_id || item.case_key || `${item.actor}-${item.response_row}-${item.person_label}`;
}

function uniqueCases(cases: MonitoreoInternalQueryCase[]) {
  const seen = new Set<string>();
  const out: MonitoreoInternalQueryCase[] = [];
  cases.forEach((item) => {
    const key = caseIdentity(item);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
}

function platformLabel(value: unknown) {
  const key = normalizeKey(value);
  if (key.includes("completa") || key.includes("completed")) return "Completa";
  if (key.includes("parcial") || key.includes("partial")) return "Parcial";
  if (key.includes("rechazo") || key.includes("refusal")) return "Rechazo";
  if (key.includes("sin respuesta") || key === "pending") return "Sin respuesta";
  return titleLabel(value || "Sin estado");
}

function baseLabel(value: unknown) {
  const key = normalizeKey(value);
  if (!key) return "Sin base";
  if (key === "cruzo" || key.includes("cruzo") || key.includes("en base") || key.includes("cruce exacto")) return "En base";
  if (key.includes("sin llave")) return "Sin llave";
  if (key.includes("fuera") || key.includes("sin cruce")) return "Fuera de base";
  return titleLabel(value);
}

function advancementLabel(value: unknown) {
  const key = normalizeKey(value);
  if (key === "effective") return "Efectiva real";
  if (key === "partial") return "Parcial";
  if (key === "refusal") return "Rechazo";
  if (key === "pending") return "Sin respuesta";
  if (key === "included_review") return "Incluida auditada";
  if (key === "excluded") return "Excluida";
  return titleLabel(value || "Revisión");
}

function hasBaseCross(item: MonitoreoInternalQueryCase) {
  const base = normalizeKey(item.base_result);
  return base.includes("cruzo") ||
    base.includes("en base") ||
    base.includes("cruce exacto") ||
    item.advancement === "effective" ||
    item.advancement === "included_review";
}

function isMissingKey(item: MonitoreoInternalQueryCase) {
  const issue = normalizeKey(item.issue_type);
  const base = normalizeKey(item.base_result);
  const status = normalizeKey(item.identity_status);
  return issue.includes("sin_llave") ||
    issue.includes("sin llave") ||
    base.includes("sin llave") ||
    status.includes("no identificable");
}

function isOutsideBase(item: MonitoreoInternalQueryCase) {
  const issue = normalizeKey(item.issue_type);
  const base = normalizeKey(item.base_result);
  const status = normalizeKey(item.identity_status);
  return issue.includes("fuera_base") ||
    issue.includes("fuera base") ||
    issue.includes("codigo_fuera_base") ||
    base.includes("fuera de base") ||
    base.includes("sin cruce") ||
    status.includes("fuera");
}

function isDuplicate(item: MonitoreoInternalQueryCase) {
  return Number(item.duplicate_count ?? item.duplicate_group_size ?? 0) > 1 ||
    normalizeKey(item.issue_type).includes("duplic");
}

function isPhoneAudit(item: MonitoreoInternalQueryCase) {
  const status = normalizeKey(item.identity_status);
  const strategy = normalizeKey(item.channel_key_strategy);
  const phoneMatch = normalizeKey(item.phone_audit?.phone_match_level);
  return Boolean(item.phone_audit) ||
    status.includes("conflicto telefonico") ||
    strategy.includes("telefono") ||
    phoneMatch.includes("conflicto");
}

function isPhoneReview(item: MonitoreoInternalQueryCase) {
  const status = normalizeKey(item.identity_status);
  const phoneMatch = normalizeKey(item.phone_audit?.phone_match_level);
  if (!isPhoneAudit(item)) return false;
  return status.includes("conflicto") ||
    phoneMatch.includes("conflicto") ||
    Boolean(item.phone_audit?.recommended_action);
}

function isCompleteReview(item: MonitoreoInternalQueryCase) {
  return platformLabel(item.platform_state) === "Completa" &&
    item.advancement !== "effective" &&
    item.advancement !== "included_review";
}

function isAssisted(item: MonitoreoInternalQueryCase) {
  const review = item.assisted_review;
  return Boolean(
    review?.eligible ||
    (review?.candidates?.length ?? 0) ||
    (review?.assignment_candidates?.length ?? 0) ||
    (review?.warnings?.length ?? 0),
  );
}

function isPartial(item: MonitoreoInternalQueryCase) {
  return item.advancement === "partial";
}

function isReviewable(item: MonitoreoInternalQueryCase) {
  return isPhoneReview(item) ||
    isCompleteReview(item) ||
    isMissingKey(item) ||
    isOutsideBase(item) ||
    isDuplicate(item) ||
    isPartial(item) ||
    isAssisted(item);
}

function partialProgress(item: MonitoreoInternalQueryCase) {
  const total = Number(item.partial_total_questions ?? 0);
  const answered = Number(item.partial_answered_questions ?? 0);
  if (!total) return "";
  const pct = Number(item.partial_completion_pct ?? Math.round((answered / Math.max(1, total)) * 100));
  const stop = item.partial_next_question
    ? `siguiente: ${item.partial_next_question}`
    : item.partial_last_question
      ? `ultima: ${item.partial_last_question}`
      : "";
  return `${answered}/${total} preguntas reales, ${pct}%${stop ? `, ${stop}` : ""}`;
}

function duplicateDetail(item: MonitoreoInternalQueryCase) {
  const size = Number(item.duplicate_group_size ?? item.duplicate_count ?? 0);
  if (size <= 1) return "";
  const status = cleanText(item.duplicate_counting_status);
  const group = cleanText(item.duplicate_group_key || item.case_key);
  return compact([
    `${size} respuestas para el mismo caso`,
    group ? `grupo ${group}` : "",
    status,
  ]);
}

function identityEvidence(item: MonitoreoInternalQueryCase) {
  const review = item.assisted_review;
  const declaredCode = cleanText(review?.declared_code || item.case_key);
  const declaredEmail = cleanText(review?.declared_email);
  const declaredName = cleanText(review?.declared_name);
  if (cleanText(item.primary_identity_label) || cleanText(item.primary_identity_value)) {
    return {
      label: cleanText(item.primary_identity_label) || "Llave principal",
      detail: compact([
        item.primary_identity_value,
        item.secondary_identity_value ? `${item.secondary_identity_label || "Evidencia secundaria"}: ${item.secondary_identity_value}` : "",
      ]),
    };
  }
  if (declaredCode && declaredEmail) return { label: "Código + correo", detail: `${declaredCode} · ${declaredEmail}` };
  if (declaredCode) return { label: "Código declarado", detail: declaredCode };
  if (declaredEmail) return { label: "Correo declarado", detail: declaredEmail };
  if (declaredName) return { label: "Nombre declarado", detail: titleLabel(declaredName) };
  if (item.response_id) return { label: "Response ID", detail: item.response_id };
  return { label: "Sin evidencia", detail: "revisar manualmente" };
}

function caseSort(a: MonitoreoInternalQueryCase, b: MonitoreoInternalQueryCase) {
  return (b.review_priority ?? 0) - (a.review_priority ?? 0) ||
    cleanText(a.actor).localeCompare(cleanText(b.actor), "es") ||
    cleanText(a.person_label || a.case_key || a.response_id).localeCompare(cleanText(b.person_label || b.case_key || b.response_id), "es");
}

export function filterCasesByActor(cases: MonitoreoInternalQueryCase[], actorKey: string) {
  if (!actorKey || actorKey === ACTOR_ALL_KEY) return cases;
  return cases.filter((item) => item.actor === actorKey);
}

export function buildReconciliationGroups(cases: MonitoreoInternalQueryCase[], actorKey = ACTOR_ALL_KEY): ReconciliationGroupModel[] {
  const scoped = filterCasesByActor(cases, actorKey);
  const groups: ReconciliationGroupModel[] = [
    {
      id: "reviewable",
      label: "Por revisar",
      title: "No cruzan o requieren decisión",
      detail: "Respuestas de plataforma que no pueden contarse sin revisar llave, base, duplicado, parcial o teléfono.",
      cases: scoped.filter(isReviewable),
      filters: { state: "reviewable" },
      tone: "warning",
    },
    {
      id: "matched",
      label: "Cruzan",
      title: "Cruzan con la base del actor",
      detail: "Respuestas vinculadas a una persona del universo activo y listas para leer su trazabilidad.",
      cases: scoped.filter(hasBaseCross),
      filters: { state: "effective" },
      tone: "ready",
    },
    {
      id: "complete-review",
      label: "Completas",
      title: "Completas por revisar",
      detail: "Respuestas completas que todavia no pueden entrar sin cruce o decisión.",
      cases: scoped.filter(isCompleteReview),
      filters: { state: "reviewable" },
      tone: "warning",
    },
    {
      id: "missing-key",
      label: "No identificables",
      title: "No se pudo identificar a la persona",
      detail: "No hay código, correo, enlace o nombre suficiente para defender el cruce.",
      cases: scoped.filter(isMissingKey),
      filters: { state: "sin_llave" },
      tone: "danger",
    },
    {
      id: "outside-base",
      label: "Fuera de base",
      title: "El código no está en la base del actor",
      detail: "Hay un dato de identificación, pero no pertenece al universo activo.",
      cases: scoped.filter(isOutsideBase),
      filters: { state: "fuera_base" },
      tone: "warning",
    },
    {
      id: "duplicates",
      label: "Duplicados",
      title: "Más de una respuesta para el mismo caso",
      detail: "La revisión confirma cuál respuesta cuenta y evita doble conteo.",
      cases: scoped.filter(isDuplicate),
      filters: { state: "duplicado_caso" },
      tone: "warning",
    },
    {
      id: "partials",
      label: "Parciales",
      title: "Parciales con avance relevante",
      detail: "Muestra cuánto avanzó la persona y dónde se detuvo.",
      cases: scoped.filter(isPartial),
      filters: { state: "partial" },
      tone: "base",
    },
    {
      id: "assisted",
      label: "Candidatos",
      title: "Candidatos por correo, código o nombre",
      detail: "Hay evidencia secundaria, pero requiere una decisión auditada.",
      cases: scoped.filter(isAssisted),
      filters: { state: "reviewable" },
      tone: "warning",
    },
  ];
  return groups.map((group) => ({
    ...group,
    cases: uniqueCases(group.cases).sort(caseSort),
    tone: group.cases.length ? group.tone : "ready",
  }));
}

export function buildActorCaseReport(cases: MonitoreoInternalQueryCase[], actorKey = ACTOR_ALL_KEY): ActorCaseReport {
  const scoped = filterCasesByActor(cases, actorKey);
  const reviewable = uniqueCases(scoped.filter(isReviewable)).length;
  return scoped.reduce<ActorCaseReport>(
    (acc, item) => {
      acc.total += 1;
      if (hasBaseCross(item)) acc.identified += 1;
      if (item.advancement === "effective") acc.effective += 1;
      else if (item.advancement === "partial") acc.partial += 1;
      else if (item.advancement === "refusal") acc.refusal += 1;
      else if (item.advancement === "pending") acc.pending += 1;
      if (isMissingKey(item)) acc.missingKey += 1;
      if (isOutsideBase(item)) acc.outsideBase += 1;
      if (isDuplicate(item)) acc.duplicates += 1;
      if (isPhoneReview(item)) acc.phone += 1;
      return acc;
    },
    {
      actorKey,
      label: actorKey && actorKey !== ACTOR_ALL_KEY ? actorKey : "Todos",
      total: 0,
      identified: 0,
      effective: 0,
      partial: 0,
      refusal: 0,
      pending: 0,
      reviewable,
      missingKey: 0,
      outsideBase: 0,
      duplicates: 0,
      phone: 0,
    },
  );
}

export function actorSidebarItemsFromCases(cases: MonitoreoInternalQueryCase[]) {
  const actualActors = Array.from(new Set(cases.map((item) => cleanText(item.actor)).filter(Boolean)));
  const orderedActors = [
    ...CANONICAL_ACTORS.filter((actor) => actualActors.includes(actor)),
    ...actualActors.filter((actor) => !CANONICAL_ACTORS.includes(actor)).sort((a, b) => a.localeCompare(b, "es")),
  ];
  const keys = [ACTOR_ALL_KEY, ...orderedActors];
  return keys.map<ActorSidebarItem>((key) => {
    const report = buildActorCaseReport(cases, key);
    return {
      key,
      label: report.label,
      total: report.total,
      reviewable: report.reviewable,
      missingKey: report.missingKey,
      outsideBase: report.outsideBase,
      duplicates: report.duplicates,
      phone: report.phone,
      effective: report.effective,
      partial: report.partial,
      refusal: report.refusal,
      pending: report.pending,
      disabled: key !== ACTOR_ALL_KEY && report.total === 0,
    };
  });
}

export function buildCaseCrossingExplanation(item: MonitoreoInternalQueryCase): CaseCrossingExplanation {
  const evidence = identityEvidence(item);
  const platform = platformLabel(item.platform_state);
  const base = baseLabel(item.base_result);
  const status = normalizeKey(item.identity_status);
  const strategy = normalizeKey(item.channel_key_strategy);
  const decisionLabel = advancementLabel(item.advancement);
  const reviewReason = cleanText(item.decision_reason || item.rule || item.issue_type);

  if (item.phone_audit) {
    const linkPerson = titleLabel(item.phone_audit.link_base?.person_label || item.phone_audit.link_base?.case_key);
    const manualPerson = titleLabel(item.phone_audit.manual_code_base?.person_label || item.phone_audit.manual_code_base?.case_key);
    const linkKey = normalizeKey(linkPerson);
    const manualKey = normalizeKey(manualPerson);
    const conflict = status.includes("conflicto") ||
      normalizeKey(item.phone_audit.phone_match_level).includes("conflicto") ||
      (linkKey && manualKey && linkKey !== manualKey);
    return {
      title: conflict ? "Enlace y código final apuntan a personas distintas" : "Llamada identificable",
      detail: conflict
        ? `El enlace apunta a ${linkPerson || "sin persona"}; el código final apunta a ${manualPerson || "sin persona"}.`
        : `El enlace usado y el código final permiten ubicar a ${manualPerson || linkPerson || "la persona"}.`,
      evidenceLabel: cleanText(item.phone_audit.responsible) ? "Responsable" : "Evidencia telefónica",
      evidenceDetail: compact([
        item.phone_audit.responsible,
        item.phone_audit.cv_id ? `enlace ${item.phone_audit.cv_id}` : "",
        item.phone_audit.final_codpulso ? `código final ${item.phone_audit.final_codpulso}` : "",
      ]) || evidence.detail,
      decisionLabel,
      action: item.phone_audit.recommended_action || "Validar con responsable antes de cerrar la decisión.",
      tone: conflict ? "danger" : "warning",
    };
  }

  if (isDuplicate(item)) {
    return {
      title: "Más de una respuesta para el mismo caso",
      detail: duplicateDetail(item) || "Hay respuestas agrupadas por el mismo código o persona.",
      evidenceLabel: "Grupo duplicado",
      evidenceDetail: cleanText(item.duplicate_group_key || item.case_key || item.response_id) || "sin grupo",
      decisionLabel,
      action: "Comparar fecha, estado y encuesta para conservar una sola respuesta en avance.",
      tone: "warning",
    };
  }

  if (isPartial(item)) {
    return {
      title: "Respuesta parcial",
      detail: partialProgress(item) || "La persona empezó la encuesta, pero no terminó el cuestionario real.",
      evidenceLabel: "Progreso",
      evidenceDetail: partialProgress(item) || compact([platform, evidence.detail]),
      decisionLabel,
      action: "Mantener separada de efectivas salvo que exista una decisión auditada.",
      tone: "base",
    };
  }

  if (strategy.includes("correo") || strategy.includes("email")) {
    const label = normalizeKey(evidence.label);
    const metadataEmail = label.includes("destinatario") || label.includes("recipient") || label.includes("envio");
    return {
      title: hasBaseCross(item)
        ? (metadataEmail ? "Identificada por correo del envío" : "Identificada por correo observado")
        : (metadataEmail ? "Correo del envío no cruza" : "Correo observado no cruza"),
      detail: metadataEmail
        ? "La llave fuerte es el correo del destinatario registrado por SurveyMonkey."
        : "El snapshot trae un correo observado; úsalo como evidencia secundaria si no viene metadata del envío.",
      evidenceLabel: evidence.label,
      evidenceDetail: evidence.detail,
      decisionLabel,
      action: hasBaseCross(item)
        ? "Cuenta si el correo pertenece al universo del actor y la respuesta no está duplicada."
        : "Revisar correo, actor y candidatos antes de mover avance.",
      tone: hasBaseCross(item) ? "ready" : "warning",
    };
  }

  if (isOutsideBase(item)) {
    return {
      title: "El código no está en la base del actor",
      detail: compact([base, reviewReason]) || "El dato existe, pero no pertenece al universo activo.",
      evidenceLabel: evidence.label,
      evidenceDetail: evidence.detail,
      decisionLabel,
      action: "Confirmar si la persona pertenece al universo o mantener fuera del avance.",
      tone: "warning",
    };
  }

  if (isMissingKey(item)) {
    return {
      title: "No se pudo identificar a la persona",
      detail: compact([platform, "No hay dato suficiente para ubicarla en la base."]),
      evidenceLabel: evidence.label,
      evidenceDetail: evidence.detail,
      decisionLabel,
      action: "Buscar código, correo, celular o nombre antes de incluirla.",
      tone: "danger",
    };
  }

  if (hasBaseCross(item)) {
    return {
      title: "Cruza con la base del actor",
      detail: "La respuesta se vinculó con una persona del universo activo.",
      evidenceLabel: evidence.label,
      evidenceDetail: evidence.detail,
      decisionLabel,
      action: "Cuenta si el estado de respuesta y la deduplicación también son válidos.",
      tone: "ready",
    };
  }

  return {
    title: cleanText(item.identity_label) || `${platform} · ${base}`,
    detail: compact([item.channel_key_strategy_label, reviewReason]) || "Revisar evidencia antes de tomar una decisión.",
    evidenceLabel: evidence.label,
    evidenceDetail: evidence.detail,
    decisionLabel,
    action: "Abrir el caso si se necesita documentar una decisión.",
    tone: "base",
  };
}
