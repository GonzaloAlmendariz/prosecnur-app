import type {
  MonitoreoAssistedReviewCandidate,
  MonitoreoInternalQueryCase,
  MonitoreoInternalQueryIssue,
} from "../../../../../../api/client";
import { internalCaseResponseStateLabel, internalCaseResponseStateValue } from "../../../../internalQueries";
import {
  assistedCandidateEvidenceLevel,
  assistedCandidateEvidenceRank,
  assistedCandidateId,
  assistedReviewDecisionNotes,
  assistedReviewFlagTruthy,
  normalizeCaseSearch,
} from "./revisionAsistida";
import { etiquetaDeTipo, grupoDeTipo, type GrupoDeCaso } from "./tiposDeCaso";

/**
 * Modelo puro de Control › Por resolver (ficha Ctl5).
 *
 * La cola sale de `internal_queries.issues` unido a los casos por
 * `response_id`; la decisión, de la revisión asistida del caso con las mismas
 * reglas de hoy (`AcreditacionAssistedReviewBlock`): solo una respuesta
 * completa o parcial se asigna, la persona elegida no puede tener ya una
 * efectiva, la asignación se confirma y la nota es obligatoria cuando la
 * respuesta es parcial, el código contradice o la evidencia no es exacta.
 * Lo que se guarda es el mismo payload (`response_id`, `action`,
 * `candidate_id`, `note`).
 */

export type FilaDeCola = {
  clave: string;
  responseId: string;
  tipo: string;
  etiquetaDeTipo: string;
  grupo: GrupoDeCaso;
  publico: string;
  canal: string;
  llave: string;
  completitud: string;
  fecha: string;
  decision: "asignada" | "descartada" | null;
  caso: MonitoreoInternalQueryCase | null;
  detalle: string;
};

function texto(valor: unknown) {
  return String(valor ?? "").trim();
}

function normalizar(valor: unknown) {
  return texto(valor).toLowerCase().replace(/\s+/g, "_");
}

/** «100 %» para una completa; el avance de la parcial si viaja. */
export function completitud(caso: MonitoreoInternalQueryCase | null): string {
  if (!caso) return "—";
  const estado = internalCaseResponseStateValue(caso);
  if (estado === "complete") return "100 %";
  const pct = Number(caso.partial_completion_pct);
  if (estado === "partial" && Number.isFinite(pct)) return `${Math.round(pct)} %`;
  return internalCaseResponseStateLabel(estado);
}

function decisionDe(caso: MonitoreoInternalQueryCase | null): FilaDeCola["decision"] {
  const manual = caso?.assisted_review?.manual_decision;
  if (!manual) return null;
  return manual.action === "include_with_caveat" ? "asignada" : "descartada";
}

/** Una fila por caso marcado; el motor puede contar varios casos en una fila (duplicados). */
export function filasDeCola(
  issues: readonly MonitoreoInternalQueryIssue[],
  casos: readonly MonitoreoInternalQueryCase[],
): FilaDeCola[] {
  const porRespuesta = new Map<string, MonitoreoInternalQueryCase>();
  for (const caso of casos) if (caso.response_id) porRespuesta.set(caso.response_id, caso);
  return issues.map((issue, indice) => {
    const tipo = normalizar(issue.issue_type);
    const caso = issue.response_id ? porRespuesta.get(issue.response_id) ?? null : null;
    const fecha = texto(caso?.response_datetime || caso?.date).slice(0, 10);
    return {
      clave: `${tipo}-${issue.response_id || issue.case_key || indice}`,
      responseId: texto(issue.response_id),
      tipo,
      etiquetaDeTipo: etiquetaDeTipo(tipo, issue.label),
      grupo: grupoDeTipo(tipo),
      publico: texto(issue.actor || caso?.actor) || "Sin público",
      canal: texto(caso?.channel) || "Sin canal",
      llave: texto(issue.case_key || caso?.case_key) || "Sin llave",
      completitud: completitud(caso),
      fecha,
      decision: decisionDe(caso),
      caso,
      detalle: texto(issue.detail),
    };
  });
}

export type FiltroDeCola = { tipo: string | null; publico: string | null };

/** El tipo con que abre la bandeja: el primero que espera decisión, si hay. */
export function tipoInicial(filas: readonly FilaDeCola[]): string | null {
  return filas.find((fila) => fila.grupo === "espera")?.tipo ?? filas[0]?.tipo ?? null;
}

export function filtrarCola(filas: readonly FilaDeCola[], filtro: FiltroDeCola): FilaDeCola[] {
  return filas
    .filter((fila) => (!filtro.tipo || fila.tipo === filtro.tipo) && (!filtro.publico || fila.publico === filtro.publico))
    .sort((a, b) => Number(Boolean(a.decision)) - Number(Boolean(b.decision)) || b.fecha.localeCompare(a.fecha));
}

export type EstadoDeDecision = {
  seleccion: string;
  confirmado: boolean;
  nota: string;
  busqueda: string;
};

export type ModeloDeDecision = {
  /** Lo que el motor encontró, de la evidencia más fuerte a la manual. */
  evidencia: MonitoreoAssistedReviewCandidate[];
  /** Personas asignables: sin efectiva todavía. */
  opciones: MonitoreoAssistedReviewCandidate[];
  /** Coincidencias de la búsqueda que ya tienen efectiva: se muestran, no se asignan. */
  yaAsignadas: MonitoreoAssistedReviewCandidate[];
  seleccionada: MonitoreoAssistedReviewCandidate | null;
  avisos: string[];
  notas: Array<{ tone: "info" | "warning"; title: string; detail: string }>;
  notaRequerida: boolean;
  asignable: boolean;
  puedeAsignar: boolean;
  puedeDescartar: boolean;
  motivoParaNoAsignar: string;
  candidatoId: string;
};

function unicos(lista: readonly MonitoreoAssistedReviewCandidate[], excluir?: (candidato: MonitoreoAssistedReviewCandidate) => boolean) {
  const vistos = new Set<string>();
  const salida: MonitoreoAssistedReviewCandidate[] = [];
  for (const candidato of lista) {
    const id = assistedCandidateId(candidato);
    if (!id || vistos.has(id) || excluir?.(candidato)) continue;
    vistos.add(id);
    salida.push(candidato);
  }
  return salida;
}

function coincide(candidato: MonitoreoAssistedReviewCandidate, consulta: string) {
  if (!consulta) return true;
  const pajar = normalizeCaseSearch([
    candidato.person_label, candidato.case_key, candidato.base_record, candidato.base_source, candidato.base_status,
    candidato.current_status, candidato.match_label, candidato.evidence_label, candidato.evidence_level,
    ...(candidato.evidence_fields ?? []),
  ].join(" "));
  return consulta.split(/\s+/).filter(Boolean).every((token) => pajar.includes(token));
}

export function modeloDeDecision(caso: MonitoreoInternalQueryCase, estado: EstadoDeDecision): ModeloDeDecision {
  const review = caso.assisted_review;
  const candidatos = Array.isArray(review?.candidates) ? review.candidates : [];
  const asignables = Array.isArray(review?.assignment_candidates) ? review.assignment_candidates : [];
  const avisos = (Array.isArray(review?.warnings) ? review.warnings : []).map((aviso) => texto(aviso)).filter(Boolean);
  const nombre = (candidato: MonitoreoAssistedReviewCandidate) => texto(candidato.person_label || candidato.case_key);
  const evidencia = unicos([...candidatos, ...asignables])
    .sort((a, b) => assistedCandidateEvidenceRank(a) - assistedCandidateEvidenceRank(b) || nombre(a).localeCompare(nombre(b), "es"));
  const todas = unicos([...candidatos, ...asignables], (candidato) => assistedReviewFlagTruthy(candidato.already_effective))
    .sort((a, b) => nombre(a).localeCompare(nombre(b), "es"));
  const consulta = normalizeCaseSearch(estado.busqueda);
  const opciones = todas.filter((candidato) => coincide(candidato, consulta));
  const yaAsignadas = consulta
    ? evidencia.filter((candidato) => assistedReviewFlagTruthy(candidato.already_effective) && coincide(candidato, consulta))
    : [];
  const seleccionada = todas.find((candidato) => assistedCandidateId(candidato) === estado.seleccion) ?? null;
  const respuesta = internalCaseResponseStateValue(caso);
  const completa = normalizeCaseSearch(internalCaseResponseStateLabel(respuesta)).includes("completa")
    || normalizeCaseSearch(caso.platform_state).includes("completa");
  const parcial = respuesta === "partial" || normalizeCaseSearch(caso.platform_state).includes("parcial");
  const asignable = completa || parcial;
  const contradice = avisos.some((aviso) => normalizeCaseSearch(aviso).includes("codigo declarado no coincide"));
  const notaRequerida = Boolean(parcial || contradice || (seleccionada && assistedCandidateEvidenceLevel(seleccionada) !== "exact"));
  const candidatoId = seleccionada ? (seleccionada.candidate_id || seleccionada.case_key || "") : "";
  const faltaNota = notaRequerida && !estado.nota.trim();
  const motivoParaNoAsignar = !asignable
    ? "Solo una respuesta completa o parcial se asigna a una persona del padrón."
    : !seleccionada
      ? "Elige a la persona del padrón."
      : !candidatoId
        ? "Esta coincidencia no tiene un identificador que pueda guardarse."
        : !estado.confirmado
          ? "Confirma la asignación antes de guardar."
          : faltaNota
            ? parcial
              ? "Anota por qué esta parcial cuenta."
              : "Anota la evidencia o la contradicción."
            : "";
  return {
    evidencia,
    opciones,
    yaAsignadas,
    seleccionada,
    avisos,
    notas: assistedReviewDecisionNotes(avisos, evidencia, seleccionada),
    notaRequerida,
    asignable,
    puedeAsignar: !motivoParaNoAsignar,
    puedeDescartar: Boolean(caso.response_id),
    motivoParaNoAsignar,
    candidatoId,
  };
}

export type PayloadDeDecision = {
  response_id: string;
  action: "keep_excluded" | "include_with_caveat";
  candidate_id?: string;
  note?: string;
};

/** El mismo payload que guardaba la vista anterior. */
export function payloadDeDecision(
  caso: MonitoreoInternalQueryCase,
  accion: PayloadDeDecision["action"],
  modelo: ModeloDeDecision,
  nota: string,
): PayloadDeDecision | null {
  if (!caso.response_id) return null;
  if (accion === "include_with_caveat" && !modelo.puedeAsignar) return null;
  return {
    response_id: caso.response_id,
    action: accion,
    candidate_id: accion === "include_with_caveat" ? modelo.candidatoId : undefined,
    note: nota.trim(),
  };
}
