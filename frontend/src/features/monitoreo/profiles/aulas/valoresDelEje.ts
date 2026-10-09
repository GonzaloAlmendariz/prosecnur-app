/**
 * Los valores del eje para el selector de la cabecera.
 *
 * **Salen del DISEÑO y no de lo que ha aparecido en el parte**: tomarlos de lo
 * recogido dejaría fuera justo los que no han empezado, que son los que hay que
 * ir a mirar.
 *
 * Y salen de `avance_cuota.facultades` —las filas del eje— y no de
 * `quotas_sex_faculty`, que son las celdas de SEXO. Un estudio cuya meta es sólo
 * por nivel no declara ninguna celda de sexo: medido en el simulacro de CCSS
 * Perfil 2026-II, la lista salía **vacía** y con ella **la dimensión del eje
 * desaparecía del selector** — el control ofrecía «Carrera» y «Sexo» y ni una
 * palabra del eje que manda.
 */

/** Filas con el valor del eje, tal como las publica el motor. */
type FilaConValor = Record<string, unknown>;

export function valoresDelEje(
  filasDelEje: ReadonlyArray<FilaConValor> | null | undefined,
  celdasDeSexo?: ReadonlyArray<FilaConValor> | null,
): string[] {
  const fuente = (filasDelEje?.length ? filasDelEje : celdasDeSexo) ?? [];
  const vistas = new Set<string>();
  for (const f of fuente) {
    const nombre = String(f?.facultad ?? f?.faculty ?? "").trim();
    if (nombre) vistas.add(nombre);
  }
  return ordenarValoresDelEje([...vistas]);
}

/**
 * **Un eje numérico se ordena como número.**
 *
 * Alfabéticamente «10» va antes de «6», así que el recorrido con las flechas del
 * selector salta 10 → 6 → 7 y el desplegable abre con el nivel más alto arriba.
 * El orden alfabético se queda para los ejes de texto, donde es el correcto y
 * donde el orden por rendimiento cambiaría cada día.
 */
export function ordenarValoresDelEje(valores: ReadonlyArray<string>): string[] {
  const lista = [...valores];
  const numericos = lista.length > 0 && lista.every((v) => /^\d+$/.test(v));
  return numericos
    ? lista.sort((a, b) => Number(a) - Number(b))
    : lista.sort((a, b) => a.localeCompare(b, "es"));
}
