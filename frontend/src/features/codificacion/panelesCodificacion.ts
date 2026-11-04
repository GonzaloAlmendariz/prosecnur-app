import type { PanelDeclarado } from "../../lib/navegacion/paneles";

/**
 * Codificación › una pregunta abierta: las palabras que se reconocen en sus comentarios, para unir las que dicen lo
 * mismo, excluir las que no informan y fijar frases (TXT-6/7). `?panel=palabras` sobre la pregunta abierta (`foco`).
 */
export const PANEL_PALABRAS: PanelDeclarado = {
  id: "palabras",
  label: "Palabras de la pregunta",
  clase: "sideover",
};

/**
 * Codificación › una pregunta de opción única: «Agrupar categorías» en vez de «Codificar respuestas» (4 nov 2026).
 * La gramática no tiene un sexto nivel: la pestaña ya es `codificar` y el `modo` lo fija el estudio, no un clic. Por eso
 * la vista alternativa es un panel `inspector` sobre la pregunta del `foco`: `?pestana=codificar&foco=<p>&panel=agrupar`.
 * Antes vivía en un `useState` suelto y no se podía enlazar ni auditar. Revisable por Gonzalo.
 */
export const PANEL_AGRUPAR: PanelDeclarado = {
  id: "agrupar",
  label: "Agrupar categorías",
  clase: "inspector",
};

export const PANELES_CODIFICACION = [PANEL_PALABRAS, PANEL_AGRUPAR] as const satisfies readonly PanelDeclarado[];
