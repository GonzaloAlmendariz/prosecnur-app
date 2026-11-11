import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { conNivel } from "../../../lib/navegacion/direccion";
import { panelAbiertoEn, searchConPanel, searchSinPanel } from "../../../lib/navegacion/paneles";
import { useDireccion } from "../../../lib/navegacion/useDireccion";
import { PANEL_REGLA_VALIDACION } from "../panelesValidacion";
import { searchConPestanaCanonica } from "../pestanaValidacion";

/**
 * La regla abierta en Validación › Hallazgos vive en la dirección
 * (`?panel=regla&foco=<id>`), no en un useState: un enlace la abre, recargar
 * no la pierde y el QA la captura sin clics (L2).
 *
 * Abrir o cerrar escribe la pestaña con su clave canónica: un enlace viejo
 * (`?pestana=instrumento&panel=regla`) abre Hallazgos por alias, y al cerrar
 * el panel no debe quedar `?pestana=instrumento`, que abre Reglas.
 */
export function useReglaDireccionable() {
  const location = useLocation();
  const navigate = useNavigate();
  const foco = useDireccion()?.foco ?? null;
  const detailRuleId = panelAbiertoEn(location.search, PANEL_REGLA_VALIDACION) ? foco ?? "" : "";

  const abrirRegla = useCallback(
    (id: string) => {
      const search = conNivel(
        searchConPanel(searchConPestanaCanonica(location.search), PANEL_REGLA_VALIDACION),
        "foco",
        id,
      );
      navigate({ pathname: location.pathname, search }, { replace: true });
    },
    [location.pathname, location.search, navigate],
  );

  const cerrarRegla = useCallback(() => {
    if (!panelAbiertoEn(location.search, PANEL_REGLA_VALIDACION)) return;
    const search = conNivel(
      searchSinPanel(searchConPestanaCanonica(location.search), PANEL_REGLA_VALIDACION),
      "foco",
      null,
    );
    navigate({ pathname: location.pathname, search }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  return { detailRuleId, abrirRegla, cerrarRegla };
}
