// Orden al azar de las opciones (checklist elección por pares C16, 2026-11-07). Controla el efecto del orden: a cada
// encuestado las opciones de las preguntas elegidas le salen en otro orden. XLSForm lo hace con
// `parameters: randomize=true seed=${…}`; la semilla es un cálculo (`<p>_semilla`, sorteado una vez por entrevista)
// que queda en la base, así el orden que vio cada uno se puede reconstruir.
//
// El orden de las PREGUNTAS no se puede sortear en XLSForm sin duplicarlas (cada copia sería otra variable), así que
// este experimento ordena opciones, no preguntas.

import { rowToRecord, insertRecord, setCell } from "../parsing/sheetUtils";
import type { XlsformEditorWorkbook } from "../types";

export type DisenoOrden = {
  prefijo: string;
  /** Códigos de las preguntas de selección cuyas opciones se barajan. */
  preguntas: string[];
};

const NOMBRE = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const SEMILLA = (p: string) => `${p}_semilla`;
/** La semilla: un entero sorteado una vez por entrevista. */
export const FORMULA_SEMILLA = "once(int(random() * 1000000))";
const TOKEN_ORDEN = /(^|\s)(randomize|seed)=\S*/g;

/** Los parámetros sin el orden al azar (conserva los demás, p. ej. `max-pixels`). */
export const sinOrden = (parametros: string) => parametros.replace(TOKEN_ORDEN, " ").replace(/\s+/g, " ").trim();
/** Los parámetros con el orden al azar y su semilla. */
export const conOrden = (parametros: string, semilla: string) => [sinOrden(parametros), `randomize=true seed=\${${semilla}}`].filter(Boolean).join(" ");

/** Opciones que suelen ir al final y que el orden al azar también movería (No sabe, Otro…). */
export function opcionesQueSeMueven(opciones: readonly { codigo: string; etiqueta: string }[]): string[] {
  return opciones
    .filter((o) => /^(8|9)\1$|^-\d+$|^9[6-9]$|^(ns|nr|nsnr|otro)$/i.test(o.codigo) || /no sab|no respond|no precis|ningun|otro|otra/i.test(o.etiqueta))
    .map((o) => o.etiqueta);
}

/** ¿Es una escala ordenada (códigos enteros seguidos, tres o más)? Barajarla rompe su orden. */
export function esEscala(opciones: readonly { codigo: string }[]): boolean {
  const n = opciones.map((o) => Number(o.codigo));
  return n.length >= 3 && n.every((x, k) => Number.isInteger(x) && x === n[0]! + k);
}

export function validarOrden(d: DisenoOrden, seleccionables: readonly string[]): string[] {
  const out: string[] = [];
  if (!NOMBRE.test(d.prefijo)) out.push(`El prefijo "${d.prefijo}" no sirve como nombre de variable: usa letras, números y _.`);
  if (!d.preguntas.length) out.push("Elige al menos una pregunta de selección.");
  for (const p of d.preguntas) if (!seleccionables.includes(p)) out.push(`"${p}" no es una pregunta de selección del formulario.`);
  return out;
}

export type LecturaOrden = { diseno: DisenoOrden; semilla: number; preguntas: number[]; filas: number[] };

/** Experimentos de orden ya escritos: preguntas con `randomize=true seed=${X}` y un cálculo X sorteado una vez. */
export function leerOrden(wb: Pick<XlsformEditorWorkbook, "survey"> | null): LecturaOrden[] {
  if (!wb) return [];
  const s = wb.survey;
  const filas = s.rows.map((_, i) => {
    const r = rowToRecord(s, i);
    return { i, type: (r.type ?? "").trim(), name: (r.name ?? "").trim(), calculation: (r.calculation ?? "").trim(), parameters: (r.parameters ?? "").trim() };
  });
  const porSemilla = new Map<string, number[]>();
  for (const f of filas) {
    if (!/^select_(one|multiple)\s/.test(f.type) || !/(^|\s)randomize=(true|yes)(\s|$)/.test(f.parameters)) continue;
    const semilla = /(^|\s)seed=\$\{([^}]+)\}/.exec(f.parameters)?.[2];
    if (!semilla) continue;
    porSemilla.set(semilla, [...(porSemilla.get(semilla) ?? []), f.i]);
  }
  const out: LecturaOrden[] = [];
  for (const [nombre, preguntas] of porSemilla) {
    const calc = filas.find((f) => f.name === nombre && f.type === "calculate" && /^once\(/.test(f.calculation));
    if (!calc) continue;
    const prefijo = /^(.+)_semilla$/.exec(nombre)?.[1] ?? nombre;
    out.push({ diseno: { prefijo, preguntas: preguntas.map((i) => filas[i]!.name) }, semilla: calc.i, preguntas, filas: [calc.i, ...preguntas].sort((a, b) => a - b) });
  }
  return out;
}

/**
 * Escribe el orden al azar: la semilla (si no está) en `indiceSemilla` y los parámetros de las preguntas. Con
 * `previa`, quita el orden de las preguntas que ya no van. Devuelve la fila de la semilla.
 */
export function aplicarOrden(draft: XlsformEditorWorkbook, d: DisenoOrden, indiceSemilla: number, previa: LecturaOrden | null): number {
  const s = draft.survey;
  const nombre = SEMILLA(d.prefijo);
  const fila = (n: string) => s.rows.findIndex((_, i) => (rowToRecord(s, i).name ?? "").trim() === n);
  if (fila(nombre) < 0) insertRecord(s, indiceSemilla, { type: "calculate", name: nombre, calculation: FORMULA_SEMILLA });
  for (const n of previa?.diseno.preguntas ?? []) {
    if (d.preguntas.includes(n)) continue;
    const i = fila(n);
    if (i >= 0) setCell(s, i, "parameters", sinOrden(rowToRecord(s, i).parameters ?? ""));
  }
  for (const n of d.preguntas) {
    const i = fila(n);
    if (i >= 0) setCell(s, i, "parameters", conOrden(rowToRecord(s, i).parameters ?? "", nombre));
  }
  return fila(nombre);
}
