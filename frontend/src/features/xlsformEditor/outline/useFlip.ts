import { useCallback, useMemo, useRef, type RefObject } from "react";

// FLIP de la Estructura (C2, 2026-10-17): antes de un cambio se anota dónde se VE cada línea; después del cambio,
// cada una arranca desde ahí y se desliza a su lugar nuevo. Se mide la ranura exterior (`[data-linea]`, la caja de
// layout) y se anima la fila de adentro, así una medición nunca lee una posición a mitad de animación.

export const FLIP_MS = 240;
export const FLIP_EASING = "cubic-bezier(.22, 1, .36, 1)";

export function movimientoReducido(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function useFlip(raiz: RefObject<HTMLElement | null>) {
  const antes = useRef<Map<string, number> | null>(null);

  /** Anota las posiciones visibles. Llamar justo antes del setState que mueve las líneas. */
  const capturar = useCallback(() => {
    const el = raiz.current;
    if (!el || movimientoReducido()) return;
    const m = new Map<string, number>();
    // Sólo las líneas a la vista (con un margen): en una lista de 800 líneas animar las que nadie ve sólo cuesta
    // cuadros, y el auto-scroll del arrastre se arrastraba a pocos px por segundo.
    const caja = el.getBoundingClientRect();
    const alto = caja.height;
    el.querySelectorAll<HTMLElement>("[data-linea]").forEach((ranura) => {
      const fila = ranura.firstElementChild;
      if (!(fila instanceof HTMLElement)) return;
      const r = fila.getBoundingClientRect();
      if (r.height > 0 && r.bottom > caja.top - alto && r.top < caja.bottom + alto) m.set(ranura.dataset.linea ?? "", r.top);
    });
    antes.current = m;
  }, [raiz]);

  /** Desliza cada línea desde donde se veía. Llamar en un layout effect después del cambio. */
  const animar = useCallback(() => {
    const m = antes.current;
    antes.current = null;
    const el = raiz.current;
    if (!m || !el || m.size === 0) return;
    el.querySelectorAll<HTMLElement>("[data-linea]").forEach((ranura) => {
      const previo = m.get(ranura.dataset.linea ?? "");
      if (previo == null) return;
      const fila = ranura.firstElementChild;
      if (previo == null || !(fila instanceof HTMLElement) || typeof fila.animate !== "function") return;
      const r = ranura.getBoundingClientRect();
      if (r.height === 0) return;
      for (const a of fila.getAnimations()) if (a.id === "xfe-flip") a.cancel();
      const d = previo - r.top;
      if (Math.abs(d) < 0.5) return;
      fila.animate([{ transform: `translateY(${d}px)` }, { transform: "none" }], {
        duration: FLIP_MS,
        easing: FLIP_EASING,
        id: "xfe-flip",
      });
    });
  }, [raiz]);

  return useMemo(() => ({ capturar, animar }), [capturar, animar]);
}
