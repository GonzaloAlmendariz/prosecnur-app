// Disposición de una ramificación insertada en el lienzo (ADR 0047).
//
// Insertar seis piezas sueltas y apiladas no es un mapa: es un montón. Lo que
// convierte un puñado de tarjetas en una RAMIFICACIÓN son dos cosas, y las dos
// se calculan acá:
//
//   1. Las piezas se ordenan por PROFUNDIDAD en el árbol de la app. Un módulo
//      arriba, sus secciones debajo, sus pestañas más abajo. La posición dice
//      la jerarquía sin que haya que leer una etiqueta.
//   2. Se dibuja una arista de cada pieza a su ANCESTRO MÁS CERCANO PRESENTE.
//      No al padre inmediato: si traes «Monitoreo» y «Monitoreo · Territorial ·
//      Avance» sin el modo intermedio, la arista tiene que existir igual. Si no,
//      la ramificación aparece cortada por una pieza que el usuario decidió no
//      traer.
//
// Puro y sin React: vitest corre en Node sin DOM, así que la decisión se prueba
// acá y el componente solo la cablea.

import { padreDe } from "../arbolDeLaApp";
import type { CanvasArista, CanvasNodo } from "../../../api/bitacora";

/** Una pieza de la app cabe en una línea y media; un hito o una entrada no. */
export const ALTO_PIEZA = 72;
export const ALTO_DATO = 118;
export const ANCHO_NODO = 240;

const PASO_X = 268;
const PASO_Y = 96;

export type PiezaAInsertar = {
  target_type: "modulo" | "tarea" | "entrada";
  target_id: string;
  titulo: string;
};

export type Ramificacion = { nodes: CanvasNodo[]; edges: CanvasArista[] };

/**
 * @param origen punto de mundo donde nace la ramificación (el centro de la vista).
 * @param sufijo semilla de ids; el llamador pasa algo único por inserción.
 */
export function disponerRamificacion(
  piezas: PiezaAInsertar[],
  origen: { x: number; y: number },
  sufijo: string,
): Ramificacion {
  if (!piezas.length) return { nodes: [], edges: [] };

  const ordenadas = [...piezas].sort((a, b) => {
    const da = profundidad(a);
    const db = profundidad(b);
    if (da !== db) return da - db;
    return a.target_id.localeCompare(b.target_id);
  });

  const idPorDestino = new Map<string, string>();
  const porNivel = new Map<number, number>();
  const nodes: CanvasNodo[] = [];

  ordenadas.forEach((pieza, i) => {
    const nivel = profundidad(pieza);
    const columna = porNivel.get(nivel) ?? 0;
    porNivel.set(nivel, columna + 1);
    const alto = pieza.target_type === "modulo" ? ALTO_PIEZA : ALTO_DATO;
    const id = `nodo-${sufijo}-${i}`;
    idPorDestino.set(clave(pieza), id);
    nodes.push({
      id,
      type: "referencia",
      x: origen.x + columna * PASO_X,
      y: origen.y + nivel * PASO_Y,
      w: ANCHO_NODO,
      h: alto,
      z: 0,
      color: "neutro",
      text: pieza.titulo,
      ref: { target_type: pieza.target_type, target_id: pieza.target_id },
      links: [],
    });
  });

  const edges: CanvasArista[] = [];
  for (const pieza of ordenadas) {
    if (pieza.target_type !== "modulo") continue;
    const ancestro = ancestroPresente(pieza.target_id, idPorDestino);
    if (!ancestro) continue;
    const desde = idPorDestino.get(clave(pieza));
    if (!desde || desde === ancestro) continue;
    edges.push({
      id: `arista-${sufijo}-${edges.length}`,
      from_node: ancestro,
      from_anchor: "b",
      to_node: desde,
      to_anchor: "t",
      label: "",
      // La arista de una ramificación dice pertenencia, no dependencia: la
      // sección está DENTRO del módulo, no bloqueada por él.
      relation: "contiene",
    });
  }

  return { nodes, edges };
}

/** Sube por la clave hasta encontrar un ancestro que también se esté insertando. */
function ancestroPresente(destino: string, presentes: Map<string, string>): string | null {
  let actual: string | null = destino;
  while ((actual = padreDe(actual)) !== null) {
    const id = presentes.get(`modulo:${actual}`);
    if (id) return id;
  }
  return null;
}

/**
 * Cuántos niveles baja una pieza. Los hitos y las entradas no viven en el árbol
 * de la app: se cuelgan al final, que es donde se leen como anotaciones sobre
 * el mapa y no como parte de su estructura.
 */
function profundidad(pieza: PiezaAInsertar): number {
  if (pieza.target_type !== "modulo") return 9;
  const id = pieza.target_id;
  return (id.match(/\//g) ?? []).length + (id.includes("::") ? 1 : 0);
}

function clave(pieza: PiezaAInsertar): string {
  return `${pieza.target_type}:${pieza.target_id}`;
}
