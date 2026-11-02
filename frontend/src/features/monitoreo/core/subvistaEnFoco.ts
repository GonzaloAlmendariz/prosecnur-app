import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { conNivel } from "../../../lib/navegacion/direccion";
import { useDireccion } from "../../../lib/navegacion/useDireccion";

/**
 * Una sub-vista dentro de una pestaña viaja en el `foco` de la dirección (L19),
 * como Carga › Estructura (`?foco=preguntas`) y Hojas › Muestra: así es
 * enlazable y sobrevive a recargar. La vista por defecto no se escribe, y un
 * foco que no es una de las vistas (p. ej. el de otra pestaña) deja la de siempre.
 */
export function subvistaDesdeFoco<T extends string>(foco: string | null | undefined, vistas: readonly T[], porDefecto: T): T {
  return vistas.includes(foco as T) ? (foco as T) : porDefecto;
}

export function focoDeSubvista<T extends string>(vista: T, porDefecto: T): string | null {
  return vista === porDefecto ? null : vista;
}

export function useSubvistaEnFoco<T extends string>(vistas: readonly T[], porDefecto: T): [T, (vista: T) => void] {
  const actual = subvistaDesdeFoco(useDireccion()?.foco, vistas, porDefecto);
  const location = useLocation();
  const navigate = useNavigate();
  const elegir = useCallback(
    (vista: T) => {
      navigate(
        { pathname: location.pathname, search: conNivel(location.search, "foco", focoDeSubvista(vista, porDefecto)) },
        { replace: true },
      );
    },
    [location.pathname, location.search, navigate, porDefecto],
  );
  return [actual, elegir];
}
