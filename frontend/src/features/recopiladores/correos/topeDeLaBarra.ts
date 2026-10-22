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

/**
 * ¿La cabecera pegada ya no cabe en lo que queda a la vista de su caja? Una
 * cabecera `sticky` sube con el final de su caja: al final del desplazamiento
 * quedaba 20 px debajo de la barra del correo (residuo del #17, 1024 × 600).
 * Cuando lo que queda de la caja bajo `arriba` es más bajo que la cabecera,
 * la cabecera se oculta; vuelve al subir.
 */
export function cabezaSinLugar(entrada: { abajoDeLaCaja: number; altoDeLaCabeza: number; arribaVisible: number }): boolean {
  return entrada.abajoDeLaCaja - entrada.arribaVisible < entrada.altoDeLaCabeza;
}

/** Lo más alto que se ve de `el`: el borde de su dueño del scroll o, si la comparte, el pie de la barra del correo. */
export function arribaVisibleDe(el: HTMLElement, barra: HTMLElement | null): number {
  const dueno = duenoDelScroll(el);
  let arriba = dueno ? dueno.getBoundingClientRect().top + dueno.clientTop : 0;
  if (barra && dueno?.contains(barra)) arriba = Math.max(arriba, barra.getBoundingClientRect().bottom);
  return arriba;
}

/** `cabezaSinLugar` medido al desplazar y al cambiar el tamaño de la ventana. */
export function useCabezaSinLugar(ref: RefObject<HTMLElement | null>, selectorDeLaCabeza: string): boolean {
  const [sinLugar, setSinLugar] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const barra = document.querySelector<HTMLElement>(SELECTOR_DE_LA_BARRA);
    let cuadro = 0;
    const medir = () => {
      cuadro = 0;
      const cabeza = el.querySelector<HTMLElement>(selectorDeLaCabeza);
      if (!cabeza) return;
      setSinLugar(cabezaSinLugar({
        abajoDeLaCaja: el.getBoundingClientRect().bottom,
        altoDeLaCabeza: cabeza.offsetHeight,
        arribaVisible: arribaVisibleDe(el, barra),
      }));
    };
    const pedir = () => { if (!cuadro) cuadro = requestAnimationFrame(medir); };
    medir();
    document.addEventListener("scroll", pedir, true);
    window.addEventListener("resize", pedir);
    return () => {
      if (cuadro) cancelAnimationFrame(cuadro);
      document.removeEventListener("scroll", pedir, true);
      window.removeEventListener("resize", pedir);
    };
  }, [ref, selectorDeLaCabeza]);
  return sinLugar;
}
