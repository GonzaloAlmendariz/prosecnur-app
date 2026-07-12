// =============================================================================
// ruleFlowModel.ts — lógica pura del diagrama de flujo de una regla.
// =============================================================================
// Convierte una regla (ReglaLike + su estado de auditoría) en una secuencia de
// nodos conectados que explica su validación:
//
//   [Contexto] → [Activadores] → [Objetivo] → [Condición] → [Comparación] → [Veredicto]
//
// Cada nodo se omite cuando la regla no tiene datos para él, de modo que el
// flujo se adapta a cada tipo (una `required` sin comparación no muestra ese
// nodo; una `calculate_check` sin activadores tampoco). Así el mismo modelo
// sirve para required/skip/range/constraint/catalog/coherence/calculate_check/
// select_multiple_cardinality/outlier/duplicate/pattern/odk_raw/relacionales.
//
// Es lógica PURA y testeada (ruleFlowModel.test.ts) — los `.tsx` solo pintan.
// =============================================================================

import type { ReglaLike } from "./narrative";
import {
  ROLE_META,
  buildRoleSections,
  cleanSentence,
  displayTargetName,
} from "./narrative";

export type FlowNodeKind =
  | "gate"
  | "drivers"
  | "target"
  | "condition"
  | "compare"
  | "verdict";

export type FlowVerdictKind =
  | "clean"
  | "issues"
  | "not_evaluated"
  | "not_applicable"
  | "misaligned"
  | "external"
  | "pending_child";

export type FlowChip = { key: string; label: string | null };

export type FlowNode = {
  kind: FlowNodeKind;
  eyebrow: string;
  title: string;
  detail: string | null;
  chips: FlowChip[];
  /** Sólo en `condition` — clave del tipo de regla para elegir ícono. */
  iconKey?: string | null;
  /** Sólo en `verdict` — categoría del resultado para color/ícono. */
  verdict?: FlowVerdictKind;
};

export type RuleFlow = {
  nodes: FlowNode[];
  verdictKind: FlowVerdictKind;
};

export type RuleFlowInput = {
  regla: ReglaLike;
  estadoDinamico?: string | null;
  issueCode?: string | null;
  detalle?: string | null;
  nInconsistencias?: number | null;
  porcentaje?: number | null;
  requiresExternalDataset?: boolean;
  /** Copy relacional opcional (cardinalidad/correspondencia/...) para el nodo condición. */
  relationalConditionCopy?: string | null;
  labelLookup?: (v: string) => string | null;
};

// -----------------------------------------------------------------------------
// Humanización del tipo de regla (título del nodo condición).
// -----------------------------------------------------------------------------

const RULE_TYPE_LABEL: Record<string, string> = {
  required: "Debe responderse",
  skip: "Debe respetar el salto",
  constraint: "Debe cumplir la restricción",
  range: "Dentro del rango permitido",
  catalog: "Valor válido del catálogo",
  choice: "Valor válido del catálogo",
  outlier: "Sin valores atípicos",
  duplicate: "Sin duplicados",
  coherence: "Coherente con el contexto",
  calculate_check: "Cálculo automático correcto",
  select_multiple_cardinality: "Selección múltiple válida",
  repeat_length: "Cantidad de filas correcta",
  pattern: "Cumple el patrón esperado",
  odk_raw: "Regla ODK avanzada",
};

export function humanizeRuleType(
  tipoRegla: string | null | undefined,
  tipoObservacion?: string | null,
): string {
  const tipo = (tipoRegla ?? "").toLowerCase();
  if (tipo && RULE_TYPE_LABEL[tipo]) return RULE_TYPE_LABEL[tipo];
  const obs = (tipoObservacion ?? "").toLowerCase();
  for (const key of Object.keys(RULE_TYPE_LABEL)) {
    if (obs.includes(key)) return RULE_TYPE_LABEL[key];
  }
  if (obs.includes("select")) return "Valor válido del catálogo";
  return "Cumple la validación";
}

/** Chip humanizado del tipo de regla (para el encabezado del panel). */
export function ruleTypeChipLabel(
  tipoRegla: string | null | undefined,
  tipoObservacion?: string | null,
): string {
  return humanizeRuleType(tipoRegla, tipoObservacion);
}

// -----------------------------------------------------------------------------
// Heurística: ¿el texto es humano o una expresión técnica cruda?
// -----------------------------------------------------------------------------

function isFriendlyText(value: string | null | undefined): boolean {
  const text = cleanSentence(value);
  if (!text) return false;
  if (text.length > 200) return false;
  if (/\bNO se cumple que\b/i.test(text)) return false;
  if (/\(\(.+\)\)/.test(text)) return false;
  // Expresiones ODK/regex crudas (muchos operadores, sin espacios de prosa).
  if (/[<>=!]=|\$\{|count-selected|selected\(|regex\(/i.test(text)) return false;
  return true;
}

function firstFriendly(...candidates: Array<string | null | undefined>): string | null {
  for (const c of candidates) {
    if (isFriendlyText(c)) return cleanSentence(c);
  }
  return null;
}

// -----------------------------------------------------------------------------
// Veredicto — categoría del resultado real de la auditoría.
// -----------------------------------------------------------------------------

export function deriveVerdict(input: RuleFlowInput): FlowVerdictKind {
  const estado = (input.estadoDinamico ?? "").toLowerCase();
  const issue = (input.issueCode ?? "").toLowerCase();
  if (issue === "sin_datos_repeat") return "pending_child";
  if (input.requiresExternalDataset || issue === "requires_external_dataset")
    return "external";
  if (estado === "no_aplicable") return "not_applicable";
  if (estado === "desalineada") return "misaligned";
  if (estado === "no_evaluada" || estado === "incorrecta_ejecucion")
    return "not_evaluated";
  if ((input.nInconsistencias ?? 0) > 0) return "issues";
  return "clean";
}

function verdictCopy(
  kind: FlowVerdictKind,
  n: number | null | undefined,
  pct: number | null | undefined,
): { title: string; detail: string } {
  const cases = typeof n === "number" && Number.isFinite(n) ? n : 0;
  const pctStr =
    pct != null && Number.isFinite(pct)
      ? Math.abs(pct) > 1
        ? `${pct.toFixed(1)}%`
        : `${(pct * 100).toFixed(1)}%`
      : null;
  switch (kind) {
    case "issues":
      return {
        title: `${formatInt(cases)} ${cases === 1 ? "inconsistencia" : "inconsistencias"}`,
        detail: pctStr ? `${pctStr} de los casos revisados.` : "Casos que no cumplen la regla.",
      };
    case "clean":
      return {
        title: "Sin inconsistencias",
        detail: "Todos los casos cumplen la regla.",
      };
    case "not_applicable":
      return {
        title: "No aplica a esta base",
        detail: "La columna que la regla evalúa no está en los datos cargados.",
      };
    case "not_evaluated":
      return {
        title: "No evaluada automáticamente",
        detail: "El evaluador no pudo correrla; requiere revisión manual.",
      };
    case "misaligned":
      return {
        title: "Desalineada con los datos",
        detail: "Compara contra un valor que no existe en la base (posible desfase de versión).",
      };
    case "external":
      return {
        title: "Depende de un listado externo",
        detail: "El campo se pre-llena vía pulldata(); no hay contra qué validarlo sin ese listado.",
      };
    case "pending_child":
      return {
        title: "Pendiente de la base repetida",
        detail: "Se evalúa al cargar la base de respuestas repetidas de esta sección.",
      };
  }
}

function formatInt(value: number): string {
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(value);
}

// -----------------------------------------------------------------------------
// Constructor principal del flujo.
// -----------------------------------------------------------------------------

export function buildRuleFlow(input: RuleFlowInput): RuleFlow {
  const { regla } = input;
  const label = input.labelLookup ?? (() => null);
  const sections = buildRoleSections(regla, label);
  const gate = sections.find((s) => s.role === "gate");
  const drivers = sections.find((s) => s.role === "drivers");
  const target = sections.find((s) => s.role === "target");
  const compare = sections.find((s) => s.role === "compare");

  const toChip = (item: { key: string; label?: string | null }): FlowChip => ({
    key: item.key,
    label: item.label && item.label !== item.key ? item.label : null,
  });

  const nodes: FlowNode[] = [];

  // --- Contexto (gate): sección/salto que enmarca dónde aplica. ------------
  const gateText = firstFriendly(regla.presentation?.gate_humano);
  if ((gate && gate.items.length) || gateText) {
    nodes.push({
      kind: "gate",
      eyebrow: ROLE_META.gate.eyebrow,
      title: "Cuándo aplica",
      detail: gateText,
      chips: (gate?.items ?? []).map(toChip),
    });
  }

  // --- Activadores (drivers): respuestas previas que la habilitan. ---------
  if (drivers && drivers.items.length) {
    nodes.push({
      kind: "drivers",
      eyebrow: ROLE_META.drivers.eyebrow,
      title: "Condiciones que activan",
      detail: null,
      chips: drivers.items.map(toChip),
    });
  }

  // --- Objetivo (target): la(s) variable(s) que se revisan. ----------------
  const targetChips = (target?.items ?? []).map(toChip);
  if (targetChips.length) {
    nodes.push({
      kind: "target",
      eyebrow: ROLE_META.target.eyebrow,
      title: "Se revisa",
      detail: null,
      chips: targetChips,
    });
  } else {
    nodes.push({
      kind: "target",
      eyebrow: ROLE_META.target.eyebrow,
      title: "Se revisa",
      detail: displayTargetName(regla, label),
      chips: [],
    });
  }

  // --- Condición: la regla que debe cumplirse (corazón). -------------------
  const tipoRegla = regla.tipo_regla ?? null;
  const conditionDetail =
    input.relationalConditionCopy ??
    firstFriendly(
      regla.presentation?.detalle_condicion,
      regla.presentation?.objetivo,
      regla.objetivo,
    );
  nodes.push({
    kind: "condition",
    eyebrow: "Regla",
    title: humanizeRuleType(tipoRegla, regla.tipo_observacion),
    detail: conditionDetail,
    chips: [],
    iconKey: (tipoRegla ?? regla.tipo_observacion ?? "").toLowerCase() || null,
  });

  // --- Comparación (compare): contra qué se contrasta. ---------------------
  if (compare && compare.items.length) {
    nodes.push({
      kind: "compare",
      eyebrow: ROLE_META.compare.eyebrow,
      title: "Se compara con",
      detail: null,
      chips: compare.items.map(toChip),
    });
  }

  // --- Veredicto: resultado real de la auditoría. --------------------------
  const verdictKind = deriveVerdict(input);
  const copy = verdictCopy(verdictKind, input.nInconsistencias, input.porcentaje);
  nodes.push({
    kind: "verdict",
    eyebrow: "Resultado",
    title: copy.title,
    detail: copy.detail,
    chips: [],
    verdict: verdictKind,
  });

  return { nodes, verdictKind };
}
