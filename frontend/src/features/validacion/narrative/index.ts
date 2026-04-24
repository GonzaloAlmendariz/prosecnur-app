// =============================================================================
// narrative/index.ts — helpers compartidos para presentar reglas en forma
// narrativa (frase humana + roles + variables marcadas).
// =============================================================================
// Originalmente estos helpers vivían dentro de ReglaDrillPanel.tsx. Los
// movemos aquí para que RuleNarrative, VariableChip, StatCard y cualquier
// futuro consumidor compartan el mismo lenguaje visual.
//
// Contrato: trabajamos con un `ReglaLike` mínimo que acepta tanto
// `ReglaInstrumento` (con presentation enriquecida) como reglas custom o
// AST compiladas. No obligamos todos los campos; hay fallbacks por tipo.

import type { LucideIcon } from "lucide-react";
import { CircleDot, GitBranch, Hash, Scale } from "lucide-react";

// -----------------------------------------------------------------------------
// Tipos mínimos
// -----------------------------------------------------------------------------

/** Shape mínimo que cualquier "regla" debe tener para ser narrable. */
export type ReglaLike = {
  id?: string;
  nombre?: string | null;
  tipo_regla?: string | null;             // enum AST (required/skip/...)
  tipo_observacion?: string | null;       // legacy (select_one, constraint, etc.)
  tipo_variable?: string | null;
  fuente?: "instrumento" | "custom" | string | null;
  severidad?: string | null;
  categoria_ux?: string | null;
  objetivo?: string | null;
  variables?: string[] | null;
  variable_roles?: {
    target?: string | string[] | null;
    drivers?: string[] | null;
    compare?: string[] | null;
    gate?: string[] | null;
  } | null;
  presentation?: {
    subtipo_semantico?: string | null;
    gate_humano?: string | null;
    detalle_condicion?: string | null;
    nombre_humano?: string | null;
    nombre_tecnico?: string | null;
    objetivo?: string | null;
  } | null;
  n_casos?: number | null;
  porcentaje?: number | null;
};

export type RoleKey = "target" | "drivers" | "compare" | "gate";

export type RoleItem = { key: string; label?: string | null };
export type RoleSection = { role: RoleKey; items: RoleItem[] };

/** Metadata visual y textual de cada rol. */
export type RoleMeta = {
  key: RoleKey;
  title: string;        // Header ("Respuesta que revisamos")
  eyebrow: string;      // Chip label ("Respuesta central")
  hint: string;         // Subtexto explicativo
  description: string;  // Para hovercard
  Icon: LucideIcon;
  tokenBg: string;      // CSS var
  tokenFg: string;
  tokenBorder: string;
};

export const ROLE_META: Record<RoleKey, RoleMeta> = {
  target: {
    key: "target",
    title: "Respuesta que revisamos",
    eyebrow: "Respuesta central",
    hint: "Es la respuesta que esta regla evalúa directamente.",
    description: "El dato que debe quedar correcto según el instrumento.",
    Icon: CircleDot,
    tokenBg: "var(--pulso-role-target-bg)",
    tokenFg: "var(--pulso-role-target-fg)",
    tokenBorder: "var(--pulso-role-target-border)",
  },
  drivers: {
    key: "drivers",
    title: "Condiciones que activan la regla",
    eyebrow: "Activadores",
    hint: "Respuestas previas que hacen que esta pregunta aplique.",
    description: "Cuando estas respuestas se cumplen, la regla entra en juego.",
    Icon: GitBranch,
    tokenBg: "var(--pulso-role-drivers-bg)",
    tokenFg: "var(--pulso-role-drivers-fg)",
    tokenBorder: "var(--pulso-role-drivers-border)",
  },
  compare: {
    key: "compare",
    title: "Se compara con",
    eyebrow: "Comparación",
    hint: "Datos o referencias que sirven para contrastar la respuesta.",
    description: "Con qué otra información se contrasta la respuesta.",
    Icon: Scale,
    tokenBg: "var(--pulso-role-compare-bg)",
    tokenFg: "var(--pulso-role-compare-fg)",
    tokenBorder: "var(--pulso-role-compare-border)",
  },
  gate: {
    key: "gate",
    title: "Condiciones heredadas",
    eyebrow: "Contexto",
    hint: "Vienen de la lógica de la sección o del grupo del formulario.",
    description: "Acompañan la regla desde la estructura del formulario.",
    Icon: Hash,
    tokenBg: "var(--pulso-role-gate-bg)",
    tokenFg: "var(--pulso-role-gate-fg)",
    tokenBorder: "var(--pulso-role-gate-border)",
  },
};

// -----------------------------------------------------------------------------
// Helpers textuales (puros, testables)
// -----------------------------------------------------------------------------

export function cleanSentence(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
}

export function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    if (typeof v !== "string" || !v.length || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function humanList(values: string[]): string {
  if (!values.length) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} y ${values[1]}`;
  return `${values.slice(0, -1).join(", ")} y ${values.at(-1)}`;
}

// -----------------------------------------------------------------------------
// Builders narrativos — generan frases humanas desde una ReglaLike
// -----------------------------------------------------------------------------

/**
 * Frase principal ("headline") que explica qué espera la regla.
 * Usa presentation.objetivo si viene; si no, cae a templates por tipo.
 */
export function buildExpectationHeadline(
  regla: ReglaLike,
  targetDisplay: string,
): string {
  const explicit = cleanSentence(regla.presentation?.objetivo ?? regla.objetivo ?? "");
  if (explicit) return explicit;

  const tipoRegla = (regla.tipo_regla ?? "").toLowerCase();
  const tipoObs = (regla.tipo_observacion ?? "").toLowerCase();
  const subtipo = (regla.presentation?.subtipo_semantico ?? "").toLowerCase();

  if (subtipo === "nodebe")
    return `${targetDisplay} no debería tener respuesta cuando la condición no aplica.`;
  if (subtipo === "debe")
    return `Si se cumple la condición, ${targetDisplay} debe registrarse.`;
  if (subtipo === "req" || tipoRegla === "required" || tipoObs.includes("required"))
    return `${targetDisplay} debe responderse cuando corresponde.`;
  if (tipoRegla === "skip") return `El salto de ${targetDisplay} debe respetarse.`;
  if (tipoRegla === "constraint" || tipoObs.includes("constraint"))
    return `${targetDisplay} debe cumplir la consistencia definida.`;
  if (tipoRegla === "range")
    return `${targetDisplay} debe estar dentro del rango permitido.`;
  if (tipoRegla === "catalog")
    return `${targetDisplay} debe pertenecer al catálogo permitido.`;
  if (tipoRegla === "outlier")
    return `${targetDisplay} no debería ser un valor atípico.`;
  if (tipoRegla === "duplicate")
    return `La combinación en ${targetDisplay} no debería repetirse entre casos.`;
  if (tipoRegla === "coherence")
    return `${targetDisplay} debe ser coherente con las demás variables.`;
  if (tipoRegla === "pattern")
    return `${targetDisplay} no debería mostrar un patrón sospechoso.`;
  if (tipoRegla === "calculate_check" || tipoObs.includes("calculate"))
    return `${targetDisplay} debe derivarse correctamente.`;
  if (tipoObs.includes("choice"))
    return `${targetDisplay} solo debería usar opciones válidas del catálogo.`;
  return `${targetDisplay} debe comportarse como espera el instrumento.`;
}

/**
 * Frase sobre cuándo se activa la regla — usa el gate humano si viene,
 * si no arma una a partir de las variables del rol drivers/gate.
 */
export function buildActivationSummary(
  regla: ReglaLike,
  sections: RoleSection[] = [],
): string {
  const explicit = cleanSentence(regla.presentation?.gate_humano ?? "");
  if (explicit) return explicit;
  const driverSections = sections.filter((s) => s.role === "drivers" || s.role === "gate");
  const labels = uniqueStrings(
    driverSections.flatMap((s) => s.items.map((it) => it.label ?? it.key)),
  );
  if (!labels.length) return "";
  return `Aplica cuando ya se registraron ${humanList(labels.map((v) => `«${v}»`))}.`;
}

/** Frase sobre la comparación — si la regla cruza con otras variables. */
export function buildCompareSummary(
  regla: ReglaLike,
  sections: RoleSection[] = [],
): string {
  const explicit = cleanSentence(regla.presentation?.detalle_condicion ?? "");
  if (explicit) return explicit;
  const compareSections = sections.filter((s) => s.role === "compare");
  const labels = uniqueStrings(
    compareSections.flatMap((s) => s.items.map((it) => it.label ?? it.key)),
  );
  if (!labels.length) return "";
  return `Se contrasta con ${humanList(labels.map((v) => `«${v}»`))}.`;
}

/**
 * Deriva las secciones por rol a partir de variable_roles. Si la regla no
 * tiene variable_roles, asume que la primera variable es el target.
 */
export function buildRoleSections(
  regla: ReglaLike,
  labelLookup: (varName: string) => string | null = () => null,
): RoleSection[] {
  const roles = regla.variable_roles ?? {};
  const targetVars = asArray(roles.target);
  const driversVars = asArray(roles.drivers);
  const compareVars = asArray(roles.compare);
  const gateVars = asArray(roles.gate);

  // Fallback: si no hay roles declarados, primera variable = target.
  if (
    !targetVars.length &&
    !driversVars.length &&
    !compareVars.length &&
    !gateVars.length &&
    regla.variables?.length
  ) {
    targetVars.push(regla.variables[0]);
  }

  const toItems = (vars: string[]): RoleItem[] =>
    uniqueStrings(vars).map((key) => ({ key, label: labelLookup(key) }));

  const sections: RoleSection[] = [];
  if (targetVars.length) sections.push({ role: "target", items: toItems(targetVars) });
  if (driversVars.length) sections.push({ role: "drivers", items: toItems(driversVars) });
  if (compareVars.length) sections.push({ role: "compare", items: toItems(compareVars) });
  if (gateVars.length) sections.push({ role: "gate", items: toItems(gateVars) });
  return sections;
}

function asArray(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  if (typeof value === "string") return value ? [value] : [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

/** Nombre humano preferido; con fallback a variable técnica. */
export function displayTargetName(
  regla: ReglaLike,
  labelLookup: (v: string) => string | null = () => null,
): string {
  const sections = buildRoleSections(regla, labelLookup);
  const target = sections.find((s) => s.role === "target")?.items[0];
  if (!target) return regla.variables?.[0] ?? regla.nombre ?? "la respuesta";
  const label = target.label && target.label !== target.key ? target.label : null;
  return label ? `«${label}»` : `«${target.key}»`;
}

// -----------------------------------------------------------------------------
// Paleta por tipo de variable ODK (tokens CSS)
// -----------------------------------------------------------------------------

export type VarType = "so" | "sm" | "int" | "decimal" | "date" | "text" | "calculate" | "note" | null | undefined;

/** Normaliza un `type` crudo del XLSForm a uno de los chips soportados. */
export function normalizeVarType(raw: string | null | undefined): VarType {
  if (!raw) return null;
  const first = String(raw).trim().toLowerCase().split(/\s+/)[0];
  if (first.startsWith("select_multiple")) return "sm";
  if (first.startsWith("select_one")) return "so";
  if (first === "integer" || first === "int") return "int";
  if (first === "decimal" || first === "number") return "decimal";
  if (first === "date" || first === "datetime" || first === "time") return "date";
  if (first === "calculate") return "calculate";
  if (first === "note") return "note";
  if (first === "text" || first === "string") return "text";
  return null;
}

/** Chip colors por tipo — usa tokens existentes + nuevos. */
export function varTypeTokens(type: VarType): { bg: string; fg: string; border: string; label: string } {
  switch (type) {
    case "sm": return { bg: "var(--tipo-sm-bg)", fg: "var(--tipo-sm-fg)", border: "var(--tipo-sm-border)", label: "SM" };
    case "so": return { bg: "var(--tipo-so-bg)", fg: "var(--tipo-so-fg)", border: "var(--tipo-so-border)", label: "SO" };
    case "int":
    case "decimal":
      return { bg: "var(--tipo-int-bg)", fg: "var(--tipo-int-fg)", border: "var(--tipo-int-border)", label: type === "int" ? "INT" : "DEC" };
    case "date": return { bg: "var(--pulso-info-bg)", fg: "var(--pulso-info-fg)", border: "var(--pulso-info-border)", label: "DATE" };
    case "calculate": return { bg: "var(--pulso-warn-bg)", fg: "var(--pulso-warn-fg)", border: "var(--pulso-warn-border)", label: "CALC" };
    case "note": return { bg: "var(--pulso-surface-2)", fg: "var(--pulso-text-soft)", border: "var(--pulso-border)", label: "NOTE" };
    case "text":
    default:
      return { bg: "var(--tipo-text-bg)", fg: "var(--tipo-text-fg)", border: "var(--tipo-text-border)", label: "TEXT" };
  }
}
