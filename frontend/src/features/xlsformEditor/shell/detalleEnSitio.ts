// Detalle en sitio de las pestañas del editor (ítem 50): un clic abre o cierra el detalle ahí mismo, nunca navega.

/** Una sola ficha abierta a la vez: elegir la abierta la cierra; elegir otra la reemplaza. */
export function alternarFicha<T>(abierta: T | null, elegida: T): T | null {
  return abierta === elegida ? null : elegida;
}
