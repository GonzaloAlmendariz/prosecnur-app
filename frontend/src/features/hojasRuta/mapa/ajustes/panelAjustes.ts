import type { PanelDeclarado } from "../../../../lib/navegacion/paneles";

/**
 * «Ajustes del diseño» (maqueta aprobada por Gonzalo, 2026-11-05): la ventana que reúne la configuración
 * del diseño muestral en ocho grupos. Se abre con `?panel=ajustes&foco=<grupo>` (ids de `gruposAjustes.ts`).
 */
export const PANEL_AJUSTES_DISENO: PanelDeclarado = {
  id: "ajustes",
  label: "Ajustes del diseño",
  clase: "dialogo",
};
