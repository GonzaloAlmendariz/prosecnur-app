// =============================================================================
// canvas-graph/LogicCanvas.tsx — overlay del mapa de lógica
// =============================================================================
// Vista jerárquica del workbook (post-rediseño): cada sección es una card
// colapsable; las preguntas internas solo se ven si la sección está
// expandida. Las flechas conectan únicamente preguntas/secciones unidas
// por relevant/constraint/calculation/choice_filter — el catálogo de
// opciones se muestra inline dentro de las preguntas select y los demás
// campos lógicos viven también en el inspector.
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

  // ── Toolbar: snap + undo de drags + filtro por tipo de dependencia ──
  const [snapToGrid, setSnapToGrid] = useState(false);
  const SNAP_GRID = 16;
  /** Filtro por tipo de edge. Por defecto mostramos toda la lógica que
   *  exista en el formulario; el usuario puede apagar capas si necesita
   *  concentrarse en un solo tipo de relación. */
  const [edgeKindFilter, setEdgeKindFilter] = useState({
    showRelevant: true,
    showConstraint: true,
    showCalculation: true,
    showChoiceFilter: true,
  });
  /** Historia de cambios de `nodePositions` para Cmd/Ctrl+Z. Cada
   *  entrada es un snapshot inmutable del map de posiciones tomado
   *  ANTES del cambio. Se pushea al inicio de cada drag y al hacer
   *  reset; se popea con undo. */
  const [positionHistory, setPositionHistory] = useState<
    Array<Map<string, { x: number; y: number }>>
  >([]);
  const undoLastDrag = () => {
    setPositionHistory((hist) => {
      if (hist.length === 0) return hist;
      const prev = hist[hist.length - 1]!;
      setNodePositions(prev);
      return hist.slice(0, -1);
    });
  };

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

  /** Toasts efímeros para confirmar acciones (crear conexión, editar
   *  condición, etc.). Cada toast se auto-elimina a los ~2.4 s. */
  const [toasts, setToasts] = useState<
    Array<{ id: number; kind: "success" | "info"; text: string }>
  >([]);
  const toastIdRef = useRef(0);
  const pushToast = (text: string, kind: "success" | "info" = "success") => {
    const id = ++toastIdRef.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 2400);
  };

  /** Flag temporal: cuando el usuario dispara reset, fit-to-screen, o
   *  un atajo de zoom (no el wheel/pinch continuo), aplicamos una
   *  transición CSS al `transform` del SVG group para que la cámara
   *  haga "ease" al nuevo estado. Se desactiva tras 320ms para que
   *  los gestos continuos sigan respondiendo instantáneamente. */
  const [smoothCamera, setSmoothCamera] = useState(false);
  const triggerSmooth = () => {
    setSmoothCamera(true);
    setTimeout(() => setSmoothCamera(false), 360);
  };

  // Atajos de teclado globales del canvas.
  // Esc → cierra panel/picker abierto; segundo Esc cierra canvas.
  // F   → fit-to-screen.
  // +/= → zoom in.
  // -   → zoom out.
  // 0   → reset zoom 100%.
  // ?   → toggle legenda.
  // E   → expandir todo.
  // C   → colapsar todo.
  // Inputs/textareas no disparan los atajos (se hace skip si focus
  // está en un campo editable).
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      const isEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (event.target as HTMLElement | null)?.isContentEditable;
      if (isEditable && event.key !== "Escape") return;
      // Cmd/Ctrl+Z deshace el último drag de card.
      if ((event.metaKey || event.ctrlKey) && event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        undoLastDrag();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        case "Escape":
          // Prioridad: cerrar el panel/picker abierto antes que el canvas.
          if (connectPicker) {
            setConnectPicker(null);
          } else if (selectedEdgeIdx !== null) {
            setSelectedEdgeIdx(null);
          } else if (selectedId) {
            setSelectedId(null);
          } else if (legendOpen) {
            setLegendOpen(false);
          } else {
            onClose();
          }
          event.preventDefault();
          break;
        case "f":
        case "F":
          triggerSmooth();
          fitToScreen();
          event.preventDefault();
          break;
        case "+":
        case "=":
          triggerSmooth();
          setZoom((z) => Math.min(2.5, z + 0.15));
          event.preventDefault();
          break;
        case "-":
        case "_":
          triggerSmooth();
          setZoom((z) => Math.max(0.3, z - 0.15));
          event.preventDefault();
          break;
        case "0":
          triggerSmooth();
          setZoom(1);
          setPan({ x: 0, y: 0 });
          event.preventDefault();
          break;
        case "?":
          setLegendOpen((v) => !v);
          event.preventDefault();
          break;
        case "e":
        case "E":
          expandAll();
          event.preventDefault();
          break;
        case "c":
        case "C":
          collapseAll();
          event.preventDefault();
          break;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, connectPicker, selectedEdgeIdx, selectedId, legendOpen]);

  // Reset al abrir.
  useEffect(() => {
    if (open) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setSelectedId(null);
      setExpandedSections(new Set());
      setNodePositions(new Map());
      setSnapToGrid(false);
      setPositionHistory([]);
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

  /** Lookup para resolver `${X} = 'code'` → `'label legible'` usando
   *  el catálogo de la pregunta X. Memo para no recalcular en cada
   *  render. */
  const labelLookup = useMemo<LabelLookup>(() => {
    if (!structure) return () => null;
    return (varName: string, code: string) => {
      // Encuentra la pregunta por name.
      let listName: string | null = null;
      for (const node of structure.byRow.values()) {
        if (node.name === varName) {
          listName = node.typeInfo?.listName ?? null;
          break;
        }
      }
      if (!listName) return null;
      const catalog = catalogs.find((c) => c.listName === listName);
      if (!catalog) return null;
      const item = catalog.items.find((it) => it.name === code);
      return item?.label ?? null;
    };
  }, [structure, catalogs]);

  /** Lookup para resolver el `name` interno de una variable (`q0027`)
   *  a su prompt humano (`¿Qué actividades laborales realiza?...`).
   *  En la narrativa de relación lógica mostramos `prompt (name)` para
   *  que el usuario reconozca la pregunta sin perder la referencia
   *  técnica del XLSForm. */
  const varTitleLookup = useMemo<VarTitleLookup>(() => {
    if (!structure) return () => null;
    const map = new Map<string, string>();
    for (const node of structure.byRow.values()) {
      if (!node.name) continue;
      const title = node.label?.trim();
      if (title) map.set(node.name, title);
    }
    return (varName: string) => map.get(varName) ?? null;
  }, [structure]);

  /** Atajo para humanizar con labels resueltos. */
  const humanize = (expr: string): string =>
    humanizeRelevantWithLabels(expr, labelLookup, varTitleLookup);
  const nodeDisplayName = (node: GraphNode): string => {
    const title = (node.title || "").trim();
    if (!title || title === node.name) return node.name;
    return `${title} (${node.name})`;
  };
  const nodeKindLabel = (node: GraphNode): string =>
    node.kind === "section" ? "Sección" : "Pregunta";

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
      // Si NO movió, popeamos el snapshot que pusheamos en mouseDown
      // (ese snapshot no aporta nada — no hay cambio que deshacer).
      if (!cardDragRef.current.moved) {
        setPositionHistory((h) => h.slice(0, -1));
      }
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
    // Snapshot de posiciones ANTES del drag — para Cmd+Z. Si el
    // usuario realmente mueve la card (dx+dy > 3 px), esta entrada
    // se conserva en el history. Si solo es un click, no la conservamos
    // porque no hay "deshacer" relevante.
    setPositionHistory((h) => [...h, new Map(nodePositions)]);
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
      aria-label="Mapa de lógica del formulario"
    >
      <header className="pulso-graph-header">
        <div className="pulso-graph-header-left">
          <button type="button" className="pulso-graph-back" onClick={onClose}>
            <ChevronLeft size={14} /> Volver al editor
          </button>
          <div className="pulso-graph-header-title">
            <strong>Mapa de lógica</strong>
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
            title="Expandir todas las secciones (E)"
          >
            <ChevronsDown size={13} /> Expandir todo
          </button>
          <button
            type="button"
            className="pulso-graph-allbutton"
            onClick={collapseAll}
            title="Colapsar todas las secciones (C)"
          >
            <ChevronsUp size={13} /> Colapsar todo
          </button>
          <span className="pulso-graph-sep" aria-hidden="true" />
          <button
            type="button"
            className="pulso-icon"
            onClick={() => {
              triggerSmooth();
              setZoom((z) => Math.max(0.3, z - 0.15));
            }}
            title="Alejar (-)"
            aria-label="Alejar"
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            className="pulso-icon"
            onClick={() => {
              triggerSmooth();
              setZoom((z) => Math.min(2.5, z + 0.15));
            }}
            title="Acercar (+)"
            aria-label="Acercar"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            className="pulso-icon"
            onClick={() => {
              triggerSmooth();
              fitToScreen();
            }}
            title="Ajustar zoom para ver todos los bloques (F)"
            aria-label="Ajustar a la pantalla"
          >
            <Maximize2 size={14} />
          </button>
          <button
            type="button"
            className={`pulso-icon ${legendOpen ? "is-on" : ""}`}
            onClick={() => setLegendOpen((v) => !v)}
            title="Cómo leer el mapa (?)"
            aria-label="Cómo leer el mapa"
          >
            <Info size={14} />
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

      <div className={`pulso-graph-body ${selectedEdgeIdx !== null ? "has-edge-panel" : ""}`}>
        {/* Toolbar flotante estilo Obsidian Canvas: auto-layout, filtro
            de tipos de edge, snap, zoom. Vive sobre el lienzo, fija al
            top-center. Las acciones que rara vez se usan (expandir/
            colapsar todas) siguen en el header del overlay. */}
        <CanvasToolbar
          hasOverrides={nodePositions.size > 0}
          onResetLayout={() => {
            setPositionHistory((h) => [...h, nodePositions]);
            setNodePositions(new Map());
          }}
          snapToGrid={snapToGrid}
          onToggleSnap={() => setSnapToGrid((s) => !s)}
          canUndoDrag={positionHistory.length > 0}
          onUndoDrag={undoLastDrag}
          edgeKindFilter={edgeKindFilter}
          onChangeEdgeKindFilter={setEdgeKindFilter}
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
            style={{
              transformOrigin: "0 0",
              transition: smoothCamera
                ? "transform 320ms cubic-bezier(0.18, 0.89, 0.32, 1.18)"
                : "none",
            }}
          >
            {/* Edges primero para que queden detrás de los nodos.
                El filtro de la toolbar ("macro" oculta var↔var, "micro"
                oculta sec↔sec / var→sec) actúa como atenuación —
                nunca eliminamos edges del DOM para que el grafo no
                "pulse" al cambiar el filtro. */}
            {/* Bundle-aware selection: cuando hay un edge seleccionado,
                identificamos su `unitKey` y consideramos seleccionados
                a TODOS los edges con ese mismo unitKey (representan la
                misma condición lógica que se desbranda a varios
                targets — son una sola flecha conceptual). Click en
                cualquiera de las ramas resalta el bundle entero. */}
            {(() => null)()}
            {layout?.edges.map((edge, idx) => {
              const selectedUnitKey =
                selectedEdgeIdx !== null
                  ? layout.edges[selectedEdgeIdx]?.unitKey ?? null
                  : null;
              // Aislamiento on-click: cuando el usuario selecciona una
              // rama, dim a TODO lo que NO es del mismo bundle. Edges
              // del mismo bundle (mismo unitKey) se quedan brillando
              // juntos.
              const inSelectedBundle =
                selectedUnitKey !== null && edge.unitKey === selectedUnitKey;
              const isClickIsolated =
                selectedUnitKey !== null && !inSelectedBundle;
              // Filtro por TIPO de dependencia — usuario decide qué
              // tipos visualizar (relevant/constraint/calculation/
              // choice_filter). Por defecto todo queda visible.
              const k = edge.edge.kind;
              const passesFilter =
                (k === "depends-on" && edgeKindFilter.showRelevant) ||
                (k === "constrained-by" && edgeKindFilter.showConstraint) ||
                (k === "calculated-from" && edgeKindFilter.showCalculation) ||
                (k === "choice-filter" && edgeKindFilter.showChoiceFilter);
              const isHL =
                inSelectedBundle ||
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
                  appearanceIndex={idx}
                  isSelected={inSelectedBundle}
                  onHover={(h) => setHoveredEdgeIdx(h ? idx : null)}
                  onClick={() => {
                    setSelectedEdgeIdx((cur) => {
                      if (cur === null) return idx;
                      // Si ya hay una rama del mismo bundle
                      // seleccionada, des-seleccionar; si es de otro
                      // bundle, cambiar a éste.
                      const curUnit = layout?.edges[cur]?.unitKey;
                      if (curUnit && curUnit === edge.unitKey) return null;
                      return idx;
                    });
                  }}
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

            {/* Ghost edge mientras se arrastra. Bezier suave con
                color primary y un círculo "snap" al cursor que indica
                "puedes soltar acá". Si edgeHoverTargetId está set, el
                ghost cambia a verde para confirmar el destino. */}
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
              const onValidTarget = !!edgeHoverTargetId;
              const ghostColor = onValidTarget
                ? "#16a34a"
                : "var(--pulso-primary)";
              return (
                <g pointerEvents="none" className="pulso-graph-ghost-edge">
                  <path
                    d={path}
                    fill="none"
                    stroke={ghostColor}
                    strokeWidth={2.4}
                    strokeDasharray="6 5"
                    strokeLinecap="round"
                    opacity={0.85}
                  />
                  {/* Círculo en el cursor — pulsea para indicar
                      "soltar aquí". */}
                  <circle
                    cx={tx}
                    cy={ty}
                    r={onValidTarget ? 8 : 5}
                    fill={ghostColor}
                    fillOpacity={0.18}
                    stroke={ghostColor}
                    strokeWidth={1.5}
                  />
                  <circle cx={tx} cy={ty} r={2.5} fill={ghostColor} />
                </g>
              );
            })()}

          </g>
        </svg>

        {/* Loading state — mientras se computa el grafo o el layout. */}
        {(!graph || !layout) && open && (
          <div className="pulso-graph-loading" aria-live="polite">
            <div className="pulso-graph-loading-spinner" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 32 32">
                <circle
                  cx="16"
                  cy="16"
                  r="12"
                  fill="none"
                  stroke="rgba(36, 87, 214, 0.15)"
                  strokeWidth="3"
                />
                <circle
                  cx="16"
                  cy="16"
                  r="12"
                  fill="none"
                  stroke="var(--pulso-primary)"
                  strokeWidth="3"
                  strokeDasharray="60 90"
                  strokeLinecap="round"
                  transform="rotate(-90 16 16)"
                >
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="-90 16 16"
                    to="270 16 16"
                    dur="1s"
                    repeatCount="indefinite"
                  />
                </circle>
              </svg>
            </div>
            <span>Calculando el mapa…</span>
          </div>
        )}

        {layout && layout.nodes.length === 0 && (
          <div className="pulso-graph-empty">
            <div className="pulso-graph-empty-icon" aria-hidden="true">
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <circle
                  cx="14"
                  cy="14"
                  r="6"
                  fill="rgba(36, 87, 214, 0.15)"
                  stroke="var(--pulso-primary)"
                  strokeWidth="1.5"
                />
                <circle
                  cx="42"
                  cy="42"
                  r="6"
                  fill="rgba(15, 118, 110, 0.15)"
                  stroke="#0f766e"
                  strokeWidth="1.5"
                />
                <path
                  d="M 18 18 L 28 28 L 28 36 L 38 38"
                  fill="none"
                  stroke="var(--pulso-text-soft)"
                  strokeWidth="1.6"
                  strokeDasharray="4 3"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <strong>Todavía no hay nada que mapear.</strong>
            <p>
              Agrega preguntas o secciones y, cuando alguna use otra para
              mostrarse, validar, calcular o filtrar opciones, la conexión
              aparecerá automáticamente acá. También puedes
              <strong> arrastrar el círculo</strong> que aparece a la derecha
              de cada card para crear una conexión nueva.
            </p>
          </div>
        )}

        {/* Empty state alternativo: hay nodos pero no edges */}
        {layout &&
          layout.nodes.length > 0 &&
          layout.edges.length === 0 && (
            <div className="pulso-graph-empty pulso-graph-empty-no-edges">
              <p>
                Este formulario aún no tiene relaciones lógicas dibujadas.
                Arrastra desde el círculo a la derecha de una card para crear
                la primera conexión.
              </p>
            </div>
          )}

        {/* Deck de toasts efímeros — top-right del overlay, fuera del
            SVG y de los paneles de detalle. Cada toast vive ~2.4s. */}
        {toasts.length > 0 && (
          <div className="pulso-graph-toasts" aria-live="polite">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`pulso-graph-toast pulso-graph-toast-${t.kind}`}
                role="status"
              >
                {t.text}
              </div>
            ))}
          </div>
        )}

        {/* Indicador de zoom flotante (bottom-left). Click para reset
            a 100%. Doble-click → fit-to-screen. */}
        <div
          className="pulso-graph-zoom-indicator"
          title="Click: 100%  ·  Dble-click: ajustar a pantalla"
          onClick={() => {
            triggerSmooth();
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          onDoubleClick={() => {
            triggerSmooth();
            fitToScreen();
          }}
        >
          {Math.round(zoom * 100)}%
        </div>

        {/* Mini-map (bottom-right). Solo se muestra si hay 4+ secciones
            visibles — para formularios chicos no aporta. Renderiza
            cada nodo visible como un rectángulo escalado y un
            rectángulo del viewport actual. Click navega ahí. */}
        {layout && layout.nodes.filter((n) => n.visible).length >= 4 && (() => {
          const visibles = layout.nodes.filter((n) => n.visible);
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const n of visibles) {
            if (n.x < minX) minX = n.x;
            if (n.y < minY) minY = n.y;
            if (n.x + n.width > maxX) maxX = n.x + n.width;
            if (n.y + n.height > maxY) maxY = n.y + n.height;
          }
          const bbW = maxX - minX;
          const bbH = maxY - minY;
          const MAP_W = 200;
          const MAP_H = 130;
          const padding = 6;
          const usableW = MAP_W - padding * 2;
          const usableH = MAP_H - padding * 2;
          const scale = Math.min(usableW / bbW, usableH / bbH);
          const offsetX = padding + (usableW - bbW * scale) / 2;
          const offsetY = padding + (usableH - bbH * scale) / 2;
          // Viewport rect en coords del mini-map.
          const rect = svgRef.current?.getBoundingClientRect();
          const vpX = rect ? -pan.x / zoom : 0;
          const vpY = rect ? -pan.y / zoom : 0;
          const vpW = rect ? rect.width / zoom : 0;
          const vpH = rect ? rect.height / zoom : 0;
          const onMiniClick = (event: React.MouseEvent<SVGSVGElement>) => {
            const target = event.currentTarget.getBoundingClientRect();
            const cx = event.clientX - target.left;
            const cy = event.clientY - target.top;
            // Convertir click del mini-map a coordenadas del canvas.
            const canvasX = (cx - offsetX) / scale + minX;
            const canvasY = (cy - offsetY) / scale + minY;
            if (!rect) return;
            // Centrar en (canvasX, canvasY).
            setPan({
              x: rect.width / 2 - canvasX * zoom,
              y: rect.height / 2 - canvasY * zoom,
            });
          };
          return (
            <div className="pulso-graph-minimap">
              <svg
                width={MAP_W}
                height={MAP_H}
                onClick={onMiniClick}
                aria-label="Mini-mapa del lienzo"
              >
                {/* Cards visibles */}
                {visibles.map((n) => {
                  const isSection = n.node.kind === "section";
                  return (
                    <rect
                      key={n.node.id}
                      x={offsetX + (n.x - minX) * scale}
                      y={offsetY + (n.y - minY) * scale}
                      width={n.width * scale}
                      height={n.height * scale}
                      rx={1.5}
                      ry={1.5}
                      fill={
                        isSection
                          ? "rgba(15, 118, 110, 0.18)"
                          : "rgba(36, 87, 214, 0.10)"
                      }
                      stroke={
                        isSection
                          ? "rgba(15, 118, 110, 0.55)"
                          : "rgba(36, 87, 214, 0.35)"
                      }
                      strokeWidth={0.6}
                    />
                  );
                })}
                {/* Viewport actual */}
                <rect
                  x={offsetX + (vpX - minX) * scale}
                  y={offsetY + (vpY - minY) * scale}
                  width={vpW * scale}
                  height={vpH * scale}
                  fill="rgba(36, 87, 214, 0.08)"
                  stroke="var(--pulso-primary)"
                  strokeWidth={1.2}
                  rx={2}
                  ry={2}
                />
              </svg>
            </div>
          );
        })()}

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
              existingExpression={target.relevantExpression ?? undefined}
              onCancel={() => setConnectPicker(null)}
              onConfirm={(expression, combiner) => {
                // Si el target ya tiene `relevant`, el picker hizo
                // step 2 y devolvió `combiner` ("and" o "or"). Si no,
                // la nueva expresión se escribe directa.
                //
                // Detección de duplicado (idempotente): si la nueva
                // ya está como rama exacta de la existente, no
                // duplicar.
                const existing = target.relevantExpression?.trim() ?? "";
                const newExpr = expression.trim();
                const norm = (s: string) => s.replace(/\s+/g, " ").trim();
                let combined: string;
                if (!existing || !combiner) {
                  combined = newExpr;
                } else {
                  const existingNorm = norm(existing);
                  const newNorm = norm(newExpr);
                  const splitter =
                    combiner === "and"
                      ? /\s+\band\b\s+/
                      : /\s+\bor\b\s+/;
                  if (
                    existingNorm === newNorm ||
                    existingNorm
                      .split(splitter)
                      .some((part) => norm(part) === newNorm)
                  ) {
                    combined = existing;
                  } else {
                    combined = `${existing} ${combiner} ${newExpr}`;
                  }
                }
                onSetRelevant(target.rowIndex, combined);
                setFreshEdgeKey(`${source.id}->${target.id}`);
                setConnectPicker(null);
                setTimeout(() => setFreshEdgeKey(null), 700);
                // Toast de confirmación. Texto distinto si fue
                // combinación (Y/O) o creación nueva.
                if (combiner) {
                  pushToast(
                    `Condición combinada con "${combiner === "and" ? "Y" : "O"}"`,
                  );
                } else if (existing && existing === combined) {
                  pushToast("La condición ya existía", "info");
                } else {
                  pushToast("Conexión creada");
                }
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
                    Las flechas conectan preguntas que gobiernan visibilidad,
                    validaciones, cálculos o filtros de opciones. Mismo
                    <strong> color</strong> = misma condición lógica.
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
                <span
                  className="pulso-graph-detail-avatar"
                  style={{
                    background:
                      selectedNode.kind === "section"
                        ? "rgba(15, 118, 110, 0.12)"
                        : "rgba(36, 87, 214, 0.12)",
                    color:
                      selectedNode.kind === "section"
                        ? "#0f766e"
                        : "var(--pulso-primary)",
                  }}
                  aria-hidden="true"
                >
                  {selectedNode.kind === "section" ? (
                    <Folder size={16} strokeWidth={2.2} />
                  ) : (
                    <CircleDot size={16} strokeWidth={2.2} />
                  )}
                </span>
                <div className="pulso-graph-detail-title">
                  <strong>{selectedNode.title || selectedNode.subtitle}</strong>
                  <span>
                    {selectedNode.kind === "section" ? "Sección" : "Pregunta"}
                    {" · "}
                    <code>{selectedNode.name}</code>
                  </span>
                </div>
                <button
                  type="button"
                  className="pulso-icon"
                  onClick={() => setSelectedId(null)}
                  title="Cerrar detalle (Esc)"
                  aria-label="Cerrar detalle"
                >
                  <X size={12} />
                </button>
              </header>
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
                    {humanize(selectedNode.relevantExpression)}
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
                              {humanize(parent.expression)}
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

        {/* Panel de RELACIÓN LÓGICA — bundle-aware.
            Cuando se selecciona una flecha, identificamos TODOS los
            edges del mismo bundle (mismo `unitKey`) y mostramos la
            relación lógica COMPLETA: todas las sources que originan
            la condición + todos los targets a los que desemboca.
            Conceptualmente es UNA SOLA flecha que se desbranda — el
            panel lo refleja así con secciones "Origen(es)" + "Destino(s)".
            Vive en posición fija, no se mueve con pan/zoom. */}
        {selectedEdgeIdx !== null && layout && graph && (() => {
          const clickedEdge = layout.edges[selectedEdgeIdx];
          if (!clickedEdge) return null;
          // Recolectar TODOS los edges del bundle.
          const bundleEdges = layout.edges.filter(
            (e) => e.unitKey === clickedEdge.unitKey,
          );
          if (bundleEdges.length === 0) return null;
          // Sources/targets únicos por ID RESUELTO (no el original).
          // Cuando una sección está colapsada, los edges a sus
          // preguntas internas se resuelven a la sección. Usar los
          // IDs originales mostraría preguntas que no son visibles
          // en el lienzo (bug reportado: "p29 aparecía en destinos
          // cuando ACCESIBILIDAD estaba colapsada").
          const seenSrc = new Set<string>();
          const sources: GraphNode[] = [];
          for (const e of bundleEdges) {
            if (seenSrc.has(e.resolvedSourceId)) continue;
            seenSrc.add(e.resolvedSourceId);
            const node = graph.byId.get(e.resolvedSourceId);
            if (node) sources.push(node);
          }
          const seenTgt = new Set<string>();
          const targets: GraphNode[] = [];
          for (const e of bundleEdges) {
            if (seenTgt.has(e.resolvedTargetId)) continue;
            seenTgt.add(e.resolvedTargetId);
            const node = graph.byId.get(e.resolvedTargetId);
            if (node) targets.push(node);
          }
          if (sources.length === 0 || targets.length === 0) return null;
          // La expresión es la del target (todos los targets del
          // bundle comparten expresión por definición).
          const expr = targets[0]!.relevantExpression ?? "";
          const conditionGroups = splitLogicalGroups(expr);
          const hasAlternatives = conditionGroups.length > 1;
          const hasConjunctions = conditionGroups.some((group) => group.length > 1);
          // Verbo según los targets: si todos son secciones, "abre
          // la(s) sección(es)"; si todos son preguntas, "muestra
          // la(s) pregunta(s)"; si mixto, "habilita".
          const allSections = targets.every((t) => t.kind === "section");
          const allQuestions = targets.every((t) => t.kind === "question");
          const verb = allSections
            ? targets.length === 1
              ? "abre la sección"
              : "abren las secciones"
            : allQuestions
              ? targets.length === 1
                ? "muestra la pregunta"
                : "muestran las preguntas"
              : "habilitan";
          return (
            <aside className="pulso-graph-edge-panel">
              <header>
                <span className="pulso-graph-edge-panel-eyebrow">
                  Relación lógica
                  {bundleEdges.length > 1 && (
                    <span className="pulso-graph-edge-panel-bundle-count">
                      {" · "}
                      {bundleEdges.length} ramas
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  className="pulso-icon"
                  onClick={() => setSelectedEdgeIdx(null)}
                  title="Cerrar (Esc)"
                  aria-label="Cerrar"
                >
                  <X size={12} />
                </button>
              </header>

              {/* Bloque ORIGEN(ES) — uno o varios sources. */}
              <div className="pulso-graph-edge-panel-block">
                <span className="pulso-graph-edge-panel-block-label">
                  {sources.length === 1 ? "Origen" : "Orígenes"}
                </span>
                <div className="pulso-graph-edge-panel-cards">
                  {sources.map((src) => (
                    <div
                      key={src.id}
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
                        <strong>{nodeDisplayName(src)}</strong>
                        <code>{nodeKindLabel(src)}</code>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pulso-graph-edge-panel-condition">
                <span className="pulso-graph-edge-panel-condition-title">
                  Condición para mostrar
                </span>
                <div className="pulso-graph-edge-panel-condition-list">
                  {conditionGroups.map((group, groupIdx) => (
                    <div
                      key={`condition-group-${groupIdx}`}
                      className="pulso-graph-edge-panel-condition-group"
                    >
                      {groupIdx > 0 && (
                        <div className="pulso-graph-edge-panel-condition-or">
                          <span>
                            O
                          </span>
                          <em>también se muestra si</em>
                        </div>
                      )}
                      <div className="pulso-graph-edge-panel-condition-card">
                        {group.length > 1 && (
                          <div className="pulso-graph-edge-panel-condition-card-head">
                            <span>Todas estas condiciones</span>
                            <strong>Y</strong>
                          </div>
                        )}
                        <div className="pulso-graph-edge-panel-condition-rows">
                          {group.map((rawCondition, idx) => {
                            const nestedOrParts = splitTopLevelLogical(
                              stripOuterParens(rawCondition),
                              "or",
                            );
                            const hasNestedOr = nestedOrParts.length > 1;
                            const sameQuestionOptions = hasNestedOr
                              ? summarizeSameVariableOptions(
                                  nestedOrParts,
                                  labelLookup,
                                  varTitleLookup,
                                )
                              : null;
                            return (
                              <div
                                key={`${rawCondition}-${idx}`}
                                className={`pulso-graph-edge-panel-condition-row ${hasNestedOr ? "has-nested-or" : ""}`}
                              >
                                {idx > 0 && (
                                  <span className="pulso-graph-edge-panel-condition-join is-and">
                                    Y
                                  </span>
                                )}
                                {hasNestedOr ? (
                                  <div className="pulso-graph-edge-panel-nested-or">
                                    {sameQuestionOptions ? (
                                      <>
                                        <div className="pulso-graph-edge-panel-nested-question">
                                          <strong>{sameQuestionOptions.title}</strong>
                                          <code>{sameQuestionOptions.varName}</code>
                                          <span>{sameQuestionOptions.operatorLabel} cualquiera de estas opciones</span>
                                        </div>
                                        <div className="pulso-graph-edge-panel-option-grid">
                                          {sameQuestionOptions.options.map((option, optionIdx) => (
                                            <span
                                              key={`${option}-${optionIdx}`}
                                              className="pulso-graph-edge-panel-option-chip"
                                            >
                                              {optionIdx > 0 && <em>O</em>}
                                              {option}
                                            </span>
                                          ))}
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="pulso-graph-edge-panel-nested-or-head">
                                          <span>Alguna de estas opciones</span>
                                          <strong>O</strong>
                                        </div>
                                        <div className="pulso-graph-edge-panel-nested-or-list">
                                          {nestedOrParts.map((part, partIdx) => (
                                            <div
                                              key={`${part}-${partIdx}`}
                                              className="pulso-graph-edge-panel-nested-or-item"
                                            >
                                              {partIdx > 0 && (
                                                <span className="pulso-graph-edge-panel-condition-join is-or">
                                                  O
                                                </span>
                                              )}
                                              <span>{humanize(part)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  <span>{humanize(rawCondition)}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="pulso-graph-edge-panel-narrative">
                  Si se cumple{" "}
                  {hasAlternatives
                    ? "cualquiera de estos grupos"
                    : hasConjunctions
                      ? "todo este grupo"
                      : "esta condición"}
                  {", "}
                  <strong>{verb}</strong>.
                </p>
              </div>

              {/* Bloque DESTINO(S) — todos los targets del bundle. */}
              <div className="pulso-graph-edge-panel-block">
                <span className="pulso-graph-edge-panel-block-label">
                  {targets.length === 1
                    ? "Destino"
                    : `${targets.length} destinos`}
                </span>
                <div className="pulso-graph-edge-panel-cards">
                  {targets.map((tgt) => (
                    <button
                      key={tgt.id}
                      type="button"
                      className={`pulso-graph-edge-panel-card pulso-graph-edge-panel-card-${tgt.kind} pulso-graph-edge-panel-card-clickable`}
                      onClick={() => setSelectedId(tgt.id)}
                      title={`Ver detalle de ${tgt.name}`}
                    >
                      <span className="pulso-graph-edge-panel-card-icon">
                        {tgt.kind === "section" ? (
                          <Folder size={14} />
                        ) : (
                          <CircleDot size={14} />
                        )}
                      </span>
                      <div className="pulso-graph-edge-panel-card-text">
                        <strong>{nodeDisplayName(tgt)}</strong>
                        <code>{nodeKindLabel(tgt)}</code>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Acciones */}
              <div className="pulso-graph-edge-panel-actions">
                {onSetRelevant && (
                  <button
                    type="button"
                    className="pulso-graph-edge-panel-btn"
                    onClick={() => {
                      // Reabre el picker sobre el target del edge
                      // clicado. La nueva condición REEMPLAZA la
                      // existente para ese target específico — para
                      // editar otra rama el usuario debe seleccionarla.
                      const clickedTgt = graph.byId.get(
                        clickedEdge.edge.target,
                      );
                      const clickedSrc = graph.byId.get(
                        clickedEdge.edge.source,
                      );
                      if (!clickedTgt || !clickedSrc) return;
                      const rect =
                        svgRef.current?.getBoundingClientRect();
                      setConnectPicker({
                        sourceId: clickedSrc.id,
                        targetId: clickedTgt.id,
                        screenX: (rect?.left ?? 0) + (rect?.width ?? 600) / 2,
                        screenY: (rect?.top ?? 0) + 100,
                      });
                      setSelectedEdgeIdx(null);
                    }}
                  >
                    <Pencil size={12} /> Editar condición
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
 * Agrupa condiciones en la forma que un usuario no técnico espera:
 *   grupo 1: A Y B
 *   O
 *   grupo 2: C
 *
 * No intenta ser un parser ODK completo; sólo separa `or`/`and` de
 * primer nivel respetando paréntesis y comillas. Si la expresión es
 * rara, devuelve el texto entero como un solo grupo.
 */
function splitLogicalGroups(expr: string): string[][] {
  const cleaned = stripOuterParens(expr.trim());
  if (!cleaned) return [[]];
  const orParts = splitTopLevelLogical(cleaned, "or");
  return orParts.map((orPart) => {
    const andParts = splitTopLevelLogical(stripOuterParens(orPart), "and");
    return andParts.map(stripOuterParens).filter(Boolean);
  }).filter((group) => group.length > 0);
}

function splitTopLevelLogical(expr: string, op: "and" | "or"): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < expr.length; i += 1) {
    const ch = expr[i]!;
    if (quote) {
      if (ch === quote && expr[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === "(") {
      depth += 1;
      continue;
    }
    if (ch === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth === 0 && matchesLogicalWord(expr, i, op)) {
      parts.push(expr.slice(start, i).trim());
      i += op.length - 1;
      start = i + 1;
    }
  }
  parts.push(expr.slice(start).trim());
  return parts.filter(Boolean);
}

function matchesLogicalWord(expr: string, index: number, op: "and" | "or"): boolean {
  if (expr.slice(index, index + op.length).toLowerCase() !== op) return false;
  const before = index === 0 ? "" : expr[index - 1] ?? "";
  const after = expr[index + op.length] ?? "";
  return !/[A-Za-z0-9_]/.test(before) && !/[A-Za-z0-9_]/.test(after);
}

function stripOuterParens(value: string): string {
  let s = value.trim();
  let changed = true;
  while (changed && s.startsWith("(") && s.endsWith(")")) {
    changed = false;
    let depth = 0;
    let quote: "'" | '"' | null = null;
    let enclosesWhole = true;
    for (let i = 0; i < s.length; i += 1) {
      const ch = s[i]!;
      if (quote) {
        if (ch === quote && s[i - 1] !== "\\") quote = null;
        continue;
      }
      if (ch === "'" || ch === '"') {
        quote = ch;
        continue;
      }
      if (ch === "(") depth += 1;
      if (ch === ")") depth -= 1;
      if (depth === 0 && i < s.length - 1) {
        enclosesWhole = false;
        break;
      }
    }
    if (enclosesWhole) {
      s = s.slice(1, -1).trim();
      changed = true;
    }
  }
  return s;
}

type SameVariableOptionsSummary = {
  varName: string;
  title: string;
  operatorLabel: string;
  options: string[];
};

function summarizeSameVariableOptions(
  parts: string[],
  lookup: LabelLookup,
  varTitle: VarTitleLookup,
): SameVariableOptionsSummary | null {
  const parsed = parts.map(parseOptionCondition);
  if (parsed.some((item) => item == null)) return null;
  const first = parsed[0]!;
  if (!parsed.every((item) => item!.varName === first.varName && item!.operator === first.operator)) {
    return null;
  }
  const title = varTitle(first.varName) ?? first.varName;
  return {
    varName: first.varName,
    title,
    operatorLabel: first.operator,
    options: parsed.map((item) => lookup(item!.varName, item!.code) ?? item!.code),
  };
}

function parseOptionCondition(
  raw: string,
): { varName: string; operator: string; code: string } | null {
  const expr = stripOuterParens(raw);
  let match = expr.match(/^selected\(\s*\$\{([^}]+)\}\s*,\s*['"]([^'"]+)['"]\s*\)$/);
  if (match) {
    return { varName: match[1]!, operator: "contiene", code: match[2]! };
  }
  match = expr.match(/^not\s*\(\s*selected\(\s*\$\{([^}]+)\}\s*,\s*['"]([^'"]+)['"]\s*\)\s*\)$/);
  if (match) {
    return { varName: match[1]!, operator: "no contiene", code: match[2]! };
  }
  match = expr.match(/^\$\{([^}]+)\}\s*=\s*['"]([^'"]+)['"]$/);
  if (match) {
    return { varName: match[1]!, operator: "es", code: match[2]! };
  }
  match = expr.match(/^\$\{([^}]+)\}\s*!=\s*['"]([^'"]+)['"]$/);
  if (match) {
    return { varName: match[1]!, operator: "no es", code: match[2]! };
  }
  return null;
}

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
/** Versión simple sin acceso a catálogo — fallback cuando no hay
 *  contexto. Mantiene los códigos como están. */
function humanizeRelevant(expr: string): string {
  return humanizeRelevantWithLabels(expr, null);
}
/** Versión completa que resuelve códigos `'1'` a labels (`'Sí'`).
 *
 *  `lookup(varName, code)` debe devolver el label legible o null
 *  si no se encuentra. Lo construye `LogicCanvas` a partir de
 *  `structure` + `catalogs`. */
type LabelLookup = (varName: string, code: string) => string | null;
type VarTitleLookup = (varName: string) => string | null;

function humanizeRelevantWithLabels(
  expr: string,
  lookup: LabelLookup | null,
  varTitle: VarTitleLookup | null = null,
): string {
  let r = expr;
  const resolveCode = (varName: string, code: string): string => {
    if (!lookup) return code;
    const label = lookup(varName, code);
    if (label && label !== code) {
      return label;
    }
    return code;
  };
  // Resuelve `q0027` → `«¿Qué actividades laborales realiza?...» (q0027)`
  // para que el usuario reconozca la pregunta sin perder la referencia
  // al code interno del XLSForm. Usamos «» (guillemets) para que el
  // título no se confunda con los literales 'value' que vienen entre
  // comillas simples.
  const resolveVar = (varName: string): string => {
    if (!varTitle) return varName;
    const title = varTitle(varName);
    if (!title || title === varName) return varName;
    return `«${title}» (${varName})`;
  };
  // selected(${X}, 'v') → X contiene 'v_label'
  r = r.replace(
    /selected\(\s*\$\{([^}]+)\}\s*,\s*'([^']*)'\s*\)/g,
    (_, varName: string, code: string) =>
      `${resolveVar(varName)} contiene '${resolveCode(varName, code)}'`,
  );
  r = r.replace(
    /selected\(\s*\$\{([^}]+)\}\s*,\s*"([^"]*)"\s*\)/g,
    (_, varName: string, code: string) =>
      `${resolveVar(varName)} contiene "${resolveCode(varName, code)}"`,
  );
  // not( ... contiene ... ) → ... no contiene ...
  // El "varRef" capturado puede incluir `«…» (name)` además del nombre
  // simple, así que aceptamos cualquier secuencia hasta `contiene`.
  r = r.replace(
    /\bnot\s*\(\s*(.+?)\s+contiene\s+('[^']*'|"[^"]*")\s*\)/g,
    "$1 no contiene $2",
  );
  // ${X} != '' / = '' (PRIMERO, antes de los != / = generales).
  r = r.replace(/\$\{([^}]+)\}\s*!=\s*''/g, (_, varName: string) => `${resolveVar(varName)} tiene valor`);
  r = r.replace(/\$\{([^}]+)\}\s*=\s*''/g, (_, varName: string) => `${resolveVar(varName)} está vacío`);
  // ${X} = 'code' / != 'code' → resolver código a label.
  r = r.replace(
    /\$\{([^}]+)\}\s*=\s*'([^']*)'/g,
    (_, varName: string, code: string) =>
      `${resolveVar(varName)} = '${resolveCode(varName, code)}'`,
  );
  r = r.replace(
    /\$\{([^}]+)\}\s*!=\s*'([^']*)'/g,
    (_, varName: string, code: string) =>
      `${resolveVar(varName)} ≠ '${resolveCode(varName, code)}'`,
  );
  // ${X} → X resuelto (después de los casos anteriores).
  r = r.replace(/\$\{([^}]+)\}/g, (_, varName: string) => resolveVar(varName));
  // Operadores comunes con espacios alrededor (los que no fueron
  // capturados con valor).
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
