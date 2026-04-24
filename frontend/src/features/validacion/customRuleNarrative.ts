// =============================================================================
// customRuleNarrative.ts — adaptador reglas custom → ReglaLike (narrativa)
// =============================================================================
// El motor narrativo (RuleNarrative + narrative/) fue pensado para reglas del
// instrumento. Para que las reglas custom se lean igual de bien necesitamos:
//
//   1) Mapear `tipo` custom → `tipo_regla` del AST (required/range/outlier/...)
//      que es lo que `buildExpectationHeadline` reconoce.
//   2) Construir un `objetivo` legible que describa los parámetros
//      (ej: "Rango numérico 0 a 100", "Outlier IQR k=1.5").
//
// Así una regla custom no terminada (sólo tipo + variables) ya muestra una
// narrativa útil en el preview del editor — y al guardarse, la card de la
// lista se lee como: «variable» debe estar dentro del rango permitido.
// =============================================================================

import type { ReglaCustom, ReglaCustomTipo } from "./types";
import type { ReglaLike } from "./components/v2";

// Mapea el `tipo` de la regla custom al `tipo_regla` que reconoce el
// builder narrativo del AST engine.
const CUSTOM_TIPO_TO_AST: Record<ReglaCustomTipo, string> = {
  no_nulo: "required",
  rango_num: "range",
  rango_fecha: "range",
  outliers_iqr: "outlier",
  outliers_z: "outlier",
  duplicados: "duplicate",
  fuera_catalogo: "catalog",
  coherencia_2v: "coherence",
};

// Label humano del tipo — se usa también como `categoria_ux` y en el chip
// de la lista.
export const CUSTOM_TIPO_LABEL: Record<ReglaCustomTipo, string> = {
  no_nulo: "No nulo",
  rango_num: "Rango numérico",
  rango_fecha: "Rango de fecha",
  outliers_iqr: "Outliers (IQR)",
  outliers_z: "Outliers (Z-score)",
  duplicados: "Duplicados",
  fuera_catalogo: "Fuera de catálogo",
  coherencia_2v: "Coherencia 2v",
};

// Construye una descripción corta a partir de los parámetros — útil cuando
// la regla aún no tiene nombre (preview en vivo del editor).
export function describeCustomParams(
  tipo: ReglaCustomTipo,
  params: Record<string, unknown>,
): string {
  const mn = typeof params.min === "string" ? params.min : null;
  const mx = typeof params.max === "string" ? params.max : null;
  const k = typeof params.k === "number" ? params.k : null;
  const valores = Array.isArray(params.valores) ? params.valores.length : 0;

  switch (tipo) {
    case "no_nulo":
      return "No puede estar vacío ni NA.";
    case "rango_num":
      if (mn && mx) return `Debe estar entre ${mn} y ${mx}.`;
      if (mn) return `Debe ser ≥ ${mn}.`;
      if (mx) return `Debe ser ≤ ${mx}.`;
      return "Define un rango permitido.";
    case "rango_fecha":
      if (mn && mx) return `Debe estar entre ${mn} y ${mx}.`;
      if (mn) return `Debe ser desde ${mn}.`;
      if (mx) return `Debe ser hasta ${mx}.`;
      return "Define el rango de fechas permitido.";
    case "outliers_iqr":
      return `Se marcan valores fuera de [Q1 − ${k ?? 1.5}·IQR, Q3 + ${k ?? 1.5}·IQR].`;
    case "outliers_z":
      return `Se marcan valores con |z-score| > ${k ?? 3}.`;
    case "duplicados":
      return "Se marcan casos cuya combinación de variables se repita.";
    case "fuera_catalogo":
      return valores > 0
        ? `Se marcan casos con valores fuera de la lista permitida (${valores} entradas).`
        : "Define la lista de valores permitidos.";
    case "coherencia_2v":
      return "Si la primera variable cumple su condición, la segunda debe cumplir la suya.";
    default:
      return "";
  }
}

// Convierte una ReglaCustom completa (ya guardada) al shape ReglaLike.
export function customRuleToRule(r: ReglaCustom): ReglaLike {
  const target = r.variables[0] ?? null;
  const gate = r.tipo === "coherencia_2v" && r.variables[1] ? [r.variables[1]] : null;
  return {
    id: r.id,
    nombre: r.nombre,
    tipo_regla: CUSTOM_TIPO_TO_AST[r.tipo] ?? null,
    tipo_observacion: r.tipo,
    fuente: "custom",
    severidad: r.severidad,
    categoria_ux: CUSTOM_TIPO_LABEL[r.tipo] ?? r.tipo,
    objetivo: r.mensaje || describeCustomParams(r.tipo, r.params) || null,
    variables: r.variables,
    variable_roles: target ? (gate ? { target, gate } : { target }) : null,
    n_casos: null,
    porcentaje: null,
  };
}

// Versión draft: construye un ReglaLike desde estado parcial del editor.
// Útil para el preview en vivo — no requiere id ni mensaje, pero sí al
// menos un tipo y una variable.
export function draftCustomToRule(input: {
  tipo: ReglaCustomTipo | null;
  variables: string[];
  nombre: string;
  mensaje: string;
  params: Record<string, unknown>;
}): ReglaLike | null {
  if (!input.tipo || !input.variables.length) return null;
  const target = input.variables[0] ?? null;
  const gate =
    input.tipo === "coherencia_2v" && input.variables[1]
      ? [input.variables[1]]
      : null;
  const objetivo =
    input.mensaje.trim() || describeCustomParams(input.tipo, input.params) || null;
  return {
    id: undefined,
    nombre: input.nombre.trim() || CUSTOM_TIPO_LABEL[input.tipo],
    tipo_regla: CUSTOM_TIPO_TO_AST[input.tipo] ?? null,
    tipo_observacion: input.tipo,
    fuente: "custom",
    severidad: "error",
    categoria_ux: CUSTOM_TIPO_LABEL[input.tipo],
    objetivo,
    variables: input.variables,
    variable_roles: target ? (gate ? { target, gate } : { target }) : null,
    n_casos: null,
    porcentaje: null,
  };
}
