// Re-encaje del lienzo (contrato de movimiento F6, M11): cuando un lateral entra o sale, el grid salta a su plantilla
// en un frame y la lámina cambia de tamaño y de sitio. En vez de animar el layout, se anima la HOJA con FLIP: se mide
// antes (en el render, con el DOM todavía viejo) y después (en el layout effect), se aplica la transformación inversa y
// se suelta hacia `none`. Sólo `transform`; interrumpible porque la medida de «antes» incluye la transformación viva.
// Con movimiento reducido no hay desplazamiento: un fundido corto de opacidad.

import { useLayoutEffect, useRef, type RefObject } from "react";

const SELECTOR_HOJA = ".pulso-f6-hoja";

function msDeToken(nombre: string, porDefecto: number): number {
  if (typeof document === "undefined") return porDefecto;
  const crudo = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  const n = Number.parseFloat(crudo);
  if (!Number.isFinite(n)) return porDefecto;
  return crudo.endsWith("ms") ? n : crudo.endsWith("s") ? n * 1000 : n;
}

function tokenTexto(nombre: string, porDefecto: string): string {
  if (typeof document === "undefined") return porDefecto;
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim() || porDefecto;
}

function movimientoReducido(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Diferencia entre dos cajas como transformación FLIP (centro a centro, escala por ancho). */
export function deltaFlip(antes: Pick<DOMRect, "left" | "top" | "width" | "height">, despues: Pick<DOMRect, "left" | "top" | "width" | "height">) {
  if (despues.width <= 0 || despues.height <= 0) return null;
  const dx = antes.left + antes.width / 2 - (despues.left + despues.width / 2);
  const dy = antes.top + antes.height / 2 - (despues.top + despues.height / 2);
  const s = antes.width / despues.width;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(s - 1) < 0.005) return null;
  return { dx, dy, s };
}

export function useReencajeLienzo(raiz: RefObject<HTMLElement>, clave: string): void {
  const claveVista = useRef(clave);
  const antes = useRef<DOMRect | null>(null);
  const animacion = useRef<Animation | null>(null);

  // Medida «First»: durante el render en que cambia la clave, el DOM aún muestra la plantilla anterior.
  if (claveVista.current !== clave && antes.current === null) {
    antes.current = raiz.current?.querySelector<HTMLElement>(SELECTOR_HOJA)?.getBoundingClientRect() ?? null;
  }

  useLayoutEffect(() => {
    if (claveVista.current === clave) return;
    claveVista.current = clave;
    const primero = antes.current;
    antes.current = null;
    const hoja = raiz.current?.querySelector<HTMLElement>(SELECTOR_HOJA);
    if (!primero || !hoja || typeof hoja.animate !== "function") return;
    animacion.current?.cancel();
    animacion.current = null;
    if (movimientoReducido()) {
      animacion.current = hoja.animate([{ opacity: 0.85 }, { opacity: 1 }], {
        duration: msDeToken("--motion-dur-press", 120),
        easing: tokenTexto("--motion-ease-out", "cubic-bezier(0.23, 1, 0.32, 1)"),
      });
      return;
    }
    const delta = deltaFlip(primero, hoja.getBoundingClientRect());
    if (!delta) return;
    animacion.current = hoja.animate(
      [
        { transformOrigin: "50% 50%", transform: `translate(${delta.dx}px, ${delta.dy}px) scale(${delta.s})` },
        { transformOrigin: "50% 50%", transform: "none" },
      ],
      {
        duration: msDeToken("--motion-dur-base", 220),
        // Misma curva y mismo reloj que el lateral que entra: una sola sensación de «la lámina cede espacio». La
        // in-out fuerte dejaba la hoja quieta los primeros ~100 ms mientras el panel ya se movía (medido con rAF).
        easing: tokenTexto("--motion-ease-drawer", "cubic-bezier(0.32, 0.72, 0, 1)"),
      },
    );
  }, [clave, raiz]);
}
