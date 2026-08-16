// =============================================================================
// DashboardRuta — la pestaña del tablero vive en la URL, en la ruta de admin
// =============================================================================
// `tabActiva` vivía sólo en el store, así que `/tablero?pestana=relaciones` no
// abría nada y `__pulsoNav.ir()` se negaba a entrar (las cuatro pestañas eran
// las últimas del manifiesto sin `direccionPublicada`). El recorrido del QA
// visual llegaba a Resumen y a ninguna otra.
//
// Por qué un wrapper y no un hook dentro de `DashboardPage`: el artefacto
// público monta la misma página **fuera** del `BrowserRouter` (`App.tsx`
// devuelve antes de montarlo), así que cualquier `useLocation` dentro de
// `DashboardPage` reventaría en la publicación. Los hooks no se pueden llamar
// condicionalmente, y sincronizar store y URL en los dos sentidos es la clase
// de bucle que preferimos no tener. Así hay una sola fuente por montaje: la
// URL en admin, el store en la publicación.
// =============================================================================

import { useMemo } from "react";

import { useSeccion } from "../../lib/navegacion/useDireccion";
import { resolverPestanaDashboard } from "./pestanaDashboard";
import DashboardPage from "./DashboardPage";

export default function DashboardRuta() {
  const { pestana, irA } = useSeccion("dashboard");
  const activa = useMemo(() => resolverPestanaDashboard(pestana), [pestana]);

  return <DashboardPage pestana={activa} onPestana={(id) => irA("pestana", id)} />;
}
