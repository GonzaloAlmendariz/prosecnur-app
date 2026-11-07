// Paneles del editor de formularios que siguen siendo overlays (2026-10-15): dependen de una selección o son un
// borrador que se aplica o se descarta. Las vistas de trabajo pasaron al rail de pestañas (`pestanaEditor.ts`).

import type { PanelDeclarado } from "../../../lib/navegacion/paneles";

/** Editor de listas (ContextLens de catálogos): depende de la lista elegida, así que es panel. */
export const PANEL_CATALOGOS: PanelDeclarado = {
  id: "catalogos",
  label: "Editor de listas",
  clase: "sideover",
};

/** Lógica de SurveyMonkey: un borrador que se aplica o se descarta, así que es panel. */
export const PANEL_LOGICA_SURVEYMONKEY: PanelDeclarado = {
  id: "logica-surveymonkey",
  label: "Lógica de SurveyMonkey",
  clase: "dialogo",
};

/**
 * Traducir una encuesta de SurveyMonkey vía API: `?panel=importar-surveymonkey`.
 * El diálogo arranca vacío (elegir encuesta), así que el enlace lo reproduce.
 */
export const PANEL_IMPORTAR_SURVEYMONKEY: PanelDeclarado = {
  id: "importar-surveymonkey",
  label: "Traducir encuesta de SurveyMonkey",
  clase: "dialogo",
};
