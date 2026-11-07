import { useLayoutEffect } from "react";

/**
 * Foco de vuelta para un overlay que todavía no es el `Dialog` del kit.
 *
 * El kit recuerda lo enfocado al abrir y lo devuelve al cerrar; un overlay
 * propio (con su `role="dialog"` y su portal) no lo hace, y abierto por
 * dirección deja el foco en `body` al cerrarse. Pasó con Configuración abierta
 * desde «Configurar credenciales» en Carga (L7): se volvía al mismo paso, pero
 * el teclado arrancaba otra vez desde arriba de la página.
 *
 * Es `useLayoutEffect` a propósito: corre antes que los `useEffect` del
 * overlay, que suelen mover el foco a su botón cerrar, así que lee lo enfocado
 * ANTES de que el overlay lo tome. Si al cerrar ese elemento ya no está en el
 * DOM, no hace nada.
 */
export function useFocoDeVuelta(abierto: boolean): void {
  useLayoutEffect(() => {
    if (!abierto) return undefined;
    const activo = document.activeElement;
    const previo = activo instanceof HTMLElement && activo !== document.body ? activo : null;
    return () => {
      if (previo?.isConnected) previo.focus();
    };
  }, [abierto]);
}
