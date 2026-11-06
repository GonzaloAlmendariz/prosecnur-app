// Voz de un SORTEO de nivel (E13 editor-conjoint, 2026-11-06). Un conjoint elige el nivel de cada atributo a partir
// de un número al azar guardado con once(random()), y la lectura genérica lo decía tramo por tramo («Si la parte
// entera de r por 5 es 0, vale «ninguno». Si…»). Aquí se reconocen las dos formas y se dicen de una vez:
//   if(int(${r} * 3) = 0, 'a', if(int(${r} * 3) = 1, 'b', 'c'))  → Sortea con la misma probabilidad entre «a», «b» o «c» (con ‹r›)
//   if(${r} < 0.2, 'a', if(${r} < 0.5, 'b', 'c'))                  → Sortea entre «a» (20 %), «b» (30 %) o «c» (50 %) (con ‹r›)
// Un `if(... = 'ninguno', 'NA', <sorteo>)` delante (atributo condicional) se dice como «salvo que…».

import type { Expr } from "../../logic";
import { pregunta, type Contexto } from "./contexto";
import { enumerar, t, v, type Frase } from "./frase";
import { leerCondicion } from "./condicion";
import { literalLegible } from "./valores";

const esLlamada = (e: Expr | undefined, nombre: string): e is Extract<Expr, { kind: "call" }> =>
  e?.kind === "call" && e.name.toLowerCase() === nombre;
const literal = (e: Expr | undefined): string | number | null =>
  e?.kind === "literal" && (typeof e.value === "string" || typeof e.value === "number") ? e.value : null;

type Tramo = { valor: string; corte: number };

/** `int(${r} * k) = i` → { r, k, i } */
function tramoIgual(cond: Expr): { ref: string; k: number; i: number } | null {
  if (cond.kind !== "compare" || cond.op !== "=") return null;
  const entero = cond.left;
  const i = literal(cond.right);
  if (!esLlamada(entero, "int") || typeof i !== "number") return null;
  const mult = entero.args[0];
  if (!esLlamada(mult, "*") || mult.args[0]?.kind !== "ref") return null;
  const k = literal(mult.args[1]);
  return typeof k === "number" ? { ref: mult.args[0].name, k, i } : null;
}

/** `${r} < c` → { r, c } */
function tramoMenor(cond: Expr): { ref: string; c: number } | null {
  if (cond.kind !== "compare" || cond.op !== "<" || cond.left.kind !== "ref") return null;
  const c = literal(cond.right);
  return typeof c === "number" ? { ref: cond.left.name, c } : null;
}

function cadena(e: Expr): { tramos: Tramo[]; ref: string; forma: "igual" | "pesos" } | null {
  const tramos: Tramo[] = [];
  let ref: string | null = null;
  let forma: "igual" | "pesos" | null = null;
  let k = 0;
  let actual: Expr = e;
  while (esLlamada(actual, "if") && actual.args.length === 3) {
    const [cond, si, no] = actual.args as [Expr, Expr, Expr];
    const valor = literal(si);
    if (valor === null) return null;
    const igual = tramoIgual(cond);
    const menor = igual ? null : tramoMenor(cond);
    if (igual && (forma ?? "igual") === "igual" && (ref ?? igual.ref) === igual.ref && igual.i === tramos.length) {
      forma = "igual"; ref = igual.ref; k = igual.k;
      tramos.push({ valor: String(valor), corte: 0 });
    } else if (menor && (forma ?? "pesos") === "pesos" && (ref ?? menor.ref) === menor.ref) {
      forma = "pesos"; ref = menor.ref;
      tramos.push({ valor: String(valor), corte: menor.c });
    } else {
      return null;
    }
    actual = no;
  }
  const ultimo = literal(actual);
  if (ultimo === null || !ref || !forma || tramos.length < 1) return null;
  tramos.push({ valor: String(ultimo), corte: 1 });
  if (forma === "igual" && tramos.length !== k) return null;
  // Con umbrales es un sorteo sólo si los cortes caen entre 0 y 1 y crecen (`${edad} < 30` no lo es).
  if (forma === "pesos") {
    const cortes = tramos.slice(0, -1).map((tr) => tr.corte);
    if (cortes.some((c, i) => c <= 0 || c >= 1 || (i > 0 && c <= cortes[i - 1]!))) return null;
  }
  return { tramos, ref, forma };
}

const porcentaje = (p: number) => `${Math.round(p * 1000) / 10} %`.replace(".", ",");

function frasear(c: NonNullable<ReturnType<typeof cadena>>, ctx: Contexto): Frase {
  const valores = c.tramos.map((tr, i) => {
    const base = [v(literalLegible(tr.valor, true))];
    if (c.forma === "igual") return base;
    const previo = i === 0 ? 0 : c.tramos[i - 1]!.corte;
    return [...base, t(`(${porcentaje(tr.corte - previo)})`)];
  });
  return [
    t(c.forma === "igual" ? "sortea con la misma probabilidad entre" : "sortea entre"),
    ...enumerar(valores, "o"),
    t("con el número al azar de"),
    pregunta(c.ref, ctx),
  ];
}

/** Lectura de un cálculo que sortea un nivel, o null si no tiene esa forma. */
export function leerSorteo(e: Expr, ctx: Contexto): Frase | null {
  const directo = cadena(e);
  if (directo) return frasear(directo, ctx);
  // Condicional delante: `if(<cond>, 'NA', <sorteo>)`.
  if (esLlamada(e, "if") && e.args.length === 3) {
    const [cond, si, no] = e.args as [Expr, Expr, Expr];
    const fijo = literal(si);
    const sorteo = cadena(no);
    const cuando = sorteo && fijo !== null ? leerCondicion(cond, ctx) : null;
    if (sorteo && cuando) return [...frasear(sorteo, ctx), t("; vale"), v(literalLegible(String(fijo), true)), t("cuando"), ...cuando];
  }
  return null;
}
