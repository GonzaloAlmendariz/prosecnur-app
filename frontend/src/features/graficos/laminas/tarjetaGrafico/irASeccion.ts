// H4: saltar a una sección plegable del inspector (tarjeta del gráfico o pestaña «Lámina»). Lleva su cabecera arriba del cuerpo del inspector, bajo el índice
// pegado, y le da el foco sin que se mueva ningún otro contenedor (sólo el dueño del scroll, C4).

import { duenoDelScroll } from "../../revelarFila";

const AIRE = 8;

/** Desplazamiento del dueño para dejar la sección justo bajo el índice pegado. */
export function destinoDeSeccion(duenoTop: number, scrollTop: number, seccionTop: number, alturaIndice: number): number {
  return Math.max(0, Math.round(seccionTop - duenoTop + scrollTop - alturaIndice - AIRE));
}

const sinMovimiento = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/**
 * Espera al cuadro siguiente (la sección se acaba de abrir) y lleva su cabecera arriba. `enfocar` da el foco a su botón;
 * `instantaneo` salta sin animar (al volver a la tarjeta).
 */
export function irASeccion(tarjeta: HTMLElement | null, seccion: string, { enfocar = true, instantaneo = false } = {}): void {
  if (!tarjeta || typeof requestAnimationFrame === "undefined") return;
  requestAnimationFrame(() => {
    const el = tarjeta.querySelector<HTMLElement>(`[data-seccion-tarjeta="${seccion}"]`);
    if (!el) return;
    const dueno = duenoDelScroll(el);
    if (dueno) {
      const indice = tarjeta.querySelector<HTMLElement>("[data-indice-tarjeta]");
      const top = destinoDeSeccion(dueno.getBoundingClientRect().top, dueno.scrollTop, el.getBoundingClientRect().top, indice?.offsetHeight ?? 0);
      dueno.scrollTo({ top, behavior: instantaneo || sinMovimiento() ? "auto" : "smooth" });
    }
    if (enfocar) el.querySelector<HTMLElement>("[aria-expanded]")?.focus({ preventScroll: true });
  });
}
