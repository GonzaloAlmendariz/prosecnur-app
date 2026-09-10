/**
 * Dónde se dibuja el selector de facultad de la cabecera.
 *
 * Gonzalo, 2026-09-10: «el selector de facultades que está en el encabezado,
 * donde dice todas y todas las facultades, debería ser un botón que sólo esté en
 * resumen, no en las demás pestañas, porque es Resumen quien maneja este
 * selector».
 *
 * **Y el reparto es correcto por una razón que se puede comprobar**: Resumen es
 * la única pestaña donde el foco FILTRA —el bloque «Respuestas» enseña las de
 * esa facultad y nada más—. En las otras cuatro y en el resto de secciones el
 * foco sólo RESALTA una fila dentro de un ranking, que es el contrato de
 * `focoQueCruzaLaSeccion.test.tsx`. Un mando que en cuatro de cada cinco
 * pantallas no cambia lo que se lee pide más atención de la que devuelve.
 *
 * **El foco NO se toca**: sigue viajando en la URL y sigue resaltando en todas
 * partes. Lo que desaparece es el MANDO, y quien quiera quitar el resaltado
 * vuelve a Resumen, que es de donde salió.
 *
 * Vive en su propio módulo, y no como una condición dentro del JSX, para que la
 * regla tenga nombre y prueba: una condición suelta en un page-file de 2 000
 * líneas no la ve nadie hasta que alguien la borra.
 */
export function mandoDeFacultadVisible(seccion: string, pestana: string): boolean {
  return seccion === "avance" && pestana === "resumen";
}
