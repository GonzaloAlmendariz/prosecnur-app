/**
 * Los meses, escritos una sola vez.
 *
 * Había **cuatro tablas** de meses en el perfil —dos cortas idénticas en
 * `AulasAvanceDiario` y `AulasCierrePorAgenda`, y dos largas en
 * `calendarioDeAgenda` y `fichaDeCursoHorario`— y las dos largas ya se habían
 * separado: una decía «septiembre» y la otra «setiembre». Es decir, la misma
 * app llamaba de dos formas al mes en el que está corriendo el operativo.
 *
 * Se queda **«setiembre»**, que es la forma que usa el libro del operativo y la
 * que ya publicaba la ficha del curso-horario.
 */

/** «set», para rotular un eje donde sólo cabe el cambio de mes. */
export const MES_CORTO = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "set", "oct", "nov", "dic",
] as const;

/** «setiembre», para una fecha en palabras. */
export const MES_LARGO = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
] as const;

/** El mes de un `YYYY-MM-DD`, corto. Devuelve `""` si la fecha no tiene forma. */
export function mesCortoDe(iso: string): string {
  return MES_CORTO[Number(String(iso).slice(5, 7)) - 1] ?? "";
}
