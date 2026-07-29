/**
 * Colores de los resultados de una encuesta, en un solo sitio.
 *
 * Efectiva, parcial, rechazo, pendiente y en revisión son los cinco desenlaces
 * que cuentan igual en todo Monitoreo, y su color estaba escrito a mano en nueve
 * archivos entre Acreditación y Telefónico —26 literales del mismo trío verde /
 * ámbar / granate—. Cambiar el verde de «efectiva» obligaba a encontrar los
 * nueve, y una vista que se quedara atrás pintaba dos cosas distintas del mismo
 * color sin que nada fallara.
 *
 * No confundir con los estados de la LLAMADA (`AcreditacionEstadosLlamada`), que
 * el usuario declara por estudio y tienen su propia fuente: aquí viven los
 * desenlaces de la encuesta, que no dependen del estudio.
 *
 * Los valores son exactamente los que ya estaban en uso: esto centraliza, no
 * recolorea.
 */

export const COLOR_RESULTADO = {
  /** Encuesta completa que cuenta como avance. */
  efectiva: "#168a55",
  /** Empezada y no terminada. */
  parcial: "#b97611",
  /** La persona declinó. */
  rechazo: "#a61d4f",
  /** Del universo, todavía sin trabajar. */
  pendiente: "#7a8796",
  /** Necesita una decisión antes de contar. */
  revision: "#474f5b",
} as const;

export type ResultadoDeEncuesta = keyof typeof COLOR_RESULTADO;

/** La línea de acumulado no es un resultado: es la serie que los suma. */
export const COLOR_ACUMULADO = "#17212f";

/**
 * Los colores que el contrato puede vigilar, y por qué no son los cinco.
 *
 * `revision` (#474f5b) y `COLOR_ACUMULADO` (#17212f) están **sobrecargados**: el
 * mismo valor es el gris de las etiquetas de eje y el del texto principal. Su
 * literal aparece de forma legítima en sitios que no tienen nada que ver con un
 * desenlace, así que prohibirlo produciría falsos positivos —lo detectó el propio
 * test, que señaló doce archivos donde el hex era tipografía—.
 *
 * Los cuatro cromáticos solo significan una cosa, y esos sí se vigilan.
 */
export const COLORES_DE_RESULTADO_EXCLUSIVOS = [
  COLOR_RESULTADO.efectiva,
  COLOR_RESULTADO.parcial,
  COLOR_RESULTADO.rechazo,
  COLOR_RESULTADO.pendiente,
] as const;

/** Trazo claro con el que se separan las barras apiladas entre sí. */
export const COLOR_SEPARADOR_BARRA = "rgba(255, 255, 255, 0.72)";
