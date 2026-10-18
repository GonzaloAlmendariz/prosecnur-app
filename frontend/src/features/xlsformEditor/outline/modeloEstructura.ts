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

export type NodoArbol = NodoFila | NodoSeccion;
export type NodoFila = { tipo: "fila"; nodo: BuilderNode };
export type NodoSeccion = {
  tipo: "seccion";
  nodo: BuilderNode;
  hijos: NodoArbol[];
  /** Índice de inserción del final de la sección (la fila de su cierre). */
  finSlot: number;
};
export type ArbolEstructura = { hijos: NodoArbol[]; finSlot: number };

const esBloque = (n: BuilderNode) => n.kind === "section" || n.kind === "repeat";

/** Última fila del bloque de `row` (su cierre si es una sección; ella misma si es una pregunta). */
export function finDeBloque(structure: BuilderStructure, row: number): number {
  return structure.spans.get(row)?.end ?? row;
}

export function construirArbol(structure: BuilderStructure | null): ArbolEstructura {
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
  return raiz;
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
      if (si || dentro.length) out.push({ ...h, hijos: dentro });
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
    return n ? `«${tituloDe(n)}»` : null;
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
  fila: number;
  tipo: "fila" | "seccion";
  /** Apertura de la sección que la contiene (null = el formulario). */
  contenedor: number | null;
  /** Para una sección: si muestra su contenido. */
  abierta: boolean;
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
  const prev = lineas[siguiente - 1];
  if (!prev) return L ? { indice: L.fila, contenedor: L.contenedor } : null;
  if (prev.tipo === "fila") return { indice: prev.fila + 1, contenedor: prev.contenedor };
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
  const n = (v: number, uno: string, varios: string) => `${v.toLocaleString("es-PE")} ${v === 1 ? uno : varios}`;
  return `${n(preguntas, "pregunta", "preguntas")} en ${n(secciones, "sección", "secciones")}`;
}
