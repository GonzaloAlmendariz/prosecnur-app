// G17 (Gonzalo, 2026-10-13: «el lollipop de brechas también era un gráfico bastante interesante»; elegido: dos grupos de
// una base, como la lámina 250 del diseño). Modelo puro de la tarjeta de la brecha entre dos grupos: qué preguntas,
// qué cruce, qué dos grupos y qué indicador lleva `p_dumbbell` con `cruce` (api/R/graficos_dumbbell_grupos.R).

import type { VarWithSource } from "../../useVariables";
import { parseVarRef } from "../../useVariables";

type Args = Readonly<Record<string, unknown>>;
export type Opcion = { codigo: string; etiqueta: string };

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const lista = (v: unknown): string[] => (Array.isArray(v) ? v.map(texto).filter(Boolean) : texto(v) ? [texto(v)] : []);

/**
 * ¿La brecha compara dos grupos de una base (con cruce) o dos bases (la forma de equivalencias)? Una brecha recién
 * elegida, sin cruce ni preguntas por base, arranca en «dos grupos»: entre dos bases sólo hay algo que mostrar cuando
 * la matriz de equivalencias ya puso sus preguntas (loop UI R4).
 */
export function esEntreGrupos(args: Args): boolean {
  if (args.cruce === null) return false;
  if (typeof args.cruce === "string") return true;
  return !tienePreguntasPorBase(args.vars);
}

const tienePreguntasPorBase = (v: unknown): boolean =>
  !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length > 0;

/** Las preguntas de la brecha entre grupos: una ref por tema, en orden. */
export function preguntasDe(args: Args): string[] {
  const v = args.vars;
  if (Array.isArray(v)) return v.map((x) => (Array.isArray(x) ? texto(x[0]) : texto(x))).filter(Boolean);
  if (v && typeof v === "object") return Object.values(v as Record<string, unknown>).map((x) => (Array.isArray(x) ? texto(x[0]) : texto(x))).filter(Boolean);
  return [];
}

/** La variable de una ref (`base$p3` o `p3` en un estudio de una base). */
export function variableDe(variables: readonly VarWithSource[], ref: string): VarWithSource | undefined {
  const { source, name } = parseVarRef(ref);
  return variables.find((x) => x.name === name && (!source || x.source === source));
}

/** La ref con su base siempre: el motor resuelve `base$variable` también en un estudio de una sola base. */
export function refCompleta(variables: readonly VarWithSource[], ref: string): string {
  const v = variableDe(variables, ref);
  return v ? `${v.source}$${v.name}` : ref;
}

export function opcionesDe(variables: readonly VarWithSource[], ref: string): Opcion[] {
  return (variableDe(variables, ref)?.choices ?? []).map((c) => ({ codigo: String(c.name), etiqueta: c.label || String(c.name) }));
}

export function gruposDe(args: Args): [string, string] {
  const g = lista(args.grupos);
  return [g[0] ?? "", g[1] ?? ""];
}

export function corteDe(args: Args): string[] {
  return lista(args.corte).flatMap((c) => c.split(/[,;|]/)).map((c) => c.trim()).filter(Boolean);
}

/** Pasar a «entre dos grupos»: se vacían las preguntas por base (otra forma) y se pide el cruce. */
export function aEntreGrupos(): Record<string, unknown> {
  return { cruce: "", grupos: [], vars: [] };
}

/** Volver a «entre dos bases»: sin cruce ni grupos; los temas por base se arman en EditorTemasEquivalentes (P21). */
export function aEntreBases(): Record<string, unknown> {
  return { cruce: null, grupos: null, vars: {} };
}

/** Elegir el cruce: los grupos elegidos de otro cruce ya no valen. */
export function conCruce(variables: readonly VarWithSource[], ref: string | null): Record<string, unknown> {
  return { cruce: ref ? refCompleta(variables, ref) : "", grupos: [] };
}

export function conGrupo(args: Args, k: 0 | 1, codigo: string): Record<string, unknown> {
  const g = gruposDe(args); g[k] = codigo;
  return { grupos: g.filter((x, i) => i === 0 || x !== g[0] || !x) };
}

export function conPreguntas(variables: readonly VarWithSource[], refs: readonly string[]): Record<string, unknown> {
  return { vars: refs.filter(Boolean).map((r) => refCompleta(variables, r)) };
}

export function conCorte(args: Args, codigo: string, marcado: boolean): Record<string, unknown> {
  const c = new Set(corteDe(args));
  if (marcado) c.add(codigo); else c.delete(codigo);
  return { corte: [...c].join(",") };
}

/** Lo que falta para que la lámina se pueda dibujar, en el orden en que se elige. */
export function faltaEnBrecha(args: Args): string | null {
  if (!texto(args.cruce)) return "Elige la pregunta que define los grupos.";
  const [a, b] = gruposDe(args);
  if (!a || !b) return "Elige los dos grupos que se comparan.";
  if (!preguntasDe(args).length) return "Agrega al menos una pregunta.";
  if (!corteDe(args).length) return "Marca qué respuestas suman el indicador.";
  return null;
}

/** ¿La pregunta está en la base del cruce? La brecha entre grupos compara dentro de una misma base. */
export function mismaBase(variables: readonly VarWithSource[], cruce: string, ref: string): boolean {
  const a = variableDe(variables, cruce); const b = variableDe(variables, ref);
  return !a || !b || a.source === b.source;
}
