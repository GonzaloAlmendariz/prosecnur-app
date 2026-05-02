// =============================================================================
// canvas-graph/CanvasToolbar.tsx — barra flotante estilo Obsidian Canvas
// =============================================================================
// Vive en la parte superior central del lienzo, sobre el SVG. Inspirada
// en la toolbar superior de Obsidian Canvas: pocas acciones, todas
// directas (sin menús anidados), agrupadas por función con separadores
// verticales sutiles.
//
// Acciones (de izq a der):
//
//   * Auto-layout (RotateCcw)
//       Habilitado solo si el usuario ya arrastró al menos una card.
//       Reset todas las posiciones manuales y vuelve al layout greedy.
//
//   * Snap to grid (Magnet)
//       Toggle. Cuando está ON, las posiciones de drag se redondean
//       a múltiplos de 16px. Útil para alineación rápida.
//
//   * Filtro de tipos (3 chips)
//       "Todas" / "Macro" (sec↔sec + var→sec) / "Micro" (var↔var).
//       Atenúa los edges que no pasan el filtro — no los elimina, solo
//       los baja al 15% de opacidad para que el grafo no "pulse".
//
// Acciones que NO entraron (con racional explícito):
//   - Multi-select / lasso → overkill para mapa de visibilidad.
//   - Color picker manual de cards → los colores vienen del sectionColor.
//   - Mini-map → el grafo nunca es lo suficientemente grande para
//     justificarlo (el corpus tiene ≤30 nodos visibles colapsados).
//   - Add card / connect / link → esas acciones viven en el editor
//     principal; el canvas es lectura + drag-arrow → relevant.
// =============================================================================

import { Magnet, RotateCcw, Undo2 } from "lucide-react";

export type EdgeKindFilter = {
  showRelevant: boolean;
  showConstraint: boolean;
  showCalculation: boolean;
  showChoiceFilter: boolean;
};

export type CanvasToolbarProps = {
  readOnly?: boolean;
  hasOverrides: boolean;
  onResetLayout: () => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  /** Si hay historia de drags para deshacer. */
  canUndoDrag?: boolean;
  onUndoDrag?: () => void;
  /** Filtro por tipo de dependencia (relevant/constraint/calculation/
   *  choice_filter). Por defecto solo se muestra relevant — los otros
   *  son menos comunes y suman ruido. El usuario puede activarlos. */
  edgeKindFilter?: EdgeKindFilter;
  onChangeEdgeKindFilter?: (next: EdgeKindFilter) => void;
};

export function CanvasToolbar({
  readOnly = false,
  hasOverrides,
  onResetLayout,
  snapToGrid,
  onToggleSnap,
  canUndoDrag,
  onUndoDrag,
  edgeKindFilter,
  onChangeEdgeKindFilter,
}: CanvasToolbarProps) {
  const toggleKind = (key: keyof EdgeKindFilter) => {
    if (!edgeKindFilter || !onChangeEdgeKindFilter) return;
    onChangeEdgeKindFilter({ ...edgeKindFilter, [key]: !edgeKindFilter[key] });
  };
  return (
    <div
      className="pulso-graph-toolbar"
      role="toolbar"
      aria-label="Herramientas del lienzo"
    >
      {!readOnly && (
        <>
          <button
            type="button"
            className="pulso-graph-toolbar-btn"
            onClick={onResetLayout}
            disabled={!hasOverrides}
            title={
              hasOverrides
                ? "Volver al layout automático"
                : "El layout ya está en su orden automático"
            }
            aria-label="Auto-layout"
          >
            <RotateCcw size={13} />
            <span>Auto-layout</span>
          </button>

          <button
            type="button"
            className="pulso-graph-toolbar-btn"
            onClick={onUndoDrag}
            disabled={!canUndoDrag}
            title={
              canUndoDrag
                ? "Deshacer último movimiento de card (Cmd/Ctrl+Z)"
                : "Sin movimientos para deshacer"
            }
            aria-label="Deshacer movimiento"
          >
            <Undo2 size={13} />
            <span>Deshacer</span>
          </button>

          <button
            type="button"
            className={`pulso-graph-toolbar-btn ${snapToGrid ? "is-on" : ""}`}
            onClick={onToggleSnap}
            title={
              snapToGrid
                ? "Desactivar snap a la grilla"
                : "Activar snap a la grilla (16 px)"
            }
            aria-pressed={snapToGrid}
            aria-label="Snap to grid"
          >
            <Magnet size={13} />
            <span>Snap</span>
          </button>
        </>
      )}

      {edgeKindFilter && onChangeEdgeKindFilter && (
        <>
          {!readOnly && <span className="pulso-graph-toolbar-sep" aria-hidden="true" />}
          <div
            className="pulso-graph-toolbar-segment"
            role="group"
            aria-label="Tipos de dependencia visibles"
          >
            <button
              type="button"
              className={edgeKindFilter.showRelevant ? "is-on" : ""}
              onClick={() => toggleKind("showRelevant")}
              title="Mostrar/ocultar flechas de visibilidad (relevant)"
              aria-pressed={edgeKindFilter.showRelevant}
            >
              Visibilidad
            </button>
            <button
              type="button"
              className={edgeKindFilter.showConstraint ? "is-on" : ""}
              onClick={() => toggleKind("showConstraint")}
              title="Mostrar/ocultar flechas de restricción (constraint)"
              aria-pressed={edgeKindFilter.showConstraint}
            >
              Restricción
            </button>
            <button
              type="button"
              className={edgeKindFilter.showCalculation ? "is-on" : ""}
              onClick={() => toggleKind("showCalculation")}
              title="Mostrar/ocultar flechas de cálculo (calculation)"
              aria-pressed={edgeKindFilter.showCalculation}
            >
              Cálculo
            </button>
            <button
              type="button"
              className={edgeKindFilter.showChoiceFilter ? "is-on" : ""}
              onClick={() => toggleKind("showChoiceFilter")}
              title="Mostrar/ocultar filtros de opciones (choice_filter)"
              aria-pressed={edgeKindFilter.showChoiceFilter}
            >
              Filtros
            </button>
          </div>
        </>
      )}
    </div>
  );
}
