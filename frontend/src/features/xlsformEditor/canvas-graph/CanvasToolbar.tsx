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
//   * Capas de lógica
//       Visibilidad, validación, cálculos y filtros de lista. Atenúa
//       las flechas que no pasan el filtro — no las elimina, solo las
//       baja de opacidad para que el grafo no "pulse".
//
// Acciones que NO entraron (con racional explícito):
//   - Multi-select / lasso → overkill para mapa de lógica.
//   - Color picker manual de cards → los colores vienen del sectionColor.
//   - Mini-map → el grafo nunca es lo suficientemente grande para
//     justificarlo (el corpus tiene ≤30 nodos visibles colapsados).
//   - Add card / connect / link → esas acciones viven en el editor
//     principal; el canvas es lectura + drag-arrow → relevant.
// =============================================================================

import {
  Calculator,
  Eye,
  Filter,
  Magnet,
  RotateCcw,
  ShieldCheck,
  Undo2,
} from "lucide-react";

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

const LOGIC_LAYER_CONTROLS = [
  {
    key: "showRelevant",
    label: "Aparición",
    Icon: Eye,
    title:
      "Aparición: muestra cuándo aparece una pregunta o sección (relevant).",
  },
  {
    key: "showConstraint",
    label: "Validación",
    Icon: ShieldCheck,
    title:
      "Validación: muestra respuestas que deben cumplir una regla (constraint).",
  },
  {
    key: "showCalculation",
    label: "Cálculos",
    Icon: Calculator,
    title:
      "Cálculos: muestra campos automáticos construidos a partir de respuestas.",
  },
  {
    key: "showChoiceFilter",
    label: "Filtros de lista",
    Icon: Filter,
    title:
      "Filtros de lista: muestra cascadas y filtros de opciones (choice_filter).",
  },
] as const satisfies ReadonlyArray<{
  key: keyof EdgeKindFilter;
  label: string;
  Icon: typeof Eye;
  title: string;
}>;

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

      {edgeKindFilter && onChangeEdgeKindFilter && (
        <>
          {!readOnly && <span className="pulso-graph-toolbar-sep" aria-hidden="true" />}
          <span className="pulso-graph-toolbar-layer-label">Capas</span>
          <div
            className="pulso-graph-toolbar-segment"
            role="group"
            aria-label="Capas de lógica visibles"
          >
            {LOGIC_LAYER_CONTROLS.map(({ key, label, Icon, title }) => (
              <button
                type="button"
                key={key}
                className={edgeKindFilter[key] ? "is-on" : ""}
                onClick={() => toggleKind(key)}
                title={title}
                aria-pressed={edgeKindFilter[key]}
              >
                <Icon size={12} strokeWidth={2.25} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
