import { useLayoutEffect, useRef } from "react";

/**
 * Publica en el contenedor que desplaza la grilla el alto REAL de su cabecera
 * fija: `--sheet-cabecera-1` (la fila de nombres) y `--sheet-cabecera` (nombres y
 * filtros). Los nombres largos parten en dos líneas y la fila de nombres mide más
 * de los 46 px que suponía la hoja: la fila de filtros, fija a 46 px, se montaba
 * sobre ella, y las filas encajaban bajo 80 px cuando la cabecera medía más
 * (32 px tapados en Carga › Datos y Analítica).
 */
export function useAltoDeCabecera<T extends HTMLElement>(clave: unknown) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const marco = ref.current;
    const cabecera = marco?.querySelector("thead");
    if (!marco || !cabecera) return;
    const medir = () => {
      const primera = cabecera.querySelector("tr");
      marco.style.setProperty("--sheet-cabecera-1", `${Math.ceil(primera?.getBoundingClientRect().height ?? 46)}px`);
      marco.style.setProperty("--sheet-cabecera", `${Math.ceil(cabecera.getBoundingClientRect().height)}px`);
    };
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(medir);
    observador.observe(cabecera);
    return () => observador.disconnect();
  }, [clave]);
  return ref;
}
