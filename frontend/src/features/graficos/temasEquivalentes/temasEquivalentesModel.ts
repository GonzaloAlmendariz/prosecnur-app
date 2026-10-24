// P21 (enmienda al ADR 0103, «la matriz sugiere, la lámina decide»): tres gráficos que comparan públicos por tema y
// que hasta ahora sólo salían de la matriz de equivalencias —el radar entre públicos, la brecha entre dos bases y la
// serie temporal— se arman en la lámina con el mismo editor tema × público de las multiapiladas.
//
// Contrato de args (congelado con el backend, api/R/graficos_temas_titulos.R): `vars = { clave: ["base$var", …] }`,
// `titulos_grupo = { clave: título }` y `corte = "3,4"` (cadena). En estos tres gráficos una escala distinta dentro de un
// tema es un ERROR del motor, no un aviso: lo que falta se dice antes y bloquea.

import type { VarWithSource } from "../useVariables";
import { parseVarRef } from "../useVariables";
import { buscar, nombrePublico, type TemaPublicos } from "../multiapiladas/temasPublicos";

export type ArgsTemas = { vars: Record<string, string[]>; titulos_grupo: Record<string, string> };
export type OpcionCorte = { codigo: string; etiqueta: string };

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "");
const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
/** Clave generada por el editor (`tema_3`): no es un título que se pueda mostrar. */
const CLAVE_GENERADA = /^tema_\d+$/;

export const esSelectOne = (tipo: string): boolean => /^select_one/.test(tipo) || tipo === "so";

/** Las claves de los temas, únicas y nunca vacías (dos temas con la misma clave se fundirían en el motor). */
function clavesUnicas(temas: readonly TemaPublicos[]): string[] {
  const usadas = new Set<string>();
  return temas.map((t, i) => {
    let clave = t.key.trim() || `tema_${i + 1}`;
    let n = i + 1;
    while (usadas.has(clave)) clave = `tema_${++n}`;
    usadas.add(clave);
    return clave;
  });
}

/** Los temas del editor → `vars` y `titulos_grupo`. Un título vacío no se escribe: el motor usa la clave. */
export function temasAArgs(temas: readonly TemaPublicos[]): ArgsTemas {
  const claves = clavesUnicas(temas);
  const vars: Record<string, string[]> = {};
  const titulos_grupo: Record<string, string> = {};
  temas.forEach((t, i) => {
    vars[claves[i]] = t.vars.map(texto).filter(Boolean);
    const titulo = t.title.trim();
    if (titulo) titulos_grupo[claves[i]] = titulo;
  });
  return { vars, titulos_grupo };
}

/** `titulos_grupo` como objeto o como texto «clave=Título» por línea (la forma de las multiapiladas). */
function titulosDe(v: unknown): Record<string, string> {
  if (typeof v === "string") {
    const out: Record<string, string> = {};
    for (const linea of v.split("\n")) {
      const i = linea.indexOf("=");
      if (i > 0) out[linea.slice(0, i).trim()] = linea.slice(i + 1).trim();
    }
    return out;
  }
  if (!esObjeto(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, x] of Object.entries(v)) {
    const t = Array.isArray(x) ? texto(x[0]) : texto(x);
    if (t) out[k] = t;
  }
  return out;
}

/**
 * `vars` y `titulos_grupo` → temas del editor. Las láminas que armó la matriz traen el título como clave
 * («Clima laboral»): sin título aparte, la clave es el título, salvo que sea una clave generada (`tema_3`).
 */
export function argsATemas(args: Readonly<Record<string, unknown>>): TemaPublicos[] {
  if (!esObjeto(args.vars)) return [];
  const titulos = titulosDe(args.titulos_grupo);
  return Object.entries(args.vars).map(([key, refs]) => ({
    key,
    title: titulos[key] ?? (CLAVE_GENERADA.test(key) ? "" : key),
    vars: (Array.isArray(refs) ? refs : [refs]).map(texto).filter(Boolean),
  }));
}

/** El nombre de un tema en un mensaje. */
const nombreTema = (t: TemaPublicos, i: number) => (t.title.trim() ? `«${t.title.trim()}»` : `El tema ${i + 1}`);

/** Lo que comparten todos los gráficos: títulos que no se repiten y una sola escala por tema. */
function faltaComun(temas: readonly TemaPublicos[], variables: readonly VarWithSource[], soloOpcionUnica: boolean): string[] {
  const out: string[] = [];
  const vistos = new Set<string>();
  temas.forEach((t, i) => {
    const titulo = t.title.trim().toLocaleLowerCase("es");
    if (titulo && vistos.has(titulo)) out.push(`${nombreTema(t, i)} se repite: cada tema necesita un nombre distinto.`);
    if (titulo) vistos.add(titulo);
    const encontradas = t.vars.map((r) => buscar(variables, r)).filter((v): v is VarWithSource => !!v);
    if (soloOpcionUnica) {
      const otras = encontradas.filter((v) => !esSelectOne(v.tipo));
      if (otras.length) out.push(`${nombreTema(t, i)}: ${otras.map((v) => v.name).join(", ")} no es de opción única.`);
    }
    const escalas = new Set(encontradas.map((v) => v.scale_signature).filter((s): s is string => !!s));
    if (escalas.size > 1) out.push(`${nombreTema(t, i)}: sus preguntas tienen escalas distintas; el gráfico no se puede calcular.`);
  });
  return out;
}

/** Radar entre públicos: tres temas o más (uno por eje), preguntas de opción única y una escala por tema. */
export function faltaEnRadarPublicos(temas: readonly TemaPublicos[], variables: readonly VarWithSource[]): string[] {
  const out: string[] = [];
  if (temas.length < 3) out.push(`El radar necesita al menos tres temas, uno por eje; ${temas.length === 1 ? "hay uno" : `hay ${temas.length}`}.`);
  temas.forEach((t, i) => {
    if (!t.vars.length) out.push(`${nombreTema(t, i)} no tiene preguntas.`);
  });
  return [...out, ...faltaComun(temas, variables, true)];
}

/** Regla del radar: de 5 a 8 criterios (el motor dibuja líneas y puntos con menos y avisa; con más sigue siendo radar y avisa). */
export const REGLA_CRITERIOS_RADAR = "El radar pide de 5 a 8 criterios; con menos se dibuja como líneas y puntos; el eje se acerca a los datos y puede cambiarse.";

/** Aviso (no bloquea) cuando los criterios declarados quedan fuera de 5 a 8; `null` si están en rango o no hay ninguno. */
export function avisoCriteriosRadar(n: number): string | null {
  if (!Number.isFinite(n) || n < 1) return null;
  if (n < 5) return `Hay ${n} ${n === 1 ? "criterio" : "criterios"}: la lámina se dibujará como líneas y puntos comparativos y el export lo avisará.`;
  if (n > 8) return `Hay ${n} criterios: más de 8 pueden no leerse bien en el radar.`;
  return null;
}

/** Brecha entre dos bases: exactamente dos, y cada tema con su pregunta en las dos y en ese orden. */
export function faltaEnBrechaBases(temas: readonly TemaPublicos[], bases: readonly string[], variables: readonly VarWithSource[]): string[] {
  const out: string[] = [];
  if (bases.length !== 2 || bases[0] === bases[1]) out.push("Elige las dos bases que se comparan.");
  if (!temas.length) out.push("Agrega al menos un tema.");
  if (bases.length === 2 && bases[0] !== bases[1]) {
    temas.forEach((t, i) => {
      const fuentes = t.vars.map((r) => parseVarRef(r).source ?? "");
      const faltan = bases.filter((b) => !fuentes.includes(b));
      const ajenas = fuentes.filter((f) => !bases.includes(f));
      if (faltan.length) out.push(`${nombreTema(t, i)}: falta la pregunta de ${faltan.map(nombrePublico).join(" y de ")}.`);
      else if (ajenas.length || fuentes.length !== 2) out.push(`${nombreTema(t, i)}: lleva una pregunta de cada base y nada más.`);
      else if (fuentes[0] !== bases[0]) out.push(`${nombreTema(t, i)}: sus preguntas están en otro orden que las bases.`);
    });
  }
  return [...out, ...faltaComun(temas, variables, false)];
}

/** Serie temporal: dos mediciones o más, y cada tema con su pregunta en todas. */
export function faltaEnSerie(temas: readonly TemaPublicos[], periodos: readonly string[], variables: readonly VarWithSource[]): string[] {
  const out: string[] = [];
  if (periodos.length < 2) out.push("La serie necesita al menos dos mediciones (una base por periodo).");
  if (!temas.length) out.push("Agrega al menos un tema.");
  temas.forEach((t, i) => {
    const fuentes = new Set(t.vars.map((r) => parseVarRef(r).source ?? ""));
    const faltan = periodos.filter((p) => !fuentes.has(p));
    if (faltan.length) out.push(`${nombreTema(t, i)}: falta la pregunta de ${faltan.map(nombrePublico).join(", ")}.`);
  });
  return [...out, ...faltaComun(temas, variables, false)];
}

/**
 * Las respuestas que comparten TODAS las preguntas de los temas (por código, en el orden de la primera): el indicador
 * se calcula con un solo corte para todas, así que sólo se ofrece lo común.
 */
export function codigosComunes(temas: readonly TemaPublicos[], variables: readonly VarWithSource[]): OpcionCorte[] {
  const encontradas = temas.flatMap((t) => t.vars).map((r) => buscar(variables, r)).filter((v): v is VarWithSource => !!v);
  if (!encontradas.length) return [];
  const [primera, ...resto] = encontradas;
  const comunes = (primera.choices ?? []).filter((c) => resto.every((v) => (v.choices ?? []).some((o) => String(o.name) === String(c.name))));
  return comunes.map((c) => ({ codigo: String(c.name), etiqueta: c.label || String(c.name) }));
}

/** El corte guardado como lista de códigos: cadena «3,4» o lista. */
export function corteGuardado(v: unknown): string[] {
  const partes = Array.isArray(v) ? v.map(texto) : [texto(v)];
  return partes.flatMap((p) => p.split(/[,;|]/)).map((c) => c.trim()).filter(Boolean);
}

/** Marcar o desmarcar un código: el corte sale como cadena en el orden de la escala («3,4»). */
export function conCodigo(actual: readonly string[], codigo: string, marcado: boolean, escala: readonly OpcionCorte[]): string {
  const set = new Set(actual);
  if (marcado) set.add(codigo); else set.delete(codigo);
  const enEscala = escala.map((o) => o.codigo).filter((c) => set.has(c));
  const fuera = [...set].filter((c) => !enEscala.includes(c));
  return [...enEscala, ...fuera].join(",");
}

/** Reordena cada tema con estas bases y suelta las preguntas de una base que ya no se compara. */
export function conBases(temas: readonly TemaPublicos[], bases: readonly string[]): TemaPublicos[] {
  return temas.map((t) => ({
    ...t,
    vars: bases.map((b) => t.vars.find((r) => parseVarRef(r).source === b) ?? "").filter(Boolean),
  }));
}

/** Las dos bases de una brecha guardada: las del primer tema que tenga preguntas, en su orden. */
export function basesDeBrecha(temas: readonly TemaPublicos[]): string[] {
  for (const t of temas) {
    const fuentes = t.vars.map((r) => parseVarRef(r).source ?? "").filter(Boolean);
    if (fuentes.length >= 2) return fuentes.slice(0, 2);
  }
  for (const t of temas) {
    const f = t.vars.map((r) => parseVarRef(r).source ?? "").find(Boolean);
    if (f) return [f];
  }
  return [];
}

/**
 * Args que sólo tiene sentido guardar en cada modo del radar (los de la metadata de `p_radar` con `depende` en `modo`,
 * más `box_labels`, que sólo el modo «box» usa). Lo demás —valores, decimales, límites, margen, filtros— vale en los tres.
 */
const ARGS_PROPIOS_RADAR: Record<string, readonly string[]> = {
  sm: ["var", "cruce"],
  box: ["vars", "cruce", "box_labels"],
  publicos: [
    "vars", "corte", "corte_etiqueta", "estilo", "eje_min", "forma", "fallback_pocos", "eje_pocos", "eje_pocos_min", "eje_pocos_max", "tabla", "mostrar_tabla", "tabla_titulo", "tabla_encabezados",
    "tabla_ancho_tema", "tabla_proporcion", "titulos_grupo",
  ],
};
const ARGS_DE_ALGUN_MODO_RADAR = [...new Set(Object.values(ARGS_PROPIOS_RADAR).flat())];

/**
 * Cambiar el modo del radar: borra (con `null`, que `mergeSlotArgsPatch` entiende como borrar) los args que son de otro
 * modo, para que no queden guardados sin que la tarjeta los muestre —un `var` de «sm» dentro de un «box» abortaba el
 * export (lámina 33 de Arte)—. Al entrar o salir de «entre públicos» las preguntas cambian de forma (temas por público
 * ⇄ lista), así que se reinician; entre «sm» y «box» los args compartidos (`cruce`) se conservan.
 */
export function patchModoRadar(anterior: unknown, nuevo: string): Record<string, unknown> {
  if (anterior === nuevo) return { modo: nuevo };
  const propios = new Set(ARGS_PROPIOS_RADAR[nuevo] ?? []);
  const patch: Record<string, unknown> = { modo: nuevo };
  // Un modo desconocido no borra nada: no se sabe qué es suyo.
  if (ARGS_PROPIOS_RADAR[nuevo]) for (const a of ARGS_DE_ALGUN_MODO_RADAR) if (!propios.has(a)) patch[a] = null;
  const eraPublicos = anterior === "publicos";
  const esPublicos = nuevo === "publicos";
  if (eraPublicos !== esPublicos) {
    if (nuevo === "box" || esPublicos) patch.vars = esPublicos ? {} : [];
    patch.titulos_grupo = null;
  }
  return patch;
}
