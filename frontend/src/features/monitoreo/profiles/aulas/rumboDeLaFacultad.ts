import type { MonitoreoRow } from "../../../../api/monitoreo";
import { serieDeRendimiento } from "./serieDeRendimiento";

/**
 * **El rumbo de una facultad: su deuda al cierre de cada jornada.**
 *
 * La nota del ensayo que esto cierra: *«una foto no dice el rumbo. La serie de
 * tres jornadas separa a la que debe siete y venía debiendo veinte de la que
 * debe siete y venía en cero. La primera se está arreglando sola»*.
 *
 * El ranking enseña la deuda de HOY, y dos facultades con la misma cifra pueden
 * estar en situaciones opuestas. Con la serie, una pide paciencia y la otra
 * pide un refuerzo.
 *
 * **Esta casilla estuvo marcada «falta el dato» y no faltaba.** La serie por
 * día ya existe —`serieDeRendimiento` devuelve `dias` con elegibles, efectivas
 * y su reparto por sexo— y lo que faltaba era derivar de ella la deuda
 * acumulada. Es la segunda casilla del mismo checklist que se bloqueó sin
 * comprobar el payload.
 *
 * **Qué es aquí la deuda de un día**: lo que se esperaba de las aulas visitadas
 * HASTA ese día menos lo que se consiguió. El esperado sale de los elegibles
 * por la tasa prevista de la facultad, que es la misma vara con la que el
 * ranking la juzga. No es la cuota —ésa se mide sobre respuestas atribuidas a
 * un curso-horario y mezclar las dos fuentes ya rompió un gráfico de este
 * perfil—, y por eso el rótulo dice «contra lo previsto» y no «de su cuota».
 */

export type JornadaDeLaFacultad = {
  fecha: string;
  /** Deuda acumulada al cierre de ese día: positiva es deber. */
  deuda: number;
  efectivas: number;
  elegibles: number;
};

export type RumboDeFacultad = {
  jornadas: JornadaDeLaFacultad[];
  /** Cuánto ha cambiado la deuda entre la primera jornada y la última. */
  cambio: number;
  /**
   * Qué está pasando, en una palabra. `null` con menos de dos jornadas: con una
   * sola no hay rumbo que declarar, y decir «estable» sería inventarlo.
   */
  verbo: "mejora" | "empeora" | "estable" | null;
};

const MINIMO_PARA_RUMBO = 2;

export function rumboDeLaFacultad(
  partes: ReadonlyArray<MonitoreoRow>,
  plan: ReadonlyArray<MonitoreoRow>,
  facultad: string,
  /** La tasa prevista de esa facultad, la misma con la que el ranking la juzga. */
  prevista: number | null,
): RumboDeFacultad {
  const vacio: RumboDeFacultad = { jornadas: [], cambio: 0, verbo: null };
  if (!facultad || !prevista || prevista <= 0) return vacio;

  const serie = serieDeRendimiento(partes, plan);
  const suya = serie.facultades.find((f) => f.facultad === facultad);
  if (!suya || suya.dias.length < MINIMO_PARA_RUMBO) return vacio;

  let elegibles = 0;
  let efectivas = 0;
  const jornadas = suya.dias.map((d) => {
    elegibles += d.elegibles;
    efectivas += d.efectivas;
    return {
      fecha: d.fecha,
      // Positiva es deber. Se deja negativa cuando va por encima: el cero no es
      // un suelo, y recortarlo escondería a la que va sobrada.
      deuda: Math.round(elegibles * prevista - efectivas),
      efectivas,
      elegibles,
    };
  });

  const cambio = jornadas[jornadas.length - 1].deuda - jornadas[0].deuda;
  // El umbral es una respuesta: por debajo de eso la diferencia es ruido de
  // redondeo entre dos días, no un rumbo.
  const verbo = cambio <= -1 ? "mejora" : cambio >= 1 ? "empeora" : "estable";
  return { jornadas, cambio, verbo };
}

/** La frase del rumbo, en el vocabulario del operativo. */
export function palabraDelRumbo(r: RumboDeFacultad): string {
  if (!r.verbo || !r.jornadas.length) return "";
  const primera = r.jornadas[0].deuda;
  const ultima = r.jornadas[r.jornadas.length - 1].deuda;
  if (r.verbo === "mejora") {
    // El caso del ensayo: «debe siete y venía debiendo veinte» — se está
    // arreglando sola y pedirle un refuerzo sería gastarlo de más.
    return ultima <= 0
      ? `se puso al día: venía debiendo ${Math.abs(primera)}`
      : `se está arreglando: venía debiendo ${primera}`;
  }
  if (r.verbo === "empeora") {
    return primera <= 0
      ? `se torció: empezó sin deber y ya debe ${ultima}`
      : `va a peor: venía debiendo ${primera}`;
  }
  return "sin movimiento entre jornadas";
}
