import type { PanelDeclarado } from "../../lib/navegacion/paneles";
import { PANEL_ARMONIZACION, PANEL_IMPORTAR_BLOQUES } from "./armonizacionModel";

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
] as const satisfies readonly PanelDeclarado[];
