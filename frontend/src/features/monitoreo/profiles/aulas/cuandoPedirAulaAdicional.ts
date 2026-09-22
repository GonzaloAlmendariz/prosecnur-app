import { MINIMO_PARA_COMPARAR } from "./rendimientoPorFacultad";
import { fmt } from "./kpisDeAulas";
import type {
  MonitoreoAulasEfectividadFacultad,
  MonitoreoAulasEfectividadSeguimiento,
} from "../../../../api/monitoreo";

/**
 * **Cuándo hay que pedir un aula adicional, y desde cuándo el aviso es fiable.**
 *
 * Gonzalo, ítems 8 y 9 del dictado: «la pregunta principal es identificar qué
 * tan bien o mal nos está yendo respecto a lo planeado… y cuándo sería
 * necesario solicitar un aula adicional», y su condición: «con una o dos aulas
 * eso no es suficiente base… pero cuando ya empezamos a tener una porción
 * importante de las aulas aplicadas y vemos que no vamos a llegar, poder
 * avisarte a tiempo».
 *
 * **El disparo ya estaba calculado y no lo decía nadie.** `.maes_margen`
 * (`monitoreo_aulas_efectividad_seguimiento.R`) proyecta el aforo pendiente de
 * cada facultad a su tasa observada Y a los dos extremos de su intervalo de
 * confianza, y de ahí salen los cuatro estados:
 *
 * - `riesgo_firme`: **ni en el mejor escenario del dato** se cierra la cuota.
 * - `riesgo`: la proyección central no cierra, pero el extremo optimista sí.
 * - `ajustado`: cierra, salvo en el extremo pesimista.
 * - `holgado`: cierra incluso en el pesimista.
 *
 * Y la condición de base viene incorporada por construcción: con dos aulas
 * aplicadas el intervalo es tan ancho que el extremo optimista se va muy
 * arriba, así que la facultad no puede caer en `riesgo_firme`. Es exactamente
 * la cautela que él pedía, pero calculada en vez de puesta a mano.
 *
 * Lo que este módulo añade es el otro lado de la misma cautela: **decir
 * cuántas facultades todavía no tienen base**, para que su silencio no se lea
 * como buenas noticias. Ésas no son «van bien»: son «no se sabe».
 */

/** Con menos de esto, la tasa de una facultad es ruido (la vara del perfil). */
export { MINIMO_PARA_COMPARAR };

export type AvisoDeAulaAdicional = {
  /** No cierran ni en el mejor escenario: son las que hay que pedir ya. */
  pedirYa: MonitoreoAulasEfectividadFacultad[];
  /** La proyección central no cierra, pero su intervalo todavía alcanza. */
  vigilar: MonitoreoAulasEfectividadFacultad[];
  /**
   * Todavía sin base para juzgar: menos de `MINIMO_PARA_COMPARAR`
   * cursos-horario aplicados. Su silencio NO es una buena noticia.
   */
  sinBase: MonitoreoAulasEfectividadFacultad[];
  /**
   * **Las que no se pudieron evaluar, que es otra cosa que no tener base.**
   *
   * `sinBase` tiene contra qué medirse y aún no tiene suficientes aulas;
   * éstas tienen las aulas y **no tienen cuota** —o no tienen campo—, así que
   * no hay proyección que hacer. Pasa cuando la cuota entra por el eje
   * declarado y este bloque agrupa por la facultad del aula: los dos lados del
   * cruce no se encuentran. El motor ya lo distingue por fila (`sin_cuota`,
   * `sin_cumplimiento`, `sin_campo`) y lo sube al agregado en
   * `facultades_evaluadas`; lo que faltaba era que la frase lo mirara.
   */
  sinEvaluar: MonitoreoAulasEfectividadFacultad[];
  /** Los alumnos que faltarían en las de `pedirYa`, sumados. */
  alumnosQueFaltan: number;
  /** La lectura, ya redactada: es lo que se publica arriba de la tabla. */
  frase: string;
};

const falta = (f: MonitoreoAulasEfectividadFacultad) => {
  const restante = Number(f.margen_restante ?? 0);
  return Number.isFinite(restante) && restante < 0 ? Math.round(-restante) : 0;
};

export function cuandoPedirAulaAdicional(
  bloque: MonitoreoAulasEfectividadSeguimiento | null | undefined,
): AvisoDeAulaAdicional | null {
  const filas = bloque?.facultades ?? [];
  if (!filas.length) return null;

  const pedirYa = filas.filter((f) => f.riesgo === "riesgo_firme");
  const vigilar = filas.filter((f) => f.riesgo === "riesgo");
  // «Sin base» son las que aún no tienen con qué juzgarse, y NO las que ya
  // están avisando: una facultad puede estar en riesgo firme con dos aulas si
  // su cuota es enorme, y ahí el aviso vale.
  const sinBase = filas.filter(
    (f) => Number(f.aulas_aplicadas ?? 0) < MINIMO_PARA_COMPARAR
      && f.riesgo !== "riesgo_firme" && f.riesgo !== "riesgo",
  );
  // Ni cuota contra la que proyectar, ni campo con el que hacerlo. No caben en
  // ninguna de las tres categorías de arriba y hasta hoy caían por el hueco.
  const sinEvaluar = filas.filter((f) => {
    const r = f.riesgo_agendado ?? f.riesgo;
    return r === "sin_cuota" || r === "sin_cumplimiento" || r === "sin_campo";
  });
  const alumnosQueFaltan = pedirYa.reduce((n, f) => n + falta(f), 0);

  const partes: string[] = [];
  if (pedirYa.length) {
    partes.push(
      `${fmt(pedirYa.length)} ${pedirYa.length === 1 ? "facultad no cierra" : "facultades no cierran"}`
      + ` ni en el mejor escenario de su medición: hay que pedirles aula adicional`
      + (alumnosQueFaltan ? ` —faltarían ${fmt(alumnosQueFaltan)} alumnos—` : "") + ".",
    );
  }
  if (vigilar.length) {
    partes.push(
      `${fmt(vigilar.length)} más ${vigilar.length === 1 ? "podría" : "podrían"} no cerrar,`
      + " pero su intervalo todavía alcanza: vigilar antes de pedir.",
    );
  }
  if (!pedirYa.length && !vigilar.length) {
    /**
     * **Afirmar exige haber evaluado a alguien.**
     *
     * Con TODAS las filas sin evaluar esta frase decía «ninguna necesita aula
     * adicional» sin haber comparado nada, encima del panel que existe para
     * decidir si se piden aulas. Medido el 2026-09-22, primer día de campo de
     * CCSS Perfil 2026-II: `facultades_evaluadas = 0` y `facultades_sin_cuota
     * = 1`, y la pantalla daba dos buenas noticias seguidas.
     *
     * Con algunas evaluadas y otras no, la frase se ACOTA en vez de callarse:
     * lo que se midió vale, y de lo que no se dice abajo.
     */
    const evaluadas = filas.length - sinEvaluar.length;
    if (evaluadas > 0) {
      partes.push(
        sinEvaluar.length
          ? `De las ${fmt(evaluadas)} que se pudieron evaluar, ninguna necesita aula adicional con lo que tiene agendado.`
          : "Ninguna facultad necesita aula adicional con lo que tiene agendado.",
      );
    } else {
      partes.push(
        "No se pudo evaluar ninguna: no hay cuota contra la que proyectar lo que"
        + " tienen agendado. De aquí no se puede decir si hace falta aula"
        + " adicional, no es que no haga falta.",
      );
    }
  }
  if (sinBase.length) {
    partes.push(
      `${fmt(sinBase.length)} ${sinBase.length === 1 ? "no tiene" : "no tienen"} todavía`
      + ` ${fmt(MINIMO_PARA_COMPARAR)} cursos-horario aplicados: de ${sinBase.length === 1 ? "ésa" : "ésas"}`
      + " no se sabe, no es que vayan bien.",
    );
  }

  return { pedirYa, vigilar, sinBase, sinEvaluar, alumnosQueFaltan, frase: partes.join(" ") };
}
