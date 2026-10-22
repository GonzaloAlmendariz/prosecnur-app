import type { PanelDeclarado } from "../../../../lib/navegacion/paneles";

/**
 * Elegir las variables de control del tablero (ADR 0112 §4). Se abre sobre la
 * pestaña Contactos: `?…&pestana=contactos&panel=contactos-variables`.
 */
export const PANEL_CONTACTOS_VARIABLES: PanelDeclarado = {
  id: "contactos-variables",
  label: "Variables de control",
  clase: "popover",
};
