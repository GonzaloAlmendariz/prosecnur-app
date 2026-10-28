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

/** Paleta de comandos (L30): ⌘K en macOS, Ctrl+K en Windows, o `?panel=paleta`. */
export const PANEL_PALETA: PanelDeclarado = {
  id: "paleta",
  label: "Ir a una vista",
  clase: "dialogo",
};

/** Atajos de la app (L30): tecla «?» fuera de un campo, o `?panel=atajos-app`. Gráficos conserva su propio «?». */
export const PANEL_ATAJOS_APP: PanelDeclarado = {
  id: "atajos-app",
  label: "Atajos de teclado",
  clase: "dialogo",
};
