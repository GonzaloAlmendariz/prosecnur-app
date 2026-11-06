/**
 * La letra de los rótulos que van uno por día —la cifra sobre la barra y la
 * fecha bajo ella— en los gráficos de Avance de acreditación.
 *
 * **Toda barra lleva su cifra y su fecha** (Gonzalo, 2026-11-06: «algunas
 * barras no muestran sus fechas o sus valores»). Lo que cede es la letra, no
 * el rótulo: baja hasta un piso legible y, si ni así cabe en horizontal, el
 * rótulo se gira 90°, que a lo ancho ocupa sólo el alto de una línea. Por
 * debajo del piso no se baja («tampoco debe verse diminuto»). Puro y con test.
 */

/** Letra mínima de un rótulo por día, en px. */
export const LETRA_MINIMA = 9;

export type LetraDeRotulos = { letra: number; girar: boolean; escalonar?: boolean };

/** Un carácter de cifra o fecha mide ≈0,6 em; una línea girada ocupa ≈1,15 em a lo ancho. */
export function letraQueCabe(
  paso: number,
  textos: readonly string[],
  { maxima = 11, minima = LETRA_MINIMA, girable = true }: { maxima?: number; minima?: number; girable?: boolean } = {},
): LetraDeRotulos {
  const caracteres = Math.max(1, ...textos.map((texto) => texto.length));
  const horizontal = Math.min(maxima, (paso - 2) / (caracteres * 0.6));
  if (horizontal >= minima) return { letra: Math.floor(horizontal * 2) / 2, girar: false };
  // Un gráfico bajo no tiene alto para una cifra girada: las cifras se
  // alternan en dos alturas, y cada una dispone del ancho de dos días.
  if (!girable) {
    const alterna = Math.min(maxima, (paso * 2 - 2) / (caracteres * 0.6));
    return { letra: Math.max(minima, Math.floor(alterna * 2) / 2), girar: false, escalonar: true };
  }
  const girada = Math.min(maxima, (paso - 1) / 1.15);
  return { letra: Math.max(minima, Math.floor(girada * 2) / 2), girar: true };
}

/** Alto que pide la cifra sobre la barra más alta: girada, el largo del texto. Se reserva arriba para que no se salga del gráfico. */
export function altoDeCifras(letra: LetraDeRotulos, textos: readonly string[]): number {
  const caracteres = Math.max(1, ...textos.map((texto) => texto.length));
  if (letra.girar) return Math.ceil(caracteres * 0.6 * letra.letra) + 6;
  return Math.ceil(letra.letra) * (letra.escalonar ? 2 : 1) + 6;
}
