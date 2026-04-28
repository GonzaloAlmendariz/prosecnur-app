import { Maximize2, ZoomIn, ZoomOut, RefreshCw, MousePointer2 } from "lucide-react";

export type PlanCanvasToolbarProps = {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFit: () => void;
  selectedCount: number;
  onClearSelection: () => void;
};

// Toolbar flotante simple. Se eliminaron los chips de filtro de edges
// (no hay edges) y el toggle de snap (siempre activo a la grilla de 6
// columnas). Sólo zoom + fit + indicador de selección.

export function PlanCanvasToolbar({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFit,
  selectedCount,
  onClearSelection,
}: PlanCanvasToolbarProps) {
  return (
    <div className="pulso-gv2-canvas-toolbar" role="toolbar" aria-label="Herramientas del lienzo">
      <button
        type="button"
        className="pulso-gv2-canvas-toolbar-btn"
        onClick={onFit}
        title="Ajustar al lienzo (F)"
      >
        <Maximize2 size={13} />
        <span>Fit</span>
      </button>
      <button
        type="button"
        className="pulso-gv2-canvas-toolbar-btn"
        onClick={onZoomOut}
        title="Alejar (-)"
      >
        <ZoomOut size={13} />
      </button>
      <span style={{
        fontSize: 11, color: "var(--pulso-text-soft)",
        fontFamily: "ui-monospace, monospace", padding: "0 2px",
        minWidth: 38, textAlign: "center",
      }}>
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        className="pulso-gv2-canvas-toolbar-btn"
        onClick={onZoomIn}
        title="Acercar (+)"
      >
        <ZoomIn size={13} />
      </button>
      <button
        type="button"
        className="pulso-gv2-canvas-toolbar-btn"
        onClick={onResetZoom}
        title="Reset zoom (0)"
      >
        <RefreshCw size={13} />
      </button>

      {selectedCount > 0 && (
        <>
          <span className="pulso-gv2-canvas-toolbar-sep" aria-hidden />
          <button
            type="button"
            className="pulso-gv2-canvas-toolbar-btn is-on"
            onClick={onClearSelection}
            title="Limpiar selección (Esc)"
          >
            <MousePointer2 size={13} />
            <span>{selectedCount} seleccionado{selectedCount === 1 ? "" : "s"}</span>
          </button>
        </>
      )}
    </div>
  );
}
