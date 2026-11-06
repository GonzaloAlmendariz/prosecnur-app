import type { PanelDeclarado } from "../../lib/navegacion/paneles";

/** Detalle de una regla en Validación › Instrumento; `foco` es el id de la regla (L2). */
export const PANEL_REGLA_VALIDACION: PanelDeclarado = {
  id: "regla",
  label: "Detalle de la regla",
  clase: "sideover",
};

export const PANELES_VALIDACION: readonly PanelDeclarado[] = [PANEL_REGLA_VALIDACION];
