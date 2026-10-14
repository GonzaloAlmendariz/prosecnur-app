// Dirección del diálogo «Agregar campaña complementaria».
//
// El panel es único para la biblioteca y el `foco` dice sobre qué formulario se
// abre: `?panel=campana-complementaria&foco=<id>`. Así el diálogo se puede
// enlazar y el QA visual lo alcanza sin clicks.

import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { useDireccion } from "../../../lib/navegacion/useDireccion";
import {
  PANEL_CAMPANA_COMPLEMENTARIA,
  searchAbrirCampana,
  searchCerrarCampana,
} from "./campanaComplementariaModel";

export type ControlCampanaComplementaria = {
  abierto: boolean;
  /** Formulario sobre el que se abrió; `null` si la dirección no lo dice. */
  formId: string | null;
  abrirPara: (formId: string) => void;
  cerrar: () => void;
  props: { "data-pulso-panel": string };
};

export function useCampanaComplementariaPanel(): ControlCampanaComplementaria {
  const panel = usePanelDireccionable(PANEL_CAMPANA_COMPLEMENTARIA);
  const direccion = useDireccion();
  const location = useLocation();
  const navigate = useNavigate();

  const abrirPara = useCallback((formId: string) => {
    navigate(
      { pathname: location.pathname, search: searchAbrirCampana(location.search, formId) },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  const cerrar = useCallback(() => {
    navigate(
      { pathname: location.pathname, search: searchCerrarCampana(location.search) },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  return {
    abierto: panel.abierto,
    formId: panel.abierto ? direccion?.foco ?? null : null,
    abrirPara,
    cerrar,
    props: panel.props,
  };
}
