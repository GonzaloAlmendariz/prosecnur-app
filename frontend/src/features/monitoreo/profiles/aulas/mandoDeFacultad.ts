/**
 * Dónde se dibuja el selector de facultad de la cabecera.
 *
 * **La regla cambió el mismo día, y la segunda instrucción manda.** Por la
 * mañana Gonzalo dijo: «el selector de facultades que está en el encabezado…
 * debería ser un botón que sólo esté en resumen, no en las demás pestañas,
 * porque es Resumen quien maneja este selector» — y era cierto por una razón
 * comprobable: Resumen era la única pestaña donde el foco FILTRABA; en las
 * demás sólo resaltaba una fila de un ranking. Un mando que en cuatro de cada
 * cinco pantallas no cambia lo que se lee pide más atención de la que devuelve.
 *
 * Por la tarde pidió lo contrario, y con el arreglo dentro: «mejor todo Avance
 * debería tener el selector de facultad, y **absolutamente todos los gráficos
 * deben ajustarse y ser robustos a mostrar o todas las facultades o una en
 * específica**». No es el mismo pedido con otro signo: la mañana quitaba el
 * mando de donde no servía y la tarde hace que sirva en todas partes. El mando
 * se mueve DESPUÉS de que cada pestaña recorta su entrada, no antes.
 *
 * **Salidas queda fuera, y a propósito.** Es la publicación al Sheets: no
 * dibuja nada que un selector pueda ajustar, y un mando de facultad encima de
 * un botón de publicar insinúa que se publicaría sólo esa facultad, que es
 * falso y sería caro de descubrir.
 *
 * **El foco NO se toca**: sigue viajando en la URL y sigue resaltando en todas
 * partes, también fuera de Avance.
 *
 * Vive en su propio módulo, y no como una condición dentro del JSX, para que la
 * regla tenga nombre y prueba: una condición suelta en un page-file de 2 000
 * líneas no la ve nadie hasta que alguien la borra.
 */

/** La única pestaña de Avance sin gráficos que ajustar. */
const SIN_MANDO = new Set(["salidas"]);

export function mandoDeFacultadVisible(seccion: string, pestana: string): boolean {
  return seccion === "avance" && !SIN_MANDO.has(pestana);
}
