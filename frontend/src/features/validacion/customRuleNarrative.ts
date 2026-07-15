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
  select_multiple_hierarchy: "select_multiple_cardinality",
  select_multiple_exclusive: "select_multiple_cardinality",
  select_multiple_cardinality: "select_multiple_cardinality",
  select_multiple_selection: "select_multiple_cardinality",
};

// Label humano del tipo — se usa también como `categoria_ux` y en el chip
// de la lista.
export const CUSTOM_TIPO_LABEL: Record<ReglaCustomTipo, string> = {
  no_nulo: "Respuesta obligatoria",
  rango_num: "Duración o métrica sospechosa",
  rango_fecha: "Fecha fuera del operativo",
  outliers_iqr: "Outliers (IQR)",
  outliers_z: "Outliers (Z-score)",
  duplicados: "Duplicados operativos",
  fuera_catalogo: "Respuesta fuera de lista",
  coherencia_2v: "Coherencia o plausibilidad",
  select_multiple_hierarchy: "Jerarquía de selección múltiple",
  select_multiple_exclusive: "Opciones incompatibles",
  select_multiple_cardinality: "Cantidad de opciones marcada",
  select_multiple_selection: "Opciones esperadas o prohibidas",
};

// Construye una descripción corta a partir de los parámetros — útil cuando
// la regla aún no tiene nombre (preview en vivo del editor).
export function describeCustomParams(
  tipo: ReglaCustomTipo,
  params: Record<string, unknown>,
  variables: string[] = [],
): string {
  const mn = typeof params.min === "string" ? params.min : null;
  const mx = typeof params.max === "string" ? params.max : null;
  const k = typeof params.k === "number" ? params.k : null;
  const valores = Array.isArray(params.valores) ? params.valores.length : 0;

  switch (tipo) {
    case "no_nulo":
      return "Marca las filas donde la variable quedó vacía o con NA.";
    case "rango_num":
      if (mn && mx) return `Debe estar entre ${mn} y ${mx}.`;
      if (mn) return `Debe ser ≥ ${mn}.`;
      if (mx) return `Debe ser ≤ ${mx}.`;
      return "Define el rango esperado para una duración, conteo o métrica operativa.";
    case "rango_fecha":
      {
        const timezone = typeof params.timezone === "string" && params.timezone.trim()
          ? ` (${params.timezone.trim()})`
          : " (America/Lima)";
        if (mn && mx) return `Debe estar entre ${mn} y ${mx}${timezone}; los vacíos se revisan por separado.`;
        if (mn) return `Debe ser desde ${mn}${timezone}; los vacíos se revisan por separado.`;
        if (mx) return `Debe ser hasta ${mx}${timezone}; los vacíos se revisan por separado.`;
      }
      return "Define el periodo del operativo para esta fecha.";
    case "outliers_iqr":
      return `Se marcan valores fuera del intervalo [Q1 − ${k ?? 1.5}·IQR, Q3 + ${k ?? 1.5}·IQR].`;
    case "outliers_z":
      return `Se marcan valores cuyo |z-score| supere ${k ?? 3}.`;
    case "duplicados":
      return variables.length > 0
        ? `Se marcan todas las filas cuando la tupla (${variables.join(" + ")}) aparece más de una vez; las claves incompletas se ignoran.`
        : "Se marcan todas las filas donde esa combinación de identificadores aparece más de una vez; las claves incompletas se ignoran.";
    case "fuera_catalogo":
      return valores > 0
        ? `Se marcan filas con valores que no están en la lista permitida (${valores} entradas).`
        : "Define la lista de opciones esperadas.";
    case "coherencia_2v":
      return "Si la primera respuesta define un contexto, la segunda debe ser plausible dentro de ese contexto.";
    case "select_multiple_hierarchy": {
      const map = params.hierarchy_map;
      const n = map && typeof map === "object" && !Array.isArray(map) ? Object.keys(map).length : 0;
      return n > 0
        ? `Detecta respuestas de selección múltiple que no completan el mapa manual (${n} activador${n === 1 ? "" : "es"}).`
        : "Define qué opciones deben agregarse cuando una opción superior está marcada.";
    }
    case "select_multiple_exclusive":
      return "Detecta opciones excluyentes marcadas junto con otras respuestas.";
    case "select_multiple_cardinality":
      return "Detecta respuestas con menos o más opciones marcadas que el rango esperado.";
    case "select_multiple_selection":
      return "Detecta respuestas de selección múltiple que no cumplen el patrón de opciones esperado.";
    default:
      return "";
  }
}

// Convierte una ReglaCustom completa (ya guardada) al shape ReglaLike.
export function customRuleToRule(r: ReglaCustom): ReglaLike {
  const target = r.variables[0] ?? null;
  const gateVars = (r.gate_conditions ?? []).map((c) => c.variable).filter(Boolean);
  const gate = r.tipo === "coherencia_2v" && r.variables[1]
    ? [r.variables[1], ...gateVars]
    : gateVars.length
      ? gateVars
      : null;
  return {
    id: r.id,
    nombre: r.nombre,
    tipo_regla: CUSTOM_TIPO_TO_AST[r.tipo] ?? null,
    tipo_observacion: r.tipo,
    fuente: "custom",
    hallazgo_kind: r.hallazgo_kind ?? "caso_validar",
    origen_detalle: r.hallazgo_kind === "inconsistencia_usuario"
      ? "Personalizada: inconsistencia definida"
      : "Personalizada: caso a validar",
    severidad: r.severidad,
    categoria_ux: CUSTOM_TIPO_LABEL[r.tipo] ?? r.tipo,
    objetivo: customObjective(r.tipo, r.params, r.variables, r.mensaje),
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
  const gateVars = Array.isArray((input.params as Record<string, unknown>).gate_conditions)
    ? ((input.params as Record<string, unknown>).gate_conditions as Array<{ variable?: string }>).map((c) => c.variable ?? "").filter(Boolean)
    : [];
  const gate =
    input.tipo === "coherencia_2v" && input.variables[1]
      ? [input.variables[1], ...gateVars]
      : gateVars.length
        ? gateVars
      : null;
  const objetivo = customObjective(
    input.tipo,
    input.params,
    input.variables,
    input.mensaje,
  );
  return {
    id: undefined,
    nombre: input.nombre.trim() || CUSTOM_TIPO_LABEL[input.tipo],
    tipo_regla: CUSTOM_TIPO_TO_AST[input.tipo] ?? null,
    tipo_observacion: input.tipo,
    fuente: "custom",
    hallazgo_kind: "caso_validar",
    origen_detalle: "Personalizada: caso a validar",
    severidad: "error",
    categoria_ux: CUSTOM_TIPO_LABEL[input.tipo],
    objetivo,
    variables: input.variables,
    variable_roles: target ? (gate ? { target, gate } : { target }) : null,
    n_casos: null,
    porcentaje: null,
  };
}

function customObjective(
  tipo: ReglaCustomTipo,
  params: Record<string, unknown>,
  variables: string[],
  message: string,
): string | null {
  const detail = describeCustomParams(tipo, params, variables).trim();
  const note = message.trim();
  if (!note) return detail || null;
  if (!detail || note.toLocaleLowerCase("es").includes(detail.toLocaleLowerCase("es"))) return note;
  return `${detail} Nota: ${note}`;
}
