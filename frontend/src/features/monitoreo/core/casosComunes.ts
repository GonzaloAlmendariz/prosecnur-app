// Helpers de formato y rótulos idénticos entre las páginas de Telefónico y
// Acreditación (L33 parte 2, lote 1). Se movieron sin cambiar una línea; las
// dos páginas los importan de aquí. Semántica de familia: no se fusiona nada más.
import { type MonitoreoInternalQueryCase } from "../../../api/client";
import { internalCaseResponseStateValue, internalQueryCollectorValue } from "../internalQueries";
import { caseCountsInAdvance, cleanCaseKeyText } from "./rotulosComunes";
import { casePhoneAction } from "./tablasComunes";
import { normalizeSourceMatch } from "../profiles/telefonico/formato";

export function caseIdentity(item: MonitoreoInternalQueryCase) {
  return item.response_id || item.case_key || `${item.actor}-${item.response_row}-${item.person_label}`;
}

export function countCaseOptions(
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

export function caseChannelValue(item: MonitoreoInternalQueryCase) {
  return item.channel || "";
}

export function caseSourceValue(item: MonitoreoInternalQueryCase) {
  return item.source_label || item.source_id || item.base_source || "";
}

export function caseCollectorValue(item: MonitoreoInternalQueryCase) {
  return internalQueryCollectorValue(item) || item.collector_id || "";
}

export function caseToneClass(item: MonitoreoInternalQueryCase) {
  const response = internalCaseResponseStateValue(item);
  if (response === "complete") return "is-effective";
  if (response === "partial") return "is-partial";
  if (response === "refusal") return "is-refusal";
  return "is-muted";
}

export function assistedReviewCandidateCountForCase(item: MonitoreoInternalQueryCase) {
  const seen = new Set<string>();
  [...(item.assisted_review?.candidates ?? []), ...(item.assisted_review?.assignment_candidates ?? [])].forEach((candidate) => {
    const id = cleanCaseKeyText(candidate.candidate_id || candidate.case_key || candidate.base_record || candidate.person_label);
    if (id) seen.add(id);
  });
  return seen.size;
}

export function caseNeedsReconciliationReview(item: MonitoreoInternalQueryCase) {
  return (
    caseCountsInAdvance(item) !== true ||
    Number(item.duplicate_count ?? item.duplicate_group_size ?? 0) > 1 ||
    internalCaseResponseStateValue(item) === "partial" ||
    Boolean(casePhoneAction(item)) ||
    Boolean(String(item.issue_type || "").trim())
  );
}

export function acreditacionSurveyStateTone(state: string): "completed" | "partial" | "refusals" | "pending" {
  const key = normalizeSourceMatch(state);
  if (key.includes("completa") || key.includes("efectiva") || key.includes("valida")) return "completed";
  if (key.includes("parcial")) return "partial";
  if (key.includes("rechazo") || key.includes("rechaz")) return "refusals";
  return "pending";
}

export function caseDailyTone(item: MonitoreoInternalQueryCase): ReturnType<typeof acreditacionSurveyStateTone> {
  if (item.advancement === "effective") return "completed";
  if (item.advancement === "partial") return "partial";
  if (item.advancement === "refusal") return "refusals";
  return acreditacionSurveyStateTone(item.platform_state);
}
