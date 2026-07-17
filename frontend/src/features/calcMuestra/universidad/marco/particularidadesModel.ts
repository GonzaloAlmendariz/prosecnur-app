/**
 * Modelo PURO del panel de particularidades del marco (reunión del diseño
 * muestral 2026-07-15): las señales se DETECTAN y MUESTRAN; la decisión es del
 * usuario, manual y documentada. Aquí viven los reductores inmutables sobre
 * `aulas_config.particularidades_decisiones` y los resúmenes por sección —
 * patrón territorialSummaryModel: lógica calculable con test, el .tsx presenta.
 */
import type { CalcMuestraParticularidadDecision } from "../../../../api/client";

export type ParticularidadDecisionValor = CalcMuestraParticularidadDecision["decision"];

export const PARTICULARIDAD_DECISIONES: Array<{ id: ParticularidadDecisionValor; label: string }> = [
  { id: "incluir", label: "Incluir" },
  { id: "excluir", label: "Excluir" },
  { id: "revisado", label: "Revisado" },
];

function esDecisionValida(value: unknown): value is ParticularidadDecisionValor {
  return value === "incluir" || value === "excluir" || value === "revisado";
}

/**
 * Normaliza el record persistido en el workspace. Defensivo contra el
 * round-trip por jsonlite: `decision`/`nota` pueden llegar como arrays de 1
 * elemento; entradas sin decisión reconocible se descartan (no hay decisión
 * implícita — regla de la casa: nada se auto-decide).
 */
export function normalizeParticularidadesDecisiones(
  raw: unknown,
): Record<string, CalcMuestraParticularidadDecision> {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const unwrap = (v: unknown): unknown => (Array.isArray(v) ? (v.length > 0 ? v[0] : null) : v);
  const out: Record<string, CalcMuestraParticularidadDecision> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!id.trim()) continue;
    const rec = unwrap(value);
    if (rec == null || typeof rec !== "object" || Array.isArray(rec)) continue;
    const decision = unwrap((rec as Record<string, unknown>).decision);
    if (!esDecisionValida(decision)) continue;
    const notaRaw = unwrap((rec as Record<string, unknown>).nota);
    const nota = typeof notaRaw === "string" ? notaRaw.trim() : "";
    out[id] = { decision, ...(nota ? { nota } : {}) };
  }
  return out;
}

/**
 * Fija la decisión de una particularidad, inmutable. `null` la LIMPIA (vuelve
 * a "pendiente de revisión") y descarta su nota; repetir la misma decisión
 * conserva la nota existente.
 */
export function setDecisionParticularidad(
  decisiones: Record<string, CalcMuestraParticularidadDecision>,
  id: string,
  decision: ParticularidadDecisionValor | null,
): Record<string, CalcMuestraParticularidadDecision> {
  if (decision == null) {
    if (!decisiones[id]) return decisiones;
    const next = { ...decisiones };
    delete next[id];
    return next;
  }
  const actual = decisiones[id];
  return {
    ...decisiones,
    [id]: { decision, ...(actual?.nota ? { nota: actual.nota } : {}) },
  };
}

/**
 * Fija (o limpia con vacío) la nota de una particularidad, inmutable. Sin
 * decisión previa NO crea una entrada huérfana: la nota documenta una decisión.
 */
export function setNotaParticularidad(
  decisiones: Record<string, CalcMuestraParticularidadDecision>,
  id: string,
  nota: string,
): Record<string, CalcMuestraParticularidadDecision> {
  const actual = decisiones[id];
  if (!actual) return decisiones;
  const limpia = nota.trim();
  return {
    ...decisiones,
    [id]: { decision: actual.decision, ...(limpia ? { nota: limpia } : {}) },
  };
}

export type ResumenDecisiones = {
  total: number;
  incluir: number;
  excluir: number;
  revisado: number;
  pendientes: number;
};

/** Resumen de decisiones para la cabecera de una sección del panel. */
export function resumenDecisiones(
  ids: string[],
  decisiones: Record<string, CalcMuestraParticularidadDecision>,
): ResumenDecisiones {
  const out: ResumenDecisiones = { total: ids.length, incluir: 0, excluir: 0, revisado: 0, pendientes: 0 };
  for (const id of ids) {
    const decision = decisiones[id]?.decision;
    if (decision === "incluir") out.incluir += 1;
    else if (decision === "excluir") out.excluir += 1;
    else if (decision === "revisado") out.revisado += 1;
    else out.pendientes += 1;
  }
  return out;
}
