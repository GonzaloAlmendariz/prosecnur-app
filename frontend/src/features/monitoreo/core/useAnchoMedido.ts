import { useCallback, useLayoutEffect, useState } from "react";

/**
 * El ancho real, en px, de una caja que el navegador estira (un SVG con
 * `preserveAspectRatio="none"` o una pista de rótulos al 100 %). Lo piden los
 * ejes de fechas de dos líneas (core/ejeDeFechas) para decidir cuántos días
 * caben sin montarse. Devuelve 0 hasta medir (y en un render sin DOM): quien
 * lo usa pone su estimación.
 *
 * Ref de callback y no `useRef`: la caja puede montarse después que el
 * componente (un gráfico que aparece cuando llega la serie).
 */
export function useAnchoMedido<T extends HTMLElement>() {
  const [nodo, setNodo] = useState<T | null>(null);
  const [ancho, setAncho] = useState(0);
  const ref = useCallback((elemento: T | null) => setNodo(elemento), []);
  useLayoutEffect(() => {
    if (!nodo) return undefined;
    const medir = () => {
      const actual = nodo.getBoundingClientRect().width;
      setAncho((previo) => (Math.abs(previo - actual) < 1 ? previo : actual));
    };
    medir();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [nodo]);
  return [ref, ancho] as const;
}
