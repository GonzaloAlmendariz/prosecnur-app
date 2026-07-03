import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Bookmark, Copy, Layers3, LayoutGrid, LayoutPanelTop, Plus, Trash2 } from "lucide-react";
import { Slide, SlideType } from "../../../../api/client";
import { usePlanStore } from "../../store";
import { usePlanValidator } from "../../usePlanValidator";
import { buildPlanGraph } from "./buildPlanGraph";
import {
  planAutoLayout,
  findDropTarget,
  NODE_W,
  NODE_H,
  SECTION_HEADER_H,
} from "./planAutoLayout";
import { PlanNodeCard } from "./PlanNodeCard";
import { PlanCanvasToolbar } from "./PlanCanvasToolbar";
import { useVariables } from "../../useVariables";

// Lienzo V2: grilla determinística 6×N organizada por secciones. Sin
// SVG, sin edges. Todo el render en HTML/CSS para tener animaciones
// suaves de transform al cambiar de posición.
//
// Interacciones clave:
//   * Click slide          → selecciona ese y limpia los demás.
//   * Shift+Click slide    → toggle add/remove en la selección.
//   * Click fondo / Esc    → limpia selección.
//   * Drag slide selecc.   → mueve TODOS los seleccionados juntos
//                            (preservando offsets relativos). Drop usa
//                            la posición del cursor para calcular el
//                            nuevo orden global vía moveSlideTo.
//   * Drag slide no-sel.   → arrastra solo ese (la selección anterior
//                            se descarta).
//   * Scroll/trackpad      → movimiento vertical nativo. Sin zoom ni
//                            movimiento horizontal en este modo.
//
// Snap to grid: siempre activo. Cada slide cae en una celda; el número
// de columnas se ajusta al ancho disponible hasta un máximo de 6.

const CANVAS_STARTERS: {
  tipo: SlideType;
  label: string;
  detail: string;
  tone: "cover" | "section" | "chart";
  Icon: typeof LayoutGrid;
}[] = [
  { tipo: "p_slide_portada", label: "Portada", detail: "Inicio", tone: "cover", Icon: LayoutPanelTop },
  { tipo: "p_slide_seccion", label: "Sección", detail: "Bloque", tone: "section", Icon: Layers3 },
  { tipo: "p_slide_1_grafico", label: "Un gráfico", detail: "Visual", tone: "chart", Icon: BarChart3 },
];

export function PlanCanvas() {
  const slides = usePlanStore((s) => s.plan.slides);
  const paletas = usePlanStore((s) => s.paletas);
  const iconos = usePlanStore((s) => s.iconos);
  const overridesReusables = usePlanStore((s) => s.overridesReusables);
  const selectedSlideId = usePlanStore((s) => s.selectedSlideId);
  const select = usePlanStore((s) => s.select);
  const moveSlideTo = usePlanStore((s) => s.moveSlideTo);
  const loadPlan = usePlanStore((s) => s.loadPlan);
  const addSlide = usePlanStore((s) => s.addSlide);
  const duplicateSlide = usePlanStore((s) => s.duplicateSlide);
  const removeSlide = usePlanStore((s) => s.removeSlide);
  const density = usePlanStore((s) => s.density);
  const { variables } = useVariables();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);

  // IDs que se acaban de mover (para animación highlight breve)
  const [recentlyMoved, setRecentlyMoved] = useState<Set<string>>(new Set());
  const recentlyMovedTimerRef = useRef<number | null>(null);

  function flashRecent(ids: Set<string>) {
    setRecentlyMoved(ids);
    if (recentlyMovedTimerRef.current) window.clearTimeout(recentlyMovedTimerRef.current);
    recentlyMovedTimerRef.current = window.setTimeout(() => setRecentlyMoved(new Set()), 700);
  }

  const { issues } = usePlanValidator();
  const issuesBySlide = useMemo(() => {
    const map: Record<string, typeof issues> = {};
    for (const it of issues) {
      if (!it.slideId) continue;
      (map[it.slideId] ??= []).push(it);
    }
    return map;
  }, [issues]);

  const graph = useMemo(
    () => buildPlanGraph({ slides }, paletas, iconos, overridesReusables),
    [slides, paletas, iconos, overridesReusables],
  );
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setCanvasWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(
    () => planAutoLayout(graph.nodes, Math.max(0, canvasWidth - 48)),
    [graph.nodes, canvasWidth],
  );

  // ── Multi-select ───────────────────────────────────────────────────────
  // Inicialmente refleja `selectedSlideId` del store (siempre 0 ó 1 ítem).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(selectedSlideId ? [selectedSlideId] : []),
  );

  // Sync: si el store cambia (por click en timeline, por ej.), reflejarlo
  useEffect(() => {
    setSelectedIds((prev) => {
      if (selectedSlideId === null) return prev.size === 0 ? prev : new Set();
      if (prev.size === 1 && prev.has(selectedSlideId)) return prev;
      // No sobrescribimos si el usuario tiene multi-select activo en canvas
      if (prev.size > 1 && prev.has(selectedSlideId)) return prev;
      return new Set([selectedSlideId]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlideId]);

  function clickSlide(id: string, shift: boolean) {
    if (shift) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
      // No cambiamos selectedSlideId del store en multi-select
    } else {
      setSelectedIds(new Set([id]));
      select(id);
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
    select(null);
  }

  function onMouseDownStage(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    if (e.target !== e.currentTarget) return;
    if (!e.shiftKey) clearSelection();
  }

  // ── Drag de slides (multi-select aware) ────────────────────────────────
  // Estado durante un drag. `cursorOffset` se actualiza con cada mousemove
  // y se aplica como translate adicional a TODOS los seleccionados. Al
  // soltar, calculamos el target del slide "principal" (el que el usuario
  // arrastró) y reordenamos.
  const dragRef = useRef<{
    primaryId: string;
    pointerStart: { x: number; y: number };
    primaryPos: { x: number; y: number };
    movingIds: Set<string>;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [dragVisualOffset, setDragVisualOffset] = useState<{ x: number; y: number } | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);

  function onSlideMouseDown(id: string, e: React.MouseEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    // Si el slide ya está seleccionado y hay multi-select, mueve toda la selección
    const isInSel = selectedIds.has(id);
    let effectiveSelection: Set<string>;
    if (isInSel && selectedIds.size > 1) {
      effectiveSelection = new Set(selectedIds);
    } else if (e.shiftKey) {
      // Si inicia un drag con Shift desde un slide no seleccionado,
      // movemos la selección existente más ese slide. Si sólo fue click,
      // el toggle se procesa en onSlideClick.
      effectiveSelection = new Set(selectedIds);
      effectiveSelection.add(id);
    } else {
      // click normal: si no era el seleccionado, selecciónalo.
      if (!isInSel) {
        setSelectedIds(new Set([id]));
        select(id);
      }
      effectiveSelection = new Set([id]);
    }

    const pos = layout.positions.get(id);
    if (!pos) return;
    dragRef.current = {
      primaryId: id,
      pointerStart: { x: e.clientX, y: e.clientY },
      primaryPos: { x: pos.x, y: pos.y },
      movingIds: effectiveSelection,
      moved: false,
    };
  }

  // shift+click puro (sin drag) toggle selection
  function onSlideClick(id: string, e: React.MouseEvent) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    clickSlide(id, e.shiftKey);
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (dragRef.current) {
        const drag = dragRef.current;
        const dx = e.clientX - drag.pointerStart.x;
        const dy = e.clientY - drag.pointerStart.y;
        if (!drag.moved && Math.hypot(dx, dy) > 4) drag.moved = true;
        if (drag.moved) {
          setDragVisualOffset({ x: dx, y: dy });
          // Calcular drop target con la posición proyectada del primary.
          const stage = stageRef.current;
          if (stage) {
            const stageRect = stage.getBoundingClientRect();
            const px = e.clientX - stageRect.left;
            const py = e.clientY - stageRect.top;
            const target = findDropTarget(layout, { x: px, y: py });
            setDropTargetIdx(target ? target.globalIndex : null);
          }
        }
        return;
      }
    }
    function onUp(e: MouseEvent) {
      if (dragRef.current) {
        const drag = dragRef.current;
        if (drag.moved && dropTargetIdx !== null) {
          // Reordenar el plan: tomar todos los movingIds (en su orden
          // actual del plan) y reinsertar en posición dropTargetIdx
          // manteniendo el orden interno.
          commitReorder(drag.movingIds, dropTargetIdx);
        }
        suppressClickRef.current = drag.moved;
        // Reset visual
        setDragVisualOffset(null);
        setDropTargetIdx(null);
        dragRef.current = null;
        return;
      }
      void e;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, dropTargetIdx]);

  function commitReorder(movingIds: Set<string>, targetIdx: number) {
    // Construir nueva lista: separar moving de stationary, luego insertar
    // moving en la posición targetIdx ajustada.
    const moving: Slide[] = [];
    const stationary: Slide[] = [];
    for (const s of slides) {
      if (movingIds.has(s.id)) moving.push(s);
      else stationary.push(s);
    }
    // targetIdx está calculado sobre el plan COMPLETO. Lo ajustamos a la
    // lista stationary descontando los moving que estaban antes.
    let movedBefore = 0;
    for (let i = 0; i < targetIdx && i < slides.length; i++) {
      if (movingIds.has(slides[i].id)) movedBefore++;
    }
    const insertAt = Math.max(0, Math.min(stationary.length, targetIdx - movedBefore));
    const next: Slide[] = [
      ...stationary.slice(0, insertAt),
      ...moving,
      ...stationary.slice(insertAt),
    ];
    if (movingIds.size === 1) {
      const id = Array.from(movingIds)[0];
      const newIdx = next.findIndex((s) => s.id === id);
      if (newIdx >= 0) moveSlideTo(id, newIdx);
    } else {
      // Múltiple: actualizamos el plan completo. loadPlan marca dirty + push.
      loadPlan({ slides: next });
    }
    flashRecent(new Set(movingIds));
  }

  // Acciones bulk
  function bulkDuplicate() {
    // Duplica cada slide seleccionado en orden. Lo hacemos uno a uno
    // para que cada duplicación se historicé como acción undoable.
    const ids = Array.from(selectedIds);
    for (const id of ids) duplicateSlide(id);
  }
  function bulkDelete() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`¿Eliminar ${selectedIds.size} slide(s)?`)) return;
    const ids = Array.from(selectedIds);
    for (const id of ids) removeSlide(id);
    setSelectedIds(new Set());
  }
  function addSection() {
    addSlide("p_slide_seccion");
    // El slide nuevo queda seleccionado vía addSlide → set selectedSlideId.
  }

  // ── Atajos del lienzo ──────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "Escape") { e.preventDefault(); clearSelection(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (graph.nodes.length === 0) {
    return <CanvasEmptyStart density={density} onAddSlide={addSlide} />;
  }

  return (
    <div ref={containerRef} className={`pulso-gv2-canvas ${density === "compact" ? "is-compact" : ""}`}>
      <PlanCanvasToolbar
        selectedCount={selectedIds.size}
        onClearSelection={clearSelection}
      />

      <div
        ref={stageRef}
        className="pulso-gv2-canvas-stage"
        onMouseDown={onMouseDownStage}
        style={{
          width: layout.width,
          height: layout.height,
        }}
      >
        {/* Bbox de cada sección — fondo + título */}
        {layout.groups.map((group) => {
          const box = layout.sectionBoxes.get(group.id);
          if (!box) return null;
          return (
            <div
              key={group.id}
              className={`pulso-gv2-section ${group.isSeparator ? "is-named" : "is-intro"}`}
              style={{
                position: "absolute",
                left: box.x,
                top: box.y,
                width: box.w,
                height: box.h,
              }}
              data-section-id={group.id}
            >
              <div className="pulso-gv2-section-head" style={{ height: SECTION_HEADER_H }}>
                <span className="pulso-gv2-section-title">{group.title}</span>
                <span className="pulso-gv2-section-meta">
                  {group.nodes.length} slide{group.nodes.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          );
        })}

        {/* Drop indicator (línea/celda donde caería el drop) */}
        {dropTargetIdx !== null && dragRef.current?.moved && (
          (() => {
            const idx = dropTargetIdx;
            const cursorSlide = idx < slides.length ? slides[idx] : null;
            const ref = cursorSlide ? layout.positions.get(cursorSlide.id) : null;
            const indicatorPos = ref
              ? { x: ref.x - 8, y: ref.y }
              : (() => {
                  const lastSlide = slides[slides.length - 1];
                  const lastPos = lastSlide ? layout.positions.get(lastSlide.id) : null;
                  return lastPos ? { x: lastPos.x + NODE_W + 4, y: lastPos.y } : null;
                })();
            if (!indicatorPos) return null;
            const positionLabel = `#${idx + 1}`;
            return (
              <>
                <div
                  className="pulso-gv2-drop-indicator"
                  style={{
                    position: "absolute",
                    left: indicatorPos.x,
                    top: indicatorPos.y,
                    width: 4,
                    height: NODE_H,
                  }}
                />
                <div
                  className="pulso-gv2-drop-indicator-label"
                  style={{
                    position: "absolute",
                    left: indicatorPos.x - 38,
                    top: indicatorPos.y - 26,
                  }}
                >
                  Insertar {positionLabel}
                </div>
              </>
            );
          })()
        )}

        {/* Tiles de cada slide */}
        {graph.nodes.map((node) => {
          const pos = layout.positions.get(node.id);
          if (!pos) return null;
          const isSelected = selectedIds.has(node.id);
          const isMoving = !!(dragRef.current?.moved && dragRef.current?.movingIds.has(node.id));
          const dragging = isMoving && !!dragVisualOffset;
          const isRecentlyMoved = recentlyMoved.has(node.id);
          const offset = dragging && dragVisualOffset ? dragVisualOffset : { x: 0, y: 0 };
          return (
            <div
              key={node.id}
              className={`pulso-gv2-slide-tile ${isSelected ? "is-selected" : ""} ${dragging ? "is-dragging" : ""} ${isRecentlyMoved ? "is-recently-moved" : ""}`}
              style={{
                position: "absolute",
                left: pos.x,
                top: pos.y,
                width: NODE_W,
                height: NODE_H,
                transform: dragging
                  ? `translate(${offset.x}px, ${offset.y}px)`
                  : "translate(0,0)",
                zIndex: dragging ? 100 : (isSelected ? 5 : 1),
              }}
              onMouseDown={(e) => onSlideMouseDown(node.id, e)}
              onClick={(e) => onSlideClick(node.id, e)}
            >
              <PlanNodeCard
                node={node}
                selected={isSelected}
                dimmed={false}
                issues={issuesBySlide[node.id] ?? []}
                variables={variables}
                onClick={(e) => onSlideClick(node.id, e)}
                onMouseDown={(e) => onSlideMouseDown(node.id, e)}
              />
            </div>
          );
        })}
      </div>

      {/* Botón rápido: nueva sección */}
      <button
        type="button"
        className="pulso-gv2-canvas-add-section"
        onClick={addSection}
        aria-label="Agregar slide separador de sección al final"
      >
        <Bookmark size={13} />
        Nueva sección
      </button>

      {/* Bulk-actions: solo visible con multi-select */}
      {selectedIds.size > 1 && (
        <div className="pulso-gv2-canvas-bulk" role="toolbar" aria-label={`Acciones para ${selectedIds.size} slides seleccionados`}>
          <span className="pulso-gv2-canvas-bulk-count">{selectedIds.size} seleccionados</span>
          <button
            type="button"
            className="pulso-gv2-canvas-bulk-btn"
            onClick={bulkDuplicate}
            aria-label="Duplicar selección"
          >
            <Copy size={12} /> Duplicar
          </button>
          <button
            type="button"
            className="pulso-gv2-canvas-bulk-btn is-danger"
            onClick={bulkDelete}
            aria-label="Eliminar selección"
          >
            <Trash2 size={12} /> Eliminar
          </button>
        </div>
      )}

    </div>
  );
}

function CanvasEmptyStart({
  density,
  onAddSlide,
}: {
  density: "comfortable" | "compact";
  onAddSlide: (tipo: SlideType) => void;
}) {
  return (
    <div className={`pulso-gv2-canvas pulso-gv2-canvas-empty-shell ${density === "compact" ? "is-compact" : ""}`}>
      <section className="pulso-gv2-canvas-empty-surface" aria-label="Canvas sin slides">
        <div className="pulso-gv2-canvas-empty-board" aria-hidden="true">
          <div className="pulso-gv2-canvas-empty-section is-primary">
            <span />
            <div>
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="pulso-gv2-canvas-empty-section is-secondary">
            <span />
            <div>
              <i />
              <i />
            </div>
          </div>
          <div className="pulso-gv2-canvas-empty-cursor">
            <Plus size={13} />
          </div>
        </div>

        <div className="pulso-gv2-canvas-empty-copy">
          <span className="pulso-gv2-canvas-empty-eyebrow">Canvas</span>
          <h2>Organiza el plan visualmente</h2>
          <p>
            Crea el primer bloque y el lienzo dibujará la grilla de slides por secciones.
          </p>
          <div className="pulso-gv2-canvas-empty-actions" aria-label="Crear primer slide desde Canvas">
            {CANVAS_STARTERS.map(({ tipo, label, detail, tone, Icon }) => (
              <button
                key={tipo}
                type="button"
                className={`pulso-gv2-canvas-empty-action is-${tone}`}
                onClick={() => onAddSlide(tipo)}
              >
                <Icon size={14} />
                <span>
                  <strong>{label}</strong>
                  <small>{detail}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
