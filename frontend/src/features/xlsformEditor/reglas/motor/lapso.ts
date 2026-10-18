// Lapsos entre fechas: una resta de fechas da DÍAS, no una fecha; dividida entre 365 (o 365.25) da AÑOS.
//   today() - ${nac}                      → los días transcurridos desde ‹Nacimiento›
//   int((today() - ${nac}) div 365.25)    → los años cumplidos desde ‹Nacimiento›
//   (today() - ${nac}) >= 365 * 18        → han pasado al menos 6,570 días (18 años) desde ‹Nacimiento›
// Se reconoce por la forma (resta de dos instantes), nunca por el nombre de la pregunta.

import type { CompareOp, Expr } from "../../logic";
import { claseDe, type Contexto } from "./contexto";
import { t, v, type Frase } from "./frase";
import { numeroDe } from "./valores";
import { leerValor } from "./valor";

type Resta = { desde: Expr; hasta: Expr };
export type Lapso = Resta & { unidad: "días" | "años"; entero: boolean };

const ENVOLTORIOS = ["number", "int", "decimal", "decimal-date-time", "date", "date-time"];
const desnudar = (e: Expr): Expr => (e.kind === "call" && e.args.length === 1 && ENVOLTORIOS.includes(e.name) ? desnudar(e.args[0]!) : e);
const esLlamada = (e: Expr | undefined, nombre: string): e is Extract<Expr, { kind: "call" }> => e?.kind === "call" && e.name === nombre;

/** ¿Es un instante? decimal-date-time(x) lo dice por sí mismo; si no, la clase de la pregunta o la función. */
export function esInstante(e: Expr, ctx: Contexto): boolean {
  if (esLlamada(e, "decimal-date-time")) return true;
  const c = claseDe(desnudar(e), ctx);
  return c === "fecha" || c === "hora";
}

/** a - b con a y b instantes (admite number()/decimal-date-time() alrededor). */
export function restaDeFechas(e: Expr, ctx: Contexto): Resta | null {
  const x = desnudar(e);
  if (!esLlamada(x, "-") || x.args.length !== 2) return null;
  const [a, b] = x.args as [Expr, Expr];
  return esInstante(a, ctx) && esInstante(b, ctx) ? { hasta: desnudar(a), desde: desnudar(b) } : null;
}

/** Valor de una expresión hecha solo de números: 365 * 18 → 6570. */
export function constante(e: Expr | undefined): number | null {
  if (!e) return null;
  const n = numeroDe(e);
  if (n !== null) return n;
  if (e.kind !== "call" || e.args.length !== 2) return null;
  const a = constante(e.args[0]);
  const b = constante(e.args[1]);
  if (a === null || b === null) return null;
  if (e.name === "*") return a * b;
  if (e.name === "+") return a + b;
  if (e.name === "-") return a - b;
  if (e.name === "div") return b ? a / b : null;
  return null;
}

const ANIO = new Set([365, 365.25]);

/** El lapso que mide la expresión, o null si no es una resta de fechas (en días o en años). */
export function lapsoDe(e: Expr, ctx: Contexto): Lapso | null {
  const entero = esLlamada(e, "int") && e.args.length === 1;
  const x = entero ? (e as Extract<Expr, { kind: "call" }>).args[0]! : e;
  if (esLlamada(x, "div") && x.args.length === 2 && ANIO.has(constante(x.args[1]) ?? NaN)) {
    const r = restaDeFechas(x.args[0]!, ctx);
    return r ? { ...r, unidad: "años", entero } : null;
  }
  const r = restaDeFechas(entero ? x : e, ctx);
  return r ? { ...r, unidad: "días", entero } : null;
}

const esHoy = (e: Expr) => esLlamada(e, "today") || esLlamada(e, "now");

/** «los años cumplidos desde ‹X›», «los días entre ‹X› y ‹Y›». */
export function leerLapso(l: Lapso, ctx: Contexto): Frase | null {
  const desde = leerValor(l.desde, ctx);
  if (!desde) return null;
  const hoy = esHoy(l.hasta);
  const nombre = l.unidad === "días" ? "los días" : l.entero ? (hoy ? "los años cumplidos" : "los años completos") : "los años";
  if (hoy) return [t(`${nombre}${l.unidad === "años" && l.entero ? "" : " transcurridos"} desde`), ...desde];
  const hasta = leerValor(l.hasta, ctx);
  return hasta ? [t(`${nombre} entre`), ...desde, t("y"), ...hasta] : null;
}

/** 6570 → «6,570», como el formateador es-PE de la app (miles con coma, decimales con punto). */
function cifra(n: number): string {
  const [ent, dec] = String(Math.abs(n)).split(".");
  return `${n < 0 ? "-" : ""}${ent!.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${dec ? `.${dec}` : ""}`;
}

const COTA: Partial<Record<CompareOp, string>> = { ">=": "al menos", ">": "más de", "<=": "como máximo", "<": "menos de", "=": "exactamente" };

/** lapso <op> constante → «han pasado al menos 6,570 días (18 años) desde ‹X›». null si no tiene esa forma. */
export function leerLapsoComparado(c: Extract<Expr, { kind: "compare" }>, ctx: Contexto): Frase | null {
  const l = lapsoDe(c.left, ctx);
  const n = constante(c.right);
  const cota = COTA[c.op];
  if (!l || n === null || !cota) return null;
  const anios = l.unidad === "días" ? [365, 365.25].map((d) => n / d).find((a) => a > 0 && Number.isInteger(a)) : undefined;
  const medida: Frase = [t(cota), v(`${cifra(n)} ${l.unidad === "días" ? (n === 1 ? "día" : "días") : n === 1 ? "año" : "años"}`), ...(anios ? [t(`(${cifra(anios)} ${anios === 1 ? "año" : "años"})`)] : [])];
  const desde = leerValor(l.desde, ctx);
  if (!desde) return null;
  if (esHoy(l.hasta)) return [t("han pasado"), ...medida, t("desde"), ...desde];
  const hasta = leerValor(l.hasta, ctx);
  return hasta ? [t("entre"), ...desde, t("y"), ...hasta, t("hay"), ...medida] : null;
}
