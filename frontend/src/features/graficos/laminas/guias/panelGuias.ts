// Panel de las guías del visor: popover direccionable (`panel=guias`, plan F6 §8). La dirección sólo dice si el panel
// está abierto; qué capas están encendidas vive en `useGuiasUi` (estado efímero, no enlazable).

import type { PanelDeclarado } from "../../../../lib/navegacion/paneles";

export const PANEL_GUIAS_LAMINA: PanelDeclarado = {
  id: "guias",
  label: "Guías de la lámina",
  clase: "popover",
};
