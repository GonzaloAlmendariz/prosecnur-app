import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import { conNivel } from "../../../lib/navegacion/direccion";
import { useDireccion } from "../../../lib/navegacion/useDireccion";
import { actorEnFoco } from "./actores";

/** El `search` con el actor en foco; `null` lo quita. */
export function searchConActor(search: string, componenteId: string | null): string {
  return conNivel(search, "foco", componenteId);
}

/**
 * El actor en foco de Acreditación › Selección vive en la dirección
 * (`foco=<componente_id>`), no en estado local: la vista de un actor es
 * enlazable. Se escribe con `replace` —elegir un actor no es navegar— y el
 * default (el primero) no se escribe, igual que la pestaña por defecto.
 */
export function useActorEnFoco(componentes: readonly CalcMuestraComponente[]) {
  const direccion = useDireccion();
  const location = useLocation();
  const navigate = useNavigate();
  const activo = actorEnFoco(componentes, direccion?.foco);

  const elegir = useCallback(
    (componenteId: string) => {
      const search = searchConActor(location.search, componenteId);
      if (search === location.search) return;
      navigate({ pathname: location.pathname, search }, { replace: true });
    },
    [location.pathname, location.search, navigate],
  );

  return { activo, elegir };
}
