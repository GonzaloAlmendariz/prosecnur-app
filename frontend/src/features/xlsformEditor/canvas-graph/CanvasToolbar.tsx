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

import type { CSSProperties } from "react";
import { Magnet, RotateCcw, Undo2 } from "lucide-react";
import { TechTerm } from "../helpers/TechTerm";

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

/** Chips de tipos de conexión. Cada chip lleva una muestra del trazo con
 *  el color y patrón de dash que usa ese tipo de edge en el lienzo
 *  (sólido = visibilidad, dash = validación, punteado = cálculo,
 *  dash-dot = filtro de opciones) + el término técnico XLSForm. */
const LOGIC_LAYER_CONTROLS = [
  {
    key: "showRelevant",
    label: "Visibilidad",
    tech: "relevant",
    color: "#2457d6",
    dash: undefined,
    title:
      "Visibilidad: flechas que deciden cuándo se muestra una pregunta o sección.",
  },
  {
    key: "showConstraint",
    label: "Validación",
    tech: "constraint",
    color: "#E15759",
    dash: "5 3",
    title:
      "Validación: flechas hacia respuestas con una regla que deben cumplir.",
  },
  {
    key: "showCalculation",
    label: "Cálculo",
    tech: "calculation",
    color: "#59A14F",
    dash: "1.5 3",
    title: "Cálculo: flechas que alimentan campos calculados automáticos.",
  },
  {
    key: "showChoiceFilter",
    label: "Filtro",
    tech: "choice_filter",
    color: "#B07AA1",
    dash: "5 2 1.5 2",
    title: "Filtro: flechas que recortan las opciones de una lista.",
  },
] as const satisfies ReadonlyArray<{
  key: keyof EdgeKindFilter;
  label: string;
  tech: string;
  color: string;
  dash: string | undefined;
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
          <span className="pulso-graph-toolbar-layer-label">Relaciones</span>
          <div
            className="pulso-graph-toolbar-segment"
            role="group"
            aria-label="Filtrar relaciones visibles"
          >
            {LOGIC_LAYER_CONTROLS.map(({ key, label, tech, color, dash, title }) => (
              <button
                type="button"
                key={key}
                className={edgeKindFilter[key] ? "is-on" : ""}
                onClick={() => toggleKind(key)}
                title={title}
                aria-pressed={edgeKindFilter[key]}
                style={{ "--xfg-chip": color } as CSSProperties}
              >
                {/* Muestra del trazo: línea con el dash real + flecha. */}
                <svg width={18} height={8} viewBox="0 0 18 8" aria-hidden="true">
                  <path
                    d="M 1 4 H 12"
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeDasharray={dash}
                  />
                  <path d="M 12 1.2 L 17 4 L 12 6.8 z" fill={color} />
                </svg>
                <span>{label}</span>
                <TechTerm t={tech} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
