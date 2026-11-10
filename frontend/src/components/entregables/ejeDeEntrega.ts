// La forma anclada cuelga del eje del botón que la abrió (ADR 0133, regla 4). El contenedor flota con
// `position: absolute` dentro de su bloque contenedor (el ancla del módulo, la barra o una franja sin alto bajo
// ella), y ese bloque suele ser más ancho que el botón: con `right: 0` el contenedor terminaba en el borde de la
// barra y no en el del botón. Aquí se mide cuánto hay que correrlo.
//
// Subió de Gráficos (`laminas/ejeDeEntrega.ts`, el visor de lámina) al kit cuando Codificación y Analítica
// necesitaron lo mismo.

import { useLayoutEffect, useState, type RefObject } from "react";
import type { AlineacionAnclada } from "./tipos";

type Bordes = { left: number; right: number };

/** Lo que el contenedor no puede pasar: su ancho y el de la ventana, con el margen de 14 px de la regla del kit. */
export type LimiteDelEje = { ancho: number; ventana: number; margen?: number };

/** Margen a cada lado de la ventana: el `calc(100vw - 28px)` del ancho de la anclada. */
const MARGEN_VENTANA = 14;

/**
 * Distancia (px) del borde del bloque contenedor al del botón, del lado hacia el que se abre el contenedor: el
 * derecho con `fin` y el izquierdo con `inicio`. 0 si el botón se sale del bloque por ese lado. Con `limite`, el
 * contenedor puede salir del bloque (un ancla más angosta que él) pero no de la ventana.
 */
export function distanciaAlEje(bloque: Bordes, boton: Bordes, alinear: AlineacionAnclada = "fin", limite?: LimiteDelEje): number {
  const d = alinear === "inicio" ? boton.left - bloque.left : bloque.right - boton.right;
  if (!limite) return Math.max(0, Math.round(d));
  const margen = limite.margen ?? MARGEN_VENTANA;
  const tope = alinear === "inicio"
    ? limite.ventana - margen - limite.ancho - bloque.left
    : bloque.right - limite.ancho - margen;
  return Math.max(0, Math.round(Math.min(d, tope)));
}

/** Bordes de la caja de relleno del bloque: el `right`/`left` de un hijo absoluto se mide desde ahí. */
function cajaDeRelleno(el: HTMLElement): Bordes {
  const r = el.getBoundingClientRect();
  const left = r.left + el.clientLeft;
  return { left, right: left + el.clientWidth };
}

/**
 * La distancia al eje del botón `eje`, medida contra el bloque contenedor del contenedor `ref` y acotada a la
 * ventana. Se mide en cada render (tres rectángulos) y cuando el bloque cambia de ancho. Si el botón desaparece
 * (se desmonta o deja de estar en el documento), conserva la última medida. Sin `eje` devuelve `null` y el
 * contenedor queda en el borde.
 */
export function useEjeAnclado(
  ref: RefObject<HTMLElement | null>,
  activo: boolean,
  alinear: AlineacionAnclada,
  eje: RefObject<HTMLElement | null> | undefined,
): number | null {
  const [distancia, setDistancia] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!activo || !eje) return;
    const medir = () => {
      const el = ref.current;
      const bloque = el?.offsetParent;
      const boton = eje.current;
      if (!el || !(bloque instanceof HTMLElement) || !boton || !boton.isConnected) return;
      const limite = { ancho: el.offsetWidth, ventana: window.innerWidth };
      const d = distanciaAlEje(cajaDeRelleno(bloque), boton.getBoundingClientRect(), alinear, limite);
      setDistancia((previa) => (previa === d ? previa : d));
    };
    medir();
    const bloque = ref.current?.offsetParent;
    if (typeof ResizeObserver === "undefined" || !(bloque instanceof HTMLElement)) return;
    const observador = new ResizeObserver(medir);
    observador.observe(bloque);
    return () => observador.disconnect();
  });

  return eje ? distancia : null;
}
