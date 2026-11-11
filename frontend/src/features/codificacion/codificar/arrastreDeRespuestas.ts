// El arrastre de respuestas: lo que le dice a un lector de pantalla y dónde se dibuja el fantasma. El choque
// con las tarjetas es el de Preguntas (`preguntas/arrastre.ts`): el destino es la tarjeta bajo el cursor.

import type { Announcements, Modifier } from "@dnd-kit/core";

/** Distancia entre el cursor y el fantasma, y margen que el fantasma deja con el borde de la ventana. */
const SEPARACION = 12;
const MARGEN = 8;

type Caja = { left: number; top: number; width: number; height: number };

/**
 * Dónde va la esquina del fantasma para un cursor en `(x, y)`: abajo a la derecha del cursor y, si ahí se
 * saldría de la ventana, a su izquierda (o arriba). Nunca fuera de la ventana.
 */
export function lugarDelFantasma(
  cursor: { x: number; y: number },
  fantasma: { width: number; height: number },
  ventana: { width: number; height: number },
): { left: number; top: number } {
  let left = cursor.x + SEPARACION;
  if (left + fantasma.width > ventana.width - MARGEN) left = cursor.x - SEPARACION - fantasma.width;
  let top = cursor.y + SEPARACION;
  if (top + fantasma.height > ventana.height - MARGEN) top = cursor.y - SEPARACION - fantasma.height;
  return {
    left: Math.max(MARGEN, Math.min(left, ventana.width - MARGEN - fantasma.width)),
    top: Math.max(MARGEN, Math.min(top, ventana.height - MARGEN - fantasma.height)),
  };
}

/**
 * La capa del fantasma mide lo que el fantasma, no lo que la fila arrastrada: @dnd-kit le da el ancho y el
 * alto de la fila (562 px en una lista ancha) y el modificador calcula con esa capa. Con el ancho de la fila,
 * cerca del borde derecho el fantasma (320 px como mucho) quedaba lejos del puntero.
 */
export const ESTILO_DE_LA_CAPA_DEL_FANTASMA = { width: "max-content", height: "auto" } as const;

/** El modificador de @dnd-kit que aplica `lugarDelFantasma` al fantasma de las respuestas. */
export const fantasmaDentroDeLaVentana: Modifier = ({ activatorEvent, draggingNodeRect, overlayNodeRect, transform, windowRect }) => {
  if (!draggingNodeRect || !activatorEvent || !("clientX" in activatorEvent)) return transform;
  const puntero = activatorEvent as MouseEvent;
  const caja: Caja = overlayNodeRect ?? { left: 0, top: 0, width: 0, height: 0 };
  const ventana = windowRect ?? { width: window.innerWidth, height: window.innerHeight };
  const lugar = lugarDelFantasma(
    { x: puntero.clientX + transform.x, y: puntero.clientY + transform.y },
    { width: caja.width, height: caja.height },
    { width: ventana.width, height: ventana.height },
  );
  return { ...transform, x: lugar.left - draggingNodeRect.left, y: lugar.top - draggingNodeRect.top };
};

/**
 * Los anuncios del arrastre. `rotuloDeZona` traduce el id de una zona al nombre que se lee ("código 3.
 * Trabajo", "un código nuevo"); `cuantas` dice cuántas respuestas van en el lote.
 */
export function anunciosDeRespuestas(rotuloDeZona: (zona: string | number) => string, cuantas: () => number): Announcements {
  const lote = () => (cuantas() === 1 ? "1 respuesta" : `${cuantas()} respuestas`);
  return {
    onDragStart: () => `Se levantaron ${lote()}.`,
    onDragOver: ({ over }) => (over ? `Sobre ${rotuloDeZona(over.id)}.` : "Fuera de los códigos."),
    onDragEnd: ({ over }) => (over ? `Se soltaron ${lote()} en ${rotuloDeZona(over.id)}.` : "Se soltaron sin asignar."),
    onDragCancel: () => "Se canceló el arrastre.",
  };
}
