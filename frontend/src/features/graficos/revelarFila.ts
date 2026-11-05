// H10: una fila recién agregada (rótulo corto, capítulo, hallazgo, nombre corto de un grupo) se trae a la vista y su
// primer campo recibe el foco. Sólo se desplaza el dueño del scroll más cercano (el cuerpo del inspector, el de
// Identidad): `scrollIntoView` y `focus()` a secas corrían también los contenedores de arriba (`.pulso-f6-laminas`).

import "./revelarFila.css";

const CONTROL = "input:not([type='hidden']):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])";

/** El ancestro más cercano con scroll vertical propio, o null. */
export function duenoDelScroll(el: Element): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/** Desplazamiento que deja `fila` entera a la vista dentro de `dueno` (o lo más arriba posible si no cabe). */
export function desplazamientoParaVer(dueno: { top: number; bottom: number }, fila: { top: number; bottom: number }, margen = 12): number {
  if (fila.top - margen < dueno.top) return fila.top - dueno.top - margen;
  if (fila.bottom + margen > dueno.bottom) {
    const bajar = fila.bottom - dueno.bottom + margen;
    return Math.min(bajar, fila.top - dueno.top - margen);
  }
  return 0;
}

/** Lo que dura la marca de fila recién llegada (revelarFila.css: tres veces --motion-dur-slow). */
const MARCA_MS = 1300;

const sinMovimiento = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** Trae `fila` a la vista en su dueño de scroll y enfoca su primer control sin mover nada más. */
export function revelarYEnfocar(fila: Element): void {
  const dueno = duenoDelScroll(fila);
  if (dueno) {
    const delta = desplazamientoParaVer(dueno.getBoundingClientRect(), fila.getBoundingClientRect());
    if (delta !== 0) dueno.scrollTo({ top: dueno.scrollTop + delta, behavior: sinMovimiento() ? "auto" : "smooth" });
  }
  fila.setAttribute("data-recien", "");
  window.setTimeout(() => fila.removeAttribute("data-recien"), MARCA_MS);
  const control = fila.matches(CONTROL) ? fila : fila.querySelector<HTMLElement>(CONTROL);
  if (control instanceof HTMLElement) control.focus({ preventScroll: true });
}

/**
 * Espera a que la fila exista (se agrega en el mismo clic y React la pinta después) y la revela. Intenta unos pocos
 * cuadros y desiste en silencio: si la fila no llegó, no hay nada que mostrar.
 */
export function revelarFilaNueva(raiz: ParentNode | null | undefined, selector: string, intentos = 8): void {
  if (!raiz || typeof requestAnimationFrame === "undefined") return;
  const paso = (n: number) => {
    const fila = raiz.querySelector(selector);
    if (fila) revelarYEnfocar(fila);
    else if (n > 0) requestAnimationFrame(() => paso(n - 1));
  };
  requestAnimationFrame(() => paso(intentos));
}

/** El selector de una fila marcada con `data-fila`. */
export const selectorFila = (clave: string) => `[data-fila="${clave.replace(/["\\]/g, "\\$&")}"]`;
