import { useEffect, useRef } from "react";

/**
 * Enfoca, al montar, el primer `role="switch"` dentro del contenedor. Sustituye
 * al `autoFocus` de la casilla que había antes: `PulsoSwitch` no expone ref ni
 * `autoFocus`, y el kit no se toca desde un feature.
 */
export function useFocoInicialDeSwitch<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="switch"]')?.focus();
  }, []);
  return ref;
}
