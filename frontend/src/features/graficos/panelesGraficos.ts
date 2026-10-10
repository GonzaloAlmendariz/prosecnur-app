import type { PanelDeclarado } from "../../lib/navegacion/paneles";

export const PANEL_BIBLIOTECA_SLIDES: PanelDeclarado = {
  id: "biblioteca-slides",
  label: "Biblioteca de slides",
  clase: "dialogo",
};

export const PANEL_BIBLIOTECA_GRAFICADORES: PanelDeclarado = {
  id: "biblioteca-graficadores",
  label: "Biblioteca de graficadores",
  clase: "dialogo",
};

/** Inspector de la pestaña Láminas: columna fija en el marco ancho, sideover en el compacto (F6.1). */
export const PANEL_INSPECTOR_LAMINA: PanelDeclarado = {
  id: "inspector",
  label: "Ajustes de la lámina",
  clase: "sideover",
};

/** Avisos del informe en la pestaña Láminas: lo que bloquea exportar, lo que conviene revisar y lo que dijo el motor. */
export const PANEL_AVISOS_INFORME: PanelDeclarado = {
  id: "avisos",
  label: "Avisos del informe",
  clase: "sideover",
};

export const PANELES_GRAFICOS = [
  PANEL_BIBLIOTECA_SLIDES,
  PANEL_BIBLIOTECA_GRAFICADORES,
  PANEL_INSPECTOR_LAMINA,
  PANEL_AVISOS_INFORME,
] as const satisfies readonly PanelDeclarado[];
