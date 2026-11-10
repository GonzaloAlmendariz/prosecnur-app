// La descarga de la lámina cuelga del eje de su botón (ADR 0133, regla 5). La barra del visor recorta lo que se
// sale (`overflow: hidden`), así que el contenedor no puede vivir junto al botón: vive en una franja sin alto bajo
// la barra y se corre hasta que su borde derecho coincide con el del botón. Aquí se mide cuánto.

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

type Borde = { right: number };

/** Distancia (px) del borde derecho del ancla al del botón; 0 si el botón se sale del ancla por la derecha. */
export function distanciaAlEje(ancla: Borde, disparador: Borde): number {
  return Math.max(0, Math.round(ancla.right - disparador.right));
}

/**
 * Refs del ancla y del botón, y el estilo del ancla con `--pulso-f6-entrega-derecha`. Mide en cada render (dos
 * rectángulos) y cuando el ancla cambia de ancho; guarda la última medida si el botón desaparece.
 */
export function useEjeDeEntrega(activo: boolean) {
  const ancla = useRef<HTMLDivElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);
  const [derecha, setDerecha] = useState(0);

  useLayoutEffect(() => {
    if (!activo) return;
    const medir = () => {
      const a = ancla.current;
      const d = disparador.current;
      if (a && d) setDerecha(distanciaAlEje(a.getBoundingClientRect(), d.getBoundingClientRect()));
    };
    medir();
    if (typeof ResizeObserver === "undefined" || !ancla.current) return;
    const observador = new ResizeObserver(medir);
    observador.observe(ancla.current);
    return () => observador.disconnect();
  });

  const estilo = { "--pulso-f6-entrega-derecha": `${derecha}px` } as CSSProperties;
  return { ancla, disparador, estilo };
}
