// G16 (Gonzalo, 2026-10-13: «Sí, vamos con matriz de cuadrantes»). Modelo puro de la tarjeta: cada tema con su nombre y
// sus dos preguntas (eje horizontal, eje vertical), las respuestas que suman cada eje y los nombres de los cuadrantes.
// El nombre de un tema nuevo arranca con la etiqueta de su pregunta tal como la deja Procesamiento; el analista la acorta.

import type { VarWithSource } from "../../useVariables";
import { opcionesDe, refCompleta, variableDe, type Opcion } from "../brecha/modeloBrechaGrupos";

type Args = Readonly<Record<string, unknown>>;
export type Tema = { nombre: string; x: string; y: string };
export const CUADRANTES = ["arriba_izq", "arriba_der", "abajo_izq", "abajo_der"] as const;
export type Cuadrante = (typeof CUADRANTES)[number];
export const ROTULO_CUADRANTE: Record<Cuadrante, string> = {
  arriba_izq: "Arriba a la izquierda", arriba_der: "Arriba a la derecha", abajo_izq: "Abajo a la izquierda", abajo_der: "Abajo a la derecha",
};
/** Los de fábrica en el motor (api/R/graficos_matriz_cuadrantes.R): neutros. */
export const NOMBRE_NEUTRO: Record<Cuadrante, string> = {
  arriba_izq: "Alto en el eje vertical", arriba_der: "Altos en ambos", abajo_izq: "Bajos en ambos", abajo_der: "Alto en el eje horizontal",
};

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export function temasDe(args: Args): Tema[] {
  const t = args.temas;
  if (!t || typeof t !== "object" || Array.isArray(t)) return [];
  return Object.entries(t as Record<string, unknown>).map(([nombre, refs]) => {
    const r = Array.isArray(refs) ? refs.map(texto) : [];
    return { nombre, x: r[0] ?? "", y: r[1] ?? "" };
  });
}

/** Los temas como los guarda el plan: `{ nombre: [ref_x, ref_y] }`; un nombre repetido se numera para no perder un tema. */
export function conTemas(variables: readonly VarWithSource[], temas: readonly Tema[]): Record<string, unknown> {
  const out: Record<string, string[]> = {};
  for (const t of temas) {
    let n = t.nombre.trim() || "Tema"; let k = 2;
    while (n in out) n = `${t.nombre.trim() || "Tema"} ${k++}`;
    out[n] = [t.x ? refCompleta(variables, t.x) : "", t.y ? refCompleta(variables, t.y) : ""];
  }
  return { temas: out };
}

/** El nombre de partida de un tema: la etiqueta de su pregunta (la de Procesamiento), sin tocarla. */
export function nombreDePartida(variables: readonly VarWithSource[], ref: string): string {
  return variableDe(variables, ref)?.label?.trim() || ref.replace(/^.*\$/, "");
}

export function escalaDe(variables: readonly VarWithSource[], temas: readonly Tema[], eje: "x" | "y"): Opcion[] {
  const ref = temas.find((t) => t[eje])?.[eje];
  return ref ? opcionesDe(variables, ref) : [];
}

export function corteDe(args: Args, eje: "x" | "y"): string[] {
  const v = args[eje === "x" ? "corte_x" : "corte_y"];
  const s = Array.isArray(v) ? v.join(",") : texto(v);
  return s.split(/[,;|]/).map((c) => c.trim()).filter(Boolean);
}

export function conCorte(args: Args, eje: "x" | "y", codigo: string, marcado: boolean): Record<string, unknown> {
  const c = new Set(corteDe(args, eje));
  if (marcado) c.add(codigo); else c.delete(codigo);
  return { [eje === "x" ? "corte_x" : "corte_y"]: [...c].join(",") };
}

export function nombresDe(args: Args): Partial<Record<Cuadrante, string>> {
  const n = args.nombres;
  return n && typeof n === "object" && !Array.isArray(n) ? (n as Partial<Record<Cuadrante, string>>) : {};
}

export function conNombre(args: Args, q: Cuadrante, valor: string): Record<string, unknown> {
  const n = { ...nombresDe(args) };
  if (valor.trim()) n[q] = valor; else delete n[q];
  return { nombres: n };
}

/** Lo que falta para dibujar, en el orden en que se elige. */
export function faltaEnMatriz(args: Args): string | null {
  const t = temasDe(args);
  if (t.length < 2) return "Agrega al menos dos temas.";
  if (t.some((x) => !x.x || !x.y)) return "Cada tema necesita su pregunta del eje horizontal y la del vertical.";
  if (!corteDe(args, "x").length || !corteDe(args, "y").length) return "Marca qué respuestas suman cada eje.";
  return null;
}
