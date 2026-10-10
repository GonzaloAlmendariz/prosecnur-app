// Un lateral que se superpone a la lámina (inspector a 1024) es un diálogo modal (verificador de la parte 1):
// al abrir, el foco entra; Tab no sale; Escape cierra desde cualquier punto y el foco vuelve a quien lo abrió.
// Toda otra vía de cierre (la X, el velo) usa el `cerrar` que devuelve el hook, que también devuelve el foco (D2).

import { useCallback, useEffect, useState, type RefObject } from "react";

const ENFOCABLES = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useSideoverModal({ activo, contenedor, retorno, onCerrar }: {
  activo: boolean;
  contenedor: RefObject<HTMLElement>;
  retorno: RefObject<HTMLElement>;
  onCerrar: () => void;
}): () => void {
  const cerrar = useCallback(() => {
    onCerrar();
    requestAnimationFrame(() => retorno.current?.focus());
  }, [onCerrar, retorno]);

  useEffect(() => {
    if (!activo) return;
    const raiz = contenedor.current;
    if (!raiz) return;
    const enfocables = () => [...raiz.querySelectorAll<HTMLElement>(ENFOCABLES)].filter((e) => e.offsetParent !== null || e === document.activeElement);
    const marco = requestAnimationFrame(() => {
      if (!raiz.contains(document.activeElement)) (enfocables()[0] ?? raiz).focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cerrar();
        return;
      }
      if (e.key !== "Tab") return;
      const lista = enfocables();
      if (!lista.length) { e.preventDefault(); raiz.focus(); return; }
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      const actual = document.activeElement as HTMLElement | null;
      if (!actual || !raiz.contains(actual)) { e.preventDefault(); primero.focus(); return; }
      if (e.shiftKey && actual === primero) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && actual === ultimo) { e.preventDefault(); primero.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => { cancelAnimationFrame(marco); document.removeEventListener("keydown", onKey, true); };
  }, [activo, contenedor, cerrar]);

  return cerrar;
}

/** El contenedor mide menos que `umbral` (la misma frontera que la container query del CSS). */
export function useAnchoCompacto(ref: RefObject<HTMLElement>, umbral: number): boolean {
  const [compacto, setCompacto] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const medir = () => setCompacto(el.clientWidth <= umbral);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, umbral, setCompacto]);
  return compacto;
}
