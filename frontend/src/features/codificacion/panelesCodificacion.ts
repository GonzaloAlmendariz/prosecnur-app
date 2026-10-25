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

export const PANELES_CODIFICACION = [PANEL_PALABRAS] as const satisfies readonly PanelDeclarado[];
