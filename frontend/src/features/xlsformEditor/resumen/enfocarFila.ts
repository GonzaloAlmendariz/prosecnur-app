// Al llegar al Constructor desde «Qué falta» (E9), la fila pedida recibe el foco del teclado y no sólo la selección.
// El Resumen se desmonta al cambiar de pestaña, así que se espera a que el esquema pinte la fila (`data-nav`, la
// misma que recorre el teclado del esquema) unos cuadros como mucho.

const CUADROS_MAXIMOS = 90;

export function enfocarFilaDelConstructor(rowIndex: number, raiz: ParentNode = document): void {
  let cuadros = 0;
  const intentar = () => {
    const fila = raiz.querySelector<HTMLElement>(`[data-nav="${rowIndex}"]`);
    if (fila) {
      fila.focus({ preventScroll: true });
      fila.scrollIntoView({ block: "nearest" });
      return;
    }
    cuadros += 1;
    if (cuadros < CUADROS_MAXIMOS) window.requestAnimationFrame(intentar);
  };
  window.requestAnimationFrame(intentar);
}
