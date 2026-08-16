/**
 * H1/ADR 0060 · Cuándo la asistencia del agregado es un intervalo y no un punto.
 *
 * La asistencia de elegibles no se observa: se acota.
 *
 *   - **Techo** — `cadena.asistencia`, que es `(asistentes − no_elegibles) /
 *     elegibles`. El motor lo comenta sin ambigüedad: «la resta es una COTA
 *     SUPERIOR, no una observación», porque `no_elegibles` son los DETECTADOS.
 *     Si el screening fue parcial, en el numerador sobran ajenos al estudio.
 *   - **Suelo** — `cadena.rendimiento`, que es `efectivas / elegibles`: gente
 *     que seguro estuvo, era del estudio y respondió.
 *
 * Las dos tasas llevaban rondas publicadas una al lado de la otra sin que nada
 * dijera que acotan la misma cantidad, así que el techo se leía como una
 * medición exacta.
 *
 * Vive fuera del panel porque la condición es la parte que puede equivocarse
 * —afirmar un rango donde no lo hay es peor que no mostrarlo— y ahí se puede
 * probar sin montar el payload entero de la referencia.
 */

/** Las dos tasas de la cadena que acotan la asistencia, más el modo de lectura. */
export type EntradaAsistenciaAcotada = {
  /** `cadena.asistencia.tasa` — el techo. */
  asistencia: number | null;
  /** `cadena.rendimiento.tasa` — el suelo. */
  rendimiento: number | null;
  /** `cobertura.glosario_completo`. Sin glosario la relación no se sostiene. */
  conGlosario: boolean;
};

/**
 * ¿Se puede afirmar el intervalo?
 *
 * Cuatro condiciones, y cada una descarta una forma distinta de mentir:
 *
 * 1. **Con glosario.** Sin él, `asistencia` es la bruta sobre matriculados y
 *    `rendimiento` no la acota: serían dos cantidades distintas presentadas
 *    como extremos de una.
 * 2 y 3. **Las dos cifras existen.** Con el desborde del ADR 0060 la tasa viaja
 *    `null`; media cota no es un rango.
 * 4. **El suelo queda por debajo del techo.** Si no, el payload está sucio o
 *    ambas coinciden —y entonces la cantidad se conoce, no se acota—.
 */
export function asistenciaEsAcotada({
  asistencia,
  rendimiento,
  conGlosario,
}: EntradaAsistenciaAcotada): boolean {
  if (!conGlosario) return false;
  if (asistencia == null || !Number.isFinite(asistencia)) return false;
  if (rendimiento == null || !Number.isFinite(rendimiento)) return false;
  return rendimiento < asistencia;
}
