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
// El mapa grafica SOLO saltos lógicos (visibilidad `relevant`), así que
// no hay filtro por tipo de relación: el color codifica CADA condición,
// no un tipo. Validación/cálculo/filtro viven en la carta de cada
// pregunta, no en este lienzo.
//
// Acciones que NO entraron (con racional explícito):
//   - Multi-select / lasso → overkill para mapa de lógica.
//   - Color picker manual de cards → los colores vienen del sectionColor.
//   - Mini-map → el grafo nunca es lo suficientemente grande para
//     justificarlo (el corpus tiene ≤30 nodos visibles colapsados).
//   - Add card / connect / link → esas acciones viven en el editor
//     principal; el canvas es lectura + drag-arrow → relevant.
// =============================================================================

import { Magnet, RotateCcw, Undo2 } from "lucide-react";

export type CanvasToolbarProps = {
  readOnly?: boolean;
  hasOverrides: boolean;
  onResetLayout: () => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  /** Si hay historia de drags para deshacer. */
  canUndoDrag?: boolean;
  onUndoDrag?: () => void;
};

export function CanvasToolbar({
  readOnly = false,
  hasOverrides,
  onResetLayout,
  snapToGrid,
  onToggleSnap,
  canUndoDrag,
  onUndoDrag,
}: CanvasToolbarProps) {
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
                ? "Dejar de alinear tarjetas a la grilla"
                : "Alinear tarjetas a una grilla de 16 px al moverlas"
            }
            aria-pressed={snapToGrid}
            aria-label="Alinear a grilla"
          >
            <Magnet size={13} />
            <span>Alinear</span>
          </button>
        </>
      )}
    </div>
  );
}
