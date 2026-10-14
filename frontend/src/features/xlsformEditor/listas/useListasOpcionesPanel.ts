import { usePanelDireccionable, type ControlPanel } from "../../../lib/navegacion/paneles";
import { PANEL_LISTAS_OPCIONES } from "./panelListas";

/** Control direccionable del diálogo (`?panel=listas-opciones`). */
export function useListasOpcionesPanel(): ControlPanel {
  return usePanelDireccionable(PANEL_LISTAS_OPCIONES);
}
