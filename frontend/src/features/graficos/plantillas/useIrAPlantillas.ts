// Ir a la pestaña Plantillas desde la barra de Láminas, desde el vacío o desde un enlace viejo con `panel=armar-desde`.
// Cambia la pestaña y quita panel y foco: la dirección que queda describe lo que se ve.

import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { conNivel } from "../../../lib/navegacion/direccion";

export function useIrAPlantillas(): () => void {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  return useCallback(() => {
    const limpia = conNivel(conNivel(search, "panel", null), "foco", null);
    navigate(`${pathname}${conNivel(limpia, "pestana", "plantillas")}`);
  }, [navigate, pathname, search]);
}
