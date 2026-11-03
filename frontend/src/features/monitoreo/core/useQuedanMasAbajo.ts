import { useLayoutEffect, useRef, useState } from "react";

/** Queda contenido bajo el borde inferior (1 px de tolerancia por redondeo). */
export function quedanMasAbajo(scrollHeight: number, scrollTop: number, clientHeight: number): boolean {
  return scrollHeight - scrollTop - clientHeight > 1;
}

/**
 * Mide si una lista que desplaza en vertical esconde algo abajo, y lo vuelve a
 * medir al desplazarla o cuando ella o sus hijos cambian de tamaño. El
 * desvanecido del pie se pinta sólo si es verdad: una tarjeta cortada sin él
 * se lee como render roto, no como «hay más».
 */
export function useQuedanMasAbajo<T extends HTMLElement>(clave: unknown) {
  const ref = useRef<T>(null);
  const [quedan, setQuedan] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setQuedan(quedanMasAbajo(el.scrollHeight, el.scrollTop, el.clientHeight));
    medir();
    el.addEventListener("scroll", medir, { passive: true });
    let observador: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observador = new ResizeObserver(medir);
      observador.observe(el);
      for (const hijo of Array.from(el.children)) observador.observe(hijo);
    }
    return () => {
      el.removeEventListener("scroll", medir);
      observador?.disconnect();
    };
  }, [clave]);

  return { ref, quedan };
}
