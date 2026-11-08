// R9-3: la barra del visor se compacta por lo que CABE, no sólo por umbrales fijos. Con «Previsualizar» encendido y el
// Inspector abierto, a 1280 la barra pedía 869 px en 806 y «Ajustes» quedaba recortado 63 px detrás del overflow. Los
// umbrales del container query (visorLamina.css) siguen; esto sube un nivel más cada vez que la barra todavía desborda.
// Los rótulos se ocultan sólo a la vista: el nombre accesible y el tooltip quedan.

import { useLayoutEffect, useState, type RefObject } from "react";

/** Niveles de compactación: 1 oculta los rótulos medios, 2 los estrechos, 3 los angostos (y «Previsualizar»). */
export const NIVEL_MAXIMO_BARRA = 3;

/**
 * El primer nivel en el que la barra cabe, probando de menos a más. `aplicar(n)` pone el nivel y `desborda()` mide;
 * si ni el último cabe, queda el último (el overflow de la barra sigue siendo el dueño).
 */
export function nivelQueCabe(aplicar: (n: number) => void, desborda: () => boolean, maximo = NIVEL_MAXIMO_BARRA): number {
  for (let n = 0; n <= maximo; n += 1) {
    aplicar(n);
    if (!desborda()) return n;
  }
  return maximo;
}

/** Observa la barra (su tamaño y lo que entra o sale de ella) y devuelve el nivel que cabe. */
export function useBarraCompacta(ref: RefObject<HTMLElement | null>): number {
  const [nivel, setNivel] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const medir = () => setNivel(nivelQueCabe(
      (n) => { el.dataset.compacta = String(n); },
      () => el.scrollWidth > el.clientWidth + 1,
    ));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    // Los botones que aparecen al previsualizar (descarga, guías, avisos) no cambian el tamaño de la barra: se oyen aparte.
    const mo = typeof MutationObserver === "undefined" ? null : new MutationObserver(medir);
    mo?.observe(el, { childList: true, subtree: true, characterData: true });
    return () => { ro.disconnect(); mo?.disconnect(); };
  }, [ref]);
  return nivel;
}
