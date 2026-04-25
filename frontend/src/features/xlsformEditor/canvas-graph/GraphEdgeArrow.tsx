// =============================================================================
// canvas-graph/GraphEdgeArrow.tsx — flecha entre dos nodos
// =============================================================================
// Tras el rediseño del canvas (post-feedback), las únicas conexiones que
// se dibujan son las de visibilidad condicional (`relevant`). Eliminamos
// los kinds: validates-with, calculates-from, filters-by, uses-catalog y
// contains. Esto deja un grafo mucho más legible — solo "B condiciona la
// aparición de A".
// =============================================================================

import type { LaidOutEdge } from "./autoLayout";

export type GraphEdgeArrowProps = {
  edge: LaidOutEdge;
  highlighted: boolean;
  dimmed: boolean;
};

const STROKE_WIDTH = 1.5;
const COLOR = "#2457d6";

export function GraphEdgeArrow({
  edge,
  highlighted,
  dimmed,
}: GraphEdgeArrowProps) {
  const sx = edge.fromX;
  const sy = edge.fromY;
  const tx = edge.toX;
  const ty = edge.toY;

  const dx = Math.max(40, Math.abs(tx - sx) * 0.4);
  const c1x = sx + dx;
  const c1y = sy;
  const c2x = tx - dx;
  const c2y = ty;
  const path = `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`;

  const opacity = dimmed ? 0.15 : highlighted ? 1 : 0.7;
  const strokeWidth = highlighted ? STROKE_WIDTH + 0.7 : STROKE_WIDTH;

  return (
    <g className="pulso-graph-edge" opacity={opacity}>
      <path
        d={path}
        fill="none"
        stroke={COLOR}
        strokeWidth={strokeWidth}
        markerEnd="url(#pulso-graph-arrow-depends-on)"
      />
    </g>
  );
}

/**
 * Marker único para la flecha de visibilidad. Se monta una vez en `<defs>`
 * del SVG raíz.
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
        <path d="M 0 0 L 10 5 L 0 10 z" fill={COLOR} />
      </marker>
    </defs>
  );
}
