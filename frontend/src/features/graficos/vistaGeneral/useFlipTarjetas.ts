// FLIP de las tarjetas al reordenar (F6.3). Antes de pintar el orden nuevo se recuerda dónde estaba cada tarjeta; tras
// pintarlo, cada una parte de su sitio viejo y llega al nuevo en 180 ms con la curva de salida de la casa. Sólo
// `transform`: no hay reflujo. Con `prefers-reduced-motion` no hay recorrido: la tarjeta movida aparece con un fundido
// corto en su sitio nuevo (el desplazamiento de la página no se toca).
// I8 del rediseño (2026-10-14): una tarjeta NUEVA (agregada o duplicada) aparece creciendo desde 0.94 con un destello del
// acento, y la que el usuario movió (la elegida o la que tiene el foco) destella al llegar: así se ve dónde quedó. Las
// vecinas que sólo se corren no destellan, para no llenar de ruido el clasificador.

import { useLayoutEffect, useRef, type RefObject } from "react";
import { desplazamientosFlip, tarjetasNuevas, type Punto } from "./flip";

const SELECTOR = "[data-vg-tarjeta]";
const DURACION_MS = 180;
const CURVA = "cubic-bezier(0.23, 1, 0.32, 1)";

function medir(raiz: HTMLElement): Map<string, Punto> {
  const m = new Map<string, Punto>();
  raiz.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
    const id = el.dataset.vgTarjeta;
    if (!id) return;
    const r = el.getBoundingClientRect();
    m.set(id, { x: r.left, y: r.top });
  });
  return m;
}

const sinMovimiento = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** `orden` cambia cuando el plan se reordena; con cualquier otro render no se anima nada. */
export function useFlipTarjetas(raiz: RefObject<HTMLElement>, orden: string): void {
  const previas = useRef<Map<string, Punto> | null>(null);
  const ordenPrevio = useRef(orden);

  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const ahora = medir(el);
    const antes = previas.current;
    const cambio = ordenPrevio.current !== orden;
    ordenPrevio.current = orden;
    previas.current = ahora;
    if (!antes || !cambio || typeof el.animate !== "function") return;
    const reducido = sinMovimiento();
    const acento = getComputedStyle(el).getPropertyValue("--module-accent").trim() || "currentColor";
    const destello = (tarjeta: HTMLElement) => tarjeta.animate(
      [{ boxShadow: `0 0 0 3px ${acento}` }, { boxShadow: `0 0 0 3px ${acento}`, offset: 0.35 }, { boxShadow: "0 0 0 0 transparent" }],
      { duration: reducido ? 600 : 900, easing: "ease-out" },
    );
    const porId = (id: string) => el.querySelector<HTMLElement>(`${SELECTOR}[data-vg-tarjeta="${CSS.escape(id)}"]`);
    for (const id of tarjetasNuevas(antes, ahora)) {
      const tarjeta = porId(id);
      if (!tarjeta || typeof tarjeta.animate !== "function") continue;
      if (!reducido) tarjeta.animate([{ opacity: 0, transform: "scale(0.94)" }, { opacity: 1, offset: 0.6 }, { transform: "none" }], { duration: 420, easing: CURVA });
      destello(tarjeta);
    }
    for (const { id, dx, dy } of desplazamientosFlip(antes, ahora)) {
      const tarjeta = porId(id);
      if (!tarjeta || typeof tarjeta.animate !== "function") continue;
      if (tarjeta.classList.contains("is-seleccionada") || tarjeta === document.activeElement) destello(tarjeta);
      if (reducido) {
        tarjeta.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 120, easing: "linear" });
      } else {
        tarjeta.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
          { duration: DURACION_MS, easing: CURVA },
        );
      }
    }
  });

  // Tras desplazar o redimensionar, la medida guardada ya no vale como «antes»: se rehace en el próximo render.
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const olvidar = () => { if (raiz.current) previas.current = medir(raiz.current); };
    el.addEventListener("scroll", olvidar, { passive: true });
    window.addEventListener("resize", olvidar);
    return () => { el.removeEventListener("scroll", olvidar); window.removeEventListener("resize", olvidar); };
  }, [raiz]);
}
