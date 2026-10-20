// Paneles direccionables de «Filtros de opciones»: el diálogo «Nuevo filtro» se abre con `?panel=nuevo-filtro`.

import type { PanelDeclarado } from "../../../lib/navegacion/paneles";

export const PANEL_NUEVO_FILTRO: PanelDeclarado = {
  id: "nuevo-filtro",
  label: "Nuevo filtro de opciones",
  clase: "dialogo",
};
