import type { PanelDeclarado } from "../../lib/navegacion/paneles";
import { PANEL_ARMONIZACION, PANEL_IMPORTAR_BLOQUES } from "./armonizacionModel";
import { PANEL_INDICADOR_COMPUESTO } from "./indicadorCompuestoModel";
import { PANEL_MAPA_BASES } from "./mapaBasesModel";
import { PANEL_ARMONIZACION_BASE, PANEL_COMPARAR_FUENTES } from "./fuentes/compararFuentesModel";

/**
 * Carga › Revisión: cómo se emparejó cada pregunta de una fuente de la base
 * (ADR 0099). Se abre con `?panel=emparejamiento&foco=<survey_id>`; vive en el
 * manifiesto porque el QA visual recorre esa lista.
 */
export const PANEL_EMPAREJAMIENTO_FUENTE: PanelDeclarado = {
  id: "emparejamiento",
  label: "Cómo se emparejaron las preguntas",
  clase: "sideover",
};

export const PANELES_CARGA = [
  PANEL_EMPAREJAMIENTO_FUENTE,
  PANEL_ARMONIZACION,
  PANEL_IMPORTAR_BLOQUES,
  // ADR 0105: sin `foco` es uno nuevo; con `foco=<ref>` edita el guardado.
  PANEL_INDICADOR_COMPUESTO,
  // Carga › Fuentes (ADR 0102): `foco=<base>` y `foco=<baseA>~<baseB>`.
  PANEL_ARMONIZACION_BASE,
  PANEL_COMPARAR_FUENTES,
  // G1: sin `foco`, la matriz por base; con `foco=<base>`, lo que esa base tiene fuera de la matriz.
  PANEL_MAPA_BASES,
] as const satisfies readonly PanelDeclarado[];
