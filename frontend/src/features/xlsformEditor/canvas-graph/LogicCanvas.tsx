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

const NODE_WIDTH = 200;
const NODE_HEIGHT = 56;

export type LogicCanvasProps = {
  open: boolean;
  onClose: () => void;
  structure: BuilderStructure | null;
  catalogs: CatalogSummary[];
  /** Si el usuario clickea un nodo de pregunta/sección, llamamos esto
   *  para que el editor seleccione esa fila al cerrar el canvas. */
  onSelectRow?: (rowIndex: number) => void;
};

export function LogicCanvas({
  open,
  onClose,
  structure,
  catalogs,
  onSelectRow,
}: LogicCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

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
    if (!isDraggingRef.current) return;
    const dx = event.clientX - dragStartRef.current.x;
    const dy = event.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };
  const onMouseUp = () => {
    isDraggingRef.current = false;
  };
  const onSvgClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest(".pulso-graph-node")) return;
    setSelectedId(null);
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
              return (
                <GraphNodeCard
                  key={node.id}
                  node={node}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  selected={isSelected}
                  highlighted={isHighlighted}
                  onClick={() => setSelectedId(node.id)}
                />
              );
            })}
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
