// Voz de CONDICIÓN (relevant, required, la condición de un if): afirma un estado de las respuestas.
//   ${edad} >= 18                       → ‹Edad› es 18 o más
//   ${p} = '1' or ${p} = '2'            → ‹P› es ‹Sí›, ‹A veces›   (misma pregunta: se agrupa)
//   ${p} != '1' and ${p} != '2'         → ‹P› no es ‹Sí› ni ‹No›
//   ${f} < today()                      → ‹F› es anterior a hoy     (vocabulario por tipo)
//   ${x} >= 5 and ${x} <= 17            → ‹X› está entre 5 y 17

import type { CompareOp, Expr } from "../../logic";
import { claseDe, listaDe, opcion, type Clase, type Contexto } from "./contexto";
import { enumerar, t, unir, v, type Frase } from "./frase";
import { leerLapsoComparado } from "./lapso";
import { negar } from "./normalizar";
import { leerPatron } from "./regex";
import { fechaLegible, literalLegible, numeroDe, textoDe } from "./valores";
import { leerValor } from "./valor";

export function esBooleana(e: Expr): boolean {
  if (e.kind === "compare" || e.kind === "logical" || e.kind === "not") return true;
  if (e.kind === "literal") return typeof e.value === "boolean";
  if (e.kind === "call") {
    if (e.name === "selected" || e.name === "regex") return true;
    if (e.name === "if" && e.args.length === 3) return esBooleana(e.args[1]!) && esBooleana(e.args[2]!);
  }
  return false;
}

/** Valor con el que se compara: opción de la lista del sujeto, fecha legible, pregunta o lectura de la expresión. */
export function valorComparado(e: Expr, sujeto: Expr, ctx: Contexto): Frase | null {
  if (e.kind === "literal") {
    const lista = listaDe(sujeto, ctx);
    const op = lista ? opcion(lista, String(e.value), ctx) : null;
    if (op) return [op];
    return [v(literalLegible(e.value))];
  }
  const multiplo = multiploDe(e, ctx);
  if (multiplo) return multiplo;
  if (e.kind === "call" && (e.name === "date" || e.name === "date-time") && e.args.length === 1) {
    const f = fechaLegible(textoDe(e.args[0]) ?? "");
    if (f) return [v(f)];
  }
  return leerValor(e, ctx);
}

const VECES: Record<number, string> = { 2: "el doble de", 3: "el triple de" };

/** Cota proporcional a otra pregunta: ${x} * 2 → «el doble de ‹X›»; ${x} * 1.5 → «‹X› × 1.5». */
function multiploDe(e: Expr, ctx: Contexto): Frase | null {
  if (e.kind !== "call" || e.name !== "*" || e.args.length !== 2) return null;
  const [a, b] = e.args as [Expr, Expr];
  const ref = a.kind === "ref" ? a : b.kind === "ref" ? b : null;
  const n = numeroDe(ref === a ? b : a);
  if (!ref || n === null) return null;
  const f = leerValor(ref, ctx);
  if (!f) return null;
  return VECES[n] ? [t(VECES[n]!), ...f] : [...f, t("×"), v(String(n))];
}

export function claseComparacion(c: Extract<Expr, { kind: "compare" }>, ctx: Contexto): Clase {
  const a = claseDe(c.left, ctx);
  const b = claseDe(c.right, ctx);
  return a === "fecha" || b === "fecha" ? "fecha" : a !== "otra" ? a : b;
}

/** Predicado (lo que va después del sujeto) en voz de condición. */
function predicado(op: CompareOp, valor: Frase, clase: Clase): Frase {
  if (clase === "fecha" || clase === "hora") {
    const p: Record<CompareOp, string> = { "=": "es", "!=": "no es", "<": "es anterior a", "<=": "no es posterior a", ">": "es posterior a", ">=": "no es anterior a" };
    return [t(p[op]), ...valor];
  }
  switch (op) {
    case "=":
      return [t("es"), ...valor];
    case "!=":
      return [t("no es"), ...valor];
    case "<":
      return [t("es menor que"), ...valor];
    case ">":
      return [t("es mayor que"), ...valor];
    case "<=":
      return [t("es"), ...valor, t("o menos")];
    case ">=":
      return [t("es"), ...valor, t("o más")];
  }
}

type Atomo = {
  /** Clave del sujeto para agrupar (dos átomos sobre la misma pregunta). */
  clave: string;
  sujeto: Frase;
  /** eq/neq/inc/ninc agrupan sus valores; cmp lleva su predicado completo. */
  modo: "eq" | "neq" | "inc" | "ninc" | "cmp";
  valor: Frase;
  pred: Frase;
  op?: CompareOp;
  clase?: Clase;
};

function atomo(e: Expr, ctx: Contexto): Atomo | null {
  if (e.kind === "compare") {
    const lapso = leerLapsoComparado(e, ctx);
    if (lapso) return { clave: `lapso:${JSON.stringify(e)}`, sujeto: [], modo: "cmp", valor: [], pred: lapso };
    const sujeto = leerValor(e.left, ctx);
    if (!sujeto) return null;
    const clave = JSON.stringify(e.left);
    if (e.right.kind === "literal" && e.right.value === "" && (e.op === "=" || e.op === "!=")) {
      const pred = [t(e.op === "=" ? "está vacía" : "tiene respuesta")];
      return { clave, sujeto, modo: "cmp", valor: [], pred };
    }
    const valor = valorComparado(e.right, e.left, ctx);
    if (!valor) return null;
    const clase = claseComparacion(e, ctx);
    // Contra otra pregunta: «es igual a ‹X›», para no confundir la pregunta con un valor.
    if (e.right.kind === "ref" && (e.op === "=" || e.op === "!=")) {
      return { clave, sujeto, modo: "cmp", valor, pred: [t(e.op === "=" ? "es igual a" : "no es igual a"), ...valor], op: e.op, clase };
    }
    const modo = e.op === "=" ? "eq" : e.op === "!=" ? "neq" : "cmp";
    return { clave, sujeto, modo, valor, pred: predicado(e.op, valor, clase), op: e.op, clase };
  }
  const neg = e.kind === "not";
  const sel = neg ? e.operand : e;
  if (sel.kind === "call" && sel.name === "selected" && sel.args.length === 2) {
    const [x, val] = sel.args as [Expr, Expr];
    const sujeto = leerValor(x, ctx);
    const valor = val.kind === "ref" ? [t("la respuesta de"), ...(leerValor(val, ctx) ?? [])] : valorComparado(val, x, ctx);
    if (!sujeto || !valor) return null;
    return { clave: JSON.stringify(x), sujeto, modo: neg ? "ninc" : "inc", valor, pred: [t(neg ? "no incluye" : "incluye"), ...valor] };
  }
  return null;
}

const COTA_BAJA = new Set<CompareOp>([">", ">="]);
const COTA_ALTA = new Set<CompareOp>(["<", "<="]);

/** Un grupo de átomos sobre el mismo sujeto, en una sola frase. */
function frasearGrupo(grupo: Atomo[], op: "and" | "or"): Frase {
  const [a] = grupo as [Atomo];
  if (grupo.length === 1) return [...a.sujeto, ...a.pred];
  const modos = new Set(grupo.map((g) => g.modo));
  // Sin repetir: «no es ‹No› ni ‹No›» sale de una regla con la misma cláusula dos veces.
  const valores = grupo.map((g) => g.valor).filter((x, i, arr) => arr.findIndex((y) => JSON.stringify(y) === JSON.stringify(x)) === i);
  if (modos.size === 1 && valores.length === 1 && a.modo !== "cmp") return [...a.sujeto, ...a.pred];
  if (modos.size === 1) {
    if (a.modo === "eq" && op === "or") return [...a.sujeto, t("es"), ...enumerar(valores, "o")];
    if (a.modo === "neq" && op === "and") return [...a.sujeto, t("no es"), ...enumerar(valores, "ni")];
    if (a.modo === "inc") return [...a.sujeto, t("incluye"), ...enumerar(valores, op === "or" ? "o" : "y")];
    if (a.modo === "ninc" && op === "and") return [...a.sujeto, t("no incluye"), ...enumerar(valores, "ni")];
  }
  if (op === "and" && grupo.length === 2) {
    const baja = grupo.find((g) => g.op && COTA_BAJA.has(g.op));
    const alta = grupo.find((g) => g.op && COTA_ALTA.has(g.op));
    if (baja && alta) {
      const fecha = baja.clase === "fecha" || baja.clase === "hora";
      if (baja.op === ">=" && alta.op === "<=") return [...a.sujeto, t("está entre"), ...baja.valor, t("y"), ...alta.valor];
      const pb = fecha ? (baja.op === ">" ? "es posterior a" : "no es anterior a") : baja.op === ">" ? "es mayor que" : "es al menos";
      const pa = fecha ? (alta.op === "<" ? "anterior a" : "no posterior a") : alta.op === "<" ? "menor que" : "como máximo";
      return [...a.sujeto, t(pb), ...baja.valor, t("y"), t(pa), ...alta.valor];
    }
  }
  return [...a.sujeto, ...unir(grupo.map((g) => g.pred), op === "and" ? "y" : "o")];
}

/** Lectura de un and/or: agrupa los átomos consecutivos sobre el mismo sujeto. `partes` = cuántas cláusulas quedan. */
function leerLogico(e: Extract<Expr, { kind: "logical" }>, ctx: Contexto): { frase: Frase; partes: number } | null {
  const partes: Frase[] = [];
  let grupo: Atomo[] = [];
  let agrupadas = false;
  const cerrar = () => {
    if (grupo.length) partes.push(frasearGrupo(grupo, e.op));
    if (grupo.length > 1) agrupadas = true;
    grupo = [];
  };
  for (const o of e.operands) {
    const at = atomo(o, ctx);
    if (at) {
      if (grupo.length && grupo[0]!.clave !== at.clave) cerrar();
      grupo.push(at);
      continue;
    }
    cerrar();
    const f = leerCondicionInterna(o, ctx);
    if (!f) return null;
    partes.push(f.partes > 1 ? [t("("), ...f.frase, t(")")] : f.frase);
  }
  cerrar();
  // Si una parte ya enumera valores con «o»/«y», las partes se separan con coma para no mezclarlas.
  const conector = e.op === "and" ? "y" : "o";
  return { frase: unir(partes, agrupadas && partes.length > 1 ? `, ${conector}` : conector), partes: partes.length };
}

function leerCondicionInterna(e: Expr, ctx: Contexto): { frase: Frase; partes: number } | null {
  if (e.kind === "logical") return leerLogico(e, ctx);
  const f = leerCondicion(e, ctx);
  return f ? { frase: f, partes: 1 } : null;
}

export function leerCondicion(e: Expr, ctx: Contexto): Frase | null {
  switch (e.kind) {
    case "logical":
      return leerLogico(e, ctx)?.frase ?? null;
    case "compare":
    case "not": {
      const at = atomo(e, ctx);
      if (at) return [...at.sujeto, ...at.pred];
      if (e.kind === "compare") return null;
      const n = negar(e.operand);
      if (n && n.kind !== "not") return leerCondicion(n, ctx);
      const f = leerCondicion(e.operand, ctx);
      return f ? [t("no se cumple que"), ...f] : null;
    }
    case "literal":
      return typeof e.value === "boolean" ? [t(e.value ? "siempre" : "nunca")] : null;
    case "call": {
      if (e.name === "selected") {
        const at = atomo(e, ctx);
        return at ? [...at.sujeto, ...at.pred] : null;
      }
      if (e.name === "regex" && e.args.length === 2) {
        const sujeto = leerValor(e.args[0]!, ctx);
        const patron = leerPatron(textoDe(e.args[1]) ?? "");
        if (!sujeto || !patron) return null;
        const sin = patron[0]?.tipo === "texto" && patron[0].texto === "sin";
        return sin ? [...sujeto, t("no tiene"), ...patron.slice(1)] : [...sujeto, t("tiene la forma de"), ...patron];
      }
      if (e.name === "if") return leerValor(e, ctx);
      // number(${x}) usado como condición no es una condición legible.
      return null;
    }
    default:
      return null;
  }
}
