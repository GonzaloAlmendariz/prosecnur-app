// Normalización antes de leer (M2): la misma regla escrita de dos formas se lee igual.
//   today() >= .        ≡  . <= today()        (lo que se evalúa va a la izquierda)
//   ${esta_pregunta}    ≡  .                   (en una restricción, la propia pregunta es la respuesta)
//   (a and b) and c     ≡  a and b and c
//   not(x = 1)          ≡  x != 1              (la negación entra a la comparación)
// Nada de esto cambia la expresión guardada: sólo el árbol que se lee.

import type { CompareOp, Expr } from "../../logic";
import { parseExpressionLectura } from "../../logic";
import type { Contexto } from "./contexto";

const COMILLAS_TIPOGRAFICAS = /[“”‘’]/;

/** Texto listo para parsear: comillas tipográficas cambiadas por rectas (se avisa aparte). */
export function prepararTexto(raw: string): { texto: string; comillas: boolean } {
  const comillas = COMILLAS_TIPOGRAFICAS.test(raw);
  const texto = raw.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();
  return { texto, comillas };
}

export function parsear(raw: string): Expr | null {
  return parseExpressionLectura(raw);
}

const VOLTEO: Record<CompareOp, CompareOp> = { "=": "=", "!=": "!=", "<": ">", "<=": ">=", ">": "<", ">=": "<=" };
const OPUESTO: Record<CompareOp, CompareOp> = { "=": "!=", "!=": "=", "<": ">=", "<=": ">", ">": "<=", ">=": "<" };

/** Cuánto «es sujeto» un operando: lo menor va a la izquierda. */
function rango(e: Expr): number {
  if (e.kind === "current") return 0;
  if (e.kind === "ref") return 1;
  if (e.kind === "literal") return 4;
  if (e.kind === "call" && (e.name === "today" || e.name === "now" || e.name === "date" || e.name === "date-time")) return 3;
  if (e.kind === "call" && (e.name === "+" || e.name === "-") && e.args[0]?.kind === "call" && e.args[0].name === "today") return 3;
  if (e.kind === "call" && contieneSujeto(e)) return 2;
  return 3;
}

function contieneSujeto(e: Expr): boolean {
  if (e.kind === "current" || e.kind === "ref") return true;
  if (e.kind === "call") return e.args.some(contieneSujeto);
  return false;
}

export function normalizar(e: Expr, ctx: Contexto): Expr {
  switch (e.kind) {
    case "ref":
      return ctx.columna === "constraint" && ctx.actual && e.name === ctx.actual.name ? { kind: "current" } : e;
    case "compare": {
      const left = normalizar(e.left, ctx);
      const right = normalizar(e.right, ctx);
      return rango(left) > rango(right) ? { kind: "compare", op: VOLTEO[e.op], left: right, right: left } : { kind: "compare", op: e.op, left, right };
    }
    case "logical": {
      const operands = e.operands.flatMap((o) => {
        const n = normalizar(o, ctx);
        return n.kind === "logical" && n.op === e.op ? n.operands : [n];
      });
      return operands.length === 1 ? operands[0]! : { kind: "logical", op: e.op, operands };
    }
    case "not": {
      const inner = normalizar(e.operand, ctx);
      if (inner.kind === "not") return inner.operand;
      if (inner.kind === "compare") return { kind: "compare", op: OPUESTO[inner.op], left: inner.left, right: inner.right };
      return { kind: "not", operand: inner };
    }
    case "call":
      return { kind: "call", name: e.name, args: e.args.map((a) => normalizar(a, ctx)) };
    default:
      return e;
  }
}

/**
 * Negación de una expresión sin `not` (De Morgan hasta las hojas). null si alguna hoja no se deja negar
 * (una llamada distinta de selected): entonces se lee «no se cumple que …».
 */
export function negar(e: Expr): Expr | null {
  switch (e.kind) {
    case "compare":
      return { kind: "compare", op: OPUESTO[e.op], left: e.left, right: e.right };
    case "not":
      return e.operand;
    case "call":
      return e.name === "selected" ? { kind: "not", operand: e } : null;
    case "logical": {
      const operands = e.operands.map(negar);
      if (operands.some((o) => !o)) return null;
      return { kind: "logical", op: e.op === "and" ? "or" : "and", operands: operands as Expr[] };
    }
    default:
      return null;
  }
}

/** Referencias ${…} en orden de aparición, sin repetir (las columnas sueltas de un filtro no cuentan). */
export function referencias(e: Expr | null, raw: string): string[] {
  const out: string[] = [];
  const add = (n: string) => {
    if (!out.includes(n)) out.push(n);
  };
  const visitar = (x: Expr) => {
    if (x.kind === "ref") add(x.name);
    else if (x.kind === "compare") {
      visitar(x.left);
      visitar(x.right);
    } else if (x.kind === "logical") x.operands.forEach(visitar);
    else if (x.kind === "not") visitar(x.operand);
    else if (x.kind === "call") {
      x.args.forEach(visitar);
      // jr:choice-name(x, '${pregunta}') nombra la pregunta dentro de un literal.
      if (x.name === "jr:choice-name") {
        const lit = x.args[1];
        const m = lit?.kind === "literal" && typeof lit.value === "string" ? lit.value.match(/^\$\{([^}]+)\}$/) : null;
        if (m) add(m[1]!.trim());
      }
    }
  };
  if (e && e.kind !== "raw") visitar(e);
  else for (const m of raw.matchAll(/\$\{([^}]+)\}/g)) add(m[1]!.trim());
  return out;
}
