/**
 * Escape con un desplegable abierto dentro del panel de regla cierra el
 * desplegable y deja el panel como está.
 *
 * El `Sideover` (Radix Dialog) y el `PulsoSelect` (Radix Select) cargan copias
 * distintas de la capa de cierre (`escapeDelPanel.test.tsx`): las dos se creen
 * la capa de arriba y la del panel atiende el Escape primero, marca el evento y
 * pide "Descartar los cambios" con el desplegable todavía abierto. Mientras no
 * haya una sola copia, el Escape se atiende antes, en la fase de captura de
 * `window` (como el selector de pregunta): si hay un desplegable abierto, ese
 * Escape es suyo. Radix cierra su menú al redimensionar la ventana, y ese
 * es el aviso que se le da.
 */
import { useEffect } from "react";

/** El menú que abre `PulsoSelect` (portal en `body`, fuera del panel). */
export const MENU_ABIERTO = '.pulso-select-content[data-state="open"]';

/** Atiende un Escape si hay un desplegable abierto; devuelve si lo atendió. */
export function atenderEscapeDelMenu(evento: KeyboardEvent, ventana: Window): boolean {
  if (evento.key !== "Escape" || !ventana.document.querySelector(MENU_ABIERTO)) return false;
  evento.stopImmediatePropagation();
  evento.preventDefault();
  ventana.dispatchEvent(new Event("resize"));
  return true;
}

/** Instala la escucha; devuelve cómo quitarla. */
export function instalarEscapeDelMenu(ventana: Window): () => void {
  const alTeclear = (evento: KeyboardEvent) => {
    atenderEscapeDelMenu(evento, ventana);
  };
  ventana.addEventListener("keydown", alTeclear, true);
  return () => ventana.removeEventListener("keydown", alTeclear, true);
}

export function useEscapeDelMenu(activo: boolean) {
  useEffect(() => {
    if (!activo) return undefined;
    return instalarEscapeDelMenu(window);
  }, [activo]);
}
