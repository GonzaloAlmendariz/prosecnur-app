// Lectura humana de las funciones XLSForm/ODK que más aparecen en los instrumentos reales
// (sonda sobre los seis formularios tipo, 2026-10-16): if, once, pulldata, count-selected, sum,
// string-length, coalesce, aritmética, indexed-repeat… Cada lectura dice qué hace la regla, no cómo
// está escrita. Lo que no se reconoce devuelve null y el llamador decide (fallback «técnica»).

import type { Expr, LogicScope } from "../logic";
import { stripMarkdown } from "../helpers/markdown";

type Describir = (expr: Expr) => string;

const MAX_ETIQUETA = 48;

/** Etiqueta corta de una variable para leer dentro de fórmulas: «Edad», no el enunciado completo. */
export function etiquetaCorta(name: string, scope: LogicScope): string {
  const v = scope.variables.find((c) => c.name === name);
  const t = stripMarkdown(v?.label || "").replace(/\s+/g, " ").trim();
  if (!t) return name;
  return t.length > MAX_ETIQUETA ? `${t.slice(0, MAX_ETIQUETA - 1).trimEnd()}…` : t;
}

function lista(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

function texto(e: Expr | undefined): string | null {
  return e && e.kind === "literal" && typeof e.value === "string" ? e.value : null;
}

/** Devuelve la lectura de una llamada a función, o null si no la conocemos. */
export function describeCall(expr: Expr, d: Describir, scope: LogicScope): string | null {
  if (expr.kind !== "call") return null;
  const a = expr.args;
  const sujeto = (e: Expr | undefined) => (!e ? "" : e.kind === "current" ? "la respuesta" : e.kind === "ref" ? etiquetaCorta(e.name, scope) : d(e));
  switch (expr.name) {
    case "if": {
      if (a.length !== 3) return null;
      const [c, si, no] = a;
      // Patrón de restricción condicional: if(cond, regla, true()) → «Si cond, regla».
      if (no.kind === "literal" && no.value === true) return `Si ${d(c)}, ${d(si)}`;
      const valor = (e: Expr) => (e.kind === "compare" || e.kind === "logical" || e.kind === "not" ? d(e) : `vale ${e.kind === "literal" && typeof e.value === "string" ? `«${e.value}»` : d(e)}`);
      return `Si ${d(c)}, ${valor(si)}; si no, ${valor(no)}`;
    }
    case "once":
      return a.length === 1 ? `${d(a[0])} (se guarda la primera vez y no cambia)` : null;
    case "number":
    case "decimal":
    case "string":
    case "boolean":
      return a.length === 1 ? d(a[0]) : null;
    case "int":
      return a.length === 1 ? `la parte entera de ${d(a[0])}` : null;
    case "round":
      return a.length >= 1 ? `${d(a[0])} redondeado${a[1] ? ` a ${d(a[1])} decimales` : ""}` : null;
    case "pulldata": {
      const archivo = texto(a[0]);
      const col = texto(a[1]);
      return a.length === 4 && archivo && col ? `el dato «${col}» de la tabla «${archivo}» que corresponde a ${sujeto(a[3])}` : null;
    }
    case "count-selected":
      return a.length === 1 ? (a[0].kind === "current" ? "cuántas opciones marcó" : `cuántas opciones marcó en ${sujeto(a[0])}`) : null;
    case "selected-at":
      return a.length === 2 ? `la opción número ${d(a[1])} marcada en ${sujeto(a[0])}` : null;
    case "sum":
      return a.length === 1 ? `la suma de ${sujeto(a[0])} en todas las filas` : null;
    case "count":
      return a.length === 1 ? `cuántas filas tiene ${sujeto(a[0])}` : null;
    case "max":
    case "min":
      return a.length === 1 ? `el ${expr.name === "max" ? "mayor" : "menor"} valor de ${sujeto(a[0])}` : null;
    case "string-length":
      return a.length === 1 ? `la cantidad de caracteres de ${sujeto(a[0])}` : null;
    case "coalesce":
      return a.length === 2 ? `${sujeto(a[0])} (o ${d(a[1])} si está vacía)` : null;
    case "concat":
      return a.length ? `${lista(a.map((x) => (texto(x) !== null ? `«${texto(x)}»` : sujeto(x))))} unidos` : null;
    case "join":
      return a.length === 2 ? `las respuestas de ${sujeto(a[1])} unidas en una sola línea` : null;
    case "position":
      return "el número de esta fila";
    case "selected":
      return null;
    case "today":
      return "hoy";
    case "now":
      return "ahora";
    case "uuid":
      return "un identificador único";
    case "random":
      return "un número al azar";
    case "decimal-date-time":
    case "date":
    case "date-time":
      return a.length === 1 ? sujeto(a[0]) : null;
    case "format-date":
    case "format-date-time": {
      const fmt = texto(a[1]);
      if (a.length !== 2 || !fmt) return null;
      if (fmt === "%Y") return `el año de ${sujeto(a[0])}`;
      if (fmt === "%m" || fmt === "%n") return `el mes de ${sujeto(a[0])}`;
      if (fmt === "%e" || fmt === "%d") return `el día de ${sujeto(a[0])}`;
      return `${sujeto(a[0])} con formato ${fmt}`;
    }
    case "regex": {
      const patron = texto(a[1]);
      return a.length === 2 && patron ? `${sujeto(a[0])} sigue el patrón ${patron}` : null;
    }
    case "jr:choice-name":
      return a.length === 2 ? `el texto de la opción elegida en ${d(a[0])}` : null;
    case "true":
      return "sí";
    case "false":
      return "no";
    default:
      return null;
  }
}

// La lectura de patrones regex vive en reglas/motor/regex.ts (analiza el patrón, no lo compara con textos fijos).

const OPERADORES: Record<string, string> = { "+": "más", "-": "menos", "*": "por", div: "entre", mod: "módulo" };

/**
 * Lectura de un texto que el parser no estructuró (aritmética, indexed-repeat, comillas tipográficas).
 * Devuelve null si queda algo que no sabemos nombrar.
 */
export function describeRaw(text: string, scope: LogicScope): string | null {
  const t = text.trim();
  if (/[“”‘’]/.test(t)) return "Usa comillas tipográficas (“ ” o ‘ ’): ODK no las acepta; hay que cambiarlas por comillas rectas";
  if (/^position\(\s*\.\.\s*\)$/.test(t)) return "el número de esta fila";
  const sa = t.match(/^selected-at\(\s*\$\{([^}]+)\}\s*,\s*position\(\s*\.\.\s*\)\s*-\s*1\s*\)$/);
  if (sa) return `la opción de ${etiquetaCorta(sa[1], scope)} que corresponde a esta fila`;
  const dur = t.match(/^int\(\s*\(\s*decimal-date-time\(\s*\$\{([^}]+)\}\s*\)\s*-\s*decimal-date-time\(\s*\$\{([^}]+)\}\s*\)\s*\)\s*\*\s*24\s*\*\s*60(\s*\*\s*60)?\s*\)$/);
  if (dur) return `los ${dur[3] ? "segundos" : "minutos"} que pasaron entre ${etiquetaCorta(dur[2], scope)} y ${etiquetaCorta(dur[1], scope)}`;
  const ir = t.match(/^indexed-repeat\(\s*\$\{([^}]+)\}\s*,\s*\$\{([^}]+)\}\s*,\s*(.+)\)$/);
  if (ir) {
    const fila = ir[3].trim() === "position(..)" ? "esta misma fila" : `la fila ${ir[3].trim()}`;
    return `${etiquetaCorta(ir[1], scope)} en ${fila} del grupo ${etiquetaCorta(ir[2], scope)}`;
  }
  // Suma pura de referencias: «la suma de A, B y C».
  const sumandos = t.split(/\s*\+\s*/);
  if (sumandos.length > 1 && sumandos.every((s) => /^\$\{[^}]+\}$/.test(s))) {
    return `la suma de ${lista(sumandos.map((s) => etiquetaCorta(s.slice(2, -1), scope)))}`;
  }
  // Aritmética general: referencias, números, paréntesis, operadores y coalesce/number/int.
  const tokens = t.match(/\$\{[^}]+\}|coalesce\(\s*\$\{[^}]+\}\s*,\s*[^)]+\)|(?:number|int)\(\s*\$\{[^}]+\}\s*\)|\d+(?:\.\d+)?|div|mod|[+\-*()]|\S+/g) ?? [];
  const partes: string[] = [];
  for (const tok of tokens) {
    if (/^\$\{[^}]+\}$/.test(tok)) partes.push(etiquetaCorta(tok.slice(2, -1), scope));
    else if (/^coalesce\(/.test(tok)) {
      const m = tok.match(/\$\{([^}]+)\}\s*,\s*([^)]+)\)/);
      if (!m) return null;
      partes.push(`${etiquetaCorta(m[1], scope)} (o ${m[2].trim()} si está vacía)`);
    } else if (/^(number|int)\(\s*\$\{[^}]+\}\s*\)$/.test(tok)) partes.push(etiquetaCorta(tok.match(/\$\{([^}]+)\}/)?.[1] ?? tok, scope));
    else if (/^\d/.test(tok)) partes.push(tok);
    else if (tok in OPERADORES) partes.push(OPERADORES[tok]);
    else if (tok === "(" || tok === ")") partes.push(tok);
    else return null;
  }
  return partes.length > 1 ? partes.join(" ").replace(/\( /g, "(").replace(/ \)/g, ")") : null;
}
