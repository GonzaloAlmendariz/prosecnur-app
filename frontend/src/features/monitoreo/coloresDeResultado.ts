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
 * No confundir con los estados de la LLAMADA (`familiasDeLlamada`), que
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

/**
 * **La marca de una meta no es un desenlace: es la vara contra la que se miden.**
 *
 * `AulasSexoPorFacultadChart` pintaba la marca de «Cuota» con
 * `COLOR_RESULTADO.pendiente`, el mismo gris con que pinta el segmento «Déficit
 * proyectado» de la misma barra. Dos cosas distintas del mismo color, y una de
 * ellas es justo el dato que decide si una facultad cumple su cuota por sexo.
 *
 * Comparte valor con `COLOR_ACUMULADO` porque las dos son tinta y no color de
 * dato, pero lleva nombre propio: reusar el del acumulado haría que el próximo
 * cambio de la serie acumulada moviera, sin querer, la marca de las metas.
 */
export const COLOR_MARCA_DE_META = "#17212f";

/** Trazo claro con el que se separan las barras apiladas entre sí. */
export const COLOR_SEPARADOR_BARRA = "rgba(255, 255, 255, 0.72)";

/**
 * La tinta que se lee encima de un relleno, decidida por su luminancia.
 *
 * Plotly elige solo el color del texto que va DENTRO de una barra, y su
 * heurístico se equivoca justo en el medio de la escala: sobre `pendiente`
 * (#7a8796) dejaba su gris por defecto #444, que da 2,66 de contraste —el «no
 * se ve nada» que se reportó desde la pantalla—. La misma barra con la tinta
 * de la casa da 4,43.
 *
 * No recolorea la paleta: sólo elige, entre la tinta oscura y el blanco, la
 * que gana contraste contra el relleno que ya existe.
 *
 * Techo conocido: con esta paleta, `efectiva`, `parcial` y `pendiente` llegan
 * a 4,37-4,43 y no a los 4,5 de WCAG para texto normal. Subirlos exige
 * oscurecer la paleta, que es una decisión de identidad —no de este helper— y
 * arrastraría a PPT y PDF, que leen los mismos hex. Por eso el contrato de
 * abajo exige 4,3: es lo que la paleta puede sostener hoy, declarado, en vez
 * de un 4,5 que sólo pasaría excluyendo a los tres que no llegan.
 */
const CANAL_LINEAL = (v: number): number => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

/** Luminancia relativa WCAG de un hex `#rrggbb`. */
export function luminanciaDe(hex: string): number {
  const limpio = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(limpio)) return 0;
  const n = parseInt(limpio, 16);
  return (
    0.2126 * CANAL_LINEAL((n >> 16) & 255) +
    0.7152 * CANAL_LINEAL((n >> 8) & 255) +
    0.0722 * CANAL_LINEAL(n & 255)
  );
}

/** Contraste WCAG entre dos hex, de 1 (idénticos) a 21 (negro sobre blanco). */
export function contrasteEntre(unHex: string, otroHex: string): number {
  const a = luminanciaDe(unHex);
  const b = luminanciaDe(otroHex);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Blanco con el que se escribe encima de un relleno oscuro. */
export const TINTA_CLARA = "#ffffff";

/**
 * La tinta oscura es la misma del texto de la app, no el #444 de Plotly: dos
 * grises distintos para el mismo papel es la clase de deriva que este archivo
 * existe para evitar.
 */
export const TINTA_OSCURA = COLOR_ACUMULADO;

/** Entre la tinta oscura y la clara, la que más contrasta con el relleno. */
export function tintaSobre(relleno: string): string {
  return contrasteEntre(TINTA_OSCURA, relleno) >= contrasteEntre(TINTA_CLARA, relleno)
    ? TINTA_OSCURA
    : TINTA_CLARA;
}
