/**
 * Una columna vacía en TODAS las filas no llega a la tabla.
 *
 * `compactColumns` ya descarta la clave que no existe —su comentario cuenta que
 * «Resumen por actor» dibujaba una columna META con las cuatro celdas vacías—,
 * pero no la que existe y viene vacía en todas las filas. Es el mismo defecto
 * un escalón más abajo, y en el perfil de aulas se veía: la tabla de reemplazos
 * gastaba una de sus columnas en «Corrida de selección», vacía en las 50 filas,
 * porque este estudio trajo su plan del libro y no de una corrida de cálculo.
 *
 * Ese hecho **ya se cuenta, y mejor**, en «Operación del plan»: «196 del libro ·
 * sin corrida de cálculo». La columna no añadía ese dato, sólo ocupaba ancho.
 * Y cuando la corrida SÍ existe tampoco distingue nada: `calc_muestra_aulas.R`
 * asigna un único `selection_run_id` a todas las filas de la selección, así que
 * la columna repetiría la misma cadena opaca tantas veces como filas haya.
 *
 * Por qué en archivo propio y no dentro de `compactColumns`: hay dos copias de
 * ese helper —una local en la página de aulas y la compartida en
 * `AcreditacionMonitoreoPage.tsx`, que está congelada a crecimiento—, así que el
 * criterio vive una sola vez, aquí, y con su prueba.
 */

/** El mismo criterio de vacío que usa la tabla al pintar la celda. */
function hayDato(valor: unknown) {
  if (valor == null) return false;
  if (typeof valor === "boolean") return true;
  const texto = String(valor).trim();
  // «—» es lo que el presentador escribe para un hueco, así que una columna de
  // guiones está tan vacía como una de cadenas en blanco.
  return texto !== "" && texto !== "—";
}

/**
 * Quita de `columnas` las que no tienen un solo dato en `filas`.
 *
 * Si NINGUNA lo tiene se devuelven todas: una tabla sin encabezados es peor que
 * una con columnas vacías, y ese caso ya lo cubre el estado vacío del panel.
 */
export function columnasConDato(
  filas: ReadonlyArray<Record<string, unknown>>,
  columnas: ReadonlyArray<string>,
): string[] {
  if (!filas.length) return [...columnas];
  const conDato = columnas.filter((columna) => filas.some((fila) => hayDato(fila[columna])));
  return conDato.length ? conDato : [...columnas];
}
