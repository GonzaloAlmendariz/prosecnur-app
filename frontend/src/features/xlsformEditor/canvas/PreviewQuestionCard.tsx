// =============================================================================
// canvas/PreviewQuestionCard.tsx — preview fiel de una pregunta del formulario
// =============================================================================
// Renderiza una pregunta tal como la verá el encuestador en ODK Collect /
// KoBo, pero con el lenguaje visual de Pulso. Inputs reales (radio,
// checkbox, type=number, type=date, etc.) en estado disabled — no se puede
// responder, es solo previsualización.
//
// El switch por tipo (y sus building blocks) vive en `previewInputs.tsx`,
// compartido con `EditableQuestionCard` para que ambas cards rendericen
// exactamente lo mismo por tipo/appearance.
// =============================================================================

import type { CSSProperties } from "react";
import { IconConditionalLogic, IconRequired } from "../../../lib/icons";
import type { BuilderNode, ChoiceItem } from "../types";
import { iconForType } from "../helpers/icons";
import { paletteForType, paletteSoftForType } from "../helpers/paletteForType";
import { renderMarkdownInline } from "../helpers/markdown";
import { TechTerm } from "../helpers/TechTerm";
import { typeLabel } from "../parsing/parseType";
import { PreviewInputForType } from "./previewInputs";

export type PreviewQuestionCardProps = {
  node: BuilderNode;
  /** Opciones del catálogo asociado (si es select_one/multiple). */
  choices: ChoiceItem[];
  /** Posición de la pregunta dentro del outline (1-indexed) — se muestra
   *  como número de pregunta en el header. */
  position?: number;
};

export function PreviewQuestionCard({ node, choices, position }: PreviewQuestionCardProps) {
  const accent = paletteForType(node.typeInfo.base);
  const accentSoft = paletteSoftForType(node.typeInfo.base);
  const Icon = iconForType(node.typeInfo.base);
  const baseType = node.typeInfo.base;
  const baseLabel = typeLabel(baseType);

  return (
    <article
      className="pulso-canvas-card"
      style={{ "--card-accent": accent, "--card-accent-soft": accentSoft } as CSSProperties}
    >
      {/* Header: tipo + posición + obligatoria */}
      <div className="pulso-canvas-card-header">
        <span className="pulso-canvas-card-typebadge" style={{ color: accent, background: accentSoft }}>
          <Icon size={13} />
          {baseLabel}
          {baseType && baseLabel !== baseType && (
            <TechTerm t={baseType} title={`Tipo XLSForm: ${baseType}`} />
          )}
        </span>
        {position && (
          <span className="pulso-canvas-card-position" title="Posición en el formulario">
            #{position}
          </span>
        )}
        {node.required && (
          <span
            className="pulso-canvas-card-required"
            title="Pregunta obligatoria"
          >
            <IconRequired size={11} /> Obligatoria
          </span>
        )}
        {node.relevant && (
          <span className="pulso-canvas-card-conditional" title="Aparece bajo una condición">
            <IconConditionalLogic size={12} /> Condicional
          </span>
        )}
      </div>

      {/* Label + hint */}
      <div className="pulso-canvas-card-prompt">
        {node.label ? (
          <h3
            className="pulso-canvas-card-label"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: renderMarkdownInline(node.label),
            }}
          />
        ) : (
          <h3 className="pulso-canvas-card-label">
            <em style={{ color: "var(--pulso-warn-fg)" }}>
              (sin texto · agrégalo en el inspector)
            </em>
          </h3>
        )}
        {node.hint && (
          <p
            className="pulso-canvas-card-hint"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: renderMarkdownInline(node.hint),
            }}
          />
        )}
      </div>

      {/* Input fiel al tipo */}
      <div className="pulso-canvas-card-input">
        <PreviewInputForType node={node} choices={choices} accent={accent} />
      </div>

      {node.name && (
        <footer className="pulso-canvas-card-footer">
          <span className="pulso-canvas-card-fieldname">
            <code>{node.name}</code>
          </span>
        </footer>
      )}
    </article>
  );
}
