/**
 * Funciones puras del editor de reglas propias: jerarquías de selección
 * múltiple, parámetros que se mandan al guardar, condiciones previas y
 * tratamiento previsto por tipo.
 *
 * Salieron del asistente `ReglaEditor` (ya retirado; rebanada V1 de P6). La rebanada
 * V2 del plan de fidelidad les suma el tipo "Condiciones combinadas" y la
 * comparación con otra pregunta del contrato M1. Lo que entregan al guardar lo
 * fija `payloadDeRegla.test.tsx`.
 */
import type {
  ExploradorVariable,
  ReglaGateCondition,
  ReglaTreatmentActionType,
  ReglaTreatmentScope,
} from "../types";
import type { TipoMeta } from "./tiposDeRegla";
import {
  esOperadorDeComparacion,
  type CondicionCombinada,
  type ModoCondiciones,
  type TipoReglaPropia,
} from "./tiposDelMotor";

export type HierarchyRow = {
  trigger: string;
  required: string;
};

export function nombreSugerido(tipoMeta: TipoMeta | null, variables: string[]): string {
  const base = tipoMeta?.label ?? "Criterio";
  if (tipoMeta?.key === "bateria" && variables.length > 2) return `${base}: ${variables[0]} a ${variables[variables.length - 1]}`;
  return variables.length ? `${base}: ${variables.join(" y ")}` : base;
}

export function hierarchyMapText(params: Record<string, unknown>) {
  const rawText = params.hierarchy_map_text;
  if (typeof rawText === "string") return rawText;
  const rawMap = params.hierarchy_map;
  if (rawMap && typeof rawMap === "object") {
    return JSON.stringify(rawMap, null, 2);
  }
  return "";
}

export function hierarchyRowsFromParams(params: Record<string, unknown>): HierarchyRow[] {
  const rawRows = params.hierarchy_rows;
  if (Array.isArray(rawRows)) {
    return rawRows.map((raw) => {
      const row = raw as Record<string, unknown>;
      return {
        trigger: String(row.trigger ?? "").trim(),
        required: Array.isArray(row.required)
          ? row.required.map((value) => String(value).trim()).filter(Boolean).join("\n")
          : String(row.required ?? "").trim(),
      };
    });
  }

  const rawMap = params.hierarchy_map;
  if (rawMap && typeof rawMap === "object" && !Array.isArray(rawMap)) {
    return Object.entries(rawMap as Record<string, unknown>).map(([trigger, raw]) => ({
      trigger,
      required: paramList(raw).join("\n"),
    }));
  }

  const text = hierarchyMapText(params);
  if (text) {
    const parsed = parseHierarchyMapText(text);
    if (parsed.ok) {
      return Object.entries(parsed.value).map(([trigger, values]) => ({
        trigger,
        required: values.join("\n"),
      }));
    }
  }

  return [{ trigger: "", required: "" }];
}

export function hierarchyMapFromRows(rows: HierarchyRow[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const row of rows) {
    const trigger = row.trigger.trim();
    const required = paramList(row.required).filter((value) => value !== trigger);
    if (trigger && required.length) out[trigger] = Array.from(new Set(required));
  }
  return out;
}

export function parseHierarchyMapText(text: string): { ok: true; value: Record<string, string[]> } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Define el mapa manual en formato JSON." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "El mapa manual debe ser JSON válido." };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "El mapa debe ser un objeto JSON: cada clave activa una lista de códigos." };
  }
  const out: Record<string, string[]> = {};
  for (const [trigger, raw] of Object.entries(parsed as Record<string, unknown>)) {
    const key = String(trigger).trim();
    const values = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,\s]+/) : [];
    const clean = values.map((value) => String(value).trim()).filter((value) => value && value !== key);
    if (key && clean.length) out[key] = Array.from(new Set(clean));
  }
  return { ok: true, value: out };
}

/** El tipo de una pregunta del inventario, por su nombre; `undefined` si no está. */
export type TipoDeVariable = (variable: string) => ExploradorVariable["tipo"] | undefined;

export function normalizeParamsForSubmit(
  tipo: TipoReglaPropia,
  params: Record<string, unknown>,
  tipoDeVariable: TipoDeVariable = () => undefined,
) {
  const rest = { ...params };
  if (tipo === "condiciones") {
    return {
      modo: modoDeCondiciones(params.modo),
      condiciones: condicionesDeParams(params).map((c) => condicionParaGuardar(c, tipoDeVariable)),
    };
  }
  if (tipo === "coherencia_2v" && "valor_y_variable" in params) {
    // Comparar con otra pregunta reemplaza al valor (contrato M1, sección 5):
    // las dos cosas a la vez son un 400. Sin la clave, la regla se guarda
    // como siempre.
    const comparada = String(params.valor_y_variable ?? "").trim();
    const { valor_y: _valorY, valor_y_variable: _comparada, ...sinLadoY } = rest;
    return comparada ? { ...sinLadoY, valor_y_variable: comparada } : { ...sinLadoY, ...(params.valor_y === undefined ? {} : { valor_y: params.valor_y }) };
  }
  if (tipo === "rango_fecha") {
    return { ...rest, timezone: String(params.timezone ?? "America/Lima").trim() || "America/Lima" };
  }
  if (tipo === "duplicados") {
    return { ...rest, missing_key_policy: "ignore_missing" };
  }
  if (tipo === "select_multiple_hierarchy") {
    const map = hierarchyMapFromRows(hierarchyRowsFromParams(params));
    delete rest.hierarchy_map_text;
    return { ...rest, hierarchy_map: map };
  }
  if (tipo === "select_multiple_exclusive") {
    return { ...rest, exclusive_codes: paramList(params.exclusive_codes) };
  }
  if (tipo === "select_multiple_cardinality") {
    const min = nullableNumber(params.min);
    const max = nullableNumber(params.max);
    return {
      ...rest,
      ...(min === null ? {} : { min }),
      ...(max === null ? {} : { max }),
    };
  }
  if (tipo === "select_multiple_selection") {
    return { ...rest, op: String(params.op ?? "contains_any"), codes: paramList(params.codes) };
  }
  if (tipo === "bateria") return paramsDeBateria(params);
  return params;
}

// --- Patrón en una batería ------------------------------------------------------

export type PatronDeBateria = "iguales" | "codigo" | "vacias";

export function patronDeBateria(valor: unknown): PatronDeBateria {
  return valor === "codigo" || valor === "vacias" ? valor : "iguales";
}

/**
 * El mínimo de la batería: el escrito o, sin escribir, el que el motor toma
 * (todas las preguntas en "iguales" y "vacias"); `null` en "codigo" sin mínimo.
 */
export function minimoDeBateria(params: Record<string, unknown>, nPreguntas: number): number | null {
  const escrito = nullableNumber(params.minimo);
  if (escrito !== null) return escrito;
  return patronDeBateria(params.patron) === "codigo" ? null : nPreguntas;
}

/** Los parámetros de una batería como los espera el motor: solo los del patrón elegido. */
export function paramsDeBateria(params: Record<string, unknown>): Record<string, unknown> {
  const patron = patronDeBateria(params.patron);
  const minimo = nullableNumber(params.minimo);
  return {
    patron,
    ...(minimo === null ? {} : { minimo }),
    ...(patron === "codigo" ? { codigos: paramList(params.codigos) } : {}),
    ...(patron === "iguales" ? { no_cuentan: paramList(params.no_cuentan), vacias_cuentan: params.vacias_cuentan === true } : {}),
  };
}

/** El primer problema de una batería, o "" si se puede guardar. Mismos límites que el esquema del motor. */
export function validarBateria(params: Record<string, unknown>, nPreguntas: number): string {
  if (nPreguntas < 2) return "Elige al menos 2 preguntas para la batería.";
  const patron = patronDeBateria(params.patron);
  if (patron === "codigo" && !paramList(params.codigos).length) return "Elige el código que se cuenta.";
  const minimo = minimoDeBateria(params, nPreguntas);
  const inferior = patron === "iguales" ? 2 : 1;
  if (minimo === null) return "Define en cuántas preguntas debe aparecer el código.";
  if (!Number.isInteger(minimo) || minimo < inferior || minimo > nPreguntas) {
    return `El mínimo debe ser un número entero entre ${inferior} y ${nPreguntas}.`;
  }
  return "";
}

export function paramList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
  if (typeof value === "string") return parseListText(value);
  if (value === null || value === undefined) return [];
  return [String(value).trim()].filter(Boolean);
}

export function parseListText(text: string): string[] {
  return text
    .split(/\r?\n|,/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function listText(value: unknown): string {
  return paramList(value).join("\n");
}

export function nullableNumber(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("es-PE", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function variableTipoLabel(tipo: ExploradorVariable["tipo"]) {
  if (tipo === "sm") return "selección múltiple";
  if (tipo === "so") return "opción única";
  if (tipo === "num") return "número";
  if (tipo === "fecha") return "fecha";
  if (tipo === "texto") return "texto";
  return "mixta";
}

export function formatVariableOption(variable: ExploradorVariable): string {
  const label = variable.label && variable.label !== variable.name
    ? `${variable.label} (${variable.name})`
    : variable.name;
  return `${label}, ${variableTipoLabel(variable.tipo)}`;
}

export function emptyGateCondition(flatVars: ExploradorVariable[]): ReglaGateCondition {
  const first = flatVars[0];
  const op = operatorOptionsForVariable(first)[0]?.value ?? "==";
  return { variable: first?.name ?? "", op, value: isListOperator(op) ? [] : "" };
}

export function operatorOptionsForVariable(variable?: ExploradorVariable): Array<{ value: ReglaGateCondition["op"]; label: string }> {
  if (variable?.tipo === "sm") {
    return [
      { value: "contains", label: "incluye" },
      { value: "not_contains", label: "no incluye" },
      { value: "contains_any", label: "incluye alguna" },
      { value: "contains_all", label: "incluye todas" },
      { value: "contains_none", label: "excluye todas" },
    ];
  }
  if (variable?.tipo === "so") {
    return [
      { value: "==", label: "es" },
      { value: "!=", label: "no es" },
      { value: "in", label: "está entre" },
      { value: "not_in", label: "no está entre" },
      ...OPERADORES_DE_VACIO,
    ];
  }
  const base: Array<{ value: ReglaGateCondition["op"]; label: string }> = [
    { value: "==", label: "es" },
    { value: "!=", label: "no es" },
    { value: "in", label: "está en" },
    { value: "not_in", label: "no está en" },
  ];
  if (variable?.tipo === "num" || variable?.tipo === "fecha") {
    return [
      ...base,
      { value: ">", label: "mayor que" },
      { value: ">=", label: "mayor o igual" },
      { value: "<", label: "menor que" },
      { value: "<=", label: "menor o igual" },
      ...OPERADORES_DE_VACIO,
    ];
  }
  return [...base, ...OPERADORES_DE_VACIO];
}

// "Está vacía" y "tiene respuesta" miran si hay respuesta: no llevan valor.
// En selección múltiple no se ofrecen (la respuesta vive repartida en columnas).
const OPERADORES_DE_VACIO: Array<{ value: ReglaGateCondition["op"]; label: string }> = [
  { value: "is_empty", label: "está vacía" },
  { value: "not_empty", label: "tiene respuesta" },
];

export function esOperadorSinValor(op: string | null | undefined): boolean {
  return op === "is_empty" || op === "not_empty";
}

export function isListOperator(op: ReglaGateCondition["op"]): boolean {
  return ["in", "not_in", "contains_any", "contains_all", "contains_none"].includes(op);
}

export function validateGateConditions(conditions: ReglaGateCondition[]): string {
  for (const cond of conditions) {
    if (!cond.variable) return "Cada condición debe tener variable.";
    if (!cond.op) return "Cada condición debe tener operador.";
    if (esOperadorSinValor(cond.op)) continue;
    const values = paramList(cond.value);
    if (!values.length) return "Cada condición debe tener valor u opción.";
  }
  return "";
}

export type TreatmentActionMeta = {
  value: ReglaTreatmentActionType;
  label: string;
  description: string;
};

export const TREATMENT_ACTIONS: Record<ReglaTreatmentActionType, TreatmentActionMeta> = {
  ignore_rule: {
    value: "ignore_rule",
    label: "Registrar sin cambios",
    description: "Conserva la señal como evidencia para la cola.",
  },
  replace_value: {
    value: "replace_value",
    label: "Corregir valor",
    description: "Cambia un valor observado por otro.",
  },
  set_value: {
    value: "set_value",
    label: "Asignar valor",
    description: "Completa un valor definido para el campo.",
  },
  recode_map: {
    value: "recode_map",
    label: "Recodificar equivalencias",
    description: "Convierte valores por un mapa de correspondencias.",
  },
  complete_select_multiple_hierarchy: {
    value: "complete_select_multiple_hierarchy",
    label: "Completar selección múltiple",
    description: "Agrega opciones esperadas cuando falta una marca asociada.",
  },
  adjust_select_multiple: {
    value: "adjust_select_multiple",
    label: "Agregar o quitar opciones",
    description: "Ajusta marcas específicas en una selección múltiple.",
  },
  nullify_fields: {
    value: "nullify_fields",
    label: "Anular campos",
    description: "Vacía un campo o un bloque de variables.",
  },
  exclude_cases: {
    value: "exclude_cases",
    label: "Excluir registros",
    description: "Retira registros de la base final.",
  },
};

export const TREATMENT_SCOPES: Array<{
  value: ReglaTreatmentScope;
  label: string;
  description: string;
}> = [
  {
    value: "all",
    label: "Todos",
    description: "Mismo tratamiento para todos los hallazgos.",
  },
  {
    value: "selected",
    label: "Selección",
    description: "Elegir registros antes de aplicar.",
  },
  {
    value: "single",
    label: "Uno por uno",
    description: "Decidir registro por registro.",
  },
];

export function treatmentActionsForTipo(tipo: TipoReglaPropia): TreatmentActionMeta[] {
  const values: ReglaTreatmentActionType[] =
    tipo === "select_multiple_hierarchy"
      ? ["complete_select_multiple_hierarchy", "adjust_select_multiple", "ignore_rule", "nullify_fields", "exclude_cases"]
      : tipo === "select_multiple_exclusive" || tipo === "select_multiple_cardinality" || tipo === "select_multiple_selection"
        ? ["adjust_select_multiple", "nullify_fields", "ignore_rule", "exclude_cases"]
        : tipo === "duplicados"
          ? ["exclude_cases", "ignore_rule", "nullify_fields"]
          : tipo === "fuera_catalogo"
            ? ["recode_map", "replace_value", "ignore_rule", "nullify_fields", "exclude_cases"]
            : tipo === "no_nulo"
              ? ["set_value", "ignore_rule", "nullify_fields", "exclude_cases"]
              : ["ignore_rule", "replace_value", "set_value", "nullify_fields", "exclude_cases"];
  return values.map((value) => TREATMENT_ACTIONS[value]);
}

export function treatmentDefaultFor(tipo: TipoReglaPropia | null): {
  action: ReglaTreatmentActionType;
  scope: ReglaTreatmentScope;
} {
  switch (tipo) {
    case "select_multiple_hierarchy":
      return { action: "complete_select_multiple_hierarchy", scope: "all" };
    case "select_multiple_exclusive":
    case "select_multiple_cardinality":
    case "select_multiple_selection":
      return { action: "adjust_select_multiple", scope: "selected" };
    case "duplicados":
      return { action: "exclude_cases", scope: "selected" };
    case "fuera_catalogo":
      return { action: "recode_map", scope: "all" };
    case "no_nulo":
      return { action: "set_value", scope: "selected" };
    case "rango_num":
    case "rango_fecha":
    case "coherencia_2v":
    default:
      return { action: "ignore_rule", scope: "single" };
  }
}

export function normalizeTreatmentAction(
  value: unknown,
  fallback: ReglaTreatmentActionType,
): ReglaTreatmentActionType {
  const raw = String(value ?? "");
  return raw in TREATMENT_ACTIONS ? (raw as ReglaTreatmentActionType) : fallback;
}

export function normalizeTreatmentScope(
  value: unknown,
  fallback: ReglaTreatmentScope,
): ReglaTreatmentScope {
  const raw = String(value ?? "");
  return raw === "all" || raw === "selected" || raw === "single"
    ? raw
    : fallback;
}

export function gateExprFromConditions(conditions: ReglaGateCondition[]): string {
  const parts = conditions
    .filter((cond) => cond.variable && cond.op && paramList(cond.value).length)
    .map((cond) => gateConditionToExpr(cond))
    .filter(Boolean);
  return parts.join(" and ");
}

export function gateConditionToExpr(cond: ReglaGateCondition): string {
  const values = paramList(cond.value);
  const varRef = `\${${cond.variable}}`;
  if (cond.op === "contains") {
    return `selected(${varRef}, ${quoteGateValue(values[0] ?? "")})`;
  }
  if (cond.op === "not_contains") {
    return `not(selected(${varRef}, ${quoteGateValue(values[0] ?? "")}))`;
  }
  if (cond.op === "contains_all") {
    return values.map((value) => `selected(${varRef}, ${quoteGateValue(value)})`).join(" and ");
  }
  if (cond.op === "contains_any") {
    return values.map((value) => `selected(${varRef}, ${quoteGateValue(value)})`).join(" or ");
  }
  if (cond.op === "contains_none") {
    return values.map((value) => `not(selected(${varRef}, ${quoteGateValue(value)}))`).join(" and ");
  }
  if (cond.op === "in" || cond.op === "not_in") {
    const joined = values.map(quoteGateValue).join(", ");
    const fn = cond.op === "in" ? "in" : "not_in";
    return `${fn}(${varRef}, ${joined})`;
  }
  const op = cond.op === "==" ? "=" : cond.op;
  return `${varRef} ${op} ${quoteGateValue(values[0] ?? "")}`;
}

export function quoteGateValue(value: string): string {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

// --- Condiciones combinadas (contrato M1, sección 5) ---------------------------

export function modoDeCondiciones(valor: unknown): ModoCondiciones {
  return valor === "alguna" ? "alguna" : "todas";
}

/** Las condiciones guardadas en `params`, sin las que no son objetos. */
export function condicionesDeParams(params: Record<string, unknown>): CondicionCombinada[] {
  const crudas = Array.isArray(params.condiciones) ? params.condiciones : [];
  return crudas
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object" && !Array.isArray(c))
    .map((c) => {
      const comparada = typeof c.variable_comparada === "string" ? c.variable_comparada : "";
      const op = String(c.op ?? "") as CondicionCombinada["op"];
      const base: CondicionCombinada = { variable: String(c.variable ?? ""), op };
      if (comparada) return { ...base, variable_comparada: comparada };
      const valor = c.valor;
      if (Array.isArray(valor)) return { ...base, valor: valor.map((v) => String(v)) };
      if (typeof valor === "number" || typeof valor === "string") return { ...base, valor };
      return { ...base, valor: "" };
    });
}

/**
 * Una condición como la espera el motor: con `valor` o con
 * `variable_comparada`. En una pregunta numérica el valor de una comparación
 * viaja como número; con texto, R compararía letra por letra.
 */
export function condicionParaGuardar(c: CondicionCombinada, tipoDeVariable: TipoDeVariable): CondicionCombinada {
  const variable = c.variable.trim();
  const comparada = (c.variable_comparada ?? "").trim();
  if (comparada) return { variable, op: c.op, variable_comparada: comparada };
  if (esOperadorSinValor(c.op)) return { variable, op: c.op };
  if (c.op && isListOperator(c.op)) return { variable, op: c.op, valor: paramList(c.valor) };
  const escalar = Array.isArray(c.valor) ? (c.valor[0] ?? "") : (c.valor ?? "");
  if (typeof escalar === "number") return { variable, op: c.op, valor: escalar };
  const texto = escalar.trim();
  const numero = Number(texto);
  const esNumerica = tipoDeVariable(variable) === "num";
  return { variable, op: c.op, valor: esNumerica && texto !== "" && Number.isFinite(numero) ? numero : texto };
}

/** Las preguntas que usa una regla de condiciones: las revisadas y las comparadas, sin repetir. */
export function variablesDeCondiciones(condiciones: readonly CondicionCombinada[]): string[] {
  const vistas: string[] = [];
  for (const c of condiciones) {
    for (const v of [c.variable, c.variable_comparada ?? ""]) {
      const limpia = v.trim();
      if (limpia && !vistas.includes(limpia)) vistas.push(limpia);
    }
  }
  return vistas;
}

/** El primer problema de las condiciones, o "" si están completas. Los mensajes dicen el número de la condición. */
export function validarCondiciones(condiciones: readonly CondicionCombinada[]): string {
  if (!condiciones.length) return "Agrega al menos una condición.";
  for (const [i, c] of condiciones.entries()) {
    const n = i + 1;
    if (!c.variable.trim()) return `La condición ${n} no tiene pregunta.`;
    if (!c.op) return `La condición ${n} no tiene operador.`;
    const comparada = (c.variable_comparada ?? "").trim();
    if (comparada) {
      if (comparada === c.variable.trim()) return `La condición ${n} compara una pregunta consigo misma.`;
      if (!esOperadorDeComparacion(c.op)) return `La condición ${n} compara con otra pregunta: usa es, no es, mayor o menor.`;
      continue;
    }
    if (esOperadorSinValor(c.op)) continue;
    if (!paramList(c.valor).length) return `La condición ${n} no tiene valor.`;
  }
  return "";
}

/**
 * El tratamiento previsto como lo nombra el panel de regla (prototipo: "Sin
 * propuesta", "Vaciar la respuesta", "Corregir el valor"), con las palabras de
 * la columna "Qué hacer" de Hallazgos.
 */
export const ROTULO_DE_TRATAMIENTO: Record<ReglaTreatmentActionType, string> = {
  ignore_rule: "Sin propuesta",
  nullify_fields: "Vaciar la respuesta",
  replace_value: "Corregir el valor",
  set_value: "Asignar un valor",
  exclude_cases: "Excluir los casos",
  recode_map: "Recodificar",
  complete_select_multiple_hierarchy: "Completar las opciones",
  adjust_select_multiple: "Agregar o quitar opciones",
};
