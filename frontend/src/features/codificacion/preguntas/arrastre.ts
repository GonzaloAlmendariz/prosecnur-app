// Cómo se comporta el arrastre de Preguntas con @dnd-kit: con qué choca la pregunta levantada, dónde va
// su fantasma y qué se le dice a un lector de pantalla.

import {
  pointerWithin,
  rectIntersection,
  type Announcements,
  type CollisionDetection,
  type Modifier,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";

/**
 * Con el puntero, el destino es la fila que está bajo el cursor: las filas ocupan todo el ancho y medir
 * por la caja de la fila levantada marcaría a la vecina. Con el teclado no hay cursor y se mide por caja.
 */
export const colisionDePreguntas: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args);

const SEPARACION = 12;

/** El fantasma va junto al cursor, no en la esquina de la fila de la que salió. */
export const fantasmaJuntoAlCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (!draggingNodeRect || !activatorEvent || !("clientX" in activatorEvent)) return transform;
  const puntero = activatorEvent as MouseEvent;
  return {
    ...transform,
    x: transform.x + puntero.clientX - draggingNodeRect.left + SEPARACION,
    y: transform.y + puntero.clientY - draggingNodeRect.top + SEPARACION,
  };
};

export const instruccionesDeArrastre: ScreenReaderInstructions = {
  draggable:
    "Para levantar la pregunta pulsa Espacio. Muévela con las flechas hasta otra pregunta suelta y pulsa Espacio para soltarla. Con Escape se cancela.",
};

export const anunciosDeArrastre: Announcements = {
  onDragStart: ({ active }) => `Pregunta ${active.id} levantada.`,
  onDragOver: ({ active, over }) =>
    over ? `${active.id} está sobre ${over.id}.` : `${active.id} no está sobre ninguna pregunta.`,
  onDragEnd: ({ active, over }) =>
    over && over.id !== active.id ? `${active.id} se soltó sobre ${over.id}.` : `${active.id} se soltó sin emparejar.`,
  onDragCancel: ({ active }) => `Se canceló el arrastre de ${active.id}.`,
};
