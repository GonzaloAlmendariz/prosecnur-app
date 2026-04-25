// =============================================================================
// canvas/Breadcrumb.tsx — ruta jerárquica clickeable encima del preview
// =============================================================================
// Cuando el usuario está editando una pregunta dentro de una sección anidada,
// el breadcrumb muestra la cadena de containers padre. Cada segmento es
// clickeable y selecciona ese container (al hacer click en "Salud", la
// selección pasa al `begin_group` de Salud).
//
// Ej.:
//   Formulario · Sección Salud · Bloque P10 · p10_a
// =============================================================================

import { ChevronRight, FileText } from "lucide-react";
import type { BuilderStructure } from "../types";

export type BreadcrumbProps = {
  /** rowIndex de la pregunta o sección actualmente seleccionada. */
  rowIndex: number;
  structure: BuilderStructure;
  /** Click en un segmento → selecciona esa fila en el outline. */
  onSelect: (rowIndex: number | "settings") => void;
};

export function Breadcrumb({ rowIndex, structure, onSelect }: BreadcrumbProps) {
  const node = structure.byRow.get(rowIndex);
  if (!node) return null;

  // Reconstruir la cadena de padres siguiendo `sectionId → parentId`.
  const trail: { id: string; label: string; rowIndex: number | null }[] = [];
  let cur: string | null = node.sectionId;
  while (cur && cur !== "root") {
    const sec = structure.sections.get(cur);
    if (!sec) break;
    trail.unshift({ id: cur, label: sec.label || sec.name || "Sección", rowIndex: sec.rowIndex });
    cur = sec.parentId ?? null;
  }

  const itemLabel =
    node.kind === "section" || node.kind === "repeat"
      ? null // si la propia selección es la sección, no la duplicamos al final
      : node.name || node.label || `fila_${node.rowIndex + 1}`;

  return (
    <nav aria-label="Ruta jerárquica" className="pulso-canvas-breadcrumb">
      <button
        type="button"
        className="pulso-canvas-breadcrumb-segment"
        onClick={() => onSelect("settings")}
        title="Ir a los ajustes del formulario"
      >
        <FileText size={12} />
        <span>Formulario</span>
      </button>
      {trail.map((segment) => (
        <span key={segment.id} className="pulso-canvas-breadcrumb-row">
          <ChevronRight size={12} className="pulso-canvas-breadcrumb-sep" />
          <button
            type="button"
            className="pulso-canvas-breadcrumb-segment"
            onClick={() => segment.rowIndex != null && onSelect(segment.rowIndex)}
            title={`Seleccionar la sección «${segment.label}»`}
            disabled={segment.rowIndex == null}
          >
            <span>{segment.label}</span>
          </button>
        </span>
      ))}
      {itemLabel && (
        <span className="pulso-canvas-breadcrumb-row">
          <ChevronRight size={12} className="pulso-canvas-breadcrumb-sep" />
          <span className="pulso-canvas-breadcrumb-current">{itemLabel}</span>
        </span>
      )}
    </nav>
  );
}
