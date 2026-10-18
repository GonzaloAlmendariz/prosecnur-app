import { memo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "../../../vendor/lucide-react";

// Asa de arrastre de una línea de la Estructura (2026-10-17). Es lo ÚNICO que se suscribe a dnd-kit: durante un
// arrastre su contexto cambia en cada scroll y en cada movimiento, y con `useDraggable` en la fila entera las 800
// filas del ACNUR se volvían a pintar en cada cuadro (tareas de 1 s y un auto-scroll de pocos px por segundo). El
// hueco y el fantasma no usan las medidas de dnd-kit (los calcula SurveyOutline sobre el DOM), así que el nodo que
// dnd-kit mide puede ser el asa.

// El mismo elemento en cada render: React no vuelve a reconciliar el ícono de 800 asas en cada cuadro del arrastre.
const ICONO = <GripVertical size={14} />;

export const AsaArrastre = memo(function AsaArrastre({
  id,
  arrastrable,
  titulo,
  etiqueta,
}: {
  id: number;
  arrastrable: boolean;
  titulo: string;
  etiqueta: string;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id, disabled: !arrastrable });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className="pulso-outline-grip"
      title={arrastrable ? titulo : "Quita la búsqueda para mover"}
      aria-label={etiqueta}
      {...attributes}
      {...listeners}
      tabIndex={-1}
      disabled={!arrastrable}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {ICONO}
    </button>
  );
});
