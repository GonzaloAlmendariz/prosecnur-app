/**
 * Se queda con las filas de una facultad.
 *
 * Gonzalo, dos veces: «el selector de facultad que está en el encabezado no hace
 * que los gráficos actualicen… todos los demás gráficos se deben acomodar a
 * ello» y «todos los gráficos de resumen aún no muestran sólo lo de una facultad
 * cuando la ponemos por facultad».
 *
 * **Se filtra la ENTRADA, no cada panel.** Los paneles de Resumen reciben filas
 * —partes, agenda, estados— y todas traen `faculty`. Pasarles ya filtrado lo que
 * tienen que leer los deja intactos: nueve componentes sin una prop nueva, sin
 * una rama nueva y sin nueve formas distintas de comparar dos nombres de
 * facultad, que es como se acaba teniendo uno que compara con acentos y otro sin
 * ellos.
 *
 * **Dónde NO vale**: los bloques que el motor ya reparte —`course_status_*`—
 * tienen su propia versión por facultad, calculada sobre el plan ENTERO. Filtrar
 * aquí sus filas daría el reparto de las 500 que viajan y lo presentaría como el
 * de la facultad.
 */

const clave = (v: unknown) =>
  (v == null ? "" : String(v)).trim().toUpperCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * @param facultad Sin facultad en foco devuelve las filas TAL CUAL —el mismo
 *   array, sin copiar—, para que poner el filtro no cueste una pasada por cada
 *   panel en el caso normal, que es «Todas».
 */
export function deLaFacultad<T extends Record<string, unknown>>(
  filas: ReadonlyArray<T> | null | undefined,
  facultad: string | undefined,
): ReadonlyArray<T> {
  if (!facultad || !filas?.length) return filas ?? [];
  const buscada = clave(facultad);
  // `faculty` es el nombre del campo en el plan y en los partes; `facultad` es
  // el de los bloques ya castellanizados. Se aceptan los dos porque este helper
  // lo usan las dos familias de filas.
  return filas.filter((f) => clave(f.faculty ?? f.facultad) === buscada);
}

/**
 * Lo mismo, para filas cuya facultad viene DENTRO de la clave del estrato.
 *
 * El motor compone `stratum` pegando `faculty / sex_top_1 / size_group`, así
 * que la facultad es el primer segmento y no existe como columna propia. Sin
 * esto, la pestaña Estratos era la única de Avance que no reaccionaba al
 * selector: enseñaba los 73 cortes del estudio con una facultad puesta arriba.
 *
 * Usa el MISMO criterio de comparación que `deLaFacultad` —el de todo el
 * perfil— para que no haya un panel que encuentre Psicología y otro no.
 */
export function deLaFacultadPorEstrato<T extends Record<string, unknown>>(
  filas: ReadonlyArray<T> | null | undefined,
  facultad: string | undefined,
): ReadonlyArray<T> {
  if (!facultad || !filas?.length) return filas ?? [];
  const buscada = clave(facultad);
  return filas.filter((f) => {
    const bruto = f.stratum ?? f.estrato;
    const primero = String(bruto ?? "").split("/")[0];
    return clave(primero) === buscada;
  });
}
