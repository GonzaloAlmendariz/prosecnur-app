import type { PanelDeclarado } from "../../../lib/navegacion/paneles";

/**
 * Inspector del editor de correos (Catálogo › Correos, ADR 0110 §2).
 *
 * «Bloque» es el inspector por defecto y no escribe `panel`; las otras tres
 * vistas del inspector son enlazables: `?panel=correo-identidad`,
 * `?panel=correo-destinatarios` y `?panel=correo-revision`.
 */
export const PANEL_CORREO_IDENTIDAD: PanelDeclarado = {
  id: "correo-identidad",
  label: "Identidad del correo",
  clase: "inspector",
};

export const PANEL_CORREO_DESTINATARIOS: PanelDeclarado = {
  id: "correo-destinatarios",
  label: "Destinatarios del correo",
  clase: "inspector",
};

export const PANEL_CORREO_REVISION: PanelDeclarado = {
  id: "correo-revision",
  label: "Revisión antes de exportar",
  clase: "inspector",
};

/**
 * Campañas de correo (E1h): crear, duplicar, renombrar y borrar.
 * `?panel=correo-campanas`; la campaña abierta la dice `foco`.
 */
export const PANEL_CORREO_CAMPANAS: PanelDeclarado = {
  id: "correo-campanas",
  label: "Campañas de correo",
  clase: "dialogo",
};

/**
 * Borrar una campaña, en dos pasos (el segundo pide escribir su nombre).
 * `?panel=correo-campana-borrar&foco=<campaign_id>` borra la del foco.
 */
export const PANEL_CORREO_CAMPANA_BORRAR: PanelDeclarado = {
  id: "correo-campana-borrar",
  label: "Borrar campaña de correo",
  clase: "dialogo",
};

export const PANELES_CORREOS = [
  PANEL_CORREO_IDENTIDAD,
  PANEL_CORREO_DESTINATARIOS,
  PANEL_CORREO_REVISION,
  PANEL_CORREO_CAMPANAS,
  PANEL_CORREO_CAMPANA_BORRAR,
] as const;
