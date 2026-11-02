// Qué variable abre el explorador y en qué sección vive cada una. Puro.

import type { ExploradorVariable, ExploradorVariablesList } from "../../types";

/** Sección donde vive una variable (para la cabecera y el orden del selector de cruce). */
export function findSeccionOf(varName: string, inv: ExploradorVariablesList): string | null {
  for (const sec of inv.secciones) {
    if (sec.variables.some((v) => v.name === varName)) return sec.nombre;
  }
  return null;
}

/** La primera variable útil: de contenido (no operativa) y, si se puede, categórica, numérica o fecha. */
export function pickInitialVariable(inv: ExploradorVariablesList): ExploradorVariable | null {
  const variables = inv.secciones.flatMap((section) => section.variables);
  if (!variables.length) return null;
  const usefulTypes = new Set<ExploradorVariable["tipo"]>(["so", "sm", "num", "fecha"]);
  const isOperational = (variable: ExploradorVariable) => {
    const name = variable.name.toLowerCase();
    const label = variable.label.toLowerCase();
    return (
      /^(collector|source|survey|response|respondent|case|date|email|first|last|ip|phone|form|campaign|campania|device)/.test(name) ||
      /(^|_)(id|uuid|enumerador|enumerator|respondent|response)(_|$)/.test(name) ||
      /(^|_)(ip|email|correo|mail|first_name|last_name|nombre|apellido|phone|telefono|collector|source|campaign|campania|form|formulario|device|date|time)(_|$)/.test(name) ||
      /id de respuesta|direcci[oó]n ip|correo|email|nombre|apellido|tel[eé]fono|enumerador|respondente|recopilador|fuente|campa[ñn]a|formulario|dispositivo|fecha|hora/.test(label)
    );
  };
  return (
    variables.find((variable) => usefulTypes.has(variable.tipo) && !isOperational(variable)) ??
    variables.find((variable) => !isOperational(variable)) ??
    variables[0]
  );
}
