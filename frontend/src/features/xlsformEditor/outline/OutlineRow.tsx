// =============================================================================
// outline/OutlineRow.tsx — fila individual del outline jerárquico
// =============================================================================
// Cada fila del survey se renderiza con `useSortable({ id: rowIndex })` para
// participar del DndContext. El rango begin/end se muestra como una sola fila
// (la del begin) — el end_* no se renderiza explícitamente; el `span` lo
// computa el `BuilderStructure`. Mover una fila = mover su span entero.
//
// El handle de drag es el icono de la izquierda (cursor: grab); arrastrar
// desde el resto de la fila también funciona pero es más sutil. Click sobre
// la fila = seleccionar. Botones up/down se conservan (caso accesibilidad
// y hábito existente).
// =============================================================================

import type { CSSProperties, KeyboardEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import type { BuilderNode } from "../types";
import { iconForType } from "../helpers/icons";
import { paletteForType } from "../helpers/paletteForType";
import { typeLabel } from "../parsing/parseType";
import { previewKindLabel } from "../parsing/buildIndex";

export type OutlineRowProps = {
  node: BuilderNode;
  active: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

export function OutlineRow({
  node,
  active,
  canMoveUp,
  canMoveDown,
  onSelect,
  onMoveUp,
  onMoveDown,
}: OutlineRowProps) {
  const sortable = useSortable({ id: node.rowIndex });
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = sortable;

  // El handle es el grip a la izquierda; el resto de la fila no es draggable
  // para que el click siga seleccionando con naturalidad.
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const Icon = iconForType(node.typeInfo.base);
  const accent = paletteForType(node.typeInfo.base);

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`pulso-outline-row${isDragging ? " is-dragging" : ""}${active ? " is-active" : ""}`}
      data-depth={node.depth}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        title="Arrastrar para reordenar"
        aria-label="Arrastrar para reordenar"
        className="pulso-outline-grip"
      >
        <GripVertical size={14} />
      </button>

      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={onKey}
        className="pulso-outline-body"
        style={{ paddingLeft: 2 + node.depth * 14 }}
      >
        <span
          aria-hidden="true"
          className="pulso-outline-typeicon"
          style={{ color: accent }}
        >
          <Icon size={14} />
        </span>
        <span className="pulso-outline-text">
          <strong className="pulso-outline-title">
            {node.name || node.label || `fila_${node.rowIndex + 1}`}
          </strong>
          <span className="pulso-outline-subtitle">
            {node.kind === "question" ? typeLabel(node.typeInfo.base) : previewKindLabel(node)}
            {node.label && node.label !== node.name ? ` · ${node.label}` : ""}
          </span>
        </span>
        {node.required && (
          <span
            aria-label="Pregunta obligatoria"
            title="Obligatoria"
            className="pulso-outline-required"
          >
            ★
          </span>
        )}
      </div>

      {active && (
        <span className="pulso-outline-actions">
          <button
            type="button"
            className="pulso-icon"
            disabled={!canMoveUp}
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
            title="Mover arriba (también puedes arrastrar)"
            aria-label="Mover arriba"
          >
            <ArrowUp size={13} />
          </button>
          <button
            type="button"
            className="pulso-icon"
            disabled={!canMoveDown}
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
            title="Mover abajo (también puedes arrastrar)"
            aria-label="Mover abajo"
          >
            <ArrowDown size={13} />
          </button>
        </span>
      )}
    </div>
  );
}
