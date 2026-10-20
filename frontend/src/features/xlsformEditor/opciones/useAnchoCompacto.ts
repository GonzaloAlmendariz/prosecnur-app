// En pantallas de hasta 1280 px la columna lateral de las pestañas de reglas se oculta (pestanas.css). En «Listas de
// opciones» esa columna trae «Dónde se usa» y «Unificar»: en vez de perderlos, la pestaña los baja bajo el editor.

import { useSyncExternalStore } from "react";

const CONSULTA = "(max-width: 1280px)";

function suscribir(aviso: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(CONSULTA);
  mq.addEventListener("change", aviso);
  return () => mq.removeEventListener("change", aviso);
}

const leer = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(CONSULTA).matches : false);

export function useAnchoCompacto(): boolean {
  return useSyncExternalStore(suscribir, leer, () => false);
}
