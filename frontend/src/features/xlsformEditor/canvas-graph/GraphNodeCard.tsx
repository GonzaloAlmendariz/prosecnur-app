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
  onClick: () => void;
};

export function GraphNodeCard({
  node,
  width,
  height,
  selected,
  highlighted,
  onClick,
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

  const fill = selected
    ? accentSoft
    : highlighted
      ? "rgba(36, 87, 214, 0.04)"
      : "white";
  const stroke = selected
    ? accent
    : highlighted
      ? "var(--pulso-primary)"
      : "var(--pulso-border)";
  const strokeWidth = selected ? 2 : highlighted ? 1.6 : 1;

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      style={{ cursor: "pointer" }}
      onClick={onClick}
      className={`pulso-graph-node ${selected ? "is-selected" : ""} ${
        highlighted ? "is-highlighted" : ""
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
    </g>
  );
}
