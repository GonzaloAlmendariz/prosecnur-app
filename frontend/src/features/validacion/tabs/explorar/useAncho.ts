import { useCallback, useLayoutEffect, useState } from "react";

/**
 * Tamaño real del contenedor, para que el SVG de un gráfico ocupe su tarjeta en
 * vez de quedarse en un viewBox fijo escalado (a 1440 dejaba media tarjeta vacía).
 * Ref de callback, como `useAnchoMedido` de Monitoreo: la caja puede montarse
 * después que el componente. Sin medir (render en servidor o test) devuelve el
 * ancho por defecto y alto 0.
 *
 * El alto sirve a D3 (el gráfico llena su tarjeta): la caja crece con la tarjeta,
 * no con el SVG —que va posicionado dentro—, así que medirla no se retroalimenta.
 */
export function useAncho<T extends HTMLElement>(porDefecto = 640) {
  const [nodo, setNodo] = useState<T | null>(null);
  const [tam, setTam] = useState({ ancho: 0, alto: 0 });
  const ref = useCallback((elemento: T | null) => setNodo(elemento), []);
  useLayoutEffect(() => {
    if (!nodo) return undefined;
    const medir = () => {
      const caja = nodo.getBoundingClientRect();
      const ancho = Math.round(caja.width);
      const alto = Math.round(caja.height);
      setTam((previo) => (Math.abs(previo.ancho - ancho) < 1 && Math.abs(previo.alto - alto) < 1 ? previo : { ancho, alto }));
    };
    medir();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [nodo]);
  return [ref, tam.ancho > 0 ? tam.ancho : porDefecto, tam.alto] as const;
}
