// Lo que el lector de pantalla oye al ordenar arrastrando en el mazo (láminas y públicos), en español. dnd-kit trae los
// anuncios en inglés y con el id crudo («Picked up draggable item fortalezas:docentes»); aquí se nombra la cosa como la
// ve el analista y su lugar («Contraste de públicos, lugar 3 de 9»). Pura: el diálogo la usa y el test la prueba sola.

import type { Announcements, ScreenReaderInstructions } from "@dnd-kit/core";
import { formatoConteo } from "../../../../lib/formatoNumero";

export type CosasOrdenables = {
  /** Cómo se llama lo que se mueve: «la lámina», «el público». */
  que: string;
  /** Los ids en su orden actual. */
  ids: readonly string[];
  nombre: (id: string) => string;
};

const lugar = (c: CosasOrdenables, id: string | number) =>
  `lugar ${formatoConteo(c.ids.indexOf(String(id)) + 1)} de ${formatoConteo(c.ids.length)}`;

export function instruccionesArrastre(que: string): ScreenReaderInstructions {
  return {
    draggable: `Para mover ${que}, pulsa espacio o Intro. Con las flechas cambia de lugar; espacio o Intro lo suelta y Escape lo devuelve a donde estaba.`,
  };
}

export function anunciosArrastre(c: CosasOrdenables): Announcements {
  const nombre = (id: string | number) => `«${c.nombre(String(id))}»`;
  return {
    onDragStart: ({ active }) => `Tomaste ${nombre(active.id)}, ${lugar(c, active.id)}.`,
    onDragOver: ({ active, over }) => over
      ? `${nombre(active.id)} pasa al ${lugar(c, over.id)}.`
      : `${nombre(active.id)} está fuera de la lista.`,
    onDragEnd: ({ active, over }) => over
      ? `Soltaste ${nombre(active.id)} en el ${lugar(c, over.id)}.`
      : `Soltaste ${nombre(active.id)} fuera de la lista: queda donde estaba.`,
    onDragCancel: ({ active }) => `Se canceló. ${nombre(active.id)} vuelve al ${lugar(c, active.id)}.`,
  };
}
