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

import { useEffect, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Check, GripVertical, RotateCcw, Trash2 } from "lucide-react";
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
  const [draftLabel, setDraftLabel] = useState(choice.label);
  const [draftName, setDraftName] = useState(choice.name);
  const [baseline, setBaseline] = useState({ label: choice.label, name: choice.name });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: choice.rowIndex });
  const dirty = draftLabel !== baseline.label || draftName !== baseline.name;

  useEffect(() => {
    if (dirty) return;
    setBaseline({ label: choice.label, name: choice.name });
    setDraftLabel(choice.label);
    setDraftName(choice.name);
  }, [choice.label, choice.name, choice.rowIndex, dirty]);

  const apply = () => {
    const nextLabel = draftLabel;
    const nextName = draftName.trim();
    if (nextLabel !== baseline.label) onLabelChange(nextLabel);
    if (nextName !== baseline.name) onNameChange(nextName);
    setDraftName(nextName);
    setBaseline({ label: nextLabel, name: nextName });
  };
  const revert = () => {
    setDraftLabel(baseline.label);
    setDraftName(baseline.name);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") apply();
    if (event.key === "Escape") revert();
  };

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
          value={draftLabel}
          onChange={(event) => setDraftLabel(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Lo que ve el encuestado (ej. Sí)"
          aria-label={`Texto visible de la opción ${position}`}
          title="Texto visible — lo que va a leer el encuestado en el formulario"
        />
        <input
          type="text"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="codigo (ej. si)"
          aria-label={`Código de la opción ${position}`}
          title="Código de la opción — identificador interno (sin tildes ni espacios). Aparece en la lógica y en los datos exportados."
          spellCheck={false}
          style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}
        />
      </div>

      <span
        className={`pulso-choice-row-draft-actions${dirty ? " is-visible" : ""}`}
        aria-label="Confirmar cambios de opción"
        aria-hidden={!dirty}
      >
        <button
          type="button"
          className="pulso-catalogdraft-apply"
          onMouseDown={(event) => event.preventDefault()}
          onClick={apply}
          disabled={!dirty || !draftName.trim()}
          title="Aplicar cambios"
        >
          <Check size={12} /> Aplicar
        </button>
        <button
          type="button"
          className="pulso-catalogdraft-revert"
          onMouseDown={(event) => event.preventDefault()}
          onClick={revert}
          disabled={!dirty}
          title="Revertir"
          aria-label="Revertir cambios de la opción"
        >
          <RotateCcw size={12} />
        </button>
      </span>

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
