// =============================================================================
// outline/OutlineDragOverlay.tsx — ghost que sigue al cursor durante el drag
// =============================================================================
// El overlay se monta fijo al `body` desde SurveyOutline para poder alinearlo
// al punto real de agarre. Así el ghost visual coincide con el destino que
// comunica la barra "Soltar aquí".
// =============================================================================

import type { BuilderNode } from "../types";
import { iconForType } from "../helpers/icons";
import { stripMarkdown } from "../helpers/markdown";
import { paletteForType } from "../helpers/paletteForType";
import { typeLabel } from "../parsing/parseType";
import { previewKindLabel } from "../parsing/buildIndex";

export function OutlineDragOverlay({
  node,
  size,
}: {
  node: BuilderNode;
  size: { width: number; height: number } | null;
}) {
  const Icon = iconForType(node.typeInfo.base);
  const accent = paletteForType(node.typeInfo.base);
  return (
    <div
      className="pulso-outline-row is-overlay"
      style={{
        cursor: "grabbing",
        width: size?.width,
        minHeight: size?.height,
      }}
    >
      <span className="pulso-outline-grip" aria-hidden="true" style={{ opacity: 1 }}>
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
            {stripMarkdown(node.label) || node.name || `fila_${node.rowIndex + 1}`}
          </strong>
          <span className="pulso-outline-subtitle">
            {node.kind === "question" ? typeLabel(node.typeInfo.base) : previewKindLabel(node)}
            {node.name && node.name !== stripMarkdown(node.label) ? ` · ${node.name}` : ""}
          </span>
        </span>
      </div>
    </div>
  );
}
