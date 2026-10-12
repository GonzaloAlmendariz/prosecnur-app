// Paletas con nombre (Gonzalo 2026-10-11: «poder agrupar grupos que usan las mismas categorías y poder darle un nombre
// personalizado, que pueda ser reutilizable desde láminas también»). Una paleta con nombre es una clave propia en
// `paletas` («Satisfacción») a la que se vinculan las listas que la usan (`paletas_vinculos`, ADR 0097; el motor la
// resuelve en graficos_paleta_resolver.R). Un grupo sin nombre sigue guardando sus colores en sus propias listas.

import {
  candidatosNombre,
  coloresPorEtiqueta,
  firmaOpciones,
  normalizarEtiquetaPaleta,
  type MapaPaletas,
  type VinculosPaletas,
} from "../paletasResolver";
import { combinacionesPara, conColoresDelGrupo, esRespuestaResidual, type GrupoRespuestas, type ListaRespuestas, type PreguntaDelGrupo } from "./modeloColoresRespuestas";

export type FilaPaleta = {
  id: string;
  nombre: string;
  /** Clave de la paleta con nombre; `null` = grupo sin nombre (colores en sus listas). */
  clave: string | null;
  grupos: GrupoRespuestas[];
  opciones: string[];
  colores: Record<string, string>;
  preguntas: PreguntaDelGrupo[];
  bases: string[];
  faltan: number;
};

/** Nombre automático: las respuestas cortas juntas, o la primera y la última sustantiva de una escala. */
export function nombreAutomatico(opciones: readonly string[]): string {
  const sust = opciones.filter((o) => !esRespuestaResidual(o));
  const base = sust.length ? sust : [...opciones];
  if (base.length <= 3) return base.join(" / ");
  return `${base[0]} a ${base[base.length - 1]}`;
}

/**
 * Listas cuyo nombre aloja respuestas distintas en distintas bases (multibase: `lst_p6` son grados en docentes y Sí/No
 * en administrativos). El vínculo es por nombre de lista, así que vincular una arrastraría a las otras escalas: esas
 * listas nunca se vinculan y guardan sus colores en su propia paleta (las etiquetas no se pisan).
 */
export function listasCompartidas(listas: readonly ListaRespuestas[]): Set<string> {
  const firmas = new Map<string, Set<string>>();
  for (const l of listas) {
    const f = firmaOpciones(l.choices.map((c) => c.label));
    if (!firmas.has(l.list_name)) firmas.set(l.list_name, new Set());
    firmas.get(l.list_name)!.add(f);
  }
  return new Set([...firmas].filter(([, f]) => f.size > 1).map(([ln]) => ln));
}

function vinculables(grupo: GrupoRespuestas, compartidas: ReadonlySet<string>): string[] {
  return grupo.listas.filter((l) => !compartidas.has(l));
}

/** El mismo grupo, sólo con sus listas compartidas (para pintarlas en su propia paleta). */
function soloCompartidas(grupo: GrupoRespuestas, compartidas: ReadonlySet<string>): GrupoRespuestas {
  return { ...grupo, listas: grupo.listas.filter((l) => compartidas.has(l)) };
}

/** La paleta con nombre de un grupo: sus listas vinculables vinculadas a la misma clave, que no es el nombre de una lista. */
export function claveNombradaDe(grupo: GrupoRespuestas, vinculos: VinculosPaletas, nombresDeLista: ReadonlySet<string>, compartidas: ReadonlySet<string> = new Set()): string | null {
  const propias = vinculables(grupo, compartidas);
  if (!propias.length) return null;
  const claves = new Set(propias.map((l) => vinculos[l]));
  if (claves.size !== 1) return null;
  const [k] = claves;
  return typeof k === "string" && k && !nombresDeLista.has(k) ? k : null;
}

function nombresDeListas(listas: readonly ListaRespuestas[]): Set<string> {
  const s = new Set<string>();
  for (const l of listas) for (const c of candidatosNombre(l.list_name)) s.add(c);
  return s;
}

function unir<T>(destino: T[], fuente: readonly T[], igual: (a: T, b: T) => boolean) {
  for (const x of fuente) if (!destino.some((y) => igual(x, y))) destino.push(x);
}

/** Filas de la pantalla: una por paleta con nombre (con todos sus grupos) y una por grupo sin nombre. */
export function filasDePaletas(
  grupos: readonly GrupoRespuestas[],
  listas: readonly ListaRespuestas[],
  paletas: MapaPaletas,
  vinculos: VinculosPaletas,
): FilaPaleta[] {
  const nombres = nombresDeListas(listas);
  const compartidas = listasCompartidas(listas);
  const porClave = new Map<string, FilaPaleta>();
  const filas: FilaPaleta[] = [];
  for (const g of grupos) {
    const clave = claveNombradaDe(g, vinculos, nombres, compartidas);
    if (!clave) {
      filas.push({ id: `grupo:${g.id}`, nombre: nombreAutomatico(g.opciones), clave: null, grupos: [g], opciones: [...g.opciones], colores: { ...g.colores }, preguntas: [...g.preguntas], bases: [...g.bases], faltan: g.faltan });
      continue;
    }
    let f = porClave.get(clave);
    if (!f) {
      f = { id: `paleta:${clave}`, nombre: clave, clave, grupos: [], opciones: [], colores: {}, preguntas: [], bases: [], faltan: 0 };
      porClave.set(clave, f);
      filas.push(f);
    }
    f.grupos.push(g);
    unir(f.opciones, g.opciones, (a, b) => normalizarEtiquetaPaleta(a) === normalizarEtiquetaPaleta(b));
    unir(f.preguntas, g.preguntas, (a, b) => a.ref === b.ref);
    unir(f.bases, g.bases, (a, b) => a === b);
  }
  for (const f of porClave.values()) {
    for (const { label, color } of coloresPorEtiqueta(paletas[f.clave!] ?? {}, f.opciones.map((label) => ({ label })))) f.colores[label] = color;
    f.faltan = f.opciones.filter((o) => !f.colores[o]).length;
  }
  return filas.sort((a, b) => Number(b.clave !== null) - Number(a.clave !== null) || b.preguntas.length - a.preguntas.length);
}

/** Respuestas que dos filas comparten (para ofrecer agrupar sólo lo que tiene sentido). */
export function respuestasEnComun(a: FilaPaleta, b: FilaPaleta): number {
  const nb = new Set(b.opciones.map(normalizarEtiquetaPaleta));
  return a.opciones.filter((o) => nb.has(normalizarEtiquetaPaleta(o))).length;
}

export function errorNombre(nombre: string, filas: readonly FilaPaleta[], listas: readonly ListaRespuestas[], propia: FilaPaleta): string | null {
  const n = nombre.trim();
  if (!n) return "Escribe un nombre.";
  if (nombresDeListas(listas).has(n)) return "Ese nombre ya lo usa una lista del formulario; elige otro.";
  if (filas.some((f) => f !== propia && f.clave === n)) return "Ya hay una paleta con ese nombre. Para juntarlas usa «Agrupar con».";
  return null;
}

type Mapas = { paletas: MapaPaletas; vinculos: VinculosPaletas };

function sinColoresPropios(paletas: MapaPaletas, grupo: GrupoRespuestas, listas: readonly ListaRespuestas[]): MapaPaletas {
  return conColoresDelGrupo(paletas, grupo, listas, Object.fromEntries(grupo.opciones.map((o) => [o, null])));
}

/**
 * Pone nombre a una fila. Sin nombre previo, crea la paleta con los colores que ya tenía y vincula sus listas; con
 * nombre previo, la renombra y mueve los vínculos. Los colores no se pierden en ningún caso.
 */
export function conNombre(fila: FilaPaleta, nombre: string, listas: readonly ListaRespuestas[], { paletas, vinculos }: Mapas): Mapas {
  const n = nombre.trim();
  const p: MapaPaletas = { ...paletas };
  const v: VinculosPaletas = { ...vinculos };
  if (fila.clave) {
    if (fila.clave === n) return { paletas, vinculos };
    p[n] = { ...(p[fila.clave] ?? {}) };
    delete p[fila.clave];
    for (const [ln, k] of Object.entries(v)) if (k === fila.clave) v[ln] = n;
    return { paletas: p, vinculos: v };
  }
  const compartidas = listasCompartidas(listas);
  let sin = p;
  for (const g of fila.grupos) sin = sinColoresPropios(sin, { ...g, listas: vinculables(g, compartidas) }, listas);
  sin[n] = { ...fila.colores };
  for (const g of fila.grupos) for (const ln of vinculables(g, compartidas)) v[ln] = n;
  return { paletas: sin, vinculos: v };
}

/**
 * Junta la fila `origen` con `destino`: todas las listas de `origen` pasan a usar la paleta de `destino`. Si `destino`
 * aún no tiene nombre, recibe uno automático primero. Los colores que `destino` no tenga se toman de `origen`.
 */
export function conAgrupado(origen: FilaPaleta, destino: FilaPaleta, listas: readonly ListaRespuestas[], mapas: Mapas): Mapas {
  const clave = destino.clave ?? nombreLibre(destino.nombre, listas, mapas.paletas);
  const { paletas, vinculos } = destino.clave ? mapas : conNombre(destino, clave, listas, mapas);
  const p: MapaPaletas = { ...paletas };
  const v: VinculosPaletas = { ...vinculos };
  const tiene = new Set(Object.keys(p[clave] ?? {}).map(normalizarEtiquetaPaleta));
  const suma: Record<string, string> = { ...(p[clave] ?? {}) };
  for (const [o, c] of Object.entries(origen.colores)) if (!tiene.has(normalizarEtiquetaPaleta(o))) suma[o] = c;
  p[clave] = suma;
  const compartidas = listasCompartidas(listas);
  let sin = p;
  if (!origen.clave) for (const g of origen.grupos) sin = sinColoresPropios(sin, { ...g, listas: vinculables(g, compartidas) }, listas);
  else if (origen.clave !== clave) delete sin[origen.clave];
  for (const g of origen.grupos) {
    for (const ln of vinculables(g, compartidas)) v[ln] = clave;
    // Las compartidas no se vinculan: reciben los colores de la paleta en la suya.
    sin = conColoresDelGrupo(sin, soloCompartidas(g, compartidas), listas, Object.fromEntries(g.opciones.map((o) => [o, suma[o] ?? origen.colores[o] ?? null])));
  }
  return { paletas: sin, vinculos: v };
}

/** Separa un grupo de su paleta con nombre: vuelve a tener sus propios colores, copiados de la paleta. */
export function conSeparado(fila: FilaPaleta, grupo: GrupoRespuestas, listas: readonly ListaRespuestas[], { paletas, vinculos }: Mapas): Mapas {
  const v: VinculosPaletas = { ...vinculos };
  for (const ln of grupo.listas) delete v[ln];
  const colores = Object.fromEntries(grupo.opciones.map((o) => [o, fila.colores[o] ?? null]));
  return { paletas: conColoresDelGrupo(paletas, grupo, listas, colores), vinculos: v };
}

/** Pinta una fila: en su paleta con nombre o, sin nombre, en las listas de su grupo. */
export function conColoresDeFila(fila: FilaPaleta, colores: Record<string, string | null>, listas: readonly ListaRespuestas[], paletas: MapaPaletas): MapaPaletas {
  if (!fila.clave) return fila.grupos.reduce((acc, g) => conColoresDelGrupo(acc, g, listas, colores), paletas);
  const actual = { ...(paletas[fila.clave] ?? {}) };
  for (const [o, c] of Object.entries(colores)) {
    const existente = Object.keys(actual).find((k) => normalizarEtiquetaPaleta(k) === normalizarEtiquetaPaleta(o)) ?? o;
    if (c) actual[existente] = c;
    else delete actual[existente];
  }
  const compartidas = listasCompartidas(listas);
  return fila.grupos.reduce((acc, g) => conColoresDelGrupo(acc, soloCompartidas(g, compartidas), listas, colores), { ...paletas, [fila.clave]: actual } as MapaPaletas);
}

function nombreLibre(base: string, listas: readonly ListaRespuestas[], paletas: MapaPaletas): string {
  const usados = nombresDeListas(listas);
  let n = base;
  for (let i = 2; usados.has(n) || n in paletas; i += 1) n = `${base} (${i})`;
  return n;
}

/** La fila y el grupo de una pregunta (`base$var` o `var`), para la tarjeta del gráfico. */
export function paletaDeLaPregunta(filas: readonly FilaPaleta[], ref: string): { fila: FilaPaleta; grupo: GrupoRespuestas } | null {
  const nombre = ref.split("$").pop() ?? ref;
  for (const fila of filas) {
    for (const grupo of fila.grupos) {
      if (grupo.preguntas.some((p) => p.ref === ref)) return { fila, grupo };
    }
  }
  // Sin base en la referencia (informe de una base): basta el nombre de la pregunta.
  if (ref.includes("$")) return null;
  for (const fila of filas) {
    for (const grupo of fila.grupos) {
      if (grupo.preguntas.some((p) => (p.ref.split("$").pop() ?? p.ref) === nombre)) return { fila, grupo };
    }
  }
  return null;
}

/**
 * Pasa SÓLO el grupo de una pregunta a la paleta `destino` (elegida desde la tarjeta de un gráfico). Si el grupo estaba
 * dentro de otra paleta con nombre, primero se separa de ella; las demás preguntas de esa paleta no cambian.
 */
export function conGrupoEnPaleta(fila: FilaPaleta, grupo: GrupoRespuestas, destino: FilaPaleta, listas: readonly ListaRespuestas[], mapas: Mapas): Mapas {
  if (fila.clave && fila.clave === destino.clave) return mapas;
  const colores: Record<string, string> = {};
  for (const o of grupo.opciones) if (fila.colores[o]) colores[o] = fila.colores[o];
  const base = fila.clave ? conSeparado(fila, grupo, listas, mapas) : mapas;
  const origen: FilaPaleta = { ...fila, id: `grupo:${grupo.id}`, clave: null, grupos: [grupo], opciones: [...grupo.opciones], colores, preguntas: [...grupo.preguntas], bases: [...grupo.bases], faltan: 0 };
  return conAgrupado(origen, destino, listas, base);
}

/**
 * Los colores con que se completa lo que le falta a una paleta: primero el que esa respuesta ya tiene en otra lista del
 * mismo grupo (para no cambiar lo que ya se ve en otros gráficos), y si no hay, el de la primera combinación de la marca.
 */
export function coloresParaCompletar(fila: FilaPaleta): Record<string, string> {
  const sugerida = combinacionesPara(fila.opciones)[0]?.colores ?? {};
  const out: Record<string, string> = {};
  for (const o of fila.opciones) {
    if (fila.colores[o]) continue;
    const ya = fila.grupos.map((g) => g.enAlguna[o]).find(Boolean);
    const c = ya ?? sugerida[o];
    if (c) out[o] = c;
  }
  return out;
}
