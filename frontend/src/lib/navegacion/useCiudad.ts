import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { conCiudad, PARAM_CIUDAD } from "./direccion";

/**
 * La `ciudad` del mapa nacional de Hojas de ruta (param de alcance, ADR 0044): a qué ciudad se bajó
 * desde el Perú. Como `useFoco`, se escribe con `replace` (bajar de nivel es encuadrar, no navegar) y
 * vive en `lib/navegacion/` por el contrato `lectoresDeDireccion`.
 */
export function useCiudad(): [string | null, (valor: string | null) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const ciudad = new URLSearchParams(location.search).get(PARAM_CIUDAD);
  const escribir = useCallback(
    (valor: string | null) => navigate(`${location.pathname}${conCiudad(location.search, valor)}`, { replace: true }),
    [location.pathname, location.search, navigate],
  );
  return [ciudad && ciudad.trim() ? ciudad.trim() : null, escribir];
}
