// =============================================================================
// outline/modeloEstructura.ts — modelo puro de la Estructura del Constructor
// =============================================================================
// Rediseño del Constructor (2026-10-17, propuesta aprobada en dos columnas):
//   - las secciones y repeticiones son CONTENEDORES con sus hijos adentro; su cierre deja de ser una fila;
//   - buscar y filtrar conservan la jerarquía de secciones de los resultados;
//   - el arrastre cae en un «hueco» (índice de inserción del survey + contenedor que lo recibe) que se elige con
//     la misma regla de la propuesta: sobre una pregunta cae antes de ella; sobre la cabecera de una sección cae
//     justo después de la línea anterior (al final de la sección anterior, o primera dentro de una sección vacía).
// Sin React ni DOM: las posiciones en pantalla llegan como números.
// =============================================================================

import type { BuilderNode, BuilderStructure } from "../types";
import type { RowMovePlan } from "./outlineUtils";
import { formatoConteo } from "../../../lib/formatoNumero";

export type NodoArbol = NodoFila | NodoSeccion | NodoSorteo | NodoExperimento;
export type NodoFila = { tipo: "fila"; nodo: BuilderNode };
export type NodoSeccion = {
  tipo: "seccion";
  nodo: BuilderNode;
  hijos: NodoArbol[];
  /** Índice de inserción del final de la sección (la fila de su cierre). */
  finSlot: number;
};
/**
 * El sorteo de un par de un experimento de elección por pares (checklist elección por pares C5): sus cálculos
 * seguidos se ven como una sola línea plegable. `id` es negativo para no chocar con ninguna fila del survey.
 */
export type NodoSorteo = {
  tipo: "sorteo";
  id: number;
  /** Primer cálculo del sorteo. */
  nodo: BuilderNode;
  tarea: number;
  hijos: NodoFila[];
  /** Índice de inserción justo después del último cálculo. */
  finSlot: number;
};
/**
 * Un experimento (C7 y C11, 2026-11-07): su introducción y sus pares o viñetas se ven bajo una sola cabecera. Es sólo
 * de la Estructura: en el XLSForm cada par o viñeta sigue siendo su propia página, sin grupo que los contenga.
 */
export type NodoExperimento = {
  tipo: "experimento";
  id: number;
  titulo: string;
  /** «8 pares, 5 atributos». */
  resumen: string;
  /** Primera pieza del experimento (su introducción o el primer par). */
  nodo: BuilderNode;
  hijos: NodoArbol[];
  finSlot: number;
};
export type ArbolEstructura = { hijos: NodoArbol[]; finSlot: number };
/** Piezas de primer nivel de un experimento (introducción y grupos) y lo que dice su cabecera. */
export type ExperimentoEnEstructura = { filas: ReadonlySet<number>; titulo: string; resumen: string };

const BASE_EXPERIMENTO = 1_000_000;
export const idExperimento = (primeraFila: number) => -(BASE_EXPERIMENTO + primeraFila);
export const esIdExperimento = (id: number) => id <= -BASE_EXPERIMENTO;
export const filaDeIdExperimento = (id: number) => -id - BASE_EXPERIMENTO;

/** Id de la línea de un sorteo a partir de su primera fila (siempre negativo). */
export const idSorteo = (primeraFila: number) => -(primeraFila + 1);
export const filaDeIdSorteo = (id: number) => -id - 1;

/** Junta bajo una cabecera las piezas seguidas del experimento (introducción y pares) de un mismo contenedor. Si
 * algo ajeno queda en medio, no las junta: la cabecera mentiría sobre lo que contiene. */
function agruparExperimento(structure: BuilderStructure, hijos: NodoArbol[], exp: ExperimentoEnEstructura): NodoArbol[] {
  const filas = exp.filas;
  // Un sorteo cuenta si todos sus cálculos son del experimento (versiones y lista tienen el suyo en el primer nivel).
  const enHijos = hijos.map((h) =>
    h.tipo === "sorteo" ? h.hijos.every((f) => filas.has(f.nodo.rowIndex)) : h.tipo !== "experimento" && filas.has(h.nodo.rowIndex));
  const cubre = (h: NodoArbol) => (h.tipo === "sorteo" ? h.hijos.length : 1);
  const primero = enHijos.indexOf(true);
  if (primero >= 0) {
    const ultimo = enHijos.lastIndexOf(true);
    const tramo = hijos.slice(primero, ultimo + 1);
    const total = [...filas].length;
    if (enHijos.slice(primero, ultimo + 1).every(Boolean) && tramo.reduce((n, h) => n + cubre(h), 0) === total) {
      const fin = tramo[tramo.length - 1]!;
      const nodo: NodoExperimento = {
        tipo: "experimento",
        id: idExperimento(tramo[0]!.nodo.rowIndex),
        titulo: exp.titulo,
        resumen: exp.resumen,
        nodo: tramo[0]!.nodo,
        hijos: tramo,
        finSlot: finDeBloque(structure, fin.nodo.rowIndex) + 1,
      };
      return [...hijos.slice(0, primero), nodo, ...hijos.slice(ultimo + 1)];
    }
  }
  return hijos.map((h) => (h.tipo === "seccion" ? { ...h, hijos: agruparExperimento(structure, h.hijos, exp) } : h));
}

/** Junta en un NodoSorteo los cálculos seguidos de un mismo par. */
function agruparSorteo(hijos: NodoArbol[], tareaDe: (fila: number) => number | undefined): NodoArbol[] {
  const out: NodoArbol[] = [];
  for (const h of hijos) {
    if (h.tipo === "seccion") {
      out.push({ ...h, hijos: agruparSorteo(h.hijos, tareaDe) });
      continue;
    }
    const tarea = h.tipo === "fila" ? tareaDe(h.nodo.rowIndex) : undefined;
    const previo = out[out.length - 1];
    if (tarea == null || h.tipo !== "fila") {
      out.push(h);
    } else if (previo?.tipo === "sorteo" && previo.tarea === tarea && previo.finSlot === h.nodo.rowIndex) {
      previo.hijos.push(h);
      previo.finSlot = h.nodo.rowIndex + 1;
    } else {
      out.push({ tipo: "sorteo", id: idSorteo(h.nodo.rowIndex), nodo: h.nodo, tarea, hijos: [h], finSlot: h.nodo.rowIndex + 1 });
    }
  }
  return out;
}

const esBloque = (n: BuilderNode) => n.kind === "section" || n.kind === "repeat";

/** Última fila del bloque de `row` (su cierre si es una sección; ella misma si es una pregunta). */
export function finDeBloque(structure: BuilderStructure, row: number): number {
  return structure.spans.get(row)?.end ?? row;
}

export function construirArbol(
  structure: BuilderStructure | null,
  tareaDeSorteo?: (fila: number) => number | undefined,
  experimentos: readonly ExperimentoEnEstructura[] = [],
): ArbolEstructura {
  if (!structure) return { hijos: [], finSlot: 0 };
  const raiz: ArbolEstructura = { hijos: [], finSlot: 0 };
  const porSeccion = new Map<string, NodoArbol[]>([["root", raiz.hijos]]);
  for (const nodo of structure.outline) {
    const destino = porSeccion.get(nodo.sectionId) ?? raiz.hijos;
    if (esBloque(nodo)) {
      const meta = structure.sections.get(`section-${nodo.rowIndex}`);
      const finSlot = meta?.endRowIndex ?? finDeBloque(structure, nodo.rowIndex) + 1;
      const seccion: NodoSeccion = { tipo: "seccion", nodo, hijos: [], finSlot };
      porSeccion.set(`section-${nodo.rowIndex}`, seccion.hijos);
      destino.push(seccion);
    } else {
      destino.push({ tipo: "fila", nodo });
    }
  }
  const ultimo = raiz.hijos[raiz.hijos.length - 1];
  raiz.finSlot = ultimo ? finDeBloque(structure, ultimo.nodo.rowIndex) + 1 : 0;
  const conSorteo = tareaDeSorteo ? agruparSorteo(raiz.hijos, tareaDeSorteo) : raiz.hijos;
  const hijos = experimentos.reduce((acc, e) => (e.filas.size ? agruparExperimento(structure, acc, e) : acc), conSorteo);
  return { ...raiz, hijos };
}

/** Cuenta las piezas que no son secciones; con `cuenta`, sólo las que cumplen (p. ej. las mismas preguntas que el
 * subtítulo de la Estructura, para que «N de M» y el subtítulo digan el mismo M). */
export function contarPiezas(hijos: readonly NodoArbol[], cuenta?: (nodo: BuilderNode) => boolean): number {
  let n = 0;
  for (const h of hijos) {
    if (h.tipo === "fila") n += !cuenta || cuenta(h.nodo) ? 1 : 0;
    else n += contarPiezas(h.hijos, cuenta);
  }
  return n;
}

// -----------------------------------------------------------------------------
// Buscar y filtrar
// -----------------------------------------------------------------------------

export type FiltroRapido = "todas" | "cond" | "oblig" | "regla" | "sinLista" | "aviso";

export const FILTROS_RAPIDOS: readonly { id: FiltroRapido; rotulo: string; titulo: string; frase: string }[] = [
  { id: "todas", rotulo: "Todas", titulo: "Todas las piezas", frase: "" },
  { id: "cond", rotulo: "Con condición", titulo: "Preguntas y secciones con condición propia", frase: "con condición" },
  { id: "oblig", rotulo: "Obligatorias", titulo: "Preguntas obligatorias", frase: "obligatorias" },
  { id: "regla", rotulo: "Con restricción", titulo: "Preguntas con restricción", frase: "con restricción" },
  { id: "sinLista", rotulo: "Sin lista", titulo: "Selecciones sin lista de opciones", frase: "sin lista" },
  { id: "aviso", rotulo: "Con aviso", titulo: "Piezas con un aviso", frase: "con aviso" },
];

export type HechosFila = { cond: boolean; oblig: boolean; regla: boolean; sinLista: boolean; aviso: boolean };
export type CriteriosFiltro = { consulta: string; filtro: FiltroRapido };

/** Minúsculas y sin tildes: «Educación» casa con «educacion». */
export function normalizarBusqueda(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function filtroActivo(c: CriteriosFiltro): boolean {
  return c.filtro !== "todas" || normalizarBusqueda(c.consulta) !== "";
}

export type ResultadoFiltro = {
  arbol: ArbolEstructura;
  /** Con búsqueda de texto: preguntas del resultado (el mismo M que el subtítulo). Con un filtro rápido: líneas que
   * llevan la marca, de cualquier tipo (para «Con aviso», exactamente las que muestran el punto). */
  coinciden: number;
  total: number;
  activo: boolean;
  /** Hay un filtro rápido: «N con aviso» en vez de «N de M». */
  porMarca: boolean;
};

/**
 * Poda el árbol a lo que casa con la búsqueda (texto en la etiqueta o el código) y el filtro rápido. Los resultados
 * siempre se leen dentro de su sección.
 *  - Sólo texto: una sección que casa se conserva con todo su contenido; si casa algo adentro, sólo con eso.
 *  - Con un filtro rápido (una marca): cuenta cada línea que LLEVA la marca, y una sección sólo trae adentro las
 *    líneas que también la llevan. Antes una sección con aviso arrastraba todo su contenido al resultado y al
 *    conteo («Con aviso (217)» con 98 puntos a la vista).
 */
export function filtrarArbol(
  arbol: ArbolEstructura,
  criterios: CriteriosFiltro,
  hechos: (nodo: BuilderNode) => HechosFila,
  textoDe: (nodo: BuilderNode) => string,
  cuenta?: (nodo: BuilderNode) => boolean,
): ResultadoFiltro {
  const total = contarPiezas(arbol.hijos, cuenta);
  if (!filtroActivo(criterios)) return { arbol, coinciden: total, total, activo: false, porMarca: false };
  const q = normalizarBusqueda(criterios.consulta);
  const porMarca = criterios.filtro !== "todas";
  let marcadas = 0;
  const casa = (nodo: BuilderNode) => {
    if (q && !normalizarBusqueda(`${textoDe(nodo)} ${nodo.name}`).includes(q)) return false;
    return criterios.filtro === "todas" || hechos(nodo)[criterios.filtro];
  };
  const podar = (hijos: readonly NodoArbol[]): NodoArbol[] => {
    const out: NodoArbol[] = [];
    for (const h of hijos) {
      const si = casa(h.nodo);
      if (si) marcadas += 1;
      if (h.tipo === "fila") {
        if (si) out.push(h);
        continue;
      }
      if (si && !porMarca) {
        out.push(h);
        continue;
      }
      const dentro = podar(h.hijos);
      if (si || dentro.length) {
        out.push(h.tipo === "sorteo" ? { ...h, hijos: dentro.filter((d): d is NodoFila => d.tipo === "fila") } : { ...h, hijos: dentro });
      }
    }
    return out;
  };
  const hijos = podar(arbol.hijos);
  return {
    arbol: { hijos, finSlot: arbol.finSlot },
    coinciden: porMarca ? marcadas : contarPiezas(hijos, cuenta),
    total,
    activo: true,
    porMarca,
  };
}

/** Dónde cae lo que se agrega con el «+» o la tecla Insert, en palabras (M3). */
export function textoDestino(
  structure: BuilderStructure,
  destino: { despuesDeFila: number | null; seccionFila: number | null },
  tituloDe: (nodo: BuilderNode) => string,
): string {
  const nombre = (fila: number | null) => {
    const n = fila == null ? null : structure.byRow.get(fila);
    return n ? `"${tituloDe(n)}"` : null;
  };
  if (destino.despuesDeFila != null) {
    const n = structure.byRow.get(destino.despuesDeFila);
    const t = nombre(destino.despuesDeFila);
    if (n && t) return n.kind === "section" || n.kind === "repeat" ? `Se agrega después de ${t}` : `Se agrega debajo de ${t}`;
  }
  const seccion = nombre(destino.seccionFila);
  return seccion ? `Se agrega al inicio de ${seccion}` : "Se agrega al inicio del formulario";
}

// -----------------------------------------------------------------------------
// Líneas visibles (teclado y arrastre)
// -----------------------------------------------------------------------------

export type Linea = {
  /** Fila del survey; en un sorteo, su id negativo. */
  fila: number;
  tipo: "fila" | "seccion" | "sorteo" | "experimento";
  /** Apertura de la sección que la contiene (null = el formulario). */
  contenedor: number | null;
  /** Para una sección o un sorteo: si muestra su contenido. */
  abierta: boolean;
  /** Para un sorteo o un experimento: primera fila y el índice justo después de la última. */
  inicio?: number;
  fin?: number;
};

/** Las líneas en el orden en que se ven, sin el contenido de las secciones plegadas ni el bloque `excluir`. */
export function lineasVisibles(
  arbol: ArbolEstructura,
  plegada: (fila: number) => boolean,
  excluir: number | null = null,
): Linea[] {
  const out: Linea[] = [];
  const recorrer = (hijos: readonly NodoArbol[], contenedor: number | null) => {
    for (const h of hijos) {
      const fila = h.nodo.rowIndex;
      if (fila === excluir) continue;
      if (h.tipo === "fila") {
        out.push({ fila, tipo: "fila", contenedor, abierta: false });
        continue;
      }
      if (h.tipo === "sorteo" || h.tipo === "experimento") {
        const abierto = !plegada(h.id);
        out.push({ fila: h.id, tipo: h.tipo, contenedor, abierta: abierto, inicio: fila, fin: h.finSlot });
        if (abierto) recorrer(h.hijos, contenedor);
        continue;
      }
      const abierta = !plegada(fila);
      out.push({ fila, tipo: "seccion", contenedor, abierta });
      if (abierta) recorrer(h.hijos, fila);
    }
  };
  recorrer(arbol.hijos, null);
  return out;
}

/** La línea vecina para las flechas (null en los bordes). */
export function lineaVecina(lineas: readonly Linea[], fila: number, dir: 1 | -1): Linea | null {
  const i = lineas.findIndex((l) => l.fila === fila);
  if (i < 0) return lineas[dir === 1 ? 0 : lineas.length - 1] ?? null;
  return lineas[i + dir] ?? null;
}

// -----------------------------------------------------------------------------
// Arrastre: hueco y plan
// -----------------------------------------------------------------------------

/** Dónde caerá lo arrastrado: índice de inserción en el survey ACTUAL y contenedor que lo recibe. */
export type Hueco = { indice: number; contenedor: number | null };

/**
 * Hueco para un puntero que quedó justo antes de `lineas[siguiente]` (`siguiente === lineas.length`: debajo de
 * todo). Sobre una pregunta cae antes de ella, en su sección. Sobre la cabecera de una sección (o debajo de todo)
 * cae justo después de la línea anterior: al final de su sección, primera dentro de una sección abierta, o después
 * de una sección plegada.
 */
export function huecoEntre(structure: BuilderStructure, lineas: readonly Linea[], siguiente: number): Hueco | null {
  const L = lineas[siguiente];
  if (L && L.tipo === "fila") return { indice: L.fila, contenedor: L.contenedor };
  if (L && (L.tipo === "sorteo" || L.tipo === "experimento")) return { indice: L.inicio!, contenedor: L.contenedor };
  const prev = lineas[siguiente - 1];
  if (!prev) return L ? { indice: L.fila, contenedor: L.contenedor } : null;
  if (prev.tipo === "fila") return { indice: prev.fila + 1, contenedor: prev.contenedor };
  if (prev.tipo === "sorteo" || (prev.tipo === "experimento" && !prev.abierta)) return { indice: prev.fin!, contenedor: prev.contenedor };
  if (prev.tipo === "experimento") return { indice: prev.inicio!, contenedor: prev.contenedor };
  if (prev.abierta) return { indice: prev.fila + 1, contenedor: prev.fila };
  return { indice: finDeBloque(structure, prev.fila) + 1, contenedor: prev.contenedor };
}

/** Índice de la primera línea cuyo centro queda por debajo del puntero (`centros` en el orden de `lineas`). */
export function siguienteBajoPuntero(centros: readonly number[], y: number): number {
  return siguienteBajoPunteroEn(centros.length, (i) => centros[i]!, y);
}

/**
 * Lo mismo leyendo sólo los centros que hacen falta: las líneas se ven en orden, así que sus centros crecen y basta
 * una búsqueda binaria (≈10 lecturas del DOM en vez de 800 por cuadro durante el arrastre).
 */
export function siguienteBajoPunteroEn(n: number, centro: (i: number) => number, y: number): number {
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (y < centro(mid)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** Plan para llevar el bloque de `desde` al índice de inserción `indice` (null si no se mueve o cae en sí mismo). */
export function planMoverA(structure: BuilderStructure, desde: number, indice: number): RowMovePlan | null {
  const span = structure.spans.get(desde);
  if (!span) return null;
  const count = span.end - span.start + 1;
  if (indice >= span.start && indice <= span.end + 1) return null;
  const insertAt = indice > span.end ? indice - count : indice;
  return { fromStart: span.start, count, insertAt, newStart: insertAt };
}

/** Subtítulo de la Estructura: «31 preguntas en 13 secciones». */
export function subtituloEstructura(preguntas: number, secciones: number): string {
  const n = (v: number, uno: string, varios: string) => `${formatoConteo(v)} ${v === 1 ? uno : varios}`;
  return `${n(preguntas, "pregunta", "preguntas")} en ${n(secciones, "sección", "secciones")}`;
}
