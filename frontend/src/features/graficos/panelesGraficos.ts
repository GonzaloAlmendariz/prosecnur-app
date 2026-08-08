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

export const PANELES_GRAFICOS = [
  PANEL_BIBLIOTECA_SLIDES,
  PANEL_BIBLIOTECA_GRAFICADORES,
] as const satisfies readonly PanelDeclarado[];
