/**
 * Qué se busca: la muestra objetivo y la sobremuestra operativa.
 *
 * Gonzalo, mirando «Cursos-horario requeridos», textual: «hasta ahora siempre
 * resuelves el universo, siempre resuelves los elegibles, pero nunca resuelves
 * la muestra objetivo y la sobremuestra operativa, y ese valor es como muy
 * necesario para hacer el resto de cálculo y toda la selección, y no lo veo
 * hasta ahora en la interfaz».
 *
 * Tenía razón y la cadena estaba rota justo ahí: esta pestaña convierte CUOTA
 * en titulares, la cuota es el reparto de la sobremuestra operativa entre las
 * facultades, y la pestaña nunca decía ese número ni dónde se resuelve. Cuando
 * faltaba, la tarjeta de tasas se limitaba a poner «sin estrato dimensionado»
 * en las quince filas — que se lee como «estas facultades no tienen datos»
 * cuando lo que pasa es que todavía no se calculó la muestra.
 *
 * Los números viven en el resultado del componente (los publica el motor); acá
 * sólo se leen y se declara si están.
 */

const num = (v: unknown): number | null => {
  // Number(null) === 0: un "sin dato" se volvería un cero con significado.
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export type ComponenteConResultado = {
  resultado?: {
    n_teorico?: unknown;
    n_objetivo?: unknown;
    n_operativo?: unknown;
    sobremuestra?: unknown;
  } | null;
};

export type MuestraOperativa = {
  /** El n que sale de la fórmula (Cochran + deff + FPC). */
  nFormula: number | null;
  /** La muestra que se busca de verdad, tras redondeo o meta fijada. */
  nObjetivo: number | null;
  /** Las respuestas extra que se preparan por encima del objetivo. */
  sobremuestra: number | null;
  /** Lo que se sale a buscar a campo: objetivo + sobremuestra. */
  nOperativo: number | null;
  /** El porcentaje que la sobremuestra añade sobre el objetivo. */
  sobremuestraPct: number | null;
  /** true cuando los dos números que alimentan la cuota están resueltos. */
  listo: boolean;
};

export function muestraOperativa(comp: ComponenteConResultado | null | undefined): MuestraOperativa {
  const r = comp?.resultado ?? null;
  const nObjetivo = num(r?.n_objetivo);
  const nOperativo = num(r?.n_operativo);
  // La sobremuestra publicada manda; si no viene, se deduce de la diferencia,
  // que es su definición. Nunca se inventa un porcentaje por defecto.
  const sobreRaw = num(r?.sobremuestra);
  const sobremuestra =
    sobreRaw ?? (nObjetivo != null && nOperativo != null && nOperativo > nObjetivo ? nOperativo - nObjetivo : null);
  return {
    nFormula: num(r?.n_teorico),
    nObjetivo,
    sobremuestra,
    nOperativo,
    sobremuestraPct: nObjetivo != null && sobremuestra != null ? sobremuestra / nObjetivo : null,
    // «Listo» exige los dos: con objetivo pero sin operativo no hay nada que
    // repartir, y la cuota —y con ella los titulares— sigue sin poder salir.
    listo: nObjetivo != null && nOperativo != null,
  };
}
