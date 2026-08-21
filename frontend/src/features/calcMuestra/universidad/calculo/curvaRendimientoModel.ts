/**
 * La curva de rendimiento por tamaño de aula, reconstruida desde lo que el
 * motor publica por facultad.
 *
 * Gonzalo, sobre la tarjeta de tasas: «¿a qué se refiere con un mix de
 * tamaños? Hay que ser un poco más claros con eso… Incluso la parte del pie de
 * página donde sale de dónde sale cada tasa, creo que no tiene por qué ser
 * texto, sino podría ser tranquilamente un diagrama mejor explicado».
 *
 * La curva es el principio del que sale todo: un aula chica entrega una
 * proporción mayor de sus elegibles que una grande. Cada facultad tiene su
 * propia mezcla de aulas a lo largo de esa curva —eso es su «mix»— y su tasa
 * es el promedio de la curva ponderado por esa mezcla.
 *
 * No se codifica acá: se DERIVA de los tramos que cada facultad publica, así
 * que si el estudio sella su propia curva el diagrama la muestra sin tocar una
 * línea de este archivo (un dueño, el motor).
 */
import type { TramoMix } from "../../../../api/calcMuestraTasasFacultad";

export type PeldanoCurva = {
  /** Lo que rinde un aula de este tramo (0-1). */
  tasa: number;
  /** Aulas del marco entero que caen en el tramo. */
  nAulas: number;
  /** Rango de elegibles observado en el tramo, a lo ancho de las facultades. */
  desde: number;
  hasta: number;
  /** Parte del marco que representa el tramo (0-1), para dibujar su peso. */
  parte: number;
};

/**
 * Une los tramos de todas las facultades en una sola curva. Devuelve [] si el
 * motor no publica tramos: el diagrama no se dibuja y no se inventa una curva
 * de ejemplo, que sería peor que no mostrar nada.
 */
export function curvaRendimiento(porFacultad: Array<{ tramos: TramoMix[] }>): PeldanoCurva[] {
  const acc = new Map<number, { nAulas: number; desde: number; hasta: number }>();
  for (const f of porFacultad) {
    for (const t of f.tramos ?? []) {
      // La tasa del tramo es la clave: es la misma curva para todas las
      // facultades, lo que cambia es cuántas aulas pone cada una en cada peldaño.
      const previo = acc.get(t.tasa);
      if (previo) {
        previo.nAulas += t.n_aulas;
        previo.desde = Math.min(previo.desde, t.desde);
        previo.hasta = Math.max(previo.hasta, t.hasta);
      } else {
        acc.set(t.tasa, { nAulas: t.n_aulas, desde: t.desde, hasta: t.hasta });
      }
    }
  }
  const total = Array.from(acc.values()).reduce((s, v) => s + v.nAulas, 0);
  if (!total) return [];
  return Array.from(acc.entries())
    // Por tamaño creciente, que es como se lee una curva de rendimiento: las
    // aulas chicas primero, porque son las que más rinden.
    .sort((a, b) => a[1].desde - b[1].desde)
    .map(([tasa, v]) => ({
      tasa,
      nAulas: v.nAulas,
      desde: v.desde,
      hasta: v.hasta,
      parte: v.nAulas / total,
    }));
}

/** Etiqueta legible del rango de un peldaño («hasta 15», «16 a 25», «más de 50»). */
export function etiquetaPeldano(p: PeldanoCurva, esUltimo: boolean, esPrimero: boolean): string {
  if (esPrimero) return `hasta ${p.hasta}`;
  if (esUltimo) return `más de ${p.desde - 1}`;
  return `${p.desde} a ${p.hasta}`;
}
