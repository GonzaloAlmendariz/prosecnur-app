import { useEffect, useState, type RefObject } from "react";
import { ladoDelDesborde, type Desborde } from "./modeloTablaDeCasos";

/**
 * Hacia dónde tiene contenido fuera de la vista un elemento que se desplaza en
 * horizontal. La tabla de casos lo usa para desvanecer el borde por donde sigue
 * (con barras de desplazamiento ocultas, como en macOS, no habría otra señal).
 */
export function useDesbordeHorizontal(ref: RefObject<HTMLElement | null>): Desborde {
  const [desborde, setDesborde] = useState<Desborde>("ninguno");
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const medir = () => setDesborde(ladoDelDesborde(el.scrollLeft, el.clientWidth, el.scrollWidth));
    medir();
    el.addEventListener("scroll", medir, { passive: true });
    const observador = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(medir);
    observador?.observe(el);
    return () => {
      el.removeEventListener("scroll", medir);
      observador?.disconnect();
    };
  }, [ref]);
  return desborde;
}
