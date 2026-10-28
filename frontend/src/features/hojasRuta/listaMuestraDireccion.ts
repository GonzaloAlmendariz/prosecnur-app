// Hojas de ruta › Muestra: la lista de manzanas elegidas muestra titulares o reemplazos (L19).
//
// Era un campo del store: la sub-barra no tenía dirección y el QA no llegaba a «Reemplazos». Ahora viaja en el
// `foco`, como la hoja en Formularios: `foco=reemplazos`; Titulares es la de siempre y no se escribe.

import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { conNivel } from "../../lib/navegacion/direccion";
import { useDireccion } from "../../lib/navegacion/useDireccion";
import type { HojasRutaSampleListTab } from "./store";

export function listaMuestraDesdeFoco(foco: string | null | undefined): HojasRutaSampleListTab {
  return foco === "reemplazos" ? "reemplazos" : "titulares";
}

export function focoDeListaMuestra(lista: HojasRutaSampleListTab): string | null {
  return lista === "reemplazos" ? "reemplazos" : null;
}

export function useListaMuestraEnDireccion(): [HojasRutaSampleListTab, (lista: HojasRutaSampleListTab) => void] {
  const lista = listaMuestraDesdeFoco(useDireccion()?.foco);
  const location = useLocation();
  const navigate = useNavigate();
  const fijar = useCallback(
    (siguiente: HojasRutaSampleListTab) => {
      navigate(
        { pathname: location.pathname, search: conNivel(location.search, "foco", focoDeListaMuestra(siguiente)) },
        { replace: true },
      );
    },
    [location.pathname, location.search, navigate],
  );
  return [lista, fijar];
}
