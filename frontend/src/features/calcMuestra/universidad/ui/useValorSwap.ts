/**
 * Marca un breve estado "cambiando" cuando el valor formateado cambia, para
 * que el CSS (.cmv2-uni-swap) funda ambos estados con blur+opacity en vez de
 * swapear el texto en seco. 190ms — por debajo del umbral de estorbo.
 */
import { useEffect, useRef, useState } from "react";

export function useValorSwap(value: string | number | null | undefined): boolean {
  const [cambiando, setCambiando] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (Object.is(prev.current, value)) return;
    prev.current = value;
    setCambiando(true);
    const timer = window.setTimeout(() => setCambiando(false), 190);
    return () => window.clearTimeout(timer);
  }, [value]);
  return cambiando;
}
