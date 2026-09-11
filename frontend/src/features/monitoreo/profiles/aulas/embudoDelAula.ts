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
  /**
   * **El escalón de arriba: cuánta gente había en el padrón de esas aulas.**
   *
   * `null` cuando no se puede cruzar —sin plan, o con partes cuyo código no
   * aparece en él—. No saber cuánta gente había y saber que no había nadie son
   * cosas distintas, y un cero se leería como lo segundo.
   *
   * El denominador son SÓLO las aulas que tienen parte: sumar el padrón entero
   * compararía a los que estaban en veinte aulas contra los elegibles de
   * doscientas y daría una asistencia absurda.
   */
  padron: number | null;
  /** Cuántas aulas con parte no se pudieron cruzar con el plan. */
  sinCruzar: number;
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

const texto = (v: unknown) => (v == null ? "" : String(v).trim());

export function embudoDelAula(
  filas: ReadonlyArray<MonitoreoRow>,
  /**
   * El plan, para poder poner el escalón del PADRÓN encima del de asistencia.
   *
   * Es el escalón más caro del operativo y el que la tasa del aula lleva dentro
   * sin enseñarlo: de cuántos había convocados, cuántos aparecieron. Se pasa
   * aparte porque el parte no lo trae —sólo `observed_students`— y vive en
   * `eligible_n` de la fila del plan.
   */
  plan: ReadonlyArray<MonitoreoRow> = [],
): EmbudoDelAula {
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

  /**
   * El padrón de las aulas que tienen parte, cruzado por su código.
   *
   * Un aula con dos partes —las hay, con dos sesiones— cuenta su padrón UNA
   * vez: si no, la asistencia saldría por debajo de la mitad por duplicar el
   * denominador. De ahí el `Set`.
   */
  const porCodigo = new Map<string, number>();
  for (const f of plan) {
    const c = texto(f.operational_code) || texto(f.classroom_id);
    const n = num(f.eligible_n);
    if (c && n > 0) porCodigo.set(c, n);
  }
  let padron = 0;
  let sinCruzar = 0;
  const yaContadas = new Set<string>();
  for (const f of filas) {
    const c = texto(f.operational_code) || texto(f.classroom_id);
    const suyo = c ? porCodigo.get(c) : undefined;
    if (suyo == null) { sinCruzar += 1; continue; }
    if (yaContadas.has(c)) continue;
    yaContadas.add(c);
    padron += suyo;
  }
  // El escalón sólo se dibuja si se pudo cruzar TODO lo que tiene parte: con la
  // mitad sin cruzar, la asistencia sería un cociente entre dos conjuntos
  // distintos.
  const padronUtil = padron > 0 && sinCruzar === 0 ? padron : null;

  const vacio = {
    partes: filas.length, asistentes: 0, pasos: [], pasosSinDeclarar: [],
    declaradas, descuadre: 0, padron: padronUtil, sinCruzar,
  };
  if (!asistentes) return vacio;

  const trasRechazos = asistentes - rechazos;
  const trasDuplicados = trasRechazos - duplicados;
  // **Sin redondear en el modelo.** El porcentaje se redondeaba aquí a entero y
  // la frase publicaba «92%» mientras la columna «% asistencia» del MISMO panel
  // decía «89.3 %» y «93.5 %»: el mismo cociente —54 de 59— con dos formatos a
  // dos centímetros. Redondear es una decisión de presentación y se toma en la
  // vista, que además es donde vive el formato de la casa: un decimal y espacio
  // antes del «%».
  // El punto de partida es el padrón cuando se pudo cruzar, y si no la
  // asistencia. Con el padrón encima, «Estaban en el aula» ya no es el 100 %:
  // es justo la primera pérdida, que es lo que el escalón existe para enseñar.
  const arranque = padronUtil ?? asistentes;
  const pct = (n: number) => (100 * n) / arranque;

  return {
    partes: filas.length,
    asistentes,
    padron: padronUtil,
    sinCruzar,
    pasos: [
      // **El padrón, encima de la asistencia.** Es el escalón que la tasa del
      // aula lleva dentro sin enseñarlo, y el más caro del operativo: medido en
      // HSVG26ULT2, de 29 convocados en CH 2 aparecieron 22. Sin él, el embudo
      // empezaba dando por hecho que todos los convocados estaban en la sala.
      ...(padronUtil
        ? [{ clave: "padron", etiqueta: "Convocados en el padrón", quedan: padronUtil, pierde: 0, pct: 100 }]
        : []),
      // **El rotulo nombra la cifra GRANDE, que es lo que queda.** Decia «No
      // quisieron responder» junto a «4 650 −187», y el 4 650 no son los que no
      // quisieron: son los que siguen —los que no quisieron son 187—. El primer
      // paso funcionaba solo porque no tiene resta. Un rotulo pegado a un numero
      // que no es el suyo se lee mal aunque los dos numeros esten bien.
      {
        clave: "asistentes",
        etiqueta: "Estaban en el aula",
        quedan: asistentes,
        pierde: padronUtil ? Math.max(0, padronUtil - asistentes) : 0,
        pct: pct(asistentes),
      },
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
