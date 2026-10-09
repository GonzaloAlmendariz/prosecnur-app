/**
 * Marca un breve estado "cambiando" cuando el valor formateado cambia, para
 * que el CSS (.cmv2-uni-swap) funda ambos estados con blur+opacity en vez de
 * swapear el texto en seco. 190ms — por debajo del umbral de estorbo.
 *
 * AD5-E15: la pestaña se montaba con «pendiente»/«—» y al hidratarse el modelo
 * ese marcador pasaba a la cifra real; el hook lo leía como un cambio y la
 * captura —que se dispara justo cuando llegan los datos— salía borrosa. Que
 * un valor APAREZCA no es que cambie: el blur sólo cruza entre dos valores
 * reales, y nunca bajo prefers-reduced-motion.
 */
import { useEffect, useRef, useState } from "react";

export type ValorSwap = string | number | null | undefined;

const DURACION_MS = 190;

/** Textos que la UI pinta mientras no hay valor: no son una cifra que cambie. */
const MARCADORES = new Set(["", "—", "–", "-", "…", "...", "pendiente", "sin dato", "sin datos", "calculando…"]);

export function esMarcadorDeValor(value: ValorSwap): boolean {
  if (value == null) return true;
  if (typeof value === "number") return !Number.isFinite(value);
  return MARCADORES.has(value.trim().toLowerCase());
}

/** ¿Este paso de `prev` a `next` merece el cruce? Sólo entre dos valores reales. */
export function debeAnimarSwap(prev: ValorSwap, next: ValorSwap): boolean {
  if (Object.is(prev, next)) return false;
  return !esMarcadorDeValor(prev) && !esMarcadorDeValor(next);
}

function prefiereMenosMovimiento(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * El cuerpo del efecto, con sus dependencias inyectadas: es TODA la lógica del
 * hook, así un test sin DOM la ejercita tal cual (verificador de E15: el test
 * que sólo renderizaba en estático nunca corría el efecto, y un mutante que
 * volvía a animar marcador→valor pasaba en verde).
 */
export function efectoValorSwap(args: {
  anterior: ValorSwap;
  value: ValorSwap;
  reducedMotion: boolean;
  setCambiando: (v: boolean) => void;
  setTimeout: (fn: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
}): { siguiente: ValorSwap; cleanup?: () => void } | null {
  const { anterior, value } = args;
  if (Object.is(anterior, value)) return null;
  if (!debeAnimarSwap(anterior, value) || args.reducedMotion) {
    args.setCambiando(false);
    return { siguiente: value };
  }
  args.setCambiando(true);
  const timer = args.setTimeout(() => args.setCambiando(false), DURACION_MS);
  return { siguiente: value, cleanup: () => args.clearTimeout(timer) };
}

export function useValorSwap(value: ValorSwap): boolean {
  const [cambiando, setCambiando] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    const paso = efectoValorSwap({
      anterior: prev.current,
      value,
      reducedMotion: prefiereMenosMovimiento(),
      setCambiando,
      setTimeout: (fn, ms) => window.setTimeout(fn, ms),
      clearTimeout: (id) => window.clearTimeout(id),
    });
    if (!paso) return;
    prev.current = paso.siguiente;
    return paso.cleanup;
  }, [value]);
  return cambiando;
}
