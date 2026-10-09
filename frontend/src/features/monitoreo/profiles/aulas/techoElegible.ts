/**
 * **Cuántos cursos-horario más se pueden agendar.** El techo del reparto de
 * refuerzos, que hasta ahora era una constante del módulo.
 *
 * Gonzalo, 2026-09-11: «necesito que tengamos todo esto disponible en la app
 * incluyendo poder seleccionar el número de aulas». Empezó pidiendo 10 y se
 * corrigió a 15 en el mismo dictado —«me corrijo, parto de un techo de 15 aulas
 * agendables más»—, que es justo el motivo por el que esto no puede ser una
 * constante: el techo es una decisión operativa que cambia con la jornada.
 *
 * Se recuerda por navegador y no en el `.pulso`: es una preferencia de quien
 * mira la pantalla, no un dato del estudio. `localStorage` puede lanzar —modo
 * privado, almacenamiento bloqueado— y entonces el panel abre en 15 y sigue
 * funcionando, que es lo que tiene que pasar.
 */

export const TECHO_MINIMO = 1;
export const TECHO_MAXIMO = 60;
export const TECHO_POR_DEFECTO = 15;
/** Lo que mueve cada paso del control: agendar de cinco en cinco es el grano real. */
export const TECHO_PASO = 5;

const CLAVE = "pulso.aulas.techoElegible";

/**
 * El techo que se puede usar, venga de donde venga.
 *
 * Un texto del `input`, un `null` del almacenamiento o un `12.7` se convierten
 * en un entero dentro del rango; lo que no es número cae al valor por defecto.
 * Ojo con `Number("")`, que es 0 y es finito: el vacío tiene que caer al
 * defecto y no al mínimo.
 */
export function normalizaTecho(valor: unknown, porDefecto = TECHO_POR_DEFECTO): number {
  if (valor == null) return porDefecto;
  if (typeof valor === "string" && valor.trim() === "") return porDefecto;
  const n = Number(valor);
  if (!Number.isFinite(n)) return porDefecto;
  return Math.min(TECHO_MAXIMO, Math.max(TECHO_MINIMO, Math.round(n)));
}

export function leeTechoRecordado(): number {
  try {
    return normalizaTecho(window.localStorage.getItem(CLAVE));
  } catch {
    return TECHO_POR_DEFECTO;
  }
}

/** Guarda y devuelve lo guardado, que es lo que el panel debe pintar. */
export function recuerdaTecho(valor: unknown): number {
  const n = normalizaTecho(valor);
  try {
    window.localStorage.setItem(CLAVE, String(n));
  } catch {
    // Sin almacenamiento el techo vive lo que dure la pestaña. No es un error
    // que merezca interrumpir a nadie.
  }
  return n;
}
