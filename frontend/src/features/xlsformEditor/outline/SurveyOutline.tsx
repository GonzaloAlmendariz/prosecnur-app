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
//   - Arrastrar el grip de la izquierda muestra un slot de caída explícito.
//     El bloque begin/end se mueve atómico
//     gracias a `computeRowMove` que opera sobre `structure.spans`.
//   - Overlay fijo propio con ghost alineado al punto real de agarre.
// =============================================================================

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
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
import { OutlineRow, OutlineCloseRow, OutlineCloseGhost } from "./OutlineRow";
import { OutlineDragOverlay } from "./OutlineDragOverlay";
import type { RowMovePlan } from "./outlineUtils";
import { computeEndMove, computeRowMove } from "./outlineUtils";

type DropPreview = {
  /** Fila (rowIndex actual) ANTES de la cual se dibuja el indicador. Es la
   *  posición REAL donde caerá el bloque según el plan de movimiento —no la
   *  fila sobrevolada—, para que el slot sea fiel al resultado. */
  anchorRow: number;
  /** Si el bloque cae al final (después de la última fila). */
  atEnd: boolean;
};

type OverlayGeometry = {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  point: { x: number; y: number };
};

function OutlineDropSlot() {
  return (
    <div className="pulso-outline-drop-slot" aria-hidden="true">
      <span className="pulso-outline-drop-slot-rail" />
      <span className="pulso-outline-drop-slot-copy">
        <strong>Soltar aquí</strong>
      </span>
    </div>
  );
}

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
  const outlineContainerRef = useRef<HTMLDivElement | null>(null);
  const [activeRow, setActiveRow] = useState<number | null>(null);
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null);
  const [overlayGeometry, setOverlayGeometry] = useState<OverlayGeometry | null>(null);

  useEffect(() => {
    if (activeRow == null) return;
    document.body.classList.add("pulso-outline-drag-active");

    function updateOverlayPoint(event: PointerEvent) {
      setOverlayGeometry((current) =>
        current
          ? { ...current, point: { x: event.clientX, y: event.clientY } }
          : current,
      );
    }

    window.addEventListener("pointermove", updateOverlayPoint, { capture: true });
    return () => {
      window.removeEventListener("pointermove", updateOverlayPoint, { capture: true });
      document.body.classList.remove("pulso-outline-drag-active");
    };
  }, [activeRow]);

  const sensors = useSensors(
    // Con filas compactas, un umbral pequeño se siente nervioso. Pedimos un
    // gesto más deliberado y limitamos el drag al handle de cada fila.
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const outlineCollisionDetection = useCallback<CollisionDetection>(
    ({ collisionRect, droppableRects, droppableContainers, pointerCoordinates }) => {
      const outlineRect = outlineContainerRef.current?.getBoundingClientRect();

      if (pointerCoordinates && outlineRect) {
        const pointerInsideOutline =
          pointerCoordinates.x >= outlineRect.left &&
          pointerCoordinates.x <= outlineRect.right &&
          pointerCoordinates.y >= outlineRect.top &&
          pointerCoordinates.y <= outlineRect.bottom;

        if (!pointerInsideOutline) return [];
      }

      const probeY =
        pointerCoordinates?.y ?? collisionRect.top + collisionRect.height / 2;

      return droppableContainers
        .map((droppableContainer) => {
          const rect = droppableRects.get(droppableContainer.id);
          if (!rect) return null;
          const centerY = rect.top + rect.height / 2;
          return {
            id: droppableContainer.id,
            data: {
              droppableContainer,
              position: probeY < centerY ? "before" : "after",
              value: Math.abs(probeY - centerY),
            },
          };
        })
        .filter((collision): collision is NonNullable<typeof collision> => collision != null)
        .sort((a, b) => a.data.value - b.data.value);
    },
    [],
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

  const activeNode = activeRow != null ? structure.byRow.get(activeRow) ?? null : null;

  // Lista de render fusionada: las filas normales del outline MÁS una fila
  // de cierre por cada sección/repeat con su `end_*` explícito. Ambas entran
  // al SortableContext, pero se mueven distinto: las normales mueven su span
  // atómico (`computeRowMove`); las de cierre reubican SOLO esa fila
  // (`computeEndMove`), cambiando qué preguntas quedan dentro.
  type RenderEntry =
    | { type: "node"; rowIndex: number; node: BuilderNode }
    | { type: "close"; rowIndex: number; label: string; depth: number; kind: "section" | "repeat" };
  const renderEntries: RenderEntry[] = structure.outline.map((node) => ({
    type: "node" as const,
    rowIndex: node.rowIndex,
    node,
  }));
  const closeRowSet = new Set<number>();
  for (const meta of structure.sections.values()) {
    if (meta.kind === "root" || meta.rowIndex == null || meta.endRowIndex == null) continue;
    closeRowSet.add(meta.endRowIndex);
    renderEntries.push({
      type: "close",
      rowIndex: meta.endRowIndex,
      label: meta.label || meta.name || "sección",
      depth: meta.depth,
      kind: meta.kind === "repeat" ? "repeat" : "section",
    });
  }
  renderEntries.sort((a, b) => a.rowIndex - b.rowIndex);
  const items = renderEntries.map((e) => e.rowIndex);
  const closeLabelByRow = new Map<number, { label: string; kind: "section" | "repeat"; depth: number }>();
  for (const e of renderEntries) {
    if (e.type === "close") closeLabelByRow.set(e.rowIndex, { label: e.label, kind: e.kind, depth: e.depth });
  }

  function collisionPosition(
    collisions: DragOverEvent["collisions"],
  ): "before" | "after" | null {
    const position = collisions?.[0]?.data?.position;
    return position === "before" || position === "after" ? position : null;
  }

  function deriveDropPreview(
    fromId: number,
    overId: number,
    position: "before" | "after" | null,
  ): DropPreview | null {
    if (!structure) return null;
    if (!Number.isFinite(fromId) || !Number.isFinite(overId)) return null;
    if (fromId === overId) return null;
    if (!position) return null;
    if (items.indexOf(fromId) < 0 || items.indexOf(overId) < 0) return null;

    const before = position === "before";
    const plan = closeRowSet.has(fromId)
      ? computeEndMove(structure, fromId, overId, before)
      : computeRowMove(structure, fromId, overId, before);
    if (!plan) return null;

    // Anclaje FIEL: dónde queda el bloque en el array ACTUAL (antes del
    // splice). `insertAt` está en términos del array ya sin la fuente; lo
    // reproyectamos al array actual para posicionar el indicador donde el
    // bloque realmente caerá, no donde está el cursor.
    const currentGap =
      plan.insertAt <= plan.fromStart ? plan.insertAt : plan.insertAt + plan.count;
    const maxRowIndex = items.length ? Math.max(...items) : -1;
    return {
      anchorRow: currentGap,
      atEnd: currentGap > maxRowIndex,
    };
  }

  function handleDragStart(event: DragStartEvent) {
    const id = Number(event.active.id);
    if (Number.isFinite(id)) setActiveRow(id);
    setDropPreview(null);
    const rect =
      event.active.rect.current.initial ??
      (Number.isFinite(id) ? outlineRowRect(id) : null);
    if (!rect) {
      setOverlayGeometry(null);
      return;
    }
    const point =
      pointFromActivatorEvent(event.activatorEvent) ?? {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    setOverlayGeometry({
      width: rect.width,
      height: rect.height,
      offsetX: point.x - rect.left,
      offsetY: point.y - rect.top,
      point,
    });
  }

  function handleDragOver(event: DragOverEvent) {
    const fromId = Number(event.active.id);
    const overId = event.over ? Number(event.over.id) : NaN;
    setDropPreview(deriveDropPreview(fromId, overId, collisionPosition(event.collisions)));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveRow(null);
    setDropPreview(null);
    setOverlayGeometry(null);
    const fromId = Number(event.active.id);
    const overId = event.over ? Number(event.over.id) : NaN;
    const position = collisionPosition(event.collisions);
    const preview = deriveDropPreview(fromId, overId, position);
    if (!preview) return;
    const before = position === "before";
    const plan = closeRowSet.has(fromId)
      ? computeEndMove(structure, fromId, overId, before)
      : computeRowMove(structure, fromId, overId, before);
    if (!plan) return;
    onApplyMove(plan);
  }

  function clearDragState() {
    setActiveRow(null);
    setDropPreview(null);
    setOverlayGeometry(null);
  }

  return (
    <DndContext
      sensors={sensors}
      autoScroll={false}
      collisionDetection={outlineCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={clearDragState}
    >
      <div ref={outlineContainerRef} className="pulso-outline-scroll">
        {/* Item especial "Ajustes del formulario" — no participa del dnd. */}
        <div
          role="button"
          tabIndex={0}
          aria-current={selection?.kind === "settings" ? "true" : undefined}
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
          {renderEntries.map((entry) => {
            const active =
              selection?.kind === "survey" && selection.rowIndex === entry.rowIndex;
            // Slot FIEL: se dibuja justo antes de la fila donde el bloque va
            // a caer (anchorRow del plan), no bajo el cursor.
            const slotBefore =
              dropPreview && !dropPreview.atEnd && dropPreview.anchorRow === entry.rowIndex;
            if (entry.type === "close") {
              return (
                <Fragment key={`close-${entry.rowIndex}`}>
                  {slotBefore ? <OutlineDropSlot /> : null}
                  <OutlineCloseRow
                    rowIndex={entry.rowIndex}
                    label={entry.label}
                    depth={entry.depth}
                    kind={entry.kind}
                    active={active}
                    onSelect={() => onSelect({ kind: "survey", rowIndex: entry.rowIndex })}
                  />
                </Fragment>
              );
            }
            const node = entry.node;
            return (
              <Fragment key={node.rowIndex}>
                {slotBefore ? <OutlineDropSlot /> : null}
                <OutlineRow
                  node={node}
                  active={active}
                  canMoveUp={active ? canMoveUp : false}
                  canMoveDown={active ? canMoveDown : false}
                  onSelect={() => onSelect({ kind: "survey", rowIndex: node.rowIndex })}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                />
              </Fragment>
            );
          })}
          {dropPreview?.atEnd ? <OutlineDropSlot /> : null}
        </SortableContext>
      </div>

      {overlayGeometry && typeof document !== "undefined" && (activeNode || (activeRow != null && closeRowSet.has(activeRow)))
        ? createPortal(
            <div
              className="pulso-outline-floating-overlay"
              style={{
                position: "fixed",
                zIndex: 10000,
                pointerEvents: "none",
                left: overlayGeometry.point.x - overlayGeometry.offsetX,
                top: overlayGeometry.point.y - overlayGeometry.offsetY,
              }}
            >
              {activeNode ? (
                <OutlineDragOverlay
                  node={activeNode}
                  size={{ width: overlayGeometry.width, height: overlayGeometry.height }}
                />
              ) : (
                <OutlineCloseGhost
                  info={activeRow != null ? closeLabelByRow.get(activeRow) ?? null : null}
                  size={{ width: overlayGeometry.width, height: overlayGeometry.height }}
                />
              )}
            </div>,
            document.body,
          )
        : null}
    </DndContext>
  );
}

function pointFromActivatorEvent(event: Event): { x: number; y: number } | null {
  if ("clientX" in event && "clientY" in event) {
    const { clientX, clientY } = event as MouseEvent | PointerEvent;
    if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
      return { x: clientX, y: clientY };
    }
  }

  if ("touches" in event) {
    const touch = (event as TouchEvent).touches[0] ?? (event as TouchEvent).changedTouches[0];
    if (touch) return { x: touch.clientX, y: touch.clientY };
  }

  return null;
}

function outlineRowRect(rowIndex: number): DOMRect | null {
  if (typeof document === "undefined") return null;
  return document
    .querySelector<HTMLElement>(`[data-outline-row="${rowIndex}"]`)
    ?.getBoundingClientRect() ?? null;
}
