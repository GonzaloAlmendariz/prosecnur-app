import { useLayoutEffect, useRef, useState } from "react";

/** Hay contenido escondido a la derecha (1 px de tolerancia por redondeo). */
export function desbordaHorizontal(scrollWidth: number, clientWidth: number): boolean {
  return scrollWidth - clientWidth > 1;
}

/**
 * Mide si un contenedor desborda en horizontal y lo vuelve a medir cuando él o
 * su contenido cambian de tamaño. La pastilla «Desplaza para ver más» se
 * pinta sólo si es verdad (G5).
 */
export function useDesbordaHorizontal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [desborda, setDesborda] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setDesborda(desbordaHorizontal(el.scrollWidth, el.clientWidth));
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    if (el.firstElementChild) observador.observe(el.firstElementChild);
    return () => observador.disconnect();
  }, []);

  return { ref, desborda };
}
