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

/**
 * Cuántos grupos admite la brecha entre grupos: dos en el recetario; hasta cuatro en el contraste del resumen ejecutivo
 * (ADR 0134: aperturas internas por ciclo o dedicación), que es lo que acepta `.p_dumbbell_grupos()`.
 */
export const MAX_GRUPOS_RECETARIO = 2;
export const MAX_GRUPOS_RESUMEN = 4;
export function maxGrupos(args: Args): number {
  return args.estilo === "resumen" ? MAX_GRUPOS_RESUMEN : MAX_GRUPOS_RECETARIO;
}

/** Los grupos elegidos, sin huecos al final (los dos primeros conservan su posición: primero menos segundo). */
export function gruposElegidos(args: Args): string[] {
  return lista(args.grupos);
}

/**
 * Las casillas de grupo que la tarjeta muestra: siempre dos; en el resumen, una más vacía mientras quepa otra (hasta
 * cuatro). Un plan guardado con más grupos de los que admite su estilo los muestra todos para poder quitarlos: no se
 * recortan en silencio (faltaEnBrecha lo avisa).
 */
export function gruposDe(args: Args): string[] {
  const g = Array.isArray(args.grupos) ? args.grupos.map(texto) : lista(args.grupos);
  const llenos = g.filter(Boolean).length;
  const tope = maxGrupos(args);
  const casillas = Math.max(2, Math.min(tope, llenos + (tope > MAX_GRUPOS_RECETARIO ? 1 : 0)), g.length > tope ? g.length : 0);
  return Array.from({ length: casillas }, (_, i) => g[i] ?? "");
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

/**
 * Elegir el grupo de la casilla `k`. Un código ya elegido en otra casilla anterior deja vacía la posterior; las dos
 * primeras conservan su posición (la brecha es la primera menos la segunda) y desde la tercera los huecos se cierran.
 */
export function conGrupo(args: Args, k: number, codigo: string): Record<string, unknown> {
  const g = gruposDe(args);
  if (k < 0 || k >= g.length) return { grupos: g.filter((x, i) => i < 2 || x) };
  g[k] = codigo;
  const vistos = new Set<string>();
  const limpio = g.map((x) => {
    if (!x || vistos.has(x)) return "";
    vistos.add(x);
    return x;
  });
  return { grupos: limpio.filter((x, i) => i < 2 || x) };
}

/** Las opciones de la casilla `k`: las del cruce menos las elegidas en las demás casillas. */
export function opcionesDeGrupo(opciones: readonly Opcion[], args: Args, k: number): Opcion[] {
  const otros = new Set(gruposDe(args).filter((x, i) => i !== k && x));
  return opciones.filter((o) => !otros.has(o.codigo));
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
  const tope = maxGrupos(args);
  if (gruposElegidos(args).length > tope) {
    return "Recetario compara dos grupos: quita los demás o elige «Contraste de públicos» en Estilo.";
  }
  if (!a || !b) return tope > MAX_GRUPOS_RECETARIO ? "Elige al menos los dos primeros grupos." : "Elige los dos grupos que se comparan.";
  if (!preguntasDe(args).length) return "Agrega al menos una pregunta.";
  if (!corteDe(args).length) return "Marca qué respuestas suman el indicador.";
  return null;
}

/** ¿La pregunta está en la base del cruce? La brecha entre grupos compara dentro de una misma base. */
export function mismaBase(variables: readonly VarWithSource[], cruce: string, ref: string): boolean {
  const a = variableDe(variables, cruce); const b = variableDe(variables, ref);
  return !a || !b || a.source === b.source;
}
