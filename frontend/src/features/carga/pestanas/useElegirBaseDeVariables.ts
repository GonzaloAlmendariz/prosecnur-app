import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { conNivel } from "../../../lib/navegacion/direccion";

/**
 * Elegir la base en Variables escribe la dirección canónica
 * (`pestana=variables&foco=<base>`), aunque se haya entrado por el panel viejo
 * `panel=variables-base`: el enlace que se copia nombra la base elegida.
 */
export function useElegirBaseDeVariables(): (base: string) => void {
  const location = useLocation();
  const navigate = useNavigate();
  return useCallback((base: string) => {
    const search = conNivel(
      conNivel(conNivel(location.search, "panel", null), "pestana", "variables"),
      "foco",
      base || null,
    );
    navigate({ pathname: location.pathname, search }, { replace: true });
  }, [location.pathname, location.search, navigate]);
}
