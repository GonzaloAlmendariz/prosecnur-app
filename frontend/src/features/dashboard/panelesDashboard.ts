import type { PanelDeclarado } from "../../lib/navegacion/paneles";

/**
 * Dashboard › el editor de personalización (marca, color, vistas, pestañas). `?panel=personalizar` (4 nov 2026):
 * antes se abría con un `useState` suelto y no se podía enlazar ni capturar. Fuente, paletas y publicar siguen
 * con su estado propio; se conectan cuando se toque cada uno.
 */
export const PANEL_PERSONALIZAR: PanelDeclarado = {
  id: "personalizar",
  label: "Personalizar el dashboard",
  clase: "dialogo",
};

export const PANELES_DASHBOARD = [PANEL_PERSONALIZAR] as const satisfies readonly PanelDeclarado[];
