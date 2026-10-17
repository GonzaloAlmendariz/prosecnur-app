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
import { tipoPregunta } from "../kit/tiposPregunta";

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

/** Etiqueta humana en español para el tipo base: la del catálogo único del kit (M8, 2026-10-17). */
export function typeLabel(baseType: string): string {
  return tipoPregunta(baseType).nombre;
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

/** Las tres lecturas posibles de la columna `required` de una fila XLSForm. */
export type LecturaRequired = "siempre" | "nunca" | "expresion";

const REQUIRED_SIEMPRE = new Set(["yes", "true", "1", "true()", "si", "sí"]);
const REQUIRED_NUNCA = new Set(["", "no", "false", "0", "false()"]);

/**
 * Única lectura de `required` del editor: una constante afirmativa es «siempre», una negativa o el vacío es
 * «nunca» y cualquier otra cosa es una expresión XPath. No distingue mayúsculas.
 */
export function lecturaRequired(raw: string | null | undefined): LecturaRequired {
  const value = (raw ?? "").trim().toLowerCase();
  if (REQUIRED_SIEMPRE.has(value)) return "siempre";
  if (REQUIRED_NUNCA.has(value)) return "nunca";
  return "expresion";
}

/** Interpreta el campo `required` en su forma string como boolean: sólo la constante afirmativa cuenta. */
export function asRequired(raw: string): boolean {
  return lecturaRequired(raw) === "siempre";
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

/**
 * Etiqueta corta del origen de un workbook, para la banda de comandos.
 *
 * Se dice «Desde X» y no «Importado desde X»: la procedencia es un dato de
 * consulta ocasional y su versión larga empujaba el estado del formulario a
 * una segunda línea. El texto completo vive en `formatSourceLong`, que la
 * banda expone como title.
 */
export function formatSource(kind: string | null): string {
  switch (kind) {
    case "surveymonkey":
      return "Desde SurveyMonkey";
    case "xlsform":
      return "Desde XLSForm";
    default:
      return "Nuevo";
  }
}

/** Versión explicada del origen, para tooltips y textos de apoyo. */
export function formatSourceLong(kind: string | null): string {
  switch (kind) {
    case "surveymonkey":
      return "Importado desde una encuesta de SurveyMonkey";
    case "xlsform":
      return "Importado desde un archivo XLSForm";
    default:
      return "Creado desde cero en el constructor";
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
    case "paper":
      return "Papel";
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
    case "paper":
      return "Bloques y metadatos opcionales para el PDF impreso.";
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
