import { readFileSync } from "node:fs";

/**
 * El código R del motor, **sin comentarios**, para los contratos que leen sus
 * listas con expresiones regulares.
 *
 * Siete pruebas del perfil comparan una lista del frontend con la del motor
 * leyendo el fichero. Ninguna quitaba los comentarios, y eso las hacía frágiles
 * por el lado del falso rojo: basta con que alguien escriba una cadena entre
 * comillas dentro de un comentario —«el equipo a veces escribe "pendiente"»— para
 * que el regex se la trague y el contrato falle sin que nada esté mal.
 *
 * Comprobado el 2026-08-30: reformatear la lista en varias líneas NO las rompe,
 * pero una cadena en un comentario sí. Un rojo falso cuesta tanto como un verde
 * falso, porque el siguiente que lo vea empezará por dudar del código bueno.
 *
 * No se tocan las cadenas del propio código, sólo lo que va tras `#` hasta el
 * final de la línea, que es como comenta R.
 */
export function fuenteDelMotor(ruta: URL | string): string {
  return readFileSync(ruta, "utf8").replace(/#.*$/gm, "");
}
