import type { PanelDeclarado } from "../../lib/navegacion/paneles";
import { PANEL_GUIAS_LAMINA } from "./laminas/guias/panelGuias";
import { PANEL_TIPO_GRAFICO, PANEL_TIPO_LAMINA } from "./laminas/selectores/panelesSelectores";

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

/** Estructura del informe en la pestaña Láminas: lateral izquierdo, excluyente con el inspector (F6.1). */
export const PANEL_ESTRUCTURA_LAMINAS: PanelDeclarado = {
  id: "estructura",
  label: "Estructura del informe",
  clase: "sideover",
};

/** Inspector de la pestaña Láminas: lateral derecho (sideover en el compacto), excluyente con la Estructura (F6.1). */
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

/** «Armar desde…» (planes sugeridos, perfiles y sincronizar equivalencias): popover direccionable (A5 rebanada 2b). */
export const PANEL_ARMAR_DESDE: PanelDeclarado = {
  id: "armar-desde",
  label: "Armar desde un plan sugerido",
  clase: "popover",
};

/** Biblioteca de íconos de un capítulo del índice (A5 rebanada 2b). */
export const PANEL_ICONOS: PanelDeclarado = {
  id: "iconos",
  label: "Íconos del índice",
  clase: "dialogo",
};

export const PANELES_GRAFICOS = [
  PANEL_BIBLIOTECA_SLIDES,
  PANEL_BIBLIOTECA_GRAFICADORES,
  PANEL_ESTRUCTURA_LAMINAS,
  PANEL_INSPECTOR_LAMINA,
  PANEL_AVISOS_INFORME,
  PANEL_TIPO_LAMINA,
  PANEL_TIPO_GRAFICO,
  PANEL_GUIAS_LAMINA,
  PANEL_ARMAR_DESDE,
  PANEL_ICONOS,
] as const satisfies readonly PanelDeclarado[];
