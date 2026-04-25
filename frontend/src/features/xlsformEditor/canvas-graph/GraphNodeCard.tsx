// =============================================================================
// canvas-graph/GraphNodeCard.tsx — caja visual de un nodo del grafo
// =============================================================================
// Render SVG de un node: caja con borde, icono del tipo, título y subtítulo.
// El click selecciona; hover resalta. La caja se rota a una posición pasada
// como prop (calculada por `autoLayout`).
// =============================================================================

import { ListChecks } from "lucide-react";
import type { LaidOutNode } from "./autoLayout";
import { iconForType } from "../helpers/icons";
import { paletteForType, paletteSoftForType } from "../helpers/paletteForType";

export type GraphNodeCardProps = {
  node: LaidOutNode;
  width: number;
  height: number;
  selected: boolean;
  highlighted: boolean;
  /** Si true, este nodo se ve "marked" como candidato válido durante un
   *  drag de edge en curso. */
  markedAsTarget?: boolean;
  /** Si true, este nodo está siendo arrastrado como source de un edge —
   *  lo dimmeamos un poco para distinguirlo. */
  draggingFrom?: boolean;
  onClick: () => void;
  /** Se dispara cuando el usuario empieza a arrastrar desde el anchor del
   *  lado derecho. Coordenadas en espacio del canvas (post-zoom/pan ya
   *  transformados por el caller). */
  onAnchorMouseDown?: (event: React.MouseEvent) => void;
};

export function GraphNodeCard({
  node,
  width,
  height,
  selected,
  highlighted,
  markedAsTarget,
  draggingFrom,
  onClick,
  onAnchorMouseDown,
}: GraphNodeCardProps) {
  const accent =
    node.kind === "catalog"
      ? "#0f766e"
      : node.kind === "section"
        ? paletteForType("begin_group")
        : paletteForType(node.baseType);
  const accentSoft =
    node.kind === "catalog"
      ? "rgba(15, 118, 110, 0.12)"
      : node.kind === "section"
        ? paletteSoftForType("begin_group")
        : paletteSoftForType(node.baseType);

  const Icon = node.kind === "catalog" ? ListChecks : iconForType(node.baseType);

  const fill = markedAsTarget
    ? "rgba(34, 197, 94, 0.08)"
    : draggingFrom
      ? "rgba(36, 87, 214, 0.06)"
      : selected
        ? accentSoft
        : highlighted
          ? "rgba(36, 87, 214, 0.04)"
          : "white";
  const stroke = markedAsTarget
    ? "#16a34a"
    : draggingFrom
      ? "var(--pulso-primary)"
      : selected
        ? accent
        : highlighted
          ? "var(--pulso-primary)"
          : "var(--pulso-border)";
  const strokeWidth = markedAsTarget || draggingFrom
    ? 2.2
    : selected
      ? 2
      : highlighted
        ? 1.6
        : 1;

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      style={{ cursor: "pointer" }}
      onClick={onClick}
      data-graph-node-id={node.id}
      className={`pulso-graph-node ${selected ? "is-selected" : ""} ${
        highlighted ? "is-highlighted" : ""
      } ${markedAsTarget ? "is-target" : ""} ${
        draggingFrom ? "is-source" : ""
      } pulso-graph-node-${node.kind}`}
    >
      <rect
        width={width}
        height={height}
        rx={9}
        ry={9}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <foreignObject x={0} y={0} width={width} height={height} style={{ pointerEvents: "none" }}>
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            boxSizing: "border-box",
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: accent,
              background: accentSoft,
              flexShrink: 0,
            }}
          >
            <Icon size={14} />
          </span>
          <span
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              flex: 1,
              minWidth: 0,
            }}
          >
            <strong
              style={{
                fontSize: 12,
                color: "var(--pulso-text)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineHeight: 1.2,
              }}
            >
              {node.title || node.subtitle}
            </strong>
            <span
              style={{
                fontSize: 10.5,
                color: "var(--pulso-text-soft)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineHeight: 1.2,
                fontFamily:
                  node.kind === "catalog" ? undefined : "ui-monospace, monospace",
              }}
            >
              {node.subtitle}
            </span>
          </span>
        </div>
      </foreignObject>

      {/* Anchor de "salida" — puntito en el lado derecho que el usuario
          arrastra para crear un edge nuevo. Se ve siempre pero solo se
          resalta en hover (CSS). Se renderiza al final del <g> para
          quedar por encima del rect y captar el mousedown limpio. */}
      {onAnchorMouseDown && (
        <g
          className="pulso-graph-node-anchor"
          onMouseDown={(event) => {
            event.stopPropagation();
            onAnchorMouseDown(event);
          }}
        >
          <circle
            cx={width}
            cy={height / 2}
            r={6}
            fill="white"
            stroke={accent}
            strokeWidth={1.6}
          />
          <circle cx={width} cy={height / 2} r={3} fill={accent} />
        </g>
      )}
    </g>
  );
}
