// Mapa o Lista en la pestaña Lógica (E1, 2026-10-20). La dirección manda: `?forma=lista` abre la lista; sin el param,
// el mapa. `vista` no sirve: es alias legacy de `seccion` en Monitoreo y la dirección canónica lo descarta.

import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export type FormaLogica = "mapa" | "lista";
export const PARAM_FORMA_LOGICA = "forma";

export function leerFormaLogica(search: string): FormaLogica {
  return new URLSearchParams(search).get(PARAM_FORMA_LOGICA) === "lista" ? "lista" : "mapa";
}

/** El `search` con la forma pedida, sin tocar el resto. El mapa es el valor por defecto: no se escribe. */
export function searchConFormaLogica(search: string, forma: FormaLogica): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (forma === "lista") params.set(PARAM_FORMA_LOGICA, "lista");
  else params.delete(PARAM_FORMA_LOGICA);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function useFormaLogica(): [FormaLogica, (forma: FormaLogica) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const forma = leerFormaLogica(location.search);
  const fijar = useCallback(
    (destino: FormaLogica) => navigate({ pathname: location.pathname, search: searchConFormaLogica(location.search, destino) }, { replace: true }),
    [location.pathname, location.search, navigate],
  );
  return [forma, fijar];
}
