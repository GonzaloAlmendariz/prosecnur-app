// Modo del selector de láminas y «Comparar dos» (auditoría del selector, hallazgos 14 y 3). Puras: el store y el
// diálogo las usan, los tests las prueban solas.

import type { ModoSelectorLamina } from "./selectoresStore";

/** Opciones del control segmentado, en su orden visible. */
export const MODOS_LAMINA: readonly { valor: ModoSelectorLamina; rotulo: string }[] = [
  { valor: "insertar", rotulo: "Insertar detrás" },
  { valor: "cambiar", rotulo: "Cambiar esta lámina" },
];

/**
 * El modo con que el diálogo se pinta: el que pidió quien lo abrió («+ Lámina» pide insertar; «Cambiar» sobre una
 * lámina pide cambiar) o el que eligió el analista en el segmentado. Sin lámina en el foco solo se puede insertar.
 */
export function modoEfectivo(pedido: ModoSelectorLamina, hayLamina: boolean): ModoSelectorLamina {
  return pedido === "cambiar" && hayLamina ? "cambiar" : "insertar";
}

/** Tope de tarjetas en la vista partida. */
export const TOPE_COMPARAR = 2;

/** Agrega la tarjeta a la comparación o la quita; con el tope lleno, una tarjeta nueva no entra. */
export function alternarEnComparacion<T>(lista: readonly T[], opcion: T, tope = TOPE_COMPARAR): T[] {
  if (lista.includes(opcion)) return lista.filter((x) => x !== opcion);
  if (lista.length >= tope) return [...lista];
  return [...lista, opcion];
}

/** Con el tope lleno, el botón «Comparar» de una tarjeta que no está en la comparación queda inactivo. */
export function puedeEntrarEnComparacion<T>(lista: readonly T[], opcion: T, tope = TOPE_COMPARAR): boolean {
  return lista.includes(opcion) || lista.length < tope;
}
