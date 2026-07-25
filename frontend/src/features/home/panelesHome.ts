// Paneles globales de la app, declarados una sola vez.
//
// Viven aquí y no en `lib/navegacion/paneles.ts` para que el catálogo genérico
// no tenga que conocer las features; el manifiesto los reexporta.

import type { PanelDeclarado } from "../../lib/navegacion/paneles";

export const PANEL_MODULOS: PanelDeclarado = {
  id: "modulos",
  label: "Selector de módulos",
  clase: "dialogo",
  alias: [{ param: "agregar", valor: "1" }],
};

export const PANEL_CONFIGURACION: PanelDeclarado = {
  id: "configuracion",
  label: "Configuración global",
  clase: "dialogo",
  alias: [{ param: "settings" }],
};
