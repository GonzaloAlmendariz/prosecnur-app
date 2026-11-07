import { useCallback } from "react";
import { usePanelDireccionable, type PanelDeclarado } from "../../../../../lib/navegacion/paneles";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";

/**
 * La variable de cuota que el usuario eligió ver (R5 paso 2, aprobado por Gonzalo el 3/11): direccionable
 * como `panel=variable&foco=<variable>`. Sin elección, `variableDeCuotas` aplica su regla de siempre. Avance ›
 * Cuotas, Ritmo y la barra leen este mismo hook, así que cambian juntos.
 */
export const PANEL_VARIABLE: PanelDeclarado = { id: "variable", label: "Variable de cuota", clase: "popover" };

export function useVariableDeCuotasElegida(): { elegida: string | null; elegir: (variable: string | null) => void } {
  const panel = usePanelDireccionable(PANEL_VARIABLE);
  const [foco, escribirFoco] = useFocoMonitoreo();
  const elegir = useCallback((variable: string | null) => {
    escribirFoco(variable, { panel: variable ? PANEL_VARIABLE.id : null });
  }, [escribirFoco]);
  return { elegida: panel.abierto ? foco : null, elegir };
}
