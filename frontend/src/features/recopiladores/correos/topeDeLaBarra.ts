// topeDeLaBarra.ts — cuánto tapa la barra del correo arriba de la capa.
//
// A 1024 × 600 el panel entero hace scroll y la barra del correo queda pegada
// arriba; la cabecera pegada de la biblioteca («Insertar aquí» y su ✕) quedaba
// debajo de ella (#17 del re-QA e10). Su `top` es el alto de la barra cuando
// la barra vive en el mismo contenedor que hace scroll; si no (el lienzo hace
// su propio scroll), cero.

import { useLayoutEffect, useState, type RefObject } from "react";

const SELECTOR_DE_LA_BARRA = ".rec-mail-barra";

/** El contenedor que hace scroll de `el`: el primer ancestro con overflow auto o scroll. */
export function duenoDelScroll(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(p).overflowY)) return p;
  }
  return null;
}

/** El alto de la barra si comparte el contenedor que hace scroll con `el`; si no, 0. */
export function topeDeLaBarra(el: HTMLElement, barra: HTMLElement | null): number {
  if (!barra) return 0;
  const dueno = duenoDelScroll(el);
  if (!dueno || !dueno.contains(barra)) return 0;
  return Math.ceil(barra.getBoundingClientRect().height);
}

/** El tope medido mientras `activo`: se vuelve a medir al desplazar y al cambiar la barra de alto. */
export function useTopeDeLaBarra(ref: RefObject<HTMLElement | null>, activo: boolean): number {
  const [tope, setTope] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !activo) return;
    const barra = document.querySelector<HTMLElement>(SELECTOR_DE_LA_BARRA);
    let cuadro = 0;
    const medir = () => { cuadro = 0; setTope(topeDeLaBarra(el, barra)); };
    const pedir = () => { if (!cuadro) cuadro = requestAnimationFrame(medir); };
    medir();
    document.addEventListener("scroll", pedir, true);
    window.addEventListener("resize", pedir);
    const obs = typeof ResizeObserver !== "undefined" && barra ? new ResizeObserver(pedir) : null;
    if (obs && barra) obs.observe(barra);
    return () => {
      if (cuadro) cancelAnimationFrame(cuadro);
      document.removeEventListener("scroll", pedir, true);
      window.removeEventListener("resize", pedir);
      obs?.disconnect();
    };
  }, [activo, ref]);
  return tope;
}
