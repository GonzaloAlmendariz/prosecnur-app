import type { MonitoreoAssistedReviewCandidate, MonitoreoInternalQueryCase } from "../../../../../../api/client";

/**
 * Lectura de la revisión asistida de un caso: identidad de cada candidato del
 * padrón, nivel de su evidencia y notas para decidir. Salió del page-file
 * congelado sin cambiar lógica para que Control › Por resolver (A3) y la
 * vista anterior lean exactamente la misma regla.
 */

export function normalizeCaseSearch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@.]+/g, " ")
    .trim();
}

export function assistedReviewFlagTruthy(value: unknown) {
  if (typeof value === "boolean") return value;
  return ["1", "true", "t", "yes", "si", "sí"].includes(String(value ?? "").trim().toLowerCase());
}

export function assistedCandidateId(candidate: MonitoreoAssistedReviewCandidate) {
  return candidate.candidate_id || candidate.case_key || `${candidate.base_source}:${candidate.base_row}`;
}

export function assistedCandidateEvidenceLevel(candidate: MonitoreoAssistedReviewCandidate) {
  const level = normalizeCaseSearch(candidate.evidence_level);
  const matchType = normalizeCaseSearch(candidate.match_type);
  if (level.includes("exact") || matchType.includes("exact")) return "exact";
  if (level.includes("possible") || level.includes("probable") || matchType.includes("similar")) return "possible";
  return "manual";
}

export function assistedCandidateEvidenceLabel(candidate: MonitoreoAssistedReviewCandidate) {
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

export function assistedCandidateEvidenceRank(candidate: MonitoreoAssistedReviewCandidate) {
  const level = assistedCandidateEvidenceLevel(candidate);
  if (level === "exact") return 0;
  if (level === "possible") return 1;
  return 2;
}

export function assistedReviewVisible(item: MonitoreoInternalQueryCase) {
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

export function assistedReviewDecisionNotes(
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
