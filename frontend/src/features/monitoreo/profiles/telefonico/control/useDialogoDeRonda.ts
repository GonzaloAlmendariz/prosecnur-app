import { useEffect, useRef } from "react";

/**
 * Lo común a los dos diálogos de ronda: Escape cierra, el foco entra al
 * diálogo al abrir y vuelve a donde estaba al cerrar.
 */
export function useDialogoDeRonda<T extends HTMLElement>(onCerrar: () => void) {
  const raiz = useRef<T | null>(null);
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;
  useEffect(() => {
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const primero = raiz.current?.querySelector<HTMLElement>("input, button:not(.mon-sup-cerrar), [tabindex]");
    (primero ?? raiz.current)?.focus();
    const alTeclear = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        cerrar.current();
      }
    };
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      previo?.focus();
    };
  }, []);
  return raiz;
}
