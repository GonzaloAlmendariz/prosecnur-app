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
  /**
   * Los descuentos que NINGÚN parte declara.
   *
   * No es lo mismo «no hubo rechazos» que «nadie los anotó», y el embudo
   * dibujaba lo segundo como lo primero: con los 152 partes sin rechazos ni
   * duplicados la cadena salía `4.386 → 4.386 → 4.386 · 100 %`.
   */
  pasosSinDeclarar: string[];
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
  // **Un paso que NADIE declara no es un paso de cero.**
  //
  // `num()` convierte la ausencia en 0, así que un parte sin rechazos ni
  // duplicados producía la cadena `4.386 → 4.386 → 4.386 · 100 %`: el embudo
  // afirmaba conversión total cuando lo que pasa es que esos dos pasos no se
  // anotaron. Visto en pantalla sobre «campo malo», donde los 152 partes traen
  // asistentes y efectivas pero ninguno de los dos descuentos, y el aviso de
  // debajo ya decía que el equipo declaró 2.791 menos de lo que implica la
  // cadena. Se cuenta cuántos partes lo declaran para poder decirlo.
  let conRechazos = 0;
  let conDuplicados = 0;
  for (const f of filas) {
    asistentes += num(f.observed_students);
    rechazos += num(f.refusals);
    duplicados += num(f.duplicates);
    declaradas += num(f.effective_surveys);
    if (f.refusals != null && f.refusals !== "" && Number.isFinite(Number(f.refusals))) conRechazos += 1;
    if (f.duplicates != null && f.duplicates !== "" && Number.isFinite(Number(f.duplicates))) conDuplicados += 1;
  }

  const vacio = { partes: filas.length, asistentes: 0, pasos: [], pasosSinDeclarar: [], declaradas, descuadre: 0 };
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
      // Los dos descuentos sólo entran si ALGÚN parte los declara. Sin eso el
      // paso no dice «no hubo rechazos», dice «nadie lo anotó», y dibujarlo
      // afirma lo primero.
      ...(conRechazos
        ? [{ clave: "rechazos", etiqueta: "Sin los que no quisieron responder", quedan: trasRechazos, pierde: rechazos, pct: pct(trasRechazos) }]
        : []),
      ...(conDuplicados
        ? [{ clave: "duplicados", etiqueta: "Sin los que ya habían respondido", quedan: trasDuplicados, pierde: duplicados, pct: pct(trasDuplicados) }]
        : []),
    ],
    /** Cuántos partes declaran cada descuento, para poder decir qué falta. */
    pasosSinDeclarar: [
      ...(conRechazos ? [] : ["los que no quisieron responder"]),
      ...(conDuplicados ? [] : ["los que ya habían respondido"]),
    ],
    declaradas,
    // Lo que la cadena implica contra lo que el equipo escribió. No se corrige
    // ninguno de los dos: el cuadre es de ellos y esto sólo lo dice.
    // Sin los dos descuentos la cadena no implica nada, y restar sobre ella
    // producia un descuadre de 2.791 que era el hueco de los pasos que faltan,
    // no un desajuste del equipo.
    descuadre: conRechazos && conDuplicados ? declaradas - trasDuplicados : 0,
  };
}
