import type { PanelDeclarado } from "../../../lib/navegacion/paneles";

/**
 * Paneles de Hojas de ruta › Selección. Las salidas (ZIP, Excel, reemplazos
 * puntuales, PDF de prueba) se abren en un sideover:
 * `?seccion=seleccion&panel=salidas`. En la página clásica, sólo bajo 1280 px
 * (arriba son una columna); en el lienzo (ADR 0114), siempre.
 */
export const PANEL_SALIDAS_SELECCION: PanelDeclarado = {
  id: "salidas",
  label: "Salidas de la selección",
  clase: "sideover",
};
