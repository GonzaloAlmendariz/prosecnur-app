// Dirección del diálogo «Listas de opciones» del editor (H7).
// `?panel=listas-opciones` lo abre desde un enlace o desde el QA visual.

import type { PanelDeclarado } from "../../../lib/navegacion/paneles";

export const PANEL_LISTAS_OPCIONES: PanelDeclarado = {
  id: "listas-opciones",
  label: "Listas de opciones",
  clase: "dialogo",
};

/** Rótulo del botón del editor: «Listas de opciones (3 repetidas)». */
export function rotuloBotonListas(repetidas: number): string {
  if (repetidas <= 0) return "Listas de opciones";
  return `Listas de opciones (${repetidas} ${repetidas === 1 ? "repetida" : "repetidas"})`;
}
