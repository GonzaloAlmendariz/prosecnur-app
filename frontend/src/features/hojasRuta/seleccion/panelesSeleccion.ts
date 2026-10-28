import type { PanelDeclarado } from "../../../lib/navegacion/paneles";

/**
 * Paneles de Hojas de ruta › Selección. Bajo 1280 px las salidas (ZIP, Excel,
 * reemplazos puntuales, PDF de prueba) se abren en un sideover:
 * `?seccion=seleccion&panel=salidas`.
 */
export const PANEL_SALIDAS_SELECCION: PanelDeclarado = {
  id: "salidas",
  label: "Salidas de la selección",
  clase: "sideover",
};
