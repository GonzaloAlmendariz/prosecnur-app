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

import { Magnet, RotateCcw } from "lucide-react";

export type CanvasToolbarProps = {
  hasOverrides: boolean;
  onResetLayout: () => void;
  edgeFilter: "all" | "macro" | "micro";
  onChangeEdgeFilter: (next: "all" | "macro" | "micro") => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
};

export function CanvasToolbar({
  hasOverrides,
  onResetLayout,
  edgeFilter,
  onChangeEdgeFilter,
  snapToGrid,
  onToggleSnap,
}: CanvasToolbarProps) {
  return (
    <div className="pulso-graph-toolbar" role="toolbar" aria-label="Herramientas del lienzo">
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
        className={`pulso-graph-toolbar-btn ${snapToGrid ? "is-on" : ""}`}
        onClick={onToggleSnap}
        title={snapToGrid ? "Desactivar snap a la grilla" : "Activar snap a la grilla (16 px)"}
        aria-pressed={snapToGrid}
        aria-label="Snap to grid"
      >
        <Magnet size={13} />
        <span>Snap</span>
      </button>

      <span className="pulso-graph-toolbar-sep" aria-hidden="true" />

      <div
        className="pulso-graph-toolbar-segment"
        role="radiogroup"
        aria-label="Filtro de dependencias"
      >
        <button
          type="button"
          role="radio"
          aria-checked={edgeFilter === "all"}
          className={edgeFilter === "all" ? "is-on" : ""}
          onClick={() => onChangeEdgeFilter("all")}
          title="Mostrar todas las dependencias"
        >
          Todas
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={edgeFilter === "macro"}
          className={edgeFilter === "macro" ? "is-on" : ""}
          onClick={() => onChangeEdgeFilter("macro")}
          title="Solo sección ↔ sección y variable → sección"
        >
          Macro
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={edgeFilter === "micro"}
          className={edgeFilter === "micro" ? "is-on" : ""}
          onClick={() => onChangeEdgeFilter("micro")}
          title="Solo variable ↔ variable"
        >
          Micro
        </button>
      </div>
    </div>
  );
}
