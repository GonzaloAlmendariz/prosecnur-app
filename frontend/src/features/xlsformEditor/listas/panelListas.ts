// Dirección del diálogo «Listas de opciones» del editor (H7).
// `?panel=listas-opciones` lo abre desde un enlace o desde el QA visual.

import type { PanelDeclarado } from "../../../lib/navegacion/paneles";

export const PANEL_LISTAS_OPCIONES: PanelDeclarado = {
  id: "listas-opciones",
  label: "Listas de opciones",
  clase: "dialogo",
};

/** Estado de la pestaña Listas de opciones en el rail: «3 listas repetidas» o nada. */
export function estadoListasRepetidas(repetidas: number): string {
  if (repetidas <= 0) return "";
  return `${repetidas} ${repetidas === 1 ? "lista repetida" : "listas repetidas"}`;
}
