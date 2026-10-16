// Piezas compartidas por las pestañas internas del Constructor (contenido, respuesta, reglas,
// presentación, datos). Extraídas de canvas/FocusedWorkspace.tsx — refactor puro, revamp 2026-10-16.

import { ArrowDown, ArrowUp } from "lucide-react";
import type { BuilderNode } from "../../types";
import { type LogicScope } from "../../logic";
import { stripMarkdown } from "../../helpers/markdown";
import type { SectionBoundaryState } from "../FocusedWorkspace";

export function SectionBoundaryControl({
  boundary,
  onIncludeNext,
  onReleaseLast,
}: {
  boundary: SectionBoundaryState | null;
  onIncludeNext: () => void;
  onReleaseLast: () => void;
}) {
  if (!boundary) return null;
  return (
    <div className="pulso-focus-section-boundary" aria-label="Alcance del bloque">
      <div className="pulso-focus-section-boundary-head">
        <span className="pulso-section-eyebrow">Cierre XLSForm</span>
        <strong>{boundary.closeLabel}</strong>
      </div>
      <p>{boundary.closeDetail}</p>
      <div className="pulso-focus-section-boundary-actions">
        <button
          type="button"
          className="pulso-focus-section-boundary-button is-primary"
          onClick={onIncludeNext}
          disabled={!boundary.canIncludeNext}
          title={
            boundary.nextLabel
              ? `Mover el cierre para incluir "${boundary.nextLabel}"`
              : "No hay un elemento siguiente para incluir"
          }
        >
          <ArrowDown size={13} />
          <span>Incluir el siguiente</span>
        </button>
        <button
          type="button"
          className="pulso-focus-section-boundary-button"
          onClick={onReleaseLast}
          disabled={!boundary.canReleaseLast}
          title={
            boundary.lastChildLabel
              ? `Mover el cierre antes de "${boundary.lastChildLabel}"`
              : "El bloque no tiene elementos para sacar"
          }
        >
          <ArrowUp size={13} />
          <span>Sacar el último</span>
        </button>
      </div>
      <div className="pulso-focus-section-boundary-hint">
        {boundary.nextLabel ? (
          <span>
            Siguiente fuera del bloque: <strong>{boundary.nextLabel}</strong>
          </span>
        ) : (
          <span>No hay más elementos al mismo nivel para sumar a este bloque.</span>
        )}
        {boundary.lastChildLabel && (
          <span>
            Última dentro: <strong>{boundary.lastChildLabel}</strong>
          </span>
        )}
      </div>
    </div>
  );
}
export function fieldMessageLooksTechnical(value: string): boolean {
  return /\b(required|constraint|constraint_message|relevant|regex|odk|xlsform|formula|fórmula|xpath)\b/i.test(
    value,
  );
}
export function variableDisplayLabel(variable: LogicScope["variables"][number]): string {
  return stripMarkdown(variable.label || variable.name) || variable.name;
}
export function FocusFact({
  label,
  value,
  code,
}: {
  label: string;
  value: string;
  code?: boolean;
}) {
  return (
    <div className="pulso-focus-fact">
      <span>{label}</span>
      {code ? <code>{value}</code> : <strong>{value}</strong>}
    </div>
  );
}
export function shouldOfferPresentationTab(node: BuilderNode): boolean {
  if (node.appearance.trim()) return true;
  if (hasPromptMedia(node)) return true;
  if (node.kind === "section" || node.kind === "repeat") return true;
  if (node.kind === "question" || node.kind === "note") return true;
  return [
    "geopoint",
    "geotrace",
    "geoshape",
  ].includes(node.typeInfo.base);
}

export function hasPromptMedia(node: BuilderNode): boolean {
  return Boolean(
    node.mediaImage?.trim() ||
      node.mediaAudio?.trim() ||
      node.mediaVideo?.trim(),
  );
}
