// =============================================================================
// canvas-graph/GraphEdgeArrow.tsx — flecha pre-laid-out en L
// =============================================================================
// El path SVG ya viene calculado por `autoLayout.ts::buildLPath`. Aquí
// solo aplicamos estilo según `edge.edge.relation` para que el usuario
// distinga de un vistazo edges macro (sec↔sec, líneas más sólidas) de
// micro (var↔var, líneas más finas) y mixtas (var→sec, dasharray).
// =============================================================================

import type { LaidOutEdge } from "./autoLayout";
import type { EdgeRelationKind } from "./buildGraph";

export type GraphEdgeArrowProps = {
  edge: LaidOutEdge;
  highlighted: boolean;
  dimmed: boolean;
  onHover?: (hovering: boolean) => void;
};

/**
 * Estilo visual por relación. `section-to-section` es la conexión
 * "principal" del mapa (decisiones macro de visibilidad), por eso es
 * azul primary y más gruesa. Los edges entre variables son más sutiles.
 */
function styleFor(relation: EdgeRelationKind): {
  color: string;
  strokeWidth: number;
  dasharray?: string;
  marker: string;
} {
  switch (relation) {
    case "section-to-section":
      return { color: "#2457d6", strokeWidth: 1.7, marker: "depends-on" };
    case "variable-to-section":
      return { color: "#2457d6", strokeWidth: 1.4, dasharray: "6 4", marker: "depends-on" };
    case "section-to-variable":
      return { color: "#7c3aed", strokeWidth: 1.4, dasharray: "6 4", marker: "depends-on-violet" };
    case "variable-to-variable":
      return { color: "#5f6b7a", strokeWidth: 1.2, marker: "depends-on-soft" };
  }
}

export function GraphEdgeArrow({
  edge,
  highlighted,
  dimmed,
  onHover,
}: GraphEdgeArrowProps) {
  const style = styleFor(edge.edge.relation);
  const opacity = dimmed ? 0.15 : highlighted ? 1 : 0.7;
  const strokeWidth = highlighted ? style.strokeWidth + 0.6 : style.strokeWidth;

  return (
    <g
      className={`pulso-graph-edge pulso-graph-edge--${edge.edge.relation}`}
      opacity={opacity}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
    >
      {/* Track invisible más ancho para hover generoso. */}
      <path d={edge.path} fill="none" stroke="transparent" strokeWidth={14} />
      <path
        d={edge.path}
        fill="none"
        stroke={style.color}
        strokeWidth={strokeWidth}
        strokeDasharray={style.dasharray}
        strokeLinecap="round"
        strokeLinejoin="round"
        markerEnd={`url(#pulso-graph-arrow-${style.marker})`}
      />
    </g>
  );
}

/**
 * Markers (uno por color de flecha). El marker copia el color del path,
 * así la punta nunca queda desincronizada del trazo.
 */
export function GraphEdgeMarkers() {
  return (
    <defs>
      <marker
        id="pulso-graph-arrow-depends-on"
        viewBox="0 0 10 10"
        refX={9}
        refY={5}
        markerUnits="strokeWidth"
        markerWidth={6}
        markerHeight={6}
        orient="auto"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#2457d6" />
      </marker>
      <marker
        id="pulso-graph-arrow-depends-on-violet"
        viewBox="0 0 10 10"
        refX={9}
        refY={5}
        markerUnits="strokeWidth"
        markerWidth={6}
        markerHeight={6}
        orient="auto"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#7c3aed" />
      </marker>
      <marker
        id="pulso-graph-arrow-depends-on-soft"
        viewBox="0 0 10 10"
        refX={9}
        refY={5}
        markerUnits="strokeWidth"
        markerWidth={6}
        markerHeight={6}
        orient="auto"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#5f6b7a" />
      </marker>
    </defs>
  );
}
