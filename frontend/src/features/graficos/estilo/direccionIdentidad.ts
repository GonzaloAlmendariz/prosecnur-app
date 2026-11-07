// La dirección de una pieza de Identidad (Colores de las respuestas, Rótulos cortos…) desde cualquier lugar de Gráficos:
// pestaña `identidad` y la pieza en el `foco` (useSubpestana), sin el panel abierto. Un aviso que dice «asígnalos en
// Identidad › Colores» enlaza aquí, con la gramática de navegación v3 (lib/navegacion/direccion.ts).

import { conNivel } from "../../../lib/navegacion/direccion";
import { searchConNivel } from "../../../lib/navegacion/useDireccion";
import type { ClavePieza } from "./modeloPiezasIdentidad";

/** El `search` que abre la pieza de Identidad, conservando la base y el ámbito del informe. */
export function searchDePiezaIdentidad(search: string, pieza: ClavePieza): string {
  return conNivel(conNivel(searchConNivel(search, "pestana", "identidad"), "foco", pieza), "panel", null);
}
