// Las filas de una lista que cambia de orden se deslizan a su lugar (ítem 3 de la oleada del inspector, 2026-11-08): al
// pasar el cursor por otro modo de «Orden», cada categoría viaja de donde estaba a donde la pone ese modo, con transform
// (Web Animations; ninguna transición de layout). Con movimiento reducido, salta sin animar.

import { useLayoutEffect, useRef, type MutableRefObject } from "react";

const DURACION_MS = 180;

export function useReordenAnimado(items: MutableRefObject<Map<string, HTMLElement>>, orden: readonly string[]): void {
  const antes = useRef(new Map<string, number>());
  const firma = orden.join("\u0001");
  useLayoutEffect(() => {
    const ahora = new Map<string, number>();
    items.current.forEach((el, clave) => ahora.set(clave, el.offsetTop));
    const reducido = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!reducido) {
      items.current.forEach((el, clave) => {
        const desde = antes.current.get(clave);
        const hasta = ahora.get(clave);
        if (desde === undefined || hasta === undefined || desde === hasta || typeof el.animate !== "function") return;
        el.animate([{ transform: `translateY(${desde - hasta}px)` }, { transform: "translateY(0)" }], {
          duration: DURACION_MS, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        });
      });
    }
    antes.current = ahora;
  }, [firma, items]);
}
