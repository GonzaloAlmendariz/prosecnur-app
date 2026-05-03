import { MousePointer2 } from "lucide-react";

export type PlanCanvasToolbarProps = {
  selectedCount: number;
  onClearSelection: () => void;
};

// Toolbar flotante simple. En modo canvas no hay zoom ni paneo
// horizontal: sólo mostramos el estado de selección.

export function PlanCanvasToolbar({
  selectedCount,
  onClearSelection,
}: PlanCanvasToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="pulso-gv2-canvas-toolbar" role="toolbar" aria-label="Herramientas del lienzo">
      <button
        type="button"
        className="pulso-gv2-canvas-toolbar-btn is-on"
        onClick={onClearSelection}
        title="Limpiar selección (Esc)"
      >
        <MousePointer2 size={13} />
        <span>{selectedCount} seleccionado{selectedCount === 1 ? "" : "s"}</span>
      </button>
    </div>
  );
}
