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
//
// Identidad «Señales» (2026-10-17): el tipo se pinta como sello y las marcas de la fila (obligatoria, condición
// propia o heredada, restricción, cálculo, filtro) van en el riel fijo de cinco casillas, FUERA del cuerpo
// seleccionable (cada casilla es un botón propio que abre su panel).
// =============================================================================

import { useMemo, type KeyboardEvent, type MouseEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { ArrowDown, ArrowUp, GripVertical } from "../../../vendor/lucide-react";
import type { BuilderNode } from "../types";
import { stripMarkdown } from "../helpers/markdown";
import { TypeIcon } from "../kit/TypeIcon";
import { Riel } from "../kit/Riel";
import { marcasNodo } from "../kit/marcasNodo";
import { useContextoReglas } from "../kit/ContextoReglas";
import { typeLabel } from "../parsing/parseType";
import { previewKindLabel } from "../parsing/buildIndex";

/**
 * Fila de CIERRE de sección — la contraparte visible del `begin_*`. Antes el
 * outline ocultaba el `end_group` y mostraba un chip "auto"; ahora el cierre
 * es una pieza propia que el usuario ve, selecciona, arrastra y elimina.
 * Arrastrarla reubica SOLO el cierre (cambia qué preguntas quedan dentro),
 * con la restricción de no cruzar antes de su begin (ver `computeEndMove`).
 */
export function OutlineCloseRow({
  rowIndex,
  label,
  depth,
  kind,
  active,
  onSelect,
}: {
  rowIndex: number;
  label: string;
  depth: number;
  kind: "section" | "repeat";
  active: boolean;
  onSelect: () => void;
}) {
  const sortable = useSortable({ id: rowIndex });
  const { attributes, listeners, setNodeRef, isDragging } = sortable;
  return (
    <div
      ref={setNodeRef}
      className={`pulso-outline-row pulso-outline-closerow${isDragging ? " is-dragging" : ""}${active ? " is-active" : ""}`}
      data-outline-row={rowIndex}
      data-depth={depth}
    >
      <button
        type="button"
        className="pulso-outline-grip"
        title="Arrastra para mover el cierre de la sección"
        aria-label="Arrastra para mover el cierre"
        {...attributes}
        {...listeners}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <GripVertical size={14} />
      </button>
      <div
        role="button"
        tabIndex={0}
        aria-current={active ? "true" : undefined}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        className="pulso-outline-body"
        style={{ paddingLeft: 2 + depth * 14 }}
      >
        <span aria-hidden="true" className="pulso-outline-typeicon pulso-outline-closeicon">
          <TypeIcon baseType={kind === "repeat" ? "end_repeat" : "end_group"} size={14} />
        </span>
        <span className="pulso-outline-text">
          <strong className="pulso-outline-title">Cierre de {kind === "repeat" ? "repetición" : "sección"}</strong>
          <span className="pulso-outline-subtitle">
            Termina <span className="pulso-outline-closelabel" title={stripMarkdown(label) || label}>{stripMarkdown(label) || label}</span>
          </span>
        </span>
      </div>
    </div>
  );
}

/** Fantasma que sigue al cursor mientras se arrastra una fila de cierre. */
export function OutlineCloseGhost({
  info,
  size,
}: {
  info: { label: string; kind: "section" | "repeat"; depth: number } | null;
  size: { width: number; height: number };
}) {
  return (
    <div
      className="pulso-outline-row pulso-outline-closerow is-overlay"
      style={{ width: size.width }}
    >
      <span className="pulso-outline-grip" aria-hidden="true">
        <GripVertical size={14} />
      </span>
      <div className="pulso-outline-body">
        <span aria-hidden="true" className="pulso-outline-typeicon pulso-outline-closeicon">
          <TypeIcon baseType={info?.kind === "repeat" ? "end_repeat" : "end_group"} size={14} />
        </span>
        <span className="pulso-outline-text">
          <strong className="pulso-outline-title">
            Cierre de {info?.kind === "repeat" ? "repetición" : "sección"}
          </strong>
          <span className="pulso-outline-subtitle">
            Termina{" "}
            <span className="pulso-outline-closelabel">
              {info ? stripMarkdown(info.label) || info.label : ""}
            </span>
          </span>
        </span>
      </div>
    </div>
  );
}

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

  const reglas = useContextoReglas();
  const requiredRaw = reglas?.requiredRaw(node.rowIndex);
  const marcas = useMemo(
    () => marcasNodo(node, reglas?.structure, requiredRaw),
    [node, reglas?.structure, requiredRaw],
  );
  const isBlock = node.kind === "section" || node.kind === "repeat";

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
      className={`pulso-outline-row${isBlock ? ` pulso-outline-row--${node.kind}` : ""}${
        isDragging ? " is-dragging" : ""
      }${active ? " is-active" : ""}`}
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
        <span aria-hidden="true" className="pulso-outline-typeicon">
          <TypeIcon baseType={node.typeInfo.base} size={14} />
        </span>
        <span className="pulso-outline-text">
          {/* Jerarquía invertida: el LABEL humano va como título principal,
              el name técnico en el subtítulo. Antes era al revés y los
              usuarios no expertos veían `informante_nombre` en lugar del
              texto que escribieron. */}
          <strong
            className="pulso-outline-title"
            title={stripMarkdown(node.label) || node.name || `fila_${node.rowIndex + 1}`}
          >
            {stripMarkdown(node.label) || node.name || `fila_${node.rowIndex + 1}`}
          </strong>
          {/* El código va en su propio grupo: si no cabe entero en la línea, salta a una segunda línea que el
              subtítulo recorta. Se lee entero o no se ve, nunca un fragmento con «…». */}
          <span className="pulso-outline-subtitle pulso-outline-subtitle--codigo" title={node.name || undefined}>
            <span className="pulso-outline-kind">
              {node.kind === "question" ? typeLabel(node.typeInfo.base) : previewKindLabel(node)}
            </span>
            {node.name && node.name !== stripMarkdown(node.label) ? (
              <span className="pulso-outline-codewrap">
                <span aria-hidden="true">·</span>
                <code className="pulso-outline-code">{node.name}</code>
              </span>
            ) : null}
          </span>
        </span>
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

      {/* El riel va al final para que su columna no se corra en la fila elegida (las flechas quedan antes). */}
      <Riel nodo={node} marcas={marcas} scope={reglas?.scope} className="pulso-outline-riel" />
    </div>
  );
}
