// Adónde vuelve el foco al cerrar «¿Qué lámina?» o «¿Qué gráfico?» cuando nadie lo abrió con un clic (se llegó por
// enlace: `?panel=tipo-lamina&foco=l-09`). Sin esto caía en el ancla oculta «Pestaña Láminas» (verificador de F6.2):
// el destino es la ranura del foco, si está a la vista, y si no la lámina del foco (su lienzo, que es enfocable).
// Si el selector sí se abrió con un clic, manda quien lo abrió (`useLibraryDialogA11y`).

/** Lo llevan los botones de ranura sobre la lámina (`RanurasSobreLamina`): su número 1-based. */
export const ATRIBUTO_RANURA = "data-ranura-k";
/** Lo lleva el lienzo del visor (`VisorLamina`): la posición de la lámina que muestra. */
export const ATRIBUTO_LIENZO = "data-lienzo-lamina";

type Raiz<T> = { querySelector: (selector: string) => T | null };

export function destinoAlCerrarSelector<T>(raiz: Raiz<T>, ranura: number | null): T | null {
  const enRanura = ranura !== null ? raiz.querySelector(`[${ATRIBUTO_RANURA}="${ranura}"]`) : null;
  return enRanura ?? raiz.querySelector(`[${ATRIBUTO_LIENZO}]`);
}

/** Para el documento real. */
export function destinoAlCerrarEnDocumento(ranura: number | null): HTMLElement | null {
  return destinoAlCerrarSelector({ querySelector: (s) => document.querySelector<HTMLElement>(s) }, ranura);
}
