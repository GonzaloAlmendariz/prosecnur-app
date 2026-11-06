import { useSyncExternalStore } from "react";
import type { ChromeDensity } from "../../components/ModuleCommandBar";

/** El quiebre de Material: el mismo de `recopiladores-shell.css`. */
export const ANCHO_COMPACTO = 1120;

export function densidadDelAncho(ancho: number): ChromeDensity {
  return ancho <= ANCHO_COMPACTO ? "compact" : "normal";
}

const CONSULTA = `(max-width: ${ANCHO_COMPACTO}px)`;

function suscribir(avisar: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
  const mq = window.matchMedia(CONSULTA);
  mq.addEventListener("change", avisar);
  return () => mq.removeEventListener("change", avisar);
}

/**
 * Densidad de la barra de una campaña según el ancho. Revisión con ojo de usuario (1 nov 2026):
 * a 1024 la barra de Campo en aulas recortaba «Entrega» porque nadie le pasaba densidad y
 * «Actualizar» nunca se compactaba a su ícono.
 */
export function useDensidadDelChrome(): ChromeDensity {
  return useSyncExternalStore(
    suscribir,
    () => densidadDelAncho(typeof window === "undefined" ? Infinity : window.innerWidth),
    () => "normal",
  );
}
