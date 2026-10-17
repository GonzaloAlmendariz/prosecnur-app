import type { PanelDeclarado } from "../../../lib/navegacion/paneles";

/**
 * Inspector del bloque en Catálogo › Editor (E1b).
 *
 * Está siempre a la vista, así que el editor **no escribe** `panel`: lo que
 * elige qué bloque se inspecciona es el foco (`?foco=<page_id>~<block_id>`).
 * Se declara para que el manifiesto enumere la superficie y el QA sepa que el
 * editor tiene un inspector; `?panel=bloque` aterriza en el mismo editor.
 */
export const PANEL_EDITOR_BLOQUE: PanelDeclarado = {
  id: "bloque",
  label: "Bloque de la receta",
  clase: "inspector",
};
