import { useLocation } from "react-router-dom";

import { searchConPanel } from "../../lib/navegacion/paneles";
import { PANEL_ESTUDIO } from "./panelEstudio";

/**
 * El destino de un enlace «declarar el tipo» o «editar el nombre»: la Ficha
 * del estudio abierta sobre la vista actual. Cerrarla devuelve al mismo paso.
 */
export function useRutaFichaDelEstudio() {
  const location = useLocation();
  return { pathname: location.pathname, search: searchConPanel(location.search, PANEL_ESTUDIO) };
}
