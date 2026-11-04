import { Suspense, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { lazyWithReload } from "../../lib/lazyWithReload";
import { usePanelDireccionable } from "../../lib/navegacion/paneles";
import { useDireccion } from "../../lib/navegacion/useDireccion";
import { useFoco } from "../../lib/navegacion/useFoco";
import { seccionDeConfiguracion } from "./seccionesConfiguracion";
import { PANEL_CONFIGURACION } from "./panelesHome";
import { searchSinConfiguracion } from "./useAbrirConfiguracion";

const ConfiguracionDialogo = lazyWithReload(() => import("./ConfiguracionDialogo"), "ConfiguracionDialogo");

// Overlay global de la configuración (L7).
//
// Antes se montaba sólo en HomePage: `?panel=configuracion` no abría nada
// fuera del Home y quien chocaba con un token vencido en Carga tenía que salir
// del módulo para arreglarlo. Montado en el Layout, como <ModulePickerHost/>,
// se abre sobre la ruta actual y cerrarlo devuelve a la misma dirección, o sea
// al mismo paso. `foco` elige la sección (`foco=connections`).
export function ConfiguracionHost() {
  const panel = usePanelDireccionable(PANEL_CONFIGURACION);
  const location = useLocation();
  // Fuera de un módulo (el Home, `/`) no hay dirección y `useDireccion` da null: el `foco` se lee
  // del query directamente, o `/?panel=configuracion&foco=credits` abría siempre en Conexiones.
  // `useFoco` lee el foco también donde no hay dirección de módulo (el Home), que `useDireccion` no cubre.
  const [focoDelQuery] = useFoco();
  const foco = useDireccion()?.foco ?? focoDelQuery;
  const seccion = seccionDeConfiguracion(foco);
  const navigate = useNavigate();
  // Cerrar también suelta el `foco` de sección: si no, Carga heredaría un
  // `foco=connections` que en su gramática significa otra cosa.
  const cerrar = useCallback(() => {
    navigate(
      { pathname: location.pathname, search: searchSinConfiguracion(location.search, seccion !== null) },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate, seccion]);
  if (!panel.abierto) return null;
  return (
    <Suspense fallback={null}>
      <ConfiguracionDialogo onClose={cerrar} seccion={seccion} />
    </Suspense>
  );
}
