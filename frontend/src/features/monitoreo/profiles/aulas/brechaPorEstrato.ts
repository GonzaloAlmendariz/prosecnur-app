import type { MonitoreoRow } from "../../../../api/monitoreo";

/**
 * A qué facultad mandar el equipo mañana.
 *
 * El tablero ya calcula `avance_por_estrato`, pero como tabla contesta mal la
 * pregunta operativa: hay que leer diez filas y restar de cabeza. Lo que decide
 * el despliegue es **cuántas respuestas faltan**, en absoluto, no el porcentaje.
 * Un estrato al 50 % con 4 pendientes se cierra en una mañana; uno al 90 % con
 * 200 pendientes es la semana entera.
 *
 * Por eso se ordena por brecha descendente y no por nombre ni por avance: la
 * primera barra es el destino de mañana.
 */
export type EstratoConBrecha = {
  /** Nombre del estrato tal como lo declara el plan (facultad, normalmente). */
  estrato: string;
  /** Respuestas válidas ya recogidas. */
  validas: number;
  /** Respuestas que faltan para la meta del estrato. */
  brecha: number;
  /** Cursos-horario que lo componen; va al hover, no al eje. */
  aulas: number;
};

function numero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Ordena los estratos por lo que falta, y dice cuántos quedaron fuera.
 *
 * @param limite cuántas barras caben sin que el eje se vuelva ilegible.
 * @returns los `limite` estratos con más brecha, más `omitidos` y la brecha que
 *   se llevan. **Nunca se recorta en silencio**: el gráfico dice cuántos no
 *   dibujó y cuánto suman, porque si no, la barra más baja se lee como «el resto
 *   está cerrado» cuando puede ser lo contrario.
 */
export function brechaPorEstrato(filas: ReadonlyArray<MonitoreoRow>, limite = 12) {
  const estratos: EstratoConBrecha[] = [];
  for (const fila of filas) {
    const estrato = texto(fila.stratum) || texto(fila.estrato);
    if (!estrato) continue;
    estratos.push({
      estrato,
      validas: numero(fila.respuestas_validas),
      brecha: numero(fila.brecha),
      aulas: numero(fila.aulas),
    });
  }
  // Brecha descendente; a igualdad, el que más lleva recogido primero —está más
  // cerca de cerrar—. El nombre sólo desempata para que el orden sea estable.
  estratos.sort((a, b) => (b.brecha - a.brecha)
    || (b.validas - a.validas)
    || a.estrato.localeCompare(b.estrato, "es"));

  const visibles = estratos.slice(0, limite);
  const resto = estratos.slice(limite);
  return {
    estratos: visibles,
    omitidos: resto.length,
    brechaOmitida: resto.reduce((suma, e) => suma + e.brecha, 0),
    brechaTotal: estratos.reduce((suma, e) => suma + e.brecha, 0),
    cerrados: estratos.filter((e) => e.brecha <= 0).length,
    total: estratos.length,
  };
}
