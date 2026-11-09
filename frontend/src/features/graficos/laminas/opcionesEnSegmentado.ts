// Opciones de la tarjeta que se eligen con un segmentado en vez de un desplegable (ítem 9 de la oleada del inspector,
// 2026-11-08): con hasta tres opciones de rótulo corto, todas a la vista y a un clic. Mismo patrón que
// numerosEnBotones.ts: el modelo decide si caben y cómo; la fila sólo pinta. Con más opciones, o rótulos que no caben en
// el ancho de la tarjeta, sigue el desplegable.

export type OpcionSegmento = { clave: string; rotulo: string };

/** Lo que pinta la fila: las opciones y si el segmentado va en la línea del rótulo o debajo, a todo el ancho. */
export type Segmentacion = { opciones: OpcionSegmento[]; apilado: boolean };

export const MAX_OPCIONES_SEGMENTO = 3;
/**
 * En la línea del rótulo el segmentado mide la columna de control (180 px) partida en tercios o mitades iguales: unos
 * 22 caracteres repartidos entre las opciones (7 por tercio, 11 por mitad). R11-5: con 12 por rótulo, «Automática»
 * cabía en el modelo y en la tarjeta salía «Auto…»; ahora pasa debajo del rótulo, a todo el ancho (C3).
 */
const EN_LINEA_CARACTERES = 22;
/** Debajo del rótulo, a todo el ancho de la tarjeta (unos 300 px a 1024 de ancho). */
const APILADO = { porRotulo: 30, total: 44 };

/**
 * Las opciones como segmentos, o `null` si van en desplegable: más de tres, alguna sin rótulo o rótulos que no caben ni
 * a todo el ancho. Un valor guardado que no está entre las opciones también deja el desplegable, que lo muestra con su
 * aviso (6a).
 */
export function opcionesEnSegmentado(
  opciones: readonly { value: string; label: string }[],
  guardado?: unknown,
): Segmentacion | null {
  if (opciones.length < 2 || opciones.length > MAX_OPCIONES_SEGMENTO) return null;
  if (typeof guardado === "string" && guardado !== "" && !opciones.some((o) => o.value === guardado)) return null;
  const rotulos = opciones.map((o) => o.label.trim());
  if (rotulos.some((r) => r === "")) return null;
  const largo = Math.max(...rotulos.map((r) => r.length));
  const total = rotulos.reduce((n, r) => n + r.length, 0);
  if (largo > APILADO.porRotulo || total > APILADO.total) return null;
  return {
    opciones: opciones.map((o, i) => ({ clave: o.value, rotulo: rotulos[i] })),
    apilado: largo > Math.floor(EN_LINEA_CARACTERES / rotulos.length),
  };
}

/**
 * Las opciones fijas de un mando propio (Respuestas bajo el enunciado, Casos junto al %): las tres caben siempre, así que
 * no hay desplegable de respaldo; sólo se decide si van en la línea del rótulo o debajo.
 */
export function segmentacionFija(opciones: readonly { value: string; label: string }[]): Segmentacion {
  return opcionesEnSegmentado(opciones) ?? { opciones: opciones.map((o) => ({ clave: o.value, rotulo: o.label })), apilado: true };
}
