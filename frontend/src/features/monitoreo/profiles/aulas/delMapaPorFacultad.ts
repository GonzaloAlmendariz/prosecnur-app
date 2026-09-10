/**
 * Busca la entrada de una facultad en un mapa que el motor indexa por su
 * NOMBRE.
 *
 * `course_status_cobertura_por_facultad` y
 * `course_status_rol_y_estado_por_facultad` llegan como objetos cuyas claves son
 * la etiqueta cruda del plan —«PSICOLOGÍA»—, y los paneles las leían con
 * `mapa[facultadEnFoco]`, o sea con una comparación de cadenas exacta. Basta con
 * que el nombre venga descompuesto por un lado y compuesto por el otro —la Í
 * como un carácter o como I + tilde— para que la búsqueda falle, y entonces el
 * panel no dice «no encontré la facultad»: cae a su respaldo y enseña el reparto
 * del recorte de 500 filas como si fuera el de la facultad, o su vacío.
 *
 * Es la misma normalización de `deLaFacultad`, y por el mismo motivo: un solo
 * sitio donde se decide si dos nombres de facultad son el mismo.
 */

const clave = (v: unknown) =>
  (v == null ? "" : String(v)).trim().toUpperCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");

export function delMapaPorFacultad<T>(
  mapa: Record<string, T> | null | undefined,
  facultad: string | undefined,
): T | null {
  if (!mapa || !facultad) return null;
  const directa = mapa[facultad];
  // El camino rápido primero: en el caso normal las cadenas son idénticas y no
  // hay que recorrer quince claves ni normalizar nada.
  if (directa !== undefined) return directa;
  const buscada = clave(facultad);
  for (const [nombre, valor] of Object.entries(mapa)) {
    if (clave(nombre) === buscada) return valor;
  }
  return null;
}
