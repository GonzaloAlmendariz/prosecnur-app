import type { PanelDeclarado } from "../../lib/navegacion/paneles";
import { PANEL_ARMONIZACION, PANEL_IMPORTAR_BLOQUES } from "./armonizacionModel";
import { PANEL_INDICADOR_COMPUESTO } from "./indicadorCompuestoModel";
import { PANEL_MAPA_BASES } from "./mapaBasesModel";
import { PANEL_ARMONIZACION_BASE, PANEL_COMPARAR_FUENTES } from "./fuentes/compararFuentesModel";
import { PANEL_VARIABLES_BASE } from "./variablesBase/variablesBaseModel";

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

/**
 * Carga › Equivalencias: segmentos de cruce del estudio (ADR 0107), la tabla
 * segmento × base. `?panel=segmentos`; con `foco=<clave>`, ese segmento. El
 * recorrido de la serie ya enlaza aquí; el panel lo monta su propio componente.
 */
export const PANEL_SEGMENTOS: PanelDeclarado = {
  id: "segmentos",
  label: "Segmentos de cruce",
  clase: "sideover",
};

/** Lo emite quien guarda o quita un segmento; el recorrido de la serie relee. */
export const EVENTO_SEGMENTOS = "pulso:segmentos-changed";

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
  // ADR 0106: `foco=<base>`; columnas propias, calculadas y «ya viene codificada».
  PANEL_VARIABLES_BASE,
  // ADR 0107: segmentos de cruce del estudio.
  PANEL_SEGMENTOS,
] as const satisfies readonly PanelDeclarado[];
