// H10: fija en el agrupador del plan el control que tiene el foco, para que deshacer vaya por campo y no por letra
// (historialAgrupado.ts). Un solo oyente de foco por página; salir del control corta el grupo.

import { useEffect } from "react";
import { agrupadorDelPlan, type Agrupador } from "./historialAgrupado";

const EDITABLE = "input, textarea, select, button, [role='switch'], [role='slider'], [contenteditable='true']";

/** El control que agrupa: el propio elemento editable con foco, o null si el foco no está en uno. */
export function campoDeFoco(objetivo: EventTarget | null): Element | null {
  return objetivo instanceof Element && objetivo.matches(EDITABLE) ? objetivo : null;
}

export function useDeshacerPorCampo(agrupador: Agrupador = agrupadorDelPlan): void {
  useEffect(() => {
    const alEntrar = (e: FocusEvent) => agrupador.fijarCampo(campoDeFoco(e.target));
    const alSalir = () => agrupador.fijarCampo(null);
    document.addEventListener("focusin", alEntrar);
    document.addEventListener("focusout", alSalir);
    return () => {
      document.removeEventListener("focusin", alEntrar);
      document.removeEventListener("focusout", alSalir);
      agrupador.fijarCampo(null);
    };
  }, [agrupador]);
}
