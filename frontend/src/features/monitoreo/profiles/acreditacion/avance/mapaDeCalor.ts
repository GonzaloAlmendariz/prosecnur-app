/**
 * Mapa de calor de Avance › Ritmo: efectivas de cada público por semana
 * (semanas de lunes a domingo). Puro y con test.
 */

import { diaDeLaSemana, type SerieApilada } from "./ritmoModelo";

export type MapaDeCalor = {
  semanas: string[];
  filas: Array<{ publico: string; valores: number[] }>;
  maximo: number;
};

/** El lunes de la semana de una fecha. */
export function lunesDe(iso: string) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - diaDeLaSemana(iso) * 86400000).toISOString().slice(0, 10);
}

export function mapaPorSemana(serie: SerieApilada): MapaDeCalor {
  const semanas = [...new Set(serie.fechas.map(lunesDe))];
  const indice = new Map(semanas.map((semana, posicion) => [semana, posicion]));
  const filas = serie.capas.map((capa) => {
    const valores = semanas.map(() => 0);
    capa.valores.forEach((valor, posicion) => {
      const columna = indice.get(lunesDe(serie.fechas[posicion]));
      if (columna != null) valores[columna] += valor;
    });
    return { publico: capa.publico, valores };
  });
  return { semanas, filas, maximo: Math.max(0, ...filas.flatMap((fila) => fila.valores)) };
}
