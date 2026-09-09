/**
 * El destino del Sheets de los aplicadores, en UNA expresión.
 *
 * Existía dos veces escrita y las dos no decían lo mismo: el botón se
 * habilitaba con el enlace PEGADO o con el RECORDADO, y la llamada mandaba
 * sólo `{ aplicar }` —sin enlace—, así que el backend buscaba únicamente el
 * recordado. Sobre un proyecto reabierto que todavía no lo tiene guardado, eso
 * daba la pantalla del 2026-09-09: el enlace a la vista en su campo, el botón
 * activo, y debajo «No hay Sheets de la distribución que sincronizar: pega su
 * enlace una vez» con el enlace ya pegado.
 *
 * Aquí sale de un sitio, así que la guarda y el argumento no pueden divergir:
 * si el botón está activo hay algo que mandar o algo recordado que buscar.
 *
 * `enviar` es `undefined` cuando no hay nada pegado — no la cadena vacía: el
 * cliente omite el campo y el backend cae a su destino recordado, que es lo
 * que debe pasar cuando el enlace ya se pegó una vez.
 */
export function destinoDeDistribucion(
  escrito: string | null | undefined,
  recordado: string | null | undefined,
): { hay: boolean; enviar: string | undefined } {
  const pegado = (escrito ?? "").trim();
  const guardado = (recordado ?? "").trim();
  return { hay: Boolean(pegado || guardado), enviar: pegado || undefined };
}
