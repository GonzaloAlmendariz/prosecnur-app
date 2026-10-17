// Lectura de condiciones del mapa de lógica: partir and/or de primer nivel, opciones de una misma
// variable y relevant con etiquetas. Extraído de canvas-graph/LogicCanvas.tsx — refactor puro, revamp 2026-10-16.

import { X } from "lucide-react";
import { compactTitle } from "./DetalleNodo";

export function splitLogicalGroups(expr: string): string[][] {
  const cleaned = stripOuterParens(expr.trim());
  if (!cleaned) return [[]];
  const orParts = splitTopLevelLogical(cleaned, "or");
  return orParts.map((orPart) => {
    const andParts = splitTopLevelLogical(stripOuterParens(orPart), "and");
    return andParts.map(stripOuterParens).filter(Boolean);
  }).filter((group) => group.length > 0);
}

export function splitTopLevelLogical(expr: string, op: "and" | "or"): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < expr.length; i += 1) {
    const ch = expr[i]!;
    if (quote) {
      if (ch === quote && expr[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === "(") {
      depth += 1;
      continue;
    }
    if (ch === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth === 0 && matchesLogicalWord(expr, i, op)) {
      parts.push(expr.slice(start, i).trim());
      i += op.length - 1;
      start = i + 1;
    }
  }
  parts.push(expr.slice(start).trim());
  return parts.filter(Boolean);
}

export function matchesLogicalWord(expr: string, index: number, op: "and" | "or"): boolean {
  if (expr.slice(index, index + op.length).toLowerCase() !== op) return false;
  const before = index === 0 ? "" : expr[index - 1] ?? "";
  const after = expr[index + op.length] ?? "";
  return !/[A-Za-z0-9_]/.test(before) && !/[A-Za-z0-9_]/.test(after);
}

export function stripOuterParens(value: string): string {
  let s = value.trim();
  let changed = true;
  while (changed && s.startsWith("(") && s.endsWith(")")) {
    changed = false;
    let depth = 0;
    let quote: "'" | '"' | null = null;
    let enclosesWhole = true;
    for (let i = 0; i < s.length; i += 1) {
      const ch = s[i]!;
      if (quote) {
        if (ch === quote && s[i - 1] !== "\\") quote = null;
        continue;
      }
      if (ch === "'" || ch === '"') {
        quote = ch;
        continue;
      }
      if (ch === "(") depth += 1;
      if (ch === ")") depth -= 1;
      if (depth === 0 && i < s.length - 1) {
        enclosesWhole = false;
        break;
      }
    }
    if (enclosesWhole) {
      s = s.slice(1, -1).trim();
      changed = true;
    }
  }
  return s;
}

export type SameVariableOptionsSummary = {
  varName: string;
  title: string;
  operatorLabel: string;
  options: string[];
};

export function summarizeSameVariableOptions(
  parts: string[],
  lookup: LabelLookup,
  varTitle: VarTitleLookup,
): SameVariableOptionsSummary | null {
  const parsed = parts.map(parseOptionCondition);
  if (parsed.some((item) => item == null)) return null;
  const first = parsed[0]!;
  if (!parsed.every((item) => item!.varName === first.varName && item!.operator === first.operator)) {
    return null;
  }
  const rawTitle = varTitle(first.varName);
  const title = rawTitle
    ? compactTitle(rawTitle)
    : first.varName;
  return {
    varName: first.varName,
    title,
    operatorLabel: first.operator,
    options: parsed.map((item) => lookup(item!.varName, item!.code) ?? item!.code),
  };
}

export function parseOptionCondition(
  raw: string,
): { varName: string; operator: string; code: string } | null {
  const expr = stripOuterParens(raw);
  let match = expr.match(/^selected\(\s*\$\{([^}]+)\}\s*,\s*['"]([^'"]+)['"]\s*\)$/);
  if (match) {
    return { varName: match[1]!, operator: "contiene", code: match[2]! };
  }
  match = expr.match(/^not\s*\(\s*selected\(\s*\$\{([^}]+)\}\s*,\s*['"]([^'"]+)['"]\s*\)\s*\)$/);
  if (match) {
    return { varName: match[1]!, operator: "no contiene", code: match[2]! };
  }
  match = expr.match(/^\$\{([^}]+)\}\s*=\s*['"]([^'"]+)['"]$/);
  if (match) {
    return { varName: match[1]!, operator: "es", code: match[2]! };
  }
  match = expr.match(/^\$\{([^}]+)\}\s*!=\s*['"]([^'"]+)['"]$/);
  if (match) {
    return { varName: match[1]!, operator: "no es", code: match[2]! };
  }
  return null;
}

/**
 * Convierte una expresión `relevant` cruda en texto legible en
 * español. Antes era una limpieza mínima (sólo sacaba `${...}`) y
 * dejaba la sintaxis ODK; el resultado era cosas tipo
 * `selected(apoderado, '2') and edad != ''` que confundían al usuario.
 *
 * Reglas de traducción:
 *   · `selected(${X}, 'v')`        →  `X contiene 'v'`
 *   · `not(selected(${X}, 'v'))`   →  `X no contiene 'v'`
 *   · `${X} != ''`                 →  `X tiene valor`
 *   · `${X} = ''`                  →  `X está vacío`
 *   · `${X} != Y`                  →  `X ≠ Y`
 *   · `${X} = Y`                   →  `X = Y`
 *   · `and` / `or` / `not(...)`    →  `y` / `o` / `no(...)`
 *
 * Se aplican en orden cuidadoso para no pisarse (selected primero,
 * luego operadores, luego ${}). El resultado preserva los valores
 * literales (números, strings entre comillas) tal cual.
 */
/** Referencia corta de una variable para el chip compacto: "pregunta_1"
 *  o "p1" → "P1"; "p6_otro" → "P6·otro". Devuelve null si no calza el
 *  patrón pN (el caller cae al name crudo). */
export function nameToRef(name: string): string | null {
  const m = /^p(?:regunta)?_?0*(\d+)(?:_(.+))?$/i.exec(name.trim());
  if (!m) return null;
  return `P${m[1]}${m[2] ? `·${m[2]}` : ""}`;
}
/** Versión completa que resuelve códigos `'1'` a labels (`'Sí'`).
 *
 *  `lookup(varName, code)` debe devolver el label legible o null
 *  si no se encuentra. Lo construye `LogicCanvas` a partir de
 *  `structure` + `catalogs`. */
export type LabelLookup = (varName: string, code: string) => string | null;
export type VarTitleLookup = (varName: string) => string | null;

export function humanizeRelevantWithLabels(
  expr: string,
  lookup: LabelLookup | null,
  varTitle: VarTitleLookup | null = null,
  compact = false,
): string {
  let r = expr;
  const resolveCode = (varName: string, code: string): string => {
    if (!lookup) return code;
    const label = lookup(varName, code);
    if (label && label !== code) {
      return label;
    }
    return code;
  };
  // Resuelve `q0027` → `«¿Qué actividades laborales realiza?...» (q0027)`
  // para que el usuario reconozca la pregunta sin perder la referencia
  // al code interno del XLSForm. Usamos «» (guillemets) para que el
  // título no se confunda con los literales 'value' que vienen entre
  // comillas simples.
  const resolveVar = (varName: string): string => {
    if (!varTitle) return varName;
    const raw = varTitle(varName);
    if (!raw || raw === varName) return varName;
    // Modo compacto (chip sobre el edge): solo la referencia corta que
    // devuelve `varTitle` (ej. "P1"), sin el prompt ni el `(name)`.
    if (compact) return raw;
    // La condición referencia la pregunta, no la transcribe: markdown
    // limpio + incipit truncado (ver `compactTitle`).
    return `«${compactTitle(raw)}» (${varName})`;
  };
  // selected(${X}, 'v') → X contiene 'v_label'
  r = r.replace(
    /selected\(\s*\$\{([^}]+)\}\s*,\s*'([^']*)'\s*\)/g,
    (_, varName: string, code: string) =>
      `${resolveVar(varName)} contiene '${resolveCode(varName, code)}'`,
  );
  r = r.replace(
    /selected\(\s*\$\{([^}]+)\}\s*,\s*"([^"]*)"\s*\)/g,
    (_, varName: string, code: string) =>
      `${resolveVar(varName)} contiene "${resolveCode(varName, code)}"`,
  );
  // selected(${X}, code) con valor SIN comillas — ODK acepta códigos
  // numéricos crudos, ej. `selected(${p22}, 80)`. Sin esta variante el
  // wrapper `selected(...)` quedaba visible tal cual tras resolver ${X}.
  r = r.replace(
    /selected\(\s*\$\{([^}]+)\}\s*,\s*([^'")\s,]+)\s*\)/g,
    (_, varName: string, code: string) =>
      `${resolveVar(varName)} contiene '${resolveCode(varName, code)}'`,
  );
  // not( ... contiene ... ) → ... no contiene ...
  // El "varRef" capturado puede incluir `«…» (name)` además del nombre
  // simple, así que aceptamos cualquier secuencia hasta `contiene`.
  r = r.replace(
    /\bnot\s*\(\s*(.+?)\s+contiene\s+('[^']*'|"[^"]*")\s*\)/g,
    "$1 no contiene $2",
  );
  // ${X} != '' / = '' (PRIMERO, antes de los != / = generales).
  r = r.replace(/\$\{([^}]+)\}\s*!=\s*''/g, (_, varName: string) => `${resolveVar(varName)} tiene valor`);
  r = r.replace(/\$\{([^}]+)\}\s*=\s*''/g, (_, varName: string) => `${resolveVar(varName)} está vacío`);
  // ${X} = 'code' / != 'code' → resolver código a label.
  r = r.replace(
    /\$\{([^}]+)\}\s*=\s*'([^']*)'/g,
    (_, varName: string, code: string) =>
      `${resolveVar(varName)} = '${resolveCode(varName, code)}'`,
  );
  r = r.replace(
    /\$\{([^}]+)\}\s*!=\s*'([^']*)'/g,
    (_, varName: string, code: string) =>
      `${resolveVar(varName)} ≠ '${resolveCode(varName, code)}'`,
  );
  // ${X} → X resuelto (después de los casos anteriores).
  r = r.replace(/\$\{([^}]+)\}/g, (_, varName: string) => resolveVar(varName));
  // Operadores comunes con espacios alrededor (los que no fueron
  // capturados con valor).
  r = r.replace(/\s*!=\s*/g, " ≠ ");
  r = r.replace(/\s*>=\s*/g, " ≥ ");
  r = r.replace(/\s*<=\s*/g, " ≤ ");
  // and / or como palabras enteras.
  r = r.replace(/\s+\band\b\s+/g, " y ");
  r = r.replace(/\s+\bor\b\s+/g, " o ");
  // not(...) genérico que no haya quedado capturado arriba.
  r = r.replace(/\bnot\s*\(/g, "no(");
  // Compactar espacios.
  r = r.replace(/\s+/g, " ").trim();
  return r;
}
