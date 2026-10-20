import type { PanelDeclarado } from "../../../lib/navegacion/paneles";

/** El id de «Nueva campaña»; vive aquí porque el manifiesto de navegación importa este archivo sin arrastrar modelos. */
export const PANEL_NUEVA_CAMPANA_ID = "nueva-campana";

/**
 * «Nueva campaña» sobre la lista (ADR 0111 §2): se elige el tipo y, para un
 * correo, su origen. `?panel=nueva-campana`. El viejo `?panel=correo-campanas`
 * aterriza aquí (`redirecciones.ts`).
 */
export const PANEL_NUEVA_CAMPANA: PanelDeclarado = {
  id: PANEL_NUEVA_CAMPANA_ID,
  label: "Nueva campaña",
  clase: "dialogo",
};

/**
 * Renombrar una campaña (y, en un correo, su actor y su plataforma).
 * `?panel=campana-renombrar&foco=<id de campaña>`.
 */
export const PANEL_RENOMBRAR_CAMPANA: PanelDeclarado = {
  id: "campana-renombrar",
  label: "Renombrar campaña",
  clase: "dialogo",
};

export const PANELES_CAMPANAS = [PANEL_NUEVA_CAMPANA, PANEL_RENOMBRAR_CAMPANA] as const;
