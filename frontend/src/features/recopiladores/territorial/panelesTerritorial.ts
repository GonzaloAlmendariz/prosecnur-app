import type { PanelDeclarado } from "../../../lib/navegacion/paneles";

/**
 * La hoja de ruta de una UMP en grande, con «Imprimir o descargar» (ADR 0118
 * §1, brecha B46). Se abre sobre la lista de la campaña territorial:
 * `?modo=territorial&campana=territorial.principal&seccion=unidades&foco=<id_manzana>&panel=hoja`.
 * Vive aquí, sin modelos, porque el manifiesto de navegación importa este archivo.
 */
export const PANEL_HOJA_UMP: PanelDeclarado = {
  id: "hoja",
  label: "Hoja de la UMP",
  clase: "dialogo",
};

export const PANELES_TERRITORIAL = [PANEL_HOJA_UMP] as const;
