// G17 (Gonzalo, 2026-10-13: «el lollipop de brechas también era un gráfico bastante interesante»; elegido: dos grupos de
// una base, como la lámina 250 del diseño). Modelo puro de la tarjeta de la brecha entre dos grupos: qué preguntas,
// qué cruce, qué dos grupos y qué indicador lleva `p_dumbbell` con `cruce` (api/R/graficos_dumbbell_grupos.R).

import type { VarWithSource } from "../../useVariables";
import { parseVarRef } from "../../useVariables";
import { esComodin, usaPublicos } from "../publicosGrafico/modeloPublicos";

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

/**
 * Pasar a «entre dos grupos»: se vacían las preguntas por base (otra forma) y el par de públicos, y se pide el cruce.
 * Una lista de preguntas (`base$*` o sueltas) ya es de esta forma y se conserva (Q4-3 de la prueba con Arte).
 */
export function aEntreGrupos(args: Args = {}): Record<string, unknown> {
  return { cruce: "", grupos: [], vars: Array.isArray(args.vars) ? args.vars : [], bases: null };
}

/** Volver a «entre dos bases»: sin cruce ni grupos; los temas por base se arman en EditorTemasEquivalentes (P21). */
export function aEntreBases(): Record<string, unknown> {
  return { cruce: null, grupos: null, vars: {} };
}

/**
 * Elegir el cruce: los grupos elegidos de otro cruce ya no valen; las preguntas no se tocan (Q4-3: elegir «Dividir por»
 * borraba `base$*` y el preview pedía preguntas). `grupos` son los que arrancan encendidos (gruposPorDefecto).
 */
export function conCruce(variables: readonly VarWithSource[], ref: string | null, grupos: readonly string[] = []): Record<string, unknown> {
  return { cruce: ref ? refCompleta(variables, ref) : "", grupos: ref ? [...grupos] : [] };
}

/**
 * Los grupos que arrancan encendidos al elegir la pregunta que divide en el resumen (Q4-4): hasta cuatro con al menos una
 * respuesta, en el orden de la lista. Sin conteo no se adivina: ninguno.
 */
export function gruposPorDefecto(opciones: readonly Opcion[], conteos: ReadonlyMap<string, number> | null, tope = MAX_GRUPOS_RESUMEN): string[] {
  if (!conteos) return [];
  return opciones.filter((o) => (conteos.get(o.codigo) ?? 0) > 0).slice(0, tope).map((o) => o.codigo);
}

/** La base del cruce (`docentes` de `docentes$ciclo`); "" si no la trae. */
export function baseDelCruce(variables: readonly VarWithSource[], cruce: string): string {
  return parseVarRef(cruce).source || variableDe(variables, cruce)?.source || "";
}

/** Las preguntas elegidas una por una: las de `vars` que no son `base$*`. */
export function preguntasDeclaradas(args: Args): string[] {
  return preguntasDe(args).filter((r) => !esComodin(r));
}

/** `base$*` de la base del cruce (todas sus preguntas de escala); "" sin cruce. */
export function comodinDelCruce(variables: readonly VarWithSource[], cruce: string): string {
  const base = cruce ? baseDelCruce(variables, cruce) : "";
  return base ? `${base}$*` : "";
}

const conRegla = (args: Args): boolean => !!args.regla && typeof args.regla === "object";

/**
 * ¿Las preguntas salen de la regla sin declararlas? En el resumen con regla, `vars` lleva `base$*` de la base del cruce
 * y la regla elige cuáles salen (R8-1: con `vars: []` el router lo toma como borrador y la lámina salía vacía).
 */
export function preguntasPorRegla(args: Args): boolean {
  return args.estilo === "resumen" && conRegla(args) && !preguntasDeclaradas(args).length && usaPublicos(args.vars);
}

/**
 * ¿`vars` es sólo el `base$*` de la base del cruce? Entonces la tarjeta muestra «Preguntas» con la nota de la regla, no
 * la lista de públicos (que es para comparar públicos distintos).
 */
export function soloComodinDelCruce(variables: readonly VarWithSource[], args: Args): boolean {
  const comodin = comodinDelCruce(variables, texto(args.cruce));
  const v = Array.isArray(args.vars) ? args.vars.map(texto).filter(Boolean) : [];
  return !!comodin && v.length === 1 && v[0] === comodin;
}

/**
 * La lámina guardada antes de R8-1 (resumen con regla y cruce, `vars` vacío): sale vacía aunque la regla cuente. La
 * tarjeta lo dice y ofrece tomar las de escala de la base del cruce.
 */
export function brechaSinPreguntas(args: Args): boolean {
  return esEntreGrupos(args) && args.estilo === "resumen" && conRegla(args) && !!texto(args.cruce) && !preguntasDe(args).length;
}

/**
 * R8-1: el cambio que se guarda en una brecha entre grupos del resumen. Con regla, cruce y sin preguntas declaradas,
 * `vars` lleva el `base$*` de la base del cruce (y lo cambia si el cruce pasa a otra base): la regla cuenta sobre esas
 * preguntas y el router las dibuja. Cualquier otro caso pasa el cambio tal cual.
 */
export function conComodinDeLaRegla(
  variables: readonly VarWithSource[], graficador: string, args: Args, patch: Record<string, unknown>,
): Record<string, unknown> {
  if (graficador !== "p_dumbbell") return patch;
  const junto: Args = { ...args, ...patch };
  if (!esEntreGrupos(junto) || junto.estilo !== "resumen" || !conRegla(junto)) return patch;
  const comodin = comodinDelCruce(variables, texto(junto.cruce));
  if (!comodin || preguntasDeclaradas(junto).length) return patch;
  const v = Array.isArray(junto.vars) ? junto.vars.map(texto).filter(Boolean) : [];
  if (v.length === 1 && v[0] === comodin) return patch;
  // Sólo se reemplaza lo vacío o un `base$*` de otra base (el cruce cambió): una lista de públicos se respeta.
  if (v.length > 1) return patch;
  return { ...patch, vars: [comodin] };
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

export const FALTAN_GRUPOS = "Elige los grupos que se comparan.";
/** R8-7: sin «Dividir por» en «Dos grupos de una base»; no el texto del contraste entre públicos que da el motor. */
export const FALTA_CRUCE = "Elige la variable que divide a los grupos.";

/**
 * ¿La brecha está en «Dos grupos de una base» (elegido: `cruce` es texto, aEntreGrupos) sin la variable que divide? Sin
 * la clave `cruce` el motor la toma como contraste entre las bases del estudio; ésa no es esta falta.
 */
export function sinCruce(args: Args): boolean {
  return typeof args.cruce === "string" && !texto(args.cruce);
}

/** Lo que falta para que la lámina se pueda dibujar, en el orden en que se elige. */
export function faltaEnBrecha(args: Args): string | null {
  if (!texto(args.cruce)) return FALTA_CRUCE;
  const [a, b] = gruposDe(args);
  const tope = maxGrupos(args);
  if (gruposElegidos(args).length > tope) {
    return 'Recetario compara dos grupos: quita los demás o elige "Contraste de públicos" en Estilo.';
  }
  if (!a || !b) return tope > MAX_GRUPOS_RECETARIO ? FALTAN_GRUPOS : "Elige los dos grupos que se comparan.";
  if (!preguntasDeclaradas(args).length && !usaPublicos(args.vars)) return "Agrega al menos una pregunta.";
  if (!corteDe(args).length) return "Marca qué respuestas suman el indicador.";
  return null;
}

/** ¿La pregunta está en la base del cruce? La brecha entre grupos compara dentro de una misma base. */
export function mismaBase(variables: readonly VarWithSource[], cruce: string, ref: string): boolean {
  const a = variableDe(variables, cruce); const b = variableDe(variables, ref);
  return !a || !b || a.source === b.source;
}
