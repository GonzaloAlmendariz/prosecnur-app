// =============================================================================
// logic/evaluate.ts — evaluador del AST de expresiones ODK contra respuestas
// =============================================================================
// Usado por el simulador de formulario (shell/FormSimulator) para decidir qué
// preguntas se muestran según la columna `relevant` y las respuestas actuales.
//
// Cobertura deliberadamente parcial: comparaciones (=, !=, <, <=, >, >=),
// and/or/not, selected(${var}, 'valor'), count-selected, referencias ${var}
// y literales string/número/boolean. Cualquier otro nodo o función lanza
// `UnsupportedExpressionError` — el caller decide el fallback (el simulador
// trata la pregunta como visible y la marca con el badge "lógica avanzada").
//
// Semántica alineada con ODK/XPath 1.0 en lo que importa para un simulador:
//   - Una variable sin responder evalúa a "" (string vacío).
//   - `=`/`!=` comparan numéricamente si ambos lados son numéricos; si no,
//     comparan como strings.
//   - `<`, `<=`, `>`, `>=` son estrictamente numéricos; con operandos no
//     numéricos devuelven false (como NaN en XPath).
//   - selected() opera sobre el valor space-separated de un select_multiple.
// =============================================================================

import type { CompareOp, Expr } from "./ast";
import { parseExpression } from "./parse";

/** Valor de respuesta que entiende el simulador. */
export type SimAnswerValue = string | number | string[] | null | undefined;

/** Mapa nombre de variable → respuesta actual. */
export type SimAnswers = Record<string, SimAnswerValue>;

/** Resultado de evaluar la columna `relevant` de una fila. */
export type RelevanceResult = {
  /** Si la pregunta debe mostrarse con las respuestas actuales. */
  visible: boolean;
  /** True si la expresión usa funciones que el evaluador no soporta. */
  advanced: boolean;
};

export class UnsupportedExpressionError extends Error {
  constructor(reason: string) {
    super(`Expresión no soportada por el simulador: ${reason}`);
    this.name = "UnsupportedExpressionError";
  }
}

type EvalValue = string | number | boolean;

/** Clave de `answers` que representa «.» (la respuesta que se valida en un constraint). */
export const RESPUESTA_ACTUAL = ".";

// -----------------------------------------------------------------------------
// Núcleo: evaluar un Expr contra las respuestas
// -----------------------------------------------------------------------------

export function evaluateExpr(expr: Expr, answers: SimAnswers): EvalValue {
  switch (expr.kind) {
    case "ref":
      return normalizeAnswer(answers[expr.name]);
    case "current":
      // En una restricción «.» es la respuesta que se está validando (ver probarRestriccion.ts).
      if (RESPUESTA_ACTUAL in answers) return normalizeAnswer(answers[RESPUESTA_ACTUAL]);
      throw new UnsupportedExpressionError("referencia '.' (valor actual)");
    case "literal":
      return expr.value;
    case "compare":
      return compareValues(
        expr.op,
        evaluateExpr(expr.left, answers),
        evaluateExpr(expr.right, answers),
      );
    case "logical": {
      // Short-circuit: si un operando posterior es "avanzado" pero el
      // resultado ya está decidido, preferimos responder igual que ODK
      // antes que degradar toda la expresión.
      if (expr.op === "and") {
        for (const operand of expr.operands) {
          if (!toBoolean(evaluateExpr(operand, answers))) return false;
        }
        return true;
      }
      for (const operand of expr.operands) {
        if (toBoolean(evaluateExpr(operand, answers))) return true;
      }
      return false;
    }
    case "not":
      return !toBoolean(evaluateExpr(expr.operand, answers));
    case "call":
      return evaluateCall(expr.name, expr.args, answers);
    case "raw":
      throw new UnsupportedExpressionError("sintaxis no reconocida");
  }
}

/**
 * Evalúa la columna `relevant` de una fila contra las respuestas actuales.
 * Nunca lanza: si la expresión está vacía o usa funciones no soportadas,
 * la fila se considera visible (`advanced: true` marca el segundo caso).
 */
export function evaluateRelevance(
  expression: string | null | undefined,
  answers: SimAnswers,
): RelevanceResult {
  const expr = parseExpression(expression);
  if (!expr) return { visible: true, advanced: false };
  if (expr.kind === "raw") return { visible: true, advanced: true };
  try {
    return { visible: toBoolean(evaluateExpr(expr, answers)), advanced: false };
  } catch {
    return { visible: true, advanced: true };
  }
}

// -----------------------------------------------------------------------------
// Funciones ODK soportadas
// -----------------------------------------------------------------------------

function evaluateCall(name: string, args: Expr[], answers: SimAnswers): EvalValue {
  const fn = name.toLowerCase();

  if (fn === "selected") {
    if (args.length !== 2) {
      throw new UnsupportedExpressionError("selected() con aridad inesperada");
    }
    const haystack = String(evaluateExpr(args[0]!, answers)).trim();
    const needle = String(evaluateExpr(args[1]!, answers)).trim();
    if (!needle || !haystack) return false;
    return haystack.split(/\s+/).includes(needle);
  }

  if (fn === "count-selected") {
    if (args.length !== 1) {
      throw new UnsupportedExpressionError("count-selected() con aridad inesperada");
    }
    const value = String(evaluateExpr(args[0]!, answers)).trim();
    return value ? value.split(/\s+/).length : 0;
  }

  // Funciones que usan las restricciones reales del corpus (formularios tipo, 2026-10-16).
  const arg = (i: number) => evaluateExpr(args[i]!, answers);
  if (fn === "true" && args.length === 0) return true;
  if (fn === "false" && args.length === 0) return false;
  if (fn === "today" && args.length === 0) return new Date().toISOString().slice(0, 10);
  if (fn === "string-length" && args.length === 1) return String(arg(0)).length;
  if ((fn === "number" || fn === "decimal") && args.length === 1) return toNumberOrNull(arg(0)) ?? Number.NaN;
  if (fn === "int" && args.length === 1) {
    const n = toNumberOrNull(arg(0));
    return n == null ? Number.NaN : Math.trunc(n);
  }
  if (fn === "round" && args.length >= 1) {
    const n = toNumberOrNull(arg(0));
    const d = args.length > 1 ? toNumberOrNull(arg(1)) ?? 0 : 0;
    return n == null ? Number.NaN : Math.round(n * 10 ** d) / 10 ** d;
  }
  if (fn === "regex" && args.length === 2) {
    try {
      return new RegExp(String(arg(1))).test(String(arg(0)));
    } catch {
      throw new UnsupportedExpressionError("regex inválido");
    }
  }
  if (fn === "if" && args.length === 3) return toBoolean(arg(0)) ? arg(1) : arg(2);
  // Funciones de los cálculos reales (sonda de formularios tipo): se evalúan con su semántica ODK simple.
  if (fn === "once" && args.length === 1) return arg(0);
  if (fn === "now" && args.length === 0) return new Date().toISOString();
  if ((fn === "string" || fn === "normalize-space") && args.length === 1) return String(arg(0)).trim();
  if (fn === "concat") return args.map((_, i) => String(arg(i))).join("");
  if (fn === "coalesce" && args.length === 2) {
    const a = arg(0);
    return String(a) === "" ? arg(1) : a;
  }
  if (fn === "boolean" && args.length === 1) return toBoolean(arg(0));
  if (fn === "decimal-date-time" && args.length === 1) {
    const t = Date.parse(String(arg(0)));
    return Number.isNaN(t) ? Number.NaN : t / 86_400_000;
  }
  if ((fn === "format-date" || fn === "format-date-time") && args.length === 2) {
    const fecha = String(arg(0));
    const fmt = String(arg(1));
    if (!FECHA.test(fecha)) return "";
    return fmt
      .replace("%Y", fecha.slice(0, 4))
      .replace("%m", fecha.slice(5, 7))
      .replace("%n", String(Number(fecha.slice(5, 7))))
      .replace("%d", fecha.slice(8, 10))
      .replace("%e", String(Number(fecha.slice(8, 10))));
  }
  throw new UnsupportedExpressionError(`función ${name}()`);
}

// -----------------------------------------------------------------------------
// Coerciones (semántica XPath 1.0 simplificada)
// -----------------------------------------------------------------------------

/** Un select_multiple se representa space-separated, como en ODK. */
function normalizeAnswer(value: SimAnswerValue): EvalValue {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(" ");
  return value;
}

function toNumberOrNull(value: EvalValue): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value ? 1 : 0;
  const text = value.trim();
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function toBoolean(value: EvalValue): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  return value.length > 0;
}

const FECHA = /^\d{4}-\d{2}-\d{2}/;

function compareValues(op: CompareOp, left: EvalValue, right: EvalValue): boolean {
  // Dos fechas ISO se comparan como texto: el orden lexicográfico es el cronológico.
  if (typeof left === "string" && typeof right === "string" && FECHA.test(left) && FECHA.test(right)) {
    const c = left.slice(0, 10) < right.slice(0, 10) ? -1 : left.slice(0, 10) > right.slice(0, 10) ? 1 : 0;
    return op === "=" ? c === 0 : op === "!=" ? c !== 0 : op === "<" ? c < 0 : op === "<=" ? c <= 0 : op === ">" ? c > 0 : c >= 0;
  }
  const leftNum = toNumberOrNull(left);
  const rightNum = toNumberOrNull(right);
  switch (op) {
    case "=":
      return leftNum != null && rightNum != null
        ? leftNum === rightNum
        : String(left) === String(right);
    case "!=":
      return leftNum != null && rightNum != null
        ? leftNum !== rightNum
        : String(left) !== String(right);
    case "<":
      return leftNum != null && rightNum != null && leftNum < rightNum;
    case "<=":
      return leftNum != null && rightNum != null && leftNum <= rightNum;
    case ">":
      return leftNum != null && rightNum != null && leftNum > rightNum;
    case ">=":
      return leftNum != null && rightNum != null && leftNum >= rightNum;
  }
}
