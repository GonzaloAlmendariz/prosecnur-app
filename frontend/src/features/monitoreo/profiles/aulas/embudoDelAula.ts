import type { MonitoreoRow } from "../../../../api/monitoreo";

/**
 * De cuántos estaban en el aula a cuántas respuestas quedaron.
 *
 * El parte de campo recoge la cadena entera —asistentes, rechazos, duplicados,
 * efectivas— y la pestaña la enseñaba fila a fila. Sumada, esa cadena contesta
 * la pregunta con la que se juzga el trabajo de campo: **de cada cien personas
 * que estaban en el aula, cuántas respuestas salieron, y dónde se perdieron las
 * demás**.
 *
 * Medido sobre 210 partes: 5 390 asistentes, 210 rechazos, 315 duplicados,
 * 4 863 efectivas. Los duplicados pesan más que los rechazos, que es justo lo
 * que no se ve leyendo fila a fila.
 */

export type PasoDelEmbudo = {
  clave: string;
  etiqueta: string;
  /** Cuántas personas quedan DESPUÉS de este paso. */
  quedan: number;
  /** Cuántas se perdieron EN este paso. */
  pierde: number;
  /** Qué porcentaje del punto de partida representa lo que queda. */
  pct: number;
};

export type EmbudoDelAula = {
  partes: number;
  asistentes: number;
  pasos: PasoDelEmbudo[];
  /** Efectivas declaradas por el equipo, que no tienen por qué cuadrar. */
  declaradas: number;
  /** Diferencia entre lo que implica la cadena y lo declarado. */
  descuadre: number;
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function embudoDelAula(filas: ReadonlyArray<MonitoreoRow>): EmbudoDelAula {
  let asistentes = 0;
  let rechazos = 0;
  let duplicados = 0;
  let declaradas = 0;
  for (const f of filas) {
    asistentes += num(f.observed_students);
    rechazos += num(f.refusals);
    duplicados += num(f.duplicates);
    declaradas += num(f.effective_surveys);
  }

  const vacio = { partes: filas.length, asistentes: 0, pasos: [], declaradas, descuadre: 0 };
  if (!asistentes) return vacio;

  const trasRechazos = asistentes - rechazos;
  const trasDuplicados = trasRechazos - duplicados;
  const pct = (n: number) => Math.round((100 * n) / asistentes);

  return {
    partes: filas.length,
    asistentes,
    pasos: [
      // **El rotulo nombra la cifra GRANDE, que es lo que queda.** Decia «No
      // quisieron responder» junto a «4 650 −187», y el 4 650 no son los que no
      // quisieron: son los que siguen —los que no quisieron son 187—. El primer
      // paso funcionaba solo porque no tiene resta. Un rotulo pegado a un numero
      // que no es el suyo se lee mal aunque los dos numeros esten bien.
      { clave: "asistentes", etiqueta: "Estaban en el aula", quedan: asistentes, pierde: 0, pct: 100 },
      { clave: "rechazos", etiqueta: "Sin los que no quisieron responder", quedan: trasRechazos, pierde: rechazos, pct: pct(trasRechazos) },
      { clave: "duplicados", etiqueta: "Sin los que ya habían respondido", quedan: trasDuplicados, pierde: duplicados, pct: pct(trasDuplicados) },
    ],
    declaradas,
    // Lo que la cadena implica contra lo que el equipo escribió. No se corrige
    // ninguno de los dos: el cuadre es de ellos y esto sólo lo dice.
    descuadre: declaradas - trasDuplicados,
  };
}
