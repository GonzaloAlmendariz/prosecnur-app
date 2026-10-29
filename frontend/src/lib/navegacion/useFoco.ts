import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PARAMS_DIRECCION } from "./direccion";

/**
 * El `foco` de la dirección (ADR 0044): qué entidad está seleccionada dentro de la
 * vista. Es ortogonal a los cinco niveles —`irA` no lo escribe—, así que tiene su
 * propio par de accesos. Se escribe con `replace`: elegir una fila no es navegar.
 * Vive en `lib/navegacion/` por el contrato `lectoresDeDireccion`: ningún feature
 * lee la dirección a mano.
 */
export function useFoco(): [string | null, (valor: string | null) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const foco = new URLSearchParams(location.search).get(PARAMS_DIRECCION.foco);
  const escribir = useCallback(
    (valor: string | null) => {
      const siguientes = new URLSearchParams(location.search);
      if (valor) siguientes.set(PARAMS_DIRECCION.foco, valor);
      else siguientes.delete(PARAMS_DIRECCION.foco);
      const query = siguientes.toString();
      navigate(`${location.pathname}${query ? `?${query}` : ""}`, { replace: true });
    },
    [location.pathname, location.search, navigate],
  );
  return [foco && foco.trim() ? foco : null, escribir];
}
