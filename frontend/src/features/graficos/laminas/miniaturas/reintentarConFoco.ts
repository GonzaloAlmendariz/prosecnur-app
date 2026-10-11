// «Reintentar» de una miniatura en error: el botón se desmonta en cuanto la lámina vuelve a pendiente, y si tenía el foco
// éste caía a <body> (quien navega con teclado perdía su lugar en la tira). Antes de pedir el reintento se pasa el foco
// a la miniatura de esa misma lámina, que es el ítem estable de la fila, sin desplazar el contenedor.

import { enfocarSinDesplazar } from "../enfocarSinDesplazar";

type Enfocable = { focus: (opciones?: FocusOptions) => void };
/** El `<li>` de la lámina (o cualquier ancestro que contenga su miniatura). */
export type ItemTira = { querySelector: (selector: string) => Enfocable | null };

export const SELECTOR_MINIATURA = ".pulso-f6-miniatura";

export function reintentarConFoco(item: ItemTira | null | undefined, reintentar: () => void): boolean {
  const enfocada = enfocarSinDesplazar(item?.querySelector(SELECTOR_MINIATURA));
  reintentar();
  return enfocada;
}
