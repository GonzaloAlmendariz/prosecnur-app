import { Suspense } from "react";

import { lazyWithReload } from "../../lib/lazyWithReload";
import { usePanelDireccionable } from "../../lib/navegacion/paneles";
import { PANEL_ESTUDIO } from "./panelEstudio";

const FichaDelEstudio = lazyWithReload(() => import("./FichaDelEstudio"), "FichaDelEstudio");

// Montado en el Layout, como la Configuración: `?panel=estudio` abre la ficha
// sobre la vista actual (el Home, Cálculo o Monitoreo) y cerrarla devuelve al
// mismo paso. La ficha sólo se lee del backend mientras está abierta.
export function FichaDelEstudioHost() {
  const panel = usePanelDireccionable(PANEL_ESTUDIO);
  if (!panel.abierto) return null;
  return (
    <Suspense fallback={null}>
      <FichaDelEstudio />
    </Suspense>
  );
}
