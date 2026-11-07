import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { conNivel } from "../../lib/navegacion/direccion";
import { searchConPanel, searchSinPanel } from "../../lib/navegacion/paneles";
import { PANEL_CONFIGURACION } from "./panelesHome";
import type { SettingsTab } from "./seccionesConfiguracion";

/**
 * Abre la configuración global sobre la ruta actual, en una sección (L7):
 * `?…&panel=configuracion&foco=connections`. Al cerrarla se vuelve a la misma
 * dirección, así que quien la abrió desde un paso de Carga sigue en ese paso.
 */
export function useAbrirConfiguracion(): (seccion: SettingsTab) => void {
  const location = useLocation();
  const navigate = useNavigate();
  return useCallback(
    (seccion: SettingsTab) => {
      const search = conNivel(searchConPanel(location.search, PANEL_CONFIGURACION), "foco", seccion);
      navigate({ pathname: location.pathname, search }, { replace: true });
    },
    [location.pathname, location.search, navigate],
  );
}

/** URL que cierra la configuración y quita el `foco` de sección que la abrió. */
export function searchSinConfiguracion(search: string, conFocoDeSeccion: boolean): string {
  const sinPanel = searchSinPanel(search, PANEL_CONFIGURACION);
  return conFocoDeSeccion ? conNivel(sinPanel, "foco", null) : sinPanel;
}
