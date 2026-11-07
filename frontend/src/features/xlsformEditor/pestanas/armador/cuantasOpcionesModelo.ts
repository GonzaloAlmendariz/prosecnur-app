// Cuántas opciones puede marcar en una selección múltiple, con número propio (checklist editor-conjoint, E19 paso 2,
// 2026-11-06). El editor ya leía `count-selected(.) <= 3` como «Máximo 3 opciones», pero sólo dejaba crear el 3 fijo del
// atajo. Aquí se lee y se escribe el límite —al menos N, máximo N, entre N y M, exactamente N— conservando lo demás que la
// restricción exija (por ejemplo, las opciones que van solas).

import type { Expr } from "../../logic";
import { parseExpression, serializeExpression } from "../../logic";

export type ModoCuantas = "libre" | "alMenos" | "maximo" | "entre" | "exactamente";

export type LimiteCuantas = { modo: ModoCuantas; min: number | null; max: number | null };

export const MODOS_CUANTAS: { modo: ModoCuantas; nombre: string }[] = [
  { modo: "libre", nombre: "Sin límite" },
  { modo: "alMenos", nombre: "Al menos" },
  { modo: "maximo", nombre: "Máximo" },
  { modo: "entre", nombre: "Entre" },
  { modo: "exactamente", nombre: "Exactamente" },
];

const LIBRE: LimiteCuantas = { modo: "libre", min: null, max: null };

/** `count-selected(.) <op> N` → la cota que impone, o null si la parte no es eso. */
function cotaDe(e: Expr): { min?: number; max?: number } | null {
  if (e.kind !== "compare" || e.right.kind !== "literal") return null;
  if (e.left.kind !== "call" || e.left.name !== "count-selected" || e.left.args[0]?.kind !== "current") return null;
  const n = Number(e.right.value);
  if (!Number.isInteger(n)) return null;
  switch (e.op) {
    case ">=": return { min: n };
    case ">": return { min: n + 1 };
    case "<=": return { max: n };
    case "<": return { max: n - 1 };
    case "=": return { min: n, max: n };
    default: return null;
  }
}

function modoDe(min: number | null, max: number | null): ModoCuantas {
  if (min !== null && max !== null) return min === max ? "exactamente" : "entre";
  if (min !== null) return "alMenos";
  if (max !== null) return "maximo";
  return "libre";
}

/** Separa la restricción en el límite de opciones y el resto (texto ODK de las demás partes). */
export function leerCuantas(constraint: string): { limite: LimiteCuantas; resto: string[] } {
  const raw = constraint.trim();
  if (!raw) return { limite: LIBRE, resto: [] };
  const ast = parseExpression(raw);
  if (!ast || ast.kind === "raw") return { limite: LIBRE, resto: [raw] };
  const partes = ast.kind === "logical" && ast.op === "and" ? ast.operands : [ast];
  let min: number | null = null;
  let max: number | null = null;
  const otras: Expr[] = [];
  for (const p of partes) {
    const c = cotaDe(p);
    if (!c) { otras.push(p); continue; }
    if (c.min !== undefined) min = min === null ? c.min : Math.max(min, c.min);
    if (c.max !== undefined) max = max === null ? c.max : Math.min(max, c.max);
  }
  if (min === null && max === null) return { limite: LIBRE, resto: [raw] };
  return { limite: { modo: modoDe(min, max), min, max }, resto: otras.map((o) => serializeExpression(o)) };
}

/** Lo que le falta al límite para escribirse, en castellano; null si está completo. */
export function problemaCuantas(l: LimiteCuantas, totalOpciones?: number): string | null {
  const usaMin = l.modo === "alMenos" || l.modo === "entre" || l.modo === "exactamente";
  const usaMax = l.modo === "maximo" || l.modo === "entre";
  if (usaMin && (l.min === null || l.min < 1)) return "El número tiene que ser 1 o más.";
  if (usaMax && (l.max === null || l.max < 1)) return "El número tiene que ser 1 o más.";
  if (l.modo === "entre" && l.min !== null && l.max !== null && l.min >= l.max) return "El primer número tiene que ser menor que el segundo.";
  const tope = l.modo === "maximo" || l.modo === "entre" ? l.max : l.min;
  if (totalOpciones && tope !== null && l.modo !== "libre" && tope > totalOpciones) return `La pregunta tiene ${totalOpciones} opciones.`;
  return null;
}

/** Las partes ODK del límite (vacío si es libre). */
export function reglaCuantas(l: LimiteCuantas): string[] {
  switch (l.modo) {
    case "libre": return [];
    case "alMenos": return [`count-selected(.) >= ${l.min}`];
    case "maximo": return [`count-selected(.) <= ${l.max}`];
    case "exactamente": return [`count-selected(.) = ${l.min}`];
    case "entre": return [`count-selected(.) >= ${l.min}`, `count-selected(.) <= ${l.max}`];
  }
}

/**
 * Une partes con «and». Sólo una parte cuyo nivel superior es un «or» va entre paréntesis para que el «and» no le
 * cambie el sentido; un «or» dentro de not(…) o de otro paréntesis ya está protegido.
 */
export function unirConY(partes: readonly string[]): string {
  const llenas = partes.map((p) => p.trim()).filter(Boolean);
  const esOr = (p: string) => {
    const ast = parseExpression(p);
    return ast ? ast.kind === "logical" && ast.op === "or" : /\sor\s/.test(p);
  };
  return llenas.map((p) => (llenas.length > 1 && !/^\(.*\)$/.test(p) && esOr(p) ? `(${p})` : p)).join(" and ");
}

/** La restricción con este límite, conservando lo demás que ya exigía. */
export function escribirCuantas(constraint: string, l: LimiteCuantas): string {
  return unirConY([...leerCuantas(constraint).resto, ...reglaCuantas(l)]);
}

const opciones = (n: number | null) => `${n} ${n === 1 ? "opción" : "opciones"}`;

/** Mensaje para quien marca de más o de menos. Vacío si es libre. */
export function mensajeCuantas(l: LimiteCuantas): string {
  switch (l.modo) {
    case "libre": return "";
    case "alMenos": return `Marca al menos ${opciones(l.min)}.`;
    case "maximo": return `Marca máximo ${opciones(l.max)}.`;
    case "exactamente": return `Marca exactamente ${opciones(l.min)}.`;
    case "entre": return `Marca entre ${l.min} y ${l.max} opciones.`;
  }
}

/** Resumen corto para la entrada plegada. */
export function resumenCuantas(l: LimiteCuantas): string {
  return l.modo === "libre" ? "Sin límite" : mensajeCuantas(l).replace(/^Marca /, "").replace(/\.$/, "").replace(/^./, (c) => c.toUpperCase());
}
