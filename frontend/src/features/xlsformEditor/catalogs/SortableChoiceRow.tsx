// =============================================================================
// catalogs/SortableChoiceRow.tsx — fila ordenable de una opción del catálogo
// =============================================================================
// Cada opción es un par (label visible, code interno). El usuario los edita
// inline con dos inputs apilados. El handle de drag aparece en hover a la
// izquierda. El número (1, 2, 3...) es el orden actual dentro del catálogo
// — se recalcula al renderizar.
//
// Aprovechamos `useSortable` de @dnd-kit/sortable; el id es el `rowIndex`
// global de la fila en la hoja `choices`. Idéntico patrón al `OutlineRow`
// del Sub-PR 4a.
// =============================================================================

import type { CSSProperties } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ChoiceItem } from "../types";

export type SortableChoiceRowProps = {
  choice: ChoiceItem;
  position: number;
  onLabelChange: (next: string) => void;
  onNameChange: (next: string) => void;
  onRemove: () => void;
};

export function SortableChoiceRow({
  choice,
  position,
  onLabelChange,
  onNameChange,
  onRemove,
}: SortableChoiceRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: choice.rowIndex });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`pulso-choice-row ${isDragging ? "is-dragging" : ""}`}
    >
      <button
        type="button"
        className="pulso-choice-row-handle"
        {...attributes}
        {...listeners}
        title="Arrastra para reordenar"
        aria-label="Reordenar opción"
      >
        <GripVertical size={13} />
      </button>

      <span className="pulso-choice-row-position" aria-hidden="true">
        {position}
      </span>

      <div className="pulso-choice-row-fields">
        <input
          type="text"
          value={choice.label}
          onChange={(event) => onLabelChange(event.target.value)}
          placeholder="Lo que ve el encuestado (ej. Sí)"
          aria-label={`Texto visible de la opción ${position}`}
          title="Texto visible — lo que va a leer el encuestado en el formulario"
        />
        <input
          type="text"
          value={choice.name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="codigo (ej. si)"
          aria-label={`Código de la opción ${position}`}
          title="Código de la opción — identificador interno (sin tildes ni espacios). Aparece en la lógica y en los datos exportados."
          spellCheck={false}
          style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}
        />
      </div>

      <button
        type="button"
        className="pulso-choice-row-delete"
        onClick={onRemove}
        title="Eliminar opción"
        aria-label="Eliminar opción"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
