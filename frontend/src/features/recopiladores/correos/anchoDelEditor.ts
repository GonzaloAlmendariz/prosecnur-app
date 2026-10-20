// anchoDelEditor.ts — cuándo la columna de plantillas y bloques se pliega (F3).
//
// A 1024×600 el editor tenía tres columnas y el lienzo escalaba el correo a
// 0,506: el texto de 16 px se leía como de 8. Por debajo de 1200 px de ancho
// útil la columna izquierda pasa a un cajón que se abre desde la barra, y el
// lienzo se queda con ese ancho (≥ 600 px a 1024, escala ≥ 0,8).
//
// El ancho se mide sobre el contenedor del editor (no la ventana): es el mismo
// que lee el `@container rec-mail` del CSS.

import { useCallback, useRef, useState } from "react";

/** Ancho útil del editor por debajo del cual la columna de bloques va a un cajón. */
export const ANCHO_CON_CAJON = 1200;

export function conCajon(ancho: number): boolean {
  return ancho > 0 && ancho < ANCHO_CON_CAJON;
}

/**
 * `ref` para el contenedor del editor y si va en régimen de cajón. Sin
 * ResizeObserver (tests de render) se queda en tres columnas.
 */
export function useConCajon(): [(el: HTMLElement | null) => void, boolean] {
  const [cajon, setCajon] = useState(false);
  const observador = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLElement | null) => {
    observador.current?.disconnect();
    observador.current = null;
    if (!el || typeof ResizeObserver === "undefined") return;
    setCajon(conCajon(el.getBoundingClientRect().width));
    const obs = new ResizeObserver((entradas) => {
      setCajon(conCajon(entradas[0]?.contentRect.width ?? 0));
    });
    obs.observe(el);
    observador.current = obs;
  }, []);
  return [ref, cajon];
}

/**
 * F8: con el panel como único dueño del scroll, cambiar de pestaña con el
 * inspector ya recorrido dejaba ver sólo las pestañas (pegadas arriba) y un
 * hueco. Si el comienzo del panel quedó bajo ellas, se trae justo debajo.
 */
export function mostrarInicioDelPanel(panel: HTMLElement | null, pestanas: HTMLElement | null): void {
  if (!panel || !pestanas) return;
  const tope = pestanas.getBoundingClientRect().bottom;
  const inicio = panel.getBoundingClientRect().top;
  if (inicio >= tope - 1) return;
  let dueño: HTMLElement | null = panel.parentElement;
  while (dueño) {
    const { overflowY } = getComputedStyle(dueño);
    if ((overflowY === "auto" || overflowY === "scroll") && dueño.scrollHeight > dueño.clientHeight) break;
    dueño = dueño.parentElement;
  }
  dueño?.scrollBy({ top: inicio - tope - 8 });
}
