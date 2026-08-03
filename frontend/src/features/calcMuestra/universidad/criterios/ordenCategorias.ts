/**
 * G39 · Las categorías con más cursos-horario van primero. En todas.
 *
 * Gonzalo, dos veces: «las categorías con mayor cantidad de CH siempre van
 * primero en su criterio» y, al ver que sólo había cambiado una lista, «recuerda
 * que quienes tienen más CH totales siempre van primero, **en todos los
 * criterios que lo tengan**».
 *
 * G37 aplicó la regla en la lista de conmutadores y ahí se quedó: la radiografía
 * de tipo de sesión seguía ordenando por alumnos elegibles y la tarjeta genérica
 * de criterio no ordenaba nada. Es el mismo error de método que ya me corrigió
 * antes —reparar el primero que aparece en vez de enumerar la clase—, así que
 * aquí la regla tiene **una sola casa** y las superficies la importan.
 *
 * ## Por qué «CH totales» y no «CH que siguen dentro»
 *
 * Son dos cifras distintas y sólo una sirve para ordenar. Los cursos-horario que
 * la categoría **tiene** no cambian al decidir; los que **siguen incluidos**
 * cambian con cada conmutador. Ordenando por los segundos, apagas una categoría
 * y salta al fondo: la siguiente que querías tocar ya no está donde la dejaste.
 * Un orden que responde al gesto que estás haciendo es peor que no ordenar.
 */

/** Compara dos elementos por sus cursos-horario totales, de mayor a menor. */
export function compararPorCursosHorario(
  aCh: number | null | undefined,
  bCh: number | null | undefined,
  aEtiqueta: string,
  bEtiqueta: string,
): number {
  const peso = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  // Desempate por etiqueta para que dos categorías del mismo tamaño no bailen
  // entre renders: sin él, el orden depende del orden de llegada del payload.
  return peso(bCh) - peso(aCh) || aEtiqueta.localeCompare(bEtiqueta, "es");
}

/** Ordena una lista de categorías por sus cursos-horario totales. */
export function ordenarPorCursosHorario<T>(
  items: readonly T[],
  ch: (item: T) => number | null | undefined,
  etiqueta: (item: T) => string,
): T[] {
  return [...items].sort((a, b) => compararPorCursosHorario(ch(a), ch(b), etiqueta(a), etiqueta(b)));
}
