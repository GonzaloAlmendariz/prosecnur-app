import type { PanelDeclarado } from "../../../lib/navegacion/paneles";

/**
 * Inspector del editor de correos (Catálogo › Correos, ADR 0110 §2).
 *
 * «Bloque» es el inspector por defecto y no escribe `panel`; las otras
 * vistas del inspector son enlazables: `?panel=correo-identidad`,
 * `?panel=correo-destinatarios`, `?panel=correo-revision` y
 * `?panel=correo-envios`.
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

/**
 * Envíos de la campaña (addendum E1k): la invitación y sus recordatorios, con
 * fecha, a quién, asunto y apertura propios. `?panel=correo-envios`; el envío
 * que se mira es estado de la vista (como escritorio/teléfono), no dirección.
 */
export const PANEL_CORREO_ENVIOS: PanelDeclarado = {
  id: "correo-envios",
  label: "Envíos de la campaña",
  clase: "inspector",
};

/**
 * Importar un correo existente (addendum E1l): un HTML se lee como bloques,
 * con su informe, y crea una campaña o reemplaza la plantilla de la abierta.
 * `?panel=correo-importar`.
 */
export const PANEL_CORREO_IMPORTAR: PanelDeclarado = {
  id: "correo-importar",
  label: "Importar un correo existente",
  clase: "dialogo",
};

export const PANELES_CORREOS = [
  PANEL_CORREO_IDENTIDAD,
  PANEL_CORREO_DESTINATARIOS,
  PANEL_CORREO_REVISION,
  PANEL_CORREO_ENVIOS,
  PANEL_CORREO_CAMPANAS,
  PANEL_CORREO_CAMPANA_BORRAR,
  PANEL_CORREO_IMPORTAR,
] as const;
