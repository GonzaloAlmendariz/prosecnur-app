// Contexto de lectura: qué columna se lee, de qué pregunta («.»), con qué variables y listas. Y la clase semántica
// de cada operando (fecha, número, texto, una, varias), que decide el vocabulario de la frase.

import type { Expr, LogicScope } from "../../logic";
import { stripMarkdown } from "../../helpers/markdown";
import type { ColumnaRegla, Pieza } from "../piezas";
import { normalizarMayusculas } from "./etiquetas";

export type Clase = "fecha" | "hora" | "numero" | "texto" | "una" | "varias" | "otra";

export type Contexto = {
  columna: ColumnaRegla;
  scope: LogicScope;
  /** La pregunta dueña de la regla (la que representa «.»). */
  actual: { name: string; base: string; lista: string } | null;
};

export function claseDeTipo(base: string | undefined): Clase {
  const b = (base ?? "").toLowerCase();
  if (b === "date" || b === "datetime" || b === "start" || b === "end" || b === "today") return "fecha";
  if (b === "time") return "hora";
  if (b === "integer" || b === "decimal" || b === "range") return "numero";
  if (b === "text" || b === "barcode") return "texto";
  if (b.startsWith("select_one") || b === "rank") return "una";
  if (b.startsWith("select_multiple")) return "varias";
  return "otra";
}

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function variable(name: string, ctx: Contexto) {
  return ctx.scope.variables.find((x) => x.name === name);
}

export function grupo(name: string, ctx: Contexto) {
  return ctx.scope.grupos?.find((g) => g.name === name);
}

const limpia = (s: string | undefined) => stripMarkdown(s ?? "").replace(/\s+/g, " ").trim();

// Un cálculo sin etiqueta que sólo copia otra respuesta (`${x}` o `indexed-repeat(${x}, …)`) se nombra como ella:
// HH01 = indexed-repeat(${HH01_2_aux}, …) es «Nombre del miembro del hogar» en esta fila.
const COPIA = /^\s*(?:indexed-repeat\s*\(\s*)?\$\{([^}]+)\}\s*(?:,|$)/;

function etiquetaCruda(name: string, ctx: Contexto, profundidad = 0): string {
  const v = variable(name, ctx);
  if (v) {
    const propia = limpia(v.label);
    if (propia && propia !== name) return propia;
    const otra = v.calculation?.match(COPIA)?.[1]?.trim();
    // Sólo se sigue la copia hasta otra VARIABLE: un grupo con el mismo nombre no es la misma cosa.
    if (otra && otra !== name && profundidad < 3 && variable(otra, ctx)) {
      const heredada = etiquetaCruda(otra, ctx, profundidad + 1);
      if (heredada !== otra) return heredada;
    }
    return propia || name;
  }
  return name;
}

/**
 * Pieza de un GRUPO o repetición en una posición que pide uno (`indexed-repeat(x, ${grupo}, …)`, `count(${grupo})`),
 * citado por su etiqueta. En cualquier otra posición `${grupo}` no tiene valor y se deja como código: decir
 * «‹Sobre hostigamiento sexual› es 1» sería afirmar algo que la regla no dice.
 */
export function piezaGrupo(name: string, ctx: Contexto): Pieza {
  const g = variable(name, ctx) ? undefined : grupo(name, ctx);
  return { tipo: "pregunta", name, etiqueta: g?.label ? normalizarMayusculas(limpia(g.label)) : etiquetaDe(name, ctx) };
}

/** Etiqueta con que se nombra una pregunta o grupo en la frase: limpia, en tipo oración, o el código si no hay. */
export function etiquetaDe(name: string, ctx: Contexto): string {
  return normalizarMayusculas(etiquetaCruda(name, ctx));
}

export function pregunta(name: string, ctx: Contexto): Pieza {
  return { tipo: "pregunta", name, etiqueta: etiquetaDe(name, ctx) };
}

/** Clase semántica de un operando. */
export function claseDe(e: Expr, ctx: Contexto): Clase {
  switch (e.kind) {
    case "current":
      return claseDeTipo(ctx.actual?.base);
    case "ref":
      return claseDeTipo(e.name === ctx.actual?.name ? ctx.actual.base : variable(e.name, ctx)?.baseType);
    case "literal":
      if (typeof e.value === "number") return "numero";
      return typeof e.value === "string" && FECHA_ISO.test(e.value) ? "fecha" : "otra";
    case "call": {
      const n = e.name;
      if (n === "today" || n === "now" || n === "date" || n === "date-time") return "fecha";
      if (n === "string-length" || n === "count-selected" || n === "count" || n === "sum" || n === "int" || n === "round" || n === "position") return "numero";
      if ((n === "+" || n === "-") && e.args[0] && claseDe(e.args[0], ctx) === "fecha") return "fecha";
      if (n === "number" || n === "string" || n === "decimal" || n === "once" || n === "coalesce") return e.args[0] ? claseDe(e.args[0], ctx) : "otra";
      return "otra";
    }
    default:
      return "otra";
  }
}

/** Lista de opciones de un operando que es una pregunta de selección (o la propia respuesta). */
export function listaDe(e: Expr, ctx: Contexto): string | undefined {
  if (e.kind === "current") return ctx.actual?.lista || undefined;
  if (e.kind === "ref") return (e.name === ctx.actual?.name ? ctx.actual.lista : variable(e.name, ctx)?.listName) || undefined;
  return undefined;
}

export function opcion(lista: string, valor: string, ctx: Contexto): Pieza | null {
  const item = ctx.scope.catalogsByListName.get(lista)?.items.find((c) => c.name === valor);
  if (!item) return null;
  return { tipo: "opcion", lista, valor, etiqueta: normalizarMayusculas(limpia(item.label)) || valor };
}

/** ¿La expresión toca la respuesta actual? */
export function tocaActual(e: Expr): boolean {
  switch (e.kind) {
    case "current":
      return true;
    case "compare":
      return tocaActual(e.left) || tocaActual(e.right);
    case "logical":
      return e.operands.some(tocaActual);
    case "not":
      return tocaActual(e.operand);
    case "call":
      return e.args.some(tocaActual);
    default:
      return false;
  }
}
