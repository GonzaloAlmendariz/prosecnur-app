/**
 * Lógica de dominio (pura, testeable) del mapeo MANUAL de variables del desk
 * universitario. El principio §3.3.1: la asignación de columnas es una decisión
 * CONSCIENTE del usuario, no una detección silenciosa. La detección automática
 * (inferUniversityColumn) solo produce una SUGERENCIA; nada queda "listo" hasta
 * que el usuario confirma cada campo.
 *
 * Restricción de persistencia: el workspace de R es whitelist-only y sus
 * entradas de variable_mappings solo conservan role/label/required/source_role/
 * column/description (ver .cm_normalize_workspace_variable_mappings). Por eso la
 * única señal DURABLE de "confirmado" es la presencia de `column` en la entrada
 * persistida: confirmar = escribir la columna; quitar = borrar la entrada.
 */
import type { CalcMuestraWorkspaceVariableMapping } from "../../../../api/client";
import { safeNumber } from "../../sharedCore";
import { normalizeColumnName } from "../shared/format";

export type UniversityVariableValueType = "categorica" | "numerica" | "identificador";

/** Cantidades numéricas reales que el motor trata como magnitud, no categoría. */
export const UNIVERSITY_NUMERIC_ROLES = new Set<string>(["age", "enrolled_total"]);

/** Columnas de alta cardinalidad que identifican una fila (no se resumen por
 *  categoría ni por rango): códigos, nombres y etiquetas libres. */
export const UNIVERSITY_IDENTIFIER_ROLES = new Set<string>([
  "student_id",
  "course_id",
  "course_schedule_id",
  "classroom",
  "course_name",
  "teacher",
]);

export function universityRoleValueType(role: string): UniversityVariableValueType {
  if (UNIVERSITY_NUMERIC_ROLES.has(role)) return "numerica";
  if (UNIVERSITY_IDENTIFIER_ROLES.has(role)) return "identificador";
  return "categorica";
}

export const UNIVERSITY_VALUE_TYPE_LABEL: Record<UniversityVariableValueType, string> = {
  categorica: "categórica",
  numerica: "numérica",
  identificador: "identificador",
};

/** Columna confirmada (persistida) para un rol; "" si el rol no está confirmado. */
export function universityConfirmedColumn(
  mappings: CalcMuestraWorkspaceVariableMapping[] | undefined,
  role: string,
): string {
  const row = (mappings ?? []).find((item) => item.role === role);
  return (row?.column ?? "").trim();
}

export function isUniversityRoleConfirmed(
  mappings: CalcMuestraWorkspaceVariableMapping[] | undefined,
  role: string,
): boolean {
  return universityConfirmedColumn(mappings, role).length > 0;
}

/**
 * Upsert de una asignación confirmada preservando el resto de roles tal cual
 * (NO reinfiere columnas de otros roles: esa es justamente la detección
 * automática que §3.3.1 prohíbe). Columna vacía ⇒ el rol vuelve a "sin
 * confirmar" (se elimina su entrada).
 */
export function upsertUniversityVariableMapping(
  current: CalcMuestraWorkspaceVariableMapping[] | undefined,
  base: CalcMuestraWorkspaceVariableMapping,
  column: string,
): CalcMuestraWorkspaceVariableMapping[] {
  const trimmed = column.trim();
  const rest = (current ?? []).filter((item) => item.role !== base.role);
  if (!trimmed) return rest;
  return [...rest, { ...base, column: trimmed }];
}

function findColumnKey(rows: Array<Record<string, unknown>>, column: string): string {
  const normalized = normalizeColumnName(column);
  if (!normalized) return "";
  for (const row of rows) {
    const key = Object.keys(row).find((candidate) => normalizeColumnName(candidate) === normalized);
    if (key) return key;
  }
  return "";
}

export type UniversityNumericSummary = {
  count: number;
  min: number;
  max: number;
  mean: number;
} | null;

/** Resumen numérico defensivo (conteo/min/máx/media) de una columna sobre las
 *  filas reales del marco. NA/null/"" se descartan; sin valores finitos ⇒ null. */
export function universityNumericColumnSummary(
  rows: Array<Record<string, unknown>>,
  column: string,
): UniversityNumericSummary {
  const key = findColumnKey(rows, column);
  if (!key) return null;
  const values: number[] = [];
  for (const row of rows) {
    const raw = row[key];
    if (raw === null || raw === undefined || String(raw).trim() === "") continue;
    const n = safeNumber(raw, Number.NaN);
    if (Number.isFinite(n)) values.push(n);
  }
  if (!values.length) return null;
  let min = values[0];
  let max = values[0];
  let sum = 0;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
  }
  return { count: values.length, min, max, mean: sum / values.length };
}
