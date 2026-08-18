import type { MonitoreoRow } from "../../../../api/monitoreo";

/**
 * Cuánto de lo que falta se cierra yendo a las pocas aulas con más brecha.
 *
 * La pestaña Brechas listaba 168 aulas ordenadas por brecha y nada más. Con eso
 * no se puede contestar la pregunta con la que se reparte el equipo mañana:
 * **¿hay atajo?** — es decir, ¿unas pocas aulas concentran lo que falta, o está
 * repartido y hay que ir a casi todas?
 *
 * No lo contesta ninguna otra superficie: Avance reparte por facultad y por
 * estrato, que es *dónde*, no *en cuántas*.
 *
 * Medido sobre el fixture: las 5 aulas con más brecha suman 155 de 3 743, un
 * 4 %. Ese es el caso «no hay atajo», y decirlo vale porque la lista ordenada
 * por brecha sugiere lo contrario.
 */

export type ConcentracionDeBrecha = {
  /** Aulas con brecha abierta. */
  aulas: number;
  /** Lo que falta en total. */
  falta: number;
  /** Tramos acumulados: las `aulas` primeras cubren `cubre` de `falta`. */
  tramos: Array<{ aulas: number; cubre: number; pct: number }>;
  /** Cuántas aulas hacen falta para cubrir la mitad de lo que falta. */
  aulasParaLaMitad: number;
};

const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function concentracionDeBrecha(filas: ReadonlyArray<MonitoreoRow>): ConcentracionDeBrecha {
  const brechas = filas
    .map((f) => numero(f.brecha))
    .filter((b) => b > 0)
    .sort((a, b) => b - a);

  const falta = brechas.reduce((suma, b) => suma + b, 0);
  const vacio = { aulas: brechas.length, falta, tramos: [], aulasParaLaMitad: 0 };
  if (!falta) return vacio;

  // Los cortes son de operativo, no estadísticos: «diez aulas» y «un cuarto de
  // ellas» es lo que alguien puede repartir mañana. Se saltan los que no caben
  // —un estudio de 8 aulas no tiene un tramo de 20—.
  const cortes = [5, 10, 20, Math.ceil(brechas.length / 4)]
    .filter((n, i, todos) => n > 0 && n < brechas.length && todos.indexOf(n) === i)
    .sort((a, b) => a - b);

  let acumulado = 0;
  let aulasParaLaMitad = brechas.length;
  const acumulados: number[] = [];
  for (let i = 0; i < brechas.length; i += 1) {
    acumulado += brechas[i];
    acumulados.push(acumulado);
    if (acumulado >= falta / 2 && aulasParaLaMitad === brechas.length) aulasParaLaMitad = i + 1;
  }

  return {
    aulas: brechas.length,
    falta,
    tramos: cortes.map((n) => ({
      aulas: n,
      cubre: acumulados[n - 1],
      pct: Math.round((100 * acumulados[n - 1]) / falta),
    })),
    aulasParaLaMitad,
  };
}
