// La pestaña del tablero que nombra la URL.
//
// Vive aparte de `DashboardRuta` a propósito: ese archivo importa
// `DashboardPage`, que arrastra plotly, y una función de tres líneas no puede
// costar eso para poder probarse.

import {
  DASHBOARD_PESTANAS,
  type DashboardPestanaId,
} from "../../lib/navegacion/catalogos/dashboard";
import { normalizarToken } from "../../lib/navegacion/direccion";

const POR_DEFECTO: DashboardPestanaId = DASHBOARD_PESTANAS[0].id;

/** La pestaña que nombra la URL, o Resumen si no nombra ninguna válida. */
export function resolverPestanaDashboard(
  pedida: string | null | undefined,
): DashboardPestanaId {
  if (!pedida) return POR_DEFECTO;
  const buscada = normalizarToken(pedida);
  return (
    DASHBOARD_PESTANAS.find((t) => normalizarToken(t.id) === buscada)?.id ?? POR_DEFECTO
  );
}
