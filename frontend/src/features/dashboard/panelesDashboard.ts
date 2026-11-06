import type { PanelDeclarado } from "../../lib/navegacion/paneles";

/**
 * Dashboard › el editor de personalización (marca, color, vistas, pestañas). `?panel=personalizar` (4 nov 2026):
 * antes se abría con un `useState` suelto y no se podía enlazar ni capturar. Los demás overlays del tablero siguen
 * el mismo camino: `DashboardRuta` lee la dirección y `DashboardPage` conserva un estado propio para la publicación
 * (`usePanelConRespaldo`).
 */
export const PANEL_PERSONALIZAR: PanelDeclarado = {
  id: "personalizar",
  label: "Personalizar el dashboard",
  clase: "dialogo",
};

/** Dashboard › Paletas: los colores de cada lista de opciones. `?panel=paletas`. */
export const PANEL_PALETAS: PanelDeclarado = {
  id: "paletas",
  label: "Paletas de colores por lista",
  clase: "dialogo",
};

/** Dashboard › Publicar: el despliegue del tablero a un Space. `?panel=publicar`; publicar sigue pidiendo su clic. */
export const PANEL_PUBLICAR: PanelDeclarado = {
  id: "publicar",
  label: "Publicar el dashboard",
  clase: "dialogo",
};

/**
 * Dashboard › Datos: la fuente del tablero (XLSForm y data). `?panel=fuente`. No es un diálogo: reemplaza el tablero
 * en la página mientras está abierta, por eso es `inspector`. Sin datos cargados se muestra siempre.
 */
export const PANEL_FUENTE: PanelDeclarado = {
  id: "fuente",
  label: "Fuente del dashboard",
  clase: "inspector",
};

export const PANELES_DASHBOARD = [PANEL_PERSONALIZAR, PANEL_PALETAS, PANEL_PUBLICAR, PANEL_FUENTE] as const satisfies readonly PanelDeclarado[];
