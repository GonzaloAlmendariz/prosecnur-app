// Mide si una tabla cabe en su marco (U2).
//
// El marco sólo se vuelve dueño de desplazamiento horizontal cuando la tabla NO
// cabe. Un `overflow-x: auto` permanente lo convertía en contenedor de scroll en
// los dos ejes y la cabecera sticky se pegaba al marco, que no se mueve, en vez
// de al dueño de scroll de Carga: con tres bases, que siempre caben, se perdía
// el rótulo de cada columna a media lista sin ganar nada a cambio.

import { useCallback, useRef, useState } from "react";

export function useDesbordeHorizontal(): [(el: HTMLElement | null) => void, boolean] {
  const [desborda, setDesborda] = useState(false);
  const observador = useRef<ResizeObserver | null>(null);

  const ref = useCallback((marco: HTMLElement | null) => {
    observador.current?.disconnect();
    observador.current = null;
    if (!marco) return;
    const medir = () => setDesborda(marco.scrollWidth > marco.clientWidth + 1);
    medir();
    if (typeof ResizeObserver === "undefined") return;
    observador.current = new ResizeObserver(medir);
    observador.current.observe(marco);
    // La tabla crece sin que el marco cambie de tamaño (una base más, una
    // fila nueva): también se observa.
    const tabla = marco.querySelector("table");
    if (tabla) observador.current.observe(tabla);
  }, []);

  return [ref, desborda];
}
