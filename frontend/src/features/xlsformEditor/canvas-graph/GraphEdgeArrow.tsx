// =============================================================================
// canvas-graph/GraphEdgeArrow.tsx — flecha entre dos nodos
// =============================================================================
// Una bezier cubica que sale del centro derecho del source y entra por el
// centro izquierdo del target. La forma se computa solo con los endpoints
// + el ancho/alto del nodo para evitar que las flechas se solapen con
// las cajas.
//
// Color y patrón según `kind`:
//   - depends-on    → azul primary, línea continua.
//   - validates-with → ámbar, dasharray (validación = "no es flujo").
//   - calculates-from → indigo, línea continua, más gruesa.
//   - filters-by    → verde, dasharray cortita.
//   - uses-catalog  → teal, dotted.
//   - contains      → gris suave, línea muy ligera (estructural).
// =============================================================================

import type { LaidOutEdge } from "./autoLayout";

export type GraphEdgeArrowProps = {
  edge: LaidOutEdge;
  nodeWidth: number;
  nodeHeight: number;
  highlighted: boolean;
  dimmed: boolean;
};

export function GraphEdgeArrow({
  edge,
  nodeWidth,
  nodeHeight,
  highlighted,
  dimmed,
}: GraphEdgeArrowProps) {
  // Endpoints recortados al borde de las cajas (right-edge del source,
  // left-edge del target). Los `from`/`to` que vienen son centros.
  const sx = edge.fromX + nodeWidth / 2;
  const sy = edge.fromY;
  const tx = edge.toX - nodeWidth / 2;
  const ty = edge.toY;
  void nodeHeight;

  // Bezier control points: dejamos un offset horizontal proporcional a la
  // distancia entre source y target.
  const dx = Math.max(40, Math.abs(tx - sx) * 0.4);
  const c1x = sx + dx;
  const c1y = sy;
  const c2x = tx - dx;
  const c2y = ty;
  const path = `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`;

  const style = edgeStyleByKind(edge.kind);
  const opacity = dimmed ? 0.15 : highlighted ? 1 : 0.7;
  const strokeWidth = highlighted ? style.strokeWidth + 0.6 : style.strokeWidth;

  return (
    <g className={`pulso-graph-edge pulso-graph-edge-${edge.kind}`} opacity={opacity}>
      <path
        d={path}
        fill="none"
        stroke={style.color}
        strokeWidth={strokeWidth}
        strokeDasharray={style.dasharray}
        markerEnd={`url(#pulso-graph-arrow-${edge.kind})`}
      />
    </g>
  );
}

export function edgeStyleByKind(kind: LaidOutEdge["kind"]) {
  switch (kind) {
    case "depends-on":
      return {
        color: "#2457d6",
        strokeWidth: 1.4,
        dasharray: undefined,
        label: "depende de",
      };
    case "validates-with":
      return {
        color: "#d97706",
        strokeWidth: 1.4,
        dasharray: "5 3",
        label: "valida con",
      };
    case "calculates-from":
      return {
        color: "#4f46e5",
        strokeWidth: 1.6,
        dasharray: undefined,
        label: "calcula con",
      };
    case "filters-by":
      return {
        color: "#16a34a",
        strokeWidth: 1.4,
        dasharray: "3 3",
        label: "filtra por",
      };
    case "uses-catalog":
      return {
        color: "#0f766e",
        strokeWidth: 1.4,
        dasharray: "1 4",
        label: "usa catálogo",
      };
    case "contains":
      return {
        color: "#94a3b8",
        strokeWidth: 1.0,
        dasharray: undefined,
        label: "contiene",
      };
  }
}

/**
 * Markers para las flechas (un marker por kind, con su color). Se montan
 * una vez en el `<defs>` del SVG raíz.
 */
export function GraphEdgeMarkers() {
  const kinds: LaidOutEdge["kind"][] = [
    "depends-on",
    "validates-with",
    "calculates-from",
    "filters-by",
    "uses-catalog",
    "contains",
  ];
  return (
    <defs>
      {kinds.map((kind) => {
        const { color } = edgeStyleByKind(kind);
        return (
          <marker
            key={kind}
            id={`pulso-graph-arrow-${kind}`}
            viewBox="0 0 10 10"
            refX={9}
            refY={5}
            markerUnits="strokeWidth"
            markerWidth={6}
            markerHeight={6}
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
          </marker>
        );
      })}
    </defs>
  );
}
