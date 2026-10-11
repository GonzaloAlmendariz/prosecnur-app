import type { PanelDeclarado } from "../../lib/navegacion/paneles";
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

export const PANELES_GRAFICOS = [
  PANEL_BIBLIOTECA_SLIDES,
  PANEL_BIBLIOTECA_GRAFICADORES,
  PANEL_ESTRUCTURA_LAMINAS,
  PANEL_INSPECTOR_LAMINA,
  PANEL_AVISOS_INFORME,
  PANEL_TIPO_LAMINA,
  PANEL_TIPO_GRAFICO,
] as const satisfies readonly PanelDeclarado[];
