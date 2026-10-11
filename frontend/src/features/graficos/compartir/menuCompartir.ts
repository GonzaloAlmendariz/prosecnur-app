// Ítems de compartir del menú ⋯ de Láminas (decisión 10): plan portátil (C11) y secciones JSON (C12). Puro: qué se
// ofrece, con qué texto y si está disponible en el alcance; la barra los pinta y conecta cada uno con su panel.

import type { PanelDeclarado } from "../../../lib/navegacion/paneles";
import { PANEL_PLAN_PORTATIL, PANEL_SECCIONES_JSON } from "../panelesGraficos";
import type { DisponibilidadCompartir } from "./disponibilidadCompartir";

export type ItemCompartirMenu = {
  clave: "plan-portatil" | "secciones-json";
  panel: PanelDeclarado;
  etiqueta: string;
  /** Lo que hace, o por qué no se puede usar en este alcance. */
  detalle: string;
  habilitado: boolean;
};

export function itemsCompartirMenu(d: DisponibilidadCompartir): ItemCompartirMenu[] {
  return [
    {
      clave: "plan-portatil",
      panel: PANEL_PLAN_PORTATIL,
      etiqueta: "Plan portátil…",
      detalle: d.planPortatil.habilitado ? "Exportar el plan o aplicarlo desde otro proyecto" : d.planPortatil.motivo,
      habilitado: d.planPortatil.habilitado,
    },
    {
      clave: "secciones-json",
      panel: PANEL_SECCIONES_JSON,
      etiqueta: "Exportar o importar secciones…",
      detalle: d.seccionesJson.habilitado ? "Archivo JSON con las partes del plan que elijas" : d.seccionesJson.motivo,
      habilitado: d.seccionesJson.habilitado,
    },
  ];
}
