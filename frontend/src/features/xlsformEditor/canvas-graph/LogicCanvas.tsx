// =============================================================================
// canvas-graph/LogicCanvas.tsx — overlay full-screen del mapa de lógica
// =============================================================================
// Vista estilo "Obsidian Canvas" del workbook: cada pregunta/sección/
// catálogo es una caja, las dependencias son flechas tipadas.
//
// Interacciones (F2-5):
//   - Pan: arrastrar el fondo.
//   - Zoom: scroll wheel sobre el lienzo.
//   - Click en nodo: lo selecciona + atenúa los no relacionados.
//   - Click en fondo: deselecciona todo.
//   - "Centrar" en el header: resetea zoom + pan.
//   - "Cerrar": disparado por Escape o el botón × del header.
//
// Sin librería de grafos — SVG nativo para portabilidad y bajo bundle.
// La edición (drag-arrows-to-write-expressions) entra en F2-6.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  Maximize2,
  ZoomIn,
  ZoomOut,
  X,
} from "lucide-react";
import type { BuilderStructure, CatalogSummary } from "../types";
import { buildLogicGraph } from "./buildGraph";
import type { GraphNode } from "./buildGraph";
import { layoutLogicGraph } from "./autoLayout";
import { GraphNodeCard } from "./GraphNodeCard";
import {
  GraphEdgeArrow,
  GraphEdgeMarkers,
  edgeStyleByKind,
} from "./GraphEdgeArrow";
import { EdgeKindPicker } from "./EdgeKindPicker";
import type { EdgeKindOption } from "./EdgeKindPicker";

const NODE_WIDTH = 200;
const NODE_HEIGHT = 56;

/**
 * Construye la expresión ODK inicial para una relación recién creada
 * desde el canvas. El usuario podrá refinarla luego en el inspector
 * con los builders visuales de F2-2/3/4.
 */
function buildExpressionForOption(
  field: "relevant" | "constraint" | "calculation" | "choice_filter",
  sourceRef: string,
): string {
  if (!sourceRef) return "";
  switch (field) {
    case "relevant":
      // "Aparece si X tiene valor" → string ODK estándar para "no vacío".
      return `\${${sourceRef}} != ''`;
    case "constraint":
      // "Valida con X" → la respuesta debe ser igual a la otra. Es un
      // placeholder razonable: el usuario refina después en el inspector.
      return `. = \${${sourceRef}}`;
    case "calculation":
      // "Calcula con X" → directamente el valor.
      return `\${${sourceRef}}`;
    case "choice_filter":
      // Filtros canónicos: la opción debe coincidir con la respuesta de X.
      // Los catálogos del corpus usan columnas filter::* — este es un
      // patrón razonable.
      return `name = \${${sourceRef}}`;
  }
}

export type LogicCanvasProps = {
  open: boolean;
  onClose: () => void;
  structure: BuilderStructure | null;
  catalogs: CatalogSummary[];
  /** Si el usuario clickea un nodo de pregunta/sección, llamamos esto
   *  para que el editor seleccione esa fila al cerrar el canvas. */
  onSelectRow?: (rowIndex: number) => void;
  /** Escribe (o reemplaza) la expresión de un campo lógico en una fila
   *  concreta del survey. Lo invoca el EdgeKindPicker al confirmar la
   *  relación: source.name + tipo de relación → expresión ODK lista. */
  onSetExpression?: (
    rowIndex: number,
    field: "relevant" | "constraint" | "calculation" | "choice_filter",
    expression: string,
  ) => void;
};

export function LogicCanvas({
  open,
  onClose,
  structure,
  catalogs,
  onSelectRow,
  onSetExpression,
}: LogicCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // -- Estado para crear edges -------------------------------------------
  // Cuando el usuario presiona el anchor de un nodo, guardamos su id.
  // Mientras el mouse se mueve, registramos la posición del cursor en
  // espacio del canvas (post-pan/zoom inverso). Al soltar, si está sobre
  // otro nodo, abrimos el EdgeKindPicker.
  const [edgeDraft, setEdgeDraft] = useState<{
    sourceId: string;
    cursorX: number; // canvas coords
    cursorY: number;
  } | null>(null);
  const [edgeHoverTargetId, setEdgeHoverTargetId] = useState<string | null>(null);
  const [edgePicker, setEdgePicker] = useState<{
    sourceId: string;
    targetId: string;
    screenX: number;
    screenY: number;
  } | null>(null);

  // Cerrar con Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Reset al abrir.
  useEffect(() => {
    if (open) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setSelectedId(null);
    }
  }, [open]);

  const graph = useMemo(() => {
    if (!structure) return null;
    return buildLogicGraph(structure, catalogs);
  }, [structure, catalogs]);

  const layout = useMemo(() => {
    if (!graph) return null;
    return layoutLogicGraph(graph, {
      nodeWidth: NODE_WIDTH,
      nodeHeight: NODE_HEIGHT,
    });
  }, [graph]);

  // Set de IDs relacionados con la selección actual: el nodo + sus
  // vecinos directos (in y out). Lo usamos para atenuar los no
  // relacionados.
  const relatedIds = useMemo(() => {
    if (!selectedId || !layout) return null;
    const set = new Set<string>([selectedId]);
    for (const edge of layout.edges) {
      if (edge.source === selectedId) set.add(edge.target);
      if (edge.target === selectedId) set.add(edge.source);
    }
    return set;
  }, [selectedId, layout]);

  // Conteo de edges por kind para mostrar leyenda.
  const edgeKindCounts = useMemo(() => {
    if (!layout) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const e of layout.edges) {
      m.set(e.kind, (m.get(e.kind) ?? 0) + 1);
    }
    return m;
  }, [layout]);

  if (!open) return null;

  const onWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const delta = -event.deltaY * 0.0015;
    setZoom((z) => Math.max(0.3, Math.min(2.5, z * (1 + delta))));
  };
  /** Convierte coordenadas de pantalla (clientX/Y) a coordenadas del
   *  espacio interno del canvas (post-pan/zoom). Útil para posicionar la
   *  punta de un edge fantasma en el cursor real del usuario. */
  const toCanvasCoords = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  };

  /** Detecta si el cursor está sobre un nodo distinto al source del draft.
   *  Devuelve el id del nodo, o null. */
  const findNodeUnderCursor = (clientX: number, clientY: number, sourceId: string) => {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const nodeEl = el.closest("[data-graph-node-id]") as HTMLElement | null;
    if (!nodeEl) return null;
    const id = nodeEl.getAttribute("data-graph-node-id");
    if (!id || id === sourceId) return null;
    return id;
  };

  const onMouseDown = (event: React.MouseEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest(".pulso-graph-node")) return;
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };
  const onMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (edgeDraft) {
      const { x, y } = toCanvasCoords(event.clientX, event.clientY);
      setEdgeDraft({ ...edgeDraft, cursorX: x, cursorY: y });
      const target = findNodeUnderCursor(
        event.clientX,
        event.clientY,
        edgeDraft.sourceId,
      );
      setEdgeHoverTargetId(target);
      return;
    }
    if (!isDraggingRef.current) return;
    const dx = event.clientX - dragStartRef.current.x;
    const dy = event.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };
  const onMouseUp = (event: React.MouseEvent<SVGSVGElement>) => {
    if (edgeDraft) {
      const target = findNodeUnderCursor(
        event.clientX,
        event.clientY,
        edgeDraft.sourceId,
      );
      if (target) {
        setEdgePicker({
          sourceId: edgeDraft.sourceId,
          targetId: target,
          screenX: event.clientX,
          screenY: event.clientY,
        });
      }
      setEdgeDraft(null);
      setEdgeHoverTargetId(null);
      isDraggingRef.current = false;
      return;
    }
    isDraggingRef.current = false;
  };
  const onSvgClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest(".pulso-graph-node")) return;
    if (edgePicker) return;
    setSelectedId(null);
  };

  /** Inicia un drag de edge desde el anchor de un nodo. */
  const onAnchorMouseDown = (sourceId: string) => (event: React.MouseEvent) => {
    const { x, y } = toCanvasCoords(event.clientX, event.clientY);
    setEdgeDraft({ sourceId, cursorX: x, cursorY: y });
    setEdgeHoverTargetId(null);
  };

  /** Aplica la elección del EdgeKindPicker: serializa la expresión y la
   *  envía al callback que provee el monolito. */
  const handleEdgePick = (option: EdgeKindOption) => {
    if (!edgePicker || !structure || !onSetExpression) {
      setEdgePicker(null);
      return;
    }
    const sourceNode = nodeById.get(edgePicker.sourceId);
    const targetNode = nodeById.get(edgePicker.targetId);
    if (!sourceNode || !targetNode || targetNode.rowIndex == null) {
      setEdgePicker(null);
      return;
    }
    // Construimos la expresión ODK según el tipo elegido. Usamos el
    // `subtitle` (que es el name técnico) del source. Para casos donde el
    // source es un catálogo el name es el listName.
    const sourceRef = sourceNode.kind === "catalog"
      ? sourceNode.listName ?? ""
      : sourceNode.subtitle;
    const expression = buildExpressionForOption(option.key, sourceRef);
    onSetExpression(targetNode.rowIndex, option.key, expression);
    setEdgePicker(null);
  };

  const nodeById = new Map<string, GraphNode>();
  for (const node of graph?.nodes ?? []) nodeById.set(node.id, node);

  const selectedNode = selectedId ? nodeById.get(selectedId) ?? null : null;

  const stats = layout
    ? {
        nodes: layout.nodes.length,
        edges: layout.edges.length,
      }
    : { nodes: 0, edges: 0 };

  return (
    <div className="pulso-graph-overlay" role="dialog" aria-label="Mapa de lógica del formulario">
      <header className="pulso-graph-header">
        <div className="pulso-graph-header-left">
          <button type="button" className="pulso-graph-back" onClick={onClose}>
            <ChevronLeft size={14} /> Volver al editor
          </button>
          <div className="pulso-graph-header-title">
            <strong>Mapa de lógica</strong>
            <span>
              {stats.nodes} {stats.nodes === 1 ? "nodo" : "nodos"} ·{" "}
              {stats.edges} {stats.edges === 1 ? "conexión" : "conexiones"}
            </span>
          </div>
        </div>
        <div className="pulso-graph-header-right">
          <button
            type="button"
            className="pulso-icon"
            onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))}
            title="Alejar"
            aria-label="Alejar"
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            className="pulso-icon"
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
            title="Acercar"
            aria-label="Acercar"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            className="pulso-icon"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            title="Centrar y restaurar zoom"
            aria-label="Centrar"
          >
            <Maximize2 size={14} />
          </button>
          <button
            type="button"
            className="pulso-icon pulso-icon-danger"
            onClick={onClose}
            title="Cerrar (Esc)"
            aria-label="Cerrar"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      <div className="pulso-graph-body">
        <svg
          ref={svgRef}
          className="pulso-graph-svg"
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onClick={onSvgClick}
        >
          <GraphEdgeMarkers />
          <g
            transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
            style={{ transformOrigin: "0 0" }}
          >
            {layout?.edges.map((edge, idx) => {
              const isHighlighted =
                !!selectedId &&
                (edge.source === selectedId || edge.target === selectedId);
              const isDimmed =
                !!selectedId && !isHighlighted && relatedIds !== null;
              return (
                <GraphEdgeArrow
                  key={`e-${idx}-${edge.source}-${edge.target}-${edge.kind}`}
                  edge={edge}
                  nodeWidth={NODE_WIDTH}
                  nodeHeight={NODE_HEIGHT}
                  highlighted={isHighlighted}
                  dimmed={isDimmed}
                />
              );
            })}
            {layout?.nodes.map((node) => {
              const isSelected = node.id === selectedId;
              const isHighlighted =
                !!relatedIds && relatedIds.has(node.id) && !isSelected;
              const isDraggingFrom = edgeDraft?.sourceId === node.id;
              const isMarkedTarget =
                !!edgeDraft &&
                edgeDraft.sourceId !== node.id &&
                edgeHoverTargetId === node.id;
              return (
                <GraphNodeCard
                  key={node.id}
                  node={node}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  selected={isSelected}
                  highlighted={isHighlighted}
                  draggingFrom={isDraggingFrom}
                  markedAsTarget={isMarkedTarget}
                  onClick={() => setSelectedId(node.id)}
                  onAnchorMouseDown={
                    onSetExpression ? onAnchorMouseDown(node.id) : undefined
                  }
                />
              );
            })}

            {/* Ghost edge: línea que sigue al cursor mientras el usuario
                arrastra desde un anchor. Se dibuja por encima de los nodos
                para que el usuario siempre la vea. */}
            {edgeDraft && (() => {
              const source = layout?.nodes.find(
                (n) => n.id === edgeDraft.sourceId,
              );
              if (!source) return null;
              const sx = source.x + NODE_WIDTH;
              const sy = source.y + NODE_HEIGHT / 2;
              const tx = edgeDraft.cursorX;
              const ty = edgeDraft.cursorY;
              const dx = Math.max(40, Math.abs(tx - sx) * 0.4);
              const path = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
              return (
                <path
                  d={path}
                  fill="none"
                  stroke="var(--pulso-primary)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  pointerEvents="none"
                />
              );
            })()}
          </g>
        </svg>

        {layout && layout.nodes.length === 0 && (
          <div className="pulso-graph-empty">
            <strong>Todavía no hay nada que mapear.</strong>
            <p>
              Agrega preguntas y, opcionalmente, asígnales lógica condicional
              o fórmulas. El mapa se construye automáticamente.
            </p>
          </div>
        )}

        {/* Leyenda flotante abajo a la izquierda */}
        {layout && layout.edges.length > 0 && (
          <aside className="pulso-graph-legend">
            <strong>Tipos de conexión</strong>
            <ul>
              {Array.from(edgeKindCounts.entries()).map(([kind, count]) => {
                const style = edgeStyleByKind(
                  kind as Parameters<typeof edgeStyleByKind>[0],
                );
                return (
                  <li key={kind}>
                    <svg width={32} height={6} aria-hidden="true">
                      <line
                        x1={2}
                        y1={3}
                        x2={30}
                        y2={3}
                        stroke={style.color}
                        strokeWidth={style.strokeWidth + 0.4}
                        strokeDasharray={style.dasharray}
                      />
                    </svg>
                    <span>{style.label}</span>
                    <em>{count}</em>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}

        {/* EdgeKindPicker: se monta cuando el usuario suelta un drag de
            edge sobre un nodo válido. Click en una opción → escribe la
            expresión en el destino vía onSetExpression. */}
        {edgePicker && (() => {
          const source = nodeById.get(edgePicker.sourceId);
          const target = nodeById.get(edgePicker.targetId);
          if (!source || !target) return null;
          // El target debe tener rowIndex (no es catalog). Si es catalog,
          // no podemos escribir lógica en él.
          if (target.rowIndex == null) return null;
          // Buscamos el estado actual de los campos lógicos del target
          // para mostrar "(reemplaza)" donde corresponda.
          const targetCurrent = (() => {
            const node = structure?.byRow.get(target.rowIndex);
            return {
              relevant: node?.relevant ?? "",
              constraint: node?.constraint ?? "",
              calculation: node?.calculation ?? "",
              choiceFilter: node?.choiceFilter ?? "",
            };
          })();
          return (
            <EdgeKindPicker
              x={edgePicker.screenX}
              y={edgePicker.screenY}
              source={source}
              target={target}
              targetCurrent={targetCurrent}
              onPick={handleEdgePick}
              onClose={() => setEdgePicker(null)}
            />
          );
        })()}

        {/* Panel de detalle del nodo seleccionado */}
        {selectedNode && (
          <aside className="pulso-graph-detail">
            <header>
              <strong>{selectedNode.title || selectedNode.subtitle}</strong>
              <button
                type="button"
                className="pulso-icon"
                onClick={() => setSelectedId(null)}
                title="Cerrar detalle"
                aria-label="Cerrar detalle"
              >
                <X size={12} />
              </button>
            </header>
            <p>
              {selectedNode.kind === "catalog"
                ? "Catálogo de opciones"
                : selectedNode.kind === "section"
                  ? "Sección"
                  : "Pregunta"}
              {" · "}
              <code>{selectedNode.subtitle}</code>
            </p>
            {selectedNode.kind !== "catalog" && (
              <p>
                <span>{selectedNode.inDegree} entradas</span>
                {" · "}
                <span>{selectedNode.outDegree} salidas</span>
              </p>
            )}
            {onSelectRow && selectedNode.rowIndex != null && (
              <button
                type="button"
                className="pulso-graph-detail-go"
                onClick={() => {
                  if (selectedNode.rowIndex != null) {
                    onSelectRow(selectedNode.rowIndex);
                    onClose();
                  }
                }}
              >
                Abrir en el editor →
              </button>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
