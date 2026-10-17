// Lectura de expresiones de VALOR (cálculos y sujetos de una comparación): referencias, literales, aritmética y
// funciones XLSForm. Cada lectura dice qué produce la expresión, no cómo está escrita. null = no se sabe leer.

import type { Expr } from "../../logic";
import { claseDe, pregunta, type Contexto } from "./contexto";
import { cantidad, enumerar, oraciones, t, v, type Frase } from "./frase";
import { literalLegible, numeroDe, textoDe } from "./valores";
import { esBooleana, leerCondicion } from "./condicion";

const PALABRA_OPERADOR: Record<string, string> = { "+": "más", "-": "menos", "*": "por", div: "entre", mod: "módulo" };
const ARITMETICA = new Set(Object.keys(PALABRA_OPERADOR));
const UNIDADES: Record<number, string> = { 1: "días", 24: "horas", 1440: "minutos", 86400: "segundos" };

const esLlamada = (e: Expr | undefined, nombre: string): e is Extract<Expr, { kind: "call" }> => e?.kind === "call" && e.name === nombre;
const esFila = (e: Expr | undefined) => esLlamada(e, "position");

/** Sumandos de una cadena de «+». */
function sumandos(e: Expr): Expr[] {
  return esLlamada(e, "+") ? e.args.flatMap(sumandos) : [e];
}

/** Factores de una cadena de «*». */
function factores(e: Expr): Expr[] {
  return esLlamada(e, "*") ? e.args.flatMap(factores) : [e];
}

/** Quita envoltorios que no cambian el sentido al leer: number(), int(), decimal-date-time()… */
function desnudar(e: Expr): Expr {
  if (e.kind === "call" && e.args.length === 1 && ["number", "int", "decimal", "string", "decimal-date-time", "date", "date-time"].includes(e.name)) return desnudar(e.args[0]!);
  return e;
}

/** (a - b) * 24 * 60 → «los minutos entre b y a», si a y b son fechas u horas. */
function duracion(e: Expr, ctx: Contexto): Frase | null {
  const fs = factores(desnudar(e)).map((f) => (esLlamada(f, "-") ? f : desnudar(f)));
  const resta = fs.find((f) => esLlamada(f, "-"));
  if (!resta || resta.kind !== "call") return null;
  const constantes = fs.filter((f) => f !== resta).map(numeroDe);
  if (constantes.some((c) => c === null)) return null;
  const unidad = UNIDADES[(constantes as number[]).reduce((a, b) => a * b, 1)];
  const [ra, rb] = resta.args;
  if (!unidad || !ra || !rb) return null;
  // decimal-date-time(x) ya dice que x es un instante; si no, la clase de la pregunta.
  const temporal = (x: Expr) => esLlamada(x, "decimal-date-time") || ["fecha", "hora"].includes(claseDe(desnudar(x), ctx));
  if (!temporal(ra) || !temporal(rb)) return null;
  const a = desnudar(ra);
  const b = desnudar(rb);
  const fa = leerValor(a, ctx);
  const fb = leerValor(b, ctx);
  return fa && fb ? [t(`los ${unidad} entre`), ...fb, t("y"), ...fa] : null;
}

/**
 * Valor de un operando dentro de una operación. Una operación anidada va entre paréntesis salvo que se lea igual sin
 * ellos: la misma operación asociativa (a + b + c) o el lado izquierdo de la misma operación (a - b - c).
 */
function operando(e: Expr, ctx: Contexto, padre: string, izquierda: boolean): Frase | null {
  const f = leerValor(e, ctx);
  if (!f) return null;
  if (e.kind !== "call" || !ARITMETICA.has(e.name) || f[0]?.tipo === "valor") return f;
  const igual = e.name === padre && (padre === "+" || padre === "*" || izquierda);
  return igual ? f : [t("("), ...f, t(")")];
}

function aritmetica(e: Extract<Expr, { kind: "call" }>, ctx: Contexto): Frase | null {
  const [a, b] = e.args;
  if (!a || !b) return null;
  // today() - 30 → «hace 30 días»
  if ((e.name === "-" || e.name === "+") && esLlamada(a, "today")) {
    const n = numeroDe(b);
    if (n !== null) return [v(`${e.name === "-" ? "hace" : "dentro de"} ${n} ${n === 1 ? "día" : "días"}`)];
  }
  if (e.name === "*") {
    const d = duracion(e, ctx);
    if (d) return d;
  }
  if (e.name === "+") {
    const partes = sumandos(e);
    if (partes.length > 1 && partes.every((p) => p.kind === "ref")) {
      const fs = partes.map((p) => leerValor(p, ctx));
      return fs.every(Boolean) ? [t("la suma de"), ...enumerar(fs as Frase[], "y")] : null;
    }
  }
  const fa = operando(a, ctx, e.name, true);
  const fb = operando(b, ctx, e.name, false);
  return fa && fb ? [...fa, t(PALABRA_OPERADOR[e.name]!), ...fb] : null;
}

/** if(c1, x, if(c2, y, z)) → «Si c1, vale x. Si c2, vale y. Si no, vale z». */
function condicional(e: Extract<Expr, { kind: "call" }>, ctx: Contexto): Frase | null {
  const casos: { cond: Expr; valor: Expr }[] = [];
  let resto: Expr = e;
  while (resto.kind === "call" && resto.name === "if" && resto.args.length === 3) {
    casos.push({ cond: resto.args[0]!, valor: resto.args[1]! });
    resto = resto.args[2]!;
  }
  const rama = (x: Expr): Frase | null => {
    if (esBooleana(x)) return leerCondicion(x, ctx);
    if (x.kind === "literal" && x.value === "") return [t("queda vacío")];
    const f = leerValor(x, ctx);
    return f ? [t("vale"), ...f] : null;
  };
  const frases: Frase[] = [];
  for (const c of casos) {
    const fc = leerCondicion(c.cond, ctx);
    const fv = rama(c.valor);
    if (!fc || !fv) return null;
    frases.push([t("si"), ...fc, t(","), ...fv]);
  }
  // if(c, x, true()) en una regla booleana: «Si c, x», sin rama «si no».
  if (!(resto.kind === "literal" && resto.value === true && esBooleana(casos[casos.length - 1]!.valor))) {
    const fr = rama(resto);
    if (!fr) return null;
    frases.push([t("si no,"), ...fr]);
  }
  return oraciones(frases);
}

function llamada(e: Extract<Expr, { kind: "call" }>, ctx: Contexto): Frase | null {
  const a = e.args;
  const L = (x: Expr | undefined) => (x ? leerValor(x, ctx) : null);
  const con = (antes: string, x: Expr | undefined, despues?: string): Frase | null => {
    const f = L(x);
    return f ? [t(antes), ...f, ...(despues ? [t(despues)] : [])] : null;
  };
  if (ARITMETICA.has(e.name)) return aritmetica(e, ctx);
  switch (e.name) {
    case "today":
      return [v("hoy")];
    case "now":
      return [v("ahora")];
    case "if":
      return a.length === 3 ? condicional(e, ctx) : null;
    case "once": {
      const f = a.length === 1 ? L(a[0]) : null;
      return f ? [...f, t("(se guarda la primera vez y no cambia)")] : null;
    }
    case "number":
    case "decimal":
    case "string":
    case "boolean":
    case "decimal-date-time":
    case "date":
    case "date-time":
      return a.length === 1 ? L(a[0]) : null;
    case "int": {
      if (a.length !== 1) return null;
      const x = a[0]!;
      const dur = duracion(x, ctx);
      if (dur) return dur;
      const factoresAzar = factores(x);
      if (factoresAzar.length === 2 && esLlamada(factoresAzar[0], "random")) return con("un número al azar menor que", factoresAzar[1]);
      if (x.kind === "call" && ["format-date", "number", "string", "position", "count", "count-selected", "string-length"].includes(x.name)) return L(x);
      if (x.kind === "ref") return L(x);
      return con("la parte entera de", x);
    }
    case "round": {
      const f0 = a.length >= 1 ? L(a[0]) : null;
      if (!f0) return null;
      // Una operación redondeada va entre paréntesis: «(a por 100) redondeado», no «a por 100 redondeado».
      const f = a[0]!.kind === "call" && ARITMETICA.has(a[0]!.name) ? [t("("), ...f0, t(")")] : f0;
      const n = numeroDe(a[1]);
      return a[1] ? (n !== null ? [...f, t("redondeado a"), cantidad(String(n), "decimal", "decimales")] : null) : [...f, t("redondeado")];
    }
    case "pulldata": {
      const tabla = textoDe(a[0]);
      const col = textoDe(a[1]);
      const clave = L(a[3]);
      return a.length === 4 && tabla && col && clave ? [t("el dato"), v(`«${col}»`), t("de la tabla"), v(`«${tabla}»`), t("que corresponde a"), ...clave] : null;
    }
    case "count-selected":
      if (a.length !== 1) return null;
      return a[0]!.kind === "current" ? [t("cuántas opciones marcó")] : con("cuántas opciones marcó en", a[0]);
    case "selected-at": {
      if (a.length !== 2) return null;
      const n = numeroDe(a[1]);
      if (n !== null) return con(`la opción ${n + 1}.ª marcada en`, a[0]);
      const i = a[1]!;
      if (esLlamada(i, "-") && esFila(i.args[0]) && numeroDe(i.args[1]) === 1) return con("la opción marcada en", a[0], "que corresponde a esta fila");
      const azar = esLlamada(i, "int") ? factores(i.args[0]!) : [];
      if (azar.length === 2 && esLlamada(azar[0], "random")) return con("una opción al azar entre las marcadas en", a[0]);
      const fi = L(i);
      const fx = L(a[0]);
      return fi && fx ? [t("la opción marcada en"), ...fx, t("en la posición"), ...fi] : null;
    }
    case "sum":
      return a.length === 1 ? con("la suma de", a[0], "en todas las filas") : null;
    case "count":
      return a.length === 1 ? con("cuántas filas tiene", a[0]) : null;
    case "max":
    case "min": {
      const palabra = e.name === "max" ? "mayor" : "menor";
      if (a.length === 1) return con(`el ${palabra} valor de`, a[0]);
      const fs = a.map(L);
      return fs.length > 1 && fs.every(Boolean) ? [t(`el ${palabra} entre`), ...enumerar(fs as Frase[], "y")] : null;
    }
    case "string-length":
      return a.length === 1 ? (a[0]!.kind === "current" ? [t("la cantidad de caracteres")] : con("la cantidad de caracteres de", a[0])) : null;
    case "coalesce": {
      const fa = L(a[0]);
      const fb = L(a[1]);
      return a.length === 2 && fa && fb ? [...fa, t("(o"), ...fb, t("si está vacía)")] : null;
    }
    case "concat": {
      const fs = a.map(L);
      return fs.length && fs.every(Boolean) ? [...enumerar(fs as Frase[], "y"), t("unidos")] : null;
    }
    case "join":
      return a.length === 2 ? con("las respuestas de", a[1], "unidas en una sola línea") : null;
    case "position":
      return a.length === 0 || esLlamada(a[0], "@padre") ? [t("el número de esta fila")] : null;
    case "uuid":
      return [t("un identificador único")];
    case "random":
      return [t("un número al azar")];
    case "format-date":
    case "format-date-time": {
      const fmt = textoDe(a[1]);
      if (a.length !== 2 || !fmt) return null;
      if (fmt === "%Y") return con("el año de", a[0]);
      if (fmt === "%m" || fmt === "%n") return con("el mes de", a[0]);
      if (fmt === "%e" || fmt === "%d") return con("el día de", a[0]);
      const f = L(a[0]);
      return f ? [...f, t("con formato"), v(fmt)] : null;
    }
    case "jr:choice-name": {
      const m = textoDe(a[1])?.match(/^\$\{([^}]+)\}$/);
      if (a.length !== 2 || !m) return null;
      const q = m[1]!.trim();
      if (a[0]!.kind === "ref" && a[0]!.name === q) return [t("el texto de la opción elegida en"), pregunta(q, ctx)];
      const f = L(a[0]);
      return f ? [t("el texto de"), ...f, t("en las opciones de"), pregunta(q, ctx)] : null;
    }
    case "indexed-repeat": {
      if (a.length !== 3) return null;
      const fx = L(a[0]);
      const fg = L(a[1]);
      const fila = esFila(a[2]) ? [t("esta misma fila")] : (() => {
        const f = L(a[2]);
        return f ? [t("la fila"), ...f] : null;
      })();
      return fx && fg && fila ? [...fx, t("en"), ...fila, t("del grupo"), ...fg] : null;
    }
    default:
      return null;
  }
}

export function leerValor(e: Expr, ctx: Contexto): Frase | null {
  switch (e.kind) {
    case "current":
      return [t("la respuesta")];
    case "ref":
      return [pregunta(e.name, ctx)];
    case "literal":
      return [v(literalLegible(e.value, true))];
    case "call":
      if (e.name === "selected" || e.name === "regex" || e.name === "true" || e.name === "false") return leerCondicion(e, ctx);
      return llamada(e, ctx);
    case "compare":
    case "logical":
    case "not":
      return leerCondicion(e, ctx);
    default:
      return null;
  }
}
