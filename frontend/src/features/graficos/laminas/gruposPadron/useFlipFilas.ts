// R8-4: al subir o bajar un grupo, la fila se desliza a su lugar nuevo (FLIP, sólo `transform`) en vez de cambiar sólo el
// número. Mide la posición de layout (`offsetTop`, sin la transformación en curso) de cada `[data-flip]` en cada render y
// anima sólo cuando cambia el orden. Con movimiento reducido no se desliza: la fila aparece en su sitio. La duración y la
// curva son los tokens de movimiento (`--motion-dur-base`, `--motion-ease-out`). Si al mover la fila el foco cae al
// documento, vuelve al control que lo tenía (Subir y Bajar siguen usables con el teclado).

import { useLayoutEffect, useRef, type RefObject } from "react";
import { desplazamientosFlip, type Punto } from "../../vistaGeneral/flip";

const DURACION_POR_DEFECTO = 220;
const CURVA_POR_DEFECTO = "cubic-bezier(0.23, 1, 0.32, 1)";

function tiempos(el: Element): { duracion: number; curva: string } {
  const estilo = getComputedStyle(el);
  const crudo = estilo.getPropertyValue("--motion-dur-base").trim();
  const ms = crudo.endsWith("ms") ? Number(crudo.slice(0, -2)) : crudo.endsWith("s") ? Number(crudo.slice(0, -1)) * 1000 : NaN;
  const curva = estilo.getPropertyValue("--motion-ease-out").trim();
  return { duracion: Number.isFinite(ms) && ms > 0 ? ms : DURACION_POR_DEFECTO, curva: curva || CURVA_POR_DEFECTO };
}

const reducido = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function useFlipFilas(lista: RefObject<HTMLElement | null>, orden: string): void {
  const previas = useRef<Map<string, Punto>>(new Map());
  const ordenPrevio = useRef(orden);
  const enfocado = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const el = lista.current;
    if (!el) return;
    const recordar = (e: FocusEvent) => { if (e.target instanceof HTMLElement) enfocado.current = e.target; };
    el.addEventListener("focusin", recordar);
    return () => el.removeEventListener("focusin", recordar);
  }, [lista]);

  useLayoutEffect(() => {
    const el = lista.current;
    if (!el) return;
    const filas = [...el.querySelectorAll<HTMLElement>("[data-flip]")];
    const ahora = new Map(filas.map((f) => [f.dataset.flip ?? "", { x: 0, y: f.offsetTop }]));
    const antes = previas.current;
    const cambio = ordenPrevio.current !== orden;
    previas.current = ahora;
    ordenPrevio.current = orden;
    if (!cambio) return;
    const foco = enfocado.current;
    if (foco && foco.isConnected && el.contains(foco) && document.activeElement !== foco
      && (document.activeElement === null || document.activeElement === document.body)) foco.focus({ preventScroll: true });
    if (reducido()) return;
    const { duracion, curva } = tiempos(el);
    const porId = new Map(filas.map((f) => [f.dataset.flip ?? "", f]));
    for (const d of desplazamientosFlip(antes, ahora)) {
      const fila = porId.get(d.id);
      if (!fila || typeof fila.animate !== "function") continue;
      fila.animate([{ transform: `translateY(${d.dy}px)` }, { transform: "none" }], { duration: duracion, easing: curva });
    }
  });
}
