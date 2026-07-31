/**
 * La segunda línea de una celda solo se pinta si añade algo.
 *
 * Medido el 2026-07-30 sobre `acrconta` en Consultas › Registros en plataforma,
 * con las 160 filas que la tabla muestra de golpe: la hora repetía la del sello
 * de fecha **160 veces de 160**, el resultado del cruce repetía su propia
 * píldora **141**, y el `response_id` repetía el código del caso **134**. Tres
 * cadenas por fila diciendo lo que la celda ya decía, en una tabla donde el ojo
 * baja por columnas.
 *
 * Por eso esto compara y no borra: las excepciones son justo las que importan.
 * Cuando el caso se identifica por nombre («Fiorella Quispe Bustamante») o por
 * código de alumno («20230804»), ese `response_id` es el único sitio de la fila
 * donde aparece el identificador de plataforma; y cuando el cruce sí encontró
 * llave, el detalle trae la llave concreta. Borrar la línea habría perdido esas
 * 19 y 26 filas.
 */

/**
 * Normaliza para comparar, no para mostrar. Dos detalles importan:
 *
 * - **El cero de la hora.** `toLocaleString` con `timeStyle: "short"` escribe
 *   «1:51 p. m.» dentro del sello y `toLocaleTimeString` con `hour: "2-digit"`
 *   escribe «01:51 p. m.» en el detalle. Sin quitar ese cero, el `includes`
 *   falla y las 160 repeticiones se pintan igual.
 * - **El espacio del locale.** `es-PE` separa «p. m.» con U+202F, no con un
 *   espacio normal. `\s` en JS sí lo cubre, y por eso se colapsa todo a uno.
 */
function paraComparar(valor: string) {
  return valor
    .toLocaleLowerCase("es-PE")
    .replace(/\s+/g, " ")
    .replace(/\b0(\d)/g, "$1")
    .trim();
}

/**
 * Devuelve el detalle solo si no está ya dicho en la referencia, o `null`.
 *
 * La comparación es por subcadena y no por igualdad porque el caso de la hora
 * lo exige: «1:51 p. m.» vive *dentro* de «22/07/26, 1:51 p. m.». Eso la vuelve
 * algo laxa —un detalle corto que sea trozo de la referencia se oculta—, y en
 * los tres usos de esta tabla es justo lo que se quiere.
 */
export function detalleQueAporta(referencia: string, detalle: string | null | undefined) {
  const limpio = String(detalle ?? "").trim();
  if (!limpio) return null;
  return paraComparar(referencia).includes(paraComparar(limpio)) ? null : limpio;
}

export function DetalleDeCelda({
  referencia,
  detalle,
}: {
  referencia: string;
  detalle: string | null | undefined;
}) {
  const texto = detalleQueAporta(referencia, detalle);
  return texto ? <small>{texto}</small> : null;
}
