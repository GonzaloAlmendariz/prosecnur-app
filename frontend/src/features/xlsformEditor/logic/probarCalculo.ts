// Probar un cálculo (calculation) con respuestas de ejemplo, sin salir del editor (revamp E6, 2026-10-16).
// Lo que el parser estructura se evalúa con evaluateExpr; la aritmética que queda cruda («${a} + ${b} * 2»,
// coalesce, number, int) la resuelve un evaluador acotado de descenso recursivo, sin eval().

import { UnsupportedExpressionError, evaluateExpr, type SimAnswers } from "./evaluate";
import { parseExpression } from "./parse";

export type ResultadoCalculo = { estado: "ok"; valor: string } | { estado: "no-evaluable" };

function formatear(v: unknown): string {
  if (typeof v === "number") return Number.isFinite(v) ? String(Math.round(v * 1e6) / 1e6) : "sin valor";
  if (typeof v === "boolean") return v ? "verdadero" : "falso";
  return String(v ?? "");
}

const numero = (v: unknown): number => {
  if (typeof v === "number") return v;
  const t = String(v ?? "").trim();
  return t === "" ? Number.NaN : Number(t);
};

/** Evaluador aritmético acotado: ${x}, números, + - * div mod, paréntesis, coalesce(a, b), number(a), int(a). */
export function evaluarAritmetica(texto: string, respuestas: SimAnswers): number {
  const tokens = texto.match(/\$\{[^}]+\}|\d+(?:\.\d+)?|\bdiv\b|\bmod\b|coalesce|number|int|[+\-*(),]|\S/g) ?? [];
  let i = 0;
  const ver = () => tokens[i];
  const tomar = (esperado?: string) => {
    const t = tokens[i++];
    if (esperado && t !== esperado) throw new UnsupportedExpressionError(`se esperaba «${esperado}»`);
    return t;
  };
  const primario = (): number => {
    const t = tomar();
    if (t === undefined) throw new UnsupportedExpressionError("fórmula incompleta");
    if (t === "(") {
      const v = suma();
      tomar(")");
      return v;
    }
    if (t === "-") return -primario();
    if (/^\d/.test(t)) return Number(t);
    if (t.startsWith("${")) {
      const v = respuestas[t.slice(2, -1)];
      return numero(Array.isArray(v) ? v.length : v);
    }
    if (t === "coalesce") {
      tomar("(");
      const a = suma();
      tomar(",");
      const b = suma();
      tomar(")");
      return Number.isNaN(a) ? b : a;
    }
    if (t === "number" || t === "int") {
      tomar("(");
      const a = suma();
      tomar(")");
      return t === "int" ? Math.trunc(a) : a;
    }
    throw new UnsupportedExpressionError(`«${t}» no es aritmética simple`);
  };
  const producto = (): number => {
    let v = primario();
    for (;;) {
      const op = ver();
      if (op === "*") { tomar(); v *= primario(); }
      else if (op === "div") { tomar(); v /= primario(); }
      else if (op === "mod") { tomar(); v %= primario(); }
      else return v;
    }
  };
  const suma = (): number => {
    let v = producto();
    for (;;) {
      const op = ver();
      if (op === "+") { tomar(); v += producto(); }
      else if (op === "-") { tomar(); v -= producto(); }
      else return v;
    }
  };
  const v = suma();
  if (i < tokens.length) throw new UnsupportedExpressionError("sobran partes en la fórmula");
  return v;
}

export function evaluarCalculo(expresion: string, respuestas: SimAnswers): ResultadoCalculo {
  const raw = expresion.trim();
  if (!raw) return { estado: "ok", valor: "" };
  const ast = parseExpression(raw);
  try {
    if (ast && ast.kind !== "raw") return { estado: "ok", valor: formatear(evaluateExpr(ast, respuestas)) };
    return { estado: "ok", valor: formatear(evaluarAritmetica(raw, respuestas)) };
  } catch (e) {
    if (e instanceof UnsupportedExpressionError) return { estado: "no-evaluable" };
    throw e;
  }
}
