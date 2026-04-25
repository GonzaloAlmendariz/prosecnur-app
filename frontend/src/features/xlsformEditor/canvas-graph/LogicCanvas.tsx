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
  ChevronsDown,
  ChevronsUp,
  CircleDot,
  Edit3,
  Folder,
  Info,
  Maximize2,
  Pencil,
  ZoomIn,
  ZoomOut,
  X,
} from "lucide-react";
import type { BuilderStructure, CatalogSummary } from "../types";
import { buildLogicGraph } from "./buildGraph";
import type { GraphNode } from "./buildGraph";
import { layoutLogicGraph } from "./autoLayout";
import { GraphNodeCard } from "./GraphNodeCard";
import { CanvasToolbar } from "./CanvasToolbar";
import { ConnectionConditionPicker } from "./ConnectionConditionPicker";
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
  /** Índice del edge sobre el que está el mouse — para mostrar la
   *  etiqueta "si X = Y" cerca del centro del path. */
  const [hoveredEdgeIdx, setHoveredEdgeIdx] = useState<number | null>(null);
  /** Índice del edge clicado — aísla esa rama (todas las demás se
   *  atenúan). El select de nodo ya NO atenúa: ahora sólo este lo hace,
   *  y el efecto se dispara únicamente al hacer click en una flecha,
   *  no al pasar el mouse. */
  const [selectedEdgeIdx, setSelectedEdgeIdx] = useState<number | null>(null);

  // ── Drag libre de cards (estilo Obsidian Canvas) ──────────────────
  // Cada vez que el usuario arrastra una card, registramos su posición
  // override en `nodePositions`. El layout greedy se respeta como
  // baseline; los nodos con override en este map se renderizan en
  // (x, y) absoluto. "Auto-layout" del toolbar limpia el map.
  const [nodePositions, setNodePositions] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());
  /** Drag de una card en curso. `cardOriginX/Y` es la posición de la
   *  card al inicio del drag; los deltas del cursor se suman a esos
   *  valores (no nos importa donde estaba el cursor cuando empezó). */
  const cardDragRef = useRef<{
    nodeId: string;
    cardOriginX: number;
    cardOriginY: number;
    cursorOriginX: number;
    cursorOriginY: number;
    moved: boolean;
  } | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);

  // ── Toolbar: filtro de tipos de edge + snap ──────────────────────
  /** "all" | "macro" (sec↔sec / var→sec) | "micro" (var↔var). */
  const [edgeFilter, setEdgeFilter] = useState<"all" | "macro" | "micro">(
    "all",
  );
  const [snapToGrid, setSnapToGrid] = useState(false);
  const SNAP_GRID = 16;

  // ── Picker de condición al conectar ──────────────────────────────
  // Cuando el usuario suelta una flecha drag-arrow sobre un target,
  // mostramos un mini-modal en la posición del cursor con opciones
  // para definir QUÉ condición usar — "tiene valor", "es igual a X",
  // "es distinto de X", o las opciones del catálogo si el source es
  // un select. El usuario elige y solo entonces se escribe el
  // `relevant`. Sin esto, hoy escribíamos siempre `${X} != ''` directo,
  // lo cual era cómodo pero pobre.
  const [connectPicker, setConnectPicker] = useState<{
    sourceId: string;
    targetId: string;
    screenX: number;
    screenY: number;
  } | null>(null);
  /** Id del edge que acaba de aparecer — para reproducir la animación
   *  de pulse una sola vez. Limpiamos a los 600ms. */
  const [freshEdgeKey, setFreshEdgeKey] = useState<string | null>(null);
  /** La leyenda "Cómo leer las flechas" arranca colapsada (solo icono).
   *  El usuario la expande con click. Por defecto colapsada porque la
   *  versión expandida ocupaba demasiado espacio en el lienzo. */
  const [legendOpen, setLegendOpen] = useState(false);

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
      setNodePositions(new Map());
      setEdgeFilter("all");
      setSnapToGrid(false);
      setConnectPicker(null);
      setFreshEdgeKey(null);
      setLegendOpen(false);
      setSelectedEdgeIdx(null);
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
    return layoutLogicGraph(graph, expandedSections, nodePositions);
  }, [open, graph, expandedSections, nodePositions]);

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

  // Convención macOS / trackpad estándar (igual que Figma, Miro, Obsidian
  // Canvas): two-finger drag dispara `wheel` sin ctrlKey → PAN.
  // Pinch-to-zoom dispara `wheel` con ctrlKey=true sintético → ZOOM.
  // Mouse wheel discreto (rueda física) también dispara sin ctrlKey;
  // para que ese caso siga haciendo zoom, detectamos `deltaMode !== 0`
  // (line/page mode) o un deltaY chico — proxy razonable para "no es
  // trackpad". Si dudas, el usuario puede mantener Cmd para forzar zoom.
  const onWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const isPinch = event.ctrlKey;
    const isTrackpadPan =
      !event.ctrlKey && event.deltaMode === 0 && Math.abs(event.deltaX) > 0;
    if (isPinch) {
      const delta = -event.deltaY * 0.005;
      setZoom((z) => Math.max(0.3, Math.min(2.5, z * (1 + delta))));
      return;
    }
    if (isTrackpadPan || (event.deltaMode === 0 && !event.ctrlKey)) {
      // Two-finger drag → pan (siguiendo el cursor, no invertido).
      setPan((p) => ({ x: p.x - event.deltaX, y: p.y - event.deltaY }));
      return;
    }
    // Mouse wheel discreto (deltaMode 1 = lines, 2 = pages) → zoom
    // tradicional. Cmd/Ctrl + wheel también cae acá.
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
    // Card drag tiene prioridad sobre los demás modos.
    if (cardDragRef.current) {
      const drag = cardDragRef.current;
      const dx = (event.clientX - drag.cursorOriginX) / zoom;
      const dy = (event.clientY - drag.cursorOriginY) / zoom;
      // Detectamos si fue un drag real (>3px) para no consumir el click
      // de selección/expand al soltar.
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      let nextX = drag.cardOriginX + dx;
      let nextY = drag.cardOriginY + dy;
      if (snapToGrid) {
        nextX = Math.round(nextX / SNAP_GRID) * SNAP_GRID;
        nextY = Math.round(nextY / SNAP_GRID) * SNAP_GRID;
      }
      setNodePositions((prev) => {
        const next = new Map(prev);
        next.set(drag.nodeId, { x: nextX, y: nextY });
        return next;
      });
      return;
    }
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
    if (cardDragRef.current) {
      // Si el usuario solo hizo click sin mover, consideramos selección
      // del nodo (lo manejará el onClick del propio card). Si sí movió,
      // ya quedó la nueva posición persistida en `nodePositions`.
      cardDragRef.current = null;
      setDraggingCardId(null);
      return;
    }
    if (edgeDraft) {
      const targetId = findNodeUnderCursor(
        event.clientX,
        event.clientY,
        edgeDraft.sourceId,
      );
      if (targetId && onSetRelevant && graph) {
        // Abrimos el picker en lugar de escribir directamente. El
        // usuario elige la condición exacta (tiene valor, igual a X,
        // distinto de X, o una opción del catálogo si el source es
        // select). Antes la escribíamos `${X} != ''` sin preguntar.
        setConnectPicker({
          sourceId: edgeDraft.sourceId,
          targetId,
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

  /** Inicia el drag de una card. La toolbar siempre lo expone (no hay
   *  un toggle de "modo mover" — siempre se puede arrastrar). */
  const onCardMouseDown = (nodeId: string) => (event: React.MouseEvent) => {
    event.stopPropagation();
    const placed = layout?.nodes.find((n) => n.node.id === nodeId && n.visible);
    if (!placed) return;
    cardDragRef.current = {
      nodeId,
      cardOriginX: placed.x,
      cardOriginY: placed.y,
      cursorOriginX: event.clientX,
      cursorOriginY: event.clientY,
      moved: false,
    };
    setDraggingCardId(nodeId);
  };
  const onSvgClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest(".pulso-graph-node")) return;
    if ((event.target as Element).closest(".pulso-graph-edge")) return;
    setSelectedId(null);
    setSelectedEdgeIdx(null);
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

  /** Ajusta zoom y pan para que TODOS los bloques visibles entren en
   *  el viewport, dejando un margen de 8% alrededor. Si hay un solo
   *  nodo, lo centra al 100% de zoom. */
  const fitToScreen = () => {
    if (!layout || !svgRef.current) return;
    const visibles = layout.nodes.filter((n) => n.visible);
    if (visibles.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of visibles) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + n.width > maxX) maxX = n.x + n.width;
      if (n.y + n.height > maxY) maxY = n.y + n.height;
    }
    const bbox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    const rect = svgRef.current.getBoundingClientRect();
    const padding = 0.08; // 8% a cada lado
    const targetZoom = Math.min(
      (rect.width * (1 - padding * 2)) / bbox.w,
      (rect.height * (1 - padding * 2)) / bbox.h,
      2.5,
    );
    const z = Math.max(0.3, targetZoom);
    // Centrar: el centro del bbox * zoom debe quedar en el centro del
    // viewport. pan = viewportCenter - bboxCenter * zoom.
    const bboxCenterX = bbox.x + bbox.w / 2;
    const bboxCenterY = bbox.y + bbox.h / 2;
    const panX = rect.width / 2 - bboxCenterX * z;
    const panY = rect.height / 2 - bboxCenterY * z;
    setZoom(z);
    setPan({ x: panX, y: panY });
  };

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
            <ChevronsDown size={13} /> Expandir todo
          </button>
          <button
            type="button"
            className="pulso-graph-allbutton"
            onClick={collapseAll}
            title="Colapsar todas las secciones"
          >
            <ChevronsUp size={13} /> Colapsar todo
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
            onClick={() => fitToScreen()}
            title="Ajustar zoom para ver todos los bloques"
            aria-label="Ajustar a la pantalla"
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
        {/* Toolbar flotante estilo Obsidian Canvas: auto-layout, filtro
            de tipos de edge, snap, zoom. Vive sobre el lienzo, fija al
            top-center. Las acciones que rara vez se usan (expandir/
            colapsar todas) siguen en el header del overlay. */}
        <CanvasToolbar
          hasOverrides={nodePositions.size > 0}
          onResetLayout={() => setNodePositions(new Map())}
          edgeFilter={edgeFilter}
          onChangeEdgeFilter={setEdgeFilter}
          snapToGrid={snapToGrid}
          onToggleSnap={() => setSnapToGrid((s) => !s)}
        />

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
            {/* Edges primero para que queden detrás de los nodos.
                El filtro de la toolbar ("macro" oculta var↔var, "micro"
                oculta sec↔sec / var→sec) actúa como atenuación —
                nunca eliminamos edges del DOM para que el grafo no
                "pulse" al cambiar el filtro. */}
            {layout?.edges.map((edge, idx) => {
              const isMacroEdge =
                edge.edge.relation === "section-to-section" ||
                edge.edge.relation === "variable-to-section" ||
                edge.edge.relation === "section-to-variable";
              const passesFilter =
                edgeFilter === "all" ||
                (edgeFilter === "macro" && isMacroEdge) ||
                (edgeFilter === "micro" && !isMacroEdge);
              // Aislamiento on-click: sólo cuando el usuario clica
              // explícitamente una rama (selectedEdgeIdx) entran las
              // demás en estado "dimmed". El select de nodo dejó de
              // atenuar — abrir el detalle no debe oscurecer el lienzo.
              const isClickIsolated =
                selectedEdgeIdx !== null && selectedEdgeIdx !== idx;
              const isHL =
                selectedEdgeIdx === idx ||
                (!!selectedId &&
                  (edge.edge.source === selectedId ||
                    edge.edge.target === selectedId));
              const isHovered = hoveredEdgeIdx === idx;
              const isDM = !passesFilter || isClickIsolated;
              // El color del edge se deriva del `relevant` del target
              // — todos los edges que llegan al mismo target comparten
              // expresión y por ende color. Cuando varios edges
              // convergen al mismo nodo, sus anchors ya están
              // distribuidos en `autoLayout` (anchorOffset).
              const targetRelevant =
                graph?.byId.get(edge.edge.target)?.relevantExpression ??
                null;
              const edgeKey = `${edge.edge.source}->${edge.edge.target}`;
              return (
                <GraphEdgeArrow
                  key={`e-${idx}-${edge.edge.source}-${edge.edge.target}`}
                  edge={edge}
                  relevantExpression={targetRelevant}
                  colorIndex={edge.colorIndex}
                  highlighted={(isHL || isHovered) && passesFilter}
                  dimmed={isDM}
                  justAppeared={freshEdgeKey === edgeKey}
                  onHover={(h) => setHoveredEdgeIdx(h ? idx : null)}
                  onClick={() =>
                    setSelectedEdgeIdx((cur) => (cur === idx ? null : idx))
                  }
                />
              );
            })}

            {/* (Tooltip de hover eliminado — el detalle de la
                relación ahora se ve en el panel fijo a la derecha
                cuando se hace click en una flecha. Eso permite
                describir la condición de forma narrativa, mostrar
                source y target con sus iconos, y ofrecer botón de
                editar. El panel queda anclado al viewport — no se
                mueve con pan/zoom.) */}

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
                    beingDragged={draggingCardId === id}
                    onClick={() => {
                      // Si veníamos de un drag (moved=true), no
                      // disparamos selección — fue solo reposicionar.
                      if (cardDragRef.current?.moved) return;
                      setSelectedId(id);
                    }}
                    onToggleExpand={
                      laid.node.kind === "section"
                        ? () => toggleSection(id)
                        : undefined
                    }
                    onAnchorMouseDown={
                      onSetRelevant ? onAnchorMouseDown(id) : undefined
                    }
                    onCardMouseDown={
                      // Solo las cards top-level (depth === 0) son
                      // movibles. Las preguntas dentro de una sección
                      // expandida se posicionan automáticamente en
                      // función de la sección padre — moverlas
                      // individualmente rompería esa estructura.
                      laid.depth === 0 ? onCardMouseDown(id) : undefined
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

        {/* Picker de condición tras drag-arrow. Aparece anclado al
            cursor donde se soltó la flecha; el usuario elige operador
            (tiene valor / vacío / igual a / distinto de) y opcionalmente
            un valor; al confirmar se escribe el `relevant` y se anima
            la flecha nueva. */}
        {connectPicker && graph && onSetRelevant && (() => {
          const source = graph.byId.get(connectPicker.sourceId);
          const target = graph.byId.get(connectPicker.targetId);
          if (!source || !target) return null;
          return (
            <ConnectionConditionPicker
              source={source}
              target={target}
              screenX={connectPicker.screenX}
              screenY={connectPicker.screenY}
              sourceCatalog={source.catalogContext}
              onCancel={() => setConnectPicker(null)}
              onConfirm={(expression) => {
                // Si el target ya tiene un `relevant`, COMBINAMOS la
                // nueva condición con la existente usando `or`. Antes
                // se sobreescribía, lo cual perdía la relación previa.
                // El usuario reportó: "cuando establezco una relación
                // logica y luego otra a la misma sección, una
                // sobreescribe a la otra en vez de converger".
                //
                // Detección de duplicado: si la nueva expresión ya
                // está exactamente dentro de la existente (substring
                // tras normalizar espacios), no la duplicamos.
                const existing = target.relevantExpression?.trim() ?? "";
                const newExpr = expression.trim();
                let combined: string;
                if (!existing) {
                  combined = newExpr;
                } else {
                  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
                  const existingNorm = norm(existing);
                  const newNorm = norm(newExpr);
                  // Si la nueva ya aparece literal en la existente,
                  // no añadir nada (idempotente).
                  if (
                    existingNorm === newNorm ||
                    existingNorm
                      .split(/\s+\bor\b\s+/)
                      .some((part) => norm(part) === newNorm)
                  ) {
                    combined = existing;
                  } else {
                    combined = `${existing} or ${newExpr}`;
                  }
                }
                onSetRelevant(target.rowIndex, combined);
                setFreshEdgeKey(`${source.id}->${target.id}`);
                setConnectPicker(null);
                // Limpiamos la marca "fresh" cuando termina la
                // animación CSS (~600ms). Después el edge vuelve al
                // render normal del color por condición.
                setTimeout(() => setFreshEdgeKey(null), 700);
              }}
            />
          );
        })()}

        {/* Leyenda flotante COLAPSABLE — arranca cerrada (solo el botón
            "?") para no contaminar el lienzo. Al abrir, muestra dos
            secciones:
              · Tipos de relación (color = condición distinta + estilo
                de línea distingue var↔var de sec↔var).
              · Cómo leer las flechas (3 bullets explicativos). */}
        {layout && layout.edges.length > 0 && (
          <aside
            className={`pulso-graph-legend ${legendOpen ? "is-open" : "is-collapsed"}`}
            aria-label="Leyenda de conexiones"
          >
            <button
              type="button"
              className="pulso-graph-legend-toggle"
              onClick={() => setLegendOpen((v) => !v)}
              aria-expanded={legendOpen}
              title={legendOpen ? "Colapsar leyenda" : "Cómo leer el mapa"}
            >
              {legendOpen ? "×" : "?"}
            </button>
            {legendOpen && (
              <div className="pulso-graph-legend-body">
                {/* === Cabecera con título y subtítulo === */}
                <div className="pulso-graph-legend-head">
                  <strong>Cómo se lee el mapa</strong>
                  <p>
                    Las flechas conectan condiciones (<em>relevant</em>)
                    con sus destinos. Mismo <strong>color</strong> = misma
                    condición lógica.
                  </p>
                </div>

                {/* === Bloque 1: relaciones que abren/cierran SECCIONES === */}
                <div className="pulso-graph-legend-section">
                  <div className="pulso-graph-legend-section-head">
                    <span
                      className="pulso-graph-legend-icon-box"
                      style={{
                        background: "rgba(15, 118, 110, 0.10)",
                        color: "#0f766e",
                      }}
                    >
                      <Folder size={14} strokeWidth={2.2} />
                    </span>
                    <div>
                      <strong>Habilita una sección</strong>
                      <span>Una pregunta o sección abre/oculta un grupo entero</span>
                    </div>
                  </div>
                  <ul className="pulso-graph-legend-examples">
                    <li>
                      <svg width={48} height={20} aria-hidden="true">
                        <path
                          d="M 2 16 L 12 16 L 12 6 L 38 6 L 38 14"
                          fill="none"
                          stroke="#4E79A7"
                          strokeWidth={1.9}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          markerEnd="url(#pulso-graph-arrow-c-4e79a7)"
                        />
                      </svg>
                      <span>
                        Entra por <strong>arriba</strong> al header de la
                        sección
                      </span>
                    </li>
                    <li>
                      <svg width={48} height={20} aria-hidden="true">
                        <path
                          d="M 2 4 L 12 4 L 12 14 L 38 14 L 38 6"
                          fill="none"
                          stroke="#B07AA1"
                          strokeWidth={1.9}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          markerEnd="url(#pulso-graph-arrow-c-b07aa1)"
                        />
                      </svg>
                      <span>
                        Si el <em>top lane</em> está saturado, entra por
                        <strong> abajo</strong>
                      </span>
                    </li>
                    <li>
                      <svg width={48} height={20} aria-hidden="true">
                        <path
                          d="M 2 4 L 24 4 L 24 14 M 24 4 L 38 4 L 38 14"
                          fill="none"
                          stroke="#F28E2B"
                          strokeWidth={1.9}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span>
                        Una sola condición puede <strong>ramificar</strong>
                        a varias secciones
                      </span>
                    </li>
                  </ul>
                </div>

                {/* === Bloque 2: relaciones entre PREGUNTAS === */}
                <div className="pulso-graph-legend-section">
                  <div className="pulso-graph-legend-section-head">
                    <span
                      className="pulso-graph-legend-icon-box"
                      style={{
                        background: "rgba(36, 87, 214, 0.10)",
                        color: "var(--pulso-primary)",
                      }}
                    >
                      <CircleDot size={14} strokeWidth={2.2} />
                    </span>
                    <div>
                      <strong>Habilita una pregunta</strong>
                      <span>El valor de una pregunta abre/oculta otra individualmente</span>
                    </div>
                  </div>
                  <ul className="pulso-graph-legend-examples">
                    <li>
                      <svg width={48} height={20} aria-hidden="true">
                        <path
                          d="M 2 10 L 18 10 L 18 6 L 38 6"
                          fill="none"
                          stroke="#59A14F"
                          strokeWidth={1.7}
                          strokeDasharray="5 4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          markerEnd="url(#pulso-graph-arrow-c-59a14f)"
                        />
                      </svg>
                      <span>
                        Pregunta <strong>condiciona</strong> a otra (línea
                        punteada)
                      </span>
                    </li>
                    <li>
                      <svg width={48} height={20} aria-hidden="true">
                        <path
                          d="M 2 4 L 38 4 L 38 16"
                          fill="none"
                          stroke="#E15759"
                          strokeWidth={1.7}
                          strokeDasharray="5 4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          markerEnd="url(#pulso-graph-arrow-c-e15759)"
                        />
                      </svg>
                      <span>
                        Misma columna → carril <strong>lateral tight</strong>
                      </span>
                    </li>
                    <li>
                      <svg width={48} height={20} aria-hidden="true">
                        <path
                          d="M 2 10 L 24 10 L 24 6 L 38 6"
                          fill="none"
                          stroke="#76B7B2"
                          strokeWidth={1.7}
                          strokeDasharray="5 4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          markerEnd="url(#pulso-graph-arrow-c-76b7b2)"
                        />
                      </svg>
                      <span>
                        Columnas vecinas → <strong>paso directo</strong> en
                        el espacio entre cards
                      </span>
                    </li>
                  </ul>
                </div>

                {/* === Bloque 3: tips de interacción === */}
                <div className="pulso-graph-legend-section">
                  <div className="pulso-graph-legend-section-head">
                    <span
                      className="pulso-graph-legend-icon-box"
                      style={{
                        background: "var(--pulso-surface-2)",
                        color: "var(--pulso-text-soft)",
                      }}
                    >
                      <Info size={14} strokeWidth={2.2} />
                    </span>
                    <div>
                      <strong>Cómo interactuar</strong>
                      <span>Atajos para explorar el mapa</span>
                    </div>
                  </div>
                  <ul className="pulso-graph-legend-tips">
                    <li>
                      <kbd>Click</kbd> en una flecha → abre el panel con la
                      condición narrada y opción de editar.
                    </li>
                    <li>
                      <kbd>Click</kbd> en una card → abre el detalle del
                      nodo con sus dependencias.
                    </li>
                    <li>
                      <kbd>Drag</kbd> el círculo de la derecha → crea una
                      nueva relación.
                    </li>
                    <li>
                      <kbd>Two-finger drag</kbd> → desplazar el lienzo.
                      <kbd>Pinch</kbd> → zoom.
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </aside>
        )}

        {selectedNode && (() => {
          // Listas de "alimentadores" (lo que condiciona a este nodo)
          // y "consumidores" (a quién afecta este nodo). Se calculan a
          // partir de los edges del grafo. Click en una fila navega al
          // nodo correspondiente.
          const incoming = (graph?.edges ?? []).filter(
            (e) => e.target === selectedNode.id,
          );
          const outgoing = (graph?.edges ?? []).filter(
            (e) => e.source === selectedNode.id,
          );
          return (
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
                {selectedNode.kind === "section" ? "Sección" : "Pregunta"}
                {" · "}
                <code>{selectedNode.name}</code>
              </p>
              {selectedNode.kind === "question" &&
                selectedNode.catalogContext && (
                  <p>
                    Catálogo:{" "}
                    <code>{selectedNode.catalogContext.listName}</code>
                    {" · "}
                    {selectedNode.catalogContext.itemCount}{" "}
                    {selectedNode.catalogContext.itemCount === 1
                      ? "opción"
                      : "opciones"}
                  </p>
                )}

              {/* Si este nodo tiene un relevant, mostramos la
                  expresión humanizada estilo `SeccionesPanel`. */}
              {selectedNode.relevantExpression && (
                <div className="pulso-graph-detail-block">
                  <span className="pulso-graph-detail-block-label">
                    Aparece si
                  </span>
                  <code className="pulso-graph-detail-block-code">
                    {humanizeRelevant(selectedNode.relevantExpression)}
                  </code>
                </div>
              )}

              {/* Visibilidad HEREDADA de secciones ancestro. Lista la
                  cadena de condiciones implícitas que afectan a este
                  nodo aunque él no tenga `relevant` propio. Click en
                  una sección padre navega a ella. */}
              {selectedNode.inheritedRelevant.length > 0 && (
                <div className="pulso-graph-detail-block">
                  <span className="pulso-graph-detail-block-label">
                    {selectedNode.relevantExpression
                      ? "También hereda de"
                      : "Hereda visibilidad de"}
                  </span>
                  <ul className="pulso-graph-detail-list">
                    {selectedNode.inheritedRelevant.map((parent, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          className="pulso-graph-detail-link"
                          onClick={() => setSelectedId(parent.fromSectionId)}
                          title={`Ver sección ${parent.fromSectionLabel}`}
                        >
                          <code>{parent.fromSectionName}</code>
                          <span>
                            si{" "}
                            <em
                              style={{
                                fontStyle: "normal",
                                fontFamily: "ui-monospace, monospace",
                              }}
                            >
                              {humanizeRelevant(parent.expression)}
                            </em>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* "Depende de": los nodos cuyo valor decide la
                  visibilidad de este. */}
              {incoming.length > 0 && (
                <div className="pulso-graph-detail-block">
                  <span className="pulso-graph-detail-block-label">
                    Depende de
                  </span>
                  <ul className="pulso-graph-detail-list">
                    {incoming.map((e, i) => {
                      const src = graph?.byId.get(e.source);
                      if (!src) return null;
                      return (
                        <li key={i}>
                          <button
                            type="button"
                            className="pulso-graph-detail-link"
                            onClick={() => setSelectedId(src.id)}
                            title={src.title || src.name}
                          >
                            <code>{src.name}</code>
                            {src.title && src.title !== src.name && (
                              <span>· {src.title}</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* "Condiciona a": nodos cuyo relevant referencia a este. */}
              {outgoing.length > 0 && (
                <div className="pulso-graph-detail-block">
                  <span className="pulso-graph-detail-block-label">
                    Condiciona a
                  </span>
                  <ul className="pulso-graph-detail-list">
                    {outgoing.map((e, i) => {
                      const tgt = graph?.byId.get(e.target);
                      if (!tgt) return null;
                      return (
                        <li key={i}>
                          <button
                            type="button"
                            className="pulso-graph-detail-link"
                            onClick={() => setSelectedId(tgt.id)}
                            title={tgt.title || tgt.name}
                          >
                            <code>{tgt.name}</code>
                            {tgt.title && tgt.title !== tgt.name && (
                              <span>· {tgt.title}</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
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
          );
        })()}

        {/* Panel de RELACIÓN (edge) — aparece al hacer click en una
            flecha. Vive como DOM fijo en el viewport, no se mueve con
            pan/zoom del canvas. Muestra la condición narrada en
            español, source y target con iconos, y botón para editar
            (re-abre `ConnectionConditionPicker` sobre el target). */}
        {selectedEdgeIdx !== null && layout && graph && (() => {
          const edge = layout.edges[selectedEdgeIdx];
          if (!edge) return null;
          const src = graph.byId.get(edge.edge.source);
          const tgt = graph.byId.get(edge.edge.target);
          if (!src || !tgt) return null;
          const expr = tgt.relevantExpression ?? "";
          const human = humanizeRelevant(expr);
          const verb =
            tgt.kind === "section"
              ? "abre la sección"
              : "muestra la pregunta";
          return (
            <aside className="pulso-graph-edge-panel">
              <header>
                <span className="pulso-graph-edge-panel-eyebrow">
                  Relación lógica
                </span>
                <button
                  type="button"
                  className="pulso-icon"
                  onClick={() => setSelectedEdgeIdx(null)}
                  title="Cerrar"
                  aria-label="Cerrar"
                >
                  <X size={12} />
                </button>
              </header>

              {/* Visualización de la flecha: source → target con sus
                  iconos y nombres, conectados por una flecha
                  horizontal. */}
              <div className="pulso-graph-edge-panel-flow">
                <div
                  className={`pulso-graph-edge-panel-card pulso-graph-edge-panel-card-${src.kind}`}
                >
                  <span className="pulso-graph-edge-panel-card-icon">
                    {src.kind === "section" ? (
                      <Folder size={14} />
                    ) : (
                      <CircleDot size={14} />
                    )}
                  </span>
                  <div className="pulso-graph-edge-panel-card-text">
                    <strong>{src.title || src.name}</strong>
                    <code>{src.name}</code>
                  </div>
                </div>
                <div className="pulso-graph-edge-panel-arrow">
                  <svg width={36} height={12} aria-hidden="true">
                    <line
                      x1={0}
                      y1={6}
                      x2={28}
                      y2={6}
                      stroke="var(--pulso-primary)"
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                    <path
                      d="M 28 2 L 36 6 L 28 10 Z"
                      fill="var(--pulso-primary)"
                    />
                  </svg>
                </div>
                <div
                  className={`pulso-graph-edge-panel-card pulso-graph-edge-panel-card-${tgt.kind}`}
                >
                  <span className="pulso-graph-edge-panel-card-icon">
                    {tgt.kind === "section" ? (
                      <Folder size={14} />
                    ) : (
                      <CircleDot size={14} />
                    )}
                  </span>
                  <div className="pulso-graph-edge-panel-card-text">
                    <strong>{tgt.title || tgt.name}</strong>
                    <code>{tgt.name}</code>
                  </div>
                </div>
              </div>

              {/* Narrativa en lenguaje humano. */}
              <div className="pulso-graph-edge-panel-narrative">
                <p>
                  Cuando se cumple la condición{" "}
                  <code className="pulso-graph-edge-panel-cond">{human}</code>
                  {", "}
                  <strong>{verb}</strong>{" "}
                  <code>{tgt.name}</code>.
                </p>
              </div>

              {/* Acciones */}
              <div className="pulso-graph-edge-panel-actions">
                {onSetRelevant && (
                  <button
                    type="button"
                    className="pulso-graph-edge-panel-btn"
                    onClick={() => {
                      // Reabre el picker sobre el target. La nueva
                      // condición sobreescribirá la actual.
                      const rect =
                        svgRef.current?.getBoundingClientRect();
                      setConnectPicker({
                        sourceId: src.id,
                        targetId: tgt.id,
                        screenX: (rect?.left ?? 0) + (rect?.width ?? 600) / 2,
                        screenY: (rect?.top ?? 0) + 100,
                      });
                      setSelectedEdgeIdx(null);
                    }}
                  >
                    <Pencil size={12} /> Editar condición
                  </button>
                )}
                {onSelectRow && (
                  <button
                    type="button"
                    className="pulso-graph-edge-panel-btn pulso-graph-edge-panel-btn-secondary"
                    onClick={() => {
                      onSelectRow(tgt.rowIndex);
                      onClose();
                    }}
                  >
                    <Edit3 size={12} /> Ir al destino
                  </button>
                )}
              </div>
            </aside>
          );
        })()}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers locales — humanización de expresiones + geometría de edges
// ─────────────────────────────────────────────────────────────────────

/**
 * Convierte una expresión `relevant` cruda en texto legible en
 * español. Antes era una limpieza mínima (sólo sacaba `${...}`) y
 * dejaba la sintaxis ODK; el resultado era cosas tipo
 * `selected(apoderado, '2') and edad != ''` que confundían al usuario.
 *
 * Reglas de traducción:
 *   · `selected(${X}, 'v')`        →  `X contiene 'v'`
 *   · `not(selected(${X}, 'v'))`   →  `X no contiene 'v'`
 *   · `${X} != ''`                 →  `X tiene valor`
 *   · `${X} = ''`                  →  `X está vacío`
 *   · `${X} != Y`                  →  `X ≠ Y`
 *   · `${X} = Y`                   →  `X = Y`
 *   · `and` / `or` / `not(...)`    →  `y` / `o` / `no(...)`
 *
 * Se aplican en orden cuidadoso para no pisarse (selected primero,
 * luego operadores, luego ${}). El resultado preserva los valores
 * literales (números, strings entre comillas) tal cual.
 */
function humanizeRelevant(expr: string): string {
  let r = expr;
  // selected(${X}, 'v') → X contiene 'v'  (variantes con comillas
  // simples o dobles).
  r = r.replace(
    /selected\(\s*\$\{([^}]+)\}\s*,\s*'([^']*)'\s*\)/g,
    "$1 contiene '$2'",
  );
  r = r.replace(
    /selected\(\s*\$\{([^}]+)\}\s*,\s*"([^"]*)"\s*\)/g,
    '$1 contiene "$2"',
  );
  // not( ... contiene ... ) → ... no contiene ...
  r = r.replace(
    /\bnot\s*\(\s*([a-zA-Z_][\w]*)\s+contiene\s+('[^']*'|"[^"]*")\s*\)/g,
    "$1 no contiene $2",
  );
  // ${X} != '' / = '' (PRIMERO, antes de los != / = generales).
  r = r.replace(/\$\{([^}]+)\}\s*!=\s*''/g, "$1 tiene valor");
  r = r.replace(/\$\{([^}]+)\}\s*=\s*''/g, "$1 está vacío");
  // ${X} → X (después de los casos anteriores).
  r = r.replace(/\$\{([^}]+)\}/g, "$1");
  // Operadores comunes con espacios alrededor.
  r = r.replace(/\s*!=\s*/g, " ≠ ");
  r = r.replace(/\s*>=\s*/g, " ≥ ");
  r = r.replace(/\s*<=\s*/g, " ≤ ");
  // and / or como palabras enteras.
  r = r.replace(/\s+\band\b\s+/g, " y ");
  r = r.replace(/\s+\bor\b\s+/g, " o ");
  // not(...) genérico que no haya quedado capturado arriba.
  r = r.replace(/\bnot\s*\(/g, "no(");
  // Compactar espacios.
  r = r.replace(/\s+/g, " ").trim();
  return r;
}
