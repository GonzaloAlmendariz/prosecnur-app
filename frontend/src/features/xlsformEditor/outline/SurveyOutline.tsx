// =============================================================================
// outline/SurveyOutline.tsx — árbol drag-drop del survey
// =============================================================================
// Reemplaza al `BuilderSidebar` del monolito. Mantiene:
//   - Item "Ajustes del formulario" arriba (selecciona settings).
//   - Lista de filas top-level del outline (begin_group/repeat colapsan su
//     contenido por ahora — F2 los expandirá).
//   - Botones up/down en la fila activa (accesibilidad + hábito).
//
// Lo nuevo:
//   - DndContext + SortableContext con `verticalListSortingStrategy`.
//   - Arrastrar el grip de la izquierda (o cualquier parte de la fila vía
//     listeners) reorganiza las filas. El bloque begin/end se mueve atómico
//     gracias a `computeRowMove` que opera sobre `structure.spans`.
//   - DragOverlay con el ghost rotado para feedback visual.
//
// Animaciones: `@dnd-kit/sortable` aplica `transform` con `transition` a las
// filas no arrastradas — el efecto es un slide suave de 200ms cuando otras
// filas se mueven para hacer espacio.
// =============================================================================

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Layers3, Settings2 } from "lucide-react";
import { EmptyState } from "../../../components/States";
import type {
  BuilderNode,
  BuilderSelection,
  BuilderStructure,
} from "../types";
import { OutlineRow } from "./OutlineRow";
import { OutlineDragOverlay } from "./OutlineDragOverlay";
import type { RowMovePlan } from "./outlineUtils";
import { computeRowMove } from "./outlineUtils";

export type SurveyOutlineProps = {
  structure: BuilderStructure | null;
  selection: BuilderSelection | null;
  onSelect: (value: BuilderSelection) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Aplica un drag-drop concreto al workbook. */
  onApplyMove: (plan: RowMovePlan) => void;
};

export function SurveyOutline({
  structure,
  selection,
  onSelect,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onApplyMove,
}: SurveyOutlineProps) {
  const [activeRow, setActiveRow] = useState<number | null>(null);

  const sensors = useSensors(
    // Distancia mínima de 6px antes de iniciar el drag — evita capturar
    // clicks normales (selección).
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  if (!structure || !structure.outline.length) {
    return (
      <EmptyState
        icon={<Layers3 size={18} />}
        title="Todavía no hay piezas en el formulario"
        hint="Añade una sección o una pregunta para empezar a construir."
        variant="inline"
      />
    );
  }

  const items = structure.outline.map((n) => n.rowIndex);
  const activeNode = activeRow != null ? structure.byRow.get(activeRow) ?? null : null;

  function handleDragStart(event: DragStartEvent) {
    const id = Number(event.active.id);
    if (Number.isFinite(id)) setActiveRow(id);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveRow(null);
    const fromId = Number(event.active.id);
    const overId = event.over ? Number(event.over.id) : NaN;
    if (!Number.isFinite(fromId) || !Number.isFinite(overId)) return;
    if (fromId === overId) return;
    // Determinamos si el drop es "antes" o "después" del target en función
    // de la posición visual: si fromIndex < toIndex, el usuario movió hacia
    // abajo → soltar después; si no, antes.
    const fromOutlineIdx = items.indexOf(fromId);
    const toOutlineIdx = items.indexOf(overId);
    if (fromOutlineIdx < 0 || toOutlineIdx < 0) return;
    const before = fromOutlineIdx > toOutlineIdx;
    const plan = computeRowMove(structure, fromId, overId, before);
    if (!plan) return;
    onApplyMove(plan);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveRow(null)}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          maxHeight: 780,
          overflow: "auto",
          paddingRight: 4,
        }}
      >
        {/* Item especial "Ajustes del formulario" — no participa del dnd. */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelect({ kind: "settings" })}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect({ kind: "settings" });
            }
          }}
          className={`pulso-outline-row pulso-outline-settings${
            selection?.kind === "settings" ? " is-active" : ""
          }`}
        >
          <span className="pulso-outline-grip is-decor" aria-hidden="true">
            <Settings2 size={14} />
          </span>
          <div className="pulso-outline-body" style={{ paddingLeft: 2 }}>
            <span className="pulso-outline-text">
              <strong className="pulso-outline-title">Ajustes del formulario</strong>
              <span className="pulso-outline-subtitle">
                Título, ID y versión
              </span>
            </span>
          </div>
        </div>

        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          {structure.outline.map((node: BuilderNode) => {
            const active =
              selection?.kind === "survey" && selection.rowIndex === node.rowIndex;
            return (
              <OutlineRow
                key={node.rowIndex}
                node={node}
                active={active}
                canMoveUp={active ? canMoveUp : false}
                canMoveDown={active ? canMoveDown : false}
                onSelect={() => onSelect({ kind: "survey", rowIndex: node.rowIndex })}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
              />
            );
          })}
        </SortableContext>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeNode ? <OutlineDragOverlay node={activeNode} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
