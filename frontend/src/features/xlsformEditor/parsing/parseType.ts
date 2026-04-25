// =============================================================================
// parsing/parseType.ts — split de la columna `type` y helpers asociados
// =============================================================================
// El campo XLSForm `type` puede ser:
//   - simple: "text", "integer", "date", "begin_group", ...
//   - con lista: "select_one COLORES", "select_multiple OPCIONES"
//
// Este módulo encapsula el parseo de ese formato y la construcción inversa
// (base + listName → "select_one COLORES").
// =============================================================================

import type { TypeInfo } from "../types";

/** Parsea un campo `type` raw a `{raw, base, listName}`. */
export function parseType(rawType: string): TypeInfo {
  const raw = (rawType ?? "").trim();
  if (!raw) return { raw: "", base: "", listName: "" };
  const parts = raw.split(/\s+/);
  const base = parts[0] ?? "";
  const listName = parts.slice(1).join(" ").trim();
  return { raw, base, listName };
}

/** Construye un `type` raw a partir de base + listName, quitando espacios. */
export function buildType(base: string, listName = ""): string {
  const normalizedBase = (base ?? "").trim();
  const normalizedList = (listName ?? "").trim();
  if (normalizedBase === "select_one" || normalizedBase === "select_multiple") {
    return normalizedList ? `${normalizedBase} ${normalizedList}` : normalizedBase;
  }
  return normalizedBase;
}

/** Etiqueta humana en español para el tipo base. */
export function typeLabel(baseType: string): string {
  switch (baseType) {
    case "text":
      return "Texto corto";
    case "integer":
      return "Número entero";
    case "decimal":
      return "Número decimal";
    case "date":
      return "Fecha";
    case "time":
      return "Hora";
    case "datetime":
      return "Fecha y hora";
    case "select_one":
      return "Selección única";
    case "select_multiple":
      return "Selección múltiple";
    case "note":
      return "Texto informativo";
    case "calculate":
      return "Cálculo";
    case "acknowledge":
      return "Confirmación";
    case "hidden":
      return "Campo oculto";
    case "image":
      return "Imagen";
    case "audio":
      return "Audio";
    case "video":
      return "Video";
    case "file":
      return "Archivo";
    case "barcode":
      return "Código de barras";
    case "geopoint":
      return "Ubicación (punto)";
    case "geotrace":
      return "Ubicación (recorrido)";
    case "geoshape":
      return "Ubicación (área)";
    case "begin_group":
      return "Sección";
    case "end_group":
      return "Cierre de sección";
    case "begin_repeat":
      return "Bloque repetido";
    case "end_repeat":
      return "Cierre de bloque repetido";
    case "start":
      return "Inicio (auto)";
    case "end":
      return "Fin (auto)";
    case "today":
      return "Fecha de hoy (auto)";
    case "deviceid":
      return "ID del dispositivo (auto)";
    case "username":
      return "Usuario (auto)";
    default:
      return baseType || "Sin tipo";
  }
}

// -----------------------------------------------------------------------------
// Helpers para condiciones simples (relevant). En F2 se reemplazan por un
// builder visual completo; en F1 se mantiene el parseo básico que ya hace
// el monolito.
// -----------------------------------------------------------------------------

export function buildSimpleCondition(
  variableName: string,
  operator: string,
  value: string,
): string {
  const variable = (variableName ?? "").trim();
  if (!variable) return "";
  const cleanValue = (value ?? "").replace(/'/g, "\\'").trim();
  if (operator === "selected") return `selected(\${${variable}}, '${cleanValue}')`;
  return `\${${variable}} ${operator} '${cleanValue}'`;
}

export function parseSimpleCondition(
  expression: string,
): { variableName: string; operator: string; value: string } | null {
  const raw = (expression ?? "").trim();
  const selected = raw.match(/^selected\(\s*\$\{([^}]+)\}\s*,\s*'([^']*)'\s*\)$/);
  if (selected) {
    return { variableName: selected[1] ?? "", operator: "selected", value: selected[2] ?? "" };
  }
  const cmp = raw.match(/^\$\{([^}]+)\}\s*(=|!=|<=|>=|<|>)\s*'([^']*)'\s*$/);
  if (cmp) {
    return { variableName: cmp[1] ?? "", operator: cmp[2] ?? "=", value: cmp[3] ?? "" };
  }
  return null;
}

// -----------------------------------------------------------------------------
// Otros helpers misceláneos heredados del monolito
// -----------------------------------------------------------------------------

/** Interpreta el campo `required` en su forma string como boolean. */
export function asRequired(raw: string): boolean {
  const value = (raw ?? "").trim().toLowerCase();
  return value === "yes" || value === "true" || value === "1";
}

/** Limpia un nombre de archivo, garantizando sufijo `_editado.xlsx`. */
export function cleanFilename(
  name: string | null | undefined,
  fallback = "instrumento_editado.xlsx",
): string {
  const raw = (name ?? "").trim();
  if (!raw) return fallback;
  const stem = raw.replace(/\.(xlsx|xls|sav)$/i, "");
  return `${stem || "instrumento"}_editado.xlsx`;
}

/** Slug ASCII para nombres ODK válidos. Reemplaza diacríticos y separadores. */
export function slug(input: string, fallback = "campo"): string {
  const safe = (input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return safe || fallback;
}

/** Etiqueta humana de un origen de workbook (importado vs nuevo). */
export function formatSource(kind: string | null): string {
  switch (kind) {
    case "surveymonkey":
      return "Importado desde SurveyMonkey";
    case "xlsform":
      return "Importado desde XLSForm";
    default:
      return "Constructor nuevo";
  }
}

// -----------------------------------------------------------------------------
// Etiquetas de hojas (usadas en headers/diagnostics)
// -----------------------------------------------------------------------------

import type { SheetKey } from "../types";

export function sheetTitle(key: SheetKey): string {
  switch (key) {
    case "survey":
      return "Survey";
    case "choices":
      return "Choices";
    case "settings":
      return "Settings";
    case "diagnostico":
      return "Diagnóstico";
  }
}

export function sheetDescription(key: SheetKey): string {
  switch (key) {
    case "survey":
      return "Vista cruda de preguntas, grupos y lógica del formulario.";
    case "choices":
      return "Vista cruda de listas de opciones.";
    case "settings":
      return "Vista cruda de metadatos del formulario.";
    case "diagnostico":
      return "Resumen técnico generado por el traductor de SurveyMonkey.";
  }
}

/** Extrae los nombres de variables referenciadas en una expresión `${var}`. */
export function extractExpressionVariables(expression: string): string[] {
  const vars = new Set<string>();
  const pattern = /\$\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(expression ?? "")) !== null) {
    const name = (match[1] ?? "").trim();
    if (name) vars.add(name);
  }
  return Array.from(vars);
}
