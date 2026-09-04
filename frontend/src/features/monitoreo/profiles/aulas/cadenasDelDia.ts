/**
 * **Las secuencias de un día: qué citas seguidas hace la MISMA persona.**
 *
 * Dictado del 2026-09-04: «sería bueno tener algún tipo de raíz o conexión que
 * aparezca cuando haya más de una aplicación seguida, es decir que la misma
 * persona haga en el día, para poder mapear esas secuencias, sabiendo que puede
 * haber más de una en el día. Estaba pensando en algo parecido a la lógica del
 * mapeo en la edición del módulo de creación del instrumento».
 *
 * La tabla del día está ordenada POR HORA, así que las citas de una persona
 * casi nunca son filas contiguas: entre las dos suyas hay las de otros. Leer
 * «¿a dónde va Chamorro después de J308?» obligaba a recorrer la columna
 * Aplicador buscando el mismo nombre. La cadena lo dibuja: una línea que baja
 * por un carril propio desde su primera cita del día hasta la última, con un
 * nodo en cada parada suya.
 *
 * Tres decisiones, y las tres vienen de que el reparto YA concentra:
 *
 * - **Sólo con dos o más.** Una cita suelta no es una secuencia; dibujarle una
 *   raíz llenaría la tabla de líneas de un solo punto, que es ruido.
 * - **La cadena abarca de la primera a la última**, y pasa POR las filas de
 *   otros. Cortarla en los huecos diría «aquí termina y allá empieza otra»,
 *   que es lo contrario de lo que se quiere leer.
 * - **Un carril por cadena que se solape con otra.** Igual que el grafo de
 *   lógica del editor de instrumento, dos relaciones que conviven en el mismo
 *   tramo no pueden compartir línea. El reparto de carriles es el coloreo
 *   codicioso de intervalos de toda la vida: se reusa el primer carril libre.
 *
 * El tono sale del ORDEN de aparición dentro del día, no de un hash del
 * nombre: así dos cadenas vecinas nunca caen en el mismo color, que es
 * exactamente lo que hace `colorIndex` en `canvas-graph/GraphEdgeArrow`.
 */
import type { DiaDeReparto } from "./repartoDeAplicadores";

/** Los ocho tonos del Sistema Pabellón, que ya viven en `theme.css`. */
const TONOS = 8;

export type CadenaDelDia = {
  /** El nombre CRUDO: es la identidad con la que se cruza con el reparto. */
  aplicador: string;
  /** Índices de fila (en el orden de `dia.asignaciones`) donde él aplica. */
  filas: number[];
  /** Primera y última fila que abarca la cadena, huecos incluidos. */
  desde: number;
  hasta: number;
  /** En qué carril se dibuja; 0 es el más pegado a la tabla. */
  carril: number;
  /** Índice de tono (0..7) por orden de aparición en el día. */
  tono: number;
};

export type CadenasDelDia = {
  cadenas: CadenaDelDia[];
  /** Cuántos carriles hacen falta; 0 = el día no tiene ninguna secuencia. */
  carriles: number;
};

/**
 * Las cadenas de un día, listas para dibujar.
 *
 * Un día sin nadie repetido devuelve `{cadenas: [], carriles: 0}`: la columna
 * del canalón no se pinta y la tabla queda como estaba.
 */
export function cadenasDelDia(dia: DiaDeReparto): CadenasDelDia {
  const porAplicador = new Map<string, number[]>();
  dia.asignaciones.forEach((a, i) => {
    if (!a.aplicador) return;
    const previas = porAplicador.get(a.aplicador);
    if (previas) previas.push(i);
    else porAplicador.set(a.aplicador, [i]);
  });

  const candidatas = [...porAplicador.entries()]
    .filter(([, filas]) => filas.length > 1)
    // Por dónde EMPIEZAN, que es el orden en que el lector las encuentra al
    // bajar por la tabla; el nombre sólo rompe empates para que sea estable.
    .sort((a, b) => a[1][0] - b[1][0] || a[0].localeCompare(b[0], "es"));

  // Coloreo codicioso: cada cadena toma el primer carril cuyo último ocupante
  // ya terminó antes de que ella empiece.
  const finDeCarril: number[] = [];
  const cadenas: CadenaDelDia[] = candidatas.map(([aplicador, filas], orden) => {
    const desde = filas[0];
    const hasta = filas[filas.length - 1];
    let carril = finDeCarril.findIndex((fin) => fin < desde);
    if (carril < 0) carril = finDeCarril.length;
    finDeCarril[carril] = hasta;
    return { aplicador, filas, desde, hasta, carril, tono: orden % TONOS };
  });

  return { cadenas, carriles: finDeCarril.length };
}

/** Qué dibuja UNA cadena en UNA fila. `null` = esa fila no le toca. */
export type TramoDeCadena = {
  /** La persona aplica aquí: el nodo de la secuencia. */
  parada: boolean;
  /** Primera y última parada suyas: la cadena redondea sus puntas ahí. */
  cabeza: boolean;
  cola: boolean;
};

/**
 * El tramo que le toca a `cadena` en la fila `i`, o `null` si la fila queda
 * fuera de su recorrido. Entre dos paradas suyas devuelve un tramo de paso
 * (`parada: false`): la línea cruza la cita de otro sin marcarla.
 */
export function tramoDeCadena(cadena: CadenaDelDia, i: number): TramoDeCadena | null {
  if (i < cadena.desde || i > cadena.hasta) return null;
  return {
    parada: cadena.filas.includes(i),
    cabeza: i === cadena.desde,
    cola: i === cadena.hasta,
  };
}
