// focoDeRetorno.ts — al cerrar un diálogo, el foco vuelve a quien lo abrió
// (WCAG 2.4.3; revisión de usabilidad, F10).
//
// Los diálogos de Material de campo se abren por dirección (`?panel=…`), no con
// un `Dialog.Trigger`. Radix devuelve el foco al elemento que lo tenía al
// montarse, pero aquí ese elemento suele no existir ya al cerrar: era un ítem
// del menú «⋯», que se desmonta, o la lista se volvió a pintar al cambiar la
// dirección. Con Esc el foco caía en <body>.
//
// La regla: se recuerda el elemento enfocado al abrir; al cerrar, si sigue en
// el documento se enfoca; si no, el que lleve su misma marca `data-retorno`; si
// tampoco, el primer respaldo que exista (el «⋯» de la campaña, «Nueva
// campaña»). La lista puede tardar un cuadro en volver a pintarse: se reintenta
// unos cuadros antes de rendirse.

import { useCallback, useLayoutEffect, useRef } from "react";

export const ATRIBUTO_RETORNO = "data-retorno";

/** La marca que identifica a un disparador aunque se vuelva a montar. */
export function claveDeRetorno(el: Element | null): string | null {
  const marcado = el?.closest?.(`[${ATRIBUTO_RETORNO}]`) ?? null;
  return marcado?.getAttribute(ATRIBUTO_RETORNO) ?? null;
}

export function selectorDeRetorno(clave: string): string {
  return `[${ATRIBUTO_RETORNO}="${clave.replace(/["\\]/g, "\\$&")}"]`;
}

/**
 * A quién se devuelve el foco: el elemento recordado si sigue montado, el que
 * lleva su marca, o el primer respaldo. `null` si nada de eso existe.
 */
export function destinoDeRetorno(
  doc: Pick<Document, "querySelector" | "body">,
  recordado: { el: Element | null; clave: string | null },
  respaldos: readonly string[],
): HTMLElement | null {
  const { el, clave } = recordado;
  const usable = (x: Element | null): x is HTMLElement =>
    x !== null && typeof (x as HTMLElement).focus === "function" && x.isConnected && x !== doc.body && !(x as HTMLButtonElement).disabled;
  if (usable(el)) return el;
  for (const selector of [...(clave ? [selectorDeRetorno(clave)] : []), ...respaldos]) {
    const hallado = doc.querySelector(selector);
    if (usable(hallado)) return hallado;
  }
  return null;
}

/**
 * `onCloseAutoFocus` para un `Dialog.Content` abierto por dirección.
 * `respaldos`: selectores, en orden, para cuando el disparador ya no está.
 */
export function useFocoDeRetorno(abierto: boolean, respaldos: readonly string[] = []) {
  const recordado = useRef<{ el: Element | null; clave: string | null }>({ el: null, clave: null });
  // Al cerrar, la campaña del diálogo suele haber salido ya de la dirección y
  // los respaldos llegan vacíos: valen los últimos que se conocieron.
  const lista = useRef(respaldos);
  if (respaldos.length) lista.current = respaldos;

  // Antes de que el diálogo mueva el foco adentro (su efecto corre después).
  useLayoutEffect(() => {
    if (!abierto || typeof document === "undefined") return;
    const el = document.activeElement;
    recordado.current = { el: el === document.body ? null : el, clave: claveDeRetorno(el) };
  }, [abierto]);

  return useCallback((event: Event) => {
    if (typeof document === "undefined") return;
    event.preventDefault();
    let intentos = 0;
    const probar = () => {
      const destino = destinoDeRetorno(document, recordado.current, lista.current);
      if (destino) {
        destino.focus();
        return;
      }
      intentos += 1;
      if (intentos < 12) window.requestAnimationFrame(probar);
    };
    probar();
  }, []);
}
