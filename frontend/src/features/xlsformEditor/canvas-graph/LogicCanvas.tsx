// =============================================================================
// canvas-graph/LogicCanvas.tsx — overlay del mapa de visibilidad
// =============================================================================
// Vista jerárquica del workbook (post-rediseño): cada sección es una card
// colapsable; las preguntas internas solo se ven si la sección está
// expandida. Las flechas conectan únicamente preguntas/secciones unidas
// por `relevant` — el catálogo de opciones se muestra inline dentro de
// las preguntas select y los demás campos lógicos viven solo en el
// inspector.
//
// Interacciones:
//
//   * Drag fondo            → pan.
//   * Wheel sobre lienzo    → zoom.
//   * Click sección         → toggle expandir/colapsar.
//   * Click pregunta        → la selecciona y atenúa los no relacionados.
//   * Click fondo           → deselecciona.
//   * Drag desde anchor →   → escribe `relevant` en el destino con
//                            `${source} != ''`. Sin picker (solo hay un
//                            tipo de relación posible en este diseño).
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
import { GraphEdgeArrow, GraphEdgeMarkers } from "./GraphEdgeArrow";

export type LogicCanvasProps = {
  open: boolean;
  onClose: () => void;
  structure: BuilderStructure | null;
  catalogs: CatalogSummary[];
  onSelectRow?: (rowIndex: number) => void;
  /** Escribe la expresión de visibilidad (`relevant`) cuando el usuario
   *  declara una nueva conexión via drag-arrow. */
  onSetRelevant?: (rowIndex: number, expression: string) => void;
};

export function LogicCanvas({
  open,
  onClose,
  structure,
  catalogs,
  onSelectRow,
  onSetRelevant,
}: LogicCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Estado de creación de edge (drag desde anchor).
  const [edgeDraft, setEdgeDraft] = useState<{
    sourceId: string;
    cursorX: number;
    cursorY: number;
  } | null>(null);
  const [edgeHoverTargetId, setEdgeHoverTargetId] = useState<string | null>(
    null,
  );

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
      setExpandedSections(new Set());
    }
  }, [open]);

  // El grafo y su layout pueden ser caros para formularios grandes (RMS:
  // 4 niveles × 59 catálogos). Solo los calculamos cuando el canvas está
  // abierto — antes corría siempre que cambiaba structure/catalogs y
  // congelaba el editor incluso sin abrir el mapa.
  const graph = useMemo(() => {
    if (!open || !structure) return null;
    return buildLogicGraph(structure, catalogs);
  }, [open, structure, catalogs]);

  const layout = useMemo(() => {
    if (!open || !graph) return null;
    return layoutLogicGraph(graph, expandedSections);
  }, [open, graph, expandedSections]);

  // Set de IDs relacionados con la selección (vecinos directos in/out).
  const relatedIds = useMemo(() => {
    if (!selectedId || !layout) return null;
    const set = new Set<string>([selectedId]);
    for (const e of layout.edges) {
      if (e.edge.source === selectedId) set.add(e.edge.target);
      if (e.edge.target === selectedId) set.add(e.edge.source);
    }
    return set;
  }, [selectedId, layout]);

  if (!open) return null;

  const toCanvasCoords = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  };

  const findNodeUnderCursor = (
    clientX: number,
    clientY: number,
    sourceId: string,
  ) => {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const nodeEl = el.closest("[data-graph-node-id]") as HTMLElement | null;
    if (!nodeEl) return null;
    const id = nodeEl.getAttribute("data-graph-node-id");
    if (!id || id === sourceId) return null;
    return id;
  };

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
      const targetId = findNodeUnderCursor(
        event.clientX,
        event.clientY,
        edgeDraft.sourceId,
      );
      if (targetId && onSetRelevant && graph) {
        const sourceNode = graph.byId.get(edgeDraft.sourceId);
        const targetNode = graph.byId.get(targetId);
        if (sourceNode && targetNode) {
          // Conectamos hacia preguntas/secciones (todas tienen rowIndex).
          // Escribimos la expresión de visibilidad por defecto: "aparece
          // si la fuente tiene valor". El usuario refina el predicado
          // exacto en el inspector con el LogicBuilder.
          const expression = `\${${sourceNode.name}} != ''`;
          onSetRelevant(targetNode.rowIndex, expression);
        }
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
    setSelectedId(null);
  };

  const onAnchorMouseDown =
    (sourceId: string) => (event: React.MouseEvent) => {
      const { x, y } = toCanvasCoords(event.clientX, event.clientY);
      setEdgeDraft({ sourceId, cursorX: x, cursorY: y });
      setEdgeHoverTargetId(null);
    };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const expandAll = () => {
    if (!graph) return;
    const all = new Set<string>();
    for (const node of graph.byId.values()) {
      if (node.kind === "section") all.add(node.id);
    }
    setExpandedSections(all);
  };
  const collapseAll = () => setExpandedSections(new Set());

  // Lookup a "está condicional" para el badge en el header.
  const isConditional = (id: string): boolean => {
    if (!structure) return false;
    const rowIndex = parseInt(id.replace(/^q:/, ""), 10);
    if (isNaN(rowIndex)) return false;
    const builderNode = structure.byRow.get(rowIndex);
    return !!builderNode?.relevant;
  };

  const selectedNode: GraphNode | null = selectedId && graph
    ? graph.byId.get(selectedId) ?? null
    : null;

  const stats = layout
    ? {
        visible: layout.nodes.filter((n) => n.visible).length,
        edges: layout.edges.length,
      }
    : { visible: 0, edges: 0 };

  return (
    <div
      className="pulso-graph-overlay"
      role="dialog"
      aria-label="Mapa de visibilidad del formulario"
    >
      <header className="pulso-graph-header">
        <div className="pulso-graph-header-left">
          <button type="button" className="pulso-graph-back" onClick={onClose}>
            <ChevronLeft size={14} /> Volver al editor
          </button>
          <div className="pulso-graph-header-title">
            <strong>Mapa de visibilidad</strong>
            <span>
              {stats.visible} {stats.visible === 1 ? "nodo visible" : "nodos visibles"} ·{" "}
              {stats.edges} {stats.edges === 1 ? "conexión" : "conexiones"}
            </span>
          </div>
        </div>
        <div className="pulso-graph-header-right">
          <button
            type="button"
            className="pulso-graph-allbutton"
            onClick={expandAll}
            title="Expandir todas las secciones"
          >
            Expandir todo
          </button>
          <button
            type="button"
            className="pulso-graph-allbutton"
            onClick={collapseAll}
            title="Colapsar todas las secciones"
          >
            Colapsar todo
          </button>
          <span className="pulso-graph-sep" aria-hidden="true" />
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
            {/* Edges primero para que queden detrás de los nodos. */}
            {layout?.edges.map((edge, idx) => {
              const isHL =
                !!selectedId &&
                (edge.edge.source === selectedId ||
                  edge.edge.target === selectedId);
              const isDM =
                !!selectedId && !isHL && relatedIds !== null;
              return (
                <GraphEdgeArrow
                  key={`e-${idx}-${edge.edge.source}-${edge.edge.target}`}
                  edge={edge}
                  highlighted={isHL}
                  dimmed={isDM}
                />
              );
            })}

            {/* Nodos: solo los visibles. */}
            {layout?.nodes
              .filter((n) => n.visible)
              .map((laid) => {
                const id = laid.node.id;
                const isSelected = id === selectedId;
                const isHL =
                  !!relatedIds && relatedIds.has(id) && !isSelected;
                const isDraggingFrom = edgeDraft?.sourceId === id;
                const isMarkedTarget =
                  !!edgeDraft &&
                  edgeDraft.sourceId !== id &&
                  edgeHoverTargetId === id;
                const expanded =
                  laid.node.kind === "section" && expandedSections.has(id);
                return (
                  <GraphNodeCard
                    key={id}
                    laid={laid}
                    selected={isSelected}
                    highlighted={isHL}
                    expanded={expanded}
                    isConditional={isConditional(id)}
                    draggingFrom={isDraggingFrom}
                    markedAsTarget={isMarkedTarget}
                    onClick={() => setSelectedId(id)}
                    onToggleExpand={
                      laid.node.kind === "section"
                        ? () => toggleSection(id)
                        : undefined
                    }
                    onAnchorMouseDown={
                      onSetRelevant ? onAnchorMouseDown(id) : undefined
                    }
                  />
                );
              })}

            {/* Ghost edge mientras se arrastra. */}
            {edgeDraft && (() => {
              const sourceLaid = layout?.nodes.find(
                (n) => n.node.id === edgeDraft.sourceId && n.visible,
              );
              if (!sourceLaid) return null;
              const sx = sourceLaid.x + sourceLaid.width;
              const sy = sourceLaid.y + Math.min(sourceLaid.height, 56) / 2;
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
              Agrega preguntas o secciones y, cuando alguna esté condicionada
              a otra, la conexión aparecerá automáticamente acá.
            </p>
          </div>
        )}

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
              {selectedNode.kind === "section"
                ? "Sección"
                : "Pregunta"}
              {" · "}
              <code>{selectedNode.name}</code>
            </p>
            {selectedNode.kind === "question" && selectedNode.catalogContext && (
              <p>
                Catálogo: <code>{selectedNode.catalogContext.listName}</code>
                {" · "}
                {selectedNode.catalogContext.itemCount}{" "}
                {selectedNode.catalogContext.itemCount === 1
                  ? "opción"
                  : "opciones"}
              </p>
            )}
            {onSelectRow && (
              <button
                type="button"
                className="pulso-graph-detail-go"
                onClick={() => {
                  onSelectRow(selectedNode.rowIndex);
                  onClose();
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
