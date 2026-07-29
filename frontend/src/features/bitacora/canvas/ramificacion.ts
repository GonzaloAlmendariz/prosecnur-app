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

// La jerarquía crece HACIA LA DERECHA y los hermanos se apilan HACIA ABAJO.
//
// Al revés —niveles en filas, hermanos en columnas— la ramificación completa de
// Procesamiento ocupaba 9 columnas (~2.400 px) para 11 nodos y había que verla
// al 68% para que entrara: los rótulos quedaban ilegibles. Apilando, los mismos
// 11 nodos caben en 3 columnas por 5 filas y se leen a tamaño real. Es la
// orientación de un mapa mental, y no por gusto: un nodo es más de tres veces
// más ancho que alto, así que crecer a lo alto cuesta mucho menos espacio.
const PASO_X = 288;
const PASO_Y = 92;

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

  const idPorDestino = new Map<string, string>();
  piezas.forEach((p, i) => idPorDestino.set(clave(p), `nodo-${sufijo}-${i}`));

  // --- Bosque: cada pieza cuelga de su ancestro más cercano PRESENTE ---------
  const arbol = new Map<string, Rama>();
  for (const pieza of piezas) arbol.set(clave(pieza), { pieza, hijos: [], x: 0, y: 0 });

  const raices: Rama[] = [];
  const anotaciones: Rama[] = [];
  for (const pieza of piezas) {
    const rama = arbol.get(clave(pieza))!;
    // Un hito o una entrada no vive en el árbol de la app: es una anotación
    // sobre el mapa, y va en su propia fila al pie en vez de mezclarse con la
    // estructura.
    if (pieza.target_type !== "modulo") {
      anotaciones.push(rama);
      continue;
    }
    const padre = ancestroPresente(pieza.target_id, arbol);
    if (padre) padre.hijos.push(rama);
    else raices.push(rama);
  }

  // Orden estable: sin esto dos inserciones de las mismas piezas se dibujan
  // distinto según el orden en que el usuario las fue marcando.
  const ordenar = (r: Rama) => {
    r.hijos.sort((a, b) => a.pieza.titulo.localeCompare(b.pieza.titulo));
    r.hijos.forEach(ordenar);
  };
  raices.sort((a, b) => a.pieza.titulo.localeCompare(b.pieza.titulo));
  raices.forEach(ordenar);

  // --- Columnas: las hojas se reparten, cada padre se centra sobre las suyas --
  //
  // Es lo que hace legible una ramificación de verdad. Repartiendo por nivel
  // —cada fila llenada de izquierda a derecha sin mirar de quién cuelga— las
  // aristas cruzan todo el ancho: con 5 secciones y 5 pestañas de padres
  // distintos, el mapa se vuelve una maraña.
  let fila = 0;
  let filaMaxima = 0;
  const situar = (r: Rama, nivel: number) => {
    r.x = nivel;
    if (!r.hijos.length) {
      r.y = fila++;
      filaMaxima = Math.max(filaMaxima, r.y);
      return;
    }
    r.hijos.forEach((h) => situar(h, nivel + 1));
    r.y = (r.hijos[0].y + r.hijos[r.hijos.length - 1].y) / 2;
  };
  raices.forEach((r) => situar(r, 0));

  // Las anotaciones cierran el mapa, en una franja propia bajo el árbol.
  anotaciones.forEach((r, i) => {
    r.x = i;
    r.y = filaMaxima + 2;
  });

  const nodes: CanvasNodo[] = [];
  const emitir = (r: Rama) => {
    const alto = r.pieza.target_type === "modulo" ? ALTO_PIEZA : ALTO_DATO;
    nodes.push({
      id: idPorDestino.get(clave(r.pieza))!,
      type: "referencia",
      x: origen.x + r.x * PASO_X,
      y: origen.y + r.y * PASO_Y,
      w: ANCHO_NODO,
      h: alto,
      z: 0,
      color: "neutro",
      text: r.pieza.titulo,
      ref: { target_type: r.pieza.target_type, target_id: r.pieza.target_id },
      links: [],
    });
    r.hijos.forEach(emitir);
  };
  raices.forEach(emitir);
  anotaciones.forEach(emitir);

  const edges: CanvasArista[] = [];
  const conectar = (r: Rama) => {
    for (const hijo of r.hijos) {
      edges.push({
        id: `arista-${sufijo}-${edges.length}`,
        from_node: idPorDestino.get(clave(r.pieza))!,
        from_anchor: "r",
        to_node: idPorDestino.get(clave(hijo.pieza))!,
        to_anchor: "l",
        label: "",
        // La arista de una ramificación dice pertenencia, no dependencia: la
        // sección está DENTRO del módulo, no bloqueada por él.
        relation: "contiene",
      });
      conectar(hijo);
    }
  };
  raices.forEach(conectar);

  return { nodes, edges };
}

type Rama = { pieza: PiezaAInsertar; hijos: Rama[]; x: number; y: number };

/** Sube por la clave hasta encontrar un ancestro que también se esté insertando. */
function ancestroPresente(destino: string, presentes: Map<string, Rama>): Rama | null {
  let actual: string | null = destino;
  while ((actual = padreDe(actual)) !== null) {
    const rama = presentes.get(`modulo:${actual}`);
    if (rama) return rama;
  }
  return null;
}

function clave(pieza: PiezaAInsertar): string {
  return `${pieza.target_type}:${pieza.target_id}`;
}
