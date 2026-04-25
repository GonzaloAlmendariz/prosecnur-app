// =============================================================================
// outline/OutlineDragOverlay.tsx — ghost que sigue al cursor durante el drag
// =============================================================================
// `@dnd-kit/core` separa el item original (que se queda con `opacity: 0.5`)
// del overlay que sigue al cursor. Ese overlay es libre de aplicar transform
// global, sombra, rotación y otros efectos sin interferir con el layout
// original — fundamental para que el "ghost" se vea al estilo Notion/Linear.
// =============================================================================

import type { BuilderNode } from "../types";
import { iconForType } from "../helpers/icons";
import { paletteForType } from "../helpers/paletteForType";
import { typeLabel } from "../parsing/parseType";
import { previewKindLabel } from "../parsing/buildIndex";

export function OutlineDragOverlay({ node }: { node: BuilderNode }) {
  const Icon = iconForType(node.typeInfo.base);
  const accent = paletteForType(node.typeInfo.base);
  return (
    <div
      className="pulso-outline-row is-overlay"
      style={{
        cursor: "grabbing",
        boxShadow: "0 14px 32px rgba(15, 23, 42, 0.18)",
        transform: "rotate(-1.2deg)",
      }}
    >
      <span className="pulso-outline-grip" aria-hidden="true">
        ⠿
      </span>
      <div className="pulso-outline-body" style={{ paddingLeft: 2 }}>
        <span
          aria-hidden="true"
          className="pulso-outline-typeicon"
          style={{ color: accent }}
        >
          <Icon size={14} />
        </span>
        <span className="pulso-outline-text">
          <strong className="pulso-outline-title">
            {node.name || node.label || `fila_${node.rowIndex + 1}`}
          </strong>
          <span className="pulso-outline-subtitle">
            {node.kind === "question" ? typeLabel(node.typeInfo.base) : previewKindLabel(node)}
          </span>
        </span>
      </div>
    </div>
  );
}
