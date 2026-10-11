// =============================================================================
// shell/coachmarkFocus.ts — foco del tour de primer uso (L8)
// =============================================================================
// El callout del tour es un diálogo modal (`aria-modal`) posicionado junto a su
// target, así que no puede ir sobre el `Dialog` del kit (centrado). Este hook
// le da lo que el kit daría: foco inicial en el callout, Tab atrapado dentro,
// Escape para salir y foco de vuelta a lo que estaba enfocado al abrirse.
// =============================================================================

import { useEffect, useRef, type RefObject } from "react";

const ENFOCABLES =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * A dónde va el foco con Tab dentro de un trap. `null` = el navegador lo
 * resuelve (no se sale del contenedor). Si el foco está fuera de los
 * enfocables (p. ej. en el contenedor mismo), entra por el extremo que toca.
 */
export function siguienteFocoAtrapado<T>(enfocables: readonly T[], activo: T | null, atras: boolean): T | null {
  if (!enfocables.length) return null;
  const primero = enfocables[0]!;
  const ultimo = enfocables[enfocables.length - 1]!;
  const indice = activo === null ? -1 : enfocables.indexOf(activo);
  if (indice === -1) return atras ? ultimo : primero;
  if (atras && indice === 0) return ultimo;
  if (!atras && indice === enfocables.length - 1) return primero;
  return null;
}

/**
 * Foco modal del callout. `activo` se vuelve `true` cuando el callout está en
 * el DOM; `paso` re-enfoca el callout al avanzar para que se anuncie el nuevo.
 */
export function useFocoDeCoachmark(
  activo: boolean,
  paso: number,
  contenedor: RefObject<HTMLElement | null>,
  alEscape: () => void,
) {
  const previo = useRef<HTMLElement | null>(null);
  const escape = useRef(alEscape);
  escape.current = alEscape;

  // Recordar lo enfocado al abrirse y devolverle el foco al cerrarse.
  useEffect(() => {
    if (!activo) return;
    const enfocado = document.activeElement;
    previo.current =
      enfocado instanceof HTMLElement && enfocado !== document.body && !contenedor.current?.contains(enfocado)
        ? enfocado
        : null;
    return () => {
      const destino = previo.current;
      previo.current = null;
      if (destino && destino.isConnected) destino.focus();
    };
  }, [activo, contenedor]);

  // Foco inicial (y en cada paso) sobre el callout.
  useEffect(() => {
    if (activo) contenedor.current?.focus();
  }, [activo, paso, contenedor]);

  useEffect(() => {
    if (!activo) return;
    function onKey(event: KeyboardEvent) {
      const raiz = contenedor.current;
      if (!raiz) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        escape.current();
        return;
      }
      if (event.key !== "Tab") return;
      const enfocables = Array.from(raiz.querySelectorAll<HTMLElement>(ENFOCABLES));
      const actual = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const fuera = !actual || !raiz.contains(actual);
      const destino = siguienteFocoAtrapado(enfocables, fuera ? null : actual, event.shiftKey);
      if (destino) {
        event.preventDefault();
        destino.focus();
      } else if (!enfocables.length) {
        event.preventDefault();
        raiz.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [activo, contenedor]);
}
