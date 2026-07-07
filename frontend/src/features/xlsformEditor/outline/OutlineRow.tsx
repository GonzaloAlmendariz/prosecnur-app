// =============================================================================
// outline/OutlineRow.tsx — fila individual del outline jerárquico
// =============================================================================
// Cada fila del survey se renderiza con `useSortable({ id: rowIndex })` para
// participar del DndContext. El rango begin/end se muestra como una sola fila
// (la del begin) — el end_* no se renderiza explícitamente; el `span` lo
// computa el `BuilderStructure`. Mover una fila = mover su span entero.
//
// El handle de drag es el icono de la izquierda (cursor: grab). Click sobre la
// fila = seleccionar. Botones up/down se conservan (caso accesibilidad y hábito
// existente).
// =============================================================================

import type { KeyboardEvent, MouseEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { IconConditionalLogic } from "../../../lib/icons";
import type { BuilderNode } from "../types";
import { iconForType } from "../helpers/icons";
import { stripMarkdown } from "../helpers/markdown";
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
    isDragging,
  } = sortable;

  // El handle es el grip a la izquierda. La lista no se reordena visualmente
  // durante el drag; un slot explícito muestra el destino real de caída.

  const Icon = iconForType(node.typeInfo.base);
  const accent = paletteForType(node.typeInfo.base);
  const isBlock = node.kind === "section" || node.kind === "repeat";
  const closingType = node.kind === "repeat" ? "end_repeat" : "end_group";

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  }

  function onGripClick(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div
      ref={setNodeRef}
      className={`pulso-outline-row${isDragging ? " is-dragging" : ""}${
        active ? " is-active" : ""
      }`}
      data-outline-row={node.rowIndex}
      data-depth={node.depth}
    >
      <button
        type="button"
        className="pulso-outline-grip"
        title="Arrastra para reordenar"
        aria-label="Arrastra para reordenar"
        {...attributes}
        {...listeners}
        onClick={onGripClick}
      >
        <GripVertical size={14} />
      </button>

      <div
        role="button"
        tabIndex={0}
        aria-current={active ? "true" : undefined}
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
          {/* Jerarquía invertida: el LABEL humano va como título principal,
              el name técnico en el subtítulo. Antes era al revés y los
              usuarios no expertos veían `informante_nombre` en lugar del
              texto que escribieron. */}
          <strong className="pulso-outline-title">
            {stripMarkdown(node.label) || node.name || `fila_${node.rowIndex + 1}`}
          </strong>
          <span className="pulso-outline-subtitle">
            {node.kind === "question" ? typeLabel(node.typeInfo.base) : previewKindLabel(node)}
            {node.name && node.name !== stripMarkdown(node.label) ? (
              <>
                {" · "}
                <code className="pulso-outline-code">{node.name}</code>
              </>
            ) : null}
          </span>
          {isBlock ? (
            <span
              className="pulso-outline-boundary"
              title={`El cierre técnico ${closingType} se crea automáticamente y se mueve con el alcance de la sección.`}
            >
              <code>{closingType}</code>
              <span>auto</span>
            </span>
          ) : null}
        </span>
        {node.relevant && (
          <span
            className={`pulso-outline-conditional ${
              isBlock ? "is-section" : "is-question"
            }`}
            title={
              isBlock ? "Sección con visibilidad condicional" : "Pregunta condicional"
            }
            aria-label="Visibilidad condicional"
          >
            <IconConditionalLogic size={14} />
          </span>
        )}
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
